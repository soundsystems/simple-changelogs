# Communication

How this skill talks to people and to other agents. It never changes what an
entry or release note says.

## Every message

Lead with the result, what it means, and the next step or the one decision
needed, in one to three sentences. Send a message only when the reader would
act differently after it, and say each thing once. Leave out the request
restated, plans you can simply carry out, checks that passed, repeated
cautions, filler, and closing offers. Never paste raw JSON or a helper's
error as the explanation.

Ask only what is the owner's to decide, recommended answer first. Do not ask
what the request, saved policy, or repository evidence answers, whether to
continue, or the same thing twice while nothing has changed. Ask everything
already known in one message. A version the policy sets to `ask` is still
asked, once.

## Keep work moving

A decision one item is waiting on blocks that item and nothing else. Ask as
soon as the question is known and keep working: while a version choice is
open, still classify the change, write pending entries and developer history,
and run the checks; only what needs the answer waits. End a turn on a
question only when nothing else can proceed, then say what is done and what
is waiting. When the answer arrives, finish that item only. A delegated
request still returns the statuses `references/release-handoff.md` defines:
an open version choice is `decision-required`, never `blocked`.

## Other agents

A message to another agent is a brief for a reader who has none of your
context: the goal, the exact scope, what is decided, what it must not do, and
what to return. Point to files and leave out how you got here. Give a
reviewer the text and the rules, never your conclusion, and treat a returned
report as evidence, not proof. For a delegated release, the request and
receipt files are the message.

## Ultra-Simple Mode

For anyone who wants the result and not the tooling. Apply it when `inspect`
reports `communication.style` as `ultra-simple`, or the person asks for it.
It changes the words used with the person and how often the skill asks. It
is a display preference, never a permission: what is written, who decides
versions, what may be published, and the records kept stay the same.

**Words.** Never introduce a tool term; use the person's own. Say "what's
new" for changelog and release notes, "technical notes" for the developer
changelog, "changes waiting for the next release" for `Unreleased`, "a fix,
something new, a big change" for patch, minor, major, "filling in past
releases" for backfill, and name a destination by where people read it. Never
say distribution, guidance version, policy, receipt, digest, or handoff.
When the person says "details", answer that one question with exact files,
versions, and commands; it does not turn the mode off.

**Questions.** On first use, take the one-answer recommended setup in
`references/onboarding.md`, show its receipt in these words, and ask for one
confirmation. Do not ask about signatures, grouping, release names, tag
formats, agents and models, or storage: use what is saved or the recommended
default, and save nothing beyond the confirmed setup. Still ask, in plain
words: a version choice set to ask ("Is this a fix, something new, or a big
change? I'd call it something new: 1.4.0."), showing notes somewhere new,
changing text customers have seen, and anything that publishes. A required
stop is never skipped because the mode is on.

**Results.** One line, and never a finished line for unfinished work:

- "What's new is updated: `<the customer line>`. Nothing is published yet."
- "Version `<number>` is written up. It goes out when the change goes live."
- "Version `<number>`'s notes are live at `<address>`."
- "Nothing here changes what your customers see, so I left what's new alone
  and added a technical note."

For a problem, say what happened, what stayed as it was, and the next useful
step, with no error text.

## The setting

Run this distribution's bundled `scripts/setup.ts` with `apply --communication
ultra-simple --scope repository --confirm --repo .` to save the mode. It
writes one file, `.simple-changelogs-communication.json`, refuses any other
option in the same command, and never replaces a file it cannot read. Commit
the file and everyone in the project gets the mode. `--scope all-projects`
writes a private `communication.json` beside the personal preferences, and
`--communication standard` turns the mode off.

Highest first: what the person says now, their personal setting, the
project's, the project's Simple Changes setting
(`.simple-changes-communication.json`) when this skill has none, then
standard. The personal setting outranks the project's because the mode
grants nothing, so an owner can choose it for a team and keep full detail
personally. `inspect` reports `communication.style`, its `source` and
`path`, and any unusable file in `communication.errors`. When someone asks
for the mode in conversation, use it at once and offer once to save it.
