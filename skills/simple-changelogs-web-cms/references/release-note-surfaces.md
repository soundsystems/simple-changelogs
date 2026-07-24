# Web and Authenticated CMS Destinations

This distribution owns two release-note channels with different audiences.

- `CHANGELOG.md` is the durable customer source for public web history.
- `CMS_CHANGELOG.json` is the structured operator source for the authenticated
  CMS.
- `DEVELOPER_CHANGELOG.md` is maintainer history, not an automatic CMS feed.

## Public web channel

Update only reachable, established public destinations that belong to the
active release. Compact modals or recent-update panels select material
highlights; the full history belongs in `CHANGELOG.md` or a canonical changelog
page. Strip signature comments before rendering.

Creating or wiring a new public route, page, modal, navigation item, or
dismissal store requires explicit current authority or documented policy.

## CMS operator channel

Render the validated structured source beneath the repository's real
authenticated CMS/admin guard. A protected-looking path and `noindex` are not
access control. Keep the route out of public navigation, sitemaps, feeds,
metadata, APIs, and customer release systems.

Creating the first operator route requires authority. Once the policy records
an established route, synchronizing it from `CMS_CHANGELOG.json` is ordinary
CMS changelog work.

## Audience isolation

Classify and word an outcome independently for each channel.

- Customer copy explains visible product outcomes with minimum necessary
  public detail.
- CMS copy helps authorized operators understand workflow, content,
  integration, reliability, or support changes.
- Developer copy preserves implementation context for maintainers.

Do not move security specifics, private customer information, credentials,
support-only details, or operational mechanics into a broader channel merely
because the same release touches both.

## Release map

Report public and CMS sources and destinations separately. Include each
destination's audience, release identity, source, access state, and
updated/aligned/skipped/blocked disposition. This distribution does not own
mobile or store metadata.
