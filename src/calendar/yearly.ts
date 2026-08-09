import { getDailyPanchang } from '../core/panchang';
import {
  getUpcomingSolarEclipse, getUpcomingLunarEclipse,
} from '../astronomy/eclipse';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { getTithiIndexFromLons } from '../core/tithi';
import { PanchangError } from '../types/errors';
import { resolveUtcOffset, utcToLocalDisplay, getLocalMidnightUtc } from '../utils/timezone';
import { validateLocation, validateDate } from '../utils/validation';
import type { GeoLocation } from '../types/location';
import type { AyanamsaType, MasaSystem, FestivalRegion, LegacyFestivalRegion } from '../types/options';
import type { EclipseInfo, FestivalInfo } from '../types/elements';
import { resolveMasaName } from '../i18n/resolver';

export interface YearlyListingOptions {
  /** UTC offset in minutes (e.g. 330 for IST). Required. */
  timezone: number | string;
  /** Sidereal system. Defaults to `'lahiri'`. */
  ayanamsa?: AyanamsaType;
  /** Lunar month naming system. Defaults to `'purnimanta'`. */
  masaSystem?: MasaSystem;
  /** Output language. Defaults to `'en'`. */
  language?: 'en' | 'hi';
  /** Festival region scope. Defaults to `'all'`. */
  region?: FestivalRegion | LegacyFestivalRegion;
}

/** A festival emission with its calendar date. */
export interface FestivalDay {
  /** UTC sunrise of the day on which the festival was emitted. */
  date: Date;
  festival: FestivalInfo;
}

/** A solar transit (Sankranti) marker. */
export interface SankrantiEvent {
  /** Date of the Sankranti (the day containing the transit). */
  date: Date;
  /** Rashi the Sun transitioned INTO (0..11). */
  rashi: number;
  /** Localized rashi name. */
  rashiName: string;
}

/**
 * Collect all Ekadashi dates in a Gregorian year for the given location.
 * Ekadashi falls twice per lunar month (Shukla and Krishna), so the result
 * has roughly 24 entries per year (occasionally 25 in adhika-masa years
 * because the extra month adds two more Ekadashis).
 *
 * @param year     Gregorian year.
 * @param location Observer coordinates.
 * @param options  Settings — `timezone` is required.
 *
 * @example
 * ```typescript
 * const ekadashis = getEkadashiDatesForYear(2026, DELHI, { timezone: 330 });
 * console.log(ekadashis.length); // 24-26
 * ```
 */
export function computeEkadashiDatesForYear(
  year: number,
  location: GeoLocation,
  options: YearlyListingOptions,
): Date[] {
  validateLocation(location);
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const out: Date[] = [];
  const dayMs = 24 * 3600_000;
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const ayanamsa = options.ayanamsa ?? 'lahiri';
  const offset = resolveUtcOffset(options.timezone, new Date(Date.UTC(year, 6, 1)));

  // The only thing this loop reads is the tithi index at sunrise, so it does
  // exactly that rather than building a panchang 365 times. A `sections: []`,
  // `computeEndTimes: false` call is already the cheapest `getDailyPanchang`
  // available, but it still computes Chandra Masa (two `SearchMoonPhase`
  // calls), Samvat, the four slot systems, every muhurta and every
  // inauspicious period — all discarded here. That waste was ~0.15 ms of a
  // 0.25 ms iteration.
  //
  // The sunrise triplet is deliberately still computed in full even though
  // only `sunrise` is used. `getDailyPanchang` returns `null` when *any* of
  // sunrise / sunset / next-sunrise is unavailable, and this loop skipped
  // those days; computing only sunrise would silently start emitting polar
  // days it used to drop (measured: Tromsø 2024 goes from 16 dates to 17).
  // Keeping the triplet makes the rewrite bit-identical — verified across
  // 7 locations × 4 years, including Tromsø, Reykjavík and Anchorage.
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    let sunriseUtc: Date;
    try {
      sunriseUtc = computeSunrise(getLocalMidnightUtc(d, offset), location);
      computeSunrise(computeSunset(sunriseUtc, location), location);
    } catch (e: unknown) {
      if (e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET')) continue;
      throw e;
    }
    const tithiIndex = getTithiIndexFromLons(
      getSiderealMoonLongitude(sunriseUtc, ayanamsa),
      getSiderealSunLongitude(sunriseUtc, ayanamsa),
    );
    if (tithiIndex === 10 || tithiIndex === 25) out.push(d);
  }
  return out;
}

/**
 * Collect all Sankranti (solar transit) dates for a Gregorian year. Each
 * year has exactly 12 Sankrantis (one per rashi), one per ~30-day solar
 * month. The most celebrated is **Makar Sankranti** (Sun → Capricorn,
 * mid-January).
 *
 * @example
 * ```typescript
 * const sankrantis = getSankrantisForYear(2026, DELHI, { timezone: 330 });
 * sankrantis[9].rashiName; // 'Makara' (Capricorn) for Makar Sankranti
 * ```
 */
export function computeSankrantisForYear(
  year: number,
  location: GeoLocation,
  options: YearlyListingOptions,
): SankrantiEvent[] {
  validateLocation(location);
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  // Rashi names come from the i18n tables rather than a local copy: this file
  // used to declare its own `en`/`hi` arrays, which both duplicated
  // `masaNames` and hard-coded the set of supported languages.
  const lang = options.language ?? 'en';
  const ayanamsa = options.ayanamsa ?? 'lahiri';
  const dayMs = 24 * 3600_000;
  const offset = resolveUtcOffset(options.timezone, new Date(Date.UTC(year, 6, 1)));
  const sunAt = (ms: number) => getSiderealSunLongitude(new Date(ms), ayanamsa);
  const rashiAt = (ms: number) => Math.floor(sunAt(ms) / 30) % 12;

  // Scan a day at a time for a rashi change, then bisect to the exact transit.
  // Only the Sun's longitude is needed, so this reads one ephemeris value per
  // day instead of building a full `getInstantPanchang` (which computed tithi,
  // nakshatra, yoga, karana, vara, masa and samvat, of which this used exactly
  // one field).
  const scanStart = Date.UTC(year, 0, 1) - offset * 60_000 - dayMs;
  const scanEnd = Date.UTC(year, 11, 31, 23, 59) - offset * 60_000 + dayMs;

  const out: SankrantiEvent[] = [];
  let prevMs = scanStart;
  let prevRashi = rashiAt(prevMs);
  for (let t = scanStart + dayMs; t <= scanEnd; t += dayMs) {
    const rashi = rashiAt(t);
    if (rashi === prevRashi) { prevMs = t; prevRashi = rashi; continue; }

    // Exact transit instant: the Sun's sidereal longitude is monotonic here.
    let lo = prevMs, hi = t;
    while (hi - lo > 1000) {
      const mid = Math.floor((lo + hi) / 2);
      if (rashiAt(mid) === prevRashi) lo = mid; else hi = mid;
    }
    const transitUtc = new Date(hi);

    // Which calendar day the Sankranti belongs to.
    //
    // The Hindu day runs sunrise → next sunrise, and Sankranti is observed on
    // the day *containing* the transit — the same rule `computeDayFestivals`
    // applies, which is the one verified against DrikPanchang. Reporting the
    // local date of that day's sunrise keeps the two APIs in agreement.
    //
    // This function previously sampled the Sun at 00:00 **UTC** each day and
    // reported the first sample already in the new rashi. For any eastern
    // timezone that samples mid-morning local time (05:30 IST), so a transit
    // later in the day was pushed to the following date — Makara Sankranti
    // 2025 came out as Jan 15 while `getDailyPanchang` emitted
    // `makar_sankranti` on Jan 14, matching Drik.
    let dayStart: Date;
    try {
      dayStart = computeSunrise(new Date(hi - 30 * 3600_000), location);
      for (let i = 0; i < 3; i++) {
        const next = computeSunrise(computeSunset(dayStart, location), location);
        if (next.getTime() <= hi) dayStart = next; else break;
      }
    } catch {
      // Polar day/night: no sunrise to anchor to, so fall back to the local
      // calendar date of the transit itself rather than dropping the event.
      dayStart = transitUtc;
    }

    const local = utcToLocalDisplay(dayStart, offset);
    const date = new Date(Date.UTC(
      local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(),
    ));
    if (local.getUTCFullYear() === year) {
      out.push({ date, rashi, rashiName: resolveMasaName(rashi, lang) });
    }

    prevMs = t;
    prevRashi = rashi;
  }
  return out;
}

/**
 * Collect every festival emission in a date range. Useful for building a
 * yearly calendar UI or alerting feed.
 *
 * @param start    Inclusive start date.
 * @param end      Inclusive end date.
 * @param location Observer coordinates.
 * @param options  Settings — `timezone` is required.
 *
 * @example
 * ```typescript
 * const days = getFestivalsInRange(
 *   new Date('2026-01-01'),
 *   new Date('2026-12-31'),
 *   DELHI,
 *   { timezone: 330 },
 * );
 * days.forEach(d => console.log(d.date.toDateString(), d.festival.name));
 * ```
 */
export function computeFestivalsInRange(
  start: Date,
  end: Date,
  location: GeoLocation,
  options: YearlyListingOptions,
): FestivalDay[] {
  validateDate(start);
  validateDate(end);
  validateLocation(location);
  if (start.getTime() > end.getTime()) {
    throw new RangeError(`start (${start.toISOString()}) must be ≤ end (${end.toISOString()})`);
  }
  const out: FestivalDay[] = [];
  const dayMs = 24 * 3600_000;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    // Only `festivals` is read. Eclipses are surfaced as festival entries, so
    // that section stays on; moon times and lunar windows are not needed.
    const p = getDailyPanchang(d, location, {
      ...options,
      sections: ['festivals', 'eclipse'],
      computeEndTimes: false,
    });
    if (p === null) continue;
    for (const f of p.festivals) {
      out.push({ date: p.date, festival: f });
    }
  }
  return out;
}

/**
 * Get the next `count` eclipses after `fromDate`, alternating between the
 * upcoming solar and upcoming lunar (whichever is sooner), up to the
 * requested count. Each entry includes the `visibleFromLocation` flag so
 * consumers can filter to locally-observable eclipses.
 *
 * @example
 * ```typescript
 * const next3 = getUpcomingEclipses(new Date('2026-01-01'), DELHI, 3);
 * next3.forEach(e => console.log(e.kind, e.subtype, e.peak.toISOString()));
 * ```
 */
export function getUpcomingEclipses(
  fromDate: Date,
  location: GeoLocation,
  count: number = 5,
): EclipseInfo[] {
  validateDate(fromDate);
  validateLocation(location);
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer, got ${count}`);
  }
  // Search 3 years ahead per call — eclipses recur every ~6 months globally
  // so 3 years is plenty for any small `count`. If the count is large, we
  // extend the window proportionally.
  const yearsAhead = Math.max(3, Math.ceil(count));
  const withinDays = yearsAhead * 366;

  const collected: EclipseInfo[] = [];
  let cursor = new Date(fromDate.getTime());

  while (collected.length < count) {
    const sol = getUpcomingSolarEclipse(cursor, location, withinDays);
    const lun = getUpcomingLunarEclipse(cursor, location, withinDays);
    if (!sol && !lun) break;
    let next: EclipseInfo;
    if (!sol) next = lun!;
    else if (!lun) next = sol;
    else next = sol.peak.getTime() < lun.peak.getTime() ? sol : lun;

    collected.push(next);
    // Advance cursor to just past the picked eclipse's end.
    cursor = new Date(next.end.getTime() + 1000);
  }

  return collected;
}

/**
 * Collect every eclipse whose peak falls within a date range, as observed
 * from `location`, sorted by `peak` ascending. The range counterpart to
 * {@link getUpcomingEclipses}, intended for building an eclipse calendar or
 * the static eclipse table (see `buildEclipsesTable`).
 *
 * Solar eclipses are found via *local* search, so only those whose path
 * touches `location` appear, and each carries the subtype seen locally
 * (e.g. a globally-total eclipse seen as `partial` from `location`). Lunar
 * eclipses are global; the `visibleFromLocation` flag reports whether the
 * Moon is above the horizon at peak. Filter on that flag for an
 * observable-only list.
 *
 * Each entry is a full {@link EclipseInfo} (timing, magnitude, visibility,
 * sutak window).
 *
 * @param start    Inclusive start date.
 * @param end      Inclusive end date.
 * @param location Observer coordinates.
 *
 * @example
 * ```typescript
 * const eclipses = getEclipsesInRange(
 *   new Date('2026-01-01'),
 *   new Date('2026-12-31'),
 *   DELHI,
 * );
 * eclipses.forEach(e => console.log(e.kind, e.subtype, e.peak.toISOString()));
 * ```
 */
export function computeEclipsesInRange(
  start: Date,
  end: Date,
  location: GeoLocation,
): EclipseInfo[] {
  validateDate(start);
  validateDate(end);
  validateLocation(location);
  if (start.getTime() > end.getTime()) {
    throw new RangeError(
      `start (${start.toISOString()}) must be ≤ end (${end.toISOString()})`,
    );
  }

  const spanDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 3600_000)) + 1;
  const endMs = end.getTime();
  // Each step jumps past one eclipse's end, and eclipses of a given kind are
  // months apart, so the real count is ~spanDays/60. This cap is several
  // times that — a runaway-loop backstop, never the exit (the null / past-end
  // check below ends the walk first).
  const maxSteps = Math.ceil(spanDays / 20) + 50;

  const walk = (next: (from: Date) => EclipseInfo | null): EclipseInfo[] => {
    const acc: EclipseInfo[] = [];
    let cursor = new Date(start.getTime());
    for (let step = 0; step < maxSteps; step++) {
      const e = next(cursor);
      if (!e || e.peak.getTime() > endMs) break;
      acc.push(e);
      cursor = new Date(e.end.getTime() + 1000);
    }
    return acc;
  };

  // `spanDays` as the search window keeps `from + spanDays ≥ end` for every
  // cursor ≥ start, so the underlying searches never stop short of `end`.
  const solar = walk(from => getUpcomingSolarEclipse(from, location, spanDays));
  const lunar = walk(from => getUpcomingLunarEclipse(from, location, spanDays));

  return [...solar, ...lunar].sort((a, b) => a.peak.getTime() - b.peak.getTime());
}

// ── Single-year compute entry points ─────────────────────────────────────────
//
// `build*Table` needs a table wrapper and a year *range*; these are the shape a
// consumer reaches for first — year in, results out — and are thin wrappers over
// the range enumerators above. The `compute*` prefix marks them as running the
// engine, against the `read*` prefix on the table accessors.

/** Local-year window `[startUtc, endUtc]` for `year` at `timezone`. */
function localYearWindow(year: number, timezone: number | string): [Date, Date] {
  const offset = resolveUtcOffset(timezone, new Date(Date.UTC(year, 6, 1)));
  return [
    new Date(Date.UTC(year, 0, 1) - offset * 60_000),
    new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - offset * 60_000),
  ];
}

/**
 * Every festival emission in the local calendar year `year`.
 *
 * @example
 * ```typescript
 * const days = computeFestivalsForYear(2027, DELHI, { timezone: 330 });
 * ```
 */
export function computeFestivalsForYear(
  year: number,
  location: GeoLocation,
  options: YearlyListingOptions,
): FestivalDay[] {
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const [start, end] = localYearWindow(year, options.timezone);
  return computeFestivalsInRange(start, end, location, options);
}

/**
 * Every eclipse whose peak falls in the local calendar year `year`, as observed
 * from `location`.
 *
 * @example
 * ```typescript
 * const eclipses = computeEclipsesForYear(2027, DELHI, { timezone: 330 });
 * ```
 */
export function computeEclipsesForYear(
  year: number,
  location: GeoLocation,
  options: { timezone: number | string },
): EclipseInfo[] {
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const [start, end] = localYearWindow(year, options.timezone);
  return computeEclipsesInRange(start, end, location);
}

/**
 * @deprecated Renamed to {@link computeEkadashiDatesForYear} in v5, so that
 * running the *engine* and reading a *table* stop sharing a `get*` prefix. Kept
 * through v5; see the README "Upgrading from 4.x" section.
 */
export const getEkadashiDatesForYear = computeEkadashiDatesForYear;

/** @deprecated Renamed to {@link computeSankrantisForYear} in v5. */
export const getSankrantisForYear = computeSankrantisForYear;

/** @deprecated Renamed to {@link computeFestivalsInRange} in v5. */
export const getFestivalsInRange = computeFestivalsInRange;

/** @deprecated Renamed to {@link computeEclipsesInRange} in v5. */
export const getEclipsesInRange = computeEclipsesInRange;
