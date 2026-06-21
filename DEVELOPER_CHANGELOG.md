# Developer Changelog

## Unreleased

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
    from the GitLab URL.
  - Verified the Skills CLI can discover the skill from the public GitLab repo.
- Added bootstrap and git backfill guidance:
  - Documented how agents should create missing `CHANGELOG.md` and
    `DEVELOPER_CHANGELOG.md` files.
  - Added release-boundary, paginated-history, and batching instructions for
    backfills.
  - Added guidance to summarize outcomes instead of copying one entry per
    commit.
