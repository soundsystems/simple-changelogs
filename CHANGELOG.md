# Changelog

## Unreleased

No unreleased changes.

## 2026-06-21

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
