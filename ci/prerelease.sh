#!/bin/bash
# Every gate, including the ones CI cannot run: the goldens and the generated series compare
# bytes that V8's Math pinned on this machine, so they only mean anything on darwin/arm64.
#
# Sequential, and it must stay so: tests/perf/perf.test.ts makes ratio assertions that fail
# under CPU contention, so nothing here may overlap the npm suite.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

if [ "$(uname -s)/$(uname -m)" != "Darwin/arm64" ]; then
  echo "warning: goldens and the generators are pinned on darwin/arm64." >&2
  echo "         On $(uname -s)/$(uname -m) they will report differences that are not regressions." >&2
fi

step "hygiene"
bash ci/hygiene.sh

step "tree correspondence"
bash ci/tree.sh

step "typescript: typecheck, lint, suite, coverage"
npm --prefix source/ts run typecheck
npm --prefix source/ts run lint
npm --prefix source/ts run test:run
npm --prefix source/ts run test:coverage

step "goldens: the TypeScript still produces the pinned answers"
bash ci/goldens.sh

step "go: fmt, vet, full suite, full race"
(cd source/go && gofmt -l . && go vet ./... && go test ./... && go test ./... -race)

step "parity: all stages"
node --test source/go/parity/gate.test.mjs
bash ci/parity.sh

step "generators still reproduce the committed series"
(cd source/go && GEN_FULL=1 go test ./internal/gen/ -run TestGeneratorReproducesCommittedSeries -count=1)
bash generate/notes/ephemeris-generate.sh
git diff --exit-code -- source/ts/src/astronomy/series/

step "release lockstep"
bash ci/release-check.sh

printf '\n\033[1mprerelease: every gate passed.\033[0m\n'
