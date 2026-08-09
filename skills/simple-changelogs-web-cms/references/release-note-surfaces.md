# Web and Authenticated CMS Destinations

This distribution owns two release-note channels with different audiences.

- `CHANGELOG.md` is the durable customer source for public web history.
- `CMS_CHANGELOG.json` is the structured operator source for the authenticated
  CMS.
- `DEVELOPER_CHANGELOG.md` is maintainer history, not an automatic CMS feed.

## Default visible names

Use **Release Notes** for public customer histories and compact summaries. Use
**Changelog** for authenticated developer, administrator, operator, or
maintainer technical history. “What's New” describes a compact latest-release
pattern in this guidance; it is not the default visible title.

Preserve established labels and explicit naming preferences. These visible
names do not change the source filenames or audience boundaries above.

## Public web channel

Update only reachable, established public destinations that belong to the
active release. Compact modals or recent-update panels select material
highlights; the full history belongs in `CHANGELOG.md` or a canonical changelog
page. Strip signature comments before rendering.

Creating or wiring a new public route, page, modal, navigation item, or
dismissal store requires explicit current authority or documented policy.

Treat routes named Updates, News, Blog, Announcements, or Release Notes as
candidates until their content and source prove their role. A blog or marketing
feed that occasionally announces features is adjacent to release history, not
automatically a full archive.

When a suitable archive already exists, synchronize and backfill it. When only
an adjacent editorial destination exists and a public archive is authorized,
ask whether to add a distinct **Release Notes** tab or section there, create a
dedicated **Release Notes** page (recommended for editorial destinations), or
leave it unchanged and add no archive.

For a returning-user product, separately recommend an automatically shown
**Release Notes** modal with only the latest qualifying highlights and one link
to the selected archive. Also offer a manual-only summary or archive only. The
confirmed choice authorizes only those exact surfaces for the current task.


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

Public Web and CMS destinations must contain only copy selected for their own
audience. A separate tab or protected route is an audience boundary, not
permission to repeat unrelated product behavior.

## CMS operator channel

Render the validated structured source beneath the repository's real
authenticated CMS/admin guard. A protected-looking path and `noindex` are not
access control. Keep the route out of public navigation, sitemaps, feeds,
metadata, APIs, and customer release systems.

Creating the first operator route requires authority. Once the policy records
an established route, synchronizing it from `CMS_CHANGELOG.json` is ordinary
CMS changelog work.

## Audience isolation

After explicit user approval identifies the exact public or authenticated
surface, read `references/surface-design.md` before product implementation.
That reference owns component choice, presentation, seeding, and UI-defect
checks; this file continues to own authorization and audience isolation.

Classify and word an outcome independently for each channel.

- Customer copy explains visible product outcomes with minimum necessary
  public detail.
- CMS copy helps authorized operators understand workflow, content,
  integration, reliability, or support changes.
- Developer copy preserves implementation context for maintainers.

Build a scope map for each public web and CMS destination: record its path or
identity, audience and authorized roles, application or package, release train,
canonical source, positive inclusion rules, and explicit exclusions. A shared
repository, release date, or version never makes the eligible content
identical.

Public web destinations include web-visible outcomes and genuinely shared
outcomes that affect web users. They exclude CMS-only controls, operator
procedures, mobile-only work, and internal implementation.

CMS destinations include only changes that alter an authorized operator's
workflow, content model, controls, permissions, integrations, reliability,
support duties, or safe recovery. General public web changes do not belong in
the CMS changelog merely because operators use the same product. Mobile-only
and developer-only changes stay out.

Use changed paths, ownership, imports, tests, documentation, release metadata,
and established structured tags as evidence. Do not filter by headings or
keywords alone. A cross-channel outcome may appear in both only when each
audience independently needs it, with detail rewritten for that audience.

Do not move security specifics, private customer information, credentials,
support-only details, or operational mechanics into a broader channel merely
because the same release touches both.

## Long-form public web archives

When the established public archive serves expert users or the current request
asks for comprehensive technical notes, use release identity and date, named
feature narratives, optional verified media, an anchor-linked feature index
when the page needs one, stable product-area improvement groups, a complete
web-relevant public fix ledger, and distinct related-product or manual links.
Explain where readers find and use major features plus any compatibility
constraint.

Use only public technical identifiers needed by the proven audience. Reference
existing authorized media, verify its path and alt text, and omit media rather
than inventing or generating an asset. This long-form public pattern does not
expand the CMS eligible set or turn operator history into product marketing.

## Release map

Report public and CMS sources and destinations separately. Include each
destination's audience, release identity, source, access state, and
updated/aligned/skipped/blocked disposition. This distribution does not own
mobile or store metadata.

Verify representative positive and negative examples for both selectors:
web-relevant outcomes appear only in public destinations unless they also
affect operators, and CMS-only outcomes never appear in the public archive. For
indexed long-form pages, verify every anchor resolves to one unique feature
section.
