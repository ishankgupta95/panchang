import { validateDate, validateLocation } from '../utils/validation';
import { LongitudeCache } from '../astronomy/cache';
import { computeAyanamsa } from '../astronomy/ayanamsa';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { findTransitionTime, findDailyElements } from '../utils/search';
import { NAKSHATRA_SPAN } from '../utils/constants';
import { resolveUtcOffset, getLocalMidnightUtc, utcToLocalDisplay } from '../utils/timezone';
import {
  computeTithiFromLongitudes,
  getTithiIndexAtTime,
  getTithiIndexFromLons,
} from './tithi';
import {
  computeNakshatraFromLongitude,
  getNakshatraIndexAtTime,
} from './nakshatra';
import {
  computeYogaFromLongitudes,
  getYogaIndexAtTime,
  getYogaIndex,
} from './yoga';
import {
  computeKaranaFromLongitudes,
  getKaranaIndexAtTime,
  getKaranaIndex,
} from './karana';
import { computeVara } from './vara';
import { computeRahuKalam, computeGulikaKalam, computeYamaganda } from './inauspicious';
import { computeAbhijitMuhurta } from './muhurta';
import { computeMasa } from './masa';
import { computeChandraMasa } from './chandramasa';
import { computeSamvat } from './samvat';
import {
  resolveTithiName,
  resolveNakshatraName,
  resolveYogaName,
  resolveKaranaName,
  resolveChandraMasaName,
  getTranslations,
} from '../i18n/resolver';
import type { GeoLocation } from '../types/location';
import type { InstantPanchangOptions, PanchangOptions } from '../types/options';
import type { InstantPanchangResult, DailyPanchangResult } from '../types/panchang';
import type {
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo, TimePeriod,
} from '../types/elements';

/**
 * Returns the Panchang elements active at a single UTC moment.
 *
 * Use this for birth-chart calculations, muhurta selection, or any case
 * where you need the exact element at a specific instant rather than a
 * full sunrise-to-sunrise day.
 *
 * @param date     UTC instant to evaluate.
 * @param location Observer coordinates `{ latitude, longitude, elevation? }`.
 * @param options  Optional settings: `ayanamsa`, `language`, `computeEndTimes`,
 *                 `precision`. No `timezone` required — the result is UTC-based.
 * @returns        `InstantPanchangResult` with one value per element
 *                 (tithi, nakshatra, yoga, karana, vara) plus sidereal longitudes.
 * @throws         `PanchangError` for invalid inputs or polar locations with no sunrise.
 *
 * @example
 * ```typescript
 * import { getInstantPanchang } from 'panchang-ts';
 *
 * const p = getInstantPanchang(
 *   new Date('2025-01-14T03:00:00Z'),
 *   { latitude: 18.5204, longitude: 73.8567 },
 *   { language: 'sa' },
 * );
 * console.log(p.tithi.name);     // "कृष्ण चतुर्दशी"
 * console.log(p.tithi.endTime);  // Date (UTC) when this Tithi ends
 * ```
 */
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

  const tithi = computeTithiFromLongitudes(
    siderealMoon, siderealSun,
    resolveTithiName(getTithiIndexFromLons(siderealMoon, siderealSun), lang),
  );
  const nakshatra = computeNakshatraFromLongitude(
    siderealMoon,
    resolveNakshatraName(Math.floor(siderealMoon / NAKSHATRA_SPAN), lang),
  );
  const yoga = computeYogaFromLongitudes(
    siderealMoon, siderealSun,
    resolveYogaName(getYogaIndex(siderealMoon, siderealSun), lang),
  );
  const karana = computeKaranaFromLongitudes(
    siderealMoon, siderealSun,
    resolveKaranaName(getKaranaIndex(siderealMoon, siderealSun), lang),
  );

  // For Vara in instant mode, we need sunrise to know if the moment is before/after sunrise
  const sunriseUtc = computeSunrise(
    new Date(date.getTime() - 12 * 3600_000),
    location,
  );
  const vara = computeVara(date, sunriseUtc, getTranslations(lang).varaNames);
  const chandramasa = computeChandraMasa(
    siderealSun, siderealMoon,
    (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
  );
  const samvat = computeSamvat(date);

  if (doEndTimes) {
    tithi.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      tithi.index, (d) => getTithiIndexAtTime(d, getMoon, getSun), maxIter,
    );
    nakshatra.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      nakshatra.index, (d) => getNakshatraIndexAtTime(d, getMoon), maxIter,
    );
    yoga.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      yoga.index, (d) => getYogaIndexAtTime(d, getMoon, getSun), maxIter,
    );
    karana.endTime = findTransitionTime(
      date, new Date(date.getTime() + 18 * 3600_000),
      karana.index, (d) => getKaranaIndexAtTime(d, getMoon, getSun), maxIter,
    );
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
    chandramasa,
    samvat,
  };
}

/**
 * Returns the full Hindu Panchang for a sunrise-to-sunrise day.
 *
 * The "day" is defined as the window from the local sunrise to the following
 * sunrise (as per Vedic convention). Multiple elements per category are
 * returned when a transition occurs during the day — e.g. if Tithi changes
 * at 14:30 the result has two `DailyTithiInfo` entries.
 *
 * All `Date` objects in the result are **offset-adjusted** to the requested
 * timezone. Read their components via `getUTC*` methods:
 * ```
 * result.sunrise.getUTCHours()   // local sunrise hour
 * result.sunrise.getHours()      // ← wrong, uses system timezone
 * ```
 *
 * @param date     Any `Date` within the local calendar day you want.
 *                 Only the calendar date is used; the time component is ignored.
 * @param location Observer coordinates `{ latitude, longitude, elevation? }`.
 * @param options  Settings — `timezone` is required (UTC offset in minutes,
 *                 e.g. 330 for IST). Also accepts `ayanamsa`, `language`,
 *                 `computeEndTimes`, `precision`.
 * @returns        `DailyPanchangResult` with element arrays, sunrise/sunset,
 *                 inauspicious periods, muhurta, ayanamsa, and Masa.
 * @throws         `PanchangError` for invalid inputs or polar locations with no sunrise.
 *
 * @example
 * ```typescript
 * import { getDailyPanchang } from 'panchang-ts';
 *
 * const result = getDailyPanchang(
 *   new Date(2025, 0, 14),                      // Jan 14, 2025
 *   { latitude: 18.5204, longitude: 73.8567 },  // Pune, India
 *   { timezone: 330 },                          // IST = UTC+5:30
 * );
 *
 * result.tithis[0].name;           // "Krishna Chaturdashi"
 * result.vara.name;                // "Mangalavara"
 * result.rahuKalam.start;          // Date — read via getUTCHours()
 *
 * // Fast mode (names only, ~5× faster):
 * const fast = getDailyPanchang(date, loc, { timezone: 330, computeEndTimes: false });
 * ```
 */
export function getDailyPanchang(
  date: Date,
  location: GeoLocation,
  options: PanchangOptions,
): DailyPanchangResult {
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

  // ── 3. Compute sunrise triplet ───────────────────────
  const localMidnightUtc = getLocalMidnightUtc(date, offsetMinutes);
  const sunriseUtc = computeSunrise(localMidnightUtc, location);
  const sunsetUtc = computeSunset(sunriseUtc, location);
  const nextSunriseUtc = computeSunrise(sunsetUtc, location);

  // ── 4. Compute longitudes at sunrise ─────────────────
  const siderealMoonAtSunrise = getMoon(sunriseUtc);
  const siderealSunAtSunrise = getSun(sunriseUtc);
  const ayanamsaValue = computeAyanamsa(sunriseUtc, ayanamsaType);

  // ── 5. Compute elements at sunrise ───────────────────
  const tithiAtSunrise = computeTithiFromLongitudes(
    siderealMoonAtSunrise, siderealSunAtSunrise,
    resolveTithiName(getTithiIndexFromLons(siderealMoonAtSunrise, siderealSunAtSunrise), lang),
  );
  const nakshatraAtSunrise = computeNakshatraFromLongitude(
    siderealMoonAtSunrise,
    resolveNakshatraName(Math.floor(siderealMoonAtSunrise / NAKSHATRA_SPAN), lang),
  );
  const yogaAtSunrise = computeYogaFromLongitudes(
    siderealMoonAtSunrise, siderealSunAtSunrise,
    resolveYogaName(getYogaIndex(siderealMoonAtSunrise, siderealSunAtSunrise), lang),
  );
  const karanaAtSunrise = computeKaranaFromLongitudes(
    siderealMoonAtSunrise, siderealSunAtSunrise,
    resolveKaranaName(getKaranaIndex(siderealMoonAtSunrise, siderealSunAtSunrise), lang),
  );
  const vara = computeVara(sunriseUtc, sunriseUtc, getTranslations(lang).varaNames);
  const masa = computeMasa(siderealSunAtSunrise);
  const chandramasa = computeChandraMasa(
    siderealSunAtSunrise, siderealMoonAtSunrise,
    (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
  );
  const samvat = computeSamvat(sunriseUtc);

  // ── 6. Find transitions (daily element arrays) ───────
  let tithis: DailyTithiInfo[];
  let nakshatras: DailyNakshatraInfo[];
  let yogas: DailyYogaInfo[];
  let karanas: DailyKaranaInfo[];

  if (doEndTimes) {
    tithis = findDailyElements(
      sunriseUtc, nextSunriseUtc, tithiAtSunrise,
      (d) => getTithiIndexAtTime(d, getMoon, getSun),
      (d) => {
        const moon = getMoon(d), sun = getSun(d);
        return computeTithiFromLongitudes(moon, sun, resolveTithiName(getTithiIndexFromLons(moon, sun), lang));
      },
      30, 36, maxIter, 2,
    ) as DailyTithiInfo[];
    nakshatras = findDailyElements(
      sunriseUtc, nextSunriseUtc, nakshatraAtSunrise,
      (d) => getNakshatraIndexAtTime(d, getMoon),
      (d) => {
        const moon = getMoon(d);
        return computeNakshatraFromLongitude(moon, resolveNakshatraName(Math.floor(moon / NAKSHATRA_SPAN), lang));
      },
      27, 36, maxIter, 2,
    ) as DailyNakshatraInfo[];
    yogas = findDailyElements(
      sunriseUtc, nextSunriseUtc, yogaAtSunrise,
      (d) => getYogaIndexAtTime(d, getMoon, getSun),
      (d) => {
        const moon = getMoon(d), sun = getSun(d);
        return computeYogaFromLongitudes(moon, sun, resolveYogaName(getYogaIndex(moon, sun), lang));
      },
      27, 36, maxIter, 2,
    ) as DailyYogaInfo[];
    karanas = findDailyElements(
      sunriseUtc, nextSunriseUtc, karanaAtSunrise,
      (d) => getKaranaIndexAtTime(d, getMoon, getSun),
      (d) => {
        const moon = getMoon(d), sun = getSun(d);
        return computeKaranaFromLongitudes(moon, sun, resolveKaranaName(getKaranaIndex(moon, sun), lang));
      },
      60, 18, maxIter, 4,
    ) as DailyKaranaInfo[];
  } else {
    tithis = [{ ...tithiAtSunrise, startTime: null, isActiveAtSunrise: true }];
    nakshatras = [{ ...nakshatraAtSunrise, startTime: null, isActiveAtSunrise: true }];
    yogas = [{ ...yogaAtSunrise, startTime: null, isActiveAtSunrise: true }];
    karanas = [{ ...karanaAtSunrise, startTime: null, isActiveAtSunrise: true }];
  }

  // ── 7. Compute time-slot periods ─────────────────────
  const rahuKalam = computeRahuKalam(sunriseUtc, sunsetUtc, vara.index);
  const gulikaKalam = computeGulikaKalam(sunriseUtc, sunsetUtc, vara.index);
  const yamaganda = computeYamaganda(sunriseUtc, sunsetUtc, vara.index);
  const abhijitMuhurta = computeAbhijitMuhurta(sunriseUtc, sunsetUtc);

  // ── 8. Convert all UTC dates to local display ────────
  const toLocal = (d: Date) => utcToLocalDisplay(d, offsetMinutes);
  const toLocalOrNull = (d: Date | null) => d ? toLocal(d) : null;
  const convertTimePeriod = (tp: TimePeriod): TimePeriod => ({
    start: toLocal(tp.start),
    end: toLocal(tp.end),
  });

  const dayDurationMs = sunsetUtc.getTime() - sunriseUtc.getTime();
  const nightDurationMs = nextSunriseUtc.getTime() - sunsetUtc.getTime();

  for (const t of tithis) {
    t.endTime = toLocalOrNull(t.endTime);
    (t as DailyTithiInfo).startTime = toLocalOrNull((t as DailyTithiInfo).startTime);
  }
  for (const n of nakshatras) {
    n.endTime = toLocalOrNull(n.endTime);
    (n as DailyNakshatraInfo).startTime = toLocalOrNull((n as DailyNakshatraInfo).startTime);
  }
  for (const y of yogas) {
    y.endTime = toLocalOrNull(y.endTime);
    (y as DailyYogaInfo).startTime = toLocalOrNull((y as DailyYogaInfo).startTime);
  }
  for (const k of karanas) {
    k.endTime = toLocalOrNull(k.endTime);
    (k as DailyKaranaInfo).startTime = toLocalOrNull((k as DailyKaranaInfo).startTime);
  }

  // ── 9. Assemble result ───────────────────────────────
  return {
    date,
    location,
    timezone: offsetMinutes,
    sunrise: toLocal(sunriseUtc),
    sunset: toLocal(sunsetUtc),
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
    chandramasa,
    samvat,
  };
}
