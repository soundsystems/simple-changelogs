import { describe, expect, test } from "bun:test";
import { file } from "bun";
import {
  ACTIVATION_MODES,
  ASSERTION_KINDS,
  AUTHORIZATION_SOURCES,
  AUTHORIZATION_STATUSES,
  BACKFILL_STATUSES,
  EVAL_SUITES,
  MANIFEST_VERSION,
  PROTOCOL_VERSION,
  RUNNER_MESSAGE_ROLES,
  RUNNER_STATUSES,
  SURFACE_POLICIES,
  VERIFICATION_STATUSES,
  VERSION_ROLES,
} from "../lib/types.ts";
import {
  validateManifest,
  validateRepoPolicy,
  validateRunnerRequest,
  validateRunnerResponse,
} from "../lib/validate.ts";

type JsonRecord = Record<string, unknown>;

const OUTSIDE_ENUM = "outside-contract";
const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};
const schemaUrl = (name: string): URL =>
  new URL(`../../evals/schemas/${name}.schema.json`, import.meta.url);

const loadSchema = async (name: string): Promise<unknown> =>
  file(schemaUrl(name)).json() as Promise<unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const valueAt = (value: unknown, path: string): unknown => {
  let current = value;
  for (const segment of path.split(".")) {
    if (!isRecord(current)) {
      throw new Error(`Schema path ${path} is not an object`);
    }
    current = current[segment];
  }
  return current;
};

const enumAt = (value: unknown, path: string): string[] => {
  const candidate = valueAt(value, path);
  if (
    !Array.isArray(candidate) ||
    candidate.some((item) => typeof item !== "string")
  ) {
    throw new Error(`Schema path ${path} is not a string enum`);
  }
  return candidate;
};

const assertionKindsAt = (value: unknown): string[] => {
  const variants = valueAt(value, "$defs.assertion.oneOf");
  if (!Array.isArray(variants)) {
    throw new Error("Assertion schema does not contain oneOf variants");
  }
  return variants.flatMap((variant) => {
    const kind = valueAt(variant, "properties.kind");
    if (!isRecord(kind)) {
      throw new Error("Assertion variant kind is not an object");
    }
    if (typeof kind.const === "string") {
      return [kind.const];
    }
    if (
      Array.isArray(kind.enum) &&
      kind.enum.every((item) => typeof item === "string")
    ) {
      return kind.enum as string[];
    }
    throw new Error("Assertion variant kind is not closed");
  });
};

const findOpenFixedObjects = (
  value: unknown,
  path = "$",
  findings: string[] = []
): string[] => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      findOpenFixedObjects(item, `${path}[${index}]`, findings);
    }
    return findings;
  }
  if (!isRecord(value)) {
    return findings;
  }
  if (
    value.type === "object" &&
    isRecord(value.properties) &&
    value.additionalProperties !== false
  ) {
    findings.push(path);
  }
  for (const [key, item] of Object.entries(value)) {
    findOpenFixedObjects(item, `${path}.${key}`, findings);
  }
  return findings;
};

const evalCase = (activationMode: string, suite: string) => ({
  activationMode,
  fixture: "dual-changelog",
  id: "schema-parity",
  suite,
  tags: ["contracts"],
  turns: [
    {
      assertions: [{ expected: "completed", kind: "report.status" }],
      prompt: "Check the portable contract.",
    },
  ],
});

const policy = (backfillStatus: string, surfacePolicy: string) => ({
  developerChangelog: "required",
  guidance: { backfillStatus, version: 2 },
  newReleaseNoteSurfaces: surfacePolicy,
  schemaVersion: 1,
  signatures: "agent-and-timestamp",
});

const request = (activationMode: string, role = "user") => ({
  activationMode,
  case: evalCase("explicit", "behavior"),
  prompt: "Check the portable contract.",
  protocolVersion: 1,
  responseSchema: "/tmp/runner-response.schema.json",
  skillDirectory: "/tmp/skill",
  timeoutMs: 30_000,
  transcript: [{ content: "Prior turn", role }],
  turnIndex: 0,
  workspace: "/tmp/workspace",
});

const response = (
  status: string,
  authorizationStatus = "granted",
  authorizationSource = "current-request",
  versionRole = "source",
  verificationStatus = "passed"
) => ({
  evaluationReport: {
    authorizationRecords: [
      {
        code: "EDIT_PENDING_CHANGELOG",
        source: authorizationSource,
        status: authorizationStatus,
      },
    ],
    decisionCodes: ["CHANGELOG_REQUIRED"],
    reasonCodes: ["USER_VISIBLE_CHANGE"],
    verificationResults: [
      { code: "CHANGELOG_FORMAT", status: verificationStatus },
    ],
    versionMap: [
      { path: "CHANGELOG.md", role: versionRole, version: "Unreleased" },
    ],
  },
  finalResponse: "Checked the portable contract.",
  protocolVersion: 1,
  status,
});

const [policySchema, manifestSchema, requestSchema, responseSchema] =
  await Promise.all([
    loadSchema("repo-policy"),
    loadSchema("eval-manifest"),
    loadSchema("runner-request"),
    loadSchema("runner-response"),
  ]);

describe("schema parity", () => {
  test("keeps versions and enums aligned with runtime validators", () => {
    const versions: [unknown, string, number][] = [
      [policySchema, "properties.schemaVersion.const", 1],
      [manifestSchema, "properties.manifestVersion.const", MANIFEST_VERSION],
      [requestSchema, "properties.protocolVersion.const", PROTOCOL_VERSION],
      [responseSchema, "properties.protocolVersion.const", PROTOCOL_VERSION],
    ];
    const enums: [unknown, string, readonly string[]][] = [
      [
        policySchema,
        "properties.guidance.properties.backfillStatus.enum",
        BACKFILL_STATUSES,
      ],
      [
        policySchema,
        "properties.newReleaseNoteSurfaces.enum",
        SURFACE_POLICIES,
      ],
      [
        manifestSchema,
        "$defs.evalCase.properties.activationMode.enum",
        ACTIVATION_MODES,
      ],
      [manifestSchema, "$defs.evalCase.properties.suite.enum", EVAL_SUITES],
      [requestSchema, "properties.activationMode.enum", ACTIVATION_MODES],
      [
        requestSchema,
        "$defs.message.properties.role.enum",
        RUNNER_MESSAGE_ROLES,
      ],
      [responseSchema, "properties.status.enum", RUNNER_STATUSES],
      [
        responseSchema,
        "$defs.authorizationRecord.properties.status.enum",
        AUTHORIZATION_STATUSES,
      ],
      [
        responseSchema,
        "$defs.authorizationRecord.properties.source.enum",
        AUTHORIZATION_SOURCES,
      ],
      [
        responseSchema,
        "$defs.versionMapRecord.properties.role.enum",
        VERSION_ROLES,
      ],
      [
        responseSchema,
        "$defs.verificationResult.properties.status.enum",
        VERIFICATION_STATUSES,
      ],
    ];

    for (const [schema, path, expected] of versions) {
      expect(valueAt(schema, path)).toBe(expected);
    }
    for (const [schema, path, expected] of enums) {
      expect(enumAt(schema, path)).toEqual([...expected]);
    }
    expect(assertionKindsAt(manifestSchema).sort(compareText)).toEqual(
      [...ASSERTION_KINDS].sort(compareText)
    );
  });

  test("keeps validator versions and enum boundaries aligned", () => {
    expect(validateRepoPolicy(policy("completed", "ask")).ok).toBe(true);
    expect(
      validateManifest({
        cases: [evalCase("explicit", "behavior")],
        manifestVersion: MANIFEST_VERSION,
      }).ok
    ).toBe(true);
    expect(validateRunnerRequest(request("explicit")).ok).toBe(true);
    expect(validateRunnerResponse(response("completed")).ok).toBe(true);

    expect(validateRepoPolicy(policy(OUTSIDE_ENUM, "ask")).ok).toBe(false);
    expect(
      validateManifest({
        cases: [evalCase(OUTSIDE_ENUM, "behavior")],
        manifestVersion: 1,
      }).ok
    ).toBe(false);
    expect(validateRunnerRequest(request(OUTSIDE_ENUM)).ok).toBe(false);
    expect(validateRunnerResponse(response(OUTSIDE_ENUM)).ok).toBe(false);

    expect(
      validateRepoPolicy({
        ...policy("completed", "ask"),
        schemaVersion: 2,
      }).ok
    ).toBe(false);
    expect(
      validateManifest({
        cases: [evalCase("explicit", "behavior")],
        manifestVersion: 2,
      }).ok
    ).toBe(false);
    expect(
      validateRunnerRequest({ ...request("explicit"), protocolVersion: 2 }).ok
    ).toBe(false);
    expect(
      validateRunnerResponse({
        ...response("completed"),
        protocolVersion: 2,
      }).ok
    ).toBe(false);
  });

  test("keeps every fixed schema object and validator input closed", () => {
    for (const schema of [
      policySchema,
      manifestSchema,
      requestSchema,
      responseSchema,
    ]) {
      expect(findOpenFixedObjects(schema)).toEqual([]);
    }

    expect(
      validateRepoPolicy({ ...policy("completed", "ask"), extra: true }).ok
    ).toBe(false);
    expect(
      validateManifest({
        cases: [evalCase("explicit", "behavior")],
        extra: true,
        manifestVersion: 1,
      }).ok
    ).toBe(false);
    expect(
      validateRunnerRequest({ ...request("explicit"), extra: true }).ok
    ).toBe(false);
    expect(
      validateRunnerResponse({ ...response("completed"), extra: true }).ok
    ).toBe(false);
  });
});
