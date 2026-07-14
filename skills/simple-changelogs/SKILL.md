---
name: simple-changelogs
description: Use when creating, updating, backfilling, classifying, reconciling, or finalizing customer or developer changelogs, release notes, "What's New" content, store notes, release metadata, version fields, or explicit changelog decisions during push, merge, release, or deploy preparation.
---

# Simple Changelogs

Maintain two complementary histories:

- `CHANGELOG.md` communicates durable visible outcomes to customers, users,
  stakeholders, and operators.
- `DEVELOPER_CHANGELOG.md` preserves technical context that future maintainers
  should not have to reconstruct from commits.

Current guidance version: 2

## Setup Checkpoint

Before a write-capable changelog task, look for `.simple-changelogs.json` at the
repository root.

- When it exists, validate it before relying on its decisions. Report malformed
  or unsupported state; do not silently replace it.
- When it is absent and the request authorizes changelog work, follow
  `references/setup.md`, then continue the original task.
- If released history exists and the request does not decide its audit, ask and
  stop before writing policy or changelogs. Silence is not `deferred` or
  `declined`.
- When the request is read-only, answer without writing policy or changelog
  files. Offer setup as a possible next action.
- When recorded guidance is older than version 2, read
  `references/guidance-updates.md` and follow its one-time disposition flow.

Repository instructions take precedence when they establish a stricter scope,
audience, release process, or source of truth.

## Reference Router

Read only the references needed for the current branch of work:

| Concern | Canonical reference |
| --- | --- |
| First use, policy state, setup prompts, or raw-markdown signatures | `references/setup.md` |
| Guidance-version changes and their user-readable effects | `references/guidance-updates.md` |
| Customer/developer classification, wording, grouping, or hot fixes | `references/entry-classification.md` |
| Missing files, history reconstruction, or approved historical audits | `references/backfill.md` |
| `Unreleased`, release intent, merges, deployments, or reconciliation | `references/release-lifecycle.md` |
| SemVer, version choice, or metadata alignment | `references/version-decisions.md` |
| Existing release-note sync or authorized product surfaces | `references/release-note-surfaces.md` |
| Final checks and repository-native automation | `references/automation-verification.md` |
| Fork provenance, selection convention, or upstream drift | `references/fork-maintenance.md` |
| Running or extending the evaluation harness | `EVAL.md` |

## Core Workflow

### 1. Inspect

Read repository instructions, Git state, recent history, both changelogs, and
the files changed by the task. Inspect diffs when commit subjects do not reveal
visible impact. Establish release intent before touching released headings or
release metadata.

### 2. Classify

Decide whether each outcome belongs in the customer history, developer history,
both, or neither. Base customer inclusion on durable audience impact, then apply
the public detail budget. Preserve useful implementation context separately.

### 3. Edit

Use the repository's established Markdown structure. Keep pending work under a
nonempty `Unreleased` section, combine related outcomes, and apply the
repository's signature policy owned by `references/setup.md` to each contiguous
raw-markdown block you change.

### 4. Reconcile

For release-bearing work, reconcile pending entries with the intended release
boundary. Update only metadata and existing release-note destinations proven to
belong to that same release flow.

### 5. Verify

Review the actual diff, apply the checklist in
`references/automation-verification.md`, and run relevant repository checks.
Treat reported claims as context; filesystem and command evidence establish
what changed.

### 6. Hand Off

State the customer-changelog decision, developer-changelog decision, release
state, checks run, and any authorization or credential still needed. When
released metadata was examined, identify each relevant source and its outcome.

## Non-Negotiable Boundaries

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

Do not create tags, hosted releases, deployments, screenshots, or unrelated
product implementation unless the current request separately authorizes that
work.

## Completion Standard

The task is complete only when the changelog decision is explicit, affected raw
files and established mirrors agree, pending/released boundaries are honest,
required signatures are present, and relevant verification has fresh evidence.

If blocked, leave resumable repository state and name the exact decision,
authority, credential, or source-of-truth evidence that is missing.
