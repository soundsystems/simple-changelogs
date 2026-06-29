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
   before I open the pull or merge request."
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

### Terse policy or terms update

Prompt:

```text
The only user-facing change updates the Terms page and links the new terms from
account settings. Update release notes.
```

Expected behavior:

- Adds at most a terse customer-facing note if the product should disclose the
  document update, such as "[Product] Terms have been updated."
- Does not summarize legal clauses, internal compliance reasoning, or every
  edited paragraph.
- Adds developer context only if there was technical work maintainers need to
  remember.

### Major feature launch

Prompt:

```text
The release adds team invites, invitation emails, role selection, resend/cancel
actions, and an invite status table. Update the changelogs and release notes.
```

Expected behavior:

- Uses a clear user-facing feature name, such as "Team Invites", when the
  product does not already have a better local name.
- Adds a grouped customer-facing entry with enough nested detail for users to
  understand what they can do and where the capability shows up.
- Avoids internal API, database, component, and email-template names in the
  customer note.
- Adds developer changelog details for invite storage, permissions, email
  delivery, or tests when those details matter later.

### Pre-1.0 hot fix

Prompt:

```text
For 0.7.2, the diff fixes broken login and a checkout crash from last night's
test build. Write public release notes.
```

Expected behavior:

- Does not advertise embarrassing baseline defects as public product news.
- Checks whether login and checkout were already announced as expected
  capabilities, and does not create a second customer-facing fix announcement
  just to make that prior promise true.
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
- Places the fix near the end of the release section, or under a `Bug Fixes`
  group when the release has several public fixes.
- Does not mention regression blame or internal root cause in `CHANGELOG.md`.
- Adds developer context only if useful.

### Release-bearing branch

Prompt:

```text
We are merging this pull or merge request into the public default branch. Users
install directly from the default branch. Reconcile the changelog before merge.
```

Expected behavior:

- Treats the merge as release finalization.
- Moves shipped `Unreleased` entries into the matching version/date heading.
- Removes empty `Unreleased` sections.
- Syncs documented release-note/version fields when applicable.

### Non-release pull or merge request prep

Prompt:

```text
Prepare a draft pull or merge request for this feature branch. It is not being
released yet.
```

Expected behavior:

- Keeps pending work under `Unreleased`.
- Does not bump versions or sync release-note surfaces unless repo policy says
  pull or merge request prep is release prep.
- States the changelog decision in the handoff.

### Hidden What's New surface

Prompt:

```text
During release prep, the repo has a disabled What's New component behind an
unreachable route. Should release notes be synced there?
```

Expected behavior:

- Does not treat the hidden/disabled surface as customer-facing merely because
  code exists.
- Does not count the hidden/disabled component as an equivalent release-note
  surface.
- Wires that component into the visible app flow or creates a visible equivalent
  when the app has returning users and the release has customer-facing bullets.

### New What's New surface

Prompt:

```text
The app has returning users and shared release-note data, but no What's New
modal. Prepare the customer-facing release notes as part of release prep.
```

Expected behavior:

- Creates a visible release-note or What's New surface by default because the
  app has returning users and no equivalent exists.
- Does not create a duplicate when an existing reachable release-note or What's
  New surface already pulls from the same user-facing data.
- Pulls from the shared changelog or release-note data.
- Links the surface from a natural place in the app, such as a footer, menu,
  help area, settings, or public changelog page.
- Adds a short top-of-file comment pointing future agents to local changelog,
  release-note, or "What's New" guidance.

### Mobile monorepo release notes

Prompt:

```text
The monorepo has separate web and mobile apps. The release includes a mobile-only
offline sync improvement and an existing web What's New modal. Prepare release
notes.
```

Expected behavior:

- Does not crowd the web modal with mobile-only release notes.
- Updates or creates a mobile What's New modal, sheet, route, or screen that
  follows the mobile app's existing UI conventions.
- Shares cross-platform release notes across web and mobile only when both
  audiences benefit from the same note.
- Keeps app store or marketplace notes derived from the same customer-facing
  changelog or platform-specific release-note data.

### Internal admin or developer release notes

Prompt:

```text
The app has an authenticated admin dashboard and DEVELOPER_CHANGELOG.md includes
backend queue, API, and data-retention changes. Add release notes for operators.
```

Expected behavior:

- Adds or updates one internal release-note surface at the admin/developer area
  root instead of adding separate modals to each dashboard route.
- Pulls from `DEVELOPER_CHANGELOG.md` or equivalent internal technical history.
- Filters out frontend-only UI polish, visual fixes, marketing copy, and
  customer-only notes unless relevant to admin/developer operations or trust.
- Does not expose internal developer notes to public customers or unauthenticated
  users.

### Modal sequencing and eligibility

Prompt:

```text
The app has auth, an age gate, onboarding, and a What's New modal. Make the
release notes show automatically for this release.
```

Expected behavior:

- Shows release notes only after auth and higher-priority gates such as age
  gates, consent, required onboarding, account recovery, payment, safety, or
  mandatory migration flows.
- Auto-shows only to authenticated returning users when the app has auth.
- Defers release notes during critical tasks such as checkout, account recovery,
  safety reporting, or destructive admin actions.
- Tracks dismissal per release and per relevant surface or platform.

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
- Release-note surfaces are updated when documented or explicitly requested, and
  are added by default during release prep for apps with returning users when no
  visible equivalent exists.
- Monorepo release-note surfaces are scoped by platform and audience so web,
  mobile, admin, developer, and portal notes do not pollute unrelated surfaces.
- Internal admin/developer release-note surfaces pull from internal technical
  history and filter out frontend-only UI polish and public-customer notes unless
  they affect the internal audience.
- Auto-shown release-note modals respect auth, returning-user state,
  higher-priority gates, critical tasks, and per-surface dismissal.
- Newly created "What's New" surfaces include a short guidance comment.
