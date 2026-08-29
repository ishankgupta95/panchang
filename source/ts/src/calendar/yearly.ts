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
  /** UTC offset in minutes (e.g. 330 for IST), or an IANA zone name. */
  timezone: number | string;
  ayanamsa?: AyanamsaType;
  masaSystem?: MasaSystem;
  language?: 'en' | 'hi';
  region?: FestivalRegion | LegacyFestivalRegion;
}

export interface FestivalDay {
  /** A *local* midnight: `toISOString().slice(0, 10)` is off by one east of Greenwich. */
  date: Date;
  festival: FestivalInfo;
}

export interface SankrantiEvent {
  /** Civil day the transit is observed on, per the almanac's sunset rule. */
  date: Date;
  moment: Date;
  /** Rashi the Sun transitioned INTO (0..11). */
  rashi: number;
  rashiName: string;
}

/** Smarta Ekadashi fast dates in a Gregorian year; no arunodaya (Dashami-viddha) deferral. */
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

  // The unused second sunrise call is load-bearing: it drops polar days exactly
  // as `getDailyPanchang` does. The extra day past Dec 31 feeds the lookahead.
  const days: Array<{ d: Date; tithi: number }> = [];
  for (let t = start.getTime(); t <= end.getTime() + dayMs; t += dayMs) {
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
    days.push({ d, tithi: tithiIndex });
  }

  for (let i = 0; i < days.length; i++) {
    const { d, tithi } = days[i]!;
    if (d.getTime() > end.getTime()) break;
    const nextEntry = days[i + 1];
    const next = nextEntry !== undefined && nextEntry.d.getTime() - d.getTime() === dayMs
      ? nextEntry.tithi
      : undefined;
    const isEkadashi = tithi === 10 || tithi === 25;
    if (isEkadashi && next !== tithi) {
      // Kshaya Dwadashi (Trisprisha): no parana morning, so the fast moves back a day.
      if ((next === 12 || next === 27) && i > 0) {
        const prevEntry = days[i - 1]!;
        if (d.getTime() - prevEntry.d.getTime() === dayMs) {
          out.push(prevEntry.d);
          continue;
        }
      }
      out.push(d);
      continue;
    }
    // Kshaya Ekadashi: the tithi touches no sunrise; fast on its begin day.
    if ((tithi === 9 && next === 11) || (tithi === 24 && next === 26)) out.push(d);
  }
  return out;
}

/** All 12 Sankranti (solar transit) dates for a Gregorian year, one per rashi. */
export function computeSankrantisForYear(
  year: number,
  location: GeoLocation,
  options: YearlyListingOptions,
): SankrantiEvent[] {
  validateLocation(location);
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const lang = options.language ?? 'en';
  const ayanamsa = options.ayanamsa ?? 'lahiri';
  const dayMs = 24 * 3600_000;
  const offset = resolveUtcOffset(options.timezone, new Date(Date.UTC(year, 6, 1)));
  const sunAt = (ms: number) => getSiderealSunLongitude(new Date(ms), ayanamsa);
  const rashiAt = (ms: number) => Math.floor(sunAt(ms) / 30) % 12;

  const scanStart = Date.UTC(year, 0, 1) - offset * 60_000 - dayMs;
  const scanEnd = Date.UTC(year, 11, 31, 23, 59) - offset * 60_000 + dayMs;

  const out: SankrantiEvent[] = [];
  let prevMs = scanStart;
  let prevRashi = rashiAt(prevMs);
  for (let t = scanStart + dayMs; t <= scanEnd; t += dayMs) {
    const rashi = rashiAt(t);
    if (rashi === prevRashi) { prevMs = t; prevRashi = rashi; continue; }

    let lo = prevMs, hi = t;
    while (hi - lo > 1000) {
      const mid = Math.floor((lo + hi) / 2);
      if (rashiAt(mid) === prevRashi) lo = mid; else hi = mid;
    }
    const transitUtc = new Date(hi);

    // Per the almanac, a transit after sunset belongs to the next sunrise's civil day.
    let anchor: Date;
    try {
      let dayStart = computeSunrise(new Date(hi - 30 * 3600_000), location);
      for (let i = 0; i < 3; i++) {
        const next = computeSunrise(computeSunset(dayStart, location), location);
        if (next.getTime() <= hi) dayStart = next; else break;
      }
      const dayEnd = computeSunset(dayStart, location);
      anchor = hi <= dayEnd.getTime()
        ? dayStart
        : computeSunrise(dayEnd, location);
    } catch {
      anchor = transitUtc;
    }

    const local = utcToLocalDisplay(anchor, offset);
    const date = new Date(Date.UTC(
      local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(),
    ));
    if (local.getUTCFullYear() === year) {
      out.push({ date, moment: transitUtc, rashi, rashiName: resolveMasaName(rashi, lang) });
    }

    prevMs = t;
    prevRashi = rashi;
  }
  return out;
}

/** Every festival emission in an inclusive date range. */
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
    // Eclipses surface as festival entries, so that section has to stay on.
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

/** The next `count` eclipses after `fromDate`, solar and lunar merged by peak. */
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
  // Eclipses recur every ~6 months, so 3 years covers a small `count`.
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
    cursor = new Date(next.end.getTime() + 1000);
  }

  return collected;
}

/** Every eclipse peaking in a range, sorted by `peak`; solar ones are location-filtered. */
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
  // Runaway-loop backstop, never the exit: the checks below end the walk first.
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

  // `spanDays` as the window keeps `from + spanDays ≥ end` for every cursor.
  const solar = walk(from => getUpcomingSolarEclipse(from, location, spanDays));
  const lunar = walk(from => getUpcomingLunarEclipse(from, location, spanDays));

  return [...solar, ...lunar].sort((a, b) => a.peak.getTime() - b.peak.getTime());
}

function localYearWindow(year: number, timezone: number | string): [Date, Date] {
  const offset = resolveUtcOffset(timezone, new Date(Date.UTC(year, 6, 1)));
  return [
    new Date(Date.UTC(year, 0, 1) - offset * 60_000),
    new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - offset * 60_000),
  ];
}

export function computeFestivalsForYear(
  year: number,
  location: GeoLocation,
  options: YearlyListingOptions,
): FestivalDay[] {
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const [start, end] = localYearWindow(year, options.timezone);
  return computeFestivalsInRange(start, end, location, options);
}

export function computeEclipsesForYear(
  year: number,
  location: GeoLocation,
  options: { timezone: number | string },
): EclipseInfo[] {
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const [start, end] = localYearWindow(year, options.timezone);
  return computeEclipsesInRange(start, end, location);
}

/** @deprecated Renamed to {@link computeEkadashiDatesForYear} in v5. */
export const getEkadashiDatesForYear = computeEkadashiDatesForYear;

/** @deprecated Renamed to {@link computeSankrantisForYear} in v5. */
export const getSankrantisForYear = computeSankrantisForYear;

/** @deprecated Renamed to {@link computeFestivalsInRange} in v5. */
export const getFestivalsInRange = computeFestivalsInRange;

/** @deprecated Renamed to {@link computeEclipsesInRange} in v5. */
export const getEclipsesInRange = computeEclipsesInRange;
