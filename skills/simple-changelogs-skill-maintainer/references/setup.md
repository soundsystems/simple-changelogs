# Repository Setup and Policy

Use this reference for first use, repository-local decisions, one-time prompts,
and raw-changelog attribution.

For the automatic inspection, recommended/customized entry screen, preference
scope, confirmation receipt, and helper commands, follow
`references/onboarding.md`.

## Policy File

Store portable state in `.simple-changelogs.json` at the repository root. This
file records decisions; it does not copy the skill's prose rules.

<!-- simple-changelogs-policy-example -->
```json
{
  "schemaVersion": 1,
  "distribution": "skill-repository",
  "guidance": {
    "version": 6,
    "backfillStatus": "completed"
  },
  "developerChangelog": "required",
  "releaseNoteGrouping": "product-areas",
  "majorReleaseNaming": "named",
  "signatures": "agent-and-timestamp",
  "newReleaseNoteSurfaces": "ask",
  "newReleaseNoteSurfaceComponents": "minimal-markup"
}
```

This skill-maintenance distribution requires `distribution: "skill-repository"`. A repository-local
install of this sole changelog distribution or an explicit current selection
is enough to record it during authorized setup, but the repository must
actually develop or publish agent skills. If another distribution is selected,
stop before writing instead of converting policy implicitly.

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
  short, user-recognizable skill areas when grouping improves scanning.
- `flat`: keep release bullets flat while still allowing nested outcomes under
  one named capability.

`majorReleaseNaming` accepts:

- `named`: the default. Stable major package releases receive a concise
  descriptive name beside their real version after the proposed name is
  reviewed.
- `version-only`: stable major package releases use only their version and date.

Missing values use the defaults above. Both values may join all-projects
preferences, but onboarding still shows the major-release choice for the
current repository. Minor releases require no release name. Patch releases use
**Bug Fixes & Improvements**, keep their bullets flat, and never add a second
category layer beneath that title. These presentation choices never replace a
version or grant tagging, package publication, hosted-release, or downstream
distribution authority.

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

Skill-repository onboarding does not offer product surfaces; this optional field
is preserved only for schema portability and never grants product UI,
dependency, deployment, or publication authority.

`publicVersioning` optionally records independent `ask` or `automatic` actions
for `patch`, `minor`, and `major`, plus boolean `suggestWhenAsking`. Absence is
safe ask/ask/ask with suggestions on. Exact current direction wins, followed by
confirmed run-only selection, repository policy, and that default. Global
preferences only prefill onboarding. This authority applies only at a proven
public package boundary and never grants publication, tagging, or hosted
release authority.

The `guidance.version` is the newest guidance version for which the repository
recorded a disposition. It is not proof that released history conforms. Current
guidance applies prospectively regardless of the recorded backfill status.

Commit the policy with the changelogs unless repository instructions explicitly
classify it as local-only. Report malformed or unsupported state and leave it
untouched until the user authorizes a repair.

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

## Authorized Initial Setup

Run setup when the policy is absent and the user requests creation, adoption,
update, backfill, release, or other write-capable changelog work. A
classification, explanation, or audit question alone is read-only: answer it
and offer setup without changing repository files.

For authorized setup:

1. Inspect repository instructions, existing changelogs, released headings,
   release-note data, and local release policy.
2. Confirm that the skill-repository distribution owns the repository and
   record `distribution: "skill-repository"`. Create `CHANGELOG.md` and
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
5. Record the user's actual disposition and set `newReleaseNoteSurfaces` to
   `ask`, then continue the originally requested task. An authorized audit starts
   as `partial` and becomes `completed` only after verification.

Setup does not authorize a new modal, route, screen, panel, navigation entry, or
other product UI. Follow `references/release-note-surfaces.md` when later work
needs a missing destination.

If the user does not confirm the setup receipt, write no policy or changelog
state. A declined or deferred historical audit does not prevent prospective
changelog work after that decision is recorded.

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
