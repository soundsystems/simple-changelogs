# Operator-History Entry Handoff

Use this reference when Simple Changes or another release orchestrator asks
this distribution to classify, prepare, or verify the operator entry for a
change. The handoff is entry-only: `CMS_CHANGELOG.json` is a version-less
history, so the outcome is an operator entry and never a version, tag, hosted
release, or public note. Merge, deployment, publication, data, secret,
environment, migration, and DNS authority stay with the orchestrator.

## Contents

- Negotiate before delegation
- Validate the request first
- Classify
- Digests and approval
- Prepare
- Verify
- Never a version, tag, or public note

## Negotiate before delegation

Run `scripts/setup.ts inspect --repo <path> --task-mode read --json` and read
its `capabilities` object. It advertises request version 1, receipt version 2,
the `classify-prepare-verify` and `guidance-update-notices`
features, and SHA-256 digests of `schemas/changelog-request.schema.json` and
`schemas/changelog-receipt.schema.json`. Select the highest request and
receipt versions supported by both parties. A missing overlap blocks the
handoff; a digest difference is advisory, because every request and receipt
is validated against the packaged schema at use time. Skill-path presence is
not compatibility.

The `changelog-provider.json` marker beside `SKILL.md` declares the same
capabilities for discovery. The schemas are pinned producer fixtures from the
Simple Changes companion contract. Do not widen their enums or accept raw
prompt prose as a delegation request.

## Validate the request first

Validate the closed request before classifying or editing. An entry-only
request names `boundary: "none"` and the operator release train,
`cms-operators`. `approvedVersion` is null in every phase;
`approvedDecisionDigest` still binds `prepare` and `verify` to the
classification, and `priorReceiptDigest` binds each phase to the receipt it
builds on. One `transactionId` follows exactly one change.

- `classify` and `verify` require `mutationScope: "read-only"`.
- `prepare` requires `mutationScope: "prepare-release-files"`; for this
  distribution that scope covers only the configured `CMS_CHANGELOG.json`.
- `verify` requires the exact non-null `finalizedTargetRevision`; other
  phases require it to be null.
- `attempt` and `environment` are optional, informational fields. Check their
  shape when present; never store, echo, or key retries on them.
- Reject a moved target, a public boundary, a mismatched transaction or
  train, an unsupported version, a stale prior-receipt digest, or malformed
  policy before mutation. A request that names a public boundary belongs to a
  public-release distribution, not to this one.
- The request never authorizes commits, merges, deployment, publication,
  route changes, credentials, or unrelated repository files.

## Classify

`classify` is read-only. Inspect the exact `inputTargetRevision`, the files it
changed, the policy file, and the current history. Decide one question: does
this change carry an outcome that authenticated operators must understand?
Apply `references/entry-classification.md`.

- No operator-relevant outcome: return `not-applicable` with
  `releaseImpact: "none"`, `release: null`, no changed paths, and a
  `versionDecision` whose `boundary` and `bumpLevel` are `none`,
  `policyAction` is `not-applicable`, and `resolution` is `not-required`.
  Internal, developer-only, public-web, mobile, and store work with no
  operator consequence is `none`.
- Operator-relevant outcome: classify the entry's magnitude as
  `releaseImpact` (`patch` for a fix or clarification, `minor` for a new or
  changed workflow, `major` for a change that alters what operators must do)
  and compute the effective-policy and decision digests. Return `classified`
  with no changed paths, no release, the `none`/`none`/`not-required` version
  decision, and the classified impact. The orchestrator then delegates
  `prepare` with that decision digest as `approvedDecisionDigest`.
  `releaseImpact` describes the entry and never proposes a version bump.
- Return `blocked` for stale evidence, malformed contracts, an unreadable
  history, or protocol incompatibility.

Never return `decision-required`: there is no version to approve.

## Digests and approval

Use RFC 8785 canonical JSON and lowercase SHA-256 digests. The
effective-policy digest covers the resolved CMS policy and changelog path.
The decision digest covers the transaction, the `none` boundary, the
`cms-operators` train, the input target revision, and the classified impact.
Any policy, target, or classification change invalidates the digest and
returns to `classify`.

Compute them with `scripts/handoff.ts`, never by hand; it writes nothing and
leaves validation to Simple Changes. `receipt --request FILE --findings FILE
[--prior FILE]` assembles the receipt. Its findings hold `status`,
`releaseImpact`, `checks`, `evidence`, `paths`, the orchestrator's
`reconciliationHeadRevision`, and `policy`: the CMS policy and changelog path
as `policy`, `cms-operators` as `releaseTrain`, `none` as `versionConvention`,
`CMS_CHANGELOG.json` as `versionOwner`, `null` as `automationOwner`, and
`repository-policy` as `source`. `decision` is null or the `none` record with
`bumpLevel: "none"` and null versions. `digest json FILE` gives a receipt's
`priorReceiptDigest`; run `help` for the other digests.

## Prepare

`prepare` is the only mutation phase. Re-inspect the exact target and the
decision-digest binding, then write the operator entry into
`CMS_CHANGELOG.json`: a stable ID, an evidence-backed date, the operator
wording, and no version unless the repository already supplies one for that
change. Keep the document valid and newest-first, run `scripts/validate.ts`,
and change nothing else.

Return `prepared` with:

- `release: null`;
- `releaseImpact` as classified;
- `versionDecision` either null or the `none`/`none`/`not-required` record
  from classification, with `selectedVersion` and `suggestedVersion` null;
- `paths` listing the changed `CMS_CHANGELOG.json` with its SHA-256 digest;
- the reconciliation head supplied by the orchestrator in
  `revisionLineage.reconciliationHeadRevision`.

This is not proof that the target contains the entry. Do not merge, tag,
deploy, or publish.

## Verify

After the orchestrator merges the reconciliation and refreshes the canonical
target, `verify` performs no writes. Prove that the exact
`finalizedTargetRevision` contains the reconciliation head, that the entry is
present in that revision's `CMS_CHANGELOG.json` with the recorded digest,
that the document still validates, and that the policy and decision digests
are unchanged.

Return `verified` with `release: null`, no changed paths, and the full
input/head/finalized revision lineage. Otherwise return `blocked` with
`final-verification-failed` and `review-finalization`; never repair during
verification.

## Never a version, tag, or public note

The orchestrator treats a `prepared` entry as ready to merge and a
`verified` entry as integrated; it never deploys or composes a release
delivery receipt from this handoff. Do not create `CHANGELOG.md`,
`DEVELOPER_CHANGELOG.md`, a tag, a hosted release, a public route, or a
customer announcement, and keep credentials, hidden reasoning, raw user
prompts, and sensitive implementation detail out of the entry and the
receipt. Use only the reason/action pairs defined by the receipt schema; both
are null only when no action is required.
