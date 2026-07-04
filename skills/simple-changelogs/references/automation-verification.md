# Automation And Verification

Use this reference for final checks, repo-local automation, and rules that are
better enforced by scripts or tests than by prose.

## Commands

For changelog-only markdown edits, diff review is usually enough. When version,
package, generated release-note, app-store metadata, parser, or product code
changed as part of the same task, run the repo's relevant checks.

Prefer existing repo-native checks over adding ad hoc scripts. Look for commands
or tests that already validate:

- empty `Unreleased` sections
- hidden agent signature comments being ignored by generated release-note data
  and UI parsers
- latest `CHANGELOG.md` section alignment with release-note data
- package/app/store metadata alignment with the current release version
- customer-visible diffs requiring customer changelog coverage

If a repo has stable generated release-note data and no existing check for a
known drift class, consider adding the smallest focused check that fits the
repo's test style.

## Final Review

Before finalizing, confirm:

- Every customer changelog bullet answers what a user can see, do, understand,
  or trust now.
- No customer bullet is DX-only, pre-release repair-only, or purely
  implementation detail.
- Pre-release fixes to already announced features, workflows, or baseline
  expectations are not announced separately; still-unreleased prior entries are
  revised instead when needed.
- No customer bullet exposes clone-enabling mechanics, hidden heuristics, source
  precedence, parser rules, taxonomy aliases, provider quirks, operational
  cadence, AI/moderation criteria, security-control mechanics, private vendor
  details, or roadmap sequencing.
- No copy-only bullet is included unless it changes user understanding, trust,
  access, legal/compliance meaning, pricing, setup, or error recovery.
- Customer-facing entries use the minimum detail needed to communicate the
  change, except major feature launches or workflow overhauls include enough
  detail for users to understand what changed and how to use it.
- Customer bullets inside each version are ordered by affected-surface radius.
- First-time feature launches use a feature name plus what users can now do,
  instead of comparative wording such as `easier to`, `clearer`, `better`, or
  `improved`.
- Multiple post-`1.0.0` public bug fixes are grouped under `Bug Fixes` after
  larger feature, workflow, trust, and data-quality entries.
- Customer wording is plain, concise, and audience-appropriate.
- `DEVELOPER_CHANGELOG.md` explains technical changes plainly and does not read
  like a raw commit log.
- Superseded developer notes are removed when no longer useful, or moved to a
  bottom-of-section `Superseded` subsection with obsolete claims struck through
  and concise replacement context.
- Raw changelog markdown edits include a nearby hidden agent signature comment
  with the model name/version and local timestamp.
- Generated release-note data and UI parsers ignore hidden signature comments so
  attribution metadata is not rendered to users.
- Release intent is established before entries move out of `Unreleased`, version
  fields change, or release-note surfaces sync.
- Empty `Unreleased` sections are removed after release finalization, and
  `Unreleased` exists only when it contains pending entries.
- Release-note data, app "What's New" surfaces, and version fields match the
  changelog when the repo already has a visible release-note flow or release
  prep adds one by default for an app with returning users.
- Mobile store release notes are updated or drafted during mobile release prep
  when App Store, Google Play, TestFlight, internal testing, closed testing, or
  marketplace metadata is part of the release flow.
- Mobile store release notes stay mobile-scoped, concise, non-promotional, and
  free of web-only/admin-only/developer-only notes and implementation mechanics.
- When a released version section is created or changed, the final response
  reports a version map: `Updated`, `Already aligned`, or `Intentionally
  skipped` for each relevant changelog, release-note, app, package, and store
  metadata source identified by local repo policy.
- Major feature groups stand out above minor fixes in app "What's New" surfaces
  and public release-note pages.
- Non-developer-facing apps without an existing public changelog source have a
  real changelog route or page for full history instead of using one ever-growing
  modal as the archive.
- Major-release modals or detail views use a concise summary, scannable
  highlights, and one clear full-changelog action without duplicating identical
  links.
- Auto-shown release-note modals default to the latest release; manual modal or
  compact detail surfaces show only the current major or last 2-3 short releases
  while readable, then link to the full changelog route/page for older history.
- Auto-shown release-note modals appear only after higher-priority gates such as
  auth, age gates, consent, onboarding, account recovery, payment, safety, or
  mandatory migration flows.
- In monorepos, web, mobile, admin, developer, and portal release-note surfaces
  are scoped to the audience and platform that can use them instead of crowding
  one web modal with unrelated notes.
- Internal admin/developer release-note surfaces, when added, pull from
  `DEVELOPER_CHANGELOG.md` or equivalent internal history and exclude
  frontend-only UI polish or customer-only notes unless relevant to that
  internal audience.
- Internal admin/developer release-note surfaces use `Release Notes` as the
  user-visible label unless the repo already has a stronger local convention.
- Internal admin/developer full-history surfaces prefer a dedicated route or
  panel, such as `/admin/dev/release-notes` or `/admin/release-notes`, while
  admin modals stay short and link to the full internal surface.
- Hidden, disabled, preview, prototype, or internal-only surfaces are not treated
  as customer-facing without evidence of real user or operator visibility.
