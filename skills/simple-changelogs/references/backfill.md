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

## Policy Or Guidance Backfill

Use this workflow when the user explicitly asks to backfill, audit, clean up, or
realign existing changelogs and release-note history against updated guidance,
or after the operator approves a proposed released-history cleanup. Do not
rewrite released changelog or release-note history just because drift is noticed
during ordinary feature work.

When `SKILL.md` contains a `One-Time Guidance Backfill Notice`, the notice is
only a prompt to ask the operator whether to run this workflow. It is not
permission to rewrite history. Remove the notice only after an approved,
completed, and verified guidance backfill, or after an explicit operator
opt-out that asks not to run it. Otherwise leave it in place.

Agents may freely edit pending `Unreleased` entries for the active task and may
sync generated release-note data after source changelog edits. Released-history
backfill has a higher bar: first classify the drift by the operation required,
then separate safe information-preserving repairs from destructive or
meaning-changing edits.

### Automatic Drift Repairs

Agents may apply drift repairs that preserve or relocate information without
changing the meaning of released history:

- Sync generated release-note data from the source changelog after source
  entries change.
- Add missing release-note surface entries that already exist in the source
  changelog or developer changelog.
- Move clearly developer-only detail from public release notes into
  `DEVELOPER_CHANGELOG.md` or an internal release-note surface, preserving the
  meaning and provenance of the note.
- Align section, version, date, or metadata labels across generated surfaces to
  the source changelog when the source is unambiguous.
- Remove empty `Unreleased` headings or duplicate generated artifacts after
  release finalization.

### Permission-Gated Released-History Edits

Ask for explicit operator permission before editing released history in ways
that delete information, change meaning, or change release boundaries:

- Delete a released note entirely.
- Reword released customer-facing prose beyond mechanical branding, spelling, or
  metadata alignment.
- Collapse multiple released entries into one entry.
- Change release dates, versions, headings, or release boundaries.
- Remove a public-facing customer outcome because it now seems too small,
  noisy, or below the current impact threshold.
- Reclassify ambiguous entries that could plausibly still have product,
  support, operator, or customer value.

When unsure whether a repair is safe, report the candidate drift and ask before
changing released changelog or release-note history. The default principle:
automatic drift repair preserves or relocates information; destructive or
meaning-changing released-history edits require explicit operator approval.

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
