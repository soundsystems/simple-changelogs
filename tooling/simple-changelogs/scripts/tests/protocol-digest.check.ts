import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { file } from "bun";

// Expected canonical-JSON SHA-256 digests of the vendored Simple Changes
// protocol schemas. The consumer (simple-changes) owns these schemas; the
// copies under evals/schemas and skills/*/schemas must stay byte-exact with
// skills/simple-changes/evals/schemas in the simple-changes repository, or
// digest negotiation fails with schema-digest-mismatch. When this check
// fails, resync the vendored copies from simple-changes and update these
// digests to the values reported in the failure message.
const EXPECTED_DIGESTS: Record<string, string> = {
  "changelog-capabilities.schema.json":
    "97561afe44a00613bfbe8bbb55e62917915034758ec6bb38ded33ffae9cde1f3",
  "changelog-receipt.schema.json":
    "7abe2ca338d12ca88c2dad03e904fa451dc6424fda9497bb4331845431416f93",
  "changelog-request.schema.json":
    "b5bbccd66631ead9029834a675ed2144de895b1ee3ef50abedfa424650b0e7e5",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonicalJson = (value: unknown): string => {
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

const digestSchema = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

describe("protocol schema digests", () => {
  for (const [filename, expected] of Object.entries(EXPECTED_DIGESTS)) {
    test(`keeps ${filename} in sync with the simple-changes consumer`, async () => {
      const schema = (await file(
        new URL(`../../evals/schemas/${filename}`, import.meta.url)
      ).json()) as unknown;
      const actual = digestSchema(schema);
      expect(
        actual,
        [
          `Vendored schema ${filename} drifted from its recorded digest.`,
          "The Simple Changes consumer owns this schema. Resync the copy in",
          "tooling/simple-changelogs/evals/schemas (and skills/*/schemas) from",
          "skills/simple-changes/evals/schemas in the simple-changes repo,",
          `then record the new digest here: ${actual}`,
        ].join("\n")
      ).toBe(expected);
    });
  }
});
