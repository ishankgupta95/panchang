# panchang-ts

[![npm version](https://img.shields.io/npm/v/panchang-ts)](https://www.npmjs.com/package/panchang-ts)

Pure TypeScript Hindu Panchang (almanac) calculations. Zero native dependencies.
Works offline in React Native (Hermes), Node.js, and browsers.

**Fast** (~0.1 ms names-only, ~0.5 ms full) | **Typed** (full TypeScript types) | **Offline** (pure JS math, no network)

---

## Install

```bash
npm install panchang-ts
```

## Quick Start

```typescript
import { getDailyPanchang } from 'panchang-ts';

const result = getDailyPanchang(
  new Date(2025, 0, 14),                      // January 14, 2025
  { latitude: 23.1765, longitude: 75.7885 },  // Ujjain, India
  { timezone: 330 },                          // IST = UTC+5:30 = 330 min
);

console.log(result.tithis[0].name);       // "Krishna Chaturdashi"
console.log(result.nakshatras[0].name);   // "Mrigashira"
console.log(result.vara.name);            // "Mangalavara"
console.log(result.chandramasa.name);     // "Magha"
console.log(result.sunrise);              // Date object (read via getUTC*)
console.log(result.rahuKalam);            // { start: Date, end: Date }
console.log(result.festivals);            // [{ name: "Makar Sankranti", type: "major" }]
```

> **Reading times:** All `Date` objects are offset-adjusted. Always use `getUTCHours()` / `getUTCMinutes()` — not `getHours()` — to read local time components.

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
All 9 graha positions (geocentric, sidereal) with rashi, nakshatra, pada, and retrograde status. Vimshottari Dasha with Antardasha breakdown.

### Astronomy
Sunrise, Sunset, Moonrise, Moonset, Chandra Rashi (Moon sign), Surya Nakshatra.

### Localization
3 languages: **English**, **Sanskrit** (Devanagari), **Hindi**. All returned display strings respect the `language` option.

### Configuration
3 ayanamsa systems (Lahiri, B.V. Raman, KP), 2 masa systems (Purnimanta, Amanta), adjustable precision, optional fast mode (`computeEndTimes: false` for ~5x speedup).

---

## API

### `getDailyPanchang(date, location, options)`

Full Hindu day from sunrise to next sunrise with all element transitions.

```typescript
const result = getDailyPanchang(
  date,      // Date — any moment within the local calendar day
  location,  // { latitude, longitude, elevation? }
  options,   // { timezone, ayanamsa?, language?, masaSystem?, ... }
);
```

Returns `DailyPanchangResult` containing: `sunrise`, `sunset`, `nextSunrise`, `tithis[]`, `nakshatras[]`, `yogas[]`, `karanas[]`, `vara`, `chandramasa`, `samvat`, `masa`, `chandraRashi`, `suryaNakshatra`, `rahuKalam`, `gulikaKalam`, `yamaganda`, `abhijitMuhurta`, `brahmaMuhurta`, `choghadiya`, `gowriPanchangam`, `hora`, `moonrise`, `moonset`, `panchaka`, `specialYogas[]`, `durMuhurta`, `festivals[]`, `ayanamsa`, `siderealSunAtSunrise`, `siderealMoonAtSunrise`.

All fields are fully typed — explore via your IDE's autocomplete.

### `getInstantPanchang(date, location, options?)`

Single Panchang snapshot at an exact UTC moment (for birth charts, muhurta selection).

```typescript
const result = getInstantPanchang(
  new Date('2025-01-14T03:00:00Z'),           // UTC moment
  { latitude: 18.5204, longitude: 73.8567 },
  { language: 'sa' },                          // optional
);

console.log(result.tithi.name);       // "कृष्ण चतुर्दशी"
console.log(result.nakshatra.name);   // "मृगशिरा"
console.log(result.chandramasa.name); // "माघ"
```

Returns `InstantPanchangResult` — same elements as daily but single values instead of arrays. No `timezone` required.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timezone` | `number \| string` | **required** | UTC offset in minutes (e.g. 330 for IST). Use a number on Hermes. |
| `ayanamsa` | `'lahiri' \| 'raman' \| 'krishnamurti'` | `'lahiri'` | Ayanamsa system |
| `language` | `'en' \| 'sa' \| 'hi'` | `'en'` | Language for all returned names |
| `masaSystem` | `'purnimanta' \| 'amanta'` | `'purnimanta'` | Lunar month naming convention |
| `computeEndTimes` | `boolean` | `true` | Set `false` for ~5x faster, names-only output |
| `precision` | `'standard' \| 'high'` | `'standard'` | Binary-search iterations (15 vs 25) |

`InstantPanchangOptions` is the same but without `timezone`.

---

## Low-level Utilities

Exported for advanced use cases — building custom tools, visualizations, or Jyotish applications.

```typescript
import {
  // Astronomy
  getSunrise, getSunset, getMoonrise, getMoonset,
  getSiderealSunLongitude, getSiderealMoonLongitude, getAyanamsa,
  // Muhurta & periods
  computeRahuKalam, computeGulikaKalam, computeYamaganda,
  computeAbhijitMuhurta, computeBrahmaMuhurta, computeGowriPanchangam,
  // Jyotish
  computePlanetaryPositions, computeVimshottariDasha, GRAHA_ABBR,
} from 'panchang-ts';
```

**Jyotish example:**

```typescript
// All 9 graha positions (sidereal)
const grahas = computePlanetaryPositions(birthDate, 'lahiri');
console.log(grahas.jupiter.rashi.name);   // "Dhanu"
console.log(grahas.saturn.isRetrograde);  // true/false

// Vimshottari Dasha from birth
const moonLon = getSiderealMoonLongitude(birthDate, 'lahiri');
const dasha = computeVimshottariDasha(birthDate, moonLon);
console.log(dasha.currentMahaDashaLord);  // "Rahu"
```

---

## React Native / Hermes

Works with Expo and bare React Native. Pass `timezone` as a **number** — IANA strings require `Intl`, which older Hermes versions don't fully support.

**Two-pass rendering** for smooth UI:

```typescript
// Pass 1 — instant names (~0.1 ms Node, <100 ms Hermes)
const fast = getDailyPanchang(date, location, {
  timezone: 330,
  computeEndTimes: false,
});
setState(fast);

// Pass 2 — full with transition times
InteractionManager.runAfterInteractions(() => {
  const full = getDailyPanchang(date, location, { timezone: 330 });
  setState(full);
});
```

---

## Accuracy

Validated against [DrikPanchang.com](https://www.drikpanchang.com) for 19+ date/city combinations across India and New York.

| Element | Accuracy |
|---------|----------|
| Sunrise / Sunset | ±2 minutes |
| Moonrise / Moonset | ±2 minutes |
| Tithi, Nakshatra, Yoga, Karana names | Exact match |
| Element end-times | ±5 minutes |
| Ayanamsa | ±0.005° vs Swiss Ephemeris |

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

Error codes: `INVALID_DATE`, `INVALID_LATITUDE`, `INVALID_LONGITUDE`, `INVALID_ELEVATION`, `INVALID_TIMEZONE`, `INVALID_AYANAMSA`, `TIMEZONE_RESOLUTION_FAILED`, `NO_SUNRISE`, `NO_SUNSET`, `SEARCH_DIVERGED`.

`getMoonrise` / `getMoonset` return `null` instead of throwing when no rise/set occurs (normal for the Moon).

---

## Compatibility

Node.js 18+ | React Native (Hermes) | Expo | Modern browsers (ESM)

---

## Used By

- [dharmagya.app](https://dharmagya.app) — Daily Panchang and Hindu calendar

## Acknowledgements

[astronomy-engine](https://github.com/cosinekitty/astronomy) by Don Cross — the sole runtime dependency. MIT licensed.

## License

MIT
