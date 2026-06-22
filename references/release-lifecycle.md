# Release Lifecycle

Use this reference when deciding whether to keep entries under `Unreleased` or
move them into a released heading.

## Release Intent

Do not move entries out of `Unreleased`, bump versions, or sync release-note
surfaces merely because a task touches git, a branch, a preview, or a deploy
command. First establish release intent from local evidence:

- The user asks to release, publish, deploy publicly, close a release, bump a
  version, update release notes, or merge into a release-bearing branch.
- Repo docs, release automation, CI, package metadata, app-store metadata, or
  deployment config identify the current action as release finalization.
- Users install, read, consume, or deploy directly from the target branch or
  published artifact affected by the task.

If the task is only preparing a feature branch, draft pull or merge request,
internal preview, staging deploy, code review, or non-release commit, keep
pending work under `Unreleased`. Do not sync versions or release-note surfaces
unless the task explicitly asks for release prep.

## Before Non-Release Handoff

Before opening a pull or merge request, pushing non-release work, or handing off
pending work:

- Re-read the final diff or relevant commits.
- Confirm whether each `Unreleased` entry is still true.
- Keep still-unshipped entries under `Unreleased`.
- Make the changelog decision explicit. If no customer-facing update is needed,
  say so and explain whether the developer changelog needs an entry.

## Before Release Finalization

Before pushing, merging, publishing, or deploying with release intent:

- Re-read the final diff or relevant commits.
- Confirm whether each `Unreleased` entry is still true.
- Fetch or inspect the target refs involved in the task. Treat the default
  branch, production branches, protected release branches, and documented
  release targets as release-bearing when users install, read, consume, or
  deploy directly from them.
- Do not infer release-bearing status from a branch name alone. If local docs,
  release automation, deployment config, package metadata, or direct-consumption
  evidence do not establish the branch as release-bearing, treat it as pending
  work and report the ambiguity instead of finalizing the release.
- Leave merged-but-unshipped work under `Unreleased` only when the repo clearly
  documents a separate release system that has not shipped yet.
- Treat a push or merge to a release-bearing branch as release finalization when
  users install, read, or consume directly from that branch, such as public skill
  repos, package docs, static changelog pages, or default-branch app release-note
  data.
- Move shipped or release-prep entries from `Unreleased` into the matching
  version/date heading before pushing, merging, publishing, or deploying.
- Move shipped or release-prep developer notes from `DEVELOPER_CHANGELOG.md`
  `Unreleased` into the same version/date heading when they belong to that
  release.
- Do not leave entries under `Unreleased` after a public default-branch release
  unless the repo documents a separate release system that has not shipped yet.
- After all pending entries have moved into a released section, remove the empty
  `Unreleased` heading from both customer and developer changelogs.
- Apply pre-release hot-fix omission rules from
  `references/entry-classification.md` before adding or keeping any user-facing
  entry.

## Pull or Merge Request Reconciliation

When the user asks you to create pull or merge requests and merge them, treat the
merge into a release-bearing target branch as release finalization. Move the
shipped customer-facing `Unreleased` entries into the matching version/date
heading before the run is finished, then sync release-note surfaces and affected
version fields when the release has customer-facing bullets.

When preparing a new pull or merge request, check whether existing `Unreleased`
entries are already present on the release-bearing target branch. Use the target
branch changelog files, commit history, diffs, and commit containment as
evidence. If the work is already on the target branch, reconcile it before
opening the new request: move those entries out of `Unreleased` into the
matching released heading, sync release-note surfaces and version metadata when
applicable, and keep only still-unmerged or still-unshipped work under
`Unreleased`.

If `Unreleased` mixes entries that are already on the target branch with entries
that are still local or still pending, split them. Move only the
target-branch-contained entries into the released section.

## Public Deployments

When the user asks you to push, publish, or run a production or public
deployment, treat that deployment as release finalization even if no branch merge
is part of the request. Before deploying, move the shipped customer-facing
`Unreleased` entries into the matching version/date heading, sync release-note
surfaces and affected version fields when applicable, and leave only
still-unshipped work under `Unreleased`.
