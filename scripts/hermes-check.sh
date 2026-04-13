#!/bin/bash
# Validates that the built CJS bundle is parseable by Hermes's JS frontend.
# If this fails, the code uses JS syntax Hermes doesn't support.

set -euo pipefail

echo "1. Building package..."
npm run build 2>&1

if [ ! -f dist/index.cjs ]; then
  echo "❌ dist/index.cjs not found. Build may have failed."
  exit 1
fi

echo ""
echo "2. Running Hermes JS-syntax check..."
node scripts/hermes-check.mjs
