---
name: simple-changelogs-skill-maintainer
description: Use only inside a repository that develops or distributes agent skills and explicitly selects this Simple Changelogs distribution. Maintain the skill package's public and developer changelogs, release-note copy, guidance-version explanations, fork provenance, and installable package boundaries without app, CMS, mobile, or store-release workflows. Do not use in ordinary product repositories or alongside another changelog-owning distribution for the same task.
---

# Simple Changelogs Skill Maintainer

Maintain release history for repositories whose product is one or more agent
skills. This is the lean Simple Changelogs distribution for skill development
and maintenance, not an application changelog distribution.

- `CHANGELOG.md` explains useful changes to skill users and adopters.
- `DEVELOPER_CHANGELOG.md` preserves evaluation, packaging, schema, adapter,
  compatibility, and release-process context.
- Packaged or CLI-readable release notes mirror released public history only.
- Maintainer-only adapters, fixtures, evals, and fork machinery remain outside
  installable skill directories.

Current guidance version: 4

## Distribution checkpoint

Use one changelog-owning distribution per repository.

This distribution is selected when repository instructions or the current user
name `simple-changelogs-skill-maintainer`, `.simple-changelogs.json` records
`"distribution": "skill-repository"`, or this is the sole repo-local changelog
distribution in a repository that publishes agent skills.

Do not infer selection merely because an ordinary product repository contains a
`SKILL.md`. If another Simple Changelogs distribution owns the repository,
defer to it. A global installation alone never overrides repo-local selection.

## Setup checkpoint

Before write-capable work, run the bundled `scripts/setup.ts` inspection helper
and inspect `.simple-changelogs.json`.

- Pass `--task-mode write` for release-history mutations and `--task-mode read`
  for explanations or previews that must stay read-only.
- Validate existing state before relying on it.
- When state is absent and the request authorizes release-history work, follow
  `references/setup.md`, confirm and apply the selected setup with
  `distribution: "skill-repository"`, then continue the original request.
- Read-only questions never create policy or changelog files.
- Existing released history defaults to a full initial backfill after the user
  confirms onboarding; the final question offers deferral or refusal.

Repository instructions take precedence for package layout, release source,
versioning, eval requirements, publication flow, and generated mirrors.

## Reference router

| Concern | Read |
| --- | --- |
| First use, policy, distribution, or signatures | `references/setup.md` |
| Guidance-version changes | `references/guidance-updates.md` |
| User/developer classification and wording | `references/entry-classification.md` |
| Missing files or authorized historical audits | `references/backfill.md` |
| Pending work, releases, merges, and reconciliation | `references/release-lifecycle.md` |
| Version choice and metadata alignment | `references/version-decisions.md` |
| Stable majors and prerelease trains | `references/major-releases.md` |
| Packaged notes and skill-repository releases | `references/release-note-surfaces.md` |
| Package shape and distribution verification | `references/automation-verification.md` |
| Fork provenance and upstream drift | `references/fork-maintenance.md` |

## Core workflow

1. Inspect repository instructions, Git state, public and developer histories,
   skill directories, package manifests, install docs, release-note readers,
   evals, and the task diff.
2. Classify changes by audience. Skill behavior, compatibility, user-visible
   safety, installation, and output changes usually belong in public history;
   harness, schema, adapter, fixture, and release mechanics belong in developer
   history unless they affect adopters directly.
3. Edit the established Markdown structure. Keep pending work under a nonempty
   `Unreleased` section and follow signature policy.
4. For release-bearing work, reconcile versions and packaged public notes with
   the intended boundary. Never expose `Unreleased`, developer-only detail, or
   raw signature comments through a read-only CLI or packaged note surface.
5. Verify every installable directory is self-contained, contains exactly one
   discoverable `SKILL.md`, and excludes maintainer-only tooling.
6. Run repository-native checks and a real package/consumer install check when
   the repository provides one.
7. Hand off public/developer decisions, package and version map, fork
   provenance, checks, and any publish authority still needed.

## Boundaries

- Do not create product-app routes, modals, screens, CMS history, mobile/store
  notes, or app release metadata.
- Do not make eval harnesses discoverable as skills. A tooling directory must
  not contain `SKILL.md`.
- Do not put model adapters, credentials, eval fixtures, tests, or contributor
  protocols into a public skill merely because they test it.
- Do not mutate globally installed skills to remember repository decisions.
- Do not publish packages, push tags, create hosted releases, or synchronize
  forks unless the current request separately authorizes those actions.

## Completion standard

Complete only when public and developer decisions are explicit, released
package notes agree with canonical public history, installable skill boundaries
are lean and self-contained, fork pins are honest, and repository-native plus
package-shape checks have fresh evidence.
