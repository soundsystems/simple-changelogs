# Skill-Repository Version Decisions

Use repository evidence before recommending or changing a version: package
manifests, tags, published releases, changelog headings, distribution policy,
and release automation.

## SemVer

- Patch: compatible correction with no new public capability.
- Minor: compatible new behavior, distribution, CLI option, or schema
  capability.
- Major: breaking trigger, output, policy, schema, installation, or runtime
  contract that requires downstream migration.

`0.x` is initial development, not automatically a prerelease. A suffix such as
`-alpha.1`, `-beta.1`, or `-rc.1` identifies a SemVer prerelease. Follow another
published convention when repository evidence establishes it.

## Public-version authority

Classify all target-contained package outcomes together, then apply
`publicVersioning` to the actual delta. `ask` waits before release files or
manifest versions change; `automatic` selects and explains the exact version
but grants no publication, tag, or hosted-release authority. `unknown` always
blocks. Exact valid current direction wins. Public prereleases use the same
gate; unpublished development identifiers do not.

When `releaseTags` is set, a tag in its style counts as a released version,
and a version whose tag name a local tag on another commit already holds is
never selected: block with `invalid-version-direction` and `choose-version`.

## Version map

For release-bearing work, report each relevant source:

| Source | Role |
| --- | --- |
| Public changelog heading | Canonical user history |
| Developer changelog heading | Maintainer history |
| Root/package manifest | Published package identity |
| Packaged release-note copy | Read-only installed mirror |
| Distribution-specific manifest | Independent package only when proven |
| Tag or hosted release | Remote publication evidence |

Mark every source updated, already aligned, intentionally skipped, or blocked.
Do not change unrelated workspace packages or claim that a local version edit
was published.

When all skill distributions ship from one repository release, prefer one
version unless package metadata proves independent release trains.
