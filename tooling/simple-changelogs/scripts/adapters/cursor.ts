#!/usr/bin/env bun

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
  vendorLogs,
} from "./shared.ts";

const RUNTIME_IDENTITY = "Cursor Agent";
const TRUE_VALUE_PATTERN = /^(?:1|true|yes)$/iu;

const configuredCursorModel = (): string | undefined => {
  const model = process.env.SIMPLE_CHANGELOGS_CURSOR_MODEL?.trim();
  return model && model.length > 0 ? model : undefined;
};

const forceAllowed = (): boolean =>
  TRUE_VALUE_PATTERN.test(
    process.env.SIMPLE_CHANGELOGS_CURSOR_FORCE?.trim() ?? ""
  );

export const buildCursorCommand = (
  prompt: string,
  executable = "cursor-agent",
  model = configuredCursorModel(),
  force = forceAllowed()
): string[] => [
  executable,
  "--print",
  "--output-format",
  "text",
  ...(model ? ["--model", model] : []),
  ...(force ? ["--force"] : []),
  prompt,
];

export const extractCursorFinalResponse = (text: string): RunnerResponse =>
  parseRunnerResponse(text);

const failed = (message: string, logs = ""): AdapterExecutionResult => ({
  failure: { code: "VENDOR_EXECUTION_FAILED", message },
  logs,
  ok: false,
});

export const runCursorAdapter = async (
  request: RunnerRequest
): Promise<AdapterExecutionResult> => {
  let snapshot: ReadOnlySkillSnapshot;
  try {
    snapshot = await createReadOnlySkillSnapshot(
      request.skillDirectory,
      request.workspace
    );
  } catch (error) {
    return {
      failure: {
        code: "INVALID_CONFIGURATION",
        message: error instanceof Error ? error.message : String(error),
      },
      logs: "",
      ok: false,
    };
  }

  try {
    const isolatedRequest = { ...request, skillDirectory: snapshot.path };
    let prompt: string;
    try {
      ({ prompt } = await loadAdapterPrompt(isolatedRequest));
    } catch (error) {
      return {
        failure: {
          code: "INVALID_CONFIGURATION",
          message: `Unable to read the runner response schema: ${error instanceof Error ? error.message : String(error)}`,
        },
        logs: "",
        ok: false,
      };
    }

    const execution = await runVendorProcess({
      cmd: buildCursorCommand(prompt),
      cwd: request.workspace,
      input: "",
    });
    const logs = vendorLogs(execution.stderr);
    if (!execution.ok || execution.exitCode !== 0) {
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
          extractCursorFinalResponse(execution.stdout),
          RUNTIME_IDENTITY
        ),
      };
    } catch (error) {
      return failed(
        error instanceof Error ? error.message : String(error),
        vendorLogs(execution.stdout, execution.stderr)
      );
    }
  } finally {
    await snapshot.cleanup();
  }
};

if (import.meta.main) {
  process.exitCode = await runAdapterEntrypoint(
    RUNTIME_IDENTITY,
    runCursorAdapter
  );
}
