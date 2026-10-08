import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import {
  type AuthoringSidecar,
  applySetup,
  detectHarnesses,
  inspectRepository,
  loadHarnesses,
  resolveAuthoring,
  resolveAuthoringPaths,
  type SetupResult,
  validateAuthoring,
} from "../setup.ts";

// Authoring preferences (design section 4): the sidecar validator, harness
// detection from the data file, resolution with provenance, the pending
// question, and the standalone apply --authoring transaction. Detection uses
// a fixture data file with neutral harness ids, so nothing here depends on
// the machine's real home directory or on the harness running the tests.

const REPOSITORY_ROOT = join(import.meta.dir, "..", "..", "..", "..");
const SETUP = join(import.meta.dir, "..", "setup.ts");
const SCHEMA_PATH = join(
  REPOSITORY_ROOT,
  "skills",
  "simple-changelogs",
  "schemas",
  "authoring.schema.json"
);
const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true }))
  );
});

const temporaryDirectory = async (label: string): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), `simple-changelogs-${label}-`));
  temporaryPaths.push(path);
  return path;
};

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const FIXTURE_HARNESSES = {
  harnesses: {
    "alpha-agent": {
      homeRoots: [".alpha"],
      name: "Alpha Agent",
      sessionEnv: ["ALPHA_SESSION_ID"],
    },
    "beta-agent": {
      homeRoots: [".beta", ".beta-legacy"],
      name: "Beta Agent",
      sessionEnv: ["BETA_THREAD_ID"],
    },
    gamma: { homeRoots: [".gamma"], name: "Gamma", sessionEnv: [] },
  },
  schemaVersion: 1,
};

interface AuthoringFixture {
  config: string;
  dataPath: string;
  environment: Record<string, string | undefined>;
  repo: string;
  roots: string;
}

const authoringFixture = async (
  options: { running?: "alpha" | "beta" | null; roots?: string[] } = {}
): Promise<AuthoringFixture> => {
  const [config, repo, roots, data] = await Promise.all([
    temporaryDirectory("config"),
    temporaryDirectory("repo"),
    temporaryDirectory("roots"),
    temporaryDirectory("data"),
  ]);
  const dataPath = join(data, "harnesses.json");
  await writeJson(dataPath, FIXTURE_HARNESSES);
  await Promise.all(
    (options.roots ?? []).map((root) =>
      mkdir(join(roots, root), { recursive: true })
    )
  );
  const environment: Record<string, string | undefined> = {
    SIMPLE_CHANGELOGS_HARNESS_ROOTS: roots,
  };
  if (options.running === "alpha") {
    environment.ALPHA_SESSION_ID = "session-a";
  } else if (options.running === "beta") {
    environment.BETA_THREAD_ID = "thread-b";
  }
  return { config, dataPath, environment, repo, roots };
};

const inspectFixture = (
  fixture: AuthoringFixture,
  overrides: Partial<Parameters<typeof inspectRepository>[0]> = {}
): Promise<SetupResult> =>
  inspectRepository({
    configDirectory: fixture.config,
    distribution: "web",
    environment: fixture.environment,
    harnessDataPath: fixture.dataPath,
    repo: fixture.repo,
    taskMode: "write",
    ...overrides,
  });

const applyAuthoring = (
  fixture: AuthoringFixture,
  authoring: unknown,
  overrides: Partial<Parameters<typeof applySetup>[0]> = {}
): Promise<SetupResult> =>
  applySetup({
    authoring,
    configDirectory: fixture.config,
    confirm: true,
    distribution: "web",
    environment: fixture.environment,
    harnessDataPath: fixture.dataPath,
    repo: fixture.repo,
    scope: "repository",
    ...overrides,
  });

const configuredPolicy = {
  developerChangelog: "required",
  distribution: "web",
  guidance: { backfillStatus: "not-applicable", version: 24 },
  newReleaseNoteSurfaces: "ask",
  releaseTags: "none",
  schemaVersion: 1,
  signatures: "agent-and-timestamp",
};

const EMPTY_SIDECAR = { harnesses: {}, roles: {}, schemaVersion: 1 };

// Each case: a sidecar and whether it is valid. `keyOnly` cases are harness
// ids the schema cannot check (JSON Schema here validates values, and the
// validator checks object keys by pattern).
const VALIDATION_TABLE: {
  keyOnly?: boolean;
  name: string;
  valid: boolean;
  value: unknown;
}[] = [
  { name: "empty sidecar", valid: true, value: EMPTY_SIDECAR },
  {
    name: "recommended answer",
    valid: true,
    value: {
      harnesses: { "alpha-agent": { effort: "xhigh", model: "most-capable" } },
      roles: { "release-notes": { harness: "running" } },
      schemaVersion: 1,
    },
  },
  {
    name: "unknown but valid harness id",
    valid: true,
    value: {
      harnesses: { "my-own-agent-2": { model: "house-model" } },
      roles: {},
      schemaVersion: 1,
    },
  },
  {
    name: "null entry",
    valid: true,
    value: { harnesses: { gamma: null }, roles: {}, schemaVersion: 1 },
  },
  {
    name: "explicit max effort",
    valid: true,
    value: {
      harnesses: { gamma: { effort: "max", model: "big-model" } },
      roles: {},
      schemaVersion: 1,
    },
  },
  {
    name: "role-level model with a concrete harness",
    valid: true,
    value: {
      harnesses: {},
      roles: {
        "release-notes": {
          effort: "high",
          harness: "beta-agent",
          model: "writer-1",
        },
      },
      schemaVersion: 1,
    },
  },
  {
    name: "role-level effort without a model on running",
    valid: true,
    value: {
      harnesses: {},
      roles: { "release-notes": { effort: "medium", harness: "running" } },
      schemaVersion: 1,
    },
  },
  {
    name: "role-level model with running",
    valid: false,
    value: {
      harnesses: {},
      roles: { "release-notes": { harness: "running", model: "writer-1" } },
      schemaVersion: 1,
    },
  },
  {
    keyOnly: true,
    name: "invalid harness id key",
    valid: false,
    value: {
      harnesses: { "Bad Id": { model: "x" } },
      roles: {},
      schemaVersion: 1,
    },
  },
  {
    name: "invalid harness id as a role target",
    valid: false,
    value: {
      harnesses: {},
      roles: { "release-notes": { harness: "-dash-first" } },
      schemaVersion: 1,
    },
  },
  {
    name: "unknown effort",
    valid: false,
    value: {
      harnesses: { gamma: { effort: "ultra", model: "x" } },
      roles: {},
      schemaVersion: 1,
    },
  },
  {
    name: "model with a newline",
    valid: false,
    value: {
      harnesses: { gamma: { model: "line\nbreak" } },
      roles: {},
      schemaVersion: 1,
    },
  },
  {
    name: "model longer than 120 characters",
    valid: false,
    value: {
      harnesses: { gamma: { model: "m".repeat(121) } },
      roles: {},
      schemaVersion: 1,
    },
  },
  {
    name: "empty model",
    valid: false,
    value: { harnesses: { gamma: { model: "" } }, roles: {}, schemaVersion: 1 },
  },
  {
    name: "harness entry without a model",
    valid: false,
    value: {
      harnesses: { gamma: { effort: "high" } },
      roles: {},
      schemaVersion: 1,
    },
  },
  {
    name: "nested unknown key in a harness entry",
    valid: false,
    value: {
      harnesses: { gamma: { launch: "cmd", model: "x" } },
      roles: {},
      schemaVersion: 1,
    },
  },
  {
    name: "nested unknown key in a role",
    valid: false,
    value: {
      harnesses: {},
      roles: { "release-notes": { harness: "running", sign: true } },
      schemaVersion: 1,
    },
  },
  {
    name: "review-only flag on the release-notes role",
    valid: false,
    value: {
      harnesses: {},
      roles: { "release-notes": { adversarial: true, harness: "gamma" } },
      schemaVersion: 1,
    },
  },
  {
    name: "a Simple Changes role",
    valid: false,
    value: {
      harnesses: {},
      roles: { review: { harness: "running" } },
      schemaVersion: 1,
    },
  },
  {
    name: "unknown top-level key",
    valid: false,
    value: { ...EMPTY_SIDECAR, models: ["x"] },
  },
  {
    name: "missing harnesses",
    valid: false,
    value: { roles: {}, schemaVersion: 1 },
  },
  {
    name: "schema version 2",
    valid: false,
    value: { ...EMPTY_SIDECAR, schemaVersion: 2 },
  },
  {
    name: "a role without a harness",
    valid: false,
    value: {
      harnesses: {},
      roles: { "release-notes": { model: "x" } },
      schemaVersion: 1,
    },
  },
  { name: "not an object", valid: false, value: ["x"] },
];

type Schema = Record<string, unknown>;
const isObject = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The JSON Schema subset the authoring schema uses: local $ref, const, enum,
// type, anyOf, if/then, required, properties, additionalProperties, pattern,
// minLength, and maxLength.
type SchemaCheck = (
  root: Schema,
  schema: Schema,
  value: unknown,
  path: string
) => string[];

const TYPES: Record<string, (candidate: unknown) => boolean> = {
  boolean: (candidate) => typeof candidate === "boolean",
  null: (candidate) => candidate === null,
  object: isObject,
  string: (candidate) => typeof candidate === "string",
};

const stringErrors = (schema: Schema, value: string, path: string): string[] =>
  [
    typeof schema.minLength === "number" && value.length < schema.minLength
      ? `${path} minLength`
      : "",
    typeof schema.maxLength === "number" && value.length > schema.maxLength
      ? `${path} maxLength`
      : "",
    typeof schema.pattern === "string" &&
    !new RegExp(schema.pattern, "u").test(value)
      ? `${path} pattern`
      : "",
  ].filter(Boolean);

const propertyErrors: SchemaCheck = (root, schema, value, path) => {
  if (!isObject(value)) {
    return [];
  }
  const errors = ((schema.required as string[] | undefined) ?? [])
    .filter((key) => !Object.hasOwn(value, key))
    .map((key) => `${path}.${key} required`);
  const properties = (schema.properties as Schema | undefined) ?? {};
  for (const [key, item] of Object.entries(value)) {
    const nested = properties[key] ?? schema.additionalProperties;
    if (isObject(nested)) {
      errors.push(...schemaErrors(root, nested, item, `${path}.${key}`));
    } else if (nested === false) {
      errors.push(`${path}.${key} additional`);
    }
  }
  const applies =
    isObject(schema.if) &&
    schemaErrors(root, schema.if, value, path).length === 0;
  if (applies && isObject(schema.then)) {
    errors.push(...schemaErrors(root, schema.then, value, path));
  }
  return errors;
};

const resolveReference = (root: Schema, reference: string): Schema =>
  reference
    .slice(2)
    .split("/")
    .reduce<unknown>(
      (node, part) => (isObject(node) ? node[part] : undefined),
      root
    ) as Schema;

const schemaErrors: SchemaCheck = (root, schema, value, path) => {
  if (typeof schema.$ref === "string") {
    return schemaErrors(root, resolveReference(root, schema.$ref), value, path);
  }
  if (typeof schema.type === "string" && !TYPES[schema.type]?.(value)) {
    return [`${path} type`];
  }
  const errors = [
    "const" in schema && value !== schema.const ? `${path} const` : "",
    Array.isArray(schema.enum) && !schema.enum.includes(value)
      ? `${path} enum`
      : "",
    Array.isArray(schema.anyOf) &&
    !schema.anyOf.some(
      (branch) => schemaErrors(root, branch as Schema, value, path).length === 0
    )
      ? `${path} anyOf`
      : "",
  ].filter(Boolean);
  if (typeof value === "string") {
    errors.push(...stringErrors(schema, value, path));
  }
  return [...errors, ...propertyErrors(root, schema, value, path)];
};

describe("authoring sidecar validation", () => {
  test("accepts and rejects every case of the validation table, naming paths", () => {
    for (const { name, valid, value } of VALIDATION_TABLE) {
      const result = validateAuthoring(value);
      expect({ name, valid: result.value !== undefined }).toEqual({
        name,
        valid,
      });
      if (!valid) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    }
    expect(
      validateAuthoring({
        harnesses: { gamma: { launch: "cmd", model: "x" } },
        roles: { "release-notes": { harness: "running", model: "y" } },
        schemaVersion: 1,
      }).errors
    ).toEqual([
      'roles.release-notes.model requires a concrete harness id, never "running"',
      "harnesses.gamma.launch is not allowed",
    ]);
  });

  test("the packaged schema agrees with the validator on every value case", async () => {
    const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8")) as Schema;
    for (const { keyOnly, name, valid, value } of VALIDATION_TABLE) {
      if (keyOnly) {
        continue;
      }
      expect({
        name,
        valid: schemaErrors(schema, schema, value, "$").length === 0,
      }).toEqual({ name, valid });
    }
  });
});

describe("harness data and detection", () => {
  test("loads the packaged data file and detects only existing roots and set session variables", async () => {
    const packaged = await loadHarnesses();
    expect(packaged.length).toBeGreaterThan(0);
    const fixture = await authoringFixture({
      roots: [".beta-legacy", ".gamma"],
      running: "alpha",
    });
    const definitions = await loadHarnesses(fixture.dataPath);
    expect(detectHarnesses(definitions, fixture.environment)).toEqual({
      detected: [
        {
          evidence: ["running session (ALPHA_SESSION_ID)"],
          id: "alpha-agent",
          name: "Alpha Agent",
        },
        {
          evidence: [`harness root (${join(fixture.roots, ".beta-legacy")})`],
          id: "beta-agent",
          name: "Beta Agent",
        },
        {
          evidence: [`harness root (${join(fixture.roots, ".gamma")})`],
          id: "gamma",
          name: "Gamma",
        },
      ],
      running: "alpha-agent",
    });
    // An empty session variable identifies nothing.
    expect(
      detectHarnesses(definitions, {
        ALPHA_SESSION_ID: "  ",
        SIMPLE_CHANGELOGS_HARNESS_ROOTS: fixture.roots,
      }).running
    ).toBeNull();
  });

  test("fails closed on a missing or malformed data file", async () => {
    const fixture = await authoringFixture();
    await expect(
      loadHarnesses(join(fixture.roots, "absent.json"))
    ).rejects.toThrow("missing or unreadable");
    const malformedFiles = [
      {
        harnesses: { "Bad Id": { homeRoots: [], name: "x", sessionEnv: [] } },
        schemaVersion: 1,
      },
      {
        harnesses: {
          ok: { homeRoots: ["../escape"], name: "x", sessionEnv: [] },
        },
        schemaVersion: 1,
      },
      {
        harnesses: { ok: { homeRoots: ["/abs"], name: "x", sessionEnv: [] } },
        schemaVersion: 1,
      },
      {
        harnesses: { ok: { homeRoots: [], name: "", sessionEnv: [] } },
        schemaVersion: 1,
      },
      {
        harnesses: { ok: { homeRoots: [], name: "x", sessionEnv: ["lower"] } },
        schemaVersion: 1,
      },
      {
        harnesses: {
          ok: { extra: 1, homeRoots: [], name: "x", sessionEnv: [] },
        },
        schemaVersion: 1,
      },
      { harnesses: {}, schemaVersion: 2 },
    ];
    const outcomes = await Promise.all(
      malformedFiles.map(async (malformed, index) => {
        const path = join(fixture.roots, `malformed-${index}.json`);
        await writeJson(path, malformed);
        return loadHarnesses(path).then(
          () => "loaded",
          (error: Error) => error.message
        );
      })
    );
    for (const outcome of outcomes) {
      expect(outcome).toContain("is malformed");
    }
    await writeJson(fixture.dataPath, malformedFiles[0]);
    const inspection = await inspectFixture(fixture);
    expect(inspection.detectedHarnesses).toEqual([]);
    expect(inspection.errors.join(" ")).toContain("harness data file");
    const refused = await applyAuthoring(fixture, EMPTY_SIDECAR);
    expect(refused.status).toBe("blocked");
    expect(refused.writes).toEqual([]);
    expect(refused.authoringFiles.repository.state).toBe("absent");
  });
});

const sidecar = (
  harnesses: AuthoringSidecar["harnesses"],
  roles: AuthoringSidecar["roles"] = {}
): AuthoringSidecar => ({ harnesses, roles, schemaVersion: 1 });

describe("authoring resolution", () => {
  const repositoryLayer = (value: AuthoringSidecar) => ({
    layer: "repository" as const,
    path: "/repo/.simple-changelogs-authoring.json",
    value,
  });
  const personalLayer = (value: AuthoringSidecar) => ({
    layer: "personal" as const,
    path: "/config/authoring.json",
    value,
  });

  test("falls back to the running harness, most capable, at xhigh", () => {
    expect(resolveAuthoring([], "alpha-agent")).toEqual({
      effective: {
        "release-notes": {
          effort: "xhigh",
          harness: "alpha-agent",
          model: "most-capable",
          status: "most-capable",
        },
      },
      source: {
        "release-notes": {
          effort: "default",
          harness: "default",
          model: "default",
          path: null,
        },
      },
    });
    expect(resolveAuthoring([], null).effective["release-notes"]).toEqual({
      effort: "xhigh",
      harness: "unknown",
      model: "most-capable",
      status: "unresolved",
    });
  });

  test("each Question B answer changes the effective role", () => {
    const role = { "release-notes": { harness: "running" } };
    const answers = [
      [
        { effort: "xhigh", model: "most-capable" },
        "most-capable",
        "xhigh",
        "most-capable",
      ],
      [
        { effort: "max", model: "named-model-2" },
        "named-model-2",
        "max",
        "resolved",
      ],
      [null, "most-capable", "xhigh", "no-delegation"],
    ] as const;
    for (const [entry, model, effort, status] of answers) {
      expect(
        resolveAuthoring(
          [personalLayer(sidecar({ "alpha-agent": entry }, role))],
          "alpha-agent"
        ).effective["release-notes"]
      ).toEqual({ effort, harness: "alpha-agent", model, status });
    }
  });

  test("replaces whole per layer and reports each field's layer and path", () => {
    const personal = personalLayer(
      sidecar(
        {
          "alpha-agent": { effort: "high", model: "personal-model" },
          "beta-agent": { model: "beta-model" },
        },
        { "release-notes": { effort: "low", harness: "running" } }
      )
    );
    const repository = repositoryLayer(
      sidecar({ "alpha-agent": { model: "repo-model" } })
    );
    // The repository entry for alpha-agent replaces the personal one whole,
    // so the personal effort does not leak through; the role still comes
    // from the personal layer.
    expect(resolveAuthoring([repository, personal], "alpha-agent")).toEqual({
      effective: {
        "release-notes": {
          effort: "low",
          harness: "alpha-agent",
          model: "repo-model",
          status: "resolved",
        },
      },
      source: {
        "release-notes": {
          effort: "personal",
          harness: "personal",
          model: "repository",
          path: "/repo/.simple-changelogs-authoring.json",
        },
      },
    });
    // The same sidecars read from another running harness.
    expect(
      resolveAuthoring([repository, personal], "beta-agent").effective[
        "release-notes"
      ]
    ).toEqual({
      effort: "low",
      harness: "beta-agent",
      model: "beta-model",
      status: "resolved",
    });
    // An empty repository sidecar defines nothing, so personal entries stay.
    expect(
      resolveAuthoring([repositoryLayer(sidecar({})), personal], "beta-agent")
        .source["release-notes"]
    ).toEqual({
      effort: "personal",
      harness: "personal",
      model: "personal",
      path: "/config/authoring.json",
    });
  });

  test("a null entry means no delegation, even under a role-level model", () => {
    expect(
      resolveAuthoring(
        [
          repositoryLayer(
            sidecar(
              { gamma: null },
              { "release-notes": { harness: "gamma", model: "writer" } }
            )
          ),
        ],
        "alpha-agent"
      ).effective["release-notes"]
    ).toEqual({
      effort: "xhigh",
      harness: "gamma",
      model: "writer",
      status: "no-delegation",
    });
    // A concrete harness with no entry anywhere resolves to most-capable.
    expect(
      resolveAuthoring(
        [
          repositoryLayer(
            sidecar({}, { "release-notes": { harness: "gamma" } })
          ),
        ],
        null
      ).effective["release-notes"]
    ).toEqual({
      effort: "xhigh",
      harness: "gamma",
      model: "most-capable",
      status: "most-capable",
    });
  });
});

describe("authoring question and inspection", () => {
  test("is pending without a valid sidecar and orders before preference scope", async () => {
    const fixture = await authoringFixture({
      roots: [".gamma"],
      running: "beta",
    });
    const inspection = await inspectFixture(fixture);
    expect(inspection.authoringQuestion).toBe("pending");
    expect(inspection.detectedHarnesses.map(({ id }) => id)).toEqual([
      "beta-agent",
      "gamma",
    ]);
    expect(inspection.authoring.effective["release-notes"].harness).toBe(
      "beta-agent"
    );
    const { unresolvedQuestions } = inspection;
    expect(unresolvedQuestions.indexOf("authoring-models")).toBe(
      unresolvedQuestions.indexOf("preference-scope") - 1
    );
    expect(inspection.onboardingContribution?.questions.at(-1)).toEqual({
      id: "authoring-models",
      required: false,
    });
    const read = await inspectFixture(fixture, { taskMode: "read" });
    expect(read.authoringQuestion).toBe("not-applicable");
    expect(read.unresolvedQuestions).not.toContain("authoring-models");
  });

  test("reports repair for a malformed or symlinked sidecar and never treats it as answered", async () => {
    const fixture = await authoringFixture();
    const paths = resolveAuthoringPaths(fixture.repo, fixture.config);
    await writeJson(paths.personal, { ...EMPTY_SIDECAR, extra: true });
    const malformed = await inspectFixture(fixture);
    expect(malformed.authoringQuestion).toBe("repair");
    expect(malformed.authoringFiles.personal.errors).toEqual([
      "personal authoring sidecar.extra is not allowed",
    ]);
    expect(malformed.unresolvedQuestions).not.toContain("authoring-models");
    const refused = await applyAuthoring(fixture, EMPTY_SIDECAR, {
      scope: "all-projects",
    });
    expect(refused.status).toBe("blocked");
    expect(JSON.parse(await readFile(paths.personal, "utf8"))).toEqual({
      ...EMPTY_SIDECAR,
      extra: true,
    });
    await rm(paths.personal);
    const target = join(fixture.roots, "elsewhere.json");
    await writeJson(target, EMPTY_SIDECAR);
    await symlink(target, paths.repository);
    expect((await inspectFixture(fixture)).authoringQuestion).toBe("repair");
  });

  test("an empty sidecar answers the question; a configured repository accepts apply --authoring", async () => {
    const fixture = await authoringFixture();
    await writeJson(
      join(fixture.repo, ".simple-changelogs.json"),
      configuredPolicy
    );
    const before = await inspectFixture(fixture);
    expect(before.status).toBe("already-configured");
    expect(before.unresolvedQuestions).toEqual(["authoring-models"]);
    expect(before.guidanceUpdate?.questions).toEqual(["authoring-models"]);

    const result = await applyAuthoring(fixture, JSON.stringify(EMPTY_SIDECAR));
    expect(result.command).toBe("apply");
    expect(result.status).toBe("already-configured");
    expect(result.authoringQuestion).toBe("answered");
    expect(result.unresolvedQuestions).toEqual([]);
    expect(result.writes).toEqual([
      {
        kind: "authoring",
        path: join(fixture.repo, ".simple-changelogs-authoring.json"),
        written: true,
      },
    ]);
    expect(result.summary).toContain("Commit this file with your policy");
    expect(result.summary).toContain("0.26.0 or later");
    expect(Object.hasOwn(result.guidanceUpdate ?? {}, "questions")).toBe(false);
    // The policy is untouched; only the sidecar was written.
    expect(
      JSON.parse(
        await readFile(join(fixture.repo, ".simple-changelogs.json"), "utf8")
      )
    ).toEqual(configuredPolicy);
    const again = await applyAuthoring(fixture, EMPTY_SIDECAR);
    expect(again.writes).toEqual([
      {
        kind: "authoring",
        path: join(fixture.repo, ".simple-changelogs-authoring.json"),
        written: false,
      },
    ]);
  });

  test("the guidance acknowledgement and the authoring answer are independent, in either order", async () => {
    const runOrder = async (authoringFirst: boolean): Promise<void> => {
      const fixture = await authoringFixture();
      await writeJson(
        join(fixture.repo, ".simple-changelogs.json"),
        configuredPolicy
      );
      const acknowledge = () =>
        applySetup({
          configDirectory: fixture.config,
          confirm: true,
          distribution: "web",
          environment: fixture.environment,
          guidanceBackfill: "not-applicable",
          harnessDataPath: fixture.dataPath,
          repo: fixture.repo,
        });
      if (authoringFirst) {
        expect((await applyAuthoring(fixture, EMPTY_SIDECAR)).status).toBe(
          "already-configured"
        );
        const acknowledged = await acknowledge();
        expect(acknowledged.status).toBe("configured");
        expect(acknowledged.authoringQuestion).toBe("answered");
      } else {
        const acknowledged = await acknowledge();
        expect(acknowledged.status).toBe("configured");
        // Acknowledging records the disposition and never answers authoring.
        expect(acknowledged.authoringQuestion).toBe("pending");
        expect(acknowledged.unresolvedQuestions).toEqual(["authoring-models"]);
        const later = await inspectFixture(fixture);
        expect(later.guidanceUpdate).toBeNull();
        expect(later.authoringQuestion).toBe("pending");
        expect(later.unresolvedQuestions).toEqual(["authoring-models"]);
        expect(
          (await applyAuthoring(fixture, EMPTY_SIDECAR)).authoringQuestion
        ).toBe("answered");
      }
    };
    await Promise.all([runOrder(false), runOrder(true)]);
  });

  test("a failed authoring transaction leaves files untouched and the question pending", async () => {
    const fixture = await authoringFixture();
    const invalid = await applyAuthoring(fixture, {
      ...EMPTY_SIDECAR,
      roles: { "release-notes": { harness: "running", model: "x" } },
    });
    expect(invalid.status).toBe("blocked");
    expect(invalid.authoringQuestion).toBe("pending");
    expect(invalid.authoringFiles.repository.state).toBe("absent");
    const refusals = [
      [{ scope: "run-only" }, "--scope repository or --scope all-projects"],
      [{ confirm: false }, "Confirmation is required"],
      [{ signatures: "none" }, "standalone transaction; record signatures"],
    ] as const;
    const refused = await Promise.all(
      refusals.map(([overrides]) =>
        applyAuthoring(fixture, EMPTY_SIDECAR, overrides)
      )
    );
    for (const [index, [, message]] of refusals.entries()) {
      expect(refused[index]?.status).toBe("blocked");
      expect(refused[index]?.errors.join(" ")).toContain(message);
    }
    const unparsable = await applyAuthoring(fixture, "{not json");
    expect(unparsable.errors.join(" ")).toContain("--authoring must be JSON");

    const paths = resolveAuthoringPaths(fixture.repo, fixture.config);
    const prior = sidecar({ gamma: { model: "kept" } });
    await writeJson(paths.personal, prior);
    await chmod(fixture.config, 0o500);
    try {
      const failed = await applyAuthoring(fixture, EMPTY_SIDECAR, {
        scope: "all-projects",
      });
      expect(failed.status).toBe("blocked");
      expect(failed.errors.join(" ")).toContain("Authoring write failed");
    } finally {
      await chmod(fixture.config, 0o700);
    }
    expect(JSON.parse(await readFile(paths.personal, "utf8"))).toEqual(prior);
    expect(
      (await readdir(fixture.config)).filter((name) => name.startsWith("."))
    ).toEqual([]);
  });

  test("writes the personal sidecar beside preferences.json for any override directory", async () => {
    const writeUnder = async (nested: string): Promise<void> => {
      const fixture = await authoringFixture();
      const config = nested ? join(fixture.config, nested) : fixture.config;
      const result = await applyAuthoring(
        { ...fixture, config },
        sidecar({ gamma: { model: "personal-model" } }),
        { scope: "all-projects" }
      );
      const path = join(config, "authoring.json");
      expect(result.writes).toEqual([
        { kind: "authoring", path, written: true },
      ]);
      expect((await stat(path)).mode % 0o1000).toBe(0o600);
      expect(result.authoringFiles.personal).toMatchObject({
        path,
        state: "valid",
      });
      expect(result.authoring.source["release-notes"].path).toBeNull();
    };
    await Promise.all([writeUnder(""), writeUnder("simple-changelogs")]);
    const fixture = await authoringFixture();
    await applyAuthoring(fixture, EMPTY_SIDECAR);
    expect(
      (await stat(join(fixture.repo, ".simple-changelogs-authoring.json")))
        .mode % 0o1000
    ).toBe(0o644);
  });

  test("the CLI takes --authoring as JSON or @path and honors SIMPLE_CHANGELOGS_CONFIG_DIR", async () => {
    const fixture = await authoringFixture();
    const answer = join(fixture.roots, "answer.json");
    await writeJson(
      answer,
      sidecar({ gamma: { effort: "high", model: "cli" } })
    );
    const run = async (args: string[]) => {
      const child = spawn({
        cmd: [process.execPath, SETUP, ...args],
        env: {
          ...process.env,
          SIMPLE_CHANGELOGS_CONFIG_DIR: fixture.config,
          SIMPLE_CHANGELOGS_HARNESS_ROOTS: fixture.roots,
        },
        stderr: "pipe",
        stdout: "pipe",
      });
      const [exitCode, stdout] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
      ]);
      return { exitCode, result: JSON.parse(stdout) as SetupResult };
    };
    const written = await run([
      "apply",
      "--authoring",
      `@${answer}`,
      "--scope",
      "all-projects",
      "--confirm",
      "--repo",
      fixture.repo,
    ]);
    expect(written.exitCode).toBe(0);
    expect(written.result.writes).toEqual([
      {
        kind: "authoring",
        path: join(fixture.config, "authoring.json"),
        written: true,
      },
    ]);
    const inspected = await run(["inspect", "--repo", fixture.repo]);
    expect(inspected.result.authoringQuestion).toBe("answered");
    expect(inspected.result.authoringFiles.personal.state).toBe("valid");
    const blocked = await run([
      "apply",
      "--authoring",
      '{"schemaVersion":1}',
      "--scope",
      "repository",
      "--confirm",
      "--repo",
      fixture.repo,
    ]);
    expect(blocked.exitCode).toBe(1);
    expect(blocked.result.status).toBe("blocked");
  });
});
