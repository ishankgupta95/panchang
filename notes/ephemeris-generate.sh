#!/bin/bash
# Truncates the published coefficient tables into src/astronomy/series/.
# Same bundle-then-run shape as build.sh: the generator is TypeScript so it can
# share the catalogue parsers with tests/reference/ rather than duplicate them.
set -e
SP="${SP:-$(cd "$(dirname "$0")" && pwd)}"
REPO="$(cd "$SP/.." && pwd)"
# The bundle is emitted into tests/reference/ because catalog.ts locates the
# source tables relative to its own import.meta.url, and bundling flattens that
# to wherever the output file sits.
OUT="$REPO/tests/reference/.ephemeris-generate.mjs"
npx --prefix "$REPO" esbuild "$SP/ephemeris-generate.src.ts" --bundle --platform=node --format=esm \
  --outfile="$OUT" --log-level=error
(cd "$REPO" && node "$OUT")
rm -f "$OUT"
echo "wrote $REPO/src/astronomy/series/"
