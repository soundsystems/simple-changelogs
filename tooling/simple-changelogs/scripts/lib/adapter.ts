import { file, spawn } from "bun";
import type { RunnerRequest, RunnerResponse } from "./types.ts";
import { validateRunnerResponse } from "./validate.ts";

export interface AdapterRunOptions {
  timeoutMs?: number;
}

export interface AdapterConfigurationError {
  kind: "configuration";
  message: string;
  timeoutMs?: number;
}

export interface AdapterProtocolError {
  errors: string[];
  kind: "protocol";
  message: string;
}

export interface AdapterProcessError {
  exitCode: number;
  kind: "process";
  message: string;
}

export type AdapterRunError =
  | AdapterConfigurationError
  | AdapterProcessError
  | AdapterProtocolError;

export type AdapterRunResult =
  | { ok: true; response: RunnerResponse; stderr: string }
  | { error: AdapterRunError; ok: false; stderr: string };

const OUTPUT_DRAIN_GRACE_MS = 250;
const RUNTIME_TIMER_MAX_MS = 2_147_483_647;
const USE_POSIX_PROCESS_GROUP = process.platform !== "win32";

export const resolveAdapterCommand = (adapterPath: string): string[] =>
  adapterPath.endsWith(".ts") ? [process.execPath, adapterPath] : [adapterPath];

export const resolveProcessTreeKillCommand = (
  pid: number,
  platform = process.platform
): string[] | undefined =>
  platform === "win32"
    ? ["taskkill.exe", "/PID", String(pid), "/T", "/F"]
    : undefined;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const configurationFailure = (
  message: string,
  stderr = "",
  timeoutMs?: number
): AdapterRunResult => ({
  error: {
    kind: "configuration",
    message,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  },
  ok: false,
  stderr,
});

const validateRunConfiguration = (
  adapterPath: string,
  timeoutMs: number
): AdapterRunResult | undefined => {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    return configurationFailure(
      "Adapter timeout must be a positive safe integer"
    );
  }
  if (timeoutMs > RUNTIME_TIMER_MAX_MS) {
    return configurationFailure(
      `Adapter timeout must not exceed ${RUNTIME_TIMER_MAX_MS} ms`
    );
  }
  if (adapterPath.length === 0) {
    return configurationFailure("Adapter path must not be empty");
  }
};

const spawnAdapter = (cmd: string[]) =>
  spawn({
    cmd,
    detached: USE_POSIX_PROCESS_GROUP,
    stderr: "pipe",
    stdin: "pipe",
    stdout: "pipe",
  });

type AdapterSubprocess = ReturnType<typeof spawnAdapter>;

interface OutputCapture {
  cancel: () => Promise<void>;
  completed: Promise<void>;
  text: () => string;
}

const captureOutput = (stream: ReadableStream<Uint8Array>): OutputCapture => {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let output = "";
  const readNextChunk = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) {
      output += decoder.decode();
      return;
    }
    output += decoder.decode(value, { stream: true });
    await readNextChunk();
  };
  const completed = readNextChunk()
    .catch(() => undefined)
    .finally(() => {
      try {
        reader.releaseLock();
      } catch {
        // Cancellation may already have released the reader.
      }
    });

  return {
    cancel: async () => {
      try {
        await reader.cancel();
      } catch {
        // The reader may already be released after normal completion.
      }
    },
    completed,
    text: () => output,
  };
};

const killDirectProcess = (subprocess: AdapterSubprocess): void => {
  try {
    subprocess.kill("SIGKILL");
  } catch {
    // The process may already have exited.
  }
};

const killProcessTree = async (
  subprocess: AdapterSubprocess
): Promise<void> => {
  if (USE_POSIX_PROCESS_GROUP) {
    try {
      process.kill(-subprocess.pid, "SIGKILL");
      return;
    } catch {
      killDirectProcess(subprocess);
      return;
    }
  }

  const cmd = resolveProcessTreeKillCommand(subprocess.pid);
  if (cmd) {
    try {
      const terminator = spawn({
        cmd,
        stderr: "ignore",
        stdin: "ignore",
        stdout: "ignore",
      });
      if ((await terminator.exited) === 0) {
        return;
      }
    } catch {
      // Fall through to Bun's direct-child termination.
    }
  }
  killDirectProcess(subprocess);
};

const waitForOutput = async (
  captures: OutputCapture[],
  graceMs: number
): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const graceElapsed = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), graceMs);
  });
  const completed = Promise.all(
    captures.map((capture) => capture.completed)
  ).then(() => true as const);
  const drained = await Promise.race([completed, graceElapsed]);
  if (timer !== undefined) {
    clearTimeout(timer);
  }
  return drained;
};

const terminateAndCollect = async (
  subprocess: AdapterSubprocess,
  stdout: OutputCapture,
  stderr: OutputCapture,
  termination?: Promise<void>
): Promise<string> => {
  await (termination ?? killProcessTree(subprocess));
  try {
    await subprocess.exited;
  } catch {
    // Reaping is best-effort after Bun reports a process error.
  }
  const captures = [stdout, stderr];
  if (!(await waitForOutput(captures, OUTPUT_DRAIN_GRACE_MS))) {
    await Promise.all(captures.map((capture) => capture.cancel()));
  }
  return stderr.text();
};

type ProcessExecutionOutcome =
  | { exitCode: number; kind: "completed" }
  | { kind: "configuration"; message: string };

const executeSubprocess = async (
  subprocess: AdapterSubprocess,
  serializedRequest: string,
  captures: OutputCapture[]
): Promise<ProcessExecutionOutcome> => {
  try {
    await subprocess.stdin.write(serializedRequest);
    await subprocess.stdin.end();
  } catch (error) {
    return {
      kind: "configuration",
      message: `Unable to write adapter request: ${errorMessage(error)}`,
    };
  }

  let exitCode: number;
  try {
    exitCode = await subprocess.exited;
  } catch (error) {
    return {
      kind: "configuration",
      message: `Unable to wait for adapter: ${errorMessage(error)}`,
    };
  }
  await Promise.all(captures.map((capture) => capture.completed));
  return { exitCode, kind: "completed" };
};

export const runAdapter = async (
  adapterPath: string,
  request: RunnerRequest,
  options: AdapterRunOptions = {}
): Promise<AdapterRunResult> => {
  const timeoutMs = options.timeoutMs ?? request.timeoutMs;
  const configurationError = validateRunConfiguration(adapterPath, timeoutMs);
  if (configurationError) {
    return configurationError;
  }

  let serializedRequest: string;
  try {
    const serialized = JSON.stringify(request);
    if (serialized === undefined) {
      return configurationFailure("Adapter request is not JSON serializable");
    }
    serializedRequest = `${serialized}\n`;
  } catch (error) {
    return configurationFailure(
      `Adapter request is not JSON serializable: ${errorMessage(error)}`
    );
  }

  try {
    if (!(await file(adapterPath).exists())) {
      return configurationFailure(`Adapter does not exist: ${adapterPath}`);
    }
  } catch (error) {
    return configurationFailure(
      `Unable to inspect adapter: ${errorMessage(error)}`
    );
  }

  const cmd = resolveAdapterCommand(adapterPath);
  let subprocess: AdapterSubprocess;
  try {
    subprocess = spawnAdapter(cmd);
  } catch (error) {
    return configurationFailure(
      `Unable to start adapter: ${errorMessage(error)}`
    );
  }

  const stdoutCapture = captureOutput(subprocess.stdout);
  const stderrCapture = captureOutput(subprocess.stderr);
  let timeoutTermination: Promise<void> | undefined;
  let signalTimeout: () => void = () => undefined;
  const timeoutSignal = new Promise<{ kind: "timeout" }>((resolve) => {
    signalTimeout = () => resolve({ kind: "timeout" });
  });
  const timer = setTimeout(() => {
    timeoutTermination = killProcessTree(subprocess).catch(() => undefined);
    signalTimeout();
  }, timeoutMs);
  const captures = [stdoutCapture, stderrCapture];
  const execution = executeSubprocess(
    subprocess,
    serializedRequest,
    captures
  ).catch((error) => ({
    kind: "configuration" as const,
    message: `Adapter execution failed: ${errorMessage(error)}`,
  }));
  const outcome = await Promise.race([execution, timeoutSignal]);
  clearTimeout(timer);

  if (outcome.kind === "timeout" || timeoutTermination) {
    const stderr = await terminateAndCollect(
      subprocess,
      stdoutCapture,
      stderrCapture,
      timeoutTermination
    );
    return configurationFailure(
      `Adapter timed out after ${timeoutMs} ms`,
      stderr,
      timeoutMs
    );
  }
  if (outcome.kind === "configuration") {
    const stderr = await terminateAndCollect(
      subprocess,
      stdoutCapture,
      stderrCapture
    );
    return configurationFailure(outcome.message, stderr);
  }

  const stdout = stdoutCapture.text();
  const stderr = stderrCapture.text();
  if (outcome.exitCode !== 0) {
    return {
      error: {
        exitCode: outcome.exitCode,
        kind: "process",
        message: `Adapter exited with status ${outcome.exitCode}`,
      },
      ok: false,
      stderr,
    };
  }

  let parsedResponse: unknown;
  try {
    parsedResponse = JSON.parse(stdout);
  } catch {
    return {
      error: {
        errors: ["stdout must contain exactly one JSON response"],
        kind: "protocol",
        message: "Adapter returned invalid JSON",
      },
      ok: false,
      stderr,
    };
  }

  const validation = validateRunnerResponse(parsedResponse);
  if (!validation.ok) {
    return {
      error: {
        errors: validation.errors,
        kind: "protocol",
        message: "Adapter returned an invalid runner response",
      },
      ok: false,
      stderr,
    };
  }

  return { ok: true, response: validation.value, stderr };
};
