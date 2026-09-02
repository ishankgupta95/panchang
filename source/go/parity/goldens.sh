#!/bin/bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PKG="$REPO/source/ts"
OUT="$HERE/out"
mkdir -p "$OUT"

npx --prefix "$PKG" esbuild "$HERE/goldens.src.ts" --bundle --platform=node --format=esm \
  --outfile="$OUT/.goldens.mjs" --log-level=error

PARITY_REPO="$REPO" node --max-old-space-size=4000 "$OUT/.goldens.mjs"
