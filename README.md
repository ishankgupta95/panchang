# panchang-ts

Pure TypeScript Hindu Panchang (almanac) calculations. Zero native dependencies.
Works offline in React Native (Hermes), Node.js, and browsers.

## Features

- **10 Panchang elements:** Tithi, Nakshatra, Yoga, Karana, Vara, Sunrise/Sunset,
  Rahu Kalam, Gulika Kalam, Yamaganda, Abhijit Muhurta
- **Daily mode:** Full sunrise-to-sunrise day with all element transitions
  (e.g. two Tithis if a transition happens mid-day)
- **Instant mode:** Element active at an exact moment (birth charts, muhurta selection)
- **3 ayanamsa systems:** Lahiri (default), B.V. Raman, KP (Krishnamurti)
- **3 languages:** English, Sanskrit (Devanagari), Hindi
- **React Native compatible:** Pure JS math, no native modules, tested on Hermes
- **Fast:** ~0.1 ms names-only on Node.js; &lt;100 ms on budget Android (Hermes)
- **Typed:** Full TypeScript types for every result and option

## Install

```bash
npm install panchang-ts
```

## Quick Start

```typescript
import { getDailyPanchang } from 'panchang-ts';

const result = getDailyPanchang(
  new Date(2025, 0, 14),                      // January 14, 2025
  { latitude: 18.5204, longitude: 73.8567 },  // Pune, India
  { timezone: 330 },                          // IST = UTC+5:30 = 330 minutes
);

console.log(result.tithis[0].name);           // "Krishna Chaturdashi"
console.log(result.nakshatras[0].name);       // "Mrigashira"
console.log(result.vara.name);                // "Mangalavara"
console.log(result.rahuKalam);                // { start: Date, end: Date }
console.log(result.sunrise);                  // Date (read via getUTC*)
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
| `ayanamsa` | `number` | Ayanamsa in degrees at sunrise |
| `siderealSunAtSunrise` | `number` | Sun sidereal longitude at sunrise (°) |
| `siderealMoonAtSunrise` | `number` | Moon sidereal longitude at sunrise (°) |
| `masa` | `MasaInfo` | Solar month (Saura Masa) |

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

console.log(result.tithi.name);     // "कृष्ण चतुर्दशी"
console.log(result.nakshatra.name); // "मृगशिरा"
console.log(result.tithi.endTime);  // Date when this Tithi ends
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
| `language` | `'en' \| 'sa' \| 'hi'` | `'en'` | Language for element names |
| `computeEndTimes` | `boolean` | `true` | Set `false` for ~5× faster, names-only output |
| `precision` | `'standard' \| 'high'` | `'standard'` | Binary-search iterations (15 vs 25). High precision is rarely needed. |

**`InstantPanchangOptions`** (optional for `getInstantPanchang`): same as above but without `timezone`.

---

### Low-level Utilities

These are exported for advanced use cases (building your own ayanamsa tools,
visualisations, or debugging).

```typescript
import {
  getSunrise, getSunset,
  getSiderealSunLongitude, getSiderealMoonLongitude,
  getAyanamsa,
  computeRahuKalam, computeGulikaKalam, computeYamaganda,
  computeAbhijitMuhurta,
} from 'panchang-ts';

// Sunrise/sunset
const sunrise = getSunrise(localMidnightUtc, { latitude: 28.6, longitude: 77.2 });
const sunset  = getSunset(sunrise, { latitude: 28.6, longitude: 77.2 });

// Sidereal longitudes
const moonLon = getSiderealMoonLongitude(new Date(), 'lahiri'); // degrees [0, 360)
const sunLon  = getSiderealSunLongitude(new Date(), 'lahiri');

// Ayanamsa
const ayan = getAyanamsa(new Date(), 'lahiri');  // e.g. 24.10

// Inauspicious periods (varaIndex: 0=Sun … 6=Sat)
const rahu = computeRahuKalam(sunrise, sunset, varaIndex);
// { start: Date, end: Date }
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
  startTime: Date | null;      // null if active at sunrise
  isActiveAtSunrise: boolean;
}

// DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo follow the same pattern
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
| Names-only (`computeEndTimes: false`) | ~0.1 ms | &lt;100 ms |
| Full with end-times | ~0.5 ms | &lt;500 ms |

Measured with Vitest benchmarks on Node 22 and on a physical budget Android device
via the dharmSetu React Native app.

---

## Accuracy

Validated against [DrikPanchang.com](https://www.drikpanchang.com) for 15+ date/city combinations.

| Element | Accuracy |
|---------|----------|
| Sunrise / Sunset | ±2 minutes |
| Tithi, Nakshatra, Yoga, Karana names | Exact match |
| Element end-times | ±5 minutes |
| Ayanamsa | ±0.005° vs Swiss Ephemeris |

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
`INVALID_TIMEZONE`, `INVALID_AYANAMSA`, `NO_SUNRISE`, `NO_SUNSET`.

---

## License

MIT
