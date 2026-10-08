---
name: simple-changelogs-mobile
description: Maintain mobile changelogs, in-app notes, and App Store or Google Play metadata. Finalize mobile releases and prepare reusable What to Test instructions for TestFlight and Play test builds. Use when the repository selects the mobile-only Simple Changelogs distribution or installs it as its only changelog skill, not for web or CMS history.
---

# Simple Changelogs Mobile

Maintain durable release history for mobile applications without loading web,
CMS-operator, or skill-package workflows.

- `CHANGELOG.md` explains visible outcomes to mobile users.
- `DEVELOPER_CHANGELOG.md` preserves technical context unless repository policy
  selects a single-changelog workflow.
- Established mobile and store destinations mirror release-scoped highlights.

Requires Git for repository work; bundled TypeScript helpers require Bun 1.3 or
later, and `scripts/check-fork-sync.sh` requires a POSIX shell. When one is
missing, report it instead of improvising the helper's work by hand.

Current guidance version: 25

Guidance is a distribution-specific behavior checkpoint, not the Simple
Changelogs family version or installed source revision. Installation reports
name this distribution, its guidance, and the Git ref or commit when known.

## Distribution checkpoint

Use one changelog-owning distribution per repository.

This distribution is selected when repository instructions or the current user
name `simple-changelogs-mobile`, `.simple-changelogs.json` records
`"distribution": "mobile"`, or this is the sole repo-local changelog
distribution. If selection is absent or conflicting, inspect before writing. A
global installation alone does not override a repository-local full, web, CMS,
web+CMS, or skill-repository distribution.

## Setup checkpoint

Before write-capable work, run the bundled `scripts/setup.ts` inspection helper
and inspect `.simple-changelogs.json`.

- Pass `--task-mode write` for changelog mutations and `--task-mode read` for
  explanations or previews that must stay read-only.
- When inspection returns `guidanceUpdate`, say that Simple Changelogs was
  updated, show up to three practical changes, and explain that saved settings
  and released history are unchanged. Offer three actions: a recommended guided
  review, continuing with the current settings, or opening the detailed release
  notes. A walkthrough explains every new ability, affected setting,
  proposed default, example, consequence, and safety boundary before any
  decision. Ask any listed `questions` once, before those actions; no
  answer records nothing. Ask about a historical backfill only afterward and only when
  `userPrompt` is non-null; never run one automatically. Record the one-time
  disposition with `apply --guidance-backfill <status> --confirm`.
- Validate existing state before relying on it.
- When state is absent and the request authorizes changelog work, follow
  `references/setup.md`, confirm and apply the selected setup, then continue the
  original request without making the user repeat it.
- Read-only questions never create policy or changelog files.
- Existing policies without `distribution` remain compatible only when this
  distribution is otherwise explicitly selected.

Repository instructions take precedence when they define a stricter audience,
release flow, source of truth, or store boundary.

## Reference router

| Concern | Read |
| --- | --- |
| First use, policy, distribution, or signatures | `references/setup.md` |
| Guidance-version changes | `references/guidance-updates.md` |
| Guided first-use onboarding conversation | `references/onboarding.md` |
| Read-only history queries and structure lint | `references/querying.md` |
| Customer/developer classification, expert public detail, and wording | `references/entry-classification.md` |
| Missing files or authorized historical audits | `references/backfill.md` |
| Pending work, releases, merges, and reconciliation | `references/release-lifecycle.md` |
| Version choice and metadata alignment | `references/version-decisions.md` |
| Delegated release classification, preparation, verification, release tags, capability negotiation, or receipts | `references/release-handoff.md` |
| Stable majors and prerelease trains | `references/major-releases.md` |
| Curated public release notes (`RELEASE_NOTES.md`) under a curated policy | `references/curation.md` |
| Mobile/store destination scoping and long-form release notes | `references/release-note-surfaces.md` |
| Finalizing a test build, TestFlight What to Test, Play testing-track copy, or extending an existing tester checklist | `references/testing-notes.md` |
| Presentation and defect checks after an exact in-app surface is authorized | `references/surface-design.md` |
| Final repository-native checks | `references/automation-verification.md` |
| Repository-specific forks | `references/fork-maintenance.md` |

## Core workflow

When preparing or finalizing a mobile test build, prepare its testing notes in
the same task using `references/testing-notes.md`. The build finalizer owns the
first draft; a later distributor reuses and refines it. Preparing these notes
does not itself cut a public release or authorize a build, upload, or rollout.

For release-bearing work (a release, a merge into a release-bearing target, a
public deployment, or a delegated `prepare` or `verify`), copy steps 1–6 into
your reply as a `- [ ]` checklist and tick each only on fresh evidence. Other
changelog edits skip the checklist.

1. Inspect repository instructions, Git state, both changelogs, release
   evidence, mobile package metadata, established in-app/store destinations,
   each destination's app/platform/release scope, and the task diff.
2. Classify each durable mobile outcome as customer, developer, both, or
   neither, then include it in each in-app or store destination only when that
   app and release train are affected.
3. Edit the established Markdown structure. Keep pending work under a single
   `Unreleased` section and follow the recorded signature policy.
4. For release-bearing work, reconcile the intended boundary and update only
   metadata, mobile notes, and store destinations proven to share that release.
5. Review the actual diff and run `scripts/query.ts check` plus
   repository-native checks. Fix what a failure reports and rerun until all
   pass, returning to step 4 for a release-boundary failure and to step 3
   otherwise. Never tick a failed step.
6. Hand off customer/developer decisions, store and in-app dispositions,
   version alignment, checks, and any submission authority still needed. For
   test builds, name the saved checklist and platform-copy paths, exact artifact
   scope, and whether remote notes were read back or remain prepared locally.

## Boundaries

All new and edited release copy must avoid em dashes unless the user explicitly
requests them. This applies to every destination. Repository house style cannot
waive this rule; preserve untouched released history. See
`references/entry-classification.md` for punctuation guidance.

- Do not create or update public web release pages, web modals, CMS operator
  histories, or web navigation.
- Do not submit builds, upload store metadata, create marketplace releases, or
  claim approval merely because note files were edited.
- Do not add a new mobile screen, sheet, modal, route, or dismissal store
  without explicit current authority or documented policy.
- Do not mutate an installed skill to store repository decisions.
- Name each release's tag in its receipt, but never create or push a tag;
  Simple Changes does. Do not create hosted releases, deployments, or unrelated
  product work.

## Completion standard

Complete only when changelog decisions are explicit, raw histories and
established mobile/store destinations agree, release metadata is scoped to the
correct app, web/CMS/internal details remain absent, required signatures are
present, and relevant checks have fresh evidence.
