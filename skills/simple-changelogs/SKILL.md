---
name: simple-changelogs
description: Maintain changelogs and release notes across web, mobile, store, and internal destinations. Update histories, choose versions, finalize releases, and prepare reusable What to Test instructions when finalizing mobile test builds. The default Simple Changelogs distribution unless the repository selects a narrower one.
license: Apache-2.0
compatibility: Requires Git and Bun 1.3 or later; check-fork-sync.sh requires a POSIX shell
---

# Simple Changelogs

Maintain two complementary histories:

- `CHANGELOG.md` communicates durable visible outcomes to customers, users,
  stakeholders, and operators.
- `DEVELOPER_CHANGELOG.md` preserves technical context that future maintainers
  should not have to reconstruct from commits.

Requires Git for repository work; bundled TypeScript helpers require Bun 1.3 or
later, and `scripts/check-fork-sync.sh` requires a POSIX shell. When one is
missing, report it instead of improvising the helper's work by hand.

Current guidance version: 26

Guidance is a distribution-specific behavior checkpoint, not the Simple
Changelogs family version or installed source revision. Installation reports
name this distribution, its guidance, and the Git ref or commit when known.

## Distribution Checkpoint

Use one changelog-owning distribution per repository.

The full distribution is selected when `.simple-changelogs.json` records
`"distribution": "full"`, repository instructions or the current user name
`simple-changelogs`, this is the sole repo-local changelog distribution, or an
existing policy omits `distribution` and no narrower distribution is otherwise
selected.

A global installation alone does not override a repository-local CMS, web,
mobile, web+CMS, or skill-repository distribution. If selection is conflicting,
stop before writing and report the conflict rather than running two changelog
workflows.

## Setup Checkpoint

Before a write-capable changelog task, run the bundled `scripts/setup.ts`
inspection helper and inspect `.simple-changelogs.json` at the repository root.

- Classify the current request as `write` or `read` and pass that task mode to
  the helper. Read-only requests never enter or persist onboarding.
- When inspection returns `guidanceUpdate`, say that Simple Changelogs was
  updated, show up to three practical changes, and explain that saved settings
  and released history are unchanged. Offer three actions: a recommended guided
  review, continuing with the current settings, or opening the detailed release
  notes. A walkthrough explains every new ability, affected setting,
  proposed default, example, consequence, and safety boundary before any
  decision. Ask any listed `questions` once, before those actions; no
  answer records nothing. Ask about a
  historical backfill only afterward and only when `userPrompt` is non-null;
  never run one automatically. Record the one-time disposition with
  `apply --guidance-backfill <status> --confirm`.
- When it exists, validate it before relying on its decisions. Report malformed
  or unsupported state; do not silently replace it.
- When it is absent and the request authorizes changelog work, follow
  `references/setup.md`, confirm the helper's receipt, apply the chosen setup,
  then continue the original task without asking the user to repeat it.
- If released history exists, recommended initial onboarding includes the full
  backfill by default and asks last whether the user wants to defer or decline.
  Nothing is written until the user confirms the displayed setup receipt.
- When the request is read-only, answer without writing policy or changelog
  files. Offer setup as a possible next action.

Repository instructions take precedence when they establish a stricter scope,
audience, release process, or source of truth.

## Reference Router

Read only the references needed for the current branch of work:

| Concern | Canonical reference |
| --- | --- |
| First use, policy state, setup prompts, or raw-markdown signatures | `references/setup.md` |
| Guidance-version changes and their user-readable effects | `references/guidance-updates.md` |
| Guided first-use onboarding conversation | `references/onboarding.md` |
| Reading histories, merges missing an entry, structure and store-note lint | `references/querying.md` |
| Customer/developer classification, expert public detail, wording, grouping, or hot fixes | `references/entry-classification.md` |
| Missing files, history reconstruction, or approved historical audits | `references/backfill.md` |
| `Unreleased`, release intent, merges, deployments, or reconciliation | `references/release-lifecycle.md` |
| SemVer, version choice, or metadata alignment | `references/version-decisions.md` |
| Apps sharing one version number (`sharedVersionLines`) | `references/shared-version-lines.md` |
| Delegated release classification, preparation, verification, release tags, capability negotiation, or receipts | `references/release-handoff.md`; request v2 or v3 also `references/shared-version-lines.md` |
| `1.0.0`, later major versions, prerelease trains, or major-release synthesis | `references/major-releases.md` |
| Curated public release notes (`RELEASE_NOTES.md`) under a curated policy | `references/curation.md` |
| Existing release-note sync, long-form expert archives, destination scoping, or authorized product surfaces | `references/release-note-surfaces.md` |
| Finalizing a mobile test build, TestFlight What to Test, Play testing-track copy, or extending an existing tester checklist | `references/testing-notes.md` |
| Presentation and defect checks after an exact product surface is authorized | `references/surface-design.md` |
| Final checks and repository-native automation | `references/automation-verification.md` |
| Fork provenance, selection convention, or upstream drift | `references/fork-maintenance.md` |

## Core Workflow

When preparing or finalizing a mobile test build, prepare its testing notes in
the same task using `references/testing-notes.md`. The build finalizer owns the
first draft; a later distributor reuses and refines it. Preparing these notes
does not itself cut a public release or authorize a build, upload, or rollout.

For release-bearing work (a release, a merge into a release-bearing target, a
production deployment, or a delegated `prepare` or `verify`), copy steps 1–6
into your reply as a `- [ ]` checklist and tick each only on fresh evidence.
Other changelog edits skip the checklist.

### 1. Inspect

Read repository instructions, Git state, recent history, and the files changed
by the task. Read both changelogs through `scripts/query.ts`: `releases` for
the outline, `show unreleased` for pending work, and `gaps` for merges since
the last release tag without an entry. Open a whole changelog only for a
backfill or an approved audit. Inventory every affected release-note
destination and its audience, product, app or package, platform, release train,
source, inclusion rules, and exclusions. Inspect diffs when commit subjects do
not reveal visible impact. For repositories with web and mobile products, read
the recorded mobile-release-note placement before synchronizing either history.
Establish release intent before touching released headings or release metadata.

### 2. Classify

Decide whether each outcome belongs in the customer history, developer history,
both, or neither. Then classify it independently for each affected destination;
a shared version does not make web, mobile, store, CMS, package, and internal
eligible sets identical. Base customer inclusion on durable audience impact,
then apply the general or proven expert public detail budget. Preserve useful
implementation context separately.

### 3. Edit

Use the repository's established Markdown structure. Keep pending work under a
single `Unreleased` section, combine related outcomes, and apply the
repository's signature policy owned by `references/setup.md` to each contiguous
raw-markdown block you change.

### 4. Reconcile

For release-bearing work, reconcile pending entries with the intended release
boundary. A production Web deployment is always a product release: version and
integrate every target-contained `Unreleased` item before deployment, then
update only metadata and existing release-note destinations proven to belong to
that release flow. Filter each destination through its own scope map.

### 5. Verify

Review the actual diff, apply the checklist in
`references/automation-verification.md`, and run `scripts/query.ts check` plus
relevant repository checks. Treat reported claims as context; filesystem and
command evidence establish what changed.

Verification is a loop: fix what a failing check reports and rerun until all
pass, returning to step 4 when the failure involves the release boundary and to
step 3 otherwise. Never tick a failed step.

### 6. Hand Off

State the customer-changelog decision, developer-changelog decision, release
state, checks run, and any authorization or credential still needed. For test
builds, name the saved checklist and platform-copy paths, exact artifact scope,
and whether the remote notes were read back or remain prepared locally. When
released metadata was examined, identify each relevant source and its outcome.

## Non-Negotiable Boundaries

All new and edited release copy must avoid em dashes unless the user explicitly
requests them. This applies to every destination. Repository house style cannot
waive this rule; preserve untouched released history. See
`references/entry-classification.md` for punctuation guidance.

Do not rewrite released history merely because newer guidance would word it
differently. Historical audits and meaning-changing edits follow
`references/backfill.md`.

Do not create or wire a new release-note modal, route, screen, page, navigation
entry, dismissal store, or internal operator surface unless the current request
explicitly authorizes it, documented repository policy permits it, or stored
policy grants ongoing permission.

Updating an existing documented release-note destination is ordinary sync work
when it belongs to the active release. A one-off explicit request can authorize
one new destination without changing the repository's ongoing preference.

Do not render developer, security, or operational notes into an authenticated
area until local access policy proves that its audience is authorized.

Do not invent agent identity, model version, timestamp, timezone, release
version, shipped state, audience, or repository policy. Use the documented
unknown value or report the missing evidence.

Do not mutate a globally installed or packaged skill to remember repository
decisions. All durable guidance and authorization state belongs in the target
repository.

A repository-local fork is preferred by project convention when both local and
global copies are discoverable. Never claim the runtime loader enforces that
choice; use repository instructions when explicit selection is necessary.

Name each release's tag in its receipt, but never create or push a tag; Simple
Changes does. Do not create hosted releases, deployments, screenshots, or
unrelated product implementation unless the current request separately
authorizes that work.

## Completion Standard

The task is complete only when the changelog decision is explicit, affected raw
files and established mirrors agree, pending/released boundaries are honest,
required signatures are present, every affected destination contains only its
relevant audience and platform outcomes, and relevant verification has fresh
evidence. Web production is incomplete while its release version is unresolved,
its release reconciliation is unmerged, or target-contained work remains under
`Unreleased`.

If blocked, leave resumable repository state and name the exact decision,
authority, credential, or source-of-truth evidence that is missing.
