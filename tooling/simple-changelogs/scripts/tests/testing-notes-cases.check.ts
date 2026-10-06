// The testing-note cases assert mechanics only: record paths and collision
// suffixes, recorded identity, the exact baseline HEAD, required sections and
// their limits, literal strings, saved-versus-published copy, and Git state.
// Whether steps, expected outcomes, and status wording are good is judged by
// model-graded or manual review, not by regex (see EVAL.md and SPEC.md).
import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawnSync } from "bun";
import {
  cleanupFixtureWorkspace,
  createFixtureWorkspace,
  evaluateAssertions,
  initializeFixtureGit,
} from "../lib/fixtures.ts";
import type {
  EvalAssertion,
  EvalCase,
  EvalManifest,
  RunnerResponse,
} from "../lib/types.ts";
import { validateManifest } from "../lib/validate.ts";

const TOOLING_ROOT = join(import.meta.dir, "..", "..");
const FIXTURES_ROOT = join(TOOLING_ROOT, "evals", "fixtures");
const MANIFEST_PATH = join(TOOLING_ROOT, "evals", "cases.json");

// A fixture's baseline commit is deterministic (fixed author, date, and
// message over the fixture's files), so testing-note cases require the actual
// HEAD instead of any 40-character hexadecimal string. Editing a fixture
// changes its baseline: update FIXTURE_HEADS and the cases' 7-character
// prefixes in cases.json together.
const FIXTURE_HEADS = {
  "mobile-test-build": "2a601e8d31b0fcf664f47f9fbfe42976b9bed012",
  "mobile-test-build-fallback": "cb1a299dd750cbf816d34ca154c0b6f67d9a89d5",
} as const;
type TestingNoteFixture = keyof typeof FIXTURE_HEADS;

const HEAD_BOUND_CASES = [
  "behavior-test-build-finalizer-owns-notes",
  "behavior-play-test-build-full-and-compact-notes",
  "behavior-test-build-artifact-collision",
  "behavior-test-build-external-publication-readback",
];
const LEGACY_ANY_SHA_PATTERN = "[0-9a-f]{40}";
const TESTFLIGHT_SCRIPT = "scripts/testflight-what-to-test.sh";
const NOTE_REQUEST_PATTERN = /notes?|checklist|what to test/iu;

const response: RunnerResponse = {
  evaluationReport: {
    authorizationRecords: [],
    decisionCodes: [],
    reasonCodes: [],
    verificationResults: [],
    versionMap: [],
  },
  finalResponse: "Prepared testing notes.",
  protocolVersion: 2,
  status: "completed",
};

const loadManifest = async (): Promise<EvalManifest> => {
  const result = validateManifest(
    JSON.parse(await readFile(MANIFEST_PATH, "utf8"))
  );
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
  return result.value;
};

const caseById = (manifest: EvalManifest, id: string): EvalCase => {
  const item = manifest.cases.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Missing evaluation case: ${id}`);
  }
  return item;
};

const fixtureOf = (item: EvalCase): TestingNoteFixture => {
  if (!Object.hasOwn(FIXTURE_HEADS, item.fixture)) {
    throw new Error(`${item.id} uses an unpinned fixture: ${item.fixture}`);
  }
  return item.fixture as TestingNoteFixture;
};

const headPrefix = (item: EvalCase): string =>
  FIXTURE_HEADS[fixtureOf(item)].slice(0, 7);

type Outcome = (workspace: string, head: string) => Promise<void>;

const writeFiles =
  (files: Record<string, (head: string) => string>): Outcome =>
  async (workspace, head) => {
    await Promise.all(
      Object.entries(files).map(async ([path, content]) => {
        const target = join(workspace, path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content(head));
      })
    );
  };

const runScript = (workspace: string, args: string[], input = ""): string => {
  const result = spawnSync(["sh", TESTFLIGHT_SCRIPT, ...args], {
    cwd: workspace,
    stdin: new TextEncoder().encode(input),
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return result.stdout.toString();
};

const commitAll = (workspace: string): void => {
  const result = spawnSync(
    [
      "git",
      "-c",
      "commit.gpgSign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "add",
      "--all",
    ],
    { cwd: workspace, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } }
  );
  const commit = spawnSync(
    [
      "git",
      "-c",
      "commit.gpgSign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "--quiet",
      "--no-verify",
      "--message",
      "agent commit",
    ],
    { cwd: workspace, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } }
  );
  if (result.exitCode !== 0 || commit.exitCode !== 0) {
    throw new Error(commit.stderr.toString());
  }
};

// Runs a case's assertions against a scripted outcome in a fresh workspace and
// returns the assertions that failed.
const failuresFor = async (
  item: EvalCase,
  outcome: Outcome
): Promise<EvalAssertion[]> => {
  const workspace = await createFixtureWorkspace(FIXTURES_ROOT, item.fixture);
  try {
    const head = await initializeFixtureGit(workspace);
    await outcome(workspace, head);
    // Testing-note cases are single-turn, so every assertion runs here.
    const assertions = item.turns.flatMap((turn) => turn.assertions);
    const results = await evaluateAssertions(assertions, {
      response,
      workspace,
    });
    return assertions.filter((_, index) => !results[index]?.passed);
  } finally {
    await cleanupFixtureWorkspace(workspace, {
      failed: false,
      keepFailures: false,
    });
  }
};

const IOS_145 = "apps/mobile/testing/ios/3.2.0-145/en-US.md";
const IOS_144 = "apps/mobile/testing/ios/3.2.0-144/en-US.md";
const ANDROID_211 = "apps/mobile/testing/android/3.2.0-211/en-US.md";
const PLAY_211 = "apps/mobile/testing/android/3.2.0-211/play-en-US.txt";
const FALLBACK_145 = "docs/testing-notes/catalog/ios/3.2.0-145/en-US.md";
const FALLBACK_145_2 = "docs/testing-notes/catalog/ios/3.2.0-145-2/en-US.md";
const FALLBACK_146 = "docs/testing-notes/catalog/ios/3.2.0-146/en-US.md";
const REMOTE_146 = "remote/testflight/3.2.0/146/en-US.txt";
const REMOTE_146_FR = "remote/testflight/3.2.0/146/fr-FR.txt";
const ACTIVITY_LOG = "remote/testflight/activity.log";
const PUBLICATION_CASE = "behavior-test-build-external-publication-readback";
// Section targets used by the cases (`path#heading-line-pattern`).
const TESTFLIGHT =
  "#^#{2,3} (?!.*(?i:checklist)).*(?i:testflight|what to test)";
const CHECKLIST = "#^#{2,3} (?!.*(?i:testflight|what to test)).*(?i:checklist)";

const TESTFLIGHT_COPY =
  "Open Catalog and change Filters quickly; expect the latest selection. Tap " +
  "Clear all; expect no active filters. Open Cart and pull to refresh; " +
  "expect loaded items to stay visible.";
const CHECKLIST_STEPS = [
  "1. Open Catalog and rapidly change Filters. Expect the latest selection.",
  "2. Tap Clear all. Expect no active filters.",
  "3. Open Cart and pull to refresh. Expect loaded items to stay visible.",
];
const IOS_CARRIED = [
  "4. Carried forward from build 144, still unverified on a device: repeat",
  "   Catalog with larger text. Expect readable labels and reachable controls.",
];

interface Ios145 {
  checklist?: string[];
  status?: string;
  testFlight?: string;
}

const ios145 =
  ({
    checklist = [...CHECKLIST_STEPS, ...IOS_CARRIED],
    status = "Status: prepared locally, unpublished. Device checks have not been run.",
    testFlight = TESTFLIGHT_COPY,
  }: Ios145 = {}) =>
  (head: string): string =>
    [
      "# What to Test: iOS 3.2.0 build 145",
      "",
      "Application: com.example.catalog; locale: en-US; group: internal testers.",
      `Source commit: ${head}`,
      status,
      "",
      "## Full checklist",
      "",
      ...checklist,
      "",
      "## TestFlight What to Test",
      "",
      testFlight,
      "",
    ].join("\n");

const fallbackRecord = (
  title: string,
  status: string,
  head: string,
  testFlight = TESTFLIGHT_COPY,
  appendix: string[] = []
): string =>
  [
    `# What to Test: ${title}`,
    "",
    "Application: com.example.catalog; locale: en-US.",
    `Source commit: ${head}`,
    `Status: ${status}`,
    "",
    "## Full checklist",
    "",
    ...CHECKLIST_STEPS,
    "",
    "## TestFlight What to Test",
    "",
    testFlight,
    "",
    ...appendix,
  ].join("\n");

const adHoc145 = (head: string): string =>
  fallbackRecord(
    "iOS 3.2.0 build 145, local ad hoc",
    "prepared locally; device checks not yet run.",
    head
  );

const EXTERNAL_146_TITLE =
  "iOS 3.2.0 build 146 for external group Beta Customers";
const CONTRADICTORY_COPY =
  "Open Catalog and tap Clear all; expect every filter to stay selected.";

interface Publication {
  appendReadback?: boolean;
  copy?: string;
  locales?: string[];
  // Saved record copy; defaults to the text read back from the destination.
  recordCopy?: string;
  republishWithoutReadback?: boolean;
}

// Publishes through the fixture's script, reads each locale back, and only
// then writes the record, so its status and copy reflect the readback.
const publishThenRecord =
  ({
    appendReadback = false,
    copy = TESTFLIGHT_COPY,
    locales = ["en-US"],
    recordCopy,
    republishWithoutReadback = false,
  }: Publication = {}): Outcome =>
  (workspace, head) => {
    const readback = new Map<string, string>();
    for (const locale of locales) {
      runScript(workspace, ["publish", "3.2.0", "146", locale], copy);
      readback.set(
        locale,
        runScript(workspace, ["read", "3.2.0", "146", locale]).trim()
      );
    }
    if (republishWithoutReadback) {
      runScript(workspace, ["publish", "3.2.0", "146", "en-US"], copy);
    }
    const english = readback.get("en-US") ?? "";
    return writeFiles({
      [FALLBACK_146]: () =>
        fallbackRecord(
          EXTERNAL_146_TITLE,
          "en-US What to Test published and read back; device checks not yet run.",
          head,
          recordCopy ?? english,
          appendReadback ? ["## Readback", "", english, ""] : []
        ),
    })(workspace, head);
  };

const failedTargets = (failures: EvalAssertion[]): string[] =>
  failures.map((failure) => `${failure.kind} ${failure.target ?? ""}`.trim());

const failuresOf = async (
  id: string,
  outcomes: Outcome[]
): Promise<string[][]> => {
  const item = caseById(await loadManifest(), id);
  const results = await Promise.all(
    outcomes.map((outcome) => failuresFor(item, outcome))
  );
  return results.map(failedTargets);
};

describe("testing-note evaluation cases", () => {
  test("bind each case to its fixture's actual baseline commit", async () => {
    const manifest = await loadManifest();
    const baselines = await Promise.all(
      Object.keys(FIXTURE_HEADS).map(async (fixture) => {
        const workspace = await createFixtureWorkspace(FIXTURES_ROOT, fixture);
        try {
          return [fixture, await initializeFixtureGit(workspace)];
        } finally {
          await cleanupFixtureWorkspace(workspace, {
            failed: false,
            keepFailures: false,
          });
        }
      })
    );
    expect(Object.fromEntries(baselines)).toEqual(FIXTURE_HEADS);
    for (const id of HEAD_BOUND_CASES) {
      const item = caseById(manifest, id);
      const expectations = item.turns.flatMap((turn) =>
        turn.assertions
          .filter((assertion) => assertion.kind === "text.match")
          .map((assertion) => assertion.expected)
      );
      expect(expectations).toContain(headPrefix(item));
      expect(expectations).not.toContain(LEGACY_ANY_SHA_PATTERN);
    }
  });

  test("tests ordinary finalization without asking for notes", async () => {
    const manifest = await loadManifest();
    for (const id of [
      "trigger-positive-mobile-build-finalization",
      "behavior-test-build-finalizer-owns-notes",
      "behavior-test-build-artifact-collision",
    ]) {
      expect(caseById(manifest, id).turns[0]?.prompt).not.toMatch(
        NOTE_REQUEST_PATTERN
      );
    }
  });

  test("check the iOS first draft's identity, sections, and limit", async () => {
    const id = "behavior-test-build-finalizer-owns-notes";
    const item = caseById(await loadManifest(), id);
    const testFlight = `text.match ${IOS_145}${TESTFLIGHT}`;
    const checklist = `text.match ${IOS_145}${CHECKLIST}`;
    const exactLimit = TESTFLIGHT_COPY.padEnd(1500, ".");
    expect(
      await failuresOf(id, [
        writeFiles({ [IOS_145]: ios145() }),
        writeFiles({ [IOS_145]: ios145({ testFlight: ` ${exactLimit}` }) }),
        writeFiles({ [IOS_145]: ios145({ testFlight: `${exactLimit}.` }) }),
        writeFiles({
          [IOS_145]: ios145({ testFlight: `\u00a0${exactLimit}` }),
        }),
        writeFiles({ [IOS_145]: ios145({ testFlight: "" }) }),
        writeFiles({
          [IOS_145]: ios145({ checklist: [...CHECKLIST_STEPS] }),
        }),
        writeFiles({ [IOS_145]: ios145({ status: "" }) }),
      ])
    ).toEqual([
      [],
      [],
      [testFlight],
      [testFlight],
      [testFlight],
      [checklist, checklist],
      [`text.match ${IOS_145}`],
    ]);

    const keywordOnly = await failuresFor(
      item,
      writeFiles({
        [IOS_145]: () =>
          "# iOS 3.2.0 build 145\n\nCatalog, Cart, and Clear all improved. " +
          "Expect improvements. Commit 0123456789abcdef0123456789abcdef01234567. " +
          "Prepared locally.\n",
      })
    );
    expect(keywordOnly.map((failure) => failure.expected)).toContain(
      headPrefix(item)
    );
    expect(
      keywordOnly.filter((failure) => failure.target?.includes("#")).length
    ).toBeGreaterThanOrEqual(6);

    const combined = await failuresFor(
      item,
      writeFiles({
        [IOS_145]: (head) =>
          ios145()(head)
            .replace("## Full checklist", "## TestFlight checklist")
            .replace("\n## TestFlight What to Test\n", "\n"),
      })
    );
    expect(combined.length).toBeGreaterThan(0);
    expect(
      combined.every((failure) => failure.target?.includes("#") === true)
    ).toBe(true);

    const committed = await failuresFor(item, async (workspace, head) => {
      await writeFiles({ [IOS_145]: ios145() })(workspace, head);
      const prior = join(workspace, IOS_144);
      await writeFile(prior, `${await readFile(prior, "utf8")}Edited.\n`);
      commitAll(workspace);
    });
    expect(failedTargets(committed)).toEqual([`file.unchanged ${IOS_144}`]);
  });

  test("accept a refined same-build note that keeps its source gap", async () => {
    const item = caseById(
      await loadManifest(),
      "behavior-test-build-extend-existing-notes"
    );
    const refine: Outcome = async (workspace) => {
      const path = join(workspace, IOS_144);
      const original = await readFile(path, "utf8");
      await writeFile(
        path,
        original
          .replace(
            "keep labels and controls readable.\n",
            "keep labels and controls readable.\nOpen Cart and pull to refresh. " +
              "Expect loaded contents to remain visible until it finishes.\n"
          )
          .concat(
            "Open Cart and refresh; expect loaded contents to stay visible.\n"
          )
      );
    };
    expect(await failuresFor(item, refine)).toEqual([]);
  });

  test("check the Android checklist and Play copy mechanically", async () => {
    const id = "behavior-play-test-build-full-and-compact-notes";
    const android =
      (
        carried = "4. Carried forward from iOS build 144, still unverified: repeat Catalog with larger text."
      ) =>
      (head: string): string =>
        [
          "# Android test checklist: 3.2.0, versionCode 211",
          "",
          "Package: com.example.catalog; track: internal; language: en-US.",
          `Source commit: ${head}`,
          "Status: prepared locally; no device results yet. Access gap: no",
          "tester-accessible destination exists for this checklist.",
          "",
          "## Full checklist",
          "",
          ...CHECKLIST_STEPS,
          carried,
          "",
        ].join("\n");
    const play =
      (
        copy = "Catalog filters now follow the latest selection, and Clear all " +
          "removes active filters. Cart keeps loaded contents visible while refreshing."
      ) =>
      () =>
        `${copy}\n`;
    const checklist = `text.match ${ANDROID_211}${CHECKLIST}`;
    expect(
      await failuresOf(id, [
        writeFiles({ [ANDROID_211]: android(), [PLAY_211]: play() }),
        writeFiles({
          [ANDROID_211]: android(
            "4. Larger text is outside this build's scope."
          ),
          [PLAY_211]: play(),
        }),
        writeFiles({
          [ANDROID_211]: android(),
          [PLAY_211]: play(
            "Catalog filters follow the latest selection. Please send feedback."
          ),
        }),
        writeFiles({
          [ANDROID_211]: android(),
          [PLAY_211]: play(
            "Catalog filters follow the latest selection.".repeat(12)
          ),
        }),
      ])
    ).toEqual([
      [],
      [checklist],
      [`text.notMatch ${PLAY_211}`],
      [`text.match ${PLAY_211}`],
    ]);

    const item = caseById(await loadManifest(), id);
    const keywordOnly = await failuresFor(
      item,
      writeFiles({
        [ANDROID_211]: () =>
          "Catalog Cart Clear all 211 internal com.example.catalog access\n",
        [PLAY_211]: play(),
      })
    );
    expect(keywordOnly.map((failure) => failure.expected)).toContain(
      headPrefix(item)
    );
  });

  test("require a new record when a different artifact shares a build number", async () => {
    const [usable, overwritten] = await failuresOf(
      "behavior-test-build-artifact-collision",
      [
        writeFiles({ [FALLBACK_145_2]: adHoc145 }),
        writeFiles({ [FALLBACK_145]: adHoc145 }),
      ]
    );
    expect(usable).toEqual([]);
    expect(overwritten).toContain(`path.exists ${FALLBACK_145_2}`);
    expect(overwritten).toContain(`file.unchanged ${FALLBACK_145}`);
    const [wrongVersion] = await failuresOf(
      "behavior-test-build-artifact-collision",
      [
        writeFiles({
          [FALLBACK_145_2]: (head) =>
            adHoc145(head).replaceAll("3.2.0", "9.9.9"),
        }),
      ]
    );
    expect(wrongVersion).toEqual([`text.match ${FALLBACK_145_2}`]);
  });

  test("require matching readback and locale isolation", async () => {
    const savedCopy = `text.includesFile ${FALLBACK_146}${TESTFLIGHT}`;
    expect(
      await failuresOf(PUBLICATION_CASE, [
        publishThenRecord(),
        writeFiles({
          [FALLBACK_146]: (head) =>
            fallbackRecord(
              EXTERNAL_146_TITLE,
              "en-US What to Test published and read back; device checks not yet run.",
              head
            ),
          [REMOTE_146]: () => `${TESTFLIGHT_COPY}\n`,
        }),
        publishThenRecord({ recordCopy: CONTRADICTORY_COPY }),
        publishThenRecord({
          appendReadback: true,
          recordCopy: CONTRADICTORY_COPY,
        }),
        publishThenRecord({ republishWithoutReadback: true }),
        publishThenRecord({ locales: ["en-US", "fr-FR"] }),
        publishThenRecord({ locales: ["en-US", "es-ES"] }),
        async (workspace, head) => {
          await publishThenRecord()(workspace, head);
          const path = join(workspace, FALLBACK_146);
          await writeFile(
            path,
            (await readFile(path, "utf8")).replaceAll("3.2.0", "9.9.9")
          );
        },
      ])
    ).toEqual([
      [],
      [`text.match ${ACTIVITY_LOG}`, `text.notMatch ${ACTIVITY_LOG}`],
      [savedCopy],
      [savedCopy],
      [`text.match ${ACTIVITY_LOG}`],
      [`text.notMatch ${ACTIVITY_LOG}`, `file.unchanged ${REMOTE_146_FR}`],
      [`text.notMatch ${ACTIVITY_LOG}`],
      [`text.match ${FALLBACK_146}`],
    ]);
  });

  test("count published characters the same way under any locale", async () => {
    const workspace = await createFixtureWorkspace(
      FIXTURES_ROOT,
      "mobile-test-build-fallback"
    );
    try {
      await initializeFixtureGit(workspace);
      const publish = (locale: string, copy: string) =>
        spawnSync(
          ["sh", TESTFLIGHT_SCRIPT, "publish", "3.2.0", "146", "en-US"],
          {
            cwd: workspace,
            env: { ...process.env, LANG: locale, LC_ALL: locale },
            stdin: new TextEncoder().encode(copy),
          }
        ).exitCode;
      const accented = "é".repeat(1500);
      for (const locale of ["C", "en_US.UTF-8"]) {
        expect([
          publish(locale, accented),
          publish(locale, `${accented}é`),
          publish(locale, `\u00a0${accented}`),
          publish(locale, ` \n${accented}\n `),
        ]).toEqual([0, 1, 1, 0]);
      }
    } finally {
      await cleanupFixtureWorkspace(workspace, {
        failed: false,
        keepFailures: false,
      });
    }
  });

  test("keep the fixture's internal-only markers out of external records and copy", async () => {
    const withChecklistLine =
      (line: string): Outcome =>
      async (workspace, head) => {
        await publishThenRecord()(workspace, head);
        const path = join(workspace, FALLBACK_146);
        await writeFile(
          path,
          (await readFile(path, "utf8")).replace(
            "## TestFlight What to Test",
            `${line}\n\n## TestFlight What to Test`
          )
        );
      };
    expect(
      await failuresOf(PUBLICATION_CASE, [
        publishThenRecord({
          copy: `${TESTFLIGHT_COPY} Reset data at https://admin.catalog.internal.example first.`,
        }),
        withChecklistLine(
          "4. Reset data at https://admin.catalog.internal.example as catalog-qa-editor."
        ),
        withChecklistLine(
          "4. Seed accounts from docs/internal/qa-accounts.md."
        ),
      ])
    ).toEqual([
      [`text.notMatch ${FALLBACK_146}`, `text.notMatch ${REMOTE_146}`],
      [`text.notMatch ${FALLBACK_146}`],
      [`text.notMatch ${FALLBACK_146}`],
    ]);
  });
});
