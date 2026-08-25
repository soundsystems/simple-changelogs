# Skill-Repository Major Releases

`major: automatic` removes only the version prompt at a proven package
boundary. It does not waive stable-major evidence, synthesis, migration
disclosure, prerelease handling, or publication authority.

For `1.0.0`, curate the durable skill product established during public `0.x`
development: supported workflows, stable boundaries, installation contract,
runtime requirements, and compatibility promise. Do not paste every earlier
entry or erase the detailed prerelease history.

For later majors, explain the transition from the latest stable line:

- new durable capabilities;
- removed or changed behavior;
- trigger, policy, schema, installation, or runtime incompatibilities;
- required downstream fork or consumer migration;
- deprecation and compatibility windows when proven.

A next-major branch name is supporting evidence, not release intent. Alpha,
beta, and release-candidate versions remain prereleases under the repository's
published convention and must not be mistaken for the stable major.

Treat a major-release name as presentation beside the canonical package
version, never as package identity. Resolve `majorReleaseNaming` from current
direction, repository policy, or the default `named`. When it is `named`,
propose a concise title grounded in the major's proven adopter outcome and
established skill vocabulary. Put the reviewed title directly below the version
heading, keep the real version and date visible, and include the proposal in the
release receipt. Avoid internal codenames and vague hype. `version-only` adds no
generated title. Preserve existing released names under either preference.

Automatic major-version selection does not approve the exact name or waive
release-note review. Minor releases require no name; patch releases use **Bug
Fixes & Improvements** with flat bullets as defined in
`references/entry-classification.md`.

Compact packaged notes summarize the major and link to full history when such a
link already exists. Release publication, tags, and fork propagation require
separate authority.

When repository policy selects curated public release notes, the derived
`RELEASE_NOTES.md` section for a stable major keeps the reviewed name beside
the real version and follows `references/curation.md` for its highlights,
rollup line, and coverage accounting.
