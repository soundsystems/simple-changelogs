import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import {
  type ChangelogReceiptV2,
  type ChangelogRequest,
  digestCanonicalJson,
  effectivePolicyDigest,
  NARROW_RECEIPT_VERSIONS,
  type ReleaseTag,
  receiptVersionFor,
  releaseTagFor,
  releaseTagProblem,
  shapeReceipt,
  validateChangelogReceipt,
  validateChangelogReleaseSet,
  validateChangelogRequest,
} from "../lib/release-handoff.ts";
import { validateRepoPolicy } from "../lib/validate.ts";
import {
  type ApplyOptions,
  applySetup,
  inspectRepository,
  parseCli,
  type ReleaseTagsSetting,
  releaseTagNameProblem,
  releaseTagsErrors,
  releaseTagTemplateProblem,
} from "../setup.ts";

const execFileAsync = promisify(execFile);
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

const changelog = (...headings: string[]): string =>
  `# Changelog\n\n## Unreleased\n\n${headings
    .map((heading) => `## ${heading}\n\n- Item.\n`)
    .join("\n")}`;

const gradle = (version: string): string =>
  `android {\n  defaultConfig {\n    versionName "${version}"\n  }\n}\n`;

const plist = (version: string): string =>
  `<plist><dict><key>CFBundleShortVersionString</key><string>${version}</string></dict></plist>\n`;

// One spawn per repository: init, one commit, and lightweight tags. Nothing
// is fetched or pushed.
const gitRepository = async (tags: string[] = []): Promise<string> => {
  const repo = await temporaryDirectory("repo");
  const script = [
    "git init -q",
    "git -c user.name=Test -c user.email=test@example.com -c commit.gpgsign=false commit -q --allow-empty -m init",
    ...tags.map((tag) => `git tag '${tag}'`),
  ].join(" && ");
  await execFileAsync("sh", ["-c", script], { cwd: repo });
  return repo;
};

const gitAccepts = async (name: string): Promise<boolean> => {
  try {
    await execFileAsync("git", ["check-ref-format", `refs/tags/${name}`]);
    return true;
  } catch {
    return false;
  }
};

const inspect = async (
  repo: string,
  distribution: ApplyOptions["distribution"] = "full"
) =>
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

const policyFor = (
  distribution: string,
  version: number,
  extra: Record<string, unknown> = {}
) => ({
  developerChangelog: "required",
  distribution,
  guidance: { backfillStatus: "not-applicable", version },
  ...(distribution === "full"
    ? { mobileReleaseNotePlacement: "mobile-only" }
    : {}),
  newReleaseNoteSurfaces: "ask",
  schemaVersion: 1,
  signatures: "agent-and-timestamp",
  ...extra,
});

describe("release tag names", () => {
  // Every class of name `git check-ref-format` refuses, beside names it
  // accepts, including other published version conventions.
  const accepted = [
    "v1.2.0",
    "1.2.0",
    "@acme/sdk@1.2.0",
    "release-2026-10-07",
    "v1!2.0",
    "release/1.2.0",
    "web@1.0.0+build.7",
    "a./b1.2.0",
    "@",
    "v2.0.0-rc.1",
  ];
  const refused = [
    "",
    "v1..2.0",
    "v1.2.0.lock",
    "release.lock/1.2.0",
    "release/.hidden/1.2.0",
    ".v1.2.0",
    "/v1.2.0",
    "v1.2.0/",
    "v1.2.0.",
    "v@{1}",
    "release//1.2.0",
    "v 1.2.0",
    "v1.2.0\t",
    "v1.2.0\n",
    "v1~2",
    "v1^2",
    "v1:2",
    "v1?2",
    "v1*2",
    "v1[2",
    "v1\\2",
    "v1\u007f2",
    "v1\u00002",
  ];

  test("matches git check-ref-format on every class of name", async () => {
    const names = [...accepted, ...refused].filter(
      (name) => !name.includes("\u0000")
    );
    const verdicts = await Promise.all(names.map(gitAccepts));
    expect(
      names.filter(
        (name, index) =>
          (releaseTagNameProblem(name) === null) !== verdicts[index]
      )
    ).toEqual([]);
    for (const name of accepted) {
      expect(releaseTagNameProblem(name)).toBeNull();
    }
    for (const name of refused) {
      expect(releaseTagNameProblem(name)).not.toBeNull();
    }
  });

  test("also refuses a leading -, which Git accepts, so a name never reads as an option", async () => {
    expect(await gitAccepts("-v1.2.0")).toBe(true);
    expect(releaseTagNameProblem("-v1.2.0")).toBe("must not start with -");
  });

  test("binds the name to the version and keeps the message one line", () => {
    const tag = (name: string, message = `Acme ${"1.2.0"}`): ReleaseTag => ({
      message,
      name,
    });
    for (const name of [
      "v1.2.0",
      "1.2.0",
      "@acme/sdk@1.2.0",
      "release-1.2.0",
      "release/1.2.0",
    ]) {
      expect(releaseTagProblem(tag(name), "1.2.0")).toBeNull();
    }
    expect(releaseTagProblem(tag("v1!2.0", "Acme 1!2.0"), "1!2.0")).toBeNull();
    expect(
      releaseTagProblem(
        tag("release-2026-10-07", "Acme 2026-10-07"),
        "2026-10-07"
      )
    ).toBeNull();
    for (const name of ["v11.2.0", "v1.2.0-45", "x1.2.0.", "v.1.2.0"]) {
      expect(releaseTagProblem(tag(name), "1.2.0")).not.toBeNull();
    }
    for (const message of [
      "1.2.0",
      " 1.2.0",
      "Acme  1.2.0",
      "Acme 1.2.1",
      "Acme\n1.2.0",
      "Acme\t1.2.0",
      `${"A".repeat(195)} 1.2.0`,
    ]) {
      expect(releaseTagProblem(tag("v1.2.0", message), "1.2.0")).toContain(
        "message"
      );
    }
    expect(
      releaseTagProblem(tag("v1.2.0", `${"A".repeat(194)} 1.2.0`), "1.2.0")
    ).toBeNull();
  });
});

describe("releaseTags setting", () => {
  test("accepts none, single templates, and prefix-free maps", () => {
    for (const value of [
      undefined,
      "none",
      "v{version}",
      "{version}",
      "release-{version}",
      "release/{version}",
      "@acme/sdk@{version}",
      "rel_v+{version}",
      { web: "web@{version}" },
      { "@acme/sdk": "@acme/sdk@{version}", ios: "none", web: "web@{version}" },
      { only: "{version}" },
    ]) {
      expect(releaseTagsErrors(value)).toEqual([]);
      expect(
        validateRepoPolicy(
          policyFor(
            "full",
            25,
            value === undefined ? {} : { releaseTags: value }
          )
        ).ok
      ).toBe(true);
    }
  });

  test("refuses invalid templates and maps that could name one tag twice", () => {
    const refused: [unknown, string][] = [
      ["", "exactly once"],
      ["v1.2.0", "exactly once"],
      ["{version}{version}", "exactly once"],
      ["{version}-web", "exactly once"],
      ["v{version}.0", "exactly once"],
      ["v1{version}", "digit or ."],
      ["v.{version}", "digit or ."],
      ["release..x-{version}", "must not contain .."],
      ["-v{version}", "must not start with -"],
      ["/v{version}", "start or end with /"],
      ["release//{version}", "must not contain //"],
      ["release.lock/{version}", ".lock"],
      ["release.lock{version}", ".lock"],
      ["release/.hidden/{version}", "starts with ."],
      [".v{version}", "starts with ."],
      ["v {version}", "letters, digits"],
      ["v~{version}", "letters, digits"],
      ["é{version}", "letters, digits"],
      [7, "must be"],
      [null, "must be"],
      [[], "must be"],
      [{}, "must be"],
      [{ "": "v{version}" }, "release-train name"],
      [{ web: 7 }, "must be a string"],
      [{ web: "web@{version}x" }, "exactly once"],
      [{ a: "v{version}", b: "v1.0.0-{version}" }, "could name one tag"],
      [{ a: "{version}", b: "web@{version}" }, "could name one tag"],
      [{ a: "web@{version}", b: "web@{version}" }, "could name one tag"],
    ];
    for (const [value, message] of refused) {
      const errors = releaseTagsErrors(value);
      expect(errors.join(" ")).toContain(message);
      expect(
        validateRepoPolicy(policyFor("full", 25, { releaseTags: value })).ok
      ).toBe(false);
    }
    expect(releaseTagTemplateProblem("v{version}")).toBeNull();
  });

  test("the setup helper and the policy validator agree on stored policy", async () => {
    const repo = await temporaryDirectory("repo");
    await writeJson(
      repo,
      ".simple-changelogs.json",
      policyFor("web", 25, {
        releaseTags: { a: "v{version}", b: "v{version}" },
      })
    );
    const malformed = await inspect(repo, "web");
    await writeJson(
      repo,
      ".simple-changelogs.json",
      policyFor("web", 25, { releaseTags: "v{version}" })
    );
    const valid = await inspect(repo, "web");

    expect(malformed.status).toBe("blocked");
    expect(malformed.errors.join(" ")).toContain("could name one tag");
    expect(valid.status).toBe("already-configured");
    expect(valid.releaseTags?.stored).toBe("v{version}");
  });

  test("the CLI takes none, a template, or a JSON object", () => {
    expect(
      parseCli(["apply", "--release-tags", "none"]).options.releaseTags
    ).toBe("none");
    expect(
      parseCli(["apply", "--release-tags", "release-{version}"]).options
        .releaseTags
    ).toBe("release-{version}");
    expect(
      parseCli(["apply", "--release-tags", '{"web":"web@{version}"}']).options
        .releaseTags
    ).toEqual({ web: "web@{version}" });
    expect(
      parseCli(["apply", "--release-tags", "{version}"]).options.releaseTags
    ).toBe("{version}");
    expect(() => parseCli(["apply", "--release-tags", "{web"])).toThrow(
      "--release-tags must be none"
    );
  });
});

describe("release-tag detection", () => {
  test("recommends an existing v style and ignores tags that only look related", async () => {
    const repo = await gitRepository([
      "v1.0.0",
      "v1.1.0",
      "v11.1.0",
      "builds/ios/1.1.0/45",
      "v1.1.0-45",
    ]);
    await writeText(repo, "CHANGELOG.md", changelog("1.1.0", "1.0.0"));

    const inspection = await inspect(repo, "web");

    expect(inspection.releaseTags).toMatchObject({
      ciTriggers: [],
      convention: "v{version}",
      reason: null,
      recommended: "v{version}",
      stored: null,
      tooling: [],
    });
    expect(inspection.releaseTags?.evidence).toContain(
      "Local tags follow v{version}: v1.0.0, v1.1.0"
    );
  });

  test("keeps a custom prefix, accepts the only release, and defaults to v without one", async () => {
    const custom = await gitRepository(["release-0.9.0", "release-1.0.0"]);
    await writeText(custom, "CHANGELOG.md", changelog("1.0.0", "0.9.0"));
    const single = await gitRepository(["app/1.0.0"]);
    await writeText(single, "CHANGELOG.md", changelog("[1.0.0] - 2026-10-01"));
    const unmatched = await gitRepository(["v2.0.0", "nightly"]);
    await writeText(unmatched, "CHANGELOG.md", changelog("1.1.0", "1.0.0"));
    const empty = await gitRepository();
    const notGit = await temporaryDirectory("plain");
    // One tag for two releases is not a convention, and `v11.1.0` is never
    // `v1` plus `1.1.0`.
    const oneOfTwo = await gitRepository(["release-1.0.0"]);
    await writeText(oneOfTwo, "CHANGELOG.md", changelog("1.1.0", "1.0.0"));
    const lookalike = await gitRepository(["v11.0.0", "v11.1.0"]);
    await writeText(lookalike, "CHANGELOG.md", changelog("1.1.0", "1.0.0"));

    const [
      customTags,
      singleTags,
      unmatchedTags,
      emptyTags,
      plainTags,
      oneOfTwoTags,
      lookalikeTags,
    ] = await Promise.all(
      [custom, single, unmatched, empty, notGit, oneOfTwo, lookalike].map(
        async (repo) => (await inspect(repo, "mobile")).releaseTags
      )
    );
    for (const releaseTags of [oneOfTwoTags, lookalikeTags]) {
      expect(releaseTags?.convention).toBeNull();
      expect(releaseTags?.recommended).toBe("v{version}");
    }

    expect(customTags?.recommended).toBe("release-{version}");
    expect(singleTags?.recommended).toBe("app/{version}");
    expect(unmatchedTags?.recommended).toBe("v{version}");
    expect(unmatchedTags?.convention).toBeNull();
    expect(unmatchedTags?.evidence).toContain(
      "No local tag names a released version"
    );
    expect(emptyTags?.evidence).toContain("No local Git tags");
    expect(plainTags?.evidence).toContain("Local Git tags could not be read");
    expect(plainTags?.recommended).toBe("v{version}");
  });

  test("maps per-package tag styles and gives untagged trains their own", async () => {
    const repo = await gitRepository([
      "web@1.0.0",
      "web@1.1.0",
      "mobile@2.0.0",
    ]);
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.1.0" }),
      writeText(repo, "apps/web/CHANGELOG.md", changelog("1.1.0", "1.0.0")),
      writeJson(repo, "apps/mobile/app.json", { expo: { version: "2.0.0" } }),
      writeJson(repo, "apps/desktop/src-tauri/tauri.conf.json", {
        version: "0.3.0",
      }),
    ]);

    const inspection = await inspect(repo);

    expect(inspection.releaseTags?.recommended).toEqual({
      desktop: "desktop@{version}",
      mobile: "mobile@{version}",
      web: "web@{version}",
    });
    expect(inspection.releaseTags?.evidence).toEqual(
      expect.arrayContaining([
        "3 public release trains: desktop, mobile, web",
        "web tags follow web@{version}: web@1.0.0, web@1.1.0",
        "mobile tags follow mobile@{version}: mobile@2.0.0",
      ])
    );
  });

  test("recommends one tag per train without tags, and one style when the trains are shared", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.0.0" }),
      writeJson(repo, "apps/mobile/app.json", { expo: { version: "1.0.0" } }),
    ]);
    const separate = await inspect(repo);
    await writeJson(
      repo,
      ".simple-changelogs.json",
      policyFor("full", 24, { crossSurfaceVersioning: "shared" })
    );
    const shared = await inspect(repo);

    expect(separate.releaseTags?.recommended).toEqual({
      mobile: "mobile@{version}",
      web: "web@{version}",
    });
    expect(shared.releaseTags?.recommended).toBe("v{version}");
  });

  test("drops colliding per-train styles", async () => {
    const repo = await gitRepository(["v1.0.0", "v1.1.0"]);
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.1.0" }),
      writeText(repo, "apps/web/CHANGELOG.md", changelog("1.1.0", "1.0.0")),
      writeJson(repo, "apps/mobile/app.json", { expo: { version: "1.1.0" } }),
      writeText(repo, "apps/mobile/CHANGELOG.md", changelog("1.1.0", "1.0.0")),
    ]);

    const inspection = await inspect(repo);

    expect(inspection.releaseTags?.convention).toBeNull();
    expect(inspection.releaseTags?.recommended).toEqual({
      mobile: "mobile@{version}",
      web: "web@{version}",
    });
  });

  test("keeps distinct per-train styles when trains share version numbers", async () => {
    const repo = await gitRepository([
      "mobile-release-1.0.0",
      "mobile-release-1.1.0",
      "web-release-1.0.0",
      "web-release-1.1.0",
    ]);
    await Promise.all(
      ["web", "mobile"].flatMap((app) => [
        writeJson(repo, `apps/${app}/package.json`, { version: "1.1.0" }),
        writeText(
          repo,
          `apps/${app}/CHANGELOG.md`,
          changelog("1.1.0", "1.0.0")
        ),
      ])
    );

    const inspection = await inspect(repo);

    expect(inspection.releaseTags?.recommended).toEqual({
      mobile: "mobile-release-{version}",
      web: "web-release-{version}",
    });
  });

  test("never borrows another train's style and prefers a train's own", async () => {
    const borrowed = await gitRepository([
      "mobile-release-1.0.0",
      "mobile-release-1.1.0",
    ]);
    const preferred = await gitRepository([
      "mobile-2.0.0",
      "v1.0.0",
      "v1.1.0",
      "web-v1.0.0",
      "web-v1.1.0",
    ]);
    await Promise.all([
      ...["web", "mobile"].flatMap((app) => [
        writeJson(borrowed, `apps/${app}/package.json`, { version: "1.1.0" }),
        writeText(
          borrowed,
          `apps/${app}/CHANGELOG.md`,
          changelog("1.1.0", "1.0.0")
        ),
      ]),
      writeJson(preferred, "apps/web/package.json", { version: "1.1.0" }),
      writeText(
        preferred,
        "apps/web/CHANGELOG.md",
        changelog("1.1.0", "1.0.0")
      ),
      writeJson(preferred, "apps/mobile/app.json", {
        expo: { version: "2.0.0" },
      }),
    ]);

    const [untagged, own] = await Promise.all([
      inspect(borrowed),
      inspect(preferred),
    ]);

    // Web has no tags of its own, so it gets the default, not mobile's.
    expect(untagged.releaseTags?.recommended).toEqual({
      mobile: "mobile-release-{version}",
      web: "web@{version}",
    });
    expect(own.releaseTags?.recommended).toEqual({
      mobile: "mobile-{version}",
      web: "web-v{version}",
    });
  });

  test("credits a prefix to the most specific train name it contains", async () => {
    const repo = await gitRepository([
      "web-admin-release-1.0.0",
      "web-admin-release-1.1.0",
      "web-release-1.0.0",
      "web-release-1.1.0",
    ]);
    await Promise.all(
      ["web", "web-admin"].flatMap((app) => [
        writeJson(repo, `apps/${app}/package.json`, { version: "1.1.0" }),
        writeText(
          repo,
          `apps/${app}/CHANGELOG.md`,
          changelog("1.1.0", "1.0.0")
        ),
      ])
    );

    expect((await inspect(repo)).releaseTags?.recommended).toEqual({
      web: "web-release-{version}",
      "web-admin": "web-admin-release-{version}",
    });
  });

  test("credits a root heading to the most specific train it names", async () => {
    const repo = await gitRepository(["web-release-1.0.0", "web-admin-2.0.0"]);
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.1.0" }),
      writeJson(repo, "apps/web-admin/package.json", { version: "2.1.0" }),
      writeText(
        repo,
        "CHANGELOG.md",
        changelog("Web 1.0.0 - 2026-09-01", "Web-Admin 2.0.0 - 2026-09-02")
      ),
    ]);

    expect((await inspect(repo)).releaseTags?.recommended).toEqual({
      web: "web-release-{version}",
      "web-admin": "web-admin-{version}",
    });
  });

  test("never drops a train whose name cannot form a template", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.0.0" }),
      writeJson(repo, "apps/\u00fcber/package.json", { version: "1.0.0" }),
    ]);

    const { releaseTags } = await inspect(repo);

    expect([...(releaseTags?.trains ?? [])].sort()).toEqual([
      "web",
      "\u00fcber",
    ]);
    expect(releaseTags?.recommended).toBe("none");
    expect(releaseTags?.reason).toContain("chosen by hand");
  });

  test("never recommends default per-train styles that could collide", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.0.0" }),
      writeJson(repo, "apps/web@next/package.json", { version: "2.0.0" }),
    ]);

    const inspection = await inspect(repo);
    const configured = await onboard(repo);

    expect(inspection.releaseTags?.recommended).toBe("none");
    expect(inspection.releaseTags?.reason).toContain("chosen by hand");
    expect(configured.status).toBe("configured");
    expect(
      (await readJson(join(repo, ".simple-changelogs.json"))).releaseTags
    ).toBe("none");
  });

  test("counts an owner's version only when no release heading names the train", async () => {
    const repo = await gitRepository([
      "web-release-1.0.0",
      "mobile-release-2.0.0",
    ]);
    await Promise.all([
      // Web's owner already reads 1.1.0, which is not released yet.
      writeJson(repo, "apps/web/package.json", { version: "1.1.0" }),
      writeText(repo, "apps/web/CHANGELOG.md", changelog("1.0.0")),
      writeJson(repo, "apps/mobile/app.json", { expo: { version: "2.0.0" } }),
    ]);

    const inspection = await inspect(repo);

    expect(inspection.releaseTags?.recommended).toEqual({
      mobile: "mobile-release-{version}",
      web: "web-release-{version}",
    });
  });

  test("narrow distributions detect several trains too", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "apps/site-a/package.json", { version: "1.0.0" }),
      writeJson(repo, "apps/site-b/package.json", { version: "2.0.0" }),
    ]);

    const inspection = await inspect(repo, "web");
    const blocked = await onboard(repo, {
      distribution: "web",
      mobileReleaseNotePlacement: undefined,
      releaseTags: "v{version}",
    });

    expect(Object.hasOwn(inspection.inventory, "versionTrains")).toBe(false);
    expect(inspection.releaseTags?.trains).toEqual(["site-a", "site-b"]);
    expect(inspection.releaseTags?.recommended).toEqual({
      "site-a": "site-a@{version}",
      "site-b": "site-b@{version}",
    });
    expect(blocked.status).toBe("blocked");
    expect(blocked.errors.join(" ")).toContain(
      "one template per release train"
    );
  });

  test("release trains add a root product and published packages, never a workspace root or private library", async () => {
    const product = await gitRepository();
    await Promise.all([
      writeJson(product, "package.json", {
        dependencies: { next: "16.0.0" },
        name: "lantern",
        private: true,
        version: "1.4.0",
      }),
      writeJson(product, "apps/mobile/app.json", {
        expo: { version: "2.0.0" },
      }),
      writeJson(product, "packages/sdk/package.json", {
        name: "@acme/sdk",
        version: "1.2.0",
      }),
      writeJson(product, "packages/ui/package.json", {
        name: "@acme/ui",
        private: true,
        version: "0.1.0",
      }),
      writeJson(product, "packages/config/package.json", { name: "config" }),
    ]);
    const workspace = await gitRepository();
    await Promise.all([
      writeJson(workspace, "package.json", {
        name: "acme",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
      }),
      writeJson(workspace, "packages/sdk/package.json", {
        name: "@acme/sdk",
        version: "1.2.0",
      }),
      writeJson(workspace, "packages/cli/package.json", { version: "2.0.0" }),
    ]);
    const pnpm = await gitRepository();
    await Promise.all([
      writeJson(pnpm, "package.json", { name: "acme", version: "0.0.0" }),
      writeText(pnpm, "pnpm-workspace.yaml", "packages:\n  - packages/*\n"),
      writeJson(pnpm, "packages/sdk/package.json", {
        name: "@acme/sdk",
        version: "1.2.0",
      }),
    ]);

    const [full, web, workspaceTags, pnpmTags] = await Promise.all([
      inspect(product),
      inspect(product, "web"),
      inspect(workspace, "web"),
      inspect(pnpm, "web"),
    ]);
    const sorted = (trains?: string[]) => [...(trains ?? [])].sort();

    expect(sorted(full.releaseTags?.trains)).toEqual([
      "@acme/sdk",
      "lantern",
      "mobile",
    ]);
    expect(full.releaseTags?.recommended).toEqual({
      "@acme/sdk": "@acme/sdk@{version}",
      lantern: "lantern@{version}",
      mobile: "mobile@{version}",
    });
    // Shared version lines still relate apps only.
    expect(full.inventory.versionTrains).toEqual([
      { path: "apps/mobile/app.json", train: "mobile", version: "2.0.0" },
    ]);
    expect(web.releaseTags?.trains).toEqual(full.releaseTags?.trains);
    expect(sorted(workspaceTags.releaseTags?.trains)).toEqual([
      "@acme/sdk",
      "cli",
    ]);
    expect(pnpmTags.releaseTags?.trains).toEqual(["@acme/sdk"]);
    expect(pnpmTags.releaseTags?.recommended).toBe("v{version}");
  });

  test("a sole train's own changelog finds its tag style", async () => {
    const repo = await gitRepository(["sdk-release-1.0.0"]);
    await Promise.all([
      writeJson(repo, "package.json", {
        private: true,
        workspaces: ["packages/*"],
      }),
      writeJson(repo, "packages/sdk/package.json", {
        name: "@acme/sdk",
        version: "1.1.0",
      }),
      writeText(repo, "packages/sdk/CHANGELOG.md", changelog("1.0.0")),
    ]);

    const { releaseTags } = await inspect(repo, "web");

    expect(releaseTags?.trains).toEqual(["@acme/sdk"]);
    expect(releaseTags?.recommended).toBe("sdk-release-{version}");
    expect(releaseTags?.evidence).not.toContain(
      "No local tag names a released version"
    );
  });

  test("a root product beside its own root app owners stays one train", async () => {
    const expo = await gitRepository();
    await Promise.all([
      writeJson(expo, "package.json", { name: "trail", version: "3.0.0" }),
      writeJson(expo, "app.json", { expo: { version: "3.0.0" } }),
    ]);
    const native = await gitRepository();
    await Promise.all([
      writeJson(native, "package.json", {
        dependencies: { "react-native": "0.79.0" },
        name: "trail",
        version: "3.0.0",
      }),
      writeText(native, "android/app/build.gradle", gradle("3.0.0")),
    ]);
    const desktop = await gitRepository();
    await Promise.all([
      writeJson(desktop, "package.json", {
        devDependencies: { "@tauri-apps/cli": "2.0.0" },
        name: "trail",
        version: "3.0.0",
      }),
      writeJson(desktop, "src-tauri/tauri.conf.json", { version: "3.0.0" }),
    ]);
    const alone = await gitRepository();
    await writeJson(alone, "package.json", {
      name: "lantern",
      version: "1.0.0",
    });

    const [expoTags, nativeTags, desktopTags, aloneTags] = await Promise.all(
      [expo, native, desktop, alone].map(
        async (repo) => (await inspect(repo)).releaseTags
      )
    );

    expect(expoTags?.trains).toEqual(["mobile"]);
    expect(nativeTags?.trains).toEqual(["android"]);
    expect(desktopTags?.trains).toEqual(["desktop"]);
    expect(aloneTags?.trains).toEqual(["lantern"]);
    for (const releaseTags of [expoTags, nativeTags, desktopTags, aloneTags]) {
      expect(releaseTags?.recommended).toBe("v{version}");
    }
  });

  test("a root product beside an unrelated root native or Tauri app is its own train", async () => {
    // A Next.js site and an Android app with separate histories are two
    // products, so one template would let both claim one name.
    const native = await gitRepository();
    await Promise.all([
      writeJson(native, "package.json", {
        dependencies: { next: "16.0.0" },
        name: "site",
        version: "1.0.0",
      }),
      writeText(native, "android/app/build.gradle", gradle("5.0.0")),
    ]);
    const desktop = await gitRepository();
    await Promise.all([
      writeJson(desktop, "package.json", {
        dependencies: { next: "16.0.0" },
        name: "site",
        version: "1.0.0",
      }),
      writeJson(desktop, "src-tauri/tauri.conf.json", { version: "5.0.0" }),
    ]);

    // Named like the app beside it, a site is still its own product, keyed
    // by its directory.
    const namedNative = await gitRepository();
    await Promise.all([
      writeJson(namedNative, "package.json", {
        dependencies: { next: "16.0.0" },
        name: "android",
        version: "1.0.0",
      }),
      writeText(namedNative, "android/app/build.gradle", gradle("5.0.0")),
    ]);
    const namedDesktop = await gitRepository();
    await Promise.all([
      writeJson(namedDesktop, "package.json", {
        dependencies: { next: "16.0.0" },
        name: "desktop",
        version: "1.0.0",
      }),
      writeJson(namedDesktop, "src-tauri/tauri.conf.json", {
        version: "5.0.0",
      }),
    ]);
    // A root Expo app mirrors only its own native projects, never another
    // member's.
    const expo = await gitRepository();
    await Promise.all([
      writeJson(expo, "app.json", { expo: { version: "1.0.0" } }),
      writeText(expo, "apps/admin/android/app/build.gradle", gradle("2.0.0")),
    ]);

    const repos = [native, desktop, namedNative, namedDesktop, expo];
    const inspected = await Promise.all(repos.map((repo) => inspect(repo)));
    const [
      nativeTags,
      desktopTags,
      namedNativeTags,
      namedDesktopTags,
      expoTags,
    ] = inspected.map(({ releaseTags }) => releaseTags);

    expect(nativeTags?.trains).toEqual(["android", "site"]);
    expect(nativeTags?.recommended).toEqual({
      android: "android@{version}",
      site: "site@{version}",
    });
    expect(desktopTags?.trains).toEqual(["site", "desktop"]);
    expect(namedNativeTags?.trains).toEqual(["android", "."]);
    expect(namedDesktopTags?.trains).toEqual([".", "desktop"]);
    expect(expoTags?.trains).toEqual(["mobile", "android"]);
    // Shared version lines relate the same app trains as before.
    expect(inspected[4]?.inventory.versionTrains).toEqual([
      { path: "app.json", train: "mobile", version: "1.0.0" },
    ]);
    const refused = await Promise.all(
      repos.map((repo) => onboard(repo, { releaseTags: "v{version}" }))
    );
    for (const result of refused) {
      expect(result.status).toBe("blocked");
      expect(result.errors.join(" ")).toContain(
        "one template per release train"
      );
    }
  });

  test("a published package named like an app, or a second app's native project, is its own train", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.0.0" }),
      writeJson(repo, "packages/web/package.json", {
        name: "web",
        version: "2.0.0",
      }),
    ]);
    // A root product named like an app is keyed by its directory, since the
    // app keeps the name shared version lines know it by.
    const rooted = await gitRepository();
    await Promise.all([
      writeJson(rooted, "package.json", { name: "web", version: "3.0.0" }),
      writeJson(rooted, "apps/web/package.json", { version: "1.0.0" }),
    ]);
    // packages/ sorts before src-tauri/, yet the Tauri app keeps its name.
    const desktop = await gitRepository();
    await Promise.all([
      writeJson(desktop, "packages/desktop/package.json", { version: "2.0.0" }),
      writeJson(desktop, "src-tauri/tauri.conf.json", { version: "1.0.0" }),
    ]);
    const natives = await gitRepository();
    await Promise.all([
      writeText(natives, "android/app/build.gradle", gradle("1.0.0")),
      writeText(
        natives,
        "apps/admin/android/app/build.gradle",
        gradle("4.0.0")
      ),
      writeText(natives, "apps/admin/ios/App/Info.plist", plist("4.0.0")),
      writeText(natives, "ios/App/Info.plist", plist("1.0.0")),
    ]);

    const [full, rootedFull, desktopFull, nativeFull] = await Promise.all([
      inspect(repo),
      inspect(rooted),
      inspect(desktop),
      inspect(natives),
    ]);

    expect(full.releaseTags?.trains).toEqual(["web", "packages/web"]);
    expect(full.releaseTags?.recommended).toEqual({
      "packages/web": "packages/web@{version}",
      web: "web@{version}",
    });
    expect(rootedFull.releaseTags?.trains).toEqual(["web", "."]);
    expect(desktopFull.releaseTags?.trains).toEqual([
      "packages/desktop",
      "desktop",
    ]);
    expect(desktopFull.inventory.versionTrains).toEqual([
      { path: "src-tauri/tauri.conf.json", train: "desktop", version: "1.0.0" },
    ]);
    expect(nativeFull.releaseTags?.trains).toEqual([
      "android",
      "apps/admin/android",
      "ios",
      "./ios",
    ]);
    // Shared version lines relate the same app trains as before.
    for (const inspected of [full, rootedFull]) {
      expect(inspected.inventory.versionTrains).toEqual([
        { path: "apps/web/package.json", train: "web", version: "1.0.0" },
      ]);
    }
    expect(nativeFull.inventory.versionTrains).toEqual([
      { path: "android/app/build.gradle", train: "android", version: "1.0.0" },
      {
        path: "apps/admin/ios/App/Info.plist",
        train: "ios",
        version: "4.0.0",
      },
    ]);
    const refused = await onboard(repo, { releaseTags: "v{version}" });
    expect(refused.status).toBe("blocked");
    expect(refused.errors.join(" ")).toContain(
      "one template per release train"
    );
  });

  test("a root product's own history is the root changelog, less other trains' headings", async () => {
    // Lantern released only 1.0.0; Mobile 2.0.0 is not Lantern's release, so
    // Lantern's one tag is still its convention.
    const repo = await gitRepository(["lantern-release-1.0.0", "mobile-2.0.0"]);
    await Promise.all([
      writeJson(repo, "package.json", { name: "lantern", version: "1.2.0" }),
      writeJson(repo, "apps/mobile/app.json", { expo: { version: "2.0.0" } }),
      writeText(
        repo,
        "CHANGELOG.md",
        changelog("Mobile 2.0.0 - 2026-09-10", "1.0.0 - 2026-09-01")
      ),
    ]);

    expect((await inspect(repo)).releaseTags?.recommended).toEqual({
      lantern: "lantern-release-{version}",
      mobile: "mobile-{version}",
    });
  });

  test("shared version lines keep one tag per train", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.0.0" }),
      writeJson(repo, "apps/mobile/app.json", { expo: { version: "1.0.0" } }),
      writeJson(repo, "packages/sdk/package.json", {
        name: "@acme/sdk",
        version: "4.0.0",
      }),
    ]);

    const inspection = await inspect(repo);
    const result = await onboard(repo, {
      sharedVersionLines: [{ mode: "catch-up", trains: ["mobile", "web"] }],
    });
    const policy = await readJson(join(repo, ".simple-changelogs.json"));

    expect(inspection.unresolvedQuestions).toContain("shared-version-lines");
    expect(
      inspection.inventory.versionTrains?.map(({ train }) => train)
    ).toEqual(["mobile", "web"]);
    expect(result.status).toBe("configured");
    expect(policy.sharedVersionLines).toEqual([
      { mode: "catch-up", trains: ["mobile", "web"] },
    ]);
    expect(policy.releaseTags).toEqual({
      "@acme/sdk": "@acme/sdk@{version}",
      mobile: "mobile@{version}",
      web: "web@{version}",
    });
  });

  test("a recommended setup never stores a setting classify refuses", async () => {
    type Layout = Record<string, unknown>;
    const layouts: [Layout, Partial<ApplyOptions>][] = [
      [{ "package.json": { name: "lantern", version: "1.0.0" } }, {}],
      [
        {
          "apps/mobile/app.json": { expo: { version: "2.0.0" } },
          "package.json": { name: "lantern", version: "1.0.0" },
        },
        {},
      ],
      [
        {
          "package.json": { private: true, workspaces: ["packages/*"] },
          "packages/cli/package.json": { name: "acme-cli", version: "1.0.0" },
          "packages/sdk/package.json": { name: "@acme/sdk", version: "1.0.0" },
        },
        {},
      ],
      [
        {
          "apps/mobile/app.json": { expo: { version: "1.0.0" } },
          "apps/web/package.json": { version: "1.0.0" },
        },
        { crossSurfaceVersioning: "shared" },
      ],
      [
        {
          "apps/mobile/app.json": { expo: { version: "1.0.0" } },
          "apps/web/package.json": { version: "1.0.0" },
        },
        {
          sharedVersionLines: [
            { mode: "bump-shared", trains: ["mobile", "web"] },
          ],
        },
      ],
    ];
    const outcomes = await Promise.all(
      layouts.map(async ([files, options]) => {
        const repo = await gitRepository();
        await Promise.all(
          Object.entries(files).map(([path, value]) =>
            writeJson(repo, path, value)
          )
        );
        const result = await onboard(repo, options);
        const policy = await readJson(join(repo, ".simple-changelogs.json"));
        const { releaseTags } = await inspect(repo);
        // Classify counts the trains inspection reports, folded to one when
        // the surfaces are shared.
        const trains =
          policy.crossSurfaceVersioning === "shared"
            ? ["web"]
            : (releaseTags?.trains ?? []);
        return {
          decisions: (trains.length > 0 ? trains : ["default"]).map((train) =>
            releaseTagFor({
              displayName: "Acme",
              publicTrains: trains.length,
              setting: policy.releaseTags as ReleaseTagsSetting,
              train,
              version: "1.0.0",
            })
          ),
          status: result.status,
        };
      })
    );

    for (const { decisions, status } of outcomes) {
      expect(status).toBe("configured");
      for (const decision of decisions) {
        expect(Object.hasOwn(decision, "reasonCode")).toBe(false);
      }
    }
  });

  test("recommends none when release tooling already creates tags", async () => {
    const cases: [string, Record<string, string>][] = [
      [
        "semantic-release",
        {
          "package.json": JSON.stringify({
            devDependencies: { "semantic-release": "24.0.0" },
          }),
        },
      ],
      ["release-please", { "release-please-config.json": "{}" }],
      ["goreleaser", { ".goreleaser.yaml": "version: 2\n" }],
      [
        "cargo-release",
        {
          "Cargo.toml": '[package]\nname = "x"\n\n[package.metadata.release]\n',
        },
      ],
      [
        "Fastlane add_git_tag",
        { "ios/fastlane/Fastfile": "lane :beta do\n  add_git_tag\nend\n" },
      ],
      [
        "a version or tag script",
        {
          "apps/web/package.json": JSON.stringify({
            scripts: { release: "npm version minor" },
          }),
        },
      ],
      ["@changesets/cli", { ".changeset/config.json": "{}" }],
    ];
    const inspections = await Promise.all(
      cases.map(async ([, files]) => {
        const repo = await gitRepository(["v1.0.0", "v1.1.0"]);
        await writeText(repo, "CHANGELOG.md", changelog("1.1.0", "1.0.0"));
        await Promise.all(
          Object.entries(files).map(([path, content]) =>
            writeText(repo, path, content)
          )
        );
        return (await inspect(repo, "web")).releaseTags;
      })
    );

    for (const [index, [tool]] of cases.entries()) {
      const inspection = inspections[index];
      expect(inspection?.recommended).toBe("none");
      expect(inspection?.convention).toBe("v{version}");
      expect(inspection?.tooling.join(" ")).toContain(tool);
      expect(inspection?.reason).toEndWith(
        tool === "a version or tag script"
          ? "may already create this repository's tags"
          : "already creates this repository's tags"
      );
    }
  });

  test("a script naming a version command or git tag is tag tooling", async () => {
    const cases: [string, boolean][] = [
      ["npm version minor", true],
      ["npm -w apps/web version patch", true],
      ["/usr/local/bin/npm version patch", true],
      ['npm --message "Release %s; notes" version patch', true],
      ["pnpm --filter web version patch", true],
      ["bun pm version minor", true],
      ["yarn version --new-version 2.0.0", true],
      ["npm verison patch", true],
      ["npm run build && npm version minor", true],
      ["git tag v1.2.0", true],
      ["/usr/bin/git -C . tag v1.2.0", true],
      // Turning tagging off is not recognized, so the guess errs toward no
      // tags, which the user can change.
      ["npm version patch --no-git-tag-version", true],
      ["npm --version", false],
      ["node --version && bun --version", false],
      ["bun run version-check", false],
      ["npm run build", false],
      ["git push --tags", false],
      ["changeset version", false],
    ];
    const inspections = await Promise.all(
      cases.map(async ([release]) => {
        const repo = await gitRepository(["v1.0.0", "v1.1.0"]);
        await writeText(repo, "CHANGELOG.md", changelog("1.1.0", "1.0.0"));
        await writeText(
          repo,
          "package.json",
          JSON.stringify({ scripts: { release } })
        );
        return (await inspect(repo, "web")).releaseTags;
      })
    );

    for (const [index, [, tags]] of cases.entries()) {
      const inspection = inspections[index];
      expect(inspection?.convention).toBe("v{version}");
      expect(inspection?.recommended).toBe(tags ? "none" : "v{version}");
      expect(
        inspection?.tooling.join(" ").includes("a version or tag script")
      ).toBe(tags);
    }
  });

  test("recommends none for date-only releases and reports date tags", async () => {
    const repo = await gitRepository([
      "release-2026-10-01",
      "release-2026-10-07",
    ]);
    await writeText(
      repo,
      "CHANGELOG.md",
      changelog("2026-10-07", "2026-10-01")
    );

    const { releaseTags } = await inspect(repo, "web");

    expect(releaseTags?.recommended).toBe("none");
    expect(releaseTags?.reason).toContain("named by date");
    expect(releaseTags?.convention).toBe("release-{version}");
    expect(releaseTags?.evidence).toContain(
      "Release headings are dated, not numbered"
    );
  });

  test("reports CI that runs on tag pushes without changing the recommendation", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeText(
        repo,
        ".github/workflows/release.yml",
        "on:\n  push:\n    tags:\n      - 'v*'\n"
      ),
      writeText(
        repo,
        ".github/workflows/ci.yml",
        "on: pull_request\njobs:\n  x:\n    if: github.ref_type == 'tag'\n    steps:\n      - run: echo refs/tags/v1\n"
      ),
      writeText(
        repo,
        ".github/workflows/branches.yml",
        "on:\n  push:\n    branches: [main]\n"
      ),
      writeText(repo, ".github/workflows/any-push.yaml", "on: [push]\n"),
      writeText(repo, ".github/workflows/create.yml", "on: create\n"),
      writeText(repo, ".github/workflows/broken.yml", "on: [push\n"),
      writeText(
        repo,
        ".github/workflows/no-tags.yml",
        "on:\n  push:\n    tags-ignore: ['**']\n"
      ),
      writeText(
        repo,
        ".github/workflows/some-tags.yml",
        "on:\n  push:\n    branches: [main]\n    tags-ignore: ['nightly-*']\n"
      ),
      writeText(
        repo,
        ".gitlab-ci.yml",
        "deploy:\n  rules:\n    - if: $CI_COMMIT_TAG =~ /^v/\n  script: echo deploy\n"
      ),
    ]);

    const { releaseTags } = await inspect(repo, "web");

    // Only triggers count: a workflow that merely mentions tags does not.
    expect(releaseTags?.ciTriggers).toEqual([
      ".github/workflows/any-push.yaml",
      ".github/workflows/create.yml",
      ".github/workflows/release.yml",
      ".github/workflows/some-tags.yml",
      ".gitlab-ci.yml",
    ]);
    expect(releaseTags?.recommended).toBe("v{version}");
  });

  test("reads GitLab tag triggers from only and rules, not from scripts", async () => {
    const pipelines: [string, boolean][] = [
      ["build:\n  only: [tags]\n  script: make\n", true],
      ["build:\n  only:\n    refs: [tags, main]\n  script: make\n", true],
      ["workflow:\n  rules:\n    - if: $CI_COMMIT_TAG\n", true],
      ["build:\n  except: [tags]\n  script: make\n", false],
      [
        "build:\n  rules:\n    - if: $CI_COMMIT_BRANCH\n  script: echo $CI_COMMIT_TAG\n",
        false,
      ],
      [
        "build:\n  rules:\n    - if: $CI_COMMIT_TAG == null\n    - if: $CI_COMMIT_TAG\n      when: never\n  script: make\n",
        false,
      ],
    ];
    const results = await Promise.all(
      pipelines.map(async ([pipeline]) => {
        const repo = await gitRepository();
        await writeText(repo, ".gitlab-ci.yml", pipeline);
        return (await inspect(repo, "web")).releaseTags?.ciTriggers;
      })
    );

    expect(results).toEqual(
      pipelines.map(([, triggered]) => (triggered ? [".gitlab-ci.yml"] : []))
    );
  });

  test("CMS-only inspection has no release tags", async () => {
    const repo = await gitRepository(["v1.0.0"]);
    const inspection = await inspect(repo, "cms");

    expect(inspection.releaseTags).toBeNull();
    expect(inspection.unresolvedQuestions).not.toContain("release-tags");
    expect(inspection.onboardingContribution).toBeNull();
  });
});

describe("release tags at onboarding", () => {
  test("every versioned distribution asks the required question; CMS never does", async () => {
    const repo = await gitRepository();
    const distributions = [
      "full",
      "web",
      "mobile",
      "web-cms",
      "skill-repository",
    ] as const;
    const inspections = await Promise.all(
      distributions.map((distribution) => inspect(repo, distribution))
    );

    for (const inspection of inspections) {
      expect(inspection.unresolvedQuestions).toContain("release-tags");
      expect(inspection.onboardingContribution?.questions).toContainEqual({
        id: "release-tags",
        required: true,
      });
      expect(
        inspection.onboardingContribution?.resolvedPreferences.releaseTags
      ).toBe("v{version}");
      expect(inspection.recommendation.policy?.releaseTags).toBe("v{version}");
    }
  });

  test("a confirmed setup always stores a value, recommended or chosen", async () => {
    const recommended = await gitRepository(["release-1.0.0"]);
    await writeText(recommended, "CHANGELOG.md", changelog("1.0.0"));
    const chosen = await gitRepository();

    const [first, second] = await Promise.all([
      onboard(recommended, {
        backfillStatus: "declined",
        distribution: "web",
        mobileReleaseNotePlacement: undefined,
        scope: "all-projects",
      }),
      onboard(chosen, { releaseTags: { web: "web@{version}" } }),
    ]);
    const firstPolicy = await readJson(
      join(recommended, ".simple-changelogs.json")
    );
    const globalPath =
      first.writes.find(({ kind }) => kind === "global-preferences")?.path ??
      "";

    expect(first.status).toBe("configured");
    expect(firstPolicy.releaseTags).toBe("release-{version}");
    expect(first.selection.releaseTags).toBe("release-{version}");
    expect(Object.hasOwn(await readJson(globalPath), "releaseTags")).toBe(
      false
    );
    expect(second.status).toBe("configured");
    expect(
      (await readJson(join(chosen, ".simple-changelogs.json"))).releaseTags
    ).toEqual({ web: "web@{version}" });
  });

  test("recording the trains as shared stores one style", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.0.0" }),
      writeJson(repo, "apps/mobile/app.json", { expo: { version: "1.0.0" } }),
    ]);

    const result = await onboard(repo, { crossSurfaceVersioning: "shared" });

    expect(result.status).toBe("configured");
    expect(
      (await readJson(join(repo, ".simple-changelogs.json"))).releaseTags
    ).toBe("v{version}");
  });

  test("blocks CMS, run-only setup, invalid values, and one template for several trains without writing", async () => {
    const trains = await gitRepository();
    await Promise.all([
      writeJson(trains, "apps/web/package.json", { version: "1.0.0" }),
      writeJson(trains, "apps/mobile/app.json", { expo: { version: "1.0.0" } }),
    ]);
    const blocked = await Promise.all([
      onboard(await gitRepository(), {
        cmsAuthProven: true,
        cmsRoute: "/admin/changelog",
        cmsSurfaceProven: true,
        distribution: "cms",
        mobileReleaseNotePlacement: undefined,
        releaseTags: "v{version}",
      }),
      onboard(await gitRepository(), {
        releaseTags: "v{version}",
        scope: "run-only",
      }),
      onboard(await gitRepository(), { releaseTags: "v1{version}" }),
      onboard(trains, { releaseTags: "v{version}" }),
    ]);

    expect(blocked.map(({ status }) => status)).toEqual([
      "blocked",
      "blocked",
      "blocked",
      "blocked",
    ]);
    expect(blocked[0]?.errors.join(" ")).toContain("no release to tag");
    expect(blocked[1]?.errors.join(" ")).toContain("never run-only");
    expect(blocked[2]?.errors.join(" ")).toContain("digit or .");
    expect(blocked[3]?.errors.join(" ")).toContain(
      "one template per release train"
    );
    for (const result of blocked) {
      expect(
        existsSync(join(result.repository, ".simple-changelogs.json"))
      ).toBe(false);
    }
    expect(
      existsSync(
        join(blocked[0]?.repository ?? "", ".simple-changelogs-cms.json")
      )
    ).toBe(false);
  });

  test("a contextual update records the setting and an identical rerun writes nothing", async () => {
    const repo = await gitRepository();
    await writeJson(repo, ".simple-changelogs.json", policyFor("web", 25));
    const options: ApplyOptions = {
      configDirectory: await temporaryDirectory("config"),
      confirm: true,
      distribution: "web",
      releaseTags: "none",
      repo,
    };

    const updated = await applySetup(options);
    const rerun = await applySetup(options);

    expect(updated.status).toBe("configured");
    expect(updated.selection).toEqual({ releaseTags: "none" });
    expect(
      (await readJson(join(repo, ".simple-changelogs.json"))).releaseTags
    ).toBe("none");
    expect(rerun.status).toBe("already-configured");
  });
});

describe("release tags in the guidance-update notice", () => {
  test("asks once for each versioned distribution below 25 without a setting", async () => {
    const cases = [
      ["full", 24],
      ["web", 22],
      ["mobile", 21],
      ["web-cms", 22],
      ["skill-repository", 15],
    ] as const;
    const inspections = await Promise.all(
      cases.map(async ([distribution, version]) => {
        const repo = await gitRepository();
        await writeJson(
          repo,
          ".simple-changelogs.json",
          policyFor(distribution, version)
        );
        if (distribution === "web-cms") {
          await writeJson(repo, ".simple-changelogs-cms.json", {
            changelogPath: "CMS_CHANGELOG.json",
            cmsSurface: {
              access: "authenticated-operators",
              route: "/admin/changelog",
            },
            guidance: { backfillStatus: "not-applicable", version: 2 },
            newReleaseNoteSurfaces: "existing-only",
            schemaVersion: 1,
          });
        }
        return inspect(repo, distribution);
      })
    );

    for (const [index, [, recorded]] of cases.entries()) {
      expect(inspections[index]?.guidanceUpdate).toMatchObject({
        currentVersion: 25,
        questions: ["release-tags"],
        recordedVersion: recorded,
        userPrompt: null,
      });
      expect(
        inspections[index]?.guidanceUpdate?.changes.find(
          ({ version }) => version === 25
        )?.summary
      ).toContain("Git tag");
    }
  });

  test("skips the question when the setting exists, and CMS says nothing changes", async () => {
    const answered = await gitRepository();
    await writeJson(
      answered,
      ".simple-changelogs.json",
      policyFor("web", 22, { releaseTags: "none" })
    );
    const cms = await gitRepository();
    await writeJson(cms, ".simple-changelogs-cms.json", {
      changelogPath: "CMS_CHANGELOG.json",
      cmsSurface: { access: "authenticated-operators", route: "/admin/log" },
      guidance: { backfillStatus: "not-applicable", version: 7 },
      newReleaseNoteSurfaces: "existing-only",
      schemaVersion: 1,
    });
    await writeJson(cms, "CMS_CHANGELOG.json", {
      entries: [],
      schemaVersion: 1,
      title: "CMS Changelog",
    });

    const [web, operator] = await Promise.all([
      inspect(answered, "web"),
      inspect(cms, "cms"),
    ]);

    expect(web.guidanceUpdate?.currentVersion).toBe(25);
    expect(Object.hasOwn(web.guidanceUpdate ?? {}, "questions")).toBe(false);
    expect(operator.guidanceUpdate).toMatchObject({
      currentVersion: 25,
      recordedVersion: 7,
      summaryBullets: [
        "Nothing changes for CMS repositories; the guidance number now matches the other Simple Changelogs distributions.",
      ],
      userPrompt: null,
    });
    expect(Object.hasOwn(operator.guidanceUpdate ?? {}, "questions")).toBe(
      false
    );
  });

  test("is asked once, never again once the main track reaches 25", async () => {
    const repo = await gitRepository();
    await writeJson(repo, ".simple-changelogs.json", policyFor("web-cms", 25));
    await writeJson(repo, ".simple-changelogs-cms.json", {
      changelogPath: "CMS_CHANGELOG.json",
      cmsSurface: { access: "authenticated-operators", route: "/admin/log" },
      guidance: { backfillStatus: "not-applicable", version: 1 },
      newReleaseNoteSurfaces: "existing-only",
      schemaVersion: 1,
    });

    const inspection = await inspect(repo, "web-cms");

    // Only the CMS track is behind, so the notice exists without the question.
    expect(inspection.guidanceUpdate).toMatchObject({
      currentVersion: 2,
      recordedVersion: 1,
    });
    expect(Object.hasOwn(inspection.guidanceUpdate ?? {}, "questions")).toBe(
      false
    );
  });

  test("checks one template against the relationship the disposition keeps", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.0.0" }),
      writeJson(repo, "apps/mobile/app.json", { expo: { version: "1.0.0" } }),
      writeJson(
        repo,
        ".simple-changelogs.json",
        policyFor("full", 24, { crossSurfaceVersioning: "independent" })
      ),
    ]);
    const before = await readFile(
      join(repo, ".simple-changelogs.json"),
      "utf8"
    );

    // A guidance disposition saves no crossSurfaceVersioning, so a supplied
    // "shared" cannot make one template valid for two independent trains.
    const result = await applySetup({
      configDirectory: await temporaryDirectory("config"),
      confirm: true,
      crossSurfaceVersioning: "shared",
      distribution: "full",
      guidanceBackfill: "not-applicable",
      releaseTags: "v{version}",
      repo,
    });

    expect(result.status).toBe("blocked");
    expect(result.errors.join(" ")).toContain("one template per release train");
    expect(await readFile(join(repo, ".simple-changelogs.json"), "utf8")).toBe(
      before
    );
  });

  test("a relationship change rechecks a stored single template", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "apps/web/package.json", { version: "1.0.0" }),
      writeJson(repo, "apps/mobile/app.json", { expo: { version: "1.0.0" } }),
      writeJson(
        repo,
        ".simple-changelogs.json",
        policyFor("full", 25, {
          crossSurfaceVersioning: "shared",
          releaseTags: "v{version}",
        })
      ),
    ]);
    const before = await readFile(
      join(repo, ".simple-changelogs.json"),
      "utf8"
    );
    const update = async (extra: Partial<ApplyOptions>) =>
      applySetup({
        configDirectory: await temporaryDirectory("config"),
        confirm: true,
        crossSurfaceVersioning: "independent",
        distribution: "full",
        repo,
        ...extra,
      });

    const blocked = await update({});
    const unchanged = await readFile(
      join(repo, ".simple-changelogs.json"),
      "utf8"
    );
    const mapped = await update({
      releaseTags: { mobile: "mobile@{version}", web: "web@{version}" },
    });

    expect(blocked.status).toBe("blocked");
    expect(blocked.errors.join(" ")).toContain(
      "one template per release train"
    );
    expect(unchanged).toBe(before);
    expect(mapped.status).toBe("configured");
  });

  test("any later policy write rechecks a stored single template", async () => {
    const repo = await gitRepository();
    await Promise.all([
      writeJson(repo, "package.json", { name: "lantern", version: "1.0.0" }),
      writeJson(
        repo,
        ".simple-changelogs.json",
        policyFor("web", 25, { releaseTags: "v{version}" })
      ),
    ]);
    const options = {
      configDirectory: await temporaryDirectory("config"),
      confirm: true,
      distribution: "web" as const,
      repo,
    };
    // One train: an unrelated preference update writes.
    const single = await applySetup({ ...options, releaseNoteLinks: "ask" });
    // A published SDK makes a second train; the next write is refused.
    await writeJson(repo, "packages/sdk/package.json", {
      name: "@acme/sdk",
      version: "1.0.0",
    });
    const before = await readFile(
      join(repo, ".simple-changelogs.json"),
      "utf8"
    );
    const blocked = await applySetup({
      ...options,
      releaseNoteLinks: "disabled",
    });
    const unchanged = await readFile(
      join(repo, ".simple-changelogs.json"),
      "utf8"
    );
    const fixed = await applySetup({
      ...options,
      releaseNoteLinks: "disabled",
      releaseTags: { "@acme/sdk": "sdk@{version}", lantern: "v{version}" },
    });

    expect(single.status).toBe("configured");
    expect(blocked.status).toBe("blocked");
    expect(blocked.errors.join(" ")).toContain(
      "one template per release train"
    );
    expect(unchanged).toBe(before);
    expect(fixed.status).toBe("configured");
  });

  test("saves an answer with the disposition, and no answer records nothing", async () => {
    const answered = await gitRepository();
    const silent = await gitRepository();
    await Promise.all(
      [answered, silent].map((repo) =>
        writeJson(repo, ".simple-changelogs.json", policyFor("mobile", 21))
      )
    );
    const acknowledge = async (repo: string, extra: Partial<ApplyOptions>) =>
      applySetup({
        configDirectory: await temporaryDirectory("config"),
        confirm: true,
        distribution: "mobile",
        guidanceBackfill: "not-applicable",
        repo,
        ...extra,
      });

    const [withAnswer, withoutAnswer] = await Promise.all([
      acknowledge(answered, { releaseTags: "v{version}" }),
      acknowledge(silent, {}),
    ]);
    const [answeredPolicy, silentPolicy, after] = await Promise.all([
      readJson(join(answered, ".simple-changelogs.json")),
      readJson(join(silent, ".simple-changelogs.json")),
      inspect(silent, "mobile"),
    ]);

    expect(withAnswer.selection).toEqual({
      backfillStatus: "not-applicable",
      releaseTags: "v{version}",
    });
    expect(answeredPolicy.releaseTags).toBe("v{version}");
    expect(answeredPolicy.guidance).toEqual({
      backfillStatus: "not-applicable",
      version: 25,
    });
    expect(withoutAnswer.status).toBe("configured");
    expect(Object.hasOwn(silentPolicy, "releaseTags")).toBe(false);
    expect(silentPolicy.guidance).toEqual({
      backfillStatus: "not-applicable",
      version: 25,
    });
    expect(after.guidanceUpdate).toBeNull();
  });
});

// --- Protocol model: request v3, receipt v4, and negotiation. ---

const REVISION = "0123456789abcdef0123456789abcdef01234567";
const FINAL = "89abcdef0123456789abcdef0123456789abcdef";
const DIGEST = "a".repeat(64);
const TAG = { message: "Acme Web 1.4.0", name: "v1.4.0" };

const requestFor = (
  schemaVersion: 1 | 2 | 3,
  phase: "classify" | "prepare" | "verify",
  supportedReceiptVersions: number[] = schemaVersion === 3
    ? [1, 2, 3, 4]
    : [1, 2, 3]
) => ({
  approvedDecisionDigest: phase === "classify" ? null : DIGEST,
  approvedVersion: phase === "classify" ? null : "1.4.0",
  boundary: "web-production",
  finalizedTargetRevision: phase === "verify" ? FINAL : null,
  inputTargetRevision: REVISION,
  mutationScope: phase === "prepare" ? "prepare-release-files" : "read-only",
  phase,
  priorReceiptDigest: phase === "classify" ? null : DIGEST,
  releaseSetId: null,
  releaseTrain: "web",
  schemaVersion,
  ...(schemaVersion === 1 ? {} : { releaseSetTrains: null }),
  supportedReceiptVersions:
    schemaVersion === 1 ? [1, 2] : supportedReceiptVersions,
  transactionId: "release-01",
});

const receiptV2 = (state: "prepared" | "integrated"): ChangelogReceiptV2 => ({
  checks: ["Inspected the exact target."],
  decisionDigest: DIGEST,
  effectivePolicyDigest: DIGEST,
  evidence: ["Aggregate impact is minor."],
  observedAt: "2026-10-07T12:00:00-05:00",
  paths: state === "prepared" ? [{ digest: DIGEST, path: "CHANGELOG.md" }] : [],
  phase: state === "prepared" ? "prepare" : "verify",
  provider: "simple-changelogs",
  reason: null,
  reasonCode: null,
  release: {
    date: "2026-10-07",
    targetContainedUnreleased: state,
    version: "1.4.0",
  },
  releaseImpact: "minor",
  releaseSetId: null,
  requiredAction: null,
  revisionLineage: {
    finalizedTargetRevision: state === "integrated" ? FINAL : null,
    inputTargetRevision: REVISION,
    reconciliationHeadRevision: REVISION,
  },
  schemaVersion: 2,
  sourceRevision: state === "integrated" ? FINAL : REVISION,
  status: state === "prepared" ? "prepared" : "verified",
  transactionId: "release-01",
  versionDecision: {
    boundary: "web-production",
    bumpLevel: "minor",
    currentVersion: "1.3.0",
    policyAction: "automatic",
    releaseTrain: "web",
    resolution: "automatic",
    selectedVersion: "1.4.0",
    source: "repository-policy",
    suggestedVersion: "1.4.0",
  },
});

const receiptV4 = (
  state: "prepared" | "integrated",
  tag: ReleaseTag | null = TAG
): Record<string, unknown> =>
  shapeReceipt(
    validateChangelogRequest(
      requestFor(3, state === "prepared" ? "prepare" : "verify")
    ).value as ChangelogRequest,
    receiptV2(state),
    null,
    { tag }
  ) as unknown as Record<string, unknown>;

const errorsOf = (
  receipt: unknown,
  phase: "prepare" | "verify" = "prepare",
  prior?: unknown,
  schemaVersion: 2 | 3 = 3
): string[] => {
  const request = validateChangelogRequest({
    ...requestFor(schemaVersion, phase),
    ...(prior === undefined
      ? {}
      : { priorReceiptDigest: digestCanonicalJson(prior) }),
  }).value as ChangelogRequest;
  return validateChangelogReceipt(receipt, request, prior).errors;
};

describe("request v3 and receipt v4", () => {
  test("request v3 may advertise receipt v4; earlier requests may not", () => {
    expect(validateChangelogRequest(requestFor(3, "prepare")).errors).toEqual(
      []
    );
    expect(
      validateChangelogRequest(requestFor(2, "prepare", [1, 2, 3, 4])).errors
    ).toContain("supportedReceiptVersions is invalid");
    expect(
      validateChangelogRequest(requestFor(3, "prepare", [1, 2, 5])).errors
    ).toContain("supportedReceiptVersions is invalid");
  });

  test("prepared and verified v4 receipts carry the same release.tag", () => {
    const prepared = receiptV4("prepared");
    const verified = receiptV4("integrated");

    expect(prepared.schemaVersion).toBe(4);
    expect((prepared.release as Record<string, unknown>).tag).toEqual(TAG);
    expect((verified.release as Record<string, unknown>).tag).toEqual(TAG);
    expect(errorsOf(prepared)).toEqual([]);
    expect(errorsOf(verified, "verify", prepared)).toEqual([]);
    expect(errorsOf(receiptV4("prepared", null))).toEqual([]);
    expect(
      errorsOf(
        receiptV4("integrated", null),
        "verify",
        receiptV4("prepared", null)
      )
    ).toEqual([]);
  });

  test("refuses a tag dropped, changed, or added after prepare", () => {
    const prepared = receiptV4("prepared");
    const changed = [
      receiptV4("integrated", null),
      receiptV4("integrated", { ...TAG, name: "release-1.4.0" }),
      receiptV4("integrated", { ...TAG, message: "Acme 1.4.0" }),
    ];
    for (const receipt of changed) {
      expect(errorsOf(receipt, "verify", prepared)).toContain(
        "the release tag changed after prepare"
      );
    }
    expect(
      errorsOf(receiptV4("integrated"), "verify", receiptV4("prepared", null))
    ).toContain("the release tag changed after prepare");
    // A v3 receipt cannot name a tag, so it may follow only an untagged v4.
    const v3 = shapeReceipt(
      requestFor(2, "verify") as unknown as ChangelogRequest,
      receiptV2("integrated"),
      null
    );
    expect(v3.schemaVersion).toBe(3);
    expect(errorsOf(v3, "verify", prepared, 2)).toContain(
      "the release tag changed after prepare"
    );
    expect(
      errorsOf(v3, "verify", receiptV4("prepared", null), 2)
    ).not.toContain("the release tag changed after prepare");
    // Receipt v2 cannot name a tag either, so it may not drop one.
    const v2 = receiptV2("integrated");
    const v2Errors = (prior: unknown) =>
      validateChangelogReceipt(
        v2,
        validateChangelogRequest({
          ...requestFor(2, "verify", [1, 2]),
          priorReceiptDigest: digestCanonicalJson(prior),
        }).value as ChangelogRequest,
        prior
      ).errors;
    expect(v2Errors(prepared)).toContain(
      "the release tag changed after prepare"
    );
    expect(v2Errors(receiptV4("prepared", null))).toEqual([]);
  });

  test("refuses unbound names, refused names, and malformed tags", () => {
    const release = (tag: unknown) => ({
      ...receiptV4("prepared"),
      release: { ...(receiptV4("prepared").release as object), tag },
    });
    expect(errorsOf(release({ ...TAG, name: "v11.4.0" })).join(" ")).toContain(
      "must be 1.4.0 or end with it"
    );
    expect(
      errorsOf(release({ ...TAG, name: "v1.4.0.lock" })).join(" ")
    ).toContain(".lock");
    expect(errorsOf(release({ ...TAG, name: "-1.4.0" })).join(" ")).toContain(
      "must not start with -"
    );
    // Structure is a shape error; the schema's name and message patterns are
    // enforced by the tag rules, which refuse everything they refuse.
    for (const tag of [
      { name: "v1.4.0" },
      { ...TAG, extra: true },
      { ...TAG, name: 7 },
      "v1.4.0",
    ]) {
      expect(errorsOf(release(tag))).toContain("release is invalid");
    }
    for (const [tag, message] of [
      [{ ...TAG, name: "v 1.4.0" }, "contains a space"],
      [{ ...TAG, name: "" }, "is empty"],
      [{ ...TAG, message: "Acme\n1.4.0" }, "message must be one line"],
      [{ ...TAG, message: "" }, "message must be one line"],
      [{ ...TAG, message: `${"A".repeat(195)} 1.4.0` }, "message must be"],
    ] as const) {
      expect(errorsOf(release(tag)).join(" ")).toContain(message);
    }
    const { tag: _tag, ...untagged } = receiptV4("prepared").release as Record<
      string,
      unknown
    >;
    expect(errorsOf({ ...receiptV4("prepared"), release: untagged })).toContain(
      "release is invalid"
    );
  });

  test("a request that did not advertise receipt v4 refuses it", () => {
    expect(errorsOf(receiptV4("prepared"), "prepare", undefined, 2)).toContain(
      "the request did not advertise receipt v4"
    );
  });

  test("shapes the receipt each distribution writes for each request", () => {
    const v3 = validateChangelogRequest(requestFor(3, "prepare"))
      .value as ChangelogRequest;
    const v2 = validateChangelogRequest(requestFor(2, "prepare"))
      .value as ChangelogRequest;
    const v1 = validateChangelogRequest(requestFor(1, "prepare"))
      .value as ChangelogRequest;
    expect(receiptVersionFor(v3)).toBe(4);
    expect(receiptVersionFor(v3, NARROW_RECEIPT_VERSIONS)).toBe(4);
    expect(receiptVersionFor(v2)).toBe(3);
    expect(receiptVersionFor(v2, NARROW_RECEIPT_VERSIONS)).toBe(2);
    expect(receiptVersionFor(v1, NARROW_RECEIPT_VERSIONS)).toBe(2);
    const narrow = shapeReceipt(v3, receiptV2("prepared"), null, {
      provided: NARROW_RECEIPT_VERSIONS,
      tag: TAG,
    });
    expect(narrow.schemaVersion).toBe(4);
    expect(narrow).toMatchObject({
      release: { tag: TAG },
      versionDecision: { versionLine: null },
    });
    expect(validateChangelogReceipt(narrow, v3).errors).toEqual([]);
    expect(shapeReceipt(v1, receiptV2("prepared"), null).schemaVersion).toBe(2);
  });

  test("a release set refuses two trains naming one tag and accepts v3 beside v4", () => {
    const member = (train: string, tag: ReleaseTag | null) => {
      const receipt = receiptV4("prepared", tag);
      const decision = receipt.versionDecision as Record<string, unknown>;
      return {
        ...receipt,
        releaseSetId: "set-01",
        releaseSetTrains: ["ios", "web"],
        transactionId: `release-${train}`,
        versionDecision: { ...decision, releaseTrain: train },
      };
    };
    const v3 = {
      ...member("ios", null),
      release: receiptV2("prepared").release,
      schemaVersion: 3,
    };
    expect(
      validateChangelogReleaseSet([member("web", TAG), v3]).errors
    ).toEqual([]);
    expect(
      validateChangelogReleaseSet([
        member("web", { ...TAG, name: "web@1.4.0" }),
        member("ios", { ...TAG, name: "ios@1.4.0" }),
      ]).errors
    ).toEqual([]);
    expect(
      validateChangelogReleaseSet([member("web", TAG), member("ios", TAG)])
        .errors
    ).toContain(
      "web and ios both name release tag v1.4.0; each train needs its own"
    );
  });
});

describe("naming a release's tag", () => {
  const base = {
    displayName: "Acme Web",
    publicTrains: 1,
    train: "web",
    version: "1.4.0",
  };

  test("uses the train's template, none, or no field", () => {
    expect(releaseTagFor({ ...base, setting: "v{version}" })).toEqual({
      tag: { message: "Acme Web 1.4.0", name: "v1.4.0" },
    });
    expect(
      releaseTagFor({
        ...base,
        publicTrains: 2,
        setting: { ios: "ios@{version}", web: "web@{version}" },
      })
    ).toEqual({ tag: { message: "Acme Web 1.4.0", name: "web@1.4.0" } });
    const settings: (ReleaseTagsSetting | undefined)[] = [
      undefined,
      "none",
      { web: "none" },
      { ios: "ios@{version}" },
    ];
    for (const setting of settings) {
      expect(releaseTagFor({ ...base, setting })).toEqual({ tag: null });
    }
  });

  test("blocks one template for two trains, a refused name, and a taken version", () => {
    expect(
      releaseTagFor({ ...base, publicTrains: 2, setting: "v{version}" })
    ).toMatchObject({
      reasonCode: "malformed-policy",
      requiredAction: "repair-policy",
    });
    expect(
      releaseTagFor({ ...base, setting: { a: "v{version}", b: "v{version}" } })
    ).toMatchObject({ reasonCode: "malformed-policy" });
    expect(
      releaseTagFor({ ...base, setting: "v{version}", version: "1.4..0" })
    ).toMatchObject({
      reasonCode: "invalid-version-direction",
      requiredAction: "choose-version",
    });
    expect(
      releaseTagFor({ ...base, setting: "v{version}", taken: REVISION })
    ).toMatchObject({ reasonCode: "invalid-version-direction" });
    expect(
      releaseTagFor({
        ...base,
        setting: "v{version}",
        taken: FINAL,
        target: FINAL,
      })
    ).toEqual({ tag: { message: "Acme Web 1.4.0", name: "v1.4.0" } });
    expect(() =>
      releaseTagFor({
        ...base,
        displayName: "A".repeat(200),
        setting: "v{version}",
      })
    ).toThrow("message");
  });

  test("the setting joins the effective-policy digest only when present", () => {
    const input = {
      automationOwner: null,
      policy: { patch: "ask" },
      releaseTrain: "web",
      source: "repository-policy",
      versionConvention: "semver",
      versionOwner: "package.json",
    };
    const unchanged = effectivePolicyDigest(input);
    expect(unchanged).toBe(digestCanonicalJson(input));
    expect(effectivePolicyDigest({ ...input, releaseTags: "v{version}" })).toBe(
      digestCanonicalJson({ ...input, releaseTags: "v{version}" })
    );
    expect(effectivePolicyDigest({ ...input, releaseTags: "none" })).not.toBe(
      unchanged
    );
  });
});

// Negotiation as each Simple Changes controller performs it: before 0.27.0
// the request and receipt versions are chosen independently; from 0.27.0 the
// receipt is the highest shared version the chosen request may advertise.
const CONTROLLERS = {
  "0.13-0.22": { receipts: [1, 2], requests: [1] },
  "0.23-0.26": { receipts: [1, 2, 3], requests: [1, 2] },
  "0.27": { receipts: [1, 2, 3, 4], requests: [1, 2, 3] },
} as const;
const CAP = { 1: 2, 2: 3, 3: 4 } as const;

const highest = (left: readonly number[], right: readonly number[]) =>
  Math.max(0, ...left.filter((version) => right.includes(version))) || null;

const negotiate = (
  controller: keyof typeof CONTROLLERS,
  marker: { receiptVersions: number[]; requestVersions: number[] }
): [number | null, number | null] => {
  const { receipts, requests } = CONTROLLERS[controller];
  const request = highest(requests, marker.requestVersions);
  const allowed =
    controller === "0.27" && request
      ? receipts.filter((version) => version <= CAP[request as 1 | 2 | 3])
      : receipts;
  return [request, highest(allowed, marker.receiptVersions)];
};

describe("negotiation with each marker", () => {
  const expectations = {
    cms: { "0.13-0.22": [1, 2], "0.23-0.26": [1, 2], "0.27": [1, 2] },
    full: { "0.13-0.22": [1, 2], "0.23-0.26": [2, 3], "0.27": [3, 4] },
    mobile: { "0.13-0.22": [1, 2], "0.23-0.26": [1, 2], "0.27": [3, 4] },
    "skill-repository": {
      "0.13-0.22": [1, 2],
      "0.23-0.26": [1, 2],
      "0.27": [3, 4],
    },
    web: { "0.13-0.22": [1, 2], "0.23-0.26": [1, 2], "0.27": [3, 4] },
    "web-cms": { "0.13-0.22": [1, 2], "0.23-0.26": [1, 2], "0.27": [3, 4] },
  } as const;

  test("older controllers negotiate exactly as before, and 0.27.0 gets tags", async () => {
    const repo = await temporaryDirectory("repo");
    const outcomes = await Promise.all(
      Object.entries(expectations).map(async ([distribution, byController]) => {
        const { capabilities } = await inspectRepository({
          configDirectory: await temporaryDirectory("config"),
          distribution: distribution as ApplyOptions["distribution"],
          repo,
          taskMode: "read",
        });
        const marker = capabilities as {
          receiptVersions: number[];
          requestVersions: number[];
        };
        return Object.entries(byController).map(([controller, expected]) => ({
          actual: [
            distribution,
            controller,
            ...negotiate(controller as keyof typeof CONTROLLERS, marker),
          ],
          expected: [distribution, controller, ...expected],
        }));
      })
    );
    for (const { actual, expected } of outcomes.flat()) {
      expect(actual).toEqual(expected);
    }
  });
});

const REPOSITORY_ROOT = join(import.meta.dir, "..", "..", "..", "..");
const DISTRIBUTION_DIRECTORIES = {
  cms: "simple-changelogs-cms",
  full: "simple-changelogs",
  mobile: "simple-changelogs-mobile",
  "skill-repository": "simple-changelogs-skill-maintainer",
  web: "simple-changelogs-web",
  "web-cms": "simple-changelogs-web-cms",
} as const;
const skillFile = (directory: string, path: string): Promise<string> =>
  readFile(join(REPOSITORY_ROOT, "skills", directory, path), "utf8");
const WHITESPACE = /\s+/gu;
const HOST_OR_EM_DASH = /GitHub|GitLab|Bitbucket|\u2014/u;
const collapse = (text: string): string => text.replace(WHITESPACE, " ");

describe("unified guidance 25 and release-tag guidance", () => {
  test("every distribution, marker, manifest entry, and notice shares guidance 25", async () => {
    const manifest = JSON.parse(
      await readFile(
        join(REPOSITORY_ROOT, "distribution-manifest.json"),
        "utf8"
      )
    ) as { distributions: { guidanceVersion: number; name: string }[] };
    expect(
      manifest.distributions.map(({ guidanceVersion }) => guidanceVersion)
    ).toEqual([25, 25, 25, 25, 25, 25]);
    const snapshots = await Promise.all(
      Object.entries(DISTRIBUTION_DIRECTORIES).map(
        async ([distribution, directory]) => {
          const [skill, marker, updates, inspection] = await Promise.all([
            skillFile(directory, "SKILL.md"),
            skillFile(directory, "changelog-provider.json"),
            skillFile(directory, "references/guidance-updates.md"),
            inspectRepository({
              configDirectory: await temporaryDirectory("config"),
              distribution: distribution as ApplyOptions["distribution"],
              repo: await temporaryDirectory("repo"),
              taskMode: "read",
            }),
          ]);
          return { inspection, marker, skill, updates };
        }
      )
    );
    for (const { inspection, marker, skill, updates } of snapshots) {
      expect(skill).toContain("Current guidance version: 25\n");
      expect(JSON.parse(marker).guidanceVersion).toBe(25);
      expect(inspection.capabilities?.guidanceVersion).toBe(25);
      expect(updates).toContain(
        '<!-- simple-changelogs-guidance-update version="25"'
      );
      expect(updates).toContain("## Guidance 25\n");
    }
  });

  test("versioned skills name tags but never create or push them; CMS stays unchanged", async () => {
    const read = (directory: string, path: string): Promise<string> =>
      directory === "simple-changelogs-cms" && path !== "SKILL.md"
        ? Promise.resolve("")
        : skillFile(directory, path);
    const snapshots = await Promise.all(
      Object.entries(DISTRIBUTION_DIRECTORIES).map(
        async ([distribution, directory]) => {
          const [skill, updates, handoff, setup, onboarding] =
            await Promise.all([
              skillFile(directory, "SKILL.md"),
              skillFile(directory, "references/guidance-updates.md"),
              read(directory, "references/release-handoff.md"),
              read(directory, "references/setup.md"),
              read(directory, "references/onboarding.md"),
            ]);
          return {
            distribution,
            entry: collapse(updates.slice(updates.indexOf("## Guidance 25"))),
            handoff,
            onboarding,
            setup,
            skill,
          };
        }
      )
    );
    for (const snapshot of snapshots) {
      const { distribution, entry, handoff, onboarding, setup, skill } =
        snapshot;
      if (distribution === "cms") {
        expect(skill).toContain(
          "- Do not create tags, hosted releases, deployments, or unrelated product work."
        );
        expect(entry).toContain("Nothing changes for CMS repositories.");
        expect(entry).toContain("moves from 7 to 25");
        expect(entry).not.toContain("**");
        continue;
      }
      expect(collapse(skill)).toContain(
        "Name each release's tag in its receipt, but never create or push a tag; Simple Changes does."
      );
      expect(collapse(handoff)).toContain(
        "Never create, push, move, or delete a tag yourself."
      );
      expect(handoff).toContain('git check-ref-format "refs/tags/<name>"');
      expect(collapse(setup)).toContain(
        "your Git host's tag protection or tag rules"
      );
      expect(onboarding).toContain("**Should each release get a Git tag?");
      expect(entry).toContain("**Should each release get a Git tag?**");
      expect(entry).toContain("No answer records nothing");
      expect(entry).toContain("Simple Changes 0.27.0");
    }
  });

  test("new guidance prose names no Git host and uses no em dash", async () => {
    const texts = await Promise.all(
      Object.values(DISTRIBUTION_DIRECTORIES).map(async (directory) => {
        const updates = await skillFile(
          directory,
          "references/guidance-updates.md"
        );
        const handoff =
          directory === "simple-changelogs-cms"
            ? ""
            : await skillFile(directory, "references/release-handoff.md");
        return [
          updates.slice(updates.indexOf("## Guidance 25")),
          handoff.slice(handoff.indexOf("## Release tags")),
        ];
      })
    );
    for (const text of texts.flat()) {
      expect(text).not.toMatch(HOST_OR_EM_DASH);
    }
  });
});
