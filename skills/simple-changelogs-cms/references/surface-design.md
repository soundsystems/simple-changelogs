# Release-Note Surface Design

Read this reference only after explicit user approval or documented repository
policy authorizes the exact operator surface. Authorization, audience, and
source isolation remain owned by `references/cms-surface.md`.

## Component source

Use the proven repository design system and the administrative shell already in
place. With React and no established primitives, `recommended-web-components`
may use the confirmed shadcn/ui on Base UI recommendation. Preserve existing
Radix under `recommended-web-radix`. `minimal-markup` adds no
component-library dependency.

Name every dependency in the confirmed receipt before installation. Follow
current library documentation rather than remembered APIs.

## Operator history shape

After explicit user approval names the route, implement it inside the existing
administrative navigation, density, and typography. Use one readable column,
stable entry anchors, body copy of at least 16px, a four-point spacing scale,
semantic categories that do not depend on color, shared light/dark tokens, and
explicit empty, loading, and error states.

Keep the visible label **Changelog** for protected technical history, and keep
customer **Release Notes** wording out of the operator route. Operator density
may exceed a customer archive.

## Verification

Verify every authorized surface:

1. Keyboard, switch, and screen-reader use can traverse and dismiss it.
2. Focus or accessibility position returns to the prior control.
3. Opening an overlay causes no page layout shift.
4. Long content scrolls inside the overlay, not behind it.
5. Long words, URLs, code, and tables remain contained.
6. Small screens, 200% zoom, and large accessibility text keep actions usable.
7. Light and dark modes meet 4.5:1 body-text and 3:1 large-text/UI contrast.
8. Reduced-motion preferences are honored.
9. Empty, single-entry, and long-history states render correctly.
10. Dates are consistent and never invalid.
11. Unknown or malformed source data never renders silently.
12. Overlays respect sticky chrome and required notices.
13. Server-rendered stacks have no unstyled flash or hydration mismatch.

## Seed from validated source

After explicit user approval names the seed scope, populate the operator route
from the complete validated operator history. Never merge customer, mobile,
store, package, or developer canonical history into it. If historical reconstruction was
deferred or declined, seed only existing validated content and report the
limit; surface authority never permits reconstructing or rewriting history.
