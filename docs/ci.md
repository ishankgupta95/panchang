# `ci/`: the sync discipline

The scripts live in `ci/` at the repository root, not under either language,
because not one of them is single-language: `tree.sh` compares the two trees,
`goldens.sh` runs the TypeScript to write the Go module's fixtures, `parity.sh`
runs both, and `hygiene.sh` and `release-check.sh` are repository-wide.

This was meant to start the day stage G2 landed. G2 landed on 2026-08-23 and this
landed on 2026-08-24, so it is overdue rather than new, and the gap is the point:
**for every day this was not here, a `source/ts/src/` change could land without
its Go counterpart and nothing would have said so.** That is not hypothetical:
the `MasaSystem` / `GetBounds` drift was found by hand, because no gate could see
it.

Five pieces, in the order they should run and roughly in order of what they
cost:

| | what it answers | where |
|---|---|---|
| **hygiene** | did a rule that regresses silently regress? em/en dashes, absolute developer paths, links to documents that do not ship, the vendor name. Runs as the first step of the tree job, since it needs no toolchain and takes a second | `hygiene.sh` |
| **tree correspondence** | did a `source/ts/src/` file arrive without a Go counterpart, or a Go file without a justification? | `tree.sh` → `cmd/treecheck` → `internal/treecheck` |
| **goldens** | did `source/ts/src/` behaviour move without the pinned answers moving with it? | `goldens.sh` → `parity/goldens.sh` |
| **generators** | does each language's generated coefficient series still match the generator that writes it? | `GEN_FULL=1 go test ./internal/gen/` and `generate/notes/ephemeris-generate.sh` |
| **parity** | do the two implementations still agree, leaf for leaf, inside the parity bands? | `parity.sh` → `parity/gate.mjs` + `parity/tables-gate.mjs` over `parity/bands.json` |

**The generators piece is the one a two-language tree needs and a one-language
tree does not.** Both languages ship a truncated copy of the same published
coefficient tables, and each copy is written by a generator. Editing a generated
file without editing its generator is silent until somebody regenerates, at
which point the edit vanishes. Neither check runs in the ordinary suite: the Go
one sits behind `GEN_FULL` because it takes three minutes, and the TypeScript
side has no test at all, so CI runs both explicitly. Both drifted during the
2026-08-29 cleanup and neither ordinary suite noticed.

and, separately from CI, `release-check.sh` + [`docs/release.md`](release.md) for the
third item, release lockstep.

---

## 1. The workflow, and where it lives

One file, `.github/workflows/ci.yml`, with three gate jobs and a release job:

| job | what it gates | roughly |
|---|---|---|
| `typescript` | hygiene, then the npm package: typecheck, lint, the suite, the Hermes syntax check, and that `dist/` packs | 7 min |
| `go` | the Go module: gofmt, vet, the full suite, and `-race` on the three packages that start goroutines | 6 min |
| `parity` | the two implementations agreeing, leaf for leaf, inside the bands | 5 min |
| `release` | publishing, `needs:` all three and only on a push to `master` | 2 min |

The three gate jobs run concurrently, so a pull request settles in about seven
minutes.

**Why one file and not four.** Concurrency groups and `needs:` are both scoped to
a workflow. With the gates split across `typescript.yml`, `go.yml` and
`parity.yml`, the release job in a fourth file had no way to depend on them, so a
merge to `master` ran the three gate workflows *and* a release job that re-ran the
suite, the tree check, the goldens and the parity gate on the same commit. That
was about fifteen wasted minutes per merge, and it is the whole reason the release
job now lives beside the gates it waits on.

The split into four files was made on the reasoning that a red check should name
its own cause. Three well-named jobs do that just as well, and the earlier
arrangement also raised a question this one does not: which lane is this check in.

Every script the workflow calls lives in `ci/` and is runnable by hand, which is
deliberate: the workflow is a thin shim over scripts that can be debugged locally,
rather than logic that only exists inside a YAML file nobody can run.

**Required status checks are the job names**, not the workflow or the file: they
are now `typescript`, `go` and `parity`. Branch protection has to be updated by
hand when these change, or every pull request waits forever on checks that no
longer run.

### Why it says `master`

The workflows were originally written against `main`, which this repository has
never had, so several jobs had never executed at all and carried latent failures
for months. Check `git ls-remote --heads origin` before changing that line.

The first real run, on 2026-08-30, went red on five checks. Four of them were one
cause: this repository pins bit-exact artifacts on `darwin/arm64` and the runners
are `linux/amd64`. See §4. The fifth was a `console.warn` in `src/` that
typechecked only because `@types/node` happened to arrive as an optional peer of
vitest; it is now a declared devDependency.

**Nothing outside the `release` job writes.** `permissions: contents: read` is set
at the file level, and the release job raises it to `contents: write` and
`id-token: write` for itself alone.

---

## 2. The three gates

### 2.1 Tree correspondence: `bash ci/tree.sh`

The highest-value piece here, and the cheapest: **50 ms**.

`source/ts/src/a/b/cName.ts` must have `source/go/internal/a/b/cname.go`, and vice versa. The
exceptions in both directions are the two markdown tables in `docs/porting.md` §3,
which `internal/treecheck` **parses** rather than duplicating. §3's list was
missing six of its twenty-three entries until 2026-08-24, which is exactly the
drift this catches, and a second copy inside the checker would be a second thing
to forget. Four conditions fail the build:

- a `source/ts/src/` file with no Go counterpart and no row;
- a Go file mirroring nothing, with no row;
- a row matching no file on disk (a justification outliving its file);
- two `source/ts/src/` files whose names differ only in case, which the lowercasing rule
  would send to one Go path.

The same check is `TestTreeCorrespondence` in `go test ./...`, so it also runs at
every local task boundary for free. `internal/treecheck`'s tests drive each of
the four conditions to a failure on synthetic trees, and
`TestCheckRepoOnASyntheticTree` does it through the real filesystem: a checker
only ever run on a passing tree has never been observed to do anything.

Exit codes: **0** clean, **1** drift, **2** the checker could not run. CI must
not collapse 2 into 0; a `docs/porting.md` the parser cannot read would otherwise
disable the gate in silence.

### 2.2 Goldens: `bash ci/goldens.sh`, and why it is not in CI

`source/go/parity/goldens.sh` regenerates all **34** `testdata/goldens/**/*-golden.json` from
the *TypeScript* tree. Rerunning it must be a no-op; this asserts that by
checksum, so it works on a tree where `go/` is not yet tracked by git.

**It runs in `ci/prerelease.sh` on the pinning host, not on a runner.** The first
real CI run put four goldens on the diff (`jyotish/sadesati`, `shadbala`,
`upagrahas`, `varshaphala`) while the same script on `darwin/arm64` reported all
34 byte-identical. The goldens are the TypeScript's own answers, and `src/` calls
V8's native `Math` in about 124 places outside the hand-rolled trig kernel, so
they carry the host's last ULP with them. §4 already measured this: TS arm64
against TS amd64 is 1 leaf and 14 changed values. Whichever host pins them, the
other one goes red, and no rewrite of the script changes that.

Dropping it from CI is safe by transitivity, because `parity` is still on the
pull-request path: parity says the TypeScript equals the Go leaf for leaf inside
the bands, and `go test ./...` says the Go equals all 34 committed goldens, so the
TypeScript equals the goldens within band for everything the dump samples. And
`dump.src.ts` does sample all four of the goldens that moved. The byte-exact
snapshot was the weaker of two overlapping gates and the only one that cannot run
off the host that pinned it.

A golden that changes is a review event, never a re-pin: predict the delta and
its cause first (`docs/validation-tiers.md`).

### 2.3 Parity: `bash ci/parity.sh [stages…] [--allow-pin-drift]`

TS dump, Go dump, band assertion, per stage; then the table byte gate. All three
stages plus the tables: **44 s** end to end.

Everything about a stage (labels, the environment each side needs, the bands,
the pins) comes out of **`source/go/parity/bands.json`**, which is the only place those
numbers live. Two severities, and the difference is the design:

- **BAND**: the bands in `docs/parity.md`. Zero tolerance on invariants, 1 ms on
  published instants, 1e-9 on published degrees. A breach is a defect, always
  fatal, and a band moves only with a written prediction and Ishank's approval.
  It has moved once, for the eclipse-table row at G4.5.
- **PIN**: where the port measures *today*, far inside the band: leaf counts,
  the total number of changed values, the worst |Δ| and where it is, and the
  **document byte size**, which is watched because at G4.2 a 6,406-byte growth
  was the only thing that named a real bug while the leaf diff said nothing. A
  pin breach is a review event; `--allow-pin-drift` downgrades pin breaches to
  notices so an investigation is not blocked by its own gate, and CI never passes
  it. A result *tighter* than a pin is a loud NOTICE, never a failure.

`node --test source/go/parity/gate.test.mjs` drives all twenty-six of those checks to a
failure on documents small enough to read, including that `--allow-pin-drift`
waives a pin and never a band.

**The eclipse tables.** Nine of the twelve table files are byte-identical; the
three eclipse tables take the amended band row, and `tables-gate.mjs` implements
that row's own wording rather than something looser: a masked comparison of every byte
but `obscuration` and `magnitude`, plus the numeric band on those digits. A
changed `description`, a reordered key or a dropped entry still fails.

---

## 3. Measured cost

2026-08-24, Apple M3 Max (14 cores), node v24.4.1, go1.26.4, all with
`/usr/bin/time`. A GitHub-hosted runner has 4 cores: scale the CPU-bound rows up
and read these as a floor.

| step | wall | peak RSS |
|---|---|---|
| `tree.sh` | 0.05 s | n/a |
| `go build ./...` (warm) | 0.36 s | n/a |
| `go test ./...` | 18.2 s | n/a |
| `go test ./... -race` | 170 s | n/a |
| `goldens.sh` | 149.2 s | n/a |
| TS dump (g2 / g3 / full) | 5.3 / 5.5 / 15.2 s | 340 / 340 / 378 MB |
| Go dump (g2 / g3 / full) | 2.4 / 2.5 / 8.1 s | 32 / 31 / 38 MB |
| `gate.mjs` (g2 / g3 / full) | 2.2 / 2.2 / 2.3 s | 2.47 / 2.48 / **2.51 GB** |
| `tables-gate.mjs` | < 1 s | small |
| `gate.test.mjs` (26 tests) | 0.6 s | small |
| **`parity.sh` (all three + tables)** | **44.1 s** | 2.5 GB |
| `npm run test:run` | 57.5 s | n/a |

Disk: **1.41 GB** for the six dumps, in `source/go/parity/out/`, which is gitignored and
must stay that way.

**The gate needs 2.5 GB, not 12.** `--max-old-space-size=12000` appears in every
earlier handoff and is headroom, not a requirement: measured with
`/usr/bin/time -l`, the full gate peaks at 2,514,599,936 bytes. The scripts here
pass **4096**, which leaves 60% of headroom and fits every hosted runner,
including the 7 GB macOS arm64 ones. This is the fact that decides the whole CI
design: the full parity gate is affordable on a standard runner, so there is no
need for a reduced PR sample or a nightly-only job.

`go test ./... -race` is the long pole, not parity. Per package here:
`internal/calendar` 166.5 s, `internal/jyotish` 107.9 s, `internal/astronomy`
54.3 s, `internal/core` 42.2 s, `internal/muhurta` 27.5 s.

**So the race run is narrowed, and the narrowing is enforced.** Only
`internal/store`, `internal/core` and `internal/astronomy` start a goroutine or
touch `sync`; `internal/calendar` and `internal/jyotish`, the top two rows above,
start none at all, so racing them instruments code that cannot have a data race.
CI races the three that can and runs the rest plain. That would be a silent trap
the first time a goroutine appeared in a fourth package, so `ci/hygiene.sh` has a
rule that fails if one does.

**CI runs `parity.sh full` only, not all three stages.** g2's document is contained
in g3's and g3's in full's, full's numeric leaves cover both, and `tables-gate.mjs`
only runs on `full` anyway, so one stage buys back two thirds of the dump work and
two of the three 2.5 GB gate passes. `ci/prerelease.sh` still runs all three.

---

## 4. Which runner, and what the two hosts actually do

**The bands are host-independent, the pins are not.** That is why `pins` is keyed
by `platform/arch`, and why a host with no block is not a failure: the gate
asserts the bands, prints the block to paste, and says so.

The two hosts were measured at G5.2 and the comparison below is kept because its
*shape* is the finding, even though the numbers moved on 2026-08-30:

| | darwin/arm64 | linux/x64 |
|---|---|---|
| invariants · shifted instants | **0 · 0** | **0 · 0** |
| worst \|Δ\| g2 | 1.7053025658242404e-13 | **the same, bit for bit** |
| worst \|Δ\| g3 / full | 3.410605131648481e-13 | **the same, bit for bit** |
| numeric leaves g2 / g3 / full | 3 / 99 / 101 | **4 / 98 / 100** |
| changed values g2 / g3 / full | 3389 / 4241 / 4344 | **5109 / 5893 / 6017** |
| worst leaf at g2 | `moon.siderealLongitude` | **`sun.siderealLongitude`** |
| table gate | 9 identical, 10 lines, worst 6.203371150093062e-15 | **identical in every respect** |

### The 2026-08-30 re-pin, and its cause

Freezing the Chebyshev abscissae (below) moved the Go side and left the
TypeScript side exactly where it was. Predicted before the change, from the fact
that the Go Moon abscissa at k=2 sat one ULP *above* V8's and the freeze moves it
onto V8's: the Go dump's Moon leaves shift, the TypeScript dump does not move at
all, and the disagreement tightens rather than loosens. Measured after:

| stage | Go bytes | changed values | worst \|Δ\| |
|---|---|---|---|
| g2 | 250723471 → 250723499 | 3014 → **2264** | 1.7053e-13 → **1.1369e-13** |
| g3 | 251330044 → 251330072 | 3796 → **3046** | unchanged |
| full | 255539442 → 255539455 | 3896 → **3141** | unchanged |

TypeScript document bytes did not move at any stage, all 34 goldens stayed
byte-identical, and **no band was breached at any stage**. g2's worst leaf stayed
`moon.siderealLongitude`, which is the leaf the frozen Moon abscissa feeds, so the
prediction and the measurement agree on the mechanism and not merely on the sign.
The two implementations now agree on about 750 more values per stage than before.

**The cause is the platform, not the toolchain.** Measured by running the
TypeScript dump on linux under node **v24.4.1**, the exact version darwin uses:
250,723,677 bytes, byte-identical to linux under v24.19.0, and 3 bytes off
darwin's 250,723,680 under that same v24.4.1. A Node patch bump did not move the
document at all; changing OS and architecture did. Pinning the Node patch
version would therefore buy nothing.

**The two implementations are not equally portable, and that is a lead worth
following.** Comparing each build against *itself* across architectures, at g2:

- TS arm64 vs TS amd64: **1 leaf, 14 changed values**, worst 5.684e-14.
- Go arm64 vs Go amd64: **4 leaves**, worst 1.705e-13, over **2,102**
  `sun.siderealLongitude` and **1,780** `moon.siderealLongitude` values.

So the Go build is markedly less architecture-stable than V8 is. And the
direction is the surprising part: `sun.siderealLongitude` matches the TypeScript
**exactly on arm64** and differs on amd64, which is why linux g2 has four
differing leaves where darwin has three. `docs/porting.md` §1.1's FMA barriers are the
obvious suspect (gc contracts `a + b*c` on arm64 and not on amd64 at
`GOAMD64=v1`), but no site has been named, and the observed direction is not the
one a naive reading of that predicts. Left as a follow-up rather than guessed at
here.

**The runner.** The blocking `parity` job runs on `ubuntu-latest`. The `linux/x64`
pin block above was taken under Docker with `--platform linux/amd64` on Apple
silicon, that is, **Rosetta-translated x86-64**, and no native run was ever made.

**Both of those blocks are now stale, and the `linux/x64` one has been deleted.**
Two things moved underneath them on 2026-08-30. First, the Chebyshev abscissae in
`cache.ts` and `cache.go` are now frozen to V8's literal values rather than
computed through each platform's cosine (see below), which shifts the Go side's
Moon leaves by an ULP on every host. Second, deleting a stale block is better than
carrying it: `gate.mjs` reads `spec.pins[HOST] ?? null` and treats a missing host
as bands-only, printing the exact JSON to paste, so a host with no block harvests
its own replacement on a green run instead of failing on a pin nobody has
re-measured.

**The abscissae freeze closed the follow-up this section left open.** The lead
above was right that the direction was surprising and that no site had been named.
The site was not an FMA barrier at all: `ChebyshevLongitude`'s constructor built
its interpolation grid with `Math.cos` on one side and `math.Cos` on the other,
and those disagree by one ULP at k=2 of the Moon's ten-node grid on arm64, and at
more nodes on amd64. That one grid feeds every interpolated longitude, which is
why the whole cached path moved between architectures and why
`sun.siderealLongitude` matched exactly on arm64 and differed on amd64. Both
languages now read the same eighteen frozen constants. Measured after the freeze:
`GOARCH=amd64` reproduces `TestLongitudeCacheBitIdenticalToTypeScript` with 4 of 8
accessors bit-identical, the same count as arm64, where before it failed outright.
The Moon half stays merely bounded for a structural reason that no freeze can fix:
`moon.ts` reaches `atan2` and `sun.ts` does not.

## 5. Running it all by hand

Everything, in the order it should run:

```bash
bash ci/prerelease.sh
```

That is also the release gate, and it is strictly sequential on purpose.
`source/ts/tests/perf/perf.test.ts` makes ratio assertions and its own docblock
puts the contention failure rate at "half of all full-suite runs". Running the npm
suite alongside the Go race suite cost the G4.6 session a false red and cost the
2026-08-24 session a second one before the rule was re-read. In CI the same rule is
expressed as scheduling, by keeping `typescript` and `go` in separate jobs.

Three of the steps in that script are there because CI cannot run them: `goldens.sh`
and the two generator reproductions are pinned to `darwin/arm64` (§2.2), and
coverage re-runs the whole suite a third time on the same commit for a threshold
that has never once caught a regression. Run `ci/prerelease.sh` on the pinning host
or its answer means nothing; it prints a warning if you do not.

The individual pieces, when a single one is what you want:

```bash
bash ci/hygiene.sh                                          # 1 s
bash ci/tree.sh                                             # 0.05 s
bash ci/goldens.sh                                          # 149 s, pinning host only
node --test source/go/parity/gate.test.mjs                  # 0.6 s
bash ci/parity.sh                                           # 44 s, all stages
npm --prefix source/ts run typecheck                        # covers src, tests and the parity harness
npm --prefix source/ts run test:run                         # 57 s, NOT while the Go race suite runs
cd source/go && gofmt -l . && go vet ./... && go test ./... -race
```
