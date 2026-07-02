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

## Pre-1.0 Products

For pre-`1.0.0` products, treat every `0.x.y` section as pre-release unless the
repo has an explicit public release contract. During that period:

- Do not treat every significant change as a major bump just because the product
  is still taking shape.
- Use `0.x.y` patch bumps for repairs, small UX improvements, compatible
  stabilization, and release-candidate cleanup that is worth publishing.
- Use `0.(x+1).0` minor bumps more often than post-`1.0.0` when the release adds
  a durable capability, changes product direction, reshapes a primary workflow,
  introduces a public surface, or changes an API/data contract before it is
  stable.
- Reserve `1.0.0` for an explicit stability, public contract, or launch
  milestone. Do not jump to `1.0.0` just because a pre-`1.0.0` feature feels
  large.
- When the repo treats pre-`1.0.0` minor bumps as compatibility-breaking
  boundaries, mention the break plainly in the changelog and developer
  changelog, but follow the repo policy instead of inventing a separate major
  scheme.
- Avoid customer-facing patch-note churn for hot fixes; roll durable product
  outcomes into the next meaningful release section instead.

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
