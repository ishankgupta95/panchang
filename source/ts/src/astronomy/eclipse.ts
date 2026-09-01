/** A solar eclipse can only happen at conjunction and a lunar one only at opposition, definitionally, so the search walks syzygies rather than time. */
import { findLunarEclipse, findLocalSolarEclipse } from './eclipseGeometry';
import { searchMoonPhase } from './lunation';
import { getMoonPosition, getTropicalMoonLongitude } from './moon';
import { getTropicalSunLongitude } from './sun';
import { bodyAltitudeDegrees, type HorizonBody } from './horizon';
import { normalize360 } from '../utils/angle';
import { getTranslations } from '../i18n/resolver';
import type { GeoLocation } from '../types/location';
import type { Language } from '../types/options';

export type EclipseSubtype = 'partial' | 'total' | 'annular' | 'penumbral';

export interface EclipseInfo {
  kind: 'solar' | 'lunar';
  subtype: EclipseSubtype;
  /** First contact: partial begin for solar, penumbral begin for lunar. */
  start: Date;
  peak: Date;
  /** Last contact: partial end for solar, penumbral end for lunar. */
  end: Date;
  /** Eclipsed body above the horizon at peak. */
  visibleFromLocation: boolean;
  /** Fraction of the body's disc **area** covered at greatest eclipse, [0, 1]; umbral for a lunar eclipse, so a penumbral one reads 0. */
  obscuration: number;
  /** Fraction of the body's *diameter* covered: not a [0, 1] fraction, since a total eclipse exceeds 1 and a penumbral lunar one is negative. Do not clamp. */
  magnitude: number;
  /** Sutak (impurity window) start; null for a penumbral lunar eclipse, which carries no sutak. */
  sutakStart: Date | null;
  sutakEnd: Date | null;
  description: string;
}

const SOLAR_SUTAK_HOURS = 12;
const LUNAR_SUTAK_HOURS = 9;

const DAY_MS = 86_400_000;

/** The largest geocentric lunar latitude still producing a solar eclipse anywhere on Earth is ~1.58°, ~1.50° for a lunar one; 1.8° covers both. */
const ECLIPSE_LATITUDE_LIMIT_DEG = 1.8;

/** Syzygies of a kind are never closer than ~29.2 days, so ten cannot skip one nor resolve back onto the one just examined. */
const SYZYGY_ADVANCE_DAYS = 10;

/** Topocentric, with refraction, matching the rise/set solver so the two cannot disagree about a body on the horizon. */
export function isBodyAboveHorizon(
  date: Date, location: GeoLocation, body: HorizonBody,
): boolean {
  return bodyAltitudeDegrees(date, location, body) > 0;
}

/** Whether an eclipse is observable from `location` during *any* phase, not only at peak as `EclipseInfo.visibleFromLocation` reports. */
export function isEclipseVisibleAnyPhase(
  eclipse: EclipseInfo,
  location: GeoLocation,
): boolean {
  const body: HorizonBody = eclipse.kind === 'solar' ? 'sun' : 'moon';
  const startMs = eclipse.start.getTime();
  const endMs = eclipse.end.getTime();
  const SAMPLES = 12;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = new Date(startMs + ((endMs - startMs) * i) / SAMPLES);
    if (isBodyAboveHorizon(t, location, body)) return true;
  }
  return false;
}

/** `syzygyLimitMs` bounds the syzygies, not the eclipse found: solar and lunar bound the eclipse on different contacts, so the caller checks that itself. */
function searchFromSyzygies<T>(
  fromUtc: Date,
  targetElongationDeg: number,
  syzygyLimitMs: number,
  attempt: (syzygy: Date) => T | null,
): T | null {
  let cursor = fromUtc;
  const maxIterations = Math.ceil((syzygyLimitMs - fromUtc.getTime()) / (29.5 * DAY_MS)) + 2;
  for (let i = 0; i < maxIterations; i++) {
    const syzygy = searchMoonPhase(targetElongationDeg, cursor, 45);
    if (syzygy === null || syzygy.getTime() > syzygyLimitMs) return null;
    if (Math.abs(getMoonPosition(syzygy).latitude) < ECLIPSE_LATITUDE_LIMIT_DEG) {
      const hit = attempt(syzygy);
      if (hit !== null) return hit;
    }
    cursor = new Date(syzygy.getTime() + SYZYGY_ADVANCE_DAYS * DAY_MS);
  }
  return null;
}

/**
 * Next lunar eclipse whose penumbral phase begins within `withinDays` days after `fromUtc`, or `null`.
 * @param location  only sets `visibleFromLocation`; never filters the result
 */
export function getUpcomingLunarEclipse(
  fromUtc: Date,
  location: GeoLocation,
  withinDays: number,
  lang: Language = 'en',
): EclipseInfo | null {
  const windowEndMs = fromUtc.getTime() + withinDays * DAY_MS;
  const eclipse = searchFromSyzygies(
    fromUtc, 180, windowEndMs + DAY_MS, (opposition) => {
      const found = findLunarEclipse(opposition);
      if (found === null) return null;
      if (found.penumbralEnd.getTime() <= fromUtc.getTime()) return null;
      return found;
    },
  );
  if (eclipse === null) return null;
  if (eclipse.penumbralBegin.getTime() > windowEndMs) return null;

  const subtype: EclipseSubtype = eclipse.kind;
  const umbralBegin = eclipse.partialBegin;
  const umbralEnd = eclipse.partialEnd;
  const hasUmbra = umbralBegin !== null && umbralEnd !== null;
  const visibleFromLocation = location
    ? isBodyAboveHorizon(eclipse.peak, location, 'moon')
    : false;

  return {
    kind: 'lunar',
    subtype,
    start: eclipse.penumbralBegin,
    peak: eclipse.peak,
    end: eclipse.penumbralEnd,
    visibleFromLocation,
    obscuration: eclipse.umbralObscuration,
    magnitude: eclipse.umbralMagnitude,
    sutakStart: hasUmbra
      ? new Date(umbralBegin.getTime() - LUNAR_SUTAK_HOURS * 3600_000)
      : null,
    sutakEnd: hasUmbra ? umbralEnd : null,
    description: describeEclipse(
      'lunar', subtype, eclipse.umbralObscuration, visibleFromLocation, lang,
    ),
  };
}

/**
 * Next solar eclipse whose local partial phase begins within `withinDays` days
 * after `fromUtc` with the Sun above the horizon at first or last contact from
 * `location`, or `null`; one entirely below the horizon is skipped, not flagged.
 */
export function getUpcomingSolarEclipse(
  fromUtc: Date,
  location: GeoLocation,
  withinDays: number,
  lang: Language = 'en',
): EclipseInfo | null {
  const windowEndMs = fromUtc.getTime() + withinDays * DAY_MS;
  const eclipse = searchFromSyzygies(fromUtc, 0, windowEndMs + DAY_MS, (conjunction) => {
    const local = findLocalSolarEclipse(conjunction, location);
    if (local === null) return null;
    if (local.partialEnd.getTime() <= fromUtc.getTime()) return null;
    return local.beginAltitude > 0 || local.endAltitude > 0 ? local : null;
  });
  if (eclipse === null) return null;
  if (eclipse.partialBegin.getTime() > windowEndMs) return null;

  const subtype: EclipseSubtype = eclipse.kind;
  const visibleFromLocation = eclipse.peakAltitude > 0;

  return {
    kind: 'solar',
    subtype,
    start: eclipse.partialBegin,
    peak: eclipse.peak,
    end: eclipse.partialEnd,
    visibleFromLocation,
    obscuration: eclipse.obscuration,
    magnitude: eclipse.magnitude,
    sutakStart: new Date(eclipse.partialBegin.getTime() - SOLAR_SUTAK_HOURS * 3600_000),
    sutakEnd: eclipse.partialEnd,
    description: describeEclipse(
      'solar', subtype, eclipse.obscuration, visibleFromLocation, lang,
    ),
  };
}

/** Injection point letting `getDailyPanchang` answer the guard from the interpolant it has already built. */
export interface SyzygyLongitudes {
  tropicalMoon: (date: Date) => number;
  tropicalSun: (date: Date) => number;
}

const DIRECT_LONGITUDES: SyzygyLongitudes = {
  tropicalMoon: getTropicalMoonLongitude,
  tropicalSun: getTropicalSunLongitude,
};

/** Ayanamsa cancels in the difference, so no ayanamsa system is threaded in. */
function elongationAt(date: Date, lon: SyzygyLongitudes): number {
  return normalize360(lon.tropicalMoon(date) - lon.tropicalSun(date));
}

/** Elongation advances monotonically, so a syzygy falls inside `[fromUtc, toUtc]` exactly when elongation relative to `targetDeg` wraps past zero across it. */
function syzygyBetween(
  fromUtc: Date, toUtc: Date, targetDeg: number, lon: SyzygyLongitudes,
): boolean {
  const relFrom = normalize360(elongationAt(fromUtc, lon) - targetDeg);
  const relTo = normalize360(elongationAt(toUtc, lon) - targetDeg);
  if (relFrom === 0) return true;
  return relTo < relFrom;
}

/** Absorbs, with wide margin, the ~1 h parallax offset between local peak obscuration and exact geocentric syzygy. */
const SYZYGY_GUARD_MARGIN_MS = 12 * 3600_000;

/** The eclipse peaking within the Hindu day `[sunriseUtc, nextSunriseUtc)`, or `null`. */
export function getEclipseDuringDay(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  location: GeoLocation,
  lang: Language = 'en',
  longitudes: SyzygyLongitudes = DIRECT_LONGITUDES,
): EclipseInfo | null {
  const windowMs = nextSunriseUtc.getTime() - sunriseUtc.getTime();
  const windowDays = Math.ceil(windowMs / (24 * 3600_000)) + 1;

  const guardFrom = new Date(sunriseUtc.getTime() - SYZYGY_GUARD_MARGIN_MS);
  const guardTo = new Date(nextSunriseUtc.getTime() + SYZYGY_GUARD_MARGIN_MS);

  if (syzygyBetween(guardFrom, guardTo, 0, longitudes)) {
    const solar = getUpcomingSolarEclipse(sunriseUtc, location, windowDays, lang);
    if (solar && solar.peak.getTime() < nextSunriseUtc.getTime()) return solar;
  }

  if (syzygyBetween(guardFrom, guardTo, 180, longitudes)) {
    const lunar = getUpcomingLunarEclipse(sunriseUtc, location, windowDays, lang);
    if (lunar && lunar.peak.getTime() < nextSunriseUtc.getTime()) return lunar;
  }

  return null;
}

function describeEclipse(
  kind: 'solar' | 'lunar',
  subtype: EclipseSubtype,
  obscuration: number,
  visible: boolean,
  lang: Language,
): string {
  const e = getTranslations(lang).eclipse;
  return e.template
    .replace('{subtype}', e.subtype[subtype])
    .replace('{kind}', e.kind[kind])
    .replace('{percent}', String(Math.round(obscuration * 100)))
    .replace('{visibility}', visible ? e.visibility.visible : e.visibility.notVisible);
}
