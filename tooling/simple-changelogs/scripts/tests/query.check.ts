import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import { parseChangelog, signatureDate } from "../lib/changelog-parse.ts";

const repositoryRoot = join(import.meta.dir, "../../../..");
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GREP_PATTERN = /release notes?/;

function nth<T>(list: readonly T[], index: number): T {
  const value = list.at(index);
  if (value === undefined) {
    throw new Error(`Expected an element at index ${index}`);
  }
  return value;
}
const queryPath = new URL("../query.ts", import.meta.url).pathname;
const temporaryDirectories: string[] = [];

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

const fixtureRepo = async (customer: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "query-check-"));
  temporaryDirectories.push(root);
  await writeFile(join(root, "CHANGELOG.md"), customer);
  return root;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("changelog-parse on this repository's real histories", () => {
  test("parses every customer release section cleanly", async () => {
    const source = await readFile(join(repositoryRoot, "CHANGELOG.md"), "utf8");
    const parsed = parseChangelog(source, "CHANGELOG.md");
    expect(parsed.diagnostics).toHaveLength(0);
    expect(parsed.unrecognizedHeadings).toHaveLength(0);
    expect(parsed.malformedSignatures).toHaveLength(0);
    expect(parsed.releases.length).toBeGreaterThanOrEqual(10);
    const pending = nth(parsed.releases, 0);
    expect(pending.unreleased).toBe(true);
    expect(pending.entries.length).toBeGreaterThan(0);
  });

  test("recognizes the legacy signature dialect in the developer history", async () => {
    const source = await readFile(
      join(repositoryRoot, "DEVELOPER_CHANGELOG.md"),
      "utf8"
    );
    const parsed = parseChangelog(source, "DEVELOPER_CHANGELOG.md");
    expect(parsed.diagnostics).toHaveLength(0);
    expect(parsed.malformedSignatures).toHaveLength(0);
    expect(parsed.legacySignatureCount).toBeGreaterThanOrEqual(10);
    const legacySigned = parsed.releases
      .flatMap((release) => release.entries)
      .filter((entry) => entry.signature?.legacy === true);
    expect(legacySigned.length).toBeGreaterThan(0);
    const sample = nth(legacySigned, 0).signature;
    expect(sample?.agent.length).toBeGreaterThan(0);
    expect(signatureDate(sample as NonNullable<typeof sample>)).toMatch(
      DAY_PATTERN
    );
  });
});

describe("query CLI against this repository", () => {
  test("releases lists both logs with entry counts", async () => {
    const result = await runQuery([
      "releases",
      "--repo",
      repositoryRoot,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      releases: Array<{ entryCount: number; log: string; unreleased: boolean }>;
    };
    expect(payload.releases.some((row) => row.log === "customer")).toBe(true);
    expect(payload.releases.some((row) => row.log === "developer")).toBe(true);
    expect(payload.releases.every((row) => row.entryCount >= 0)).toBe(true);
  });

  test("show unreleased returns the pending customer entries", async () => {
    const result = await runQuery([
      "show",
      "unreleased",
      "--log",
      "customer",
      "--repo",
      repositoryRoot,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      release: { entries: unknown[]; unreleased: boolean };
    };
    expect(payload.release.unreleased).toBe(true);
    expect(payload.release.entries.length).toBeGreaterThan(0);
  });

  test("check passes on this repository's histories", async () => {
    const result = await runQuery(["check", "--repo", repositoryRoot]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Structure check passed.");
  });

  test("grep filters entries by pattern", async () => {
    const result = await runQuery([
      "entries",
      "--grep",
      "release notes?",
      "--log",
      "customer",
      "--repo",
      repositoryRoot,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      entries: Array<{ log: string; text: string }>;
    };
    expect(payload.entries.length).toBeGreaterThan(0);
    expect(
      payload.entries.every((entry) => GREP_PATTERN.test(entry.text))
    ).toBe(true);
  });
});

describe("query CLI on synthetic fixtures", () => {
  test("resolves a bare version to its full release", async () => {
    const repo = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## 1.4.0 - 2026-05-01",
        "",
        "- Added the export planner",
        "",
        "## 1.3.0 - 2026-04-01",
        "",
        "- Added saved filters",
        "",
      ].join("\n")
    );
    const result = await runQuery(["show", "1.4", "--repo", repo, "--json"]);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      release: { version: string };
    };
    expect(payload.release.version).toBe("1.4.0");
  });

  test("refuses duplicate headings with a candidate list", async () => {
    const repo = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## 1.0.0 - 2026-01-01",
        "",
        "- First cut",
        "",
        "## 1.0.0 - 2026-01-01",
        "",
        "- Accidental duplicate",
        "",
      ].join("\n")
    );
    const result = await runQuery(["show", "1.0.0", "--repo", repo]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ambiguous");
    expect(result.stderr).toContain("occurrence 1");
    expect(result.stderr).toContain("occurrence 2");
  });

  test("filters grouped bullets and falls back to signature dates", async () => {
    const repo = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## Unreleased",
        "",
        "- **Web**: Added the account switcher",
        '<!-- simple-changelogs-signature agent="Test Agent" at="2026-08-20T10:00:00-05:00" -->',
        "- **Mobile**: Added offline sync",
        "<!-- Agent: Legacy Agent | 06/01/2026 9:30 AM CDT -->",
        "",
        "## 1.0.0 - 2026-01-01",
        "",
        "- Initial release",
        "",
      ].join("\n")
    );
    const grouped = await runQuery([
      "entries",
      "--group",
      "Web",
      "--repo",
      repo,
      "--json",
    ]);
    expect(grouped.exitCode).toBe(0);
    const groupedPayload = JSON.parse(grouped.stdout) as {
      entries: Array<{ group: string }>;
    };
    expect(groupedPayload.entries).toHaveLength(1);
    expect(groupedPayload.entries[0]?.group).toBe("Web");

    const since = await runQuery([
      "entries",
      "--since",
      "2026-07-01",
      "--repo",
      repo,
      "--json",
    ]);
    expect(since.exitCode).toBe(0);
    const sincePayload = JSON.parse(since.stdout) as {
      entries: Array<{ date: string; group: string | null }>;
    };
    expect(sincePayload.entries).toHaveLength(1);
    expect(sincePayload.entries[0]?.group).toBe("Web");
    expect(sincePayload.entries[0]?.date).toBe("2026-08-20");

    const agent = await runQuery([
      "entries",
      "--agent",
      "Legacy",
      "--repo",
      repo,
      "--json",
    ]);
    const agentPayload = JSON.parse(agent.stdout) as {
      entries: Array<{ group: string | null }>;
    };
    expect(agentPayload.entries).toHaveLength(1);
    expect(agentPayload.entries[0]?.group).toBe("Mobile");
  });

  test("check reports malformed structure and exits nonzero", async () => {
    const repo = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## Assorted Notes",
        "",
        "- An entry under an unrecognizable release heading",
        "<!-- simple-changelogs-signature missing attributes -->",
        "",
      ].join("\n")
    );
    const result = await runQuery(["check", "--repo", repo, "--json"]);
    expect(result.exitCode).toBe(1);
    const payload = JSON.parse(result.stdout) as {
      files: Array<{
        malformedSignatures: string[];
        unrecognizedHeadings: string[];
      }>;
      ok: boolean;
    };
    expect(payload.ok).toBe(false);
    expect(payload.files[0]?.unrecognizedHeadings).toEqual(["Assorted Notes"]);
    expect(payload.files[0]?.malformedSignatures).toHaveLength(1);
  });

  test("check accepts one empty Unreleased heading after a release", async () => {
    const repo = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## Unreleased",
        "",
        "## 1.0.0 - 2026-01-01",
        "",
        "- Initial release",
        "",
      ].join("\n")
    );
    const result = await runQuery([
      "check",
      "--log",
      "customer",
      "--repo",
      repo,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      files: Array<{ unanchored: boolean }>;
      ok: boolean;
    };
    expect(payload.ok).toBe(true);
    expect(payload.files[0]?.unanchored).toBe(false);

    const pending = await runQuery(["show", "unreleased", "--repo", repo]);
    expect(pending.exitCode).toBe(0);
  });

  test("check notes a missing or non-leading Unreleased heading without failing", async () => {
    const missing = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## 1.0.0 - 2026-01-01",
        "",
        "- Initial release",
        "",
      ].join("\n")
    );
    const missingResult = await runQuery([
      "check",
      "--log",
      "customer",
      "--repo",
      missing,
    ]);
    expect(missingResult.exitCode).toBe(0);
    expect(missingResult.stdout).toContain(
      "note: Unreleased is not the first release heading"
    );

    const misplaced = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## 2.0.0 - 2026-07-01",
        "",
        "- Stable release",
        "",
        "## Unreleased",
        "",
        "## 2.0.0-beta.2 - 2026-06-15",
        "",
        "- Beta release",
        "",
      ].join("\n")
    );
    const misplacedResult = await runQuery([
      "check",
      "--log",
      "customer",
      "--repo",
      misplaced,
      "--json",
    ]);
    expect(misplacedResult.exitCode).toBe(0);
    const payload = JSON.parse(misplacedResult.stdout) as {
      files: Array<{ unanchored: boolean }>;
    };
    expect(payload.files[0]?.unanchored).toBe(true);
  });

  test("check rejects a duplicate Unreleased heading", async () => {
    const repo = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## Unreleased",
        "",
        "- Pending work",
        "",
        "## [Unreleased]",
        "",
        "## 1.0.0 - 2026-01-01",
        "",
        "- Initial release",
        "",
      ].join("\n")
    );
    const result = await runQuery([
      "check",
      "--log",
      "customer",
      "--repo",
      repo,
      "--json",
    ]);
    expect(result.exitCode).toBe(1);
    const payload = JSON.parse(result.stdout) as {
      files: Array<{ diagnostics: string[] }>;
      ok: boolean;
    };
    expect(payload.ok).toBe(false);
    expect(payload.files[0]?.diagnostics).toEqual([
      'duplicate Unreleased heading "## [Unreleased]"',
    ]);
  });

  test("help exits 0 and a leading v selects a version", async () => {
    const help = await runQuery(["--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("Usage: query.ts");

    const repo = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## 1.3.0 - 2026-04-01",
        "",
        "- Added filters",
        "",
      ].join("\n")
    );
    const show = await runQuery(["show", "v1.3.0", "--repo", repo, "--json"]);
    expect(show.exitCode).toBe(0);
  });

  test("check fails on a comment that would swallow a release", async () => {
    const repo = await fixtureRepo(
      [
        "# Changelog",
        "",
        "## Unreleased",
        "",
        "<!-- TODO",
        "## 1.0.0 - 2026-01-01",
        "",
        "- Initial release",
        "",
      ].join("\n")
    );
    const result = await runQuery([
      "check",
      "--log",
      "customer",
      "--repo",
      repo,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Unclosed HTML comment at line 5");
  });

  test("errors when the developer log is explicitly requested but missing", async () => {
    const repo = await fixtureRepo(
      ["# Changelog", "", "## Unreleased", "", "- Pending", ""].join("\n")
    );
    const explicit = await runQuery([
      "releases",
      "--log",
      "developer",
      "--repo",
      repo,
    ]);
    expect(explicit.exitCode).toBe(1);
    expect(explicit.stderr).toContain("DEVELOPER_CHANGELOG.md");

    const both = await runQuery(["releases", "--repo", repo]);
    expect(both.exitCode).toBe(0);
  });
});
