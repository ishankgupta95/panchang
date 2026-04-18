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

| Phase | What | Status |
|-------|------|--------|
| **1** | Utils: `angle.ts`, `timezone.ts`, `validation.ts`, `constants.ts` | ✅ DONE |
| **2** | Astronomy: `ayanamsa.ts`, `sun.ts`, `moon.ts`, `sunrise.ts` | ✅ DONE |
| **3** | Cache: `cache.ts` + `search.ts` (binary search) | ✅ DONE |
| **4** | Core: `tithi.ts` + `getInstantPanchang` | ✅ DONE |
| **5** | Core: `nakshatra.ts`, `yoga.ts`, `karana.ts` | ✅ DONE |
| **6** | Core: `vara.ts`, `inauspicious.ts`, `muhurta.ts`, `masa.ts` | ✅ DONE |
| **7** | Orchestrator: `panchang.ts` daily mode + multi-element walker | ✅ DONE |
| **8** | i18n: `en.ts`, `sa.ts`, `hi.ts`, `resolver.ts` | ✅ DONE |
| **9** | Build: `tsup.config.ts`, dual ESM/CJS | ✅ DONE |
| **10** | Hermes: `hermes-check.sh`, CI pipeline | ✅ DONE |
| **11** | Link into dharmSetu: Metro config, two-pass rendering hook | ✅ DONE |
| **12** | Performance: benchmark tests, cache tuning | ✅ DONE |
| **13** | Docs: README, JSDoc on public API | ✅ DONE |
| **14** | Publish: `npm publish` → v0.2.2 live on npm | ✅ DONE |

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

*Phases 1–14 (original build) and Phase 13 (missing essentials) are complete.*
*panchang-ts is live on npm at v0.2.2 with 133 passing tests.*
*Phases 14–17 below define the feature expansion roadmap.*

---

## Phase 13 — Missing Panchang Essentials ✅ COMPLETE

All Phase 13 features are implemented and shipped in v0.2.x.

---

### Step 13-1 — Chandra Masa (Lunar Month) + Adhika Masa

**What:** The Hindu calendar is lunisolar. The lunar month name (Chaitra, Vaishakha, …) is the primary calendar identifier, more fundamental than the solar month already implemented.

**Algorithm:**
- Moon–Sun elongation gives current position in the lunar month
- Estimate Sun's sidereal longitude at the most recent Amavasya (new moon):
  `daysElapsed = elongation / 360 × 29.5306`
  `sunAtNewMoon = (siderealSun − daysElapsed / 365.25 × 360 + 36000) mod 360`
- Solar month at new moon = `floor(sunAtNewMoon / 30)` → 1:1 map to lunar month name
- Lunar month names (index 0–11): Chaitra, Vaishakha, Jyeshtha, Ashadha, Shravana,
  Bhadrapada, Ashwin, Kartika, Margashirsha, Pausha, Magha, Phalguna

**Adhika Masa detection:**
- Estimate Sun's longitude at the NEXT Amavasya (≈ 29.53 − daysElapsed days away)
- If `solarMonthAtPrevNewMoon === solarMonthAtNextNewMoon` → both new moons in the same
  solar month → current month is **Adhika** (leap)

**Purnimanta system (North India):**
- If Shukla Paksha: Purnimanta month name = Amanta month name (same)
- If Krishna Paksha: Purnimanta month name = next Amanta month name
  `purnimantaIndex = (amatnaIndex + 1) % 12`

**New type:**
```ts
interface ChandraMasaInfo {
  index: number;           // 0 = Chaitra … 11 = Phalguna (Amanta)
  name: string;            // translated name
  isAdhika: boolean;       // true = extra/leap month
  purnimantaIndex: number; // index in Purnimanta system
  purnimantaName: string;  // name in Purnimanta system
}
```

**Files:**
- Create `src/core/chandramasa.ts`
- Add `chandraMasaNames` to `src/i18n/types.ts`, `en.ts`, `sa.ts`
- Add `ChandraMasaInfo` to `src/types/elements.ts`
- Add `resolveChandraMasaName()` to `src/i18n/resolver.ts`

---

### Step 13-2 — Vikram Samvat & Shaka Samvat (Hindu Year Eras)

**What:** The Hindu year number. Every printed panchang shows this at the top.

**Algorithm:**
- Vikram Samvat new year = Chaitra Shukla Pratipad ≈ late March / April
- VS = Gregorian year + 57 (April–December)
- VS = Gregorian year + 56 (January–March)
- Shaka Samvat: same new year point, offset from 78 CE
  - Shaka = Gregorian year − 77 (April–December)
  - Shaka = Gregorian year − 78 (January–March)

**New type:**
```ts
interface SamvatInfo {
  vikramSamvat: number;
  shakaSamvat: number;
}
```

**Files:**
- Create `src/core/samvat.ts`
- Add `SamvatInfo` to `src/types/elements.ts`

---

### Step 13-3 — Chandra Rashi + Surya Nakshatra

**What:** Two simple derivations from already-computed longitudes.

- **Chandra Rashi:** `floor(siderealMoon / 30)` = Moon's zodiac sign index (0–11)
- **Surya Nakshatra:** `floor(siderealSun / (360/27))` = Sun's nakshatra index (0–26)

**New type:**
```ts
interface RashiInfo {
  index: number;  // 0 = Mesha … 11 = Meena
  name: string;
}
```

Surya Nakshatra reuses the existing `NakshatraInfo` type (without `pada`/`endTime`).

**Files:**
- Create `src/core/rashi.ts` (exports `computeChandraRashi`, `computeSuryaNakshatra`)
- Rashi names reuse existing `masaNames` (same 12 sidereal signs)

---

### Step 13-4 — Brahma Muhurta

**What:** The auspicious window 96–48 minutes before sunrise (2 muhurtas). Present in every panchang app.

**Algorithm:**
- muhurtaDuration = dayDuration / 30 (approximate; typically ≈ 48 min)
- Start: `sunrise − 2 × muhurtaDuration`
- End:   `sunrise − 1 × muhurtaDuration`

**Files:**
- Add `computeBrahmaMuhurta(sunrise: Date, sunset: Date): TimePeriod` to `src/core/muhurta.ts`

---

### Step 13-5 — Choghadiya

**What:** Divides daytime and nighttime each into 8 equal slots, each named and rated. Widely used in Indian calendar apps for activity scheduling.

**Algorithm:**
- 7 choghadiya names cycle: Udveg(0), Char(1), Labh(2), Amrit(3), Kaal(4), Shubh(5), Rog(6)
- Quality: Amrit/Shubh/Labh = auspicious; Char = neutral; Kaal/Rog/Udveg = inauspicious
- Day starting index by weekday (Sun=0 … Sat=6): `[0, 3, 6, 2, 5, 1, 4]`
- Night starting index by weekday:                `[5, 1, 4, 6, 0, 3, 2]`
- Slot i: `start = reference + i × (duration / 8)`, name = `(startIndex + i) % 7`

**New types:**
```ts
type ChoghadiyaQuality = 'auspicious' | 'inauspicious' | 'neutral';

interface ChoghadiyaSlot extends TimePeriod {
  index: number;
  name: string;
  quality: ChoghadiyaQuality;
}

interface ChoghadiyaInfo {
  day: ChoghadiyaSlot[];    // 8 slots (sunrise → sunset)
  night: ChoghadiyaSlot[];  // 8 slots (sunset → next sunrise)
}
```

**Files:**
- Create `src/core/choghadiya.ts`
- Add `choghadiyaNames` to i18n files

---

### Step 13-6 — Hora (Planetary Hours)

**What:** 24 planetary hours per day (12 daytime + 12 nighttime), each ruled by a planet in Chaldean order. Used for muhurta selection.

**Algorithm:**
- Chaldean order: Sun(0), Venus(1), Mercury(2), Moon(3), Saturn(4), Jupiter(5), Mars(6)
- First daytime hora planet by weekday: `[0, 3, 6, 2, 5, 1, 4]`
- Daytime: 12 equal horas (sunrise → sunset), each = dayDuration / 12
- Nighttime: 12 equal horas (sunset → next sunrise), each = nightDuration / 12
- Planet for hora i: `(firstPlanetIndex + i) % 7`

**New types:**
```ts
interface HoraSlot extends TimePeriod {
  planet: string;       // "Sun", "Moon", etc.
  planetIndex: number;  // 0–6 in Chaldean order
}

interface HoraInfo {
  day: HoraSlot[];    // 12 slots
  night: HoraSlot[];  // 12 slots
}
```

**Files:**
- Create `src/core/hora.ts`
- Add `grahaNames` (7 planet names in Chaldean order) to i18n files

---

### Step 13-7 — Moonrise / Moonset

**What:** Analogous to sunrise/sunset but for the Moon. Required for rituals; displayed in every printed panchang.

**Algorithm:**
- Use `SearchRiseSet(Body.Moon, observer, +1/−1, startTime, 2)` from astronomy-engine
- Returns `null` (not throws) when no moonrise/moonset within search window — unlike sunrise, missing moonrise on a given calendar day is normal

**New exports:**
```ts
getMoonrise(searchFromUtc: Date, location: GeoLocation): Date | null
getMoonset(searchFromUtc: Date, location: GeoLocation): Date | null
```

**Fields added to `DailyPanchangResult`:**
```ts
moonrise: Date | null;
moonset: Date | null;
```

**Files:**
- Create `src/astronomy/moonrise.ts`

---

### Step 13-8 — Panchaka Detection

**What:** Flag when the Moon is in the last 5 nakshatras (Dhanishta 3rd–4th pada through Revati). Considered inauspicious for certain activities.

**Algorithm:**
- Panchaka zone: `siderealMoon >= 300.0°`
  (= Dhanishta 3rd pada start: `22 × (360/27) + (360/27)/2 ≈ 300°`)
- `isPanchaka = siderealMoon >= 300.0`

**New field on `DailyPanchangResult` and `InstantPanchangResult`:**
```ts
panchaka: boolean;
```

**Files:**
- Create `src/core/panchaka.ts`

---

### Step 13-9 — Wire All New Features + Update Public Exports

**What:** Integrate every new computation into `getDailyPanchang` / `getInstantPanchang`, extend result types, and expose from the public API.

**Additions to `DailyPanchangResult`:**
```ts
chandramasa: ChandraMasaInfo;
samvat: SamvatInfo;
chandraRashi: RashiInfo;
suryaNakshatra: { index: number; name: string };
brahmaMuhurta: TimePeriod;
choghadiya: ChoghadiyaInfo;
hora: HoraInfo;
moonrise: Date | null;
moonset: Date | null;
panchaka: boolean;
```

**Additions to `InstantPanchangResult`:**
```ts
chandramasa: ChandraMasaInfo;
samvat: SamvatInfo;
chandraRashi: RashiInfo;
suryaNakshatra: { index: number; name: string };
panchaka: boolean;
```

**Files to modify:**
- `src/types/elements.ts` — add `ChandraMasaInfo`, `SamvatInfo`, `RashiInfo`, `ChoghadiyaSlot`, `ChoghadiyaInfo`, `HoraSlot`, `HoraInfo`
- `src/types/panchang.ts` — extend both result interfaces
- `src/core/panchang.ts` — import and call all new compute functions; convert new Date fields with `toLocal`
- `src/types/index.ts` — re-export new types
- `src/index.ts` — export new functions (`getMoonrise`, `getMoonset`, etc.) and new types
- `src/i18n/types.ts`, `en.ts`, `sa.ts` — add `chandraMasaNames`, `grahaNames`, `choghadiyaNames`

---

### Execution Order Summary

| Step | Feature | New file(s) | Status |
|------|---------|-------------|--------|
| 13-1 | Chandra Masa + Adhika Masa | `core/chandramasa.ts` | ✅ DONE |
| 13-2 | Vikram & Shaka Samvat | `core/samvat.ts` | ✅ DONE |
| 13-3 | Chandra Rashi + Surya Nakshatra | `core/rashi.ts` | ✅ DONE |
| 13-4 | Brahma Muhurta | extends `core/muhurta.ts` | ✅ DONE |
| 13-5 | Choghadiya | `core/choghadiya.ts` | ✅ DONE |
| 13-6 | Hora | `core/hora.ts` | ✅ DONE |
| 13-7 | Moonrise / Moonset | `astronomy/moonrise.ts` | ✅ DONE |
| 13-8 | Panchaka | `core/panchaka.ts` | ✅ DONE |
| 13-9 | Wire + Exports | `types/`, `core/panchang.ts`, `index.ts` | ✅ DONE |

---

## Feature Expansion Plan (v4) — Closing the Gap & Surpassing Competition

> **Context:** Derived from a feature-by-feature comparison of `panchang-ts` against
> `@ishubhamx/panchangam-js` (v2.1.x). The goal is to close the feature gap,
> surpass the competition, and build toward the needs of the **dharmSetu** companion app.

---

### Current Competitive Position

#### Unique advantages of panchang-ts (panchangam-js does NOT have):

| Feature | Notes |
|---------|-------|
| 3 ayanamsa systems (Lahiri, Raman, KP) | panchangam-js has no ayanamsa config |
| 3 languages (en, sa, hi) | panchangam-js has partial/hardcoded name arrays |
| Chandra Masa + Adhika (leap month) detection | Not in panchangam-js |
| Purnimanta system (North-Indian month naming) | Not in panchangam-js |
| Vikram Samvat + Shaka Samvat | Not in panchangam-js |
| Saura Masa (solar month) | Not in panchangam-js |
| Panchaka detection | Not in panchangam-js |
| Daily mode vs Instant mode | panchangam-js only has `getPanchangam()` |
| `computeEndTimes: false` (5× faster names-only) | Not in panchangam-js |
| `precision` option (standard vs high) | Not in panchangam-js |
| Typed `PanchangError` with error codes | Not in panchangam-js |
| Low-level utility exports | Not in panchangam-js |
| Two-pass rendering pattern for React Native | Not in panchangam-js |
| Completion percentage per element | Not in panchangam-js |
| Paksha info (Shukla/Krishna) in TithiInfo | Not in panchangam-js |
| Karana end times + fixed/movable typing | panchangam-js has karana but no end times |
| `nextSunrise`, `dayDurationMinutes`, `nightDurationMinutes` | Not in panchangam-js |
| Ayanamsa value (degrees) exposed in result | Not in panchangam-js |
| Sidereal Sun + Moon longitudes exposed | Not as cleanly in panchangam-js |

#### Feature parity (both libraries have):

- Tithi, Nakshatra, Yoga, Karana, Vara (core Pancha Anga)
- Sunrise / Sunset, Moonrise / Moonset
- Tithi, Nakshatra, Yoga end times
- Elevation support in location
- Abhijit Muhurta, Brahma Muhurta
- Rahu Kalam, Gulika Kalam, Yamaganda
- Choghadiya (8 day + 8 night, named + rated)
- Hora (planetary hours)
- Chandra Rashi (Moon sign), Surya Nakshatra
- Timezone offset parameter
- React Native / Hermes compatible

---

## Phase 14 — dharmSetu MVP Features

### Step 14-1 — Special Yogas (Auspicious Day Detection)

**What:** Detect special auspicious yogas — combinations of Tithi + Nakshatra + Vara:
- **Amrit Siddhi Yoga** — specific Tithi × Vara combinations (lookup table)
- **Sarvartha Siddhi Yoga** — specific Nakshatra × Vara combinations (lookup table)
- **Ravi Pushya Yoga** — Sunday + Pushya Nakshatra
- **Guru Pushya Yoga** — Thursday + Pushya Nakshatra

**Why:** Commonly checked when selecting muhurtas for important events. Drik Panchang shows them prominently. panchangam-js has this, we don't.

**Implementation:**
- Create `src/core/specialYogas.ts`
- Amrit Siddhi: 7×30 (Vara × Tithi) boolean lookup table
- Sarvartha Siddhi: 7×27 (Vara × Nakshatra) boolean lookup table
- Ravi/Guru Pushya: check vara index + nakshatra index
- Return: `SpecialYogaInfo[]` array

**Types:**
```ts
interface SpecialYogaInfo {
  name: string;
  type: 'amrit_siddhi' | 'sarvartha_siddhi' | 'ravi_pushya' | 'guru_pushya';
}
```

**Depends on:** Tithi, Nakshatra, Vara (all implemented).
**Effort:** Small. Pure lookup tables.

---

### Step 14-2 — Dur Muhurta (Inauspicious Windows)

**What:** Two inauspicious periods of ~48 minutes each per day. Position shifts based on Vara.

**Why:** Commonly shown alongside Rahu Kalam. Users avoid starting important work during Dur Muhurta. panchangam-js has this.

**Algorithm:**
- Each muhurta = (sunset - sunrise) / 30 duration
- Dur Muhurta positions are fixed per Vara (lookup table of muhurta indices):
  - Sunday: 26th and 29th muhurta
  - Monday: 22nd and 27th
  - Tuesday: 18th and 25th
  - Wednesday: 14th and 23rd
  - Thursday: 10th and 21st
  - Friday: 6th and 19th
  - Saturday: 2nd and 17th
- Calculate start/end from sunrise + (index × muhurta_duration)

**Implementation:**
- Create `src/core/durMuhurta.ts`
- Return: `[TimePeriod, TimePeriod]` (always 2 entries)

**Depends on:** Sunrise, Sunset (implemented).
**Effort:** Small. Vara-based offset table.

---

### Step 14-3 — Festival Detection

**What:** Auto-detect Hindu festivals based on Tithi + Chandra Masa + special rules.

**Why:** #1 feature dharmSetu users will expect. panchangam-js detects festivals automatically.

**Implementation:**
- Create `src/core/festivals.ts` with a registry of festival rules
- Each rule: `(tithi, masa, nakshatra, vara, ...) => FestivalInfo | null`
- Start with 20–30 major pan-Indian festivals:
  - Diwali = Kartika, Krishna Amavasya
  - Ekadashi = any month, Shukla/Krishna Ekadashi (tithi 11)
  - Rama Navami = Chaitra, Shukla Navami
  - Maha Shivaratri = Magha, Krishna Chaturdashi
  - Holi = Phalguna, Purnima
  - Ganesh Chaturthi = Bhadrapada, Shukla Chaturthi
  - Navratri = Ashvina, Shukla Pratipada through Navami
  - Makar Sankranti = Sun enters Makara rashi
  - etc.
- Return array (multiple festivals can fall on one day)
- Must respect language setting (en/sa/hi)
- Add festival names to i18n files

**Types:**
```ts
interface FestivalInfo {
  name: string;           // "Diwali", "दीपावली"
  type: 'major' | 'minor' | 'ekadashi' | 'pradosha' | 'sankranti';
  description?: string;
}
```

**Depends on:** Chandra Masa (implemented), Tithi (implemented).
**Effort:** Medium. Lookup-table heavy, but edge cases around Adhika masa and regional variations.

---

### Step 14-4 — Wire Phase 14 Features + Update Exports

**What:** Integrate all Phase 14 features into `getDailyPanchang` / `getInstantPanchang`.

**Additions to `DailyPanchangResult`:**
```ts
specialYogas: SpecialYogaInfo[];
durMuhurta: [TimePeriod, TimePeriod];
festivals: FestivalInfo[];
```

**Additions to `InstantPanchangResult`:**
```ts
specialYogas: SpecialYogaInfo[];
festivals: FestivalInfo[];
```

**Files to modify:**
- `src/types/elements.ts` — add `SpecialYogaInfo`, `FestivalInfo`
- `src/types/panchang.ts` — extend both result interfaces
- `src/core/panchang.ts` — import and call new compute functions
- `src/index.ts` — export new types and functions
- `src/i18n/` — add festival names, special yoga names

---

## Phase 15 — Regional Completeness

### Step 15-1 — Gowri Panchangam (Gowri Nalla Neram)

**What:** 8 time slots for day + 8 for night, each assigned a name and auspiciousness rating. Popular in Tamil Nadu / South India.

**Why:** panchangam-js includes this. Drik Panchang shows it for South Indian cities. Important for dharmSetu's South Indian user base.

**Implementation:**
- Create `src/core/gowri.ts`
- Similar structure to Choghadiya — divide day into 8 equal slots, night into 8 equal slots
- Assignment order differs from Choghadiya; Gowri uses a fixed rotation starting from Vara
- Day slot names: Udyog, Amrit, Roga, Laabh, Shubh, Kaal, Dhan, Chal
- Night: same names, different starting rotation
- Reuse `ChoghadiyaSlot` pattern

**Types:**
```ts
interface GowriSlot extends TimePeriod {
  index: number;
  name: string;            // "Udyog", "Amrit", etc.
  quality: 'auspicious' | 'inauspicious' | 'neutral';
}

interface GowriInfo {
  day: GowriSlot[];    // 8 slots
  night: GowriSlot[];  // 8 slots
}
```

**Depends on:** Sunrise, Sunset, nextSunrise, Vara (all implemented).
**Effort:** Small-Medium. Similar to Choghadiya implementation.

---

### Step 15-2 — Wire Phase 15 Features + Update Exports

**Additions to `DailyPanchangResult`:**
```ts
gowriPanchangam: GowriInfo;
```

**Files to modify:**
- `src/types/elements.ts` — add `GowriSlot`, `GowriInfo`
- `src/types/panchang.ts` — extend result interfaces
- `src/core/panchang.ts` — import and call new compute functions
- `src/index.ts` — export new types
- `src/i18n/` — add Gowri slot names

---

## Phase 16 — Validation Hardening

### Step 16-1 — Expanded Validation Suite (200+ Days)

**What:** Expand from 15+ date/city combinations to 200+ consecutive days validated against Drik Panchang.

**Why:** panchangam-js claims 200 consecutive days (Sep 2025–Apr 2026) validated with 100% accuracy, plus 25+ year regression tests.

**Implementation:**
- Collect Drik Panchang data for 200 days for Pune, Delhi, Chennai, Mumbai, Bangalore
- Create `tests/validation/` directory with JSON fixtures
- Vitest parametric tests comparing output against ground truth
- Add long-range dates: 2030, 2035, 2040, 2045, 2050 for regression confidence
- Tolerances:
  - Sunrise/sunset: ±2 min
  - Element end times: ±5 min
  - Element names: exact match

**Effort:** Medium-Large. Data collection is the bottleneck.

---

## Phase 17 — Jyotish Expansion ✅ DONE

> **Status (2026-04-12):** All Phase 17 steps shipped and validated. Phase 18
> closed the quality gate (Rahu formula fix, planetary positions Drik-validated
> at Δ<0.03°, dasha validated via 97 math-invariant assertions plus a real-chart
> check seeded from a Drik-verified Moon longitude).

### Step 17-1 — Planetary Positions (9 Graha) ✅ DONE

**What:** Sidereal longitude, Rashi (sign), degree for: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn.

**Why:** panchangam-js returns `planetaryPositions` with rashi, rashiName, degree, longitude for all 7 planets.

**Implementation:**
- Extend `src/astronomy/` — we already compute Sun and Moon sidereal longitudes
- Use `astronomy-engine`'s `EclipticLongitude()` for Mars, Mercury, Jupiter, Venus, Saturn
- Apply ayanamsa correction (already have `getAyanamsa()`)
- `floor(siderealLongitude / 30)` → Rashi index
- `siderealLongitude % 30` → degree within Rashi
- Behind an `includePlanets: true` option flag, disabled by default (compute cost)

**Types:**
```ts
interface GrahaPosition {
  planet: string;
  siderealLongitude: number;
  rashi: RashiInfo;
  degreeInRashi: number;
  nakshatra: NakshatraInfo;
  isRetrograde?: boolean;   // for Mars–Saturn
}

interface PlanetaryPositions {
  sun: GrahaPosition;
  moon: GrahaPosition;
  mars: GrahaPosition;
  mercury: GrahaPosition;
  jupiter: GrahaPosition;
  venus: GrahaPosition;
  saturn: GrahaPosition;
}
```

**Depends on:** astronomy-engine (dependency), getAyanamsa (implemented).
**Effort:** Medium. astronomy-engine calls are straightforward, testing accuracy for 5 additional planets is work.

---

### Step 17-2 — Chandra Balam (Moon Strength) ✅ DONE (via Phase 18-2)

**What:** A calculation of Moon's strength based on its sign placement and other factors.

**Why:** panchangam-js includes it.

**Implementation:**
- Lookup table based on Moon's Rashi
- Some traditions use more complex calculations

**Depends on:** Chandra Rashi (implemented).
**Effort:** Small.

---

### Step 17-3 — Vimshottari Dasha System ✅ DONE

**What:** The 120-year planetary period system. Given a birth nakshatra and Moon's degree within it, calculate:
- Current Mahadasha (major period) + ruling planet
- Dasha balance (time remaining)
- Full 120-year cycle with start/end dates
- Antardasha (sub-periods within each Mahadasha)

**Why:** panchangam-js includes full Vimshottari Dasha with mahadasha, antardasha, and dasha balance.

**Algorithm:**
- Dasha cycle: Ketu(7yr) → Venus(20yr) → Sun(6yr) → Moon(10yr) → Mars(7yr) → Rahu(18yr) → Jupiter(16yr) → Saturn(19yr) → Mercury(17yr) = 120 years
- Birth nakshatra → starting dasha lord (each nakshatra has a ruling planet)
- Moon's degree within nakshatra → elapsed fraction → dasha balance at birth
- From birth date + balance, compute all subsequent dasha periods
- Antardasha: subdivide each mahadasha proportionally among 9 planets

**Important:** Requires a birth date/time as input — different from daily panchang.

**Implementation:**
- Separate export: `computeVimshottariDasha(birthNakshatra, moonDegreeInNakshatra, birthDate)`
- Consider placing in a separate `src/jyotish/` directory

**Depends on:** Nakshatra calculations (implemented).
**Effort:** Medium-Large. Math is well-defined but antardasha subdivision and date arithmetic needs careful testing.

---

### Step 17-5 — Wire Phase 17 Features + Update Exports ✅ DONE (via Phase 18-6)

**Additions to `DailyPanchangResult` (when `includePlanets: true`):**
```ts
planetaryPositions?: PlanetaryPositions;
chandraBalam?: ChandraBalamInfo;
```

**New standalone exports:**
```ts
import { computeVimshottariDasha } from 'panchang-ts';
```

**Files to create/modify:**
- `src/jyotish/planets.ts` — planetary position calculations
- `src/jyotish/chandraBalam.ts` — Moon strength
- `src/jyotish/dasha.ts` — Vimshottari Dasha
- `src/jyotish/index.ts` — barrel export
- `src/types/jyotish.ts` — all Jyotish-specific types
- `src/types/options.ts` — add `includePlanets` flag
- `src/index.ts` — export new modules

**Phase 17 completion status:**

| Step | Feature | File(s) | Status |
|------|---------|---------|--------|
| 17-1 | Planetary Positions (9 Graha incl. Rahu/Ketu) | [src/jyotish/planets.ts](src/jyotish/planets.ts) | ✅ DONE (Rahu fixed in 18-1; Drik validation pending in 18-3) |
| 17-2 | Chandra Balam | [src/jyotish/chandraBalam.ts](src/jyotish/chandraBalam.ts) | ✅ DONE (via 18-2) |
| 17-3 | Vimshottari Dasha | [src/jyotish/dasha.ts](src/jyotish/dasha.ts) | ✅ DONE (ergonomic wrapper added in 18-5; Drik validation pending in 18-4) |
| 17-5 | Wire + exports | [src/index.ts](src/index.ts) | ✅ DONE (Chandra Balam wired via 18-6) |

---

## Phase 18 — Jyotish Completion & Quality ⬜ NOT STARTED

> **Goal:** Bring jyotish to v1-grade quality. Fix correctness issues in planetary
> code, close the feature gap (Chandra Balam), validate against Drik Panchang,
> and review jyotish API ergonomics before they're frozen by a v1 tag.
>
> **Why now:** Phase 17 delivered feature *existence*, not feature *trust*. v1
> implies "API is stable and outputs are verified." Today the jyotish layer has
> zero external validation and at least one formula that reads as incomplete.

### Step 18-1 — Fix / Replace True-Node Rahu Formula

**What:** The true-Rahu correction in [src/jyotish/planets.ts:51-81](src/jyotish/planets.ts#L51-L81) applies a Meeus-style perturbation series but one term degenerates to a constant:

```ts
-0.1500 * Math.sin((0 * F_rad) + (Math.PI * 2 * (357.5 / 360)))
```

The `0 * F_rad` zeroes out the argument's variable part, producing a fixed ~0.0065° contribution regardless of date. That's not a correct Meeus node correction — it's a stub.

**Why:** Rahu/Ketu longitude feeds every downstream jyotish computation that uses them (dasha analyses, transit checks, remedy selection). Shipping a half-correct formula under a "true node" label is worse than shipping a documented mean-node fallback.

**Implementation — pick one:**
- **Option A (recommended):** Replace with Meeus *mean* node (Chapter 47):
  ```ts
  Ω = 125.04455501 − 1934.13626197·T + 0.00207765·T² + 2.139e-6·T³
  ```
  Accuracy: typically ±0.5° from true node (worst-case ~±2° near perturbation peaks), adequate for Vedic astrology which traditionally uses mean node anyway. Document this in JSDoc as `meanNode` (not `trueNode`).
- **Option B:** Use astronomy-engine's `SearchMoonNode` to locate the actual ascending node crossing and refine with a Newton step. Accuracy: arc-seconds. Cost: ~2× the compute.
- **Option C:** Port the full Meeus periodic corrections series (45 terms). High accuracy, high surface-area for bugs.

**Recommendation:** Option A. It's honest about the accuracy trade and matches standard Vedic practice (most traditions use mean node). If a user explicitly requests true-node accuracy later, add it as an opt-in `nodeType: 'mean' | 'true'` option.

**Depends on:** Nothing — pure refactor.
**Effort:** 1–2 hours (including updating tests and JSDoc).

---

### Step 18-2 — Chandra Balam (Moon Strength)

**What:** Implement the lookup declared in Phase 17 step 17-2. Given the native's janma rashi (birth Moon sign) and the current transit Moon rashi, return a strength classification.

**Why:** Phase 17 scoped it; panchangam-js includes it; it's one lookup away from being useful.

**Algorithm — classical Ashta Balam rule:**
From the janma rashi, positions 1, 3, 6, 7, 10, 11 are strong (Chandra Balam present);
positions 2, 4, 5, 8, 9, 12 are weak (Chandra Balam absent).
Some traditions soften 4 and 8 via a parihara (Tara Balam) adjustment — keep that as a follow-up.

**Implementation:**
- Create `src/jyotish/chandraBalam.ts`
- Export `computeChandraBalam(janmaRashiIndex: number, transitMoonRashiIndex: number): ChandraBalamInfo`
- Lookup table indexed by `(transit - janma + 12) % 12` returning `'strong' | 'weak'`
- Also emit the house number (1–12) and classical verdict string

**Types:**
```ts
interface ChandraBalamInfo {
  house: number;                       // 1–12
  quality: 'strong' | 'weak';
  englishName: string;                 // "Shubha" | "Ashubha"
  name: string;                        // i18n
}
```

**Wiring:**
- Add to `DailyPanchangResult` only when caller passes a `janmaRashi` option (opt-in; requires birth data)
- Export `computeChandraBalam` as standalone from [src/index.ts](src/index.ts)
- i18n strings in `en.ts`/`sa.ts`/`hi.ts`

**Depends on:** `computeChandraRashi` (implemented).
**Effort:** 2–3 hours.

---

### Step 18-3 — Drik-Validate Planetary Positions

**What:** Add `tests/fixtures/drikpanchang-planets.json` with 5–8 dates × 9 planets' sidereal longitude + rashi + nakshatra, sourced from Drik Panchang's "Planetary Positions" page.

**Why:** Today the entire jyotish layer has zero external validation. Panchang elements are Δ=0min against Drik; planetary positions are unverified. Before v1 we need to establish that planets match Drik within a publishable tolerance.

**Tolerances:**
- Sidereal longitude: ±0.1° for Sun/Moon (already Δ=0 via panchang checks)
- Sidereal longitude: ±0.25° for Mars–Saturn (astronomy-engine accuracy class)
- Sidereal longitude: ±2° for Rahu (mean node worst-case; typical match is ±0.5°)
- Rashi: exact match (integer index)
- Nakshatra: exact match (name)
- Retrograde flag: exact match

**Fixture shape:**
```jsonc
{
  "date": "2025-01-14T12:00:00Z",
  "ayanamsa": "lahiri",
  "expected": {
    "sun":     { "siderealLongitude": 270.23, "rashi": "Makara",  "nakshatra": "Uttara Ashadha", "retrograde": false },
    "moon":    { ... },
    "mars":    { ..., "retrograde": true },
    ...
    "rahu":    { ..., "retrograde": true },
    "ketu":    { ... }
  }
}
```

**Implementation:**
- Create `tests/validation/planetary-positions.test.ts`
- Iterate fixtures; assert each planet's longitude, rashi index, nakshatra name, retrograde flag
- Pick dates that exercise: retrograde Mercury, retrograde Mars, retrograde Saturn, a full-moon day, a new-moon day, one 2030 date for long-range drift

**Depends on:** 18-1 (Rahu formula decision — the tolerance depends on which option was chosen).
**Effort:** 3–4 hours (most of it Drik scraping).

---

### Step 18-4 — Drik-Validate Vimshottari Dasha

**What:** For 1–2 published example charts, verify `computeVimshottariDasha` returns the correct mahadasha sequence, current mahadasha, antardasha, and dasha balance at birth.

**Why:** Dasha math is deterministic given birth nakshatra + Moon's degree, so a single well-chosen fixture catches every class of bug (nakshatra-lord lookup, balance fraction, antardasha proportions, cycle wrap-around).

**Test cases to collect:**
1. A public historical figure with a widely-agreed birth chart (e.g. a classical text example). Validate all 9 mahadashas' start/end dates to within ±1 day.
2. A synthetic "birth at exact start of Ashwini nakshatra (Moon longitude = 0.0°)" case → dasha balance should equal exactly Ketu's 7-year allocation.
3. A synthetic "birth at very end of Revati (Moon longitude = 359.99°)" case → dasha balance should be ~0, first mahadasha ends almost immediately, second begins.

**Implementation:**
- Create `tests/validation/dasha.test.ts`
- Parametric assertions on `mahaDashas[i].lord`, `startDate`, `endDate` (±24 h)
- Check antardasha subdivision sums to the parent mahadasha duration (invariant test)

**Depends on:** 17-3.
**Effort:** 2–3 hours.

---

### Step 18-5 — Dasha API Ergonomics Review

**What:** Today `computeVimshottariDasha(birthDate, moonSiderealLon)` requires the caller to compute sidereal Moon longitude themselves. Decide whether to:
- (a) keep the low-level signature and document the two-step call,
- (b) add a higher-level convenience: `computeVimshottariDasha({ birthDate, location, ayanamsaType? })` that computes moonSid internally,
- (c) expose both — convenience wrapper + primitive.

**Why:** Once v1 ships, this signature is frozen. A later breaking change means v2. Better to get it right now.

**Recommendation:** Option (c). Keep the primitive `computeVimshottariDasha` as-is (low-level, composable, easy to test), and add `computeVimshottariDashaFromBirth({ birthDate, location, ayanamsaType })` as the ergonomic default. Document both.

**Implementation:**
- Add wrapper in [src/jyotish/dasha.ts](src/jyotish/dasha.ts)
- Export from [src/index.ts](src/index.ts)
- Update README

**Depends on:** 18-4 (validate before renaming / adding signatures).
**Effort:** 1 hour.

---

### Step 18-6 — Wire Chandra Balam + Update Exports

**What:** Once 18-2 exists, wire it in:

- Add optional `janmaRashi?: RashiInfo` input to `PanchangOptions`
- If provided, include `chandraBalam: ChandraBalamInfo` in `DailyPanchangResult`
- Export `computeChandraBalam` + `ChandraBalamInfo` type from [src/index.ts](src/index.ts)
- Add to README and type barrel

**Depends on:** 18-2.
**Effort:** 1 hour.

---

**Phase 18 completion table:**

| Step | Feature | File(s) | Effort | Status |
|------|---------|---------|--------|--------|
| 18-1 | Fix true-node Rahu → mean-node (documented) | [src/jyotish/planets.ts](src/jyotish/planets.ts) | 1–2h | ✅ DONE |
| 18-2 | Chandra Balam lookup (standalone export) | [src/jyotish/chandraBalam.ts](src/jyotish/chandraBalam.ts), [tests/unit/chandraBalam.test.ts](tests/unit/chandraBalam.test.ts) | 2–3h | ✅ DONE |
| 18-3 | Drik planetary validation | [tests/fixtures/drikpanchang-planets.json](tests/fixtures/drikpanchang-planets.json), [tests/validation/planetary-positions.test.ts](tests/validation/planetary-positions.test.ts) | 3–4h | ✅ DONE — 6 dates × 9 planets, Δ<0.03° on all longitudes |
| 18-4 | Dasha validation (math-invariant + Drik-verified Moon seed) | [tests/validation/dasha.test.ts](tests/validation/dasha.test.ts) | 2–3h | ✅ DONE — 97 assertions, boundary cases + cycle invariants + real-chart check |
| 18-5 | Dasha API ergonomics (add `computeVimshottariDashaFromBirth` wrapper) | [src/jyotish/dasha.ts](src/jyotish/dasha.ts), [tests/unit/dasha-from-birth.test.ts](tests/unit/dasha-from-birth.test.ts) | 1h | ✅ DONE |
| 18-6 | Wire Chandra Balam into daily + instant panchang (opt-in `janmaRashi`) | [src/types/options.ts](src/types/options.ts), [src/types/panchang.ts](src/types/panchang.ts), [src/core/panchang.ts](src/core/panchang.ts), [tests/integration/chandra-balam-wiring.test.ts](tests/integration/chandra-balam-wiring.test.ts) | 1h | ✅ DONE |

**Total Phase 18 effort:** ~1 focused engineering day.

---

## Phase 19 — v1 Release Preparation ⬜ NOT STARTED

> **Goal:** Ship `panchang-ts@1.0.0` with a stable, documented, externally-validated
> API. This is the semver commitment — after this tag, any breaking change
> requires v2.

### Step 19-1 — Festival Detection Drik Validation ✅ DONE

**What:** Added [tests/fixtures/drikpanchang-festivals.json](tests/fixtures/drikpanchang-festivals.json) with 12 Drik-verified festival entries (2025–2026 Delhi) and a festival-only `describe` block in [tests/validation/cross-verify.test.ts](tests/validation/cross-verify.test.ts). Covered: Holi, Ugadi, Rama Navami, Akshaya Tritiya, Raksha Bandhan (×2), Ganesh Chaturthi, Sharad Navaratri, Dussehra, Karva Chauth (×2), Hanuman Jayanti. 4828 tests pass (+12).

**Known limitation (to document in 19-4 README):** Our library uses tithi-at-sunrise. Festivals Drik computes via "tithi-at-midnight" (Krishna Janmashtami, Maha Shivaratri, Diwali/Lakshmi Puja) or Madhyahna-vyapini (Ganesh Chaturthi on edge years, Akshaya Tritiya 2026) or Kshaya-tithi handling (Ugadi 2026-03-19) will drift ±1 day from Drik's canonical date. These are intentionally omitted from fixtures and should be called out as a documented tradeoff.

---

### Step 19-2 — Tithi / Nakshatra End-Time Validation ✅ DONE

**What:** Extended 5 verified fixtures (2025-01-01, 2025-01-14, 2025-03-26, 2025-08-15 Delhi + 2025-04-12 Chennai) with optional `tithiEndHHMM` / `nakshatraEndHHMM` / `yogaEndHHMM` / `karanaEndHHMM` fields (format `"HH:MM"` or `"HH:MM+1"` for next-day). Added 4 conditional assertions per fixture in [tests/validation/cross-verify.test.ts](tests/validation/cross-verify.test.ts) with `parseEndMinutes` / `endMinutesFromDate` helpers. 4848 tests pass (+20).

**Observed drift vs Drik:** max 2.01 min across all 20 end-time assertions. Tolerance tightened from the planned ±10 min down to **±3 min**. Our Meeus Moon+Sun truncation drives sub-arc-minute longitude accuracy, which is what determines tithi (12°)/nakshatra (13°20′)/yoga (13°20′)/karana (6°) boundary timing.

---

### Step 19-3 — Public API Audit ✅ DONE

**What shipped:**
- **Naming convention**: ratified the existing mix (`get*` for simple retrievers + top-level entries; `compute*` for synthetic multi-field results) and documented it in the header of [src/index.ts](src/index.ts). No renames, no deprecation aliases, no churn.
- **`.d.ts` hygiene**: `grep @internal|TODO|FIXME` on `dist/index.d.ts` returns zero matches.
- **JSDoc coverage**: every one of the 21 public exports now has a JSDoc block with `@param` + `@returns` + at least one `@example`. Added to: `GRAHA_ABBR`, `PanchangError`, `PanchangErrorCode`, `computePlanetaryPositions`, `computeVimshottariDasha`, `computeVimshottariDashaFromBirth`, `computeChandraBalam`, `computeSunrise/Sunset`, `getMoonrise/Moonset`, `getSiderealSun/MoonLongitude`, `computeRahuKalam/Gulika/Yamaganda`, `computeAbhijitMuhurta/BrahmaMuhurta`, `computeGowriPanchangam`.
- **Types barrel**: confirmed [src/types/index.ts](src/types/index.ts) exports match what [src/index.ts](src/index.ts) re-exports and what JSDoc references.
- 4848 tests still pass. `dist/index.d.ts` grew 22.88 → 29.06 KB from added examples.

---

### Step 19-4 — README + Docs Sync ✅ DONE

**What shipped:**
- **Features section** — added Chandra Balam + `computeVimshottariDashaFromBirth` under the Jyotish bullet.
- **Low-level utilities** — added `computeVimshottariDashaFromBirth` and `computeChandraBalam` to the import list and worked examples (dasha-from-birth convenience form + Chandra Balam with 0-indexed rashi inputs).
- **Types section** — added `ChandraBalamInfo` to the Jyotish types `<details>` block.
- **Accuracy table** — rebuilt with 4,848-test claim, Drik-verified sidereal planetary positions (Sun–Saturn ≤0.02°, Rahu/Ketu mean-node ≤0.5° typical with ±2° tolerance), end-time precision (max 2.01 min observed, ±3 min tolerance, 20 assertions), and the 12-festival fixture (2025–2026).
- **Festival detection tradeoff section** — new subsection under Accuracy documenting the tithi-at-sunrise rule choice and the three Drik rule-classes where our output drifts ±1 day (tithi-at-midnight, madhyahna-vyapini, kshaya-tithi). Called out as a rule-choice tradeoff, not a bug.
- **JSDoc fix** — [src/jyotish/planets.ts:119-122](src/jyotish/planets.ts#L119-L122) example had capitalized keys (`p.Jupiter.rashiIndex`) that didn't match the lowercase `PlanetaryPositions` interface. Corrected to `p.jupiter.rashi.index` and re-emitted via `npm run build`.
- 4848 tests still pass. Build clean. `dist/index.d.ts` still zero `@internal`/`TODO`/`FIXME`.

---

### Step 19-5 — Seconds-Precision Cross-Verify ✅ DONE

**What shipped:**
- New suite [tests/validation/seconds-audit.test.ts](tests/validation/seconds-audit.test.ts) — 16 assertions (8 fixtures × sunrise+sunset) comparing our second-precise output against Drik's minute-midpoint (HH:MM:30).
- **Worst observed |Δ| = 29s** across the 16 measurements. Distribution: 9 of 16 are within ±15s; all within ±30s.
- Test tolerance set to **±45s** (absorbs future fixture additions + Drik's own minute-rounding ambiguity).
- README §Accuracy sunrise/sunset row tightened from "±2 min vs Drik" to "**≤29 s observed vs Drik minute-midpoint (±45 s tolerance)**".
- Test count: 4848 → **4864** (+16).

**Why this is sufficient:** Drik publishes times at HH:MM resolution, so sub-30s deviation from the minute-midpoint is effectively within-the-printed-minute — Drik can't distinguish our output from its own ground truth at finer resolution. The audit confirmed we are *not* hiding ±45s drift behind a minute-rounded claim.

---

### Step 19-6 — Changeset, Versioning, Release Notes ✅ DONE

**What shipped:**
- [CHANGELOG.md](CHANGELOG.md) — authored v1.0.0 entry with stable-API commitment, no-breaking-changes-vs-0.7.0 statement, Phase 13–18 deliverable list, validation summary (4864 tests, ≤29s sunrise drift, ≤0.02° Sun–Saturn, 12 festival fixtures), documented festival tradeoff, pre-0.7 migration notes, naming convention.
- [package.json](package.json) bumped `0.7.0 → 1.0.0`.
- Stale `.changeset/initial-release.md` (v0.1.0-era) removed — it would have polluted any future auto-generated CHANGELOG.
- Stale `.changeset/v1-stable-release.md` removed after its content was inlined into CHANGELOG.md — avoids double-bump if someone runs `pnpm changeset version`.

**Note:** Approach diverges from the original plan ("use @changesets/cli to author"). Because the repo hadn't been consuming changesets (v0.2 through v0.7 were manually bumped — see `git log --grep="version update"`), the cleanest path was a hand-written CHANGELOG + manual version bump. Either `npm publish` or `pnpm changeset publish` now works.

---

### Step 19-7 — Publish v1.0.0

**What:**
- `npm run build` → `npm run test:run` → `npm run test:hermes`
- Verify `package.json` `version: "1.0.0"`
- `npm run release` (or `npm publish` if not using changesets pipeline)
- Tag git: `git tag v1.0.0 && git push --tags`
- Draft GitHub release from the changeset

**Effort:** 30 minutes.

---

**Phase 19 completion table:**

| Step | Focus | Effort | Status |
|------|-------|--------|--------|
| 19-1 | Festival Drik validation | 2–3h | ✅ |
| 19-2 | End-time validation | 2h | ✅ |
| 19-3 | Public API audit | 3–4h | ✅ |
| 19-4 | README + docs sync | 2–3h | ✅ |
| 19-5 | Seconds-precision cross-verify | 1–2h | ✅ |
| 19-6 | Changeset + release notes | 1–2h | ✅ |
| 19-7 | Publish v1.0.0 | 0.5h | ⬜ (user-driven: `npm publish`, tag `v1.0.0`, push) |

**Total Phase 19 effort:** ~1.5 engineering days.

---

## Phase 20 — Post-v1 Jyotish (Optional) ⬜ NOT STARTED

> These features are out of scope for v1 but documented here so the roadmap
> is visible. They can ship as v1.x minor releases (additive only).

### Step 20-1 — Kundli Milan (Ashtakoota Matching)

**What:** Marriage-compatibility scoring — given two nakshatras, compute the 8-factor Ashtakoota match (Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi) summed to 36 points.

**Implementation:**
- `src/jyotish/kundliMilan.ts` — pure lookup tables + deterministic math
- `computeKundliMilan(boyNakshatra, girlNakshatra): KundliMilanResult`
- Types: per-factor score + total + verdict

**Effort:** 1 day (math is simple, tables are long).

---

### Step 20-2 — Shadbala (Planetary Strengths)

**What:** 6-fold planetary strength computation (Sthana, Dig, Kala, Chesta, Naisargika, Drik bala).
**Effort:** Large (2–3 days). Defer unless a user requests it.

---

### Step 20-3 — Divisional Charts (D9 Navamsa, D10 Dashamsa)

**What:** Vargas — subdivisions of rashi used in classical chart reading.
**Effort:** Medium (1 day). Straightforward math once planetary positions exist.

---

## Execution Summary — All Phases

| Phase | Focus | Steps | Key Deliverables | Status |
|-------|-------|-------|------------------|--------|
| **1–12** | Core build, publish | 1 → 14 | Full Panchang lib, npm v0.2.2 | ✅ DONE |
| **13** | Missing Panchang Essentials | 13-1 → 13-9 | Chandra Masa, Samvat, Rashi, Brahma Muhurta, Choghadiya, Hora, Moonrise/set, Panchaka | ✅ DONE |
| **14** | dharmSetu MVP Features | 14-1 → 14-4 | Special Yogas, Dur Muhurta, Festival Detection | ✅ DONE (v0.3.1) |
| **15** | Regional Completeness | 15-1 → 15-2 | Gowri Panchangam | ✅ DONE (v0.3.1) |
| **16** | Validation Hardening | 16-1 | 200+ day validation suite, long-range regression | 🔶 PARTIAL |
| **17** | Jyotish Expansion | 17-1 → 17-5 | 9 Graha positions, Vimshottari Dasha, Chandra Balam | ✅ DONE (validation pending in 18-3, 18-4) |
| **18** | Jyotish Completion & Quality | 18-1 → 18-6 | Rahu formula fix, Chandra Balam, Drik validation for planets + dasha, API review | ✅ DONE |
| **19** | v1 Release Preparation | 19-1 → 19-7 | Festival validation, end-time validation, API/docs audit, publish v1.0.0 | ✅ DONE (19-7 user-driven) |
| **20** | Post-v1 Jyotish (optional) | 20-1 → 20-3 | Kundli Milan, Shadbala, Divisional Charts | ⬜ NOT STARTED |
| **21** | Festival Rule System | 21-1 → 21-8 | `dateRule` tags, transit-based Sankranti, nakshatra+solarMasa registry, Ekadashi viddha, Pradosha both-paksha fix, Diwali dedupe | ✅ DONE |
| **22** | Sanskrit Locale Removal | 22-1 | Drop `'sa'` Language, delete `sa.ts`, update tests + docs | ✅ DONE |
| **23** | Classical Correctness Completion | 23-1 → 23-6 | Bhadra Kala + RB exclusion, Smarta/Vaishnava Ekadashi split, 24 named Ekadashis, multi-day dedupe, Adhika nuance, Purnimanta registry | ⬜ NOT STARTED |
| **24** | Festival Coverage Expansion | 24-1 → 24-10 | Regional solar-month festivals, Chhath, Avani Avittam, Ayyappa, Vat Savitri, Masik Shivaratri, Vinayaka Chaturthi, weekday-qualified Pradosha, Pushya days, month+weekday patterns | ⬜ NOT STARTED |
| **25** | Astronomy Expansion | 25-1 → 25-2 | Eclipse (solar + lunar) detection, muhurta library completion (Vijaya/Godhuli/Nishita/Amrit) | ⬜ NOT STARTED |
| **26** | Diaspora & API Polish | 26-1 → 26-2 | Non-IST cross-verification, document `getInstantPanchang` dateRule limitations | ⬜ NOT STARTED |

---

## Competitive Summary (Post All Phases)

| Metric | panchangam-js | panchang-ts |
|--------|:------------:|:-----------:|
| Core Pancha Anga | ✅ | ✅ |
| End times for all elements | ✅ | ✅ |
| Lunar calendar (Masa, Samvat) | ❌ | ✅ |
| Ayanamsa options | ❌ (hardcoded) | ✅ (3 systems) |
| i18n | Partial | ✅ (en/hi) |
| Daily + Instant modes | ❌ | ✅ |
| Performance toggles | ❌ | ✅ |
| Typed errors | ❌ | ✅ |
| Festival detection | ✅ | ✅ (Phase 14) |
| Special Yogas | ✅ | ✅ (Phase 14) |
| Dur Muhurta | ✅ | ✅ (Phase 14) |
| Gowri Panchangam | ✅ | ✅ (Phase 15) |
| 7-planet positions | ✅ | ✅ (Phase 17) |
| Vimshottari Dasha | ✅ | ✅ (Phase 17) |
| Validation depth | 200 days | 200+ days (Phase 16) |

**After Phase 14+15, panchang-ts surpasses panchangam-js on every dimension that matters for a devotional app, while maintaining architectural advantages (types, modes, perf toggles, i18n, calendar systems) that panchangam-js cannot match.**

---

## Phase 21 — Festival Rule System ✅ DONE

> **Goal:** Close the gap between "tithi-at-sunrise for every festival" (the v1.0 simplification) and how Drik / published panchangs actually date festivals. Introduces a per-festival `dateRule` tag plus the canonical-time infrastructure (`madhyahna`, `aparahna`, `pradosha`, `nishita`, `chandrodaya`) needed to evaluate each festival at its classical anchor. Also fills three structural gaps: transit-based Sankranti, nakshatra + solar-masa rule type, and Ekadashi Dashami-viddha detection.

### Step 21-1 — `FestivalDateRule` type + `computeFestivals` context object ✅ DONE

**What shipped:**
- [src/core/festivals.ts](src/core/festivals.ts) — new `export type FestivalDateRule = 'sunrise' | 'madhyahna' | 'aparahna' | 'pradosha' | 'nishita' | 'chandrodaya'`.
- `computeFestivals` signature refactored from 8 positional args to a single `FestivalComputeContext` object. Context carries `tithiIndex` (sunrise, the default rule fallback), `nakshatraIndex`, `chandraMasaIndex`, `solarMasaIndex`, `isAdhika`, `varaIndex`, plus optional `tithiByRule`, `sankrantiRashi`, `ekadashiDashamiViddha`.
- Rule evaluation picks `tithiByRule[rule.dateRule] ?? ctx.tithiIndex`, so omitting `tithiByRule` gives the old sunrise-only behaviour — backward-compat for callers that can't build a full context (e.g., `getInstantPanchang`).

### Step 21-2 — Tag existing festivals with classical rules ✅ DONE

**What shipped:** per-festival `dateRule` tags in the registry:
- `madhyahna`: Akshaya Tritiya, Ganesh Chaturthi, Rama Navami, Vasant Panchami
- `pradosha`: Diwali, Dhanteras
- `nishita`: Krishna Janmashtami, Maha Shivaratri
- Raksha Bandhan / Karva Chauth / Narak Chaturdashi left on `sunrise` (matches published Drik observance; aparahna-vyapini / chandrodaya rules are too strict for how these are actually dated).

**Verified:** Akshaya Tritiya 2026 now correctly fires on Apr 19 (Tritiya at midday), not Apr 20 (Tritiya at sunrise but Chaturthi at midday).

### Step 21-3 — Canonical-time anchor builder in `getDailyPanchang` ✅ DONE

**What shipped:** [src/core/panchang.ts](src/core/panchang.ts) precomputes tithi at each canonical anchor within the Hindu day (sunrise → nextSunrise):
- `madhyahna`: sunrise + 0.5 × dayLength (mid-day)
- `aparahna`: sunrise + 0.8 × dayLength (end of aparahna kala)
- `pradosha`: sunset + 60 min (end of pradosha kala, 2.5 ghatikas)
- `nishita`: midpoint of sunset-to-nextSunrise (local midnight)
- `chandrodaya`: moonrise within the Hindu day, or `undefined` if moon doesn't rise in the window
- `arunodaya`: sunrise − 96 min (for Ekadashi viddha; not a `FestivalDateRule`, used only for ctx.ekadashiDashamiViddha)

**Why end-of-kala anchors:** anchoring at the END of each kala (rather than the midpoint or start) ensures a tithi which only briefly enters the kala doesn't qualify as "pervading" it. This was the fix for the Diwali-fires-on-two-days bug — Amavasya ending just barely inside Oct 21 2025 pradosha was incorrectly emitting a second Diwali.

### Step 21-4 — Transit-based Sankranti ✅ DONE

**What shipped:** Sankranti detection moved out of the registry loop into [panchang.ts](src/core/panchang.ts). Replaces the naive `siderealSun % 30 < 1.0` at-sunrise check with a rashi-at-sunrise vs rashi-at-nextSunrise comparison; when they differ, a transit occurred within the Hindu day and we emit Sankranti for the new rashi.

**Impact:** old rule dated every Sankranti exactly one day late (sunrise check fires only *after* the transit). New rule fires on the Hindu day containing the transit, matching Drik.

### Step 21-5 — Nakshatra + solar-masa rule type + Onam ✅ DONE

**What shipped:** `FestivalRule` gained optional `solarMasa` + `nakshatra` fields as an alternative to `masa + tithi`. Registry entry `{ key: 'onam', solarMasa: 4, nakshatra: 21, type: 'major' }` wires Thiruvonam nakshatra in Simha solar month for the Malayalam calendar. Generalises to any nakshatra-based festival (Phase 24 will add more).

### Step 21-6 — Sankashti Chaturthi (monthly, chandrodaya rule) ✅ DONE

**What shipped:** recurring emission when `tithiByRule.chandrodaya === 18` (Krishna Chaturthi at moonrise). Fires once per lunar month, regardless of masa. Unlike Karva Chauth (which Drik dates by sunrise rule), Sankashti's classical chandrodaya-vyapini rule is respected in published panchangs, so the chandrodaya anchor is the right one here.

### Step 21-7 — Pradosha Vrata: both pakshas + pradosha-kala anchor ✅ DONE

**What shipped:** previously the code checked `tithiIndex === 27` (Krishna Trayodashi only). Classical Pradosha is observed on **both** Shukla (tithi 12) and Krishna (tithi 27) Trayodashi, evaluated at pradosha kala (not sunrise). New check: `tithiForRule('pradosha') === 12 || === 27`. Added assertion in the unit suite — the old test that documented the bug ("does not detect Pradosha on Shukla Trayodashi") has been inverted.

### Step 21-8 — Ekadashi Dashami-viddha detection ✅ DONE

**What shipped:** tithi at arunodaya (sunrise − 96 min) is compared against Dashami (tithi 9 or 24). When the Ekadashi-at-sunrise is Dashami-viddha, we annotate the emitted Ekadashi with a `description` noting the Smarta fast defers to the next day (Dwadashi) while Vaishnava observes today. Does not yet emit two distinct events — that's Phase 23-2.

### Test + fixture additions ✅ DONE

- [tests/unit/festivals.test.ts](tests/unit/festivals.test.ts) — rewritten for the new context signature. 37 unit tests covering every `dateRule`, Adhika-skip semantics, viddha, Sankranti, Onam.
- [tests/fixtures/drikpanchang-festivals.json](tests/fixtures/drikpanchang-festivals.json) — 8 Drik-verified fixtures added for newly-corrected or newly-supported festivals: Akshaya Tritiya 2026-04-19, Makar Sankranti 2026-01-14, Ganesh Chaturthi 2026-09-14, Krishna Janmashtami 2025-08-15, Maha Shivaratri 2025-02-26, Diwali 2025-10-20, Dhanteras 2025-10-18, Onam 2025-09-05.

**Final state:** 4,888 tests pass, tsc clean.

**Phase 21 completion table:**

| Step | Feature | Status |
|------|---------|--------|
| 21-1 | `FestivalDateRule` + context object | ✅ |
| 21-2 | Tag festivals with classical rules | ✅ |
| 21-3 | Canonical-time anchors (end-of-kala) | ✅ |
| 21-4 | Transit-based Sankranti | ✅ |
| 21-5 | Nakshatra + solar-masa rule type + Onam | ✅ |
| 21-6 | Sankashti Chaturthi (monthly, chandrodaya) | ✅ |
| 21-7 | Pradosha: both pakshas + pradosha-kala anchor | ✅ |
| 21-8 | Ekadashi Dashami-viddha detection | ✅ |

---

## Phase 22 — Sanskrit Locale Removal ✅ DONE

**What shipped:**
- [src/types/options.ts](src/types/options.ts) — `Language` narrowed from `'en' | 'sa' | 'hi'` to `'en' | 'hi'`.
- [src/i18n/sa.ts](src/i18n/sa.ts) deleted.
- [src/i18n/resolver.ts](src/i18n/resolver.ts) — `sa` import + translation-map entry removed.
- [tests/unit/i18n.test.ts](tests/unit/i18n.test.ts) — Sanskrit language fixture + `getTranslations('sa')` case + `resolvePakshaName(0, 'sa')` case removed.
- [tests/unit/chandraBalam.test.ts](tests/unit/chandraBalam.test.ts), [tests/integration/chandra-balam-wiring.test.ts](tests/integration/chandra-balam-wiring.test.ts), [tests/integration/comprehensive.test.ts](tests/integration/comprehensive.test.ts) — `sa` language usages replaced with `hi` or removed.
- JSDoc `@example` in [src/core/panchang.ts](src/core/panchang.ts) switched `{ language: 'sa' }` → `{ language: 'hi' }`.

**Why:** Sanskrit and Hindi Devanagari outputs were identical for all panchang element names (the `sa.ts` and `hi.ts` files were near-duplicates), so the extra locale added maintenance surface with no functional benefit. The `chandraMasaNames`, `festivalNames`, etc. that matter are all Devanagari in `hi.ts`.

**Note:** historical PLAN.md sections (Phase 13-1, §11.3, etc.) still reference `sa.ts` — those are historical build notes describing what was true at that point in time. Intentionally not scrubbed.

**Final state:** 4,864 tests pass (24 Sanskrit-specific assertions removed), tsc clean.

---

## Phase 23 — Classical Correctness Completion ✅ DONE

> **Goal:** Finish the classical rule system so that panchang-ts reproduces Drik's festival dating not just for the common cases (Phase 21) but also for the edge cases that depend on Bhadra Kala exclusion, Smarta/Vaishnava split, named Ekadashi identity, long-tithi dedupe, Adhika-masa shift, and Purnimanta regional naming. Each step is independently shippable; order below is by effort × impact.

### Step 23-1 — Bhadra Kala module + Raksha Bandhan exclusion

**What:** Bhadra (also called Vishti Karana in specific contexts) is an inauspicious period that classically disqualifies Raksha Bandhan observance. Drik publishes Bhadra-Punchha + Bhadra-Mukha times for every Raksha Bandhan day and shifts the ceremony to after Bhadra ends. Currently the library doesn't detect Bhadra at all.

**Implementation:**
- New module `src/core/bhadra.ts`:
  - Bhadra is active during specific half-tithis (the Vishti karana span). The 60 karanas repeat every half-tithi; Vishti is karana index 7 (0-indexed within the 11-karana cycle) occurring in Shukla Chaturthi 2nd half, Shukla Ashtami 1st half, Shukla Ekadashi 2nd half, Shukla Purnima 1st half, Krishna Tritiya 2nd half, Krishna Saptami 1st half, Krishna Dashami 2nd half, Krishna Chaturdashi 1st half — the 8 Vishti occurrences per lunar month.
  - `computeBhadraKaal(sunriseUtc, nextSunriseUtc, getMoon, getSun): { start: Date, end: Date } | null` — returns the Bhadra window within the Hindu day or null.
  - Bhadra-mukha (face) vs Bhadra-punchha (tail) classification: depends on whether Bhadra is in daytime (tail is auspicious portion) or nighttime (face is auspicious portion). Add as a sub-field.
- Wire into [src/core/panchang.ts](src/core/panchang.ts) daily result as optional `bhadra: BhadraInfo | null` field.
- New `FestivalRule` field: `bhadraExclude?: boolean`. When true and Bhadra is active for > half the canonical kala, emit with a description "Observe after Bhadra ends at HH:MM" instead of suppressing the festival entirely. Apply to `raksha_bandhan`.
- Add a `DailyPanchangResult.bhadra` field in [src/types/panchang.ts](src/types/panchang.ts).

**Types:**
```ts
interface BhadraInfo {
  start: Date;         // offset-adjusted local face
  end: Date;
  location: 'earth' | 'heaven' | 'paatal';  // determines shubh/ashubh phase
  isActive: boolean;   // currently-active flag at sunrise of this day
}
```

**Tests:**
- Unit test: compute Bhadra window for a known date, verify start/end match Drik ±3 min.
- Fixture: Raksha Bandhan 2025-08-09 with description mentioning Bhadra-end timing (Drik publishes 13:38 IST for this day).

**Effort:** 1 engineering day.

---

### Step 23-2 — Smarta vs Vaishnava Ekadashi as distinct events

**What:** Phase 21-8 detects Dashami-viddha but emits only one `ekadashi` event with a descriptive note. Classical practice treats these as two distinct observances on different days. Library should emit:
- `smarta_ekadashi` on the Ekadashi-at-sunrise day when NOT viddha, OR on the Dwadashi-at-sunrise day FOLLOWING a viddha Ekadashi.
- `vaishnava_ekadashi` always on the Ekadashi-at-sunrise day regardless of viddha.
- On a non-viddha day: emit both (identical date) with a single generic `ekadashi` for ergonomics.

**Implementation:**
- Cross-day logic: need to know yesterday's viddha state to decide if today (Dwadashi-at-sunrise) is a Smarta Ekadashi.
- Simplest: compute tithi-at-arunodaya for YESTERDAY as well (add `yesterdayArunodayaTithi` to context). If yesterday was viddha-Ekadashi and today is Dwadashi-at-sunrise, emit Smarta Ekadashi today.
- Or: emit both events always on the Ekadashi-at-sunrise day with a `deferralDate: Date` on Smarta when viddha. Keeps the computation single-day.
- Registry: add `smarta_ekadashi` and `vaishnava_ekadashi` keys to i18n. Emit generic `ekadashi` only when both coincide (to avoid UX clutter).

**Types:**
```ts
interface FestivalInfo {
  name: string;
  type: 'major' | 'minor' | 'ekadashi' | 'smarta_ekadashi' | 'vaishnava_ekadashi' | 'pradosha' | 'sankranti';
  description?: string;
  deferralDate?: Date;  // Smarta-only: when viddha, points to the Dwadashi fast day
}
```

**Tests:**
- 2025-02-24 Delhi: Vijaya Ekadashi was Dashami-viddha per Drik; Smarta on Feb 24, Vaishnava on Feb 25. Lock in.
- 2025-03-25 Delhi: Papamochani Ekadashi, non-viddha, both coincide.

**Effort:** 0.5 day.

---

### Step 23-3 — 24 named Ekadashis + named Pradosha variants

**What:** library emits generic `ekadashi`. Classical tradition names each of the 24 yearly Ekadashis:

| Month (Amanta) | Shukla Ekadashi | Krishna Ekadashi |
|---|---|---|
| Chaitra | Kamada | Papamochani |
| Vaishakha | Mohini | Varuthini |
| Jyeshtha | Nirjala | Apara |
| Ashadha | Devshayani | Yogini |
| Shravana | Putrada (Pavitra) | Kamika |
| Bhadrapada | Parivartini | Aja |
| Ashwin | Pashankusha | Indira |
| Kartika | Prabodhini (Devutthana) | Rama |
| Margashirsha | Mokshada | Utpanna |
| Pausha | Putrada | Saphala |
| Magha | Jaya | Shattila |
| Phalguna | Amalaki | Vijaya |
| Adhika (leap) | Padmini | Parama |

Pradosha too has 14 named variants based on vara (weekday):
- Som Pradosha (Monday), Bhauma (Tuesday), Saumya/Budha (Wednesday), Guru (Thursday), Bhrigu/Shukra (Friday), Shani (Saturday), Bhanu/Ravi (Sunday) × 2 pakshas.

**Implementation:**
- Lookup table keyed by `(chandraMasaIndex, isAdhika, paksha)` → Ekadashi name.
- Pradosha lookup by `(varaIndex, paksha)` → variant name.
- New i18n keys for all 26 names (24 regular + 2 Adhika Ekadashis) + 14 Pradosha variants. English + Hindi.
- Emit the specific name as `description` alongside the generic `ekadashi` / `pradosha` event. Don't churn the primary `name` field.

**Tests:** one fixture per month across 2025 confirming names (12 Shukla + 12 Krishna).

**Effort:** 1 day (mostly table data entry + i18n).

---

### Step 23-4 — Multi-day dedupe heuristic for long tithis

**What:** when a tithi spans the canonical anchor on two consecutive days (rare, happens ~1% of years for tithis near the moon-speed minimum), the current code emits the festival twice. Classical tiebreaker: observe on the day the tithi is "more prevailing" — measured by how much of the canonical kala it occupies.

**Implementation:**
- For each `dateRule`, compute tithi at BOTH start and end of the kala (not just the end-anchor currently used).
- If both match the target tithi, tithi occupies the full kala — emit.
- If only end matches (target tithi STARTED during the kala), check if the PRIOR day has both start+end match → suppress today's emission.
- If only start matches (tithi ENDED during kala), always suppress — tithi was not prevailing at canonical time.
- Cross-day check needs yesterday's context; easiest to add a `priorDayTithiByRule` field to `FestivalComputeContext` (pass undefined when computing day-1 without context).

**Tests:**
- Synthetic: construct a context where Tritiya spans Apr 19 madhyahna AND Apr 20 start-of-madhyahna; verify only Apr 19 emits.
- Real: find a year where Akshaya Tritiya has this boundary (search 2000–2050); lock in.

**Effort:** 0.5 day.

---

### Step 23-5 — Adhika masa nuance (shift vs skip per festival)

**What:** currently ALL registry festivals skip during Adhika months (`if (!ctx.isAdhika)`). Classical practice is more nuanced:

| Festival | Adhika behaviour |
|---|---|
| Ugadi, Holi, Navaratri, Dussehra, Ganesh Chaturthi | Skip in Adhika (observe only in Nija) |
| Janmashtami, Ram Navami, Rama Navami | Observe in Nija masa following the Adhika |
| Purushottama-specific observances | Observe in Adhika specifically (Vishnu/Purushottama dedication) |
| Ekadashi, Pradosha, Sankashti | Observe in both Adhika and Nija (recurring) |

**Implementation:**
- New `FestivalRule` field: `adhikaBehaviour?: 'skip' | 'shift-to-nija' | 'observe-in-both'` (default `'skip'`).
- When `'shift-to-nija'`: suppress in Adhika, and emit on the equivalent tithi in the following Nija masa.
- When `'observe-in-both'`: emit in both Adhika and Nija (current behaviour for Ekadashi, which bypasses the Adhika skip already).
- `shift-to-nija` requires lookahead: computing "this is the Nija masa after an Adhika" needs cross-month state. Simplest: check if the PRIOR month was Adhika with same masa index. Add `priorMasaWasAdhika: boolean` to context (derivable from last month's Amavasya).

**Tests:** 2023 had Adhika Shravana. Locked-in fixtures for Krishna Janmashtami 2023 (should observe in Nija Shravana, not Adhika Shravana).

**Effort:** 1 day.

---

### Step 23-6 — Purnimanta registry awareness

**What:** the registry uses Amanta masa (0 = Chaitra … 11 = Phalguna). In Purnimanta regions (most of N/W/E India) Krishna-paksha festivals are named by the NEXT masa: e.g., the Diwali Amavasya is "Kartika Amavasya" in Purnimanta convention but "Ashwin Amavasya" in Amanta. The dates are identical — only the displayed masa name differs. Currently `masaSystem` option flips the chandra masa name display but the festival registry doesn't reflect which system the festival was traditionally named under.

**Implementation:**
- New `FestivalRule` field: `namingSystem?: 'amanta' | 'purnimanta'` — purely cosmetic, describes how the festival's masa was traditionally labelled.
- When `options.masaSystem === 'purnimanta'` and the festival's `namingSystem === 'purnimanta'`, emit the festival's description with the Purnimanta masa name. Applies mainly to Krishna-paksha festivals in Ashwin (Diwali, Dhanteras, Karva Chauth, Narak Chaturdashi) → display as "Kartika Krishna" instead of "Ashwin Krishna" in description.
- No change to registry matching rules — date detection stays Amanta-indexed since that's unambiguous.

**Effort:** 0.25 day.

---

**Phase 23 completion table:**

| Step | Feature | Effort | Status |
|------|---------|--------|--------|
| 23-1 | Bhadra Kala + Raksha Bandhan exclusion | 1d | ✅ |
| 23-2 | Smarta/Vaishnava Ekadashi split | 0.5d | ✅ |
| 23-3 | 24 named Ekadashis + 14 named Pradoshas | 1d | ✅ |
| 23-4 | Multi-day dedupe for long tithis | 0.5d | ✅ |
| 23-5 | Adhika masa nuance per festival | 1d | ✅ |
| 23-6 | Purnimanta registry awareness | 0.25d | ✅ |

**Total Phase 23 effort:** ~4 engineering days.

---

## Phase 24 — Festival Coverage Expansion ✅ DONE

> **Goal:** Bring the festival registry from its current ~25 entries to a classically complete ~60+ entries covering regional (Tamil, Malayalam, Bengali, Marathi), recurring monthly/weekly, and composite (tithi+nakshatra or month+weekday) festivals.

### Step 24-1 — Solar-month regional Sankranti festivals

**What:** Sankranti is detected (Phase 21-4), but the regional festival name attached to each Sankranti varies by region and is currently just `"Sankranti"` with a `description: rashi_name`. Classical distinct names:

| Sankranti | Regional name | Rashi |
|---|---|---|
| Mesha | Baisakhi (Punjab), Vishu (Kerala), Pohela Boishakh (Bengal), Puthandu (Tamil) | 0 |
| Makara | Makar Sankranti (N India), Pongal (Tamil), Uttarayan (Gujarat), Bihu (Assam) | 9 |
| Karka | Dakshinayana | 3 |
| Simha | Singh Sankranti | 4 |

**Implementation:**
- Separate `sankranti_regional` festival registry keyed by rashi index → array of region-tagged names.
- When Sankranti fires, emit additional regional festival events with the appropriate name.
- Option for users to scope to a region: `options.region?: 'tamil' | 'kerala' | 'bengali' | 'north-india' | 'all'` (default `'all'`).

**Effort:** 0.5 day.

### Step 24-2 — Chhath Puja

**What:** 4-day festival starting on Kartika Shukla Chaturthi (day 1 = Nahay Khay), Panchami (Kharna), Shashthi (Sandhya Arghya, the main evening), Saptami morning (Usha Arghya).

**Implementation:**
- Add 4 registry entries:
  - `chhath_nahay_khay` (masa 7, tithi 3, sunrise)
  - `chhath_kharna` (masa 7, tithi 4, sunrise)
  - `chhath_sandhya_arghya` (masa 7, tithi 5, pradosha)
  - `chhath_usha_arghya` (masa 7, tithi 6, sunrise)
- Emit as `type: 'major'` with descriptions.

**Effort:** 0.25 day.

### Step 24-3 — Avani Avittam / Upakarma

**What:** Thread-changing ceremony for Brahmin men, timed differently per Vedic shakha:
- **Yajur Upakarma**: Shravana Purnima in Shravana masa (approximates Phase 21's Raksha Bandhan date but tied to Shravana nakshatra).
- **Rig Upakarma**: Shravana nakshatra in Shravana masa (whichever day the nakshatra occurs).
- **Sama Upakarma**: Hasta nakshatra in Bhadrapada masa.

**Implementation:** 3 new registry entries using the nakshatra+masa rule type (extends Phase 21-5). Needs nakshatra+chandraMasa composite matching (currently registry only has nakshatra+solarMasa for Onam — extend to also support nakshatra+chandraMasa).

**Effort:** 0.5 day.

### Step 24-4 — Ayyappa Makara Jyothi

**What:** Sabarimala temple festival. Date is Makar Sankranti (rashi 9) — already detected — but the EVENT emitted needs to be distinct (temple-specific, not a general panchang event). Tie into Step 24-1's regional registry.

**Effort:** 0.1 day (essentially a rename within 24-1).

### Step 24-5 — Vat Savitri

**What:** Jyeshtha Amavasya (Purnimanta) or Jyeshtha Purnima (Amanta) — married women's fast. Currently registry has `masa 5, tithi 29` as Mahalaya Amavasya (Bhadrapada). Vat Savitri on Jyeshtha Amavasya is separate.

**Implementation:** `{ key: 'vat_savitri_amavasya', masa: 2, tithi: 29, type: 'major' }` — Jyeshtha = masa index 2. Also `vat_savitri_purnima` (masa 2, tithi 14) for the S Indian variant. `adhikaBehaviour: 'skip'`.

**Effort:** 0.15 day.

### Step 24-6 — Masik Shivaratri (monthly)

**What:** every month on Krishna Chaturdashi (tithi 28) at nishita kala. Maha Shivaratri is the Magha-month instance.

**Implementation:** add recurring rule in the `computeFestivals` function body (similar to Sankashti Chaturthi pattern): `if (tithiByRule.nishita === 28) emit masik_shivaratri`. Exclude when Maha Shivaratri fires (i.e., when chandraMasa === Magha) to avoid double-emission.

**Effort:** 0.2 day.

### Step 24-7 — Vinayaka Chaturthi (monthly)

**What:** every month on Shukla Chaturthi (tithi 3) at madhyahna. Ganesh Chaturthi is the Bhadrapada instance.

**Implementation:** similar pattern to 24-6. Emit when `tithiByRule.madhyahna === 3` and exclude when chandraMasa === Bhadrapada (Ganesh Chaturthi fires).

**Effort:** 0.15 day.

### Step 24-8 — Weekday-qualified Pradosha (Shani, Som, Bhauma, Guru, Shukra, Saumya, Bhanu)

**What:** covered in Phase 23-3 (named Pradosha variants). Effectively duplicate — track this as complete when 23-3 ships.

**Effort:** 0 (covered by 23-3).

### Step 24-9 — Pushya Nakshatra days (Ravi Pushya, Guru Pushya)

**What:** Pushya (nakshatra 7) occurring on Sunday (Ravi Pushya Yoga) or Thursday (Guru Pushya Yoga) is auspicious for gold buying, asset purchase, new ventures. Library already has `computeSpecialYogas` detecting these — but as *yogas*, not festivals. User feedback is that some apps want them surfaced as festival-like events.

**Implementation:** NO code change needed — surface the existing special yoga via docs. Alternative: add a mirror festival entry (nakshatra 7 + varaIndex match) that emits the same event also in `festivals` array for UX convenience.

**Effort:** 0.1 day (docs + optional mirror entry).

### Step 24-10 — Month+weekday recurring patterns

**What:** "Shravan Somvar" (every Monday of Shravana masa), "Mangala Gauri" (every Tuesday of Shravana), "Sankat Nivaran Shanivar" (every Saturday). New rule type.

**Implementation:**
- New `FestivalRule` kind: `{ chandraMasa: number, vara: number, ... }` — emit when both match at sunrise.
- Extend rule-matching loop in `computeFestivals` to handle this new kind.
- Add entries: Shravan Somvar, Mangala Gauri, Kartik Somvar, Magha Shanivar.

**Effort:** 0.5 day.

---

**Phase 24 completion table:**

| Step | Festival(s) | Effort | Status |
|------|-------------|--------|--------|
| 24-1 | Regional Sankranti names (Baisakhi, Pongal, Vishu, Bihu, etc.) | 0.5d | ✅ |
| 24-2 | Chhath Puja 4-day | 0.25d | ✅ |
| 24-3 | Avani Avittam / Upakarma (3 shakhas) | 0.5d | ✅ |
| 24-4 | Ayyappa Makara Jyothi | 0.1d | ✅ (via 24-1 kerala scope) |
| 24-5 | Vat Savitri (Amavasya + Purnima) | 0.15d | ✅ |
| 24-6 | Masik Shivaratri (monthly) | 0.2d | ✅ |
| 24-7 | Vinayaka Chaturthi (monthly) | 0.15d | ✅ |
| 24-8 | Weekday-qualified Pradosha | (via 23-3) | ✅ (shipped in Phase 23-3) |
| 24-9 | Ravi / Guru Pushya (docs + mirror) | 0.1d | ✅ (mirror in festivals) |
| 24-10 | Month+weekday recurring | 0.5d | ✅ |

**Total Phase 24 effort:** ~2.5 engineering days.

**Implementation summary:**
- New rule kinds: `nakshatra+chandraMasa` (Rig/Sama Upakarma), `chandraMasa+vara` (Shravan Somvar, Mangala Gauri, Kartik Somvar, Magha Shanivar).
- `SANKRANTI_REGIONAL` map emits region-tagged variants alongside the canonical `sankranti` event; new `region?: FestivalRegion` option (default `'all'`) on `PanchangOptions` / `InstantPanchangOptions` filters regional variants. Always-emitted `'all'`-scoped entries: Dakshinayana (Karka), Singh Sankranti (Simha).
- Chhath Puja: 4 sunrise/pradosha entries in Kartika Shukla 4→7.
- Vat Savitri: Amavasya (N India) + Purnima (S India) variants in Jyeshtha.
- Yajur Upakarma added as a Shravana-Purnima registry entry (shares the day with Raksha Bandhan).
- Masik Shivaratri / Vinayaka Chaturthi use the existing long-tithi dedupe and are suppressed in their Maha-equivalent months.
- Pushya Nakshatra: `ravi_pushya` / `guru_pushya` mirrored into `festivals` for UX parity with `specialYogas`.
- New `FestivalRegion` type exported from `panchang-ts`.
- 36 new unit/integration tests; all 4920 tests pass.

---

## Phase 25 — Astronomy Expansion ⬜ NOT STARTED

### Step 25-1 — Eclipse detection (solar + lunar)

**What:** Grahan (eclipse) is classically significant — many vratas and rituals shift around it. astronomy-engine exposes `SearchLunarEclipse` / `SearchGlobalSolarEclipse` — we currently don't surface either.

**Implementation:**
- New module `src/astronomy/eclipse.ts`:
  - `getUpcomingSolarEclipse(fromUtc: Date, location: GeoLocation, withinDays: number): SolarEclipseInfo | null`
  - `getUpcomingLunarEclipse(fromUtc: Date, withinDays: number): LunarEclipseInfo | null`
  - `getEclipseDuringDay(sunriseUtc: Date, nextSunriseUtc: Date, location: GeoLocation): EclipseInfo | null`
- Wire into `DailyPanchangResult.eclipse: EclipseInfo | null` — populated only when an eclipse is visible from the location within the Hindu day.
- Emit as a high-priority festival-like entry (`type: 'eclipse'` new enum value) with description noting totality percentage, start/end times, visibility.
- Sutak (pre-eclipse inauspicious period) and Moksha (post-eclipse purification): 9-hour pre-eclipse sutak for solar, 3-hour for lunar. Surface as a sub-field.

**Types:**
```ts
interface EclipseInfo {
  kind: 'solar' | 'lunar';
  subtype: 'partial' | 'total' | 'annular' | 'penumbral';
  start: Date;
  peak: Date;
  end: Date;
  visibleFromLocation: boolean;
  magnitude: number;           // 0–1 fraction obscured
  sutakStart: Date;            // pre-eclipse impurity window start
  sutakEnd: Date;
  description: string;
}
```

**Tests:**
- Lunar eclipse 2025-03-14 (partial): verify detection and sutak window.
- Solar eclipse 2025-09-21 (partial, visible from Australia): verify `visibleFromLocation: false` for Delhi.

**Effort:** 1 day.

### Step 25-2 — Muhurta library completion

**What:** library has Abhijit + Brahma muhurtas + Rahu/Gulika/Yamaganda kalams + Dur Muhurta. Missing:
- **Vijaya Muhurta** — 11th muhurta of the day, auspicious for starting journeys.
- **Godhuli Muhurta** — the "cow-dust hour," ~48 min around sunset.
- **Nishita Muhurta** — 15th muhurta of the night, for Janmashtami-like events.
- **Amrit Kala** — auspicious window, varies by nakshatra.

**Implementation:**
- Extend [src/core/muhurta.ts](src/core/muhurta.ts) with the missing computations. Day is divided into 15 muhurtas from sunrise to sunset; night similarly into 15 from sunset to nextSunrise. Each muhurta = dayLength/15.
- Add to `DailyPanchangResult`:
  - `vijayaMuhurta: TimePeriod`
  - `godhuliMuhurta: TimePeriod`
  - `nishitaMuhurta: TimePeriod`
  - `amritKala: TimePeriod | null` (null when nakshatra doesn't have one)
- i18n keys for all four names (en + hi).

**Tests:** fixture-based ±3 min comparison against Drik, similar to existing Abhijit/Brahma tests.

**Effort:** 0.5 day.

---

**Phase 25 completion table:**

| Step | Feature | Effort | Status |
|------|---------|--------|--------|
| 25-1 | Eclipse detection (solar + lunar) + sutak | 1d | ⬜ |
| 25-2 | Muhurta library completion (Vijaya, Godhuli, Nishita, Amrit) | 0.5d | ⬜ |

**Total Phase 25 effort:** ~1.5 engineering days.

---

## Phase 26 — Diaspora & API Polish ⬜ NOT STARTED

### Step 26-1 — Non-IST timezone cross-verification

**What:** all Drik fixtures use IST (+330 min). Diaspora users (US Eastern, UK, Australia, Gulf) may hit edge cases around Hindu-day boundaries, DST transitions, and sunrise/sunset edge cases at higher latitudes.

**Implementation:**
- Collect Drik-verified fixtures from 5 non-IST locations: New York, London, Sydney, Dubai, Singapore. 3 dates each × 5 locations = 15 fixtures covering tithi-at-sunrise, sunrise/sunset, festival dating, Sankranti attribution.
- Add to [tests/fixtures/drikpanchang-world.json](tests/fixtures/drikpanchang-world.json) (file already exists; currently only handful of entries).
- Verify `options.timezone` as string (IANA zone name like `'America/New_York'`) resolves DST correctly for a date in March (spring-forward) and November (fall-back).
- Specific risk: DST transition day has non-24h civil day; `getLocalMidnightUtc` must handle this (test for 2025-03-09 New York, 2025-11-02 New York).

**Effort:** 0.75 day (mostly fixture collection + one possible DST edge case fix).

### Step 26-2 — Document `getInstantPanchang` dateRule limitations

**What:** `getInstantPanchang` intentionally does NOT perform canonical-time refinement (Phase 21), Sankranti transit detection, or Ekadashi viddha — those all require the full sunrise-to-nextSunrise Hindu day window. Currently [src/core/panchang.ts:170-171](src/core/panchang.ts#L170) comments this but README/API docs don't surface it.

**Implementation:**
- Expand [src/core/panchang.ts](src/core/panchang.ts) JSDoc on `getInstantPanchang` to explicitly list what festival detection features are NOT available in instant mode.
- Add a README section: "When to use `getInstantPanchang` vs `getDailyPanchang`" with a decision table.
- No code change — docs only.

**Effort:** 0.25 day.

---

**Phase 26 completion table:**

| Step | Focus | Effort | Status |
|------|-------|--------|--------|
| 26-1 | Non-IST cross-verification + DST edge cases | 0.75d | ⬜ |
| 26-2 | Document `getInstantPanchang` dateRule gaps | 0.25d | ⬜ |

**Total Phase 26 effort:** ~1 engineering day.

---

## Grand Total — Phases 23–26 (new work after Phase 21/22)

| Phase | Focus | Effort | Tests Added (est.) |
|-------|-------|--------|--------------------|
| 23 | Classical Correctness Completion | 4d | ~80 |
| 24 | Festival Coverage Expansion | 2.5d | ~40 |
| 25 | Astronomy Expansion | 1.5d | ~20 |
| 26 | Diaspora & API Polish | 1d | ~15 |
| **Total** | — | **~9 engineering days** | **~155 new tests** |

After all of Phases 23–26, the festival registry grows from ~25 entries to ~60+, eclipse support lands, and diaspora use is externally-verified. This is the "everything perfect" scope; each phase is independently shippable as a minor v1.x release.
