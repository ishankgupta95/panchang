#!/bin/bash
# Never run alongside the Go benchmarks: both saturate the machine.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PKG="$REPO/source/ts"
OUT="$HERE/out"
mkdir -p "$OUT"

npx --prefix "$PKG" esbuild "$HERE/bench.src.ts" --bundle --platform=node --format=esm \
  --outfile="$OUT/.bench.mjs" --log-level=error

echo "node $(node --version), $(uname -sm)"
node --max-old-space-size=4000 "$OUT/.bench.mjs"
