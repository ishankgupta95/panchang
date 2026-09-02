import { getDailyPanchang } from '../core/panchang';
import { computeSamvat, chaitraNewMoon } from '../core/samvat';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { resolveUtcOffset } from '../utils/timezone';
import { validateLocation, validateDate } from '../utils/validation';
import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';
import type { AyanamsaType, MasaSystem, FestivalRegion, LegacyFestivalRegion } from '../types/options';

/** Hindu calendar coordinates for a UTC date, read at sunrise. */
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

/** Gregorian date → Hindu lunisolar coordinates at sunrise; time-of-day is ignored. */
export function convertGregorianToHindu(
  date: Date,
  location: GeoLocation,
  options: ConvertOptions,
): HinduCalendarCoords {
  validateDate(date);
  validateLocation(location);
  const panchang = getDailyPanchang(date, location, options);
  if (panchang === null) {
    throw new PanchangError(
      `Cannot convert ${date.toISOString()} to Hindu calendar: polar location with no sunrise`,
      'NO_SUNRISE',
    );
  }
  const tithiAtSunrise = panchang.angas.tithis[0]!;
  return {
    tithiName: tithiAtSunrise.name,
    tithi: tithiAtSunrise.index + 1,
    pakshaTithi: tithiAtSunrise.number,
    paksha: tithiAtSunrise.index < 15 ? 'shukla' : 'krishna',
    masaName: panchang.calendar.chandramasa.name,
    masaIndex: panchang.calendar.chandramasa.index,
    isAdhika: panchang.calendar.chandramasa.isAdhika,
    vikramSamvat: panchang.calendar.samvat.vikramSamvat,
    shakaSamvat: panchang.calendar.samvat.shakaSamvat,
    varaName: panchang.angas.vara.name,
    varaIndex: panchang.angas.vara.index,
  };
}

/** Hindu lunisolar coordinates → Gregorian dates; more than one when the tithi repeats. */
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

  const ceYear = coords.vikramSamvat - 57;
  const dayMs = 24 * 3600_000;
  const masaSystem = options.masaSystem ?? 'purnimanta';
  const wrapsYearEnd =
    masaSystem === 'purnimanta' && coords.masaIndex === 0 && coords.paksha === 'krishna';
  const masaMidMs = wrapsYearEnd
    ? Date.UTC(ceYear + 1, 2, 10)
    : Date.UTC(ceYear, 2, 25) + coords.masaIndex * 30 * dayMs;
  const start = new Date(masaMidMs - 50 * dayMs);
  const end = new Date(masaMidMs + 60 * dayMs);
  const targetTithi = coords.paksha === 'shukla'
    ? coords.pakshaTithi - 1
    : coords.pakshaTithi - 1 + 15;

  const out: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const p = getDailyPanchang(d, location, options);
    if (p === null) continue;
    const tithi = p.angas.tithis[0]!.index;
    const masa = p.calendar.chandramasa.index;
    if (tithi !== targetTithi) continue;
    if (masa !== coords.masaIndex) continue;
    if (p.calendar.samvat.vikramSamvat !== coords.vikramSamvat) continue;
    if (coords.adhikaOnly && !p.calendar.chandramasa.isAdhika) continue;
    out.push(p.date);
  }
  return out;
}

const KALIYUGA_EPOCH_YEAR = -3101; // Kali Yuga begins 18 Feb 3102 BCE (proleptic).

/** Kali Yuga year, incrementing at Chaitra Shukla Pratipada, not on the Gregorian anniversary. */
export function getKaliYugaYear(date: Date): number {
  validateDate(date);
  const y = date.getUTCFullYear();
  const pastNewYear = date.getTime() >= chaitraNewMoon(y);
  return y - KALIYUGA_EPOCH_YEAR + (pastNewYear ? 0 : -1);
}

/** Chaitra Shukla Pratipada, or Mesha Sankranti in Tamil Nadu, Kerala, Punjab, Bengal and Assam. */
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
    region === 'assam'
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
  const amantaOptions = { ...options, masaSystem: 'amanta' as const };
  const start = new Date(Date.UTC(gregorianYear, 1, 15));
  const end = new Date(Date.UTC(gregorianYear, 4, 15));
  const dayMs = 24 * 3600_000;
  let prev: { masa: number; adhika: boolean } | null = null;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const p = getDailyPanchang(d, location, amantaOptions);
    if (p === null) continue;
    const masa = p.calendar.chandramasa.index;
    const adhika = p.calendar.chandramasa.isAdhika;
    if (masa === 0 && !adhika && prev !== null && (prev.masa !== 0 || prev.adhika)) {
      return p.date;
    }
    prev = { masa, adhika };
  }
  return null;
}

type MeshaDayRule = 'sankranti-day' | 'civil-day' | 'next-sunrise' | 'civil-day-plus-1';

function meshaDayRuleFor(region: FestivalRegion | LegacyFestivalRegion): MeshaDayRule {
  switch (region) {
    case 'punjab':
      return 'civil-day';
    case 'kerala':
      return 'next-sunrise';
    case 'bengal':
    case 'west-bengal':
      return 'civil-day-plus-1';
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
  const offset = resolveUtcOffset(options.timezone, new Date(Date.UTC(gregorianYear, 3, 1)));
  const ayanamsa = options.ayanamsa ?? 'lahiri';
  const rashiAt = (ms: number) =>
    Math.floor(getSiderealSunLongitude(new Date(ms), ayanamsa) / 30) % 12;

  const dayMs = 24 * 3600_000;
  const scanStart = Date.UTC(gregorianYear, 3, 1) - offset * 60_000 - dayMs;
  const scanEnd = Date.UTC(gregorianYear, 3, 20) - offset * 60_000;
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
    const local = new Date(ms + offset * 60_000);
    return new Date(Date.UTC(
      local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayShift,
    ));
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
