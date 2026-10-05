#!/bin/sh
# Compare a downstream skill-distribution fork with its upstream. The default
# mode reports upstream commits after the fork's provenance pin; --pin-parity
# compares the fork's files with the pinned upstream files themselves, so
# upstream content that predates the pin but never reached the fork surfaces.
# The provenance line selects the upstream skill directory.

set -eu

usage() {
  echo "usage: check-fork-sync.sh <fork-SKILL.md> [upstream-repo] [upstream-ref]" >&2
  echo "       check-fork-sync.sh --pin-parity <fork-SKILL.md> [upstream-repo]" >&2
  exit 2
}

fail() {
  echo "error: $1" >&2
  exit 2
}

has_ref() {
  git -C "$UPSTREAM_DIR" show-ref --verify --quiet "$1"
}

default_ref() {
  REMOTE=""
  if git -C "$UPSTREAM_DIR" remote | grep -Fx origin >/dev/null 2>&1; then
    REMOTE="origin"
  else
    REMOTE=$(git -C "$UPSTREAM_DIR" remote | sed -n '1p')
  fi

  if [ -n "$REMOTE" ]; then
    SYMBOLIC=$(git -C "$UPSTREAM_DIR" symbolic-ref -q "refs/remotes/$REMOTE/HEAD" 2>/dev/null || true)
    if [ -n "$SYMBOLIC" ] && has_ref "$SYMBOLIC"; then
      echo "${SYMBOLIC#refs/remotes/}"
      return
    fi

    for BRANCH in main master; do
      CANDIDATE="refs/remotes/$REMOTE/$BRANCH"
      if has_ref "$CANDIDATE"; then
        echo "$REMOTE/$BRANCH"
        return
      fi
    done
  fi

  for CANDIDATE in refs/remotes/origin/main refs/heads/main refs/remotes/origin/master refs/heads/master; do
    if has_ref "$CANDIDATE"; then
      case "$CANDIDATE" in
        refs/remotes/*) echo "${CANDIDATE#refs/remotes/}" ;;
        refs/heads/*) echo "${CANDIDATE#refs/heads/}" ;;
      esac
      return
    fi
  done
  fail "cannot resolve an upstream default ref; pass one explicitly"
}

TAB=$(printf '\t')
NL='
'
# Marks a generated repeat ("Notes #2") apart from a literal heading spelled
# the same way, so neither can stand in for the other.
REPEAT=$(printf '\001')

# The readable name of a heading key: a generated repeat without its marker.
heading_name() {
  printf '%s' "$1" | tr -d "$REPEAT"
}

# Print each distinct Markdown heading below the title that sits outside code
# fences, without its marks, so a fork may change a heading's level but not
# drop it.
headings() {
  awk '
    {
      line = $0
      sub(/\r$/, "", line)
      lead = line
      sub(/^[ \t]+/, "", lead)
      marker = substr(lead, 1, 3)
      if (marker == "```" || marker == "~~~") {
        if (fence == "") fence = marker
        else if (marker == fence) fence = ""
        next
      }
      if (fence == "" && line ~ /^##+[ \t]/) {
        sub(/^#+[ \t]+/, "", line)
        sub(/[ \t]+#*[ \t]*$/, "", line)
        # A repeated heading counts once per occurrence: "Notes", then a
        # marked "Notes #2" that a literal "Notes #2" heading never matches.
        n = ++seen[line]
        print (n == 1 ? line : "\001" line " #" n)
      }
    }
  '
}

# Print "kind<TAB>path<TAB>section" for each table row under the fork's
# "## Current Deltas" heading, skipping code fences and each table's header
# and delimiter rows.
declarations() {
  [ -f "$1" ] || return 0
  awk -v tab="$TAB" '
    function trim(text) {
      sub(/^[ \t]+/, "", text)
      sub(/[ \t]+$/, "", text)
      return text
    }
    function cell(text) {
      text = trim(text)
      if (text ~ /^`[^`]*`$/) text = substr(text, 2, length(text) - 2)
      return text
    }
    {
      line = $0
      sub(/\r$/, "", line)
      lead = line
      sub(/^[ \t]+/, "", lead)
      marker = substr(lead, 1, 3)
      if (marker == "```" || marker == "~~~") {
        if (fence == "") fence = marker
        else if (marker == fence) fence = ""
        table = 0
        next
      }
      if (fence != "") next
      if (line ~ /^#[ \t]/) {
        active = 0
        next
      }
      if (line ~ /^##[ \t]/) {
        active = (tolower(trim(substr(line, 3))) == "current deltas")
        table = 0
        next
      }
      if (!active) next
      if (substr(lead, 1, 1) != "|") {
        table = 0
        next
      }
      if (!table) {
        table = 1
        next
      }
      split(lead, cells, "|")
      kind = cell(cells[2])
      if (kind ~ /^:?-+:?$/) next
      section = cell(cells[4])
      sub(/^#+[ \t]*/, "", section)
      print kind tab cell(cells[3]) tab section
    }
  ' "$1"
}

# declared <kind> <path> <section>: succeed when Current Deltas has that row.
declared() {
  case "$NL$DECLARED$NL" in
    *"$NL$1$TAB$2$TAB$3$NL"*) return 0 ;;
  esac
  return 1
}

# Upstream SKILL.md maps to the fork file the caller named; every other
# upstream path maps to the same path in the fork's skill directory.
fork_path() {
  if [ "$1" = SKILL.md ]; then
    echo "$FORK_SKILL_PATH"
  else
    echo "$FORK_DIR/$1"
  fi
}

split_row() {
  KIND=${1%%"$TAB"*}
  REST=${1#*"$TAB"}
  ROW_PATH=${REST%%"$TAB"*}
  SECTION=${REST#*"$TAB"}
}

check_pin_parity() {
  FORK_DIR=$(CDPATH= cd -- "$(dirname -- "$FORK_SKILL")" && pwd)
  FORK_SKILL_PATH=$FORK_DIR/$(basename -- "$FORK_SKILL")
  FORK_NOTES=$FORK_DIR/references/fork-maintenance.md
  UPSTREAM_TREE=$(git -C "$UPSTREAM_DIR" ls-tree -r "$PIN_SHA:$SKILL_PATH" 2>/dev/null) || fail "$SKILL_PATH does not exist at pinned commit $PIN"
  DECLARED=$(declarations "$FORK_NOTES")

  while IFS= read -r ROW; do
    [ -n "$ROW" ] || continue
    split_row "$ROW"
    case $KIND in
      delta | omit) ;;
      *) fail "Current Deltas: unknown kind '$KIND' for $ROW_PATH; expected delta or omit" ;;
    esac
    [ -n "$ROW_PATH" ] || fail "Current Deltas: a $KIND row names no path"
    [ -n "$SECTION" ] || continue
    [ "$KIND" = omit ] || fail "Current Deltas: a delta row names a whole file; leave Section empty for $ROW_PATH"
    case $ROW_PATH in
      *.md) ;;
      *) fail "Current Deltas: a Section can only name a Markdown heading, not one in $ROW_PATH" ;;
    esac
  done <<ROWS
$DECLARED
ROWS

  STATUS=""
  DRIFT=""
  MISSING=""
  SECTIONS=""
  STALE=""
  DELTAS=0
  OMISSIONS=0
  while IFS= read -r ENTRY; do
    META=${ENTRY%%"$TAB"*}
    case $META in
      *" blob "*) ;;
      *) continue ;;
    esac
    BLOB=${META##* }
    FILE=${ENTRY#*"$TAB"}
    FORK_FILE=$(fork_path "$FILE")
    if [ ! -f "$FORK_FILE" ]; then
      STATUS=$STATUS"absent$TAB$FILE$NL"
      if declared omit "$FILE" ""; then
        OMISSIONS=$((OMISSIONS + 1))
      else
        MISSING=$MISSING"  $FILE$NL"
      fi
      continue
    fi
    FORK_BLOB=$(git -C "$UPSTREAM_DIR" hash-object --no-filters -- "$FORK_FILE") || fail "cannot read $FORK_FILE"
    if [ "$FORK_BLOB" = "$BLOB" ]; then
      STATUS=$STATUS"same$TAB$FILE$NL"
      continue
    fi
    STATUS=$STATUS"differs$TAB$FILE$NL"
    if ! declared delta "$FILE" ""; then
      DRIFT=$DRIFT"  $FILE$NL"
      continue
    fi
    DELTAS=$((DELTAS + 1))
    case $FILE in
      *.md) ;;
      *) continue ;;
    esac
    FORK_HEADINGS=$NL$(headings <"$FORK_FILE")$NL
    UPSTREAM_HEADINGS=$(git -C "$UPSTREAM_DIR" cat-file blob "$BLOB" | headings)
    while IFS= read -r HEADING; do
      [ -n "$HEADING" ] || continue
      case $FORK_HEADINGS in
        *"$NL$HEADING$NL"*) continue ;;
      esac
      NAME=$(heading_name "$HEADING")
      if declared omit "$FILE" "$NAME"; then
        OMISSIONS=$((OMISSIONS + 1))
      else
        SECTIONS=$SECTIONS"  $FILE: $NAME$NL"
      fi
    done <<HEADINGS
$UPSTREAM_HEADINGS
HEADINGS
  done <<TREE
$UPSTREAM_TREE
TREE

  while IFS= read -r ROW; do
    [ -n "$ROW" ] || continue
    split_row "$ROW"
    case "$NL$STATUS" in
      *"${NL}same$TAB$ROW_PATH$NL"*) STATE=same ;;
      *"${NL}differs$TAB$ROW_PATH$NL"*) STATE=differs ;;
      *"${NL}absent$TAB$ROW_PATH$NL"*) STATE=absent ;;
      *)
        STALE=$STALE"  $KIND $ROW_PATH: not an upstream file at the pin$NL"
        continue
        ;;
    esac
    if [ -z "$SECTION" ]; then
      case $KIND:$STATE in
        delta:same) STALE=$STALE"  delta $ROW_PATH: matches the pin$NL" ;;
        delta:absent) STALE=$STALE"  delta $ROW_PATH: the fork does not carry this file$NL" ;;
        omit:same | omit:differs) STALE=$STALE"  omit $ROW_PATH: the fork carries this file$NL" ;;
      esac
      continue
    fi
    UPSTREAM_HEADINGS=$NL$(git -C "$UPSTREAM_DIR" cat-file blob "$PIN_SHA:$SKILL_PATH/$ROW_PATH" | headings)$NL
    # A row names exactly one heading: a literal heading, or a repeat such as
    # the second "Notes". A file holding both spellings makes the row ambiguous.
    KEY=
    case $UPSTREAM_HEADINGS in
      *"$NL$SECTION$NL"*) KEY=$SECTION ;;
    esac
    case $UPSTREAM_HEADINGS in
      *"$NL$REPEAT$SECTION$NL"*)
        [ -z "$KEY" ] || fail "omit $ROW_PATH: $SECTION names both a heading and a repeated heading at the pin; rename the heading"
        KEY=$REPEAT$SECTION
        ;;
    esac
    if [ -z "$KEY" ]; then
      STALE=$STALE"  omit $ROW_PATH: $SECTION: no such upstream heading at the pin$NL"
      continue
    fi
    if [ "$STATE" != absent ]; then
      FORK_HEADINGS=$NL$(headings <"$(fork_path "$ROW_PATH")")$NL
      case $FORK_HEADINGS in
        *"$NL$KEY$NL"*) STALE=$STALE"  omit $ROW_PATH: $SECTION: the fork has this heading$NL" ;;
      esac
    fi
  done <<ROWS
$DECLARED
ROWS

  if [ -z "$DRIFT$MISSING$SECTIONS$STALE" ]; then
    echo "fork matches upstream $SKILL_PATH @ $PIN apart from $DELTAS declared delta(s) and $OMISSIONS declared omission(s)"
    exit 0
  fi

  echo "fork pin: $PIN - the fork does not match $SKILL_PATH at its pin:"
  if [ -n "$DRIFT" ]; then
    echo
    echo "undeclared drift (port the pinned upstream file, or declare a delta):"
    printf '%s' "$DRIFT"
  fi
  if [ -n "$MISSING" ]; then
    echo
    echo "missing upstream files (restore them, or declare an omission):"
    printf '%s' "$MISSING"
  fi
  if [ -n "$SECTIONS" ]; then
    echo
    echo "upstream headings missing from declared deltas (port them, or declare an omission):"
    printf '%s' "$SECTIONS"
  fi
  if [ -n "$STALE" ]; then
    echo
    echo "stale declarations (correct or remove the row):"
    printf '%s' "$STALE"
  fi
  echo
  echo "compare one file with:"
  printf "  git -C '%s' show '%s:%s/<path>' | diff - '%s/<path>'\n" "$UPSTREAM_DIR" "$PIN" "$SKILL_PATH" "$FORK_DIR"
  echo "declare intentional deltas and omissions under \"## Current Deltas\" in:"
  echo "  $FORK_NOTES"
  exit 1
}

MODE=drift
if [ "$#" -ge 1 ] && [ "$1" = "--pin-parity" ]; then
  MODE=pin-parity
  shift
  [ "$#" -ge 1 ] && [ "$#" -le 2 ] || usage
else
  [ "$#" -ge 1 ] && [ "$#" -le 3 ] || usage
fi

FORK_SKILL=$1
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
UPSTREAM_DIR=${2:-$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)}
[ -f "$FORK_SKILL" ] || fail "no such file: $FORK_SKILL"
git -C "$UPSTREAM_DIR" rev-parse --git-dir >/dev/null 2>&1 || fail "not a Git repository: $UPSTREAM_DIR"

PROVENANCE=$(sed -n 's/.*Forked from `\([a-z0-9][a-z0-9-]*\)` @ `\([0-9a-f][0-9a-f]*\)`.*/\1 \2/p' "$FORK_SKILL" | sed -n '1p')
[ -n "$PROVENANCE" ] || {
  echo "error: no provenance pin found in $FORK_SKILL" >&2
  echo "expected: Forked from \`<skill-name>\` @ \`<sha>\`" >&2
  exit 2
}
UPSTREAM_SKILL=${PROVENANCE%% *}
PIN=${PROVENANCE#* }
SKILL_PATH=skills/$UPSTREAM_SKILL

PIN_SHA=$(git -C "$UPSTREAM_DIR" rev-parse --verify --end-of-options "$PIN^{commit}" 2>/dev/null) || fail "pinned commit $PIN was not found"
if [ "$MODE" = pin-parity ]; then
  check_pin_parity
fi
TARGET_REF=${3:-$(default_ref)}
TARGET_SHA=$(git -C "$UPSTREAM_DIR" rev-parse --verify --end-of-options "$TARGET_REF^{commit}" 2>/dev/null) || fail "upstream ref was not found: $TARGET_REF"

if git -C "$UPSTREAM_DIR" merge-base --is-ancestor "$PIN_SHA" "$TARGET_SHA"; then
  :
else
  MERGE_BASE_STATUS=$?
  if [ "$MERGE_BASE_STATUS" -ne 1 ]; then
    fail "git merge-base failed while comparing $PIN with $TARGET_REF"
  fi
  echo "error: fork pin $PIN diverges from upstream $TARGET_REF" >&2
  echo "review both histories before changing the provenance pin" >&2
  exit 3
fi

BEHIND=$(git -C "$UPSTREAM_DIR" rev-list --count "$PIN_SHA..$TARGET_SHA" -- "$SKILL_PATH")
if [ "$BEHIND" -eq 0 ]; then
  echo "fork is current with upstream $TARGET_REF ($SKILL_PATH @ $PIN)"
  exit 0
fi

echo "fork pin: $PIN - upstream $TARGET_REF has $BEHIND newer commit(s) touching $SKILL_PATH:"
echo
git -C "$UPSTREAM_DIR" log --oneline "$PIN_SHA..$TARGET_SHA" -- "$SKILL_PATH"
echo
echo "changed files:"
git -C "$UPSTREAM_DIR" diff --stat "$PIN_SHA..$TARGET_SHA" -- "$SKILL_PATH"
echo
echo "next steps: review the diff, preserve fork-specific deltas, port applicable changes,"
echo "then update the fork pin to:"
git -C "$UPSTREAM_DIR" rev-parse --short "$TARGET_SHA"
exit 1
