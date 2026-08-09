import { describe, expect, test } from "bun:test";
import type {
  ActiveCurationScope,
  CurationManifest,
  CurationOperation,
  CurationScope,
  CurationSurface,
  EvalCase,
  EvalManifest,
  EvaluationReport,
  RunnerRequest,
  RunnerResponse,
} from "../lib/types.ts";
import {
  validateCurationManifest,
  validateManifest,
  validateRepoPolicy,
  validateRunnerRequest,
  validateRunnerResponse,
} from "../lib/validate.ts";

const behaviorCase: EvalCase = {
  activationMode: "explicit",
  fixture: "dual-changelog",
  id: "behavior-policy",
  suite: "behavior",
  tags: ["setup"],
  turns: [
    {
      assertions: [{ expected: "CHANGELOG_REQUIRED", kind: "report.decision" }],
      prompt: "Update the pending changelogs.",
    },
  ],
};

const evaluationReport: EvaluationReport = {
  authorizationRecords: [
    {
      code: "EDIT_PENDING_CHANGELOG",
      source: "current-request",
      status: "granted",
    },
  ],
  decisionCodes: ["CHANGELOG_REQUIRED"],
  nativeActivationEvidence: {
    activated: true,
    trace: ["simple-changelogs"],
  },
  reasonCodes: ["USER_VISIBLE_CHANGE"],
  verificationResults: [{ code: "CHANGELOG_FORMAT", status: "passed" }],
  versionMap: [{ path: "CHANGELOG.md", role: "source", version: "Unreleased" }],
};

const portableRepoPolicy = () => ({
  developerChangelog: "required",
  guidance: { backfillStatus: "completed", version: 2 },
  newReleaseNoteSurfaces: "ask",
  schemaVersion: 1,
  signatures: "agent-and-timestamp",
});

describe("repo policy", () => {
  test("accepts the portable version-one policy", () => {
    const result = validateRepoPolicy({
      developerChangelog: "required",
      guidance: { backfillStatus: "completed", version: 2 },
      newReleaseNoteSurfaces: "ask",
      schemaVersion: 1,
      signatures: "agent-and-timestamp",
    });
    expect(result.ok).toBe(true);
  });

  test("rejects unknown status and preserves the original object", () => {
    const input = {
      guidance: { backfillStatus: "done", version: 2 },
      schemaVersion: 1,
    };
    const snapshot = structuredClone(input);
    const result = validateRepoPolicy(input);
    expect(result.ok).toBe(false);
    expect(input).toEqual(snapshot);
  });

  test("accepts every release-note environment scope", () => {
    for (const releaseNoteEnvironmentScope of [
      "all-environments",
      "non-production",
      "production-only",
      "disabled",
    ]) {
      expect(
        validateRepoPolicy({
          ...portableRepoPolicy(),
          releaseNoteEnvironmentScope,
        }).ok
      ).toBe(true);
    }
  });

  test("rejects unsupported and superseded environment fields", () => {
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        releaseNoteEnvironmentScope: "preview",
      }).ok
    ).toBe(false);
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        releaseNoteModalEnvironmentScope: "non-production",
      }).ok
    ).toBe(false);
  });

  test("accepts an optional developer changelog and disabled signatures", () => {
    const result = validateRepoPolicy({
      ...portableRepoPolicy(),
      developerChangelog: "optional",
      signatures: "none",
    });
    expect(result.ok).toBe(true);
  });

  test("accepts supported mobile release-note placement and rejects unknown placement", () => {
    for (const mobileReleaseNotePlacement of [
      "web-tabs",
      "web-page",
      "mobile-only",
    ]) {
      expect(
        validateRepoPolicy({
          ...portableRepoPolicy(),
          mobileReleaseNotePlacement,
        }).ok
      ).toBe(true);
    }
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        mobileReleaseNotePlacement: "same-page",
      }).ok
    ).toBe(false);
  });

  test("requires mobile placement for current full guidance while preserving older policies", () => {
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        guidance: { backfillStatus: "completed", version: 6 },
      }).ok
    ).toBe(false);
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        distribution: "full",
        guidance: { backfillStatus: "completed", version: 6 },
        mobileReleaseNotePlacement: "mobile-only",
      }).ok
    ).toBe(true);
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        distribution: "web",
        guidance: { backfillStatus: "completed", version: 6 },
      }).ok
    ).toBe(true);
  });

  test("accepts an explicit distribution and rejects an unknown one", () => {
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        distribution: "skill-repository",
      }).ok
    ).toBe(true);
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        distribution: "desktop",
      }).ok
    ).toBe(false);
  });

  test("rejects unsupported developer changelog and signature policies", () => {
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        developerChangelog: "forbidden",
      }).ok
    ).toBe(false);
    expect(
      validateRepoPolicy({
        ...portableRepoPolicy(),
        signatures: "human-form",
      }).ok
    ).toBe(false);
  });
});

describe("portable inputs", () => {
  test("rejects a non-enumerable required property", () => {
    const input = {
      developerChangelog: "required",
      guidance: { backfillStatus: "completed", version: 2 },
      newReleaseNoteSurfaces: "ask",
      signatures: "agent-and-timestamp",
    };
    Object.defineProperty(input, "schemaVersion", { value: 1 });

    const result = validateRepoPolicy(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.startsWith("$.schemaVersion")).toBe(true);
    }
  });

  test("rejects a non-enumerable unknown property", () => {
    const input = portableRepoPolicy();
    Object.defineProperty(input, "hiddenState", { value: "not-portable" });

    const result = validateRepoPolicy(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.startsWith("$.hiddenState")).toBe(true);
    }
  });

  test("rejects accessors without invoking them", () => {
    const input = portableRepoPolicy();
    let reads = 0;
    Object.defineProperty(input, "schemaVersion", {
      configurable: true,
      enumerable: true,
      get: () => {
        reads += 1;
        return 1;
      },
    });

    const result = validateRepoPolicy(input);

    expect(result.ok).toBe(false);
    expect(reads).toBe(0);
  });

  test("rejects symbol keys and unsafe prototypes", () => {
    const withSymbol = portableRepoPolicy();
    Object.defineProperty(withSymbol, Symbol("hidden"), {
      enumerable: true,
      value: "not-portable",
    });
    const withPrototype = portableRepoPolicy();
    Object.setPrototypeOf(withPrototype, { inherited: true });

    expect(validateRepoPolicy(withSymbol).ok).toBe(false);
    expect(validateRepoPolicy(withPrototype).ok).toBe(false);
  });

  test("returns validation failures for proxies instead of throwing", () => {
    const transparent = new Proxy(portableRepoPolicy(), {});
    const throwing = new Proxy(portableRepoPolicy(), {
      ownKeys: () => {
        throw new Error("inspection failed");
      },
    });
    const descriptorThrowing = new Proxy(portableRepoPolicy(), {
      getOwnPropertyDescriptor: () => {
        throw new Error("descriptor inspection failed");
      },
    });
    let transparentResult: ReturnType<typeof validateRepoPolicy> | undefined;
    let throwingResult: ReturnType<typeof validateRepoPolicy> | undefined;
    let descriptorResult: ReturnType<typeof validateRepoPolicy> | undefined;

    expect(() => {
      transparentResult = validateRepoPolicy(transparent);
      throwingResult = validateRepoPolicy(throwing);
      descriptorResult = validateRepoPolicy(descriptorThrowing);
    }).not.toThrow();
    expect(transparentResult?.ok).toBe(false);
    expect(throwingResult?.ok).toBe(false);
    expect(descriptorResult?.ok).toBe(false);
  });
});

test("runner contracts reject incompatible protocol versions", () => {
  expect(validateRunnerRequest({ protocolVersion: 2 }).ok).toBe(false);
  expect(validateRunnerResponse({ protocolVersion: 2 }).ok).toBe(false);
});

describe("manifest", () => {
  test("accepts discover and explicit activation without vendor fields", () => {
    const input: EvalManifest = {
      cases: [
        {
          ...behaviorCase,
          activationMode: "discover",
          id: "trigger-discovery",
          suite: "trigger",
        },
        behaviorCase,
      ],
      manifestVersion: 1,
    };
    const result = validateManifest(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toBe(input);
      expect(result.value).toEqual(input);
    }
  });

  test("reports nested JSON paths and unknown keys", () => {
    const result = validateManifest({
      cases: [
        {
          ...behaviorCase,
          activationMode: "forced",
          runtimeVendor: "specific-runtime",
        },
      ],
      manifestVersion: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((error) =>
          error.startsWith("$.cases[0].activationMode")
        )
      ).toBe(true);
      expect(
        result.errors.some((error) =>
          error.startsWith("$.cases[0].runtimeVendor")
        )
      ).toBe(true);
    }
  });

  test("rejects unknown assertion kinds and kind-specific shape errors", () => {
    const invalidAssertions = [
      {
        expected: { argv: ["sh", "-c", "touch /tmp/escaped"], exitCode: 0 },
        kind: "command.exit",
      },
      { expected: true, kind: "file.changed" },
      { expected: true, kind: "report.status" },
      { expected: "lowercase", kind: "report.decision" },
      {
        expected: "completed",
        kind: "report.status",
        target: "CHANGELOG.md",
      },
    ];

    for (const assertion of invalidAssertions) {
      const result = validateManifest({
        cases: [
          {
            ...behaviorCase,
            turns: [{ assertions: [assertion], prompt: "Invalid assertion." }],
          },
        ],
        manifestVersion: 1,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some((error) =>
            error.startsWith("$.cases[0].turns[0].assertions[0]")
          )
        ).toBe(true);
      }
    }
  });
});

describe("runner request", () => {
  test("accepts the version-one portable request", () => {
    const input: RunnerRequest = {
      activationMode: "explicit",
      case: behaviorCase,
      prompt: "Update the pending changelogs.",
      protocolVersion: 1,
      responseSchema: "/tmp/runner-response.schema.json",
      skillDirectory: "/tmp/skill",
      timeoutMs: 30_000,
      turnIndex: 0,
      workspace: "/tmp/workspace",
    };

    expect(validateRunnerRequest(input)).toEqual({ ok: true, value: input });
  });

  test("rejects unknown keys without changing the request", () => {
    const input = {
      activationMode: "explicit",
      case: behaviorCase,
      command: "runtime-specific-command",
      prompt: "Update the pending changelogs.",
      protocolVersion: 1,
      responseSchema: "/tmp/runner-response.schema.json",
      skillDirectory: "/tmp/skill",
      timeoutMs: 30_000,
      turnIndex: -1,
      workspace: "/tmp/workspace",
    };
    const snapshot = structuredClone(input);
    const result = validateRunnerRequest(input);

    expect(result.ok).toBe(false);
    expect(input).toEqual(snapshot);
    if (!result.ok) {
      expect(
        result.errors.some((error) => error.startsWith("$.turnIndex"))
      ).toBe(true);
      expect(result.errors.some((error) => error.startsWith("$.command"))).toBe(
        true
      );
    }
  });
});

describe("runner response", () => {
  test("keeps evaluation data separate from normal final prose", () => {
    const input: RunnerResponse = {
      diagnostics: [{ code: "TRACE_CAPTURED", message: "Trace captured." }],
      evaluationReport,
      finalResponse: "Updated the pending changelogs.",
      protocolVersion: 1,
      runtimeIdentity: "Example Agent",
      status: "completed",
    };

    expect(validateRunnerResponse(input)).toEqual({ ok: true, value: input });
  });

  test("rejects lowercase codes and claimed mutation evidence", () => {
    const result = validateRunnerResponse({
      evaluationReport: {
        ...evaluationReport,
        changedFiles: ["CHANGELOG.md"],
        reasonCodes: ["user_visible_change"],
      },
      finalResponse: "Updated the pending changelogs.",
      protocolVersion: 1,
      status: "completed",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((error) =>
          error.startsWith("$.evaluationReport.reasonCodes[0]")
        )
      ).toBe(true);
      expect(
        result.errors.some((error) =>
          error.startsWith("$.evaluationReport.changedFiles")
        )
      ).toBe(true);
    }
  });

  test("rejects final prose nested inside the evaluation report", () => {
    const result = validateRunnerResponse({
      evaluationReport: {
        ...evaluationReport,
        finalResponse: "Duplicated prose.",
      },
      finalResponse: "Normal prose.",
      protocolVersion: 1,
      status: "completed",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors[0]?.startsWith("$.evaluationReport.finalResponse")
      ).toBe(true);
    }
  });
});

const releaseBoundary = (heading: string) => ({
  heading,
  occurrence: 1,
  sourcePath: "CHANGELOG.md",
});

const releaseScope = (heading: string): CurationScope => ({
  kind: "release",
  release: releaseBoundary(heading),
});

const omitUndefined = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;

const baseOperation = (
  overrides: Partial<CurationOperation> = {}
): CurationOperation => {
  const merged: Record<string, unknown> = {
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
    effectiveScope: releaseScope("1.2.0"),
    eligibleItemSetFingerprintAfter: "sha256:eligible-before",
    eligibleItemSetFingerprintBefore: "sha256:eligible-before",
    operationId: "op-1",
    overlap: "none",
    requestedScope: releaseScope("1.2.0"),
    revisitsOperationIds: [],
    sourceFingerprint: "sha256:source-fingerprint",
    status: "completed",
    surfaceFingerprintAfter: "sha256:surface-after",
    surfaceFingerprintBefore: "sha256:surface-before",
    ...overrides,
  };
  // Allow overrides to unset optional fields entirely: an explicit
  // `undefined` value, unlike a missing key, is not portable JSON.
  return omitUndefined(merged) as unknown as CurationOperation;
};

const baseSurface = (
  overrides: Partial<CurationSurface> = {}
): CurationSurface => ({
  activeScopes: [
    {
      activatedByOperationId: "op-1",
      groups: [
        { groupId: "group-1", itemIds: ["item-1", "item-2"], label: "Editing" },
      ],
      maturity: "released",
      scope: releaseScope("1.2.0"),
      scopeId: "scope-1",
      sourceFingerprint: "sha256:source-fingerprint",
    },
  ],
  audience: "public",
  displayPreferences: {
    chronologicalAccess: "curated-with-toggle",
    dateDisplay: "month-year",
    defaultOrganization: "product-area",
    detailDensity: "balanced",
    layout: "grouped-sections",
    navigation: ["anchors", "search"],
    versionDisplay: "friendly",
    visualDirection: "editorial-minimal",
  },
  fallback: "source-order",
  mode: "selected-summary",
  operations: [baseOperation()],
  sourcePaths: ["CHANGELOG.md"],
  surfaceId: "surface-1",
  surfacePaths: ["RELEASES.md"],
  transparencyPreference: { preference: "none" },
  ...overrides,
});

const buildValidCurationManifest = (): CurationManifest => ({
  schemaVersion: 1,
  surfaces: [baseSurface()],
});

/** Reads the manifest's first surface without an unsafe non-null read. */
const firstSurface = (manifest: CurationManifest): CurationSurface => {
  const [surface] = manifest.surfaces;
  if (!surface) {
    throw new Error("Expected the manifest to include a surface");
  }
  return surface;
};

/** Reads a surface's first operation without an unsafe non-null read. */
const firstOperation = (surface: CurationSurface): CurationOperation => {
  const [operation] = surface.operations;
  if (!operation) {
    throw new Error("Expected the surface to include an operation");
  }
  return operation;
};

/** Reads a surface's first active scope without an unsafe non-null read. */
const firstActiveScope = (surface: CurationSurface): ActiveCurationScope => {
  const [scope] = surface.activeScopes;
  if (!scope) {
    throw new Error("Expected the surface to include an active scope");
  }
  return scope;
};

describe("curation manifest", () => {
  test("accepts a minimal valid selected-summary surface", () => {
    const manifest = buildValidCurationManifest();
    const result = validateCurationManifest(manifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toBe(manifest);
      expect(result.value).toEqual(manifest);
    }
  });

  test("accepts a minimal valid full-history surface", () => {
    const manifest: CurationManifest = {
      schemaVersion: 1,
      surfaces: [
        baseSurface({
          activeScopes: [
            {
              activatedByOperationId: "op-1",
              groups: [],
              maturity: "released",
              scope: { kind: "full-history" },
              scopeId: "scope-full",
              sourceFingerprint: "sha256:source-fingerprint",
            },
          ],
          displayPreferences: {
            chronologicalAccess: "chronology-with-filters",
            dateDisplay: "exact",
            defaultOrganization: "release-chronology",
            detailDensity: "full",
            layout: "timeline",
            navigation: ["anchors"],
            versionDisplay: "exact",
            visualDirection: "project-native",
          },
          mode: "full-history",
          operations: [
            baseOperation({
              effectiveScope: { kind: "full-history" },
              requestedScope: { kind: "full-history" },
            }),
          ],
        }),
      ],
    };
    expect(validateCurationManifest(manifest).ok).toBe(true);
  });

  describe("scope variants", () => {
    const scopeVariants: CurationScope[] = [
      { kind: "full-history" },
      {
        first: releaseBoundary("1.0.0"),
        kind: "release-range",
        last: releaseBoundary("1.2.0"),
      },
      { kind: "release", release: releaseBoundary("1.2.0") },
      {
        kind: "section",
        release: releaseBoundary("1.2.0"),
        section: releaseBoundary("Fixed"),
      },
      { itemIds: ["item-1"], kind: "item-set" },
    ];

    test("accepts every supported scope kind", () => {
      for (const scope of scopeVariants) {
        const manifest: CurationManifest = {
          schemaVersion: 1,
          surfaces: [
            baseSurface({
              operations: [
                baseOperation({ effectiveScope: scope, requestedScope: scope }),
              ],
            }),
          ],
        };
        expect(validateCurationManifest(manifest).ok).toBe(true);
      }
    });

    test("rejects an unknown scope kind", () => {
      const manifest = {
        schemaVersion: 1,
        surfaces: [
          baseSurface({
            operations: [
              baseOperation({
                effectiveScope: {
                  kind: "everything",
                } as unknown as CurationScope,
              }),
            ],
          }),
        ],
      };
      const result = validateCurationManifest(manifest);
      expect(result.ok).toBe(false);
    });
  });

  describe("operation status conditionals", () => {
    test("completed operation requires equal before/after eligible counts", () => {
      const manifest = buildValidCurationManifest();
      const operation = firstOperation(firstSurface(manifest));
      operation.status = "completed";
      operation.counts = {
        eligibleAfter: 3,
        eligibleBefore: 4,
        groupsAfter: 2,
        groupsBefore: 1,
        mapped: 3,
        moved: 2,
      };
      const result = validateCurationManifest(manifest);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors.join("\n")).toContain("eligibleAfter");
    });

    test("completed operation requires equal before/after eligible-item-set fingerprints", () => {
      const manifest = buildValidCurationManifest();
      firstOperation(firstSurface(manifest)).eligibleItemSetFingerprintAfter =
        "sha256:different";
      const result = validateCurationManifest(manifest);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors.join("\n")).toContain(
        "eligibleItemSetFingerprintAfter"
      );
    });

    test("completed operation requires after fingerprints and counts", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.operations[0] = baseOperation({
        counts: undefined,
        eligibleItemSetFingerprintAfter: undefined,
        surfaceFingerprintAfter: undefined,
      });
      const result = validateCurationManifest(manifest);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some((error) =>
            error.includes("eligibleItemSetFingerprintAfter")
          )
        ).toBe(true);
        expect(
          result.errors.some((error) =>
            error.includes("surfaceFingerprintAfter")
          )
        ).toBe(true);
        expect(result.errors.some((error) => error.includes("counts"))).toBe(
          true
        );
      }
    });

    test("partial operation requires a resume boundary", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.activeScopes = [];
      surface.operations[0] = baseOperation({
        counts: undefined,
        eligibleItemSetFingerprintAfter: undefined,
        status: "partial",
        surfaceFingerprintAfter: undefined,
      });
      expect(validateCurationManifest(manifest).ok).toBe(false);

      firstOperation(surface).resumeAfter = releaseBoundary("1.2.0");
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });

    test("failed operation requires a failure diagnostic", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.activeScopes = [];
      surface.operations[0] = baseOperation({
        counts: undefined,
        eligibleItemSetFingerprintAfter: undefined,
        status: "failed",
        surfaceFingerprintAfter: undefined,
      });
      expect(validateCurationManifest(manifest).ok).toBe(false);

      firstOperation(surface).failureDiagnostic =
        "Timed out contacting the source repository.";
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });

    test("superseded operation requires supersededBy referencing a real operation", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.activeScopes = [];
      surface.operations[0] = baseOperation({
        counts: undefined,
        eligibleItemSetFingerprintAfter: undefined,
        status: "superseded",
        surfaceFingerprintAfter: undefined,
      });
      expect(validateCurationManifest(manifest).ok).toBe(false);

      surface.operations.push(baseOperation({ operationId: "op-2" }));
      firstOperation(surface).supersededBy = "op-2";
      expect(validateCurationManifest(manifest).ok).toBe(true);

      firstOperation(surface).supersededBy = "op-missing";
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });
  });

  describe("display preferences and temporal-marker rules", () => {
    test("full-history surfaces cannot hide both date and version display", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.mode = "full-history";
      surface.operations[0] = baseOperation({
        effectiveScope: { kind: "full-history" },
        requestedScope: { kind: "full-history" },
      });
      surface.displayPreferences.dateDisplay = "hidden";
      surface.displayPreferences.versionDisplay = "hidden";
      expect(validateCurationManifest(manifest).ok).toBe(false);

      surface.displayPreferences.dateDisplay = "exact";
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });

    test("a single-release selected-summary surface may hide both markers", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.displayPreferences.dateDisplay = "hidden";
      surface.displayPreferences.versionDisplay = "hidden";
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });
  });

  describe("transparency preferences", () => {
    test("curation-notice requires notice text and location", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.transparencyPreference = { preference: "curation-notice" };
      expect(validateCurationManifest(manifest).ok).toBe(false);

      surface.transparencyPreference = {
        noticeLocation: "footer",
        noticeText: "Entries in this view are curated.",
        preference: "curation-notice",
      };
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });

    test("correction-notice requires notice text and location", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.transparencyPreference = { preference: "correction-notice" };
      expect(validateCurationManifest(manifest).ok).toBe(false);

      surface.transparencyPreference = {
        noticeLocation: "header",
        noticeText: "This history was corrected.",
        preference: "correction-notice",
      };
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });

    test("none and undecided forbid notice text and location", () => {
      for (const preference of ["none", "undecided"] as const) {
        const manifest = buildValidCurationManifest();
        firstSurface(manifest).transparencyPreference = {
          noticeText: "Should not be allowed here.",
          preference,
        };
        expect(validateCurationManifest(manifest).ok).toBe(false);
      }
    });

    test("none and undecided are valid on their own", () => {
      for (const preference of ["none", "undecided"] as const) {
        const manifest = buildValidCurationManifest();
        firstSurface(manifest).transparencyPreference = { preference };
        expect(validateCurationManifest(manifest).ok).toBe(true);
      }
    });
  });

  describe("deployed impact", () => {
    test("accepts deployed, unpublished, and unknown states", () => {
      for (const state of ["deployed", "unpublished", "unknown"] as const) {
        const manifest = buildValidCurationManifest();
        firstOperation(firstSurface(manifest)).deployedImpact = {
          acknowledged: false,
          changeKinds: [],
          evidence: state === "unknown" ? [] : ["release notes page"],
          state,
        };
        expect(validateCurationManifest(manifest).ok).toBe(true);
      }
    });

    test("deployed overwrite of a previously visible scope requires acknowledgment", () => {
      const manifest = buildValidCurationManifest();
      const operation = firstOperation(firstSurface(manifest));
      operation.deployedImpact = {
        acknowledged: false,
        changeKinds: ["ordering"],
        evidence: ["release notes page"],
        previouslyVisibleScope: releaseScope("1.1.0"),
        state: "deployed",
      };
      expect(validateCurationManifest(manifest).ok).toBe(false);

      operation.deployedImpact.acknowledged = true;
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });

    test("deployed state without a previously visible scope does not require acknowledgment", () => {
      const manifest = buildValidCurationManifest();
      firstOperation(firstSurface(manifest)).deployedImpact = {
        acknowledged: false,
        changeKinds: ["ordering"],
        evidence: ["release notes page"],
        state: "deployed",
      };
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });
  });

  describe("linked rewrite and copy-revision records", () => {
    test("canonical change kinds require a linked source rewrite", () => {
      const manifest = buildValidCurationManifest();
      const operation = firstOperation(firstSurface(manifest));
      operation.deployedImpact = {
        acknowledged: false,
        changeKinds: ["date"],
        evidence: [],
        state: "unpublished",
      };
      expect(validateCurationManifest(manifest).ok).toBe(false);

      operation.linkedSourceRewrite = {
        authorizationCode: "RELEASED_HISTORY_REWRITE",
        changedPaths: ["CHANGELOG.md"],
        changeKinds: ["date"],
        sourceFingerprintAfter: "sha256:after",
        sourceFingerprintBefore: "sha256:before",
      };
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });

    test("selected-summary copy changes accept a linked copy revision instead", () => {
      const manifest = buildValidCurationManifest();
      const operation = firstOperation(firstSurface(manifest));
      operation.deployedImpact = {
        acknowledged: false,
        changeKinds: ["content"],
        evidence: [],
        state: "unpublished",
      };
      expect(validateCurationManifest(manifest).ok).toBe(false);

      operation.linkedSurfaceCopyRevision = {
        authorizationCode: "RELEASE_NOTE_COPY_REVISION",
        changedItemIds: ["item-1"],
        surfaceFingerprintAfter: "sha256:after",
        surfaceFingerprintBefore: "sha256:before",
      };
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });

    test("full-history content changes require a linked source rewrite, not just a copy revision", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.mode = "full-history";
      surface.operations[0] = baseOperation({
        deployedImpact: {
          acknowledged: false,
          changeKinds: ["content"],
          evidence: [],
          state: "unpublished",
        },
        effectiveScope: { kind: "full-history" },
        linkedSurfaceCopyRevision: {
          authorizationCode: "RELEASE_NOTE_COPY_REVISION",
          changedItemIds: ["item-1"],
          surfaceFingerprintAfter: "sha256:after",
          surfaceFingerprintBefore: "sha256:before",
        },
        requestedScope: { kind: "full-history" },
      });
      firstActiveScope(surface).scope = { kind: "full-history" };
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("rejects a linked source rewrite with the wrong authorization code", () => {
      const manifest = buildValidCurationManifest();
      const operation = firstOperation(firstSurface(manifest));
      operation.deployedImpact = {
        acknowledged: false,
        changeKinds: ["date"],
        evidence: [],
        state: "unpublished",
      };
      operation.linkedSourceRewrite = {
        authorizationCode:
          "RELEASE_NOTE_COPY_REVISION" as unknown as "RELEASED_HISTORY_REWRITE",
        changedPaths: ["CHANGELOG.md"],
        changeKinds: ["date"],
        sourceFingerprintAfter: "sha256:after",
        sourceFingerprintBefore: "sha256:before",
      };
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });
  });

  describe("uniqueness", () => {
    test("rejects duplicate surface IDs", () => {
      const manifest = buildValidCurationManifest();
      manifest.surfaces.push(baseSurface());
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("rejects duplicate operation IDs within a surface", () => {
      const manifest = buildValidCurationManifest();
      firstSurface(manifest).operations.push(baseOperation());
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("rejects duplicate group IDs within an active scope", () => {
      const manifest = buildValidCurationManifest();
      firstActiveScope(firstSurface(manifest)).groups.push({
        groupId: "group-1",
        itemIds: ["item-3"],
        label: "Duplicate",
      });
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("rejects an item appearing in two active groups within the same scope", () => {
      const manifest = buildValidCurationManifest();
      firstActiveScope(firstSurface(manifest)).groups.push({
        groupId: "group-2",
        itemIds: ["item-1"],
        label: "Also editing",
      });
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("allows the same item ID reused across two different active scopes", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.operations.push(baseOperation({ operationId: "op-2" }));
      surface.activeScopes.push({
        activatedByOperationId: "op-2",
        groups: [
          { groupId: "group-other", itemIds: ["item-1"], label: "Other scope" },
        ],
        maturity: "provisional",
        scope: releaseScope("1.3.0"),
        scopeId: "scope-2",
        sourceFingerprint: "sha256:source-fingerprint-2",
      });
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });
  });

  describe("active scope operation references", () => {
    test("rejects an active scope activated by a nonexistent operation", () => {
      const manifest = buildValidCurationManifest();
      firstActiveScope(firstSurface(manifest)).activatedByOperationId =
        "op-missing";
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("rejects an active scope activated by a non-completed operation", () => {
      const manifest = buildValidCurationManifest();
      const surface = firstSurface(manifest);
      surface.operations[0] = baseOperation({
        counts: undefined,
        eligibleItemSetFingerprintAfter: undefined,
        resumeAfter: releaseBoundary("1.2.0"),
        status: "partial",
        surfaceFingerprintAfter: undefined,
      });
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });
  });

  describe("path handling", () => {
    test("rejects absolute paths", () => {
      const manifest = buildValidCurationManifest();
      firstSurface(manifest).sourcePaths = ["/etc/passwd"];
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("rejects paths containing traversal segments", () => {
      const manifest = buildValidCurationManifest();
      firstSurface(manifest).sourcePaths = ["../CHANGELOG.md"];
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("rejects backslash path separators", () => {
      const manifest = buildValidCurationManifest();
      firstSurface(manifest).surfacePaths = ["docs\\RELEASES.md"];
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("rejects a resolved-path escape embedded mid-path", () => {
      const manifest = buildValidCurationManifest();
      firstSurface(manifest).sourcePaths = ["packages/app/../../../etc/passwd"];
      expect(validateCurationManifest(manifest).ok).toBe(false);
    });

    test("accepts normalized repository-relative paths", () => {
      const manifest = buildValidCurationManifest();
      firstSurface(manifest).sourcePaths = ["packages/app/CHANGELOG.md"];
      expect(validateCurationManifest(manifest).ok).toBe(true);
    });
  });

  describe("unknown-key rejection", () => {
    test("rejects unknown top-level keys", () => {
      const manifest = buildValidCurationManifest();
      const result = validateCurationManifest({ ...manifest, extra: true });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((error) => error.startsWith("$.extra"))).toBe(
          true
        );
      }
    });

    test("rejects unknown nested keys", () => {
      const manifest = buildValidCurationManifest();
      const withExtra = {
        ...manifest,
        surfaces: [{ ...firstSurface(manifest), vendorFlag: true }],
      };
      const result = validateCurationManifest(withExtra);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some((error) =>
            error.startsWith("$.surfaces[0].vendorFlag")
          )
        ).toBe(true);
      }
    });
  });

  describe("portable-input protections", () => {
    test("rejects a non-enumerable required property", () => {
      const manifest = buildValidCurationManifest();
      const input: Record<string, unknown> = { surfaces: manifest.surfaces };
      Object.defineProperty(input, "schemaVersion", { value: 1 });

      const result = validateCurationManifest(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.startsWith("$.schemaVersion")).toBe(true);
      }
    });

    test("rejects accessors without invoking them", () => {
      const manifest = buildValidCurationManifest();
      const input: Record<string, unknown> = { surfaces: manifest.surfaces };
      let reads = 0;
      Object.defineProperty(input, "schemaVersion", {
        configurable: true,
        enumerable: true,
        get: () => {
          reads += 1;
          return 1;
        },
      });

      const result = validateCurationManifest(input);
      expect(result.ok).toBe(false);
      expect(reads).toBe(0);
    });

    test("rejects symbol keys and unsafe prototypes", () => {
      const manifest = buildValidCurationManifest();
      const withSymbol: Record<string | symbol, unknown> = {
        ...manifest,
      };
      Object.defineProperty(withSymbol, Symbol("hidden"), {
        enumerable: true,
        value: "not-portable",
      });
      const withPrototype: Record<string, unknown> = { ...manifest };
      Object.setPrototypeOf(withPrototype, { inherited: true });

      expect(validateCurationManifest(withSymbol).ok).toBe(false);
      expect(validateCurationManifest(withPrototype).ok).toBe(false);
    });

    test("returns validation failures for proxies instead of throwing", () => {
      const manifest = buildValidCurationManifest();
      const throwing = new Proxy(manifest, {
        ownKeys: () => {
          throw new Error("inspection failed");
        },
      });

      let result: ReturnType<typeof validateCurationManifest> | undefined;
      expect(() => {
        result = validateCurationManifest(throwing);
      }).not.toThrow();
      expect(result?.ok).toBe(false);
    });
  });

  test("preserves the original object on validation failure", () => {
    const manifest = buildValidCurationManifest();
    const operation = firstOperation(firstSurface(manifest));
    operation.status = "completed";
    operation.counts = {
      eligibleAfter: 3,
      eligibleBefore: 4,
      groupsAfter: 2,
      groupsBefore: 1,
      mapped: 3,
      moved: 2,
    };
    const snapshot = structuredClone(manifest);
    const result = validateCurationManifest(manifest);
    expect(result.ok).toBe(false);
    expect(manifest).toEqual(snapshot);
  });
});
