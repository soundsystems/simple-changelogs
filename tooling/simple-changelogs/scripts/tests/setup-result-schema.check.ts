import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ApplyOptions, applySetup, inspectRepository } from "../setup.ts";

type Schema = Record<string, unknown>;

const isObject = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const TYPE_CHECKS: Record<string, (value: unknown) => boolean> = {
  array: Array.isArray,
  boolean: (value) => typeof value === "boolean",
  integer: Number.isInteger,
  null: (value) => value === null,
  object: isObject,
  string: (value) => typeof value === "string",
};

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const setupResultSchema = JSON.parse(
  await readFile(
    new URL("../../evals/schemas/setup-result.schema.json", import.meta.url),
    "utf8"
  )
) as Schema;

type Check = (schema: Schema, value: unknown, path: string) => string[];

// Evaluates the draft 2020-12 subset setup-result.schema.json uses: local
// $ref, const, enum, type, allOf/anyOf/oneOf, required, properties,
// additionalProperties, items, min/maxItems, uniqueItems, minLength, pattern,
// and minimum.
const combinatorViolations: Check = (schema, value, path) => {
  const found: string[] = [];
  const matches = (branch: unknown) =>
    violations(branch as Schema, value, path).length === 0;
  for (const branch of (schema.allOf as unknown[] | undefined) ?? []) {
    found.push(...violations(branch as Schema, value, path));
  }
  if (Array.isArray(schema.anyOf) && !schema.anyOf.some(matches)) {
    found.push(`${path} matches no anyOf branch`);
  }
  if (
    Array.isArray(schema.oneOf) &&
    schema.oneOf.filter(matches).length !== 1
  ) {
    found.push(`${path} must match exactly one oneOf branch`);
  }
  return found;
};

const scalarViolations: Check = (schema, value, path) => {
  const found: string[] = [];
  if (typeof value === "string") {
    if (
      typeof schema.minLength === "number" &&
      value.length < schema.minLength
    ) {
      found.push(`${path} is too short`);
    }
    if (
      typeof schema.pattern === "string" &&
      !new RegExp(schema.pattern, "u").test(value)
    ) {
      found.push(`${path} does not match ${schema.pattern}`);
    }
  }
  if (
    typeof value === "number" &&
    typeof schema.minimum === "number" &&
    value < schema.minimum
  ) {
    found.push(`${path} is below ${schema.minimum}`);
  }
  return found;
};

const arrayViolations: Check = (schema, value, path) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const found: string[] = [];
  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    found.push(`${path} has too few items`);
  }
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
    found.push(`${path} has too many items`);
  }
  if (
    schema.uniqueItems === true &&
    new Set(value.map((item) => JSON.stringify(item))).size !== value.length
  ) {
    found.push(`${path} must hold unique items`);
  }
  const { items } = schema;
  if (isObject(items)) {
    found.push(
      ...value.flatMap((item, index) =>
        violations(items, item, `${path}[${index}]`)
      )
    );
  }
  return found;
};

const objectViolations: Check = (schema, value, path) => {
  if (!isObject(value)) {
    return [];
  }
  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = (schema.required as string[] | undefined) ?? [];
  return [
    ...required
      .filter((key) => !Object.hasOwn(value, key))
      .map((key) => `${path}.${key} is required`),
    ...Object.entries(value).flatMap(([key, item]) => {
      const property = properties[key];
      if (isObject(property)) {
        return violations(property, item, `${path}.${key}`);
      }
      return schema.additionalProperties === false
        ? [`${path}.${key} is not allowed`]
        : [];
    }),
  ];
};

function violations(schema: Schema, value: unknown, path = "$"): string[] {
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.replace("#/$defs/", "");
    return violations(
      (setupResultSchema.$defs as Schema)[name] as Schema,
      value,
      path
    );
  }
  const found: string[] = [];
  if ("const" in schema && !same(schema.const, value)) {
    found.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if (
    Array.isArray(schema.enum) &&
    !schema.enum.some((option) => same(option, value))
  ) {
    found.push(`${path} is outside ${JSON.stringify(schema.enum)}`);
  }
  if (
    schema.type !== undefined &&
    ![schema.type].flat().some((type) => TYPE_CHECKS[String(type)]?.(value))
  ) {
    return [...found, `${path} must be ${JSON.stringify(schema.type)}`];
  }
  return [
    ...found,
    ...combinatorViolations(schema, value, path),
    ...scalarViolations(schema, value, path),
    ...arrayViolations(schema, value, path),
    ...objectViolations(schema, value, path),
  ];
}

// The schema governs the JSON the CLI prints, so validate serialized output.
const check = (result: unknown): string[] =>
  violations(setupResultSchema, JSON.parse(JSON.stringify(result)));

const temporaryPaths: string[] = [];
const temporaryDirectory = async (label: string): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), `simple-changelogs-${label}-`));
  temporaryPaths.push(path);
  return path;
};

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true }))
  );
});

const cmsProof = {
  cmsAuthProven: true,
  cmsRoute: "/admin/changelog",
  cmsSurfaceProven: true,
};

describe("setup-result.schema.json", () => {
  test("accepts real inspect and apply outputs for every distribution", async () => {
    const distributions = [
      "full",
      "web",
      "mobile",
      "web-cms",
      "skill-repository",
      "cms",
    ] as const;
    const results = await Promise.all(
      distributions.flatMap((distribution) =>
        (["inspect", "repository", "all-projects"] as const).map(
          async (mode) => {
            const config = await temporaryDirectory("config");
            const repo = await temporaryDirectory("repo");
            if (mode === "inspect") {
              return inspectRepository({
                configDirectory: config,
                distribution,
                repo,
              });
            }
            const options: ApplyOptions = {
              backfillStatus: "not-applicable",
              configDirectory: config,
              confirm: true,
              distribution,
              mobileReleaseNotePlacement:
                distribution === "full" ? "store-only" : undefined,
              repo,
              scope: mode,
              ...(distribution === "cms" || distribution === "web-cms"
                ? cmsProof
                : {}),
            };
            const applied = await applySetup(options);
            expect(applied.status).toBe("configured");
            // The configured repository re-inspects with its stored state,
            // including all-projects global preferences.
            return inspectRepository({
              configDirectory: config,
              distribution,
              repo,
            });
          }
        )
      )
    );

    expect(results.flatMap(check)).toEqual([]);
    expect(
      results.some((result) => result.globalPreferences.value?.publicVersioning)
    ).toBe(true);
    expect(
      results.some((result) => same(result.capabilities?.receiptVersions, [2]))
    ).toBe(true);
  });

  test("accepts web+CMS guidance notices, run-only, and blocked results", async () => {
    const config = await temporaryDirectory("config");
    const repo = await temporaryDirectory("repo");
    await applySetup({
      backfillStatus: "not-applicable",
      configDirectory: config,
      confirm: true,
      distribution: "web-cms",
      repo,
      scope: "repository",
      ...cmsProof,
    });
    const cmsPolicyPath = join(repo, ".simple-changelogs-cms.json");
    const cmsPolicy = JSON.parse(
      await readFile(cmsPolicyPath, "utf8")
    ) as Schema;
    await writeFile(
      cmsPolicyPath,
      JSON.stringify({
        ...cmsPolicy,
        guidance: { backfillStatus: "completed", version: 1 },
      }),
      "utf8"
    );
    const notice = await inspectRepository({
      configDirectory: config,
      distribution: "web-cms",
      repo,
    });
    const blocked = await applySetup({
      configDirectory: config,
      distribution: "web-cms",
      guidanceBackfill: "not-applicable",
      repo,
    });
    const runOnly = await applySetup({
      configDirectory: await temporaryDirectory("config"),
      confirm: true,
      distribution: "web",
      repo: await temporaryDirectory("repo"),
      scope: "run-only",
    });

    expect(notice.guidanceUpdate?.recordedVersion).toBe(1);
    expect(blocked.status).toBe("blocked");
    expect(runOnly.status).toBe("run-only");
    expect([notice, blocked, runOnly].flatMap(check)).toEqual([]);
  });

  test("rejects a CMS policy at guidance version 0 and unknown fields", async () => {
    const config = await temporaryDirectory("config");
    const repo = await temporaryDirectory("repo");
    await applySetup({
      backfillStatus: "not-applicable",
      configDirectory: config,
      confirm: true,
      distribution: "cms",
      repo,
      scope: "repository",
      ...cmsProof,
    });
    const result = await inspectRepository({
      configDirectory: config,
      distribution: "cms",
      repo,
    });
    const value = result.cmsPolicy?.value as unknown as Schema;

    expect(check(result)).toEqual([]);
    expect(
      check({
        ...result,
        cmsPolicy: {
          ...result.cmsPolicy,
          value: {
            ...value,
            guidance: { backfillStatus: "completed", version: 0 },
          },
        },
      }).length
    ).toBeGreaterThan(0);
    expect(check({ ...result, unexpected: true }).length).toBeGreaterThan(0);
  });
});
