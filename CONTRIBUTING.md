# Contributing

Two implementations, one set of answers. That constraint shapes everything
below: a change to one language is not finished until the other agrees with it,
and the repository has gates that say so.

## Layout

```
source/ts/     the npm package: package.json, src/, tests/
source/go/     the Go module. panchang/ is the public API, internal/ the port
generate/      cross-language generators
testdata/      the data both implementations are held to
docs/          porting rules, the gates, the release process
```

## The rules that are not negotiable

**The TypeScript is canonical.** "Correct" for the Go port means *agrees with
the TypeScript's exact arithmetic*, not *is the best available approximation*.
The two come apart in eight named places and Go's instinct is wrong in all
eight. Read [`docs/porting.md`](docs/porting.md) before touching any Go
arithmetic; every rule in it cost a red test to learn.

**One Go file per TypeScript file**, same basename lowercased, same function
names and order. `internal/treecheck` enforces this in both directions and
`internal/symcheck` does it at symbol level. Both read their exemption tables
out of [`docs/porting.md`](docs/porting.md) §3 and
[`docs/symbols.md`](docs/symbols.md), so add the row in the same change that
adds the file.

**Never re-pin an expectation to make a test pass.** A fixture, a golden, a
tolerance or a parity band moves only after the delta has been predicted in
writing, measured, and the misses recorded.
[`docs/validation-tiers.md`](docs/validation-tiers.md) is the policy;
[`testdata/README.md`](testdata/README.md) says which tier each file is.

**No self-seeding.** An expected value never comes from this library's output.

## Running the gates

[`docs/ci.md`](docs/ci.md) is the long form. Everything, in the order it should
run:

```bash
bash ci/prerelease.sh
```

That is a superset of what CI runs, and the extra pieces are the point: the
goldens and the two generator reproductions are pinned to `darwin/arm64` and
cannot be checked on a runner at all, so this script is the only thing that ever
sees them. Run it on that host before tagging.

While iterating, the three gates CI actually blocks on:

```bash
bash ci/hygiene.sh && bash ci/tree.sh
npm --prefix source/ts run typecheck && npm --prefix source/ts run lint && npm --prefix source/ts run test:run
cd source/go && gofmt -l . && go vet ./... && go test ./... && cd ..
bash ci/parity.sh full
```

Each language ships a truncated copy of the same coefficient tables, written by
a generator. Editing a generated file without its generator is silent until
somebody regenerates and the edit disappears, which is why `ci/prerelease.sh`
regenerates both and diffs.

**Do not run the npm suite alongside anything else.**
`source/ts/tests/perf/perf.test.ts` makes ratio assertions and fails under CPU
contention, which has produced false reds more than once. The CI workflow keeps
them in separate jobs, which is the same rule expressed as scheduling.

## Comments

The tree is deliberately sparse. The test a comment has to pass:

> If a competent developer could work it out from the code, the types, or
> arithmetic, it does not belong here.

What survives is what a reader could not know:

- a trap they would otherwise "fix" into a bug: an FMA barrier, `jsnum.Round`
  rather than `math.Round`, a typed constant that must not become untyped, a
  deliberately non-nil empty slice;
- the provenance of a magic constant: a classical source, an ephemeris fit, a
  measurement that contradicts a published value;
- a domain fact the code cannot state.

Symbols re-exported from `source/ts/src/index.ts` and exported symbols in
`source/go/panchang/` are the exception. They carry one summary line, because
that text becomes the published `.d.ts` and the godoc.

## Commits

Nothing here publishes. Releases are cut by hand: see
[`docs/release.md`](docs/release.md).
