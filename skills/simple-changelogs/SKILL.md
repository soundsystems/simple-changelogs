---
name: simple-changelogs
description: Use when creating, updating, backfilling, classifying, reconciling, or finalizing customer/developer changelogs, release notes, "What's New" surfaces, app-store notes, release metadata, version fields, or changelog decisions for push/merge/release/deploy prep. Do not use for generic deploys, package bumps, commit summaries, UI work, code review, or implementation work unless the request or repo policy explicitly ties them to changelog, release-note, or release-version handling.
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
| Final verification, local automation, or checkable changelog rules | `references/automation-verification.md` |
| Creating, editing, or syncing a downstream fork of this skill | `references/fork-maintenance.md` |
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
5. Apply the public detail budget before writing a customer changelog bullet.
   Public changelog, release-page, app-store, email, and in-app "What's New"
   copy should explain the visible outcome and user benefit, not the private
   mechanics that make it work.
6. Keep developer-only work out of `CHANGELOG.md`. Put useful technical context
   in `DEVELOPER_CHANGELOG.md` instead.
7. If a change mixes technical work with visible behavior, write only the
   visible outcome in `CHANGELOG.md` and put implementation details in
   `DEVELOPER_CHANGELOG.md`.
8. Order customer-facing entries inside each version by affected-surface radius,
   not commit order.
9. Before pushing, merging, opening a pull or merge request, publishing a
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

Use `CHANGELOG.md` only when the change alters what users, customers,
stakeholders, or operators can see, do, understand, or trust now. Use
`DEVELOPER_CHANGELOG.md` for useful internal context that does not meet that
gate.

Canonical examples:

- Include a new saved-search screen, changed checkout flow, visible permission
  behavior, or admin/operator control.
- Include backend, ingest, search, sync, or data-quality work only when it
  changes what users see or prevents bad data from reaching them.
- Include copy changes only when they affect user understanding, trust, legal
  meaning, pricing, access, setup, error recovery, or support obligations.
- Exclude obvious user-facing copy changes by default. Visible wording, labels,
  placeholders, helper text, modal text, marketing copy, and tone polish do not
  need a customer changelog note merely because users can see them; include one
  only when the wording itself materially changes an access rule,
  legal/compliance promise, payment/shopping identity behavior, safety/trust
  requirement, or durable user capability.
- Exclude tests, linting, migrations, refactors, dependency bumps, build config,
  type-only edits, and internal docs with no visible behavior change.
- Exclude routine typo, tone, label, placeholder, visual-polish, and
  pre-release hot-fix churn unless the material-impact gate is met.

For the full inclusion/exclusion matrix, hot-fix rules, and wording examples,
read `references/entry-classification.md`.

## Public Detail Budget

Customer changelog, release-page, app-store, email, and in-app "What's New"
copy should explain visible outcomes and user benefit without publishing the
private mechanics that make the product work.

Use broad product phrasing when implementation detail would mostly help another
team copy, bypass, or attack the system:

- Prefer "Search results now surface more relevant matches first" over ranking
  weights, fallback order, or source precedence.
- Prefer "Imported records are cleaner and easier to compare" over parser
  rules, taxonomy aliases, data-source mappings, or repair examples.
- Prefer "Account recovery now gives users clearer next steps" over hidden
  security, review, fraud, or enforcement heuristics.
- Prefer "What's New focuses on the latest user-facing updates" over release
  parser internals, queue names, schema fields, package names, or cron cadence.

Major feature launches still need enough detail for users to understand what
changed, where to find it, and how to benefit. The constraint is against hidden
decision trees and implementation recipes, not useful product education.

For the complete public-detail budget, read
`references/entry-classification.md`.

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

When creating, renaming, or editing a released version section, run a release
metadata sync audit before finalizing. Compare the latest `CHANGELOG.md` version
to release-note data and every app/package/store metadata field that local docs,
config, tests, or release automation identify as part of that product release.
If an automated version-consistency check exists, run it. If none exists and the
repo has a generated release-note feed, consider adding a focused check that
fails when the latest release-note version drifts from the product metadata that
is known to share that release version.

When a release has customer-facing changelog bullets, update existing
user-facing release-note surfaces used by the product, or add one only when no
visible equivalent exists. Read
`references/release-note-surfaces.md` before editing release-note data, public
release pages, marketplace notes, email summaries, or in-app "What's New"
screens.

## Verification

Before finalizing, review the diff against these categories, then run the
exhaustive checklist and automatable checks in
`references/automation-verification.md` - that file owns the full list; do not
re-copy it here:

- Customer bullets: pass the impact gate and public detail budget, and are
  ordered by affected-surface radius.
- Developer changelog: plain technical context, not a raw commit log.
- Signatures: raw changelog edits carry nearby hidden agent signature comments.
- Release intent: established before `Unreleased` moves, version fields change,
  or release-note surfaces sync; empty `Unreleased` sections removed.
- Version map: when a released version section is created or changed, the final
  response reports `Updated`, `Already aligned`, or `Intentionally skipped` for
  each relevant changelog, release-note, app, package, and store metadata
  source identified by local repo policy.

For changelog-only edits, diff review is usually enough. When version, package,
generated release-note, or code files changed as part of the same task, run the
repo's relevant checks.

## Boundaries

Use this skill for human-readable changelogs and release notes. Do not use it to
generate screenshots, create Git tags, create hosted repository releases,
replace dedicated release automation, or invent version policy that the repo
does not document.
