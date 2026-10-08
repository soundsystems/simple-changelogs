import { describe, expect, test } from "bun:test";
import { file } from "bun";
import {
  digestCanonicalJson,
  validateChangelogReceipt,
  validateChangelogRequest,
} from "../lib/release-handoff.ts";

// Parity between lib/release-handoff.ts and the vendored Simple Changes
// 0.27.0 request and receipt schemas (request v3 and receipt v4 extend the
// 0.23.0 request v2 and receipt v3). The evaluator below mirrors the
// draft 2020-12 subset the controller's own validator implements (local $ref,
// allOf, if/then/else, anyOf, const, enum, type, required, properties,
// additionalProperties, minProperties, items, min/maxItems, uniqueItems,
// minLength, pattern, minimum, and date-time format).

type Schema = Record<string, unknown>;
type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const loadSchema = async (name: string): Promise<Schema> =>
  (await file(
    new URL(`../../evals/schemas/${name}.schema.json`, import.meta.url)
  ).json()) as Schema;
const [requestSchema, receiptSchema] = await Promise.all([
  loadSchema("changelog-request"),
  loadSchema("changelog-receipt"),
]);

const TYPES: Record<string, (value: unknown) => boolean> = {
  array: Array.isArray,
  boolean: (value) => typeof value === "boolean",
  integer: Number.isInteger,
  null: (value) => value === null,
  number: (value) => typeof value === "number",
  object: isRecord,
  string: (value) => typeof value === "string",
};

const stringValid = (schema: Schema, value: string): boolean =>
  !(
    (typeof schema.minLength === "number" && value.length < schema.minLength) ||
    (typeof schema.pattern === "string" &&
      !new RegExp(schema.pattern, "u").test(value)) ||
    (schema.format === "date-time" &&
      (Number.isNaN(Date.parse(value)) || !value.includes("T")))
  );

const arrayValid = (root: Schema, schema: Schema, value: unknown[]) =>
  !(
    (typeof schema.minItems === "number" && value.length < schema.minItems) ||
    (typeof schema.maxItems === "number" && value.length > schema.maxItems) ||
    (schema.uniqueItems === true &&
      new Set(value.map((item) => JSON.stringify(item))).size !==
        value.length) ||
    (isRecord(schema.items) &&
      !value.every((item) => valid(root, schema.items as Schema, item)))
  );

const objectValid = (root: Schema, schema: Schema, value: Json): boolean => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = (schema.required as string[] | undefined) ?? [];
  const additional = schema.additionalProperties;
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    !(
      typeof schema.minProperties === "number" &&
      Object.keys(value).length < schema.minProperties
    ) &&
    Object.entries(value).every(([key, item]) => {
      if (Object.hasOwn(properties, key)) {
        return valid(root, properties[key] as Schema, item);
      }
      if (additional === false) {
        return false;
      }
      return !isRecord(additional) || valid(root, additional, item);
    })
  );
};

const typedValid = (root: Schema, schema: Schema, value: unknown): boolean => {
  if (typeof value === "string") {
    return stringValid(schema, value);
  }
  if (Array.isArray(value)) {
    return arrayValid(root, schema, value);
  }
  if (isRecord(value)) {
    return objectValid(root, schema, value);
  }
  return !(
    typeof value === "number" &&
    typeof schema.minimum === "number" &&
    value < schema.minimum
  );
};

const anyOfValid = (root: Schema, schema: Schema, value: unknown): boolean =>
  !Array.isArray(schema.anyOf) ||
  schema.anyOf.some((branch) => valid(root, branch as Schema, value));

function valid(root: Schema, schema: Schema, value: unknown): boolean {
  if (typeof schema.$ref === "string") {
    let target: unknown = root;
    for (const part of schema.$ref.slice(2).split("/")) {
      target = (target as Json)[part];
    }
    return valid(root, target as Schema, value);
  }
  for (const branch of (schema.allOf as Schema[] | undefined) ?? []) {
    if (!valid(root, branch, value)) {
      return false;
    }
  }
  if (isRecord(schema.if)) {
    const branch = valid(root, schema.if, value) ? schema.then : schema.else;
    if (isRecord(branch) && !valid(root, branch, value)) {
      return false;
    }
  }
  if (!anyOfValid(root, schema, value)) {
    return false;
  }
  if ("const" in schema && !same(schema.const, value)) {
    return false;
  }
  if (
    Array.isArray(schema.enum) &&
    !schema.enum.some((option) => same(option, value))
  ) {
    return false;
  }
  if (typeof schema.type === "string" && !TYPES[schema.type]?.(value)) {
    return false;
  }
  return typedValid(root, schema, value);
}

// --- Fixtures: every base is valid under both the schema and the rules. ---

const REVISION = "0123456789abcdef0123456789abcdef01234567";
const DIGEST = "a".repeat(64);

const requestV1 = (phase: "classify" | "prepare" | "verify") => ({
  approvedDecisionDigest: phase === "classify" ? null : DIGEST,
  approvedVersion: phase === "classify" ? null : "1.0.0",
  boundary: "web-production",
  finalizedTargetRevision: phase === "verify" ? REVISION : null,
  inputTargetRevision: REVISION,
  mutationScope: phase === "prepare" ? "prepare-release-files" : "read-only",
  phase,
  priorReceiptDigest: phase === "classify" ? null : DIGEST,
  releaseSetId: null,
  releaseTrain: "mobile",
  schemaVersion: 1,
  supportedReceiptVersions: [1, 2],
  transactionId: "release-01",
});
const requestV2 = (phase: "classify" | "prepare" | "verify") => ({
  ...requestV1(phase),
  attempt: 2,
  environment: "production",
  releaseSetId: "set-01",
  releaseSetTrains: ["mobile", "web"],
  schemaVersion: 2,
  supportedReceiptVersions: [2, 3],
});
const requestV3 = (phase: "classify" | "prepare" | "verify") => ({
  ...requestV2(phase),
  schemaVersion: 3,
  supportedReceiptVersions: [2, 3, 4],
});

const LINE = {
  members: ["mobile", "web"],
  memberVersions: { mobile: "0.21.3", web: "1.0.0" },
  mode: "catch-up",
  outcome: "catch-up",
  sharedVersion: "1.0.0",
  sharedVersionTrains: ["web"],
};
const decision = (fields: Json = {}) => ({
  boundary: "web-production",
  bumpLevel: "major",
  currentVersion: "0.21.3",
  policyAction: "ask",
  releaseTrain: "mobile",
  resolution: "approval-required",
  selectedVersion: null,
  source: "repository-policy",
  suggestedVersion: "1.0.0",
  ...fields,
});
const ENTRY = {
  boundary: "none",
  bumpLevel: "none",
  currentVersion: null,
  policyAction: "not-applicable",
  releaseTrain: "cms-operators",
  resolution: "not-required",
  selectedVersion: null,
  source: "repository-policy",
  suggestedVersion: null,
};
const receiptV2 = (fields: Json = {}) => ({
  checks: ["Inspected the exact target."],
  decisionDigest: DIGEST,
  effectivePolicyDigest: DIGEST,
  evidence: ["Aggregate impact is patch."],
  observedAt: "2026-10-02T12:00:00-05:00",
  paths: [],
  phase: "classify",
  provider: "simple-changelogs",
  reason: "Choose the public version.",
  reasonCode: "version-direction-required",
  release: null,
  releaseImpact: "patch",
  releaseSetId: null,
  requiredAction: "choose-version",
  revisionLineage: {
    finalizedTargetRevision: null,
    inputTargetRevision: REVISION,
    reconciliationHeadRevision: null,
  },
  schemaVersion: 2,
  sourceRevision: REVISION,
  status: "decision-required",
  transactionId: "release-01",
  versionDecision: decision(),
  ...fields,
});
const released = (state: "prepared" | "integrated") => ({
  paths: state === "prepared" ? [{ digest: DIGEST, path: "CHANGELOG.md" }] : [],
  phase: state === "prepared" ? "prepare" : "verify",
  reason: null,
  reasonCode: null,
  release: {
    date: "2026-10-02",
    targetContainedUnreleased: state,
    version: "1.0.0",
  },
  requiredAction: null,
  revisionLineage: {
    finalizedTargetRevision: state === "integrated" ? REVISION : null,
    inputTargetRevision: REVISION,
    reconciliationHeadRevision: REVISION,
  },
  status: state === "prepared" ? "prepared" : "verified",
  versionDecision: decision({
    policyAction: "automatic",
    resolution: "automatic",
    selectedVersion: "1.0.0",
  }),
});
const entry = (status: "classified" | "prepared" | "verified") => ({
  paths: status === "prepared" ? [{ digest: DIGEST, path: "CMS.json" }] : [],
  phase: { classified: "classify", prepared: "prepare", verified: "verify" }[
    status
  ],
  reason: null,
  reasonCode: null,
  requiredAction: null,
  revisionLineage: {
    finalizedTargetRevision: status === "verified" ? REVISION : null,
    inputTargetRevision: REVISION,
    reconciliationHeadRevision: status === "classified" ? null : REVISION,
  },
  status,
  versionDecision: ENTRY,
});
const V2_RECEIPTS: Record<string, Json> = {
  blocked: receiptV2({
    reason: "The version owner is ambiguous.",
    reasonCode: "version-owner-ambiguous",
    requiredAction: "resolve-version-owner",
    status: "blocked",
    versionDecision: null,
  }),
  classified: receiptV2(entry("classified")),
  "classified-public": receiptV2({
    ...entry("classified"),
    versionDecision: decision({
      policyAction: "automatic",
      resolution: "automatic",
      selectedVersion: "1.0.0",
    }),
  }),
  "decision-required": receiptV2(),
  "entry-prepared": receiptV2(entry("prepared")),
  "entry-verified": receiptV2(entry("verified")),
  "not-applicable": receiptV2({
    reason: null,
    reasonCode: null,
    releaseImpact: "none",
    requiredAction: null,
    status: "not-applicable",
    versionDecision: { ...ENTRY, releaseTrain: "mobile" },
  }),
  prepared: receiptV2(released("prepared")),
  verified: receiptV2(released("integrated")),
};
const toV3 = (receipt: Json): Json => ({
  ...receipt,
  releaseSetId: "set-01",
  releaseSetTrains: ["mobile", "web"],
  schemaVersion: 3,
  versionDecision: isRecord(receipt.versionDecision)
    ? {
        ...receipt.versionDecision,
        versionLine:
          receipt.versionDecision.boundary === "none" ? null : clone(LINE),
      }
    : null,
});
const V3_RECEIPTS = Object.fromEntries(
  Object.entries(V2_RECEIPTS).map(([name, receipt]) => [name, toV3(receipt)])
);
// Receipt v4 names the release tag; the prepared release also covers the
// no-tag case.
const toV4 = (receipt: Json, tag: Json | null): Json => ({
  ...receipt,
  release: isRecord(receipt.release) ? { ...receipt.release, tag } : null,
  schemaVersion: 4,
});
const TAG = { message: "Acme Mobile 1.0.0", name: "mobile@1.0.0" };
const V4_RECEIPTS: Record<string, Json> = {
  ...Object.fromEntries(
    Object.entries(V3_RECEIPTS).map(([name, receipt]) => [
      name,
      toV4(receipt, TAG),
    ])
  ),
  "prepared-untagged": toV4(V3_RECEIPTS.prepared as Json, null),
};
const REQUESTS: Record<string, Json> = Object.fromEntries(
  (["classify", "prepare", "verify"] as const).flatMap((phase) => [
    [`v1 ${phase}`, requestV1(phase)],
    [`v2 ${phase}`, requestV2(phase)],
    [`v3 ${phase}`, requestV3(phase)],
  ])
);

// --- Mutations: drop, retype, or extend every field one at a time. ---

const VALUES: [string, unknown][] = [
  ["null", null],
  ["empty", ""],
  ["text", "bogus"],
  ["number", 7],
  ["zero", 0],
  ["list", []],
  ["object", {}],
  ["version", "1.0"],
  ["prerelease", "1.0.0-rc.1"],
  ["single", ["web"]],
  ["pair", ["web", "mobile"]],
];
// Tag-shaped values, tried only inside receipt v4's release.tag so every
// earlier result stays pinned.
const TAG_VALUES: [string, unknown][] = [
  ["v-tag", "v1.0.0"],
  ["space", "v 1.0.0"],
  ["dotted", "a..b"],
  ["multiline", "Acme\n1.0.0"],
  ["long", "x".repeat(201)],
];
const NESTED = [
  "",
  "revisionLineage",
  "versionDecision",
  "versionDecision.versionLine",
  "versionDecision.versionLine.memberVersions",
  "release",
  "release.tag",
  "paths.0",
];

const at = (value: unknown, path: string): unknown =>
  path === ""
    ? value
    : path
        .split(".")
        .reduce<unknown>(
          (current, part) => (current as Json | undefined)?.[part],
          value
        );

const mutations = (name: string, base: Json): [string, unknown][] => {
  const found: [string, unknown][] = [];
  for (const path of NESTED) {
    const target = at(base, path);
    if (!isRecord(target)) {
      continue;
    }
    const prefix = path === "" ? "" : `${path}.`;
    const extended = clone(base);
    (at(extended, path) as Json).extra = true;
    found.push([`${name}: ${prefix}extra`, extended]);
    for (const key of Object.keys(target)) {
      const dropped = clone(base);
      delete (at(dropped, path) as Json)[key];
      found.push([`${name}: ${prefix}${key} dropped`, dropped]);
      const values =
        path === "release.tag" ? [...VALUES, ...TAG_VALUES] : VALUES;
      for (const [label, value] of values) {
        const changed = clone(base);
        (at(changed, path) as Json)[key] = clone(value);
        found.push([`${name}: ${prefix}${key}=${label}`, changed]);
      }
    }
  }
  for (const version of [1, 2, 3, 4]) {
    found.push([
      `${name}: schemaVersion ${version}`,
      { ...base, schemaVersion: version },
    ]);
  }
  return found;
};

const FIELD_SUFFIX = /(?:=.*| dropped)$/u;

type Outcome = "accepts" | "rejects" | "throws";
const ours = (
  validate: (value: unknown) => { errors: string[] },
  value: unknown
): { errors: string[]; outcome: Outcome } => {
  try {
    const { errors } = validate(value);
    return { errors, outcome: errors.length === 0 ? "accepts" : "rejects" };
  } catch {
    return { errors: [], outcome: "throws" };
  }
};

// Rule-level refusals the schema cannot express. Any other message on a
// schema-valid input would be a structural disagreement.
const RULE_MESSAGES = [
  "releaseSetTrains requires a releaseSetId",
  "reasonCode and requiredAction must both be null or non-null",
  "internal-only or non-public work must be not-applicable",
  "invariants failed",
  "normal version approval must be decision-required",
  "resolved version decisions require selectedVersion",
  "unknown impact cannot resolve automatically",
  "release version must be the selected version",
  "versionLine members must be sorted",
  "must be recomputed from memberVersions",
  "bump-shared always advances",
  "catches up",
  "is not a stable dotted version",
  "must exceed the train's own",
  "does not fit",
  "is below the current version",
  "release tag",
  "the release tag changed after prepare",
];
const ruleOnly = (errors: string[]): boolean =>
  errors.every((error) => RULE_MESSAGES.some((rule) => error.includes(rule)));

interface Case {
  current: boolean;
  label: string;
  ours: { errors: string[]; outcome: Outcome };
  schema: boolean;
  value: unknown;
}
const cases = (
  bases: Record<string, Json>,
  schema: Schema,
  validate: (value: unknown) => { errors: string[] }
): Case[] =>
  Object.entries(bases).flatMap(([name, base]) =>
    [
      [`${name}: base`, base] as [string, unknown],
      ...mutations(name, base),
    ].map(([label, value]) => ({
      // Public classification is repaired in receipt v2 as well as v3.
      current:
        isRecord(value) &&
        (label.startsWith("classified-public:") ||
          value.schemaVersion === 3 ||
          value.schemaVersion === 4 ||
          (value.schemaVersion === 2 && "supportedReceiptVersions" in value)),
      label,
      ours: ours(validate, value),
      schema: valid(schema, schema, value),
      value,
    }))
  );

const requestCases = cases(REQUESTS, requestSchema, validateChangelogRequest);
const receiptCases = cases(
  {
    ...V2_RECEIPTS,
    ...Object.fromEntries(
      Object.entries(V3_RECEIPTS).map(([name, receipt]) => [
        `v3 ${name}`,
        receipt,
      ])
    ),
    ...Object.fromEntries(
      Object.entries(V4_RECEIPTS).map(([name, receipt]) => [
        `v4 ${name}`,
        receipt,
      ])
    ),
  },
  receiptSchema,
  (value) => validateChangelogReceipt(value)
);
const all = [...requestCases, ...receiptCases];

// Apart from classified lineage and resolved public classification, request v1
// and receipt v2 retain their original checks. Those never were a full schema
// validator: these are the fields where the
// corpus finds the schema refusing an input they accept, with case counts.
// Requests v2 and v3 and receipts v3 and v4 have none.
const LEGACY_GAPS: Record<string, number> = {
  "receipt v2: observedAt": 88,
  "receipt v2: paths": 1,
  "receipt v2: paths.0.extra": 2,
  "receipt v2: reason": 50,
  "receipt v2: release": 2,
  "receipt v2: release.date": 24,
  "receipt v2: release.extra": 2,
  "receipt v2: release.version": 9,
  "receipt v2: releaseImpact": 77,
  "receipt v2: releaseSetId": 56,
  "receipt v2: revisionLineage": 3,
  "receipt v2: revisionLineage.extra": 8,
  "receipt v2: revisionLineage.finalizedTargetRevision": 55,
  "receipt v2: revisionLineage.inputTargetRevision": 96,
  "receipt v2: revisionLineage.reconciliationHeadRevision": 57,
  "receipt v2: transactionId": 64,
  "receipt v2: versionDecision": 2,
  "receipt v2: versionDecision.boundary": 36,
  "receipt v2: versionDecision.bumpLevel": 36,
  "receipt v2: versionDecision.currentVersion": 56,
  "receipt v2: versionDecision.extra": 7,
  "receipt v2: versionDecision.policyAction": 60,
  "receipt v2: versionDecision.releaseTrain": 63,
  "receipt v2: versionDecision.resolution": 36,
  "receipt v2: versionDecision.selectedVersion": 5,
  "receipt v2: versionDecision.source": 84,
  "receipt v2: versionDecision.suggestedVersion": 24,
  "request v1: approvedDecisionDigest": 2,
  "request v1: approvedVersion": 3,
};
// The unchanged subset was independently computed from origin/main's validator.
// Classified outcomes now reject a missing neutral decision or missing and
// prepared/finalized lineage; their
// deliberate stricter behavior is pinned separately.
const LEGACY_UNCHANGED_RESULTS_DIGEST =
  "0600b695e7f0d12078ecf56b61f4d889644a3ea7ba094bf87bfbc87b8d89d2da";
const CLASSIFIED_RESULTS_DIGEST =
  "fdf9391a4c433dc9ecb1d7df8b28fcfbe4fc727f7129f31cbde2617375036e9e";

// Request v3 and receipt v4 bases are new: their mutations into earlier
// versions are new inputs, not changed legacy behavior, so the pins below
// cover only the bases they always covered.
const NEW_BASES = new Set([
  ...(["classify", "prepare", "verify"] as const).map((phase) => `v3 ${phase}`),
  ...Object.keys(V4_RECEIPTS).map((name) => `v4 ${name}`),
]);
const legacy = all.filter(
  ({ current, label }) =>
    !(
      current ||
      label.includes("classified-public:") ||
      NEW_BASES.has(label.split(": ")[0] ?? "")
    )
);
const gapSummary = (): Record<string, number> => {
  const summary: Record<string, number> = {};
  for (const { label, ours: result, schema } of legacy) {
    if (schema || result.outcome === "rejects") {
      continue;
    }
    const [base = "", field = ""] = label.split(": ");
    const key = `${base.startsWith("v1") ? "request v1" : "receipt v2"}: ${field.replace(FIELD_SUFFIX, "")}${result.outcome === "throws" ? " (throws)" : ""}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  return summary;
};

describe("protocol schema parity (Simple Changes 0.27.0)", () => {
  test("every base fixture is accepted by both the schema and the validator", () => {
    const bases = all.filter(({ label }) => label.endsWith(": base"));
    expect(bases.length).toBe(
      Object.keys(REQUESTS).length +
        Object.keys(V2_RECEIPTS).length * 2 +
        Object.keys(V4_RECEIPTS).length
    );
    expect(
      bases
        .filter(
          ({ ours: result, schema }) => !schema || result.outcome !== "accepts"
        )
        .map(({ label }) => label)
    ).toEqual([]);
  });

  test("requests v2 and v3 and receipts v3 and v4 never accept what the schema refuses or throw", () => {
    const current = all.filter((item) => item.current);
    expect(current.length).toBeGreaterThan(4000);
    expect(
      current
        .filter(
          ({ ours: result, schema }) =>
            result.outcome === "throws" ||
            (!schema && result.outcome === "accepts")
        )
        .map(({ label }) => label)
    ).toEqual([]);
  });

  test("every schema-valid refusal is a protocol rule, never a structural disagreement", () => {
    expect(
      all
        .filter(
          ({ ours: result, schema }) =>
            schema && result.outcome === "rejects" && !ruleOnly(result.errors)
        )
        .map(
          ({ label, ours: result }) => `${label} -> ${result.errors.join("; ")}`
        )
    ).toEqual([]);
  });

  test("pins unchanged legacy results separately from the stricter classified lineage", () => {
    expect(legacy.length).toBeGreaterThan(3000);
    expect(gapSummary()).toEqual(LEGACY_GAPS);
    expect(
      digestCanonicalJson(
        legacy
          .filter(({ label }) => !label.startsWith("classified:"))
          .map(({ label, ours: result }) => [
            label,
            result.outcome,
            result.errors,
          ])
      )
    ).toBe(LEGACY_UNCHANGED_RESULTS_DIGEST);
    expect(
      digestCanonicalJson(
        legacy
          .filter(({ label }) => label.startsWith("classified:"))
          .map(({ label, ours: result }) => [
            label,
            result.outcome,
            result.errors,
          ])
      )
    ).toBe(CLASSIFIED_RESULTS_DIGEST);
  });
});
