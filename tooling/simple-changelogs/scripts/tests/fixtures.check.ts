import { afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
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
  "editorial-updates-app",
  "forked-skill",
  "minimal-git",
  "mobile-monorepo",
  "release-repo",
  "routed-app",
  "single-changelog",
  "skill-package",
  "surface-established-system",
  "surface-mobile-store",
  "surface-radix-app",
  "surface-react-tailwind",
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
    versionMap: [
      {
        identifierRole: "public-version",
        path: "package.json",
        role: "package",
        version: "2.0.0",
      },
    ],
  },
  finalResponse: "Updated both changelogs.",
  protocolVersion: 2,
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

  test("restores stored SKILL.fixture.md files as workspace SKILL.md", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const base = join(fixturesRoot, "base");
    await writeFile(join(base, "SKILL.fixture.md"), "root skill\n");
    await mkdir(join(base, "skills", "fork"), { recursive: true });
    await writeFile(
      join(base, "skills", "fork", "SKILL.fixture.md"),
      "nested skill\n"
    );
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);

    expect(await readFile(join(workspace, "SKILL.md"), "utf8")).toBe(
      "root skill\n"
    );
    expect(
      await readFile(join(workspace, "skills", "fork", "SKILL.md"), "utf8")
    ).toBe("nested skill\n");
    await expect(lstat(join(workspace, "SKILL.fixture.md"))).rejects.toThrow();
    await expect(
      lstat(join(workspace, "skills", "fork", "SKILL.fixture.md"))
    ).rejects.toThrow();
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

  test("ignores hostile host Git signing, hook, and template configuration", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    const hostileRoot = await makeTemporaryDirectory(
      "simple-changelogs-hostile-git-"
    );
    const hooks = join(hostileRoot, "hooks");
    const templateHooks = join(hostileRoot, "template", "hooks");
    await Promise.all([
      mkdir(hooks),
      mkdir(templateHooks, { recursive: true }),
    ]);
    const rejectingHook = "#!/bin/sh\nexit 1\n";
    await Promise.all([
      writeFile(join(hooks, "pre-commit"), rejectingHook, { mode: 0o755 }),
      writeFile(join(templateHooks, "pre-commit"), rejectingHook, {
        mode: 0o755,
      }),
    ]);
    const hostileConfig = join(hostileRoot, "gitconfig");
    await writeFile(
      hostileConfig,
      `[commit]\n\tgpgSign = true\n[core]\n\thooksPath = ${hooks}\n[init]\n\ttemplateDir = ${join(hostileRoot, "template")}\n`
    );
    const previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
    const previousConfigParameters = process.env.GIT_CONFIG_PARAMETERS;
    process.env.GIT_CONFIG_GLOBAL = hostileConfig;
    process.env.GIT_CONFIG_PARAMETERS = "malformed-host-configuration";
    try {
      await expect(initializeFixtureGit(workspace)).resolves.toMatch(
        GIT_SHA_PATTERN
      );
    } finally {
      if (previousGlobalConfig === undefined) {
        delete process.env.GIT_CONFIG_GLOBAL;
      } else {
        process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
      }
      if (previousConfigParameters === undefined) {
        delete process.env.GIT_CONFIG_PARAMETERS;
      } else {
        process.env.GIT_CONFIG_PARAMETERS = previousConfigParameters;
      }
    }
  });

  test("keeps the baseline commit stable under inherited Git identity and hash variables", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const clean = await createFixtureWorkspace(fixturesRoot, "base");
    const inheriting = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(clean);
    temporaryPaths.add(inheriting);
    const expected = await initializeFixtureGit(clean);
    const inherited = new Map([
      ["GIT_AUTHOR_EMAIL", "host-author@example.invalid"],
      ["GIT_AUTHOR_NAME", "Host Author"],
      ["GIT_COMMITTER_EMAIL", "host-committer@example.invalid"],
      ["GIT_COMMITTER_NAME", "Host Committer"],
      ["GIT_DEFAULT_HASH", "sha256"],
    ]);
    const previous = new Map(
      [...inherited.keys()].map((key) => [key, process.env[key]])
    );
    for (const [key, value] of inherited) {
      process.env[key] = value;
    }
    try {
      expect(await initializeFixtureGit(inheriting)).toBe(expected);
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) {
          Reflect.deleteProperty(process.env, key);
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});

describe("assertion evaluation", () => {
  test("evaluates path, text, JSON, report, activation, and Git assertions", async () => {
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
      {
        expected: {
          activated: true,
          excludes: ["global/simple-changelogs"],
          includes: ["simple-changelogs"],
        },
        kind: "activation",
      },
      { expected: { branch: "main", clean: false }, kind: "repo.state" },
      {
        expected: {
          allowed: ["notes.md"],
          forbidden: ["README.md"],
          required: ["notes.md"],
        },
        kind: "git.changedPaths",
      },
    ];

    const results = await evaluateAssertions(assertions, {
      response: completedResponse(),
      workspace,
    });

    expect(results).toHaveLength(assertions.length);
    expect(results.filter((result) => !result.passed)).toEqual([]);
  });

  test("counts an edit that is staged and then undone only in the working tree", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await initializeFixtureGit(workspace);
    const readme = join(workspace, "README.md");
    const original = await readFile(readme, "utf8");
    await writeFile(readme, "altered\n");
    const stage = spawnSync(["git", "add", "README.md"], {
      cwd: workspace,
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
    });
    expect(stage.exitCode).toBe(0);
    await writeFile(readme, original);

    const results = await evaluateAssertions(
      [
        { expected: true, kind: "file.unchanged", target: "README.md" },
        { expected: { clean: true }, kind: "repo.state" },
      ],
      { response: completedResponse(), workspace }
    );

    expect(results.map((result) => result.passed)).toEqual([false, false]);
  });

  test("counts committed changes against the runner's baseline", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await initializeFixtureGit(workspace);
    await writeFile(join(workspace, "README.md"), "altered\n");
    await writeFile(join(workspace, "notes.md"), "new\n");
    const commit = spawnSync(
      [
        "git",
        "-c",
        "commit.gpgSign=false",
        "-c",
        `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
        "commit",
        "--all",
        "--quiet",
        "--no-verify",
        "--message",
        "agent commit",
      ],
      {
        cwd: workspace,
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
      }
    );
    expect(commit.exitCode).toBe(0);

    const results = await evaluateAssertions(
      [
        { expected: true, kind: "file.changed", target: "README.md" },
        { expected: true, kind: "file.unchanged", target: "README.md" },
        { expected: true, kind: "file.changed", target: "notes.md" },
        { expected: { clean: true }, kind: "repo.state" },
      ],
      { response: completedResponse(), workspace }
    );

    expect(results.map((result) => result.passed)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  test("checks that a target includes another file's text", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await initializeFixtureGit(workspace);
    await Promise.all([
      writeFile(
        join(workspace, "record.md"),
        "## Copy\n\nOpen Catalog and\nexpect the latest   selection.\n"
      ),
      writeFile(
        join(workspace, "published.txt"),
        "Open Catalog and expect the latest selection.\n"
      ),
      writeFile(join(workspace, "other.txt"), "Expect every filter to stay.\n"),
      writeFile(join(workspace, "blank.txt"), " \n"),
    ]);

    const results = await evaluateAssertions(
      ["published.txt", "other.txt", "blank.txt", "missing.txt", "../x"].map(
        (expected): EvalAssertion => ({
          expected,
          kind: "text.includesFile",
          target: "record.md",
        })
      ),
      { response: completedResponse(), workspace }
    );

    expect(results.map((result) => result.passed)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(results[4]?.message).toMatch(UNSAFE_ASSERTION_PATTERN);
  });

  test("evaluates text assertions against matching Markdown sections", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await initializeFixtureGit(workspace);
    await Promise.all([
      writeFile(
        join(workspace, "record.md"),
        [
          "# What to Test",
          "",
          "## Full checklist",
          "",
          "Open Catalog.",
          "",
          "### Carried checks",
          "",
          "Nested detail.",
          "",
          "```md",
          "## Fenced",
          "```",
          "",
          "~~~~md",
          "```",
          "## Tilde fenced",
          "~~~",
          "~~~~",
          "",
          "```md",
          "```suffix",
          "## Suffix fenced",
          "```",
          "",
          "## TestFlight copy",
          "",
          "  Open Catalog and",
          "expect the latest selection.  ",
          "",
        ].join("\n")
      ),
      writeFile(
        join(workspace, "published.txt"),
        "Open Catalog and expect the latest selection.\n"
      ),
    ]);
    const section = (
      kind: "text.match" | "text.notMatch",
      heading: string,
      expected: string
    ): EvalAssertion => ({ expected, kind, target: `record.md#${heading}` });

    const results = await evaluateAssertions(
      [
        section(
          "text.match",
          "^## TestFlight",
          "^  Open[\\s\\S]*selection\\.$"
        ),
        section("text.match", "^#{2,3} .*checklist", "Nested detail"),
        section("text.match", "^#{2,3} .*checklist", "## Fenced"),
        section("text.notMatch", "^## TestFlight", "Nested detail"),
        {
          expected: "published.txt",
          kind: "text.includesFile",
          target: "record.md#^## TestFlight",
        },
        section("text.match", "^## Fenced", "."),
        section("text.match", "^## Tilde fenced", "."),
        section("text.match", "^## Suffix fenced", "."),
        section("text.match", "^## Missing", "."),
        section("text.notMatch", "^## Missing", "."),
        section("text.match", "[", "."),
      ],
      { response: completedResponse(), workspace }
    );

    expect(results.map((result) => result.passed)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  test("rejects unsafe paths and unsupported assertions", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await initializeFixtureGit(workspace);
    const outside = await makeTemporaryDirectory("simple-changelogs-outside-");
    await writeFile(join(outside, "secret"), "secret\n");
    await symlink(join(outside, "secret"), join(workspace, "linked-secret"));
    const escapedPath = join(outside, "escaped");

    const results = await evaluateAssertions(
      [
        { expected: true, kind: "path.exists", target: "../secret" },
        {
          expected: true,
          kind: "path.exists",
          target: join(outside, "secret"),
        },
        { expected: true, kind: "path.exists", target: "linked-secret" },
        { expected: true, kind: "file.unchanged", target: "../outside" },
        {
          expected: { forbidden: ["../outside"] },
          kind: "git.changedPaths",
        },
        {
          expected: true,
          kind: "unknown.assertion",
        } as unknown as EvalAssertion,
        {
          expected: {
            argv: [
              process.execPath,
              "-e",
              `await Bun.write(${JSON.stringify(escapedPath)}, "escaped")`,
            ],
            exitCode: 0,
          },
          kind: "command.exit",
        } as unknown as EvalAssertion,
      ],
      { response: completedResponse(), workspace }
    );

    expect(results.every((result) => !result.passed)).toBe(true);
    expect(results.map((result) => result.message).join("\n")).toMatch(
      UNSAFE_ASSERTION_PATTERN
    );
    await expect(lstat(escapedPath)).rejects.toThrow();
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

  test("rejects unknown report kinds and unsuccessful report records", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await initializeFixtureGit(workspace);
    const response = completedResponse();
    response.evaluationReport.authorizationRecords[0] = {
      code: "NEW_RELEASE_NOTE_SURFACE",
      source: "none",
      status: "denied",
    };
    response.evaluationReport.verificationResults[0] = {
      code: "release-notes-sync".toUpperCase().replaceAll("-", "_"),
      status: "failed",
    };

    const results = await evaluateAssertions(
      [
        {
          expected: "RELEASE_NOTES_SYNC",
          kind: "report.typo",
        } as unknown as EvalAssertion,
        { expected: "RELEASE_NOTES_SYNC", kind: "report.verification" },
        {
          expected: "NEW_RELEASE_NOTE_SURFACE",
          kind: "report.authorization",
        },
        {
          expected: {
            code: "NEW_RELEASE_NOTE_SURFACE",
            source: "none",
            status: "denied",
          },
          kind: "report.authorization",
        },
        {
          expected: {
            path: "package.json",
            role: "package",
            version: "2.0.0",
          },
          kind: "report.versionMap",
        },
      ],
      { response, workspace }
    );

    expect(results.map((result) => result.passed)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  test("handles exact Git paths and standards-compliant JSON pointers", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
    await writeFile(
      join(workspace, "data.json"),
      '{"":"empty","object":{"b":1,"a":2}}\n'
    );
    await initializeFixtureGit(workspace);
    const unusualPath = "line\nbreak -> file.md";
    await writeFile(join(workspace, unusualPath), "changed\n");

    const results = await evaluateAssertions(
      [
        {
          expected: { allowed: [unusualPath], required: [unusualPath] },
          kind: "git.changedPaths",
        },
        {
          expected: "empty",
          kind: "json.path",
          target: "data.json#/",
        },
        {
          expected: { a: 2, b: 1 },
          kind: "json.path",
          target: "data.json#/object",
        },
        {
          expected: { "": "empty", object: { a: 2, b: 1 } },
          kind: "json.path",
          target: "data.json#object",
        },
      ],
      { response: completedResponse(), workspace }
    );

    expect(results.map((result) => result.passed)).toEqual([
      true,
      true,
      true,
      false,
    ]);
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

  test("deletes read-only adapter snapshots after forced termination", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    const snapshot = join(workspace, ".simple-changelogs-skill-stale");
    const nested = join(snapshot, "references");
    const skillFile = join(snapshot, "SKILL.md");
    await mkdir(nested, { recursive: true });
    await writeFile(skillFile, "# Read-only snapshot\n");
    await chmod(skillFile, 0o444);
    await chmod(nested, 0o555);
    await chmod(snapshot, 0o555);

    await cleanupFixtureWorkspace(workspace, {
      failed: true,
      keepFailures: false,
    });

    await expect(lstat(workspace)).rejects.toThrow();
  });

  test("retains failed workspaces only when requested", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    temporaryPaths.add(workspace);
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

  test("rejects prefixed impostors and symlink aliases without deleting targets", async () => {
    const fixturesRoot = await makeFixtureRoot();
    const workspace = await createFixtureWorkspace(fixturesRoot, "base");
    const impostor = await makeTemporaryDirectory("simple-changelogs-eval-");
    const alias = join(
      tmpdir(),
      `simple-changelogs-eval-alias-${randomUUID()}`
    );
    temporaryPaths.add(alias);
    await symlink(workspace, alias, "dir");

    await expect(
      cleanupFixtureWorkspace(impostor, {
        failed: false,
        keepFailures: false,
      })
    ).rejects.toThrow("Refusing");
    await expect(
      cleanupFixtureWorkspace(alias, {
        failed: false,
        keepFailures: false,
      })
    ).rejects.toThrow("Refusing");
    expect((await lstat(workspace)).isDirectory()).toBe(true);
    await cleanupFixtureWorkspace(workspace, {
      failed: false,
      keepFailures: false,
    });
  });
});
