#!/bin/bash
#   bash ci/release-check.sh [version]
# Read-only: it prints the tag and publish commands, never runs them.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

VERSION="${1:-$(node -p 'require("./source/ts/package.json").version')}"
COMMIT="$(git rev-parse --short HEAD)"
MODULE="$(sed -n 's/^module //p' source/go/go.mod)"
MAJOR="${VERSION%%.*}"

fails=0
warns=0
ok()   { printf '  ok      %s\n' "$*"; }
warn() { printf '  WARN    %s\n' "$*"; warns=$((warns + 1)); }
fail() { printf '  FAIL    %s\n' "$*"; fails=$((fails + 1)); }

printf '\nrelease lockstep check: v%s at %s\n\n' "$VERSION" "$COMMIT"

dirty="$(git status --porcelain)"
if [ -z "$dirty" ]; then
  ok "working tree is clean"
else
  fail "working tree is not clean; a release names a commit, and $(printf '%s\n' "$dirty" | wc -l | tr -d ' ') path(s) are not in one:"
  printf '%s\n' "$dirty" | sed 's/^/            /' | head -30
fi

pkg="$(node -p 'require("./source/ts/package.json").version')"
if [ "$pkg" = "$VERSION" ]; then
  ok "source/ts/package.json says $pkg"
else
  fail "source/ts/package.json says $pkg, not $VERSION; bump it in the commit being released, not after"
fi

for tag in "v$VERSION" "source/go/v$VERSION"; do
  if [ -n "$(git tag -l "$tag")" ]; then
    at="$(git rev-parse --short "$tag")"
    if [ "$at" = "$COMMIT" ]; then
      ok "$tag already exists and is this commit"
    else
      fail "$tag already exists at $at, which is not HEAD ($COMMIT)"
    fi
  else
    ok "$tag is free"
  fi
done

last="$(git tag -l 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)"
if [ -n "$last" ]; then
  ok "the newest existing npm tag is $last"
  if [ "$last" != "v$VERSION" ]; then
    warn "versions between $last and v$VERSION have no tag; check CHANGELOG.md for any that were published untagged (as of 2026-08-24: 5.1.0 and 5.1.1 both were)"
  fi
fi

if [ "$MAJOR" -ge 2 ] && [[ "$MODULE" != */v"$MAJOR" ]]; then
  warn "go.mod says '$MODULE', which cannot be tagged source/go/v$VERSION: Go requires the module path to end in /v$MAJOR for major version $MAJOR."
  warn "  That only matters if the Go module is published as a library. docs/release.md option C (service-only, the current default) needs no Go tag at all,"
  warn "  and option B versions the Go module independently of npm. Decide before tagging, not after."
else
  ok "go.mod module path '$MODULE' is consistent with major version $MAJOR"
fi

cat <<'GATES'

  gates that must be green on this commit (run them, this script does not):
      (cd source/ts && npm run test:run)    137 files / 8,773 tests
      (cd source/ts && npm run typecheck)
      npx --prefix source/ts tsc -p source/go/parity/tsconfig.json
      bash ci/tree.sh                    source/ts/src <-> source/go correspondence
      bash ci/goldens.sh                 34 goldens, must be a no-op
      cd source/go && gofmt -l . && go vet ./... && go test ./... -race
      node --test source/go/parity/gate.test.mjs
      bash ci/parity.sh                  g2 + g3 + full + the table gate
    Do not run the npm suite and the Go race suite at the same time:
    tests/perf/perf.test.ts makes ratio assertions and fails under contention.
GATES

printf '\n  the commands, for you to run:\n\n'
cat <<CMDS
      git tag -a v$VERSION $COMMIT -m "v$VERSION"
      git tag -a source/go/v$VERSION $COMMIT -m "go v$VERSION (panchang-ts v$VERSION)"   # the tag prefix is the module's directory; see docs/release.md
      # and publish npm from the package root, which is no longer the repo root:
      git push origin v$VERSION source/go/v$VERSION
      (cd source/ts && npm run build && npm publish --access public)
CMDS

printf '\n'
if [ "$fails" -gt 0 ]; then
  printf 'release lockstep: NOT READY: %d blocking, %d warning(s)\n\n' "$fails" "$warns"
  exit 1
fi
printf 'release lockstep: preconditions OK: %d warning(s)\n\n' "$warns"
