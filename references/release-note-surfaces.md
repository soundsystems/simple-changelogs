# Release Notes and What's New Surfaces

Use this reference when a release has customer-facing changelog bullets and the
repo has documented product-facing release-note surfaces.

## Surface Types

When a release has customer-facing changelog bullets, also update documented
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

## Synchronization Rules

Keep release-note versions and dates identical to their changelog headings.
Mirror the same grouped structure when the product UI supports nested notes.

If a release has no customer-facing or UX-impacting bullets, do not update
customer-facing release-note surfaces. Say explicitly that no customer release
notes are needed.

Use the changelog or release-note data as the source of truth; do not maintain
separate copy by hand when the product already has shared release-note data.

## Adding a What's New Surface

If an app has authenticated, returning, or session-based users and no "What's
New" surface yet, add one only when the task asks for product release-note UI or
the repo documents that such a surface is part of release prep. Otherwise report
that no documented surface exists and keep the changelog or release-note data as
the source of truth.

When adding one:

- Pull from the same user-facing changelog or release-note data.
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
