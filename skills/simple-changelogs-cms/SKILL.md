---
name: simple-changelogs-cms
description: Use only for a repository that explicitly selects the CMS-only Simple Changelogs distribution. Create, update, backfill, classify, reconcile, validate, or display one internal changelog for authenticated CMS operators while keeping it out of public and developer histories. Do not use for public web, mobile/store, skill-package, or full cross-surface changelogs, or when another distribution owns the repository.
---

# Simple Changelogs CMS

Forked from `simple-changelogs` @ `ab02526`. CMS-specific deltas: one
structured operator history, authenticated CMS presentation, no public or
developer changelog ownership, and no public release-note mirrors.

Maintain one repository-owned `CMS_CHANGELOG.json` document for people who
operate the product through its authenticated content-management surface.

Current guidance version: 1

## Distribution checkpoint

Use one changelog-owning distribution per repository.

This distribution is selected when repository instructions or the current user
name `simple-changelogs-cms`, `.simple-changelogs-cms.json` exists without a
combined web+CMS policy, or this is the sole repo-local changelog distribution.
A global installation alone does not override another repo-local distribution.

If `simple-changelogs-web-cms` owns the repository, defer to it; do not invoke
both skills for the same operator history.

## Setup checkpoint

Before write-capable changelog work, run the bundled `scripts/setup.ts`
inspection helper and look for `.simple-changelogs-cms.json` at the repository
root.

- Pass `--task-mode write` for CMS history mutations and `--task-mode read` for
  explanations or previews that must stay read-only.
- Validate existing policy and changelog data with `scripts/validate.ts` before
  relying on them.
- When policy is absent and the request authorizes CMS changelog work, read
  `references/setup.md`, confirm the CMS-specific receipt, create the
  repository-local state, then continue the original request.
- When released history exists, backfill only after the user or repository
  policy explicitly authorizes the audit. Read `references/backfill.md`.
- Treat the recorded CMS route as presentation metadata, not permission to
  weaken or bypass its authentication.

Repository instructions take precedence when they set a stricter audience,
release process, content source, or validation command.

## Reference router

| Concern | Read |
| --- | --- |
| First use, policy, or JSON source structure | `references/setup.md` |
| Operator relevance, wording, grouping, or sensitive detail | `references/entry-classification.md` |
| Historical reconstruction or audits | `references/backfill.md` |
| Adding or synchronizing the authenticated route | `references/cms-surface.md` |
| Final data, access, and repository checks | `references/verification.md` |

## Core workflow

### 1. Inspect

Read repository instructions, Git state, release evidence, the policy file,
the structured changelog, the authenticated CMS route, and the files changed
by the task. Verify the route's access control from code rather than assuming
that an `/admin` or `/studio` path is private.

### 2. Classify

Record durable outcomes that help authenticated operators understand product,
content, workflow, integration, reliability, or support changes. Omit commit
trivia, general web/mobile work with no operator consequence, and sensitive
implementation detail. Use
`references/entry-classification.md` for boundaries.

### 3. Edit

Keep `CMS_CHANGELOG.json` valid, newest-first, and concise. Preserve stable
entry IDs. Use evidence-backed dates and versions; omit a version when the
repository does not provide one. Never invent shipped state or release labels.

### 4. Synchronize

Ensure the authenticated CMS route renders the structured source and remains
reachable from the existing CMS navigation. Do not publish, syndicate, index,
or mirror this content outside the authorized operator surface.

### 5. Verify

Run the bundled validator, inspect the diff, test the route's access boundary,
and run the repository's native checks. Confirm the public application cannot
reach or render the operator history.

### 6. Hand off

State the CMS changelog decision, backfill range and disposition, route,
authentication evidence, checks run, and any historical uncertainty left
unresolved.

## Boundaries

- This skill owns only the configured CMS JSON source and its authenticated
  operator presentation. It does not create or update `CHANGELOG.md` or
  `DEVELOPER_CHANGELOG.md`.
- Do not expose the CMS history through a public page, feed, sitemap, metadata
  endpoint, public API, announcement, or the repository's customer update
  system.
- Do not place credentials, tokens, exploit instructions, private customer
  data, or unnecessarily specific security weaknesses in operator notes.
- Do not create a missing CMS route without explicit current authorization,
  stored policy permission, or repository instructions that already authorize
  it.
- Do not mutate an installed skill copy to remember repository decisions.
  Durable state belongs in `.simple-changelogs-cms.json` and the configured
  changelog source.
- Do not create tags, hosted releases, deployments, or unrelated product work.

## Completion standard

The task is complete only when the JSON source validates, historical claims are
traceable to repository evidence, the intended operator can reach the route,
unauthenticated and public audiences cannot, repository-native checks pass, and
general web, mobile, store, package, and developer-only entries remain absent,
and no public or developer changelog was changed by this workflow.
