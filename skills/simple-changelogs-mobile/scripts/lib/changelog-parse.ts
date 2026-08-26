// Deterministic, read-only Markdown changelog parser shared by the query CLI.
// Derived from the maintainer curation parser: release headings with optional
// version/date, fence and HTML-comment awareness, occurrence disambiguation,
// and diagnostics instead of guessed structure.

import { createHash } from "node:crypto";

export interface ChangelogSignature {
  agent: string;
  // ISO 8601 for canonical signatures; the raw legacy timestamp otherwise.
  at: string;
  legacy: boolean;
}

export interface ChangelogEntry {
  group: string | null;
  // First 12 hex characters of sha256 over the entry's normalized text:
  // signature comments stripped, per-line trailing whitespace removed,
  // outer whitespace trimmed (the maintainer curation parser's normalization).
  id: string;
  section: string | null;
  signature: ChangelogSignature | null;
  text: string;
  title: string;
}

export interface ChangelogRelease {
  date: string | null;
  entries: ChangelogEntry[];
  heading: string;
  occurrence: number;
  unreleased: boolean;
  version: string | null;
}

export interface ParsedChangelog {
  diagnostics: string[];
  legacySignatureCount: number;
  malformedSignatures: string[];
  releases: ChangelogRelease[];
  sourcePath: string;
  unrecognizedHeadings: string[];
}

const FENCE_LINE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
const HEADING_PATTERN = /^(#{1,6})\s+(.*?)\s*$/;
const BULLET_PATTERN = /^(\s*)([-*+])\s+(.*)$/;
const GROUP_BULLET_PATTERN = /^\s*[-*+]\s+\*\*([^*]+?)\*\*:/;
const VERSION_PATTERN =
  /\[?v?(\d+\.\d+(?:\.\d+)?(?:[a-zA-Z]+\d*)?(?:[.-][0-9A-Za-z]+)*(?:\+[0-9A-Za-z.]+)?)\]?/;
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const UNRELEASED_PATTERN = /^\[?unreleased\]?$/i;
const TRAILING_WHITESPACE_PATTERN = /[ \t]+$/;
const TRAILING_BLANK_LINES_PATTERN = /\s+$/;
const LINE_SPLIT_PATTERN = /\r\n|\r|\n/;
const HTML_COMMENT_OPEN = "<!--";
const HTML_COMMENT_CLOSE = "-->";
const CANONICAL_SIGNATURE_LINE_PATTERN =
  /^\s*<!--\s*simple-changelogs-signature\s+agent="([^"]*)"\s+at="([^"]*)"\s*-->\s*$/;
const LEGACY_SIGNATURE_LINE_PATTERN =
  /^\s*<!--\s*Agent:\s*(.+?)\s*\|\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s*[AP]M(?:\s+[A-Za-z]{2,5})?)\s*-->\s*$/;
const SIGNATURE_LIKE_LINE_PATTERN =
  /^\s*<!--(?:(?=[\s\S]*simple-changelogs-signature)|\s*Agent:)[\s\S]*-->\s*$/;
const ANY_SIGNATURE_COMMENT_PATTERN =
  /<!--\s*(?:simple-changelogs-signature[\s\S]*?|Agent:[\s\S]*?)-->/g;
const ISO_DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})/;
const LEGACY_DATE_PREFIX_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})/;
const BULLET_MARKER_PATTERN = /^\s*[-*+]\s+/;

type LineKind =
  | { kind: "inert"; indent: number; raw: string }
  | { kind: "malformed-signature"; raw: string }
  | { indent: number; kind: "signature"; signature: ChangelogSignature }
  | { kind: "structural"; indent: number; raw: string };

const indentWidth = (raw: string): number => {
  let width = 0;
  for (const char of raw) {
    if (char === "\t") {
      width += 4;
    } else if (char === " ") {
      width += 1;
    } else {
      break;
    }
  }
  return width;
};

const parseSignatureLine = (raw: string): LineKind | null => {
  const indent = indentWidth(raw);
  const canonical = raw.match(CANONICAL_SIGNATURE_LINE_PATTERN);
  if (canonical) {
    return {
      indent,
      kind: "signature",
      signature: {
        agent: canonical[1] ?? "",
        at: canonical[2] ?? "",
        legacy: false,
      },
    };
  }
  const legacy = raw.match(LEGACY_SIGNATURE_LINE_PATTERN);
  if (legacy) {
    return {
      indent,
      kind: "signature",
      signature: {
        agent: legacy[1] ?? "",
        at: legacy[2] ?? "",
        legacy: true,
      },
    };
  }
  if (SIGNATURE_LIKE_LINE_PATTERN.test(raw)) {
    return { kind: "malformed-signature", raw: raw.trim() };
  }
  return null;
};

/**
 * Marks each line as structural (outside fenced code and HTML comments) and
 * recognizes standalone signature comment lines, which never open a
 * multi-line comment region.
 */
const classifyLines = (rawLines: string[]): LineKind[] => {
  const lines: LineKind[] = [];
  let inFence = false;
  let inComment = false;

  for (const raw of rawLines) {
    const indent = indentWidth(raw);

    if (inComment) {
      if (raw.includes(HTML_COMMENT_CLOSE)) {
        inComment = false;
      }
      lines.push({ indent, kind: "inert", raw });
      continue;
    }

    if (inFence) {
      if (FENCE_LINE_PATTERN.test(raw)) {
        inFence = false;
      }
      lines.push({ indent, kind: "inert", raw });
      continue;
    }

    if (FENCE_LINE_PATTERN.test(raw)) {
      inFence = true;
      lines.push({ indent, kind: "inert", raw });
      continue;
    }

    const signatureLine = parseSignatureLine(raw);
    if (signatureLine) {
      lines.push(signatureLine);
      continue;
    }

    const commentOpenIndex = raw.indexOf(HTML_COMMENT_OPEN);
    if (commentOpenIndex !== -1) {
      const closeIndex = raw.indexOf(
        HTML_COMMENT_CLOSE,
        commentOpenIndex + HTML_COMMENT_OPEN.length
      );
      if (closeIndex === -1) {
        inComment = true;
      }
      lines.push({ indent, kind: "inert", raw });
      continue;
    }

    lines.push({ indent, kind: "structural", raw });
  }

  return lines;
};

const parseVersionAndDate = (
  headingText: string
): { date: string | null; version: string | null } => {
  const dateMatch = headingText.match(DATE_PATTERN);
  const versionMatch = headingText.match(VERSION_PATTERN);
  return {
    date: dateMatch ? dateMatch[0] : null,
    version: versionMatch ? (versionMatch[1] ?? null) : null,
  };
};

interface HeadingLine {
  depth: number;
  text: string;
}

const parseHeading = (raw: string): HeadingLine | null => {
  const match = raw.match(HEADING_PATTERN);
  if (!match) {
    return null;
  }
  return { depth: (match[1] ?? "").length, text: match[2] ?? "" };
};

interface ParserState {
  currentRelease: ChangelogRelease | null;
  currentSection: string | null;
  diagnostics: string[];
  legacySignatureCount: number;
  malformedSignatures: string[];
  pendingIndent: number;
  pendingInteriorSignature: ChangelogSignature | null;
  pendingLines: string[] | null;
  releaseOccurrences: Map<string, number>;
  releases: ChangelogRelease[];
  sectionDepth: number;
  unattributed: ChangelogEntry[];
  unrecognizedHeadings: string[];
}

const entryTitle = (firstLine: string): string =>
  firstLine.replace(BULLET_MARKER_PATTERN, "").trim();

/**
 * Identity of one entry: the first 12 hex characters of sha256 over the
 * entry's normalized text (signature comments already stripped, per-line
 * trailing whitespace removed, outer whitespace trimmed). Curation
 * provenance comments in RELEASE_NOTES.md reference entries by this id.
 */
export function entryIdentity(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 12);
}

const flushPendingItem = (state: ParserState): void => {
  const { pendingLines } = state;
  if (pendingLines === null || pendingLines.length === 0) {
    state.pendingLines = null;
    state.pendingIndent = -1;
    return;
  }
  const text = pendingLines
    .join("\n")
    .replace(ANY_SIGNATURE_COMMENT_PATTERN, "")
    .replace(TRAILING_BLANK_LINES_PATTERN, "")
    .split("\n")
    .map((line) => line.replace(TRAILING_WHITESPACE_PATTERN, ""))
    .join("\n");
  const groupMatch = text.match(GROUP_BULLET_PATTERN);
  const entry: ChangelogEntry = {
    group: groupMatch ? (groupMatch[1] ?? "").trim() : null,
    id: entryIdentity(text),
    section: state.currentSection,
    signature: state.pendingInteriorSignature,
    text,
    title: entryTitle(text.split("\n")[0] ?? ""),
  };
  if (state.currentRelease !== null) {
    state.currentRelease.entries.push(entry);
  }
  if (entry.signature === null) {
    state.unattributed.push(entry);
  }
  state.pendingInteriorSignature = null;
  state.pendingLines = null;
  state.pendingIndent = -1;
};

const handleReleaseHeading = (
  state: ParserState,
  heading: HeadingLine
): void => {
  const parsed = parseVersionAndDate(heading.text);
  const unreleased = UNRELEASED_PATTERN.test(heading.text.trim());
  const occurrence = (state.releaseOccurrences.get(heading.text) ?? 0) + 1;
  state.releaseOccurrences.set(heading.text, occurrence);
  if (!(unreleased || parsed.version || parsed.date)) {
    state.unrecognizedHeadings.push(heading.text);
  }
  const release: ChangelogRelease = {
    date: parsed.date,
    entries: [],
    heading: heading.text,
    occurrence,
    unreleased,
    version: unreleased ? null : parsed.version,
  };
  state.currentRelease = release;
  state.releases.push(release);
  state.currentSection = null;
  state.sectionDepth = 0;
  state.unattributed = [];
};

const handleHeadingLine = (state: ParserState, heading: HeadingLine): void => {
  flushPendingItem(state);
  state.unattributed = [];

  if (heading.depth === 1) {
    state.currentRelease = null;
    state.currentSection = null;
    state.sectionDepth = 0;
    return;
  }

  if (heading.depth === 2) {
    handleReleaseHeading(state, heading);
    return;
  }

  if (!state.currentRelease) {
    state.diagnostics.push(
      `Section heading "${heading.text}" found before any release heading; skipped.`
    );
    return;
  }
  state.currentSection = heading.text;
  state.sectionDepth = heading.depth;
};

const handleBulletLine = (
  state: ParserState,
  indent: number,
  raw: string
): void => {
  const isNewSibling =
    state.pendingLines === null || indent <= state.pendingIndent;

  if (!isNewSibling) {
    // More indented than the active top-level bullet: a nested child.
    (state.pendingLines as string[]).push(raw);
    return;
  }

  if (!state.currentRelease) {
    state.diagnostics.push(
      `Bullet found before any release heading: "${raw.trim()}"; skipped.`
    );
    return;
  }
  if (state.pendingLines === null && indent > 0) {
    state.diagnostics.push(
      `Nested bullet with no preceding top-level bullet: "${raw.trim()}"; skipped.`
    );
    return;
  }
  flushPendingItem(state);
  state.pendingLines = [raw];
  state.pendingIndent = indent;
};

const handleSignatureLine = (
  state: ParserState,
  signature: ChangelogSignature,
  indent: number
): void => {
  if (signature.legacy) {
    state.legacySignatureCount += 1;
  }
  // A signature indented inside an open entry signs nested children without
  // splitting the entry; the entry keeps the first such signature.
  if (state.pendingLines !== null && indent > state.pendingIndent) {
    state.pendingInteriorSignature ??= signature;
    return;
  }
  flushPendingItem(state);
  // A signature attributes the contiguous block of entries above it. Entries
  // already attributed by an earlier signature in the same block keep it.
  for (const entry of state.unattributed) {
    entry.signature = signature;
  }
  state.unattributed = [];
};

const handleInertLine = (
  state: ParserState,
  indent: number,
  raw: string
): void => {
  // Content inside fences/comments is inert unless it belongs to an
  // already-open atomic entry (an indented continuation of a bullet).
  if (
    state.pendingLines !== null &&
    raw.trim().length > 0 &&
    indent > state.pendingIndent
  ) {
    state.pendingLines.push(raw);
  }
};

const handleStructuralContentLine = (
  state: ParserState,
  indent: number,
  raw: string
): void => {
  if (raw.trim().length === 0) {
    return;
  }
  if (state.pendingLines !== null && indent > state.pendingIndent) {
    state.pendingLines.push(raw);
  }
  // Otherwise: stray prose outside any bullet is not an entry; ignored.
};

export function parseChangelog(
  markdown: string,
  sourcePath: string
): ParsedChangelog {
  const lines = classifyLines(markdown.split(LINE_SPLIT_PATTERN));

  const state: ParserState = {
    currentRelease: null,
    currentSection: null,
    diagnostics: [],
    legacySignatureCount: 0,
    malformedSignatures: [],
    pendingIndent: -1,
    pendingInteriorSignature: null,
    pendingLines: null,
    releaseOccurrences: new Map(),
    releases: [],
    sectionDepth: 0,
    unattributed: [],
    unrecognizedHeadings: [],
  };

  for (const line of lines) {
    if (line.kind === "signature") {
      handleSignatureLine(state, line.signature, line.indent);
      continue;
    }
    if (line.kind === "malformed-signature") {
      state.malformedSignatures.push(line.raw);
      continue;
    }
    if (line.kind === "inert") {
      handleInertLine(state, line.indent, line.raw);
      continue;
    }

    const heading = parseHeading(line.raw);
    if (heading) {
      handleHeadingLine(state, heading);
      continue;
    }

    if (BULLET_PATTERN.test(line.raw)) {
      handleBulletLine(state, line.indent, line.raw);
      continue;
    }

    handleStructuralContentLine(state, line.indent, line.raw);
  }

  flushPendingItem(state);

  return {
    diagnostics: state.diagnostics,
    legacySignatureCount: state.legacySignatureCount,
    malformedSignatures: state.malformedSignatures,
    releases: state.releases,
    sourcePath,
    unrecognizedHeadings: state.unrecognizedHeadings,
  };
}

// --- Curated release notes (RELEASE_NOTES.md) -------------------------------

export interface CurationRecord {
  highlighted: string[];
  omitted: string[];
  release: string;
  rolledUp: string[];
  source: string;
}

export interface ReleaseNotesSection {
  curation: CurationRecord | null;
  date: string | null;
  heading: string;
  highlights: string[];
  occurrence: number;
  unreleased: boolean;
  version: string | null;
}

export interface ParsedReleaseNotes {
  diagnostics: string[];
  sections: ReleaseNotesSection[];
  sourcePath: string;
}

const CURATION_COMMENT_PREFIX_PATTERN =
  /^\s*<!--\s*simple-changelogs-curation\b/;
const CURATION_COMMENT_PATTERN =
  /^\s*<!--\s*simple-changelogs-curation\s+source="([^"]*)"\s+release="([^"]*)"\s+highlighted="([^"]*)"\s+rolled-up="([^"]*)"\s+omitted="([^"]*)"\s*-->\s*$/;
const ENTRY_ID_PATTERN = /^[0-9a-f]{12}$/;

const parseIdList = (
  raw: string,
  attribute: string,
  diagnostics: string[]
): string[] => {
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  for (const id of ids) {
    if (!ENTRY_ID_PATTERN.test(id)) {
      diagnostics.push(
        `Curation comment ${attribute} id "${id}" is not a 12-hex entry identity.`
      );
    }
  }
  return ids;
};

const parseCurationComment = (
  raw: string,
  diagnostics: string[]
): CurationRecord | null => {
  const match = raw.match(CURATION_COMMENT_PATTERN);
  if (!match) {
    diagnostics.push(
      `Malformed curation comment (expected source/release/highlighted/rolled-up/omitted attributes): ${raw.trim()}`
    );
    return null;
  }
  return {
    highlighted: parseIdList(match[3] ?? "", "highlighted", diagnostics),
    omitted: parseIdList(match[5] ?? "", "omitted", diagnostics),
    release: match[2] ?? "",
    rolledUp: parseIdList(match[4] ?? "", "rolled-up", diagnostics),
    source: match[1] ?? "",
  };
};

/**
 * Parses RELEASE_NOTES.md: the changelog's release-heading grammar, highlight
 * bullets (top-level only; the rollup line is ordinary prose and ignored),
 * and one curation provenance comment per section. Malformed curation
 * comments become diagnostics, never guessed structure.
 */
interface ReleaseNotesState {
  current: ReleaseNotesSection | null;
  diagnostics: string[];
  occurrences: Map<string, number>;
  sections: ReleaseNotesSection[];
}

const handleReleaseNotesCurationLine = (
  state: ReleaseNotesState,
  raw: string
): void => {
  const record = parseCurationComment(raw, state.diagnostics);
  if (record === null) {
    return;
  }
  if (state.current === null) {
    state.diagnostics.push(
      "Curation comment found before any release heading; skipped."
    );
  } else if (state.current.curation === null) {
    state.current.curation = record;
  } else {
    state.diagnostics.push(
      `Release section "${state.current.heading}" carries more than one curation comment.`
    );
  }
};

const handleReleaseNotesHeading = (
  state: ReleaseNotesState,
  heading: HeadingLine
): void => {
  if (heading.depth !== 2) {
    return;
  }
  const parsed = parseVersionAndDate(heading.text);
  const unreleased = UNRELEASED_PATTERN.test(heading.text.trim());
  const occurrence = (state.occurrences.get(heading.text) ?? 0) + 1;
  state.occurrences.set(heading.text, occurrence);
  state.current = {
    curation: null,
    date: parsed.date,
    heading: heading.text,
    highlights: [],
    occurrence,
    unreleased,
    version: unreleased ? null : parsed.version,
  };
  state.sections.push(state.current);
};

export function parseReleaseNotes(
  markdown: string,
  sourcePath: string
): ParsedReleaseNotes {
  const state: ReleaseNotesState = {
    current: null,
    diagnostics: [],
    occurrences: new Map(),
    sections: [],
  };
  let inFence = false;

  for (const raw of markdown.split(LINE_SPLIT_PATTERN)) {
    if (inFence) {
      if (FENCE_LINE_PATTERN.test(raw)) {
        inFence = false;
      }
      continue;
    }
    if (FENCE_LINE_PATTERN.test(raw)) {
      inFence = true;
      continue;
    }

    if (CURATION_COMMENT_PREFIX_PATTERN.test(raw)) {
      handleReleaseNotesCurationLine(state, raw);
      continue;
    }

    const heading = parseHeading(raw);
    if (heading) {
      handleReleaseNotesHeading(state, heading);
      continue;
    }

    const bullet = raw.match(BULLET_PATTERN);
    if (bullet && state.current !== null && (bullet[1] ?? "").length === 0) {
      state.current.highlights.push(entryTitle(raw));
    }
  }

  return {
    diagnostics: state.diagnostics,
    sections: state.sections,
    sourcePath,
  };
}

/**
 * Returns the YYYY-MM-DD day of a signature timestamp, or null when the
 * recorded value carries no recognizable date. Legacy MM/DD/YYYY timestamps
 * are converted without inventing a timezone.
 */
export function signatureDate(signature: ChangelogSignature): string | null {
  const iso = signature.at.match(ISO_DATE_PREFIX_PATTERN);
  if (iso) {
    return iso[1] ?? null;
  }
  const legacy = signature.at.match(LEGACY_DATE_PREFIX_PATTERN);
  if (legacy) {
    return `${legacy[3]}-${legacy[1]}-${legacy[2]}`;
  }
  return null;
}
