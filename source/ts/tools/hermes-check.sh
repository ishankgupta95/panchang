#!/bin/bash
# Must stay inside source/ts: hermes-check.mjs resolves hermes-parser by
# walking up from its own directory.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "1. Building package..."
npm run build 2>&1

if [ ! -f dist/index.cjs ]; then
  echo "❌ dist/index.cjs not found. Build may have failed."
  exit 1
fi

echo ""
echo "2. Running Hermes JS-syntax check..."
node "$HERE/hermes-check.mjs"
