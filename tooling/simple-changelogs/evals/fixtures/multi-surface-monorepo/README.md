# Multi-Surface Monorepo Fixture

Version `4.8.0` ships from one monorepo to web and mobile while the authenticated
CMS records operator-relevant outcomes from the same release. These established,
reachable sources are maintained independently:

- web: `apps/web/src/release-notes.ts`;
- mobile: `apps/mobile/src/release-notes.ts`;
- authenticated CMS: `apps/cms/src/release-notes.ts`.

Web users are affected by dashboard filters and shared account recovery. Mobile
users are affected by offline recovery and shared account recovery. CMS
operators are affected only by bulk publishing controls; they do not support or
configure the dashboard, mobile offline queue, or account-recovery flow.

The database migration and build-pipeline work are developer-only. A shared
version controls chronology, not destination eligibility.
