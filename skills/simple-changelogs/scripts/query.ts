#!/usr/bin/env bun

// Read-only query CLI over the raw Markdown changelogs. The Markdown files
// remain the source of truth: this tool never writes, caches, or indexes.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Glob, spawnSync } from "bun";
import {
  type ChangelogEntry,
  type ChangelogRelease,
  type CurationRecord,
  type ParsedChangelog,
  type ParsedReleaseNotes,
  parseChangelog,
  parseReleaseNotes,
  type ReleaseNotesSection,
  signatureDate,
} from "./lib/changelog-parse.ts";

const USAGE = `Usage: query.ts <command> [options]

Commands:
  releases                     List release sections with entry counts.
  show <version|date|unreleased>
                               Show every entry of one release section.
  entries                      List entries, optionally filtered.
  gaps [--since TAG] [--train NAME]
                               List merges since a release tag (default: the
                               newest one reachable from HEAD that matches
                               releaseTags) that add no changelog lines.
  check                        Lint changelog structure; nonzero on problems.
                               Under a curated policy, also verifies
                               RELEASE_NOTES.md against the changelog. Also
                               holds App Store and Google Play release-note
                               files to their per-locale character limits.
  help                         Print this text.

Options:
  --log customer|developer|both   Which changelog to read (default: both).
  --repo PATH                     Repository root (default: current directory).
  --json                          Structured JSON output.
  --since YYYY-MM-DD              entries: keep entries on or after this day.
  --since TAG                     gaps: the release tag to start after.
  --train NAME                    gaps: the train whose releaseTags template
                                  names the default tag.
  --until YYYY-MM-DD              entries: keep entries on or before this day.
  --group NAME                    entries: keep "- **NAME**:" grouped bullets.
  --agent SUBSTRING               entries: filter by signature agent.
  --grep REGEX                    entries: filter by entry text.
  --ids                           entries: include each entry's 12-hex id.
  --omitted                       show: list the entries a curated
                                  RELEASE_NOTES.md section records as
                                  omitted or rolled up (customer log only).

Dates use the release date, falling back to the entry's signature timestamp
for Unreleased entries. Reads CHANGELOG.md (customer) and
DEVELOPER_CHANGELOG.md (developer) at the repository root.`;

const LOG_CHOICES = ["customer", "developer", "both"] as const;
type LogChoice = (typeof LOG_CHOICES)[number];
type LogName = "customer" | "developer";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LEADING_V_PATTERN = /^v(?=\d)/i;
const LOG_FILES: Record<LogName, string> = {
  customer: "CHANGELOG.md",
  developer: "DEVELOPER_CHANGELOG.md",
};

interface CliOptions {
  agent: string | null;
  command: string;
  grep: string | null;
  group: string | null;
  ids: boolean;
  json: boolean;
  log: LogChoice;
  omitted: boolean;
  repo: string;
  selector: string | null;
  since: string | null;
  train: string | null;
  until: string | null;
}

class CliError extends Error {}

const VALUE_FLAGS = new Set([
  "--agent",
  "--grep",
  "--group",
  "--log",
  "--repo",
  "--since",
  "--train",
  "--until",
]);

const parseCli = (argv: string[]): CliOptions => {
  const [command] = argv;
  if (!command || command.startsWith("--")) {
    throw new CliError(USAGE);
  }
  const options: CliOptions = {
    agent: null,
    command,
    grep: null,
    group: null,
    ids: false,
    json: false,
    log: "both",
    omitted: false,
    repo: process.cwd(),
    selector: null,
    since: null,
    train: null,
    until: null,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const name = argv[index] ?? "";
    if (name === "--json") {
      options.json = true;
      continue;
    }
    if (name === "--ids") {
      options.ids = true;
      continue;
    }
    if (name === "--omitted") {
      options.omitted = true;
      continue;
    }
    if (VALUE_FLAGS.has(name)) {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new CliError(`Missing value for ${name}`);
      }
      index += 1;
      applyValueFlag(options, name, value);
      continue;
    }
    if (name.startsWith("--")) {
      throw new CliError(`Unknown option: ${name}\n\n${USAGE}`);
    }
    if (options.selector !== null) {
      throw new CliError(`Unexpected extra argument: ${name}`);
    }
    options.selector = name;
  }
  return withOmittedLog(options, argv);
};

// --omitted reads only the customer changelog.
const withOmittedLog = (options: CliOptions, argv: string[]): CliOptions => {
  if (options.omitted && argv.includes("--log") && options.log !== "customer") {
    throw new CliError("--omitted reads only the customer changelog.");
  }
  return options.omitted ? { ...options, log: "customer" } : options;
};

const applyValueFlag = (
  options: CliOptions,
  name: string,
  value: string
): void => {
  switch (name) {
    case "--agent": {
      options.agent = value;
      break;
    }
    case "--grep": {
      options.grep = value;
      break;
    }
    case "--group": {
      options.group = value;
      break;
    }
    case "--log": {
      if (!LOG_CHOICES.includes(value as LogChoice)) {
        throw new CliError(
          `--log must be one of: ${LOG_CHOICES.join(", ")} (got "${value}")`
        );
      }
      options.log = value as LogChoice;
      break;
    }
    case "--repo": {
      options.repo = resolve(value);
      break;
    }
    case "--train": {
      options.train = value;
      break;
    }
    case "--since":
    case "--until": {
      // gaps takes a release tag, which Git resolves or refuses.
      if (options.command === "gaps" && name === "--since") {
        options.since = value;
        break;
      }
      if (!DAY_PATTERN.test(value)) {
        throw new CliError(
          `${name} must be a YYYY-MM-DD date (got "${value}")`
        );
      }
      if (name === "--since") {
        options.since = value;
      } else {
        options.until = value;
      }
      break;
    }
    default: {
      throw new CliError(`Unknown option: ${name}`);
    }
  }
};

interface LoadedLog {
  log: LogName;
  parsed: ParsedChangelog;
  path: string;
}

const requestedLogs = (choice: LogChoice): LogName[] => {
  if (choice === "both") {
    return ["customer", "developer"];
  }
  return [choice];
};

const POLICY_FILE = ".simple-changelogs.json";

type Policy = Record<string, unknown> | null;

// A string result says why the policy file is unreadable.
const readRepoPolicy = async (repo: string): Promise<Policy | string> => {
  const path = join(repo, POLICY_FILE);
  try {
    const value = existsSync(path)
      ? JSON.parse(await readFile(path, "utf8"))
      : null;
    return typeof value === "object"
      ? value
      : `${POLICY_FILE} is not an object`;
  } catch (error) {
    return `${POLICY_FILE} is not valid JSON (${String(error)})`;
  }
};

const loadLogs = async (options: CliOptions): Promise<LoadedLog[]> => {
  const names = requestedLogs(options.log);
  const explicit = options.log !== "both";
  const policy = await readRepoPolicy(options.repo);
  const missingIsError = (log: LogName): boolean =>
    (explicit && log === "developer") ||
    log === "customer" ||
    (typeof policy === "object" && policy?.developerChangelog === "required");
  const candidates = await Promise.all(
    names.map(async (log): Promise<LoadedLog | null> => {
      const path = join(options.repo, LOG_FILES[log]);
      if (!existsSync(path)) {
        if (missingIsError(log)) {
          throw new CliError(`Changelog file not found: ${path}`);
        }
        return null;
      }
      return {
        log,
        parsed: parseChangelog(await readFile(path, "utf8"), LOG_FILES[log]),
        path,
      };
    })
  );
  const loaded = candidates.filter(
    (candidate): candidate is LoadedLog => candidate !== null
  );
  if (loaded.length === 0) {
    throw new CliError(
      `No changelog files found under ${options.repo} for --log ${options.log}`
    );
  }
  return loaded;
};

interface ReleaseRow {
  date: string | null;
  entryCount: number;
  heading: string;
  log: LogName;
  occurrence: number;
  unreleased: boolean;
  version: string | null;
}

const releaseRow = (log: LogName, release: ChangelogRelease): ReleaseRow => ({
  date: release.date,
  entryCount: release.entries.length,
  heading: release.heading,
  log,
  occurrence: release.occurrence,
  unreleased: release.unreleased,
  version: release.version,
});

const table = (headers: string[], rows: string[][]): string => {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? "").length))
  );
  const renderRow = (row: string[]): string =>
    row
      .map((cell, column) => cell.padEnd(widths[column] ?? cell.length))
      .join("  ")
      .trimEnd();
  return [renderRow(headers), ...rows.map(renderRow)].join("\n");
};

const runReleases = (options: CliOptions, logs: LoadedLog[]): string => {
  const rows = logs.flatMap(({ log, parsed }) =>
    parsed.releases.map((release) => releaseRow(log, release))
  );
  if (options.json) {
    return JSON.stringify({ releases: rows }, null, 2);
  }
  return table(
    ["LOG", "HEADING", "VERSION", "DATE", "ENTRIES"],
    rows.map((row) => [
      row.log,
      row.heading,
      row.version ?? "-",
      row.date ?? "-",
      String(row.entryCount),
    ])
  );
};

interface EntryRecord {
  date: string | null;
  group: string | null;
  heading: string;
  id: string;
  log: LogName;
  section: string | null;
  signature: { agent: string; at: string } | null;
  text: string;
  title: string;
  version: string | null;
}

const entryRecord = (
  log: LogName,
  release: ChangelogRelease,
  entry: ChangelogEntry
): EntryRecord => ({
  date:
    release.date ?? (entry.signature ? signatureDate(entry.signature) : null),
  group: entry.group,
  heading: release.heading,
  id: entry.id,
  log,
  section: entry.section,
  signature: entry.signature
    ? { agent: entry.signature.agent, at: entry.signature.at }
    : null,
  text: entry.text,
  title: entry.title,
  version: release.version,
});

const allEntryRecords = (logs: LoadedLog[]): EntryRecord[] =>
  logs.flatMap(({ log, parsed }) =>
    parsed.releases.flatMap((release) =>
      release.entries.map((entry) => entryRecord(log, release, entry))
    )
  );

const matchesVersionSelector = (
  version: string | null,
  selector: string
): boolean =>
  version !== null &&
  (version === selector || version.startsWith(`${selector}.`));

const releaseMatchesSelector = (
  release: ChangelogRelease,
  selector: string
): boolean => {
  if (selector.toLowerCase() === "unreleased") {
    return release.unreleased;
  }
  if (DAY_PATTERN.test(selector)) {
    return release.date === selector;
  }
  return matchesVersionSelector(
    release.version,
    selector.replace(LEADING_V_PATTERN, "")
  );
};

const describeCandidate = (log: LogName, release: ChangelogRelease): string =>
  `${log}: "${release.heading}" (occurrence ${release.occurrence}, ${release.entries.length} entries)`;

interface ShowMatch {
  log: LogName;
  release: ChangelogRelease;
}

const runShowOmitted = (
  options: CliOptions,
  match: ShowMatch,
  notes: ParsedReleaseNotes | null
): string => {
  if (notes === null) {
    throw new CliError(
      `--omitted requires ${RELEASE_NOTES_FILE} at the repository root; none was found.`
    );
  }
  const section = notes.sections.find(
    (candidate) => candidate.curation?.release === match.release.heading
  );
  if (!section?.curation) {
    throw new CliError(
      `${RELEASE_NOTES_FILE} has no curated section for release "${match.release.heading}".`
    );
  }
  const byId = new Map(match.release.entries.map((entry) => [entry.id, entry]));
  const resolveIds = (ids: string[]) => ({
    entries: ids
      .filter((id) => byId.has(id))
      .map((id) =>
        entryRecord(match.log, match.release, byId.get(id) as ChangelogEntry)
      ),
    unknownIds: ids.filter((id) => !byId.has(id)),
  });
  const omitted = resolveIds(section.curation.omitted);
  const rolledUp = resolveIds(section.curation.rolledUp);
  if (options.json) {
    return JSON.stringify(
      {
        omitted: omitted.entries,
        release: releaseRow(match.log, match.release),
        rolledUp: rolledUp.entries,
        unknownIds: [...omitted.unknownIds, ...rolledUp.unknownIds],
      },
      null,
      2
    );
  }
  const lines = [
    `${match.log}: ${match.release.heading} (curated in ${RELEASE_NOTES_FILE})`,
    "",
    `omitted (${omitted.entries.length}):`,
    ...omitted.entries.map((entry) => entry.text),
    "",
    `rolled-up (${rolledUp.entries.length}):`,
    ...rolledUp.entries.map((entry) => entry.text),
  ];
  const unknown = [...omitted.unknownIds, ...rolledUp.unknownIds];
  if (unknown.length > 0) {
    lines.push("", `unknown ids: ${unknown.join(", ")}`);
  }
  return lines.join("\n");
};

const runShow = (
  options: CliOptions,
  logs: LoadedLog[],
  notes: ParsedReleaseNotes | null
): string => {
  const { selector } = options;
  if (!selector) {
    throw new CliError(
      "show requires a selector: a version, a YYYY-MM-DD date, or unreleased"
    );
  }
  const matches: ShowMatch[] = logs.flatMap(({ log, parsed }) =>
    parsed.releases
      .filter((release) => releaseMatchesSelector(release, selector))
      .map((release) => ({ log, release }))
  );
  if (matches.length === 0) {
    const available = logs.flatMap(({ log, parsed }) =>
      parsed.releases.map((release) => describeCandidate(log, release))
    );
    throw new CliError(
      `No release matches "${selector}". Known releases:\n${available.join("\n")}`
    );
  }
  if (matches.length > 1) {
    throw new CliError(
      `"${selector}" is ambiguous; narrow with --log or an exact heading. Candidates:\n${matches
        .map((candidate) => describeCandidate(candidate.log, candidate.release))
        .join("\n")}`
    );
  }
  const match = matches[0] as ShowMatch;
  if (options.omitted) {
    return runShowOmitted(options, match, notes);
  }
  const entries = match.release.entries.map((entry) =>
    entryRecord(match.log, match.release, entry)
  );
  if (options.json) {
    return JSON.stringify(
      { release: { ...releaseRow(match.log, match.release), entries } },
      null,
      2
    );
  }
  const header = `${match.log}: ${match.release.heading} (${entries.length} entries)`;
  const body = entries.map((entry) => entry.text).join("\n");
  return `${header}\n\n${body}`;
};

const RELEASE_NOTES_FILE = "RELEASE_NOTES.md";

const loadReleaseNotes = async (
  repo: string
): Promise<ParsedReleaseNotes | null> => {
  const path = join(repo, RELEASE_NOTES_FILE);
  if (!existsSync(path)) {
    return null;
  }
  return parseReleaseNotes(await readFile(path, "utf8"), RELEASE_NOTES_FILE);
};

interface CurationBudgetValues {
  max: number;
  min: number;
}

// The policy budget, or a problem string when it is not 0 <= min <= max.
const curationBudget = (
  policy: Record<string, unknown>
): CurationBudgetValues | string => {
  const { max = 8, min = 3 } = (policy.curationBudget ?? {}) as {
    max?: number;
    min?: number;
  };
  return Number.isInteger(min) &&
    Number.isInteger(max) &&
    min >= 0 &&
    min <= max
    ? { max, min }
    : "curationBudget must hold integers with 0 <= min <= max";
};

// Patch releases (nonzero third version component) and date-only headings
// are exempt from the highlight minimum.
const isPatchVersion = (version: string | null): boolean => {
  if (version === null) {
    return false;
  }
  const patch = Number.parseInt(version.split(".")[2] ?? "", 10);
  return Number.isFinite(patch) && patch > 0;
};

const NON_FILTERABLE_NAME_PATTERN = /\b(?:breaking|security)\b/i;
// "**Breaking**:", "**Security:**", "__Breaking__", or "Security:" leading
// any entry line, nested child bullets included.
const NON_FILTERABLE_LEAD_PATTERN =
  /^\s*(?:[-*+]\s+)?(?:(?:\*\*|__)\s*(?:breaking|security)\b[^*_\n]*(?:\*\*|__)|(?:breaking|security)\s*:)/im;

// Breaking/Security entries, groups, and sections at any depth.
const isNonFilterable = (entry: ChangelogEntry): boolean =>
  [entry.group ?? "", ...entry.sections].some((name) =>
    NON_FILTERABLE_NAME_PATTERN.test(name)
  ) || NON_FILTERABLE_LEAD_PATTERN.test(entry.text);

const compileGrep = (pattern: string): RegExp => {
  try {
    return new RegExp(pattern);
  } catch (error) {
    throw new CliError(
      `--grep is not a valid regular expression: ${String(error)}`,
      { cause: error }
    );
  }
};

const entryPassesFilters = (
  entry: EntryRecord,
  options: CliOptions,
  grep: RegExp | null
): boolean => {
  if (options.group !== null && entry.group !== options.group) {
    return false;
  }
  if (options.agent !== null) {
    const agentName = entry.signature === null ? "" : entry.signature.agent;
    if (!agentName.includes(options.agent)) {
      return false;
    }
  }
  if (grep && !grep.test(entry.text)) {
    return false;
  }
  if (options.since !== null || options.until !== null) {
    if (entry.date === null) {
      return false;
    }
    if (options.since !== null && entry.date < options.since) {
      return false;
    }
    if (options.until !== null && entry.date > options.until) {
      return false;
    }
  }
  return true;
};

const runEntries = (options: CliOptions, logs: LoadedLog[]): string => {
  const grep = options.grep === null ? null : compileGrep(options.grep);
  const dateFilterActive = options.since !== null || options.until !== null;
  const records = allEntryRecords(logs);
  const undatedCount = dateFilterActive
    ? records.filter((entry) => entry.date === null).length
    : 0;
  const entries = records.filter((entry) =>
    entryPassesFilters(entry, options, grep)
  );
  if (options.json) {
    return JSON.stringify({ entries }, null, 2);
  }
  const headers = options.ids
    ? ["LOG", "ID", "DATE", "RELEASE", "GROUP", "TITLE"]
    : ["LOG", "DATE", "RELEASE", "GROUP", "TITLE"];
  const rows = table(
    headers,
    entries.map((entry) => [
      entry.log,
      ...(options.ids ? [entry.id] : []),
      entry.date ?? "-",
      entry.heading,
      entry.group ?? "-",
      entry.title,
    ])
  );
  const note =
    undatedCount > 0
      ? `\n(${undatedCount} entries had no resolvable date and were excluded by the date filter)`
      : "";
  return `${rows}${note}`;
};

const accountingProblems = (
  release: ChangelogRelease,
  curation: CurationRecord
): string[] => {
  const problems: string[] = [];
  const required = new Map<string, number>();
  for (const entry of release.entries) {
    required.set(entry.id, (required.get(entry.id) ?? 0) + 1);
  }
  const recorded = new Map<string, number>();
  const allRecorded = [
    ...curation.highlighted,
    ...curation.rolledUp,
    ...curation.omitted,
  ];
  for (const id of allRecorded) {
    recorded.set(id, (recorded.get(id) ?? 0) + 1);
  }
  for (const [id, count] of recorded) {
    const expected = required.get(id) ?? 0;
    if (expected === 0) {
      problems.push(`id ${id} does not resolve to any entry of this release`);
    } else if (count > expected) {
      problems.push(
        `id ${id} is accounted ${count} times (expected ${expected})`
      );
    }
  }
  for (const [id, expected] of required) {
    const count = recorded.get(id) ?? 0;
    if (count < expected) {
      problems.push(
        `entry ${id} is not accounted as highlighted, rolled-up, or omitted`
      );
    }
  }
  const filtered = new Set([...curation.rolledUp, ...curation.omitted]);
  for (const entry of release.entries) {
    if (isNonFilterable(entry) && filtered.has(entry.id)) {
      problems.push(
        `entry ${entry.id} ("${entry.title}") is Breaking/Security and may not be omitted or rolled up`
      );
    }
  }
  return problems;
};

// Accounting, provenance that disagrees with its section, and the budget.
const sectionProblems = (
  section: ReleaseNotesSection,
  curation: CurationRecord,
  release: ChangelogRelease,
  budget: CurationBudgetValues
): string[] => {
  const problems = accountingProblems(release, curation);
  if (release.version !== section.version || release.date !== section.date) {
    problems.push(
      `provenance release "${curation.release}" does not match the section heading`
    );
  }
  const count = curation.highlighted.length;
  if (section.highlights.length !== count) {
    problems.push(
      `${section.highlights.length} highlight bullets but ${count} highlighted ids`
    );
  }
  if (count > budget.max) {
    problems.push(
      `${count} highlights exceed the budget maximum of ${budget.max}`
    );
  }
  // Never demand more highlights than a thin release has entries.
  const minimum = Math.min(budget.min, release.entries.length);
  const exempt = isPatchVersion(release.version) || release.version === null;
  if (!exempt && count < minimum) {
    problems.push(
      `${count} highlights fall below the budget minimum of ${minimum}`
    );
  }
  return problems;
};

const curationProblems = (
  notes: ParsedReleaseNotes,
  customer: ParsedChangelog,
  budget: CurationBudgetValues
): string[] => {
  const problems: string[] = [...notes.diagnostics];
  const bound = new Set<string>();
  for (const section of notes.sections) {
    const label = `curated section "${section.heading}"`;
    const { curation } = section;
    const releases = customer.releases.filter(
      (candidate) => candidate.heading === curation?.release
    );
    let problem: string | null = null;
    if (section.unreleased || releases[0]?.unreleased) {
      problem = "Unreleased is never curated";
    } else if (curation === null) {
      problem = "missing curation provenance comment";
    } else if (curation.source !== customer.sourcePath) {
      problem = `provenance source "${curation.source}" is not ${customer.sourcePath}`;
    } else if (bound.has(curation.release)) {
      problem = `release "${curation.release}" is curated twice`;
    } else if (releases.length !== 1) {
      problem = `release "${curation.release}" is ${releases.length === 0 ? "not found" : "ambiguous"} in ${customer.sourcePath}`;
    }
    if (problem !== null || curation === null) {
      problems.push(`${label}: ${problem}`);
      continue;
    }
    bound.add(curation.release);
    for (const found of sectionProblems(
      section,
      curation,
      releases[0] as ChangelogRelease,
      budget
    )) {
      problems.push(`${label}: ${found}`);
    }
  }
  return problems;
};

interface CheckFileReport {
  diagnostics: string[];
  legacySignatures: number;
  malformedSignatures: string[];
  notes?: string[];
  path: string;
  // A store note's length in code points and its store's per-locale limit.
  storeNote?: { characters: number; limit: number; store: string };
  unanchored?: boolean;
  unrecognizedHeadings: string[];
}

// One Unreleased heading, even empty, must lead: it anchors the next prepend.
const duplicateUnreleased = (parsed: ParsedChangelog): string[] =>
  parsed.releases
    .filter((release) => release.unreleased)
    .slice(1)
    .map((release) => `duplicate Unreleased heading "## ${release.heading}"`);

const checkFileReport = ({ parsed, path }: LoadedLog): CheckFileReport => ({
  diagnostics: [...parsed.diagnostics, ...duplicateUnreleased(parsed)],
  legacySignatures: parsed.legacySignatureCount,
  malformedSignatures: parsed.malformedSignatures,
  path,
  unanchored: parsed.releases[0]?.unreleased !== true,
  unrecognizedHeadings: parsed.unrecognizedHeadings,
});

const checkProblemCount = (report: CheckFileReport): number =>
  report.diagnostics.length +
  report.malformedSignatures.length +
  report.unrecognizedHeadings.length;

const describeCheckFile = (report: CheckFileReport): string => {
  const lines = [`${report.path}:`];
  for (const diagnostic of report.diagnostics) {
    lines.push(`  problem: ${diagnostic}`);
  }
  for (const heading of report.unrecognizedHeadings) {
    lines.push(`  problem: unrecognized release heading "## ${heading}"`);
  }
  for (const signature of report.malformedSignatures) {
    lines.push(`  problem: malformed signature comment ${signature}`);
  }
  if (report.legacySignatures > 0) {
    lines.push(
      `  note: ${report.legacySignatures} legacy signature comments (valid history; the canonical form is <!-- simple-changelogs-signature ... -->)`
    );
  }
  if (report.unanchored) {
    lines.push("  note: Unreleased is not the first release heading");
  }
  for (const note of report.notes ?? []) {
    lines.push(`  note: ${note}`);
  }
  if (checkProblemCount(report) === 0) {
    lines.push("  ok");
  }
  return lines.join("\n");
};

const extraReport = (
  path: string,
  diagnostics: string[],
  notes: string[] = []
): CheckFileReport => ({
  diagnostics,
  legacySignatures: 0,
  malformedSignatures: [],
  notes,
  path,
  unrecognizedHeadings: [],
});

// Curation is enforced only under publicReleaseNotes: "curated"; otherwise an
// existing RELEASE_NOTES.md earns a note, never a problem.
const curationReports = (
  repo: string,
  customer: ParsedChangelog | undefined,
  notes: ParsedReleaseNotes | null,
  policy: Policy | string
): CheckFileReport[] => {
  if (typeof policy === "string") {
    return [extraReport(join(repo, POLICY_FILE), [policy])];
  }
  if (notes === null || customer === undefined) {
    return [];
  }
  const path = join(repo, RELEASE_NOTES_FILE);
  if (policy?.publicReleaseNotes !== "curated") {
    return [extraReport(path, [], ['not checked: policy is not "curated"'])];
  }
  const budget = curationBudget(policy);
  return [
    extraReport(
      path,
      typeof budget === "string"
        ? [budget]
        : curationProblems(notes, customer, budget)
    ),
  ];
};

const runCheck = (
  options: CliOptions,
  logs: LoadedLog[],
  notes: ParsedReleaseNotes | null,
  policy: Policy | string,
  storeNotes: CheckFileReport[] = []
): { exitCode: number; output: string } => {
  const customer = logs.find((loaded) => loaded.log === "customer")?.parsed;
  const files = [
    ...logs.map(checkFileReport),
    ...curationReports(options.repo, customer, notes, policy),
    ...storeNotes,
  ];
  const problems = files.reduce(
    (sum, report) => sum + checkProblemCount(report),
    0
  );
  const ok = problems === 0;
  if (options.json) {
    return {
      exitCode: ok ? 0 : 1,
      output: JSON.stringify({ files, ok, problems }, null, 2),
    };
  }
  const summary = ok
    ? "Structure check passed."
    : `Structure check found ${problems} problem(s).`;
  // Store notes within their limits collapse into one line.
  const shown = files.filter(
    (report) => !report.storeNote || checkProblemCount(report) > 0
  );
  const over = storeNotes.filter((report) => checkProblemCount(report) > 0);
  const storeLine =
    storeNotes.length > 0
      ? [
          `Store notes: ${storeNotes.length} checked, ${over.length} over their limit.`,
        ]
      : [];
  return {
    exitCode: ok ? 0 : 1,
    output: [...shown.map(describeCheckFile), ...storeLine, summary].join("\n"),
  };
};

// gaps: merges since a release tag whose first-parent diff adds no line to
// the selected changelogs. Read-only, plain Git. A merge counts as covered
// only when it adds lines to CHANGELOG.md or DEVELOPER_CHANGELOG.md under
// --repo, so an entry kept elsewhere is reported, never hidden, and squash
// or rebase integrations without a merge commit are counted, not checked.

const VERSION_PLACEHOLDER = "{version}";
const DEFAULT_TAG_TEMPLATE = `v${VERSION_PLACEHOLDER}`;
const TAG_VERSION_PATTERN =
  /^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u;
const NUMERIC_PATTERN = /^\d+$/u;
const RECORD_SEPARATOR = "\u001e";
const FIELD_SEPARATOR = "\u001f";

const git = (repo: string, args: string[]): string => {
  const result = spawnSync({
    cmd: ["git", "-C", repo, ...args],
    stderr: "pipe",
    stdout: "pipe",
  });
  if (!result.success) {
    throw new CliError(
      `git ${args[0]} failed in ${repo}: ${result.stderr.toString().trim()}`
    );
  }
  return result.stdout.toString();
};

// The releaseTags template that names the default tag: the single template,
// the --train entry of a map, a map's only template, or v{version} when the
// policy records none.
const tagTemplate = (policy: Policy | string, train: string | null): string => {
  if (typeof policy === "string") {
    throw new CliError(`${policy}; pass --since TAG`);
  }
  const setting = policy?.releaseTags;
  if (typeof setting === "object" && setting !== null) {
    const map = setting as Record<string, unknown>;
    const named = Object.entries(map).filter(([, value]) => value !== "none");
    const chosen = train === null ? named : [[train, map[train]] as const];
    const [only] = chosen;
    if (!only || chosen.length > 1) {
      throw new CliError(
        `releaseTags has a template per train (${Object.keys(map).join(", ")}); pass --train NAME or --since TAG`
      );
    }
    if (typeof only[1] !== "string" || only[1] === "none") {
      throw new CliError(
        `releaseTags records no tag template for ${only[0]}; pass --since TAG`
      );
    }
    return only[1];
  }
  return typeof setting === "string" && setting !== "none"
    ? setting
    : DEFAULT_TAG_TEMPLATE;
};

// SemVer precedence of two prerelease identifiers.
const compareIdentifier = (left: string, right: string): number => {
  const leftNumeric = NUMERIC_PATTERN.test(left);
  const rightNumeric = NUMERIC_PATTERN.test(right);
  if (leftNumeric && rightNumeric) {
    return Math.sign(Number(BigInt(left) - BigInt(right)));
  }
  if (leftNumeric !== rightNumeric) {
    return leftNumeric ? -1 : 1;
  }
  return left < right ? -1 : Number(left > right);
};

const comparePrerelease = (left: string, right: string): number => {
  const a = left.split(".");
  const b = right.split(".");
  for (const [index, identifier] of a.entries()) {
    const other = b[index];
    if (other === undefined) {
      return 1;
    }
    const order = compareIdentifier(identifier, other);
    if (order !== 0) {
      return order;
    }
  }
  return a.length < b.length ? -1 : 0;
};

// SemVer precedence for dotted versions of any length; build metadata is
// ignored and a prerelease ranks below its release.
const compareTagVersions = (left: string, right: string): number => {
  const [, leftCore = "", leftPre] = TAG_VERSION_PATTERN.exec(left) ?? [];
  const [, rightCore = "", rightPre] = TAG_VERSION_PATTERN.exec(right) ?? [];
  const a = leftCore.split(".");
  const b = rightCore.split(".");
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const x = BigInt(a[index] ?? 0);
    const y = BigInt(b[index] ?? 0);
    if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  if (leftPre === undefined || rightPre === undefined) {
    return Number(leftPre === undefined) - Number(rightPre === undefined);
  }
  return comparePrerelease(leftPre, rightPre);
};

// The newest tag reachable from HEAD that the template names.
const newestReleaseTag = (repo: string, template: string): string => {
  if (!template.endsWith(VERSION_PLACEHOLDER)) {
    throw new CliError(
      `releaseTags template ${template} does not end with ${VERSION_PLACEHOLDER}; pass --since TAG`
    );
  }
  const prefix = template.slice(0, -VERSION_PLACEHOLDER.length);
  const candidates = git(repo, ["tag", "--merged", "HEAD"])
    .split("\n")
    .filter(
      (name) =>
        name.startsWith(prefix) &&
        TAG_VERSION_PATTERN.test(name.slice(prefix.length))
    )
    .sort(
      (left, right) =>
        compareTagVersions(
          left.slice(prefix.length),
          right.slice(prefix.length)
        ) || (left < right ? -1 : Number(left > right))
    );
  const newest = candidates.at(-1);
  if (newest === undefined) {
    throw new CliError(
      `No tag reachable from HEAD matches ${template}; pass --since TAG`
    );
  }
  return newest;
};

interface GapCommit {
  commit: string;
  date: string;
  parents: string[];
  subject: string;
}

interface GapsReport {
  checkedMerges: number;
  gaps: GapCommit[];
  head: string;
  notes: string[];
  since: { commit: string; tag: string; template: string | null };
  uncheckedCommits: number;
}

// One record per first-parent commit: its header, then the numstat lines of
// its diff against its first parent.
const firstParentCommits = (repo: string, range: string, files: string[]) =>
  git(repo, [
    "log",
    "--first-parent",
    "--diff-merges=first-parent",
    "--no-renames",
    "--relative",
    "--numstat",
    `--format=${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%cI${FIELD_SEPARATOR}%s`,
    range,
  ])
    .split(RECORD_SEPARATOR)
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const [header = "", ...stats] = record.split("\n");
      const [commit = "", parents = "", date = "", subject = ""] =
        header.split(FIELD_SEPARATOR);
      const covered = stats.some((line) => {
        const [added, , path] = line.split("\t");
        return (
          path !== undefined &&
          files.includes(path) &&
          NUMERIC_PATTERN.test(added ?? "") &&
          Number(added) > 0
        );
      });
      return {
        commit,
        covered,
        date: date.slice(0, 10),
        parents: parents.split(" ").filter(Boolean),
        subject,
      };
    });

const gapsReport = async (options: CliOptions): Promise<GapsReport> => {
  const { repo } = options;
  git(repo, ["rev-parse", "--is-inside-work-tree"]);
  let tag = options.since;
  let template: string | null = null;
  if (tag === null) {
    template = tagTemplate(await readRepoPolicy(repo), options.train);
    tag = newestReleaseTag(repo, template);
  }
  const resolved = spawnSync({
    cmd: [
      "git",
      "-C",
      repo,
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/tags/${tag}^{commit}`,
    ],
    stdout: "pipe",
  });
  if (!resolved.success) {
    throw new CliError(`No tag named ${tag} resolves to a commit`);
  }
  const base = resolved.stdout.toString().trim();
  const head = git(repo, ["rev-parse", "HEAD"]).trim();
  const files = requestedLogs(options.log).map((log) => LOG_FILES[log]);
  const commits = firstParentCommits(repo, `${base}..${head}`, files);
  const merges = commits.filter((commit) => commit.parents.length > 1);
  const notes: string[] = [];
  const ancestor = spawnSync({
    cmd: ["git", "-C", repo, "merge-base", "--is-ancestor", base, head],
  });
  if (!ancestor.success) {
    notes.push(`${tag} is not an ancestor of HEAD; the range is ${tag}..HEAD`);
  }
  const unchecked = commits.length - merges.length;
  if (unchecked > 0) {
    notes.push(
      `not checked: ${unchecked} first-parent commits since ${tag} that are not merges (squash, rebase, or direct commits)`
    );
  }
  return {
    checkedMerges: merges.length,
    gaps: merges
      .filter((merge) => !merge.covered)
      .map(({ commit, date, parents, subject }) => ({
        commit,
        date,
        parents,
        subject,
      })),
    head,
    notes,
    since: { commit: base, tag, template },
    uncheckedCommits: unchecked,
  };
};

const runGaps = async (options: CliOptions): Promise<string> => {
  const report = await gapsReport(options);
  if (options.json) {
    return JSON.stringify(report, null, 2);
  }
  const files = requestedLogs(options.log)
    .map((log) => LOG_FILES[log])
    .join(" or ");
  const lines = [
    `Since ${report.since.tag} (${report.since.commit.slice(0, 8)}): ${report.gaps.length} of ${report.checkedMerges} merges add no lines to ${files}.`,
  ];
  if (report.gaps.length > 0) {
    lines.push(
      "",
      table(
        ["COMMIT", "DATE", "SUBJECT"],
        report.gaps.map((gap) => [
          gap.commit.slice(0, 8),
          gap.date,
          gap.subject,
        ])
      )
    );
  }
  for (const note of report.notes) {
    lines.push(`note: ${note}`);
  }
  return lines.join("\n");
};

// Store notes: public update copy in the Fastlane deliver and supply and the
// Gradle Play Publisher layouts, held to each store's per-locale limit.
// Counted in Unicode code points, the stricter reading for combining marks,
// after dropping a byte order mark and trailing line breaks. Other layouts
// are not detected, and TestFlight What to Test has no documented limit.
const STORE_NOTE_RULES = [
  {
    limit: 4000,
    pattern:
      /(?:^|\/)fastlane\/metadata\/(?!android\/)[^/]+\/release_notes\.txt$/u,
    store: "App Store What's New",
  },
  {
    limit: 500,
    pattern:
      /(?:^|\/)fastlane\/metadata\/android\/[^/]+\/changelogs\/[^/]+\.txt$/u,
    store: "Google Play release notes",
  },
  {
    limit: 500,
    pattern: /(?:^|\/)play\/release-notes\/[^/]+\/[^/]+\.txt$/u,
    store: "Google Play release notes",
  },
];
const STORE_NOTE_GLOB = "**/*.txt";
const BYTE_ORDER_MARK_PATTERN = /^\uFEFF/u;
const TRAILING_BREAKS_PATTERN = /[\r\n]+$/u;

/** A store note's length in Unicode code points, as the stores count it. */
export const storeNoteLength = (text: string): number =>
  [
    ...text
      .replace(BYTE_ORDER_MARK_PATTERN, "")
      .replace(TRAILING_BREAKS_PATTERN, ""),
  ].length;

// Paths under the repository, Git-tracked or untracked but not ignored; a
// directory outside Git falls back to a scan that skips node_modules.
const candidatePaths = async (repo: string): Promise<string[]> => {
  const listed = spawnSync({
    cmd: [
      "git",
      "-C",
      repo,
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ],
    stderr: "pipe",
    stdout: "pipe",
  });
  if (listed.success) {
    return listed.stdout.toString().split("\0").filter(Boolean);
  }
  const scanned: string[] = [];
  for await (const path of new Glob(STORE_NOTE_GLOB).scan({ cwd: repo })) {
    if (!path.split("/").includes("node_modules")) {
      scanned.push(path);
    }
  }
  return scanned;
};

const storeNoteReports = async (repo: string): Promise<CheckFileReport[]> => {
  const notes = (await candidatePaths(repo))
    .flatMap((path) => {
      const rule = STORE_NOTE_RULES.find(({ pattern }) => pattern.test(path));
      return rule ? [{ path, rule }] : [];
    })
    .sort((left, right) => (left.path < right.path ? -1 : 1));
  const reports = await Promise.all(
    notes.map(async ({ path, rule: { limit, store } }) => {
      const absolute = join(repo, path);
      if (!existsSync(absolute)) {
        return [];
      }
      const characters = storeNoteLength(await readFile(absolute, "utf8"));
      return [
        {
          ...extraReport(
            absolute,
            characters > limit
              ? [
                  `${store} allows ${limit} characters per locale; this note has ${characters}`,
                ]
              : []
          ),
          storeNote: { characters, limit, store },
        },
      ];
    })
  );
  return reports.flat();
};

const run = async (argv: string[]): Promise<number> => {
  if (["help", "--help", "-h"].includes(argv[0] ?? "")) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const options = parseCli(argv);
  if (options.command === "gaps") {
    process.stdout.write(`${await runGaps(options)}\n`);
    return 0;
  }
  const logs = await loadLogs(options);
  switch (options.command) {
    case "releases": {
      process.stdout.write(`${runReleases(options, logs)}\n`);
      return 0;
    }
    case "show": {
      const notes = options.omitted
        ? await loadReleaseNotes(options.repo)
        : null;
      process.stdout.write(`${runShow(options, logs, notes)}\n`);
      return 0;
    }
    case "entries": {
      process.stdout.write(`${runEntries(options, logs)}\n`);
      return 0;
    }
    case "check": {
      const [notes, policy, storeNotes] = await Promise.all([
        loadReleaseNotes(options.repo),
        readRepoPolicy(options.repo),
        storeNoteReports(options.repo),
      ]);
      const { exitCode, output } = runCheck(
        options,
        logs,
        notes,
        policy,
        storeNotes
      );
      process.stdout.write(`${output}\n`);
      return exitCode;
    }
    default: {
      throw new CliError(`Unknown command: ${options.command}\n\n${USAGE}`);
    }
  }
};

if (import.meta.main) {
  try {
    process.exitCode = await run(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CliError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}

export { parseCli, run };
