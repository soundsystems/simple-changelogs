---
name: simple-changelogs-web-cms
description: Use only for a repository that explicitly selects the combined web-plus-CMS Simple Changelogs distribution. Maintain public customer and optional developer changelogs, established public web release notes, and a separate authenticated CMS operator history. Do not use for mobile/store notes, skill-package release maintenance, or when another Simple Changelogs distribution owns the repository.
---

# Simple Changelogs Web + CMS

Maintain two audience-separated release systems in one repository:

- `CHANGELOG.md` communicates durable visible outcomes to customers.
- `DEVELOPER_CHANGELOG.md` preserves maintainer context unless repository policy
  selects a single-changelog workflow.
- `CMS_CHANGELOG.json` records structured outcomes for authenticated operators.
- Established public web and protected CMS destinations render only their own
  authorized source.

Current guidance version: 13
Current CMS guidance version: 1

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
| Customer/developer classification and expert public detail | `references/entry-classification.md` |
| Public history reconstruction | `references/backfill.md` |
| Release boundaries and reconciliation | `references/release-lifecycle.md` |
| Versions and metadata | `references/version-decisions.md` |
| Stable majors and prereleases | `references/major-releases.md` |
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
5. Run `bun scripts/validate-cms.ts /path/to/repository`, inspect the actual
   diff, verify the CMS access boundary, and run repository-native checks.
6. Hand off source decisions by audience, release state, destination
   synchronization, authentication evidence, checks, and unresolved authority.

## Boundaries

- Public and CMS sources are peers for different audiences; neither is a
  generated superset of the other.
- Do not expose CMS history through public pages, feeds, sitemaps, metadata,
  APIs, or customer announcements.
- Do not add a web or CMS route, modal, page, panel, navigation item, or
  notification without explicit current authority or documented policy.
- Do not create or update mobile/store notes or submission metadata.
- Do not mutate an installed skill to remember repository decisions.
- Do not create tags, hosted releases, deployments, or unrelated product work.

## Completion standard

Complete only when all affected sources validate, audience boundaries are
preserved, public and protected destinations agree with their own source,
released/pending state is honest, authentication is proven from code and tests,
representative wrong-channel entries remain absent, and repository-native checks
have fresh evidence. Web production is incomplete while its release version is
unresolved, release reconciliation is unmerged, or target-contained work
remains under `Unreleased`.
