import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "bun";

const testDirectory = fileURLToPath(new URL("./tests", import.meta.url));

const checkFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return checkFiles(path);
      }
      return entry.isFile() && entry.name.endsWith(".check.ts") ? [path] : [];
    })
  );
  return files.flat().sort();
};

const files = await checkFiles(testDirectory);
if (files.length === 0) {
  throw new Error("No .check.ts test files were found");
}

// Several checks spawn helper scripts that run real Git work, which costs
// seconds on machines with slow process creation. Bun's 5s default per-test
// timeout leaves no headroom there and fails them spuriously, so this runner
// sets a generous default and lets an environment variable override it. A
// genuinely hung process still fails the run; it just fails later. An empty
// variable means unset, and the ceiling is the JavaScript timer maximum, which
// is the longest wait a per-test timeout can represent.
const DEFAULT_TEST_TIMEOUT_MS = 30_000;
const MAX_TEST_TIMEOUT_MS = 2_147_483_647;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

const resolveTimeoutMs = (variable: string): number => {
  const raw = process.env[variable]?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_TEST_TIMEOUT_MS;
  }
  if (
    !POSITIVE_INTEGER_PATTERN.test(raw) ||
    Number(raw) > MAX_TEST_TIMEOUT_MS
  ) {
    throw new Error(
      `${variable} must be a positive integer of milliseconds no greater than ${MAX_TEST_TIMEOUT_MS}; received ${JSON.stringify(raw)}`
    );
  }
  return Number(raw);
};

const timeoutMs = resolveTimeoutMs("SIMPLE_CHANGELOGS_TEST_TIMEOUT_MS");

const subprocess = spawn({
  cmd: [process.execPath, "test", "--timeout", String(timeoutMs), ...files],
  stderr: "inherit",
  stdin: "inherit",
  stdout: "inherit",
});
process.exitCode = await subprocess.exited;
