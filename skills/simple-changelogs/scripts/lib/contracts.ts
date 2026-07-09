import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { spawn } from "bun";
import { validateManifest, validateRepoPolicy } from "./validate.ts";

export interface ContractFinding {
  code: string;
  message: string;
  path: string;
}

const REQUIRED_BUNDLED_FILES = [
  "EVAL.md",
  "evals/cases.json",
  "evals/schemas/eval-manifest.schema.json",
  "evals/schemas/repo-policy.schema.json",
  "evals/schemas/runner-request.schema.json",
  "evals/schemas/runner-response.schema.json",
  "references/guidance-updates.md",
  "references/setup.md",
  "scripts/check-fork-sync.sh",
  "scripts/eval.ts",
] as const;

const PROSE_SEQUENCE_LENGTH = 18;
const FRONTMATTER_BLOCK_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const FRONTMATTER_ONLY_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const NEWLINE_PATTERN = /\r?\n/;
const FRONTMATTER_FIELD_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.+)$/;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BACKTICK_FENCE_PATTERN = /```[\s\S]*?```/g;
const TILDE_FENCE_PATTERN = /~~~[\s\S]*?~~~/g;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const INLINE_CODE_PATTERN = /`[^`\r\n]*`/g;
const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\([^)]*\)/g;
const NORMALIZED_WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const ROUTED_PATH_PATTERN =
  /(?:references|scripts|evals)\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*/g;
const JSON_FENCE_PATTERN = /```json\s*\r?\n([\s\S]*?)```/gi;
const GUIDANCE_VERSION_PATTERN = /Current guidance version:\s*(\d+)/i;
const GUIDANCE_HEADING_PATTERN =
  /^#{1,6}\s+(?:Guidance\s+)?Version\s+(\d+)\b/gim;
const INSTALLED_MODIFICATION_PATTERN =
  /\b(?:remove|delete|edit|modify|rewrite|update|write(?:\s+to)?|mutate)\b.{0,160}\b(?:installed|globally[- ]installed)\b.{0,80}\b(?:skill|copy|directory|file)\b/i;
const UI_CREATION_PATTERN =
  /\b(?:create|add|build|wire)(?:s|ed|ing)?\b.{0,120}\b(?:release[- ]note|what(?:'|’)s new|changelog|internal)\b.{0,80}\b(?:surface|ui|modal|route|page|screen|panel)\b/i;
const NORMALIZED_SPACE_PATTERN = /\s+/g;
const SENTENCE_BOUNDARY_PATTERN = /(?<=[.!?])\s+|\n+/;
const UI_AUTHORIZATION_PATTERN =
  /\b(?:do not|does not|never|must not|without|authoriz\w*|explicit(?:ly)?\s+(?:requested|approved)|permission|policy\s+(?:is\s+)?allow)\b/i;

const normalizePath = (path: string): string => path.split(sep).join("/");

const isFile = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

const walkFiles = async (directory: string): Promise<string[]> => {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(path);
      }
      return Promise.resolve(entry.isFile() ? [path] : []);
    })
  );
  return nested.flat();
};

const finding = (
  code: string,
  path: string,
  message: string
): ContractFinding => ({ code, message, path });

const compact = <Value>(values: (Value | undefined)[]): Value[] =>
  values.filter((value): value is Value => value !== undefined);

interface Frontmatter {
  description?: string;
  name?: string;
}

const parseFrontmatter = (
  source: string
): { errors: string[]; frontmatter: Frontmatter } => {
  const match = FRONTMATTER_BLOCK_PATTERN.exec(source);
  if (!match?.[1]) {
    return {
      errors: ["SKILL.md must start with a closed frontmatter block"],
      frontmatter: {},
    };
  }

  const frontmatter: Frontmatter = {};
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const line of match[1].split(NEWLINE_PATTERN)) {
    if (!line.trim()) {
      continue;
    }
    const field = FRONTMATTER_FIELD_PATTERN.exec(line);
    if (!(field?.[1] && field[2])) {
      errors.push(`Invalid frontmatter line: ${line}`);
      continue;
    }
    const [, key] = field;
    if (seen.has(key)) {
      errors.push(`Duplicate frontmatter field: ${key}`);
      continue;
    }
    seen.add(key);
    if (key === "description" || key === "name") {
      frontmatter[key] = field[2].trim();
    }
  }

  if (!frontmatter.name) {
    errors.push("Frontmatter name must be a non-empty string");
  } else if (!SKILL_NAME_PATTERN.test(frontmatter.name)) {
    errors.push("Frontmatter name must use lowercase kebab-case");
  }
  if (!frontmatter.description) {
    errors.push("Frontmatter description must be a non-empty string");
  }

  return { errors, frontmatter };
};

const stripFencedSyntax = (source: string): string =>
  source
    .replace(FRONTMATTER_ONLY_PATTERN, "")
    .replace(BACKTICK_FENCE_PATTERN, " ")
    .replace(TILDE_FENCE_PATTERN, " ")
    .replace(HTML_COMMENT_PATTERN, " ")
    .replace(INLINE_CODE_PATTERN, " ")
    .replace(MARKDOWN_LINK_PATTERN, " ");

const normalizedWords = (source: string): string[] =>
  Array.from(
    stripFencedSyntax(source)
      .toLocaleLowerCase()
      .matchAll(NORMALIZED_WORD_PATTERN),
    (match) => match[0]
  );

const proseSequences = (source: string): Map<string, string> => {
  const words = normalizedWords(source);
  const sequences = new Map<string, string>();
  for (
    let index = 0;
    index <= words.length - PROSE_SEQUENCE_LENGTH;
    index += 1
  ) {
    const sequence = words
      .slice(index, index + PROSE_SEQUENCE_LENGTH)
      .join(" ");
    sequences.set(sequence, sequence);
  }
  return sequences;
};

const routedPaths = (source: string): string[] =>
  Array.from(source.matchAll(ROUTED_PATH_PATTERN), (match) => match[0]);

const markdownFiles = (files: string[], skillDirectory: string): string[] =>
  files.filter((path) => {
    const localPath = normalizePath(relative(skillDirectory, path));
    return (
      path.endsWith(".md") &&
      (localPath === "SKILL.md" ||
        localPath === "EVAL.md" ||
        localPath.startsWith("references/"))
    );
  });

const policyExamples = (
  source: string
): { contents: string; looksLikePolicy: boolean }[] =>
  Array.from(source.matchAll(JSON_FENCE_PATTERN), (match) => {
    const contents = match[1] ?? "";
    return {
      contents,
      looksLikePolicy:
        contents.includes('"schemaVersion"') && contents.includes('"guidance"'),
    };
  });

const checkFrontmatter = async (
  skillDirectory: string
): Promise<ContractFinding[]> => {
  const path = join(skillDirectory, "SKILL.md");
  if (!(await isFile(path))) {
    return [finding("FRONTMATTER_INVALID", "SKILL.md", "SKILL.md is missing")];
  }
  const source = await readFile(path, "utf8");
  const { errors, frontmatter } = parseFrontmatter(source);
  const findings = errors.map((message) =>
    finding("FRONTMATTER_INVALID", "SKILL.md", message)
  );
  if (frontmatter.name && frontmatter.name !== basename(skillDirectory)) {
    findings.push(
      finding(
        "SKILL_NAME_MISMATCH",
        "SKILL.md",
        `Frontmatter name ${frontmatter.name} does not match directory ${basename(skillDirectory)}`
      )
    );
  }
  return findings;
};

const checkBundledFiles = async (
  skillDirectory: string
): Promise<ContractFinding[]> => {
  const results = await Promise.all(
    REQUIRED_BUNDLED_FILES.map(async (path) => {
      if (await isFile(join(skillDirectory, path))) {
        return;
      }
      return finding(
        "BUNDLED_FILE_MISSING",
        path,
        `Required installed-package file is missing: ${path}`
      );
    })
  );
  return compact(results);
};

const checkRoutedFiles = async (
  skillDirectory: string,
  files: string[]
): Promise<ContractFinding[]> => {
  const results = await Promise.all(
    markdownFiles(files, skillDirectory).map(async (sourcePath) => {
      const source = await readFile(sourcePath, "utf8");
      const routedResults = await Promise.all(
        Array.from(new Set(routedPaths(source))).map(async (routedPath) => {
          if (await isFile(join(skillDirectory, routedPath))) {
            return;
          }
          return finding(
            "ROUTED_FILE_MISSING",
            normalizePath(relative(skillDirectory, sourcePath)),
            `Routed package path does not exist: ${routedPath}`
          );
        })
      );
      return compact(routedResults);
    })
  );
  return results.flat();
};

const checkPolicyExamples = async (
  skillDirectory: string,
  files: string[]
): Promise<ContractFinding[]> => {
  const results = await Promise.all(
    markdownFiles(files, skillDirectory).map(async (path) => {
      const source = await readFile(path, "utf8");
      const findings: ContractFinding[] = [];
      for (const example of policyExamples(source)) {
        if (!example.looksLikePolicy) {
          continue;
        }
        let input: unknown;
        try {
          input = JSON.parse(example.contents);
        } catch (error) {
          findings.push(
            finding(
              "POLICY_EXAMPLE_INVALID",
              normalizePath(relative(skillDirectory, path)),
              `Repository-policy example is not JSON: ${error instanceof Error ? error.message : String(error)}`
            )
          );
          continue;
        }
        const result = validateRepoPolicy(input);
        if (!result.ok) {
          findings.push(
            finding(
              "POLICY_EXAMPLE_INVALID",
              normalizePath(relative(skillDirectory, path)),
              `Repository-policy example is invalid: ${result.errors.join("; ")}`
            )
          );
        }
      }
      return findings;
    })
  );
  return results.flat();
};

const checkGuidanceCoverage = async (
  skillDirectory: string
): Promise<ContractFinding[]> => {
  const skillPath = join(skillDirectory, "SKILL.md");
  if (!(await isFile(skillPath))) {
    return [];
  }
  const skill = await readFile(skillPath, "utf8");
  const versionMatch = GUIDANCE_VERSION_PATTERN.exec(skill);
  if (!versionMatch?.[1]) {
    return [
      finding(
        "GUIDANCE_VERSION_MISSING",
        "SKILL.md",
        "SKILL.md must declare the current integer guidance version"
      ),
    ];
  }
  const currentVersion = Number.parseInt(versionMatch[1], 10);
  const updatesPath = join(skillDirectory, "references/guidance-updates.md");
  if (!(await isFile(updatesPath))) {
    return [];
  }
  const updates = await readFile(updatesPath, "utf8");
  const documented = new Set(
    Array.from(updates.matchAll(GUIDANCE_HEADING_PATTERN), (match) =>
      Number.parseInt(match[1] ?? "", 10)
    )
  );
  const findings: ContractFinding[] = [];
  for (let version = 1; version <= currentVersion; version += 1) {
    if (!documented.has(version)) {
      findings.push(
        finding(
          "GUIDANCE_VERSION_UNDOCUMENTED",
          "references/guidance-updates.md",
          `Guidance version ${version} has no update entry`
        )
      );
    }
  }
  return findings;
};

const checkProseDuplication = async (
  skillDirectory: string,
  files: string[]
): Promise<ContractFinding[]> => {
  const skillPath = join(skillDirectory, "SKILL.md");
  if (!(await isFile(skillPath))) {
    return [];
  }
  const skillSequences = proseSequences(await readFile(skillPath, "utf8"));
  const references = files.filter((path) =>
    normalizePath(relative(skillDirectory, path)).startsWith("references/")
  );
  const findings = await Promise.all(
    references.map(async (path) => {
      const referenceSequences = proseSequences(await readFile(path, "utf8"));
      const duplicate = Array.from(referenceSequences.keys()).find((sequence) =>
        skillSequences.has(sequence)
      );
      if (!duplicate) {
        return;
      }
      return finding(
        "PROSE_DUPLICATION",
        normalizePath(relative(skillDirectory, path)),
        `Duplicates ${PROSE_SEQUENCE_LENGTH}-word SKILL.md prose: “${duplicate}”`
      );
    })
  );
  return compact(findings);
};

const checkInstructionBoundaries = async (
  skillDirectory: string,
  files: string[]
): Promise<ContractFinding[]> => {
  const results = await Promise.all(
    markdownFiles(files, skillDirectory).map(async (path) => {
      const localPath = normalizePath(relative(skillDirectory, path));
      const prose = stripFencedSyntax(await readFile(path, "utf8")).replace(
        NORMALIZED_SPACE_PATTERN,
        " "
      );
      const findings: ContractFinding[] = [];
      if (INSTALLED_MODIFICATION_PATTERN.test(prose)) {
        findings.push(
          finding(
            "INSTALLED_SKILL_SELF_MODIFICATION",
            localPath,
            "Instructions must store guidance state in the repository, not modify an installed skill copy"
          )
        );
      }

      const sentences = prose.split(SENTENCE_BOUNDARY_PATTERN);
      const implicitUi = sentences.find((sentence) => {
        if (!UI_CREATION_PATTERN.test(sentence)) {
          return false;
        }
        return !UI_AUTHORIZATION_PATTERN.test(sentence);
      });
      if (implicitUi) {
        findings.push(
          finding(
            "IMPLICIT_UI_CREATION",
            localPath,
            "New release-note UI requires explicit task or repository authorization"
          )
        );
      }
      return findings;
    })
  );
  return results.flat();
};

const isVendorScanPath = (path: string): boolean => {
  if (path === "SKILL.md" || path === "EVAL.md") {
    return true;
  }
  if (path.startsWith("references/") || path.startsWith("evals/")) {
    return true;
  }
  return (
    path.startsWith("scripts/") &&
    !path.startsWith("scripts/adapters/") &&
    !path.startsWith("scripts/tests/")
  );
};

const checkVendorAssumptions = async (
  skillDirectory: string,
  files: string[]
): Promise<ContractFinding[]> => {
  const markers = [
    ["Co", "dex"].join(""),
    ["Claude", " Code"].join(""),
    ["Cur", "sor"].join(""),
    ["Open", "AI"].join(""),
    ["Anthro", "pic"].join(""),
  ];
  const pattern = new RegExp(`\\b(?:${markers.join("|")})\\b`, "i");
  const findings = await Promise.all(
    files.map(async (path) => {
      const localPath = normalizePath(relative(skillDirectory, path));
      if (!isVendorScanPath(localPath)) {
        return;
      }
      const source = (await readFile(path, "utf8")).replace(
        HTML_COMMENT_PATTERN,
        " "
      );
      if (!pattern.test(source)) {
        return;
      }
      return finding(
        "VENDOR_ASSUMPTION",
        localPath,
        "Core package file assumes a specific agent vendor"
      );
    })
  );
  return compact(findings);
};

const checkShellSyntax = async (
  skillDirectory: string,
  files: string[]
): Promise<ContractFinding[]> => {
  const findings = await Promise.all(
    files
      .filter((candidate) => candidate.endsWith(".sh"))
      .map(async (path) => {
        const localPath = normalizePath(relative(skillDirectory, path));
        try {
          const child = spawn(["sh", "-n", path], {
            stderr: "pipe",
            stdout: "pipe",
          });
          const [exitCode, stderr] = await Promise.all([
            child.exited,
            new Response(child.stderr).text(),
          ]);
          if (exitCode !== 0) {
            return finding(
              "SHELL_SYNTAX_INVALID",
              localPath,
              stderr.trim() || `sh -n exited with status ${exitCode}`
            );
          }
        } catch (error) {
          return finding(
            "SHELL_SYNTAX_INVALID",
            localPath,
            `Could not check shell syntax: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
  );
  return compact(findings);
};

const checkManifest = async (
  skillDirectory: string
): Promise<ContractFinding[]> => {
  const path = join(skillDirectory, "evals/cases.json");
  if (!(await isFile(path))) {
    return [];
  }
  let input: unknown;
  try {
    input = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    return [
      finding(
        "EVAL_MANIFEST_INVALID",
        "evals/cases.json",
        `Evaluation manifest is not JSON: ${error instanceof Error ? error.message : String(error)}`
      ),
    ];
  }
  const result = validateManifest(input);
  if (result.ok) {
    return [];
  }
  return [
    finding(
      "EVAL_MANIFEST_INVALID",
      "evals/cases.json",
      `Evaluation manifest is invalid: ${result.errors.join("; ")}`
    ),
  ];
};

export const evaluateContracts = async (
  skillDirectory: string
): Promise<ContractFinding[]> => {
  const files = await walkFiles(skillDirectory);
  const checks = await Promise.all([
    checkFrontmatter(skillDirectory),
    checkBundledFiles(skillDirectory),
    checkRoutedFiles(skillDirectory, files),
    checkPolicyExamples(skillDirectory, files),
    checkGuidanceCoverage(skillDirectory),
    checkProseDuplication(skillDirectory, files),
    checkInstructionBoundaries(skillDirectory, files),
    checkVendorAssumptions(skillDirectory, files),
    checkShellSyntax(skillDirectory, files),
    checkManifest(skillDirectory),
  ]);

  return checks
    .flat()
    .sort((left, right) =>
      `${left.path}\0${left.code}\0${left.message}`.localeCompare(
        `${right.path}\0${right.code}\0${right.message}`
      )
    );
};
