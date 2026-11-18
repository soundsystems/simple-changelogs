import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
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
  paths: ReturnType<typeof resolveCommunicationPaths>;
  repo: string;
}

const fixture = async (): Promise<Fixture> => {
  const [config, repo] = await Promise.all([
    temporaryDirectory("config"),
    temporaryDirectory("repo"),
  ]);
  return { config, paths: resolveCommunicationPaths(repo, config), repo };
};

const inspect = (target: Fixture): Promise<SetupResult> =>
  inspectRepository({
    configDirectory: target.config,
    distribution: "web",
    environment: {},
    repo: target.repo,
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
    // the sidecar is no release-note destination and raises no question. The
    // scan counts one more file, the sidecar it now walks past.
    const withoutStyle = ({ communication: _style, ...rest }: SetupResult) => ({
      ...rest,
      inventory: {
        ...rest.inventory,
        scan: { ...rest.inventory.scan, filesInspected: 0 },
      },
    });
    expect(after.inventory.scan.filesInspected).toBe(1);
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
