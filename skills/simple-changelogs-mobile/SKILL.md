---
name: simple-changelogs-mobile
description: Use only for a repository that explicitly selects the mobile-only Simple Changelogs distribution, including a repo-local installation of this sole changelog distro. Maintain customer and optional developer changelogs, mobile in-app release notes, and existing App Store or Google Play metadata. Do not use for web or CMS surfaces, skill-package release maintenance, or when another Simple Changelogs distribution owns the repository.
---

# Simple Changelogs Mobile

Maintain durable release history for mobile applications without loading web,
CMS-operator, or skill-package workflows.

- `CHANGELOG.md` explains visible outcomes to mobile users.
- `DEVELOPER_CHANGELOG.md` preserves technical context unless repository policy
  selects a single-changelog workflow.
- Established mobile and store destinations mirror release-scoped highlights.

Current guidance version: 11

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
| Customer/developer classification, expert public detail, and wording | `references/entry-classification.md` |
| Missing files or authorized historical audits | `references/backfill.md` |
| Pending work, releases, merges, and reconciliation | `references/release-lifecycle.md` |
| Version choice and metadata alignment | `references/version-decisions.md` |
| Stable majors and prerelease trains | `references/major-releases.md` |
| Mobile/store destination scoping and long-form release notes | `references/release-note-surfaces.md` |
| Presentation and defect checks after an exact in-app surface is authorized | `references/surface-design.md` |
| Final repository-native checks | `references/automation-verification.md` |
| Repository-specific forks | `references/fork-maintenance.md` |

## Core workflow

1. Inspect repository instructions, Git state, both changelogs, release
   evidence, mobile package metadata, established in-app/store destinations,
   each destination's app/platform/release scope, and the task diff.
2. Classify each durable mobile outcome as customer, developer, both, or
   neither, then include it in each in-app or store destination only when that
   app and release train are affected.
3. Edit the established Markdown structure. Keep pending work under a nonempty
   `Unreleased` section and follow the recorded signature policy.
4. For release-bearing work, reconcile the intended boundary and update only
   metadata, mobile notes, and store destinations proven to share that release.
5. Review the actual diff and run repository-native checks.
6. Hand off customer/developer decisions, store and in-app dispositions,
   version alignment, checks, and any submission authority still needed.

## Boundaries

- Do not create or update public web release pages, web modals, CMS operator
  histories, or web navigation.
- Do not submit builds, upload store metadata, create marketplace releases, or
  claim approval merely because note files were edited.
- Do not add a new mobile screen, sheet, modal, route, or dismissal store
  without explicit current authority or documented policy.
- Do not mutate an installed skill to store repository decisions.
- Do not create tags, hosted releases, deployments, or unrelated product work.

## Completion standard

Complete only when changelog decisions are explicit, raw histories and
established mobile/store destinations agree, release metadata is scoped to the
correct app, web/CMS/internal details remain absent, required signatures are
present, and relevant checks have fresh evidence.
