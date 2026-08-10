# Public release version policy implementation plan

**Date:** 2026-08-10
**Status:** Implemented
**Scope:** Simple Changelogs policy, setup/onboarding, public version decisions,
release-train reconciliation, handoff receipts, distribution parity, and evals
**Companion plan:**
`2026-08-10-public-release-versioning-deploy-orchestration.md` in the Simple
Changes repository

## Outcome

Give repositories an explicit policy for whether Simple Changelogs may select
new public versions automatically or must wait for user direction, with
independent patch, minor, and major behavior and an optional suggestion when
approval is required.

The recommended default is:

```json
{
  "publicVersioning": {
    "patch": "ask",
    "minor": "ask",
    "major": "ask",
    "suggestWhenAsking": true
  }
}
```

Normal development work continues under `Unreleased`. A public version is
formed only at a proven release boundary. Published releases remain immutable.

Simple Changelogs owns this policy and the resulting version decision. Simple
Changes owns production authority and deployment execution. The setting must
not be duplicated in `.simple-changes.json`.

## Product decisions

| Question | Decision |
| --- | --- |
| Where is automatic public-version authority stored? | Repository `.simple-changelogs.json`. |
| Can a personal preference authorize a release silently? | No. Global preferences may prefill setup, but a repository or current-run confirmation must activate automatic behavior. |
| What is the safe behavior for an older policy with no field? | Ask for every public patch, minor, or major decision and suggest the exact version. |
| What happens to ordinary merged work? | It remains under `Unreleased` until a proven release boundary. |
| Is a bump chosen per pull request? | No. Classify the aggregate target-contained work for one release train. |
| What wins over saved policy? | An exact current user direction, followed by repository release policy and automation evidence. |
| What if the bump or owner is unknown? | Block release finalization and ask; never resolve `unknown` automatically. |
| Are internal/build counters covered? | No. They follow their proven repository flow and separate remote authorities. |
| Is a publicly distributed prerelease public? | Yes. Alpha, beta, and release-candidate publication crosses the public gate. |
| Does version approval authorize deployment or store submission? | Never. |
| How does the consumer discover protocol support? | Simple Changelogs reports a read-only capability record; Simple Changes negotiates the highest mutually supported request and receipt versions. |
| What is the delegation API? | A closed, phase-specific, schema-validated request. Never raw prompt prose. |
| Is normal user approval a failure? | No. Emit `decision-required`; reserve `blocked` for operational, evidence, or contract failures. |
| When is a prepared release final? | Only after a separate read-only `verify` phase proves the reconciliation is contained in the refreshed target. |
| What binds an approval? | The effective-policy and decision digests for the exact transaction, train, inputs, and target revision. |
| How are failures routed? | Closed `reasonCode` and `requiredAction` enums; human-readable reason text is never control flow. |

## Policy model

### Repository policy

Add one optional closed object to every Markdown distribution that owns public
release versions:

```json
{
  "publicVersioning": {
    "patch": "ask",
    "minor": "automatic",
    "major": "ask",
    "suggestWhenAsking": true
  }
}
```

Allowed values:

- `patch`, `minor`, and `major`: `ask` or `automatic`;
- `suggestWhenAsking`: boolean.

The field remains optional for backward compatibility. Absence resolves to the
recommended default, not to the previous implicit automatic behavior.

Do not add the field to the CMS-only policy. An authenticated CMS history does
not own a public product version unless another selected distribution proves a
separate release train.

### Global preferences

Allow the same object in the existing solo-developer global-preferences file,
with deliberately weaker semantics:

- it prefills recommended/customized onboarding;
- it does not become effective release authority in an unconfigured
  repository;
- the user must confirm repository or run-only application before automatic
  values can be used; and
- repository policy and the current request always override it.

This preserves a reusable user preference without turning it into invisible
cross-repository publication authority.

### Run-only selection

Run-only setup may return a resolved `publicVersioning` object without writing
either preference file. Its automatic choices apply only to the current exact
release task and expire when that task ends or its target revision changes.

### Precedence

First resolve repository-owned version sources, release automation, and version
syntax as constraints. Then resolve version-selection authority in this order:

1. exact current direction, such as “release `0.10.0`” or “make this a minor”;
2. a confirmed current-run `publicVersioning` selection;
3. repository `publicVersioning` policy; and
4. the safe missing-field default.

Global preferences are onboarding input, not a fifth runtime authority source.

Repository automation constrains how a version is calculated and written, but
does not bypass `ask`. When policy requires direction, use a documented dry run
or read-only calculation as the suggestion, then wait before invoking the
release-bearing mutation.

## Onboarding design

### Primary question

During customized setup for a version-owning distribution, ask:

> How should new public release versions be chosen?

Offer:

- **Ask before every public version — Recommended:** Keep work under
  `Unreleased`, suggest the next version, and wait before forming a release.
- **Choose patch and minor automatically:** Apply compatible public releases
  automatically, but ask before a major version.
- **Choose all public versions automatically:** Select patch, minor, and major
  versions at proven release boundaries without another version prompt.
- **Customize by bump type:** Choose `ask` or `automatic` separately for patch,
  minor, and major.

The presets are onboarding conveniences. Persist only the resolved granular
object so runtime behavior has one representation.

### Suggestion question

When any selected bump level is `ask`, ask:

> When direction is required, should I suggest the exact next version?

Offer:

- **Suggest a version — Recommended:** Show the exact version, bump level, and
  concise evidence before waiting.
- **Wait without suggesting:** Ask for explicit direction without selecting an
  exact version.

Do not ask this question when all bump levels are automatic. Retain `true` in
the stored object so switching a level back to `ask` remains helpful, unless
the user explicitly selected `false` through deterministic setup.

### Recommended setup

“Use recommended setup” resolves to ask/ask/ask with suggestions on without
adding four questions. The confirmation receipt names the complete resolved
object and explains that:

- work remains under `Unreleased` until release intent exists;
- the policy changes version-selection authority only;
- deployment, publication, store submission, migrations, secrets, and DNS are
  still separate; and
- nothing is written until confirmation.

### Existing repositories

Do not force a broad onboarding replay for existing valid policies.

- Missing `publicVersioning` behaves safely immediately.
- A release-bearing task that needs a version asks for the exact decision under
  the safe default.
- Customized setup may save the preference proactively.
- Bump the guidance version for affected distributions and describe the new
  behavior in `references/guidance-updates.md`.
- Any one-time historical audit remains separate; this policy applies
  prospectively and does not rewrite past releases.

### Coordinated Simple Changes onboarding

When both products need first-run configuration for the same Ship-capable task,
Simple Changelogs returns a structured onboarding contribution: only its
applicable version questions, the resolved policy summary, its exact policy
destination, and owner identity. Simple Changes may present that contribution
with its own questions in one conversation and one combined confirmation.

The confirmed policies still have separate owners and writes. Simple
Changelogs writes only its policy through its canonical setup helper; Simple
Changes writes only `.simple-changes.json`. A coordinated setup transaction may
be `pending`, `completed`, or `partial`. If one owner write succeeds and the
other fails, preserve the valid write and resume idempotently from inspection
and write receipts instead of rolling it back or asking the completed questions
again.

Do not return public-version questions when inspection finds no applicable
version-owning distribution or release train. Never place changelog policy
values in the Simple Changes configuration, its run state, or an integration
shim; only policy and receipt digests cross the ownership boundary.

## Deterministic setup contract

Extend the canonical setup helper and its mirrored distribution copies with
resolved flags:

```sh
bun skills/simple-changelogs/scripts/setup.ts apply \
  --repo . \
  --task-mode write \
  --scope repository \
  --version-patch ask \
  --version-minor ask \
  --version-major ask \
  --version-suggestions on \
  --confirm \
  --json
```

Add flags:

- `--version-patch ask|automatic`
- `--version-minor ask|automatic`
- `--version-major ask|automatic`
- `--version-suggestions on|off`

The non-TTY helper receives resolved granular values rather than preset names.
If any one of the three bump flags is supplied, require all three so automation
cannot accidentally inherit an unstated automatic value. Suggestions may be
omitted only when the complete default is being used.

Extend inspection and setup JSON with the selected, recommended, stored, and
effective object. Validate global preferences, repository policy, run-only
selection, setup summaries, and atomic writes through the same closed schema.

## Integration capability contract

Expose a read-only setup inspection result that Simple Changes can negotiate
before delegation:

```json
{
  "schemaVersion": 1,
  "provider": "simple-changelogs",
  "distribution": "web",
  "guidanceVersion": 14,
  "requestVersions": [1],
  "receiptVersions": [1, 2],
  "features": [
    "public-version-policy",
    "classify-prepare-verify",
    "multi-train-receipts"
  ],
  "schemaDigests": {
    "changelogRequest": "<sha256>",
    "changelogReceipt": "<sha256>"
  }
}
```

Use the actual distribution and guidance version at runtime. Keep the record
closed, deterministic, side-effect-free, and available before policy mutation.
Skill-path presence alone is not compatibility. The consumer selects the
highest mutually supported versions and validates the advertised schema
digests. If there is no overlap, emit no unsupported envelope; report the
upgrade requirement while allowing unrelated non-release work to continue.

## Delegation request protocol v1

Validate a closed request before classifying or editing anything:

```json
{
  "schemaVersion": 1,
  "transactionId": "release-01",
  "releaseSetId": null,
  "phase": "classify",
  "attempt": 1,
  "releaseTrain": "web",
  "boundary": "web-production",
  "environment": "production",
  "mutationScope": "read-only",
  "inputTargetRevision": "0123456789abcdef0123456789abcdef01234567",
  "finalizedTargetRevision": null,
  "approvedVersion": null,
  "approvedDecisionDigest": null,
  "priorReceiptDigest": null,
  "supportedReceiptVersions": [1, 2]
}
```

The lifecycle is:

- `classify`: read-only; resolves applicability, impact, policy, suggestion,
  and whether direction is required;
- `prepare`: the only phase that may use `prepare-release-files`; requires an
  approved or automatic decision digest and may change only established release
  files for that train; and
- `verify`: read-only against `finalizedTargetRevision`; proves the prepared
  reconciliation is integrated into the refreshed target.

Reject a write-capable scope during `classify` or `verify`, a read-only scope
during a mutation-requiring `prepare`, mismatched transaction/train/boundary,
unsupported versions, stale prior receipt digests, and missing phase-specific
fields. `mutationScope` never grants merge, deploy, publication, store, data,
secret, environment, or DNS authority. The request contains resolved values,
not raw user messages, private reasoning, or executable repository text.

## Public-version decision algorithm

### 1. Establish a release boundary

Do not consult the bump policy for an ordinary feature branch, draft proposal,
preview, staging deployment, internal test deployment, code review, or DX-only
change.

Release intent exists only from the current request or proven repository
evidence. Web production is always a product release. Other public deploys,
package publication, store publication, and release-bearing target merges use
their established boundary rules.

### 2. Resolve the release train and version owner

Use the existing `crossSurfaceVersioning`, version-identifier roles, release
automation, history, and destination evidence. Produce one decision per release
train. If ownership or train grouping remains ambiguous, block before applying
the public-version preference.

### 3. Classify aggregate impact

Classify all target-contained pending outcomes for the train together:

- `patch` for repairs, compatible polish, stabilization, or a changed Web
  production target with no customer-facing bullet;
- `minor` for durable compatible capabilities or meaningful workflow changes;
- `major` for incompatible contracts, required migration, removal, or an
  established product-era boundary;
- `none` when no new public release is required; or
- `unknown` when evidence cannot resolve the level.

Elapsed time and proposal count may affect batching, never the bump level.

For `0.x`, first apply the repository's initial-development convention. The
policy key is the actual version delta that will be applied: an incompatible
`0.x` change commonly maps to a minor delta, while `1.0.0` remains a documented
stability or launch boundary.

### 4. Apply exact current direction

An exact current version or bump instruction overrides saved ask/automatic
behavior when it is valid for the train and repository convention. Validate it
against the current version, release history, prerelease train, and automation
owner. Report conflicts rather than coercing the user's value.

### 5. Apply policy

- `automatic`: select the exact next version, explain the decision in the
  handoff, and prepare the release reconciliation without another version
  prompt. This still grants no merge, publication, deployment, or store
  authority.
- `ask` with suggestions: return an approval-required result with exact current
  and suggested versions, bump level, train, target revision, and concise
  evidence. Do not edit released headings or version fields yet.
- `ask` without suggestions: request exact direction and leave the suggested
  version null.
- `unknown`: return blocked regardless of policy.

### 6. Reconcile only after resolution

After an automatic or explicit decision:

- move only target-contained pending items into the selected dated release;
- align only proven mirrors and version fields for that train;
- preserve pending items absent from the target or assigned to another train;
- remove empty `Unreleased` headings only when appropriate;
- produce a digest-bound handoff; and
- never mutate a previously published release to absorb new work.

This is the protocol's `prepare` phase. Its receipt records the reconciliation
head and `targetContainedUnreleased: prepared`; it does not claim that the
release-bearing target contains the work yet.

### 7. Verify the finalized target

After Simple Changes merges the prepared reconciliation and refreshes the
canonical target, accept a read-only `verify` request for that exact finalized
revision. Confirm that the target contains the recorded reconciliation head,
that every selected-version and release-file invariant still holds, and that
the transaction, policy, and decision digests match. Emit `verified` with
`targetContainedUnreleased: integrated` and no changed paths. If containment or
state differs, emit a structured failure and do not repair files during verify.

## Non-public and prerelease behavior

The public policy must not become an umbrella “version everything” permission.

- DX-only work, tests, formatting, refactors, internal plumbing, and dependency
  churn do not create a public version without shipped contract impact.
- Repository-proven local development identifiers or unpublished prerelease
  iterations may advance as normal release-preparation work when the task owns
  them.
- Remote build counters, store metadata, and separately owned automation remain
  under their documented authority and credentials.
- A prerelease that users can install or consume is public and uses the public
  gate.
- A root `package.json` version is public when consumers install that package,
  even if no announcement is planned.

## Changelog receipt protocol v2

Simple Changelogs produces the version decision; Simple Changes validates and
acts on it. Emit the negotiated companion protocol's closed v2 transaction
receipt. Normal approval is `decision-required`, not `blocked`:

```json
{
  "schemaVersion": 2,
  "provider": "simple-changelogs",
  "status": "decision-required",
  "transactionId": "release-01",
  "releaseSetId": null,
  "phase": "classify",
  "observedAt": "2026-08-10T12:00:00-05:00",
  "sourceRevision": "0123456789abcdef0123456789abcdef01234567",
  "revisionLineage": {
    "inputTargetRevision": "0123456789abcdef0123456789abcdef01234567",
    "reconciliationHeadRevision": null,
    "finalizedTargetRevision": null
  },
  "effectivePolicyDigest": "<sha256>",
  "decisionDigest": "<sha256>",
  "paths": [],
  "checks": ["Inspected the exact release-bearing target."],
  "evidence": ["The aggregate target-contained change is a compatible capability release."],
  "releaseImpact": "minor",
  "versionDecision": {
    "releaseTrain": "web",
    "boundary": "web-production",
    "currentVersion": "0.9.0",
    "bumpLevel": "minor",
    "suggestedVersion": "0.10.0",
    "selectedVersion": null,
    "policyAction": "ask",
    "resolution": "approval-required",
    "source": "repository-policy"
  },
  "release": null,
  "reasonCode": "version-direction-required",
  "requiredAction": "choose-version",
  "reason": "Approval is required before creating public version 0.10.0."
}
```

Use the companion protocol's closed values exactly:

- `status`: `decision-required`, `prepared`, `verified`, `not-applicable`, or
  `blocked`;
- `phase`: `classify`, `prepare`, or `verify`;
- `boundary`: `release-bearing-merge`, `web-production`,
  `package-publication`, `store-release`, `other-public-release`, or `none`;
- `bumpLevel`: `none`, `patch`, `minor`, `major`, or `unknown`;
- `policyAction`: `ask`, `automatic`, or `not-applicable`;
- `resolution`: `not-required`, `automatic`, `explicit-direction`,
  `repository-automation`, `approval-required`, or `blocked`; and
- `source`: `current-request`, `repository-policy`, `run-only`, or
  `repository-convention`.

One receipt represents one release train. `releaseSetId` may group several
independent train receipts for reporting, but it never means they are atomic.

### Digest ownership and approval binding

Simple Changelogs calculates `effectivePolicyDigest` from the fully resolved
policy source, granular values, applicable repository convention, automation
owner, and release-train/version-owner mapping. It calculates `decisionDigest`
from at least the transaction, train, boundary, input target revision,
aggregate impact, current/suggested/selected version, policy digest, and
version-owner mapping.

An explicit version direction must reference the prior decision digest. Any
change to policy, ownership, classification input, selected version, schema
negotiation, or target revision produces a new digest and invalidates the old
approval. Receipt, changed-path, and schema digests use the same documented
canonical JSON and SHA-256 rules as the companion protocol.

### Structured reason and action taxonomy

Never branch on the human-readable `reason`. Emit the companion contract's
closed pairs, including:

| `reasonCode` | `requiredAction` |
| --- | --- |
| `version-direction-required` | `choose-version` |
| `target-moved` | `refresh-and-reclassify` |
| `policy-changed` | `refresh-and-reclassify` |
| `release-train-ambiguous` | `resolve-release-train` |
| `version-owner-ambiguous` | `resolve-version-owner` |
| `unsupported-protocol` | `upgrade-producer` |
| `unsupported-consumer` | `upgrade-consumer` |
| `schema-digest-mismatch` | `repair-integration` |
| `malformed-request` | `repair-request` |
| `malformed-policy` | `repair-policy` |
| `invalid-version-direction` | `choose-version` |
| `final-verification-failed` | `review-finalization` |

Both fields may be null only when no action is required. Additions require a
protocol revision or an explicitly extensible namespaced error contract, never
an ad hoc producer-only string.

Required producer behavior:

- `approval-required` returns `decision-required` from `classify`, with no
  release edits and a suggestion only when policy enables it;
- after exact approval, re-inspect the target and accept `prepare` only when the
  target, effective-policy digest, decision digest, and evidence remain current;
- `automatic`, `explicit-direction`, and `repository-automation` select an exact
  version before `prepare`;
- `prepare` changes only the established release paths and returns `prepared`
  with a non-null reconciliation head, matching release version, recorded path
  digests, and `targetContainedUnreleased: prepared`;
- `not-required` returns `not-applicable` with `boundary: none`,
  `bumpLevel: none`, `policyAction: not-applicable`, and no selected or
  suggested version;
- `unknown` returns `blocked` and never invents a version;
- `verify` is read-only, returns `verified` with no changed paths, names the
  exact refreshed finalized target, proves it contains the reconciliation head,
  uses `targetContainedUnreleased: integrated`, and matches the prepared
  transaction, version, effective-policy digest, and decision digest; and
- store-release classification is evidence only, never store authority.

Vendor or generate the released Simple Changes capability, request, receipt,
and digest schemas as pinned producer fixtures with explicit provenance and
expected schema digests. Simple Changelogs owns the semantics used to form
`versionDecision`, but it must not maintain independently edited look-alike
envelopes. Cross-repository CI validates emitted fixtures with the packaged
Simple Changes validator.

## Failure, retry, and immutability rules

- A failed deployment does not select another version.
- Retry, promotion, or target repair reuses a version only for the exact
  immutable revision and decision digest already reconciled into it.
- New code or changed release reconciliation returns to aggregate
  classification.
- Redeploying an exact historical artifact retains its historical release
  identity.
- A corrective code change forms a new release, normally a patch unless the
  aggregate impact says otherwise.
- If deployment happened without valid reconciliation, prepare a forward
  release fix; never edit historical notes to imply the gate ran earlier.
- If approval was bound to an older target revision, return to approval rather
  than carrying it forward.
- If the effective policy changes after approval, return to classification with
  `policy-changed`; do not compare only the visible version string.
- A target containing the prepared reconciliation is verified as a new
  finalized revision. A target that does not contain it returns
  `final-verification-failed` and grants no production authority.
- Interrupted phases resume from transaction, prior receipt, schema, policy,
  and decision digests plus fresh repository evidence; never from parsed reason
  prose or an assumed last command.

## Implementation work

### 1. Extend setup types, validation, and storage

- [ ] Add `PublicVersionAction` and `PublicVersioningPolicy` to
  `tooling/simple-changelogs/scripts/setup.ts`.
- [ ] Extend repository policy, global preferences, selection, recommendation,
  setup result, summaries, CLI parsing, and atomic write verification.
- [ ] Add the four deterministic setup flags and their complete-set
  validation.
- [ ] Update
  `tooling/simple-changelogs/evals/schemas/repo-policy.schema.json`,
  `global-preferences.schema.json`, and `setup-result.schema.json`.
- [ ] Keep the repository field optional and resolve absence to the safe
  default.
- [ ] Ensure all-projects preferences prefill but never silently activate
  automatic behavior.
- [ ] Add structured onboarding-contribution output and owner-write receipts so
  Simple Changes can coordinate one conversation without owning or copying the
  version policy.

### 2. Update conversational onboarding

- [ ] Update `skills/simple-changelogs/references/onboarding.md` with presets,
  granular customization, the conditional suggestion question, and receipt
  wording.
- [ ] Document the combined-conversation presentation contract, separate owner
  confirmation summary, and partial setup resume behavior.
- [ ] Update `skills/simple-changelogs/references/setup.md` with storage,
  precedence, migration, and authority semantics.
- [ ] Apply distribution-appropriate copies to Web, Mobile, Web+CMS, and
  skill-maintainer variants.
- [ ] Exclude CMS-only onboarding unless that distribution later owns a public
  release train by an explicit design change.
- [ ] Add the new guidance-version entry without triggering a historical
  rewrite.

### 3. Update version and lifecycle guidance

- [ ] Rewrite the implicit automatic Web patch rule in every applicable
  `references/version-decisions.md`: a changed target with no customer bullet
  classifies as patch, then follows `publicVersioning`.
- [ ] Update `references/release-lifecycle.md` so release intent does not itself
  grant version-selection authority.
- [ ] Update `references/major-releases.md` so stable-major evidence and
  synthesis remain required even when `major: automatic`.
- [ ] Update `references/automation-verification.md` with approval binding,
  policy source, receipt, and retry checks.
- [ ] Update each applicable `SKILL.md` router and completion contract.

### 4. Add the producer handoff contract

- [ ] Add a canonical handoff reference under
  `skills/simple-changelogs/references/` and route to it from applicable
  distributions.
- [ ] Add pinned capability, request-v1, and receipt-v2 producer
  fixtures/schemas under
  `tooling/simple-changelogs/evals/schemas/`, pinned to the released Simple
  Changes protocol.
- [ ] Expose deterministic, read-only capability inspection with supported
  features, versions, guidance version, and schema digests.
- [ ] Validate phase-specific requests and permit release-file mutation only in
  `prepare`; reject raw or unsupported delegation envelopes.
- [ ] Implement separate classify, prepare, and final read-only verify handlers
  with full revision lineage.
- [ ] Require one receipt per release train and exact transaction/revision;
  allow optional release-set grouping without atomic semantics.
- [ ] Document decision-required, prepared, verified, not-applicable, blocked,
  retry, policy-change, and stale-target examples.
- [ ] Implement canonical effective-policy and decision digest calculation and
  the closed reason/action taxonomy.
- [ ] Ensure public prose never exposes hidden reasoning, prompts, credentials,
  or developer-only evidence.

### 5. Maintain distribution parity

- [ ] Treat `tooling/simple-changelogs/scripts/setup.ts` as the canonical setup
  implementation and synchronize the supported distribution copies through the
  repository's normal fork/parity process.
- [ ] Update full, Web, Mobile, Web+CMS, and skill-maintainer guidance only
  where each distribution owns the affected release boundary.
- [ ] Keep CMS-only schemas and setup unchanged.
- [ ] Extend `tooling/distributions.check.ts` and
  `tooling/simple-changelogs/scripts/tests/schema-parity.check.ts` so a missing
  or divergent policy field fails deterministically.
- [ ] Fail parity when capability metadata, protocol schema provenance, digest
  rules, or phase behavior diverges across applicable distributions.

### 6. Add setup and policy tests

- [ ] Test safe default resolution for old repository policies.
- [ ] Test all three presets as resolved granular objects.
- [ ] Test every custom patch/minor/major combination.
- [ ] Test suggestions on/off and suppression of the suggestion question when
  all levels are automatic.
- [ ] Test repository, all-projects, and run-only scopes.
- [ ] Prove global automatic values require repository/run confirmation.
- [ ] Test malformed, partial, unknown, and extra policy fields.
- [ ] Test atomic write verification and no writes before confirmation.
- [ ] Test coordinated onboarding output, owner-specific destinations, and an
  idempotent resume after either owner write fails.

### 7. Add behavioral evals

- [ ] Default patch classification suggests the exact patch and returns
  `decision-required`.
- [ ] Default minor classification suggests the exact minor and returns
  `decision-required`.
- [ ] Default major classification suggests the exact major and returns
  `decision-required`.
- [ ] Suggestions disabled requests direction without an exact suggestion.
- [ ] Automatic patch, minor, and major produce prepared receipts.
- [ ] `major: ask` requires direction while patch/minor automatic continue.
- [ ] Exact current direction overrides saved ask policy after validation.
- [ ] Repository automation calculates a suggestion but does not bypass ask.
- [ ] Multiple target-contained proposals produce one aggregate decision.
- [ ] A Web production change with no customer bullet classifies as patch and
  follows policy.
- [ ] DX-only and unpublished internal work produce `not-required`.
- [ ] A publicly distributed prerelease uses the public gate.
- [ ] `0.x` mapping follows repository convention and does not infer `1.0.0`.
- [ ] Independent release trains emit separate receipts.
- [ ] Target movement invalidates approval.
- [ ] Effective-policy or version-owner movement invalidates approval.
- [ ] Normal approval emits `decision-required`, not `blocked`.
- [ ] Prepare records a reconciliation head; verify proves it is contained in
  the exact finalized target without changing files.
- [ ] Receipt control flow uses only closed reason/action codes.
- [ ] Capability negotiation covers old consumer/new producer and new
  consumer/old producer without emitting an unreadable schema version.
- [ ] Schema, request, policy, decision, path, and receipt digest mismatches all
  fail closed.
- [ ] Crashes after classify, approval, prepare, merge observation, and verify
  resume idempotently from fresh evidence.
- [ ] Exact retry reuses a version; changed retry reclassifies.
- [ ] Store/mobile cases report separate publication authority.

## Required test matrix

| Policy | Impact | Expected decision |
| --- | --- | --- |
| Field absent | Patch/minor/major | Approval required; exact suggestion present. |
| Ask + suggestions on | Matching level | `decision-required` receipt with suggestion. |
| Ask + suggestions off | Matching level | `decision-required` receipt with null suggestion. |
| Automatic | Matching level | Exact version selected; prepared receipt when reconciliation succeeds. |
| Automatic | Unknown | Blocked; no version selected. |
| Patch/minor automatic, major ask | Major | Approval required. |
| Any | Exact valid current direction | Explicit-direction resolution. |
| Any | Exact invalid direction | Blocked with `invalid-version-direction`; no coercion. |
| Any | No public boundary | Not-required. |
| Any | Public prerelease | Apply public policy. |
| Any | Internal build counter | Outside this policy. |

Additional protocol and recovery cases are mandatory:

| Scenario | Expected result |
| --- | --- |
| Capability versions have no overlap | Emit no request/receipt; report `unsupported-protocol`. |
| Old consumer + new producer | Negotiate down; producer never emits unreadable v2. |
| New consumer + old producer | Use only the documented v1 compatibility behavior. |
| Policy changes after approval | New decision digest; classify and request direction again. |
| Prepared head is contained in refreshed target | Read-only verify returns `verified` with full lineage. |
| Prepared head is absent from refreshed target | `final-verification-failed`; no deploy authority. |
| Verify request revision differs from observed target | Reject as `target-moved`. |
| Grouped release set has one failed train | Separate train receipts remain independent; grouping is non-atomic. |
| Crash at any lifecycle boundary | Resume without a duplicate bump or release-file mutation. |
| Second onboarding owner write fails | Preserve the first write and resume only the missing owner transaction. |

## Cross-repository rollout

1. Wait for a released Simple Changes consumer that validates capabilities,
   request v1, receipt v2, digests, and final verification while retaining
   documented v1 compatibility.
2. Release Simple Changelogs policy/setup support and read-only capability
   reporting without changing default receipt emission.
3. Enable request validation and classify/prepare/verify only after negotiation
   proves the consumer supports their schema versions and digests.
4. Validate packaged producer fixtures and both version-skew directions using
   the packaged Simple Changes CLI.
5. Let Simple Changes require a v2 `verified` receipt for newly formed public
   production releases.
6. Retain v1 output only for the documented compatibility window and
   non-release consumers; never downgrade a decision merely to bypass approval.

If downstream consumer capability cannot be proven, preserve existing safe
local work and report the exact upgrade requirement before preparation rather
than emitting an unvalidated contract.

## Verification

During implementation, run:

```sh
bun run typecheck
bun run lint
bun run test
bun run eval
bun run distros
bun run check
```

Then run the packaged cross-repository fixtures through the released Simple
Changes validators for capabilities, request, decision-required, automatic,
prepared, verified, not-applicable, blocked, retry, independent-train,
version-skew, digest-tamper, and interrupted-phase cases.

Release-note wording authored during implementation must follow the workspace
model rule: use `gpt-5.6-sol` at medium reasoning effort when available, and
state the actual fallback model if it is unavailable.

## Acceptance criteria

- [ ] The safe missing-field default is ask/ask/ask with suggestions on.
- [ ] Repository policy is the only durable automatic public-version authority.
- [ ] Global preferences prefill setup without silently authorizing release.
- [ ] Current exact direction, repository convention, and version ownership are
  resolved before the preference is applied.
- [ ] Decisions are aggregate and scoped to one release train.
- [ ] Capability negotiation proves protocol and schema compatibility before
  delegation; skill-path detection alone is insufficient.
- [ ] Every delegated operation validates a closed phase-specific request, and
  only `prepare` can mutate established release files.
- [ ] `decision-required` represents ordinary user direction; `blocked`
  represents a contract, evidence, or operational failure.
- [ ] Approval is bound to effective-policy and decision digests for the exact
  transaction, train, inputs, ownership, and target.
- [ ] Published versions are immutable and pending work stays under
  `Unreleased` until a proven release boundary.
- [ ] `unknown` never resolves automatically.
- [ ] Non-public identifiers and separately owned remote counters remain
  outside the public policy.
- [ ] A publicly distributed prerelease uses the public gate.
- [ ] Version approval grants no deployment, publication, store, data, secret,
  environment, or DNS authority.
- [ ] Every integration handoff is closed, revision-bound, digest-bound, and
  accepted by the packaged Simple Changes validator.
- [ ] A prepared release is not final until read-only verification proves its
  reconciliation head is contained in the exact refreshed target.
- [ ] Receipts preserve input, reconciliation-head, and finalized-target
  lineage and use structured reason/action codes rather than parsed prose.
- [ ] Optional release-set grouping never implies atomicity across independent
  trains.
- [ ] Coordinated onboarding presents one conversation while preserving
  separate policy ownership and idempotent partial-write recovery.
- [ ] Full, Web, Mobile, Web+CMS, and skill-maintainer distributions remain in
  verified parity where their scopes overlap; CMS-only remains unchanged.
