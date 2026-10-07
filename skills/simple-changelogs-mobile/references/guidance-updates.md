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

## Guidance 11

Separated version identifiers by role. A canonical release version owns
chronology for one release train; a public version is the user-visible value
that reproduces it; build numbers and development identifiers are linked
evidence. Exactly one record per release train owns chronology, and a public
version or SemVer bump is never derived from a build number.

Replaced universal version equality with relationship-aware reconciliation. A
shared repository proves shared source ownership, not a shared release train, and
two separately owned fields holding the same string stay separately owned.
Equality checks now apply only among proven mirrors of one canonical value,
inside one train.

Added the optional `crossSurfaceVersioning` policy recording whether product
surfaces are `shared`, `independent`, or `mixed`. When several public version
owners exist, the relationship stays ambiguous after inspection, and the write
depends on the answer, one precise question is asked once and recorded. While it
is outstanding, version fields, tags, and released headings stay unchanged and
the mismatch is not called drift.

Defined release names as presentation only and store description copy as
belonging to one submitted public version, with build numbers, version codes, CI
identifiers, and internal prerelease suffixes kept out of public store copy.

An approved historical audit may find public notes attached to a build
identifier, unrelated product versions forced together, or build and development
identifiers leaked into public copy. Preserve released history unless a separate
historical rewrite is authorized.

## Guidance 12

Added repository policy `releaseNoteLinks` for in-app release actions. Setup
offers `when-useful` (recommended), `ask`, and `disabled` with a screen and Web
fallback diagram; a compact summary's archive link remains separate.

Deep-link candidates must belong to the same app and release train and honor
the established link contract, sign-in, role, subscription, feature-flag, and
platform rules. Authorized historical audits should test installed-app,
unavailable-feature, and fallback states, then record the disposition of any
broken or internal-only destination.

## Guidance 13

Added `publicVersioning` policy and digest-bound classify, prepare, and verify
handoffs for public app and store release trains. Missing policy asks for every
public bump with an exact suggestion. Version approval never grants store
submission, build-counter, signing, or deployment authority, and published
history remains unchanged.

<!-- simple-changelogs-guidance-update version="14" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Update checks now explain new capabilities, assess backfill relevance, and offer detailed skill release notes." -->
## Guidance 14

Added structured update notices to setup inspection. When installed guidance is
newer than repository state, inspection reports the material changes, their
category, whether released history could benefit from a backfill, and where to
find detailed skill release notes.

Agents surface that notice before continuing write-capable work. They ask about
a backfill only when update metadata says history may benefit, never run one
automatically, and record the one-time disposition with
`apply --guidance-backfill <status> --confirm`. Completed audits also require
`--audit-verified`.

<!-- simple-changelogs-guidance-update version="15" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Mobile setup now verifies real app and store destinations before reusing, proposing, or recording them as planned." -->
## Guidance 15

First-use setup now begins with a plain-language overview and offers **Walk me
through it**. The walkthrough explains customer and developer histories,
mobile, in-app, and store destinations, unresolved preferences, consequences,
recommended defaults, and authority boundaries one question at a time.

Installed-guidance notices now lead with a clear headline and up to three
practical effects, confirm that saved settings and released history are
unchanged, and offer **Walk me through what changed — Recommended**, **Keep my
current settings and continue**, or **View detailed release notes**. Historical
review remains separate and conditional, and no setup choice grants build,
signing, submission, or publication authority.

Mobile onboarding now reports discovered Web, Mobile, store, CMS, workspace,
and release-note evidence before asking where notes belong. It reuses proven
in-app and store destinations; if a selected destination is absent, setup
proposes it and asks before the exact current surface, then rescans and requires
confirmation or a revised choice. The selection cannot establish that an app,
store listing, deep link, credential, or release train exists and grants no
build, signing, submission, or publication authority.

<!-- simple-changelogs-guidance-update version="16" kinds="behavior,onboarding" backfill="not-needed" summary="Mobile setup now offers progressive confirmation receipts, evidence-gated destination questions, and separate source-revision and distribution-guidance identity." -->
## Guidance 16

Recommended Mobile setup presents one plain-language receipt covering only the
app and store destinations the repository shows, with **Confirm**, **Show
details**, and **Change something**, and reports separate the Git source
revision from the guidance checkpoint. Inspection marks app and store
applicability detected, not detected, or uncertain, version setup can automate
patches, and new setups record `ask` for future release-note surfaces.

<!-- simple-changelogs-guidance-update version="17" kinds="behavior,onboarding" backfill="not-needed" summary="Release notes now group related bullets by product area by default, onboarding confirms stable-major naming, and patch releases use one flat Bug Fixes & Improvements section." -->
## Guidance 17

Release notes group related bullets under user-recognizable product areas by
default and keep sparse releases flat. Onboarding confirms whether stable major
releases get a concise name beside the version; minor releases need no name,
and patches use one flat **Bug Fixes & Improvements** section. Released history
is unchanged.

<!-- simple-changelogs-guidance-update version="18" kinds="capability,onboarding" backfill="optional" summary="A bundled read-only query CLI now surfaces releases, filtered entries, and structure lint from the raw Markdown histories. Curated public release notes can now derive RELEASE_NOTES.md from the changelog." -->
## Guidance 18

The bundled read-only `scripts/query.ts` lists releases, shows one release,
filters entries, and lint-checks the Markdown histories, including legacy `<!--
Agent: ... -->` signatures (`references/querying.md`). Setup writes after
onboarding use the same atomic transaction as onboarding. Optional
`publicReleaseNotes: "curated"` derives `RELEASE_NOTES.md` from the changelog
at each release, accounting every entry as highlighted, rolled up, or omitted
and never dropping breaking or security notes; a curated backfill is optional.

<!-- simple-changelogs-guidance-update version="19" kinds="behavior" backfill="optional" summary="Reconciliation now keeps one empty Unreleased heading so later merges cannot land in the newest release." -->
## Guidance 19

A reconciled release keeps an empty `## Unreleased` heading in both changelogs
so the next merge cannot land in the newest release, and `query.ts check` flags
a duplicate or non-leading one. An optional audit restores a missing heading
and reports entries the newest release absorbed; moving them needs separate
authority.

<!-- simple-changelogs-guidance-update version="20" kinds="behavior" backfill="not-needed" summary="New changelog entries and release-note lines now avoid em-dashes, and setup and update choices read as Choice (Recommended): consequence." -->
## Guidance 20

New changelog entries and release-note lines use commas, colons, periods, or
parentheses instead of em dashes, rewriting the sentence rather than swapping
the character, and setup and update choices read as `**Choice (Recommended)**:
consequence`. Released entries keep their wording.

<!-- simple-changelogs-guidance-update version="21" kinds="behavior" backfill="not-needed" summary="Mobile test builds now include saved reusable tester instructions, and production App Store and Google Play notes have explicit field, locale, length, and publication rules; new or edited notes use no em dashes unless explicitly requested." -->
## Guidance 21

Finalizing a mobile beta or test build now prepares practical tester
instructions and saves them with the exact build; later owners refine them, and
a new build gets its own record that carries forward unresolved regression
checks. TestFlight and Play testing copy bind to their exact app, build, track,
and locale, and production App Store and Play notes follow their field, locale,
and length limits. New or edited release copy uses no em dashes unless the user
asks, whatever the house style, and publication still needs separate authority
and readback.

<!-- simple-changelogs-guidance-update version="25" kinds="capability,onboarding" backfill="not-needed" summary="Each release can now get a Git tag: Simple Changelogs names it in the release receipt, and Simple Changes 0.27.0 or later creates and pushes it. This update asks once how releases should be tagged." -->
## Guidance 25

Each public release can now get a Git tag on its exact released commit. The
optional `releaseTags` setting picks the style: `"v{version}"`, another
`<prefix>{version}` template, one template per release train such as
`{"web": "web@{version}"}`, or `"none"`. Simple Changelogs names the tag in
receipt v4; Simple Changes 0.27.0 or later creates and pushes it when the
release goes out, under the approval that release already needs. Simple
Changelogs never creates or pushes tags, and earlier releases are never tagged.

This update asks **Should each release get a Git tag?** once, recommending the
repository's existing tag style when local tags show one, and no tags when
release tooling already creates them. No answer records nothing and leaves
releases untagged. This distribution moves from 21 to 25 because every Simple
Changelogs distribution now shares one guidance number. No backfill is needed.
