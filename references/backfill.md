# Bootstrap and Backfill

Use this reference when changelog files are missing or when the user asks to
reconstruct changelogs from existing history.

## New Files

When adding pending unreleased work to a new customer changelog, use:

```md
# Changelog

## Unreleased

- ...
```

When adding pending unreleased work to a new developer changelog, use:

```md
# Developer Changelog

## Unreleased

- ...
```

If creating a changelog with no pending unreleased entries yet, omit
`## Unreleased` until the first pending change exists.

## Backfill Workflow

1. Find release boundaries first:
   - `git tag --sort=-creatordate`
   - existing repository-hosted releases, package versions, app versions, or
     deployment milestones when available
2. If tags or releases exist, backfill one range at a time with
   `git log --oneline <previous-tag>..<tag>` and inspect important commits with
   `git show --stat --summary --format=fuller <sha>`.
3. If no release boundaries exist, walk history in batches with
   `git log --oneline --reverse` or paginated `git log --skip=<n>` ranges, then
   group entries by date, milestone, or coherent feature area.
4. Summarize outcomes, not commits. Combine related commits into one grouped
   entry and leave out churn, reversions, failed experiments, and internal-only
   details from `CHANGELOG.md`.
5. Put useful technical history in `DEVELOPER_CHANGELOG.md`, especially
   migrations, data model changes, parser or pipeline behavior, release-note
   plumbing, tests, operational changes, and workflow changes.
6. Mark uncertainty plainly when old commits do not reveal shipped behavior.
   Prefer a conservative omission over inventing user impact.

For large histories, produce a short backfill plan first, then work in
reviewable batches instead of rewriting the whole history in one pass.

## Backfill Quality Rules

- Preserve release headings and dates when the repo already has an established
  format.
- Do not create one changelog entry per commit unless each commit is truly a
  separate user-facing or maintainer-relevant outcome.
- Do not expose abandoned experiments, reverted changes, failed releases, or
  sensitive internal incident detail in `CHANGELOG.md`.
- Use `DEVELOPER_CHANGELOG.md` for migration history, release process changes,
  and technical context future maintainers will search for.
- If history is ambiguous, write "historical commit context does not establish
  whether this shipped" in your handoff rather than making the changelog pretend
  certainty.
