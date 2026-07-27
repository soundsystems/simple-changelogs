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
import {
  applySetup,
  inspectRepository,
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
    expect((fullPolicy.guidance as Record<string, unknown>).version).toBe(8);

    const distributionVersions = [
      ["web", 7],
      ["mobile", 7],
      ["web-cms", 7],
      ["skill-repository", 5],
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
    expect(first.selection).toEqual({
      backfillStatus: "not-applicable",
      developerChangelog: "optional",
      newReleaseNoteSurfaces: "existing-only",
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
});

describe("distribution and CMS boundaries", () => {
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

  test("web+CMS resumes a matching interrupted setup transaction", async () => {
    const { config, repo } = await fixture();
    await writeJson(join(repo, ".simple-changelogs.json"), {
      developerChangelog: "required",
      distribution: "web-cms",
      guidance: { backfillStatus: "not-applicable", version: 7 },
      newReleaseNoteSurfaces: "ask",
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
