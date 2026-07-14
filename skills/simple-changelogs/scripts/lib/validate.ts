import { types as utilTypes } from "node:util";
import {
  ACTIVATION_MODES,
  ASSERTION_KINDS,
  type AssertionKind,
  AUTHORIZATION_SOURCES,
  AUTHORIZATION_STATUSES,
  BACKFILL_STATUSES,
  DEVELOPER_CHANGELOG_POLICIES,
  EVAL_SUITES,
  type EvalManifest,
  MANIFEST_VERSION,
  PROTOCOL_VERSION,
  type RepoPolicy,
  RUNNER_MESSAGE_ROLES,
  RUNNER_STATUSES,
  type RunnerRequest,
  type RunnerResponse,
  SIGNATURE_POLICIES,
  SURFACE_POLICIES,
  type ValidationResult,
  VERIFICATION_STATUSES,
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
    path: nonEmptyString,
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

const repoPolicy = objectOf({
  developerChangelog: enumOf(DEVELOPER_CHANGELOG_POLICIES),
  guidance: objectOf({
    backfillStatus: enumOf(BACKFILL_STATUSES),
    version: integer(1),
  }),
  newReleaseNoteSurfaces: enumOf(SURFACE_POLICIES),
  schemaVersion: literal(1),
  signatures: enumOf(SIGNATURE_POLICIES),
});

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
  path: nonEmptyString,
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

const evaluationReport = objectOf({
  authorizationRecords: arrayOf(authorizationRecord),
  decisionCodes: codeArray,
  nativeActivationEvidence: optional(nativeActivationEvidence),
  reasonCodes: codeArray,
  verificationResults: arrayOf(verificationResult),
  versionMap: arrayOf(versionMapRecord),
});

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

export const validateManifest = (
  value: unknown
): ValidationResult<EvalManifest> => validateWith(value, manifest);

export const validateRunnerRequest = (
  value: unknown
): ValidationResult<RunnerRequest> => validateWith(value, runnerRequest);

export const validateRunnerResponse = (
  value: unknown
): ValidationResult<RunnerResponse> => validateWith(value, runnerResponse);
