#!/bin/sh
# Check whether a downstream fork of the simple-changelogs skill is behind
# this upstream repo, using the fork's provenance pin.
#
# Convention: a fork's SKILL.md records its upstream base directly under the
# title, e.g.
#
#   Forked from `simple-changelogs` @ `2b668be`. <project>-specific deltas: ...
#
# Usage (run from anywhere):
#   scripts/check-fork-sync.sh <path-to-fork-SKILL.md> [upstream-repo-dir]
#
# Prints the upstream commits and changed skill files since the fork's pinned
# ref. Exits 0 when the fork is current, 1 when upstream has newer skill
# changes, 2 on usage or parse errors.

set -eu

FORK_SKILL="${1:?usage: check-fork-sync.sh <fork-SKILL.md> [upstream-dir]}"
UPSTREAM_DIR="${2:-$(cd "$(dirname "$0")/.." && pwd)}"
SKILL_PATH="skills/simple-changelogs"

[ -f "$FORK_SKILL" ] || { echo "error: no such file: $FORK_SKILL" >&2; exit 2; }

PIN=$(sed -n 's/.*Forked from `simple-changelogs` @ `\([0-9a-f][0-9a-f]*\)`.*/\1/p' "$FORK_SKILL" | head -1)
[ -n "$PIN" ] || {
  echo "error: no provenance pin found in $FORK_SKILL" >&2
  echo "expected a line like: Forked from \`simple-changelogs\` @ \`<sha>\`" >&2
  exit 2
}

git -C "$UPSTREAM_DIR" rev-parse --verify -q "$PIN" >/dev/null || {
  echo "error: pinned ref $PIN not found in $UPSTREAM_DIR" >&2; exit 2;
}

BEHIND=$(git -C "$UPSTREAM_DIR" rev-list --count "$PIN"..HEAD -- "$SKILL_PATH")
if [ "$BEHIND" -eq 0 ]; then
  echo "fork is current with upstream $SKILL_PATH @ $PIN"
  exit 0
fi

echo "fork pin: $PIN - upstream has $BEHIND newer commit(s) touching $SKILL_PATH:"
echo
git -C "$UPSTREAM_DIR" log --oneline "$PIN"..HEAD -- "$SKILL_PATH"
echo
echo "changed files:"
git -C "$UPSTREAM_DIR" diff --stat "$PIN"..HEAD -- "$SKILL_PATH"
echo
echo "next steps: review the diff, port what applies to the fork, keep"
echo "fork-specific deltas, then update the fork's pinned ref to:"
git -C "$UPSTREAM_DIR" rev-parse --short HEAD
exit 1
