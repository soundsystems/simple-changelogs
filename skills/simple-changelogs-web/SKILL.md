---
name: simple-changelogs-web
description: Use only for a repository that explicitly selects the web-only Simple Changelogs distribution, including a repo-local installation of this sole changelog distro. Maintain customer and optional developer changelogs plus established public web release-note destinations. Do not use for mobile/store notes, authenticated CMS operator history, skill-package release maintenance, or when another Simple Changelogs distribution owns the repository.
---

# Simple Changelogs Web

Maintain durable release history for a web product without loading mobile,
store, CMS-operator, or skill-package workflows.

- `CHANGELOG.md` explains visible outcomes to customers.
- `DEVELOPER_CHANGELOG.md` preserves technical context unless repository policy
  selects a single-changelog workflow.
- Established public web release-note destinations mirror selected highlights.

Current guidance version: 15

## Distribution checkpoint

Use one changelog-owning distribution per repository.

This distribution is selected when repository instructions or the current user
name `simple-changelogs-web`, `.simple-changelogs.json` records
`"distribution": "web"`, or this is the sole repo-local changelog distribution.
If selection is absent or conflicting, inspect before writing. A global
installation alone does not override a repository-local full, mobile, CMS,
web+CMS, or skill-repository distribution.

## Setup checkpoint

Before write-capable work, run the bundled `scripts/setup.ts` inspection helper
and inspect `.simple-changelogs.json`.

- Pass `--task-mode write` for changelog mutations and `--task-mode read` for
  explanations or previews that must stay read-only.
- When inspection returns `guidanceUpdate`, explain the material change and
  offer its detailed skill release notes. Ask about a backfill only when
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
release flow, source of truth, or surface boundary.

## Reference router

| Concern | Read |
| --- | --- |
| First use, policy, distribution, or signatures | `references/setup.md` |
| Guidance-version changes | `references/guidance-updates.md` |
| Customer/developer classification, expert public detail, and wording | `references/entry-classification.md` |
| Missing files or authorized historical audits | `references/backfill.md` |
| Pending work, releases, merges, and reconciliation | `references/release-lifecycle.md` |
| Version choice and metadata alignment | `references/version-decisions.md` |
| Delegated release classification, preparation, verification, capability negotiation, or receipts | `references/release-handoff.md` |
| Stable majors and prerelease trains | `references/major-releases.md` |
| Public web destination scoping and long-form release notes | `references/release-note-surfaces.md` |
| Presentation and defect checks after an exact web surface is authorized | `references/surface-design.md` |
| Final repository-native checks | `references/automation-verification.md` |
| Repository-specific forks | `references/fork-maintenance.md` |

## Core workflow

1. Inspect repository instructions, Git state, both changelogs, release
   evidence, established public web destinations, their audience/app/release
   scope, and the task diff.
2. Classify each durable outcome as customer, developer, both, or neither, then
   include it in a web destination only when web or proven shared impact exists.
3. Edit the established Markdown structure. Keep pending work under a nonempty
   `Unreleased` section and follow the recorded signature policy.
4. For release-bearing work, reconcile the intended boundary. A production Web
   deployment is always a product release: version and integrate every
   target-contained `Unreleased` item first, then update only metadata and
   existing Web destinations proven to share that release.
5. Review the actual diff and run repository-native checks.
6. Hand off customer/developer decisions, release state, synchronized
   destinations, checks, and any authority still needed.

## Boundaries

- Do not create or update mobile in-app notes, App Store, Google Play,
  TestFlight, marketplace, or store-submission metadata.
- Do not create `CMS_CHANGELOG.json` or an authenticated operator history.
- Do not add a new web route, page, modal, panel, navigation item, or
  notification without explicit current authority or documented policy.
- Do not mutate an installed skill to store repository decisions.
- Do not create tags, hosted releases, deployments, or unrelated product work.

## Completion standard

Complete only when changelog decisions are explicit, raw files and established
web mirrors agree, pending/released boundaries are honest, required signatures
are present, wrong-platform and wrong-role details remain absent, and relevant
checks have fresh evidence. Production is incomplete while its release version
is unresolved, release reconciliation is unmerged, or target-contained work
remains under `Unreleased`.
