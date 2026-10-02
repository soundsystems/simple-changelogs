// Deterministic, read-only Markdown changelog parser for the query CLI:
// diagnostics instead of guessed structure.

import { createHash } from "node:crypto";

export interface ChangelogSignature {
  agent: string;
  // ISO 8601 for canonical signatures; the raw legacy timestamp otherwise.
  at: string;
  legacy: boolean;
}

export interface ChangelogEntry {
  group: string | null;
  // First 12 hex characters of sha256 over the entry's raw text: signature
  // comments outside code stripped, per-line trailing whitespace removed,
  // outer whitespace trimmed.
  id: string;
  section: string | null;
  // Enclosing ### (and deeper) headings, outermost first.
  sections: string[];
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

export interface MarkdownLine {
  indent: number;
  kind: "code" | "comment" | "text";
  raw: string;
  // `raw` without closed inline HTML comments; code spans stay verbatim.
  text: string;
}

const FENCE_OPEN_PATTERN = /^\s*(?:(`{3,})[^`]*|(~{3,}).*)$/;
const FENCE_CLOSE_PATTERN = /^\s*(`{3,}|~{3,})\s*$/;
const COMMENT_START_PATTERN = /^\s*<!--/;
// Lines that start a new block, ending an inline comment's paragraph.
const BLOCK_BREAK_PATTERN =
  /^\s*(?:$|#{1,6}\s|[-*+]\s|\d+[.)]\s|`{3}|~{3}|<!--)/;
const INLINE_PATTERN = /(?<!`)(`+)(?!`).*?(?<!`)\1(?!`)|<!--.*?-->|<!--/g;
const SIGNATURE_COMMENT_PATTERN =
  /^<!--\s*(?:simple-changelogs-signature|Agent:)/;
const HEADING_PATTERN = /^(#{1,6})\s+(.*?)\s*$/;
const BULLET_PATTERN = /^(\s*)([-*+])\s+(.*)$/;
const ORDERED_ITEM_PATTERN = /^\s*\d+[.)]\s/;
const GROUP_BULLET_PATTERN = /^\s*[-*+]\s+\*\*([^*]+?)\*\*:/;
const VERSION_PATTERN =
  /\[?v?(\d+\.\d+(?:\.\d+)?(?:[a-zA-Z]+\d*)?(?:[.-][0-9A-Za-z]+)*(?:\+[0-9A-Za-z.]+)?)\]?/;
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const UNRELEASED_PATTERN = /^\[?unreleased\]?$/i;
const UNRELEASED_PREFIX_PATTERN = /^\[?unreleased\b/i;
const SEPARATORS_PATTERN = /^[\s\-–—:|(]*$/;
const TRAILING_WHITESPACE_PATTERN = /[ \t]+$/;
const TRAILING_BLANK_LINES_PATTERN = /\s+$/;
const LINE_SPLIT_PATTERN = /\r\n|\r|\n/;
const CANONICAL_SIGNATURE_LINE_PATTERN =
  /^\s*<!--\s*simple-changelogs-signature\s+agent="([^"]*)"\s+at="([^"]*)"\s*-->\s*$/;
const LEGACY_SIGNATURE_LINE_PATTERN =
  /^\s*<!--\s*Agent:\s*(.+?)\s*\|\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s*[AP]M(?:\s+[A-Za-z]{2,5})?)\s*-->\s*$/;
const SIGNATURE_LIKE_LINE_PATTERN =
  /^\s*<!--(?:(?=.*simple-changelogs-signature)|\s*Agent:)/;
const ISO_DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})/;
const LEGACY_DATE_PREFIX_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})/;
const BULLET_MARKER_PATTERN = /^\s*[-*+]\s+/;

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

// Drops closed inline comments outside code spans; `open` is the offset in
// `text` of an unclosed "<!--", or -1.
const scanInline = (raw: string): { open: number; text: string } => {
  let text = "";
  let last = 0;
  for (const match of raw.matchAll(INLINE_PATTERN)) {
    if (match[1] !== undefined) {
      continue;
    }
    text += raw.slice(last, match.index);
    if (match[0] === "<!--") {
      return { open: text.length, text: text + raw.slice(match.index) };
    }
    last = match.index + match[0].length;
  }
  return { open: -1, text: text + raw.slice(last) };
};

const isFenceClose = (raw: string, marker: string): boolean => {
  const close = raw.match(FENCE_CLOSE_PATTERN)?.[1];
  return close?.[0] === marker[0] && (close?.length ?? 0) >= marker.length;
};

// Line closing a comment opened before `from`, or -1 when another comment
// opens first, the file ends, or (inline) the paragraph ends.
const commentEnd = (lines: MarkdownLine[], from: number, inline: boolean) => {
  for (let index = from; index < lines.length; index += 1) {
    const { raw } = lines[index] as MarkdownLine;
    const close = raw.indexOf("-->");
    const nested = raw.indexOf("<!--");
    if (
      (inline && BLOCK_BREAK_PATTERN.test(raw)) ||
      (nested !== -1 && (close === -1 || nested < close))
    ) {
      return -1;
    }
    if (close !== -1) {
      return index;
    }
  }
  return -1;
};

// Classifies the fence, comment, or text block starting at `index` and
// returns the index of its last line.
const classifyBlock = (
  lines: MarkdownLine[],
  index: number,
  diagnostics: string[]
): number => {
  const line = lines[index] as MarkdownLine;
  const fence = line.raw.match(FENCE_OPEN_PATTERN);
  const { open, text } = scanInline(line.raw);
  let end = index;
  let start = index;
  if (fence) {
    const marker = fence[1] ?? fence[2] ?? "";
    end = lines.findIndex(
      (other, position) => position > index && isFenceClose(other.raw, marker)
    );
  } else if (COMMENT_START_PATTERN.test(line.raw)) {
    if (!line.raw.includes("-->", line.raw.indexOf("<!--") + 4)) {
      end = commentEnd(lines, index + 1, false);
    }
  } else {
    start = index + 1;
    end = open === -1 ? index : commentEnd(lines, index + 1, true);
    line.text = end > index ? text.slice(0, open) : text;
  }
  if (end === -1) {
    diagnostics.push(
      `Unclosed ${fence ? "code fence" : "HTML comment"} at line ${index + 1} ("${line.raw.trim()}"); later lines read as Markdown.`
    );
  }
  for (const other of lines.slice(start, Math.max(end, index) + 1)) {
    other.kind = fence ? "code" : "comment";
  }
  return Math.max(end, index);
};

/**
 * Classifies lines as fenced code (any indentation), HTML comment, or text.
 * Inline comments never hide their line, code spans never open comments, and
 * an unclosed fence or comment is a diagnostic, never swallowed content. Only
 * a comment block's first line can start with "<!--".
 */
export function classifyMarkdown(markdown: string): {
  diagnostics: string[];
  lines: MarkdownLine[];
} {
  const diagnostics: string[] = [];
  const lines = markdown.split(LINE_SPLIT_PATTERN).map(
    (raw): MarkdownLine => ({
      indent: indentWidth(raw),
      kind: "text",
      raw,
      text: raw,
    })
  );
  for (let index = 0; index < lines.length; index += 1) {
    index = classifyBlock(lines, index, diagnostics);
  }
  return { diagnostics, lines };
}

const parseSignatureLine = (
  raw: string
): ChangelogSignature | "malformed" | null => {
  const canonical = raw.match(CANONICAL_SIGNATURE_LINE_PATTERN);
  if (canonical) {
    return { agent: canonical[1] ?? "", at: canonical[2] ?? "", legacy: false };
  }
  const legacy = raw.match(LEGACY_SIGNATURE_LINE_PATTERN);
  if (legacy) {
    return { agent: legacy[1] ?? "", at: legacy[2] ?? "", legacy: true };
  }
  return SIGNATURE_LIKE_LINE_PATTERN.test(raw) ? "malformed" : null;
};

/**
 * Reads version, date, and Unreleased from a release heading. A heading that
 * would need a guess (words beside Unreleased, or a version-like token after
 * the date and prose, as in "2026-08-25 - hotfix for 3.2") is a diagnostic.
 */
export function releaseHeadingFields(
  text: string,
  diagnostics: string[] = []
): { date: string | null; unreleased: boolean; version: string | null } {
  const unreleased = UNRELEASED_PREFIX_PATTERN.test(text);
  const date = DATE_PATTERN.exec(text);
  const version = VERSION_PATTERN.exec(text);
  const late =
    date !== null &&
    version !== null &&
    !SEPARATORS_PATTERN.test(text.slice(date.index + 10, version.index));
  if (unreleased ? !UNRELEASED_PATTERN.test(text) : late) {
    diagnostics.push(
      `Ambiguous release heading "${text}"; read as ${unreleased ? "Unreleased" : "date-only"}. Use "Unreleased" or "<version> - <date>".`
    );
  }
  return {
    date: date?.[0] ?? null,
    unreleased,
    version: unreleased || late ? null : (version?.[1] ?? null),
  };
}

interface HeadingLine {
  depth: number;
  text: string;
}

const parseHeading = (text: string): HeadingLine | null => {
  const match = text.match(HEADING_PATTERN);
  if (!match) {
    return null;
  }
  return { depth: (match[1] ?? "").length, text: match[2] ?? "" };
};

interface ParserState {
  currentRelease: ChangelogRelease | null;
  diagnostics: string[];
  // The previous line was entry text, so unindented prose would be lazy.
  lazy: boolean;
  legacySignatureCount: number;
  malformedSignatures: string[];
  pendingFirst: string;
  pendingIndent: number;
  pendingInteriorSignature: ChangelogSignature | null;
  pendingLines: string[] | null;
  releaseOccurrences: Map<string, number>;
  releases: ChangelogRelease[];
  sections: HeadingLine[];
  unattributed: ChangelogEntry[];
  unrecognizedHeadings: string[];
}

const entryTitle = (firstLine: string): string =>
  firstLine.replace(BULLET_MARKER_PATTERN, "").trim();

/**
 * Identity of one entry: the first 12 hex characters of sha256 over the
 * entry's normalized text (see ChangelogEntry.id). Curation provenance
 * comments in RELEASE_NOTES.md reference entries by this id.
 */
export function entryIdentity(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 12);
}

// Removes signature comments, never code-span text, from an entry line.
const stripSignatures = (raw: string): string =>
  raw.replace(INLINE_PATTERN, (token, run) =>
    !run && SIGNATURE_COMMENT_PATTERN.test(token) ? "" : token
  );

const flushPendingItem = (state: ParserState): void => {
  const { pendingLines } = state;
  state.pendingLines = null;
  state.pendingIndent = -1;
  if (pendingLines === null) {
    return;
  }
  const text = pendingLines
    .join("\n")
    .replace(TRAILING_BLANK_LINES_PATTERN, "")
    .split("\n")
    .map((line) => line.replace(TRAILING_WHITESPACE_PATTERN, ""))
    .join("\n");
  const groupMatch = state.pendingFirst.match(GROUP_BULLET_PATTERN);
  const sections = state.sections.map((heading) => heading.text);
  const entry: ChangelogEntry = {
    group: groupMatch ? (groupMatch[1] ?? "").trim() : null,
    id: entryIdentity(text),
    section: sections.at(-1) ?? null,
    sections,
    signature: state.pendingInteriorSignature,
    text,
    title: entryTitle(state.pendingFirst),
  };
  if (state.currentRelease !== null) {
    state.currentRelease.entries.push(entry);
  }
  if (entry.signature === null) {
    state.unattributed.push(entry);
  }
  state.pendingInteriorSignature = null;
};

const handleReleaseHeading = (
  state: ParserState,
  heading: HeadingLine
): void => {
  const fields = releaseHeadingFields(heading.text, state.diagnostics);
  const occurrence = (state.releaseOccurrences.get(heading.text) ?? 0) + 1;
  state.releaseOccurrences.set(heading.text, occurrence);
  if (!(fields.unreleased || fields.version || fields.date)) {
    state.unrecognizedHeadings.push(heading.text);
  }
  const release: ChangelogRelease = {
    ...fields,
    entries: [],
    heading: heading.text,
    occurrence,
  };
  state.currentRelease = release;
  state.releases.push(release);
};

const handleHeadingLine = (state: ParserState, heading: HeadingLine): void => {
  flushPendingItem(state);
  if (heading.depth <= 2) {
    state.unattributed = [];
    state.sections = [];
    state.currentRelease = null;
    if (heading.depth === 2) {
      handleReleaseHeading(state, heading);
    }
    return;
  }
  if (!state.currentRelease) {
    state.diagnostics.push(
      `Section heading "${heading.text}" found before any release heading; skipped.`
    );
    return;
  }
  // A subsection keeps the release's signature block open: one signature
  // may sign a whole release section.
  while ((state.sections.at(-1)?.depth ?? 0) >= heading.depth) {
    state.sections.pop();
  }
  state.sections.push(heading);
};

const handleBulletLine = (state: ParserState, line: MarkdownLine): void => {
  const isNewSibling =
    state.pendingLines === null || line.indent <= state.pendingIndent;

  if (!isNewSibling) {
    // More indented than the active top-level bullet: a nested child.
    state.pendingLines?.push(stripSignatures(line.raw));
    state.lazy = true;
    return;
  }

  if (!state.currentRelease) {
    state.diagnostics.push(
      `Bullet found before any release heading: "${line.raw.trim()}"; skipped.`
    );
    return;
  }
  if (state.pendingLines === null && line.indent > 0) {
    state.diagnostics.push(
      `Nested bullet with no preceding top-level bullet: "${line.raw.trim()}"; skipped.`
    );
    return;
  }
  flushPendingItem(state);
  state.pendingLines = [stripSignatures(line.raw)];
  state.pendingFirst = line.text;
  state.pendingIndent = line.indent;
  state.lazy = true;
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

// Code and comment lines are inert unless they continue an open entry.
const handleInertLine = (state: ParserState, line: MarkdownLine): void => {
  if (
    state.pendingLines !== null &&
    line.raw.trim().length > 0 &&
    line.indent > state.pendingIndent
  ) {
    state.pendingLines.push(
      line.kind === "code" ? line.raw : stripSignatures(line.raw)
    );
  }
};

// Prose that continues an open entry joins it. An unindented line right after
// an entry (lazy continuation) or an ordered-list item is a diagnostic; other
// prose is not an entry and is ignored.
const handleProseLine = (
  state: ParserState,
  line: MarkdownLine,
  lazy: boolean
): void => {
  if (line.text.trim().length === 0) {
    return;
  }
  if (state.pendingLines !== null && line.indent > state.pendingIndent) {
    state.pendingLines.push(stripSignatures(line.raw));
    state.lazy = true;
  } else if (
    lazy ||
    (state.currentRelease && ORDERED_ITEM_PATTERN.test(line.text))
  ) {
    state.diagnostics.push(
      `Line "${line.raw.trim()}" is not read as an entry; use a "-" bullet or indent it under one.`
    );
  }
};

const handleTextLine = (
  state: ParserState,
  line: MarkdownLine,
  lazy: boolean
): void => {
  const heading = parseHeading(line.text);
  if (heading) {
    handleHeadingLine(state, heading);
  } else if (BULLET_PATTERN.test(line.text)) {
    handleBulletLine(state, line);
  } else {
    handleProseLine(state, line, lazy);
  }
};

export function parseChangelog(
  markdown: string,
  sourcePath: string
): ParsedChangelog {
  const { diagnostics, lines } = classifyMarkdown(markdown);
  const state: ParserState = {
    currentRelease: null,
    diagnostics,
    lazy: false,
    legacySignatureCount: 0,
    malformedSignatures: [],
    pendingFirst: "",
    pendingIndent: -1,
    pendingInteriorSignature: null,
    pendingLines: null,
    releaseOccurrences: new Map(),
    releases: [],
    sections: [],
    unattributed: [],
    unrecognizedHeadings: [],
  };

  for (const line of lines) {
    const { lazy } = state;
    state.lazy = false;
    const signature =
      line.kind === "comment" ? parseSignatureLine(line.raw) : null;
    if (signature === "malformed") {
      state.malformedSignatures.push(line.raw.trim());
    } else if (signature) {
      handleSignatureLine(state, signature, line.indent);
    } else if (line.kind === "text") {
      handleTextLine(state, line, lazy);
    } else {
      handleInertLine(state, line);
    }
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
  const occurrence = (state.occurrences.get(heading.text) ?? 0) + 1;
  state.occurrences.set(heading.text, occurrence);
  state.current = {
    ...releaseHeadingFields(heading.text, state.diagnostics),
    curation: null,
    heading: heading.text,
    highlights: [],
    occurrence,
  };
  state.sections.push(state.current);
};

/**
 * Parses RELEASE_NOTES.md: the changelog's release-heading grammar, highlight
 * bullets (top-level only; the rollup line is ordinary prose and ignored),
 * and one curation provenance comment per section. Malformed curation
 * comments become diagnostics, never guessed structure.
 */
export function parseReleaseNotes(
  markdown: string,
  sourcePath: string
): ParsedReleaseNotes {
  const { diagnostics, lines } = classifyMarkdown(markdown);
  const state: ReleaseNotesState = {
    current: null,
    diagnostics,
    occurrences: new Map(),
    sections: [],
  };

  for (const line of lines) {
    const heading = line.kind === "text" ? parseHeading(line.text) : null;
    if (
      line.kind === "comment" &&
      CURATION_COMMENT_PREFIX_PATTERN.test(line.raw)
    ) {
      handleReleaseNotesCurationLine(state, line.raw);
    } else if (heading) {
      handleReleaseNotesHeading(state, heading);
    } else if (
      line.kind === "text" &&
      line.indent === 0 &&
      BULLET_PATTERN.test(line.text) &&
      state.current !== null
    ) {
      state.current.highlights.push(entryTitle(line.text));
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
