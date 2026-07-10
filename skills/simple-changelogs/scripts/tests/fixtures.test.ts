import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "bun";
import {
  cleanupFixtureWorkspace,
  createFixtureWorkspace,
  evaluateAssertions,
  initializeFixtureGit,
} from "../lib/fixtures.ts";
import type { EvalAssertion, RunnerResponse } from "../lib/types.ts";

const temporaryPaths = new Set<string>();
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const UNSAFE_ASSERTION_PATTERN = /unsafe|unsupported|symlink/i;
const FIXTURE_NAMES = [
  "dual-changelog",
  "forked-skill",
  "minimal-git",
  "mobile-monorepo",
  "release-repo",
  "routed-app",
  "skill-package",
] as const;
const FIXED_COMMIT_DATE = "2000-01-01T00:00:00Z";

const makeTemporaryDirectory = async (prefix: string): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryPaths.add(path);
  return path;
};

const makeFixtureRoot = async (): Promise<string> => {
  const root = await makeTemporaryDirectory("simple-changelogs-fixtures-");
  const base = join(root, "base");
  await mkdir(base);
  await writeFile(join(base, "README.md"), "fixture\n");
  await writeFile(join(base, ".fixture-state"), "hidden\n");
  return root;
};

const completedResponse = (
  overrides: Partial<RunnerResponse> = {}
): RunnerResponse => ({
  evaluationReport: {
    authorizationRecords: [
      {
        code: "NEW_RELEASE_NOTE_SURFACE",
        source: "current-request",
        status: "granted",
      },
    ],
    decisionCodes: ["CUSTOMER_ENTRY_ADDED"],
    nativeActivationEvidence: { activated: true, trace: ["simple-changelogs"] },
    reasonCodes: ["CUSTOMER_VISIBLE_OUTCOME"],
    verificationResults: [{ code: "release-notes-sync", status: "passed" }],
    versionMap: [{ path: "package.json", role: "package", version: "2.0.0" }],
  },
  finalResponse: "Updated both changelogs.",
  protocolVersion: 1,
  status: "completed",
  ...overrides,
});

afterEach(async () => {
  await Promise.all(
    [...temporaryPaths].map(async (path) => {
      await chmod(path, 0o700).catch(() => undefined);
      await rm(path, { force: true, recursive: true });
    })
  );
  temporaryPaths.clear();
});

describe("fixture workspaces", () => {
  test("discovers and isolates every bundled fixture base without leaks", async () => {
    const fixturesRoot = join(
      dirname(import.meta.dir),
      "..",
      "evals",
      "fixtures"
    );
    const workspaces = await Promise.all(
      FIXTURE_NAMES.map((name) => createFixtureWorkspace(fixturesRoot, name))
    );

    expect(new Set(workspaces).size).toBe(FIXTURE_NAMES.length);
    await Promise.all(
      workspaces.map((workspace) =>
        cleanupFixtureWorkspace(workspace, {
          failed: false,
          keepFailures: false,
        })
      )
    );
    await Promise.all(
      workspaces.map((workspace) => expect(lstat(workspace)).rejects.toThrow())
    );
  });

  test("copies dotfiles into independent temporary workspaces", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const first = await createFixtureWorkspace(fixturesRoot, "base");
    const second = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(first);
    temporaryPaths.add(second);

    expect(first).not.toBe(second);
    expect(await readFile(join(first, ".fixture-state"), "utf8")).toBe(
      "hidden\n"
    );
    await writeFile(join(first, "README.md"), "changed\n");
    expect(await readFile(join(second, "README.md"), "utf8")).toBe("fixture\n");
  });

  test("rejects traversal, dot segments, and fixture symlinks", async () => {
    const fixturesRoot = await makeFixtureRoot();
    await symlink(
      join(fixturesRoot, "base", "README.md"),
      join(fixturesRoot, "base", "linked")
    );

    await expect(
      createFixtureWorkspace(fixturesRoot, "../base")
    ).rejects.toThrow("fixture name");
    await expect(createFixtureWorkspace(fixturesRoot, ".")).rejects.toThrow(
      "fixture name"
    );
    await expect(createFixtureWorkspace(fixturesRoot, "base")).rejects.toThrow(
      "symlink"
    );
  });

  test("initializes a deterministic clean Git baseline", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);

    const baseline = await initializeFixtureGit(workspace);
    const status = spawnSync(["git", "status", "--porcelain"], {
      cwd: workspace,
    });
    const subject = spawnSync(["git", "log", "-1", "--format=%s"], {
      cwd: workspace,
    });
    const commitDate = spawnSync(["git", "log", "-1", "--format=%aI"], {
      cwd: workspace,
    });

    expect(baseline).toMatch(GIT_SHA_PATTERN);
    expect(status.exitCode).toBe(0);
    expect(status.stdout.toString()).toBe("");
    expect(subject.stdout.toString().trim()).toBe("eval fixture baseline");
    expect(commitDate.stdout.toString().trim()).toBe(FIXED_COMMIT_DATE);
  });
});

describe("assertion evaluation", () => {
  test("evaluates path, text, JSON, report, activation, Git, and command assertions", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await writeFile(
      join(workspace, "data.json"),
      '{"release":{"version":"2.0.0"}}\n'
    );
    await writeFile(join(workspace, "notes.md"), "Visible release outcome\n");
    await initializeFixtureGit(workspace);
    await writeFile(
      join(workspace, "notes.md"),
      "Visible release outcome\nChanged\n"
    );

    const assertions: EvalAssertion[] = [
      { expected: true, kind: "path.exists", target: "notes.md" },
      { expected: true, kind: "path.absent", target: "missing.md" },
      { expected: true, kind: "file.changed", target: "notes.md" },
      { expected: true, kind: "file.unchanged", target: "README.md" },
      { expected: "Changed", kind: "text.match", target: "notes.md" },
      {
        expected: "internal-secret",
        kind: "text.notMatch",
        target: "notes.md",
      },
      {
        expected: "2.0.0",
        kind: "json.path",
        target: "data.json#/release/version",
      },
      { expected: "completed", kind: "report.status" },
      { expected: "CUSTOMER_ENTRY_ADDED", kind: "report.decision" },
      { expected: "NEW_RELEASE_NOTE_SURFACE", kind: "report.authorization" },
      { expected: "package.json", kind: "report.versionMap" },
      { expected: "release-notes-sync", kind: "report.verification" },
      { expected: true, kind: "activation" },
      { expected: { branch: "main", clean: false }, kind: "repo.state" },
      {
        expected: {
          allowed: ["notes.md"],
          forbidden: ["README.md"],
          required: ["notes.md"],
        },
        kind: "git.changedPaths",
      },
      {
        expected: { argv: ["git", "status", "--short"], exitCode: 0 },
        kind: "command.exit",
      },
    ];

    const results = await evaluateAssertions(assertions, {
      response: completedResponse(),
      workspace,
    });

    expect(results).toHaveLength(assertions.length);
    expect(results.filter((result) => !result.passed)).toEqual([]);
  });

  test("rejects unsafe paths and unsupported assertions", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await initializeFixtureGit(workspace);
    const outside = await makeTemporaryDirectory("simple-changelogs-outside-");
    await writeFile(join(outside, "secret"), "secret\n");
    await symlink(join(outside, "secret"), join(workspace, "linked-secret"));

    const results = await evaluateAssertions(
      [
        { expected: true, kind: "path.exists", target: "../secret" },
        {
          expected: true,
          kind: "path.exists",
          target: join(outside, "secret"),
        },
        { expected: true, kind: "path.exists", target: "linked-secret" },
        { expected: true, kind: "unknown.assertion" },
      ],
      { response: completedResponse(), workspace }
    );

    expect(results.every((result) => !result.passed)).toBe(true);
    expect(results.map((result) => result.message).join("\n")).toMatch(
      UNSAFE_ASSERTION_PATTERN
    );
  });

  test("does not accept mutation reports without matching workspace changes", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await initializeFixtureGit(workspace);

    const [result] = await evaluateAssertions(
      [{ expected: true, kind: "file.changed", target: "CHANGELOG.md" }],
      { response: completedResponse(), workspace }
    );
    expect(result?.passed).toBe(false);
  });
});

describe("fixture cleanup", () => {
  test("deletes successful and ordinary failed workspaces", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const first = await createFixtureWorkspace(fixturesRoot, "base");
    const second = await createFixtureWorkspace(fixturesRoot, "base");
    await cleanupFixtureWorkspace(first, {
      failed: false,
      keepFailures: false,
    });
    await cleanupFixtureWorkspace(second, {
      failed: true,
      keepFailures: false,
    });
    await expect(lstat(first)).rejects.toThrow();
    await expect(lstat(second)).rejects.toThrow();
  });

  test("retains failed workspaces only when requested", async () => {
    const workspace = await makeTemporaryDirectory(
      "simple-changelogs-retained-"
    );
    await cleanupFixtureWorkspace(workspace, {
      failed: true,
      keepFailures: true,
    });
    expect((await lstat(workspace)).isDirectory()).toBe(true);
  });

  test("rejects deletion outside evaluator-owned temporary workspaces", async () => {
    const workspace = await makeTemporaryDirectory(
      "simple-changelogs-not-owned-"
    );

    await expect(
      cleanupFixtureWorkspace(workspace, {
        failed: false,
        keepFailures: false,
      })
    ).rejects.toThrow("Refusing");
    expect((await lstat(workspace)).isDirectory()).toBe(true);
  });
});
