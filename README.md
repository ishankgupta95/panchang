# panchang-ts

Pure TypeScript Hindu Panchang (almanac) calculations. Zero native dependencies.
Works offline in React Native (Hermes), Node.js, and browsers.

## Features

- **Pancha Anga (5 limbs):** Tithi, Nakshatra, Yoga, Karana, Vara — with mid-day transition times
- **Lunar calendar:** Chandra Masa (lunar month + Adhika/leap detection), Vikram Samvat, Shaka Samvat
- **Zodiac & asterism:** Chandra Rashi (Moon sign), Surya Nakshatra (Sun's asterism)
- **Muhurta:** Brahma Muhurta, Abhijit Muhurta
- **Inauspicious periods:** Rahu Kalam, Gulika Kalam, Yamaganda
- **Choghadiya:** 16 time slots (8 day + 8 night), each named and rated auspicious/neutral/inauspicious
- **Gowri Panchangam:** 16 Gowri Nalla Neram slots (8 day + 8 night) with 8-name cycle, vara-based starting index
- **Hora:** 24 planetary hours per day (12 day + 12 night) in Chaldean order
- **Astronomical events:** Sunrise, Sunset, Moonrise, Moonset
- **Panchaka detection:** Flag when Moon is in the last 5 nakshatras (Dhanishta 3rd pada → Revati)
- **Special Yogas:** Amrit Siddhi, Sarvartha Siddhi, Ravi Pushya, Guru Pushya — detected from Vara × Tithi/Nakshatra tables
- **Dur Muhurta:** Two ~48-minute inauspicious windows per day, position varies by Vara
- **Festival detection:** 24 major pan-Indian festivals, recurring Ekadashi & Pradosha Vrata, Sankranti; skips Adhika (leap) months automatically
- **Daily mode:** Full sunrise-to-sunrise day with all element transitions
- **Instant mode:** Elements active at an exact moment (birth charts, muhurta selection)
- **3 ayanamsa systems:** Lahiri (default), B.V. Raman, KP (Krishnamurti)
- **3 languages:** English, Sanskrit (Devanagari), Hindi
- **React Native compatible:** Pure JS math, no native modules, tested on Hermes
- **Fast:** ~0.1 ms names-only on Node.js; <100 ms on budget Android (Hermes)
- **Typed:** Full TypeScript types for every result and option

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
  { latitude: 18.5204, longitude: 73.8567 },  // Pune, India
  { timezone: 330 },                          // IST = UTC+5:30 = 330 minutes
);

// Pancha Anga
console.log(result.tithis[0].name);           // "Krishna Chaturdashi"
console.log(result.nakshatras[0].name);       // "Mrigashira"
console.log(result.vara.name);                // "Mangalavara"

// Lunar calendar
console.log(result.chandramasa.name);         // "Pausha"
console.log(result.samvat.vikramSamvat);      // 2081
console.log(result.samvat.shakaSamvat);       // 1946

// Zodiac
console.log(result.chandraRashi.name);        // "Mithuna" (Moon in Gemini)
console.log(result.suryaNakshatra.name);      // "Uttara Ashadha"

// Astronomical events
console.log(result.sunrise);                  // Date (read via getUTC*)
console.log(result.moonrise);                 // Date | null

// Muhurta
console.log(result.brahmaMuhurta);            // { start: Date, end: Date }
console.log(result.rahuKalam);                // { start: Date, end: Date }

// Choghadiya — 8 daytime slots
result.choghadiya.day.forEach(slot => {
  console.log(slot.name, slot.quality);       // "Amrit", "auspicious"
});

// Panchaka
console.log(result.panchaka);                 // true | false

// Special Yogas active today
result.specialYogas.forEach(yoga => {
  console.log(yoga.name, yoga.type);          // "Guru Pushya Yoga", "guru_pushya"
});

// Dur Muhurta — two inauspicious windows
const [dm1, dm2] = result.durMuhurta;
console.log(fmt(dm1.start), '-', fmt(dm1.end)); // e.g. "11:36 - 12:24"
console.log(fmt(dm2.start), '-', fmt(dm2.end));

// Festivals today
result.festivals.forEach(f => {
  console.log(f.name, f.type);               // "Diwali", "major"
});

// Gowri Panchangam — 8 daytime slots
result.gowriPanchangam.day.forEach(slot => {
  console.log(slot.name, slot.quality);       // "Amrit", "auspicious"
});


```

## Reading Output Times

All `Date` objects in the result are **offset-adjusted** to the requested timezone.
**Always read time components via `getUTC*` methods:**

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
| `tithis` | `DailyTithiInfo[]` | Tithis active during the day (usually 1–2) |
| `nakshatras` | `DailyNakshatraInfo[]` | Nakshatras active during the day |
| `yogas` | `DailyYogaInfo[]` | Yogas active during the day |
| `karanas` | `DailyKaranaInfo[]` | Karanas active during the day (usually 2–4) |
| `vara` | `VaraInfo` | Weekday (Vara) |
| `rahuKalam` | `TimePeriod` | Rahu Kalam start/end |
| `gulikaKalam` | `TimePeriod` | Gulika Kalam start/end |
| `yamaganda` | `TimePeriod` | Yamaganda start/end |
| `abhijitMuhurta` | `TimePeriod` | Abhijit Muhurta start/end |
| `brahmaMuhurta` | `TimePeriod` | Brahma Muhurta — two muhurtas (dayDuration/30 each) before sunrise; ends one muhurta before sunrise (≈ 48–24 min window for typical 12-h days) |
| `masa` | `MasaInfo` | Solar month (Saura Masa) |
| `chandramasa` | `ChandraMasaInfo` | Lunar month + Adhika (leap) flag |
| `samvat` | `SamvatInfo` | Vikram Samvat and Shaka Samvat year numbers |
| `chandraRashi` | `RashiInfo` | Moon's zodiac sign (changes every ~2.5 days) |
| `suryaNakshatra` | `RashiInfo` | Sun's nakshatra (changes every ~13–14 days) |
| `choghadiya` | `ChoghadiyaInfo` | 8 day slots + 8 night slots, each named and rated |
| `gowriPanchangam` | `GowriInfo` | 8 day + 8 night Gowri Nalla Neram slots, each named and rated |

| `hora` | `HoraInfo` | 12 day horas + 12 night horas, each with ruling planet |
| `moonrise` | `Date \| null` | Moonrise (offset-adjusted); `null` if none that day |
| `moonset` | `Date \| null` | Moonset (offset-adjusted); `null` if none that day |
| `panchaka` | `boolean` | `true` when Moon is in last 5 nakshatras |
| `specialYogas` | `SpecialYogaInfo[]` | Auspicious yogas active today (may be empty) |
| `durMuhurta` | `[TimePeriod, TimePeriod]` | Two inauspicious ~48-min windows |
| `festivals` | `FestivalInfo[]` | Festivals / observances today (may be empty) |
| `ayanamsa` | `number` | Ayanamsa in degrees at sunrise |
| `siderealSunAtSunrise` | `number` | Sun sidereal longitude at sunrise (°) |
| `siderealMoonAtSunrise` | `number` | Moon sidereal longitude at sunrise (°) |

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
console.log(result.chandramasa.name);        // "पौष"
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
| `specialYogas` | `SpecialYogaInfo[]` | Auspicious yogas at this moment (may be empty) |
| `festivals` | `FestivalInfo[]` | Festivals / observances at this moment (may be empty) |
| `ayanamsa` | `number` | Ayanamsa in degrees |
| `siderealSun` | `number` | Sun sidereal longitude (°) |
| `siderealMoon` | `number` | Moon sidereal longitude (°) |

---

### Options

**`PanchangOptions`** (required for `getDailyPanchang`):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timezone` | `number \| string` | **required** | UTC offset in minutes (330 for IST). Use a number on Hermes — IANA strings require `Intl`. |
| `ayanamsa` | `'lahiri' \| 'raman' \| 'krishnamurti'` | `'lahiri'` | Ayanamsa system |
| `language` | `'en' \| 'sa' \| 'hi'` | `'en'` | Language for element names. `'hi'` currently uses the same Devanagari names as `'sa'`. |
| `computeEndTimes` | `boolean` | `true` | Set `false` for ~5× faster, names-only output |
| `precision` | `'standard' \| 'high'` | `'standard'` | Binary-search iterations (15 vs 25). High precision is rarely needed. |

**`InstantPanchangOptions`** (optional for `getInstantPanchang`): same as above but without `timezone`.

---

### Low-level Utilities

These are exported for advanced use cases (building your own tools, visualisations, or debugging).

```typescript
import {
  getSunrise, getSunset,
  getMoonrise, getMoonset,
  getSiderealSunLongitude, getSiderealMoonLongitude,
  getAyanamsa,
  computeRahuKalam, computeGulikaKalam, computeYamaganda,
  computeAbhijitMuhurta, computeBrahmaMuhurta,
  computeGowriPanchangam,
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

// Inauspicious periods (varaIndex: 0=Sun … 6=Sat)
const rahu  = computeRahuKalam(sunrise, sunset, varaIndex);   // { start, end }
const gulika = computeGulikaKalam(sunrise, sunset, varaIndex);
const yama  = computeYamaganda(sunrise, sunset, varaIndex);

// Muhurta
const abhijit    = computeAbhijitMuhurta(sunrise, sunset);    // { start, end }
const brahma     = computeBrahmaMuhurta(sunrise, sunset);     // { start, end }


// Gowri Panchangam (varaIndex: 0=Sun … 6=Sat)
const gowri = computeGowriPanchangam(sunrise, sunset, nextSunrise, varaIndex,
  (i) => ['Udyog','Amrit','Roga','Laabh','Shubh','Kaal','Dhan','Chal'][i]!,
);
// gowri.day  → 8 GowriSlot (sunrise → sunset)
// gowri.night → 8 GowriSlot (sunset → next sunrise)
```

---

### Types

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

// ── Pancha Anga ──────────────────────────────────────────────────────────────

interface TithiInfo {
  index: number;               // 0–29
  name: string;                // e.g. "Shukla Pratipada"
  paksha: 'Shukla' | 'Krishna';
  number: number;              // 1–15 within the paksha
  completionPercentage: number;
  endTime: Date | null;
}

interface NakshatraInfo {
  index: number;               // 0–26
  name: string;
  pada: number;                // 1–4
  degreesInNakshatra: number;
  completionPercentage: number;
  endTime: Date | null;
}

interface DailyTithiInfo extends TithiInfo {
  startTime: Date | null;      // null when isActiveAtSunrise is true (element was already active at sunrise)
  isActiveAtSunrise: boolean;  // true → this element was present at sunrise; false → it started mid-day (startTime is set)
}

// DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo follow the same pattern

// Note: endTime and startTime are null on ALL daily elements when computeEndTimes: false.
// completionPercentage: 0 = just started, 100 = about to end (computed at sunrise moment).

// ── Lunar calendar ───────────────────────────────────────────────────────────

interface ChandraMasaInfo {
  index: number;          // 0 = Chaitra … 11 = Phalguna (Amanta / South-Indian)
  name: string;           // e.g. "Pausha" (Amanta name)
  isAdhika: boolean;      // true = leap/intercalary month
  purnimantaIndex: number; // Month index in Purnimanta (North-Indian) system
  purnimantaName: string;  // Month name in Purnimanta system
}

interface SamvatInfo {
  vikramSamvat: number;  // e.g. 2081
  shakaSamvat: number;   // e.g. 1946
}

// ── Zodiac & asterism ────────────────────────────────────────────────────────

interface RashiInfo {
  index: number;  // 0 = Mesha … 11 = Meena (for rashi); 0–26 for nakshatra
  name: string;
}

// chandraRashi and suryaNakshatra both use RashiInfo

interface VaraInfo {
  index: number;       // 0 = Sunday … 6 = Saturday
  name: string;        // e.g. "Ravivara" (localized full name)
  shortName: string;   // e.g. "Ravi" (localized short form, Sanskrit by default)
  englishName: string; // e.g. "Sunday" (always English, locale-independent)
}

interface MasaInfo {
  index: number;  // 0 = Mesha … 11 = Meena (solar month)
  name: string;   // e.g. "Dhanu"
}

interface KaranaInfo {
  index: number;
  name: string;
  completionPercentage: number;
  endTime: Date | null;
  type: 'fixed' | 'movable';
}

// ── Choghadiya ───────────────────────────────────────────────────────────────

type ChoghadiyaQuality = 'auspicious' | 'inauspicious' | 'neutral';

interface ChoghadiyaSlot extends TimePeriod {
  index: number;
  name: string;           // e.g. "Amrit", "Kaal", "Shubh"
  quality: ChoghadiyaQuality;
}

interface ChoghadiyaInfo {
  day: ChoghadiyaSlot[];    // 8 slots (sunrise → sunset)
  night: ChoghadiyaSlot[];  // 8 slots (sunset → next sunrise)
}

// ── Gowri Panchangam ─────────────────────────────────────────────────────────

interface GowriSlot extends TimePeriod {
  index: number;           // 0–7 within the 8-name cycle
  name: string;            // e.g. "Amrit", "Kaal", "Shubh"
  quality: ChoghadiyaQuality;
}

interface GowriInfo {
  day: GowriSlot[];    // 8 slots (sunrise → sunset)
  night: GowriSlot[];  // 8 slots (sunset → next sunrise)
}

// ── Hora ─────────────────────────────────────────────────────────────────────

interface HoraSlot extends TimePeriod {
  planet: string;       // Chaldean order: "Sun"(0), "Venus"(1), "Mercury"(2), "Moon"(3), "Saturn"(4), "Jupiter"(5), "Mars"(6)
  planetIndex: number;  // 0–6 — index into the Chaldean sequence above
}

interface HoraInfo {
  day: HoraSlot[];    // 12 slots (sunrise → sunset)
  night: HoraSlot[];  // 12 slots (sunset → next sunrise)
}

// ── Special Yogas ────────────────────────────────────────────────────────────

interface SpecialYogaInfo {
  name: string;    // e.g. "Guru Pushya Yoga"
  type: 'amrit_siddhi' | 'sarvartha_siddhi' | 'ravi_pushya' | 'guru_pushya';
}

// ── Festivals ────────────────────────────────────────────────────────────────

interface FestivalInfo {
  name: string;         // e.g. "Diwali", "Ekadashi"
  type: 'major' | 'minor' | 'ekadashi' | 'pradosha' | 'sankranti';
  description?: string; // For sankranti: "Rashi 3" — the numeric rashi index as a string; look up name from masaNames
}

// Detection rules:
//   Ekadashi:  both Shukla (tithi 10) and Krishna (tithi 25) pakshas
//   Pradosha:  Krishna Trayodashi only (tithi 27)
//   Sankranti: Sun within 1° past a rashi boundary (degInRashi < 1.0)
//   Fixed festivals (e.g. Diwali): matched by chandramasa index + tithi index; skipped during Adhika months
```

---

## React Native / Hermes Usage

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

## Performance

| Mode | Node.js | Hermes (budget Android) |
|------|---------|------------------------|
| Names-only (`computeEndTimes: false`) | ~0.1 ms | <100 ms |
| Full with end-times | ~0.5 ms | <500 ms |

Measured with Vitest benchmarks on Node 22 and on a physical budget Android device
via the dharmSetu React Native app.

---

## Accuracy

Validated against [DrikPanchang.com](https://www.drikpanchang.com) for 19+ date/city combinations (Pune, Delhi, Chennai, Mumbai, Bangalore, New York).

| Element | Accuracy |
|---------|----------|
| Sunrise / Sunset | ±2 minutes |
| Moonrise / Moonset | ±2 minutes |
| Tithi, Nakshatra, Yoga, Karana names | Exact match |
| Element end-times | ±5 minutes |
| Ayanamsa | ±0.005° vs Swiss Ephemeris |
| Choghadiya / Hora / Gowri slots | Derived from sunrise/sunset — inherits ±2 min |

### Validation test suite

The test suite includes:
- **242-day structural regression** (Pune, Sep 2025 – Apr 2026): verifies no crash, correct Vara, time-ordering invariants, element counts, and all fields (including Gowri Panchangam) for every day in the window
- **19 precise-value tests** across 5 Indian cities + New York: exact Tithi name, Nakshatra name, sunrise/sunset HH:MM (±2 min tolerance), Chandra Masa name
- **10 long-range regression tests** (2030–2050): structural correctness and ayanamsa bounds for future dates

To generate fixture stubs for new date ranges (e.g. to populate against DrikPanchang):

```bash
npx tsx scripts/generate-fixtures.ts --start 2027-01-01 --end 2027-03-31 --city Delhi
```

---

## Compatibility

| Environment | Support |
|-------------|---------|
| Node.js 18+ | ✅ |
| Node.js 20+ | ✅ |
| Node.js 22+ | ✅ |
| React Native (Hermes) | ✅ (pass `timezone` as number) |
| Expo (managed + bare) | ✅ |
| Browser (modern) | ✅ (ESM build) |
| Browser (legacy / IE) | ✗ |

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

`PanchangErrorCode` values: `INVALID_DATE`, `INVALID_LATITUDE`, `INVALID_LONGITUDE`,
`INVALID_ELEVATION`, `INVALID_TIMEZONE`, `INVALID_AYANAMSA`, `TIMEZONE_RESOLUTION_FAILED`,
`NO_SUNRISE`, `NO_SUNSET`, `SEARCH_DIVERGED`.

Note: `getMoonrise` / `getMoonset` never throw — they return `null` when no rise/set
occurs within the search window (this is normal for the Moon).

---

## Acknowledgements

- **[astronomy-engine](https://github.com/cosinekitty/astronomy)** by Don Cross — the sole runtime dependency. Provides the astronomical algorithms used for sunrise/sunset, moonrise/moonset, and planetary longitude calculations. MIT licensed.

---

## License

MIT
