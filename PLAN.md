# panchang-ts — Final Implementation Plan

> Pure TypeScript Hindu Panchang calculation library.
> Zero native deps · Offline-first · React Native (Hermes) / Node / Browser
>
> This is the definitive build document. Every file, function, type, formula,
> test, config, and deployment step needed to ship a production-quality package.

---

## Table of Contents

1. [Package Folder Structure](#1-package-folder-structure)
2. [Timezone Architecture](#2-timezone-architecture)
3. [Daily vs Instant Mode](#3-daily-vs-instant-mode)
4. [Complete TypeScript Types](#4-complete-typescript-types)
5. [Astronomy Layer](#5-astronomy-layer)
6. [Ayanamsa — Full Polynomials](#6-ayanamsa--full-polynomials)
7. [Panchang Elements — Formulas & Implementation](#7-panchang-elements--formulas--implementation)
8. [Binary Search for Transitions](#8-binary-search-for-transitions)
9. [Performance — Longitude Cache](#9-performance--longitude-cache)
10. [Inauspicious Periods & Muhurta](#10-inauspicious-periods--muhurta)
11. [Internationalization (i18n)](#11-internationalization-i18n)
12. [Error Handling & Validation](#12-error-handling--validation)
13. [Orchestrator — getDailyPanchang / getInstantPanchang](#13-orchestrator)
14. [Public API Surface](#14-public-api-surface)
15. [Build Setup — Dual ESM/CJS](#15-build-setup)
16. [Testing Strategy](#16-testing-strategy)
17. [Hermes Compatibility & CI](#17-hermes-compatibility--ci)
18. [Performance Budgets & Profiling](#18-performance-budgets--profiling)
19. [npm Release Checklist](#19-npm-release-checklist)
20. [Local Development with dharmSetu](#20-local-development-with-dharmsetu)
21. [dharmSetu Integration — Two-Pass Rendering](#21-dharmsetu-integration--two-pass-rendering)
22. [Constants & Reference Data](#22-constants--reference-data)
23. [Implementation Phases & Timeline](#23-implementation-phases--timeline)
24. [README Template](#24-readme-template)

---

## 1. Package Folder Structure

```
panchang-ts/
├── src/
│   ├── index.ts                      # Public API barrel export
│   │
│   ├── core/
│   │   ├── panchang.ts               # getDailyPanchang() + getInstantPanchang()
│   │   ├── tithi.ts                  # Tithi calculation + end-time finder
│   │   ├── nakshatra.ts              # Nakshatra calculation + end-time finder
│   │   ├── yoga.ts                   # Yoga calculation + end-time finder
│   │   ├── karana.ts                 # Karana calculation + end-time finder
│   │   ├── vara.ts                   # Vara (weekday) — sunrise-aware
│   │   ├── muhurta.ts                # Abhijit Muhurta
│   │   ├── inauspicious.ts           # Rahu Kalam, Gulika Kalam, Yamaganda
│   │   └── masa.ts                   # Solar month (Saura Masa)
│   │
│   ├── astronomy/
│   │   ├── sun.ts                    # Sidereal Sun longitude
│   │   ├── moon.ts                   # Sidereal Moon longitude
│   │   ├── sunrise.ts                # Sunrise/sunset via astronomy-engine
│   │   ├── ayanamsa.ts              # Lahiri/Raman/KP polynomials
│   │   └── cache.ts                  # Time-bucketed longitude memoization
│   │
│   ├── types/
│   │   ├── panchang.ts               # DailyPanchangResult, InstantPanchangResult
│   │   ├── elements.ts               # TithiInfo, NakshatraInfo, YogaInfo, etc.
│   │   ├── location.ts               # GeoLocation
│   │   ├── options.ts                # PanchangOptions, InstantPanchangOptions
│   │   ├── errors.ts                 # PanchangError, PanchangErrorCode
│   │   └── index.ts                  # Re-export all types
│   │
│   ├── i18n/
│   │   ├── en.ts                     # English transliteration
│   │   ├── sa.ts                     # Sanskrit (Devanagari)
│   │   ├── hi.ts                     # Hindi
│   │   ├── resolver.ts              # Name resolution from index + language
│   │   └── types.ts                  # PanchangTranslations shape
│   │
│   └── utils/
│       ├── angle.ts                  # normalize360, degToRad, radToDeg
│       ├── search.ts                 # Generic binary search for transitions
│       ├── timezone.ts               # UTC offset resolution, local midnight
│       ├── validation.ts             # Input guards (lat, lng, date, offset)
│       ├── constants.ts              # Span values, slot tables
│       └── perf.ts                   # Timing utility (dev-only)
│
├── tests/
│   ├── unit/
│   │   ├── angle.test.ts
│   │   ├── timezone.test.ts
│   │   ├── validation.test.ts
│   │   ├── search.test.ts
│   │   ├── cache.test.ts
│   │   ├── ayanamsa.test.ts
│   │   ├── sunrise.test.ts
│   │   ├── sun-moon.test.ts
│   │   ├── tithi.test.ts
│   │   ├── nakshatra.test.ts
│   │   ├── yoga.test.ts
│   │   ├── karana.test.ts
│   │   ├── vara.test.ts
│   │   ├── muhurta.test.ts
│   │   ├── inauspicious.test.ts
│   │   └── i18n.test.ts
│   ├── integration/
│   │   ├── daily-panchang.test.ts
│   │   ├── instant-panchang.test.ts
│   │   ├── multi-element.test.ts
│   │   ├── western-cities.test.ts    # London, NYC — negative offsets
│   │   └── edge-cases.test.ts        # Polar, midnight, year boundary
│   ├── perf/
│   │   └── benchmark.bench.ts        # Performance regression tests (vitest bench)
│   └── fixtures/
│       ├── drikpanchang-india.json   # 15+ Indian city/date combos
│       ├── drikpanchang-world.json   # 5+ non-Indian city combos
│       └── ayanamsa-reference.json   # Swiss Ephemeris cross-check values
│
├── scripts/
│   ├── hermes-check.sh               # Hermes bytecode compilation test
│   └── collect-fixtures.md           # Instructions for gathering DrikPanchang data
│
├── tsup.config.ts
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── package.json
├── .changeset/
│   └── config.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── .eslintrc.cjs
├── .gitignore
├── .npmignore
├── LICENSE                            # MIT
├── README.md
└── CONTRIBUTING.md
```

---

## 2. Timezone Architecture

### 2.1 Problem

JS `Date` is always UTC internally. `new Date('2025-01-14')` = midnight UTC, not midnight IST.
Computing sunrise for "January 14 in Pune" requires knowing that the local day starts at
2025-01-13T18:30:00Z (midnight IST). Every time-based output (sunrise, end-times, Rahu Kalam)
must be expressed in the user's local timezone.

### 2.2 Design Decisions

- **Primary interface: `utcOffsetMinutes: number`** (330 for IST, -300 for EST)
- **Optional: IANA string** (`'Asia/Kolkata'`) — works in Node/browsers via Intl, fails on Hermes
  with a clear error message telling the developer to use the numeric form
- **All internal computation is UTC.** Timezone applies only at two boundaries: input (find local
  midnight) and output (adjust result dates for display)
- **No timezone library dependency.** No luxon, no date-fns-tz, no moment-timezone
- **DST is the caller's problem.** Indian timezones don't have DST. For non-Indian consumers, the
  caller must pass the correct offset for the date in question

### 2.3 Full Implementation

```typescript
// src/utils/timezone.ts

import { PanchangError } from '../types/errors';

/**
 * Resolve a timezone value to UTC offset in minutes.
 *
 * Accepts:
 *   - number: used directly (e.g. 330 for IST +05:30, -300 for EST -05:00)
 *   - string: IANA timezone name, resolved via Intl (Node/browser only, NOT Hermes)
 *
 * @throws PanchangError with code TIMEZONE_RESOLUTION_FAILED if IANA string
 *         can't be resolved (e.g. on Hermes)
 */
export function resolveUtcOffset(timezone: number | string, referenceDate: Date): number {
  if (typeof timezone === 'number') {
    validateOffset(timezone);
    return timezone;
  }

  // Attempt Intl-based resolution
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(referenceDate);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (!tzPart) throw new Error('No timeZoneName part found');
    return parseGmtOffset(tzPart.value);
  } catch {
    throw new PanchangError(
      `Cannot resolve timezone "${timezone}". ` +
        `On React Native (Hermes), pass a numeric UTC offset in minutes instead ` +
        `(e.g. 330 for IST +05:30, -300 for EST -05:00).`,
      'TIMEZONE_RESOLUTION_FAILED'
    );
  }
}

/**
 * Get the UTC instant representing local midnight for a given calendar date.
 *
 * We extract year/month/day from the Date as-is (treating them as local calendar
 * components), construct midnight UTC for that date, then shift back by the offset.
 *
 * Example: date components = Jan 14, offsetMinutes = 330 (IST)
 *   Local midnight Jan 14 IST = Jan 14 00:00:00 +05:30 = Jan 13 18:30:00 UTC
 */
export function getLocalMidnightUtc(date: Date, offsetMinutes: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const midnightUtc = Date.UTC(y, m, d, 0, 0, 0, 0);
  return new Date(midnightUtc - offsetMinutes * 60_000);
}

/**
 * Shift a UTC Date by the given offset so that getUTCHours/getUTCMinutes
 * on the result return local time components.
 *
 * This is the display conversion. The returned Date is NOT a "real" UTC date —
 * it's a trick so consumers can read local time via getUTC* methods without
 * needing Intl or any timezone library.
 *
 * dharmSetu reads: result.getUTCHours() + ':' + result.getUTCMinutes()
 */
export function utcToLocalDisplay(utcDate: Date, offsetMinutes: number): Date {
  return new Date(utcDate.getTime() + offsetMinutes * 60_000);
}

/**
 * Parse "GMT+5:30" or "GMT-5" into offset minutes.
 */
function parseGmtOffset(gmtString: string): number {
  if (gmtString === 'GMT') return 0;
  const match = gmtString.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2]!, 10);
  const mins = parseInt(match[3] ?? '0', 10);
  return sign * (hours * 60 + mins);
}

function validateOffset(offset: number): void {
  // Valid UTC offsets: -720 (UTC-12) to +840 (UTC+14)
  if (offset < -720 || offset > 840 || !Number.isInteger(offset)) {
    throw new PanchangError(
      `UTC offset must be an integer between -720 and 840, got ${offset}`,
      'INVALID_TIMEZONE'
    );
  }
}
```

### 2.4 Data Flow

```
User calls: getDailyPanchang(new Date(2025, 0, 14), location, { timezone: 330 })

Step 1: resolveUtcOffset(330, date) → 330
Step 2: getLocalMidnightUtc(date, 330) → 2025-01-13T18:30:00.000Z
Step 3: computeSunrise(midnight_utc, location) → 2025-01-14T01:34:00.000Z (sunrise in UTC)
Step 4: All element computations use raw UTC dates internally
Step 5: Before returning, convert all Date fields:
          result.sunrise = utcToLocalDisplay(sunriseUtc, 330)
          → Date where .getUTCHours()=7, .getUTCMinutes()=4  (IST 07:04)

Consumer reads: result.sunrise.getUTCHours()   → 7
                result.sunrise.getUTCMinutes() → 4
```

### 2.5 Important: Output Date Contract

Document this clearly in README and JSDoc:

> **All `Date` objects in `DailyPanchangResult` are offset-adjusted for display.**
> Read local time components using `.getUTCHours()`, `.getUTCMinutes()`, `.getUTCSeconds()`.
> Do NOT use `.getHours()` — that uses the system timezone, which may differ from the
> Panchang location's timezone.
>
> `InstantPanchangResult` returns raw UTC dates (no offset applied) since the caller
> already knows the exact moment they queried.

---

## 3. Daily vs Instant Mode

### 3.1 Why Two Modes

| | Daily Mode | Instant Mode |
|---|---|---|
| **Use case** | "Show today's Panchang" in app | Birth chart, muhurta check at exact time |
| **Time scope** | Sunrise to next sunrise | Single moment |
| **Elements** | Arrays (1-2 Tithis, 1-3 Karanas) | Single per category |
| **Timezone** | Required (defines "today") | Not needed (input is UTC instant) |
| **Sunrise** | Computed and returned | Not computed (unless caller asks) |
| **Cost** | Heavier (sunrise + transitions) | Lighter (just longitudes at one instant) |

### 3.2 Multi-Element Logic

A Tithi spans 12° of Moon-Sun separation. The Moon moves ~12–15° per day, so a Tithi lasts
~19–26 hours. Between one sunrise and the next (~24h), **1 or 2 Tithis** can be active.

Similarly for Nakshatra (13.33°, ~21–28 hours) and Yoga (13.33°, ~21–28 hours).

Karana is half a Tithi (6°, ~9.5–13 hours), so **up to 3 Karanas** can appear in one day.

DrikPanchang shows all of these with their transition times. Our daily mode must do the same.

**Algorithm: Walk from sunrise to next sunrise, collecting transitions**

```
function findDailyElements(sunrise, nextSunrise, getIndexFn, searchWindowHours):
  results = []
  cursor = sunrise

  while cursor < nextSunrise:
    element = computeAtInstant(cursor)
    endTime = findTransitionTime(cursor, cursor + searchWindow, element.index, getIndexFn)

    results.push({ ...element, startTime: cursor, endTime, isActiveAtSunrise: results.length === 0 })

    if endTime >= nextSunrise: break
    cursor = endTime + 1 minute (epsilon past the boundary)

    safety: if results.length > maxExpected: break

  return results
```

Max expected per element:
- Tithi: 2 (break at 3)
- Nakshatra: 2 (break at 3)
- Yoga: 2 (break at 3)
- Karana: 3 (break at 5)

### 3.3 findDailyElements — TypeScript Signature

This function lives in `src/utils/search.ts`. It is generic over the element info type.

```typescript
// src/utils/search.ts (addition)

import type { Language } from '../types/options';

/**
 * Walk from sunrise to nextSunrise, collecting all element transitions.
 *
 * @param sunriseUtc      Day start (UTC)
 * @param nextSunriseUtc  Day end (UTC)
 * @param elementAtSunrise The pre-computed element at sunrise
 * @param getIndexAtTime  Callback: returns element index at a UTC instant
 * @param resolveName     i18n resolver for element names
 * @param lang            Language for names
 * @param totalElements   Cycle size (30 for Tithi, 27 for Nakshatra/Yoga, 60 for Karana)
 * @param searchWindowHours Forward search window per element (36 for Tithi/Nakshatra/Yoga, 18 for Karana)
 * @param maxIterations   Binary search iterations
 * @param maxPerDay       Safety cap (2 for Tithi/Nakshatra/Yoga, 4 for Karana)
 */
export function findDailyElements<T extends { index: number; endTime: Date | null }>(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  elementAtSunrise: T,
  getIndexAtTime: (date: Date) => number,
  resolveName: (index: number, lang: Language) => string,
  lang: Language,
  totalElements: number,
  searchWindowHours: number,
  maxIterations: number,
  maxPerDay: number,
): Array<T & { startTime: Date | null; isActiveAtSunrise: boolean }> {
  // Implementation: see Section 3.2 pseudocode.
  // cursor starts at sunriseUtc.
  // For each iteration:
  //   1. Compute element at cursor (already have it for first iteration)
  //   2. findTransitionTime(cursor, cursor + searchWindowHours, element.index, getIndexAtTime, maxIterations)
  //   3. Clamp endTime: if endTime > nextSunriseUtc, use nextSunriseUtc
  //   4. Compute startTime via findStartTime for first element (its start may be before sunrise)
  //   5. Push {element, startTime, endTime, isActiveAtSunrise: results.length === 0}
  //   6. If endTime >= nextSunriseUtc: break
  //   7. cursor = endTime + 1ms. Compute new element. Safety break at maxPerDay.
}
```

---

## 4. Complete TypeScript Types

```typescript
// ═══════════════════════════════════════════════════════
// src/types/location.ts
// ═══════════════════════════════════════════════════════

export interface GeoLocation {
  /** Latitude in decimal degrees. Range: -90 to 90. */
  latitude: number;
  /** Longitude in decimal degrees. Range: -180 to 180. */
  longitude: number;
  /** Elevation in meters above sea level. Default: 0. */
  elevation?: number;
}


// ═══════════════════════════════════════════════════════
// src/types/options.ts
// ═══════════════════════════════════════════════════════

export type AyanamsaType = 'lahiri' | 'raman' | 'krishnamurti';
export type Language = 'en' | 'sa' | 'hi';
export type Precision = 'standard' | 'high';

export interface PanchangOptions {
  /**
   * UTC offset in minutes (e.g. 330 for IST, -300 for EST).
   * Or IANA timezone string ('Asia/Kolkata') — Node/browser only, NOT Hermes.
   */
  timezone: number | string;

  /** Ayanamsa system. Default: 'lahiri'. */
  ayanamsa?: AyanamsaType;

  /** Language for element names. Default: 'en'. */
  language?: Language;

  /**
   * Whether to compute end-times for each element via binary search.
   * Default: true.
   * Set false for ~5x faster computation (names + completion only).
   */
  computeEndTimes?: boolean;

  /**
   * Precision of binary search.
   * 'standard': 15 iterations, ±1.2 min precision. Good for display.
   * 'high': 25 iterations, ±0.04s precision. For jyotish/muhurta calculations.
   * Default: 'standard'.
   */
  precision?: Precision;
}

export interface InstantPanchangOptions {
  ayanamsa?: AyanamsaType;
  language?: Language;
  computeEndTimes?: boolean;
  precision?: Precision;
}


// ═══════════════════════════════════════════════════════
// src/types/elements.ts
// ═══════════════════════════════════════════════════════

export interface TimePeriod {
  start: Date;
  end: Date;
}

// ── Shared base ───────────────────────────────────────

interface ElementBase {
  /** Element index in its cycle. */
  index: number;
  /** Localized name (depends on language option). */
  name: string;
  /** How far through this element we are. 0–100. */
  completionPercentage: number;
  /** When this element ends. null if computeEndTimes is false. */
  endTime: Date | null;
}

// ── Per-element types ─────────────────────────────────

export interface TithiInfo extends ElementBase {
  /** 0–29. 0=Shukla Pratipad, 14=Purnima, 29=Amavasya. */
  index: number;
  /** Waxing (Shukla) or waning (Krishna) phase. */
  paksha: 'Shukla' | 'Krishna';
  /** 1–15 within the current paksha. */
  number: number;
}

export interface NakshatraInfo extends ElementBase {
  /** 0–26. 0=Ashwini, 26=Revati. */
  index: number;
  /** Quarter within the Nakshatra. 1–4. */
  pada: number;
  /** Degrees of sidereal Moon within this Nakshatra. 0–13.333. */
  degreesInNakshatra: number;
}

export interface YogaInfo extends ElementBase {
  /** 0–26. 0=Vishkamba, 26=Vaidhriti. */
  index: number;
}

export interface KaranaInfo extends ElementBase {
  /** 0–59. */
  index: number;
  /** Fixed (Kimstughna, Shakuni, Chatushpada, Naga) or movable. */
  type: 'fixed' | 'movable';
}

export interface VaraInfo {
  /** 0–6. 0=Sunday, 6=Saturday. */
  index: number;
  /** Localized Sanskrit/Hindi name. e.g. "Somavara" or "सोमवार". */
  name: string;
  /** Short form. e.g. "Soma" or "सोम". */
  shortName: string;
  /** Always English. e.g. "Monday". */
  englishName: string;
}

// ── Daily mode wrappers (with transition info) ────────

interface DailyElementBase {
  /** When this element became active (may be before today's sunrise). */
  startTime: Date | null;       // null if computeEndTimes is false
  /** True if this element is the one active at sunrise. */
  isActiveAtSunrise: boolean;
}

export interface DailyTithiInfo extends TithiInfo, DailyElementBase {}
export interface DailyNakshatraInfo extends NakshatraInfo, DailyElementBase {}
export interface DailyYogaInfo extends YogaInfo, DailyElementBase {}
export interface DailyKaranaInfo extends KaranaInfo, DailyElementBase {}


// ═══════════════════════════════════════════════════════
// src/types/panchang.ts
// ═══════════════════════════════════════════════════════

import type { GeoLocation } from './location';
import type {
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo,
  TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo, TimePeriod,
} from './elements';

export interface DailyPanchangResult {
  /** The local calendar date this Panchang is for. */
  date: Date;
  location: GeoLocation;
  /** UTC offset in minutes that was used for this computation. */
  timezone: number;

  /** Sunrise (offset-adjusted for display — read via getUTC* methods). */
  sunrise: Date;
  /** Sunset (offset-adjusted). */
  sunset: Date;
  /** Next day's sunrise (offset-adjusted). Defines the day boundary. */
  nextSunrise: Date;
  /** Day duration in minutes (sunset - sunrise). */
  dayDurationMinutes: number;
  /** Night duration in minutes (nextSunrise - sunset). */
  nightDurationMinutes: number;

  /** Tithis active during this day. Length 1 or 2. */
  tithis: DailyTithiInfo[];
  /** Nakshatras active during this day. Length 1 or 2. */
  nakshatras: DailyNakshatraInfo[];
  /** Yogas active during this day. Length 1 or 2. */
  yogas: DailyYogaInfo[];
  /** Karanas active during this day. Length 1 to 3. */
  karanas: DailyKaranaInfo[];
  /** Hindu weekday (based on sunrise, not midnight). */
  vara: VaraInfo;

  /** Rahu Kalam period (inauspicious). */
  rahuKalam: TimePeriod;
  /** Gulika Kalam period (inauspicious). */
  gulikaKalam: TimePeriod;
  /** Yamaganda period (inauspicious). */
  yamaganda: TimePeriod;
  /** Abhijit Muhurta — auspicious midday period. */
  abhijitMuhurta: TimePeriod;

  /** Ayanamsa value used (degrees). For debugging/advanced use. */
  ayanamsa: number;
  /** Sidereal Sun longitude at sunrise (degrees). */
  siderealSunAtSunrise: number;
  /** Sidereal Moon longitude at sunrise (degrees). */
  siderealMoonAtSunrise: number;

  /** Hindu month (Masa) derived from Sun's sidereal position. */
  masa: MasaInfo;

  /**
   * Computation timing in milliseconds (only in development builds).
   * Undefined in production.
   */
  _debug?: {
    totalMs: number;
    sunriseMs: number;
    elementsMs: number;
    endTimesMs: number;
  };
}

export interface InstantPanchangResult {
  /** The exact UTC moment this was computed for. */
  timestamp: Date;
  location: GeoLocation;

  tithi: TithiInfo;
  nakshatra: NakshatraInfo;
  yoga: YogaInfo;
  karana: KaranaInfo;
  vara: VaraInfo;

  ayanamsa: number;
  siderealSun: number;
  siderealMoon: number;
}

export interface MasaInfo {
  /** 0–11 index. 0=Mesha (Chaitra/Vaishakha region). */
  index: number;
  /** Localized name. e.g. "Pausha" or "पौष". */
  name: string;
}


// ═══════════════════════════════════════════════════════
// src/types/errors.ts
// ═══════════════════════════════════════════════════════

export type PanchangErrorCode =
  | 'INVALID_LATITUDE'
  | 'INVALID_LONGITUDE'
  | 'INVALID_ELEVATION'
  | 'INVALID_DATE'
  | 'INVALID_TIMEZONE'
  | 'INVALID_AYANAMSA'
  | 'TIMEZONE_RESOLUTION_FAILED'
  | 'NO_SUNRISE'
  | 'NO_SUNSET'
  | 'SEARCH_DIVERGED';

export class PanchangError extends Error {
  public readonly code: PanchangErrorCode;

  constructor(message: string, code: PanchangErrorCode) {
    super(message);
    this.name = 'PanchangError';
    this.code = code;
    Object.setPrototypeOf(this, PanchangError.prototype);
  }
}


// ═══════════════════════════════════════════════════════
// src/types/index.ts — re-exports
// ═══════════════════════════════════════════════════════

export type * from './location';
export type * from './options';
export type * from './elements';
export type * from './panchang';
export { PanchangError } from './errors';
export type { PanchangErrorCode } from './errors';
```

---

## 5. Astronomy Layer

### 5.1 astronomy-engine — Exact API Calls

These are the **precise** function signatures from `astronomy-engine` that we use.
No other APIs from that package are needed.

```typescript
// What we import from astronomy-engine:
import {
  Body,                    // Enum: Body.Sun, Body.Moon
  EclipticLongitude,       // (body: Body, time: AstroTime) => number (degrees, 0–360)
  MakeTime,                // (date: Date) => AstroTime
  SearchRiseSet,           // (body, observer, direction, startTime, limitDays) => AstroTime | null
  Observer,                // class: new Observer(lat, lon, elevation)
} from 'astronomy-engine';

// That's it — 5 imports. The rest of astronomy-engine is unused.
```

### 5.2 Sun Longitude

```typescript
// src/astronomy/sun.ts

import { Body, EclipticLongitude, MakeTime } from 'astronomy-engine';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

/**
 * Sidereal longitude of the Sun at a given UTC instant.
 * Returns degrees in range [0, 360).
 */
export function getSiderealSunLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  const astroTime = MakeTime(date);
  const tropicalLon = EclipticLongitude(Body.Sun, astroTime);
  const ayanamsa = computeAyanamsa(date, ayanamsaType);
  return normalize360(tropicalLon - ayanamsa);
}

/**
 * Tropical longitude of the Sun (no ayanamsa applied).
 * Exposed for consumers who want to apply their own ayanamsa.
 */
export function getTropicalSunLongitude(date: Date): number {
  return EclipticLongitude(Body.Sun, MakeTime(date));
}
```

### 5.3 Moon Longitude

```typescript
// src/astronomy/moon.ts

import { Body, EclipticLongitude, MakeTime } from 'astronomy-engine';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

/**
 * Sidereal longitude of the Moon at a given UTC instant.
 * Returns degrees in range [0, 360).
 */
export function getSiderealMoonLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  const astroTime = MakeTime(date);
  const tropicalLon = EclipticLongitude(Body.Moon, astroTime);
  const ayanamsa = computeAyanamsa(date, ayanamsaType);
  return normalize360(tropicalLon - ayanamsa);
}

export function getTropicalMoonLongitude(date: Date): number {
  return EclipticLongitude(Body.Moon, MakeTime(date));
}
```

### 5.4 Sunrise / Sunset

```typescript
// src/astronomy/sunrise.ts

import { Body, SearchRiseSet, MakeTime, Observer } from 'astronomy-engine';
import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';

/**
 * Compute sunrise nearest to (and after) the given UTC search start.
 *
 * @param searchFromUtc  Start searching from this UTC instant.
 *                       For daily mode, this is local midnight converted to UTC.
 * @param location       Observer coordinates.
 * @param limitDays      How far ahead to search. Default 2 (handles polar edge cases).
 * @returns              Sunrise as a UTC Date.
 * @throws PanchangError (NO_SUNRISE) for polar regions with no sunrise.
 */
export function computeSunrise(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2
): Date {
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0
  );
  const astroTime = MakeTime(searchFromUtc);
  const result = SearchRiseSet(Body.Sun, observer, +1, astroTime, limitDays);

  if (!result) {
    throw new PanchangError(
      `No sunrise found within ${limitDays} days for ` +
        `(${location.latitude}°, ${location.longitude}°) near ${searchFromUtc.toISOString()}. ` +
        `This location may be experiencing midnight sun or polar night.`,
      'NO_SUNRISE'
    );
  }

  return result.date;
}

/**
 * Compute sunset nearest to (and after) the given UTC search start.
 */
export function computeSunset(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2
): Date {
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0
  );
  const astroTime = MakeTime(searchFromUtc);
  const result = SearchRiseSet(Body.Sun, observer, -1, astroTime, limitDays);

  if (!result) {
    throw new PanchangError(
      `No sunset found within ${limitDays} days for ` +
        `(${location.latitude}°, ${location.longitude}°) near ${searchFromUtc.toISOString()}.`,
      'NO_SUNSET'
    );
  }

  return result.date;
}
```

---

## 6. Ayanamsa — Full Polynomials

### 6.1 Why Not Linear

The linear approximation `23.85 + 0.01397 × (year − 2000)` accumulates ~5 arc-minutes of error
over 50 years. DrikPanchang uses the full Newcomb precession model. To match them within the
±0.005° tolerance we need, we must use the polynomial.

### 6.2 Implementation

```typescript
// src/astronomy/ayanamsa.ts

import { PanchangError } from '../types/errors';
import type { AyanamsaType } from '../types/options';

/**
 * Compute ayanamsa (tropical-to-sidereal correction) in decimal degrees.
 *
 * @param date  UTC Date
 * @param type  Ayanamsa system. Default: 'lahiri'.
 * @returns     Ayanamsa in degrees.
 */
export function computeAyanamsa(date: Date, type: AyanamsaType = 'lahiri'): number {
  const T = julianCenturiesFromJ2000(date);

  switch (type) {
    case 'lahiri':
      return lahiriAyanamsa(T);
    case 'raman':
      return ramanAyanamsa(T);
    case 'krishnamurti':
      return kpAyanamsa(T);
    default:
      throw new PanchangError(`Unknown ayanamsa type: ${type}`, 'INVALID_AYANAMSA');
  }
}

/**
 * Lahiri ayanamsa.
 *
 * Based on the Indian government standard: Spica (Chitra) is fixed at
 * 180°00'00" sidereal longitude. This yields a reference ayanamsa of
 * approximately 23°51'11.56" (23.853211°) at the J2000.0 epoch.
 *
 * Precession is modeled using Newcomb's formula:
 *   ψ(T) = 5029.0966"·T + 1.1120"·T² − 0.000006"·T³
 * where T is Julian centuries from J2000.0.
 *
 * The ayanamsa at any date = reference + precession since J2000.
 *
 * Accuracy: ±2 arc-seconds for dates 1900–2100.
 */
function lahiriAyanamsa(T: number): number {
  const REF_J2000_DEG = 23.853211; // 23°51'11.56"

  // Newcomb precession since J2000.0 (in arcseconds)
  const precessionArcsec =
    5029.0966 * T +
    1.112 * T * T -
    0.000006 * T * T * T;

  return REF_J2000_DEG + precessionArcsec / 3600;
}

/**
 * B.V. Raman ayanamsa.
 * Reference at J2000.0: 22°27'37.76" (22.460489°).
 * Annual precession: 50.3304"/year.
 */
function ramanAyanamsa(T: number): number {
  const REF_J2000_DEG = 22.460489;
  const annualRateDeg = 50.3304 / 3600;
  return REF_J2000_DEG + annualRateDeg * T * 100; // T is centuries → ×100 for years
}

/**
 * Krishnamurti Paddhati (KP) ayanamsa.
 * Reference at J2000.0: 23°46'24.98" (23.773606°).
 * Uses same Newcomb precession as Lahiri, different epoch anchor.
 */
function kpAyanamsa(T: number): number {
  const REF_J2000_DEG = 23.773606;
  const precessionArcsec =
    5029.0966 * T +
    1.112 * T * T -
    0.000006 * T * T * T;
  return REF_J2000_DEG + precessionArcsec / 3600;
}

/**
 * Julian centuries from J2000.0 epoch (2000 Jan 1.5 TT).
 */
function julianCenturiesFromJ2000(date: Date): number {
  const JD_J2000 = 2451545.0;
  const jd = dateToJulianDay(date);
  return (jd - JD_J2000) / 36525.0;
}

/**
 * Convert JS Date to Julian Day Number.
 * Standard formula: JD = Unix_ms / 86400000 + 2440587.5
 */
export function dateToJulianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}
```

### 6.3 Validation Targets

| Date | Lahiri (expected) | Source |
|------|-------------------|--------|
| 2000-01-01 12:00 UTC | 23.853° | Definition (J2000 reference) |
| 2025-01-01 | ~24.205° | Swiss Ephemeris / Jagannatha Hora |
| 1950-01-01 | ~23.155° | Indian Astronomical Ephemeris |
| 2050-01-01 | ~24.904° | Projected |

---

## 7. Panchang Elements — Formulas & Implementation

### 7.1 Angle Utilities

```typescript
// src/utils/angle.ts

/** Normalize angle to [0, 360). */
export function normalize360(degrees: number): number {
  const r = degrees % 360;
  return r < 0 ? r + 360 : r;
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}
```

### 7.2 Tithi

```typescript
// src/core/tithi.ts

import { normalize360 } from '../utils/angle';
import { TITHI_SPAN } from '../utils/constants';
import type { TithiInfo } from '../types/elements';

/**
 * Compute the Tithi at a given instant from pre-computed sidereal longitudes.
 *
 * Formula:
 *   tithiAngle = normalize360(moonLon - sunLon)
 *   tithiIndex = floor(tithiAngle / 12)
 *
 * A Tithi is 12° of Moon-Sun elongation. There are 30 Tithis in a lunar month.
 *   Indices 0–14  = Shukla Paksha (Pratipad to Purnima)
 *   Indices 15–29 = Krishna Paksha (Pratipad to Amavasya)
 */
export function computeTithiFromLongitudes(
  siderealMoon: number,
  siderealSun: number,
  name: string,  // pre-resolved from i18n
): TithiInfo {
  const angle = normalize360(siderealMoon - siderealSun);
  const index = Math.floor(angle / TITHI_SPAN);

  const elapsed = angle - index * TITHI_SPAN;
  const completionPercentage = (elapsed / TITHI_SPAN) * 100;

  const paksha = index < 15 ? 'Shukla' : 'Krishna';
  const number = index < 15 ? index + 1 : index - 14;
  // Special: Purnima (14) → number 15 in Shukla, Amavasya (29) → number 15 in Krishna

  return {
    index,
    name,
    paksha: paksha as 'Shukla' | 'Krishna',
    number,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    endTime: null, // Filled in by the orchestrator if computeEndTimes is true
  };
}

/**
 * Get the Tithi index at a given UTC instant.
 * Used as the callback for binary search.
 */
export function getTithiIndexAtTime(
  date: Date,
  getCachedMoon: (d: Date) => number,
  getCachedSun: (d: Date) => number,
): number {
  const moonLon = getCachedMoon(date);
  const sunLon = getCachedSun(date);
  const angle = normalize360(moonLon - sunLon);
  return Math.floor(angle / TITHI_SPAN);
}

/** Direct longitude → index (no Date needed). Used by the orchestrator at sunrise. */
export function getTithiIndexFromLons(siderealMoon: number, siderealSun: number): number {
  return Math.floor(normalize360(siderealMoon - siderealSun) / TITHI_SPAN);
}
```

### 7.3 Nakshatra

```typescript
// src/core/nakshatra.ts

import { normalize360 } from '../utils/angle';
import { NAKSHATRA_SPAN, NAKSHATRA_PADA_SPAN } from '../utils/constants';
import type { NakshatraInfo } from '../types/elements';

/**
 * Nakshatra = sidereal Moon position divided into 27 equal parts of 13°20'.
 *
 * Formula:
 *   nakshatraIndex = floor(siderealMoon / 13.3333)
 *   pada = floor((siderealMoon mod 13.3333) / 3.3333) + 1
 */
export function computeNakshatraFromLongitude(
  siderealMoon: number,
  name: string,
): NakshatraInfo {
  const index = Math.floor(siderealMoon / NAKSHATRA_SPAN);
  const degreesInNakshatra = siderealMoon - index * NAKSHATRA_SPAN;
  const pada = Math.floor(degreesInNakshatra / NAKSHATRA_PADA_SPAN) + 1;
  const completionPercentage = (degreesInNakshatra / NAKSHATRA_SPAN) * 100;

  return {
    index,
    name,
    pada: Math.min(pada, 4), // Clamp to 4 for floating-point edge case at boundary
    degreesInNakshatra: Math.round(degreesInNakshatra * 10000) / 10000,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    endTime: null,
  };
}

export function getNakshatraIndexAtTime(
  date: Date,
  getCachedMoon: (d: Date) => number,
): number {
  const moonLon = getCachedMoon(date);
  return Math.floor(moonLon / NAKSHATRA_SPAN);
}
```

### 7.4 Yoga

```typescript
// src/core/yoga.ts

import { normalize360 } from '../utils/angle';
import { YOGA_SPAN } from '../utils/constants';
import type { YogaInfo } from '../types/elements';

/**
 * Yoga = combined sidereal longitude of Sun and Moon, divided into 27 parts.
 *
 * Formula:
 *   yogaAngle = normalize360(siderealSun + siderealMoon)
 *   yogaIndex = floor(yogaAngle / 13.3333)
 */
export function computeYogaFromLongitudes(
  siderealMoon: number,
  siderealSun: number,
  name: string,
): YogaInfo {
  const angle = normalize360(siderealSun + siderealMoon);
  const index = Math.floor(angle / YOGA_SPAN);
  const elapsed = angle - index * YOGA_SPAN;
  const completionPercentage = (elapsed / YOGA_SPAN) * 100;

  return {
    index,
    name,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    endTime: null,
  };
}

export function getYogaIndexAtTime(
  date: Date,
  getCachedMoon: (d: Date) => number,
  getCachedSun: (d: Date) => number,
): number {
  const angle = normalize360(getCachedSun(date) + getCachedMoon(date));
  return Math.floor(angle / YOGA_SPAN);
}

/** Direct longitude → index. Used by the orchestrator at sunrise. */
export function getYogaIndex(siderealMoon: number, siderealSun: number): number {
  return Math.floor(normalize360(siderealSun + siderealMoon) / YOGA_SPAN);
}
```

### 7.5 Karana

```typescript
// src/core/karana.ts

import { normalize360 } from '../utils/angle';
import { KARANA_SPAN } from '../utils/constants';
import type { KaranaInfo } from '../types/elements';

const MOVABLE = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'] as const;
const FIXED_END = ['Shakuni', 'Chatushpada', 'Naga'] as const;

/**
 * Karana = half-Tithi = 6° of Moon-Sun elongation. 60 Karanas per lunar month.
 *
 * Mapping:
 *   index 0:       Kimstughna (fixed)
 *   index 1–56:    7-Karana movable cycle (Bava→Vishti, repeating 8 times)
 *   index 57–59:   Shakuni, Chatushpada, Naga (fixed)
 */
export function computeKaranaFromLongitudes(
  siderealMoon: number,
  siderealSun: number,
  name: string,
): KaranaInfo {
  const angle = normalize360(siderealMoon - siderealSun);
  const index = Math.floor(angle / KARANA_SPAN);
  const elapsed = angle - index * KARANA_SPAN;
  const completionPercentage = (elapsed / KARANA_SPAN) * 100;

  return {
    index,
    name,
    type: getKaranaType(index),
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    endTime: null,
  };
}

export function getKaranaName(index: number): string {
  if (index === 0) return 'Kimstughna';
  if (index >= 57) return FIXED_END[index - 57]!;
  return MOVABLE[(index - 1) % 7]!;
}

export function getKaranaType(index: number): 'fixed' | 'movable' {
  return index === 0 || index >= 57 ? 'fixed' : 'movable';
}

export function getKaranaIndexAtTime(
  date: Date,
  getCachedMoon: (d: Date) => number,
  getCachedSun: (d: Date) => number,
): number {
  const angle = normalize360(getCachedMoon(date) - getCachedSun(date));
  return Math.floor(angle / KARANA_SPAN);
}

/** Direct longitude → index. Used by the orchestrator at sunrise. */
export function getKaranaIndex(siderealMoon: number, siderealSun: number): number {
  return Math.floor(normalize360(siderealMoon - siderealSun) / KARANA_SPAN);
}
```

### 7.6 Vara

```typescript
// src/core/vara.ts

import type { VaraInfo } from '../types/elements';
import { ENGLISH_DAY_NAMES } from '../utils/constants';

/**
 * Hindu weekday. The key rule: the Hindu day starts at SUNRISE, not midnight.
 * For any time between midnight and sunrise, the Vara is the previous calendar day.
 *
 * @param dateUtc    The moment to compute Vara for (UTC).
 * @param sunriseUtc Sunrise on this calendar day (UTC).
 * @param varaNames  Localized names from i18n.
 */
export function computeVara(
  dateUtc: Date,
  sunriseUtc: Date,
  varaNames: readonly { name: string; short: string }[],
): VaraInfo {
  // Use UTC day. If before sunrise, subtract one day.
  let d = new Date(dateUtc);
  if (dateUtc.getTime() < sunriseUtc.getTime()) {
    d = new Date(dateUtc.getTime() - 86_400_000);
  }

  const index = d.getUTCDay(); // 0=Sun, 6=Sat
  return {
    index,
    name: varaNames[index]!.name,
    shortName: varaNames[index]!.short,
    englishName: ENGLISH_DAY_NAMES[index]!,
  };
}
```

### 7.7 Masa (Hindu Month)

```typescript
// src/core/masa.ts

import type { MasaInfo } from '../types/panchang';

/**
 * Hindu solar month (Saura Masa) based on Sun's sidereal longitude.
 * Each 30° of sidereal Sun = one Masa.
 *
 * 0 = Mesha (roughly Apr-May),  1 = Vrishabha, ..., 11 = Meena
 *
 * This is the solar month (Saura). Lunar month (Chandramana) is more complex
 * and can be added in a future version.
 */
const MASA_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
  'Simha', 'Kanya', 'Tula', 'Vrischika',
  'Dhanus', 'Makara', 'Kumbha', 'Meena',
] as const;

export function computeMasa(siderealSunLon: number): MasaInfo {
  const index = Math.floor(siderealSunLon / 30);
  return {
    index,
    name: MASA_NAMES_EN[index]!,
  };
}
```

---

## 8. Binary Search for Transitions

### 8.1 Generic Search Function

```typescript
// src/utils/search.ts

import { PanchangError } from '../types/errors';

/**
 * Binary search to find the exact UTC moment when a discrete element index
 * transitions from `currentIndex` to a different value.
 *
 * HOW IT WORKS:
 *   lo = time where element = currentIndex
 *   hi = time where element ≠ currentIndex
 *   Bisect until (hi - lo) < tolerance
 *   Return hi (the first moment of the new element)
 *
 * @param startUtc       Search window start (must have index = currentIndex)
 * @param maxEndUtc      Maximum search window end
 * @param currentIndex   The element index we're finding the end of
 * @param getIndexAtTime Callback: returns element index at a given UTC instant
 * @param maxIterations  Safety cap. 15 = ±1.2min over 36h. 25 = ±0.04s.
 * @param toleranceMs    Stop condition: window width in ms. Default 30_000 (30s).
 *
 * @returns UTC Date: the moment the element transitions (± tolerance)
 */
export function findTransitionTime(
  startUtc: Date,
  maxEndUtc: Date,
  currentIndex: number,
  getIndexAtTime: (date: Date) => number,
  maxIterations: number = 15,
  toleranceMs: number = 30_000,
): Date {
  let lo = startUtc.getTime();
  let hi = maxEndUtc.getTime();

  // Verify the element actually changes within our window.
  // If not, extend the window in 6h steps up to 48h total.
  if (getIndexAtTime(new Date(hi)) === currentIndex) {
    const extensions = [6, 12, 18, 24]; // hours to add
    let found = false;
    for (const ext of extensions) {
      hi = maxEndUtc.getTime() + ext * 3600_000;
      if (getIndexAtTime(new Date(hi)) !== currentIndex) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new PanchangError(
        `Binary search could not find transition for element index ${currentIndex} ` +
          `within 48h+ of ${startUtc.toISOString()}`,
        'SEARCH_DIVERGED'
      );
    }
  }

  let iterations = 0;
  while (hi - lo > toleranceMs && iterations < maxIterations) {
    const mid = lo + (hi - lo) / 2;
    if (getIndexAtTime(new Date(mid)) === currentIndex) {
      lo = mid;
    } else {
      hi = mid;
    }
    iterations++;
  }

  return new Date(hi);
}

/**
 * Find when the current element STARTED (search backwards).
 *
 * We look for when the PREVIOUS index was still active, and find that transition.
 * The result = start time of the current element.
 */
export function findStartTime(
  fromUtc: Date,
  currentIndex: number,
  totalElements: number,
  getIndexAtTime: (date: Date) => number,
  maxSearchBackHours: number = 36,
  maxIterations: number = 15,
  toleranceMs: number = 30_000,
): Date {
  const searchStart = new Date(fromUtc.getTime() - maxSearchBackHours * 3600_000);
  const previousIndex = (currentIndex - 1 + totalElements) % totalElements;

  // At searchStart, we expect the previous element to be active.
  // Binary search to find when previousIndex transitions to currentIndex.
  let lo = searchStart.getTime();
  let hi = fromUtc.getTime();

  // Verify searchStart actually has the previous index
  if (getIndexAtTime(new Date(lo)) !== previousIndex) {
    // The previous element already ended before our search window.
    // Return searchStart as a best-effort approximation.
    return searchStart;
  }

  let iterations = 0;
  while (hi - lo > toleranceMs && iterations < maxIterations) {
    const mid = lo + (hi - lo) / 2;
    if (getIndexAtTime(new Date(mid)) === previousIndex) {
      lo = mid;
    } else {
      hi = mid;
    }
    iterations++;
  }

  return new Date(hi);
}
```

### 8.2 Search Window Sizes per Element

| Element   | Span    | Min Duration | Max Duration | Forward Search | Back Search |
|-----------|---------|-------------|-------------|----------------|-------------|
| Tithi     | 12°     | ~19h        | ~26h        | 36h            | 36h         |
| Nakshatra | 13.333° | ~21h        | ~28h        | 36h            | 36h         |
| Yoga      | 13.333° | ~21h        | ~28h        | 36h            | 36h         |
| Karana    | 6°      | ~9.5h       | ~13h        | 18h            | 18h         |

### 8.3 Precision Modes

| Mode | Iterations | Precision (36h window) | Precision (18h window) | Use case |
|------|-----------|----------------------|----------------------|----------|
| `standard` | 15 | ±1.2 min | ±0.6 min | App display |
| `high` | 25 | ±0.04 sec | ±0.02 sec | Jyotish/muhurta |

---

## 9. Performance — Longitude Cache

### 9.1 The Problem

Binary search for one element = 15 iterations × 2 longitude calls = 30 calls.
Full daily mode = Tithi + Nakshatra + Yoga + 2–3 Karanas = ~5–6 end-time searches.
Total without cache: **~180 longitude calls.** Each call = EclipticLongitude → trig series.

On budget Android with Hermes: ~3ms per call → **540ms just for longitudes.**

### 9.2 Time-Bucketed Memoization

Many of those 180 calls land near the same timestamps (different searches probe the same
time region). Bucket by 1-minute windows so nearby lookups hit the cache.

```typescript
// src/astronomy/cache.ts

import { getSiderealMoonLongitude } from './moon';
import { getSiderealSunLongitude } from './sun';
import type { AyanamsaType } from '../types/options';

const BUCKET_MS = 60_000; // 1-minute buckets

/**
 * Per-computation longitude cache.
 *
 * LIFECYCLE: Created at the start of getDailyPanchang() or getInstantPanchang(),
 * passed to all sub-functions, discarded after the call returns.
 * This is NOT a global/persistent cache — it exists only for the duration of one
 * Panchang computation to deduplicate longitude calls.
 */
export class LongitudeCache {
  private moonCache = new Map<number, number>();
  private sunCache = new Map<number, number>();
  private readonly ayanamsaType: AyanamsaType;

  /** Stats for debug output */
  public hits = 0;
  public misses = 0;

  constructor(ayanamsaType: AyanamsaType) {
    this.ayanamsaType = ayanamsaType;
  }

  getMoon(date: Date): number {
    const bucket = Math.floor(date.getTime() / BUCKET_MS);
    const cached = this.moonCache.get(bucket);
    if (cached !== undefined) {
      this.hits++;
      return cached;
    }
    this.misses++;
    const lon = getSiderealMoonLongitude(date, this.ayanamsaType);
    this.moonCache.set(bucket, lon);
    return lon;
  }

  getSun(date: Date): number {
    const bucket = Math.floor(date.getTime() / BUCKET_MS);
    const cached = this.sunCache.get(bucket);
    if (cached !== undefined) {
      this.hits++;
      return cached;
    }
    this.misses++;
    const lon = getSiderealSunLongitude(date, this.ayanamsaType);
    this.sunCache.set(bucket, lon);
    return lon;
  }

  /** Number of unique longitude computations performed */
  get size(): number {
    return this.moonCache.size + this.sunCache.size;
  }
}
```

### 9.3 Cache Usage Pattern

```typescript
// In getDailyPanchang():

const cache = new LongitudeCache(options.ayanamsa ?? 'lahiri');

// All element functions receive cache methods as callbacks:
const tithiIndex = getTithiIndexAtTime(
  someDate,
  (d) => cache.getMoon(d),
  (d) => cache.getSun(d),
);

// After all computations:
if (__DEV__) {
  console.log(`[panchang-ts] Cache: ${cache.hits} hits, ${cache.misses} misses, ${cache.size} entries`);
}
```

### 9.4 Expected Cache Performance

Typical full daily computation:
- Without cache: ~180 longitude calls
- With 1-minute bucketed cache: ~60–80 unique calls (55–65% cache hit rate)
- Time saved on budget Android: ~300–360ms

### 9.5 Why Not a Global Cache

A persistent global cache across multiple `getDailyPanchang` calls would save more time but:
- Creates hidden state and potential memory leaks on long-running apps
- Makes functions impure — harder to test
- Risk of stale data if someone calls with different ayanamsa types
- The per-call cache already captures the main win (intra-call deduplication)

---

## 10. Inauspicious Periods & Muhurta

### 10.1 Rahu Kalam, Gulika, Yamaganda

```typescript
// src/core/inauspicious.ts

import type { TimePeriod } from '../types/elements';
import { RAHU_KALAM_SLOTS, YAMAGANDA_SLOTS, GULIKA_SLOTS } from '../utils/constants';

/**
 * Compute an inauspicious period by dividing daytime into 8 equal slots.
 *
 * @param sunrise   Sunrise UTC Date
 * @param sunset    Sunset UTC Date
 * @param varaIndex 0=Sunday, 6=Saturday
 * @param slotTable Which slot table to use (Rahu/Yamaganda/Gulika)
 */
export function computeInauspiciousPeriod(
  sunrise: Date,
  sunset: Date,
  varaIndex: number,
  slotTable: readonly number[],
): TimePeriod {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const slotDurationMs = dayDurationMs / 8;
  const slotIndex = slotTable[varaIndex]!;

  const start = new Date(sunrise.getTime() + slotIndex * slotDurationMs);
  const end = new Date(start.getTime() + slotDurationMs);

  return { start, end };
}

// Convenience wrappers:

export function computeRahuKalam(sunrise: Date, sunset: Date, varaIndex: number): TimePeriod {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, RAHU_KALAM_SLOTS);
}

export function computeGulikaKalam(sunrise: Date, sunset: Date, varaIndex: number): TimePeriod {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, GULIKA_SLOTS);
}

export function computeYamaganda(sunrise: Date, sunset: Date, varaIndex: number): TimePeriod {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, YAMAGANDA_SLOTS);
}
```

### 10.2 Abhijit Muhurta

```typescript
// src/core/muhurta.ts

import type { TimePeriod } from '../types/elements';

/**
 * Abhijit Muhurta: the 8th muhurta when daytime is divided into 15 equal parts.
 * This is the most auspicious muhurta, centered around local noon.
 *
 * For a 12-hour day: each muhurta = 48 min. Abhijit = ~11:36 AM to 12:24 PM.
 *
 * @param sunrise Sunrise UTC Date
 * @param sunset  Sunset UTC Date
 */
export function computeAbhijitMuhurta(sunrise: Date, sunset: Date): TimePeriod {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const muhurtaDurationMs = dayDurationMs / 15;

  // 8th muhurta = index 7 (0-based)
  const start = new Date(sunrise.getTime() + 7 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);

  return { start, end };
}
```

---

## 11. Internationalization (i18n)

### 11.1 Translation Shape

```typescript
// src/i18n/types.ts

export interface PanchangTranslations {
  /** 15 Tithi names (Pratipad through Chaturdashi). Purnima/Amavasya in misc. */
  tithiNames: readonly string[];
  nakshatraNames: readonly string[];    // 27 names
  yogaNames: readonly string[];         // 27 names
  karanaNames: {
    movable: readonly string[];         // 7 names
    fixed: readonly string[];           // 4 names: Kimstughna, Shakuni, Chatushpada, Naga
  };
  varaNames: readonly { name: string; short: string }[];  // 7 entries (Sun–Sat)
  pakshaNames: { shukla: string; krishna: string };
  masaNames: readonly string[];         // 12 solar month names
  misc: {
    purnima: string;
    amavasya: string;
  };
}
```

### 11.2 English

```typescript
// src/i18n/en.ts
import type { PanchangTranslations } from './types';

export const en: PanchangTranslations = {
  tithiNames: [
    'Pratipad', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
    'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
    'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi',
  ],
  nakshatraNames: [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira',
    'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
    'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra',
    'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
    'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta',
    'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
  ],
  yogaNames: [
    'Vishkamba', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana',
    'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda',
    'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra',
    'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva',
    'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma',
    'Indra', 'Vaidhriti',
  ],
  karanaNames: {
    movable: ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'],
    fixed: ['Kimstughna', 'Shakuni', 'Chatushpada', 'Naga'],
  },
  varaNames: [
    { name: 'Ravivara', short: 'Ravi' },
    { name: 'Somavara', short: 'Soma' },
    { name: 'Mangalavara', short: 'Mangal' },
    { name: 'Budhavara', short: 'Budh' },
    { name: 'Guruvara', short: 'Guru' },
    { name: 'Shukravara', short: 'Shukra' },
    { name: 'Shanivara', short: 'Shani' },
  ],
  pakshaNames: { shukla: 'Shukla', krishna: 'Krishna' },
  masaNames: [
    'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
    'Simha', 'Kanya', 'Tula', 'Vrischika',
    'Dhanus', 'Makara', 'Kumbha', 'Meena',
  ],
  misc: { purnima: 'Purnima', amavasya: 'Amavasya' },
};
```

### 11.3 Sanskrit (Devanagari)

```typescript
// src/i18n/sa.ts
import type { PanchangTranslations } from './types';

export const sa: PanchangTranslations = {
  tithiNames: [
    'प्रतिपदा', 'द्वितीया', 'तृतीया', 'चतुर्थी', 'पञ्चमी',
    'षष्ठी', 'सप्तमी', 'अष्टमी', 'नवमी', 'दशमी',
    'एकादशी', 'द्वादशी', 'त्रयोदशी', 'चतुर्दशी',
  ],
  nakshatraNames: [
    'अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा',
    'आर्द्रा', 'पुनर्वसु', 'पुष्य', 'आश्लेषा', 'मघा',
    'पूर्वफाल्गुनी', 'उत्तरफाल्गुनी', 'हस्त', 'चित्रा',
    'स्वाती', 'विशाखा', 'अनुराधा', 'ज्येष्ठा', 'मूल',
    'पूर्वाषाढा', 'उत्तराषाढा', 'श्रवण', 'धनिष्ठा',
    'शतभिषा', 'पूर्वभाद्रपदा', 'उत्तरभाद्रपदा', 'रेवती',
  ],
  yogaNames: [
    'विष्कम्भ', 'प्रीति', 'आयुष्मान्', 'सौभाग्य', 'शोभन',
    'अतिगण्ड', 'सुकर्मा', 'धृति', 'शूल', 'गण्ड',
    'वृद्धि', 'ध्रुव', 'व्याघात', 'हर्षण', 'वज्र',
    'सिद्धि', 'व्यतीपात', 'वरीयान्', 'परिघ', 'शिव',
    'सिद्ध', 'साध्य', 'शुभ', 'शुक्ल', 'ब्रह्म',
    'इन्द्र', 'वैधृति',
  ],
  karanaNames: {
    movable: ['बव', 'बालव', 'कौलव', 'तैतिल', 'गर', 'वणिज', 'विष्टि'],
    fixed: ['किंस्तुघ्न', 'शकुनि', 'चतुष्पाद', 'नाग'],
  },
  varaNames: [
    { name: 'रविवार', short: 'रवि' },
    { name: 'सोमवार', short: 'सोम' },
    { name: 'मङ्गलवार', short: 'मङ्गल' },
    { name: 'बुधवार', short: 'बुध' },
    { name: 'गुरुवार', short: 'गुरु' },
    { name: 'शुक्रवार', short: 'शुक्र' },
    { name: 'शनिवार', short: 'शनि' },
  ],
  pakshaNames: { shukla: 'शुक्ल', krishna: 'कृष्ण' },
  masaNames: [
    'मेष', 'वृषभ', 'मिथुन', 'कर्क',
    'सिंह', 'कन्या', 'तुला', 'वृश्चिक',
    'धनु', 'मकर', 'कुम्भ', 'मीन',
  ],
  misc: { purnima: 'पूर्णिमा', amavasya: 'अमावास्या' },
};
```

### 11.4 Hindi

```typescript
// src/i18n/hi.ts
// Very similar to Sanskrit but with Hindi spelling conventions.
// Key differences: some simplified spellings, hindi postpositions.
// For v0.1.0, Hindi and Sanskrit can be identical — refine later based on user feedback.
import { sa } from './sa';
import type { PanchangTranslations } from './types';

export const hi: PanchangTranslations = { ...sa };
// TODO: Differentiate Hindi spellings where needed
```

### 11.5 Name Resolver

```typescript
// src/i18n/resolver.ts

import { en } from './en';
import { sa } from './sa';
import { hi } from './hi';
import type { PanchangTranslations } from './types';
import type { Language } from '../types/options';

const TRANSLATIONS: Record<Language, PanchangTranslations> = { en, sa, hi };

export function getTranslations(lang: Language): PanchangTranslations {
  return TRANSLATIONS[lang] ?? en;
}

export function resolveTithiName(index: number, lang: Language): string {
  const t = getTranslations(lang);
  if (index === 14) return t.misc.purnima;
  if (index === 29) return t.misc.amavasya;

  const paksha = index < 15 ? t.pakshaNames.shukla : t.pakshaNames.krishna;
  const nameIndex = index < 15 ? index : index - 15;
  return `${paksha} ${t.tithiNames[nameIndex]!}`;
}

export function resolveNakshatraName(index: number, lang: Language): string {
  return getTranslations(lang).nakshatraNames[index]!;
}

export function resolveYogaName(index: number, lang: Language): string {
  return getTranslations(lang).yogaNames[index]!;
}

export function resolveKaranaName(index: number, lang: Language): string {
  const t = getTranslations(lang);
  if (index === 0) return t.karanaNames.fixed[0]!; // Kimstughna
  if (index >= 57) return t.karanaNames.fixed[index - 56]!; // Shakuni=1, Chatushpada=2, Naga=3
  return t.karanaNames.movable[(index - 1) % 7]!;
}

export function resolveMasaName(index: number, lang: Language): string {
  return getTranslations(lang).masaNames[index]!;
}
```

---

## 12. Error Handling & Validation

### 12.1 Error Types

See Section 4, `src/types/errors.ts`. Error codes:

| Code | When | Recovery |
|------|------|----------|
| `INVALID_LATITUDE` | lat outside [-90, 90] | Fix input |
| `INVALID_LONGITUDE` | lng outside [-180, 180] | Fix input |
| `INVALID_ELEVATION` | elevation < -500 | Fix input |
| `INVALID_DATE` | Invalid Date or outside 1900–2100 | Fix input |
| `INVALID_TIMEZONE` | Offset outside [-720, 840] or non-integer | Fix input |
| `INVALID_AYANAMSA` | Unknown ayanamsa type string | Fix input |
| `TIMEZONE_RESOLUTION_FAILED` | IANA string on Hermes | Use numeric offset |
| `NO_SUNRISE` | Polar region, no sunrise within 2 days | Show "unavailable" UI |
| `NO_SUNSET` | Polar region, no sunset | Show "unavailable" UI |
| `SEARCH_DIVERGED` | Binary search couldn't find transition in 48h | Rare — report bug |

### 12.2 Input Validation

```typescript
// src/utils/validation.ts

import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';

export function validateLocation(location: GeoLocation): void {
  if (typeof location.latitude !== 'number' || location.latitude < -90 || location.latitude > 90) {
    throw new PanchangError(
      `Latitude must be a number between -90 and 90, got ${location.latitude}`,
      'INVALID_LATITUDE'
    );
  }
  if (typeof location.longitude !== 'number' || location.longitude < -180 || location.longitude > 180) {
    throw new PanchangError(
      `Longitude must be a number between -180 and 180, got ${location.longitude}`,
      'INVALID_LONGITUDE'
    );
  }
  if (location.elevation !== undefined && (typeof location.elevation !== 'number' || location.elevation < -500)) {
    throw new PanchangError(
      `Elevation must be >= -500 meters, got ${location.elevation}`,
      'INVALID_ELEVATION'
    );
  }
}

export function validateDate(date: Date): void {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new PanchangError(`Invalid Date: ${String(date)}`, 'INVALID_DATE');
  }
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    throw new PanchangError(
      `Date must be between 1900 and 2100 for astronomical accuracy, got year ${year}`,
      'INVALID_DATE'
    );
  }
}
```

---

## 13. Orchestrator — getDailyPanchang / getInstantPanchang

### 13.1 getDailyPanchang

This is the main entry point. It orchestrates everything in a specific order to
minimize redundant computation.

```typescript
// src/core/panchang.ts (pseudocode — shows full flow)

export function getDailyPanchang(
  date: Date,
  location: GeoLocation,
  options: PanchangOptions,
): DailyPanchangResult {
  const startTs = Date.now();

  // ── 1. Validate inputs ──────────────────────────────
  validateDate(date);
  validateLocation(location);
  const offsetMinutes = resolveUtcOffset(options.timezone, date);
  const ayanamsaType = options.ayanamsa ?? 'lahiri';
  const lang = options.language ?? 'en';
  const doEndTimes = options.computeEndTimes !== false;
  const maxIter = options.precision === 'high' ? 25 : 15;

  // ── 2. Create per-call longitude cache ──────────────
  const cache = new LongitudeCache(ayanamsaType);
  const getMoon = (d: Date) => cache.getMoon(d);
  const getSun = (d: Date) => cache.getSun(d);

  // ── 3. Compute sunrise triplet (most expensive single step) ──
  const sunriseT0 = Date.now();
  const localMidnightUtc = getLocalMidnightUtc(date, offsetMinutes);
  const sunriseUtc = computeSunrise(localMidnightUtc, location);
  const sunsetUtc = computeSunset(sunriseUtc, location);
  const nextSunriseUtc = computeSunrise(sunsetUtc, location);
  const sunriseMs = Date.now() - sunriseT0;

  // ── 4. Compute longitudes at sunrise (reused by all elements) ──
  const elementsT0 = Date.now();
  const siderealMoonAtSunrise = getMoon(sunriseUtc);
  const siderealSunAtSunrise = getSun(sunriseUtc);
  const ayanamsaValue = computeAyanamsa(sunriseUtc, ayanamsaType);

  // ── 5. Compute elements at sunrise ──────────────────
  const tithiAtSunrise = computeTithiFromLongitudes(
    siderealMoonAtSunrise, siderealSunAtSunrise,
    resolveTithiName(getTithiIndexFromLons(siderealMoonAtSunrise, siderealSunAtSunrise), lang)
  );
  const nakshatraAtSunrise = computeNakshatraFromLongitude(
    siderealMoonAtSunrise,
    resolveNakshatraName(Math.floor(siderealMoonAtSunrise / NAKSHATRA_SPAN), lang)
  );
  const yogaAtSunrise = computeYogaFromLongitudes(
    siderealMoonAtSunrise, siderealSunAtSunrise,
    resolveYogaName(getYogaIndex(siderealMoonAtSunrise, siderealSunAtSunrise), lang)
  );
  const karanaAtSunrise = computeKaranaFromLongitudes(
    siderealMoonAtSunrise, siderealSunAtSunrise,
    resolveKaranaName(getKaranaIndex(siderealMoonAtSunrise, siderealSunAtSunrise), lang)
  );

  const vara = computeVara(sunriseUtc, sunriseUtc, getTranslations(lang).varaNames);
  const masa = computeMasa(siderealSunAtSunrise);
  const elementsMs = Date.now() - elementsT0;

  // ── 6. Find transitions (daily element arrays) ──────
  const endTimesT0 = Date.now();
  let tithis: DailyTithiInfo[];
  let nakshatras: DailyNakshatraInfo[];
  let yogas: DailyYogaInfo[];
  let karanas: DailyKaranaInfo[];

  if (doEndTimes) {
    tithis = findDailyElements(
      sunriseUtc, nextSunriseUtc, tithiAtSunrise,
      (d) => getTithiIndexAtTime(d, getMoon, getSun),
      resolveTithiName, lang, 30, 36, maxIter, 2
    );
    nakshatras = findDailyElements(
      sunriseUtc, nextSunriseUtc, nakshatraAtSunrise,
      (d) => getNakshatraIndexAtTime(d, getMoon),
      resolveNakshatraName, lang, 27, 36, maxIter, 2
    );
    yogas = findDailyElements(
      sunriseUtc, nextSunriseUtc, yogaAtSunrise,
      (d) => getYogaIndexAtTime(d, getMoon, getSun),
      resolveYogaName, lang, 27, 36, maxIter, 2
    );
    karanas = findDailyElements(
      sunriseUtc, nextSunriseUtc, karanaAtSunrise,
      (d) => getKaranaIndexAtTime(d, getMoon, getSun),
      resolveKaranaName, lang, 60, 18, maxIter, 4
    );
  } else {
    // Fast mode: wrap sunrise element in daily format, no transitions
    tithis = [{ ...tithiAtSunrise, startTime: null, isActiveAtSunrise: true }];
    nakshatras = [{ ...nakshatraAtSunrise, startTime: null, isActiveAtSunrise: true }];
    yogas = [{ ...yogaAtSunrise, startTime: null, isActiveAtSunrise: true }];
    karanas = [{ ...karanaAtSunrise, startTime: null, isActiveAtSunrise: true }];
  }
  const endTimesMs = Date.now() - endTimesT0;

  // ── 7. Compute time-slot periods ────────────────────
  const rahuKalam = computeRahuKalam(sunriseUtc, sunsetUtc, vara.index);
  const gulikaKalam = computeGulikaKalam(sunriseUtc, sunsetUtc, vara.index);
  const yamaganda = computeYamaganda(sunriseUtc, sunsetUtc, vara.index);
  const abhijitMuhurta = computeAbhijitMuhurta(sunriseUtc, sunsetUtc);

  // ── 8. Convert all UTC dates to local display ───────
  const toLocal = (d: Date) => utcToLocalDisplay(d, offsetMinutes);
  const toLocalOrNull = (d: Date | null) => d ? toLocal(d) : null;
  const convertTimePeriod = (tp: TimePeriod): TimePeriod => ({
    start: toLocal(tp.start),
    end: toLocal(tp.end),
  });

  const localSunrise = toLocal(sunriseUtc);
  const localSunset = toLocal(sunsetUtc);
  const dayDurationMs = sunsetUtc.getTime() - sunriseUtc.getTime();
  const nightDurationMs = nextSunriseUtc.getTime() - sunsetUtc.getTime();

  // Convert all element dates
  for (const t of tithis) {
    t.endTime = toLocalOrNull(t.endTime);
    t.startTime = toLocalOrNull(t.startTime);
  }
  for (const n of nakshatras) {
    n.endTime = toLocalOrNull(n.endTime);
    n.startTime = toLocalOrNull(n.startTime);
  }
  for (const y of yogas) {
    y.endTime = toLocalOrNull(y.endTime);
    y.startTime = toLocalOrNull(y.startTime);
  }
  for (const k of karanas) {
    k.endTime = toLocalOrNull(k.endTime);
    k.startTime = toLocalOrNull(k.startTime);
  }

  // ── 9. Assemble result ──────────────────────────────
  const totalMs = Date.now() - startTs;

  return {
    date,
    location,
    timezone: offsetMinutes,
    sunrise: localSunrise,
    sunset: localSunset,
    nextSunrise: toLocal(nextSunriseUtc),
    dayDurationMinutes: Math.round(dayDurationMs / 60_000),
    nightDurationMinutes: Math.round(nightDurationMs / 60_000),
    tithis,
    nakshatras,
    yogas,
    karanas,
    vara,
    rahuKalam: convertTimePeriod(rahuKalam),
    gulikaKalam: convertTimePeriod(gulikaKalam),
    yamaganda: convertTimePeriod(yamaganda),
    abhijitMuhurta: convertTimePeriod(abhijitMuhurta),
    ayanamsa: ayanamsaValue,
    siderealSunAtSunrise,
    siderealMoonAtSunrise,
    masa,
    _debug: typeof __DEV__ !== 'undefined' && __DEV__
      ? { totalMs, sunriseMs, elementsMs, endTimesMs }
      : undefined,
  };
}
```

### 13.2 getInstantPanchang

```typescript
export function getInstantPanchang(
  date: Date,
  location: GeoLocation,
  options?: InstantPanchangOptions,
): InstantPanchangResult {
  validateDate(date);
  validateLocation(location);
  const ayanamsaType = options?.ayanamsa ?? 'lahiri';
  const lang = options?.language ?? 'en';
  const doEndTimes = options?.computeEndTimes !== false;
  const maxIter = options?.precision === 'high' ? 25 : 15;

  const cache = new LongitudeCache(ayanamsaType);
  const getMoon = (d: Date) => cache.getMoon(d);
  const getSun = (d: Date) => cache.getSun(d);

  const siderealMoon = getMoon(date);
  const siderealSun = getSun(date);
  const ayanamsaValue = computeAyanamsa(date, ayanamsaType);

  const tithi = computeTithiFromLongitudes(siderealMoon, siderealSun,
    resolveTithiName(getTithiIndexFromLons(siderealMoon, siderealSun), lang));
  const nakshatra = computeNakshatraFromLongitude(siderealMoon,
    resolveNakshatraName(Math.floor(siderealMoon / NAKSHATRA_SPAN), lang));
  const yoga = computeYogaFromLongitudes(siderealMoon, siderealSun,
    resolveYogaName(getYogaIndex(siderealMoon, siderealSun), lang));
  const karana = computeKaranaFromLongitudes(siderealMoon, siderealSun,
    resolveKaranaName(getKaranaIndex(siderealMoon, siderealSun), lang));

  // For Vara in instant mode, we need sunrise to know if it's before/after sunrise
  const sunriseUtc = computeSunrise(
    new Date(date.getTime() - 12 * 3600_000), // search from 12h before
    location
  );
  const vara = computeVara(date, sunriseUtc, getTranslations(lang).varaNames);

  // Optionally compute end-times
  if (doEndTimes) {
    tithi.endTime = findTransitionTime(date, new Date(date.getTime() + 36*3600_000),
      tithi.index, (d) => getTithiIndexAtTime(d, getMoon, getSun), maxIter);
    nakshatra.endTime = findTransitionTime(date, new Date(date.getTime() + 36*3600_000),
      nakshatra.index, (d) => getNakshatraIndexAtTime(d, getMoon), maxIter);
    yoga.endTime = findTransitionTime(date, new Date(date.getTime() + 36*3600_000),
      yoga.index, (d) => getYogaIndexAtTime(d, getMoon, getSun), maxIter);
    karana.endTime = findTransitionTime(date, new Date(date.getTime() + 18*3600_000),
      karana.index, (d) => getKaranaIndexAtTime(d, getMoon, getSun), maxIter);
  }

  return {
    timestamp: date,
    location,
    tithi,
    nakshatra,
    yoga,
    karana,
    vara,
    ayanamsa: ayanamsaValue,
    siderealSun,
    siderealMoon,
  };
}
```

---

## 14. Public API Surface

```typescript
// src/index.ts

// ── Primary entry points ──────────────────────────────
export { getDailyPanchang, getInstantPanchang } from './core/panchang';

// ── Granular functions ────────────────────────────────
export { computeSunrise as getSunrise, computeSunset as getSunset } from './astronomy/sunrise';
export { getSiderealSunLongitude } from './astronomy/sun';
export { getSiderealMoonLongitude } from './astronomy/moon';
export { computeAyanamsa as getAyanamsa } from './astronomy/ayanamsa';
export { computeRahuKalam, computeGulikaKalam, computeYamaganda } from './core/inauspicious';
export { computeAbhijitMuhurta } from './core/muhurta';

// ── Types ─────────────────────────────────────────────
export type {
  GeoLocation,
  PanchangOptions, InstantPanchangOptions,
  AyanamsaType, Language, Precision,
  DailyPanchangResult, InstantPanchangResult,
  TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo, MasaInfo,
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo,
  TimePeriod,
  PanchangErrorCode,
} from './types';

// ── Errors ────────────────────────────────────────────
export { PanchangError } from './types/errors';
```

---

## 15. Build Setup

### 15.1 tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  outDir: 'dist',
  treeshake: true,
  minify: false,                    // Let consumers minify
  noExternal: ['astronomy-engine'], // Bundle for Hermes/Metro compat
});
```

### 15.2 package.json

```jsonc
{
  "name": "panchang-ts",
  "version": "0.1.0",
  "description": "Pure TypeScript Hindu Panchang calculations. Tithi, Nakshatra, Yoga, Karana, Vara, and more. Offline-first, React Native compatible.",
  "author": "Ishank",
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/your-username/panchang-ts" },
  "keywords": [
    "panchang", "panchangam", "hindu-calendar", "jyotish", "tithi", "nakshatra",
    "yoga", "karana", "vedic-astrology", "react-native", "typescript", "hermes"
  ],
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": false,
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:hermes": "bash scripts/hermes-check.sh",
    "bench": "vitest bench",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build",
    "changeset": "changeset",
    "release": "changeset publish"
  },
  "dependencies": {
    "astronomy-engine": "^2.1.19"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "eslint": "^9.0.0",
    "@changesets/cli": "^2.27.0"
  }
}
```

### 15.3 tsconfig.json

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 15.4 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/i18n/**', 'src/**/*.test.ts'],
      thresholds: { lines: 90, branches: 85, functions: 90 },
    },
    benchmark: {
      include: ['tests/perf/**/*.bench.ts'],
    },
  },
});
```

### 15.5 .gitignore

```
node_modules/
dist/
coverage/
*.tgz
.DS_Store
```

### 15.6 .npmignore

```
src/
tests/
scripts/
.github/
.changeset/
.eslintrc.cjs
tsconfig*.json
tsup.config.ts
vitest.config.ts
coverage/
*.tgz
```

---

## 16. Testing Strategy

### 16.1 Fixture Data Collection

**Source: DrikPanchang.com** — the standard Panchang reference in India.

**How to collect:** For each date/city combo, visit DrikPanchang.com, set the city, and manually
record: sunrise, sunset, Tithi(s) with end-times, Nakshatra(s) with end-times, Yoga, Karana(s),
Vara, Rahu Kalam start/end.

**Target fixture matrix:**

| # | Date | City | Why This Combo |
|---|------|------|----------------|
| 1 | 2025-01-14 | Pune | Makar Sankranti — your home city |
| 2 | 2025-01-14 | Delhi | Same date, different lat |
| 3 | 2025-01-14 | Chennai | Southern city |
| 4 | 2025-03-14 | Pune | Known 2-Tithi day |
| 5 | 2025-03-30 | Delhi | Near equinox |
| 6 | 2025-04-13 | Varanasi | Chaitra Navratri region |
| 7 | 2025-08-15 | Pune | Independence Day — common lookup |
| 8 | 2025-10-20 | Chennai | Diwali region |
| 9 | 2025-11-01 | Delhi | Post-Diwali Amavasya |
| 10 | 2025-06-21 | Pune | Summer solstice — longest day |
| 11 | 2025-12-21 | Pune | Winter solstice — shortest day |
| 12 | 2025-01-29 | Pune | Amavasya (new moon) |
| 13 | 2025-02-12 | Pune | Purnima (full moon) |
| 14 | 2025-01-14 | London | Western city, UTC+0 in Jan |
| 15 | 2025-07-04 | New York | Western city, UTC-4 in Jul (DST) |
| 16 | 2025-01-14 | Tromsø | High latitude (69°N) — may fail sunrise |
| 17 | 2025-06-21 | Tromsø | Midnight sun — should throw NO_SUNRISE |

**Fixture format:**
```jsonc
{
  "date": "2025-01-14",
  "city": "Pune",
  "location": { "latitude": 18.5204, "longitude": 73.8567 },
  "timezone": 330,
  "expected": {
    "sunrise": "2025-01-14T01:34:00Z",
    "sunset": "2025-01-14T12:38:00Z",
    "tithis": [
      { "name": "Krishna Chaturdashi", "paksha": "Krishna",
        "endTime": "2025-01-14T14:45:00Z" }
    ],
    "nakshatras": [
      { "name": "Mrigashira", "endTime": "2025-01-14T11:10:00Z" },
      { "name": "Ardra", "endTime": "2025-01-15T10:38:00Z" }
    ],
    "yogas": [{ "name": "Vyatipata" }],
    "karanas": [
      { "name": "Vanija", "endTime": "2025-01-14T03:12:00Z" },
      { "name": "Vishti", "endTime": "2025-01-14T14:45:00Z" },
      { "name": "Shakuni", "endTime": "2025-01-15T01:58:00Z" }
    ],
    "vara": "Mangalavara",
    "rahuKalam": { "start": "2025-01-14T09:41:00Z", "end": "2025-01-14T11:09:00Z" }
  }
}
```

NOTE: All fixture times are in UTC for unambiguous comparison. Convert from IST when collecting.

### 16.2 Tolerance Thresholds

| Metric | Tolerance | Reasoning |
|--------|-----------|-----------|
| Sunrise/sunset | ±2 min | DrikPanchang may use different atmospheric refraction model |
| Tithi name at sunrise | Exact match | Core correctness |
| Nakshatra name at sunrise | Exact match | Core correctness |
| Element end-time | ±5 min | Binary search precision + ayanamsa polynomial difference |
| Rahu Kalam start/end | ±3 min | Derived from sunrise tolerance |
| Ayanamsa vs Swiss Ephemeris | ±0.005° (~18 arcsec) | Polynomial approximation error |

### 16.3 Unit Tests

```typescript
// tests/unit/angle.test.ts
describe('normalize360', () => {
  it('no-op for values in [0, 360)', () => expect(normalize360(45)).toBe(45));
  it('wraps negative', () => expect(normalize360(-10)).toBe(350));
  it('wraps > 360', () => expect(normalize360(370)).toBe(10));
  it('wraps exactly 360', () => expect(normalize360(360)).toBe(0));
  it('wraps large negative', () => expect(normalize360(-730)).toBeCloseTo(350, 5));
});

// tests/unit/timezone.test.ts
describe('getLocalMidnightUtc', () => {
  it('IST midnight → previous day 18:30 UTC', () => {
    const d = new Date(2025, 0, 14);
    expect(getLocalMidnightUtc(d, 330).toISOString()).toBe('2025-01-13T18:30:00.000Z');
  });
  it('EST midnight → same day 05:00 UTC', () => {
    const d = new Date(2025, 0, 14);
    expect(getLocalMidnightUtc(d, -300).toISOString()).toBe('2025-01-14T05:00:00.000Z');
  });
  it('UTC+0 midnight → same day 00:00 UTC', () => {
    const d = new Date(2025, 0, 14);
    expect(getLocalMidnightUtc(d, 0).toISOString()).toBe('2025-01-14T00:00:00.000Z');
  });
});

// tests/unit/validation.test.ts
describe('validateLocation', () => {
  it('accepts valid coordinates', () => {
    expect(() => validateLocation({ latitude: 18.52, longitude: 73.86 })).not.toThrow();
  });
  it('rejects latitude > 90', () => {
    expect(() => validateLocation({ latitude: 91, longitude: 0 })).toThrow(PanchangError);
  });
  it('rejects non-number latitude', () => {
    expect(() => validateLocation({ latitude: NaN, longitude: 0 })).toThrow(PanchangError);
  });
});

// tests/unit/tithi.test.ts
describe('computeTithiFromLongitudes', () => {
  it('Shukla Pratipad at angle ~6°', () => {
    const t = computeTithiFromLongitudes(66, 60, 'Shukla Pratipad');
    expect(t.index).toBe(0);
    expect(t.paksha).toBe('Shukla');
    expect(t.completionPercentage).toBeCloseTo(50, 0);
  });
  it('Purnima at exactly 180°', () => {
    const t = computeTithiFromLongitudes(180, 0, 'Purnima');
    expect(t.index).toBe(15); // 180/12 = 15
    // Wait: 180/12 = 15 → that's Krishna Pratipad, not Purnima.
    // Purnima is index 14 (168° to 180°). At exactly 180° we're at the START of index 15.
    // This is a boundary case — the floor function gives 15, which is correct per the formula.
    // Purnima = index 14 = angle 168° to just under 180°.
    // The moment angle = 180° exactly, it's Krishna Pratipad (index 15).
  });
  it('Amavasya at angle ~354°', () => {
    const t = computeTithiFromLongitudes(354, 0, 'Amavasya');
    expect(t.index).toBe(29); // 354/12 = 29.5, floor = 29
    expect(t.paksha).toBe('Krishna');
  });
  it('wraps: Moon < Sun', () => {
    const t = computeTithiFromLongitudes(10, 350, 'test');
    // normalize360(10 - 350) = normalize360(-340) = 20
    // 20 / 12 = 1.66, floor = 1
    expect(t.index).toBe(1);
  });
});

// tests/unit/search.test.ts
describe('findTransitionTime', () => {
  it('finds the moment a step function changes', () => {
    const changeAtHour10 = (d: Date) => d.getUTCHours() >= 10 ? 6 : 5;
    const start = new Date('2025-01-14T00:00:00Z');
    const end = new Date('2025-01-14T23:59:00Z');
    const result = findTransitionTime(start, end, 5, changeAtHour10, 15, 60_000);
    expect(result.getUTCHours()).toBe(10);
    expect(result.getUTCMinutes()).toBeLessThanOrEqual(1);
  });
  it('extends window if transition not in initial range', () => { /* ... */ });
  it('throws SEARCH_DIVERGED if no transition in 48h', () => { /* ... */ });
});

// tests/unit/ayanamsa.test.ts
describe('computeAyanamsa', () => {
  it('Lahiri at J2000 ≈ 23.853°', () => {
    const result = computeAyanamsa(new Date('2000-01-01T12:00:00Z'), 'lahiri');
    expect(result).toBeCloseTo(23.853, 2);
  });
  it('Lahiri at 2025 ≈ 24.2°', () => {
    const result = computeAyanamsa(new Date('2025-01-01T00:00:00Z'), 'lahiri');
    expect(result).toBeCloseTo(24.2, 1);
  });
  it('Raman < Lahiri (always)', () => {
    const d = new Date('2025-06-15T00:00:00Z');
    expect(computeAyanamsa(d, 'raman')).toBeLessThan(computeAyanamsa(d, 'lahiri'));
  });
});

// tests/unit/cache.test.ts
describe('LongitudeCache', () => {
  it('returns same value for timestamps in same 1-min bucket', () => {
    const cache = new LongitudeCache('lahiri');
    const d1 = new Date('2025-01-14T12:00:10Z');
    const d2 = new Date('2025-01-14T12:00:45Z');
    const v1 = cache.getMoon(d1);
    const v2 = cache.getMoon(d2);
    expect(v1).toBe(v2);
    expect(cache.hits).toBe(1);
    expect(cache.misses).toBe(1);
  });
  it('returns different values for different 1-min buckets', () => {
    const cache = new LongitudeCache('lahiri');
    const d1 = new Date('2025-01-14T12:00:00Z');
    const d2 = new Date('2025-01-14T12:05:00Z'); // 5 minutes later
    cache.getMoon(d1);
    cache.getMoon(d2);
    expect(cache.misses).toBe(2);
  });
});
```

### 16.4 Integration Tests

```typescript
// tests/integration/daily-panchang.test.ts
import fixtures from '../fixtures/drikpanchang-india.json';

describe('getDailyPanchang vs DrikPanchang (India)', () => {
  for (const f of fixtures) {
    describe(`${f.city} on ${f.date}`, () => {
      let result: DailyPanchangResult;

      beforeAll(() => {
        result = getDailyPanchang(new Date(f.date), f.location, { timezone: f.timezone });
      });

      it('sunrise within ±2 minutes', () => {
        const expected = new Date(f.expected.sunrise).getTime();
        const actual = result.sunrise.getTime();
        expect(Math.abs(actual - expected)).toBeLessThan(2 * 60_000);
      });

      it('primary Tithi name matches', () => {
        const primary = result.tithis.find(t => t.isActiveAtSunrise);
        expect(primary?.name).toBe(f.expected.tithis[0].name);
      });

      it('correct number of Tithis in the day', () => {
        expect(result.tithis.length).toBe(f.expected.tithis.length);
      });

      it('primary Nakshatra name matches', () => {
        const primary = result.nakshatras.find(n => n.isActiveAtSunrise);
        expect(primary?.name).toBe(f.expected.nakshatras[0].name);
      });

      it('Vara matches', () => {
        expect(result.vara.name).toBe(f.expected.vara);
      });

      it('Rahu Kalam start within ±3 minutes', () => {
        const expected = new Date(f.expected.rahuKalam.start).getTime();
        const actual = result.rahuKalam.start.getTime();
        expect(Math.abs(actual - expected)).toBeLessThan(3 * 60_000);
      });
    });
  }
});

// tests/integration/edge-cases.test.ts
describe('Edge cases', () => {
  it('throws NO_SUNRISE for Tromsø in June (midnight sun)', () => {
    expect(() =>
      getDailyPanchang(
        new Date('2025-06-21'),
        { latitude: 69.65, longitude: 18.95 },
        { timezone: 60 }
      )
    ).toThrow(PanchangError);
  });

  it('handles midnight input (before sunrise)', () => {
    const result = getInstantPanchang(
      new Date('2025-01-14T00:30:00Z'), // 06:00 IST — before sunrise
      { latitude: 18.5204, longitude: 73.8567 },
    );
    // Vara should be the PREVIOUS day (Jan 13 = Monday = Somavara)
    expect(result.vara.englishName).toBe('Monday');
  });

  it('handles year boundary (Dec 31 → Jan 1)', () => {
    const result = getDailyPanchang(
      new Date('2025-12-31'),
      { latitude: 18.5204, longitude: 73.8567 },
      { timezone: 330 }
    );
    expect(result.sunrise).toBeDefined();
  });

  it('handles negative longitude (Western hemisphere)', () => {
    const result = getDailyPanchang(
      new Date('2025-07-04'),
      { latitude: 40.7128, longitude: -74.006 }, // NYC
      { timezone: -240 } // EDT
    );
    expect(result.tithis.length).toBeGreaterThanOrEqual(1);
  });
});
```

### 16.5 Performance Benchmarks

```typescript
// tests/perf/benchmark.bench.ts
import { bench, describe } from 'vitest';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const DATE = new Date('2025-01-14');

describe('getDailyPanchang', () => {
  bench('fast mode (no end-times)', () => {
    getDailyPanchang(DATE, PUNE, { timezone: 330, computeEndTimes: false });
  });

  bench('full mode (with end-times, standard precision)', () => {
    getDailyPanchang(DATE, PUNE, { timezone: 330 });
  });

  bench('full mode (high precision)', () => {
    getDailyPanchang(DATE, PUNE, { timezone: 330, precision: 'high' });
  });
});

describe('getInstantPanchang', () => {
  bench('with end-times', () => {
    getInstantPanchang(new Date('2025-01-14T12:00:00Z'), PUNE);
  });

  bench('without end-times', () => {
    getInstantPanchang(new Date('2025-01-14T12:00:00Z'), PUNE, { computeEndTimes: false });
  });
});
```

Run with: `npx vitest bench`

---

## 17. Hermes Compatibility & CI

### 17.1 What's Safe and What's Not

```typescript
// ✅ SAFE in Hermes (ES2020 baseline)
Date, Date.now(), new Date(), Date.UTC()
Math.sin, Math.cos, Math.atan2, Math.floor, Math.ceil, Math.abs, Math.round, Math.PI
Number.isFinite, Number.isNaN, Number.parseInt, Number.parseFloat
JSON.parse, JSON.stringify
String.prototype: startsWith, endsWith, includes, padStart, padEnd, trim, replace
Array.prototype: map, filter, reduce, find, findIndex, some, every, includes, flat, flatMap
Array.from, Array.isArray
Object.entries, Object.keys, Object.values, Object.assign, Object.freeze
Map, Set, WeakMap, WeakSet
Promise, async/await, Promise.all, Promise.allSettled
typeof, instanceof
Symbol (basic usage)
for...of
Destructuring, spread, rest
Template literals
Optional chaining (?.), nullish coalescing (??)
structuredClone (Hermes 0.72+)

// ❌ AVOID
Intl.DateTimeFormat         // Partial support — don't rely for timezone resolution
eval(), new Function()      // Blocked by Hermes
import()                    // Dynamic imports — unreliable in Hermes
require('fs')               // Node-only
Buffer                      // Node-only
process.env                 // Node-only (use __DEV__ instead for dev checks)
Proxy, Reflect              // Partial — avoid
WeakRef                     // Not in older Hermes
globalThis.performance      // Use Date.now() instead
```

### 17.2 Hermes Check Script

```bash
#!/bin/bash
# scripts/hermes-check.sh
#
# Compiles the built CJS bundle to Hermes bytecode.
# If this fails, the code uses JS features Hermes doesn't support.
#
# Requires: npm install -g hermes-engine-cli
# Or in CI: npx hermes (from devDependencies)

set -euo pipefail

echo "=== Hermes Bytecode Compilation Check ==="

echo "1. Building package..."
npm run build 2>&1

if [ ! -f dist/index.cjs ]; then
  echo "❌ dist/index.cjs not found. Build may have failed."
  exit 1
fi

echo "2. Compiling to Hermes bytecode..."
npx hermes -emit-binary -out /tmp/panchang-ts.hbc dist/index.cjs 2>&1

if [ $? -eq 0 ]; then
  SIZE=$(wc -c < /tmp/panchang-ts.hbc)
  echo "✅ Hermes bytecode compilation PASSED"
  echo "   Bytecode size: ${SIZE} bytes"
  rm -f /tmp/panchang-ts.hbc
  exit 0
else
  echo "❌ Hermes bytecode compilation FAILED"
  echo "   Review the error above for unsupported JS features."
  exit 1
fi
```

### 17.3 CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run test:run

  coverage:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run test:coverage

  hermes:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - run: npm run test:hermes

  build-check:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - name: Verify dist contents
        run: |
          test -f dist/index.js     || (echo "Missing dist/index.js" && exit 1)
          test -f dist/index.cjs    || (echo "Missing dist/index.cjs" && exit 1)
          test -f dist/index.d.ts   || (echo "Missing dist/index.d.ts" && exit 1)
          test -f dist/index.d.cts  || (echo "Missing dist/index.d.cts" && exit 1)
          echo "✅ All expected output files present"
      - name: Dry-run npm pack
        run: npm pack --dry-run
```

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm run test:run
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: npx changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 18. Performance Budgets & Profiling

### 18.1 Realistic Targets

| | Budget Android (Helio G35) | Mid-range (SD 680) | Flagship |
|---|---|---|---|
| Fast mode (no end-times) | < 100ms | < 50ms | < 25ms |
| Full mode (standard, cached) | < 500ms | < 250ms | < 100ms |
| Full mode (high precision) | < 800ms | < 400ms | < 150ms |
| Instant (no end-times) | < 20ms | < 10ms | < 5ms |

These are **on-device Hermes** targets. Node.js will be 3–5x faster.

### 18.2 Dev-Only Profiling Utility

```typescript
// src/utils/perf.ts

/**
 * Wrap a function call with timing. Only active when __DEV__ is true.
 * In production builds, this compiles to a direct function call (zero overhead).
 */
export function withTiming<T>(label: string, fn: () => T): { result: T; ms: number } {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const start = Date.now();
    const result = fn();
    const ms = Date.now() - start;
    console.log(`[panchang-ts] ${label}: ${ms}ms`);
    return { result, ms };
  }
  return { result: fn(), ms: 0 };
}
```

### 18.3 Cache Impact Measurement

In the orchestrator, after computation:
```typescript
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log(`[panchang-ts] LongitudeCache: ${cache.hits} hits / ${cache.misses} misses (${cache.size} unique entries)`);
}
```

### 18.4 Performance Regression Prevention

The benchmark tests in `tests/perf/benchmark.bench.ts` run via `vitest bench`.
In CI, you can add a step that fails if the median exceeds a threshold:

```yaml
- name: Run benchmarks
  run: npx vitest bench --reporter=json > bench-results.json
- name: Check regression
  run: node -e "
    const r = require('./bench-results.json');
    // Extract median for 'full mode' and fail if > 50ms (Node threshold)
    // ...
  "
```

---

## 19. npm Release Checklist

### 19.1 One-Time Setup

```bash
# npm account
npm adduser
npm profile set mfa auth-and-writes

# GitHub secrets
# → Settings → Secrets → Actions → New:
#   NPM_TOKEN = <your npm token from `npm token create`>

# Changesets
npm install -D @changesets/cli
npx changeset init
```

### 19.2 .changeset/config.json

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### 19.3 Per-Release Flow

```bash
# 1. Create changeset for your PR
npx changeset
# Select: patch | minor | major
# Describe: "Add Tithi and Nakshatra calculation"

# 2. After PR merges, the release.yml workflow:
#    - Creates a "Version Packages" PR bumping package.json + CHANGELOG
#    - When that PR merges, publishes to npm

# 3. Manual fallback (if CI isn't set up yet):
npm run build
npm run test:run
npm run test:hermes
npx changeset version     # Bumps version, writes CHANGELOG
git add -A && git commit -m "chore: release"
npm publish --access public --provenance
git push --follow-tags
```

### 19.4 Pre-Publish Checklist

```bash
# Full verification sequence:
npm run typecheck        # TypeScript clean
npm run lint             # ESLint clean
npm run test:run         # All tests pass
npm run build            # Build succeeds
npm run test:hermes      # Hermes bytecode compiles
npm pack --dry-run       # Only dist/, README, LICENSE in tarball

# Smoke test in fresh project:
cd /tmp && mkdir test-pkg && cd test-pkg && npm init -y
npm install ~/path/to/panchang-ts-0.1.0.tgz

# ESM import test
echo 'import { getDailyPanchang } from "panchang-ts"; console.log(typeof getDailyPanchang);' > t.mjs
node t.mjs   # → "function"

# CJS require test
echo 'const { getDailyPanchang } = require("panchang-ts"); console.log(typeof getDailyPanchang);' > t.cjs
node t.cjs   # → "function"
```

### 19.5 Versioning Policy

| Change | Bump | Example |
|--------|------|---------|
| Bug fix | Patch | Sunrise off by 1 min, name typo |
| New element | Minor | Add Choghadiya, Hora |
| New language | Minor | Add Telugu, Tamil |
| New ayanamsa | Minor | Add Thirukanitham |
| New option | Minor | `computeEndTimes`, `precision` |
| Change return type shape | Major | Array → object, rename field |
| Change default ayanamsa | Major | Lahiri → something else |
| Remove public function | Major | Drop a re-export |

Start at `0.1.0`. Promote to `1.0.0` when:
- All 10+ elements validated against DrikPanchang for 15+ fixtures
- Running in dharmSetu on physical Android device
- API surface stable for 2+ weeks without changes

---

## 20. Local Development with dharmSetu

### 20.1 Option A: npm link (Start Here)

```bash
# In panchang-ts/
npm run build
npm link

# In dharmSetu/
npm link panchang-ts
```

**Required Metro config change (Metro can't follow symlinks by default):**

```javascript
// dharmSetu/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const panchangTsPath = path.resolve(__dirname, '../panchang-ts');

// Tell Metro to watch the linked package directory
config.watchFolders = [panchangTsPath];

// Tell Metro where to find node_modules for the linked package
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(panchangTsPath, 'node_modules'),
];

// Ensure Metro doesn't try to resolve `astronomy-engine` separately
// (it's bundled inside panchang-ts/dist/)
config.resolver.blockList = [
  new RegExp(path.resolve(panchangTsPath, 'node_modules').replace(/[/\\]/g, '[/\\\\]') + '/.*'),
];

module.exports = config;
```

**Dev loop (two terminals):**
```bash
# Terminal 1: auto-rebuild panchang-ts on change
cd panchang-ts
npm run dev              # tsup --watch

# Terminal 2: Expo dev server
cd dharmSetu
npx expo start
```

### 20.2 Option B: Workspaces (After 0.1.0)

```
projects/
├── packages/
│   └── panchang-ts/     # name: "panchang-ts"
├── apps/
│   └── dharmSetu/       # depends on "panchang-ts": "workspace:*"
└── package.json
```

**Root package.json:**
```json
{
  "private": true,
  "workspaces": ["packages/*", "apps/*"]
}
```

**dharmSetu/package.json:**
```json
{ "dependencies": { "panchang-ts": "workspace:*" } }
```

**Metro config (similar to above but with workspace paths).**

When you publish panchang-ts, switch dharmSetu to `"panchang-ts": "^0.1.0"`.

---

## 21. dharmSetu Integration — Two-Pass Rendering

### 21.1 The Pattern

Don't make users wait for end-time binary searches. Show element names instantly,
then fill in times in the background.

```typescript
// dharmSetu — PanchangScreen.tsx

import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { getDailyPanchang, type DailyPanchangResult } from 'panchang-ts';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const IST_OFFSET = 330;

export function usePanchang(date: Date) {
  const [panchang, setPanchang] = useState<DailyPanchangResult | null>(null);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // ── Pass 1: Fast — names only (~60–100ms on budget Android) ──
    const fast = getDailyPanchang(date, PUNE, {
      timezone: IST_OFFSET,
      computeEndTimes: false,
    });
    if (!cancelled) {
      setPanchang(fast);
    }

    // ── Pass 2: Full — end-times in background ──
    // InteractionManager waits until animations/touch responses finish
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const full = getDailyPanchang(date, PUNE, {
        timezone: IST_OFFSET,
        computeEndTimes: true,
      });
      if (!cancelled) {
        setPanchang(full);
        setIsFullyLoaded(true);
      }
    });

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [date]);

  return { panchang, isFullyLoaded };
}
```

### 21.2 UI Component Example

```tsx
function TithiDisplay({ tithis, isFullyLoaded }: {
  tithis: DailyTithiInfo[];
  isFullyLoaded: boolean;
}) {
  const primary = tithis.find(t => t.isActiveAtSunrise);
  if (!primary) return null;

  return (
    <View>
      <Text style={styles.elementName}>{primary.name}</Text>
      <Text style={styles.completion}>
        {primary.completionPercentage.toFixed(1)}% complete
      </Text>

      {isFullyLoaded && primary.endTime && (
        <Text style={styles.endTime}>
          until {formatTime(primary.endTime)}
        </Text>
      )}

      {/* Show second Tithi if present */}
      {isFullyLoaded && tithis.length > 1 && (
        <Text style={styles.secondary}>
          then {tithis[1]!.name} from {formatTime(tithis[1]!.startTime!)}
        </Text>
      )}

      {/* Loading indicator for end-times */}
      {!isFullyLoaded && (
        <ActivityIndicator size="small" style={styles.spinner} />
      )}
    </View>
  );
}

function formatTime(date: Date): string {
  // Remember: output dates are offset-adjusted — read via getUTC*
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
```

### 21.3 Caching Across Date Changes

If the user swipes between dates in dharmSetu, each date triggers a fresh computation.
Consider a simple LRU cache at the app level:

```typescript
// dharmSetu — panchangCache.ts

const MAX_CACHED_DAYS = 7;
const cache = new Map<string, DailyPanchangResult>();

function getCacheKey(date: Date, location: GeoLocation): string {
  return `${date.toISOString().slice(0, 10)}|${location.latitude}|${location.longitude}`;
}

export function getCachedPanchang(
  date: Date,
  location: GeoLocation,
  options: PanchangOptions,
): DailyPanchangResult {
  const key = getCacheKey(date, location);
  const cached = cache.get(key);
  if (cached) return cached;

  const result = getDailyPanchang(date, location, options);
  cache.set(key, result);

  // Evict oldest if over limit
  if (cache.size > MAX_CACHED_DAYS) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }

  return result;
}
```

---

## 22. Constants & Reference Data

```typescript
// src/utils/constants.ts

// ── Span values (degrees) ─────────────────────────────
export const TITHI_SPAN = 12;
export const NAKSHATRA_SPAN = 360 / 27;           // 13.3333...
export const NAKSHATRA_PADA_SPAN = NAKSHATRA_SPAN / 4; // 3.3333...
export const YOGA_SPAN = 360 / 27;                // 13.3333...
export const KARANA_SPAN = 6;

// ── Inauspicious period slot assignments (0-indexed from sunrise) ──
// Index = day of week (0=Sunday, 6=Saturday)
export const RAHU_KALAM_SLOTS =  [7, 1, 6, 4, 5, 3, 2] as const;
export const YAMAGANDA_SLOTS =   [4, 3, 2, 1, 0, 6, 5] as const;
export const GULIKA_SLOTS =      [6, 5, 4, 3, 2, 1, 0] as const;

// ── English day names ─────────────────────────────────
export const ENGLISH_DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

// ── Element cycle sizes (for modular arithmetic) ──────
export const TOTAL_TITHIS = 30;
export const TOTAL_NAKSHATRAS = 27;
export const TOTAL_YOGAS = 27;
export const TOTAL_KARANAS = 60;

// ── Max elements per day (safety caps for daily mode loop) ──
export const MAX_DAILY_TITHIS = 3;       // 2 is normal max, 3 = safety
export const MAX_DAILY_NAKSHATRAS = 3;
export const MAX_DAILY_YOGAS = 3;
export const MAX_DAILY_KARANAS = 5;      // 3 is normal max, 5 = safety

// ── Binary search window sizes (hours) ────────────────
export const TITHI_SEARCH_HOURS = 36;
export const NAKSHATRA_SEARCH_HOURS = 36;
export const YOGA_SEARCH_HOURS = 36;
export const KARANA_SEARCH_HOURS = 18;
```

---

## 23. Implementation Phases & Timeline

| Phase | What | Outputs | Validates | Time |
|-------|------|---------|-----------|------|
| **1** | Utils: `angle.ts`, `timezone.ts`, `validation.ts`, `constants.ts` | Unit tests for all utils | normalize360, midnight conversion, input guards | 0.5 day |
| **2** | Astronomy: `ayanamsa.ts`, `sun.ts`, `moon.ts`, `sunrise.ts` | Ayanamsa tests vs Swiss Ephemeris. Sunrise tests vs DrikPanchang ±2 min for 3 cities | Foundation is correct | 2 days |
| **3** | Cache: `cache.ts` + `search.ts` (binary search) | Cache hit/miss tests. Search precision tests with mock functions | Performance infrastructure works | 1 day |
| **4** | Core: `tithi.ts` + `getInstantPanchang` | Tithi name exact match for 5 fixtures | First working Panchang output | 1 day |
| **5** | Core: `nakshatra.ts`, `yoga.ts`, `karana.ts` | All 5 Panchangam elements match DrikPanchang | Core elements complete | 1.5 days |
| **6** | Core: `vara.ts`, `inauspicious.ts`, `muhurta.ts`, `masa.ts` | Rahu Kalam ±3 min. Abhijit Muhurta ±3 min | All elements done | 1 day |
| **7** | Orchestrator: `panchang.ts` daily mode + multi-element walker | Integration tests: 15+ fixtures pass. Multi-element days validated | Daily mode works end-to-end | 2 days |
| **8** | i18n: `en.ts`, `sa.ts`, `hi.ts`, `resolver.ts` | Sanskrit names verified against authoritative texts | Translations correct | 0.5 day |
| **9** | Build: `tsup.config.ts`, dual ESM/CJS, `.gitignore`, `.npmignore` | `npm pack --dry-run` clean. ESM + CJS smoke tests | Package structure correct | 0.5 day |
| **10** | Hermes: `hermes-check.sh`, CI pipeline | Bytecode compiles. CI green on Node 18/20/22 | Production CI ready | 0.5 day |
| **11** | Link into dharmSetu: Metro config, two-pass rendering hook | Full Panchang renders on physical Android device | Real-world validation | 1 day |
| **12** | Performance: benchmark tests, cache tuning, profiling on device | Meet budget-Android targets. Benchmark regression tests | Performance acceptable | 1 day |
| **13** | Docs: README, CONTRIBUTING, JSDoc on public API | README has usage examples, API reference, compatibility notes | Community-ready | 0.5 day |
| **14** | Publish: changesets, `npm publish 0.1.0` | Package live on npm. Fresh `npm install` smoke test passes | Shipped |0.5 day |

**Total: ~13 days of focused work.**

---

## 24. README Template

```markdown
# panchang-ts

Pure TypeScript Hindu Panchang (almanac) calculations. Zero native dependencies.
Works offline in React Native (Hermes), Node.js, and browsers.

## Features

- **10 Panchang elements:** Tithi, Nakshatra, Yoga, Karana, Vara, Sunrise/Sunset,
  Rahu Kalam, Gulika Kalam, Yamaganda, Abhijit Muhurta
- **Daily mode:** Shows all element transitions in a sunrise-to-sunrise day
  (e.g. two Tithis if transition happens mid-day)
- **Instant mode:** Element active at an exact moment (for birth charts, muhurta)
- **3 ayanamsa systems:** Lahiri (default), B.V. Raman, KP
- **3 languages:** English, Sanskrit (Devanagari), Hindi
- **React Native compatible:** Pure JS math, no native modules, tested on Hermes
- **Fast:** 60–100ms for names-only mode on budget Android phones
- **Typed:** Full TypeScript types for every result

## Install

\`\`\`bash
npm install panchang-ts
\`\`\`

## Quick Start

\`\`\`typescript
import { getDailyPanchang } from 'panchang-ts';

const result = getDailyPanchang(
  new Date(2025, 0, 14),                     // January 14, 2025
  { latitude: 18.5204, longitude: 73.8567 }, // Pune, India
  { timezone: 330 }                          // IST = UTC+5:30 = 330 minutes
);

console.log(result.tithis[0].name);          // "Krishna Chaturdashi"
console.log(result.nakshatras[0].name);      // "Mrigashira"
console.log(result.vara.name);               // "Mangalavara"
console.log(result.rahuKalam);               // { start: Date, end: Date }
\`\`\`

## Reading Output Times

All `Date` objects in the daily result are offset-adjusted for the requested timezone.
**Read time components via `getUTC*` methods:**

\`\`\`typescript
const sunrise = result.sunrise;
const hours = sunrise.getUTCHours();     // 7
const minutes = sunrise.getUTCMinutes(); // 4
// → Sunrise at 07:04 local time
\`\`\`

Do NOT use `.getHours()` — that uses your system timezone, which may differ.

## API Reference

### `getDailyPanchang(date, location, options)`
Full Panchang for a sunrise-to-sunrise Hindu day. Returns element arrays
with transition times.

### `getInstantPanchang(date, location, options?)`
Panchang at a single UTC moment. Returns one element per category.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timezone` | `number \| string` | required | UTC offset in minutes (330 for IST) |
| `ayanamsa` | `'lahiri' \| 'raman' \| 'krishnamurti'` | `'lahiri'` | Ayanamsa system |
| `language` | `'en' \| 'sa' \| 'hi'` | `'en'` | Language for element names |
| `computeEndTimes` | `boolean` | `true` | Set `false` for ~5x faster computation |
| `precision` | `'standard' \| 'high'` | `'standard'` | Binary search precision |

## React Native Usage

Works with Expo and bare React Native (Hermes engine). On Hermes, always pass
`timezone` as a number — IANA timezone strings require `Intl` which Hermes
doesn't fully support.

For fast rendering, use two-pass computation:

\`\`\`typescript
// Pass 1: instant (show names)
const fast = getDailyPanchang(date, loc, { timezone: 330, computeEndTimes: false });

// Pass 2: background (compute end-times)
InteractionManager.runAfterInteractions(() => {
  const full = getDailyPanchang(date, loc, { timezone: 330 });
  setState(full);
});
\`\`\`

## Accuracy

Validated against DrikPanchang.com for 15+ date/city combinations.
- Sunrise/sunset: ±2 minutes
- Element names: exact match
- Element end-times: ±5 minutes
- Ayanamsa: ±0.005° vs Swiss Ephemeris

## License

MIT
\`\`\`

---

*This document is the complete implementation specification for panchang-ts v0.1.0.*
*Every type, function, formula, config file, test, and deployment step is here.*
*Build it phase by phase, validate each phase against DrikPanchang, and ship.*
