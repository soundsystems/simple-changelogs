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
- Exclude frontend-only UI polish, visual fixes, customer-facing marketing
  copy, design-only changes, and routine component work unless those changes
  alter admin/developer operations or trust.
- Use one root modal, sheet, panel, or route for that admin/developer area
  instead of adding separate modals to every dashboard or nested route.
- Never expose internal developer notes to public customers or unauthenticated
  users.

## Synchronization Rules

Keep release-note versions and dates identical to their changelog headings.
Mirror the same grouped structure when the product UI supports nested notes.

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
- At a new major version, reset the modal to that major's relevant release
  history; within a major, append minor and patch sections newest first.

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
