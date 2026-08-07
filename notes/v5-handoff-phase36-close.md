# v5 handoff — closing Phase 36

> **Closed 2026-08-07.** All four tasks are done and `package.json` is `5.0.0`.
> This file is kept as the brief that was worked from, not as current state —
> read [docs/v5-validation-report.md](../docs/v5-validation-report.md)
> § *Step 5, second pass* for what actually happened, and
> [v5-step5-predictions.md](v5-step5-predictions.md) for the predict-then-observe
> ledger.
>
> Three things below turned out to be wrong, and they are the useful part:
>
> 1. **"The track is roughly 80% of the lunar series cost against ~2.55 direct
>    longitude reads."** Measured by counting evaluations: the track is **37%**,
>    and of the 17.4 longitude reads a day only 2.5 are the Chebyshev block
>    builder — the other ~15 are the **new-moon phase search** behind Chandra
>    Masa. That search is the next real lever and is still there.
> 2. **"Raise `PROBE_COUNT` until the reported error stops moving."** It never
>    stops: the residual's supremum is an extreme-value problem and at 100,000
>    draws consecutive probes are still 13 days apart. It is anchored at the
>    differential test's own sample size instead.
> 3. **"Replace the two ratio bounds with absolute ms/day ceilings."** Done, and
>    the measurement says the replacement cannot be a tight gate here: full-suite
>    contention spans 2.9× on this machine, wider than the 1.5× regression the
>    test looks for. The ceiling is deliberately loose and says so.

Written 2026-08-07, at the end of the session that finished 36.5 and the Phase 36
performance work. `package.json` is `5.0.0-rc.1`; last git tag `v4.3.0`; nothing
is committed.

This file is the durable copy of the brief for the next session. It exists so a
fresh session can be pointed at it rather than handed 4,000 words inline.

---

## Where things stand

**Phase 36 is functionally complete.** `astronomy-engine` has **zero imports in
`src/`** and is a devDependency; `package.json` has no `dependencies` key at all
and `dist/index.cjs` contains none of it. 8,346 tests across 118 files pass
(verified over five consecutive full runs). `npm run typecheck` (both configs),
`npm run lint`, `npm run build` and `npm run test:hermes` are clean. Bundle
549.4 KB CJS.

Three things are open, all decided by the maintainer on 2026-08-07, and **all
three must land before 5.0.0 is published** — which is why the version was moved
back from `5.0.0` to `5.0.0-rc.1` and the CHANGELOG heading un-dated.

### What the last session built

| file | what |
|---|---|
| `src/astronomy/eclipseGeometry.ts` | own lunar (Meeus ch. 54 shadow) and solar (direct topocentric) eclipse geometry |
| `src/astronomy/eclipse.ts` | rewritten onto it; `isBodyAboveHorizon` now takes `'sun' \| 'moon'` |
| `src/astronomy/horizon.ts` | generalised from Sun-only to either body |
| `src/astronomy/trig.ts` | **new** — own `sin`/`cos`, Cody–Waite reduction + Taylor kernel |
| `src/astronomy/frame.ts` | nutation by angle addition; 16-entry memo; `fundamentalArguments` inlined |
| `src/astronomy/vsop87.ts` | `earthRect` memo (4 entries, exact-key) |
| `src/astronomy/planet.ts` | light-time 3 passes → 2, Earth read once at `t` then once at `t − τ` |
| `src/astronomy/elp.ts` | calls `trig.ts` |
| `src/utils/timezone.ts` | table-driven `formatInZone` |
| `notes/eclipse-local-fetch.mjs` | NASA city catalogs → `tests/fixtures/nasa-eclipse-local.json` (788 rows, 10 sites) |
| `notes/pi-split.mjs` | derives the three π constants in `trig.ts` from 60 decimal digits |
| `tests/reference/eclipse-reference.ts` | frozen eclipse reference + `shadowAxisGamma` |
| `tests/validation/tier0-own-eclipses.test.ts` | `@tier 0`, 1,697 NASA rows |
| `tests/validation/differential-eclipse.test.ts` | §36.0 H for the eclipse search |
| `tests/validation/differential-trig.test.ts` | §36.0 H for `trig.ts` |

### Measured results — do not re-derive, do not lose

**Tier 0, max |error| vs JPL Horizons DE441, 1900–2100, 250 epochs:**

| body | baseline (`astronomy-engine`) | own reference | own shipped |
|---|---|---|---|
| Sun | 1.613″ | 0.115″ | **0.420″** |
| Moon | 3.747″ | 1.287″ | **1.345″** |
| Mercury | 6.504″ | 0.254″ | **0.499″** |
| Venus | 19.586″ | 0.261″ | **1.217″** |
| Mars | 11.103″ | 0.260″ | **1.607″** |
| Jupiter | 9.662″ | 0.553″ | **0.889″** |
| Saturn | 11.147″ | 0.450″ | **0.876″** |

**Eclipses vs NASA/Espenak:** lunar type 0 mismatches in 457; greatest eclipse
≤3.84 s TT; penumbral/umbral magnitude ≤0.0003/0.0005. Solar γ ≤0.00015 Earth
radii in 452; type at the greatest-eclipse point 0 mismatches in 378 in-scope
rows. Local contacts at 10 cities: **1901–2002 bias −0.75 s, max 43.1 s**;
2003–2100 bias +16.6 s (a ΔT-model difference, not an ephemeris error).

**Rise/set vs the direct solver:** 0.687 ms below 65°, 24.1 ms including Alert
(82.5 °N), 0 event-count mismatches.

**Truncation, `DIFFERENTIAL_FULL=1`, 100,000 instants:** Moon 0.45073″, Sun
0.45312″.

**Drik parity (Tier 1):** tithi 42 s, karana 49 s, nakshatra 22 s, yoga 58 s.

**Performance**, median of 15, machine at load average 4.3:

| | 4.3.1 | now |
|---|---|---|
| cold/default | 0.9345 | **0.501** |
| cold `sections: []` + no end-times | 0.4227 | **0.2741** |
| cold `getInstantPanchang` | 0.3185 | **0.2338** |
| warm default | 0.6291 | **0.1803** |
| `getFestivalsInRange`, ms/yr | 336.1 | **162.4** |
| `chart/shadbala` | — | **0.347** |

---

## Task 1 — close the performance gap, **structurally only**

`cold/default` is 0.501 ms against a 0.47 ms exit criterion. **No accuracy may
be traded to close it.** The maintainer explicitly rejected the fast route
(lunar budget 0.4″ → 0.6″, worth ~5%) because it drops the Moon's margin against
its 3.747″ ceiling from 2.8× to 2.6×, below §36.0's 3× floor.

### Step 0 — re-measure on an idle machine, before anything else

Every number above was taken with a load average of 4.3 and Chrome at 69% CPU.
The 4.3.1 baseline of 0.9345 was measured on the same machine at unknown load.
**So the 6.4% shortfall may be partly measurement conditions.** Before optimizing
anything:

```bash
bash notes/build.sh && node notes/driver.mjs idle 15 notes/bench-final.json
```

and check `uptime` before and after. If the gap closes on its own, say so and
stop — that is a legitimate outcome and it is cheaper than any of the work below.

### Step 1 — the lever, and what has already been ruled out

Profile first (do not optimize blind):

```bash
cp notes/prof/scan.src.ts .prof-scan.ts
npx esbuild .prof-scan.ts --bundle --platform=node --format=esm \
  --outfile=/tmp/prof-scan.mjs --log-level=error --sourcemap && rm .prof-scan.ts
mkdir -p /tmp/prof && (cd /tmp/prof && node --cpu-prof --cpu-prof-dir=. /tmp/prof-scan.mjs)
node notes/prof/parse.mjs /tmp/prof
```

The last profile (2026-08-07, after everything):

| | share of self time |
|---|---|
| `sumLinear` + `sumQuartic` (ELP2000-82B) | ~32% |
| lunar position glue (`getTropicalMoonLongitude`, `moonPositionWith`) | ~12% |
| nutation (`nutation` + `fillMultipleTables` + `sumNutation`) | ~9% |
| rise/set (`gast` + `altitudeExcess` + `scanDay` + `DayTrack`) | ~9% |
| `formatInZone` | ~3% |
| `evaluateVsop` | ~3% |

**The remaining lever is how many times the lunar series is evaluated, not how
fast each evaluation is.** `riseSet.ts` builds a `TRACK_NODES = 7` Chebyshev
track per body per UTC day, and each Moon node is a full
`moonElpLongitude` + `moonElpLatitude` + `moonElpDistanceTrack` +
`moonElpDistanceCoarse` — about 970 terms, seven times a day, which is roughly
80% of the lunar cost. The direct longitude reads are only ~2.55/day.

So the candidate is: **share one interpolant** between `cache.ts` (which already
Chebyshev-interpolates ecliptic longitudes over shared blocks) and `riseSet.ts`
(which fits equatorial rectangular components per day), or fit the track from
fewer, wider-spanning nodes. This is genuinely new numerical work and §36.0 H
governs it: freeze the current `DayTrack` as a reference, then differential-test.
`tests/reference/riseset-reference.ts` and
`tests/validation/differential-riseset.test.ts` are the existing seam — the
latter already measures a solver that interpolates nothing, and its **0 event
count mismatches** assertion is the one that must not move.

### Already measured and rejected — do not redo these

- **ELP main-problem angle addition** (§36.5's own first-listed candidate).
  Worth −34% against a `Math.sin` baseline — but the loop no longer calls
  `Math.sin`. `trig.ts` already took −54%, more cheaply. Folding four integer
  multipliers costs more than one reduced sine. Micro-benchmarked, not guessed.
- **`TRACK_NODES` 7 → 6 → 5** and **`SCAN_STEP_DAYS` 12 → 18 → 24 min**. Swept:
  −1.6% and −1.8%, both inside the run-to-run spread, and **5 nodes is worse
  than 7** (a poorer fit costs more in scan subdivision than it saves in
  evaluations).
- **Lunar budget 0.4″ → 0.6″.** Rejected on accuracy margin, above.

### Step 2 — replace two ratio bounds with absolute ceilings

`tests/unit/sections.test.ts` and `tests/perf/perf.test.ts` each assert that
`sections: []` costs under some fraction of a full run. Both bounds were moved
0.5 → 0.62 in the last session because the **denominator** improved 38% (36.5
took `astronomy-engine`'s eclipse search out of the full call), and the
`perf.test.ts` one had been sitting at 0.505–0.514 — passing about one full-suite
run in three, which is worse than failing.

The justification is sound and written into both files, but **a ratio bound
cannot distinguish "narrowing got worse" from "the full call got better"**, and
loosening two of them the same way is a smell. Replace them with **absolute
ms/day ceilings** measured on an idle machine, keeping the existing
"never costs more to ask for less" direction assertions unchanged. State the
machine and the method in the test, as those files already do.

---

## Task 2 — the generator's budgets are measured over too few probes

`notes/ephemeris-generate.src.ts` sets `PROBE_COUNT = 600`. Every series is
truncated by binary search on the worst disagreement with the full series over
that many pseudo-random epochs, so the budget each generated file advertises is
a **600-sample maximum**.

Measured by `DIFFERENTIAL_FULL=1` over 100,000 instants:

| | generator says (600 probes) | measured (100,000) |
|---|---|---|
| Moon longitude | 0.398″ | **0.45073″** |
| Sun longitude (Earth L) | 0.363″ | **0.45312″** |

13–25% optimistic. Nothing about the shipped accuracy is threatened — the
accuracy claim is Tier 0's, against DE441 — but the number printed into the
generated file's header is what a future maintainer would tune a budget against.

**Do:** raise `PROBE_COUNT` until the reported error stops moving (generation
takes ~4 s at 600, so try 5,000 and 20,000 and compare), then regenerate.

**This moves published values.** Term counts will rise slightly, so §36.0 E
applies in full — see "The protocol" below.

---

## Task 3 — give the planet path its own Earth series

Raising `sunLon`/`sunLat` from 0.1″ to 0.4″ dropped Earth's longitude series
from 219 terms to 108 and bought ~2% of a cold call. **It also degraded the
planets by ~50%**, which was not predicted and is a coupling the per-body error
budget hides: a geocentric planetary direction is `planet − Earth`, so it
inherits Earth's heliocentric error.

| | before | after |
|---|---|---|
| Mercury | 0.327″ | 0.499″ |
| Venus | 0.824″ | 1.217″ |

The arithmetic checks out from geometry: 0.363″ of Earth-L truncation subtends
0.66″ at Mercury (Δ_min ≈ 0.55 AU) and 1.34″ at Venus (Δ_min ≈ 0.27 AU).

**The maintainer's decision:** keep the coarse Earth series for the **Sun** path
(so `cold/default` keeps its win) and add a **second, full-precision Earth
series for the planet path**. Concretely:

- emit a separate `EAR_L_PRECISE` / `EAR_B_PRECISE` (and reuse `EAR_R`, whose
  budget did not change) at a tight budget — 0.1″ or better;
- have `planet.ts`'s `earthRect` read those, while `sun.ts` keeps reading the
  coarse ones;
- keep the exact-key memo — it is what turns 15 Earth evaluations into 3 for a
  chart, and it must stay a pure function of `ttDays`.

**Two costs to measure and report, not assume:**

1. **`chart/shadbala` and `chart/bhavabala` will get slower.** They are currently
   0.347/0.349 ms, having just improved 12% from the light-time restructure.
   Measure the regression; if it exceeds ~15% it is worth saying so before
   accepting.
2. **Bundle grows ~25 KB.** The maintainer declined bundle-size work, so this is
   accepted — but record the new figure (currently 549.4 KB CJS).

**What this does NOT fix, and must be recorded as a live exposure:** the Sun
stays at 0.420″, so sankranti instants carry ~10 s of error (24 s per
arcsecond). Phase 36.2 already found the Tula Sankranti of 2025 at Reykjavik
sitting **6.4 s before sunrise** — a day-boundary case that a future ephemeris
change could flip. It held through this session (the sankranti lists were
byte-identical across the budget change), but it is one small movement away
from moving a festival date, and no fixture pins it.

---

## Task 4 — robustness debt from the last session

Cheap, and none of it moves a published value.

1. **`trig.ts` has no edge-case tests.** Add to `differential-trig.test.ts`:
   `NaN`, `±Infinity`, `±0`, and subnormals, asserting agreement with
   `Math.sin`/`Math.cos` on those inputs (they do agree today — `sin(Infinity)`
   is `NaN` via `Inf − Inf` — but nothing says so).
2. **Two new memos have no purity test.** `earthRect` (`vsop87.ts`, 4 entries)
   and `nutation` (`frame.ts`, 16 entries) are module-level and keyed on exact
   argument equality. `differential-riseset.test.ts` has exactly the right test
   for the track cache — *"the track cache cannot change an answer, only the work
   to get one"* — clear it, compute cold, compute warm, populate it differently,
   recompute, assert equality. Write the same for these two.
3. **`MOON_LATITUDE_TRACK_*` is generated and unused.** `moon.ts` explains why
   the tier was measured and rejected (402 ms of moonrise error at Alert), but
   the generator still emits ~6 KB of it. Tree-shaken out of `dist`, so this is
   readability only. Remove `BUDGET.moonLatTrack` and its emission; leave
   `moonDistTrack`, which **is** used.

---

## The protocol — non-negotiable, and Tasks 2 and 3 both trigger it

PLAN.md §36.0 E and `tests/TIERS.md`. Both remaining value-moving tasks need:

1. **Write the predicted fixture movement into
   `notes/v5-step5-predictions.md` before running anything.** Append; never
   rewrite the prediction halves. The sensitivity coefficients are in TIERS.md
   (Moon: δ″ ⇒ δ × 1.82 s; Sun: δ″ ⇒ δ × 24 s of sankranti; yoga carries both).
2. **Run them separately, not together.** They have different footprints and
   entangling them destroys the attribution:
   - Task 3 (planet Earth series) touches **only planetary longitudes**. Note
     that `notes/dump.src.ts` does **not** include charts, so `diff.mjs` will
     show *nothing* — verify it through `tier0-own-planets.test.ts` and a
     targeted chart comparison instead, or extend `dump.src.ts` with a chart
     sweep (better, and it closes a real hole in the harness).
   - Task 2 (PROBE_COUNT) touches everything. `notes/dump.sh` before/after +
     `node --max-old-space-size=8000 notes/diff.mjs`.
3. **Movement larger than predicted, or touching an index, name, boolean, count
   or festival date, is a bug.** Find it; do not re-pin. The last session's
   budget change produced **0** invariant changes across 241 MB, so that is the
   bar.
4. **Re-pin once, at the end**, with predicted and observed both recorded.
   Regenerate fixture values with a script, not by transcribing failure output.

### Commands

```bash
bash notes/dump.sh before      # with the change reverted
bash notes/dump.sh after       # with it applied
node --max-old-space-size=8000 notes/diff.mjs notes/dump-before.json notes/dump-after.json
```

```bash
bash notes/ephemeris-generate.sh                                   # ~4 s
DIFFERENTIAL_FULL=1 npx vitest run tests/validation/differential-ephemeris.test.ts   # ~10 min
bash notes/build.sh && node notes/driver.mjs <label> 15 notes/bench-final.json
```

---

## Then, to close the release

- Re-run `DIFFERENTIAL_FULL=1` and update the measured figures in
  `differential-ephemeris.test.ts`'s comments and the term counts quoted in
  `elp.ts` / `vsop87.ts` headers.
- Confirm Drik parity is still ≤58 s (`element-endtime-audit.test.ts`, and the
  standalone measurement in `docs/v5-validation-report.md`).
- Full suite **five times**, not once — an intermittently-green threshold is how
  the `perf.test.ts` flake hid.
- `npm run typecheck` (both configs), `npm run lint`, `npm run build`,
  `npm run test:hermes`.
- Update `docs/v5-validation-report.md` § Step 5, `PLAN.md` § Phase 36 exit
  criteria (the assessed table), and `CHANGELOG.md`.
- Bump `5.0.0-rc.1` → `5.0.0` and date the CHANGELOG heading **only when the
  three tasks are actually done**.

---

## Constraints

- **Never `git commit`, tag or push.** Leave changes in the working tree.
- **Do not edit `README.md`** — deferred to a separate docs web app.
- `BASELINE_MAX_ARCSEC` in `tier0-horizons.test.ts` may only ever be
  **tightened**.
- New files under `tests/validation/` must declare `@tier 0|1|2` in the opening
  block comment, and Tier 0 files must be added to the pinned membership list in
  `tier-policy.test.ts` (that guard has now fired correctly twice).
- Every optimization is subject to §36.0 H: the current implementation becomes
  the frozen reference, and the fast one is differential-tested against it.
  Speed may not be bought with unvalidated arithmetic.
- `src/astronomy/series/*.ts` are **generated**. Do not hand-edit; change the
  budget in `notes/ephemeris-generate.src.ts` and regenerate.

---

## Findings from the last session — carry these into any write-up

1. **The lunar shadow enlargement is Danjon's rule on the Earth's radius**
   (1 + 1/85 − 1/594), not 2% on the shadow radii. Identified by inverting the
   canon's own 457 published magnitudes: the 2% reading is not self-consistent
   (1.0137 umbra vs 1.0080 penumbra, disagreeing by 20× their scatter) while the
   Danjon reading is (1.00989 / 1.01016). Before the correction, penumbral
   magnitude carried a +0.028 bias and **two eclipses were mis-typed**.
2. **`Math.sin` was 77% of the lunar series loop**, most of it argument reduction
   for a range these phases never approach. `src/astronomy/trig.ts` is 30 lines
   and worth −54% of that loop — more than every other optimization in the phase
   combined. It also makes results identical across V8, JavaScriptCore and
   Hermes, which `Math.sin` does not guarantee.
3. **A frozen reference can be the *less* accurate of the two.** The eclipse
   reference originally minimised by golden section, which landed 316 ms from the
   true minimum at Varanasi 1976 while the shipped parabolic fit landed on it
   exactly — near a flat minimum golden section compares samples differing by
   ~10⁻¹⁴, below the noise floor of an `atan2` of a cross product. Replaced with
   nested enumeration. Worth remembering the next time a reference is written:
   *obvious* is not the same as *well-conditioned*.
4. **NASA's `SEcirc/…circ.html` per-eclipse URL family does not exist** (404).
   The same data is published per **city** at `SEcirc/SEcirc.html`, complete over
   0001–3000 CE — which is better, because an eclipse's *absence* from a city's
   catalog is itself ground truth and supplies the "not visible at all" case.
5. **Solar local circumstances after 2003 carry a ΔT-model difference**, not an
   ephemeris error: +16.6 s mean, +25.8 s worst bucket, zero everywhere ΔT is
   observed and growing smoothly only where it is predicted. There is no time
   scale in which it cancels, because a local circumstance is a function of UT
   and TT at once. Same exposure `deltaT.ts` documents, from a second direction.
6. **A per-body error budget hides the coupling through the observer.** Raising
   Earth's budget for the Sun's sake degraded Mercury and Venus by ~50% with
   their own budget untouched. Task 3 fixes it; the lesson generalises.
