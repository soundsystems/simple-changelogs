import { randomUUID } from "node:crypto";
import {
  chmod,
  cp,
  lstat,
  readdir,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { spawn, stdin } from "bun";
import type { RunnerRequest, RunnerResponse } from "../lib/types.ts";
import {
  validateRunnerRequest,
  validateRunnerResponse,
} from "../lib/validate.ts";

const AUTHENTICATION_FAILURE_PATTERN =
  /authenticat|not logged in|log[ -]?in required|unauthorized|api[ _-]?key|oauth|credential/i;
const CONFIGURATION_FAILURE_PATTERN =
  /configuration|config file|invalid config|settings file/i;

export interface VendorProcessSpec {
  cmd: string[];
  cwd: string;
  input: string;
}

export interface ReadOnlySkillSnapshot {
  cleanup: () => Promise<void>;
  path: string;
}

export type VendorProcessResult =
  | {
      exitCode: number;
      ok: true;
      stderr: string;
      stdout: string;
    }
  | {
      error: unknown;
      ok: false;
      stderr: string;
      stdout: string;
    };

export interface VendorFailureInput {
  error?: unknown;
  exitCode?: number;
  stderr: string;
  stdout: string;
}

export interface NormalizedVendorFailure {
  code:
    | "AUTHENTICATION_REQUIRED"
    | "CLI_NOT_FOUND"
    | "INVALID_CONFIGURATION"
    | "VENDOR_EXECUTION_FAILED";
  message: string;
}

export type AdapterExecutionResult =
  | { logs: string; ok: true; response: RunnerResponse }
  | {
      failure: NormalizedVendorFailure;
      logs: string;
      ok: false;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const errorCode = (error: unknown): string | undefined => {
  if (isRecord(error) && typeof error.code === "string") {
    return error.code;
  }
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return error === undefined ? "" : String(error);
};

const setReadOnly = async (root: string): Promise<void> => {
  const entries = await readdir(root, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Skill snapshots may not contain symlinks: ${path}`);
      }
      if (entry.isDirectory()) {
        await setReadOnly(path);
        return;
      }
      await chmod(path, 0o444);
    })
  );
  await chmod(root, 0o555);
};

const setWritable = async (root: string): Promise<void> => {
  await chmod(root, 0o700).catch(() => undefined);
  const entries = await readdir(root, { withFileTypes: true }).catch(
    () => undefined
  );
  if (!entries) {
    return;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isSymbolicLink()) {
        await rm(path, { force: true });
      } else if (entry.isDirectory()) {
        await setWritable(path);
      } else {
        await chmod(path, 0o600).catch(() => undefined);
      }
    })
  );
};

export const createReadOnlySkillSnapshot = async (
  skillDirectory: string,
  workspace: string
): Promise<ReadOnlySkillSnapshot> => {
  const [sourceStat, workspaceStat] = await Promise.all([
    lstat(skillDirectory),
    lstat(workspace),
  ]);
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    throw new Error(
      `Skill directory must be a real directory: ${skillDirectory}`
    );
  }
  if (workspaceStat.isSymbolicLink() || !workspaceStat.isDirectory()) {
    throw new Error(`Workspace must be a real directory: ${workspace}`);
  }
  const [source, canonicalWorkspace] = await Promise.all([
    realpath(skillDirectory),
    realpath(workspace),
  ]);
  const sourceToWorkspace = relative(source, canonicalWorkspace);
  const workspaceToSource = relative(canonicalWorkspace, source);
  const pathsOverlap = [sourceToWorkspace, workspaceToSource].some(
    (path) =>
      path === "" ||
      (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
  );
  if (pathsOverlap) {
    throw new Error(
      "Skill directory and workspace must not contain each other"
    );
  }
  const snapshot = join(
    canonicalWorkspace,
    `.simple-changelogs-skill-${randomUUID()}`
  );
  const cleanup = async (): Promise<void> => {
    await setWritable(snapshot);
    await rm(snapshot, { force: true, recursive: true });
  };
  try {
    await cp(source, snapshot, { recursive: true });
    await setReadOnly(snapshot);
    return { cleanup, path: snapshot };
  } catch (error) {
    await cleanup();
    throw new Error("Unable to create a read-only skill snapshot", {
      cause: error,
    });
  }
};

const transcriptSection = (request: RunnerRequest): string => {
  if (!request.transcript || request.transcript.length === 0) {
    return "No earlier turns.";
  }
  return request.transcript
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
};

const activationInstructions = (request: RunnerRequest): string =>
  request.activationMode === "explicit"
    ? `Use the local simple-changelogs skill at ${request.skillDirectory}/SKILL.md for this task. Read its instructions and only the references it routes you to.`
    : `Independently decide whether the supplied skill metadata applies to this request. Inspect ${request.skillDirectory}/SKILL.md as candidate metadata, but do not force activation merely because it was supplied. Include a native activation trace in evaluationReport.nativeActivationEvidence. If the runtime cannot provide native evidence, return status "skipped" and diagnostic code CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE.`;

export const buildAdapterPrompt = (
  request: RunnerRequest,
  responseSchema: string
): string => `You are running one isolated simple-changelogs evaluation turn.

${activationInstructions(request)}

Work only inside this evaluation workspace: ${request.workspace}
Treat the skill directory as read-only. Never modify global agent configuration or the installed skill.

Prior transcript:
${transcriptSection(request)}

Current user request:
${request.prompt}

Return exactly one JSON object matching the response schema below. Put ordinary user-facing prose in finalResponse and keep the evaluation-only report separate. Do not present self-reported file mutations as proof; the harness verifies the workspace independently.

Response schema:
${responseSchema}`;

export const runVendorProcess = async (
  spec: VendorProcessSpec
): Promise<VendorProcessResult> => {
  try {
    const subprocess = spawn({
      cmd: spec.cmd,
      cwd: spec.cwd,
      stderr: "pipe",
      stdin: "pipe",
      stdout: "pipe",
    });
    const stdout = new Response(subprocess.stdout).text();
    const stderr = new Response(subprocess.stderr).text();
    await subprocess.stdin.write(spec.input);
    await subprocess.stdin.end();
    const [exitCode, capturedStdout, capturedStderr] = await Promise.all([
      subprocess.exited,
      stdout,
      stderr,
    ]);
    return {
      exitCode,
      ok: true,
      stderr: capturedStderr,
      stdout: capturedStdout,
    };
  } catch (error) {
    return { error, ok: false, stderr: "", stdout: "" };
  }
};

export const normalizeVendorFailure = (
  runtimeName: string,
  failure: VendorFailureInput
): NormalizedVendorFailure => {
  if (errorCode(failure.error) === "ENOENT") {
    return {
      code: "CLI_NOT_FOUND",
      message: `${runtimeName} executable was not found`,
    };
  }

  const detail = [
    failure.stdout,
    failure.stderr,
    errorMessage(failure.error),
  ].join("\n");
  if (AUTHENTICATION_FAILURE_PATTERN.test(detail)) {
    return {
      code: "AUTHENTICATION_REQUIRED",
      message: `${runtimeName} authentication is required`,
    };
  }
  if (CONFIGURATION_FAILURE_PATTERN.test(detail)) {
    return {
      code: "INVALID_CONFIGURATION",
      message: `${runtimeName} configuration is invalid`,
    };
  }
  return {
    code: "VENDOR_EXECUTION_FAILED",
    message:
      failure.exitCode === undefined
        ? `${runtimeName} could not be started`
        : `${runtimeName} exited with status ${failure.exitCode}`,
  };
};

export const parseRunnerResponse = (text: string): RunnerResponse => {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch (error) {
    throw new Error("Vendor final response is not valid JSON", {
      cause: error,
    });
  }
  const validation = validateRunnerResponse(input);
  if (!validation.ok) {
    throw new Error(
      `Vendor final response does not match the neutral protocol: ${validation.errors.join("; ")}`
    );
  }
  return validation.value;
};

export const normalizeAdapterResponse = (
  request: RunnerRequest,
  response: RunnerResponse,
  runtimeIdentity: string
): RunnerResponse => {
  const normalized = {
    ...response,
    runtimeIdentity: response.runtimeIdentity ?? runtimeIdentity,
  };
  if (
    request.activationMode === "explicit" ||
    response.status === "error" ||
    response.evaluationReport.nativeActivationEvidence
  ) {
    return normalized;
  }
  return {
    ...normalized,
    diagnostics: [
      ...(response.diagnostics ?? []),
      {
        code: "CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE",
        message: `${runtimeIdentity} did not provide a native activation trace`,
      },
    ],
    status: "skipped",
  };
};

export const loadAdapterPrompt = async (
  request: RunnerRequest
): Promise<{ prompt: string; responseSchema: string }> => {
  const responseSchema = await readFile(request.responseSchema, "utf8");
  return {
    prompt: buildAdapterPrompt(request, responseSchema),
    responseSchema,
  };
};

export const vendorLogs = (...streams: string[]): string =>
  streams
    .filter((stream) => stream.length > 0)
    .map((stream) => (stream.endsWith("\n") ? stream : `${stream}\n`))
    .join("");

const parseRequest = (text: string): RunnerRequest => {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch (error) {
    throw new Error("Adapter stdin must contain one JSON request", {
      cause: error,
    });
  }
  const validation = validateRunnerRequest(input);
  if (!validation.ok) {
    throw new Error(`Invalid runner request: ${validation.errors.join("; ")}`);
  }
  return validation.value;
};

export const runAdapterEntrypoint = async (
  runtimeIdentity: string,
  execute: (request: RunnerRequest) => Promise<AdapterExecutionResult>
): Promise<number> => {
  let request: RunnerRequest;
  try {
    request = parseRequest(await stdin.text());
  } catch (error) {
    process.stderr.write(`INVALID_CONFIGURATION: ${errorMessage(error)}\n`);
    return 2;
  }

  let result: AdapterExecutionResult;
  try {
    result = await execute(request);
  } catch (error) {
    const failure = normalizeVendorFailure(runtimeIdentity, {
      error,
      stderr: "",
      stdout: "",
    });
    process.stderr.write(`${failure.code}: ${failure.message}\n`);
    return 2;
  }
  if (result.logs.length > 0) {
    process.stderr.write(result.logs);
  }
  if (!result.ok) {
    process.stderr.write(`${result.failure.code}: ${result.failure.message}\n`);
    return 2;
  }
  process.stdout.write(JSON.stringify(result.response));
  return 0;
};
