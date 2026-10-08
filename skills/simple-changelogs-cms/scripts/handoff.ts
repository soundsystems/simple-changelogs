#!/usr/bin/env bun

// Digests and receipt assembly for the delegated release handoff. It computes
// the RFC 8785 canonical-JSON SHA-256 digests a receipt carries and assembles
// a receipt from the request and the agent's findings. It never validates a
// request or receipt against the protocol; Simple Changes does that
// (`validate-changelog-transaction`). It writes nothing: output goes to stdout.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync, stdin } from "bun";

const USAGE = `Usage: handoff.ts <command> [options]

Commands:
  digest json [FILE]       SHA-256 of FILE's canonical JSON, such as the
                           priorReceiptDigest of a receipt.
  digest policy [FILE]     effectivePolicyDigest of an effective-policy input.
  digest decision [FILE]   decisionDigest of a decision input.
  digest paths [--rev REV] PATH...
                           Receipt "paths" entries: the SHA-256 of each
                           file's bytes in the working tree, or at REV.
  receipt --request FILE --findings FILE [--prior FILE]
                           Assemble the receipt that answers the request.
  help                     Print this text.

Options:
  --repo PATH   Repository root for Git reads (default: current directory).

FILE is JSON; omit it or pass - to read standard input. The input fields are
listed in references/release-handoff.md. Receipt versions come from the
changelog-provider.json beside this skill.`;

class CliError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** RFC 8785 canonical JSON: sorted keys, no whitespace, ECMAScript numbers. */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Canonical JSON does not support non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("Canonical JSON supports JSON values only");
};

export const digestCanonicalJson = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

export interface EffectivePolicyInput {
  automationOwner: string | null;
  policy: unknown;
  releaseTags?: string;
  releaseTrain: string;
  sharedVersionLines?: unknown[];
  source: string;
  versionConvention: string;
  versionOwner: string;
}

// Resolved shared version lines join the digest only when there is at least
// one, and the train's resolved release-tag template (`none` included) only
// when the policy records releaseTags, so every earlier digest is unchanged.
export const effectivePolicyDigest = ({
  releaseTags,
  sharedVersionLines,
  ...input
}: EffectivePolicyInput): string =>
  digestCanonicalJson({
    ...input,
    ...(releaseTags !== undefined && { releaseTags }),
    ...(sharedVersionLines?.length && { sharedVersionLines }),
  });

/** A shared version line as a receipt carries it. */
export interface VersionLineRecord {
  members: string[];
  memberVersions: Record<string, string | null>;
  mode: string;
  outcome: string;
  sharedVersion: string | null;
  sharedVersionTrains: string[];
}

export interface DecisionInput {
  boundary: string;
  currentVersion: string | null;
  effectivePolicyDigest: string;
  impact: string;
  inputTargetRevision: string;
  releaseTrain: string;
  selectedVersion: string | null;
  suggestedVersion: string | null;
  transactionId: string;
  versionLine?: Omit<VersionLineRecord, "outcome" | "sharedVersionTrains"> &
    Partial<VersionLineRecord>;
  versionOwner: string;
}

// On a line, the decision digest covers the line state (mode, members,
// memberVersions, and sharedVersion) but not the outcome; without a line it
// is unchanged.
export const decisionDigest = ({
  versionLine,
  ...input
}: Omit<DecisionInput, "versionLine"> & {
  versionLine?: DecisionInput["versionLine"] | null;
}): string =>
  digestCanonicalJson(
    versionLine
      ? {
          ...input,
          versionLine: {
            members: versionLine.members,
            memberVersions: versionLine.memberVersions,
            mode: versionLine.mode,
            sharedVersion: versionLine.sharedVersion,
          },
        }
      : input
  );

/** Receipt v2 keeps a version line as one evidence item. */
export const versionLineEvidence = (line: VersionLineRecord): string =>
  `versionLine ${JSON.stringify({
    members: line.members,
    memberVersions: line.memberVersions,
    mode: line.mode,
    outcome: line.outcome,
    sharedVersion: line.sharedVersion,
    sharedVersionTrains: line.sharedVersionTrains,
  })}`;

/** Each receipt reason code and the one action it requires. */
export const REASON_ACTIONS = {
  "final-verification-failed": "review-finalization",
  "invalid-version-direction": "choose-version",
  "malformed-policy": "repair-policy",
  "malformed-request": "repair-request",
  "policy-changed": "refresh-and-reclassify",
  "release-train-ambiguous": "resolve-release-train",
  "schema-digest-mismatch": "repair-integration",
  "target-moved": "refresh-and-reclassify",
  "unsupported-consumer": "upgrade-consumer",
  "unsupported-protocol": "upgrade-producer",
  "version-direction-required": "choose-version",
  "version-owner-ambiguous": "resolve-version-owner",
} as const;

// Receipt v1 is a legacy shape; this helper writes v2, v3, and v4.
const WRITTEN_RECEIPT_VERSIONS = [2, 3, 4];
const PHASES = ["classify", "prepare", "verify"];
const POLICY_KEYS = [
  "automationOwner",
  "policy",
  "releaseTrain",
  "source",
  "versionConvention",
  "versionOwner",
];
const DECISION_KEYS = [
  "boundary",
  "currentVersion",
  "effectivePolicyDigest",
  "impact",
  "inputTargetRevision",
  "releaseTrain",
  "selectedVersion",
  "suggestedVersion",
  "transactionId",
  "versionOwner",
];
const FINDING_KEYS = ["policy", "releaseImpact", "status"];
const OPTIONAL_FINDING_KEYS = [
  "checks",
  "decision",
  "evidence",
  "paths",
  "reason",
  "reasonCode",
  "reconciliationHeadRevision",
  "release",
];
const VERSION_DECISION_KEYS = [
  "currentVersion",
  "policyAction",
  "resolution",
  "selectedVersion",
  "source",
  "suggestedVersion",
];
const RELEASE_KEYS = ["date", "version"];
const MILLISECONDS_PATTERN = /\.\d{3}Z$/u;

/** The keys of `value`, refusing a missing required key or an unknown one. */
const closedRecord = (
  value: unknown,
  label: string,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new CliError(`${label} must be a JSON object`);
  }
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  const unknown = Object.keys(value).filter(
    (key) => !(required.includes(key) || optional.includes(key))
  );
  if (missing.length > 0 || unknown.length > 0) {
    throw new CliError(
      `${label}: ${[
        ...missing.map((key) => `missing ${key}`),
        ...unknown.map((key) => `unknown ${key}`),
      ].join(", ")}`
    );
  }
  return value;
};

export const policyInput = (value: unknown): EffectivePolicyInput =>
  closedRecord(value, "policy input", POLICY_KEYS, [
    "releaseTags",
    "sharedVersionLines",
  ]) as unknown as EffectivePolicyInput;

export const decisionInput = (value: unknown): DecisionInput =>
  closedRecord(value, "decision input", DECISION_KEYS, [
    "versionLine",
  ]) as unknown as DecisionInput;

/** The highest receipt version the request and this provider both write. */
export const negotiatedReceiptVersion = (
  requested: unknown,
  provided: unknown
): number | null => {
  const common = (Array.isArray(requested) ? requested : []).filter(
    (version): version is number =>
      typeof version === "number" &&
      WRITTEN_RECEIPT_VERSIONS.includes(version) &&
      Array.isArray(provided) &&
      provided.includes(version)
  );
  return common.length > 0 ? Math.max(...common) : null;
};

const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value === "") {
    throw new CliError(`${label} must be a non-empty string`);
  }
  return value;
};

const textOrNull = (value: unknown, label: string): string | null =>
  value === null || value === undefined ? null : text(value, label);

const strings = (value: unknown, label: string): string[] => {
  if (value === undefined) {
    return [];
  }
  if (
    !(Array.isArray(value) && value.every((item) => typeof item === "string"))
  ) {
    throw new CliError(`${label} must be an array of strings`);
  }
  return value;
};

/** A repository-relative path a receipt may name. */
export const receiptPath = (path: string): string => {
  if (
    path === "" ||
    path.startsWith("/") ||
    path.split("/").some((segment) => segment === ".." || segment === "")
  ) {
    throw new CliError(
      `${path} must be a repository-relative path without .. segments`
    );
  }
  return path;
};

export interface AssemblyInput {
  findings: unknown;
  now: Date;
  // The digest of each finding path, in order, as `digest paths` reports it.
  pathDigests: { digest: string; path: string }[];
  prior: unknown;
  providedVersions: unknown;
  request: unknown;
}

const reasonFields = (findings: Record<string, unknown>) => {
  const code = findings.reasonCode ?? null;
  if (code !== null && !Object.hasOwn(REASON_ACTIONS, String(code))) {
    throw new CliError(`unknown reasonCode ${String(code)}`);
  }
  return {
    reason: textOrNull(findings.reason, "reason"),
    reasonCode: code,
    requiredAction:
      code === null
        ? null
        : REASON_ACTIONS[code as keyof typeof REASON_ACTIONS],
  };
};

const versionDecisionFor = (
  findings: Record<string, unknown>,
  request: Record<string, unknown>,
  version: number
): Record<string, unknown> | null => {
  if (findings.decision === null || findings.decision === undefined) {
    return null;
  }
  const decision = closedRecord(
    findings.decision,
    "findings.decision",
    VERSION_DECISION_KEYS,
    ["bumpLevel", "versionLine"]
  );
  return {
    boundary: request.boundary,
    bumpLevel: decision.bumpLevel ?? findings.releaseImpact,
    currentVersion: decision.currentVersion,
    policyAction: decision.policyAction,
    releaseTrain: request.releaseTrain,
    resolution: decision.resolution,
    selectedVersion: decision.selectedVersion,
    source: decision.source,
    suggestedVersion: decision.suggestedVersion,
    ...(version === 2 ? {} : { versionLine: decision.versionLine ?? null }),
  };
};

// Prepare and verify carry the release record; verify may take it, and the
// reconciliation head, from the prior prepared receipt.
const releaseFor = (
  findings: Record<string, unknown>,
  prior: Record<string, unknown> | null,
  phase: string,
  version: number
): Record<string, unknown> | null => {
  const given =
    findings.release === undefined && phase === "verify"
      ? (prior?.release ?? null)
      : (findings.release ?? null);
  if (given === null) {
    return null;
  }
  if (phase === "classify") {
    throw new CliError("findings.release applies only to prepare and verify");
  }
  const release = closedRecord(given, "findings.release", RELEASE_KEYS, [
    "tag",
    "targetContainedUnreleased",
  ]);
  const tag = release.tag ?? null;
  if (version !== 4 && tag !== null) {
    process.stderr.write(
      `Receipt v${version} names no release tag, so the tag was left out.\n`
    );
  }
  return {
    date: text(release.date, "release.date"),
    targetContainedUnreleased: phase === "verify" ? "integrated" : "prepared",
    version: text(release.version, "release.version"),
    ...(version === 4 ? { tag } : {}),
  };
};

const lineageFor = (
  findings: Record<string, unknown>,
  prior: Record<string, unknown> | null,
  request: Record<string, unknown>
) => {
  const { phase } = request;
  const priorLineage = isRecord(prior?.revisionLineage)
    ? prior.revisionLineage
    : {};
  const reconciliation =
    findings.reconciliationHeadRevision === undefined && phase === "verify"
      ? (priorLineage.reconciliationHeadRevision ?? null)
      : (findings.reconciliationHeadRevision ?? null);
  if (phase === "classify" && reconciliation !== null) {
    throw new CliError(
      "reconciliationHeadRevision applies only to prepare and verify"
    );
  }
  return {
    finalizedTargetRevision:
      phase === "verify" ? request.finalizedTargetRevision : null,
    inputTargetRevision: request.inputTargetRevision,
    reconciliationHeadRevision: reconciliation,
  };
};

const nullableText = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/**
 * Assembles the receipt that answers `request` from the agent's findings: the
 * negotiated version, request echoes, revisions, both digests, and the phase's
 * release record. It checks only its own inputs, never the protocol.
 */
export const assembleReceipt = ({
  findings: findingsValue,
  now,
  pathDigests: digests,
  prior: priorValue,
  providedVersions,
  request: requestValue,
}: AssemblyInput): Record<string, unknown> => {
  if (!isRecord(requestValue)) {
    throw new CliError("the request must be a JSON object");
  }
  const request = requestValue;
  const phase = String(request.phase);
  if (!PHASES.includes(phase)) {
    throw new CliError(`the request names an unknown phase ${phase}`);
  }
  const findings = closedRecord(
    findingsValue,
    "findings",
    FINDING_KEYS,
    OPTIONAL_FINDING_KEYS
  );
  const version = negotiatedReceiptVersion(
    request.supportedReceiptVersions,
    providedVersions
  );
  if (version === null) {
    throw new CliError(
      "the request advertises no receipt version this distribution writes"
    );
  }
  if (digests.length > 0 && phase !== "prepare") {
    throw new CliError("findings.paths applies only to prepare");
  }
  const prior = isRecord(priorValue) ? priorValue : null;
  const policy = policyInput(findings.policy);
  const policyDigest = effectivePolicyDigest(policy);
  const versionDecision = versionDecisionFor(findings, request, version);
  const line = isRecord(findings.decision)
    ? (findings.decision.versionLine as VersionLineRecord | null | undefined)
    : null;
  const evidence = strings(findings.evidence, "findings.evidence");
  return {
    checks: strings(findings.checks, "findings.checks"),
    decisionDigest: decisionDigest({
      boundary: String(request.boundary),
      currentVersion: nullableText(versionDecision?.currentVersion),
      effectivePolicyDigest: policyDigest,
      impact: String(findings.releaseImpact),
      inputTargetRevision: String(request.inputTargetRevision),
      releaseTrain: String(request.releaseTrain),
      selectedVersion: nullableText(versionDecision?.selectedVersion),
      suggestedVersion: nullableText(versionDecision?.suggestedVersion),
      transactionId: String(request.transactionId),
      versionLine: line,
      versionOwner: policy.versionOwner,
    }),
    effectivePolicyDigest: policyDigest,
    evidence:
      version === 2 && line
        ? [...evidence, versionLineEvidence(line)]
        : evidence,
    observedAt: now.toISOString().replace(MILLISECONDS_PATTERN, "Z"),
    paths: digests,
    phase,
    provider: "simple-changelogs",
    release: releaseFor(findings, prior, phase, version),
    releaseImpact: findings.releaseImpact,
    releaseSetId: request.releaseSetId ?? null,
    ...(version === 2
      ? {}
      : { releaseSetTrains: request.releaseSetTrains ?? null }),
    revisionLineage: lineageFor(findings, prior, request),
    schemaVersion: version,
    sourceRevision:
      phase === "verify"
        ? request.finalizedTargetRevision
        : request.inputTargetRevision,
    status: text(findings.status, "findings.status"),
    transactionId: request.transactionId,
    versionDecision,
    ...reasonFields(findings),
  };
};

const git = (repo: string, args: string[]): Buffer => {
  const result = spawnSync({
    cmd: ["git", "-C", repo, ...args],
    stderr: "pipe",
    stdout: "pipe",
  });
  if (!result.success) {
    throw new CliError(
      `git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`
    );
  }
  return result.stdout;
};

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/** The receipt `paths` entries for files in the working tree or at `rev`. */
export const pathDigests = async (
  repo: string,
  paths: string[],
  rev: string | null
): Promise<{ digest: string; path: string }[]> =>
  await Promise.all(
    paths.map(async (path) => {
      receiptPath(path);
      const bytes =
        rev === null
          ? await readFile(join(repo, path))
          : git(repo, ["cat-file", "blob", `${rev}:${path}`]);
      return { digest: sha256(bytes), path };
    })
  );

const readJson = async (file: string | undefined): Promise<unknown> => {
  const source =
    file === undefined || file === "-"
      ? await stdin.text()
      : await readFile(file, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new CliError(`${file ?? "stdin"} is not valid JSON`, {
      cause: error,
    });
  }
};

const providedReceiptVersions = async (): Promise<unknown> => {
  const marker = join(import.meta.dir, "..", "changelog-provider.json");
  if (!existsSync(marker)) {
    throw new CliError(
      `${marker} is missing; run the copy installed beside a changelog-provider.json`
    );
  }
  const value = JSON.parse(await readFile(marker, "utf8")) as unknown;
  return isRecord(value) ? value.receiptVersions : undefined;
};

interface Parsed {
  flags: Map<string, string>;
  positional: string[];
}

const VALUE_FLAGS = new Set([
  "--findings",
  "--prior",
  "--repo",
  "--request",
  "--rev",
]);

const parseArgs = (argv: string[]): Parsed => {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new CliError(`Missing value for ${arg}`);
      }
      flags.set(arg, value);
      index += 1;
    } else if (arg.startsWith("--")) {
      throw new CliError(`Unknown option: ${arg}\n\n${USAGE}`);
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
};

const runDigest = async (
  kind: string | undefined,
  rest: string[],
  flags: Map<string, string>,
  repo: string
): Promise<string> => {
  if (kind === "paths") {
    if (rest.length === 0) {
      throw new CliError("digest paths needs at least one PATH");
    }
    return JSON.stringify(
      await pathDigests(repo, rest, flags.get("--rev") ?? null),
      null,
      2
    );
  }
  if (rest.length > 1) {
    throw new CliError(`Unexpected extra argument: ${rest[1]}`);
  }
  const value = await readJson(rest[0]);
  switch (kind) {
    case "json": {
      return digestCanonicalJson(value);
    }
    case "policy": {
      return effectivePolicyDigest(policyInput(value));
    }
    case "decision": {
      return decisionDigest(decisionInput(value));
    }
    default: {
      throw new CliError(
        `digest needs json, policy, decision, or paths\n\n${USAGE}`
      );
    }
  }
};

const runReceipt = async (
  flags: Map<string, string>,
  repo: string
): Promise<string> => {
  const requestFile = flags.get("--request");
  const findingsFile = flags.get("--findings");
  if (requestFile === undefined || findingsFile === undefined) {
    throw new CliError("receipt needs --request FILE and --findings FILE");
  }
  const priorFile = flags.get("--prior");
  const [request, findings, prior, providedVersions] = await Promise.all([
    readJson(requestFile),
    readJson(findingsFile),
    priorFile === undefined ? Promise.resolve(null) : readJson(priorFile),
    providedReceiptVersions(),
  ]);
  const paths = isRecord(findings)
    ? strings(findings.paths, "findings.paths")
    : [];
  const head = isRecord(findings)
    ? textOrNull(
        findings.reconciliationHeadRevision,
        "reconciliationHeadRevision"
      )
    : null;
  const receipt = assembleReceipt({
    findings,
    now: new Date(),
    pathDigests: await pathDigests(repo, paths, head),
    prior,
    providedVersions,
    request,
  });
  return JSON.stringify(receipt, null, 2);
};

export const run = async (argv: string[]): Promise<number> => {
  const [command, ...rest] = argv;
  if (command === undefined) {
    throw new CliError(USAGE);
  }
  if (["help", "--help", "-h"].includes(command)) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const { flags, positional } = parseArgs(rest);
  const repo = resolve(flags.get("--repo") ?? process.cwd());
  let output: string;
  if (command === "digest") {
    output = await runDigest(positional[0], positional.slice(1), flags, repo);
  } else if (command === "receipt" && positional.length === 0) {
    output = await runReceipt(flags, repo);
  } else {
    throw new CliError(`Unknown command: ${argv.join(" ")}\n\n${USAGE}`);
  }
  process.stdout.write(`${output}\n`);
  return 0;
};

if (import.meta.main) {
  try {
    process.exitCode = await run(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
