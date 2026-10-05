import { describe, expect, test } from "bun:test";
import {
  type ChangelogReceiptV2,
  type ChangelogRequest,
  canonicalJson,
  decisionDigest,
  digestCanonicalJson,
  effectivePolicyDigest,
  receiptVersionFor,
  shapeReceipt,
  validateChangelogReceipt,
  validateChangelogReleaseSet,
  validateChangelogRequest,
} from "../lib/release-handoff.ts";
import { versionLineEvidence } from "../lib/version-lines.ts";

const revision = "0123456789abcdef0123456789abcdef01234567";
const digest = "a".repeat(64);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const request = (phase: "classify" | "prepare" | "verify" = "classify") => ({
  approvedDecisionDigest: phase === "classify" ? null : digest,
  approvedVersion: phase === "classify" ? null : "0.10.0",
  attempt: 1,
  boundary: "web-production" as const,
  environment: "production",
  finalizedTargetRevision: phase === "verify" ? revision : null,
  inputTargetRevision: revision,
  mutationScope:
    phase === "prepare"
      ? ("prepare-release-files" as const)
      : ("read-only" as const),
  phase,
  priorReceiptDigest: phase === "classify" ? null : digest,
  releaseSetId: null,
  releaseTrain: "web",
  schemaVersion: 1 as const,
  supportedReceiptVersions: [1, 2] as (1 | 2)[],
  transactionId: "release-01",
});

const decisionRequired = () => ({
  checks: ["Inspected the exact target."],
  decisionDigest: digest,
  effectivePolicyDigest: digest,
  evidence: ["Aggregate impact is minor."],
  observedAt: "2026-08-10T12:00:00-05:00",
  paths: [],
  phase: "classify" as const,
  provider: "simple-changelogs" as const,
  reason: "Choose the public version.",
  reasonCode: "version-direction-required" as const,
  release: null,
  releaseImpact: "minor" as const,
  releaseSetId: null,
  requiredAction: "choose-version" as const,
  revisionLineage: {
    finalizedTargetRevision: null,
    inputTargetRevision: revision,
    reconciliationHeadRevision: null,
  },
  schemaVersion: 2 as const,
  sourceRevision: revision,
  status: "decision-required" as const,
  transactionId: "release-01",
  versionDecision: {
    boundary: "web-production" as const,
    bumpLevel: "minor" as const,
    currentVersion: "0.9.0",
    policyAction: "ask" as const,
    releaseTrain: "web",
    resolution: "approval-required" as const,
    selectedVersion: null,
    source: "repository-policy" as const,
    suggestedVersion: "0.10.0",
  },
});

describe("release handoff protocol", () => {
  test("validates resolved public classification without claiming preparation in receipt v2 and v3", () => {
    for (const version of [2, 3] as const) {
      const input = {
        ...decisionRequired(),
        reason: null,
        reasonCode: null,
        requiredAction: null,
        schemaVersion: version,
        status: "classified",
        ...(version === 3 ? { releaseSetTrains: null } : {}),
        versionDecision: {
          ...decisionRequired().versionDecision,
          policyAction: "automatic",
          resolution: "automatic",
          selectedVersion: "0.10.0",
          ...(version === 3 ? { versionLine: null } : {}),
        },
      };
      const delegated = validateChangelogRequest({
        ...request(),
        releaseSetTrains: null,
        schemaVersion: 2,
        supportedReceiptVersions: [1, 2, 3],
      }).value;
      expect(validateChangelogReceipt(input, delegated).errors).toEqual([]);
      for (const override of [
        { selectedVersion: null },
        { resolution: "approval-required" },
        { releaseTrain: "ios" },
      ]) {
        expect(
          validateChangelogReceipt(
            {
              ...input,
              versionDecision: { ...input.versionDecision, ...override },
            },
            delegated
          ).errors.length
        ).toBeGreaterThan(0);
      }
      expect(
        validateChangelogReceipt(
          {
            ...input,
            revisionLineage: {
              ...input.revisionLineage,
              reconciliationHeadRevision: revision,
            },
          },
          delegated
        ).errors.length
      ).toBeGreaterThan(0);
      expect(
        validateChangelogReceipt(
          {
            ...input,
            release: {
              date: "2026-08-10",
              targetContainedUnreleased: "prepared",
              version: "0.10.0",
            },
          },
          delegated
        ).errors.length
      ).toBeGreaterThan(0);
    }
    expect(
      validateChangelogReceipt(
        decisionRequired(),
        validateChangelogRequest(request()).value
      ).errors
    ).toEqual([]);
  });

  test("canonicalizes object keys and produces stable policy and decision digests", () => {
    expect(canonicalJson({ a: [true, "x"], z: 1 })).toBe(
      '{"a":[true,"x"],"z":1}'
    );
    expect(digestCanonicalJson({ a: 1, b: 2 })).toBe(
      digestCanonicalJson({ a: 1, b: 2 })
    );
    expect(
      effectivePolicyDigest({
        automationOwner: null,
        policy: { patch: "ask" },
        releaseTrain: "web",
        source: "repository-policy",
        versionConvention: "semver",
        versionOwner: "package.json",
      })
    ).toMatch(SHA256_PATTERN);
    expect(
      decisionDigest({
        boundary: "web-production",
        currentVersion: "0.9.0",
        effectivePolicyDigest: digest,
        impact: "minor",
        inputTargetRevision: revision,
        releaseTrain: "web",
        selectedVersion: null,
        suggestedVersion: "0.10.0",
        transactionId: "release-01",
        versionOwner: "package.json",
      })
    ).toMatch(SHA256_PATTERN);
  });

  test("rejects partial, extra, and phase-incompatible requests", () => {
    expect(validateChangelogRequest(request()).errors).toEqual([]);
    expect(
      validateChangelogRequest({
        ...request(),
        mutationScope: "prepare-release-files",
      }).errors
    ).toContain("classify requires read-only");
    expect(
      validateChangelogRequest({ ...request(), extra: true }).errors
    ).toContain("request has missing or unknown fields");
    expect(
      validateChangelogRequest({ ...request(), phase: "verify" }).errors
    ).toContain("verify requires finalizedTargetRevision");
  });

  test("treats attempt and environment as optional informational fields", () => {
    const { attempt, environment, ...minimal } = request();
    expect(attempt).toBe(1);
    expect(environment).toBe("production");
    expect(validateChangelogRequest(minimal).errors).toEqual([]);
    expect(
      validateChangelogRequest({ ...minimal, attempt: 0 }).errors
    ).toContain("attempt must be positive");
    expect(
      validateChangelogRequest({ ...minimal, environment: "" }).errors
    ).toContain("environment is invalid");
    expect(
      validateChangelogRequest({ ...minimal, environment: null }).errors
    ).toContain("environment is invalid");
    expect(
      validateChangelogReceipt(
        decisionRequired(),
        validateChangelogRequest(minimal).value
      ).errors
    ).toEqual([]);
  });

  test("accepts decision-required and rejects approval encoded as blocked", () => {
    const validatedRequest = validateChangelogRequest(request()).value;
    expect(
      validateChangelogReceipt(decisionRequired(), validatedRequest).errors
    ).toEqual([]);
    expect(
      validateChangelogReceipt(
        { ...decisionRequired(), status: "blocked" },
        validatedRequest
      ).errors
    ).not.toEqual([]);
  });

  test("rejects version approval for internal-only work", () => {
    const decision = decisionRequired();
    const internalOnly = {
      ...decision,
      releaseImpact: "none" as const,
      versionDecision: {
        ...decision.versionDecision,
        boundary: "none" as const,
        bumpLevel: "none" as const,
        suggestedVersion: null,
      },
    };
    expect(validateChangelogReceipt(internalOnly, request()).errors).toContain(
      "internal-only or non-public work must be not-applicable"
    );
    expect(validateChangelogReceipt(internalOnly, request()).errors).toContain(
      "decision-required receipt invariants failed"
    );
  });

  test("enforces prepare and final read-only verification invariants", () => {
    const prepared = {
      ...decisionRequired(),
      paths: [{ digest, path: "CHANGELOG.md" }],
      phase: "prepare" as const,
      reason: null,
      reasonCode: null,
      release: {
        date: "2026-08-10",
        targetContainedUnreleased: "prepared" as const,
        version: "0.10.0",
      },
      requiredAction: null,
      revisionLineage: {
        finalizedTargetRevision: null,
        inputTargetRevision: revision,
        reconciliationHeadRevision: revision,
      },
      status: "prepared" as const,
      versionDecision: {
        ...decisionRequired().versionDecision,
        policyAction: "automatic" as const,
        resolution: "automatic" as const,
        selectedVersion: "0.10.0",
      },
    };
    expect(
      validateChangelogReceipt(
        prepared,
        validateChangelogRequest(request("prepare")).value
      ).errors
    ).toEqual([]);

    const verified = {
      ...prepared,
      paths: [],
      phase: "verify" as const,
      release: {
        ...prepared.release,
        targetContainedUnreleased: "integrated" as const,
      },
      revisionLineage: {
        ...prepared.revisionLineage,
        finalizedTargetRevision: revision,
      },
      status: "verified" as const,
    };
    expect(
      validateChangelogReceipt(
        verified,
        validateChangelogRequest(request("verify")).value
      ).errors
    ).toEqual([]);
    expect(
      validateChangelogReceipt({ ...verified, paths: prepared.paths }).errors
    ).toContain("verified receipt invariants failed");
  });
});

// The CMS-only distribution prepares and verifies an operator entry on the
// `none` boundary: no version is approved, selected, bumped, or released.
describe("entry-only operator-history handoff", () => {
  const entryRequest = (phase: "classify" | "prepare" | "verify") => ({
    ...request(phase),
    approvedVersion: null,
    boundary: "none" as const,
    releaseTrain: "cms-operators",
    transactionId: "cms-entry-01",
  });
  const entryDecision = () => ({
    boundary: "none" as const,
    bumpLevel: "none" as const,
    currentVersion: null,
    policyAction: "not-applicable" as const,
    releaseTrain: "cms-operators",
    resolution: "not-required" as const,
    selectedVersion: null,
    source: "repository-policy" as const,
    suggestedVersion: null,
  });
  const preparedEntry = () => ({
    ...decisionRequired(),
    paths: [{ digest, path: "CMS_CHANGELOG.json" }],
    phase: "prepare" as const,
    reason: null,
    reasonCode: null,
    release: null,
    requiredAction: null,
    revisionLineage: {
      finalizedTargetRevision: null,
      inputTargetRevision: revision,
      reconciliationHeadRevision: revision,
    },
    status: "prepared" as const,
    transactionId: "cms-entry-01",
    versionDecision: entryDecision(),
  });

  const classifiedEntry = () => ({
    ...preparedEntry(),
    paths: [],
    phase: "classify" as const,
    revisionLineage: {
      finalizedTargetRevision: null,
      inputTargetRevision: revision,
      reconciliationHeadRevision: null,
    },
    status: "classified" as const,
  });

  test("binds a version-less request to the none boundary only", () => {
    expect(validateChangelogRequest(entryRequest("prepare")).errors).toEqual(
      []
    );
    expect(
      validateChangelogRequest({
        ...entryRequest("prepare"),
        approvedVersion: "1.0.0",
      }).errors
    ).toContain("the none boundary carries no approvedVersion");
    expect(
      validateChangelogRequest({
        ...request("prepare"),
        approvedVersion: null,
      }).errors
    ).toContain("prepare requires approvedVersion on a public boundary");
  });

  test("accepts a prepared entry with or without a version decision", () => {
    const prepareRequest = validateChangelogRequest(
      entryRequest("prepare")
    ).value;
    expect(
      validateChangelogReceipt(preparedEntry(), prepareRequest).errors
    ).toEqual([]);
    expect(
      validateChangelogReceipt(
        { ...preparedEntry(), versionDecision: null },
        prepareRequest
      ).errors
    ).toEqual([]);
    expect(
      validateChangelogReceipt({ ...preparedEntry(), paths: [] }).errors
    ).toContain("prepared receipt invariants failed");
  });

  test("advances a relevant entry from classified to prepared", () => {
    const classifyRequest = validateChangelogRequest(
      entryRequest("classify")
    ).value;
    const classified = validateChangelogReceipt(
      classifiedEntry(),
      classifyRequest
    );
    expect(classified.errors).toEqual([]);
    if (!classified.value) {
      throw new Error("classified receipt did not validate");
    }

    const prepareRequest = validateChangelogRequest({
      ...entryRequest("prepare"),
      approvedDecisionDigest: classified.value.decisionDigest,
      priorReceiptDigest: digestCanonicalJson(classified.value),
    }).value;
    expect(
      validateChangelogReceipt(preparedEntry(), prepareRequest).errors
    ).toEqual([]);
  });

  test("rejects a version on the none boundary and a missing one elsewhere", () => {
    const prepareRequest = validateChangelogRequest(
      entryRequest("prepare")
    ).value;
    expect(
      validateChangelogReceipt(
        {
          ...preparedEntry(),
          release: {
            date: "2026-08-10",
            targetContainedUnreleased: "prepared" as const,
            version: "0.10.0",
          },
        },
        prepareRequest
      ).errors
    ).toContain("entry-only handoff must not name a release");
    expect(
      validateChangelogReceipt(
        {
          ...preparedEntry(),
          transactionId: "release-01",
          versionDecision: null,
        },
        validateChangelogRequest(request("prepare")).value
      ).errors
    ).toContain("public boundary requires a release record");
  });

  test("verifies an integrated entry without a release record", () => {
    const verifiedEntry = {
      ...preparedEntry(),
      paths: [],
      phase: "verify" as const,
      revisionLineage: {
        ...preparedEntry().revisionLineage,
        finalizedTargetRevision: revision,
      },
      status: "verified" as const,
    };
    expect(
      validateChangelogReceipt(
        verifiedEntry,
        validateChangelogRequest(entryRequest("verify")).value
      ).errors
    ).toEqual([]);
  });
});

// Simple Changes 0.23.0: request v2 names the release set's trains, and
// receipt v3 echoes them and carries the version line structurally.
describe("request v2 and receipt v3", () => {
  type Status = "decision-required" | "prepared" | "verified" | "blocked";
  const line = (overrides: Record<string, unknown> = {}) => ({
    members: ["mobile", "web"],
    memberVersions: { mobile: "0.21.3", web: "1.0.0" } as Record<
      string,
      string | null
    >,
    mode: "catch-up" as "catch-up" | "bump-shared",
    outcome: "catch-up" as "catch-up" | "advance",
    sharedVersion: "1.0.0" as string | null,
    sharedVersionTrains: ["web"],
    ...overrides,
  });
  const requestV2 = (
    phase: "classify" | "prepare" | "verify" = "classify"
  ) => ({
    ...request(phase),
    approvedVersion: phase === "classify" ? null : "1.0.0",
    releaseSetId: "set-01",
    releaseSetTrains: ["mobile", "web"] as string[] | null,
    releaseTrain: "mobile",
    schemaVersion: 2 as const,
    supportedReceiptVersions: [1, 2, 3] as (1 | 2 | 3)[],
  });
  const PHASE_OF = {
    blocked: "classify",
    "decision-required": "classify",
    prepared: "prepare",
    verified: "verify",
  } as const;
  const ask = { policyAction: "ask", reason: "Choose the public version." };
  const done = {
    policyAction: "automatic",
    reason: null,
    reasonCode: null,
    requiredAction: null,
    resolution: "automatic",
  };
  const STATUS_FIELDS: Record<Status, Record<string, string | null>> = {
    blocked: {
      ...ask,
      reason: "The version owner is ambiguous.",
      reasonCode: "version-owner-ambiguous",
      requiredAction: "resolve-version-owner",
      resolution: "blocked",
    },
    "decision-required": {
      ...ask,
      reasonCode: "version-direction-required",
      requiredAction: "choose-version",
      resolution: "approval-required",
    },
    prepared: done,
    verified: done,
  };
  const receiptV3 = (
    status: Status = "decision-required",
    lineOverrides: Record<string, unknown> = {},
    decisionOverrides: Record<string, unknown> = {}
  ) => {
    const released = status === "prepared" || status === "verified";
    const { policyAction, reason, reasonCode, requiredAction, resolution } =
      STATUS_FIELDS[status];
    return {
      ...decisionRequired(),
      paths: status === "prepared" ? [{ digest, path: "CHANGELOG.md" }] : [],
      phase: PHASE_OF[status],
      reason,
      reasonCode,
      release: released
        ? {
            date: "2026-10-02",
            targetContainedUnreleased:
              status === "prepared" ? "prepared" : "integrated",
            version: "1.0.0",
          }
        : null,
      releaseImpact: "patch" as const,
      releaseSetId: "set-01",
      releaseSetTrains: ["mobile", "web"] as string[] | null,
      requiredAction,
      revisionLineage: {
        finalizedTargetRevision: status === "verified" ? revision : null,
        inputTargetRevision: revision,
        reconciliationHeadRevision: released ? revision : null,
      },
      schemaVersion: 3 as const,
      status,
      versionDecision: {
        ...decisionRequired().versionDecision,
        bumpLevel: "major" as const,
        currentVersion: "0.21.3",
        policyAction,
        releaseTrain: "mobile",
        resolution,
        selectedVersion: released ? "1.0.0" : null,
        suggestedVersion: "1.0.0",
        versionLine: line(lineOverrides),
        ...decisionOverrides,
      },
    };
  };
  const requestFor = (status: Status) =>
    validateChangelogRequest(requestV2(PHASE_OF[status])).value;
  const errorsOf = (
    receipt: unknown,
    status: Status = "decision-required",
    prior?: unknown
  ) => validateChangelogReceipt(receipt, requestFor(status), prior).errors;

  test("validates request v2 and leaves request v1 unchanged", () => {
    expect(validateChangelogRequest(requestV2()).errors).toEqual([]);
    expect(validateChangelogRequest(requestV2("verify")).errors).toEqual([]);
    expect(
      validateChangelogRequest({ ...request(), releaseSetTrains: null }).errors
    ).toEqual(["request has missing or unknown fields"]);
    expect(
      validateChangelogRequest({
        ...request(),
        supportedReceiptVersions: [1, 2, 3],
      }).errors
    ).toEqual(["supportedReceiptVersions is invalid"]);
    const { releaseSetTrains, ...missing } = requestV2();
    expect(releaseSetTrains).not.toBeNull();
    expect(validateChangelogRequest(missing).errors).toEqual([
      "request has missing or unknown fields",
    ]);
    expect(
      validateChangelogRequest({ ...requestV2(), releaseSetTrains: ["mobile"] })
        .errors
    ).toContain("releaseSetTrains is invalid");
    expect(
      validateChangelogRequest({
        ...requestV2(),
        approvedVersion: "1.0.0",
      }).errors
    ).toEqual(["classify carries no approval"]);
    expect(
      validateChangelogRequest({
        ...requestV2("prepare"),
        approvedDecisionDigest: null,
      }).errors
    ).toEqual(["prepare requires approvedDecisionDigest"]);
  });

  test("rule 1: a release set needs its id and its own train, and receipts echo it", () => {
    const setError =
      "releaseSetTrains requires a releaseSetId and must include the releasing train";
    expect(
      validateChangelogRequest({ ...requestV2(), releaseSetId: null }).errors
    ).toEqual([setError]);
    expect(
      validateChangelogRequest({
        ...requestV2(),
        releaseSetTrains: ["ios", "web"],
      }).errors
    ).toEqual([setError]);
    expect(
      validateChangelogRequest({
        ...requestV2(),
        releaseSetId: null,
        releaseSetTrains: null,
      }).errors
    ).toEqual([]);
    expect(errorsOf(receiptV3())).toEqual([]);
    expect(
      errorsOf({ ...receiptV3(), releaseSetTrains: ["web", "mobile"] })
    ).toEqual(["releaseSetTrains must echo the request"]);
    expect(errorsOf({ ...receiptV3(), releaseSetTrains: null })).toEqual([
      "releaseSetTrains must echo the request",
    ]);
    expect(
      validateChangelogReceipt(receiptV3(), {
        ...requestV2(),
        approvedVersion: null,
        releaseSetId: "set-01",
        schemaVersion: 1,
        supportedReceiptVersions: [1, 2],
      } as unknown as ChangelogRequest).errors
    ).toContain("the request did not advertise receipt v3");
  });

  test("honours supportedReceiptVersions: request v1 [1, 2] gets receipt v2 without v3 fields", () => {
    const v1 = validateChangelogRequest(request()).value as ChangelogRequest;
    const body = decisionRequired() as ChangelogReceiptV2;
    const shaped = shapeReceipt(v1, body, line());

    expect(receiptVersionFor(v1)).toBe(2);
    expect(shaped.schemaVersion).toBe(2);
    expect(Object.hasOwn(shaped, "releaseSetTrains")).toBe(false);
    expect(Object.hasOwn(shaped.versionDecision ?? {}, "versionLine")).toBe(
      false
    );
    expect(shaped.evidence.at(-1)).toBe(versionLineEvidence(line()));
    expect(validateChangelogReceipt(shaped, v1).errors).toEqual([]);
    expect(shapeReceipt(v1, body, null)).toEqual(body);
    expect(() =>
      shapeReceipt({ ...v1, supportedReceiptVersions: [1] }, body, null)
    ).toThrow("Receipt v1");

    const v2 = validateChangelogRequest(requestV2()).value as ChangelogRequest;
    const v3 = shapeReceipt(
      v2,
      {
        ...body,
        releaseImpact: "patch",
        releaseSetId: "set-01",
        versionDecision: {
          ...body.versionDecision,
          bumpLevel: "major",
          currentVersion: "0.21.3",
          releaseTrain: "mobile",
          suggestedVersion: "1.0.0",
        } as ChangelogReceiptV2["versionDecision"],
      },
      line()
    );
    expect(v3.schemaVersion).toBe(3);
    expect(v3.evidence).toEqual(body.evidence);
    expect(v3).toMatchObject({
      releaseSetTrains: ["mobile", "web"],
      versionDecision: { versionLine: line() },
    });
    expect(validateChangelogReceipt(v3, v2).errors).toEqual([]);
    expect(receiptVersionFor({ ...v2, supportedReceiptVersions: [1, 2] })).toBe(
      2
    );
  });

  test("rule 2: the head and its holders are recomputed from sorted members", () => {
    expect(
      errorsOf(receiptV3("decision-required", { sharedVersion: "0.21.3" }))
    ).toEqual([
      "sharedVersion and sharedVersionTrains must be recomputed from memberVersions",
    ]);
    expect(
      errorsOf(
        receiptV3("decision-required", {
          memberVersions: { mobile: "0.21.3", web: "1.0" },
          sharedVersion: "1.0.0+45",
        })
      )
    ).toEqual([]);
    expect(
      errorsOf(
        receiptV3("decision-required", {
          members: ["ios", "mobile", "web"],
          memberVersions: { ios: "1.0.0", mobile: "0.21.3", web: "1.0.0" },
          sharedVersionTrains: ["web", "ios"],
        })
      )
    ).toContain(
      "sharedVersion and sharedVersionTrains must be recomputed from memberVersions"
    );
    expect(
      errorsOf(
        receiptV3("decision-required", {
          memberVersions: { mobile: null, web: null },
          outcome: "advance",
          sharedVersion: null,
          sharedVersionTrains: ["web"],
        })
      )
    ).toContain(
      "sharedVersion and sharedVersionTrains must be recomputed from memberVersions"
    );
    const membership =
      "versionLine members must be sorted, include the train, and key memberVersions";
    expect(
      errorsOf(receiptV3("decision-required", { members: ["web", "mobile"] }))
    ).toContain(membership);
    expect(
      errorsOf(
        receiptV3("decision-required", {
          members: ["ios", "web"],
          memberVersions: { ios: "0.21.3", web: "1.0.0" },
        })
      )
    ).toContain(membership);
  });

  test("rule 3: the proposal is the suggestion, then the selection; blocked is structural only", () => {
    expect(
      errorsOf(
        receiptV3("decision-required", {}, { suggestedVersion: "0.21.3" })
      )
    ).toEqual(
      expect.arrayContaining(["0.21.3 must exceed the train's own 0.21.3"])
    );
    expect(errorsOf(receiptV3("prepared"), "prepared")).toEqual([]);
    expect(errorsOf(receiptV3("verified"), "verified")).toEqual([]);
    expect(
      errorsOf(
        {
          ...receiptV3("prepared", {}, { selectedVersion: "0.21.3" }),
          release: { ...receiptV3("prepared").release, version: "0.21.3" },
        },
        "prepared"
      )
    ).toEqual(
      expect.arrayContaining(["0.21.3 must exceed the train's own 0.21.3"])
    );
    expect(
      errorsOf(receiptV3("blocked", {}, { suggestedVersion: "0.0.1" }))
    ).toEqual([]);
  });

  test("rule 4: catch-up takes exactly the head from behind; advance passes it; bump-shared advances", () => {
    expect(
      errorsOf(
        receiptV3(
          "decision-required",
          {
            memberVersions: { mobile: "1.0.0", web: "1.0.0" },
            sharedVersionTrains: ["mobile", "web"],
          },
          { currentVersion: "1.0.0", suggestedVersion: "1.0.1" }
        )
      )
    ).toContain("only a train behind the line head catches up");
    expect(
      errorsOf(
        receiptV3("decision-required", {}, { suggestedVersion: "1.0.1" })
      )
    ).toEqual(["1.0.1 does not fit catch-up from the line head 1.0.0"]);
    expect(
      errorsOf(receiptV3("decision-required", { outcome: "advance" }))
    ).toEqual(["1.0.0 does not fit advance from the line head 1.0.0"]);
    expect(
      errorsOf(
        receiptV3(
          "decision-required",
          { outcome: "advance" },
          {
            suggestedVersion: "1.0.1",
          }
        )
      )
    ).toEqual([]);
    expect(
      errorsOf(receiptV3("decision-required", { mode: "bump-shared" }))
    ).toContain("bump-shared always advances");
    expect(
      errorsOf(
        receiptV3(
          "decision-required",
          {
            memberVersions: { mobile: null, web: null },
            outcome: "advance",
            sharedVersion: null,
            sharedVersionTrains: [],
          },
          { currentVersion: null, suggestedVersion: "0.1.0" }
        )
      )
    ).toEqual([]);
  });

  test("rule 5: never below the train's own entry or a stable current version", () => {
    expect(
      errorsOf(receiptV3("decision-required", {}, { currentVersion: "1.0.1" }))
    ).toEqual(["1.0.0 is below the current version 1.0.1"]);
    expect(
      errorsOf(receiptV3("decision-required", {}, { currentVersion: "1.0.0" }))
    ).toEqual([]);
    expect(
      errorsOf(
        receiptV3("decision-required", {}, { currentVersion: "2.0.0-rc.1" })
      )
    ).toEqual([]);
  });

  test("rule 6: bump-shared never reuses a head a partner released before the set", () => {
    const partnerReleased = {
      memberVersions: { mobile: "0.21.2", web: "0.21.1" },
      mode: "bump-shared",
      outcome: "advance",
      sharedVersion: "0.21.2",
      sharedVersionTrains: ["mobile"],
    };
    const reuse = receiptV3("decision-required", partnerReleased, {
      currentVersion: "0.21.1",
      releaseTrain: "web",
      suggestedVersion: "0.21.2",
    });
    const web = validateChangelogRequest({
      ...requestV2(),
      releaseTrain: "web",
    }).value;
    expect(validateChangelogReceipt(reuse, web).errors).toEqual([
      "0.21.2 does not fit advance from the line head 0.21.2",
    ]);
    expect(
      validateChangelogReceipt(
        {
          ...reuse,
          versionDecision: {
            ...reuse.versionDecision,
            suggestedVersion: "0.21.3",
          },
        },
        web
      ).errors
    ).toEqual([]);
  });

  test("rule 7: digests cover the line state, not the outcome, and old digests are unchanged", () => {
    const decisionInput = {
      boundary: "web-production" as const,
      currentVersion: "0.9.0",
      effectivePolicyDigest: digest,
      impact: "minor" as const,
      inputTargetRevision: revision,
      releaseTrain: "web",
      selectedVersion: null,
      suggestedVersion: "0.10.0",
      transactionId: "release-01",
      versionOwner: "package.json",
    };
    const policyInput = {
      automationOwner: null,
      policy: { patch: "ask" },
      releaseTrain: "web",
      source: "repository-policy",
      versionConvention: "semver",
      versionOwner: "package.json",
    };
    // Pinned from origin/main before receipt v3: no line, no change.
    expect(decisionDigest(decisionInput)).toBe(
      "8825521f3c18a611b71350f615706e183ea19e05e90722f6419173de37f4844b"
    );
    expect(decisionDigest({ ...decisionInput, versionLine: null })).toBe(
      decisionDigest(decisionInput)
    );
    expect(effectivePolicyDigest(policyInput)).toBe(
      "e5a6e09c54009ddd066390a8d90630a91a49c6fed4f4338383a4bce798738dd6"
    );
    expect(
      effectivePolicyDigest({ ...policyInput, sharedVersionLines: [] })
    ).toBe(effectivePolicyDigest(policyInput));
    expect(
      effectivePolicyDigest({
        ...policyInput,
        sharedVersionLines: [{ mode: "catch-up", trains: ["mobile", "web"] }],
      })
    ).not.toBe(effectivePolicyDigest(policyInput));
    const onLine = decisionDigest({ ...decisionInput, versionLine: line() });
    expect(onLine).not.toBe(decisionDigest(decisionInput));
    expect(
      decisionDigest({
        ...decisionInput,
        versionLine: line({ outcome: "advance" }),
      })
    ).toBe(onLine);
    for (const changed of [
      { memberVersions: { mobile: "0.21.4", web: "1.0.0" } },
      { mode: "bump-shared" },
      { sharedVersion: "1.0" },
    ]) {
      expect(
        decisionDigest({ ...decisionInput, versionLine: line(changed) })
      ).not.toBe(onLine);
    }

    const prior = receiptV3();
    const prepared = receiptV3("prepared");
    const prepareRequest = validateChangelogRequest({
      ...requestV2("prepare"),
      priorReceiptDigest: digestCanonicalJson(prior),
    }).value;
    expect(
      validateChangelogReceipt(prepared, prepareRequest, prior).errors
    ).toEqual([]);
    expect(
      validateChangelogReceipt(
        receiptV3("prepared", {
          memberVersions: { mobile: "0.21.3", web: "1.0.0+7" },
          outcome: "catch-up",
        }),
        prepareRequest,
        prior
      ).errors
    ).toEqual([]);
    const moved = receiptV3(
      "prepared",
      {
        memberVersions: { mobile: "0.21.3", web: "1.1.0" },
        sharedVersion: "1.1.0",
      },
      { selectedVersion: "1.1.0" }
    );
    expect(
      validateChangelogReceipt(
        { ...moved, release: { ...moved.release, version: "1.1.0" } },
        { ...prepareRequest, approvedVersion: "1.1.0" } as ChangelogRequest,
        prior
      ).errors
    ).toEqual(["the line state changed under the same decisionDigest"]);
    expect(
      validateChangelogReceipt(prepared, prepareRequest, receiptV3("blocked"))
        .errors
    ).toEqual(["prior receipt does not match priorReceiptDigest"]);
  });

  describe("rule 8: one release set", () => {
    const member = (train: string, selectedVersion = "0.22.0") => {
      const receipt = receiptV3(
        "prepared",
        {
          memberVersions: { mobile: "0.21.0", web: "0.21.1" },
          mode: "bump-shared",
          outcome: "advance",
          sharedVersion: "0.21.1",
          sharedVersionTrains: ["web"],
        },
        { currentVersion: null, releaseTrain: train, selectedVersion }
      );
      return {
        ...receipt,
        release: { ...receipt.release, version: selectedVersion },
        transactionId: `release-${train}`,
      };
    };
    const check = (receipts: unknown[]) =>
      validateChangelogReleaseSet(receipts);

    test("accepts one identical number per line and reports missing trains", () => {
      expect(check([member("mobile"), member("web")])).toEqual({
        errors: [],
        value: {
          lines: [{ members: ["mobile", "web"], selectedVersion: "0.22.0" }],
          missingTrains: [],
          receipts: 2,
          releaseSetId: "set-01",
        },
      });
      const wider = (train: string) => ({
        ...member(train),
        releaseSetTrains: ["web", "mobile", "ios"],
      });
      expect(
        check([wider("mobile"), wider("web")]).value?.missingTrains
      ).toEqual(["ios"]);
    });

    test("refuses 0.22 beside 0.22.0 and any second state for one line", () => {
      expect(check([member("mobile"), member("web", "0.22")]).errors).toEqual([
        "trains on one line publish one identical version string, not 0.22.0 and 0.22",
      ]);
      const stale = member("web");
      stale.versionDecision.versionLine.memberVersions = {
        mobile: "0.20.0",
        web: "0.21.1",
      };
      expect(check([member("mobile"), stale]).errors).toEqual([
        "receipts on one line must share its state",
      ]);
    });

    test("needs one set, input target, and train list with one receipt per train", () => {
      const shared =
        "every receipt must share the releaseSetId, input target revision, and releaseSetTrains";
      expect(
        check([member("mobile"), { ...member("web"), releaseSetId: "set-02" }])
          .errors
      ).toEqual([shared]);
      expect(
        check([
          member("mobile"),
          {
            ...member("web"),
            revisionLineage: {
              ...member("web").revisionLineage,
              inputTargetRevision: "f".repeat(40),
            },
          },
        ]).errors
      ).toEqual([shared]);
      expect(
        check([
          member("mobile"),
          { ...member("web"), releaseSetTrains: ["mobile", "ios"] },
        ]).errors
      ).toEqual(expect.arrayContaining([shared]));
      expect(
        check([
          member("mobile"),
          { ...member("web"), releaseSetTrains: ["web", "mobile"] },
        ]).errors
      ).toEqual([]);
      expect(check([member("mobile"), member("mobile")]).errors).toEqual([
        "mobile must appear once and in releaseSetTrains",
      ]);
      expect(check([decisionRequired(), member("web")]).errors).toContain(
        "a release-set check needs valid v3 receipts"
      );
      expect(
        check([
          { ...member("mobile"), releaseSetId: null, releaseSetTrains: null },
        ]).errors
      ).toEqual(["a release-set check needs a named release set"]);
    });

    test("places each train on at most one line, carried by its own receipt", () => {
      const desktop = member("web");
      desktop.versionDecision.versionLine = {
        ...desktop.versionDecision.versionLine,
        members: ["desktop", "web"],
        memberVersions: { desktop: "0.21.0", web: "0.21.1" },
      };
      const trains = ["desktop", "mobile", "web"];
      expect(
        check([
          { ...member("mobile"), releaseSetTrains: trains },
          { ...desktop, releaseSetTrains: trains },
        ]).errors
      ).toEqual(
        expect.arrayContaining([
          "receipts disagree about the line web belongs to",
        ])
      );
      const offLine = member("web");
      offLine.versionDecision.versionLine =
        null as unknown as typeof offLine.versionDecision.versionLine;
      expect(check([member("mobile"), offLine]).errors).toEqual([
        "another receipt places web on a line its own receipt does not carry",
      ]);
    });
  });

  test("rule 9: versions on a line are one to three numbers; prereleases fail closed", () => {
    expect(
      errorsOf(
        receiptV3("decision-required", {
          memberVersions: { mobile: "0.21.3", web: "1.0.0-rc.1" },
        })
      )
    ).toEqual(["versionLine is invalid"]);
    expect(
      errorsOf(receiptV3("decision-required", { sharedVersion: "1.0.0.0" }))
    ).toEqual(["versionLine is invalid"]);
    expect(
      errorsOf(
        receiptV3("decision-required", {}, { suggestedVersion: "1.0.0-rc.1" })
      )
    ).toEqual(["1.0.0-rc.1 is not a stable dotted version"]);
    expect(
      errorsOf(
        receiptV3("decision-required", {}, { suggestedVersion: "1.0+9" })
      )
    ).toEqual([]);
  });

  test("a blocked receipt v3 may omit its decision; receipt v2 keeps its binding", () => {
    const blocked = { ...receiptV3("blocked"), versionDecision: null };
    expect(errorsOf(blocked, "blocked")).toEqual([]);
    const { releaseSetTrains, ...legacy } = blocked;
    expect(releaseSetTrains).not.toBeNull();
    expect(
      validateChangelogReceipt(
        { ...legacy, releaseSetId: null, schemaVersion: 2 },
        validateChangelogRequest(request()).value
      ).errors
    ).toEqual(["receipt does not match its exact request"]);
  });

  test("receipt v3 is held to its schema's shapes and status conditions", () => {
    expect(errorsOf(receiptV3("decision-required", { extra: true }))).toEqual([
      "versionLine is invalid",
    ]);
    expect(
      errorsOf({
        ...receiptV3(),
        versionDecision: { ...receiptV3().versionDecision, source: "guess" },
      })
    ).toEqual(["versionDecision is invalid"]);
    expect(errorsOf({ ...receiptV3(), observedAt: "2026-10-02" })).toEqual([
      "observedAt must be a date-time",
    ]);
    expect(
      errorsOf({ ...receiptV3("blocked"), reason: null }, "blocked")
    ).toEqual(["blocked receipt fails its schema conditions"]);
    const { releaseSetTrains, ...v2Shaped } = receiptV3();
    expect(releaseSetTrains).not.toBeNull();
    expect(errorsOf(v2Shaped)).toEqual([
      "receipt has missing or unknown fields",
    ]);
  });
});
