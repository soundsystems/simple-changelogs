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

Added an explicit setup preference for repositories that ship Web and Mobile
products. Users now choose whether mobile-specific release history appears on
the web under labeled tabs, on a separate linked page, or only in mobile
in-app/store destinations. Shared outcomes remain eligible for every product
they genuinely affect, and placement does not silently authorize new product
UI.

Made the canonical multi-surface method concrete: one customer history,
explicit per-item surface selectors, narrower nested-bullet overrides,
deterministically derived Web and Mobile feeds, removal of empty filtered
groups and sections, and independent latest-rendered and seen-version state per
product.

An approved historical audit may identify mobile-specific entries exposed on a
web surface contrary to the recorded preference, shared entries missing from an
affected product, or hand-maintained Web and Mobile copies that have drifted.
Preserve released history and deployed visibility unless the audit separately
authorizes the required meaning or visibility change.

## Guidance 7

Added evidence-based component selection and presentation verification for
explicitly authorized release-note archives and compact summaries. Existing
project systems remain preferred; otherwise confirmed Web work can use Base UI
or retained Radix primitives, while Mobile follows its native toolkit.

Product onboarding now offers archive and compact-surface placement even when
no candidate route exists, records any approved component source and added
dependencies, and seeds confirmed archives from complete canonical history.
Surface authority remains separate from permission to reconstruct or rewrite
released history.

An approved audit may identify an authorized surface that used the wrong
product component system, omitted eligible canonical releases, leaked another
platform's entries, or failed accessibility and containment checks. Preserve
deployed visibility and released wording unless separate authority permits the
required repair.

## Guidance 8

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

## Guidance 9

Production Web deployment is now always the product-release boundary. Before
production, every `Unreleased` customer or developer item whose implementation
is contained in the target must enter one dated, versioned release; established
Web release-note mirrors and proven product-version metadata must be integrated
into the canonical deployment target first.

An item may remain pending only with evidence that it is absent from the target
or belongs to another unshipped release train. An unresolved version, unmerged
release reconciliation, or deploy-contained pending item blocks production.
Retries and promotions of the exact same reconciled revision reuse its release
version instead of creating a duplicate release.

An approved audit may identify a production Web revision whose deploy-contained
work remained under `Unreleased`, lacked a product release version, or shipped
before its release mirrors were merged. Repair that state with a forward
release-reconciliation change; do not rewrite deployed history merely to hide
the gap.
## Guidance 10

Canonical customer history and selected product UI are now explicitly separate
editorial layers. Keep every qualifying durable outcome in the canonical
changelog, then make an independent inclusion decision for each compact,
in-product, platform, store, CMS, package, or internal destination. Structured
feeds should preserve canonical text while recording destination eligibility
and surface-scoped copy.

Selected product UI now favors material capabilities, workflows, onboarding,
and important access, payment, privacy, safety, or trust outcomes. Routine
repairs, generic performance work, internal changes, minor polish, copy churn,
and self-explanatory mechanics stay quiet by default. Badges, achievements,
rewards, easter eggs, experiments, and soft launches remain discoverable unless
product strategy explicitly calls for an announcement.

Surface copy now follows a stable editorial shape: one concrete thought per
bullet, calm declarative language, consistent product naming, and sparse
emphasis for real user-facing terms. Supported emphasis must render
semantically with the product's established treatment; raw Markdown delimiters
must never become visible copy.

An approved audit may find that a product destination mirrors the full
changelog, exposes another platform's work, over-announces an
initial-development repair, or displays raw emphasis markers. Preserve
canonical history while repairing destination eligibility, scoped copy, and
rendering under the authority already established for that surface.

## Guidance 11

Release-note surfaces now use semantic strong emphasis as a sparse scan anchor
for named product vocabulary. Product and app surfaces, core components,
filters, categories, formats, and other public product-contract terms are
candidates when emphasis helps readers scan. Emphasize the smallest exact term
and follow the product's established strong or accent treatment without relying
on color alone.

Feature bullets now stop at the capability and practical outcome. Do not
inventory every emoji, gesture, shortcut, role-specific recommendation, or
transient control state unless that detail is itself the announcement.

## Guidance 12

Setup now explains unresolved preferences in plain language as numbered,
choose-one options with diagrams where useful. Added repository-only
`releaseNoteEnvironmentScope` for the complete approved public Web surface:
route or page, links, summaries, and modals. Recommend `non-production`
(**Local and preview only**) for marketing and client sites. Unknown scoped
environments fail closed and hidden routes are unserved; generation,
synchronization, deployment, and publication remain separate.

## Guidance 13

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

## Guidance 14

Added optional repository policy `releaseNoteLinks` for contextual actions from
individual product release items. Owner setup now presents `when-useful`
(recommended), `ask`, and `disabled` as explained multiple-choice options with
a route diagram. Structural archive navigation is outside this preference.

A feature route is a candidate rather than an automatic link. The target must
ship in the same release and pass stability, audience, authorization, tenant,
platform, flag, release-train, and environment checks. Historical review should
find broken, internal, admin, preview-only, or production-hidden actions and
record whether each was repaired, removed, or intentionally retained under
separate evidence.

## Guidance 15

Added an explicit `publicVersioning` policy with independent patch, minor, and
major authority. Missing fields now safely ask and suggest an exact version;
ordinary work remains under `Unreleased` until a proven public boundary.

Added digest-bound classify, prepare, and read-only verify receipts for Simple
Changes. Version approval remains separate from merge, deployment,
publication, store, migration, secret, environment, and DNS authority. This
prospective change does not rewrite published releases.

<!-- simple-changelogs-guidance-update version="16" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Update checks now explain new capabilities, assess backfill relevance, and offer detailed skill release notes." -->
## Guidance 16

Added structured update notices to setup inspection. When installed guidance is
newer than repository state, inspection reports the material changes, their
category, whether released history could benefit from a backfill, and where to
find detailed skill release notes.

Agents surface that notice before continuing write-capable work. They ask about
a backfill only when update metadata says history may benefit, never run one
automatically, and record the one-time disposition with
`apply --guidance-backfill <status> --confirm`. Completed audits also require
`--audit-verified`.
