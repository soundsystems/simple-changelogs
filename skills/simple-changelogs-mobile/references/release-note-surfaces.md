# Mobile and Store Release Notes

Use this reference for mobile in-app notes and existing App Store, Google Play,
TestFlight, internal-testing, or marketplace metadata. `CHANGELOG.md` remains
the durable customer source.

## Scope by app and release

Inspect each mobile target independently. In a monorepo, prove which application
and release train a version field, Fastlane file, Play metadata file, or in-app
surface belongs to. Never synchronize an unrelated web or package version.

Use established repository-native destinations and locale conventions. A store
metadata path is evidence of a destination, not authority to submit it.

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

This distribution does not own web release-note pages or authenticated CMS
operator history.
