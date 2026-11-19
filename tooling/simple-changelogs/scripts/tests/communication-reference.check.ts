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
      // Saying less never drops what a hand-off must report.
      "Never leave out what this distribution's hand-off step requires, such as the checks run and the evidence it names",
      "Ask only what is the owner's to decide, recommended answer first",
      "or the same thing twice while nothing has changed",
      // Batching never overrides a guided setup's one question at a time.
      "Ask independent decisions together; a guided setup still asks one question at a time",
      "A decision one item is waiting on blocks that item and nothing else",
      // Keeping work moving never widens what the current task may write.
      "keep going with what the current task already allows",
      // A version choice set to ask still gates every release file.
      "While a version choice set to ask is open, that is classifying the change, drafting the wording, and read-only checks: no release file or version changes until the owner answers",
      "A read-only task or a delegated `classify` writes nothing at all",
      "End a turn on a question only when nothing else can proceed",
      // True in every distribution, the CMS-only one included.
      "A delegated request still returns exactly the statuses `references/release-handoff.md` defines for this distribution; waiting on the owner never changes them",
      "is a brief for a reader who has none of your context",
      "give a reviewer the text and the rules, never your conclusion",
    ]) {
      expect(canonical).toContain(rule);
    }
  });

  test("Ultra-Simple Mode changes the words and the questions, never the authority", () => {
    for (const rule of [
      "It is a display preference, never a permission",
      "what is written, who decides versions, what may be published, and the records kept stay the same",
      "Never introduce a tool term; use the person's own",
      "the mode stays on",
      // The setup shortcut applies only where setup is wanted and unchosen.
      // Setup is still the owner's choice; the mode only words it plainly.
      "When a write task needs setup, ask the first-screen choice of `references/onboarding.md` in plain words, recommended first",
      "When the owner picks the recommended setup, take its one-answer path and show its receipt in these words",
      "only on that path do signatures, grouping, release names, and storage take the recommended default",
      "a setup path the owner names is followed as written",
      "A read-only request never starts setup",
      "A required stop is never skipped because the mode is on",
      // Still asked, whatever the mode.
      "every question an update notice lists",
      "a version choice set to ask, with a suggestion only when suggestions are on",
      'otherwise without one ("Which version should this be?")',
      "showing notes somewhere new, changing text customers have seen, or publishing, unless existing authority covers that exact destination and action",
      "One line by default, plus what the hand-off step requires",
      "Never a finished line for unfinished work: notes that exist only in the project are written, not published",
      '"What\'s new is updated: `<the customer line>`. Nothing is published yet."',
      '"Version `<number>` is written up. It is not published yet."',
      // The setting: one file, one transaction, and one place for a project.
      "writes one file, `.simple-changelogs-communication.json` beside the policy, refuses an option that asks for another settings or history change, and never replaces a file it cannot read or recovers an interrupted setup",
      "the project's Simple Changes setting (`.simple-changes-communication.json`) when this skill has none",
      "Commit it and it is the project's default",
      "Project files are read at the `--repo` root like the policy, so a checkout whose branch lacks a committed file falls through to the next setting",
      "The personal one outranks the project's: the mode grants nothing",
    ]) {
      expect(canonical).toContain(rule);
    }
  });

  test("stays short enough to need no contents list, in every distribution", async () => {
    const copies = await Promise.all(
      distributions.map((name) =>
        readFile(join(SKILLS, name, "references", "communication.md"), "utf8")
      )
    );
    for (const copy of copies) {
      expect(collapse(copy)).toBe(canonical);
      expect(copy.split("\n").length - 1).toBeLessThanOrEqual(100);
    }
  });
});
