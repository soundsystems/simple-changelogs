# Major Releases

Use this reference for `1.0.0`, later stable major releases, next-major
development lines, and alpha, beta, or release-candidate trains.

## Establish the Boundary

Determine the repository's versioning convention and canonical version owner
from local docs, configuration, package metadata, release automation, and prior
releases. Use the repository's ecosystem parser or native version command when
available; do not force SemVer syntax onto another published convention.

Treat a stable major release as ready to finalize only when:

1. the canonical product version crosses to a higher major version;
2. the resulting version is stable rather than a prerelease;
3. explicit release intent or a documented release-bearing action exists; and
4. the affected product surface shares that version and release flow.

Treat names such as `v2`, `next`, and `release/2.x` as supporting evidence only.
A merge from one of those branches is not a major release when `main` is merely
an integration branch, the canonical version remains a prerelease, or the repo
publishes later from a tag, store submission, package release, or deployment.

Prepare major-release copy in the pull or merge request that establishes the
stable version when possible. At the documented release boundary, verify and
sync reviewed copy instead of creating unreviewed release notes after merge.

## Handle Prerelease Trains

Recognize prereleases using the repository's convention. Examples include
SemVer `2.0.0-alpha.1`, `2.0.0-beta.7`, and `2.0.0-rc.1`, plus PEP 440
`2.0a1`, `2.0b7`, and `2.0rc1`.

- Keep internal prerelease churn under `Unreleased` or in developer history.
- Give a publicly distributed preview its own clearly labeled preview notes
  when its testers need the visible outcomes.
- Do not finalize the stable major summary merely because a next-major branch
  merged or a prerelease was published.
- Preserve already-published prerelease headings as historical records. When
  the stable release arrives, synthesize the durable result without repeating
  every test-cycle fix or deleting public preview history.
- Consolidate unpublished internal prerelease entries into the stable release
  and omit superseded behavior, temporary workarounds, and stabilization noise.

## Synthesize from Evidence

Inspect the current product, the last stable release, relevant changelog and
developer-changelog sections, intervening prereleases, migration or deprecation
docs, and the diff between proven release boundaries. Current shipped behavior
wins over superseded historical claims.

For `1.0.0`, describe the documented stability, launch, or public-contract
milestone and curate the durable capabilities built during public `0.x`
development. Explain what the stable product now enables without pretending
that every capability first shipped in `1.0.0`. Keep the detailed `0.x` archive
intact.

For `2.0.0` and later, describe the transition from the latest stable prior
major line. Focus on new outcomes, changed behavior, removals, compatibility,
and required migration. Do not repeat unchanged product basics or summarize the
entire lifetime of the product.

For independently versioned products or packages, synthesize only the surface
whose canonical version crossed the stable major boundary.

## Shape the Outputs

Adapt to the repository's established format while covering the applicable
parts of this order:

1. a concise milestone or generational outcome;
2. a small set of feature-led customer highlights;
3. breaking changes, removed behavior, and who is affected;
4. concrete migration or upgrade actions; and
5. one authorized route to detailed history when useful.

Keep technical implementation and maintainer migration context in
`DEVELOPER_CHANGELOG.md`. Keep the customer summary scannable; comprehensive
means complete coverage of durable outcomes and required action, not an
exhaustive concatenation of prior bullets.
