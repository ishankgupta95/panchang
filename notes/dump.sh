#!/bin/bash
# Bundles + runs the output dump against the current working tree.
#   dump.sh <label>   -> writes dump-<label>.json
set -e
SP="${SP:-$(cd "$(dirname "$0")" && pwd)}"
REPO=/Users/ishank/code/personal/panchang-ts
cp "$SP/dump.src.ts" "$REPO/.dump-v5.ts"
npx --prefix "$REPO" esbuild "$REPO/.dump-v5.ts" --bundle --platform=node --format=esm \
  --outfile="$SP/dump.mjs" --log-level=error
rm -f "$REPO/.dump-v5.ts"
node --max-old-space-size=6000 "$SP/dump.mjs" > "$SP/dump-$1.json"
echo "wrote $SP/dump-$1.json  ($(wc -c < "$SP/dump-$1.json") bytes)"
