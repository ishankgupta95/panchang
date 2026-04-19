import { validateDate, validateLocation } from '../utils/validation';
import { PanchangError } from '../types/errors';
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
import {
  computeAbhijitMuhurta, computeBrahmaMuhurta,
  computeVijayaMuhurta, computeGodhuliMuhurta,
  computeNishitaMuhurta, computeAmritKala,
} from './muhurta';
import { getEclipseDuringDay } from '../astronomy/eclipse';
import { computeGowriPanchangam } from './gowri';
import { computeMasa } from './masa';
import { computeChandraMasa } from './chandramasa';
import { computeSamvat } from './samvat';
import { computeChandraRashi, computeSuryaNakshatra } from './rashi';
import { computeChoghadiya } from './choghadiya';
import { computeHora } from './hora';
import { computePanchaka } from './panchaka';
import { computeSpecialYogas } from './specialYogas';
import { computeDurMuhurta } from './durMuhurta';
import { computeFestivals } from './festivals';
import { resolveRegionAlias } from './regionAlias';
import { computeBhadraKaal } from './bhadra';
import { computeChandraBalam } from '../jyotish/chandraBalam';
import { getMoonrise, getMoonset } from '../astronomy/moonrise';
import {
  resolveTithiName,
  resolvePakshaName,
  resolveNakshatraName,
  resolveYogaName,
  resolveKaranaName,
  resolveMasaName,
  resolveChandraMasaName,
  getTranslations,
} from '../i18n/resolver';
import type { GeoLocation } from '../types/location';
import type { InstantPanchangOptions, PanchangOptions } from '../types/options';
import type { InstantPanchangResult, DailyPanchangResult } from '../types/panchang';
import type {
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo, TimePeriod,
  ChoghadiyaQuality,
} from '../types/elements';

/**
 * Returns the Panchang elements active at a single UTC moment.
 *
 * Use this for birth-chart calculations, muhurta selection, or any case
 * where you need the exact element at a specific instant rather than a
 * full sunrise-to-sunrise day.
 *
 * ### Festival-detection limitations in instant mode
 *
 * `getInstantPanchang` evaluates festival rules against the tithi / nakshatra /
 * chandraMasa at the given instant only. It does **not** perform the
 * sunrise-to-next-sunrise refinements that `getDailyPanchang` provides, so the
 * following classes of festivals may be missing or mis-dated when queried via
 * this API:
 *
 * - **Canonical-time rules** (Phase 21): Ganesh Chaturthi (madhyahna), Shivaratri
 *   (nishita), most Pradosha variants, Chandrodaya-keyed festivals (Karva Chauth
 *   moonrise, etc.) — these require knowing whether the canonical window falls
 *   within the Hindu day window.
 * - **Transit-based Sankranti**: solar-month boundary is detected from the
 *   sunrise-to-next-sunrise transit, not the instantaneous solar longitude.
 * - **Ekadashi viddha** (Smarta vs Vaishnava split): requires checking tithi
 *   state across aruṇodaya of both the candidate and following day.
 * - **Long-tithi dedupe & Bhadra/Raksha Bandhan exclusion**: also sunrise-keyed.
 *
 * Pan-Indian tithi/nakshatra-based festivals (e.g. Holi, Diwali, Raksha
 * Bandhan date selection) do resolve correctly as long as the queried instant
 * matches the canonical window. For reliable festival dating, use
 * `getDailyPanchang` instead.
 *
 * @param date     UTC instant to evaluate.
 * @param location Observer coordinates `{ latitude, longitude, elevation? }`.
 * @param options  Optional settings: `ayanamsa`, `language`, `computeEndTimes`,
 *                 `precision`. No `timezone` required — the result is UTC-based.
 * @returns        `InstantPanchangResult` with one value per element
 *                 (tithi, nakshatra, yoga, karana, vara) plus sidereal longitudes,
 *                 or `null` for polar locations on dates with no sunrise. Invalid
 *                 inputs still throw `PanchangError`.
 *
 * @example
 * ```typescript
 * import { getInstantPanchang } from 'panchang-ts';
 *
 * const p = getInstantPanchang(
 *   new Date('2025-01-14T03:00:00Z'),
 *   { latitude: 23.1765, longitude: 75.7885 },  // Ujjain, India
 *   { language: 'hi' },
 * );
 * if (p === null) {
 *   // polar location — Hindu day undefined
 * } else {
 *   console.log(p.tithi.name);     // "कृष्ण चतुर्दशी"
 *   console.log(p.tithi.endTime);  // Date (UTC) when this Tithi ends
 * }
 * ```
 *
 * @see getDailyPanchang — for sunrise-to-next-sunrise Hindu day with full
 *                        canonical-time festival dating.
 */
export function getInstantPanchang(
  date: Date,
  location: GeoLocation,
  options?: InstantPanchangOptions,
): InstantPanchangResult | null {
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

  const tithiIdx = getTithiIndexFromLons(siderealMoon, siderealSun);
  const tithi = computeTithiFromLongitudes(
    siderealMoon, siderealSun,
    resolveTithiName(tithiIdx, lang),
    resolvePakshaName(tithiIdx, lang),
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

  // For Vara in instant mode, we need sunrise to know if the moment is before/after sunrise.
  // No explicit timezone is supplied here — derive a longitude-based local-mean-time offset
  // so the weekday reflects the observer's local calendar day rather than UTC's.
  // (Without this shift, observers east of the Date Line / west of GMT can be off-by-one.)
  // Polar locations with no sunrise: return null to mirror getDailyPanchang's
  // contract — the Hindu-day weekday is undefined when sunrise doesn't occur.
  let sunriseUtc: Date;
  try {
    sunriseUtc = computeSunrise(
      new Date(date.getTime() - 12 * 3600_000),
      location,
    );
  } catch (e: unknown) {
    if (e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET')) {
      return null;
    }
    throw e;
  }
  const lmtOffsetMinutes = Math.round(location.longitude * 4);
  const vara = computeVara(
    utcToLocalDisplay(date, lmtOffsetMinutes),
    utcToLocalDisplay(sunriseUtc, lmtOffsetMinutes),
    getTranslations(lang).varaNames,
  );
  const masaSystem = options?.masaSystem ?? 'purnimanta';
  const chandramasa = computeChandraMasa(
    siderealSun, siderealMoon,
    (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
    masaSystem,
  );
  const samvat = computeSamvat(date);
  const chandraRashi = computeChandraRashi(
    siderealMoon,
    (idx) => resolveMasaName(idx, lang),
  );
  const suryaNakshatra = computeSuryaNakshatra(
    siderealSun,
    (idx) => resolveNakshatraName(idx, lang),
  );

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

  const t = getTranslations(lang);
  const specialYogas = computeSpecialYogas(
    vara.index, tithi.index,
    Math.floor(siderealMoon / NAKSHATRA_SPAN),
    (type) => (t.specialYogaNames as Record<string, string>)[type] ?? type,
  );
  // Instant-mode festival detection uses the tithi-at-instant for all rules;
  // it does not attempt canonical-time (madhyahna/pradosha/nishita/chandrodaya)
  // refinement, transit-based Sankranti, or Ekadashi viddha — those require a
  // full sunrise-to-nextSunrise Hindu day and are computed in `getDailyPanchang`.
  const festivals = computeFestivals(
    {
      tithiIndex: tithi.index,
      nakshatraIndex: Math.floor(siderealMoon / NAKSHATRA_SPAN),
      chandraMasaIndex: chandramasa.amantaIndex,
      isAdhika: chandramasa.isAdhika,
      varaIndex: vara.index,
      solarMasaIndex: Math.floor(siderealSun / 30) % 12,
      region: resolveRegionAlias(options?.region),
    },
    (key) => t.festivalNames[key] ?? (t.misc as Record<string, string>)[key] ?? key,
    (idx) => resolveMasaName(idx, lang),
  );

  const chandraBalam = options?.janmaRashi !== undefined
    ? computeChandraBalam(options.janmaRashi, chandraRashi.index, lang)
    : undefined;

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
    chandraRashi,
    suryaNakshatra,
    panchaka: computePanchaka(siderealMoon),
    specialYogas,
    festivals,
    ...(chandraBalam !== undefined ? { chandraBalam } : {}),
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
 * @returns        `DailyPanchangResult` on a normal day, or `null` for polar
 *                 locations on dates with no sunrise / sunset (the Hindu day
 *                 is undefined when sunrise doesn't occur). Invalid inputs
 *                 still throw `PanchangError`.
 *
 * @example
 * ```typescript
 * import { getDailyPanchang } from 'panchang-ts';
 *
 * const result = getDailyPanchang(
 *   new Date(2025, 0, 14),                      // Jan 14, 2025
 *   { latitude: 23.1765, longitude: 75.7885 },  // Ujjain, India
 *   { timezone: 330 },                          // IST = UTC+5:30
 * );
 * if (result === null) {
 *   // Polar location with midnight sun / polar night.
 * } else {
 *   result.tithis[0].name;           // "Krishna Chaturdashi"
 *   result.vara.name;                // "Mangalawara"
 *   result.rahuKalam.start;          // Date — read via getUTCHours()
 * }
 *
 * // Fast mode (names only, ~5× faster):
 * const fast = getDailyPanchang(date, loc, { timezone: 330, computeEndTimes: false });
 * ```
 */
export function getDailyPanchang(
  date: Date,
  location: GeoLocation,
  options: PanchangOptions,
): DailyPanchangResult | null {
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
  // Polar locations: when sunrise / sunset cannot be found, return null so
  // callers can branch instead of catching exceptions. The underlying
  // `computeSunrise` still throws `PanchangError(NO_SUNRISE)` for direct
  // callers who want the precise reason.
  const localMidnightUtc = getLocalMidnightUtc(date, offsetMinutes);
  let sunriseUtc: Date;
  let sunsetUtc: Date;
  let nextSunriseUtc: Date;
  try {
    sunriseUtc = computeSunrise(localMidnightUtc, location);
    sunsetUtc = computeSunset(sunriseUtc, location);
    nextSunriseUtc = computeSunrise(sunsetUtc, location);
  } catch (e: unknown) {
    if (e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET')) {
      return null;
    }
    throw e;
  }

  // ── 4. Compute longitudes at sunrise ─────────────────
  const siderealMoonAtSunrise = getMoon(sunriseUtc);
  const siderealSunAtSunrise = getSun(sunriseUtc);
  const ayanamsaValue = computeAyanamsa(sunriseUtc, ayanamsaType);

  // ── 5. Compute elements at sunrise ───────────────────
  const tithiIdxAtSunrise = getTithiIndexFromLons(siderealMoonAtSunrise, siderealSunAtSunrise);
  const tithiAtSunrise = computeTithiFromLongitudes(
    siderealMoonAtSunrise, siderealSunAtSunrise,
    resolveTithiName(tithiIdxAtSunrise, lang),
    resolvePakshaName(tithiIdxAtSunrise, lang),
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
  // Vara is the weekday at LOCAL sunrise — shift sunriseUtc into the configured
  // timezone so getUTCDay() returns the local calendar weekday. Without this,
  // sunrises whose UTC instant falls on the previous calendar day (e.g. India in
  // summer, all of Asia/Australia year-round) get the wrong weekday.
  const sunriseLocal = utcToLocalDisplay(sunriseUtc, offsetMinutes);
  const vara = computeVara(sunriseLocal, sunriseLocal, getTranslations(lang).varaNames);
  const masa = computeMasa(siderealSunAtSunrise, (idx) => resolveMasaName(idx, lang));
  const masaSystem = options.masaSystem ?? 'purnimanta';
  const chandramasa = computeChandraMasa(
    siderealSunAtSunrise, siderealMoonAtSunrise,
    (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
    masaSystem,
  );
  const samvat = computeSamvat(sunriseUtc);
  const chandraRashi = computeChandraRashi(
    siderealMoonAtSunrise,
    (idx) => resolveMasaName(idx, lang),
  );
  const suryaNakshatra = computeSuryaNakshatra(
    siderealSunAtSunrise,
    (idx) => resolveNakshatraName(idx, lang),
  );
  const brahmaMuhurta = computeBrahmaMuhurta(sunriseUtc, sunsetUtc);
  const qualityNameFn = (q: ChoghadiyaQuality) => getTranslations(lang).qualityNames[q];
  const choghadiya = computeChoghadiya(
    sunriseUtc, sunsetUtc, nextSunriseUtc, vara.index,
    (idx) => getTranslations(lang).choghadiyaNames[idx]!,
    qualityNameFn,
  );
  const hora = computeHora(
    sunriseUtc, sunsetUtc, nextSunriseUtc, vara.index,
    (idx) => getTranslations(lang).grahaNames[idx]!,
  );
  const gowriPanchangam = computeGowriPanchangam(
    sunriseUtc, sunsetUtc, nextSunriseUtc, vara.index,
    (idx) => getTranslations(lang).gowriNames[idx]!,
    qualityNameFn,
  );
  // Moonrise: first rise after local midnight (the moon may not rise on a given
  // calendar day, in which case getMoonrise returns null).
  // Moonset: pair it with the same lunation as moonrise — search from moonrise
  // when one exists, falling back to local midnight only when there is no
  // moonrise on this day. Searching from local midnight unconditionally returns
  // the *previous* lunation's setting on days where the moon rises late and
  // sets the following morning.
  const moonriseUtc = getMoonrise(localMidnightUtc, location);
  const moonsetUtc = getMoonset(moonriseUtc ?? localMidnightUtc, location);
  const panchaka = computePanchaka(siderealMoonAtSunrise);

  const t = getTranslations(lang);
  const specialYogas = computeSpecialYogas(
    vara.index, tithiAtSunrise.index,
    Math.floor(siderealMoonAtSunrise / NAKSHATRA_SPAN),
    (type) => (t.specialYogaNames as Record<string, string>)[type] ?? type,
  );
  const durMuhurtaUtc = computeDurMuhurta(sunriseUtc, sunsetUtc, vara.index);

  // ── Festival computation: canonical times + transits + viddha ──
  //
  // Canonical-time anchors within the Hindu day (sunrise → nextSunrise).
  // Where a kala spans a range, we anchor near its END so that a tithi which
  // only just entered the kala isn't counted as "pervading" it. This also
  // prevents duplicate emission on the next day when a long tithi barely
  // overlaps into that day's kala (e.g., Amavasya spanning two pradoshas).
  //
  //   madhyahna   — mid-day, midpoint of sunrise-to-sunset
  //   aparahna    — end of aparahna kala (0.8 of day-length after sunrise)
  //   pradosha    — end of pradosha kala (sunset + ~60 min = 2.5 ghatikas)
  //   nishita     — local midnight, midpoint of sunset-to-nextSunrise
  //   chandrodaya — moonrise within the Hindu day (null if moon doesn't rise)
  //   arunodaya   — 96 minutes before sunrise (Ekadashi Dashami-viddha check)
  const dayLengthMs = sunsetUtc.getTime() - sunriseUtc.getTime();
  const madhyahnaUtc = new Date(sunriseUtc.getTime() + dayLengthMs / 2);
  const aparahnaUtc = new Date(sunriseUtc.getTime() + (dayLengthMs * 8) / 10);
  const pradoshaUtc = new Date(sunsetUtc.getTime() + 60 * 60_000);
  const nishitaUtc = new Date((sunsetUtc.getTime() + nextSunriseUtc.getTime()) / 2);
  const arunodayaUtc = new Date(sunriseUtc.getTime() - 96 * 60_000);

  const tithiAt = (d: Date) => getTithiIndexFromLons(getMoon(d), getSun(d));

  // Anchors for the START of each kala (used by the long-tithi dedupe).
  const madhyahnaStartUtc = new Date(sunriseUtc.getTime() + dayLengthMs / 4);
  const aparahnaStartUtc = new Date(sunriseUtc.getTime() + (dayLengthMs * 3) / 5);
  const pradoshaStartUtc = sunsetUtc;
  const nishitaStartUtc = new Date(sunsetUtc.getTime() + (nextSunriseUtc.getTime() - sunsetUtc.getTime()) * 0.3);

  const tithiByRule: Partial<Record<
    'madhyahna' | 'aparahna' | 'pradosha' | 'nishita' | 'chandrodaya',
    number
  >> = {
    madhyahna: tithiAt(madhyahnaUtc),
    aparahna:  tithiAt(aparahnaUtc),
    pradosha:  tithiAt(pradoshaUtc),
    nishita:   tithiAt(nishitaUtc),
  };
  const tithiByRuleStart: Partial<Record<
    'madhyahna' | 'aparahna' | 'pradosha' | 'nishita' | 'chandrodaya',
    number
  >> = {
    madhyahna: tithiAt(madhyahnaStartUtc),
    aparahna:  tithiAt(aparahnaStartUtc),
    pradosha:  tithiAt(pradoshaStartUtc),
    nishita:   tithiAt(nishitaStartUtc),
  };

  // Moonrise within this Hindu day (may be null if moon doesn't rise in the window)
  const moonriseInDayUtc = getMoonrise(sunriseUtc, location);
  if (moonriseInDayUtc && moonriseInDayUtc.getTime() < nextSunriseUtc.getTime()) {
    tithiByRule.chandrodaya = tithiAt(moonriseInDayUtc);
    tithiByRuleStart.chandrodaya = tithiByRule.chandrodaya;
  }

  // Set of nakshatra indices that occur during this Hindu day. Used by
  // nakshatra-prevailing rules (e.g. Masik Karthigai = Krittika anywhere
  // during the day, not strictly at sunrise). Sample at sunrise / midday /
  // sunset / midnight — this catches both same-nakshatra-all-day cases and
  // single mid-day transitions (a 24h nakshatra spans at most 2 calendar days).
  const nakshatraAt = (d: Date) => Math.floor(getMoon(d) / NAKSHATRA_SPAN);
  const nakshatraIndicesInDay = new Set<number>([
    nakshatraAt(sunriseUtc),
    nakshatraAt(madhyahnaUtc),
    nakshatraAt(sunsetUtc),
    nakshatraAt(nishitaUtc),
  ]);

  // Yesterday's tithi-by-rule values: we re-run the same anchor math a day back
  // so the dedupe only suppresses when yesterday genuinely held the same tithi
  // across its kala. This is a cheap extra set of longitude samples.
  const yesterdaySunriseUtc = computeSunrise(
    new Date(sunriseUtc.getTime() - 24 * 3600_000 - 2 * 3600_000),
    location,
  );
  const yesterdaySunsetUtc = computeSunset(yesterdaySunriseUtc, location);
  const yesterdayDayLengthMs = yesterdaySunsetUtc.getTime() - yesterdaySunriseUtc.getTime();
  const yesterdayMadhyahnaUtc = new Date(yesterdaySunriseUtc.getTime() + yesterdayDayLengthMs / 2);
  const yesterdayAparahnaUtc = new Date(yesterdaySunriseUtc.getTime() + (yesterdayDayLengthMs * 8) / 10);
  const yesterdayPradoshaUtc = new Date(yesterdaySunsetUtc.getTime() + 60 * 60_000);
  const yesterdayNishitaUtc = new Date((yesterdaySunsetUtc.getTime() + sunriseUtc.getTime()) / 2);

  const priorDayTithiByRule: Partial<Record<
    'madhyahna' | 'aparahna' | 'pradosha' | 'nishita' | 'chandrodaya',
    number
  >> = {
    madhyahna: tithiAt(yesterdayMadhyahnaUtc),
    aparahna:  tithiAt(yesterdayAparahnaUtc),
    pradosha:  tithiAt(yesterdayPradoshaUtc),
    nishita:   tithiAt(yesterdayNishitaUtc),
  };

  // Sankranti: transit-time search. Compare Sun's rashi at sunrise vs nextSunrise;
  // if different, a transit occurred during this Hindu day. We emit Sankranti on
  // the day containing the transit (the unambiguous rule for sunrise-to-sunrise days).
  const rashiAtSunrise = Math.floor(siderealSunAtSunrise / 30) % 12;
  const rashiAtNextSunrise = Math.floor(getSun(nextSunriseUtc) / 30) % 12;
  const sankrantiRashi: number | null =
    rashiAtSunrise !== rashiAtNextSunrise ? rashiAtNextSunrise : null;

  // Next-day Sankranti — Sun's rashi at the sunrise AFTER nextSunrise. Used
  // by "day before Sankranti" observances (Lohri = day before Makara, Pahili
  // Raja = day before Karka). We detect transit across TOMORROW'S Hindu day
  // (nextSunrise → dayAfterSunrise) and return the target rashi. Anchored
  // via tomorrow's sunset so `SearchRiseSet` unambiguously advances past
  // tomorrow's sunrise.
  let nextDaySankrantiRashi: number | null = null;
  try {
    const tomorrowSunsetUtc = computeSunset(nextSunriseUtc, location);
    const dayAfterSunriseUtc = computeSunrise(tomorrowSunsetUtc, location);
    const rashiAtDayAfterSunrise = Math.floor(getSun(dayAfterSunriseUtc) / 30) % 12;
    if (rashiAtNextSunrise !== rashiAtDayAfterSunrise) {
      nextDaySankrantiRashi = rashiAtDayAfterSunrise;
    }
  } catch (e: unknown) {
    if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) {
      throw e;
    }
    // Polar days with no tomorrow sunrise/sunset: skip next-day marker.
  }

  // Prev-day Sankranti — Sun's rashi at YESTERDAY's sunrise vs today's. If
  // they differ, a transit happened during yesterday's Hindu day. Used by
  // "day after Sankranti" observances (Basi Raja = day after Karka). The
  // yesterdaySunriseUtc and yesterdaySun longitudes are already computed for
  // viddha / priorMasaWasAdhika, so this is a cheap reuse.
  const rashiAtYesterdaySunrise = Math.floor(getSun(yesterdaySunriseUtc) / 30) % 12;
  const prevDaySankrantiRashi: number | null =
    rashiAtYesterdaySunrise !== rashiAtSunrise ? rashiAtSunrise : null;

  // Ekadashi Dashami-viddha: if tithi-at-sunrise is Ekadashi (10/25) and
  // tithi-at-arunodaya (~96 min before sunrise) is Dashami (9/24), the Ekadashi
  // is Dashami-viddha and the Smarta fast shifts to Dwadashi.
  let ekadashiDashamiViddha = false;
  if (tithiAtSunrise.index === 10 || tithiAtSunrise.index === 25) {
    const tithiAtArunodaya = tithiAt(arunodayaUtc);
    const dashamiIndex = tithiAtSunrise.index === 10 ? 9 : 24;
    ekadashiDashamiViddha = tithiAtArunodaya === dashamiIndex;
  }

  // Smarta-Dwadashi: did yesterday's sunrise hold a Dashami-viddha Ekadashi
  // AND today's sunrise hold Dwadashi (11 or 26)? If so, the Smarta fast
  // observed today rather than yesterday.
  let smartaDwadashiToday = false;
  if (tithiAtSunrise.index === 11 || tithiAtSunrise.index === 26) {
    const ekadashiIndex = tithiAtSunrise.index === 11 ? 10 : 25;
    const dashamiIndex = tithiAtSunrise.index === 11 ? 9 : 24;
    const yesterdaySunriseTithi = tithiAt(yesterdaySunriseUtc);
    if (yesterdaySunriseTithi === ekadashiIndex) {
      const yesterdayArunodayaUtc = new Date(yesterdaySunriseUtc.getTime() - 96 * 60_000);
      const yesterdayArunodayaTithi = tithiAt(yesterdayArunodayaUtc);
      smartaDwadashiToday = yesterdayArunodayaTithi === dashamiIndex;
    }
  }

  // priorMasaWasAdhika: if today's amanta masa equals yesterday's amanta
  // masa AND yesterday was Adhika, today falls in the Nija that follows
  // an Adhika (relevant for `shift-to-nija` festivals).
  const yesterdayMoon = getMoon(yesterdaySunriseUtc);
  const yesterdaySun = getSun(yesterdaySunriseUtc);
  const yesterdayChandramasa = computeChandraMasa(
    yesterdaySun, yesterdayMoon,
    (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
    masaSystem,
  );
  const priorMasaWasAdhika =
    yesterdayChandramasa.amantaIndex === chandramasa.amantaIndex &&
    yesterdayChandramasa.isAdhika &&
    !chandramasa.isAdhika;

  // Bhadra Kala window overlapping today's Hindu day.
  const bhadraUtc = computeBhadraKaal(sunriseUtc, nextSunriseUtc, getMoon, getSun);

  // Format a clock string from offset-adjusted local Date for descriptions.
  const formatClock = (d: Date): string => {
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const festivals = computeFestivals(
    {
      tithiIndex: tithiAtSunrise.index,
      nakshatraIndex: Math.floor(siderealMoonAtSunrise / NAKSHATRA_SPAN),
      chandraMasaIndex: chandramasa.amantaIndex,
      purnimantaMasaIndex: chandramasa.purnimantaIndex,
      amantaMasaName: chandramasa.amantaName,
      purnimantaMasaName: chandramasa.purnimantaName,
      isAdhika: chandramasa.isAdhika,
      priorMasaWasAdhika,
      varaIndex: vara.index,
      solarMasaIndex: rashiAtSunrise,
      tithiByRule,
      tithiByRuleStart,
      priorDayTithiByRule,
      nakshatraIndicesInDay,
      sankrantiRashi,
      nextDaySankrantiRashi,
      prevDaySankrantiRashi,
      ekadashiDashamiViddha,
      smartaDwadashiToday,
      moonriseInDay: moonriseInDayUtc,
      bhadra: bhadraUtc
        ? {
            start: utcToLocalDisplay(bhadraUtc.start, offsetMinutes),
            end: utcToLocalDisplay(bhadraUtc.end, offsetMinutes),
          }
        : null,
      formatClock,
      region: resolveRegionAlias(options.region),
    },
    (key) => t.festivalNames[key] ?? (t.misc as Record<string, string>)[key] ?? key,
    (idx) => resolveMasaName(idx, lang),
  );

  // Eclipse: detected once per Hindu day; surface as both a top-level field
  // (wired in step 9) and a festival entry so downstream consumers iterating
  // `festivals` see it.
  const eclipseUtc = getEclipseDuringDay(sunriseUtc, nextSunriseUtc, location);
  if (eclipseUtc) {
    const eclipseKey = eclipseUtc.kind === 'solar' ? 'surya_grahan' : 'chandra_grahan';
    const eclipseName = t.festivalNames[eclipseKey]
      ?? (eclipseUtc.kind === 'solar' ? 'Surya Grahan' : 'Chandra Grahan');
    festivals.unshift({
      name: eclipseName,
      type: 'eclipse',
      description: eclipseUtc.description,
    });
  }

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
        const idx = getTithiIndexFromLons(moon, sun);
        return computeTithiFromLongitudes(moon, sun, resolveTithiName(idx, lang), resolvePakshaName(idx, lang));
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
  const vijayaMuhurtaUtc = computeVijayaMuhurta(sunriseUtc, sunsetUtc);
  const godhuliMuhurtaUtc = computeGodhuliMuhurta(sunsetUtc);
  const nishitaMuhurtaUtc = computeNishitaMuhurta(sunsetUtc, nextSunriseUtc);
  const amritKalaUtc = computeAmritKala(
    sunriseUtc, nextSunriseUtc,
    Math.floor(siderealMoonAtSunrise / NAKSHATRA_SPAN),
  );

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

  const chandraBalam = options.janmaRashi !== undefined
    ? computeChandraBalam(options.janmaRashi, chandraRashi.index, lang)
    : undefined;

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
    chandraRashi,
    suryaNakshatra,
    brahmaMuhurta: convertTimePeriod(brahmaMuhurta),
    choghadiya: {
      day:   choghadiya.day.map(s   => ({ ...s, ...convertTimePeriod(s) })),
      night: choghadiya.night.map(s => ({ ...s, ...convertTimePeriod(s) })),
    },
    hora: {
      day:   hora.day.map(s   => ({ ...s, ...convertTimePeriod(s) })),
      night: hora.night.map(s => ({ ...s, ...convertTimePeriod(s) })),
    },
    moonrise: moonriseUtc ? toLocal(moonriseUtc) : null,
    moonset:  moonsetUtc  ? toLocal(moonsetUtc)  : null,
    panchaka,
    specialYogas,
    durMuhurta: [convertTimePeriod(durMuhurtaUtc[0]), convertTimePeriod(durMuhurtaUtc[1])],
    festivals,
    gowriPanchangam: {
      day:   gowriPanchangam.day.map(s   => ({ ...s, ...convertTimePeriod(s) })),
      night: gowriPanchangam.night.map(s => ({ ...s, ...convertTimePeriod(s) })),
    },
    bhadra: bhadraUtc
      ? {
          start: toLocal(bhadraUtc.start),
          end: toLocal(bhadraUtc.end),
          location: bhadraUtc.location,
          isActive: bhadraUtc.isActive,
        }
      : null,
    vijayaMuhurta: convertTimePeriod(vijayaMuhurtaUtc),
    godhuliMuhurta: convertTimePeriod(godhuliMuhurtaUtc),
    nishitaMuhurta: convertTimePeriod(nishitaMuhurtaUtc),
    amritKala: amritKalaUtc ? convertTimePeriod(amritKalaUtc) : null,
    eclipse: eclipseUtc
      ? {
          kind: eclipseUtc.kind,
          subtype: eclipseUtc.subtype,
          start: toLocal(eclipseUtc.start),
          peak: toLocal(eclipseUtc.peak),
          end: toLocal(eclipseUtc.end),
          visibleFromLocation: eclipseUtc.visibleFromLocation,
          magnitude: eclipseUtc.magnitude,
          sutakStart: toLocal(eclipseUtc.sutakStart),
          sutakEnd: toLocal(eclipseUtc.sutakEnd),
          description: eclipseUtc.description,
        }
      : null,
    ...(chandraBalam !== undefined ? { chandraBalam } : {}),
  };
}
