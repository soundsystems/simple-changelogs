import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { evaluateContracts } from "../lib/contracts.ts";

const temporaryDirectories: string[] = [];

const manifest = {
  cases: [
    {
      activationMode: "explicit",
      fixture: "minimal",
      id: "portable-case",
      suite: "behavior",
      tags: ["portable"],
      turns: [
        {
          assertions: [{ expected: true, kind: "report-status" }],
          prompt: "Update the pending changelogs.",
        },
      ],
    },
  ],
  manifestVersion: 1,
};

const writeFixtureFile = async (
  skillDirectory: string,
  path: string,
  contents: string
): Promise<void> => {
  const destination = join(skillDirectory, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
};

const createValidSkill = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "simple-changelogs-contracts-"));
  temporaryDirectories.push(root);
  const skillDirectory = join(root, "tiny-skill");

  await Promise.all([
    writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `---
name: tiny-skill
description: Use when a tiny fixture needs deterministic changelog checks.
---

# Tiny Skill

Current guidance version: 2

Read \`references/setup.md\` for setup and
\`references/guidance-updates.md\` for guidance changes.
`
    ),
    writeFixtureFile(
      skillDirectory,
      "EVAL.md",
      "# Evaluation\n\nRun the bundled deterministic contract suite.\n"
    ),
    writeFixtureFile(
      skillDirectory,
      "references/setup.md",
      `# Setup

Use this repository policy example:

\`\`\`json
{
  "schemaVersion": 1,
  "guidance": { "version": 2, "backfillStatus": "completed" },
  "developerChangelog": "required",
  "signatures": "agent-and-timestamp",
  "newReleaseNoteSurfaces": "ask"
}
\`\`\`
`
    ),
    writeFixtureFile(
      skillDirectory,
      "references/guidance-updates.md",
      "# Guidance Updates\n\n## Version 1\n\nInitial rules.\n\n## Version 2\n\nPortable rules.\n"
    ),
    writeFixtureFile(
      skillDirectory,
      "evals/cases.json",
      `${JSON.stringify(manifest, null, 2)}\n`
    ),
    ...[
      "eval-manifest",
      "repo-policy",
      "runner-request",
      "runner-response",
    ].map((name) =>
      writeFixtureFile(
        skillDirectory,
        `evals/schemas/${name}.schema.json`,
        "{}\n"
      )
    ),
    writeFixtureFile(
      skillDirectory,
      "scripts/check-fork-sync.sh",
      "#!/bin/sh\nset -eu\nexit 0\n"
    ),
    writeFixtureFile(skillDirectory, "scripts/eval.ts", "export {};\n"),
  ]);

  return skillDirectory;
};

const findingCodes = (
  findings: Awaited<ReturnType<typeof evaluateContracts>>
): string[] => findings.map((finding) => finding.code);

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("evaluateContracts", () => {
  test("accepts a complete portable miniature skill", async () => {
    const skillDirectory = await createValidSkill();

    expect(await evaluateContracts(skillDirectory)).toEqual([]);
  });

  test("rejects malformed frontmatter and directory/name drift", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      "---\nname: another-skill\n---\n\n# Tiny Skill\n"
    );

    const codes = findingCodes(await evaluateContracts(skillDirectory));

    expect(codes).toContain("FRONTMATTER_INVALID");
    expect(codes).toContain("SKILL_NAME_MISMATCH");
  });

  test("reports routed references that are not bundled", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\nRead \`references/missing.md\`.\n`
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "ROUTED_FILE_MISSING"
    );
  });

  test("validates repository-policy JSON examples", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "references/setup.md",
      `# Setup

\`\`\`json
{
  "schemaVersion": 1,
  "guidance": { "version": 2, "backfillStatus": "invented" },
  "developerChangelog": "optional",
  "signatures": "none",
  "newReleaseNoteSurfaces": "always"
}
\`\`\`
`
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "POLICY_EXAMPLE_INVALID"
    );
  });

  test("requires an update entry for every current guidance version", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "references/guidance-updates.md",
      "# Guidance Updates\n\n## Version 1\n\nInitial rules.\n"
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "GUIDANCE_VERSION_UNDOCUMENTED"
    );
  });

  test("detects shared normalized prose sequences of eighteen words", async () => {
    const skillDirectory = await createValidSkill();
    const duplicate =
      "Agents inspect repository context before editing release history so every durable decision remains reviewable by maintainers after the original task ends.";
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${duplicate}\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "references/setup.md",
      `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\n${duplicate}\n`
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "PROSE_DUPLICATION"
    );
  });

  test("ignores duplicated fenced policy, signature, and command syntax", async () => {
    const skillDirectory = await createValidSkill();
    const syntax = `\`\`\`text
one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen
\`\`\``;
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${syntax}\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "references/setup.md",
      `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\n${syntax}\n`
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).not.toContain(
      "PROSE_DUPLICATION"
    );
  });

  test("rejects instructions that modify the installed skill copy", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\nAfter approval, remove this notice from the installed skill copy.\n`
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "INSTALLED_SKILL_SELF_MODIFICATION"
    );
  });

  test("rejects implicit creation of new release-note UI", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\nCreate a new What's New modal by default whenever one is missing.\n`
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "IMPLICIT_UI_CREATION"
    );
  });

  test("rejects vendor assumptions in core files but ignores adapters", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "references/setup.md",
      `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\nRun this workflow with Codex.\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "scripts/adapters/example.ts",
      "// Codex-specific adapter implementation.\n"
    );
    await writeFixtureFile(
      skillDirectory,
      "references/guidance-updates.md",
      `${await readFile(join(skillDirectory, "references/guidance-updates.md"), "utf8")}\n<!-- simple-changelogs-signature agent="Codex" at="unreported" -->\n`
    );

    const vendorFindings = (await evaluateContracts(skillDirectory)).filter(
      (finding) => finding.code === "VENDOR_ASSUMPTION"
    );

    expect(vendorFindings).toHaveLength(1);
    expect(vendorFindings[0]?.path).toBe("references/setup.md");
  });

  test("requires bundled helper and evaluation files", async () => {
    const skillDirectory = await createValidSkill();
    await rm(join(skillDirectory, "scripts/check-fork-sync.sh"));

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "BUNDLED_FILE_MISSING"
    );
  });

  test("checks bundled shell scripts with POSIX shell syntax", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "scripts/broken.sh",
      "#!/bin/sh\nif then\n"
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "SHELL_SYNTAX_INVALID"
    );
  });

  test("reports malformed evaluation manifests", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "evals/cases.json",
      '{"manifestVersion":1,"cases":[]}\n'
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "EVAL_MANIFEST_INVALID"
    );
  });
});
