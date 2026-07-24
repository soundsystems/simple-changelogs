import { randomUUID } from "node:crypto";
import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import type { RunnerRequest, RunnerResponse } from "../lib/types.ts";
import {
  type AdapterExecutionResult,
  loadAdapterPrompt,
  normalizeAdapterResponse,
  normalizeVendorFailure,
  parseRunnerResponse,
  runAdapterEntrypoint,
  runVendorProcess,
  type VendorProcessResult,
  type VendorProcessSpec,
  vendorLogs,
} from "./shared.ts";

const RUNTIME_IDENTITY = "Grok Build";
const ISOLATED_CONFIG = `[cli]
auto_update = false

[compat.claude]
agents = false
hooks = false
mcps = false
rules = false
skills = false

[compat.cursor]
agents = false
hooks = false
mcps = false
rules = false
skills = false
`;

type GrokProcessRunner = (
  spec: VendorProcessSpec
) => Promise<VendorProcessResult>;

export interface GrokInvocationOptions {
  authPath?: string;
  executable?: string;
  model?: string;
}

const configuredValue = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

const configuredAuthPath = (): string =>
  configuredValue("GROK_AUTH_PATH") ??
  join(configuredValue("GROK_HOME") ?? join(homedir(), ".grok"), "auth.json");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pathIsInside = (root: string, candidate: string): boolean => {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
  );
};

export const buildGrokCommand = (
  request: RunnerRequest,
  prompt: string,
  grokHome: string,
  executable = "grok",
  model = configuredValue("SIMPLE_CHANGELOGS_GROK_MODEL")
): string[] => [
  executable,
  "--cwd",
  request.workspace,
  "--leader-socket",
  join(grokHome, "leader.sock"),
  "--sandbox",
  "workspace",
  "--always-approve",
  "--no-plan",
  "--no-subagents",
  "--no-memory",
  "--disable-web-search",
  "--max-turns",
  "90",
  "--output-format",
  "json",
  ...(model ? ["--model", model] : []),
  "--verbatim",
  "--single",
  prompt,
];

export const buildGrokInvocation = (
  request: RunnerRequest,
  prompt: string,
  grokHome: string,
  options: GrokInvocationOptions = {}
): VendorProcessSpec => ({
  cmd: buildGrokCommand(
    request,
    prompt,
    grokHome,
    options.executable,
    options.model
  ),
  cwd: request.workspace,
  env: {
    GROK_AUTH_PATH: options.authPath ?? configuredAuthPath(),
    GROK_DISABLE_AUTOUPDATER: "1",
    GROK_HOME: grokHome,
    GROK_MEMORY: "0",
  },
  input: "",
  removeEnvKeys: ["GROK_LEADER_SOCKET", "GROK_PLUGIN_DATA", "GROK_PLUGIN_ROOT"],
});

export const extractGrokFinalResponse = (text: string): RunnerResponse => {
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch (error) {
    throw new Error("Grok Build output is not valid JSON", { cause: error });
  }
  if (!isRecord(envelope)) {
    throw new Error("Grok Build output is not a JSON object");
  }
  if (envelope.type === "error") {
    throw new Error(
      typeof envelope.message === "string"
        ? envelope.message
        : "Grok Build returned an error"
    );
  }
  if (typeof envelope.text !== "string") {
    throw new Error("Grok Build output has no final response text");
  }
  return parseRunnerResponse(envelope.text.trim());
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

const canonicalRequest = async (
  request: RunnerRequest
): Promise<RunnerRequest> => {
  const [workspace, skillDirectory] = await Promise.all([
    realpath(request.workspace),
    realpath(request.skillDirectory),
  ]);
  if (pathIsInside(workspace, skillDirectory)) {
    throw new Error(
      "The Grok Build adapter requires the skill directory to remain outside the writable evaluation workspace"
    );
  }
  return { ...request, skillDirectory, workspace };
};

const executeGrokAdapter = async (
  request: RunnerRequest,
  grokHome: string,
  runProcess: GrokProcessRunner
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

  const execution = await runProcess(
    buildGrokInvocation(request, prompt, grokHome)
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
        extractGrokFinalResponse(execution.stdout),
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

export const runGrokAdapter = async (
  request: RunnerRequest,
  runProcess: GrokProcessRunner = runVendorProcess
): Promise<AdapterExecutionResult> => {
  let isolatedRequest: RunnerRequest;
  try {
    isolatedRequest = await canonicalRequest(request);
  } catch (error) {
    return failed(
      "INVALID_CONFIGURATION",
      error instanceof Error ? error.message : String(error)
    );
  }

  const grokHome = join(
    isolatedRequest.workspace,
    `.simple-changelogs-grok-${randomUUID()}`
  );
  try {
    await mkdir(grokHome);
    await writeFile(join(grokHome, "config.toml"), ISOLATED_CONFIG);
    return await executeGrokAdapter(isolatedRequest, grokHome, runProcess);
  } catch (error) {
    return failed(
      "INVALID_CONFIGURATION",
      `Unable to prepare Grok Build: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    await rm(grokHome, { force: true, recursive: true }).catch(() => undefined);
  }
};

if (import.meta.main) {
  process.exitCode = await runAdapterEntrypoint(
    RUNTIME_IDENTITY,
    runGrokAdapter
  );
}
