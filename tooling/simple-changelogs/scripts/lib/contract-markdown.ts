const REFERENCE_DEFINITION_PATTERN =
  /^[\t ]{0,3}\[([^\]]+)\]:[\t ]*(?:<([^>\r\n]+)>|([^\s\r\n]+))(?:[\t ]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[\t ]*$/gm;
const INLINE_LINK_START_PATTERN = /!?\[([^\]\r\n]*)\]\(/g;
const FULL_REFERENCE_PATTERN = /!?\[([^\]]+)\]\[([^\]]*)\]/g;
const SHORT_REFERENCE_PATTERN = /!?\[([^\]]+)\]/g;
const AUTOLINK_REMOTE_PATTERN = /<(?:https?:\/\/|mailto:)[^>]+>/gi;
const BARE_REMOTE_PATTERN = /\b(?:https?:\/\/|mailto:)[^\s<>]+/gi;
const REMOTE_DESTINATION_PATTERN = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/;
const TARGET_SUFFIX_PATTERN = /[?#]/;
const LABEL_SPACE_PATTERN = /\s+/g;
const DESTINATION_SPACE_PATTERN = /\s/;
const MAX_INLINE_DESTINATION_LENGTH = 4096;

type MarkdownMode = "routes" | "visible";

export interface ContractMarkdownViews {
  localRouteText: string;
  visibleText: string;
}

const normalizeLabel = (label: string): string =>
  label.trim().replace(LABEL_SPACE_PATTERN, " ").toLowerCase();

const trimUnmatchedClosingParentheses = (target: string): string => {
  let opening = 0;
  let closing = 0;
  for (const character of target) {
    if (character === "(") {
      opening += 1;
    } else if (character === ")") {
      closing += 1;
    }
  }
  let result = target;
  while (closing > opening && result.endsWith(")")) {
    result = result.slice(0, -1);
    closing -= 1;
  }
  return result;
};

export const normalizeLocalTarget = (target: string): string =>
  trimUnmatchedClosingParentheses(
    target.split(TARGET_SUFFIX_PATTERN, 1)[0] ?? ""
  );

const localTarget = (destination: string): string | undefined =>
  REMOTE_DESTINATION_PATTERN.test(destination)
    ? undefined
    : normalizeLocalTarget(destination);

const collectDefinitions = (
  source: string
): { body: string; definitions: Map<string, string> } => {
  const definitions = new Map<string, string>();
  const body = source.replace(
    REFERENCE_DEFINITION_PATTERN,
    (_match, label: string, angle?: string, bare?: string) => {
      definitions.set(normalizeLabel(label), angle ?? bare ?? "");
      return "";
    }
  );
  return { body, definitions };
};

const replacementFor = (
  label: string,
  destination: string,
  mode: MarkdownMode
): string => {
  if (mode === "visible") {
    return label;
  }
  const target = localTarget(destination);
  return target ? ` ${target} ` : " ";
};

const destinationFrom = (contents: string): string => {
  const trimmed = contents.trim();
  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    return end > 0 ? trimmed.slice(1, end) : "";
  }
  const space = trimmed.search(DESTINATION_SPACE_PATTERN);
  return space < 0 ? trimmed : trimmed.slice(0, space);
};

const findInlineDestinationEnd = (source: string, start: number): number => {
  const limit = Math.min(source.length, start + MAX_INLINE_DESTINATION_LENGTH);
  let depth = 1;
  for (let index = start; index < limit; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    } else if (character === "\n" || character === "\r") {
      return -1;
    }
  }
  return -1;
};

const replaceInlineLinks = (source: string, mode: MarkdownMode): string => {
  let cursor = 0;
  let output = "";
  for (const match of source.matchAll(INLINE_LINK_START_PATTERN)) {
    const matchIndex = match.index;
    if (matchIndex < cursor) {
      continue;
    }
    const contentsStart = matchIndex + match[0].length;
    const closeIndex = findInlineDestinationEnd(source, contentsStart);
    if (closeIndex < 0) {
      continue;
    }
    output += source.slice(cursor, matchIndex);
    output += replacementFor(
      match[1] ?? "",
      destinationFrom(source.slice(contentsStart, closeIndex)),
      mode
    );
    cursor = closeIndex + 1;
  }
  return output + source.slice(cursor);
};

const renderMarkdown = (
  body: string,
  definitions: Map<string, string>,
  mode: MarkdownMode
): string =>
  replaceInlineLinks(body, mode)
    .replace(
      FULL_REFERENCE_PATTERN,
      (_match, label: string, reference: string) => {
        const destination = definitions.get(normalizeLabel(reference || label));
        if (destination === undefined) {
          return label;
        }
        return replacementFor(label, destination, mode);
      }
    )
    .replace(SHORT_REFERENCE_PATTERN, (match, label: string) => {
      const destination = definitions.get(normalizeLabel(label));
      return destination === undefined
        ? match
        : replacementFor(label, destination, mode);
    })
    .replace(AUTOLINK_REMOTE_PATTERN, " ")
    .replace(BARE_REMOTE_PATTERN, " ");

export const normalizeContractMarkdown = (
  source: string
): ContractMarkdownViews => {
  const { body, definitions } = collectDefinitions(source);
  return {
    localRouteText: renderMarkdown(body, definitions, "routes"),
    visibleText: renderMarkdown(body, definitions, "visible"),
  };
};
