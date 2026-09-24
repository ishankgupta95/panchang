import { getDailyLabels } from '../core/panchang';
import { computeSamvat, chaitraNewMoon } from '../core/samvat';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getSiderealSunLongitude } from '../astronomy/sun';
import {
  resolveUtcOffset, utcDateMs, instantInCivilDay, civilDayValue, SUPPORTED_START_MS, SUPPORTED_END_MS,
} from '../utils/timezone';
import { validateLocation, validateDate } from '../utils/validation';
import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';
import type {
  AyanamsaType, MasaSystem, FestivalRegion, LegacyFestivalRegion, PanchangOptions,
} from '../types/options';

/** Hindu calendar coordinates of one civil day, read at its sunrise. */
export interface HinduCalendarCoords {
  tithiName: string;
  /** 1 = Shukla Pratipada … 30 = Amavasya, not the 0..29 used internally. */
  tithi: number;
  pakshaTithi: number;
  paksha: 'shukla' | 'krishna';
  /** Carries the 'Adhika' prefix when the month is intercalary. */
  masaName: string;
  /** 0..11, in the configured `masaSystem`. */
  masaIndex: number;
  isAdhika: boolean;
  vikramSamvat: number;
  shakaSamvat: number;
  varaName: string;
  /** 0 = Sunday … 6 = Saturday. */
  varaIndex: number;
}

export interface ConvertOptions {
  /** Minutes east of UTC (`330` for IST), or an IANA zone name. */
  timezone: number | string;
  ayanamsa?: AyanamsaType;
  masaSystem?: MasaSystem;
  language?: 'en' | 'hi';
}

/** The converters read only a day's sunrise tithi, vara, lunar month and samvat, which no
 * section and no end-time search changes, so every section is off. */
function labelOptions(options: ConvertOptions): PanchangOptions {
  return { ...options, sections: [], computeEndTimes: false };
}

/**
 * Gregorian date → Hindu lunisolar coordinates at sunrise of the calendar day containing `date`
 * in `options.timezone`. West of UTC a UTC-midnight label names the day before; pass an instant
 * inside the wanted local day, such as a date `convertHinduToGregorian` returns.
 */
export function convertGregorianToHindu(
  date: Date,
  location: GeoLocation,
  options: ConvertOptions,
): HinduCalendarCoords {
  validateDate(date);
  validateLocation(location);
  const day = getDailyLabels(date, location, labelOptions(options));
  if (day === null) {
    throw new PanchangError(
      `Cannot convert ${date.toISOString()} to Hindu calendar: polar location with no sunrise`,
      'NO_SUNRISE',
    );
  }
  const tithiAtSunrise = day.tithi;
  return {
    tithiName: tithiAtSunrise.name,
    tithi: tithiAtSunrise.index + 1,
    pakshaTithi: tithiAtSunrise.number,
    paksha: tithiAtSunrise.index < 15 ? 'shukla' : 'krishna',
    masaName: day.chandramasa.name,
    masaIndex: day.chandramasa.index,
    isAdhika: day.chandramasa.isAdhika,
    vikramSamvat: day.samvat.vikramSamvat,
    shakaSamvat: day.samvat.shakaSamvat,
    varaName: day.vara.name,
    varaIndex: day.vara.index,
  };
}

/**
 * Hindu lunisolar coordinates → Gregorian dates, each the UTC midnight that falls within a local day
 * whose sunrise carries them (that date's own UTC midnight at or east of UTC, the next one west of
 * it, so read them in `options.timezone`); more than one when the tithi repeats. A `vikramSamvat`
 * that is not an integer, or whose scan window leaves 1900..2100 (or the Date range), throws
 * `PanchangError` `INVALID_DATE`.
 */
export function convertHinduToGregorian(
  coords: {
    vikramSamvat: number;
    masaIndex: number;
    paksha: 'shukla' | 'krishna';
    pakshaTithi: number;
    adhikaOnly?: boolean;
  },
  location: GeoLocation,
  options: ConvertOptions,
): Date[] {
  validateLocation(location);
  if (!Number.isInteger(coords.masaIndex) || coords.masaIndex < 0 || coords.masaIndex > 11) {
    throw new RangeError(`masaIndex must be in [0, 11], got ${coords.masaIndex}`);
  }
  if (!Number.isInteger(coords.pakshaTithi) || coords.pakshaTithi < 1 || coords.pakshaTithi > 15) {
    throw new RangeError(`pakshaTithi must be in [1, 15], got ${coords.pakshaTithi}`);
  }
  if (coords.paksha !== 'shukla' && coords.paksha !== 'krishna') {
    throw new RangeError(`paksha must be 'shukla' or 'krishna'`);
  }
  if (!Number.isInteger(coords.vikramSamvat)) {
    throw new PanchangError(`vikramSamvat must be an integer, got ${coords.vikramSamvat}`, 'INVALID_DATE');
  }

  const ceYear = coords.vikramSamvat - 57;
  const dayMs = 24 * 3600_000;
  const masaSystem = options.masaSystem ?? 'purnimanta';
  const wrapsYearEnd =
    masaSystem === 'purnimanta' && coords.masaIndex === 0 && coords.paksha === 'krishna';
  const masaMidMs = wrapsYearEnd
    ? utcDateMs(ceYear + 1, 2, 10)
    : utcDateMs(ceYear, 2, 25) + coords.masaIndex * 30 * dayMs;
  validateDate(new Date(masaMidMs - 50 * dayMs), 'any');
  validateDate(new Date(masaMidMs + 60 * dayMs), 'any');
  const targetTithi = coords.paksha === 'shukla'
    ? coords.pakshaTithi - 1
    : coords.pakshaTithi - 1 + 15;

  const dayOptions = labelOptions(options);
  const scan = (first: number, last: number): Date[] => {
    const out: Date[] = [];
    for (let day = first; day <= last; day += dayMs) {
      validateDate(new Date(day));
      const t = instantInCivilDay(day, options.timezone);
      if (t === null) continue;
      const p = getDailyLabels(new Date(t), location, dayOptions);
      if (p === null) continue;
      const tithi = p.tithi.index;
      const masa = p.chandramasa.index;
      if (tithi !== targetTithi) continue;
      if (masa !== coords.masaIndex) continue;
      if (p.samvat.vikramSamvat !== coords.vikramSamvat) continue;
      if (coords.adhikaOnly && !p.chandramasa.isAdhika) continue;
      out.push(new Date(civilDayValue(day, options.timezone)));
    }
    return out;
  };

  const out = scan(masaMidMs - 50 * dayMs, masaMidMs + 60 * dayMs);
  if (!wrapsYearEnd) return out;
  // An Adhika Chaitra's Krishna paksha opens the samvat year instead of closing it.
  const adhikaMid = utcDateMs(ceYear, 2, 25);
  return [
    ...scan(
      Math.max(adhikaMid - 50 * dayMs, SUPPORTED_START_MS),
      Math.min(adhikaMid + 60 * dayMs, SUPPORTED_END_MS),
    ),
    ...out,
  ];
}

const KALIYUGA_EPOCH_YEAR = -3101; // Kali Yuga begins 18 Feb 3102 BCE (proleptic).

/** Kali Yuga year, incrementing at Chaitra Shukla Pratipada, not on the Gregorian anniversary. */
export function getKaliYugaYear(date: Date): number {
  validateDate(date);
  const y = date.getUTCFullYear();
  const pastNewYear = date.getTime() >= chaitraNewMoon(y);
  return y - KALIYUGA_EPOCH_YEAR + (pastNewYear ? 0 : -1);
}

/**
 * The day the Hindu year begins: Chaitra Shukla Pratipada (the day containing it when no sunrise
 * does, as for Ugadi), or, in Tamil Nadu, Kerala, Punjab, Bengal, Assam and Odisha, the Mesha
 * Sankranti day by that region's rule (Odisha's Pana Sankranti: the transit's civil date, or the next
 * one when the transit falls later than 0.315 of the night after sunset). Either way the value is the
 * UTC midnight that falls within that local day, the date's own UTC midnight at or east of UTC and
 * the next one west of it, so read it in `options.timezone`.
 */
export function getHinduNewYear(
  gregorianYear: number,
  region: FestivalRegion | LegacyFestivalRegion,
  location: GeoLocation,
  options: ConvertOptions,
): Date | null {
  validateLocation(location);
  if (!Number.isInteger(gregorianYear)) {
    throw new RangeError(`gregorianYear must be integer, got ${gregorianYear}`);
  }

  const useSolarAnchor = (
    region === 'tamil' || region === 'tamil-nadu' ||
    region === 'kerala' ||
    region === 'punjab' ||
    region === 'bengal' || region === 'west-bengal' ||
    region === 'assam' ||
    region === 'odisha'
  );

  if (useSolarAnchor) {
    return findMeshaSankranti(gregorianYear, region, location, options);
  }

  return findChaitraShuklaPratipada(gregorianYear, location, options);
}

function findChaitraShuklaPratipada(
  gregorianYear: number,
  location: GeoLocation,
  options: ConvertOptions,
): Date | null {
  const amantaOptions = labelOptions({ ...options, masaSystem: 'amanta' });
  const dayMs = 24 * 3600_000;
  const last = utcDateMs(gregorianYear, 4, 15);
  let prev: { day: number; masa: number; adhika: boolean; tithi: number } | null = null;
  for (let day = utcDateMs(gregorianYear, 1, 15); day <= last; day += dayMs) {
    validateDate(new Date(day));
    const t = instantInCivilDay(day, options.timezone);
    if (t === null) continue;
    const p = getDailyLabels(new Date(t), location, amantaOptions);
    if (p === null) continue;
    const masa = p.chandramasa.index;
    const adhika = p.chandramasa.isAdhika;
    const tithi = p.tithi.index;
    if (masa === 0 && !adhika && prev !== null && (prev.masa !== 0 || prev.adhika)) {
      const kshayaPratipada =
        prev.day === day - dayMs && !prev.adhika && prev.tithi === 29 && tithi === 1;
      return new Date(civilDayValue(kshayaPratipada ? prev.day : day, options.timezone));
    }
    prev = { day, masa, adhika, tithi };
  }
  return null;
}

type MeshaDayRule = 'sankranti-day' | 'civil-day' | 'next-sunrise' | 'civil-day-plus-1' | 'night-cutoff';

/**
 * Pana Sankranti moves to the next civil date once the transit is this far into the night, in
 * thousandths of sunset to sunrise: the reference almanac's Bhubaneswar dates put the boundary
 * between 305 (2067, same date) and 327 (2028, next date).
 */
const PANA_NIGHT_CUTOFF_PER_MILLE = 315;

function meshaDayRuleFor(region: FestivalRegion | LegacyFestivalRegion): MeshaDayRule {
  switch (region) {
    case 'punjab':
      return 'civil-day';
    case 'kerala':
      return 'next-sunrise';
    case 'bengal':
    case 'west-bengal':
      return 'civil-day-plus-1';
    case 'odisha':
      return 'night-cutoff';
    default:
      return 'sankranti-day';
  }
}

function findMeshaSankranti(
  gregorianYear: number,
  region: FestivalRegion | LegacyFestivalRegion,
  location: GeoLocation,
  options: ConvertOptions,
): Date | null {
  const offsetAt = (ms: number) => resolveUtcOffset(options.timezone, new Date(ms));
  const gridOffset = offsetAt(utcDateMs(gregorianYear, 3, 1));
  const ayanamsa = options.ayanamsa ?? 'lahiri';
  const rashiAt = (ms: number) =>
    Math.floor(getSiderealSunLongitude(new Date(ms), ayanamsa) / 30) % 12;

  const dayMs = 24 * 3600_000;
  const scanStart = utcDateMs(gregorianYear, 3, 1) - gridOffset * 60_000 - dayMs;
  const scanEnd = utcDateMs(gregorianYear, 3, 20) - gridOffset * 60_000;
  let transitMs: number | null = null;
  let prevMs = scanStart;
  let prevRashi = rashiAt(prevMs);
  for (let t = scanStart + dayMs; t <= scanEnd; t += dayMs) {
    const rashi = rashiAt(t);
    if (rashi !== prevRashi && rashi === 0) {
      let lo = prevMs, hi = t;
      while (hi - lo > 1000) {
        const mid = Math.floor((lo + hi) / 2);
        if (rashiAt(mid) === prevRashi) lo = mid; else hi = mid;
      }
      transitMs = hi;
      break;
    }
    prevMs = t;
    prevRashi = rashi;
  }
  if (transitMs === null) return null;

  const civilDay = (ms: number, dayShift = 0): Date => {
    const local = new Date(ms + offsetAt(ms) * 60_000);
    return new Date(civilDayValue(utcDateMs(
      local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayShift,
    ), options.timezone));
  };

  const rule = meshaDayRuleFor(region);
  if (rule === 'civil-day') return civilDay(transitMs);
  if (rule === 'civil-day-plus-1') return civilDay(transitMs, 1);

  try {
    let dayStart = computeSunrise(new Date(transitMs - 30 * 3600_000), location);
    for (let i = 0; i < 3; i++) {
      const next = computeSunrise(computeSunset(dayStart, location), location);
      if (next.getTime() <= transitMs) dayStart = next; else break;
    }
    if (rule === 'next-sunrise') {
      const sunriseAfter = dayStart.getTime() >= transitMs
        ? dayStart
        : computeSunrise(computeSunset(dayStart, location), location);
      return civilDay(sunriseAfter.getTime());
    }
    const dayEnd = computeSunset(dayStart, location);
    if (rule === 'night-cutoff') {
      if (transitMs <= dayEnd.getTime()) return civilDay(transitMs);
      const nextSunrise = computeSunrise(dayEnd, location).getTime();
      const late = 1000 * (transitMs - dayEnd.getTime())
        > PANA_NIGHT_CUTOFF_PER_MILLE * (nextSunrise - dayEnd.getTime());
      return civilDay(late ? nextSunrise : transitMs);
    }
    const anchor = transitMs <= dayEnd.getTime()
      ? dayStart
      : computeSunrise(dayEnd, location);
    return civilDay(anchor.getTime());
  } catch (e: unknown) {
    if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) {
      throw e;
    }
    return civilDay(transitMs);
  }
}

export { computeSamvat };
