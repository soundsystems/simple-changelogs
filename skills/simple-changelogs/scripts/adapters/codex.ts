import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { RunnerRequest, RunnerResponse } from "../lib/types.ts";
import {
  type AdapterExecutionResult,
  loadAdapterPrompt,
  normalizeAdapterResponse,
  normalizeVendorFailure,
  parseRunnerResponse,
  runAdapterEntrypoint,
  runVendorProcess,
  vendorLogs,
} from "./shared.ts";

const RUNTIME_IDENTITY = "Codex CLI";

const configuredCodexModel = (): string | undefined => {
  const model = process.env.SIMPLE_CHANGELOGS_CODEX_MODEL?.trim();
  return model && model.length > 0 ? model : undefined;
};

export const buildCodexCommand = (
  request: RunnerRequest,
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
    request.responseSchema,
    "--output-last-message",
    outputLastMessagePath,
    "-",
  ];
};

export const extractCodexFinalResponse = (text: string): RunnerResponse =>
  parseRunnerResponse(text);

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
  request: RunnerRequest
): Promise<AdapterExecutionResult> => {
  let prompt: string;
  try {
    ({ prompt } = await loadAdapterPrompt(request));
  } catch (error) {
    return failed(
      "INVALID_CONFIGURATION",
      `Unable to read the runner response schema: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const outputLastMessagePath = join(
    request.workspace,
    `.simple-changelogs-codex-${randomUUID()}.json`
  );
  try {
    const execution = await runVendorProcess({
      cmd: buildCodexCommand(request, outputLastMessagePath),
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
          extractCodexFinalResponse(finalMessage),
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
  }
};

if (import.meta.main) {
  process.exitCode = await runAdapterEntrypoint(
    RUNTIME_IDENTITY,
    runCodexAdapter
  );
}
