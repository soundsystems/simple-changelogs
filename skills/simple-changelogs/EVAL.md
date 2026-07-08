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

### Superseded developer note

Prompt:

```text
DEVELOPER_CHANGELOG.md already says the release-note UI stores copy in
per-app files. This diff replaces that with shared release-note data generated
from CHANGELOG.md. Update the developer changelog.
```

Expected behavior:

- Keeps the current shared-data implementation as the active developer note.
- Moves the obsolete per-app storage note to a `Superseded` subsection at the
  bottom of the same release section only if maintainers need that history.
- Strikes through the obsolete claim and adds concise replacement context.
- Deletes the obsolete note instead when it is routine churn with no lasting
  maintainer value.
- Does not add strikethroughs to `CHANGELOG.md`.

### Routine copy edit

Prompt:

```text
The only change fixes typos, adjusts tone in three labels, rewrites helper text,
and refreshes a marketing modal headline. Should this go in the customer
changelog?
```

Expected behavior:

- Excludes routine typo, tone, label, helper text, modal copy, marketing copy,
  placeholder, and microcopy polish from `CHANGELOG.md` merely because users can
  see it.
- Adds no developer changelog entry unless the repo has a documented reason.
- Escalates only if the wording affects legal/compliance, pricing, access,
  payment/shopping identity behavior, safety/trust requirements, durable user
  capabilities, support obligations, setup, or error recovery.

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

### Clone-sensitive public detail

Prompt:

```text
The release improves search quality by changing source precedence, parser
fallbacks, hidden ranking weights, and an AI review gate. Update the customer
changelog and developer changelog.
```

Expected behavior:

- Adds a customer-facing entry only for the visible user outcome, such as more
  relevant search results or cleaner imported records.
- Does not expose source precedence, parser rules, ranking weights, fallback
  order, AI prompts, eval criteria, confidence thresholds, queue routing, or
  hidden review triggers in `CHANGELOG.md` or public release-note surfaces.
- Preserves useful implementation detail in `DEVELOPER_CHANGELOG.md`, pull or
  merge request notes, deploy notes, or private handoff docs.
- Keeps major user-facing launches useful by explaining what users can do and
  where to find the capability without publishing an implementation recipe.

### First-time feature naming

Prompt:

```text
The diff adds the first product-page correction feature: a "something wrong?"
prompt opens a prefilled correction email from product pages. Update release
notes.
```

Expected behavior:

- Names the new capability, for example `Product Page Corrections`.
- Says what users can now do from the relevant surface, such as reporting
  inconsistent or missing product data from a product page.
- Does not frame the first launch as `easier to correct`, `clearer`, `better`,
  or `improved`, because there was no prior correction flow to compare against.
- Keeps implementation details such as mailto parameters, prefilled subject
  strings, or component names out of the customer note unless requested.

### Raw changelog signature

Prompt:

```text
Update CHANGELOG.md directly for this new Product Page Corrections feature.
```

Expected behavior:

- Adds the customer-facing changelog entry in the right release section.
- Adds a nearby hidden HTML comment signature for the changed entry or group.
- Includes the active model name/version and a short local timestamp with
  timezone in the signature.
- Does not add visible signature prose to customer-facing release notes or
  separately sign generated release-note data synced from the raw changelog.
- Ensures release-note sync or parser logic ignores hidden signature comments
  before rendering customer-facing or internal release notes.

### Internal release-note surface

Prompt:

```text
The repo has an authenticated admin/dev portal but no internal UI for developer
release notes. Add the surface from DEVELOPER_CHANGELOG.md.
```

Expected behavior:

- Adds or updates a single internal surface at the portal root instead of
  duplicating modals across nested routes.
- Labels the UI as `Release Notes` unless the repo already has a stronger local
  convention, while still using `DEVELOPER_CHANGELOG.md` as the source.
- Filters to backend, data, API, automation, security, infrastructure,
  release-process, and operations notes relevant to the internal audience.
- Ignores hidden raw-changelog signature comments when parsing the developer
  changelog for display.

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

### Merge batch with existing Unreleased

Prompt:

```text
Clean up local work by opening focused pull or merge requests, review them, merge
them into the public default branch, and get back to clean main. CHANGELOG.md on
the target branch already has a non-empty Unreleased section from earlier
customer-visible work.
```

Expected behavior:

- Treats the merge batch as release finalization when the default branch is
  release-bearing.
- Inspects the target branch changelog before and after the merge batch instead
  of looking only at the new pull or merge request diffs.
- Moves all target-contained `Unreleased` customer entries into the matching
  version/date heading before calling the cleanup complete.
- Moves matching developer notes into the same release section when they belong
  to that release.
- Runs or reports the repo-native release-note sync/check workflow.
- Does not rely on a generic changelog check passing as proof that non-empty
  `Unreleased` is acceptable.

### Release metadata drift

Prompt:

```text
Finalize 0.12.0 by moving Unreleased into CHANGELOG.md and syncing the in-app
release-note data.
```

Expected behavior:

- Treats creating or changing the released `0.12.0` section as version-tracking
  work, even if the user only mentioned changelog and release-note data.
- Compares the latest `CHANGELOG.md` version with the generated release-note
  version and every locally documented product metadata source, such as root
  package metadata, affected app package files, mobile app metadata, shared
  package versions, SDK/API/database/scraper package versions, and repo-specific
  version checks.
- Updates metadata that local policy proves belongs to the same product release.
- Leaves independently versioned packages alone and explains why they were
  intentionally skipped.
- Runs any repo-native version-consistency check when one exists, or adds a
  focused check when the repo has stable generated release-note data and stable
  product metadata sources that should share the release version.
- Final response includes a concrete version map showing each relevant source as
  `Updated`, `Already aligned`, or `Intentionally skipped`.

### Guidance-driven backfill audit

Prompt:

```text
Backfill all existing changelogs and release notes against the updated guidance.
Move, delete, or refine entries until the history is clean.
```

Expected behavior:

- Treats the prompt as explicit permission to audit existing released changelog
  and release-note history against the new guidance.
- Audits `CHANGELOG.md`, `DEVELOPER_CHANGELOG.md`, generated release-note data,
  public release-note surfaces, and internal release-note surfaces when present.
- Automatically applies drift repairs that preserve or relocate information,
  such as syncing generated data, adding missing generated-surface entries from
  source changelogs, moving clearly developer-only detail out of public notes,
  aligning unambiguous metadata, and removing empty `Unreleased` headings.
- Pauses for explicit operator permission before deleting released notes,
  materially rewording customer-facing released prose, collapsing entries,
  changing release dates or boundaries, removing small-but-real customer
  outcomes, or reclassifying ambiguous entries.
- Explains any remaining drift candidates instead of silently inventing or
  erasing released-history meaning.

### One-time guidance backfill notice

Prompt:

```text
Update the changelog for the latest feature branch. The installed skill's
SKILL.md contains a One-Time Guidance Backfill Notice.
```

Expected behavior:

- Tells the user that the one-time notice is present and asks whether to audit
  and update existing released changelog and release-note history according to
  the new guidance.
- Does not treat the notice itself as permission to rewrite released history.
- If the user approves, runs the policy or guidance backfill workflow in
  `references/backfill.md`, verifies the result, then removes the whole
  `One-Time Guidance Backfill Notice` section from the installed or forked
  skill copy.
- If the user defers, approves only a partial audit, or the backfill does not
  complete, leaves the notice in place and continues the requested changelog
  task without rewriting released history.
- If the user explicitly opts out or says not to ask again, removes the notice
  without rewriting released history and reports that no guidance backfill ran.
- Does not remove the notice after a failed or incomplete backfill.

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

### Major release modal and changelog route

Prompt:

```text
The app has returning users, no public changelog route, and no external release
archive. Version 2.0 launches several major user-facing features. Prepare the
What's New experience.
```

Expected behavior:

- Uses the modal or release-detail view for the latest major release summary and
  scannable highlights, not as an endless archive of every historical release.
- Adds or updates a real changelog route or page that carries the full relevant
  history from the same changelog or release-note source of truth.
- Links to the full changelog from the modal and a natural app navigation
  location.
- Uses one clear full-changelog action, preferably sticky when the detail area
  scrolls, and avoids duplicating the same link inline and in the footer.
- Keeps release-specific technical or docs links only when they serve a distinct
  purpose from the full changelog archive.

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

### Mobile store release notes

Prompt:

```text
Prepare the iOS and Android store release notes for this mobile release. The
full changelog includes mobile offline recovery, a web admin dashboard refresh,
database migrations, and a few internal build fixes.
```

Expected behavior:

- Produces mobile-scoped App Store and Google Play release-note copy from the
  customer-facing changelog or platform-specific release-note data.
- Includes only mobile-visible changes and shared account, auth, sync,
  notification, offline, reliability, safety, privacy, or trust changes that
  mobile users benefit from.
- Excludes web-only, admin-only, developer-only, migration, CI, package,
  internal release-process, and backend-only notes unless they directly change
  mobile behavior.
- Keeps normal release copy short enough for store constraints, using concise
  bullets or one compact paragraph instead of the full changelog.
- Avoids promotional copy and implementation mechanics such as background-task
  internals, queue/provider details, crash root causes, build-system fixes, and
  store-review workarounds.
- Checks local store metadata sources such as Fastlane, App Store Connect API
  payloads, Play Console metadata, EAS submit config, `app.json`, native version
  files, release scripts, docs, or CI workflows before claiming metadata was
  updated.
- If store metadata is remote-only, provides the exact release-note copy plus
  the command, dashboard, credential, or release-manager action needed to apply
  it.
- Adds App Store, Google Play, TestFlight, internal testing, or marketplace
  release-note fields to the final version map as `Updated`, `Already aligned`,
  or `Intentionally skipped`.

### Internal admin or developer release notes

Prompt:

```text
The app has an authenticated admin dashboard and DEVELOPER_CHANGELOG.md includes
backend queue, API, and data-retention changes. Add release notes for operators.
```

Expected behavior:

- Adds or updates one internal release-note surface at the admin/developer area
  root instead of adding separate modals to each dashboard route.
- Uses a dedicated route or panel for full internal history when the admin area
  needs more than a short latest-release summary.
- Names new visible UI `Release Notes` and prefers route/component names like
  `/admin/dev/release-notes` or `/admin/release-notes` when local routing allows.
- Pulls from `DEVELOPER_CHANGELOG.md` or equivalent internal technical history.
- Filters out frontend-only UI polish, visual fixes, marketing copy, and
  customer-only notes unless relevant to admin/developer operations or trust.
- Keeps any admin/developer modal short and links it to the full internal
  release-note route or panel instead of rendering the entire developer history
  in an auto-open modal.
- Does not expose internal developer notes to public customers or unauthenticated
  users.

### Modal depth budget

Prompt:

```text
The What's New modal currently renders six release sections, two of which are
major feature launches. Decide what should stay in the modal and what should
move behind a full release-notes link.
```

Expected behavior:

- Does not use a hard "always show exactly 3 versions" rule.
- Defaults an auto-shown modal to the latest release.
- Allows a manual modal or compact detail view to show the current major version
  or last 2-3 short releases only while the content stays easy to scan.
- Moves older or lower-priority history behind a full changelog route/page when
  the modal exceeds about two comfortable screens, 5-7 top-level groups, or
  multiple major feature sections.
- Keeps one clear full-changelog action visible instead of duplicating identical
  links.

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

### Skill maintenance regression

Prompt:

```text
Refine this changelog skill after an audit found duplicate SKILL.md and
reference-file rules, an overlong description, and checklist drift.
```

Expected behavior:

- Keeps the frontmatter description focused on trigger and negative-trigger
  conditions instead of summarizing the detailed workflow.
- Keeps `SKILL.md` as the short routing and core workflow layer, with only
  canonical examples for the customer impact gate and public detail budget.
- Keeps full include/exclude lists, clone-sensitive detail rules, hot-fix
  nuances, and grouped wording examples in `references/entry-classification.md`.
- Keeps the short final checklist in `SKILL.md` and the exhaustive final review
  plus automatable checks in `references/automation-verification.md`.
- Updates `EVAL.md` when changing skill behavior so future edits are tested
  against realistic scenarios.

### Fork sync and provenance pin

Prompt:

```text
Our repo has a fork of this skill pinned at an older upstream sha. Port the
latest upstream improvements into the fork.
```

Expected behavior:

- Reads `references/fork-maintenance.md` before editing the fork.
- Uses the fork's `Forked from \`simple-changelogs\` @ \`<sha>\`` line (or
  `scripts/check-fork-sync.sh`) to find upstream changes since the pin.
- Ports applicable upstream changes while preserving behaviors named in the
  fork's deltas list instead of overwriting them with upstream wording.
- Bumps the pinned sha to the synced upstream commit in the same edit and
  updates the deltas list if fork-specific behavior changed.
- Re-runs or updates the fork's `EVAL.md` behavior cases after material
  changes.

### Local fork precedence

Prompt:

```text
This repo has `skills/project-changelog-maintainer/SKILL.md`, forked from
`simple-changelogs`, and the agent also has upstream `simple-changelogs`
installed globally. Update the changelog for this release.
```

Expected behavior:

- Treats the repo-local fork as authoritative for this repo because its
  provenance pin identifies upstream `simple-changelogs`.
- Does not activate or apply the globally installed upstream `simple-changelogs`
  skill in the same task.
- Avoids double classification, duplicate changelog entries, duplicate release
  note syncs, or conflicting final verification from both skills.
- If the harness cannot enforce precedence, recommends repo guidance naming the
  exact local fork skill path rather than a generic "if this repo contains a
  fork" rule.

## Acceptance Rubric

Pass only if:

- Trigger language catches changelog/release-note/version tasks but rejects
  generic deploy, package bump, commit summary, UI, and code-review tasks.
- The skill description stays trigger-focused and does not become a shortcut
  summary of customer-impact, public-detail, or verification rules.
- Detailed rules live in one reference file per concern instead of being copied
  into both `SKILL.md` and references.
- Customer bullets describe visible outcomes and omit implementation details.
- Developer bullets preserve maintainable technical context without becoming raw
  commit logs.
- First-time feature launches are named as capabilities and say what users can
  now do instead of using comparative `easier/clearer/better/improved` wording.
- Raw changelog markdown edits include hidden agent signature comments with model
  name/version and local timestamp.
- `Unreleased` moves only with release intent and is removed when empty.
- Guidance-driven released-history backfills distinguish safe
  information-preserving drift repairs from destructive or meaning-changing
  edits that require explicit operator permission.
- One-time guidance backfill notices trigger an explicit user prompt, are not
  treated as rewrite permission, and are removed only after an approved and
  completed guidance backfill or explicit operator opt-out.
- Repo-local forks supersede globally installed upstream `simple-changelogs`
  copies for the same repo, preventing both skills from firing on one action.
- Version fields change only when local evidence ties them to the same release
  flow.
- Released version section edits trigger a release metadata sync audit, and the
  final response reports a concrete version map for relevant changelog,
  release-note, app, package, and store metadata sources.
- Release-note surfaces are updated when documented or explicitly requested, and
  are added by default during release prep for apps with returning users when no
  visible equivalent exists.
- Major-release modals summarize the latest release while a canonical changelog
  route, docs page, or external release source carries full history.
- Monorepo release-note surfaces are scoped by platform and audience so web,
  mobile, admin, developer, and portal notes do not pollute unrelated surfaces.
- Mobile store release notes are scoped to mobile users, respect store
  constraints, avoid promotional/internal implementation copy, and are included
  in the release metadata version map when mobile store submission is in scope.
- Internal admin/developer release-note surfaces pull from internal technical
  history and filter out frontend-only UI polish and public-customer notes unless
  they affect the internal audience.
- Auto-shown release-note modals respect auth, returning-user state,
  higher-priority gates, critical tasks, and per-surface dismissal.
- Newly created "What's New" surfaces include a short guidance comment.
