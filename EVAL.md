# Simple Changelogs Eval Prompts

Use these prompts when changing this skill or checking whether an agent follows
the intended changelog behavior.

## Trigger Query Set

Should trigger:

1. "Update CHANGELOG.md and DEVELOPER_CHANGELOG.md for the last three commits."
2. "We are about to publish 0.4.0. Move the right Unreleased entries into the
   release and tell me if the package version needs to change."
3. "Backfill a changelog from this repo's tags, but keep customer notes readable."
4. "Does this migration belong in the customer changelog or only the developer
   changelog?"
5. "Prepare release notes for the app's What's New modal from the changelog."
6. "Review this feature branch and decide whether any changelog entry is needed
   before I open the PR."
7. "The copy changed on the pricing page. Decide whether that should appear in
   the release notes."
8. "We pushed to the public docs repo default branch. Reconcile Unreleased if the
   docs changelog is now shipped."

Should not trigger:

1. "Bump this package from 1.2.3 to 1.2.4 for an internal dependency test."
2. "Summarize the last commit for Slack."
3. "Deploy the staging preview and paste the URL."
4. "Review this React component for accessibility issues."
5. "Fix the button spacing on the dashboard."
6. "Create a git tag for the current commit."
7. "Run the package manager's version command."
8. "Write a commit message for these changes."

## Behavior Cases

### Customer-visible feature

Prompt:

```text
The diff adds a new saved-search screen, navigation entry, and backend endpoint.
Update the changelogs for pending work.
```

Expected behavior:

- Adds a `CHANGELOG.md` `Unreleased` bullet describing the saved-search outcome.
- Adds a `DEVELOPER_CHANGELOG.md` `Unreleased` note for endpoint/data or tests if
  present.
- Avoids endpoint names in the customer bullet unless users need them.

### Developer-only migration

Prompt:

```text
The diff only adds a database migration and model refactor for an internal queue.
Update changelogs if needed.
```

Expected behavior:

- Does not add a customer changelog entry.
- Adds a developer changelog entry if the migration/refactor will matter later.
- Explicitly says no customer-facing changelog update is needed.

### Routine copy edit

Prompt:

```text
The only change fixes typos and adjusts tone in three labels. Should this go in
the customer changelog?
```

Expected behavior:

- Excludes routine typo, tone, label, and microcopy polish from `CHANGELOG.md`.
- Adds no developer changelog entry unless the repo has a documented reason.
- Escalates only if the wording affects legal/compliance, pricing, access,
  support obligations, setup, or error recovery.

### Pre-1.0 hot fix

Prompt:

```text
For 0.7.2, the diff fixes broken login and a checkout crash from last night's
test build. Write public release notes.
```

Expected behavior:

- Does not advertise embarrassing baseline defects as public product news.
- Either omits the public bullet or reframes only a material trust/access/payment
  improvement if the diff supports that.
- Preserves useful technical context in `DEVELOPER_CHANGELOG.md`.

### Post-1.0 public fix

Prompt:

```text
For 1.3.1, the diff fixes a regression that reset selected shipping methods when
checkout totals changed. Update release notes.
```

Expected behavior:

- Adds a calm user-outcome customer bullet, for example "Checkout now keeps the
  selected shipping method when totals update."
- Does not mention regression blame or internal root cause in `CHANGELOG.md`.
- Adds developer context only if useful.

### Release-bearing branch

Prompt:

```text
We are merging this PR into the public default branch. Users install directly
from the default branch. Reconcile the changelog before merge.
```

Expected behavior:

- Treats the merge as release finalization.
- Moves shipped `Unreleased` entries into the matching version/date heading.
- Removes empty `Unreleased` sections.
- Syncs documented release-note/version fields when applicable.

### Non-release PR prep

Prompt:

```text
Prepare a draft PR for this feature branch. It is not being released yet.
```

Expected behavior:

- Keeps pending work under `Unreleased`.
- Does not bump versions or sync release-note surfaces unless repo policy says PR
  prep is release prep.
- States the changelog decision in the handoff.

### Hidden What's New surface

Prompt:

```text
The repo has a disabled What's New component behind an unreachable route. Should
release notes be synced there?
```

Expected behavior:

- Does not treat the hidden/disabled surface as customer-facing merely because
  code exists.
- Reports that no documented visible release-note surface was found.
- Leaves the changelog as source of truth unless the task asks to create or wire
  the surface.

## Acceptance Rubric

Pass only if:

- Trigger language catches changelog/release-note/version tasks but rejects
  generic deploy, package bump, commit summary, UI, and code-review tasks.
- Customer bullets describe visible outcomes and omit implementation details.
- Developer bullets preserve maintainable technical context without becoming raw
  commit logs.
- `Unreleased` moves only with release intent and is removed when empty.
- Version fields change only when local evidence ties them to the same release
  flow.
- Release-note surfaces are updated only when documented or explicitly requested.
