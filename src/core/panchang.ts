import { validateDate, validateLocation } from '../utils/validation';
import { PanchangError } from '../types/errors';
import { LongitudeCache } from '../astronomy/cache';
import { NewMoonCache } from '../astronomy/newMoon';
import { computeAyanamsa } from '../astronomy/ayanamsa';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import type { ElementAngle } from '../utils/search';
import {
  findTransitionTime, findDailyElements,
  STANDARD_PRECISION,
} from '../utils/search';
import {
  nakshatraOf, TITHI_SPAN, KARANA_SPAN, NAKSHATRA_SPAN, YOGA_SPAN,
} from '../utils/constants';
import {
  resolveUtcOffset, getLocalMidnightUtc, utcToLocalDisplay, formatInZone,
} from '../utils/timezone';
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
import type {
  InstantPanchangResult, DailyPanchangResult, ResolvedTimezone,
} from '../types/panchang';
import type {
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo, TimePeriod,
  ChoghadiyaQuality, FestivalInfo, UtcWindow, Unlocalized,
} from '../types/elements';

/**
 * ## INTERPOLATE_ALWAYS — why the panchang entry points never pick a cache mode
 *
 * `LongitudeCache` supports exact per-instant memoization and Chebyshev
 * interpolation, and this file used to choose between them with
 * `doEndTimes ? 'interpolated' : 'exact'`. That was right for a narrowed call
 * and wrong for a full one: with every section on, the festival block alone
 * makes enough longitude reads to pay for building the blocks, so asking for
 * *less* output cost *more* — `computeEndTimes: false` measured 1.19 ms against
 * a full call's 0.93 ms cold, and 0.75 ms against 0.63 ms warm.
 *
 * The apparent fix — interpolate when `doEndTimes || wantFestivals` — is worse
 * than the bug. The two modes do not agree to the last bit (the interpolant
 * carries ≤2.0e-7° of fit error), so making the mode a function of
 * `options.sections` would make the *published numbers* a function of
 * `options.sections`, breaking the property `tests/unit/sections.test.ts`
 * exists to guard: narrowing skips work, it never changes output. It would hold
 * for `computeEndTimes: true` and silently fail for `computeEndTimes: false`.
 *
 * So the mode is not chosen at all: both entry points always interpolate. The
 * output then depends on neither `sections` nor `computeEndTimes`, which is a
 * stronger guarantee than the one that was at risk — and it retires a
 * pre-existing discrepancy where the same day published a different
 * `siderealMoonAtSunrise` with and without end-times.
 *
 * The cost is bounded and one-sided: a process that computes a single day and
 * exits pays ~0.115 ms to build blocks it never reuses, against ~0.017 ms of
 * direct reads. Beyond a handful of days, sharing wins (`cache.ts`).
 *
 * ---
 *
 * The continuous angle behind each element index, for {@link findTransitionTime}
 * and {@link findDailyElements}.
 *
 * These must stay in lockstep with the matching `get*IndexAtTime` functions —
 * each index is `floor(normalize360(angle) / span)`, so the angle here is
 * exactly what that function normalizes and floors. They are built per call so
 * they read through the same memoized `getMoon` / `getSun` the index functions
 * use, which keeps the secant solve free of extra ephemeris work.
 */
const TITHI_ANGLE = (
  getMoon: (d: Date) => number, getSun: (d: Date) => number,
): ElementAngle => ({ angleAt: (d) => getMoon(d) - getSun(d), spanDeg: TITHI_SPAN });

const KARANA_ANGLE = (
  getMoon: (d: Date) => number, getSun: (d: Date) => number,
): ElementAngle => ({ angleAt: (d) => getMoon(d) - getSun(d), spanDeg: KARANA_SPAN });

const NAKSHATRA_ANGLE = (
  getMoon: (d: Date) => number,
): ElementAngle => ({ angleAt: (d) => getMoon(d), spanDeg: NAKSHATRA_SPAN });

const YOGA_ANGLE = (
  getMoon: (d: Date) => number, getSun: (d: Date) => number,
): ElementAngle => ({ angleAt: (d) => getSun(d) + getMoon(d), spanDeg: YOGA_SPAN });

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
 *                 No `timezone` required — the result is UTC-based.
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
 *   console.log(p.angas.tithi.name);     // "कृष्ण चतुर्दशी"
 *   console.log(p.angas.tithi.endTime);  // Date — true instant this Tithi ends
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

  // Always interpolated — see INTERPOLATE_ALWAYS.
  const cache = new LongitudeCache(ayanamsaType, 'interpolated');
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
      STANDARD_PRECISION.maxIterations, STANDARD_PRECISION.toleranceMs, TITHI_ANGLE(getMoon, getSun),
    );
    nakshatra.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      nakshatra.index, (d) => getNakshatraIndexAtTime(d, getMoon),
      STANDARD_PRECISION.maxIterations, STANDARD_PRECISION.toleranceMs, NAKSHATRA_ANGLE(getMoon),
    );
    yoga.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      yoga.index, (d) => getYogaIndexAtTime(d, getMoon, getSun),
      STANDARD_PRECISION.maxIterations, STANDARD_PRECISION.toleranceMs, YOGA_ANGLE(getMoon, getSun),
    );
    karana.endTime = findTransitionTime(
      date, new Date(date.getTime() + 18 * 3600_000),
      karana.index, (d) => getKaranaIndexAtTime(d, getMoon, getSun),
      STANDARD_PRECISION.maxIterations, STANDARD_PRECISION.toleranceMs, KARANA_ANGLE(getMoon, getSun),
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

  // Always present, `null` when the matching option was not passed — the result
  // shape never depends on the options. See the optional-vs-null rule on
  // `DailyPanchangResult`.
  const chandraBalam = options?.janmaRashi !== undefined
    ? computeChandraBalam(options.janmaRashi, chandraRashi.index, lang)
    : null;
  const tarabala = options?.janmaNakshatra !== undefined
    ? computeTarabala(options.janmaNakshatra, nakshatraOf(siderealMoon), lang)
    : null;
  const gandaMula = computeGandaMula(nakshatraOf(siderealMoon), lang);
  const anandadiYoga = computeAnandadiYoga(
    vara.index,
    nakshatraOf(siderealMoon),
    lang,
  );

  return {
    timestamp: date,
    location,
    ayanamsa: ayanamsaValue,
    sun: { siderealLongitude: siderealSun, nakshatra: suryaNakshatra },
    moon: { siderealLongitude: siderealMoon, rashi: chandraRashi },
    angas: { tithi, nakshatra, yoga, karana, vara },
    calendar: { chandramasa, samvat },
    inauspicious: { panchaka: computePanchaka(siderealMoon), gandaMula },
    specialYogas,
    anandadiYoga,
    festivals,
    chandraBalam,
    tarabala,
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
 * Every `Date` in the result is a **true instant** — `.getTime()` is the correct
 * epoch millisecond. For display, read the matching `*Local` string, which is
 * offset-carrying ISO 8601 in the requested timezone:
 * ```
 * result.sun.rise.getTime()   // correct epoch ms
 * result.sun.riseLocal        // "2025-01-14T07:09:44.172+05:30"
 * ```
 *
 * @param date     Any `Date` within the local calendar day you want.
 *                 Only the calendar date is used; the time component is ignored.
 * @param location Observer coordinates `{ latitude, longitude, elevation? }`.
 * @param options  Settings — `timezone` is required (UTC offset in minutes,
 *                 e.g. 330 for IST). Also accepts `ayanamsa`, `language`,
 *                 `computeEndTimes`.
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
 *   result.angas.tithis[0].name;        // "Krishna Chaturdashi"
 *   result.angas.vara.name;             // "Mangalawara"
 *   result.inauspicious.rahuKalam.start; // Date — true instant
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
  // Echo the zone back when the caller named one — a bare offset cannot say
  // which zone produced it, and every wall-clock reading depends on that.
  const resolvedTimezone: ResolvedTimezone = typeof options.timezone === 'string'
    ? { offsetMinutes, zone: options.timezone }
    : { offsetMinutes };
  const ayanamsaType = options.ayanamsa ?? 'lahiri';
  const lang = options.language ?? 'en';
  const t = getTranslations(lang);
  const doEndTimes = options.computeEndTimes !== false;

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
  // Always interpolated — see INTERPOLATE_ALWAYS.
  const cache = new LongitudeCache(ayanamsaType, 'interpolated');
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
    ? getEclipseDuringDay(sunriseUtc, nextSunriseUtc, location, lang, {
        tropicalMoon: (d) => cache.getTropicalMoon(d),
        tropicalSun: (d) => cache.getTropicalSun(d),
      })
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
      30, 36, STANDARD_PRECISION, 3, TITHI_ANGLE(getMoon, getSun),
    ) as DailyTithiInfo[];
    nakshatras = findDailyElements(
      sunriseUtc, nextSunriseUtc, nakshatraAtSunrise,
      (d) => getNakshatraIndexAtTime(d, getMoon),
      (d) => {
        const moon = getMoon(d);
        return computeNakshatraFromLongitude(moon, resolveNakshatraName(nakshatraOf(moon), lang));
      },
      27, 36, STANDARD_PRECISION, 3, NAKSHATRA_ANGLE(getMoon),
    ) as DailyNakshatraInfo[];
    yogas = findDailyElements(
      sunriseUtc, nextSunriseUtc, yogaAtSunrise,
      (d) => getYogaIndexAtTime(d, getMoon, getSun),
      (d) => {
        const moon = getMoon(d), sun = getSun(d);
        return computeYogaFromLongitudes(moon, sun, resolveYogaName(getYogaIndex(moon, sun), lang));
      },
      27, 36, STANDARD_PRECISION, 3, YOGA_ANGLE(getMoon, getSun),
    ) as DailyYogaInfo[];
    karanas = findDailyElements(
      sunriseUtc, nextSunriseUtc, karanaAtSunrise,
      (d) => getKaranaIndexAtTime(d, getMoon, getSun),
      (d) => {
        const moon = getMoon(d), sun = getSun(d);
        return computeKaranaFromLongitudes(moon, sun, resolveKaranaName(getKaranaIndex(moon, sun), lang));
      },
      60, 18, STANDARD_PRECISION, 5, KARANA_ANGLE(getMoon, getSun),
    ) as DailyKaranaInfo[];
  } else {
    const bare = { startTime: null, startTimeLocal: null, endTimeLocal: null, isActiveAtSunrise: true };
    tithis = [{ ...tithiAtSunrise, ...bare }];
    nakshatras = [{ ...nakshatraAtSunrise, ...bare }];
    yogas = [{ ...yogaAtSunrise, ...bare }];
    karanas = [{ ...karanaAtSunrise, ...bare }];
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

  // ── 8. Render local wall-clock strings; instants stay instants ────────
  //
  // This block used to *shift* every published `Date` by `offsetMinutes`, so
  // `result.sunrise.getTime()` was not when sunrise happened. That made
  // `JSON.stringify`, `Intl` with a `timeZone`, date-fns, Temporal and any
  // comparison against a real timestamp silently wrong by the offset, and the
  // README had to tell consumers to read the values back with `getUTC*`.
  //
  // v5 publishes the true instant and renders the wall clock alongside it as an
  // offset-carrying ISO 8601 string. The instant is the fact; the string is one
  // presentation of it, and `formatInZone` is exported so callers can make
  // others.
  const local = (d: Date) => formatInZone(d, offsetMinutes);
  const localOrNull = (d: Date | null) => (d ? local(d) : null);
  const withLocal = (tp: UtcWindow): TimePeriod => ({
    start: tp.start,
    end: tp.end,
    startLocal: local(tp.start),
    endLocal: local(tp.end),
  });
  /**
   * Localize a slot array (Choghadiya / Hora / Do-Ghati / Gowri shapes) by
   * adding `startLocal`/`endLocal` while preserving every other field. The
   * spread is what makes this type-safe across slot variants — `withLocal`
   * returns only the window fields and would otherwise drop name/quality/etc.
   */
  const localizeSlots = <T extends TimePeriod>(
    slots: readonly Unlocalized<T>[],
  ): T[] => slots.map(s => ({ ...s, ...withLocal(s) }) as T);

  const dayDurationMs = sunsetUtc.getTime() - sunriseUtc.getTime();
  const nightDurationMs = nextSunriseUtc.getTime() - sunsetUtc.getTime();

  for (const t of tithis) t.startTimeLocal = localOrNull(t.startTime);
  for (const n of nakshatras) n.startTimeLocal = localOrNull(n.startTime);
  for (const y of yogas) y.startTimeLocal = localOrNull(y.startTime);
  for (const k of karanas) k.startTimeLocal = localOrNull(k.startTime);
  for (const e of [...tithis, ...nakshatras, ...yogas, ...karanas]) {
    e.endTimeLocal = localOrNull(e.endTime);
  }

  // Always present, `null` when the matching option was not passed — see the
  // optional-vs-null rule on `DailyPanchangResult`.
  const chandraBalam = options.janmaRashi !== undefined
    ? computeChandraBalam(options.janmaRashi, chandraRashi.index, lang)
    : null;
  const tarabala = options.janmaNakshatra !== undefined
    ? computeTarabala(
        options.janmaNakshatra,
        nakshatraOf(siderealMoonAtSunrise),
        lang,
      )
    : null;

  const dayMinutes = Math.round(dayDurationMs / 60_000);
  const nightMinutes = Math.round(nightDurationMs / 60_000);

  // ── 9. Assemble result ───────────────────────────────
  return {
    date,
    location,
    timezone: resolvedTimezone,
    ayanamsa: ayanamsaValue,
    sun: {
      rise: sunriseUtc,
      set: sunsetUtc,
      nextRise: nextSunriseUtc,
      riseLocal: local(sunriseUtc),
      setLocal: local(sunsetUtc),
      nextRiseLocal: local(nextSunriseUtc),
      dayDurationMinutes: dayMinutes,
      nightDurationMinutes: nightMinutes,
      dinamanaMinutes: dayMinutes,
      ratrimanaMinutes: nightMinutes,
      siderealLongitude: siderealSunAtSunrise,
      nakshatra: suryaNakshatra,
    },
    moon: {
      rise: moonriseUtc,
      set:  moonsetUtc,
      riseLocal: localOrNull(moonriseUtc),
      setLocal:  localOrNull(moonsetUtc),
      siderealLongitude: siderealMoonAtSunrise,
      rashi: chandraRashi,
    },
    angas: { tithis, nakshatras, yogas, karanas, vara },
    calendar: { masa, chandramasa, samvat },
    muhurtas: {
      abhijit: abhijitMuhurta === null ? null : withLocal(abhijitMuhurta),
      brahma: withLocal(brahmaMuhurta),
      vijaya: withLocal(vijayaMuhurtaUtc),
      godhuli: withLocal(godhuliMuhurtaUtc),
      nishita: withLocal(nishitaMuhurtaUtc),
      amritKala: amritKalaUtc ? withLocal(amritKalaUtc) : null,
      madhyahna: withLocal(madhyahnaWindowUtc),
      pratahSandhya: withLocal(pratahSandhyaUtc),
      sayahnaSandhya: withLocal(sayahnaSandhyaUtc),
      doGhati: {
        day:   localizeSlots(doGhatiMuhurta.day),
        night: localizeSlots(doGhatiMuhurta.night),
      },
    },
    inauspicious: {
      rahuKalam: withLocal(rahuKalam),
      gulikaKalam: withLocal(gulikaKalam),
      yamaganda: withLocal(yamaganda),
      durMuhurta: [withLocal(durMuhurtaUtc[0]), withLocal(durMuhurtaUtc[1])],
      varjyam: varjyamUtc ? withLocal(varjyamUtc) : null,
      bhadra: bhadraUtc
        ? {
            start: bhadraUtc.start,
            end: bhadraUtc.end,
            startLocal: local(bhadraUtc.start),
            endLocal: local(bhadraUtc.end),
            location: bhadraUtc.location,
            locationName: bhadraUtc.locationName,
            isActive: bhadraUtc.isActive,
          }
        : null,
      gandaMula,
      panchaka,
      panchakaRahita: panchakaRahitaUtc.map(withLocal),
    },
    periods: {
      choghadiya: {
        day:   localizeSlots(choghadiya.day),
        night: localizeSlots(choghadiya.night),
      },
      hora: {
        day:   localizeSlots(hora.day),
        night: localizeSlots(hora.night),
      },
      gowri: {
        day:   localizeSlots(gowriPanchangam.day),
        night: localizeSlots(gowriPanchangam.night),
      },
    },
    specialYogas,
    anandadiYoga,
    festivals,
    eclipse: eclipseUtc
      ? {
          kind: eclipseUtc.kind,
          subtype: eclipseUtc.subtype,
          start: eclipseUtc.start,
          peak: eclipseUtc.peak,
          end: eclipseUtc.end,
          startLocal: local(eclipseUtc.start),
          peakLocal: local(eclipseUtc.peak),
          endLocal: local(eclipseUtc.end),
          visibleFromLocation: eclipseUtc.visibleFromLocation,
          obscuration: eclipseUtc.obscuration,
          magnitude: eclipseUtc.magnitude,
          sutakStart: eclipseUtc.sutakStart,
          sutakEnd: eclipseUtc.sutakEnd,
          sutakStartLocal: localOrNull(eclipseUtc.sutakStart),
          sutakEndLocal: localOrNull(eclipseUtc.sutakEnd),
          description: eclipseUtc.description,
        }
      : null,
    chandraBalam,
    tarabala,
  };
}
