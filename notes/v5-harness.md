# v5 measurement harnesses

The scripts behind every number in [docs/v5-validation-report.md](../docs/v5-validation-report.md).
None of them is part of the package; they exist so a claim in that report can be
re-run rather than believed.

They are written as TypeScript against `src/`, and bundled with esbuild before
running, because `src/` uses extensionless imports (`moduleResolution: bundler`)
that Node's ESM resolver will not follow.

```bash
bash notes/build.sh                 # bundles bench.src.ts    -> bench.mjs
bash notes/dump.sh <label>          # bundles + runs dump.src.ts -> dump-<label>.json
```

Both write next to themselves. `build.sh` / `dump.sh` take an output directory
via `$SP`, defaulting to `notes/`.

| script | what it answers |
|---|---|
| `bench.src.ts` + `driver.mjs` | Per-call cost, **one configuration per process**. Process isolation is the point: the sunrise `EVENT_CACHE` and the Chebyshev block store are module-level, so "cold" cannot be measured inside a process that already computed those days. `driver.mjs <label> [reps] [baseline]` runs every configuration N times, takes the median, and diffs against a previous run's JSON. |
| `dump.src.ts` + `diff.mjs` | Whether a change moved any published value. `dump.src.ts` emits ~240 MB of results (6 locations × 320 days × 5 option shapes, spanning 1912/2025/2088, plus full-year festival / ekadashi / sankranti lists, **plus five birth charts** across the whole chart stack — positions, houses, Navamsa, Shadbala, Bhava Bala, Ashtakavarga, yogas). `diff.mjs` classifies the difference: **invariants** (names, booleans, indices, array lengths, key order) at zero tolerance, numeric leaves by magnitude, `Date` leaves as time shifts. This is what proved 36.1 (d) and (c) moved only what was predicted. |
| `lunarcheck.src.ts` | Whether the canonical lunar event cache ever picks a *different* event than an uncached `SearchRiseSet`. 153,600 comparisons across 12 locations (Quito to Alert, 82.5 °N) × 1,600 days × 4 search starts × both directions. |
| `interval.src.ts` | The minimum separation between consecutive same-kind lunar events, measured rather than assumed — this is what sets `minSeparationMs` in `moonrise.ts`. |
| `narrow.src.ts`, `coldratios.src.ts` | The evidence behind the three performance-test measurement changes: the same ratio computed on one repeated day versus over distinct days. |
| `prof/scan.src.ts` + `prof/parse.mjs` | Self time by function, from a 4,000-day calendar scan under `node --cpu-prof`. This is what said `Math.sin` was 77% of the lunar series and that `sumNutation` was not where the nutation time went. |
| `track-fit.src.ts` | The measurement behind `riseSet.ts`'s `TRACK_BLOCK_DAYS` and `TRACK_NODES`. Fits the body's equatorial position over an N-day block with M Chebyshev nodes and compares against direct evaluation, in arcseconds of apparent direction. Shows two things one configuration cannot: the error *floor* (which is `new Date()`'s millisecond quantization, not the fit) and the *cliff* past four days, where ELP's ~5-day argument families stop being resolvable. Its angular metric is `atan2(|u×v|, u·v)` — the `acos` form bottoms out around 6e-3 arcsec, above the error being measured, and makes every configuration look identical. |

## Fetchers — the Tier 0 ground truth

None of these runs at test time; each writes a fixture that is then committed,
so a test never depends on a network.

| script | fixture | what it is |
|---|---|---|
| `horizons-fetch.mjs` | `horizons-positions.json` | 1,750 geocentric apparent positions, JPL Horizons / DE441, 1900–2100 |
| `horizons-deltat.mjs` | `horizons-deltat.json` | ΔT at 21 decades, derived from Horizons (which will not print it directly) |
| `ephemeris-fetch.mjs` | `ephemeris-source/*.gz` | VSOP87D, ELP2000-82B and the IERS nutation tables, as published |
| `eclipse-fetch.mjs` | `nasa-eclipses.json` | NASA/Espenak Five Millennium Canon — 457 lunar + 452 solar rows, **geocentric** |
| `eclipse-local-fetch.mjs` | `nasa-eclipse-local.json` | NASA/Espenak city catalogs — 788 solar **local circumstances** at 10 sites |
| `usno-riseset-fetch.mjs` | `usno-riseset.json` | US Naval Observatory rise/set — 9 sites (equator to 82.5 °N and 77.9 °S) × 8 dates across 1950/2025/2088. The only external check on rise/set; see `tier0-usno-riseset.test.ts` for why USNO rather than Drik. |

## Comparing against a released version

`notes/vcompare/` runs the **published artifact** of an old version beside the
**built dist** of the current one — runtime (`driver.mjs`), eclipses against the
NASA canon (`eclipses.mjs`) and Drik parity (`drik.mjs`), each pointed at either
implementation by `PT_MODULE`. Benching source against a tarball would confound
the answer with build settings, so neither side is built from `src/`.

`driver.mjs` runs **three** columns, and the third one is the point: published
`4.3.1-npm`, a build of git `HEAD-tree`, and the working tree. `package.json`
carried `4.3.1` for seven commits after 4.3.1 was published, so "the 4.3.1 tree"
and "the published 4.3.1" are different software — **6.056 ms against
0.975 ms** on a default day. Every baseline the release notes quoted was the
second while claiming to be the first. Keeping all three columns permanently on
screen is what stops that recurring.

Its README records the other two traps that each produced confidently wrong
numbers first time: 4.x's published `Date`s are offset-shifted but its rise/set
*primitives* are not, and `sections` does not exist in 4.3.1 at all.

## Generators

| script | output | notes |
|---|---|---|
| `ephemeris-generate.sh` → `ephemeris-generate.src.ts` | `src/astronomy/series/*.ts` | Truncates the published tables under the error budgets stated in the script. ~4 s. The budgets are *checked* by `differential-ephemeris.test.ts`, not asserted here. |
| `pi-split.mjs` | the three constants in `src/astronomy/trig.ts` | Cody–Waite split of π from 60 decimal digits, so the reduction does not inherit `Math.PI`'s 53-bit truncation. |

## Rebuilding after a source change

Every script bundles against the **current working tree**, so re-running
`build.sh` / `dump.sh` after an edit is all that is needed. To attribute a delta
to one change, dump before and after that change alone:

```bash
bash notes/dump.sh before          # with the change reverted
# ... apply the change ...
bash notes/dump.sh after
node notes/diff.mjs notes/dump-before.json notes/dump-after.json
```

`diff.mjs` needs a large heap for the 240 MB dumps: run it with
`node --max-old-space-size=8000`.

## What the dump could not see, until it could

Everything in `dump.src.ts` read the Sun and the Moon; **nothing read a
planet**. A change confined to the planetary path therefore produced an empty
`diff.mjs` report and looked output-neutral when it was not — found while giving
the planet path its own Earth series, where the whole question was how far
Mercury and Venus had moved. The chart sweep closes it, and the D9 chart in
particular is why: Navamsa multiplies a longitude within its sign by nine, so it
is the most sensitive consumer of a planetary longitude in the library, and a
harness that dumped only D1 understated that change ninefold.

The lesson generalises past this one hole: a before/after harness proves nothing
about a surface it does not call, and "the diff was empty" is only evidence if
the diff could have been non-empty. `getSankrantisForYear` was the remaining
example — it publishes a **date**, not an instant, so a sankranti moving by
seconds is invisible here and only a day-boundary flip would show, at which
point the harness reports a moved festival date with no way to say whether the
ephemeris improved or regressed.

That one is now covered by a fixture rather than by the harness, because it
cannot be covered by the harness: `tests/validation/tier2-sankranti-day-margin.test.ts`
computes the transit instant itself — the public API does not expose it — and
pins the margin against sunrise for the tightest case in the release, the 2025
Tula Sankranti at Reykjavik, where the two are **7.1 s** apart against a solar
accuracy worth 7.8 s. The general form of the lesson: when a published value is
a *quantisation* of a continuous one, the harness can only see the quantised
leaf, and the continuous one needs its own fixture.

The same shape appeared a second time this session, in a different disguise.
`EclipseInfo.magnitude` published an obscuration for the whole of 4.x, and two
Tier 0 files measuring 909 canon rows never noticed, because every assertion
read the geometry module directly and none read what the panchang layer
published out of it. A harness that validates the producer proves nothing about
the wiring to the consumer.
