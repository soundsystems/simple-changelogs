#!/usr/bin/env bun

// Read-only query CLI over the raw Markdown changelogs. The Markdown files
// remain the source of truth: this tool never writes, caches, or indexes.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  type ChangelogEntry,
  type ChangelogRelease,
  type ParsedChangelog,
  type ParsedReleaseNotes,
  parseChangelog,
  parseReleaseNotes,
  signatureDate,
} from "./lib/changelog-parse.ts";

const USAGE = `Usage: query.ts <command> [options]

Commands:
  releases                     List release sections with entry counts.
  show <version|date|unreleased>
                               Show every entry of one release section.
  entries                      List entries, optionally filtered.
  check                        Lint changelog structure; nonzero on problems.
                               When RELEASE_NOTES.md exists, also verifies
                               curation coverage against the changelog.

Options:
  --log customer|developer|both   Which changelog to read (default: both).
  --repo PATH                     Repository root (default: current directory).
  --json                          Structured JSON output.
  --since YYYY-MM-DD              entries: keep entries on or after this day.
  --until YYYY-MM-DD              entries: keep entries on or before this day.
  --group NAME                    entries: keep "- **NAME**:" grouped bullets.
  --agent SUBSTRING               entries: filter by signature agent.
  --grep REGEX                    entries: filter by entry text.
  --ids                           entries: include each entry's 12-hex id.
  --omitted                       show: list the entries a curated
                                  RELEASE_NOTES.md section records as
                                  omitted or rolled up.

Dates use the release date, falling back to the entry's signature timestamp
for Unreleased entries. Reads CHANGELOG.md (customer) and
DEVELOPER_CHANGELOG.md (developer) at the repository root.`;

const LOG_CHOICES = ["customer", "developer", "both"] as const;
type LogChoice = (typeof LOG_CHOICES)[number];
type LogName = "customer" | "developer";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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
  return options;
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
    case "--since":
    case "--until": {
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

const readRepoPolicy = async (
  repo: string
): Promise<Record<string, unknown> | null> => {
  const policyPath = join(repo, ".simple-changelogs.json");
  if (!existsSync(policyPath)) {
    return null;
  }
  try {
    return JSON.parse(await readFile(policyPath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
};

const loadLogs = async (options: CliOptions): Promise<LoadedLog[]> => {
  const names = requestedLogs(options.log);
  const explicit = options.log !== "both";
  const policy = await readRepoPolicy(options.repo);
  const missingIsError = (log: LogName): boolean =>
    (explicit && log === "developer") ||
    log === "customer" ||
    policy?.developerChangelog === "required";
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
  return matchesVersionSelector(release.version, selector);
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
  if (match.log !== "customer") {
    throw new CliError(
      "--omitted applies to the customer changelog; narrow with --log customer."
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

const curationBudgetFromPolicy = (
  policy: Record<string, unknown> | null
): CurationBudgetValues => {
  const budget = policy?.curationBudget as
    | { max?: unknown; min?: unknown }
    | undefined;
  return {
    max: typeof budget?.max === "number" ? budget.max : 8,
    min: typeof budget?.min === "number" ? budget.min : 3,
  };
};

// Patch releases (nonzero third version component) may curate any number of
// highlights, down to zero; date-only headings are exempt from the minimum.
const isPatchVersion = (version: string | null): boolean => {
  if (version === null) {
    return false;
  }
  const patch = Number.parseInt(version.split(".")[2] ?? "", 10);
  return Number.isFinite(patch) && patch > 0;
};

const NON_FILTERABLE_NAMES = ["Breaking", "Security"];

const isNonFilterable = (entry: ChangelogEntry): boolean =>
  NON_FILTERABLE_NAMES.some(
    (name) =>
      entry.title.startsWith(`**${name}**`) ||
      entry.group === name ||
      entry.section === name
  );

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
  curation: {
    highlighted: string[];
    omitted: string[];
    rolledUp: string[];
  }
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

const curationProblems = (
  notes: ParsedReleaseNotes,
  customer: ParsedChangelog,
  budget: CurationBudgetValues
): string[] => {
  const problems: string[] = [...notes.diagnostics];
  for (const section of notes.sections) {
    const label = `curated section "${section.heading}"`;
    if (section.unreleased) {
      problems.push(`${label}: Unreleased is never curated`);
      continue;
    }
    if (section.curation === null) {
      problems.push(`${label}: missing curation provenance comment`);
      continue;
    }
    const { curation } = section;
    const releases = customer.releases.filter(
      (candidate) => candidate.heading === curation.release
    );
    if (releases.length === 0) {
      problems.push(
        `${label}: release "${curation.release}" not found in ${customer.sourcePath}`
      );
      continue;
    }
    if (releases.length > 1) {
      problems.push(
        `${label}: release "${curation.release}" is ambiguous in ${customer.sourcePath}`
      );
      continue;
    }
    const release = releases[0] as ChangelogRelease;
    if (release.unreleased) {
      problems.push(`${label}: Unreleased is never curated`);
      continue;
    }
    for (const problem of accountingProblems(release, curation)) {
      problems.push(`${label}: ${problem}`);
    }
    const highlightCount = curation.highlighted.length;
    if (highlightCount > budget.max) {
      problems.push(
        `${label}: ${highlightCount} highlights exceed the budget maximum of ${budget.max}`
      );
    }
    const minExempt =
      isPatchVersion(release.version) || release.version === null;
    if (!minExempt && highlightCount < budget.min) {
      problems.push(
        `${label}: ${highlightCount} highlights fall below the budget minimum of ${budget.min}`
      );
    }
  }
  return problems;
};

interface CheckFileReport {
  diagnostics: string[];
  legacySignatures: number;
  malformedSignatures: string[];
  path: string;
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
  if (checkProblemCount(report) === 0) {
    lines.push("  ok");
  }
  return lines.join("\n");
};

const runCheck = (
  options: CliOptions,
  logs: LoadedLog[],
  notes: ParsedReleaseNotes | null,
  policy: Record<string, unknown> | null
): { exitCode: number; output: string } => {
  const files = logs.map(checkFileReport);
  const customer = logs.find((loaded) => loaded.log === "customer");
  if (notes !== null && customer !== undefined) {
    files.push({
      diagnostics: curationProblems(
        notes,
        customer.parsed,
        curationBudgetFromPolicy(policy)
      ),
      legacySignatures: 0,
      malformedSignatures: [],
      path: join(options.repo, RELEASE_NOTES_FILE),
      unrecognizedHeadings: [],
    });
  }
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
  return {
    exitCode: ok ? 0 : 1,
    output: `${files.map(describeCheckFile).join("\n")}\n${summary}`,
  };
};

const run = async (argv: string[]): Promise<number> => {
  const options = parseCli(argv);
  if (options.command === "help" || options.command === "--help") {
    process.stdout.write(`${USAGE}\n`);
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
      const [notes, policy] = await Promise.all([
        loadReleaseNotes(options.repo),
        readRepoPolicy(options.repo),
      ]);
      const { exitCode, output } = runCheck(options, logs, notes, policy);
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
