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
const canonicalSetupHelper = await readFile(
  join(toolingRoot, "simple-changelogs", "scripts", "setup.ts"),
  "utf8"
);

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
    const setupPath = join(directory, "scripts", "setup.ts");
    const backfillPath = join(directory, "references", "backfill.md");
    const onboardingPath = join(directory, "references", "onboarding.md");
    const [backfillSource, entries, onboardingSource, source] =
      await Promise.all([
        changelogDistributions.has(directoryName) && existsSync(backfillPath)
          ? readFile(backfillPath, "utf8")
          : Promise.resolve(null),
        walk(directory),
        changelogDistributions.has(directoryName) && existsSync(onboardingPath)
          ? readFile(onboardingPath, "utf8")
          : Promise.resolve(null),
        readFile(join(directory, "SKILL.md"), "utf8"),
      ]);
    const setupSource =
      changelogDistributions.has(directoryName) && existsSync(setupPath)
        ? await readFile(setupPath, "utf8")
        : null;
    return {
      backfillSource,
      directory,
      directoryName,
      entries,
      onboardingSource,
      setupSource,
      source,
    };
  })
);

const descriptions = new Map<string, string>();
for (const {
  backfillSource,
  directory,
  directoryName,
  entries,
  onboardingSource,
  setupSource,
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
  if (changelogDistributions.has(directoryName)) {
    const setupPath = join(directory, "scripts", "setup.ts");
    if (!existsSync(setupPath)) {
      failures.push(`skills/${directoryName} is missing scripts/setup.ts`);
    } else if (setupSource !== canonicalSetupHelper) {
      failures.push(
        `skills/${directoryName}/scripts/setup.ts is out of sync with maintainer tooling`
      );
    }

    if (backfillSource === null) {
      failures.push(
        `skills/${directoryName} is missing references/backfill.md`
      );
    } else {
      for (const requiredBoundary of [
        "initial backfill",
        "complete accessible",
        "`partial`",
        "`failed`",
      ]) {
        if (!backfillSource.includes(requiredBoundary)) {
          failures.push(
            `skills/${directoryName}/references/backfill.md is missing comprehensive initial-backfill boundary: ${requiredBoundary}`
          );
        }
      }
    }

    if (onboardingSource === null) {
      failures.push(
        `skills/${directoryName} is missing references/onboarding.md`
      );
    } else if (
      !(
        onboardingSource.includes("## Final history question") &&
        onboardingSource.includes(
          "immediately before the confirmation receipt"
        ) &&
        onboardingSource.includes("include the full backfill") &&
        onboardingSource.includes("Do not require a") &&
        onboardingSource.includes("“Review it now” approval")
      )
    ) {
      failures.push(
        `skills/${directoryName}/references/onboarding.md must default the full backfill and offer opt-out last`
      );
    }
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

const releaseSurfaceChecks = await Promise.all(
  [
    "simple-changelogs",
    "simple-changelogs-mobile",
    "simple-changelogs-web",
    "simple-changelogs-web-cms",
  ].map(async (directoryName) => ({
    directoryName,
    source: await readFile(
      join(skillsRoot, directoryName, "references", "release-note-surfaces.md"),
      "utf8"
    ),
  }))
);
for (const { directoryName, source } of releaseSurfaceChecks) {
  for (const requiredRule of [
    "**Release Notes**",
    "**Changelog**",
    "Updates",
    "tab or section",
    "dedicated **Release Notes**",
    "automatically shown",
  ]) {
    if (!source.includes(requiredRule)) {
      failures.push(
        `skills/${directoryName}/references/release-note-surfaces.md is missing contextual surface rule: ${requiredRule}`
      );
    }
  }
}

const cmsSurfaceChecks = await Promise.all(
  ["simple-changelogs-cms", "simple-changelogs-web-cms"].map(
    async (directoryName) => ({
      directoryName,
      source: await readFile(
        join(skillsRoot, directoryName, "references", "cms-surface.md"),
        "utf8"
      ),
    })
  )
);
for (const { directoryName, source } of cmsSurfaceChecks) {
  if (
    !(source.includes("**Changelog**") && source.includes("**Release Notes**"))
  ) {
    failures.push(
      `skills/${directoryName}/references/cms-surface.md must default protected technical history to Changelog and customer history to Release Notes`
    );
  }
}

const onboardingChecks = await Promise.all(
  [
    "simple-changelogs",
    "simple-changelogs-cms",
    "simple-changelogs-mobile",
    "simple-changelogs-web",
    "simple-changelogs-web-cms",
    "simple-changelogs-skill-maintainer",
  ].map(async (directoryName) => ({
    directoryName,
    source: await readFile(
      join(skillsRoot, directoryName, "references", "onboarding.md"),
      "utf8"
    ),
  }))
);
for (const { directoryName, source } of onboardingChecks) {
  for (const requiredChoice of [
    "## Contextual product-surface choice",
    "Add a Release Notes tab or section there",
    "Create a dedicated Release Notes page",
    "Automatic Release Notes modal",
    "developer, administrator, operator",
  ]) {
    if (!source.includes(requiredChoice)) {
      failures.push(
        `skills/${directoryName}/references/onboarding.md is missing contextual release-note onboarding choice: ${requiredChoice}`
      );
    }
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
