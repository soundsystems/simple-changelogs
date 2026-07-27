# Release-Note Surface Design

Read this reference only after explicit user approval or documented repository
policy authorizes the exact archive or compact surface. Authorization,
audience, and platform scope remain owned by
`references/release-note-surfaces.md`.

## Component source

Use the proven repository design system first. With React and no established
primitives, `recommended-web-components` may use the confirmed shadcn/ui on
Base UI recommendation. Preserve existing Radix under
`recommended-web-radix`. Mobile uses `platform-native-components`: Expo UI,
React Native core, an established native kit, SwiftUI, or Jetpack Compose.
`minimal-markup` adds no component-library dependency.

Name every dependency in the confirmed receipt before installation. Follow
current library or platform documentation rather than remembered APIs.

## Archive shape

After explicit user approval names the archive, implement it in the selected
product's existing navigation and theming. Use one readable column, stable
release anchors, body copy of at least 16px/points, a four-point spacing scale,
semantic categories that do not depend on color, shared light/dark tokens, and
explicit empty, loading, offline where relevant, and error states.

Use **Release Notes** for customer history and **Changelog** for protected
technical history unless established naming says otherwise. Keep Web, Mobile,
store, and internal content filtered by their proven selectors.

## Compact shape

After explicit user approval names the compact surface, show the latest
qualifying release with one to three highlights and one archive action. Bound
height, scroll internally, respect safe areas, provide 44px/point touch
targets, keep motion under 200ms, and disable motion when reduced motion is
requested.

Record dismissal by product and release identity, return focus or accessibility
position, and retain a manual path after dismissal. Timing, depth, and
eligibility remain governed by `references/release-note-surfaces.md`.

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
9. Empty, single-entry, offline, and long-history states render correctly.
10. Dates are consistent and never invalid.
11. Signature comments never become visible copy.
12. Overlays respect sticky chrome, safe areas, and required notices.
13. Server-rendered Web stacks have no unstyled flash or hydration mismatch.

## Seed from canonical history

After explicit user approval names the seed scope, populate each archive from
the complete canonical history eligible for that product. Keep compact
surfaces limited to the latest qualifying release. If historical reconstruction
was deferred or declined, seed only existing canonical content and report the
limit; surface authority never permits reconstructing or rewriting history.
