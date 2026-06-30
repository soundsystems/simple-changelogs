# Entry Classification and Wording

Use this reference when deciding whether a change belongs in `CHANGELOG.md`,
`DEVELOPER_CHANGELOG.md`, both, or neither.

## Contents

- Pruning rules
- Customer changelog entries
- Detail level
- Pre-release and hot fixes
- Developer changelog entries
- Superseded developer notes
- Source links
- Raw changelog signatures
- Grouping and wording examples

## Pruning Rules

Before writing a customer entry, remove changes that are not durable
user-facing product news.

Exclude from `CHANGELOG.md`:

- Refactors, tests, linting, formatting, dependency bumps, CI, build config, and
  internal tooling.
- Schema, pipeline, API, or data-model work with no visible user or operator
  effect.
- Benchmark-only performance work that users or operators would not materially
  notice.
- Release-note plumbing, shared modules, and technical architecture unless they
  create or change a visible release-note surface.

Put technically important excluded work in `DEVELOPER_CHANGELOG.md` when
maintainers will need the context later.

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

## Detail Level

Use the minimum detail needed for the audience to understand the visible change.

Some user-facing changes should stay terse even when they are important:

- Policy, terms, privacy, or legal-document updates can be one line when users
  only need to know the document changed.
- Copy and content updates should describe the practical user impact, not every
  wording change.
- Security, compliance, billing, and privacy notes should avoid implementation
  detail and avoid summarizing legal clauses unless product behavior changed.

Prefer:

- `[Product] Terms have been updated.`
- `The Privacy Policy now covers mobile analytics and location-based workflows.`
- `Billing emails now explain failed payments more clearly.`

Avoid:

- Clause-by-clause legal summaries.
- Internal compliance rationale.
- Repeating every edited paragraph, setting name, or implementation detail.

Major feature launches, workflow overhauls, and new paid, safety, or
business-critical capabilities are the exception: give enough detail for users
to understand what changed, where to find it, and how to benefit from it. Use a
clear top-level feature heading with nested bullets when multiple user actions
or benefits matter.

## Pre-Release and Hot Fixes

Treat `alpha`, `beta`, `Pre-1.0`, and every `0.x.y` version before an explicit
`1.0.0` declaration as pre-release.

During pre-release:

- Keep routine hot fixes, regression repairs, test-release churn, temporary
  workarounds, narrow visual fixes, cleanup, and baseline defects that should
  already work out of the user-facing changelog.
- Before adding a customer-facing fix entry, check prior changelog and
  release-note entries for the affected feature, workflow, or promise. Do not
  separately announce fixes that make an already announced feature or baseline
  expectation work as intended.
- If the prior entry is still unreleased and would otherwise overpromise, revise
  that existing entry instead of adding a new fix announcement.
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
- Preserve useful internal detail in `DEVELOPER_CHANGELOG.md`, a pull or merge
  request body, or a worklog.

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
technical context in `DEVELOPER_CHANGELOG.md`, pull or merge request notes, or
incident records when maintainers need it.

When a post-`1.0.0` release has several public bug fixes, group them under a
plain `Bug Fixes` heading after larger feature, workflow, trust, and
data-quality entries. For one or two fixes, keep calm outcome bullets near the
end of the release section unless the repo already uses grouped fix headings.

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

## Superseded Developer Notes

When a newer change in the same section replaces, reverses, or materially
changes an older `DEVELOPER_CHANGELOG.md` note, do not leave the obsolete note
in the main flow as if it is still true.

Prefer updating or replacing the original note when the old implementation no
longer matters. Preserve the old note only when maintainers may need the trail
to understand why an approach changed, why a migration was superseded, or why a
release-plan decision should not be repeated.

When preserving that trail, move the obsolete note to a `Superseded` subsection
at the bottom of the same release section and strike through only the obsolete
claim:

```md
## Unreleased

- Added release-note data generated from `CHANGELOG.md`.

### Superseded

- ~~Stored release-note copy in separate per-app files.~~ Replaced by shared
  release-note data generated from `CHANGELOG.md`.
```

Rules:

- Keep the active, current technical truth in the main section.
- Put `Superseded` after all active notes for that section.
- Use concise replacement context after the strikethrough.
- Do not use `Superseded` for routine typo fixes, noisy churn, or work that no
  longer needs maintainer context; delete those entries instead.
- Do not add strikethroughs to customer-facing `CHANGELOG.md`.
- Avoid rewriting old released history unless the current task is explicitly a
  changelog cleanup or correction.

## Source Links

Do not add raw pull request, merge request, issue, or commit links to
`CHANGELOG.md` unless the link directly helps users.

`DEVELOPER_CHANGELOG.md` may link to a pull request, merge request, issue,
design note, or other source artifact when it helps future maintainers
understand a major refactor, migration, incident repair, or architectural
decision. Use descriptive links or plain pull or merge request references; do
not dump commit hashes.

## Introducing and Naming Features

Name the user-facing concept, not the implementation.

Use the product's existing term when one exists. For a new feature, introduce it
with a clear noun phrase and explain what users can do with it.

Prefer:

- `Added Team Invites so admins can bring coworkers into a workspace.`
- `Added saved reports:`
- `Workers can now request time off from mobile.`
- `Product Page Corrections: Users can now report inconsistent or missing
  product data directly from a product page.`

Avoid:

- Internal project names unless they are already visible in the product.
- API, database, package, or component names in customer notes.
- Vague launch wording like `Added improvements` without the capability.
- Comparative framing such as `easier to`, `clearer`, `better`, `faster`, or
  `improved` when the release is introducing a capability for the first time.
  Use that wording only when improving an already shipped or already announced
  flow.

When a named feature has several visible parts, use the feature name as the
top-level bullet and put the outcomes underneath.

For first-time feature introductions, default to this shape:

```md
- Feature Name:
  - Users can now do the new thing from the surface where it appears.
```

Use a concise sentence instead of nested bullets when the feature has only one
important user action:

```md
- Product Page Corrections: Users can now report inconsistent or missing product
  data directly from a product page.
```

Before writing `now makes it easier to...`, ask whether users already had that
action. If the answer is no, name the new capability instead of comparing it to
a nonexistent prior flow.

## Raw Changelog Signatures

When an agent directly adds to or adjusts raw changelog markdown, sign the
relevant changed part with the agent's model name/version and a short local
timestamp.

Use an HTML comment so rendered customer release notes and in-app surfaces do
not show the signature:

```md
- Product Page Corrections: Users can now report inconsistent or missing product
  data directly from a product page.
<!-- Agent: GPT-5 Codex | 06/30/2026 6:50 PM CDT -->
```

Rules:

- Place the signature immediately after the changed bullet, group, or section.
- Match the surrounding indentation when signing nested bullets.
- One signature may cover adjacent bullets in the same changed group or
  subsection.
- Use the active model label and version exposed by the runtime or system
  context. If only a model family is known, use that exact label rather than
  inventing a more specific version.
- Include timezone in the timestamp.
- Sign raw `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md` edits. Do not separately
  sign generated release-note data that is mechanically synced from a signed
  changelog entry.
- Do not use visible prose signatures in customer-facing notes unless the repo
  explicitly requires rendered attribution.

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
