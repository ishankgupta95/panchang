# panchang-ts

[![npm version](https://img.shields.io/npm/v/panchang-ts)](https://www.npmjs.com/package/panchang-ts)

Pure TypeScript Hindu Panchang (almanac), Jyotish, and Birth Chart calculations.
Zero native dependencies. Works offline in React Native (Hermes), Node.js, and browsers.

**Fast** (~0.2 ms trimmed, ~1.5 ms full) · **Typed** (full TypeScript) · **Offline** (pure JS math) · **8,233 tests across 104 files**

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

console.log(result!.tithis[0].name);          // "Krishna Chaturdashi"
console.log(result!.nakshatras[0].name);      // "Mrigashira"
console.log(result!.vara.name);               // "Mangalawara"
console.log(result!.chandramasa.name);        // "Magha"
console.log(result!.samvat.vikramSamvat);     // 2081
```

### Reading Output Times

All `Date` objects are **offset-adjusted** to the requested timezone. Read time
components via `getUTC*` — `.getHours()` would use your system zone:

```typescript
const sunrise = result!.sunrise;
const h = sunrise.getUTCHours();    // 7
const m = sunrise.getUTCMinutes();  // 4 → 07:04 local time
```

`moonrise` / `moonset` can be `null` — the Moon occasionally does not rise or
set on a given calendar day, which is normal.

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

r.tithis.forEach(t => console.log(t.name, t.paksha, t.completionPercentage, t.endTime));
r.nakshatras.forEach(n => console.log(n.name, n.pada, n.endTime));
r.yogas.forEach(y => console.log(y.name, y.endTime));
r.karanas.forEach(k => console.log(k.name, k.type, k.endTime));
console.log(r.vara.name, r.vara.englishName);   // "Mangalawara", "Tuesday"

// Single-instant snapshot:
import { getInstantPanchang } from 'panchang-ts';
const i = getInstantPanchang(new Date(), location)!;
console.log(i.tithi.name, i.nakshatra.name, i.yoga.name, i.karana.name, i.vara.name);
```

## Lunar & Solar Calendar

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330, masaSystem: 'purnimanta' })!;

r.chandramasa.name;           // active system (default: Purnimanta / North Indian)
r.chandramasa.amantaName;     // South Indian
r.chandramasa.purnimantaName; // North Indian
r.chandramasa.isAdhika;       // true during leap months
r.samvat.vikramSamvat;        // 2081
r.samvat.shakaSamvat;         // 1946

r.masa.name;                  // current solar month (Mesha … Meena)
r.suryaNakshatra.name;        // Sun's nakshatra
r.chandraRashi.name;          // Moon sign
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
r.sunrise; r.sunset; r.moonrise; r.moonset; r.nextSunrise;
r.dayDurationMinutes; r.nightDurationMinutes;

// Auspicious muhurtas
r.brahmaMuhurta;     // two muhurtas before sunrise
r.abhijitMuhurta;    // 8th day-muhurta; null on Wednesday (Drik convention)
r.vijayaMuhurta;     // 11th day-muhurta
r.godhuliMuhurta;    // "cow-dust" sunset muhurta
r.nishitaMuhurta;    // midnight muhurta (Shivaratri)
r.madhyahna;         // solar noon ±24 min
r.pratahSandhya;     // dawn twilight, ends at sunrise
r.sayahnaSandhya;    // dusk twilight, starts at sunset
r.amritKala;         // nakshatra-specific window (null when nakshatra has none)
```

`pratahSandhya` / `sayahnaSandhya` width = `nightDuration / 10` (~62–81 min).

## Inauspicious Periods

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

r.rahuKalam;       // { start, end }
r.gulikaKalam;
r.yamaganda;
r.durMuhurta;      // two ~48-min windows
r.varjyam;         // { start, end } | null
r.gandaMula;       // { active, severity: 'mild'|'severe'|null, ... }
r.bhadra;          // { start, end, location: 'earth'|'heaven'|'paatal', isActive } | null
r.panchaka;        // boolean — Moon in last 5 nakshatras
```

## Time-Slot Systems

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

// Choghadiya — 8 day + 8 night named, rated slots (Amrit, Kaal, Shubh, Rog, …)
r.choghadiya.day.forEach(s => console.log(s.name, s.qualityName, s.start, s.end));

// Gowri Panchangam ("Nalla Neram") — 8 day + 8 night Tamil slots
r.gowriPanchangam.day.forEach(s => console.log(s.name, s.qualityName));

// Hora — 12 day + 12 night planetary hours (Chaldean order)
r.hora.day.forEach(h => console.log(h.planet, h.start, h.end));

// Do Ghati Muhurta — 15 day + 15 night ~48-min deity-keyed slots (no vara rotation)
r.doGhatiMuhurta.day.forEach(g => console.log(g.name, g.start, g.end));

// Panchaka Rahita — slices of the day FREE of Panchaka ([] when it pervades)
r.panchakaRahita.forEach(slice => console.log(slice.start, slice.end));
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

### Pre-computed table (bundled, India / IST)

If you want festival *dates* without running the engine, import the static
table at `panchang-ts/festivals`. It bundles a rolling **2-years-past /
5-years-future** window pre-computed against Varanasi (IST). Within India
these dates are essentially universal.

```typescript
import {
  getFestivalsForYear,
  getFestivalsForDate,
  FESTIVALS_META,
  FESTIVALS_YEAR_RANGE,
} from 'panchang-ts/festivals';

const yr = FESTIVALS_YEAR_RANGE.start;          // e.g. { start: 2024, end: 2031 }
getFestivalsForYear(yr)!.length;                // ~150 festival days
const diwali = getFestivalsForYear(yr)!
  .find(d => d.festivals.some(f => f.name === 'Diwali'))!.date;
getFestivalsForDate(diwali);                    // [Narak Chaturdashi, Diwali]
getFestivalsForDate(diwali, 'hi');              // [नरक चतुर्दशी, दिवाली]
FESTIVALS_META.referenceLocation;               // "Varanasi"
FESTIVALS_META.languages;                       // ["en", "hi"]
```

This entry point is engine-free — it ships only the JSON + accessors, so
importing it won't pull the calculation engine into your bundle. Both `en`
and `hi` are bundled (names *and* descriptions); pass the locale as the
second argument. Eclipses are excluded here (visibility is location-dependent)
— they ship as their own bundled table at `panchang-ts/eclipses` (see
[Eclipses](#eclipses)).

### Festivals outside India — build a location table and cache it

The bundled table is **IST-only**. Elsewhere (Europe, North America, rest
of world) festival dates can shift by ±1 day, because canonical times
(nishita / pradosha / chandrodaya …) are observer-dependent — and the shift
tracks the timezone offset, not the "region", so a single per-continent
table would mis-date boundary-day festivals.

For an offline app serving users worldwide, the right pattern is
**compute-once-then-cache for the user's actual location**. Build a
location-specific table with `buildFestivalsTable` (from the main entry —
it uses the engine), persist the returned JSON, then read it back through
the same accessors via their `source` argument:

```typescript
import { buildFestivalsTable } from 'panchang-ts';
import { getFestivalsForYear, getFestivalsForDate } from 'panchang-ts/festivals';

// On first use at the user's location (a few seconds on-device — run it in
// the background / chunk by year), then cache `table` to disk/MMKV.
const table = buildFestivalsTable({
  location: { latitude: 40.7128, longitude: -74.006 },
  timezoneOffsetMinutes: -300,   // US Eastern (EST); 0 = UK, 330 = IST
  startYear: 2024,
  endYear: 2031,
  languages: ['en'],             // omit hi to halve the size
});

// Later reads are instant lookups against the cached table:
getFestivalsForYear(2026, 'en', table);
getFestivalsForDate('2026-11-08', 'en', table);  // key is in the table's tz
```

`buildFestivalsTable` returns the same `FestivalsFile` shape as the bundled
data, so a cached table and the bundled India table are interchangeable as
the `source` argument. India-majority apps can lean on the bundled table for
zero first-load latency and only compute-and-cache for non-IST users.

**Other notes:** Karva Chauth / Dhanteras / Diwali emit with Purnimanta
paksha naming. To regenerate the bundled India table after a registry
change, run `npm run festivals:gen` (rolling window, no constants to edit).

## Eclipses

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;
if (r.eclipse) {
  r.eclipse.kind;                 // 'solar' | 'lunar'
  r.eclipse.subtype;              // 'partial' | 'total' | 'annular' | 'penumbral'
  r.eclipse.magnitude;            // 0..1 fraction obscured at peak
  r.eclipse.visibleFromLocation;  // body above horizon at peak?
  r.eclipse.start; r.eclipse.peak; r.eclipse.end;
  r.eclipse.sutakStart; r.eclipse.sutakEnd;
  // Sutak: 12 h (4 prahara) before solar, 9 h (3 prahara) before lunar
}

import { getUpcomingSolarEclipse, getUpcomingLunarEclipse } from 'panchang-ts';
const next = getUpcomingSolarEclipse(new Date(), loc, 365 /* days */);
```

### Pre-computed table (bundled, India / IST)

Like the festivals table, eclipse data ships as a static, engine-free entry
at `panchang-ts/eclipses` — a rolling **2-years-past / 5-years-future** window
pre-computed against Varanasi (IST). It lists every eclipse **visible from
there during any phase** (so an eclipse already in progress at moon/sunrise or
moon/sunset is included); the `visibleAtPeak` flag tells you whether greatest
eclipse itself is observable. Within India visibility is essentially uniform.

```typescript
import {
  getEclipsesForYear,
  getEclipsesForDate,
  ECLIPSES_META,
  ECLIPSES_YEAR_RANGE,
} from 'panchang-ts/eclipses';

const e = getEclipsesForYear(2025)![0].eclipses[0];
e.kind;                 // 'lunar'
e.subtype;              // 'total'
e.start; e.peak; e.end; // ISO UTC strings
e.magnitude;            // 0..1 obscuration at peak
e.visibleFromLocation;  // visible during any phase? (always true in bundled table)
e.visibleAtPeak;        // is greatest eclipse itself above the horizon?
e.sutak;                // { start, end } — see note below
getEclipsesForDate('2025-09-07', 'hi');  // [पूर्ण चंद्र ग्रहण]
ECLIPSES_META.referenceLocation;         // "Varanasi"
```

Each entry carries `en` + `hi` text. Solar eclipses report the subtype seen
**locally** (a globally-total eclipse may read `partial` from Varanasi). The
`sutak` window is present only where it applies — all visible solar eclipses
and visible **umbral** (partial/total) lunar eclipses; **penumbral** lunar
eclipses carry no `sutak` and are not religiously observed (drik / pandit
consensus). For full astronomical detail (e.g. eclipses *not* visible in
India), use `getUpcomingEclipses` / `getEclipsesInRange` from the main entry.

**Outside India:** which eclipses are visible — and thus carry `sutak` —
differs by location. Build and cache a location-specific table with
`buildEclipsesTable` (main entry, uses the engine), then read it back via the
same accessors' `source` argument — the same compute-once-then-cache pattern
as festivals:

```typescript
import { buildEclipsesTable } from 'panchang-ts';
import { getEclipsesForYear } from 'panchang-ts/eclipses';

const table = buildEclipsesTable({
  location: { latitude: 51.5074, longitude: -0.1278 },
  timezoneOffsetMinutes: 0,        // UK / GMT
  startYear: 2024,
  endYear: 2031,
  // visibleOnly: false → also include eclipses below the horizon (no sutak)
});
getEclipsesForYear(2025, 'en', table);
```

To regenerate the bundled India table, run `npm run eclipses:gen` (rolling
window, no constants to edit).

## Moon Phases

The four principal lunar phases — **new** (Amavasya), **first quarter**,
**full** (Purnima), **last quarter** — as precise instants. (These are the
astronomical quarter moments, distinct from the same-named *tithis*, which are
~24h windows.)

```typescript
import { getMoonPhasesInRange } from 'panchang-ts';
const phases = getMoonPhasesInRange(new Date('2026-01-01'), new Date('2026-12-31'));
phases.forEach(p => console.log(p.phase, p.time.toISOString()));  // ~49 / year
```

### Pre-computed table (bundled, India / IST)

Same engine-free pattern as festivals and eclipses, at `panchang-ts/moon-phases`
— a rolling **2-years-past / 5-years-future** window. Phases are global
instants; the bundled table maps each onto its **IST** calendar date (so a new
moon at 19:52 UTC on Jan 18 is listed under Jan 19 in India).

```typescript
import {
  getMoonPhasesForYear,
  getMoonPhasesForDate,
  MOON_PHASES_META,
  MOON_PHASES_YEAR_RANGE,
} from 'panchang-ts/moon-phases';

getMoonPhasesForYear(2026)!.length;            // ~49 phase days
getMoonPhasesForDate('2026-01-03');            // [{ phase: 'full', name: 'Full Moon', ... }]
getMoonPhasesForDate('2026-01-03', 'hi');      // [{ phase: 'full', name: 'पूर्णिमा', ... }]
```

Each entry carries `phase`, the phase `time` (ISO UTC), and `en` + `hi` text.
For another timezone, build and cache a table with `buildMoonPhasesTable` (main
entry) and pass it as the accessors' `source` argument — it takes only a
`timezoneOffsetMinutes` (no coordinates, since phases are location-independent):

```typescript
import { buildMoonPhasesTable } from 'panchang-ts';
import { getMoonPhasesForYear } from 'panchang-ts/moon-phases';

const table = buildMoonPhasesTable({
  timezoneOffsetMinutes: -300,   // US Eastern
  startYear: 2024, endYear: 2031,
});
getMoonPhasesForYear(2026, 'en', table);
```

Regenerate the bundled India table with `npm run moon-phases:gen`.

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
r.chandraBalam!;  // { house, quality: 'strong'|'weak', name, englishName }
r.tarabala!;      // { taraIndex, name, englishName, quality }

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
import { scoreMuhurta, findAuspiciousDates, vivahRule } from 'panchang-ts';

const r = scoreMuhurta(new Date('2026-05-12'), DELHI, vivahRule, { timezone: 330 });
// → { date, score: 0..100, passes: boolean, reasons: string[] }

const dates = findAuspiciousDates(
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

Scoring: starts at 50; +10 per matching auspicious axis (tithi / nakshatra /
vara / yoga), -15 per inauspicious axis, hard exclusions zero the score.
Special yogas (Amrit Siddhi, Sarvartha Siddhi, Ravi/Guru Pushya) add +5;
Jwalamukhi subtracts -10. Clamped 0..100; `passes: true` when score ≥ 50.

## Calendar Conversion

```typescript
import {
  convertGregorianToHindu, convertHinduToGregorian,
  getKaliYugaYear, getHinduNewYear,
  getEkadashiDatesForYear, getSankrantisForYear,
  getFestivalsInRange, getUpcomingEclipses, getEclipsesInRange,
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

getEkadashiDatesForYear(2026, DELHI, { timezone: 330 });       // ~24 Date[]
getSankrantisForYear(2026, DELHI, { timezone: 330 });          // 12 SankrantiEvent[]
getFestivalsInRange(start, end, DELHI, { timezone: 330 });     // FestivalDay[]
getUpcomingEclipses(new Date(), DELHI, 5);
```

`getHinduNewYear` is region-aware: Tamil Nadu / Kerala / Punjab / Bengal / Assam
use the **solar** (Mesha Sankranti) anchor; elsewhere uses **Chaitra Shukla
Pratipada** (Ugadi / Gudi Padwa / Cheti Chand). When Pratipada is a kshaya
tithi (e.g. Ugadi 2026), falls back to the Amanta-Chaitra-masa boundary.

## Localization & Configuration

```typescript
const hi = getDailyPanchang(date, loc, { timezone: 330, language: 'hi' })!;
hi.tithis[0].name;          // "कृष्ण चतुर्दशी"
hi.vara.name;               // "मंगलवार"
hi.chandramasa.name;        // "माघ"
hi.choghadiya.day[0].name;  // "अमृत"
hi.vara.englishName;        // "Tuesday" — englishName always English

// All options:
const r = getDailyPanchang(date, loc, {
  timezone: 330,                          // number (UTC offset min) or IANA string
  ayanamsa: 'lahiri',                     // lahiri | raman | krishnamurti | true-chitra | thirukanitham
  language: 'en',                         // en | hi
  masaSystem: 'purnimanta',               // purnimanta | amanta
  region: 'all',                          // 21 state slugs + 'nepal' + 'all'
  computeEndTimes: true,                  // false → skip transition searches
  precision: 'standard',                  // standard (±30 s) | high (±1 s)
  sections: undefined,                    // undefined = all; see Performance
  janmaRashi: undefined,                  // pass to add r.chandraBalam
  janmaNakshatra: undefined,              // pass to add r.tarabala
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
  name: string;
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
  magnitude: number;        // [0, 1] at peak
  sutakStart: Date;         // 12 h pre-solar / 9 h pre-lunar
  sutakEnd: Date;
  description: string;
}

interface BhadraInfo {
  start: Date; end: Date;
  location: 'earth' | 'heaven' | 'paatal';   // 'earth' = malefic for all work
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
getMoonPhasesInRange

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
scoreMuhurta, findAuspiciousDates, STOCK_MUHURTA_RULES
vivahRule, grihaPraveshRule, namakaranaRule, vidyarambhRule, vahanKharidiRule
annaprashanRule, mundanRule, upanayanamRule, karnavedhaRule
aksharabhyasamRule, seemanthamRule, shopOpeningRule, travelStartRule

// Calendar conversion + yearly listings
convertGregorianToHindu, convertHinduToGregorian
getKaliYugaYear, getHinduNewYear, computeSamvat
getEkadashiDatesForYear, getSankrantisForYear, getFestivalsInRange
getUpcomingEclipses, getEclipsesInRange

// Static data tables (engine-using runtime builders; bundled JSON at
// panchang-ts/festivals, panchang-ts/eclipses, panchang-ts/moon-phases)
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

// Pass 1 — cheapest useful result: elements, slots, muhurtas (~0.2 ms Node).
// Dropping the optional sections matters more here than `computeEndTimes`.
const fast = getDailyPanchang(date, location, {
  timezone: 330,
  sections: [],
  computeEndTimes: false,
});
setState(fast);

// Pass 2 — background, everything (~1.5 ms Node)
InteractionManager.runAfterInteractions(() => {
  setState(getDailyPanchang(date, location, { timezone: 330 }));
});
```

---

## Accuracy

8,233 tests across 104 files, including fixtures cross-verified against reference
panchang calculations spanning 2025–2026 across 10 Indian cities plus New York,
London, Sydney, Dubai, Singapore (diaspora fixtures cover DST on
`America/New_York`).

| Element | Accuracy |
|---|---|
| Sunrise / Sunset | ≤29 s observed vs reference minute-midpoint (±45 s tolerance) |
| Moonrise / Moonset | Meeus apparent-upper-limb (refraction + parallax); ~3–5 min vs simpler-horizon authorities is expected |
| Tithi / Nakshatra / Yoga / Karana names | Exact match vs reference |
| Tithi / Nakshatra / Yoga / Karana end-times | ±3 min tolerance, max 2.01 min observed |
| Ayanamsa | ±0.005° vs Swiss Ephemeris |
| Planetary positions (Sun–Saturn) | ±0.02° sidereal |
| Planetary positions (Rahu/Ketu, mean node) | ≤0.5° typical; ±2° tolerance |
| Planetary positions (Rahu/Ketu, true node) | ≤0.6° typical (Meeus periodic correction) |
| Lagna sidereal longitude | Cross-checked against Jagannath Hora reference charts |
| D1 / D9 house placement | Exact match vs reference for 9-graha placement |
| Ashtakoot total | ±1 point per pair across 30+ matched pairs |
| Sade Sati arc start/end | ±1–2 days vs authoritative ephemerides |

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

Measured with `npm run bench` on an Apple M-series laptop under Node 24, Pune
2025-07-04. Treat them as relative guidance, not a spec — they move with
hardware and date.

| `getDailyPanchang` call | Node.js |
|---|---|
| Default (all sections + end-times) | ~1.5 ms |
| `computeEndTimes: false` | ~0.95 ms |
| `sections: []` | ~0.73 ms |
| `sections: []` + `computeEndTimes: false` | ~0.21 ms |
| `precision: 'high'` | ~2.1 ms |
| `getInstantPanchang` | ~0.34 ms |

Cost is dominated by ephemeris evaluations, so the levers that matter are the
ones that avoid them:

- **`sections`** — skip the optional ephemeris-backed blocks you don't need.
  `'festivals'` is by far the most expensive (it needs the previous day's
  sunrise/sunset and the next day's solar transit). See
  [Narrowing the work](#narrowing-the-work).
- **`computeEndTimes: false`** — skip the transition searches when you only
  need the names in force at sunrise.

Range helpers apply the same narrowing internally:
`getEkadashiDatesForYear` reads only the tithi at sunrise and so runs with
every optional section off (~90 ms for a full year);
`getFestivalsInRange` keeps only `'festivals'` and `'eclipse'` (~430 ms/year).

Birth-chart helpers are independent — calling them does not add work to
`getDailyPanchang`. Within them, `computeShadbala` and `computeBhavaBala`
build the natal positions once and derive all seven charts from them (~0.2 ms
each).

### Narrowing the work

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
