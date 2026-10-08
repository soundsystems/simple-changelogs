import { createHash } from "node:crypto";
import {
  type ReleaseTagsSetting,
  releaseTagNameProblem,
  releaseTagsErrors,
} from "../setup.ts";
import { SHARED_VERSION_LINE_MODES, type SharedVersionLine } from "./types.ts";
import {
  type VersionLineDecision,
  versionLineEvidence,
} from "./version-lines.ts";

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
  "classified",
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
const VERSION_BOUNDARY_PATTERN = /[0-9.]$/u;
// The receipt versions each request version may advertise.
const RECEIPTS_BY_REQUEST: Record<1 | 2 | 3, readonly number[]> = {
  1: [1, 2],
  2: [1, 2, 3],
  3: [1, 2, 3, 4],
};

// A receipt v4 tag message, as the Simple Changes 0.27.0 schema allows it:
// one line of 1 to 200 characters.
const tagMessageShape = (message: string): boolean =>
  message.length >= 1 &&
  [...message].length <= 200 &&
  ![...message].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
// Receipt v3 shapes, mirrored from the Simple Changes 0.23.0 schemas.
const STABLE_VERSION = /^([0-9]+(?:\.[0-9]+){0,2})(?:\+[0-9A-Za-z.-]+)?$/u;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const LINEAGE_KEYS = [
  "inputTargetRevision",
  "reconciliationHeadRevision",
  "finalizedTargetRevision",
];
const DECISION_KEYS = [
  "releaseTrain",
  "boundary",
  "currentVersion",
  "bumpLevel",
  "suggestedVersion",
  "selectedVersion",
  "policyAction",
  "resolution",
  "source",
  "versionLine",
];
const LINE_KEYS = [
  "mode",
  "members",
  "memberVersions",
  "sharedVersion",
  "sharedVersionTrains",
  "outcome",
];
// A version decision that selects, bumps, and suggests nothing.
const ENTRY_DECISION = {
  boundary: "none",
  bumpLevel: "none",
  policyAction: "not-applicable",
  resolution: "not-required",
  selectedVersion: null,
  suggestedVersion: null,
};

type Boundary = (typeof RELEASE_BOUNDARIES)[number];
type Impact = (typeof RELEASE_IMPACTS)[number];
type Phase = (typeof PHASES)[number];
type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
type ReasonCode = keyof typeof REASON_ACTIONS;
type RequiredAction = (typeof REASON_ACTIONS)[ReasonCode];

export interface ChangelogRequestV1 {
  approvedDecisionDigest: string | null;
  approvedVersion: string | null;
  // Optional and informational: never stored, echoed, or used to key retries.
  attempt?: number;
  boundary: Boundary;
  environment?: string;
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

// Request v2 adds releaseSetTrains and may advertise receipt v3.
export interface ChangelogRequestV2
  extends Omit<
    ChangelogRequestV1,
    "schemaVersion" | "supportedReceiptVersions"
  > {
  releaseSetTrains: string[] | null;
  schemaVersion: 2;
  supportedReceiptVersions: (1 | 2 | 3)[];
}

// Request v3 is request v2 that may also advertise receipt v4.
export interface ChangelogRequestV3
  extends Omit<
    ChangelogRequestV2,
    "schemaVersion" | "supportedReceiptVersions"
  > {
  schemaVersion: 3;
  supportedReceiptVersions: (1 | 2 | 3 | 4)[];
}

export type ChangelogRequest =
  | ChangelogRequestV1
  | ChangelogRequestV2
  | ChangelogRequestV3;

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

export type VersionLine = VersionLineDecision;

export interface VersionDecisionV3 extends VersionDecisionV2 {
  versionLine: VersionLine | null;
}

// Receipt v3 is receipt v2 plus the releaseSetTrains echo and the line.
export interface ChangelogReceiptV3
  extends Omit<ChangelogReceiptV2, "schemaVersion" | "versionDecision"> {
  releaseSetTrains: string[] | null;
  schemaVersion: 3;
  versionDecision: VersionDecisionV3 | null;
}

export interface ReleaseTag {
  message: string;
  name: string;
}

// Receipt v4 is receipt v3 whose release record also names its tag.
export interface ChangelogReceiptV4
  extends Omit<ChangelogReceiptV3, "release" | "schemaVersion"> {
  release:
    | (NonNullable<ChangelogReceiptV2["release"]> & { tag: ReleaseTag | null })
    | null;
  schemaVersion: 4;
}

// Receipts that echo the release set and carry the version line.
export type LineCarryingReceipt = ChangelogReceiptV3 | ChangelogReceiptV4;

export type ChangelogReceipt =
  | ChangelogReceiptV2
  | ChangelogReceiptV3
  | ChangelogReceiptV4;

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
const closedKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[]
) =>
  required.every((key) => Object.hasOwn(value, key)) &&
  Object.keys(value).every(
    (key) => required.includes(key) || optional.includes(key)
  );
const requireCondition = (
  errors: string[],
  condition: boolean,
  message: string
): void => {
  if (!condition) {
    errors.push(message);
  }
};
const stringList = (value: unknown, minItems: number): value is string[] =>
  Array.isArray(value) &&
  value.length >= minItems &&
  value.every(nonEmpty) &&
  new Set(value).size === value.length;
const trainList = (value: unknown): value is string[] | null =>
  value === null || stringList(value, 2);
const sameList = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((item, index) => item === right[index]);
// Code-unit order, the order members and sharedVersionTrains use.
const sorted = (values: readonly string[]): string[] =>
  [...values].sort((left, right) => (left < right ? -1 : Number(left > right)));

// One to three dotted numbers, zero-padded, with +build ignored; anything
// else, a prerelease included, is not a stable version.
const stableParts = (version: unknown): bigint[] | null => {
  const core =
    typeof version === "string" ? STABLE_VERSION.exec(version)?.[1] : null;
  if (!core) {
    return null;
  }
  const parts = core.split(".").map((part) => BigInt(part));
  while (parts.length < 3) {
    parts.push(0n);
  }
  return parts;
};
// Orders two versions already proven stable.
const compareStable = (left: string, right: string): number => {
  const a = stableParts(left) ?? [];
  const b = stableParts(right) ?? [];
  const index = a.findIndex((part, position) => part !== b[position]);
  if (index === -1) {
    return 0;
  }
  return (a[index] ?? 0n) < (b[index] ?? 0n) ? -1 : 1;
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

// As in the schema, only schemaVersion 2 or 3 selects request v2 or v3; any
// other value is checked, unchanged, as request v1. Request v3 is request v2
// that may also advertise receipt v4.
const requestVersionOf = (value: unknown): 1 | 2 | 3 => {
  const version = isRecord(value) ? value.schemaVersion : undefined;
  return version === 2 || version === 3 ? version : 1;
};

export const validateChangelogRequest = (
  value: unknown
): { errors: string[]; value?: ChangelogRequest } => {
  const errors: string[] = [];
  const keys = [
    "schemaVersion",
    "transactionId",
    "releaseSetId",
    "phase",
    "releaseTrain",
    "boundary",
    "mutationScope",
    "inputTargetRevision",
    "finalizedTargetRevision",
    "approvedVersion",
    "approvedDecisionDigest",
    "priorReceiptDigest",
    "supportedReceiptVersions",
  ];
  // Informational fields the schema allows but does not require. They are
  // shape-checked when present and otherwise ignored.
  const optionalKeys = ["attempt", "environment"];
  const requestVersion = requestVersionOf(value);
  const v2 = requestVersion !== 1;
  if (
    !(
      isRecord(value) &&
      closedKeys(value, v2 ? [...keys, "releaseSetTrains"] : keys, optionalKeys)
    )
  ) {
    return { errors: ["request has missing or unknown fields"] };
  }
  requireCondition(
    errors,
    v2 || value.schemaVersion === 1,
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
    value.attempt === undefined ||
      (Number.isInteger(value.attempt) && (value.attempt as number) >= 1),
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
    value.environment === undefined || nonEmpty(value.environment),
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
      receiptVersions.every((item) =>
        RECEIPTS_BY_REQUEST[requestVersion].includes(item as number)
      ) &&
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
  // An entry-only handoff on the `none` boundary never approves a version;
  // a public boundary must carry one into prepare and verify.
  if (value.boundary === "none") {
    requireCondition(
      errors,
      value.approvedVersion === null,
      "the none boundary carries no approvedVersion"
    );
  } else if (value.phase === "prepare" || value.phase === "verify") {
    requireCondition(
      errors,
      nonEmpty(value.approvedVersion),
      `${String(value.phase)} requires approvedVersion on a public boundary`
    );
  }
  if (v2) {
    errors.push(...requestV2Errors(value));
  }
  return errors.length > 0
    ? { errors }
    : { errors, value: value as unknown as ChangelogRequest };
};

// Request v2 also takes every phase rule of its schema, and a release set
// names its own train under a releaseSetId.
const requestV2Errors = (value: Record<string, unknown>): string[] => {
  const errors: string[] = [];
  requireCondition(
    errors,
    trainList(value.releaseSetTrains),
    "releaseSetTrains is invalid"
  );
  requireCondition(
    errors,
    !Array.isArray(value.releaseSetTrains) ||
      (value.releaseSetId !== null &&
        value.releaseSetTrains.includes(value.releaseTrain)),
    "releaseSetTrains requires a releaseSetId and must include the releasing train"
  );
  requireCondition(
    errors,
    value.phase !== "classify" ||
      (value.approvedVersion === null && value.approvedDecisionDigest === null),
    "classify carries no approval"
  );
  requireCondition(
    errors,
    value.phase === "classify" || digest(value.approvedDecisionDigest),
    `${String(value.phase)} requires approvedDecisionDigest`
  );
  return errors;
};

const carriesLine = (
  receipt: ChangelogReceipt
): receipt is LineCarryingReceipt =>
  receipt.schemaVersion === 3 || receipt.schemaVersion === 4;

const receiptBaseErrors = (value: ChangelogReceipt): string[] => {
  const errors: string[] = [];
  if (
    !(
      value.schemaVersion === 2 ||
      value.schemaVersion === 3 ||
      value.schemaVersion === 4
    ) ||
    value.provider !== "simple-changelogs"
  ) {
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
  receipt: ChangelogReceipt,
  request?: ChangelogRequest
): string[] => {
  if (!request) {
    return [];
  }
  const errors: string[] = [];
  const decision = receipt.versionDecision;
  const entryOnly = request.boundary === "none";
  // An entry-only receipt may omit its version decision entirely; a public
  // boundary must name the train and boundary it decided. As in Simple
  // Changes, a blocked receipt v3 or v4 may also omit it (an ambiguous owner
  // names no train); receipt v2 keeps its original binding.
  const decisionMatches =
    decision === null
      ? entryOnly || (carriesLine(receipt) && receipt.status === "blocked")
      : decision.releaseTrain === request.releaseTrain &&
        decision.boundary === request.boundary;
  const matches =
    receipt.transactionId === request.transactionId &&
    receipt.releaseSetId === request.releaseSetId &&
    receipt.phase === request.phase &&
    decisionMatches &&
    receipt.revisionLineage.inputTargetRevision === request.inputTargetRevision;
  requireCondition(errors, matches, "receipt does not match its exact request");
  // The receipt does not carry the boundary, so the null release record is
  // bound here: only the none boundary prepares or verifies without a version.
  if (receipt.status === "prepared" || receipt.status === "verified") {
    requireCondition(
      errors,
      (receipt.release === null) === entryOnly,
      entryOnly
        ? "entry-only handoff must not name a release"
        : "public boundary requires a release record"
    );
  }
  return errors;
};

// A prepared or verified receipt without a release record is valid only as an
// entry-only outcome: no version was selected, bumped, or suggested.
const isEntryOnlyOutcome = (receipt: ChangelogReceipt): boolean => {
  const decision = receipt.versionDecision;
  return (
    receipt.release === null &&
    (decision === null ||
      (decision.boundary === "none" &&
        decision.bumpLevel === "none" &&
        decision.resolution === "not-required" &&
        decision.selectedVersion === null &&
        decision.suggestedVersion === null))
  );
};

const isResolvedPublicClassification = (receipt: ChangelogReceipt): boolean => {
  const decision = receipt.versionDecision;
  return (
    decision !== null &&
    oneOf(decision.boundary, RELEASE_BOUNDARIES) &&
    decision.boundary !== "none" &&
    oneOf(decision.bumpLevel, ["none", "patch", "minor", "major"]) &&
    oneOf(decision.policyAction, ["ask", "automatic"]) &&
    // An ask policy resolves only by explicit direction; only an automatic
    // policy may resolve by itself or through repository automation.
    (decision.resolution === "explicit-direction" ||
      (decision.policyAction === "automatic" &&
        ["automatic", "repository-automation"].includes(
          decision.resolution
        ))) &&
    nonEmpty(decision.selectedVersion)
  );
};

const hasClassifiedDecision = (receipt: ChangelogReceipt): boolean =>
  (isEntryOnlyOutcome(receipt) && receipt.versionDecision !== null) ||
  isResolvedPublicClassification(receipt);

const receiptStatusErrors = (receipt: ChangelogReceipt): string[] => {
  const errors: string[] = [];
  const decision = receipt.versionDecision;
  const entryOnly = isEntryOnlyOutcome(receipt);
  requireCondition(
    errors,
    receipt.releaseImpact !== "none" || receipt.status === "not-applicable",
    "internal-only or non-public work must be not-applicable"
  );
  requireCondition(
    errors,
    receipt.status !== "classified" ||
      (receipt.phase === "classify" &&
        receipt.release === null &&
        hasClassifiedDecision(receipt) &&
        receipt.revisionLineage.reconciliationHeadRevision === null &&
        receipt.revisionLineage.finalizedTargetRevision === null &&
        receipt.releaseImpact !== "none" &&
        receipt.paths.length === 0 &&
        receipt.reasonCode === null &&
        receipt.requiredAction === null &&
        receipt.reason === null),
    "classified receipt invariants failed"
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
  const preparedRelease = entryOnly
    ? receipt.paths.length > 0
    : Boolean(decision?.selectedVersion && receipt.release) &&
      receipt.release?.version === decision?.selectedVersion &&
      receipt.release?.targetContainedUnreleased === "prepared";
  requireCondition(
    errors,
    receipt.status !== "prepared" ||
      (preparedRelease &&
        revision(receipt.revisionLineage.reconciliationHeadRevision)),
    "prepared receipt invariants failed"
  );
  const verifiedRelease =
    entryOnly || receipt.release?.targetContainedUnreleased === "integrated";
  requireCondition(
    errors,
    receipt.status !== "verified" ||
      (receipt.phase === "verify" &&
        receipt.paths.length === 0 &&
        verifiedRelease &&
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

/**
 * Validates a receipt v2, v3, or v4, optionally against its exact request.
 * Receipts v3 and v4 also get every structural rule of their schema and the
 * Simple Changes 0.23.0 line and binding rules, including the prior receipt
 * when given; receipt v4 adds the Simple Changes 0.27.0 release-tag rules.
 */
export const validateChangelogReceipt = (
  value: unknown,
  request?: ChangelogRequest,
  prior?: unknown
): { errors: string[]; value?: ChangelogReceipt } => {
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
  if (
    !exactKeys(
      value,
      carriesLine(value as unknown as ChangelogReceipt)
        ? [...expected, "releaseSetTrains"]
        : expected
    )
  ) {
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
  const receipt = value as unknown as ChangelogReceipt;
  if (carriesLine(receipt)) {
    const shape = receiptShapeErrorsV3(receipt);
    if (shape.length > 0) {
      return { errors: shape };
    }
  } else if (
    receipt.status === "classified" &&
    receipt.versionDecision !== null &&
    receipt.versionDecision.boundary !== "none"
  ) {
    // Apply the closed structural contract to the newly supported public v2
    // classification path while preserving unrelated legacy v2 behavior.
    if (
      !exactKeys(
        receipt.versionDecision as unknown as Record<string, unknown>,
        DECISION_KEYS.filter((key) => key !== "versionLine")
      )
    ) {
      return { errors: ["versionDecision is invalid"] };
    }
    const shape = receiptShapeErrorsV3({
      ...receipt,
      releaseSetTrains: null,
      schemaVersion: 3,
      versionDecision: { ...receipt.versionDecision, versionLine: null },
    });
    if (shape.length > 0) {
      return { errors: shape };
    }
  }
  const errors = [
    ...receiptBaseErrors(receipt),
    ...receiptRequestErrors(receipt, request),
    ...receiptStatusErrors(receipt),
    ...(carriesLine(receipt) ? receiptRulesV3(receipt, request, prior) : []),
    ...tagContinuityErrors(receipt, prior),
  ];
  return errors.length > 0 ? { errors } : { errors, value: receipt };
};

// The tag a receipt's release names: a v4 release's tag, or null for a
// release from an earlier receipt version, which cannot name one.
const releaseTagOf = (receipt: unknown): ReleaseTag | null => {
  if (!isRecord(receipt) || receipt.schemaVersion !== 4) {
    return null;
  }
  const { release } = receipt;
  return isRecord(release) && isRecord(release.tag)
    ? (release.tag as unknown as ReleaseTag)
    : null;
};

const sameTag = (left: ReleaseTag | null, right: ReleaseTag | null): boolean =>
  left === null || right === null
    ? left === right
    : left.name === right.name && left.message === right.message;

const releaseTagNameBindingProblem = (
  name: string,
  version: string
): string | null => {
  const problem = releaseTagNameProblem(name);
  if (problem) {
    return `release tag ${name} ${problem}`;
  }
  const prefix = name.slice(0, name.length - version.length);
  return name.endsWith(version) &&
    (prefix === "" || !VERSION_BOUNDARY_PATTERN.test(prefix))
    ? null
    : `release tag ${name} must be ${version} or end with it after a character other than a digit or .`;
};

const releaseTagMessageProblem = (
  message: string,
  version: string
): string | null => {
  const displayName = message.slice(0, -(version.length + 1));
  return tagMessageShape(message) &&
    message.endsWith(` ${version}`) &&
    displayName !== "" &&
    displayName.trim() === displayName
    ? null
    : `release tag message must be one line of at most 200 characters, "<display name> ${version}"`;
};

/**
 * Why a release tag cannot name `version`, or null. The name must pass Git's
 * ref-name rules and a leading `-` check, and equal the version or end with it
 * after a character other than a digit or `.`, so `v11.2.0` never passes for
 * `1.2.0`. The message is one line, `<display name> <version>`.
 */
export const releaseTagProblem = (
  tag: ReleaseTag,
  version: string
): string | null =>
  releaseTagNameBindingProblem(tag.name, version) ??
  releaseTagMessageProblem(tag.message, version);

// Receipt v4: a named tag is bound to the release version.
// priorReceiptErrors keeps it unchanged after prepare.
const releaseTagErrors = (receipt: LineCarryingReceipt): string[] => {
  const tag = releaseTagOf(receipt);
  const problem =
    tag && receipt.release
      ? releaseTagProblem(tag, receipt.release.version)
      : null;
  return problem ? [problem] : [];
};

const matchesDecision = (
  decision: VersionDecisionV2 | null,
  fields: Record<string, unknown>
): boolean =>
  decision !== null &&
  Object.entries(fields).every(
    ([key, expected]) => decision[key as keyof VersionDecisionV2] === expected
  );

const lineShape = (line: unknown): boolean =>
  isRecord(line) &&
  exactKeys(line, LINE_KEYS) &&
  oneOf(line.mode, SHARED_VERSION_LINE_MODES) &&
  stringList(line.members, 2) &&
  isRecord(line.memberVersions) &&
  Object.keys(line.memberVersions).length >= 2 &&
  Object.values(line.memberVersions).every(
    (version) => version === null || stableParts(version) !== null
  ) &&
  (line.sharedVersion === null || stableParts(line.sharedVersion) !== null) &&
  stringList(line.sharedVersionTrains, 0) &&
  oneOf(line.outcome, ["catch-up", "advance"]);

const decisionShape = (decision: unknown): boolean =>
  isRecord(decision) &&
  exactKeys(decision, DECISION_KEYS) &&
  nonEmpty(decision.releaseTrain) &&
  oneOf(decision.boundary, RELEASE_BOUNDARIES) &&
  oneOf(decision.bumpLevel, RELEASE_IMPACTS) &&
  oneOf(decision.policyAction, POLICY_ACTIONS) &&
  oneOf(decision.resolution, RESOLUTIONS) &&
  oneOf(decision.source, DECISION_SOURCES) &&
  [
    decision.currentVersion,
    decision.suggestedVersion,
    decision.selectedVersion,
  ].every((version) => nullable(version, nonEmpty));

// A receipt v4 release also carries `tag`: null, or a closed name and message.
// The schema's name and message patterns are not repeated here:
// releaseTagProblem refuses every name and message they refuse, and more.
const tagShape = (tag: unknown): boolean =>
  tag === null ||
  (isRecord(tag) &&
    exactKeys(tag, ["name", "message"]) &&
    typeof tag.name === "string" &&
    typeof tag.message === "string");

const releaseShape = (release: unknown, withTag: boolean): boolean =>
  isRecord(release) &&
  exactKeys(
    release,
    withTag
      ? ["version", "date", "targetContainedUnreleased", "tag"]
      : ["version", "date", "targetContainedUnreleased"]
  ) &&
  nonEmpty(release.version) &&
  typeof release.date === "string" &&
  DATE_PATTERN.test(release.date) &&
  oneOf(release.targetContainedUnreleased, ["prepared", "integrated"]) &&
  (!withTag || tagShape(release.tag));

// The status conditions of the receipt v3 and v4 schemas, which receipt v2 is
// not held to here.
const statusShapeErrorsV3 = (receipt: LineCarryingReceipt): string[] => {
  const decision = receipt.versionDecision;
  const lineage = receipt.revisionLineage;
  const noCodes =
    receipt.reasonCode === null && receipt.requiredAction === null;
  const noPaths = receipt.paths.length === 0;
  const releaseIs = (state: "prepared" | "integrated") =>
    receipt.release === null ||
    receipt.release.targetContainedUnreleased === state;
  const conditions: Record<ReceiptStatus, boolean> = {
    blocked: [receipt.reasonCode, receipt.requiredAction, receipt.reason].every(
      nonEmpty
    ),
    classified:
      receipt.phase === "classify" &&
      noPaths &&
      oneOf(receipt.releaseImpact, ["patch", "minor", "major"]) &&
      receipt.release === null &&
      (matchesDecision(decision, ENTRY_DECISION) ||
        isResolvedPublicClassification(receipt)) &&
      lineage.reconciliationHeadRevision === null &&
      lineage.finalizedTargetRevision === null &&
      noCodes &&
      receipt.reason === null,
    "decision-required":
      receipt.phase === "classify" &&
      noPaths &&
      matchesDecision(decision, {
        policyAction: "ask",
        resolution: "approval-required",
        selectedVersion: null,
      }) &&
      receipt.release === null &&
      receipt.reasonCode === "version-direction-required" &&
      receipt.requiredAction === "choose-version",
    "not-applicable":
      receipt.phase === "classify" &&
      noPaths &&
      receipt.release === null &&
      matchesDecision(decision, ENTRY_DECISION) &&
      noCodes,
    prepared:
      receipt.phase === "prepare" &&
      !noPaths &&
      revision(lineage.reconciliationHeadRevision) &&
      lineage.finalizedTargetRevision === null &&
      releaseIs("prepared") &&
      noCodes,
    verified:
      receipt.phase === "verify" &&
      noPaths &&
      revision(lineage.reconciliationHeadRevision) &&
      revision(lineage.finalizedTargetRevision) &&
      releaseIs("integrated") &&
      noCodes,
  };
  const errors: string[] = [];
  requireCondition(
    errors,
    conditions[receipt.status],
    `${receipt.status} receipt fails its schema conditions`
  );
  requireCondition(
    errors,
    !(receipt.status === "prepared" || receipt.status === "verified") ||
      receipt.release !== null ||
      decision === null ||
      matchesDecision(decision, ENTRY_DECISION),
    "a release-less receipt must select and suggest nothing"
  );
  return errors;
};

const receiptShapeErrorsV3 = (receipt: LineCarryingReceipt): string[] => {
  const errors: string[] = [];
  const lineage = receipt.revisionLineage as unknown as Record<string, unknown>;
  const decision = receipt.versionDecision as unknown;
  requireCondition(
    errors,
    oneOf(receipt.status, RECEIPT_STATUSES) && oneOf(receipt.phase, PHASES),
    "receipt status or phase is unsupported"
  );
  requireCondition(
    errors,
    nonEmpty(receipt.transactionId) && nullable(receipt.releaseSetId, nonEmpty),
    "transactionId or releaseSetId is invalid"
  );
  requireCondition(
    errors,
    trainList(receipt.releaseSetTrains),
    "releaseSetTrains is invalid"
  );
  requireCondition(
    errors,
    typeof receipt.observedAt === "string" &&
      receipt.observedAt.includes("T") &&
      !Number.isNaN(Date.parse(receipt.observedAt)),
    "observedAt must be a date-time"
  );
  requireCondition(
    errors,
    exactKeys(lineage, LINEAGE_KEYS) &&
      revision(lineage.inputTargetRevision) &&
      nullable(lineage.reconciliationHeadRevision, revision) &&
      nullable(lineage.finalizedTargetRevision, revision),
    "revisionLineage is invalid"
  );
  requireCondition(
    errors,
    (receipt.paths as unknown[]).every(
      (item) =>
        isRecord(item) &&
        exactKeys(item, ["path", "digest"]) &&
        typeof item.path === "string" &&
        PATH_PATTERN.test(item.path) &&
        digest(item.digest)
    ) &&
      new Set(receipt.paths.map((item) => JSON.stringify(item))).size ===
        receipt.paths.length,
    "changed paths are invalid"
  );
  requireCondition(
    errors,
    [...receipt.checks, ...receipt.evidence].every(nonEmpty),
    "checks and evidence must be non-empty strings"
  );
  requireCondition(
    errors,
    oneOf(receipt.releaseImpact, RELEASE_IMPACTS) &&
      nullable(receipt.reason, nonEmpty),
    "releaseImpact or reason is invalid"
  );
  requireCondition(
    errors,
    receipt.release === null ||
      releaseShape(receipt.release, receipt.schemaVersion === 4),
    "release is invalid"
  );
  requireCondition(
    errors,
    decision === null || decisionShape(decision),
    "versionDecision is invalid"
  );
  requireCondition(
    errors,
    !isRecord(decision) ||
      decision.versionLine === null ||
      lineShape(decision.versionLine),
    "versionLine is invalid"
  );
  return errors.length > 0 ? errors : statusShapeErrorsV3(receipt);
};

// The line head H and the members holding it, recomputed from memberVersions.
const lineHead = (
  line: VersionLine
): { head: string | null; holders: string[] } => {
  let head: string | null = null;
  for (const member of line.members) {
    const version = line.memberVersions[member] ?? null;
    if (
      version !== null &&
      (head === null || compareStable(version, head) > 0)
    ) {
      head = version;
    }
  }
  const holders = line.members.filter((member) => {
    const version = line.memberVersions[member] ?? null;
    return (
      version !== null && head !== null && compareStable(version, head) === 0
    );
  });
  return { head, holders: sorted(holders) };
};

/**
 * Two lines share a state when mode, members, member versions, and head
 * agree by value. The outcome is excluded: an approved direction may turn a
 * catch-up into an advance under the same decision digest.
 */
export const sameLineState = (
  left: VersionLine | null,
  right: VersionLine | null
): boolean => {
  if (left === null || right === null) {
    return left === right;
  }
  const same = (a: string | null, b: string | null): boolean =>
    a === null || b === null ? a === b : compareStable(a, b) === 0;
  return (
    left.mode === right.mode &&
    sameList(left.members, right.members) &&
    left.members.every((member) =>
      same(
        left.memberVersions[member] ?? null,
        right.memberVersions[member] ?? null
      )
    ) &&
    same(left.sharedVersion, right.sharedVersion)
  );
};

// The version a receipt proposes: the suggestion while approval is pending,
// the selection once made, and none for blocked or not-applicable receipts.
const proposedVersion = (receipt: LineCarryingReceipt): string | null => {
  const decision = receipt.versionDecision;
  if (receipt.status === "decision-required") {
    return decision?.suggestedVersion ?? null;
  }
  return ["classified", "prepared", "verified"].includes(receipt.status)
    ? (decision?.selectedVersion ?? null)
    : null;
};

const versionLineErrors = (receipt: LineCarryingReceipt): string[] => {
  const decision = receipt.versionDecision;
  const line = decision?.versionLine;
  if (!(decision && line)) {
    return [];
  }
  const errors: string[] = [];
  const train = decision.releaseTrain;
  const own = line.memberVersions[train] ?? null;
  const { head, holders } = lineHead(line);
  requireCondition(
    errors,
    sameList(line.members, sorted(line.members)) &&
      line.members.includes(train) &&
      sameList(sorted(Object.keys(line.memberVersions)), line.members),
    "versionLine members must be sorted, include the train, and key memberVersions"
  );
  requireCondition(
    errors,
    (head === null
      ? line.sharedVersion === null
      : line.sharedVersion !== null &&
        compareStable(line.sharedVersion, head) === 0) &&
      sameList(line.sharedVersionTrains, holders),
    "sharedVersion and sharedVersionTrains must be recomputed from memberVersions"
  );
  requireCondition(
    errors,
    line.mode !== "bump-shared" || line.outcome === "advance",
    "bump-shared always advances"
  );
  requireCondition(
    errors,
    line.outcome !== "catch-up" ||
      (head !== null && (own === null || compareStable(own, head) < 0)),
    "only a train behind the line head catches up"
  );
  const proposed = proposedVersion(receipt);
  if (proposed === null) {
    return errors;
  }
  if (stableParts(proposed) === null) {
    return [...errors, `${proposed} is not a stable dotted version`];
  }
  const current = decision.currentVersion;
  requireCondition(
    errors,
    own === null || compareStable(proposed, own) > 0,
    `${proposed} must exceed the train's own ${own}`
  );
  requireCondition(
    errors,
    head === null ||
      (line.outcome === "catch-up"
        ? compareStable(proposed, head) === 0
        : compareStable(proposed, head) > 0),
    `${proposed} does not fit ${line.outcome} from the line head ${head}`
  );
  requireCondition(
    errors,
    current === null ||
      stableParts(current) === null ||
      compareStable(proposed, current) >= 0,
    `${proposed} is below the current version ${current}`
  );
  return errors;
};

// The line state stays fixed under one decision digest.
const priorReceiptErrors = (
  receipt: LineCarryingReceipt,
  prior: unknown
): string[] => {
  if (!isRecord(prior)) {
    return [];
  }
  const errors: string[] = [];
  const priorLine =
    (prior.schemaVersion === 3 || prior.schemaVersion === 4) &&
    prior.decisionDigest === receipt.decisionDigest &&
    isRecord(prior.versionDecision)
      ? ((prior.versionDecision.versionLine as VersionLine | null) ?? null)
      : undefined;
  requireCondition(
    errors,
    priorLine === undefined ||
      sameLineState(priorLine, receipt.versionDecision?.versionLine ?? null),
    "the line state changed under the same decisionDigest"
  );
  return errors;
};

// Once a prior v4 receipt carried the release, every later receipt that
// carries it, of any version, names exactly the same tag, or none when the
// prior named none; a v2 or v3 receipt names none. The pre-merge dry run
// checked that name, so a dropped, changed, or added tag fails closed.
const tagContinuityErrors = (
  receipt: ChangelogReceipt,
  prior: unknown
): string[] =>
  isRecord(prior) &&
  prior.schemaVersion === 4 &&
  isRecord(prior.release) &&
  receipt.release !== null &&
  !sameTag(releaseTagOf(prior), releaseTagOf(receipt))
    ? ["the release tag changed after prepare"]
    : [];

const receiptRulesV3 = (
  receipt: LineCarryingReceipt,
  request?: ChangelogRequest,
  prior?: unknown
): string[] => {
  const errors: string[] = [];
  const decision = receipt.versionDecision;
  requireCondition(
    errors,
    receipt.release === null ||
      receipt.release.version === decision?.selectedVersion,
    "release version must be the selected version"
  );
  errors.push(
    ...versionLineErrors(receipt),
    ...releaseTagErrors(receipt),
    ...priorReceiptErrors(receipt, prior)
  );
  if (!request) {
    return errors;
  }
  const trains = request.schemaVersion === 1 ? null : request.releaseSetTrains;
  requireCondition(
    errors,
    (request.supportedReceiptVersions as number[]).includes(
      receipt.schemaVersion
    ),
    `the request did not advertise receipt v${receipt.schemaVersion}`
  );
  requireCondition(
    errors,
    trains === null
      ? receipt.releaseSetTrains === null
      : receipt.releaseSetTrains !== null &&
          sameList(receipt.releaseSetTrains, trains),
    "releaseSetTrains must echo the request"
  );
  requireCondition(
    errors,
    receipt.sourceRevision ===
      (request.phase === "verify"
        ? request.finalizedTargetRevision
        : request.inputTargetRevision) &&
      (request.phase !== "verify" ||
        receipt.revisionLineage.finalizedTargetRevision ===
          request.finalizedTargetRevision),
    "receipt revisions do not match the request"
  );
  requireCondition(
    errors,
    (request.approvedDecisionDigest === null ||
      receipt.decisionDigest === request.approvedDecisionDigest) &&
      (request.approvedVersion === null ||
        decision?.selectedVersion === request.approvedVersion),
    "receipt does not match its approval"
  );
  requireCondition(
    errors,
    prior === undefined ||
      (request.priorReceiptDigest !== null &&
        digestCanonicalJson(prior) === request.priorReceiptDigest),
    "prior receipt does not match priorReceiptDigest"
  );
  return errors;
};

// The receipt versions each distribution writes: full writes receipt v3 with
// its version line, and the other versioned distributions skip it.
export const FULL_RECEIPT_VERSIONS = [1, 2, 3, 4] as const;
export const NARROW_RECEIPT_VERSIONS = [1, 2, 4] as const;

/** The highest receipt version the request and this provider both support. */
export const receiptVersionFor = (
  request: ChangelogRequest,
  provided: readonly number[] = FULL_RECEIPT_VERSIONS
): number | null =>
  Math.max(
    ...(request.supportedReceiptVersions as number[]).filter((version) =>
      provided.includes(version)
    ),
    0
  ) || null;

/**
 * Shapes a receipt v2 body for its request. Receipts v3 and v4 echo the
 * request's releaseSetTrains and carry the line in
 * versionDecision.versionLine; receipt v4's release also names its tag (null
 * for no tag); receipt v2 keeps the line as one `versionLine {...}` evidence
 * item. A request v1 never advertises v3 or v4, so it always gets receipt v2
 * or below.
 */
export const shapeReceipt = (
  request: ChangelogRequest,
  receipt: ChangelogReceiptV2,
  line: VersionLine | null,
  {
    provided = FULL_RECEIPT_VERSIONS,
    tag = null,
  }: { provided?: readonly number[]; tag?: ReleaseTag | null } = {}
): ChangelogReceipt => {
  const version = receiptVersionFor(request, provided);
  if (version === 3 || version === 4) {
    const { release, versionDecision, ...rest } = receipt;
    const lined = {
      ...rest,
      releaseSetTrains:
        request.schemaVersion === 1 ? null : request.releaseSetTrains,
      versionDecision: versionDecision && {
        ...versionDecision,
        versionLine: line,
      },
    };
    return version === 4
      ? { ...lined, release: release && { ...release, tag }, schemaVersion: 4 }
      : { ...lined, release, schemaVersion: 3 };
  }
  if (version !== 2) {
    throw new Error("Receipt v1 is a legacy shape this model does not write");
  }
  return line
    ? { ...receipt, evidence: [...receipt.evidence, versionLineEvidence(line)] }
    : receipt;
};

// The release-tag setting resolved for one train: its template, "none" when
// the setting is "none" or leaves the train unlisted, and undefined when the
// policy has no releaseTags field.
export const releaseTagTemplateFor = (
  setting: ReleaseTagsSetting | undefined,
  train: string
): string | undefined => {
  if (setting === undefined || typeof setting === "string") {
    return setting;
  }
  return Object.hasOwn(setting, train) ? setting[train] : "none";
};

export type ReleaseTagDecision =
  | { tag: ReleaseTag | null }
  | {
      reason: string;
      reasonCode: "invalid-version-direction" | "malformed-policy";
      requiredAction: "choose-version" | "repair-policy";
    };

/**
 * Names one release's tag at classify and prepare: the train's template
 * prefix plus the exact version, with the message `<display name> <version>`.
 * A single template on a repository with two or more public trains, or an
 * invalid setting, blocks with `malformed-policy`; a name Git would refuse,
 * or one a local tag on another commit already holds, blocks with
 * `invalid-version-direction`.
 */
export const releaseTagFor = ({
  displayName,
  publicTrains,
  setting,
  target = null,
  taken = null,
  train,
  version,
}: {
  displayName: string;
  publicTrains: number;
  setting: ReleaseTagsSetting | undefined;
  target?: string | null;
  taken?: string | null;
  train: string;
  version: string;
}): ReleaseTagDecision => {
  const malformed = (reason: string): ReleaseTagDecision => ({
    reason,
    reasonCode: "malformed-policy",
    requiredAction: "repair-policy",
  });
  const refused = (reason: string): ReleaseTagDecision => ({
    reason,
    reasonCode: "invalid-version-direction",
    requiredAction: "choose-version",
  });
  if (setting === undefined) {
    return { tag: null };
  }
  const errors = releaseTagsErrors(setting);
  if (errors.length > 0) {
    return malformed(errors.join("; "));
  }
  if (typeof setting === "string" && setting !== "none" && publicTrains >= 2) {
    return malformed(
      `One releaseTags template cannot name ${publicTrains} release trains; record one per train.`
    );
  }
  const template = releaseTagTemplateFor(setting, train);
  if (template === undefined || template === "none") {
    return { tag: null };
  }
  const tag = {
    message: `${displayName} ${version}`,
    name: template.slice(0, -"{version}".length) + version,
  };
  const problem = releaseTagNameBindingProblem(tag.name, version);
  if (problem) {
    return refused(problem);
  }
  // The display name is the agent's choice, never the owner's: shorten it.
  const messageProblem = releaseTagMessageProblem(tag.message, version);
  if (messageProblem) {
    throw new Error(messageProblem);
  }
  if (taken !== null && taken !== target) {
    return refused(
      `Tag ${tag.name} already exists on another commit, so ${version} was already released.`
    );
  }
  return { tag };
};

export interface ReleaseSetConsistency {
  lines: { members: string[]; selectedVersion: string | null }[];
  missingTrains: string[];
  receipts: number;
  releaseSetId: string;
}

const lineKey = (line: VersionLine): string => line.members.join("\0");

// Each train belongs to at most one line, which its own receipt carries.
const lineMembershipErrors = (receipts: LineCarryingReceipt[]): string[] => {
  const errors: string[] = [];
  const claims = new Map<string, string>();
  for (const receipt of receipts) {
    const line = receipt.versionDecision?.versionLine;
    if (!line) {
      continue;
    }
    for (const member of line.members) {
      const claimed = claims.get(member);
      requireCondition(
        errors,
        claimed === undefined || claimed === lineKey(line),
        `receipts disagree about the line ${member} belongs to`
      );
      claims.set(member, lineKey(line));
    }
  }
  for (const receipt of receipts) {
    const train = receipt.versionDecision?.releaseTrain;
    const line = receipt.versionDecision?.versionLine ?? null;
    const claimed = train === undefined ? undefined : claims.get(train);
    requireCondition(
      errors,
      claimed === undefined || (line !== null && lineKey(line) === claimed),
      `another receipt places ${train} on a line its own receipt does not carry`
    );
  }
  return errors;
};

// Two trains never name one release tag; prefix-free templates already
// prevent it, and this is the cheap backstop.
const releaseSetTagErrors = (receipts: LineCarryingReceipt[]): string[] => {
  const errors: string[] = [];
  const claims = new Map<string, string>();
  for (const receipt of receipts) {
    const tag = releaseTagOf(receipt);
    if (tag) {
      const train =
        receipt.versionDecision?.releaseTrain ?? receipt.transactionId;
      const other = claims.get(tag.name);
      requireCondition(
        errors,
        other === undefined || other === train,
        `${other} and ${train} both name release tag ${tag.name}; each train needs its own`
      );
      claims.set(tag.name, train);
    }
  }
  return errors;
};

/**
 * Checks the v3 and v4 receipts of one release set together, as Simple
 * Changes `validate-changelog-release-set` does: one set, input target, and
 * train list; one receipt per train; each train on at most one line; per line
 * one state and one identical version string; and never one tag for two
 * trains. Trains without a receipt yet are reported, not refused: a release
 * set is non-atomic.
 */
export const validateChangelogReleaseSet = (
  values: unknown[]
): { errors: string[]; value?: ReleaseSetConsistency } => {
  const receipts: LineCarryingReceipt[] = [];
  for (const value of values) {
    const result = validateChangelogReceipt(value);
    if (!(result.value && carriesLine(result.value))) {
      return {
        errors: [
          "a release-set check needs valid v3 or v4 receipts",
          ...result.errors,
        ],
      };
    }
    receipts.push(result.value);
  }
  const [first] = receipts;
  if (!first?.releaseSetId) {
    return { errors: ["a release-set check needs a named release set"] };
  }
  const errors: string[] = [];
  const trains = sorted(first.releaseSetTrains ?? []);
  const seen = new Set<string>();
  const lines = new Map<
    string,
    { line: VersionLine; selectedVersion: string | null }
  >();
  for (const receipt of receipts) {
    const decision = receipt.versionDecision;
    const train = decision?.releaseTrain ?? null;
    requireCondition(
      errors,
      receipt.releaseSetTrains !== null &&
        receipt.releaseSetId === first.releaseSetId &&
        receipt.revisionLineage.inputTargetRevision ===
          first.revisionLineage.inputTargetRevision &&
        sameList(sorted(receipt.releaseSetTrains), trains),
      "every receipt must share the releaseSetId, input target revision, and releaseSetTrains"
    );
    if (train !== null) {
      requireCondition(
        errors,
        trains.includes(train) && !seen.has(train),
        `${train} must appear once and in releaseSetTrains`
      );
      seen.add(train);
    }
    const line = decision?.versionLine;
    if (!(decision && line)) {
      continue;
    }
    const known = lines.get(lineKey(line));
    if (!known) {
      lines.set(lineKey(line), {
        line,
        selectedVersion: decision.selectedVersion,
      });
      continue;
    }
    requireCondition(
      errors,
      sameLineState(known.line, line),
      "receipts on one line must share its state"
    );
    requireCondition(
      errors,
      known.selectedVersion === null ||
        decision.selectedVersion === null ||
        known.selectedVersion === decision.selectedVersion,
      `trains on one line publish one identical version string, not ${known.selectedVersion} and ${decision.selectedVersion}`
    );
    known.selectedVersion ??= decision.selectedVersion;
  }
  errors.push(
    ...lineMembershipErrors(receipts),
    ...releaseSetTagErrors(receipts)
  );
  return errors.length > 0
    ? { errors }
    : {
        errors,
        value: {
          lines: [...lines.values()].map(({ line, selectedVersion }) => ({
            members: line.members,
            selectedVersion,
          })),
          missingTrains: trains.filter((train) => !seen.has(train)),
          receipts: receipts.length,
          releaseSetId: first.releaseSetId,
        },
      };
};

// Resolved shared version lines join the digest only when there is at least
// one, and the train's resolved release-tag template (`none` included) only
// when the policy records releaseTags, so every earlier digest is unchanged.
export const effectivePolicyDigest = ({
  releaseTags,
  sharedVersionLines,
  ...input
}: {
  automationOwner: string | null;
  policy: unknown;
  releaseTags?: string;
  releaseTrain: string;
  sharedVersionLines?: SharedVersionLine[];
  source: string;
  versionConvention: string;
  versionOwner: string;
}): string =>
  digestCanonicalJson({
    ...input,
    ...(releaseTags !== undefined && { releaseTags }),
    ...(sharedVersionLines?.length && { sharedVersionLines }),
  });

// On a line, the decision digest covers the line state (mode, members,
// memberVersions, and sharedVersion) but not the outcome; without a line it
// is unchanged.
export const decisionDigest = ({
  versionLine,
  ...input
}: {
  boundary: Boundary;
  currentVersion: string | null;
  effectivePolicyDigest: string;
  impact: Impact;
  inputTargetRevision: string;
  releaseTrain: string;
  selectedVersion: string | null;
  suggestedVersion: string | null;
  transactionId: string;
  versionLine?: VersionLine | null;
  versionOwner: string;
}): string =>
  digestCanonicalJson(
    versionLine
      ? {
          ...input,
          versionLine: {
            members: versionLine.members,
            memberVersions: versionLine.memberVersions,
            mode: versionLine.mode,
            sharedVersion: versionLine.sharedVersion,
          },
        }
      : input
  );
