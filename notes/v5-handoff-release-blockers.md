# v5 handoff — the last three items before publishing

> ## ✅ All three closed, 2026-08-07 (same day, later session)
>
> Kept as written because the reasoning is the record. Four of this brief's own
> claims did not survive measurement, and they are worth more than the summary:
>
> 1. **The mystery baseline is identifiable, not merely suspect.** This brief
>    guessed "the v5 working tree early in Phase 36". It is **git HEAD** —
>    `package.json` said `4.3.1` for seven commits after 4.3.1 was published.
>    Built and measured, HEAD reproduces five of the eight quoted figures within
>    0–8% in one direction, and `getFestivalsInRange` lands at **336.02 against a
>    quoted 336.1**. (For the other three see (2).) There is also a proof that
>    needs no measurement: the notes quote
>    `sections: []` at 0.4227 ms, and `sections` **does not exist** in published
>    4.3.1 — that call measures 6.27 ms there.
> 2. **Two rows of the performance table were wrong in *direction*, and the
>    table turned out to carry three baselines at once.** This brief caught
>    `getSunrise` at 0.74×. `getMoonrise` is the same: the notes claimed −39%,
>    and against published 4.3.1 it is **+5%** (both were improvements over the
>    HEAD tree, where 36.1's canonical cache made a standalone cold primitive
>    60% more expensive). Row by row, the seven-row table was five rows of HEAD,
>    one row of published 4.3.1 (`computeShadbala` 0.752 ↔ measured 0.7588), and
>    one row — `getMoonrise` 0.1436 — matching *neither*, closest to the 0.1467
>    the ledger records for a v5 intermediate tree.
> 3. **The Reykjavik margin is 7.13 s, not ~6.4 s** — tighter against the 7.8 s
>    error bar than recorded here, which makes the exposure slightly worse.
> 4. **The committed harness did not run.** `notes/vcompare/driver.mjs` invoked
>    a `cmp.mjs` that does not exist; the bench file is `bench.mjs`. It now runs
>    three implementations rather than two, which is the structural fix for (1).
>
> Also corrected while the tables were open: `CHANGELOG.md` quoted Sun 0.420″ /
> Moon 1.345″ in one bullet and 0.32″ / 1.26″ in another, and "magnitudes within
> 0.0005" against a measured 0.000615.
>
> The full account is `docs/v5-validation-report.md` § *Step 5, third pass*.

Written 2026-08-07, at the end of the session that closed Phase 36 and audited
the release artifact. `package.json` is `5.0.0`, nothing is committed, and the
suite is green. This file is the durable brief for the session that finishes it.

Read this in full first, then `docs/v5-validation-report.md` § *Step 5, second
pass*, then `notes/v5-step5-predictions.md` (the predict-then-observe ledger —
append, never rewrite a prediction half), then `PLAN.md` § 36.0 and
`tests/TIERS.md`.

---

## State

`package.json` **5.0.0**, last git tag `v4.3.0`, nothing committed, the user
commits manually. **8,360 tests across 120 files**, green over three consecutive
runs. `npm run typecheck` (both configs), `lint`, `build` and `test:hermes`
clean. Bundle **583.7 KB** CJS. `astronomy-engine` has zero imports in `src/`
and no `dependencies` key exists.

Verified against the **packed tarball installed as a consumer**, not the repo:
zero transitive dependencies; all five subpaths import under ESM and CJS; types
resolve under `node16` and `bundler` with `strict` and `skipLibCheck: false`;
all four table families build → read → survive a JSON round trip. 487.7 kB,
31 files.

---

## Item 1 — the 4.3.1 baseline in the release notes does not reproduce

**This is the blocker.** `CHANGELOG.md` § Performance, `PLAN.md` § Phase 36 exit
criteria and `docs/v5-validation-report.md` all quote a "4.3.1" column that
cannot be reproduced against published 4.3.1. Measured on one machine,
interleaved process-by-process:

| config | docs say | **measured 4.3.1** | measured 5.0.0 | real speedup |
|---|---:|---:|---:|---:|
| cold/default | 0.9345 | **6.027** | 0.411 | **14.7×** |
| warm/default | 0.6291 | **6.288** | 0.170 | 36.9× |
| cold `getInstantPanchang` | 0.3185 | **0.442** | 0.209 | 2.1× |
| `getFestivalsInRange`, ms/yr | 336.1 | **2244.5** | 137.2 | 16.4× |
| `getSunrise`, cold | 0.0535 | **0.0395** | 0.0400 | 0.99× |

The ratios are 6.4×, 10.0×, 1.4×, 6.7× and **0.74×** — inconsistent, and one
inverted, so this is not a machine-speed difference. Published 4.3.1 really is
~6 ms/day: a CPU profile puts **~59% of it in `AddSol` / `CalcMoon` / `ADDN`**,
astronomy-engine's Montenbruck–Pfleger lunar theory, run by the eclipse search
on every day containing a syzygy — exactly the cost
`docs/v5-validation-report.md` describes 36.5 as removing. 4.3.1 also has no
module-level caching, which is why its warm number is no better than its cold
one.

The most likely explanation is that the column was measured against the v5
working tree early in Phase 36 — after the Lahiri fix, the exact-instant memo
and 36.1's caching had landed — rather than against the released package.

**Decide which baseline the release notes should quote**, then re-cut every
table that carries one. The two defensible choices:

- **published 4.3.1** — what users actually have, and what "upgrade and you get"
  means. Makes the headline −93% rather than −51.7%.
- **the pre-Phase-36 tree** — what the phase was held to, which is what the exit
  criterion "roughly halved" was written against.

Whichever is chosen, say in the notes *which* it is and how it was measured.
Quoting a number that cannot be re-run is the thing to fix, not the size of it.

**The harness is committed**: `notes/vcompare/` — `driver.mjs` runs every
configuration on both implementations, alternating process-by-process so a
scheduling stall lands on both, and reports each median plus the ratio. Read
`notes/vcompare/README.md` before touching it; it records two traps that each
produced confidently wrong numbers on the first attempt.

Files carrying the baseline: `CHANGELOG.md` (§ Performance table and the
prose under it), `PLAN.md` (§ Phase 36 — exit criteria, the "How the last 6.4%
was closed" block), `docs/v5-validation-report.md` (§ Step 5 — performance, and
§ Step 5, second pass, "Where the release actually lands").

Also worth folding in while the tables are open, all measured the same way:

| | 4.3.1 | 5.0.0 |
|---|---:|---:|
| `computeShadbala` / `computeBhavaBala` | 0.752 / 0.764 | 0.346 / 0.349 |
| `computeRashiChart` | **0.102** | **0.332** (3.3× *slower*) |
| `computeNavamsa` | **0.098** | **0.327** (3.3× slower) |
| 9-graha `computePlanetaryPositions` | 0.0795 | 0.3037 |
| installed footprint | 4.86 MB | 1.66 MB |
| entry bundle raw / gzip | 395.5 / 95.9 KB | 583.7 / 145.9 KB |

The chart slowdown is **entirely** the planetary ephemeris and is the deliberate
accuracy trade (Mercury 6.504″ → 0.296″, Venus 19.586″ → 0.862″). It should be
in the notes as a stated trade, not omitted — it is the one place a user can be
worse off, and chart-heavy consumers deserve to know.

---

## Item 2 — `EclipseInfo.magnitude` publishes obscuration, not magnitude

`src/astronomy/eclipse.ts:203` sets the public `magnitude` field from
`eclipse.umbralObscuration`, and `:257` from `eclipse.obscuration`. Those are
the fraction of the disc's **area** covered. Every published eclipse catalogue —
NASA/Espenak included — means the fraction of its **diameter** by "magnitude".

Measured against the NASA canon, partial lunar eclipses:

| | NASA umbral magnitude | field returns | conversion predicts |
|---|---:|---:|---:|
| 2097-04-26 | 0.8420 | 0.8795 | 0.897 |
| 2099-04-05 | 0.1680 | 0.0975 | 0.111 |

The values are correct *obscuration*; only the name is wrong. The internally
computed `umbralMagnitude` agrees with NASA to **0.0006** across 457 eclipses —
it simply is not the field that gets published.

Present in 4.x too, so it is not a regression, but a major release is the moment
to fix a wrong name and this one silently misleads anyone cross-checking against
a catalogue.

**Recommended:** publish both — rename the existing field to `obscuration` and
add a correctly-defined `magnitude` from the geometry that already computes it.
That makes the API honest and gives the field people expect. It is breaking, so
it needs a CHANGELOG § "Breaking — the result object" entry and a line in the
README's upgrade table. Check `EclipseInfo` at `src/astronomy/eclipse.ts:43`,
the eclipses static-table types, and `buildEclipsesTable` — the field flows into
the emitted table format, so a table built by 5.0.0 must still read.

Add a Tier 0 assertion for the new `magnitude` against `nasa-eclipses.json`'s
`umbralMagnitude` column while you are there; the fixture already carries it and
nothing currently checks the published field against anything.

---

## Item 3 — the Reykjavik Tula Sankranti has no fixture

Phase 36.2 left the Tula Sankranti of 2025 at Reykjavik sitting **~6 s before
that day's sunrise**:

| | instant |
|---|---|
| Reykjavik sunrise, 2025-10-17 | 08:24:46.193 UTC |
| Tula sankranti (5.0.0) | 08:24:39.759 UTC — **−6.4 s**, so the transit files under Oct 16 |

The Sun is accurate to 0.323″, which is ~7.8 s of sankranti instant at 24 s per
arcsecond. So a movement well inside the release's own error bar flips which
calendar day this sankranti — and the two festival entries derived from it —
belongs to. **No fixture pins it**, and `getSankrantisForYear` publishes only
the *date*, so `notes/diff.mjs` cannot see the instant move: the only observable
is the day, and it flips discontinuously.

It held through both of this session's value-moving changes, so this is not a
bug to fix — it is an exposure to make **loud**. Add a Tier 2 fixture that pins
the instant and its margin against sunrise, with a comment saying that a failure
here means the day may have flipped and the sankranti list must be re-checked by
hand rather than re-pinned. `tests/validation/` is the right home; declare
`@tier 2` (it pins our own output) so `tier-policy.test.ts` accepts it.

---

## Not blockers, but say so out loud rather than letting them be discovered

- **The next performance lever is the new-moon phase search, not the rise/set
  track.** Counting evaluations on a default day: `getTropicalMoonLongitude` is
  17.4 reads (9,854 ELP terms, 54%), the rise/set track 2.75 reads (37%
  before this session's change), `getMoonPosition` 1.3. Of those 17.4, only
  **2.5** are `cache.ts`'s Chebyshev block builder — the other ~15 come from
  `boundingNewMoons`, at 2.07 searches a day and ~6 elongations each. Sharing it
  across calls needs the search made *canonical* first, the way `sunrise.ts` was:
  it currently returns instants that depend slightly on the seed it was handed,
  so a naive module-level cache would reintroduce exactly the order-dependence
  `cache.ts` documents at length. A v5.1 item.
- **The two absolute ms/day ceilings are loose (1.60) on purpose.** Full-suite
  contention spans 2.9× on the reference machine — 0.384–0.479 ms/day at load
  ~3, up to 1.093 at load ~11 — which is wider than the 1.5× regression the test
  exists to catch. The reasoning is written into both tests. Do not tighten them
  without re-measuring the spread; the *direction* assertion beside them failed
  once at load 11 too, so a ratio is not a way out.
- **Drik is not a reference for moonrise/moonset.** Its Moon runs ~4 min late on
  rise and ~4 min early on set against USNO — symmetric, the signature of
  requiring the disc's centre rather than its upper limb — and it attributes
  moonrise to the **Hindu day**, so it can publish an event falling on the next
  calendar date. Its Sun agrees with USNO and with this library to the printed
  minute. Both differences are identical in 4.3.1 and 5.0.0. Recorded in
  `tests/TIERS.md` and `tests/validation/tier0-usno-riseset.test.ts`.

---

## Constraints

- **Never `git commit`, tag or push.** Leave everything in the working tree.
- **Do not edit `README.md`** unless Item 2 changes the public result shape, in
  which case the upgrade table needs the one line and nothing else.
- `BASELINE_MAX_ARCSEC` in `tier0-horizons.test.ts` may only ever be tightened.
- New `tests/validation/` files declare `@tier 0|1|2`; Tier 0 files also go in
  the pinned membership list in `tier-policy.test.ts`.
- `src/astronomy/series/*.ts` are generated — change the budget in
  `notes/ephemeris-generate.src.ts` and regenerate, never hand-edit.
- Anything that moves a published value goes through §36.0 E: prediction written
  into `notes/v5-step5-predictions.md` **before** running, then observed. Item 2
  moves a published field, so it qualifies.
- Run the full suite **five times**, not once. An intermittently-green threshold
  is how the `perf.test.ts` flake hid, and two more surfaced this session as
  vitest's default 5 s timeout on compute-heavy deterministic tests.

## Verification harnesses, all committed

| script | answers |
|---|---|
| `notes/vcompare/` | a released version against the working tree — runtime, eclipses, Drik parity |
| `notes/driver.mjs` + `bench.src.ts` | per-call cost, one configuration per process |
| `notes/dump.sh` + `diff.mjs` | whether a change moved any published value (241 MB each side, **now including a five-nativity chart sweep**) |
| `notes/track-fit.src.ts` | the rise/set track's fit error vs span × node count |
| `notes/usno-riseset-fetch.mjs` | the USNO rise/set fixture |
| `notes/ephemeris-generate.sh` | regenerates `src/astronomy/series/*.ts` (~4 min at `PROBE_COUNT = 100_000`) |

`notes/v5-harness.md` documents all of them, including the hole that was closed
this session: `dump.src.ts` contained no charts, so a change confined to the
planetary path produced an empty diff and looked output-neutral when it was not.
