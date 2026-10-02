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
// genuinely hung process still fails the run; it just fails later.
const DEFAULT_TEST_TIMEOUT_MS = "30000";
const timeoutMs =
  process.env.SIMPLE_CHANGELOGS_TEST_TIMEOUT_MS ?? DEFAULT_TEST_TIMEOUT_MS;
if (!/^[1-9][0-9]*$/.test(timeoutMs)) {
  throw new Error(
    `SIMPLE_CHANGELOGS_TEST_TIMEOUT_MS must be a positive integer of milliseconds; received ${timeoutMs}`
  );
}

const subprocess = spawn({
  cmd: [process.execPath, "test", "--timeout", timeoutMs, ...files],
  stderr: "inherit",
  stdin: "inherit",
  stdout: "inherit",
});
process.exitCode = await subprocess.exited;
