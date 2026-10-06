# Release-Note Surfaces

Use this reference to synchronize established destinations, prepare platform
copy, or implement a missing destination after authority is established.

## Contents

- Authorization Before Product Implementation
- Default Visible Names
- Curated Layer Mapping
- Find Existing Destinations First
- Contextual Feature Links
- Destination Scope Map
- Product UI Editorial Selection
- Canonical Web and Mobile Feeds
- Audience and Platform Scope
- Existing-Surface Synchronization
- Mobile Store Copy
- Release Names and Version Display
- Authorized Missing-Surface Implementation
- Summary Versus Full History
- Long-Form Expert Release Archives
- Internal Destinations
- Verification

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

## Default Visible Names

Use **Release Notes** for customer- or user-facing full histories, recent
summaries, and automatically shown compact surfaces unless repository evidence
or the current user establishes another product name. Use **Changelog** for
developer-, administrator-, operator-, or maintainer-facing technical history.

“What's New” describes the compact latest-release pattern in this guidance; it
is not the default visible title. Existing labels, explicit naming preferences,
and product terminology outrank these fallbacks. Do not rename an established
surface merely to apply the defaults.

The raw sources keep their established filenames: `CHANGELOG.md` remains the
canonical customer source and `DEVELOPER_CHANGELOG.md` remains the canonical
technical source. Visible labels do not change source ownership.

## Curated Layer Mapping

When repository policy records `publicReleaseNotes: "curated"` and
`RELEASE_NOTES.md` exists, apply this default layer mapping: public marketing
pages and release-note modals render the curated layer, archive pages render
the full changelog, and internal surfaces are unchanged. There is no
per-destination layer policy field in this first cut; the mapping is
documentation, not new configuration. `references/curation.md` owns the
derived file itself.

## Find Existing Destinations First

Inspect release-note data, routes, screens, modals, store metadata, public docs,
repository-hosted releases, email templates, and generated feeds. Treat a
destination as established only when users can reach it and its audience and
source are documented by code, tests, instructions, or release automation.

Also inspect the product topology before accepting a requested destination.
Use Web and Mobile dependencies, application roots, native projects,
store-metadata integrations, CMS routes and authentication, workspace
configuration, and release automation as evidence. Report missing evidence
plainly. When the user confirms an absent Web, Mobile, store, or CMS target as a
planned surface, preserve that intent in the setup receipt but do not invent or
create the underlying product, monorepo layout, authentication boundary, or
remote integration. Rescan after product structure changes.

Prefer updating the established source over maintaining parallel copy. Hidden,
disabled, prototype, preview-only, unreachable, or wrong-audience components do
not prove that a usable equivalent exists.

Treat routes or screens named Updates, News, Blog, Announcements, or Release
Notes as candidates until their content and source prove their role. A blog or
marketing feed that occasionally announces features is adjacent to release
history, not automatically the full-history destination.

When a suitable full-history archive already exists, synchronize and backfill
it rather than creating a duplicate. When only an adjacent editorial
destination exists and a public archive is authorized, ask whether to:

- add a distinct **Release Notes** tab or section to that destination;
- create a dedicated **Release Notes** page, recommended when the existing
  destination is primarily editorial or promotional; or
- leave the candidate unchanged and add no public archive.

After the archive location is chosen, treat the compact surface as a separate
choice. For a product with returning users, recommend an automatically shown
**Release Notes** modal containing only the latest qualifying highlights and
one link to the selected archive. Also offer a manual-only summary or archive
only. The confirmed choice supplies current-task authority only for the exact
named surfaces.

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

## Contextual Feature Links

Read repository policy `releaseNoteLinks` as the rule for contextual actions
from an individual release item to the feature it describes:

- `when-useful` adds a link only when it materially helps an eligible reader
  open, try, configure, or review the released capability;
- `ask` identifies the exact label and destination but waits for owner approval
  before wiring it; and
- `disabled` emits no contextual feature links.

This preference does not remove structural navigation such as a compact
summary's link to the full Release Notes archive. A newly created route is a
candidate, not an automatic link: prove it ships in the same release, uses a
stable public contract, and is reachable by the note's audience. Check
authentication, role, tenant, platform, feature-flag, release-train, and
environment eligibility. Never expose an internal, admin, preview-only, or
production-hidden destination through broader notes.

Prefer a repository-relative Web URL or established mobile app or universal
link. Use a safe Web fallback when the native convention provides one.
Validate the final rendered action and its access-denied or unavailable
behavior; omit the action when evidence remains ambiguous.

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

## Product UI Editorial Selection

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

A Web, Mobile, store, CMS, package, or internal tab must contain only copy
selected for that destination. A separate tab or page is an audience boundary,
not permission to repeat unrelated product behavior.

## Canonical Web and Mobile Feeds

When one repository ships web and mobile products, preserve one canonical
customer history and derive independently scoped feeds from it. Do not maintain
parallel handwritten Web and Mobile copies when structured release-note data or
a small deterministic adapter can express the relationship.

When the repository supports structured release-note data:

- give every top-level item an explicit surface selector such as `web`,
  `mobile`, or both; do not assume an untagged item is shared;
- let nested bullets inherit the parent selector, with an explicit narrower
  selector when one grouped feature mixes platform-specific details;
- derive Web and Mobile feeds by filtering the canonical item set rather than
  copying text between app packages;
- remove a group when filtering leaves it with no bullets, and do not render an
  empty release section;
- when release tooling must preserve a version/date record for a release with
  no eligible public notes, keep that maintained metadata separate from the
  latest rendered feed version; and
- keep per-release dismissal or seen state independent by product so viewing
  one product's summary does not suppress the other product's summary.

Plain Markdown repositories use the same method through the destination scope
map: classify each item once, record evidence for every eligible surface, and
generate or synchronize each destination from that mapping.

Read `.simple-changelogs.json` key `mobileReleaseNotePlacement` before deciding
where mobile-specific history is rendered. The canonical Mobile feed remains
the source, while the selected value controls its destinations:

- `store-only` means **App stores only**. Prepare concise storefront or
  testing-track update copy without rendering mobile-specific history in an
  in-app or Web release-notes surface.
- `mobile-only` means **Mobile app and app stores, no Web**. It omits
  mobile-specific entries from Web changelog destinations.
- `web-tabs` means **Web and mobile on one tabbed Release Notes page**. Separate
  Web and Mobile feeds render under labeled tabs at one Web destination. The
  Mobile tab consumes the Mobile feed; it does not make mobile-only entries
  part of the Web feed.
- `web-page` means **Web and mobile on separate Release Notes pages**. The Web
  feed stays at the normal Web changelog and the Mobile feed also appears on a
  separate linked Web page.

Shared outcomes still appear in every independently affected feed. Store copy
remains a concise selection from the Mobile feed, never the entire mobile
history. Storefront copy preparation does not authorize a remote metadata
write, submission, or release. A placement preference does not authorize a
missing tab set, route, page, navigation entry, in-app screen, or dismissal
store; apply the product-implementation authorization rules above.

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
For Web and Mobile feeds, also verify nested selector inheritance, removal of
empty groups and sections, independent latest-rendered versions, and
product-scoped seen state.

## Mobile Store Copy

For a mobile test build or testing track, use `references/testing-notes.md`:
the finalizer prepares practical tester instructions and any platform copy.
Public storefront copy follows the rules below and has a separate audience.

When release preparation includes a public mobile store, prepare the
store field from the same mobile-scoped outcomes. Inspect local metadata,
submission configuration, native version files, scripts, documentation, and CI
before deciding where that copy belongs.

Store description copy belongs to one submitted public version, even when the
file it lives in holds only prose. Resolve that public version from its proven
owner; a store-note file is copy, never the version owner.

Normal store notes should be a compact paragraph or a few concise bullets:

- lead with a concrete mobile capability or material outcome;
- omit web-only, admin-only, migration, package, and release-process detail;
- avoid promotional claims and implementation mechanics;
- keep build numbers, `versionCode`, CI identifiers, internal prerelease
  suffixes, and private codenames out of the copy. An established testing-track
  audience may receive a build identifier only when repository evidence proves
  that audience needs it;
- do not repeat the version number the store already displays unless local
  style requires it;
- respect the repository's existing localization flow and current store limits.

### Apple and Google public update fields

Prepare separate plain-text copy for each affected platform and locale. Short
paragraphs or simple bullets are a portable house style, not a required store
template; omit raw Markdown, HTML, attribution comments, and test instructions.

| Destination | Current limit and format | Publication identity |
| --- | --- | --- |
| Apple App Store, What's New in this Version | 4,000 characters per localization. Describe specific features, improvements, and fixes. The field is unavailable for the first version and required for subsequent updates. | App, platform, public app version, and locale; use app-version metadata, not TestFlight build notes or App Review instructions. |
| Google Play production, What's new in this release? | 500 Unicode characters per language. Describe changes without promotional content or requests for user actions. Play Console places language tags on separate lines around each translation; API `releaseNotes` uses language/text entries without those tags. | Package, production track, release versionCodes, and locale; the release name alone does not identify the artifact. |

Verify current limits and the destination's editability/review state against
[Apple's version properties](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/),
[Apple's editable properties](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties/),
[Play release preparation](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en),
and the [Play track API](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks)
when publishing. Preparing copy does not submit a version, commit a Play edit,
change a rollout, or promote a testing artifact. Use existing submission tools
only within the authorized release scope, preserve unrelated translations and
release settings, then read back the saved text and matching identity. Report
saved metadata, review/submission state, and observed storefront publication
separately; metadata readback alone does not prove a public release is live.

When a tested artifact is promoted to production, rewrite its public update
copy for ordinary users. Do not copy the tester checklist into the store page.

Include relevant store fields in the final version map with their observed
version, artifact role, identifier role, and release train.

## Release Names and Version Display

When `majorReleaseNaming` is `named`, a reviewed stable-major title such as
`A New Foundation` is presentation only. It may
accompany a public version on an established surface, but it never overwrites
native metadata, store version fields, changelog headings, or
version-consistency checks, and it never appears in the version map.

When a surface records a version display preference, read it as:

- `exact` shows the canonical public version as stored;
- `friendly` applies an established treatment such as adding “Version” or
  dropping an unhelpful prefix, while preserving the underlying public version
  and never substituting a build number, development version, or release name;
- `hidden` renders no version on that surface while the canonical value remains
  in source data and release reports.

An established surface may therefore show `Summer Update · Version 3.2.0`.
Store description copy normally omits both, because the store already supplies
version context. Preserve established product style when it deliberately
includes a release name.

If the source is remote-only and the task does not authorize that remote
release action, provide exact copy plus the documented command, dashboard, or
release-manager step. Do not claim the remote value changed.

Include relevant store fields in the final version map with their observed
version and role.

## Authorized Missing-Surface Implementation

After explicit user approval identifies the exact archive or compact surface,
read `references/surface-design.md` before product implementation. That
reference owns component-source selection, presentation constraints, canonical
history seeding, and UI-defect verification; this file continues to own
authorization, audience, timing, and destination scope.

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
paragraphs. Patch releases use **Bug Fixes & Improvements** and a short flat
ledger with no category layer beneath that title.

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
