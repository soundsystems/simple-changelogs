import { afterEach, describe, expect, test } from "bun:test";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "bun";

const temporaryDirectories: string[] = [];
const evalPath = new URL("../eval.ts", import.meta.url).pathname;

interface CliResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const writeNested = async (
  root: string,
  path: string,
  contents: string
): Promise<void> => {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
};

const emptyReport = `{
  authorizationRecords: [],
  decisionCodes: [],
  reasonCodes: [],
  verificationResults: [],
  versionMap: []
}`;

const fakeAdapterSource = `
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const request = JSON.parse(await Bun.stdin.text());
const log = process.env.SIMPLE_CHANGELOGS_WORKSPACE_LOG;
if (log) {
  const previous = existsSync(log) ? readFileSync(log, "utf8") : "";
  await Bun.write(log, previous + request.workspace + "\\n");
}

const base = {
  protocolVersion: 2,
  status: "completed",
  finalResponse: "completed",
  evaluationReport: ${emptyReport},
};

switch (request.case.id) {
  case "single-pass":
    await Bun.write(join(request.workspace, "result.txt"), "ready\\n");
    base.finalResponse = "single-pass";
    break;
  case "multi-turn":
    if (request.turnIndex === 0) {
      await Bun.write(join(request.workspace, "state.txt"), "turn-zero\\n");
      base.finalResponse = "turn-zero";
    } else {
      if (!existsSync(join(request.workspace, "state.txt"))) {
        throw new Error("workspace was not reused");
      }
      await Bun.write(
        join(request.workspace, "transcript.json"),
        JSON.stringify(request.transcript)
      );
      await Bun.write(join(request.workspace, "state.txt"), "turn-one\\n");
      base.finalResponse = "turn-one";
    }
    break;
  case "missing-activation":
    base.finalResponse = "no activation trace";
    break;
  case "activation-unsupported-response":
    base.status = "skipped";
    base.finalResponse = "activation trace unavailable";
    base.diagnostics = [{
      code: "CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE",
      message: "runtime cannot report native activation"
    }];
    break;
  case "claimed-mutation":
    base.evaluationReport.decisionCodes = ["CUSTOMER_ENTRY_ADDED"];
    break;
  case "adapter-error":
    base.status = "error";
    base.finalResponse = "adapter failed";
    base.diagnostics = [{ code: "MODEL_ERROR", message: "simulated" }];
    break;
  case "multi-unsupported":
    if (request.turnIndex === 0) {
      base.finalResponse = "first turn";
    } else {
      base.status = "skipped";
      base.finalResponse = "state unavailable";
      base.diagnostics = [{
        code: "CAPABILITY_MULTI_STEP_UNAVAILABLE",
        message: "runtime cannot preserve multi-turn state"
      }];
    }
    break;
  case "invalid-response":
    process.stdout.write("{}");
    process.exit(0);
  default:
    throw new Error("unexpected case " + request.case.id);
}

process.stdout.write(JSON.stringify(base));
`;

const createBehaviorSkill = async (): Promise<{
  adapter: string;
  skillDirectory: string;
}> => {
  const root = await mkdtemp(join(tmpdir(), "simple-changelogs-behavior-"));
  temporaryDirectories.push(root);
  const skillDirectory = join(root, "portable-skill");
  const adapter = join(root, "fake-adapter.ts");
  const behaviorCase = (
    id: string,
    turns: Record<string, unknown>[],
    suite = "behavior"
  ) => ({
    activationMode: suite === "trigger" ? "discover" : "explicit",
    fixture: "minimal",
    id,
    suite,
    tags: [id],
    turns,
  });
  const reportStatus = {
    assertions: [{ expected: "completed", kind: "report.status" }],
    prompt: "run the case",
  };
  const manifest = {
    cases: [
      behaviorCase("single-pass", [
        {
          assertions: [
            { expected: true, kind: "path.exists", target: "result.txt" },
            { expected: "ready", kind: "text.match", target: "result.txt" },
          ],
          prompt: "single turn",
        },
      ]),
      behaviorCase("multi-turn", [
        {
          assertions: [
            { expected: true, kind: "path.exists", target: "state.txt" },
          ],
          prompt: "first prompt",
        },
        {
          assertions: [
            {
              expected: [
                { content: "first prompt", role: "user" },
                { content: "turn-zero", role: "assistant" },
              ],
              kind: "json.path",
              target: "transcript.json",
            },
            { expected: "turn-one", kind: "text.match", target: "state.txt" },
          ],
          prompt: "second prompt",
        },
      ]),
      behaviorCase(
        "missing-activation",
        [
          {
            assertions: [{ expected: true, kind: "activation" }],
            prompt: "discover changelog behavior",
          },
        ],
        "trigger"
      ),
      behaviorCase(
        "activation-unsupported-response",
        [
          {
            assertions: [{ expected: true, kind: "activation" }],
            prompt: "runtime activation evidence",
          },
        ],
        "trigger"
      ),
      behaviorCase("claimed-mutation", [
        {
          assertions: [
            { expected: true, kind: "file.changed", target: "CHANGELOG.md" },
          ],
          prompt: "claim a mutation",
        },
      ]),
      behaviorCase("adapter-error", [reportStatus]),
      behaviorCase("multi-unsupported", [reportStatus, reportStatus]),
      behaviorCase("invalid-response", [reportStatus]),
    ],
    manifestVersion: 1,
  };

  await Promise.all([
    writeNested(
      skillDirectory,
      "SKILL.md",
      `---
name: portable-skill
description: Use for portable changelog and release-note evaluation tasks.
---

# Portable Skill

Current guidance version: 1

Read \`references/setup.md\` and \`references/guidance-updates.md\`.
`
    ),
    writeNested(skillDirectory, "EVAL.md", "# Evaluation\n"),
    writeNested(
      skillDirectory,
      "references/setup.md",
      `# Setup

<!-- simple-changelogs-policy-example -->
\`\`\`json
{
  "schemaVersion": 1,
  "guidance": { "version": 1, "backfillStatus": "completed" },
  "developerChangelog": "required",
  "signatures": "agent-and-timestamp",
  "newReleaseNoteSurfaces": "ask"
}
\`\`\`
`
    ),
    writeNested(
      skillDirectory,
      "references/guidance-updates.md",
      "# Guidance Updates\n\n## Guidance 1\n\nInitial guidance.\n"
    ),
    writeNested(
      skillDirectory,
      "evals/cases.json",
      `${JSON.stringify(manifest)}\n`
    ),
    writeNested(
      skillDirectory,
      "evals/schemas/runner-response.schema.json",
      "{}\n"
    ),
    ...["eval-manifest", "repo-policy", "runner-request"].map((name) =>
      writeNested(skillDirectory, `evals/schemas/${name}.schema.json`, "{}\n")
    ),
    writeNested(
      skillDirectory,
      "evals/fixtures/minimal/README.md",
      "fixture\n"
    ),
    writeFile(adapter, fakeAdapterSource),
    writeNested(
      skillDirectory,
      "scripts/check-fork-sync.sh",
      "#!/bin/sh\nexit 0\n"
    ),
    writeNested(skillDirectory, "scripts/eval.ts", "export {};\n"),
  ]);
  return { adapter, skillDirectory };
};

const runCli = async (
  environment: Record<string, string>,
  ...args: string[]
): Promise<CliResult> => {
  const child = spawn([process.execPath, evalPath, ...args], {
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stderr, stdout };
};

const runBehavior = (
  skillDirectory: string,
  adapter: string,
  ...args: string[]
): Promise<CliResult> =>
  runCli(
    {},
    "behavior",
    "--format",
    "json",
    "--skill-directory",
    skillDirectory,
    "--adapter",
    adapter,
    ...args
  );

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("model-backed evaluation CLI", () => {
  test("runs a single case and cleans its successful workspace", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const workspaceLog = join(dirname(skillDirectory), "workspaces.log");
    const result = await runCli(
      { SIMPLE_CHANGELOGS_WORKSPACE_LOG: workspaceLog },
      "behavior",
      "--format",
      "json",
      "--skill-directory",
      skillDirectory,
      "--adapter",
      adapter,
      "--case",
      "single-pass"
    );
    const report = JSON.parse(result.stdout);
    const [workspace] = (await readFile(workspaceLog, "utf8"))
      .trim()
      .split("\n");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(report).toMatchObject({
      counts: {
        assertions: { failed: 0, passed: 2, total: 2 },
        failed: 0,
        passed: 1,
        total: 1,
      },
      reportVersion: 1,
      status: "pass",
      suite: "behavior",
    });
    expect(report.cases[0]).toMatchObject({
      id: "single-pass",
      status: "passed",
    });
    await expect(lstat(workspace ?? "")).rejects.toThrow();
  });

  test("reuses a workspace and sends prior transcript across turns", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const result = await runBehavior(
      skillDirectory,
      adapter,
      "--case",
      "multi-turn"
    );
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report.cases[0]).toMatchObject({
      assertions: { failed: 0, passed: 3, total: 3 },
      id: "multi-turn",
      status: "passed",
    });
    expect(report.cases[0].turns).toHaveLength(2);
  });

  test("applies repeatable case filters and rejects unknown IDs", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const selected = await runBehavior(
      skillDirectory,
      adapter,
      "--case",
      "single-pass",
      "--case",
      "multi-turn"
    );
    const unknown = await runBehavior(
      skillDirectory,
      adapter,
      "--case",
      "not-present"
    );

    expect(selected.exitCode).toBe(0);
    expect(JSON.parse(selected.stdout).counts.total).toBe(2);
    expect(unknown.exitCode).toBe(2);
    expect(JSON.parse(unknown.stdout).error.message).toContain("not-present");
  });

  test("reports unsupported activation, false mutation claims, adapter errors, and multi-step gaps", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const [activation, mutation, adapterError, multiStep] = await Promise.all([
      runCli(
        {},
        "trigger",
        "--format",
        "json",
        "--skill-directory",
        skillDirectory,
        "--adapter",
        adapter,
        "--case",
        "missing-activation"
      ),
      runBehavior(skillDirectory, adapter, "--case", "claimed-mutation"),
      runBehavior(skillDirectory, adapter, "--case", "adapter-error"),
      runBehavior(skillDirectory, adapter, "--case", "multi-unsupported"),
    ]);

    expect(activation.exitCode).toBe(1);
    expect(JSON.parse(activation.stdout).cases[0]).toMatchObject({
      reasonCodes: ["CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE"],
      status: "unsupported",
    });
    expect(mutation.exitCode).toBe(1);
    expect(JSON.parse(mutation.stdout).cases[0].status).toBe("failed");
    expect(adapterError.exitCode).toBe(1);
    expect(JSON.parse(adapterError.stdout).cases[0].status).toBe("error");
    expect(multiStep.exitCode).toBe(1);
    expect(JSON.parse(multiStep.stdout).cases[0]).toMatchObject({
      reasonCodes: ["CAPABILITY_MULTI_STEP_UNAVAILABLE"],
      status: "unsupported",
    });
  });

  test("maps activation capability diagnostics on non-completed responses", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const result = await runCli(
      {},
      "trigger",
      "--format",
      "json",
      "--skill-directory",
      skillDirectory,
      "--adapter",
      adapter,
      "--case",
      "activation-unsupported-response"
    );

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).cases[0]).toMatchObject({
      reasonCodes: ["CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE"],
      status: "unsupported",
    });
  });

  test("cleans earlier retained failures when a later case aborts configuration", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const workspaceLog = join(dirname(skillDirectory), "abort-workspaces.log");
    const result = await runCli(
      { SIMPLE_CHANGELOGS_WORKSPACE_LOG: workspaceLog },
      "behavior",
      "--format",
      "json",
      "--skill-directory",
      skillDirectory,
      "--adapter",
      adapter,
      "--case",
      "claimed-mutation",
      "--case",
      "invalid-response",
      "--keep-failures"
    );
    const workspaces = (await readFile(workspaceLog, "utf8"))
      .trim()
      .split("\n");

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: { code: "INVALID_CONFIGURATION" },
      status: "error",
    });
    await Promise.all(
      workspaces.map((workspace) => expect(lstat(workspace)).rejects.toThrow())
    );
  });

  test("retains only failed workspaces when requested", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const result = await runBehavior(
      skillDirectory,
      adapter,
      "--case",
      "claimed-mutation",
      "--keep-failures"
    );
    const report = JSON.parse(result.stdout);
    const workspace = report.cases[0].workspace as string;

    expect(result.exitCode).toBe(1);
    expect(workspace).toStartWith(tmpdir());
    expect((await lstat(workspace)).isDirectory()).toBe(true);
    await rm(workspace, { force: true, recursive: true });
  });

  test("treats invalid adapter output and missing harness files as configuration errors", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const invalidAdapter = join(dirname(skillDirectory), "invalid-adapter.ts");
    await writeFile(invalidAdapter, 'process.stdout.write("{}");\n');
    const invalid = await runBehavior(
      skillDirectory,
      invalidAdapter,
      "--case",
      "single-pass"
    );
    await rm(join(skillDirectory, "evals", "fixtures", "minimal"), {
      force: true,
      recursive: true,
    });
    const missingFixture = await runBehavior(
      skillDirectory,
      adapter,
      "--case",
      "single-pass"
    );
    await rm(join(skillDirectory, "evals", "cases.json"));
    const missingManifest = await runBehavior(
      skillDirectory,
      adapter,
      "--case",
      "single-pass"
    );

    for (const result of [invalid, missingFixture, missingManifest]) {
      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: { code: "INVALID_CONFIGURATION" },
        reportVersion: 1,
        status: "error",
      });
    }
  });

  test("renders case and assertion counts in text output", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const result = await runCli(
      {},
      "behavior",
      "--skill-directory",
      skillDirectory,
      "--adapter",
      adapter,
      "--case",
      "single-pass"
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Cases: 1 total, 1 passed, 0 failed");
    expect(result.stdout).toContain("Assertions: 2 total, 2 passed, 0 failed");
  });

  test("combines contract and selected model cases in the all report", async () => {
    const { adapter, skillDirectory } = await createBehaviorSkill();
    const result = await runCli(
      {},
      "all",
      "--format",
      "json",
      "--skill-directory",
      skillDirectory,
      "--adapter",
      adapter,
      "--case",
      "single-pass"
    );
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      counts: { failed: 0, findings: 0, passed: 2, total: 2 },
      status: "pass",
      suite: "all",
    });
    expect(report.cases).toHaveLength(1);
  });
});
