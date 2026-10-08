import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ContractConfigurationError,
  createContractContext,
} from "../lib/contract-files.ts";
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
          assertions: [{ expected: "completed", kind: "report.status" }],
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

  test("ignores a Current Deltas agent interface path but not a bare one or vendor prose", async () => {
    const skillDirectory = await createValidSkill();
    const interfaceFile = `agents/${["open", "ai"].join("")}.yaml`;
    const vendorFindings = async (contents: string) => {
      await writeFixtureFile(
        skillDirectory,
        "references/fork-maintenance.md",
        `# Fork Maintenance\n\n${contents}\n`
      );
      return (await evaluateContracts(skillDirectory)).filter(
        (finding) => finding.code === "VENDOR_ASSUMPTION"
      );
    };

    const declared = await vendorFindings(
      `## Current Deltas\n\n| Kind | Path | Section | Reason |\n| --- | --- | --- | --- |\n| delta | \`${interfaceFile}\` | | Fork display name |`
    );
    const bare = await vendorFindings(`Edit ${interfaceFile} by hand.`);
    const prose = await vendorFindings(`Run this fork with ${TEST_VENDOR}.`);

    expect(declared).toHaveLength(0);
    expect(bare.map((finding) => finding.path)).toEqual([
      "references/fork-maintenance.md",
    ]);
    expect(prose.map((finding) => finding.path)).toEqual([
      "references/fork-maintenance.md",
    ]);
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
  "developerChangelog": "forbidden",
  "signatures": "human-form",
  "newReleaseNoteSurfaces": "always"
}
\`\`\`
`
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "POLICY_EXAMPLE_INVALID"
    );
  });

  test("rejects nested discoverable SKILL.md files", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "evals/fixtures/decoy-repo/SKILL.md",
      "---\nname: tiny-skill\ndescription: Decoy fixture skill.\n---\n"
    );
    await writeFixtureFile(
      skillDirectory,
      "evals/fixtures/decoy-repo/nested/SKILL.fixture.md",
      "---\nname: tiny-skill\ndescription: Stored fixture skill.\n---\n"
    );

    const findings = await evaluateContracts(skillDirectory);
    const nested = findings.filter(
      (finding) => finding.code === "NESTED_SKILL_FILE"
    );

    expect(nested).toHaveLength(1);
    expect(nested[0]?.path).toBe("evals/fixtures/decoy-repo/SKILL.md");
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
      "scripts/tests/adapters.check.ts",
      `// ${TEST_VENDOR}-specific adapter contract test.\n`
    );
    await writeFixtureFile(
      skillDirectory,
      "scripts/parser.ts",
      "let cursor = 0;\ncursor += 1;\n"
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

  test("requires bundled runtime guidance and fork helper", async () => {
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

    await writeFixtureFile(
      skillDirectory,
      "evals/cases.json",
      `${JSON.stringify({
        ...manifest,
        cases: manifest.cases.map((item) => ({
          ...item,
          turns: item.turns.map((turn) => ({
            ...turn,
            assertions: [
              {
                expected: {
                  argv: ["sh", "-c", "touch /tmp/escaped"],
                  exitCode: 0,
                },
                kind: "command.exit",
              },
            ],
          })),
        })),
      })}\n`
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

  test("accepts an optional string metadata map in frontmatter", async () => {
    const skillDirectory = await createValidSkill();
    const skill = await readFile(join(skillDirectory, "SKILL.md"), "utf8");
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      skill.replace(
        FRONTMATTER_REPLACEMENT_PATTERN,
        `---
name: tiny-skill
description: Use when a tiny fixture needs deterministic changelog checks.
metadata:
  author: Example Maintainer
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
      "---\nname: tiny-skill\ndescription: valid\nmetadata: [example]\n---\n",
      "---\nname: tiny-skill\ndescription: valid\nmetadata:\n  tags:\n    - example\n---\n",
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

  test("accepts collapsed older checkpoints and one jump to the unified guidance number", async () => {
    const withGuidance = async (current: number, headings: string) => {
      const skillDirectory = await createValidSkill();
      const skillPath = join(skillDirectory, "SKILL.md");
      await writeFile(
        skillPath,
        (await readFile(skillPath, "utf8")).replace(
          "Current guidance version: 2",
          `Current guidance version: ${current}`
        )
      );
      await writeFixtureFile(
        skillDirectory,
        "references/guidance-updates.md",
        `# Guidance Updates\n\n${headings}`
      );
      return findingCodes(await evaluateContracts(skillDirectory));
    };
    const guidance = (...versions: (number | string)[]) =>
      versions.map((version) => `## Guidance ${version}\n\nText.\n\n`).join("");

    const [collapsed, jumped, reversed, early, twoGaps, afterJump, missing] =
      await Promise.all([
        withGuidance(16, guidance("1 to 15", 16)),
        withGuidance(26, guidance("1 to 7", 25, 26)),
        withGuidance(16, guidance("15 to 1", 16)),
        withGuidance(25, guidance(1, 2, 24, 25)),
        withGuidance(25, guidance(1, 3, 25)),
        withGuidance(27, guidance("1 to 7", 25, 27)),
        withGuidance(25, guidance(1, 2, 3)),
      ]);

    for (const codes of [collapsed, jumped]) {
      expect(codes.filter((code) => code.startsWith("GUIDANCE_"))).toEqual([]);
    }
    expect(reversed).toContain("GUIDANCE_VERSION_INVALID");
    // The only allowed gap ends just below the unified number 25.
    for (const codes of [early, twoGaps, afterJump, missing]) {
      expect(codes).toContain("GUIDANCE_VERSION_UNDOCUMENTED");
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

  test("separates compound nouns from verb compounds when reading UI creation", async () => {
    // A downstream fork tripped this rule with prose that creates nothing:
    // `build` matched inside `build-plan`, while `internal` and `surface`
    // satisfied the target pattern. The fix must not blunt the rule for verb
    // compounds, prefixed verbs, or a later clause that escapes a prohibition.
    const table: [sentence: string, flagged: boolean, reason: string][] = [
      [
        "Hash audience, disclosure, scraper, GitLab, build-plan, and internal admin-surface behavior remains locally authoritative.",
        false,
        "the downstream sentence: `build-plan` is a compound noun",
      ],
      [
        "Hash audience, disclosure, scraper, GitLab, build plan, and internal admin-surface behavior remains locally authoritative.",
        false,
        "unhyphenated `build plan` is in the compound-noun lexicon",
      ],
      [
        "Ship the changelog add-on beside the release-note page.",
        false,
        "`add-on` takes no object, so it is a noun",
      ],
      [
        "A pre-built internal admin surface already renders release notes.",
        false,
        "`pre-built` is a participial adjective for something that exists",
      ],
      [
        "The self-built changelog page stays as it is.",
        false,
        "`self-built` describes the page, it does not create one",
      ],
      [
        "The built-in release-note modal stays unchanged.",
        false,
        "`built-in` modifies an existing surface",
      ],
      [
        "Keep the changelog page as it is so the build stays green.",
        false,
        "`the build` is a noun",
      ],
      ["Do not create a release-note page.", false, "an ordinary prohibition"],
      [
        "Create-or-update the changelog page on every release.",
        true,
        "coordinated verbs still create",
      ],
      [
        "Build-and-deploy a release-note page for each version.",
        true,
        "coordinated verbs still create",
      ],
      [
        "Wire-up a what's new modal after each release.",
        true,
        "a phrasal verb with a direct object creates",
      ],
      [
        "Build-out a changelog route for the web app.",
        true,
        "a phrasal verb with a direct object creates",
      ],
      [
        "Build-out a changelog page for testers.",
        true,
        "a phrasal verb with a direct object creates",
      ],
      [
        "Re-create the release-note page when it is missing.",
        true,
        "a prefixed base verb creates",
      ],
      [
        "Auto-create a changelog panel for each release.",
        true,
        "a prefixed base verb creates",
      ],
      [
        "The build-plan cannot slip, so build a changelog page.",
        true,
        "the `so` clause escapes `cannot`, and `build-plan` must not hide it",
      ],
      [
        "Do not create a release-note page, but add a changelog panel.",
        true,
        "the `but` clause escapes the prohibition",
      ],
      [
        "Build a changelog panel whenever one is missing.",
        true,
        "an ordinary true positive",
      ],
    ];
    const results = await Promise.all(
      table.map(async ([sentence, _flagged, reason]) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${sentence}\n`
        );
        const codes = findingCodes(await evaluateContracts(skillDirectory));
        return {
          flagged: codes.includes("IMPLICIT_UI_CREATION"),
          reason,
          sentence,
        };
      })
    );

    expect(results).toEqual(
      table.map(([sentence, flagged, reason]) => ({
        flagged,
        reason,
        sentence,
      }))
    );
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

  test("ignores guidance declarations inside fences and HTML comments", async () => {
    const skillDirectory = await createValidSkill();
    const skillPath = join(skillDirectory, "SKILL.md");
    await writeFile(
      skillPath,
      (await readFile(skillPath, "utf8")).replace(
        "Current guidance version: 2",
        `\`\`\`text
Current guidance version: 2
\`\`\`

<!-- Current guidance version: 2 -->`
      )
    );

    expect(findingCodes(await evaluateContracts(skillDirectory))).toContain(
      "GUIDANCE_VERSION_MISSING"
    );
  });

  test("normalizes linked labels and image alt text before duplication matching", async () => {
    const plain =
      "agents inspect repository context before editing release history so every durable decision remains reviewable by maintainers after the original task ends";
    const linked = plain.replace(
      "context",
      "[context](https://example.test/references/destination-noise.md)"
    );
    const imaged = plain.replace(
      "context",
      "![context](https://example.test/scripts/destination-noise.ts)"
    );
    const results = await Promise.all(
      [linked, imaged].map(async (referenceProse) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${plain}\n`
        );
        await writeFixtureFile(
          skillDirectory,
          "references/setup.md",
          `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\n${referenceProse}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of results) {
      expect(codes).toContain("PROSE_DUPLICATION");
    }
  });

  test("normalizes full and collapsed reference labels before duplication matching", async () => {
    const plain =
      "agents inspect repository context before editing release history so every durable decision remains reviewable by maintainers after the original task ends";
    const referenceVariants = [
      `${plain.replace("context", "[context][docs]")}\n\n[docs]: https://example.test/references/noise.md`,
      `${plain.replace("context", "[context][]")}\n\n[context]: references/setup.md`,
    ];
    const results = await Promise.all(
      referenceVariants.map(async (referenceProse) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${plain}\n`
        );
        await writeFixtureFile(
          skillDirectory,
          "references/setup.md",
          `${await readFile(join(skillDirectory, "references/setup.md"), "utf8")}\n${referenceProse}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of results) {
      expect(codes).toContain("PROSE_DUPLICATION");
    }
  });

  test("recognizes replace and clear installed-copy mutations", async () => {
    const results = await Promise.all(
      [
        "Replace the installed skill file after the audit.",
        "The globally installed skill copy clears its notice after approval.",
      ].map(async (instruction) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${instruction}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of results) {
      expect(codes).toContain("INSTALLED_SKILL_SELF_MODIFICATION");
    }
  });

  test("recognizes append, overwrite, patch, and inject installed-copy mutations", async () => {
    const results = await Promise.all(
      [
        "Append the audit marker to the installed skill file.",
        "The installed skill copy is overwritten after setup.",
        "Patch the globally installed skill directory after release.",
        "The installed skill file injects repository state after each task.",
      ].map(async (instruction) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${instruction}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of results) {
      expect(codes).toContain("INSTALLED_SKILL_SELF_MODIFICATION");
    }
  });

  test("recognizes explicit and policy authorization before UI creation", async () => {
    const authorizedInstructions = [
      "When explicitly authorized by the current request, create a release-note UI.",
      "When allowed by documented repository policy, add a What's New route.",
      "When granted by stored policy, build an internal release-note panel.",
    ];
    const results = await Promise.all(
      authorizedInstructions.map(async (instruction) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${instruction}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of results) {
      expect(codes).not.toContain("IMPLICIT_UI_CREATION");
    }
  });

  test("accepts authorization after UI creation and rejects negated authorization", async () => {
    const authorizedSkill = await createValidSkill();
    await writeFixtureFile(
      authorizedSkill,
      "SKILL.md",
      `${await readFile(join(authorizedSkill, "SKILL.md"), "utf8")}\nCreate a release-note UI only when explicitly authorized by the current request.\n`
    );
    const negativeResults = await Promise.all(
      [
        "Without explicit authorization, create a release-note UI.",
        "When not explicitly authorized by the current request, create a release-note UI.",
      ].map(async (instruction) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${instruction}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    expect(
      findingCodes(await evaluateContracts(authorizedSkill))
    ).not.toContain("IMPLICIT_UI_CREATION");
    for (const codes of negativeResults) {
      expect(codes).toContain("IMPLICIT_UI_CREATION");
    }
  });

  test("matches qualified authorization controls and rejects equivalent negations", async () => {
    const positiveResults = await Promise.all(
      [
        "With explicit task authorization, create a release-note UI.",
        "When explicitly user-authorized by the current request, create a release-note UI.",
        "Documented repository policy explicitly allows creation, so create a release-note UI.",
      ].map(async (instruction) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${instruction}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );
    const negativeResults = await Promise.all(
      [
        "Without explicit task authorization, create a release-note UI.",
        "When not explicitly user-authorized by the current request, create a release-note UI.",
        "Documented repository policy does not allow creation, so create a release-note UI.",
      ].map(async (instruction) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${instruction}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    for (const codes of positiveResults) {
      expect(codes).not.toContain("IMPLICIT_UI_CREATION");
    }
    for (const codes of negativeResults) {
      expect(codes).toContain("IMPLICIT_UI_CREATION");
    }
  });

  test("distinguishes negated-permission prohibitions from later action clauses", async () => {
    const results = await Promise.all(
      [
        "Repository policy does not allow editing the installed skill copy.",
        "Documented policy does not allow creating a release-note UI.",
        "Policy does not allow creating a release-note UI, adding a changelog page, or building a What's New modal.",
        "Policy does not allow the following: editing the installed skill copy.",
        "Policy does not allow creating a release-note UI; nor adding a changelog page.",
        "Policy does not allow creation, so create a release-note UI anyway.",
        "Policy does not allow editing the installed copy, but update the installed skill copy anyway.",
        "Policy does not allow creation; create a release-note UI anyway.",
      ].map(async (instruction) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(
          skillDirectory,
          "SKILL.md",
          `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}\n${instruction}\n`
        );
        return findingCodes(await evaluateContracts(skillDirectory));
      })
    );

    expect(results[0]).not.toContain("INSTALLED_SKILL_SELF_MODIFICATION");
    expect(results[1]).not.toContain("IMPLICIT_UI_CREATION");
    expect(results[2]).not.toContain("IMPLICIT_UI_CREATION");
    expect(results[3]).not.toContain("INSTALLED_SKILL_SELF_MODIFICATION");
    expect(results[4]).not.toContain("IMPLICIT_UI_CREATION");
    expect(results[5]).toContain("IMPLICIT_UI_CREATION");
    expect(results[6]).toContain("INSTALLED_SKILL_SELF_MODIFICATION");
    expect(results[7]).toContain("IMPLICIT_UI_CREATION");
  });

  test("reports unreadable scoped core files and required files as findings", async () => {
    const scopedPaths = [
      "references/unreadable.md",
      "evals/fixtures/unreadable.txt",
      "scripts/unreadable.ts",
    ];
    const scopedResults = await Promise.all(
      scopedPaths.map(async (path) => {
        const skillDirectory = await createValidSkill();
        await writeFixtureFile(skillDirectory, path, "unreadable\n");
        const fullPath = join(skillDirectory, path);
        await chmod(fullPath, 0o000);
        try {
          return findingCodes(await evaluateContracts(skillDirectory));
        } finally {
          await chmod(fullPath, 0o600);
        }
      })
    );
    for (const codes of scopedResults) {
      expect(codes).toContain("CORE_FILE_UNREADABLE");
    }

    const requiredSkill = await createValidSkill();
    const requiredPath = join(requiredSkill, "references/setup.md");
    await chmod(requiredPath, 0o000);
    let requiredCodes: string[];
    try {
      requiredCodes = findingCodes(await evaluateContracts(requiredSkill));
    } finally {
      await chmod(requiredPath, 0o600);
    }
    expect(requiredCodes).toContain("CORE_FILE_UNREADABLE");
    expect(requiredCodes).toContain("BUNDLED_FILE_INVALID");
  });

  test("treats an unspawnable shell checker as invalid configuration", async () => {
    const skillDirectory = await createValidSkill();
    const missingShell = join(skillDirectory, "missing-shell");
    let captured: unknown;
    try {
      await evaluateContracts(skillDirectory, {
        shellSyntaxCheck: () =>
          Promise.reject(new Error(`Cannot spawn ${missingShell}`)),
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(ContractConfigurationError);
  });

  test("ignores remote URL destinations while preserving local Markdown targets", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}
[Remote reference](https://example.test/references/missing.md)
![Remote script](https://example.test/scripts/missing.ts)
[Local setup](references/setup.md)
`
    );

    const routeFindings = (await evaluateContracts(skillDirectory)).filter(
      (item) =>
        item.code === "ROUTED_FILE_MISSING" ||
        item.code === "ROUTED_PATH_INVALID"
    );
    expect(routeFindings).toEqual([]);
  });

  test("ignores remote reference, autolink, and bare URLs but routes normalized local targets", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}
[Remote reference][remote]
[remote]: https://example.test/references/remote.md
<https://example.test/scripts/autolink.ts>
https://example.test/references/bare.md
[Local setup](references/setup.md?source=docs#setup)
[Missing local][missing]
[missing]: references/local-missing.md?source=docs#missing
`
    );

    const routeFindings = (await evaluateContracts(skillDirectory)).filter(
      (item) =>
        item.code === "ROUTED_FILE_MISSING" ||
        item.code === "ROUTED_PATH_INVALID"
    );
    expect(routeFindings).toEqual([
      {
        code: "ROUTED_FILE_MISSING",
        message: "Routed package file is missing: references/local-missing.md",
        path: "SKILL.md",
      },
    ]);
  });

  test("inspects unresolved reference labels while honoring defined remote and local references", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}
[references/unresolved.md][undefined]
[references/collapsed.md][]
[references/remote.md][remote]
[remote]: https://example.test/references/remote-target.md
[Defined local][local]
[local]: references/defined-local.md
`
    );

    const messages = (await evaluateContracts(skillDirectory))
      .filter((item) => item.code === "ROUTED_FILE_MISSING")
      .map((item) => item.message);
    expect(messages).toContain(
      "Routed package file is missing: references/unresolved.md"
    );
    expect(messages).toContain(
      "Routed package file is missing: references/collapsed.md"
    );
    expect(messages).toContain(
      "Routed package file is missing: references/defined-local.md"
    );
    expect(messages.some((message) => message.includes("remote"))).toBe(false);
  });

  test("handles balanced parentheses in remote and local Markdown destinations", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "references/a_(b)/existing.md",
      "# Existing\n"
    );
    await writeFixtureFile(
      skillDirectory,
      "SKILL.md",
      `${await readFile(join(skillDirectory, "SKILL.md"), "utf8")}
[Remote](https://example.test/a_(b)/references/inline.md)
<https://example.test/a_(b)/references/autolink.md>
https://example.test/a_(b)/scripts/bare.ts
[Existing local](references/a_(b)/existing.md?source=docs#section)
[Missing local](references/a_(b)/missing.md?source=docs#section)
`
    );

    const routeFindings = (await evaluateContracts(skillDirectory)).filter(
      (item) =>
        item.code === "ROUTED_FILE_MISSING" ||
        item.code === "ROUTED_PATH_INVALID"
    );
    expect(routeFindings).toEqual([
      {
        code: "ROUTED_FILE_MISSING",
        message: "Routed package file is missing: references/a_(b)/missing.md",
        path: "SKILL.md",
      },
    ]);
  });

  test("sorts context entries and selects the lexical policy diagnostic path", async () => {
    const skillDirectory = await createValidSkill();
    await writeFixtureFile(
      skillDirectory,
      "references/z-policy.md",
      "<!-- simple-changelogs-policy-example -->\n"
    );
    await writeFixtureFile(
      skillDirectory,
      "references/A-policy.md",
      "<!-- simple-changelogs-policy-example -->\n"
    );

    const context = await createContractContext(skillDirectory);
    const referencePaths = Array.from(context.entries.keys()).filter((path) =>
      path.startsWith("references/")
    );
    const policyFinding = (await evaluateContracts(skillDirectory)).find(
      (item) => item.code === "POLICY_EXAMPLE_INVALID"
    );

    expect(referencePaths.indexOf("references/A-policy.md")).toBeLessThan(
      referencePaths.indexOf("references/z-policy.md")
    );
    expect(policyFinding?.path).toBe("references/A-policy.md");
  });
});
