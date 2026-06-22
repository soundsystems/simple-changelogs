# Developer Changelog

## Unreleased

No unreleased changes.

## 2026-06-22

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
    from the GitLab URL.
  - Verified the Skills CLI can discover the skill from the public GitLab repo.
- Added bootstrap and git backfill guidance:
  - Documented how agents should create missing `CHANGELOG.md` and
    `DEVELOPER_CHANGELOG.md` files.
  - Added release-boundary, paginated-history, and batching instructions for
    backfills.
  - Added guidance to summarize outcomes instead of copying one entry per
    commit.
