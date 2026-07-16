import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const LOCAL_PATH_PATTERN = /(?:\/Users\/|[A-Za-z]:\\\\)/u;

const filesUnder = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    })
  );
  return paths.flat();
};

describe("CMS skill package", () => {
  test("keeps shared instructions runtime-driven and portable", async () => {
    const instructionFiles = [
      join(skillRoot, "SKILL.md"),
      ...(await filesUnder(join(skillRoot, "references"))),
    ];
    const contents = await Promise.all(
      instructionFiles.map((path) => readFile(path, "utf8"))
    );
    for (const content of contents) {
      expect(content).not.toMatch(LOCAL_PATH_PATTERN);
      expect(content).not.toContain("gitlab.com/");
    }
    expect(contents.join("\n")).toContain("Repository instructions");
  });

  test("contains exactly one discoverable SKILL.md", async () => {
    const files = await filesUnder(skillRoot);
    expect(files.filter((path) => path.endsWith("/SKILL.md"))).toHaveLength(1);
  });

  test("documents no public or developer changelog ownership", async () => {
    const instructions = await readFile(join(skillRoot, "SKILL.md"), "utf8");
    expect(instructions).toContain("does not create or update `CHANGELOG.md`");
    expect(instructions).toContain("`DEVELOPER_CHANGELOG.md`");
    expect(instructions).toContain("Do not expose the CMS history");
  });
});
