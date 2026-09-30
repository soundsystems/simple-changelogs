# Bootstrap and Backfill

Use this reference when changelog files are missing, the user requests history
reconstruction, or an authorized guidance audit examines released notes.

## New Changelog Files

When pending work exists, start with the appropriate heading:

```md
# Changelog

## Unreleased

- Pending customer outcome.
```

```md
# Developer Changelog

## Unreleased

- Pending technical outcome.
```

When no pending entry exists, create only the title. Add `Unreleased` with the
first real item rather than keeping a placeholder section.

## Historical Reconstruction

An initial backfill performed while adopting Simple Changelogs must cover the
complete accessible repository history, from the oldest trustworthy evidence
through the setup boundary. Do not substitute a recent window, a commit-count
limit, selected highlights, or a representative sample.

1. Find trustworthy release boundaries from tags, published versions,
   repository-hosted releases, app metadata, or deployment milestones.
2. Walk one bounded range at a time. Use `git log` to locate candidates and
   inspect relevant diffs when subjects do not establish impact.
3. Combine commits into shipped outcomes. Exclude abandoned experiments,
   reversions, churn, and private incident detail from customer history.
4. Put durable migrations, data changes, architecture, release plumbing,
   operational changes, and important regression coverage in the developer
   history.
5. Preserve established headings and dates. Mark uncertainty instead of
   inventing shipped behavior or a release boundary.
6. Account for every historical change in the inspected range. Group related
   commits into durable outcomes, but record why abandoned, reverted, noisy,
   private, or unsupported candidates were omitted instead of silently
   skipping them.

For a large repository, use reviewable batches, then continue through every
remaining range before completing the initial backfill. A conservative
omission is better than fabricated certainty, but an unexplained gap is not a
completed backfill.

## Guidance Audit Authority

A guidance update, noticed drift, or policy prompt is not permission to rewrite
released notes. Start this workflow only after an explicit current request or a
recorded approval from the setup flow.

Approval to run the audit covers inspection and deterministic repairs whose
meaning and visibility remain unchanged:

- regenerate an established derived mirror from its unchanged canonical source;
- align copied version or date metadata when the source of truth is unambiguous;
- remove empty pending subsections after finalization while keeping or
  restoring one empty `Unreleased` heading;
- remove duplicate generated artifacts while keeping their canonical source;
- report ambiguous or semantic drift without changing it.

Before starting historical edits, record resumable policy state according to
`references/setup.md`. Verify the completed audit before recording completion;
on a handled failure, preserve an honest retry state.

## Additional Approval for Semantic Changes

Present one reviewable candidate batch and request additional authority before
any released-history operation that would:

- delete information;
- reword more than mechanical spelling, branding, or exact metadata copying;
- combine entries in a way that changes their meaning;
- change a canonical date, version, heading, or release boundary, rather than
  copying the same unambiguous value into an established mirror;
- reclassify an ambiguous outcome;
- change who can see the information.

Moving a public note into developer-only or internal history is a visibility
change even when the text is preserved. It is never an automatic drift repair.

A current command that already and explicitly asks to rewrite, delete, move,
combine, or reclassify the released material supplies that additional authority.
Do not ask twice for permission the user already granted for the exact work.

When authority remains unclear, leave the source untouched, report the candidate
and why it is not deterministic, and ask one bounded question.

## Audit Completion

An audit can be complete while reporting semantic candidates that were
intentionally left unchanged. Use an unfinished status only when the authorized
audit itself stopped before its planned review or repairs finished.

For an initial backfill, set `completed` only after the oldest reachable
boundary, every intervening range, the setup boundary, and all established
mirrors have been inspected. If shallow history, missing tags, unavailable
release data, or inaccessible records prevent that full review, keep the audit
resumable as `partial` or `failed` and name the missing evidence.

The handoff should state:

- ranges and release sources inspected;
- deterministic repairs made;
- candidates left unchanged and why;
- verification performed;
- the recorded policy disposition.

Do not imply that historical completeness was proven when unavailable tags,
missing release data, shallow history, or vague commits limited the audit.
