import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunnerRequest, RunnerResponse } from "../lib/types.ts";
import {
  type AdapterExecutionResult,
  loadAdapterPrompt,
  normalizeAdapterResponse,
  normalizeVendorFailure,
  parseVendorJson,
  runAdapterEntrypoint,
  runVendorProcess,
  type VendorProcessResult,
  type VendorProcessSpec,
  validatedRunnerResponse,
  vendorLogs,
} from "./shared.ts";

const RUNTIME_IDENTITY = "Codex CLI";

type CodexProcessRunner = (
  spec: VendorProcessSpec
) => Promise<VendorProcessResult>;
type Schema = Record<string, unknown>;

// Codex sends --output-schema to OpenAI structured outputs in strict mode,
// which rejects `uniqueItems` and any property missing from `required`
// (probed with codex-cli 0.160.1 on 2026-10-07). Codex therefore gets a copy
// of the canonical runner-response schema without `uniqueItems`, with every
// property required and each optional one also accepting null. The canonical
// schema stays unchanged: a returned null for an optional property reads as
// absent, and every stripped uniqueness rule is checked after parsing.
const STRIPPED_KEYWORDS = new Set(["uniqueItems"]);
// The node shapes the same probe showed strict mode accepts, each with the
// keywords it may carry and those it must carry. `description` and `title` may
// annotate any node, and `$defs` and `$schema` only the root. A schema outside
// these shapes fails before Codex runs instead of reaching the API untried, so
// widen a shape only after probing it. Only annotations sit beside `$ref`,
// because following a reference must not lose a constraint.
const NODE_SHAPES: Record<string, { allowed: string[]; required: string[] }> = {
  $ref: { allowed: ["$ref"], required: ["$ref"] },
  array: {
    allowed: ["items", "minItems", "type", "uniqueItems"],
    required: ["items"],
  },
  boolean: { allowed: ["type"], required: [] },
  const: { allowed: ["const"], required: ["const"] },
  enum: { allowed: ["enum"], required: ["enum"] },
  object: {
    allowed: ["additionalProperties", "properties", "required", "type"],
    required: ["properties"],
  },
  string: { allowed: ["minLength", "pattern", "type"], required: [] },
};
const ANNOTATION_KEYWORDS = new Set(["description", "title"]);
const ROOT_KEYWORDS = new Set(["$defs", "$schema"]);
const SCHEMA_MAP_KEYWORDS = new Set(["$defs", "properties"]);
const JSON_PATH_IDENTIFIER = /^[A-Za-z_$][\w$]*$/u;

const isRecord = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const childPath = (path: string, key: string): string =>
  JSON_PATH_IDENTIFIER.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;

// Only `#/$defs/<name>` references, with a plain name: the strict copy
// rewrites `properties`, so a reference into them would silently point at the
// nullable wrapper, and a name needing JSON Pointer or URI decoding could
// resolve differently here than in a JSON Schema validator.
const DEFINITION_REFERENCE_PATTERN = /^#\/\$defs\/([A-Za-z0-9_-]+)$/u;

const referencedSchema = (root: Schema, reference: string): Schema => {
  const name = DEFINITION_REFERENCE_PATTERN.exec(reference)?.[1];
  const definitions = root.$defs;
  const target =
    name !== undefined &&
    isRecord(definitions) &&
    Object.hasOwn(definitions, name)
      ? definitions[name]
      : undefined;
  if (!isRecord(target)) {
    throw new Error(
      `Codex response schema reference must name a schema in $defs: ${reference}`
    );
  }
  return target;
};

// Follows a chain of references to the schema that describes a value.
const resolvedSchema = (root: Schema, schema: Schema): Schema => {
  let current = schema;
  const followed = new Set<string>();
  while (typeof current.$ref === "string") {
    if (followed.has(current.$ref)) {
      throw new Error(
        `Codex response schema reference is circular: ${current.$ref}`
      );
    }
    followed.add(current.$ref);
    current = referencedSchema(root, current.$ref);
  }
  return current;
};

const nodeKind = (schema: Schema): string => {
  if (Object.hasOwn(schema, "$ref")) {
    return "$ref";
  }
  if (Object.hasOwn(schema, "type")) {
    return typeof schema.type === "string" ? schema.type : "type list";
  }
  if (Object.hasOwn(schema, "enum")) {
    return "enum";
  }
  return Object.hasOwn(schema, "const") ? "const" : "untyped";
};

const requireProbedShape = (schema: Schema, path: string): void => {
  const kind = nodeKind(schema);
  const shape = Object.hasOwn(NODE_SHAPES, kind) ? NODE_SHAPES[kind] : null;
  if (!shape) {
    throw new Error(
      `Codex response schema at ${path} has node kind ${kind}, which strict structured outputs were not probed to accept`
    );
  }
  for (const keyword of Object.keys(schema)) {
    if (
      !(
        shape.allowed.includes(keyword) ||
        ANNOTATION_KEYWORDS.has(keyword) ||
        (path === "#" && ROOT_KEYWORDS.has(keyword))
      )
    ) {
      throw new Error(
        `Codex response schema keyword ${keyword} at ${path} is not known to pass strict structured outputs on node kind ${kind}`
      );
    }
  }
  if (kind === "object" && schema.additionalProperties !== false) {
    throw new Error(
      `Codex response schema object at ${path} must set additionalProperties to false`
    );
  }
  const missing = shape.required.find(
    (keyword) => !Object.hasOwn(schema, keyword)
  );
  if (missing !== undefined) {
    throw new Error(
      `Codex response schema node of kind ${kind} at ${path} must set ${missing}`
    );
  }
};

// The copy rewrites `required` to list every property, so a canonical name
// with no property behind it would silently stop being required.
const requireDeclaredRequirements = (schema: Schema, path: string): void => {
  if (!Object.hasOwn(schema, "required")) {
    return;
  }
  const { properties, required } = schema;
  if (
    !(
      Array.isArray(required) &&
      isRecord(properties) &&
      required.every(
        (name) => typeof name === "string" && Object.hasOwn(properties, name)
      )
    )
  ) {
    throw new Error(
      `Codex response schema required at ${path} must list only names in its own properties`
    );
  }
};

// Codex reports an absent optional property as null, which reads back as
// absent only when the canonical property itself rejects null, so it must
// declare a type that leaves null out.
const requireNullFreeOptionals = (
  root: Schema,
  schema: Schema,
  path: string
): void => {
  const { properties, required } = schema;
  if (!isRecord(properties)) {
    return;
  }
  const requiredNames = new Set(Array.isArray(required) ? required : []);
  for (const [name, property] of Object.entries(properties)) {
    const resolved =
      requiredNames.has(name) || !isRecord(property)
        ? undefined
        : resolvedSchema(root, property);
    const types = Array.isArray(resolved?.type)
      ? resolved.type
      : [resolved?.type];
    if (resolved && (resolved.type === undefined || types.includes("null"))) {
      throw new Error(
        `Codex response schema optional property ${path}/properties/${name} must declare a type that excludes null`
      );
    }
  }
};

// Strict mode requires every property, so an optional one becomes a required
// property that also accepts null.
const withEveryPropertyRequired = (
  properties: Schema,
  required: unknown
): Schema => {
  const requiredNames = new Set(Array.isArray(required) ? required : []);
  return Object.fromEntries(
    Object.entries(properties).map(([name, property]) => [
      name,
      requiredNames.has(name)
        ? property
        : { anyOf: [property, { type: "null" }] },
    ])
  );
};

const strictKeywordValue = (
  root: Schema,
  keyword: string,
  value: unknown,
  path: string
): unknown => {
  if (SCHEMA_MAP_KEYWORDS.has(keyword)) {
    if (!isRecord(value)) {
      throw new Error(
        `Codex response schema ${keyword} at ${path} must be an object`
      );
    }
    return Object.fromEntries(
      Object.entries(value).map(([name, child]) => [
        name,
        strictSchema(root, child, `${path}/${keyword}/${name}`),
      ])
    );
  }
  if (keyword === "items") {
    return strictSchema(root, value, `${path}/items`);
  }
  if (keyword === "$ref") {
    if (typeof value !== "string") {
      throw new Error(`Codex response schema $ref at ${path} must be text`);
    }
    referencedSchema(root, value);
  }
  return value;
};

const strictSchema = (root: Schema, schema: unknown, path: string): Schema => {
  if (!isRecord(schema)) {
    throw new Error(`Codex response schema at ${path} must be an object`);
  }
  requireProbedShape(schema, path);
  requireDeclaredRequirements(schema, path);
  requireNullFreeOptionals(root, schema, path);
  const strict: Schema = {};
  for (const [keyword, value] of Object.entries(schema)) {
    if (!STRIPPED_KEYWORDS.has(keyword)) {
      strict[keyword] = strictKeywordValue(root, keyword, value, path);
    }
  }
  const { properties } = strict;
  if (isRecord(properties)) {
    strict.properties = withEveryPropertyRequired(properties, schema.required);
    strict.required = Object.keys(properties);
  }
  return strict;
};

const parsedSchema = (responseSchema: string): Schema => {
  const parsed: unknown = JSON.parse(responseSchema);
  if (!isRecord(parsed)) {
    throw new Error("Codex response schema must be a JSON object");
  }
  return parsed;
};

export const prepareCodexResponseSchema = (responseSchema: string): string => {
  const root = parsedSchema(responseSchema);
  // Strict mode accepts only a plain object at the root, never a scalar,
  // a type list, or a nullable object.
  if (root.type !== "object") {
    throw new Error('Codex response schema root must have type "object"');
  }
  return `${JSON.stringify(strictSchema(root, root, "#"))}\n`;
};

// JSON Schema compares items structurally, so object key order is ignored.
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const requireUniqueItems = (items: unknown[], path: string): void => {
  const seen = new Set<string>();
  for (const item of items) {
    const key = canonicalJson(item);
    if (seen.has(key)) {
      throw new Error(
        `Codex CLI final response repeats ${key} in ${path}, which the runner response schema requires to be unique`
      );
    }
    seen.add(key);
  }
};

// Undoes the strict copy's changes against the canonical schema: an optional
// property returned as null is dropped, and an array the canonical schema
// marks uniqueItems must not repeat an item once its own items are restored.
const restoredValue = (
  root: Schema,
  schema: Schema,
  value: unknown,
  path: string
): unknown => {
  const resolved = resolvedSchema(root, schema);
  const { items, properties, required, uniqueItems } = resolved;
  if (Array.isArray(value)) {
    const restored = isRecord(items)
      ? value.map((item, index) =>
          restoredValue(root, items, item, `${path}[${index}]`)
        )
      : value;
    if (uniqueItems === true) {
      requireUniqueItems(restored, path);
    }
    return restored;
  }
  if (!(isRecord(value) && isRecord(properties))) {
    return value;
  }
  const requiredNames = new Set(Array.isArray(required) ? required : []);
  // Own-property lookups and fromEntries keep a key such as `__proto__` an
  // ordinary unknown field for the neutral validator to reject.
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      const property = Object.hasOwn(properties, key)
        ? properties[key]
        : undefined;
      if (!isRecord(property)) {
        return [[key, item]];
      }
      return item === null && !requiredNames.has(key)
        ? []
        : [[key, restoredValue(root, property, item, childPath(path, key))]];
    })
  );
};

export const restoreCodexResponse = (
  value: unknown,
  responseSchema: string
): unknown => {
  const root = parsedSchema(responseSchema);
  return restoredValue(root, root, value, "$");
};

const configuredCodexModel = (): string | undefined => {
  const model = process.env.SIMPLE_CHANGELOGS_CODEX_MODEL?.trim();
  return model && model.length > 0 ? model : undefined;
};

export const buildCodexCommand = (
  request: RunnerRequest,
  outputSchemaPath: string,
  outputLastMessagePath: string,
  executable = "codex",
  model = configuredCodexModel()
): string[] => {
  const modelArguments = model ? ["--model", model] : [];
  return [
    executable,
    "exec",
    "--config",
    "mcp_servers={}",
    ...modelArguments,
    "--cd",
    request.workspace,
    "--sandbox",
    "workspace-write",
    "--json",
    "--output-schema",
    outputSchemaPath,
    "--output-last-message",
    outputLastMessagePath,
    "-",
  ];
};

export const extractCodexFinalResponse = (
  text: string,
  responseSchema: string
): RunnerResponse =>
  validatedRunnerResponse(
    restoreCodexResponse(parseVendorJson(text), responseSchema)
  );

const failed = (
  code: "INVALID_CONFIGURATION" | "VENDOR_EXECUTION_FAILED",
  message: string,
  logs = ""
): AdapterExecutionResult => ({
  failure: { code, message },
  logs,
  ok: false,
});

const failedFromVendorLogs = (
  execution: { exitCode: number; stderr: string; stdout: string },
  fallbackMessage: string,
  logs: string
): AdapterExecutionResult => {
  const failure = normalizeVendorFailure(RUNTIME_IDENTITY, execution);
  return failure.code === "VENDOR_EXECUTION_FAILED"
    ? failed("VENDOR_EXECUTION_FAILED", fallbackMessage, logs)
    : { failure, logs, ok: false };
};

export const runCodexAdapter = async (
  request: RunnerRequest,
  runProcess: CodexProcessRunner = runVendorProcess
): Promise<AdapterExecutionResult> => {
  let prompt: string;
  let responseSchema: string;
  try {
    ({ prompt, responseSchema } = await loadAdapterPrompt(request));
  } catch (error) {
    return failed(
      "INVALID_CONFIGURATION",
      `Unable to read the runner response schema: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  let strictResponseSchema: string;
  try {
    strictResponseSchema = prepareCodexResponseSchema(responseSchema);
  } catch (error) {
    return failed(
      "INVALID_CONFIGURATION",
      `Unable to prepare the runner response schema for Codex: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // The strict copy lives outside the workspace so the evaluated agent never
  // sees it as an untracked file.
  let schemaDirectory: string | undefined;
  const outputLastMessagePath = join(
    request.workspace,
    `.simple-changelogs-codex-${randomUUID()}.json`
  );
  try {
    schemaDirectory = await mkdtemp(
      join(tmpdir(), "simple-changelogs-codex-schema-")
    );
    const outputSchemaPath = join(schemaDirectory, "runner-response.json");
    await writeFile(outputSchemaPath, strictResponseSchema);
    const execution = await runProcess({
      cmd: buildCodexCommand(request, outputSchemaPath, outputLastMessagePath),
      cwd: request.workspace,
      input: `${prompt}\n`,
    });
    const logs = execution.ok
      ? vendorLogs(execution.stdout, execution.stderr)
      : vendorLogs(execution.stderr);
    if (!execution.ok) {
      return {
        failure: normalizeVendorFailure(RUNTIME_IDENTITY, execution),
        logs,
        ok: false,
      };
    }
    if (execution.exitCode !== 0) {
      return {
        failure: normalizeVendorFailure(RUNTIME_IDENTITY, execution),
        logs,
        ok: false,
      };
    }

    let finalMessage: string;
    try {
      finalMessage = await readFile(outputLastMessagePath, "utf8");
    } catch (error) {
      return failedFromVendorLogs(
        execution,
        `Codex CLI did not write a final response: ${error instanceof Error ? error.message : String(error)}`,
        logs
      );
    }
    try {
      return {
        logs,
        ok: true,
        response: normalizeAdapterResponse(
          request,
          extractCodexFinalResponse(finalMessage, responseSchema),
          RUNTIME_IDENTITY
        ),
      };
    } catch (error) {
      return failedFromVendorLogs(
        execution,
        error instanceof Error ? error.message : String(error),
        logs
      );
    }
  } finally {
    await rm(outputLastMessagePath, { force: true }).catch(() => undefined);
    if (schemaDirectory) {
      await rm(schemaDirectory, { force: true, recursive: true }).catch(
        () => undefined
      );
    }
  }
};

if (import.meta.main) {
  process.exitCode = await runAdapterEntrypoint(
    RUNTIME_IDENTITY,
    runCodexAdapter
  );
}
