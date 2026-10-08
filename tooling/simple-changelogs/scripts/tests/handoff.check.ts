import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import {
  assembleReceipt,
  canonicalJson,
  decisionDigest,
  digestCanonicalJson,
  effectivePolicyDigest,
  negotiatedReceiptVersion,
  REASON_ACTIONS,
  versionLineEvidence,
} from "../handoff.ts";
import {
  type ChangelogReceiptV2,
  type ChangelogRequest,
  shapeReceipt,
  validateChangelogReceipt,
  validateChangelogRequest,
} from "../lib/release-handoff.ts";

const REPOSITORY_ROOT = join(import.meta.dir, "..", "..", "..", "..");
const installed = (distribution: string): string =>
  join(REPOSITORY_ROOT, "skills", distribution, "scripts", "handoff.ts");
const marker = async (distribution: string): Promise<unknown> =>
  (
    JSON.parse(
      await readFile(
        join(
          REPOSITORY_ROOT,
          "skills",
          distribution,
          "changelog-provider.json"
        ),
        "utf8"
      )
    ) as { receiptVersions: unknown }
  ).receiptVersions;

const revision = "0123456789abcdef0123456789abcdef01234567";
const finalized = "89abcdef0123456789abcdef0123456789abcdef";
const reconciliation = "fedcba9876543210fedcba9876543210fedcba98";
const now = new Date("2026-10-08T12:00:00.123Z");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

const policy = {
  automationOwner: null,
  policy: { minor: "ask", patch: "ask" },
  releaseTags: "v{version}",
  releaseTrain: "web",
  source: "repository-policy",
  versionConvention: "semver",
  versionOwner: "package.json",
};

const request = (
  phase: "classify" | "prepare" | "verify",
  overrides: Record<string, unknown> = {}
) => ({
  approvedDecisionDigest: phase === "classify" ? null : "a".repeat(64),
  approvedVersion: phase === "classify" ? null : "1.3.0",
  boundary: "web-production",
  finalizedTargetRevision: phase === "verify" ? finalized : null,
  inputTargetRevision: revision,
  mutationScope: phase === "prepare" ? "prepare-release-files" : "read-only",
  phase,
  priorReceiptDigest: phase === "classify" ? null : "b".repeat(64),
  releaseSetId: null,
  releaseSetTrains: null,
  releaseTrain: "web",
  schemaVersion: 3,
  supportedReceiptVersions: [1, 2, 3, 4],
  transactionId: "release-01",
  ...overrides,
});

const decision = {
  currentVersion: "1.2.0",
  policyAction: "ask",
  resolution: "explicit-direction",
  selectedVersion: "1.3.0",
  source: "current-request",
  suggestedVersion: "1.3.0",
};

const findings = (overrides: Record<string, unknown> = {}) => ({
  checks: ["Inspected the exact target."],
  decision,
  evidence: ["Aggregate impact is minor."],
  policy,
  releaseImpact: "minor",
  status: "classified",
  ...overrides,
});

const release = {
  date: "2026-10-08",
  tag: { message: "Example 1.3.0", name: "v1.3.0" },
  version: "1.3.0",
};

const valid = (receipt: unknown, delegated: unknown, prior?: unknown) =>
  validateChangelogReceipt(
    receipt,
    validateChangelogRequest(delegated).value as ChangelogRequest,
    prior
  ).errors;

const run = async (
  args: string[],
  stdin?: string
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  const child = spawn({
    cmd: [process.execPath, ...args],
    stderr: "pipe",
    stdin: stdin === undefined ? "ignore" : Buffer.from(stdin),
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ]);
  return { exitCode, stderr, stdout };
};

describe("handoff digests", () => {
  test("canonical JSON sorts keys by code unit and keeps ECMAScript numbers", () => {
    expect(canonicalJson({ a: { z: 2, "€": 1 }, b: [1e21, 0.1, -0] })).toBe(
      '{"a":{"z":2,"€":1},"b":[1e+21,0.1,0]}'
    );
    expect(canonicalJson({ "\u{1f600}": 1, "～": 2 })).toBe('{"😀":1,"～":2}');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
    expect(digestCanonicalJson({ a: 2, b: 1 })).toBe(
      createHash("sha256").update('{"a":2,"b":1}').digest("hex")
    );
  });

  test("policy and decision digests keep their pinned values", () => {
    const { releaseTags: _tags, ...untagged } = policy;
    expect(
      effectivePolicyDigest({ ...untagged, policy: { patch: "ask" } })
    ).toBe("e5a6e09c54009ddd066390a8d90630a91a49c6fed4f4338383a4bce798738dd6");
    expect(
      decisionDigest({
        boundary: "web-production",
        currentVersion: "0.9.0",
        effectivePolicyDigest: "a".repeat(64),
        impact: "minor",
        inputTargetRevision: revision,
        releaseTrain: "web",
        selectedVersion: null,
        suggestedVersion: "0.10.0",
        transactionId: "release-01",
        versionOwner: "package.json",
      })
    ).toBe("8825521f3c18a611b71350f615706e183ea19e05e90722f6419173de37f4844b");
  });

  test("every distribution ships the helper beside its receipt versions", async () => {
    const canonical = await readFile(
      join(REPOSITORY_ROOT, "tooling/simple-changelogs/scripts/handoff.ts"),
      "utf8"
    );
    const copies = await Promise.all(
      [
        "simple-changelogs",
        "simple-changelogs-cms",
        "simple-changelogs-mobile",
        "simple-changelogs-skill-maintainer",
        "simple-changelogs-web",
        "simple-changelogs-web-cms",
      ].map(async (distribution) => ({
        source: await readFile(installed(distribution), "utf8"),
        versions: await marker(distribution),
      }))
    );
    for (const { source, versions } of copies) {
      expect(source).toBe(canonical);
      expect(versions).toBeArray();
    }
  });
});

describe("handoff receipt assembly", () => {
  test("negotiates the highest written version both sides list", () => {
    expect(negotiatedReceiptVersion([1, 2, 3, 4], [1, 2, 3, 4])).toBe(4);
    expect(negotiatedReceiptVersion([1, 2, 3], [1, 2, 4])).toBe(2);
    expect(negotiatedReceiptVersion([1, 2, 3, 4], [2])).toBe(2);
    expect(negotiatedReceiptVersion([1], [1, 2])).toBeNull();
    expect(negotiatedReceiptVersion("4", [4])).toBeNull();
  });

  test("a classify, prepare, and verify transaction validates at every receipt version", () => {
    for (const [requestVersion, supported, expected] of [
      [3, [1, 2, 3, 4], 4],
      [2, [1, 2, 3], 3],
      [1, [1, 2], 2],
    ] as const) {
      const shape = {
        schemaVersion: requestVersion,
        supportedReceiptVersions: [...supported],
        ...(requestVersion === 1 ? { releaseSetTrains: undefined } : {}),
      };
      const at = (phase: "classify" | "prepare" | "verify", extra = {}) =>
        JSON.parse(JSON.stringify(request(phase, { ...shape, ...extra })));
      const classifyRequest = at("classify");
      const classified = assembleReceipt({
        findings: findings(),
        now,
        pathDigests: [],
        prior: null,
        providedVersions: [1, 2, 3, 4],
        request: classifyRequest,
      });
      expect(classified.schemaVersion).toBe(expected);
      expect(classified.observedAt).toBe("2026-10-08T12:00:00Z");
      expect(valid(classified, classifyRequest)).toEqual([]);

      const prepareRequest = at("prepare", {
        approvedDecisionDigest: classified.decisionDigest,
        priorReceiptDigest: digestCanonicalJson(classified),
      });
      const paths = [{ digest: "c".repeat(64), path: "CHANGELOG.md" }];
      const prepared = assembleReceipt({
        findings: findings({
          paths: ["CHANGELOG.md"],
          reconciliationHeadRevision: reconciliation,
          release,
          status: "prepared",
        }),
        now,
        pathDigests: paths,
        prior: classified,
        providedVersions: [1, 2, 3, 4],
        request: prepareRequest,
      });
      expect(prepared.decisionDigest).toBe(classified.decisionDigest);
      expect(prepared.paths).toEqual(paths);
      expect(prepared.release).toEqual({
        date: "2026-10-08",
        targetContainedUnreleased: "prepared",
        version: "1.3.0",
        ...(expected === 4 ? { tag: release.tag } : {}),
      });
      expect(valid(prepared, prepareRequest, classified)).toEqual([]);

      const verifyRequest = at("verify", {
        approvedDecisionDigest: classified.decisionDigest,
        priorReceiptDigest: digestCanonicalJson(prepared),
      });
      // Verify takes the release record and reconciliation head from the
      // prepared receipt when the findings leave them out.
      const verified = assembleReceipt({
        findings: findings({ status: "verified" }),
        now,
        pathDigests: [],
        prior: prepared,
        providedVersions: [1, 2, 3, 4],
        request: verifyRequest,
      });
      expect(verified.sourceRevision).toBe(finalized);
      expect(verified.revisionLineage).toEqual({
        finalizedTargetRevision: finalized,
        inputTargetRevision: revision,
        reconciliationHeadRevision: reconciliation,
      });
      expect(verified.paths).toEqual([]);
      expect(
        (verified.release as { targetContainedUnreleased: string })
          .targetContainedUnreleased
      ).toBe("integrated");
      expect(valid(verified, verifyRequest, prepared)).toEqual([]);
    }
  });

  test("matches the tooling receipt shape, version line included", () => {
    const line = {
      members: ["mobile", "web"],
      memberVersions: { mobile: "1.2.0", web: "1.2.0" },
      mode: "bump-shared",
      outcome: "advance",
      sharedVersion: "1.2.0",
      sharedVersionTrains: ["mobile", "web"],
    };
    for (const [requestVersion, supported] of [
      [3, [1, 2, 3, 4]],
      [2, [1, 2, 3]],
      [1, [1, 2]],
    ] as const) {
      const delegated = JSON.parse(
        JSON.stringify(
          request("prepare", {
            schemaVersion: requestVersion,
            supportedReceiptVersions: [...supported],
            ...(requestVersion === 1
              ? { releaseSetTrains: undefined }
              : {
                  releaseSetId: "set-01",
                  releaseSetTrains: ["mobile", "web"],
                }),
            ...(requestVersion === 1 ? { releaseSetId: "set-01" } : {}),
          })
        )
      ) as ChangelogRequest;
      const assembled = assembleReceipt({
        findings: findings({
          decision: { ...decision, versionLine: line },
          reasonCode: null,
          reconciliationHeadRevision: reconciliation,
          release,
          status: "prepared",
        }),
        now,
        pathDigests: [],
        prior: null,
        providedVersions: [1, 2, 3, 4],
        request: delegated,
      });
      const policyDigest = effectivePolicyDigest(policy);
      const body: ChangelogReceiptV2 = {
        checks: ["Inspected the exact target."],
        decisionDigest: decisionDigest({
          boundary: "web-production",
          currentVersion: "1.2.0",
          effectivePolicyDigest: policyDigest,
          impact: "minor",
          inputTargetRevision: revision,
          releaseTrain: "web",
          selectedVersion: "1.3.0",
          suggestedVersion: "1.3.0",
          transactionId: "release-01",
          versionLine: line,
          versionOwner: "package.json",
        }),
        effectivePolicyDigest: policyDigest,
        evidence: ["Aggregate impact is minor."],
        observedAt: "2026-10-08T12:00:00Z",
        paths: [],
        phase: "prepare",
        provider: "simple-changelogs",
        reason: null,
        reasonCode: null,
        release: {
          date: "2026-10-08",
          targetContainedUnreleased: "prepared",
          version: "1.3.0",
        },
        releaseImpact: "minor",
        releaseSetId: "set-01",
        requiredAction: null,
        revisionLineage: {
          finalizedTargetRevision: null,
          inputTargetRevision: revision,
          reconciliationHeadRevision: reconciliation,
        },
        schemaVersion: 2,
        sourceRevision: revision,
        status: "prepared",
        transactionId: "release-01",
        versionDecision: {
          boundary: "web-production",
          bumpLevel: "minor",
          currentVersion: "1.2.0",
          policyAction: "ask",
          releaseTrain: "web",
          resolution: "explicit-direction",
          selectedVersion: "1.3.0",
          source: "current-request",
          suggestedVersion: "1.3.0",
        },
      };
      const shaped = shapeReceipt(delegated, body, line as never, {
        tag: release.tag,
      });
      expect(assembled).toEqual(shaped as unknown as Record<string, unknown>);
      if (requestVersion === 1) {
        expect(assembled.evidence).toContain(versionLineEvidence(line));
      }
    }
  });

  test("derives the required action and refuses inputs it cannot place", () => {
    const blocked = assembleReceipt({
      findings: findings({
        decision: null,
        reason: "The target moved.",
        reasonCode: "target-moved",
        releaseImpact: "unknown",
        status: "blocked",
      }),
      now,
      pathDigests: [],
      prior: null,
      providedVersions: [2],
      request: request("classify"),
    });
    expect(blocked.requiredAction).toBe(REASON_ACTIONS["target-moved"]);
    expect(blocked.versionDecision).toBeNull();
    const refused = (input: Partial<Parameters<typeof assembleReceipt>[0]>) =>
      expect(() =>
        assembleReceipt({
          findings: findings(),
          now,
          pathDigests: [],
          prior: null,
          providedVersions: [1, 2, 3, 4],
          request: request("classify"),
          ...input,
        })
      ).toThrow();
    refused({ findings: findings({ reasonCode: "made-up" }) });
    refused({ findings: findings({ surprise: true }) });
    refused({ findings: findings({ policy: { ...policy, extra: 1 } }) });
    refused({ findings: findings({ release }) });
    refused({
      pathDigests: [{ digest: "c".repeat(64), path: "CHANGELOG.md" }],
    });
    refused({ providedVersions: [1] });
    refused({ request: request("classify", { phase: "publish" }) });
  });
});

describe("handoff CLI", () => {
  test("digests JSON from a file or stdin and path bytes at a revision", async () => {
    const repo = await mkdtemp(join(tmpdir(), "handoff-check-"));
    temporaryDirectories.push(repo);
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
    git("init", "-q");
    await writeFile(join(repo, "CHANGELOG.md"), "# Changelog\n");
    git("add", "CHANGELOG.md");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-qm",
      "init"
    );
    await writeFile(join(repo, "CHANGELOG.md"), "# Changelog\n\nEdited\n");
    await writeFile(join(repo, "policy.json"), JSON.stringify(policy));
    const helper = installed("simple-changelogs");
    const [fromFile, fromStdin, json, paths, atHead, escaped] =
      await Promise.all([
        run([helper, "digest", "policy", join(repo, "policy.json")]),
        run([helper, "digest", "policy", "-"], JSON.stringify(policy)),
        run([helper, "digest", "json"], '{"b":1,"a":2}'),
        run([helper, "digest", "paths", "--repo", repo, "CHANGELOG.md"]),
        run([
          helper,
          "digest",
          "paths",
          "--repo",
          repo,
          "--rev",
          "HEAD",
          "CHANGELOG.md",
        ]),
        run([helper, "digest", "paths", "--repo", repo, "../CHANGELOG.md"]),
      ]);
    expect(fromFile.stdout.trim()).toBe(effectivePolicyDigest(policy));
    expect(fromStdin.stdout.trim()).toBe(effectivePolicyDigest(policy));
    expect(json.stdout.trim()).toBe(digestCanonicalJson({ a: 2, b: 1 }));
    const sha = (text: string) =>
      createHash("sha256").update(text).digest("hex");
    expect(JSON.parse(paths.stdout)).toEqual([
      { digest: sha("# Changelog\n\nEdited\n"), path: "CHANGELOG.md" },
    ]);
    expect(JSON.parse(atHead.stdout)).toEqual([
      { digest: sha("# Changelog\n"), path: "CHANGELOG.md" },
    ]);
    expect(escaped.exitCode).toBe(1);
    expect(escaped.stderr).toContain("repository-relative");
  });

  test("assembles a receipt with the installed distribution's versions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "handoff-check-"));
    temporaryDirectories.push(directory);
    const requestFile = join(directory, "request.json");
    const findingsFile = join(directory, "findings.json");
    await writeFile(
      requestFile,
      JSON.stringify(
        request("classify", { supportedReceiptVersions: [1, 2, 3] })
      )
    );
    await writeFile(findingsFile, JSON.stringify(findings()));
    const args = [
      "receipt",
      "--request",
      requestFile,
      "--findings",
      findingsFile,
    ];
    const [full, web, cms, missing] = await Promise.all([
      run([installed("simple-changelogs"), ...args]),
      run([installed("simple-changelogs-web"), ...args]),
      run([installed("simple-changelogs-cms"), ...args]),
      run([
        join(REPOSITORY_ROOT, "tooling/simple-changelogs/scripts/handoff.ts"),
        ...args,
      ]),
    ]);
    expect(JSON.parse(full.stdout).schemaVersion).toBe(3);
    // Web writes receipts 1, 2, and 4, so a request listing 1 to 3 gets v2.
    expect(JSON.parse(web.stdout).schemaVersion).toBe(2);
    expect(JSON.parse(cms.stdout).schemaVersion).toBe(2);
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toContain("changelog-provider.json");
  });
});
