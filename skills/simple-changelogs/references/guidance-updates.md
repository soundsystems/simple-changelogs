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
