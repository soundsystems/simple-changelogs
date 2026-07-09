import type { Dirent, Stats } from "node:fs";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";

export type EntryKind = "directory" | "file" | "other" | "symlink";

export interface SkillEntry {
  canonical: boolean;
  kind: EntryKind;
  path: string;
  readable: boolean;
  text?: string;
}

export interface ContractContext {
  entries: Map<string, SkillEntry>;
  root: string;
}

export class ContractConfigurationError extends Error {
  readonly kind = "configuration";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ContractConfigurationError";
  }
}

export const isContained = (root: string, candidate: string): boolean => {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot)
  );
};

const configurationError = (path: string, error: unknown): never => {
  throw new ContractConfigurationError(
    `Skill directory is not readable: ${path}`,
    error instanceof Error ? { cause: error } : undefined
  );
};

const readDirectory = async (path: string): Promise<Dirent[]> => {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    return configurationError(path, error);
  }
};

const inspectEntry = async (
  root: string,
  fullPath: string,
  localPath: string
): Promise<SkillEntry> => {
  let metadata: Stats;
  try {
    metadata = await lstat(fullPath);
  } catch (error) {
    return configurationError(fullPath, error);
  }
  if (metadata.isSymbolicLink()) {
    return {
      canonical: false,
      kind: "symlink",
      path: localPath,
      readable: false,
    };
  }

  let canonicalPath: string;
  try {
    canonicalPath = await realpath(fullPath);
  } catch (error) {
    return configurationError(fullPath, error);
  }
  const canonical = isContained(root, canonicalPath);
  if (metadata.isDirectory()) {
    return { canonical, kind: "directory", path: localPath, readable: true };
  }
  if (!metadata.isFile()) {
    return { canonical, kind: "other", path: localPath, readable: false };
  }
  try {
    return {
      canonical,
      kind: "file",
      path: localPath,
      readable: true,
      text: await readFile(fullPath, "utf8"),
    };
  } catch {
    return {
      canonical,
      kind: "file",
      path: localPath,
      readable: false,
    };
  }
};

const walkEntries = async (
  root: string,
  directory: string,
  prefix = ""
): Promise<SkillEntry[]> => {
  const children = await readDirectory(directory);
  const nested = await Promise.all(
    children.map(async (child) => {
      const localPath = prefix ? `${prefix}/${child.name}` : child.name;
      const fullPath = join(directory, child.name);
      const entry = await inspectEntry(root, fullPath, localPath);
      if (entry.kind !== "directory" || !entry.canonical) {
        return [entry];
      }
      return [entry, ...(await walkEntries(root, fullPath, localPath))];
    })
  );
  return nested.flat();
};

export const createContractContext = async (
  skillDirectory: string
): Promise<ContractContext> => {
  let rootMetadata: Stats;
  try {
    rootMetadata = await lstat(skillDirectory);
  } catch (error) {
    throw new ContractConfigurationError(
      `Skill directory does not exist: ${skillDirectory}`,
      { cause: error }
    );
  }
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new ContractConfigurationError(
      `Skill directory must be a real directory, not a file or symlink: ${skillDirectory}`
    );
  }

  let root: string;
  try {
    root = await realpath(skillDirectory);
  } catch (error) {
    return configurationError(skillDirectory, error);
  }
  const entries = await walkEntries(root, root);
  return {
    entries: new Map(entries.map((entry) => [entry.path, entry])),
    root,
  };
};

export const entryText = (context: ContractContext, path: string): string =>
  context.entries.get(path)?.text ?? "";

export const markdownEntries = (context: ContractContext): SkillEntry[] =>
  Array.from(context.entries.values()).filter(
    (entry) =>
      entry.kind === "file" &&
      entry.readable &&
      entry.path.endsWith(".md") &&
      (entry.path === "SKILL.md" ||
        entry.path === "EVAL.md" ||
        entry.path.startsWith("references/"))
  );
