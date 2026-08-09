# Release Version Identifiers and Cross-Surface Versioning Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.
> Preserve unrelated work already present in the worktree. Use a `gpt-5.6-sol`
> subagent with medium reasoning effort for customer and developer release-note
> wording produced while implementing this plan, as required by this
> repository. If that model at medium effort is unavailable in the runtime, use
> Opus 5 at medium effort and state which model wrote the notes.

> **Audit note (2026-07-29):** This plan was verified against the working tree
> and revised. Verified accurate: current guidance versions (full 8, mobile 7,
> web 7, web+CMS 7, skill-maintainer 5, CMS 1), all listed reference paths,
> `## Version Field Alignment` as the correct insertion anchor,
> `PROTOCOL_VERSION = 1`, and the absence of any protocol reference in bundled
> `agents/openai.yaml` files. Corrected or filled: the
> `canonical-release`/`public-version` semantic overlap, the missing setup
> update path, three closed version-map expectation definitions, missing report
> codes, fixture-variant structure, two pinned test registries, a live bundled
> schema drift, whitespace-fragile contract checks, `VERSION_CONSISTENCY`
> semantics, and the true scope of the Task 1 prose edit.

**Goal:** Teach Simple Changelogs to distinguish public release versions,
internal build identifiers, development versions, and optional release names;
reconcile each according to its actual role; and safely support shared,
independent, or mixed Web and Mobile release trains in monorepositories.

**Architecture:** Keep the public release version as the default
customer-facing chronology key for each release train. Treat build numbers and
development identifiers as linked release evidence rather than alternate
public versions. Add one optional repository policy that records whether
product surfaces share versions, version independently, or use a documented
mixture. Extend the evaluation report's version map with identifier semantics
so one file can report several version fields without implying equality.

**Tech Stack:** Markdown skill guidance, Bun 1.3.13, TypeScript 7,
`bun:test`, JSON Schema draft 2020-12, Biome 2.5 through Ultracite, and the
existing adapter-driven evaluation harness.

## Confirmed Product Decisions

| Question | Decision |
| --- | --- |
| May Web and Mobile versions vary in one monorepo? | Yes. A monorepo proves shared source ownership, not a shared release train. |
| Is independent versioning the universal default? | No. Preserve the relationship proven by repository policy, release automation, documentation, and released history. |
| Does equal current version text prove a shared train? | No. Separately owned fields can temporarily contain the same value. |
| Does one unequal snapshot prove independent trains? | No. Prefer released history, separate tags/workflows, or explicit policy before classifying the relationship. |
| When should the skill ask? | Only when multiple public version owners exist, their relationship remains ambiguous after inspection, and the current write depends on that relationship. |
| Should it ask whether divergence is “okay” every release? | No. Ask one precise relationship question, persist the answer, and reuse it. |
| Safe behavior while unresolved | Do not synchronize or bump ambiguous version fields. Copy may be drafted, but release finalization remains blocked on the exact relationship or target version. |
| Public chronology key | The public release version for that release train, unless the repository has another documented public convention. |
| Build identifiers | Track and report separately. Never use them to choose a SemVer bump or public changelog heading. |
| Friendly release names | Optional presentation labels. They never replace the canonical public version in native or store metadata. |
| Store descriptions | Attach them to the submitted public version, but do not repeat the version number in the copy unless local style requires it. |
| iOS and Android | They may share a Mobile release train or release independently. Inspect and preserve the proven relationship rather than assuming either. |

## Terminology

Use these names consistently in skill prose, schemas, reports, fixtures, and
final handoffs:

- **Canonical release version:** The version that owns chronology for one
  release train. In a shared train, several product surfaces mirror it. In an
  independent train, it is canonical only for that product or platform.
- **Public version:** The user-visible app version. On Apple platforms this is
  represented by `CFBundleShortVersionString`; on Android it is `versionName`.
  Apple also calls its value the marketing version. In this guidance,
  “marketing version” never means a friendly campaign name.
- **Build number:** A submission or installation-order identifier such as
  Apple `CFBundleVersion`, Android `versionCode`, an EAS build number, or a
  repository-defined CI build. It can map to a public release without matching
  that release's text.
- **Development version:** A prerelease, branch, package, commit-derived, or
  CI identifier such as `3.2.0-rc.4+abc123`. It is public only when repository
  evidence proves that the prerelease itself is publicly distributed.
- **Release name:** Optional public presentation such as `Summer Update`. It
  may accompany a public version but is not a version source of truth.
- **Release train:** A set of artifacts and destinations that share one
  release boundary and canonical release version.
- **Version owner:** The file, remote system, release workflow, or documented
  source that authoritatively supplies one identifier.

Example:

```text
Mobile public version: 3.2.0
iOS build number:      1842
Android version code:  1842
Development version:   3.2.0-rc.4+abc123
Optional release name: Summer Update
Web public version:    6.7.0
```

This is valid when Web and Mobile are independent release trains. It is not
version drift merely because the public numbers differ.

### Canonical release versus public version

These two identifier roles overlap in the common case, so the rule is
mechanical rather than judgmental:

- Exactly one record per release train carries `canonical-release`. It is the
  chronology owner — normally the released `CHANGELOG.md` heading, or the
  release manifest or generated feed the repository documents as the source of
  truth for that train.
- Every artifact field that is expected to reproduce that value carries
  `public-version`, even when it is the only user-visible version for its
  train. An independent Mobile train therefore reports its changelog heading as
  `canonical-release` and `expo.version` as `public-version`.
- When no changelog heading or manifest owns the train — for example a
  store-only request that touches no canonical source — report the proven
  public version field as `public-version` and omit `canonical-release` rather
  than promoting an artifact field to chronology owner.

This yields a testable invariant: **at most one `canonical-release` record per
`releaseTrain` value.**

## Non-Negotiable Invariants

1. **A monorepo does not imply shared versioning.** Shared source, a shared
   changelog, a shared date, or one Git commit is insufficient evidence that
   all product versions must match.
2. **Alignment means relationship, not string equality.** Only fields proven
   to mirror the same public release version are equality-checked.
3. **Build identifiers never drive public chronology.** A larger build number
   does not cause a public version bump or released changelog section.
4. **Current equality is weak evidence.** Two separately owned version fields
   containing `3.2.0` remain separately owned until stronger evidence joins
   them into one train.
5. **Ambiguity never authorizes mutation.** If the relationship cannot be
   proven, leave affected version fields unchanged and ask before finalizing
   the release.
6. **The answer is durable.** Once the user confirms a shared, independent, or
   mixed relationship, store it in repository policy so routine releases do
   not ask again.
7. **A policy does not invent a version map.** `mixed` and `independent`
   permit distinct trains but still require repository evidence to identify
   the version owner for each affected release.
8. **Store copy stays public and mobile-scoped.** Build numbers, CI identifiers,
   private codenames, and internal prerelease suffixes remain out of App Store
   and Play Store descriptions unless an established testing-track audience
   explicitly needs them.
9. **Release names are presentation-only.** A friendly label may be rendered
   beside a public version but cannot overwrite native metadata, store version
   fields, changelog version headings, or version-consistency checks.
10. **No unrelated version bump.** Independent Web, Mobile, iOS, Android,
    package, API, CMS, desktop, and extension trains stay untouched unless the
    release includes them.
11. **One chronology owner per train.** At most one version-map record per
    release train carries `canonical-release`.
12. **Cross-surface policy is repository-scoped.** `crossSurfaceVersioning`
    belongs to `.simple-changelogs.json` only — never global preferences, and
    never the CMS policy schemas.

## Evidence and Decision Flow

Use the following evidence order before touching version fields:

1. Explicit `.simple-changelogs.json` policy.
2. Repository instructions and release documentation.
3. Release scripts, CI workflows, tag conventions, store submission
   configuration, and generated metadata ownership.
4. Released changelog headings, hosted releases, store history, and version
   history across more than one release.
5. Imports or generators showing several destinations consume one canonical
   version source.
6. Current version values in app and package files.

The first five can establish a relationship. Current values alone usually
cannot.

### Proven shared train

Proceed without asking when evidence shows one canonical version feeds the
affected Web and Mobile artifacts, one release command publishes them
together, or repository policy explicitly selects shared versioning. Update
only mirrors that belong to the active release.

### Proven independent trains

Proceed without asking when Web and Mobile have separate released histories,
tags, workflows, store schedules, or explicit policy. Releasing Mobile must not
bump Web merely to match it, and releasing Web must not rewrite Mobile store
metadata.

### Proven mixed relationship

Proceed from the documented map. For example, iOS and Android may share the
Mobile public version while Web remains independent. “Mixed” requires local
evidence identifying each shared subgroup; the policy value alone is not a
complete map.

### Ambiguous relationship

Ask exactly once when a release-bearing write depends on the answer:

> Web and Mobile have separate version fields, but the repository does not
> establish whether they share a release version. Should they use one shared
> public version, version independently, or follow a mixed relationship already
> documented elsewhere?

Recommend **independent** only when separate product/store cadences are present
and no shared release mechanism exists. Recommend **shared** when a single
release mechanism is evident but its version ownership is undocumented.

While waiting:

- leave public versions, build numbers, tags, and released headings unchanged;
- do not label the mismatch as drift;
- provide draft release copy only if its target release and audience are still
  known; and
- name the exact files or remote fields whose relationship remains unresolved.

After the answer, record it and resume the original release task without asking
the user to repeat the request.

## Repository Policy

Add one optional repository-only field:

```json
{
  "crossSurfaceVersioning": "independent"
}
```

Supported values:

- `shared` — all product surfaces covered by the policy mirror one canonical
  public release version unless a narrower repository rule explicitly excludes
  a surface.
- `independent` — each documented release train owns its public version and may
  advance without the others.
- `mixed` — the repository contains both shared and independent relationships;
  local release configuration or documentation must identify the groups.

Rules:

- The field is optional forever. Absence means “inspect, then ask only if a
  consequential ambiguity remains.”
- Do not add it to global preferences. Version relationships are
  repository-specific.
- Do not add it to `skills/simple-changelogs-cms/schemas/repo-policy.schema.json`
  or `skills/simple-changelogs-web-cms/schemas/repo-policy.schema.json`. Despite
  the filename, both describe the CMS policy (`.simple-changelogs-cms.json`),
  which owns no app version.
- Do not infer and persist a value merely from equal or unequal current strings.
- An explicit answer to the relationship question authorizes recording the
  selected value.
- Existing valid policies remain valid after the schema change.
- The setup helper accepts the field during apply and during an explicit update
  of already-valid policy, but never adds a universal onboarding question.

## Version Map Contract

Keep the existing artifact `role`—`source`, `mirror`, `package`,
`application`, or `store`—and add semantic identifier information. `field` does
not exist today; this change introduces it alongside `identifierRole` and
`releaseTrain`.

Example:

```json
{
  "path": "apps/mobile/app.json",
  "field": "expo.version",
  "version": "3.2.0",
  "role": "application",
  "identifierRole": "public-version",
  "releaseTrain": "mobile"
}
```

```json
{
  "path": "apps/mobile/app.json",
  "field": "expo.ios.buildNumber",
  "version": "1842",
  "role": "application",
  "identifierRole": "build-number",
  "releaseTrain": "ios"
}
```

Add these `identifierRole` values:

- `canonical-release`
- `public-version`
- `build-number`
- `development-version`

`identifierRole` is required for every reported version-map record. `field` is
optional for headings and destinations without a named field. `releaseTrain`
is optional for a repository with one unambiguous train and required by skill
guidance whenever more than one train is involved.

Do not place release names in the version map. They are presentation metadata,
not versions. Report an established release name in the destination summary
and show the underlying public version separately.

### Three expectation definitions move in lockstep

The evaluation side of the version map is defined in three closed places. Each
rejects unknown keys, so missing one produces a confusing “expectation did not
parse” failure rather than a schema error:

1. `tooling/simple-changelogs/scripts/lib/validate.ts` — `versionMapExpectation`
   uses `objectOf({...})`, which rejects unlisted keys.
2. `tooling/simple-changelogs/evals/schemas/eval-manifest.schema.json` —
   `$defs.versionMapExpectation` sets `additionalProperties: false`.
3. `tooling/simple-changelogs/scripts/lib/fixtures.ts` — `versionMapExpectation`
   calls `isRecordWithOnlyKeys(value, ["path", "role", "version"])`, and the
   `report.versionMap` matcher below it compares only the three current
   properties.

The response-side record is defined in
`tooling/simple-changelogs/evals/schemas/runner-response.schema.json`
(`$defs.versionMapRecord`, `additionalProperties: false`,
`required: ["path", "version", "role"]`) and in `VersionMapRecord` in
`tooling/simple-changelogs/scripts/lib/types.ts`.

### Protocol bump decision

Making `identifierRole` required invalidates existing version-map response
objects, so bump `PROTOCOL_VERSION` from 1 to 2.

The alternative — leaving `identifierRole` optional and enforcing it only
through skill guidance and manifest assertions — was considered and rejected:
an optional field that reports are expected to always carry is a field that
silently goes missing. The bump is safe because the protocol is maintainer-only:
`PROTOCOL_VERSION` appears solely in `lib/types.ts`, `lib/validate.ts`,
`lib/model-eval.ts`, `scripts/tests/schema-parity.check.ts`, and the two runner
schemas. No bundled skill file and no `skills/*/agents/openai.yaml` references
it, so installed packages are unaffected.

## Display Rules

`SURFACE_VERSION_DISPLAYS` (`exact`, `friendly`, `hidden`) exists in
`tooling/simple-changelogs/scripts/lib/types.ts` for the curation manifest.
Curation guidance is **not** shipped in any distribution today, so define this
behavior inside the already-bundled surface references. Do not route to a
curation reference and do not imply the curation capability exists.

- `exact` — show the canonical public version as stored.
- `friendly` — apply an established presentation treatment such as adding
  “Version” or omitting an unhelpful prefix. It must preserve the underlying
  public version and must not substitute a build number, development version,
  or release name.
- `hidden` — do not render the version on that surface. The canonical version
  remains in source data and release reports.

An established surface may show `Summer Update · Version 3.2.0`. Store
description copy normally omits both because the store already supplies the
version context. Preserve established product style when it intentionally
includes a release name.

## Verification Semantics

Redefine the existing `VERSION_CONSISTENCY` verification code rather than
adding a new one:

- It passes when every proven mirror inside each affected release train agrees
  with that train's canonical release version.
- It never requires equality across trains.
- It never compares a build number or development version against a public
  version.
- It reports `not-run` when the relationship is unresolved, because an
  unresolved relationship has no defined expectation to check.

## Report Codes

`manifest-coverage.check.ts` requires every asserted report code to appear in
`runner-response.schema.json`'s canonical code descriptions. Add these before
writing the behavior cases:

Decisions:

- `VERSION_RELATIONSHIP_REQUIRED` — a release-bearing write is blocked pending
  the shared/independent/mixed answer.
- `VERSION_RELATIONSHIP_RECORDED` — the explicit answer was persisted.
- `INDEPENDENT_TRAIN_PRESERVED` — an unrelated train was deliberately left
  unchanged.
- `BUILD_IDENTIFIER_REPORTED` — a build or development identifier was reported
  without affecting public chronology.
- `RELEASE_NAME_PRESENTED` — a friendly label was rendered beside a canonical
  public version.

Reuse the existing `STORE_NOTES_UPDATED`, `VERSION_SYNCED`, and
`VERSION_CONSISTENCY` codes; do not duplicate them.

## Distribution Scope

| Distribution | Change |
| --- | --- |
| `simple-changelogs` | Full identifier-role, shared/independent/mixed, Web/Mobile, store, and version-map guidance |
| `simple-changelogs-mobile` | Full identifier-role guidance, including independent iOS/Android trains and store metadata |
| `simple-changelogs-web` | Identifier-role and independent-train guidance for multiple Web apps/packages; retain the boundary that it does not own Mobile/store copy |
| `simple-changelogs-web-cms` | Identifier-role guidance for the Web product and any separately versioned authorized operator surface; do not treat CMS history as a product version without evidence |
| `simple-changelogs-cms` | No behavior change; CMS history does not gain app-version ownership |
| `simple-changelogs-skill-maintainer` | No mobile/store behavior change; its package-specific version rules remain separate |

`references/version-decisions.md` is currently byte-identical across the four
product distributions and deliberately different in
`simple-changelogs-skill-maintainer`. Update the four together and leave the
skill-maintainer copy alone. Keep surface-specific prose in each
distribution's `references/release-note-surfaces.md`.

## Implementation Tasks

### Task 1: Add identifier roles to version guidance

**Files:**

- `skills/simple-changelogs/references/version-decisions.md`
- `skills/simple-changelogs-mobile/references/version-decisions.md`
- `skills/simple-changelogs-web/references/version-decisions.md`
- `skills/simple-changelogs-web-cms/references/version-decisions.md`

The existing `## Version Field Alignment` section already permits independent
per-surface versioning, already tells the agent to leave fields unchanged when
policy is unclear, and already warns against overriding EAS/build numbers owned
by a separate flow. Do not rewrite it. Its actual defects are narrow:

- its release metadata sync map lists `versionCode`, `buildNumber`, and runtime
  version among fields to “match the current changelog release heading,” which
  invites matching a build identifier to a public version;
- it has no identifier taxonomy;
- it has no monorepo rule; and
- it has no durable relationship question.

A surgical edit also protects the size budget and the prose-duplication
contract.

- [ ] Insert a **Version identifier roles** section immediately before
  `## Version Field Alignment`.
- [ ] Define canonical release, public, build, and development versions using
  the terminology in this plan, including the one-`canonical-release`-per-train
  rule.
- [ ] Amend the sync-map bullets so build numbers, version codes, and runtime
  versions are tracked and reported as linked evidence, never matched to the
  changelog heading.
- [ ] State that equality checks apply only to mirrors of one canonical public
  version.
- [ ] Explicitly prohibit deriving public SemVer from build numbers.
- [ ] Require a release-train map before finalizing a multi-product or
  multi-platform release.
- [ ] Add the evidence hierarchy and shared/independent/mixed decision branch.
- [ ] Add the ambiguity behavior: leave fields unchanged, ask one precise
  question, record the answer, and resume.
- [ ] Add the monorepo rule and the weak-evidence rule for current equality.
- [ ] Preserve existing rules for independently versioned packages,
  prereleases, remote sources of truth, and release authorization.
- [ ] Keep the four copies byte-identical; verify with `shasum` before moving on.

### Task 2: Clarify public copy and release-name behavior

**Files:**

- `skills/simple-changelogs/references/release-note-surfaces.md`
- `skills/simple-changelogs-mobile/references/release-note-surfaces.md`
- `skills/simple-changelogs-web/references/release-note-surfaces.md`
- `skills/simple-changelogs-web-cms/references/release-note-surfaces.md`
- `skills/simple-changelogs/references/surface-design.md`
- `skills/simple-changelogs-mobile/references/surface-design.md`
- `skills/simple-changelogs-web/references/surface-design.md`
- `skills/simple-changelogs-web-cms/references/surface-design.md`

These eight files are **not** identical across distributions; each carries
deliberate scope boundaries. Edit each in place rather than copying one version
over the others.

- [ ] State that App Store and Play Store descriptions belong to a submitted
  public version even when their files contain only copy.
- [ ] Keep build numbers, `versionCode`, CI identifiers, internal prerelease
  suffixes, and private codenames out of public store copy.
- [ ] State that store copy normally does not repeat the version already shown
  by the store.
- [ ] Define optional release names as presentation labels rather than version
  owners.
- [ ] Define `exact`, `friendly`, and `hidden` version display using the rules
  in this plan, without changing the enum and without routing to any curation
  reference.
- [ ] Preserve platform and audience scope: Web notes cannot inherit a Mobile
  release merely because one canonical history contains both.
- [ ] Preserve the Web distribution's prohibition on creating or updating
  Mobile/store destinations, and keep mobile-only vocabulary out of the
  web-only copies.
- [ ] Re-run the contract suite after editing: these files are subject to
  `IMPLICIT_UI_CREATION`, so any sentence pairing a surface noun with a
  creation verb needs prohibition or explicit-authorization phrasing.

### Task 3: Add durable cross-surface version policy

**Canonical implementation files:**

- `tooling/simple-changelogs/scripts/setup.ts`
- `tooling/simple-changelogs/scripts/lib/types.ts`
- `tooling/simple-changelogs/scripts/lib/validate.ts`
- `tooling/simple-changelogs/evals/schemas/repo-policy.schema.json`
- `tooling/simple-changelogs/evals/schemas/setup-result.schema.json`

**Bundled documentation:**

- `skills/simple-changelogs/references/setup.md`
- `skills/simple-changelogs-mobile/references/setup.md`
- `skills/simple-changelogs-web/references/setup.md`
- `skills/simple-changelogs-web-cms/references/setup.md`
- Corresponding `references/onboarding.md` files only where receipt language
  must mention the optional answer

`setup.ts` and `lib/validate.ts` hold two independent policy validators; both
must accept the new optional key. In `setup.ts`, add it to the optional list of
`hasExactKeys` inside `validateRepoPolicy` and add an `oneOf` guard.

- [ ] Add `CROSS_SURFACE_VERSIONING_POLICIES` with `shared`, `independent`, and
  `mixed`, in both `setup.ts` and `lib/types.ts`.
- [ ] Add optional `crossSurfaceVersioning` to repository policy, `Selection`
  and `SetupSelection`, `ApplyOptions`, and policy serialization in
  `repoPolicyFor`.
- [ ] Add `--cross-surface-versioning shared|independent|mixed` to the setup
  helper's value options and `parseCli` enum mapping.
- [ ] Add the field to `setup-result.schema.json` in **both**
  `$defs.repoPolicy` and `$defs.selection`. Both are closed objects, and
  `mobileReleaseNotePlacement` was historically missing from both — do not
  repeat that omission.
- [ ] Keep the field out of `GlobalPreferences`, `globalFor`, and
  `global-preferences.schema.json`.
- [ ] Keep the field out of both bundled CMS policy schemas.
- [ ] Keep absence valid and add no universal unresolved setup question.

**Update path for already-valid policy.** `applySetup` currently short-circuits
through `preSetupResult`, which returns `already-configured` and writes nothing
when policy is valid. Recording a relationship answer for a configured
repository therefore needs a new surgical branch.

- [ ] Add a `crossSurfaceVersioningUpdate` step modeled on
  `completePartialAudit`: run it inside `applySetup` **before**
  `preSetupResult`, trigger it only when `--cross-surface-versioning` is
  supplied and stored policy is valid, and no-op when the stored value already
  matches.
- [ ] Require `--confirm`; block with a clear error otherwise.
- [ ] Preserve every other stored field — distribution, guidance version,
  backfill status, signatures, developer-history policy,
  `newReleaseNoteSurfaces`, `newReleaseNoteSurfaceComponents`, and
  `mobileReleaseNotePlacement` — by spreading the existing policy object.
- [ ] Re-read and revalidate the written policy through
  `validateStoredPolicies` and return `configured` with a `writes` record.
- [ ] Include the selected relationship in the setup or update receipt.
- [ ] Document that runtime release inspection — not current string equality —
  decides whether the relationship is already proven.
- [ ] Copy the canonical setup helper byte-for-byte to all six changelog
  distributions after implementation.

### Task 4: Make the version map semantically precise

**Files:**

- `tooling/simple-changelogs/scripts/lib/types.ts`
- `tooling/simple-changelogs/scripts/lib/validate.ts`
- `tooling/simple-changelogs/scripts/lib/fixtures.ts`
- `tooling/simple-changelogs/scripts/lib/model-eval.ts`
- `tooling/simple-changelogs/evals/schemas/runner-response.schema.json`
- `tooling/simple-changelogs/evals/schemas/runner-request.schema.json`
- `tooling/simple-changelogs/evals/schemas/eval-manifest.schema.json`
- `tooling/simple-changelogs/scripts/tests/validate.check.ts`
- `tooling/simple-changelogs/scripts/tests/fixtures.check.ts`
- `tooling/simple-changelogs/scripts/tests/schema-parity.check.ts`
- `tooling/simple-changelogs/scripts/tests/adapter.check.ts`
- `tooling/simple-changelogs/scripts/tests/adapters.check.ts`
- `tooling/simple-changelogs/scripts/tests/hermes-adapter.check.ts`
- `tooling/simple-changelogs/scripts/tests/behavior-cli.check.ts`

- [ ] Add `VERSION_IDENTIFIER_ROLES` with the four values in this plan.
- [ ] Add required `identifierRole` and optional `field` and `releaseTrain` to
  `VersionMapRecord` and to `$defs.versionMapRecord`.
- [ ] Extend all three closed expectation definitions listed in the Version Map
  Contract section, and extend the `report.versionMap` matcher in `fixtures.ts`
  so each new property is compared only when asserted.
- [ ] Keep artifact `role` unchanged; do not overload it with identifier
  semantics.
- [ ] Bump `PROTOCOL_VERSION` from 1 to 2 and update both runner schemas'
  `protocolVersion.const`.
- [ ] Update `lib/model-eval.ts`, which stamps `protocolVersion` on outgoing
  requests.
- [ ] Update every hard-coded response object in the test files above.
  Confirmed `protocolVersion` occurrences: `validate.check.ts` (7),
  `adapter.check.ts` (4), `adapters.check.ts` (3), `hermes-adapter.check.ts`
  (2), `fixtures.check.ts` (1), `behavior-cli.check.ts` (1). Version-map
  records also appear in `validate.check.ts`, `fixtures.check.ts`, and
  `schema-parity.check.ts` and become invalid without `identifierRole`.
- [ ] Update the five existing `report.versionMap` assertions in
  `evals/cases.json` where an identifier role clarifies intent. Partial
  matchers stay valid without changes, so prefer additive precision over
  churn.
- [ ] Add validation tests for two records with the same path but different
  fields and identifier roles.
- [ ] Add negative tests for unsupported identifier roles, empty field names,
  empty release-train IDs, missing `identifierRole`, and two
  `canonical-release` records sharing one `releaseTrain`.

### Task 5: Add monorepo and mobile version fixtures

Cases reference exactly one fixture directory, so the four relationship
variants are four sibling fixtures, not one directory with variants.

**New fixtures:**

- `tooling/simple-changelogs/evals/fixtures/version-trains-independent/`
- `tooling/simple-changelogs/evals/fixtures/version-trains-ambiguous/`
- `tooling/simple-changelogs/evals/fixtures/version-trains-shared/`
- `tooling/simple-changelogs/evals/fixtures/version-trains-mixed/`

**Registries and evaluation files:**

- `tooling/simple-changelogs/evals/cases.json`
- `tooling/simple-changelogs/scripts/tests/manifest-coverage.check.ts` —
  `FIXTURE_IDS` must list all four; `BEHAVIOR_CASE_IDS` must list every new
  case; and `expect(ids).toHaveLength(61)` must move to the new total.
- `tooling/simple-changelogs/scripts/tests/fixtures.check.ts` — `FIXTURE_NAMES`
  is a smaller, separate registry covering only fixtures that test exercises.
  Add a fixture there only if that test uses it.

Existing `mobile-monorepo` and `multi-surface-monorepo` fixtures already cover
per-surface scope filtering. Reuse their layout conventions and keep the new
fixtures focused on version identity rather than duplicating surface scoping.

- [ ] Give every fixture Web public version `6.7.0`, Mobile public version
  `3.2.0`, iOS build `1842`, Android version code `1842`, development version
  `3.2.0-rc.4+abc123`, and established iOS/Android store-note files.
- [ ] `version-trains-independent`: separate release workflows or documentation
  plus `"crossSurfaceVersioning": "independent"`.
- [ ] `version-trains-ambiguous`: no policy field and no release-train
  evidence.
- [ ] `version-trains-shared`: one canonical version source feeding Web and
  Mobile.
- [ ] `version-trains-mixed`: iOS and Android share Mobile `3.2.0` while Web
  stays on `6.7.0`, with local documentation naming the subgroup.
- [ ] Any fixture whose policy records `distribution: "full"` must also record
  `mobileReleaseNotePlacement`, or `validateRepoPolicy` reports it malformed at
  guidance 6 or newer and every case against it blocks.
- [ ] Confirm each fixture policy validates: run the setup helper's `inspect`
  against each fixture directory before writing cases.

**Behavior cases:**

- [ ] **Independent Mobile release:** update Mobile public notes and metadata
  without changing Web; report build identifiers separately; keep build and
  development strings out of public copy.
- [ ] **Independent Web release:** update Web without changing Mobile public
  version, store notes, or build numbers.
- [ ] **Shared release:** reconcile the public-version mirrors across the
  documented shared train without forcing build-number equality.
- [ ] **Mixed release:** update only the named subgroup and prove the unrelated
  train remains unchanged.
- [ ] **Ambiguous release, first turn:** leave all version fields unchanged,
  state the exact ambiguity, and ask shared/independent/mixed.
- [ ] **Ambiguous release, second turn:** record the user's answer, resume the
  original request, and prove later work no longer asks.
- [ ] **Release name:** allow `Summer Update · Version 3.2.0` on an established
  in-app surface while keeping store/native metadata canonical and store copy
  free of internal identifiers.
- [ ] **Store-only request:** prepare copy against the proven Mobile public
  version without treating the store-note file as the public version owner.

**Required assertions:**

- [ ] Positive version-map assertions cover canonical release, public version,
  build number, and development version.
- [ ] Negative text assertions exclude `1842`, `versionCode`, `rc.4`,
  `abc123`, and private codenames from public store copy.
- [ ] File-unchanged assertions protect unrelated Web, Mobile, iOS, Android,
  package, and build fields.
- [ ] Final-response assertions distinguish “already aligned” from “related but
  intentionally different.”
- [ ] Ambiguity assertions prove the skill does not call legitimate divergence
  drift, and that the first turn writes no policy.
- [ ] The second ambiguous turn asserts
  `.simple-changelogs.json#/crossSurfaceVersioning`.
- [ ] Every asserted report code exists in `runner-response.schema.json`.

### Task 6: Add setup, schema, and policy tests

**Files:**

- `tooling/simple-changelogs/scripts/tests/setup.check.ts`
- `tooling/simple-changelogs/scripts/tests/validate.check.ts`
- `tooling/simple-changelogs/scripts/tests/schema-parity.check.ts`
- `tooling/simple-changelogs/evals/schemas/repo-policy.schema.json`
- `tooling/simple-changelogs/evals/schemas/setup-result.schema.json`

- [ ] Validate all three `crossSurfaceVersioning` values.
- [ ] Reject unknown values and non-string values.
- [ ] Prove older valid policy files remain valid without the optional field.
- [ ] Prove setup apply persists an explicit answer.
- [ ] Prove the update path rewrites only `crossSurfaceVersioning` on an
  already-valid policy, asserting each preserved field explicitly:
  distribution, guidance version, backfill status, signatures,
  developer-history policy, `newReleaseNoteSurfaces`,
  `newReleaseNoteSurfaceComponents`, and `mobileReleaseNotePlacement`.
- [ ] Prove the update path blocks without `--confirm` and no-ops when the
  stored value already matches.
- [ ] Prove the field never appears in global preferences.
- [ ] Prove CMS-only setup does not ask for or write app-version policy.
- [ ] Prove a skill-repository distribution does not gain Mobile/store
  behavior.
- [ ] Add schema parity coverage for the new enum, the new result fields, and
  `VERSION_IDENTIFIER_ROLES`.

### Task 7: Add portable contract checks

**Files:**

- `tooling/distributions.check.ts`
- `tooling/simple-changelogs/scripts/tests/manifest-coverage.check.ts`

`contracts.ts` holds structural, distribution-agnostic contracts; required-prose
assertions live in `distributions.check.ts` and `manifest-coverage.check.ts`.
Add the new prose checks there rather than to `contracts.ts`.

Existing checks use raw `source.includes(...)`, which breaks whenever a required
phrase wraps across two lines — the failure mode that forced commits `9e088605`
and `ae3f7904`. Do not repeat it.

- [ ] Normalize whitespace before matching: collapse every run of whitespace to
  a single space, then assert on the collapsed string.
- [ ] Require product distributions' version guidance to state that alignment
  is relationship-aware rather than universal equality.
- [ ] Require the monorepo-does-not-imply-shared-versioning rule.
- [ ] Require the prohibition on deriving public versions from build
  identifiers.
- [ ] Require public store copy to exclude build and development identifiers.
- [ ] Require ambiguous relationships to leave version fields unchanged.
- [ ] Assert `references/version-decisions.md` is byte-identical across the four
  product distributions, and add the same parity assertion for the two bundled
  CMS policy schemas.
- [ ] Preserve all existing portability, duplicate-prose, routed-path, size,
  and authorization contracts.

### Task 8: Bump and explain product guidance versions

**Files:**

- `skills/simple-changelogs/SKILL.md`
- `skills/simple-changelogs-mobile/SKILL.md`
- `skills/simple-changelogs-web/SKILL.md`
- `skills/simple-changelogs-web-cms/SKILL.md`
- Their respective `references/guidance-updates.md`
- `tooling/simple-changelogs/scripts/setup.ts`
- Copied setup helpers in all changelog distributions

- [ ] Bump `simple-changelogs` from guidance 8 to 9.
- [ ] Bump `simple-changelogs-mobile`, `simple-changelogs-web`, and
  `simple-changelogs-web-cms` from guidance 7 to 8.
- [ ] Leave CMS guidance 1 and skill-maintainer guidance 5 unchanged.
- [ ] Add contiguous guidance entries explaining identifier roles,
  relationship-aware alignment, and the new ambiguity question. The contract
  requires exactly one `## Guidance N` heading for every integer from 1 to the
  declared current version.
- [ ] State that an approved historical audit may find public notes attached to
  a build identifier, unrelated product versions forced together, or build and
  development identifiers leaked into public copy.
- [ ] Preserve released history unless a separate historical rewrite is
  authorized.
- [ ] Update `GUIDANCE_VERSIONS` in the canonical setup helper and recopy it to
  every distribution.
- [ ] Verify version-gated invariants stay pinned to the guidance version that
  introduced them. `MOBILE_PLACEMENT_MIN_GUIDANCE` is the existing precedent:
  never compare against `GUIDANCE_VERSIONS.full`, and if this change adds a
  version-gated rule, give it its own pinned constant plus a test that fails
  when the constant drifts.

### Task 9: Update maintainer documentation and release history

**Files:**

- `README.md`
- `tooling/simple-changelogs/EVAL.md`
- `CHANGELOG.md`
- `DEVELOPER_CHANGELOG.md`

- [ ] Document that a shared repository and canonical customer history can
  contain several independent release trains.
- [ ] Add a concise example of different Web and Mobile public versions plus
  separate Mobile build numbers.
- [ ] Document the optional `crossSurfaceVersioning` policy and its three
  values, including the update path.
- [ ] Document runner protocol 2 and the version-map identifier roles in
  `EVAL.md`, which enumerates report protocol fields and is asserted by
  `manifest-coverage.check.ts`.
- [ ] Use a `gpt-5.6-sol` subagent at medium reasoning effort for the final
  customer and developer changelog entries; fall back to Opus 5 at medium
  effort and name the model that wrote them.
- [ ] Apply the repository's `agent-and-timestamp` signature policy to each
  changed contiguous block, using real runtime identity and time.
- [ ] Keep the public changelog focused on safer version handling and the
  developer changelog focused on policy schema, protocol, fixtures, and
  verification.
- [ ] Do not finalize a repository release or bump package metadata unless
  separate release intent exists.

### Task 10: Repair pre-existing bundled schema drift

`skills/simple-changelogs-cms/schemas/repo-policy.schema.json` lists
`newReleaseNoteSurfaceComponents`; its twin at
`skills/simple-changelogs-web-cms/schemas/repo-policy.schema.json` does not.
Nothing currently enforces parity, so `bun run check` passes with the two out
of sync. This is adjacent to Task 3 and Task 7, so fix it here.

- [ ] Add `newReleaseNoteSurfaceComponents` to the web+CMS bundled schema so
  both copies match the runtime CMS policy validator.
- [ ] Confirm no other bundled schema pair has drifted.
- [ ] The parity assertion added in Task 7 prevents recurrence.

## Verification Sequence

Run focused checks first:

```sh
bun run typecheck
```

```sh
bun run lint
```

```sh
bun tooling/simple-changelogs/scripts/test.ts
```

```sh
bun tooling/distributions.check.ts
```

Then run the complete repository gate, which also covers the CMS and
publish-skill suites and the contract evaluation:

```sh
bun run check
```

Final manual review:

- [ ] Inspect `git diff --check`.
- [ ] Confirm every setup helper copy is byte-identical to
  `tooling/simple-changelogs/scripts/setup.ts`.
- [ ] Confirm `references/version-decisions.md` is byte-identical across the
  four product distributions.
- [ ] Confirm both bundled CMS policy schemas match.
- [ ] Confirm guidance headings are contiguous for every bumped distribution.
- [ ] Confirm each distribution remains under the 256 KB budget; the largest is
  already near 180 KB.
- [ ] Confirm no Mobile/store ownership leaked into Web-only or
  skill-maintainer guidance.
- [ ] Confirm current version equality is never described as sufficient proof
  of a shared train.
- [ ] Confirm legitimate Web/Mobile divergence is never called drift.
- [ ] Confirm ambiguous relationships block version mutation but do not block
  harmless read-only analysis.
- [ ] Confirm store descriptions contain public outcomes only and do not expose
  build/development identifiers.
- [ ] Confirm every version-map record has an identifier role, multi-train
  records name their release train, and no train carries two
  `canonical-release` records.
- [ ] Confirm global preferences and both CMS policy schemas remain free of
  `crossSurfaceVersioning`.
- [ ] Confirm generated schemas, TypeScript types, validators, adapters, and
  `lib/model-eval.ts` agree on protocol version 2.
- [ ] Mutation-check at least one new invariant: break it deliberately, confirm
  a test fails, then restore.

## Completion Standard

This work is complete when the skill can inspect a monorepo, identify each
public version owner and release train, preserve proven shared or independent
relationships without unnecessary questions, stop safely when the relationship
is ambiguous, record one explicit answer for future releases, and report public
versions, build numbers, and development versions without conflating them.

The implementation must prove all four core cases—shared, independent, mixed,
and ambiguous—with both positive and negative evaluation evidence. Public store
copy must remain attached to the correct public version while excluding
internal identifiers, and every product distribution must retain its existing
audience and destination boundaries.
