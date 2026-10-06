import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { validateRepoPolicy } from "../lib/validate.ts";
import {
  type ApplyOptions,
  applySetup,
  inspectRepository,
  parseCli,
  resolveGlobalPreferencesPath,
} from "../setup.ts";

const temporaryPaths: string[] = [];

const temporaryDirectory = async (label: string): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), `simple-changelogs-${label}-`));
  temporaryPaths.push(path);
  return path;
};

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true }))
  );
});

const writeText = async (
  root: string,
  path: string,
  content: string
): Promise<void> => {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content, "utf8");
};

const writeJson = (root: string, path: string, value: unknown) =>
  writeText(root, path, `${JSON.stringify(value, null, 2)}\n`);

const readJson = async (path: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

const plist = (version: string): string =>
  `<plist><dict>\n  <key>CFBundleShortVersionString</key>\n  <string>${version}</string>\n</dict></plist>\n`;

// Web, iOS, Android, and Tauri desktop, each owning its own public version.
const fourTrainRepo = async (): Promise<string> => {
  const repo = await temporaryDirectory("repo");
  await writeJson(repo, "apps/web/package.json", {
    dependencies: { next: "16.0.0" },
    version: "2.4.0",
  });
  await writeText(repo, "ios/Trailhead/Info.plist", plist("1.2"));
  await writeText(
    repo,
    "android/app/build.gradle",
    'android {\n  defaultConfig {\n    versionCode 120\n    versionName "1.2"\n  }\n}\n'
  );
  await writeJson(repo, "src-tauri/tauri.conf.json", { version: "0.9.0" });
  return repo;
};

const twoTrainRepo = async (webVersion = "6.7.0"): Promise<string> => {
  const repo = await temporaryDirectory("repo");
  await writeJson(repo, "apps/web/package.json", { version: webVersion });
  await writeJson(repo, "apps/mobile/app.json", {
    expo: { ios: { buildNumber: "1842" }, version: "3.2.0" },
  });
  return repo;
};

const fullPolicy = (extra: Record<string, unknown> = {}) => ({
  developerChangelog: "required",
  distribution: "full",
  guidance: { backfillStatus: "not-applicable", version: 23 },
  mobileReleaseNotePlacement: "mobile-only",
  newReleaseNoteSurfaces: "ask",
  schemaVersion: 1,
  signatures: "agent-and-timestamp",
  ...extra,
});

const catchUpLine = (): { mode: "catch-up"; trains: string[] }[] => [
  { mode: "catch-up", trains: ["mobile", "web"] },
];

const inspectFull = async (repo: string, distribution = "full" as const) =>
  inspectRepository({
    configDirectory: await temporaryDirectory("config"),
    distribution,
    repo,
  });

const onboard = async (
  repo: string,
  options: Partial<ApplyOptions> = {}
): Promise<Awaited<ReturnType<typeof applySetup>>> =>
  applySetup({
    backfillStatus: "not-applicable",
    configDirectory: await temporaryDirectory("config"),
    confirm: true,
    distribution: "full",
    mobileReleaseNotePlacement: "mobile-only",
    repo,
    scope: "repository",
    ...options,
  });

describe("sharedVersionLines policy validation", () => {
  test("accepts no lines, a catch-up pair, a three-train counter, and separate lines", async () => {
    const accepted = [
      [],
      catchUpLine(),
      [{ mode: "bump-shared", trains: ["web", "ios", "android"] }],
      [
        { mode: "catch-up", trains: ["web", "mobile"] },
        { mode: "bump-shared", trains: ["macos", "windows", "linux"] },
      ],
    ];
    await Promise.all(
      accepted.map(async (sharedVersionLines) => {
        const repo = await temporaryDirectory("repo");
        await writeJson(
          repo,
          ".simple-changelogs.json",
          fullPolicy({ crossSurfaceVersioning: "mixed", sharedVersionLines })
        );
        const inspection = await inspectFull(repo);

        expect(inspection.policy?.state).toBe("valid");
        expect(validateRepoPolicy(fullPolicy({ sharedVersionLines })).ok).toBe(
          true
        );
      })
    );
  });

  test("rejects malformed membership, non-full policies, and one-train contradictions", async () => {
    const rejected: [string, Record<string, unknown>][] = [
      [
        "2+ trains",
        { sharedVersionLines: [{ mode: "catch-up", trains: ["web"] }] },
      ],
      [
        "repeats",
        { sharedVersionLines: [{ mode: "catch-up", trains: ["web", "web"] }] },
      ],
      [
        "repeats",
        {
          sharedVersionLines: [
            { mode: "catch-up", trains: ["web", "ios"] },
            { mode: "bump-shared", trains: ["ios", "android"] },
          ],
        },
      ],
      [
        "2+ trains",
        { sharedVersionLines: [{ mode: "lockstep", trains: ["web", "ios"] }] },
      ],
      [
        "2+ trains",
        {
          sharedVersionLines: [
            { mode: "catch-up", name: "apps", trains: ["web", "ios"] },
          ],
        },
      ],
      ["must be an array", { sharedVersionLines: { mode: "catch-up" } }],
      [
        "only to full",
        { distribution: "web", sharedVersionLines: catchUpLine() },
      ],
      [
        "contradicts crossSurfaceVersioning shared",
        { crossSurfaceVersioning: "shared", sharedVersionLines: catchUpLine() },
      ],
    ];
    await Promise.all(
      rejected.map(async ([message, extra]) => {
        const repo = await temporaryDirectory("repo");
        await writeJson(repo, ".simple-changelogs.json", fullPolicy(extra));
        const inspection = await inspectFull(repo);

        expect(inspection.policy?.state, message).toBe("malformed");
        expect(inspection.errors.join(" "), message).toContain(message);
        expect(inspection.status).toBe("blocked");
        expect(validateRepoPolicy(fullPolicy(extra)).ok, message).toBe(false);
      })
    );
  });
});

describe("release-train detection", () => {
  test("detects web, iOS, Android, and Tauri desktop owners with two-part mobile versions", async () => {
    const inspection = await inspectFull(await fourTrainRepo());

    expect(inspection.inventory.versionTrains).toEqual([
      { path: "android/app/build.gradle", train: "android", version: "1.2" },
      { path: "apps/web/package.json", train: "web", version: "2.4.0" },
      { path: "ios/Trailhead/Info.plist", train: "ios", version: "1.2" },
      { path: "src-tauri/tauri.conf.json", train: "desktop", version: "0.9.0" },
    ]);
    expect(inspection.unresolvedQuestions).toContain("shared-version-lines");
  });

  test("detects an Electron desktop app, Kotlin DSL, and macOS build variables", async () => {
    const repo = await temporaryDirectory("repo");
    await writeJson(repo, "apps/desktop/package.json", {
      dependencies: { electron: "38.0.0" },
      version: "4.1",
    });
    await writeText(
      repo,
      "android/app/build.gradle.kts",
      'android { defaultConfig { versionName = "2.0" } }\n'
    );
    await writeText(
      repo,
      "macos/Runner/Info.plist",
      plist("$(MARKETING_VERSION)")
    );

    const inspection = await inspectFull(repo);

    expect(inspection.inventory.versionTrains).toEqual([
      {
        path: "android/app/build.gradle.kts",
        train: "android",
        version: "2.0",
      },
      { path: "apps/desktop/package.json", train: "desktop", version: "4.1" },
      { path: "macos/Runner/Info.plist", train: "macos", version: null },
    ]);
  });

  test("treats an Expo app's package and native files as mirrors of one Mobile train", async () => {
    const repo = await twoTrainRepo();
    await writeJson(repo, "apps/mobile/package.json", {
      version: "3.2.0-rc.4+abc123",
    });
    await writeText(repo, "apps/mobile/ios/Mobile/Info.plist", plist("3.2.0"));
    await writeText(
      repo,
      "apps/mobile/android/app/build.gradle",
      'versionName "3.2.0"\n'
    );

    const inspection = await inspectFull(repo);

    expect(inspection.inventory.versionTrains).toEqual([
      { path: "apps/mobile/app.json", train: "mobile", version: "3.2.0" },
      { path: "apps/web/package.json", train: "web", version: "6.7.0" },
    ]);
  });

  test("never asks with one separately versioned train", async () => {
    const repo = await temporaryDirectory("repo");
    await writeJson(repo, "apps/web/package.json", { version: "1.0.0" });
    await writeJson(repo, "package.json", { version: "9.9.9" });

    const inspection = await inspectFull(repo);

    expect(inspection.inventory.versionTrains).toHaveLength(1);
    expect(inspection.unresolvedQuestions).not.toContain(
      "shared-version-lines"
    );
  });

  test("sees owners past the capped file walk in a large monorepo", async () => {
    // 450 route files sort ahead of apps/, so the 400-file walk stops first.
    const repo = await twoTrainRepo();
    await Promise.all([
      ...Array.from({ length: 450 }, (_, index) =>
        writeText(repo, `api/routes/route-${index}.ts`, "export {};\n")
      ),
      writeJson(repo, "apps/mobile/package.json", { version: "3.2.0" }),
      writeText(
        repo,
        "apps/mobile/ios/Mobile/Supporting/Info.plist",
        plist("3.2.0")
      ),
      writeText(
        repo,
        "apps/mobile/android/app/build.gradle",
        'versionName "3.2.0"\n'
      ),
      writeJson(repo, "apps/desktop/src-tauri/tauri.conf.json", {
        version: "0.4.0",
      }),
    ]);

    const onboarding = await inspectFull(repo);
    await writeJson(
      repo,
      ".simple-changelogs.json",
      fullPolicy({
        guidance: { backfillStatus: "not-applicable", version: 21 },
      })
    );
    const configured = await inspectFull(repo);

    expect(onboarding.inventory.scan.truncated).toBe(true);
    expect(onboarding.inventory.versionTrains).toEqual([
      {
        path: "apps/desktop/src-tauri/tauri.conf.json",
        train: "desktop",
        version: "0.4.0",
      },
      { path: "apps/mobile/app.json", train: "mobile", version: "3.2.0" },
      { path: "apps/web/package.json", train: "web", version: "6.7.0" },
    ]);
    expect(onboarding.unresolvedQuestions).toContain("shared-version-lines");
    expect(configured.guidanceUpdate?.questions).toEqual([
      "shared-version-lines",
    ]);
  });

  test("probes packages/* after apps/* with the same owner rules", async () => {
    const repo = await temporaryDirectory("repo");
    await Promise.all([
      writeJson(repo, "packages/mobile/app.json", {
        expo: { version: "2.0.0" },
      }),
      writeText(repo, "packages/mobile/ios/Mobile/Info.plist", plist("2.0.0")),
      // Only apps/*/package.json owns a version, so libraries never count.
      writeJson(repo, "packages/web/package.json", {
        dependencies: { next: "16.0.0" },
        version: "5.0.0",
      }),
      writeJson(repo, "packages/db/package.json", { version: "0.3.0" }),
      writeJson(repo, "apps/desktop/src-tauri/tauri.conf.json", {
        version: "1.0.0",
      }),
      writeJson(repo, "packages/desktop/src-tauri/tauri.conf.json", {
        version: "0.1.0",
      }),
    ]);

    const inspection = await inspectFull(repo);

    expect(inspection.inventory.versionTrains).toEqual([
      {
        path: "apps/desktop/src-tauri/tauri.conf.json",
        train: "desktop",
        version: "1.0.0",
      },
      { path: "packages/mobile/app.json", train: "mobile", version: "2.0.0" },
    ]);
    expect(inspection.unresolvedQuestions).toContain("shared-version-lines");
  });

  test("skips agent, dependency, and build directories and keeps the walk's first owner", async () => {
    const repo = await temporaryDirectory("repo");
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "2.0.0" }),
      writeJson(repo, "apps/node_modules/package.json", { version: "9.9.9" }),
      writeJson(repo, "apps/.cache/package.json", { version: "9.9.9" }),
      writeJson(repo, ".worktrees/feature/apps/mobile/app.json", {
        expo: { version: "9.9.9" },
      }),
      // Zebra-Widget sorts after Zebra per directory, before it as a full path.
      ...[".build", "build", "Pods/Analytics", "Zebra-Widget"].map(
        (directory) =>
          writeText(repo, `ios/${directory}/Info.plist`, plist("9.9"))
      ),
      writeText(repo, "ios/Zebra/Info.plist", plist("1.4")),
    ]);

    const inspection = await inspectFull(repo);

    expect(inspection.inventory.versionTrains).toEqual([
      { path: "apps/web/package.json", train: "web", version: "2.0.0" },
      { path: "ios/Zebra/Info.plist", train: "ios", version: "1.4" },
    ]);
  });

  test("other distributions never detect trains or ask", async () => {
    const repo = await fourTrainRepo();
    const inspections = await Promise.all(
      (["web", "mobile", "web-cms", "skill-repository", "cms"] as const).map(
        async (distribution) =>
          inspectRepository({
            configDirectory: await temporaryDirectory("config"),
            distribution,
            repo,
          })
      )
    );

    for (const inspection of inspections) {
      expect(Object.hasOwn(inspection.inventory, "versionTrains")).toBe(false);
      expect(inspection.unresolvedQuestions).not.toContain(
        "shared-version-lines"
      );
    }
  });
});

describe("guidance 22 version-line notice", () => {
  const guidance21 = { backfillStatus: "not-applicable", version: 21 };

  test("asks once for a full repository with 2+ unanswered trains", async () => {
    const repo = await twoTrainRepo();
    await writeJson(
      repo,
      ".simple-changelogs.json",
      fullPolicy({ guidance: guidance21 })
    );

    const inspection = await inspectFull(repo);

    expect(inspection.status).toBe("already-configured");
    expect(inspection.guidanceUpdate).toMatchObject({
      currentVersion: 24,
      questions: ["shared-version-lines"],
      recordedVersion: 21,
      userPrompt: null,
    });
    expect(
      inspection.guidanceUpdate?.changes.find(({ version }) => version === 22)
        ?.summary
    ).toContain("share one version number");
  });

  test("leaves the question out for a single train, a recorded answer, or one shared train", async () => {
    const singleTrain = await temporaryDirectory("repo");
    await writeJson(singleTrain, "apps/web/package.json", { version: "1.0.0" });
    const answered = await twoTrainRepo();
    const oneTrain = await twoTrainRepo();
    const cases: [string, Record<string, unknown>][] = [
      [singleTrain, {}],
      [answered, { sharedVersionLines: [] }],
      [oneTrain, { crossSurfaceVersioning: "shared" }],
    ];
    const inspections = await Promise.all(
      cases.map(async ([repo, extra]) => {
        await writeJson(
          repo,
          ".simple-changelogs.json",
          fullPolicy({ ...extra, guidance: guidance21 })
        );
        return inspectFull(repo);
      })
    );

    for (const inspection of inspections) {
      expect(inspection.guidanceUpdate?.currentVersion).toBe(24);
      expect(Object.hasOwn(inspection.guidanceUpdate ?? {}, "questions")).toBe(
        false
      );
    }
  });

  test("other distributions' notices never carry the question", async () => {
    const repo = await twoTrainRepo();
    await writeJson(repo, ".simple-changelogs.json", {
      ...fullPolicy({ distribution: "web" }),
      guidance: { backfillStatus: "not-applicable", version: 19 },
      mobileReleaseNotePlacement: undefined,
    });

    const inspection = await inspectRepository({
      configDirectory: await temporaryDirectory("config"),
      distribution: "web",
      repo,
    });

    expect(inspection.guidanceUpdate?.currentVersion).toBe(22);
    expect(Object.hasOwn(inspection.guidanceUpdate ?? {}, "questions")).toBe(
      false
    );
  });

  test("records the answer with the disposition and never asks again", async () => {
    const repo = await twoTrainRepo();
    const config = await temporaryDirectory("config");
    await writeJson(
      repo,
      ".simple-changelogs.json",
      fullPolicy({ guidance: guidance21 })
    );

    const recorded = await applySetup({
      configDirectory: config,
      confirm: true,
      distribution: "full",
      guidanceBackfill: "not-applicable",
      repo,
      sharedVersionLines: catchUpLine(),
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));
    const after = await inspectRepository({
      configDirectory: config,
      distribution: "full",
      repo,
    });

    expect(recorded.status).toBe("configured");
    expect(recorded.selection).toEqual({
      backfillStatus: "not-applicable",
      sharedVersionLines: catchUpLine(),
    });
    expect(policy.sharedVersionLines).toEqual(catchUpLine());
    expect(policy.guidance).toEqual({
      backfillStatus: "not-applicable",
      version: 24,
    });
    expect(after.guidanceUpdate).toBeNull();
  });
});

describe("recording shared version lines", () => {
  test("onboarding records a detected line in repository policy only", async () => {
    const repo = await twoTrainRepo();
    const inspection = await inspectFull(repo);
    const result = await onboard(repo, {
      scope: "all-projects",
      sharedVersionLines: [{ mode: "bump-shared", trains: ["mobile", "web"] }],
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));
    const globalPath = result.writes.find(
      ({ kind }) => kind === "global-preferences"
    )?.path;

    expect(inspection.unresolvedQuestions).toContain("shared-version-lines");
    expect(result.status).toBe("configured");
    expect(policy.sharedVersionLines).toEqual([
      { mode: "bump-shared", trains: ["mobile", "web"] },
    ]);
    expect(globalPath).toBeDefined();
    expect(
      Object.hasOwn(await readJson(globalPath ?? ""), "sharedVersionLines")
    ).toBe(false);
  });

  test("a contextual update records lines and an identical rerun writes nothing", async () => {
    const repo = await twoTrainRepo();
    const config = await temporaryDirectory("config");
    await writeJson(repo, ".simple-changelogs.json", fullPolicy());
    const options = {
      configDirectory: config,
      confirm: true,
      distribution: "full" as const,
      repo,
      sharedVersionLines: catchUpLine(),
    };

    const updated = await applySetup(options);
    const rerun = await applySetup(options);

    expect(updated.status).toBe("configured");
    expect(
      (await readJson(join(repo, ".simple-changelogs.json"))).sharedVersionLines
    ).toEqual(catchUpLine());
    expect(rerun.status).toBe("already-configured");
  });

  test("blocks other distributions, run-only setup, and contradictions without writing", async () => {
    const contradicted = await twoTrainRepo();
    await writeJson(
      contradicted,
      ".simple-changelogs.json",
      fullPolicy({ sharedVersionLines: catchUpLine() })
    );
    const before = await readFile(
      join(contradicted, ".simple-changelogs.json"),
      "utf8"
    );
    const blocked = await Promise.all([
      onboard(await twoTrainRepo(), {
        distribution: "web",
        mobileReleaseNotePlacement: undefined,
        sharedVersionLines: catchUpLine(),
      }),
      onboard(await twoTrainRepo(), {
        scope: "run-only",
        sharedVersionLines: catchUpLine(),
      }),
      onboard(await twoTrainRepo(), {
        crossSurfaceVersioning: "shared",
        sharedVersionLines: catchUpLine(),
      }),
      applySetup({
        configDirectory: await temporaryDirectory("config"),
        confirm: true,
        crossSurfaceVersioning: "shared",
        distribution: "full",
        repo: contradicted,
      }),
    ]);

    expect(blocked.map(({ status }) => status)).toEqual([
      "blocked",
      "blocked",
      "blocked",
      "blocked",
    ]);
    expect(blocked[0]?.errors.join(" ")).toContain("only to full");
    expect(blocked[1]?.errors.join(" ")).toContain("never run-only");
    expect(blocked[2]?.errors.join(" ")).toContain(
      "contradicts crossSurfaceVersioning shared"
    );
    expect(blocked[3]?.errors.join(" ")).toContain(
      "contradicts crossSurfaceVersioning shared"
    );
    for (const result of blocked.slice(0, 3)) {
      expect(
        existsSync(join(result.repository, ".simple-changelogs.json"))
      ).toBe(false);
    }
    expect(
      await readFile(join(contradicted, ".simple-changelogs.json"), "utf8")
    ).toBe(before);
  });

  test("rejects a train without a numbered version and accepts two-part versions", async () => {
    const dated = await twoTrainRepo("2026-10-01");
    const twoPart = await fourTrainRepo();

    const rejected = await onboard(dated, {
      sharedVersionLines: catchUpLine(),
    });
    const accepted = await onboard(twoPart, {
      sharedVersionLines: [{ mode: "catch-up", trains: ["ios", "android"] }],
    });

    expect(rejected.status).toBe("blocked");
    expect(rejected.errors.join(" ")).toContain(
      "web has no numbered version (2026-10-01) to share."
    );
    expect(existsSync(join(dated, ".simple-changelogs.json"))).toBe(false);
    expect(accepted.status).toBe("configured");
  });

  test("the CLI parses JSON lines and rejects anything else", () => {
    expect(
      parseCli([
        "apply",
        "--shared-version-lines",
        '[{"mode":"catch-up","trains":["web","mobile"]}]',
      ]).options.sharedVersionLines
    ).toEqual([{ mode: "catch-up", trains: ["web", "mobile"] }]);
    expect(() =>
      parseCli(["apply", "--shared-version-lines", "web,mobile"])
    ).toThrow("--shared-version-lines must be JSON");
    expect(resolveGlobalPreferencesPath("/tmp/x")).toContain(
      "preferences.json"
    );
  });
});
