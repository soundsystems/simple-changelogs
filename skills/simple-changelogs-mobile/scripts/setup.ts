#!/usr/bin/env bun

import { type Dirent, existsSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
} from "node:fs/promises";
import { homedir, platform } from "node:os";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

const BACKFILL_STATUSES = [
  "not-applicable",
  "completed",
  "declined",
  "deferred",
  "partial",
  "failed",
] as const;
const DEVELOPER_CHANGELOG_POLICIES = ["required", "optional"] as const;
const DISTRIBUTIONS = [
  "full",
  "web",
  "mobile",
  "web-cms",
  "skill-repository",
] as const;
const SIGNATURE_POLICIES = ["agent-and-timestamp", "none"] as const;
const SURFACE_POLICIES = ["ask", "allow", "existing-only"] as const;
const MOBILE_RELEASE_NOTE_PLACEMENTS = [
  "web-tabs",
  "web-page",
  "mobile-only",
] as const;
const SETUP_STYLES = ["recommended", "customized"] as const;
const SCOPES = ["repository", "all-projects", "run-only"] as const;
const TASK_MODES = ["write", "read"] as const;
const POLICY_FILENAME = ".simple-changelogs.json";
const CMS_POLICY_FILENAME = ".simple-changelogs-cms.json";
const DEFAULT_CMS_CHANGELOG = "CMS_CHANGELOG.json";
const SETUP_TRANSACTION_FILENAME = ".simple-changelogs.setup-transaction.json";
const NON_DESTINATION_FILES = new Set([
  POLICY_FILENAME,
  CMS_POLICY_FILENAME,
  SETUP_TRANSACTION_FILENAME,
]);
const RELEASE_HEADING =
  /^##\s+(?!\[?unreleased(?:\]|$)|pending(?:\s|$))(?=\S).+$/gimu;
const RELEASE_DESTINATION_PATH = /(?:what.?s.?new|release.?notes?|changelog)/u;
const CMS_PATH = /(?:^|\/)(?:admin|cms)(?:\/|$)/u;
const AUTH_RELATED_PATH = /(?:route|page|middleware|auth|session|guard)/u;
const AUTH_RELATED_CONTENT =
  /\b(?:authenticated|auth|session|operator|requireAuth|withAuth)\b/iu;
const WEB_DEPENDENCIES = new Set([
  "@angular/core",
  "@remix-run/react",
  "astro",
  "next",
  "nuxt",
  "react",
  "svelte",
  "vite",
  "vue",
]);
const MOBILE_DEPENDENCIES = new Set([
  "@capacitor/core",
  "@ionic/react",
  "expo",
  "react-native",
]);
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".svelte",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".yaml",
  ".yml",
]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
]);

type BackfillStatus = (typeof BACKFILL_STATUSES)[number];
type DeveloperChangelogPolicy = (typeof DEVELOPER_CHANGELOG_POLICIES)[number];
type Distribution = (typeof DISTRIBUTIONS)[number];
type SignaturePolicy = (typeof SIGNATURE_POLICIES)[number];
type SurfacePolicy = (typeof SURFACE_POLICIES)[number];
type MobileReleaseNotePlacement =
  (typeof MOBILE_RELEASE_NOTE_PLACEMENTS)[number];
type SetupStyle = (typeof SETUP_STYLES)[number];
type PreferenceScope = (typeof SCOPES)[number];
type TaskMode = (typeof TASK_MODES)[number];
type PolicyState = "absent" | "valid" | "malformed";
type SetupStatus =
  | "already-configured"
  | "blocked"
  | "configured"
  | "needs-input"
  | "ready"
  | "run-only";

const GUIDANCE_VERSIONS = {
  full: 6,
  mobile: 5,
  "skill-repository": 4,
  web: 5,
  "web-cms": 5,
} as const satisfies Record<Distribution, number>;

interface RepoPolicy {
  developerChangelog: DeveloperChangelogPolicy;
  distribution?: Distribution;
  guidance: {
    backfillStatus: BackfillStatus;
    version: number;
  };
  mobileReleaseNotePlacement?: MobileReleaseNotePlacement;
  newReleaseNoteSurfaces: SurfacePolicy;
  schemaVersion: 1;
  signatures: SignaturePolicy;
}

interface CmsPolicy {
  changelogPath: string;
  cmsSurface: {
    access: "authenticated-operators";
    route: string;
  };
  guidance: {
    backfillStatus: BackfillStatus;
    version: 1;
  };
  newReleaseNoteSurfaces: SurfacePolicy;
  schemaVersion: 1;
}

export interface GlobalPreferences {
  developerChangelog: DeveloperChangelogPolicy;
  newReleaseNoteSurfaces: SurfacePolicy;
  profile: "solo-developer";
  schemaVersion: 1;
  setupStyle: SetupStyle;
  signatures: SignaturePolicy;
}

interface StateRecord<T> {
  errors: string[];
  path: string;
  state: PolicyState;
  value?: T;
}

interface Detection {
  confidence: "conflict" | "high" | "low" | "medium";
  distribution: Distribution | "cms" | null;
  evidence: string[];
}

interface Inventory {
  changelogs: {
    exists: boolean;
    path: string;
    releasedHeadings: number;
  }[];
  cmsEvidence: string[];
  destinations: string[];
  developerHistoryEvidence: string[];
  releasedHistoryCount: number;
}

interface Recommendation {
  cmsPolicy: CmsPolicy | null;
  policy: RepoPolicy | null;
  reusableDefaults: GlobalPreferences;
}

interface Selection {
  backfillStatus?: BackfillStatus;
  developerChangelog?: DeveloperChangelogPolicy;
  mobileReleaseNotePlacement?: MobileReleaseNotePlacement;
  newReleaseNoteSurfaces?: SurfacePolicy;
  scope?: PreferenceScope;
  setupStyle?: SetupStyle;
  signatures?: SignaturePolicy;
}

type CompleteSelection = Required<
  Omit<Selection, "mobileReleaseNotePlacement">
> &
  Pick<Selection, "mobileReleaseNotePlacement">;

interface WriteRecord {
  kind:
    | "changelog"
    | "cms-changelog"
    | "cms-policy"
    | "developer-changelog"
    | "global-preferences"
    | "repository-policy";
  path: string;
  written: boolean;
}

export interface SetupResult {
  cmsPolicy: StateRecord<CmsPolicy> | null;
  command: "apply" | "inspect";
  detection: Detection;
  errors: string[];
  globalPreferences: StateRecord<GlobalPreferences>;
  inventory: Inventory;
  onboardingRequired: boolean;
  policy: StateRecord<RepoPolicy> | null;
  recommendation: Recommendation;
  repository: string;
  schemaVersion: 1;
  selection: Selection;
  status: SetupStatus;
  summary: string;
  unresolvedQuestions: string[];
  writeCapable: boolean;
  writes: WriteRecord[];
}

export interface InspectOptions {
  configDirectory?: string;
  distribution?: Distribution | "cms";
  repo: string;
  taskMode?: TaskMode;
}

export interface ApplyOptions extends InspectOptions {
  auditVerified?: boolean;
  backfillStatus?: BackfillStatus;
  cmsAuthProven?: boolean;
  cmsChangelog?: string;
  cmsRoute?: string;
  cmsSurfaceProven?: boolean;
  confirm?: boolean;
  developerChangelog?: DeveloperChangelogPolicy;
  mobileReleaseNotePlacement?: MobileReleaseNotePlacement;
  newReleaseNoteSurfaces?: SurfacePolicy;
  scope?: PreferenceScope;
  setupStyle?: SetupStyle;
  signatures?: SignaturePolicy;
}

interface CandidateWrite {
  content: string;
  kind: WriteRecord["kind"];
  mode: number;
  path: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean => {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
};

const oneOf = <T extends string>(
  value: unknown,
  values: readonly T[]
): value is T => typeof value === "string" && values.includes(value as T);

const stringifyError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const validateRepoPolicy = (
  value: unknown
): { errors: string[]; value?: RepoPolicy } => {
  if (
    !(
      isRecord(value) &&
      hasExactKeys(
        value,
        [
          "schemaVersion",
          "guidance",
          "developerChangelog",
          "signatures",
          "newReleaseNoteSurfaces",
        ],
        ["distribution", "mobileReleaseNotePlacement"]
      )
    )
  ) {
    return { errors: ["repository policy has missing or unknown fields"] };
  }
  const errors: string[] = [];
  if (value.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (
    value.distribution !== undefined &&
    !oneOf(value.distribution, DISTRIBUTIONS)
  ) {
    errors.push("distribution is unsupported");
  }
  if (!oneOf(value.developerChangelog, DEVELOPER_CHANGELOG_POLICIES)) {
    errors.push("developerChangelog is unsupported");
  }
  if (!oneOf(value.signatures, SIGNATURE_POLICIES)) {
    errors.push("signatures is unsupported");
  }
  if (!oneOf(value.newReleaseNoteSurfaces, SURFACE_POLICIES)) {
    errors.push("newReleaseNoteSurfaces is unsupported");
  }
  if (
    value.mobileReleaseNotePlacement !== undefined &&
    !oneOf(value.mobileReleaseNotePlacement, MOBILE_RELEASE_NOTE_PLACEMENTS)
  ) {
    errors.push("mobileReleaseNotePlacement is unsupported");
  }
  if (
    !(
      isRecord(value.guidance) &&
      hasExactKeys(value.guidance, ["version", "backfillStatus"]) &&
      Number.isInteger(value.guidance.version) &&
      (value.guidance.version as number) >= 1 &&
      oneOf(value.guidance.backfillStatus, BACKFILL_STATUSES)
    )
  ) {
    errors.push(
      "guidance must contain a positive version and supported backfillStatus"
    );
  }
  if (
    isRecord(value.guidance) &&
    typeof value.guidance.version === "number" &&
    value.guidance.version >= GUIDANCE_VERSIONS.full &&
    (value.distribution === undefined || value.distribution === "full") &&
    value.mobileReleaseNotePlacement === undefined
  ) {
    errors.push(
      "mobileReleaseNotePlacement is required for full guidance version 6 or newer"
    );
  }
  return errors.length === 0
    ? { errors, value: value as unknown as RepoPolicy }
    : { errors };
};

const validRepositoryJsonName = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 5 &&
  value.endsWith(".json") &&
  basename(value) === value &&
  !value.includes("/") &&
  !value.includes("\\");

const validateCmsPolicy = (
  value: unknown
): { errors: string[]; value?: CmsPolicy } => {
  if (
    !(
      isRecord(value) &&
      hasExactKeys(value, [
        "schemaVersion",
        "guidance",
        "changelogPath",
        "cmsSurface",
        "newReleaseNoteSurfaces",
      ])
    )
  ) {
    return { errors: ["CMS policy has missing or unknown fields"] };
  }
  const errors: string[] = [];
  if (value.schemaVersion !== 1) {
    errors.push("CMS policy schemaVersion must be 1");
  }
  if (!validRepositoryJsonName(value.changelogPath)) {
    errors.push("changelogPath must be one repository-root JSON filename");
  }
  if (
    !(
      isRecord(value.cmsSurface) &&
      hasExactKeys(value.cmsSurface, ["route", "access"]) &&
      typeof value.cmsSurface.route === "string" &&
      value.cmsSurface.route.startsWith("/") &&
      value.cmsSurface.route !== "/" &&
      value.cmsSurface.access === "authenticated-operators"
    )
  ) {
    errors.push(
      "cmsSurface must identify a non-root authenticated-operators route"
    );
  }
  if (
    !(
      isRecord(value.guidance) &&
      hasExactKeys(value.guidance, ["version", "backfillStatus"]) &&
      value.guidance.version === 1 &&
      oneOf(value.guidance.backfillStatus, BACKFILL_STATUSES)
    )
  ) {
    errors.push(
      "CMS guidance must contain version 1 and a supported backfillStatus"
    );
  }
  if (!oneOf(value.newReleaseNoteSurfaces, SURFACE_POLICIES)) {
    errors.push("CMS newReleaseNoteSurfaces is unsupported");
  }
  return errors.length === 0
    ? { errors, value: value as unknown as CmsPolicy }
    : { errors };
};

export const validateGlobalPreferences = (
  value: unknown
): { errors: string[]; value?: GlobalPreferences } => {
  if (
    !(
      isRecord(value) &&
      hasExactKeys(value, [
        "schemaVersion",
        "profile",
        "developerChangelog",
        "signatures",
        "newReleaseNoteSurfaces",
        "setupStyle",
      ])
    )
  ) {
    return {
      errors: ["global preferences have missing or unknown fields"],
    };
  }
  const errors: string[] = [];
  if (value.schemaVersion !== 1) {
    errors.push("global schemaVersion must be 1");
  }
  if (value.profile !== "solo-developer") {
    errors.push("profile must be solo-developer");
  }
  if (!oneOf(value.developerChangelog, DEVELOPER_CHANGELOG_POLICIES)) {
    errors.push("global developerChangelog is unsupported");
  }
  if (!oneOf(value.signatures, SIGNATURE_POLICIES)) {
    errors.push("global signatures is unsupported");
  }
  if (!oneOf(value.newReleaseNoteSurfaces, SURFACE_POLICIES)) {
    errors.push("global newReleaseNoteSurfaces is unsupported");
  }
  if (!oneOf(value.setupStyle, SETUP_STYLES)) {
    errors.push("global setupStyle is unsupported");
  }
  return errors.length === 0
    ? { errors, value: value as unknown as GlobalPreferences }
    : { errors };
};

const distributionFromInstall = (): Distribution | "cms" => {
  const installation = basename(resolve(import.meta.dir, ".."));
  const mapping: Record<string, Distribution | "cms"> = {
    "simple-changelogs": "full",
    "simple-changelogs-cms": "cms",
    "simple-changelogs-mobile": "mobile",
    "simple-changelogs-skill-maintainer": "skill-repository",
    "simple-changelogs-web": "web",
    "simple-changelogs-web-cms": "web-cms",
  };
  return mapping[installation] ?? "full";
};

export const resolveGlobalPreferencesPath = (
  configDirectory?: string
): string => {
  const override = configDirectory ?? process.env.SIMPLE_CHANGELOGS_CONFIG_DIR;
  if (override) {
    return join(resolve(override), "preferences.json");
  }
  if (platform() === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "simple-changelogs",
      "preferences.json"
    );
  }
  if (platform() === "win32") {
    return join(
      process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
      "simple-changelogs",
      "preferences.json"
    );
  }
  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "simple-changelogs",
    "preferences.json"
  );
};

const readState = async <T>(
  path: string,
  validate: (value: unknown) => { errors: string[]; value?: T }
): Promise<StateRecord<T>> => {
  let metadata: Awaited<ReturnType<typeof lstat>>;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (
      isRecord(error) &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return { errors: [], path, state: "absent" };
    }
    return {
      errors: [`Could not inspect ${path}: ${stringifyError(error)}`],
      path,
      state: "malformed",
    };
  }
  if (metadata.isSymbolicLink()) {
    return {
      errors: [`Refusing symbolic-link state at ${path}`],
      path,
      state: "malformed",
    };
  }
  if (!metadata.isFile()) {
    return {
      errors: [`State path is not a regular file: ${path}`],
      path,
      state: "malformed",
    };
  }
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    const result = validate(parsed);
    return result.value
      ? { errors: [], path, state: "valid", value: result.value }
      : { errors: result.errors, path, state: "malformed" };
  } catch (error) {
    return {
      errors: [`Could not parse ${path}: ${stringifyError(error)}`],
      path,
      state: "malformed",
    };
  }
};

const countReleasedHeadings = async (path: string): Promise<number> => {
  try {
    const content = await readFile(path, "utf8");
    return [...content.matchAll(RELEASE_HEADING)].length;
  } catch {
    return 0;
  }
};

const walkTextFiles = async (root: string, limit = 400): Promise<string[]> => {
  const visit = async (directory: string): Promise<string[]> => {
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return [];
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    const nested = await Promise.all(
      entries.map(async (entry): Promise<string[]> => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          return IGNORED_DIRECTORIES.has(entry.name) ? [] : await visit(path);
        }
        const textFile =
          entry.isFile() &&
          (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase()) ||
            entry.name === "SKILL.md");
        return textFile ? [path] : [];
      })
    );
    return nested.flat().slice(0, limit);
  };
  return (await visit(root)).slice(0, limit);
};

const readSmallText = async (path: string): Promise<string> => {
  try {
    const metadata = await stat(path);
    return metadata.size <= 256 * 1024 ? await readFile(path, "utf8") : "";
  } catch {
    return "";
  }
};

const inspectInventory = async (root: string): Promise<Inventory> => {
  const publicPath = join(root, "CHANGELOG.md");
  const developerPath = join(root, "DEVELOPER_CHANGELOG.md");
  const [publicReleases, developerReleases, files] = await Promise.all([
    countReleasedHeadings(publicPath),
    countReleasedHeadings(developerPath),
    walkTextFiles(root),
  ]);
  const developerHistoryEvidence: string[] = [];
  if (existsSync(developerPath)) {
    developerHistoryEvidence.push("DEVELOPER_CHANGELOG.md exists");
  }
  const destinations = new Set<string>();
  const cmsEvidence = new Set<string>();
  const fileEvidence = await Promise.all(
    files.map(async (path) => {
      const localPath = relative(root, path).split(sep).join("/");
      const lowerPath = localPath.toLowerCase();
      const authenticationRelated =
        AUTH_RELATED_PATH.test(lowerPath) &&
        AUTH_RELATED_CONTENT.test(await readSmallText(path));
      return {
        authenticationRelated,
        cmsPath: CMS_PATH.test(lowerPath),
        destination:
          path !== publicPath &&
          path !== developerPath &&
          !NON_DESTINATION_FILES.has(localPath) &&
          RELEASE_DESTINATION_PATH.test(lowerPath),
        localPath,
      };
    })
  );
  for (const evidence of fileEvidence) {
    const { localPath } = evidence;
    if (evidence.destination) {
      destinations.add(localPath);
    }
    if (evidence.cmsPath) {
      cmsEvidence.add(`CMS path: ${localPath}`);
    }
    if (evidence.authenticationRelated) {
      cmsEvidence.add(`Authentication-related code: ${localPath}`);
    }
  }
  const cmsChangelogPath = join(root, DEFAULT_CMS_CHANGELOG);
  let cmsReleased = 0;
  if (existsSync(cmsChangelogPath)) {
    try {
      const value = JSON.parse(
        await readFile(cmsChangelogPath, "utf8")
      ) as unknown;
      if (isRecord(value) && Array.isArray(value.entries)) {
        cmsReleased = value.entries.length;
      }
    } catch {
      cmsEvidence.add(`${DEFAULT_CMS_CHANGELOG} exists but is malformed`);
    }
  }
  return {
    changelogs: [
      {
        exists: existsSync(publicPath),
        path: "CHANGELOG.md",
        releasedHeadings: publicReleases,
      },
      {
        exists: existsSync(developerPath),
        path: "DEVELOPER_CHANGELOG.md",
        releasedHeadings: developerReleases,
      },
      {
        exists: existsSync(cmsChangelogPath),
        path: DEFAULT_CMS_CHANGELOG,
        releasedHeadings: cmsReleased,
      },
    ],
    cmsEvidence: [...cmsEvidence].sort(),
    destinations: [...destinations].sort(),
    developerHistoryEvidence,
    releasedHistoryCount: Math.max(
      publicReleases,
      developerReleases,
      cmsReleased
    ),
  };
};

const dependencyNames = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return [];
  }
  const sections = ["dependencies", "devDependencies"];
  return sections.flatMap((section) => {
    const dependencies = value[section];
    return isRecord(dependencies) ? Object.keys(dependencies) : [];
  });
};

const inspectProjectEvidence = async (
  root: string,
  inventory: Inventory
): Promise<string[]> => {
  const evidence = new Set<string>();
  try {
    const packageJson = JSON.parse(
      await readFile(join(root, "package.json"), "utf8")
    ) as unknown;
    const dependencies = dependencyNames(packageJson);
    if (dependencies.some((name) => WEB_DEPENDENCIES.has(name))) {
      evidence.add("Package metadata indicates a web application");
    }
    if (dependencies.some((name) => MOBILE_DEPENDENCIES.has(name))) {
      evidence.add("Package metadata indicates a mobile application");
    }
  } catch {
    // package.json is optional inspection evidence.
  }
  if (existsSync(join(root, "ios")) || existsSync(join(root, "android"))) {
    evidence.add("Native mobile project directories are present");
  }
  if (existsSync(join(root, "SKILL.md")) || existsSync(join(root, "skills"))) {
    evidence.add("Agent skill package structure is present");
  }
  if (inventory.cmsEvidence.length > 0) {
    evidence.add("CMS or authentication-related repository paths are present");
  }
  if (inventory.destinations.length > 0) {
    evidence.add(
      `${inventory.destinations.length} established release-note destination(s) found`
    );
  }
  return [...evidence].sort();
};

const expectedDistribution = (
  installed: Distribution | "cms"
): Distribution | undefined => (installed === "cms" ? undefined : installed);

const detectDistribution = (
  installed: Distribution | "cms",
  policy: StateRecord<RepoPolicy>,
  cmsPolicy: StateRecord<CmsPolicy>,
  projectEvidence: string[]
): Detection => {
  const evidence = [
    `Invoked ${basename(resolve(import.meta.dir, ".."))}`,
    ...projectEvidence,
  ];
  const expected = expectedDistribution(installed);
  if (policy.value?.distribution) {
    evidence.push(`${POLICY_FILENAME} selects ${policy.value.distribution}`);
  }
  if (cmsPolicy.state === "valid") {
    evidence.push(`${CMS_POLICY_FILENAME} selects protected CMS history`);
  }
  const conflict =
    (expected !== undefined &&
      policy.value?.distribution !== undefined &&
      policy.value.distribution !== expected) ||
    (installed === "cms" && policy.state === "valid") ||
    (installed !== "cms" &&
      installed !== "web-cms" &&
      cmsPolicy.state === "valid");
  return {
    confidence: conflict ? "conflict" : "high",
    distribution: conflict ? null : installed,
    evidence,
  };
};

const safeGlobalDefaults = (): GlobalPreferences => ({
  developerChangelog: "required",
  newReleaseNoteSurfaces: "ask",
  profile: "solo-developer",
  schemaVersion: 1,
  setupStyle: "recommended",
  signatures: "agent-and-timestamp",
});

const recommendationFor = (
  installed: Distribution | "cms",
  inventory: Inventory,
  global: StateRecord<GlobalPreferences>,
  policy: StateRecord<RepoPolicy>,
  cmsPolicy: StateRecord<CmsPolicy>
): Recommendation => {
  const reusableDefaults = global.value ?? safeGlobalDefaults();
  const backfillStatus: BackfillStatus | undefined =
    inventory.releasedHistoryCount === 0 ? "not-applicable" : undefined;
  const recommendedPolicy =
    installed === "cms"
      ? null
      : (policy.value ?? {
          developerChangelog: reusableDefaults.developerChangelog,
          distribution: installed,
          guidance: {
            backfillStatus: backfillStatus ?? ("partial" as const),
            version: GUIDANCE_VERSIONS[installed],
          },
          newReleaseNoteSurfaces: reusableDefaults.newReleaseNoteSurfaces,
          schemaVersion: 1 as const,
          signatures: reusableDefaults.signatures,
        });
  const cms =
    installed === "cms" || installed === "web-cms"
      ? (cmsPolicy.value ?? null)
      : null;
  return {
    cmsPolicy: cms,
    policy: recommendedPolicy,
    reusableDefaults,
  };
};

const unresolvedFor = (
  installed: Distribution | "cms",
  inventory: Inventory,
  policy: StateRecord<RepoPolicy>,
  cmsPolicy: StateRecord<CmsPolicy>,
  detection: Detection
): string[] => {
  const unresolved: string[] = [];
  if (detection.confidence === "conflict") {
    unresolved.push("distribution-conflict");
  }
  if (
    installed === "full" &&
    (policy.state === "absent" ||
      policy.value?.mobileReleaseNotePlacement === undefined)
  ) {
    unresolved.push("mobile-release-note-placement");
  }
  if (
    (installed === "cms" || installed === "web-cms") &&
    cmsPolicy.state === "absent"
  ) {
    unresolved.push(
      "cms-authentication-proof",
      "cms-protected-route",
      "cms-changelog-path"
    );
  }
  if (installed !== "cms" && policy.state === "absent") {
    unresolved.push("preference-scope");
  }
  if (inventory.releasedHistoryCount > 0) {
    unresolved.push("released-history-audit");
  }
  return [...new Set(unresolved)];
};

const isConfigured = (
  installed: Distribution | "cms",
  policy: StateRecord<RepoPolicy>,
  cmsPolicy: StateRecord<CmsPolicy>,
  detection: Detection
): boolean => {
  if (detection.confidence === "conflict") {
    return false;
  }
  if (installed === "cms") {
    return cmsPolicy.state === "valid";
  }
  if (installed === "web-cms") {
    return policy.state === "valid" && cmsPolicy.state === "valid";
  }
  return policy.state === "valid";
};

const inspectionStatus = (
  configured: boolean,
  hasMalformedState: boolean,
  onboardingRequired: boolean,
  detection: Detection,
  unresolvedQuestions: string[]
): SetupStatus => {
  if (hasMalformedState || detection.confidence === "conflict") {
    return "blocked";
  }
  if (configured) {
    return "already-configured";
  }
  if (onboardingRequired && unresolvedQuestions.length > 0) {
    return "needs-input";
  }
  return "ready";
};

const inspectionSummary = (
  configured: boolean,
  taskMode: TaskMode,
  installed: Distribution | "cms"
): string => {
  const selectedLabel = installed === "cms" ? "CMS-only" : installed;
  if (configured) {
    return `Simple Changelogs ${selectedLabel} is already configured for this repository.`;
  }
  if (taskMode === "read") {
    return `Read-only inspection found no durable setup requirement for Simple Changelogs ${selectedLabel}.`;
  }
  return `Simple Changelogs ${selectedLabel} needs onboarding before write-capable changelog work.`;
};

export const inspectRepository = async (
  options: InspectOptions
): Promise<SetupResult> => {
  const root = resolve(options.repo);
  const installed = options.distribution ?? distributionFromInstall();
  const taskMode = options.taskMode ?? "write";
  const [policy, cmsPolicy, globalPreferences, inventory] = await Promise.all([
    readState(join(root, POLICY_FILENAME), validateRepoPolicy),
    readState(join(root, CMS_POLICY_FILENAME), validateCmsPolicy),
    readState(
      resolveGlobalPreferencesPath(options.configDirectory),
      validateGlobalPreferences
    ),
    inspectInventory(root),
  ]);
  const projectEvidence = await inspectProjectEvidence(root, inventory);
  const detection = detectDistribution(
    installed,
    policy,
    cmsPolicy,
    projectEvidence
  );
  const configured = isConfigured(installed, policy, cmsPolicy, detection);
  const relevantPolicy = installed === "cms" ? cmsPolicy : policy;
  const hasMalformedState =
    relevantPolicy.state === "malformed" ||
    (installed === "web-cms" && cmsPolicy.state === "malformed");
  const recommendation = recommendationFor(
    installed,
    inventory,
    globalPreferences,
    policy,
    cmsPolicy
  );
  const unresolvedQuestions = configured
    ? []
    : unresolvedFor(installed, inventory, policy, cmsPolicy, detection);
  const onboardingRequired =
    taskMode === "write" &&
    !configured &&
    !hasMalformedState &&
    detection.confidence !== "conflict";
  const status = inspectionStatus(
    configured,
    hasMalformedState,
    onboardingRequired,
    detection,
    unresolvedQuestions
  );
  return {
    cmsPolicy:
      installed === "cms" || installed === "web-cms" ? cmsPolicy : null,
    command: "inspect",
    detection,
    errors: [
      ...relevantPolicy.errors,
      ...(installed === "web-cms" ? cmsPolicy.errors : []),
    ],
    globalPreferences,
    inventory,
    onboardingRequired,
    policy: installed === "cms" ? null : policy,
    recommendation,
    repository: root,
    schemaVersion: 1,
    selection: {},
    status,
    summary: inspectionSummary(configured, taskMode, installed),
    unresolvedQuestions,
    writeCapable: taskMode === "write",
    writes: [],
  };
};

const ensureNoSymlink = async (path: string): Promise<void> => {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Refusing symbolic-link target: ${path}`);
    }
  } catch (error) {
    if (
      isRecord(error) &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
};

const ensureAbsent = async (path: string): Promise<void> => {
  try {
    const metadata = await lstat(path);
    const targetKind = metadata.isSymbolicLink() ? "symbolic-link" : "existing";
    throw new Error(`Refusing ${targetKind} target: ${path}`);
  } catch (error) {
    if (
      isRecord(error) &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
};

const stageFile = async (
  candidate: CandidateWrite
): Promise<{ candidate: CandidateWrite; temporaryPath: string }> => {
  await mkdir(dirname(candidate.path), { mode: 0o700, recursive: true });
  await ensureNoSymlink(candidate.path);
  const temporaryPath = join(
    dirname(candidate.path),
    `.${basename(candidate.path)}.setup-${process.pid}-${crypto.randomUUID()}`
  );
  const handle = await open(temporaryPath, "wx", candidate.mode);
  try {
    await handle.writeFile(candidate.content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { candidate, temporaryPath };
};

const stageCandidates = async (
  candidates: CandidateWrite[]
): Promise<Awaited<ReturnType<typeof stageFile>>[]> => {
  const results = await Promise.allSettled(candidates.map(stageFile));
  const staged = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );
  if (failure) {
    await Promise.all(
      staged.map(({ temporaryPath }) => rm(temporaryPath, { force: true }))
    );
    throw failure.reason;
  }
  return staged;
};

const recoverSetupTransaction = async (
  root: string,
  candidates: CandidateWrite[]
): Promise<void> => {
  const markerPath = join(root, SETUP_TRANSACTION_FILENAME);
  if (!existsSync(markerPath)) {
    return;
  }
  await ensureNoSymlink(markerPath);
  const marker = JSON.parse(await readFile(markerPath, "utf8")) as unknown;
  if (
    !(
      isRecord(marker) &&
      hasExactKeys(marker, ["schemaVersion", "targets"]) &&
      marker.schemaVersion === 1 &&
      Array.isArray(marker.targets) &&
      marker.targets.length > 0 &&
      marker.targets.every(
        (target) =>
          typeof target === "string" &&
          target.length > 0 &&
          !target.startsWith("/") &&
          !target.split("/").includes("..")
      )
    )
  ) {
    throw new Error(`Unfinished setup transaction is malformed: ${markerPath}`);
  }
  const targets = marker.targets.map((target) => resolve(root, target));
  if (
    targets.some((target) => {
      const local = relative(root, target);
      return local.startsWith("..") || local === "";
    })
  ) {
    throw new Error(`Unfinished setup transaction escapes ${root}`);
  }
  const candidatesByPath = new Map(
    candidates.map((candidate) => [candidate.path, candidate])
  );
  if (targets.some((target) => !candidatesByPath.has(target))) {
    throw new Error(
      "Unfinished setup transaction does not match the requested setup choices"
    );
  }
  const existingTargets = targets.filter((target) => existsSync(target));
  const existingContent = await Promise.all(
    existingTargets.map(async (target) => ({
      candidate: candidatesByPath.get(target),
      content: await readFile(target, "utf8"),
    }))
  );
  if (
    existingContent.some(
      ({ candidate, content }) => candidate?.content !== content
    )
  ) {
    throw new Error(
      "Unfinished setup transaction contains a target with unexpected content"
    );
  }
  await rm(markerPath, { force: true });
};

const atomicWriteSet = async (
  root: string,
  candidates: CandidateWrite[]
): Promise<WriteRecord[]> => {
  await recoverSetupTransaction(root, candidates);
  await Promise.all(
    candidates.map((candidate) => ensureNoSymlink(candidate.path))
  );
  const pending = candidates.filter((candidate) => !existsSync(candidate.path));
  const unchanged = candidates
    .filter((candidate) => existsSync(candidate.path))
    .map((candidate) => ({
      kind: candidate.kind,
      path: candidate.path,
      written: false,
    }));
  if (pending.length === 0) {
    return unchanged;
  }
  const markerPath = join(root, SETUP_TRANSACTION_FILENAME);
  await ensureAbsent(markerPath);
  const staged = await stageCandidates(pending);
  let markerCreated = false;
  try {
    const marker = {
      schemaVersion: 1,
      targets: staged.map(({ candidate }) =>
        relative(root, candidate.path).split(sep).join("/")
      ),
    };
    const markerHandle = await open(markerPath, "wx", 0o600);
    try {
      await markerHandle.writeFile(json(marker), "utf8");
      await markerHandle.sync();
      markerCreated = true;
    } finally {
      await markerHandle.close();
    }
    await Promise.all(
      staged.map(async ({ candidate, temporaryPath }) => {
        await ensureAbsent(candidate.path);
        await rename(temporaryPath, candidate.path);
        await chmod(candidate.path, candidate.mode);
      })
    );
    await unlink(markerPath);
    return [
      ...unchanged,
      ...pending.map((candidate) => ({
        kind: candidate.kind,
        path: candidate.path,
        written: true,
      })),
    ];
  } catch (error) {
    await Promise.all([
      ...pending.map((candidate) => rm(candidate.path, { force: true })),
      ...staged.map(({ temporaryPath }) => rm(temporaryPath, { force: true })),
      ...(markerCreated ? [rm(markerPath, { force: true })] : []),
    ]);
    throw error;
  }
};

const markdownCandidates = (
  root: string,
  developerChangelog: DeveloperChangelogPolicy
): CandidateWrite[] => {
  const candidates: CandidateWrite[] = [
    {
      content: "# Changelog\n\n## Unreleased\n",
      kind: "changelog",
      mode: 0o644,
      path: join(root, "CHANGELOG.md"),
    },
  ];
  if (developerChangelog === "required") {
    candidates.push({
      content: "# Developer Changelog\n\n## Unreleased\n",
      kind: "developer-changelog",
      mode: 0o644,
      path: join(root, "DEVELOPER_CHANGELOG.md"),
    });
  }
  return candidates;
};

const selectionFrom = (
  options: ApplyOptions,
  inspect: SetupResult,
  installed: Distribution | "cms"
): CompleteSelection => {
  const defaults = inspect.recommendation.reusableDefaults;
  return {
    backfillStatus:
      options.backfillStatus ??
      (inspect.inventory.releasedHistoryCount === 0
        ? "not-applicable"
        : "partial"),
    developerChangelog:
      options.developerChangelog ?? defaults.developerChangelog,
    mobileReleaseNotePlacement: options.mobileReleaseNotePlacement,
    newReleaseNoteSurfaces:
      options.newReleaseNoteSurfaces ??
      (installed === "cms" ? "existing-only" : defaults.newReleaseNoteSurfaces),
    scope: options.scope ?? "repository",
    setupStyle: options.setupStyle ?? defaults.setupStyle,
    signatures: options.signatures ?? defaults.signatures,
  };
};

const blockResult = (
  inspect: SetupResult,
  errors: string[],
  selection: Selection = {}
): SetupResult => ({
  ...inspect,
  command: "apply",
  errors: [...inspect.errors, ...errors],
  selection,
  status: "blocked",
  summary: errors[0] ?? "Setup is blocked.",
  writes: [],
});

const cmsPolicyFor = (
  selection: CompleteSelection,
  options: ApplyOptions
): CmsPolicy => ({
  changelogPath: options.cmsChangelog ?? DEFAULT_CMS_CHANGELOG,
  cmsSurface: {
    access: "authenticated-operators",
    route: options.cmsRoute ?? "",
  },
  guidance: {
    backfillStatus: selection.backfillStatus,
    version: 1,
  },
  newReleaseNoteSurfaces: options.newReleaseNoteSurfaces ?? "existing-only",
  schemaVersion: 1,
});

const globalFor = (
  selection: CompleteSelection,
  newReleaseNoteSurfaces = selection.newReleaseNoteSurfaces
): GlobalPreferences => ({
  developerChangelog: selection.developerChangelog,
  newReleaseNoteSurfaces,
  profile: "solo-developer",
  schemaVersion: 1,
  setupStyle: selection.setupStyle,
  signatures: selection.signatures,
});

const repoPolicyFor = (
  installed: Distribution,
  selection: CompleteSelection
): RepoPolicy => {
  const policy: RepoPolicy = {
    developerChangelog: selection.developerChangelog,
    distribution: installed,
    guidance: {
      backfillStatus: selection.backfillStatus,
      version: GUIDANCE_VERSIONS[installed],
    },
    newReleaseNoteSurfaces: selection.newReleaseNoteSurfaces,
    schemaVersion: 1,
    signatures: selection.signatures,
  };
  if (installed === "full") {
    policy.mobileReleaseNotePlacement = selection.mobileReleaseNotePlacement;
  }
  return policy;
};

const validateStoredPolicies = async (
  installed: Distribution | "cms",
  root: string
): Promise<string[]> => {
  const errors: string[] = [];
  if (installed !== "cms") {
    const policy = await readState(
      join(root, POLICY_FILENAME),
      validateRepoPolicy
    );
    errors.push(...policy.errors);
    if (policy.state !== "valid") {
      errors.push(`Stored ${POLICY_FILENAME} did not revalidate`);
    }
  }
  if (installed === "cms" || installed === "web-cms") {
    const policy = await readState(
      join(root, CMS_POLICY_FILENAME),
      validateCmsPolicy
    );
    errors.push(...policy.errors);
    if (policy.state !== "valid") {
      errors.push(`Stored ${CMS_POLICY_FILENAME} did not revalidate`);
    }
  }
  return errors;
};

const completePartialAudit = async (
  options: ApplyOptions,
  inspect: SetupResult,
  installed: Distribution | "cms"
): Promise<SetupResult | null> => {
  if (options.backfillStatus !== "completed") {
    return null;
  }
  const standard = inspect.policy?.value;
  const cms = inspect.cmsPolicy?.value;
  const standardPath = inspect.policy?.path;
  const cmsPath = inspect.cmsPolicy?.path;
  const currentStatus =
    installed === "cms"
      ? cms?.guidance.backfillStatus
      : standard?.guidance.backfillStatus;
  if (currentStatus !== "partial") {
    return null;
  }
  if (!options.auditVerified) {
    return blockResult(inspect, [
      "A partial released-history audit can become completed only with --audit-verified.",
    ]);
  }
  if (!options.confirm) {
    return blockResult(inspect, [
      "Confirmation is required before completing stored audit state.",
    ]);
  }
  const candidates: CandidateWrite[] = [];
  if (standard && standardPath) {
    candidates.push({
      content: json({
        ...standard,
        guidance: { ...standard.guidance, backfillStatus: "completed" },
      }),
      kind: "repository-policy",
      mode: 0o644,
      path: standardPath,
    });
  }
  if (cms && cmsPath) {
    candidates.push({
      content: json({
        ...cms,
        guidance: { ...cms.guidance, backfillStatus: "completed" },
      }),
      kind: "cms-policy",
      mode: 0o644,
      path: cmsPath,
    });
  }
  const staged = await stageCandidates(candidates);
  await Promise.all(
    staged.map(async ({ candidate, temporaryPath }) => {
      await ensureNoSymlink(candidate.path);
      await rename(temporaryPath, candidate.path);
      await chmod(candidate.path, candidate.mode);
    })
  );
  const errors = await validateStoredPolicies(installed, inspect.repository);
  return errors.length > 0
    ? blockResult(inspect, errors)
    : {
        ...inspect,
        command: "apply",
        errors: [],
        selection: { backfillStatus: "completed" },
        status: "configured",
        summary:
          "The verified released-history audit is now recorded as completed.",
        writes: candidates.map((candidate) => ({
          kind: candidate.kind,
          path: candidate.path,
          written: true,
        })),
      };
};

const preSetupResult = (inspect: SetupResult): SetupResult | null => {
  if (!inspect.writeCapable) {
    return blockResult(inspect, [
      "Read-only tasks cannot apply onboarding state.",
    ]);
  }
  if (inspect.status === "already-configured") {
    return {
      ...inspect,
      command: "apply",
      summary:
        "Valid repository policy already exists; onboarding made no changes.",
    };
  }
  if (inspect.status === "blocked") {
    return { ...inspect, command: "apply" };
  }
  return null;
};

const selectionErrors = (
  options: ApplyOptions,
  inspect: SetupResult,
  selection: CompleteSelection,
  installed: Distribution | "cms"
): string[] => {
  const errors: string[] = [];
  if (
    installed === "full" &&
    selection.mobileReleaseNotePlacement === undefined
  ) {
    errors.push(
      "Full web/mobile setup requires --mobile-placement with web-tabs, web-page, or mobile-only."
    );
  }
  if (selection.backfillStatus === "completed" && !options.auditVerified) {
    errors.push(
      "backfillStatus completed requires --audit-verified after the review succeeds."
    );
  }
  const durable = selection.scope !== "run-only";
  if (durable && !options.confirm) {
    errors.push("Confirmation is required before durable setup writes.");
  }
  if (
    durable &&
    selection.scope === "all-projects" &&
    inspect.globalPreferences.state === "malformed"
  ) {
    errors.push(
      "Global preferences are malformed and were preserved; repair or remove them before selecting all-projects scope."
    );
  }
  const needsCms = installed === "cms" || installed === "web-cms";
  if (
    needsCms &&
    !(options.cmsAuthProven && options.cmsSurfaceProven && options.cmsRoute)
  ) {
    errors.push(
      "CMS setup requires --cms-auth-proven, --cms-surface-proven, and an exact --cms-route."
    );
  }
  if (
    needsCms &&
    !validRepositoryJsonName(options.cmsChangelog ?? DEFAULT_CMS_CHANGELOG)
  ) {
    errors.push(
      "CMS changelog must be one repository-root JSON filename without path traversal."
    );
  }
  return errors;
};

const runOnlyResult = (
  inspect: SetupResult,
  selection: CompleteSelection
): SetupResult => ({
  ...inspect,
  command: "apply",
  errors: [],
  onboardingRequired: true,
  selection,
  status: "run-only",
  summary:
    "These choices apply to this run only; no repository or global state was written.",
  unresolvedQuestions: [],
  writes: [],
});

const validateExistingCmsChangelog = async (
  path: string
): Promise<string[]> => {
  if (!existsSync(path)) {
    return [];
  }
  try {
    await ensureNoSymlink(path);
    const current = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (
      isRecord(current) &&
      current.schemaVersion === 1 &&
      typeof current.title === "string" &&
      Array.isArray(current.entries)
    ) {
      return [];
    }
    return [`Existing ${basename(path)} is malformed and was preserved.`];
  } catch (error) {
    return [
      `Existing ${basename(path)} could not be parsed and was preserved: ${stringifyError(error)}`,
    ];
  }
};

const buildSetupCandidates = async (
  options: ApplyOptions,
  inspect: SetupResult,
  selection: CompleteSelection,
  installed: Distribution | "cms"
): Promise<{ candidates: CandidateWrite[]; errors: string[] }> => {
  const root = inspect.repository;
  const candidates: CandidateWrite[] = [];
  if (installed !== "cms") {
    const policy = repoPolicyFor(installed, selection);
    candidates.push({
      content: json(policy),
      kind: "repository-policy",
      mode: 0o644,
      path: join(root, POLICY_FILENAME),
    });
    candidates.push(...markdownCandidates(root, selection.developerChangelog));
  }
  if (installed === "cms" || installed === "web-cms") {
    const cmsPolicy = cmsPolicyFor(selection, options);
    const cmsValidation = validateCmsPolicy(cmsPolicy);
    if (!cmsValidation.value) {
      return { candidates: [], errors: cmsValidation.errors };
    }
    const cmsChangelogPath = join(root, cmsPolicy.changelogPath);
    const errors = await validateExistingCmsChangelog(cmsChangelogPath);
    if (errors.length > 0) {
      return { candidates: [], errors };
    }
    candidates.push(
      {
        content: json(cmsPolicy),
        kind: "cms-policy",
        mode: 0o644,
        path: join(root, CMS_POLICY_FILENAME),
      },
      {
        content: json({
          entries: [],
          schemaVersion: 1,
          title: "CMS Changelog",
        }),
        kind: "cms-changelog",
        mode: 0o644,
        path: cmsChangelogPath,
      }
    );
  }
  return { candidates, errors: [] };
};

interface PreparedGlobalPreferences {
  record: WriteRecord;
  staged?: Awaited<ReturnType<typeof stageFile>>;
}

const prepareGlobalPreferences = async (
  options: ApplyOptions,
  inspect: SetupResult,
  selection: CompleteSelection,
  installed: Distribution | "cms"
): Promise<PreparedGlobalPreferences> => {
  const globalPath = resolveGlobalPreferencesPath(options.configDirectory);
  const reusableSurface =
    installed === "cms" && options.newReleaseNoteSurfaces === undefined
      ? inspect.recommendation.reusableDefaults.newReleaseNoteSurfaces
      : selection.newReleaseNoteSurfaces;
  const preferences = globalFor(selection, reusableSurface);
  const validation = validateGlobalPreferences(preferences);
  if (!validation.value) {
    throw new Error(validation.errors.join("; "));
  }
  if (
    inspect.globalPreferences.state === "valid" &&
    json(inspect.globalPreferences.value) === json(preferences)
  ) {
    return {
      record: {
        kind: "global-preferences",
        path: globalPath,
        written: false,
      },
    };
  }
  return {
    record: {
      kind: "global-preferences",
      path: globalPath,
      written: true,
    },
    staged: await stageFile({
      content: json(preferences),
      kind: "global-preferences",
      mode: 0o600,
      path: globalPath,
    }),
  };
};

const finalizeGlobalPreferences = async (
  prepared: PreparedGlobalPreferences
): Promise<WriteRecord> => {
  if (!prepared.staged) {
    return prepared.record;
  }
  await ensureNoSymlink(prepared.record.path);
  await rename(prepared.staged.temporaryPath, prepared.staged.candidate.path);
  await chmod(prepared.record.path, 0o600);
  const reread = await readState(
    prepared.record.path,
    validateGlobalPreferences
  );
  if (reread.state !== "valid") {
    throw new Error(
      [...reread.errors, "Stored global preferences did not revalidate."].join(
        "; "
      )
    );
  }
  return prepared.record;
};

const persistSetup = async (
  options: ApplyOptions,
  inspect: SetupResult,
  selection: CompleteSelection,
  installed: Distribution | "cms",
  candidates: CandidateWrite[]
): Promise<SetupResult> => {
  let preparedGlobal: PreparedGlobalPreferences | undefined;
  let writes: WriteRecord[] = [];
  try {
    if (selection.scope === "all-projects") {
      preparedGlobal = await prepareGlobalPreferences(
        options,
        inspect,
        selection,
        installed
      );
    }
    writes = await atomicWriteSet(inspect.repository, candidates);
    const validationErrors = await validateStoredPolicies(
      installed,
      inspect.repository
    );
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join("; "));
    }
    if (preparedGlobal) {
      writes.push(await finalizeGlobalPreferences(preparedGlobal));
    }
    const selectedLabel = installed === "cms" ? "CMS-only" : installed;
    return {
      ...inspect,
      command: "apply",
      errors: [],
      onboardingRequired: false,
      selection,
      status: "configured",
      summary: `Simple Changelogs ${selectedLabel} is configured. Repository-specific audiences, destinations, history, and authority remain repository-owned.`,
      unresolvedQuestions: [],
      writes,
    };
  } catch (error) {
    await Promise.all([
      ...writes
        .filter((write) => write.written)
        .map((write) => rm(write.path, { force: true })),
      ...(preparedGlobal?.staged
        ? [rm(preparedGlobal.staged.temporaryPath, { force: true })]
        : []),
    ]);
    return blockResult(
      inspect,
      [`Setup write failed: ${stringifyError(error)}`],
      selection
    );
  }
};

export const applySetup = async (
  options: ApplyOptions
): Promise<SetupResult> => {
  const installed = options.distribution ?? distributionFromInstall();
  const inspect = await inspectRepository({
    configDirectory: options.configDirectory,
    distribution: installed,
    repo: options.repo,
    taskMode: options.taskMode ?? "write",
  });
  const auditCompletion = await completePartialAudit(
    options,
    inspect,
    installed
  );
  if (auditCompletion) {
    return auditCompletion;
  }
  const earlyResult = preSetupResult(inspect);
  if (earlyResult) {
    return earlyResult;
  }
  const selection = selectionFrom(options, inspect, installed);
  const errors = selectionErrors(options, inspect, selection, installed);
  if (errors.length > 0) {
    return blockResult(inspect, errors, selection);
  }
  if (selection.scope === "run-only") {
    return runOnlyResult(inspect, selection);
  }
  const build = await buildSetupCandidates(
    options,
    inspect,
    selection,
    installed
  );
  if (build.errors.length > 0) {
    return blockResult(inspect, build.errors, selection);
  }
  return persistSetup(options, inspect, selection, installed, build.candidates);
};

interface ParsedCli {
  command: "apply" | "inspect";
  options: ApplyOptions;
}

const valueOptionNames = new Set([
  "--backfill",
  "--cms-changelog",
  "--cms-route",
  "--developer-history",
  "--mobile-placement",
  "--new-surfaces",
  "--repo",
  "--scope",
  "--setup-style",
  "--signatures",
  "--task-mode",
]);
const booleanOptionNames = new Set([
  "--audit-verified",
  "--cms-auth-proven",
  "--cms-surface-proven",
  "--confirm",
  "--json",
]);

const parseCli = (argv: string[]): ParsedCli => {
  const [command] = argv;
  if (command !== "inspect" && command !== "apply") {
    throw new Error("Usage: setup.ts <inspect|apply> [options]");
  }
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 1; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name) {
      continue;
    }
    if (booleanOptionNames.has(name)) {
      flags.add(name);
      continue;
    }
    if (!valueOptionNames.has(name)) {
      throw new Error(`Unknown option: ${name}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}`);
    }
    values.set(name, value);
    index += 1;
  }
  const enumValue = <T extends string>(
    name: string,
    allowed: readonly T[]
  ): T | undefined => {
    const value = values.get(name);
    if (value === undefined) {
      return;
    }
    if (!oneOf(value, allowed)) {
      throw new Error(`${name} must be one of ${allowed.join(", ")}`);
    }
    return value;
  };
  return {
    command,
    options: {
      auditVerified: flags.has("--audit-verified"),
      backfillStatus: enumValue("--backfill", BACKFILL_STATUSES),
      cmsAuthProven: flags.has("--cms-auth-proven"),
      cmsChangelog: values.get("--cms-changelog"),
      cmsRoute: values.get("--cms-route"),
      cmsSurfaceProven: flags.has("--cms-surface-proven"),
      confirm: flags.has("--confirm"),
      developerChangelog: enumValue(
        "--developer-history",
        DEVELOPER_CHANGELOG_POLICIES
      ),
      mobileReleaseNotePlacement: enumValue(
        "--mobile-placement",
        MOBILE_RELEASE_NOTE_PLACEMENTS
      ),
      newReleaseNoteSurfaces: enumValue("--new-surfaces", SURFACE_POLICIES),
      repo: values.get("--repo") ?? ".",
      scope: enumValue("--scope", SCOPES),
      setupStyle: enumValue("--setup-style", SETUP_STYLES),
      signatures: enumValue("--signatures", SIGNATURE_POLICIES),
      taskMode: enumValue("--task-mode", TASK_MODES),
    },
  };
};

const cli = async (): Promise<void> => {
  try {
    const parsed = parseCli(process.argv.slice(2));
    const result =
      parsed.command === "inspect"
        ? await inspectRepository(parsed.options)
        : await applySetup(parsed.options);
    process.stdout.write(json(result));
    if (result.status === "blocked") {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${stringifyError(error)}\n`);
    process.exitCode = 2;
  }
};

if (import.meta.main) {
  await cli();
}
