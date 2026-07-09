import {
  type EvalManifest,
  MANIFEST_VERSION,
  PROTOCOL_VERSION,
  type RepoPolicy,
  type RunnerRequest,
  type RunnerResponse,
  type ValidationResult,
} from "./types.ts";

type JsonRecord = Record<string, unknown>;
type Validator = (value: unknown, path: string, errors: string[]) => void;
type Rule = Validator | { optional: true; validate: Validator };
type Shape = Record<string, Rule>;

const UPPERCASE_CODE = /^[A-Z][A-Z0-9_]*$/;
const JSON_PATH_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

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

const assertion = objectOf({
  expected: jsonValue,
  kind: nonEmptyString,
  target: optional(nonEmptyString),
});

const turn = objectOf({
  assertions: arrayOf(assertion, { minItems: 1 }),
  prompt: nonEmptyString,
});

const evalCase = objectOf({
  activationMode: enumOf(["discover", "explicit"]),
  fixture: nonEmptyString,
  id: nonEmptyString,
  skip: optional(nonEmptyString),
  suite: enumOf(["trigger", "behavior"]),
  tags: stringArray,
  turns: arrayOf(turn, { minItems: 1 }),
});

const repoPolicy = objectOf({
  developerChangelog: literal("required"),
  guidance: objectOf({
    backfillStatus: enumOf([
      "not-applicable",
      "completed",
      "declined",
      "deferred",
      "partial",
      "failed",
    ]),
    version: integer(1),
  }),
  newReleaseNoteSurfaces: enumOf(["ask", "allow", "existing-only"]),
  schemaVersion: literal(1),
  signatures: literal("agent-and-timestamp"),
});

const manifest = objectOf({
  cases: arrayOf(evalCase, { minItems: 1 }),
  manifestVersion: literal(MANIFEST_VERSION),
});

const runnerMessage = objectOf({
  content: anyString,
  role: enumOf(["user", "assistant"]),
});

const runnerRequest = objectOf({
  activationMode: enumOf(["discover", "explicit"]),
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
  source: enumOf([
    "current-request",
    "repository-policy",
    "repository-instructions",
    "user-response",
    "none",
  ]),
  status: enumOf(["granted", "denied", "required", "not-applicable"]),
});

const versionMapRecord = objectOf({
  path: nonEmptyString,
  role: enumOf(["source", "mirror", "package", "application", "store"]),
  version: nonEmptyString,
});

const verificationResult = objectOf({
  code: uppercaseCode,
  detail: optional(anyString),
  status: enumOf(["passed", "failed", "not-run"]),
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
  status: enumOf(["completed", "skipped", "error"]),
});

const validateWith = <T>(
  value: unknown,
  validate: Validator
): ValidationResult<T> => {
  const errors: string[] = [];
  validate(value, "$", errors);
  return errors.length > 0
    ? { errors, ok: false }
    : { ok: true, value: structuredClone(value) as T };
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
