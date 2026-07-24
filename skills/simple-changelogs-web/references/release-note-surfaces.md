# Public Web Release-Note Destinations

Use this reference only for web-facing release notes. `CHANGELOG.md` is the
durable customer source; a web page, docs route, modal, panel, or structured
data file is a destination selected for a particular audience and release.

## Discover before editing

Inspect routes, navigation, data imports, build scripts, tests, and repository
policy. A disabled component, unreachable prototype, or abandoned data file is
not an established release-note destination.

Update an existing reachable destination when it belongs to the active release.
Creating or wiring a missing destination is product implementation and requires
an explicit current request or stored permission.

## Content budget

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

This distribution does not own mobile/store notes or authenticated CMS operator
history. Hand those destinations to the selected distribution instead of
silently expanding scope.
