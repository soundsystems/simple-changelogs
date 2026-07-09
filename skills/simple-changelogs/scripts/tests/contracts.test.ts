import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ContractConfigurationError } from "../lib/contract-files.ts";
import { evaluateContracts } from "../lib/contracts.ts";

const temporaryDirectories: string[] = [];
const FRONTMATTER_REPLACEMENT_PATTERN = /^---[\s\S]*?---/;
const TEST_VENDOR = ["Co", "dex"].join("");

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

<!-- simple-changelogs-policy-example -->
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
      "# Guidance Updates\n\n## Guidance 1\n\nInitial rules.\n\n## Guidance 2\n\nPortable rules.\n"
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

<!-- simple-changelogs-policy-example -->
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
      "# Guidance Updates\n\n## Guidance 1\n\nInitial rules.\n"
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
      `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\nRun this workflow with ${TEST_VENDOR}.\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "scripts/adapters/example.ts",
      `// ${TEST_VENDOR}-specific adapter implementation.\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "references/guidance-updates.md",
      `${await readFile(join(skillDirectory, "references/guidance-updates.md"), "utf8")}\n<!-- simple-changelogs-signature agent="${TEST_VENDOR}" at="unreported" -->\n`
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

  test("rejects missing, non-directory, and symlinked skill roots as configuration errors", async () => {
    const root = await mkdtemp(join(tmpdir(), "simple-changelogs-root-"));
    temporaryDirectories.push(root);
    const fileRoot = join(root, "not-a-directory");
    const missingRoot = join(root, "missing");
    const realRoot = await createValidSkill();
    const linkedRoot = join(root, "linked-skill");
    await writeFile(fileRoot, "not a skill directory\n");
    await symlink(realRoot, linkedRoot);

    const errors = await Promise.all(
      [missingRoot, fileRoot, linkedRoot].map(async (path) => {
        try {
          await evaluateContracts(path);
        } catch (error) {
          return error;
        }
      })
    );

    expect(errors).toHaveLength(3);
    for (const error of errors) {
      expect(error).toBeInstanceOf(ContractConfigurationError);
    }
  });

  test("rejects absolute, dot-segment, and escaping routed paths", async () => {
    const routedPaths = [
      "/references/setup.md",
      "references/./setup.md",
      "references/../outside.md",
      "references/../../outside.md",
    ];
    const results = await Promise.all(
      routedPaths.map(async (routedPath) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(skillDirectory, "outside.md", "# Outside\n");
        await writeFile(
          join(dirname(skillDirectory), "outside.md"),
          "outside\n"
        );
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\nRead \`${routedPath}\`.\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of results) {
      expect(codes).toContain("ROUTED_PATH_INVALID");
    }
  });

  test("rejects symlinks and non-file required bundle entries", async () => {
    const skillDirectory = await createValidSkill();
    const outside = join(dirname(skillDirectory), "outside-setup.md");
    await writeFile(outside, "# Outside setup\n");
    await rm(join(skillDirectory, "references/setup.md"));
    await symlink(outside, join(skillDirectory, "references/setup.md"));
    await rm(join(skillDirectory, "scripts/eval.ts"));
    await mkdir(join(skillDirectory, "scripts/eval.ts"));

    const codes = findingCodes(await evaluateContracts(skillDirectory));

    expect(codes).toContain("SYMLINK_NOT_ALLOWED");
    expect(codes).toContain("BUNDLED_FILE_INVALID");
    expect(codes).toContain("ROUTED_PATH_INVALID");
  });

  test("parses quoted, commented, and folded YAML frontmatter", async () => {
    const skillDirectory = await createValidSkill();
    const skill = await readFile(join(skillDirectory, "SKILL.md"), "utf8");
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      skill.replace(
        FRONTMATTER_REPLACEMENT_PATTERN,
        `---
# YAML comments and folded strings are valid.
name: "tiny-skill"
description: >-
  Use when a portable fixture needs
  deterministic contract checks.
---`
      )
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).not.toContain(
      "FRONTMATTER_INVALID"
    );
  });

  test("rejects malformed, non-object, and extra-field frontmatter", async () => {
    const frontmatterCases = [
      "---\nname: [unterminated\ndescription: bad\n---\n",
      "---\n- tiny-skill\n- description\n---\n",
      "---\nname: tiny-skill\ndescription: valid\nextra: forbidden\n---\n",
    ];
    const results = await Promise.all(
      frontmatterCases.map(async (frontmatter) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${frontmatter}\n# Tiny Skill\n\nCurrent guidance version: 2\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of results) {
      expect(codes).toContain("FRONTMATTER_INVALID");
    }
  });

  test("requires one explicitly marked adjacent policy example", async () => {
    const skillDirectory = await createValidSkill();
    const setupPath = join(skillDirectory, "references/setup.md");
    await writeFile(
      setupPath,
      (await readFile(setupPath, "utf8")).replace(
        "<!-- simple-changelogs-policy-example -->\n",
        ""
      )
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "POLICY_EXAMPLE_MISSING"
    );
  });

  test("validates marked JSONC tilde fences even when required keys are absent", async () => {
    const validSkill = await createValidSkill();
    await writeFixtureFile(
      validSkill,
      "references/setup.md",
      `# Setup

<!-- simple-changelogs-policy-example -->
~~~jsonc
{
  // Portable repository policy.
  "schemaVersion": 1,
  "guidance": { "version": 2, "backfillStatus": "completed" },
  "developerChangelog": "required",
  "signatures": "agent-and-timestamp",
  "newReleaseNoteSurfaces": "ask",
}
~~~
`
    );
    const invalidSkill = await createValidSkill();
    await writeFixtureFile(
      invalidSkill,
      "references/setup.md",
      `# Setup

<!-- simple-changelogs-policy-example -->
\`\`\`json
{ "schemaVersion": 1 }
\`\`\`
`
    );

    expect(findingCodes(await evaluateContracts(validSkill))).not.toContain(
      "POLICY_EXAMPLE_INVALID"
    );
    expect(findingCodes(await evaluateContracts(invalidSkill))).toContain(
      "POLICY_EXAMPLE_INVALID"
    );
  });

  test("rejects unsafe guidance versions without unbounded iteration", async () => {
    const results = await Promise.all(
      ["0", "-2", "1.5", "1e309"].map(async (version) => {
        const skillDirectory = await createValidSkill();
        const skillPath = join(skillDirectory, "SKILL.md");
        await writeFile(
          skillPath,
          (await readFile(skillPath, "utf8")).replace(
            "Current guidance version: 2",
            `Current guidance version: ${version}`
          )
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of results) {
      expect(codes).toContain("GUIDANCE_VERSION_INVALID");
    }
  });

  test("ignores fake guidance headings in fences and comments and rejects duplicate real headings", async () => {
    const missingSkill = await createValidSkill();
    await writeFixtureFile(
      missingSkill,
      "references/guidance-updates.md",
      `# Guidance Updates

## Guidance 1

\`\`\`text
## Guidance 2
\`\`\`

<!-- ## Guidance 2 -->
`
    );
    const duplicateSkill = await createValidSkill();
    await writeFixtureFile(
      duplicateSkill,
      "references/guidance-updates.md",
      "# Guidance Updates\n\n## Guidance 1\n\nFirst.\n\n## Guidance 1\n\nDuplicate.\n\n## Guidance 2\n"
    );

    expect(findingCodes(await evaluateContracts(missingSkill))).toContain(
      "GUIDANCE_VERSION_UNDOCUMENTED"
    );
    expect(findingCodes(await evaluateContracts(duplicateSkill))).toContain(
      "GUIDANCE_VERSION_DUPLICATED"
    );
  });

  test("detects installed-copy mutation in either phrase order but accepts prohibitions", async () => {
    const positiveSkill = await createValidSkill();
    await writeFixtureFile(
      positiveSkill,
      "SKILL.md",
      `${await readFile(join(positiveSkill, "SKILL.md"), "utf8")}\nThe installed skill copy should update its notice after approval.\n`
    );
    const negativeSkill = await createValidSkill();
    await writeFixtureFile(
      negativeSkill,
      "SKILL.md",
      `${await readFile(join(negativeSkill, "SKILL.md"), "utf8")}\nNever modify the installed skill copy. Do not delete files from the globally installed skill directory.\n`
    );

    expect(findingCodes(await evaluateContracts(positiveSkill))).toContain(
      "INSTALLED_SKILL_SELF_MODIFICATION"
    );
    expect(findingCodes(await evaluateContracts(negativeSkill))).not.toContain(
      "INSTALLED_SKILL_SELF_MODIFICATION"
    );
  });

  test("recognizes mutation inflections and passive prohibitions", async () => {
    const positiveSkill = await createValidSkill();
    await writeFixtureFile(
      positiveSkill,
      "SKILL.md",
      `${await readFile(join(positiveSkill, "SKILL.md"), "utf8")}\nThe globally installed skill file is modified after each audit.\n`
    );
    const negativeSkill = await createValidSkill();
    await writeFixtureFile(
      negativeSkill,
      "SKILL.md",
      `${await readFile(join(negativeSkill, "SKILL.md"), "utf8")}\nEditing the installed skill copy is not allowed.\n`
    );

    expect(findingCodes(await evaluateContracts(positiveSkill))).toContain(
      "INSTALLED_SKILL_SELF_MODIFICATION"
    );
    expect(findingCodes(await evaluateContracts(negativeSkill))).not.toContain(
      "INSTALLED_SKILL_SELF_MODIFICATION"
    );
  });

  test("treats without-asking UI creation as implicit and requires concrete authorization", async () => {
    const implicitSkill = await createValidSkill();
    await writeFixtureFile(
      implicitSkill,
      "SKILL.md",
      `${await readFile(join(implicitSkill, "SKILL.md"), "utf8")}\nCreate a release-note UI without asking when no surface exists.\n`
    );
    const authorizedSkill = await createValidSkill();
    await writeFixtureFile(
      authorizedSkill,
      "SKILL.md",
      `${await readFile(join(authorizedSkill, "SKILL.md"), "utf8")}\nCreate a release-note UI only when the current request explicitly authorizes it or documented repository policy allows it.\n`
    );

    expect(findingCodes(await evaluateContracts(implicitSkill))).toContain(
      "IMPLICIT_UI_CREATION"
    );
    expect(
      findingCodes(await evaluateContracts(authorizedSkill))
    ).not.toContain("IMPLICIT_UI_CREATION");
  });

  test("allowlists canonical policy examples independently", async () => {
    const skillDirectory = await createValidSkill();

    expect(findingCodes(await evaluateContracts(skillDirectory))).not.toContain(
      "PROSE_DUPLICATION"
    );
    expect(findingCodes(await evaluateContracts(skillDirectory))).not.toContain(
      "POLICY_EXAMPLE_INVALID"
    );
  });

  test("allowlists only canonical signature comments", async () => {
    const skillDirectory = await createValidSkill();
    const signature =
      '<!-- simple-changelogs-signature agent="one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen" at="unreported" -->';
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${signature}\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "references/setup.md",
      `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\n${signature}\n`
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).not.toContain(
      "PROSE_DUPLICATION"
    );
  });

  test("allowlists fenced command syntax independently", async () => {
    const skillDirectory = await createValidSkill();
    const commands = `\`\`\`sh
git status git log git diff git show bun test bun run typecheck bun run lint sh check one two three
\`\`\``;
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${commands}\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "references/setup.md",
      `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\n${commands}\n`
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).not.toContain(
      "PROSE_DUPLICATION"
    );
  });

  test("does not let inline code, link prose, or arbitrary comments evade duplication", async () => {
    const words =
      "agents inspect repository context before editing release history so every durable decision remains reviewable by maintainers after the original task ends";
    const wrappers = [
      (value: string) => `\`${value}\``,
      (value: string) => `[${value}](https://example.test)`,
      (value: string) => `<!-- ${value} -->`,
    ];
    const results = await Promise.all(
      wrappers.map(async (wrap) => {
        const skillDirectory = await createValidSkill();
        const wrapped = wrap(words);
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${wrapped}\n`
        );
        await writeFixtureFile(
          skillDirectory,
          "references/setup.md",
          `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\n${wrapped}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of results) {
      expect(codes).toContain("PROSE_DUPLICATION");
    }
  });

  test("ignores vendor names only in canonical signatures and adapters", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "references/setup.md",
      `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\n<!-- ${TEST_VENDOR} is required for this workflow. -->\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "references/guidance-updates.md",
      `${await readFile(join(skillDirectory, "references/guidance-updates.md"), "utf8")}\n<!-- simple-changelogs-signature agent="${TEST_VENDOR}" at="unreported" -->\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "scripts/adapters/example.ts",
      `// ${TEST_VENDOR}-specific adapter.\n`
    );

    const vendors = (await evaluateContracts(skillDirectory)).filter(
      (item) => item.code === "VENDOR_ASSUMPTION"
    );
    expect(vendors).toHaveLength(1);
    expect(vendors[0]?.path).toBe("references/setup.md");
  });

  test("normalizes shell diagnostics and sorts findings by code point", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "scripts/broken.sh",
      "#!/bin/sh\nif then\n"
    );
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\nRead \`references/a.md\` and \`references/Z.md\`.\n`
    );

    const findings = await evaluateContracts(skillDirectory);
    const shellFinding = findings.find(
      (item) => item.code === "SHELL_SYNTAX_INVALID"
    );
    const missingRoutes = findings.filter(
      (item) => item.code === "ROUTED_FILE_MISSING"
    );

    expect(shellFinding?.message).toBe(
      "POSIX shell syntax check failed for scripts/broken.sh"
    );
    expect(shellFinding?.message).not.toContain(skillDirectory);
    expect(missingRoutes.map((item) => item.message)).toEqual([
      "Routed package file is missing: references/Z.md",
      "Routed package file is missing: references/a.md",
    ]);
  });
});
