# Release-Note Surfaces

Use this reference to synchronize established destinations, prepare platform
copy, or implement a missing destination after authority is established.

## Authorization Before Product Implementation

Updating documented release-note data or an existing reachable surface is
normal release work when it belongs to the active release flow.

A new modal, route, page, screen, panel, navigation entry, dismissal store, or
operator surface is product implementation. That work requires one of:

- an explicit current user request;
- documented repository instructions or release policy; or
- `.simple-changelogs.json` value `newReleaseNoteSurfaces: "allow"`.

Do not create or wire a missing release-note UI when none of those authorities
exists. With policy value `ask`, request permission and record the answer as
described in `references/setup.md` before implementation.

An explicit current request for a particular destination authorizes that work
even when ongoing policy says `existing-only`. It does not change the stored
preference unless the user also grants continuing permission.

Authentication alone does not authorize developer, security, or operational
notes. An internal destination also requires local evidence that its intended
roles may read that information.

## Find Existing Destinations First

Inspect release-note data, routes, screens, modals, store metadata, public docs,
repository-hosted releases, email templates, and generated feeds. Treat a
destination as established only when users can reach it and its audience and
source are documented by code, tests, instructions, or release automation.

Prefer updating the established source over maintaining parallel copy. Hidden,
disabled, prototype, preview-only, unreachable, or wrong-audience components do
not prove that a usable equivalent exists.

## Destination Scope Map

Before synchronizing more than one release-note destination, build a scope map
for every affected surface. Record:

- the destination path or stable identity and whether it is a full history,
  selected summary, store field, or internal history;
- its audience and authorized roles;
- its product, application, package, platform, edition, and release train;
- the canonical customer or developer source it may draw from;
- positive inclusion rules; and
- explicit exclusions.

A shared repository, release date, or version does not make the eligible
content identical. Select entries independently for each destination:

- web surfaces receive web-visible outcomes and genuinely shared account,
  billing, sync, privacy, reliability, or backend outcomes that affect web
  users; omit mobile-only, native-build, store-submission, and CMS-only work;
- mobile surfaces receive mobile-visible outcomes and shared outcomes that
  affect the mobile app; omit web-only presentation, web-admin, and CMS-only
  work;
- store notes receive only mobile-scoped public highlights for the submitted
  app and release train;
- CMS histories receive changes that alter an authorized operator's workflow,
  content model, controls, permissions, integrations, reliability, support
  duties, or safe recovery; omit general web or mobile changes with no operator
  consequence;
- internal histories receive only technical or operational outcomes relevant
  to their authorized roles; and
- package, API, CLI, SDK, plug-in, device, or integration archives receive only
  changes to that public contract plus shared compatibility information their
  readers need.

Use repository ownership, changed paths, imports, release metadata, tests,
documentation, and established structured tags as evidence. Do not filter by
heading names or keywords alone. When relevance to a narrow destination remains
ambiguous, keep the canonical history intact, exclude the item from that
destination, and report the unresolved mapping.

Cross-platform outcomes may appear in several destinations only when the
outcome independently affects each one. Reword for each audience rather than
copying irrelevant platform detail.

## Audience and Platform Scope

Derive each destination from the customer or developer history appropriate to
its readers:

- Public product and documentation notes use customer-facing outcomes.
- Mobile notes contain mobile-visible changes plus shared account, sync,
  notification, reliability, privacy, safety, and trust outcomes relevant on
  mobile.
- Web-only or admin-only details stay off unrelated platforms.
- Internal maintainer or operator notes come from technical history and exclude
  customer marketing or visual polish unless it affects that audience.
- Cross-platform outcomes may appear in more than one destination when the same
  people genuinely benefit.

Never expose developer or security notes publicly merely because a parser can
read `DEVELOPER_CHANGELOG.md`.

## Existing-Surface Synchronization

Keep versions, dates, ordering, and grouping aligned with the canonical
changelog when the destination supports them. Ignore HTML comments while
rendering so raw attribution metadata remains hidden.

Do not treat every `CHANGELOG.md` entry as automatic copy for every destination.
A full-history mirror preserves the qualifying customer history, including
modest durable UI and interaction polish. Compact modals, store notes, emails,
and announcement-style summaries select material highlights for their audience
and normally omit minor polish even when the canonical changelog records it.

When a release has no customer-facing outcome, leave customer destinations
unchanged and state that decision. Do not fill them with developer-only work.

For established generated data, change the source of truth and regenerate the
mirror. Avoid hand-maintained duplicates that can drift.

For a multi-surface release, verify both sides of each selector: representative
eligible entries appear, and representative web-only, mobile-only, CMS-only,
store-only, and internal-only entries stay out of unrelated destinations.

## Mobile Store Copy

When release preparation includes a mobile store or testing track, prepare the
store field from the same mobile-scoped outcomes. Inspect local metadata,
submission configuration, native version files, scripts, documentation, and CI
before deciding where that copy belongs.

Normal store notes should be a compact paragraph or a few concise bullets:

- lead with a concrete mobile capability or material outcome;
- omit web-only, admin-only, migration, package, and release-process detail;
- avoid promotional claims and implementation mechanics;
- respect the repository's existing localization flow and current store limits.

If the source is remote-only and the task does not authorize that remote
release action, provide exact copy plus the documented command, dashboard, or
release-manager step. Do not claim the remote value changed.

Include relevant store fields in the final version map with their observed
version and role.

## Authorized Missing-Surface Implementation

After authority is recorded, follow the application's existing architecture and
design language. Use the same release-note source as other destinations, add a
short maintenance comment near new parsing or data wiring, and keep manual
access in a natural help, account, settings, menu, or documentation location.

For an automatically shown summary:

- show it only to returning users after authentication when authentication is
  required;
- wait until consent, legal acceptance, onboarding, recovery, payment, safety,
  security, and mandatory migration gates are complete;
- defer it during checkout, destructive actions, incident response, or another
  critical workflow;
- track dismissal per release and per relevant platform;
- retain a manual path after dismissal.

Do not use a release summary as onboarding for a brand-new user.

## Summary Versus Full History

A compact modal or sheet is a release summary, not an unlimited archive. Show
the latest release by default; a manual compact view may include a few short
recent releases while it remains easy to scan.

Do not create a full-history changelog route without the explicit current
request or documented policy required for a new product surface. When that
authority exists and no reachable public archive serves the same audience, the
full-history destination should use the canonical source and the summary should
offer one clear link to it.

Use `references/major-releases.md` to select, order, and synthesize the
major-release outcomes. The compact surface summary additionally:

- keeps only the highlights a returning user can scan in one sitting;
- omits minor UI, interaction, and copy polish unless it materially changes how
  that audience uses or understands the product;
- explains where users find important capabilities;
- uses technical names only when they are public product, API, CLI, SDK, or
  integration concepts;
- keeps its single full-history action unambiguous.

Avoid repeating an identical archive link inline and in the footer. Separate
links should serve distinct purposes.

## Long-Form Expert Release Archives

When an established archive serves an expert product audience or the current
request explicitly asks for a comprehensive technical release page, preserve
its deeper editorial pattern. Adapt to the repository's existing hierarchy, but
normally use:

1. release identity and date;
2. an anchor-linked feature index when the page is long enough to need one;
3. named feature sections ordered by product importance;
4. concise explanation of what each feature does, where readers find it, how
   they use it, and any compatibility or upgrade constraint;
5. verified media when it materially explains the feature;
6. additional improvements grouped under stable product-area headings;
7. a comprehensive audience-relevant bug-fix ledger; and
8. links to distinct related-product notes or detailed manuals when they serve
   a separate purpose.

Major and feature-bearing minor releases may use several explanatory
paragraphs. Patch releases should stay proportional: a short categorized
ledger is enough when no feature needs a narrative.

Use public technical identifiers and precise repair conditions only under the
expert-audience rules in `references/entry-classification.md`. Comprehensive
does not mean exposing developer history wholesale or including unrelated
platform work.

Reference only verified, authorized media that already belongs to the release
flow or that the current request separately authorizes. Confirm the file exists,
use useful alt text, and keep captions factual. Do not invent an asset, generate
a screenshot, copy remote media, or leave a broken placeholder merely to fill
the layout; omit media when no approved asset exists.

## Internal Destinations

Do not create an internal release-note route, panel, or modal without both
product-implementation authority and verified audience authorization. After
both are established, use the nearest existing admin or operator root rather
than scattering separate summaries across nested screens.

Use technical history relevant to backend, data, API, automation, security,
infrastructure, integration, and operational work. Test filters against the
real developer changelog so migration-only or tooling entries are not silently
lost, and so customer-only presentation work is not leaked into internal notes.

Keep an internal modal short and route older technical history to the
authorized full-history destination already established for that audience.

## Verification

Confirm the destination is reachable by the intended audience, the displayed
copy excludes raw comments and wrong-platform items, versions match the source,
dismissal behavior is scoped correctly, and no unapproved product surface or
remote release action was performed.

For multi-surface repositories, verify the destination scope map against the
rendered or generated output and test representative negative cases so web,
mobile, store, CMS, package, and internal details do not leak across selectors.
For long-form expert archives, also confirm media paths resolve and every
technical identifier is part of the public contract or needed by the proven
audience. When an index is present, confirm every anchor resolves to one unique
section and no empty product-area heading remains.
