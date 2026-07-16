import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "bun";

const testDirectory = fileURLToPath(new URL("./tests", import.meta.url));
const files = (await readdir(testDirectory))
  .filter((file) => file.endsWith(".check.ts"))
  .map((file) => join(testDirectory, file))
  .sort();

if (files.length === 0) {
  throw new Error("No CMS changelog checks were found");
}

const subprocess = spawn({
  cmd: [process.execPath, "test", ...files],
  stderr: "inherit",
  stdin: "inherit",
  stdout: "inherit",
});
process.exitCode = await subprocess.exited;
