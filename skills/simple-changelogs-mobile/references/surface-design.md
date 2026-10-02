# Release-Note Surface Design

Read this reference only after explicit user approval or documented repository
policy authorizes the exact archive or compact surface. Authorization,
audience, and platform scope remain owned by
`references/release-note-surfaces.md`.

## Contents

- Component source
- Archive shape
- Compact shape
- Inline emphasis
- Group titles and categories
- Verification
- Seed from canonical history

## Component source

Use the app's established kit first. Otherwise
`platform-native-components` covers Expo UI, React Native core, SwiftUI
presentations, and Compose sheets. `minimal-markup` adds no component-library
dependency and relies on the platform's own controls.

Store copy is already an established destination. In-app history complements it
and never repeats it word for word.

Name every dependency in the confirmed receipt before installation. Follow
current platform documentation rather than remembered APIs.

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

Show the canonical public version for the release being presented. A version
display preference of `exact` keeps the stored value, `friendly` allows an
established treatment such as adding “Version” while preserving that value, and
`hidden` renders no version at all. Never substitute a build number, a
development identifier, or a release name for the public version. An optional
release name may sit beside it, as in `Summer Update · Version 3.2.0`.

## Inline emphasis

Treat supported inline Markdown as presentation data, not visible punctuation.
Render `**named term**` as semantic strong emphasis or the native equivalent,
using the product's established emphasis or accent token when one exists.
Never expose raw emphasis delimiters such as `**` or `****` to users.

Normalize an unambiguous doubled strong wrapper such as
`****named term****` to one strong span. Treat other malformed or unmatched
markers as a content error to correct at the source; do not guess at nesting or
silently discard punctuation.

Use semantic strong emphasis as a sparse scan anchor for the smallest exact
named product term. Product and app surfaces, core components, filters,
categories, formats, and other public product-contract nouns are good
candidates. Do not emphasize connective prose, descriptive filler, whole
sentences, or every repeated noun.

Keep feature bullets focused on the capability and practical outcome rather
than inventorying every emoji, gesture, shortcut, role-specific recommendation,
or transient control state.

Keep emphasis accessible without relying on color alone, escape or render
untrusted text safely, and cover plain text, repeated terms, malformed markers,
and emphasized text containing reserved characters in renderer tests.
## Group titles and categories

When `releaseNoteGrouping` is `product-areas`, use short user-facing product
areas rather than implementation, commit, or release-process labels. Structured
entries should provide the group explicitly for new work; a renderer may map
legacy singleton notes only when the category is stable and unambiguous.

Render exactly one group for each title in a release. Merge matching groups
across the whole release, order them by user importance, and keep a singleton
flat when a category would add no scanning value. Use **Bug Fixes &
Improvements** only as the final miscellaneous fallback; never use **Updates**
as a category.

Patch releases use **Bug Fixes & Improvements** as the release title and render
a flat list with no group layer beneath it. When the preference is `flat`,
render release-level bullets directly while preserving feature-led nested
outcomes that belong to one named feature.


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
13. Cold start and post-update launch show no unstyled flash or stale copy.
14. Named product terms use sparse semantic emphasis without turning whole
    sentences into accent text.

## Seed from canonical history

After explicit user approval names the seed scope, populate each archive from
the complete canonical history eligible for that product. Keep compact
surfaces limited to the latest qualifying release. If historical reconstruction
was deferred or declined, seed only existing canonical content and report the
limit; surface authority never permits reconstructing or rewriting history.
