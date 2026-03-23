#!/bin/bash
# Compiles the built CJS bundle to Hermes bytecode.
# If this fails, the code uses JS features Hermes doesn't support.

set -euo pipefail

echo "=== Hermes Bytecode Compilation Check ==="

echo "1. Building package..."
npm run build 2>&1

if [ ! -f dist/index.cjs ]; then
  echo "❌ dist/index.cjs not found. Build may have failed."
  exit 1
fi

echo "2. Compiling to Hermes bytecode..."
npx hermes -emit-binary -out /tmp/panchang-ts.hbc dist/index.cjs 2>&1

if [ $? -eq 0 ]; then
  SIZE=$(wc -c < /tmp/panchang-ts.hbc)
  echo "✅ Hermes bytecode compilation PASSED"
  echo "   Bytecode size: ${SIZE} bytes"
  rm -f /tmp/panchang-ts.hbc
  exit 0
else
  echo "❌ Hermes bytecode compilation FAILED"
  echo "   Review the error above for unsupported JS features."
  exit 1
fi
