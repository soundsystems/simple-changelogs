import { types as utilTypes } from "node:util";
import {
  ACTIVATION_MODES,
  ASSERTION_KINDS,
  type AssertionKind,
  AUTHORIZATION_SOURCES,
  AUTHORIZATION_STATUSES,
  BACKFILL_STATUSES,
  CROSS_SURFACE_VERSIONING_POLICIES,
  CURATION_MANIFEST_VERSION,
  CURATION_OPERATION_DIRECTIONS,
  CURATION_OPERATION_OVERLAPS,
  CURATION_OPERATION_STATUSES,
  CURATION_SCOPE_MATURITIES,
  CURATION_STRATEGY_GROUPINGS,
  CURATION_STRATEGY_ORDERINGS,
  CURATION_SURFACE_AUDIENCES,
  CURATION_SURFACE_MODES,
  type CurationManifest,
  DEPLOYED_SURFACE_CHANGE_KINDS,
  DEPLOYED_SURFACE_STATES,
  DEVELOPER_CHANGELOG_POLICIES,
  DISTRIBUTIONS,
  EVAL_SUITES,
  type EvalManifest,
  type GlobalPreferences,
  MANIFEST_VERSION,
  MOBILE_RELEASE_NOTE_PLACEMENTS,
  PROTOCOL_VERSION,
  RELEASE_NOTE_ENVIRONMENT_SCOPES,
  RELEASE_NOTE_LINK_POLICIES,
  type RepoPolicy,
  RUNNER_MESSAGE_ROLES,
  RUNNER_STATUSES,
  type RunnerRequest,
  type RunnerResponse,
  SETUP_STYLES,
  SIGNATURE_POLICIES,
  SOURCE_REWRITE_CHANGE_KINDS,
  SURFACE_CHRONOLOGICAL_ACCESS_MODES,
  SURFACE_COMPONENT_SOURCES,
  SURFACE_DATE_DISPLAYS,
  SURFACE_DEFAULT_ORGANIZATIONS,
  SURFACE_DETAIL_DENSITIES,
  SURFACE_LAYOUTS,
  SURFACE_NAVIGATION_ITEMS,
  SURFACE_POLICIES,
  SURFACE_TRANSPARENCY_PREFERENCES,
  SURFACE_VERSION_DISPLAYS,
  SURFACE_VISUAL_DIRECTIONS,
  type ValidationResult,
  VERIFICATION_STATUSES,
  VERSION_IDENTIFIER_ROLES,
  VERSION_ROLES,
} from "./types.ts";

type JsonRecord = Record<string, unknown>;
type Validator = (value: unknown, path: string, errors: string[]) => void;
type Rule = Validator | { optional: true; validate: Validator };
type Shape = Record<string, Rule>;

const UPPERCASE_CODE = /^[A-Z][A-Z0-9_]*$/;
const JSON_PATH_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const ARRAY_INDEX = /^(0|[1-9]\d*)$/;

const childPath = (path: string, key: string): string =>
  JSON_PATH_IDENTIFIER.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;

const indexPath = (path: string, index: number): string => `${path}[${index}]`;

const isPlainObject = (value: unknown): value is JsonRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const optional = (validate: Validator): Rule => ({ optional: true, validate });

const isOptional = (
  rule: Rule
): rule is { optional: true; validate: Validator } =>
  typeof rule !== "function";

const objectOf =
  (shape: Shape): Validator =>
  (value, path, errors) => {
    if (!isPlainObject(value)) {
      errors.push(`${path} must be an object`);
      return;
    }

    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(shape, key)) {
        errors.push(`${childPath(path, key)} is not allowed`);
      }
    }

    for (const [key, rule] of Object.entries(shape)) {
      const propertyPath = childPath(path, key);
      if (!Object.hasOwn(value, key)) {
        if (!isOptional(rule)) {
          rule(undefined, propertyPath, errors);
        }
        continue;
      }
      (isOptional(rule) ? rule.validate : rule)(
        value[key],
        propertyPath,
        errors
      );
    }
  };

const literal =
  (expected: string | number): Validator =>
  (value, path, errors) => {
    if (value !== expected) {
      errors.push(`${path} must equal ${JSON.stringify(expected)}`);
    }
  };

const stringValue =
  (allowEmpty = false): Validator =>
  (value, path, errors) => {
    if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
      errors.push(
        `${path} must be ${allowEmpty ? "a string" : "a non-empty string"}`
      );
    }
  };

const booleanValue: Validator = (value, path, errors) => {
  if (typeof value !== "boolean") {
    errors.push(`${path} must be a boolean`);
  }
};

const integer =
  (minimum: number): Validator =>
  (value, path, errors) => {
    if (!Number.isInteger(value) || (value as number) < minimum) {
      errors.push(
        `${path} must be an integer greater than or equal to ${minimum}`
      );
    }
  };

const enumOf =
  (allowed: readonly string[]): Validator =>
  (value, path, errors) => {
    if (typeof value !== "string" || !allowed.includes(value)) {
      errors.push(`${path} must be one of ${allowed.join(", ")}`);
    }
  };

const uppercaseCode: Validator = (value, path, errors) => {
  if (typeof value !== "string" || !UPPERCASE_CODE.test(value)) {
    errors.push(`${path} must be an uppercase extensible code`);
  }
};

const arrayOf =
  (
    validateItem: Validator,
    options: { minItems?: number; uniqueStrings?: boolean } = {}
  ): Validator =>
  (value, path, errors) => {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
      return;
    }
    if (options.minItems !== undefined && value.length < options.minItems) {
      errors.push(`${path} must contain at least ${options.minItems} item(s)`);
    }

    const seen = new Set<string>();
    for (const [index, item] of value.entries()) {
      const itemPath = indexPath(path, index);
      validateItem(item, itemPath, errors);
      if (options.uniqueStrings && typeof item === "string") {
        if (seen.has(item)) {
          errors.push(`${itemPath} must be unique within ${path}`);
        }
        seen.add(item);
      }
    }
  };

const validateJsonValue = (
  value: unknown,
  path: string,
  errors: string[],
  ancestors: WeakSet<object>
): void => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      errors.push(`${path} must be a finite JSON number`);
    }
    return;
  }
  if (typeof value !== "object") {
    errors.push(`${path} must be a JSON value`);
    return;
  }
  if (ancestors.has(value)) {
    errors.push(`${path} must not contain a circular reference`);
    return;
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      validateJsonValue(item, indexPath(path, index), errors, ancestors);
    }
  } else if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      validateJsonValue(item, childPath(path, key), errors, ancestors);
    }
  } else {
    errors.push(`${path} must be a JSON object`);
  }
  ancestors.delete(value);
};

const jsonValue: Validator = (value, path, errors) => {
  validateJsonValue(value, path, errors, new WeakSet<object>());
};

const nonEmptyString = stringValue();
const anyString = stringValue(true);
const codeArray = arrayOf(uppercaseCode, { uniqueStrings: true });
const stringArray = arrayOf(nonEmptyString, { uniqueStrings: true });

const oneOf =
  (description: string, ...validators: Validator[]): Validator =>
  (value, path, errors) => {
    const valid = validators.some((validator) => {
      const candidateErrors: string[] = [];
      validator(value, path, candidateErrors);
      return candidateErrors.length === 0;
    });
    if (!valid) {
      errors.push(`${path} must be ${description}`);
    }
  };

/**
 * Validates a discriminated union: reads `discriminantKey` off the object,
 * looks up the matching variant validator, and delegates to it. Unlike
 * `oneOf`, this reports precise nested errors for the matched variant
 * instead of a single opaque "must be one of" message.
 */
const discriminatedUnion =
  (discriminantKey: string, variants: Record<string, Validator>): Validator =>
  (value, path, errors) => {
    if (!isPlainObject(value)) {
      errors.push(`${path} must be an object`);
      return;
    }
    const discriminant = value[discriminantKey];
    const variant =
      typeof discriminant === "string" ? variants[discriminant] : undefined;
    if (!variant) {
      errors.push(
        `${childPath(path, discriminantKey)} must be one of ${Object.keys(variants).join(", ")}`
      );
      return;
    }
    variant(value, path, errors);
  };

const REPO_RELATIVE_PATH = /^(?!\/)(?!.*\\)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/;

const repoRelativePath: Validator = (value, path, errors) => {
  if (typeof value !== "string" || !REPO_RELATIVE_PATH.test(value)) {
    errors.push(
      `${path} must be a repository-relative path without a leading slash, backslashes, or ".." segments`
    );
  }
};

const activationExpectation = oneOf(
  "a boolean or activation expectation",
  booleanValue,
  objectOf({
    activated: booleanValue,
    excludes: optional(stringArray),
    includes: optional(stringArray),
  })
);
const repoStateExpectation = objectOf({
  branch: optional(nonEmptyString),
  clean: optional(booleanValue),
});
const changedPathsExpectation = objectOf({
  allowed: optional(stringArray),
  forbidden: optional(stringArray),
  required: optional(stringArray),
});
const authorizationExpectation = oneOf(
  "an authorization code or expectation",
  uppercaseCode,
  objectOf({
    code: uppercaseCode,
    source: optional(enumOf(AUTHORIZATION_SOURCES)),
    status: optional(enumOf(AUTHORIZATION_STATUSES)),
  })
);
const versionMapExpectation = oneOf(
  "a version-map path or expectation",
  nonEmptyString,
  objectOf({
    field: optional(nonEmptyString),
    identifierRole: optional(enumOf(VERSION_IDENTIFIER_ROLES)),
    path: nonEmptyString,
    releaseTrain: optional(nonEmptyString),
    role: optional(enumOf(VERSION_ROLES)),
    version: optional(nonEmptyString),
  })
);
const verificationExpectation = oneOf(
  "a verification code or expectation",
  nonEmptyString,
  objectOf({
    code: nonEmptyString,
    status: optional(enumOf(VERIFICATION_STATUSES)),
  })
);

const expectedByAssertionKind: Record<AssertionKind, Validator> = {
  activation: activationExpectation,
  "file.changed": booleanValue,
  "file.unchanged": booleanValue,
  "git.changedPaths": changedPathsExpectation,
  "json.path": jsonValue,
  "path.absent": booleanValue,
  "path.exists": booleanValue,
  "repo.state": repoStateExpectation,
  "report.authorization": authorizationExpectation,
  "report.decision": uppercaseCode,
  "report.status": enumOf(RUNNER_STATUSES),
  "report.verification": verificationExpectation,
  "report.versionMap": versionMapExpectation,
  "text.match": nonEmptyString,
  "text.notMatch": nonEmptyString,
};

const targetedAssertionKinds = new Set<AssertionKind>([
  "file.changed",
  "file.unchanged",
  "json.path",
  "path.absent",
  "path.exists",
  "text.match",
  "text.notMatch",
]);

const assertionBase = objectOf({
  expected: jsonValue,
  kind: enumOf(ASSERTION_KINDS),
  target: optional(nonEmptyString),
});

const assertion: Validator = (value, path, errors) => {
  assertionBase(value, path, errors);
  if (
    !isPlainObject(value) ||
    typeof value.kind !== "string" ||
    !ASSERTION_KINDS.includes(value.kind as AssertionKind)
  ) {
    return;
  }
  const kind = value.kind as AssertionKind;
  const hasTarget = Object.hasOwn(value, "target");
  if (targetedAssertionKinds.has(kind) && !hasTarget) {
    errors.push(`${childPath(path, "target")} is required for ${kind}`);
  } else if (!targetedAssertionKinds.has(kind) && hasTarget) {
    errors.push(`${childPath(path, "target")} is not allowed for ${kind}`);
  }
  expectedByAssertionKind[kind](
    value.expected,
    childPath(path, "expected"),
    errors
  );
};

const turn = objectOf({
  assertions: arrayOf(assertion, { minItems: 1 }),
  prompt: nonEmptyString,
});

const evalCase = objectOf({
  activationMode: enumOf(ACTIVATION_MODES),
  fixture: nonEmptyString,
  id: nonEmptyString,
  skip: optional(nonEmptyString),
  suite: enumOf(EVAL_SUITES),
  tags: stringArray,
  turns: arrayOf(turn, { minItems: 1 }),
});

const repoPolicyBase = objectOf({
  crossSurfaceVersioning: optional(enumOf(CROSS_SURFACE_VERSIONING_POLICIES)),
  developerChangelog: enumOf(DEVELOPER_CHANGELOG_POLICIES),
  distribution: optional(enumOf(DISTRIBUTIONS)),
  guidance: objectOf({
    backfillStatus: enumOf(BACKFILL_STATUSES),
    version: integer(1),
  }),
  mobileReleaseNotePlacement: optional(enumOf(MOBILE_RELEASE_NOTE_PLACEMENTS)),
  newReleaseNoteSurfaceComponents: optional(enumOf(SURFACE_COMPONENT_SOURCES)),
  newReleaseNoteSurfaces: enumOf(SURFACE_POLICIES),
  releaseNoteEnvironmentScope: optional(
    enumOf(RELEASE_NOTE_ENVIRONMENT_SCOPES)
  ),
  releaseNoteLinks: optional(enumOf(RELEASE_NOTE_LINK_POLICIES)),
  schemaVersion: literal(1),
  signatures: enumOf(SIGNATURE_POLICIES),
});

const globalPreferences = objectOf({
  developerChangelog: enumOf(DEVELOPER_CHANGELOG_POLICIES),
  newReleaseNoteSurfaces: enumOf(SURFACE_POLICIES),
  profile: literal("solo-developer"),
  schemaVersion: literal(1),
  setupStyle: enumOf(SETUP_STYLES),
  signatures: enumOf(SIGNATURE_POLICIES),
});

const repoPolicy: Validator = (value, path, errors) => {
  repoPolicyBase(value, path, errors);
  if (!isPlainObject(value)) {
    return;
  }
  const { distribution, guidance } = value;
  const isFullDistribution =
    distribution === undefined || distribution === "full";
  if (
    isFullDistribution &&
    isPlainObject(guidance) &&
    typeof guidance.version === "number" &&
    guidance.version >= 6 &&
    !Object.hasOwn(value, "mobileReleaseNotePlacement")
  ) {
    errors.push(
      `${childPath(path, "mobileReleaseNotePlacement")} is required for full distribution guidance version 6 or newer`
    );
  }
};

const manifest = objectOf({
  cases: arrayOf(evalCase, { minItems: 1 }),
  manifestVersion: literal(MANIFEST_VERSION),
});

const runnerMessage = objectOf({
  content: anyString,
  role: enumOf(RUNNER_MESSAGE_ROLES),
});

const runnerRequest = objectOf({
  activationMode: enumOf(ACTIVATION_MODES),
  case: evalCase,
  prompt: nonEmptyString,
  protocolVersion: literal(PROTOCOL_VERSION),
  responseSchema: nonEmptyString,
  skillDirectory: nonEmptyString,
  timeoutMs: integer(1),
  transcript: optional(arrayOf(runnerMessage)),
  turnIndex: integer(0),
  workspace: nonEmptyString,
});

const authorizationRecord = objectOf({
  code: uppercaseCode,
  source: enumOf(AUTHORIZATION_SOURCES),
  status: enumOf(AUTHORIZATION_STATUSES),
});

const versionMapRecord = objectOf({
  field: optional(nonEmptyString),
  identifierRole: enumOf(VERSION_IDENTIFIER_ROLES),
  path: nonEmptyString,
  releaseTrain: optional(nonEmptyString),
  role: enumOf(VERSION_ROLES),
  version: nonEmptyString,
});

const verificationResult = objectOf({
  code: uppercaseCode,
  detail: optional(anyString),
  status: enumOf(VERIFICATION_STATUSES),
});

const nativeActivationEvidence = objectOf({
  activated: booleanValue,
  trace: arrayOf(nonEmptyString, { minItems: 1 }),
});

const evaluationReportBase = objectOf({
  authorizationRecords: arrayOf(authorizationRecord),
  decisionCodes: codeArray,
  nativeActivationEvidence: optional(nativeActivationEvidence),
  reasonCodes: codeArray,
  verificationResults: arrayOf(verificationResult),
  versionMap: arrayOf(versionMapRecord),
});

const UNNAMED_RELEASE_TRAIN = "\\0unnamed";

/**
 * One release train has exactly one chronology owner, so two
 * `canonical-release` records sharing a `releaseTrain` are contradictory. JSON
 * Schema cannot express this, so it is enforced here.
 */
const evaluationReport: Validator = (value, path, errors) => {
  evaluationReportBase(value, path, errors);
  if (!(isPlainObject(value) && Array.isArray(value.versionMap))) {
    return;
  }
  const canonicalTrains = new Set<string>();
  for (const [index, record] of value.versionMap.entries()) {
    if (
      !(isPlainObject(record) && record.identifierRole === "canonical-release")
    ) {
      continue;
    }
    const train =
      typeof record.releaseTrain === "string"
        ? record.releaseTrain
        : UNNAMED_RELEASE_TRAIN;
    if (canonicalTrains.has(train)) {
      errors.push(
        `${indexPath(childPath(path, "versionMap"), index)}.identifierRole duplicates canonical-release for release train ${train === UNNAMED_RELEASE_TRAIN ? "(unnamed)" : train}`
      );
    }
    canonicalTrains.add(train);
  }
};

const diagnostic = objectOf({
  code: uppercaseCode,
  message: anyString,
});

const runnerResponse = objectOf({
  diagnostics: optional(arrayOf(diagnostic)),
  evaluationReport,
  finalResponse: anyString,
  protocolVersion: literal(PROTOCOL_VERSION),
  runtimeIdentity: optional(nonEmptyString),
  status: enumOf(RUNNER_STATUSES),
});

// --- Curation manifest --------------------------------------------------

const sourceBoundary = objectOf({
  date: optional(nonEmptyString),
  heading: nonEmptyString,
  occurrence: integer(1),
  sourcePath: repoRelativePath,
  version: optional(nonEmptyString),
});

const curationScope = discriminatedUnion("kind", {
  "full-history": objectOf({ kind: literal("full-history") }),
  "item-set": objectOf({
    itemIds: arrayOf(nonEmptyString, { minItems: 1, uniqueStrings: true }),
    kind: literal("item-set"),
  }),
  release: objectOf({ kind: literal("release"), release: sourceBoundary }),
  "release-range": objectOf({
    first: sourceBoundary,
    kind: literal("release-range"),
    last: sourceBoundary,
  }),
  section: objectOf({
    kind: literal("section"),
    release: sourceBoundary,
    section: sourceBoundary,
  }),
});

const curationGroupShape = {
  groupId: nonEmptyString,
  itemIds: arrayOf(nonEmptyString, { minItems: 1, uniqueStrings: true }),
  label: nonEmptyString,
};
const curationGroup = objectOf(curationGroupShape);

const activeCurationScope = objectOf({
  activatedByOperationId: nonEmptyString,
  groups: arrayOf(curationGroup),
  maturity: enumOf(CURATION_SCOPE_MATURITIES),
  scope: curationScope,
  scopeId: nonEmptyString,
  sourceFingerprint: nonEmptyString,
});

const curationCounts = objectOf({
  eligibleAfter: integer(0),
  eligibleBefore: integer(0),
  groupsAfter: integer(0),
  groupsBefore: integer(0),
  mapped: integer(0),
  moved: integer(0),
});

const _curationStrategy = objectOf({
  customDescription: optional(nonEmptyString),
  grouping: enumOf(CURATION_STRATEGY_GROUPINGS),
  ordering: enumOf(CURATION_STRATEGY_ORDERINGS),
  withinGroup: enumOf(CURATION_STRATEGY_ORDERINGS),
});

const surfaceDisplayPreferences = objectOf({
  chronologicalAccess: enumOf(SURFACE_CHRONOLOGICAL_ACCESS_MODES),
  dateDisplay: enumOf(SURFACE_DATE_DISPLAYS),
  defaultOrganization: enumOf(SURFACE_DEFAULT_ORGANIZATIONS),
  detailDensity: enumOf(SURFACE_DETAIL_DENSITIES),
  layout: enumOf(SURFACE_LAYOUTS),
  navigation: arrayOf(enumOf(SURFACE_NAVIGATION_ITEMS), {
    uniqueStrings: true,
  }),
  versionDisplay: enumOf(SURFACE_VERSION_DISPLAYS),
  visualDirection: enumOf(SURFACE_VISUAL_DIRECTIONS),
});

const surfaceTransparencyPreferenceBase = objectOf({
  decidedAt: optional(nonEmptyString),
  decisionSource: optional(enumOf(AUTHORIZATION_SOURCES)),
  noticeLocation: optional(nonEmptyString),
  noticeText: optional(nonEmptyString),
  preference: enumOf(SURFACE_TRANSPARENCY_PREFERENCES),
});

const NOTICE_REQUIRED_PREFERENCES = new Set([
  "curation-notice",
  "correction-notice",
]);

const surfaceTransparencyPreference: Validator = (value, path, errors) => {
  surfaceTransparencyPreferenceBase(value, path, errors);
  if (!isPlainObject(value) || typeof value.preference !== "string") {
    return;
  }
  const requiresNotice = NOTICE_REQUIRED_PREFERENCES.has(value.preference);
  const hasNoticeText = Object.hasOwn(value, "noticeText");
  const hasNoticeLocation = Object.hasOwn(value, "noticeLocation");
  if (requiresNotice) {
    if (!hasNoticeText) {
      errors.push(
        `${childPath(path, "noticeText")} is required when preference is ${value.preference}`
      );
    }
    if (!hasNoticeLocation) {
      errors.push(
        `${childPath(path, "noticeLocation")} is required when preference is ${value.preference}`
      );
    }
  } else {
    if (hasNoticeText) {
      errors.push(
        `${childPath(path, "noticeText")} is not allowed when preference is ${value.preference}`
      );
    }
    if (hasNoticeLocation) {
      errors.push(
        `${childPath(path, "noticeLocation")} is not allowed when preference is ${value.preference}`
      );
    }
  }
};

const deployedSurfaceImpactBase = objectOf({
  acknowledged: booleanValue,
  acknowledgedAt: optional(nonEmptyString),
  acknowledgmentSource: optional(enumOf(AUTHORIZATION_SOURCES)),
  changeKinds: arrayOf(enumOf(DEPLOYED_SURFACE_CHANGE_KINDS), {
    uniqueStrings: true,
  }),
  evidence: arrayOf(anyString),
  previouslyVisibleScope: optional(curationScope),
  state: enumOf(DEPLOYED_SURFACE_STATES),
});

const deployedSurfaceImpact: Validator = (value, path, errors) => {
  deployedSurfaceImpactBase(value, path, errors);
  if (!isPlainObject(value)) {
    return;
  }
  const changesPreviouslyVisibleScope =
    value.state === "deployed" &&
    Object.hasOwn(value, "previouslyVisibleScope") &&
    Array.isArray(value.changeKinds) &&
    value.changeKinds.length > 0;
  if (changesPreviouslyVisibleScope && value.acknowledged !== true) {
    errors.push(
      `${childPath(path, "acknowledged")} must be true when a deployed operation changes a previously visible scope`
    );
  }
};

const linkedSourceRewrite = objectOf({
  authorizationCode: literal("RELEASED_HISTORY_REWRITE"),
  changedPaths: arrayOf(repoRelativePath, {
    minItems: 1,
    uniqueStrings: true,
  }),
  changeKinds: arrayOf(enumOf(SOURCE_REWRITE_CHANGE_KINDS), {
    minItems: 1,
    uniqueStrings: true,
  }),
  sourceFingerprintAfter: nonEmptyString,
  sourceFingerprintBefore: nonEmptyString,
});

const linkedSurfaceCopyRevision = objectOf({
  authorizationCode: literal("RELEASE_NOTE_COPY_REVISION"),
  changedItemIds: arrayOf(nonEmptyString, {
    minItems: 1,
    uniqueStrings: true,
  }),
  surfaceFingerprintAfter: nonEmptyString,
  surfaceFingerprintBefore: nonEmptyString,
});

const curationOperationBase = objectOf({
  completedAt: optional(nonEmptyString),
  counts: optional(curationCounts),
  deployedImpact: deployedSurfaceImpact,
  direction: enumOf(CURATION_OPERATION_DIRECTIONS),
  effectiveScope: curationScope,
  eligibleItemSetFingerprintAfter: optional(nonEmptyString),
  eligibleItemSetFingerprintBefore: nonEmptyString,
  failureDiagnostic: optional(nonEmptyString),
  linkedSourceRewrite: optional(linkedSourceRewrite),
  linkedSurfaceCopyRevision: optional(linkedSurfaceCopyRevision),
  newestCovered: optional(sourceBoundary),
  oldestCovered: optional(sourceBoundary),
  operationId: nonEmptyString,
  overlap: enumOf(CURATION_OPERATION_OVERLAPS),
  requestedScope: curationScope,
  resumeAfter: optional(sourceBoundary),
  revisitsOperationIds: stringArray,
  runtimeIdentity: optional(nonEmptyString),
  sourceFingerprint: nonEmptyString,
  sourceRevision: optional(nonEmptyString),
  startedAt: optional(nonEmptyString),
  status: enumOf(CURATION_OPERATION_STATUSES),
  supersededBy: optional(nonEmptyString),
  surfaceFingerprintAfter: optional(nonEmptyString),
  surfaceFingerprintBefore: nonEmptyString,
});

/** Change kinds that always require a linked canonical-history rewrite. */
const SOURCE_REWRITE_REQUIRED_KINDS = new Set([
  "canonical-version",
  "date",
  "release-boundary",
  "visibility",
]);

/**
 * Completed-status invariants: after-fingerprints and counts must be
 * present, and the eligible-item-set must be conserved (same fingerprint,
 * same count) across a successful curation pass.
 */
const checkCompletedOperation = (
  value: JsonRecord,
  path: string,
  errors: string[]
): void => {
  const hasAfterEligible = Object.hasOwn(
    value,
    "eligibleItemSetFingerprintAfter"
  );
  const hasSurfaceAfter = Object.hasOwn(value, "surfaceFingerprintAfter");
  const hasCounts = Object.hasOwn(value, "counts");
  if (!hasAfterEligible) {
    errors.push(
      `${childPath(path, "eligibleItemSetFingerprintAfter")} is required when status is completed`
    );
  }
  if (!hasSurfaceAfter) {
    errors.push(
      `${childPath(path, "surfaceFingerprintAfter")} is required when status is completed`
    );
  }
  if (!hasCounts) {
    errors.push(
      `${childPath(path, "counts")} is required when status is completed`
    );
  }
  if (
    hasAfterEligible &&
    typeof value.eligibleItemSetFingerprintBefore === "string" &&
    typeof value.eligibleItemSetFingerprintAfter === "string" &&
    value.eligibleItemSetFingerprintBefore !==
      value.eligibleItemSetFingerprintAfter
  ) {
    errors.push(
      `${childPath(path, "eligibleItemSetFingerprintAfter")} must equal eligibleItemSetFingerprintBefore when status is completed`
    );
  }
  if (hasCounts && isPlainObject(value.counts)) {
    const { eligibleBefore, eligibleAfter } = value.counts;
    if (
      typeof eligibleBefore === "number" &&
      typeof eligibleAfter === "number" &&
      eligibleBefore !== eligibleAfter
    ) {
      errors.push(
        `${childPath(path, "counts")}.eligibleAfter must equal eligibleBefore when status is completed`
      );
    }
  }
};

const REQUIRED_FIELD_BY_STATUS: Record<string, string> = {
  failed: "failureDiagnostic",
  partial: "resumeAfter",
  superseded: "supersededBy",
};

const curationOperation: Validator = (value, path, errors) => {
  curationOperationBase(value, path, errors);
  if (!isPlainObject(value) || typeof value.status !== "string") {
    return;
  }

  if (value.status === "completed") {
    checkCompletedOperation(value, path, errors);
    return;
  }

  const requiredField = REQUIRED_FIELD_BY_STATUS[value.status];
  if (requiredField && !Object.hasOwn(value, requiredField)) {
    errors.push(
      `${childPath(path, requiredField)} is required when status is ${value.status}`
    );
  }
};

const curationSurfaceBase = objectOf({
  activeScopes: arrayOf(activeCurationScope),
  audience: enumOf(CURATION_SURFACE_AUDIENCES),
  displayPreferences: surfaceDisplayPreferences,
  fallback: literal("source-order"),
  mode: enumOf(CURATION_SURFACE_MODES),
  operations: arrayOf(curationOperation),
  sourcePaths: arrayOf(repoRelativePath, {
    minItems: 1,
    uniqueStrings: true,
  }),
  surfaceId: nonEmptyString,
  surfacePaths: arrayOf(repoRelativePath, {
    minItems: 1,
    uniqueStrings: true,
  }),
  transparencyPreference: surfaceTransparencyPreference,
});

const requiresLinkedRewrite = (
  operation: JsonRecord,
  surfaceMode: unknown
): string | undefined => {
  const impact = operation.deployedImpact;
  if (!(isPlainObject(impact) && Array.isArray(impact.changeKinds))) {
    return;
  }
  const changeKinds = impact.changeKinds as unknown[];
  const hasSourceRewrite = Object.hasOwn(operation, "linkedSourceRewrite");
  const hasCopyRevision = Object.hasOwn(operation, "linkedSurfaceCopyRevision");

  const requiresStrictRewrite = changeKinds.some(
    (kind) =>
      typeof kind === "string" && SOURCE_REWRITE_REQUIRED_KINDS.has(kind)
  );
  if (requiresStrictRewrite && !hasSourceRewrite) {
    return "linkedSourceRewrite is required when deployedImpact.changeKinds includes canonical-version, date, release-boundary, or visibility";
  }

  if (changeKinds.includes("content")) {
    if (surfaceMode === "selected-summary") {
      if (!(hasSourceRewrite || hasCopyRevision)) {
        return "linkedSourceRewrite or linkedSurfaceCopyRevision is required when deployedImpact.changeKinds includes content";
      }
    } else if (!hasSourceRewrite) {
      return "linkedSourceRewrite is required when deployedImpact.changeKinds includes content";
    }
  }
};

/**
 * Cross-field invariants for a single surface that JSON Schema cannot
 * express: temporal-marker rules keyed off sibling fields, and reference
 * checks and uniqueness constraints that span the surface's own operation
 * and active-scope arrays.
 */
const curationSurface: Validator = (value, path, errors) => {
  curationSurfaceBase(value, path, errors);
  if (!isPlainObject(value)) {
    return;
  }

  if (
    value.mode === "full-history" &&
    isPlainObject(value.displayPreferences) &&
    value.displayPreferences.dateDisplay === "hidden" &&
    value.displayPreferences.versionDisplay === "hidden"
  ) {
    errors.push(
      `${childPath(path, "displayPreferences")} cannot hide both dateDisplay and versionDisplay when mode is full-history`
    );
  }

  const operations = Array.isArray(value.operations) ? value.operations : [];
  const allOperationIds = new Set<string>();
  const completedOperationIds = new Set<string>();
  for (const operation of operations) {
    if (isPlainObject(operation) && typeof operation.operationId === "string") {
      allOperationIds.add(operation.operationId);
      if (operation.status === "completed") {
        completedOperationIds.add(operation.operationId);
      }
    }
  }

  const seenOperationIds = new Set<string>();
  operations.forEach((operation: unknown, index: number) => {
    const operationPath = indexPath(childPath(path, "operations"), index);
    if (!isPlainObject(operation)) {
      return;
    }
    if (typeof operation.operationId === "string") {
      if (seenOperationIds.has(operation.operationId)) {
        errors.push(
          `${operationPath}.operationId duplicates an earlier operationId`
        );
      }
      seenOperationIds.add(operation.operationId);
    }
    if (
      typeof operation.supersededBy === "string" &&
      !allOperationIds.has(operation.supersededBy)
    ) {
      errors.push(
        `${childPath(operationPath, "supersededBy")} must reference an existing operationId`
      );
    }
    if (Array.isArray(operation.revisitsOperationIds)) {
      operation.revisitsOperationIds.forEach(
        (id: unknown, revisitIndex: number) => {
          if (typeof id === "string" && !allOperationIds.has(id)) {
            errors.push(
              `${indexPath(childPath(operationPath, "revisitsOperationIds"), revisitIndex)} must reference an existing operationId`
            );
          }
        }
      );
    }
    const linkedRewriteError = requiresLinkedRewrite(operation, value.mode);
    if (linkedRewriteError) {
      errors.push(`${operationPath}: ${linkedRewriteError}`);
    }
  });

  const activeScopes = Array.isArray(value.activeScopes)
    ? value.activeScopes
    : [];
  const seenSurfaceScopeIds = new Set<string>();
  activeScopes.forEach((scope: unknown, scopeIndex: number) => {
    const scopePath = indexPath(childPath(path, "activeScopes"), scopeIndex);
    if (!isPlainObject(scope)) {
      return;
    }
    if (typeof scope.scopeId === "string") {
      if (seenSurfaceScopeIds.has(scope.scopeId)) {
        errors.push(`${scopePath}.scopeId duplicates an earlier scopeId`);
      }
      seenSurfaceScopeIds.add(scope.scopeId);
    }
    if (
      typeof scope.activatedByOperationId === "string" &&
      !completedOperationIds.has(scope.activatedByOperationId)
    ) {
      errors.push(
        `${childPath(scopePath, "activatedByOperationId")} must reference a completed operation`
      );
    }

    const groups = Array.isArray(scope.groups) ? scope.groups : [];
    const groupIds = new Set<string>();
    const itemIds = new Set<string>();
    groups.forEach((group: unknown, groupIndex: number) => {
      const groupPath = indexPath(childPath(scopePath, "groups"), groupIndex);
      if (!isPlainObject(group)) {
        return;
      }
      if (typeof group.groupId === "string") {
        if (groupIds.has(group.groupId)) {
          errors.push(
            `${childPath(groupPath, "groupId")} duplicates another group in this scope`
          );
        }
        groupIds.add(group.groupId);
      }
      if (Array.isArray(group.itemIds)) {
        group.itemIds.forEach((itemId: unknown, itemIndex: number) => {
          if (typeof itemId !== "string") {
            return;
          }
          if (itemIds.has(itemId)) {
            errors.push(
              `${indexPath(childPath(groupPath, "itemIds"), itemIndex)} duplicates an item already active in another group within this scope`
            );
          }
          itemIds.add(itemId);
        });
      }
    });
  });
};

const curationManifestBase = objectOf({
  schemaVersion: literal(CURATION_MANIFEST_VERSION),
  surfaces: arrayOf(curationSurface),
});

const curationManifest: Validator = (value, path, errors) => {
  curationManifestBase(value, path, errors);
  if (!(isPlainObject(value) && Array.isArray(value.surfaces))) {
    return;
  }
  const seenSurfaceIds = new Set<string>();
  value.surfaces.forEach((surface: unknown, index: number) => {
    if (!isPlainObject(surface) || typeof surface.surfaceId !== "string") {
      return;
    }
    const surfacePath = indexPath(childPath(path, "surfaces"), index);
    if (seenSurfaceIds.has(surface.surfaceId)) {
      errors.push(
        `${childPath(surfacePath, "surfaceId")} duplicates an earlier surfaceId`
      );
    }
    seenSurfaceIds.add(surface.surfaceId);
  });
};

type NormalizationResult =
  | { ok: true; value: unknown }
  | { errors: string[]; ok: false };

const symbolPath = (path: string, key: symbol): string =>
  `${path}[${JSON.stringify(`symbol:${key.description ?? ""}`)}]`;

const isPortableArrayIndex = (key: string, length: number): boolean => {
  const index = Number(key);
  return ARRAY_INDEX.test(key) && Number.isSafeInteger(index) && index < length;
};

const inspectPortableValue = (
  value: unknown,
  path: string,
  errors: string[],
  ancestors: WeakSet<object>
): void => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      errors.push(`${path} must be a finite JSON number`);
    }
    return;
  }
  if (typeof value !== "object") {
    errors.push(`${path} must be a portable JSON value`);
    return;
  }
  if (utilTypes.isProxy(value)) {
    errors.push(`${path} must not be a Proxy`);
    return;
  }
  if (ancestors.has(value)) {
    errors.push(`${path} must not contain a circular reference`);
    return;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    const isArray = Array.isArray(value);
    if (
      (isArray && prototype !== Array.prototype) ||
      (!isArray && prototype !== Object.prototype && prototype !== null)
    ) {
      errors.push(`${path} must have a portable prototype`);
      return;
    }

    ancestors.add(value);
    inspectPortableProperties(value, path, errors, ancestors, isArray);
    ancestors.delete(value);
  } catch {
    ancestors.delete(value);
    errors.push(`${path} could not be inspected safely`);
  }
};

const inspectPortableProperties = (
  value: object,
  path: string,
  errors: string[],
  ancestors: WeakSet<object>,
  isArray: boolean
): void => {
  let arrayItemCount = 0;
  for (const key of Reflect.ownKeys(value)) {
    if (isArray && key === "length") {
      continue;
    }
    if (typeof key === "symbol") {
      errors.push(`${symbolPath(path, key)} is not allowed`);
      continue;
    }

    const propertyPath = childPath(path, key);
    if (isArray) {
      if (!isPortableArrayIndex(key, (value as unknown[]).length)) {
        errors.push(`${propertyPath} is not a portable array index`);
        continue;
      }
      arrayItemCount += 1;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) {
      errors.push(`${propertyPath} could not be inspected safely`);
      continue;
    }
    if (!descriptor.enumerable) {
      errors.push(`${propertyPath} must be enumerable`);
      continue;
    }
    if (!("value" in descriptor)) {
      errors.push(`${propertyPath} must be a data property`);
      continue;
    }
    inspectPortableValue(descriptor.value, propertyPath, errors, ancestors);
  }

  if (isArray && arrayItemCount !== (value as unknown[]).length) {
    errors.push(`${path} must not be a sparse array`);
  }
};

const normalizePortableInput = (value: unknown): NormalizationResult => {
  const errors: string[] = [];
  try {
    inspectPortableValue(value, "$", errors, new WeakSet<object>());
    if (errors.length > 0) {
      return { errors, ok: false };
    }
    return { ok: true, value: structuredClone(value) };
  } catch {
    return { errors: ["$ could not be inspected or cloned safely"], ok: false };
  }
};

const validateWith = <T>(
  value: unknown,
  validate: Validator
): ValidationResult<T> => {
  const normalized = normalizePortableInput(value);
  if (!normalized.ok) {
    return normalized;
  }

  const errors: string[] = [];
  try {
    validate(normalized.value, "$", errors);
    return errors.length > 0
      ? { errors, ok: false }
      : { ok: true, value: normalized.value as T };
  } catch {
    return { errors: ["$ could not be validated safely"], ok: false };
  }
};

export const validateRepoPolicy = (
  value: unknown
): ValidationResult<RepoPolicy> => validateWith(value, repoPolicy);

export const validateGlobalPreferences = (
  value: unknown
): ValidationResult<GlobalPreferences> =>
  validateWith(value, globalPreferences);

export const validateManifest = (
  value: unknown
): ValidationResult<EvalManifest> => validateWith(value, manifest);

export const validateRunnerRequest = (
  value: unknown
): ValidationResult<RunnerRequest> => validateWith(value, runnerRequest);

export const validateRunnerResponse = (
  value: unknown
): ValidationResult<RunnerResponse> => validateWith(value, runnerResponse);

export const validateCurationManifest = (
  value: unknown
): ValidationResult<CurationManifest> => validateWith(value, curationManifest);
