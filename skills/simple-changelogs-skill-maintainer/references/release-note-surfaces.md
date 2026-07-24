# Skill-Repository Release Surfaces

The canonical public changelog is the durable user history. Other release-note
surfaces are mirrors or curated views, not independent sources.

## Read-only packaged notes

A CLI or installed skill may expose released public notes for its own package.
That reader must:

- default to a packaged released history so it works outside the source repo;
- omit `Unreleased`, developer history, and HTML signature comments;
- support an explicit version when useful;
- remain read-only on installed machines;
- require an explicit source-repository path for maintainer consistency checks.

Keep the packaged copy source-identical to the canonical released public
history. Generate or verify it during release work; do not silently read a
developer's unrelated checkout.

## Skills CLI discovery

Each selectable distribution gets one directory whose `SKILL.md` frontmatter
name matches that directory. The description should state both the positive
trigger and close negative boundaries because the Skills CLI and compatible
loaders surface that metadata during selection.

If a repository publishes multiple distributions, document a comparison and
exact `--skill` commands in the README. Do not require a separate repository
for each distribution unless ownership, release cadence, or versioning is
genuinely independent.

## Guidance versions

When the skill changes prospective behavior that could affect existing released
history, add a user-readable guidance entry and advance the declared version.
Explain the practical effect before asking once whether to audit older history.

Packaging, test-harness, or adapter-only changes do not automatically require a
guidance bump. Record those in developer history and public history only when
adopters gain a visible capability.

## Forks and releases

Record fork provenance beneath the fork title and verify the pinned upstream
commit before release. Preserve intentional downstream deltas while porting
applicable improvements.

Release preparation can update source files, package versions, and established
mirrors when authorized. Publishing packages, pushing tags, creating hosted
releases, or propagating maintained forks remains a separate authority boundary.
