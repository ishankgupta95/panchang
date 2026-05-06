import { getDailyPanchang, getInstantPanchang } from '../core/panchang';
import {
  getUpcomingSolarEclipse, getUpcomingLunarEclipse,
} from '../astronomy/eclipse';
import { validateLocation, validateDate } from '../utils/validation';
import type { GeoLocation } from '../types/location';
import type { AyanamsaType, MasaSystem, FestivalRegion, LegacyFestivalRegion } from '../types/options';
import type { EclipseInfo, FestivalInfo } from '../types/elements';

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
export function getEkadashiDatesForYear(
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
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const p = getDailyPanchang(d, location, options);
    if (p === null) continue;
    const t0 = p.tithis[0]!.index;
    if (t0 === 10 || t0 === 25) {
      out.push(p.date);
    }
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
export function getSankrantisForYear(
  year: number,
  location: GeoLocation,
  options: YearlyListingOptions,
): SankrantiEvent[] {
  validateLocation(location);
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const out: SankrantiEvent[] = [];
  const dayMs = 24 * 3600_000;
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const lang = options.language ?? 'en';
  const rashiNames = lang === 'hi' ? RASHI_NAMES_HI : RASHI_NAMES_EN;

  let prevRashi: number | null = null;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const p = getInstantPanchang(d, location, options);
    if (p === null) continue;
    const rashi = Math.floor(p.siderealSun / 30) % 12;
    if (prevRashi !== null && rashi !== prevRashi) {
      out.push({ date: d, rashi, rashiName: rashiNames[rashi]! });
    }
    prevRashi = rashi;
  }
  return out;
}

/** Solar rashi names — `en` and `hi` mirror the panchang-ts masa name lists. */
const RASHI_NAMES_EN: readonly string[] = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
  'Simha', 'Kanya', 'Tula', 'Vrischika',
  'Dhanus', 'Makara', 'Kumbha', 'Meena',
];
const RASHI_NAMES_HI: readonly string[] = [
  'मेष', 'वृषभ', 'मिथुन', 'कर्क',
  'सिंह', 'कन्या', 'तुला', 'वृश्चिक',
  'धनु', 'मकर', 'कुम्भ', 'मीन',
];

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
export function getFestivalsInRange(
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
    const p = getDailyPanchang(d, location, options);
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
