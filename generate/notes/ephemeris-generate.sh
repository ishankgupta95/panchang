#!/bin/bash
set -e
SP="${SP:-$(cd "$(dirname "$0")" && pwd)}"
REPO="$(cd "$SP/../.." && pwd)"
PKG="$REPO/source/ts"
# Must stay in tests/reference/: catalog.ts resolves the coefficient tables
# relative to its own import.meta.url.
OUT="$PKG/tests/reference/.ephemeris-generate.mjs"
npx --prefix "$PKG" esbuild "$SP/ephemeris-generate.src.ts" --bundle --platform=node --format=esm \
  --outfile="$OUT" --log-level=error
(cd "$PKG" && node "$OUT")
rm -f "$OUT"
echo "wrote $PKG/src/astronomy/series/"
