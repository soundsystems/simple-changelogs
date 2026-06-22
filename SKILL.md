---
name: simple-changelogs
description: Maintains customer-facing changelogs, internal developer changelogs, release-note data, documented product-facing "What's New" surfaces, and SemVer/version decisions. Use when updating CHANGELOG.md, DEVELOPER_CHANGELOG.md, release notes, documented product release-note surfaces, version tracking, version bumping, SemVer decisions, release prep with changelog or release-note coverage, changelog backfills, ordering release entries by impact, or deciding whether a change belongs in a changelog. Do not use for generic deployment, commit summaries, or UI work unless the task or repo policy explicitly connects that work to changelog or release-note handling. Keeps hot-fix churn, routine copy edits, and narrow visual fixes out of customer-facing logs unless users can see, do, understand, or trust something materially different.
---

# Simple Changelogs

Maintain two complementary histories:

- `CHANGELOG.md` for customers, users, stakeholders, or operators who need to
  understand visible product changes without reading implementation details.
- `DEVELOPER_CHANGELOG.md` for maintainers who need plain technical context
  without reading raw commit logs.

## Bootstrap And Backfill

When `CHANGELOG.md` or `DEVELOPER_CHANGELOG.md` does not exist, create it. Do
not stop at "file not found" if the user asked for changelog work.

Use this structure for new files when adding pending unreleased work:

```md
# Changelog

## Unreleased

- ...
```

```md
# Developer Changelog

## Unreleased

- ...
```

If creating a changelog with no pending unreleased entries yet, omit
`## Unreleased` until the first pending change exists.

For a git-history backfill:

1. Find release boundaries first:
   - `git tag --sort=-creatordate`
   - existing repository-hosted releases, package versions, app versions, or
     deployment milestones when available
2. If tags or releases exist, backfill one range at a time with
   `git log --oneline <previous-tag>..<tag>` and inspect important commits with
   `git show --stat --summary --format=fuller <sha>`.
3. If no release boundaries exist, walk history in batches with
   `git log --oneline --reverse` or paginated `git log --skip=<n>` ranges, then
   group entries by date, milestone, or coherent feature area.
4. Summarize outcomes, not commits. Combine related commits into one grouped
   entry and leave out churn, reversions, failed experiments, and internal-only
   details from `CHANGELOG.md`.
5. Put useful technical history in `DEVELOPER_CHANGELOG.md`, especially
   migrations, data model changes, parser or pipeline behavior, release-note
   plumbing, tests, operational changes, and workflow changes.
6. Mark uncertainty plainly when old commits do not reveal shipped behavior.
   Prefer a conservative omission over inventing user impact.

For large histories, produce a short backfill plan first, then work in reviewable
batches instead of rewriting the whole history in one pass.

## Workflow

1. Inspect repo context first:
   - `git status --short --branch`
   - `git log --oneline --decorate --max-count=25`
   - existing `CHANGELOG.md`, or create it if missing and needed
   - existing `DEVELOPER_CHANGELOG.md`, or create it if missing and useful
   - affected app/package versions and release-note version fields when version
     tracking is part of the task
   - pushed refs when the task involves pushing, merging, creating a pull or
     merge request, publishing, or deploying
   - deployment target and pending release contents when deploying publicly
2. Triage recent commits with `git show --stat --summary --format=fuller <sha>`.
   For uncommitted work, inspect the changed files directly. Read enough diff
   context to understand user impact and technical impact; do not rely only on
   commit titles.
3. Apply the customer impact gate before writing a customer changelog bullet.
   Include a change only when it changes what a user, customer, stakeholder, or
   operator can see, do, understand, or trust in a durable or broadly noticeable
   way.
4. Keep developer-only work out of `CHANGELOG.md`. Put useful technical context
   in `DEVELOPER_CHANGELOG.md` instead.
5. If a change mixes technical work with visible behavior, write only the
   visible outcome in `CHANGELOG.md` and put implementation details in
   `DEVELOPER_CHANGELOG.md`.
6. Order customer-facing entries inside each version by affected-surface radius,
   not commit order.
7. Before pushing, merging, opening a pull or merge request, publishing a
   release, or deploying publicly, make the changelog decision explicit. If no
   customer-facing update is needed, say so and explain whether the developer
   changelog needs an entry.

## Changelog Entry Lifecycle

Use `Unreleased` for meaningful work that has not been assigned to a release
yet.

Keep `Unreleased` present only while it has at least one real entry. When no
pending changes exist, omit the section entirely instead of writing placeholder
text such as "No unreleased changes." When new pending work appears, recreate
`## Unreleased` at the top of the changelog, before the first released heading.

While work is still changing, keep changelog bullets accurate:

- Add entries for customer-visible changes and maintainer-relevant technical
  changes.
- Revise entries when the implementation or user impact changes.
- Remove entries for reverted, abandoned, or no-longer-relevant work.

Do not move entries out of `Unreleased`, bump versions, or sync release-note
surfaces merely because a task touches git, a branch, a preview, or a deploy
command. First establish release intent from local evidence:

- The user asks to release, publish, deploy publicly, close a release, bump a
  version, update release notes, or merge into a release-bearing branch.
- Repo docs, release automation, CI, package metadata, app-store metadata, or
  deployment config identify the current action as release finalization.
- Users install, read, consume, or deploy directly from the target branch or
  published artifact affected by the task.

If the task is only preparing a feature branch, draft pull or merge request,
internal preview, staging deploy, code review, or non-release commit, keep
pending work under `Unreleased`. Do not sync versions or release-note surfaces
unless the task explicitly asks for release prep.

Before opening a pull or merge request, pushing non-release work, or handing off
pending work:

- Re-read the final diff or relevant commits.
- Confirm whether each `Unreleased` entry is still true.
- Keep still-unshipped entries under `Unreleased`.
- Make the changelog decision explicit. If no customer-facing update is needed,
  say so and explain whether the developer changelog needs an entry.

Before pushing, merging, publishing, or deploying with release intent:

- Re-read the final diff or relevant commits.
- Confirm whether each `Unreleased` entry is still true.
- Fetch or inspect the target refs involved in the task. Treat the default
  branch, production branches, protected release branches, and documented
  release targets as release-bearing when users install, read, consume, or
  deploy directly from them.
- Do not infer release-bearing status from a branch name alone. If local docs,
  release automation, deployment config, package metadata, or direct-consumption
  evidence do not establish the branch as release-bearing, treat it as pending
  work and report the ambiguity instead of finalizing the release.
- Leave merged-but-unshipped work under `Unreleased` only when the repo clearly
  documents a separate release system that has not shipped yet.
- Treat a push or merge to a release-bearing branch as release finalization when
  users install, read, or consume directly from that branch, such as public skill
  repos, package docs, static changelog pages, or default-branch app release-note
  data.
- When the user asks you to create pull or merge requests and merge them, treat
  the merge into a release-bearing target branch as release finalization. Move
  the shipped customer-facing `Unreleased` entries into the matching
  version/date heading before the run is finished, then sync release-note
  surfaces and affected version fields when the release has customer-facing
  bullets.
- When the user asks you to push, publish, or run a production or public
  deployment, treat that deployment as release finalization even if no branch
  merge is part of the request. Before deploying, move the shipped
  customer-facing `Unreleased` entries into the matching version/date heading,
  sync release-note surfaces and affected version fields when applicable, and
  leave only still-unshipped work under `Unreleased`.
- When preparing a new pull or merge request, check whether existing
  `Unreleased` entries are already present on the release-bearing target branch.
  Use the target branch changelog files, commit history, diffs, and commit
  containment as evidence. If the work is already on the target branch, reconcile
  it before opening the new request: move those entries out of `Unreleased` into
  the matching released heading, sync release-note surfaces and version metadata
  when applicable, and keep only still-unmerged or still-unshipped work under
  `Unreleased`.
- If `Unreleased` mixes entries that are already on the target branch with
  entries that are still local or still pending, split them. Move only the
  target-branch-contained entries into the released section.
- Move shipped or release-prep developer notes from `DEVELOPER_CHANGELOG.md`
  `Unreleased` into the same version/date heading when they belong to that
  release.
- Move shipped or release-prep entries from `Unreleased` into the matching
  version/date heading before pushing, merging, publishing, or deploying.
- Do not leave entries under `Unreleased` after a public default-branch release
  unless the repo documents a separate release system that has not shipped yet.
- After all pending entries have moved into a released section, remove the empty
  `Unreleased` heading from both customer and developer changelogs.
- Apply the pre-release hot-fix omission rules below before adding or keeping any
  user-facing entry.

## Release Ordering

Order customer-facing bullets inside each version by affected-surface radius,
not by commit order or implementation order:

1. Trust, safety, privacy, legal, compliance, onboarding, payment, or release
   boundary behavior.
2. Cross-surface or multi-role capabilities that change a primary workflow.
3. Data-quality, ingest, sync, search, taxonomy, or backend behavior that changes
   what users see or prevents bad data from reaching them.
4. Surface-specific feature work.
5. Polish, wording refinements, visual cleanup, and narrow bug fixes.

If a release mixes broad and narrow impact, move narrow-impact updates below broad
ones before syncing release-note data.

Group related entries under a plain feature heading when a feature area has
multiple visible changes. Do not preserve chronological commit order when it
makes the release harder for users to scan.

## Pre-Release And Hot Fixes

Treat `alpha`, `beta`, `Pre-1.0`, and every `0.x.y` version before an explicit
`1.0.0` declaration as pre-release.

During pre-release:

- Keep routine hot fixes, regression repairs, test-release churn, temporary
  workarounds, narrow visual fixes, and cleanup out of the user-facing
  changelog.
- Add a user-facing entry only when the change materially affects trust,
  onboarding, compliance, payment, shopping flow, safety, access, a broadly
  noticeable UX surface, or a durable user capability.
- Prefer folding small fixes into the next meaningful feature or milestone entry
  instead of publishing patch-by-patch customer notes.
- Preserve useful internal detail in `DEVELOPER_CHANGELOG.md`, a PR/MR body, or a
  worklog.

After `1.0.0`, patch releases can include narrow user-facing fixes, but still
omit implementation-only repair work. When a post-`1.0.0` bug fix belongs in a
public changelog, frame it as a calm user outcome:

- Prefer "Shared links now show the right preview" over "fixed our broken
  metadata generator."
- Prefer "Checkout now keeps the selected shipping method when totals update"
  over "fixed a regression that reset shipping state."
- Prefer "Reports now load reliably for larger date ranges" over "fixed a crash
  caused by an inefficient query."

Do not expose blame, embarrassing root causes, failed releases, avoidable
mistakes, internal incident language, or security-sensitive implementation
details in `CHANGELOG.md` or public "What's New" surfaces. Preserve useful
technical context in `DEVELOPER_CHANGELOG.md`, PR/MR notes, or incident records
when maintainers need it.

## Customer Changelog

Use `CHANGELOG.md` for visible product changes.

Include:

- New or changed screens, flows, navigation, filters, settings, carts, checkout,
  product pages, pricing, content pages, mobile behavior, notifications, or
  safety/trust gates.
- Data-quality, ingest, search, taxonomy, sync, indexing, or backend behavior
  that changes what users see or prevents bad data from reaching them.
- Public sharing, page metadata, SEO, install, onboarding, email, or notification
  changes that affect discovery, previews, or user communication.
- Copy or content changes that materially change user understanding, trust,
  legal/compliance meaning, pricing, purchase decisions, onboarding/setup, error
  recovery, permissions/access, or support obligations.
- Admin or operator UI changes that an operator can see or act on.

Exclude:

- Narrow visual hot fixes unless they change a durable user capability,
  trust/safety behavior, access, shopping flow, or a broadly noticeable UX
  surface.
- Routine hot-fix-only entries in `alpha`, `beta`, `Pre-1.0`, or any `0.x.y`
  release before an explicit `1.0.0`, unless they materially change user trust,
  onboarding, compliance, payment, shopping flow, safety, access, a broadly
  noticeable UX surface, or durable capability.
- Routine copy edits, typo fixes, grammar fixes, tone tweaks, label wording,
  placeholder text, and microcopy polish unless the wording materially changes
  what users understand, decide, can access, must trust, or are legally promised.
- Linting, formatting, dependency bumps, CI, build config, package-manager
  changes, tests, migrations, refactors, type-only edits, internal docs, or
  schema plumbing with no visible behavior change.
- Implementation details, raw enum names, migration numbers, pipeline markers,
  internal package names, or function names unless the audience explicitly needs
  technical release notes.

Write customer bullets like concise product updates:

- Prefer "Added after-tax price estimates" over "added tax-basis params."
- Prefer "Shared links now show the right preview" over "set canonical and
  social metadata."
- Prefer "Product charts now make totals easier to scan" over "changed chart row
  rendering logic."

When a release introduces a feature or a feature area has multiple visible
changes, group those changes under one casual top-level feature heading with
nested bullets. The heading can feel like a small launch announcement, but keep
it plain and useful.

```md
## 1.4.0 - YYYY-MM-DD

- Added clearer product analytics:
  - Charts now separate totals from measured rows.
  - Tooltips now explain where each number came from.
- Fixed shared links so previews show the current product image and title.
```

Use flat bullets only when the changes are unrelated or too small to benefit
from grouping.

## Developer Changelog

Maintain `DEVELOPER_CHANGELOG.md` alongside the customer changelog. This file is
for maintainers, not customers.

Include technical changes that will matter later:

- Database migrations, schema changes, data model updates, seed changes, and
  backfills.
- Parser, scraper, ingestion, sync, queue, cache, pipeline, or API behavior.
- Shared types, validation rules, generated data, release-note data structures,
  package versions, and cross-app contracts.
- Tests added for important behavior, especially parser, data, migration,
  release-note, or UI regression coverage.
- Operational changes, deployment process changes, agent instructions, repo
  workflow changes, and release process changes.
- Refactors or dependency changes when they affect architecture, build behavior,
  runtime behavior, or future maintenance.

Keep entries simple and matter-of-fact. Mention file or package areas when
helpful, but do not dump commit hashes, raw diffs, or implementation trivia.

Use the same release headings and dates as `CHANGELOG.md` when a technical note
belongs to a shipped release. Use `Unreleased` only for internal work that has
not been assigned to a product release yet.

```md
## 1.4.0 - YYYY-MM-DD

- Added product analytics storage:
  - Added migrations for product metric snapshots and source attribution.
  - Added parser tests for missing values, duplicate rows, and stale source
    records.
- Updated release-note data:
  - Moved release notes into a shared module consumed by web and mobile.
  - Added nested release-note items so in-app notes match `CHANGELOG.md`.
```

## Version Decisions

Treat changelog versions as release boundaries, not commit batches, date
changes, or measures of implementation time. A new day, a long-running branch, or
several commits is not enough reason to bump a version.

Before changing versions, answer:

1. Is the change customer-visible or operator-visible?
2. Is it shipped now, being prepared for release, or still internal work?
3. Which shipped surface changed: web, mobile, API, backend data, docs, package,
   CLI, integration, or multiple surfaces?
4. What durable impact changed: repair, polish, capability, workflow, contract,
   migration, or product direction?
5. Is the release a patch, minor, or major?
6. Do `CHANGELOG.md`, release-note data, and affected version fields agree?

Use semantic versioning unless the repo has a different published convention:

- Patch for fixes, compatibility-preserving repairs, narrow UX polish, small
  visible improvements, and stabilization that does not introduce a new durable
  capability or contract.
- Minor for new user-facing capabilities, meaningful workflow improvements,
  compatible API/data additions, important onboarding or trust improvements, or a
  few cohesive changes that significantly improve the user experience without
  breaking established expectations.
- Major for incompatible API, data, workflow, or package contract changes;
  removals or renames of established capabilities; migrations that users or
  operators must plan around; or an explicit new product era.

Use elapsed time only as batching context. It can justify grouping related small
changes into one release, but it must not decide the bump level.

For pre-`1.0.0` products, treat every `0.x.y` section as pre-release unless the
repo has an explicit public release contract. During that period:

- Do not treat every significant change as a major bump just because the product
  is still taking shape.
- Use `0.x.y` patch bumps for repairs, small UX improvements, compatible
  stabilization, and release-candidate cleanup that is worth
  publishing.
- Use `0.(x+1).0` minor bumps more often than post-`1.0.0` when the release adds
  a durable capability, changes product direction, reshapes a primary workflow,
  introduces a public surface, or changes an API/data contract before it is
  stable.
- Reserve `1.0.0` for an explicit stability, public contract, or launch
  milestone. Do not jump to `1.0.0` just because a pre-`1.0.0` feature feels
  large.
- When the repo treats pre-`1.0.0` minor bumps as compatibility-breaking
  boundaries, mention the break plainly in the changelog and developer
  changelog, but follow the repo policy instead of inventing a separate major
  scheme.
- Avoid customer-facing patch-note churn for hot fixes; roll durable product
  outcomes into the next meaningful release section instead.

Do not bump versions for DX-only work, tests, linting, formatting, refactors,
dependency bumps, migrations, or internal plumbing unless the shipped behavior or
published package contract changes.

When preparing a release or doing explicit version-tracking work, keep the
changelog, release-note data, and app/workspace version fields aligned in the
same pass only after release intent and source-of-truth policy are clear:

- Find version fields with repo context first, then targeted searches such as
  `rg -n '"version"|appVersion|runtimeVersion|buildNumber|versionCode'`.
- Update only affected app, package, or release-note version fields that local
  docs, config, tests, or release data identify as belonging to this release
  flow. Match the current changelog release heading unless the repo documents
  independent per-surface versioning.
- Handle routine version tracking end to end when release intent, shipped
  surface, and repo policy are clear. Do not ask for human approval just to align
  local changelog, release-note, app, or workspace metadata that is proven to be
  part of the same release flow.
- For repos with independent versioning, update only the fields the repo
  declares as product-facing or release-note-facing. Do not override deployment
  IDs, EAS/build numbers, Changesets, or package versions owned by a separate
  release flow.
- When a remote release system is the source of truth, run the repo's read-only
  verification command when available. If release prep requires changing remote
  metadata, do it only when the task asks for release prep and the repo documents
  the command; otherwise report the exact command and missing credential or
  release decision.
- Ask for help only when the version level, shipped surface, release timing,
  source-of-truth policy, or required remote credentials cannot be determined
  from local context.
- If policy is unclear, leave version fields unchanged, explain what evidence is
  missing, and avoid inventing a versioning relationship.
- Do not leave a proven affected workspace's current app/package metadata behind
  the changelog version just because the changelog text was already written.
- In the final response, explain which version fields changed, which fields were
  already aligned, and which were intentionally skipped because of repo release
  policy.

## Release Notes And What's New

When a release has customer-facing changelog bullets, also update documented
user-facing release-note surfaces used by the product, such as:

- In-app "What's New" screens or modals.
- Release-note data modules.
- Website release pages.
- App store, extension store, or marketplace notes.
- Email or notification release summaries.

Treat a surface as user-facing only when local evidence shows users, customers,
stakeholders, or operators can actually see it. Good evidence includes routing,
navigation, app shell access, authenticated returning-user flows, public docs,
release-note data consumed by a deployed product, marketplace metadata, or a
public website. Do not assume a named app, route, module, prototype, preview,
hidden screen, disabled feature, or internal-only tool is customer-facing merely
because code exists.

Keep release-note versions and dates identical to their changelog headings.
Mirror the same grouped structure when the product UI supports nested notes.

If an app has authenticated, returning, or session-based users and no "What's
New" surface yet, add one only when the task asks for product release-note UI or
the repo documents that such a surface is part of release prep. Otherwise report
that no documented surface exists and keep the changelog or release-note data as
the source of truth. When adding one, pull from the same user-facing changelog or
release-note data, style it in the app's own theme, keep the body constrained
and scrollable, and make the header and dismiss action persistent.

For app-themed "What's New" surfaces:

- Use the changelog or release-note data as the source of truth; do not maintain
  separate copy by hand.
- Preserve the same version order and grouped structure the app UI can support.
- Make headline capabilities easier to scan than minor updates. Group related
  major feature bullets under a plain feature heading, put those groups before
  narrow fixes, and keep polish or small repairs as shorter lower-priority
  bullets.
- Do not let narrow fixes visually compete with launch-level work. When a
  release includes primary workflow, access, shopping, safety, trust, or durable
  capability improvements, make those outcomes the first things returning users
  can scan.
- Auto-show at most once per release to returning users.
- Keep manual access available from a menu, account area, help surface, or public
  changelog page.
- Never use the modal as onboarding for brand-new users.
- At a new major version, reset the modal to that major's relevant release
  history; within a major, append minor and patch sections newest first.

If a release has no customer-facing or UX-impacting bullets, do not update
customer-facing release-note surfaces. Say explicitly that no customer release
notes are needed.

## Verification

Before finalizing, review the diff and confirm:

- Every customer changelog bullet answers what a user can see, do, understand,
  or trust now.
- No customer bullet is DX-only or purely implementation detail.
- No copy-only bullet is included unless it changes user understanding, trust,
  access, legal/compliance meaning, pricing, setup, or error recovery.
- Customer bullets inside each version are ordered by affected-surface radius.
- Pre-release and pre-`1.0.0` hot-fix churn is excluded from customer-facing
  logs unless it meets the material-impact gate.
- Post-`1.0.0` public bug-fix bullets describe the user-visible outcome without
  exposing blame, embarrassing root causes, incident details, or sensitive
  implementation internals.
- Major feature groups stand out above minor fixes in app "What's New" surfaces
  and public release-note pages.
- Customer wording is plain, concise, and audience-appropriate.
- `DEVELOPER_CHANGELOG.md` explains technical changes plainly and does not read
  like a raw commit log.
- Release intent is established before entries move out of `Unreleased`, version
  fields change, or release-note surfaces sync.
- Release-note data, app "What's New" surfaces, and version fields match the
  changelog only when they are documented as part of the release flow or
  explicitly requested.
- Hidden, disabled, preview, prototype, or internal-only surfaces are not treated
  as customer-facing without evidence of real user or operator visibility.
- Empty `Unreleased` sections are removed after release finalization, and
  `Unreleased` exists only when it contains pending entries.

For changelog-only edits, diff review is usually enough. When version, package,
or code files changed as part of the same task, run the repo's relevant checks.

## Boundaries

Use this skill for human-readable changelogs and release notes. Do not use it to
generate screenshots, create Git tags, create hosted repository releases,
replace dedicated release automation, or invent version policy that the repo
does not document.
