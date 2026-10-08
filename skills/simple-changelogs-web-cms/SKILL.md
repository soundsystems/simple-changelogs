---
name: simple-changelogs-web-cms
description: Maintain public web changelogs and release notes plus a separate authenticated CMS operator history. Update customer, developer, and operator entries and finalize web releases. Use when the repository selects the web-plus-CMS Simple Changelogs distribution, not for mobile or store history.
---

# Simple Changelogs Web + CMS

Maintain two audience-separated release systems in one repository:

- `CHANGELOG.md` communicates durable visible outcomes to customers.
- `DEVELOPER_CHANGELOG.md` preserves maintainer context unless repository policy
  selects a single-changelog workflow.
- `CMS_CHANGELOG.json` records structured outcomes for authenticated operators.
- Established public web and protected CMS destinations render only their own
  authorized source.

Requires Git for repository work; bundled TypeScript helpers require Bun 1.3 or
later, and `scripts/check-fork-sync.sh` requires a POSIX shell. When one is
missing, report it instead of improvising the helper's work by hand.

Current guidance version: 25

Guidance is a distribution-specific behavior checkpoint, not the Simple
Changelogs family version or installed source revision. Installation reports
name this distribution, its guidance, and the Git ref or commit when known.
Current CMS guidance version: 2

## Distribution checkpoint

Use one changelog-owning distribution per repository.

This distribution is selected when repository instructions or the current user
name `simple-changelogs-web-cms`, `.simple-changelogs.json` records
`"distribution": "web-cms"`, or this is the sole repo-local changelog
distribution. If selection is absent or conflicting, inspect before writing. A
global installation alone does not override another repo-local distribution.

The combined distribution owns both `.simple-changelogs.json` and
`.simple-changelogs-cms.json`. Do not also invoke `simple-changelogs-web` or
`simple-changelogs-cms` for the same task.

## Setup checkpoint

Before write-capable work, run the bundled `scripts/setup.ts` inspection helper:

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
- Inspect and validate both policy files when present.
- For public/developer setup, follow `references/setup.md`.
- For operator-history setup, follow `references/cms-setup.md`.
- Confirm one combined receipt, apply both policies as one transaction, and
  continue the original request without asking the user to repeat it.
- Existing released history defaults to a full initial backfill after the user
  confirms onboarding; the final question offers deferral or refusal.
- Read-only questions never create policy, changelog, JSON, or UI files.

Repository instructions take precedence when they define stricter audience,
access, release, source-of-truth, or surface rules.

## Reference router

| Concern | Read |
| --- | --- |
| Public/developer setup, distribution, or signatures | `references/setup.md` |
| Public guidance changes | `references/guidance-updates.md` |
| Guided first-use onboarding conversation | `references/onboarding.md` |
| Read-only history queries and structure lint | `references/querying.md` |
| Customer/developer classification and expert public detail | `references/entry-classification.md` |
| Public history reconstruction | `references/backfill.md` |
| Release boundaries and reconciliation | `references/release-lifecycle.md` |
| Versions and metadata | `references/version-decisions.md` |
| Delegated release classification, preparation, verification, release tags, capability negotiation, or receipts | `references/release-handoff.md` |
| Stable majors and prereleases | `references/major-releases.md` |
| Curated public release notes (`RELEASE_NOTES.md`) under a curated policy | `references/curation.md` |
| Public web/CMS destination scoping and long-form web notes | `references/release-note-surfaces.md` |
| Presentation and defect checks after an exact public or operator surface is authorized | `references/surface-design.md` |
| CMS policy and structured source | `references/cms-setup.md` |
| CMS operator classification | `references/cms-entry-classification.md` |
| CMS historical reconstruction | `references/cms-backfill.md` |
| CMS authentication and rendering | `references/cms-surface.md` |
| CMS verification | `references/cms-verification.md` |
| Final public/developer checks | `references/automation-verification.md` |
| Repository-specific forks | `references/fork-maintenance.md` |

## Core workflow

For release-bearing work (a release, a merge into a release-bearing target, a
production deployment, or a delegated `prepare` or `verify`), copy steps 1–6
into your reply as a `- [ ]` checklist and tick each only on fresh evidence.
Other changelog edits skip the checklist.

1. Inspect repository instructions, Git state, all three histories, both policy
   files, release evidence, public web destinations, the CMS route and access
   guard, each destination's audience/app/release scope, and the task diff.
2. Classify each outcome independently for customers, maintainers, and
   authenticated operators. One outcome may belong to multiple sources only
   when each audience is independently affected; wording and detail must fit
   each audience.
3. Edit each canonical source. Keep Markdown pending work under `Unreleased`;
   keep CMS JSON valid, newest-first, and stable-ID based.
4. Reconcile the intended release boundary. A production Web deployment is
   always a product release: version and integrate every target-contained
   public or developer `Unreleased` item first, then update only destinations
   and metadata proven to share that release. Never render CMS-only detail into
   public history.
5. Run `bun scripts/validate-cms.ts /path/to/repository` and
   `scripts/query.ts check`, inspect the actual diff, verify the CMS access
   boundary, and run repository-native checks. Fix what a failure reports and
   rerun until all pass, returning to step 4 for a release-boundary failure and
   to step 3 otherwise. Never tick a failed step.
6. Hand off source decisions by audience, release state, destination
   synchronization, authentication evidence, checks, and unresolved authority.

## Boundaries

All new and edited release copy must avoid em dashes unless the user explicitly
requests them. This applies to every destination. Repository house style cannot
waive this rule; preserve untouched released history. See
`references/entry-classification.md` for punctuation guidance.

- Public and CMS sources are peers for different audiences; neither is a
  generated superset of the other.
- Do not expose CMS history through public pages, feeds, sitemaps, metadata,
  APIs, or customer announcements.
- Do not add a web or CMS route, modal, page, panel, navigation item, or
  notification without explicit current authority or documented policy.
- Do not create or update mobile/store notes or submission metadata.
- Do not mutate an installed skill to remember repository decisions.
- Name each release's tag in its receipt, but never create or push a tag;
  Simple Changes does. Do not create hosted releases, deployments, or unrelated
  product work.

## Completion standard

Complete only when all affected sources validate, audience boundaries are
preserved, public and protected destinations agree with their own source,
released/pending state is honest, authentication is proven from code and tests,
representative wrong-channel entries remain absent, and repository-native checks
have fresh evidence. Web production is incomplete while its release version is
unresolved, release reconciliation is unmerged, or target-contained work
remains under `Unreleased`.
