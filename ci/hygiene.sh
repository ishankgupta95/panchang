#!/bin/bash
# Repository rules that regress silently and are cheap to assert.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

fails=0
check() { # <label> <files...>
  local label="$1"; shift
  if [ "$#" -eq 0 ]; then printf '  ok    %s\n' "$label"; return; fi
  printf '  FAIL  %s\n' "$label"
  printf '          %s\n' "$@" | head -20
  fails=$((fails + 1))
}

# This script is the one file allowed to name what it forbids, so it excludes
# itself; otherwise every rule below matches its own pattern.
SELF="ci/$(basename "${BASH_SOURCE[0]}")"
mapfile -t tracked < <(git ls-files | grep -vxF "$SELF")

check "no em dash or en dash" \
  $(grep -l '—\|–' "${tracked[@]}" 2>/dev/null)

check "no absolute developer paths" \
  $(grep -lE '/Users/[a-z]+/|/home/[a-z]+/' "${tracked[@]}" 2>/dev/null)

# docs/internal/ and PLAN.md are gitignored, so a tracked reference to one is a
# link that will 404 for everyone who clones.
check "no reference to a document that does not ship" \
  $(grep -lE 'PLAN\.md|TS-FINDINGS|AUDIT-(FINDINGS|PROMPT|SYMBOL)|HANDOFF-next-session|NEXT-SESSION-PROMPT|QUANTIZED\.md|docs/internal/' "${tracked[@]}" 2>/dev/null | grep -v '^\.gitignore$')

check "no vendor name" \
  $(grep -liE 'drik[ ._-]*panchang' "${tracked[@]}" 2>/dev/null)

# CI races only these three packages, so a goroutine outside them would never be raced.
check "goroutines only in the packages CI races" \
  $(git ls-files 'source/go/**/*.go' \
    | grep -vE '^source/go/internal/(store|core|astronomy)/' \
    | xargs grep -lE '(^|[^[:alnum:]_])go func|sync\.' 2>/dev/null)

if [ "$fails" -gt 0 ]; then
  printf '\nhygiene: %d rule(s) broken\n' "$fails"
  exit 1
fi
printf 'hygiene: OK\n'
