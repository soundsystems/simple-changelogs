# Fork Maintenance

Use this reference when creating a downstream fork of the selected
distribution, editing a fork, or syncing a fork with upstream.

## Contents

- Provenance Pin
- Current Deltas
- Activation Precedence
- Checking Drift
- Checking Pin Parity
- Syncing

## Provenance Pin

Every fork records its upstream base directly under the `SKILL.md` title:

```md
Forked from `simple-changelogs` @ `<short-sha>`. <project>-specific deltas:
<audiences, policy sources, CLI workflows, release surfaces, ...>
```

The sha is the upstream commit the fork was last synced to, and the deltas
list is the short human-readable summary of what the fork intentionally
changes. Keep both current:

- When porting upstream changes into a fork, bump the sha to the upstream
  commit you synced to in the same edit.
- When adding a new fork-specific behavior, add it to the deltas list and
  record the files it changes under Current Deltas, so the next sync does not
  "fix" it back to upstream wording.
- When a fork improvement is not project-specific, offer it upstream as a
  merge request instead of letting the fork silently diverge.

## Current Deltas

A fork's own copy of this reference lists every intentional difference from
its pinned upstream files in one table under this heading; upstream has none.
Each row starts with `|`, names a path relative to the skill directory, and
gives a short reason when the delta is not obvious:

```md
| Kind | Path | Section | Reason |
| --- | --- | --- | --- |
| delta | `SKILL.md` | | Fork name, audiences, and pin |
| delta | `references/fork-maintenance.md` | | This table |
| delta | `references/onboarding.md` | | Project audiences |
| omit | `references/onboarding.md` | Component-source choice | No components |
| omit | `references/curation.md` | | No curated release notes |
```

- `delta`: the fork intentionally changes this file. Pin parity skips its
  content but still requires every upstream heading in it, at any level, as
  many times as upstream repeats it.
- `omit`: the fork intentionally leaves out this upstream file or, with a
  Section, one upstream heading of a `delta` file; name a repeated heading's
  later occurrence as `Notes #2` (a heading literally named `Notes #2` stays
  a separate heading, and a file holding both spellings makes the row
  ambiguous, which the check refuses).

Pin parity never reads rows inside code fences, such as this example, and
reports rows that no longer match the fork as stale. Correct or remove a stale
row in the same edit that changes the fork.

## Activation Precedence

When a repo-local fork of this skill is discoverable, repository convention
makes it authoritative for that repo. The provenance pin documents lineage; it
does not activate the fork, suppress another copy, or prove that a runtime loader
enforces precedence.

When discovery leaves both copies active, repository instructions should name
the exact local path and explicitly suppress the global upstream copy. Only one
copy should classify, write, and verify a given repository action.

## Checking Drift

The bundled checker needs Git and a POSIX shell and works from any directory.
In an upstream checkout its leading path is `skills/simple-changelogs`:

```bash
/absolute/path/to/simple-changelogs/scripts/check-fork-sync.sh \
  path/to/fork/SKILL.md /path/to/upstream origin/main
```

The upstream repo and ref are optional when the bundled skill lives inside its
upstream checkout. Without an explicit ref, the checker prefers the selected
remote's symbolic default branch, then existing `origin/main`, `main`,
`origin/master`, or `master` refs. It never substitutes the current feature
branch for the upstream default.

Exit `0` means current, `1` means the fork is behind on skill changes, `2` means
the input or ref is invalid, and `3` means the pin has diverged from the selected
upstream history. Divergence requires a manual history review; do not simply
replace the pin.

Use the bundled checker for status and changed-file selection so every runtime
applies the same ref resolution and ancestry rules.

## Checking Pin Parity

Drift checking sees only upstream commits after the pin, so upstream content
that predates the pin but never reached the fork stays invisible to it. Pin
parity compares every upstream file at the pin with the fork's file at the
same path:

```bash
/absolute/path/to/simple-changelogs/scripts/check-fork-sync.sh --pin-parity \
  path/to/fork/SKILL.md /path/to/upstream
```

It lists undeclared drift, missing upstream files, upstream headings missing
from `delta` files, and stale Current Deltas rows. Exit `0` means the fork
matches its pin apart from declared deltas, `1` means it has findings, and `2`
means the input or a Current Deltas row is invalid.

## Syncing

1. Review the upstream diff since the pin.
2. Port what applies; skip changes the fork's deltas intentionally override.
3. Re-run the fork repository's own behavior and package checks after material
   changes. The public distribution intentionally does not bundle its
   maintainer harness.
4. Bump the pinned sha and update the deltas list if it changed.
5. Run pin parity at the new pin and resolve each finding by porting the
   upstream content. Record a delta or omission under Current Deltas only for a
   difference the fork intends, never to silence an unported upstream change.
   The sync is complete when pin parity passes.
