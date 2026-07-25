import type { RunnerRequest, RunnerResponse } from "../lib/types.ts";
import {
  type AdapterExecutionResult,
  createReadOnlySkillSnapshot,
  loadAdapterPrompt,
  normalizeAdapterResponse,
  normalizeVendorFailure,
  parseRunnerResponse,
  type ReadOnlySkillSnapshot,
  runAdapterEntrypoint,
  runVendorProcess,
  type VendorProcessSpec,
  vendorLogs,
} from "./shared.ts";

const RUNTIME_IDENTITY = "Claude Code";

const configuredClaudeModel = (): string | undefined => {
  const model = process.env.SIMPLE_CHANGELOGS_CLAUDE_MODEL?.trim();
  return model && model.length > 0 ? model : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const decodePointerSegment = (segment: string): string =>
  segment.replaceAll("~1", "/").replaceAll("~0", "~");

const referencedSchema = (
  root: Record<string, unknown>,
  reference: string
): unknown => {
  if (!reference.startsWith("#/")) {
    throw new Error(
      `Claude schema supports only local references: ${reference}`
    );
  }
  let current: unknown = root;
  for (const segment of reference.slice(2).split("/")) {
    if (!isRecord(current)) {
      throw new Error(`Claude schema reference is invalid: ${reference}`);
    }
    current = current[decodePointerSegment(segment)];
  }
  if (current === undefined) {
    throw new Error(`Claude schema reference was not found: ${reference}`);
  }
  return current;
};

const dereferenceSchema = (root: Record<string, unknown>): unknown => {
  const visit = (value: unknown, activeReferences: Set<string>): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => visit(item, activeReferences));
    }
    if (!isRecord(value)) {
      return value;
    }

    const reference = typeof value.$ref === "string" ? value.$ref : undefined;
    if (reference) {
      if (activeReferences.has(reference)) {
        throw new Error(`Claude schema reference is circular: ${reference}`);
      }
      const resolved = visit(
        referencedSchema(root, reference),
        new Set(activeReferences).add(reference)
      );
      if (!isRecord(resolved)) {
        throw new Error(
          `Claude schema reference is not an object: ${reference}`
        );
      }
      const siblings = Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== "$ref")
          .map(([key, item]) => [key, visit(item, activeReferences)])
      );
      return { ...resolved, ...siblings };
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "$defs" && key !== "$schema")
        .map(([key, item]) => [key, visit(item, activeReferences)])
    );
  };

  return visit(root, new Set());
};

export const prepareClaudeResponseSchema = (responseSchema: string): string => {
  const parsed: unknown = JSON.parse(responseSchema);
  if (!isRecord(parsed)) {
    throw new Error("Claude response schema must be a JSON object");
  }
  return JSON.stringify(dereferenceSchema(parsed));
};

export const buildClaudeSandboxSettings = (request: RunnerRequest): string =>
  JSON.stringify({
    sandbox: {
      allowUnsandboxedCommands: false,
      enabled: true,
      failIfUnavailable: true,
      filesystem: {
        allowRead: [request.workspace, request.skillDirectory],
        allowWrite: [request.workspace],
        denyRead: ["/"],
        denyWrite: [request.skillDirectory],
      },
    },
  });

export const buildClaudeCommand = (
  request: RunnerRequest,
  responseSchema: string,
  executable = "claude",
  model = configuredClaudeModel()
): string[] => {
  const modelArguments = model ? ["--model", model] : [];
  return [
    executable,
    "--print",
    "--output-format",
    "json",
    "--safe-mode",
    "--no-session-persistence",
    "--no-chrome",
    ...modelArguments,
    "--permission-mode",
    "dontAsk",
    "--tools",
    "Edit,Write,Bash",
    "--allowedTools",
    "Edit,Write,Bash",
    "--settings",
    buildClaudeSandboxSettings(request),
    "--json-schema",
    responseSchema,
  ];
};

export const buildClaudeInvocation = (
  request: RunnerRequest,
  responseSchema: string,
  prompt = ""
): VendorProcessSpec => ({
  cmd: buildClaudeCommand(request, responseSchema),
  cwd: request.workspace,
  input: prompt,
});

export const extractClaudeFinalResponse = (text: string): RunnerResponse => {
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch (error) {
    throw new Error("Claude Code output is not valid JSON", { cause: error });
  }
  if (
    !isRecord(envelope) ||
    envelope.type !== "result" ||
    envelope.is_error === true
  ) {
    throw new Error("Claude Code did not return a successful result envelope");
  }
  if (isRecord(envelope.structured_output)) {
    return parseRunnerResponse(JSON.stringify(envelope.structured_output));
  }
  if (typeof envelope.result !== "string") {
    throw new Error("Claude Code result envelope has no final response");
  }
  return parseRunnerResponse(envelope.result);
};

const failed = (
  code: "INVALID_CONFIGURATION" | "VENDOR_EXECUTION_FAILED",
  message: string,
  logs = ""
): AdapterExecutionResult => ({
  failure: { code, message },
  logs,
  ok: false,
});

const executeClaudeAdapter = async (
  request: RunnerRequest
): Promise<AdapterExecutionResult> => {
  let prompt: string;
  let responseSchema: string;
  let claudeResponseSchema: string;
  try {
    ({ prompt, responseSchema } = await loadAdapterPrompt(request));
    claudeResponseSchema = prepareClaudeResponseSchema(responseSchema);
  } catch (error) {
    return failed(
      "INVALID_CONFIGURATION",
      `Unable to read the runner response schema: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const execution = await runVendorProcess(
    buildClaudeInvocation(request, claudeResponseSchema, `${prompt}\n`)
  );
  const logs = vendorLogs(execution.stderr);
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

  try {
    return {
      logs,
      ok: true,
      response: normalizeAdapterResponse(
        request,
        extractClaudeFinalResponse(execution.stdout),
        RUNTIME_IDENTITY
      ),
    };
  } catch (error) {
    const failure = normalizeVendorFailure(RUNTIME_IDENTITY, {
      ...execution,
      error,
    });
    return {
      failure:
        failure.code === "VENDOR_EXECUTION_FAILED"
          ? {
              code: "VENDOR_EXECUTION_FAILED",
              message: error instanceof Error ? error.message : String(error),
            }
          : failure,
      logs,
      ok: false,
    };
  }
};

export const runClaudeAdapter = async (
  request: RunnerRequest
): Promise<AdapterExecutionResult> => {
  let snapshot: ReadOnlySkillSnapshot;
  try {
    snapshot = await createReadOnlySkillSnapshot(
      request.skillDirectory,
      request.workspace
    );
  } catch (error) {
    return failed(
      "INVALID_CONFIGURATION",
      `Unable to isolate the skill directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  try {
    return await executeClaudeAdapter({
      ...request,
      skillDirectory: snapshot.path,
    });
  } finally {
    await snapshot.cleanup();
  }
};

if (import.meta.main) {
  process.exitCode = await runAdapterEntrypoint(
    RUNTIME_IDENTITY,
    runClaudeAdapter
  );
}
