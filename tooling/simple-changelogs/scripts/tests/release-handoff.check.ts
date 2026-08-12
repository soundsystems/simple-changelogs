import { describe, expect, test } from "bun:test";
import {
  canonicalJson,
  decisionDigest,
  digestCanonicalJson,
  effectivePolicyDigest,
  validateChangelogReceipt,
  validateChangelogRequest,
} from "../lib/release-handoff.ts";

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
