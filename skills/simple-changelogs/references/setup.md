# Repository Setup and Policy

Use this reference for first use, repository-local decisions, one-time prompts,
and raw-changelog attribution.

For the automatic inspection, recommended/customized entry screen, preference
scope, confirmation receipt, and helper commands, follow
`references/onboarding.md`.

## Contents

- Policy File
- Authorized Initial Setup
- One Prompt per Guidance Version
- Surface Authorization State
- Raw-Markdown Signatures

## Policy File

Store portable state in `.simple-changelogs.json` at the repository root. This
file records decisions; it does not copy the skill's prose rules.

<!-- simple-changelogs-policy-example -->
```json
{
  "schemaVersion": 1,
  "distribution": "full",
  "guidance": {
    "version": 14,
    "backfillStatus": "completed"
  },
  "developerChangelog": "required",
  "releaseNoteGrouping": "product-areas",
  "majorReleaseNaming": "named",
  "signatures": "agent-and-timestamp",
  "newReleaseNoteSurfaces": "ask",
  "newReleaseNoteSurfaceComponents": "project-components",
  "mobileReleaseNotePlacement": "mobile-only",
  "releaseNoteEnvironmentScope": "non-production",
  "releaseNoteLinks": "when-useful"
}
```

`distribution` prevents multiple globally installed variants from claiming the
same repository. Allowed values are `full`, `web`, `mobile`, `web-cms`, and
`skill-repository`. An existing policy without this field remains a
backward-compatible `full` policy unless repository instructions or the current
user explicitly select another distribution. A CMS-only repository uses
`.simple-changelogs-cms.json` instead.

Allowed `guidance.backfillStatus` values:

- `not-applicable`: no released history existed for that guidance version.
- `completed`: the authorized audit finished and was verified; intentionally
  unchanged semantic candidates may still have been reported.
- `declined`: the user chose not to audit that guidance version.
- `deferred`: the user postponed the audit.
- `partial`: authorized work began but remains unfinished.
- `failed`: the audit encountered a handled failure and can be resumed.

Reserve `partial` for incomplete work, not for a completed review that kept
some history unchanged on purpose.

`developerChangelog` accepts:

- `required`: the default. Setup creates `DEVELOPER_CHANGELOG.md` alongside
  `CHANGELOG.md`, and technical outcomes worth preserving go there.
- `optional`: the repository keeps only `CHANGELOG.md`. Preserve technical
  context in commit, pull, or merge request descriptions instead, and create
  `DEVELOPER_CHANGELOG.md` only when the user explicitly asks for one.

`releaseNoteGrouping` accepts:

- `product-areas`: the default. Group eligible release-note bullets under
  short, user-recognizable product areas when grouping improves scanning.
- `flat`: keep release bullets flat while still allowing nested outcomes under
  one named feature.

`majorReleaseNaming` accepts:

- `named`: the default. Stable major releases receive a concise descriptive
  name beside their real version after the proposed name is reviewed.
- `version-only`: stable major releases use only their version and date.

Missing values use the defaults above. Both values may join all-projects
preferences, but onboarding still shows the major-release choice for the
current repository. Minor releases require no release name. Patch releases use
**Bug Fixes & Improvements**, keep their bullets flat, and never add a second
category layer beneath that title. These presentation choices never replace a
version or change release, publication, deployment, or store authority.

`publicReleaseNotes` is optional and accepts:

- `full`: the default. Public release-note surfaces render the complete
  customer changelog; no curated file is maintained.
- `curated`: a derived `RELEASE_NOTES.md` at the repository root carries a
  short curated section per release — one-sentence highlights within the
  budget plus one rollup line — generated from `CHANGELOG.md` at each release
  boundary. `references/curation.md` owns the derivation, coverage, and
  provenance rules. Breaking changes and security notices are never omitted or
  rolled up.

`curationBudget` is optional, applies only with curated public release notes,
and is a closed object:

```json
{ "min": 3, "max": 8 }
```

`min` and `max` are integers with `0 <= min <= max`; absence means 3 and 8.
Patch releases may drop below `min` to zero highlights plus the rollup line.
Record both bounds together with `--curation-min` and `--curation-max`.
Neither field joins all-projects preferences, changes what the changelog
records, or authorizes a new surface, deployment, or publication.

`signatures` accepts:

- `agent-and-timestamp`: the default. Attach the signature comment described
  below to each contiguous raw-markdown block you change.
- `none`: write no signature comments. Preserve signatures that already exist.

`newReleaseNoteSurfaces` accepts:

- `ask`: request permission if future work needs a missing product surface.
- `allow`: documented ongoing permission for new release-note surfaces.
- `existing-only`: update established destinations, but do not add another one
  without a new explicit request.

`newReleaseNoteSurfaceComponents` is optional and accepts:

- `project-components`: follow the established repository design system.
- `recommended-web-components`: use the confirmed Base UI web recommendation.
- `recommended-web-radix`: retain existing Radix primitives.
- `platform-native-components`: follow the established native app toolkit.
- `minimal-markup`: add no component-library dependency.

When absent, ask only after a release-note surface is authorized. The field
never grants a new surface, dependency, deployment, or publication.

`releaseNoteEnvironmentScope` is optional and accepts:

- `all-environments`: serve the approved Release Notes page and allow its
  selected entry points and modal locally, in preview, and in production;
- `non-production`: expose them only in local development and every recognized
  non-production environment;
- `production-only`: expose them only in production deployments; or
- `disabled`: expose none of them in any environment.

Ask after the user selects a public Web archive, whether its compact surface is
automatic, manual, or absent. `all-environments` preserves existing behavior;
recommend `non-production` for marketing and client sites where developers and
reviewers need the page and any selected summary but public visitors should not
reach them. Enforce the choice at the route or build boundary and every
navigation, manual-link, summary, and modal entry point. This field is
repository-specific, never joins all-projects preferences, and does not change
archive-data synchronization, generation, deployment, or publication.

`releaseNoteLinks` is optional and accepts:

- `when-useful`: recommended; add a contextual action only when an eligible
  reader benefits from opening, using, configuring, or inspecting the released
  feature;
- `ask`: propose the exact label and destination and wait for approval; or
- `disabled`: keep individual release items informational.

This repository-only field never joins all-projects preferences. It does not
disable structural archive navigation, authorize a new route, or make an
inaccessible destination safe to expose. A missing value remains unresolved
for older policy files; ask during owner-facing setup when a product
release-note destination is selected.

`crossSurfaceVersioning` is optional and accepts:

- `shared`: the covered product surfaces mirror one canonical public release
  version unless a narrower repository rule excludes a surface.
- `independent`: each documented release train owns its public version and may
  advance without the others.
- `mixed`: the repository holds both relationships, and local release
  configuration or documentation identifies the groups.

When absent, inspect first and ask only when several public version owners
exist, their relationship is still ambiguous, and the current write depends on
it. Never infer and persist a value from equal or unequal current strings. A
`mixed` or `independent` value permits distinct trains but still requires
repository evidence naming each affected train's version owner. This field is
repository-specific and never joins the all-projects preferences.

`sharedVersionLines` is optional, full-only, and repository-only. Absent means
each release train numbers itself; `[]` records that choice. Lines follow
`references/shared-version-lines.md`.

`mobileReleaseNotePlacement` accepts:

- `store-only` (**App stores only**): prepare mobile-specific update notes only
  for established App Store, Google Play, testing-track, or repository-owned
  store metadata destinations; do not add an in-app or Web history surface.
- `mobile-only` (**Mobile app and app stores — no Web**): keep mobile-specific
  history off the Web while retaining it for established in-app, App Store,
  Google Play, testing-track, or other mobile destinations.
- `web-tabs` (**Web and mobile — one tabbed Release Notes page**): expose the
  independently scoped Web and Mobile histories under clearly labeled tabs at
  one Web destination while the same Mobile feed remains available to mobile
  and store destinations.
- `web-page` (**Web and mobile — separate Release Notes pages**): keep the
  normal Web history at its established destination, expose the independently
  scoped Mobile history on a separate linked Web page, and retain the same
  Mobile feed for mobile and store destinations.

The full distribution, and any explicitly combined web+mobile distribution
derived from it, asks the user to choose one of these values during setup
whenever mobile applicability is `detected` or `uncertain`. The question may
be suppressed only when a complete scan finds another recognizable product
shape and reports the mobile surface `not-detected`; suppression describes the
surface as not detected, never as proven absent, and leaves the value
unresolved for a later planned surface. Do not otherwise infer a preference
from repository layout, an existing shared version, or the presence of a
mobile app. Shared outcomes that genuinely affect web users
remain eligible for the Web history even when the preference is `mobile-only`;
the preference controls mobile-specific history.

The field is optional only so policy files created before guidance 6 remain
valid. Treat a missing value as unresolved, not as `mobile-only`. Before
synchronizing or implementing combined web/mobile history, ask once and record
the answer. A web-only, mobile-only, web+CMS, or skill-repository distribution
does not add this field.

Choosing `web-tabs` or `web-page` records desired placement, but does not by
itself create product UI. Existing compatible destinations may follow the
preference during ordinary synchronization. A missing tab set, route, page, or
navigation entry still follows `newReleaseNoteSurfaces` authorization.

`publicVersioning` is optional and closed:

```json
{
  "patch": "ask",
  "minor": "ask",
  "major": "ask",
  "suggestWhenAsking": true
}
```

Each bump accepts `ask` or `automatic`. Absence resolves to the object above.
Exact current direction wins, then confirmed run-only selection, repository
policy, and the safe missing-field default. Global preferences only prefill
onboarding and cannot silently activate automatic release behavior. The policy
applies only at a proven public boundary and grants no merge, deployment,
publication, store, migration, secret, environment, or DNS authority.

The `guidance.version` is the newest guidance version for which the repository
recorded a disposition. It is not proof that released history conforms. Current
guidance applies prospectively regardless of the recorded backfill status.

Commit the policy with the changelogs unless repository instructions explicitly
classify it as local-only. Report malformed or unsupported state and leave it
untouched until the user authorizes a repair.

## Authorized Initial Setup

Run setup when the policy is absent and the user requests creation, adoption,
update, backfill, release, or other write-capable changelog work. A
classification, explanation, or audit question alone is read-only: answer it
and offer setup without changing repository files.

For authorized setup:

1. Inspect repository instructions, existing changelogs, released headings,
   release-note data, and local release policy.
2. Confirm that the full distribution owns the repository and record
   `distribution: "full"`. Create `CHANGELOG.md` and
   `DEVELOPER_CHANGELOG.md` when missing.
   Repositories adopting this skill maintain both histories by default; skip
   the developer file only when the user explicitly chooses
   `developerChangelog: "optional"`.
3. When no released history exists, write the current guidance version with
   `backfillStatus: "not-applicable"`.
4. When released history exists, default initial setup to a comprehensive audit
   of the complete accessible history. Honor a current request that already
   defers or declines it; otherwise present the full backfill as the recommended
   default and ask, as the final onboarding question, only whether the user
   wants to defer or decline. Confirmation accepts `partial` and starts the
   audit without a separate “Review it now” approval.
5. Ask where people should be able to read mobile-specific release notes.
   Present **App stores only**, **Mobile app and app stores — no Web**, **Web
   and mobile — one tabbed Release Notes page**, and **Web and mobile —
   separate Release Notes pages**; show `store-only`, `mobile-only`,
   `web-tabs`, and `web-page` only as stored receipt values. Explain that
   `store-only` omits an in-app history while the other choices retain
   established in-app and store destinations. Shared cross-platform outcomes
   remain eligible for Web history, and missing product UI still requires its
   normal authorization.
6. Record the user's actual audit disposition and mobile placement, set
   `newReleaseNoteSurfaces` to `ask`, then continue the originally requested
   task. An authorized audit starts as `partial` and becomes `completed` only
   after verification.

Setup does not authorize a new modal, route, screen, panel, navigation entry, or
other product UI. Follow `references/release-note-surfaces.md` when later work
needs a missing destination.

If the user does not confirm the setup receipt, do not write policy or changelog
state. A declined or deferred historical audit does not prevent prospective
changelog work after that decision and the mobile placement are recorded.

## One Prompt per Guidance Version

When policy records an older guidance version, inspect every intervening entry
through `guidanceUpdate` and explain its practical effect. Ask once about
released history only when the aggregated backfill recommendation is optional
or recommended. Record the newest prompted version and answer immediately so
another invocation does not repeat the same unsolicited question.

If an approved audit starts, first record `partial`. Change it to `completed`
only after verification, or `failed` after a handled failure. `deferred`,
`partial`, and `failed` work resumes only after an explicit request; a later
guidance version may generate one new prompt.

No answer means no new disposition. Do not advance `guidance.version` merely
because the question was prepared or displayed.

Inspection exposes this as `guidanceUpdate`. Present it as a user-facing update,
not an internal guidance checkpoint:

> **Simple Changelogs has recently been updated.**
>
> - Up to three short practical effects from the intervening changes.
>
> Your saved settings and released history have not been changed.

Offer **Walk me through what changed — Recommended**, **Keep my current
settings and continue**, and **View detailed release notes**. Never recommend
skipping the explanation. A walkthrough explains every new ability first, then
names affected settings, proposed defaults, concrete examples, consequences,
and safety boundaries. `releaseNotesPath` remains available for the complete
version-by-version detail; do not require the user to open it to understand the
choice.

After that review choice, when `userPrompt` is non-null, pause write-capable
work for one separate history choice: preview/start (`partial`), defer
(`deferred`), or skip (`declined`). Never run a backfill automatically. When
`userPrompt` is null, explain that the update is prospective and no historical
backfill is needed, record `not-applicable`, and continue.

Record the disposition with
`apply --guidance-backfill <status> --confirm`. A verified completed audit adds
`--audit-verified`. This acknowledgement changes only guidance state and does
not grant history-rewrite, release, deployment, or publication authority.


## Surface Authorization State

When policy is `ask` and a missing destination becomes relevant, ask one
authorization question before product implementation. Distinguish permission
for the named destination in this task from an ongoing repository preference.
A one-off approval or rejection leaves policy at `ask`; record `allow` or
`existing-only` only when the user explicitly chooses that ongoing policy.

An explicit current request for one new release-note destination overrides
`existing-only` for that task. Keep the stored preference unchanged unless the
user also grants ongoing permission.

## Raw-Markdown Signatures

When policy records `signatures: "agent-and-timestamp"`, place one
machine-readable comment next to each contiguous block or release section
changed directly in `CHANGELOG.md` or `DEVELOPER_CHANGELOG.md`:

```html
<!-- simple-changelogs-signature agent="Example Agent" at="2026-07-09T15:42:00-05:00" -->
```

Use only identity and time data exposed by the runtime:

- If identity is unavailable, write `agent="unreported"`.
- If a trustworthy local ISO 8601 timestamp and offset are unavailable, write
  `at="unreported"`.
- If both values would be `unreported`, omit the signature comment entirely; a
  placeholder-only signature records nothing useful.
- Escape `&` as `&amp;`, `"` as `&quot;`, `<` as `&lt;`, and `>` as `&gt;`
  before inserting a runtime identity into the attribute.
- Preserve existing signatures and do not invent a model name, version, time,
  offset, or human author.

These comments are informational audit metadata, not cryptographic proof of
authorship or mutation. Renderers should ignore HTML comments generally so raw
attribution never becomes release-note copy.
