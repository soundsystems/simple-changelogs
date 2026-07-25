# Skill-Repository Release Lifecycle

Keep pending work under a nonempty `## Unreleased` section. Omit an empty
section; recreate it when new pending work appears.

## Release intent

Do not move entries into a released heading, change package versions, update
packaged notes, push tags, or create hosted releases from an ordinary
changelog-edit request. Establish the intended release boundary and version
from the current request or repository-native release process.

Before finalization:

1. Inspect both changelogs and the complete target-contained diff.
2. Confirm every pending entry is shipped by the intended revision.
3. Combine duplicates and separate adopter outcomes from developer context.
4. Resolve blockers rather than describing unshipped work as released.
5. Choose the heading format already established by the repository.
6. Update only versions and mirrors proven to belong to this package release.

## Mirrors

A packaged `CHANGELOG.md`, CLI release-note reader, README excerpt, or structured
release-note file is a mirror or curated view. Sync it from the released public
history and verify that `Unreleased`, developer notes, and HTML comments are
absent.

If multiple skill distributions share one repository version, reconcile all
selected package copies. Do not invent independent versions merely because the
repository has multiple `SKILL.md` directories.

## Merge and release boundaries

A merge into a default branch does not prove publication, and a passing generic
changelog check does not prove `Unreleased` was finalized. Re-read the target
branch after the final merge and report whether pending entries are empty,
intentionally deferred, or blocked.

Publishing packages, tags, hosted releases, or downstream forks remains a
separate authority boundary.
