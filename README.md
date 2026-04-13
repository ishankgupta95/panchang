# panchang-ts

[![npm version](https://img.shields.io/npm/v/panchang-ts)](https://www.npmjs.com/package/panchang-ts)

Pure TypeScript Hindu Panchang (almanac) calculations. Zero native dependencies.
Works offline in React Native (Hermes), Node.js, and browsers.

**Fast** (~0.1 ms names-only, ~0.5 ms full) | **Typed** (full TypeScript types) | **Offline** (pure JS math, no network)

---

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Features](#features)
- [API Reference](#api-reference)
  - [`getDailyPanchang`](#getdailypanchangdate-location-options)
  - [`getInstantPanchang`](#getinstantpanchangdate-location-options)
  - [Options](#options)
  - [Low-level Utilities](#low-level-utilities)
- [Types](#types)
- [React Native / Hermes](#react-native--hermes)
- [Accuracy](#accuracy)
- [Performance](#performance)
- [Error Handling](#error-handling)
- [Compatibility](#compatibility)

---

## Install

```bash
npm install panchang-ts
# or
pnpm add panchang-ts
# or
yarn add panchang-ts
```

## Quick Start

```typescript
import { getDailyPanchang } from 'panchang-ts';

const result = getDailyPanchang(
  new Date(2025, 0, 14),                      // January 14, 2025
  { latitude: 23.1765, longitude: 75.7885 },  // Ujjain, India
  { timezone: 330 },                          // IST = UTC+5:30 = 330 minutes
);

// Pancha Anga
console.log(result.tithis[0].name);           // "Krishna Chaturdashi"
console.log(result.nakshatras[0].name);       // "Mrigashira"
console.log(result.vara.name);                // "Mangalavara"

// Lunar calendar (Purnimanta by default)
console.log(result.chandramasa.name);         // "Magha"
console.log(result.chandramasa.amantaName);   // "Pausha" (South Indian)
console.log(result.samvat.vikramSamvat);      // 2081

// Zodiac
console.log(result.chandraRashi.name);        // "Mithuna" (Moon in Gemini)
console.log(result.suryaNakshatra.name);      // "Uttara Ashadha"

// Astronomical events
console.log(result.sunrise);                  // Date (read via getUTC*)
console.log(result.moonrise);                 // Date | null

// Muhurta & inauspicious periods
console.log(result.brahmaMuhurta);            // { start: Date, end: Date }
console.log(result.rahuKalam);                // { start: Date, end: Date }

// Choghadiya — 8 daytime slots
result.choghadiya.day.forEach(slot => {
  console.log(slot.name, slot.qualityName);   // "Amrit", "Auspicious"
});

// Gowri Panchangam — 8 daytime slots
result.gowriPanchangam.day.forEach(slot => {
  console.log(slot.name, slot.qualityName);   // "Amrit", "Auspicious"
});

// Special Yogas active today
result.specialYogas.forEach(yoga => {
  console.log(yoga.name, yoga.type);          // "Guru Pushya Yoga", "guru_pushya"
});

// Festivals today
result.festivals.forEach(f => {
  console.log(f.name, f.type);               // "Makar Sankranti", "major"
});
```

### Reading Output Times

All `Date` objects in the result are **offset-adjusted** to the requested timezone.
Always read time components via `getUTC*` methods:

```typescript
const sunrise = result.sunrise;
const h = sunrise.getUTCHours();    // 7
const m = sunrise.getUTCMinutes();  // 4
// → Sunrise at 07:04 local time

// Format helper:
function fmt(d: Date) {
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${h}:${String(m).padStart(2, '0')}`;
}
fmt(result.rahuKalam.start); // "09:04"
```

Do **not** use `.getHours()` — it uses your system timezone, which may differ.

`moonrise` and `moonset` can be `null` — the Moon occasionally does not rise or set
on a given calendar day, which is normal.

### Language & Masa System

```typescript
// Sanskrit names (Devanagari)
const sa = getDailyPanchang(date, location, {
  timezone: 330,
  language: 'sa',
});
console.log(sa.tithis[0].name);              // "कृष्ण चतुर्दशी"
console.log(sa.vara.name);                    // "मङ्गलवारः"

// Hindi names
const hi = getDailyPanchang(date, location, {
  timezone: 330,
  language: 'hi',
});
console.log(hi.tithis[0].name);              // "कृष्ण चतुर्दशी"

// Amanta (South Indian) masa system
const amanta = getDailyPanchang(date, location, {
  timezone: 330,
  masaSystem: 'amanta',
});
console.log(amanta.chandramasa.name);         // Amanta month name
console.log(amanta.chandramasa.system);       // "amanta"
```

---

## Features

### Pancha Anga (5 Limbs)
Tithi, Nakshatra, Yoga, Karana, Vara — with transition times throughout the day.

### Lunar Calendar
Chandra Masa with Adhika (leap month) detection, both **Purnimanta** (North Indian, default) and **Amanta** (South Indian) systems, Vikram Samvat, Shaka Samvat.

### Muhurta & Auspicious Timing
Brahma Muhurta, Abhijit Muhurta, Choghadiya (16 slots), Gowri Panchangam / Nalla Neram (16 slots), Hora (24 planetary hours), Dur Muhurta (2 inauspicious windows).

### Inauspicious Periods
Rahu Kalam, Gulika Kalam, Yamaganda, Panchaka detection.

### Special Yogas & Festivals
Amrit Siddhi, Sarvartha Siddhi, Ravi Pushya, Guru Pushya yoga detection. 24 major pan-Indian festivals, recurring Ekadashi & Pradosha Vrata, Sankranti — Adhika months auto-skipped.

### Jyotish (Vedic Astrology)
All 9 graha positions (geocentric, sidereal) with rashi, nakshatra, pada, and retrograde status. Vimshottari Dasha with Antardasha breakdown — from a birth moment alone or from an explicit Moon longitude. Chandra Balam (transit-Moon favorability relative to janma rashi).

### Astronomy
Sunrise, Sunset, Moonrise, Moonset, Chandra Rashi (Moon sign), Surya Nakshatra.

### Localization
3 languages: **English**, **Sanskrit** (Devanagari), **Hindi**. All returned display strings respect the `language` option.

### Configuration
3 ayanamsa systems (Lahiri, B.V. Raman, KP), 2 masa systems (Purnimanta, Amanta), adjustable precision, optional fast mode (`computeEndTimes: false` for ~5x speedup).

---

## API Reference

### `getDailyPanchang(date, location, options)`

Returns the full Hindu day from sunrise to next sunrise, with all element transitions.

```typescript
import { getDailyPanchang } from 'panchang-ts';

const result = getDailyPanchang(
  date,      // Date — any moment within the local calendar day
  location,  // GeoLocation — { latitude, longitude, elevation? }
  options,   // PanchangOptions — { timezone, ayanamsa?, language?, ... }
);
```

**Returns: `DailyPanchangResult`**

| Field | Type | Description |
|-------|------|-------------|
| `date` | `Date` | Input date |
| `location` | `GeoLocation` | Input location |
| `timezone` | `number` | Resolved UTC offset in minutes |
| `sunrise` | `Date` | Sunrise (offset-adjusted) |
| `sunset` | `Date` | Sunset (offset-adjusted) |
| `nextSunrise` | `Date` | Following day's sunrise (offset-adjusted) |
| `dayDurationMinutes` | `number` | Length of daytime in minutes |
| `nightDurationMinutes` | `number` | Length of night in minutes |
| `tithis` | `DailyTithiInfo[]` | Tithis active during the day (usually 1-2) |
| `nakshatras` | `DailyNakshatraInfo[]` | Nakshatras active during the day |
| `yogas` | `DailyYogaInfo[]` | Yogas active during the day |
| `karanas` | `DailyKaranaInfo[]` | Karanas active during the day (usually 2-4) |
| `vara` | `VaraInfo` | Weekday (Vara) |
| `rahuKalam` | `TimePeriod` | Rahu Kalam start/end |
| `gulikaKalam` | `TimePeriod` | Gulika Kalam start/end |
| `yamaganda` | `TimePeriod` | Yamaganda start/end |
| `abhijitMuhurta` | `TimePeriod` | Abhijit Muhurta start/end |
| `brahmaMuhurta` | `TimePeriod` | Brahma Muhurta — two muhurtas before sunrise |
| `masa` | `MasaInfo` | Solar month (Saura Masa) |
| `chandramasa` | `ChandraMasaInfo` | Lunar month + Adhika (leap) flag |
| `samvat` | `SamvatInfo` | Vikram Samvat and Shaka Samvat year numbers |
| `chandraRashi` | `RashiInfo` | Moon's zodiac sign (changes every ~2.5 days) |
| `suryaNakshatra` | `RashiInfo` | Sun's nakshatra (changes every ~13-14 days) |
| `choghadiya` | `ChoghadiyaInfo` | 8 day + 8 night slots, each named and rated |
| `gowriPanchangam` | `GowriInfo` | 8 day + 8 night Gowri Nalla Neram slots |
| `hora` | `HoraInfo` | 12 day + 12 night horas, each with ruling planet |
| `moonrise` | `Date \| null` | Moonrise; `null` if none that day |
| `moonset` | `Date \| null` | Moonset; `null` if none that day |
| `panchaka` | `boolean` | `true` when Moon is in last 5 nakshatras |
| `specialYogas` | `SpecialYogaInfo[]` | Auspicious yogas active today |
| `durMuhurta` | `[TimePeriod, TimePeriod]` | Two inauspicious ~48-min windows |
| `festivals` | `FestivalInfo[]` | Festivals / observances today |
| `ayanamsa` | `number` | Ayanamsa in degrees at sunrise |
| `siderealSunAtSunrise` | `number` | Sun sidereal longitude at sunrise (degrees) |
| `siderealMoonAtSunrise` | `number` | Moon sidereal longitude at sunrise (degrees) |

---

### `getInstantPanchang(date, location, options?)`

Returns the single Panchang element active at an exact UTC moment.

```typescript
import { getInstantPanchang } from 'panchang-ts';

const result = getInstantPanchang(
  new Date('2025-01-14T03:00:00Z'),           // UTC moment
  { latitude: 18.5204, longitude: 73.8567 },
  { language: 'sa' },                          // Sanskrit names
);

console.log(result.tithi.name);              // "कृष्ण चतुर्दशी"
console.log(result.nakshatra.name);          // "मृगशिरा"
console.log(result.chandramasa.name);        // "माघ"
console.log(result.chandraRashi.name);       // "मिथुन"
console.log(result.samvat.vikramSamvat);     // 2081
console.log(result.panchaka);               // false
```

**Returns: `InstantPanchangResult`**

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `Date` | Input UTC moment |
| `location` | `GeoLocation` | Input location |
| `tithi` | `TithiInfo` | Active Tithi with paksha, number, completion % |
| `nakshatra` | `NakshatraInfo` | Active Nakshatra with pada, degrees |
| `yoga` | `YogaInfo` | Active Yoga |
| `karana` | `KaranaInfo` | Active Karana (movable or fixed) |
| `vara` | `VaraInfo` | Active Vara (weekday) |
| `chandramasa` | `ChandraMasaInfo` | Lunar month + Adhika flag |
| `samvat` | `SamvatInfo` | Vikram Samvat and Shaka Samvat year numbers |
| `chandraRashi` | `RashiInfo` | Moon's zodiac sign |
| `suryaNakshatra` | `RashiInfo` | Sun's nakshatra |
| `panchaka` | `boolean` | `true` when Moon is in last 5 nakshatras |
| `specialYogas` | `SpecialYogaInfo[]` | Auspicious yogas at this moment |
| `festivals` | `FestivalInfo[]` | Festivals / observances at this moment |
| `ayanamsa` | `number` | Ayanamsa in degrees |
| `siderealSun` | `number` | Sun sidereal longitude (degrees) |
| `siderealMoon` | `number` | Moon sidereal longitude (degrees) |

---

### Options

**`PanchangOptions`** (required for `getDailyPanchang`):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timezone` | `number \| string` | **required** | UTC offset in minutes (330 for IST). Use a number on Hermes — IANA strings require `Intl`. |
| `ayanamsa` | `'lahiri' \| 'raman' \| 'krishnamurti'` | `'lahiri'` | Ayanamsa system |
| `language` | `'en' \| 'sa' \| 'hi'` | `'en'` | Language for all element names. `'sa'` = classical Sanskrit Devanagari, `'hi'` = modern Hindi Devanagari. |
| `computeEndTimes` | `boolean` | `true` | Set `false` for ~5x faster, names-only output |
| `precision` | `'standard' \| 'high'` | `'standard'` | Binary-search iterations (15 vs 25). High precision is rarely needed. |
| `masaSystem` | `'purnimanta' \| 'amanta'` | `'purnimanta'` | Lunar month naming system. Purnimanta (North Indian) or Amanta (South Indian). |

**`InstantPanchangOptions`** (optional for `getInstantPanchang`): same as above but without `timezone`.

---

### Low-level Utilities

Exported for advanced use cases — building custom tools, visualizations, or Jyotish applications.

```typescript
import {
  getSunrise, getSunset,
  getMoonrise, getMoonset,
  getSiderealSunLongitude, getSiderealMoonLongitude,
  getAyanamsa,
  computeRahuKalam, computeGulikaKalam, computeYamaganda,
  computeAbhijitMuhurta, computeBrahmaMuhurta,
  computeGowriPanchangam,
  // Jyotish
  computePlanetaryPositions,
  computeVimshottariDasha, computeVimshottariDashaFromBirth,
  computeChandraBalam,
  GRAHA_ABBR,
} from 'panchang-ts';

// Sunrise/sunset
const sunrise = getSunrise(localMidnightUtc, { latitude: 28.6, longitude: 77.2 });
const sunset  = getSunset(sunrise, { latitude: 28.6, longitude: 77.2 });

// Moonrise/moonset — return null when the Moon doesn't rise/set that day
const moonrise = getMoonrise(localMidnightUtc, { latitude: 28.6, longitude: 77.2 });
const moonset  = getMoonset(localMidnightUtc, { latitude: 28.6, longitude: 77.2 });

// Sidereal longitudes
const moonLon = getSiderealMoonLongitude(new Date(), 'lahiri'); // degrees [0, 360)
const sunLon  = getSiderealSunLongitude(new Date(), 'lahiri');

// Ayanamsa
const ayan = getAyanamsa(new Date(), 'lahiri');  // e.g. 24.10

// Inauspicious periods (varaIndex: 0=Sun ... 6=Sat)
const rahu   = computeRahuKalam(sunrise, sunset, varaIndex);   // { start, end }
const gulika = computeGulikaKalam(sunrise, sunset, varaIndex);
const yama   = computeYamaganda(sunrise, sunset, varaIndex);

// Muhurta
const abhijit = computeAbhijitMuhurta(sunrise, sunset);    // { start, end }
const brahma  = computeBrahmaMuhurta(sunrise, sunset);     // { start, end }
```

**Jyotish (Vedic Astrology):**

```typescript
// All 9 graha positions (sidereal — Rahu/Ketu use mean node)
const grahas = computePlanetaryPositions(birthDate, 'lahiri');
console.log(grahas.jupiter.rashi.name);   // "Dhanu"
console.log(grahas.saturn.isRetrograde);  // true/false
console.log(GRAHA_ABBR['Jupiter']);       // "Ju"

// Vimshottari Dasha — convenience form: birth date only (Moon longitude derived)
const dasha = computeVimshottariDashaFromBirth(birthDate, 'lahiri');
console.log(dasha.currentMahaDashaLord);                   // "Rahu"
console.log(dasha.mahaDashas[0]!.antarDashas[0]!.lord);    // "Rahu"

// Or pass an explicit Moon sidereal longitude (useful when you already have one)
const moonLon = getSiderealMoonLongitude(birthDate, 'lahiri');
const dasha2  = computeVimshottariDasha(birthDate, moonLon);

// Chandra Balam — transit Moon's favorability vs. janma rashi
// janmaRashi and transitMoonRashi are 0-indexed (0 = Mesha ... 11 = Meena)
const cb = computeChandraBalam(3 /* Karka */, 6 /* Tula */);
console.log(cb.house);        // 4
console.log(cb.quality);      // "weak"
console.log(cb.englishName);  // "Ashubha"
```

---

## Types

<details>
<summary><strong>Core Types</strong> — GeoLocation, TimePeriod</summary>

```typescript
interface GeoLocation {
  latitude: number;    // -90 to 90
  longitude: number;   // -180 to 180
  elevation?: number;  // metres, default 0
}

interface TimePeriod {
  start: Date;
  end: Date;
}
```
</details>

<details>
<summary><strong>Pancha Anga</strong> — TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo</summary>

```typescript
interface TithiInfo {
  index: number;               // 0-29
  name: string;                // e.g. "Shukla Pratipada"
  paksha: string;              // "Shukla"/"Krishna" (en), "शुक्ल"/"कृष्ण" (sa/hi)
  number: number;              // 1-15 within the paksha
  completionPercentage: number;
  endTime: Date | null;
}

interface NakshatraInfo {
  index: number;               // 0-26
  name: string;
  pada: number;                // 1-4
  degreesInNakshatra: number;
  completionPercentage: number;
  endTime: Date | null;
}

interface DailyTithiInfo extends TithiInfo {
  startTime: Date | null;      // null when isActiveAtSunrise is true
  isActiveAtSunrise: boolean;  // true = present at sunrise; false = started mid-day
}

// DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo follow the same pattern

interface VaraInfo {
  index: number;       // 0 = Sunday ... 6 = Saturday
  name: string;        // e.g. "Ravivara" (localized)
  shortName: string;   // e.g. "Ravi" (localized)
  englishName: string; // e.g. "Sunday" (always English)
}

interface KaranaInfo {
  index: number;
  name: string;
  completionPercentage: number;
  endTime: Date | null;
  type: 'fixed' | 'movable';
}

// Note: endTime and startTime are null when computeEndTimes: false.
```
</details>

<details>
<summary><strong>Lunar Calendar</strong> — ChandraMasaInfo, SamvatInfo, MasaInfo</summary>

```typescript
interface ChandraMasaInfo {
  index: number;            // 0 = Chaitra ... 11 = Phalguna (in the active system)
  name: string;             // follows masaSystem option
  isAdhika: boolean;        // true = leap/intercalary month
  system: 'purnimanta' | 'amanta';
  amantaIndex: number;      // month index in Amanta system
  amantaName: string;       // month name in Amanta system
  purnimantaIndex: number;  // month index in Purnimanta system
  purnimantaName: string;   // month name in Purnimanta system
}

interface SamvatInfo {
  vikramSamvat: number;  // e.g. 2081
  shakaSamvat: number;   // e.g. 1946
}

interface MasaInfo {
  index: number;  // 0 = Mesha ... 11 = Meena (solar month)
  name: string;
}

interface RashiInfo {
  index: number;  // 0 = Mesha ... 11 = Meena
  name: string;
}
```
</details>

<details>
<summary><strong>Time Slots</strong> — Choghadiya, Gowri Panchangam, Hora</summary>

```typescript
type ChoghadiyaQuality = 'auspicious' | 'inauspicious' | 'neutral';

interface ChoghadiyaSlot extends TimePeriod {
  index: number;
  name: string;              // e.g. "Amrit", "Kaal" (localized)
  quality: ChoghadiyaQuality;
  qualityName: string;       // localized: "Auspicious", "शुभ", "शुभम्"
}

interface ChoghadiyaInfo {
  day: ChoghadiyaSlot[];    // 8 slots (sunrise -> sunset)
  night: ChoghadiyaSlot[];  // 8 slots (sunset -> next sunrise)
}

interface GowriSlot extends TimePeriod {
  index: number;              // 0-7 within the 8-name cycle
  name: string;               // e.g. "Amrit", "Kaal" (localized)
  quality: ChoghadiyaQuality;
  qualityName: string;
}

interface GowriInfo {
  day: GowriSlot[];    // 8 slots (sunrise -> sunset)
  night: GowriSlot[];  // 8 slots (sunset -> next sunrise)
}

interface HoraSlot extends TimePeriod {
  planet: string;       // e.g. "Sun", "Venus", "Mercury"
  planetIndex: number;  // 0-6 in Chaldean order
}

interface HoraInfo {
  day: HoraSlot[];    // 12 slots (sunrise -> sunset)
  night: HoraSlot[];  // 12 slots (sunset -> next sunrise)
}
```
</details>

<details>
<summary><strong>Special Yogas & Festivals</strong></summary>

```typescript
interface SpecialYogaInfo {
  name: string;    // e.g. "Guru Pushya Yoga"
  type: 'amrit_siddhi' | 'sarvartha_siddhi' | 'ravi_pushya' | 'guru_pushya';
}

interface FestivalInfo {
  name: string;         // e.g. "Diwali", "Ekadashi"
  type: 'major' | 'minor' | 'ekadashi' | 'pradosha' | 'sankranti';
  description?: string; // For sankranti: localized rashi name
}
```
</details>

<details>
<summary><strong>Jyotish (Vedic Astrology)</strong> — Graha positions, Vimshottari Dasha</summary>

```typescript
type GrahaName = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter'
               | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu';

interface GrahaPosition {
  planet: GrahaName;
  siderealLongitude: number;   // degrees [0, 360)
  rashi: RashiInfo;            // zodiac sign
  degreeInRashi: number;       // degrees within sign [0, 30)
  nakshatra: NakshatraInfo;    // nakshatra + pada + completion %
  isRetrograde: boolean;       // always false for Sun/Moon; always true for Rahu/Ketu
}

interface PlanetaryPositions {
  sun: GrahaPosition; moon: GrahaPosition; mars: GrahaPosition;
  mercury: GrahaPosition; jupiter: GrahaPosition; venus: GrahaPosition;
  saturn: GrahaPosition; rahu: GrahaPosition; ketu: GrahaPosition;
}

type DashaLord = 'Ketu' | 'Venus' | 'Sun' | 'Moon' | 'Mars'
              | 'Rahu' | 'Jupiter' | 'Saturn' | 'Mercury';

interface AntarDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
}

interface MahaDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  years: number;
  antarDashas: AntarDasha[];
}

interface VimshottariDashaResult {
  currentMahaDashaLord: DashaLord;
  currentIndex: number;
  mahaDashas: MahaDasha[];  // 9-entry sequence starting from birth
}

interface ChandraBalamInfo {
  house: number;                       // 1 = janma rashi; 12 = rashi before janma
  quality: 'strong' | 'weak';          // Shubha houses = 1,3,6,7,10,11
  englishName: string;                 // "Shubha" | "Ashubha"
  name: string;                        // localized
}
```
</details>

---

## React Native / Hermes

Works with Expo and bare React Native (Hermes engine). Pass `timezone` as a **number**
— IANA timezone strings (`'Asia/Kolkata'`) require `Intl`, which older Hermes versions
don't fully support.

**Two-pass rendering** for smooth UI:

```typescript
import { getDailyPanchang } from 'panchang-ts';
import { InteractionManager } from 'react-native';

// Pass 1 — instant, names only (~0.1 ms on Node, <100 ms on Hermes)
const fast = getDailyPanchang(date, location, {
  timezone: 330,
  computeEndTimes: false,
});
setState(fast); // show names immediately

// Pass 2 — background, full with end-times (~0.5 ms on Node, <500 ms on Hermes)
InteractionManager.runAfterInteractions(() => {
  const full = getDailyPanchang(date, location, { timezone: 330 });
  setState(full); // update with transition times
});
```

---

## Accuracy

4,848 tests passing, including Drik-verified fixtures against
[DrikPanchang.com](https://www.drikpanchang.com) spanning 2025–2026 across
Delhi, Chennai, and New York.

| Element | Accuracy | Validation |
|---------|----------|------------|
| Sunrise / Sunset | ±2 min vs Drik | Strict fixtures |
| Moonrise / Moonset | ±2 min vs Drik | Strict fixtures |
| Tithi, Nakshatra, Yoga, Karana names | Exact match vs Drik | Strict fixtures |
| Tithi / Nakshatra / Yoga / Karana end-times | **±3 min tolerance, max 2.01 min observed** | 20 assertions |
| Ayanamsa | ±0.005° vs Swiss Ephemeris | Unit tests |
| Planetary positions (Sun–Saturn) | **±0.02° vs Drik sidereal** | Drik fixtures |
| Planetary positions (Rahu/Ketu, mean node) | ≤0.5° typical; ±2° tolerance to absorb mean-vs-true drift | Drik fixtures |
| Rashi / Nakshatra / Retrograde flag | Exact match vs Drik | Drik fixtures |
| Festival dates | 12 Drik-verified festivals (2025–2026) — see caveats below | Drik fixtures |
| Choghadiya / Hora / Gowri slots | Derived from sunrise/sunset — inherits ±2 min | — |

### Festival Detection — Documented Tradeoff

Library uses **tithi-at-sunrise** to resolve a festival to a calendar day.
DrikPanchang applies several other traditional rules depending on the
festival; where those rules pick a different day, our output can drift
±1 day vs Drik. This is a rule-choice tradeoff, not a computation bug —
it is documented and deliberately surfaced rather than hidden.

| Resolution rule Drik uses | Festivals affected |
|---------------------------|--------------------|
| Tithi-at-midnight | Krishna Janmashtami, Maha Shivaratri, Diwali / Lakshmi Puja |
| Madhyahna-vyapini (tithi overlapping noon) | Ganesh Chaturthi on edge years, Akshaya Tritiya 2026 |
| Kshaya-tithi handling (tithi never at sunrise) | Ugadi 2026-03-19 (Pratipad is Kshaya) |

If exact Drik parity matters for your use case, cross-check the above
festival set against the Drik site for the target year. Everything else
— Holi, Ugadi (non-Kshaya years), Rama Navami, Raksha Bandhan, Ganesh
Chaturthi (normal years), Navaratri, Dussehra, Karva Chauth, Hanuman
Jayanti — matches Drik's canonical date across 2025 and 2026 fixtures.

---

## Performance

| Mode | Node.js | Hermes (budget Android) |
|------|---------|------------------------|
| Names-only (`computeEndTimes: false`) | ~0.1 ms | <100 ms |
| Full with end-times | ~0.5 ms | <500 ms |

---

## Error Handling

```typescript
import { PanchangError } from 'panchang-ts';

try {
  getDailyPanchang(date, location, options);
} catch (e) {
  if (e instanceof PanchangError) {
    console.error(e.code);    // e.g. 'INVALID_LATITUDE', 'NO_SUNRISE'
    console.error(e.message);
  }
}
```

Error codes: `INVALID_DATE`, `INVALID_LATITUDE`, `INVALID_LONGITUDE`,
`INVALID_ELEVATION`, `INVALID_TIMEZONE`, `INVALID_AYANAMSA`, `TIMEZONE_RESOLUTION_FAILED`,
`NO_SUNRISE`, `NO_SUNSET`, `SEARCH_DIVERGED`.

`getMoonrise` / `getMoonset` return `null` instead of throwing when no rise/set
occurs (normal for the Moon).

---

## Compatibility

| Environment | Support |
|-------------|---------|
| Node.js 18+ | Supported |
| React Native (Hermes) | Supported (pass `timezone` as number) |
| Expo (managed + bare) | Supported |
| Browser (modern) | Supported (ESM build) |
| Browser (legacy / IE) | Not supported |

---

## Used By

- [dharmagya.app](https://dharmagya.app) — Daily Panchang and Hindu calendar

## Acknowledgements

[astronomy-engine](https://github.com/cosinekitty/astronomy) by Don Cross — the sole runtime dependency. MIT licensed.

## License

MIT
