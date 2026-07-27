# Editorial Updates Application Fixture

This web application has returning users and a reachable `/updates` page linked
from public navigation. The page is an editorial blog containing product
stories; it is not a versioned release archive and does not read the canonical
changelog.

When authorized, use these local paths:

- customer archive: `src/routes/release-notes.tsx`;
- customer compact surface: `src/components/release-notes-modal.tsx`;
- protected technical archive: `src/routes/admin/changelog.tsx`.

Link customer surfaces from `src/routes/index.tsx` without changing the
editorial `/updates` route. Link the technical archive beneath
`src/routes/admin/index.tsx`, whose existing `requireDeveloper()` call proves
the developer/admin access boundary.

Use `releases/*.md` as trustworthy historical release evidence during a full
initial backfill.
