# Skill-Repository Release Lifecycle

Keep pending work under one `## Unreleased` section. After a release, leave
that heading empty instead of removing it: it anchors the next merge's prepend,
which otherwise files new entries into the newest released section.

## Release intent

Do not move entries into a released heading, change package versions, update
packaged notes, push tags, or create hosted releases from an ordinary
changelog-edit request. Establish the intended release boundary and version
from the current request or repository-native release process.

Release intent proves a boundary, not permission to choose its public version.
Classify aggregate target-contained impact and apply `publicVersioning`; leave
released headings and version fields unchanged while `ask` is unresolved.

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

## Curated Release Notes

When repository policy records `publicReleaseNotes: "curated"`, release
reconciliation also generates the proposed `RELEASE_NOTES.md` section derived
from the release's changelog entries and includes it in the existing release
receipt. One confirmation covers the release and its curated section; never
add a separate curation prompt. `references/curation.md` owns the derivation,
budget, coverage, and provenance rules.
