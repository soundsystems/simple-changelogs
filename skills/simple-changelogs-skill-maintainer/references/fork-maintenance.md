# Fork Maintenance

Use this reference when creating a downstream fork of the selected
distribution, editing a fork, or syncing a fork with upstream.

## Provenance Pin

Every fork records its upstream base directly under the `SKILL.md` title:

```md
Forked from `simple-changelogs-skill-maintainer` @ `<short-sha>`. <project>-specific deltas:
<audiences, policy sources, CLI workflows, release surfaces, ...>
```

The sha is the upstream commit the fork was last synced to, and the deltas
list is the short human-readable summary of what the fork intentionally
changes. Keep both current:

- When porting upstream changes into a fork, bump the sha to the upstream
  commit you synced to in the same edit.
- When adding a new fork-specific behavior, add it to the deltas list so the
  next sync does not "fix" it back to upstream wording.
- When a fork improvement is not project-specific, offer it upstream as a
  merge request instead of letting the fork silently diverge.

## Activation Precedence

When a repo-local fork of this skill is discoverable, repository convention
makes it authoritative for that repo. The provenance pin documents lineage; it
does not activate the fork, suppress another copy, or prove that a runtime loader
enforces precedence.

When discovery leaves both copies active, repository instructions should name
the exact local path and explicitly suppress the global upstream copy. Only one
copy should classify, write, and verify a given repository action.

## Checking Drift

The bundled checker works from any directory:

```bash
/absolute/path/to/simple-changelogs-skill-maintainer/scripts/check-fork-sync.sh \
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

## Syncing

1. Review the upstream diff since the pin.
2. Port what applies; skip changes the fork's deltas intentionally override.
3. Re-run the fork repository's own behavior and package checks after material
   changes. The public distribution intentionally does not bundle its
   maintainer harness.
4. Bump the pinned sha and update the deltas list if it changed.
