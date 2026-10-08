---
name: simple-changelogs-skill-maintainer
description: Maintain changelogs and release notes for agent-skill packages, including guidance-version explanations, fork provenance, and installable package boundaries. Use when a skill repository selects the skill-repository Simple Changelogs distribution, not for product apps, CMS, mobile, or store releases.
license: Apache-2.0
compatibility: Requires Git and Bun 1.3 or later; check-fork-sync.sh requires a POSIX shell
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
| Guided first-use onboarding conversation | `references/onboarding.md` |
| Reading histories, merges missing an entry, structure and store-note lint | `references/querying.md` |
| User/developer classification and wording | `references/entry-classification.md` |
| Missing files or authorized historical audits | `references/backfill.md` |
| Pending work, releases, merges, and reconciliation | `references/release-lifecycle.md` |
| Version choice and metadata alignment | `references/version-decisions.md` |
| Delegated release classification, preparation, verification, release tags, capability negotiation, or receipts | `references/release-handoff.md` |
| Stable majors and prerelease trains | `references/major-releases.md` |
| Curated public release notes (`RELEASE_NOTES.md`) under a curated policy | `references/curation.md` |
| Packaged notes and skill-repository releases | `references/release-note-surfaces.md` |
| Package shape and distribution verification | `references/automation-verification.md` |
| Fork provenance and upstream drift | `references/fork-maintenance.md` |

## Core workflow

For release-bearing work (a package release, a merge into a release-bearing
target, or a delegated `prepare` or `verify`), copy steps 1–7 into your reply as
a `- [ ]` checklist and tick each only on fresh evidence. Other changelog edits
skip the checklist.

1. Inspect repository instructions, Git state, skill directories, package
   manifests, install docs, release-note readers, evals, and the task diff.
   Read the public and developer histories through `scripts/query.ts`
   (`releases`, `show unreleased`, `gaps`); open a whole file only for
   backfill or audit.
2. Classify changes by audience. Skill behavior, compatibility, user-visible
   safety, installation, and output changes usually belong in public history;
   harness, schema, adapter, fixture, and release mechanics belong in developer
   history unless they affect adopters directly.
3. Edit the established Markdown structure. Keep pending work under a single
   `Unreleased` section and follow signature policy.
4. For release-bearing work, reconcile versions and packaged public notes with
   the intended boundary. Never expose `Unreleased`, developer-only detail, or
   raw signature comments through a read-only CLI or packaged note surface.
5. Verify every installable directory is self-contained, contains exactly one
   discoverable `SKILL.md`, and excludes maintainer-only tooling.
6. Run `scripts/query.ts check`, repository-native checks, and a real
   package/consumer install check when the repository provides one. Fix what a
   failure in step 5 or 6 reports and rerun until all pass, returning to step 4
   for a release-boundary failure and to step 3 otherwise. Never tick a failed
   step.
7. Hand off public/developer decisions, package and version map, fork
   provenance, checks, and any publish authority still needed.

## Boundaries

All new and edited release copy must avoid em dashes unless the user explicitly
requests them. This applies to every destination. Repository house style cannot
waive this rule; preserve untouched released history. See
`references/entry-classification.md` for punctuation guidance.

- Do not create product-app routes, modals, screens, CMS history, mobile/store
  notes, or app release metadata.
- Do not make eval harnesses discoverable as skills. A tooling directory must
  not contain `SKILL.md`.
- Do not put model adapters, credentials, eval fixtures, tests, or contributor
  protocols into a public skill merely because they test it.
- Do not mutate globally installed skills to remember repository decisions.
- Name each release's tag in its receipt, but never create or push a tag;
  Simple Changes does. Do not publish packages, create hosted releases, or
  synchronize forks unless the current request separately authorizes those
  actions.

## Completion standard

Complete only when public and developer decisions are explicit, released
package notes agree with canonical public history, installable skill boundaries
are lean and self-contained, fork pins are honest, and repository-native plus
package-shape checks have fresh evidence.
