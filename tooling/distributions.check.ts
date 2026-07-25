#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { YAML } from "bun";
import { evaluateContracts } from "./simple-changelogs/scripts/lib/contracts.ts";

const repositoryRoot = resolve(import.meta.dir, "..");
const skillsRoot = join(repositoryRoot, "skills");
const toolingRoot = join(repositoryRoot, "tooling");
const MAX_DISTRIBUTION_BYTES = 256 * 1024;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;
const LOCAL_ROUTE_PATTERN =
  /(?:`|\]\()((?:references|scripts|schemas)\/[^`\s)#]+)(?:`|\))/gu;

const changelogDistributions = new Set([
  "simple-changelogs",
  "simple-changelogs-cms",
  "simple-changelogs-mobile",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
  "simple-changelogs-skill-maintainer",
]);
const expectedSkills = new Set([...changelogDistributions, "publish-skill"]);
const portableContractDistributions = new Set([
  "simple-changelogs",
  "simple-changelogs-mobile",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
  "simple-changelogs-skill-maintainer",
]);
const forbiddenNames = new Set(["EVAL.md"]);
const failures: string[] = [];

interface WalkedEntry {
  bytes: number;
  path: string;
  symlink: boolean;
}

const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
};

const walk = async (root: string, directory = root): Promise<WalkedEntry[]> => {
  const children = await readdir(directory, { withFileTypes: true });
  children.sort((left, right) => compareText(left.name, right.name));
  const nested = await Promise.all(
    children.map(async (child): Promise<WalkedEntry[]> => {
      const fullPath = join(directory, child.name);
      const localPath = relative(root, fullPath);
      const metadata = await lstat(fullPath);
      if (metadata.isSymbolicLink()) {
        return [{ bytes: metadata.size, path: localPath, symlink: true }];
      }
      if (metadata.isDirectory()) {
        return walk(root, fullPath);
      }
      return [{ bytes: metadata.size, path: localPath, symlink: false }];
    })
  );
  return nested.flat();
};

const skillDirectories = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort(compareText);

for (const expected of expectedSkills) {
  if (!skillDirectories.includes(expected)) {
    failures.push(`Missing selectable skill directory: skills/${expected}`);
  }
}
for (const actual of skillDirectories) {
  if (!expectedSkills.has(actual)) {
    failures.push(`Undocumented selectable skill directory: skills/${actual}`);
  }
}

const distributionSnapshots = await Promise.all(
  skillDirectories.map(async (directoryName) => {
    const directory = join(skillsRoot, directoryName);
    const [entries, source] = await Promise.all([
      walk(directory),
      readFile(join(directory, "SKILL.md"), "utf8"),
    ]);
    return { directory, directoryName, entries, source };
  })
);

const descriptions = new Map<string, string>();
for (const {
  directory,
  directoryName,
  entries,
  source,
} of distributionSnapshots) {
  const skillFiles = entries.filter(
    (entry) => basename(entry.path) === "SKILL.md"
  );
  if (skillFiles.length !== 1 || skillFiles[0]?.path !== "SKILL.md") {
    failures.push(
      `skills/${directoryName} must contain exactly one root SKILL.md; found ${skillFiles.length}`
    );
  }
  for (const entry of entries) {
    if (entry.symlink) {
      failures.push(
        `Installed skill contains symlink: ${directoryName}/${entry.path}`
      );
    }
    const segments = entry.path.split("/");
    const filename = basename(entry.path);
    if (
      forbiddenNames.has(filename) ||
      segments.includes("evals") ||
      segments.includes("fixtures") ||
      segments.includes("tests") ||
      segments.includes("adapters") ||
      /\.(?:check|test)\.[cm]?[jt]sx?$/u.test(filename)
    ) {
      failures.push(
        `Installed skill contains maintainer-only artifact: ${directoryName}/${entry.path}`
      );
    }
  }
  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (totalBytes > MAX_DISTRIBUTION_BYTES) {
    failures.push(
      `skills/${directoryName} is ${totalBytes} bytes; maximum is ${MAX_DISTRIBUTION_BYTES}`
    );
  }

  const frontmatter = FRONTMATTER_PATTERN.exec(source)?.[1];
  if (!frontmatter) {
    failures.push(`skills/${directoryName}/SKILL.md has no closed frontmatter`);
    continue;
  }
  const metadata = YAML.parse(frontmatter) as {
    description?: unknown;
    name?: unknown;
  };
  if (metadata.name !== directoryName) {
    failures.push(
      `skills/${directoryName}/SKILL.md name does not match its directory`
    );
  }
  if (
    typeof metadata.description !== "string" ||
    metadata.description.trim().length < 40
  ) {
    failures.push(
      `skills/${directoryName}/SKILL.md needs a useful discovery description`
    );
  } else if (descriptions.has(metadata.description)) {
    failures.push(
      `skills/${directoryName} duplicates the description for ${descriptions.get(metadata.description)}`
    );
  } else {
    descriptions.set(metadata.description, directoryName);
  }

  for (const match of source.matchAll(LOCAL_ROUTE_PATTERN)) {
    const [, target] = match;
    if (target && !existsSync(join(directory, target))) {
      failures.push(
        `skills/${directoryName}/SKILL.md routes to missing ${target}`
      );
    }
  }

  if (
    changelogDistributions.has(directoryName) &&
    !source.includes("Use one changelog-owning distribution per repository")
  ) {
    failures.push(
      `skills/${directoryName}/SKILL.md lacks the mutual-exclusion checkpoint`
    );
  }
}

const contractResults = await Promise.all(
  distributionSnapshots
    .filter(({ directoryName }) =>
      portableContractDistributions.has(directoryName)
    )
    .map(async ({ directory, directoryName }) => ({
      directoryName,
      findings: await evaluateContracts(directory),
    }))
);
for (const { directoryName, findings } of contractResults) {
  for (const finding of findings) {
    failures.push(
      `skills/${directoryName} contract ${finding.code} at ${finding.path}: ${finding.message}`
    );
  }
}

const toolingEntries = await walk(toolingRoot);
for (const entry of toolingEntries) {
  if (basename(entry.path) === "SKILL.md") {
    failures.push(
      `Maintainer tooling is discoverable as a skill: ${entry.path}`
    );
  }
}

const skillMaintainer = await readFile(
  join(skillsRoot, "simple-changelogs-skill-maintainer", "SKILL.md"),
  "utf8"
);
for (const boundary of ["product-app", "CMS history", "mobile/store"]) {
  if (!skillMaintainer.includes(boundary)) {
    failures.push(
      `simple-changelogs-skill-maintainer is missing boundary: ${boundary}`
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `Distribution validation failed (${failures.length}):\n${failures
      .map((failure) => `- ${failure}`)
      .join("\n")}\n`
  );
  process.exitCode = 1;
} else {
  const sizes = distributionSnapshots.map(({ directoryName, entries }) => ({
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    directoryName,
  }));
  process.stdout.write(
    `Distribution validation passed: ${sizes
      .map(({ bytes, directoryName }) => `${directoryName} ${bytes}B`)
      .join(", ")}; isolated maintainer tooling.\n`
  );
}
