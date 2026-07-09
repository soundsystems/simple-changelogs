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

const spawnAdapter = (cmd: string[]) =>
  spawn({
    cmd,
    stderr: "pipe",
    stdin: "pipe",
    stdout: "pipe",
  });

type AdapterSubprocess = ReturnType<typeof spawnAdapter>;

const killAndReap = async (subprocess: AdapterSubprocess): Promise<void> => {
  try {
    subprocess.kill("SIGKILL");
  } catch {
    // The process may already have exited.
  }
  try {
    await subprocess.exited;
  } catch {
    // Reaping is best-effort after Bun reports a process error.
  }
};

const readOutput = async (
  output: Promise<string> | undefined
): Promise<string> => {
  if (!output) {
    return "";
  }
  try {
    return await output;
  } catch {
    return "";
  }
};

export const runAdapter = async (
  adapterPath: string,
  request: RunnerRequest,
  options: AdapterRunOptions = {}
): Promise<AdapterRunResult> => {
  const timeoutMs = options.timeoutMs ?? request.timeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    return configurationFailure(
      "Adapter timeout must be a positive safe integer"
    );
  }
  if (adapterPath.length === 0) {
    return configurationFailure("Adapter path must not be empty");
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

  const cmd = adapterPath.endsWith(".ts")
    ? [process.execPath, adapterPath]
    : [adapterPath];
  let subprocess: AdapterSubprocess;
  try {
    subprocess = spawnAdapter(cmd);
  } catch (error) {
    return configurationFailure(
      `Unable to start adapter: ${errorMessage(error)}`
    );
  }

  const stdoutPromise = new Response(subprocess.stdout).text();
  const stderrPromise = new Response(subprocess.stderr).text();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      subprocess.kill("SIGKILL");
    } catch {
      // The process may have exited while the timer callback was queued.
    }
  }, timeoutMs);

  try {
    await subprocess.stdin.write(serializedRequest);
    await subprocess.stdin.end();
  } catch (error) {
    clearTimeout(timer);
    await killAndReap(subprocess);
    const stderr = await readOutput(stderrPromise);
    if (timedOut) {
      return configurationFailure(
        `Adapter timed out after ${timeoutMs} ms`,
        stderr,
        timeoutMs
      );
    }
    return configurationFailure(
      `Unable to write adapter request: ${errorMessage(error)}`,
      stderr
    );
  }

  let exitCode: number;
  try {
    exitCode = await subprocess.exited;
  } catch (error) {
    clearTimeout(timer);
    await killAndReap(subprocess);
    return configurationFailure(
      `Unable to wait for adapter: ${errorMessage(error)}`,
      await readOutput(stderrPromise)
    );
  }
  clearTimeout(timer);

  const [stdout, stderr] = await Promise.all([
    readOutput(stdoutPromise),
    readOutput(stderrPromise),
  ]);
  if (timedOut) {
    return configurationFailure(
      `Adapter timed out after ${timeoutMs} ms`,
      stderr,
      timeoutMs
    );
  }
  if (exitCode !== 0) {
    return {
      error: {
        exitCode,
        kind: "process",
        message: `Adapter exited with status ${exitCode}`,
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
