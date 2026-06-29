---
name: simple-changelogs
description: Maintains customer-facing CHANGELOG.md, internal DEVELOPER_CHANGELOG.md, release-note data, documented "What's New" surfaces, and release version decisions when tied to shipped impact. Use when updating or backfilling changelogs, deciding whether a change belongs in customer or developer notes, preparing release notes, ordering release entries by impact, finalizing Unreleased sections, or aligning documented release-note/version fields during release prep. Do not use for generic deploys, package bumps, commit summaries, UI work, or code review unless the task or repo policy explicitly connects them to changelog, release-note, or release version handling.
---

# Simple Changelogs

Maintain two complementary histories:

- `CHANGELOG.md` for customers, users, stakeholders, or operators who need to
  understand visible product changes without reading implementation details.
- `DEVELOPER_CHANGELOG.md` for maintainers who need plain technical context
  without reading raw commit logs.

## Load References

Read only the reference files needed for the task:

| Task context | Read |
|--------------|------|
| Missing changelog files or git-history backfill | `references/backfill.md` |
| Customer/developer entry decisions, wording, hot fixes, or grouping | `references/entry-classification.md` |
| `Unreleased` lifecycle, release finalization, branch/deploy handling, or shipped-entry reconciliation | `references/release-lifecycle.md` |
| Version bumping, SemVer, release version fields, package/app metadata, or version-source ambiguity | `references/version-decisions.md` |
| Release-note data, public release pages, app store notes, or in-app "What's New" surfaces | `references/release-note-surfaces.md` |
| Evaluating or changing this skill | `EVAL.md` |

## Core Workflow

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
2. Load the reference file for any branch of the work that is not routine.
3. Triage recent commits with `git show --stat --summary --format=fuller <sha>`.
   When commit messages are vague, incomplete, or impact is unclear, read the
   actual diff. For uncommitted work, inspect the changed files directly. When
   a pull or merge request description and linked issues are available, use them
   as context, but verify impact against the code and changelog files.
4. Apply the customer impact gate before writing a customer changelog bullet.
   Include a change only when it changes what a user, customer, stakeholder, or
   operator can see, do, understand, or trust in a durable or broadly noticeable
   way.
5. Keep developer-only work out of `CHANGELOG.md`. Put useful technical context
   in `DEVELOPER_CHANGELOG.md` instead.
6. If a change mixes technical work with visible behavior, write only the
   visible outcome in `CHANGELOG.md` and put implementation details in
   `DEVELOPER_CHANGELOG.md`.
7. Order customer-facing entries inside each version by affected-surface radius,
   not commit order.
8. Before pushing, merging, opening a pull or merge request, publishing a
   release, or deploying publicly, make the changelog decision explicit. If no
   customer-facing update is needed, say so and explain whether the developer
   changelog needs an entry.

## Bootstrap

When `CHANGELOG.md` or `DEVELOPER_CHANGELOG.md` does not exist, create it. Do
not stop at "file not found" if the user asked for changelog work.

Use `Unreleased` only for meaningful pending work. If creating a changelog with
no pending entries yet, omit `## Unreleased` until the first pending change
exists. For history reconstruction, read `references/backfill.md`.

## Customer Impact Gate

Use `CHANGELOG.md` for visible product changes. A customer bullet must answer
what users, customers, stakeholders, or operators can see, do, understand, or
trust now.

Include visible outcomes such as:

- New or changed screens, flows, navigation, filters, settings, carts, checkout,
  product pages, pricing, content pages, mobile behavior, notifications, or
  safety/trust gates.
- Data-quality, ingest, search, taxonomy, sync, indexing, or backend behavior
  that changes what users see or prevents bad data from reaching them.
- Public sharing, page metadata, SEO, install, onboarding, email, or
  notification changes that affect discovery, previews, or communication.
- Copy or content changes that materially change user understanding, trust,
  legal/compliance meaning, pricing, purchase decisions, onboarding/setup, error
  recovery, permissions/access, or support obligations.
- Admin or operator UI changes that an operator can see or act on.

Exclude:

- Linting, formatting, dependency bumps, CI, build config, package-manager
  changes, tests, migrations, refactors, type-only edits, internal docs, or
  schema plumbing with no visible behavior change.
- Routine copy edits, typo fixes, grammar fixes, tone tweaks, label wording,
  placeholder text, and microcopy polish unless the wording materially changes
  what users understand, decide, can access, must trust, or are legally promised.
- Narrow visual hot fixes unless they change a durable user capability,
  trust/safety behavior, access, shopping flow, or a broadly noticeable UX
  surface.
- Implementation details, raw enum names, migration numbers, pipeline markers,
  internal package names, or function names unless the audience explicitly needs
  technical release notes.

For detailed inclusion/exclusion examples, hot-fix rules, and grouped entry
patterns, read `references/entry-classification.md`.

## Developer Changelog Gate

Maintain `DEVELOPER_CHANGELOG.md` alongside the customer changelog. Include
technical changes that will matter later:

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

## Entry Lifecycle

Use `Unreleased` for meaningful work that has not been assigned to a release
yet. Keep `Unreleased` present only while it has at least one real entry. When
no pending changes exist, omit the section entirely instead of writing
placeholder text such as "No unreleased changes."

Do not move entries out of `Unreleased`, bump versions, or sync release-note
surfaces merely because a task touches git, a branch, a preview, or a deploy
command. First establish release intent from local evidence. For release-bearing
branch, merge, deploy, and shipped-entry reconciliation rules, read
`references/release-lifecycle.md`.

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

Group related entries under a plain feature heading when a feature area has
multiple visible changes. Use flat bullets only when changes are unrelated or
too small to benefit from grouping.

## Version And Release Notes

Treat changelog versions as release boundaries, not commit batches, date
changes, or measures of implementation time. A new day, a long-running branch,
or several commits is not enough reason to bump a version.

Read `references/version-decisions.md` before changing app/package versions,
release-note version fields, or SemVer headings.

When a release has customer-facing changelog bullets, update existing
user-facing release-note surfaces used by the product, or add one only when no
visible equivalent exists. Read
`references/release-note-surfaces.md` before editing release-note data, public
release pages, marketplace notes, email summaries, or in-app "What's New"
screens.

## Verification

Before finalizing, review the diff and confirm:

- Every customer changelog bullet answers what a user can see, do, understand,
  or trust now.
- No customer bullet is DX-only or purely implementation detail.
- No copy-only bullet is included unless it changes user understanding, trust,
  access, legal/compliance meaning, pricing, setup, or error recovery.
- Customer-facing entries use the minimum detail needed to communicate the
  change, except major feature launches or workflow overhauls include enough
  detail for users to understand what changed and how to use it.
- Customer bullets inside each version are ordered by affected-surface radius.
- Pre-release and pre-`1.0.0` hot-fix churn, regressions, and embarrassing
  baseline defects are excluded from customer-facing logs unless they meet the
  material-impact gate and can be framed without advertising the defect.
- Pre-release fixes to already announced features, workflows, or baseline
  expectations are not announced separately; still-unreleased prior entries are
  revised instead when needed.
- Post-`1.0.0` public bug-fix bullets describe the user-visible outcome without
  exposing blame, embarrassing root causes, incident details, or sensitive
  implementation internals.
- Multiple post-`1.0.0` public bug fixes are grouped under `Bug Fixes` after
  larger feature, workflow, trust, and data-quality entries.
- Major feature groups stand out above minor fixes in app "What's New" surfaces
  and public release-note pages.
- Customer wording is plain, concise, and audience-appropriate.
- `DEVELOPER_CHANGELOG.md` explains technical changes plainly and does not read
  like a raw commit log.
- Release intent is established before entries move out of `Unreleased`, version
  fields change, or release-note surfaces sync.
- Release-note data, app "What's New" surfaces, and version fields match the
  changelog when the repo already has a visible release-note flow or release
  prep adds one by default for an app with returning users.
- In monorepos, web, mobile, admin, developer, and portal release-note surfaces
  are scoped to the audience and platform that can use them instead of crowding
  one web modal with unrelated notes.
- Internal admin/developer release-note surfaces, when added, pull from
  `DEVELOPER_CHANGELOG.md` or equivalent internal history and exclude
  frontend-only UI polish or customer-only notes unless relevant to that
  internal audience.
- Auto-shown release-note modals appear only after higher-priority gates such as
  auth, age gates, consent, onboarding, account recovery, payment, safety, or
  mandatory migration flows.
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
