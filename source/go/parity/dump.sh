#!/bin/bash
#   bash source/go/parity/dump.sh <label>  ->  out/dump-<label>.json, out/tables-<label>/
# Bundled in place so parity/tsconfig.json type-checks it.
set -euo pipefail

LABEL="${1:?usage: dump.sh <label>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PKG="$REPO/source/ts"
OUT="$HERE/out"
mkdir -p "$OUT"

npx --prefix "$PKG" esbuild "$HERE/dump.src.ts" --bundle --platform=node --format=esm \
  --outfile="$OUT/.dump-parity.mjs" --log-level=error

# PARITY_G2=1 is a legacy alias for PARITY_STAGE=g2; conflicting values throw.
PARITY_REPO="$REPO" PARITY_OUT="$OUT" PARITY_LABEL="$LABEL" \
  PARITY_G2="${PARITY_G2:-}" PARITY_STAGE="${PARITY_STAGE:-}" \
  node --max-old-space-size=6000 "$OUT/.dump-parity.mjs" > "$OUT/dump-$LABEL.json"

echo "wrote $OUT/dump-$LABEL.json  ($(wc -c < "$OUT/dump-$LABEL.json") bytes)"
if [ -d "$OUT/tables-$LABEL" ]; then
  echo "wrote $OUT/tables-$LABEL/  ($(ls -1 "$OUT/tables-$LABEL" | wc -l | tr -d ' ') files)"
fi
