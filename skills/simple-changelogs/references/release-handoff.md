# Public Release Handoff Protocol

Use this reference when Simple Changes or another release orchestrator asks
Simple Changelogs to classify, prepare, or verify a public release. Version
selection belongs to Simple Changelogs. Merge, deployment, publication, store,
data, secret, environment, migration, and DNS authority do not.

## Contents

- Negotiate before delegation
- Validate the request first
- Classify
- Digests and approval
- Prepare
- Verify
- Retry and closed failures

## Negotiate before delegation

Run `scripts/setup.ts inspect --repo <path> --task-mode read --json` and read
its `capabilities` object. Select the highest request and receipt versions
supported by both parties and compare the advertised SHA-256 schema digests
against `schemas/changelog-request.schema.json` and
`schemas/changelog-receipt.schema.json`. A missing version overlap blocks only
release-boundary work. A digest difference is advisory status, never a block;
each request and receipt is validated against the packaged schema at use time.
Skill-path presence is not compatibility.

The `changelog-provider.json` marker beside `SKILL.md` declares provider
identity, distribution, guidance version, and schema digests. Setup generates
it; Simple Changes reads it for discovery. The CMS-only distribution
advertises the same protocol versions but takes an entry-only handoff for its
version-less operator history: it prepares and verifies a
`CMS_CHANGELOG.json` entry on the `none` boundary and never a version, tag,
or public note. Its own `release-handoff.md` describes that contract.

The schemas are pinned producer fixtures from the Simple Changes companion
contract. Do not independently widen their enums or accept raw prompt prose as
a delegation request.

## Validate the request first

Validate the closed request before classifying or editing. One
`transactionId` follows exactly one release train. `releaseSetId` may group
receipts for reporting but never creates atomic multi-train authority.

- `classify` and `verify` require `mutationScope: "read-only"`.
- `prepare` requires `mutationScope: "prepare-release-files"`.
- `verify` requires the exact non-null `finalizedTargetRevision`; other phases
  require it to be null.
- `attempt` and `environment` are optional, informational fields. Check their
  shape when present; never store, echo, or key retries on them. Transaction
  identity is the transaction ID, phase, revisions, and prior receipt digest.
- Reject a moved target, mismatched transaction/train/boundary, unsupported
  version, stale prior-receipt digest, malformed policy, or missing
  phase-specific approval field before mutation.
- The request never authorizes commits, merges, deployment, publication,
  submission, credentials, or unrelated repository files.

## Classify

`classify` is read-only. Establish a proven public boundary, release train,
version owner, current version, and all target-contained pending outcomes.
Classify their aggregate impact as `none`, `patch`, `minor`, `major`, or
`unknown`. A changed Web production target with no customer-facing bullet is
still `patch`; internal, preview, staging, and DX-only work is `none`.

Resolve policy in this order: exact current direction, confirmed run-only
selection, repository `publicVersioning`, then ask/ask/ask with suggestions on.
Global preferences are onboarding input only. Repository automation may
calculate the candidate but cannot bypass `ask`.

Return one closed receipt for the train:

- `not-applicable` for `none`;
- `decision-required` for `ask`, with the exact suggestion only when enabled;
- an automatically or explicitly selected exact version ready for `prepare`;
- `blocked` for `unknown`, ambiguous ownership, stale evidence, invalid exact
  direction, malformed contracts, or protocol incompatibility.

Normal version approval is `decision-required`, never `blocked`. Branch only
on `reasonCode` and `requiredAction`, not human-readable `reason`.
An internal-only, developer-only, preview, staging, or DX patch has aggregate
impact `none` even when repository package metadata happens to have a next
patch number. It must return `not-applicable` and must never ask the user to
approve that unused public version.

## Digests and approval

Use RFC 8785 canonical JSON and lowercase SHA-256 digests. The effective-policy
digest covers the resolved source and granular policy, version convention,
automation owner, and train/version-owner map. The decision digest also covers
the transaction, boundary, input target revision, aggregate impact, current,
suggested and selected versions, and effective-policy digest.

An explicit approval must reference the prior decision digest. Any policy,
target, classification input, version owner, negotiation, or selected-version
change invalidates approval and returns to `classify`.

## Prepare

`prepare` is the only mutation phase. Re-inspect the exact target and approval
binding, then change only established release files for that train. Move only
target-contained pending items, align proven mirrors and version fields,
preserve unrelated pending work, and never append to a published release.

Return `prepared` with changed-path SHA-256 digests, the exact release version,
`targetContainedUnreleased: "prepared"`, and the reconciliation head supplied
by the release proposal workflow. This is not proof that a release-bearing
target contains the reconciliation. Do not deploy or merge it.

## Verify

After the orchestrator integrates the prepared reconciliation and refreshes
the canonical target, `verify` performs no writes. Prove that the exact
`finalizedTargetRevision` contains the reconciliation head; all selected
version, release-file, path-digest, policy-digest, and decision-digest
invariants still match; and no selected pending item remains under
`Unreleased`.

Return `verified` with no changed paths and
`targetContainedUnreleased: "integrated"`. Otherwise return `blocked` with
`final-verification-failed` and `review-finalization`; never repair during
verification.

## Retry and closed failures

An exact immutable retry keeps its release identity. New code, changed
reconciliation, moved targets, or changed policy returns to classification. A
failed deployment does not choose another version. If deployment escaped the
gate, prepare a forward release fix instead of rewriting published history.

Use only the reason/action pairs defined by the receipt schema. Both are null
only when no action is required. Keep credentials, hidden reasoning, raw user
prompts, and developer-only evidence out of public prose and receipts.
