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

## Deep Links to Released Features

Apply `releaseNoteLinks` to actions on individual in-app release items.
`when-useful` may deep-link when the action helps the eligible user open or
configure the released capability; `ask` proposes the exact label and target
for owner confirmation; `disabled` keeps feature items informational. A link
from a compact summary to the established archive remains structural and is
not controlled by this preference.

A new screen or route is only a candidate. Prove that it belongs to the same
app and release train, uses the app's established deep-link or universal-link
contract, and respects sign-in, role, subscription, feature-flag, and platform
eligibility. Provide the established safe Web fallback when one exists. Test
installed-app, unavailable-feature, and fallback behavior; omit ambiguous or
internal-only destinations rather than exposing a broken or unauthorized path.

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

An in-app or store destination must contain only copy selected for that app and
release train. A separate surface is an audience boundary, not permission to
repeat unrelated product behavior.

## Content budget

After explicit user approval identifies the exact in-app archive or compact
sheet, read `references/surface-design.md` before product implementation. That
reference owns native component choice, presentation, seeding, and UI-defect
checks; this file continues to own authorization, app scope, and store
isolation.

Store description copy belongs to one submitted public version, even when the
file it lives in holds only prose. Resolve that public version from its proven
owner; a store-note file is copy, never the version owner.

Store notes are short, plain, and mobile-scoped:

- Lead with user-visible capability or material repair outcomes.
- Omit developer-only changes, backend mechanics, private vendor details,
  internal codenames, security-control specifics, and unsupported claims.
- Keep build numbers, `versionCode`, `buildNumber`, CI identifiers, and
  internal prerelease suffixes out of the copy. An established testing-track
  audience may receive a build identifier only when repository evidence proves
  that audience needs it.
- Do not repeat the version number the store already displays unless local
  style requires it.
- Respect repository or store length limits and locale ownership.
- Do not turn baseline defect repair into promotional copy.

When `majorReleaseNaming` is `named`, a reviewed stable-major title such as
`A New Foundation` is presentation only. It may
accompany a public version on an established in-app surface, but it never
overwrites the native marketing version, `versionName`, a store version field,
a changelog heading, or a consistency check, and it never appears in the version
map. Read a recorded version display preference as `exact` for the stored
canonical value, `friendly` for an established treatment that still preserves
that value and never substitutes a build or development identifier, and `hidden`
for surfaces that render no version while the canonical value stays in source
data and release reports.

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

Give every reported record its identifier role — canonical release, public
version, build number, or development version — and name its release train
whenever more than one mobile application or platform train is involved.
Distinguish records that agree with their canonical value from build and
development identifiers that are related but intentionally different. Never
present a public version and a build number as if equality were expected.

Verify both positive and negative scope examples for every destination:
qualifying mobile and shared outcomes render, while representative web-only,
CMS-only, unrelated-store, and internal entries remain absent.

This distribution does not own web release-note pages or authenticated CMS
operator history.
