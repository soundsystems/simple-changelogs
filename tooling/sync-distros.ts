#!/usr/bin/env bun

import {
  chmod,
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

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
const TOOLING_SCRIPTS = "tooling/simple-changelogs/scripts";
const TOOLING_SCHEMAS = "tooling/simple-changelogs/evals/schemas";

// The readable canonical protocol files live in tooling; every distribution
// ships them minified, exactly JSON.stringify(JSON.parse(text)) plus a
// newline, the bytes Simple Changes ships for the same schemas.
export const minifiedJson = (text: string): string =>
  `${JSON.stringify(JSON.parse(text))}\n`;

export interface SyncedFile {
  expected: string;
  // The source's permission bits, given to a copy that has to be created.
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
];

export const syncedFiles = async (root: string): Promise<SyncedFile[]> => {
  const rules = syncRules();
  const sources = new Map(
    await Promise.all(
      [...new Set(rules.map(({ source }) => source))].map(async (source) => {
        const path = join(root, source);
        const [text, metadata] = await Promise.all([
          readFile(path, "utf8"),
          stat(path),
        ]);
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

// Computes every expected copy before writing any, so an unreadable or
// malformed canonical source changes nothing.
export const syncDistributions = async (
  root: string,
  { write }: { write: boolean }
): Promise<SyncReport> => {
  const files = await syncedFiles(root);
  const matches = await Promise.all(
    files.map(async (file) => {
      // A symlink anywhere below the root, the copy or a directory above it,
      // could redirect the write outside the repository.
      const segments = file.target.split("/");
      const chain = await Promise.all(
        segments.map((_, index) =>
          lstat(join(root, ...segments.slice(0, index + 1))).catch(() => null)
        )
      );
      const linked = chain.findIndex((metadata) => metadata?.isSymbolicLink());
      if (linked !== -1) {
        throw new Error(
          `Refusing to write through the symlink ${segments.slice(0, linked + 1).join("/")}`
        );
      }
      return (
        chain.at(-1) !== null &&
        (await readFile(join(root, file.target), "utf8")) === file.expected
      );
    })
  );
  const drifted = files.filter((_, index) => !matches[index]);
  if (write) {
    await Promise.all(
      drifted.map(async (file) => {
        const target = join(root, file.target);
        const existed = await lstat(target).then(
          () => true,
          () => false
        );
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.expected);
        // A recreated copy takes the source's permissions, whatever the
        // umask; an existing copy keeps its own.
        if (!existed) {
          await chmod(target, file.mode);
        }
      })
    );
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
