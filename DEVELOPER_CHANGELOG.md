# Developer Changelog

## 2026-07-06

- Added guidance-driven released-history backfill rules:
  - Routed policy/guidance backfill work through `references/backfill.md`.
  - Defined automatic drift repairs for source-to-generated sync, missing
    generated-surface entries, clear public-to-developer note relocation,
    unambiguous metadata alignment, and empty `Unreleased` cleanup.
  - Defined permission-gated edits for released note deletion, material
    customer-facing rewording, entry collapsing, release boundary changes,
    small public outcome removal, and ambiguous reclassification.
  - Added eval coverage so future skill edits preserve the operator-permission
    gate for destructive or meaning-changing released-history cleanup.
<!-- Agent: GPT-5 Codex | 07/06/2026 2:04 PM CDT -->

- Added release-bearing merge reconciliation safeguards:
  - Added a required merge workflow checklist to
    `references/release-lifecycle.md` so agents inspect target-branch
    `Unreleased` entries before and after release-bearing merge batches.
  - Updated final verification guidance to require an explicit final statement
    about whether `Unreleased` is empty or intentionally still pending.
  - Added eval coverage for the exact failure mode where an agent opens focused
    pull or merge requests, merges them into a public default branch, and misses
    existing target-branch `Unreleased` entries.
<!-- Agent: GPT-5 Codex | 07/06/2026 11:05 AM CDT -->

- Tightened copy-change classification:
  - Added SKILL and `entry-classification.md` guidance that obvious visible
    copy edits are excluded from `CHANGELOG.md` by default unless the wording
    itself materially changes access, legal/compliance, payment identity,
    safety/trust, or durable capability behavior.
  - Extended the routine-copy eval expectations so modal, helper, placeholder,
    label, and marketing copy changes do not regress into customer-facing
    changelog noise.
<!-- Agent: GPT-5 Codex | 07/05/2026 11:30 PM CDT -->

- Added fork-sync maintenance support:
  - Added `references/fork-maintenance.md` and routed downstream fork creation,
    editing, and sync tasks to it from `SKILL.md`.
  - Added `scripts/check-fork-sync.sh` to read a fork provenance pin and report
    upstream skill commits and changed files since that pin.
  - Added README and eval coverage for fork provenance pins, upstream syncs, and
    preserving intentional fork deltas.
  - Tightened internal release-note filter guidance so mixed parent and nested
    entries are handled separately and checked against the real developer
    changelog vocabulary.
<!-- Agent: GPT-5 Codex | 07/05/2026 8:01 AM CDT -->

- Refactored the skill body for progressive disclosure:
  - Shortened the frontmatter description to trigger and negative-trigger
    conditions.
  - Reduced duplicated customer-impact, public-detail, and final-verification
    prose in `SKILL.md`.
  - Added `references/automation-verification.md` as the single exhaustive
    final-review and checkable-rule reference.
  - Added eval coverage for skill maintenance regressions around description
    bloat, duplicated reference rules, and checklist drift.
<!-- Agent: GPT-5 Codex | 07/04/2026 11:58 AM CDT -->

- Updated `SKILL.md`, `references/release-note-surfaces.md`, and `EVAL.md` so
  release prep defaults to creating or wiring a visible release-note surface for
  apps with returning users when no equivalent exists, while explicitly avoiding
  duplicate surfaces when a reachable equivalent already exists.
- Moved the distributable skill into `skills/simple-changelogs/` and updated
  manual install docs so Skills CLI installs include `EVAL.md` and
  `references/` alongside `SKILL.md`.
- Clarified Skills CLI install docs so default-branch installs use the simple
  source URL and branch or tag installs use an explicit `.git#<ref>` source.
- Added guidance for linking new release-note surfaces from natural app
  locations, preferring clear public-facing React/TSX component names when no
  stronger local convention exists, and keeping a concise top-of-file guidance
  comment on newly created surfaces.
- Added monorepo release-note surface scoping guidance for separate web, mobile,
  admin, developer, dashboard, analysis, and portal surfaces, including internal
  surfaces that pull filtered backend/operations updates from
  `DEVELOPER_CHANGELOG.md`.
- Updated internal release-note surface guidance so UI labels use
  `Release Notes` and parsers skip hidden raw-changelog signature comments when
  rendering from `DEVELOPER_CHANGELOG.md`.
- Added release-note sync guidance and eval coverage so generated customer and
  internal release-note surfaces ignore hidden signature comments before
  rendering.
<!-- Agent: GPT-5 Codex | 07/01/2026 2:41 PM CDT -->
- Added major-release surface guidance so "What's New" modals use summary and
  highlights while a canonical changelog route, docs page, or external release
  source carries full history.
- Added eval coverage for apps that need a real changelog route instead of an
  ever-growing modal archive, including single-action full-changelog linking.
<!-- Agent: GPT-5 Codex | 07/01/2026 3:06 PM CDT -->
- Added release-note depth-budget guidance so auto-shown modals default to the
  latest release, compact manual surfaces cap at readable recent history, and
  full history moves to a canonical route or page.
- Added internal admin/developer guidance and eval coverage for full `Release
  Notes` routes or panels fed from `DEVELOPER_CHANGELOG.md`, with short modals
  linking to the full internal history when needed.
<!-- Agent: GPT-5 Codex | 07/01/2026 3:43 PM CDT -->
- Added release-note modal sequencing and eligibility guidance so auto-shown
  notes wait for auth, returning-user state, and higher-priority gates before
  appearing.
- Added public detail-budget guidance and eval coverage so customer-facing
  changelog, release-page, app-store, email, and in-app "What's New" copy keeps
  clone-enabling mechanics, hidden heuristics, security-control details, private
  vendor details, and roadmap sequencing out of public notes.
<!-- Agent: GPT-5 Codex | 07/01/2026 10:45 PM CDT -->
- Added release metadata sync-audit guidance to `SKILL.md`,
  `references/version-decisions.md`, and `EVAL.md` so released changelog section
  edits require a concrete version map across changelog, release-note,
  app/package, store, and relevant package metadata sources.
<!-- Agent: GPT-5 Codex | 07/02/2026 1:30 AM CDT -->
- Added mobile store release-note guidance to `SKILL.md`,
  `references/release-note-surfaces.md`, `references/version-decisions.md`, and
  `EVAL.md` so App Store, Google Play, TestFlight, internal testing, and
  marketplace notes are scoped to mobile users, respect store constraints, and
  appear in release metadata version maps.
<!-- Agent: GPT-5 Codex | 07/02/2026 1:50 AM CDT -->
- Added explicit pre-release fix guidance to check prior announcements, revise
  still-unreleased entries instead of adding duplicate fix notes, and group
  multiple post-`1.0.0` public fixes under `Bug Fixes`.
- Added `entry-classification.md` guidance for minimum necessary customer
  detail, terse policy/terms/privacy/legal-document notes, major feature launch
  detail, user-facing feature naming, pruning non-product-news changes, and
  provider-neutral pull or merge request source links.
- Tightened first-time feature launch wording so new capabilities use a feature
  name plus what users can now do, reserving `easier`, `clearer`, `better`, and
  `improved` framing for changes to existing flows.
- Added hidden raw-changelog signature guidance for agent edits, including model
  name/version, local timestamp, placement, generated-data exclusions, and
  rendered-public-note constraints.
<!-- Agent: GPT-5 Codex | 06/30/2026 6:50 PM CDT -->
- Added `Superseded` developer changelog guidance for useful obsolete technical
  notes, including when to delete noise, when to preserve replacement history,
  and how to strike through only the replaced claim at the bottom of the same
  release section.
- Added eval coverage for terse policy/terms updates and detailed major feature
  launches.
- Added eval coverage for developer changelog entries superseded by newer
  implementation decisions.

## 2026-06-22

- Restructured `SKILL.md` for progressive disclosure:
  - Replaced the monolithic root instructions with a concise core workflow and a
    task-to-reference loading table.
  - Added `references/backfill.md`,
    `references/entry-classification.md`,
    `references/release-lifecycle.md`,
    `references/version-decisions.md`, and
    `references/release-note-surfaces.md`.
  - Preserved the existing release-finalization, hot-fix, SemVer, and "What's
    New" rules in focused reference files instead of loading all detail for every
    activation.
- Added `EVAL.md` with should-trigger/should-not-trigger queries and behavior
  cases for visible features, developer-only migrations, copy edits, pre-1.0 hot
  fixes, post-1.0 fixes, release-bearing branches, non-release pull or merge
  request prep, and hidden release-note surfaces.
- Tightened the frontmatter description to scope version and deploy-related
  triggers to changelog, release-note, or release version handling.
- Updated `README.md` manual install commands so reference files and `EVAL.md`
  are copied with `SKILL.md`.

- Tightened pre-`1.0.0` customer changelog omission rules in `SKILL.md`:
  - Added explicit guidance to keep embarrassing baseline defects that should
    already work out of user-facing pre-release changelogs.
  - Added examples for omitted pre-1.0 repairs, including broken login,
    checkout crashes, and missing saved data.
  - Updated verification coverage so agents exclude those repairs unless they
    meet the material-impact gate and can be framed without advertising the
    defect.
- Added post-`1.0.0` public bug-fix framing rules in `SKILL.md`:
  - Added examples that convert raw regression, metadata, and query-failure
    descriptions into user-outcome changelog bullets.
  - Added verification coverage to keep blame, embarrassing root causes,
    incident details, and sensitive implementation internals out of public
    changelog and "What's New" copy.
  - Directed maintainer-only root-cause detail to `DEVELOPER_CHANGELOG.md`,
    pull or merge request notes, or incident records.
- Added release-intent and surface-visibility guardrails in `SKILL.md`:
  - Added a release-intent gate before entries move out of `Unreleased`, version
    fields change, or release-note surfaces sync.
  - Split non-release pull/merge request and handoff behavior from release
    finalization behavior.
  - Required local evidence before treating a branch as release-bearing.
  - Tightened version metadata updates so only fields proven to belong to the
    same release flow are changed.
  - Added guidance that named apps, hidden routes, previews, prototypes,
    disabled features, and internal-only tools are not customer-facing without
    evidence of real user or operator visibility.
- Updated `README.md` trigger language to avoid activating the skill for generic
  deploys, commit summaries, or UI work that is not tied to changelog or
  release-note coverage.
- Tightened empty `Unreleased` section handling in `SKILL.md`:
  - Added lifecycle guidance to omit `Unreleased` when no pending entries exist.
  - Added release-finalization guidance to remove empty `Unreleased` headings
    from both changelog files after shipped entries move into a released section.
  - Added verification coverage so agents check that `Unreleased` exists only
    when it contains pending entries.
- Tightened the public `simple-changelogs` lifecycle guidance:
  - Replaced forge-specific release wording with provider-neutral hosted release
    language.
  - Added release-bearing target branch checks for default, production,
    protected release, and direct-consumption public repo branches.
  - Added explicit production/public deployment and later pull/merge request
    reconciliation triggers for moving shipped `Unreleased` entries into
    released changelog, release-note, version, and developer changelog sections.

## 2026-06-21

- Tightened copy-update guidance in `SKILL.md`:
  - Added frontmatter and customer changelog rules that exclude routine copy,
    typo, grammar, tone, label, placeholder, and microcopy edits unless they
    materially change user understanding, access, trust, legal/compliance
    meaning, pricing, setup, or error recovery.
  - Added a verification check for copy-only customer changelog bullets.
- Tightened the changelog entry lifecycle guidance in `SKILL.md`:
  - Added default-branch release guidance for public skill repos, package docs,
    static changelog pages, and release-note data consumed directly from the
    branch.
  - Clarified that shipped entries should be moved out of `Unreleased` before
    pushing, merging, publishing, or deploying.
- Tightened the `Release Notes And What's New` guidance in `SKILL.md`:
  - Added explicit hierarchy rules so headline capabilities group above narrow
    fixes in app "What's New" surfaces and public release-note pages.
  - Added a verification check that major feature groups stand out above minor
    fixes before finalizing changelog or release-note work.
- Tightened the `Customer Changelog` and hot-fix guidance in `SKILL.md`:
  - Added explicit exclusion language for narrow visual hot fixes unless they
    affect durable capability, trust/safety behavior, access, shopping flow, or a
    broadly noticeable UX surface.
  - Updated the frontmatter description and customer impact gate so skill
    triggering and execution both carry the narrower customer-facing threshold.
- Tightened the `Version Decisions` section in `SKILL.md`:
  - Added an explicit rule that elapsed time, date changes, branch duration, and
    commit count are batching context only, not version bump signals.
  - Replaced the short SemVer bullets with a more detailed patch/minor/major
    rubric based on user impact, compatibility, contract changes, migrations,
    and product direction.
  - Added pre-1.0-specific guidance for when to use `0.x.y` patch bumps,
    `0.(x+1).0` minor bumps, and `1.0.0`, while deferring to repo policy for
    teams that model pre-1.0 breaking boundaries differently.
- Updated `README.md` to describe smart version bump decisions as a core skill
  behavior.

## 2026-06-18

- Expanded release version tracking guidance in the `simple-changelogs` skill:
  - Agents now search for affected app, package, and release-note version fields
    during explicit version-tracking or release-prep work.
  - Added guidance for repos that use independent release systems such as
    deployment metadata, EAS/build numbers, Changesets, or package-specific
    version flows.
  - Final summaries now need to explain changed, already-aligned, and
    intentionally skipped version fields.
- Updated README phrasing from Cursor-specific skill language to agent-neutral
  language while preserving Cursor as one install example.
- Added explicit Codex, Claude Code, Cursor, and all-agent install examples to
  the README, plus common manual install paths.
- Fixed README code spans and command blocks after the root-level `SKILL.md`
  flattening so the public docs no longer omit file names, runners, or copy
  paths.
- Tightened the version-tracking instructions so agents own local version
  alignment and only escalate for unclear SemVer/surface decisions, source-of-
  truth policy, release timing, or missing remote credentials.

## 2026-06-17

- Published the skill in the canonical Skills CLI catalog layout:
  - Moved the skill to `skills/simple-changelogs/SKILL.md`.
  - Added README install commands for `bunx skills add` and `pnpx skills add`
    from the hosted repository URL.
  - Verified the Skills CLI can discover the skill from the public hosted
    repository.
- Added bootstrap and git backfill guidance:
  - Documented how agents should create missing `CHANGELOG.md` and
    `DEVELOPER_CHANGELOG.md` files.
  - Added release-boundary, paginated-history, and batching instructions for
    backfills.
  - Added guidance to summarize outcomes instead of copying one entry per
    commit.
