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

const subprocess = spawn({
  cmd: [process.execPath, "test", ...files],
  stderr: "inherit",
  stdin: "inherit",
  stdout: "inherit",
});
process.exitCode = await subprocess.exited;
