import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "bun";

const temporaryDirectories: string[] = [];
const evalPath = new URL("../eval.ts", import.meta.url).pathname;

const writeFixtureFile = async (
  skillDirectory: string,
  path: string,
  contents: string
): Promise<void> => {
  const destination = join(skillDirectory, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
};

const createValidSkill = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "simple-changelogs-cli-"));
  temporaryDirectories.push(root);
  const skillDirectory = join(root, "tiny-skill");
  const validManifest = {
    cases: [
      {
        activationMode: "explicit",
        fixture: "minimal",
        id: "portable-case",
        suite: "behavior",
        tags: [],
        turns: [
          {
            assertions: [{ expected: "completed", kind: "report.status" }],
            prompt: "Update pending changelogs.",
          },
        ],
      },
    ],
    manifestVersion: 1,
  };

  await Promise.all([
    writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `---
name: tiny-skill
description: Use for a portable CLI fixture.
---

# Tiny Skill

Current guidance version: 1

Read \`references/setup.md\` and \`references/guidance-updates.md\`.
`
    ),
    writeFixtureFile(skillDirectory, "EVAL.md", "# Evaluation\n"),
    writeFixtureFile(
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
    writeFixtureFile(
      skillDirectory,
      "references/guidance-updates.md",
      "# Guidance Updates\n\n## Guidance 1\n\nInitial guidance.\n"
    ),
    writeFixtureFile(
      skillDirectory,
      "evals/cases.json",
      `${JSON.stringify(validManifest)}\n`
    ),
    ...[
      "eval-manifest",
      "repo-policy",
      "runner-request",
      "runner-response",
    ].map((name) =>
      writeFixtureFile(
        skillDirectory,
        `evals/schemas/${name}.schema.json`,
        "{}\n"
      )
    ),
    writeFixtureFile(
      skillDirectory,
      "scripts/check-fork-sync.sh",
      "#!/bin/sh\nexit 0\n"
    ),
    writeFixtureFile(skillDirectory, "scripts/eval.ts", "export {};\n"),
  ]);
  return skillDirectory;
};

interface CliResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const runCliWithEnvironment = async (
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

const runCli = (...args: string[]): Promise<CliResult> =>
  runCliWithEnvironment({}, ...args);

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("evaluation CLI", () => {
  test("reports a passing contract suite as one versioned JSON object", async () => {
    const skillDirectory = await createValidSkill();

    const result = await runCli(
      "contract",
      "--format",
      "json",
      "--skill-directory",
      skillDirectory
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      counts: { failed: 0, findings: 0, passed: 1, total: 1 },
      findings: [],
      reportVersion: 1,
      status: "pass",
      suite: "contract",
    });
  });

  test("reports contract findings and exits one", async () => {
    const skillDirectory = await createValidSkill();
    await rm(join(skillDirectory, "references/setup.md"));

    const result = await runCli(
      "contract",
      "--format",
      "json",
      "--skill-directory",
      skillDirectory
    );
    const report = JSON.parse(result.stdout) as {
      counts: { failed: number; findings: number; passed: number };
      findings: unknown[];
      status: string;
    };

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("fail");
    expect(report.counts.failed).toBe(1);
    expect(report.counts.passed).toBe(0);
    expect(report.counts.findings).toBeGreaterThan(0);
    expect(report.findings.length).toBe(report.counts.findings);
  });

  test("rejects unknown commands as invalid configuration", async () => {
    const result = await runCli("unknown-command");

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown command");
  });

  test("requires adapters for model-backed suites", async () => {
    const [trigger, behavior, all] = await Promise.all([
      runCli("trigger"),
      runCli("behavior", "--adapter", "/definitely/missing/adapter"),
      runCli("all"),
    ]);

    expect(trigger.exitCode).toBe(2);
    expect(trigger.stderr).toContain("--adapter");
    expect(behavior.exitCode).toBe(2);
    expect(behavior.stderr).toContain("Adapter does not exist");
    expect(all.exitCode).toBe(2);
  });

  test("reports invalid skill roots as configuration errors", async () => {
    const root = await mkdtemp(join(tmpdir(), "simple-changelogs-cli-root-"));
    temporaryDirectories.push(root);
    const missingRoot = join(root, "missing");
    const fileRoot = join(root, "file");
    const unreadableRoot = await createValidSkill();
    await writeFile(fileRoot, "not a directory\n");
    await chmod(unreadableRoot, 0o000);

    const results = await Promise.all(
      [missingRoot, fileRoot, unreadableRoot].map((skillDirectory) =>
        runCli(
          "contract",
          "--format",
          "json",
          "--skill-directory",
          skillDirectory
        )
      )
    );
    await chmod(unreadableRoot, 0o700);

    for (const result of results) {
      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: { code: "INVALID_CONFIGURATION" },
        reportVersion: 1,
        status: "error",
      });
    }
  });

  test("honors JSON format for parse errors even when the error comes first", async () => {
    const [unknown, invalidTimeout] = await Promise.all([
      runCli("contract", "--unknown", "--format", "json"),
      runCli("contract", "--timeout-ms", "invalid", "--format", "json"),
    ]);

    for (const result of [unknown, invalidTimeout]) {
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: { code: "INVALID_CONFIGURATION" },
        reportVersion: 1,
        status: "error",
      });
    }
  });

  test("injects shell spawn failure without a runtime language override", async () => {
    const skillDirectory = await createValidSkill();
    const environmentResult = await runCliWithEnvironment(
      {
        SIMPLE_CHANGELOGS_EVAL_SHELL: join(skillDirectory, "missing-shell"),
      },
      "contract",
      "--format",
      "json",
      "--skill-directory",
      skillDirectory
    );
    const wrapperRoot = await mkdtemp(
      join(tmpdir(), "simple-changelogs-cli-injected-")
    );
    temporaryDirectories.push(wrapperRoot);
    const wrapperPath = join(wrapperRoot, "injected-cli.ts");
    await writeFile(
      wrapperPath,
      `import { runCli } from ${JSON.stringify(evalPath)};
process.exitCode = await runCli(${JSON.stringify([
        "contract",
        "--format",
        "json",
        "--skill-directory",
        skillDirectory,
      ])}, {
  contractOptions: {
    shellSyntaxCheck: async () => { throw new Error("injected spawn failure"); }
  }
});
`
    );
    const child = spawn([process.execPath, wrapperPath], {
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stdout] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);

    expect(environmentResult.exitCode).toBe(0);
    expect(exitCode).toBe(2);
    expect(JSON.parse(stdout)).toMatchObject({
      error: {
        code: "INVALID_CONFIGURATION",
        message: expect.stringContaining("shell syntax checker"),
      },
      reportVersion: 1,
      status: "error",
    });
  });
});
