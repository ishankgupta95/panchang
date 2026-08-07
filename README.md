# panchang-ts

[![npm version](https://img.shields.io/npm/v/panchang-ts)](https://www.npmjs.com/package/panchang-ts)

Pure TypeScript Hindu Panchang (almanac), Jyotish, and Birth Chart calculations.
Zero native dependencies. Works offline in React Native (Hermes), Node.js, and browsers.

**Fast** (~0.2 ms trimmed, ~1.1 ms full) · **Typed** (full TypeScript) · **Offline** (pure JS math) · **8,235 tests across 104 files**

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
| `inauspicious` | `rahuKalam`, `gulikaKalam`, `yamaganda`, `durMuhurta`, `varjyam`, `bhadra`, `gandaMula`, `panchaka`, `panchakaRahita` |
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

Two changes move numbers that 4.x produced, and one option is gone.

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
a cold call (0.7885 → 0.7924 ms) and ~20% of a fully cached warm one
(0.176 → 0.215 ms), which is still 66% below 4.x's 0.629 ms.

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

Each daily field is also returned from `getDailyPanchang` if you prefer one call
over per-feature helpers.

## Pancha Anga

```typescript
const r = getDailyPanchang(date, location, { timezone: 330 })!;

r.angas.tithis.forEach(t => console.log(t.name, t.paksha, t.completionPercentage, t.endTime));
r.angas.nakshatras.forEach(n => console.log(n.name, n.pada, n.endTime));
r.angas.yogas.forEach(y => console.log(y.name, y.endTime));
r.angas.karanas.forEach(k => console.log(k.name, k.type, k.endTime));
console.log(r.angas.vara.name, r.angas.vara.englishName);   // "Mangalawara", "Tuesday"

// Single-instant snapshot:
import { getInstantPanchang } from 'panchang-ts';
const i = getInstantPanchang(new Date(), location)!;
console.log(i.angas.tithi.name, i.angas.nakshatra.name, i.angas.yoga.name, i.angas.karana.name, i.angas.vara.name);
```

## Lunar & Solar Calendar

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330, masaSystem: 'purnimanta' })!;

r.calendar.chandramasa.name;           // active system (default: Purnimanta / North Indian)
r.calendar.chandramasa.amantaName;     // South Indian
r.calendar.chandramasa.purnimantaName; // North Indian
r.calendar.chandramasa.isAdhika;       // true during leap months
r.calendar.samvat.vikramSamvat;        // 2081
r.calendar.samvat.shakaSamvat;         // 1946

r.calendar.masa.name;                  // current solar month (Mesha … Meena)
r.sun.nakshatra.name;        // Sun's nakshatra
r.moon.rashi.name;          // Moon sign
```

## Sun, Moon & Muhurta

```typescript
import { getSunrise, getSunset, getMoonrise, getMoonset } from 'panchang-ts';

const sunrise  = getSunrise(localMidnightUtc, loc);
const sunset   = getSunset(sunrise, loc);
const moonrise = getMoonrise(localMidnightUtc, loc); // null on some days (normal)
const moonset  = getMoonset(localMidnightUtc, loc);

// Or read off the daily result:
const r = getDailyPanchang(date, loc, { timezone: 330 })!;
r.sun.rise; r.sun.set; r.moon.rise; r.moon.set; r.sun.nextRise;
r.sun.dayDurationMinutes; r.sun.nightDurationMinutes;

// Auspicious muhurtas
r.muhurtas.brahma;     // two muhurtas before sunrise
r.muhurtas.abhijit;    // 8th day-muhurta; null on Wednesday (Drik convention)
r.muhurtas.vijaya;     // 11th day-muhurta
r.muhurtas.godhuli;    // "cow-dust" sunset muhurta
r.muhurtas.nishita;    // midnight muhurta (Shivaratri)
r.muhurtas.madhyahna;         // solar noon ±24 min
r.muhurtas.pratahSandhya;     // dawn twilight, ends at sunrise
r.muhurtas.sayahnaSandhya;    // dusk twilight, starts at sunset
r.muhurtas.amritKala;         // nakshatra-specific window (null when nakshatra has none)
```

`muhurtas.pratahSandhya` / `muhurtas.sayahnaSandhya` width =
`sun.nightDurationMinutes / 10` (~62–81 min).

## Inauspicious Periods

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

r.inauspicious.rahuKalam;       // { start, end }
r.inauspicious.gulikaKalam;
r.inauspicious.yamaganda;
r.inauspicious.durMuhurta;      // two ~48-min windows
r.inauspicious.varjyam;         // { start, end } | null
r.inauspicious.gandaMula;       // { active, severity: 'mild'|'severe'|null, ... }
r.inauspicious.bhadra;          // { start, end, location: 'earth'|'heaven'|'paatal', isActive } | null
r.inauspicious.panchaka;        // boolean — Moon in last 5 nakshatras
```

## Time-Slot Systems

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

// Choghadiya — 8 day + 8 night named, rated slots (Amrit, Kaal, Shubh, Rog, …)
r.periods.choghadiya.day.forEach(s => console.log(s.name, s.qualityName, s.start, s.end));

// Gowri Panchangam ("Nalla Neram") — 8 day + 8 night Tamil slots
r.periods.gowri.day.forEach(s => console.log(s.name, s.qualityName));

// Hora — 12 day + 12 night planetary hours (Chaldean order)
r.periods.hora.day.forEach(h => console.log(h.planet, h.start, h.end));

// Do Ghati Muhurta — 15 day + 15 night ~48-min deity-keyed slots (no vara rotation)
r.muhurtas.doGhati.day.forEach(g => console.log(g.name, g.start, g.end));

// Panchaka Rahita — slices of the day FREE of Panchaka ([] when it pervades)
r.inauspicious.panchakaRahita.forEach(slice => console.log(slice.start, slice.end));
```

## Special Yogas

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

r.anandadiYoga.name;   // 28-cycle name e.g. "Ananda"
r.specialYogas.forEach(y => {
  // type: amrit_siddhi | sarvartha_siddhi | ravi_pushya | guru_pushya
  //     | dwipushkar | tripushkar | jwalamukhi (inauspicious)
  //     | aadal | vidaal | ravi (Moon-from-Sun nakshatra-distance rules)
  console.log(y.name, y.type);
});
```

## Festivals (80+)

Covers Ekadashi (26 variants, Smarta/Vaishnava split via Dashami-viddha; Smarta
fast emits a `deferralDate` for Dwadashi), Pradosha, Sankranti + regional
variants (Pongal, Vishu, Baisakhi, Pohela Boishakh, Bihu, Uttarayan, Lohri…),
canonical-time classical (Janmashtami, Shivaratri, Ganesh Chaturthi, Diwali,
Holi, Raksha Bandhan — Bhadra-aware, Karva Chauth, Akshaya Tritiya…),
regional (Gudi Padwa, Gangaur, Teej variants, Onam, Chhath…), monthly
observances (Masik Shivaratri, Pushya days, Shravan Somvar…).

```typescript
r.festivals.forEach(f => {
  // key:  stable, language-independent id — 'diwali', 'makar_sankranti', …
  // type: major | minor | ekadashi | smarta_ekadashi | vaishnava_ekadashi
  //     | pradosha | sankranti | eclipse
  console.log(f.key, f.name, f.type, f.deferralDate);
});

// `name` is localized, so match on `key` — never on `name`.
const hasDiwali = r.festivals.some(f => f.key === 'diwali');
```

`key` is on engine results (`getDailyPanchang`, `getInstantPanchang`,
`computeFestivalsInRange`). Entries read back out of a `buildFestivalsTable` table
carry `name` / `type` / `description` only.

### Regional scoping

`region` scopes regional variants to one Indian state. Pan-Indian festivals
emit regardless.

```typescript
// All regional variants (default):
getDailyPanchang(jan14, chennai, { timezone: 330 })!.festivals.map(f => f.name);
// → ["Sankranti","Makar Sankranti","Pongal","Uttarayan","Magh Bihu","Ayyappa Makara Jyothi"]

// Tamil Nadu only:
getDailyPanchang(jan14, chennai, { timezone: 330, region: 'tamil-nadu' })!
  .festivals.map(f => f.name);
// → ["Sankranti","Makar Sankranti","Pongal"]

// Lohri fires on the Hindu day BEFORE Makara transit, in Punjab/Haryana/Himachal scope:
getDailyPanchang(jan13, amritsar, { timezone: 330, region: 'punjab' })!
  .festivals.some(f => f.name === 'Lohri'); // true
```

`FestivalRegion` covers 21 Indian states + `'nepal'` + `'all'` (default). The
legacy slugs `'tamil'`, `'bengal'`, `'north-india'` are still accepted and
mapped internally.

### Pre-computed table — build your own and cache it

If you want festival *dates* without running the engine in your app, compute a
table once with `buildFestivalsTable`, cache the JSON, and read it back through
the engine-free `panchang-ts/festivals` entry point.

**The library ships no pre-computed table.** Festival dates are
observer-dependent — canonical times (nishita / pradosha / chandrodaya …) shift
with the timezone offset, so a table built for one place can be ±1 day wrong
elsewhere — and any table baked into the package would also go stale. Building
your own means it is correct for *your* users and covers whatever years you
want.

```typescript
import { buildFestivalsTable } from 'panchang-ts';            // uses the engine
import {
  readFestivalsForYear,
  readFestivalsForDate,
  readFestivalsYearRange,
} from 'panchang-ts/festivals';                                // engine-free

// Build once — at your build time, or on first launch in the background.
const table = buildFestivalsTable({
  location: { latitude: 25.3176, longitude: 82.9739 },   // Varanasi
  timezoneOffsetMinutes: 330,    // IST; -300 = US Eastern, 0 = UK
  startYear: 2024,
  endYear: 2031,
  languages: ['en', 'hi'],       // drop 'hi' to halve the size
  referenceLocation: 'Varanasi',
});
// …persist `table` as JSON (disk / MMKV / your bundler's asset pipeline).

// Later reads are instant lookups — no engine, no ephemeris.
readFestivalsYearRange(table);                    // { start: 2024, end: 2031 }
readFestivalsForYear(table, 2026)!.length;        // ~150 festival days
const diwali = readFestivalsForYear(table, 2026)!
  .find(d => d.festivals.some(f => f.name === 'Diwali'))!.date;
readFestivalsForDate(table, diwali);              // [Narak Chaturdashi, Diwali]
readFestivalsForDate(table, diwali, 'hi');        // [नरक चतुर्दशी, दिवाली]
```

`panchang-ts/festivals` imports no astronomy code, so a client bundle that only
*reads* a table never pulls in the engine. Keep `buildFestivalsTable` on the
build/server side (or behind a one-time on-device warm-up) and ship only the
JSON.

Eclipses are excluded here — visibility is location-dependent, so they get their
own table at `panchang-ts/eclipses` (see [Eclipses](#eclipses)).

`npm run festivals:gen` is a worked example of the whole pattern; it writes a
rolling 2-past / 5-future window to `./festivals.json` (or a path you pass).

**Other notes:** Karva Chauth / Dhanteras / Diwali emit with Purnimanta paksha
naming.

## Eclipses

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;
if (r.eclipse) {
  r.eclipse.kind;                 // 'solar' | 'lunar'
  r.eclipse.subtype;              // 'partial' | 'total' | 'annular' | 'penumbral'
  r.eclipse.obscuration;          // 0..1 fraction of the disc AREA covered
  r.eclipse.magnitude;            // catalogue magnitude — DIAMETER fraction;
                                  // >1 when total, negative when penumbral
  r.eclipse.visibleFromLocation;  // body above horizon at peak?
  r.eclipse.start; r.eclipse.peak; r.eclipse.end;
  r.eclipse.sutakStart; r.eclipse.sutakEnd;
  // Sutak: 12 h (4 prahara) before solar, 9 h (3 prahara) before lunar
}

import { getUpcomingSolarEclipse, getUpcomingLunarEclipse } from 'panchang-ts';
const next = getUpcomingSolarEclipse(new Date(), loc, 365 /* days */);
```

### Pre-computed table — build your own and cache it

Same pattern as festivals: build a table with `buildEclipsesTable`, cache it,
read it back through the engine-free `panchang-ts/eclipses` entry point.

**No table is bundled.** Which eclipses are visible — and therefore which carry
`sutak` — is location-dependent, so a table is only meaningful for the place it
was built for.

```typescript
import { buildEclipsesTable } from 'panchang-ts';            // uses the engine
import {
  readEclipsesForYear,
  readEclipsesForDate,
  readEclipsesYearRange,
} from 'panchang-ts/eclipses';                                // engine-free

const table = buildEclipsesTable({
  location: { latitude: 25.3176, longitude: 82.9739 },   // Varanasi
  timezoneOffsetMinutes: 330,
  startYear: 2024,
  endYear: 2031,
  languages: ['en', 'hi'],
  // visibleOnly: false → also include eclipses below the horizon (no sutak)
});
// …persist `table` as JSON, then:

readEclipsesYearRange(table);            // { start: 2024, end: 2031 }
const e = readEclipsesForYear(table, 2025)![0].eclipses[0];
e.kind;                 // 'lunar'
e.subtype;              // 'total'
e.start; e.peak; e.end; // ISO UTC strings
e.obscuration;          // 0..1 disc area covered at peak
e.magnitude;            // catalogue magnitude (diameter); >1 total, <0 penumbral
e.visibleFromLocation;  // visible during any phase?
e.visibleAtPeak;        // is greatest eclipse itself above the horizon?
e.sutak;                // { start, end } — see note below
readEclipsesForDate(table, '2025-09-07', 'hi');  // [पूर्ण चंद्र ग्रहण]
```

By default a table lists every eclipse **visible from the location during any
phase** (so one already in progress at moon/sunrise or moon/sunset is included);
`visibleAtPeak` tells you whether greatest eclipse itself is observable.

Solar eclipses report the subtype seen **locally** (a globally-total eclipse may
read `partial` from a given place). The `sutak` window is present only where it
applies — all visible solar eclipses and visible **umbral** (partial/total)
lunar eclipses; **penumbral** lunar eclipses carry no `sutak` and are not
religiously observed (drik / pandit consensus).

For one-off astronomical detail without building a table, use
`getUpcomingEclipses` / `computeEclipsesInRange` from the main entry.

`npm run eclipses:gen` is a worked example; it writes a rolling 2-past /
5-future window to `./eclipses.json` (or a path you pass).

## Moon Phases

The four principal lunar phases — **new** (Amavasya), **first quarter**,
**full** (Purnima), **last quarter** — as precise instants. (These are the
astronomical quarter moments, distinct from the same-named *tithis*, which are
~24h windows.)

```typescript
import { computeMoonPhasesInRange } from 'panchang-ts';
const phases = computeMoonPhasesInRange(new Date('2026-01-01'), new Date('2026-12-31'));
phases.forEach(p => console.log(p.phase, p.time.toISOString()));  // ~49 / year
```

### Pre-computed table — build your own and cache it

Same pattern again, at `panchang-ts/moon-phases`. Phases are **global instants**,
so `buildMoonPhasesTable` takes only a `timezoneOffsetMinutes` (no coordinates)
— the timezone just decides which calendar date each instant lands on (a new
moon at 19:52 UTC on Jan 18 is listed under Jan 19 in IST).

```typescript
import { buildMoonPhasesTable } from 'panchang-ts';          // uses the engine
import {
  readMoonPhasesForYear,
  readMoonPhasesForDate,
  readMoonPhasesYearRange,
} from 'panchang-ts/moon-phases';                             // engine-free

const table = buildMoonPhasesTable({
  timezoneOffsetMinutes: 330,    // IST; -300 = US Eastern
  startYear: 2024,
  endYear: 2031,
  languages: ['en', 'hi'],
});
// …persist `table` as JSON, then:

readMoonPhasesYearRange(table);                        // { start: 2024, end: 2031 }
readMoonPhasesForYear(table, 2026)!.length;            // ~49 phase days
readMoonPhasesForDate(table, '2026-01-03');            // [{ phase: 'full', name: 'Full Moon', … }]
readMoonPhasesForDate(table, '2026-01-03', 'hi');      // [{ phase: 'full', name: 'पूर्णिमा', … }]
```

Each entry carries `phase`, the phase `time` (ISO UTC), and `en` + `hi` text.

`npm run moon-phases:gen` is a worked example; it writes a rolling 2-past /
5-future window to `./moonPhases.json` (or a path you pass).

## Planetary Positions

```typescript
import { computePlanetaryPositions, GRAHA_ABBR } from 'panchang-ts';

const g = computePlanetaryPositions(new Date(), 'lahiri');
g.jupiter.rashi.name;       // "Dhanu"
g.jupiter.degreeInRashi;    // 18.42
g.jupiter.nakshatra.name;   // "Purva Ashadha"
g.jupiter.nakshatra.pada;   // 3
g.saturn.isRetrograde;
GRAHA_ABBR['Jupiter'];      // "Ju"

// True node (sharper Rahu/Ketu via Meeus periodic correction)
const gT = computePlanetaryPositions(new Date(), 'lahiri', undefined, 'true');
```

## Dashas

Five classical systems:

```typescript
import {
  computeVimshottariDashaFromBirth, computeVimshottariPratyantar,
  computeAshtottariDasha, computeYoginiDasha, computeCharaDasha, computeNarayanDasha,
} from 'panchang-ts';

// 1. Vimshottari — 120-year, 9-lord, with 3-level Maha→Antar→Pratyantar.
const vim = computeVimshottariDashaFromBirth(birth, 'lahiri');
const pratyantars = computeVimshottariPratyantar(vim.mahaDashas[0]!.antarDashas[0]!);

// 2. Ashtottari — 108-year, 8-lord cycle (no Ketu).
const ash = computeAshtottariDasha(birth, moonLon);

// 3. Yogini — 36-year, 8 yoginis.
const yog = computeYoginiDasha(birth, moonLon);
yog.mahaDashas[0]!.yogini;   // 'Dhanya'
yog.mahaDashas[0]!.lord;     // 'Jupiter'

// 4. Chara (Jaimini) — sign-based, 9-8-7 years per modality, forward only.
const cha = computeCharaDasha(birth, loc);

// 5. Narayan (Jaimini) — sign-based, parity-based direction.
//    Vishama-pada lagna {Aries, Taurus, Gemini, Libra, Scorpio, Sag} → forward
//    Sama-pada   lagna {Cancer, Leo, Virgo, Capricorn, Aquarius, Pisces} → backward
const nar = computeNarayanDasha(birth, loc);
nar.direction;               // 'forward' | 'backward'

// Narayan variable-duration variant (Sanjay Rath):
const narV = computeNarayanDasha(birth, loc, 'lahiri', { duration: 'variable' });
narV.mahaDashas[0]!.years;   // 0..12 from rashi-to-lord count (+1 exalt, -1 debil)
```

## Personal Transits

```typescript
const r = getDailyPanchang(date, loc, {
  timezone: 330,
  janmaRashi: 3,        // 0 = Mesha … 11 = Meena
  janmaNakshatra: 0,    // 0 = Ashwini … 26 = Revati
})!;
r.chandraBalam;  // { house, quality: 'strong'|'weak', name, englishName } — null without janmaRashi
r.tarabala;      // { taraIndex, name, englishName, quality } — null without janmaNakshatra

import { computeSadeSati } from 'panchang-ts';
const ss = computeSadeSati(natalMoonRashiIndex, new Date());
// → { active, phase: 1|2|3|null, currentArcStart, currentArcEnd, nextArcStart }
```

## Birth Chart

Sidereal Lagna, Bhava under three house systems, D1 + six classical divisional
charts (D2/D3/D7/D9/D10/D12/D30), and Planetary Dignity.

```typescript
import {
  computeLagna, computeBhava, computeRashiChart, computeNavamsa,
  computeDivisionalChart, computeDignity,
} from 'panchang-ts';

const birth = new Date('1995-08-15T05:30:00Z');
const loc   = { latitude: 28.6139, longitude: 77.2090 };

const lagna = computeLagna(birth, loc, 'lahiri', 'en');

// Bhava — 'whole-sign' (default) | 'equal' | 'placidus-kp'.
// Placidus-KP throws PanchangError('CIRCUMPOLAR') beyond ±66.5°.
const houses = computeBhava(birth, loc, { houseSystem: 'whole-sign' });

// `chart.planets` is the ordered list; `chart.byPlanet` is the same nine
// placements keyed by graha, for direct lookup without a linear scan.
const chart = computeRashiChart(birth, loc);
chart.byPlanet.Mars.house;        // instead of chart.planets.find(...)!
chart.planets.map(p => p.rashi);  // iterate the list as before

// D1 — full Rashi chart with 9-graha house placement.
const d1 = computeRashiChart(birth, loc, { houseSystem: 'whole-sign' });
d1.planets.find(p => p.planet === 'Jupiter')?.house;
d1.planets.find(p => p.planet === 'Saturn')?.isRetrograde;

// Divisional charts (D2 Hora, D3 Drekkana, D7 Saptamsa, D9 Navamsa,
// D10 Dasamsa, D12 Dwadasamsa, D30 Trimsamsa).
const d9  = computeNavamsa(birth, loc);
const d10 = computeDivisionalChart(birth, loc, 'D10');
const d30 = computeDivisionalChart(birth, loc, 'D30');

// Planetary dignity (BPHS Ch.3-4).
computeDignity('Mars', 0);   // 'moolatrikona' (Aries)
computeDignity('Mars', 9);   // 'exalted' (Capricorn)
computeDignity('Sun',  6);   // 'debilitated' (Libra)
```

Birth-chart helpers accept the full ayanamsa set including `'true-chitra'` and
`'thirukanitham'`.

## Compatibility & Doshas

```typescript
import {
  computeAshtakoot, computePathuPorutham,
  computeMangalDosha, computeKaalSarp, computePitruDosha,
} from 'panchang-ts';

// Ashtakoot (North Indian, 36-point) — Varna, Vashya, Tara, Yoni,
// Graha Maitri, Gana, Bhakoot, Nadi (max 1/2/3/4/5/6/7/8).
const match = computeAshtakoot(
  { rashi: 4, nakshatra: 9 },
  { rashi: 0, nakshatra: 1 },
);
// → { totalScore: 0..36, koots: KootScore[8], cancellations: string[] }

// Opt-in Bhakoot cancellations need extra natal data:
// `lagnaRashi` enables same-lagna-lord + same-7th-lord rules;
// `navamsaRashi` enables the same-Navamsa-lord rule.
const richer = computeAshtakoot(
  { rashi: 4, nakshatra: 9, lagnaRashi: 7, navamsaRashi: 2 },
  { rashi: 0, nakshatra: 1, lagnaRashi: 1, navamsaRashi: 5 },
);

// Pathu Porutham (Tamil/Kerala, 10-fold) — binary pass/fail per koot.
// Three vetoes (Yoni, Rajju, Vedha) flip `recommended` regardless of count.
const tp = computePathuPorutham(
  { rashi: 4, nakshatra: 9 },
  { rashi: 0, nakshatra: 1 },
);
tp.totalPasses;   // 0..10
tp.recommended;   // no veto + ≥5 passes

// Doshas
computeMangalDosha(d1);
//   Mars in 1/2/4/7/8/12 from Lagna, Moon, AND Venus (Drik rule set).
//   Cancellations: Mars in own sign/exalted, conjunct Jup/Moon/Venus,
//   or aspected by Jupiter (5/7/9 sign-aspect).
//   Severity (anshik/purna) is computed pre-cancellation.

computeKaalSarp(d1);
//   12 subtypes by Rahu's house: anant, kulik, vasuki, shankhpal, padma,
//   mahapadma, takshak, karkotak, shankhachud, ghatak, vishdhar, sheshnag.

computePitruDosha(d1);
//   Pandit-consensus 4-trigger set (rules cited by ≥3 of 6 surveyed
//   pandit sources): Sun+Rahu conjunction (any house), Sun+Saturn
//   conjunction (any house), Rahu in 9th house, 9th-lord conjunct Rahu.
//   Drik panchang publishes no Pitru calculator; minority/expansive
//   rules (Sun in 9th alone, Ketu in 4th, 9th lord in dusthana, etc.)
//   are intentionally excluded.
```

**Limitations.** Ashtakoot Vashya koot uses single-vashya per rashi.
Bhakoot Parivartana (rashi-lord exchange) cancellation needs per-graha
position data not carried by the `NatalMoon` shape and is not modelled.

## Strength & Aspects

```typescript
import {
  computeAspects, computeShadbala, computeBhavaBala, computeAshtakavarga,
} from 'panchang-ts';

// Drishti — every graha aspects the 7th; malefics gain extras
// (Mars 4+8, Jupiter 5+9, Saturn 3+10). Node aspect mode is configurable:
const aspects = computeAspects(d1);                         // BPHS 7th-only on nodes
const aspExt  = computeAspects(d1, { nodeAspects: '5-and-9' }); // KP/BV Raman extension

// Shadbala — 7 visible grahas, 6 components, in Virupas (60 V = 1 Rupa).
// Sthana = Uchcha + Saptavargaja (D1/D2/D3/D7/D9/D12/D30 dignity sum)
//        + Ojha-Yugma (rashi+navamsa parity) + Drekkana (gender decanate).
//   Range [0, 420 V]. Dig is directional cusp; Kala = Nathonatha + Paksha;
//   Chesta is retrograde-bucket; Naisargika is fixed rank; Drik is weighted aspects.
const bala = computeShadbala(birth, loc);

// Bhava Bala — 12-bhava strength built on top of Shadbala.
// Per-bhava: { bhavadhipati, dik, drik, sthana, total }.
const bhavaBala = computeBhavaBala(birth, loc);

// Ashtakavarga — 12-rashi bindu grids (BPHS Ch. 66).
const av = computeAshtakavarga(d1);
av.sarvashtaka;             // 12 cells, each 0..56, total 336
av.bhinnashtaka.Jupiter;    // 12-cell grid; Jupiter total = 56 (chart-invariant)
// Other invariants: Sun=47, Moon=49, Mars=39, Mercury=54, Venus=52, Saturn=39.

// Trikona + Ekadhipatya Sodhana reductions (BPHS Ch. 67):
const avR = computeAshtakavarga(d1, { reductions: true });
avR.reduced!.sarvashtaka;
```

Rahu and Ketu are not Ashtakavarga receivers or contributors (classical
Parashara scheme).

## Yogas & Karakas

```typescript
import { computeYogas, computeJaiminiKarakas } from 'panchang-ts';

// ~25 named yogas — Pancha Mahapurusha (Ruchaka/Bhadra/Hamsa/Malavya/Sasha),
// lunar (Gajakesari, Sunapha, Anapha, Durudhura, Kemadruma), solar
// (Budha-Aditya, Veshi, Vasi, Ubhayachari), Raja (kendra/trikona-lord,
// Dharma-Karmadhipati, Vipareeta, Lakshmi), Dhana (2-11, 5-9, Vasumati),
// Vargottama, Yogakaraka, Neecha Bhanga, Daridra.
const yogas = computeYogas(d1);
// → [{ name, type, reasons[], bhanga?: { applies, reasons[] } }, …]

// Optional cancellation annotations: 5 Pancha Mahapurusha + Gajakesari
// surface `bhanga` (Sun/Moon conjunct or Jupiter combust/debilitated).
// Neecha Bhanga: dispositor in kendra from Lagna OR Moon; lord-of-
// exaltation-rashi in kendra from Lagna or Moon; mutual exchange;
// dispositor aspecting the debilitated planet.

// Filter by type / pass D9 for Vargottama:
const d9 = computeNavamsa(birth, loc);
const all = computeYogas(d1, { types: ['raja','dhana'], navamsa: d9 });

// Jaimini Karakas — Atmakaraka (highest degree-in-rashi) … Darakaraka (lowest).
const k7 = computeJaiminiKarakas(d1);                              // 7-graha Parashara default
const k8 = computeJaiminiKarakas(d1, { variant: '8-jaimini' });    // adds Rahu (degree reversed),
                                                                   // inserts Pitrukaraka at 5th
```

Yoga and Karaka names are English/transliterated proper nouns and intentionally
**not** locale-resolved.

## Annual & Sensitive Layers

```typescript
import {
  computeVarshaphala, computeTithiPravesha, computeArudhas,
  computeHoraLagna, computeGhatiLagna, computeBhavaLagna, computeSripatiLagna,
  computeUpagrahas, computeArgala,
} from 'panchang-ts';

// Varshaphala — Tajik annual chart for the Nth solar return.
const v = computeVarshaphala(birth, 30, loc);
v.solarReturnInstant;
v.varshaLagna.rashi.name;
v.muntha.rashi; v.muntha.house;     // muntha = (natalLagnaRashi + 30) mod 12
v.yearLord;                          // strongest of 4 candidates by Shadbala
v.sahams.Punya.house;
v.sahams.Vivaha.rashi;
// 27 Sahams: Punya, Vidya, Yasas, Mitra, Karma, Vivaha, Putra, Roga, Marana,
// Rajya, Raja, Bandhu, Dharma, Gnati, Apamrityu, Bhratri, Matri, Pitri, Sama,
// Bandhana, Karyasiddhi, Vyapara, Sastra, Asha, Labha, Susha, Tapas.

// Tithi Pravesha — annual chart cast when Sun is in natal sidereal sign AND
// Sun-Moon separation equals natal separation. Preserves natal tithi exactly.
const tp = computeTithiPravesha(birth, 30, loc);
tp.natalTithi === tp.praveshTithi;   // always true

// Arudha padas — image/reflection of each bhava. Arudha[0] = Arudha Lagna (AL).
const a = computeArudhas(d1);
a[0]!.bhava;            // 1 — AL
a[0]!.arudhaRashi;      // 0..11
a[6]!.bhava;            // 7 — Darapada (spouse pada)

// Special lagnas — time-derived sensitive points from sunrise on/before birth.
computeHoraLagna(birth, loc);     // 30°/hour (1 rashi/hour)
computeGhatiLagna(birth, loc);    // 75°/hour (1 rashi/24 min)
computeBhavaLagna(birth, loc);    // 15°/hour (1 rashi/2 hours)
computeSripatiLagna(birth, loc);  // = natal lagna (cusp 1)

// Sripati cusps 2–12 (opt-in) — 4 angular cusps + trisected intermediates.
// Defined at every latitude (unlike Placidus).
const sripati = computeSripatiLagna(birth, loc, 'lahiri', 'en', { includeCusps: true });
sripati.cusps;  // number[12] of bhava madhyas; cusps[0/3/6/9] = ASC/IC/DSC/MC

// Upagrahas — Gulika, Mandi (rising-asc at Saturn segment start/midpoint),
// plus Sun-derived Dhuma, Vyatipata, Parivesha, Indrachapa, Upaketu.
const u = computeUpagrahas(birth, loc);
u.gulika.longitude; u.gulika.rashi; u.gulika.house;

// Argala (Jaimini) — planets in 2/4/11 from a bhava form Argala (intervention);
// 3/10/12 form Virodhargala (counter). Each planet hits exactly 6 of 12 bhavas.
const arg = computeArgala(d1);
arg[0]!.argala; arg[0]!.virodhargala;

// Trikonargala (5/9 trine, opt-in) — Ketu reversal: 5th-from → virodhaka,
// 9th-from → source.
const argT = computeArgala(d1, { includeTrikonargala: true });
argT[0]!.trikona!.sources;
argT[0]!.trikona!.virodhakas;
```

## KP & Prashna

```typescript
import {
  computeKpSubLord, computeKpCuspalSubLords, computeKpSignificators,
  computePrashnaChart,
} from 'panchang-ts';

// KP sub-lord at any sidereal longitude (243 sub-divisions across the zodiac,
// proportional to Vimshottari years).
const info = computeKpSubLord(45.5);    // 15°30' Taurus
info.signLord;   // 'Venus'
info.starLord;   // 'Moon'
info.subLord;

// Cuspal sub-lords (always Placidus-KP — KP's anchor scheme).
const cusps = computeKpCuspalSubLords(birth, loc);
cusps.cusps[0]!.subLord;   // ascendant
cusps.cusps[6]!.subLord;   // descendant

// Significators — for each planet, the houses it signifies via the 4-fold KP rule
// (occupant + star-lord-occupant + owner + star-lord-owner).
const sig = computeKpSignificators(d1);
sig.byPlanet.Sun;
sig.byHouse[10];

// Prashna (horary) chart — cast at question moment from querent's location.
const pchart = computePrashnaChart(
  new Date('2026-05-09T14:30:00Z'),
  { latitude: 19.0760, longitude: 72.8777 },
);
pchart.lagna.rashi.name;
pchart.bhava.system;        // 'placidus-kp' by default (KP horary anchor)
pchart.planets[1]!.house;   // Moon — primary mind significator
```

Same return shape as a natal `BirthChart`. Pass `{ houseSystem: 'whole-sign' }`
to `computePrashnaChart` for traditional Vedic Prashna.

## Muhurta Engine

```typescript
import { scoreMuhurta, computeAuspiciousDatesInRange, vivahRule } from 'panchang-ts';

const r = scoreMuhurta(new Date('2026-05-12'), DELHI, vivahRule, { timezone: 330 });
// → { date, score: 0..100, passes: boolean,
//     reasons: string[],           // diagnostic English
//     factors: MuhurtaFactor[] }   // { code, axis, index?, delta } — stable

r.factors.filter(f => f.delta < 0);              // what cost the day points
r.factors.some(f => f.axis === 'exclusion');     // hard-excluded?

const dates = computeAuspiciousDatesInRange(
  vivahRule,
  new Date('2026-05-01'),
  new Date('2026-05-31'),
  DELHI,
  { timezone: 330 },
);   // MuhurtaDay[] sorted by score desc; full panchang attached

// Custom rule (pure data, no engine code needed)
const myRule: MuhurtaRule = {
  occasion: 'launch_party',
  auspiciousVaras: [3, 4, 5],
  auspiciousNakshatras: [11, 12, 21],
  excludeBhadra: true,
  excludeEkadashi: true,
  excludeAdhikaMasa: true,
};
```

13 stock rules: vivah, griha pravesh, namakarana, vidyarambh, vahan kharidi,
annaprashan, mundan, upanayanam, karnavedha, aksharabhyasam, seemantham, shop
opening, travel start.

### Pre-computed table — build your own and cache it

Scoring a year of days runs the engine ~365 times. If your app asks the same
question repeatedly, compute the answer once and ship the JSON — the same
pattern the festival, eclipse and Moon-phase tables use.

```typescript
import { buildMuhurtaTable, vivahRule } from 'panchang-ts';

const table = buildMuhurtaTable({
  rule: vivahRule,
  location: { latitude: 25.3176, longitude: 82.9739 },
  timezoneOffsetMinutes: 330,
  startYear: 2026,
  endYear: 2031,
  referenceLocation: 'Varanasi',
});
// persist JSON.stringify(table) — 6 years of vivah dates is ~74 KB
```

Read it back through the engine-free `panchang-ts/muhurta` entry (~1.7 KB, no
astronomy code in your bundle):

```typescript
import {
  readMuhurtaForYear,
  readMuhurtaForDate,
  readMuhurtaYearRange,
  readMuhurtaOccasion,
  readBestMuhurtaDays,
} from 'panchang-ts/muhurta';

const table = JSON.parse(await (await fetch('/muhurta-vivah.json')).text());

readMuhurtaOccasion(table);          // 'vivah'
readMuhurtaYearRange(table);         // { start: 2026, end: 2031 }
readMuhurtaForYear(table, 2026);     // MuhurtaTableDay[] — passing days, by date
readMuhurtaForDate(table, '2026-11-11');
readBestMuhurtaDays(table, 5);       // top 5 across the table, highest first
```

Only days that **pass** the rule are stored by default; pass
`includeFailures: true` to keep every day with its score. Scores are location-
*and* rule-dependent, so a table built for Varanasi and `vivah` says nothing
about another place or occasion.

`npm run muhurta:gen` is a worked example script
([scripts/generate-muhurta-json.ts](scripts/generate-muhurta-json.ts)):

```bash
npm run muhurta:gen -- muhurta-vivah.json vivah
```

Scoring: starts at 50; +10 per matching auspicious axis (tithi / nakshatra /
vara / yoga), -15 per inauspicious axis, hard exclusions zero the score.
Special yogas (Amrit Siddhi, Sarvartha Siddhi, Ravi/Guru Pushya) add +5;
Jwalamukhi subtracts -10. Clamped 0..100; `passes: true` when score ≥ 50.

Every scoring input appears in both `reasons` (English prose, diagnostic, not a
stable format) and `factors` (structured, with a stable `code`). Localize and
filter on `factors`.

`scoreMuhurta` computes only the sections it actually scores against, so it is
cheaper than a full `getDailyPanchang`. `computeAuspiciousDatesInRange` does not narrow —
each returned day carries its complete `panchang` for callers to drill into.

## Calendar Conversion

```typescript
import {
  convertGregorianToHindu, convertHinduToGregorian,
  getKaliYugaYear, getHinduNewYear,
  computeEkadashiDatesForYear, computeSankrantisForYear,
  computeFestivalsInRange, getUpcomingEclipses, computeEclipsesInRange,
} from 'panchang-ts';

// Gregorian → Hindu coords at sunrise
const h = convertGregorianToHindu(new Date('2026-04-15'), DELHI, { timezone: 330 });

// Hindu → Gregorian
const dates = convertHinduToGregorian(
  { vikramSamvat: 2083, masaIndex: 0, paksha: 'shukla', pakshaTithi: 9 },
  DELHI, { timezone: 330 },
);   // → Rama Navami in VS 2083

getKaliYugaYear(new Date('2026-04-01'));                       // 5127
getHinduNewYear(2026, 'tamil-nadu', DELHI, { timezone: 330 }); // Puthandu

computeEkadashiDatesForYear(2026, DELHI, { timezone: 330 });       // ~24 Date[]
computeSankrantisForYear(2026, DELHI, { timezone: 330 });          // 12 SankrantiEvent[]
computeFestivalsInRange(start, end, DELHI, { timezone: 330 });     // FestivalDay[]
getUpcomingEclipses(new Date(), DELHI, 5);
```

`getHinduNewYear` is region-aware: Tamil Nadu / Kerala / Punjab / Bengal / Assam
use the **solar** (Mesha Sankranti) anchor; elsewhere uses **Chaitra Shukla
Pratipada** (Ugadi / Gudi Padwa / Cheti Chand). When Pratipada is a kshaya
tithi (e.g. Ugadi 2026), falls back to the Amanta-Chaitra-masa boundary.

## Localization & Configuration

```typescript
const hi = getDailyPanchang(date, loc, { timezone: 330, language: 'hi' })!;
hi.angas.tithis[0].name;          // "कृष्ण चतुर्दशी"
hi.angas.vara.name;               // "मंगलवार"
hi.calendar.chandramasa.name;        // "माघ"
hi.periods.choghadiya.day[0].name;  // "अमृत"
hi.angas.vara.englishName;        // "Tuesday" — englishName always English

// All options:
const r = getDailyPanchang(date, loc, {
  timezone: 330,                          // number (UTC offset min) or IANA string
  ayanamsa: 'lahiri',                     // lahiri | raman | krishnamurti | true-chitra | thirukanitham
  language: 'en',                         // en | hi
  masaSystem: 'purnimanta',               // purnimanta | amanta
  region: 'all',                          // 21 state slugs + 'nepal' + 'all'
  computeEndTimes: true,                  // false → skip transition searches
  sections: undefined,                    // undefined = all; see Performance
  janmaRashi: undefined,                  // pass to populate r.chandraBalam (else null)
  janmaNakshatra: undefined,              // pass to populate r.tarabala (else null)
});
```

**Timezone.** Number (minutes from UTC, e.g. `330` for IST) or an IANA zone
name (e.g. `'America/New_York'`). IANA strings need `Intl`, which older Hermes
versions lack — pass a number on those targets. DST resolves automatically for
IANA zones.

---

### Localized vs machine-readable fields

Every user-facing string follows `language`. Where a value is also meaningful to
code, the two are separate fields — the stable key never changes with language:

| Machine-readable | Localized display |
|---|---|
| `festival.key` (`'diwali'`) | `festival.name` (`"दिवाली"`) |
| `bhadra.location` (`'paatal'`) | `bhadra.locationName` (`"पाताल"`) |
| `eclipse.kind` / `eclipse.subtype` | `eclipse.description` |
| `muhurtaScore.factors[].code` | `muhurtaScore.reasons` (English only) |

`MuhurtaScore.reasons` is diagnostic English and not a stable format; use
`factors` for anything shown to a user or branched on in code.

## Types & Exports

<details>
<summary><strong>Core, Pancha Anga, Festivals</strong></summary>

```typescript
interface GeoLocation { latitude: number; longitude: number; elevation?: number; }
interface TimePeriod  { start: Date; end: Date; }

interface TithiInfo {
  index: number;               // 0-29
  name: string;
  paksha: string;              // "Shukla"/"Krishna" (en), "शुक्ल"/"कृष्ण" (hi)
  number: number;              // 1-15 within the paksha
  completionPercentage: number;
  endTime: Date | null;
}
// NakshatraInfo, YogaInfo, KaranaInfo follow the same pattern.
// DailyTithiInfo extends with startTime + isActiveAtSunrise.

interface VaraInfo {
  index: number;       // 0 = Sunday … 6 = Saturday
  name: string;        // localized (e.g. "Raviwara")
  shortName: string;
  englishName: string; // always English
}

interface FestivalInfo {
  key: string;          // stable, language-independent id — match on this
  name: string;         // localized — display only
  type: 'major' | 'minor' | 'ekadashi' | 'smarta_ekadashi' | 'vaishnava_ekadashi'
      | 'pradosha' | 'sankranti' | 'eclipse';
  description?: string;
  deferralDate?: Date;  // Smarta Ekadashi → Dwadashi fast date
}

type FestivalRegion =
  | 'all'
  | 'tamil-nadu' | 'kerala' | 'karnataka' | 'andhra-pradesh' | 'telangana'
  | 'west-bengal' | 'odisha' | 'assam' | 'bihar' | 'jharkhand'
  | 'gujarat' | 'maharashtra' | 'goa' | 'rajasthan'
  | 'punjab' | 'haryana' | 'himachal-pradesh' | 'uttarakhand'
  | 'uttar-pradesh' | 'madhya-pradesh'
  | 'nepal';

// Legacy slugs accepted (mapped internally): 'tamil' → 'tamil-nadu',
// 'bengal' → 'west-bengal', 'north-india' → 'all'.
```

</details>

<details>
<summary><strong>Eclipses & Bhadra</strong></summary>

```typescript
interface EclipseInfo {
  kind: 'solar' | 'lunar';
  subtype: 'partial' | 'total' | 'annular' | 'penumbral';
  start: Date; peak: Date; end: Date;
  visibleFromLocation: boolean;
  obscuration: number;      // disc AREA covered at peak, [0, 1]
  magnitude: number;        // catalogue magnitude — disc DIAMETER covered.
                            // Not [0, 1]: >1 for a total eclipse, negative
                            // for a penumbral lunar one (the Moon misses
                            // the umbra), exactly as NASA's canon prints it.
  sutakStart: Date;         // 12 h pre-solar / 9 h pre-lunar
  sutakEnd: Date;
  description: string;
}

interface BhadraInfo {
  start: Date; end: Date;
  location: 'earth' | 'heaven' | 'paatal';   // 'earth' = malefic for all work
  locationName: string;                      // localized display name
  isActive: boolean;
}
```

</details>

<details>
<summary><strong>Jyotish</strong></summary>

```typescript
type GrahaName = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter'
               | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu';

interface GrahaPosition {
  planet: GrahaName;
  siderealLongitude: number;
  rashi: RashiInfo;
  degreeInRashi: number;
  nakshatra: NakshatraInfo;
  isRetrograde: boolean;     // always false for Sun/Moon; always true for Rahu/Ketu
}

type DashaLord = 'Ketu' | 'Venus' | 'Sun' | 'Moon' | 'Mars'
              | 'Rahu' | 'Jupiter' | 'Saturn' | 'Mercury';

interface MahaDasha   { lord: DashaLord; startDate: Date; endDate: Date;
                        years: number; antarDashas: AntarDasha[]; }
interface VimshottariDashaResult {
  currentMahaDashaLord: DashaLord;
  currentIndex: number;
  mahaDashas: MahaDasha[];
}

interface ChandraBalamInfo {
  house: number;                  // 1 = janma rashi; 12 = rashi before janma
  quality: 'strong' | 'weak';     // Shubha houses = 1,3,6,7,10,11
  englishName: string;            // "Shubha" | "Ashubha"
  name: string;
}

interface TarabalaInfo {
  taraIndex: number;              // 0..8 in 9-tara cycle from janma nakshatra
  englishName: string;            // Janma | Sampat | Vipat | Kshema | Pratyari
                                  // | Sadhaka | Vadha | Mitra | Ati-Mitra
  name: string;
  quality: 'auspicious' | 'inauspicious';
}
```

</details>

<details>
<summary><strong>Full export list</strong></summary>

```typescript
// Primary entry points
getDailyPanchang, getInstantPanchang

// Astronomy
getSunrise, getSunset, getMoonrise, getMoonset
getSiderealSunLongitude, getSiderealMoonLongitude, getAyanamsa

// Inauspicious / Muhurta
computeRahuKalam, computeGulikaKalam, computeYamaganda
computeVarjyam, computeGandaMula, computeAnandadiYoga
computePanchakaRahita, computeDoGhati, computeGowriPanchangam
computeAbhijitMuhurta, computeBrahmaMuhurta, computeVijayaMuhurta
computeGodhuliMuhurta, computeNishitaMuhurta, computeAmritKala
computeMadhyahna, computePratahSandhya, computeSayahnaSandhya

// Eclipses
getUpcomingSolarEclipse, getUpcomingLunarEclipse, getEclipseDuringDay
isEclipseVisibleAnyPhase

// Moon phases (new / quarters / full as precise instants)
computeMoonPhasesInRange

// Jyotish — planets, dashas, transits
computePlanetaryPositions, GRAHA_ABBR
computeVimshottariDasha, computeVimshottariDashaFromBirth, computeVimshottariPratyantar
computeAshtottariDasha, computeYoginiDasha, computeCharaDasha, computeNarayanDasha
computeChandraBalam, computeTarabala, computeSadeSati

// Jyotish — chart
computeLagna, computeBhava, computeRashiChart, computeNavamsa, computeDivisionalChart
computeHoraLagna, computeGhatiLagna, computeBhavaLagna, computeSripatiLagna
computeDignity

// Jyotish — strength, yogas, sensitive
computeAspects, computeShadbala, computeBhavaBala, computeAshtakavarga
computeYogas, computeJaiminiKarakas
computeVarshaphala, computeTithiPravesha, computeArudhas, computeUpagrahas, computeArgala

// Jyotish — compatibility, doshas
computeAshtakoot, computePathuPorutham
computeMangalDosha, computeKaalSarp, computePitruDosha

// KP / Prashna
computeKpSubLord, computeKpCuspalSubLords, computeKpSignificators
computePrashnaChart

// Muhurta engine
scoreMuhurta, computeAuspiciousDatesInRange, STOCK_MUHURTA_RULES
vivahRule, grihaPraveshRule, namakaranaRule, vidyarambhRule, vahanKharidiRule
annaprashanRule, mundanRule, upanayanamRule, karnavedhaRule
aksharabhyasamRule, seemanthamRule, shopOpeningRule, travelStartRule

// Calendar conversion + yearly listings
convertGregorianToHindu, convertHinduToGregorian
getKaliYugaYear, getHinduNewYear, computeSamvat
computeEkadashiDatesForYear, computeSankrantisForYear, computeFestivalsInRange
getUpcomingEclipses, computeEclipsesInRange

// Static data tables — build one, cache the JSON, then read it back through
// the engine-free panchang-ts/festivals · /eclipses · /moon-phases entries.
// No table ships with the package.
buildFestivalsTable, buildEclipsesTable, buildMoonPhasesTable

// Errors
PanchangError
```

</details>

---

## React Native / Hermes

Works with Expo and bare React Native (Hermes engine). Pass `timezone` as a
**number** — IANA strings need `Intl`, which older Hermes versions lack.

Two-pass rendering pattern for smooth UI:

```typescript
import { getDailyPanchang } from 'panchang-ts';
import { InteractionManager } from 'react-native';

// Pass 1 — cheapest useful result: elements, slots, muhurtas (~0.18 ms Node).
// `sections` is the lever; `computeEndTimes: false` only helps once it is
// narrowed, and slightly hurts on a full-section call.
const fast = getDailyPanchang(date, location, {
  timezone: 330,
  sections: [],
  computeEndTimes: false,
});
setState(fast);

// Pass 2 — background, everything (~1.1 ms Node)
InteractionManager.runAfterInteractions(() => {
  setState(getDailyPanchang(date, location, { timezone: 330 }));
});
```

---

## Accuracy

8,235 tests across 104 files, including fixtures cross-verified against reference
panchang calculations spanning 2025–2026 across 10 Indian cities plus New York,
London, Sydney, Dubai, Singapore (diaspora fixtures cover DST on
`America/New_York`).

| Element | Accuracy |
|---|---|
| Sunrise / Sunset | ≤29 s observed vs reference minute-midpoint (±45 s tolerance) |
| Moonrise / Moonset | Meeus apparent-upper-limb (refraction + parallax); ~3–5 min vs simpler-horizon authorities is expected |
| Tithi / Nakshatra / Yoga / Karana names | Exact match vs reference |
| Tithi / Nakshatra / Yoga / Karana end-times | ≤60 s vs Drik across all 20 audited comparisons (tithi 46 s, karana 51 s, nakshatra 24 s, yoga 60 s) |
| Ayanamsa (Lahiri) | Reproduces DrikPanchang's published value to ~0.01″ across 1950–2050 |
| Planetary positions (Sun–Saturn) | ±0.02° sidereal |
| Planetary positions (Rahu/Ketu, mean node) | ≤0.5° typical; ±2° tolerance |
| Planetary positions (Rahu/Ketu, true node) | ≤0.6° typical (Meeus periodic correction) |
| Lagna sidereal longitude | Cross-checked against Jagannath Hora reference charts |
| D1 / D9 house placement | Exact match vs reference for 9-graha placement |
| Ashtakoot total | ±1 point per pair across 30+ matched pairs |
| Sade Sati arc start/end | ±1–2 days vs authoritative ephemerides |

**End-time drift.** Drik publishes end times to the minute, so each comparison
above carries ±30 s of quantization — that, not the search, dominates what is
left. Two independent checks bound the library's own contribution: the reported
value matches an exact bisection of the same index function to ≤24 ms, and Sun
and Moon agree with Drik's sidereal positions to well under an arcsecond
(`tests/validation/element-endtime-audit.test.ts` carries the working).

**Ayanamsa.** Only Lahiri is verified against an external reference — Drik
publishes no value for the other four. Raman, KP, True Chitrapaksha and
Thirukanitham are held at their historical offsets from Lahiri, so correcting
Lahiri carried them along rather than silently changing how each relates to it.

**Detection notes.** **Aadal / Vidaal** follow the classical Moon-from-Sun
nakshatra-distance rule (AstroShastra, HoraSarvam, Ernst Wilhelm), NOT the
Tamil-Vakya weekday rule used by some online panchangs. **Varjyam** emits the
sunrise-anchored nakshatra's window only. **Do Ghati Muhurta** does not rotate
by weekday — the same 30-name deity-keyed sequence applies every day.

### Festival Detection — Documented Tradeoff

The library uses **tithi-at-sunrise** to resolve a festival to a calendar day.
Some authorities use other classical rules for certain festivals; where those
rules pick a different day, output can drift ±1 day:

| Alternative rule | Affects |
|---|---|
| Tithi-at-midnight | Krishna Janmashtami, Maha Shivaratri, Diwali / Lakshmi Puja |
| Madhyahna-vyapini | Ganesh Chaturthi (edge years), Akshaya Tritiya 2026 |
| Kshaya-tithi handling | Ugadi 2026-03-19 (Pratipada is Kshaya) |

Everything else — Holi, Ugadi (non-Kshaya years), Rama Navami, Raksha Bandhan,
Ganesh Chaturthi (normal years), Navaratri, Dussehra, Karva Chauth, Hanuman
Jayanti — matches the canonical date across 2025 and 2026 fixtures.

---

## Performance

Measured at Pune on an Apple M-series laptop under Node 24, median of 11
processes per configuration. Treat them as relative guidance, not a spec — they
move with hardware, latitude and date.

Two columns, because they differ and both are real. **Distinct days** is the
calendar-scan cost: every call misses the solar rise/set cache. **Same day
repeated** is what a UI that re-renders one date sees, and what `npm run bench`
reports. The last column is the **published 4.3.1 package**, installed from npm
and benchmarked beside this one.

| `getDailyPanchang` call | Distinct days | Same day repeated | 4.3.1 (distinct) |
|---|---|---|---|
| Default (all sections + end-times) | **~0.41 ms** | **~0.17 ms** | ~6.06 ms |
| `computeEndTimes: false` | ~0.39 ms | ~0.15 ms | ~5.63 ms |
| Without `'festivals'` | ~0.39 ms | — | n/a |
| `sections: ['festivals', 'eclipse']` | ~0.40 ms | — | n/a |
| `sections: []` | ~0.27 ms | — | n/a |
| `sections: []` + `computeEndTimes: false` | ~0.25 ms | ~0.14 ms | n/a |
| `getInstantPanchang` | ~0.21 ms | ~0.10 ms | ~0.43 ms |

`sections` did not exist before v5, so the rows using it have no 4.3.1
counterpart — passing it to 4.3.1 is silently ignored and you get a full run.

**A default day is ~15× cheaper than in 4.3.1**, and a repeated day ~37×. Most
of that is not tuning: 4.3.1 ran `astronomy-engine`'s full lunar theory inside
the eclipse search on every day containing a syzygy, and had no cache that
survived a call.

Cost is dominated by ephemeris evaluations, so the lever that matters is the one
that avoids them:

- **`sections`** — skip the optional ephemeris-backed blocks you don't need.
  Dropping `'festivals'` takes a default call from ~0.41 ms to ~0.39 ms cold,
  and dropping everything takes it to ~0.27 ms. See
  [Narrowing the work](#narrowing-the-work).
- **`computeEndTimes: false`** — a small win, never a large one. It skips the
  transition searches, but those read through the same interpolated longitude
  blocks the rest of the call has already built, so what it saves is arithmetic
  rather than ephemeris: ~5% cold, ~10% warm. Use it to drop `endTime` fields
  you don't want, not to go faster.

  *Changed in v5.* Both entry points now always interpolate, so output depends
  on neither `sections` nor `computeEndTimes` — see `INTERPOLATE_ALWAYS` in
  `src/core/panchang.ts`. Earlier development builds chose the longitude cache's
  mode from `computeEndTimes`, which made asking for *less* output cost *more*
  on a full call; that is gone.

Repeated calls for the same location-day are cheaper because solar rise/set
events are cached process-wide, keyed on `(direction, lat, lon, elevation, UTC
day)` and bounded at 20,000 entries. The cache makes sunrise single-valued as
well as fast — see [Upgrading from 4.x](#sunrise-is-single-valued-per-location-day).
It does not make a *single* cold `getSunrise` or `getMoonrise` cheaper — those
are within a few percent of 4.3.1 — what it removes is the second and every
later call for the same day.

Range helpers apply the same narrowing internally:
`computeEkadashiDatesForYear` reads only the tithi at sunrise and so runs with
every optional section off (**~18 ms** for a full year, against ~2,360 ms in
4.3.1); `computeFestivalsInRange` keeps only `'festivals'` and `'eclipse'`
(**~131 ms/year**, against ~2,180); `computeSankrantisForYear` needs only the
Sun, so it scans one solar longitude per day and bisects the 12 transits rather
than building a panchang each day (**~3.3 ms/year**, against ~154).

Birth-chart helpers are independent — calling them does not add work to
`getDailyPanchang`. Within them, `computeShadbala` and `computeBhavaBala` build
the natal positions once and derive all seven charts from them (~0.33 ms each,
against ~0.72 in 4.3.1).

**Charts are the one place v5 is slower.** `computeRashiChart` and
`computeNavamsa` cost **~0.32 ms** against ~0.10 in 4.3.1 — 3.3×, entirely the
planetary ephemeris, and the deliberate price of an order-of-magnitude accuracy
gain against JPL DE441 (Mercury 6.50″ → 0.30″, Venus 19.59″ → 0.86″). If you
build many charts and do not need that precision, 4.x was cheaper; nothing else
in the library regressed.

### Narrowing the work

`PanchangSection` lists the four optional blocks. Everything else a daily
panchang returns — the five elements, slot systems, muhurtas, inauspicious
periods, masa / samvat / rashi — is arithmetic over the sunrise / sunset /
next-sunrise triplet and is always computed, because skipping it would save
nothing.

| Section | Covers | Fields when omitted |
|---|---|---|
| `'festivals'` | Festival detection — needs the prior day's sunrise/sunset, the next day's transit, per-kala tithi anchors, and the prior day's Chandra Masa | `festivals: []` — but an eclipse entry is still prepended when `'eclipse'` is on |
| `'eclipse'` | Eclipse overlapping the Hindu day | `eclipse: null` |
| `'moonTimes'` | `moon.rise` / `moon.set` | `null` |
| `'lunarWindows'` | Bhadra, Varjyam, Panchaka-Rahita — each binary-searches lunar longitude across the day | `null` / `[]` |

```typescript
// Everything (default).
getDailyPanchang(date, loc, { timezone: 330 });

// Festivals only — no moon times, no Bhadra/Varjyam windows.
getDailyPanchang(date, loc, {
  timezone: 330,
  sections: ['festivals', 'eclipse'],
});

// Cheapest useful call: elements, slots, muhurtas and inauspicious periods
// only. Those are arithmetic on the sunrise triplet and are always computed.
getDailyPanchang(date, loc, {
  timezone: 330,
  sections: [],
  computeEndTimes: false,
});
```

Omitting a section leaves its fields at their documented empty value (`null`
or `[]`) — never a half-filled one.

Narrowing is **exactly output-neutral**: every field a narrowed call does
compute is identical, to the millisecond, to what the full call would have
returned. `sections` only decides what is skipped, never what a computed value
is. (This is guaranteed by `LongitudeCache` memoizing on the exact instant. It
was not true while that memo binned longitudes into 60-second buckets, when
narrowing could shift transition times by up to 63 s.)

### A note on Hermes / React Native

Earlier versions of this table also quoted Hermes figures. Those were budget
targets from the project plan, never measurements: `npm run test:hermes` runs
`hermes-parser` over the built bundle to prove the syntax is Hermes-compatible,
which is a *parse* check and does not execute anything. Hermes numbers will be
published here once they are actually measured on device.

What does carry over is the shape of the cost: it is dominated by ephemeris
math, so the `sections` and `computeEndTimes` levers above have the same
proportional effect on any runtime.

---

## Error Handling

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
`INVALID_ELEVATION`, `INVALID_TIMEZONE`, `INVALID_AYANAMSA`,
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
| Node.js 18+ | Supported |
| React Native (Hermes) | Supported (pass `timezone` as number) |
| Expo (managed + bare) | Supported |
| Browser (modern, ESM) | Supported |
| Browser (legacy / IE) | Not supported |

---

## Acknowledgements

[astronomy-engine](https://github.com/cosinekitty/astronomy) by Don Cross — the
sole runtime dependency. MIT licensed.

## License

MIT
