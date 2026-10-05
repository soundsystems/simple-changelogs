#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { YAML } from "bun";
import { evaluateContracts } from "./simple-changelogs/scripts/lib/contracts.ts";

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
const MAX_GUIDANCE_BYTES = 224 * 1024;
const MAX_SUPPORT_BYTES = 256 * 1024;
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
// Distributions that take the Simple Changes release handoff: they vendor the
// pinned protocol schemas, route delegated requests, and advertise request and
// receipt versions in their marker. The CMS-only distribution takes an
// entry-only handoff for its version-less operator history, so it ships the
// schemas and its own release-handoff reference without the Markdown query
// helpers or the shared public-release copy.
const releaseHandoffDistributions = new Set([
  ...portableContractDistributions,
  "simple-changelogs-cms",
]);
const forbiddenNames = new Set(["EVAL.md"]);
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
const canonicalQueryFiles = new Map(
  await Promise.all(
    ["query.ts", "lib/changelog-parse.ts"].map(
      async (filename) =>
        [
          filename,
          await readFile(
            join(toolingRoot, "simple-changelogs", "scripts", filename),
            "utf8"
          ),
        ] as const
    )
  )
);
const canonicalProtocolFiles = new Map(
  await Promise.all(
    [
      "changelog-request.schema.json",
      "changelog-receipt.schema.json",
      "changelog-capabilities.schema.json",
      "protocol-provenance.json",
    ].map(
      async (filename) =>
        [
          filename,
          await readFile(
            join(
              toolingRoot,
              "simple-changelogs",
              "evals",
              "schemas",
              filename
            ),
            "utf8"
          ),
        ] as const
    )
  )
);

// protocol-provenance.json describes the Simple Changes protocol; each
// distribution's marker advertises only the subset it supports.
const protocolProvenance = JSON.parse(
  canonicalProtocolFiles.get("protocol-provenance.json") ?? "{}"
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
    const setupPath = join(directory, "scripts", "setup.ts");
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
    const setupSource =
      changelogDistributions.has(directoryName) && existsSync(setupPath)
        ? await readFile(setupPath, "utf8")
        : null;
    return {
      backfillSource,
      directory,
      directoryName,
      entries,
      guidanceSource,
      onboardingSource,
      setupSource,
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
  const guidanceBytes = entries
    .filter((entry) => entry.path.endsWith(".md"))
    .reduce((sum, entry) => sum + entry.bytes, 0);
  const supportBytes = entries
    .filter((entry) => !entry.path.endsWith(".md"))
    .reduce((sum, entry) => sum + entry.bytes, 0);
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
    "disable-model-invocation"?: unknown;
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
    const setupPath = join(directory, "scripts", "setup.ts");
    if (!existsSync(setupPath)) {
      failures.push(`skills/${directoryName} is missing scripts/setup.ts`);
    } else if (setupSource !== canonicalSetupHelper) {
      failures.push(
        `skills/${directoryName}/scripts/setup.ts is out of sync with maintainer tooling`
      );
    }

    if (releaseHandoffDistributions.has(directoryName)) {
      for (const [filename, canonical] of canonicalProtocolFiles) {
        const protocolPath = join(directory, "schemas", filename);
        if (!existsSync(protocolPath)) {
          failures.push(
            `skills/${directoryName} is missing pinned protocol schema ${filename}`
          );
        } else if (readFileSync(protocolPath, "utf8") !== canonical) {
          failures.push(
            `skills/${directoryName}/schemas/${filename} diverges from the pinned producer fixture`
          );
        }
      }
      if (!source.includes("references/release-handoff.md")) {
        failures.push(
          `skills/${directoryName}/SKILL.md does not route delegated release handoffs`
        );
      }
    }

    if (portableContractDistributions.has(directoryName)) {
      for (const [filename, canonical] of canonicalQueryFiles) {
        const queryPath = join(directory, "scripts", filename);
        if (!existsSync(queryPath)) {
          failures.push(
            `skills/${directoryName} is missing bundled query helper scripts/${filename}`
          );
        } else if (readFileSync(queryPath, "utf8") !== canonical) {
          failures.push(
            `skills/${directoryName}/scripts/${filename} is out of sync with maintainer tooling`
          );
        }
      }
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

const productVersionDistributions = [
  "simple-changelogs",
  "simple-changelogs-mobile",
  "simple-changelogs-web",
  "simple-changelogs-web-cms",
];
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
const canonicalVersionGuidance = versionGuidanceSnapshots[0]?.versions;
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
  if (versions !== canonicalVersionGuidance) {
    failures.push(
      `skills/${directoryName}/references/version-decisions.md diverges from the shared product copy`
    );
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

const releaseHandoffCopies = await Promise.all(
  [...portableContractDistributions]
    .sort(compareText)
    .map(async (directoryName) => ({
      directoryName,
      source: await readFile(
        join(skillsRoot, directoryName, "references", "release-handoff.md"),
        "utf8"
      ),
    }))
);
const [canonicalReleaseHandoff, ...otherReleaseHandoffs] = releaseHandoffCopies;
for (const { directoryName, source } of otherReleaseHandoffs) {
  if (source !== canonicalReleaseHandoff?.source) {
    failures.push(
      `skills/${directoryName}/references/release-handoff.md diverges from the shared release-handoff reference`
    );
  }
}

// The CMS-only distribution documents an entry-only handoff of its own: the
// same three phases on the `none` boundary, never a version, tag, or note.
const cmsReleaseHandoff = await readFile(
  join(skillsRoot, "simple-changelogs-cms", "references", "release-handoff.md"),
  "utf8"
);
if (cmsReleaseHandoff === canonicalReleaseHandoff?.source) {
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
// in order. guidance-updates.md is exempt: the setup helper addresses its
// numbered `## Guidance N` sections by version.
const CONTENTS_LINE_THRESHOLD = 100;
const CONTENTS_EXEMPT_REFERENCES = new Set(["references/guidance-updates.md"]);
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
    if (
      !(entry.path.startsWith("references/") && entry.path.endsWith(".md")) ||
      CONTENTS_EXEMPT_REFERENCES.has(entry.path)
    ) {
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
const [canonicalCmsSchema, ...otherCmsSchemas] = cmsPolicySchemas;
for (const { directoryName, source } of otherCmsSchemas) {
  if (source !== canonicalCmsSchema?.source) {
    failures.push(
      `skills/${directoryName}/schemas/repo-policy.schema.json diverges from the shared bundled CMS policy schema`
    );
  }
}
for (const { directoryName, source } of cmsPolicySchemas) {
  if (
    source.includes("crossSurfaceVersioning") ||
    source.includes("releaseNoteEnvironmentScope") ||
    source.includes("releaseNoteLinks") ||
    source.includes("releaseNoteGrouping") ||
    source.includes("majorReleaseNaming") ||
    source.includes("sharedVersionLines")
  ) {
    failures.push(
      `skills/${directoryName}/schemas/repo-policy.schema.json must not carry repository-only app policy`
    );
  }
}

// The Web+CMS package ships copies of the CMS-only validator and data schema.
// Nothing else catches a drifted copy, such as one with a curation rule removed.
for (const [canonical, copy] of [
  [
    "simple-changelogs-cms/scripts/lib/schema.ts",
    "simple-changelogs-web-cms/scripts/lib/cms-schema.ts",
  ],
  [
    "simple-changelogs-cms/schemas/cms-changelog.schema.json",
    "simple-changelogs-web-cms/schemas/cms-changelog.schema.json",
  ],
] as const) {
  if (
    readFileSync(join(skillsRoot, copy), "utf8") !==
    readFileSync(join(skillsRoot, canonical), "utf8")
  ) {
    failures.push(`skills/${copy} diverges from skills/${canonical}`);
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
