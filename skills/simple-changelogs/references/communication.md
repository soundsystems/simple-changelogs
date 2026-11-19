# Communication

How this skill talks to people and to other agents. It never changes what an
entry or release note says.

## Every message

Lead with the result, what it means, and the next step or the one decision
needed, in one to three sentences. Send a message only when the reader would
act differently after it, and say each thing once. Leave out the request
restated, plans you can simply carry out, passing checks listed one by one,
repeated cautions, filler, and closing offers. Never paste raw JSON or a
helper's error as the explanation. Never leave out what this distribution's
hand-off step requires, such as the checks run and the evidence it names.

Ask only what is the owner's to decide, recommended answer first unless a
saved setting turns suggestions off. Do not ask what the request, saved
policy, or repository evidence answers, whether to continue, or the same
thing twice while nothing has changed. Ask independent decisions together; a
guided setup still asks one question at a time.

## Keep work moving

A decision one item is waiting on blocks that item and nothing else. Ask at
once and keep going with what the current task already allows. While a
version choice set to ask is open, that is classifying the change, drafting
the wording, and read-only checks: no release file or version changes until
the owner answers. A read-only task or a delegated `classify` writes nothing
at all. End a turn on a question only when nothing else can proceed, and when
the answer arrives, finish that item only. A delegated request still returns
exactly the statuses `references/release-handoff.md` defines for this
distribution; waiting on the owner never changes them.

## Other agents

A message to another agent is a brief for a reader who has none of your
context: the goal, the exact scope, what is decided, what it must not do, and
what to return. Point to files, and give a reviewer the text and the rules,
never your conclusion. Treat a returned report as evidence, not proof. For a
delegated release, the request and receipt files are the message.

## Ultra-Simple Mode

For anyone who wants the result and not the tooling. Apply it when `inspect`
reports `communication.style` as `ultra-simple`, or the person asks for it.
It changes the words used with the person and how often the skill asks. It
is a display preference, never a permission: what is written, who decides
versions, what may be published, and the records kept stay the same.

**Words.** Never introduce a tool term; use the person's own. Say "what's
new" for changelog and release notes, "technical notes" for the developer
changelog, "changes waiting for the next release" for `Unreleased`, "a fix,
something new, a big change" for patch, minor, major, and name a destination
by where people read it. Never say distribution, guidance version, policy,
receipt, digest, or handoff. When the person says "details", answer that one
question with exact files, versions, and commands; the mode stays on.

**Questions.** When a write task needs setup, ask the first-screen choice of
`references/onboarding.md` in plain words, recommended first. When the owner
picks the recommended setup, take its one-answer path and show its receipt
in these words; only on that path do signatures, grouping, release names,
and storage take the recommended default. A read-only request never starts
setup, and a setup path the owner names is followed as written. A required
stop is never skipped because the mode is on. Still ask, in plain words:

- every question an update notice lists;
- a version choice set to ask, with a suggestion only when suggestions are
  on ("Is this a fix, something new, or a big change? I'd call it something
  new: 1.4.0."), otherwise without one ("Which version should this be?");
- showing notes somewhere new, changing text customers have seen, or
  publishing, unless existing authority covers that exact destination and
  action.

**Results.** One line by default, plus what the hand-off step requires. For
a problem: what happened, what stayed as it was, and the next useful step,
with no error text. Never a finished line for unfinished work: notes that
exist only in the project are written, not published.

- "What's new is updated: `<the customer line>`. Nothing is published yet."
- "Version `<number>` is written up. It is not published yet."
- "Version `<number>`'s notes are live at `<address>`. I read them back."
- "Nothing here changes what this history's readers see, so I left it alone."

## The setting

Run this distribution's bundled `scripts/setup.ts` with `apply --communication
ultra-simple --scope repository --confirm --repo .` to save the mode. It
writes one file, `.simple-changelogs-communication.json` beside the policy,
refuses an option that asks for another settings or history change, and never
replaces a file it cannot read or recovers an interrupted setup. Commit it
and it is the project's default. `--scope all-projects` saves a private
`communication.json` for you; `--communication standard` turns it off.

Highest first: what the person says now, their personal setting, the
project's, the project's Simple Changes setting
(`.simple-changes-communication.json`) when this skill has none, then
standard. Project files are read at the `--repo` root like the policy, so a
checkout whose branch lacks a committed file falls through to the next
setting. The personal one outranks the project's: the mode grants nothing.
`inspect` reports the style, its source, and every unusable file.
