# Repository Setup and Policy

Use this reference for first use, repository-local decisions, one-time prompts,
and raw-changelog attribution.

## Policy File

Store portable state in `.simple-changelogs.json` at the repository root. This
file records decisions; it does not copy the skill's prose rules.

<!-- simple-changelogs-policy-example -->
```json
{
  "schemaVersion": 1,
  "guidance": {
    "version": 2,
    "backfillStatus": "completed"
  },
  "developerChangelog": "required",
  "signatures": "agent-and-timestamp",
  "newReleaseNoteSurfaces": "ask"
}
```

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

`signatures` accepts:

- `agent-and-timestamp`: the default. Attach the signature comment described
  below to each contiguous raw-markdown block you change.
- `none`: write no signature comments. Preserve signatures that already exist.

`newReleaseNoteSurfaces` accepts:

- `ask`: request permission if future work needs a missing product surface.
- `allow`: documented ongoing permission for new release-note surfaces.
- `existing-only`: update established destinations, but do not add another one
  without a new explicit request.

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
2. Create `CHANGELOG.md` and `DEVELOPER_CHANGELOG.md` when missing.
   Repositories adopting this skill maintain both histories by default; skip
   the developer file only when the user explicitly chooses
   `developerChangelog: "optional"`.
3. When no released history exists, write the current guidance version with
   `backfillStatus: "not-applicable"`.
4. When released history exists, first check whether the current request already
   and explicitly decides the audit. Use that decision when its scope is clear;
   otherwise explain the current guidance briefly and ask once whether to audit
   that history. Do not repeat permission the user already granted.
5. Record the user's actual disposition and set `newReleaseNoteSurfaces` to
   `ask`, then continue the originally requested task. An authorized audit starts
   as `partial` and becomes `completed` only after verification.

Setup does not authorize a new modal, route, screen, panel, navigation entry, or
other product UI. Follow `references/release-note-surfaces.md` when later work
needs a missing destination.

If the user does not answer the setup question, do not guess a disposition or
write policy state that implies one. A declined or deferred historical audit
does not prevent prospective changelog work after that decision is recorded.

## One Prompt per Guidance Version

When policy records an older guidance version, read every intervening entry in
`references/guidance-updates.md`, summarize its practical effect, and ask once
whether to audit released history. Record the newest prompted version and the
answer immediately so another invocation does not repeat the same unsolicited
question.

If an approved audit starts, first record `partial`. Change it to `completed`
only after verification, or `failed` after a handled failure. `deferred`,
`partial`, and `failed` work resumes only after an explicit request; a later
guidance version may generate one new prompt.

No answer means no new disposition. Do not advance `guidance.version` merely
because the question was prepared or displayed.

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
