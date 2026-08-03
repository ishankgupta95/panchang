import { validateDate, validateLocation } from '../utils/validation';
import { PanchangError } from '../types/errors';
import { LongitudeCache } from '../astronomy/cache';
import { NewMoonCache } from '../astronomy/newMoon';
import { computeAyanamsa } from '../astronomy/ayanamsa';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import {
  findTransitionTime, findDailyElements,
  STANDARD_PRECISION, HIGH_PRECISION,
} from '../utils/search';
import { nakshatraOf } from '../utils/constants';
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
  computeMadhyahna, computePratahSandhya, computeSayahnaSandhya,
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
import { computePanchakaRahita } from './panchakaRahita';
import { computeDoGhati } from './doGhati';
import { computeSpecialYogas } from './specialYogas';
import { computeDurMuhurta } from './durMuhurta';
import { computeFestivals } from './festivals';
import { computeDayFestivals } from './dayFestivals';
import { resolveRegionAlias } from './regionAlias';
import { computeBhadraKaal } from './bhadra';
import { computeVarjyam } from './varjyam';
import { computeGandaMula } from './gandaMula';
import { computeAnandadiYoga } from './anandadiYoga';
import { computeChandraBalam } from '../jyotish/chandraBalam';
import { computeTarabala } from '../jyotish/tarabala';
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
import type { InstantPanchangOptions, PanchangOptions, PanchangSection } from '../types/options';
import type { InstantPanchangResult, DailyPanchangResult } from '../types/panchang';
import type {
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo, TimePeriod,
  ChoghadiyaQuality, FestivalInfo,
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
  const t = getTranslations(lang);
  const doEndTimes = options?.computeEndTimes !== false;
  const precision = options?.precision === 'high' ? HIGH_PRECISION : STANDARD_PRECISION;

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
    resolveNakshatraName(nakshatraOf(siderealMoon), lang),
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
    t.varaNames,
  );
  const masaSystem = options?.masaSystem ?? 'purnimanta';
  const chandramasa = computeChandraMasa(
    siderealSun, siderealMoon,
    (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
    masaSystem,
    date, getSun,
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
      tithi.index, (d) => getTithiIndexAtTime(d, getMoon, getSun),
      precision.maxIterations, precision.toleranceMs,
    );
    nakshatra.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      nakshatra.index, (d) => getNakshatraIndexAtTime(d, getMoon),
      precision.maxIterations, precision.toleranceMs,
    );
    yoga.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      yoga.index, (d) => getYogaIndexAtTime(d, getMoon, getSun),
      precision.maxIterations, precision.toleranceMs,
    );
    karana.endTime = findTransitionTime(
      date, new Date(date.getTime() + 18 * 3600_000),
      karana.index, (d) => getKaranaIndexAtTime(d, getMoon, getSun),
      precision.maxIterations, precision.toleranceMs,
    );
  }

  const specialYogas = computeSpecialYogas(
    vara.index, tithi.index,
    nakshatraOf(siderealMoon),
    suryaNakshatra.index,
    (type) => (t.specialYogaNames as Record<string, string>)[type] ?? type,
  );
  // Instant-mode festival detection uses the tithi-at-instant for all rules;
  // it does not attempt canonical-time (madhyahna/pradosha/nishita/chandrodaya)
  // refinement, transit-based Sankranti, or Ekadashi viddha — those require a
  // full sunrise-to-nextSunrise Hindu day and are computed in `getDailyPanchang`.
  const festivals = computeFestivals(
    {
      tithiIndex: tithi.index,
      nakshatraIndex: nakshatraOf(siderealMoon),
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
  const tarabala = options?.janmaNakshatra !== undefined
    ? computeTarabala(options.janmaNakshatra, nakshatraOf(siderealMoon), lang)
    : undefined;
  const gandaMula = computeGandaMula(nakshatraOf(siderealMoon), lang);
  const anandadiYoga = computeAnandadiYoga(
    vara.index,
    nakshatraOf(siderealMoon),
    lang,
  );

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
    gandaMula,
    anandadiYoga,
    ...(chandraBalam !== undefined ? { chandraBalam } : {}),
    ...(tarabala !== undefined ? { tarabala } : {}),
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
  const t = getTranslations(lang);
  const doEndTimes = options.computeEndTimes !== false;
  const precision = options.precision === 'high' ? HIGH_PRECISION : STANDARD_PRECISION;

  // Optional ephemeris-backed sections; all enabled unless narrowed.
  const sections = options.sections;
  const wants = (s: PanchangSection): boolean => sections === undefined || sections.includes(s);
  const wantFestivals = wants('festivals');
  const wantEclipse = wants('eclipse');
  const wantMoonTimes = wants('moonTimes');
  const wantLunarWindows = wants('lunarWindows');
  // Raksha Bandhan's Bhadra exclusion reads the Bhadra window, so festivals
  // need it computed even when the caller didn't ask for the window itself.
  // It is still only *reported* when 'lunarWindows' is requested.
  const needBhadra = wantLunarWindows || wantFestivals;

  // ── 2. Create per-call longitude cache ──────────────
  const cache = new LongitudeCache(ayanamsaType);
  const getMoon = (d: Date) => cache.getMoon(d);
  const getSun = (d: Date) => cache.getSun(d);
  // Shared across today's and the prior day's Chandra Masa resolution — both
  // land in the same lunation on ~29 days in 30, so the second is a cache hit.
  const newMoons = new NewMoonCache();
  const getBounds = (ref: Date) => newMoons.bounding(ref);

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
    resolveNakshatraName(nakshatraOf(siderealMoonAtSunrise), lang),
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
  const vara = computeVara(sunriseLocal, sunriseLocal, t.varaNames);
  const masa = computeMasa(siderealSunAtSunrise, (idx) => resolveMasaName(idx, lang));
  const masaSystem = options.masaSystem ?? 'purnimanta';
  const chandramasa = computeChandraMasa(
    siderealSunAtSunrise, siderealMoonAtSunrise,
    (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
    masaSystem,
    sunriseUtc, getSun, getBounds,
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
  const qualityNameFn = (q: ChoghadiyaQuality) => t.qualityNames[q];
  const choghadiya = computeChoghadiya(
    sunriseUtc, sunsetUtc, nextSunriseUtc, vara.index,
    (idx) => t.choghadiyaNames[idx]!,
    qualityNameFn,
  );
  const hora = computeHora(
    sunriseUtc, sunsetUtc, nextSunriseUtc, vara.index,
    (idx) => t.grahaNames[idx]!,
  );
  const gowriPanchangam = computeGowriPanchangam(
    sunriseUtc, sunsetUtc, nextSunriseUtc, vara.index,
    (idx) => t.gowriNames[idx]!,
    qualityNameFn,
  );
  // Moonrise: first rise after local midnight (the moon may not rise on a given
  // calendar day, in which case getMoonrise returns null).
  // Moonset: pair it with the same lunation as moonrise — search from moonrise
  // when one exists, falling back to local midnight only when there is no
  // moonrise on this day. Searching from local midnight unconditionally returns
  // the *previous* lunation's setting on days where the moon rises late and
  // sets the following morning.
  // Festivals key Karva Chauth / Sankashti off moonrise, so it is needed
  // whenever either section is on; `moonset` is reported only for 'moonTimes'.
  const needMoonrise = wantMoonTimes || wantFestivals;
  const moonriseUtc = needMoonrise ? getMoonrise(localMidnightUtc, location) : null;
  const moonsetUtc = wantMoonTimes
    ? getMoonset(moonriseUtc ?? localMidnightUtc, location)
    : null;
  const panchaka = computePanchaka(siderealMoonAtSunrise);
  const panchakaRahitaUtc = wantLunarWindows
    ? computePanchakaRahita(sunriseUtc, nextSunriseUtc, getMoon)
    : [];
  const doGhatiMuhurta = computeDoGhati(
    sunriseUtc, sunsetUtc, nextSunriseUtc,
    (idx) => t.doGhatiNames[idx]!,
    qualityNameFn,
  );

  const specialYogas = computeSpecialYogas(
    vara.index, tithiAtSunrise.index,
    nakshatraOf(siderealMoonAtSunrise),
    suryaNakshatra.index,
    (type) => (t.specialYogaNames as Record<string, string>)[type] ?? type,
  );
  const durMuhurtaUtc = computeDurMuhurta(sunriseUtc, sunsetUtc, vara.index);

  // Bhadra Kala window overlapping today's Hindu day. Computed whenever either
  // consumer needs it — the Raksha Bandhan exclusion below reads it, and it is
  // reported directly under 'lunarWindows'.
  const bhadraUtc = needBhadra
    ? computeBhadraKaal(
        sunriseUtc, nextSunriseUtc, getMoon, getSun,
        (key) => t.bhadraLocationNames[key],
      )
    : null;

  // Varjyam (Vishaghati) window for the nakshatra active at sunrise.
  const varjyamUtc = wantLunarWindows
    ? computeVarjyam(nakshatraAtSunrise.index, sunriseUtc, nextSunriseUtc, getMoon)
    : null;

  // Ganda Mula — pure index test on the nakshatra active at sunrise.
  const gandaMula = computeGandaMula(nakshatraAtSunrise.index, lang);

  // Anandadi Yoga — Vara × Nakshatra 28-name cycle, evaluated at sunrise.
  const anandadiYoga = computeAnandadiYoga(vara.index, nakshatraAtSunrise.index, lang);

  // ── Festival computation: canonical times + transits + viddha ──
  //
  // The whole pipeline lives in `computeDayFestivals` — it is the most
  // expensive optional block of a daily panchang (prior-day sunrise/sunset,
  // next-day transit, per-kala tithi anchors), so it is skipped wholesale
  // unless the 'festivals' section is requested.
  const festivals: FestivalInfo[] = wantFestivals
    ? computeDayFestivals({
        sunriseUtc, sunsetUtc, nextSunriseUtc, location,
        offsetMinutes,
        tithiIndexAtSunrise: tithiAtSunrise.index,
        siderealMoonAtSunrise, siderealSunAtSunrise,
        varaIndex: vara.index,
        chandramasa, masaSystem, lang, t,
        region: options.region,
        moonriseUtc, bhadraUtc,
        getMoon, getSun, getBounds,
      })
    : [];

  // Eclipse: detected once per Hindu day; surface as both a top-level field
  // (wired in step 9) and a festival entry so downstream consumers iterating
  // `festivals` see it.
  const eclipseUtc = wantEclipse
    ? getEclipseDuringDay(sunriseUtc, nextSunriseUtc, location, lang)
    : null;
  if (eclipseUtc) {
    const eclipseKey = eclipseUtc.kind === 'solar' ? 'surya_grahan' : 'chandra_grahan';
    const eclipseName = t.festivalNames[eclipseKey]
      ?? (eclipseUtc.kind === 'solar' ? 'Surya Grahan' : 'Chandra Grahan');
    festivals.unshift({
      key: eclipseKey,
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
      // maxPerDay = 3: a short tithi fully contained in the sunrise→nextSunrise
      // window means 3 tithis legitimately touch the Hindu day (was 2, which
      // silently dropped the 3rd). Matches MAX_DAILY_TITHIS.
      30, 36, precision, 3,
    ) as DailyTithiInfo[];
    nakshatras = findDailyElements(
      sunriseUtc, nextSunriseUtc, nakshatraAtSunrise,
      (d) => getNakshatraIndexAtTime(d, getMoon),
      (d) => {
        const moon = getMoon(d);
        return computeNakshatraFromLongitude(moon, resolveNakshatraName(nakshatraOf(moon), lang));
      },
      27, 36, precision, 3,
    ) as DailyNakshatraInfo[];
    yogas = findDailyElements(
      sunriseUtc, nextSunriseUtc, yogaAtSunrise,
      (d) => getYogaIndexAtTime(d, getMoon, getSun),
      (d) => {
        const moon = getMoon(d), sun = getSun(d);
        return computeYogaFromLongitudes(moon, sun, resolveYogaName(getYogaIndex(moon, sun), lang));
      },
      27, 36, precision, 3,
    ) as DailyYogaInfo[];
    karanas = findDailyElements(
      sunriseUtc, nextSunriseUtc, karanaAtSunrise,
      (d) => getKaranaIndexAtTime(d, getMoon, getSun),
      (d) => {
        const moon = getMoon(d), sun = getSun(d);
        return computeKaranaFromLongitudes(moon, sun, resolveKaranaName(getKaranaIndex(moon, sun), lang));
      },
      60, 18, precision, 5,
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
  const abhijitMuhurta = computeAbhijitMuhurta(sunriseUtc, sunsetUtc, vara.index);
  const vijayaMuhurtaUtc = computeVijayaMuhurta(sunriseUtc, sunsetUtc);
  const godhuliMuhurtaUtc = computeGodhuliMuhurta(sunsetUtc);
  const nishitaMuhurtaUtc = computeNishitaMuhurta(sunsetUtc, nextSunriseUtc);
  const amritKalaUtc = computeAmritKala(
    sunriseUtc, nextSunriseUtc,
    nakshatraOf(siderealMoonAtSunrise),
  );
  const madhyahnaWindowUtc = computeMadhyahna(sunriseUtc, sunsetUtc);
  const pratahSandhyaUtc = computePratahSandhya(sunriseUtc, sunsetUtc, nextSunriseUtc);
  const sayahnaSandhyaUtc = computeSayahnaSandhya(sunsetUtc, nextSunriseUtc);

  // ── 8. Convert all UTC dates to local display ────────
  const toLocal = (d: Date) => utcToLocalDisplay(d, offsetMinutes);
  const toLocalOrNull = (d: Date | null) => d ? toLocal(d) : null;
  const convertTimePeriod = (tp: TimePeriod): TimePeriod => ({
    start: toLocal(tp.start),
    end: toLocal(tp.end),
  });
  /**
   * Localize a slot array (Choghadiya / Hora / Do-Ghati / Gowri shapes) by
   * converting `start`/`end` to local display while preserving every other
   * field on the slot. The destructure-then-spread shape is what makes this
   * type-safe across slot variants — `convertTimePeriod` returns only
   * `{start,end}` and would otherwise drop name/quality/etc.
   */
  const localizeSlots = <T extends TimePeriod>(slots: readonly T[]): T[] =>
    slots.map(s => ({ ...s, ...convertTimePeriod(s) }));

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
  const tarabala = options.janmaNakshatra !== undefined
    ? computeTarabala(
        options.janmaNakshatra,
        nakshatraOf(siderealMoonAtSunrise),
        lang,
      )
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
    abhijitMuhurta: abhijitMuhurta === null ? null : convertTimePeriod(abhijitMuhurta),
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
      day:   localizeSlots(choghadiya.day),
      night: localizeSlots(choghadiya.night),
    },
    hora: {
      day:   localizeSlots(hora.day),
      night: localizeSlots(hora.night),
    },
    moonrise: moonriseUtc ? toLocal(moonriseUtc) : null,
    moonset:  moonsetUtc  ? toLocal(moonsetUtc)  : null,
    panchaka,
    panchakaRahita: panchakaRahitaUtc.map(convertTimePeriod),
    doGhatiMuhurta: {
      day:   localizeSlots(doGhatiMuhurta.day),
      night: localizeSlots(doGhatiMuhurta.night),
    },
    specialYogas,
    durMuhurta: [convertTimePeriod(durMuhurtaUtc[0]), convertTimePeriod(durMuhurtaUtc[1])],
    festivals,
    gowriPanchangam: {
      day:   localizeSlots(gowriPanchangam.day),
      night: localizeSlots(gowriPanchangam.night),
    },
    bhadra: bhadraUtc
      ? {
          start: toLocal(bhadraUtc.start),
          end: toLocal(bhadraUtc.end),
          location: bhadraUtc.location,
          locationName: bhadraUtc.locationName,
          isActive: bhadraUtc.isActive,
        }
      : null,
    varjyam: varjyamUtc ? convertTimePeriod(varjyamUtc) : null,
    gandaMula,
    anandadiYoga,
    vijayaMuhurta: convertTimePeriod(vijayaMuhurtaUtc),
    godhuliMuhurta: convertTimePeriod(godhuliMuhurtaUtc),
    nishitaMuhurta: convertTimePeriod(nishitaMuhurtaUtc),
    amritKala: amritKalaUtc ? convertTimePeriod(amritKalaUtc) : null,
    madhyahna: convertTimePeriod(madhyahnaWindowUtc),
    pratahSandhya: convertTimePeriod(pratahSandhyaUtc),
    sayahnaSandhya: convertTimePeriod(sayahnaSandhyaUtc),
    dinamanaMinutes: Math.round(dayDurationMs / 60_000),
    ratrimanaMinutes: Math.round(nightDurationMs / 60_000),
    eclipse: eclipseUtc
      ? {
          kind: eclipseUtc.kind,
          subtype: eclipseUtc.subtype,
          start: toLocal(eclipseUtc.start),
          peak: toLocal(eclipseUtc.peak),
          end: toLocal(eclipseUtc.end),
          visibleFromLocation: eclipseUtc.visibleFromLocation,
          magnitude: eclipseUtc.magnitude,
          sutakStart: toLocalOrNull(eclipseUtc.sutakStart),
          sutakEnd: toLocalOrNull(eclipseUtc.sutakEnd),
          description: eclipseUtc.description,
        }
      : null,
    ...(chandraBalam !== undefined ? { chandraBalam } : {}),
    ...(tarabala !== undefined ? { tarabala } : {}),
  };
}
