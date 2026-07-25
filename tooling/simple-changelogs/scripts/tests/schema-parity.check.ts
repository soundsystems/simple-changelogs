import { describe, expect, test } from "bun:test";
import { file } from "bun";
import {
  ACTIVATION_MODES,
  ASSERTION_KINDS,
  AUTHORIZATION_SOURCES,
  AUTHORIZATION_STATUSES,
  BACKFILL_STATUSES,
  CURATION_MANIFEST_VERSION,
  CURATION_OPERATION_DIRECTIONS,
  CURATION_OPERATION_OVERLAPS,
  CURATION_OPERATION_STATUSES,
  CURATION_SCOPE_KINDS,
  CURATION_SCOPE_MATURITIES,
  CURATION_STRATEGY_GROUPINGS,
  CURATION_STRATEGY_ORDERINGS,
  CURATION_SURFACE_AUDIENCES,
  CURATION_SURFACE_MODES,
  DEPLOYED_SURFACE_CHANGE_KINDS,
  DEPLOYED_SURFACE_STATES,
  DEVELOPER_CHANGELOG_POLICIES,
  DISTRIBUTIONS,
  EVAL_SUITES,
  MANIFEST_VERSION,
  PROTOCOL_VERSION,
  RUNNER_MESSAGE_ROLES,
  RUNNER_STATUSES,
  SETUP_COMMANDS,
  SETUP_SCOPES,
  SETUP_STATUSES,
  SETUP_STYLES,
  SIGNATURE_POLICIES,
  SOURCE_REWRITE_CHANGE_KINDS,
  SURFACE_CHRONOLOGICAL_ACCESS_MODES,
  SURFACE_DATE_DISPLAYS,
  SURFACE_DEFAULT_ORGANIZATIONS,
  SURFACE_DETAIL_DENSITIES,
  SURFACE_LAYOUTS,
  SURFACE_NAVIGATION_ITEMS,
  SURFACE_POLICIES,
  SURFACE_TRANSPARENCY_PREFERENCES,
  SURFACE_VERSION_DISPLAYS,
  SURFACE_VISUAL_DIRECTIONS,
  VERIFICATION_STATUSES,
  VERSION_ROLES,
} from "../lib/types.ts";
import {
  validateCurationManifest,
  validateGlobalPreferences,
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

const curationScopeKindsAt = (value: unknown): string[] => {
  const variants = valueAt(value, "$defs.curationScope.oneOf");
  if (!Array.isArray(variants)) {
    throw new Error("curationScope schema does not contain oneOf variants");
  }
  return variants.map((variant) => {
    const kind = valueAt(variant, "properties.kind");
    if (isRecord(kind) && typeof kind.const === "string") {
      return kind.const;
    }
    throw new Error("curationScope variant kind is not closed");
  });
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

const preferences = (setupStyle: string) => ({
  developerChangelog: "required",
  newReleaseNoteSurfaces: "ask",
  profile: "solo-developer",
  schemaVersion: 1,
  setupStyle,
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

const curationManifest = (status: string) => ({
  schemaVersion: 1,
  surfaces: [
    {
      activeScopes: [],
      audience: "public",
      displayPreferences: {
        chronologicalAccess: "curated-with-toggle",
        dateDisplay: "month-year",
        defaultOrganization: "product-area",
        detailDensity: "balanced",
        layout: "grouped-sections",
        navigation: ["anchors"],
        versionDisplay: "friendly",
        visualDirection: "editorial-minimal",
      },
      fallback: "source-order",
      mode: "selected-summary",
      operations: [
        {
          counts: {
            eligibleAfter: 4,
            eligibleBefore: 4,
            groupsAfter: 1,
            groupsBefore: 1,
            mapped: 4,
            moved: 2,
          },
          deployedImpact: {
            acknowledged: false,
            changeKinds: [],
            evidence: [],
            state: "unpublished",
          },
          direction: "canonical-forward",
          effectiveScope: { kind: "full-history" },
          eligibleItemSetFingerprintAfter: "sha256:eligible",
          eligibleItemSetFingerprintBefore: "sha256:eligible",
          operationId: "op-1",
          overlap: "none",
          requestedScope: { kind: "full-history" },
          revisitsOperationIds: [],
          sourceFingerprint: "sha256:source",
          status,
          surfaceFingerprintAfter: "sha256:surface-after",
          surfaceFingerprintBefore: "sha256:surface-before",
        },
      ],
      sourcePaths: ["CHANGELOG.md"],
      surfaceId: "surface-1",
      surfacePaths: ["RELEASES.md"],
      transparencyPreference: { preference: "none" },
    },
  ],
});

const [
  policySchema,
  preferencesSchema,
  setupResultSchema,
  manifestSchema,
  requestSchema,
  responseSchema,
  curationManifestSchema,
] = await Promise.all([
  loadSchema("repo-policy"),
  loadSchema("global-preferences"),
  loadSchema("setup-result"),
  loadSchema("eval-manifest"),
  loadSchema("runner-request"),
  loadSchema("runner-response"),
  loadSchema("curation-manifest"),
]);

describe("schema parity", () => {
  test("keeps versions and enums aligned with runtime validators", () => {
    const versions: [unknown, string, number][] = [
      [policySchema, "properties.schemaVersion.const", 1],
      [preferencesSchema, "properties.schemaVersion.const", 1],
      [setupResultSchema, "properties.schemaVersion.const", 1],
      [manifestSchema, "properties.manifestVersion.const", MANIFEST_VERSION],
      [requestSchema, "properties.protocolVersion.const", PROTOCOL_VERSION],
      [responseSchema, "properties.protocolVersion.const", PROTOCOL_VERSION],
      [
        curationManifestSchema,
        "properties.schemaVersion.const",
        CURATION_MANIFEST_VERSION,
      ],
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
        policySchema,
        "properties.developerChangelog.enum",
        DEVELOPER_CHANGELOG_POLICIES,
      ],
      [policySchema, "properties.distribution.enum", DISTRIBUTIONS],
      [policySchema, "properties.signatures.enum", SIGNATURE_POLICIES],
      [preferencesSchema, "properties.setupStyle.enum", SETUP_STYLES],
      [setupResultSchema, "properties.command.enum", SETUP_COMMANDS],
      [setupResultSchema, "properties.status.enum", SETUP_STATUSES],
      [
        setupResultSchema,
        "$defs.selection.properties.scope.enum",
        SETUP_SCOPES,
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
      [
        curationManifestSchema,
        "$defs.curationOperation.properties.status.enum",
        CURATION_OPERATION_STATUSES,
      ],
      [
        curationManifestSchema,
        "$defs.curationOperation.properties.direction.enum",
        CURATION_OPERATION_DIRECTIONS,
      ],
      [
        curationManifestSchema,
        "$defs.curationOperation.properties.overlap.enum",
        CURATION_OPERATION_OVERLAPS,
      ],
      [
        curationManifestSchema,
        "$defs.activeCurationScope.properties.maturity.enum",
        CURATION_SCOPE_MATURITIES,
      ],
      [
        curationManifestSchema,
        "$defs.curationStrategy.properties.grouping.enum",
        CURATION_STRATEGY_GROUPINGS,
      ],
      [
        curationManifestSchema,
        "$defs.curationStrategy.properties.ordering.enum",
        CURATION_STRATEGY_ORDERINGS,
      ],
      [
        curationManifestSchema,
        "$defs.curationStrategy.properties.withinGroup.enum",
        CURATION_STRATEGY_ORDERINGS,
      ],
      [
        curationManifestSchema,
        "$defs.surfaceDisplayPreferences.properties.defaultOrganization.enum",
        SURFACE_DEFAULT_ORGANIZATIONS,
      ],
      [
        curationManifestSchema,
        "$defs.surfaceDisplayPreferences.properties.layout.enum",
        SURFACE_LAYOUTS,
      ],
      [
        curationManifestSchema,
        "$defs.surfaceDisplayPreferences.properties.visualDirection.enum",
        SURFACE_VISUAL_DIRECTIONS,
      ],
      [
        curationManifestSchema,
        "$defs.surfaceDisplayPreferences.properties.dateDisplay.enum",
        SURFACE_DATE_DISPLAYS,
      ],
      [
        curationManifestSchema,
        "$defs.surfaceDisplayPreferences.properties.versionDisplay.enum",
        SURFACE_VERSION_DISPLAYS,
      ],
      [
        curationManifestSchema,
        "$defs.surfaceDisplayPreferences.properties.detailDensity.enum",
        SURFACE_DETAIL_DENSITIES,
      ],
      [
        curationManifestSchema,
        "$defs.surfaceDisplayPreferences.properties.chronologicalAccess.enum",
        SURFACE_CHRONOLOGICAL_ACCESS_MODES,
      ],
      [
        curationManifestSchema,
        "$defs.surfaceDisplayPreferences.properties.navigation.items.enum",
        SURFACE_NAVIGATION_ITEMS,
      ],
      [
        curationManifestSchema,
        "$defs.surfaceTransparencyPreference.properties.preference.enum",
        SURFACE_TRANSPARENCY_PREFERENCES,
      ],
      [
        curationManifestSchema,
        "$defs.deployedSurfaceImpact.properties.state.enum",
        DEPLOYED_SURFACE_STATES,
      ],
      [
        curationManifestSchema,
        "$defs.deployedSurfaceImpact.properties.changeKinds.items.enum",
        DEPLOYED_SURFACE_CHANGE_KINDS,
      ],
      [
        curationManifestSchema,
        "$defs.linkedSourceRewrite.properties.changeKinds.items.enum",
        SOURCE_REWRITE_CHANGE_KINDS,
      ],
      [
        curationManifestSchema,
        "$defs.curationSurface.properties.audience.enum",
        CURATION_SURFACE_AUDIENCES,
      ],
      [
        curationManifestSchema,
        "$defs.curationSurface.properties.mode.enum",
        CURATION_SURFACE_MODES,
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
    expect(
      curationScopeKindsAt(curationManifestSchema).sort(compareText)
    ).toEqual([...CURATION_SCOPE_KINDS].sort(compareText));
  });

  test("keeps validator versions and enum boundaries aligned", () => {
    expect(validateRepoPolicy(policy("completed", "ask")).ok).toBe(true);
    expect(validateGlobalPreferences(preferences("recommended")).ok).toBe(true);
    expect(
      validateManifest({
        cases: [evalCase("explicit", "behavior")],
        manifestVersion: MANIFEST_VERSION,
      }).ok
    ).toBe(true);
    expect(validateRunnerRequest(request("explicit")).ok).toBe(true);
    expect(validateRunnerResponse(response("completed")).ok).toBe(true);
    expect(validateCurationManifest(curationManifest("completed")).ok).toBe(
      true
    );

    expect(validateRepoPolicy(policy(OUTSIDE_ENUM, "ask")).ok).toBe(false);
    expect(validateGlobalPreferences(preferences(OUTSIDE_ENUM)).ok).toBe(false);
    expect(
      validateManifest({
        cases: [evalCase(OUTSIDE_ENUM, "behavior")],
        manifestVersion: 1,
      }).ok
    ).toBe(false);
    expect(validateRunnerRequest(request(OUTSIDE_ENUM)).ok).toBe(false);
    expect(validateRunnerResponse(response(OUTSIDE_ENUM)).ok).toBe(false);
    expect(validateCurationManifest(curationManifest(OUTSIDE_ENUM)).ok).toBe(
      false
    );

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
    expect(
      validateCurationManifest({
        ...curationManifest("completed"),
        schemaVersion: 2,
      }).ok
    ).toBe(false);
  });

  test("keeps every fixed schema object and validator input closed", () => {
    for (const schema of [
      policySchema,
      preferencesSchema,
      setupResultSchema,
      manifestSchema,
      requestSchema,
      responseSchema,
      curationManifestSchema,
    ]) {
      expect(findOpenFixedObjects(schema)).toEqual([]);
    }

    expect(
      validateRepoPolicy({ ...policy("completed", "ask"), extra: true }).ok
    ).toBe(false);
    expect(
      validateGlobalPreferences({
        ...preferences("recommended"),
        distribution: "web",
      }).ok
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
    expect(
      validateCurationManifest({
        ...curationManifest("completed"),
        extra: true,
      }).ok
    ).toBe(false);
  });
});
