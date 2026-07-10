import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { EvalCase, EvalManifest, JsonValue } from "../lib/types.ts";
import { validateManifest } from "../lib/validate.ts";

const MANIFEST_PATH = join(import.meta.dir, "..", "..", "evals", "cases.json");

const FIXTURE_IDS = new Set([
  "dual-changelog",
  "forked-skill",
  "minimal-git",
  "mobile-monorepo",
  "release-repo",
  "routed-app",
  "skill-package",
]);

const REQUIRED_COVERAGE_TAGS = new Set([
  "backfill",
  "forks",
  "lifecycle",
  "setup",
  "signatures",
  "surfaces",
  "versions",
  "wording",
]);

const ASSERTION_KINDS = new Set([
  "activation",
  "command.exit",
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
  "text.match",
  "text.notMatch",
]);

const TRIGGER_CASE_IDS = new Set([
  "trigger-positive-backfill",
  "trigger-positive-changelog-update",
  "trigger-positive-copy-classification",
  "trigger-positive-docs-release",
  "trigger-positive-migration-classification",
  "trigger-positive-release-finalization",
  "trigger-positive-release-note-surface",
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
  "behavior-clone-sensitive-public-detail",
  "behavior-customer-visible-feature",
  "behavior-developer-only-migration",
  "behavior-first-time-feature-naming",
  "behavior-fork-sync-provenance-pin",
  "behavior-guidance-driven-backfill-audit",
  "behavior-hidden-whats-new-surface",
  "behavior-internal-admin-developer-release-notes",
  "behavior-internal-release-note-surface",
  "behavior-local-fork-precedence",
  "behavior-major-feature-launch",
  "behavior-major-release-modal-changelog-route",
  "behavior-merge-batch-existing-unreleased",
  "behavior-mobile-monorepo-release-notes",
  "behavior-mobile-store-release-notes",
  "behavior-modal-depth-budget",
  "behavior-modal-sequencing-eligibility",
  "behavior-new-whats-new-surface",
  "behavior-non-release-pr-prep",
  "behavior-one-time-guidance-backfill-notice",
  "behavior-post-1-0-public-fix",
  "behavior-pre-1-0-hot-fix",
  "behavior-raw-changelog-signature",
  "behavior-release-bearing-branch",
  "behavior-release-metadata-drift",
  "behavior-routine-copy-edit",
  "behavior-skill-maintenance-regression",
  "behavior-superseded-developer-note",
  "behavior-terse-policy-terms-update",
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
    expect(ids).toHaveLength(45);
    expect(new Set(ids).size).toBe(45);
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
    expect(hasAssertion(localFork, 0, "activation", true)).toBe(true);
  });

  test("encodes approved backfill and repo-local guidance corrections", async () => {
    const manifest = await loadManifest();
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
});
