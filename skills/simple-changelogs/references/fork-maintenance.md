# Fork Maintenance

Use this reference when creating a downstream fork of this skill, editing a
fork, or syncing a fork with upstream.

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
- When adding a new fork-specific behavior, add it to the deltas list so the
  next sync does not "fix" it back to upstream wording.
- When a fork improvement is not project-specific, offer it upstream as a
  merge request instead of letting the fork silently diverge.

## Activation Precedence

When a repo-local fork of this skill is installed, treat it as authoritative for
that repo and do not also apply a globally installed upstream
`simple-changelogs` copy. The provenance pin supplies the identity needed to
make that choice, but not every agent harness can enforce it automatically.

If the harness cannot enforce that, add repo guidance that names the exact local
fork skill path and tells agents not to apply the global upstream skill in the
same task. Do not let the fork and upstream skill both classify, write, or
verify changelog work for one repo action.

## Checking Drift

The bundled checker works from any directory:

```bash
scripts/check-fork-sync.sh path/to/fork/SKILL.md /path/to/upstream origin/main
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

Without the script, the basic log comparison is:

```bash
git -C <upstream> log --oneline <pinned-sha>..HEAD -- skills/simple-changelogs
```

## Syncing

1. Review the upstream diff since the pin.
2. Port what applies; skip changes the fork's deltas intentionally override.
3. Re-run the fork's `EVAL.md` behavior cases after material changes.
4. Bump the pinned sha and update the deltas list if it changed.
