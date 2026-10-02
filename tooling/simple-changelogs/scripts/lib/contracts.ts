import { basename, isAbsolute, join, resolve } from "node:path";
import { JSONC, spawn, YAML } from "bun";
import {
  ContractConfigurationError,
  type ContractContext,
  createContractContext,
  entryText,
  isContained,
  markdownEntries,
} from "./contract-files.ts";
import {
  normalizeContractMarkdown,
  normalizeLocalTarget,
} from "./contract-markdown.ts";
import { validateManifest, validateRepoPolicy } from "./validate.ts";

export interface ContractFinding {
  code: string;
  message: string;
  path: string;
}

export interface ContractEvaluationOptions {
  shellSyntaxCheck?: ShellSyntaxCheck;
}

export type ShellSyntaxCheck = (scriptPath: string) => Promise<number>;

interface FrontmatterResult {
  errors: string[];
  name?: string;
}

const REQUIRED_BUNDLED_FILES = [
  "SKILL.md",
  "references/guidance-updates.md",
  "references/setup.md",
  "scripts/check-fork-sync.sh",
] as const;

const PROSE_SEQUENCE_LENGTH = 18;
const POLICY_MARKER = "<!-- simple-changelogs-policy-example -->";
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const FRONTMATTER_ONLY_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// `metadata` is the Agent Skills specification's optional string-to-string
// map; every other key stays out so loaders see the same portable shape.
const FRONTMATTER_KEYS = new Set<PropertyKey>([
  "name",
  "description",
  "metadata",
]);
const BACKTICK_FENCE_PATTERN = /```[\s\S]*?```/g;
const TILDE_FENCE_PATTERN = /~~~[\s\S]*?~~~/g;
const ALL_HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const CANONICAL_SIGNATURE_PATTERN =
  /<!--\s*simple-changelogs-signature\s+agent="[^"]*"\s+at="[^"]*"\s*-->/g;
const NORMALIZED_WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const ROUTED_PATH_PATTERN =
  /(?<![A-Za-z0-9_.-])((?:\/(?!\/)|(?:\.\.?\/)*)(?:references|scripts|evals)\/[^\s`"'<>{}[\],;:]+)/g;
const POLICY_MARKER_PATTERN = /<!-- simple-changelogs-policy-example -->/g;
const POLICY_BLOCK_PATTERN =
  /<!-- simple-changelogs-policy-example -->[\t ]*\r?\n[\t ]*(```|~~~)(jsonc?)[\t ]*\r?\n([\s\S]*?)\r?\n\1[\t ]*(?=\r?\n|$)/gi;
const GUIDANCE_DECLARATION_PATTERN = /^Current guidance version:\s*(.+?)\s*$/im;
const GUIDANCE_HEADING_PATTERN = /^## Guidance ([1-9]\d*)[\t ]*$/gm;
const INSTALLED_TARGET_PATTERN =
  /(?:\b(?:globally[- ]installed|installed)\b.{0,80}\b(?:skill|copy|directory|file)\b|\b(?:skill|copy|directory|file)\b.{0,80}\b(?:globally[- ]installed|installed)\b)/i;
const MUTATION_ACTION_PATTERN =
  /\b(?:append(?:s|ed|ing)?|clear(?:s|ed|ing)?|delet(?:e|es|ed|ing)|edit(?:s|ed|ing)?|inject(?:s|ed|ing)?|modif(?:y|ies|ied|ying)|mutat(?:e|es|ed|ing)|overwrit(?:e|es|ten|ing)|patch(?:es|ed|ing)?|replac(?:e|es|ed|ing)|remov(?:e|es|ed|ing)|rewrit(?:e|es|ten|ing)|updat(?:e|es|ed|ing)|writ(?:e|es|ten|ing))\b/i;
// The trailing lookahead keeps these verbs from matching inside a hyphenated
// compound noun such as `build-plan` or `add-on`, which names a thing rather
// than describing the creation of a release-note surface.
const UI_ACTION_PATTERN =
  /\b(?:creat(?:e|es|ed|ing)|add(?:s|ed|ing)?|build(?:s|ing)?|built|wir(?:e|es|ed|ing))\b(?!-\w)/i;
const UI_TARGET_PATTERN =
  /(?:\b(?:release[- ]note|what(?:'|’)s new|changelog|internal)\b.{0,100}\b(?:surface|ui|modal|route|page|screen|panel)\b|\b(?:surface|ui|modal|route|page|screen|panel)\b.{0,100}\b(?:release[- ]note|what(?:'|’)s new|changelog|internal)\b)/i;
const PROHIBITION_PATTERN =
  /\b(?:do not|does not|did not|must not|should not|may not|cannot|can't|never)\b/i;
const PASSIVE_PROHIBITION_PATTERN =
  /\b(?:is|are|was|were) not (?:allowed|permitted)\b/i;
const NEGATED_AUTHORIZATION_PATTERN =
  /(?:\bwithout\b.{0,60}\b(?:explicit (?:user |task )?(?:authorization|approval|request)|documented (?:repository|repo) policy|stored (?:repository )?policy)\b|\bnot explicitly (?:(?:user|task)-)?(?:authorized|approved|requested)\b|\b(?:documented (?:repository|repo) policy|stored (?:repository )?policy)\b.{0,80}\b(?:does|do|must|should|may|can) not\b.{0,40}\b(?:allow|allows|authorize|authorizes|grant|grants)\b)/i;
const NEGATED_PERMISSION_CLAUSE_PATTERN =
  /\b(?:does|do|must|should|may|can) not\b.{0,40}\b(?:allow|allows|authorize|authorizes|grant|grants)\b/i;
const OPPOSING_TRANSITION_PATTERN =
  /\b(?:anyway|but|however|nevertheless|so|still|yet)\b/gi;
const ANYWAY_CLAUSE_BOUNDARY_PATTERN = /[,;:—–]|\b(?:and|but)\b/gi;
const ANYWAY_PATTERN = /\banyway\b/i;
const AUTHORIZATION_PATTERNS = [
  /\bcurrent (?:user )?request\b.{0,100}\bexplicitly authoriz(?:e|es|ed|ation)\b/i,
  /\bexplicitly (?:(?:user|task)-)?(?:authorized|approved|requested) by (?:the )?current (?:user )?request\b/i,
  /\bexplicit(?: user| task)? (?:authorization|approval|request)\b/i,
  /\bdocumented (?:repository|repo) policy\b.{0,100}\b(?:allow|allows|authorize|authorizes|grant|grants)\b/i,
  /\b(?:allowed|authorized|granted) by (?:a |the )?documented (?:repository|repo) policy\b/i,
  /\bstored (?:repository )?policy\b.{0,100}\b(?:allow|allows|authorize|authorizes|grant|grants)\b/i,
  /\b(?:allowed|authorized|granted) by (?:a |the )?stored (?:repository )?policy\b/i,
] as const;
const SENTENCE_BOUNDARY_PATTERN = /(?<=[.!?])\s+|\r?\n+/;
const NORMALIZED_SPACE_PATTERN = /\s+/g;
const ROUTED_TRAILING_PUNCTUATION_PATTERN = /[.!?]+$/;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const finding = (
  code: string,
  path: string,
  message: string
): ContractFinding => ({ code, message, path });

const compact = <Value>(values: (Value | undefined)[]): Value[] =>
  values.filter((value): value is Value => value !== undefined);

const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
};

const isStringMap = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (entry) => typeof entry === "string" && entry.trim().length > 0
  );

const parseFrontmatter = (source: string): FrontmatterResult => {
  const block = FRONTMATTER_PATTERN.exec(source)?.[1];
  if (block === undefined) {
    return {
      errors: ["SKILL.md must start with a closed YAML frontmatter block"],
    };
  }

  let value: unknown;
  try {
    value = YAML.parse(block);
  } catch (error) {
    return {
      errors: [
        `SKILL.md frontmatter is malformed YAML: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { errors: ["Frontmatter must be an object"] };
  }
  const keys = Reflect.ownKeys(value);
  const record = value as Record<PropertyKey, unknown>;
  const errors: string[] = [];
  if (
    !(keys.includes("name") && keys.includes("description")) ||
    keys.some((key) => !FRONTMATTER_KEYS.has(key))
  ) {
    errors.push(
      "Frontmatter must contain name and description, plus optional metadata"
    );
  }
  if (keys.includes("metadata") && !isStringMap(record.metadata)) {
    errors.push("Frontmatter metadata must map keys to non-empty strings");
  }
  if (typeof record.name !== "string" || !record.name.trim()) {
    errors.push("Frontmatter name must be a non-empty string");
  } else if (!SKILL_NAME_PATTERN.test(record.name)) {
    errors.push("Frontmatter name must use lowercase kebab-case");
  }
  if (typeof record.description !== "string" || !record.description.trim()) {
    errors.push("Frontmatter description must be a non-empty string");
  }
  return {
    errors,
    name: typeof record.name === "string" ? record.name : undefined,
  };
};

const checkFrontmatter = (context: ContractContext): ContractFinding[] => {
  const skill = context.entries.get("SKILL.md");
  if (skill?.kind !== "file" || !skill.readable) {
    return [finding("FRONTMATTER_INVALID", "SKILL.md", "SKILL.md is missing")];
  }
  const parsed = parseFrontmatter(skill.text ?? "");
  const findings = parsed.errors.map((message) =>
    finding("FRONTMATTER_INVALID", "SKILL.md", message)
  );
  if (parsed.name && parsed.name !== basename(context.root)) {
    findings.push(
      finding(
        "SKILL_NAME_MISMATCH",
        "SKILL.md",
        `Frontmatter name ${parsed.name} does not match directory ${basename(context.root)}`
      )
    );
  }
  return findings;
};

const checkBundleEntries = (context: ContractContext): ContractFinding[] => {
  const findings = Array.from(context.entries.values())
    .filter((entry) => entry.kind === "symlink")
    .map((entry) =>
      finding(
        "SYMLINK_NOT_ALLOWED",
        entry.path,
        `Installed skill packages must not contain symlinks: ${entry.path}`
      )
    );

  for (const path of REQUIRED_BUNDLED_FILES) {
    const entry = context.entries.get(path);
    if (!entry) {
      findings.push(
        finding(
          "BUNDLED_FILE_MISSING",
          path,
          `Required installed-package file is missing: ${path}`
        )
      );
    } else if (entry.kind !== "file" || !entry.readable || !entry.canonical) {
      findings.push(
        finding(
          "BUNDLED_FILE_INVALID",
          path,
          `Required installed-package path must be a readable regular file inside the skill root: ${path}`
        )
      );
    }
  }
  return findings;
};

const routedPaths = (source: string): string[] =>
  Array.from(
    normalizeContractMarkdown(source).localRouteText.matchAll(
      ROUTED_PATH_PATTERN
    ),
    (match) =>
      normalizeLocalTarget(
        (match[1] ?? "").replace(ROUTED_TRAILING_PUNCTUATION_PATTERN, "")
      )
  );

const safeRoutedPath = (root: string, path: string): boolean => {
  const segments = path.split("/");
  return (
    !isAbsolute(path) &&
    segments.length > 1 &&
    (segments[0] === "references" ||
      segments[0] === "scripts" ||
      segments[0] === "evals") &&
    segments.every((segment) => segment !== "." && segment !== "..") &&
    isContained(root, resolve(root, path))
  );
};

const checkRoutedFiles = (context: ContractContext): ContractFinding[] => {
  const findings: ContractFinding[] = [];
  for (const source of markdownEntries(context)) {
    for (const routedPath of new Set(routedPaths(source.text ?? ""))) {
      if (!safeRoutedPath(context.root, routedPath)) {
        findings.push(
          finding(
            "ROUTED_PATH_INVALID",
            source.path,
            `Routed package path is unsafe: ${routedPath}`
          )
        );
        continue;
      }
      const entry = context.entries.get(routedPath);
      if (!entry) {
        findings.push(
          finding(
            "ROUTED_FILE_MISSING",
            source.path,
            `Routed package file is missing: ${routedPath}`
          )
        );
      } else if (entry.kind !== "file" || !entry.readable || !entry.canonical) {
        findings.push(
          finding(
            "ROUTED_PATH_INVALID",
            source.path,
            `Routed package path must be a readable regular file inside the skill root: ${routedPath}`
          )
        );
      }
    }
  }
  return findings;
};

const checkPolicyExample = (context: ContractContext): ContractFinding[] => {
  const markdown = markdownEntries(context);
  const markerPaths = markdown.flatMap((entry) =>
    Array.from(
      (entry.text ?? "").matchAll(POLICY_MARKER_PATTERN),
      () => entry.path
    )
  );
  const blocks = markdown.flatMap((entry) =>
    Array.from((entry.text ?? "").matchAll(POLICY_BLOCK_PATTERN), (match) => ({
      contents: match[3] ?? "",
      path: entry.path,
    }))
  );
  if (markerPaths.length === 0) {
    return [
      finding(
        "POLICY_EXAMPLE_MISSING",
        "references/setup.md",
        `One ${POLICY_MARKER} marker must precede the canonical policy example`
      ),
    ];
  }
  if (markerPaths.length !== 1 || blocks.length !== 1) {
    const diagnosticPaths = Array.from(
      new Set([...markerPaths, ...blocks.map((candidate) => candidate.path)])
    ).sort(compareText);
    const [diagnosticPath] = diagnosticPaths;
    return [
      finding(
        "POLICY_EXAMPLE_INVALID",
        diagnosticPath ?? "references/setup.md",
        "The policy marker must appear exactly once and directly precede one JSON or JSONC fence"
      ),
    ];
  }

  const [block] = blocks;
  if (!block) {
    return [];
  }
  let input: unknown;
  try {
    input = JSONC.parse(block.contents);
  } catch (error) {
    return [
      finding(
        "POLICY_EXAMPLE_INVALID",
        block.path,
        `Repository-policy example is not valid JSON/JSONC: ${error instanceof Error ? error.message : String(error)}`
      ),
    ];
  }
  const result = validateRepoPolicy(input);
  return result.ok
    ? []
    : [
        finding(
          "POLICY_EXAMPLE_INVALID",
          block.path,
          `Repository-policy example is invalid: ${result.errors.join("; ")}`
        ),
      ];
};

const withoutFencesAndComments = (source: string): string =>
  source
    .replace(BACKTICK_FENCE_PATTERN, " ")
    .replace(TILDE_FENCE_PATTERN, " ")
    .replace(ALL_HTML_COMMENT_PATTERN, " ");

const checkGuidanceCoverage = (context: ContractContext): ContractFinding[] => {
  const skill = withoutFencesAndComments(entryText(context, "SKILL.md"));
  const declaration = GUIDANCE_DECLARATION_PATTERN.exec(skill)?.[1];
  if (declaration === undefined) {
    return [
      finding(
        "GUIDANCE_VERSION_MISSING",
        "SKILL.md",
        "SKILL.md must declare the current integer guidance version"
      ),
    ];
  }
  if (!POSITIVE_INTEGER_PATTERN.test(declaration)) {
    return [
      finding(
        "GUIDANCE_VERSION_INVALID",
        "SKILL.md",
        "Current guidance version must be a safe positive integer"
      ),
    ];
  }
  const currentVersion = Number(declaration);
  if (!Number.isSafeInteger(currentVersion) || currentVersion < 1) {
    return [
      finding(
        "GUIDANCE_VERSION_INVALID",
        "SKILL.md",
        "Current guidance version must be a safe positive integer"
      ),
    ];
  }

  const source = withoutFencesAndComments(
    entryText(context, "references/guidance-updates.md")
  );
  const headings = Array.from(
    source.matchAll(GUIDANCE_HEADING_PATTERN),
    (match) => Number(match[1])
  );
  const counts = new Map<number, number>();
  for (const version of headings) {
    counts.set(version, (counts.get(version) ?? 0) + 1);
  }
  const findings: ContractFinding[] = [];
  for (const [version, count] of counts) {
    if (count > 1) {
      findings.push(
        finding(
          "GUIDANCE_VERSION_DUPLICATED",
          "references/guidance-updates.md",
          `Guidance version ${version} must have exactly one heading`
        )
      );
    }
    if (version > currentVersion) {
      findings.push(
        finding(
          "GUIDANCE_VERSION_UNEXPECTED",
          "references/guidance-updates.md",
          `Guidance version ${version} exceeds current version ${currentVersion}`
        )
      );
    }
  }

  const documented = Array.from(counts.keys())
    .filter((version) => version <= currentVersion)
    .sort((left, right) => left - right);
  let expected = 1;
  for (const version of documented) {
    if (version !== expected) {
      break;
    }
    expected += 1;
  }
  if (expected <= currentVersion) {
    findings.push(
      finding(
        "GUIDANCE_VERSION_UNDOCUMENTED",
        "references/guidance-updates.md",
        `Guidance version ${expected} has no canonical heading`
      )
    );
  }
  return findings;
};

const proseForDuplication = (source: string): string =>
  normalizeContractMarkdown(source)
    .visibleText.replace(FRONTMATTER_ONLY_PATTERN, " ")
    .replace(BACKTICK_FENCE_PATTERN, " ")
    .replace(TILDE_FENCE_PATTERN, " ")
    .replace(CANONICAL_SIGNATURE_PATTERN, " ");

const proseSequences = (source: string): Set<string> => {
  const words = Array.from(
    proseForDuplication(source).toLowerCase().matchAll(NORMALIZED_WORD_PATTERN),
    (match) => match[0]
  );
  const sequences = new Set<string>();
  for (
    let index = 0;
    index <= words.length - PROSE_SEQUENCE_LENGTH;
    index += 1
  ) {
    sequences.add(words.slice(index, index + PROSE_SEQUENCE_LENGTH).join(" "));
  }
  return sequences;
};

const checkProseDuplication = (context: ContractContext): ContractFinding[] => {
  const skillSequences = proseSequences(entryText(context, "SKILL.md"));
  return compact(
    markdownEntries(context)
      .filter((entry) => entry.path.startsWith("references/"))
      .map((entry) => {
        const duplicate = Array.from(proseSequences(entry.text ?? "")).find(
          (sequence) => skillSequences.has(sequence)
        );
        return duplicate
          ? finding(
              "PROSE_DUPLICATION",
              entry.path,
              `Duplicates ${PROSE_SEQUENCE_LENGTH}-word SKILL.md prose: “${duplicate}”`
            )
          : undefined;
      })
  );
};

const isProhibition = (sentence: string, action: RegExp): boolean => {
  const actionIndex = sentence.search(action);
  if (actionIndex < 0) {
    return false;
  }
  if (PASSIVE_PROHIBITION_PATTERN.test(sentence)) {
    return true;
  }
  const prohibitionIndex = sentence.search(PROHIBITION_PATTERN);
  if (prohibitionIndex < 0 || prohibitionIndex > actionIndex) {
    return false;
  }
  const prohibitedSource = sentence.slice(prohibitionIndex);
  const negatedPermission = prohibitedSource.match(
    NEGATED_PERMISSION_CLAUSE_PATTERN
  );
  if (negatedPermission === null) {
    return true;
  }
  const permissionIndex =
    prohibitionIndex + (negatedPermission.index ?? Number.POSITIVE_INFINITY);
  if (permissionIndex > actionIndex) {
    return true;
  }
  const permissionEnd = permissionIndex + negatedPermission[0].length;
  const trailingSource = sentence.slice(permissionEnd);
  const actionAfterTransition = Array.from(
    trailingSource.matchAll(OPPOSING_TRANSITION_PATTERN)
  ).some((match) =>
    action.test(trailingSource.slice((match.index ?? 0) + match[0].length))
  );
  const actionBeforeAnyway = Array.from(
    trailingSource.matchAll(ANYWAY_CLAUSE_BOUNDARY_PATTERN)
  ).some((match) => {
    const clause = trailingSource.slice((match.index ?? 0) + match[0].length);
    const clauseActionIndex = clause.search(action);
    return (
      clauseActionIndex >= 0 &&
      ANYWAY_PATTERN.test(clause.slice(clauseActionIndex))
    );
  });
  return !(actionAfterTransition || actionBeforeAnyway);
};

const instructionSentences = (source: string): string[] =>
  source
    .replace(BACKTICK_FENCE_PATTERN, " ")
    .replace(TILDE_FENCE_PATTERN, " ")
    .replace(CANONICAL_SIGNATURE_PATTERN, " ")
    .split(SENTENCE_BOUNDARY_PATTERN)
    .map((sentence) => sentence.replace(NORMALIZED_SPACE_PATTERN, " ").trim())
    .filter(Boolean);

const hasConcreteAuthorization = (sentence: string): boolean =>
  !NEGATED_AUTHORIZATION_PATTERN.test(sentence) &&
  AUTHORIZATION_PATTERNS.some((pattern) => pattern.test(sentence));

const checkInstructionBoundaries = (
  context: ContractContext
): ContractFinding[] => {
  const findings: ContractFinding[] = [];
  for (const entry of markdownEntries(context)) {
    const sentences = instructionSentences(entry.text ?? "");
    const installedMutation = sentences.some(
      (sentence) =>
        INSTALLED_TARGET_PATTERN.test(sentence) &&
        MUTATION_ACTION_PATTERN.test(sentence) &&
        !isProhibition(sentence, MUTATION_ACTION_PATTERN)
    );
    if (installedMutation) {
      findings.push(
        finding(
          "INSTALLED_SKILL_SELF_MODIFICATION",
          entry.path,
          "Instructions must store guidance state in the repository, not modify an installed skill copy"
        )
      );
    }

    const implicitUi = sentences.some(
      (sentence) =>
        UI_TARGET_PATTERN.test(sentence) &&
        UI_ACTION_PATTERN.test(sentence) &&
        !isProhibition(sentence, UI_ACTION_PATTERN) &&
        !hasConcreteAuthorization(sentence)
    );
    if (implicitUi) {
      findings.push(
        finding(
          "IMPLICIT_UI_CREATION",
          entry.path,
          "New release-note UI requires explicit current-request or documented stored-policy authorization"
        )
      );
    }
  }
  return findings;
};

const isScopedCorePath = (path: string): boolean =>
  path === "SKILL.md" ||
  path === "EVAL.md" ||
  path.startsWith("references/") ||
  path.startsWith("evals/") ||
  (path.startsWith("scripts/") && !path.startsWith("scripts/adapters/"));

const isVendorAdapterPath = (path: string): boolean =>
  path.startsWith("scripts/adapters/") ||
  path === "scripts/tests/adapters.check.ts";

// Skill loaders may scan installed directories recursively, so the package
// must expose exactly one discoverable SKILL.md: the root skill itself.
// Evaluation fixtures store theirs as SKILL.fixture.md instead.
const checkNestedSkillFiles = (context: ContractContext): ContractFinding[] =>
  Array.from(context.entries.values())
    .filter(
      (entry) =>
        entry.path !== "SKILL.md" && basename(entry.path) === "SKILL.md"
    )
    .map((entry) =>
      finding(
        "NESTED_SKILL_FILE",
        entry.path,
        `Installed packages must not contain a nested discoverable SKILL.md; rename fixture copies to SKILL.fixture.md: ${entry.path}`
      )
    );

const checkUnreadableCoreFiles = (
  context: ContractContext
): ContractFinding[] =>
  Array.from(context.entries.values())
    .filter(
      (entry) =>
        entry.kind === "file" && !entry.readable && isScopedCorePath(entry.path)
    )
    .map((entry) =>
      finding(
        "CORE_FILE_UNREADABLE",
        entry.path,
        `Scoped core file is not readable: ${entry.path}`
      )
    );

const checkVendorAssumptions = (
  context: ContractContext
): ContractFinding[] => {
  const patterns = [
    new RegExp(`\\b${["Co", "dex"].join("")}\\b`, "i"),
    new RegExp(`\\b${["Claude", " Code"].join("")}\\b`, "i"),
    new RegExp(`\\b${["Cur", "sor"].join("")}\\b`),
    new RegExp(`\\b${["Open", "AI"].join("")}\\b`, "i"),
    new RegExp(`\\b${["Anthro", "pic"].join("")}\\b`, "i"),
  ];
  return compact(
    Array.from(context.entries.values())
      .filter(
        (entry) =>
          entry.kind === "file" &&
          entry.readable &&
          isScopedCorePath(entry.path) &&
          !isVendorAdapterPath(entry.path)
      )
      .map((entry) => {
        const source = (entry.text ?? "").replace(
          CANONICAL_SIGNATURE_PATTERN,
          " "
        );
        return patterns.some((pattern) => pattern.test(source))
          ? finding(
              "VENDOR_ASSUMPTION",
              entry.path,
              "Core package file assumes a specific agent vendor"
            )
          : undefined;
      })
  );
};

const runPosixShellSyntaxCheck: ShellSyntaxCheck = async (scriptPath) => {
  const child = spawn(["sh", "-n", scriptPath], {
    stderr: "pipe",
    stdout: "ignore",
  });
  const [exitCode] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ]);
  return exitCode;
};

const checkShellSyntax = async (
  context: ContractContext,
  shellSyntaxCheck: ShellSyntaxCheck
): Promise<ContractFinding[]> => {
  const results = await Promise.all(
    Array.from(context.entries.values())
      .filter(
        (entry) =>
          entry.kind === "file" &&
          entry.readable &&
          entry.canonical &&
          entry.path.endsWith(".sh")
      )
      .map(async (entry) => {
        try {
          const exitCode = await shellSyntaxCheck(
            join(context.root, entry.path)
          );
          return exitCode === 0
            ? undefined
            : finding(
                "SHELL_SYNTAX_INVALID",
                entry.path,
                `POSIX shell syntax check failed for ${entry.path}`
              );
        } catch (error) {
          throw new ContractConfigurationError(
            "Could not start POSIX shell syntax checker: sh -n",
            { cause: error }
          );
        }
      })
  );
  return compact(results);
};

const checkManifest = (context: ContractContext): ContractFinding[] => {
  const entry = context.entries.get("evals/cases.json");
  if (entry?.kind !== "file" || !entry.readable) {
    return [];
  }
  let input: unknown;
  try {
    input = JSON.parse(entry.text ?? "");
  } catch (error) {
    return [
      finding(
        "EVAL_MANIFEST_INVALID",
        entry.path,
        `Evaluation manifest is not JSON: ${error instanceof Error ? error.message : String(error)}`
      ),
    ];
  }
  const result = validateManifest(input);
  return result.ok
    ? []
    : [
        finding(
          "EVAL_MANIFEST_INVALID",
          entry.path,
          `Evaluation manifest is invalid: ${result.errors.join("; ")}`
        ),
      ];
};

const lexicalCompare = (
  left: ContractFinding,
  right: ContractFinding
): number => {
  const leftKey = `${left.path}\0${left.code}\0${left.message}`;
  const rightKey = `${right.path}\0${right.code}\0${right.message}`;
  if (leftKey < rightKey) {
    return -1;
  }
  return leftKey > rightKey ? 1 : 0;
};

export const evaluateContracts = async (
  skillDirectory: string,
  options: ContractEvaluationOptions = {}
): Promise<ContractFinding[]> => {
  const context = await createContractContext(skillDirectory);
  const checks = await Promise.all([
    checkFrontmatter(context),
    checkBundleEntries(context),
    checkRoutedFiles(context),
    checkPolicyExample(context),
    checkGuidanceCoverage(context),
    checkProseDuplication(context),
    checkInstructionBoundaries(context),
    checkNestedSkillFiles(context),
    checkUnreadableCoreFiles(context),
    checkVendorAssumptions(context),
    checkShellSyntax(
      context,
      options.shellSyntaxCheck ?? runPosixShellSyntaxCheck
    ),
    checkManifest(context),
  ]);
  return checks.flat().sort(lexicalCompare);
};
