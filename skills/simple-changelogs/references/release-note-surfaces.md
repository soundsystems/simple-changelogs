# Release Notes and What's New Surfaces

Use this reference when a release has customer-facing changelog bullets and the
repo has or should have product-facing release-note surfaces.

## Surface Types

When a release has customer-facing changelog bullets, also update or add
user-facing release-note surfaces used by the product, such as:

- In-app "What's New" screens or modals.
- Release-note data modules.
- Website release pages.
- App store, extension store, or marketplace notes.
- Email or notification release summaries.

Treat a surface as user-facing only when local evidence shows users, customers,
stakeholders, or operators can actually see it. Good evidence includes routing,
navigation, app shell access, authenticated returning-user flows, public docs,
release-note data consumed by a deployed product, marketplace metadata, or a
public website.

Do not assume a named app, route, module, prototype, preview, hidden screen,
disabled feature, or internal-only tool is customer-facing merely because code
exists.

## Surface Scope

In monorepos with separate web, mobile, desktop, admin, or portal apps, keep
release-note surfaces scoped to the audience and platform that can use them.
Do not crowd the web app's release-note modal with mobile-only, admin-only, or
developer-only notes.

- Shared cross-platform releases can appear in multiple surfaces when the same
  user audience benefits from the note.
- Web-only notes belong in the web release-note surface.
- Mobile-only notes belong in a mobile "What's New" surface, not only in the web
  surface. For mobile apps, default to a modal or sheet when the app has an
  established modal pattern; use a dedicated route or screen when that is the
  app's existing release-note convention.
- App store or marketplace notes should still be derived from the same
  customer-facing changelog or platform-specific release-note data.

If a platform already has a reachable equivalent surface that pulls from the
right release-note data, update it instead of creating another one.

## Mobile Store Release Notes

When mobile release prep includes App Store, Google Play, TestFlight, internal
testing, closed testing, or other store-track metadata, prepare store release
notes as a separate customer-facing surface derived from the same changelog or
platform-specific release-note data.

Do not paste the full changelog into store release notes. Store notes should be
short, mobile-scoped, and useful at install/update time:

- Include only mobile-visible changes and shared account, auth, sync,
  notification, offline, reliability, safety, privacy, or trust changes that
  mobile users benefit from.
- Exclude web-only, admin-only, developer-only, migration, CI, package,
  internal release-process, and backend-only notes unless they directly change
  the mobile user experience.
- Use 2-5 concise bullets or one compact paragraph for normal releases. For
  major mobile launches, lead with the headline capability and keep the rest
  scannable.
- Avoid generic `Bug fixes and performance improvements` when the release has
  a concrete user-visible outcome. If a routine stability-only release truly
  has no specific customer-facing change, keep the note terse.
- Keep promotional copy, calls to action, pricing claims, and evergreen app
  description changes out of release notes unless the store field is explicitly
  for that purpose.
- Do not expose implementation mechanics for security, abuse prevention,
  offline replay, crash fixes, background work, providers, queues, review
  workarounds, build systems, or store-review compliance. Say the mobile outcome
  instead.
- Localize store release notes when the repo already maintains localized store
  metadata or the store submission requires per-language notes.

Respect store constraints and repo metadata sources:

- Apple App Store Connect uses `What's New in this Version` for changed app
  versions; it is required after the first version, localizable, and currently
  limited to 4000 characters.
- Google Play uses `What's new in this release?`; it is entered per language,
  currently limited to 500 Unicode characters per language, and should not be
  used for promotion or solicitation.
- Find existing store metadata before writing new copy. Check local sources such
  as Fastlane metadata, App Store Connect API payloads, Play Console metadata,
  EAS submit config, `app.json`, native version files, release scripts, docs, or
  CI workflows.
- If store metadata is remote-only, produce the exact release-note text and
  state the command, dashboard, credential, or release-manager action needed to
  apply it instead of claiming it was updated.
- Include store release-note fields in the release metadata sync map as
  `Updated`, `Already aligned`, or `Intentionally skipped`.

## Internal Admin and Developer Surfaces

If a repo already has an authenticated admin, developer, analysis, portal,
dashboard, or operations area, add or update a single internal release-note
surface at that area's root when maintainers or operators need runtime context
about backend, data, automation, API, security, infrastructure, or operational
changes.

Internal admin/developer surfaces:

- Pull from `DEVELOPER_CHANGELOG.md` or an equivalent internal technical history.
- Filter to backend, data, API, automation, security, infrastructure,
  integration, release-process, and operational changes relevant to that
  audience.
- Use `Release Notes` as the visible UI label unless the app already has a
  stronger local convention. The source file may still be named
  `DEVELOPER_CHANGELOG.md`.
- Prefer a dedicated route or panel for full internal history, such as
  `/admin/dev/release-notes`, `/admin/release-notes`, or the nearest equivalent
  that matches local routing. Use `release-notes` in new route/component names
  unless the repo already has a clearer convention.
- Ignore hidden raw-changelog signature comments such as `<!-- Agent: ... -->`
  when parsing `DEVELOPER_CHANGELOG.md` for an internal UI surface.
- Exclude frontend-only UI polish, visual fixes, customer-facing marketing
  copy, design-only changes, and routine component work unless those changes
  alter admin/developer operations or trust.
- Use one root modal, sheet, panel, or route for that admin/developer area
  instead of adding separate modals to every dashboard or nested route.
- If the internal surface is a modal, keep it to the latest internal release or
  a short current-major summary and link to the full route/panel for older
  entries. Do not make an auto-open admin/developer modal carry the full
  developer changelog.
- Never expose internal developer notes to public customers or unauthenticated
  users.

## Synchronization Rules

Keep release-note versions and dates identical to their changelog headings.
Mirror the same grouped structure when the product UI supports nested notes.

Release-note sync and internal release-note parsers must ignore hidden
raw-changelog signature comments such as `<!-- Agent: ... -->`; signatures are
audit metadata, not rendered release-note copy.

If a release has no customer-facing or UX-impacting bullets, do not update
customer-facing release-note surfaces. Say explicitly that no customer release
notes are needed.

Use the changelog or release-note data as the source of truth; do not maintain
separate copy by hand when the product already has shared release-note data.

## Adding a What's New Surface

If an app has authenticated, returning, or session-based users and no visible
"What's New" or release-notes surface yet, add one by default during release
prep when the release has customer-facing changelog bullets. Treat an existing
surface as equivalent only when users can actually reach it and it pulls from
the same user-facing changelog or release-note data.

Do not create a duplicate release-notes or "What's New" surface when a reachable
equivalent already exists. Update that existing surface and its data instead.

Do not count disabled, hidden, preview-only, prototype, unreachable, or
internal-only components as equivalent surfaces. If local evidence shows one of
those exists but users cannot reach it, either wire it into the visible app flow
or add a visible replacement that follows the app's conventions.

When adding one:

- Pull from the same user-facing changelog or release-note data.
- Add a short top-of-file comment pointing future agents to the project's
  changelog, release-note, or "What's New" guidance. Use generic wording unless
  the repo has a known local instruction name.
- Follow the app's route and component naming patterns. In React or TSX apps
  with no stronger repo convention, prefer a clear public-facing
  `release-notes.tsx`, `ReleaseNotes`, or `WhatsNew` name over an internal or
  ambiguous name.
- Link to it where it naturally fits in the existing app: footer, account menu,
  help menu, settings, command menu, release-notes page, or public changelog
  link.
- Style it in the app's own theme.
- Keep the body constrained and scrollable.
- Make the header and dismiss action persistent.

## Full Changelog Route and Major Release Detail

Do not use a release-note modal as the only long-term changelog archive when the
product has no external changelog, hosted repository release page, public docs
page, or existing in-app changelog route that users can reach.

For non-developer-facing products without a canonical public changelog source,
add or update a real changelog route or page when release prep adds or
materially changes a "What's New" modal. The route should render the full
relevant history from the same changelog or release-note source of truth. Link
it from the modal and from natural app navigation, and keep it scoped to the
same platform and audience as the modal.

Use the modal for the latest release or the current major version's most
relevant recent history. Do not append every historical major release into the
same modal forever; preserve older history on the canonical changelog route,
docs page, or external release source.

Use version count as a cap, not a target. Auto-shown modals should default to
the latest release. Manual modals or compact release-detail views may show the
current major version or the last 2-3 short releases only while the content
stays easy to scan. If the modal needs more than about two comfortable
screens, more than 5-7 top-level groups, or includes multiple major feature
sections, move the older or lower-priority history behind the full changelog
route/page.

For major releases or launch-level updates, the modal or release-detail view may
use a full-release format:

- A concise version summary that names the release and its main outcomes.
- A short `Highlights` section with feature-led, outcome-focused items.
- Enough detail for users to understand where important new capabilities appear
  and how to take advantage of them.
- Inline technical names only when they are visible product, API, CLI, SDK, or
  integration concepts that the audience recognizes.
- One clear `View full changelog` action. When the detail area scrolls, prefer
  a sticky bottom action that stays available while users read.

Avoid duplicating the same full-changelog link inline and again as a footer or
button. If two links appear, they must have distinct purposes, such as one
release-specific technical detail link and one general changelog archive link.

## App-Themed What's New Rules

For app-themed "What's New" surfaces:

- Preserve the same version order and grouped structure the app UI can support.
- Make headline capabilities easier to scan than minor updates. Group related
  major feature bullets under a plain feature heading, put those groups before
  narrow fixes, and keep polish or small repairs as shorter lower-priority
  bullets.
- Do not let narrow fixes visually compete with launch-level work. When a
  release includes primary workflow, access, shopping, safety, trust, or durable
  capability improvements, make those outcomes the first things returning users
  can scan.
- Auto-show at most once per release to returning users.
- Keep manual access available from a menu, account area, help surface, or
  public changelog page.
- Never use the modal as onboarding for brand-new users.
- At a new major version, reset the modal to that major's current release or
  most relevant recent history; within a major, append minor and patch sections
  newest first only while the modal remains readable. Keep full older history on
  the canonical changelog route, docs page, or external release source.

## Timing and Eligibility

Release-note modals should be helpful, not interruptive:

- If the app has authentication, auto-show release notes only after the user is
  authenticated and recognized as returning. Keep manual access available for
  signed-out users only when the surface is intentionally public.
- Show release notes after higher-priority gates and modals, such as age gates,
  consent, legal acceptance, required onboarding, account recovery, payment,
  safety, security, incident, or mandatory migration flows.
- Do not cover critical tasks such as checkout, payment, safety reporting,
  account recovery, or destructive admin actions. Defer the modal until the user
  reaches a stable app surface.
- Track dismissal per release and per relevant surface or platform so web,
  mobile, and internal portal notes do not suppress each other accidentally.
