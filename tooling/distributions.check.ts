#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { YAML } from "bun";
import { evaluateContracts } from "./simple-changelogs/scripts/lib/contracts.ts";
import {
  changelogDistributions,
  holdsBytes,
  portableContractDistributions,
  productVersionDistributions,
  releaseHandoffDistributions,
  syncedFiles,
} from "./sync-distros.ts";

const repositoryRoot = resolve(import.meta.dir, "..");
const skillsRoot = join(repositoryRoot, "skills");
const toolingRoot = join(repositoryRoot, "tooling");
// Two budgets, because the two kinds of installed file cost different things.
// Markdown (SKILL.md and references) is what an agent reads into context, so it
// gets the tight guidance budget. Scripts, schemas, and JSON are executed or
// validated, not read, and are mostly byte-synced copies (setup.ts ships in
// every distribution), so they get a separate support budget that keeps the
// install small without forcing correctness code to compete with guidance.
// Measured at the split (MR after !64): Markdown full 210,710 bytes, Web+CMS
// 188,652, Web 175,616, mobile 166,377, skill-maintainer 98,243, CMS-only
// 64,373; support files Web+CMS 215,174, the other Markdown distributions
// about 198,600, CMS-only 162,615. When the guidance budget binds, trim
// reference prose before raising it.
// The support budget rose from 256 KiB to 384 KiB for release tags (approved
// by the user on 2026-10-07): the protocol schemas each distribution vendors
// must stay byte-identical with Simple Changes, which ships them minified, and
// scripts are executed, not read into context. Measured on that branch with
// minified schemas: support files Web+CMS 282,993 bytes, full 266,362, mobile
// 266,372, Web 266,361, skill-maintainer 266,422, CMS-only 221,291. When the
// support budget binds, prefer moving distribution-specific code into a module
// only those distributions ship before raising again.
// Measured for 0.26.0, with scripts/handoff.ts in every distribution and the
// query.ts gaps and store-note checks: Markdown full 220,916 bytes, Web+CMS
// 200,200, mobile 191,317, Web 186,669, skill-maintainer 113,488, CMS-only
// 68,394; support files Web+CMS 318,553, full 301,922, mobile 301,932, Web
// 301,921, skill-maintainer 301,982, CMS-only 243,272.
// Measured on release/0.26.0 with authoring preferences merged: Markdown full
// 226,984 bytes (2,392 under the budget), Web+CMS 206,271, mobile 197,388, Web
// 192,740, skill-maintainer 119,559, CMS-only 74,438; support files Web+CMS
// 351,391, skill-maintainer 334,820, mobile 334,770, full 334,760, Web
// 334,759, CMS-only 276,110.
const MAX_GUIDANCE_BYTES = 224 * 1024;
const MAX_SUPPORT_BYTES = 384 * 1024;
// Claude Code keeps only the first 5,000 tokens of a loaded skill after
// compaction, so every SKILL.md stays at or under about 5,000 tokens: 17,500
// bytes at 3.5 bytes per token. The router and invariants come first;
// everything else belongs in a reference.
const MAX_SKILL_BYTES = 17_500;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;
const LOCAL_ROUTE_PATTERN =
  /(?:`|\]\()((?:references|scripts|schemas)\/[^`\s)#]+)(?:`|\))/gu;

const expectedSkills = new Set(changelogDistributions);
const forbiddenNames = new Set(["EVAL.md"]);
// Agent Skills frontmatter: every package states its license and runtime
// requirements, a distribution that ships the POSIX fork checker says so, and
// changelog distributions carry only the specification's portable fields.
const SKILL_LICENSE = "Apache-2.0";
const MAX_COMPATIBILITY_LENGTH = 500;
const BASE_COMPATIBILITY = "Requires Git and Bun 1.3 or later";
const FORK_CHECKER_COMPATIBILITY = `${BASE_COMPATIBILITY}; check-fork-sync.sh requires a POSIX shell`;
const PORTABLE_FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
]);
const HARNESS_ONLY_FRONTMATTER_KEYS = ["model", "effort"];
const PROVIDER_MARKER_FILENAME = "changelog-provider.json";
// Directory name -> the distribution identifier consumers match on. The marker
// exists so a consumer never has to re-derive this from the directory name.
const MARKER_DISTRIBUTIONS = new Map([
  ["simple-changelogs", "full"],
  ["simple-changelogs-cms", "cms"],
  ["simple-changelogs-mobile", "mobile"],
  ["simple-changelogs-skill-maintainer", "skill-repository"],
  ["simple-changelogs-web", "web"],
  ["simple-changelogs-web-cms", "web-cms"],
]);
const markerGuidanceVersions = new Map<string, unknown>();
const failures: string[] = [];
const distributionManifest = JSON.parse(
  await readFile(join(repositoryRoot, "distribution-manifest.json"), "utf8")
) as {
  distributions?: Array<{ guidanceVersion?: unknown; name?: unknown }>;
  schemaVersion?: unknown;
};
const canonicalSetupHelper = await readFile(
  join(toolingRoot, "simple-changelogs", "scripts", "setup.ts"),
  "utf8"
);

// protocol-provenance.json describes the Simple Changes protocol; each
// distribution's marker advertises only the subset it supports.
const protocolProvenance = JSON.parse(
  await readFile(
    join(
      toolingRoot,
      "simple-changelogs",
      "evals",
      "schemas",
      "protocol-provenance.json"
    ),
    "utf8"
  )
) as { receiptVersions?: unknown[]; requestVersions?: unknown[] };

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
    const backfillPath = join(directory, "references", "backfill.md");
    const guidancePath = join(directory, "references", "guidance-updates.md");
    const onboardingPath = join(directory, "references", "onboarding.md");
    const [backfillSource, entries, guidanceSource, onboardingSource, source] =
      await Promise.all([
        changelogDistributions.has(directoryName) && existsSync(backfillPath)
          ? readFile(backfillPath, "utf8")
          : Promise.resolve(null),
        walk(directory),
        changelogDistributions.has(directoryName) && existsSync(guidancePath)
          ? readFile(guidancePath, "utf8")
          : Promise.resolve(null),
        changelogDistributions.has(directoryName) && existsSync(onboardingPath)
          ? readFile(onboardingPath, "utf8")
          : Promise.resolve(null),
        readFile(join(directory, "SKILL.md"), "utf8"),
      ]);
    return {
      backfillSource,
      directory,
      directoryName,
      entries,
      guidanceSource,
      onboardingSource,
      source,
    };
  })
);

const descriptions = new Map<string, string>();
const discoveredGuidanceVersions = new Map<string, number>();
for (const {
  backfillSource,
  directory,
  directoryName,
  entries,
  guidanceSource,
  onboardingSource,
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
  const guidanceBytes = entries
    .filter((entry) => entry.path.endsWith(".md"))
    .reduce((sum, entry) => sum + entry.bytes, 0);
  const supportBytes = entries
    .filter((entry) => !entry.path.endsWith(".md"))
    .reduce((sum, entry) => sum + entry.bytes, 0);
  const skillBytes =
    entries.find((entry) => entry.path === "SKILL.md")?.bytes ?? 0;
  if (skillBytes > MAX_SKILL_BYTES) {
    failures.push(
      `skills/${directoryName}/SKILL.md is ${skillBytes} bytes; the SKILL.md maximum is ${MAX_SKILL_BYTES} (about 5,000 tokens)`
    );
  }
  if (guidanceBytes > MAX_GUIDANCE_BYTES) {
    failures.push(
      `skills/${directoryName} Markdown is ${guidanceBytes} bytes; the guidance maximum is ${MAX_GUIDANCE_BYTES}`
    );
  }
  if (supportBytes > MAX_SUPPORT_BYTES) {
    failures.push(
      `skills/${directoryName} scripts, schemas, and data are ${supportBytes} bytes; the support maximum is ${MAX_SUPPORT_BYTES}`
    );
  }

  const frontmatter = FRONTMATTER_PATTERN.exec(source)?.[1];
  if (!frontmatter) {
    failures.push(`skills/${directoryName}/SKILL.md has no closed frontmatter`);
    continue;
  }
  const metadata = YAML.parse(frontmatter) as {
    compatibility?: unknown;
    "disable-model-invocation"?: unknown;
    description?: unknown;
    license?: unknown;
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

  if (metadata.license !== SKILL_LICENSE) {
    failures.push(
      `skills/${directoryName}/SKILL.md must declare license: ${SKILL_LICENSE}`
    );
  }
  if (
    typeof metadata.compatibility !== "string" ||
    !metadata.compatibility.trim() ||
    metadata.compatibility.length > MAX_COMPATIBILITY_LENGTH
  ) {
    failures.push(
      `skills/${directoryName}/SKILL.md needs a compatibility of at most ${MAX_COMPATIBILITY_LENGTH} characters`
    );
  }
  for (const key of HARNESS_ONLY_FRONTMATTER_KEYS) {
    if (Object.hasOwn(metadata, key)) {
      failures.push(
        `skills/${directoryName}/SKILL.md sets the harness-only ${key} key`
      );
    }
  }
  if (changelogDistributions.has(directoryName)) {
    const expectedCompatibility = entries.some(
      (entry) => entry.path === "scripts/check-fork-sync.sh"
    )
      ? FORK_CHECKER_COMPATIBILITY
      : BASE_COMPATIBILITY;
    if (metadata.compatibility !== expectedCompatibility) {
      failures.push(
        `skills/${directoryName}/SKILL.md compatibility must read: ${expectedCompatibility}`
      );
    }
    const extraKeys = Object.keys(metadata).filter(
      (key) => !PORTABLE_FRONTMATTER_KEYS.has(key)
    );
    if (extraKeys.length > 0) {
      failures.push(
        `skills/${directoryName}/SKILL.md frontmatter has non-portable keys: ${extraKeys.join(", ")}`
      );
    }
  }

  // A user-invoked skill must be user-invoked in every harness: Claude Code's
  // disable-model-invocation and Codex's agents/openai.yaml policy move together.
  const openaiPath = join(directory, "agents", "openai.yaml");
  if (existsSync(openaiPath)) {
    const openai = YAML.parse(readFileSync(openaiPath, "utf8")) as {
      policy?: { allow_implicit_invocation?: unknown };
    } | null;
    const claudeUserInvoked = metadata["disable-model-invocation"] === true;
    const codexUserInvoked =
      openai?.policy?.allow_implicit_invocation === false;
    if (claudeUserInvoked !== codexUserInvoked) {
      failures.push(
        `skills/${directoryName}: disable-model-invocation and agents/openai.yaml policy.allow_implicit_invocation disagree`
      );
    }
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
    if (
      releaseHandoffDistributions.has(directoryName) &&
      !source.includes("references/release-handoff.md")
    ) {
      failures.push(
        `skills/${directoryName}/SKILL.md does not route delegated release handoffs`
      );
    }

    if (MARKER_DISTRIBUTIONS.has(directoryName)) {
      // Consumers prefer this marker over directory-name and SKILL.md prose
      // inference, so it has to ship inside the installed package.
      const markerPath = join(directory, PROVIDER_MARKER_FILENAME);
      const markerEntry = entries.find(
        (entry) => entry.path === PROVIDER_MARKER_FILENAME
      );
      if (existsSync(markerPath) && markerEntry) {
        const marker = JSON.parse(readFileSync(markerPath, "utf8")) as {
          distribution?: unknown;
          guidanceVersion?: unknown;
          provider?: unknown;
          receiptVersions?: unknown;
          requestVersions?: unknown;
          schemaDigests?: unknown;
          schemaVersion?: unknown;
        };
        const expectedDistribution =
          MARKER_DISTRIBUTIONS.get(directoryName) ?? null;
        if (marker.schemaVersion !== 1) {
          failures.push(
            `skills/${directoryName}/${PROVIDER_MARKER_FILENAME} must use schemaVersion 1`
          );
        }
        if (marker.provider !== "simple-changelogs") {
          failures.push(
            `skills/${directoryName}/${PROVIDER_MARKER_FILENAME} must declare provider simple-changelogs`
          );
        }
        if (marker.distribution !== expectedDistribution) {
          failures.push(
            `skills/${directoryName}/${PROVIDER_MARKER_FILENAME} declares distribution ${String(marker.distribution)}, but the directory ships ${String(expectedDistribution)}`
          );
        }
        // Only distributions that ship the pinned protocol schemas may
        // advertise request/receipt versions; a marker that advertises none
        // declares itself discovery-only so no consumer negotiates a handoff
        // the distribution cannot run.
        const advertisesProtocol =
          Array.isArray(marker.requestVersions) &&
          marker.requestVersions.length > 0 &&
          Array.isArray(marker.receiptVersions) &&
          marker.receiptVersions.length > 0;
        if (
          advertisesProtocol !== releaseHandoffDistributions.has(directoryName)
        ) {
          failures.push(
            `skills/${directoryName}/${PROVIDER_MARKER_FILENAME} must advertise request and receipt versions exactly when the distribution ships the release handoff protocol`
          );
        }
        if (
          advertisesProtocol &&
          !(
            (marker.requestVersions as unknown[]).every((version) =>
              protocolProvenance.requestVersions?.includes(version)
            ) &&
            (marker.receiptVersions as unknown[]).every((version) =>
              protocolProvenance.receiptVersions?.includes(version)
            )
          )
        ) {
          failures.push(
            `skills/${directoryName}/${PROVIDER_MARKER_FILENAME} advertises versions outside protocol-provenance.json`
          );
        }
        if (
          advertisesProtocol &&
          !(
            typeof marker.schemaDigests === "object" &&
            marker.schemaDigests !== null
          )
        ) {
          failures.push(
            `skills/${directoryName}/${PROVIDER_MARKER_FILENAME} must advertise schema digests with its protocol versions`
          );
        }
        markerGuidanceVersions.set(directoryName, marker.guidanceVersion);
      } else {
        failures.push(
          `skills/${directoryName} is missing ${PROVIDER_MARKER_FILENAME} beside SKILL.md`
        );
      }
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

    const currentGuidance = /Current guidance version: (\d+)/u.exec(
      source
    )?.[1];
    if (!currentGuidance || guidanceSource === null) {
      failures.push(
        `skills/${directoryName} is missing current guidance release notes`
      );
    } else if (
      !guidanceSource.includes(
        `simple-changelogs-guidance-update version="${currentGuidance}"`
      )
    ) {
      failures.push(
        `skills/${directoryName} guidance ${currentGuidance} lacks update-notice metadata`
      );
    }
    if (currentGuidance) {
      discoveredGuidanceVersions.set(directoryName, Number(currentGuidance));
    }
    for (const terminology of [
      "distribution-specific behavior checkpoint",
      "Changelogs family version or installed source revision",
      "Git ref or commit when known",
    ]) {
      if (!source.includes(terminology)) {
        failures.push(
          `skills/${directoryName}/SKILL.md is missing guidance identity wording: ${terminology}`
        );
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

if (distributionManifest.schemaVersion !== 1) {
  failures.push("distribution-manifest.json must use schemaVersion 1");
}
const manifestGuidanceVersions = new Map<string, number>();
for (const entry of distributionManifest.distributions ?? []) {
  if (
    typeof entry.name !== "string" ||
    typeof entry.guidanceVersion !== "number" ||
    !Number.isInteger(entry.guidanceVersion) ||
    entry.guidanceVersion < 1
  ) {
    failures.push(
      "distribution-manifest.json contains an invalid distribution entry"
    );
    continue;
  }
  if (manifestGuidanceVersions.has(entry.name)) {
    failures.push(
      `distribution-manifest.json repeats distribution: ${entry.name}`
    );
  }
  manifestGuidanceVersions.set(entry.name, entry.guidanceVersion);
}
for (const distributionName of changelogDistributions) {
  const declared = manifestGuidanceVersions.get(distributionName);
  const discovered = discoveredGuidanceVersions.get(distributionName);
  if (declared !== discovered) {
    failures.push(
      `distribution-manifest.json records ${distributionName} guidance ${String(declared)}, but SKILL.md declares ${String(discovered)}`
    );
  }
}
for (const distributionName of manifestGuidanceVersions.keys()) {
  if (!changelogDistributions.has(distributionName)) {
    failures.push(
      `distribution-manifest.json lists unknown distribution: ${distributionName}`
    );
  }
}
for (const [distributionName, guidanceVersion] of markerGuidanceVersions) {
  const discovered = discoveredGuidanceVersions.get(distributionName);
  if (guidanceVersion !== discovered) {
    failures.push(
      `skills/${distributionName}/${PROVIDER_MARKER_FILENAME} records guidance ${String(guidanceVersion)}, but SKILL.md declares ${String(discovered)}`
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
    "## Question presentation contract",
    "numbered, choose-one list",
    "## Contextual product-surface choice",
    "always offer this choice",
    "Automatic Release Notes modal",
    "## Component-source choice",
    "developer, administrator, operator",
  ]) {
    if (!source.includes(requiredChoice)) {
      failures.push(
        `skills/${directoryName}/references/onboarding.md is missing contextual release-note onboarding choice: ${requiredChoice}`
      );
    }
  }
}

const webOnboardingDistributions = new Set([
  "simple-changelogs",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
]);
for (const { directoryName, source } of onboardingChecks.filter((candidate) =>
  webOnboardingDistributions.has(candidate.directoryName)
)) {
  for (const requiredChoice of [
    "Should I build a Release Notes page?",
    "Add Release Notes to an existing page",
    "Create a dedicated Release Notes page",
    "Who should see Release",
    "Developers and preview reviewers only",
    "Local       Preview       Production",
  ]) {
    if (!source.includes(requiredChoice)) {
      failures.push(
        `skills/${directoryName}/references/onboarding.md is missing Web release-note onboarding choice: ${requiredChoice}`
      );
    }
  }
}

// A skill repository ships no product application, so its onboarding records
// no component source and seeds no archive.
for (const { directoryName, source } of onboardingChecks.filter(
  (candidate) =>
    candidate.directoryName !== "simple-changelogs-skill-maintainer"
)) {
  for (const requiredChoice of [
    "--surface-components",
    "complete canonical history",
  ]) {
    if (!source.includes(requiredChoice)) {
      failures.push(
        `skills/${directoryName}/references/onboarding.md is missing product-surface onboarding guidance: ${requiredChoice}`
      );
    }
  }
}

const surfaceDesignDistributions = [
  "simple-changelogs",
  "simple-changelogs-cms",
  "simple-changelogs-mobile",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
];

const publicHistoryDistributions = [
  "simple-changelogs",
  "simple-changelogs-mobile",
  "simple-changelogs-skill-maintainer",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
];
const publicHistorySnapshots = await Promise.all(
  publicHistoryDistributions.map(async (directoryName) => {
    const referenceRoot = join(skillsRoot, directoryName, "references");
    const [classification, majorReleases, onboarding, setup] =
      await Promise.all([
        readFile(join(referenceRoot, "entry-classification.md"), "utf8"),
        readFile(join(referenceRoot, "major-releases.md"), "utf8"),
        readFile(join(referenceRoot, "onboarding.md"), "utf8"),
        readFile(join(referenceRoot, "setup.md"), "utf8"),
      ]);
    return { classification, directoryName, majorReleases, onboarding, setup };
  })
);
for (const snapshot of publicHistorySnapshots) {
  const normalizedClassification = snapshot.classification.replace(
    /\s+/gu,
    " "
  );
  const normalizedMajorReleases = snapshot.majorReleases.replace(/\s+/gu, " ");
  for (const requiredRule of [
    "releaseNoteGrouping",
    "product-areas",
    "majorReleaseNaming",
    "version-only",
  ]) {
    if (
      !(
        snapshot.onboarding.includes(requiredRule) &&
        snapshot.setup.includes(requiredRule)
      )
    ) {
      failures.push(
        `skills/${snapshot.directoryName} is missing release-organization preference: ${requiredRule}`
      );
    }
  }
  for (const requiredRule of [
    "Bug Fixes & Improvements",
    "bullets flat",
    "one-bullet category",
  ]) {
    if (!normalizedClassification.includes(requiredRule)) {
      failures.push(
        `skills/${snapshot.directoryName} is missing patch/grouping rule: ${requiredRule}`
      );
    }
  }
  for (const requiredRule of [
    "majorReleaseNaming",
    "presentation beside the canonical",
    "Minor releases require no name",
  ]) {
    if (!normalizedMajorReleases.includes(requiredRule)) {
      failures.push(
        `skills/${snapshot.directoryName} is missing stable-major naming rule: ${requiredRule}`
      );
    }
  }
}

const webReleaseNoteScopeDistributions = [
  "simple-changelogs",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
];
const webReleaseNoteScopeSnapshots = await Promise.all(
  webReleaseNoteScopeDistributions.map(async (directoryName) => {
    const [onboarding, setup, surfaces] = await Promise.all([
      readFile(
        join(skillsRoot, directoryName, "references", "onboarding.md"),
        "utf8"
      ),
      readFile(
        join(skillsRoot, directoryName, "references", "setup.md"),
        "utf8"
      ),
      readFile(
        join(
          skillsRoot,
          directoryName,
          "references",
          "release-note-surfaces.md"
        ),
        "utf8"
      ),
    ]);
    return { directoryName, onboarding, setup, surfaces };
  })
);
for (const {
  directoryName,
  onboarding,
  setup,
  surfaces,
} of webReleaseNoteScopeSnapshots) {
  for (const requiredRule of [
    "releaseNoteEnvironmentScope",
    "all-environments",
    "non-production",
    "production-only",
    "disabled",
  ]) {
    if (
      !(
        onboarding.includes(requiredRule) &&
        setup.includes(requiredRule) &&
        surfaces.includes(requiredRule)
      )
    ) {
      failures.push(
        `skills/${directoryName} is missing release-note environment rule: ${requiredRule}`
      );
    }
  }
  for (const requiredExposureRule of [
    "navigation",
    "route",
    "summary",
    "modal",
  ]) {
    if (
      !(
        onboarding.includes(requiredExposureRule) &&
        setup.includes(requiredExposureRule) &&
        surfaces.includes(requiredExposureRule)
      )
    ) {
      failures.push(
        `skills/${directoryName} is missing full-surface environment gating: ${requiredExposureRule}`
      );
    }
  }
  if (
    !(
      onboarding.includes("standard not-found response") &&
      surfaces.includes("standard not-found response")
    )
  ) {
    failures.push(
      `skills/${directoryName} must leave hidden release-note routes unserved`
    );
  }
}
const releaseNoteLinkDistributions = [
  "simple-changelogs",
  "simple-changelogs-mobile",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
];
const releaseNoteLinkSnapshots = await Promise.all(
  releaseNoteLinkDistributions.map(async (directoryName) => {
    const referenceRoot = join(skillsRoot, directoryName, "references");
    const [automation, onboarding, setup, surfaces] = await Promise.all([
      readFile(join(referenceRoot, "automation-verification.md"), "utf8"),
      readFile(join(referenceRoot, "onboarding.md"), "utf8"),
      readFile(join(referenceRoot, "setup.md"), "utf8"),
      readFile(join(referenceRoot, "release-note-surfaces.md"), "utf8"),
    ]);
    return { automation, directoryName, onboarding, setup, surfaces };
  })
);
for (const snapshot of releaseNoteLinkSnapshots) {
  for (const requiredRule of [
    "releaseNoteLinks",
    "when-useful",
    "ask",
    "disabled",
  ]) {
    if (
      !(
        snapshot.onboarding.includes(requiredRule) &&
        snapshot.setup.includes(requiredRule) &&
        snapshot.surfaces.includes(requiredRule) &&
        snapshot.automation.includes(requiredRule)
      )
    ) {
      failures.push(
        `skills/${snapshot.directoryName} is missing contextual release-note link rule: ${requiredRule}`
      );
    }
  }
  if (!snapshot.onboarding.includes("```text")) {
    failures.push(
      `skills/${snapshot.directoryName} must diagram the contextual link choice during onboarding`
    );
  }
  if (
    !(
      snapshot.surfaces.includes("candidate") &&
      snapshot.surfaces.toLowerCase().includes("archive")
    )
  ) {
    failures.push(
      `skills/${snapshot.directoryName} must distinguish route candidates from structural archive navigation`
    );
  }
}
const surfaceDesignSnapshots = await Promise.all(
  surfaceDesignDistributions.map(async (directoryName) => {
    const [skill, design] = await Promise.all([
      readFile(join(skillsRoot, directoryName, "SKILL.md"), "utf8"),
      readFile(
        join(skillsRoot, directoryName, "references", "surface-design.md"),
        "utf8"
      ),
    ]);
    return { design, directoryName, skill };
  })
);
for (const { design, directoryName, skill } of surfaceDesignSnapshots) {
  for (const requiredRule of [
    "explicit user approval",
    "Component source",
    "Verification",
    "canonical history",
  ]) {
    if (!design.includes(requiredRule)) {
      failures.push(
        `skills/${directoryName}/references/surface-design.md is missing design rule: ${requiredRule}`
      );
    }
  }
  if (!skill.includes("`references/surface-design.md`")) {
    failures.push(
      `skills/${directoryName}/SKILL.md does not route authorized presentation work to surface-design.md`
    );
  }
}

// Required prose is asserted against whitespace-collapsed source so ordinary
// reflow across lines never fails a check.
const collapsed = (source: string): string =>
  source.replace(/\s+/gu, " ").trim();

const versionGuidanceSnapshots = await Promise.all(
  productVersionDistributions.map(async (directoryName) => {
    const referenceRoot = join(skillsRoot, directoryName, "references");
    const [surfaces, versions] = await Promise.all([
      readFile(join(referenceRoot, "release-note-surfaces.md"), "utf8"),
      readFile(join(referenceRoot, "version-decisions.md"), "utf8"),
    ]);
    return { directoryName, surfaces, versions };
  })
);
for (const { directoryName, surfaces, versions } of versionGuidanceSnapshots) {
  const versionProse = collapsed(versions);
  for (const requiredRule of [
    "Alignment means a proven relationship, not universal string equality",
    "proves shared source ownership, not a shared release train",
    "Never derive a public version or a SemVer bump from a build number",
    "leave public versions, build numbers, tags, and released headings unchanged",
    "crossSurfaceVersioning",
    "canonical release version",
  ]) {
    if (!versionProse.includes(collapsed(requiredRule))) {
      failures.push(
        `skills/${directoryName}/references/version-decisions.md is missing identifier-role rule: ${requiredRule}`
      );
    }
  }

  const surfaceProse = collapsed(surfaces);
  for (const requiredRule of [
    "identifier role",
    "release train",
    "presentation only",
  ]) {
    if (!surfaceProse.includes(collapsed(requiredRule))) {
      failures.push(
        `skills/${directoryName}/references/release-note-surfaces.md is missing version-identifier rule: ${requiredRule}`
      );
    }
  }
}

const storeCopyDistributions = [
  "simple-changelogs",
  "simple-changelogs-mobile",
];
const storeCopySnapshots = await Promise.all(
  storeCopyDistributions.map(async (directoryName) => ({
    directoryName,
    source: await readFile(
      join(skillsRoot, directoryName, "references", "release-note-surfaces.md"),
      "utf8"
    ),
  }))
);
for (const { directoryName, source } of storeCopySnapshots) {
  const prose = collapsed(source);
  for (const requiredRule of [
    "belongs to one submitted public version",
    "a store-note file is copy, never the version owner",
    "versionCode",
    "out of the copy",
  ]) {
    if (!prose.includes(collapsed(requiredRule))) {
      failures.push(
        `skills/${directoryName}/references/release-note-surfaces.md is missing public store-copy rule: ${requiredRule}`
      );
    }
  }
}

// The CMS-only distribution documents an entry-only handoff of its own: the
// same three phases on the `none` boundary, never a version, tag, or note.
const cmsReleaseHandoff = await readFile(
  join(skillsRoot, "simple-changelogs-cms", "references", "release-handoff.md"),
  "utf8"
);
const sharedReleaseHandoff = await readFile(
  join(skillsRoot, "simple-changelogs", "references", "release-handoff.md"),
  "utf8"
);
if (cmsReleaseHandoff === sharedReleaseHandoff) {
  failures.push(
    "skills/simple-changelogs-cms/references/release-handoff.md must describe the entry-only handoff, not the shared public-release copy"
  );
}
for (const requiredRule of [
  '`boundary: "none"`',
  "`cms-operators`",
  "`release: null`",
  "`CMS_CHANGELOG.json`",
  "never a version",
]) {
  if (!cmsReleaseHandoff.includes(requiredRule)) {
    failures.push(
      `skills/simple-changelogs-cms/references/release-handoff.md is missing entry-only handoff rule: ${requiredRule}`
    );
  }
}

// Shared version lines relate separately versioned release trains, which only
// the full distribution owns. Every package carries the byte-synced setup
// helper, but only full may route to or mention the policy in its guidance.
const SHARED_VERSION_LINES_REFERENCE = "references/shared-version-lines.md";
for (const {
  directory,
  directoryName,
  entries,
  source,
} of distributionSnapshots) {
  if (!changelogDistributions.has(directoryName)) {
    continue;
  }
  const full = directoryName === "simple-changelogs";
  if (full !== source.includes(SHARED_VERSION_LINES_REFERENCE)) {
    failures.push(
      full
        ? `skills/${directoryName}/SKILL.md does not route ${SHARED_VERSION_LINES_REFERENCE}`
        : `skills/${directoryName}/SKILL.md routes full-only ${SHARED_VERSION_LINES_REFERENCE}`
    );
  }
  const mentions = entries.filter(
    (entry) =>
      (entry.path === "SKILL.md" || entry.path.startsWith("references/")) &&
      readFileSync(join(directory, entry.path), "utf8").includes(
        "sharedVersionLines"
      )
  );
  if (!full && mentions.length > 0) {
    failures.push(
      `skills/${directoryName} documents full-only sharedVersionLines in ${mentions.map((entry) => entry.path).join(", ")}`
    );
  }
}

// Agents preview the first lines of a reference to decide whether to read on,
// so every long reference opens with a contents list naming each `##` heading
// in order.
const CONTENTS_LINE_THRESHOLD = 100;
const FENCE_PATTERN = /^\s*(```|~~~)/u;
const CONTENTS_BULLET_PATTERN = /^- (.+)$/u;

const outlineOf = (
  source: string
): { contents: string[]; headings: string[] } => {
  const headings: string[] = [];
  const contents: string[] = [];
  let fence: string | null = null;
  for (const line of source.split("\n")) {
    const marker = FENCE_PATTERN.exec(line)?.[1];
    if (marker) {
      if (fence === null) {
        fence = marker;
      } else if (marker === fence) {
        fence = null;
      }
    } else if (fence === null && line.startsWith("## ")) {
      headings.push(line.slice(3).trim());
    } else if (fence === null && headings.length === 1) {
      const bullet = CONTENTS_BULLET_PATTERN.exec(line)?.[1];
      if (bullet && headings[0] === "Contents") {
        contents.push(bullet.trim());
      }
    }
  }
  return { contents, headings };
};

for (const { directory, directoryName, entries } of distributionSnapshots) {
  if (!changelogDistributions.has(directoryName)) {
    continue;
  }
  for (const entry of entries) {
    if (!(entry.path.startsWith("references/") && entry.path.endsWith(".md"))) {
      continue;
    }
    const source = readFileSync(join(directory, entry.path), "utf8");
    const lineCount = source.split("\n").length - 1;
    const { contents, headings } = outlineOf(source);
    if (headings[0] !== "Contents") {
      if (lineCount > CONTENTS_LINE_THRESHOLD) {
        failures.push(
          `skills/${directoryName}/${entry.path} has ${lineCount} lines but does not open with a ## Contents list`
        );
      }
      continue;
    }
    if (contents.join("\n") !== headings.slice(1).join("\n")) {
      failures.push(
        `skills/${directoryName}/${entry.path} ## Contents must list its ## headings exactly and in order`
      );
    }
  }
}

const cmsPolicySchemas = await Promise.all(
  ["simple-changelogs-cms", "simple-changelogs-web-cms"].map(
    async (directoryName) => ({
      directoryName,
      source: await readFile(
        join(skillsRoot, directoryName, "schemas", "repo-policy.schema.json"),
        "utf8"
      ),
    })
  )
);
for (const { directoryName, source } of cmsPolicySchemas) {
  if (
    source.includes("crossSurfaceVersioning") ||
    source.includes("releaseNoteEnvironmentScope") ||
    source.includes("releaseNoteLinks") ||
    source.includes("releaseNoteGrouping") ||
    source.includes("majorReleaseNaming") ||
    source.includes("releaseTags") ||
    source.includes("sharedVersionLines")
  ) {
    failures.push(
      `skills/${directoryName}/schemas/repo-policy.schema.json must not carry repository-only app policy`
    );
  }
}

// Authoring preferences: every changelog distribution ships the same
// generic reference sections (the harness data file and both schemas are
// byte-synced through the sync-distros table), and SKILL.md keeps the
// preference-not-identity boundary.
const authoringChecks = await Promise.all(
  [...changelogDistributions].map(async (directoryName) => {
    const directory = join(skillsRoot, directoryName);
    const [skill, setup] = await Promise.all([
      readFile(join(directory, "SKILL.md"), "utf8"),
      readFile(join(directory, "references", "setup.md"), "utf8"),
    ]);
    return { directoryName, setup, skill };
  })
);
const sectionOf = (source: string, heading: string): string | null => {
  const start = source.indexOf(`\n## ${heading}\n`);
  if (start === -1) {
    return null;
  }
  const end = source.indexOf("\n## ", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
};
const canonicalAuthoring = {
  onboarding: sectionOf(
    onboardingChecks.find(
      (candidate) => candidate.directoryName === "simple-changelogs"
    )?.source ?? "",
    "Agents and models"
  ),
  setup: sectionOf(
    authoringChecks.find(
      (candidate) => candidate.directoryName === "simple-changelogs"
    )?.setup ?? "",
    "Authoring preferences"
  ),
};
for (const { directoryName, setup, skill } of authoringChecks) {
  const onboarding =
    onboardingChecks.find(
      (candidate) => candidate.directoryName === directoryName
    )?.source ?? "";
  const sections = {
    onboarding: sectionOf(onboarding, "Agents and models"),
    setup: sectionOf(setup, "Authoring preferences"),
  };
  for (const [name, section] of Object.entries(sections)) {
    if (
      section === null ||
      section !== canonicalAuthoring[name as keyof typeof sections]
    ) {
      failures.push(
        `skills/${directoryName} must carry the shared authoring ${name} section, identical to the full distribution's`
      );
    }
  }
  if (
    !(
      sections.onboarding?.includes("Never pre-select `max`") &&
      sections.onboarding.includes("at xhigh effort (Recommended)")
    )
  ) {
    failures.push(
      `skills/${directoryName}/references/onboarding.md must recommend xhigh and never pre-select max`
    );
  }
  if (!collapsed(skill).includes("never authority and never identity")) {
    failures.push(
      `skills/${directoryName}/SKILL.md must state that an authoring model is a preference, never authority and never identity`
    );
  }
}

// Byte-synced copies (the setup, handoff, query, and CMS helpers, the
// minified protocol schemas, the shared references, and every bundled fork
// checker, which check-fork-sync.check.ts exercises) come from the table `bun
// run sync-distros` writes, so the check and the writer cannot disagree.
for (const { expected, source, target } of await syncedFiles(repositoryRoot)) {
  const path = join(repositoryRoot, target);
  if (!existsSync(path)) {
    failures.push(
      `${target} is missing; run bun run sync-distros to copy it from ${source}`
    );
  } else if (!holdsBytes(readFileSync(path), expected)) {
    failures.push(
      `${target} is out of sync with ${source}; run bun run sync-distros`
    );
  }
}

// Every fork-maintenance reference matches the full copy apart from the
// distribution's own name in its pin example and checker paths.
const FORK_CHECKER = "scripts/check-fork-sync.sh";
const FORK_MAINTENANCE = "references/fork-maintenance.md";
const withoutDistributionName = (source: string, name: string): string =>
  source
    .replaceAll(`\`${name}\``, "`<distribution>`")
    .replaceAll(`/${name}\``, "/<distribution>`")
    .replaceAll(`/${name}/`, "/<distribution>/");
const canonicalForkMaintenance = withoutDistributionName(
  readFileSync(join(skillsRoot, "simple-changelogs", FORK_MAINTENANCE), "utf8"),
  "simple-changelogs"
);
for (const { directory, directoryName, entries } of distributionSnapshots) {
  if (!entries.some((entry) => entry.path === FORK_CHECKER)) {
    continue;
  }
  const maintenancePath = join(directory, FORK_MAINTENANCE);
  if (
    !existsSync(maintenancePath) ||
    withoutDistributionName(
      readFileSync(maintenancePath, "utf8"),
      directoryName
    ) !== canonicalForkMaintenance
  ) {
    failures.push(
      `skills/${directoryName}/${FORK_MAINTENANCE} diverges from the full copy beyond its distribution name`
    );
  }
}

// Web+CMS records its CMS policy on a second guidance track. The SKILL.md
// declaration, the CMS-track update notes, and the policy example must all
// match the setup helper's constant.
const webCmsCmsGuidance = /const WEB_CMS_CMS_GUIDANCE_VERSION = (\d+);/u.exec(
  canonicalSetupHelper
)?.[1];
const [webCmsSkill, webCmsGuidanceNotes, webCmsSetup] = await Promise.all(
  ["SKILL.md", "references/guidance-updates.md", "references/cms-setup.md"].map(
    (filename) =>
      readFile(join(skillsRoot, "simple-changelogs-web-cms", filename), "utf8")
  )
);
if (
  !webCmsCmsGuidance ||
  /Current CMS guidance version: (\d+)/u.exec(webCmsSkill ?? "")?.[1] !==
    webCmsCmsGuidance
) {
  failures.push(
    `skills/simple-changelogs-web-cms/SKILL.md must declare Current CMS guidance version: ${String(webCmsCmsGuidance)} (WEB_CMS_CMS_GUIDANCE_VERSION in setup.ts)`
  );
}
if (
  !webCmsGuidanceNotes?.includes(
    `simple-changelogs-cms-guidance-update version="${String(webCmsCmsGuidance)}"`
  )
) {
  failures.push(
    `skills/simple-changelogs-web-cms CMS guidance ${String(webCmsCmsGuidance)} lacks CMS-track update-notice metadata`
  );
}
const webCmsPolicyExample =
  /<!-- simple-changelogs-cms-policy-example -->\s*```json\n([\s\S]*?)\n```/u.exec(
    webCmsSetup ?? ""
  )?.[1];
if (
  String(
    (
      JSON.parse(webCmsPolicyExample ?? "{}") as {
        guidance?: { version?: unknown };
      }
    ).guidance?.version
  ) !== webCmsCmsGuidance
) {
  failures.push(
    `skills/simple-changelogs-web-cms/references/cms-setup.md policy example must record CMS guidance ${String(webCmsCmsGuidance)}`
  );
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
