/** A solar eclipse can only happen at conjunction and a lunar one only at opposition, definitionally, so the search walks syzygies rather than time. */
import {
  findLunarEclipse, findLocalSolarEclipse, solarViewAt, discObscuration,
  type LocalSolarEclipse, type LunarEclipse, type SolarEclipseKind,
} from './eclipseGeometry';
import { searchMoonPhase } from './lunation';
import { getMoonPosition, getTropicalMoonLongitude } from './moon';
import { getTropicalSunLongitude } from './sun';
import { bodyAltitudeDegrees, type HorizonBody } from './horizon';
import { normalize360 } from '../utils/angle';
import { validateDate } from '../utils/validation';
import { getTranslations } from '../i18n/resolver';
import type { GeoLocation } from '../types/location';
import type { Language } from '../types/options';

export type EclipseSubtype = 'partial' | 'total' | 'annular' | 'penumbral';

export interface EclipseInfo {
  kind: 'solar' | 'lunar';
  /** Lunar: by umbral magnitude. Solar: as seen from the location, so a total or annular phase entirely below the horizon reads `'partial'`. */
  subtype: EclipseSubtype;
  /** First contact: partial begin for solar, penumbral begin for lunar. */
  start: Date;
  peak: Date;
  /** Last contact: partial end for solar, penumbral end for lunar. */
  end: Date;
  /** Eclipsed body above the horizon at peak. */
  visibleFromLocation: boolean;
  /** Fraction of the body's disc **area** covered at greatest eclipse, [0, 1], even when the body is below the horizon then; umbral for a lunar eclipse, so a penumbral one reads 0. */
  obscuration: number;
  /** Fraction of the body's *diameter* covered at greatest eclipse, horizon or not: not a [0, 1] fraction, since a total eclipse exceeds 1 and a penumbral lunar one is negative. Do not clamp. */
  magnitude: number;
  /** Sutak (impurity window) start; null for a penumbral lunar eclipse, which carries no sutak. */
  sutakStart: Date | null;
  sutakEnd: Date | null;
  /** Subtype, kind, obscuration and visibility; a solar eclipse whose peak is below the horizon is described at the deepest phase seen, at sunrise or sunset. */
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

/**
 * The eclipse at a syzygy, and the latitude test before it, are pure functions of the syzygy's
 * millisecond (and, for a solar one, the observer), and a walk searched again from a later cursor
 * mostly lands on that same millisecond, so each is memoized on exactly those inputs, never on a
 * nearby syzygy. An eclipse read hands out fresh `Date`s, since callers pass them on. Each store
 * is cleared when full.
 */
const MAX_ECLIPSES_KEPT = 64;
const LUNAR_ECLIPSES = /* @__PURE__ */ new Map<number, LunarEclipse | null>();
const LOCAL_SOLAR_ECLIPSES = /* @__PURE__ */ new Map<string, LocalSolarEclipse | null>();
const MAX_LATITUDES_KEPT = 256;
const SYZYGY_LATITUDES = /* @__PURE__ */ new Map<number, number>();

/** The Moon's ecliptic latitude at a syzygy, the test every new and full moon walked is put to. */
function syzygyLatitude(syzygy: Date): number {
  const ms = syzygy.getTime();
  let latitude = SYZYGY_LATITUDES.get(ms);
  if (latitude === undefined) {
    latitude = getMoonPosition(syzygy).latitude;
    if (SYZYGY_LATITUDES.size >= MAX_LATITUDES_KEPT) SYZYGY_LATITUDES.clear();
    SYZYGY_LATITUDES.set(ms, latitude);
  }
  return latitude;
}

const copyDate = (d: Date): Date => new Date(d.getTime());
const copyDateOrNull = (d: Date | null): Date | null => (d === null ? null : copyDate(d));

function copyLunar(e: LunarEclipse | null): LunarEclipse | null {
  if (e === null) return null;
  return {
    ...e,
    peak: copyDate(e.peak),
    penumbralBegin: copyDate(e.penumbralBegin),
    penumbralEnd: copyDate(e.penumbralEnd),
    partialBegin: copyDateOrNull(e.partialBegin),
    partialEnd: copyDateOrNull(e.partialEnd),
    totalBegin: copyDateOrNull(e.totalBegin),
    totalEnd: copyDateOrNull(e.totalEnd),
  };
}

function copyLocalSolar(e: LocalSolarEclipse | null): LocalSolarEclipse | null {
  if (e === null) return null;
  return {
    ...e,
    peak: copyDate(e.peak),
    partialBegin: copyDate(e.partialBegin),
    partialEnd: copyDate(e.partialEnd),
    centralBegin: copyDateOrNull(e.centralBegin),
    centralEnd: copyDateOrNull(e.centralEnd),
  };
}

function lunarEclipseAt(opposition: Date): LunarEclipse | null {
  const ms = opposition.getTime();
  let kept = LUNAR_ECLIPSES.get(ms);
  if (kept === undefined) {
    kept = copyLunar(findLunarEclipse(opposition));
    if (LUNAR_ECLIPSES.size >= MAX_ECLIPSES_KEPT) LUNAR_ECLIPSES.clear();
    LUNAR_ECLIPSES.set(ms, kept);
  }
  return copyLunar(kept);
}

/** `String` writes -0 as 0, so the sign of a zero is spelled out. */
const exactKey = (x: number): string => (Object.is(x, -0) ? '-0' : String(x));

function localSolarEclipseAt(conjunction: Date, location: GeoLocation): LocalSolarEclipse | null {
  if (
    typeof location.latitude !== 'number' || typeof location.longitude !== 'number'
    || (location.elevation != null && typeof location.elevation !== 'number')
  ) {
    return findLocalSolarEclipse(conjunction, location);
  }
  const key =`${conjunction.getTime()}|${exactKey(location.latitude)}|${exactKey(location.longitude)}`
    + `|${exactKey(location.elevation ?? 0)}`;
  let kept = LOCAL_SOLAR_ECLIPSES.get(key);
  if (kept === undefined) {
    kept = copyLocalSolar(findLocalSolarEclipse(conjunction, location));
    if (LOCAL_SOLAR_ECLIPSES.size >= MAX_ECLIPSES_KEPT) LOCAL_SOLAR_ECLIPSES.clear();
    LOCAL_SOLAR_ECLIPSES.set(key, kept);
  }
  return copyLocalSolar(kept);
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
    if (Math.abs(syzygyLatitude(syzygy)) < ECLIPSE_LATITUDE_LIMIT_DEG) {
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
  validateDate(fromUtc, 'any');
  const windowEndMs = fromUtc.getTime() + withinDays * DAY_MS;
  const eclipse = searchFromSyzygies(
    fromUtc, 180, windowEndMs + DAY_MS, (opposition) => {
      const found = lunarEclipseAt(opposition);
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
  validateDate(fromUtc, 'any');
  const windowEndMs = fromUtc.getTime() + withinDays * DAY_MS;
  const eclipse = searchFromSyzygies(fromUtc, 0, windowEndMs + DAY_MS, (conjunction) => {
    const local = localSolarEclipseAt(conjunction, location);
    if (local === null) return null;
    if (local.partialEnd.getTime() <= fromUtc.getTime()) return null;
    return local.beginAltitude > 0 || local.endAltitude > 0 ? local : null;
  });
  if (eclipse === null) return null;
  if (eclipse.partialBegin.getTime() > windowEndMs) return null;

  const visibleFromLocation = eclipse.peakAltitude > 0;
  const seen = deepestPhaseSeen(eclipse, location);
  const subtype: EclipseSubtype = seen.kind;

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
    description: describeEclipse('solar', subtype, seen.obscuration, true, lang),
  };
}

/** Bisection step for the sunrise or sunset inside an eclipse: far finer than the percent the description prints. */
const HORIZON_CROSSING_MS = 1000;

/** The first instant with the Sun's refracted centre above the horizon, between `belowMs` (down) and `aboveMs` (up). */
function horizonCrossingMs(belowMs: number, aboveMs: number, location: GeoLocation): number {
  let down = belowMs;
  let up = aboveMs;
  while (Math.abs(up - down) > HORIZON_CROSSING_MS) {
    const mid = Math.floor((down + up) / 2);
    if (solarViewAt(new Date(mid), location).sunAltitude > 0) up = mid;
    else down = mid;
  }
  return up;
}

/**
 * The deepest phase of a local solar eclipse seen with the Sun up: the peak when it is above the
 * horizon, otherwise the sunrise or sunset inside the eclipse nearest to it in depth. The search only
 * returns eclipses with the Sun up at a contact, so one such crossing exists.
 */
function deepestPhaseSeen(
  eclipse: LocalSolarEclipse, location: GeoLocation,
): { kind: SolarEclipseKind; obscuration: number } {
  if (eclipse.peakAltitude > 0) return { kind: eclipse.kind, obscuration: eclipse.obscuration };
  const peakMs = eclipse.peak.getTime();
  const crossings: number[] = [];
  if (eclipse.beginAltitude > 0) crossings.push(horizonCrossingMs(peakMs, eclipse.partialBegin.getTime(), location));
  if (eclipse.endAltitude > 0) crossings.push(horizonCrossingMs(peakMs, eclipse.partialEnd.getTime(), location));
  let seen: { kind: SolarEclipseKind; obscuration: number } | null = null;
  let least = Number.POSITIVE_INFINITY;
  for (const ms of crossings) {
    const view = solarViewAt(new Date(ms), location);
    if (view.separation >= least) continue;
    least = view.separation;
    const sun = view.sunSemidiameter;
    const moon = view.moonSemidiameter;
    seen = {
      kind: least < Math.abs(moon - sun) ? (moon >= sun ? 'total' : 'annular') : 'partial',
      obscuration: discObscuration(least, sun, moon),
    };
  }
  return seen ?? { kind: eclipse.kind, obscuration: eclipse.obscuration };
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

/** Covers the interpolated longitudes' error, so a syzygy just before sunrise is never searched for from sunrise. */
const SYZYGY_SEARCH_SLACK_MS = 60_000;

/** The instant a solar eclipse is first seen: its peak when the Sun is up then, else first contact when it is, else last contact, where the search guarantees it is. */
function solarSightingMs(eclipse: EclipseInfo, location: GeoLocation): number {
  if (eclipse.visibleFromLocation) return eclipse.peak.getTime();
  if (solarViewAt(eclipse.start, location).sunAltitude > 0) return eclipse.start.getTime();
  return eclipse.end.getTime();
}

/**
 * The eclipse of the Hindu day `[sunriseUtc, nextSunriseUtc)`, or `null`: a lunar eclipse whose
 * peak falls in the day, or a solar eclipse first seen in it (at its peak, else at first contact,
 * else at last contact, whichever first has the Sun up), so one in progress at sunrise belongs to
 * that sunrise's day. A syzygy shortly before sunrise is searched from 12 h earlier, since its
 * eclipse can still peak, or first be seen, after sunrise.
 */
export function getEclipseDuringDay(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  location: GeoLocation,
  lang: Language = 'en',
  longitudes: SyzygyLongitudes = DIRECT_LONGITUDES,
): EclipseInfo | null {
  validateDate(sunriseUtc, 'any');
  validateDate(nextSunriseUtc, 'any');
  const sunriseMs = sunriseUtc.getTime();
  const nextSunriseMs = nextSunriseUtc.getTime();
  const windowDays = Math.ceil((nextSunriseMs - sunriseMs) / (24 * 3600_000)) + 1;

  const guardFrom = new Date(sunriseMs - SYZYGY_GUARD_MARGIN_MS);
  const guardTo = new Date(nextSunriseMs + SYZYGY_GUARD_MARGIN_MS);
  const inDay = (ms: number): boolean => ms >= sunriseMs && ms < nextSunriseMs;
  const searchFrom = (targetDeg: number): Date => (
    syzygyBetween(guardFrom, new Date(sunriseMs + SYZYGY_SEARCH_SLACK_MS), targetDeg, longitudes)
      ? guardFrom
      : sunriseUtc
  );

  if (syzygyBetween(guardFrom, guardTo, 0, longitudes)) {
    const solar = getUpcomingSolarEclipse(searchFrom(0), location, windowDays, lang);
    if (solar && inDay(solarSightingMs(solar, location))) return solar;
  }

  if (syzygyBetween(guardFrom, guardTo, 180, longitudes)) {
    const lunar = getUpcomingLunarEclipse(searchFrom(180), location, windowDays, lang);
    if (lunar && inDay(lunar.peak.getTime())) return lunar;
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
