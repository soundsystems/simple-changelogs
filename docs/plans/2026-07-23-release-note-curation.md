# Release-Note Curation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Preserve unrelated work already
> present in the worktree. Use a `gpt-5.6-sol` subagent with medium reasoning
> effort for the final customer and developer release-note wording, as required
> by this repository. Release-note *review* passes may instead use Claude Fable
> on low effort, or Claude Opus 4.8 on high effort when Fable is unavailable or
> rate-limited.

**Goal:** Add a complete, opt-in release-note curation capability that agents
activate when users ask to rearrange, organize, reorganize, or curate release
notes. The capability audits an established release-note surface, proposes and
applies clearer grouping and ordering, preserves the canonical chronological
history in `CHANGELOG.md` or `DEVELOPER_CHANGELOG.md`, records the exact curated
range, and handles later continuation or overlapping repeat requests safely.

**Architecture:** Keep chronological Markdown changelogs as immutable sources
during curation. Add `references/release-note-curation.md` as the canonical
workflow owner and a validated, repository-local
`.simple-changelogs-curation.json` manifest as both the active presentation map
and per-surface operation ledger. Resolve presentation groups to stable
fingerprints of canonical source entries, leave out-of-scope or newly added
items in source order, and verify source immutability plus before/after item
conservation. Existing product surfaces consume the presentation map through
their own established architecture; the curation request does not authorize a
new surface.

**Tech Stack:** Markdown skill guidance, Bun 1.3.13, TypeScript 7, `bun:test`,
JSON Schema draft 2020-12, SHA-256 fingerprints, Biome 2.5 through Ultracite,
and the existing adapter-driven evaluation harness.

---

## Product Decisions

| Question | Decision |
| --- | --- |
| Canonical name | **Release-note curation** |
| User trigger language | Rearrangement, organization, reorganization, or curation of release notes, plus direct equivalents such as regrouping or reordering |
| Meaning of “finalize” | Keep its existing release-lifecycle meaning; do not overload it for curation |
| Source of truth | `CHANGELOG.md` for customer/public history and `DEVELOPER_CHANGELOG.md` for authorized internal history |
| What curation may change | Ordering, grouping, group labels, and presentation metadata on an established surface |
| What curation may not change by itself | Canonical chronology, item wording, item inclusion, release boundaries, visibility, audience, or shipped state |
| Requested version/content changes | Support as a linked canonical-history revision followed by curation; never smuggle them into presentation-only authority |
| First-run UX | Inspect, propose a preview, then apply after the user approves the preview unless the request already approves a supplied exact arrangement |
| Repeat-run UX | Report the previous surface-specific range and offer to continue from the next uncurated material, revisit an overlapping range, or cancel |
| Redundant questions | Do not ask again when the current request already explicitly identifies continuation or the exact range to revisit |
| Previously deployed material | Warn with the exact affected range and require acknowledgment before changing presentation that users may already have seen |
| Public transparency | Ask once per surface whether to show no notice, a curation notice, or—after material source corrections—a correction notice |
| Missing destination | Ask whether to create one under existing new-surface authority, then run a compact surface-design onboarding flow |
| Durable record | `.simple-changelogs-curation.json`, keyed by stable surface IDs and repository-relative paths |
| Public disclosure | Keep operational metadata in the manifest; render only an explicitly approved curation or correction notice |
| Scope identifiers | Release headings, dates, section identities, and source-entry fingerprints; never line numbers |
| Missing surface | Curation authority does not create one; follow the existing new-surface authorization flow |
| Guidance backfill | Do not bump guidance solely for this opt-in feature and do not generate an unsolicited historical-audit prompt |

---

## Terms

- **Canonical source:** The chronological raw Markdown history from which a
  release-note destination derives eligible content.
- **Surface:** An established, reachable release-note destination or its
  established data source, such as a public archive, compact “What’s New”
  summary, store-note file, announcement feed, or authorized internal history.
- **Curation:** Presentation-only grouping and ordering of an unchanged set of
  eligible source items.
- **Entry unit:** One top-level Markdown item and all of its nested children.
  The unit moves atomically unless separate semantic-edit authority is granted.
- **Scope:** The full source, a release range, one release, one named section, or
  an explicit item set.
- **Presentation map:** The active group and item-reference order for a surface.
- **Operation ledger:** Append-preserving records of previews that were applied,
  their status, their effective ranges, their source fingerprints, and their
  before/after counts.
- **Continuation:** Curation of material not covered by a completed operation,
  including releases added after the last completed range.
- **Revisit:** A new curation operation that overlaps a previously completed
  range and supersedes that range’s active presentation map.
- **Conservation:** The before and after item multisets are equal for the
  selected surface mode; no item was silently added, omitted, or duplicated.
- **Compound revision:** One explicitly requested canonical-history revision
  followed by a separate curation pass against the revised source.
- **Previously deployed range:** Release-note material proven by repository or
  deployment evidence to have been publicly reachable before the proposed
  operation.
- **Curation notice:** Optional public transparency copy explaining that
  unchanged release history was reorganized for readability.
- **Correction notice:** Optional or required-by-project public copy explaining
  a material correction to versions, dates, release boundaries, or note
  meaning.
- **Surface onboarding:** A bounded first-use decision flow for an authorized
  missing destination’s audience, type, information hierarchy, and display
  preferences.

---

## Non-Negotiable Invariants

1. A presentation-only curation phase must not edit `CHANGELOG.md` or
   `DEVELOPER_CHANGELOG.md`. Capture byte hashes at the start of that phase and
   require identical hashes afterward. When the user also authorizes canonical
   version or content changes, complete and verify that separate revision phase
   first, then capture a new immutable baseline for curation.
2. A public surface must use customer history. An authorized internal surface
   may use developer history. Never mix the two audiences because the parser
   can technically access both files.
3. Curation preserves every item already eligible for the destination:
   - full-history surfaces preserve all qualifying source entries in scope;
   - selected summaries preserve the exact pre-curation selected item multiset.
4. Curation may create concise, non-sensitive group labels, but it may not
   rewrite entry text, merge entry meanings, split an atomic entry, change
   release metadata, or alter visibility without separate explicit authority.
5. Every rendered item retains its release/version/date context even when the
   public presentation groups items across releases.
6. Items outside the curated scope continue to render in canonical source
   order. New or changed items never disappear merely because they are absent
   from an older presentation map.
7. One surface’s curation history never grants authority for another surface.
8. A curation request can modify the data or view logic of an existing surface
   as needed to consume a presentation map, but it cannot add a route, modal,
   page, navigation entry, dismissal store, or new audience.
9. A malformed or unsupported curation manifest must be reported and preserved;
   never silently replace it.
10. Preview-only work is read-only. Create the manifest only when applying an
    approved curation.
11. Record only runtime identity, timestamps, Git revisions, and hashes that can
    be established from trustworthy runtime or repository evidence. Omit
    unavailable metadata rather than inventing it.
12. Curation is explicit and as-needed. It must not create a setup prompt,
    guidance backfill prompt, scheduled recuration, or automatic historical
    rewrite.
13. Operation history, runtime identity, timestamps, and failure diagnostics
    must not be rendered or bundled into a public client. Runtime surfaces
    consume only a safe projection of the active presentation map.
14. Previously deployed material must not be rearranged or rewritten until the
    user has acknowledged the exact visible range and kind of change, unless
    the current request already clearly acknowledges both.
15. Ask the public-notice preference once per surface and persist the decision.
    Do not repeatedly solicit a disclaimer, banner, or notice.
16. A missing surface remains a new product destination. Curation triggering
    may start a bounded onboarding conversation, but it does not bypass
    `newReleaseNoteSurfaces` authority.

---

## Trigger Contract

Update the skill frontmatter so discover-mode activation covers users asking to:

- rearrange or reorder release notes;
- organize or reorganize release notes;
- curate release notes;
- regroup a release-note archive or a named release-note section;
- make an established public changelog/release-note page flow more logically;
- continue a prior release-note organization pass;
- redo or revisit an already curated release-note range;
- reorganize release notes while also changing explicitly named version labels
  or note content;
- create and style a destination when curation is requested but no release-note
  surface exists.

Route those requests to the curation workflow only when the object is release
notes or an established release-note surface. Preserve these distinctions:

- “Finalize this release” remains release finalization.
- “Reorganize `CHANGELOG.md` itself” is a canonical-history rewrite and follows
  released-history authority, not presentation curation.
- When the canonical Markdown file is itself the only established public
  destination (for example, a repository whose rendered `CHANGELOG.md` is the
  release-note page), “organize the release notes” follows the Canonical File
  as the Only Surface branch below — it is neither presentation-only curation
  nor a missing surface.
- “Organize these commits/issues/files” does not trigger changelog curation.
- “Build a release-note page and organize it” includes new-surface product
  implementation and requires the existing surface authorization.
- “Curate the latest store notes” is selected-summary curation and must preserve
  the platform-eligible set and platform limits.

Use `release-note curation` in normative guidance. User-facing handoffs may
mirror the user’s own word: rearranged, organized, reorganized, or curated.

---

## Authority Matrix

| Requested action | Authority supplied by a curation request? | Required behavior |
| --- | --- | --- |
| Inspect source and established surfaces | Yes | Read-only inspection |
| Propose groups and order | Yes | Produce preview |
| Apply approved groups/order to named existing surface | Yes | Apply and record operation |
| Add group labels | Yes | Keep labels plain, accurate, and non-sensitive |
| Modify existing view/data wiring to consume the map | Yes | Keep change scoped to existing surface |
| Continue beyond a previous completed range | Yes, when explicitly requested | Do not ask twice |
| Revisit an exact previously curated range | Yes, when explicitly requested | Supersede overlapping active scopes |
| Reword, delete, synthesize, merge, or split entries | No | Present candidates separately and request released-history/semantic authority |
| Revise explicitly requested compact-summary or announcement copy without changing shipped facts | Yes, for the exact reviewed copy | Use separate `RELEASE_NOTE_COPY_REVISION` authority and keep claims grounded in canonical history |
| Change canonical version numbers, dates, or release boundaries | No | Verify release evidence and request `RELEASED_HISTORY_REWRITE` authority |
| Apply version/content changes explicitly requested in the current prompt | Yes, for the exact reviewed changes | Run the canonical revision phase before curation; do not write guidance backfill state |
| Rearrange previously deployed material | Only after visible-impact acknowledgment | Name the deployed range and obtain or reuse explicit acknowledgment |
| Add a public curation/correction notice | Only after the one-time surface decision | Use approved restrained copy and record the preference |
| Move public notes into internal-only history or the reverse | No | Request visibility authority |
| Create a missing surface | No | Follow `newReleaseNoteSurfaces` rules |
| Onboard an authorized missing surface | Yes, after surface creation is authorized | Ask only unresolved display and behavior choices |
| Edit the canonical chronological changelog | No | Follow backfill/released-history rules |
| Publish, deploy, tag, or submit store copy remotely | No | Require separate release authority |

Use new evaluation authorization codes `RELEASE_NOTE_CURATION` for presentation
changes and `RELEASE_NOTE_COPY_REVISION` for explicit derived-summary copy
changes. Continue to use `RELEASED_HISTORY_REWRITE` for semantic or
canonical-history changes and `NEW_RELEASE_NOTE_SURFACE` for missing product
destinations.

---

## Compound Version and Content Revisions

Users may intentionally ask to change version numbering, dates, release
boundaries, group headings, or note content while reorganizing the surface.
Support this without treating presentation curation as rewrite authority.

### Classify the requested change

Distinguish:

1. **Display formatting:** Showing `Version 2.4` instead of `v2.4.0`, hiding a
   redundant `v`, using friendly labels, or choosing whether to display dates.
   This changes presentation only when canonical identity remains visible or
   recoverable.
2. **Meaning-preserving editorial revision:** Mechanical spelling, branding, or
   clarity improvements that do not alter shipped meaning. Released Markdown
   still requires explicit reviewed authority when it is the canonical full
   history.
3. **Surface-specific copy revision:** Rewriting a compact summary, store note,
   email, or announcement while keeping its claims grounded in unchanged
   canonical history. Use `RELEASE_NOTE_COPY_REVISION`; do not imply the
   canonical full-history wording also changed.
4. **Canonical metadata correction:** Changing the actual version, date, or
   release boundary. Require trustworthy tag, package, store, hosted-release,
   or deployment evidence.
5. **Semantic canonical-note revision:** Rewording, combining, splitting,
   adding, or deleting content in a way that changes what readers understand to
   have shipped.
6. **Visibility revision:** Adding or removing an item from a public or internal
   audience. Treat separately even when the text is unchanged.

### Execute compound requests in two phases

When the current request explicitly asks for exact source changes:

1. Inventory every canonical source and established mirror affected.
2. Present an old → new preview for versions, dates, boundaries, and note text.
3. Obtain `RELEASED_HISTORY_REWRITE` authority for that exact batch. Do not ask
   twice when the user’s current request already explicitly approves the exact
   changes and acknowledges their deployed impact.
4. Apply and verify the canonical revision under existing released-history
   rewrite rules, including raw-Markdown signatures and mirror reconciliation.
5. Do **not** change `.simple-changelogs.json#/guidance/backfillStatus` unless
   the request is actually a guidance audit or historical reconstruction.
6. Capture the revised canonical sources as the immutable curation baseline.
7. Apply the separately approved grouping and ordering.
8. Link the curation operation to the rewrite authorization and before/after
   source revisions without representing the rewrite as curation.

For a full-history mirror, canonical wording is authoritative: do not maintain
different historical prose only in the public surface. Selected summaries may
continue to use audience-specific synthesis under their existing detail budget,
and an explicit current request may authorize an old → new copy revision without
editing canonical Markdown. Their revised copy must not claim a different
canonical version, date, boundary, or shipped meaning. Link that distinct
surface-copy revision to the curation operation and verify both the requested
copy and the unchanged canonical facts.

If reliable evidence cannot establish the requested canonical number or
boundary, stop that candidate, preserve the current value, and state what
source-of-truth evidence is missing.

### Public correction posture

When a deployed compound revision materially changes version numbering, dates,
release boundaries, visibility, or shipped meaning:

- make the deployed-impact acknowledgment describe both the source correction
  and presentation rearrangement;
- recommend a correction notice rather than defaulting to no notice;
- show the exact proposed notice in the preview;
- follow any stricter legal, compliance, marketplace, or repository correction
  policy;
- preserve a durable internal audit record even when the user declines a public
  notice and project policy permits that choice.

Mechanical typography, a redundant `v`, or a display-only date preference does
not automatically require a correction notice.

---

## Previously Deployed Surface Acknowledgment

Before application, inspect repository and deployment evidence to classify the
target range as:

- `deployed`: proven reachable by users;
- `unpublished`: proven local, preview-only, disabled, or not yet released;
- `unknown`: insufficient evidence.

Do not claim deployment from a route file alone. Use documented production
routes, release automation, deployed artifacts, hosted-release metadata, store
metadata, default-branch containment, or other local proof. When state is
unknown and the operation would rewrite old public-looking material, explain
the uncertainty and ask one bounded question.

Require acknowledgment when:

- the range is deployed and existing grouping/order will change;
- deployed version, date, boundary, note meaning, or visibility will change;
- established deep links or reader expectations could be affected.

The preview should say:

> This will change the already-deployed release-note presentation from
> `<first>` through `<last>`. `<summary of what changes>`. `<summary of what
> remains unchanged>`. Are you comfortable applying this?

Skip a new acknowledgment when the current request already clearly identifies
the deployed surface, exact range, and intended change. Do not require it for:

- unpublished or preview-only material;
- a new release appended without moving previously visible items;
- verification-only or preview-only work;
- a repeat run that produces no diff.

Record the evidence classification, affected visible range, acknowledged change
kinds, authorization source, and optional trustworthy acknowledgment time in
the operation. An acknowledgment is operation-specific; it does not become
blanket permission to rewrite future deployed ranges.

### One-time transparency decision

On the first operation that will modify previously deployed material for a
surface, ask once:

> Would you like a brief public transparency note on this surface? The choices
> are no notice, a curation notice explaining that unchanged history was
> reorganized, or—when versions/content changed—a correction notice describing
> that revision.

Recommend:

- `none` for grouping/order changes that preserve versions, dates, wording, and
  visibility;
- `curation-notice` when the project values explicit editorial transparency;
- `correction-notice` for material deployed version/content corrections.

Use `transparencyPreference` at the surface level:

- `undecided`: ask when the first deployed overwrite becomes relevant;
- `none`: show nothing and do not ask again;
- `curation-notice`: show the approved static curation notice and do not ask
  again;
- `correction-notice`: show the approved correction pattern and do not ask
  again.

An unanswered optional transparency question remains `undecided` and renders no
notice; silence is not a stored `none` decision. This does not replace the
required deployed-impact acknowledgment, which remains blocking when applicable.

If the user chooses a notice, preview its exact copy and location. Prefer small
static archive text over a temporary banner, dismissal store, or automatic
expiration:

> These release notes were reorganized for easier browsing. Release dates,
> versions, and note content remain unchanged.

For corrections, generate factual project-specific copy naming the corrected
range and what changed without implying unaffected history was unreliable.
Allow the user to explicitly revise the stored preference later.

---

## Missing-Surface Onboarding

When curation is requested but no established release-note surface or “What’s
New” destination exists:

1. Explain that there is currently nothing to rearrange publicly.
2. Check `newReleaseNoteSurfaces` authority.
3. If authority remains `ask`, ask whether the user wants to create a destination
   for this task and distinguish that one-off permission from an ongoing policy.
4. If creation is authorized, inspect the application’s design system, routes,
   audience, platforms, authentication, content volume, and existing navigation
   before asking styling questions.
5. Ask one compact onboarding batch containing only choices that cannot be
   derived safely from the project.
6. Preview the resulting surface design, curation strategy, exact paths, and
   behavior before implementation.

If `.simple-changelogs.json` is also absent, complete the existing repository
setup checkpoint before writing. Describe any initial historical-audit choice as
independent from surface onboarding and curation. A declined or deferred
historical audit does not become curation approval and does not prevent
prospective creation after the setup disposition is recorded. Curation must not
write or infer that backfill disposition.

Do not create both an archive and a modal merely because neither exists. Ask
which destination serves the user’s intent:

- **Public archive:** Full searchable/browsable history; recommended for
  whole-history curation.
- **Compact “What’s New”:** Latest-release highlights for returning users.
- **Both:** One compact summary linked to a full archive, only when the user
  explicitly wants both.
- **Internal history:** Authorized technical notes for verified operator or
  maintainer roles.

### Compact onboarding questions

Ask at most one concise core batch, adapting or omitting questions already
answered by repository evidence:

1. **Destination:** Archive, compact “What’s New,” both, or authorized internal
   history?
2. **Organization and layout:** Product areas/workflows in grouped sections
   (recommended), change types, a chronological timeline, compact cards, a
   traditional changelog list, or a named custom approach?
3. **Dates and versions:** Exact versions plus dates (recommended), friendly
   versions backed by canonical values, month/year, versions only, or dates
   only? A cross-release archive must show at least a version or date and retain
   canonical chronology somewhere.
4. **Detail density:** Concise headlines, balanced nested detail (recommended),
   or full qualifying detail?
5. **Chronological access:** Curated default with a chronological toggle
   (recommended for cross-release archives), chronology first with curated
   filters, or curated-only when every item still shows release context?
6. **Transparency:** No notice (recommended for presentation-only work),
   curation notice, or correction notice when source history will change?

Only for a genuinely long archive, add one conditional navigation question:
search, product-area filters, release/version filters, simple anchor navigation,
or no additional controls.

Only when the repository genuinely lacks an established visual language, add
one conditional direction question: neutral editorial/minimal (recommended),
product-card focused, timeline focused, or a supplied custom brand direction.
State which missing local context made the question necessary.

Ask modal behavior separately only when the user chooses a compact “What’s New”
surface:

- manual access only or automatic display to eligible returning users;
- dismissal per release and platform;
- placement in the existing gate sequence;
- link to the full archive when one exists or is also authorized.

### Infer rather than ask

Do not turn accessibility and established product conventions into optional
preferences. Infer and enforce:

- existing typography, spacing, color, iconography, and component system;
- responsive behavior and platform conventions;
- keyboard navigation, focus order, semantic headings, contrast, and reduced
  motion;
- natural route and navigation placement when local architecture proves one;
- existing localization and date-formatting conventions;
- public versus authenticated audience from documented access policy.

When evidence leaves multiple materially different placements or audiences,
ask one bounded question. Do not invent brand styling or access roles.

Store the approved per-surface choices in `displayPreferences` and
`transparencyPreference` within the curation manifest. These are surface
configuration, not global repository policy. A later user can explicitly change
them without reopening unrelated onboarding choices.

---

## Canonical File as the Only Surface

Many repositories have no separate presentation surface: the rendered
`CHANGELOG.md` (or an authorized `DEVELOPER_CHANGELOG.md`) is the de facto
destination readers actually visit. This is the most common shape a curation
request will meet, and it falls between the other two branches — the file is an
established, reachable destination (so Missing-Surface Onboarding does not
apply), yet it is canonical history that curation authority must never reorder.

When scope resolution determines that the requested target is the canonical
file itself:

1. Explain the constraint plainly: the chronological file is the source of
   truth, so reorganizing it is a canonical-history rewrite, not
   presentation-only curation.
2. Offer exactly two paths in one bounded question:
   - **Canonical reorganization:** restructure the changelog file under
     `RELEASED_HISTORY_REWRITE` authority with the standard old → new preview,
     deployed-impact acknowledgment, raw-Markdown signature rules, and mirror
     reconciliation. Release boundaries and chronology must survive;
     within-release section regrouping is the typical safe shape.
   - **Separate presentation surface:** keep the file chronological and create
     a new destination through Missing-Surface Onboarding (subject to
     `newReleaseNoteSurfaces` authority), then curate that surface under
     `RELEASE_NOTE_CURATION`.
3. Skip the question when the current request already names one path
   explicitly.
4. Record a canonical reorganization as a released-history rewrite, not as a
   curation operation. Record the separate-surface path as normal onboarding
   plus curation, and leave the canonical file byte-identical during the
   curation phase as usual.

---

## Scope and Source-Entry Model

### Supported scopes

Support all of these without artificial staging:

1. **Full history:** Every qualifying release in the canonical source.
2. **Release range:** Two inclusive release boundaries in canonical document
   order, regardless of whether versions follow SemVer, PEP 440, dates, names,
   or another repository convention.
3. **Single release:** One released or pending release section.
4. **Named section:** A heading within one release or a recurring established
   section such as “Bug Fixes.”
5. **Explicit item set:** A user-named set of entries or feature areas whose
   source identities can be proven.

Do not use line numbers as durable scope. Record the displayed heading, optional
date/version, source path, and occurrence ordinal (1-based, counting matching
headings in document order) when duplicate headings make an ordinal necessary.

### Atomic entry extraction

Implement a deterministic Markdown scanner that:

- recognizes release and nested section headings outside fenced code and HTML
  comments;
- treats a top-level bullet plus its indented descendants as one atomic entry;
- ignores raw `simple-changelogs-signature` comments when fingerprinting and
  presenting content;
- normalizes line endings and trailing whitespace for identity while retaining
  original display text;
- retains links, inline code, emphasis, and nested bullets;
- records release and section context alongside each item;
- marks ambiguous Markdown structures instead of guessing boundaries.

Prefer an existing repository-provided stable entry ID when one is documented.
Otherwise derive:

```text
sourceItemId = sha256(
  sourcePath
  + releaseIdentity
  + sectionIdentity
  + normalizedAtomicEntryText
)
```

A wording or structural change intentionally changes the derived ID and makes
the affected presentation map stale. That is safer than silently attaching an
old curated position to new meaning.

### Pending releases

Allow curation of `Unreleased` or another documented pending section only when
the surface is an established release-preparation destination. Mark its active
scope as `provisional`. During release finalization:

- resolve the pending heading to the actual released identity;
- recompute fingerprints;
- verify conservation again;
- update the scope to `released`;
- do not expose pending content publicly before normal release authority exists.

---

## Curation Strategies

The agent selects a strategy from source content, audience, and established
surface conventions. The preview must state the chosen strategy.

### Default ordering priorities

When the repository has no stronger taxonomy, prefer:

1. Major new capabilities and product launches.
2. End-to-end workflows and the places users perform them.
3. Trust, privacy, safety, access, billing, or data-control outcomes.
4. Meaningful improvements to established feature areas.
5. Reliability, recovery, compatibility, and data-quality outcomes.
6. Bug fixes.
7. Durable but minor UI, interaction, or copy polish appropriate to that
   surface.

Within a thematic group, retain release context and use the surface’s existing
chronological direction unless a different order materially improves a
documented product journey.

### Grouping rules

- Group by user-recognizable capability, workflow, or product area.
- Keep unrelated small changes flat when a group would add ceremony.
- Keep entry wording verbatim by default.
- Move an atomic entry as a whole.
- Avoid groups derived from internal services, architecture, ranking logic,
  incident causes, hidden trust rules, or other sensitive mechanics.
- Avoid empty groups and one-item groups unless the item is a major launch or
  the surface’s established design uses stable categories.
- Use calm group labels, not promotional slogans.
- Place several ordinary fixes under a plain `Bug Fixes` group after more
  material outcomes when that matches the existing changelog guidance.
- Do not duplicate a cross-cutting item in multiple groups. Choose the strongest
  reader-facing home and retain searchable release metadata.

### Cross-release presentation

Cross-release thematic curation is allowed, but:

- each item must retain a visible release/version/date marker;
- chronological filtering or the existing chronological fallback remains
  available when the surface supports it;
- deep links must continue to resolve to the correct release or item;
- a theme cannot imply that all grouped work shipped together;
- release boundaries in canonical Markdown remain untouched.

---

## Surface Modes

### Full-history mode

- The qualifying item multiset in scope must exactly match canonical customer or
  developer history.
- The active presentation map controls groups and order only.
- Unmapped new items fall back to source order and produce a stale-map warning
  during verification; they remain visible.
- The surface should retain a chronological view or visible release metadata
  when thematic grouping crosses releases.

### Selected-summary mode

Use for compact modals, store notes, emails, and announcements:

- Snapshot the destination’s exact eligible item set before curation.
- Preserve that set exactly; do not use curation to add minor changelog items or
  drop highlights.
- Continue to enforce the destination’s platform, audience, length, and detail
  budgets.
- Record conservation relative to the pre-curation surface selection, not every
  item in `CHANGELOG.md`.

### Authorized internal-history mode

- Require existing evidence that the intended roles may read developer history.
- Source only from `DEVELOPER_CHANGELOG.md` or another documented internal
  source.
- Apply the same conservation, chronology, and ledger rules.
- Never treat authentication alone as sufficient audience authorization.

### Directly parsed surfaces

If an existing surface reads `CHANGELOG.md` at runtime and has no ordering
layer, add the smallest presentation-map integration needed for that surface.
The renderer should:

1. parse eligible source items;
2. apply matching active groups from the curation manifest;
3. render mapped items once;
4. render unmatched eligible items in canonical source order;
5. ignore raw Markdown comments;
6. retain release metadata and deep-link identity.

Do not import the full operation ledger into a browser or mobile client. Project
integration must select or generate a safe active-map projection containing
only the surface ID, approved display preferences, active scopes, group labels,
ordered item IDs, fallback rule, and approved public notice text/location.
Exclude decision sources, timestamps, deployment evidence, acknowledgments,
linked rewrites, and operation history.

### Generated or copied surfaces

Prefer updating a generator or established data source over hand-editing a
generated artifact. Make regeneration consume the active presentation map so a
later release sync cannot erase the curated order. If no generator exists,
update the established data file and verify it against the manifest.

---

## Curation Manifest Contract

Create `.simple-changelogs-curation.json` only when applying curation. Keep
`.simple-changelogs.json` unchanged: it records repository policy, while the new
file records optional surface operations and active presentation state.

The manifest lives at the workspace root, beside `.simple-changelogs.json`,
even when a monorepo keeps per-package changelogs. Package-level sources and
surfaces are addressed through repository-relative `sourcePaths` and
`surfacePaths`; never create nested per-package curation manifests.

The initial contract should model:

```ts
export const CURATION_MANIFEST_VERSION = 1;

export type CurationOperationStatus =
  | "partial"
  | "failed"
  | "completed"
  | "superseded";

export type CurationSurfaceMode =
  | "full-history"
  | "selected-summary"
  | "internal-history";

export interface SourceBoundary {
  sourcePath: string;
  heading: string;
  /** 1-based index among identical headings in document order. */
  occurrence: number;
  version?: string;
  date?: string;
}

export type CurationScope =
  | { kind: "full-history" }
  | {
      kind: "release-range";
      first: SourceBoundary;
      last: SourceBoundary;
    }
  | { kind: "release"; release: SourceBoundary }
  | {
      kind: "section";
      release: SourceBoundary;
      section: SourceBoundary;
    }
  | { kind: "item-set"; itemIds: string[] };

export interface CurationGroup {
  groupId: string;
  label: string;
  itemIds: string[];
}

export interface ActiveCurationScope {
  scopeId: string;
  scope: CurationScope;
  maturity: "provisional" | "released";
  sourceFingerprint: string;
  activatedByOperationId: string;
  groups: CurationGroup[];
}

export interface CurationCounts {
  eligibleBefore: number;
  eligibleAfter: number;
  mapped: number;
  moved: number;
  groupsBefore: number;
  groupsAfter: number;
}

export interface CurationStrategy {
  grouping: "product-area" | "workflow" | "release-section" | "custom";
  ordering: "product-importance" | "product-journey" | "source-order" | "custom";
  withinGroup:
    | "product-importance"
    | "product-journey"
    | "source-order"
    | "custom";
  customDescription?: string;
}

export interface SurfaceDisplayPreferences {
  defaultOrganization:
    | "product-area"
    | "change-type"
    | "release-chronology"
    | "custom";
  layout: "grouped-sections" | "timeline" | "cards" | "changelog-list";
  visualDirection:
    | "project-native"
    | "editorial-minimal"
    | "product-cards"
    | "timeline-minimal"
    | "custom";
  dateDisplay: "exact" | "month-year" | "hidden";
  versionDisplay: "exact" | "friendly" | "hidden";
  detailDensity: "concise" | "balanced" | "full";
  chronologicalAccess:
    | "curated-with-toggle"
    | "chronology-with-filters"
    | "curated-with-context";
  navigation: Array<
    "anchors" | "search" | "product-area-filter" | "release-filter"
  >;
}

export interface SurfaceTransparencyPreference {
  preference:
    | "undecided"
    | "none"
    | "curation-notice"
    | "correction-notice";
  noticeText?: string;
  noticeLocation?: string;
  decisionSource?: AuthorizationSource;
  decidedAt?: string;
}

export interface DeployedSurfaceImpact {
  state: "deployed" | "unpublished" | "unknown";
  evidence: string[];
  previouslyVisibleScope?: CurationScope;
  changeKinds: Array<
    | "ordering"
    | "grouping"
    | "display-version-format"
    | "canonical-version"
    | "date"
    | "release-boundary"
    | "content"
    | "visibility"
    | "deep-link"
  >;
  acknowledged: boolean;
  acknowledgmentSource?: AuthorizationSource;
  acknowledgedAt?: string;
}

export interface LinkedSourceRewrite {
  authorizationCode: "RELEASED_HISTORY_REWRITE";
  sourceFingerprintBefore: string;
  sourceFingerprintAfter: string;
  changedPaths: string[];
  changeKinds: Array<
    "canonical-version" | "date" | "release-boundary" | "content" | "visibility"
  >;
}

export interface LinkedSurfaceCopyRevision {
  authorizationCode: "RELEASE_NOTE_COPY_REVISION";
  surfaceFingerprintBefore: string;
  surfaceFingerprintAfter: string;
  changedItemIds: string[];
}

export interface CurationOperation {
  operationId: string;
  status: CurationOperationStatus;
  requestedScope: CurationScope;
  effectiveScope: CurationScope;
  direction: "canonical-forward" | "canonical-reverse";
  overlap: "none" | "continuation" | "partial-overlap" | "full-overlap";
  sourceFingerprint: string;
  eligibleItemSetFingerprintBefore: string;
  eligibleItemSetFingerprintAfter?: string;
  surfaceFingerprintBefore: string;
  surfaceFingerprintAfter?: string;
  counts?: CurationCounts;
  strategy: CurationStrategy;
  deployedImpact: DeployedSurfaceImpact;
  linkedSourceRewrite?: LinkedSourceRewrite;
  linkedSurfaceCopyRevision?: LinkedSurfaceCopyRevision;
  revisitsOperationIds: string[];
  resumeAfter?: SourceBoundary;
  oldestCovered?: SourceBoundary;
  newestCovered?: SourceBoundary;
  supersededBy?: string;
  failureDiagnostic?: string;
  sourceRevision?: string;
  runtimeIdentity?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CurationSurface {
  surfaceId: string;
  surfacePaths: string[];
  sourcePaths: string[];
  audience: "public" | "internal";
  mode: CurationSurfaceMode;
  fallback: "source-order";
  displayPreferences: SurfaceDisplayPreferences;
  transparencyPreference: SurfaceTransparencyPreference;
  activeScopes: ActiveCurationScope[];
  operations: CurationOperation[];
}

export interface CurationManifest {
  schemaVersion: 1;
  surfaces: CurationSurface[];
}
```

Each surface record must include:

- a unique, stable `surfaceId`;
- one or more normalized repository-relative `surfacePaths`;
- one or more canonical `sourcePaths`;
- `audience`: `public` or `internal`;
- `mode`;
- `fallback: "source-order"`;
- active scopes containing group IDs, labels, ordered source item IDs, source
  fingerprints, maturity (`provisional` or `released`), and the operation that
  activated them;
- an ordered operation ledger.

Each operation must include:

- deterministic `operationId`;
- `status`;
- requested and effective scopes;
- source traversal direction;
- source-scope fingerprint;
- eligible-item-set fingerprints before and after successful application;
- surface fingerprint before the operation;
- surface fingerprint after successful application;
- counts for eligible items before, eligible items after, mapped items, moved
  items, groups before, and groups after;
- strategy summary;
- deployed-state evidence, previously visible scope, change kinds, and
  acknowledgment status;
- optional linked canonical-rewrite or derived-copy-revision record;
- overlap classification: `none`, `continuation`, `partial-overlap`, or
  `full-overlap`;
- IDs of operations revisited or superseded;
- the last processed source boundary for partial work;
- the newest and oldest covered boundaries for completed work;
- optional trustworthy Git revision, runtime identity, start timestamp, and
  completion timestamp;
- an optional handled-failure diagnostic for `failed`.

Generate a deterministic operation ID from a canonical JSON serialization —
lexicographically sorted object keys, no insignificant whitespace — of the
normalized surface ID, effective scope, source-scope fingerprint, and
surface-before fingerprint, hashed with SHA-256. Retrying the same unchanged
operation updates the same partial/failed record rather than creating noisy
duplicates. A genuine revisit has a different surface-before or source
fingerprint and receives a new ID.

Compute `surfaceFingerprintBefore`/`surfaceFingerprintAfter` deterministically
over the surface's normalized repository-relative `surfacePaths` sorted
lexicographically: hash `path + "\u0000" + sha256(fileBytes)` for each path,
then hash the ordered concatenation (paths may contain spaces, so the NUL
separator is required for unambiguous framing). A missing surface file
contributes
`path + "\u0000" + "absent"` so add/remove is distinguishable from empty.

Enforce the contract at two layers. JSON Schema draft 2020-12 is a shape
language: it can express presence, conditional requirements, enums, closed
objects, and string patterns, but it cannot compare two field values for
equality and cannot enforce key uniqueness across an array of objects. Do not
ask the schema to do what only the runtime validator can.

**JSON Schema enforces, via discriminated `if`/`then` branches:**

- completed operations require after fingerprints and a `counts` object;
- partial operations require a resume boundary;
- failed operations require a diagnostic;
- superseded operations require `supersededBy`;
- `curation-notice` and `correction-notice` preferences require exact approved
  notice text and location, while `none` and `undecided` forbid them;
- deployed operations that change a previously visible range require
  `acknowledged: true`;
- linked rewrite and copy-revision records carry their fixed authorization
  codes;
- full-history surfaces cannot set both `dateDisplay` and `versionDisplay` to
  `hidden` (a single-release selected summary may);
- paths are nonempty strings matching a pattern that rejects absolute paths,
  `..` segments, and backslashes.

**Runtime validator additionally enforces (not expressible in JSON Schema):**

- equal before/after eligible counts and equal before/after eligible-item-set
  fingerprints on completed operations;
- surface IDs and operation IDs unique across their arrays;
- group IDs unique within a scope;
- item IDs unique within a scope and never present in two active groups for
  the same surface scope;
- active scopes referencing only operations that exist and are `completed`;
- `supersededBy`, `activatedByOperationId`, and `revisitsOperationIds`
  referencing real operations;
- canonical version/date/boundary/content/visibility change kinds appearing
  only alongside a linked `RELEASED_HISTORY_REWRITE` record, and
  selected-summary copy changes only alongside a linked
  `RELEASE_NOTE_COPY_REVISION` record;
- symlink and resolved-path escape rejection for files the bundled CLI reads.

The schema-parity test compares only the schema-enforceable layer: schema
version, every enum, closed objects, and conditional presence rules. The
runtime-only invariants are covered by validator unit tests, never by parity
assertions.

Commit the manifest with surface changes unless repository instructions
explicitly classify release-note operation metadata as local-only.

---

## End-to-End Workflow

### 0. Classify the requested operation

Before treating the request as presentation-only, separate:

- grouping and order;
- display-only date/version preferences;
- derived compact-copy revisions;
- canonical version/date/boundary/content revisions;
- visibility changes;
- missing-surface product implementation;
- remote deployment or publication.

Assign the corresponding authority to each phase. One user request may
authorize several exact phases, but one authority code must not stand in for
another.

### 1. Inspect

1. Validate `.simple-changelogs.json` when present without creating setup state
   for a read-only preview.
2. Validate `.simple-changelogs-curation.json` when present.
3. Identify canonical customer or developer sources.
4. Discover established, reachable release-note surfaces and their data flow.
5. If no destination exists, follow Missing-Surface Onboarding only after
   product implementation is authorized.
6. Resolve the named surface. If several materially different surfaces match and
   the request does not disambiguate, ask one bounded target question.
7. Resolve the requested scope. When the user says only “curate the release
   notes” and exactly one full-history surface exists, propose the full surface.
8. Establish whether the target range was previously deployed and capture the
   supporting evidence or honest unknown state.
9. Capture source and surface byte hashes.
10. Extract source entries and snapshot the surface’s eligible item set.
11. Compare the requested scope with completed, partial, and failed operations.

### 2. Audit presentation

Assess:

- fragmented entries that belong to one feature area;
- feature groups ordered by commit chronology rather than reader importance;
- fixes interrupting larger workflows;
- headings that no longer reflect the visible product taxonomy;
- cross-release developments that form a coherent user journey;
- duplicated or missing surface items;
- stale presentation-map references;
- group labels that expose internal or sensitive mechanics;
- deep links or release labels that would be lost by regrouping.

Report content inaccuracies, questionable inclusion, or semantic rewrite
candidates separately. Do not silently fix them as presentation issues.

### 3. Preview

Before the first write, present:

- exact surface and canonical source paths;
- audience and surface mode;
- requested display preferences or existing approved preferences;
- requested and effective scope;
- previous operation ranges and overlap classification;
- deployed/unpublished/unknown evidence and the previously visible range;
- old → new version, date, content, or visibility changes for any compound
  revision;
- eligible item count;
- proposed group labels and order;
- a concise move summary showing where entries will go;
- unchanged items and fallback behavior;
- semantic candidates intentionally excluded;
- exact repository files that application would change;
- the one-time public transparency choice when still undecided and relevant;
- exact notice wording and placement when chosen;
- verification that will run.

Ask for approval to apply that preview unless:

- the user supplied and approved an exact arrangement in the current request; or
- the user explicitly instructed the agent to apply without another preview
  checkpoint.

Preview approval authorizes only the displayed surface, scope, groups, and
ordering.

If previously deployed material will change, obtain the separate visible-impact
acknowledgment in the same preview response. If canonical or derived copy will
change, obtain its corresponding rewrite authority as well.

### 4. Begin resumable state

After approval:

1. Complete and verify any separately authorized canonical revision first.
2. Capture revised canonical byte hashes as the curation baseline.
3. Create or update a `partial` curation operation atomically.
4. Record source and surface-before fingerprints, deployed acknowledgment,
   transparency preference, linked revisions, and the effective scope.
5. Leave canonical Markdown untouched for the remainder of curation.
6. Do not mark an active scope until surface application and verification pass.

### 5. Apply

1. Add or update the active presentation map.
2. Wire the existing surface or established generator to consume it when
   necessary.
3. Preserve source item wording and release context.
4. Apply only the explicitly approved derived-summary copy revision, if any.
5. Apply approved display preferences and transparency copy.
6. Preserve uncurated fallback order.
7. Update only the named surface and shared code proven to serve it.
8. If the operation revisits completed material, activate the new scope and mark
   the replaced operation `superseded` only after verification succeeds.

### 6. Verify

Run deterministic manifest and conservation checks, then repository-native
tests. The requirements are split by who can actually check them; evaluation
report codes assert the deterministic layer mechanically and treat the
agent-verified layer as judged behavior.

**Deterministic — enforced by `verifyCuration` and the bundled CLI:**

- identical before/after byte hashes for canonical source files;
- valid curation manifest (schema plus runtime invariants);
- equal before/after eligible item multisets;
- no duplicate active item IDs;
- no missing active references;
- out-of-scope and new items still visible in source order;
- raw comments excluded from fingerprints and rendered identity;
- exact old → new derived copy matching the approved preview;
- deployed-impact acknowledgment recorded when required;
- display preferences retain at least one temporal marker for cross-release
  history.

**Agent-verified — checked by the executing agent against the repository:**

- linked canonical revisions verified before the immutable curation baseline;
- release/version/date context retained in the rendered surface;
- intended audience preserved;
- transparency preference honored without an unapproved banner or modal;
- deep links preserved;
- generated artifacts reproducible without losing curation;
- existing surface reachable;
- no new unauthorized surface or remote release action;
- relevant build, type, lint, and UI tests passing.

### 7. Complete and hand off

Only after verification:

1. Change the operation to `completed`.
2. Add or update the active scope.
3. Record after fingerprints, exact counts, groups, range, and covered
   boundaries.
4. Record deployed evidence, acknowledgment, display preferences, transparency
   decision, and linked revision evidence.
5. Report the surface, source, curated range, count and group changes, previous
   overlap, new continuation boundary, any separately authorized source/copy
   revisions, the curation-phase immutable source result, and checks.
6. Do not add operational prose to customer-facing notes except the exact
   approved curation or correction notice.

---

## Repeat, Continuation, and Resume Rules

### Completed prior curation

When a later request targets a surface with completed history, say:

> This surface was previously curated from `<first>` through `<last>`. Would
> you like me to continue with the next uncurated material, revisit the
> overlapping range `<range>`, or cancel?

Adapt the wording to the actual direction and gaps. Do not assume SemVer order;
compare canonical source positions.

Skip the question when the request already says, for example:

- “Continue curating from where the last pass ended.”
- “Curate everything added after 2.4.0.”
- “Redo the 1.0.0 through 2.4.0 arrangement.”
- “Revisit the Search section in 3.1.0.”

### Coverage gaps

Do not reduce history to one simplistic “last version” cursor. Compute covered
intervals per surface. If completed operations leave a gap, offer the nearest
uncurated interval before claiming that the next work begins after the newest
boundary.

### Partial or failed operation

- Resume gating uses the operation's scope-level `sourceFingerprint` and its
  `surfaceFingerprintBefore` — not the whole-file byte hashes from invariant 1,
  which exist to prove curation-phase immutability. If both operation
  fingerprints still match, offer to resume from the recorded boundary.
- A whole-file byte-hash change outside the effective scope does not by itself
  invalidate the operation: re-run inspection, and when the refreshed audit
  confirms the scope fingerprint is unchanged, offer resume against a freshly
  captured immutability baseline.
- If the scope fingerprint or surface-before fingerprint changed, do not replay
  stale moves. Re-inspect, prepare a refreshed preview, and supersede the
  incomplete operation only after the user approves.
- Preserve handled-failure diagnostics.
- A partial record never grants an active presentation scope.

### Idempotence

Running verification or reapplying the same completed operation against
unchanged source and surface state must produce no content diff and no duplicate
ledger record. Report that the range is already curated.

### New releases after curation

- Render new eligible items through source-order fallback immediately.
- Verification reports the active scope as stale but never hides the new items.
- A later curation request should recommend the newly added range first.
- Do not solicit curation merely because a new release exists.

---

## Failure and Recovery Behavior

- On a handled failure before surface mutation, retain a `failed` operation with
  the source and surface-before fingerprints.
- On a handled failure after surface mutation, restore the pre-operation surface
  when safely possible; otherwise leave `partial`, name the exact changed files,
  and provide the resume boundary.
- Never mark an operation complete merely because some groups were applied.
- Never supersede a previously active operation until the replacement verifies.
- If the manifest is malformed, do not infer prior coverage from prose or
  overwrite it. Report validation paths and ask for repair authority.
- If canonical source changes during the operation, stop, preserve resumable
  state, and refresh the audit. A change outside the effective scope keeps the
  operation resumable once the refreshed audit confirms the scope fingerprint
  is unchanged; an in-scope change requires a refreshed preview and user
  approval before superseding.
- If an item cannot be assigned confidently, keep it in source-order fallback
  and call it out in the preview or handoff.
- If a surface cannot retain release context under thematic grouping, constrain
  curation to within-release ordering or request a scoped view enhancement.

---

## File Map

### New files

- `skills/simple-changelogs/references/release-note-curation.md`
- `skills/simple-changelogs/evals/schemas/curation-manifest.schema.json`
- `skills/simple-changelogs/scripts/lib/curation-source.ts`
- `skills/simple-changelogs/scripts/lib/curation.ts`
- `skills/simple-changelogs/scripts/curation.ts`
- `skills/simple-changelogs/scripts/tests/curation-source.check.ts`
- `skills/simple-changelogs/scripts/tests/curation.check.ts`
- `skills/simple-changelogs/evals/fixtures/curated-history/.simple-changelogs.json`
- `skills/simple-changelogs/evals/fixtures/curated-history/CHANGELOG.md`
- `skills/simple-changelogs/evals/fixtures/curated-history/DEVELOPER_CHANGELOG.md`
- `skills/simple-changelogs/evals/fixtures/curated-history/README.md`
- `skills/simple-changelogs/evals/fixtures/curated-history/release-notes.json`
- `skills/simple-changelogs/evals/fixtures/curated-history/src/release-notes.ts`
- `skills/simple-changelogs/evals/fixtures/curated-history/src/routes/changelog.tsx`

### Modified files

- `skills/simple-changelogs/SKILL.md`
- `skills/simple-changelogs/references/release-note-surfaces.md`
- `skills/simple-changelogs/references/backfill.md`
- `skills/simple-changelogs/references/release-lifecycle.md`
- `skills/simple-changelogs/references/automation-verification.md`
- `skills/simple-changelogs/scripts/lib/types.ts`
- `skills/simple-changelogs/scripts/lib/validate.ts`
- `skills/simple-changelogs/scripts/lib/contracts.ts`
- `skills/simple-changelogs/scripts/tests/validate.check.ts`
- `skills/simple-changelogs/scripts/tests/schema-parity.check.ts`
- `skills/simple-changelogs/scripts/tests/contracts.check.ts`
- `skills/simple-changelogs/scripts/tests/fixtures.check.ts`
- `skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts`
- `skills/simple-changelogs/evals/schemas/runner-response.schema.json`
- `skills/simple-changelogs/evals/cases.json`
- `skills/simple-changelogs/EVAL.md`
- `README.md`
- `CHANGELOG.md`
- `DEVELOPER_CHANGELOG.md`

Do not add curation fields to `.simple-changelogs.json` or bump its schema
version. Do not add a guidance version merely to ship this explicit-only
workflow.

---

## Task 1: Encode the curation manifest contract

**Files:**

- Create: `skills/simple-changelogs/evals/schemas/curation-manifest.schema.json`
- Modify: `skills/simple-changelogs/scripts/lib/types.ts`
- Modify: `skills/simple-changelogs/scripts/lib/validate.ts`
- Modify: `skills/simple-changelogs/scripts/tests/validate.check.ts`
- Modify: `skills/simple-changelogs/scripts/tests/schema-parity.check.ts`

**Interfaces:**

- `CURATION_MANIFEST_VERSION`
- `CurationManifest` and its discriminated child types
- `validateCurationManifest(value: unknown): ValidationResult<CurationManifest>`

- [ ] **Step 1: Write failing validator tests**

Anchor the suite with shape-defining tests like this one, then enumerate the
remaining cases in the same style:

```ts
test("completed operation requires equal before/after eligible counts", () => {
  const manifest = buildValidCurationManifest();
  const operation = manifest.surfaces[0].operations[0];
  operation.status = "completed";
  operation.counts = {
    eligibleBefore: 4,
    eligibleAfter: 3,
    mapped: 3,
    moved: 2,
    groupsBefore: 1,
    groupsAfter: 2,
  };
  const result = validateCurationManifest(manifest);
  expect(result.ok).toBe(false);
  expect(!result.ok && result.errors.join("\n")).toContain("eligibleAfter");
});
```

Cover:

- minimal valid full-history and selected-summary surfaces;
- all supported scope variants;
- completed, partial, failed, and superseded operations;
- display-preference combinations and cross-release temporal-marker rules;
- all transparency preferences and notice text/location conditions;
- deployed, unpublished, and unknown impact evidence;
- deployed-overwrite acknowledgment requirements;
- linked canonical rewrites and derived-copy revisions;
- completed-count conservation;
- conditional fields required by each status;
- unique surface, operation, group, and item IDs;
- no duplicate item across active groups;
- active scopes referencing only completed operations;
- normalized relative paths and traversal rejection;
- symlink and resolved-path escape rejection for files read by the bundled CLI;
- unknown-key rejection;
- portable-input protections already used by `validateRepoPolicy`;
- input preservation on validation failure.

Run the new suite immediately and confirm it fails for the right reason:

```bash
bun test skills/simple-changelogs/scripts/tests/validate.check.ts
```

Expected: FAIL with an unresolved `validateCurationManifest` import — not a
syntax error in the test file itself.

- [ ] **Step 2: Add TypeScript constants and types**

Keep enums in `types.ts` as the single runtime/schema-parity source. Avoid
project-specific route, framework, or vendor fields.

- [ ] **Step 3: Implement the runtime validator**

Reuse the existing dependency-free validator combinators. Add only general
combinators needed for discriminated unions, uniqueness by object key, and
cross-field invariants.

- [ ] **Step 4: Add the JSON Schema**

Use closed objects and `$defs`. Encode only the schema-enforceable layer from
the manifest contract section — presence, conditional `if`/`then`
requirements, enums, and path patterns. Do not attempt cross-field equality or
cross-object uniqueness; those live in the runtime validator alone.

- [ ] **Step 5: Extend schema-parity checks**

Compare schema version and every enum with `types.ts`. Confirm every fixed object
has `additionalProperties: false`. Do not assert parity for runtime-only
invariants (equality, uniqueness, cross-references); those are covered by the
validator unit tests from Step 1.

- [ ] **Step 6: Run focused tests**

```bash
bun test \
  skills/simple-changelogs/scripts/tests/validate.check.ts \
  skills/simple-changelogs/scripts/tests/schema-parity.check.ts
```

Expected: all curation contract and existing portable policy tests pass.

- [ ] **Step 7: Commit**

```bash
git add skills/simple-changelogs/evals/schemas/curation-manifest.schema.json \
  skills/simple-changelogs/scripts/lib/types.ts \
  skills/simple-changelogs/scripts/lib/validate.ts \
  skills/simple-changelogs/scripts/tests/validate.check.ts \
  skills/simple-changelogs/scripts/tests/schema-parity.check.ts
git commit -m "feat(skill): add curation manifest contract and validator"
```

---

## Task 2: Build deterministic canonical-source extraction

**Files:**

- Create: `skills/simple-changelogs/scripts/lib/curation-source.ts`
- Create: `skills/simple-changelogs/scripts/tests/curation-source.check.ts`

**Interfaces:**

```ts
export interface CurationSourceItem {
  itemId: string; // sha256 per the source-entry model
  releaseIdentity: string;
  sectionIdentity: string; // "" when the item sits directly under a release
  displayText: string; // raw Markdown with signature comments stripped
  normalizedText: string; // identity text after CRLF/whitespace normalization
}

export interface CurationSourceRelease {
  boundary: SourceBoundary;
  sections: string[];
  itemIds: string[];
}

export interface CurationSource {
  sourcePath: string;
  releases: CurationSourceRelease[];
  items: CurationSourceItem[];
  diagnostics: string[]; // ambiguity reports; never guessed structure
}

export type ScopeResolution =
  | { ok: true; itemIds: string[] }
  | { ok: false; diagnostic: string };

export declare function extractCurationSource(
  markdown: string,
  sourcePath: string
): CurationSource;
export declare function resolveCurationScope(
  source: CurationSource,
  scope: CurationScope
): ScopeResolution;
export declare function fingerprintSourceScope(
  source: CurationSource,
  scope: CurationScope
): string;
export declare function fingerprintBytes(content: Uint8Array | string): string;
```

- [ ] **Step 1: Write failing parser tests**

Anchor the suite with a shape-defining test, then enumerate the remaining
cases in the same style:

```ts
test("nested children stay attached to their top-level bullet", () => {
  const source = extractCurationSource(
    [
      "## 1.2.0 - 2026-06-01",
      "",
      "- Added export formats",
      "  - CSV download",
      "  - PDF download",
      "- Fixed sync retries",
    ].join("\n"),
    "CHANGELOG.md"
  );
  expect(source.items).toHaveLength(2);
  expect(source.items[0].displayText).toContain("PDF download");
  expect(source.diagnostics).toHaveLength(0);
});
```

Cover:

- standard release headings and dates;
- `Unreleased`;
- SemVer, prerelease, PEP 440, date-only, and named releases;
- repeated headings with occurrence ordinals;
- top-level bullets with nested children as atomic items;
- flat bullets;
- nested feature headings;
- fenced-code fake headings and bullets;
- HTML comments and signature comments;
- CRLF normalization and trailing whitespace;
- links and inline Markdown;
- ambiguous malformed structures;
- empty releases and no-placeholder sources.

Run the suite and confirm it fails with an unresolved `curation-source` import
before implementing:

```bash
bun test skills/simple-changelogs/scripts/tests/curation-source.check.ts
```

- [ ] **Step 2: Implement the line-oriented scanner**

Do not pull in a Markdown runtime unless tests prove the dependency-free scanner
cannot preserve repository structures safely. Return diagnostics for ambiguous
input rather than guessing.

- [ ] **Step 3: Implement stable fingerprints**

Use SHA-256 and canonical serialized components. Preserve raw display text
separately from normalized identity text.

- [ ] **Step 4: Implement scope resolution**

Resolve boundaries by source path, heading, optional date/version, and ordinal.
Return explicit ambiguity or not-found diagnostics.

- [ ] **Step 5: Run focused tests**

```bash
bun test skills/simple-changelogs/scripts/tests/curation-source.check.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add skills/simple-changelogs/scripts/lib/curation-source.ts \
  skills/simple-changelogs/scripts/tests/curation-source.check.ts
git commit -m "feat(skill): add deterministic curation source extraction"
```

---

## Task 3: Implement curation analysis and verification

**Files:**

- Create: `skills/simple-changelogs/scripts/lib/curation.ts`
- Create: `skills/simple-changelogs/scripts/tests/curation.check.ts`

**Interfaces:**

All transition helpers are pure: they take a manifest value and return a new
manifest value plus the affected operation, never mutating inputs.

```ts
export interface OverlapClassification {
  overlap: "none" | "continuation" | "partial-overlap" | "full-overlap";
  overlappingOperationIds: string[];
  nextUncuratedInterval?: { first: SourceBoundary; last: SourceBoundary };
}

export interface CurationTransitionResult {
  manifest: CurationManifest;
  operation: CurationOperation;
}

export interface CurationVerificationReport {
  ok: boolean;
  diagnostics: string[];
  counts: CurationCounts;
}

export declare function classifyCurationOverlap(
  manifest: CurationManifest,
  surfaceId: string,
  scope: CurationScope,
  source: CurationSource
): OverlapClassification;
export declare function findCurationCoverageGaps(
  manifest: CurationManifest,
  surfaceId: string,
  source: CurationSource
): Array<{ first: SourceBoundary; last: SourceBoundary }>;
export declare function buildCurationOperationId(input: {
  surfaceId: string;
  effectiveScope: CurationScope;
  sourceFingerprint: string;
  surfaceFingerprintBefore: string;
}): string;
export declare function beginCurationOperation(
  manifest: CurationManifest,
  input: BeginCurationInput
): CurationTransitionResult;
export declare function completeCurationOperation(
  manifest: CurationManifest,
  input: CompleteCurationInput
): CurationTransitionResult;
export declare function failCurationOperation(
  manifest: CurationManifest,
  input: FailCurationInput
): CurationTransitionResult;
export declare function supersedeCurationOperations(
  manifest: CurationManifest,
  input: SupersedeCurationInput
): CurationTransitionResult;
export declare function verifyCuration(
  input: VerifyCurationInput
): CurationVerificationReport;
```

Define the `*Input` types in `curation.ts` from the manifest contract's
operation fields; keep them free of file I/O concerns.

- [ ] **Step 1: Write failing state-transition tests**

Anchor the suite with a shape-defining test, then enumerate the remaining
cases in the same style:

```ts
test("retrying an unchanged partial operation reuses its ID", () => {
  const begun = beginCurationOperation(baseManifest, beginInput);
  const retried = beginCurationOperation(begun.manifest, beginInput);
  expect(retried.operation.operationId).toBe(begun.operation.operationId);
  expect(retried.manifest.surfaces[0].operations).toHaveLength(1);
  expect(baseManifest.surfaces[0].operations).toHaveLength(0); // no mutation
});
```

Cover:

- first curation;
- non-overlapping continuation;
- partial and full overlap;
- gaps between completed ranges;
- exact unchanged retry;
- genuine revisit;
- deployed operation without acknowledgment;
- acknowledged deployed operation;
- one-time transparency choice reuse and explicit later preference change;
- compound canonical revision linked to an immutable curation baseline;
- selected-summary copy revision linked without canonical source mutation;
- partial resume;
- stale partial operation;
- handled failure;
- superseding only after replacement completion;
- provisional pending-release scope becoming released;
- independent histories for multiple surfaces.

- [ ] **Step 2: Write failing conservation tests**

Cover:

- full-history multiset equality;
- selected-summary snapshot equality;
- exact approved old → new copy revision;
- revised canonical source captured before curation-phase hashing;
- duplicate IDs;
- missing IDs;
- unexpected additions;
- new-source-item fallback;
- stale derived IDs after wording changes;
- identical canonical source byte hashes;
- differing source byte hashes despite equal visible text.

Run both suites and confirm they fail with an unresolved `curation` import
before implementing:

```bash
bun test skills/simple-changelogs/scripts/tests/curation.check.ts
```

- [ ] **Step 3: Implement pure transition helpers**

Return new manifest values without mutating inputs. Keep project file I/O out of
the core library.

- [ ] **Step 4: Implement overlap and gap analysis**

Use canonical document positions, not lexical or SemVer sorting. Distinguish
continuation from overlap and calculate the next uncurated interval.

- [ ] **Step 5: Implement verification**

Return structured diagnostics and counts suitable for both CLI output and
evaluation reporting. Never convert a failed invariant into a warning.

- [ ] **Step 6: Run focused tests**

```bash
bun test skills/simple-changelogs/scripts/tests/curation.check.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add skills/simple-changelogs/scripts/lib/curation.ts \
  skills/simple-changelogs/scripts/tests/curation.check.ts
git commit -m "feat(skill): add curation state transitions and verification"
```

---

## Task 4: Add the portable curation CLI

**Files:**

- Create: `skills/simple-changelogs/scripts/curation.ts`
- Modify: `skills/simple-changelogs/scripts/tests/curation.check.ts`
- Modify: `skills/simple-changelogs/scripts/lib/contracts.ts`
- Modify: `skills/simple-changelogs/scripts/tests/contracts.check.ts`

**Commands:**

```text
bun scripts/curation.ts inspect \
  --workspace <path> \
  --source <relative-path> \
  --surface <relative-path> \
  [--surface-id <id>] \
  [--scope-file <path>] \
  [--format text|json]
bun scripts/curation.ts verify \
  --workspace <path> \
  [--surface-id <id>] \
  [--format text|json]
```

- [ ] **Step 1: Write failing CLI tests**

Anchor the suite with a shape-defining test, then enumerate the remaining
cases in the same style:

```ts
test("inspect rejects a symlinked source escaping the workspace", async () => {
  const workspace = await makeTempWorkspaceWithEscapeSymlink();
  const result = await runCurationCli([
    "inspect",
    "--workspace", workspace,
    "--source", "escape-link.md",
    "--surface", "notes/index.html",
    "--format", "json",
  ]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("outside the workspace");
});
```

Cover exact argument arrays, JSON and text output, malformed manifests, absent
manifests, ambiguous scopes, nonzero verification status, and paths containing
spaces. Reject workspace escapes, traversal, and symlinks that resolve outside
the workspace.

Run the suite and confirm the new CLI tests fail because
`scripts/curation.ts` does not exist yet:

```bash
bun test skills/simple-changelogs/scripts/tests/curation.check.ts
```

- [ ] **Step 2: Implement `inspect`**

Read only. On a first run, accept explicit source and surface paths without
requiring a manifest. When a manifest exists, resolve by surface ID or matching
path. Report discovered sources, active scopes, completed ranges, partial resume
points, coverage gaps, new fallback items, and overlap for an optional requested
scope.

- [ ] **Step 3: Implement `verify`**

Validate the manifest and canonical sources, recalculate fingerprints, and
check active-map integrity. Allow repository-native surface adapters to provide
the before/after selected item IDs for formats the generic tool cannot render.

- [ ] **Step 4: Add package contracts**

Require the script and schema in the installed skill package, syntax-check the
entry point, and verify that the curation reference routes to them.

- [ ] **Step 5: Run focused checks**

```bash
bun test \
  skills/simple-changelogs/scripts/tests/curation.check.ts \
  skills/simple-changelogs/scripts/tests/contracts.check.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add skills/simple-changelogs/scripts/curation.ts \
  skills/simple-changelogs/scripts/lib/contracts.ts \
  skills/simple-changelogs/scripts/tests/curation.check.ts \
  skills/simple-changelogs/scripts/tests/contracts.check.ts
git commit -m "feat(skill): add portable curation inspect/verify CLI"
```

---

## Task 5: Add the canonical curation workflow reference

**Files:**

- Create: `skills/simple-changelogs/references/release-note-curation.md`
- Modify: `skills/simple-changelogs/SKILL.md`
- Modify: `skills/simple-changelogs/references/release-note-surfaces.md`
- Modify: `skills/simple-changelogs/references/backfill.md`
- Modify: `skills/simple-changelogs/references/release-lifecycle.md`
- Modify: `skills/simple-changelogs/references/automation-verification.md`

- [ ] **Step 1: Write the curation reference**

Keep detailed behavior in this reference:

- authority and invariants;
- scope resolution;
- source-item model;
- surface modes;
- compound version/content revision classification;
- the canonical-file-as-the-only-surface branch and its two offered paths;
- deployed-range acknowledgment;
- one-time curation/correction notice preference;
- authorized missing-surface onboarding;
- display-preference inference and questions;
- audit and preview format;
- application rules;
- manifest lifecycle;
- repeat/continue/revisit decisions;
- failure recovery;
- verification and handoff.

Include the exact repeat-run prompt pattern and the rule that an explicit
continuation or revisit request must not be confirmed twice.

- [ ] **Step 2: Expand SKILL.md triggering**

Add the exact noun and verb forms—rearrangement/rearranging,
organization/organizing, reorganization/reorganizing, and curation/curating—to
the frontmatter description when the object is release notes. Add a
reference-router row for presentation curation. Keep `SKILL.md` concise and
below its context budget: the frontmatter description is currently 378
characters against a 1024-character hard cap — state the new length after
editing and stay well under the cap.

- [ ] **Step 3: Reconcile surface guidance**

Replace the unconditional requirement that all surface ordering and grouping
match the canonical changelog with:

- source order as the default;
- explicit curation as the presentation-only exception;
- release metadata and item conservation still aligned.

- [ ] **Step 4: Draw boundaries with backfill and finalization**

State in the canonical owners:

- curation is not historical reconstruction;
- semantic candidates route to released-history rewrite authority;
- explicit source revisions do not write guidance backfill state unless they are
  actually part of a guidance audit or reconstruction;
- release finalization retains its existing meaning;
- provisional pending curation is revalidated at finalization.

- [ ] **Step 5: Extend verification guidance**

Add canonical byte-hash preservation, conservation, fallback visibility,
manifest validation, and overlap/cursor reporting.

- [ ] **Step 6: Check for duplicate normative prose**

Use the new reference as the only detailed owner. SKILL and neighboring
references should route or state boundaries, not duplicate the workflow.

- [ ] **Step 7: Commit**

```bash
git add skills/simple-changelogs/references/release-note-curation.md \
  skills/simple-changelogs/SKILL.md \
  skills/simple-changelogs/references/release-note-surfaces.md \
  skills/simple-changelogs/references/backfill.md \
  skills/simple-changelogs/references/release-lifecycle.md \
  skills/simple-changelogs/references/automation-verification.md
git commit -m "docs(skill): add release-note curation reference and routing"
```

---

## Task 6: Create the complete curation fixture

**Files:**

- Create the `skills/simple-changelogs/evals/fixtures/curated-history/` tree
  listed in the file map.
- Modify: `skills/simple-changelogs/scripts/tests/fixtures.check.ts`
- Modify: `skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts`

- [ ] **Step 1: Create multi-release canonical history**

Include:

- at least five releases;
- related capabilities spread across releases;
- major features, trust outcomes, improvements, fixes, and durable polish;
- nested atomic entries;
- HTML signatures;
- one non-SemVer release identity;
- `Unreleased` material for provisional tests;
- developer-only material that must never enter the public surface.

- [ ] **Step 2: Create an established public full-history surface**

Make it reachable through fixture code and backed by `release-notes.json` or a
small source module. It should initially render canonical source order and
retain version/date context. Add local proof that the fixture’s released range
is considered previously deployed so acknowledgment behavior can be evaluated
without contacting a real service.

- [ ] **Step 3: Document fixture-local architecture**

The fixture README must name exact canonical sources, surface files, routes,
audience, build/test commands, and presentation-map integration point.

- [ ] **Step 4: Add fixture integrity tests**

Assert the baseline has no curation manifest, the route is established and
reachable, source and surface item sets are known, and no developer-only item
appears publicly.

- [ ] **Step 5: Reuse the routed-app fixture for missing-surface onboarding**

Its documented absence of a reachable public archive and “What’s New” surface
must exercise authorization plus onboarding without turning the curation fixture
itself into two contradictory baselines.

- [ ] **Step 6: Commit**

```bash
git add skills/simple-changelogs/evals/fixtures/curated-history \
  skills/simple-changelogs/scripts/tests/fixtures.check.ts \
  skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts
git commit -m "test(skill): add curated-history evaluation fixture"
```

---

## Task 7: Add trigger evaluation coverage

**Files:**

- Modify: `skills/simple-changelogs/evals/cases.json`
- Modify: `skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts`

- [ ] **Step 1: Add positive discover-mode cases**

Cover the user’s four required concepts in both noun and verb forms:

- “Rearrange the release notes.”
- “Run a rearrangement of the release notes.”
- “Organize the release notes.”
- “Do a release-note organization pass.”
- “Reorganize this release-note section.”
- “I want a reorganization of this release-note section.”
- “Curate the public release notes.”
- “Run release-note curation.”

Also cover “continue from the last curation.”

- [ ] **Step 2: Add negative/disambiguation cases**

Cover:

- finalize a release;
- organize commits;
- reorganize a source file;
- rewrite `CHANGELOG.md` itself;
- curate a missing surface;
- generic UI organization unrelated to release notes.

- [ ] **Step 3: Update canonical case registries**

Add IDs and a `curation` coverage tag without weakening exact-count or
exact-membership protections.

- [ ] **Step 4: Run manifest tests**

```bash
bun test skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/simple-changelogs/evals/cases.json \
  skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts
git commit -m "test(skill): add curation trigger evaluation coverage"
```

---

## Task 8: Add first-run and scoped behavior evaluations

**Files:**

- Modify: `skills/simple-changelogs/evals/cases.json`
- Modify: `skills/simple-changelogs/evals/schemas/runner-response.schema.json`
- Modify: `skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts`

Add canonical report codes:

- authorization: `RELEASE_NOTE_CURATION`, `RELEASE_NOTE_COPY_REVISION`;
- decisions: `CURATION_PREVIEWED`, `CURATION_COMPLETED`,
  `CURATION_SCOPE_CONTINUED`, `CURATION_SCOPE_REVISITED`,
  `DEPLOYED_CURATION_ACKNOWLEDGED`, `CURATION_NOTICE_DECLINED`,
  `CURATION_NOTICE_ENABLED`, `CURATION_SURFACE_ONBOARDED`;
- verification: `CURATION_SOURCE_IMMUTABLE`, `CURATION_CONSERVATION`,
  `CURATION_MANIFEST`, `CURATION_SURFACE_RENDER`,
  `CURATION_DEPLOYED_IMPACT`, `CURATION_DISPLAY_PREFERENCES`.

- [ ] **Step 1: Add a full-history preview/apply multi-turn case**

Turn one requests curation and expects:

- preview;
- exact surface/source paths;
- no file changes;
- `RELEASE_NOTE_CURATION` authority recognized from the current request;
- deployed range and change kinds disclosed;
- one-time transparency preference requested because it is still undecided;
- no write until the proposed arrangement is approved.

Turn two approves and expects:

- exact preview approval recognized from the user response;
- deployed-impact acknowledgment and transparency choice recorded;
- curation manifest created;
- surface changed;
- both canonical changelogs unchanged;
- completed operation and active groups;
- conservation and source-immutability verification.

- [ ] **Step 2: Add scoped cases**

Cover one release, an inclusive release range, a named section, and an explicit
item set.

- [ ] **Step 3: Add surface-mode cases**

Cover:

- full public history;
- compact selected summary;
- authorized internal developer history;
- generated surface regeneration;
- directly parsed surface integration.

- [ ] **Step 4: Add semantic-boundary cases**

Require the agent to leave wording, deletions, visibility changes, and source
history untouched while reporting separate candidates.

- [ ] **Step 5: Add compound content/version revision cases**

Cover:

- display-only version formatting with unchanged canonical metadata;
- compact-summary copy revision under `RELEASE_NOTE_COPY_REVISION`;
- a canonical version/content correction under
  `RELEASED_HISTORY_REWRITE`, followed by byte-stable curation against the new
  baseline;
- missing release evidence that blocks only the unsupported correction;
- material deployed correction with a recommended correction notice;
- mechanical display cleanup that does not overstate the need for a notice.

- [ ] **Step 6: Add deployed-surface notice cases**

Cover:

- required acknowledgment for a previously visible range;
- no acknowledgment for an unpublished surface or new-only append;
- current-request acknowledgment reused without asking twice;
- `none`, `curation-notice`, and `correction-notice`;
- exact approved notice copy rendered without exposing ledger metadata;
- stored preference preventing later unsolicited notice questions.

- [ ] **Step 7: Add missing-surface onboarding cases**

Using `routed-app`, cover:

- curation requested when no surface exists;
- absent repository policy keeping its historical-audit disposition separate
  from onboarding and curation;
- new-surface authority required before onboarding writes;
- archive, modal, and both choices;
- compact questions only for unresolved preferences;
- grouped-section, timeline, card, and traditional-list layouts;
- exact/friendly/hidden version and date combinations;
- rejection of a cross-release archive that hides both dates and versions;
- curated default plus chronological access;
- inference of existing design/accessibility conventions instead of asking;
- one visual-direction question only when the fixture lacks usable design
  context;
- no surface created when the user declines.

- [ ] **Step 8: Add canonical-file-as-surface cases**

Using the `single-changelog` fixture (whose rendered `CHANGELOG.md` is the only
established destination), cover:

- a generic “organize the release notes” request receiving the constraint
  explanation and the bounded rewrite-or-new-surface question, with no file
  changes before the answer;
- an explicit canonical-reorganization choice flowing into
  `RELEASED_HISTORY_REWRITE` with old → new preview, signatures, and preserved
  release boundaries — recorded as a rewrite, not a curation operation;
- an explicit new-surface choice flowing into `newReleaseNoteSurfaces`
  authorization plus onboarding, with the canonical file left byte-identical
  during the subsequent curation phase;
- a request already naming one path explicitly, which must not be asked the
  bounded question again.

- [ ] **Step 9: Commit**

```bash
git add skills/simple-changelogs/evals/cases.json \
  skills/simple-changelogs/evals/schemas/runner-response.schema.json \
  skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts
git commit -m "test(skill): add first-run and scoped curation behavior cases"
```

---

## Task 9: Add repeat, resume, and lifecycle behavior evaluations

**Files:**

- Modify: `skills/simple-changelogs/evals/cases.json`
- Modify: `skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts`

- [ ] **Step 1: Add completed-overlap UX**

Start from a completed curation and request generic curation again. Expect the
previous range plus continue/revisit/cancel choices and no changes before the
answer.

- [ ] **Step 2: Add explicit continuation**

The user explicitly asks to continue from the previous boundary. Expect no
redundant confirmation and a new non-overlapping completed operation.

- [ ] **Step 3: Add explicit revisit**

The user names an overlapping range. Expect no redundant “are you sure,” a new
operation, and the previous active operation marked superseded only after
verification.

- [ ] **Step 4: Add gap-aware continuation**

Create disjoint completed ranges and verify that the agent offers the uncovered
gap rather than using only a single last-version cursor.

- [ ] **Step 5: Add partial and failed resume**

Cover matching fingerprints, changed fingerprints, refreshed preview, and
honest failed/partial state.

- [ ] **Step 6: Add new-release fallback**

Add a source release after curation. Assert it remains visible in canonical
order, verification identifies stale active coverage, and no unsolicited
curation prompt occurs.

- [ ] **Step 7: Add provisional release finalization**

Curate `Unreleased` in release preparation, finalize the release in a later
turn, and require fingerprint reconciliation plus a released scope without
changing the selected item set.

- [ ] **Step 8: Add idempotence**

Re-run the exact completed operation with unchanged files and expect no diff or
duplicate ledger record.

- [ ] **Step 9: Add later deployed-overwrite behavior**

Require operation-specific acknowledgment for a newly affected deployed range
while reusing the surface’s stored transparency preference without asking that
one-time question again. An explicit request that already acknowledges the live
range must not trigger redundant confirmation.

- [ ] **Step 10: Commit**

```bash
git add skills/simple-changelogs/evals/cases.json \
  skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts
git commit -m "test(skill): add curation repeat, resume, and lifecycle cases"
```

---

## Task 10: Strengthen deterministic coverage and package integrity

**Files:**

- Modify: `skills/simple-changelogs/scripts/tests/contracts.check.ts`
- Modify: `skills/simple-changelogs/scripts/tests/schema-parity.check.ts`
- Modify: `skills/simple-changelogs/scripts/tests/fixtures.check.ts`
- Modify: `skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts`

- [ ] **Step 1: Pin normative phrases**

Require the trigger synonyms, canonical-source immutability, separate manifest,
item conservation, repeat choices, exact-range no-double-confirmation, and
source-order fallback.

- [ ] **Step 2: Reject unsafe guidance**

Fail contracts if packaged guidance:

- tells agents to reorder released Markdown directly;
- uses curation as implicit rewrite authority;
- stores operation state in the globally installed skill;
- hides unmapped new items;
- treats a missing surface as authorized;
- changes canonical versions/content under curation authority alone;
- writes guidance backfill state for a direct explicit correction;
- overwrites a deployed range without visible-impact acknowledgment;
- repeatedly asks for the same surface’s transparency preference;
- bundles operation-ledger metadata into a public client;
- allows a cross-release archive to hide both versions and dates;
- prompts every repository to curate old history;
- conflates curation with release finalization or guidance backfill.

- [ ] **Step 3: Verify package routing**

Require direct SKILL routing to the new reference and direct reference links to
the bundled CLI/schema. Keep reference depth at one level.

- [ ] **Step 4: Verify report-code registry**

Ensure every new manifest assertion code appears in the runner-response schema
descriptions and no asserted code is undocumented.

- [ ] **Step 5: Commit**

```bash
git add skills/simple-changelogs/scripts/tests/contracts.check.ts \
  skills/simple-changelogs/scripts/tests/schema-parity.check.ts \
  skills/simple-changelogs/scripts/tests/fixtures.check.ts \
  skills/simple-changelogs/scripts/tests/manifest-coverage.check.ts
git commit -m "test(skill): pin curation guidance and package contracts"
```

---

## Task 11: Document the user-facing capability

**Files:**

- Modify: `README.md`
- Modify: `skills/simple-changelogs/EVAL.md`

- [ ] **Step 1: Add a README curation section**

Explain:

- the four required trigger words;
- chronological canonical-source preservation;
- preview and approval;
- supported scopes and surface modes;
- explicit display-only, derived-copy, and canonical source-revision branches;
- deployed-range acknowledgment;
- one-time curation/correction notice choice;
- missing-surface onboarding and its recommended defaults;
- the separate curation manifest;
- continuation/revisit behavior;
- semantic and new-surface boundaries;
- exact bundled inspection and verification commands.

- [ ] **Step 2: Document the manifest and CLI**

Include a concise valid example, status meanings, commit expectation, and how to
repair or resume incomplete operations. Include display preferences,
transparency preference, deployed-impact evidence, and linked-revision examples
without exposing ledger metadata as runtime UI data.

- [ ] **Step 3: Extend the evaluation guide**

Document the `curation` coverage tag, fixture, report codes, schema, and how to
add new curation cases.

- [ ] **Step 4: Confirm setup docs remain unchanged in meaning**

The feature must not add a setup question, `.simple-changelogs.json` field, or
guidance audit obligation.

- [ ] **Step 5: Commit**

```bash
git add README.md skills/simple-changelogs/EVAL.md
git commit -m "docs: document release-note curation capability"
```

---

## Task 12: Add release history and run final verification

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `DEVELOPER_CHANGELOG.md`

- [ ] **Step 1: Delegate release-note wording**

Use a fresh `gpt-5.6-sol` subagent with medium reasoning effort to draft the
customer and developer entries from the actual final diff. Do not pre-write or
invent shipped details. Review the drafted entries with Claude Fable on low
effort — or Claude Opus 4.8 on high effort if Fable is unavailable or
rate-limited — before applying them.

- [ ] **Step 2: Apply classification**

Customer history should describe the opt-in ability to organize established
release-note surfaces while preserving chronological source history. Developer
history should preserve the manifest, fingerprinting, parser, state-transition,
verification, CLI, and evaluation architecture.

- [ ] **Step 3: Add signatures**

Follow the repository’s existing raw-Markdown signature policy and use only
runtime-exposed identity and timestamp data.

- [ ] **Step 4: Review the actual complete diff**

Confirm:

- unrelated pre-existing work remains intact;
- no canonical guidance version was bumped solely for curation;
- no repo-policy schema migration was introduced;
- every new file is included in the installed skill package;
- docs and code name exact paths and commands;
- all curation normative behavior has deterministic or structured evaluation
  coverage.
- deployed overwrites, compound revisions, transparency choices, and
  missing-surface onboarding are represented in contracts and behavior cases;
- the operation ledger is absent from public runtime bundles.

- [ ] **Step 5: Run the full local verification suite**

```bash
bun run test
bun run eval
bun run typecheck
bun run lint
python3 /Users/jaay/.agents/skills/biome-validator/scripts/validate.py \
  --root . \
  --strict
bunx ultracite doctor
```

Expected:

- all Bun contract and harness tests pass;
- the credential-free contract evaluation passes;
- TypeScript reports no errors;
- Ultracite reports no findings;
- Biome and Ultracite configuration validates.

- [ ] **Step 6: Run adapter-backed smoke coverage when available**

Run at least:

- one discover-mode curation synonym;
- the first-run preview/apply behavior;
- generic repeat request with continue/revisit/cancel;
- explicit continuation;
- deployed-range acknowledgment and one-time notice choice;
- compound version/content revision;
- authorized missing-surface onboarding;
- semantic-boundary protection.

If adapter credentials are unavailable, report that limitation without
representing the model-backed suite as passed.

- [ ] **Step 7: Re-read final user-facing output**

Verify the final handoff states:

- what surface behavior shipped;
- that chronological source history remains protected;
- exact checks run;
- any adapter coverage not run;
- no keys, credentials, remote release, deployment, or new surface are required
  merely to use curation on an established local surface.

- [ ] **Step 8: Commit**

```bash
git add CHANGELOG.md DEVELOPER_CHANGELOG.md
git commit -m "docs(changelog): record release-note curation capability"
```

---

## Acceptance Criteria

The capability is complete only when all of these are true:

- All four user-requested trigger terms activate the curation branch.
- First-time curation can cover the entire history or any supported bounded
  scope.
- The agent previews groups/order and applies only approved presentation work.
- Presentation-only work leaves `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md`
  byte-identical.
- Explicit canonical version/content changes run as a separately authorized,
  verified revision before curation and do not mutate guidance backfill state
  unless they are genuinely part of a guidance audit or reconstruction.
- Explicit selected-summary copy revisions remain grounded in unchanged
  canonical facts and carry distinct copy-revision authority.
- Full-history and selected-summary conservation checks prevent silent loss,
  duplication, or inclusion changes.
- Cross-release thematic grouping retains release context and source-order
  fallback.
- New entries remain visible even when an active map is stale.
- Previously deployed ranges require an exact visible-impact acknowledgment
  unless the current request already supplies it.
- Each surface asks once for no notice, a curation notice, or a correction
  notice; later operations reuse that choice unless the user changes it.
- Material deployed source corrections recommend a factual correction notice,
  while presentation-only curation defaults to no notice.
- A missing surface starts authorization-aware onboarding rather than silently
  creating a destination.
- A repository whose canonical changelog file is the only established
  destination receives the explicit rewrite-or-new-surface choice instead of
  silent curation or a missing-surface dead end.
- Surface onboarding asks only unresolved destination, grouping, layout,
  temporal-marker, density, chronological-access, transparency, and navigation
  choices.
- Visual direction is inferred from the project and asked only when no usable
  local design language exists.
- Cross-release history never hides both versions and dates.
- Existing product styling, accessibility, responsiveness, localization, and
  access policy are inferred and enforced rather than offered as optional
  preferences.
- Each surface records completed, partial, failed, and superseded operations
  honestly in the separate manifest.
- Completed records include exact source range, fingerprints, counts, grouping
  strategy, and continuation boundaries.
- Generic repeated requests show the previous range and offer
  continue/revisit/cancel.
- Explicit continuation or exact revisit requests are not confirmed twice.
- Coverage gaps are detected instead of relying on one simplistic cursor.
- Partial and failed work resumes only when fingerprints still match.
- Provisional pending-release curation reconciles at release finalization.
- Semantic edits, visibility changes, canonical-history changes, and missing
  surfaces retain their existing separate authorization requirements.
- Curation does not create a guidance backfill prompt or change repository setup
  policy.
- The installed skill package contains the reference, schema, scripts, fixtures,
  and evaluation coverage required to use and validate the feature.
- Contract, type, lint, and available adapter-backed checks pass with fresh
  evidence.
