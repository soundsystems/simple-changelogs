import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import {
  applySetup,
  inspectRepository,
  resolveCommunicationPaths,
  type SetupResult,
  validateCommunication,
} from "../setup.ts";

// The communication style (references/communication.md): a display
// preference in a sidecar of its own. These checks cover its resolution
// across the personal, repository, and Simple Changes layers, and the
// standalone apply --communication transaction that can write nothing else.

const SETUP = join(import.meta.dir, "..", "setup.ts");
const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true }))
  );
});

const temporaryDirectory = async (label: string): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), `simple-changelogs-${label}-`));
  temporaryPaths.push(path);
  return path;
};

const sidecar = (style: string, extra: Record<string, unknown> = {}): string =>
  `${JSON.stringify({ schemaVersion: 1, style, ...extra }, null, 2)}\n`;

interface Fixture {
  config: string;
  paths: Awaited<ReturnType<typeof resolveCommunicationPaths>>;
  repo: string;
}

const fixture = async (): Promise<Fixture> => {
  const [config, repo] = await Promise.all([
    temporaryDirectory("config"),
    temporaryDirectory("repo"),
  ]);
  return {
    config,
    paths: await resolveCommunicationPaths(repo, config),
    repo,
  };
};

const git = async (cwd: string, ...args: string[]): Promise<void> => {
  const child = spawn({
    cmd: ["git", "-C", cwd, ...args],
    stderr: "pipe",
    stdout: "pipe",
  });
  if ((await child.exited) !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${await new Response(child.stderr).text()}`
    );
  }
};

const MARKER = ".simple-changelogs.setup-transaction.json";
// No process holds this ID, so a marker carrying it is an orphan.
const DEAD_PID = 2_147_483_646;

const inspect = (target: Fixture): Promise<SetupResult> =>
  inspectRepository({
    configDirectory: target.config,
    distribution: "web",
    environment: {},
    repo: target.repo,
    taskMode: "write",
  });

const writeAttempt = (target: Fixture): Promise<SetupResult> =>
  applySetup({
    communication: "ultra-simple",
    configDirectory: target.config,
    confirm: true,
    distribution: "web",
    environment: {},
    repo: target.repo,
    scope: "repository",
    taskMode: "write",
  });

const apply = (
  target: Fixture,
  options: Partial<Parameters<typeof applySetup>[0]>
): Promise<SetupResult> =>
  applySetup({
    configDirectory: target.config,
    distribution: "web",
    environment: {},
    repo: target.repo,
    taskMode: "write",
    ...options,
  });

describe("communication style resolution", () => {
  test("is standard when nothing is saved", async () => {
    const target = await fixture();
    expect((await inspect(target)).communication).toEqual({
      errors: [],
      path: null,
      source: "default",
      style: "standard",
    });
    expect(target.paths.repository).toBe(
      join(target.repo, ".simple-changelogs-communication.json")
    );
    expect(target.paths.companion).toBe(
      join(target.repo, ".simple-changes-communication.json")
    );
    expect(target.paths.personal).toBe(
      join(target.config, "communication.json")
    );
  });

  test("lets the person's own setting outrank the project's", async () => {
    const target = await fixture();
    await writeFile(target.paths.repository, sidecar("ultra-simple"));
    expect((await inspect(target)).communication).toEqual({
      errors: [],
      path: target.paths.repository,
      source: "repository",
      style: "ultra-simple",
    });
    await writeFile(target.paths.personal, sidecar("standard"));
    expect((await inspect(target)).communication).toEqual({
      errors: [],
      path: target.paths.personal,
      source: "personal",
      style: "standard",
    });
  });

  test("follows the Simple Changes setting only when this skill has none", async () => {
    const target = await fixture();
    await writeFile(target.paths.companion, sidecar("ultra-simple"));
    expect((await inspect(target)).communication).toEqual({
      errors: [],
      path: target.paths.companion,
      source: "companion",
      style: "ultra-simple",
    });
    await writeFile(target.paths.repository, sidecar("standard"));
    expect((await inspect(target)).communication).toMatchObject({
      path: target.paths.repository,
      source: "repository",
      style: "standard",
    });
  });

  test("reports and skips a sidecar it cannot use", async () => {
    const target = await fixture();
    for (const [text, reason] of [
      ["{ not json", "Could not parse"],
      ["[]", "must be a JSON object"],
      [sidecar("loud"), "style must be ultra-simple or standard"],
      [
        JSON.stringify({ schemaVersion: 2, style: "ultra-simple" }),
        "schemaVersion must be 1",
      ],
    ] as const) {
      // biome-ignore lint/performance/noAwaitInLoops: each case rewrites the same file, so they run in order.
      await writeFile(target.paths.repository, text);
      const { communication } = await inspect(target);
      expect(communication.style).toBe("standard");
      expect(communication.source).toBe("default");
      expect(communication.errors).toHaveLength(1);
      expect(communication.errors[0]).toContain(reason);
    }
    // A symbolic link is never followed, even to a valid file.
    const elsewhere = join(await temporaryDirectory("target"), "c.json");
    await writeFile(elsewhere, sidecar("ultra-simple"));
    await rm(target.paths.repository);
    await symlink(elsewhere, target.paths.repository);
    const linked = (await inspect(target)).communication;
    expect(linked.style).toBe("standard");
    expect(linked.errors[0]).toContain("Refusing symbolic-link state");
  });

  test("reports a broken project file even when a personal setting decides", async () => {
    const target = await fixture();
    await writeFile(target.paths.personal, sidecar("ultra-simple"));
    await writeFile(target.paths.repository, "{ not json");
    await writeFile(target.paths.companion, "[]");
    const { communication } = await inspect(target);
    expect(communication).toMatchObject({
      path: target.paths.personal,
      source: "personal",
      style: "ultra-simple",
    });
    expect(communication.errors).toHaveLength(2);
    expect(communication.errors[0]).toContain(target.paths.repository);
    expect(communication.errors[1]).toContain("must be a JSON object");
  });

  test("reads both project files from the primary checkout, as Simple Changes does", async () => {
    const config = await temporaryDirectory("config");
    const primary = await temporaryDirectory("primary");
    await git(primary, "init", "-q", "-b", "main");
    await git(
      primary,
      "-c",
      "user.name=Tests",
      "-c",
      "user.email=tests@example.invalid",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "Initial"
    );
    const linked = join(await temporaryDirectory("linked"), "tree");
    await git(primary, "worktree", "add", "-q", "-b", "feature", linked);
    // The settings were added after the worktree was created, and are not
    // committed: only the primary checkout holds them.
    await writeFile(
      join(primary, ".simple-changes-communication.json"),
      sidecar("ultra-simple")
    );
    const fromLinked = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      environment: {},
      repo: linked,
      taskMode: "read",
    });
    const paths = await resolveCommunicationPaths(linked, config);
    expect(paths.companion).toBe(
      join(await realpath(primary), ".simple-changes-communication.json")
    );
    expect(paths.repository).toBe(
      join(await realpath(primary), ".simple-changelogs-communication.json")
    );
    expect(fromLinked.communication).toMatchObject({
      path: paths.companion,
      source: "companion",
      style: "ultra-simple",
    });

    // A repository-scope write from the linked worktree lands there too.
    const applied = await applySetup({
      communication: "standard",
      configDirectory: config,
      confirm: true,
      distribution: "web",
      environment: {},
      repo: linked,
      scope: "repository",
      taskMode: "write",
    });
    expect(applied.writes).toEqual([
      { kind: "communication", path: paths.repository, written: true },
    ]);
    expect(applied.communication).toMatchObject({
      source: "repository",
      style: "standard",
    });
    expect(await readdir(linked)).toEqual([".git"]);
  });

  test("the capped file scan never counts a communication sidecar", async () => {
    const target = await fixture();
    await mkdir(join(target.repo, "notes"));
    // Exactly as many text files as the scan's cap allows.
    await Promise.all(
      Array.from({ length: 400 }, (_, index) =>
        writeFile(
          join(
            target.repo,
            "notes",
            `note-${String(index).padStart(3, "0")}.md`
          ),
          "A note.\n"
        )
      )
    );
    const before = await inspect(target);
    expect(before.inventory.scan).toMatchObject({
      filesInspected: 400,
      truncated: false,
    });
    await writeFile(target.paths.repository, sidecar("ultra-simple"));
    await writeFile(target.paths.companion, sidecar("ultra-simple"));
    const after = await inspect(target);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.unresolvedQuestions).toEqual(before.unresolvedQuestions);
  });

  test("ignores members a later release may add", () => {
    expect(
      validateCommunication(
        { later: true, schemaVersion: 1, style: "ultra-simple" },
        "sidecar"
      )
    ).toEqual({
      errors: [],
      value: { schemaVersion: 1, style: "ultra-simple" },
    });
  });
});

describe("apply --communication", () => {
  test("writes only the sidecar and changes nothing else the helper reports", async () => {
    const target = await fixture();
    const before = await inspect(target);
    const applied = await apply(target, {
      communication: "ultra-simple",
      confirm: true,
      scope: "repository",
    });
    expect(applied.status).not.toBe("blocked");
    expect(applied.writes).toEqual([
      {
        kind: "communication",
        path: target.paths.repository,
        written: true,
      },
    ]);
    expect(applied.summary).toContain("Ultra-Simple Mode is on");
    expect(await readFile(target.paths.repository, "utf8")).toBe(
      sidecar("ultra-simple")
    );
    // biome-ignore lint/suspicious/noBitwiseOperators: masks the permission bits of a file mode.
    expect((await stat(target.paths.repository)).mode & 0o777).toBe(0o644);
    // No policy, history, preference, or transaction marker appeared.
    expect(await readdir(target.repo)).toEqual([
      ".simple-changelogs-communication.json",
    ]);
    expect(await readdir(target.config)).toEqual([]);

    const after = await inspect(target);
    expect(after.communication).toEqual({
      errors: [],
      path: target.paths.repository,
      source: "repository",
      style: "ultra-simple",
    });
    // Everything except the style itself is what inspection said before:
    // the sidecar is no release-note destination, raises no question, and
    // is not even counted by the scan.
    const withoutStyle = ({ communication: _style, ...rest }: SetupResult) =>
      rest;
    expect(withoutStyle(after)).toEqual(withoutStyle(before));

    const again = await apply(target, {
      communication: "ultra-simple",
      confirm: true,
      scope: "repository",
    });
    expect(again.writes).toEqual([
      {
        kind: "communication",
        path: target.paths.repository,
        written: false,
      },
    ]);
  });

  test("saves a private personal setting for every project", async () => {
    const target = await fixture();
    const applied = await apply(target, {
      communication: "ultra-simple",
      confirm: true,
      scope: "all-projects",
    });
    expect(applied.writes).toEqual([
      { kind: "communication", path: target.paths.personal, written: true },
    ]);
    // biome-ignore lint/suspicious/noBitwiseOperators: masks the permission bits of a file mode.
    expect((await stat(target.paths.personal)).mode & 0o777).toBe(0o600);
    expect(await readdir(target.repo)).toEqual([]);
    expect(applied.communication).toMatchObject({
      source: "personal",
      style: "ultra-simple",
    });
  });

  test("refuses anything but one confirmed, saved style", async () => {
    const target = await fixture();
    const cases: [Partial<Parameters<typeof applySetup>[0]>, string][] = [
      [
        { communication: "loud", confirm: true, scope: "repository" },
        "--communication must be ultra-simple or standard",
      ],
      [
        { communication: "ultra-simple", scope: "repository" },
        "Confirmation is required",
      ],
      [
        { communication: "ultra-simple", confirm: true },
        "--scope repository or --scope all-projects",
      ],
      [
        { communication: "ultra-simple", confirm: true, scope: "run-only" },
        "--scope repository or --scope all-projects",
      ],
      [
        {
          communication: "ultra-simple",
          confirm: true,
          scope: "repository",
          signatures: "none",
        },
        "standalone transaction that changes no other setting",
      ],
      [
        {
          authoring: "{}",
          communication: "ultra-simple",
          confirm: true,
          scope: "repository",
        },
        "standalone transaction that changes no other setting",
      ],
    ];
    for (const [options, message] of cases) {
      // biome-ignore lint/performance/noAwaitInLoops: the cases share one repository, so they run in order.
      const refused = await apply(target, options);
      expect(refused.status).toBe("blocked");
      expect(refused.errors.join("\n")).toContain(message);
      expect(refused.writes).toEqual([]);
    }
    expect(await readdir(target.repo)).toEqual([]);
  });

  test("never replaces a file it cannot read or that is not a regular file", async () => {
    const target = await fixture();
    await writeFile(target.paths.repository, "{ not json");
    const malformed = await apply(target, {
      communication: "ultra-simple",
      confirm: true,
      scope: "repository",
    });
    expect(malformed.status).toBe("blocked");
    expect(malformed.errors.join("\n")).toContain("repair or remove it first");
    expect(await readFile(target.paths.repository, "utf8")).toBe("{ not json");

    const elsewhere = join(await temporaryDirectory("target"), "c.json");
    await writeFile(elsewhere, sidecar("standard"));
    await rm(target.paths.repository);
    await symlink(elsewhere, target.paths.repository);
    const linked = await apply(target, {
      communication: "ultra-simple",
      confirm: true,
      scope: "repository",
    });
    expect(linked.status).toBe("blocked");
    expect(await readFile(elsewhere, "utf8")).toBe(sidecar("standard"));
  });

  test("says what was saved and what still applies to this person", async () => {
    const target = await fixture();
    await writeFile(target.paths.personal, sidecar("standard"));
    const applied = await apply(target, {
      communication: "ultra-simple",
      confirm: true,
      scope: "repository",
    });
    expect(applied.writes).toEqual([
      { kind: "communication", path: target.paths.repository, written: true },
    ]);
    // The project's default was saved, and this person's own setting still
    // decides what they get: the summary and the report say both.
    expect(applied.communication).toMatchObject({
      path: target.paths.personal,
      source: "personal",
      style: "standard",
    });
    expect(applied.summary).toContain(
      "Ultra-Simple Mode is on for this project by default"
    );
    expect(applied.summary).toContain(
      `For you it stays off: ${target.paths.personal} outranks it.`
    );
    expect(applied.summary).not.toContain("Ultra-Simple Mode is on:");
  });

  test("never recovers or rolls back an interrupted setup", async () => {
    const target = await fixture();
    const marker = join(target.repo, MARKER);
    const changelog = join(target.repo, "CHANGELOG.md");
    const developer = join(target.repo, "DEVELOPER_CHANGELOG.md");
    // An ordinary setup died after renaming its targets: its marker says
    // the changelog did not exist before and what the developer history
    // held.
    await writeFile(changelog, "# Changelog\n");
    await writeFile(developer, "# Developer Changelog\n\nNewer.\n");
    const interrupted = `${JSON.stringify({
      pid: DEAD_PID,
      schemaVersion: 2,
      targets: {
        "CHANGELOG.md": null,
        "DEVELOPER_CHANGELOG.md": "# Developer Changelog\n\nOlder.\n",
      },
    })}\n`;
    await writeFile(marker, interrupted);

    const refused = await applySetup({
      communication: "ultra-simple",
      configDirectory: target.config,
      confirm: true,
      distribution: "web",
      environment: {},
      repo: target.repo,
      scope: "repository",
      taskMode: "write",
    });
    expect(refused.status).toBe("blocked");
    expect(refused.errors.join("\n")).toContain("never recovers one");
    expect(refused.writes).toEqual([]);
    // Nothing was rolled back, and the marker is still there for the
    // ordinary setup write that owns its recovery.
    expect(await readFile(changelog, "utf8")).toBe("# Changelog\n");
    expect(await readFile(developer, "utf8")).toBe(
      "# Developer Changelog\n\nNewer.\n"
    );
    expect(await readFile(marker, "utf8")).toBe(interrupted);
    expect((await readdir(target.repo)).sort()).toEqual([
      MARKER,
      "CHANGELOG.md",
      "DEVELOPER_CHANGELOG.md",
    ]);

    // A marker it cannot read is treated the same way.
    await writeFile(marker, "not a marker");
    const unreadable = await writeAttempt(target);
    expect(unreadable.status).toBe("blocked");
    expect(await readFile(marker, "utf8")).toBe("not a marker");
  });

  test("clears an orphaned marker that names nothing to roll back", async () => {
    const target = await fixture();
    const marker = join(target.repo, MARKER);
    await writeFile(
      marker,
      `${JSON.stringify({ pid: DEAD_PID, schemaVersion: 2, targets: {} })}\n`
    );
    const applied = await writeAttempt(target);
    expect(applied.writes).toEqual([
      { kind: "communication", path: target.paths.repository, written: true },
    ]);
    expect(await readdir(target.repo)).toEqual([
      ".simple-changelogs-communication.json",
    ]);
  });

  test("a read-only task writes nothing", async () => {
    const target = await fixture();
    const refused = await apply(target, {
      communication: "ultra-simple",
      confirm: true,
      scope: "repository",
      taskMode: "read",
    });
    expect(refused.status).toBe("blocked");
    expect(await readdir(target.repo)).toEqual([]);
  });

  test("the command line records and reports the style", async () => {
    const target = await fixture();
    await mkdir(join(target.repo, ".git"));
    const run = async (...args: string[]) => {
      const child = spawn({
        cmd: [process.execPath, SETUP, ...args, "--repo", target.repo],
        env: {
          ...process.env,
          SIMPLE_CHANGELOGS_CONFIG_DIR: target.config,
        },
        stderr: "pipe",
        stdout: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      return { exitCode, stderr, stdout };
    };
    const applied = await run(
      "apply",
      "--communication",
      "ultra-simple",
      "--scope",
      "repository",
      "--confirm"
    );
    expect(applied.stderr).toBe("");
    expect(applied.exitCode).toBe(0);
    expect(
      (JSON.parse(applied.stdout) as SetupResult).communication
    ).toMatchObject({ source: "repository", style: "ultra-simple" });
    const inspected = await run("inspect", "--task-mode", "read");
    expect(
      (JSON.parse(inspected.stdout) as SetupResult).communication
    ).toMatchObject({ source: "repository", style: "ultra-simple" });
    const refused = await run(
      "apply",
      "--communication",
      "ultra-simple",
      "--scope",
      "repository",
      "--confirm",
      "--signatures",
      "none"
    );
    expect(refused.exitCode).toBe(1);
    expect(refused.stdout).toContain(
      "standalone transaction that changes no other setting"
    );
  });
});
