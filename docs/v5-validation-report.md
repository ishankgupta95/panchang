# v5 validation report

The audit trail for the v5 release (`5.0.0-alpha.x`, branch
`performance_improvement`). Every change that can move a published number is
recorded here **before** its effect is observed, so "the tests went green" is
never the evidence.

Three tables, repeated per module changed:

| what | rule |
|---|---|
| accuracy vs Tier 0 | `PASS` only if new max error ≤ baseline across the **whole** 1900–2100 span |
| numeric fixture re-pins | delta **predicted from first principles before it was observed**; `matches? = no` is a bug, not a re-pin |
| invariant-test changes | must be **zero**, always |

Tiers of authority (PLAN.md §36.0 A): **Tier 0** = JPL Horizons / Swiss
Ephemeris / NASA eclipse canon — the only tier that can adjudicate. **Tier 1** =
DrikPanchang, rule-level only, ±30 s quantized. **Tier 2** = our own pinned
fixtures — regression detectors with zero independent authority.

---

## Status summary

| Step | Scope | Verdict |
|---|---|---|
| 0 | version → `5.0.0` | **done** — the three value-moving items that held it at rc are closed |
| 1 | Phase 36.1 — structural performance | **done**, 5 of 6 items; item (b) deferred to 36.3 with reasons |
| 2 | Phase 37 — table/compute API | **done**, all exit criteria met |
| 3 | Phase 38 — result shape | **done** — all seven items |
| 4 | Phase 36.0 — validation protocol | **done** — Tier 0 fixtures, baseline curve, cross-checks, enforced tier split |
| 5 | Phases 36.2–36.5 — own ephemeris | **done** — ΔT, Sun, Moon, Mercury–Saturn, rise/set, moon phases and both kinds of eclipse. `astronomy-engine` is a devDependency; the package has no runtime dependencies |
| 5 | Phase 36 — performance | **done** — `cold/default` **0.4105 ms**: −93.2% against published 4.3.1 (6.0562), −57.9% against the pre-Phase-36 tree the 0.47 target was written for. The "4.3.1" column the notes previously quoted was neither — see *Step 5, third pass* |

**Invariant-test changes: 0**, across three separate 241 MB before/after
comparisons. **Numeric fixtures re-pinned: 3 families**, each with the delta
written down before it was observed — the five Bhava Bala totals (last movement
0.0001 V, predicted ≤0.005), one yoga-transition instant (−196 ms, predicted
≤3.0 s), and one Tier 0 eclipse magnitude bound (0.000535 → 0.000615, attributed
to the lunar latitude series' own 0.2″ budget).

**One defect was found and fixed rather than re-pinned.**
`boundingNewMoons(t)`, for a `t` sitting exactly on a new moon, could return the
*previous* lunation and so report the previous Chandra Masa: `searchMoonPhase`
rounds its root to a whole millisecond, the same syzygy reached from a different
seed can round the other way, and an exact `prev <= ref` comparison then rejected
the fast path. Pre-existing; exposed by the regenerated series moving the root
across a rounding boundary.

Five *performance-ratio* tests had their measurement workload or bound changed.
Three are documented under "Step 1 — the three performance tests whose
*measurement* broke". The other two are the twin `sections: []` ratio
assertions in `sections.test.ts` and `perf.test.ts`, whose bounds moved 0.5 →
0.62 because the **denominator** improved — written up under "Step 5 —
performance". The `perf.test.ts` one had been sitting at 0.505–0.514 against a
0.5 bound and passing about one run in three, which is worse than failing: an
intermittently-green threshold is not evidence of anything.

**Accuracy bounds that widened, and why — all of them.** Being explicit, because
"the tests are green" is worth nothing without this list:

| bound | from | to | cause |
|---|---|---|---|
| own Sun vs DE441 | 0.2″ | 0.5″ | truncation budget 0.1″ → 0.4″, deliberate; measured 0.4196″ |
| own Mercury / Venus vs DE441 | 0.5″ / 1.1″ | 0.7″ / 1.5″ | the same change, reaching them through **Earth's** series — not predicted, derived afterwards, 13–16× inside the ceiling |
| shipped-vs-untruncated Sun / Moon | 0.15″ / 0.3″ | 0.5″ / 0.5″ | the same change, plus the 100,000-instant sample finding a deeper tail than the everyday one |
| eclipse γ vs NASA | 0.00015 | 0.0002 | the Moon's coarser series; still 2 units in the last digit NASA prints |
| `sections: []` cost (two tests) | ratio < 0.62 | **absolute 0.80 ms/day** | a ratio cannot say *which* side moved; replaced with an absolute ceiling, measured |
| interpolated rise/set below 65° | 5 ms | 10 ms | the recorded 0.687 ms was stale; the true figure is Sun 1.9 / Moon 4.2 ms and is the **lunar distance tier**, not the interpolation |
| Tier 0 umbral eclipse magnitude | 0.0006 | 0.0007 | the lunar latitude series moved by up to its own 0.2″ budget, worth 0.0001 of magnitude |
| lunar sutak symmetry about peak | 1 s | 30 s | a result-shape change, not a numeric one — the contacts are now solved separately instead of being symmetric by construction |

`BASELINE_MAX_ARCSEC` in `tier0-horizons.test.ts` — the one bound the protocol
says may only ever be **tightened** — was not touched.

**Accuracy bounds that *tightened*, which the first pass could not report.**
Raising the generator's probe count from 600 to 100,000 made every series meet
its budget over the sample that verifies it, and giving the planet path its own
Earth series removed a coupling the per-body budget hid:

| body vs DE441 | first pass | now | ceiling | margin |
|---|---|---|---|---|
| Sun | 0.4196″ | **0.3233″** | 1.613″ | 5.0× |
| Moon | 1.3448″ | **1.2610″** | 3.747″ | 2.97× |
| Mercury | 0.499″ | **0.2956″** | 6.504″ | 22× |
| Venus | 1.217″ | **0.8620″** | 19.586″ | 23× |
| Mars | 1.607″ | **1.2933″** | 11.103″ | 8.6× |
| Jupiter | 0.889″ | **0.8351″** | 9.662″ | 11.6× |
| Saturn | 0.876″ | **0.8615″** | 11.147″ | 12.9× |

**Test suite: 8,368 across 121 files, all green** over five consecutive runs.
Typecheck (both configs), lint, build and the Hermes syntax check are clean.
Bundle 584.1 KB CJS.

---

## Step 1 — Phase 36.1, structural performance wins

No new astronomy. Five of the six items are output-neutral by construction; the
two that are not are analysed under their own headings below.

### Measurement method

`notes/bench.src.ts` + `driver.mjs`: **one configuration per process**,
median of 5 processes. Process isolation is required because the sunrise
`EVENT_CACHE` and (after 36.1a) the Chebyshev block store are module-level, so
"cold" cannot be measured inside a process that has already computed the days
being measured.

- **cold** = 1200 consecutive days from 2024-01-01, each computed exactly once,
  after a JIT warm-up on a disjoint 250-day stretch from 1980.
- **warm** = the same day repeated 2000×, after 500 warm-up calls.
- Location Pune (18.5204 N, 73.8567 E), `timezone: 330`, Node 24, Apple
  M-series. Observed spread across processes: 1–12%.

These absolute numbers are *not* comparable to the ones quoted in
`notes/v5-audit.md`, which were taken with a different day range and without
process isolation. Only the before/after columns here are comparable to each
other.

### 36.1 (a) — share Chebyshev blocks across calls

Hoisted `moonBlocks` / `sunBlocks` from `LongitudeCache` instance state to a
module-level store with a 1024-entry cap and clear-on-overflow, matching
`EVENT_CACHE` in `sunrise.ts`.

**Output-neutral by construction.** A block is `ChebyshevLongitude` fitted over
`[i·SPAN, (i+1)·SPAN]` — a pure function of the block index `i` and nothing
else. Its nodes hold *tropical* longitudes (the ayanamsa is applied per read),
so a block is also independent of the ayanamsa system. Sharing changes which
call *builds* a block, never its contents.

| invariant tests changed | numeric fixtures re-pinned | suite |
|---|---|---|
| 0 | 0 | 8,233 passed, unchanged |

### 36.1 (f) — search-layer cleanups

1. **Hoisted the loop-invariant `getIndexAtTime(nextSunriseUtc)`** out of
   `findDailyElements`'s loop (`src/utils/search.ts`). `getIndexAtTime` is a
   pure function reading through the call's longitude memo, so this is
   output-neutral by construction; it saves one evaluation per element per day.

2. **Bracket-probe reuse in `findTransitionTime` — investigated, no change
   made.** The up-front probe evaluates `getIndexAtTime(hi)` (the *discrete
   index*), while `secantBoundary` evaluates `angle.angleAt(hi)` (the
   *continuous angle*). They are different functions, so the probe's result
   cannot be substituted for the secant's first residual. The underlying
   ephemeris cost is already shared: both read through the same
   `LongitudeCache`, so the second evaluation at `hi` is a memo hit in `'exact'`
   mode and a polynomial evaluation in `'interpolated'` mode. Nothing to
   reclaim; recorded so the question is not re-opened.

| invariant tests changed | numeric fixtures re-pinned | suite |
|---|---|---|
| 0 | 0 | 8,233 passed, unchanged |

### 36.1 (e) — route the eclipse syzygy guard through the call's cache

`eclipse.ts` called `getTropicalMoonLongitude` / `getTropicalSunLongitude`
directly, so the guard's four evaluations were full ELP/VSOP87 runs even though
the surrounding call had already built an interpolant covering those instants.
`getEclipseDuringDay` now takes an optional `SyzygyLongitudes` pair, and
`getDailyPanchang` passes `cache.getTropicalMoon` / `cache.getTropicalSun`. The
guard itself is unchanged.

**Output-neutrality.** The guard is a *boolean*. In `'exact'` mode the new
tropical accessors are bit-identical to the free functions (they memoize the
same call, in their own maps — deliberately not derived by re-adding the
ayanamsa, since normalizing twice around the 360° seam is not the identity in
floating point). In `'interpolated'` mode they answer from the polynomial,
whose error is ≤2.0e-7° of elongation against a guard margin of 6.1°; a boolean
flip needs the elongation to sit within 2.0e-7° of the syzygy threshold, i.e.
~3e-8 per boundary. When the boolean is unchanged the eclipse search itself is
untouched, so no eclipse timing moves.

| invariant tests changed | numeric fixtures re-pinned | suite |
|---|---|---|
| 0 | 0 | 8,233 passed, unchanged |

### 36.1 (d) — cache-mode heuristic

**The defect.** `panchang.ts` chose `doEndTimes ? 'interpolated' : 'exact'`.
That is right for a narrowed call and wrong for a full one: with every section
on, the festival block alone makes enough longitude reads to pay for building
the blocks, so asking for *less* output cost *more*. Measured on this machine,
before any change:

| call (pre-Phase-36 tree — *not* published 4.3.1) | cold (ms) | warm (ms) |
|---|---|---|
| default (all sections, end-times) | 0.9345 | 0.6291 |
| all sections, `computeEndTimes: false` | **1.1876** (+27%) | **0.7453** (+18%) |

**Why the obvious fix is rejected.** PLAN.md §36.1 suggests
`doEndTimes || wantFestivals`. That makes the mode — and therefore the published
numbers — a function of `options.sections`, which breaks the property
`tests/unit/sections.test.ts` exists to guard: *narrowing skips work, it never
changes output*. It would hold for `computeEndTimes: true` (both sides pick
`'interpolated'`) and silently fail for `computeEndTimes: false`, where
`sections: ['festivals']` would interpolate and `sections: []` would not. A
neutrality hole that the current test matrix happens not to cover is still a
neutrality hole.

**What was done instead: `getDailyPanchang` and `getInstantPanchang` always
interpolate.** The mode then depends on *nothing* — not on `sections`, not on
`computeEndTimes` — so narrowing is neutral by construction under every
combination rather than under the tested ones. It also removes a
pre-existing discrepancy: today the same day computed with and without
end-times publishes different `siderealMoonAtSunrise`. `'exact'` mode stays as
the class default for direct users of `LongitudeCache`, where instants are
arbitrary and non-repeating.

The cost is bounded and one-sided: a process that computes a *single* day and
exits pays up to 10 `GeoMoon` + 8 `SunPosition` (~0.115 ms) to build blocks it
will not reuse, against ~0.017 ms of direct reads. Any consumer computing more
than a few days is ahead. Recorded rather than hidden.

#### Predicted delta — written before the change was run

Calls with `computeEndTimes: false` move from exact evaluation to the
interpolant. `cache.ts` documents the fit error as the time error it implies at
each body's mean rate: Moon 1.3 ms over a 4-day block, Sun 0.9 ms over an 8-day
block. Converting to angle at the mean rates already used in this repo:

- Moon 0.549°/hr = 1.525e-4 °/s → 1.3e-3 s × 1.525e-4 = **≤2.0e-7 °**
- Sun 0.041°/hr = 1.139e-5 °/s → 0.9e-3 s × 1.139e-5 = **≤1.0e-8 °**

Therefore, for `computeEndTimes: false` calls only:

| # | prediction |
|---|---|
| P1 | `siderealMoonAtSunrise` moves ≤2.0e-7°; `siderealSunAtSunrise` ≤1.0e-8° |
| P2 | **No** index, name, boolean or festival date changes. A tithi index flips only if the sunrise longitude sits within 2.0e-7° of a 12° boundary — ~1.7e-8 per day |
| P3 | Windows solved by search inside such a call (bhadra, varjyam, panchakaRahita) move ≤26 ms — the end-to-end figure `cache.ts` already records for this interpolant |
| P4 | **No** tithi / nakshatra / yoga / karana end time moves at all: such a call publishes none |
| P5 | `computeEndTimes: true` calls are bit-identical — they already interpolated |

#### Observed

Method: `notes/dump.src.ts` emits the full result object for **6 locations
× 320 days × 5 option shapes** (11,520 daily results), plus `getInstantPanchang`
on every day and a full year of `getFestivalsInRange` /
`getEkadashiDatesForYear` / `getSankrantisForYear` per location. Day spans are
deliberately not all near the present: 2025 (200 days), 1912 (60), 2088 (60).
The tree was built twice — once with the one-line mode selection reverted, once
with it applied — and the two 149 MB dumps diffed structurally
(`notes/diff.mjs`), with non-numeric leaves, array lengths and key ordering
classified as invariants at zero tolerance.

| # | predicted | observed | matches? |
|---|---|---|---|
| P1 | Moon ≤2.0e-7° | **1.750e-7°** (worst: London 1912-07-16) | **yes** |
| P1 | Sun ≤1.0e-8° | **1.054e-8°** (worst: Reykjavík 2088-10-24) | **yes** — the bound was computed from `0.9 ms`, quoted to one significant figure; recomputing at the Sun's exact mean motion (1.14079e-5 °/s) gives 1.027e-8°, a 2.6% agreement |
| P2 | zero index / name / boolean / festival-date changes | **0 invariant or structural changes** across all 149 MB | **yes** |
| P3 | search-derived windows move ≤26 ms | **0 ms** — no `Date` leaf moved anywhere | **yes** (bound not approached) |
| P4 | no element end time moves | **0** | **yes** |
| P5 | `computeEndTimes: true` bit-identical | `full` 1920/1920, `bare` 1920/1920, `instant` 1920/1920 identical; only the three `-noend` shapes changed | **yes** |

Two rounded *display* fields tipped a rounding boundary, which is the expected
consequence of a 1.75e-7° longitude change and is bounded by the field's own
quantum:

| field | changed values | max Δ | quantum |
|---|---|---|---|
| `karanas[].completionPercentage` | 6 of ~23,000 | 0.01 | 0.01 (2 dp) |
| `nakshatras[].degreesInNakshatra` | 3 of ~23,000 | 1e-4 | 1e-4 (4 dp) |

`getFestivalsInRange` internally uses `computeEndTimes: false`, so its calls did
change mode — and its emitted output is **identical for all six locations across
a full year**, which is the invariant that mattered most here.

| invariant tests changed | numeric fixtures re-pinned | suite |
|---|---|---|
| 0 | 0 | 8,233 passed, unchanged |

### 36.1 (c) — canonical lunar event cache

`sunrise.ts`'s per-UTC-day event cache was extracted to
`src/astronomy/riseSetCache.ts` and parameterized by body, and `moonrise.ts` now
uses it. The solar parameters are unchanged (`searchLimitDays: 2`, second-event
window 45 min); the lunar ones are `searchLimitDays: 1` (this call only ever
enumerates events *inside* one UTC day) and a 3 h second-event window.

**Why the lunar window is wider.** Consecutive moonrises are one *lunar* day
apart, nominally 24 h 50 m, so a UTC day normally holds at most one. The daily
retardation ranges from ~10 min to ~80 min at mid latitudes and can go slightly
negative at high ones, which is the only way two same-kind events land in one
UTC day. 3 h covers a retardation as negative as −3 h — far beyond anything
observed — at the cost of a second probe on the ~12% of days whose event falls
in the first three hours.

This is the one item in 36.1 that is **not** output-neutral, for exactly the
reason `sunrise.ts` already documents for the solar case: it removes an existing
inconsistency (the same event having different timestamps for different callers)
rather than introducing an approximation, but the value it settles on is not the
value every caller previously got.

#### Predicted delta — written before the change was run

| # | prediction |
|---|---|
| P6 | **Sunrise and sunset are bit-identical.** The extraction issues the same `SearchRiseSet` calls with the same arguments in the same order; only the cache key gained a body component |
| P7 | `moonrise` / `moonset` move by ≤ the lunar search-start jitter. `SearchRiseSet` refines with `dt_tolerance_seconds: 0.1`, so different search starts land at different points inside a 100 ms tolerance; the solar case measured ≤109 ms, and the Moon crosses the horizon slightly *slower* than the Sun (its own ~0.5°/hr motion subtracts from the ~15°/hr diurnal rate), so its jitter can be marginally larger. Predict **≤150 ms** |
| P8 | **No festival date changes.** The only rule-level consumers of moonrise are the Karva Chauth / Sankashti chandrodaya anchors, which test moonrise against a Hindu-day window hours wide |
| P9 | **No other published field changes.** Moonrise/moonset feed only the `'moonTimes'` section and those two festival anchors — nothing derives a proportional window from them |
| P10 | The cached resolver returns the **same event** an uncached `SearchRiseSet` would, to within P7, on every day and latitude — i.e. the 3 h window never drops a second event |

#### Observed

**P10 first**, because nothing else is worth reading if the cache picks the
wrong event. `notes/lunarcheck.src.ts` compares `getMoonrise` /
`getMoonset` against a direct uncached `SearchRiseSet` from the *same* instant,
over **12 locations × 1,600 days × 4 search starts per day × both directions =
153,600 comparisons**. Locations deliberately include Longyearbyen (78.2 °N),
Tromsø (69.6 °N), McMurdo (77.8 °S) and Ushuaia (54.8 °S), where the daily
retardation misbehaves; day spans are 1950, 2024 and 2090.

```
compared=153600  nullMismatch=0  differentEvent=0
max jitter (same event) = 198 ms   worst: Pune 1950-07-30 (moonset)
```

Then the output diff, same method as 36.1 (d) — 149 MB of results, before vs
after, structurally classified:

| # | predicted | observed | matches? |
|---|---|---|---|
| P6 | sunrise/sunset bit-identical | **no `sunrise`, `sunset` or derived window leaf appears in the diff at all** | **yes** |
| P7 | moonrise/moonset shift ≤150 ms | **moonrise 182 ms, moonset 180 ms** (worst: Pune 2025-07-03 / 2025-07-17) | **no — the bound was too tight; the mechanism was right** (see below) |
| P8 | no festival date changes | **0 invariant or structural changes** | **yes** |
| P9 | no other published field changes | **0 numeric leaf deltas; exactly two Date leaves moved, `moonrise` and `moonset`** | **yes** |
| P10 | cache never drops an event | 0 null mismatches, 0 different-event picks in 153,600 comparisons | **yes** |

**P7 is a prediction miss, and the correction is arithmetic rather than
physical.** I derived the bound from `dt_tolerance_seconds: 0.1` as a *one-sided*
100 ms and then added a margin for the Moon's slower horizon crossing, giving
150 ms. That reading is wrong: `Search` (`astronomy.js:4083`) returns as soon as
its *step* falls below `dt_days`, so a returned root sits within ~0.1 s of the
true root **on either side**, and two searches started at different instants can
therefore differ by up to **2 × 0.1 s = 200 ms**. The observed 198 ms
(free-standing check) and 182 ms (in-library) sit just under that corrected
bound, and the solar figure of 109 ms that misled me was an observed maximum,
never a bound.

So: the mechanism was predicted correctly and no unexplained movement occurred —
but the number I wrote down beforehand was too small, and that is recorded here
rather than quietly widened.

| invariant tests changed | numeric fixtures re-pinned | suite |
|---|---|---|
| 0 | 0 | 8,233 passed, unchanged |

#### A cost this item introduced, found by measuring rather than by testing

The first version of the lunar cache made `getMoonrise` / `getMoonset` **28%
slower** on a distinct-day scan (0.082 → 0.105 ms). The suite was green
throughout; only the benchmark caught it.

Cause: the probe for a possible *second* same-kind event in the day started 1 s
after the first event — the worst possible instant. The Moon has just risen, so
`SearchRiseSet` has to climb an entire altitude hill before it can bracket
anything, and `FindAscent` bisects that hill hunting for a hidden dip. Measured
directly at Pune, that probe cost **0.16 ms, twice a complete search**, fired on
16% of days, and across 40,243 lunar events found a second event **three times**.

Fix: derive both the probe *window* and the probe *start* from one measured
physical quantity, `minSeparationMs`. Nothing can lie within the minimum
separation of the first event, so the probe starts there instead — leaving a
search window at most 4 h wide with the Moon already below the horizon, which
the scan settles in a single step. Bounding the probe's `limitDays` to the
remainder of the day, tried first, did **not** help (0.1005 vs 0.1011 ms): the
cost was the hill traverse, not the scan length.

Result: 0.105 → 0.092 ms. The probe change is a pure cost optimization — the
before/after output diff is byte-for-byte identical to the one taken before it,
confirming it finds the same events.

### 36.1 (b) — interpolated lunar rise/set: **DEFERRED to 36.3, not done**

This is the one item of the six that is not implemented, and the reason is a
direct conflict between two instructions in the brief that I resolved in favour
of the ordering rule.

**What it would require.** `SearchRiseSet` does not accept an injected
ephemeris, so "solve against the polynomial" means writing our own rise/set
solver: duplicating `HorizonDipAngle`, `BodyRadiusAu`, `REFRACTION_NEAR_HORIZON`
and `MaxAltitudeSlope` (all un-exported), then re-implementing the ascent scan
and the root solve. That is not "no new theory" — it is 36.3's rise/set port
arriving early, with a horizon convention transcribed by hand.

**Why deferring is the right call.** PLAN.md §36.0 H makes the sequence
non-negotiable — correct, then frozen, then fast — and STEP 4 must be complete
before any new ephemeris code exists. Item (b) is new ephemeris code. Writing
the *optimized* implementation first, with nothing but our own current output to
check it against, is precisely the failure mode §36.0 H exists to prevent.

**What it is worth, so the deferral is informed rather than convenient.** Of a
0.789 ms cold default call, rise/set is now ~0.28 ms (36%): sunrise 0.062,
sunset 0.038, moonrise 0.092, moonset 0.091. Item (b) targets ~10× on the lunar
half, so roughly **−0.16 ms, or −21% on a cold default call**, and more on the
range helpers. That is a real win and it should be taken — in 36.3, where the
Horizons harness can adjudicate the result.

**What is already in place for it.** `riseSetCache.ts` is the seam: both bodies
now resolve through one canonical, per-UTC-day entry point, so an interpolated
solver drops in underneath without touching any caller.
`notes/lunarcheck.src.ts` is the differential test it will need — 153,600
comparisons against uncached `SearchRiseSet` across 12 locations from Quito to
Alert (82.5 °N), already exercising the null and second-event edges.

### Step 1 — measured result

Median of 7 processes per configuration. Every number is ms/call.

**"Baseline" here is the tree Phase 36 started from — git HEAD, not published
4.3.1.** The two are different software and differ by 6× on a default call; the
distinction is drawn in full in *Step 5, third pass*. This table is unaffected,
because both of its columns are that same tree before and after one change,
which is what a before/after is for. Six of its rows were independently
re-measured on a HEAD build two months later and reproduce within 1–4%
(`computeSunrise` 0.0622, `getMoonrise` 0.0820 → 0.0807, `computeShadbala`
0.1121 → 0.1166, ekadashi 31.89 → 32.45, sankranti 3.461 → 3.489), which is what
identified the column in the first place.

| configuration | baseline (pre-36 tree) | after 36.1 | change |
|---|---|---|---|
| **cold, distinct days** | | | |
| default (all sections + end-times) | 0.9345 | **0.7885** | −15.6% |
| without `'festivals'` | 0.8829 | **0.7448** | −15.6% |
| `sections: ['festivals','eclipse']` | 0.8733 | **0.6635** | −24.0% |
| `sections: []` | 0.4227 | **0.2847** | −32.6% |
| `sections: []` + no end-times | 0.2623 | 0.2764 | **+5.4%** |
| all sections + `computeEndTimes: false` | 1.1876 | **0.7983** | −32.8% |
| `getInstantPanchang` | 0.3185 | **0.2342** | −26.5% |
| **warm, same day repeated** | | | |
| default | 0.6291 | **0.1757** | −72.1% |
| `computeEndTimes: false` | 0.7453 | **0.1626** | −78.2% |
| `sections: []` + no end-times | 0.1609 | **0.1502** | −6.7% |
| `getInstantPanchang` | 0.2447 | **0.1415** | −42.2% |
| **range helpers, ms/year** | | | |
| `getFestivalsInRange` | 336.11 | **233.36** | −30.6% |
| `getEkadashiDatesForYear` | 31.89 | 32.67 | +2.4% |
| `getSankrantisForYear` | 3.461 | 3.502 | +1.2% |
| **birth chart** | | | |
| `computeShadbala` | 0.1121 | 0.1114 | −0.6% |
| `computeBhavaBala` | 0.1197 | 0.1190 | −0.5% |
| **primitives, cold** | | | |
| `computeSunrise` | 0.0622 | 0.0621 | −0.1% |
| `computeSunset` | 0.0377 | 0.0379 | +0.3% |
| `getMoonrise` | 0.0820 | 0.0919 | **+12.0%** |
| `getMoonset` | 0.0790 | 0.0911 | **+15.3%** |

**The anomaly the phase was called on is gone.** `computeEndTimes: false` with
all sections cost **+27% more** than a full call cold and **+18%** warm; it now
costs 1% *more* cold (statistically indistinguishable — 9 repetitions gave
medians 0.7868 vs 0.7813) and 7% *less* warm. Asking for less no longer costs
more.

#### The three regressions, stated rather than buried

1. **`sections: [] + computeEndTimes: false`, cold: +5.4%.** This is the priced
   consequence of INTERPOLATE_ALWAYS. That shape reads ~1 Moon and ~3 Sun
   longitudes, so building blocks is a net loss for it. It is the only shape
   where interpolation does not pay, and it pays back the moment a second day is
   computed in the same process. Taken deliberately, in exchange for output that
   no longer depends on which options were passed.
2. **`getMoonrise` +12%, `getMoonset` +15%, cold and standalone.** The price of
   canonicalization: a day with no lunar event costs a wasted search before the
   walk moves to the next day (~3.4% of days at Pune), and the probe window
   costs a cheap extra search on ~17%. Note the direction of the trade — the
   same change takes a *warm* default panchang from 0.63 to 0.18 ms.
3. **`getEkadashiDatesForYear` +2.4%, `getSankrantisForYear` +1.2%.** Both are
   pure sunrise/sunset consumers that touch none of the changed paths except the
   extraction of the event cache into `riseSetCache.ts`, which added a body
   component to the cache key. Small enough to be partly measurement spread
   (observed process-to-process spread is 2–4%), but reported at face value
   rather than explained away.

#### The pre-existing perf flake

`tests/perf/perf.test.ts` → *"dropping the festivals section alone is measurably
cheaper"* asserts a ratio < 0.95 and was reported to measure 0.96–0.97 in
roughly 1 run in 6. Measured in isolation, 12 repetitions of the test's own
`ratioOf` estimator:

| | worst of 12 | median |
|---|---|---|
| baseline | 0.8981 | 0.8637 |
| after 36.1 | **0.8240** | **0.6663** |

The headroom against the 0.95 bound roughly quadrupled at the median. **The
threshold was not touched.**

One correction to the brief's expectation: it predicted item (d) would fix the
underlying cause. It did not, and could not — that test passes
`computeEndTimes: true` on *both* sides of the ratio, so both sides already
selected `'interpolated'` before the change. What actually moved the ratio is
items (a), (c) and (e), which remove a *fixed* cost shared by numerator and
denominator (block building, lunar searches, the eclipse guard's four full
theory runs); subtracting the same absolute amount from both sides of a ratio
below 1 pushes it further below 1. The flake itself is a contention artifact of
parallel Vitest workers and was not reproducible in isolation either before or
after.

**It remains the narrowest margin in the file — FLAGGED, threshold untouched.**
0.83 typical, 0.92 worst observed, against 0.95. It is the only ratio in the
suite for which the *repeated-day* measurement is the more sensitive one (see
below), so it was left on that workload deliberately rather than moved with the
others.

---

## Step 1 — the three performance tests whose *measurement* broke

**This section documents test changes. Read it sceptically — it is the shape of
the forbidden move (changing a test so a change passes), and the only thing that
distinguishes it is the evidence below, which was gathered before anything was
edited.**

Three ratio assertions failed or became marginal after 36.1. None of them is a
correctness fixture: all three are timing ratios of the form *asking for less
must cost less*, and all three broke for one shared reason.

### The evidence, gathered first

Module-level caches (36.1 a and c) mean the *second* call for the same day finds
almost every ephemeris result already computed. These tests all measured one day
repeated, so their denominators collapsed while their numerators — which had
less cacheable ephemeris work to begin with — barely moved:

| measured on one repeated day | before 36.1 | after 36.1 |
|---|---|---|
| full run (all sections, end-times) | 0.629 ms | **0.176 ms** (3.6× faster) |
| full run, `computeEndTimes: false` | 0.745 ms | **0.163 ms** (4.6× faster) |
| `sections: []`, no end-times | 0.161 ms | 0.150 ms (1.07× faster) |
| `getInstantPanchang` | 0.245 ms | 0.142 ms (1.7× faster) |

Nothing became slower. Every configuration improved. The ratios rose purely
because what they divide by shrank faster than what they divide.

The same ratios over **distinct days** — a calendar scan, which is the workload
`sections` and `computeEndTimes` exist for:

| ratio | one repeated day | distinct days | threshold |
|---|---|---|---|
| `sections:[]`+no-end ÷ full, both no-end | 0.93 | **0.31** | 0.75 (was failing) |
| `sections:[]`+no-end ÷ full run | 0.57 | **0.25** | 0.50 (marginal) |
| `getInstantPanchang` ÷ full run | 0.79 | **0.19** | 0.75 (was failing) |

So narrowing still removes 69–81% of the work. The property the tests assert is
intact and, in the workload that matters, stronger than before.

### What was changed

| test | change | threshold |
|---|---|---|
| `sections.test.ts` → *is materially cheaper when sections are dropped* | measured over distinct days; renamed to say so | **tightened 0.75 → 0.50** |
| `sections.test.ts` → *never costs more to ask for less, even on a fully cached day* | **new test**, keeps the repeated-day case under guard | `< 1.0` |
| `perf.test.ts` → *sections: [] + no end-times is well under half a full run* | measured over distinct days | **unchanged, 0.50** |
| `perf.test.ts` → *instant mode stays far cheaper* | measured over distinct days | **unchanged, 0.75** |
| `perf.test.ts` → *dropping the festivals section alone* | **not touched** | **unchanged, 0.95** |
| `perf.test.ts` → *eclipse check is negligible* | **not touched** | unchanged, 0.25 |

No threshold was loosened. One was tightened. One test was added. The
repeated-day workload is still asserted, at the only bound that is still
meaningful there (narrowing must never cost *more*).

Verified stable across 5 consecutive full-suite runs.

**Reviewer note.** This is the one place in Step 1 where I edited tests rather
than code. If you disagree with the reasoning, the alternative is to revert
these three edits and treat 36.1 as blocked on them — the measurements above are
what I would want to argue from, and they are reproducible via
`notes/narrow.src.ts` and `notes/coldratios.src.ts`.

---

## Step 2 — Phase 37, unified table/compute API

No astronomy changed in this step, so there is nothing to validate against
Tier 0. What is at risk instead is *equality between two ways of asking the same
question*, and that is what the new tests pin.

### 37.1 — one naming convention

`read*` reads a table; `compute*` runs the engine. Applied across festivals,
eclipses, moon phases and muhurta, plus the two year helpers (`Ekadashi`,
`Sankranti`) that would otherwise have been left half-converted.

**Every 4.x name is kept as a deprecated alias bound to the same function
object**, which is asserted directly (`expect(getFestivalsInRange).toBe(
computeFestivalsInRange)`) rather than by behavioural comparison — an alias that
is the same reference cannot drift.

### 37.2 — `compute*ForYear` for all four families

Thin wrappers over the range enumerators, each pinned against the enumerator it
wraps over a full local year. The moon-phase test also carries a closure
identity (§36.0 G): a year holds 48–50 principal phases, since a synodic month
is 29.53 days and each carries four.

### 37.3 — `buildMuhurtaTable` + `panchang-ts/muhurta`

The missing family member. One table covers one occasion; only passing days are
stored unless `includeFailures` is set. The reader entry point builds to
**1.70 KB ESM** with no astronomy code in it. The table is pinned to agree with
the engine day-for-day and score-for-score over a full year.

### 37.4 — dictionary-encoded emission, with `key`

| table | entries | dictionary | v1 size | v5 size | ratio | target |
|---|---|---|---|---|---|---|
| festivals, 2024–2033 | 2,628 | 191 | 315.0 KB | **89.9 KB** | **28.5%** | ≤30% ✅ |
| moon phases, 2024–2033 | 495 | 4 | 106.1 KB | **29.7 KB** | **28.0%** | ≤30% ✅ |
| muhurta (vivah), 2026–2028 | 505 days | 39 factors | — (new) | 14.8 KB | — | — |

The v1 file is reconstructed by inlining the dictionary — the exact inverse of
the packing — so the comparison is like for like rather than against a
remembered number.

**Resolved output is identical: 40 comparisons (10 years × 2 tables × 2
locales), 0 mismatches.** Every festival entry now carries the engine's stable
`key`; 0 entries missing one.

Moon phases needed one extra step to clear the target: with only four dictionary
entries, the timestamp *is* the table. Storing the instant as epoch milliseconds
(`1704974240000`, 13 characters) instead of an ISO string
(`"2024-01-11T11:57:20.000Z"`, 26) took it from 33.9% to 28.0%. The conversion
is exact both ways, so the resolved `time` string is unchanged — which the
round-trip test asserts.

**v1 tables still read.** Consumers cache these files, so a v5 upgrade that
silently misread one would be worse than a loud failure. The reader detects the
format; only `key` is unavailable from a v1 table and comes back as `''` rather
than invented.

### Exit criteria

| criterion | status |
|---|---|
| one naming convention, old names deprecated not removed | ✅ asserted by reference identity |
| `compute*ForYear` for all four families | ✅ each pinned against its range enumerator |
| `panchang-ts/muhurta` subpath + `buildMuhurtaTable` | ✅ 1.70 KB ESM, engine-free |
| emitted tables carry `key`; ≤30% of v1 with identical resolved output | ✅ 28.5% / 28.0%, 0 mismatches |
| the `*:gen` scripts still produce a readable table end to end | ✅ all four run and read back, including the new `muhurta:gen` |

| invariant tests changed | numeric fixtures re-pinned | suite |
|---|---|---|
| 0 | 0 | 8,259 passed (8,233 baseline + 25 Phase 37 + 1 new perf test) |

---

## Step 3 — Phase 38, result-shape corrections

**Partially complete. 38.2, 38.3, 38.5 and 38.6 are done; 38.1, 38.4 and 38.7
are not started.** The split and the reasons are below — this is the honest
state, not a rounding-up.

Nothing in this step touches astronomy, so there is nothing to validate against
Tier 0. What moved is *representation*, and the rule for that is the one the
brief sets for 38.1: fixture churn is **mechanical, not a re-pin** — the value
being asserted is unchanged, only where it lives.

### 38.2 — `_debug` deleted ✅

Declared on `DailyPanchangResult`, written nowhere in `src/`. Removed. Pinned by
a test that the key is *absent* rather than merely `undefined`, and that it does
not reappear through `JSON.stringify`.

### 38.3 — `suryaNakshatra` correctly typed ✅

`computeSuryaNakshatra` returns `nakshatraOf(siderealSun)` — 0..26 — and was
typed `RashiInfo`, whose `index` is documented *"0 = Mesha … 11 = Meena"*. New
`NakshatraIndexInfo` type; **the runtime value is unchanged**, so no fixture
moved.

Pinned by sweeping a year and asserting the observed index set is exactly the 27
nakshatras with a maximum above 11 — which is the symptom a rashi-typed value
could never produce, so the test fails if the type is ever reverted *and* the
value follows.

### 38.5 — aliases and naming drift ✅ (documented, not removed)

`dinamanaMinutes` / `dayDurationMinutes` and `ratrimanaMinutes` /
`nightDurationMinutes` are kept. Removing either pair breaks consumers for no
functional gain; the types now state plainly that they are aliases, never
independently computed, and a test pins them equal across four timezones.

`chandramasa` keeps its casing beside `chandraRashi` / `suryaNakshatra` — the
same reasoning. What was actually missing is now supplied: the type says `masa`
is the **solar** month and `chandramasa` the **lunar** one, which a reader
previously had to guess.

A closure identity came free with this: day + night durations sum to the Hindu
day, to within the 1-minute independent-rounding gap.

### 38.6 — resolved timezone echoed ✅

`timezone: number` → `timezone: { offsetMinutes: number; zone?: string }`.
`zone` is present only when the caller passed an IANA name, because a numeric
offset has no zone to report. The `resolveUtcOffset`-resolves-once DST limit is
now documented on the type and in the README instead of the previous blanket
"DST resolves automatically".

**Fixture churn: 20 assertions, all mechanical.** Every one was
`expect(result.timezone).toBe(-240)` becoming
`expect(result.timezone.offsetMinutes).toBe(-240)`. The asserted number is
identical in all 20; only its path changed. No tolerance was involved and no
value was regenerated from the new code.

Pinned by tests that an IANA zone and its equivalent numeric offset produce
identical sunrise and identical element indices, and that DST is resolved from
the *requested day* rather than from "now".

### 38.1 — real `Date` instants + `*Local` ISO + `formatInZone` ✅

**The flagship change.** Every published `Date` is now the true instant, and
every one has an offset-carrying ISO 8601 companion. `formatInZone(date,
offsetMinutes)` is exported for instants a caller derives.

Covered: `sunrise` / `sunset` / `nextSunrise` / `moonrise` / `moonset`, every
`TimePeriod`, all four slot systems (Choghadiya, Hora, Gowri, Do-Ghati), the
element `startTime` / `endTime` arrays, Bhadra, and the eclipse contacts and
sutak window. `getInstantPanchang` deliberately carries **no** `*Local` fields —
it takes no timezone, so there is no zone to render into and inventing one would
be a lie.

**A type-level split fell out of it.** The core computation modules (muhurtas,
inauspicious periods, slot builders) have no timezone and no business acquiring
one, so they now return `UtcWindow` / `Unlocalized<T>` — instants only — and
`getDailyPanchang` renders the strings once, at the publishing boundary, where
the resolved offset actually lives. The compiler now enforces that split instead
of every producer having to remember it.

**`formatInZone` is hand-rolled, not `Intl`.** A full daily panchang publishes
~230 instants, ~172 of them inside the slot systems. `Intl.DateTimeFormat` costs
~1–2 µs per format even with a cached formatter, which would have put 0.2–0.4 ms
on a 0.79 ms call. Shifting the epoch and reading UTC accessors is ~0.2 µs and
needs no locale data — which also matters on Hermes, where `Intl` is often
absent or ICU-less.

#### The regression net

The audit's own repro is now a permanent test: **each published instant is
asserted against the primitive that produced it** (`result.sunrise` vs
`computeSunrise(...)`, across three timezones). That check cannot drift with the
rest of the library, because both sides would have to break the same way. Plus:
`JSON.stringify` round-trips to the correct instant; `Intl` with a `timeZone`
renders the same wall clock as `sunriseLocal`; every `*Local` string parses back
to exactly its instant via `Date.parse`; `formatInZone` round-trips at six
offsets including half-hour ones.

#### Fixture churn — mechanical, not a re-pin

**456 assertions moved, and not one asserted value changed.** Every failure was
a helper reading a wall clock out of a *shifted* `Date` via `getUTC*`; each was
migrated to read the offset-carrying `*Local` string instead — precisely the
migration a consumer performs. The Drik-published expectations they compare
against are untouched, and the tolerances (tithi ±76 s, nakshatra ±54 s, yoga
±90 s, karana ±81 s, sunrise/sunset ±45 s) are untouched. Drik parity is
therefore unchanged, which is the point: the *instants* did not move, only their
representation.

One site was genuinely improved rather than merely migrated:
`phase28-cross-verify` averages `madhyahna.start` and `madhyahna.end`. Under 4.x
both were shifted, so the midpoint was too; it is now real arithmetic on real
instants, rendered with `formatInZone`.

#### Cost

| | before 38.1 | after | |
|---|---|---|---|
| cold default | 0.7885 ms | 0.7924 ms | +0.5% |
| cold `sections: []` | 0.2847 | 0.3206 | +12.6% |
| warm default | 0.1757 | 0.2148 | +22% |
| `getFestivalsInRange`/yr | 233.4 | 248.2 | +6.3% |

~0.04 ms per call for the strings: invisible against a cold call's ephemeris
work, ~20% of a fully cached warm one. Against the **pre-Phase-36 tree** the
default call is still **−15.2% cold** (0.9345 → 0.7924) and **−66% warm**
(0.6291 → 0.2148). *(Both of those were written as "the v4.3.1 baseline"; they
are not — see* Step 5, third pass *. Against published 4.3.1 the same two
comparisons are −87% and −97%.)*

### 38.4 — one optional-vs-null rule ✅

Three conventions coexisted and consumers could not predict which they would
get: `| null` (`bhadra`, `varjyam`, `eclipse`), `?`-optional (`chandraBalam`,
`tarabala`), and empty array (`panchakaRahita`, `festivals`).

PLAN.md offered a conditional return type keyed on the options object as the
"modern TS answer", with "make everything `| null` and always present" as the
fallback. **The fallback was taken, deliberately.** A conditional return type
means `DailyPanchangResult` stops being a nameable type and becomes
`DailyPanchangResult<O>`: every consumer annotation, every internal signature
and every test fixture acquires a type parameter, and `getInstantPanchang` needs
the same treatment — a permanent ergonomic tax across the whole public surface
to save two `!`s. PLAN.md's own tiebreaker settles it: *predictable beats
clever*.

The rule, stated once in the type and once in the README:

> Every field is always present. A scalar or object that does not apply is
> `null`; a collection that does not apply is `[]`.

Only `chandraBalam` and `tarabala` actually moved — everything else already
complied. The `...(x !== undefined ? { x } : {})` spreads in `panchang.ts` go
with them. The rule also covers `options.sections` narrowing, which nulls and
empties fields rather than removing them, so the result *shape* is now
independent of the options in both directions.

### 38.7 — the result object is grouped ✅

~50 flat top-level fields → seven groups plus ten top-level fields. Group names
were mine to pick; the reviewer's own examples (`result.muhurtas.abhijit`,
`result.inauspicious.rahuKalam`) fixed two of them and the rest follow suit.

| group | holds |
|---|---|
| `sun` | `rise` / `set` / `nextRise` (+ `*Local`), day and night lengths and their classical aliases, `siderealLongitude`, `nakshatra` |
| `moon` | `rise` / `set` (+ `*Local`), `siderealLongitude`, `rashi` |
| `angas` | `tithis`, `nakshatras`, `yogas`, `karanas`, `vara` |
| `calendar` | `masa`, `chandramasa`, `samvat` |
| `muhurtas` | `abhijit`, `brahma`, `vijaya`, `godhuli`, `nishita`, `amritKala`, `madhyahna`, `pratahSandhya`, `sayahnaSandhya`, `doGhati` |
| `inauspicious` | `rahuKalam`, `gulikaKalam`, `yamaganda`, `durMuhurta`, `varjyam`, `bhadra`, `gandaMula`, `panchaka`, `panchakaRahita` |
| `periods` | `choghadiya`, `hora`, `gowri` |

Top level: `date`, `location`, `timezone`, `ayanamsa`, `specialYogas`,
`anandadiYoga`, `festivals`, `eclipse`, `chandraBalam`, `tarabala`.

Three judgement calls, recorded so they read as decisions rather than drift:

- **`masa` sits in `calendar`, not `sun`.** It is the solar month, and `sun` is
  where solar readouts live — but `masa` and `chandramasa` are the two answers
  to "which month is it" and each type documents itself against the other.
  Splitting them costs a reader more than the mild category impurity does.
  `sun.nakshatra` stays in `sun` because it has no calendar counterpart.
- **`panchakaRahita` sits in `inauspicious`** although it lists the windows
  *free* of Panchaka. It is meaningless apart from the `panchaka` flag beside
  it, and separating the pair is the larger harm.
- **No `yogas` group.** `specialYogas` and `anandadiYoga` stay top level rather
  than becoming `yogas.special` / `yogas.anandadi`, because `result.yogas` next
  to `result.angas.yogas` — two unrelated things one keystroke apart — is worse
  than two extra top-level fields.

`getInstantPanchang` uses the same group names for the subset an instant can
answer (`sun`, `moon`, `angas`, `calendar`, `inauspicious`), with `SunPosition`
/ `MoonPosition` as shared base interfaces that `DailySun` / `DailyMoon` extend.
All twelve section interfaces are exported.

#### How the migration was driven

The measured scope was ~330 read sites; the actual count was **601 property
reads across 25 test files**, plus `src/calendar/convert.ts`,
`src/muhurta/engine.ts`, `scripts/generate-fixtures.ts` and the README.

They were not rewritten by grep. `tsc` was run against the changed types; its
`TS2339: Property 'x' does not exist on type 'DailyPanchangResult'` diagnostics
carry an exact file/line/column *and* the owning result type, and a codemod
applied each rename at precisely those positions, iterating to a fixpoint.
Nothing was matched by pattern, so nothing unrelated could be caught by one —
the compiler chose every edit.

#### The prerequisite: `tsconfig.test.json` was type-checking nothing

That plan depends on the compiler seeing the tests. It could not.

`tsconfig.test.json` exists precisely so "the suite is type-checked against the
library's own types". It `extends` the base config, which carries
`exclude: ["node_modules", "dist", "tests"]`. `exclude` filters `include` — so
naming `tests` in `include` while inheriting an `exclude` that removes it again
produced a config that checked **only `src`**, and exited 0. `npm run typecheck`
had been reporting success on a check it was not performing.

A breaking change to every field of the result produced **zero** test errors.
That is what surfaced it.

Fixed by restating `exclude` without `tests` and widening `rootDir` (the base
pins it to `src` so the build emits a flat `dist`). The suite then produced
**1,088 errors**: 601 were the rename, and **483 were pre-existing debt the
broken config had been hiding** — none of it visible to vitest, which strips
types without checking them.

#### What was in the pre-existing 483

Two were live faults, not type noise:

- **A dead test in `tests/integration/varjyam-wiring.test.ts`.** It imported
  `VARJYAM_DURATION_MINUTES`, a constant that no longer exists, so the import
  was `undefined` and its assertion compared a window length against `NaN`. It
  never failed because the assertion sits inside `if (r.varjyam)` and the single
  day it tested — 2025-01-14, Delhi — has no Varjyam window. Its premise was
  stale too: it asserted a fixed 96-minute width, but the window has been
  *elastic* since Phase 28 (4 ghatikas of the active nakshatra, 84–108 min). A
  second test in the same file still subtracted a 330-minute offset from
  `varjyam.start` to "recover the true UTC instant" — right under 4.x, wrong
  since 38.1, and likewise never executed.

  Both now assert the real contract, cross-checked against an independent
  bisection of the nakshatra boundary, over a 30-day sweep with a `checked > 8`
  guard so they cannot go vacuous again. Tolerances are derived, not fitted:
  `computeVarjyam` locates each boundary to `TOL_MS = 30 s`, so its ghatika is
  good to ~1 s, a 4-ghatika width to ~4 s (observed max 1.5 s), and a start at
  offset *n* ghatikas to 30 + *n* s — ≤85 s at the table's largest offset
  (observed 9 s at offset 20).

  Writing that cross-check also caught a trap worth recording: a 30 h lookback
  can span *two* nakshatra transitions (a nakshatra that began an hour before
  sunrise, preceded by a 22 h one), so a bisection anchored on the index at the
  far end of the bracket finds the wrong boundary — it measured durations of
  44–52 h instead of 21–27 h. The helper anchors on the reference instant's own
  index instead.

- **`tests/unit/search.test.ts` passed `15` where `findDailyElements` expects a
  `SearchPrecision` object**, so the solver ran with
  `precision.maxIterations === undefined`. The tests passed anyway because their
  mocked index functions are step functions that the degenerate search still
  resolves. Now passes `STANDARD_PRECISION`.

One was a real gap in the library's own typing: `computeSripatiLagna` had
overloads for the no-options call and for `{ includeCusps: true }`, but none for
an explicit `{ includeCusps: false }`, so that call resolved against the `true`
overload and failed to compile. Overload added in `src/jyotish/lagna.ts`.

The remainder was mechanical: 427 missing null-narrowings on `getDailyPanchang`
/ `getInstantPanchang` results (fixed by asserting non-null at the declaration,
again driven from tsc's diagnostics rather than by pattern), 19 `ShadbalaResult`
indexings by `GrahaName` — a union that includes Rahu and Ketu, which have no
classical Shadbala and are absent from that result — and 8 unused bindings, two
of which were dropped assertions rather than dead code and are now asserted.

#### Cost

Grouping allocates seven nested objects per result instead of writing ~50 flat
keys. Median of 7 processes, against the post-38.1 baseline:

| | after 38.1 | after 38.7 | |
|---|---|---|---|
| cold default | 0.7924 ms | 0.7790 | −1.7% |
| cold `sections: []` | 0.3206 | 0.3078 | −4.0% |
| warm default | 0.2148 | 0.2089 | −2.7% |
| `getFestivalsInRange`/yr | 248.2 | 246.5 | −0.7% |

Read that as **no measurable cost**, not as a win: `prim/sunrise` moved −5.1% in
the same run and 38.7 cannot have touched it, so a few percent either way here
is process-to-process drift.

### Step 3 — measured result

| invariant tests changed | numeric fixtures re-pinned | mechanical representation changes | suite |
|---|---|---|---|
| 0 | 0 | 476 (38.1 / 38.6) + 601 (38.7) + 61 non-null assertions | **8,277 passed** |

The zero re-pin count was checked mechanically rather than asserted: every hunk
of the test diff was compared as a multiset of numeric literals, old against
new. Every hunk in which a number moved is either pre-existing 38.1 work or one
of the specific rewrites described above. **No pinned instant, Drik tolerance or
expected value changed.**

`npm run typecheck` is clean — for the first time while actually checking
`tests/`. Lint, the Hermes syntax check and the build are green; bundle
421.0 KB CJS.

#### Six tests asserted the old contract and were changed on purpose

Not re-pins — contract assertions that 38.4 and 38.7 deliberately invalidated:
four `expect(r.chandraBalam / r.tarabala).toBeUndefined()` → `.toBeNull()`, one
`'varjyam' in r` → `'varjyam' in r.inauspicious`, and one `JSON.stringify`
round-trip reading `round.sunrise` → `round.sun.rise`.



---

## Step 4 — Phase 36.0, the validation protocol

No new ephemeris code, per the constraint. What exists now is the apparatus that
makes Step 5 adjudicable: two Tier 0 fixtures, a measured baseline error curve
for the *current* implementation, ten fixture-free cross-checks, and a tier
split that a test enforces rather than a document requests.

| §36.0 | deliverable | where |
|---|---|---|
| A | three tiers named, with what each may and may not decide | [tests/TIERS.md](../tests/TIERS.md) |
| B | external ground truth committed **before** any new code | `tests/fixtures/horizons-positions.json`, `tests/fixtures/horizons-deltat.json` |
| C | baseline error curve of the *current* code | `tests/validation/tier0-horizons.test.ts` |
| D | the same measurement, reusable against a replacement | same file — the bounds are the acceptance gate |
| E | sensitivity coefficients for predict-then-repin | TIERS.md § Sensitivity coefficients |
| F | invariant/tolerance split, made structural | `@tier` markers + `tests/validation/tier-policy.test.ts` |
| G | cross-checks needing no fixture | `tests/validation/tier0-crosschecks.test.ts`, `tier0-deltat.test.ts` |
| H | freeze a reference implementation | **Step 5's first act**, not this step's — there is nothing to freeze yet |

8,304 tests green (8,277 + 27 new). Typecheck, lint, Hermes and build clean.

### B — the Tier 0 fixture

1,750 geocentric apparent positions: 250 epochs × Sun, Moon, Mercury, Venus,
Mars, Jupiter, Saturn, from **JPL Horizons / DE441**. Span 1900–2100, with 170
of the 250 epochs inside 1950–2050 as §36.0 B asks.

Epochs are drawn from a seeded LCG, fully specified in
[notes/horizons-fetch.mjs](../notes/horizons-fetch.mjs), so the file can be
regenerated and audited rather than merely trusted. They are pseudo-random
rather than evenly spaced on purpose: a fixed cadence aliases against the very
periods being measured — sample the Moon every 29.53 days and you measure one
lunar phase forever — which would make the error curve look far smoother than it
is.

Two choices in the request matter enough to state:

- **`QUANTITIES=31` (`ObsEcLon`/`ObsEcLat`), geocentric, apparent, true ecliptic
  and equinox of date.** That is exactly the frame `Ecliptic(GeoMoon(t))` and
  `SunPosition(t)` return, so no frame conversion sits between fixture and
  measurement and a frame mistake cannot hide inside a longitude comparison.
- **`TIME_TYPE=TT`.** Horizons' default `UT` output is UTC after 1962 and UT1
  before, and UT1−UTC ranges to ±0.9 s. The Moon moves 0.549″ per second, so
  that ambiguity alone would inject ±0.5″ — comparable to the whole signal. The
  harness converts each TT epoch to the UT instant the public API takes using
  the library's *own* ΔT, so ΔT cancels exactly and the residual is position
  theory alone. ΔT is then measured separately, which is the whole point of
  §36.0 G's "test it on its own".

### C — the baseline. What "at least as good as today" actually means

`astronomy-engine` against DE441, 1900–2100, 250 epochs:

| body | max″ | mean″ | rms″ | bias″ | worst epoch | max as time |
|---|---|---|---|---|---|---|
| Sun | 1.613 | 0.519 | 0.639 | −0.148 | 1942 | 39 s |
| Moon | **3.747** | 0.884 | 1.132 | +0.296 | 1906 | **6.8 s** |
| Mercury | 6.504 | 1.671 | 2.075 | −0.084 | 1981 | 110 s |
| Venus | 19.586 | 1.783 | 3.069 | −0.401 | 2027 | 392 s |
| Mars | 11.103 | 1.507 | 2.288 | +0.325 | 1989 | 529 s |
| Jupiter | 9.662 | 2.856 | 3.489 | +0.331 | 2009 | 2761 s |
| Saturn | 11.147 | 3.109 | 4.066 | −0.391 | 2002 | 7962 s |

Three things follow that were not knowable before measuring:

**1. PLAN.md's illustrative Moon baseline was the mean, not the max.** §36.0 D
sketches "astronomy-engine (baseline) 0.83″". The measured *mean* is 0.88″ — so
the sketch was well calibrated — but the **max is 3.75″**, 4.5× larger. An own
implementation judged on the mean could be materially worse at the ends of the
span and still pass. This is why §36.0 D says max, mean *and* worst epoch, and
why the committed bounds are maxima.

**2. The whole planetary set is comfortably inside the library's own stated
tolerance.** README claims ±0.25° for Sun–Saturn; the worst measured is Venus at
19.6″ = 0.0054°, 46× inside it. The jyotish surface is not where the ephemeris
risk lives.

**3. Moon error is worth 6.8 s at the worst epoch** — against a Drik drift of
17.4 s that is real but not dominant, which is the honest framing for how much
36.2 can buy in *accuracy* terms.

### C — a finding the baseline produced immediately: the Moon is missing its light-time correction

`GeoMoon` returns a *geometric* geocentric position. Horizons' `ObsEcLon` is
*apparent*, which includes light-time retardation. The Moon is 1.28 light-seconds
away and moves 0.549″/s, so the term should be ≈0.70″.

Predicted before measuring, then measured:

| | mean signed error | max |
|---|---|---|
| light-time term (geometric − retarded) | **+0.706″** | — |
| as shipped (geometric) | +0.296″ | 3.747″ |
| with retardation applied | −0.410″ | **3.071″** |

The prediction lands within 1%. What it exposes is more interesting than the
term itself: `astronomy-engine`'s lunar theory carries a **−0.41″ systematic**
against DE441, and the missing retardation (+0.71″) has been partially
cancelling it. The shipped +0.30″ bias is an accident of two errors pointing
opposite ways, not correctness — and applying the physically correct
retardation *reduces max error by 18%*, from 3.75″ to 3.07″.

Deliberately **not fixed here**: it is ephemeris code, this step is forbidden
ephemeris code, and it would move published values (0.706″ ⇒ 1.3 s of tithi
time). It is recorded as a requirement on 36.2: include the retardation, and
expect to be judged against the −0.41″ theory bias rather than the +0.30″ the
current stack happens to show.

Confirming that `astronomy-engine` cannot simply be asked for it:
`GeoVector(Body.Moon, t, true)` returns bit-identical output to `GeoMoon` — the
aberration flag does nothing for the Moon.

### G — ΔT, isolated, and a limitation this surfaced

Horizons will not print ΔT, so it is derived *from* Horizons: request the Moon's
longitude at Julian date *J* tagged UT, then find the TT epoch with the same
longitude. The difference is ΔT. Two HTTP requests cover all 21 decades; the
interpolation residual is ~0.7 ms. Method in
[notes/horizons-deltat.mjs](../notes/horizons-deltat.mjs).

| | library − Horizons |
|---|---|
| 1900–2010 | ≤ **0.831 s** (worst at 1910) |
| 2020 | +2.4 s |
| 2050 | +23.8 s |
| 2100 | **+133.5 s** |

The divergence is not an error in either. Horizons' own header says it holds
"the last known leap-second … as a constant over future intervals", and the
fixture confirms it exactly: 69.184 s = 32.184 + 37 leap seconds, flat from 2020
to 2100. So Horizons reports TT − UTC there, while the library extrapolates
Espenak–Meeus TT − UT1.

**But it names a real exposure.** The public API takes a JS `Date`, which is
UTC, and adds a ΔT that models TT − UT1. Those agree only while leap seconds
keep UTC within 0.9 s of UT1 — and CGPM Resolution 4 (2022) resolved to stop
inserting leap seconds by 2035. If that holds, UTC stops tracking UT1 and this
library's far-future times carry the accumulated difference in full, because a
ΔT error of δ seconds moves a reported tithi or nakshatra end time by the whole
δ. Rise/set is far less exposed: there the error scales by the body's motion
against the 15°/hr sky rotation, so 133 s of ΔT is ~0.4 s of sunrise and ~5 s of
moonrise.

Pinned in `tier0-deltat.test.ts` so 36.2's own ΔT reproduces it deliberately
rather than inheriting it.

### G — the cross-checks that cannot be re-pinned

Ten assertions containing no number that came out of this library. They survive
the 36.2–36.5 rewrite untouched, and an own ephemeris that breaks one is wrong
with no adjudication needed.

| family | assertion |
|---|---|
| mean motion | Moon 13.176396°/day and Sun 0.985647°/day (tropical), least-squares over 1900–2100 |
| closure | 30 tithis per lunation; 27 nakshatras per sidereal month; 12 sankrantis per year with 28–33 day gaps; 48–51 moon phases per year, 12–14 of each |
| solver separation | every reported tithi end-time within **24 ms** of an exact bisection of the same index function |
| ordering | sunrise < sunset < nextSunrise at 5 latitudes × 3 centuries; day+night reconstructs the span; 50+ published windows have start ≤ end and lie in the day; moon phases strictly increase and cycle in order |

The mean-motion check is a least-squares slope, not an endpoint difference, and
the reason is worth recording because the naive version *silently* fails: the
Moon carries periodic terms to ±6.3°, which cancel only across a whole number of
anomalistic months. Over an arbitrary 40-year baseline they leave up to 12.6° of
residual — 0.00086°/day. Measured: 0.00075°/day, right in that band and 150×
larger than the secular signal. A tolerance loose enough to pass would have been
loose enough to be worthless. Least squares over 2,000 samples averages the
periodic terms away (they are zero-mean), giving a slope uncertainty of
~7 × 10⁻⁶ °/day and making a 10⁻⁵ bound meaningful.

The solver check is the one that answers "which half moved?" when a time
changes. At 24 ms against a Moon error worth 6.8 s, **the solver is not the
binding constraint and has not been for some time** — which is the quantitative
form of the argument for spending Step 5 on the ephemeris rather than the search.

### F — the tier split, enforced

[tests/TIERS.md](../tests/TIERS.md) states the three tiers, the
invariant-vs-tolerance rule, the sensitivity coefficients for predict-then-repin,
and the current baselines. Every file in `tests/validation/` now declares
`@tier 0|1|2` in its opening comment: three Tier 0, nine Tier 1 (Drik,
ProKerala, AstroSage), three Tier 2. `tests/unit/**` and `tests/integration/**`
are Tier 2 by default.

`tier-policy.test.ts` enforces both the marker and the Tier 0 membership list,
so the split is structural. §36.0 F asked for exactly that, and a convention
nobody checks is a promise, not a structure. It also puts the question — *which
authority does this number come from?* — inside the file someone is about to
re-pin, rather than in a document they would have to think to open.

### Step 4 — measured result

| invariant tests changed | numeric fixtures re-pinned | new tests | suite |
|---|---|---|---|
| 0 | 0 | 27 | **8,304 passed** |

One source change, and it is not ephemeris code: `getTropicalPlanetLongitude` in
`src/jyotish/planets.ts` is now exported so the Tier 0 harness can measure the
*tropical* longitude directly. Folding the ayanamsa in first would mix a Tier 1
rule choice into a Tier 0 position measurement. It is not re-exported from
`src/index.ts` — its `Body` parameter is an `astronomy-engine` type, and v5 is
removing that dependency, not widening it.

---

## Step 5 — Phases 36.2–36.5, the own ephemeris

**Started. 36.2's first module is done and validated; the series are not, and
the reason is a decision that belongs to the maintainer rather than to me.**

Plan order is kept: 36.2 → 36.3 → 36.4 → 36.5, per the reviewer's ruling that
36.3's interpolant should be built once over the series that ships. And the
recorded expectation still stands: **36.2 will show essentially no runtime
improvement.** Do not read its flat benchmark as a regression.

### 36.2 (a) — ΔT ✅ done, validated, frozen, not wired in

`src/astronomy/deltaT.ts`. Espenak–Meeus piecewise polynomials transcribed
directly from NASA/TP-2006-214141 §4, with the segment boundaries and each
branch's own centering constant left intact so the code can be read line by line
against the paper. §36.0 H's *correct first, frozen second, fast third* — a
degree-7 polynomial has no optimization worth the risk, so reference and shipped
are the same code.

It goes first because it is the only error that is invisible to every other
test: a ΔT wrong by δ moves every body in proportion to its mean motion, which
looks exactly like ordinary theory error, **and** moves every reported tithi and
nakshatra end-time by the full δ.

Acceptance, in `tests/validation/tier0-own-deltat.test.ts`:

| check | result |
|---|---|
| §36.0 D — error ≤ baseline vs Horizons, 1900–2010 | own **0.831 s**, baseline 0.831 s — equal to 2 × 10⁻⁷ s |
| §36.0 H — differential vs an independent transcription, 100,000 instants, −500 → +2500 | **< 0.05 s** worst |
| branch continuity at all 14 segment boundaries | < 1 s (Espenak's segments are not constrained to meet exactly) |
| published anchors 1900 / 1950 / 2000 | −2.79 / 29.07 / 63.86 s |

The differential partner is `astronomy-engine`'s own transcription of the same
model. That is weaker than reference-vs-optimized — it cannot catch a *shared*
misreading of the paper — and it is stated as such in the file. The Tier 0
comparison is what covers that case, which is why both run.

**Not wired in.** `MakeTime` still does the UT→TT conversion throughout `src/`;
replacing it is the rest of 36.2. Swapping now would move published values while
the surrounding series are still external, for no benefit. Bundle is unchanged
at 420.1 KB because the module is tree-shaken out until something calls it.

One design decision made here that the rest of the port inherits:
`ttDaysSinceJ2000` — not a Julian Date — is the primitive the series will take.
A JD near the present is ~2.46 × 10⁶, spending 7 of a double's ~16 significant
digits on the integer part and leaving ~10 µs of resolution; the round trip
through one loses ~6 µs, measurably. Irrelevant to accuracy (6 µs is 3 × 10⁻⁶
arcsec of lunar motion) but it makes the obvious identity test fail, and then a
reader has to decide whether that is precision or a bug. Days-since-J2000 is
~10⁴ and reaches picoseconds. `terrestrialTimeJd` is kept for interoperability
and carries the loss, pinned at <10⁻⁴ s.

### 36.2 (b) — Sun and Moon series: sourced by truncation, and the decision that settled it

Option 3 of the three above — *truncate from a higher-order source at build
time* — was taken, and the reason is the one the option table already named:
it is the only one that gives an explicit, tunable accuracy/size trade, and
that trade turned out to be the whole performance story of this phase.

`notes/ephemeris-fetch.mjs` pulls VSOP87D, ELP2000-82B and the IERS nutation
tables into `tests/fixtures/ephemeris-source/` (1.2 MB gzipped, committed,
`.npmignore`d). `notes/ephemeris-generate.src.ts` truncates them under a stated
per-quantity error budget and writes `src/astronomy/series/*.ts` with a
"generated" banner. Truncation is **not** an amplitude threshold — that bounds
the largest term dropped, not the error. It is a binary search on the *measured*
disagreement with the full series over 600 pseudo-random epochs, so the budget
and the resulting term count are both facts rather than intentions, and
`differential-ephemeris.test.ts` re-measures them against the untruncated
reference afterwards.

### Steps 36.2–36.4 — measured against DE441

Max |error| over 1900–2100, 250 Horizons epochs:

| body | baseline (`astronomy-engine`) | own reference (untruncated) | own shipped |
|---|---|---|---|
| Sun | 1.613″ | 0.115″ | **0.323″** |
| Moon | 3.747″ | 1.287″ | **1.261″** |
| Mercury | 6.504″ | 0.254″ | **0.296″** |
| Venus | 19.586″ | 0.261″ | **0.862″** |
| Mars | 11.103″ | 0.260″ | **1.293″** |
| Jupiter | 9.662″ | 0.553″ | **0.835″** |
| Saturn | 11.147″ | 0.450″ | **0.862″** |

Every body is inside its §36.0 D ceiling by 2.97× (the Moon) to 23× (Venus).
The Moon's shipped figure being marginally *better* than its own untruncated
reference is an accident of which epoch is worst in a 250-point sample, where
truncation happens to cancel some theory error — not evidence that truncating
helps.
The **reference** column is the more interesting one: it is flat at 0.1–0.6″
across bodies whose baselines span 6″ to 20″, which says the published theories
are uniformly good and that what varied in the old numbers was how much of them
`astronomy-engine` kept.

Rise/set, against a solver that interpolates nothing: **0.687 ms** below 65°,
**24.1 ms** including Alert at 82.5 °N, and **zero** event-count mismatches —
the count being the assertion that matters, since a time off by a second is a
tolerance question and an event never found is a wrong answer.

### 36.5 — eclipses, and the last import

`src/astronomy/eclipseGeometry.ts` replaces `SearchLunarEclipse`,
`NextLunarEclipse`, `SearchLocalSolarEclipse` and `NextLocalSolarEclipse`.
`astronomy-engine` is now a devDependency; `src/` has zero imports of it and
`dist/index.cjs` contains none of it.

Lunar is Meeus ch. 54 shadow geometry: the Moon's separation from the antisolar
point against the umbral and penumbral radii at its distance. Solar is
**direct topocentric** — the observer's own directions to the Sun and the Moon,
their separation, and the two topocentric semidiameters — deliberately *not*
Besselian elements, so that comparing against NASA's published elements is an
independent check rather than a restatement of them.

#### The finding this produced: the shadow enlargement is Danjon's, not 2%

The first implementation enlarged the two lunar shadow *radii* by 2%, which is
one of the two conventions in circulation. It ran a **+0.028 bias on penumbral
magnitude** and **mis-typed two eclipses** (1988-03-03 and 2042-09-29, both
penumbral, both reported partial).

Rather than tune it, the canon was asked. Inverting all 457 published magnitudes
for the enlargement each implies:

| | implied multiplier | scatter |
|---|---|---|
| on the shadow **radii** — umbra | 1.0137 | ±0.00024 |
| on the shadow **radii** — penumbra | 1.0080 | ±0.00008 |
| on the **Earth's radius** — umbra | 1.00989 | ±0.00003 |
| on the **Earth's radius** — penumbra | 1.01016 | ±0.00003 |

The 2%-on-radii reading is **not constant** — the two rows disagree by 20× their
own scatter — and the Danjon reading is, with both landing on
1 + 1/85 − 1/594 = 1.010081. That is Danjon's rule in the form Espenak's canon
states, and it is now the constant `eclipseGeometry.ts` carries. After the
change: penumbral magnitude max 0.0003, umbral 0.0005, **zero** type
mismatches in 457 eclipses.

This is what §36.0 is for. A Tier 2 suite would have gone green on the wrong
convention; Tier 0 identified which convention, from the reference's own
numbers, without a single fitted parameter.

### The gap §36.5 named, and how it was closed

PLAN.md flags solar local circumstances as "the thinnest Tier 0 coverage", and
`nasa-eclipses.json` is **geocentric only** — one row per eclipse at greatest
eclipse. It validates the whole lunar path (a lunar eclipse looks the same to
every observer who can see the Moon) and the geocentric half of the solar path.
It says nothing about when the partial phase begins at Varanasi.

A differential test against `astronomy-engine` would not have filled that gap:
that is the implementation being removed, and it carries no independent
authority. Three routes were considered in the order §36.5 sets out, and the
**first one worked**.

**Option A — NASA's per-eclipse local-circumstances tables.** The URL family
§36.5 suggests (`SEcirc/SEcirc2001/SE2026Aug12Tcirc.html`) does not exist —
it 404s. But `SEcirc/SEcirc.html` does, and it is the same data organised the
other way round: *Solar Eclipse Visibility from Major Cities*, one catalog per
city rather than per eclipse, covering 0001–3000 CE. Ten cities, each publishing
first contact, maximum, last contact, the Sun's altitude and azimuth, and the
eclipse magnitude and obscuration. `notes/eclipse-local-fetch.mjs` pulls the
1901–2100 slice: **788 local circumstances across 10 sites**, with the parsed
row count asserted against an independently counted one so a regex that
silently drops the awkward rows fails instead.

Options B (Besselian elements) and C (Horizons topocentric) were therefore not
needed, and are recorded here as unused rather than as unavailable — the
`SEbeselm` pages are live and carry polynomial elements per eclipse, should a
future check want a second, structurally different route.

#### Three things about the data the parser has to respect

1. **Times are local *standard* time**, never daylight. The offset is taken from
   each page's own header rather than assumed.
2. **`r` and `s` suffixes clip to the horizon, not to the geometry.** `06:32r`
   is sunrise with the eclipse already in progress. Those are not contact times,
   and the altitude/magnitude/obscuration printed beside a flagged *maximum*
   belong to that clipped instant too. Reading them as geometric maxima produced
   a 12° altitude "error" that was entirely an artefact of misreading the
   fixture — corrected before any conclusion was drawn from it.
3. **An eclipse absent from a city's catalog is not visible from that city.**
   That is the negative case §36.5 singles out as "the one a solver gets wrong
   silently", and it is only sound because these catalogs are complete over
   their span — which is what makes the row-count assertion load-bearing.

#### Measured

`tests/validation/tier0-own-eclipses.test.ts`, `@tier 0`:

| | rows | measured |
|---|---|---|
| **Lunar, full canon** — type | 457 | **0 mismatches** |
| greatest eclipse (TT) | 457 | max 3.84 s, median 0.88 s |
| penumbral / umbral magnitude | 457 | max 0.0003 / 0.0005 |
| penumbral / partial / total duration | 457 / 288 / 166 | max 1.00 / 0.40 / 0.91 min |
| **Solar, geocentric** — γ | 452 | max **0.00015** Earth radii |
| greatest eclipse (TT) | 452 | max 2.58 s, median 0.79 s |
| type at the greatest-eclipse point | 378 in scope | **0 mismatches** |
| magnitude there | 376 in scope | max 0.0015 |
| **Solar, local** — contact times, 1901–2002 | 338 | bias **−0.75 s**, max 43.1 s |
| contact times, 2003–2100 | 324 | bias **+16.6 s** |
| Sun altitude / azimuth at maximum | 662 | max 0.594° / 0.651° |
| magnitude / obscuration at maximum | 662 | max 0.0022 / 0.0029 |
| eclipses the catalogs list that we cannot find | 788 | **0** |
| eclipses we report at London that NASA says are invisible there | 60 | **0** |

Three of those rows need their bound read against something rather than in the
abstract, and the file says so at the point of assertion:

- **γ is the sharpest single check in the release.** NASA publishes it to four
  decimals for every solar eclipse, and it is sensitive to both directions *and*
  both distances in a way a longitude comparison is not. 0.00015 is 1.5 in the
  last digit printed.
- **Contact times are printed to the minute.** The median |error| of 15.4 s is
  exactly what rounding to the minute produces, so the historical half is at the
  fixture's own resolution and the −0.75 s bias is the real accuracy statement.
- **Altitude and azimuth are printed to the whole degree**, and the maximum is
  quantised to the minute, over which the Sun can move 0.25°.

#### The one thing that is *not* validated, and why it is a finding rather than a gap

The 2003–2100 half of the local comparison carries a **+16.6 s bias, growing
smoothly with epoch**: −4.3 to +2.1 s per 20-year bucket through 1900–1999, then
+4.6 s in the 2000s, +14.6 in the 2020s, +25.8 in the 2040s.

That is a **ΔT-model difference, not an ephemeris error**, and the shape is the
proof: it is zero everywhere ΔT is *observed* and grows only where it is
*predicted*. These catalogs were computed in 2003; a local circumstance is a
function of UT (where the observer is) and TT (where the sky is) at once, so —
unlike the lunar and geocentric-solar comparisons, which are made in TT and
cancel ΔT exactly — there is no time scale in which the difference goes away.
It is the same exposure `deltaT.ts` documents, measured from a second direction.

The test therefore asserts the two halves separately: the historical bias at
<2 s, which would catch a regression, and the future bias as a *bounded band*
rather than a target.

### The membership of Tier 0 grew, and the policy test enforced it

`tier0-own-eclipses.test.ts` is the seventh Tier 0 file. `tier-policy.test.ts`
rejected it until it was added to the pinned membership list, which is the
second time that guard has fired correctly.

### §36.0 H at full sample size — and what it found about the generator

`DIFFERENTIAL_FULL=1`, 100,000 pseudo-random instants per body, ~10 minutes.
This is the run §36.0 H specifies, and the number it produces is the claim;
the everyday 1,500–4,000-instant sample is its regression detector.

| | generator's budget (600 probes) | everyday sample | **full 100,000** |
|---|---|---|---|
| Moon longitude | 0.398″ | 0.35004″ (1,500) | **0.45073″** |
| Sun longitude | 0.363″ | 0.42435″ (4,000) | **0.45312″** |

*(Those are the first pass's figures. `PROBE_COUNT` is now 100,000 and the
budgets are met over the sample that verifies them — see "The generator's probe
count" below.)*

The gap between the first and last columns is the finding. The generator
truncates by binary search on the *measured* error over `PROBE_COUNT = 600`
epochs, so the budget it advertises is a 600-sample maximum — and a
100,000-sample maximum of the same quantity is legitimately larger, being the
tail the small sample never draws. 13–25% larger, here.

Nothing about the shipped accuracy is threatened by that: the accuracy claim is
Tier 0's and is made against DE441, where the Moon is 1.345″ against a 3.747″
ceiling. What it means is that the budgets printed into the generated files
should be read as "600-sample", and the differential bounds are now set from
the number actually measured at the size §36.0 H asks for. Raising
`PROBE_COUNT` is queued as its own change, because it will move term counts and
therefore published values, and that has to go through the predict-then-observe
protocol rather than ride along here.

### Output neutrality — what was measured, and what could not be

`notes/dump.sh` before/after over 6 locations × 320 days × 5 option shapes
spanning 1912 / 2025 / 2088, plus full-year festival, ekadashi and sankranti
listings: **241 MB each side**, classified by `notes/diff.mjs`.

**Invariant / structural changes: 0.** No index, name, boolean, count, array
length, key order or festival date moved.

The full table of what did move is in
[notes/v5-step5-predictions.md](../notes/v5-step5-predictions.md), against the
predictions written before the run. Headline: tithi and karana ≤776 ms, yoga
≤569 ms, nakshatra ≤368 ms, rise/set-proportional windows ≤94 ms, Sun sidereal
longitude ≤0.269″, Moon ≤0.193″ — every family inside its predicted worst case.

**The limit of that measurement, stated rather than glossed.** The before/after
isolates the **truncation-budget change**, which is the only one of this
session's edits that was expected to move published values. It does *not* cover
the 36.5 eclipse rewrite, because the pre-36.5 tree could not be reconstructed
once `eclipse.ts` had been replaced in place. That gap is covered instead — and
better — by `tier0-own-eclipses.test.ts`, which measures the new geometry
against NASA rather than against the code it replaced. The remaining changes
(nutation by angle addition, the trig kernel, the light-time restructure, the
`formatInZone` table) are bounded by their own differential tests at 10⁻⁹″,
6 × 10⁻¹², 10⁻⁴″ and exact-string respectively, which is a tighter statement
than a dump diff could make.

## Step 5 — performance, and the 6% that is missing

### The number the port started from was not the number the profile showed

`cold/default` stood at **0.945 ms** when 36.2–36.4 were complete: 21% *slower*
than the 0.93 ms the phase started from, against an exit criterion of "roughly
halved". (That 0.93 was the pre-Phase-36 tree, not published 4.3.1, which runs
the same call in 6.10 ms — see *Step 5, third pass*. The comparison in this
subsection is tree-against-tree and is unaffected.) The
temptation is to start optimizing there. The profile said not to: 36% of self
time was still inside `astronomy-engine`, because `eclipse.ts` was running the
full Montenbruck–Pfleger lunar theory on **every day containing a syzygy** —
about one day in ten, at a cost that swamped everything around it.

Removing that one import, with no optimization of any kind, took `cold/default`
from **0.945 to 0.6543 ms** — a third of the whole gap, from finishing the port
rather than from tuning it. Every measurement below is taken after that point.

### The arc, step by step

Median of 7–9 processes, ms per call. Each row is measured against the row
above it, on the same machine within minutes.

| | cold/default | what changed |
|---|---|---|
| pre-Phase-36 tree (git HEAD) | 0.9345 | *not* published 4.3.1, which is 6.0562 |
| after 36.1 (structural) | 0.7790 | Chebyshev blocks, canonical rise/set cache |
| after 36.2–36.4 (own ephemeris) | 0.945 | **+21%** — the port, before 36.5 |
| after 36.5 | 0.6543 | the last `astronomy-engine` import removed |
| + nutation by angle addition | 0.6523 | flat here; −8% on primitives, −8% on ranges |
| + planet light-time 3 passes → 2, Earth memoized | 0.6578 | flat here; **−12% on `chart/*`** |
| + truncation budgets 0.1″/0.2″ → 0.4″ | 0.5332 | **−19%** |
| + `fundamentalArguments` closure removed | 0.5313 | flat here; −7% on `chart/*` |
| + own `sin`/`cos` in ELP and VSOP | 0.4960 | **−6.6%**, and −7% on `range/festivals` |
| + own `sin`/`cos` in nutation and rise/set, table-driven `formatInZone`, 16-entry nutation memo | **0.501** | −2.3% and −1.7%, both measured interleaved |

Two of those rows are worth reading against what was expected of them.

**The nutation rewrite was expected to be the single biggest lever** — it is
paid by every Sun read and every Moon read, and it replaced 156 transcendental
calls with 28. It cut `sumNutation` from 6.1% of self time to **1.1%**, exactly
as predicted, and moved `cold/default` by nothing. The reason is that the
summation was never the cost: `fundamentalArguments` was, and the profile had
been attributing its time to the caller. Fixing that (removing a closure
allocated per call) moved another 7% of `chart/*`. The lesson is not that the
rewrite was wrong — it is 5× faster at what it does, and the ranges and
primitives show it — but that a 10% profile line can be two things and only one
of them was the one being optimized.

**Relaxing the truncation budgets was the largest single win**, at −19%, and it
is the only one that moves published values. It is covered in full by the
predict-then-observe ledger; the short version is that the budgets sat *ten*
times inside the accuracy ceilings rather than the three §36.0 asks for, and
that precision was being paid for out of the performance budget at 47.9% of
self time.

### The largest win was one nobody planned: this library's own `sin` and `cos`

`src/astronomy/trig.ts` is 30 lines and worth **−54% of the ELP evaluation
loop** — 5.35 µs → 2.46 µs on the 512-term lunar longitude series, more than
every other optimization in this phase combined.

The measurement that found it: the same loop with `Math.sin` deleted (wrong
answer, right timing) runs in 1.05 µs against 4.60 µs. **77% of the lunar
series was the transcendental call**, not the arithmetic. And most of *that* is
argument reduction `Math.sin` cannot avoid — it must handle every double, so it
pays for Payne–Hanek reduction of arguments up to 10³⁰⁸, while ELP's phases
never leave ±10⁵ and VSOP's never leave ±10⁶. Three multiply-adds against a
Cody–Waite split of π suffice, and a Taylor kernel to r¹⁵ on |r| ≤ π/2 finishes
it.

This displaced §36.5's own first-listed candidate. Angle-addition on the ELP
main-problem group was measured at −34% against a `Math.sin` baseline — real,
but the baseline had already moved, and folding four integer multipliers costs
more than one reduced sine. It was not implemented, and the reason is recorded
as a measurement rather than a preference.

**The accuracy is the point, and it is measured, not argued.** Against the
platform's own functions over 10 million arguments spanning |x| ≤ π to |x| ≤ 10⁶:

| | max |Δ| |
|---|---|
| `sin` | **6.02 × 10⁻¹²** |
| `cos` | **5.26 × 10⁻¹³** |

Those figures are *identical at every range*, which is the check that matters:
it says the residual is the kernel's Taylor truncation and nothing else, and
that the reduction contributes nothing measurable even at 10⁶ — where a split
built on `Math.PI` would already be leaking 4 × 10⁻¹¹. Read against what it
multiplies: ELP's largest longitude term is 22,639″ and the whole series sums
to ~35,000″ of absolute amplitude, so 6 × 10⁻¹² of relative error is
2 × 10⁻⁷ arcseconds even if every term erred the same way — against a 0.4″
truncation budget and a 0.005″ quantization budget.

**And it buys something accuracy-adjacent that was not the goal.** `Math.sin`
is not required to be correctly rounded, and V8, JavaScriptCore and Hermes do
not agree in the last few ULPs. A library that ships to React Native and finds
a tithi boundary by root-finding over a few hundred sines therefore produced
very slightly different times on iOS and on Android. It no longer does.

### Where the release lands, and where it does not

Median of 15 processes. The machine was at load average 4.3 throughout, so
every figure here is the pessimistic end of its range — `cold/default` sampled
between 0.4968 and 0.5065, and the interleaved A/B measurements used to
attribute the individual steps above were taken the same way for the same
reason.

| | pre-36 tree | 5.0.0 (first pass) | |
|---|---|---|---|
| cold default | 0.9345 | **0.501** | −46.4% |
| cold `sections: []` | 0.4227 | **0.2741** | −35.2% |
| cold `getInstantPanchang` | 0.3185 | **0.2338** | −26.6% |
| warm default | 0.6291 | **0.1803** | −71.3% |
| `getFestivalsInRange`, ms/yr | 336.1 | **162.4** | −51.7% |
| `computeShadbala` | — | **0.347** | −16% since 36.4 |

*(The left column was labelled "4.3.1" through the first two passes and is not —
it is the pre-Phase-36 tree. Corrected in place here because the percentages
beside it are only true of that tree; against published 4.3.1 they are all far
larger. See* Step 5, third pass *.)*

**The default call is 6.4% short of "roughly halved".** That is stated as a
miss rather than rounded into a pass. PLAN.md § Phase 36 exit criteria carries
the breakdown of where the remaining time goes and what each further step would
cost — including the two that were measured and rejected (a looser lunar budget,
which would take the Moon's margin below §36.0's 3× floor; and the ELP
angle-addition, which the trig kernel already beat).

The two criteria that *were* written as "roughly halved" — narrowed calls and
`getInstantPanchang` — are met.

> **Superseded.** Everything in this subsection is the state at the end of the
> first pass, kept because the arc it records is the evidence for what came
> next. The gap was closed structurally afterwards — `cold/default` is
> **0.4518 ms** — and the reason the "80% of the lunar cost" estimate above
> pointed at the wrong lever is in *Step 5, second pass* below.

### A test failure that was a good outcome

`sections.test.ts` asserts that `sections: []` costs under half a full run. It
started failing at 56%. The cause is the denominator: dropping
`astronomy-engine`'s eclipse search took a large *optional*-section cost out of
the full call, so there is proportionally less left for narrowing to skip.

| ms/day, `computeEndTimes: false` | pre-36.2 | after 36.5 | end of Phase 36 |
|---|---|---|---|
| full run | 0.7595 | 0.6365 | **0.4741** |
| `sections: []` | 0.2933 | 0.3622 | **0.2664** |
| ratio | 0.386 | 0.569 | 0.562 |

Both columns are faster than they have ever been. A ratio bound cannot tell
"narrowing got worse" from "the full call got better", so the bound moved to
0.62 and the reasoning was written into the test beside it — paired with the
absolute floor in the next test, which is the assertion that would actually
catch a regression.

`perf.test.ts` carries the same assertion and needed the same change, and it
surfaced in the worst possible way: at 0.505–0.514 against a 0.5 bound it passed
roughly one full-suite run in three. That was caught by running the suite five
times rather than once, which is the only way a threshold sitting on its own
boundary shows itself.

---

## Step 5, second pass — closing the three open items

The first pass left `5.0.0-rc.1` with one missed criterion and two known
weaknesses. All three are closed below, and each produced a finding that is
worth more than the change itself.

### The performance gap, and a premise that was wrong

`cold/default` stood at 0.501 ms against 0.47. Re-measuring on a quieter machine
took it to 0.4972 — so measurement conditions were worth 0.6% of the 6.4%, and
the gap was real.

The handoff named the rise/set track as the lever, on the estimate that it was
"roughly 80% of the lunar series cost against only ~2.55 direct longitude
reads". **That was wrong, and counting rather than profiling is what showed
it.** Instrumenting the series evaluators and attributing every call:

| per default day, all sections | ELP terms | share |
|---|---|---|
| `getTropicalMoonLongitude` — 17.4 reads × 566 terms | 9,854 | 54% |
| the rise/set track — 7.0 reads × 969 terms | 6,802 | 37% |
| `getMoonPosition`, for the eclipse guard | 1,745 | 9% |

The track is 37%. And the 2.55 figure is right about `cache.ts`'s Chebyshev
block builder but accounts for only 2.5 of the 17.4 longitude reads — the other
~15 come from **`boundingNewMoons`**, which runs 2.07 phase searches a day at
~6 elongation evaluations each to seed the Chandra Masa. A per-call
`NewMoonCache` already collapses the two reads a day makes into one; what it
cannot do is share across calls, because `boundingNewMoons` returns instants
that depend slightly on the seed it was given. Making that search canonical the
way `sunrise.ts` was made canonical is the next real step down, and it is
recorded here rather than taken.

### The track, widened — and why it costs no accuracy

`riseSet.ts` fitted 7 Chebyshev nodes of each body's equatorial-of-date position
per UTC day. It now fits 11 over four days: **2.75 lunar evaluations a day
against 7.0**, ELP terms 18,405 → 14,296, and `cold/default` 0.4972 → 0.4154 ms
(**−16.4%**), `getMoonrise` −45%, `computeSunrise` −26%.

The class split that made it possible is the interesting part. The position and
the *frame* had been fitted over the same window because they lived in the same
object, and they have different natural spans: the position costs a series
evaluation and is smooth across four days, while the equation of the equinoxes
costs a nutation evaluation and must stay **endpoint-anchored per day** so two
adjacent days compute identical sidereal time at the midnight they share. So
`DayTrack` became `PositionTrack` (per body, per four days) and `DayFrame` (per
day, body-independent, shared by the Sun's and the Moon's scans).

`notes/track-fit.src.ts` is the measurement that chose the constants, sweeping
span × nodes against direct evaluation over five epochs spanning 1900–2100:

| span × nodes | evaluations/day | Moon | Sun |
|---|---|---|---|
| 1 d × 5 | 5.00 | 1.1 × 10⁻²″ | 4.9 × 10⁻⁵″ |
| 1 d × 7 *(was)* | 7.00 | 6.4 × 10⁻⁴″ | 4.4 × 10⁻⁵″ |
| **4 d × 11** | **2.75** | **6.1 × 10⁻⁴″** | **4.2 × 10⁻⁵″** |
| 8 d × 17 | 2.13 | 3.7 × 10⁻²″ | 3.1 × 10⁻³″ |

Two things in that table decided it. The chosen row is **not better than the old
one by luck** — both sit on the same floor, which is the millisecond
quantization of `new Date()` (the Moon moves 5.5 × 10⁻⁴″ per ms), so the fit
contributes nothing measurable at either span and the extra width is free. And
eight days is a genuine cliff, 50× worse at *more* nodes, because ELP carries
argument families near a five-day period that a wider block cannot resolve
however many nodes are spent on it.

`differential-riseset.test.ts` — the §36.0 H check, against a solver that
interpolates nothing — reports **identical** figures before and after, to three
decimal places of a millisecond, with 0 event-count mismatches. The frozen
reference did not need re-freezing: it already interpolates nothing, which is a
strictly stronger partner than the implementation being replaced.

**And it corrected a stale number.** The reference's temperate bound was
recorded as 0.687 ms; the true figure is Sun 1.946 ms and Moon 4.234 ms, and it
is invariant across *every* span × node combination in the sweep. That
invariance is the attribution: it is not the interpolation at all, it is the
**lunar distance tier** — the track reads 88 terms where the reference reads 623
— which `moon.ts` had independently measured at 0.003 s of rise time.

### The generator's probe count, and a convergence that does not exist

Each series' term count comes from a search on the *measured* disagreement with
the untruncated theory over `PROBE_COUNT` epochs, which was 600. The
100,000-instant differential test measured 13–25% more than the budgets those
600 samples advertised.

The instruction was to raise it until the reported error stopped moving. **It
never stops moving**, and that is the finding. The reported error is pinned at
the budget by construction, so the observable is the term count, and it was
still climbing at 60,000 (Moon longitude 512 → 554 → 554 → 661). It cannot
converge: the residual left by dropping a tail is a sum of sinusoids whose
supremum over the span is attained on a set of measure zero, and at 100,000
draws consecutive probes are still **13.4 days apart** while the residual's
fastest components have periods of hours — three orders of magnitude below
Nyquist, permanently.

So it is anchored rather than converged: **100,000 is exactly the sample size
`DIFFERENTIAL_FULL=1` uses**, so the generator can no longer advertise a budget
that the test verifying it then exceeds, which was the whole defect. A header
figure now means "worst of 100,000 samples" and says so.

Affording that needed the truncation search rewritten. It had been a binary
search over prefixes — `log₂(n)` full evaluations per probe, resting on an
assumption the comment stated but could not enforce, that prefix error is
monotone in `k`. Because every term is independent, the error of a prefix is
*exactly* the sum of the dropped terms, so **one backward accumulation per probe
yields the error of every `k` at once**. That is ~7.5× faster and has no
monotonicity gap. Isolating the two changes — the new sweep at the old 600
probes — showed the sweep alone moves exactly one number, lunar distance from
469 terms to 465: the binary search had been keeping four terms it did not need,
which is precisely the monotonicity assumption failing.

Term counts rose 9–34%; `cold/default` 0.4154 → 0.4565 (+9.9%); bundle +23 KB;
and every body's error against DE441 improved. The number that says it worked is
the differential test's own, re-run at 100,000 instants:

| | budget | before | after |
|---|---|---|---|
| Moon longitude | 0.4″ | 0.45073″ | **0.35166″** |
| Sun longitude | 0.4″ | 0.45312″ | **0.34877″** |

Both were *outside* their stated budget when measured at the size that verifies
them. Both are now inside it.

### The planet path's own Earth, and a maximum that rose for a good reason

A geocentric planetary direction is `planet − Earth`, so it inherits Earth's
heliocentric error amplified by `r_E / Δ`. Earth's series *is* the Sun's, and its
budget had been set at 0.4″ for the Sun. The generator now emits the angular
series twice — coarse for `sun.ts`, and `EAR_L_PRECISE` / `EAR_B_PRECISE` at
≤0.1″ (273 and 22 terms) for `vsop87.ts`'s `earthRect`, which is the planet
path's only Earth read. `EAR_R` is shared, because a radius error does not
divide by Δ.

Mercury 0.499 → 0.296″, Venus 1.217 → 0.862″, and the Sun and Moon **identical
to every digit**, which is the assertion that says the split landed where it was
aimed.

**Mars went the other way, 1.142 → 1.293″**, and the prediction had called any
increase a bug — so it was measured epoch by epoch rather than argued. Mars
improved at 134 of 250 epochs and its *mean* error fell (0.1400 → 0.1367″), but
at its worst epoch (1940) the coarse Earth had been contributing +0.151″ that
**cancelled** part of Mars's own truncation error. Removing a component can raise
a maximum whenever that component was cancelling at the argmax. Venus shows the
same effect from the other side: its overall maximum fell while its *new* worst
epoch rose from 0.682″ to 0.862″.

### A hole in the harness, closed because this change would have fallen through it

`notes/dump.src.ts` contained no charts. Nothing in 241 MB of before/after output
read a planet, so a change confined to the planetary path would have produced an
empty `diff.mjs` report and looked output-neutral when it was not.

It now sweeps five nativities spanning 1912–2088 across the whole chart stack:
positions and houses, Navamsa, Shadbala, Bhava Bala, Ashtakavarga and the yoga
catalogue — the last two being *discrete*, so a benefic-point count or a yoga
name that moved would be reported at zero tolerance. The "before" side was
re-dumped with the sweep in place before the change was made.

It earned itself immediately. The worst single movement is
`navamsa.planets.5.longitude` at **2.05″** against a D1 movement of 0.228″ — a
factor of exactly nine, because Navamsa multiplies the longitude within a sign
by nine. A harness that dumped only D1 would have understated this change
ninefold.

Result: **0 invariants, 0 date/time leaves, 29 numeric leaves and every one of
them planetary.**

### Two test bounds changed instrument, and the replacement has a stated limit

`tests/unit/sections.test.ts` and `tests/perf/perf.test.ts` each asserted that
`sections: []` costs under some fraction of a full run, and that bound had been
raised twice — 0.5 → 0.62 — each time because the **denominator** improved. A
ratio cannot distinguish "narrowing got worse" from "the full call got better",
so raising it every time the library got faster was the only move available,
which is the tell that the instrument was wrong. Both are now absolute ms/day
ceilings on the narrowed call alone.

**The replacement has a limit, and it is worth stating because it was measured
rather than assumed.** Across nineteen full-suite runs during the close-out:

| | narrowed call, ms/day | outcome |
|---|---|---|
| load average ~3 | 0.384 – 0.479 | 13 runs, all green |
| load average ~11 | up to 1.093 | 6 runs, 4 with a failure |

The contention range is 2.9×, wider than the 1.5× regression the test exists to
catch, so **no absolute bound can both survive a loaded machine and catch
narrowing regressing by half**. The bound is 1.60 — 1.5× the worst observation —
and at that level it catches only a gross regression. Nor is this an argument for
going back: the *direction* assertion beside it is a ratio, immune to machine
speed by construction, and it failed once at load 11 too, reading 117%.
Contention that lands unevenly on two interleaved measurements defeats a ratio
as well. The tight measurement lives in `notes/bench-*.json`, taken one
configuration per process without contention, and that is where a change of this
size is meant to be seen.

**The contention cliff is at load ~6, not load ~11.** Re-checked at the end of
the release audit across four five-run gates — twenty full-suite runs on one
unchanged build. Three gates were 15/15 green at load 3–5. The fourth, taken
while eight stray shell loops were polling in the background at load average ~6,
failed the two absolute ceilings and the instant-mode ratio in two of its five
runs: the *minimum of twelve samples* exceeded 1.60 ms/day, a 4× inflation over
the 0.40 typical. So the range recorded above understates it — what matters is
not the load average alone but the number of processes competing with vitest's
own workers. Both test comments now say so, because "the perf test failed" is
otherwise indistinguishable from a regression.

**Two unrelated failures in the same runs were vitest's default 5-second
timeout**, not assertions: the untruncated-ELP Tier 0 sweep (250 epochs through
37,872 terms) and the ten-year festival-table packing ratio. Both are seconds of
real computation and both are deterministic, so a 5 s budget made them fail
intermittently on a busy machine — which is the worst kind of test there is.
Raised to 30 s.

### Robustness debt

- **`trig.ts` edge cases.** NaN, ±Infinity, ±0 and subnormals now agree with the
  platform where they should, and the two places they do not are pinned as
  named deviations rather than hidden by a looser comparison: `sin(-0)` returns
  `+0` (the Cody–Waite subtraction loses the sign of zero, and recovering it
  needs a branch in the hottest function in the library), and past the stated
  ~10⁵ range `sin(Number.MAX_VALUE)` is `Infinity` rather than merely
  inaccurate. Both are unreachable from a series phase; both would otherwise
  have been discovered by whoever reused the module as a general-purpose
  `Math.sin`.
- **The two new memos have purity tests.** `nutation` (16 entries) and
  `earthRect` (4) are module-level ring buffers keyed on exact float equality.
  `differential-memos.test.ts` drives each cold, warm, evicted and interleaved
  and demands one answer, checks that neighbouring arguments are not conflated —
  the bucketing failure `cache.ts` documents at length — and, for `earthRect`,
  that a hit copies out rather than aliasing the memo's storage, which no amount
  of key-exactness would catch.
- **`MOON_LATITUDE_TRACK_*` is gone.** ~6 KB the generator emitted and nothing
  imported. The reason it was never used is now in the generator beside the
  budget that replaced it, rather than only in `moon.ts`.

### Where the release actually lands

> **Superseded, and by more than a re-measurement.** The tables that stood here
> quoted a "4.3.1" column that was never measured against 4.3.1. See
> *[Step 5, third pass](#step-5-third-pass--the-baseline-the-release-notes-were-quoting-was-not-431)*
> below, which replaces every figure in this subsection. The paragraph on
> load-sensitivity and the Drik-parity result below it still stand.

**Drik parity is unchanged**: tithi 42 s, karana 49 s, nakshatra 22 s, yoga
58 s, identical to the first pass. Two value-moving ephemeris changes and a
refitted rise/set track moved it by nothing at all, which is what a Tier 1
reference publishing to the minute should do — and is the clearest statement
available that none of this session's movement is observable at the resolution
anyone publishes.

### The exposure this release ships with, stated plainly

The Sun stays at 0.3233″ because keeping the solar path on the coarse Earth
series is the point of the split. At 24 s of sankranti per arcsecond that is
**~7.8 s** on every solar transit instant. The Tula Sankranti of 2025 at
Reykjavik sits **7.13 s** from that day's sunrise — inside that bar — and
`getSankrantisForYear` publishes only the **date**, so the harness can observe
only the day flip, never the instant that causes it. It is the one place in the
release where a sub-ten-second ephemeris movement can change a published
calendar date. It is now pinned by
[`tests/validation/tier2-sankranti-day-margin.test.ts`](../tests/validation/tier2-sankranti-day-margin.test.ts),
which computes the instant itself and asserts the margin at ±2 s, with the
instruction that a failure means the day may have moved and the sankranti list
must be re-checked by hand rather than re-pinned.

---

## Step 5, third pass — the baseline the release notes were quoting was not 4.3.1

Every performance table in this release quoted a "4.3.1" column. None of those
figures came from 4.3.1. This section replaces them, and the way the error was
found is worth as much as the correction.

### The tell was the shape of the disagreement, not its size

Re-running the release-notes configurations against the **published npm
artifact** produced discrepancies of 6.4×, 10.0×, 1.4×, 6.7× — and 0.74×. A
machine that is uniformly faster or slower cannot produce ratios that scatter
over an order of magnitude *and* invert on one row. Something was different
about the software, not the hardware.

### What the column actually was

`package.json` said `4.3.1` for **seven commits after 4.3.1 was published to
npm**. Two of them are large:

| commit | what it landed |
|---|---|
| `bd58313` | Lahiri +38″, longitudes memoized on the exact instant, element transitions by secant, `precision` removed |
| `4b8905d` | Moon/Sun longitudes interpolated over Chebyshev blocks, solar rise/set canonically cached per location-day — its own message says "1.10 ms → 0.55 ms, GeoMoon calls 81 → 24" |

So "the 4.3.1 tree" and "the published 4.3.1" are different software, and the
benchmarks were run on the first while the tables were labelled with the second.
The identification takes three greps and no measurement at all: published
4.3.1's bundle still contains `precision === "high"` and a 60-second longitude
bucket (`BUCKET_MS = 6e4`), both of which those commits removed.

**And one row proves it outright rather than by inference.** The notes quote
`sections: []` at 0.4227 ms. The string `sections` does not occur *anywhere* in
published 4.3.1's bundle — the option does not exist, the argument is ignored,
and that call measures a full run at 5.98 ms. No measurement of the published
artifact could have produced 0.4227. It can only have come from a tree where
`sections` works, and the first such tree is the one Phase 36 started from.

### The three-way measurement

`notes/vcompare/driver.mjs` now runs three implementations, rotating which goes
first each repetition. Median of 11 processes per configuration per
implementation, one configuration per process. The `ctrl/*` rows — pure
arithmetic on a prebuilt chart, no ephemeris — come out at 1.00×, 0.98× and
1.02×, which is the check that says the harness measured the library and not the
machine.

**One caution the controls do not cover, found the hard way.** A `ctrl` row
coming out at 1.00× validates the *ratios*; it says nothing about the absolute
milliseconds, because contention scales both sides together. The first sweep ran
with the load average climbing from 4.2 to 7.1, and its later rows are 6–13%
high on the absolute v5 column — `warm/no-end` read 0.2661 there against
**0.1517** on the idle repeat (and 0.1548 across nine standalone processes),
which would have published `computeEndTimes: false` as 42% *slower* warm than a
full call when it is 10% faster. Every figure below is from the repeat sweep,
taken at load ~3.6, and the rule stands: a ratio survives a busy machine, an
absolute does not.

| ms/call unless noted | **4.3.1 (npm)** | HEAD tree | 5.0.0 | the notes said |
|---|---:|---:|---:|---:|
| cold default | **6.0562** | 0.9749 | 0.4105 | 0.9345 |
| cold `computeEndTimes: false` | **5.6322** | 1.2218 | 0.3913 | — |
| cold `sections: []` | **5.9773**† | 0.4209 | 0.2660 | 0.4227 |
| cold `getInstantPanchang` | **0.4344** | 0.3198 | 0.2081 | 0.3185 |
| warm default | **6.1982** | 0.6073 | 0.1677 | 0.6291 |
| `getFestivalsInRange`, ms/yr | **2177.1** | 328.18 | 130.54 | 336.1 |
| `getEkadashiDatesForYear`, ms/yr | **2362.0** | 31.54 | 18.02 | — |
| `getSankrantisForYear`, ms/yr | **153.70** | 3.419 | 3.294 | — |
| `computeSunrise`, cold | **0.0382** | 0.0612 | 0.0389 | 0.0535 |
| `getMoonrise`, cold | **0.0784** | 0.0780 | 0.0827 | 0.1436 |
| `computeShadbala` | **0.7191** | 0.1120 | 0.3330 | 0.752 |
| `computeRashiChart` | **0.0975** | 0.0968 | 0.3183 | 0.102 |

† `sections` does not exist in published 4.3.1, so that cell is a full run and
is not a like-for-like comparison. It is in the table only because it is the row
that proves the point.

Read the HEAD-tree column against the last one, row by row, because the rows
that *don't* match are as informative as the ones that do.

| quoted | reproduces as | |
|---|---|---|
| cold default 0.9345 | HEAD 0.9749 | +4.3% |
| `sections: []` 0.4227 | HEAD 0.4209 | **−0.4%** |
| `getInstantPanchang` 0.3185 | HEAD 0.3198 | **+0.4%** |
| warm default 0.6291 | HEAD 0.6073 | −3.5% |
| `getFestivalsInRange` 336.1 | HEAD 328.18 | −2.4% |
| `computeRashiChart` 0.102 | HEAD 0.0968 | −5.1% |
| `computeSunrise` 0.0535 | HEAD 0.0612 | +14% |
| `computeShadbala` 0.752 | **published 4.3.1** 0.7191 | −4.4% |
| `getMoonrise` 0.1436 | *neither* — published 0.0784, HEAD 0.0780 | — |

Six rows land within 5%, and three of them — `sections: []`,
`getInstantPanchang` and `computeRashiChart` — within half a percent, two months
later on a different day. That is the identification, and it is not a close
call.

The last two rows say something the single-baseline framing could not:
**the release notes were quoting a mixture.** `computeShadbala`'s 0.752 is
published 4.3.1 to within 0.9% — that row came from this very harness, which
does read the npm artifact — while the table above it came from the HEAD tree.
And `getMoonrise`'s 0.1436 is neither: the closest figure anywhere in the record
is **0.1467**, which
[notes/v5-step5-predictions.md](../notes/v5-step5-predictions.md) logs as
`prim/moonrise` *before this session's rise/set work* — a v5 intermediate tree.
So a single seven-row table carried three different baselines under one heading,
and the only reason any of it looked coherent is that nobody had a second column
to check it against.

### What is different about the release now that the baseline is right

**The headline gets much larger, and two rows invert.**

| vs **published 4.3.1** | | |
|---|---:|---|
| cold default | 6.0562 → **0.4105** | **−93.2%** (14.8×) |
| warm default | 6.1982 → **0.1677** | −97.3% (37.0×) |
| cold `getInstantPanchang` | 0.4344 → **0.2081** | −52.1% |
| warm `getInstantPanchang` | 0.3941 → **0.1044** | −73.5% |
| `getFestivalsInRange`, ms/yr | 2177.1 → **130.5** | −94.0% (16.7×) |
| `getEkadashiDatesForYear`, ms/yr | 2362.0 → **18.0** | −99.2% (131×) |
| `getSankrantisForYear`, ms/yr | 153.7 → **3.29** | −97.9% (46.7×) |
| `computeShadbala` / `computeBhavaBala` | 0.719 / 0.731 → **0.333 / 0.340** | −54% |
| `computeSunrise`, cold | 0.0382 → **0.0389** | **+1.8%** — the notes claimed −25.2% |
| `getMoonrise`, cold | 0.0784 → **0.0827** | **+5.5%** — the notes claimed −39.0% |
| `computeRashiChart` / `computeNavamsa` | 0.0975 / 0.0944 → **0.318 / 0.314** | **+226% / +233%** |

| vs the **pre-Phase-36 tree** — what the exit criteria were written against | | |
|---|---:|---|
| cold default | 0.9749 → **0.4105** | −57.9% |
| cold `sections: []` | 0.4209 → **0.2660** | −36.8% |
| cold `getInstantPanchang` | 0.3198 → **0.2081** | −34.9% |
| warm default | 0.6073 → **0.1677** | −72.4% |
| `getFestivalsInRange`, ms/yr | 328.2 → **130.5** | −60.2% |
| `computeShadbala` | 0.1120 → **0.3330** | **+197%** |
| `computeRashiChart` | 0.0968 → **0.3183** | **+229%** |

The two inverted rows were confirmed twice — a standalone median-of-7 run
(moonrise 0.0769 / 0.0767 / 0.0821, sunrise 0.0380 / 0.0610 / 0.0389 across
published / HEAD / 5.0.0) and the full repeat sweep above. The −25% and −39%
the notes claimed are real
improvements **over the HEAD tree**, where 36.1's canonical rise/set cache had
made a standalone cold primitive 60% more expensive; against what users have,
a single cold rise/set call is unchanged to within a few percent. The win that
cache buys is on the *repeated* day, and a cold primitive benchmark is precisely
the shape that cannot see it.

Rows excluded rather than quietly compared: every `sections: []` configuration
(the option does not exist in 4.3.1), and `computeBhava` (it computes the full
planetary set in 5.0.0 and in the HEAD tree, and does not in published 4.3.1 —
0.0044 ms against 0.31 is not a regression, it is different work).

### The chart stack is slower, and against the pre-Phase-36 tree it is slower still

`computeRashiChart` 0.0975 → **0.318 ms** and `computeNavamsa` 0.0944 →
**0.314**, a 3.3× regression that is **entirely** the planetary ephemeris and is the
deliberate trade for Mercury 6.504″ → 0.296″ and Venus 19.586″ → 0.862″ against
DE441. That is priced and defensible: a chart consumer pays a fifth of a
millisecond and stops carrying a 6.5″ Mercury.

What the three-column view adds is that the trade is wider than it looked.
Against **published 4.3.1** `computeShadbala` improves 2.2× (0.719 → 0.333).
Against the **HEAD tree** it regresses 3× (0.112 → 0.333), because the unshipped
perf commits had already taken it from 0.72 to 0.11. Both statements are true;
the first is what an upgrading user experiences and the second is what the phase
did. Stated together because quoting only the first would be the same class of
error this section exists to correct.

### Which baseline the release notes quote, and why

**Published 4.3.1 is the headline, with the HEAD tree kept as a named second
column.** The reasoning:

- A release note answers "what do I get if I upgrade", and what users have is
  the npm artifact. Quoting a tree that was never published is quoting a number
  no reader can reproduce — which is the entire defect, independently of whether
  the number flatters the release.
- But the exit criterion "default call roughly halved (0.93 → ~0.47)" was
  *written against* the HEAD tree, and deleting that column would leave the
  phase's own pass/fail unauditable. It is kept, labelled as what it is: git
  HEAD, unpublished, the tree Phase 36 started from.

Against that column the criterion passes on a reproducible basis for the first
time: **0.9749 → 0.4105, −57.9%**, past halved rather than 3.9% inside it.

### A note on the load-sensitivity caveat, which did not survive contact

The second pass made much of `cold/default` reading 0.4518 at load average 3.3
and 0.5023 at load 5–6, and warned that the absolute figure was load-sensitive
by more than the margin it cleared. The first sweep measured **0.4173** with the
load average climbing from 4.2 to 7.1, and the repeat at load ~3.6 measured
**0.4105** — a 1.6% spread, and the busier run was the *faster* one. The
caveat's direction does not reproduce, and the conclusion to draw is the one the
harness README already gives: **read the ratio**, which is taken interleaved and is immune to
this by construction, and treat any absolute millisecond figure as carrying its
machine. It is quoted here with the machine attached and nothing is built on it.

PLAN.md §36.1 sets an explicit gate after the structural wins:

> *Re-profile after 36.1. If the ephemeris has dropped to a few percent of
> runtime, the performance case for 36.2+ is gone and the decision becomes
> purely about independence and bundle size — decide it on those terms,
> honestly.*

Method: `notes/prof/` — a 4,000-day calendar scan (`getDailyPanchang`, all
sections, Pune) under `node --cpu-prof`, with `astronomy-engine` kept external so
self time can be attributed by source file. Same shape as `notes/v5-audit.md`
§1.0. Call counts come from an esbuild alias that swaps `astronomy-engine` for a
counting shim, so no library code is touched.

### Ephemeris calls per day — the structural wins, measured

| primitive | audit baseline | after 36.1 | |
|---|---|---|---|
| `GeoMoon` | 21.5 | **2.55** | 8.4× fewer |
| `SunPosition` | 29.1 | **1.06** | 27× fewer |
| `Ecliptic` | 21.5 | **2.55** | 8.4× fewer |
| `SearchRiseSet` | 4.6 | **4.64** | **unchanged** |

Also visible now: `SearchMoonPhase` 2.08/day and `MoonPhase` 1.04/day, from the
Chandra Masa lunation bounds.

### Self time — the gate answer

| component | audit baseline | after 36.1 + 38.1 |
|---|---|---|
| `astronomy-engine` | 84.8% | **86.4%** |
| our own code | ~6% | 10.6% (of which `formatInZone` 2.6%, new in 38.1) |
| GC | 1.3% | 2.2% |

Within `astronomy-engine`:

| | share of total self time |
|---|---|
| Moon theory — `AddSol` 34.9, `CalcMoon` 8.9, `DeclareArray2` 3.1, `ADDN` 3.0, `Sine` 2.3, `GeoMoon` 2.5, `DeclareArray1` 1.2 | **~56%** |
| Sun — `VsopFormula` 15.4, `HelioVector` 0.6, `VsopSphereToRect` 0.6 | **~17%** |
| frame conversions — `iau2000b` 1.5, `precession_rot` 1.3, `nutation_rot` 0.7 | ~3.5% |

**Verdict: the gate does not close. The ephemeris has not dropped to a few
percent — it is still 86% of self time, and the performance case for 36.2+ is
fully intact.**

### But the profile changes *which* sub-phase carries the win

At ~0.98 ms/day, the ~56% Moon share is ~0.55 ms/day, which at
`astronomy-engine`'s measured 7.9 µs per full Moon evaluation implies **~65 Moon
evaluations per day**. We make only **2.55** direct `GeoMoon` calls. The other
~62 are internal to the searches: `SearchRiseSet` at 4.64/day × 10.7 evaluations
each ≈ 50, plus `SearchMoonPhase` and `MoonPhase`.

So the remaining cost is **not** the longitude series being called by us — 36.1
already cut that by 8×. It is the *solvers* calling the series. Two consequences
worth stating plainly, because they cut against the obvious reading of the plan:

1. **36.2 (own Sun + Moon series) buys approximately zero performance.**
   Replacing an equally-accurate series with our own is the same arithmetic. Its
   case is independence and bundle size, exactly as §36.1's gate anticipated —
   just for the opposite reason (the ephemeris is still dominant, but *this*
   part of it is irreducible).
2. **36.3 (own rise/set + phase search) is where the ~56% lives**, and it needs
   **no new theory at all** — an interpolant fitted over `astronomy-engine`'s own
   series would do. This is 36.1 item (b) generalised: turn ~62 series
   evaluations per day into ~62 polynomial evaluations. Ceiling if rise/set and
   phase search were fully interpolated: roughly **−40% on a cold default call**.

This does not license doing 36.3 before the Step 4 harness exists — §36.0 H
still governs, and a rise/set solver is still new ephemeris code. It does say
that when Step 5 begins, **36.3 should come before 36.2** if the goal is
performance, and 36.2 should be argued on independence alone.


### Decisions taken on this evidence (reviewer, 2026-08-06)

**1. Step 5 keeps the plan's order: 36.2 → 36.3 → 36.4 → 36.5.**

I had recommended 36.3 first, on the grounds that it carries the entire ~56%
and needs no new theory. The reviewer chose plan order, and the reasoning that
settles it is one I under-weighted: because v5 now waits for the *full* port
(decision 2), an interpolant built in 36.3 over `astronomy-engine`'s series
would have to be rebuilt and re-validated over our own series once 36.2 landed.
Doing 36.2 first means the interpolant is built once, over the series that
ships. The performance win simply arrives at the end of the sequence instead of
the start.

Recorded consequence, so nobody re-litigates it mid-phase: **36.2 will show
essentially no runtime improvement when measured on its own.** That is expected
and is not a failure of the module. Its case is independence and bundle size.
Do not tune it chasing a speedup that the profile says is not there — the win is
36.3's, and it is ~40% of a cold call.

**2. v5 is held until the ephemeris port lands.** No interim publish. The
release will carry the performance work, the table/compute API, the corrected
`Date` contract *and* zero dependencies. Consequence: the 38.1 Date-contract fix
— the single largest correctness-of-contract issue in the public API — stays
unshipped for the 3–6 weeks the port takes. Accepted deliberately, recorded so
the cost is visible.
