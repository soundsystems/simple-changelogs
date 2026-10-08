import { afterEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ApplyOptions, applySetup, inspectRepository } from "../setup.ts";

// Snapshot the real module before any test swaps a function out, so every
// fault is narrow (one path) and always restored.
const realFs = { ...(await import("node:fs/promises")) };
const { mkdir, mkdtemp, readdir, readFile, rm, writeFile } = realFs;

const MARKER = ".simple-changelogs.setup-transaction.json";
const POLICY = ".simple-changelogs.json";
const CMS_POLICY = ".simple-changelogs-cms.json";
// Far above any real pid_max, so liveness probes report ESRCH.
const DEAD_PID = 2_147_483_646;
const temporaryPaths: string[] = [];

const temporaryDirectory = async (label: string): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), `simple-changelogs-${label}-`));
  temporaryPaths.push(path);
  return path;
};

const withFsFaults = async <T>(
  overrides: Partial<typeof realFs>,
  run: () => Promise<T>
): Promise<T> => {
  mock.module("node:fs/promises", () => ({ ...realFs, ...overrides }));
  try {
    return await run();
  } finally {
    mock.module("node:fs/promises", () => realFs);
  }
};

const writeJson = (path: string, value: unknown): Promise<void> =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const readJson = async (path: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

const publicVersioning = {
  major: "ask",
  minor: "ask",
  patch: "ask",
  suggestWhenAsking: true,
};

const webCmsPolicies = async (
  repo: string,
  repoVersion: number,
  cmsVersion: number
): Promise<void> => {
  await writeJson(join(repo, POLICY), {
    developerChangelog: "required",
    distribution: "web-cms",
    guidance: { backfillStatus: "completed", version: repoVersion },
    newReleaseNoteSurfaces: "ask",
    publicVersioning,
    schemaVersion: 1,
    signatures: "agent-and-timestamp",
  });
  await writeJson(join(repo, CMS_POLICY), {
    changelogPath: "CMS_CHANGELOG.json",
    cmsSurface: {
      access: "authenticated-operators",
      route: "/admin/changelog",
    },
    guidance: { backfillStatus: "completed", version: cmsVersion },
    newReleaseNoteSurfaces: "existing-only",
    schemaVersion: 1,
  });
};

// A web+CMS repository whose CMS track is one version behind, so a guidance
// acknowledgment rewrites both policy files in one transaction.
const pendingWebCmsRepo = async () => {
  const config = await temporaryDirectory("config");
  const repo = await temporaryDirectory("repo");
  await webCmsPolicies(repo, 22, 1);
  const acknowledge: ApplyOptions = {
    configDirectory: config,
    confirm: true,
    distribution: "web-cms",
    guidanceBackfill: "not-applicable",
    repo,
  };
  const snapshot = async () => ({
    cms: await readFile(join(repo, CMS_POLICY), "utf8"),
    policy: await readFile(join(repo, POLICY), "utf8"),
  });
  return { acknowledge, before: await snapshot(), repo, snapshot };
};

const configuredWebRepo = async () => {
  const config = await temporaryDirectory("config");
  const repo = await temporaryDirectory("repo");
  const setup = await applySetup({
    backfillStatus: "not-applicable",
    configDirectory: config,
    confirm: true,
    distribution: "web",
    repo,
    scope: "repository",
  });
  expect(setup.status).toBe("configured");
  const update = (options: Partial<ApplyOptions>) =>
    applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "web",
      repo,
      ...options,
    });
  return { config, repo, update };
};

const repoFiles = async (repo: string): Promise<string[]> =>
  (await readdir(repo)).sort();

afterEach(async () => {
  mock.module("node:fs/promises", () => realFs);
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true }))
  );
});

describe("setup transactions under concurrency", () => {
  test("a run that inspected before another run committed cannot overwrite that commit", async () => {
    const { repo, update } = await configuredWebRepo();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reached = (): void => undefined;
    const atGate = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let gated = false;

    const [fast, slow] = await withFsFaults(
      {
        // The first run to stage anything pauses there: it has already
        // inspected the policy, and has not yet taken the transaction.
        mkdir: (async (...args: Parameters<typeof mkdir>) => {
          if (!gated) {
            gated = true;
            reached();
            await gate;
          }
          return mkdir(...args);
        }) as typeof mkdir,
      },
      async () => {
        const slowRun = update({ releaseNoteGrouping: "flat" });
        await atGate;
        const fastResult = await update({ majorReleaseNaming: "version-only" });
        release();
        return [fastResult, await slowRun] as const;
      }
    );
    const policy = await readJson(join(repo, POLICY));

    expect(fast.status).toBe("configured");
    expect(slow.status).toBe("blocked");
    expect(slow.errors.join(" ")).toContain("inspect again and retry");
    expect(policy.majorReleaseNaming).toBe("version-only");
    expect(policy.releaseNoteGrouping).toBe("product-areas");
    expect(existsSync(join(repo, MARKER))).toBe(false);
  });

  test("concurrent contextual updates never lose a change they reported", async () => {
    const { repo, update } = await configuredWebRepo();
    const expectedFiles = await repoFiles(repo);
    const losses: string[] = [];

    const pause = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    // Rounds run one after another; each races two updates on one repo.
    const runRounds = async (round: number): Promise<void> => {
      if (round === 30) {
        return;
      }
      const naming = round % 2 === 0 ? "version-only" : "named";
      const grouping = round % 2 === 0 ? "flat" : "product-areas";
      const [left, right] = await Promise.all([
        pause(round % 3).then(() => update({ majorReleaseNaming: naming })),
        pause(round % 5).then(() => update({ releaseNoteGrouping: grouping })),
      ]);
      const policy = await readJson(join(repo, POLICY));
      if (
        left.status === "configured" &&
        policy.majorReleaseNaming !== naming
      ) {
        losses.push(`round ${round}: naming`);
      }
      if (
        right.status === "configured" &&
        policy.releaseNoteGrouping !== grouping
      ) {
        losses.push(`round ${round}: grouping`);
      }
      expect(await repoFiles(repo)).toEqual(expectedFiles);
      await runRounds(round + 1);
    };
    await runRounds(0);

    expect(losses).toEqual([]);
  });

  test("a live transaction blocks a second run without touching anything", async () => {
    const { repo, update } = await configuredWebRepo();
    const marker = `${JSON.stringify({ pid: process.pid, schemaVersion: 2, targets: {} })}\n`;
    await writeFile(join(repo, MARKER), marker, "utf8");
    const before = await readFile(join(repo, POLICY), "utf8");

    const result = await update({ majorReleaseNaming: "version-only" });

    expect(result.status).toBe("blocked");
    expect(result.errors.join(" ")).toContain("Another setup run holds");
    expect(await readFile(join(repo, POLICY), "utf8")).toBe(before);
    expect(await readFile(join(repo, MARKER), "utf8")).toBe(marker);
  });
});

describe("setup transaction rollback and recovery", () => {
  test("the marker records every target's prior content before any rename", async () => {
    const { acknowledge, before, repo } = await pendingWebCmsRepo();
    const seen: unknown[] = [];

    const result = await withFsFaults(
      {
        rename: (async (from, to) => {
          if (String(to) === join(repo, CMS_POLICY)) {
            seen.push(JSON.parse(await readFile(join(repo, MARKER), "utf8")));
          }
          return realFs.rename(from, to);
        }) as typeof realFs.rename,
      },
      () => applySetup(acknowledge)
    );

    expect(result.status).toBe("configured");
    expect(seen).toEqual([
      {
        pid: process.pid,
        schemaVersion: 2,
        targets: { [CMS_POLICY]: before.cms, [POLICY]: before.policy },
      },
    ]);
    expect(existsSync(join(repo, MARKER))).toBe(false);
  });

  test("a failed commit restores every renamed target and removes the marker", async () => {
    const { acknowledge, before, repo, snapshot } = await pendingWebCmsRepo();
    const files = await repoFiles(repo);

    const result = await withFsFaults(
      {
        rename: ((from, to) =>
          String(to) === join(repo, CMS_POLICY)
            ? Promise.reject(new Error("injected rename failure"))
            : realFs.rename(from, to)) as typeof realFs.rename,
      },
      () => applySetup(acknowledge)
    );

    expect(result.status).toBe("blocked");
    expect(result.errors.join(" ")).toContain("injected rename failure");
    expect(await snapshot()).toEqual(before);
    expect(await repoFiles(repo)).toEqual(files);
  });

  test("a failed rollback keeps the marker and the original error for the next run", async () => {
    const { acknowledge, before, repo, snapshot } = await pendingWebCmsRepo();

    const failed = await withFsFaults(
      {
        rename: ((from, to) =>
          String(to) === join(repo, CMS_POLICY)
            ? Promise.reject(new Error("injected rename failure"))
            : realFs.rename(from, to)) as typeof realFs.rename,
        writeFile: ((path, ...rest) =>
          String(path) === join(repo, POLICY)
            ? Promise.reject(new Error("injected restore failure"))
            : writeFile(path, ...rest)) as typeof writeFile,
      },
      () => applySetup(acknowledge)
    );
    const halfCommitted = await snapshot();

    expect(failed.status).toBe("blocked");
    expect(failed.errors.join(" ")).toContain("injected rename failure");
    expect(failed.errors.join(" ")).not.toContain("injected restore failure");
    expect(halfCommitted.cms).toBe(before.cms);
    expect(halfCommitted.policy).not.toBe(before.policy);
    const marker = await readJson(join(repo, MARKER));
    expect(marker.targets).toEqual({
      [CMS_POLICY]: before.cms,
      [POLICY]: before.policy,
    });

    // The failed process exits; the next run rolls its write back and asks
    // for a fresh inspection, and the run after that succeeds.
    await writeJson(join(repo, MARKER), { ...marker, pid: DEAD_PID });
    const recovered = await applySetup(acknowledge);
    expect(recovered.status).toBe("blocked");
    expect(recovered.errors.join(" ")).toContain("inspect again and retry");
    expect(await snapshot()).toEqual(before);
    expect(existsSync(join(repo, MARKER))).toBe(false);

    const retried = await applySetup(acknowledge);
    expect(retried.status).toBe("configured");
    expect((await readJson(join(repo, CMS_POLICY))).guidance).toEqual({
      backfillStatus: "not-applicable",
      version: 2,
    });
  });

  test("an orphaned marker from before any rename is recovered in the same run", async () => {
    const { repo, update } = await configuredWebRepo();
    const before = await readFile(join(repo, POLICY), "utf8");
    await writeJson(join(repo, MARKER), {
      pid: DEAD_PID,
      schemaVersion: 2,
      targets: { [POLICY]: before },
    });

    const result = await update({ majorReleaseNaming: "version-only" });

    expect(result.status).toBe("configured");
    expect((await readJson(join(repo, POLICY))).majorReleaseNaming).toBe(
      "version-only"
    );
    expect(existsSync(join(repo, MARKER))).toBe(false);
  });

  test("an interrupted onboarding is rolled back and completed", async () => {
    const config = await temporaryDirectory("config");
    const repo = await temporaryDirectory("repo");
    await webCmsPolicies(repo, 22, 2);
    await rm(join(repo, CMS_POLICY));
    await writeJson(join(repo, MARKER), {
      pid: DEAD_PID,
      schemaVersion: 2,
      targets: { [CMS_POLICY]: null, [POLICY]: null },
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
    expect(result.writes.every(({ written }) => written)).toBe(true);
    expect(existsSync(join(repo, CMS_POLICY))).toBe(true);
    expect(existsSync(join(repo, MARKER))).toBe(false);
  });

  test("a marker without recovery data blocks with remediation and is preserved", async () => {
    const { repo, update } = await configuredWebRepo();
    const legacy = `${JSON.stringify({ schemaVersion: 1, targets: [POLICY] })}\n`;
    await writeFile(join(repo, MARKER), legacy, "utf8");
    const before = await readFile(join(repo, POLICY), "utf8");

    const result = await update({ majorReleaseNaming: "version-only" });

    expect(result.status).toBe("blocked");
    expect(result.errors.join(" ")).toContain("has no recovery data");
    expect(await readFile(join(repo, POLICY), "utf8")).toBe(before);
    expect(await readFile(join(repo, MARKER), "utf8")).toBe(legacy);
  });
});

describe("post-onboarding write guards", () => {
  test("a conflicting distribution blocks every post-onboarding write", async () => {
    const config = await temporaryDirectory("config");
    const repo = await temporaryDirectory("repo");
    await writeJson(join(repo, POLICY), {
      developerChangelog: "required",
      distribution: "full",
      guidance: { backfillStatus: "partial", version: 15 },
      mobileReleaseNotePlacement: "store-only",
      newReleaseNoteSurfaces: "ask",
      publicVersioning,
      schemaVersion: 1,
      signatures: "agent-and-timestamp",
    });
    const before = await readFile(join(repo, POLICY), "utf8");
    const base = { configDirectory: config, confirm: true, repo };
    const inspection = await inspectRepository({
      configDirectory: config,
      distribution: "web",
      repo,
    });

    const results = await Promise.all(
      (
        [
          { curationMax: 2, curationMin: 1, publicReleaseNotes: "curated" },
          { guidanceBackfill: "deferred" },
          { auditVerified: true, backfillStatus: "completed" },
        ] as const
      ).map((options) =>
        applySetup({ ...base, ...options, distribution: "web" })
      )
    );

    expect(inspection.status).toBe("blocked");
    expect(inspection.detection.confidence).toBe("conflict");
    for (const result of results) {
      expect(result.status).toBe("blocked");
      expect(result.detection.confidence).toBe("conflict");
      expect(result.unresolvedQuestions).toEqual(
        inspection.unresolvedQuestions
      );
    }
    expect(await readFile(join(repo, POLICY), "utf8")).toBe(before);
  });

  test("acknowledging one guidance track never lowers the other", async () => {
    const config = await temporaryDirectory("config");
    const repo = await temporaryDirectory("repo");
    // A newer helper already recorded main-track guidance 27; this helper's
    // current main version is 26.
    await webCmsPolicies(repo, 27, 1);

    const result = await applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "web-cms",
      guidanceBackfill: "not-applicable",
      repo,
    });

    expect(result.status).toBe("configured");
    expect((await readJson(join(repo, POLICY))).guidance).toEqual({
      backfillStatus: "not-applicable",
      version: 27,
    });
    expect((await readJson(join(repo, CMS_POLICY))).guidance).toEqual({
      backfillStatus: "not-applicable",
      version: 2,
    });
  });

  test("an identical object preference stored in another key order is already configured", async () => {
    const { repo, update } = await configuredWebRepo();
    const stored = await readJson(join(repo, POLICY));
    // Raw text keeps the unsorted key order the comparison must ignore.
    const unsorted =
      '{"suggestWhenAsking":false,"patch":"automatic","minor":"ask","major":"ask"}';
    await writeFile(
      join(repo, POLICY),
      JSON.stringify({ ...stored, publicVersioning: null }).replace(
        '"publicVersioning":null',
        `"publicVersioning":${unsorted}`
      ),
      "utf8"
    );
    const before = await readFile(join(repo, POLICY), "utf8");

    const result = await update({
      confirm: false,
      publicVersionMajor: "ask",
      publicVersionMinor: "ask",
      publicVersionPatch: "automatic",
      publicVersionSuggestions: "off",
    });

    expect(result.status).toBe("already-configured");
    expect(await readFile(join(repo, POLICY), "utf8")).toBe(before);
  });

  test("a CMS policy at guidance version 0 is malformed, and version 1 is valid", async () => {
    const config = await temporaryDirectory("config");
    const outcomes = await Promise.all(
      [0, 1].map(async (cmsVersion) => {
        const repo = await temporaryDirectory("repo");
        await webCmsPolicies(repo, 26, cmsVersion);
        return inspectRepository({
          configDirectory: config,
          distribution: "web-cms",
          repo,
        });
      })
    );

    expect(outcomes[0]?.cmsPolicy?.state).toBe("malformed");
    expect(outcomes[0]?.status).toBe("blocked");
    expect(outcomes[1]?.cmsPolicy?.state).toBe("valid");
    expect(outcomes[1]?.guidanceUpdate).toMatchObject({
      currentVersion: 2,
      recordedVersion: 1,
    });
  });
});
