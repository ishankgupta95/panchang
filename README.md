# panchang-ts

[![npm version](https://img.shields.io/npm/v/panchang-ts)](https://www.npmjs.com/package/panchang-ts)
[![license](https://img.shields.io/npm/l/panchang-ts)](./LICENSE)

Pure TypeScript Hindu Panchang (almanac), Jyotish, and Birth Chart calculations.
Zero runtime dependencies. Works offline in React Native (Hermes), Node.js, and browsers.

**Fast** (~0.25 ms trimmed, ~0.41 ms full) · **Typed** (full TypeScript) · **Offline** (pure JS math) · **8,368 tests across 121 files**

> 📖 **Full documentation: [dharmagya.app/docs/panchang-ts](https://dharmagya.app/docs/panchang-ts)**
> This README covers install, quick start, and the 4.x → 5 migration in full, plus a per-feature
> quick reference. The complete reference — every option, result field, table format, accuracy
> bound and performance note — lives on the docs site.

---

## Install

```bash
npm install panchang-ts
# or: pnpm add panchang-ts / yarn add panchang-ts
```

---

## Quick Start

```typescript
import { getDailyPanchang } from 'panchang-ts';

const result = getDailyPanchang(
  new Date(2025, 0, 14),                      // January 14, 2025
  { latitude: 23.1765, longitude: 75.7885 },  // Ujjain, India
  { timezone: 330 },                          // IST = UTC+5:30 = 330 minutes
);
// → DailyPanchangResult | null. Null only at polar latitudes where
//   sunrise can't be computed. Anywhere else, narrow with `if (!result) return;`.

console.log(result!.angas.tithis[0].name);          // "Krishna Chaturdashi"
console.log(result!.angas.nakshatras[0].name);      // "Mrigashira"
console.log(result!.angas.vara.name);               // "Mangalawara"
console.log(result!.calendar.chandramasa.name);        // "Magha"
console.log(result!.calendar.samvat.vikramSamvat);     // 2081
```

### Reading Output Times

Every `Date` in a result is a **real instant** — `.getTime()` is the correct
epoch millisecond. Every instant has a `*Local` companion: an offset-carrying
ISO 8601 string, which is what you want for display.

```typescript
result!.sun.rise;            // Date — 2025-01-14T01:39:44.172Z (the actual moment)
result!.sun.riseLocal;       // "2025-01-14T07:09:44.172+05:30"
result!.inauspicious.rahuKalam.start;    // Date
result!.inauspicious.rahuKalam.startLocal;

// Just the wall clock:
result!.sun.riseLocal.slice(11, 16);   // "07:09"

// Anything else works too, because the Date is genuinely correct:
new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', timeStyle: 'short' })
  .format(result!.sun.rise);           // "7:09 am"
Temporal.Instant.from(result!.sun.riseLocal);
```

For an instant you derive yourself, `formatInZone` renders it the same way:

```typescript
import { formatInZone } from 'panchang-ts';
const noon = new Date((result!.sun.rise.getTime() + result!.sun.set.getTime()) / 2);
formatInZone(noon, result!.timezone.offsetMinutes);  // "2025-01-14T12:27:31.086+05:30"
```

> **Changed in v5 — this is the breaking change most likely to affect you.**
> Through 4.x every published `Date` was the true instant *shifted* by the UTC
> offset, and the README told you to read it back with `getUTC*`. That worked
> only as long as you did nothing else with the value: `JSON.stringify` emitted
> a wrong instant labelled `Z`, `Intl` with a `timeZone` rendered 12:39 pm for
> an 07:09 am sunrise, and any comparison, diff, database write, date-fns or
> Temporal call was off by the offset.
>
> Migration is mechanical: `x.getUTCHours()` → read `xLocal`, or format the
> instant. See [Upgrading from 4.x](#upgrading-from-4x).

`moon.rise` / `moon.set` can be `null` — the Moon occasionally does not rise or
set on a given calendar day, which is normal. `moon.riseLocal` / `moon.setLocal`
are `null` exactly when they are.

### The result is grouped

`DailyPanchangResult` has seven groups plus a handful of top-level fields.
Through 4.x it was ~50 flat fields; the groups are what tell you where to look.

| Group | Holds |
|---|---|
| `sun` | `rise` / `set` / `nextRise` (+ `*Local`), day and night lengths, the Sun's `siderealLongitude` and `nakshatra` |
| `moon` | `rise` / `set` (+ `*Local`), the Moon's `siderealLongitude` and `rashi` |
| `angas` | the five limbs — `tithis`, `nakshatras`, `yogas`, `karanas`, `vara` |
| `calendar` | `masa` (solar), `chandramasa` (lunar), `samvat` |
| `muhurtas` | `abhijit`, `brahma`, `vijaya`, `godhuli`, `nishita`, `amritKala`, `madhyahna`, `pratahSandhya`, `sayahnaSandhya`, `doGhati` |
| `inauspicious` | `rahuKalam`, `gulikaKalam`, `yamaganda`, `durMuhurta`, `varjyam`, `bhadra`, `gandaMula`, `panchaka`, `panchakaInfo`, `panchakaRahita` |
| `periods` | `choghadiya`, `hora`, `gowri` |

Top level: `date`, `location`, `timezone`, `ayanamsa`, `specialYogas`,
`anandadiYoga`, `festivals`, `eclipse`, `chandraBalam`, `tarabala`.

**Nothing is optional.** Every field is always present. A value that does not
apply is `null`; a collection that does not apply is `[]`. That holds whether
the reason is the domain (no Bhadra window today) or your options (you did not
pass `janmaRashi`, so `chandraBalam` is `null`) — the result *shape* never
depends on what you passed.

`getInstantPanchang` uses the same group names for the subset an instant can
answer: `sun`, `moon`, `angas`, `calendar`, `inauspicious`. There is no
`muhurtas` or `periods`, because those are properties of a Hindu *day*.

### `getDailyPanchang` vs `getInstantPanchang`

| Use case | Use |
|---|---|
| Daily calendar, festivals, muhurtas, time-slots (Choghadiya/Hora/Gowri), eclipses with sutak | `getDailyPanchang` |
| Single-moment snapshot ("what's active right now?") or birth-chart casting | `getInstantPanchang` |

`getInstantPanchang` emits a `festivals` field but only checks rule predicates
at the given instant — it skips canonical-time refinements (madhyahna /
pradosha / nishita / chandrodaya), transit-based Sankranti, and Smarta/Vaishnava
Ekadashi split. For reliable festival dating, use `getDailyPanchang`.

---

## Upgrading from 4.x

Three changes move numbers that 4.x produced, and one option is gone.

### Lahiri ayanamsa corrected by +38″

The library's Lahiri constant sat 38 arcseconds behind DrikPanchang's — it used
`23.853211°` at J2000 (the widely-repeated 23° 51′ 11.6″ figure) where Drik
computes `23.863801°`. The replacement was solved from Drik's own published
values across 1950–2050, which agree on it to within 0.01″ — a century-wide
baseline, so the precession polynomial is pinned too, not just the epoch
constant. Every sidereal output moves with it:

| Output | Effect |
|---|---|
| Nakshatra end-times | ~69 s later than 4.x (carries the ayanamsa once) |
| Yoga end-times | ~129 s later than 4.x (carries it twice) |
| Planetary longitudes, rashi, pada, lagna, divisionals, dashas | shifted +0.0106° |
| Tithi / karana end-times | unchanged — Moon − Sun cancels the ayanamsa |
| Raman / KP / True Chitra / Thirukanitham | moved by the same +38″; their offsets from Lahiri are preserved |

Worst-case end-time drift vs Drik dropped from 131 s to 60 s, and the sign split
by ayanamsa exposure — nakshatra and yoga early, tithi and karana late — is gone.
If you have snapshot tests or cached charts from 4.x, expect them to need
re-pinning.

### ΔT now uses measurement, so every published time moves ~6 s

4.x took ΔT (TT − UT) entirely from Espenak–Meeus. Its post-2005 branches are an
extrapolation published in 2006, and Earth's rotation did not follow it — by
2026 the model reads about **5.9 s high**, drifting a further ~0.6 s each year.
Because this library reports *times*, that lands directly on published values.

v5 takes ΔT from the leap-second chain (`32.184 + (TAI − UTC)`, exact, and
within the 0.9 s band leap seconds maintain) wherever ΔT has actually been
measured, and resumes Espenak–Meeus beyond it carrying the offset it had
accrued. Against JPL Horizons the measured era now agrees to **0.005 s** at
every decade from 1980, where 4.x was seconds out.

| Output | Effect |
|---|---|
| Tithi / nakshatra / yoga / karana end-times | ~5.7 s later for 2025 dates, growing with the model's drift |
| Sankranti and other transit instants | same shift — it is one uniform correction, not per-element |
| Sunrise / sunset / moonrise / moonset | barely moved — the error scales against the 15°/hr sky rotation |
| Dates a panchang element is *filed under* | unchanged except where a transit sits within seconds of sunrise |

That last row is the one to know about. `computeSankrantisForYear` publishes a
date, and the date is decided by whether the transit precedes sunrise. The 2025
Tula Sankranti at Reykjavik is such a case: it still falls on Oct 16, but its
margin narrowed from 7.1 s to 1.4 s. Locations at high latitude with a transit
near sunrise are where a day could flip.

### Instant-mode vara was wrong after ~19:00

`getInstantPanchang` located sunrise by searching forward from `date − 12 h`.
For an evening instant that start point is already past the morning's sunrise,
so it found *tomorrow's* and rolled the weekday back a day. Any query after
roughly 7 pm returned the previous vara — and with it the wrong Rahu Kalam,
Gulika Kalam, Yamaganda, Choghadiya, Hora, Anandadi yoga and special yogas.
`getDailyPanchang` was never affected. If you cached instant-mode results from
4.x for evening timestamps, discard them.

### `precision` removed

`precision: 'standard' | 'high'` and the `Precision` type no longer exist.
Element transitions are now solved by secant iteration, which converges to the
root rather than stopping at a fixed tolerance, so there is nothing left for the
option to select — and the tighter setting no longer buys anything. Removing it
from your options object is the whole migration; leaving it in is a type error,
not a silent no-op.

### Sunrise is single-valued per location-day

Solar rise/set is computed from a canonical anchor and cached per location-day,
so it no longer depends on which instant the caller happened to start searching
from. Values shift by ≤108 ms vs 4.x, and two calls for the same day now agree
exactly instead of differing by up to 109 ms. Windows derived proportionally
from the day length — Varjyam, Bhadra, the slot systems — move by a little more
than that. This removes an inconsistency rather than introducing an
approximation: 4.x returned a different sunrise depending on which caller asked.

### Moonrise and moonset are single-valued per location-day

The same treatment sunrise received, now applied to the Moon. `getMoonrise` /
`getMoonset` resolve through a canonical per-UTC-day cache, so an event has one
timestamp no matter which caller asks or from which instant they searched.
Published `moon.rise` / `moon.set` shift by **≤182 ms** vs 4.x. Nothing else in the
result moves — verified over 11,520 daily results across six locations and three
centuries: zero changes to any index, name, boolean, festival date or other
timestamp.

### `read*` for tables, `compute*` for the engine

`getFestivalsForYear` read a pre-built table; `getFestivalsInRange` ran the
engine. Two near-identical names, completely different inputs and semantics. v5
settles one convention across all four families — festivals, eclipses, moon
phases and muhurta:

| 4.x | v5 | what it does |
|---|---|---|
| `getFestivalsForYear` | `readFestivalsForYear` | reads a table |
| `getFestivalsForDate` | `readFestivalsForDate` | reads a table |
| `getFestivalsYearRange` | `readFestivalsYearRange` | reads a table |
| `getEclipsesForYear` / `ForDate` / `YearRange` | `readEclipsesForYear` / … | reads a table |
| `getMoonPhasesForYear` / `ForDate` / `YearRange` | `readMoonPhasesForYear` / … | reads a table |
| — | `readMuhurtaForYear` / `ForDate` / `YearRange` | **new** — reads a table |
| — | `readBestMuhurtaDays` | **new** — top-scoring days |
| `getFestivalsInRange` | `computeFestivalsInRange` | runs the engine |
| `getEclipsesInRange` | `computeEclipsesInRange` | runs the engine |
| `getMoonPhasesInRange` | `computeMoonPhasesInRange` | runs the engine |
| `findAuspiciousDates` | `computeAuspiciousDatesInRange` | runs the engine |
| `getEkadashiDatesForYear` | `computeEkadashiDatesForYear` | runs the engine |
| `getSankrantisForYear` | `computeSankrantisForYear` | runs the engine |

**Every 4.x name still works** — they are deprecated aliases pointing at the same
functions, kept through v5. Nothing breaks today; the old names will go in v6.

New single-year entry points, the shape most callers reach for first:

```ts
computeFestivalsForYear(2027, location, { timezone: 330 });
computeEclipsesForYear(2027, location, { timezone: 330 });
computeMoonPhasesForYear(2027, { timezone: 330 });
computeAuspiciousDatesForYear(2027, vivahRule, location, { timezone: 330 });
```

### `buildMuhurtaTable` + the `panchang-ts/muhurta` subpath

Festivals, eclipses and moon phases each had a builder and an engine-free
reader; muhurta had neither, so finding auspicious dates meant running the full
engine on device for every query. v5 completes the family:

```ts
// build once (build time, or first launch), then persist the JSON
import { buildMuhurtaTable, vivahRule } from 'panchang-ts';
const table = buildMuhurtaTable({
  rule: vivahRule, location: DELHI, timezoneOffsetMinutes: 330,
  startYear: 2026, endYear: 2031,
});

// read it back with no astronomy code in the bundle (~1.7 KB)
import { readBestMuhurtaDays } from 'panchang-ts/muhurta';
readBestMuhurtaDays(table, 5);   // top 5 days, highest score first
```

Only days that pass the rule are stored unless you pass `includeFailures: true`.

### Built tables are dictionary-encoded and carry `key`

`build*Table` now emits a `_dict` of unique entries with each day holding
indices, rather than repeating every localized string at every occurrence. A
10-year festival table goes from 315 KB to **89.9 KB (28.5%)**; a 10-year
moon-phase table from 106 KB to **29.7 KB (28.0%)**. Resolved output is
identical — verified across every year and both locales.

Gzip already hid most of this on the wire, so the win is **parse time and
resident memory**, which is the constraint that actually bites on Hermes.

Festival table entries also gained the stable `key` the engine has been
returning since 4.x, so a table is no longer both larger *and* less useful than
engine output.

**Tables you already cached still read.** The reader detects the format, so a v1
table built with 4.x keeps working; only `key` is unavailable from it, and comes
back as `''`.

### Published `Date`s are real instants — the flagship change

```diff
- result.sunrise.getTime()      // NOT when sunrise happened (off by the UTC offset)
- result.sunrise.getUTCHours()  // the documented 4.x idiom
+ result.sun.rise.getTime()     // correct epoch ms
+ result.sun.riseLocal          // "2025-01-14T07:09:44.172+05:30"
```

Applies to **every** `Date` in `DailyPanchangResult` and to every `TimePeriod` —
`sun.rise`, `sun.set`, `sun.nextRise`, `moon.rise`, `moon.set`, all the muhurtas
and inauspicious periods, all four slot systems, the element
`startTime`/`endTime` arrays, the eclipse contacts and sutak window. Each gains
a `*Local` companion: `sun.riseLocal`, `inauspicious.rahuKalam.startLocal`,
`angas.tithis[0].endTimeLocal`, and so on.

| you had | you now write |
|---|---|
| `r.sun.rise.getUTCHours()` | `r.sun.riseLocal.slice(11, 13)` |
| `` `${h}:${m}` `` from `getUTC*` | `r.sun.riseLocal.slice(11, 16)` |
| `r.inauspicious.rahuKalam.start.getUTCHours()` | `r.inauspicious.rahuKalam.startLocal.slice(11, 13)` |
| `r.angas.tithis[0].endTime` for display | `r.angas.tithis[0].endTimeLocal` |
| a `Date` you derived yourself | `formatInZone(d, r.timezone.offsetMinutes)` |

`getInstantPanchang` results carry **no** `*Local` fields: that call takes no
timezone, so there is no zone to render a wall clock in.

**Cost:** rendering the strings adds ~0.04 ms per daily panchang — invisible on
a cold call and ~20% of a fully cached warm one. The release warms to
**0.17 ms**, against published 4.3.1's **6.20 ms**.

### `result.timezone` is now an object

```diff
- result.timezone            // 330
+ result.timezone            // { offsetMinutes: 330, zone: 'Asia/Kolkata' }
+ result.timezone.offsetMinutes
```

`options.timezone` has always accepted `number | string`, but the result carried
only a number — so passing `'America/New_York'` produced a result that could not
say which zone produced it. `zone` is present only when you passed a zone name.

**The DST limit, now stated explicitly.** The offset is resolved **once per
call** from a reference date, so a Hindu day containing a DST transition is
computed at a single offset throughout. Correct for almost every day; on the one
or two transition days a year, times after the jump are shifted by its size.
4.x documented this as a blanket "DST resolves automatically", which was not the
whole truth.

### The result object is grouped

`DailyPanchangResult` had ~50 flat top-level fields mixing five categories.
v5 sorts them into seven groups — see [The result is grouped](#the-result-is-grouped)
for the full table. This is a large break, and it lands in the same release as
the `Date` change on purpose: migrating both at once is one pass over your read
sites, not two.

Every rename, in full:

| 4.x | v5 |
|---|---|
| `sunrise` / `sunset` / `nextSunrise` | `sun.rise` / `sun.set` / `sun.nextRise` |
| `sunriseLocal` / `sunsetLocal` / `nextSunriseLocal` | `sun.riseLocal` / `sun.setLocal` / `sun.nextRiseLocal` |
| `dayDurationMinutes` / `nightDurationMinutes` | `sun.dayDurationMinutes` / `sun.nightDurationMinutes` |
| `dinamanaMinutes` / `ratrimanaMinutes` | `sun.dinamanaMinutes` / `sun.ratrimanaMinutes` |
| `siderealSunAtSunrise` | `sun.siderealLongitude` |
| `suryaNakshatra` | `sun.nakshatra` |
| `moonrise` / `moonset` | `moon.rise` / `moon.set` |
| `moonriseLocal` / `moonsetLocal` | `moon.riseLocal` / `moon.setLocal` |
| `siderealMoonAtSunrise` | `moon.siderealLongitude` |
| `chandraRashi` | `moon.rashi` |
| `tithis` / `nakshatras` / `yogas` / `karanas` / `vara` | `angas.*` (same names) |
| `masa` / `chandramasa` / `samvat` | `calendar.*` (same names) |
| `abhijitMuhurta` / `brahmaMuhurta` / `vijayaMuhurta` | `muhurtas.abhijit` / `muhurtas.brahma` / `muhurtas.vijaya` |
| `godhuliMuhurta` / `nishitaMuhurta` | `muhurtas.godhuli` / `muhurtas.nishita` |
| `amritKala` / `madhyahna` / `pratahSandhya` / `sayahnaSandhya` | `muhurtas.*` (same names) |
| `doGhatiMuhurta` | `muhurtas.doGhati` |
| `rahuKalam` / `gulikaKalam` / `yamaganda` / `durMuhurta` | `inauspicious.*` (same names) |
| `varjyam` / `bhadra` / `gandaMula` / `panchaka` / `panchakaRahita` | `inauspicious.*` (same names) |
| `choghadiya` / `hora` | `periods.choghadiya` / `periods.hora` |
| `gowriPanchangam` | `periods.gowri` |
| `eclipse.magnitude` (disc *area*) | `eclipse.obscuration` — same value; the new `eclipse.magnitude` is the *diameter* fraction catalogues publish, and is negative for a penumbral lunar eclipse |

Unmoved: `date`, `location`, `timezone`, `ayanamsa`, `specialYogas`,
`anandadiYoga`, `festivals`, `eclipse`, `chandraBalam`, `tarabala`.

For `getInstantPanchang`: `tithi` / `nakshatra` / `yoga` / `karana` / `vara` →
`angas.*`; `siderealSun` → `sun.siderealLongitude`; `siderealMoon` →
`moon.siderealLongitude`; `suryaNakshatra` → `sun.nakshatra`; `chandraRashi` →
`moon.rashi`; `chandramasa` / `samvat` → `calendar.*`; `panchaka` / `gandaMula`
→ `inauspicious.*`.

### One rule for "not applicable": always present, `null` or `[]`

4.x used three conventions and you could not predict which you would get —
`| null` for `bhadra` / `varjyam` / `eclipse`, `?`-optional for `chandraBalam` /
`tarabala`, and an empty array for `panchakaRahita` / `festivals`. v5 has one
rule: **every field is always present**, a value that does not apply is `null`,
and a collection that does not apply is `[]`.

```diff
- if ('chandraBalam' in r) …        // 4.x: field absent without janmaRashi
- r.chandraBalam!.house             // and the `!` was mandatory
+ if (r.chandraBalam !== null) …    // v5: always present, null when unasked
+ r.chandraBalam?.house
```

Only `chandraBalam` and `tarabala` changed behaviour; everything else already
followed the rule. `toBeUndefined()`-style checks against them become
`toBeNull()`.

### `suryaNakshatra` is typed as a nakshatra, not a rashi

Now published as `sun.nakshatra`. Its `index` has always been 0..26 (Ashwini …
Revati). Its *type* said `RashiInfo`, documented "0 = Mesha … 11 = Meena", so
anyone indexing a 12-element rashi array by it got silent garbage for two thirds
of the year. The runtime value is unchanged; the type is now
`NakshatraIndexInfo` and TypeScript will point at the misuse.

### `_debug` removed

`DailyPanchangResult._debug` was declared in the published type and written
nowhere in the library. It never carried data. If you referenced it, it was
always `undefined`.

### Alias fields documented rather than removed

`sun.dinamanaMinutes` / `sun.dayDurationMinutes` and `sun.ratrimanaMinutes` /
`sun.nightDurationMinutes` are the same numbers under classical and English
names. Both pairs stay — consumers use both vocabularies — and the types now say
plainly that they are aliases, never independently computed.

`calendar.chandramasa` keeps its casing beside `moon.rashi` and `sun.nakshatra`.
Renaming it would break every consumer for a casing preference. The type now
documents that `calendar.masa` is the **solar** month and `calendar.chandramasa`
the **lunar** one, which was previously left to guesswork.

### Additive, but worth knowing

- `EclipseInfo` / `EclipseSubtype` are now exported. 4.x shipped
  `getUpcomingLunarEclipse` and friends without the type they return.
- `festivals[].key` — stable, language-independent festival id. Match on this,
  never on `name`.
- `bhadra.locationName` — localized display name; `bhadra.location` stays the
  machine-readable key.
- `MuhurtaScore.factors` — structured scoring inputs alongside English `reasons`.
- `BirthChart.byPlanet` — the nine placements keyed by graha.
- `eclipse.description` is now localized. Under `language: 'hi'` it was
  previously emitted in English, including inside `festivals[].description`.
- `sections` on `getDailyPanchang` — opt into a narrower, cheaper call. See
  [Performance](#performance).

---

## Features at a Glance

| Category | Features |
|---|---|
| **Pancha Anga** | Tithi, Nakshatra, Yoga, Karana, Vara — with all intra-day transitions |
| **Lunar Calendar** | Chandra Masa (Purnimanta + Amanta), Adhika (leap) detection, Vikram + Shaka Samvat |
| **Solar Calendar** | Saura Masa, Surya Nakshatra, Sankranti (transit-based) |
| **Sun & Moon** | Sunrise, Sunset, Moonrise, Moonset (Meeus apparent-upper-limb), Chandra Rashi |
| **Auspicious Muhurta** | Brahma, Abhijit, Vijaya, Godhuli, Nishita, Madhyahna, Pratah/Sayahna Sandhya, Amrit Kala |
| **Inauspicious Periods** | Rahu Kalam, Gulika Kalam, Yamaganda, Dur Muhurta, Varjyam, Ganda Mula, Bhadra Kala, Panchaka |
| **Time-Slot Systems** | Choghadiya, Gowri Panchangam (Tamil "Nalla Neram"), Hora, Do Ghati, Panchaka Rahita |
| **Special Yogas** | Anandadi (28-cycle), Amrit Siddhi, Sarvartha Siddhi, Ravi/Guru Pushya, Dwi-/Tripushkar, Jwalamukhi, Aadal, Vidaal, Ravi |
| **Festivals (80+)** | Ekadashi (Smarta/Vaishnava split), Pradosha, Sankranti, classical (Diwali/Holi/Shivaratri…), regional across 21 states + Nepal |
| **Eclipses** | Solar/lunar detection, subtype, magnitude, horizon visibility, sutak window |
| **Planetary Positions** | All 9 grahas (sidereal) with rashi, nakshatra, pada, retrograde — mean or true Rahu/Ketu |
| **Dashas** | Vimshottari (3-level), Ashtottari, Yogini, Chara, Narayan |
| **Personal Transits** | Chandra Balam, Tarabala (9-cycle), Sade Sati |
| **Birth Chart** | Lagna, Bhava under 3 house systems, D1/D2/D3/D7/D9/D10/D12/D30, Planetary Dignity |
| **Compatibility & Doshas** | Ashtakoot (36-point), Pathu Porutham (Tamil 10-fold), Mangal, Kaal Sarp (12 subtypes), Pitru |
| **Strength & Aspects** | Drishti, Shadbala (6-fold), Ashtakavarga (Bhinna + Sarva, with reductions), Bhava Bala, Argala |
| **Yogas & Karakas** | 25 named yogas (with cancellations), 7- and 8-Karaka Jaimini |
| **Annual & Sensitive** | Varshaphala (Tajik + 27 Sahams), Tithi Pravesha, Arudha padas, Hora/Ghati/Bhava/Sripati lagnas, Upagrahas |
| **KP & Prashna** | KP sub-lord at any longitude, Placidus-KP cuspal sub-lords, KP significators, Prashna chart |
| **Muhurta Engine** | Configurable scoring + 13 stock occasions (vivah, griha pravesh, namakarana, …) |
| **Calendar Conversion** | Gregorian↔Hindu, Kali Yuga year, Hindu New Year, yearly Ekadashi/Sankranti/festival listings |
| **Localization** | English + Hindi (Devanagari) |
| **Configuration** | 5 ayanamsas (Lahiri, Raman, KP, True Chitrapaksha, Thirukanitham), 2 masa systems, 3 house systems |

---

## Used By

- [dharmagya.app](https://dharmagya.app) — Daily Panchang and Hindu calendar ([Play Store](https://play.google.com/store/apps/details?id=com.ishank1995.dharmagya))

---

# Feature Reference

A quick tour with runnable snippets. **Each section links to its full page on
the docs site** — every option, field, and caveat lives there.

## Pancha Anga & the daily result

📖 [Daily Panchang →](https://dharmagya.app/docs/panchang-ts/daily-panchang)

```typescript
const r = getDailyPanchang(date, location, { timezone: 330 })!;

r.angas.tithis.forEach(t => console.log(t.name, t.paksha, t.endTime));
r.angas.vara.name;                     // "Mangalawara"
r.calendar.chandramasa.isAdhika;       // true during leap months
r.muhurtas.brahma;                     // TimePeriod | null — and 9 more muhurtas
r.inauspicious.rahuKalam;              // { start, end } — and 9 more windows
r.periods.choghadiya.day[0].name;      // 16 Choghadiya + Gowri + 24 Hora slots
r.anandadiYoga.name; r.specialYogas;   // Anandadi + Amrit/Sarvartha Siddhi, …

// Single-instant snapshot:
import { getInstantPanchang } from 'panchang-ts';
const i = getInstantPanchang(new Date(), location)!;
console.log(i.angas.tithi.name, i.angas.nakshatra.name);
```

## Festivals (80+)

📖 [Festivals →](https://dharmagya.app/docs/panchang-ts/festivals)

```typescript
r.festivals.forEach(f => console.log(f.key, f.name, f.type, f.deferralDate));
// `name` is localized, so match on `key` — never on `name`:
const hasDiwali = r.festivals.some(f => f.key === 'diwali');

// Scope regional variants: 21 state slugs + 'nepal' + 'all' (default)
getDailyPanchang(jan14, chennai, { timezone: 330, region: 'tamil-nadu' });

// Pre-computed table: build once, cache the JSON, read engine-free.
import { buildFestivalsTable } from 'panchang-ts';
import { readFestivalsForYear, readFestivalsForDate } from 'panchang-ts/festivals';
```

No table ships with the package — festival dates are observer-dependent, so you
build one for your users' location and years (`npm run festivals:gen` is a
worked example).

## Eclipses & Moon Phases

📖 [Eclipses & Moon Phases →](https://dharmagya.app/docs/panchang-ts/eclipses-moon-phases)

```typescript
if (r.eclipse) {
  r.eclipse.kind; r.eclipse.subtype;       // 'solar'|'lunar', 'partial'|'total'|…
  r.eclipse.obscuration;                   // disc AREA covered, 0..1
  r.eclipse.magnitude;                     // catalogue DIAMETER fraction
  r.eclipse.sutakStart; r.eclipse.sutakEnd;
}

import { getUpcomingSolarEclipse, computeMoonPhasesInRange } from 'panchang-ts';
getUpcomingSolarEclipse(new Date(), loc, 365);
computeMoonPhasesInRange(start, end);      // precise new/quarter/full instants

// Engine-free tables: panchang-ts/eclipses and panchang-ts/moon-phases
```

## Muhurta Engine

📖 [Muhurta Engine →](https://dharmagya.app/docs/panchang-ts/muhurta)

```typescript
import { scoreMuhurta, computeAuspiciousDatesInRange, vivahRule } from 'panchang-ts';

const s = scoreMuhurta(new Date('2026-05-12'), DELHI, vivahRule, { timezone: 330 });
s.score;            // 0..100; passes when ≥ 50
s.factors;          // structured, stable codes — localize/filter on these
s.reasons;          // diagnostic English

computeAuspiciousDatesInRange(vivahRule, start, end, DELHI, { timezone: 330 });
```

13 stock rules (vivah, griha pravesh, namakarana, …) or your own pure-data
`MuhurtaRule`. Vara × Tithi yogas (Siddha, Amrita, Dagdha, …) are scored
jointly. Pre-compute a table with `buildMuhurtaTable` and read it back through
`panchang-ts/muhurta` (~1.7 KB, no astronomy code).

## Planetary Positions & Birth Charts

📖 [Birth Charts →](https://dharmagya.app/docs/panchang-ts/birth-chart)

```typescript
import {
  computePlanetaryPositions, computeLagna, computeBhava,
  computeRashiChart, computeNavamsa, computeDivisionalChart, computeDignity,
} from 'panchang-ts';

const g = computePlanetaryPositions(new Date(), 'lahiri');
g.jupiter.rashi.name; g.jupiter.nakshatra.pada; g.saturn.isRetrograde;

const d1 = computeRashiChart(birth, loc);       // houseSystem: whole-sign | equal | placidus-kp
d1.byPlanet.Mars.house;                          // keyed lookup, no linear scan
const d9 = computeNavamsa(birth, loc);           // + D2/D3/D7/D10/D12/D30
computeDignity('Mars', 9);                       // 'exalted'
```

## Dashas & Personal Transits

📖 [Dashas & Transits →](https://dharmagya.app/docs/panchang-ts/dashas)

```typescript
import {
  computeVimshottariDashaFromBirth, computeVimshottariPratyantar,
  computeAshtottariDasha, computeYoginiDasha, computeCharaDasha,
  computeNarayanDasha, computeSadeSati,
} from 'panchang-ts';

const vim = computeVimshottariDashaFromBirth(birth, 'lahiri');   // 3-level
computeSadeSati(natalMoonRashiIndex, new Date());
// Daily transits: pass janmaRashi / janmaNakshatra to getDailyPanchang
// and read r.chandraBalam / r.tarabala.
```

## Strength, Yogas & Karakas

📖 [Strength, Yogas & Karakas →](https://dharmagya.app/docs/panchang-ts/strength-yogas)

```typescript
import {
  computeAspects, computeShadbala, computeBhavaBala,
  computeAshtakavarga, computeYogas, computeJaiminiKarakas,
} from 'panchang-ts';

computeShadbala(birth, loc);                        // 6-fold, in Virupas
computeAshtakavarga(d1, { reductions: true });      // Bhinna + Sarva + Sodhana
computeYogas(d1);                                   // ~25 named, with bhanga
computeJaiminiKarakas(d1, { variant: '8-jaimini' });
```

## Compatibility & Doshas

📖 [Matching & Doshas →](https://dharmagya.app/docs/panchang-ts/matching-doshas)

```typescript
import {
  computeAshtakoot, computePathuPorutham,
  computeMangalDosha, computeMangalCompatibility, computeKaalSarp, computePitruDosha,
} from 'panchang-ts';

computeAshtakoot({ rashi: 4, nakshatra: 9 }, { rashi: 0, nakshatra: 1 });
// → { totalScore: 0..36, koots: KootScore[8], cancellations: string[] }

computeMangalCompatibility(boyChart, girlChart);   // Manglik is a PAIRWISE verdict
computeKaalSarp(d1);                               // 12 subtypes by Rahu's house
```

## Annual Charts, Sensitive Points, KP & Prashna

📖 [Annual Charts →](https://dharmagya.app/docs/panchang-ts/annual-charts) ·
[KP & Prashna →](https://dharmagya.app/docs/panchang-ts/kp-prashna)

```typescript
import {
  computeVarshaphala, computeTithiPravesha, computeArudhas,
  computeHoraLagna, computeGhatiLagna, computeBhavaLagna, computeSripatiLagna,
  computeUpagrahas, computeArgala,
  computeKpSubLord, computeKpCuspalSubLords, computeKpSignificators,
  computePrashnaChart,
} from 'panchang-ts';

const v = computeVarshaphala(birth, 30, loc);      // Tajik + Muntha + 27 Sahams
computeTithiPravesha(birth, 30, loc);              // preserves natal tithi exactly
computeKpSubLord(45.5).subLord;                    // 243 sub-divisions
computePrashnaChart(questionTime, querentLoc);     // horary, Placidus-KP default
```

## Calendar Conversion

📖 [Calendar Conversion →](https://dharmagya.app/docs/panchang-ts/calendar-conversion)

```typescript
import {
  convertGregorianToHindu, convertHinduToGregorian,
  getKaliYugaYear, getHinduNewYear,
  computeEkadashiDatesForYear, computeSankrantisForYear,
} from 'panchang-ts';

convertHinduToGregorian(
  { vikramSamvat: 2083, masaIndex: 0, paksha: 'shukla', pakshaTithi: 9 },
  DELHI, { timezone: 330 },
);                                                  // → Date[] (Rama Navami VS 2083)
getHinduNewYear(2026, 'tamil-nadu', DELHI, { timezone: 330 });  // region-aware
```

## Localization & Configuration

📖 [Options & Localization →](https://dharmagya.app/docs/panchang-ts/localization)

```typescript
const hi = getDailyPanchang(date, loc, { timezone: 330, language: 'hi' })!;
hi.angas.tithis[0].name;       // "कृष्ण चतुर्दशी"
hi.angas.vara.englishName;     // "Tuesday" — englishName always English

// All options: timezone (number | IANA string), ayanamsa (5), language (en|hi),
// masaSystem (purnimanta|amanta), region, computeEndTimes, sections,
// janmaRashi, janmaNakshatra.
```

Machine-readable keys never change with language: match on `festival.key`,
`bhadra.location`, `eclipse.kind`, `factors[].code` — render `name` /
`locationName` / `description` / `reasons`.

## Types & Exports

📖 [Types & Exports →](https://dharmagya.app/docs/panchang-ts/types) — the key
interfaces (`TithiInfo`, `FestivalInfo`, `EclipseInfo`, `GrahaPosition`, …) and
the complete export list of the main entry and the four engine-free subpaths
(`panchang-ts/festivals`, `/eclipses`, `/moon-phases`, `/muhurta`).

---

## React Native / Hermes

Works with Expo and bare React Native (Hermes engine). Pass `timezone` as a
**number** — IANA strings need `Intl`, which older Hermes versions lack.

Two-pass rendering pattern for smooth UI:

```typescript
import { getDailyPanchang } from 'panchang-ts';
import { InteractionManager } from 'react-native';

// Pass 1 — cheapest useful result: elements, slots, muhurtas (~0.25 ms).
const fast = getDailyPanchang(date, location, {
  timezone: 330,
  sections: [],
  computeEndTimes: false,
});
setState(fast);

// Pass 2 — background, everything (~0.41 ms).
InteractionManager.runAfterInteractions(() => {
  setState(getDailyPanchang(date, location, { timezone: 330 }));
});
```

---

## Accuracy

📖 [Full accuracy notes →](https://dharmagya.app/docs/panchang-ts/accuracy)

8,368 tests across 121 files, including fixtures cross-verified against reference
panchang calculations spanning 2025–2026 across 10 Indian cities plus New York,
London, Sydney, Dubai, Singapore (diaspora fixtures cover DST on
`America/New_York`).

| Element | Accuracy |
|---|---|
| Sunrise / Sunset | ≤29 s observed vs reference minute-midpoint (±45 s tolerance) |
| Moonrise / Moonset | Meeus apparent-upper-limb (refraction + parallax); ~3–5 min vs simpler-horizon authorities is expected |
| Tithi / Nakshatra / Yoga / Karana names | Exact match vs reference |
| Tithi / Nakshatra / Yoga / Karana end-times | ≤60 s vs Drik across all 20 audited comparisons |
| Ayanamsa (Lahiri) | Reproduces DrikPanchang's published value to ~0.01″ across 1950–2050 |
| Planetary positions (Sun–Saturn) | ±0.02° sidereal |
| Planetary positions (Rahu/Ketu) | ≤0.5° mean node, ≤0.6° true node (typical) |
| Lagna sidereal longitude | Cross-checked against Jagannath Hora reference charts |
| D1 / D9 house placement | Exact match vs reference for 9-graha placement |
| Ashtakoot total | ±1 point per pair across 30+ matched pairs |
| Sade Sati arc start/end | ±1–2 days vs authoritative ephemerides |

**Festival dating** uses tithi-at-sunrise; a few festivals have authorities on
other rules (tithi-at-midnight for Janmashtami / Shivaratri / Diwali,
madhyahna-vyapini for Ganesh Chaturthi edge years) where output can drift
±1 day — the exact list is
[documented](https://dharmagya.app/docs/panchang-ts/accuracy#festival-tradeoff).

**Detection conventions:** Aadal / Vidaal follow the classical Moon-from-Sun
nakshatra-distance rule, not the Tamil-Vakya weekday rule. Varjyam emits the
sunrise-anchored nakshatra's window only. Do Ghati does not rotate by weekday.

---

## Performance

📖 [Full performance notes →](https://dharmagya.app/docs/panchang-ts/performance)

Measured at Pune, Apple M-series, Node — median of 11 processes. **Distinct
days** is the calendar-scan cost; **same day repeated** is what a UI
re-rendering one date sees. Last column is published 4.3.1, benchmarked beside
this release.

| `getDailyPanchang` call | Distinct days | Same day repeated | 4.3.1 (distinct) |
|---|---|---|---|
| Default (all sections + end-times) | **~0.41 ms** | **~0.17 ms** | ~6.06 ms |
| `sections: []` + `computeEndTimes: false` | ~0.25 ms | ~0.14 ms | n/a |
| `getInstantPanchang` | ~0.21 ms | ~0.10 ms | ~0.43 ms |

**A default day is ~15× cheaper than 4.3.1**, a repeated day ~37×. The levers:

- **`sections`** — skip the optional ephemeris-backed blocks (`'festivals'`,
  `'eclipse'`, `'moonTimes'`, `'lunarWindows'`). Narrowing is exactly
  output-neutral: every field a narrowed call computes is identical to the full
  call's; omitted sections sit at their documented `null` / `[]`.
- **`computeEndTimes: false`** — drops the `endTime` transition searches;
  ~5–10% — use it to drop fields you don't want, not to go faster.

Range helpers narrow internally: `computeEkadashiDatesForYear` **~18 ms/year**
(4.3.1: ~2,360), `computeFestivalsInRange` **~131 ms/year** (~2,180),
`computeSankrantisForYear` **~3.3 ms/year** (~154). Solar rise/set events are
cached process-wide (bounded, 20k entries), which also makes them
single-valued.

One deliberate regression: raw chart primitives (`computeRashiChart`,
`computeNavamsa`) cost ~0.32 ms vs ~0.10 in 4.3.1 — the price of an
order-of-magnitude accuracy gain against JPL DE441. `computeShadbala` /
`computeBhavaBala` went the other way, ~2× faster.

---

## Error Handling

📖 [Errors & Compatibility →](https://dharmagya.app/docs/panchang-ts/errors)

```typescript
import { PanchangError } from 'panchang-ts';

try {
  getDailyPanchang(date, location, options);
} catch (e) {
  if (e instanceof PanchangError) {
    console.error(e.code);     // e.g. 'INVALID_LATITUDE', 'INVALID_TIMEZONE'
    console.error(e.message);
  }
}
```

Error codes: `INVALID_DATE`, `INVALID_LATITUDE`, `INVALID_LONGITUDE`,
`INVALID_ELEVATION`, `INVALID_TIMEZONE`, `INVALID_AYANAMSA`, `INVALID_INPUT`,
`TIMEZONE_RESOLUTION_FAILED`, `NO_SUNRISE`, `NO_SUNSET`, `SEARCH_DIVERGED`,
`CIRCUMPOLAR` (Placidus-KP houses above ±66.5°).

**Polar locations.** `getDailyPanchang` and `getInstantPanchang` return `null`
rather than throwing — the Hindu day is undefined when sunrise can't be
computed. The low-level `getSunrise` / `getSunset` primitives still throw
`PanchangError(NO_SUNRISE)` / `PanchangError(NO_SUNSET)` for direct callers
who need the precise reason. `getMoonrise` / `getMoonset` return `null` (normal
for the Moon).

---

## Compatibility

| Environment | Support |
|---|---|
| Node.js ≥ 22 (per the package `engines` field) | Supported |
| React Native (Hermes) | Supported (pass `timezone` as number) |
| Expo (managed + bare) | Supported |
| Browser (modern, ESM) | Supported |
| Browser (legacy / IE) | Not supported |

The build targets ES2020 (ESM + CJS, full `.d.ts`), has **zero runtime
dependencies**, and is `sideEffects: false`.

---

## Acknowledgements

As of v5 the package has **no runtime dependencies** — the ephemeris, ΔT model
and event searches are the library's own. Two projects still deserve credit:
[astronomy-engine](https://github.com/cosinekitty/astronomy) by Don Cross (MIT),
the runtime engine through 4.x and now the dev-time baseline the own ephemeris
is tested against, and the algorithms of Jean Meeus's *Astronomical Algorithms*,
which underpin the rise/set and node models.

## License

MIT
