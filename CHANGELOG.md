# Changelog

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
- Published the `simple-changelogs` skill for Skills CLI installs from GitLab.
