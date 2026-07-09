export const MANIFEST_VERSION = 1;
export const PROTOCOL_VERSION = 1;

export const BACKFILL_STATUSES = [
  "not-applicable",
  "completed",
  "declined",
  "deferred",
  "partial",
  "failed",
] as const;
export const SURFACE_POLICIES = ["ask", "allow", "existing-only"] as const;
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
export const VERIFICATION_STATUSES = ["passed", "failed", "not-run"] as const;

export type BackfillStatus = (typeof BACKFILL_STATUSES)[number];
export type SurfacePolicy = (typeof SURFACE_POLICIES)[number];
export type ActivationMode = (typeof ACTIVATION_MODES)[number];
export type EvalSuite = (typeof EVAL_SUITES)[number];
export type RunnerStatus = (typeof RUNNER_STATUSES)[number];
export type RunnerMessageRole = (typeof RUNNER_MESSAGE_ROLES)[number];

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface RepoPolicy {
  developerChangelog: "required";
  guidance: {
    version: number;
    backfillStatus: BackfillStatus;
  };
  newReleaseNoteSurfaces: SurfacePolicy;
  schemaVersion: 1;
  signatures: "agent-and-timestamp";
}

export interface EvalAssertion {
  expected: JsonValue;
  kind: string;
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
  protocolVersion: 1;
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

export interface VersionMapRecord {
  path: string;
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
  protocolVersion: 1;
  runtimeIdentity?: string;
  status: RunnerStatus;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };
