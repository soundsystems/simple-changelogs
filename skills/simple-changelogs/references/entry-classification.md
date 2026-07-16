# Entry Classification and Wording

Use this reference when deciding whether a change belongs in `CHANGELOG.md`,
`DEVELOPER_CHANGELOG.md`, both, or neither.

## Contents

- Pruning rules
- Customer changelog entries
- Public detail budget
- Detail level
- Initial-development, pre-release, and hot-fix rules
- Developer changelog entries
- Superseded developer notes
- Source links
- Grouping and wording examples

## Pruning Rules

Before writing a customer entry, remove changes that are not durable
user-facing product history. The full changelog is a broader record than a
compact release announcement; inclusion here does not require inclusion in
every release-note destination.

Exclude from `CHANGELOG.md`:

- Refactors, tests, linting, formatting, dependency bumps, CI, build config, and
  internal tooling.
- Schema, pipeline, API, or data-model work with no visible user or operator
  effect.
- Benchmark-only performance work that users or operators would not materially
  notice.
- Release-note plumbing, shared modules, and technical architecture unless they
  materially change visible release-note behavior.

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

Record modest UI and interaction polish when it creates a durable, identifiable
change that is useful for answering what changed or when. Examples include a
new interaction affordance, a persistent navigation or layout improvement, or
a noticeable change to how users complete an existing task. Describe the
outcome concisely; its inclusion in the full changelog does not make it a
release-note highlight.

Continue to omit incidental cosmetic churn such as isolated spacing, color,
animation-timing, typo, tone, or one-off alignment adjustments. A baseline
defect that merely restores the already-promised behavior is not automatically
durable product history either.

Exclude implementation details, raw enum names, migration numbers, pipeline
markers, internal package names, or function names unless the requested audience
explicitly needs technical release notes.

## Public Detail Budget

Assume public changelog surfaces can be read by customers, prospects,
competitors, agents, models, and attackers trying to infer product strategy or
implementation mechanics. Customer entries should preserve the "it just works"
layer: name the visible outcome, not the hidden decision tree.

Before adding detail to `CHANGELOG.md`, ask whether the audience needs that
detail to use, understand, or trust the change. If the detail mainly proves how
the fix works, explains internal reasoning, or reveals how the product ranks,
classifies, parses, moderates, routes, recovers, repairs data, or enforces
trust boundaries, move it to `DEVELOPER_CHANGELOG.md`, a pull or merge request,
deploy notes, incident records, or a private handoff instead.

Keep these out of customer-facing notes:

- ranking weights, source precedence, thresholds, scoring logic, fallback order,
  confidence gates, or hidden sort rules
- parser rules, taxonomy aliases, classification logic, matching heuristics,
  canonicalization strategy, provider quirks, data-source mappings,
  product-specific repair examples, and migration or backfill mechanics
- moderation, fraud, abuse, trust, safety, recovery, account, permission, or
  enforcement heuristics
- AI prompts, model choices, eval criteria, queue routing, human-review
  triggers, and internal QA signals
- API endpoint names, schema fields, RPC/function names, package names, feature
  flags, cron cadence, queue names, service boundaries, and pipeline markers
- private vendor names, unreleased integrations, roadmap sequencing, release
  slot strategy, and operational playbooks

Prefer broad user-facing outcomes:

- `Search results now surface more relevant matches first.`
- `Imported records are cleaner and easier to compare.`
- `Account recovery now gives users clearer next steps.`
- `What's New focuses on the latest user-facing updates and links to the full
  changelog.`

Avoid proof-like or clone-enabling copy:

- `Results now sort by source priority, freshness score, and fallback radius.`
- `The parser strips package-size suffixes before canonical slug merging.`
- `Low-confidence reviews enter the admin queue below the promotion threshold.`
- `The release-note parser filters developer sections by backend keywords.`

Name a specific vendor, data source, customer, product, or partner only when
the public announcement is specifically about that visible support. Do not use
customer changelog copy as a QA receipt for individual cleanup examples or as a
map of internal logic.

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

## Initial Development, Pre-Releases, and Hot Fixes

SemVer terminology is owned by `references/version-decisions.md`: `0.x.y` means
initial development, a pre-release has a hyphenated suffix such as
`1.0.0-alpha`, and public distribution comes from repository and release
evidence rather than the version number. Apply those terms when deciding
disclosure here.

During initial development and actual pre-release testing:

- Keep routine hot fixes, regression repairs, test-release churn, temporary
  workarounds, incidental cosmetic churn, cleanup, and baseline defects that
  should already work out of the user-facing changelog. Do not exclude a
  durable interaction or UI improvement solely because it is small or ships
  during initial development.
- Keep obvious user-facing copy edits out of the user-facing changelog by
  default. Visible wording, labels, placeholders, helper text, modal text, and
  marketing copy do not need a customer note merely because users can see them;
  add one only when the wording itself creates or materially changes an access
  rule, legal/compliance promise, payment/shopping identity behavior,
  safety/trust requirement, or durable user capability.
- Before adding a customer-facing fix entry, check prior changelog and
  release-note entries for the affected feature, workflow, or promise. Do not
  separately announce fixes that make an already announced feature or baseline
  expectation work as intended.
- If the prior entry is still unreleased and would otherwise overpromise, revise
  that existing entry instead of adding a new fix announcement.
- For a publicly distributed `0.x` product, add a customer entry when the
  outcome materially affects trust, access, payment, safety, compliance,
  onboarding, data loss, a broadly noticeable experience, or a durable
  capability.
- Prefer folding small fixes into the next meaningful feature or milestone entry
  instead of publishing patch-by-patch customer notes.
- Do not advertise embarrassing pre-`1.0.0` repairs as public product news. Omit
  entries such as "fixed broken login," "fixed checkout crashes," or "fixed
  missing saved data" unless the release note can truthfully frame a material
  trust, access, safety, payment, compliance, onboarding, or durable capability
  improvement without exposing the defect.
- Preserve useful internal detail in `DEVELOPER_CHANGELOG.md`, a pull or merge
  request body, or a worklog.

For a stable public contract, patch releases can include narrow visible fixes,
but still omit implementation-only repair work. When such a fix belongs in a
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

When a stable release has several public bug fixes, group them under a
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
Visible polish belongs here only when its implementation, architecture, or
tradeoff will matter to future maintainers; do not use the developer changelog
as a catch-all ledger for otherwise incidental UI changes.

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
