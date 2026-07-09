import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { write } from "bun";
import { runAdapter } from "../lib/adapter.ts";
import type { RunnerRequest, RunnerResponse } from "../lib/types.ts";

const temporaryDirectories: string[] = [];

const response: RunnerResponse = {
  evaluationReport: {
    authorizationRecords: [],
    decisionCodes: ["CHANGELOG_UPDATED"],
    reasonCodes: ["USER_VISIBLE_CHANGE"],
    verificationResults: [],
    versionMap: [],
  },
  finalResponse: "Updated the pending changelog.",
  protocolVersion: 1,
  runtimeIdentity: "Fake Adapter",
  status: "completed",
};

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "simple-changelogs-adapter-"));
  temporaryDirectories.push(directory);
  return directory;
};

const createRequest = (workspace: string, timeoutMs = 1000): RunnerRequest => ({
  activationMode: "explicit",
  case: {
    activationMode: "explicit",
    fixture: "empty",
    id: "adapter-protocol",
    suite: "behavior",
    tags: ["adapter"],
    turns: [
      {
        assertions: [{ expected: "CHANGELOG_UPDATED", kind: "decision-code" }],
        prompt: "Update the pending changelog.",
      },
    ],
  },
  prompt: "Update the pending changelog.",
  protocolVersion: 1,
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

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("runAdapter", () => {
  test("executes a TypeScript adapter without shell interpolation and writes one request line", async () => {
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
  });

  test("executes a native adapter directly", async () => {
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
  });

  test("captures adapter logs from stderr separately", async () => {
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
  });

  test("returns a protocol error for malformed JSON stdout", async () => {
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
  });

  test("returns a protocol error for additional stdout after the response", async () => {
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
  });

  test("returns a process error for a nonzero exit", async () => {
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
  });

  test("returns a protocol error for an incompatible response version", async () => {
    const directory = await createTemporaryDirectory();
    const adapterPath = await writeTypeScriptAdapter(
      directory,
      `
await Bun.stdin.text();
process.stdout.write(${JSON.stringify(
        JSON.stringify({ ...response, protocolVersion: 2 })
      )});
`
    );

    const result = await runAdapter(adapterPath, createRequest(directory));

    const error = resultError(result);
    expect(error).toMatchObject({ kind: "protocol" });
    if (error.kind === "protocol") {
      expect(error.errors).toContain("$.protocolVersion must equal 1");
    }
  });

  test("returns a configuration error when the executable is missing", async () => {
    const directory = await createTemporaryDirectory();

    const result = await runAdapter(
      join(directory, "missing-adapter"),
      createRequest(directory)
    );

    expect(resultError(result)).toMatchObject({ kind: "configuration" });
  });

  test("kills and reaps an adapter that exceeds its timeout", async () => {
    const directory = await createTemporaryDirectory();
    const pidPath = join(directory, "adapter.pid");
    const adapterPath = await writeTypeScriptAdapter(
      directory,
      `
await Bun.stdin.text();
await Bun.write(${JSON.stringify(pidPath)}, String(process.pid));
setInterval(() => {}, 1_000);
`
    );

    const result = await runAdapter(adapterPath, createRequest(directory, 400));

    expect(resultError(result)).toMatchObject({
      kind: "configuration",
      timeoutMs: 400,
    });
    const pid = Number.parseInt(await readFile(pidPath, "utf8"), 10);
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
