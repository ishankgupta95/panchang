#!/bin/bash
# Exit 2 means the checker could not run. CI must not collapse it into 0.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../source/go" && pwd)"
go run ./internal/cmd/treecheck "$@"
