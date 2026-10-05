#!/usr/bin/env bun

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { type Dirent, existsSync } from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
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
import { promisify } from "node:util";

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
const PUBLIC_VERSION_ACTIONS = ["ask", "automatic"] as const;
const VERSION_SUGGESTION_OPTIONS = ["on", "off"] as const;
const SURFACE_COMPONENT_SOURCES = [
  "project-components",
  "recommended-web-components",
  "recommended-web-radix",
  "platform-native-components",
  "minimal-markup",
] as const;
const CROSS_SURFACE_VERSIONING_POLICIES = [
  "shared",
  "independent",
  "mixed",
] as const;
const SHARED_VERSION_LINE_MODES = ["catch-up", "bump-shared"] as const;
const RELEASE_NOTE_ENVIRONMENT_SCOPES = [
  "all-environments",
  "non-production",
  "production-only",
  "disabled",
] as const;
const RELEASE_NOTE_LINK_POLICIES = ["when-useful", "ask", "disabled"] as const;
const RELEASE_NOTE_GROUPING_POLICIES = ["product-areas", "flat"] as const;
const MAJOR_RELEASE_NAMING_POLICIES = ["named", "version-only"] as const;
const PUBLIC_RELEASE_NOTE_POLICIES = ["full", "curated"] as const;
const MOBILE_RELEASE_NOTE_PLACEMENTS = [
  "store-only",
  "web-tabs",
  "web-page",
  "mobile-only",
] as const;
const SETUP_STYLES = ["recommended", "customized"] as const;
const SCOPES = ["repository", "all-projects", "run-only"] as const;
const TASK_MODES = ["write", "read"] as const;
const GUIDANCE_UPDATE_KINDS = [
  "behavior",
  "capability",
  "onboarding",
  "maintenance",
] as const;
const GUIDANCE_BACKFILL_RECOMMENDATIONS = [
  "recommended",
  "optional",
  "not-needed",
] as const;
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
const ADJACENT_UPDATE_DESTINATION_PATH =
  /(?:^|\/)(?:announcements?|blog|news|updates?)(?:[./_-]|\/|$)/u;
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
const COMPONENT_LIBRARY_DEPENDENCIES = new Set([
  "@chakra-ui/react",
  "@fluentui/react-components",
  "@mantine/core",
  "@mui/material",
  "antd",
  "bootstrap",
  "primereact",
  "vuetify",
]);
const MOBILE_COMPONENT_KIT_DEPENDENCIES = new Set([
  "@rneui/themed",
  "@shopify/restyle",
  "react-native-paper",
  "tamagui",
]);
const UTILITY_CSS_DEPENDENCIES = new Set(["nativewind", "tailwindcss"]);
const GLUESTACK_DEPENDENCY = /^@gluestack-ui\//u;
const RADIX_DEPENDENCY = /^@radix-ui\//u;
const BASE_UI_DEPENDENCY = /^@base-ui-components\//u;
// Distributions that can own a customer- or user-facing product surface, and
// therefore receive the archive and compact-surface offer during onboarding.
const PRODUCT_SURFACE_DISTRIBUTIONS = new Set<Distribution | "cms">([
  "cms",
  "full",
  "mobile",
  "web",
  "web-cms",
]);
const WEB_RELEASE_NOTE_DISTRIBUTIONS = new Set<Distribution>([
  "full",
  "web",
  "web-cms",
]);
const PRODUCT_RELEASE_NOTE_LINK_DISTRIBUTIONS = new Set<Distribution>([
  "full",
  "mobile",
  "web",
  "web-cms",
]);
const DESIGN_SYSTEM_PATH =
  /(?:^|\/)(\.storybook|design-system|ui-kit|packages\/ui)(?:\/|$)/u;
const WEB_APP_PATH =
  /^(?:(?:apps?\/web)(?:\/|$)|(?:src\/)?(?:pages|routes)\/)/u;
const MOBILE_APP_PATH = /^(?:apps?\/mobile|ios|android)(?:\/|$)/u;
const STORE_METADATA_PATH =
  /(?:^|\/)(?:fastlane\/metadata|metadata\/.+(?:changelogs?|release.?notes?)|eas\.json$|app\.json$|app\.config\.(?:cjs|js|mjs|ts)$)/u;
const WORKSPACE_APP_PATH = /(?:^|\/)apps\/([^/]+)(?:\/|$)/u;
const COMPONENT_CONFIG_FILE = "components.json";
const SWIFT_SOURCE_PATH = /\.swift$/u;
const SWIFT_UI_CONTENT = /\bSwiftUI\b/u;
const GRADLE_SOURCE_PATH = /\.(?:gradle|kts)$/u;
const PLIST_VERSION =
  /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]*)<\/string>/u;
// 1-3 numeric parts; a prerelease needs a letter, so a date never parses.
const PUBLIC_VERSION =
  /^\d+(?:\.\d+){0,2}(?:-[\w.-]*[a-z][\w.-]*)?(?:\+[\w.-]+)?$/iu;
const GRADLE_VERSION = /\bversionName\s*=?\s*["']([^"']+)["']/u;
const NATIVE_OWNER =
  /(?:^|\/)(ios|macos|android)\/(?:.+\/)?(?:info\.plist|build\.gradle(?:\.kts)?)$/u;
const COMPOSE_CONTENT =
  /(?:androidx\.compose|composeOptions|org\.jetbrains\.compose)/u;
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".gradle",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".kts",
  ".md",
  ".mjs",
  ".php",
  ".plist",
  ".py",
  ".rb",
  ".rs",
  ".svelte",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".yaml",
  ".yml",
]);
const IGNORED_DIRECTORIES = new Set([
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
]);

// Hidden directories hold version-control, cache, editor, and agent tool
// state, such as installed skills, plans, rules, hooks, and launch settings,
// whether or not Git tracks them. None of it is the product, and the capped
// walk sorts hidden names first, so it skips them all except the hidden
// directories setup reads as evidence: Storybook configuration
// (DESIGN_SYSTEM_PATH).
const HIDDEN_EVIDENCE_DIRECTORIES = new Set([".storybook"]);
const isHiddenToolDirectory = (name: string): boolean =>
  name.startsWith(".") && !HIDDEN_EVIDENCE_DIRECTORIES.has(name);

// Workspace members live in these root directories. Setup reads apps/*
// manifests, probes apps/* and packages/* for version owners, and gives each
// member an equal share of the capped walk.
const WORKSPACE_PARENTS = ["apps", "packages"];

type BackfillStatus = (typeof BACKFILL_STATUSES)[number];
type DeveloperChangelogPolicy = (typeof DEVELOPER_CHANGELOG_POLICIES)[number];
type Distribution = (typeof DISTRIBUTIONS)[number];
type SignaturePolicy = (typeof SIGNATURE_POLICIES)[number];
type SurfacePolicy = (typeof SURFACE_POLICIES)[number];
export type PublicVersionAction = (typeof PUBLIC_VERSION_ACTIONS)[number];
type SurfaceComponentSource = (typeof SURFACE_COMPONENT_SOURCES)[number];
type CrossSurfaceVersioning =
  (typeof CROSS_SURFACE_VERSIONING_POLICIES)[number];
interface SharedVersionLine {
  mode: (typeof SHARED_VERSION_LINE_MODES)[number];
  trains: string[];
}
interface VersionTrain {
  path: string;
  train: string;
  version: string | null;
}
type ReleaseNoteEnvironmentScope =
  (typeof RELEASE_NOTE_ENVIRONMENT_SCOPES)[number];
type ReleaseNoteLinkPolicy = (typeof RELEASE_NOTE_LINK_POLICIES)[number];
type ReleaseNoteGroupingPolicy =
  (typeof RELEASE_NOTE_GROUPING_POLICIES)[number];
type MajorReleaseNamingPolicy = (typeof MAJOR_RELEASE_NAMING_POLICIES)[number];
type PublicReleaseNotePolicy = (typeof PUBLIC_RELEASE_NOTE_POLICIES)[number];
type MobileReleaseNotePlacement =
  (typeof MOBILE_RELEASE_NOTE_PLACEMENTS)[number];
type SetupStyle = (typeof SETUP_STYLES)[number];
type PreferenceScope = (typeof SCOPES)[number];
type TaskMode = (typeof TASK_MODES)[number];
type GuidanceUpdateKind = (typeof GUIDANCE_UPDATE_KINDS)[number];
type GuidanceBackfillRecommendation =
  (typeof GUIDANCE_BACKFILL_RECOMMENDATIONS)[number];
type PolicyState = "absent" | "valid" | "malformed";
type SetupStatus =
  | "already-configured"
  | "blocked"
  | "configured"
  | "needs-input"
  | "ready"
  | "run-only";

const GUIDANCE_VERSIONS = {
  full: 23,
  mobile: 20,
  "skill-repository": 14,
  web: 21,
  "web-cms": 21,
} as const satisfies Record<Distribution, number>;
const CMS_GUIDANCE_VERSION = 6;
// The web-cms distribution records the CMS side of its policy on a separate
// guidance track from the standalone CMS distribution.
const WEB_CMS_CMS_GUIDANCE_VERSION = 2;

const DISTRIBUTION_DIRECTORIES = {
  cms: "simple-changelogs-cms",
  full: "simple-changelogs",
  mobile: "simple-changelogs-mobile",
  "skill-repository": "simple-changelogs-skill-maintainer",
  web: "simple-changelogs-web",
  "web-cms": "simple-changelogs-web-cms",
} as const satisfies Record<Distribution | "cms", string>;

// Pinned to the guidance version that introduced the requirement. Comparing
// against the current version would silently retire the invariant on the next
// guidance bump.
const MOBILE_PLACEMENT_MIN_GUIDANCE = 6;
const SHARED_VERSION_LINES_GUIDANCE = 22;

export interface CurationBudget {
  max: number;
  min: number;
}

interface RepoPolicy {
  crossSurfaceVersioning?: CrossSurfaceVersioning;
  curationBudget?: CurationBudget;
  developerChangelog: DeveloperChangelogPolicy;
  distribution?: Distribution;
  guidance: {
    backfillStatus: BackfillStatus;
    version: number;
  };
  majorReleaseNaming?: MajorReleaseNamingPolicy;
  mobileReleaseNotePlacement?: MobileReleaseNotePlacement;
  newReleaseNoteSurfaceComponents?: SurfaceComponentSource;
  newReleaseNoteSurfaces: SurfacePolicy;
  publicReleaseNotes?: PublicReleaseNotePolicy;
  publicVersioning?: PublicVersioningPolicy;
  releaseNoteEnvironmentScope?: ReleaseNoteEnvironmentScope;
  releaseNoteGrouping?: ReleaseNoteGroupingPolicy;
  releaseNoteLinks?: ReleaseNoteLinkPolicy;
  schemaVersion: 1;
  sharedVersionLines?: SharedVersionLine[];
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
    version: number;
  };
  newReleaseNoteSurfaceComponents?: SurfaceComponentSource;
  newReleaseNoteSurfaces: SurfacePolicy;
  schemaVersion: 1;
}

export interface GlobalPreferences {
  developerChangelog: DeveloperChangelogPolicy;
  majorReleaseNaming?: MajorReleaseNamingPolicy;
  newReleaseNoteSurfaces: SurfacePolicy;
  profile: "solo-developer";
  publicVersioning?: PublicVersioningPolicy;
  releaseNoteGrouping?: ReleaseNoteGroupingPolicy;
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
  adjacentDestinations: string[];
  changelogs: {
    exists: boolean;
    path: string;
    releasedHeadings: number;
  }[];
  cmsEvidence: string[];
  designSystemEvidence: string[];
  destinations: string[];
  developerHistoryEvidence: string[];
  releasedHistoryCount: number;
  scan: {
    filesInspected: number;
    truncated: boolean;
  };
  surfaceApplicability: {
    cms: SurfaceApplicability;
    mobile: SurfaceApplicability;
    store: SurfaceApplicability;
    web: SurfaceApplicability;
    workspace: SurfaceApplicability;
  };
  surfaceStructureEvidence: {
    cms: string[];
    mobile: string[];
    store: string[];
    web: string[];
    workspace: string[];
  };
  versionTrains?: VersionTrain[];
}

type SurfaceApplicability = "detected" | "not-detected" | "uncertain";

interface Recommendation {
  cmsPolicy: CmsPolicy | null;
  policy: RepoPolicy | null;
  reusableDefaults: GlobalPreferences;
}

interface Selection {
  backfillStatus?: BackfillStatus;
  crossSurfaceVersioning?: CrossSurfaceVersioning;
  curationBudget?: CurationBudget;
  developerChangelog?: DeveloperChangelogPolicy;
  majorReleaseNaming?: MajorReleaseNamingPolicy;
  mobileReleaseNotePlacement?: MobileReleaseNotePlacement;
  newReleaseNoteSurfaceComponents?: SurfaceComponentSource;
  newReleaseNoteSurfaces?: SurfacePolicy;
  publicReleaseNotes?: PublicReleaseNotePolicy;
  publicVersioning?: PublicVersioningPolicy;
  releaseNoteEnvironmentScope?: ReleaseNoteEnvironmentScope;
  releaseNoteGrouping?: ReleaseNoteGroupingPolicy;
  releaseNoteLinks?: ReleaseNoteLinkPolicy;
  scope?: PreferenceScope;
  setupStyle?: SetupStyle;
  sharedVersionLines?: SharedVersionLine[];
  signatures?: SignaturePolicy;
}

type OptionalSelectionKeys =
  | "crossSurfaceVersioning"
  | "curationBudget"
  | "majorReleaseNaming"
  | "mobileReleaseNotePlacement"
  | "newReleaseNoteSurfaceComponents"
  | "publicReleaseNotes"
  | "publicVersioning"
  | "releaseNoteEnvironmentScope"
  | "releaseNoteGrouping"
  | "releaseNoteLinks"
  | "sharedVersionLines";

type CompleteSelection = Required<Omit<Selection, OptionalSelectionKeys>> &
  Pick<Selection, OptionalSelectionKeys>;

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
  capabilities: IntegrationCapabilities | null;
  cmsPolicy: StateRecord<CmsPolicy> | null;
  command: "apply" | "inspect";
  detection: Detection;
  errors: string[];
  globalPreferences: StateRecord<GlobalPreferences>;
  guidanceUpdate: GuidanceUpdateNotice | null;
  inventory: Inventory;
  onboardingContribution: OnboardingContribution | null;
  onboardingRequired: boolean;
  ownerWriteReceipt: OwnerWriteReceipt | null;
  policy: StateRecord<RepoPolicy> | null;
  publicVersioning: PublicVersioningResolution | null;
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

export interface GuidanceUpdateNotice {
  actions: ("walkthrough" | "continue" | "view-release-notes")[];
  backfillRecommendation: GuidanceBackfillRecommendation;
  changes: {
    backfillRecommendation: GuidanceBackfillRecommendation;
    kinds: GuidanceUpdateKind[];
    summary: string;
    version: number;
  }[];
  currentVersion: number;
  headline: "Simple Changelogs has recently been updated.";
  questions?: ["shared-version-lines"];
  recordedVersion: number;
  releaseNotesOffer: string;
  releaseNotesPath: string;
  summary: string;
  summaryBullets: string[];
  userPrompt: string | null;
  walkthroughQuestion: string;
}

export interface OnboardingContribution {
  destination: ".simple-changelogs.json";
  owner: "simple-changelogs";
  questions: {
    id:
      | "major-release-naming"
      | "public-version-actions"
      | "public-version-suggestions";
    required: boolean;
  }[];
  resolvedPolicy: PublicVersioningPolicy;
  resolvedPreferences: {
    majorReleaseNaming: MajorReleaseNamingPolicy;
    releaseNoteGrouping: ReleaseNoteGroupingPolicy;
  };
  summary: string;
}

export interface OwnerWriteReceipt {
  destination: ".simple-changelogs.json";
  owner: "simple-changelogs";
  policyDigest: string | null;
  status: "completed" | "not-requested";
  written: boolean;
}

// The CMS-only distribution advertises the handoff without the public-version
// features: its classify/prepare/verify transaction is entry-only.
export type IntegrationFeatures =
  | [
      "public-version-policy",
      "classify-prepare-verify",
      "multi-train-receipts",
      "guidance-update-notices",
    ]
  | ["classify-prepare-verify", "guidance-update-notices"];

export interface IntegrationCapabilities {
  distribution: Distribution | "cms";
  features: IntegrationFeatures;
  guidanceVersion: number;
  provider: "simple-changelogs";
  receiptVersions: [1, 2, 3] | [1, 2] | [2];
  requestVersions: [1, 2] | [1];
  schemaDigests: {
    changelogReceipt: string;
    changelogRequest: string;
  };
  schemaVersion: 1;
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
  crossSurfaceVersioning?: CrossSurfaceVersioning;
  curationMax?: number;
  curationMin?: number;
  developerChangelog?: DeveloperChangelogPolicy;
  guidanceBackfill?: BackfillStatus;
  majorReleaseNaming?: MajorReleaseNamingPolicy;
  mobileReleaseNotePlacement?: MobileReleaseNotePlacement;
  newReleaseNoteSurfaceComponents?: SurfaceComponentSource;
  newReleaseNoteSurfaces?: SurfacePolicy;
  publicReleaseNotes?: PublicReleaseNotePolicy;
  publicVersionMajor?: PublicVersionAction;
  publicVersionMinor?: PublicVersionAction;
  publicVersionPatch?: PublicVersionAction;
  publicVersionSuggestions?: "on" | "off";
  releaseNoteEnvironmentScope?: ReleaseNoteEnvironmentScope;
  releaseNoteGrouping?: ReleaseNoteGroupingPolicy;
  releaseNoteLinks?: ReleaseNoteLinkPolicy;
  scope?: PreferenceScope;
  setupStyle?: SetupStyle;
  sharedVersionLines?: SharedVersionLine[];
  signatures?: SignaturePolicy;
}

export interface PublicVersioningPolicy {
  major: PublicVersionAction;
  minor: PublicVersionAction;
  patch: PublicVersionAction;
  suggestWhenAsking: boolean;
}

export interface PublicVersioningResolution {
  effective: PublicVersioningPolicy;
  recommended: PublicVersioningPolicy;
  selected: PublicVersioningPolicy | null;
  source: "missing-field-default" | "repository-policy" | "run-only";
  stored: PublicVersioningPolicy | null;
}

const SAFE_PUBLIC_VERSIONING: PublicVersioningPolicy = {
  major: "ask",
  minor: "ask",
  patch: "ask",
  suggestWhenAsking: true,
};
const DEFAULT_MAJOR_RELEASE_NAMING: MajorReleaseNamingPolicy = "named";
// Applied when publicReleaseNotes is "curated" and no curationBudget is
// stored; the policy field stays absent unless the owner chose exact numbers.
export const DEFAULT_CURATION_BUDGET: CurationBudget = { max: 8, min: 3 };
const DEFAULT_RELEASE_NOTE_GROUPING: ReleaseNoteGroupingPolicy =
  "product-areas";

interface CandidateWrite {
  // The parsed state a rewrite was derived from; see commitSet.
  base?: unknown;
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

const reportUnsupportedOptionalEnum = <T extends string>(
  errors: string[],
  field: string,
  value: unknown,
  values: readonly T[]
): void => {
  if (value !== undefined && !oneOf(value, values)) {
    errors.push(`${field} is unsupported`);
  }
};

const validatePublicVersioning = (
  value: unknown,
  field = "publicVersioning"
): { errors: string[]; value?: PublicVersioningPolicy } => {
  if (
    !(
      isRecord(value) &&
      hasExactKeys(value, ["patch", "minor", "major", "suggestWhenAsking"])
    )
  ) {
    return { errors: [`${field} has missing or unknown fields`] };
  }
  const errors: string[] = [];
  for (const level of ["patch", "minor", "major"] as const) {
    if (!oneOf(value[level], PUBLIC_VERSION_ACTIONS)) {
      errors.push(`${field}.${level} is unsupported`);
    }
  }
  if (typeof value.suggestWhenAsking !== "boolean") {
    errors.push(`${field}.suggestWhenAsking must be boolean`);
  }
  return errors.length === 0
    ? { errors, value: value as unknown as PublicVersioningPolicy }
    : { errors };
};

const stringifyError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const errorCode = (error: unknown): unknown =>
  isRecord(error) ? error.code : undefined;

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Canonical JSON does not support non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("Canonical JSON supports JSON values only");
};

// Structural equality via canonical JSON so re-supplying an identical object
// preference (for example publicVersioning) registers as unchanged.
const sameStoredValue = (left: unknown, right: unknown): boolean =>
  left === right ||
  (left !== undefined &&
    right !== undefined &&
    canonicalJson(left) === canonicalJson(right));

const digestSchema = (source: string): string =>
  sha256(canonicalJson(JSON.parse(source) as unknown));

const capabilitySchemaPath = (filename: string): string => {
  const packageRoot = resolve(import.meta.dir, "..");
  const packaged = join(packageRoot, "schemas", filename);
  return existsSync(packaged)
    ? packaged
    : join(packageRoot, "evals", "schemas", filename);
};

// The CMS-only distribution takes the same classify/prepare/verify handoff
// for its version-less operator history, so it advertises the protocol and
// schema digests but not the public-version features: its handoff is
// entry-only and never selects, bumps, or reconciles a version.
const integrationFeaturesFor = (
  installed: Distribution | "cms"
): IntegrationCapabilities["features"] =>
  installed === "cms"
    ? ["classify-prepare-verify", "guidance-update-notices"]
    : [
        "public-version-policy",
        "classify-prepare-verify",
        "multi-train-receipts",
        "guidance-update-notices",
      ];

const integrationCapabilitiesFor = async (
  installed: Distribution | "cms"
): Promise<IntegrationCapabilities> => {
  const [requestSchema, receiptSchema] = await Promise.all([
    readFile(capabilitySchemaPath("changelog-request.schema.json"), "utf8"),
    readFile(capabilitySchemaPath("changelog-receipt.schema.json"), "utf8"),
  ]);
  // Only full writes request v2's receipt v3 with its version line.
  const full = installed === "full";
  const receiptVersions: [1, 2] | [2] = installed === "cms" ? [2] : [1, 2];
  return {
    distribution: installed,
    features: integrationFeaturesFor(installed),
    guidanceVersion: currentGuidanceVersionFor(installed),
    provider: "simple-changelogs",
    receiptVersions: full ? [1, 2, 3] : receiptVersions,
    requestVersions: full ? [1, 2] : [1],
    schemaDigests: {
      changelogReceipt: digestSchema(receiptSchema),
      changelogRequest: digestSchema(requestSchema),
    },
    schemaVersion: 1,
  };
};

const capabilitiesFor = (
  installed: Distribution | "cms"
): Promise<IntegrationCapabilities> => integrationCapabilitiesFor(installed);

// Canonical source of every shipped changelog-provider.json marker.
export const providerMarkerFor = (
  installed: Distribution | "cms"
): Promise<IntegrationCapabilities> => integrationCapabilitiesFor(installed);

const currentGuidanceVersionFor = (installed: Distribution | "cms"): number =>
  installed === "cms" ? CMS_GUIDANCE_VERSION : GUIDANCE_VERSIONS[installed];

const guidanceReleaseNotesPath = (installed: Distribution | "cms"): string => {
  const packageRoot = resolve(import.meta.dir, "..");
  const packaged = join(packageRoot, "references", "guidance-updates.md");
  if (existsSync(packaged)) {
    return packaged;
  }
  return join(
    packageRoot,
    "..",
    "..",
    "skills",
    DISTRIBUTION_DIRECTORIES[installed],
    "references",
    "guidance-updates.md"
  );
};

const GUIDANCE_UPDATE_MARKER =
  /<!-- simple-changelogs-(cms-)?guidance-update version="(\d+)" kinds="([^"]+)" backfill="(recommended|optional|not-needed)" summary="([^"]+)" -->/gu;

// `cmsTrack` selects the web-cms CMS policy's `cms-` prefixed markers.
export const parseGuidanceUpdateChanges = (
  markdown: string,
  recordedVersion: number,
  currentVersion: number,
  cmsTrack = false
): GuidanceUpdateNotice["changes"] => {
  const changes: GuidanceUpdateNotice["changes"] = [];
  for (const match of markdown.matchAll(GUIDANCE_UPDATE_MARKER)) {
    const [, cms, versionValue, kindValues, backfillRecommendation, summary] =
      match;
    const version = Number(versionValue);
    const kinds = (kindValues ?? "")
      .split(",")
      .filter((kind): kind is GuidanceUpdateKind =>
        oneOf(kind, GUIDANCE_UPDATE_KINDS)
      );
    if (
      Boolean(cms) !== cmsTrack ||
      version <= recordedVersion ||
      version > currentVersion ||
      kinds.length === 0 ||
      !oneOf(backfillRecommendation, GUIDANCE_BACKFILL_RECOMMENDATIONS) ||
      !summary
    ) {
      continue;
    }
    changes.push({ backfillRecommendation, kinds, summary, version });
  }
  return changes.sort((left, right) => left.version - right.version);
};

export const guidanceBackfillRecommendationFor = (
  changes: GuidanceUpdateNotice["changes"]
): GuidanceBackfillRecommendation => {
  if (
    changes.some((change) => change.backfillRecommendation === "recommended")
  ) {
    return "recommended";
  }
  if (changes.some((change) => change.backfillRecommendation === "optional")) {
    return "optional";
  }
  return "not-needed";
};

const guidanceUpdateNoticeFor = async (
  installed: Distribution | "cms",
  policy: RepoPolicy | CmsPolicy | undefined,
  webCmsCmsPolicy?: CmsPolicy
): Promise<GuidanceUpdateNotice | null> => {
  if (!policy) {
    return null;
  }
  // A web-cms CMS policy records guidance on its own second track.
  const tracks = [
    {
      cmsTrack: false,
      current: currentGuidanceVersionFor(installed),
      recorded: policy.guidance.version,
    },
    {
      cmsTrack: true,
      current: WEB_CMS_CMS_GUIDANCE_VERSION,
      recorded: webCmsCmsPolicy
        ? webCmsCmsPolicy.guidance.version
        : WEB_CMS_CMS_GUIDANCE_VERSION,
    },
  ].filter(({ current, recorded }) => recorded < current);
  const [first] = tracks;
  if (!first) {
    return null;
  }
  let notes = "";
  try {
    notes = await readFile(guidanceReleaseNotesPath(installed), "utf8");
  } catch {
    // A source checkout can be mid-update. Still surface the version change;
    // verification will report a missing routed reference separately.
  }
  const changes = tracks.flatMap(
    ({ cmsTrack, current, recorded }): GuidanceUpdateNotice["changes"] => {
      const parsed = parseGuidanceUpdateChanges(
        notes,
        recorded,
        current,
        cmsTrack
      );
      return parsed.length > 0
        ? parsed
        : [
            {
              backfillRecommendation: "optional",
              kinds: ["behavior"],
              summary: `${cmsTrack ? "CMS-track guidance" : "Guidance"} changed from version ${recorded} to ${current}.`,
              version: current,
            },
          ];
    }
  );
  const backfillRecommendation = guidanceBackfillRecommendationFor(changes);
  const releaseNotesOffer =
    "Detailed skill release notes are available if you would like to review them.";
  const changeSummary = changes.map((change) => change.summary).join(" ");
  let backfillSummary =
    "A historical backfill is optional because some released history may benefit from the new guidance.";
  if (backfillRecommendation === "not-needed") {
    backfillSummary = "This update does not call for a historical backfill.";
  } else if (backfillRecommendation === "recommended") {
    backfillSummary =
      "A historical backfill is recommended because released history may benefit from the new guidance.";
  }
  return {
    actions: ["walkthrough", "continue", "view-release-notes"],
    backfillRecommendation,
    changes,
    currentVersion: first.current,
    headline: "Simple Changelogs has recently been updated.",
    recordedVersion: first.recorded,
    releaseNotesOffer,
    releaseNotesPath: "references/guidance-updates.md",
    summary: `${changeSummary} ${backfillSummary}`,
    summaryBullets: changes.slice(-3).map((change) => change.summary),
    userPrompt:
      backfillRecommendation === "not-needed"
        ? null
        : "Would you like to preview the affected released history and run a backfill, defer it, or skip it?",
    walkthroughQuestion:
      "Would you like me to walk you through what changed before I continue?",
  };
};

const validateCurationBudget = (value: unknown): string[] => {
  if (!(isRecord(value) && hasExactKeys(value, ["min", "max"]))) {
    return ["curationBudget must contain exactly min and max"];
  }
  const errors: string[] = [];
  for (const bound of ["min", "max"] as const) {
    if (!(Number.isInteger(value[bound]) && (value[bound] as number) >= 0)) {
      errors.push(`curationBudget.${bound} must be a non-negative integer`);
    }
  }
  if (errors.length === 0 && (value.min as number) > (value.max as number)) {
    errors.push("curationBudget.min must not exceed curationBudget.max");
  }
  return errors;
};

// Full-only; a train joins one line; "shared" crossSurfaceVersioning is one train.
const sharedVersionLineErrors = (value: Record<string, unknown>): string[] => {
  const lines = value.sharedVersionLines;
  if (lines === undefined) {
    return [];
  }
  if (!Array.isArray(lines)) {
    return ["sharedVersionLines must be an array"];
  }
  const errors: string[] = [];
  const valid = lines.filter(
    (line): line is SharedVersionLine =>
      isRecord(line) &&
      hasExactKeys(line, ["mode", "trains"]) &&
      oneOf(line.mode, SHARED_VERSION_LINE_MODES) &&
      Array.isArray(line.trains) &&
      line.trains.length > 1 &&
      line.trains.every((train) => typeof train === "string" && train)
  );
  if (valid.length < lines.length) {
    errors.push("each shared version line needs a mode and 2+ trains");
  }
  const trains = valid.flatMap((line) => line.trains);
  if (new Set(trains).size < trains.length) {
    errors.push("a train repeats in sharedVersionLines");
  }
  if (value.distribution !== undefined && value.distribution !== "full") {
    errors.push("sharedVersionLines applies only to full");
  }
  if (lines.length > 0 && value.crossSurfaceVersioning === "shared") {
    errors.push("sharedVersionLines contradicts crossSurfaceVersioning shared");
  }
  return errors;
};

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
        [
          "crossSurfaceVersioning",
          "curationBudget",
          "distribution",
          "majorReleaseNaming",
          "mobileReleaseNotePlacement",
          "newReleaseNoteSurfaceComponents",
          "publicReleaseNotes",
          "publicVersioning",
          "releaseNoteEnvironmentScope",
          "releaseNoteGrouping",
          "releaseNoteLinks",
          "sharedVersionLines",
        ]
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
  if (value.publicVersioning !== undefined) {
    errors.push(...validatePublicVersioning(value.publicVersioning).errors);
  }
  if (
    value.newReleaseNoteSurfaceComponents !== undefined &&
    !oneOf(value.newReleaseNoteSurfaceComponents, SURFACE_COMPONENT_SOURCES)
  ) {
    errors.push("newReleaseNoteSurfaceComponents is unsupported");
  }
  reportUnsupportedOptionalEnum(
    errors,
    "majorReleaseNaming",
    value.majorReleaseNaming,
    MAJOR_RELEASE_NAMING_POLICIES
  );
  reportUnsupportedOptionalEnum(
    errors,
    "publicReleaseNotes",
    value.publicReleaseNotes,
    PUBLIC_RELEASE_NOTE_POLICIES
  );
  if (value.curationBudget !== undefined) {
    errors.push(...validateCurationBudget(value.curationBudget));
  }
  reportUnsupportedOptionalEnum(
    errors,
    "crossSurfaceVersioning",
    value.crossSurfaceVersioning,
    CROSS_SURFACE_VERSIONING_POLICIES
  );
  errors.push(...sharedVersionLineErrors(value));
  reportUnsupportedOptionalEnum(
    errors,
    "releaseNoteEnvironmentScope",
    value.releaseNoteEnvironmentScope,
    RELEASE_NOTE_ENVIRONMENT_SCOPES
  );
  reportUnsupportedOptionalEnum(
    errors,
    "releaseNoteGrouping",
    value.releaseNoteGrouping,
    RELEASE_NOTE_GROUPING_POLICIES
  );
  reportUnsupportedOptionalEnum(
    errors,
    "releaseNoteLinks",
    value.releaseNoteLinks,
    RELEASE_NOTE_LINK_POLICIES
  );
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
    value.guidance.version >= MOBILE_PLACEMENT_MIN_GUIDANCE &&
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
      hasExactKeys(
        value,
        [
          "schemaVersion",
          "guidance",
          "changelogPath",
          "cmsSurface",
          "newReleaseNoteSurfaces",
        ],
        ["newReleaseNoteSurfaceComponents"]
      )
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
      Number.isInteger(value.guidance.version) &&
      (value.guidance.version as number) >= 1 &&
      oneOf(value.guidance.backfillStatus, BACKFILL_STATUSES)
    )
  ) {
    errors.push(
      "CMS guidance must contain a positive version and a supported backfillStatus"
    );
  }
  if (!oneOf(value.newReleaseNoteSurfaces, SURFACE_POLICIES)) {
    errors.push("CMS newReleaseNoteSurfaces is unsupported");
  }
  if (
    value.newReleaseNoteSurfaceComponents !== undefined &&
    !oneOf(value.newReleaseNoteSurfaceComponents, SURFACE_COMPONENT_SOURCES)
  ) {
    errors.push("CMS newReleaseNoteSurfaceComponents is unsupported");
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
      hasExactKeys(
        value,
        [
          "schemaVersion",
          "profile",
          "developerChangelog",
          "signatures",
          "newReleaseNoteSurfaces",
          "setupStyle",
        ],
        ["majorReleaseNaming", "publicVersioning", "releaseNoteGrouping"]
      )
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
  if (value.publicVersioning !== undefined) {
    errors.push(
      ...validatePublicVersioning(
        value.publicVersioning,
        "global publicVersioning"
      ).errors
    );
  }
  reportUnsupportedOptionalEnum(
    errors,
    "global majorReleaseNaming",
    value.majorReleaseNaming,
    MAJOR_RELEASE_NAMING_POLICIES
  );
  reportUnsupportedOptionalEnum(
    errors,
    "global releaseNoteGrouping",
    value.releaseNoteGrouping,
    RELEASE_NOTE_GROUPING_POLICIES
  );
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
    if (errorCode(error) === "ENOENT") {
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

interface TextFileScan {
  files: string[];
  truncated: boolean;
}

const execFileAsync = promisify(execFile);

// Paths Git ignores (untracked build, cache, and tool output) are not the
// product. Git lists them once, with ignored directories collapsed to one
// "dir/" entry, so the capped walk never spends its budget inside them.
// Outside a Git work tree, or when Git is unavailable, nothing extra is
// skipped.
const gitIgnoredPaths = async (root: string): Promise<Set<string>> => {
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "-C",
        root,
        "ls-files",
        "--others",
        "--ignored",
        "--exclude-standard",
        "--directory",
        "-z",
      ],
      { maxBuffer: 16 * 1024 * 1024, timeout: 10_000 }
    );
    return new Set(
      stdout.split("\0").filter((item) => item !== "" && item !== "./")
    );
  } catch {
    return new Set();
  }
};

// Takes each list's next item in turn, so any prefix the cap keeps holds an
// equal share of every list, and a shorter list leaves its unused share to the
// others.
const interleave = (lists: string[][], cap: number): string[] => {
  const merged: string[] = [];
  for (let index = 0; merged.length < cap; index += 1) {
    const round = lists.flatMap((list) => list.slice(index, index + 1));
    if (round.length === 0) {
      break;
    }
    merged.push(...round);
  }
  return merged.slice(0, cap);
};

// Walks name order, except that each workspace member gets an equal share of
// the budget left when the walk reaches its parent, so one large app cannot
// hide another app's evidence.
const walkTextFiles = async (
  root: string,
  limit = 400
): Promise<TextFileScan> => {
  const workspaceParents = new Set(
    WORKSPACE_PARENTS.map((parent) => join(root, parent))
  );
  const ignored = await gitIgnoredPaths(root);
  const isGitIgnored = (path: string, directory: boolean): boolean => {
    if (ignored.size === 0) {
      return false;
    }
    const gitPath = relative(root, path).split(sep).join("/");
    return ignored.has(directory ? `${gitPath}/` : gitPath);
  };
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
          return IGNORED_DIRECTORIES.has(entry.name) ||
            isHiddenToolDirectory(entry.name) ||
            isGitIgnored(path, true)
            ? []
            : await visit(path);
        }
        const textFile =
          entry.isFile() &&
          !isGitIgnored(path, false) &&
          (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase()) ||
            entry.name === "SKILL.md");
        return textFile ? [path] : [];
      })
    );
    return workspaceParents.has(directory)
      ? interleave(nested, limit + 1)
      : nested.flat().slice(0, limit + 1);
  };
  const discovered = await visit(root);
  return {
    files: discovered.slice(0, limit),
    truncated: discovered.length > limit,
  };
};

const readSmallText = async (path: string): Promise<string> => {
  try {
    const metadata = await stat(path);
    return metadata.size <= 256 * 1024 ? await readFile(path, "utf8") : "";
  } catch {
    return "";
  }
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

const readPackageDependencies = async (root: string): Promise<string[]> => {
  try {
    const packageJson = JSON.parse(
      await readFile(join(root, "package.json"), "utf8")
    ) as unknown;
    return dependencyNames(packageJson);
  } catch {
    // package.json is optional inspection evidence.
    return [];
  }
};

const designSystemDependencyEvidence = (dependencies: string[]): string[] =>
  dependencies.flatMap((name) => {
    if (COMPONENT_LIBRARY_DEPENDENCIES.has(name)) {
      return [`Component library dependency: ${name}`];
    }
    if (
      MOBILE_COMPONENT_KIT_DEPENDENCIES.has(name) ||
      GLUESTACK_DEPENDENCY.test(name)
    ) {
      return [`Mobile component kit dependency: ${name}`];
    }
    return [];
  });

const nativeToolkitFor = (
  lowerPath: string,
  content: string
): string | undefined => {
  if (SWIFT_SOURCE_PATH.test(lowerPath) && SWIFT_UI_CONTENT.test(content)) {
    return "SwiftUI";
  }
  if (GRADLE_SOURCE_PATH.test(lowerPath) && COMPOSE_CONTENT.test(content)) {
    return "Jetpack Compose";
  }
};

interface FileEvidence {
  adjacentDestination: boolean;
  authenticationRelated: boolean;
  cmsPath: boolean;
  componentConfiguration: boolean;
  designSystemPath: string | undefined;
  destination: boolean;
  localPath: string;
  mobileAppPath: boolean;
  nativeToolkit: string | undefined;
  storeMetadataPath: boolean;
  webAppPath: boolean;
  workspaceAppPath: string | undefined;
}

interface EvidenceSets {
  adjacentDestinations: Set<string>;
  cmsEvidence: Set<string>;
  designSystemEvidence: Set<string>;
  destinations: Set<string>;
  mobileStructureEvidence: Set<string>;
  storeStructureEvidence: Set<string>;
  webStructureEvidence: Set<string>;
  workspaceStructureEvidence: Set<string>;
}

const collectSurfaceStructureEvidence = (
  evidence: FileEvidence,
  sets: EvidenceSets
): void => {
  const { localPath } = evidence;
  if (evidence.mobileAppPath) {
    sets.mobileStructureEvidence.add(`Mobile application path: ${localPath}`);
  }
  if (evidence.storeMetadataPath) {
    sets.storeStructureEvidence.add(
      `Store-release metadata path: ${localPath}`
    );
  }
  if (evidence.webAppPath) {
    sets.webStructureEvidence.add(`Web application path: ${localPath}`);
  }
  if (evidence.workspaceAppPath) {
    sets.workspaceStructureEvidence.add(
      `Workspace application path: apps/${evidence.workspaceAppPath}`
    );
  }
};

const collectFileEvidence = (
  fileEvidence: FileEvidence[],
  sets: EvidenceSets
): void => {
  for (const evidence of fileEvidence) {
    const { localPath } = evidence;
    if (evidence.adjacentDestination) {
      sets.adjacentDestinations.add(localPath);
    }
    if (evidence.destination) {
      sets.destinations.add(localPath);
    }
    if (evidence.componentConfiguration) {
      sets.designSystemEvidence.add(
        `Component configuration file: ${COMPONENT_CONFIG_FILE}`
      );
    }
    if (evidence.designSystemPath) {
      sets.designSystemEvidence.add(
        `Repository-owned component library path: ${evidence.designSystemPath}`
      );
    }
    if (evidence.nativeToolkit) {
      sets.designSystemEvidence.add(
        `Platform-native component toolkit: ${evidence.nativeToolkit}`
      );
    }
    if (evidence.cmsPath) {
      sets.cmsEvidence.add(`CMS path: ${localPath}`);
    }
    if (evidence.authenticationRelated) {
      sets.cmsEvidence.add(`Authentication-related code: ${localPath}`);
    }
    collectSurfaceStructureEvidence(evidence, sets);
  }
};

// Release-train version owners; a "$(...)" build variable reads as null.
const versionOwnerFor = (
  path: string,
  content: string
): VersionTrain | undefined => {
  const lower = path.toLowerCase();
  const name = basename(lower);
  const app = WORKSPACE_APP_PATH.exec(lower)?.[1];
  const native = NATIVE_OWNER.exec(lower)?.[1];
  let train = native;
  let raw: unknown;
  try {
    if (native) {
      raw = (name === "info.plist" ? PLIST_VERSION : GRADLE_VERSION).exec(
        content
      )?.[1];
    } else if (name === "app.json") {
      train = app ?? "mobile";
      raw = JSON.parse(content).expo?.version;
    } else if (name === "package.json" && dirname(lower) === `apps/${app}`) {
      train = app;
      raw = JSON.parse(content).version;
    } else if (name === "tauri.conf.json") {
      const config = JSON.parse(content);
      train = "desktop";
      raw = config.version ?? config.package?.version;
    }
  } catch {
    return;
  }
  if (!train || typeof raw !== "string") {
    return;
  }
  return { path, train, version: raw.includes("$") ? null : raw };
};

const ownerPrefix = (path: string): string =>
  dirname(path) === "." ? "" : `${dirname(path)}/`;

// package.json beside another owner, or native files in an Expo app, mirror.
const versionTrainsFrom = (owners: VersionTrain[]): VersionTrain[] => {
  const trains: VersionTrain[] = [];
  for (const owner of owners) {
    const mirror = owners.some((other) =>
      owner.path.endsWith("package.json")
        ? other !== owner && other.path.startsWith(ownerPrefix(owner.path))
        : NATIVE_OWNER.test(owner.path.toLowerCase()) &&
          other.path.endsWith("app.json") &&
          owner.path.startsWith(ownerPrefix(other.path))
    );
    if (!(mirror || trains.some(({ train }) => train === owner.train))) {
      trains.push(owner);
    }
  }
  return trains;
};

const OWNER_FILES = [
  "app.json",
  "package.json",
  "src-tauri/tauri.conf.json",
  "android/app/build.gradle",
  "android/app/build.gradle.kts",
];

// Skips dot (agent, cache), vendored, and build-output directories.
const probeEntries = async (root: string, path: string): Promise<Dirent[]> => {
  try {
    return (await readdir(join(root, path), { withFileTypes: true })).filter(
      (entry) =>
        !(
          entry.isDirectory() &&
          (entry.name.startsWith(".") ||
            entry.name === "Pods" ||
            IGNORED_DIRECTORIES.has(entry.name))
        )
    );
  } catch {
    return [];
  }
};

// Plain react beside a mobile framework is that app's renderer, not web
// evidence, unless the app also renders to the DOM.
const DOM_RENDERER_DEPENDENCIES = new Set(["react-dom", "react-native-web"]);
const webDependencyNames = (names: string[]): string[] => {
  const nativeOnly =
    names.some((name) => MOBILE_DEPENDENCIES.has(name)) &&
    !names.some((name) => DOM_RENDERER_DEPENDENCIES.has(name));
  return names.filter(
    (name) => WEB_DEPENDENCIES.has(name) && !(nativeOnly && name === "react")
  );
};

// Each app directory under apps/ names its own framework dependencies, which
// a monorepo's root manifest usually lacks and the capped walk may never
// reach. Symlinked app directories and ignored names such as build/ are not
// read.
const workspaceAppDependencyEvidence = async (
  root: string
): Promise<{ mobile: string[]; web: string[] }> => {
  const apps = (await probeEntries(root, "apps")).filter((entry) =>
    entry.isDirectory()
  );
  const perApp = await Promise.all(
    apps.map(async (entry) => {
      const app = `apps/${entry.name}`;
      const names = await readPackageDependencies(join(root, app));
      return {
        mobile: names
          .filter((name) => MOBILE_DEPENDENCIES.has(name))
          .map((name) => `Mobile application dependency: ${name} (${app})`),
        web: webDependencyNames(names).map(
          (name) => `Web application dependency: ${name} (${app})`
        ),
      };
    })
  );
  return {
    mobile: perApp.flatMap((app) => app.mobile),
    web: perApp.flatMap((app) => app.web),
  };
};

// Framework dependencies from the root manifest and every workspace app.
const dependencyStructureEvidence = async (
  root: string,
  dependencies: string[]
): Promise<{ mobile: string[]; web: string[] }> => {
  const apps = await workspaceAppDependencyEvidence(root);
  return {
    mobile: [
      ...dependencies
        .filter((name) => MOBILE_DEPENDENCIES.has(name))
        .map((name) => `Mobile application dependency: ${name}`),
      ...apps.mobile,
    ],
    web: [
      ...webDependencyNames(dependencies).map(
        (name) => `Web application dependency: ${name}`
      ),
      ...apps.web,
    ],
  };
};

// Info.plist files at most three directories below ios/ or macos/.
const infoPlists = async (
  root: string,
  path: string,
  depth = 3
): Promise<string[]> => {
  const found = await Promise.all(
    (await probeEntries(root, path)).map((entry) => {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) {
        return depth > 0 ? infoPlists(root, child, depth - 1) : [];
      }
      return entry.name.toLowerCase() === "info.plist" ? [child] : [];
    })
  );
  return found.flat();
};

// Name order within each directory, so a train's first owner holds.
const walkOrder = (left: string, right: string): number => {
  const a = left.split("/");
  const b = right.split("/");
  const at = a.findIndex((part, index) => part !== b[index]);
  return (a[at] ?? "").localeCompare(b[at] ?? "", "en");
};

// Probes known owner spots in the root, apps/*, and packages/*, past the
// capped walk; only apps/*/package.json owns a version, as before.
const versionTrainsIn = async (
  root: string
): Promise<Pick<Inventory, "versionTrains">> => {
  const packages = await Promise.all(
    WORKSPACE_PARENTS.map(async (parent) =>
      (await probeEntries(root, parent)).flatMap((entry) =>
        entry.isDirectory() ? [`${parent}/${entry.name}/`] : []
      )
    )
  );
  const paths = await Promise.all(
    ["", ...packages.flat()].flatMap((base) => [
      OWNER_FILES.map((file) => base + file),
      infoPlists(root, `${base}ios`),
      infoPlists(root, `${base}macos`),
    ])
  );
  const owners = await Promise.all(
    paths
      .flat()
      .sort(walkOrder)
      .map(async (path) =>
        versionOwnerFor(path, await readSmallText(join(root, path)))
      )
  );
  return {
    versionTrains: versionTrainsFrom(owners.flatMap((owner) => owner ?? [])),
  };
};

const inspectInventory = async (
  root: string,
  dependencies: string[],
  withTrains = false
): Promise<Inventory> => {
  const publicPath = join(root, "CHANGELOG.md");
  const developerPath = join(root, "DEVELOPER_CHANGELOG.md");
  const [publicReleases, developerReleases, scan, trains] = await Promise.all([
    countReleasedHeadings(publicPath),
    countReleasedHeadings(developerPath),
    walkTextFiles(root),
    withTrains && versionTrainsIn(root),
  ]);
  const { files } = scan;
  const developerHistoryEvidence: string[] = [];
  if (existsSync(developerPath)) {
    developerHistoryEvidence.push("DEVELOPER_CHANGELOG.md exists");
  }
  const destinations = new Set<string>();
  const adjacentDestinations = new Set<string>();
  const cmsEvidence = new Set<string>();
  const designSystemEvidence = new Set(
    designSystemDependencyEvidence(dependencies)
  );
  const mobileStructureEvidence = new Set<string>();
  const storeStructureEvidence = new Set<string>();
  const webStructureEvidence = new Set<string>();
  const workspaceStructureEvidence = new Set<string>();
  for (const workspaceConfig of [
    "pnpm-workspace.yaml",
    "turbo.json",
    "nx.json",
  ]) {
    if (existsSync(join(root, workspaceConfig))) {
      workspaceStructureEvidence.add(
        `Workspace configuration: ${workspaceConfig}`
      );
    }
  }
  try {
    const packageJson = JSON.parse(
      await readFile(join(root, "package.json"), "utf8")
    ) as unknown;
    if (isRecord(packageJson) && Object.hasOwn(packageJson, "workspaces")) {
      workspaceStructureEvidence.add("Workspace configuration: package.json");
    }
  } catch {
    // package.json workspace evidence is optional.
  }
  const dependencyEvidence = await dependencyStructureEvidence(
    root,
    dependencies
  );
  for (const item of dependencyEvidence.mobile) {
    mobileStructureEvidence.add(item);
  }
  for (const item of dependencyEvidence.web) {
    webStructureEvidence.add(item);
  }
  const fileEvidence = await Promise.all(
    files.map(async (path) => {
      const localPath = relative(root, path).split(sep).join("/");
      const lowerPath = localPath.toLowerCase();
      const content = await readSmallText(path);
      const authenticationRelated =
        AUTH_RELATED_PATH.test(lowerPath) && AUTH_RELATED_CONTENT.test(content);
      const workspaceAppPath = WORKSPACE_APP_PATH.exec(lowerPath)?.[1];
      return {
        adjacentDestination:
          path !== publicPath &&
          path !== developerPath &&
          !NON_DESTINATION_FILES.has(localPath) &&
          ADJACENT_UPDATE_DESTINATION_PATH.test(lowerPath),
        authenticationRelated,
        cmsPath: CMS_PATH.test(lowerPath),
        componentConfiguration: localPath === COMPONENT_CONFIG_FILE,
        designSystemPath: DESIGN_SYSTEM_PATH.exec(lowerPath)?.[1],
        destination:
          path !== publicPath &&
          path !== developerPath &&
          !NON_DESTINATION_FILES.has(localPath) &&
          RELEASE_DESTINATION_PATH.test(lowerPath),
        localPath,
        mobileAppPath: MOBILE_APP_PATH.test(lowerPath),
        nativeToolkit: nativeToolkitFor(lowerPath, content),
        storeMetadataPath: STORE_METADATA_PATH.test(lowerPath),
        webAppPath: WEB_APP_PATH.test(lowerPath),
        workspaceAppPath,
      };
    })
  );
  collectFileEvidence(fileEvidence, {
    adjacentDestinations,
    cmsEvidence,
    designSystemEvidence,
    destinations,
    mobileStructureEvidence,
    storeStructureEvidence,
    webStructureEvidence,
    workspaceStructureEvidence,
  });
  const cmsChangelogPath = join(root, DEFAULT_CMS_CHANGELOG);
  let cmsReleased = 0;
  if (existsSync(cmsChangelogPath)) {
    try {
      const value = JSON.parse(
        await readFile(cmsChangelogPath, "utf8")
      ) as unknown;
      if (isRecord(value) && Array.isArray(value.entries)) {
        cmsReleased = value.entries.length;
        cmsEvidence.add(`CMS changelog source: ${DEFAULT_CMS_CHANGELOG}`);
      }
    } catch {
      cmsEvidence.add(`${DEFAULT_CMS_CHANGELOG} exists but is malformed`);
    }
  }
  const surfaceStructureEvidence = {
    cms: [...cmsEvidence].sort(),
    mobile: [...mobileStructureEvidence].sort(),
    store: [...storeStructureEvidence].sort(),
    web: [...webStructureEvidence].sort(),
    workspace: [...workspaceStructureEvidence].sort(),
  };
  const hasProjectTopologyEvidence =
    surfaceStructureEvidence.cms.length > 0 ||
    surfaceStructureEvidence.mobile.length > 0 ||
    surfaceStructureEvidence.store.length > 0 ||
    surfaceStructureEvidence.web.length > 0 ||
    surfaceStructureEvidence.workspace.length > 0;
  const applicabilityFor = (evidence: string[]): SurfaceApplicability => {
    if (evidence.length > 0) {
      return "detected";
    }
    return !scan.truncated && hasProjectTopologyEvidence
      ? "not-detected"
      : "uncertain";
  };
  return {
    adjacentDestinations: [...adjacentDestinations].sort(),
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
    designSystemEvidence: [...designSystemEvidence].sort(),
    destinations: [...destinations].sort(),
    developerHistoryEvidence,
    releasedHistoryCount: Math.max(
      publicReleases,
      developerReleases,
      cmsReleased
    ),
    scan: {
      filesInspected: files.length,
      truncated: scan.truncated,
    },
    surfaceApplicability: {
      cms: applicabilityFor(surfaceStructureEvidence.cms),
      mobile: applicabilityFor(surfaceStructureEvidence.mobile),
      store: applicabilityFor(surfaceStructureEvidence.store),
      web: applicabilityFor(surfaceStructureEvidence.web),
      workspace: applicabilityFor(surfaceStructureEvidence.workspace),
    },
    surfaceStructureEvidence,
    ...trains,
  };
};

const componentStackEvidence = (dependencies: string[]): string[] => {
  const evidence: string[] = [];
  if (dependencies.some((name) => RADIX_DEPENDENCY.test(name))) {
    evidence.push("Unstyled Radix component primitives are present");
  }
  if (dependencies.some((name) => BASE_UI_DEPENDENCY.test(name))) {
    evidence.push("Unstyled Base UI component primitives are present");
  }
  if (dependencies.some((name) => UTILITY_CSS_DEPENDENCIES.has(name))) {
    evidence.push("Utility CSS is present");
  }
  if (dependencies.includes("react")) {
    evidence.push("Package metadata indicates a React component model");
  }
  return evidence;
};

const inspectProjectEvidence = (
  root: string,
  inventory: Inventory,
  dependencies: string[]
): string[] => {
  const evidence = new Set(componentStackEvidence(dependencies));
  if (webDependencyNames(dependencies).length > 0) {
    evidence.add("Package metadata indicates a web application");
  }
  if (dependencies.some((name) => MOBILE_DEPENDENCIES.has(name))) {
    evidence.add("Package metadata indicates a mobile application");
  }
  if (inventory.designSystemEvidence.length > 0) {
    evidence.add(
      "An established design system or component library is present"
    );
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
      `${inventory.destinations.length} release-note-named destination candidate(s) found`
    );
  }
  if (inventory.adjacentDestinations.length > 0) {
    evidence.add(
      `${inventory.adjacentDestinations.length} updates, news, blog, or announcement destination candidate(s) found`
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
  majorReleaseNaming: DEFAULT_MAJOR_RELEASE_NAMING,
  newReleaseNoteSurfaces: "ask",
  profile: "solo-developer",
  publicVersioning: SAFE_PUBLIC_VERSIONING,
  releaseNoteGrouping: DEFAULT_RELEASE_NOTE_GROUPING,
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
          majorReleaseNaming:
            reusableDefaults.majorReleaseNaming ?? DEFAULT_MAJOR_RELEASE_NAMING,
          newReleaseNoteSurfaces: "ask",
          publicVersioning:
            reusableDefaults.publicVersioning ?? SAFE_PUBLIC_VERSIONING,
          releaseNoteGrouping:
            reusableDefaults.releaseNoteGrouping ??
            DEFAULT_RELEASE_NOTE_GROUPING,
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

const publicVersioningResolutionFor = (
  installed: Distribution | "cms",
  policy: StateRecord<RepoPolicy>,
  selected: PublicVersioningPolicy | null = null,
  runOnly = false
): PublicVersioningResolution | null => {
  if (installed === "cms") {
    return null;
  }
  const stored = policy.value?.publicVersioning ?? null;
  let source: PublicVersioningResolution["source"] = "missing-field-default";
  if (runOnly) {
    source = "run-only";
  } else if (stored) {
    source = "repository-policy";
  }
  return {
    effective: selected ?? stored ?? SAFE_PUBLIC_VERSIONING,
    recommended: SAFE_PUBLIC_VERSIONING,
    selected,
    source,
    stored,
  };
};

const publicVersioningSelectionFrom = (
  options: ApplyOptions,
  fallback?: PublicVersioningPolicy
): PublicVersioningPolicy | undefined => {
  if (
    options.publicVersionPatch === undefined ||
    options.publicVersionMinor === undefined ||
    options.publicVersionMajor === undefined
  ) {
    return fallback;
  }
  return {
    major: options.publicVersionMajor,
    minor: options.publicVersionMinor,
    patch: options.publicVersionPatch,
    suggestWhenAsking:
      options.publicVersionSuggestions === undefined
        ? true
        : options.publicVersionSuggestions === "on",
  };
};

const onboardingContributionFor = (
  installed: Distribution | "cms",
  policy: StateRecord<RepoPolicy>,
  recommendation: Recommendation
): OnboardingContribution | null => {
  if (installed === "cms" || policy.state !== "absent") {
    return null;
  }
  const resolvedPolicy =
    recommendation.policy?.publicVersioning ?? SAFE_PUBLIC_VERSIONING;
  const questions: OnboardingContribution["questions"] = [
    { id: "major-release-naming", required: true },
    { id: "public-version-actions", required: true },
  ];
  if (
    resolvedPolicy.patch === "ask" ||
    resolvedPolicy.minor === "ask" ||
    resolvedPolicy.major === "ask"
  ) {
    questions.push({ id: "public-version-suggestions", required: true });
  }
  return {
    destination: POLICY_FILENAME,
    owner: "simple-changelogs",
    questions,
    resolvedPolicy,
    resolvedPreferences: {
      majorReleaseNaming:
        recommendation.policy?.majorReleaseNaming ??
        DEFAULT_MAJOR_RELEASE_NAMING,
      releaseNoteGrouping:
        recommendation.policy?.releaseNoteGrouping ??
        DEFAULT_RELEASE_NOTE_GROUPING,
    },
    summary:
      "Simple Changelogs owns release-note grouping, major-release naming, and public-version selection; deployment and publication remain separate.",
  };
};

const ownerWriteReceiptFor = (
  policy: RepoPolicy | undefined,
  written: boolean
): OwnerWriteReceipt => ({
  destination: POLICY_FILENAME,
  owner: "simple-changelogs",
  policyDigest: policy ? sha256(json(policy)) : null,
  status: written ? "completed" : "not-requested",
  written,
});

const mobileTopologyQuestionFor = (
  inventory: Inventory
): "mobile-release-note-placement" | "product-topology-confirmation" | null => {
  const { mobile, store } = inventory.surfaceApplicability;
  if (mobile === "detected" || store === "detected") {
    return "mobile-release-note-placement";
  }
  if (mobile === "uncertain" || store === "uncertain") {
    return "product-topology-confirmation";
  }
  return null;
};

// Only full inventories list trains; ask for 2+ unless answered or one train.
const asksVersionLines = (inventory: Inventory, policy?: RepoPolicy): boolean =>
  inventory.versionTrains?.[1] !== undefined &&
  policy?.sharedVersionLines === undefined &&
  policy?.crossSurfaceVersioning !== "shared";

const fullTopologyQuestionsFor = (
  installed: Distribution | "cms",
  inventory: Inventory,
  policy: StateRecord<RepoPolicy>
): string[] => {
  const questions: string[] = [];
  const mobileQuestion = mobileTopologyQuestionFor(inventory);
  if (
    installed === "full" &&
    mobileQuestion &&
    (policy.state === "absent" ||
      policy.value?.mobileReleaseNotePlacement === undefined)
  ) {
    questions.push(mobileQuestion);
  }
  if (policy.state === "absent" && asksVersionLines(inventory)) {
    questions.push("shared-version-lines");
  }
  return questions;
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
  unresolved.push(...fullTopologyQuestionsFor(installed, inventory, policy));
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
  const policyAbsent =
    installed === "cms"
      ? cmsPolicy.state === "absent"
      : policy.state === "absent";
  if (
    installed !== "cms" &&
    installed !== "skill-repository" &&
    policy.state === "absent" &&
    (inventory.destinations.length > 0 ||
      inventory.adjacentDestinations.length > 0)
  ) {
    unresolved.push("release-note-destination-verification");
  }
  if (PRODUCT_SURFACE_DISTRIBUTIONS.has(installed) && policyAbsent) {
    unresolved.push("release-note-surface-offer");
  }
  if (
    installed !== "skill-repository" &&
    policyAbsent &&
    inventory.designSystemEvidence.length === 0
  ) {
    unresolved.push("release-note-surface-components");
  }
  if (installed !== "cms" && policy.state === "absent") {
    unresolved.push("major-release-naming");
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
  const dependencies = await readPackageDependencies(root);
  const [policy, cmsPolicy, globalPreferences, inventory, capabilities] =
    await Promise.all([
      readState(join(root, POLICY_FILENAME), validateRepoPolicy),
      readState(join(root, CMS_POLICY_FILENAME), validateCmsPolicy),
      readState(
        resolveGlobalPreferencesPath(options.configDirectory),
        validateGlobalPreferences
      ),
      inspectInventory(root, dependencies, installed === "full"),
      capabilitiesFor(installed),
    ]);
  const projectEvidence = inspectProjectEvidence(root, inventory, dependencies);
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
  const guidanceUpdate = await guidanceUpdateNoticeFor(
    installed,
    installed === "cms" ? cmsPolicy.value : policy.value,
    installed === "web-cms" ? cmsPolicy.value : undefined
  );
  if (
    guidanceUpdate &&
    guidanceUpdate.recordedVersion < SHARED_VERSION_LINES_GUIDANCE &&
    asksVersionLines(inventory, policy.value)
  ) {
    guidanceUpdate.questions = ["shared-version-lines"];
  }
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
    capabilities,
    cmsPolicy:
      installed === "cms" || installed === "web-cms" ? cmsPolicy : null,
    command: "inspect",
    detection,
    errors: [
      ...relevantPolicy.errors,
      ...(installed === "web-cms" ? cmsPolicy.errors : []),
    ],
    globalPreferences,
    guidanceUpdate,
    inventory,
    onboardingContribution: onboardingContributionFor(
      installed,
      policy,
      recommendation
    ),
    onboardingRequired,
    ownerWriteReceipt:
      installed === "cms" ? null : ownerWriteReceiptFor(policy.value, false),
    policy: installed === "cms" ? null : policy,
    publicVersioning: publicVersioningResolutionFor(installed, policy),
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
    if (errorCode(error) === "ENOENT") {
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
    if (errorCode(error) === "ENOENT") {
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

// Every setup write holds one transaction marker. It is created exclusively
// before any target is read, so concurrent runs serialize, and it records each
// target's prior content so a later run can roll an interrupted write back.
const ROOT_FILE_NAME = /^(?!\.\.?$)[^/\\]+$/u;
const STALE_TRANSACTION_MS = 600_000;

interface TransactionMarker {
  pid: number;
  schemaVersion: 2;
  targets: Record<string, string | null>;
}

const stageMarker = (
  markerPath: string,
  targets: TransactionMarker["targets"] = {}
): ReturnType<typeof stageFile> =>
  stageFile({
    content: json({ pid: process.pid, schemaVersion: 2, targets }),
    kind: "repository-policy",
    mode: 0o600,
    path: markerPath,
  });

const parseMarker = (raw: string): TransactionMarker | null => {
  try {
    const marker = JSON.parse(raw) as unknown;
    if (
      isRecord(marker) &&
      marker.schemaVersion === 2 &&
      Number.isInteger(marker.pid) &&
      isRecord(marker.targets) &&
      Object.entries(marker.targets).every(
        ([name, prior]) =>
          ROOT_FILE_NAME.test(name) &&
          (prior === null || typeof prior === "string")
      )
    ) {
      return marker as unknown as TransactionMarker;
    }
  } catch {
    // An unreadable marker gets the remediation error instead.
  }
  return null;
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === "EPERM";
  }
};

// Restores the prior content recorded by a run that stopped mid-transaction.
const recoverTransaction = async (markerPath: string): Promise<void> => {
  let raw: string;
  let age: number;
  try {
    raw = await readFile(markerPath, "utf8");
    age = Date.now() - (await stat(markerPath)).mtimeMs;
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return;
    }
    throw error;
  }
  const marker = parseMarker(raw);
  if (!marker) {
    throw new Error(
      `Unfinished setup transaction ${markerPath} has no recovery data; confirm each file it names holds the intended content, then delete it.`
    );
  }
  const held = `Another setup run holds ${markerPath}; retry after it finishes.`;
  if (isAlive(marker.pid) && age < STALE_TRANSACTION_MS) {
    throw new Error(held);
  }
  // Claim the orphan under a private name so only one run rolls it back.
  const claimed = `${markerPath}.${process.pid}-${crypto.randomUUID()}`;
  try {
    await rename(markerPath, claimed);
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return;
    }
    throw error;
  }
  const release = async (error: Error): Promise<never> => {
    await link(claimed, markerPath).catch(() => undefined);
    await rm(claimed, { force: true });
    throw error;
  };
  if ((await readFile(claimed, "utf8")) !== raw) {
    await release(new Error(held));
  }
  try {
    await Promise.all(
      Object.entries(marker.targets).map(async ([name, prior]) => {
        const path = join(dirname(markerPath), name);
        await ensureNoSymlink(path);
        await (prior === null
          ? rm(path, { force: true })
          : writeFile(path, prior));
      })
    );
  } catch (error) {
    await release(error as Error);
  }
  await rm(claimed, { force: true });
};

const acquireTransaction = async (markerPath: string): Promise<void> => {
  const lock = await stageMarker(markerPath);
  const attempt = async (): Promise<void> => {
    try {
      await link(lock.temporaryPath, markerPath);
    } catch (error) {
      if (errorCode(error) !== "EEXIST") {
        throw error;
      }
      await recoverTransaction(markerPath);
      await attempt();
    }
  };
  try {
    await attempt();
  } finally {
    await rm(lock.temporaryPath, { force: true });
  }
};

const holdsValue = (text: string | null, value: unknown): boolean => {
  try {
    return text !== null && sameStoredValue(JSON.parse(text), value);
  } catch {
    return false;
  }
};

// Onboarding creates only absent targets. A `replace` rewrite requires each
// target to still hold the `base` its candidate was derived from.
const commitSet = async (
  root: string,
  candidates: CandidateWrite[],
  replace = false
): Promise<WriteRecord[]> => {
  const markerPath = join(root, SETUP_TRANSACTION_FILENAME);
  await acquireTransaction(markerPath);
  const priors = new Map<CandidateWrite, string | null>();
  const renamed: CandidateWrite[] = [];
  let staged: Awaited<ReturnType<typeof stageFile>>[] = [];
  try {
    await Promise.all(
      candidates.map(async (candidate) => {
        await ensureNoSymlink(candidate.path);
        priors.set(
          candidate,
          existsSync(candidate.path)
            ? await readFile(candidate.path, "utf8")
            : null
        );
      })
    );
    const prior = (candidate: CandidateWrite): string | null =>
      priors.get(candidate) ?? null;
    if (
      replace &&
      candidates.some(
        (candidate) => !holdsValue(prior(candidate), candidate.base)
      )
    ) {
      throw new Error(
        "Setup state changed after this run inspected it; inspect again and retry."
      );
    }
    const pending = candidates.filter(
      (candidate) => replace || prior(candidate) === null
    );
    const marker = await stageMarker(
      markerPath,
      Object.fromEntries(
        pending.map((candidate) => [basename(candidate.path), prior(candidate)])
      )
    );
    await rename(marker.temporaryPath, markerPath);
    staged = await stageCandidates(pending);
    const failure = (
      await Promise.allSettled(
        staged.map(async ({ candidate, temporaryPath }) => {
          await ensureNoSymlink(candidate.path);
          if (!replace) {
            await ensureAbsent(candidate.path);
          }
          await rename(temporaryPath, candidate.path);
          renamed.push(candidate);
          await chmod(candidate.path, candidate.mode);
        })
      )
    ).find((result) => result.status === "rejected");
    if (failure) {
      throw failure.reason;
    }
    await unlink(markerPath);
    return candidates.map((candidate) => ({
      kind: candidate.kind,
      path: candidate.path,
      written: pending.includes(candidate),
    }));
  } catch (error) {
    try {
      await Promise.all([
        ...staged.map(({ temporaryPath }) =>
          rm(temporaryPath, { force: true })
        ),
        ...renamed.map((candidate) => {
          const content = priors.get(candidate) ?? null;
          return content === null
            ? rm(candidate.path, { force: true })
            : writeFile(candidate.path, content, { mode: candidate.mode });
        }),
      ]);
      await rm(markerPath, { force: true });
    } catch {
      // The marker stays so the next run finishes this rollback.
    }
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

const curationBudgetSelectionFrom = (
  options: ApplyOptions
): CurationBudget | undefined =>
  options.curationMin === undefined || options.curationMax === undefined
    ? undefined
    : { max: options.curationMax, min: options.curationMin };

const selectionFrom = (
  options: ApplyOptions,
  inspect: SetupResult,
  installed: Distribution | "cms"
): CompleteSelection => {
  const defaults = inspect.recommendation.reusableDefaults;
  const publicVersioning =
    installed === "cms"
      ? undefined
      : publicVersioningSelectionFrom(
          options,
          defaults.publicVersioning ?? SAFE_PUBLIC_VERSIONING
        );
  const majorReleaseNaming =
    installed === "cms"
      ? undefined
      : (options.majorReleaseNaming ??
        defaults.majorReleaseNaming ??
        DEFAULT_MAJOR_RELEASE_NAMING);
  const releaseNoteGrouping =
    installed === "cms"
      ? undefined
      : (options.releaseNoteGrouping ??
        defaults.releaseNoteGrouping ??
        DEFAULT_RELEASE_NOTE_GROUPING);
  const inferredMobilePlacement =
    installed === "full" &&
    inspect.inventory.surfaceApplicability.mobile === "not-detected" &&
    inspect.inventory.surfaceApplicability.store === "not-detected"
      ? "mobile-only"
      : undefined;
  return {
    backfillStatus:
      options.backfillStatus ??
      (inspect.inventory.releasedHistoryCount === 0
        ? "not-applicable"
        : "partial"),
    crossSurfaceVersioning: options.crossSurfaceVersioning,
    curationBudget: curationBudgetSelectionFrom(options),
    developerChangelog:
      options.developerChangelog ?? defaults.developerChangelog,
    majorReleaseNaming,
    mobileReleaseNotePlacement:
      options.mobileReleaseNotePlacement ?? inferredMobilePlacement,
    newReleaseNoteSurfaceComponents:
      options.newReleaseNoteSurfaceComponents ??
      (inspect.inventory.designSystemEvidence.length > 0
        ? "project-components"
        : undefined),
    newReleaseNoteSurfaces: options.newReleaseNoteSurfaces ?? "ask",
    publicReleaseNotes:
      installed === "cms" ? undefined : options.publicReleaseNotes,
    publicVersioning,
    releaseNoteEnvironmentScope: options.releaseNoteEnvironmentScope,
    releaseNoteGrouping,
    releaseNoteLinks: options.releaseNoteLinks,
    scope: options.scope ?? "repository",
    setupStyle: options.setupStyle ?? defaults.setupStyle,
    sharedVersionLines: options.sharedVersionLines,
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
  options: ApplyOptions,
  installed: Distribution | "cms"
): CmsPolicy => {
  const policy: CmsPolicy = {
    changelogPath: options.cmsChangelog ?? DEFAULT_CMS_CHANGELOG,
    cmsSurface: {
      access: "authenticated-operators",
      route: options.cmsRoute ?? "",
    },
    guidance: {
      backfillStatus: selection.backfillStatus,
      version:
        installed === "cms"
          ? CMS_GUIDANCE_VERSION
          : WEB_CMS_CMS_GUIDANCE_VERSION,
    },
    newReleaseNoteSurfaces: options.newReleaseNoteSurfaces ?? "existing-only",
    schemaVersion: 1,
  };
  if (selection.newReleaseNoteSurfaceComponents !== undefined) {
    policy.newReleaseNoteSurfaceComponents =
      selection.newReleaseNoteSurfaceComponents;
  }
  return policy;
};

const globalFor = (
  selection: CompleteSelection,
  newReleaseNoteSurfaces = selection.newReleaseNoteSurfaces
): GlobalPreferences => ({
  developerChangelog: selection.developerChangelog,
  majorReleaseNaming: selection.majorReleaseNaming,
  newReleaseNoteSurfaces,
  profile: "solo-developer",
  publicVersioning: selection.publicVersioning,
  releaseNoteGrouping: selection.releaseNoteGrouping,
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
    majorReleaseNaming:
      selection.majorReleaseNaming ?? DEFAULT_MAJOR_RELEASE_NAMING,
    newReleaseNoteSurfaces: selection.newReleaseNoteSurfaces,
    publicVersioning: selection.publicVersioning,
    releaseNoteGrouping:
      selection.releaseNoteGrouping ?? DEFAULT_RELEASE_NOTE_GROUPING,
    schemaVersion: 1,
    signatures: selection.signatures,
  };
  if (installed === "full") {
    policy.mobileReleaseNotePlacement = selection.mobileReleaseNotePlacement;
  }
  if (selection.newReleaseNoteSurfaceComponents !== undefined) {
    policy.newReleaseNoteSurfaceComponents =
      selection.newReleaseNoteSurfaceComponents;
  }
  if (selection.crossSurfaceVersioning !== undefined) {
    policy.crossSurfaceVersioning = selection.crossSurfaceVersioning;
  }
  if (selection.publicReleaseNotes !== undefined) {
    policy.publicReleaseNotes = selection.publicReleaseNotes;
  }
  if (selection.curationBudget !== undefined) {
    policy.curationBudget = selection.curationBudget;
  }
  if (selection.releaseNoteEnvironmentScope !== undefined) {
    policy.releaseNoteEnvironmentScope = selection.releaseNoteEnvironmentScope;
  }
  if (selection.releaseNoteLinks !== undefined) {
    policy.releaseNoteLinks = selection.releaseNoteLinks;
  }
  if (selection.sharedVersionLines !== undefined) {
    policy.sharedVersionLines = selection.sharedVersionLines;
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

// Rewrites configured state in one transaction, then revalidates it.
const replaceState = async (
  inspect: SetupResult,
  installed: Distribution | "cms",
  candidates: CandidateWrite[]
): Promise<{ errors: string[]; writes: WriteRecord[] }> => {
  try {
    const writes = await commitSet(inspect.repository, candidates, true);
    return {
      errors: await validateStoredPolicies(installed, inspect.repository),
      writes,
    };
  } catch (error) {
    return {
      errors: [`Setup write failed: ${stringifyError(error)}`],
      writes: [],
    };
  }
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
      base: standard,
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
      base: cms,
      content: json({
        ...cms,
        guidance: { ...cms.guidance, backfillStatus: "completed" },
      }),
      kind: "cms-policy",
      mode: 0o644,
      path: cmsPath,
    });
  }
  const { errors, writes } = await replaceState(inspect, installed, candidates);
  return errors.length > 0
    ? blockResult(inspect, errors)
    : {
        ...inspect,
        command: "apply",
        errors: [],
        ownerWriteReceipt: standard
          ? ownerWriteReceiptFor(
              {
                ...standard,
                guidance: { ...standard.guidance, backfillStatus: "completed" },
              },
              true
            )
          : inspect.ownerWriteReceipt,
        selection: { backfillStatus: "completed" },
        status: "configured",
        summary:
          "The verified released-history audit is now recorded as completed.",
        writes,
      };
};

/**
 * Records the user's one-time disposition for newly installed guidance. This
 * path is intentionally separate from onboarding and from completing an
 * already-started historical audit.
 */
const guidanceDispositionError = (
  options: ApplyOptions,
  inspect: SetupResult,
  disposition: BackfillStatus
): string | null => {
  const notice = inspect.guidanceUpdate;
  if (!notice) {
    return "No unacknowledged guidance update is available for this repository.";
  }
  if (!options.confirm) {
    return "Confirmation is required before recording a guidance-update disposition.";
  }
  if (disposition === "completed" && !options.auditVerified) {
    return "A guidance-update backfill can be recorded as completed only with --audit-verified.";
  }
  if (
    notice.backfillRecommendation === "not-needed" &&
    disposition !== "not-applicable"
  ) {
    return "This guidance update has no historical backfill; record --guidance-backfill not-applicable.";
  }
  if (
    notice.backfillRecommendation !== "not-needed" &&
    disposition === "not-applicable" &&
    inspect.inventory.releasedHistoryCount > 0
  ) {
    return "Released history exists; choose partial, deferred, declined, failed, or verified completed for this update.";
  }
  return null;
};

const updateGuidanceDisposition = async (
  options: ApplyOptions,
  inspect: SetupResult,
  installed: Distribution | "cms"
): Promise<SetupResult | null> => {
  const disposition = options.guidanceBackfill;
  if (disposition === undefined) {
    return null;
  }
  const preconditionError = guidanceDispositionError(
    options,
    inspect,
    disposition
  );
  if (preconditionError) {
    return blockResult(inspect, [preconditionError]);
  }
  const record = installed === "cms" ? inspect.cmsPolicy : inspect.policy;
  if (record?.state !== "valid" || record.value === undefined) {
    return blockResult(inspect, [
      "A valid repository policy is required before recording a guidance update.",
    ]);
  }
  // Recorded versions never decrease, so acknowledging one track cannot
  // lower the other below what a newer helper already recorded.
  const lines = options.sharedVersionLines && {
    sharedVersionLines: options.sharedVersionLines,
  };
  const updatedPolicy = {
    ...record.value,
    ...lines,
    guidance: {
      backfillStatus: disposition,
      version: Math.max(
        record.value.guidance.version,
        currentGuidanceVersionFor(installed)
      ),
    },
  };
  const candidates: CandidateWrite[] = [
    {
      base: record.value,
      content: json(updatedPolicy),
      kind: installed === "cms" ? "cms-policy" : "repository-policy",
      mode: 0o644,
      path: record.path,
    },
  ];
  if (installed === "web-cms") {
    // The web-cms distribution keeps a second guidance block on the CMS
    // policy's own track; acknowledging an update must advance both files
    // together or neither.
    const cmsRecord = inspect.cmsPolicy;
    if (cmsRecord?.state !== "valid" || cmsRecord.value === undefined) {
      return blockResult(inspect, [
        "A valid CMS policy is required before recording a guidance update for a web+CMS repository.",
      ]);
    }
    candidates.push({
      base: cmsRecord.value,
      content: json({
        ...cmsRecord.value,
        guidance: {
          backfillStatus: disposition,
          version: Math.max(
            cmsRecord.value.guidance.version,
            WEB_CMS_CMS_GUIDANCE_VERSION
          ),
        },
      }),
      kind: "cms-policy",
      mode: 0o644,
      path: cmsRecord.path,
    });
  }
  const { errors, writes } = await replaceState(inspect, installed, candidates);
  return errors.length > 0
    ? blockResult(inspect, errors)
    : {
        ...inspect,
        command: "apply",
        errors: [],
        guidanceUpdate: null,
        ownerWriteReceipt:
          installed === "cms"
            ? null
            : ownerWriteReceiptFor(updatedPolicy as RepoPolicy, true),
        selection: { backfillStatus: disposition, ...lines },
        status: "configured",
        summary:
          disposition === "partial"
            ? "The guidance update is acknowledged and its historical backfill is recorded as in progress."
            : "The guidance update and its historical-backfill disposition are recorded.",
        writes,
      };
};

/**
 * Records explicit contextual preferences against already-valid repository
 * policy. Ordinary apply refuses to touch configured repositories, so this
 * rewrites only the supplied fields and preserves everything else.
 */
const contextualPreferenceErrors = (
  options: ApplyOptions,
  installed: Distribution | "cms" | null
): string[] => {
  const errors: string[] = [];
  const publicHistoryPreferenceRequested =
    options.majorReleaseNaming !== undefined ||
    options.releaseNoteGrouping !== undefined;
  if (publicHistoryPreferenceRequested && installed === "cms") {
    errors.push(
      "Release-note grouping and major-release naming apply only to distributions with public release history."
    );
  }
  if (
    (options.publicReleaseNotes !== undefined ||
      options.curationMin !== undefined ||
      options.curationMax !== undefined) &&
    installed === "cms"
  ) {
    errors.push(
      "Public release-note curation applies only to distributions with public release history."
    );
  }
  if (
    options.releaseNoteEnvironmentScope !== undefined &&
    !WEB_RELEASE_NOTE_DISTRIBUTIONS.has(installed as Distribution)
  ) {
    errors.push(
      "Release-note environment scope applies only to full, web, and web+CMS distributions."
    );
  }
  if (
    options.releaseNoteLinks !== undefined &&
    !PRODUCT_RELEASE_NOTE_LINK_DISTRIBUTIONS.has(installed as Distribution)
  ) {
    errors.push(
      "Release-note link policy applies only to full, web, mobile, and web+CMS distributions."
    );
  }
  return errors;
};

const updateContextualPreferences = async (
  options: ApplyOptions,
  inspect: SetupResult,
  installed: Distribution | "cms"
): Promise<SetupResult | null> => {
  const applicabilityErrors = contextualPreferenceErrors(options, installed);
  if (applicabilityErrors.length > 0) {
    return blockResult(inspect, applicabilityErrors);
  }
  const selection: Selection = {};
  const updates: Partial<RepoPolicy> = {};
  const publicVersioning = publicVersioningSelectionFrom(options);
  if (publicVersioning) {
    selection.publicVersioning = publicVersioning;
    updates.publicVersioning = publicVersioning;
  }
  if (options.crossSurfaceVersioning !== undefined) {
    selection.crossSurfaceVersioning = options.crossSurfaceVersioning;
    updates.crossSurfaceVersioning = options.crossSurfaceVersioning;
  }
  if (options.publicReleaseNotes !== undefined) {
    selection.publicReleaseNotes = options.publicReleaseNotes;
    updates.publicReleaseNotes = options.publicReleaseNotes;
  }
  const curationBudget = curationBudgetSelectionFrom(options);
  if (curationBudget) {
    selection.curationBudget = curationBudget;
    updates.curationBudget = curationBudget;
  }
  if (options.majorReleaseNaming !== undefined) {
    selection.majorReleaseNaming = options.majorReleaseNaming;
    updates.majorReleaseNaming = options.majorReleaseNaming;
  }
  if (options.releaseNoteEnvironmentScope !== undefined) {
    selection.releaseNoteEnvironmentScope = options.releaseNoteEnvironmentScope;
    updates.releaseNoteEnvironmentScope = options.releaseNoteEnvironmentScope;
  }
  if (options.releaseNoteGrouping !== undefined) {
    selection.releaseNoteGrouping = options.releaseNoteGrouping;
    updates.releaseNoteGrouping = options.releaseNoteGrouping;
  }
  if (options.releaseNoteLinks !== undefined) {
    selection.releaseNoteLinks = options.releaseNoteLinks;
    updates.releaseNoteLinks = options.releaseNoteLinks;
  }
  if (options.sharedVersionLines !== undefined) {
    selection.sharedVersionLines = options.sharedVersionLines;
    updates.sharedVersionLines = options.sharedVersionLines;
  }
  const record = inspect.policy;
  if (
    Object.keys(updates).length === 0 ||
    record?.state !== "valid" ||
    record.value === undefined
  ) {
    return null;
  }
  const current = record.value;
  const { path } = record;
  if (
    Object.entries(updates).every(([key, value]) =>
      sameStoredValue(current[key as keyof RepoPolicy], value)
    )
  ) {
    return {
      ...inspect,
      command: "apply",
      publicVersioning: selection.publicVersioning
        ? {
            effective: selection.publicVersioning,
            recommended: SAFE_PUBLIC_VERSIONING,
            selected: selection.publicVersioning,
            source: "repository-policy",
            stored: selection.publicVersioning,
          }
        : inspect.publicVersioning,
      selection,
      status: "already-configured",
      summary:
        "Repository policy already records the selected contextual preferences.",
    };
  }
  if (!options.confirm) {
    return blockResult(inspect, [
      "Confirmation is required before recording contextual repository preferences.",
    ]);
  }
  const { errors, writes } = await replaceState(inspect, installed, [
    {
      base: current,
      content: json({ ...current, ...updates }),
      kind: "repository-policy",
      mode: 0o644,
      path,
    },
  ]);
  return errors.length > 0
    ? blockResult(inspect, errors)
    : {
        ...inspect,
        command: "apply",
        errors: [],
        ownerWriteReceipt: ownerWriteReceiptFor(
          { ...current, ...updates },
          true
        ),
        publicVersioning: selection.publicVersioning
          ? {
              effective: selection.publicVersioning,
              recommended: SAFE_PUBLIC_VERSIONING,
              selected: selection.publicVersioning,
              source: "repository-policy",
              stored: selection.publicVersioning,
            }
          : inspect.publicVersioning,
        selection,
        status: "configured",
        summary:
          "Repository policy now records the selected contextual preferences; no other setup value changed.",
        writes,
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
  return null;
};

const selectionErrors = (
  options: ApplyOptions,
  inspect: SetupResult,
  selection: CompleteSelection,
  installed: Distribution | "cms"
): string[] => {
  const errors = contextualPreferenceErrors(options, installed);
  if (
    installed === "full" &&
    selection.mobileReleaseNotePlacement === undefined
  ) {
    errors.push(
      "Full web/mobile setup requires --mobile-placement with store-only, mobile-only, web-tabs, or web-page."
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
  publicVersioning: selection.publicVersioning
    ? {
        effective: selection.publicVersioning,
        recommended: SAFE_PUBLIC_VERSIONING,
        selected: selection.publicVersioning,
        source: "run-only",
        stored: inspect.publicVersioning?.stored ?? null,
      }
    : inspect.publicVersioning,
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
    const cmsPolicy = cmsPolicyFor(selection, options, installed);
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
    writes = await commitSet(inspect.repository, candidates);
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
    const budget = selection.curationBudget ?? DEFAULT_CURATION_BUDGET;
    const curatedNote =
      selection.publicReleaseNotes === "curated"
        ? ` Public release notes are curated: RELEASE_NOTES.md is derived from CHANGELOG.md at release boundaries with ${budget.min}-${budget.max} highlights per release.`
        : "";
    return {
      ...inspect,
      command: "apply",
      errors: [],
      onboardingContribution: null,
      onboardingRequired: false,
      ownerWriteReceipt:
        installed === "cms"
          ? null
          : ownerWriteReceiptFor(repoPolicyFor(installed, selection), true),
      publicVersioning: selection.publicVersioning
        ? {
            effective: selection.publicVersioning,
            recommended: SAFE_PUBLIC_VERSIONING,
            selected: selection.publicVersioning,
            source: "repository-policy",
            stored: selection.publicVersioning,
          }
        : inspect.publicVersioning,
      selection,
      status: "configured",
      summary: `Simple Changelogs ${selectedLabel} is configured.${curatedNote} Repository-specific audiences, destinations, history, and authority remain repository-owned.`,
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

// The curation-budget flags interlock: both bounds arrive together, they must
// form a valid budget, and they apply only to curated public release notes.
const curationSelectionErrors = (
  options: ApplyOptions,
  inspect: SetupResult
): string[] => {
  const suppliedCurationBounds = [
    options.curationMin,
    options.curationMax,
  ].filter((value) => value !== undefined).length;
  if (suppliedCurationBounds === 0) {
    return [];
  }
  if (suppliedCurationBounds === 1) {
    return [
      "Supplying a curation budget requires --curation-min and --curation-max together.",
    ];
  }
  const budgetErrors = validateCurationBudget({
    max: options.curationMax,
    min: options.curationMin,
  });
  if (budgetErrors.length > 0) {
    return budgetErrors;
  }
  const effectiveLayerPolicy =
    options.publicReleaseNotes ?? inspect.policy?.value?.publicReleaseNotes;
  if (effectiveLayerPolicy !== "curated") {
    return [
      "A curation budget requires curated public release notes; pass --public-release-notes curated or store it first.",
    ];
  }
  return [];
};

const sharedVersionLineApplyErrors = (
  options: ApplyOptions,
  inspect: SetupResult,
  installed: Distribution | "cms"
): string[] => {
  const lines = options.sharedVersionLines;
  if (lines && installed !== "full") {
    return ["Shared version lines apply only to full."];
  }
  if (lines && options.scope === "run-only") {
    return ["Shared version lines are never run-only."];
  }
  const stored = inspect.policy?.value;
  const errors = sharedVersionLineErrors({
    crossSurfaceVersioning:
      options.crossSurfaceVersioning ?? stored?.crossSurfaceVersioning,
    sharedVersionLines: lines ?? stored?.sharedVersionLines,
  });
  const listed = errors.length > 0 ? [] : lines?.flatMap((line) => line.trains);
  for (const { train, version } of inspect.inventory.versionTrains ?? []) {
    if (listed?.includes(train) && version && !PUBLIC_VERSION.test(version)) {
      errors.push(`${train} has no numbered version (${version}) to share.`);
    }
  }
  return errors;
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
  if (!inspect.writeCapable) {
    // Read-only tasks must never rewrite durable setup state on any apply
    // path, including audit completion, guidance dispositions, and
    // contextual preference updates.
    return blockResult(inspect, [
      "Read-only tasks cannot apply onboarding state.",
    ]);
  }
  if (inspect.status === "blocked") {
    // Conflicting or malformed state blocks every apply path, including
    // post-onboarding updates, exactly as inspection reports it.
    return { ...inspect, command: "apply" };
  }
  const suppliedVersionActions = [
    options.publicVersionPatch,
    options.publicVersionMinor,
    options.publicVersionMajor,
  ].filter((value) => value !== undefined).length;
  if (suppliedVersionActions > 0 && suppliedVersionActions < 3) {
    return blockResult(inspect, [
      "Supplying any public-version bump action requires --version-patch, --version-minor, and --version-major together.",
    ]);
  }
  if (
    options.publicVersionSuggestions !== undefined &&
    suppliedVersionActions === 0
  ) {
    return blockResult(inspect, [
      "--version-suggestions requires the complete public-version bump selection.",
    ]);
  }
  if (
    suppliedVersionActions === 3 &&
    options.publicVersionSuggestions === undefined &&
    !(
      options.publicVersionPatch === "ask" &&
      options.publicVersionMinor === "ask" &&
      options.publicVersionMajor === "ask"
    )
  ) {
    return blockResult(inspect, [
      "--version-suggestions may be omitted only for the complete ask/ask/ask default.",
    ]);
  }
  // Checked before every write path so an invalid line is never stored.
  const curationErrors = [
    ...curationSelectionErrors(options, inspect),
    ...sharedVersionLineApplyErrors(options, inspect, installed),
  ];
  if (curationErrors.length > 0) {
    return blockResult(inspect, curationErrors);
  }
  const auditCompletion = await completePartialAudit(
    options,
    inspect,
    installed
  );
  if (auditCompletion) {
    return auditCompletion;
  }
  const guidanceDisposition = await updateGuidanceDisposition(
    options,
    inspect,
    installed
  );
  if (guidanceDisposition) {
    return guidanceDisposition;
  }
  const contextualUpdate = await updateContextualPreferences(
    options,
    inspect,
    installed
  );
  if (contextualUpdate) {
    return contextualUpdate;
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
  "--cross-surface-versioning",
  "--curation-max",
  "--curation-min",
  "--developer-history",
  "--guidance-backfill",
  "--major-release-naming",
  "--mobile-placement",
  "--new-surfaces",
  "--public-release-notes",
  "--release-note-environments",
  "--release-note-grouping",
  "--release-note-links",
  "--repo",
  "--scope",
  "--setup-style",
  "--shared-version-lines",
  "--signatures",
  "--surface-components",
  "--task-mode",
  "--version-major",
  "--version-minor",
  "--version-patch",
  "--version-suggestions",
]);
const booleanOptionNames = new Set([
  "--audit-verified",
  "--cms-auth-proven",
  "--cms-surface-proven",
  "--confirm",
  "--json",
]);

const NON_NEGATIVE_INTEGER = /^(?:0|[1-9]\d{0,8})$/u;

export const parseCli = (argv: string[]): ParsedCli => {
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
  const integerValue = (name: string): number | undefined => {
    const value = values.get(name);
    if (value === undefined) {
      return;
    }
    if (!NON_NEGATIVE_INTEGER.test(value)) {
      throw new Error(`${name} must be a non-negative integer`);
    }
    return Number(value);
  };
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
  const lines = values.get("--shared-version-lines");
  let sharedVersionLines: SharedVersionLine[] | undefined;
  try {
    sharedVersionLines = lines === undefined ? undefined : JSON.parse(lines);
  } catch (error) {
    throw new Error("--shared-version-lines must be JSON", { cause: error });
  }
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
      crossSurfaceVersioning: enumValue(
        "--cross-surface-versioning",
        CROSS_SURFACE_VERSIONING_POLICIES
      ),
      curationMax: integerValue("--curation-max"),
      curationMin: integerValue("--curation-min"),
      developerChangelog: enumValue(
        "--developer-history",
        DEVELOPER_CHANGELOG_POLICIES
      ),
      guidanceBackfill: enumValue("--guidance-backfill", BACKFILL_STATUSES),
      majorReleaseNaming: enumValue(
        "--major-release-naming",
        MAJOR_RELEASE_NAMING_POLICIES
      ),
      mobileReleaseNotePlacement: enumValue(
        "--mobile-placement",
        MOBILE_RELEASE_NOTE_PLACEMENTS
      ),
      newReleaseNoteSurfaceComponents: enumValue(
        "--surface-components",
        SURFACE_COMPONENT_SOURCES
      ),
      newReleaseNoteSurfaces: enumValue("--new-surfaces", SURFACE_POLICIES),
      publicReleaseNotes: enumValue(
        "--public-release-notes",
        PUBLIC_RELEASE_NOTE_POLICIES
      ),
      publicVersionMajor: enumValue("--version-major", PUBLIC_VERSION_ACTIONS),
      publicVersionMinor: enumValue("--version-minor", PUBLIC_VERSION_ACTIONS),
      publicVersionPatch: enumValue("--version-patch", PUBLIC_VERSION_ACTIONS),
      publicVersionSuggestions: enumValue(
        "--version-suggestions",
        VERSION_SUGGESTION_OPTIONS
      ),
      releaseNoteEnvironmentScope: enumValue(
        "--release-note-environments",
        RELEASE_NOTE_ENVIRONMENT_SCOPES
      ),
      releaseNoteGrouping: enumValue(
        "--release-note-grouping",
        RELEASE_NOTE_GROUPING_POLICIES
      ),
      releaseNoteLinks: enumValue(
        "--release-note-links",
        RELEASE_NOTE_LINK_POLICIES
      ),
      repo: values.get("--repo") ?? ".",
      scope: enumValue("--scope", SCOPES),
      setupStyle: enumValue("--setup-style", SETUP_STYLES),
      sharedVersionLines,
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
