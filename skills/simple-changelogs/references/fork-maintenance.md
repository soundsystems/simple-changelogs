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

## Checking Drift

From the upstream repo, `scripts/check-fork-sync.sh <fork-SKILL.md>` reads the
fork's pinned sha and lists upstream skill commits and changed files since
that pin. Exit `0` means current; exit `1` means there is something to review.
Without the script, the equivalent is:

```bash
git -C <upstream> log --oneline <pinned-sha>..HEAD -- skills/simple-changelogs
```

## Syncing

1. Review the upstream diff since the pin.
2. Port what applies; skip changes the fork's deltas intentionally override.
3. Re-run the fork's `EVAL.md` behavior cases after material changes.
4. Bump the pinned sha and update the deltas list if it changed.
