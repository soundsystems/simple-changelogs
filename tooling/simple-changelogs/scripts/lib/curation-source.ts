import { CryptoHasher } from "bun";
import { classifyMarkdown, type MarkdownLine } from "./changelog-parse.ts";
import type { CurationScope, SourceBoundary } from "./types.ts";

export interface CurationSourceItem {
  displayText: string; // raw Markdown with signature comments stripped
  itemId: string; // sha256 per the source-entry model
  normalizedText: string; // identity text after CRLF/whitespace normalization
  releaseIdentity: string;
  sectionIdentity: string; // "" when the item sits directly under a release
}

export interface CurationSourceRelease {
  boundary: SourceBoundary;
  itemIds: string[];
  sections: string[];
}

export interface CurationSource {
  diagnostics: string[]; // ambiguity reports; never guessed structure
  items: CurationSourceItem[];
  releases: CurationSourceRelease[];
  sourcePath: string;
}

export type ScopeResolution =
  | { itemIds: string[]; ok: true }
  | { diagnostic: string; ok: false };

const SIGNATURE_COMMENT_PATTERN =
  /<!--\s*simple-changelogs-signature[\s\S]*?-->/g;
const HEADING_PATTERN = /^(#{1,6})\s+(.*?)\s*$/;
const BULLET_PATTERN = /^(\s*)([-*+])\s+(.*)$/;
const VERSION_PATTERN =
  /\[?v?(\d+\.\d+(?:\.\d+)?(?:[a-zA-Z]+\d*)?(?:[.-][0-9A-Za-z]+)*(?:\+[0-9A-Za-z.]+)?)\]?/;
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const TRAILING_WHITESPACE_PATTERN = /[ \t]+$/;
const TRAILING_BLANK_LINES_PATTERN = /\s+$/;

// Text lines are structural; fenced code and HTML comments are not.
type Line = MarkdownLine;

interface HeadingLine {
  depth: number;
  text: string;
}

interface SectionFrame {
  depth: number;
  identity: string;
  occurrences: Map<string, number>;
}

interface ParserState {
  currentRelease: CurationSourceRelease | null;
  currentReleaseIdentity: string;
  diagnostics: string[];
  items: CurationSourceItem[];
  pendingIndent: number;
  pendingLines: string[] | null;
  releaseOccurrences: Map<string, number>;
  releases: CurationSourceRelease[];
  sectionStack: SectionFrame[];
  sourcePath: string;
  topSectionOccurrences: Map<string, number>;
}

const parseVersionAndDate = (
  headingText: string
): { date?: string; version?: string } => {
  const result: { date?: string; version?: string } = {};
  const dateMatch = headingText.match(DATE_PATTERN);
  if (dateMatch) {
    result.date = dateMatch[0];
  }
  const versionMatch = headingText.match(VERSION_PATTERN);
  if (versionMatch) {
    result.version = versionMatch[1];
  }
  return result;
};

const boundaryKey = (boundary: SourceBoundary): string =>
  JSON.stringify({
    date: boundary.date ?? null,
    heading: boundary.heading,
    occurrence: boundary.occurrence,
    sourcePath: boundary.sourcePath,
    version: boundary.version ?? null,
  });

const normalizeText = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(TRAILING_WHITESPACE_PATTERN, ""))
    .join("\n")
    .trim();

const sha256Hex = (input: Uint8Array | string): string => {
  const hasher = new CryptoHasher("sha256");
  hasher.update(input as string);
  return hasher.digest("hex");
};

export function fingerprintBytes(content: Uint8Array | string): string {
  return `sha256:${sha256Hex(content)}`;
}

const parseHeading = (line: Line): HeadingLine | null => {
  if (line.kind !== "text") {
    return null;
  }
  const match = line.text.match(HEADING_PATTERN);
  if (!match) {
    return null;
  }
  return { depth: (match[1] ?? "").length, text: match[2] ?? "" };
};

const currentSectionIdentity = (state: ParserState): string =>
  state.sectionStack.at(-1)?.identity ?? "";

const flushPendingItem = (state: ParserState): void => {
  const { pendingLines } = state;
  if (pendingLines === null || pendingLines.length === 0) {
    state.pendingLines = null;
    state.pendingIndent = -1;
    return;
  }
  const displayText = pendingLines
    .join("\n")
    .replace(TRAILING_BLANK_LINES_PATTERN, "");
  const normalizedText = normalizeText(displayText);
  const releaseIdentity = state.currentReleaseIdentity;
  const sectionIdentity = currentSectionIdentity(state);
  const itemId = sha256Hex(
    [state.sourcePath, releaseIdentity, sectionIdentity, normalizedText].join(
      " "
    )
  );
  state.items.push({
    displayText,
    itemId,
    normalizedText,
    releaseIdentity,
    sectionIdentity,
  });
  if (state.currentRelease) {
    state.currentRelease.itemIds.push(itemId);
  }
  state.pendingLines = null;
  state.pendingIndent = -1;
};

const handleTitleHeading = (state: ParserState): void => {
  state.sectionStack = [];
  state.currentRelease = null;
  state.currentReleaseIdentity = "";
};

const handleReleaseHeading = (
  state: ParserState,
  heading: HeadingLine
): void => {
  const parsed = parseVersionAndDate(heading.text);
  const occurrence = (state.releaseOccurrences.get(heading.text) ?? 0) + 1;
  state.releaseOccurrences.set(heading.text, occurrence);
  const boundary: SourceBoundary = {
    heading: heading.text,
    occurrence,
    sourcePath: state.sourcePath,
    ...(parsed.version ? { version: parsed.version } : {}),
    ...(parsed.date ? { date: parsed.date } : {}),
  };
  const release: CurationSourceRelease = {
    boundary,
    itemIds: [],
    sections: [],
  };
  state.currentRelease = release;
  state.currentReleaseIdentity = boundaryKey(boundary);
  state.releases.push(release);
  state.sectionStack = [];
  state.topSectionOccurrences = new Map();
};

const handleSectionHeading = (
  state: ParserState,
  heading: HeadingLine
): void => {
  const { currentRelease } = state;
  if (!currentRelease) {
    state.diagnostics.push(
      `Section heading "${heading.text}" found before any release heading; skipped.`
    );
    return;
  }

  while (
    state.sectionStack.length > 0 &&
    (state.sectionStack.at(-1) as SectionFrame).depth >= heading.depth
  ) {
    state.sectionStack.pop();
  }

  const parentOccurrences =
    state.sectionStack.at(-1)?.occurrences ?? state.topSectionOccurrences;

  const occurrence = (parentOccurrences.get(heading.text) ?? 0) + 1;
  parentOccurrences.set(heading.text, occurrence);

  const sectionBoundary: SourceBoundary = {
    heading: heading.text,
    occurrence,
    sourcePath: state.sourcePath,
  };
  state.sectionStack.push({
    depth: heading.depth,
    identity: boundaryKey(sectionBoundary),
    occurrences: new Map(),
  });
  currentRelease.sections.push(heading.text);
};

const handleHeadingLine = (state: ParserState, heading: HeadingLine): void => {
  flushPendingItem(state);

  if (heading.depth === 1) {
    handleTitleHeading(state);
    return;
  }

  if (heading.depth === 2) {
    handleReleaseHeading(state, heading);
    return;
  }

  handleSectionHeading(state, heading);
};

const handleBulletLine = (state: ParserState, line: Line): void => {
  const { indent } = line;
  const isNewSibling =
    state.pendingLines === null || indent <= state.pendingIndent;

  if (!isNewSibling) {
    // More indented than the active top-level bullet: a nested child.
    (state.pendingLines as string[]).push(line.raw);
    return;
  }

  if (!state.currentRelease) {
    state.diagnostics.push(
      `Bullet found before any release heading: "${line.raw.trim()}"; skipped.`
    );
    return;
  }
  if (state.pendingLines === null && indent > 0) {
    state.diagnostics.push(
      `Nested bullet with no preceding top-level bullet: "${line.raw.trim()}"; skipped.`
    );
    return;
  }
  flushPendingItem(state);
  state.pendingLines = [line.raw];
  state.pendingIndent = indent;
};

const handleInertLine = (state: ParserState, line: Line): void => {
  // Content inside fences/comments is inert unless it belongs to an
  // already-open atomic entry (an indented continuation of a bullet).
  if (
    state.pendingLines !== null &&
    line.raw.trim().length > 0 &&
    line.indent > state.pendingIndent
  ) {
    state.pendingLines.push(line.raw);
  }
};

const handleStructuralContentLine = (state: ParserState, line: Line): void => {
  if (line.raw.trim().length === 0) {
    return;
  }
  if (state.pendingLines !== null && line.indent > state.pendingIndent) {
    state.pendingLines.push(line.raw);
  }
  // Otherwise: stray prose outside any bullet is not an entry; ignored.
};

export function extractCurationSource(
  markdown: string,
  sourcePath: string
): CurationSource {
  const stripped = markdown.replace(SIGNATURE_COMMENT_PATTERN, "");
  const { diagnostics, lines } = classifyMarkdown(stripped);

  const state: ParserState = {
    currentRelease: null,
    currentReleaseIdentity: "",
    diagnostics,
    items: [],
    pendingIndent: -1,
    pendingLines: null,
    releaseOccurrences: new Map(),
    releases: [],
    sectionStack: [],
    sourcePath,
    topSectionOccurrences: new Map(),
  };

  for (const line of lines) {
    if (line.kind !== "text") {
      handleInertLine(state, line);
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      handleHeadingLine(state, heading);
      continue;
    }

    const bulletMatch = line.text.match(BULLET_PATTERN);
    if (bulletMatch) {
      handleBulletLine(state, line);
      continue;
    }

    handleStructuralContentLine(state, line);
  }

  flushPendingItem(state);

  return {
    diagnostics: state.diagnostics,
    items: state.items,
    releases: state.releases,
    sourcePath,
  };
}

const matchesOptionalField = <T>(
  expected: T | undefined,
  actual: T | undefined
): boolean => expected === undefined || expected === actual;

const findRelease = (
  source: CurationSource,
  target: SourceBoundary
): CurationSourceRelease | undefined =>
  source.releases.find(
    (release) =>
      release.boundary.sourcePath === target.sourcePath &&
      release.boundary.heading === target.heading &&
      release.boundary.occurrence === target.occurrence &&
      matchesOptionalField(target.version, release.boundary.version) &&
      matchesOptionalField(target.date, release.boundary.date)
  );

const findReleaseIndex = (
  source: CurationSource,
  target: SourceBoundary
): number =>
  source.releases.findIndex(
    (release) =>
      release.boundary.sourcePath === target.sourcePath &&
      release.boundary.heading === target.heading &&
      release.boundary.occurrence === target.occurrence &&
      matchesOptionalField(target.version, release.boundary.version) &&
      matchesOptionalField(target.date, release.boundary.date)
  );

const resolveFullHistory = (source: CurationSource): ScopeResolution => ({
  itemIds: source.items.map((item) => item.itemId),
  ok: true,
});

const resolveItemSet = (
  source: CurationSource,
  itemIds: string[]
): ScopeResolution => {
  const knownIds = new Set(source.items.map((item) => item.itemId));
  const unknown = itemIds.filter((id) => !knownIds.has(id));
  if (unknown.length > 0) {
    return {
      diagnostic: `Unknown itemId(s) in item-set scope: ${unknown.join(", ")}`,
      ok: false,
    };
  }
  return { itemIds: [...itemIds], ok: true };
};

const resolveRelease = (
  source: CurationSource,
  boundary: SourceBoundary
): ScopeResolution => {
  const release = findRelease(source, boundary);
  if (!release) {
    return {
      diagnostic: `Release boundary not found: ${boundaryKey(boundary)}`,
      ok: false,
    };
  }
  return { itemIds: [...release.itemIds], ok: true };
};

const resolveReleaseRange = (
  source: CurationSource,
  first: SourceBoundary,
  last: SourceBoundary
): ScopeResolution => {
  const firstIndex = findReleaseIndex(source, first);
  const lastIndex = findReleaseIndex(source, last);
  if (firstIndex === -1) {
    return {
      diagnostic: `Release-range start boundary not found: ${boundaryKey(first)}`,
      ok: false,
    };
  }
  if (lastIndex === -1) {
    return {
      diagnostic: `Release-range end boundary not found: ${boundaryKey(last)}`,
      ok: false,
    };
  }
  if (firstIndex > lastIndex) {
    return {
      diagnostic:
        "Release-range boundaries are out of document order; refusing to guess direction.",
      ok: false,
    };
  }
  const itemIds = source.releases
    .slice(firstIndex, lastIndex + 1)
    .flatMap((release) => release.itemIds);
  return { itemIds, ok: true };
};

const resolveSection = (
  source: CurationSource,
  releaseBoundary: SourceBoundary,
  sectionBoundary: SourceBoundary
): ScopeResolution => {
  const release = findRelease(source, releaseBoundary);
  if (!release) {
    return {
      diagnostic: `Release boundary not found: ${boundaryKey(releaseBoundary)}`,
      ok: false,
    };
  }
  const sectionIdentity = boundaryKey({
    ...sectionBoundary,
    sourcePath: releaseBoundary.sourcePath,
  });
  const releaseItemIds = new Set(release.itemIds);
  const itemIds = source.items
    .filter(
      (item) =>
        releaseItemIds.has(item.itemId) &&
        item.sectionIdentity === sectionIdentity
    )
    .map((item) => item.itemId);
  if (itemIds.length === 0) {
    return {
      diagnostic: `Section boundary not found within release: ${boundaryKey(sectionBoundary)}`,
      ok: false,
    };
  }
  return { itemIds, ok: true };
};

export function resolveCurationScope(
  source: CurationSource,
  scope: CurationScope
): ScopeResolution {
  switch (scope.kind) {
    case "full-history": {
      return resolveFullHistory(source);
    }
    case "item-set": {
      return resolveItemSet(source, scope.itemIds);
    }
    case "release": {
      return resolveRelease(source, scope.release);
    }
    case "release-range": {
      return resolveReleaseRange(source, scope.first, scope.last);
    }
    case "section": {
      return resolveSection(source, scope.release, scope.section);
    }
    default: {
      const exhaustive: never = scope;
      return {
        diagnostic: `Unsupported curation scope kind: ${JSON.stringify(exhaustive)}`,
        ok: false,
      };
    }
  }
}

export function fingerprintSourceScope(
  source: CurationSource,
  scope: CurationScope
): string {
  const resolution = resolveCurationScope(source, scope);
  if (!resolution.ok) {
    return fingerprintBytes(
      JSON.stringify({ diagnostic: resolution.diagnostic, ok: false })
    );
  }
  const includedIds = new Set(resolution.itemIds);
  const canonical = source.items
    .filter((item) => includedIds.has(item.itemId))
    .map((item) => ({
      itemId: item.itemId,
      normalizedText: item.normalizedText,
    }));
  return fingerprintBytes(JSON.stringify(canonical));
}
