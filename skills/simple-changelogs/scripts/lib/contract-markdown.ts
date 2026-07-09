const REFERENCE_DEFINITION_PATTERN =
  /^[\t ]{0,3}\[([^\]]+)\]:[\t ]*(?:<([^>\r\n]+)>|([^\s\r\n]+))(?:[\t ]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[\t ]*$/gm;
const INLINE_LINK_PATTERN =
  /!?\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+["'][^"']*["'])?\s*\)/g;
const FULL_REFERENCE_PATTERN = /!?\[([^\]]+)\]\[([^\]]*)\]/g;
const SHORT_REFERENCE_PATTERN = /!?\[([^\]]+)\]/g;
const AUTOLINK_REMOTE_PATTERN = /<(?:https?:\/\/|mailto:)[^>]+>/gi;
const BARE_REMOTE_PATTERN = /\b(?:https?:\/\/|mailto:)[^\s<>()]+/gi;
const REMOTE_DESTINATION_PATTERN = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/;
const TARGET_SUFFIX_PATTERN = /[?#]/;
const LABEL_SPACE_PATTERN = /\s+/g;

type MarkdownMode = "routes" | "visible";

export interface ContractMarkdownViews {
  localRouteText: string;
  visibleText: string;
}

const normalizeLabel = (label: string): string =>
  label.trim().replace(LABEL_SPACE_PATTERN, " ").toLowerCase();

export const normalizeLocalTarget = (target: string): string =>
  target.split(TARGET_SUFFIX_PATTERN, 1)[0] ?? "";

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

const renderMarkdown = (
  body: string,
  definitions: Map<string, string>,
  mode: MarkdownMode
): string =>
  body
    .replace(
      INLINE_LINK_PATTERN,
      (_match, label: string, angle?: string, bare?: string) =>
        replacementFor(label, angle ?? bare ?? "", mode)
    )
    .replace(
      FULL_REFERENCE_PATTERN,
      (_match, label: string, reference: string) => {
        const destination = definitions.get(normalizeLabel(reference || label));
        if (destination === undefined) {
          return mode === "visible" ? label : " ";
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
