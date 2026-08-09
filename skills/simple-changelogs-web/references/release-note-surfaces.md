# Public Web Release-Note Destinations

Use this reference only for web-facing release notes. `CHANGELOG.md` is the
durable customer source; a web page, docs route, modal, panel, or structured
data file is a destination selected for a particular audience and release.

## Default visible names

Use **Release Notes** for customer-facing full histories, recent summaries, and
automatically shown compact surfaces unless the repository or current user
establishes another product name. Use **Changelog** for protected developer,
administrator, operator, or maintainer technical history.

“What's New” describes the compact latest-release pattern in this guidance; it
is not the default visible title. Preserve existing labels and explicit naming
preferences. The raw filenames remain unchanged: `CHANGELOG.md` is the
customer source and `DEVELOPER_CHANGELOG.md` is the technical source.

## Discover before editing

Inspect routes, navigation, data imports, build scripts, tests, and repository
policy. A disabled component, unreachable prototype, or abandoned data file is
not an established release-note destination.

Update an existing reachable destination when it belongs to the active release.
Creating or wiring a missing destination is product implementation and requires
an explicit current request or stored permission.

Treat routes named Updates, News, Blog, Announcements, or Release Notes as
candidates until their content and source prove their role. A blog or marketing
feed that occasionally announces features is adjacent to release history, not
automatically a full archive.

When a suitable archive already exists, synchronize and backfill it. When only
an adjacent editorial destination exists and a public archive is authorized,
ask whether to add a distinct **Release Notes** tab or section there, create a
dedicated **Release Notes** page (recommended for editorial destinations), or
leave it unchanged and add no archive.

Choose the compact surface separately. For a returning-user product, recommend
an automatically shown **Release Notes** modal with only the latest qualifying
highlights and one link to the selected archive. Also offer a manual-only
summary or archive only. The confirmed selection authorizes only those exact
surfaces for the current task.

For an approved public Web archive, apply repository policy
`releaseNoteEnvironmentScope` to the complete Release Notes surface:
`all-environments` exposes it locally, in preview, and in production;
`non-production` exposes it locally and in recognized previews;
`production-only` exposes it only in production; and `disabled` exposes it
nowhere. Gate the route or page itself, navigation and manual links, compact
summaries, and automatic modals together. A hidden dynamic route returns the
framework's standard not-found response; omit it from static production builds
when supported.

Use the deployment platform's authoritative environment signal, never a
hostname or branch-name guess. Unknown environments fail closed for scoped
values. This gate controls exposure only; changelog generation, archive-data
synchronization, deployment, and publication remain independent.


## Destination scope

Record each affected web destination's path or identity, audience, web
application or package, release train, source, positive inclusion rules, and
explicit exclusions. In a monorepo, a shared version or release date does not
make every changelog item web-relevant.

Include web-visible outcomes and shared account, billing, sync, privacy,
reliability, or backend outcomes only when they affect web users. Exclude
mobile-only interactions, native build changes, store metadata, device-specific
mobile work, authenticated CMS-only workflows, and internal maintenance.
Cross-platform outcomes may appear only when evidence proves the web impact;
rewrite them without unrelated platform detail.

Use changed paths, ownership, imports, tests, documentation, metadata, and
established structured tags as evidence. Do not filter by heading names or
keywords alone. If relevance remains ambiguous, leave canonical history intact,
omit the item from the narrow web destination, and report the mapping.

## Product UI editorial selection

Treat canonical customer history and selected product UI as separate editorial
layers. Keep every qualifying durable outcome in `CHANGELOG.md`, but require
each item to earn inclusion independently in every compact or in-product
destination. When structured release data supports it, preserve canonical text
and store explicit destination eligibility plus surface-scoped copy; do not
delete history merely to quiet a product surface.

Default product UI to material, useful changes that help a returning user
discover or use a capability, understand a changed workflow, complete
onboarding, or respond to an important access, payment, privacy, safety, or
trust outcome. Omit routine fixes, generic performance work, internal or
administrative changes, release plumbing, minor polish, copy churn, and
self-explanatory background mechanics.

Keep intentionally quiet or discoverable features out of release-note UI unless
the current product strategy explicitly calls for an announcement. Examples
include badges, achievements, rewards, easter eggs, experiments, and softly
launched capabilities. For an initial-development product, apply an especially
high bar to baseline repairs and performance claims; canonical history may
remain broader without turning those items into product news.

When public canonical history would itself spoil an intentionally discoverable
feature or disclose an experiment too early, preserve the change in developer
history and defer the customer entry until disclosure no longer defeats the
product intent. Record that disposition; do not silently lose the history.

A Web tab or page must contain only copy selected for that destination. A
separate surface is an audience boundary, not permission to repeat unrelated
product behavior.

## Content budget

After explicit user approval identifies the exact archive or compact web
surface, read `references/surface-design.md` before product implementation.
That reference owns component choice, presentation, seeding, and UI-defect
checks; this file continues to own authorization and destination scope.

Keep the full durable history in `CHANGELOG.md`. Compact surfaces select
material highlights rather than copying every customer entry.

- A manually opened recent-updates page may show several short releases.
- An auto-shown modal defaults to the latest release and one clear action to
  the full history.
- Major releases use a short summary, scannable highlights, and a full-history
  link.
- Strip raw HTML signature comments before rendering.

Preserve minimum necessary public detail. Do not expose private vendor details,
security-control mechanics, hidden heuristics, or clone-enabling
implementation.

## Long-form expert archives

When the established web archive serves expert users or the current request
asks for comprehensive technical notes, preserve a release-first editorial
shape: release identity and date, named feature narratives, optional verified
media, an anchor-linked feature index when the page needs one, additional
improvements under stable product-area headings, a complete web-relevant public
fix ledger, and distinct related-product or manual links.

Explain what a major feature does, where readers find it, how they use it, and
any compatibility or upgrade constraint. Use public API, CLI, SDK, plug-in,
device, integration, and debug names only when the proven audience needs them.
Keep patch releases proportional and do not import developer history wholesale.

Reference only existing authorized assets or media separately authorized by the
current request. Verify paths and useful alt text. Do not invent an image,
generate a screenshot, copy remote media, or leave a broken placeholder to fill
the layout.

## Reachability and sequencing

Link a new authorized destination from an established help, settings, footer,
menu, or release-history location. Follow the product design system and
accessibility conventions.

Auto-shown notes wait until authentication, consent, age gates, onboarding,
payment, recovery, migrations, and other higher-priority flows are complete.
Record dismissal by release identity only when the repository already owns that
kind of state or the current request authorizes it.

## Release alignment

During release work, include each established web destination in the version
map with its source, audience, version or date, and disposition. Do not change a
web package version merely because another package ships.

Give every reported record its identifier role — canonical release, public
version, build number, or development version — and name its release train
whenever more than one web application or package train is involved. A shared
repository proves shared source ownership, not a shared release train, and two
separately owned fields that currently hold the same string remain separately
owned. Distinguish records that already agree with their canonical value from
records that are related but intentionally different. Never derive a public web
version from a CI build identifier.

An optional release name such as `Summer Update` is presentation only. It may
accompany a public version on an established surface, but it never overwrites a
package version field, a changelog heading, or a consistency check, and it never
appears in the version map. Read a recorded version display preference as
`exact` for the stored canonical value, `friendly` for an established treatment
that still preserves that value and never substitutes a build or development
identifier, and `hidden` for surfaces that render no version while the canonical
value stays in source data and release reports.

Verify both positive and negative scope examples: qualifying web and shared
outcomes render, while representative mobile-only, store-only, CMS-only, and
internal entries remain absent.

For indexed long-form pages, verify every anchor resolves to one unique feature
section and no empty product-area heading remains.

This distribution does not own mobile/store notes or authenticated CMS operator
history. Hand those destinations to the selected distribution instead of
silently expanding scope.
