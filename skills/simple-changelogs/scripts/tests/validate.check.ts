import { describe, expect, test } from "bun:test";
import type {
  EvalCase,
  EvalManifest,
  EvaluationReport,
  RunnerRequest,
  RunnerResponse,
} from "../lib/types.ts";
import {
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

  test("accepts an optional developer changelog and disabled signatures", () => {
    const result = validateRepoPolicy({
      ...portableRepoPolicy(),
      developerChangelog: "optional",
      signatures: "none",
    });
    expect(result.ok).toBe(true);
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
