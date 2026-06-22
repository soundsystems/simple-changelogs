# Entry Classification and Wording

Use this reference when deciding whether a change belongs in `CHANGELOG.md`,
`DEVELOPER_CHANGELOG.md`, both, or neither.

## Contents

- Customer changelog entries
- Pre-release and hot fixes
- Developer changelog entries
- Grouping and wording examples

## Customer Changelog Entries

Write customer bullets like concise product updates:

- Prefer "Added after-tax price estimates" over "added tax-basis params."
- Prefer "Shared links now show the right preview" over "set canonical and
  social metadata."
- Prefer "Product charts now make totals easier to scan" over "changed chart row
  rendering logic."

Include copy or content changes only when they materially change user
understanding, trust, legal/compliance meaning, pricing, purchase decisions,
onboarding/setup, error recovery, permissions/access, or support obligations.

Exclude implementation details, raw enum names, migration numbers, pipeline
markers, internal package names, or function names unless the requested audience
explicitly needs technical release notes.

## Pre-Release and Hot Fixes

Treat `alpha`, `beta`, `Pre-1.0`, and every `0.x.y` version before an explicit
`1.0.0` declaration as pre-release.

During pre-release:

- Keep routine hot fixes, regression repairs, test-release churn, temporary
  workarounds, narrow visual fixes, cleanup, and baseline defects that should
  already work out of the user-facing changelog.
- Add a user-facing entry only when the change materially affects trust,
  onboarding, compliance, payment, shopping flow, safety, access, a broadly
  noticeable UX surface, or a durable user capability.
- Prefer folding small fixes into the next meaningful feature or milestone entry
  instead of publishing patch-by-patch customer notes.
- Do not advertise embarrassing pre-`1.0.0` repairs as public product news. Omit
  entries such as "fixed broken login," "fixed checkout crashes," or "fixed
  missing saved data" unless the release note can truthfully frame a material
  trust, access, safety, payment, compliance, onboarding, or durable capability
  improvement without exposing the defect.
- Preserve useful internal detail in `DEVELOPER_CHANGELOG.md`, a PR/MR body, or
  a worklog.

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

## Developer Changelog Entries

Use the same release headings and dates as `CHANGELOG.md` when a technical note
belongs to a shipped release. Use `Unreleased` only for internal work that has
not been assigned to a product release yet.

Good developer changelog entries explain maintainable technical outcomes:

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

Avoid entries that only restate commit messages, hashes, raw diffs, or
implementation trivia without explaining why maintainers will care later.

## Grouping and Wording Examples

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
