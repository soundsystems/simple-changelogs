# Guidance Updates

This is the canonical user-readable change history for the integer declared in
`SKILL.md`. Use it to explain what changed before asking about a historical
audit. These entries do not themselves authorize released-history edits.

## Guidance 1

Established complementary customer and developer changelogs, outcome-focused
public wording, release-aware `Unreleased` handling, metadata alignment, and
nearby raw-markdown attribution.

Repositories with history predating this guidance could choose whether to
reconstruct or review that history. Prospective work followed the guidance even
when the historical review was declined or deferred.

## Guidance 2

Moved all durable decisions into the repository-local
`.simple-changelogs.json` policy. Installed packages no longer carry per-repo
state, so one installation can serve unrelated repositories safely.

Made initial setup require both changelog files and one recorded historical
audit disposition. Guidance prompts stop repeating for a version once a
disposition is recorded; an unanswered prompt records nothing and may be asked
again later. Unfinished or failed audits resume only when explicitly requested.

Added stored authorization for missing release-note destinations. Existing
destinations may stay synchronized during release work, while product UI and
internal operator surfaces require explicit current authority or documented
policy plus an authorized audience.

Replaced human-form attribution with a portable HTML comment whose identity and
timestamp may truthfully be `unreported`. Clarified that signatures are useful
metadata rather than proof of authorship or filesystem changes.

Corrected initial-development terminology: a `0.x.y` version is not inherently
a SemVer pre-release; suffixes such as `-beta` or `-rc.1` identify pre-releases.
Publicly distributed `0.x` products keep routine repair notes quiet while still
disclosing material trust, access, payment, safety, compliance, onboarding, or
data-loss outcomes.

Clarified that a local fork wins by repository convention, not through a
guaranteed loader capability, and bundled deterministic evaluation and fork
checking helpers with the installed package.

## Guidance 3

Added stable-major release synthesis. Version `1.0.0` now curates the durable
capabilities and stability promise established during public `0.x` development,
while later major releases explain the transition from the latest stable prior
line, including breaking changes and required migration.

Separated next-major development from stable-major finalization. Branch names
such as `v2` are supporting evidence only, and alpha, beta, or release-candidate
versions follow the repository's published version convention without being
mistaken for the stable major release. Public prerelease history remains intact
when the stable release is synthesized.

An approved historical audit may identify stable-major summaries that omit a
material migration or misstate the release boundary. Preserve released
headings and detailed history unless the audit separately authorizes a
meaning-changing correction under `references/backfill.md`.

## Guidance 4

Separated full customer history from compact release announcements. Durable,
identifiable UI and interaction polish may now remain in `CHANGELOG.md` even
when it is too minor for a What's New summary, store note, email, or other
highlight surface.

Incidental cosmetic churn, routine copy cleanup, and baseline corrections still
remain unrecorded by default. `DEVELOPER_CHANGELOG.md` receives polish only when
its implementation or tradeoffs create maintainable technical context; it is
not a catch-all UI ledger.

## Guidance 5

Added evidence-based expert public release notes. An established technical
archive may now retain public API, CLI, SDK, plug-in, device, compatibility,
debugging, and narrow patch details that its proven audience needs. A
comprehensive public ledger preserves every verified audience-relevant change
without copying internal developer history or relaxing security and private
implementation boundaries.

Added destination-level scope maps for repositories with multiple release-note
surfaces. Web, mobile, store, CMS, package, and internal destinations now select
their own eligible entries even when they share a repository, version, or
release date. Cross-platform outcomes appear only where the affected audience
and product surface are proven, and positive plus negative selector checks
guard against wrong-platform leakage.

Added long-form expert archive guidance for feature narratives, verified media,
anchor-linked indexes for long pages, stable product-area groupings,
comprehensive public fix ledgers, and distinct related-product links. Media is
omitted when no authorized asset exists rather than invented to fill a layout.

An approved historical audit may identify technical public archives that lost
audience-relevant detail or destinations that exposed unrelated platform or
role content. Preserve released history unless the audit separately authorizes
the required meaning or visibility change.

## Guidance 6

Added native component selection and presentation verification for explicitly
authorized in-app release-note archives and compact sheets. Established app
systems remain preferred; otherwise confirmed work follows Expo UI, React
Native, SwiftUI, Jetpack Compose, or the app's proven native kit.

Onboarding now offers archive and compact-surface placement even without a
candidate screen, records approved dependencies, and seeds a confirmed archive
from complete app-eligible canonical history. Store metadata remains a
separately scoped destination, and surface authority cannot reconstruct or
rewrite released history.

An approved audit may identify an authorized in-app surface that used the wrong
toolkit, omitted eligible releases, duplicated store-only content, or failed
accessibility, large-text, safe-area, containment, or theming checks. Preserve
deployed visibility and released wording unless separately authorized.

## Guidance 7

Onboarding now offers to add a short changelog pointer to an existing
agent-instruction file such as `AGENTS.md` or `CLAUDE.md`. The distribution
checkpoint already counted repository instructions among the signals selecting a
distribution, but no part of setup established that signal, so it had to be
written by hand.

The offer follows the preference scope already chosen. Repository scope targets
the repository's own instruction file; all-projects scope targets the user's
global instruction file, so a solo developer who keeps one file across projects
is asked once rather than once per repository; run-only scope writes nothing.

Every write requires explicit confirmation, since an agent-instruction file
governs agent behavior beyond changelog work, and the global file applies to
every repository on that machine. A global pointer therefore stays
distribution-neutral: it says a repository's own changelog skill owns the
decision and names no distribution, path, or repository, matching the constraint
already placed on global preferences.

It writes a pointer only: when the decision is due, the requirement to state the
outcome even when no entry is needed, and which skill owns the decision.
Classification, exclusions, and wording stay in the skill. A hand-written block
that restates them becomes a second copy that drifts independently and is read
on every turn, while the skill's own text is read only once an agent already
decided to open it.

Repositories that already carry such a block can have it replaced in place. An
existing pointer is updated rather than duplicated.
## Guidance 8

Canonical Mobile history and selected in-app or store copy are now separate
editorial layers. Keep qualifying durable outcomes in `CHANGELOG.md`, then make
an independent inclusion decision for every app, platform, release train, and
destination. Structured feeds should preserve canonical text while recording
explicit eligibility and surface-scoped copy.

Selected Mobile UI now favors material capabilities, workflows, onboarding,
and important access, payment, privacy, safety, or trust outcomes. Routine
repairs, generic performance work, internal changes, minor polish, copy churn,
and quiet or self-explanatory features stay out unless product strategy
explicitly calls for an announcement.

Selected copy now uses one concrete thought per bullet, calm declarative
language, consistent product naming, and sparse emphasis for real user-facing
terms. Supported emphasis must render semantically with the native product
treatment; raw Markdown markers must never appear to users.

An approved audit may identify an in-app or store destination that mirrors the
full changelog, crosses app boundaries, advertises quiet initial-development
work, or leaks raw emphasis markers. Keep canonical history intact while
repairing eligibility, scoped copy, and rendering under the destination's
existing authority.

## Guidance 9

Release-note surfaces now use semantic strong emphasis as a sparse scan anchor
for named product vocabulary. Product and app surfaces, core components,
filters, categories, formats, and other public product-contract terms are
candidates when emphasis helps readers scan. Emphasize the smallest exact term
and follow the product's established strong or accent treatment without relying
on color alone.

Feature bullets now stop at the capability and practical outcome. Do not
inventory every emoji, gesture, shortcut, role-specific recommendation, or
transient control state unless that detail is itself the announcement.

## Guidance 10

Setup now explains unresolved preferences as numbered, choose-one options with
diagrams where useful. The Web-only `releaseNoteEnvironmentScope` is not asked
or recorded for standalone Mobile applications. This clarity update rewrites
no released notes and grants no surface, store, deployment, or publication
authority.
