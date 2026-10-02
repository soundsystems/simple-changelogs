import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { write } from "bun";
import {
  resolveAdapterCommand,
  resolveProcessTreeKillCommand,
  runAdapter,
} from "../lib/adapter.ts";
import type { RunnerRequest, RunnerResponse } from "../lib/types.ts";

const temporaryDirectories: string[] = [];

// Creating a process costs hundreds of milliseconds before an adapter script
// reaches its first line, and more under suite contention. Every case below
// spends that latency inside the adapter timeout it passes to runAdapter, so a
// hand-picked millisecond budget turns spawn latency into a failure. Scale all
// of them from one base instead, overridable in the same spirit as
// SIMPLE_CHANGELOGS_TEST_TIMEOUT_MS in the suite runner. Only the budgets move;
// the ordering assertions stay exact.
const DEFAULT_ADAPTER_TIMEOUT_BASE_MS = 2000;
const READINESS_POLL_INTERVAL_MS = 10;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;
// lib/adapter.ts rejects timeouts above the JavaScript timer ceiling, and the
// per-test timeouts derived below must stay representable too.
const RUNTIME_TIMER_MAX_MS = 2_147_483_647;

// What the runner may spend after the kill: Bun's reap plus the 250 ms
// output-drain grace in lib/adapter.ts. The detached-descendant case below
// holds the output pipes open past the kill, so a runner that waited for them
// to close instead of giving up after the grace would miss this bound.
const CLEANUP_BOUND_MS = 1000;
const COMPLETION_TIMEOUT_MULTIPLIER = 8;
const MAX_ADAPTER_TIMEOUT_BASE_MS = Math.floor(
  (RUNTIME_TIMER_MAX_MS - CLEANUP_BOUND_MS) / COMPLETION_TIMEOUT_MULTIPLIER
);

const resolveAdapterTimeoutBaseMs = (variable: string): number => {
  const raw = process.env[variable]?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_ADAPTER_TIMEOUT_BASE_MS;
  }
  if (
    !POSITIVE_INTEGER_PATTERN.test(raw) ||
    Number(raw) > MAX_ADAPTER_TIMEOUT_BASE_MS
  ) {
    throw new Error(
      `${variable} must be a positive integer of milliseconds no greater than ${MAX_ADAPTER_TIMEOUT_BASE_MS}; received ${JSON.stringify(raw)}`
    );
  }
  return Number(raw);
};

const ADAPTER_TIMEOUT_BASE_MS = resolveAdapterTimeoutBaseMs(
  "SIMPLE_CHANGELOGS_ADAPTER_TEST_TIMEOUT_MS"
);

// Cases that expect the adapter to finish on its own end the moment it exits,
// so a ceiling no plausible spawn can reach costs them nothing.
const COMPLETION_TIMEOUT_MS =
  ADAPTER_TIMEOUT_BASE_MS * COMPLETION_TIMEOUT_MULTIPLIER;

// Cases that expect the timeout to fire pay their whole budget in wall clock,
// so they stay at the base: long enough for a slow spawn to announce readiness
// first, short enough that every run still exercises the timeout path.
const EXPIRY_TIMEOUT_MS = ADAPTER_TIMEOUT_BASE_MS;

// Readiness has to land inside the timeout window, or the case would be
// measuring spawn latency instead of the runner's cleanup.
const READINESS_TIMEOUT_MS = EXPIRY_TIMEOUT_MS;

// Bun's own per-test timeout follows the adapter budget rather than its 5s
// default, so raising the budget on a slow machine cannot make Bun abandon a
// case mid-run. Expiry cases need the budget, the runner's cleanup bound, and
// the same bound again for the cleanup in `finally`; completion cases need the
// adapter's ceiling plus cleanup, so a hung adapter is still reported by the
// runner's timeout error rather than by Bun.
const EXPIRY_TEST_TIMEOUT_MS = EXPIRY_TIMEOUT_MS + 3 * CLEANUP_BOUND_MS;
const COMPLETION_TEST_TIMEOUT_MS = COMPLETION_TIMEOUT_MS + CLEANUP_BOUND_MS;
const completionCase = { timeout: COMPLETION_TEST_TIMEOUT_MS };
const expiryCase = { timeout: EXPIRY_TEST_TIMEOUT_MS };

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const response: RunnerResponse = {
  evaluationReport: {
    authorizationRecords: [],
    decisionCodes: ["CHANGELOG_UPDATED"],
    reasonCodes: ["USER_VISIBLE_CHANGE"],
    verificationResults: [],
    versionMap: [],
  },
  finalResponse: "Updated the pending changelog.",
  protocolVersion: 2,
  runtimeIdentity: "Fake Adapter",
  status: "completed",
};

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "simple-changelogs-adapter-"));
  temporaryDirectories.push(directory);
  return directory;
};

// Adapters that never exit announce their process ids in a file so cleanup can
// reach them even when Bun abandons the case before the test body gets there.
const pidRecordPaths: string[] = [];

const createPidRecordPath = (directory: string, name: string): string => {
  const path = join(directory, name);
  pidRecordPaths.push(path);
  return path;
};

const createRequest = (
  workspace: string,
  timeoutMs = COMPLETION_TIMEOUT_MS
): RunnerRequest => ({
  activationMode: "explicit",
  case: {
    activationMode: "explicit",
    fixture: "empty",
    id: "adapter-protocol",
    suite: "behavior",
    tags: ["adapter"],
    turns: [
      {
        assertions: [
          { expected: "CHANGELOG_UPDATED", kind: "report.decision" },
        ],
        prompt: "Update the pending changelog.",
      },
    ],
  },
  prompt: "Update the pending changelog.",
  protocolVersion: 2,
  responseSchema: join(workspace, "runner-response.schema.json"),
  skillDirectory: join(workspace, "skill"),
  timeoutMs,
  turnIndex: 0,
  workspace,
});

const writeTypeScriptAdapter = async (
  directory: string,
  source: string,
  name = "adapter.ts"
): Promise<string> => {
  const adapterPath = join(directory, name);
  await write(adapterPath, source);
  return adapterPath;
};

const resultError = (
  result: Awaited<ReturnType<typeof runAdapter>>
): Extract<typeof result, { ok: false }>["error"] => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected adapter execution to fail");
  }
  return result.error;
};

const readRecordedPids = async (path: string): Promise<number[]> => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as number[];
  } catch {
    return [];
  }
};

// Wait for the adapter to announce the processes it created before the timeout
// window elapses, so the assertions that follow are about killing and reaping
// rather than about how long this machine takes to start a process. A partially
// written record simply fails to parse and is polled again.
const waitForRecordedPids = async (
  path: string,
  expectedCount: number,
  deadline = performance.now() + READINESS_TIMEOUT_MS
): Promise<number[]> => {
  const pids = await readRecordedPids(path);
  if (pids.length === expectedCount) {
    return pids;
  }
  if (performance.now() >= deadline) {
    throw new Error(
      `The adapter announced ${pids.length} of ${expectedCount} process ids within ${READINESS_TIMEOUT_MS} ms, so process creation outran the adapter timeout and this case measured spawn latency instead of timeout cleanup. Raise SIMPLE_CHANGELOGS_ADAPTER_TEST_TIMEOUT_MS on a slower machine.`
    );
  }
  await delay(READINESS_POLL_INTERVAL_MS);
  return waitForRecordedPids(path, expectedCount, deadline);
};

const waitForRecordedPid = async (path: string): Promise<number> => {
  const [pid] = await waitForRecordedPids(path, 1);
  if (pid === undefined) {
    throw new Error("Expected the adapter to announce exactly one process id");
  }
  return pid;
};

const killProcesses = (pids: number[]): void => {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The timeout cleanup may already have removed the process.
    }
  }
};

const processHasExited = async (
  pid: number,
  deadline = performance.now() + 500
): Promise<boolean> => {
  try {
    process.kill(pid, 0);
  } catch {
    return true;
  }
  if (performance.now() >= deadline) {
    return false;
  }
  await delay(10);
  return processHasExited(pid, deadline);
};

afterEach(async () => {
  const recordedPids = await Promise.all(
    pidRecordPaths.splice(0).map((path) => readRecordedPids(path))
  );
  killProcesses(recordedPids.flat());
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("adapter command resolution", () => {
  test("resolves TypeScript adapters through the current Bun executable", () => {
    const adapterPath = "/tmp/adapter;false;.ts";

    expect(resolveAdapterCommand(adapterPath)).toEqual([
      process.execPath,
      adapterPath,
    ]);
  });

  test("resolves native adapters without a shell", () => {
    const adapterPath = "/tmp/native adapter";

    expect(resolveAdapterCommand(adapterPath)).toEqual([adapterPath]);
  });

  test("resolves Windows tree termination without a shell", () => {
    expect(resolveProcessTreeKillCommand(4321, "win32")).toEqual([
      "taskkill.exe",
      "/PID",
      "4321",
      "/T",
      "/F",
    ]);
    expect(resolveProcessTreeKillCommand(4321, "darwin")).toBeUndefined();
    expect(resolveProcessTreeKillCommand(4321, "linux")).toBeUndefined();
  });
});

describe("runAdapter", () => {
  test(
    "executes a TypeScript adapter without shell interpolation and writes one request line",
    async () => {
      const directory = await createTemporaryDirectory();
      const capturePath = join(directory, "stdin.txt");
      const adapterPath = await writeTypeScriptAdapter(
        directory,
        `
const input = await Bun.stdin.text();
await Bun.write(${JSON.stringify(capturePath)}, input);
if (process.argv.length !== 2) process.exit(97);
process.stdout.write(${JSON.stringify(JSON.stringify(response))});
`,
        "adapter;false;.ts"
      );
      const request = createRequest(directory);

      const result = await runAdapter(adapterPath, request);

      expect(result).toEqual({ ok: true, response, stderr: "" });
      expect(await readFile(capturePath, "utf8")).toBe(
        `${JSON.stringify(request)}\n`
      );
    },
    completionCase
  );

  test(
    "executes a native adapter directly",
    async () => {
      const directory = await createTemporaryDirectory();
      const adapterPath = join(directory, "native-adapter");
      const responseJson = JSON.stringify(response).replaceAll("'", "'\\''");
      await write(
        adapterPath,
        `#!/bin/sh
cat >/dev/null
printf '%s' '${responseJson}'
`
      );
      await chmod(adapterPath, 0o700);

      const result = await runAdapter(adapterPath, createRequest(directory));

      expect(result).toEqual({ ok: true, response, stderr: "" });
    },
    completionCase
  );

  test(
    "captures adapter logs from stderr separately",
    async () => {
      const directory = await createTemporaryDirectory();
      const adapterPath = await writeTypeScriptAdapter(
        directory,
        `
await Bun.stdin.text();
console.error("adapter diagnostic");
process.stdout.write(${JSON.stringify(JSON.stringify(response))});
`
      );

      const result = await runAdapter(adapterPath, createRequest(directory));

      expect(result).toEqual({
        ok: true,
        response,
        stderr: "adapter diagnostic\n",
      });
    },
    completionCase
  );

  test(
    "returns a protocol error for malformed JSON stdout",
    async () => {
      const directory = await createTemporaryDirectory();
      const adapterPath = await writeTypeScriptAdapter(
        directory,
        `
await Bun.stdin.text();
process.stdout.write("not json");
`
      );

      const result = await runAdapter(adapterPath, createRequest(directory));

      expect(resultError(result)).toMatchObject({ kind: "protocol" });
    },
    completionCase
  );

  test(
    "returns a protocol error for additional stdout after the response",
    async () => {
      const directory = await createTemporaryDirectory();
      const adapterPath = await writeTypeScriptAdapter(
        directory,
        `
await Bun.stdin.text();
process.stdout.write(${JSON.stringify(`${JSON.stringify(response)}\nlog`)});
`
      );

      const result = await runAdapter(adapterPath, createRequest(directory));

      expect(resultError(result)).toMatchObject({ kind: "protocol" });
    },
    completionCase
  );

  test(
    "returns a process error for a nonzero exit",
    async () => {
      const directory = await createTemporaryDirectory();
      const adapterPath = await writeTypeScriptAdapter(
        directory,
        `
await Bun.stdin.text();
console.error("adapter failed");
process.exit(23);
`
      );

      const result = await runAdapter(adapterPath, createRequest(directory));

      expect(resultError(result)).toEqual({
        exitCode: 23,
        kind: "process",
        message: "Adapter exited with status 23",
      });
      expect(result.stderr).toBe("adapter failed\n");
    },
    completionCase
  );

  test(
    "returns a protocol error for an incompatible response version",
    async () => {
      const directory = await createTemporaryDirectory();
      const adapterPath = await writeTypeScriptAdapter(
        directory,
        `
await Bun.stdin.text();
process.stdout.write(${JSON.stringify(
          JSON.stringify({ ...response, protocolVersion: 3 })
        )});
`
      );

      const result = await runAdapter(adapterPath, createRequest(directory));

      const error = resultError(result);
      expect(error).toMatchObject({ kind: "protocol" });
      if (error.kind === "protocol") {
        expect(error.errors).toContain("$.protocolVersion must equal 2");
      }
    },
    completionCase
  );

  test("returns a configuration error when the executable is missing", async () => {
    const directory = await createTemporaryDirectory();

    const result = await runAdapter(
      join(directory, "missing-adapter"),
      createRequest(directory)
    );

    expect(resultError(result)).toMatchObject({ kind: "configuration" });
  });

  test("accepts the runtime timer ceiling without scheduling the adapter", async () => {
    const directory = await createTemporaryDirectory();

    const result = await runAdapter(
      join(directory, "missing-adapter"),
      createRequest(directory, 2_147_483_647)
    );

    expect(resultError(result)).toEqual({
      kind: "configuration",
      message: `Adapter does not exist: ${join(directory, "missing-adapter")}`,
    });
  });

  test("rejects a timeout above the runtime timer ceiling", async () => {
    const directory = await createTemporaryDirectory();

    const result = await runAdapter(
      join(directory, "missing-adapter"),
      createRequest(directory, 2_147_483_648)
    );

    expect(resultError(result)).toEqual({
      kind: "configuration",
      message: "Adapter timeout must not exceed 2147483647 ms",
    });
  });

  test(
    "kills and reaps an adapter that exceeds its timeout",
    async () => {
      const directory = await createTemporaryDirectory();
      const pidsPath = createPidRecordPath(directory, "adapter.pid.json");
      // Announce the pid before reading stdin so the record exists even when this
      // machine is slow to start a process. The adapter never exits on its own,
      // so only the runner's timeout can end it.
      const adapterPath = await writeTypeScriptAdapter(
        directory,
        `
await Bun.write(${JSON.stringify(pidsPath)}, JSON.stringify([process.pid]));
await Bun.stdin.text();
setInterval(() => {}, 1_000);
`
      );
      const runPromise = runAdapter(
        adapterPath,
        createRequest(directory, EXPIRY_TIMEOUT_MS)
      );
      let pids: number[] = [];

      try {
        const pid = await waitForRecordedPid(pidsPath);
        pids = [pid];

        expect(resultError(await runPromise)).toMatchObject({
          kind: "configuration",
          timeoutMs: EXPIRY_TIMEOUT_MS,
        });
        // A killed but unreaped child still answers signal 0 as a zombie, so this
        // asserts the reap and not merely the kill.
        expect(() => process.kill(pid, 0)).toThrow();
      } finally {
        killProcesses(pids);
        await Promise.race([runPromise, delay(CLEANUP_BOUND_MS)]);
      }
    },
    expiryCase
  );

  test(
    "bounds timeout cleanup when a detached descendant holds the output pipes",
    async () => {
      const directory = await createTemporaryDirectory();
      const pidsPath = createPidRecordPath(directory, "processes.json");
      // Announce both pids before reading stdin, so the record survives a slow
      // spawn. Neither process exits on its own. The descendant starts its own
      // process group, so the runner's group kill cannot reach it, and it keeps
      // the adapter's inherited stdout and stderr pipes open after the adapter
      // dies: only the output-drain grace lets the runner return.
      const adapterPath = await writeTypeScriptAdapter(
        directory,
        `
const descendant = Bun.spawn({
  cmd: [process.execPath, "-e", "setInterval(() => {}, 1_000)"],
  detached: true,
  stdin: "ignore",
  stdout: "inherit",
  stderr: "inherit",
});
await Bun.write(
  ${JSON.stringify(pidsPath)},
  JSON.stringify([process.pid, descendant.pid])
);
await Bun.stdin.text();
setInterval(() => {}, 1_000);
`
      );
      const timeoutMs = EXPIRY_TIMEOUT_MS;
      const deadlineMs = timeoutMs + CLEANUP_BOUND_MS;
      const startedAt = performance.now();
      const runPromise = runAdapter(
        adapterPath,
        createRequest(directory, timeoutMs)
      );
      // Start the deadline with the run, not after the readiness wait, so the
      // bound still measures the runner from the moment it spawned the adapter.
      const deadlineReached = delay(deadlineMs).then(() => ({
        kind: "deadline" as const,
      }));
      let pids: number[] = [];

      try {
        pids = await waitForRecordedPids(pidsPath, 2);
        const [adapterPid, descendantPid] = pids;

        const outcome = await Promise.race([
          runPromise.then((result) => ({ kind: "result" as const, result })),
          deadlineReached,
        ]);

        expect(outcome.kind).toBe("result");
        expect(performance.now() - startedAt).toBeLessThan(deadlineMs);
        if (outcome.kind === "result") {
          expect(resultError(outcome.result)).toMatchObject({
            kind: "configuration",
            timeoutMs,
          });
        }
        // The adapter itself was killed and reaped, while the descendant that
        // escaped the group kill is still alive: the runner returned without
        // waiting for the pipes it holds to close.
        expect(await processHasExited(adapterPid as number)).toBe(true);
        expect(() => process.kill(descendantPid as number, 0)).not.toThrow();
      } finally {
        killProcesses(pids);
        await Promise.race([runPromise, delay(CLEANUP_BOUND_MS)]);
      }
      expect(
        await Promise.all(pids.map((pid) => processHasExited(pid)))
      ).toEqual(pids.map(() => true));
    },
    expiryCase
  );
});
