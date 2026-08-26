import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import { entryIdentity, parseReleaseNotes } from "../lib/changelog-parse.ts";

const queryPath = new URL("../query.ts", import.meta.url).pathname;
const temporaryDirectories: string[] = [];
const ID_PATTERN = /^[0-9a-f]{12}$/;

interface CliResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const runQuery = async (args: string[]): Promise<CliResult> => {
  const subprocess = spawn({
    cmd: [process.execPath, queryPath, ...args],
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stderr).text(),
    new Response(subprocess.stdout).text(),
  ]);
  return { exitCode, stderr, stdout };
};

const fixtureRepo = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "curation-query-check-"));
  temporaryDirectories.push(root);
  await Promise.all(
    Object.entries(files).map(([name, content]) =>
      writeFile(join(root, name), content)
    )
  );
  return root;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

// A minor release with five entries (one Breaking) and a patch release.
const CHANGELOG = [
  "# Changelog",
  "",
  "## Unreleased",
  "",
  "- Pending work",
  "",
  "## 2.1.0 - 2026-08-01",
  "",
  "- Added the export planner",
  "- Added saved filters",
  "- **Breaking**: Removed the legacy API",
  "- Fixed a typo in settings",
  "- Improved load times",
  "",
  "## 2.0.1 - 2026-07-10",
  "",
  "### Bug Fixes & Improvements",
  "",
  "- Fixed crash on startup",
  "- Fixed sync retries",
  "",
].join("\n");

const id = (text: string): string => entryIdentity(text);
const PLANNER = id("- Added the export planner");
const FILTERS = id("- Added saved filters");
const BREAKING = id("- **Breaking**: Removed the legacy API");
const TYPO = id("- Fixed a typo in settings");
const LOAD = id("- Improved load times");
const CRASH = id("- Fixed crash on startup");
const SYNC = id("- Fixed sync retries");

const curationComment = (
  release: string,
  highlighted: string[],
  rolledUp: string[],
  omitted: string[]
): string =>
  `<!-- simple-changelogs-curation source="CHANGELOG.md" release="${release}" highlighted="${highlighted.join(",")}" rolled-up="${rolledUp.join(",")}" omitted="${omitted.join(",")}" -->`;

const releaseNotes = (minorComment: string, patchComment?: string): string =>
  [
    "# Release Notes",
    "",
    "## 2.1.0 - 2026-08-01",
    "",
    "- Plan exports before you run them",
    "- Save your favorite filters",
    "- **Breaking**: the legacy API is gone",
    "",
    "Plus 2 smaller changes — see CHANGELOG.md for the complete list.",
    "",
    minorComment,
    "",
    ...(patchComment
      ? [
          "## 2.0.1 - 2026-07-10",
          "",
          "Plus 2 smaller fixes — see CHANGELOG.md for the complete list.",
          "",
          patchComment,
          "",
        ]
      : []),
  ].join("\n");

const CLEAN_MINOR = curationComment(
  "2.1.0 - 2026-08-01",
  [PLANNER, FILTERS, BREAKING],
  [LOAD],
  [TYPO]
);
const CLEAN_PATCH = curationComment(
  "2.0.1 - 2026-07-10",
  [],
  [CRASH, SYNC],
  []
);

const runCheck = (repo: string): Promise<CliResult> =>
  runQuery(["check", "--log", "customer", "--repo", repo]);

describe("check curation coverage", () => {
  test("clean coverage passes, including a zero-highlight patch release", async () => {
    const repo = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(CLEAN_MINOR, CLEAN_PATCH),
    });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Structure check passed.");
    expect(result.stdout).toContain("RELEASE_NOTES.md");
  });

  test("missing RELEASE_NOTES.md is never a problem", async () => {
    const repo = await fixtureRepo({ "CHANGELOG.md": CHANGELOG });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("RELEASE_NOTES.md");
  });

  test("an unaccounted entry fails", async () => {
    const repo = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(
        curationComment(
          "2.1.0 - 2026-08-01",
          [PLANNER, FILTERS, BREAKING],
          [LOAD],
          []
        )
      ),
    });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(`entry ${TYPO} is not accounted`);
  });

  test("an unknown id fails", async () => {
    const repo = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(
        curationComment(
          "2.1.0 - 2026-08-01",
          [PLANNER, FILTERS, BREAKING],
          [LOAD],
          [TYPO, "deadbeef0000"]
        )
      ),
    });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(
      "id deadbeef0000 does not resolve to any entry"
    );
  });

  test("a double-accounted entry fails", async () => {
    const repo = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(
        curationComment(
          "2.1.0 - 2026-08-01",
          [PLANNER, FILTERS, BREAKING],
          [LOAD, TYPO],
          [TYPO]
        )
      ),
    });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(`id ${TYPO} is accounted 2 times`);
  });

  test("an omitted Breaking entry fails", async () => {
    const repo = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(
        curationComment(
          "2.1.0 - 2026-08-01",
          [PLANNER, FILTERS, TYPO],
          [LOAD],
          [BREAKING]
        )
      ),
    });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("may not be omitted or rolled up");
  });

  test("two highlights fail on a minor release but pass on a patch release", async () => {
    const thinMinor = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(
        curationComment(
          "2.1.0 - 2026-08-01",
          [PLANNER, BREAKING],
          [FILTERS, LOAD],
          [TYPO]
        )
      ),
    });
    const minorResult = await runCheck(thinMinor);
    expect(minorResult.exitCode).toBe(1);
    expect(minorResult.stdout).toContain(
      "2 highlights fall below the budget minimum of 3"
    );

    const thinPatch = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": [
        "# Release Notes",
        "",
        "## 2.0.1 - 2026-07-10",
        "",
        "- Fixed crash on startup",
        "- Fixed sync retries",
        "",
        curationComment("2.0.1 - 2026-07-10", [CRASH, SYNC], [], []),
        "",
      ].join("\n"),
    });
    const patchResult = await runCheck(thinPatch);
    expect(patchResult.exitCode).toBe(0);
  });

  test("more highlights than the maximum fail", async () => {
    // Nine one-entry "highlights" require nine entries; shrink the budget
    // instead to keep the fixture small and prove the policy file is read.
    const repo = await fixtureRepo({
      ".simple-changelogs.json": JSON.stringify({
        curationBudget: { max: 2, min: 1 },
        publicReleaseNotes: "curated",
      }),
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(CLEAN_MINOR),
    });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(
      "3 highlights exceed the budget maximum of 2"
    );
  });

  test("nine highlighted ids exceed the default maximum of 8", async () => {
    const entries = Array.from(
      { length: 9 },
      (_, index) => `- Shipped feature number ${index + 1}`
    );
    const ids = entries.map((entry) => id(entry));
    const repo = await fixtureRepo({
      "CHANGELOG.md": [
        "# Changelog",
        "",
        "## 3.0.0 - 2026-08-15",
        "",
        ...entries,
        "",
      ].join("\n"),
      "RELEASE_NOTES.md": [
        "# Release Notes",
        "",
        "## 3.0.0 - 2026-08-15",
        "",
        ...entries,
        "",
        curationComment("3.0.0 - 2026-08-15", ids, [], []),
        "",
      ].join("\n"),
    });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(
      "9 highlights exceed the budget maximum of 8"
    );
  });

  test("a malformed curation comment is a diagnostic", async () => {
    const repo = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(
        '<!-- simple-changelogs-curation release="2.1.0 - 2026-08-01" -->'
      ),
    });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Malformed curation comment");
  });

  test("a curated Unreleased section is a problem", async () => {
    const repo = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": [
        "# Release Notes",
        "",
        "## Unreleased",
        "",
        "- Pending work",
        "",
        curationComment("Unreleased", [id("- Pending work")], [], []),
        "",
      ].join("\n"),
    });
    const result = await runCheck(repo);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Unreleased is never curated");
  });
});

describe("entries --ids", () => {
  test("table and JSON output carry stable 12-hex ids", async () => {
    const repo = await fixtureRepo({ "CHANGELOG.md": CHANGELOG });
    const jsonResult = await runQuery([
      "entries",
      "--ids",
      "--log",
      "customer",
      "--repo",
      repo,
      "--json",
    ]);
    expect(jsonResult.exitCode).toBe(0);
    const payload = JSON.parse(jsonResult.stdout) as {
      entries: Array<{ id: string; title: string }>;
    };
    expect(payload.entries.every((entry) => ID_PATTERN.test(entry.id))).toBe(
      true
    );
    const planner = payload.entries.find(
      (entry) => entry.title === "Added the export planner"
    );
    expect(planner?.id).toBe(PLANNER);

    const tableResult = await runQuery([
      "entries",
      "--ids",
      "--log",
      "customer",
      "--repo",
      repo,
    ]);
    expect(tableResult.exitCode).toBe(0);
    expect(tableResult.stdout).toContain("ID");
    expect(tableResult.stdout).toContain(PLANNER);
  });
});

describe("show --omitted", () => {
  test("lists the omitted and rolled-up entries of a curated release", async () => {
    const repo = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(CLEAN_MINOR, CLEAN_PATCH),
    });
    const result = await runQuery([
      "show",
      "2.1.0",
      "--log",
      "customer",
      "--omitted",
      "--repo",
      repo,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      omitted: Array<{ id: string; title: string }>;
      rolledUp: Array<{ id: string; title: string }>;
      unknownIds: string[];
    };
    expect(payload.omitted.map((entry) => entry.title)).toEqual([
      "Fixed a typo in settings",
    ]);
    expect(payload.rolledUp.map((entry) => entry.title)).toEqual([
      "Improved load times",
    ]);
    expect(payload.unknownIds).toEqual([]);
  });

  test("fails clearly when no curated section exists for the release", async () => {
    const repo = await fixtureRepo({
      "CHANGELOG.md": CHANGELOG,
      "RELEASE_NOTES.md": releaseNotes(CLEAN_MINOR),
    });
    const result = await runQuery([
      "show",
      "2.0.1",
      "--log",
      "customer",
      "--omitted",
      "--repo",
      repo,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("no curated section");
  });

  test("fails clearly when RELEASE_NOTES.md is absent", async () => {
    const repo = await fixtureRepo({ "CHANGELOG.md": CHANGELOG });
    const result = await runQuery([
      "show",
      "2.1.0",
      "--log",
      "customer",
      "--omitted",
      "--repo",
      repo,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("RELEASE_NOTES.md");
  });
});

describe("parseReleaseNotes", () => {
  test("extracts headings, highlights, and provenance", () => {
    const parsed = parseReleaseNotes(
      releaseNotes(CLEAN_MINOR, CLEAN_PATCH),
      "RELEASE_NOTES.md"
    );
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.sections).toHaveLength(2);
    const [minor, patch] = parsed.sections;
    expect(minor?.version).toBe("2.1.0");
    expect(minor?.highlights).toHaveLength(3);
    expect(minor?.curation?.highlighted).toEqual([PLANNER, FILTERS, BREAKING]);
    expect(patch?.highlights).toHaveLength(0);
    expect(patch?.curation?.rolledUp).toEqual([CRASH, SYNC]);
  });

  test("reports non-hex ids and duplicate comments as diagnostics", () => {
    const parsed = parseReleaseNotes(
      [
        "# Release Notes",
        "",
        "## 2.1.0 - 2026-08-01",
        "",
        curationComment("2.1.0 - 2026-08-01", ["nothexatall!"], [], []),
        curationComment("2.1.0 - 2026-08-01", [], [], []),
        "",
      ].join("\n"),
      "RELEASE_NOTES.md"
    );
    expect(
      parsed.diagnostics.some((diagnostic) =>
        diagnostic.includes("not a 12-hex entry identity")
      )
    ).toBe(true);
    expect(
      parsed.diagnostics.some((diagnostic) =>
        diagnostic.includes("more than one curation comment")
      )
    ).toBe(true);
  });
});
