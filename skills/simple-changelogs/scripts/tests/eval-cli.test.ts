import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
            assertions: [{ expected: true, kind: "report-status" }],
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
      "# Guidance Updates\n\n## Version 1\n\nInitial guidance.\n"
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

const runCli = async (...args: string[]): Promise<CliResult> => {
  const child = spawn([process.execPath, evalPath, ...args], {
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
});
