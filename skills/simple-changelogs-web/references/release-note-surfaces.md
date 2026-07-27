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

Verify both positive and negative scope examples: qualifying web and shared
outcomes render, while representative mobile-only, store-only, CMS-only, and
internal entries remain absent.

For indexed long-form pages, verify every anchor resolves to one unique feature
section and no empty product-area heading remains.

This distribution does not own mobile/store notes or authenticated CMS operator
history. Hand those destinations to the selected distribution instead of
silently expanding scope.
