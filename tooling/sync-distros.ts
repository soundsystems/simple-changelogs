#!/usr/bin/env bun

import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  type Stats,
  statSync,
  writeSync,
} from "node:fs";
import { lstat, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "bun";

// Every changelog distribution ships the byte-synced setup helper.
export const changelogDistributions = new Set([
  "simple-changelogs",
  "simple-changelogs-cms",
  "simple-changelogs-mobile",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
  "simple-changelogs-skill-maintainer",
]);
export const portableContractDistributions = new Set([
  "simple-changelogs",
  "simple-changelogs-mobile",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
  "simple-changelogs-skill-maintainer",
]);
// Distributions that take the Simple Changes release handoff: they vendor the
// pinned protocol schemas, route delegated requests, and advertise request and
// receipt versions in their marker. The CMS-only distribution takes an
// entry-only handoff for its version-less operator history, so it ships the
// schemas and its own release-handoff reference without the Markdown query
// helpers or the shared public-release copy.
export const releaseHandoffDistributions = new Set([
  ...portableContractDistributions,
  "simple-changelogs-cms",
]);
// Product distributions share one version-decisions reference.
export const productVersionDistributions = [
  "simple-changelogs",
  "simple-changelogs-mobile",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
];
export const PROTOCOL_FILES = [
  "changelog-request.schema.json",
  "changelog-receipt.schema.json",
  "changelog-capabilities.schema.json",
  "protocol-provenance.json",
] as const;
const QUERY_FILES = ["query.ts", "lib/changelog-parse.ts"] as const;
const FULL = "simple-changelogs";
const CMS = "simple-changelogs-cms";
const WEB_CMS = "simple-changelogs-web-cms";
const FORK_CHECKER = "scripts/check-fork-sync.sh";
const HARNESS_DATA = "agents/harnesses.json";
const AUTHORING_SCHEMAS = [
  "schemas/authoring.schema.json",
  "schemas/harnesses.schema.json",
] as const;
const TOOLING_SCRIPTS = "tooling/simple-changelogs/scripts";
const TOOLING_SCHEMAS = "tooling/simple-changelogs/evals/schemas";

// The readable canonical protocol files live in tooling; every distribution
// ships them minified, exactly JSON.stringify(JSON.parse(text)) plus a
// newline, the bytes Simple Changes ships for the same schemas.
export const minifiedJson = (text: string): string =>
  `${JSON.stringify(JSON.parse(text))}\n`;

// Copies are compared and written as text, which reproduces a source's bytes
// only when they are valid UTF-8, so anything else fails before a write. A
// leading byte order mark is kept, not dropped.
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// True when `contents` are exactly the UTF-8 bytes of `expected`.
export const holdsBytes = (contents: Uint8Array, expected: string): boolean =>
  Buffer.from(expected, "utf8").equals(contents);

export interface SyncedFile {
  expected: string;
  // The source's permission bits, which a written copy takes.
  mode: number;
  // Repository-relative paths.
  source: string;
  target: string;
}

interface SyncRule {
  minify?: boolean;
  source: string;
  target: string;
}

const skillPath = (distribution: string, path: string): string =>
  `skills/${distribution}/${path}`;

const copies = (
  source: string,
  distributions: Iterable<string>,
  path: string
): SyncRule[] =>
  [...distributions]
    .map((distribution) => ({ source, target: skillPath(distribution, path) }))
    .filter((rule) => rule.target !== source);

// Every installed file that distributions.check.ts requires to hold exactly
// its canonical source's bytes. The portable contract requires the fork
// checker in every portable distribution, so that set is declared, not read
// from disk, and a deleted copy still counts as drift. fork-maintenance.md
// copies legitimately differ by their own distribution name, so they stay
// hand-edited and are compared modulo that name instead.
const syncRules = (): SyncRule[] => [
  ...copies(
    `${TOOLING_SCRIPTS}/setup.ts`,
    changelogDistributions,
    "scripts/setup.ts"
  ),
  ...PROTOCOL_FILES.flatMap((filename) =>
    copies(
      `${TOOLING_SCHEMAS}/${filename}`,
      releaseHandoffDistributions,
      `schemas/${filename}`
    ).map((rule) => ({ ...rule, minify: true }))
  ),
  ...QUERY_FILES.flatMap((filename) =>
    copies(
      `${TOOLING_SCRIPTS}/${filename}`,
      portableContractDistributions,
      `scripts/${filename}`
    )
  ),
  ...copies(
    skillPath(FULL, "references/release-handoff.md"),
    portableContractDistributions,
    "references/release-handoff.md"
  ),
  ...copies(
    skillPath(FULL, "references/version-decisions.md"),
    productVersionDistributions,
    "references/version-decisions.md"
  ),
  ...copies(
    skillPath(FULL, "references/testing-notes.md"),
    ["simple-changelogs-mobile"],
    "references/testing-notes.md"
  ),
  ...copies(
    skillPath(CMS, "schemas/repo-policy.schema.json"),
    [WEB_CMS],
    "schemas/repo-policy.schema.json"
  ),
  ...copies(
    skillPath(CMS, "schemas/cms-changelog.schema.json"),
    [WEB_CMS],
    "schemas/cms-changelog.schema.json"
  ),
  {
    source: skillPath(CMS, "scripts/lib/schema.ts"),
    target: skillPath(WEB_CMS, "scripts/lib/cms-schema.ts"),
  },
  ...copies(
    skillPath(FULL, FORK_CHECKER),
    portableContractDistributions,
    FORK_CHECKER
  ),
  // Authoring preferences: the harness data file (the one installed place
  // that names harnesses, beside the other agents/ interface files) and the
  // sidecar and data schemas, in every distribution.
  ...copies(
    skillPath(FULL, HARNESS_DATA),
    changelogDistributions,
    HARNESS_DATA
  ),
  ...AUTHORING_SCHEMAS.flatMap((path) =>
    copies(skillPath(FULL, path), changelogDistributions, path)
  ),
];

export const syncedFiles = async (root: string): Promise<SyncedFile[]> => {
  const rules = syncRules();
  const sources = new Map(
    await Promise.all(
      [...new Set(rules.map(({ source }) => source))].map(async (source) => {
        const path = join(root, source);
        const [bytes, metadata] = await Promise.all([
          readFile(path),
          stat(path),
        ]);
        let text: string;
        try {
          text = UTF8.decode(bytes);
        } catch (error) {
          throw new Error(`${source} is not valid UTF-8`, { cause: error });
        }
        return [source, { mode: metadata.mode % 0o1000, text }] as const;
      })
    )
  );
  return rules.map(({ minify, source, target }) => {
    const { mode = 0o644, text = "" } = sources.get(source) ?? {};
    return {
      expected: minify ? minifiedJson(text) : text,
      mode,
      source,
      target,
    };
  });
};

export interface SyncReport {
  drifted: SyncedFile[];
  inSync: number;
}

// Each segment's metadata below the root, the copy last, with the first
// symlink among them: one anywhere could redirect a write outside the
// repository.
const pathChain = async (
  root: string,
  target: string
): Promise<{ chain: (Stats | null)[]; linked: string | undefined }> => {
  const segments = target.split("/");
  const chain = await Promise.all(
    segments.map((_, index) =>
      lstat(join(root, ...segments.slice(0, index + 1))).catch(() => null)
    )
  );
  const first = chain.findIndex((metadata) => metadata?.isSymbolicLink());
  return {
    chain,
    linked: first === -1 ? undefined : segments.slice(0, first + 1).join("/"),
  };
};

// The point the writer has reached, for tests: `enter` is after a directory
// passed its check and before the step into it, `open` is after the held
// directory is reached and before the copy is opened in it.
export interface WriteStep {
  kind: "enter" | "open";
  // Repository-relative path of the directory or copy.
  path: string;
}
export type WriteProbe = (step: WriteStep) => void;

const errorCode = (error: unknown): unknown =>
  (error as { code?: unknown }).code;

const symlinkRefusal = (path: string, cause?: unknown): Error =>
  new Error(`Refusing to write through the symlink ${path}`, { cause });

// A target is a plain path below the repository root: no absolute, empty,
// `.`, or `..` segment, so every step of the walk is one directory entry.
const plainSegments = (
  target: string
): { directories: string[]; name: string } => {
  const segments = target.split("/");
  const name = segments.at(-1);
  if (
    name === undefined ||
    segments.some((segment) => ["", ".", ".."].includes(segment))
  ) {
    throw new Error(
      `Refusing to write ${target}, which is not a plain path below the repository root`
    );
  }
  return { directories: segments.slice(0, -1), name };
};

const entryAt = (name: string): Stats | undefined =>
  lstatSync(name, { throwIfNoEntry: false });

// The directory entry `name` in the held current directory, created when
// missing: a directory, never a symlink or anything else.
const checkedDirectory = (name: string, path: string): Stats => {
  let entry = entryAt(name);
  if (entry === undefined) {
    try {
      mkdirSync(name);
    } catch (error) {
      if (errorCode(error) !== "EEXIST") {
        throw error;
      }
    }
    entry = entryAt(name);
  }
  if (entry?.isSymbolicLink()) {
    throw symlinkRefusal(path);
  }
  if (!entry?.isDirectory()) {
    throw new Error(
      `Refusing to write through ${path}, which is not a directory`
    );
  }
  return entry;
};

const sameInode = (left: Stats, right: Stats): boolean =>
  left.dev === right.dev && left.ino === right.ino;

// Steps into the checked directory and confirms that the directory now held
// is the one checked and is still a direct child of the directory held
// before, so a swap between the check and the step is caught whether the
// name now leads to another directory or to the checked one moved elsewhere.
const enterDirectory = (
  name: string,
  path: string,
  held: Stats,
  probe: WriteProbe | undefined
): Stats => {
  const checked = checkedDirectory(name, path);
  probe?.({ kind: "enter", path });
  process.chdir(name);
  const entered = statSync(".");
  if (!(sameInode(entered, checked) && sameInode(statSync(".."), held))) {
    throw new Error(
      `Refusing to write through ${path}, which changed after it was checked`
    );
  }
  return entered;
};

// Opens the copy by name in the held directory, creating it when missing and
// never following a symlink, present before the check or swapped in after.
const openCopy = (
  name: string,
  file: SyncedFile,
  probe: WriteProbe | undefined
): number => {
  const entry = entryAt(name);
  if (entry?.isSymbolicLink()) {
    throw symlinkRefusal(file.target);
  }
  if (entry !== undefined && !entry.isFile()) {
    throw new Error(
      `Refusing to write ${file.target}, which is not a regular file`
    );
  }
  probe?.({ kind: "open", path: file.target });
  try {
    return openSync(
      name,
      // Distinct flag bits, so their sum is their union.
      constants.O_WRONLY + constants.O_CREAT + constants.O_NOFOLLOW,
      file.mode
    );
  } catch (error) {
    if (errorCode(error) === "ELOOP") {
      throw symlinkRefusal(file.target, error);
    }
    throw error;
  }
};

// Truncates and writes the open copy once the descriptor is a regular file
// with a single link, so the bytes reach no second name of the same inode.
const writeDescriptor = (descriptor: number, file: SyncedFile): void => {
  const opened = fstatSync(descriptor);
  if (!opened.isFile()) {
    throw new Error(
      `Refusing to write ${file.target}, which is not a regular file`
    );
  }
  if (opened.nlink !== 1) {
    throw new Error(
      `Refusing to write ${file.target}, which has ${opened.nlink} links`
    );
  }
  ftruncateSync(descriptor, 0);
  const bytes = Buffer.from(file.expected, "utf8");
  let written = 0;
  while (written < bytes.length) {
    written += writeSync(descriptor, bytes, written, bytes.length - written);
  }
  fchmodSync(descriptor, file.mode);
};

// Writes the copy through a walk the process holds, the openat the fs API
// lacks: from the repository root, each directory of the target is checked
// (a directory, not a symlink) and then entered by its one name relative to
// the directory already held, and the directory held after the step must be
// the one checked and still a direct child of the directory held before
// (device and inode of `.` and `..`). A swap between a check and its step is
// caught there, whether the name now leads to another directory or to the
// checked one moved elsewhere, and a swap of a directory already entered
// cannot redirect the walk, because the process holds that directory, not
// its path. The copy is then opened by name in the held directory without
// following a symlink and written only as a regular file with a single link,
// so no byte lands outside the directory the walk verified under the root.
// The walk moves this process's working directory and leaves it in the held
// directory, so only the writer process (sync-distros-writer.ts) runs it,
// never the process a maintainer or a check runs in; tests that call it
// directly come back to their own directory. Every step is synchronous, so
// nothing else runs while the directory is moved. Boundary: the bytes reach
// the directory the walk verified, wherever it sits under the directory held
// above it; once held, a directory moved elsewhere takes the write with it,
// as it would with openat, and moving it needs rename rights inside the
// checkout, which already allow changing it directly. A written copy takes
// its source's permissions, whatever the umask. Tests may pass `probe` to act
// between a check and the step it guards.
export const writeHeldCopy = (
  root: string,
  file: SyncedFile,
  probe?: WriteProbe
): void => {
  const { directories, name } = plainSegments(file.target);
  process.chdir(resolve(root));
  let held = statSync(".");
  for (const [index, directory] of directories.entries()) {
    held = enterDirectory(
      directory,
      directories.slice(0, index + 1).join("/"),
      held,
      probe
    );
  }
  const descriptor = openCopy(name, file, probe);
  try {
    writeDescriptor(descriptor, file);
  } finally {
    closeSync(descriptor);
  }
};

// What the writer process reads on stdin: the absolute repository root and
// the copies to write, in order.
export interface WritePayload {
  files: SyncedFile[];
  root: string;
}

const WRITER = join(import.meta.dir, "sync-distros-writer.ts");

// Writes the copies in the writer process, which walks and writes them one
// at a time and stops at the first refusal, so this process's working
// directory never moves; a refusal arrives here as the message the writer
// printed, and nothing after the refused copy was written.
const runWriter = (root: string, files: SyncedFile[]): void => {
  const payload: WritePayload = { files, root: resolve(root) };
  const writer = spawnSync({
    cmd: [process.execPath, WRITER],
    stderr: "pipe",
    stdin: Buffer.from(JSON.stringify(payload)),
    stdout: "pipe",
  });
  if (!writer.success) {
    const message = writer.stderr.toString().trim();
    throw new Error(
      message === ""
        ? `The sync writer stopped with ${writer.signalCode ?? writer.exitCode}`
        : message
    );
  }
};

// Computes every expected copy and checks every path before writing any, so
// an unreadable or malformed canonical source or a symlinked path changes
// nothing. The check runs ahead of the writer as a first refusal; the writer
// process holds the boundary and writes the drifted copies one at a time.
export const syncDistributions = async (
  root: string,
  { write }: { write: boolean }
): Promise<SyncReport> => {
  const files = await syncedFiles(root);
  const matches = await Promise.all(
    files.map(async (file) => {
      const { chain, linked } = await pathChain(root, file.target);
      if (linked !== undefined) {
        throw new Error(`Refusing to write through the symlink ${linked}`);
      }
      return (
        chain.at(-1) !== null &&
        holdsBytes(await readFile(join(root, file.target)), file.expected)
      );
    })
  );
  const drifted = files.filter((_, index) => !matches[index]);
  if (write && drifted.length > 0) {
    runWriter(root, drifted);
  }
  return { drifted, inSync: files.length - drifted.length };
};

const USAGE = "Usage: bun tooling/sync-distros.ts [--check]\n";

if (import.meta.main) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  if (args.some((arg) => arg !== "--check")) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
  } else {
    try {
      const { drifted, inSync } = await syncDistributions(
        resolve(import.meta.dir, ".."),
        { write: !check }
      );
      const verb = check ? "Out of sync" : "Wrote";
      for (const { source, target } of drifted) {
        process.stdout.write(`${verb}: ${target} (from ${source})\n`);
      }
      process.stdout.write(
        `${inSync} byte-synced files already matched; ${drifted.length} ${check ? "drifted" : "written"}.\n`
      );
      process.exitCode = check && drifted.length > 0 ? 1 : 0;
    } catch (error) {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 2;
    }
  }
}
