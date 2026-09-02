#!/bin/bash
#   bash ci/parity.sh [stage...] [--allow-pin-drift]
# The gate holds both documents at once and peaks near 2.5 GB.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

BANDS="source/go/parity/bands.json"
FLAGS=()
STAGES=()
for a in "$@"; do
  case "$a" in
    --*) FLAGS+=("$a") ;;
    *)   STAGES+=("$a") ;;
  esac
done
if [ ${#STAGES[@]} -eq 0 ]; then
  mapfile -t STAGES < <(node -e 'console.log(Object.keys(require("./source/go/parity/bands.json").stages).join("\n"))')
fi

envfor() {
  node -e '
    const b = require("./source/go/parity/bands.json");
    const s = b.stages[process.argv[1]];
    if (!s) { console.error("unknown stage " + process.argv[1]); process.exit(2); }
    console.log(Object.entries(s[process.argv[2]]).map(([k, v]) => `${k}=${v}`).join(" "));
  ' "$1" "$2"
}
labelfor() {
  node -e 'console.log(require("./source/go/parity/bands.json").stages[process.argv[1]][process.argv[2]])' "$1" "$2"
}

wants_full=0
for stage in "${STAGES[@]}"; do
  [ "$stage" = "full" ] && wants_full=1
  tslabel="$(labelfor "$stage" tsLabel)"
  golabel="$(labelfor "$stage" goLabel)"

  echo "── $stage: TypeScript dump ─────────────────────"
  # shellcheck disable=SC2046  # word splitting is the point: KEY=VAL pairs
  env $(envfor "$stage" tsEnv) bash source/go/parity/dump.sh "$tslabel"

  echo "── $stage: Go dump ─────────────────────────────"
  # cd first: from the repo root `go run` fails only after the shell has
  # truncated the redirect target, which reads as a size failure.
  ( cd source/go && env $(cd ../.. && envfor "$stage" goEnv) go run ./cmd/dump > "parity/out/dump-$golabel.json" )

  echo "── $stage: band gate ───────────────────────────"
  node --max-old-space-size=4096 source/go/parity/gate.mjs "$stage" "${FLAGS[@]}"
done

if [ "$wants_full" -eq 1 ]; then
  echo "── table byte gate ─────────────────────────────"
  node source/go/parity/tables-gate.mjs "${FLAGS[@]}"
fi

echo "parity: all requested stages passed: ${STAGES[*]}"
