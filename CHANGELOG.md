# Changelog

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
