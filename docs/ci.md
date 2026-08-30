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

One workflow per concern, so a red check names its own cause:

| workflow | what it gates |
|---|---|
| `typescript.yml` | the npm package: lint, both typechecks, the suite on Node 22 and 24, coverage, the Hermes syntax check, the build |
| `go.yml` | the Go module: gofmt, vet, `go test -race`, and a build at go.mod's declared minimum |
| `parity.yml` | the two implementations agreeing: hygiene, tree correspondence, goldens, the parity gate, generator reproduction |
| `release.yml` | publishing, which runs the cross-language gates first |

Splitting them this way keeps every job name unchanged, and required status
checks match the job name rather than the workflow or the file, so the split
moves nothing in branch protection.

There is exactly one copy: the draft that used to sit at `ci/workflows/` was
moved rather than copied, because two copies of a workflow are two things to keep
in step and only one of them runs.

Every script it calls lives here and is runnable by hand, which is deliberate:
the workflow is a thin shim over scripts that can be debugged locally, rather
than logic that only exists inside a YAML file nobody can run.

**It needs `go/` to be tracked in git.** It was written while `go/` was still
untracked, and every Go job would fail with "no such file" on a checkout without
it. Not a live hazard (the triggers are `master` only, so nothing runs until
`go_port` merges and `go/` arrives in the same merge), but the failure mode is
confusing if it ever does happen.

### Why it says `master`

`typescript.yml` and `release.yml` were written against `main`, which this repository has
never had, so neither had ever run. Both were corrected to `master`. Check
`git ls-remote --heads origin` before changing that line.

`typescript.yml`'s `coverage`, `hermes` and `build-check` jobs had therefore never
executed. All three were run by hand on 2026-08-29 before being trusted:
`build-check` and `hermes` passed; `coverage` failed intermittently, because
`tests/unit/sections.test.ts` holds two timing assertions and one of them
exceeded vitest's 5 s default under v8 instrumentation. `npm run test:coverage`
now sets `COVERAGE=1` and every timing test is `it.skipIf(process.env.COVERAGE)`,
so the reading never measures the instrumentation. The ordinary `test:run` is
unaffected and still runs all 8,778.

`release.yml` publishes the npm package. The Go module is tagged off the same
commit, so it now runs the tree, goldens and parity gates before publishing:
shipping one language against a tree where the other disagrees is the failure
this repository exists to prevent.

**Nothing outside `release.yml` writes.** No tag, no push, no publish;
`permissions: contents: read` is set explicitly in every workflow rather than
inherited.

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

### 2.2 Goldens: `bash ci/goldens.sh`

`source/go/parity/goldens.sh` regenerates all **34** `testdata/goldens/**/*-golden.json` from
the *TypeScript* tree. Rerunning it must be a no-op; this asserts that by
checksum, so it works on a tree where `go/` is not yet tracked by git.

It is the cheapest gate that can see a `source/ts/src/` behaviour change at all, because
the goldens are the TypeScript's own answers. Paired with `go test ./...`
afterwards it says "the TypeScript moved and the Go did not" for **149 s + 18 s**
and no 250 MB documents.

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

---

## 4. Which runner, and what the two hosts actually do

**Both hosts are measured, and `bands.json` carries a pin block for each.** This
was the open question at G5.2 and it is now closed by measurement rather than by
argument.

| | darwin/arm64 | linux/x64 |
|---|---|---|
| invariants · shifted instants | **0 · 0** | **0 · 0** |
| worst \|Δ\| g2 | 1.7053025658242404e-13 | **the same, bit for bit** |
| worst \|Δ\| g3 / full | 3.410605131648481e-13 | **the same, bit for bit** |
| numeric leaves g2 / g3 / full | 3 / 99 / 101 | **4 / 98 / 100** |
| changed values g2 / g3 / full | 3389 / 4241 / 4344 | **5109 / 5893 / 6017** |
| worst leaf at g2 | `moon.siderealLongitude` | **`sun.siderealLongitude`** |
| table gate | 9 identical, 10 lines, worst 6.203371150093062e-15 | **identical in every respect** |

So: **the bands are host-independent, the pins are not.** That is why `pins`
is keyed by `platform/arch`, and why a host with no block is not a failure: the
gate asserts the bands, prints the block to paste, and says so.

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

**The runner.** The blocking `parity` job runs on `ubuntu-latest`, which is the
host the linux pins came from. One caveat, stated because it is the difference
between a measurement and an assumption: those pins were taken under Docker with
`--platform linux/amd64` on Apple silicon, i.e. **Rosetta-translated x86-64**.
Translation preserves IEEE semantics, so native amd64 should agree, but no
native run has been made. If the first real run fails on a PIN and not on a
BAND, the gate prints the exact JSON to paste; re-pin from that run and record
the measurement.

## 5. Running it all by hand

```bash
bash ci/tree.sh                                   # 0.05 s
cd source/go && gofmt -l . && go vet ./... && go test ./... -race && cd ..
bash ci/goldens.sh                                # 149 s
node --test source/go/parity/gate.test.mjs                  # 0.6 s
bash ci/parity.sh                                 # 44 s
npm run test:run                                     # 57 s, NOT while the Go race suite runs
npm run typecheck
npx --prefix source/ts tsc -p source/go/parity/tsconfig.json
```

`source/ts/tests/perf/perf.test.ts` makes ratio assertions and its own docblock puts the
contention failure rate at "half of all full-suite runs". Running the npm suite
alongside the Go race suite cost the G4.6 session a false red and cost this one
a second one before the rule was re-read; the draft workflow keeps them in
separate jobs, which is the same rule expressed as scheduling.
