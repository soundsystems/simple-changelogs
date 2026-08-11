import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "bun";
import { digestCanonicalJson } from "../lib/release-handoff.ts";
import {
  applySetup,
  guidanceBackfillRecommendationFor,
  inspectRepository,
  parseGuidanceUpdateChanges,
  resolveGlobalPreferencesPath,
  validateGlobalPreferences,
} from "../setup.ts";

const temporaryPaths: string[] = [];

const temporaryDirectory = async (label: string): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), `simple-changelogs-${label}-`));
  temporaryPaths.push(path);
  return path;
};

const fixture = async (): Promise<{ config: string; repo: string }> => ({
  config: await temporaryDirectory("config"),
  repo: await temporaryDirectory("repo"),
});

const readJson = async (path: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const recommendedOptions = (repo: string, configDirectory: string) => ({
  backfillStatus: "not-applicable" as const,
  configDirectory,
  confirm: true,
  distribution: "web" as const,
  repo,
  scope: "repository" as const,
});

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true }))
  );
});

describe("setup inspection", () => {
  test("classifies intervening guidance metadata and keeps the strongest backfill recommendation", () => {
    const changes = parseGuidanceUpdateChanges(
      [
        '<!-- simple-changelogs-guidance-update version="2" kinds="maintenance" backfill="not-needed" summary="Quiet maintenance." -->',
        '<!-- simple-changelogs-guidance-update version="3" kinds="capability,onboarding" backfill="optional" summary="New setup choice." -->',
        '<!-- simple-changelogs-guidance-update version="4" kinds="behavior" backfill="recommended" summary="Historical wording can improve." -->',
      ].join("\n"),
      1,
      4
    );

    expect(changes.map((change) => change.version)).toEqual([2, 3, 4]);
    expect(changes[1]?.kinds).toEqual(["capability", "onboarding"]);
    expect(guidanceBackfillRecommendationFor(changes)).toBe("recommended");
  });

  test("surfaces a material installed update and records its no-backfill disposition once", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, ".simple-changelogs.json"), {
      developerChangelog: "required",
      distribution: "web",
      guidance: { backfillStatus: "completed", version: 14 },
      newReleaseNoteSurfaces: "ask",
      publicVersioning: {
        major: "ask",
        minor: "ask",
        patch: "ask",
        suggestWhenAsking: true,
      },
      schemaVersion: 1,
      signatures: "agent-and-timestamp",
    });

    const inspection = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
      taskMode: "write",
    });

    expect(inspection.guidanceUpdate).toMatchObject({
      backfillRecommendation: "not-needed",
      currentVersion: 15,
      recordedVersion: 14,
      releaseNotesPath: "references/guidance-updates.md",
      userPrompt: null,
    });
    expect(inspection.guidanceUpdate?.changes[0]).toMatchObject({
      kinds: ["capability", "behavior", "onboarding"],
      version: 15,
    });

    const rejected = await applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "web",
      guidanceBackfill: "partial",
      repo,
    });
    expect(rejected.status).toBe("blocked");

    const recorded = await applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "web",
      guidanceBackfill: "not-applicable",
      repo,
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));
    const after = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
      taskMode: "write",
    });

    expect(recorded.status).toBe("configured");
    expect(recorded.guidanceUpdate).toBeNull();
    expect(policy.guidance).toEqual({
      backfillStatus: "not-applicable",
      version: 15,
    });
    expect(after.guidanceUpdate).toBeNull();
  });

  test("reports closed read-only capabilities and the safe missing-field version policy", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, ".simple-changelogs.json"), {
      developerChangelog: "required",
      distribution: "web",
      guidance: { backfillStatus: "completed", version: 13 },
      newReleaseNoteSurfaces: "ask",
      schemaVersion: 1,
      signatures: "agent-and-timestamp",
    });

    const result = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
      taskMode: "read",
    });

    expect(result.publicVersioning).toEqual({
      effective: {
        major: "ask",
        minor: "ask",
        patch: "ask",
        suggestWhenAsking: true,
      },
      recommended: {
        major: "ask",
        minor: "ask",
        patch: "ask",
        suggestWhenAsking: true,
      },
      selected: null,
      source: "missing-field-default",
      stored: null,
    });
    expect(result.capabilities?.features).toEqual([
      "public-version-policy",
      "classify-prepare-verify",
      "multi-train-receipts",
    ]);
    const requestSchema = JSON.parse(
      await readFile(
        join(
          import.meta.dir,
          "../../evals/schemas/changelog-request.schema.json"
        ),
        "utf8"
      )
    ) as unknown;
    const receiptSchema = JSON.parse(
      await readFile(
        join(
          import.meta.dir,
          "../../evals/schemas/changelog-receipt.schema.json"
        ),
        "utf8"
      )
    ) as unknown;
    expect(result.capabilities?.schemaDigests).toEqual({
      changelogReceipt: digestCanonicalJson(receiptSchema),
      changelogRequest: digestCanonicalJson(requestSchema),
    });
    expect(result.onboardingContribution).toBeNull();
    expect(result.writes).toEqual([]);
  });

  test("enters onboarding only for a write-capable task with missing policy", async () => {
    const { config, repo } = await fixture();

    const writeInspection = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
      taskMode: "write",
    });
    const readInspection = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
      taskMode: "read",
    });

    expect(writeInspection.onboardingRequired).toBe(true);
    expect(writeInspection.status).toBe("needs-input");
    expect(readInspection.onboardingRequired).toBe(false);
    expect(readInspection.status).toBe("ready");
    expect(readInspection.writes).toEqual([]);
  });

  test("offers released history last and defaults confirmed setup to a backfill", async () => {
    const { config, repo } = await fixture();
    await writeFile(
      join(repo, "CHANGELOG.md"),
      "# Changelog\n\n## 1.0.0\n\n- Shipped.\n",
      "utf8"
    );

    const inspection = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
    });
    const result = await applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "web",
      repo,
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));

    expect(inspection.inventory.releasedHistoryCount).toBe(1);
    expect(inspection.unresolvedQuestions).toEqual([
      "release-note-surface-offer",
      "release-note-surface-components",
      "preference-scope",
      "released-history-audit",
    ]);
    expect(inspection.unresolvedQuestions.at(-1)).toBe(
      "released-history-audit"
    );
    expect(result.status).toBe("configured");
    expect(result.selection.backfillStatus).toBe("partial");
    expect((policy.guidance as Record<string, unknown>).backfillStatus).toBe(
      "partial"
    );
  });

  test("valid repository policy suppresses repeat onboarding and wins over global defaults", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(config, "preferences.json"), {
      developerChangelog: "required",
      newReleaseNoteSurfaces: "allow",
      profile: "solo-developer",
      schemaVersion: 1,
      setupStyle: "recommended",
      signatures: "agent-and-timestamp",
    });
    await writeJson(join(repo, ".simple-changelogs.json"), {
      developerChangelog: "optional",
      distribution: "web",
      guidance: { backfillStatus: "declined", version: 4 },
      newReleaseNoteSurfaces: "existing-only",
      schemaVersion: 1,
      signatures: "none",
    });

    const result = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
    });

    expect(result.status).toBe("already-configured");
    expect(result.onboardingRequired).toBe(false);
    expect(result.recommendation.policy?.developerChangelog).toBe("optional");
    expect(result.recommendation.policy?.newReleaseNoteSurfaces).toBe(
      "existing-only"
    );
  });

  test("summarizes concrete project-type evidence before asking", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, "package.json"), {
      dependencies: { next: "16.0.0", react: "20.0.0" },
      name: "web-product",
    });

    const result = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
    });

    expect(result.detection.evidence).toContain(
      "Package metadata indicates a web application"
    );
  });

  test("separates editorial update candidates from release-note-named candidates", async () => {
    const { config, repo } = await fixture();
    await mkdir(join(repo, "src", "routes"), { recursive: true });
    await writeFile(
      join(repo, "src", "routes", "updates.tsx"),
      "export const Updates = () => 'Editorial product stories';\n",
      "utf8"
    );
    await writeFile(
      join(repo, "src", "routes", "release-notes.tsx"),
      "export const ReleaseNotes = () => 'Version history';\n",
      "utf8"
    );

    const result = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
    });

    expect(result.inventory.adjacentDestinations).toEqual([
      "src/routes/updates.tsx",
    ]);
    expect(result.inventory.destinations).toEqual([
      "src/routes/release-notes.tsx",
    ]);
    expect(result.unresolvedQuestions).toContain(
      "release-note-destination-verification"
    );
    expect(result.detection.evidence).toContain(
      "1 updates, news, blog, or announcement destination candidate(s) found"
    );
    expect(result.detection.evidence).toContain(
      "1 release-note-named destination candidate(s) found"
    );
  });

  test("asks for component guidance when React has utility CSS but no design system", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, "package.json"), {
      dependencies: { react: "19.0.0", tailwindcss: "4.0.0" },
    });

    const result = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
    });

    expect(result.inventory.designSystemEvidence).toEqual([]);
    expect(result.detection.evidence).toContain("Utility CSS is present");
    expect(result.detection.evidence).toContain(
      "Package metadata indicates a React component model"
    );
    expect(result.unresolvedQuestions).toContain(
      "release-note-surface-components"
    );
  });

  test("detects established component libraries and raw Radix primitives separately", async () => {
    const established = await fixture();
    await writeJson(join(established.repo, "package.json"), {
      dependencies: { "@mui/material": "7.0.0", react: "19.0.0" },
    });
    const establishedResult = await inspectRepository({
      configDirectory: established.config,
      distribution: "web",
      repo: established.repo,
    });

    expect(establishedResult.inventory.designSystemEvidence).toEqual([
      "Component library dependency: @mui/material",
    ]);
    expect(establishedResult.unresolvedQuestions).not.toContain(
      "release-note-surface-components"
    );

    const radix = await fixture();
    await writeJson(join(radix.repo, "package.json"), {
      dependencies: { "@radix-ui/react-dialog": "1.0.0", react: "19.0.0" },
    });
    const radixResult = await inspectRepository({
      configDirectory: radix.config,
      distribution: "web",
      repo: radix.repo,
    });

    expect(radixResult.inventory.designSystemEvidence).toEqual([]);
    expect(radixResult.detection.evidence).toContain(
      "Unstyled Radix component primitives are present"
    );
    expect(radixResult.unresolvedQuestions).toContain(
      "release-note-surface-components"
    );
  });

  test("offers a surface only where a distribution can own one", async () => {
    const product = await fixture();
    const productResult = await inspectRepository({
      configDirectory: product.config,
      distribution: "mobile",
      repo: product.repo,
    });

    expect(productResult.unresolvedQuestions).toContain(
      "release-note-surface-offer"
    );

    const cms = await fixture();
    const cmsResult = await inspectRepository({
      configDirectory: cms.config,
      distribution: "cms",
      repo: cms.repo,
    });

    expect(cmsResult.unresolvedQuestions).toContain(
      "release-note-surface-offer"
    );

    const skill = await fixture();
    const skillResult = await inspectRepository({
      configDirectory: skill.config,
      distribution: "skill-repository",
      repo: skill.repo,
    });

    expect(skillResult.unresolvedQuestions).not.toContain(
      "release-note-surface-offer"
    );
    expect(skillResult.unresolvedQuestions).not.toContain(
      "release-note-surface-components"
    );
  });

  test("keeps the mobile placement requirement pinned to guidance version 6", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, ".simple-changelogs.json"), {
      developerChangelog: "required",
      distribution: "full",
      guidance: { backfillStatus: "not-applicable", version: 6 },
      newReleaseNoteSurfaces: "ask",
      schemaVersion: 1,
      signatures: "agent-and-timestamp",
    });

    const result = await inspectRepository({
      configDirectory: config,
      distribution: "full",
      repo,
    });

    expect(result.policy?.state).toBe("malformed");
    expect(result.errors.join(" ")).toContain(
      "mobileReleaseNotePlacement is required"
    );
  });
});

describe("setup application", () => {
  test("requires complete granular version flags and stores the resolved policy", async () => {
    const partial = await fixture();
    const blocked = await applySetup({
      ...recommendedOptions(partial.repo, partial.config),
      publicVersionPatch: "automatic",
    });
    expect(blocked.status).toBe("blocked");
    expect(blocked.errors.join(" ")).toContain("requires --version-patch");

    const custom = await fixture();
    const configured = await applySetup({
      ...recommendedOptions(custom.repo, custom.config),
      publicVersionMajor: "ask",
      publicVersionMinor: "automatic",
      publicVersionPatch: "automatic",
      publicVersionSuggestions: "off",
    });
    const policy = await readJson(join(custom.repo, ".simple-changelogs.json"));
    expect(configured.status).toBe("configured");
    expect(policy.publicVersioning).toEqual({
      major: "ask",
      minor: "automatic",
      patch: "automatic",
      suggestWhenAsking: false,
    });
    expect(configured.publicVersioning?.source).toBe("repository-policy");
    expect(configured.ownerWriteReceipt).toMatchObject({
      destination: ".simple-changelogs.json",
      owner: "simple-changelogs",
      status: "completed",
      written: true,
    });
  });

  test("does not activate automatic global preferences before confirmation", async () => {
    const { config, repo } = await fixture();
    await mkdir(config, { recursive: true });
    await writeJson(join(config, "preferences.json"), {
      developerChangelog: "required",
      newReleaseNoteSurfaces: "ask",
      profile: "solo-developer",
      publicVersioning: {
        major: "automatic",
        minor: "automatic",
        patch: "automatic",
        suggestWhenAsking: true,
      },
      schemaVersion: 1,
      setupStyle: "recommended",
      signatures: "agent-and-timestamp",
    });

    const result = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
      taskMode: "write",
    });
    expect(result.recommendation.policy?.publicVersioning?.patch).toBe(
      "automatic"
    );
    expect(result.onboardingContribution).toMatchObject({
      destination: ".simple-changelogs.json",
      owner: "simple-changelogs",
      questions: [{ id: "public-version-actions", required: true }],
      resolvedPolicy: {
        major: "automatic",
        minor: "automatic",
        patch: "automatic",
      },
    });
    expect(result.publicVersioning?.effective.patch).toBe("ask");
    expect(result.publicVersioning?.source).toBe("missing-field-default");
  });

  test("requires mobile placement and records each distribution's current guidance", async () => {
    const full = await fixture();
    const fullOptions = {
      backfillStatus: "not-applicable" as const,
      configDirectory: full.config,
      confirm: true,
      distribution: "full" as const,
      repo: full.repo,
      scope: "repository" as const,
    };

    const blocked = await applySetup(fullOptions);
    const configured = await applySetup({
      ...fullOptions,
      mobileReleaseNotePlacement: "web-tabs",
    });
    const fullPolicy = await readJson(
      join(full.repo, ".simple-changelogs.json")
    );

    expect(blocked.status).toBe("blocked");
    expect(blocked.errors.join(" ")).toContain("--mobile-placement");
    expect(configured.status).toBe("configured");
    expect(fullPolicy.mobileReleaseNotePlacement).toBe("web-tabs");
    expect((fullPolicy.guidance as Record<string, unknown>).version).toBe(16);

    const distributionVersions = [
      ["web", 15],
      ["mobile", 14],
      ["web-cms", 15],
      ["skill-repository", 8],
    ] as const;
    const versions = await Promise.all(
      distributionVersions.map(async ([distribution]) => {
        const current = await fixture();
        const result = await applySetup({
          backfillStatus: "not-applicable",
          cmsAuthProven: distribution === "web-cms",
          cmsRoute: distribution === "web-cms" ? "/admin/changelog" : undefined,
          cmsSurfaceProven: distribution === "web-cms",
          configDirectory: current.config,
          confirm: true,
          distribution,
          repo: current.repo,
          scope: "repository",
        });
        const policy = await readJson(
          join(current.repo, ".simple-changelogs.json")
        );
        return {
          distribution,
          status: result.status,
          version: (policy.guidance as Record<string, unknown>).version,
        };
      })
    );

    expect(versions).toEqual(
      distributionVersions.map(([distribution, version]) => ({
        distribution,
        status: "configured",
        version,
      }))
    );
  });

  test("maps customized choices, creates only selected histories, and is idempotent", async () => {
    const { config, repo } = await fixture();
    const options = {
      ...recommendedOptions(repo, config),
      developerChangelog: "optional" as const,
      newReleaseNoteSurfaces: "existing-only" as const,
      setupStyle: "customized" as const,
      signatures: "none" as const,
    };

    const first = await applySetup(options);
    const firstChangelog = await readFile(join(repo, "CHANGELOG.md"), "utf8");
    const second = await applySetup(options);

    expect(first.status).toBe("configured");
    expect(first.selection).toMatchObject({
      backfillStatus: "not-applicable",
      developerChangelog: "optional",
      newReleaseNoteSurfaces: "existing-only",
      publicVersioning: {
        major: "ask",
        minor: "ask",
        patch: "ask",
        suggestWhenAsking: true,
      },
      scope: "repository",
      setupStyle: "customized",
      signatures: "none",
    });
    expect(existsSync(join(repo, "DEVELOPER_CHANGELOG.md"))).toBe(false);
    expect(second.status).toBe("already-configured");
    expect(await readFile(join(repo, "CHANGELOG.md"), "utf8")).toBe(
      firstChangelog
    );
  });

  test("records an explicit component source and defaults detected systems to project components", async () => {
    const explicit = await fixture();
    const explicitResult = await applySetup({
      ...recommendedOptions(explicit.repo, explicit.config),
      newReleaseNoteSurfaceComponents: "recommended-web-components",
    });
    const explicitPolicy = await readJson(
      join(explicit.repo, ".simple-changelogs.json")
    );

    expect(explicitResult.status).toBe("configured");
    expect(explicitResult.selection.newReleaseNoteSurfaceComponents).toBe(
      "recommended-web-components"
    );
    expect(explicitPolicy.newReleaseNoteSurfaceComponents).toBe(
      "recommended-web-components"
    );

    const detected = await fixture();
    await writeJson(join(detected.repo, "package.json"), {
      dependencies: { "@mantine/core": "8.0.0", react: "19.0.0" },
    });
    const detectedResult = await applySetup(
      recommendedOptions(detected.repo, detected.config)
    );
    const detectedPolicy = await readJson(
      join(detected.repo, ".simple-changelogs.json")
    );

    expect(detectedResult.selection.newReleaseNoteSurfaceComponents).toBe(
      "project-components"
    );
    expect(detectedPolicy.newReleaseNoteSurfaceComponents).toBe(
      "project-components"
    );
  });

  test("run-only scope writes no policy, preferences, or histories", async () => {
    const { config, repo } = await fixture();

    const result = await applySetup({
      backfillStatus: "not-applicable",
      configDirectory: config,
      distribution: "mobile",
      repo,
      scope: "run-only",
    });

    expect(result.status).toBe("run-only");
    expect(result.writes).toEqual([]);
    expect(await readdir(repo)).toEqual([]);
    expect(await readdir(config)).toEqual([]);
  });

  test("all-projects scope stores only closed reusable defaults with private permissions", async () => {
    const { config, repo } = await fixture();

    const result = await applySetup({
      ...recommendedOptions(repo, config),
      developerChangelog: "optional",
      newReleaseNoteSurfaces: "existing-only",
      scope: "all-projects",
      setupStyle: "customized",
      signatures: "none",
    });
    const path = resolveGlobalPreferencesPath(config);
    const preferences = await readJson(path);
    const mode = (await lstat(path)).mode % 0o1000;

    expect(result.status).toBe("configured");
    expect(validateGlobalPreferences(preferences).errors).toEqual([]);
    expect(Object.keys(preferences).sort()).toEqual([
      "developerChangelog",
      "newReleaseNoteSurfaces",
      "profile",
      "publicVersioning",
      "schemaVersion",
      "setupStyle",
      "signatures",
    ]);
    expect(JSON.stringify(preferences)).not.toContain(repo);
    expect(mode).toBe(0o600);
  });

  test("malformed global state is preserved and blocks only all-projects scope", async () => {
    const { config, repo } = await fixture();
    const path = join(config, "preferences.json");
    await writeJson(path, { repository: repo, schemaVersion: 1 });
    const before = await readFile(path, "utf8");

    const blocked = await applySetup({
      ...recommendedOptions(repo, config),
      scope: "all-projects",
    });
    const repositoryOnly = await applySetup({
      ...recommendedOptions(repo, config),
      scope: "repository",
    });

    expect(blocked.status).toBe("blocked");
    expect(repositoryOnly.status).toBe("configured");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("malformed and symbolic-link repository policy targets are preserved", async () => {
    const malformed = await fixture();
    const malformedPath = join(malformed.repo, ".simple-changelogs.json");
    await writeFile(malformedPath, "{ broken", "utf8");
    const malformedBefore = await readFile(malformedPath, "utf8");
    const malformedResult = await applySetup(
      recommendedOptions(malformed.repo, malformed.config)
    );

    const linked = await fixture();
    const outside = join(linked.config, "outside.json");
    await writeFile(outside, "outside\n", "utf8");
    await symlink(outside, join(linked.repo, ".simple-changelogs.json"));
    const linkedResult = await applySetup(
      recommendedOptions(linked.repo, linked.config)
    );

    expect(malformedResult.status).toBe("blocked");
    expect(await readFile(malformedPath, "utf8")).toBe(malformedBefore);
    expect(linkedResult.status).toBe("blocked");
    expect(await readFile(outside, "utf8")).toBe("outside\n");
  });

  test("records audit-now as partial and requires verification before completion", async () => {
    const { config, repo } = await fixture();
    await writeFile(
      join(repo, "CHANGELOG.md"),
      "# Changelog\n\n## 1.0.0\n\n- Shipped.\n",
      "utf8"
    );
    const partial = await applySetup({
      ...recommendedOptions(repo, config),
      backfillStatus: "partial",
    });
    const unverified = await applySetup({
      backfillStatus: "completed",
      configDirectory: config,
      confirm: true,
      distribution: "web",
      repo,
    });
    const statusAfterUnverified = (
      (await readJson(join(repo, ".simple-changelogs.json")))
        .guidance as Record<string, unknown>
    ).backfillStatus;
    const completed = await applySetup({
      auditVerified: true,
      backfillStatus: "completed",
      configDirectory: config,
      confirm: true,
      distribution: "web",
      repo,
    });

    expect(partial.status).toBe("configured");
    expect(unverified.status).toBe("blocked");
    expect(statusAfterUnverified).toBe("partial");
    expect(
      (
        (await readJson(join(repo, ".simple-changelogs.json")))
          .guidance as Record<string, unknown>
      ).backfillStatus
    ).toBe("completed");
    expect(completed.status).toBe("configured");
  });

  test("persists an explicit cross-surface versioning answer", async () => {
    const { config, repo } = await fixture();

    const result = await applySetup({
      ...recommendedOptions(repo, config),
      crossSurfaceVersioning: "independent",
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));

    expect(result.status).toBe("configured");
    expect(result.selection.crossSurfaceVersioning).toBe("independent");
    expect(policy.crossSurfaceVersioning).toBe("independent");
  });

  test("omits cross-surface versioning when no answer is supplied", async () => {
    const { config, repo } = await fixture();

    const result = await applySetup(recommendedOptions(repo, config));
    const policy = await readJson(join(repo, ".simple-changelogs.json"));

    expect(result.status).toBe("configured");
    expect(Object.hasOwn(policy, "crossSurfaceVersioning")).toBe(false);
  });

  test("records a relationship answer against valid policy without disturbing other values", async () => {
    const { config, repo } = await fixture();
    const stored = {
      developerChangelog: "optional" as const,
      distribution: "full" as const,
      guidance: { backfillStatus: "declined" as const, version: 8 },
      mobileReleaseNotePlacement: "web-tabs" as const,
      newReleaseNoteSurfaceComponents: "recommended-web-radix" as const,
      newReleaseNoteSurfaces: "existing-only" as const,
      schemaVersion: 1 as const,
      signatures: "none" as const,
    };
    await writeJson(join(repo, ".simple-changelogs.json"), stored);

    const blocked = await applySetup({
      configDirectory: config,
      crossSurfaceVersioning: "mixed",
      distribution: "full",
      repo,
    });
    const updated = await applySetup({
      configDirectory: config,
      confirm: true,
      crossSurfaceVersioning: "mixed",
      distribution: "full",
      repo,
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));

    expect(blocked.status).toBe("blocked");
    expect(blocked.errors.join(" ")).toContain("Confirmation is required");
    expect(updated.status).toBe("configured");
    expect(updated.writes).toEqual([
      {
        kind: "repository-policy",
        path: join(repo, ".simple-changelogs.json"),
        written: true,
      },
    ]);
    expect(policy).toEqual({ ...stored, crossSurfaceVersioning: "mixed" });
  });

  test("treats a matching stored relationship as already configured", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, ".simple-changelogs.json"), {
      crossSurfaceVersioning: "shared",
      developerChangelog: "required",
      distribution: "web",
      guidance: { backfillStatus: "not-applicable", version: 7 },
      newReleaseNoteSurfaces: "ask",
      schemaVersion: 1,
      signatures: "agent-and-timestamp",
    });

    const result = await applySetup({
      configDirectory: config,
      confirm: true,
      crossSurfaceVersioning: "shared",
      distribution: "web",
      repo,
    });

    expect(result.status).toBe("already-configured");
    expect(result.writes).toEqual([]);
  });

  test("keeps cross-surface versioning out of global preferences", async () => {
    const { config, repo } = await fixture();

    await applySetup({
      ...recommendedOptions(repo, config),
      crossSurfaceVersioning: "independent",
      scope: "all-projects",
    });
    const preferences = await readJson(resolveGlobalPreferencesPath(config));

    expect(Object.hasOwn(preferences, "crossSurfaceVersioning")).toBe(false);
  });

  test("persists every release-note environment scope", async () => {
    await Promise.all(
      (
        [
          "all-environments",
          "non-production",
          "production-only",
          "disabled",
        ] as const
      ).map(async (releaseNoteEnvironmentScope) => {
        const { config, repo } = await fixture();
        const result = await applySetup({
          ...recommendedOptions(repo, config),
          releaseNoteEnvironmentScope,
        });
        const policy = await readJson(join(repo, ".simple-changelogs.json"));

        expect(result.status).toBe("configured");
        expect(result.selection.releaseNoteEnvironmentScope).toBe(
          releaseNoteEnvironmentScope
        );
        expect(policy.releaseNoteEnvironmentScope).toBe(
          releaseNoteEnvironmentScope
        );
      })
    );
  });

  test("updates release-note environment scope without disturbing configured policy", async () => {
    const { config, repo } = await fixture();
    const stored = {
      developerChangelog: "optional" as const,
      distribution: "web" as const,
      guidance: { backfillStatus: "declined" as const, version: 8 },
      newReleaseNoteSurfaceComponents: "recommended-web-radix" as const,
      newReleaseNoteSurfaces: "existing-only" as const,
      schemaVersion: 1 as const,
      signatures: "none" as const,
    };
    await writeJson(join(repo, ".simple-changelogs.json"), stored);

    const blocked = await applySetup({
      configDirectory: config,
      distribution: "web",
      releaseNoteEnvironmentScope: "non-production",
      repo,
    });
    const updated = await applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "web",
      releaseNoteEnvironmentScope: "non-production",
      repo,
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));

    expect(blocked.status).toBe("blocked");
    expect(blocked.errors.join(" ")).toContain("Confirmation is required");
    expect(updated.status).toBe("configured");
    expect(policy).toEqual({
      ...stored,
      releaseNoteEnvironmentScope: "non-production",
    });
  });

  test("keeps release-note environment scope out of global preferences", async () => {
    const { config, repo } = await fixture();

    await applySetup({
      ...recommendedOptions(repo, config),
      releaseNoteEnvironmentScope: "non-production",
      scope: "all-projects",
    });
    const preferences = await readJson(resolveGlobalPreferencesPath(config));

    expect(Object.hasOwn(preferences, "releaseNoteEnvironmentScope")).toBe(
      false
    );
  });

  test("persists every release-note link policy", async () => {
    await Promise.all(
      (["when-useful", "ask", "disabled"] as const).map(
        async (releaseNoteLinks) => {
          const { config, repo } = await fixture();
          const result = await applySetup({
            ...recommendedOptions(repo, config),
            releaseNoteLinks,
          });
          const policy = await readJson(join(repo, ".simple-changelogs.json"));

          expect(result.status).toBe("configured");
          expect(result.selection.releaseNoteLinks).toBe(releaseNoteLinks);
          expect(policy.releaseNoteLinks).toBe(releaseNoteLinks);
        }
      )
    );
  });

  test("updates release-note links without disturbing configured policy", async () => {
    const { config, repo } = await fixture();
    const stored = {
      developerChangelog: "optional" as const,
      distribution: "web" as const,
      guidance: { backfillStatus: "declined" as const, version: 12 },
      newReleaseNoteSurfaceComponents: "recommended-web-radix" as const,
      newReleaseNoteSurfaces: "existing-only" as const,
      releaseNoteEnvironmentScope: "non-production" as const,
      schemaVersion: 1 as const,
      signatures: "none" as const,
    };
    await writeJson(join(repo, ".simple-changelogs.json"), stored);

    const blocked = await applySetup({
      configDirectory: config,
      distribution: "web",
      releaseNoteLinks: "when-useful",
      repo,
    });
    const updated = await applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "web",
      releaseNoteLinks: "when-useful",
      repo,
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));

    expect(blocked.status).toBe("blocked");
    expect(blocked.errors.join(" ")).toContain("Confirmation is required");
    expect(updated.status).toBe("configured");
    expect(policy).toEqual({ ...stored, releaseNoteLinks: "when-useful" });
  });

  test("keeps release-note links out of global preferences", async () => {
    const { config, repo } = await fixture();

    await applySetup({
      ...recommendedOptions(repo, config),
      releaseNoteLinks: "when-useful",
      scope: "all-projects",
    });
    const preferences = await readJson(resolveGlobalPreferencesPath(config));

    expect(Object.hasOwn(preferences, "releaseNoteLinks")).toBe(false);
  });
});

describe("distribution and CMS boundaries", () => {
  test("surfaces and acknowledges CMS-only guidance updates", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, ".simple-changelogs-cms.json"), {
      changelogPath: "CMS_CHANGELOG.json",
      cmsSurface: {
        access: "authenticated-operators",
        route: "/admin/changelog",
      },
      guidance: { backfillStatus: "completed", version: 1 },
      newReleaseNoteSurfaces: "existing-only",
      schemaVersion: 1,
    });

    const inspection = await inspectRepository({
      configDirectory: config,
      distribution: "cms",
      repo,
      taskMode: "write",
    });
    const recorded = await applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "cms",
      guidanceBackfill: "not-applicable",
      repo,
    });
    const policy = await readJson(join(repo, ".simple-changelogs-cms.json"));

    expect(inspection.guidanceUpdate).toMatchObject({
      currentVersion: 2,
      recordedVersion: 1,
      userPrompt: null,
    });
    expect(recorded.status).toBe("configured");
    expect(policy.guidance).toEqual({
      backfillStatus: "not-applicable",
      version: 2,
    });
  });

  test("distribution conflicts stop before writing", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, ".simple-changelogs.json"), {
      developerChangelog: "required",
      distribution: "mobile",
      guidance: { backfillStatus: "not-applicable", version: 4 },
      newReleaseNoteSurfaces: "ask",
      schemaVersion: 1,
      signatures: "agent-and-timestamp",
    });

    const result = await applySetup(recommendedOptions(repo, config));

    expect(result.status).toBe("blocked");
    expect(result.detection.confidence).toBe("conflict");
  });

  test("CMS setup requires proven authentication, route, and contained source", async () => {
    const { config, repo } = await fixture();
    const blocked = await applySetup({
      backfillStatus: "not-applicable",
      configDirectory: config,
      confirm: true,
      distribution: "cms",
      repo,
      scope: "repository",
    });
    const traversal = await applySetup({
      backfillStatus: "not-applicable",
      cmsAuthProven: true,
      cmsChangelog: "../outside.json",
      cmsRoute: "/admin/changelog",
      cmsSurfaceProven: true,
      configDirectory: config,
      confirm: true,
      distribution: "cms",
      repo,
      scope: "repository",
    });

    expect(blocked.status).toBe("blocked");
    expect(blocked.errors.join(" ")).toContain("cms-auth-proven");
    expect(traversal.status).toBe("blocked");
    expect(traversal.errors.join(" ")).toContain("repository-root");
  });

  test("CMS ignores global surface authority and writes authenticated repository state", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(config, "preferences.json"), {
      developerChangelog: "optional",
      newReleaseNoteSurfaces: "allow",
      profile: "solo-developer",
      schemaVersion: 1,
      setupStyle: "customized",
      signatures: "none",
    });

    const result = await applySetup({
      backfillStatus: "not-applicable",
      cmsAuthProven: true,
      cmsRoute: "/admin/changelog",
      cmsSurfaceProven: true,
      configDirectory: config,
      confirm: true,
      distribution: "cms",
      repo,
      scope: "all-projects",
    });
    const policy = await readJson(join(repo, ".simple-changelogs-cms.json"));
    const preferences = await readJson(join(config, "preferences.json"));

    expect(result.status).toBe("configured");
    expect(policy.newReleaseNoteSurfaces).toBe("existing-only");
    expect(preferences.newReleaseNoteSurfaces).toBe("allow");
    expect(policy).not.toHaveProperty("developerChangelog");
    expect(policy).not.toHaveProperty("signatures");
  });

  test("web+CMS writes both validated policies in one setup transaction", async () => {
    const { config, repo } = await fixture();

    const result = await applySetup({
      backfillStatus: "not-applicable",
      cmsAuthProven: true,
      cmsRoute: "/admin/changelog",
      cmsSurfaceProven: true,
      configDirectory: config,
      confirm: true,
      distribution: "web-cms",
      repo,
      scope: "repository",
    });

    expect(result.status).toBe("configured");
    expect(existsSync(join(repo, ".simple-changelogs.json"))).toBe(true);
    expect(existsSync(join(repo, ".simple-changelogs-cms.json"))).toBe(true);
    expect(
      existsSync(join(repo, ".simple-changelogs.setup-transaction.json"))
    ).toBe(false);
  });

  test("CMS-only setup never records app-version relationships", async () => {
    const { config, repo } = await fixture();

    const result = await applySetup({
      backfillStatus: "not-applicable",
      cmsAuthProven: true,
      cmsRoute: "/admin/changelog",
      cmsSurfaceProven: true,
      configDirectory: config,
      confirm: true,
      crossSurfaceVersioning: "independent",
      distribution: "cms",
      repo,
      scope: "repository",
    });
    const cmsPolicy = await readJson(join(repo, ".simple-changelogs-cms.json"));

    expect(result.status).toBe("configured");
    expect(existsSync(join(repo, ".simple-changelogs.json"))).toBe(false);
    expect(Object.hasOwn(cmsPolicy, "crossSurfaceVersioning")).toBe(false);
    expect(result.unresolvedQuestions).not.toContain(
      "cross-surface-versioning"
    );
  });

  test("non-Web distributions reject release-note environment scope", async () => {
    await Promise.all(
      (["mobile", "skill-repository"] as const).map(async (distribution) => {
        const { config, repo } = await fixture();
        const result = await applySetup({
          backfillStatus: "not-applicable",
          configDirectory: config,
          confirm: true,
          distribution,
          releaseNoteEnvironmentScope: "non-production",
          repo,
          scope: "repository",
        });

        expect(result.status).toBe("blocked");
        expect(result.errors.join(" ")).toContain(
          "applies only to full, web, and web+CMS"
        );
        expect(existsSync(join(repo, ".simple-changelogs.json"))).toBe(false);
      })
    );
  });

  test("CMS-only setup rejects release-note environment scope", async () => {
    const { config, repo } = await fixture();
    const result = await applySetup({
      backfillStatus: "not-applicable",
      cmsAuthProven: true,
      cmsRoute: "/admin/changelog",
      cmsSurfaceProven: true,
      configDirectory: config,
      confirm: true,
      distribution: "cms",
      releaseNoteEnvironmentScope: "non-production",
      repo,
      scope: "repository",
    });

    expect(result.status).toBe("blocked");
    expect(result.errors.join(" ")).toContain(
      "applies only to full, web, and web+CMS"
    );
    expect(existsSync(join(repo, ".simple-changelogs-cms.json"))).toBe(false);
  });

  test("non-product distributions reject release-note links", async () => {
    await Promise.all(
      (["cms", "skill-repository"] as const).map(async (distribution) => {
        const { config, repo } = await fixture();
        const result = await applySetup({
          backfillStatus: "not-applicable",
          cmsAuthProven: distribution === "cms",
          cmsRoute: distribution === "cms" ? "/admin/changelog" : undefined,
          cmsSurfaceProven: distribution === "cms",
          configDirectory: config,
          confirm: true,
          distribution,
          releaseNoteLinks: "when-useful",
          repo,
          scope: "repository",
        });

        expect(result.status).toBe("blocked");
        expect(result.errors.join(" ")).toContain(
          "applies only to full, web, mobile, and web+CMS"
        );
      })
    );
  });

  test("web+CMS resumes a matching interrupted setup transaction", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, ".simple-changelogs.json"), {
      developerChangelog: "required",
      distribution: "web-cms",
      guidance: { backfillStatus: "not-applicable", version: 15 },
      newReleaseNoteSurfaces: "ask",
      publicVersioning: {
        major: "ask",
        minor: "ask",
        patch: "ask",
        suggestWhenAsking: true,
      },
      schemaVersion: 1,
      signatures: "agent-and-timestamp",
    });
    await writeJson(join(repo, ".simple-changelogs.setup-transaction.json"), {
      schemaVersion: 1,
      targets: [".simple-changelogs.json"],
    });

    const result = await applySetup({
      backfillStatus: "not-applicable",
      cmsAuthProven: true,
      cmsRoute: "/admin/changelog",
      cmsSurfaceProven: true,
      configDirectory: config,
      confirm: true,
      distribution: "web-cms",
      repo,
      scope: "repository",
    });

    expect(result.status).toBe("configured");
    expect(existsSync(join(repo, ".simple-changelogs-cms.json"))).toBe(true);
    expect(
      existsSync(join(repo, ".simple-changelogs.setup-transaction.json"))
    ).toBe(false);
  });
});

test("global preference validation rejects unknown authority and repository fields", () => {
  expect(
    validateGlobalPreferences({
      developerChangelog: "required",
      newReleaseNoteSurfaces: "ask",
      profile: "solo-developer",
      repository: "/tmp/project",
      schemaVersion: 1,
      setupStyle: "recommended",
      signatures: "agent-and-timestamp",
    }).errors
  ).not.toEqual([]);
});

test("every copied distribution runs its self-contained setup helper", async () => {
  const sourceRoot = fileURLToPath(
    new URL("../../../../skills", import.meta.url)
  );
  const packageRoot = await temporaryDirectory("packages");
  const repo = await temporaryDirectory("package-repo");
  const distributions = [
    ["simple-changelogs", "full"],
    ["simple-changelogs-cms", "cms"],
    ["simple-changelogs-mobile", "mobile"],
    ["simple-changelogs-skill-maintainer", "skill-repository"],
    ["simple-changelogs-web", "web"],
    ["simple-changelogs-web-cms", "web-cms"],
  ] as const;

  const results = await Promise.all(
    distributions.map(async ([directory]) => {
      const target = join(packageRoot, directory);
      await cp(join(sourceRoot, directory), target, { recursive: true });
      const subprocess = spawn({
        cmd: [
          process.execPath,
          join(target, "scripts", "setup.ts"),
          "inspect",
          "--repo",
          repo,
          "--task-mode",
          "read",
        ],
        stderr: "pipe",
        stdout: "pipe",
      });
      const [exitCode, stdout, stderr] = await Promise.all([
        subprocess.exited,
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
      ]);
      return {
        directory,
        exitCode,
        result: JSON.parse(stdout) as {
          detection: { distribution: string };
        },
        stderr,
      };
    })
  );

  expect(
    results.map(({ directory, exitCode, result, stderr }) => ({
      directory,
      distribution: result.detection.distribution,
      exitCode,
      stderr,
    }))
  ).toEqual(
    distributions.map(([directory, distribution]) => ({
      directory,
      distribution,
      exitCode: 0,
      stderr: "",
    }))
  );
});
