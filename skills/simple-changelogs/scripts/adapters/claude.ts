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

export const buildClaudeSandboxSettings = (request: RunnerRequest): string =>
  JSON.stringify({
    sandbox: {
      allowUnsandboxedCommands: false,
      enabled: true,
      failIfUnavailable: true,
      filesystem: {
        allowWrite: [request.workspace],
        denyWrite: [request.skillDirectory],
      },
    },
  });

export const buildClaudeCommand = (
  request: RunnerRequest,
  responseSchema: string,
  executable = "claude"
): string[] => [
  executable,
  "--print",
  "--output-format",
  "json",
  "--safe-mode",
  "--no-session-persistence",
  "--no-chrome",
  "--permission-mode",
  "acceptEdits",
  "--allowedTools",
  "Read,Glob,Grep,Bash",
  "--settings",
  buildClaudeSandboxSettings(request),
  "--json-schema",
  responseSchema,
];

export const buildClaudeInvocation = (
  request: RunnerRequest,
  responseSchema: string,
  prompt = ""
): VendorProcessSpec => ({
  cmd: buildClaudeCommand(request, responseSchema),
  cwd: request.workspace,
  input: prompt,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
  try {
    ({ prompt, responseSchema } = await loadAdapterPrompt(request));
  } catch (error) {
    return failed(
      "INVALID_CONFIGURATION",
      `Unable to read the runner response schema: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const execution = await runVendorProcess(
    buildClaudeInvocation(request, responseSchema, `${prompt}\n`)
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
