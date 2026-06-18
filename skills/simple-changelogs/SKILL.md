---
name: simple-changelogs
description: Maintains customer-facing changelogs, internal developer changelogs, and release notes. Use when updating CHANGELOG.md, DEVELOPER_CHANGELOG.md, release-note data, app "What's New" content, version tracking, release prep, publishing changes, deploying publicly, triaging recent commits, summarizing user-facing changes, or deciding whether a change belongs in a changelog.
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

Use this structure for new files:

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

For a git-history backfill:

1. Find release boundaries first:
   - `git tag --sort=-creatordate`
   - existing GitHub/GitLab releases, package versions, app versions, or
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
   operator can see, do, understand, or trust.
4. Keep developer-only work out of `CHANGELOG.md`. Put useful technical context
   in `DEVELOPER_CHANGELOG.md` instead.
5. If a change mixes technical work with visible behavior, write only the
   visible outcome in `CHANGELOG.md` and put implementation details in
   `DEVELOPER_CHANGELOG.md`.
6. Before pushing, merging, opening a pull or merge request, publishing a
   release, or deploying publicly, make the changelog decision explicit. If no
   customer-facing update is needed, say so and explain whether the developer
   changelog needs an entry.

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
- Admin or operator UI changes that an operator can see or act on.

Exclude:

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

Treat changelog versions as release boundaries, not commit batches.

Before changing versions, answer:

1. Is the change customer-visible or operator-visible?
2. Is it shipped now, being prepared for release, or still internal work?
3. Which shipped surface changed: web, mobile, API, backend data, docs, package,
   CLI, integration, or multiple surfaces?
4. Is the release a patch, minor, or major?
5. Do `CHANGELOG.md`, release-note data, and affected version fields agree?

Use semantic versioning unless the repo has a different published convention:

- Patch for fixes and small visible improvements.
- Minor for new user-facing capabilities or meaningful workflow changes.
- Major for a new product era or a change that breaks established expectations.

Do not bump versions for DX-only work, tests, linting, formatting, refactors,
dependency bumps, migrations, or internal plumbing unless the shipped behavior or
published package contract changes.

When preparing a release or doing explicit version-tracking work, keep the
changelog, release-note data, and app/workspace version fields aligned in the
same pass:

- Find version fields with repo context first, then targeted searches such as
  `rg -n '"version"|appVersion|runtimeVersion|buildNumber|versionCode'`.
- Update every affected app, package, or release-note version field to match the
  current changelog release heading unless the repo documents independent
  per-surface versioning.
- For repos with independent versioning, update only the fields the repo
  declares as product-facing or release-note-facing. Do not override deployment
  IDs, EAS/build numbers, Changesets, or package versions owned by a separate
  release flow.
- Do not leave an affected workspace's current app/package metadata behind the
  changelog version just because the changelog text was already written.
- In the final response, explain which version fields changed, which fields were
  already aligned, and which were intentionally skipped because of repo release
  policy.

## Release Notes And What's New

When a release has customer-facing changelog bullets, also update any user-facing
release-note surfaces used by the product, such as:

- In-app "What's New" screens or modals.
- Release-note data modules.
- Website release pages.
- App store, extension store, or marketplace notes.
- Email or notification release summaries.

Keep release-note versions and dates identical to their changelog headings.
Mirror the same grouped structure when the product UI supports nested notes.

If a release has no customer-facing or UX-impacting bullets, do not update
customer-facing release-note surfaces. Say explicitly that no customer release
notes are needed.

## Verification

Before finalizing, review the diff and confirm:

- Every customer changelog bullet answers what a user can see, do, understand,
  or trust now.
- No customer bullet is DX-only or purely implementation detail.
- Customer wording is plain, concise, and audience-appropriate.
- `DEVELOPER_CHANGELOG.md` explains technical changes plainly and does not read
  like a raw commit log.
- Release-note data and version fields match the changelog when they are part of
  the release.

For changelog-only edits, diff review is usually enough. When version, package,
or code files changed as part of the same task, run the repo's relevant checks.
