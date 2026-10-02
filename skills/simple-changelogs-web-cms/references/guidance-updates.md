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

Added evidence-based component selection and presentation verification for
explicitly authorized public Web and authenticated operator surfaces.
Established product and admin systems remain preferred; otherwise confirmed
React work can use Base UI or retain Radix primitives.

Onboarding now offers archive and compact-surface placement even without a
candidate route, records approved dependencies, and seeds each confirmed
surface from complete audience-eligible canonical history. Public and operator
sources remain isolated, and surface authority cannot reconstruct released
history or widen access.

An approved audit may identify a surface that used the wrong component system,
omitted eligible releases, crossed audience boundaries, or failed access,
accessibility, containment, theming, or server-rendering checks. Preserve
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

Production Web deployment is now always the product-release boundary. Before
production, every `Unreleased` customer or developer item whose implementation
is contained in the target must enter one dated, versioned release; established
public Web release-note mirrors and proven product-version metadata must be
integrated into the canonical deployment target first. CMS-only operator
history remains separately scoped and does not leak into the public release.

An item may remain pending only with evidence that it is absent from the target
or belongs to another unshipped release train. An unresolved version, unmerged
release reconciliation, or deploy-contained pending item blocks production.
Retries and promotions of the exact same reconciled revision reuse its release
version instead of creating a duplicate release.

An approved audit may identify a production Web revision whose deploy-contained
work remained under `Unreleased`, lacked a product release version, or shipped
before its public release mirrors were merged. Repair that state with a forward
release-reconciliation change; do not rewrite deployed history merely to hide
the gap or cross the CMS audience boundary.
## Guidance 9

Canonical public history, selected product UI, and authenticated CMS history
are now explicit editorial layers. Keep qualifying durable customer outcomes in
`CHANGELOG.md`, then decide independently which items belong in each public Web
or operator destination. Structured feeds should preserve their canonical
source while recording destination eligibility and surface-scoped copy.

Selected public UI now favors material capabilities, workflows, onboarding,
and important access, payment, privacy, safety, or trust outcomes. Routine
repairs, generic performance work, internal changes, minor polish, copy churn,
and quiet or self-explanatory features stay out unless product strategy
explicitly calls for an announcement. CMS-only work remains isolated from the
public channel.

Selected copy now uses one concrete thought per bullet, calm declarative
language, consistent product naming, and sparse emphasis for real user-facing
terms. Supported emphasis must render semantically with the established product
treatment; raw Markdown markers must never appear to users.

An approved audit may identify a destination that mirrors an unrelated source,
advertises quiet initial-development work, crosses the public/CMS boundary, or
leaks raw emphasis markers. Keep canonical history intact while repairing
eligibility, audience-scoped copy, and rendering under the destination's
existing authority.

## Guidance 10

Release-note surfaces now use semantic strong emphasis as a sparse scan anchor
for named product vocabulary. Product and app surfaces, core components,
filters, categories, formats, and other public product-contract terms are
candidates when emphasis helps readers scan. Emphasize the smallest exact term
and follow the product's established strong or accent treatment without relying
on color alone.

Feature bullets now stop at the capability and practical outcome. Do not
inventory every emoji, gesture, shortcut, role-specific recommendation, or
transient control state unless that detail is itself the announcement.

## Guidance 11

Setup now explains unresolved preferences as numbered, choose-one options with
diagrams where useful. Added repository-only `releaseNoteEnvironmentScope` for
the complete public Web surface. Recommend `non-production` (**Local and
preview only**) for marketing and client sites. Hidden public routes are
unserved and unknown scoped environments fail closed. The protected CMS route
and generation, synchronization, deployment, and publication remain separate.

## Guidance 12

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

## Guidance 13

Added public-product preference `releaseNoteLinks` with `when-useful`, `ask`,
and `disabled` owner choices. The onboarding diagram separates a customer
feature route from protected CMS navigation, and archive links are explicitly
unaffected.

An authorized review should verify that customer actions ship with the release
and match audience, tenant, permission, flag, and environment eligibility.
Record broken or over-broad links and their disposition. This setting never
grants operator access or permission to expose administrator destinations.

## Guidance 14

Added `publicVersioning` policy and digest-bound classify, prepare, and verify
handoffs for the public Web train only. The CMS-only policy remains unchanged.
Missing public policy asks with an exact suggestion, while version approval
never grants deployment, operator access, or other remote authority. Published
history remains unchanged.

<!-- simple-changelogs-guidance-update version="15" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Update checks now explain new capabilities, assess backfill relevance, and offer detailed skill release notes." -->
## Guidance 15

Added structured update notices to setup inspection. When installed guidance is
newer than repository state, inspection reports the material changes, their
category, whether released history could benefit from a backfill, and where to
find detailed skill release notes.

Agents surface that notice before continuing write-capable work. They ask about
a backfill only when update metadata says history may benefit, never run one
automatically, and record the one-time disposition with
`apply --guidance-backfill <status> --confirm`. Completed audits also require
`--audit-verified`.

<!-- simple-changelogs-guidance-update version="16" kinds="capability,behavior,onboarding" backfill="not-needed" summary="Web and CMS setup now verifies public and protected product structure before reusing, proposing, or recording destinations as planned." -->
## Guidance 16

First-use setup now begins with a plain-language overview and offers **Walk me
through it**. The walkthrough explains public customer history, developer
history, protected CMS history, each relevant destination, unresolved
preference, consequence, recommended default, and authority boundary one
question at a time.

Installed-guidance notices now lead with a clear headline and up to three
practical effects, confirm that saved settings and released history are
unchanged, and offer **Walk me through what changed — Recommended**, **Keep my
current settings and continue**, or **View detailed release notes**. Historical
review remains separate and conditional; setup does not grant deployment,
operator access, or permission to expose protected CMS content.

Web+CMS onboarding now inventories public Web, protected CMS, Mobile, store,
workspace, and release-note evidence before destination choices. It reuses
established public and operator surfaces; absent surfaces remain proposals until
the owner confirms the exact current destination after a rescan or chooses
again. Preferences cannot prove routes, authentication, roles, credentials, or
workspace topology and never authorize exposing protected CMS history.

<!-- simple-changelogs-guidance-update version="17" kinds="behavior,onboarding" backfill="not-needed" summary="Web and CMS setup now offers progressive confirmation receipts, a two-step Web page and audience flow, and separate source-revision and distribution-guidance identity." -->
## Guidance 17

Recommended Web+CMS setup now turns public-Web and protected-operator evidence
into one plain-language receipt and asks only for confirmation or changes.
Guided setup defines unfamiliar terms when they matter and asks about each
destination before its placement, environment, links, components, or access
details.

Install and update reporting now separates the Git source revision, when known,
from the selected distribution's guidance checkpoint.

Confirmation receipts now show a compact consequential summary first with
**Confirm**, **Show details**, and **Change something**. The complete receipt
remains available, and details hidden by default cannot expand setup authority.

Inspection reports scan completeness and marks every surface as detected, not
detected, or uncertain. Irrelevant Mobile and store questions are hidden only
after a complete scan supports that result; uncertain topology produces one
combined confirmation.

Web archive setup now asks **Should I build a Release Notes page?**, defines it
as the complete history of shipped updates, and offers a dedicated page, an
existing page, or no page while explaining that building it does not expose it
live or change the protected CMS destination. It then asks **Who should see
Release Notes?** and maps developers, preview reviewers, and live visitors to
the environments where the Web page appears.

Public-Web version setup now explains patch, minor, and major changes with
concrete SemVer examples and offers automatic patches while minor and major
releases ask. Normal first-time setup records `ask` for future missing UI and
waits for an exact proposal; advanced `allow` and `existing-only` policies
remain supported. This prospective change rewrites no released history and
grants no public surface, operator access, dependency, deployment, publication,
or version authority.

<!-- simple-changelogs-guidance-update version="18" kinds="behavior,onboarding" backfill="not-needed" summary="Release notes now group related bullets by product area by default, onboarding confirms stable-major naming, and patch releases use one flat Bug Fixes & Improvements section." -->
## Guidance 18

Release notes now group related changes under user-recognizable product areas by
default, merging repeated categories and leaving sparse releases flat.
Onboarding confirms whether stable major releases should receive a concise name
beside the canonical version. Minor releases require no name, and patches always
use one flat **Bug Fixes & Improvements** section. The preferences are
prospective and grant no public surface, CMS access, deployment, publication,
or version authority.

<!-- simple-changelogs-guidance-update version="19" kinds="capability,onboarding" backfill="optional" summary="A bundled read-only query CLI now reads releases and entries from the public Markdown histories and lint-checks their structure. Curated public release notes can now derive RELEASE_NOTES.md from the changelog." -->
## Guidance 19

Web+CMS repositories gain a queryable public history: agents and maintainers can answer history questions
directly from `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md` with the bundled
`scripts/query.ts` helper. It lists release sections, shows one release by
version, date, or `Unreleased`, filters entries by date, group, agent, or
pattern, and lint-checks structure with a nonzero exit on problems. Bare
versions resolve to full ones, duplicate headings are disambiguated by
occurrence, and ambiguity produces a candidate list rather than a guess.

The helper also understands the legacy `<!-- Agent: ... -->` signature dialect
used before the canonical signature comment, so older attributed history stays
queryable. Legacy signatures are reported as notes during lint, never treated
as errors, and `references/querying.md` documents every subcommand.

This addition is read-only. It changes no saved settings, asks no new
onboarding questions, writes no cache or index beside the Markdown source of
truth, and gives released history no reason for a backfill.

Setup state recorded after onboarding — completing a partial released-history
audit, acknowledging a guidance update, or changing contextual preferences —
now writes through the same transaction-marked atomic path as initial
onboarding, and re-recording identical contextual preferences reports the
repository as already configured without rewriting stored policy. Guidance
acknowledgments advance the repository and CMS policy guidance blocks
together, and a pending CMS-track update now surfaces its own notice.

Repositories with a public marketing or web surface may now opt into curated
public release notes. A new optional `publicReleaseNotes` repository policy
(`full` by default, `curated` on request) derives a `RELEASE_NOTES.md` at each
release boundary: a few one-sentence highlights within an optional
`curationBudget` (default 3-8) plus one rollup line pointing at the complete
changelog. The curated file is derived, never authored; every changelog entry
is mechanically accounted as highlighted, rolled up, or omitted, and breaking
changes and security notices are never omitted or rolled up. The proposed
section rides the existing release receipt, onboarding asks one evidence-led
question only when a public destination is detected, and repositories that
keep the default `full` policy see no change. Backfilling curated sections for
already-released history is a safe derived operation, offered once, never
automatic.

<!-- simple-changelogs-guidance-update version="20" kinds="behavior" backfill="optional" summary="Reconciliation now keeps one empty Unreleased heading so later merges cannot land in the newest release." -->
## Guidance 20

A reconciled release now keeps an empty `## Unreleased` heading in both
changelogs; removing it let the next merge prepend into the newest release.
`query.ts check` flags a duplicate or non-leading `Unreleased`. An optional
audit restores a missing empty heading and reports entries the newest release
absorbed; moving them needs separate authority.

<!-- simple-changelogs-cms-guidance-update version="2" kinds="capability,onboarding" backfill="optional" summary="CMS changelog entries may now carry curated highlights with a mechanical accounting of every underlying change." -->
## CMS Guidance 2

`.simple-changelogs-cms.json` records this separate CMS track. A
`CMS_CHANGELOG.json` entry may now carry optional `highlights` beside its full
`changes`, plus an optional `curation` object accounting every change by its
stable 12-hex id as highlighted, rolled up, or omitted. The validator rejects
unknown or repeated ids and never lets a `**Breaking**` or `**Security**`
change be omitted or rolled up. Other entries are unchanged; a backfill of
released operator history is optional and derives only from recorded changes.
