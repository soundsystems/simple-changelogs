import { realpath } from "node:fs/promises";
import { basename, isAbsolute, relative, sep } from "node:path";
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
  type VendorProcessResult,
  type VendorProcessSpec,
  vendorLogs,
} from "./shared.ts";

const RUNTIME_IDENTITY = "Hermes Agent";
type HermesProcessRunner = (
  spec: VendorProcessSpec
) => Promise<VendorProcessResult>;

export interface HermesInvocationOptions {
  executable?: string;
  model?: string;
  provider?: string;
  terminalBackend?: string;
}

const configuredValue = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

export const buildHermesEnvironment = (
  terminalBackend = configuredValue("SIMPLE_CHANGELOGS_HERMES_TERMINAL_ENV") ??
    "docker",
  snapshotPath?: string,
  workspacePath?: string
): Record<string, string> => {
  if (terminalBackend !== "docker") {
    throw new Error(
      "The Hermes adapter requires the Docker terminal backend for workspace isolation"
    );
  }
  if (!snapshotPath) {
    throw new Error(
      "The Hermes adapter requires a skill snapshot for its read-only Docker mount"
    );
  }
  if (!workspacePath) {
    throw new Error(
      "The Hermes adapter requires an evaluation workspace for its Docker mount"
    );
  }
  return {
    TERMINAL_CONTAINER_PERSISTENT: "false",
    TERMINAL_DOCKER_NETWORK: "false",
    TERMINAL_DOCKER_PERSIST_ACROSS_PROCESSES: "false",
    TERMINAL_DOCKER_VOLUMES: JSON.stringify([
      `${workspacePath}:/workspace`,
      `${snapshotPath}:/workspace/${basename(snapshotPath)}:ro`,
    ]),
    TERMINAL_ENV: "docker",
  };
};

export const buildHermesInvocation = (
  request: RunnerRequest,
  prompt: string,
  snapshotPath: string,
  options: HermesInvocationOptions = {}
): VendorProcessSpec => {
  const provider =
    options.provider ?? configuredValue("SIMPLE_CHANGELOGS_HERMES_PROVIDER");
  const model =
    options.model ?? configuredValue("SIMPLE_CHANGELOGS_HERMES_MODEL");
  return {
    cmd: [
      options.executable ?? "hermes",
      "chat",
      "--safe-mode",
      "--quiet",
      "--toolsets",
      "terminal",
      "--source",
      "tool",
      "--max-turns",
      "90",
      ...(provider ? ["--provider", provider] : []),
      ...(model ? ["--model", model] : []),
      "--query",
      prompt,
    ],
    cwd: request.workspace,
    env: buildHermesEnvironment(
      options.terminalBackend,
      snapshotPath,
      request.workspace
    ),
    input: "",
    removeEnvKeys: ["HERMES_DOCKER_BINARY"],
    removeEnvPrefixes: ["TERMINAL_"],
  };
};

export const extractHermesFinalResponse = (text: string): RunnerResponse =>
  parseRunnerResponse(text.trim());

const failed = (
  code: "INVALID_CONFIGURATION" | "VENDOR_EXECUTION_FAILED",
  message: string,
  logs = ""
): AdapterExecutionResult => ({
  failure: { code, message },
  logs,
  ok: false,
});

export const buildHermesPromptRequest = (
  request: RunnerRequest,
  snapshotPath: string
): RunnerRequest => {
  const localPath = relative(request.workspace, snapshotPath)
    .split(sep)
    .join("/");
  if (
    localPath === "" ||
    isAbsolute(localPath) ||
    localPath === ".." ||
    localPath.startsWith("../")
  ) {
    throw new Error(
      "The Hermes skill snapshot must remain inside the evaluation workspace"
    );
  }
  return {
    ...request,
    skillDirectory: `./${localPath}`,
    workspace: ".",
  };
};

const executeHermesAdapter = async (
  request: RunnerRequest,
  snapshotPath: string,
  runProcess: HermesProcessRunner
): Promise<AdapterExecutionResult> => {
  let prompt: string;
  let invocation: VendorProcessSpec;
  try {
    const canonicalRequest = {
      ...request,
      workspace: await realpath(request.workspace),
    };
    ({ prompt } = await loadAdapterPrompt(
      buildHermesPromptRequest(canonicalRequest, snapshotPath)
    ));
    invocation = buildHermesInvocation(canonicalRequest, prompt, snapshotPath);
  } catch (error) {
    return failed(
      "INVALID_CONFIGURATION",
      `Unable to prepare Hermes Agent: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const execution = await runProcess(invocation);
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
        extractHermesFinalResponse(execution.stdout),
        RUNTIME_IDENTITY
      ),
    };
  } catch (error) {
    return {
      failure: {
        code: "VENDOR_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      logs,
      ok: false,
    };
  }
};

export const runHermesAdapter = async (
  request: RunnerRequest,
  runProcess: HermesProcessRunner = runVendorProcess
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
    return await executeHermesAdapter(request, snapshot.path, runProcess);
  } finally {
    await snapshot.cleanup();
  }
};

if (import.meta.main) {
  process.exitCode = await runAdapterEntrypoint(
    RUNTIME_IDENTITY,
    runHermesAdapter
  );
}
