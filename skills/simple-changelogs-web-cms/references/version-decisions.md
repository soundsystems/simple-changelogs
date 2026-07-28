# Version Decisions

Use this reference before changing version headings, app/package versions, or
release-note version fields.

## Decision Questions

Before changing versions, answer:

1. Is the change customer-visible or operator-visible?
2. Is it shipped now, being prepared for release, or still internal work?
3. Which shipped surface changed: web, mobile, API, backend data, docs, package,
   CLI, integration, or multiple surfaces?
4. What durable impact changed: repair, polish, capability, workflow, contract,
   migration, or product direction?
5. Is the release a patch, minor, or major?
6. Do `CHANGELOG.md`, release-note data, and affected version fields agree?

Use semantic versioning unless the repo has a different published convention.

## SemVer Defaults

- Patch for fixes, compatibility-preserving repairs, narrow UX polish, small
  visible improvements, and stabilization that does not introduce a new durable
  capability or contract.
- Minor for new user-facing capabilities, meaningful workflow improvements,
  compatible API/data additions, important onboarding or trust improvements, or a
  few cohesive changes that significantly improve the user experience without
  breaking established expectations.
- Major for incompatible API, data, workflow, or package contract changes;
  removals or renames of established capabilities; migrations that users or
  operators must plan around; or an explicit new product era.

Use elapsed time only as batching context. It can justify grouping related small
changes into one release, but it must not decide the bump level.

Do not bump versions for DX-only work, tests, linting, formatting, refactors,
dependency bumps, migrations, or internal plumbing unless the shipped behavior
or published package contract changes.

## Web Production Release Identity

Every production Web deployment must resolve to one product release version.
Reuse an existing version only when the exact target revision was already
reconciled into that version and the current action is a retry, promotion, or
target repair of the same release. Otherwise select the next version before
production.

Target-contained `Unreleased` work must enter that version even when some items
belong only in developer history. A production target change with no
customer-facing note still receives the next patch release identity unless
repository policy documents another product-version convention. Do not create
an empty customer bullet to justify the version.

This release identity does not make every package manifest share the product
version. Continue to update only metadata proven to belong to the Web product
release, and leave deployment IDs, build numbers, independently versioned
packages, and remote-owned counters under their documented authorities.

If the current version, bump level, or product-version source cannot be resolved
from repository policy and release evidence, block production and ask for that
decision. Do not deploy an unversioned target and repair the history afterward.

## Initial-Development Products

SemVer uses `0.x.y` for initial development. It does not make those versions
pre-releases; a pre-release is identified by a suffix such as `-alpha`, `-beta`,
or `-rc.1`. Determine whether a `0.x` build is publicly distributed from local
release evidence.

During initial development:

- Use patch increments for repairs, small experience improvements, compatible
  stabilization, and publishable test-cycle cleanup.
- Use a minor increment when local convention treats it as the next capability
  or compatibility boundary. This commonly covers a durable feature, a primary
  workflow change, product direction, or an unstable API/data contract change.
- Reserve `1.0.0` for a documented stability, public-contract, or launch
  milestone; feature size alone does not establish that boundary.
- Follow repository policy when `0.x` minor increments may be incompatible and
  disclose the break plainly to affected customers and maintainers.
- Apply the initial-development disclosure rules in
  `references/entry-classification.md` when deciding which `0.x` outcomes get
  customer notes.

Before finalizing `1.0.0`, a later stable major, or a next-major prerelease,
follow `references/major-releases.md` for boundary detection and synthesis.

## Version Field Alignment

When preparing a release or doing explicit version-tracking work, keep the
changelog, release-note data, and app/workspace version fields aligned in the
same pass only after release intent and source-of-truth policy are clear:

- Treat any created, renamed, or edited released `CHANGELOG.md` section as
  version-tracking work unless local repo policy explicitly says the section is
  historical prose only. Do the audit even when the user only mentioned
  changelog or release-note copy.
- Find version fields with repo context first, then targeted searches such as
  `rg -n '"version"|appVersion|runtimeVersion|buildNumber|versionCode'`.
- Build a release metadata sync map before finalizing:
  - latest released `CHANGELOG.md` heading
  - latest release-note data version, such as `LATEST_RELEASE_NOTES`,
    `RELEASE_NOTE_SECTIONS[0]`, app store notes, marketplace notes, or equivalent
    generated feed
  - root package metadata when it is product-facing
  - app package metadata for affected web, mobile, desktop, extension, or CLI
    apps
  - mobile store metadata such as `app.json`, native marketing version,
    `versionCode`, `buildNumber`, or runtime version when local policy ties it
    to the product release
  - mobile store release-note metadata such as App Store Connect `What's New in
    this Version`, Google Play `What's new in this release?`, TestFlight notes,
    internal testing notes, Fastlane metadata, Play Console metadata, or EAS
    submit metadata when mobile release prep includes store submission
  - shared package metadata such as `packages/types`, SDK, API client, database,
    scraper, or integration package versions when those packages are part of the
    same released surface
  - repo-specific release docs, tests, CI checks, or lockfiles that enforce or
    document the same version relationship
- Update only affected app, package, or release-note version fields that local
  docs, config, tests, or release data identify as belonging to this release
  flow. Match the current changelog release heading unless the repo documents
  independent per-surface versioning.
- Handle routine version tracking end to end when release intent, shipped
  surface, and repo policy are clear. Do not ask for human approval just to align
  local changelog, release-note, app, or workspace metadata that is proven to be
  part of the same release flow.
- For repos with independent versioning, update only the fields the repo
  declares as product-facing or release-note-facing. Do not override deployment
  IDs, EAS/build numbers, Changesets, or package versions owned by a separate
  release flow.
- When a remote release system is the source of truth, run the repo's read-only
  verification command when available. If release prep requires changing remote
  metadata, do it only when the task asks for release prep and the repo documents
  the command; otherwise report the exact command and missing credential or
  release decision.
- Ask for help only when the version level, shipped surface, release timing,
  source-of-truth policy, or required remote credentials cannot be determined
  from local context.
- If policy is unclear, leave version fields unchanged, explain what evidence is
  missing, and avoid inventing a versioning relationship.
- Do not leave a proven affected workspace's current app/package metadata behind
  the changelog version just because the changelog text was already written.
- When a repo has a generated release-note feed and stable product metadata
  sources, prefer adding or updating a small repo-native version-consistency
  check so future agents cannot ship drift silently. Keep the check scoped to
  metadata that local policy proves should share a version; do not hard-fail
  independently versioned packages.
- In the final response, explain which version fields changed, which fields were
  already aligned, and which were intentionally skipped because of repo release
  policy. Use concrete file/field names, not a vague "versions are aligned"
  sentence.
