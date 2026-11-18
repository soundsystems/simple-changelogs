import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Every distribution carries one communication reference and routes it from
// its SKILL.md. These checks pin the rules the reference exists for: say
// less, ask less, keep unblocked work moving, brief other agents, and an
// Ultra-Simple Mode that changes wording and never authority.

const REPOSITORY_ROOT = join(import.meta.dir, "..", "..", "..", "..");
const SKILLS = join(REPOSITORY_ROOT, "skills");
const collapse = (text: string): string => text.replace(/\s+/gu, " ");

const distributions = (await readdir(SKILLS)).sort();
const canonical = collapse(
  await readFile(
    join(SKILLS, "simple-changelogs", "references", "communication.md"),
    "utf8"
  )
);

describe("communication reference", () => {
  test("every distribution routes the reference and names the mode's trigger", async () => {
    expect(distributions).toHaveLength(6);
    const skills = await Promise.all(
      distributions.map(async (name) =>
        collapse(await readFile(join(SKILLS, name, "SKILL.md"), "utf8"))
      )
    );
    for (const skill of skills) {
      expect(skill).toContain(
        "Talk to people and other agents as `references/communication.md` says."
      );
      expect(skill).toContain(
        "When inspection reports `communication.style` as `ultra-simple`, also follow its Ultra-Simple Mode section."
      );
      expect(skill).toContain(
        "| Talking to people and other agents; Ultra-Simple Mode | `references/communication.md` |"
      );
    }
  });

  test("says less, asks less, and never lets one decision hold up the rest", () => {
    for (const rule of [
      "Send a message only when the reader would act differently after it, and say each thing once",
      "Never paste raw JSON or a helper's error as the explanation",
      "Ask only what is the owner's to decide, recommended answer first",
      "or the same thing twice while nothing has changed",
      "Ask everything already known in one message",
      "A version the policy sets to `ask` is still asked, once",
      "A decision one item is waiting on blocks that item and nothing else",
      "End a turn on a question only when nothing else can proceed",
      // Keeping work moving never changes what a delegated receipt reports.
      "an open version choice is `decision-required`, never `blocked`",
      "is a brief for a reader who has none of your context",
      "Give a reviewer the text and the rules, never your conclusion",
    ]) {
      expect(canonical).toContain(rule);
    }
  });

  test("Ultra-Simple Mode changes the words and the questions, never the authority", () => {
    for (const rule of [
      "It is a display preference, never a permission",
      "what is written, who decides versions, what may be published, and the records kept stay the same",
      "Never introduce a tool term; use the person's own",
      "it does not turn the mode off",
      "save nothing beyond the confirmed setup",
      // Still asked, whatever the mode.
      "a version choice set to ask",
      "showing notes somewhere new, changing text customers have seen, and anything that publishes",
      "A required stop is never skipped because the mode is on",
      "never a finished line for unfinished work",
      '"What\'s new is updated: `<the customer line>`. Nothing is published yet."',
      // The setting: one file, one transaction, and one answer for both skills.
      "writes one file, `.simple-changelogs-communication.json`, refuses any other option in the same command, and never replaces a file it cannot read",
      "the project's Simple Changes setting (`.simple-changes-communication.json`) when this skill has none",
      "The personal setting outranks the project's because the mode grants nothing",
    ]) {
      expect(canonical).toContain(rule);
    }
  });
});
