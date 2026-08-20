export const MANIFEST_VERSION = 1;
export const PROTOCOL_VERSION = 2;

export const BACKFILL_STATUSES = [
  "not-applicable",
  "completed",
  "declined",
  "deferred",
  "partial",
  "failed",
] as const;
export const SURFACE_POLICIES = ["ask", "allow", "existing-only"] as const;
export const PUBLIC_VERSION_ACTIONS = ["ask", "automatic"] as const;
export const SURFACE_COMPONENT_SOURCES = [
  "project-components",
  "recommended-web-components",
  "recommended-web-radix",
  "platform-native-components",
  "minimal-markup",
] as const;
export const MOBILE_RELEASE_NOTE_PLACEMENTS = [
  "store-only",
  "web-tabs",
  "web-page",
  "mobile-only",
] as const;
export const RELEASE_NOTE_ENVIRONMENT_SCOPES = [
  "all-environments",
  "non-production",
  "production-only",
  "disabled",
] as const;
export const RELEASE_NOTE_LINK_POLICIES = [
  "when-useful",
  "ask",
  "disabled",
] as const;
export const DEVELOPER_CHANGELOG_POLICIES = ["required", "optional"] as const;
export const SIGNATURE_POLICIES = ["agent-and-timestamp", "none"] as const;
export const SETUP_STYLES = ["recommended", "customized"] as const;
export const SETUP_SCOPES = ["repository", "all-projects", "run-only"] as const;
export const SETUP_COMMANDS = ["inspect", "apply"] as const;
export const SETUP_STATUSES = [
  "already-configured",
  "blocked",
  "configured",
  "needs-input",
  "ready",
  "run-only",
] as const;
export const DISTRIBUTIONS = [
  "full",
  "web",
  "mobile",
  "web-cms",
  "skill-repository",
] as const;
export const ACTIVATION_MODES = ["discover", "explicit"] as const;
export const EVAL_SUITES = ["trigger", "behavior"] as const;
export const RUNNER_STATUSES = ["completed", "skipped", "error"] as const;
export const RUNNER_MESSAGE_ROLES = ["user", "assistant"] as const;
export const AUTHORIZATION_STATUSES = [
  "granted",
  "denied",
  "required",
  "not-applicable",
] as const;
export const AUTHORIZATION_SOURCES = [
  "current-request",
  "repository-policy",
  "repository-instructions",
  "user-response",
  "none",
] as const;
export const VERSION_ROLES = [
  "source",
  "mirror",
  "package",
  "application",
  "store",
] as const;
export const VERSION_IDENTIFIER_ROLES = [
  "canonical-release",
  "public-version",
  "build-number",
  "development-version",
] as const;
export const CROSS_SURFACE_VERSIONING_POLICIES = [
  "shared",
  "independent",
  "mixed",
] as const;
export const VERIFICATION_STATUSES = ["passed", "failed", "not-run"] as const;
export const ASSERTION_KINDS = [
  "activation",
  "file.changed",
  "file.unchanged",
  "git.changedPaths",
  "json.path",
  "path.absent",
  "path.exists",
  "repo.state",
  "report.authorization",
  "report.decision",
  "report.status",
  "report.verification",
  "report.versionMap",
  "text.match",
  "text.notMatch",
] as const;

export type BackfillStatus = (typeof BACKFILL_STATUSES)[number];
export type SurfacePolicy = (typeof SURFACE_POLICIES)[number];
export type PublicVersionAction = (typeof PUBLIC_VERSION_ACTIONS)[number];
export type SurfaceComponentSource = (typeof SURFACE_COMPONENT_SOURCES)[number];
export type CrossSurfaceVersioning =
  (typeof CROSS_SURFACE_VERSIONING_POLICIES)[number];
export type ReleaseNoteEnvironmentScope =
  (typeof RELEASE_NOTE_ENVIRONMENT_SCOPES)[number];
export type ReleaseNoteLinkPolicy = (typeof RELEASE_NOTE_LINK_POLICIES)[number];
export type MobileReleaseNotePlacement =
  (typeof MOBILE_RELEASE_NOTE_PLACEMENTS)[number];
export type DeveloperChangelogPolicy =
  (typeof DEVELOPER_CHANGELOG_POLICIES)[number];
export type SignaturePolicy = (typeof SIGNATURE_POLICIES)[number];
export type SetupStyle = (typeof SETUP_STYLES)[number];
export type SetupScope = (typeof SETUP_SCOPES)[number];
export type SetupCommand = (typeof SETUP_COMMANDS)[number];
export type SetupStatus = (typeof SETUP_STATUSES)[number];
export type Distribution = (typeof DISTRIBUTIONS)[number];
export type ActivationMode = (typeof ACTIVATION_MODES)[number];
export type EvalSuite = (typeof EVAL_SUITES)[number];
export type RunnerStatus = (typeof RUNNER_STATUSES)[number];
export type RunnerMessageRole = (typeof RUNNER_MESSAGE_ROLES)[number];
export type AssertionKind = (typeof ASSERTION_KINDS)[number];

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface RepoPolicy {
  crossSurfaceVersioning?: CrossSurfaceVersioning;
  developerChangelog: DeveloperChangelogPolicy;
  distribution?: Distribution;
  guidance: {
    version: number;
    backfillStatus: BackfillStatus;
  };
  mobileReleaseNotePlacement?: MobileReleaseNotePlacement;
  newReleaseNoteSurfaceComponents?: SurfaceComponentSource;
  newReleaseNoteSurfaces: SurfacePolicy;
  publicVersioning?: PublicVersioningPolicy;
  releaseNoteEnvironmentScope?: ReleaseNoteEnvironmentScope;
  releaseNoteLinks?: ReleaseNoteLinkPolicy;
  schemaVersion: 1;
  signatures: SignaturePolicy;
}

export interface GlobalPreferences {
  developerChangelog: DeveloperChangelogPolicy;
  newReleaseNoteSurfaces: SurfacePolicy;
  profile: "solo-developer";
  publicVersioning?: PublicVersioningPolicy;
  schemaVersion: 1;
  setupStyle: SetupStyle;
  signatures: SignaturePolicy;
}

export interface PublicVersioningPolicy {
  major: PublicVersionAction;
  minor: PublicVersionAction;
  patch: PublicVersionAction;
  suggestWhenAsking: boolean;
}

export interface SetupWriteRecord {
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

export interface SetupSelection {
  backfillStatus?: BackfillStatus;
  crossSurfaceVersioning?: CrossSurfaceVersioning;
  developerChangelog?: DeveloperChangelogPolicy;
  mobileReleaseNotePlacement?: MobileReleaseNotePlacement;
  newReleaseNoteSurfaceComponents?: SurfaceComponentSource;
  newReleaseNoteSurfaces?: SurfacePolicy;
  publicVersioning?: PublicVersioningPolicy;
  releaseNoteEnvironmentScope?: ReleaseNoteEnvironmentScope;
  releaseNoteLinks?: ReleaseNoteLinkPolicy;
  scope?: SetupScope;
  setupStyle?: SetupStyle;
  signatures?: SignaturePolicy;
}

export interface CmsSetupPolicy {
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

export interface SetupStateRecord<T> {
  errors: string[];
  path: string;
  state: "absent" | "malformed" | "valid";
  value?: T;
}

export interface SetupDetection {
  confidence: "conflict" | "high" | "low" | "medium";
  distribution: Distribution | "cms" | null;
  evidence: string[];
}

export interface SetupInventory {
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
    cms: "detected" | "not-detected" | "uncertain";
    mobile: "detected" | "not-detected" | "uncertain";
    store: "detected" | "not-detected" | "uncertain";
    web: "detected" | "not-detected" | "uncertain";
    workspace: "detected" | "not-detected" | "uncertain";
  };
  surfaceStructureEvidence: {
    cms: string[];
    mobile: string[];
    store: string[];
    web: string[];
    workspace: string[];
  };
}

export interface SetupRecommendation {
  cmsPolicy: CmsSetupPolicy | null;
  policy: RepoPolicy | null;
  reusableDefaults: GlobalPreferences;
}

export interface SetupResult {
  capabilities: {
    distribution: Distribution;
    features: [
      "public-version-policy",
      "classify-prepare-verify",
      "multi-train-receipts",
    ];
    guidanceVersion: number;
    provider: "simple-changelogs";
    receiptVersions: [1, 2];
    requestVersions: [1];
    schemaDigests: {
      changelogReceipt: string;
      changelogRequest: string;
    };
    schemaVersion: 1;
  } | null;
  cmsPolicy: SetupStateRecord<CmsSetupPolicy> | null;
  command: SetupCommand;
  detection: SetupDetection;
  errors: string[];
  globalPreferences: SetupStateRecord<GlobalPreferences>;
  guidanceUpdate: {
    actions: ("walkthrough" | "continue" | "view-release-notes")[];
    backfillRecommendation: "not-needed" | "optional" | "recommended";
    changes: {
      backfillRecommendation: "not-needed" | "optional" | "recommended";
      kinds: ("behavior" | "capability" | "maintenance" | "onboarding")[];
      summary: string;
      version: number;
    }[];
    currentVersion: number;
    headline: "Simple Changelogs has recently been updated.";
    recordedVersion: number;
    releaseNotesOffer: string;
    releaseNotesPath: string;
    summary: string;
    summaryBullets: string[];
    userPrompt: string | null;
    walkthroughQuestion: string;
  } | null;
  inventory: SetupInventory;
  onboardingContribution: {
    destination: ".simple-changelogs.json";
    owner: "simple-changelogs";
    questions: {
      id: "public-version-actions" | "public-version-suggestions";
      required: boolean;
    }[];
    resolvedPolicy: PublicVersioningPolicy;
    summary: string;
  } | null;
  onboardingRequired: boolean;
  ownerWriteReceipt: {
    destination: ".simple-changelogs.json";
    owner: "simple-changelogs";
    policyDigest: string | null;
    status: "completed" | "not-requested";
    written: boolean;
  } | null;
  policy: SetupStateRecord<RepoPolicy> | null;
  publicVersioning: {
    effective: PublicVersioningPolicy;
    recommended: PublicVersioningPolicy;
    selected: PublicVersioningPolicy | null;
    source: "missing-field-default" | "repository-policy" | "run-only";
    stored: PublicVersioningPolicy | null;
  } | null;
  recommendation: SetupRecommendation;
  repository: string;
  schemaVersion: 1;
  selection: SetupSelection;
  status: SetupStatus;
  summary: string;
  unresolvedQuestions: string[];
  writeCapable: boolean;
  writes: SetupWriteRecord[];
}

export interface EvalAssertion {
  expected: JsonValue;
  kind: AssertionKind;
  target?: string;
}

export interface EvalTurn {
  assertions: EvalAssertion[];
  prompt: string;
}

export interface EvalCase {
  activationMode: ActivationMode;
  fixture: string;
  id: string;
  skip?: string;
  suite: EvalSuite;
  tags: string[];
  turns: EvalTurn[];
}

export interface EvalManifest {
  cases: EvalCase[];
  manifestVersion: 1;
}

export interface RunnerMessage {
  content: string;
  role: RunnerMessageRole;
}

export interface RunnerRequest {
  activationMode: ActivationMode;
  case: EvalCase;
  prompt: string;
  protocolVersion: 2;
  responseSchema: string;
  skillDirectory: string;
  timeoutMs: number;
  transcript?: RunnerMessage[];
  turnIndex: number;
  workspace: string;
}

export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

export type AuthorizationSource = (typeof AUTHORIZATION_SOURCES)[number];

export interface AuthorizationRecord {
  code: string;
  source: AuthorizationSource;
  status: AuthorizationStatus;
}

export type VersionRole = (typeof VERSION_ROLES)[number];
export type VersionIdentifierRole = (typeof VERSION_IDENTIFIER_ROLES)[number];

export interface VersionMapRecord {
  field?: string;
  identifierRole: VersionIdentifierRole;
  path: string;
  releaseTrain?: string;
  role: VersionRole;
  version: string;
}

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface VerificationResult {
  code: string;
  detail?: string;
  status: VerificationStatus;
}

export interface NativeActivationEvidence {
  activated: boolean;
  trace: string[];
}

export interface EvaluationReport {
  authorizationRecords: AuthorizationRecord[];
  decisionCodes: string[];
  nativeActivationEvidence?: NativeActivationEvidence;
  reasonCodes: string[];
  verificationResults: VerificationResult[];
  versionMap: VersionMapRecord[];
}

export interface RunnerDiagnostic {
  code: string;
  message: string;
}

export interface RunnerResponse {
  diagnostics?: RunnerDiagnostic[];
  evaluationReport: EvaluationReport;
  finalResponse: string;
  protocolVersion: 2;
  runtimeIdentity?: string;
  status: RunnerStatus;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export const CURATION_MANIFEST_VERSION = 1;

export const CURATION_OPERATION_STATUSES = [
  "partial",
  "failed",
  "completed",
  "superseded",
] as const;
export const CURATION_SURFACE_MODES = [
  "full-history",
  "selected-summary",
  "internal-history",
] as const;
export const CURATION_SURFACE_AUDIENCES = ["public", "internal"] as const;
export const CURATION_SCOPE_KINDS = [
  "full-history",
  "release-range",
  "release",
  "section",
  "item-set",
] as const;
export const CURATION_SCOPE_MATURITIES = ["provisional", "released"] as const;
export const CURATION_STRATEGY_GROUPINGS = [
  "product-area",
  "workflow",
  "release-section",
  "custom",
] as const;
export const CURATION_STRATEGY_ORDERINGS = [
  "product-importance",
  "product-journey",
  "source-order",
  "custom",
] as const;
export const SURFACE_DEFAULT_ORGANIZATIONS = [
  "product-area",
  "change-type",
  "release-chronology",
  "custom",
] as const;
export const SURFACE_LAYOUTS = [
  "grouped-sections",
  "timeline",
  "cards",
  "changelog-list",
] as const;
export const SURFACE_VISUAL_DIRECTIONS = [
  "project-native",
  "editorial-minimal",
  "product-cards",
  "timeline-minimal",
  "custom",
] as const;
export const SURFACE_DATE_DISPLAYS = ["exact", "month-year", "hidden"] as const;
export const SURFACE_VERSION_DISPLAYS = [
  "exact",
  "friendly",
  "hidden",
] as const;
export const SURFACE_DETAIL_DENSITIES = [
  "concise",
  "balanced",
  "full",
] as const;
export const SURFACE_CHRONOLOGICAL_ACCESS_MODES = [
  "curated-with-toggle",
  "chronology-with-filters",
  "curated-with-context",
] as const;
export const SURFACE_NAVIGATION_ITEMS = [
  "anchors",
  "search",
  "product-area-filter",
  "release-filter",
] as const;
export const SURFACE_TRANSPARENCY_PREFERENCES = [
  "undecided",
  "none",
  "curation-notice",
  "correction-notice",
] as const;
export const DEPLOYED_SURFACE_STATES = [
  "deployed",
  "unpublished",
  "unknown",
] as const;
export const DEPLOYED_SURFACE_CHANGE_KINDS = [
  "ordering",
  "grouping",
  "display-version-format",
  "canonical-version",
  "date",
  "release-boundary",
  "content",
  "visibility",
  "deep-link",
] as const;
export const SOURCE_REWRITE_CHANGE_KINDS = [
  "canonical-version",
  "date",
  "release-boundary",
  "content",
  "visibility",
] as const;
export const CURATION_OPERATION_DIRECTIONS = [
  "canonical-forward",
  "canonical-reverse",
] as const;
export const CURATION_OPERATION_OVERLAPS = [
  "none",
  "continuation",
  "partial-overlap",
  "full-overlap",
] as const;

export type CurationOperationStatus =
  (typeof CURATION_OPERATION_STATUSES)[number];
export type CurationSurfaceMode = (typeof CURATION_SURFACE_MODES)[number];
export type CurationSurfaceAudience =
  (typeof CURATION_SURFACE_AUDIENCES)[number];
export type CurationScopeKind = (typeof CURATION_SCOPE_KINDS)[number];
export type CurationScopeMaturity = (typeof CURATION_SCOPE_MATURITIES)[number];
export type CurationStrategyGrouping =
  (typeof CURATION_STRATEGY_GROUPINGS)[number];
export type CurationStrategyOrdering =
  (typeof CURATION_STRATEGY_ORDERINGS)[number];
export type SurfaceDefaultOrganization =
  (typeof SURFACE_DEFAULT_ORGANIZATIONS)[number];
export type SurfaceLayout = (typeof SURFACE_LAYOUTS)[number];
export type SurfaceVisualDirection = (typeof SURFACE_VISUAL_DIRECTIONS)[number];
export type SurfaceDateDisplay = (typeof SURFACE_DATE_DISPLAYS)[number];
export type SurfaceVersionDisplay = (typeof SURFACE_VERSION_DISPLAYS)[number];
export type SurfaceDetailDensity = (typeof SURFACE_DETAIL_DENSITIES)[number];
export type SurfaceChronologicalAccess =
  (typeof SURFACE_CHRONOLOGICAL_ACCESS_MODES)[number];
export type SurfaceNavigationItem = (typeof SURFACE_NAVIGATION_ITEMS)[number];
export type SurfaceTransparencyPreferenceValue =
  (typeof SURFACE_TRANSPARENCY_PREFERENCES)[number];
export type DeployedSurfaceState = (typeof DEPLOYED_SURFACE_STATES)[number];
export type DeployedSurfaceChangeKind =
  (typeof DEPLOYED_SURFACE_CHANGE_KINDS)[number];
export type SourceRewriteChangeKind =
  (typeof SOURCE_REWRITE_CHANGE_KINDS)[number];
export type CurationOperationDirection =
  (typeof CURATION_OPERATION_DIRECTIONS)[number];
export type CurationOperationOverlap =
  (typeof CURATION_OPERATION_OVERLAPS)[number];

export interface SourceBoundary {
  date?: string;
  heading: string;
  /** 1-based index among identical headings in document order. */
  occurrence: number;
  sourcePath: string;
  version?: string;
}

export type CurationScope =
  | { kind: "full-history" }
  | { itemIds: string[]; kind: "item-set" }
  | { kind: "release"; release: SourceBoundary }
  | {
      first: SourceBoundary;
      kind: "release-range";
      last: SourceBoundary;
    }
  | { kind: "section"; release: SourceBoundary; section: SourceBoundary };

export interface CurationGroup {
  groupId: string;
  itemIds: string[];
  label: string;
}

export interface ActiveCurationScope {
  activatedByOperationId: string;
  groups: CurationGroup[];
  maturity: CurationScopeMaturity;
  scope: CurationScope;
  scopeId: string;
  sourceFingerprint: string;
}

export interface CurationCounts {
  eligibleAfter: number;
  eligibleBefore: number;
  groupsAfter: number;
  groupsBefore: number;
  mapped: number;
  moved: number;
}

export interface CurationStrategy {
  customDescription?: string;
  grouping: CurationStrategyGrouping;
  ordering: CurationStrategyOrdering;
  withinGroup: CurationStrategyOrdering;
}

export interface SurfaceDisplayPreferences {
  chronologicalAccess: SurfaceChronologicalAccess;
  dateDisplay: SurfaceDateDisplay;
  defaultOrganization: SurfaceDefaultOrganization;
  detailDensity: SurfaceDetailDensity;
  layout: SurfaceLayout;
  navigation: SurfaceNavigationItem[];
  versionDisplay: SurfaceVersionDisplay;
  visualDirection: SurfaceVisualDirection;
}

export interface SurfaceTransparencyPreference {
  decidedAt?: string;
  decisionSource?: AuthorizationSource;
  noticeLocation?: string;
  noticeText?: string;
  preference: SurfaceTransparencyPreferenceValue;
}

export interface DeployedSurfaceImpact {
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgmentSource?: AuthorizationSource;
  changeKinds: DeployedSurfaceChangeKind[];
  evidence: string[];
  previouslyVisibleScope?: CurationScope;
  state: DeployedSurfaceState;
}

export interface LinkedSourceRewrite {
  authorizationCode: "RELEASED_HISTORY_REWRITE";
  changedPaths: string[];
  changeKinds: SourceRewriteChangeKind[];
  sourceFingerprintAfter: string;
  sourceFingerprintBefore: string;
}

export interface LinkedSurfaceCopyRevision {
  authorizationCode: "RELEASE_NOTE_COPY_REVISION";
  changedItemIds: string[];
  surfaceFingerprintAfter: string;
  surfaceFingerprintBefore: string;
}

export interface CurationOperation {
  completedAt?: string;
  counts?: CurationCounts;
  deployedImpact: DeployedSurfaceImpact;
  direction: CurationOperationDirection;
  effectiveScope: CurationScope;
  eligibleItemSetFingerprintAfter?: string;
  eligibleItemSetFingerprintBefore: string;
  failureDiagnostic?: string;
  linkedSourceRewrite?: LinkedSourceRewrite;
  linkedSurfaceCopyRevision?: LinkedSurfaceCopyRevision;
  newestCovered?: SourceBoundary;
  oldestCovered?: SourceBoundary;
  operationId: string;
  overlap: CurationOperationOverlap;
  requestedScope: CurationScope;
  resumeAfter?: SourceBoundary;
  revisitsOperationIds: string[];
  runtimeIdentity?: string;
  sourceFingerprint: string;
  sourceRevision?: string;
  startedAt?: string;
  status: CurationOperationStatus;
  supersededBy?: string;
  surfaceFingerprintAfter?: string;
  surfaceFingerprintBefore: string;
}

export interface CurationSurface {
  activeScopes: ActiveCurationScope[];
  audience: CurationSurfaceAudience;
  displayPreferences: SurfaceDisplayPreferences;
  fallback: "source-order";
  mode: CurationSurfaceMode;
  operations: CurationOperation[];
  sourcePaths: string[];
  surfaceId: string;
  surfacePaths: string[];
  transparencyPreference: SurfaceTransparencyPreference;
}

export interface CurationManifest {
  schemaVersion: 1;
  surfaces: CurationSurface[];
}
