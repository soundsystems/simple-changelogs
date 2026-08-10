import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const BACKFILL_STATUSES = new Set([
  "not-applicable",
  "completed",
  "declined",
  "deferred",
  "partial",
  "failed",
]);
const SURFACE_POLICIES = new Set(["ask", "allow", "existing-only"]);
const ENTRY_KINDS = new Set(["release", "backfill"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATH_SEPARATOR_PATTERN = /[\\/]/u;

export interface CmsChangelogEntry {
  changes: string[];
  date: string;
  id: string;
  kind: "backfill" | "release";
  summary: string;
  title: string;
  version?: string;
}

export interface CmsChangelog {
  entries: CmsChangelogEntry[];
  schemaVersion: 1;
  title: string;
}

export interface CmsChangelogPolicy {
  changelogPath: string;
  cmsSurface: {
    access: "authenticated-operators";
    route: string;
  };
  guidance: {
    backfillStatus: string;
    version: 1;
  };
  newReleaseNoteSurfaces: "allow" | "ask" | "existing-only";
  schemaVersion: 1;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = []
): boolean => {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isValidDate = (value: unknown): value is string => {
  if (!(typeof value === "string" && DATE_PATTERN.test(value))) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value)
  );
};

const validateEntry = (
  value: unknown,
  index: number
): { entry?: CmsChangelogEntry; errors: string[] } => {
  const prefix = `entries[${index}]`;
  if (!isRecord(value)) {
    return { errors: [`${prefix} must be an object`] };
  }
  const required = ["id", "date", "kind", "title", "summary", "changes"];
  if (!hasExactKeys(value, required, ["version"])) {
    return { errors: [`${prefix} has missing or unknown fields`] };
  }

  const errors: string[] = [];
  if (!(isNonEmptyString(value.id) && ENTRY_ID_PATTERN.test(value.id))) {
    errors.push(`${prefix}.id must be a lowercase kebab-case identifier`);
  }
  if (!isValidDate(value.date)) {
    errors.push(`${prefix}.date must be a real YYYY-MM-DD date`);
  }
  if (!(typeof value.kind === "string" && ENTRY_KINDS.has(value.kind))) {
    errors.push(`${prefix}.kind must be release or backfill`);
  }
  if (!isNonEmptyString(value.title)) {
    errors.push(`${prefix}.title must be a non-empty string`);
  }
  if (!isNonEmptyString(value.summary)) {
    errors.push(`${prefix}.summary must be a non-empty string`);
  }
  if (
    !(
      Array.isArray(value.changes) &&
      value.changes.length > 0 &&
      value.changes.every(isNonEmptyString)
    )
  ) {
    errors.push(`${prefix}.changes must contain non-empty strings`);
  }
  if (value.version !== undefined && !isNonEmptyString(value.version)) {
    errors.push(`${prefix}.version must be a non-empty string when present`);
  }

  return errors.length === 0
    ? { entry: value as unknown as CmsChangelogEntry, errors }
    : { errors };
};

export const validateCmsChangelog = (
  value: unknown
): { data?: CmsChangelog; errors: string[] } => {
  if (!isRecord(value)) {
    return { errors: ["CMS changelog must be an object"] };
  }
  if (!hasExactKeys(value, ["schemaVersion", "title", "entries"])) {
    return { errors: ["CMS changelog has missing or unknown fields"] };
  }

  const errors: string[] = [];
  if (value.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (!isNonEmptyString(value.title)) {
    errors.push("title must be a non-empty string");
  }
  if (!Array.isArray(value.entries)) {
    errors.push("entries must be an array");
    return { errors };
  }

  const entries: CmsChangelogEntry[] = [];
  for (const [index, candidate] of value.entries.entries()) {
    const result = validateEntry(candidate, index);
    errors.push(...result.errors);
    if (result.entry) {
      entries.push(result.entry);
    }
  }

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      errors.push(`entry id ${entry.id} is duplicated`);
    }
    ids.add(entry.id);
  }
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    if (previous && current && previous.date < current.date) {
      errors.push("entries must be ordered newest-first by date");
      break;
    }
  }

  return errors.length === 0
    ? {
        data: {
          entries,
          schemaVersion: 1,
          title: value.title as string,
        },
        errors,
      }
    : { errors };
};

export const validateCmsPolicy = (
  value: unknown
): { data?: CmsChangelogPolicy; errors: string[] } => {
  if (!isRecord(value)) {
    return { errors: ["CMS changelog policy must be an object"] };
  }
  if (
    !hasExactKeys(value, [
      "schemaVersion",
      "guidance",
      "changelogPath",
      "cmsSurface",
      "newReleaseNoteSurfaces",
    ])
  ) {
    return { errors: ["CMS changelog policy has missing or unknown fields"] };
  }

  const errors: string[] = [];
  if (value.schemaVersion !== 1) {
    errors.push("policy schemaVersion must be 1");
  }
  if (
    !(
      isRecord(value.guidance) &&
      hasExactKeys(value.guidance, ["version", "backfillStatus"]) &&
      Number.isInteger(value.guidance.version) &&
      (value.guidance.version as number) >= 1 &&
      typeof value.guidance.backfillStatus === "string" &&
      BACKFILL_STATUSES.has(value.guidance.backfillStatus)
    )
  ) {
    errors.push(
      "guidance must contain a positive version and a supported backfillStatus"
    );
  }
  if (
    !(
      isNonEmptyString(value.changelogPath) &&
      value.changelogPath.endsWith(".json") &&
      !isAbsolute(value.changelogPath) &&
      !value.changelogPath.split(PATH_SEPARATOR_PATTERN).includes("..")
    )
  ) {
    errors.push("changelogPath must be a contained relative JSON path");
  }
  if (
    !(
      isRecord(value.cmsSurface) &&
      hasExactKeys(value.cmsSurface, ["route", "access"]) &&
      isNonEmptyString(value.cmsSurface.route) &&
      value.cmsSurface.route.startsWith("/") &&
      value.cmsSurface.route !== "/" &&
      value.cmsSurface.access === "authenticated-operators"
    )
  ) {
    errors.push(
      "cmsSurface must name a non-root route for authenticated operators"
    );
  }
  if (
    !(
      typeof value.newReleaseNoteSurfaces === "string" &&
      SURFACE_POLICIES.has(value.newReleaseNoteSurfaces)
    )
  ) {
    errors.push("newReleaseNoteSurfaces is unsupported");
  }

  return errors.length === 0
    ? { data: value as unknown as CmsChangelogPolicy, errors }
    : { errors };
};

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8")) as unknown;

export const validateRepository = async (root: string): Promise<string[]> => {
  const resolvedRoot = resolve(root);
  const policyPath = resolve(resolvedRoot, ".simple-changelogs-cms.json");
  let policyInput: unknown;
  try {
    policyInput = await readJson(policyPath);
  } catch (error) {
    return [
      `Could not read ${policyPath}: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }

  const policy = validateCmsPolicy(policyInput);
  if (!policy.data) {
    return policy.errors.map((error) => `policy: ${error}`);
  }

  const changelogPath = resolve(resolvedRoot, policy.data.changelogPath);
  const relativePath = relative(resolvedRoot, changelogPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return ["policy: changelogPath escapes the repository root"];
  }

  let changelogInput: unknown;
  try {
    changelogInput = await readJson(changelogPath);
  } catch (error) {
    return [
      `Could not read ${changelogPath}: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  return validateCmsChangelog(changelogInput).errors.map(
    (error) => `changelog: ${error}`
  );
};
