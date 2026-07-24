# Routed Application Fixture

Authenticated routed application with returning users, shared release-note
data, and an unreachable What's New prototype. There is no reachable public or
internal release-note route at baseline.

When authorized, use these canonical local paths:

- public latest-release surface: `src/routes/whats-new.tsx`;
- public archive: `src/routes/changelog.tsx`;
- internal operator history: `src/routes/admin/release-notes.tsx`.

Link public routes from `src/routes/index.tsx`. New surface files need a short
top-of-file comment pointing to changelog or release-note guidance. Internal
notes must remain behind the existing authenticated admin boundary.
