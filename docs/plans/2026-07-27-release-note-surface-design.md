# Release-Note Surface Design Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.
> Preserve unrelated work already present in the worktree. Use a `gpt-5.6-sol`
> subagent with medium reasoning effort for any customer and developer
> release-note wording produced by this work, as required by this repository.

**Goal:** Give repositories without an established design system enough
guidance to build a release-note archive page and a compact release-note modal
that look intentional and are free of common UI defects, ask once during
onboarding whether the user accepts a recommended component stack, and — after
the user confirms the setup receipt — implement the confirmed surfaces
immediately and seed them with the complete canonical history unless the user
opts out.

**Architecture:** One new bundled reference (`references/surface-design.md`)
owns presentation and UI-defect rules for authorized surfaces. Detection of an
existing component library moves into the bundled setup helper as inventory
evidence, so onboarding asks the styling question only when the repository has
nothing to follow. One new optional policy field records the answer.
`references/release-note-surfaces.md` keeps ownership of authorization and
scope and routes to the new reference at implementation time.

**Tech Stack:** Markdown skill guidance, Bun 1.3.13, TypeScript 7, `bun:test`,
JSON Schema draft 2020-12, Biome 2.5 through Ultracite, and the existing
adapter-driven evaluation harness.

## Confirmed Decisions

| Decision | Choice |
| --- | --- |
| Distribution scope | All product distributions. `full`, `web`, `web-cms`, `cms` receive web guidance; `mobile` receives the platform-native equivalent. `skill-repository` is excluded. |
| Existing component library | Detected from repository evidence by default. The styling question is asked only when no design system is found. |
| Durable record | One optional policy field plus a guidance-version bump for affected distributions. Absent remains valid. |
| Surface offer | Always offered during onboarding for `full`, `web`, `web-cms`, `cms`, and `mobile`. The user opts out; they do not opt in. |
| Mobile | Included, with native components (Expo UI, React Native core or the app's existing kit, SwiftUI, Jetpack Compose). Store notes stay a separate established destination and are never duplicated in-app. |
| Post-receipt behavior | A confirmed receipt naming the surfaces is the authorization. Build them, seed the archive with the complete canonical history, then resume the original task. |

## Non-Negotiable Invariants

These are enforced by existing checks. Violating any of them fails
`bun run check` rather than degrading quietly.

1. **`skills/*/scripts/setup.ts` is byte-identical to
   `tooling/simple-changelogs/scripts/setup.ts`** for all six changelog
   distributions (`tooling/distributions.check.ts`). Every helper change is
   written once and copied seven times.
2. **`IMPLICIT_UI_CREATION` contract.** Any sentence in a bundled Markdown file
   that pairs a release-note UI target (surface, ui, modal, route, page,
   screen, panel) with a creation verb (create, add, build, wire) must either be
   a prohibition or contain concrete authorization language. Use the phrasings
   the contract recognizes — "explicit user approval", "explicit user request",
   "documented repository policy allows", "stored policy grants". This plan adds
   a lot of build-the-surface prose, so this is the single most likely check to
   fail.
3. **`PROSE_DUPLICATION` contract.** No 18-word run may be shared between
   `SKILL.md` and any `references/*.md` in the same distribution.
4. **`VENDOR_ASSUMPTION` contract.** Scoped core files must not name an agent
   vendor. UI libraries are unaffected, but keep the check in mind when writing
   examples.
5. **256 KB per distribution.** Current worst case is `web-cms` at ~212 KB.
   The new reference must be lean and must not be duplicated into files that
   already cover the same ground.
6. **Routed paths must resolve.** Every `references/...` path mentioned in a
   bundled Markdown file must exist in that same distribution.
7. **Guidance headings are contiguous.** `references/guidance-updates.md` must
   contain exactly one `## Guidance N` heading for every integer from 1 to the
   version declared in that distribution's `SKILL.md`.
8. **Schema parity.** Every enum in `tooling/simple-changelogs/scripts/lib/`
   `types.ts` has a mirrored JSON Schema, verified by
   `scripts/tests/schema-parity.check.ts`.
9. **Manifest coverage is exact.** `scripts/tests/manifest-coverage.check.ts`
   pins the case count, the trigger-id set, the behavior-id set, and the
   fixture-id set. New evaluation cases require updating those constants.

## Landmines Found During Research

- [ ] **Fix the guidance-version comparison before bumping anything.**
  `validateRepoPolicy` requires `mobileReleaseNotePlacement` when
  `value.guidance.version >= GUIDANCE_VERSIONS.full`. Bumping `full` from 6 to
  7 silently stops enforcing that requirement for policies recorded at version
  6. Replace the comparison with a dedicated constant
  (`MOBILE_PLACEMENT_MIN_GUIDANCE = 6`) so the invariant stays pinned to the
  version that introduced it. The mirrored JSON Schema already hardcodes
  `"minimum": 6` and is correct; the TypeScript validator is the drifting side.
- [ ] **Do not invent a second presentation vocabulary.**
  `tooling/simple-changelogs/scripts/lib/types.ts` already defines
  `SURFACE_VISUAL_DIRECTIONS`, `SURFACE_LAYOUTS`, `SURFACE_DETAIL_DENSITIES`,
  `SURFACE_DATE_DISPLAYS`, and `SURFACE_VERSION_DISPLAYS` for the curation
  manifest. The new field records the **component source**, not the visual
  direction. Where the new reference discusses layout, reuse those terms.
- [ ] **CMS policy pins `guidance.version` to the constant `1`** in both
  `validateCmsPolicy` and `skills/simple-changelogs-cms/schemas/`
  `repo-policy.schema.json`. Add the new field as an optional CMS policy key
  without touching that pin; the CMS version tracks backfill disposition, not
  schema shape.
- [ ] **Library APIs rot.** The new reference names libraries and states what
  they are good for. It must not encode import paths, component props, or
  install commands beyond "use the repository's package manager", and it must
  say to follow the library's current documentation. A skill cannot track
  upstream API changes.
- [ ] **shadcn is React-first.** Recommend it only when React evidence exists.
  For Vue, Svelte, Angular, or Astro without React, recommend the framework's
  own headless primitives or plain semantic markup with `<dialog>`, and apply
  the identical UI-defect checklist.
- [ ] **Installing a dependency is a product change.** The receipt must name any
  package that will be added, because the user is approving a dependency, not
  just a layout.

## Data Model

### Repository policy

Add one optional field to `.simple-changelogs.json`:

```json
"newReleaseNoteSurfaceComponents": "project-components"
```

Values:

- `project-components` — an established design system or component library was
  detected or declared. Follow it; recommend nothing. This is the default
  whenever evidence exists.
- `recommended-web-components` — no design system, React evidence present. Use
  shadcn/ui on Base UI.
- `recommended-web-radix` — Radix primitives already present. Use shadcn/ui on
  Radix and do not migrate the existing primitive layer.
- `platform-native-components` — mobile. Use Expo UI, React Native core, the
  app's existing native kit, SwiftUI, or Jetpack Compose.
- `minimal-markup` — the user declined a component library, or the stack is not
  React. Use semantic markup, native `<dialog>` where available, and the
  repository's existing CSS approach.

The field is optional forever. Absent means "ask when a surface is actually
authorized" — it never blocks ordinary changelog work, and existing repositories
are not forced to re-onboard.

The same optional field is added to `.simple-changelogs-cms.json` for the
CMS-only and web+CMS distributions.

### Helper surface

- `Inventory` gains `designSystemEvidence: string[]`.
- `unresolvedFor` gains `release-note-surface-components`, pushed only when the
  distribution can own product UI, policy is absent, and
  `designSystemEvidence` is empty.
- `ApplyOptions` gains `newReleaseNoteSurfaceComponents`, exposed as
  `--surface-components`.
- `SetupResult.selection` gains the same field.

### Detection evidence

Package metadata and marker files, sorted and deduplicated like existing
evidence:

| Signal | Evidence recorded |
| --- | --- |
| `components.json` | existing shadcn configuration |
| `@radix-ui/react-*` | Radix primitives present |
| `@base-ui-components/react` | Base UI primitives present |
| `@mui/material`, `@mantine/core`, `@chakra-ui/react`, `antd`, `bootstrap` | established component library |
| `.storybook/`, `packages/ui/`, `design-system/` | repository-owned component library |
| `tailwindcss` with no primitive library | utility CSS only, no primitives |
| `react-native-paper`, `tamagui`, `@gluestack-ui/*`, `nativewind`, `@shopify/restyle` | established mobile kit |
| `*.swift` with SwiftUI, Gradle with Compose | platform-native toolkit |

A detected library is evidence, not proof it is used for user-facing surfaces —
same standard already applied to route-name candidates. State what was found and
let the user correct it.

## Onboarding Flow

Question order in `references/onboarding.md`, which must keep the released-history
question last:

1. Project type (only when unresolved).
2. History audiences.
3. Signatures.
4. Missing-destination behavior.
5. **Contextual product-surface choice — now always offered** for `full`,
   `web`, `web-cms`, `cms`, and `mobile`. Present the archive and the compact
   surface as the recommended default with an explicit decline option; today's
   text offers this only when a candidate destination exists.
6. **New: component-source question — only when `designSystemEvidence` is
   empty.** One question, three answers: accept the recommendation, name their
   own library, or minimal markup.
7. Preference scope.
8. Released-history question (unchanged, still last).
9. Receipt, apply, build, seed, resume.

Recommended wording for the new question, kept short because it appears only for
users who have nothing to follow:

> This repository has no detected component library. Release-note surfaces read
> best with a small set of accessible primitives. Recommended: shadcn/ui on
> Base UI — copy-in components, no runtime lock-in, accessible dialog and
> scroll behavior out of the box. It adds `tailwindcss` and the Base UI
> packages. Alternatives: name a library you already use, or plain semantic
> markup with no new dependency.

When Radix is detected, the recommendation names shadcn/ui on Radix instead and
states that the existing primitive layer is kept.

The receipt must name: the archive placement and visible label, the compact
surface and its trigger, the component source, **every dependency that will be
added**, and the history seeding disposition.

## New Reference: `references/surface-design.md`

Bundled into `full`, `web`, `web-cms`, `mobile`, and `cms`. Routed from the
`SKILL.md` reference router and from the implementation section of
`references/release-note-surfaces.md`. Not loaded for ordinary changelog work.

Content outline:

**Scope note.** This reference is read only after authorization exists. It
describes presentation; `references/release-note-surfaces.md` keeps ownership of
whether a surface may exist at all.

**Choosing components.** The evidence-to-decision table above, the
React-only caveat, the "follow current library documentation" rule, and the
requirement that added dependencies appear in the receipt.

**Archive page shape.** One column; readable measure of roughly 65–75
characters; three type sizes plus one meta size; body text no smaller than
16px with 1.5 line height; a spacing scale in multiples of 4 where the gap
between releases exceeds the gap within one; two neutrals and one accent;
category labels that never rely on color alone; a stable anchor `id` per
release; defined empty, loading, and error states; theming through tokens so
light and dark share one definition.

**Compact modal shape.** Latest release only; one to three highlights; one
unambiguous action to the archive; bounded height with internal scrolling;
bottom-sheet presentation and safe-area insets on small screens; touch targets
of at least 44 points; entrance motion under 200ms and disabled under reduced
motion; dismissal recorded by release identity; a manual path that survives
dismissal.

**UI-defect checklist.** The verification list an implementation must pass:

1. Keyboard alone can open, traverse, dismiss, and reach the archive link.
2. Focus is visible throughout and returns to the trigger on close.
3. Opening the modal causes no layout shift from scrollbar removal.
4. Long content scrolls inside the modal; the page behind it does not.
5. Long words, URLs, code, and tables scroll or wrap inside their own
   container instead of widening the page.
6. Renders at 320px wide and at 200% zoom with no horizontal page scroll.
7. Light and dark both render, with contrast of at least 4.5:1 for body text
   and 3:1 for large text and UI boundaries.
8. Reduced-motion preference is honored.
9. Empty, single-entry, and long-history states all render correctly.
10. Dates format consistently and never render an invalid value.
11. Signature HTML comments never appear in rendered copy.
12. The modal stacks above sticky page chrome without trapping toasts or
    escaping its layer.
13. Server-rendered stacks show no unstyled flash and no hydration mismatch.

**Platform sections.** Web, mobile-native, and CMS-operator variants of the
same rules. The mobile section states that in-app history is distinct from
store copy and must not duplicate it. The CMS section states that the operator
surface follows the admin shell and keeps the **Changelog** label.

**Cross-references.** Modal timing and depth rules stay owned by
`references/release-note-surfaces.md`; this reference points at them rather
than restating them, which also protects the prose-duplication contract.

## Build and Seed Behavior

After the user confirms a receipt that names the surfaces, and only for the
surfaces the receipt names:

- Implement the archive and the compact surface in the repository's existing
  architecture, using the recorded component source.
- Seed the archive with the **complete canonical history** available in
  `CHANGELOG.md`, not a recent window. The compact surface still shows only the
  latest release.
- If the canonical history is thin because the released-history backfill was
  deferred or declined, seed what exists and say so in the handoff. Never
  reconstruct history from commits under the surface authorization; that is the
  separate backfill authority in `references/backfill.md`.
- Recommend the comprehensive seed as the default and record the user's opt-out
  when they choose a narrower seed.
- Then resume the original changelog request.

New report codes for `runner-response.schema.json`:
`SURFACE_COMPONENTS_SELECTED`, `SURFACE_HISTORY_SEEDED`,
`SURFACE_HISTORY_SEED_DECLINED`, `SURFACE_DEPENDENCY_ADDED`.

## Task Checklist

### 1. Helper and contracts

- [ ] Replace `GUIDANCE_VERSIONS.full` in the `mobileReleaseNotePlacement`
      requirement with a dedicated `MOBILE_PLACEMENT_MIN_GUIDANCE = 6` constant,
      with a regression test that a version-6 policy without placement is still
      rejected after the bump.
- [ ] Add `designSystemEvidence` to `Inventory` and populate it from package
      metadata and marker files.
- [ ] Add `newReleaseNoteSurfaceComponents` to `RepoPolicy`, `CmsPolicy`,
      `Selection`, `ApplyOptions`, and the `--surface-components` CLI option,
      with validation matching the existing `oneOf` pattern.
- [ ] Add `release-note-surface-components` to `unresolvedFor`, gated on empty
      design-system evidence.
- [ ] Bump `GUIDANCE_VERSIONS`: `full` 6 → 7, `web` 5 → 6, `mobile` 5 → 6,
      `web-cms` 5 → 6. Leave `skill-repository` at 4 and the CMS policy version
      pinned at 1.
- [ ] Mirror the helper into all six `skills/*/scripts/setup.ts` copies.

### 2. Schemas and types

- [ ] Add the enum and types to `tooling/simple-changelogs/scripts/lib/types.ts`.
- [ ] Update `tooling/simple-changelogs/scripts/lib/validate.ts`.
- [ ] Update `evals/schemas/repo-policy.schema.json`,
      `setup-result.schema.json`, and `runner-response.schema.json`.
- [ ] Update `skills/simple-changelogs-cms/schemas/repo-policy.schema.json`.
- [ ] Extend `schema-parity.check.ts` coverage for the new enum.

### 3. Guidance

- [ ] Write `references/surface-design.md` once, then bundle it into
      `simple-changelogs`, `-web`, `-web-cms`, `-mobile`, and `-cms` with the
      platform sections each distribution needs.
- [ ] Route it from each `SKILL.md` reference table and from the implementation
      section of `references/release-note-surfaces.md`.
- [ ] Update `references/onboarding.md` in all six distributions: always-offer
      surface choice, the new component question with its skip condition, the
      expanded receipt, and the post-receipt build-and-seed step. Keep the
      released-history question last.
- [ ] Update `references/setup.md` in all distributions to document the new
      policy field and its values.
- [ ] Add the new `## Guidance N` entry to `references/guidance-updates.md` for
      each bumped distribution and update `Current guidance version:` in each
      `SKILL.md`.
- [ ] Verify the prose-duplication and implicit-UI contracts pass before moving
      on — these will fail first.

### 4. Distribution checks

- [ ] Add required-string assertions to `tooling/distributions.check.ts` for the
      new onboarding question, the always-offer wording, and the presence of
      `references/surface-design.md` in the five product distributions.
- [ ] Confirm every distribution stays under 256 KB; `web-cms` has the least
      headroom.

### 5. Evaluations

- [ ] Add a fixture with no design system and no release-note destination
      (React + Tailwind only) and a fixture with Radix already present.
- [ ] Add a mobile fixture exercising the native in-app sheet with store notes
      already established.
- [ ] Add behavior cases: recommendation accepted, recommendation declined for
      minimal markup, Radix detected so no migration is proposed, established
      design system detected so the question is never asked, and comprehensive
      seed declined.
- [ ] Update the pinned case count, behavior-id set, and fixture-id set in
      `manifest-coverage.check.ts`.
- [ ] Add a `design` coverage tag.

### 6. Release

- [ ] Run `bun run check`.
- [ ] Record customer and developer changelog entries for the new capability.

## Open Risks

- **Always-offer changes the shape of onboarding for every product repository.**
  A user who asked only for a changelog edit now sees a surface offer. The
  mitigation is that it is one clearly declinable choice with a recommended
  default, and that nothing is written or built until the receipt is confirmed.
- **Recommending third-party libraries ages the guidance.** Mitigated by naming
  libraries without encoding their APIs, and by making detection of what the
  repository already uses the primary path.
- **Two backfill concepts now exist** — canonical history reconstruction and
  surface seeding. The guidance must keep them distinct so a surface seed never
  becomes implicit authority to rewrite released history.
