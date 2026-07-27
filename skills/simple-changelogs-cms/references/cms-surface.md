# Authenticated CMS Surface

The CMS route presents the structured operator history; it is not a second
source of truth.

## Default visible name

Label the authenticated developer, administrator, or operator history
**Changelog** unless the repository or current user establishes another product
name. Reserve **Release Notes** for customer-facing history by default. Preserve
an existing explicit CMS label rather than renaming it automatically.

## Access

Place the route beneath the application's established authenticated CMS or
admin layout. Verify the real guard in code and test unauthenticated behavior.
Path names such as `/admin` and `robots: noindex` do not provide access control.

Use the narrowest operator role that already manages the CMS. Do not expose
security or operational notes merely because a user is signed in to the public
application.

## Rendering

After explicit user approval identifies the authenticated operator surface,
read `references/surface-design.md` before product implementation. That
reference owns component choice, presentation, seeding, and UI-defect checks;
this file continues to own authentication, route, and source isolation.

Import and validate `CMS_CHANGELOG.json` through repository code. Render entries
newest-first with their date, optional version, title, summary, and changes.
Ignore unknown data only after the repository validator rejects it during CI;
do not silently render malformed state.

Link the route from the existing CMS navigation and preserve the application's
design system, responsive behavior, and accessibility patterns. Keep it out of
public navigation, sitemaps, feeds, search metadata, and customer update pages.

## Source isolation

Render only the validated CMS source. Do not merge the general customer
changelog, mobile or store notes, package history, or developer changelog into
the operator route. A shared release identity controls chronology, not
eligibility.

When repository code selects CMS entries from a broader structured source,
require explicit operator scope metadata and test both positive and negative
examples. Do not use heading names or keyword matching as the only filter.

## Scope

Creating the first route is product implementation and needs explicit authority.
Once documented in policy, synchronizing that same route with new entries is
ordinary CMS changelog work. Another route, modal, notification, or automatic
display remains a separate surface decision.
