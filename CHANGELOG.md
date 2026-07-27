# Changelog

## Unreleased

- Publishing now distinguishes preserved baseline state from active external
  work. Dirty or unrelated original checkouts and pre-existing worktrees,
  commits, or proposals stay untouched but do not block publication through an
  independent remote-default worktree. External ownership requires new activity
  observed after the baseline or a live claim on the exact target; ownership is
  rechecked before mutation, exact handoff is still required for active work,
  and finished reports separate published results, preserved baseline details,
  and genuinely outstanding targets.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T09:13:11-05:00" -->
- Across all six packaged distributions, onboarding now asks before adding a
  short Simple Changelogs pointer to an existing agent-instruction file such as
  `AGENTS.md` or `CLAUDE.md`. It follows the scope you already picked: a
  per-repository setup offers that repository's instruction file, while an
  all-projects setup offers your global one, so a single instruction file is
  updated once instead of once per project, and a run-only setup writes nothing.
  A global pointer names no specific changelog tool, so it stays correct in
  projects that use a different one. The pointer records when the changelog
  decision is due, requires the outcome even when no entry is needed, and names
  the owning distribution without copying its rules; rerunning onboarding
  updates an existing pointer in place.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T02:42:34-05:00" -->
- Publishing now preserves branches, worktrees, and merge or pull requests
  owned by another active agent, task, or person. Broad requests to ship,
  integrate, or prune do not transfer that ownership: mutation requires an
  exact explicit handoff, ownership is rechecked immediately beforehand, and
  preserved work is listed with the authority still needed.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T02:11:26-05:00" -->
- Setup now always offers release-note archive and latest-release surface
  choices in full, web, mobile, web+CMS, and CMS-only repositories, even when
  no candidate route exists; declining leaves product and operator UI
  unchanged.
- Existing component systems are detected and kept automatically. Otherwise,
  setup asks once whether to use the named Web or native recommendation,
  preserve existing Radix primitives, choose another library, or add no
  component dependency. The confirmation receipt names every dependency and
  separately lets users seed approved archives from complete eligible history,
  choose a narrower scope, or decline seeding.
- Bundled Web, mobile, and operator design guidance now covers presentation,
  theming, accessibility, responsive containment, reduced motion, long and
  empty histories, and server-rendering defects for every authorized surface.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T01:38:30-05:00" -->
- App onboarding now treats Updates, News, Blog, Announcements, and
  release-note-named routes as candidates to verify instead of assuming they
  are release archives. First-time apps can choose a Release Notes tab or
  section, a dedicated Release Notes page, or no archive, while returning-user
  apps can separately opt into an automatic latest-release modal linked to the
  archive. Customer-facing destinations default to “Release Notes”; protected
  developer, admin, and operator history defaults to “Changelog” unless product
  evidence or the user selects another name.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-27T00:26:33-05:00" -->
- Recommended onboarding now includes a comprehensive initial backfill of every
  historic change from the oldest trustworthy evidence through setup across all
  six Simple Changelogs distributions. The final history question offers only
  defer or decline opt-outs, and confirming the setup receipt starts the
  default without separate “Review it now” approval.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-26T23:37:21-05:00" -->
- First-time setup now offers a short recommended or customized onboarding
  conversation, records confirmed repository or solo-developer preferences,
  leaves read-only work untouched, and resumes the original changelog task
  after setup.
- The full distribution now asks where mobile-specific release history belongs
  on the web and derives independently scoped Web and Mobile feeds from one
  canonical history, without treating that placement choice as permission to
  create new product UI.
- Publishing now treats compatibility paths that resolve to the same physical
  skill package as one installation, avoiding false duplicate-install warnings
  while retaining every logical alias in the inventory.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-26T16:16:12-05:00" -->
- Setup now records the current guidance version for each selected distribution,
  and the full distribution requires an explicit mobile release-note placement
  before writing repository policy.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-26T17:15:35-05:00" -->
- Publishing a skill update now reaches every local install of that skill
  instead of one chosen validation repository. The workflow discovers each
  consumer, applies its retention mode, and reinstalls consumers concurrently
  so a single failure no longer hides the others.
<!-- simple-changelogs-signature agent="Claude Opus 5" at="2026-07-25T11:40:26-05:00" -->
- Release-note curation now uses stable, scoped presentation maps that preserve
  chronological changelogs as the source of truth, record continuation and
  overlapping revisit history, and prevent completed reorganizations from
  silently dropping or duplicating notes.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-24T00:39:25-05:00" -->
- Simple Changelogs now offers six mutually exclusive distributions: full,
  CMS-only, web-only, mobile-only, web+CMS, and the lean
  `simple-changelogs-skill-maintainer` distribution for repositories that
  develop or publish agent skills. Repository policy and install metadata select
  one owner so overlapping changelog workflows stop before writing.
- Each selected distribution is now self-contained and approximately 24–87 KB,
  with package-shape and real Skills CLI consumer checks verifying the installed
  boundary.
- The CMS-only distribution now includes the current upstream behavior while
  retaining its runtime validator, and fork synchronization follows each fork's
  provenance to compare the correct upstream distribution.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-23T20:53:07-05:00" -->
- The evaluation package now supports Grok Build as an optional runtime, with
  isolated execution and the same provider-neutral response contract used by
  other adapters.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-23T18:01:31-05:00" -->
- Durable UI and interaction polish now stays in the full customer changelog
  when it provides useful product history, while compact release-note surfaces
  continue to show only material highlights.
<!-- simple-changelogs-signature agent="Codex" at="2026-07-16T12:48:48-05:00" -->
- Skill updates can now be published end to end through maintained forks and a
  real consumer installation, with package integrity and merged release state
  verified before completion.
<!-- simple-changelogs-signature agent="gpt-5.6-sol" at="2026-07-16T12:52:00-05:00" -->
- Changelog setup now keeps one portable `.simple-changelogs.json` policy in
  each repository, reuses clear audit permission from the current request, asks
  only when the choice remains open, and never records an unanswered setup
  choice.
- New release-note modals, routes, screens, panels, and navigation links now
  require an explicit request or documented repository permission. One-off
  answers do not silently become an ongoing repository preference.
- Version guidance now distinguishes SemVer's `0.x` initial-development phase
  from prerelease versions that use a suffix such as `-beta.1`.
- Fork maintenance now ships with the skill and reports current, behind,
  invalid, and divergent provenance pins consistently.
- A runnable, provider-neutral evaluation package now checks contracts and
  isolated behavior through optional or third-party adapters, rejects
  caller-supplied command execution, and constrains bundled model adapters to
  their temporary fixtures.
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T20:23:26-05:00" -->
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T20:31:35-05:00" -->
<!-- simple-changelogs-signature agent="GPT-5" at="2026-07-09T21:31:39-05:00" -->
- Repository policy now supports single-changelog repositories and optional
  attribution:
  - `developerChangelog: "optional"` keeps only `CHANGELOG.md` and preserves
    technical context in commit or merge-request descriptions instead.
  - `signatures: "none"` disables signature comments for a repository, and a
    signature is never written when neither the agent identity nor the
    timestamp is actually available.
- Installed packages no longer contain extra discoverable `SKILL.md` files:
  evaluation fixtures now store theirs as `SKILL.fixture.md`, so recursive
  skill loaders cannot mistake a test decoy for the real skill.
<!-- simple-changelogs-signature agent="Claude Fable 5" at="2026-07-14T08:59:29-05:00" -->
- Added major-release guidance (guidance version 3):
  - `1.0.0` notes now curate the durable product established during public
    `0.x` development, while later majors summarize the transition from the
    prior stable line, including breaking changes and required migration.
  - Next-major branches, integration-branch merges, and alpha, beta, or
    release-candidate versions are no longer mistaken for the stable major
    release, and published prerelease history stays intact.
  - Prerelease detection now follows the repository's published convention,
    including PEP 440 versions such as `2.0a1`, not just SemVer suffixes.
<!-- simple-changelogs-signature agent="Claude Fable 5" at="2026-07-14T14:12:57-05:00" -->

## 2026-07-08

- Clarified fork activation precedence:
  - Repo-local forks of this skill should supersede globally installed upstream
    `simple-changelogs` copies for that repo.
  - Agent harnesses should deduplicate by the fork provenance pin so the local
    fork and global upstream skill do not both classify or write changelog
    updates for the same task.
  <!-- Agent: GPT-5 Codex | 07/08/2026 12:39 PM CDT -->

## 2026-07-07

- Added one-time guidance backfill prompts:
  - Skill updates can now ship with a removable notice that asks whether to
    audit and update existing released changelogs and release-note surfaces
    against the new guidance.
  - The notice is removed after an approved, completed backfill or an explicit
    opt-out, while deferred or incomplete audits remain visible for the next
    changelog task.
  <!-- Agent: GPT-5 Codex | 07/07/2026 2:48 PM CDT -->

## 2026-07-06

- Added guidance-driven backfill guardrails:
  - Agents now distinguish safe drift repairs from destructive or
    meaning-changing released-history edits.
  - Existing released notes can be synced, filled from source, or moved between
    public and developer surfaces when information is preserved, while deleting,
    materially rewording, collapsing, or changing release boundaries requires
    explicit operator permission.
  <!-- Agent: GPT-5 Codex | 07/06/2026 2:04 PM CDT -->

- Tightened release-bearing merge guidance:
  - Agents now get an explicit merge reconciliation checklist for public default
    branches and other release-bearing targets.
  - The skill now warns that a generic changelog check can pass while
    `Unreleased` still needs to be moved into a released section.
  <!-- Agent: GPT-5 Codex | 07/06/2026 11:05 AM CDT -->

- Clarified visible-copy changelog pruning:
  - The skill now tells agents that visible wording, labels, helper text,
    modal text, marketing copy, and tone polish do not need customer-facing
    changelog entries merely because users can see them.
  - Copy changes still get customer notes when the wording materially changes
    access, legal/compliance promises, payment or shopping identity behavior,
    safety/trust requirements, or durable user capabilities.
  <!-- Agent: GPT-5 Codex | 07/05/2026 11:30 PM CDT -->

- Improved fork maintenance guidance:
  - Forked project skills now get a documented provenance pin so upstream
    improvements can be reviewed and ported without overwriting intentional
    project-specific behavior.
  - Added a helper workflow for checking whether a downstream skill fork is
    behind upstream.
  - Internal release-note filters now get clearer guidance for preserving
    matching nested details and auditing dropped developer changelog entries.
  <!-- Agent: GPT-5 Codex | 07/05/2026 8:01 AM CDT -->

- Improved skill maintenance guardrails:
  - The skill now keeps detailed changelog rules in focused references so agents
    load a shorter `SKILL.md` body for routine changelog work.
  - Final verification now has a dedicated automation reference for checkable
    rules such as empty `Unreleased` sections, hidden signature comments, and
    release metadata alignment.
  - Eval coverage now guards the skill against overlong descriptions,
    duplicated reference rules, and checklist drift.
  <!-- Agent: GPT-5 Codex | 07/04/2026 11:58 AM CDT -->

- Improved "What's New" surface handoff guidance:
  - Skills CLI installs now package the skill from `skills/simple-changelogs/`
    so supporting eval and reference files ship with the skill.
  - Install docs now call out the default-branch install command and the
    explicit Git ref form for branch or tag installs.
  - Release prep now defaults to adding a visible in-app release-notes or
    "What's New" surface for apps with returning users when no equivalent
    surface already exists.
  - Existing reachable release-note surfaces are updated instead of duplicated.
  - Monorepos now get clearer guidance to keep web, mobile, admin, developer,
    and portal release-note surfaces scoped to their own audiences.
  - Mobile-only release notes now default to a mobile modal, sheet, route, or
    screen instead of being crowded into a web What's New modal.
  - Existing admin, developer, dashboard, analysis, and portal areas can now get
    one internal release-note surface that pulls filtered backend and operations
    updates from `DEVELOPER_CHANGELOG.md`.
  - Internal admin/developer release-note surfaces now use `Release Notes` as
    the visible UI label and ignore hidden agent signature comments when
    rendering from `DEVELOPER_CHANGELOG.md`.
  - Release-note sync guidance now tells agents to ignore hidden signature
    comments before rendering generated customer-facing or internal release
    notes.
  <!-- Agent: GPT-5 Codex | 07/01/2026 2:41 PM CDT -->
  - Major-release "What's New" surfaces now favor a concise summary,
    scannable highlights, and one clear full-changelog action.
  - Apps without an existing public changelog source now get guidance to add a
    real changelog route or page for full history instead of using one growing
    modal as the archive.
  <!-- Agent: GPT-5 Codex | 07/01/2026 3:06 PM CDT -->
  - Release-note modals now get a content-depth budget: latest release by
    default, current major or last few short releases only while readable, and a
    full changelog route for older history.
  - Internal admin/developer release notes now prefer a dedicated `Release Notes`
    route or panel for full technical history while keeping any admin modal
    short.
  <!-- Agent: GPT-5 Codex | 07/01/2026 3:43 PM CDT -->
  - Auto-shown release-note modals now wait until after higher-priority auth,
    age-gate, consent, onboarding, payment, safety, account-recovery, or
    migration flows.
  - Pre-release fix guidance now tells agents to check whether the affected
    feature was already announced and revise still-unreleased entries instead of
    creating duplicate fix announcements.
  - Post-`1.0.0` releases with multiple public fixes now group them under a
    `Bug Fixes` heading after larger release-note entries.
  - Customer-facing entries now use the minimum detail needed to communicate the
    change, while major feature launches and workflow overhauls include enough
    detail for users to understand what changed and how to use it.
  - Policy, terms, privacy, and legal-document updates now get terse one-line
    guidance when users only need to know the document changed.
  - Feature launch notes now name the user-facing concept instead of internal
    implementation details, with grouped bullets when several user actions or
    benefits matter.
  - First-time feature launch notes now name the new capability and say what
    users can do, instead of framing a brand-new action as "easier" or
    "improved."
  - Raw changelog edits now get hidden agent signature comments with model and
    timestamp attribution near the changed entry or group.
  <!-- Agent: GPT-5 Codex | 06/30/2026 6:50 PM CDT -->
  - Customer-facing release notes now use a public detail budget that keeps
    clone-enabling mechanics out of public changelogs while preserving enough
    product detail for users to understand major launches.
  <!-- Agent: GPT-5 Codex | 07/01/2026 10:45 PM CDT -->
  - Released changelog sections now trigger a release metadata sync audit so
    release-note data, app/package metadata, store metadata, and relevant package
    versions do not drift silently.
  - Final responses for release-version work now need a concrete version map
    showing which metadata sources were updated, already aligned, or
    intentionally skipped.
  <!-- Agent: GPT-5 Codex | 07/02/2026 1:30 AM CDT -->
  - Mobile store release prep now gets dedicated guidance for App Store,
    Google Play, TestFlight, internal testing, and marketplace release notes.
  - Store release notes now stay mobile-scoped, concise, non-promotional, and
    included in the release metadata version map when store submission is in
    scope.
  <!-- Agent: GPT-5 Codex | 07/02/2026 1:50 AM CDT -->
  - Developer changelog source-link guidance now stays provider-neutral across
    pull and merge request workflows.
  - New release-note surfaces should be linked from a natural app location such
    as a footer, menu, help area, settings, or public changelog page.
  - React or TSX apps without stronger local conventions now get a clearer
    naming nudge toward public-facing release-notes or What's New components.
  - New in-app release-note surfaces now add a short top-of-file comment
    pointing future agents to local changelog, release-note, or "What's New"
    guidance.
  - Developer changelog cleanup now moves useful replaced technical notes into a
    bottom-of-section `Superseded` area instead of leaving obsolete entries mixed
    into active history.
  - Added eval coverage so release prep creates or wires the right visible
    surface, scopes platform/internal notes correctly, sequences modals after
    higher-priority flows, and avoids re-announcing already promised behavior.

## 2026-06-22

- Improved the skill's structure and regression coverage:
  - Detailed backfill, entry classification, release lifecycle, versioning, and
    "What's New" guidance now lives in focused reference files so agents load
    only the detail needed for the current task.
  - Trigger wording now avoids generic deploys, package bumps, commit summaries,
    UI work, and code review unless the task explicitly relates to changelog,
    release-note, or release version handling.
  - Added eval prompts for trigger precision, customer/developer classification,
    hot-fix omission, release finalization, version alignment, and hidden
    release-note surfaces.
  - Manual install docs now copy the reference files and eval prompt pack along
    with `SKILL.md`.

- Tightened pre-1.0 repair omission rules:
  - Agents now avoid advertising embarrassing baseline defects that should
    already work, such as broken login, checkout crashes, or missing saved data,
    as public product news during pre-1.0 releases.
  - Pre-1.0 repair notes now need a material trust, access, safety, payment,
    compliance, onboarding, or durable capability reason before appearing in
    customer-facing changelogs.
- Added public-safe post-1.0 fix wording:
  - Patch release notes now describe user-visible repair outcomes without
    exposing blame, embarrassing root causes, incident details, or sensitive
    implementation internals.
  - Technical context for maintainers is directed to developer changelogs,
    pull or merge request notes, and incident records instead of customer-facing
    changelogs.
- Added release-safety guardrails:
  - Agents now need explicit release intent before moving entries out of
    `Unreleased`, syncing release-note surfaces, or changing version fields.
  - Version synchronization now only applies to fields proven by local repo
    evidence to belong to the same release flow.
  - Hidden, disabled, preview, prototype, and internal-only surfaces no longer
    count as customer-facing release-note surfaces just because code exists.
  - Creating a new in-app "What's New" surface now requires an explicit task or
    documented repo release policy.
- Simplified empty `Unreleased` handling:
  - Agents are now told to omit `Unreleased` entirely when there are no pending
    changes instead of leaving placeholder text.
  - After release finalization, empty `Unreleased` sections are removed from both
    customer and developer changelogs.
  - New pending work recreates `## Unreleased` at the top of the changelog before
    the first released heading.
- Clarified release-finalization triggers:
  - Production and public deployments now explicitly move shipped entries out of
    `Unreleased` before deploying, even when no branch merge is involved.
  - Pull and merge request prep now checks whether existing `Unreleased` entries
    are already on a release-bearing target branch and reconciles them before
    opening new work.
  - Release-bearing branch guidance is provider-neutral, covering default,
    production, protected release, and direct-consumption public repo branches
    without depending on a specific forge.

## 2026-06-21

- Clarified copy-update changelog rules:
  - Routine copy edits, typo fixes, grammar fixes, tone tweaks, label wording,
    placeholder text, and microcopy polish now stay out of customer changelogs
    unless they materially change what users understand, decide, can access,
    must trust, or are legally promised.
  - Copy and content changes now have clearer inclusion guidance for user
    understanding, trust, legal/compliance meaning, pricing, purchase decisions,
    onboarding/setup, error recovery, permissions/access, and support
    obligations.
- Clarified default-branch release boundaries:
  - Public repos that users install, read, or consume directly from the default
    branch now get clearer guidance to treat pushes and merges to that branch as
    shipped releases.
  - Agents are now told to move shipped entries out of `Unreleased` before
    pushing, merging, publishing, or deploying.
- Improved "What's New" hierarchy guidance:
  - Agents are now told to make headline capabilities easier to scan than minor
    updates by grouping major feature bullets above narrow fixes.
  - App release-note surfaces should keep small polish and repair notes lower
    priority so they do not visually compete with launch-level work.
- Tightened customer changelog rules for visual hot fixes:
  - Narrow visual fixes now stay out of customer-facing changelogs unless they
    change a durable user capability, trust or safety behavior, access, shopping
    flow, or a broadly noticeable UX surface.
  - The customer impact gate now asks agents to look for durable or broadly
    noticeable user impact before writing user-facing notes.
- Clarified version bump guidance:
  - Version changes are now based on shipped impact, compatibility, release
    boundaries, and repo policy instead of calendar dates or implementation
    duration.
  - Pre-1.0 projects now get clearer guidance to use minor bumps for durable
    product direction, workflow, public surface, or contract changes without
    treating every significant change as a major release.
  - Patch, minor, major, and pre-1.0 decisions now have clearer criteria that
    should work as defaults while remaining easy for teams to customize.

## 2026-06-18

- Added explicit version-sync guidance:
  - Agents are now told to find and update affected app, package, and
    release-note version fields in the same pass as release changelog work.
  - Repos with independent release policies now get a clear exception for
    deployment IDs, EAS/build numbers, Changesets, and separately versioned
    package flows.
  - Final responses should explain which version fields changed, which were
    already aligned, and which were intentionally skipped.
- Generalized the README wording so the skill is described as agent-neutral,
  while keeping Cursor install commands as examples.
- Expanded the install examples for Codex, Claude Code, Cursor, all-agent CLI
  installs, and common manual skill directories.
- Fixed the README so changelog file names, install commands, and manual copy
  paths render correctly after the root-level skill layout change.
- Clarified that agents should handle routine version tracking themselves when
  release intent and repo policy are clear, escalating only for ambiguous release
  decisions or unavailable remote credentials.

## 2026-06-17

- Added clearer first-run changelog setup:
  - Agents are now told to create `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md`
    when they do not exist yet.
  - Git-history backfills now include guidance for tags, release boundaries,
    batching, and conservative summaries.
- Published the `simple-changelogs` skill for Skills CLI installs from the
  hosted repository.
