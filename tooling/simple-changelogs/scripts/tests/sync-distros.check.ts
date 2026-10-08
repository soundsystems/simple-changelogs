import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, renameSync, rmSync, symlinkSync } from "node:fs";
import {
  cp,
  link,
  lstat,
  mkdir,
  mkdtemp,
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
  type SyncedFile,
  type SyncReport,
  syncDistributions,
  syncedFiles,
  type WriteProbe,
  type WriteStep,
  writeHeldCopy,
} from "../../../sync-distros.ts";

const REPOSITORY_ROOT = join(import.meta.dir, "..", "..", "..", "..");
const temporaryDirectories: string[] = [];
const sorted = (values: string[]): string[] =>
  values.toSorted((left, right) => left.localeCompare(right));

const FULL = "simple-changelogs";
const CMS = "simple-changelogs-cms";
const MOBILE = "simple-changelogs-mobile";
const SKILL_MAINTAINER = "simple-changelogs-skill-maintainer";
const WEB = "simple-changelogs-web";
const WEB_CMS = "simple-changelogs-web-cms";
const EVERY_CHANGELOG = [FULL, CMS, MOBILE, SKILL_MAINTAINER, WEB, WEB_CMS];
const PORTABLE = [FULL, MOBILE, SKILL_MAINTAINER, WEB, WEB_CMS];

// The exact installed copies distributions.check.ts requires to match a
// canonical source byte for byte, keyed by that source.
const EXPECTED_TABLE: Record<string, string[]> = {
  "skills/simple-changelogs-cms/schemas/cms-changelog.schema.json": [
    `skills/${WEB_CMS}/schemas/cms-changelog.schema.json`,
  ],
  "skills/simple-changelogs-cms/schemas/repo-policy.schema.json": [
    `skills/${WEB_CMS}/schemas/repo-policy.schema.json`,
  ],
  "skills/simple-changelogs-cms/scripts/lib/schema.ts": [
    `skills/${WEB_CMS}/scripts/lib/cms-schema.ts`,
  ],
  "skills/simple-changelogs/references/release-handoff.md": [
    MOBILE,
    SKILL_MAINTAINER,
    WEB,
    WEB_CMS,
  ].map((name) => `skills/${name}/references/release-handoff.md`),
  "skills/simple-changelogs/references/testing-notes.md": [
    `skills/${MOBILE}/references/testing-notes.md`,
  ],
  "skills/simple-changelogs/references/version-decisions.md": [
    MOBILE,
    WEB,
    WEB_CMS,
  ].map((name) => `skills/${name}/references/version-decisions.md`),
  "skills/simple-changelogs/scripts/check-fork-sync.sh": [
    MOBILE,
    SKILL_MAINTAINER,
    WEB,
    WEB_CMS,
  ].map((name) => `skills/${name}/scripts/check-fork-sync.sh`),
  "tooling/simple-changelogs/scripts/lib/changelog-parse.ts": PORTABLE.map(
    (name) => `skills/${name}/scripts/lib/changelog-parse.ts`
  ),
  "tooling/simple-changelogs/scripts/query.ts": PORTABLE.map(
    (name) => `skills/${name}/scripts/query.ts`
  ),
  "tooling/simple-changelogs/scripts/setup.ts": EVERY_CHANGELOG.map(
    (name) => `skills/${name}/scripts/setup.ts`
  ),
  "tooling/simple-changelogs/scripts/handoff.ts": EVERY_CHANGELOG.map(
    (name) => `skills/${name}/scripts/handoff.ts`
  ),
  ...Object.fromEntries(
    [
      "changelog-capabilities.schema.json",
      "changelog-receipt.schema.json",
      "changelog-request.schema.json",
      "protocol-provenance.json",
    ].map((filename) => [
      `tooling/simple-changelogs/evals/schemas/${filename}`,
      EVERY_CHANGELOG.map((name) => `skills/${name}/schemas/${filename}`),
    ])
  ),
};

const CANONICAL_TOOLING_FILES = [
  "tooling/simple-changelogs/scripts/setup.ts",
  "tooling/simple-changelogs/scripts/handoff.ts",
  "tooling/simple-changelogs/scripts/query.ts",
  "tooling/simple-changelogs/scripts/lib/changelog-parse.ts",
  "tooling/simple-changelogs/evals/schemas/changelog-capabilities.schema.json",
  "tooling/simple-changelogs/evals/schemas/changelog-receipt.schema.json",
  "tooling/simple-changelogs/evals/schemas/changelog-request.schema.json",
  "tooling/simple-changelogs/evals/schemas/protocol-provenance.json",
  "tooling/sync-distros.ts",
  "tooling/sync-distros-writer.ts",
];

const SCRIPTS = `skills/${WEB}/scripts`;
const SETUP_COPY = `${SCRIPTS}/setup.ts`;
const PROTOCOL_COPY = `skills/${CMS}/schemas/changelog-request.schema.json`;
const MISSING_COPY = `skills/${WEB_CMS}/scripts/lib/cms-schema.ts`;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

const repositoryCopy = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "sync-distros-"));
  temporaryDirectories.push(root);
  await cp(join(REPOSITORY_ROOT, "skills"), join(root, "skills"), {
    recursive: true,
  });
  await Promise.all(
    CANONICAL_TOOLING_FILES.map(async (path) => {
      await mkdir(join(root, path, ".."), { recursive: true });
      await cp(join(REPOSITORY_ROOT, path), join(root, path));
    })
  );
  return root;
};

const read = (root: string, path: string): Promise<string> =>
  readFile(join(root, path), "utf8");

// A directory outside every repository copy, removed with them.
const outsideDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "sync-distros-outside-"));
  temporaryDirectories.push(directory);
  return directory;
};

const setupCopy = async (root: string): Promise<SyncedFile> => {
  const files = await syncedFiles(root);
  return files.find(({ target }) => target === SETUP_COPY) as SyncedFile;
};

// Moves the real directory at `path` to `aside` and leaves a symlink to
// `outside` in its place, as an attacker racing the writer would.
const swapDirectoryForLink = (
  path: string,
  aside: string,
  outside: string
): void => {
  renameSync(path, aside);
  symlinkSync(outside, path);
};

// Runs the held walk in this process, as the writer process does, and comes
// back to the directory this test runs in afterwards, wherever the walk
// stopped.
const walk = (root: string, file: SyncedFile, probe?: WriteProbe): void => {
  const origin = process.cwd();
  try {
    writeHeldCopy(root, file, probe);
  } finally {
    process.chdir(origin);
  }
};

// Drifts a plain copy, replaces a minified schema with its readable source,
// and deletes a copy outright.
const driftCopies = async (root: string): Promise<void> => {
  await writeFile(join(root, SETUP_COPY), "// drifted\n");
  await writeFile(
    join(root, PROTOCOL_COPY),
    await read(
      root,
      "tooling/simple-changelogs/evals/schemas/changelog-request.schema.json"
    )
  );
  await rm(join(root, MISSING_COPY));
};

const runCli = async (
  root: string,
  ...args: string[]
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  const subprocess = spawn({
    cmd: [process.execPath, join(root, "tooling", "sync-distros.ts"), ...args],
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
  ]);
  return { exitCode, stderr, stdout };
};

describe("sync-distros", () => {
  test("lists exactly the byte-synced copies the distribution check enforces", async () => {
    const files = await syncedFiles(REPOSITORY_ROOT);
    const table: Record<string, string[]> = {};
    for (const { source, target } of files) {
      table[source] = sorted([...(table[source] ?? []), target]);
    }

    expect(table).toEqual(
      Object.fromEntries(
        Object.entries(EXPECTED_TABLE).map(([source, targets]) => [
          source,
          sorted(targets),
        ])
      )
    );
    expect(new Set(files.map(({ target }) => target)).size).toBe(files.length);
  });

  test("ships protocol schemas minified and every other copy verbatim", async () => {
    const files = await syncedFiles(REPOSITORY_ROOT);
    const canonicals = await Promise.all(
      files.map(({ source }) => read(REPOSITORY_ROOT, source))
    );
    for (const [index, { expected, source }] of files.entries()) {
      const canonical = canonicals[index] ?? "";
      expect(expected).toBe(
        source.startsWith("tooling/simple-changelogs/evals/schemas/")
          ? `${JSON.stringify(JSON.parse(canonical))}\n`
          : canonical
      );
    }
  });

  test("the repository is in sync", async () => {
    expect(
      (await syncDistributions(REPOSITORY_ROOT, { write: false })).drifted
    ).toEqual([]);
  });

  test("reports drift without writing in check mode", async () => {
    const root = await repositoryCopy();
    await driftCopies(root);

    const report = await syncDistributions(root, { write: false });

    expect(sorted(report.drifted.map(({ target }) => target))).toEqual(
      sorted([MISSING_COPY, PROTOCOL_COPY, SETUP_COPY])
    );
    expect(report.inSync).toBe(58);
    expect(await read(root, SETUP_COPY)).toBe("// drifted\n");
    await expect(read(root, MISSING_COPY)).rejects.toThrow();
  });

  test("writes canonical bytes and is idempotent", async () => {
    const root = await repositoryCopy();
    await driftCopies(root);

    const first = await syncDistributions(root, { write: true });
    const second = await syncDistributions(root, { write: true });

    expect(first.drifted).toHaveLength(3);
    expect(second).toEqual({ drifted: [], inSync: 61 });
    expect(await read(root, SETUP_COPY)).toBe(
      await read(REPOSITORY_ROOT, SETUP_COPY)
    );
    expect(await read(root, PROTOCOL_COPY)).toBe(
      await read(REPOSITORY_ROOT, PROTOCOL_COPY)
    );
    expect(await read(root, MISSING_COPY)).toBe(
      await read(root, `skills/${CMS}/scripts/lib/schema.ts`)
    );
  });

  test("restores a deleted fork checker as an executable copy", async () => {
    const root = await repositoryCopy();
    const checker = `skills/${WEB}/scripts/check-fork-sync.sh`;
    await rm(join(root, checker));

    const checked = await syncDistributions(root, { write: false });
    expect(checked.drifted.map(({ target }) => target)).toEqual([checker]);
    expect(checked.inSync).toBe(60);

    // A restrictive umask must not strip the restored checker's permissions.
    const umask = process.umask(0o077);
    try {
      await syncDistributions(root, { write: true });
    } finally {
      process.umask(umask);
    }
    expect(await read(root, checker)).toBe(
      await read(
        REPOSITORY_ROOT,
        "skills/simple-changelogs/scripts/check-fork-sync.sh"
      )
    );
    expect((await stat(join(root, checker))).mode % 0o1000).toBe(
      (await stat(join(REPOSITORY_ROOT, checker))).mode % 0o1000
    );
  });

  test("copies canonical bytes exactly and refuses sources that are not UTF-8", async () => {
    const root = await repositoryCopy();
    const source = "tooling/simple-changelogs/scripts/setup.ts";
    const canonical = Buffer.concat([
      Buffer.from("\uFEFF", "utf8"),
      await readFile(join(root, source)),
      Buffer.from("// \uFFFD\n", "utf8"),
    ]);
    await writeFile(join(root, source), canonical);

    await syncDistributions(root, { write: true });
    expect((await readFile(join(root, SETUP_COPY))).equals(canonical)).toBe(
      true
    );

    // Decoded as text, a stray 0x80 reads as the U+FFFD the source holds, so
    // only a byte comparison sees this copy drift.
    const strayByte = Buffer.concat([
      canonical.subarray(0, canonical.length - 4),
      Buffer.from([0x80, 0x0a]),
    ]);
    await writeFile(join(root, SETUP_COPY), strayByte);
    expect(
      (await syncDistributions(root, { write: false })).drifted.map(
        ({ target }) => target
      )
    ).toEqual([SETUP_COPY]);

    await writeFile(
      join(root, source),
      Buffer.concat([canonical, Buffer.from([0x80, 0x0a])])
    );
    await expect(syncDistributions(root, { write: true })).rejects.toThrow(
      `${source} is not valid UTF-8`
    );
    expect((await readFile(join(root, SETUP_COPY))).equals(strayByte)).toBe(
      true
    );
  });

  test("writes nothing when a canonical source is malformed", async () => {
    const root = await repositoryCopy();
    await driftCopies(root);
    await writeFile(
      join(
        root,
        "tooling/simple-changelogs/evals/schemas/protocol-provenance.json"
      ),
      "{\n"
    );

    await expect(syncDistributions(root, { write: true })).rejects.toThrow();
    expect(await read(root, SETUP_COPY)).toBe("// drifted\n");
    await expect(read(root, MISSING_COPY)).rejects.toThrow();
  });

  test("refuses to write through a symlinked directory above a copy", async () => {
    const root = await repositoryCopy();
    const scripts = `skills/${WEB}/scripts`;
    const outside = join(root, "outside-scripts");
    await cp(join(root, scripts), outside, { recursive: true });
    await rm(join(root, scripts), { recursive: true });
    await symlink(outside, join(root, scripts));
    await writeFile(join(outside, "setup.ts"), "// outside\n");

    await writeFile(join(root, PROTOCOL_COPY), "{}\n");

    await expect(syncDistributions(root, { write: false })).rejects.toThrow(
      `Refusing to write through the symlink ${scripts}`
    );
    await expect(syncDistributions(root, { write: true })).rejects.toThrow(
      `Refusing to write through the symlink ${scripts}`
    );
    expect(await readFile(join(outside, "setup.ts"), "utf8")).toBe(
      "// outside\n"
    );
    expect(await read(root, PROTOCOL_COPY)).toBe("{}\n");
  });

  test("writes only the file the checked path names, even if a symlink appears later", async () => {
    const root = await repositoryCopy();
    const setup = await setupCopy(root);

    // A longer copy is truncated to exactly the canonical bytes.
    await writeFile(join(root, SETUP_COPY), `${setup.expected}// stale tail\n`);
    walk(root, setup);
    expect(await read(root, SETUP_COPY)).toBe(setup.expected);

    // Called directly, the writer meets the symlinks the drift check would
    // have refused, as if they were swapped in after it ran.
    const outsideFile = join(root, "outside.ts");
    await writeFile(outsideFile, "// outside\n");
    await rm(join(root, SETUP_COPY));
    await symlink(outsideFile, join(root, SETUP_COPY));
    expect(() => walk(root, setup)).toThrow(
      `Refusing to write through the symlink ${SETUP_COPY}`
    );
    const missingOutside = join(root, "outside-new.ts");
    await rm(join(root, SETUP_COPY));
    await symlink(missingOutside, join(root, SETUP_COPY));
    expect(() => walk(root, setup)).toThrow(
      `Refusing to write through the symlink ${SETUP_COPY}`
    );
    expect(existsSync(missingOutside)).toBe(false);

    const outsideScripts = join(root, "outside-scripts");
    await mkdir(outsideScripts);
    await writeFile(join(outsideScripts, "setup.ts"), "// outside\n");
    await rm(join(root, SCRIPTS), { force: true, recursive: true });
    await symlink(outsideScripts, join(root, SCRIPTS));
    expect(() => walk(root, setup)).toThrow(
      `Refusing to write through the symlink ${SCRIPTS}`
    );

    expect(await readFile(outsideFile, "utf8")).toBe("// outside\n");
    expect(await readFile(join(outsideScripts, "setup.ts"), "utf8")).toBe(
      "// outside\n"
    );
  });

  test("refuses a directory swapped for a symlink between its check and the step into it", async () => {
    const root = await repositoryCopy();
    const outside = await outsideDirectory();
    await writeFile(join(outside, "setup.ts"), "// outside\n");
    await writeFile(join(root, SETUP_COPY), "// drifted\n");
    const setup = await setupCopy(root);
    const aside = join(root, `${SCRIPTS}-aside`);
    const steps: WriteStep[] = [];

    // The real directory passed its check; it is replaced by a symlink to
    // the outside directory before the writer steps into it.
    expect(() =>
      walk(root, setup, (step) => {
        steps.push(step);
        if (step.kind === "enter" && step.path === SCRIPTS) {
          swapDirectoryForLink(join(root, SCRIPTS), aside, outside);
        }
      })
    ).toThrow(
      `Refusing to write through ${SCRIPTS}, which changed after it was checked`
    );

    expect(await readFile(join(outside, "setup.ts"), "utf8")).toBe(
      "// outside\n"
    );
    expect(await readFile(join(aside, "setup.ts"), "utf8")).toBe(
      "// drifted\n"
    );
    expect(steps).toEqual([
      { kind: "enter", path: "skills" },
      { kind: "enter", path: `skills/${WEB}` },
      { kind: "enter", path: SCRIPTS },
    ]);
  });

  test("refuses a directory swapped for a symlink to a sibling between its check and the step into it", async () => {
    const root = await repositoryCopy();
    await writeFile(join(root, SETUP_COPY), "// drifted\n");
    const setup = await setupCopy(root);
    const sibling = join(root, `skills/${WEB}/references`);
    const aside = join(root, `${SCRIPTS}-aside`);

    // A direct child of the held parent, so only the inode gives the swap
    // away.
    expect(() =>
      walk(root, setup, (step) => {
        if (step.kind === "enter" && step.path === SCRIPTS) {
          swapDirectoryForLink(join(root, SCRIPTS), aside, sibling);
        }
      })
    ).toThrow(
      `Refusing to write through ${SCRIPTS}, which changed after it was checked`
    );

    expect(existsSync(join(sibling, "setup.ts"))).toBe(false);
    expect(await readFile(join(aside, "setup.ts"), "utf8")).toBe(
      "// drifted\n"
    );
  });

  test("refuses the checked directory moved outside and linked back at its name before the step", async () => {
    const root = await repositoryCopy();
    const outside = await outsideDirectory();
    await writeFile(join(root, SETUP_COPY), "// drifted\n");
    const setup = await setupCopy(root);
    const moved = join(outside, "moved-scripts");

    // The same inode the check saw, so only its parent gives the move away:
    // the link leads into a directory no longer under the one the writer
    // holds.
    expect(() =>
      walk(root, setup, (step) => {
        if (step.kind === "enter" && step.path === SCRIPTS) {
          swapDirectoryForLink(join(root, SCRIPTS), moved, moved);
        }
      })
    ).toThrow(
      `Refusing to write through ${SCRIPTS}, which changed after it was checked`
    );

    expect(await readFile(join(moved, "setup.ts"), "utf8")).toBe(
      "// drifted\n"
    );
  });

  test("writes into the checked directory renamed within the directory it holds", async () => {
    const root = await repositoryCopy();
    await writeFile(join(root, SETUP_COPY), "// drifted\n");
    const setup = await setupCopy(root);
    const aside = join(root, `${SCRIPTS}-aside`);

    // Still the checked inode and still a direct child of the held parent,
    // so the bytes reach it under its new name, inside the repository.
    walk(root, setup, (step) => {
      if (step.kind === "enter" && step.path === SCRIPTS) {
        swapDirectoryForLink(join(root, SCRIPTS), aside, aside);
      }
    });

    expect(await readFile(join(aside, "setup.ts"), "utf8")).toBe(
      setup.expected
    );
  });

  test("writes into the directory it holds when that directory is swapped after the step into it", async () => {
    const root = await repositoryCopy();
    const outside = await outsideDirectory();
    await writeFile(join(outside, "setup.ts"), "// outside\n");
    await writeFile(join(root, SETUP_COPY), "// drifted\n");
    const setup = await setupCopy(root);
    const aside = join(root, `${SCRIPTS}-aside`);

    // The writer already holds the real directory, so the symlink planted
    // at its path redirects nothing: the bytes reach the moved directory,
    // never the outside one.
    walk(root, setup, (step) => {
      if (step.kind === "open") {
        swapDirectoryForLink(join(root, SCRIPTS), aside, outside);
      }
    });

    expect(await readFile(join(aside, "setup.ts"), "utf8")).toBe(
      setup.expected
    );
    expect(await readFile(join(outside, "setup.ts"), "utf8")).toBe(
      "// outside\n"
    );
    expect((await lstat(join(root, SCRIPTS))).isSymbolicLink()).toBe(true);
  });

  test("refuses a copy swapped for a symlink between its check and the open", async () => {
    const root = await repositoryCopy();
    const outside = await outsideDirectory();
    const outsideFile = join(outside, "setup.ts");
    await writeFile(outsideFile, "// outside\n");
    const setup = await setupCopy(root);
    const swapCopyForLink = (target: string) => (step: WriteStep) => {
      if (step.kind === "open") {
        rmSync(join(root, SETUP_COPY));
        symlinkSync(target, join(root, SETUP_COPY));
      }
    };

    await writeFile(join(root, SETUP_COPY), "// drifted\n");
    expect(() => walk(root, setup, swapCopyForLink(outsideFile))).toThrow(
      `Refusing to write through the symlink ${SETUP_COPY}`
    );
    expect(await readFile(outsideFile, "utf8")).toBe("// outside\n");

    const missingOutside = join(outside, "missing.ts");
    await rm(join(root, SETUP_COPY));
    await writeFile(join(root, SETUP_COPY), "// drifted\n");
    expect(() => walk(root, setup, swapCopyForLink(missingOutside))).toThrow(
      `Refusing to write through the symlink ${SETUP_COPY}`
    );
    expect(existsSync(missingOutside)).toBe(false);
  });

  test("refuses a copy with a second link", async () => {
    const root = await repositoryCopy();
    const outside = await outsideDirectory();
    const outsideFile = join(outside, "setup.ts");
    await writeFile(outsideFile, "// outside\n");
    await rm(join(root, SETUP_COPY));
    await link(outsideFile, join(root, SETUP_COPY));
    const setup = await setupCopy(root);

    expect(() => walk(root, setup)).toThrow(
      `Refusing to write ${SETUP_COPY}, which has 2 links`
    );
    await expect(syncDistributions(root, { write: true })).rejects.toThrow(
      `Refusing to write ${SETUP_COPY}, which has 2 links`
    );
    expect(await readFile(outsideFile, "utf8")).toBe("// outside\n");
  });

  test("refuses a copy that is not a regular file and a directory that is not one", async () => {
    const root = await repositoryCopy();
    const setup = await setupCopy(root);

    await rm(join(root, SETUP_COPY));
    await mkdir(join(root, SETUP_COPY));
    expect(() => walk(root, setup)).toThrow(
      `Refusing to write ${SETUP_COPY}, which is not a regular file`
    );
    expect((await lstat(join(root, SETUP_COPY))).isDirectory()).toBe(true);

    await rm(join(root, SCRIPTS), { recursive: true });
    await writeFile(join(root, SCRIPTS), "// not a directory\n");
    expect(() => walk(root, setup)).toThrow(
      `Refusing to write through ${SCRIPTS}, which is not a directory`
    );
    expect(await read(root, SCRIPTS)).toBe("// not a directory\n");

    expect(() => walk(root, { ...setup, target: "../outside.ts" })).toThrow(
      "Refusing to write ../outside.ts, which is not a plain path below the repository root"
    );
    expect(existsSync(join(root, "..", "outside.ts"))).toBe(false);
  });

  test("creates missing directories below the repository root", async () => {
    const root = await repositoryCopy();
    const lib = `${SCRIPTS}/lib`;
    const parse = `${lib}/changelog-parse.ts`;
    await rm(join(root, lib), { recursive: true });

    const report = await syncDistributions(root, { write: true });

    expect(report.drifted.map(({ target }) => target)).toEqual([parse]);
    expect((await lstat(join(root, lib))).isDirectory()).toBe(true);
    expect(await read(root, parse)).toBe(await read(REPOSITORY_ROOT, parse));
  });

  test("refuses to write through a symlinked copy", async () => {
    const root = await repositoryCopy();
    const outside = join(root, "outside.ts");
    await writeFile(outside, "// outside\n");
    await rm(join(root, SETUP_COPY));
    await symlink(outside, join(root, SETUP_COPY));

    await expect(syncDistributions(root, { write: true })).rejects.toThrow(
      `Refusing to write through the symlink ${SETUP_COPY}`
    );
    expect(await read(root, "outside.ts")).toBe("// outside\n");
  });

  test("writes through the writer process and never moves this process's working directory", async () => {
    const root = await repositoryCopy();
    await driftCopies(root);
    const origin = process.cwd();

    // Only the writer process may call chdir; a walk run here and then
    // restored would leave the final directory intact but still move it.
    const chdir = spyOn(process, "chdir");
    let report: SyncReport;
    let moves = -1;
    try {
      report = await syncDistributions(root, { write: true });
    } finally {
      // Read before the restore, which also clears the recorded calls.
      moves = chdir.mock.calls.length;
      chdir.mockRestore();
    }

    expect(moves).toBe(0);
    expect(report.drifted).toHaveLength(3);
    expect(process.cwd()).toBe(origin);
    expect(await read(root, SETUP_COPY)).toBe(
      await read(REPOSITORY_ROOT, SETUP_COPY)
    );
    expect(await read(root, MISSING_COPY)).toBe(
      await read(root, `skills/${CMS}/scripts/lib/schema.ts`)
    );
  });

  test("the writer process stops at the first refusal and writes nothing after it", async () => {
    const root = await repositoryCopy();
    const files = await syncedFiles(root);
    const setup = files.find(
      ({ target }) => target === SETUP_COPY
    ) as SyncedFile;
    const protocol = files.find(
      ({ target }) => target === PROTOCOL_COPY
    ) as SyncedFile;
    const runWriter = async (
      payload: unknown,
      cwd?: string
    ): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
      const subprocess = spawn({
        cmd: [
          process.execPath,
          join(REPOSITORY_ROOT, "tooling", "sync-distros-writer.ts"),
        ],
        cwd,
        stderr: "pipe",
        stdin: Buffer.from(JSON.stringify(payload)),
        stdout: "pipe",
      });
      const [exitCode, stdout, stderr] = await Promise.all([
        subprocess.exited,
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
      ]);
      return { exitCode, stderr, stdout };
    };

    // The first copy's directory is a symlink; the second is drifted and
    // must stay so.
    const outsideScripts = join(root, "outside-scripts");
    await cp(join(root, SCRIPTS), outsideScripts, { recursive: true });
    await rm(join(root, SCRIPTS), { recursive: true });
    await symlink(outsideScripts, join(root, SCRIPTS));
    await writeFile(join(outsideScripts, "setup.ts"), "// outside\n");
    await writeFile(join(root, PROTOCOL_COPY), "{}\n");

    const refused = await runWriter({ files: [setup, protocol], root });
    expect(refused).toEqual({
      exitCode: 1,
      stderr: `Refusing to write through the symlink ${SCRIPTS}\n`,
      stdout: "",
    });
    expect(await readFile(join(outsideScripts, "setup.ts"), "utf8")).toBe(
      "// outside\n"
    );
    expect(await read(root, PROTOCOL_COPY)).toBe("{}\n");

    // Only the payload the parent sends is accepted: an absolute root and
    // whole copies.
    const relative = await runWriter({ files: [protocol], root: "." }, root);
    expect(relative).toEqual({
      exitCode: 1,
      stderr: "The sync writer needs an absolute repository root\n",
      stdout: "",
    });
    const partial = await runWriter({
      files: [{ target: PROTOCOL_COPY }],
      root,
    });
    expect(partial).toEqual({
      exitCode: 1,
      stderr: "The sync writer needs a list of copies to write\n",
      stdout: "",
    });
    expect(await read(root, PROTOCOL_COPY)).toBe("{}\n");

    const written = await runWriter({ files: [protocol], root });
    expect(written).toEqual({ exitCode: 0, stderr: "", stdout: "" });
    expect(await read(root, PROTOCOL_COPY)).toBe(
      await read(REPOSITORY_ROOT, PROTOCOL_COPY)
    );
  });

  test("exits 1 on drift with --check, writes without it, and rejects other arguments", async () => {
    const root = await repositoryCopy();
    await driftCopies(root);

    const checked = await runCli(root, "--check");
    expect(checked.exitCode).toBe(1);
    expect(checked.stdout).toContain(
      `Out of sync: ${SETUP_COPY} (from tooling/simple-changelogs/scripts/setup.ts)`
    );
    expect(checked.stdout).toContain(
      "58 byte-synced files already matched; 3 drifted."
    );
    expect(await read(root, SETUP_COPY)).toBe("// drifted\n");

    const written = await runCli(root);
    expect(written.exitCode).toBe(0);
    expect(written.stdout).toContain(`Wrote: ${SETUP_COPY}`);

    const clean = await runCli(root, "--check");
    expect(clean).toMatchObject({
      exitCode: 0,
      stdout: "61 byte-synced files already matched; 0 drifted.\n",
    });

    const misuse = await runCli(root, "--write");
    expect(misuse.exitCode).toBe(2);
    expect(misuse.stderr).toContain("Usage: bun tooling/sync-distros.ts");
  });
});
