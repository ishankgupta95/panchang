#!/bin/bash
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

snapshot() { find testdata/goldens -name '*-golden.json' -print0 | sort -z | xargs -0 shasum -a 256; }

before="$(mktemp)"; after="$(mktemp)"
trap 'rm -f "$before" "$after"' EXIT

snapshot > "$before"
count=$(wc -l < "$before" | tr -d ' ')
if [ "$count" -eq 0 ]; then
  echo "goldens: found no *-golden.json under testdata/goldens/; the check would pass vacuously" >&2
  exit 2
fi

bash source/go/parity/goldens.sh
snapshot > "$after"

if diff -u "$before" "$after"; then
  echo "goldens: OK: $count goldens byte-identical after regeneration"
  exit 0
fi
cat >&2 <<'MSG'

goldens: FAILED. Regenerating from the TypeScript tree changed a golden.

That means `src/` moved and the pinned answer did not. It is a review event:
work out *why* the value moved and predict the delta before touching the file,
then land the regenerated golden together with whatever the Go side needs, and
record the delta with it. Never re-pin to make a test green.
MSG
exit 1
