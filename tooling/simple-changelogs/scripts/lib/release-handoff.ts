import { createHash } from "node:crypto";

export const RELEASE_BOUNDARIES = [
  "release-bearing-merge",
  "web-production",
  "package-publication",
  "store-release",
  "other-public-release",
  "none",
] as const;
export const RELEASE_IMPACTS = [
  "none",
  "patch",
  "minor",
  "major",
  "unknown",
] as const;
export const RECEIPT_STATUSES = [
  "decision-required",
  "prepared",
  "verified",
  "not-applicable",
  "blocked",
] as const;

const PHASES = ["classify", "prepare", "verify"] as const;
const MUTATION_SCOPES = ["read-only", "prepare-release-files"] as const;
const POLICY_ACTIONS = ["ask", "automatic", "not-applicable"] as const;
const RESOLUTIONS = [
  "not-required",
  "automatic",
  "explicit-direction",
  "repository-automation",
  "approval-required",
  "blocked",
] as const;
const DECISION_SOURCES = [
  "current-request",
  "repository-policy",
  "run-only",
  "repository-convention",
] as const;
const REASON_ACTIONS = {
  "final-verification-failed": "review-finalization",
  "invalid-version-direction": "choose-version",
  "malformed-policy": "repair-policy",
  "malformed-request": "repair-request",
  "policy-changed": "refresh-and-reclassify",
  "release-train-ambiguous": "resolve-release-train",
  "schema-digest-mismatch": "repair-integration",
  "target-moved": "refresh-and-reclassify",
  "unsupported-consumer": "upgrade-consumer",
  "unsupported-protocol": "upgrade-producer",
  "version-direction-required": "choose-version",
  "version-owner-ambiguous": "resolve-version-owner",
} as const;
const REVISION_PATTERN = /^[0-9a-f]{40,64}$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;

type Boundary = (typeof RELEASE_BOUNDARIES)[number];
type Impact = (typeof RELEASE_IMPACTS)[number];
type Phase = (typeof PHASES)[number];
type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
type ReasonCode = keyof typeof REASON_ACTIONS;
type RequiredAction = (typeof REASON_ACTIONS)[ReasonCode];

export interface ChangelogRequestV1 {
  approvedDecisionDigest: string | null;
  approvedVersion: string | null;
  attempt: number;
  boundary: Boundary;
  environment: string | null;
  finalizedTargetRevision: string | null;
  inputTargetRevision: string;
  mutationScope: (typeof MUTATION_SCOPES)[number];
  phase: Phase;
  priorReceiptDigest: string | null;
  releaseSetId: string | null;
  releaseTrain: string;
  schemaVersion: 1;
  supportedReceiptVersions: (1 | 2)[];
  transactionId: string;
}

export interface VersionDecisionV2 {
  boundary: Boundary;
  bumpLevel: Impact;
  currentVersion: string | null;
  policyAction: (typeof POLICY_ACTIONS)[number];
  releaseTrain: string;
  resolution: (typeof RESOLUTIONS)[number];
  selectedVersion: string | null;
  source: (typeof DECISION_SOURCES)[number];
  suggestedVersion: string | null;
}

export interface ChangelogReceiptV2 {
  checks: string[];
  decisionDigest: string;
  effectivePolicyDigest: string;
  evidence: string[];
  observedAt: string;
  paths: { digest: string; path: string }[];
  phase: Phase;
  provider: "simple-changelogs";
  reason: string | null;
  reasonCode: ReasonCode | null;
  receiptDigest?: never;
  release: {
    date: string;
    targetContainedUnreleased: "prepared" | "integrated";
    version: string;
  } | null;
  releaseImpact: Impact;
  releaseSetId: string | null;
  requiredAction: RequiredAction | null;
  revisionLineage: {
    finalizedTargetRevision: string | null;
    inputTargetRevision: string;
    reconciliationHeadRevision: string | null;
  };
  schemaVersion: 2;
  sourceRevision: string;
  status: ReceiptStatus;
  transactionId: string;
  versionDecision: VersionDecisionV2 | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const oneOf = <T>(value: unknown, values: readonly T[]): value is T =>
  values.includes(value as T);
const revision = (value: unknown): value is string =>
  typeof value === "string" && REVISION_PATTERN.test(value);
const digest = (value: unknown): value is string =>
  typeof value === "string" && DIGEST_PATTERN.test(value);
const nullable = <T>(value: unknown, check: (input: unknown) => input is T) =>
  value === null || check(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const requireCondition = (
  errors: string[],
  condition: boolean,
  message: string
): void => {
  if (!condition) {
    errors.push(message);
  }
};

export const canonicalJson = (value: unknown): string => {
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

export const digestCanonicalJson = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

export const validateChangelogRequest = (
  value: unknown
): { errors: string[]; value?: ChangelogRequestV1 } => {
  const errors: string[] = [];
  const keys = [
    "schemaVersion",
    "transactionId",
    "releaseSetId",
    "phase",
    "attempt",
    "releaseTrain",
    "boundary",
    "environment",
    "mutationScope",
    "inputTargetRevision",
    "finalizedTargetRevision",
    "approvedVersion",
    "approvedDecisionDigest",
    "priorReceiptDigest",
    "supportedReceiptVersions",
  ];
  if (!(isRecord(value) && exactKeys(value, keys))) {
    return { errors: ["request has missing or unknown fields"] };
  }
  requireCondition(
    errors,
    value.schemaVersion === 1,
    "schemaVersion must be 1"
  );
  requireCondition(
    errors,
    nonEmpty(value.transactionId),
    "transactionId is required"
  );
  requireCondition(
    errors,
    nullable(value.releaseSetId, nonEmpty),
    "releaseSetId is invalid"
  );
  requireCondition(errors, oneOf(value.phase, PHASES), "phase is unsupported");
  requireCondition(
    errors,
    Number.isInteger(value.attempt) && (value.attempt as number) >= 1,
    "attempt must be positive"
  );
  requireCondition(
    errors,
    nonEmpty(value.releaseTrain),
    "releaseTrain is required"
  );
  requireCondition(
    errors,
    oneOf(value.boundary, RELEASE_BOUNDARIES),
    "boundary is unsupported"
  );
  requireCondition(
    errors,
    value.environment === null || typeof value.environment === "string",
    "environment is invalid"
  );
  requireCondition(
    errors,
    oneOf(value.mutationScope, MUTATION_SCOPES),
    "mutationScope is unsupported"
  );
  requireCondition(
    errors,
    revision(value.inputTargetRevision),
    "inputTargetRevision is invalid"
  );
  requireCondition(
    errors,
    nullable(value.finalizedTargetRevision, revision),
    "finalizedTargetRevision is invalid"
  );
  requireCondition(
    errors,
    nullable(value.approvedVersion, nonEmpty),
    "approvedVersion is invalid"
  );
  requireCondition(
    errors,
    nullable(value.approvedDecisionDigest, digest),
    "approvedDecisionDigest is invalid"
  );
  requireCondition(
    errors,
    nullable(value.priorReceiptDigest, digest),
    "priorReceiptDigest is invalid"
  );
  const receiptVersions = Array.isArray(value.supportedReceiptVersions)
    ? value.supportedReceiptVersions
    : [];
  requireCondition(
    errors,
    receiptVersions.length > 0 &&
      receiptVersions.every((item) => item === 1 || item === 2) &&
      new Set(receiptVersions).size === receiptVersions.length,
    "supportedReceiptVersions is invalid"
  );
  const expectedScope =
    value.phase === "prepare" ? "prepare-release-files" : "read-only";
  requireCondition(
    errors,
    value.mutationScope === expectedScope,
    `${String(value.phase)} requires ${expectedScope}`
  );
  requireCondition(
    errors,
    value.phase === "verify"
      ? revision(value.finalizedTargetRevision)
      : value.finalizedTargetRevision === null,
    value.phase === "verify"
      ? "verify requires finalizedTargetRevision"
      : "finalizedTargetRevision belongs only to verify"
  );
  return errors.length > 0
    ? { errors }
    : { errors, value: value as unknown as ChangelogRequestV1 };
};

const receiptBaseErrors = (value: ChangelogReceiptV2): string[] => {
  const errors: string[] = [];
  if (value.schemaVersion !== 2 || value.provider !== "simple-changelogs") {
    errors.push("receipt identity is invalid");
  }
  if (!(oneOf(value.status, RECEIPT_STATUSES) && oneOf(value.phase, PHASES))) {
    errors.push("receipt status or phase is unsupported");
  }
  if (!revision(value.sourceRevision)) {
    errors.push("sourceRevision is invalid");
  }
  if (!(digest(value.effectivePolicyDigest) && digest(value.decisionDigest))) {
    errors.push("policy and decision digests are required");
  }
  if (
    value.paths.some(
      (item) =>
        !nonEmpty(item.path) ||
        item.path.startsWith("/") ||
        item.path.split("/").includes("..") ||
        !digest(item.digest)
    )
  ) {
    errors.push("changed path digest is invalid");
  }
  if (value.reasonCode === null || value.requiredAction === null) {
    if (value.reasonCode !== null || value.requiredAction !== null) {
      errors.push(
        "reasonCode and requiredAction must both be null or non-null"
      );
    }
  } else if (REASON_ACTIONS[value.reasonCode] !== value.requiredAction) {
    errors.push("reasonCode and requiredAction do not match");
  }
  return errors;
};

const receiptRequestErrors = (
  receipt: ChangelogReceiptV2,
  request?: ChangelogRequestV1
): string[] => {
  if (!request) {
    return [];
  }
  const decision = receipt.versionDecision;
  const matches =
    receipt.transactionId === request.transactionId &&
    receipt.releaseSetId === request.releaseSetId &&
    receipt.phase === request.phase &&
    decision?.releaseTrain === request.releaseTrain &&
    decision.boundary === request.boundary &&
    receipt.revisionLineage.inputTargetRevision === request.inputTargetRevision;
  return matches ? [] : ["receipt does not match its exact request"];
};

const receiptStatusErrors = (receipt: ChangelogReceiptV2): string[] => {
  const errors: string[] = [];
  const decision = receipt.versionDecision;
  requireCondition(
    errors,
    receipt.releaseImpact !== "none" || receipt.status === "not-applicable",
    "internal-only or non-public work must be not-applicable"
  );
  requireCondition(
    errors,
    receipt.status !== "decision-required" ||
      (decision?.resolution === "approval-required" &&
        decision.policyAction === "ask" &&
        decision.boundary !== "none" &&
        decision.bumpLevel !== "none" &&
        receipt.releaseImpact !== "none" &&
        decision.selectedVersion === null &&
        receipt.reasonCode === "version-direction-required"),
    "decision-required receipt invariants failed"
  );
  requireCondition(
    errors,
    receipt.status !== "blocked" ||
      decision?.resolution !== "approval-required",
    "normal version approval must be decision-required"
  );
  const needsSelectedVersion =
    decision !== null &&
    ["automatic", "explicit-direction", "repository-automation"].includes(
      decision.resolution
    );
  requireCondition(
    errors,
    !needsSelectedVersion || Boolean(decision?.selectedVersion),
    "resolved version decisions require selectedVersion"
  );
  requireCondition(
    errors,
    receipt.status !== "prepared" ||
      (Boolean(decision?.selectedVersion && receipt.release) &&
        receipt.release?.version === decision?.selectedVersion &&
        receipt.release?.targetContainedUnreleased === "prepared" &&
        revision(receipt.revisionLineage.reconciliationHeadRevision)),
    "prepared receipt invariants failed"
  );
  requireCondition(
    errors,
    receipt.status !== "verified" ||
      (receipt.phase === "verify" &&
        receipt.paths.length === 0 &&
        receipt.release?.targetContainedUnreleased === "integrated" &&
        revision(receipt.revisionLineage.finalizedTargetRevision)),
    "verified receipt invariants failed"
  );
  requireCondition(
    errors,
    receipt.status !== "not-applicable" ||
      (receipt.releaseImpact === "none" &&
        receipt.release === null &&
        decision?.boundary === "none" &&
        decision.bumpLevel === "none" &&
        decision.policyAction === "not-applicable" &&
        decision.selectedVersion === null &&
        decision.suggestedVersion === null),
    "not-applicable receipt invariants failed"
  );
  requireCondition(
    errors,
    decision?.bumpLevel !== "unknown" || decision.resolution === "blocked",
    "unknown impact cannot resolve automatically"
  );
  return errors;
};

export const validateChangelogReceipt = (
  value: unknown,
  request?: ChangelogRequestV1
): { errors: string[]; value?: ChangelogReceiptV2 } => {
  if (!isRecord(value)) {
    return { errors: ["receipt must be an object"] };
  }
  const expected = [
    "schemaVersion",
    "provider",
    "status",
    "transactionId",
    "releaseSetId",
    "phase",
    "observedAt",
    "sourceRevision",
    "revisionLineage",
    "effectivePolicyDigest",
    "decisionDigest",
    "paths",
    "checks",
    "evidence",
    "releaseImpact",
    "versionDecision",
    "release",
    "reasonCode",
    "requiredAction",
    "reason",
  ];
  if (!exactKeys(value, expected)) {
    return { errors: ["receipt has missing or unknown fields"] };
  }
  if (
    !(
      Array.isArray(value.paths) &&
      Array.isArray(value.checks) &&
      Array.isArray(value.evidence) &&
      isRecord(value.revisionLineage)
    ) ||
    (value.versionDecision !== null && !isRecord(value.versionDecision)) ||
    (value.release !== null && !isRecord(value.release))
  ) {
    return { errors: ["receipt contains malformed structured fields"] };
  }
  const receipt = value as unknown as ChangelogReceiptV2;
  const errors = [
    ...receiptBaseErrors(receipt),
    ...receiptRequestErrors(receipt, request),
    ...receiptStatusErrors(receipt),
  ];
  return errors.length > 0 ? { errors } : { errors, value: receipt };
};

export const effectivePolicyDigest = (input: {
  automationOwner: string | null;
  policy: unknown;
  releaseTrain: string;
  source: string;
  versionConvention: string;
  versionOwner: string;
}): string => digestCanonicalJson(input);

export const decisionDigest = (input: {
  boundary: Boundary;
  currentVersion: string | null;
  effectivePolicyDigest: string;
  impact: Impact;
  inputTargetRevision: string;
  releaseTrain: string;
  selectedVersion: string | null;
  suggestedVersion: string | null;
  transactionId: string;
  versionOwner: string;
}): string => digestCanonicalJson(input);
