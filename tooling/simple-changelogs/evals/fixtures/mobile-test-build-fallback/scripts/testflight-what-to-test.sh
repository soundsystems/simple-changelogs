#!/bin/sh
# Synthetic stand-in for an authorized TestFlight What to Test workflow. It
# writes only under remote/ and logs each call so readback is observable.
set -eu
# Trim and count the same way under any locale: only ASCII spaces, tabs, and
# line breaks are trimmed, and every UTF-8 byte except a continuation byte
# starts a character.
LC_ALL=C
export LC_ALL

usage() {
  echo "usage: $0 publish|read <version> <build> <locale> (publish reads stdin)" >&2
  exit 2
}

[ "$#" -eq 4 ] || usage
action=$1
version=$2
build=$3
locale=$4
target="remote/testflight/$version/$build/$locale.txt"

case "$action" in
  publish)
    # Trim surrounding whitespace, then count and store exactly that copy.
    text=$(cat)
    leading=${text%%[![:space:]]*}
    text=${text#"$leading"}
    trailing=${text##*[![:space:]]}
    text=${text%"$trailing"}
    count=$(printf '%s' "$text" | tr -d '\200-\277' | wc -c | tr -d ' ')
    if [ "$count" -gt 1500 ]; then
      echo "What to Test has $count characters; the limit is 1500." >&2
      exit 1
    fi
    mkdir -p "$(dirname "$target")"
    printf '%s\n' "$text" > "$target"
    ;;
  read)
    cat "$target"
    ;;
  *)
    usage
    ;;
esac

printf '%s %s %s %s\n' "$action" "$version" "$build" "$locale" >> remote/testflight/activity.log
