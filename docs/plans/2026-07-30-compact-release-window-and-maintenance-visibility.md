# Compact Release Window and Maintenance Visibility Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.
> Preserve unrelated work already present in the worktree. Use a `gpt-5.6-sol`
> subagent with medium reasoning effort for final customer and developer
> release-note wording, as required by this repository. If that model at medium
> effort is unavailable, use Opus 5 at medium effort and state which model wrote
> the notes.

> **Audit note (2026-07-30):** Verified against the working tree and revised.
>
> **Verified accurate:** guidance versions (full 9, mobile 8, web 8, web+CMS 8,
> skill-maintainer 5, CMS 1) and therefore the proposed 9→10 / 8→9 bumps; the
> `routineReleaseDisclosure` repository-policy decision; the
> filter-before-limit rule; the automatic-unseen versus manual-recent split;
> all six named reference paths exist in the four product distributions; and
> the `text.match` / `json.path` / `file.unchanged` assertion kinds needed here
> already exist.
>
> **Corrected:** the curation-manifest persistence branch was removed as
> unimplementable (see *Persistence*); compact settings moved into repository
> policy; the custom-count "after the user confirms it" gate was removed as
> contradicting the intended semantics; the fixture strategy was inverted; the
> `PRODUCT_SURFACE_DISTRIBUTIONS` gate was corrected; the `61`-case pin was
> corrected to `68`; the size-budget risk was re-measured and downgraded.
>
> **Gap-filled:** conflict analysis for the two existing pinned modal cases; the
> retroactive-reconfiguration edge case; the no-archive overflow case; the
> `omit`-versus-expert-ledger conflict; the missing numeric CLI parser; reuse of
> the existing `collapsed()` contract helper and the existing `Bug Fixes`
> grouping convention.

**Goal:** Let users creating a missing customer-facing Release Notes or What's
New surface choose how many releases its compact view can show, how routine
customer-relevant maintenance releases are described publicly, and whether
maintenance-only releases appear in the compact modal at all.

**Architecture:** Keep `CHANGELOG.md` as the canonical customer source and
classify maintenance releases before deriving destination-specific views.
Record all three durable choices as optional fields in `.simple-changelogs.json`,
modeled exactly on the existing `newReleaseNoteSurfaceComponents` field — a
surface-implementation decision that the repository already stores in policy
rather than in the generated surface.

**Tech Stack:** Markdown skill guidance, Bun 1.3.13, TypeScript 7, `bun:test`,
JSON Schema draft 2020-12, Biome 2.5 through Ultracite, and the existing
adapter-driven evaluation harness.

---

## Worktree Context

This plan lands on top of the in-flight
`docs/plans/2026-07-29-release-version-identifiers.md` implementation, which is
partially applied in the working tree. Consequences:

- `crossSurfaceVersioning` already exists in `RepoPolicy`, `Selection`,
  `validateRepoPolicy`'s optional key list, `repo-policy.schema.json`,
  `setup-result.schema.json` (`$defs.repoPolicy` **and** `$defs.selection`),
  `--cross-surface-versioning`, and `references/setup.md`. **Use it as the
  copy-paste template for all three new fields.**
- The `crossSurfaceVersioningUpdate` branch described in that plan's Task 3 is
  **not yet implemented** — `applySetup` still short-circuits through
  `preSetupResult`. Do not assume an update path for already-configured
  repositories exists. This plan therefore does **not** depend on one.
- `tooling/distributions.check.ts` already defines
  `collapsed(source) => source.replace(/\s+/gu, " ").trim()`. Reuse it; do not
  add a second whitespace normalizer.
- Guidance versions were already bumped to full 9 / mobile 8 / web 8 /
  web+CMS 8. Re-read `GUIDANCE_VERSIONS` in
  `tooling/simple-changelogs/scripts/setup.ts` immediately before bumping and
  increment from the then-current values.

---

## Confirmed Product Decisions

| Question | Decision |
| --- | --- |
| Default compact depth | Up to 3 releases |
| Offered depths | Latest only, 3 (recommended), 5, 8, or a custom positive integer |
| Custom value above 8 | Allowed. Show a friendly density note, then honor it. **Not** a restriction, clamp, or extra approval gate |
| Automatic compact view | Show up to the configured number of newest **unseen** eligible releases |
| Manual compact view | Show up to the configured number of most **recent** eligible releases |
| Default routine-release disclosure | Summarize customer-relevant routine work as `Bug fixes and improvements.` |
| Alternative disclosure | Describe verified customer-visible fixes individually when useful and safe |
| Public opt-out | Omit maintenance-only releases from customer-facing history and derived surfaces |
| Default compact maintenance behavior | Include maintenance-only releases |
| Compact maintenance alternative | Skip them so they neither render nor consume the release limit |
| Skip example | A three-release view may show `.19.0`, `.18.5`, `.18.4` while intervening maintenance-only versions remain absent |
| Full archive relationship | Compact visibility never silently removes an otherwise public release from the full archive |
| Internal-only releases | Never invent `Bug fixes and improvements.` for CI, refactors, dependency maintenance, migrations, or other work with no audience-visible effect |
| Scope | Customer/user-facing surfaces in `full`, `web`, `mobile`, and the public Web side of `web-cms` |
| Exclusions | Skill-repository notes, protected technical/CMS histories, store fields, emails, and announcements keep their own scope and content budgets |
| Existing surfaces | Preserve proven behavior; ask only when the current task creates or explicitly reconfigures the compact surface |
| Persistence | All three choices are optional fields in `.simple-changelogs.json` |

## Terms

- **Substantive release:** A release with at least one public capability,
  workflow, trust, access, payment, safety, compliance, onboarding, data,
  compatibility, or other material audience outcome.
- **Maintenance-only release:** A release whose eligible public content consists
  only of routine customer-relevant bug fixes, reliability work, or minor
  improvements that do not merit feature-level detail.
- **Internal-only release:** A release containing no eligible customer-facing
  outcome for the destination. It is not a maintenance-only public release.
- **Routine release disclosure:** The repository preference for summarizing,
  detailing, or omitting maintenance-only releases in canonical customer
  history.
- **Compact maintenance visibility:** Whether maintenance-only releases already
  eligible for public history may appear in a compact surface.
- **Release limit:** The maximum number of eligible release sections rendered in
  the compact view after all audience, product, maintenance, and seen-state
  filters run.
- **Unseen release:** An eligible release newer than the product-, platform-,
  and release-train-scoped seen cursor for an automatically shown surface.

## Non-Negotiable Invariants

1. `CHANGELOG.md` remains the canonical customer source. A compact surface must
   not maintain unrelated handwritten release copy.
2. Classify scope before disclosure. A release may be substantive for Mobile,
   maintenance-only for Web, and ineligible for CMS; a shared version does not
   make those results identical.
3. A generic maintenance summary is allowed only when verified work affected the
   destination's audience. Never use it to make internal-only work look
   customer-facing.
4. `detail` means concise verified customer outcomes, not a public dump of
   commits, root causes, security mechanics, developer history, or every small
   code change.
5. Apply maintenance inclusion or exclusion **before** the compact release
   limit. Skipped releases never consume one of the selected slots.
6. A maintenance-only release excluded from an automatic modal must not open
   that modal. Recomputing eligibility on a later visit must not create a
   visible loop.
7. Automatic modal state remains independent by product, platform, and release
   train. Seeing Web notes must not suppress Mobile notes.
8. When more unseen eligible releases exist than the configured limit, show the
   newest eligible releases and route the overflow to the full archive. Do not
   repeatedly auto-open the modal to drain an old backlog.
9. A manual compact view uses the same configured limit but reads from recent
   eligible history rather than unseen history.
10. Compact maintenance visibility does not alter the full archive, canonical
    customer history, developer history, store copy, or unrelated destinations.
11. Existing explicit repository instructions, established public-ledger
    promises, and current user wording outrank the new defaults.
12. Do not ask again when the current request already supplies the release
    count, disclosure mode, or compact maintenance choice.
13. Do not add these fields to all-projects preferences. Release-note
    presentation and disclosure are product decisions, not safe global
    developer defaults.
14. Store notes remain independently curated for the submitted mobile app and
    version. A modal preference never changes store metadata.
15. **New — reconfiguration is not retroactive.** Changing
    `compactMaintenanceReleases` or `routineReleaseDisclosure` must not cause an
    automatic modal to re-open for releases older than the change. Treat
    everything at or below the current seen cursor as already seen.
16. **New — overflow needs a destination.** The "route the overflow to the full
    archive" rule applies only when an archive exists. When the user declined a
    public archive, the compact surface shows the limit and adds no dangling
    archive action.
17. **New — `omit` never overrides a ledger promise.** A repository with an
    established comprehensive public patch ledger keeps individual fix
    disclosure. Do not recommend or apply `omit` there.

---

## Onboarding UX

### Trigger condition

Ask these questions only when all of the following are true:

1. no suitable compact Release Notes/What's New surface exists, or the current
   request explicitly authorizes reconfiguring one;
2. the current request or stored policy authorizes creating the named surface;
3. the user selects an automatic or manual compact surface; and
4. repository evidence or the current request has not already answered the
   preference.

Creating only a full archive does not require a compact release-count question.
Creating a customer-facing archive may still require the routine-release
disclosure choice because that preference affects canonical public history.

### Question order

Keep the released-history/backfill question last as required by the existing
onboarding contract. The `unresolvedQuestions` array in `setup.ts` already ends
with `released-history-audit`; insert the new identifiers before it.

1. Select the archive and compact destinations.
2. Select automatic or manual compact behavior.
3. Ask how many releases the compact view should show.
4. Ask how maintenance-only releases should be described publicly.
5. Unless public maintenance releases are omitted, ask whether the compact
   surface includes or skips them.
6. Resolve component source and other existing surface-design questions.
7. Complete preference scope and instruction-pointer choices.
8. Ask the final released-history question.
9. Show one confirmation receipt containing every surface behavior choice.

### Release-count prompt

> **How many releases should the compact Release Notes view show?**
>
> - **Up to 3 releases (Recommended)** — an automatic view shows up to three
>   unseen eligible releases; a manual view shows the three most recent.
> - **Latest release only**
> - **Up to 5 releases**
> - **Up to 8 releases**
> - **Custom number**

Accept only a positive integer for the custom value. Reject `0`, negative,
fractional, and non-numeric input with a short retry.

For a value above 8, add one friendly note — for example, *"That's more than a
compact modal usually shows; it may read like an archive."* — and then record
the value. Do **not** clamp it, do **not** require a second confirmation, and do
**not** treat it as an authorization gate.

### Public-maintenance prompt

> **How should routine customer-relevant maintenance releases appear publicly?**
>
> - **Summarize them (Recommended)** — keep the version/date and use
>   `Bug fixes and improvements.`
> - **Describe customer-visible fixes** — write concise individual outcomes when
>   they are useful and safe to disclose.
> - **Hide them from public notes** — keep internal release evidence and
>   developer history, but omit the maintenance-only release from customer
>   history.

Use "summarize," not "obscure," in user-facing language.

Suppress the **Hide them** option when inspection finds an established
comprehensive public patch ledger (invariant 17); offer only summarize/detail
and say why.

### Compact-maintenance prompt

> **Should maintenance-only releases appear in this compact view?**
>
> - **Include them (Recommended)** — show their public summary or selected fix
>   details and count them toward the release limit.
> - **Skip them** — show only substantive releases; skipped maintenance versions
>   do not consume the release limit.

Skip this question when public maintenance disclosure is `omit`, because the
answer is already determined. Record no `compactMaintenanceReleases` value in
that case rather than recording a redundant `skip`.

### Decision matrix

| Public disclosure | Compact choice | Canonical/full archive | Compact surface |
| --- | --- | --- | --- |
| `summarize` | `include` | Version/date plus `Bug fixes and improvements.` | Render the summary and count the release |
| `summarize` | `skip` | Version/date plus the generic summary | Do not render or count it |
| `detail` | `include` | Concise verified customer-visible fixes | Render selected safe fix highlights and count the release |
| `detail` | `skip` | Concise verified customer-visible fixes | Do not render or count a maintenance-only release |
| `omit` | Not asked | No customer release section for maintenance-only work | No rendered release and no modal trigger |

### Confirmation receipt

The existing receipt must additionally name:

- the compact surface and whether it is automatic or manual;
- its product, platform, audience, and release train;
- the selected maximum release count;
- the routine public disclosure mode;
- compact maintenance visibility;
- the generic summary text when `summarize` is selected;
- the full archive relationship;
- `.simple-changelogs.json` as the file that will record all three values; and
- the fact that these choices grant no deployment, store submission, hosted
  release, or unrelated product authority.

---

## Classification and Canonical History

### Routine maintenance classification

Update customer-entry guidance to classify releases in this order:

1. Determine shipped state and the canonical release train.
2. Filter changes for the destination's product, platform, edition, and
   audience.
3. Separate substantive outcomes, routine customer-relevant maintenance, and
   internal-only work.
4. Apply the stored `routineReleaseDisclosure` preference to the maintenance
   group.
5. Preserve maintainable technical detail in `DEVELOPER_CHANGELOG.md`
   independently.

For `summarize`, prefer:

```md
## 18.4.1 - YYYY-MM-DD

- Bug fixes and improvements.
```

Adapt punctuation and established headings without changing the meaning. Use the
canonical project version; never derive it from a build number or rewrite
`18.4.1` as `18.41`.

For `detail`, **reuse the existing convention** already documented in
`references/entry-classification.md`: group several public fixes under a plain
`Bug Fixes` heading after larger entries, and keep one or two fixes as calm
outcome bullets near the end of the release section. Do not introduce a
competing format.

### Guardrails

Several of these already exist in `references/entry-classification.md`. Extend
the existing prose rather than duplicating it.

- A release with only dependency bumps, CI changes, refactors, tests, internal
  migrations, or developer tooling remains internal-only. (Existing rule near
  the "Refactors, tests, linting, formatting, dependency bumps, CI, build
  config" bullet.)
- A generic summary must not conceal a disclosure users need for access,
  payment, safety, privacy, legal/compliance, destructive migration, data loss,
  or a breaking public contract.
- Security-sensitive fixes may use restrained public wording, but the preference
  never authorizes exploit-enabling detail. (Extends the existing
  "Do not expose blame, embarrassing root causes…" rule.)
- Publicly distributed `0.x` products may use a generic summary when the user
  selects it, avoiding embarrassing root-cause detail while keeping release
  chronology visible.
- Private test builds and unreleased prerelease churn remain out of public
  history unless an established tester-facing destination and release train
  prove otherwise. (Existing initial-development/prerelease rules.)
- An expert archive promising a comprehensive public patch ledger continues to
  receive audience-relevant fix detail even when a compact surface skips
  maintenance-only releases, **and is never offered `omit`.** (Extends the
  existing "When an established public expert archive promises comprehensive
  patch notes…" rule; the `expert-release` fixture is the live example.)

---

## Compact Selection Algorithm

Implement the behavior conceptually as:

```ts
const scoped = releases.filter(matchesProductPlatformAudienceAndTrain);
const publiclyEligible = applyRoutineDisclosure(scoped);
const compactEligible =
  compactMaintenanceReleases === "include"
    ? publiclyEligible
    : publiclyEligible.filter((release) => !release.maintenanceOnly);

const visible =
  trigger === "automatic"
    ? newestFirst(compactEligible.filter(isUnseen)).slice(0, maxReleases)
    : newestFirst(compactEligible).slice(0, maxReleases);
```

The actual implementation must follow the target application's architecture and
language. Do not introduce a shared runtime package merely to copy this
pseudocode.

### Eligibility metadata

Prefer explicit structured metadata such as `maintenanceOnly: true` when the
project already has structured release-note data. Plain Markdown consumers may
classify a release as maintenance-only only after ignoring signature comments and
verifying that its eligible public content consists solely of the approved
maintenance summary or routine fix entries.

Do not infer maintenance status from version shape alone. A patch version can
contain a substantive or required disclosure, and a minor version can be
maintenance-only.

### Seen and dismissal state

- Track the newest presented release identity for each product/platform/train.
- When only skipped maintenance releases are newer, render nothing and do not
  open the automatic modal.
- When the unseen set exceeds the configured limit, show the newest eligible
  releases and treat older overflow as archive-only after dismissal.
- Retain manual access after dismissal.
- Keep a release's canonical identity even when version display is friendly or
  hidden.
- **Reconfiguration:** when the limit, disclosure mode, or maintenance
  visibility changes, do not treat previously filtered older releases as newly
  unseen. Leave the cursor where it is (invariant 15).
- **No archive:** when no archive destination exists, omit the overflow action
  instead of linking nowhere (invariant 16).

### Presentation budget

Each rendered release keeps its own version/date context and one to three
highlights. The modal remains height-bounded with internal scrolling. For a
custom count above 8, explicitly verify long-history behavior at small widths and
large text sizes.

---

## Persistence and Schemas

### Why all three values live in repository policy

The original plan split persistence: disclosure in `.simple-changelogs.json`,
compact settings in "the created surface's own configuration," with optional
mirroring into `.simple-changelogs-curation.json`. Both halves of that split are
replaced.

**The curation branch is removed.** `rg -n curation skills/` returns zero
matches: `CurationManifest`, `SurfaceDisplayPreferences`, `curation-source.ts`,
and `curation-manifest.schema.json` exist only under `tooling/`. No distribution
ships curation guidance, so a skill running in a user's repository has no
instruction to read or write a curation manifest and cannot record anything
there. The 2026-07-29 plan already settled this: *"Curation guidance is not
shipped in any distribution today… Do not route to a curation reference and do
not imply the curation capability exists."* Extending
`SurfaceDisplayPreferences` would add schema, validator, fixture, and
schema-parity churn for a code path nothing can reach.

**Surface-owned configuration is replaced by repository policy.** The repository
already has a precedent for exactly this kind of decision:
`newReleaseNoteSurfaceComponents` records which component library a generated
surface uses — a per-surface implementation choice — and it lives in
`.simple-changelogs.json`. Following it gives this feature, for free:

- `hasExactKeys` optional-key validation in `setup.ts`;
- JSON Schema validation in `repo-policy.schema.json`;
- `Selection` / `ApplyOptions` / `--flag` plumbing;
- `json.path` evaluation assertions such as
  `.simple-changelogs.json#/compactReleaseLimit`; and
- a durable value later runs can re-read.

Storing the limit inside a generated `whats-new.tsx` offers none of these. It
can only be asserted with a fragile `text.match` against a guessed path, and a
later skill run would have to parse an arbitrary TypeScript literal to recover
the user's choice.

**Accepted trade-off.** One repository stores one compact limit even if it has
both a Web and a Mobile compact surface. This matches
`newReleaseNoteSurfaceComponents`, which is likewise a single scalar covering
web and native surfaces. Per-surface deviation is handled by invariant 11:
established surface behavior outranks the stored default. If a repository later
needs genuinely per-surface limits, that is a separate change with its own
schema design — not a reason to scatter this one.

### Repository policy fields

Add three optional repository-specific fields to `.simple-changelogs.json`:

```json
{
  "routineReleaseDisclosure": "summarize",
  "compactReleaseLimit": 3,
  "compactMaintenanceReleases": "include"
}
```

- `routineReleaseDisclosure`: `summarize` | `detail` | `omit`
- `compactReleaseLimit`: integer, `minimum: 1`, **no maximum**
- `compactMaintenanceReleases`: `include` | `skip`

All three are optional forever, for backward compatibility. New customer-product
setup recommends `summarize` / `3` / `include`. When absent in an existing
repository, prospective guidance uses those defaults unless repository evidence
establishes different behavior; do not rewrite released history without separate
backfill authority.

Omit `compactMaintenanceReleases` entirely when disclosure is `omit`.

Keep all three out of:

- `GlobalPreferences`, `globalFor`, and `global-preferences.schema.json`;
- `skills/simple-changelogs-cms/schemas/repo-policy.schema.json` and
  `skills/simple-changelogs-web-cms/schemas/repo-policy.schema.json` (both
  describe the CMS policy `.simple-changelogs-cms.json`, which owns no product
  compact surface); and
- skill-repository setup.

### Setup helper

Canonical file: `tooling/simple-changelogs/scripts/setup.ts`. Mirror the
`crossSurfaceVersioning` implementation added by the in-flight work.

- [ ] Add `ROUTINE_RELEASE_DISCLOSURES` and `COMPACT_MAINTENANCE_MODES` const
      tuples beside `CROSS_SURFACE_VERSIONING_POLICIES`.
- [ ] Add the three optional fields to `RepoPolicy`, `Selection`,
      `OptionalSelectionKeys`, and `ApplyOptions`.
- [ ] Add all three to the optional-key list inside `validateRepoPolicy`'s
      `hasExactKeys` call, with `oneOf` guards for the two enums.
- [ ] Validate `compactReleaseLimit` with
      `Number.isInteger(value) && value >= 1`; reject `0`, negatives,
      fractions, and non-numbers with a specific error message.
- [ ] Serialize the fields in `repoPolicyFor` using the same
      `if (selection.x !== undefined)` pattern as
      `newReleaseNoteSurfaceComponents`.
- [ ] **New CLI parser required.** `parseCli` currently exposes only
      `enumValue`; every entry in `valueOptionNames` is a string or enum. Add an
      `integerValue` helper for `--compact-release-limit` that surfaces a clear
      parse error, then register the three flags:
      `--routine-release-disclosure`, `--compact-release-limit`,
      `--compact-maintenance-releases`.
- [ ] Add the three fields to `setup-result.schema.json` in **both**
      `$defs.repoPolicy` and `$defs.selection`. Both are
      `additionalProperties: false`; omitting either produces a confusing
      validation failure.
- [ ] Add them to `tooling/simple-changelogs/evals/schemas/repo-policy.schema.json`.
- [ ] **Gate the onboarding questions correctly.** Do **not** reuse
      `PRODUCT_SURFACE_DISTRIBUTIONS` for the new `unresolved` entries — it
      contains `"cms"`. Add a narrower
      `COMPACT_SURFACE_DISTRIBUTIONS = new Set(["full", "mobile", "web", "web-cms"])`
      and gate on it. Push
      `compact-release-window` and `routine-release-disclosure` into
      `unresolvedQuestions` **before** `released-history-audit`.
- [ ] Copy the canonical helper byte-for-byte to all six installable changelog
      distributions and verify with `shasum`.

### Update path for already-configured repositories

`applySetup` short-circuits through `preSetupResult`, which returns
`already-configured` and writes nothing when stored policy is valid. The
`crossSurfaceVersioningUpdate` branch proposed by the 2026-07-29 plan does not
exist yet.

**Decision: do not build an update path in this change.** The compact questions
fire when a compact surface is *created*, which is exactly when a repository is
either unconfigured or being explicitly reconfigured. Building a second
surgical update branch before the first one exists duplicates unproven design.

- [ ] If the 2026-07-29 `crossSurfaceVersioningUpdate` branch lands first,
      generalize it to accept these three fields rather than adding a parallel
      branch.
- [ ] Otherwise, document in `references/setup.md` that changing a stored
      compact preference in an already-configured repository is an explicit
      policy edit, verified by re-running `inspect`.

---

## Guidance and Distribution Changes

### Product guidance

Update these references in `simple-changelogs`, `simple-changelogs-web`,
`simple-changelogs-mobile`, and `simple-changelogs-web-cms`:

- `references/onboarding.md`
  - add the contextual prompts, skip conditions, and expanded receipt;
  - change the "show only the latest qualifying highlights" bullet and the
    "keep the compact summary at the latest qualifying release" sentence to the
    confirmed release-window behavior;
  - keep the released-history question last.
- `references/entry-classification.md`
  - add routine maintenance classification and the three disclosure modes;
  - extend, do not duplicate, the existing internal-only, expert-ledger,
    security, initial-development, and prerelease guardrails.
- `references/release-note-surfaces.md`
  - define destination-specific maintenance eligibility;
  - define automatic-unseen versus manual-recent behavior;
  - require filtering before limiting;
  - update the `## Summary Versus Full History` paragraph, which currently reads
    "Show the latest release by default; a manual compact view may include a few
    short recent releases." Manual multi-release is **already** permitted there;
    the change makes the count configurable and extends it to automatic views.
- `references/surface-design.md`
  - replace "show the latest qualifying release with one to three highlights" in
    `## Compact shape` and "Keep compact surfaces limited to the latest
    qualifying release" in `## Seed from canonical history`;
  - support multiple clearly separated release sections;
  - retain bounded scrolling and per-release highlight budgets;
  - test empty results after maintenance filtering.
- `references/automation-verification.md`
  - verify release count, filter order, seen state, scope isolation, archive
    preservation, and no maintenance-only auto-trigger when skipped.
- `references/setup.md`
  - document the three fields beside `crossSurfaceVersioning`, using the same
    "optional and accepts" prose shape.

Update the public Web portion of `web-cms`; do not apply customer wording to the
protected operator changelog. Keep CMS-only and skill-repository onboarding free
of these product questions.

**Do not edit `skills/simple-changelogs-cms/references/surface-design.md` or its
`onboarding.md`.** Both files participate in `distributions.check.ts` loops, but
CMS is out of scope here.

### Size budget

Measured 2026-07-30 via `bun tooling/distributions.check.ts`:

| Distribution | Bytes | Budget | Headroom |
| --- | --- | --- | --- |
| `simple-changelogs-web-cms` | 194,600 | 262,144 | ~66 KB |
| `simple-changelogs` | 190,488 | 262,144 | ~70 KB |
| `simple-changelogs-web` | 171,771 | 262,144 | ~86 KB |
| `simple-changelogs-mobile` | 171,763 | 262,144 | ~86 KB |

Headroom is comfortable. The budget is not a binding constraint on this change,
but re-run the check after editing six references across four distributions.

### Guidance versions

This is a prospective behavior change and warrants guidance-version bumps for the
four affected product distributions. Current values in the worktree:

- `full`: 9 → 10
- `web`: 8 → 9
- `mobile`: 8 → 9
- `web-cms`: 8 → 9

Re-read `GUIDANCE_VERSIONS` immediately before implementation and increment from
the then-current values rather than overwriting concurrent work. Add contiguous
`## Guidance N` entries explaining:

- the new default summary for customer-relevant maintenance;
- the detail and omit alternatives;
- the compact release-window choice;
- modal-specific maintenance inclusion or skipping; and
- the prospective-only effect on existing released history.

The contract requires exactly one `## Guidance N` heading for every integer from
1 to the declared current version.

Do not bump skill-repository or CMS guidance solely because the byte-identical
helper accepts the optional fields.

### Report codes

Add these canonical decision codes to
`tooling/simple-changelogs/evals/schemas/runner-response.schema.json`
(`$defs.evaluationReport/properties/decisionCodes`, alphabetical order) before
writing behavior cases — `manifest-coverage.check.ts` requires every asserted
code to appear there:

- `COMPACT_MAINTENANCE_INCLUDED`
- `COMPACT_MAINTENANCE_SKIPPED`
- `COMPACT_RELEASE_LIMIT_SELECTED`
- `ROUTINE_RELEASE_DETAILED`
- `ROUTINE_RELEASE_OMITTED`
- `ROUTINE_RELEASE_SUMMARIZED`

`ROUTINE_RELEASE_OMITTED` is deliberately distinct from the existing
`CUSTOMER_ENTRY_OMITTED`: the new code means "a whole maintenance-only release
was withheld by the `omit` disclosure preference," while the existing code means
"this change had no customer-facing outcome." Evaluation scenario 8 depends on
telling those apart. State the distinction in the guidance so the agent picks
correctly.

Reuse the existing `MODAL_DEPTH_REDUCED`, `SURFACE_CREATED`,
`SURFACE_AUTHORIZATION_REQUIRED`, and `SURFACE_COMPONENTS_SELECTED` codes; do
not duplicate them.

### Contract assertions

In `tooling/distributions.check.ts`, using the existing `collapsed()` helper:

- extend the `onboardingChecks` required-choice loop with the compact prompts —
  but **scope the new strings to the four product distributions only**, because
  that loop currently also covers `simple-changelogs-cms` and
  `simple-changelogs-skill-maintainer`;
- extend the `surfaceDesignSnapshots` loop similarly, excluding
  `simple-changelogs-cms`;
- require the filter-before-limit rule in `release-note-surfaces.md`;
- require the automatic-unseen versus manual-recent distinction;
- require the internal-only prohibition on fabricated maintenance copy;
- preserve all existing portability, duplicate-prose, routed-path, size, and
  authorization contracts.

`references/version-decisions.md` must remain byte-identical across the four
product distributions; this change should not touch it.

---

## Evaluation Scenarios

### Fixture strategy — corrected

The original plan preferred extending `surface-react-tailwind`. Measured
reality:

- `surface-react-tailwind` contains a two-release `CHANGELOG.md`
  (`1.1.0`, `1.0.0`), no `.simple-changelogs.json`, and one route. It is pinned
  to `behavior-surface-components-recommended` and
  `behavior-surface-components-minimal-markup`.
- `routed-app` is the real modal fixture: `whats-new-prototype.tsx`,
  `release-note-eligibility.ts`, `release-notes.json`, and a policy at guidance
  6. It is pinned to **nine** cases.

Neither has interleaved substantive and maintenance-only history. Rewriting
either one's changelog to add five or more mixed releases perturbs pinned cases
for no benefit.

- [ ] **Add one new fixture** `compact-release-window/`, modeled on
      `routed-app`, with a `CHANGELOG.md` whose newest releases interleave
      substantive and maintenance-only versions (for example `.19.0` substantive,
      `.18.6` maintenance-only, `.18.5` substantive, `.18.4` substantive,
      `.18.3` maintenance-only), plus one internal-only release used by scenario
      8. Include `release-notes.json` with `maintenanceOnly` flags so the
      structured-metadata path is exercised.
- [ ] Its `.simple-changelogs.json` must record `distribution: "full"` **and**
      `mobileReleaseNotePlacement`, or `validateRepoPolicy` reports it malformed
      at guidance 6+ and every case against it blocks.
- [ ] Reuse `multi-surface-monorepo` for cross-surface isolation and
      `routed-app` for the existing-surface-preserved scenario. Do not create
      fixtures for those.

### Conflicts with existing pinned cases

- `behavior-modal-depth-budget` (fixture `routed-app`) asserts
  `MODAL_DEPTH_REDUCED` for a modal rendering six release sections.
  `routed-app` stores no `compactReleaseLimit`, so the default of 3 applies and
  six sections still reduce. **The case remains valid.** Add a comment in the
  manifest recording why, and consider adding a
  `COMPACT_RELEASE_LIMIT_SELECTED` assertion so the default is proven rather
  than assumed.
- `behavior-modal-sequencing-eligibility` (fixture `routed-app`) asserts auth,
  age-gate, onboarding, returning-user, and dismissal terms in
  `src/release-note-eligibility.ts`. The new no-auto-trigger-when-skipped rule
  must not remove or rename those concerns. **Re-run this case explicitly** after
  editing `release-note-surfaces.md`.

### Cases to add

Consolidated from twelve to ten. Numeric validation moved out of model
evaluations into deterministic unit tests, where it is cheaper and stricter.

1. **`behavior-compact-surface-creation-recommended`** — no compact surface
   exists; the user authorizes one; onboarding offers latest/3/5/8/custom; the
   receipt records 3 with maintenance summaries; policy stores all three values.
2. **`behavior-compact-maintenance-skipped`** — mixed history, three releases,
   `skip`; the modal selects `.19.0`, `.18.5`, `.18.4`; intervening maintenance
   versions neither render nor consume slots; the full archive still contains
   their generic summaries.
3. **`behavior-compact-maintenance-included`** — same history with `include`
   renders maintenance summaries in canonical order and counts them.
4. **`behavior-compact-no-auto-trigger`** — automatic plus `skip`; the newest
   release is maintenance-only; the modal does not open and the prior
   substantive release is not re-shown as new.
5. **`behavior-compact-manual-versus-automatic`** — two turns: automatic uses
   unseen eligible releases, manual uses recent eligible releases, both filter
   before applying the same limit.
6. **`behavior-routine-disclosure-detailed`** — public history carries concise
   user outcomes under the existing `Bug Fixes` convention; developer-only
   mechanics stay private; modal inclusion follows the independent compact
   choice.
7. **`behavior-routine-disclosure-omitted`** — the maintenance-only release
   stays out of `CHANGELOG.md` and customer surfaces; its technical context
   remains in `DEVELOPER_CHANGELOG.md`; the compact-maintenance question is
   skipped and no `compactMaintenanceReleases` value is written.
8. **`behavior-internal-only-not-fabricated`** — CI/dependency/refactor-only work
   receives no generic public note even under `summarize`; asserts
   `CUSTOMER_ENTRY_OMITTED`, not `ROUTINE_RELEASE_OMITTED`.
9. **`behavior-compact-cross-surface-isolation`** (fixture
   `multi-surface-monorepo`) — a Mobile maintenance release does not fill a Web
   modal slot; Web and Mobile seen state stay independent.
10. **`behavior-compact-explicit-answer`** — "Create a manual modal showing five
    substantive releases and skip bug-fix-only releases" proceeds without asking
    those choices again; asserts `compactReleaseLimit: 5` and
    `compactMaintenanceReleases: "skip"`.

The custom-count density warning is covered inside case 10's prompt variant or
as an eleventh case only if the wording cannot be proven otherwise.

### Assertions to use

- `json.path` on `.simple-changelogs.json#/compactReleaseLimit`,
  `#/compactMaintenanceReleases`, and `#/routineReleaseDisclosure` for every
  persistence claim. This is the mechanism the surface-owned design could not
  offer.
- `text.match` / `text.notMatch` on `CHANGELOG.md` for disclosure wording.
- `text.notMatch` on the created surface for skipped maintenance versions.
- `file.unchanged` on the full archive when the modal skips releases.
- `report.decision` for each new code.

### Files to update

- `tooling/simple-changelogs/evals/cases.json`;
- `runner-response.schema.json` decision-code description;
- `manifest-coverage.check.ts` — add `compact-release-window` to `FIXTURE_IDS`,
  add all ten ids to `BEHAVIOR_CASE_IDS`, and move **both**
  `expect(ids).toHaveLength(68)` and `expect(new Set(ids).size).toBe(68)` to
  `78`. The `61` figure in the earlier draft was stale;
- `setup.check.ts` and `validate.check.ts`;
- `schema-parity.check.ts` for the two new enums;
- `tooling/distributions.check.ts` prose assertions.

`eval-manifest.schema.json` needs **no** change: `json.path`, `text.match`,
`text.notMatch`, `file.unchanged`, and `report.decision` all already exist.

---

## Task Checklist

Ordered so each stage is independently verifiable.

### 1. Data model and setup helper

- [ ] Add `ROUTINE_RELEASE_DISCLOSURES` and `COMPACT_MAINTENANCE_MODES`.
- [ ] Add the three optional fields to `RepoPolicy`, `Selection`,
      `OptionalSelectionKeys`, and `ApplyOptions`.
- [ ] Extend `validateRepoPolicy`'s `hasExactKeys` optional list and add
      `oneOf` plus positive-integer guards.
- [ ] Add the `integerValue` CLI helper and the three flags.
- [ ] Add `COMPACT_SURFACE_DISTRIBUTIONS` and the two new `unresolved`
      identifiers, placed before `released-history-audit`.
- [ ] Update `repo-policy.schema.json` and both closed objects in
      `setup-result.schema.json`.
- [ ] Keep the fields out of global preferences and both CMS policy schemas.
- [ ] Copy the canonical helper to every distribution and verify byte parity.

### 2. Classification guidance

- [ ] Add substantive / maintenance-only / internal-only classification.
- [ ] Add summarize, detail, and omit behavior, routing `detail` to the existing
      `Bug Fixes` grouping convention.
- [ ] Add the canonical `Bug fixes and improvements.` example.
- [ ] Extend — do not duplicate — the material-disclosure, expert-ledger,
      security, initial-development, and prerelease guardrails.
- [ ] Add the `omit`-is-unavailable-for-expert-ledger rule.

### 3. Surface onboarding

- [ ] Add the release-count prompt and custom-value validation, with a friendly
      note and **no** confirmation gate above 8.
- [ ] Add the routine public disclosure prompt, suppressing `omit` where a
      ledger promise exists.
- [ ] Add the independent compact maintenance include/skip prompt.
- [ ] Implement skip conditions and no-redundant-question behavior.
- [ ] Expand the confirmation receipt, naming `.simple-changelogs.json`.
- [ ] Keep the released-history question last.

### 4. Surface behavior and design

- [ ] Define scope → disclosure → maintenance visibility → seen state → limit
      ordering.
- [ ] Update automatic and manual selection rules.
- [ ] Define multi-release dismissal and overflow behavior, including the
      no-archive case.
- [ ] Add the non-retroactive reconfiguration rule.
- [ ] Update compact layout guidance for several release sections.
- [ ] Preserve archive, store, CMS, and cross-platform isolation.

### 5. Distribution and contract parity

- [ ] Apply guidance changes to full, Web, Mobile, and Web+CMS only.
- [ ] Leave skill-repository and CMS-only prompts untouched.
- [ ] Bump the four guidance versions from their then-current values.
- [ ] Add contiguous guidance-update entries.
- [ ] Add `distributions.check.ts` assertions using `collapsed()`, scoped to the
      four product distributions.
- [ ] Verify all installable distributions remain under 256 KB.

### 6. Evaluations

- [ ] Add the `compact-release-window` fixture with valid policy.
- [ ] Add the ten behavior scenarios.
- [ ] Assert policy JSON paths for every persisted value.
- [ ] Assert skipped maintenance releases neither render nor consume count.
- [ ] Assert generic summaries stay absent for internal-only releases.
- [ ] Assert full archive content is preserved when the modal skips releases.
- [ ] Re-run `behavior-modal-depth-budget` and
      `behavior-modal-sequencing-eligibility` and confirm both still pass.
- [ ] Update manifest coverage pins (`68` → `78`, both assertions) and
      schema-parity tests.
- [ ] Add deterministic unit tests rejecting `0`, `-1`, `2.5`, `"3"`, and `null`
      for `compactReleaseLimit`.

### 7. Verification

- [ ] Run targeted setup, validation, schema-parity, contract, distribution, and
      behavior tests.
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `bun run eval`
- [ ] `bun run check`, documenting any independently reproduced baseline failure
      rather than attributing it to this work.
- [ ] Mutation-check one new invariant: break filter-before-limit deliberately,
      confirm a test fails, restore.
- [ ] Re-read the diff and confirm no unrelated dirty work was modified —
      especially the 56 files already touched by the version-identifiers work.

### 8. Release history

- [ ] Use `gpt-5.6-sol` at medium reasoning effort to draft final public and
      developer release-note entries; fall back to Opus 5 at medium effort and
      name the model that wrote them.
- [ ] Record the customer-visible onboarding, transparency, and modal behavior
      under `Unreleased` in `CHANGELOG.md`.
- [ ] Record policy/schema/helper/evaluation mechanics in
      `DEVELOPER_CHANGELOG.md`.
- [ ] Add required raw-Markdown signatures without altering existing signatures.

---

## Open Decisions

These need a human answer only if the implementer disagrees with the stated
default.

1. **Single repository-wide `compactReleaseLimit`.** Resolved above in favor of
   one scalar matching `newReleaseNoteSurfaceComponents`. Revisit only if a real
   repository needs different Web and Mobile limits in the same change.
2. **No setup update path.** Resolved above: defer to the 2026-07-29
   `crossSurfaceVersioningUpdate` branch rather than building a parallel one.
3. **Six new decision codes.** `COMPACT_MAINTENANCE_INCLUDED` proves a default
   rather than a deviation and could be dropped to five. Keeping it makes
   scenario 3 assertable without relying on the absence of a code.

---

## Acceptance Criteria

The work is complete when:

- a user creating a missing compact customer Release Notes surface is asked for
  latest-only, 3, 5, 8, or a custom release count unless already answered;
- three is the recommended default;
- a custom value above 8 is accepted after a friendly note, with no clamp and no
  extra approval step;
- the user can summarize, detail, or omit customer-relevant routine releases,
  except where an established public ledger promise forbids `omit`;
- the user can independently include or skip maintenance-only releases in the
  compact surface;
- skipped releases are filtered before the release limit and consume no slots;
- automatic views use unseen eligible history and manual views use recent
  eligible history;
- maintenance-only releases do not trigger an automatic modal when skipped, and
  reconfiguration does not retroactively re-open one;
- internal-only releases never receive fabricated public maintenance copy;
- full archives, stores, platforms, audiences, and release trains remain
  independently scoped;
- all three durable choices are recorded in `.simple-changelogs.json` and proven
  by `json.path` assertions; and
- repository-native checks and evaluation cases pass with fresh evidence.
