# Mobile and Store Release Notes

Use this reference for mobile in-app notes and existing App Store, Google Play,
TestFlight, internal-testing, or marketplace metadata. `CHANGELOG.md` remains
the durable customer source.

## Default visible names

Use **Release Notes** for customer-facing in-app histories, recent summaries,
modals, and sheets unless the repository or current user establishes another
product name. Use **Changelog** for protected developer, administrator,
operator, or maintainer technical history.

“What's New” describes the compact latest-release pattern in this guidance; it
is not the default visible title. Preserve existing labels and explicit naming
preferences. The raw filenames remain unchanged: `CHANGELOG.md` is the
customer source and `DEVELOPER_CHANGELOG.md` is the technical source.

## Scope by app and release

Inspect each mobile target independently. In a monorepo, prove which application
and release train a version field, Fastlane file, Play metadata file, or in-app
surface belongs to. A shared version or release date does not make the eligible
content identical. Never synchronize an unrelated web or package version.

Use established repository-native destinations and locale conventions. A store
metadata path is evidence of a destination, not authority to submit it.

Treat screens or routes named Updates, News, Blog, Announcements, or Release
Notes as candidates until their content and source prove their role. A
story-style update feed is adjacent to release history, not automatically a
full archive.

When a suitable in-app archive already exists, synchronize and backfill it.
When only an adjacent editorial destination exists and an archive is
authorized, ask whether to add a distinct **Release Notes** tab or section
there, create a dedicated **Release Notes** screen (recommended for editorial
destinations), or leave it unchanged and add no archive.

Choose the compact surface separately. For an app with returning users,
recommend an automatically shown **Release Notes** modal or sheet with only the
latest qualifying highlights and one path to the selected archive. Also offer a
manual-only summary or archive only. The confirmed selection authorizes only
those exact surfaces for the current task.

Build a scope map for each affected destination: record its path or identity,
mobile application, platform, audience, release train, source, positive
inclusion rules, and explicit exclusions. Include mobile-visible outcomes and
shared account, sync, notification, privacy, safety, reliability, or backend
outcomes only when they affect that app. Exclude web-only presentation,
web-admin, CMS-only, unrelated package, and internal build or migration work.

Use changed paths, ownership, imports, tests, documentation, release metadata,
and established structured tags as evidence. Do not filter by headings or
keywords alone. If relevance remains ambiguous, preserve canonical history,
omit the item from the narrow mobile destination, and report the mapping.

## Content budget

Store notes are short, plain, and mobile-scoped:

- Lead with user-visible capability or material repair outcomes.
- Omit developer-only changes, backend mechanics, private vendor details,
  internal codenames, security-control specifics, and unsupported claims.
- Respect repository or store length limits and locale ownership.
- Do not turn baseline defect repair into promotional copy.

Mobile in-app notes can provide more context than store notes but should still
default to the latest release. Keep older history in a reachable changelog or
manual release-history screen rather than an ever-growing auto-shown modal.
Strip raw HTML signature comments before rendering.

An established manually opened archive for expert mobile users may use named
feature narratives, verified media, compatibility guidance, stable product-area
headings, an anchor-linked feature index when the page needs one, and a
comprehensive mobile-relevant public fix ledger. Store notes remain compact and
never inherit that exhaustive technical density.

Reference only existing authorized assets or media separately authorized by the
current request. Verify paths and useful alt text; do not invent or generate an
asset merely to fill the release layout.

## Authorization

Updating an established note file during an authorized release is normal sync.
Creating a new screen, sheet, modal, route, navigation item, or dismissal store
requires an explicit current request or documented policy.

Editing note files does not authorize a store upload, build submission,
TestFlight rollout, production release, tag, or hosted release. Report the
separate authority and credentials when those actions are requested.

## Version map

For release-bearing work, report each mobile application, package/bundle
version, build number when relevant, changelog section, in-app destination, and
store metadata destination as updated, already aligned, intentionally skipped,
or blocked.

Verify both positive and negative scope examples for every destination:
qualifying mobile and shared outcomes render, while representative web-only,
CMS-only, unrelated-store, and internal entries remain absent.

This distribution does not own web release-note pages or authenticated CMS
operator history.
