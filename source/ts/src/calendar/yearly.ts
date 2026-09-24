import { getDailyLabels } from '../core/panchang';
import {
  getUpcomingSolarEclipse, getUpcomingLunarEclipse,
} from '../astronomy/eclipse';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { getTithiIndexFromLons } from '../core/tithi';
import { PanchangError } from '../types/errors';
import {
  resolveUtcOffset, utcToLocalDisplay, utcDateMs, wallClockToUtc, localYearWindow,
  civilDayStepper, clampToSupported, civilDayValue,
} from '../utils/timezone';
import { validateLocation, validateDate, validateLocalYearWindow } from '../utils/validation';
import type { GeoLocation } from '../types/location';
import type { AyanamsaType, MasaSystem, FestivalRegion, LegacyFestivalRegion } from '../types/options';
import type { EclipseInfo, FestivalInfo } from '../types/elements';
import { resolveMasaName } from '../i18n/resolver';

const DAY_MS = 24 * 3600_000;

export interface YearlyListingOptions {
  /** UTC offset in minutes (e.g. 330 for IST), or an IANA zone name. */
  timezone: number | string;
  ayanamsa?: AyanamsaType;
  masaSystem?: MasaSystem;
  language?: 'en' | 'hi';
  region?: FestivalRegion | LegacyFestivalRegion;
}

export interface FestivalDay {
  /**
   * The instant the day was queried at: its local midnight from `computeFestivalsForYear` (never
   * before 1900-01-01T00:00Z), the range start's local time of day from `computeFestivalsInRange`.
   * Read its date in the listing's timezone, not with `toISOString()`.
   */
  date: Date;
  festival: FestivalInfo;
}

export interface SankrantiEvent {
  /**
   * Civil day the transit is observed on, per the almanac's sunset rule, as the UTC midnight that falls
   * within that local day: the date's own UTC midnight at or east of UTC, the next one west of it, so
   * read it in the listing's timezone.
   */
  date: Date;
  moment: Date;
  /** Rashi the Sun transitioned INTO (0..11). */
  rashi: number;
  rashiName: string;
}

/**
 * Smarta Ekadashi fast dates in a Gregorian year (the local calendar year in `options.timezone`); no
 * arunodaya (Dashami-viddha) deferral. Each is the UTC midnight that falls within the local day of
 * the fast, so read it in that zone: the UTC midnight of the fast's own date at every offset at or
 * east of UTC, and the next UTC midnight west of it.
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
  const first = utcDateMs(year, 0, 1);
  const last = utcDateMs(year, 11, 31);
  const ayanamsa = options.ayanamsa ?? 'lahiri';

  const days: Array<{ d: number; tithi: number }> = [];
  let offset: number | undefined;
  for (let d = first - dayMs; d <= last + 2 * dayMs; d += dayMs) {
    const [midnight, dayOffset] = wallClockToUtc(d, options.timezone, offset);
    offset = dayOffset;
    if (Math.floor((midnight + dayOffset * 60_000) / dayMs) * dayMs !== d) continue;
    let sunriseUtc: Date;
    try {
      sunriseUtc = computeSunrise(new Date(midnight), location);
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
    const nextEntry = days[i + 1];
    const next = nextEntry !== undefined && nextEntry.d - d === dayMs
      ? nextEntry.tithi
      : undefined;
    let fast: number | undefined;
    if ((tithi === 10 || tithi === 25) && next !== tithi) {
      fast = d;
      if ((next === 12 || next === 27) && i > 0 && d - days[i - 1]!.d === dayMs) {
        fast = days[i - 1]!.d;
      }
    } else if ((tithi === 9 && next === 11) || (tithi === 24 && next === 26)) {
      fast = d;
    }
    if (fast !== undefined && fast >= first && fast <= last) {
      out.push(new Date(civilDayValue(fast, options.timezone)));
    }
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
  const offsetAt = (ms: number) => resolveUtcOffset(options.timezone, new Date(ms));
  const sunAt = (ms: number) => getSiderealSunLongitude(new Date(ms), ayanamsa);
  const rashiAt = (ms: number) => Math.floor(sunAt(ms) / 30) % 12;

  // The scan grid's offset only aligns the daily probes: each transit's year comes from its own day.
  const gridOffset = offsetAt(utcDateMs(year, 6, 1));
  const scanStart = utcDateMs(year, 0, 1) - gridOffset * 60_000 - dayMs;
  const scanEnd = utcDateMs(year, 11, 31) + (23 * 60 + 59) * 60_000 - gridOffset * 60_000 + dayMs;

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
    } catch (e: unknown) {
      if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) throw e;
      anchor = transitUtc;
    }

    const local = utcToLocalDisplay(anchor, offsetAt(anchor.getTime()));
    const date = new Date(civilDayValue(utcDateMs(
      local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(),
    ), options.timezone));
    if (local.getUTCFullYear() === year) {
      out.push({ date, moment: transitUtc, rashi, rashiName: resolveMasaName(rashi, lang) });
    }

    prevMs = t;
    prevRashi = rashi;
  }
  return out;
}

/** Every festival emission in an inclusive range, one civil day of `options.timezone` at a time. */
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
  return festivalsOnCivilDays(start.getTime(), end.getTime(), location, options);
}

function festivalsOnCivilDays(
  startMs: number,
  endMs: number,
  location: GeoLocation,
  options: YearlyListingOptions,
): FestivalDay[] {
  const out: FestivalDay[] = [];
  const dayOptions = {
    ...options,
    sections: ['festivals', 'eclipse'] as const,
    computeEndTimes: false,
  };
  const next = civilDayStepper(startMs, options.timezone);
  for (let t = next(); t <= endMs; t = next()) {
    const day = getDailyLabels(new Date(clampToSupported(t)), location, dayOptions);
    if (day === null) continue;
    for (const f of day.festivals) {
      out.push({ date: day.date, festival: f });
    }
  }
  return out;
}

/**
 * The next `count` eclipses after `fromDate`, solar and lunar merged by peak. Only `fromDate` is checked against
 * 1900..2100: the walk is not clipped at 2100 and runs until it has `count` eclipses (the Go port has no default
 * count and adds a cancellable `GetUpcomingEclipsesContext`).
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

  const spanDays = Math.ceil((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const startMs = start.getTime();
  const endMs = end.getTime();
  const maxSteps = Math.ceil(spanDays / 20) + 50;

  // A walk only finds syzygies at or after `start`; the search from a day earlier adds one that peaks after it.
  const walk = (next: (from: Date, withinDays: number) => EclipseInfo | null): EclipseInfo[] => {
    const acc: EclipseInfo[] = [];
    let cursor = new Date(startMs);
    for (let step = 0; step < maxSteps; step++) {
      const e = next(cursor, spanDays);
      if (!e || e.peak.getTime() > endMs) break;
      if (e.peak.getTime() >= startMs) acc.push(e);
      cursor = new Date(e.end.getTime() + 1000);
    }
    const early = next(new Date(startMs - DAY_MS), 2);
    if (
      early && early.peak.getTime() >= startMs && early.peak.getTime() <= endMs &&
      !acc.some(e => Math.abs(e.peak.getTime() - early.peak.getTime()) < DAY_MS)
    ) {
      acc.unshift(early);
    }
    return acc;
  };

  const solar = walk((from, days) => getUpcomingSolarEclipse(from, location, days));
  const lunar = walk((from, days) => getUpcomingLunarEclipse(from, location, days));

  return [...solar, ...lunar].sort((a, b) => a.peak.getTime() - b.peak.getTime());
}

/** Every festival emission in local calendar year `year`, each day queried at its local midnight. */
export function computeFestivalsForYear(
  year: number,
  location: GeoLocation,
  options: YearlyListingOptions,
): FestivalDay[] {
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const [start, end] = localYearWindow(year, options.timezone);
  validateLocalYearWindow(year, start, end);
  validateLocation(location);
  return festivalsOnCivilDays(start, end, location, options);
}

/** Every eclipse peaking in local calendar year `year`, as {@link computeEclipsesInRange} lists them. */
export function computeEclipsesForYear(
  year: number,
  location: GeoLocation,
  options: { timezone: number | string },
): EclipseInfo[] {
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const [start, end] = localYearWindow(year, options.timezone);
  validateLocalYearWindow(year, start, end);
  return computeEclipsesInRange(
    new Date(clampToSupported(start)), new Date(clampToSupported(end)), location,
  );
}

/** @deprecated Renamed to {@link computeEkadashiDatesForYear} in v5. */
export const getEkadashiDatesForYear = computeEkadashiDatesForYear;

/** @deprecated Renamed to {@link computeSankrantisForYear} in v5. */
export const getSankrantisForYear = computeSankrantisForYear;

/** @deprecated Renamed to {@link computeFestivalsInRange} in v5. */
export const getFestivalsInRange = computeFestivalsInRange;

/** @deprecated Renamed to {@link computeEclipsesInRange} in v5. */
export const getEclipsesInRange = computeEclipsesInRange;
