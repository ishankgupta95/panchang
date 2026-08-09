# Step 5 — fixture-movement predictions, written before the suite was run

PLAN.md §36.0 E and [tests/TIERS.md](../tests/TIERS.md): *write down the expected
fixture movement first, from the sensitivity coefficients, then run the suite.*
Movement that matches → legitimate re-pin. Movement that is larger, or that
touches something the error budget says cannot move → a bug, not an improvement.

This file is the "first" half. It is written from measurements that exist before
any fixture has been re-run, and is not edited afterwards — the observed column
is filled in below it.

## Sensitivity coefficients used (tests/TIERS.md)

| quantity | coefficient |
|---|---|
| Moon longitude | δ″ ⇒ δ × 1.82 s of tithi / karana / nakshatra boundary movement |
| Sun longitude | δ″ ⇒ δ × 24 s of sankranti movement |
| yoga | carries Moon + Sun; rate 0.590°/hr ⇒ (δ_moon + δ_sun)″ × 1.69 s |
| ΔT | δ s ⇒ δ s on any longitude-crossing time; δ × 0.003 s on sunrise |

---

## 36.2 — own Sun + Moon series

### Inputs to the prediction, all measured before the suite ran

| | max″ | mean″ | bias″ |
|---|---|---|---|
| Sun, `astronomy-engine` vs DE441 | 1.613 | 0.519 | −0.148 |
| Sun, own (shipped) vs DE441 | 0.161 | 0.064 | +0.019 |
| Moon, `astronomy-engine` vs DE441 | 3.747 | 0.884 | +0.296 |
| Moon, own (shipped) vs DE441 | 1.279 | 0.379 | +0.379 |
| own ΔT vs `astronomy-engine`'s ΔT, 100k instants | — | — | < 0.05 s |

### What must **not** move

- **Every rise/set time, and everything derived from one.** `SearchRiseSet` is
  still `astronomy-engine`'s in 36.2 — it carries its own internal ephemeris and
  does not read `sun.ts` or `moon.ts`. Sunrise, sunset, moonrise, moonset and
  every day-proportional window (Rahu Kalam, Choghadiya, Hora, Gowri, …) are
  therefore bit-identical. **Any movement here is a bug.**
- **Every planetary longitude.** `GeoVector` is untouched until 36.4.
- **Every ayanamsa value.** `computeAyanamsa` is our own polynomial and is not
  in the diff.
- **Every index, name, boolean, count and festival date** (TIERS.md, invariant
  half). The shifts below are seconds; an index at sunrise changes only if a
  boundary sat within seconds of sunrise. If one moves it is a boundary case to
  be explained, not re-pinned.

### What is expected to move, and by how much

The two implementations differ at a given instant by at most the sum of their
errors and typically by the quadrature of their rms:

| | worst-case δ | typical δ |
|---|---|---|
| Moon longitude | 5.0″ | ~1.2″ |
| Sun longitude | 1.8″ | ~0.6″ |

| fixture family | predicted typical | predicted worst |
|---|---|---|
| tithi end times | ~2 s | ~9 s |
| karana end times | ~2 s | ~9 s |
| nakshatra end times | ~2 s | ~9 s |
| yoga end times | ~3 s | ~11 s |
| sankranti instants | ~15 s | ~43 s |
| moon-phase instants (new/full) | ~2 s | ~9 s |
| everything rise/set-derived | **0** | **0** |

Two systematic components sit inside those numbers and are worth separating,
because they move every fixture the same way rather than scattering it:

1. **Lunar light-time, −0.706″.** Retarding the Moon lowers its longitude, so
   every tithi, karana and nakshatra boundary arrives **later** by
   0.706 × 1.82 = **1.29 s**. This is a floor on the movement, not part of the
   scatter.
2. **ΔT, ≤0.05 s.** Below the noise; listed only so it is not later mistaken for
   something else.

### Drik parity (Tier 1)

Expected to improve slightly or stay flat. Our positions move toward DE441 by
~0.5″ (Sun) and ~0.5″ (Moon) in the mean, which is ~1 s of end-time — an order
of magnitude below Drik's own minute-level quantisation. The exit criterion is
"no worse than the current ≤60 s worst-case drift"; a *material* improvement
would itself be surprising and worth investigating.

---

## Prediction — the 30-second bisection tolerance

Written before the change, as §36.0 E requires.

### Scope, corrected by reading

The finding recorded below named three sites. Reading them turned up a
different set of four:

| site | 30 s bisection? | reached? |
|---|---|---|
| `src/core/varjyam.ts` — `findNakshatraStart`, `findNakshatraEnd` | yes | **yes** |
| `src/core/panchakaRahita.ts` — `bisectBoundary` | yes | **yes** |
| `src/core/bhadra.ts:133` | yes | **yes** — missed in the original finding |
| `src/utils/search.ts` — `STANDARD_PRECISION.toleranceMs` | yes | **no** |

`search.ts`'s 30 s is the *fallback* tolerance for `findTransitionTime` and
`findStartTime`, and every caller in `panchang.ts` supplies an `ElementAngle`,
so the secant path is taken instead — measured at 0 declines in 85,445 attempts.
Tightening it would change nothing. It is left alone, and the reason is now
written where someone would otherwise "fix" it.

### The shape of the movement

Bisection narrows `[lo, hi]` until `hi − lo ≤ 30 s` and returns **`hi`**. So
every one of these boundaries is currently the true boundary rounded *up*: late
by 0–30 s, never early. Replacing it with the secant solve that the element
end-times already use lands within 25 ms.

The movement is therefore **one-directional**:

| fixture family | predicted |
|---|---|
| `varjyam.start` | 0–30 s **earlier** |
| `varjyam.end` | 0–32 s earlier — the extra 2 s is `4/60 × 30 s`, the window being 4 ghatikas of a nakshatra whose measured duration also shifts |
| `bhadra.start`, `bhadra.end` | 0–30 s earlier |
| `panchakaRahita.start`, `.end` | 0–30 s earlier |
| everything else | **0** |

"Everything else" is the load-bearing half: tithi, nakshatra, yoga and karana
end-times already solve by secant and must not move at all, nor may any rise/set
time, index, name, boolean, count or festival date.

### Cost

Predicted **negative** — this should be faster, not slower. Bisecting a 30-hour
lookback to 30 s takes ~12 probes; the secant solve converges in ~5 plus one
forward-walk step. Tightening the tolerance *without* switching solvers would
have been the expensive option (~15 further probes), which is the reason not to
do it that way.

## Observed — the 30-second bisection tolerance

Before/after `notes/dump.sh` over the same 6 locations × 320 days × 5 option
shapes, with the pre-change behaviour reconstructed exactly (30 s bracket, solve
bypassed) rather than approximated.

| fixture family | predicted | **observed max** | direction |
|---|---|---|---|
| `varjyam.start` | 0–30 s earlier | **25.824 s** | earlier ✅ |
| `varjyam.end` | 0–32 s earlier | **25.955 s** | earlier ✅ |
| `panchakaRahita.start` | 0–30 s earlier | **20.613 s** | earlier ✅ |
| `panchakaRahita.end` | 0–30 s earlier | **20.984 s** | earlier ✅ |
| `bhadra.start` | 0–30 s earlier | **15.798 s** | earlier ✅ |
| `bhadra.end` | 0–30 s earlier | **15.813 s** | earlier ✅ |
| invariants | 0 | **0** | ✅ |
| every other numeric leaf | 0 | **0 distinct leaves** | ✅ |

Every changed value moved **earlier**, with no exceptions — which is the
prediction's sharpest claim, and the one that would have been easiest to get
wrong. Bisection's error is one-sided because it returns the upper bracket; if
the movement had been two-sided, the diagnosis would have been wrong.

The maxima are also the tell that closes the 36.2 finding. Compare:

| | movement under 36.2 (ephemeris changed) | movement here (tolerance changed) |
|---|---|---|
| varjyam | 26.4 s | 25.96 s |
| panchakaRahita | 21.1 s | 20.98 s |
| bhadra | 15.8 s | 15.81 s |

They are the same numbers. Those windows were never moving by an amount related
to the ephemeris at all — they were moving by their own quantisation, and a
6.4 s nakshatra shift was merely enough to knock each of them onto a different
30-second grid point.

### Cost — measured in isolation, 9 repetitions per configuration

| configuration | 30 s bisection | secant | delta |
|---|---|---|---|
| cold/default | 0.9423 ms | 0.9446 ms | +0.24% |
| cold/no-festivals | 0.9364 ms | 0.9393 ms | +0.31% |
| cold/all+no-end | 0.9326 ms | 0.9323 ms | −0.03% |
| `getFestivalsInRange`, ms/yr | 322.59 | 321.94 | −0.20% |

Both signs, all inside the 2–3% run-to-run spread: **free**. The prediction said
it should be slightly *faster*, and that was too optimistic — the bracketing
bisection still runs (to 120 s rather than 30 s, ~8 probes) before the secant's
~5, so the probe count is a wash rather than a saving. What it buys is a 1200×
accuracy improvement, from 30 s to ≤25 ms, at no measurable cost.

---

## Observed — 36.2

Source: `notes/dump.sh` before/after over 6 locations × 320 days × 5 option
shapes spanning 1912 / 2025 / 2088, plus full-year festival, ekadashi and
sankranti listings (241 MB each side), classified by `notes/diff.mjs`.

| fixture family | predicted worst | **observed worst** | verdict |
|---|---|---|---|
| tithi end times | ~9 s | **6.778 s** | inside |
| karana end times | ~9 s | **6.847 s** | inside |
| nakshatra end times | ~9 s | **6.417 s** | inside |
| yoga end times | ~11 s | **6.028 s** | inside |
| sankranti instants | ~43 s | **35.9 s** | inside |
| rise/set and everything derived from one | 0 | **0** | as predicted |
| planetary longitudes | 0 | **0** | as predicted |
| indices, names, booleans, counts | 0 | **0** | as predicted |

Suite: 8,315 of 8,321 passing. The six failures are four Bhava Bala fixtures in
their 4th decimal and two pinned yoga-transition instants in
`edge-cases.test.ts`, moved by 1.416 s — all numeric-tolerance, all inside
prediction.

### Three things the prediction did not cover, found by measuring

**1. `diff.mjs` was mis-classifying every legitimate time shift as an invariant
break.** Its ISO regex only matched the `…Z` form, so Phase 38.1's
offset-bearing `*Local` strings (`…+05:30`) fell through to the string branch —
45,506 spurious "invariants" on the first run, which is precisely the signal the
harness exists to make trustworthy. Fixed here: offset-bearing instants are
compared as instants, and a changed *offset* is still an invariant break.
After the fix the count is **0**. Reports produced between Phase 38.1 and now
should be read with this in mind.

**2. One festival date moved — and it is a knife-edge, not a regression.**
The Tula Sankranti of 2025 at Reykjavik, and the two festival entries derived
from it:

| | instant | vs that day's sunrise |
|---|---|---|
| Reykjavik sunrise, 2025-10-17 | 08:24:46.193 UTC | — |
| Tula sankranti, `astronomy-engine` | 08:25:15.684 UTC | **+29.5 s** → Oct 17 |
| Tula sankranti, own ephemeris | 08:24:39.759 UTC | **−6.4 s** → Oct 16 |

The transit moved 35.9 s, inside the 43 s predicted, and happened to be sitting
29 s from a day boundary. The rule did not change; the ephemeris moved toward
DE441. Which day is *correct* is genuinely undecidable from here: the transit
now sits 6.4 s before sunrise against our own 3.9 s worst-case solar error, and
sunrise at 64 °N — where the Sun climbs at a shallow angle — carries more
uncertainty than that from the refraction model alone. Reported rather than
re-pinned; no fixture pins it, and it is the only invariant-class change in
241 MB of output.

**3. Varjyam, Bhadra and Panchaka Rahita move ~4× more than the elements they
are derived from**, and it is not the ephemeris. `findNakshatraStart` /
`findNakshatraEnd` in `varjyam.ts`, `panchakaRahita.ts` and the default in
`utils/search.ts` all bisect to `TOL_MS = 30_000` — a **30-second** tolerance.
So those windows are quantised to a 30 s grid and jump a whole step whenever
anything upstream moves at all: observed 26.4 s (varjyam), 21.1 s (panchaka
rahita), 15.8 s (bhadra) against a 6.4 s nakshatra shift. Pre-existing, not
introduced here — the element end-times themselves go through `secantBoundary`,
which `tier0-crosschecks.test.ts` measures at ≤24 ms. Recorded as a finding.

---

## Prediction — 36.5 (eclipses) and the Phase 36 performance work

Written 2026-08-07, before the suite was re-run. Four changes land between the
36.2/36.3/36.4 observations above and the final re-pin, and they have very
different fixture footprints, so they are predicted separately.

### 36.5 — own eclipse geometry

`astronomy-engine`'s `SearchLunarEclipse` / `SearchLocalSolarEclipse` are
replaced by `src/astronomy/eclipseGeometry.ts`. This is a **reimplementation,
not a re-tuning**, so unlike everything above it is not expected to be
output-neutral anywhere the eclipse surface is read.

| fixture family | predicted |
|---|---|
| `eclipse.start` / `.peak` / `.end` | **seconds to minutes.** Lunar contacts were previously `peak ± semi-duration` from a different theory; they are now solved individually against a Danjon-enlarged shadow. Solar contacts come from a direct topocentric solve rather than Besselian elements. |
| `eclipse.sutakStart` / `.sutakEnd` | same, being offsets of the above |
| `eclipse.magnitude` | ~0.001, the obscuration formula being identical in both |
| `eclipse.subtype` | **0 changes.** Type is an invariant (TIERS.md). Tier 0 says 0 mismatches in 457 lunar + 380 in-scope solar rows; a change here is a bug. |
| every non-eclipse field | **0.** Nothing else imports the eclipse module. |
| festival dates | **0.** No festival is derived from an eclipse. |

The asymmetry of the umbral contacts about greatest eclipse — 0 by construction
before, ~2 s now — is a **result-shape** change, not a numeric one, and it is
why one assertion in `tests/unit/eclipse.test.ts` is rewritten rather than
re-pinned.

### Nutation by angle addition

Predicted **exactly zero** movement in any published value. The rewrite folds
each term's integer multipliers together instead of calling `Math.sin` per
term; the residual is floating-point rounding over ≤6 additions, bounded by
~10⁻¹⁵″. Against the 1.82 s/arcsec lunar coefficient that is 10⁻¹⁵ s.

Any movement above the last ULP of a reported instant is a bug, not a re-pin.
Asserted directly at 10⁻⁹″ over 100,000 instants in
`differential-ephemeris.test.ts`.

### Planet light-time: three passes → two, Earth memoized

Predicted movement on **planetary longitudes only**, of order **10⁻⁴″**.

The reasoning, before measuring: the second pass previously read the Earth at
`t − τ₀` and now reads it at `t`. Over Saturn's τ₀ ≈ 0.028 d the Earth moves
0.0005 AU, which changes |P − E| by ~6 × 10⁻⁵ of itself, so the converged τ
shifts by ~0.15 s. Saturn's apparent motion is 0.0014″/s, giving 2 × 10⁻⁴″.
Every other body is closer and moves less.

So the **Tier 0 planetary maxima must not move at their fourth decimal**:
Mercury 0.327, Venus 0.824, Mars 1.626, Jupiter 0.899, Saturn 0.864. The Earth
memo is keyed on exact bitwise equality of `ttDays` and is therefore not
expected to move anything at all.

`isRetrograde` is a boolean and may not change. The two probes stay at ±1 h and
stay two-sided.

### Relaxing the truncation budgets — `sunLon`/`sunLat` 0.1″ → 0.4″, `moonLon` 0.2″ → 0.4″

This is the one that moves published values, and the prediction is the point.

**Inputs.** Measured before the change, 2026-08-07, over the 250-epoch Horizons
fixture:

| | truncation budget | measured truncation | max vs DE441 | untruncated reference |
|---|---|---|---|---|
| Sun | 0.1″ | 0.0987″ (219 of 1080 Earth-L terms) | **0.1613″** | 0.115″ |
| Moon | 0.2″ | ~0.2″ (784 of 37,872 terms) | **1.2790″** | 1.287″ |

**Predicted new Tier 0 maxima.** Truncation and theory error are independent, so
the honest bracket is between quadrature and a worst-case sum:

| | quadrature | worst case | ceiling | verdict if met |
|---|---|---|---|---|
| Sun | √(0.115² + 0.4²) = **0.42″** | 0.52″ | 1.613″ | 3.1–3.8× inside |
| Moon | √(1.287² + 0.4²) = **1.35″** | 1.69″ | 3.747″ | 2.2–2.8× inside |

**Back the budget off if the Sun lands above 0.6″** — 3× margin is the floor,
and 0.6″ is where that is spent.

**Predicted fixture movement.** The *change* in each longitude is bounded by the
old truncation plus the new, since the two residuals are unrelated:
Moon ≤ 0.6″, Sun ≤ 0.5″. Typical values are well under half that.

| fixture family | predicted typical | predicted worst |
|---|---|---|
| tithi / karana / nakshatra end times | ~0.5 s | **1.1 s** (0.6″ × 1.82) |
| yoga end times | ~0.9 s | **1.9 s** ((0.6 + 0.5)″ × 1.69) |
| sankranti instants | ~5 s | **12 s** (0.5″ × 24) |
| moon-phase instants | ~0.5 s | 1.1 s |
| sunrise / sunset | ~0.02 s | **0.05 s** — 0.5″ of solar longitude against a 15″/s altitude rate |
| moonrise / moonset | ~0.03 s | **0.06 s** |
| everything rise/set-proportional (Rahu Kalam, Choghadiya, Hora, Gowri, …) | ~0.03 s | 0.06 s |
| varjyam / bhadra / panchakaRahita | ~0.5 s | 1.1 s — they now follow the nakshatra rather than a 30 s grid |
| **indices, names, booleans, counts, festival dates** | **0** | **0** |

Note the contrast with 36.2, where rise/set movement was predicted at exactly
zero because `SearchRiseSet` was still external. It is ours now, so it moves —
by tens of milliseconds, which is 20× smaller than the ≤25 ms the secant solver
itself contributes and 1000× smaller than the element end-times move.

**Drik parity (Tier 1).** Expected flat. 1.1 s against a ≤60 s worst-case drift
that is dominated by Drik publishing to the minute. A *material* change either
way would be surprising and worth investigating rather than accepting.

**Predicted cost.** The lunar longitude series is 47.9% of self time after 36.5
(`sumQuartic` 24.1% + `sumLinear` 23.8%, measured). Halving the term count
should therefore be worth ~20% of a cold call, and the Earth-L series another
~3%. Predicted `cold/default` **0.655 → ~0.52 ms**, which is short of the
0.47 ms exit criterion — so this step alone is not expected to close it.

---

## Observed — the Phase 36 performance work and 36.5

### 36.5 — own eclipse geometry

Not measured by `notes/diff.mjs`: the pre-36.5 tree could not be reconstructed
once `eclipse.ts` had been rewritten in place, so there is no "before" dump for
this change alone. That is stated rather than worked around, and the substitute
is stronger than a self-comparison would have been —
`tests/validation/tier0-own-eclipses.test.ts` measures the new geometry against
**NASA/Espenak directly**, over 457 lunar rows, 452 geocentric solar rows and
788 local circumstances at 10 cities:

| | measured |
|---|---|
| lunar type (457 rows) | **0 mismatches** |
| lunar greatest eclipse | max 3.84 s TT, median 0.88 s |
| lunar penumbral / umbral magnitude | max 0.0003 / 0.0005 |
| lunar penumbral / partial / total duration | max 1.00 / 0.40 / 0.91 min |
| solar gamma (452 rows) | max **0.00015** Earth radii — 1.5 in the last digit NASA prints |
| solar greatest eclipse | max 2.58 s TT |
| solar type at the greatest-eclipse point (378 in-scope rows) | **0 mismatches** |
| solar local contact times, 1901–2002 | bias **−0.75 s**, max 43.1 s |
| solar local contact times, 2003–2100 | bias +16.6 s — a ΔT-model difference, see below |
| Sun altitude / azimuth at maximum | max 0.594° / 0.651° (printed to the degree) |
| local magnitude / obscuration | max 0.0022 / 0.0029 (printed to 3 decimals) |

One prediction was **wrong and the correction is a finding**: the 2% enlargement
of the lunar shadow *radii* is not the convention the canon uses. Inverting all
457 published magnitudes for the enlargement each implies gives a 2%-on-radii
multiplier that is not constant (1.0137 umbra against 1.0080 penumbra) and a
Danjon-on-Earth-radius multiplier that is (1.00989 and 1.01016), both landing on
1 + 1/85 − 1/594. Before the correction, penumbral magnitude carried a +0.028
bias and **two eclipses were mis-typed**; after it, 0.0003 and zero.

### Nutation by angle addition

| | predicted | observed |
|---|---|---|
| max \|Δψ\|, \|Δε\| over 100,000 instants | ~10⁻¹⁵″, bounded at 10⁻⁹″ | **passes at 10⁻⁹″** |
| published values | 0 | 0 |

### Planet light-time: three passes → two

| Tier 0 max″ vs DE441 | before | after |
|---|---|---|
| Mercury | 0.3268 | 0.3268 |
| Venus | 0.8240 | 0.8240 |
| Mars | 1.6261 | 1.6261 |
| Jupiter | 0.8990 | 0.8990 |
| Saturn | 0.8633 | 0.8633 |

Unchanged to four decimals, as predicted (the movement was predicted at ~10⁻⁴″).

### Relaxing the truncation budgets — the one that moves published values

**Tier 0.** Predicted from quadrature of theory and truncation; observed over the
same 250 Horizons epochs:

| | predicted (quadrature / worst) | **observed** | ceiling | margin |
|---|---|---|---|---|
| Sun | 0.42″ / 0.52″ | **0.4196″** | 1.613″ | 3.8× |
| Moon | 1.35″ / 1.69″ | **1.3448″** | 3.747″ | 2.8× |

Both land on the quadrature figure to the second decimal.

**Not predicted, and it should have been: the planets moved too.** Mercury
0.327 → 0.499″ and Venus 0.824 → 1.217″, with their own budget untouched. A
geocentric planetary direction is `planet − Earth`, so it inherits Earth's
heliocentric error, and Earth's budget is the *Sun's* budget. The size checks
out from geometry rather than hindsight — 0.363″ of new Earth-L truncation
subtends 0.66″ at Mercury (Δ_min 0.55 AU) and 1.34″ at Venus (0.27 AU), giving
0.74″ and 1.22″ in quadrature with what was there. Venus lands on that exactly.
Every body stays 7–16× inside its §36.0 D ceiling, so this is accepted and
recorded rather than reverted; the lesson is that a per-body error budget hides
the coupling through the observer.

**Fixture movement**, from `notes/dump.sh` before/after over 6 locations × 320
days × 5 option shapes spanning 1912 / 2025 / 2088, plus the full-year festival,
ekadashi and sankranti listings — 241 MB each side, classified by
`notes/diff.mjs`:

| fixture family | predicted worst | **observed worst** | verdict |
|---|---|---|---|
| tithi / karana end times | 1.1 s | **776 ms** | inside |
| yoga end times | 1.9 s | **569 ms** | inside |
| nakshatra end times | 1.1 s | **368 ms** | inside |
| varjyam / panchakaRahita / bhadra | 1.1 s | 338 / 316 / 776 ms | inside |
| eclipse contacts | — | 149–592 ms | — |
| sunrise / sunset-proportional windows | 50–60 ms | **20–94 ms** | at the edge — 94 ms is Reykjavik, 64 °N, where the Sun's shallow approach amplifies everything |
| moonrise / moonset | 60 ms | 33 / 45 ms | inside |
| Sun sidereal longitude | ≤0.5″ | **0.269″** | inside |
| Moon sidereal longitude | ≤0.6″ | **0.193″** | inside |
| **invariants — index, name, boolean, count, festival date** | **0** | **0** | ✅ |

**The Reykjavik knife-edge held.** 36.2 left the Tula Sankranti of 2025 sitting
6.4 s before sunrise there, a day-boundary case that could flip either way. The
sankranti lists for all six locations are byte-identical across this change, so
the further ~6 s of solar movement did not flip it back.

**Drik parity (Tier 1)**, measured on `drikpanchang-verified.json`:

| element | before | after |
|---|---|---|
| tithi | 46 s | **42 s** |
| karana | 51 s | **49 s** |
| nakshatra | 24 s | **22 s** |
| yoga | 60 s | **58 s** |

Marginally better on every element, which on five fixtures is not a claim of
improvement — it is the "no worse than the current ≤60 s" exit criterion met,
with no sign of the degradation a 1 s ephemeris shift could in principle have
caused.

**Bhava Bala.** Predicted ≤0.005 V with no discrete quantity moving; observed
max **0.0009 V** (Narendra Modi, house 11, 462.8016 → 462.8025), worst relative
movement 1.6 × 10⁻⁵ — the same magnitude as the previous re-pin, and re-pinned
once for the whole of Phase 36 rather than after each sub-phase.

---

## Prediction — `PROBE_COUNT` 600 → larger, and the regeneration it forces

Written 2026-08-07, before the generator was re-run, as §36.0 E requires.

### What is changing, and why it moves anything at all

`notes/ephemeris-generate.src.ts` finds each series' term count by binary search
on the **measured** worst disagreement with the untruncated series over
`PROBE_COUNT = 600` pseudo-random epochs. A 600-sample maximum understates the
true maximum, and by a measured amount — `DIFFERENTIAL_FULL=1` over 100,000
instants reports:

| | generator says (600) | measured (100,000) | ratio |
|---|---|---|---|
| Moon longitude | 0.398″ | 0.45073″ | 1.132 |
| Sun longitude (Earth L) | 0.363″ | 0.45312″ | 1.248 |

Raising the probe count makes the search see that tail, so each series must keep
**more** terms to stay inside the same budget. Nothing about the budgets changes;
what changes is that the number printed beside them becomes true.

### Predicted term counts

The error-vs-prefix curve for these series is close to geometric: the last
budget change halved the Moon's longitude term count (784 → 512) for a doubling
of its budget (0.2″ → 0.4″), which is ~272 terms per factor of two. Recovering a
factor of 1.132 therefore costs `272 × log₂(1.132) ≈ 48` terms, and 1.248 costs
`≈ 87` on whatever the Earth's own slope is.

| series | now | predicted | predicted growth |
|---|---|---|---|
| `MOON_LONGITUDE_*` | 512 | 545–570 | +6–11% |
| `MOON_LATITUDE_*` | 360 | 380–400 | +6–11% |
| `MOON_DISTANCE_*` | 469 | 495–520 | +6–11% |
| `EAR_L` | 108 | 120–140 | +11–30% |
| every other series | — | +5–15% | — |

**Larger than +30% on any series is not a bigger tail, it is a bug** — most
likely the probe generator degenerating (it is a 32-bit LCG, and 20,000 draws is
well inside its period, but that is the thing to check first).

### Predicted movement in published values

The new series is a **longer prefix of the same sorted term list**, so the change
in any longitude is exactly the sum of the newly-added terms, bounded by the old
truncation residual:

| | bound on δ |
|---|---|
| Moon longitude | ≤ 0.9″ worst, ~0.2″ typical |
| Sun longitude | ≤ 0.9″ worst, ~0.15″ typical |

Applying the TIERS.md coefficients:

| fixture family | predicted typical | predicted worst |
|---|---|---|
| tithi / karana / nakshatra end times | ~0.4 s | **1.7 s** (0.9″ × 1.82) |
| yoga end times | ~0.6 s | **3.0 s** ((0.9 + 0.9)″ × 1.69) |
| sankranti instants | ~3.6 s | **21.6 s** (0.9″ × 24) |
| moon-phase instants | ~0.4 s | 1.7 s |
| sunrise / sunset | ~0.01 s | **0.06 s** |
| moonrise / moonset | ~0.02 s | 0.09 s |
| rise/set-proportional windows | ~0.02 s | 0.09 s |
| varjyam / bhadra / panchakaRahita | ~0.4 s | 1.7 s |
| **indices, names, booleans, counts, festival dates** | **0** | **0** |

### Predicted Tier 0 — everything should get *slightly better*

Truncation is one leg of a quadrature with theory error, and it is the leg that
shrinks. Predicted to move by less than 0.01″, and **in the improving
direction**; a body that gets *worse* is a bug.

| | now | predicted |
|---|---|---|
| Sun | 0.4196″ | 0.410–0.420″ |
| Moon | 1.3448″ | 1.340–1.345″ |
| Mercury | 0.499″ | 0.48–0.50″ |
| Venus | 1.217″ | 1.19–1.22″ |

`BASELINE_MAX_ARCSEC` may only ever be tightened, so nothing there moves.

### The one thing that could move an invariant, named in advance

**The Tula Sankranti of 2025 at Reykjavik.** Phase 36.2 left it sitting 6.4 s
*before* that day's sunrise; a sankranti movement of up to 21.6 s can flip which
day it falls on, and with it two festival entries. Predicted typical movement is
3.6 s, so it is predicted **not** to flip — but if it does, that is the knife
edge already recorded as a live exposure, not a new defect, and it will be
reported with both instants rather than re-pinned. No other invariant may move.

### Predicted cost

Term counts up 6–11% on the lunar series, which is 32% of self time: predicted
`cold/default` **0.4154 → 0.425–0.435 ms** (+3–5%), still inside the 0.47 ms
exit criterion. Bundle predicted +8–15 KB on 549.4 KB.

## Observed — `PROBE_COUNT` 600 → 100,000

### Two changes, separated before either was judged

Raising the probe count needed the truncation search to get ~7.5× faster to stay
affordable, so `truncate()` was rewritten from a binary search over prefixes to a
single backward sweep of tail sums. That is a second change, and entangling it
with the first would have destroyed the attribution, so it was measured alone —
the generator re-run at the **old** 600 probes with the **new** sweep:

| series | 600, binary search | 600, tail sweep | 100,000, tail sweep |
|---|---|---|---|
| Moon longitude | 512 | **512** | 657 |
| Moon latitude | 360 | **360** | 414 |
| Moon distance | 469 | **465** | 623 |
| Earth L | 108 | **108** | 118 |

The sweep changes exactly one number, and it changes it *downward*: the binary
search had been keeping four lunar-distance terms it did not need. That is the
monotonicity assumption the old code documented but could not enforce, showing
up as a four-term overshoot. Everything else is identical, so every difference in
the last column is the probe count.

### Term counts — larger than predicted, and why

| series | now | **observed** | predicted | verdict |
|---|---|---|---|---|
| `MOON_LONGITUDE_*` | 512 | **657** (+28.3%) | 545–570 (+6–11%) | over |
| `MOON_LATITUDE_*` | 360 | **414** (+15.0%) | 380–400 | over |
| `MOON_DISTANCE_*` | 465 | **623** (+34.0%) | 495–520 | over |
| `EAR_L` | 108 | **118** (+9.3%) | 120–140 | under |

The prediction was wrong, and the model behind it is the reason. It assumed one
slope for every series — ~272 terms per factor of two in error, read off the last
budget change (784 → 512 terms for 0.2″ → 0.4″). In the region these series now
sit the amplitude spectrum has flattened, and the measured slope is ~823 terms
per factor of two, three times steeper. The prediction's arithmetic was right and
its one empirical input was taken from the wrong part of the curve.

**The written guard was "larger than +30% is a bug, most likely the probe
generator degenerating", and lunar distance came in at +34%, so that was
checked rather than waved through.** The generator is a 32-bit LCG; at 100,000
draws it produces 100,000 **distinct** values, uniform across 30 bins to ±3%
(3,247–3,444 against 3,333 expected), spanning −1.499946 to +1.499989 of the
±1.5-century range. It is not degenerate; the tail is real.

### Convergence — it does not happen, and that is the finding

`PROBE_COUNT` was swept 600 → 5,000 → 20,000 → 60,000 looking for the reported
error to stop moving. It never moves: the binary search pins it at the budget by
construction. What moves is the *term count*, and it was still climbing at
60,000 (Moon longitude 512 → 554 → 554 → 661).

It cannot converge. The residual left by dropping a series' tail is a sum of
sinusoids whose supremum over the span is attained on a set of measure zero, so
random sampling approaches it as an extreme-value problem. Concretely: at
100,000 draws the **largest gap between consecutive probes is 13.4 days**, while
the residual's fastest components have periods of hours — the sample is three
orders of magnitude below Nyquist and always will be.

So the stopping point is not convergence but an **anchor**: 100,000 is exactly
the sample size `DIFFERENTIAL_FULL=1` uses. The generator can no longer
advertise a budget that the test verifying it then exceeds, which was the whole
defect. The number in a generated header now means "worst of 100,000 samples",
and the header says so.

### Tier 0 — better than predicted, in the predicted direction

| body | before | **observed** | predicted | ceiling | margin |
|---|---|---|---|---|---|
| Sun | 0.4196″ | **0.3233″** | 0.410–0.420″ | 1.613″ | 5.0× |
| Moon | 1.3448″ | **1.2610″** | 1.340–1.345″ | 3.747″ | 2.97× |
| Mercury | 0.499″ | **0.3833″** | 0.48–0.50″ | 6.504″ | 17× |
| Venus | 1.217″ | **1.0217″** | 1.19–1.22″ | 19.586″ | 19× |
| Mars | 1.607″ | **1.1422″** | — | 11.103″ | 9.7× |
| Jupiter | 0.889″ | **0.8387″** | — | 9.662″ | 12× |
| Saturn | 0.876″ | **0.8706″** | — | 11.147″ | 13× |

Every body improved. The prediction said "movement under 0.01″, improving
direction" and the direction was right while the size was not, for a reason
worth keeping: the prediction assumed the truncation leg was already ≈0.40″ and
would barely move, when the entire premise of the change is that it was
**0.45″** and would drop to 0.40″. Sun improved 0.096″ against a 0.073″
improvement in its truncation leg; Moon 0.084″ against 0.052″. Same order, and
the residual is the 250-epoch sample the Tier 0 maximum is taken over.

Two notes rather than one number. The Moon's shipped error (1.2610″) is now
marginally *better* than its own untruncated reference (1.2866″) — an accident
of which epoch is worst in a 250-point sample, where truncation happens to
cancel some theory error, not evidence that truncating helps. And the Moon's
margin is **2.97×**, still just under §36.0's 3× floor, so this change has not
created headroom for the lunar budget that was rejected earlier; it has moved
the margin from 2.79× to 2.97× and left it there.

### Fixture movement — `notes/diff.mjs`, 241 MB each side

Same 6 locations × 320 days × 5 option shapes spanning 1912 / 2025 / 2088, plus
the full-year festival, ekadashi and sankranti listings.

| fixture family | predicted worst | **observed worst** | verdict |
|---|---|---|---|
| **invariants — index, name, boolean, count, festival date** | **0** | **0** | ✅ |
| karana end times | 1.7 s | **622 ms** | inside |
| tithi end times | 1.7 s | **614 ms** | inside |
| bhadra start / end | 1.7 s | 548 / 542 ms | inside |
| yoga end times | 3.0 s | **442 ms** | inside |
| nakshatra end times | 1.7 s | **304 ms** | inside |
| varjyam start / end | 1.7 s | 287 / 282 ms | inside |
| eclipse contacts / sutak | — | 192–434 ms | — |
| moonrise / moonset | 90 ms | 112 / 118 ms | **at the edge** |
| sunrise / sunset | 60 ms | 31 / 38 ms | inside |
| rise/set-proportional windows | 90 ms | 15–38 ms | inside |
| Sun sidereal longitude | ≤0.9″ | **0.197″** | inside |
| Moon sidereal longitude | ≤0.9″ | **0.154″** | inside |
| eclipse magnitude | — | 9.65 × 10⁻⁵ | — |
| ayanamsa | 0 | 1.4 × 10⁻¹¹ | rounding only |

Moonrise and moonset came in at 112 and 118 ms against a predicted 90 ms — over,
by a quarter. The prediction divided lunar longitude error by a 15″/s altitude
rate and forgot that the *latitude* series moved too, which is declination and
enters undivided; 0.2″ of it at a shallow approach is the extra 30 ms. Recorded
rather than rounded into the row above it.

**One numeric leaf is integer-valued and worth naming: `sun.dayDurationMinutes`
moved by 1** at Reykjavik on 5 days out of 11,520 (547 → 546). It is a duration
rounded to whole minutes, not a count, so `diff.mjs` classifies it as numeric and
that is right — but it is the one place a sub-second shift becomes a visibly
discrete change, and it is reported here so nobody has to rediscover that.

**The Reykjavik knife-edge held again.** The Tula Sankranti of 2025 reads
`2025-10-16` on both sides, byte-identical, as does every other sankranti,
ekadashi and festival list. Worth stating precisely what that does and does not
prove: `getSankrantisForYear` publishes a **date**, not an instant, so the
~4.7 s the transit actually moved is invisible to this harness. The only
observable is the day, and the day flips discontinuously. The exposure is
unchanged and still unpinned by any fixture.

### The one thing that was a defect, found and fixed rather than re-pinned

`tests/unit/newMoon.test.ts` — *"holds at the boundary instants themselves"* —
failed, and it is not a fixture. Probed directly:

```
searchMoonPhase(0, 2026-06-15, 40)  -> 2026-06-15T02:54:03.466Z
elongation there                    -> 9.86e-9 deg
newMoonNear(seed from that instant) -> 2026-06-15T02:54:03.467Z   (+1 ms)
boundingNewMoons(ref).prev          -> 2026-05-16T20:00:56.081Z   (a month early)
```

`searchMoonPhase` rounds its converged root to a whole millisecond, and the same
syzygy reached from a different seed can round the other way. `boundingNewMoons`
tested `prev.getTime() <= ref.getTime()` exactly, so a one-millisecond overshoot
rejected the fast path, and the scan fallback then returned the **previous**
lunation — putting the Chandra Masa of an instant sitting exactly on a new moon
a month out.

Pre-existing (`newMoon.ts` already documented that the two paths can disagree by
~175 ms) and exposed, not caused, by this change: the ephemeris moved the root
across a rounding boundary. Fixed by giving `lunation.ts` an explicit
`PHASE_AGREEMENT_MS = 2 ms` — two instants agreeing to within the search's own
convergence are the same event — and anchoring the pair at `ref` so `prev ≤ ref`
still holds exactly.

### Re-pins, with predicted and observed

| fixture | predicted | observed | |
|---|---|---|---|
| `edge-cases.test.ts` `TRUE_TRANSITION_UTC` | ≤3.0 s | **−196 ms** | 06:08:45.897 → .701 |
| `tier0-own-eclipses.test.ts` umbral magnitude bound | — | 0.000535 → **0.000615** | see below |

The eclipse bound is the one Tier 0 number that moved the *wrong* way, so it was
attributed rather than raised: umbral magnitude is a separation over twice the
Moon's semidiameter, so 1″ of lunar position is 0.00054 of magnitude, and the
lunar **latitude** series moved by up to its own 0.2″ budget — worth 0.0001,
against an observed 0.00008. Longitude improved over the same change; they are
different coordinates and there is no reason for them to move together. The
**invariant** in that file — eclipse *type*, 0 mismatches in 457 — is asserted
before the magnitudes and did not move.

The Bhava Bala fixtures also moved (Narendra Modi, 4th decimal) and are
deliberately **not** re-pinned here: Phase 36's planetary path changes again in
the next step, and §36.0 E asks for one re-pin at the end rather than one per
sub-change.

### Cost — larger than predicted, and it is the term counts

| | before | **after** | predicted |
|---|---|---|---|
| `cold/default` | 0.4154 ms | **0.4565 ms** (+9.9%) | 0.425–0.435 (+3–5%) |
| `cold/instant` | 0.2159 | 0.2446 (+13.3%) | — |
| `warm/default` | 0.1791 | 0.2004 (+11.9%) | — |
| `range/festivals`, ms/yr | 137.28 | 150.60 (+9.7%) | — |
| `chart/shadbala` | 0.3449 | 0.3586 (+4.0%) | — |
| bundle, CJS | 549.4 KB | **572.6 KB** (+23.2 KB) | +8–15 KB |

Both misses track the term-count miss and neither is independent of it. The
exit criterion still holds — 0.4565 against 0.47 — but the margin is now **2.9%**,
which is inside the run-to-run spread, and that is worth saying plainly rather
than reporting a pass. The accuracy bought with it is real (Sun −23%, Moon −6%,
Mars −29% against DE441) and the budgets themselves are untouched.

---

## Prediction — a second, full-precision Earth series for the planet path

Written 2026-08-07, before the generator was re-run, as §36.0 E requires. Run
**separately** from the probe-count change above; its footprint is disjoint.

### The coupling being fixed

A geocentric planetary direction is `planet − Earth`, so it carries the Earth's
heliocentric error amplified by `r_E / Δ`, where Δ is the geocentric distance.
The Earth's series *is* the Sun's series, and its budget was raised to 0.4″ for
the Sun's sake. Measured at the current Earth-L truncation of 0.380″:

| body | Δ_min (AU) | Earth's error, as seen from here |
|---|---|---|
| Mercury | 0.55 | 0.69″ |
| Venus | 0.27 | 1.41″ |
| Mars | 0.37 | 1.03″ |
| Jupiter | 3.9 | 0.097″ |
| Saturn | 7.9 | 0.048″ |

Giving `earthRect` — the planet path's only Earth read — its own ≤0.1″ series
cuts each of those by 3.8×. `sun.ts` keeps the coarse one, so nothing on the
solar path changes.

### Predicted Tier 0

The Earth term is removed, not the body's own; the two are independent, so the
honest bracket is between "the Earth term dominated" and "it contributed
nothing".

| body | now | predicted | what would be a bug |
|---|---|---|---|
| Mercury | 0.3833″ | 0.25–0.38″ | any increase |
| Venus | 1.0217″ | 0.30–0.75″ | any increase |
| Mars | 1.1422″ | 0.40–1.05″ | any increase |
| Jupiter | 0.8387″ | 0.82–0.84″ | movement over 0.02″ |
| Saturn | 0.8706″ | 0.86–0.88″ | movement over 0.02″ |
| **Sun** | 0.3233″ | **0.3233″ exactly** | *any* movement at all |
| **Moon** | 1.2610″ | **1.2610″ exactly** | *any* movement at all |

The last two rows are the load-bearing ones: if the Sun or the Moon moves by a
single digit, the split did not land where it was supposed to and the coarse
series is no longer feeding the solar path.

The untruncated **reference** columns must not move either — they never read a
truncated series.

### Predicted fixture movement

Planetary longitudes only, by up to the amounts in the first table — worst
1.41″ at Venus, and typically a third of that.

| family | predicted typical | predicted worst |
|---|---|---|
| planet sidereal / tropical longitude | ~0.4″ | **1.4″** |
| Shadbala, Bhava Bala component totals | ~1 × 10⁻³ V | **5 × 10⁻³ V** |
| everything not derived from a planet | **0** | **0** |
| **rashi / nakshatra index, retrograde boolean, yoga name, Ashtakavarga count** | **0** | **0** |

A 1.4″ movement flips a rashi index only for a planet sitting within 1.4″ of a
30° boundary — about 1.3 × 10⁻⁵ per planet per chart. If one flips it is a
boundary case to be reported with both longitudes, not re-pinned.

### The harness hole this has to close first

`notes/dump.src.ts` contains **no charts**, so `diff.mjs` would report *nothing*
for a change that touches only the planet path — a clean before/after that
proves nothing at all. `dump.src.ts` is therefore extended with a chart sweep
(five nativities × the full chart surface) before the change is made, and the
"before" side re-dumped, so this step is measured rather than asserted.

### Predicted cost

`EAR_L` grows from 118 terms to roughly 220–260 at 0.1″, and `EAR_B` from 4 to
~30. The Earth is read three times per chart against fifteen planet reads, so:

| | now | predicted |
|---|---|---|
| `chart/shadbala` | 0.3586 ms | 0.375–0.415 ms (+5–15%) |
| `chart/bhavabala` | 0.3637 ms | +5–15% |
| `cold/default` | 0.4565 ms | **unchanged** — the daily panchang reads no planet |
| bundle, CJS | 572.6 KB | +6–12 KB |

**Flag it if the chart regression exceeds ~15%**, per the brief.

### What this does not fix, recorded as a live exposure

The **Sun stays at 0.3233″**, because keeping it there is the point of the split.
At 24 s of sankranti per arcsecond that is ~7.8 s of error on every solar transit
instant, and the Tula Sankranti of 2025 at Reykjavik still sits ~6 s from that
day's sunrise with no fixture pinning it. This change does not touch that, and
is not intended to.

## Observed — a second, full-precision Earth series for the planet path

`EAR_L_PRECISE` 273 of 1,080 terms at 0.0962″ (against `EAR_L`'s 118 at 0.380″);
`EAR_B_PRECISE` 22 of 348 at 0.0995″ (against `EAR_B`'s 4 at 0.324″). `EAR_R` is
shared — a radius error does not divide by Δ.

### Tier 0

| body | before | **observed** | predicted | verdict |
|---|---|---|---|---|
| **Sun** | 0.3233″ | **0.3233″** | exactly unchanged | ✅ identical |
| **Moon** | 1.2610″ | **1.2610″** | exactly unchanged | ✅ identical |
| Mercury | 0.3833″ | **0.2956″** | 0.25–0.38″ | ✅ inside |
| Venus | 1.0217″ | **0.8620″** | 0.30–0.75″ | improved, less than predicted |
| Mars | 1.1422″ | **1.2933″** | 0.40–1.05″ | ❌ **worse** — predicted as a bug |
| Jupiter | 0.8387″ | **0.8351″** | 0.82–0.84″ | ✅ inside |
| Saturn | 0.8706″ | **0.8615″** | 0.86–0.88″ | ✅ inside |

The two rows that had to be identical are identical, to every digit printed. The
split landed exactly where it was aimed: the solar path still reads the coarse
Earth and nothing on it moved.

### Mars got worse, which the prediction called a bug. It is not one.

The prediction said "any increase is a bug", so this was measured rather than
argued. Recomputing all 250 Horizons epochs with each Earth series in turn:

| | coarse Earth | precise Earth | epochs improved |
|---|---|---|---|
| Mercury | 0.3833″ | 0.2956″ | 163 / 250 |
| Venus | 1.0217″ | 0.8620″ | 145 / 250 |
| Mars | 1.1422″ | **1.2933″** | 134 / 250 |

At Mars's worst epoch (1940) the error goes from −1.1422″ to −1.2933″: the
coarse Earth was contributing **+0.1511″** there, *cancelling* part of Mars's own
truncation error. Removing the Earth term removed the cancellation and exposed
the rest.

Four things say this is arithmetic and not a defect. Mars's **mean** error
improved (0.1400″ → 0.1367″) and it improved at a majority of epochs. The
0.1511″ shift is inside the coarse series' own 0.380″ residual, amplified by
Mars's 1940 geometry. Mars's **untruncated reference** is unchanged at 0.2598″,
so nothing on Mars's own path moved. And Venus shows the same effect from the
other side: its overall maximum fell, but at its *new* worst epoch (2027) the
error rose 0.6824″ → 0.8620″ for exactly the same reason.

The prediction's error was treating a maximum over 250 **signed** samples as
though it were monotone in the magnitude of one component. It is not: removing a
component can raise a maximum whenever that component was cancelling at the
argmax. Mars is 8.6× inside its 11.103″ ceiling either way.

### Fixture movement — `notes/diff.mjs`, with the chart sweep that had to be added first

`notes/dump.src.ts` had no charts, so this change would have produced an empty
report. It now dumps five nativities spanning 1912–2088 across the whole chart
stack — positions, houses, Navamsa, Shadbala, Bhava Bala, Ashtakavarga, yogas.
The "before" side was re-dumped with the sweep in place before the change was
made.

| family | predicted | **observed** | verdict |
|---|---|---|---|
| **invariants — rashi/nakshatra index, retrograde, yoga name, Ashtakavarga count** | **0** | **0** | ✅ |
| **date/time leaves of any kind** | 0 | **0 distinct leaves** | ✅ |
| planetary longitude, D1 | ~0.4″ typical, 1.4″ worst | **0.228″** (Venus) | ✅ inside |
| planetary longitude, Navamsa | — | **2.05″** | see below |
| Shadbala component totals | ≤5 × 10⁻³ V | **1.23 × 10⁻⁵ V** | ✅ inside |
| Bhava Bala `houses.total` | ≤5 × 10⁻³ V | 1.23 × 10⁻⁵ V | ✅ inside |
| everything not derived from a planet | 0 | **0** | ✅ |

Twenty-nine numeric leaves moved and every one of them is planetary. The whole
daily-panchang surface — 241 MB of it — is byte-identical, which is the
prediction's sharpest claim and the one the coarse/precise split exists to make
true.

**The worst single number is the Navamsa's, and that is the sweep working.**
`chart|london-2025|navamsa.planets.5.longitude` moved 2.05″ against a D1
movement of 0.228″ — a factor of exactly 9, because Navamsa multiplies the
longitude within a sign by nine. A D9 chart is the most sensitive consumer of a
planetary longitude in the library, which is why it is in the sweep; a harness
that dumped only D1 would have understated this change ninefold.

### Cost

| | before | **observed** | predicted | |
|---|---|---|---|---|
| `chart/shadbala` | 0.3586 ms | **0.3970 ms** | 0.375–0.415 | **+10.7%**, under the ~15% flag |
| `chart/bhavabala` | 0.3637 ms | **0.4044 ms** | +5–15% | +11.2% |
| `cold/default` | 0.4565 ms | **0.4518 ms** | unchanged | −1.0%, noise |
| every other configuration | — | within ±1% | unchanged | ✅ |
| bundle, CJS | 572.6 KB | **583.5 KB** | +6–12 KB | +10.9 KB |

The chart regression is real and is the price of the fix; it is under the
threshold the brief set for flagging, and it buys Mercury −23%, Venus −16% and a
D9 chart that no longer inherits a budget set for the Sun.

### What this does not fix — restated, because it is now the release's thinnest edge

The **Sun stays at 0.3233″** by design. At 24 s of sankranti per arcsecond that
is **~7.8 s** on every solar transit instant. The Tula Sankranti of 2025 at
Reykjavik still sits about 6 s from that day's sunrise; it held through both of
this session's value-moving changes, and `getSankrantisForYear` publishes only
the **date**, so the harness cannot see the instant move — only the day flip.
No fixture pins it. It is the one place in the release where a sub-10-second
ephemeris movement can change a published calendar date.

---

## Closing measurements

### §36.0 H at full sample size, after the probe-count change

`DIFFERENTIAL_FULL=1`, 100,000 pseudo-random instants per body against the
untruncated reference:

| | budget | before | **after** |
|---|---|---|---|
| Moon longitude | 0.4″ | 0.45073″ | **0.35166″** |
| Sun longitude (Earth L) | 0.4″ | 0.45312″ | **0.34877″** |

Both were *outside* their stated budget when measured at the size that verifies
them, and both are now comfortably inside it. That is the entire point of the
change, and it is the one number that says it worked.

The test now prints these unconditionally rather than hiding them in an
assertion message — the same reasoning as the `TIER0_REPORT=1` reporters, except
that a ten-minute run is already opt-in.

### Drik parity (Tier 1) — unchanged

| element | before this session | **after** |
|---|---|---|
| tithi | 42 s | **42 s** |
| karana | 49 s | **49 s** |
| nakshatra | 22 s | **22 s** |
| yoga | 58 s | **58 s** |

Identical to the second. Three changes that moved published values — a refitted
rise/set track, regenerated series, and a new Earth series for the planet path —
moved Drik parity by nothing, which is what a reference publishing to the minute
should do against movements of a few hundred milliseconds.

### A measurement artefact worth recording, since it looked like a failure

One `DIFFERENTIAL_FULL=1` run reported a single failure with no assertion
message and a code frame pointing at a variable declaration. It was a **timeout**:
two ten-minute vitest processes were running concurrently at the time. Re-run
alone, all six pass with identical numbers. Recorded because "one test failed
under `DIFFERENTIAL_FULL`" is exactly the kind of result that gets chased as an
ephemeris problem, and the tell was that the reported values were unchanged.

### Performance, end to end — and a caveat about the absolute figure

Median of 15 processes per configuration, `node notes/driver.mjs`, all four
measurements taken on the same machine within the same session.

| | before this session | + 4-day track | + PROBE_COUNT | + precise Earth |
|---|---|---|---|---|
| `cold/default` | 0.4972 | 0.4154 (−16.4%) | 0.4565 (+9.9%) | **0.4518** |
| `cold/sections-empty` | 0.2902 | 0.2727 | 0.2990 | 0.2976 |
| `cold/instant` | 0.2335 | 0.2159 | 0.2446 | 0.2436 |
| `range/festivals`, ms/yr | 162.50 | 137.28 | 150.60 | **150.15** |
| `chart/shadbala` | 0.3428 | 0.3449 | 0.3586 | **0.3970** |
| `prim/moonrise` | 0.1467 | 0.0803 | 0.0884 | **0.0876** |
| bundle, CJS | 549.4 KB | 549.4 KB | 572.6 KB | **583.5 KB** |

**The absolute figure is load-sensitive by more than the margin it clears**, and
that is worth a line of its own because the first pass reported a 6.4% *miss*
measured at load average 4.3. The same final build:

| load average | `cold/default` |
|---|---|
| 3.3 | **0.4518** (median of 15) |
| 5–6 | **0.5023** (median of 21; min 0.4883, max 0.5256) |

An 11% swing against a target cleared by 3.9%. The columns above were taken
interleaved at matched load and are unaffected; only the absolute claim is. The
release sits *on* the 0.47 target, not comfortably inside it, and that is how it
is written up.

---

## Prediction — `EclipseInfo.magnitude` publishes obscuration, not magnitude

Written 2026-08-07, **before any code was changed and before anything was
re-run**. §36.0 E applies in full: this moves a published value.

### The defect, stated as arithmetic

`src/astronomy/eclipse.ts:203` publishes `magnitude: eclipse.umbralObscuration`
and `:257` publishes `magnitude: eclipse.obscuration`. Both are the fraction of
the disc's **area** covered. Every published catalogue — NASA/Espenak included —
means the fraction of its **diameter** by "magnitude". The values are correct
*obscuration*; the name is wrong, and it has been wrong since 4.x.

The quantity that is actually wanted already exists in the geometry and is
already Tier 0 validated: `LunarEclipse.umbralMagnitude`
(`eclipseGeometry.ts:320`) and `SolarEclipse.magnitude` (`:554`). Neither is
published.

### The change

- `EclipseInfo.magnitude` → `EclipseInfo.obscuration`, same value.
- New `EclipseInfo.magnitude`: `umbralMagnitude` for lunar, `magnitude` for
  solar — the catalogue quantity.
- The same two fields on `EclipseDetails` (`types/elements.ts`), on
  `EclipseTableEntryRaw` / `EclipseTableEntry`, and through
  `buildEclipsesTable` / `readEclipsesForYear`.
- `description` keeps being built from **obscuration** — the i18n template says
  "{percent}% obscuration" and is already correct.

### What must not move — any movement here is a bug

- **Every `obscuration` value**, bit-identical to what `magnitude` published
  before. This is a rename; the expression on the right of the colon does not
  change.
- **Every `description` string**, because it is built from obscuration.
- **Every instant** — `start`, `peak`, `end`, `sutakStart`, `sutakEnd`. No
  geometry is touched.
- **Every index, name, boolean, count and festival date.** Eclipse festival
  entries are keyed, not magnitude-derived.
- **Eclipse `subtype`**, which is decided by `umbralMagnitude` inside the
  geometry and is unaffected by what the panchang layer chooses to publish.

### What the new field must read, predicted from the canon before observing it

`tier0-own-eclipses.test.ts` already measures the geometry's `umbralMagnitude`
against `nasa-eclipses.json` at **<0.0007** over all 457 lunar rows. The
published field is a copy of that number, so the published path must meet the
same bound. Concretely, for the two rows the handoff named:

| | NASA `umbralMagnitude` | published now (obscuration) | predicted new `magnitude` |
|---|---:|---:|---:|
| 2097-04-26 | 0.8420 | 0.8795 | **0.8420 ± 0.0007** |
| 2099-04-05 | 0.1680 | 0.0975 | **0.1680 ± 0.0007** |

**The new field is not in [0, 1], and that is the sharpest check available.**
The canon's 457 lunar rows split 166 total / 122 partial / 169 penumbral, and
its `umbralMagnitude` column runs **−1.068 to 1.8628**: negative for every
penumbral eclipse (the Moon misses the umbra entirely) and above 1 for every
total one. The published field must show the same signature — 169 negative
values and 166 above 1. If the observed values are clamped into [0, 1], or if
`Math.abs` has crept in anywhere, the wiring is wrong even though every
individual number would still "look like a magnitude". The solar column runs
0.0013 to 1.08 for the same reason.

**Obscuration and magnitude must cross.** Area covered against diameter
covered: for a shallow eclipse the area fraction is the smaller of the two
(0.0975 < 0.1680 above), for a deep one the larger (0.8795 > 0.8420). So the
observed pairs must cross somewhere in 0.168 < m < 0.842 — predicted near
m ≈ 0.5 — and any dataset where one is uniformly above the other means the two
fields have been wired to the same source.

### Which existing assertions move, and how

Four sites read the published field. All four are **renames, not re-pins** —
the same number under a new name:

| site | before | after |
|---|---|---|
| `tests/unit/eclipse.test.ts:77-81` | `magnitude` in [0,1] | `obscuration` in [0,1] |
| `tests/unit/eclipse.test.ts:125-129` | `magnitude` in [0,1] | `obscuration` in [0,1] |
| `tests/unit/eclipse.test.ts:174` | identity string carries `magnitude` | carries `obscuration` |
| `tests/unit/eclipsesTable.test.ts:80` | total lunar `magnitude` > 0.9 | `obscuration` > 0.9, and the new `magnitude` > 1 |

**If any of these needs a different *number* rather than a different *name*,
that is a wiring bug and must not be re-pinned.** `differential-eclipse.test.ts`
and the existing `tier0-own-eclipses.test.ts` assertions read the geometry
directly and must not move at all.

### The new Tier 0 assertion

Nothing currently checks the *published* field against anything — the geometry
is validated, the publication of it is not, which is exactly how a field can
carry the wrong quantity through two Tier 0 test files without a failure. The
new assertion drives `getUpcomingLunarEclipse` (the public path, not the
geometry) over canon rows and compares:

- `magnitude` against `umbralMagnitude` at the geometry's own bound;
- `obscuration` against a recomputed `discObscuration`, so the rename is
  verified rather than assumed;
- the sign/·>1 signature above, so a clamp cannot pass.

Predicted result: passes at the first attempt with the bounds above. A failure
would mean the panchang layer is not publishing what the geometry computed.

### Table format

`EclipseTableEntryRaw` gains `obscuration` and its `magnitude` changes meaning.
There is no bundled JSON — every eclipse table is app-built — so nothing in the
repo needs migrating, but a table built by **4.x** and read by 5.0.0 yields
`obscuration: undefined` and a `magnitude` that is still an area fraction.
That is a rebuild, and it belongs in the CHANGELOG's breaking section.

Predicted size: one extra float per eclipse, ~20 bytes; a 12-eclipse Varanasi
table grows by well under 1 KB. Predicted round-trip: unchanged — both fields
are plain numbers and survive `JSON.parse(JSON.stringify(...))`.

### Cost

**No measurable change predicted.** `umbralMagnitude` and the solar `magnitude`
are already computed by the geometry on every eclipse found; publishing them is
a field copy on a path that runs at most twice a lunation. Predicted |Δ| < 1%
on every benchmark configuration — i.e. inside the run-to-run spread. Bundle:
+~0.2 KB for the extra field names and doc comments. **If any configuration
moves by more than 3%, something other than this change moved.**

---

## Observed — `EclipseInfo.magnitude` publishes obscuration, not magnitude

Every prediction above held, including the two that were written specifically so
that a wiring mistake could not pass. One quantitative prediction was wrong in a
way worth keeping.

### The new field, against the canon

Driven through `getUpcomingLunarEclipse` — the public path, not the geometry —
over all 457 lunar rows of 1901–2100:

| | predicted | **observed** |
|---|---|---|
| max \|Δ\| vs canon `umbralMagnitude` | < 0.0007 | **0.000615** at 2099-09-29 |
| mean \|Δ\| | — | 0.000355 |
| rows negative (penumbral) | 169 | **169** |
| rows above 1 (total) | 166 | **166** |

**The observed maximum is 0.000615, which is the geometry test's own measured
figure to the last digit.** That is the sharpest available statement that the
panchang layer forwards the number rather than transforming it: two independent
code paths, one reading `findLunarEclipse` and one reading `EclipseInfo`,
produce the identical worst-case residual against the same 457 rows.

The two rows the handoff named:

| | NASA | published before | **published now** | |
|---|---:|---:|---:|---|
| 2097-04-26 | 0.8420 | 0.8795 (obscuration) | **0.8423** | ✅ inside ±0.0007 |
| 2099-04-05 | 0.1680 | 0.0975 (obscuration) | **0.1684** | ✅ inside ±0.0007 |

Solar, through `getUpcomingSolarEclipse` at Chicago (66 unclipped rows of the
NASA city catalog): magnitude worst **0.001495**, obscuration worst
**0.002340**, both inside the 0.004 the geometry meets over all 788. The local
catalogs print *both* columns, which is what makes them able to adjudicate a
swap — a build with the two fields exchanged lands inside every other bound in
that file and fails only these two.

### The prediction that was wrong: where the two quantities cross

Predicted: obscuration and magnitude cross "near m ≈ 0.5". **Observed: the
crossing is at m ≈ 0.65.** Of the partial lunar eclipses between 0.05 and 0.95,
68 have obscuration below magnitude and 34 above it, and the lowest magnitude at
which obscuration overtakes is **0.6534** (2019-07-16: magnitude 0.65343,
obscuration 0.65451).

The prediction reasoned from equal-sized discs, where the crossing is at 1. The
lunar case is a small disc entering a much larger one — the umbra is ~2.6 lunar
diameters — so the covered area grows faster against depth than the covered
diameter does, and the crossing moves down. It does not affect anything that was
asserted; it is recorded because the qualitative claim (that they cross, and
therefore cannot be the same source) was the one doing the work, and it held.

### What did not move, checked rather than assumed

- **`obscuration` is the same expression that `magnitude` used to be**, right
  down to the character: `eclipse.umbralObscuration` / `eclipse.obscuration`.
  Not a re-measurement — a diff, which is a stronger statement than a
  measurement could make.
- **`description` is unchanged**, because it was already built from obscuration
  and the i18n template already said "obscuration".
- Zero instants, zero indices, zero names, zero counts, zero festival dates.

### The finding: the compiler could not see this, and neither could the suite

`npm run typecheck` passed on **both** configs immediately after the rename, and
before a single test was updated. A rename that puts the old name back on a
different quantity is invisible to a type system — `magnitude: number` was
`number` before and after — so every one of the four sites reading it kept
compiling while asserting something that had silently changed meaning. Two of
them kept *passing* as well: `magnitude > 0.9` on a total lunar eclipse is true
of the obscuration (1.0) and of the magnitude (1.36) alike.

That is the same shape as the defect itself: the quantity was computed, was
measured against NASA in two Tier 0 files, and was then not published, and
nothing in 8,000 tests compared the published field against anything. **A test
that validates a producer says nothing about the wiring to the consumer**, and a
compiler cannot tell you that a `number` changed meaning. The new assertions are
written against the *public entry points* for exactly that reason.

### Test movement — renames, no re-pins

Four sites, all as predicted: three in `tests/unit/eclipse.test.ts` and one in
`tests/unit/eclipsesTable.test.ts`. **No numeric value was re-pinned.** Each was
strengthened while it was open, because the old assertions could not have caught
the defect they sat next to:

| before | after |
|---|---|
| lunar `magnitude` ∈ [0, 1] | `obscuration` ∈ [0, 1] **and** `magnitude` > 1 on a total eclipse |
| solar `magnitude` ∈ [0, 1] | `obscuration` ∈ [0, 1] **and** magnitude > obscuration on a partial |
| — | new: a penumbral lunar eclipse has obscuration exactly 0 and a **negative** magnitude |
| total lunar table entry `magnitude` > 0.9 | `obscuration` > 0.9 **and** `magnitude` > 1 |
| — | new: the table survives `JSON.parse(JSON.stringify(...))` with both fields |

### Table format

`buildEclipsesTable` emits both fields; `readEclipsesForYear` flattens both; the
round trip is asserted rather than assumed. Table size is unchanged to the
kilobyte — the extra float is one number per eclipse, and a Varanasi
2025–2027 table holds twelve of them.

### Cost — the observation is a count, not a benchmark

Predicted: no measurable change, |Δ| < 1%, and "if any configuration moves by
more than 3%, something other than this change moved."

The honest observation is not a benchmark, because a benchmark cannot resolve
this. The change adds **two property writes per `EclipseInfo`**, and the
`cold/default` configuration — 1,200 consecutive days at Pune — constructs
**seven** of them. Fourteen property writes against ~500 ms of measured work is
below any noise floor the harness has; running an A/B would have reported the
machine and dressed it as an attribution.

What was measured: `cold/default` reads **0.4173 ms** on the build carrying this
change, against 0.4518 recorded before it at a *lower* load average. The bundle
went 583.73 → **584.05 KB** (+0.32 KB, predicted +~0.2 KB). Nothing here is
distinguishable from run-to-run variation, which is what the prediction said and
what the mechanism requires.
