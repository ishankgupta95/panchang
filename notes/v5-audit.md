# panchang-ts v5 audit — performance, result shapes, packaging

Audit run 2026-08-06 against the `performance_improvement` branch (8,235 tests
passing, 104 files). Everything below is measured on this machine (Apple
M-series, Node 24) unless marked otherwise. This is a report, not a change —
no library code was modified.

Scope: performance, the shape of what we return, packaging. Correctness is
covered separately by the 2026-06-14 audit; open items from it are cross-
referenced in §5 rather than re-derived.

---

## 0. Headline

Three findings dominate:

1. **`sunrise`/`sunset`/every published `Date` is not a real instant.** It is
   the true instant shifted by the UTC offset, so `toISOString()`,
   `JSON.stringify`, `Intl`, date-fns and Temporal all silently produce wrong
   results. This is the single largest correctness-of-contract issue in the
   public API, and v5 is the only chance to fix it for years. (§2.1)
2. **The Chebyshev longitude cache is per-call, so a calendar scan rebuilds it
   every day.** Sharing blocks across calls cuts `GeoMoon` from 21.5 to 6.5 per
   day and `SunPosition` from 29.1 to 5.1, with all 8,235 tests still passing.
   (§1.2)
3. **The remaining cost is rise/set root-finding, not the longitude series.**
   `SearchRiseSet(Moon)` alone is 0.099 ms — ten times a `GeoMoon`. Caching
   lunar events the way solar events are already cached is the next big lever.
   (§1.3)

---

## 1. Performance

### 1.0 Where the time actually goes

CPU profile of a 4,000-day calendar scan (`getDailyPanchang`, all sections):

| Component | Self time |
|---|---|
| `astronomy-engine` total | **84.8%** |
| — `AddSol` + `CalcMoon` + `ADDN` + `Sine` + `GeoMoon` (Moon, ELP) | ~53% |
| — `VsopFormula` + `VsopSphereToRect` (Sun, VSOP87) | ~17% |
| — `precession_rot` / `nutation_rot` / `iau2000b` | ~4% |
| Our own code (`panchang.ts`, `cache.ts`, `slots.ts`, `search.ts`, …) | ~6% |
| GC | 1.3% |

**Our code is not the bottleneck and micro-optimising it is not worth doing.**
Every meaningful win comes from making fewer or cheaper ephemeris calls.

Measured cost of each primitive (cold, distinct days):

| Primitive | Cost |
|---|---|
| `SunPosition` | 0.0025 ms |
| `GeoMoon` | 0.0095 ms |
| `computeSunset` (cold) | 0.032 ms |
| `SearchRiseSet(Sun)` | 0.041 ms |
| `computeSunrise` (cold) | 0.064 ms |
| `getMoonset` | 0.067 ms |
| `getMoonrise` | 0.075 ms |
| `SearchRiseSet(Moon)` | **0.099 ms** |
| `getEclipseDuringDay` (amortised over 300 days) | 0.114 ms |

A rise/set search costs 4–10× a raw longitude evaluation, because it iterates
the same series internally. That reorders the whole optimisation list.

### 1.1 Current per-call cost

| `getDailyPanchang` call | Distinct days | Same day repeated |
|---|---|---|
| Default (all sections + end-times) | 1.10 ms | 0.53 ms |
| `computeEndTimes: false` | 1.11 ms | 0.62 ms |
| Without `'festivals'` | 0.80 ms | — |
| `sections: ['festivals','eclipse']` | 0.66 ms | — |
| `sections: []` | 0.31 ms | — |
| `sections: []` + `computeEndTimes: false` | 0.18 ms | 0.14 ms |
| `getInstantPanchang` | 0.25 ms | 0.21 ms |

Ephemeris calls per day, default call over a 365-day scan:
`GeoMoon=21.5  SunPosition=29.1  SearchRiseSet=4.6  Ecliptic=21.5`

### 1.2 P0 — Share Chebyshev blocks across calls

**Problem.** `LongitudeCache` is constructed inside each `getDailyPanchang`
call, so its interpolation blocks die with the call. A Moon block spans 4 days
and a Sun block 8, but a calendar scan rebuilds them *every day*: 10 Moon + 8
Sun evaluations per block build, thrown away immediately.

**Prototype result** (module-level block store, all 8,235 tests still passing):

| Metric | Now | Shared blocks |
|---|---|---|
| `GeoMoon` / day | 21.5 | **6.5** |
| `SunPosition` / day | 29.1 | **5.1** |
| default call, distinct days | 1.102 ms | 1.007 ms |
| `sections: []`, distinct days | 0.314 ms | **0.208 ms** (−34%) |
| `getInstantPanchang` | 0.246 ms | **0.174 ms** (−29%) |
| default call, same day repeated | 0.531 ms | **0.410 ms** (−23%) |

**Why it is safe.** A block is `ChebyshevLongitude` over
`[floor(t/BLOCK)·BLOCK, …]` sampled in **tropical** longitude — a pure function
of the block index alone. Ayanamsa is applied per read, so blocks are also
ayanamsa-independent and can be shared across systems. This is the same
order-independence argument `cache.ts` already makes for keying on the exact
instant; sharing changes *who builds* a block, never its contents. The full
suite passing (including `tests/unit/sections.test.ts`, which asserts narrowing
is output-neutral) is the evidence.

**Work.** Hoist `moonBlocks`/`sunBlocks` to module scope with an entry cap and
the same clear-on-overflow policy `EVENT_CACHE` uses in `sunrise.ts`. Small,
self-contained, high value. Note the headline default-call gain is modest (9%)
because that path is dominated by rise/set searches — the big wins are on
narrowed calls and `getInstantPanchang`.

### 1.3 P0 — Cache lunar rise/set the way solar rise/set is cached

`sunrise.ts` already has the right design: a canonical per-UTC-day event cache
keyed on `(direction, lat, lon, elevation, dayIndex)`, which made sunrise both
faster *and* single-valued. `moonrise.ts` has no equivalent, yet
`SearchRiseSet(Moon)` is the most expensive primitive in the library at
0.099 ms, and a default day needs moonrise twice over (once for `'moonTimes'`,
once for the festival block's Karva Chauth / Sankashti anchors — currently
deduped within a call, but not across days).

Expected: removes ~0.14 ms from any call carrying `'moonTimes'`, and more from
range helpers where consecutive days re-derive neighbouring lunations. It also
buys the same single-valuedness benefit sunrise got — worth having for the same
reason.

### 1.4 P1 — Fix the `computeEndTimes` cache-mode heuristic

`panchang.ts` picks the cache mode with `doEndTimes ? 'interpolated' : 'exact'`.
That is right for a narrowed call and wrong for a full one: with all sections on,
the festivals block alone makes enough longitude reads to pay for building the
blocks, so turning end-times *off* makes the call **slower** (0.53 → 0.62 ms
warm; a wash cold). Asking for less output should not cost more.

Fix: choose the mode from expected read volume — e.g. interpolate when
`doEndTimes || wantFestivals`. Must stay output-neutral; `sections.test.ts`
guards that. (Already filed as a background task.)

### 1.5 P1 — Route the eclipse guard through the call's cache

`eclipse.ts` calls `getTropicalMoonLongitude` / `getTropicalSunLongitude`
directly rather than through the call's `LongitudeCache`. The syzygy guard
itself is well-designed (4 evaluations to skip a search costing hundreds — keep
it), but those 4 evaluations are full ELP/VSOP87 runs that the interpolated
cache could answer for free. Measured: `sections: ['eclipse']` costs the same
21.5 `GeoMoon`/day as a full default call.

Fix: expose tropical accessors on `LongitudeCache` and thread them into
`getEclipseDuringDay`. Same pattern the rest of `panchang.ts` already uses.

### 1.6 P2 — Small, cheap cleanups in the search layer

- `findDailyElements` recomputes `getIndexAtTime(nextSunriseUtc)` inside its
  loop (`search.ts:284`) though it is loop-invariant. Cheap through the memo,
  free to hoist.
- `findTransitionTime` probes `getIndexAtTime(hi)` up front on every element to
  confirm the window brackets a transition, then the secant solve re-probes the
  same bracket. Worth checking whether the verification probe can be reused.
- `Object.assign({}, element, {…})` per element (`search.ts:286,303`) —
  measurable only in aggregate; low priority given §1.0.

### 1.7 What is already good — do not touch

The Chebyshev interpolation, the secant solve, the syzygy guard, the canonical
solar-event cache, and the `sections` mechanism are all well-designed and
well-documented, with the measurements recorded in the source. The reasoning in
`cache.ts` and `search.ts` about order-independence is genuinely load-bearing —
any change here must preserve it, and the existing docs explain exactly why.

---

## 2. Result shapes — are they industry standard?

### 2.1 P0 — Published `Date`s are not instants

This is the big one.

```
result.sunrise.toISOString()      2025-01-14T07:09:44.172Z
true sunrise .toISOString()       2025-01-14T01:39:44.172Z
difference                        330 minutes (exactly the IST offset)
```

Every `Date` we return is `trueInstant + offsetMinutes`, so its `getTime()` is
not the moment the event happened. The README documents reading it with
`getUTC*`, which works — but only if the consumer never does anything else with
the value. What breaks silently:

| Consumer does | Result |
|---|---|
| `JSON.stringify(result)` | `"2025-01-14T07:09:44.172Z"` — wrong instant, labelled `Z` |
| `Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata'})` | **12:39 pm** instead of 07:09 am |
| `sunrise < new Date()`, sorting, diffing against a real timestamp | off by the offset |
| date-fns / luxon / `Temporal.Instant.fromEpochMilliseconds` | off by the offset |
| Storing in a DB `timestamptz` | off by the offset |

The industry convention is unambiguous: a `Date` is an absolute instant;
wall-clock rendering is a separate, later step. Temporal reached **Stage 4 in
March 2026** and ships in Chrome 144+ and Firefox 139+, with
`Temporal.ZonedDateTime` as the type that actually models "an instant *in* a
zone" — which is what this library has been hand-rolling incorrectly.

**Recommended v5 shape.** Return true instants, and make the wall-clock
reading explicit rather than implicit:

```ts
sunrise: Date          // real instant — .getTime() is correct epoch ms
sunriseLocal: string   // "2025-01-14T07:09:44+05:30" — offset-carrying ISO
```

plus an exported `formatInZone(date, tz)` helper. An offset-carrying ISO string
is the one representation that survives JSON, is unambiguous, parses correctly
everywhere, and converts to `Temporal.ZonedDateTime` in one call.

Migration is mechanical for consumers (`getUTCHours()` → read `sunriseLocal`,
or format the instant) and it is a genuine breaking change — which is exactly
why it belongs in v5 and not v5.1. This should be the flagship change of the
release.

If you would rather not move that far in one step, the minimum viable version
is to add the `*Local` ISO strings now and keep the shifted `Date`s deprecated
for one major — but that carries the bug forward for another year.

### 2.2 P0 — `_debug` is declared public and never populated

`DailyPanchangResult._debug?: { totalMs, sunriseMs, elementsMs, endTimesMs }`
exists in the published type and is written **nowhere** in `src/`. It is dead
API surface that promises timing data we do not emit. Delete it in v5. (If
timing is wanted, it belongs behind an explicit option, and returning
non-deterministic values in a result object that consumers may snapshot or
cache is a bad default anyway.)

### 2.3 P1 — `suryaNakshatra` is typed as `RashiInfo`

`computeSuryaNakshatra` (`rashi.ts:31`) returns `RashiInfo`, whose `index` is
documented as *"0 = Mesha … 11 = Meena"*. The value it actually carries is
`nakshatraOf(siderealSun)` — 0..26. The type is wrong and its doc comment
actively misleads: anyone indexing a 12-element rashi array by it gets silent
garbage for two thirds of the year.

Fix: give it its own type (or reuse the nakshatra shape). Cheap, and a
type-level break that belongs in a major.

### 2.4 P1 — Optional-vs-null is inconsistent

The result mixes three conventions for "not applicable":

- `bhadra: BhadraInfo | null`, `varjyam: TimePeriod | null`, `eclipse: … | null`
- `chandraBalam?: ChandraBalamInfo`, `tarabala?: TarabalaInfo` (present only
  when the matching option was passed)
- `panchakaRahita: TimePeriod[]` (empty array), `festivals: FestivalInfo[]`

Consumers cannot predict which they will get. Pick one rule and apply it: for a
field whose absence depends on *input options*, the modern TS answer is a
conditional return type keyed on the options object, so passing `janmaRashi`
narrows `chandraBalam` to non-optional. Failing that, make everything `| null`
and always present — predictable beats clever.

### 2.5 P1 — Redundant aliases and naming drift

- `dayDurationMinutes` / `dinamanaMinutes` and `nightDurationMinutes` /
  `ratrimanaMinutes` are the same numbers under two names. Keep one pair
  (I would keep the Sanskrit and document the English as the meaning), or keep
  both but say plainly in the type that they are aliases.
- Casing drifts: `chandramasa` vs `chandraRashi` vs `suryaNakshatra` vs
  `masaSystem`. `chandramasa` is the odd one out.
- `masa` (`{index, name}`) sits next to `chandramasa` (`ChandraMasaInfo`) with
  no doc explaining that one is solar and the other lunar. A reader has to
  guess.

### 2.6 P2 — 50 flat top-level fields

`DailyPanchangResult` has ~50 fields in one flat namespace, mixing five
categories (elements, sun/moon times, muhurtas, inauspicious periods, calendar).
Grouping (`result.muhurtas.abhijit`, `result.inauspicious.rahuKalam`) would be
more discoverable and would let consumers destructure by concern.

I would **not** do this in v5 unless §2.1 is also happening — it is a large
break for ergonomic gain only, and it is much cheaper to do it in the same
release as the Date change than as a second migration later. If you do both,
do them together.

### 2.7 P2 — `timezone` in the result is lossy

Options accept `number | string`, the result carries `timezone: number`. Pass
`'America/New_York'` and you cannot tell from the result which zone produced
it — which matters precisely because of §2.1. Echo the resolved zone back:
`{ timezone: { offsetMinutes: number; zone?: string } }`.

Related: `resolveUtcOffset` resolves the offset **once** per call from a
reference date, so a day containing a DST transition is computed at a single
offset. Correct for almost every day; worth documenting the limit explicitly
rather than the current blanket "DST resolves automatically".

---

## 3. Packaging & bundle

**Tree-shaking works.** Minified+bundled from `dist/index.js`:

| Import | Minified | Gzipped |
|---|---|---|
| `getDailyPanchang` only | 141 KB | 49 KB |
| `computeRashiChart` only | 101 KB | 36 KB |
| everything (`import * as`) | 207 KB | 71 KB |

Most of that is `astronomy-engine` (412 KB raw ESM). `sideEffects: false` is
set and the exports map is correct. No action needed.

### 3.1 P1 — The static tables are 3.8× larger than they need to be

> **Updated 2026-08-06.** The three bundled JSONs have since been **removed**
> (`src/data/` is gone; `build*Table` + an engine-free reader with a required
> `source` replaces them). The sizes below therefore no longer describe what the
> package ships — the shipped readers are now ~1.5 KB each. They describe what
> `build*Table` **emits**, i.e. the file a consumer caches and parses in their
> own app, so the finding stands and moves to Phase 37.4.


| File | On disk | Bundled JS | Gzipped |
|---|---|---|---|
| `src/data/festivals.json` | 647 KB (pretty-printed) | 726 KB | 35 KB |
| `src/data/moonPhases.json` | 197 KB | 231 KB | 10 KB |
| `src/data/eclipses.json` | 12 KB | 15 KB | — |

Both repeat every localized string at every occurrence:

- festivals: 2,112 entries → **83 unique name objects**, 59 unique descriptions.
  Dictionary-encoding gives 260 KB → **68 KB** of JSON (26%).
- moon phases: 396 events → **4 unique names**, 4 unique descriptions. The name
  is 100% derivable from the `phase` field already present. 87 KB → **23 KB**.

Gzip already hides this on the network (35 KB), so **this is a parse-time and
memory win, not a download win** — which is exactly the constraint that matters
on Hermes, where 726 KB of object literal is parsed at startup. The bundled JS
also carries 3,167 `\uXXXX` escapes inflating the Devanagari.

This dovetails with the `key` field just added to `FestivalInfo`: the static
table does *not* carry `key`, so it is both larger and less useful than the
engine output. Fixing both together is one coherent change — emit `key` +
a string dictionary, resolve names at read time.

### 3.2 P2 — Both locales are always bundled

`i18n/resolver.ts` statically imports `en` and `hi` into a lookup record, so an
English-only app ships the Hindi tables and vice versa. Small (~250 lines each)
but structurally unshakeable. If locale count grows this becomes the right
thing to restructure; at two locales it is a judgement call.

---

## 4. Suggested sequencing

**Ship in v5 (breaking, and the reason to have a major):**

1. Real `Date` instants + `*Local` ISO strings + `formatInZone` (§2.1)
2. Delete `_debug` (§2.2)
3. Fix `suryaNakshatra`'s type (§2.3)
4. Settle optional-vs-null (§2.4) and the alias/naming drift (§2.5)
5. Echo the resolved timezone (§2.7)
6. Static tables: `key` + dictionary encoding (§3.1)

**Ship in v5 (non-breaking, pure win):**

7. Share Chebyshev blocks (§1.2)
8. Cache lunar rise/set (§1.3)
9. Fix the cache-mode heuristic (§1.4)
10. Route the eclipse guard through the cache (§1.5)
11. Search-layer cleanups (§1.6)

**Decide explicitly:** grouping the result object (§2.6). Only worth it if
bundled with §2.1; otherwise defer to v6.

Items 7–11 together should take the default distinct-day call meaningfully
below the current 1.10 ms and roughly halve `sections: []` and
`getInstantPanchang`. I would do 7 first — it is the smallest diff with the
largest proven effect, and the prototype already passes the suite.

---

## 5. Cross-references, not re-audited here

The 2026-06-14 correctness audit covered element rules, dashas, ashtakavarga,
samvat and eclipse sutak, and its fixes are applied. Two of its deferred items
are now resolved on this branch (the Lahiri ayanamsa 38″ gap; the 60 s cache
bucketing). Still open from it and worth a decision during v5:

- Sarvartha Siddhi table reconciliation against a full year of Drik
- Special yogas evaluated at a sunrise snapshot only (no window intersection,
  no start/end exposed) — note this is *also* an API-shape question, since every
  other window in the result carries `start`/`end`
- Moonset calendar-day convention
- ~17 subsystems never deep-audited (shadbala, yogas catalog, divisionals,
  matching, varshaphala, KP/prashna, festivals, convert/yearly)

One item spotted in passing but **not verified against Drik**, so treat it as a
question rather than a finding: `computeDurMuhurta` always returns exactly two
windows for every weekday. Some published almanacs show one on certain varas.
Worth checking before v5 rather than after.
