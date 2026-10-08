import { afterEach, describe, expect, test } from "bun:test";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import { syncDistributions, syncedFiles } from "../../../sync-distros.ts";

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
  "tooling/simple-changelogs/scripts/query.ts",
  "tooling/simple-changelogs/scripts/lib/changelog-parse.ts",
  "tooling/simple-changelogs/evals/schemas/changelog-capabilities.schema.json",
  "tooling/simple-changelogs/evals/schemas/changelog-receipt.schema.json",
  "tooling/simple-changelogs/evals/schemas/changelog-request.schema.json",
  "tooling/simple-changelogs/evals/schemas/protocol-provenance.json",
  "tooling/sync-distros.ts",
];

const SETUP_COPY = `skills/${WEB}/scripts/setup.ts`;
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
    expect(report.inSync).toBe(52);
    expect(await read(root, SETUP_COPY)).toBe("// drifted\n");
    await expect(read(root, MISSING_COPY)).rejects.toThrow();
  });

  test("writes canonical bytes and is idempotent", async () => {
    const root = await repositoryCopy();
    await driftCopies(root);

    const first = await syncDistributions(root, { write: true });
    const second = await syncDistributions(root, { write: true });

    expect(first.drifted).toHaveLength(3);
    expect(second).toEqual({ drifted: [], inSync: 55 });
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

    await expect(syncDistributions(root, { write: true })).rejects.toThrow(
      `Refusing to write through the symlink ${scripts}`
    );
    expect(await readFile(join(outside, "setup.ts"), "utf8")).toBe(
      "// outside\n"
    );
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

  test("exits 1 on drift with --check, writes without it, and rejects other arguments", async () => {
    const root = await repositoryCopy();
    await driftCopies(root);

    const checked = await runCli(root, "--check");
    expect(checked.exitCode).toBe(1);
    expect(checked.stdout).toContain(
      `Out of sync: ${SETUP_COPY} (from tooling/simple-changelogs/scripts/setup.ts)`
    );
    expect(checked.stdout).toContain(
      "52 byte-synced files already matched; 3 drifted."
    );
    expect(await read(root, SETUP_COPY)).toBe("// drifted\n");

    const written = await runCli(root);
    expect(written.exitCode).toBe(0);
    expect(written.stdout).toContain(`Wrote: ${SETUP_COPY}`);

    const clean = await runCli(root, "--check");
    expect(clean).toMatchObject({
      exitCode: 0,
      stdout: "55 byte-synced files already matched; 0 drifted.\n",
    });

    const misuse = await runCli(root, "--write");
    expect(misuse.exitCode).toBe(2);
    expect(misuse.stderr).toContain("Usage: bun tooling/sync-distros.ts");
  });
});
