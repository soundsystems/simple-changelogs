import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type {
  EvalCase,
  EvalManifest,
  EvalTurn,
  JsonValue,
} from "../lib/types.ts";
import { validateManifest } from "../lib/validate.ts";

const MANIFEST_PATH = join(import.meta.dir, "..", "..", "evals", "cases.json");
const TOOLING_ROOT = join(import.meta.dir, "..", "..");
const SKILL_ROOT = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  "skills",
  "simple-changelogs"
);
// Reference prose is hard-wrapped, so a line break can fall between any two
// words. Assert against whitespace-collapsed text instead of guessing where
// the wrap lands -- otherwise reflowing a paragraph fails the check without
// changing what it says.
const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/gu, " ");

const RECORDED_DISPOSITION_PHRASE = "once a disposition is recorded";
// A reconcile leaves one empty `## Unreleased` as the first depth-2 heading,
// directly above a versioned release, so the next merge prepends pending work
// there and never into released history. The eval harness compiles patterns
// with only the `u` flag, so `(?i:...)` mirrors the parser's case-insensitive
// Unreleased match.
const UNRELEASED_ANCHOR_PHRASE = "anchors the next merge's prepend";
const EMPTY_UNRELEASED_ANCHOR_PATTERN =
  "^(?!## )(?:(?!\\n## )[\\s\\S])*\\n## \\[?(?i:unreleased)\\]?[ \\t]*(?:\\n[ \\t]*)*\\n## \\[?v?\\d";
const DUPLICATE_UNRELEASED_PATTERN =
  "(?:^|\\n)## \\[?(?i:unreleased)\\]?[ \\t]*(?:\\n|$)[\\s\\S]*\\n## \\[?(?i:unreleased)\\]?[ \\t]*(?:\\n|$)";
const RELEASE_RECONCILIATION_CASE_IDS = [
  "behavior-release-bearing-branch",
  "behavior-merge-batch-existing-unreleased",
  "behavior-initial-major-synthesis",
  "behavior-later-major-transition",
];
const SHARED_RELEASE_SCOPE_PATTERN =
  /shared (?:repository, release date, or version|version or release date)/;
const WRONG_SURFACE_EXCLUSION_PHRASE =
  "representative wrong-platform or wrong-role entries remain absent";
const EXPLICIT_INITIAL_BACKFILL_PATTERN = /backfill|review history/iu;
const REQUIRED_POINTER_PHRASES = [
  "## Repository-instruction pointer",
  "Never write to an agent-instruction file without explicit confirmation",
  "Write a pointer, never a copy",
  "update it in place rather than appending a second one",
];

const FIXTURE_IDS = new Set([
  "dual-changelog",
  "editorial-updates-app",
  "expert-release",
  "forked-skill",
  "initial-backfill",
  "initial-major",
  "minimal-git",
  "mobile-monorepo",
  "mobile-test-build",
  "mobile-test-build-fallback",
  "multi-surface-monorepo",
  "next-major",
  "python-prerelease",
  "release-repo",
  "release-tags-dated",
  "release-tags-monorepo",
  "release-tags-prefix",
  "release-tags-tooling",
  "release-tags-update",
  "routed-app",
  "single-changelog",
  "skill-package",
  "surface-established-system",
  "surface-mobile-store",
  "surface-radix-app",
  "surface-react-tailwind",
  "version-lines-catch-up",
  "version-trains-ambiguous",
  "version-trains-independent",
  "version-trains-mixed",
  "version-trains-shared",
]);

const REQUIRED_COVERAGE_TAGS = new Set([
  "backfill",
  "design",
  "forks",
  "lifecycle",
  "major-releases",
  "setup",
  "signatures",
  "surfaces",
  "versions",
  "wording",
]);

const ASSERTION_KINDS = new Set([
  "activation",
  "file.changed",
  "file.unchanged",
  "git.changedPaths",
  "json.path",
  "path.absent",
  "path.exists",
  "repo.state",
  "report.authorization",
  "report.decision",
  "report.status",
  "report.verification",
  "report.versionMap",
  "text.includesFile",
  "text.match",
  "text.notMatch",
]);

const TRIGGER_CASE_IDS = new Set([
  "trigger-positive-backfill",
  "trigger-positive-changelog-update",
  "trigger-positive-copy-classification",
  "trigger-positive-docs-release",
  "trigger-positive-major-release",
  "trigger-positive-migration-classification",
  "trigger-positive-release-finalization",
  "trigger-positive-release-note-surface",
  "trigger-positive-mobile-test-build-notes",
  "trigger-positive-mobile-build-finalization",
  "trigger-positive-review",
  "trigger-negative-commit-message",
  "trigger-negative-component-review",
  "trigger-negative-deploy",
  "trigger-negative-package-bump",
  "trigger-negative-package-version-command",
  "trigger-negative-slack-summary",
  "trigger-negative-tag",
  "trigger-negative-ui-spacing",
]);

const BEHAVIOR_CASE_IDS = new Set([
  "behavior-release-tags-existing-style",
  "behavior-release-tags-tooling-owns-tags",
  "behavior-release-tags-monorepo",
  "behavior-release-tags-date-only",
  "behavior-release-tags-update-asks-once",
  "behavior-test-build-finalizer-owns-notes",
  "behavior-test-build-extend-existing-notes",
  "behavior-play-test-build-full-and-compact-notes",
  "behavior-test-build-artifact-collision",
  "behavior-test-build-external-publication-readback",
  "behavior-clone-sensitive-public-detail",
  "behavior-comprehensive-initial-backfill",
  "behavior-customer-visible-feature",
  "behavior-developer-only-migration",
  "behavior-durable-ui-polish-changelog-only",
  "behavior-editorial-updates-surface-choice",
  "behavior-expert-public-release-ledger",
  "behavior-first-time-feature-naming",
  "behavior-fork-sync-provenance-pin",
  "behavior-guidance-driven-backfill-audit",
  "behavior-hidden-whats-new-surface",
  "behavior-internal-admin-developer-release-notes",
  "behavior-internal-release-note-surface",
  "behavior-initial-major-synthesis",
  "behavior-later-major-transition",
  "behavior-local-fork-precedence",
  "behavior-major-feature-launch",
  "behavior-major-release-modal-changelog-route",
  "behavior-merge-batch-existing-unreleased",
  "behavior-mobile-monorepo-release-notes",
  "behavior-mobile-store-release-notes",
  "behavior-multi-surface-scope-isolation",
  "behavior-modal-depth-budget",
  "behavior-modal-sequencing-eligibility",
  "behavior-new-whats-new-surface",
  "behavior-next-major-branch-prerelease",
  "behavior-non-release-pr-prep",
  "behavior-one-time-guidance-backfill-notice",
  "behavior-post-1-0-public-fix",
  "behavior-public-version-exact-direction",
  "behavior-public-version-no-boundary",
  "behavior-public-version-safe-default",
  "behavior-pep440-major-prerelease",
  "behavior-pre-1-0-hot-fix",
  "behavior-raw-changelog-signature",
  "behavior-release-bearing-branch",
  "behavior-release-metadata-drift",
  "behavior-routine-copy-edit",
  "behavior-single-changelog-policy",
  "behavior-skill-maintenance-regression",
  "behavior-superseded-developer-note",
  "behavior-surface-components-established-system",
  "behavior-surface-components-minimal-markup",
  "behavior-surface-components-radix-preserved",
  "behavior-surface-components-recommended",
  "behavior-surface-history-seed-declined",
  "behavior-terse-policy-terms-update",
  "behavior-ambiguous-version-relationship",
  "behavior-independent-mobile-release",
  "behavior-independent-web-release",
  "behavior-mixed-train-release",
  "behavior-release-name-presentation",
  "behavior-shared-train-release",
  "behavior-store-copy-public-version",
  "behavior-version-line-advance",
  "behavior-version-line-catch-up",
]);

const loadManifest = async (): Promise<EvalManifest> => {
  const input: unknown = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const result = validateManifest(input);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
  return result.value;
};

const caseById = (manifest: EvalManifest, id: string): EvalCase => {
  const item = manifest.cases.find((candidate) => candidate.id === id);
  expect(item).toBeDefined();
  if (!item) {
    throw new Error(`Missing evaluation case: ${id}`);
  }
  return item;
};

const turnByIndex = (item: EvalCase, index: number): EvalTurn => {
  const turn = item.turns[index];
  expect(turn).toBeDefined();
  if (!turn) {
    throw new Error(`Missing turn ${index} for evaluation case ${item.id}`);
  }
  return turn;
};

const hasAssertion = (
  item: EvalCase,
  turnIndex: number,
  kind: string,
  expected: JsonValue,
  target?: string
): boolean =>
  item.turns[turnIndex]?.assertions.some(
    (assertion) =>
      assertion.kind === kind &&
      assertion.target === target &&
      isDeepStrictEqual(assertion.expected, expected)
  ) ?? false;

describe("canonical evaluation manifest", () => {
  test("covers every trigger and behavior case exactly once", async () => {
    const manifest = await loadManifest();
    const ids = manifest.cases.map((item) => item.id);
    const triggerIds = new Set(
      manifest.cases
        .filter((item) => item.suite === "trigger")
        .map((item) => item.id)
    );
    const behaviorIds = new Set(
      manifest.cases
        .filter((item) => item.suite === "behavior")
        .map((item) => item.id)
    );

    expect(manifest.manifestVersion).toBe(1);
    expect(ids).toHaveLength(85);
    expect(new Set(ids).size).toBe(85);
    expect(triggerIds).toEqual(TRIGGER_CASE_IDS);
    expect(behaviorIds).toEqual(BEHAVIOR_CASE_IDS);
  });

  test("keeps every case runnable against a bundled fixture", async () => {
    const manifest = await loadManifest();

    for (const item of manifest.cases) {
      expect(item.skip).toBeUndefined();
      expect(FIXTURE_IDS.has(item.fixture)).toBe(true);
      expect(item.tags.length).toBeGreaterThan(0);
      expect(item.turns.length).toBeGreaterThan(0);
      for (const turn of item.turns) {
        expect(turn.prompt.trim().length).toBeGreaterThan(0);
        expect(turn.assertions.length).toBeGreaterThan(0);
        expect(
          turn.assertions.every((assertion) =>
            ASSERTION_KINDS.has(assertion.kind)
          )
        ).toBe(true);
      }
    }
  });

  test("retains explicit cross-cutting coverage tags", async () => {
    const manifest = await loadManifest();
    const tags = new Set(manifest.cases.flatMap((item) => item.tags));

    for (const tag of REQUIRED_COVERAGE_TAGS) {
      expect(tags.has(tag)).toBe(true);
    }
  });

  test("requires native activation evidence for every trigger and local fork selection", async () => {
    const manifest = await loadManifest();
    const triggerCases = manifest.cases.filter(
      (item) => item.suite === "trigger"
    );

    for (const item of triggerCases) {
      expect(item.activationMode).toBe("discover");
      expect(item.turns).toHaveLength(1);
      expect(item.turns[0]?.assertions).toEqual([
        {
          expected: item.id.startsWith("trigger-positive-"),
          kind: "activation",
        },
      ]);
    }

    const localFork = caseById(manifest, "behavior-local-fork-precedence");
    expect(localFork.activationMode).toBe("discover");
    expect(
      hasAssertion(localFork, 0, "activation", {
        activated: true,
        excludes: ["global/simple-changelogs"],
        includes: ["project-changelog-maintainer"],
      })
    ).toBe(true);
  });

  test("encodes approved backfill and repo-local guidance corrections", async () => {
    const manifest = await loadManifest();
    const initialBackfill = caseById(
      manifest,
      "behavior-comprehensive-initial-backfill"
    );
    expect(initialBackfill.turns).toHaveLength(1);
    expect(initialBackfill.turns[0]?.prompt).not.toMatch(
      EXPLICIT_INITIAL_BACKFILL_PATTERN
    );
    for (const [target, expected] of [
      ["CHANGELOG.md", "[Ww]orkspace owners can export project data"],
      ["CHANGELOG.md", "[Ss]ervice-status alerts"],
      ["CHANGELOG.md", "[Ss]chedule recurring exports"],
      ["DEVELOPER_CHANGELOG.md", "[Vv]ersioned export schema"],
      ["DEVELOPER_CHANGELOG.md", "[Dd]ead-letter handling"],
      ["DEVELOPER_CHANGELOG.md", "[Ii]dempotency keys"],
    ] as const) {
      expect(
        hasAssertion(initialBackfill, 0, "text.match", expected, target)
      ).toBe(true);
    }
    expect(
      hasAssertion(
        initialBackfill,
        0,
        "json.path",
        "completed",
        ".simple-changelogs.json#/guidance/backfillStatus"
      )
    ).toBe(true);

    const explicitBackfill = caseById(
      manifest,
      "behavior-guidance-driven-backfill-audit"
    );
    expect(explicitBackfill.turns).toHaveLength(1);
    expect(
      hasAssertion(explicitBackfill, 0, "report.authorization", {
        code: "RELEASED_HISTORY_REWRITE",
        source: "current-request",
        status: "granted",
      })
    ).toBe(true);

    const guidanceNotice = caseById(
      manifest,
      "behavior-one-time-guidance-backfill-notice"
    );
    expect(guidanceNotice.turns).toHaveLength(2);
    expect(
      hasAssertion(
        guidanceNotice,
        0,
        "json.path",
        1,
        ".simple-changelogs.json#/guidance/version"
      )
    ).toBe(true);
    expect(
      hasAssertion(guidanceNotice, 0, "file.unchanged", true, "SKILL.md")
    ).toBe(true);
    expect(
      hasAssertion(guidanceNotice, 1, "file.unchanged", true, "SKILL.md")
    ).toBe(true);
    expect(
      hasAssertion(
        guidanceNotice,
        1,
        "json.path",
        "completed",
        ".simple-changelogs.json#/guidance/backfillStatus"
      )
    ).toBe(true);
  });

  test("offers backfill opt-out last and waits for confirmed setup", async () => {
    const manifest = await loadManifest();
    const setup = caseById(manifest, "behavior-customer-visible-feature");

    expect(setup.turns).toHaveLength(2);
    expect(
      hasAssertion(setup, 0, "path.absent", true, ".simple-changelogs.json")
    ).toBe(true);
    expect(
      turnByIndex(setup, 0).assertions.some(
        (assertion) =>
          assertion.kind === "report.authorization" &&
          typeof assertion.expected === "object" &&
          assertion.expected !== null &&
          !Array.isArray(assertion.expected) &&
          assertion.expected.code === "GUIDANCE_BACKFILL"
      )
    ).toBe(false);
    expect(
      hasAssertion(
        setup,
        0,
        "report.decision",
        "MOBILE_RELEASE_NOTE_PLACEMENT_REQUIRED"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        setup,
        1,
        "json.path",
        "declined",
        ".simple-changelogs.json#/guidance/backfillStatus"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        setup,
        1,
        "json.path",
        "full",
        ".simple-changelogs.json#/distribution"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        setup,
        1,
        "json.path",
        "required",
        ".simple-changelogs.json#/developerChangelog"
      )
    ).toBe(true);
    expect(
      hasAssertion(setup, 1, "report.authorization", {
        code: "GUIDANCE_BACKFILL",
        source: "user-response",
        status: "denied",
      })
    ).toBe(true);
    expect(
      hasAssertion(
        setup,
        1,
        "json.path",
        "mobile-only",
        ".simple-changelogs.json#/mobileReleaseNotePlacement"
      )
    ).toBe(true);
  });

  test("distinguishes surface approval turns from explicit authorization", async () => {
    const manifest = await loadManifest();
    const approvalCases = [
      "behavior-hidden-whats-new-surface",
      "behavior-mobile-monorepo-release-notes",
      "behavior-new-whats-new-surface",
    ];
    for (const id of approvalCases) {
      const item = caseById(manifest, id);
      expect(item.turns).toHaveLength(2);
      expect(
        hasAssertion(item, 0, "report.authorization", {
          code: "NEW_RELEASE_NOTE_SURFACE",
          source: "none",
          status: "required",
        })
      ).toBe(true);
      expect(
        hasAssertion(item, 1, "report.authorization", {
          code: "NEW_RELEASE_NOTE_SURFACE",
          source: "user-response",
          status: "granted",
        })
      ).toBe(true);
    }

    const explicitCases = [
      "behavior-internal-admin-developer-release-notes",
      "behavior-internal-release-note-surface",
      "behavior-major-release-modal-changelog-route",
    ];
    for (const id of explicitCases) {
      const item = caseById(manifest, id);
      expect(item.turns).toHaveLength(1);
      expect(
        hasAssertion(item, 0, "report.authorization", {
          code: "NEW_RELEASE_NOTE_SURFACE",
          source: "current-request",
          status: "granted",
        })
      ).toBe(true);
    }
  });

  test("documents every asserted report code in the model-visible response schema", async () => {
    const manifest = await loadManifest();
    const schema = await readFile(
      join(TOOLING_ROOT, "evals", "schemas", "runner-response.schema.json"),
      "utf8"
    );
    const codeOf = (expected: JsonValue): string =>
      typeof expected === "string"
        ? expected
        : ((expected as { code?: string }).code ?? "");
    const reportKinds = new Set([
      "report.decision",
      "report.authorization",
      "report.verification",
    ]);

    for (const item of manifest.cases) {
      for (const turn of item.turns) {
        for (const assertion of turn.assertions) {
          if (!reportKinds.has(assertion.kind)) {
            continue;
          }
          const code = codeOf(assertion.expected);
          expect(code).not.toBe("");
          expect(schema).toContain(code);
        }
      }
    }
  });

  test("pins stable-major synthesis and prerelease boundaries", async () => {
    const manifest = await loadManifest();
    const initialMajor = caseById(manifest, "behavior-initial-major-synthesis");
    expect(
      hasAssertion(
        initialMajor,
        0,
        "json.path",
        "1.0.0",
        "package.json#/version"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        initialMajor,
        0,
        "text.match",
        "[Aa]ccount recovery",
        "release-notes.json"
      )
    ).toBe(true);

    const laterMajor = caseById(manifest, "behavior-later-major-transition");
    expect(
      hasAssertion(
        laterMajor,
        0,
        "text.match",
        "## 2\\.0\\.0-beta\\.2",
        "CHANGELOG.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        laterMajor,
        0,
        "text.notMatch",
        "[Aa]ccount recovery|[Ss]cheduled report",
        "release-notes.json"
      )
    ).toBe(true);

    const branchMerge = caseById(
      manifest,
      "behavior-next-major-branch-prerelease"
    );
    for (const path of [
      "CHANGELOG.md",
      "DEVELOPER_CHANGELOG.md",
      "package.json",
      "release-notes.json",
    ]) {
      expect(hasAssertion(branchMerge, 0, "file.unchanged", true, path)).toBe(
        true
      );
    }

    const pep440 = caseById(manifest, "behavior-pep440-major-prerelease");
    expect(
      hasAssertion(
        pep440,
        0,
        "text.notMatch",
        "## 2\\.0(?:\\.0)?(?:\\s|-)",
        "CHANGELOG.md"
      )
    ).toBe(true);
  });

  test("pins expert technical archives and per-surface monorepo isolation", async () => {
    const manifest = await loadManifest();
    const expert = caseById(manifest, "behavior-expert-public-release-ledger");

    expect(
      hasAssertion(
        expert,
        0,
        "text.match",
        "Song\\.get_current_smpte_song_time\\(\\)",
        "docs/release-notes.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        expert,
        0,
        "text.match",
        "assets/link-audio\\.svg",
        "docs/release-notes.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        expert,
        0,
        "text.match",
        "\\[[^\\]]*[Ll]ink [Aa]udio[^\\]]*\\]\\(#[^)]+\\)",
        "docs/release-notes.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        expert,
        0,
        "text.notMatch",
        "SearchRanker|source weights|fallback thresholds|database migration|allocation strategy",
        "docs/release-notes.md"
      )
    ).toBe(true);

    const scoped = caseById(manifest, "behavior-multi-surface-scope-isolation");
    expect(scoped.turns).toHaveLength(4);
    for (const path of [
      "apps/web/src/release-notes.ts",
      "apps/mobile/src/release-notes.ts",
      "apps/cms/src/release-notes.ts",
    ]) {
      expect(hasAssertion(scoped, 0, "file.changed", true, path)).toBe(true);
      expect(
        turnByIndex(scoped, 0).assertions.some(
          (assertion) =>
            assertion.kind === "text.notMatch" && assertion.target === path
        )
      ).toBe(true);
    }
    expect(
      hasAssertion(scoped, 0, "report.verification", {
        code: "SURFACE_SCOPE_FILTERING",
        status: "passed",
      })
    ).toBe(true);
    expect(
      hasAssertion(
        scoped,
        0,
        "json.path",
        "mobile-only",
        ".simple-changelogs.json#/mobileReleaseNotePlacement"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        scoped,
        1,
        "json.path",
        "web-tabs",
        ".simple-changelogs.json#/mobileReleaseNotePlacement"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        scoped,
        1,
        "report.decision",
        "MOBILE_HISTORY_EXPOSED_IN_WEB_TABS"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        scoped,
        2,
        "json.path",
        "web-page",
        ".simple-changelogs.json#/mobileReleaseNotePlacement"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        scoped,
        2,
        "path.exists",
        true,
        "apps/web/src/mobile-release-notes.ts"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        scoped,
        3,
        "json.path",
        "store-only",
        ".simple-changelogs.json#/mobileReleaseNotePlacement"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        scoped,
        3,
        "file.unchanged",
        true,
        "apps/mobile/src/release-notes.ts"
      )
    ).toBe(true);
    expect(
      hasAssertion(scoped, 3, "report.decision", "STORE_NOTES_UPDATED")
    ).toBe(true);
  });

  test("keeps recorded single-changelog policy choices authoritative", async () => {
    const manifest = await loadManifest();
    const singleChangelog = caseById(
      manifest,
      "behavior-single-changelog-policy"
    );

    expect(singleChangelog.turns).toHaveLength(1);
    expect(
      hasAssertion(
        singleChangelog,
        0,
        "path.absent",
        true,
        "DEVELOPER_CHANGELOG.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        singleChangelog,
        0,
        "text.notMatch",
        "simple-changelogs-signature",
        "CHANGELOG.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        singleChangelog,
        0,
        "file.unchanged",
        true,
        ".simple-changelogs.json"
      )
    ).toBe(true);
  });

  test("pins semantic evidence for signatures, backfills, modal gates, maintenance, and forks", async () => {
    const manifest = await loadManifest();
    const signature = caseById(manifest, "behavior-raw-changelog-signature");
    expect(
      turnByIndex(signature, 0).assertions.some(
        (assertion) =>
          assertion.kind === "text.match" &&
          typeof assertion.expected === "string" &&
          assertion.expected.startsWith("Product Page Corrections[\\s\\S]")
      )
    ).toBe(true);

    const backfill = caseById(
      manifest,
      "behavior-guidance-driven-backfill-audit"
    );
    expect(
      hasAssertion(
        backfill,
        0,
        "text.notMatch",
        "Migrated the internal report queue to a new database table",
        "CHANGELOG.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        backfill,
        0,
        "text.match",
        "Migrated the internal report queue to a new database table",
        "DEVELOPER_CHANGELOG.md"
      )
    ).toBe(true);

    const modal = caseById(manifest, "behavior-modal-sequencing-eligibility");
    const modalPatterns = turnByIndex(modal, 0)
      .assertions.filter((assertion) => assertion.kind === "text.match")
      .map((assertion) => assertion.expected);
    expect(modalPatterns).toEqual([
      "[Aa]uth",
      "[Aa]ge",
      "[Oo]nboarding",
      "[Rr]eturning",
      "[Cc]heckout|[Aa]ccount recovery|[Ss]afety|[Cc]ritical",
      "[Dd]ismiss",
    ]);

    const maintenance = caseById(
      manifest,
      "behavior-skill-maintenance-regression"
    );
    expect(
      hasAssertion(
        maintenance,
        0,
        "text.notMatch",
        "Routine copy stays out\\. Customer outcomes stay in\\. Clone-sensitive details stay private",
        "SKILL.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        maintenance,
        0,
        "text.match",
        "description: (?=[^\\n]*(?:Use when|changelog))(?=[^\\n]*(?:Do not use|not for|unless))[^\\n]+",
        "SKILL.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        maintenance,
        0,
        "text.notMatch",
        "- Check the changelog\\.\\s*- Check wording\\.",
        "SKILL.md"
      )
    ).toBe(true);
    for (const pattern of [
      "[Cc]ustomer",
      "[Dd]eveloper",
      "[Rr]elease",
      "[Ss]ignature",
      "[Aa]utomat|[Cc]ommand",
    ]) {
      expect(
        hasAssertion(
          maintenance,
          0,
          "text.match",
          pattern,
          "references/automation-verification.md"
        )
      ).toBe(true);
    }
    expect(
      hasAssertion(
        maintenance,
        0,
        "text.match",
        "evals/cases\\.json|contract|adapter",
        "EVAL.md"
      )
    ).toBe(true);

    const forkSync = caseById(manifest, "behavior-fork-sync-provenance-pin");
    expect(
      hasAssertion(
        forkSync,
        0,
        "text.match",
        "2222222222222222222222222222222222222222",
        "skills/project-changelog-maintainer/SKILL.md"
      )
    ).toBe(true);
    expect(
      hasAssertion(
        forkSync,
        0,
        "text.match",
        "Repo-local guidance state is portable",
        "skills/project-changelog-maintainer/EVAL.md"
      )
    ).toBe(true);
  });
});

describe("portable guidance consistency", () => {
  test("offers the ask-first repository-instruction pointer in every distribution", async () => {
    const skillsRoot = join(SKILL_ROOT, "..");
    const distributions = [
      "simple-changelogs",
      "simple-changelogs-cms",
      "simple-changelogs-mobile",
      "simple-changelogs-skill-maintainer",
      "simple-changelogs-web",
      "simple-changelogs-web-cms",
    ];

    const onboardingReferences = await Promise.all(
      distributions.map((distribution) =>
        readFile(
          join(skillsRoot, distribution, "references", "onboarding.md"),
          "utf8"
        )
      )
    );

    for (const onboarding of onboardingReferences) {
      const collapsed = collapseWhitespace(onboarding);
      for (const phrase of REQUIRED_POINTER_PHRASES) {
        expect(collapsed).toContain(phrase);
      }
    }
  });

  test("packages expert public detail and destination isolation in every product distribution", async () => {
    const skillsRoot = join(SKILL_ROOT, "..");
    const distributions = [
      "simple-changelogs",
      "simple-changelogs-web",
      "simple-changelogs-mobile",
      "simple-changelogs-web-cms",
    ];

    const packages = await Promise.all(
      distributions.map(async (distribution) => {
        const referenceRoot = join(skillsRoot, distribution, "references");
        const [classification, surfaces, verification] = await Promise.all([
          readFile(join(referenceRoot, "entry-classification.md"), "utf8"),
          readFile(join(referenceRoot, "release-note-surfaces.md"), "utf8"),
          readFile(join(referenceRoot, "automation-verification.md"), "utf8"),
        ]);
        return { classification, surfaces, verification };
      })
    );

    for (const { classification, surfaces, verification } of packages) {
      expect(classification).toContain(
        "Audience Profiles and Public Technical Ledgers"
      );
      expect(classification).toContain("comprehensive public patch ledger");
      expect(
        surfaces.includes("scope map") || surfaces.includes("Destination scope")
      ).toBe(true);
      expect(collapseWhitespace(surfaces)).toMatch(
        SHARED_RELEASE_SCOPE_PATTERN
      );
      expect(collapseWhitespace(verification)).toContain(
        WRONG_SURFACE_EXCLUSION_PHRASE
      );
    }
  });

  test("packages curated product UI copy and semantic emphasis in every product distribution", async () => {
    const skillsRoot = join(SKILL_ROOT, "..");
    const distributions = [
      "simple-changelogs",
      "simple-changelogs-web",
      "simple-changelogs-mobile",
      "simple-changelogs-web-cms",
    ];

    const packages = await Promise.all(
      distributions.map(async (distribution) => {
        const referenceRoot = join(skillsRoot, distribution, "references");
        const [classification, surfaces, design, verification] =
          await Promise.all([
            readFile(join(referenceRoot, "entry-classification.md"), "utf8"),
            readFile(join(referenceRoot, "release-note-surfaces.md"), "utf8"),
            readFile(join(referenceRoot, "surface-design.md"), "utf8"),
            readFile(join(referenceRoot, "automation-verification.md"), "utf8"),
          ]);
        return { classification, design, surfaces, verification };
      })
    );

    for (const { classification, design, surfaces, verification } of packages) {
      expect(classification).toContain("Selected Product Release-Note Copy");
      expect(classification).toContain("one concrete idea per bullet");
      expect(classification).toContain(
        "administrator-only capability belongs in canonical customer history only"
      );
      expect(
        surfaces.includes("Product UI Editorial Selection") ||
          surfaces.includes("Product UI editorial selection")
      ).toBe(true);
      expect(collapseWhitespace(surfaces)).toContain(
        "require each item to earn inclusion"
      );
      expect(surfaces).toContain("badges, achievements, rewards, easter eggs");
      expect(surfaces).toContain(
        "defer the customer entry until disclosure no longer defeats"
      );
      expect(design).toContain("## Inline emphasis");
      expect(design).toContain("semantic strong emphasis");
      expect(design).toContain("Never expose raw emphasis delimiters");
      expect(collapseWhitespace(design)).toContain(
        "Normalize an unambiguous doubled strong wrapper"
      );
      expect(collapseWhitespace(verification)).toContain(
        "raw `**` or `****` delimiters never reach visible copy"
      );
    }
  });

  test("keeps keyword emphasis sparse and outcome-focused in every product distribution", async () => {
    const skillsRoot = join(SKILL_ROOT, "..");
    const distributions = [
      "simple-changelogs",
      "simple-changelogs-web",
      "simple-changelogs-mobile",
      "simple-changelogs-web-cms",
    ];

    const references = await Promise.all(
      distributions.map((distribution) =>
        readFile(
          join(skillsRoot, distribution, "references", "surface-design.md"),
          "utf8"
        )
      )
    );

    for (const reference of references) {
      const collapsed = collapseWhitespace(reference);
      expect(reference).toContain("## Inline emphasis");
      expect(collapsed).toContain("smallest exact named product term");
      expect(collapsed).toContain(
        "Product and app surfaces, core components, filters"
      );
      expect(collapsed).toContain("capability and practical outcome");
      expect(collapsed).toContain("without relying on color alone");
    }
  });

  test("defaults initial backfills without broadening one-off surface answers", async () => {
    const setup = await readFile(
      join(SKILL_ROOT, "references", "setup.md"),
      "utf8"
    );

    expect(setup).toContain("default initial setup to a comprehensive audit");
    expect(setup).toContain("Confirmation accepts `partial`");
    expect(setup).toContain("without a separate “Review it now” approval");
    expect(setup).toContain(
      "one-off approval or rejection leaves policy at `ask`"
    );
    expect(setup).toContain("explicitly chooses that ongoing policy");
  });

  test("keeps deterministic mirrors distinct from semantic backfill edits", async () => {
    const backfill = await readFile(
      join(SKILL_ROOT, "references", "backfill.md"),
      "utf8"
    );

    expect(backfill).toContain("copying the same unambiguous value");
    expect(backfill).toContain("established mirror");
  });

  test("keeps one empty Unreleased anchor after release reconciliation", async () => {
    const skillsRoot = join(SKILL_ROOT, "..");
    const distributions = [
      "simple-changelogs",
      "simple-changelogs-mobile",
      "simple-changelogs-skill-maintainer",
      "simple-changelogs-web",
      "simple-changelogs-web-cms",
    ];

    const lifecycles = await Promise.all(
      distributions.map((distribution) =>
        readFile(
          join(skillsRoot, distribution, "references", "release-lifecycle.md"),
          "utf8"
        )
      )
    );

    for (const lifecycle of lifecycles.map(collapseWhitespace)) {
      expect(lifecycle).toContain(UNRELEASED_ANCHOR_PHRASE);
      expect(lifecycle).not.toContain("remove the empty `Unreleased` heading");
      expect(lifecycle).not.toContain("Remove empty `Unreleased` headings");
      expect(lifecycle).not.toContain("Omit an empty section");
    }

    const manifest = await loadManifest();
    for (const id of RELEASE_RECONCILIATION_CASE_IDS) {
      const item = caseById(manifest, id);
      expect(
        hasAssertion(
          item,
          0,
          "text.match",
          EMPTY_UNRELEASED_ANCHOR_PATTERN,
          "CHANGELOG.md"
        )
      ).toBe(true);
      expect(
        hasAssertion(
          item,
          0,
          "text.notMatch",
          DUPLICATE_UNRELEASED_PATTERN,
          "CHANGELOG.md"
        )
      ).toBe(true);
    }
  });

  test("anchor patterns enforce placement and catch case-variant duplicates", () => {
    // Compiled exactly as the eval harness compiles text assertions.
    const anchor = new RegExp(EMPTY_UNRELEASED_ANCHOR_PATTERN, "u");
    const duplicate = new RegExp(DUPLICATE_UNRELEASED_PATTERN, "u");
    const changelog = (...headings: string[]): string =>
      ["# Changelog", ...headings.map((heading) => `## ${heading}\n`), ""].join(
        "\n\n"
      );

    expect(anchor.test(changelog("Unreleased", "2.0.0 - 2026-07-01"))).toBe(
      true
    );
    expect(anchor.test(changelog("[Unreleased]", "[1.0.0] - 2026-07-01"))).toBe(
      true
    );
    // Misplaced below the newest release, as in the next-major fixture.
    expect(
      anchor.test(changelog("2.0.0", "Unreleased", "2.0.0-beta.2 - 2026-06-15"))
    ).toBe(false);
    expect(anchor.test(changelog("2.0.0 - 2026-07-01"))).toBe(false);
    expect(
      anchor.test(
        ["# Changelog", "## Unreleased", "- Pending", "## 2.0.0", ""].join(
          "\n\n"
        )
      )
    ).toBe(false);

    expect(duplicate.test(changelog("Unreleased", "2.0.0"))).toBe(false);
    expect(duplicate.test(changelog("Unreleased", "2.0.0", "UNRELEASED"))).toBe(
      true
    );
    expect(duplicate.test(changelog("Unreleased", "[unreleased]"))).toBe(true);
  });

  test("explains setup and updates before asking and labels mobile placement by outcome", async () => {
    const onboardingPaths = [
      "simple-changelogs",
      "simple-changelogs-cms",
      "simple-changelogs-mobile",
      "simple-changelogs-skill-maintainer",
      "simple-changelogs-web",
      "simple-changelogs-web-cms",
    ].map((directory) =>
      join(SKILL_ROOT, "..", directory, "references", "onboarding.md")
    );
    const onboardingCopies = await Promise.all(
      onboardingPaths.map((path) => readFile(path, "utf8"))
    );

    for (const onboarding of onboardingCopies) {
      expect(onboarding).toContain("## Explain before asking");
      expect(onboarding).toContain("**Walk me through it**");
      expect(onboarding).toContain("every main workflow");
      expect(onboarding).toContain("nothing has been written");
    }

    const fullOnboarding = onboardingCopies[0] ?? "";
    expect(fullOnboarding).toContain(
      "Where should people be able to read mobile-specific release notes?"
    );
    expect(fullOnboarding).toContain("**App stores only**");
    expect(fullOnboarding).toContain(
      "**Mobile app and app stores, no Web (Recommended"
    );
    expect(fullOnboarding).toContain(
      "**Web and mobile on one tabbed Release Notes page**"
    );
    expect(fullOnboarding).toContain(
      "**Web and mobile on separate Release Notes pages**"
    );
    expect(collapseWhitespace(fullOnboarding)).toContain(
      "The same Mobile feed remains available to the app and stores"
    );
    expect(fullOnboarding).toContain(
      "Do not shorten these to bare `store-only`, `mobile-only`, `web-tabs`, or"
    );
    expect(fullOnboarding).toContain("Start with the inspection result");
    expect(collapseWhitespace(fullOnboarding)).toContain(
      "I scanned the repository and did not find an established release-notes destination"
    );
    expect(fullOnboarding).toContain("surfaceStructureEvidence");
    expect(fullOnboarding).toContain("Yes, keep it as a planned surface");
    expect(fullOnboarding).toContain("No, let me choose again");

    const setup = collapseWhitespace(
      await readFile(join(SKILL_ROOT, "references", "setup.md"), "utf8")
    );
    expect(setup).toContain("**Walk me through what changed (Recommended)**");
    expect(setup).toContain("**Keep my current settings and continue**");
    expect(setup).toContain("**View detailed release notes**");
  });

  test("routes fork drift through the location-independent bundled checker", async () => {
    const forkMaintenance = await readFile(
      join(SKILL_ROOT, "references", "fork-maintenance.md"),
      "utf8"
    );

    expect(forkMaintenance).toContain(
      "/absolute/path/to/simple-changelogs/scripts/check-fork-sync.sh"
    );
    expect(forkMaintenance).toContain("Use the bundled checker");
    expect(forkMaintenance).not.toContain("Without the script");
    expect(forkMaintenance).toContain("check-fork-sync.sh --pin-parity");
    expect(forkMaintenance).toContain("## Current Deltas");
  });

  test("documents all statuses and assertion families without overstating prompt deduplication", async () => {
    const [evaluationGuide, guidanceUpdates] = await Promise.all([
      readFile(join(TOOLING_ROOT, "EVAL.md"), "utf8"),
      readFile(join(SKILL_ROOT, "references", "guidance-updates.md"), "utf8"),
    ]);

    for (const value of [
      "`failed`",
      "`unsupported`",
      "`skipped`",
      "adapter-returned `error`",
      "`repo.state`",
      "`git.changedPaths`",
    ]) {
      expect(evaluationGuide).toContain(value);
    }
    expect(collapseWhitespace(guidanceUpdates)).toContain(
      RECORDED_DISPOSITION_PHRASE
    );
    expect(guidanceUpdates).toContain("an unanswered prompt records nothing");
  });
});

describe("release-note punctuation boundaries", () => {
  test("keeps every routed classification reference aligned with the user-only exception", async () => {
    const distributions = [
      "simple-changelogs",
      "simple-changelogs-mobile",
      "simple-changelogs-web",
      "simple-changelogs-web-cms",
      "simple-changelogs-cms",
      "simple-changelogs-skill-maintainer",
    ];
    await Promise.all(
      distributions.map(async (distribution) => {
        const root = join(SKILL_ROOT, "..", distribution);
        const skill = await readFile(join(root, "SKILL.md"), "utf8");
        const references = new Set(
          skill.match(/references\/(?:cms-)?entry-classification\.md/gu)
        );
        expect(references.size).toBeGreaterThan(0);
        await Promise.all(
          [...references].map(async (reference) => {
            const text = collapseWhitespace(
              await readFile(join(root, reference), "utf8")
            );
            expect(text).toContain("unless the user explicitly requests it");
            expect(text).toContain(
              "Repository house style alone does not create an exception"
            );
            expect(text).not.toContain(
              "Repository instructions that set a different house style take precedence"
            );
          })
        );
        if (distribution === "simple-changelogs-web-cms") {
          expect(references.has("references/cms-entry-classification.md")).toBe(
            true
          );
        }
      })
    );
  });
});
