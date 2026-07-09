export const MANIFEST_VERSION = 1;
export const PROTOCOL_VERSION = 1;

export type BackfillStatus =
  | "not-applicable"
  | "completed"
  | "declined"
  | "deferred"
  | "partial"
  | "failed";

export type SurfacePolicy = "ask" | "allow" | "existing-only";
export type ActivationMode = "discover" | "explicit";
export type EvalSuite = "trigger" | "behavior";
export type RunnerStatus = "completed" | "skipped" | "error";

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
  role: "user" | "assistant";
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

export type AuthorizationStatus =
  | "granted"
  | "denied"
  | "required"
  | "not-applicable";

export type AuthorizationSource =
  | "current-request"
  | "repository-policy"
  | "repository-instructions"
  | "user-response"
  | "none";

export interface AuthorizationRecord {
  code: string;
  source: AuthorizationSource;
  status: AuthorizationStatus;
}

export type VersionRole =
  | "source"
  | "mirror"
  | "package"
  | "application"
  | "store";

export interface VersionMapRecord {
  path: string;
  role: VersionRole;
  version: string;
}

export type VerificationStatus = "passed" | "failed" | "not-run";

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
