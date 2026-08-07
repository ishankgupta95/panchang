#!/bin/bash
# Bundles the bench harness against the *current* working tree.
set -e
SP="${SP:-$(cd "$(dirname "$0")" && pwd)}"
REPO=/Users/ishank/code/personal/panchang-ts
cp "$SP/bench.src.ts" "$REPO/.bench-v5.ts"
npx --prefix "$REPO" esbuild "$REPO/.bench-v5.ts" --bundle --platform=node --format=esm \
  --outfile="$SP/bench.mjs" --log-level=error
rm -f "$REPO/.bench-v5.ts"
echo "built $SP/bench.mjs"
