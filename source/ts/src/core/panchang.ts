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
  computeAbhijitMuhurta, brahmaMuhurtaForNight,
  computeVijayaMuhurta, computeGodhuliMuhurta,
  computeNishitaMuhurta, computeAmritKalaWindows,
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
import {
  computePanchaka, findPanchakaOnset, classifyPanchaka, isPanchakaDosha,
} from './panchaka';
import { computePanchakaRahita } from './panchakaRahita';
import { computeDoGhati } from './doGhati';
import { computeSpecialYogas } from './specialYogas';
import { computeDurMuhurta } from './durMuhurta';
import { computeFestivals } from './festivals';
import { computeDayFestivals } from './dayFestivals';
import { resolveRegionAlias } from './regionAlias';
import { computeBhadraKaal } from './bhadra';
import { computeVarjyamWindows } from './varjyam';
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
  ChoghadiyaQuality, FestivalInfo, UtcWindow, Unlocalized, PanchakaInfo,
  TithiInfo, VaraInfo, ChandraMasaInfo, SamvatInfo,
} from '../types/elements';
import type { PanchangTranslations } from '../i18n/types';

/**
 * INTERPOLATE_ALWAYS: both entry points run `LongitudeCache` in `'interpolated'`
 * mode unconditionally, never picking it from `sections` / `computeEndTimes`: the
 * modes disagree in the last bits, so the published numbers would otherwise depend
 * on which sections were asked for. The angle helpers below must stay in lockstep
 * with the matching `get*IndexAtTime`, which floors `normalize360(angle) / span`.
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

function varaIndexAtInstant(
  utc: Date,
  location: GeoLocation,
  offsetMinutes: number,
  varaNames: readonly { name: string; short: string }[],
): number {
  const local = utcToLocalDisplay(utc, offsetMinutes);
  try {
    let sunrise = computeSunrise(new Date(utc.getTime() - 26 * 3600_000), location);
    for (;;) {
      const next = computeSunrise(new Date(sunrise.getTime() + 3600_000), location);
      if (next.getTime() > utc.getTime()) break;
      sunrise = next;
    }
    if (sunrise.getTime() > utc.getTime()) return local.getUTCDay();
    const localSunrise = utcToLocalDisplay(sunrise, offsetMinutes);
    return computeVara(localSunrise, localSunrise, varaNames).index;
  } catch (e: unknown) {
    if (e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET')) {
      return local.getUTCDay();
    }
    throw e;
  }
}

function segmentsOverlap(
  a: { startTime: Date | null; endTime: Date | null },
  b: { startTime: Date | null; endTime: Date | null },
): boolean {
  const aStart = a.startTime?.getTime() ?? -Infinity;
  const aEnd = a.endTime?.getTime() ?? Infinity;
  const bStart = b.startTime?.getTime() ?? -Infinity;
  const bEnd = b.endTime?.getTime() ?? Infinity;
  return aStart < bEnd && bStart < aEnd;
}

/** Pairs are evaluated only where the segments overlap; a cross product would fabricate yogas. */
function computeSpecialYogasOverDay(
  varaIndex: number,
  tithis: readonly DailyTithiInfo[],
  nakshatras: readonly DailyNakshatraInfo[],
  suryaNakshatraIndex: number,
  nameResolver: (type: string) => string,
): ReturnType<typeof computeSpecialYogas> {
  const out: ReturnType<typeof computeSpecialYogas> = [];
  const seen = new Set<string>();
  for (const tithi of tithis) {
    for (const nakshatra of nakshatras) {
      if (!segmentsOverlap(tithi, nakshatra)) continue;
      const found = computeSpecialYogas(
        varaIndex, tithi.index, nakshatra.index, suryaNakshatraIndex, nameResolver,
      );
      for (const yoga of found) {
        if (seen.has(yoga.type)) continue;
        seen.add(yoga.type);
        out.push(yoga);
      }
    }
  }
  return out;
}

/** The type is fixed by the vara the Moon ENTERED the span on, hence the onset lookup. */
function buildPanchakaInfo(
  referenceUtc: Date,
  siderealMoonNow: number,
  getMoon: (d: Date) => number,
  varaIndexAt: (utc: Date) => number,
  t: PanchangTranslations,
): PanchakaInfo {
  if (!computePanchaka(siderealMoonNow)) return { active: false };
  const onset = findPanchakaOnset(referenceUtc, getMoon);
  if (onset === null) return { active: false };

  const onsetVara = varaIndexAt(onset);
  const type = classifyPanchaka(onsetVara);
  return {
    active: true,
    type,
    name: t.panchakaTypeNames[type],
    isDosha: isPanchakaDosha(type),
    onsetVara,
  };
}

/**
 * The Panchang elements active at a single UTC instant, not over a sunrise-to-sunrise day.
 *
 * @returns `null` when the last sunrise at or before the instant, which gives the vara,
 *          cannot be settled: none falls in the 26 h before it, or the last one is not
 *          followed by another within two days (polar night or polar day).
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

  const lmtOffsetMinutes = Math.round(location.longitude * 4);
  let sunriseUtc: Date;
  try {
    sunriseUtc = computeSunrise(new Date(date.getTime() - 26 * 3600_000), location);
    for (;;) {
      const next = computeSunrise(new Date(sunriseUtc.getTime() + 3600_000), location);
      if (next.getTime() > date.getTime()) break;
      sunriseUtc = next;
    }
  } catch (e: unknown) {
    if (e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET')) {
      return null;
    }
    throw e;
  }
  if (sunriseUtc.getTime() > date.getTime()) return null;
  const vara = computeVara(
    utcToLocalDisplay(sunriseUtc, lmtOffsetMinutes),
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
  const festivalRegion = resolveRegionAlias(options?.region);
  const solarMasaIndex = Math.floor(siderealSun / 30) % 12;
  const festivals = computeFestivals(
    {
      tithiIndex: tithi.index,
      nakshatraIndex: nakshatraOf(siderealMoon),
      chandraMasaIndex: chandramasa.amantaIndex,
      varaMasaIndex: festivalRegion === 'nepal' ? (solarMasaIndex + 1) % 12 : chandramasa.index,
      isAdhika: chandramasa.isAdhika,
      varaIndex: vara.index,
      solarMasaIndex,
      region: festivalRegion,
    },
    (key) => t.festivalNames[key] ?? (t.misc as Record<string, string>)[key] ?? key,
    (idx) => resolveMasaName(idx, lang),
  );

  const chandraBalam = options?.janmaRashi != null
    ? computeChandraBalam(options.janmaRashi, chandraRashi.index, lang)
    : null;
  const tarabala = options?.janmaNakshatra != null
    ? computeTarabala(options.janmaNakshatra, nakshatraOf(siderealMoon), lang)
    : null;
  const gandaMula = computeGandaMula(nakshatraOf(siderealMoon), lang);
  const anandadiYoga = computeAnandadiYoga(
    vara.index,
    nakshatraOf(siderealMoon),
    lang,
  );

  const panchakaInfo = buildPanchakaInfo(
    date, siderealMoon, getMoon,
    (utc) => varaIndexAtInstant(utc, location, lmtOffsetMinutes, t.varaNames),
    t,
  );

  return {
    timestamp: date,
    location,
    ayanamsa: ayanamsaValue,
    sun: { siderealLongitude: siderealSun, nakshatra: suryaNakshatra },
    moon: { siderealLongitude: siderealMoon, rashi: chandraRashi },
    angas: { tithi, nakshatra, yoga, karana, vara },
    calendar: { chandramasa, samvat },
    inauspicious: { panchaka: computePanchaka(siderealMoon), panchakaInfo, gandaMula },
    specialYogas,
    anandadiYoga,
    festivals,
    chandraBalam,
    tarabala,
  };
}

/**
 * The full Hindu Panchang for one local sunrise → next sunrise day.
 *
 * @param date    Any `Date` in the local calendar day wanted; the time is ignored.
 * @param options `timezone` is required: UTC offset in minutes (330 = IST) or
 *                an IANA zone name.
 * @returns       `null` when the Hindu day cannot be formed: the local calendar day holds
 *                no sunrise (polar night or polar day, including the day each ends, or a
 *                fixed offset far from the location's solar time), or no sunset and next
 *                sunrise follow within two days (the last day before polar night or polar day).
 */
export function getDailyPanchang(
  date: Date,
  location: GeoLocation,
  options: PanchangOptions,
): DailyPanchangResult | null {
  return computeDay(date, location, options, false);
}

/** @internal The part of a day the festival walks and the calendar converters read. */
export interface DayLabels {
  date: Date;
  /** The tithi at sunrise, as `angas.tithis[0]` names and numbers it. */
  tithi: TithiInfo;
  vara: VaraInfo;
  chandramasa: ChandraMasaInfo;
  samvat: SamvatInfo;
  /** `festivals` of the same call, eclipse first. */
  festivals: FestivalInfo[];
}

/**
 * @internal What `getDailyPanchang` puts in the fields {@link DayLabels} names, for the same
 * arguments, with the same `null` and the same errors. It runs the same code and returns once the
 * festival list is complete: everything after that point (the day periods, muhurtas, inauspicious
 * windows, anga spans and local strings) is never built, and none of it feeds a label.
 */
export function getDailyLabels(
  date: Date,
  location: GeoLocation,
  options: PanchangOptions,
): DayLabels | null {
  return computeDay(date, location, options, true);
}

function computeDay(
  date: Date, location: GeoLocation, options: PanchangOptions, labelsOnly: true,
): DayLabels | null;
function computeDay(
  date: Date, location: GeoLocation, options: PanchangOptions, labelsOnly: false,
): DailyPanchangResult | null;
function computeDay(
  date: Date,
  location: GeoLocation,
  options: PanchangOptions,
  labelsOnly: boolean,
): DailyPanchangResult | DayLabels | null {
  validateDate(date);
  validateLocation(location);
  const offsetMinutes = resolveUtcOffset(options.timezone, date);
  const resolvedTimezone: ResolvedTimezone = typeof options.timezone === 'string'
    ? { offsetMinutes, zone: options.timezone }
    : { offsetMinutes };
  const ayanamsaType = options.ayanamsa ?? 'lahiri';
  const lang = options.language ?? 'en';
  const t = getTranslations(lang);
  const doEndTimes = options.computeEndTimes !== false;

  const sections = options.sections;
  const wants = (s: PanchangSection): boolean => sections === undefined || sections.includes(s);
  const wantFestivals = wants('festivals');
  const wantEclipse = wants('eclipse');
  const wantMoonTimes = wants('moonTimes');
  const wantLunarWindows = wants('lunarWindows');
  const needBhadra = wantLunarWindows || wantFestivals;

  const cache = new LongitudeCache(ayanamsaType, 'interpolated');
  const getMoon = (d: Date) => cache.getMoon(d);
  const getSun = (d: Date) => cache.getSun(d);
  const newMoons = new NewMoonCache();
  const getBounds = (ref: Date) => newMoons.bounding(ref);

  const localMidnightUtc = getLocalMidnightUtc(date, offsetMinutes);
  let sunriseUtc: Date;
  let sunsetUtc: Date;
  let nextSunriseUtc: Date;
  try {
    sunriseUtc = computeSunrise(localMidnightUtc, location);
    if (sunriseUtc.getTime() >= localMidnightUtc.getTime() + 86_400_000) return null;
    sunsetUtc = computeSunset(sunriseUtc, location);
    nextSunriseUtc = computeSunrise(sunsetUtc, location);
  } catch (e: unknown) {
    if (e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET')) {
      return null;
    }
    throw e;
  }

  const siderealMoonAtSunrise = getMoon(sunriseUtc);
  const siderealSunAtSunrise = getSun(sunriseUtc);
  const ayanamsaValue = computeAyanamsa(sunriseUtc, ayanamsaType);

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
  const needMoonrise = wantMoonTimes || wantFestivals;
  const moonriseSearchUtc = needMoonrise ? getMoonrise(localMidnightUtc, location) : null;
  const moonriseUtc =
    moonriseSearchUtc !== null &&
    moonriseSearchUtc.getTime() < localMidnightUtc.getTime() + 86_400_000
      ? moonriseSearchUtc
      : null;
  const panchaka = computePanchaka(siderealMoonAtSunrise);

  const bhadraUtc = needBhadra
    ? computeBhadraKaal(
        sunriseUtc, nextSunriseUtc, getMoon, getSun,
        (key) => t.bhadraLocationNames[key],
      )
    : null;

  const gandaMula = computeGandaMula(nakshatraAtSunrise.index, lang);

  const anandadiYoga = computeAnandadiYoga(vara.index, nakshatraAtSunrise.index, lang);

  const festivals: FestivalInfo[] = wantFestivals
    ? computeDayFestivals({
        sunriseUtc, sunsetUtc, nextSunriseUtc, location,
        offsetMinutes,
        tithiIndexAtSunrise: tithiAtSunrise.index,
        siderealMoonAtSunrise, siderealSunAtSunrise,
        varaIndex: vara.index,
        chandramasa,
        nextDayMasa: () => {
          const next = computeChandraMasa(
            getSun(nextSunriseUtc), getMoon(nextSunriseUtc),
            (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
            masaSystem,
            nextSunriseUtc, getSun, getBounds,
          );
          return { index: next.amantaIndex, isAdhika: next.isAdhika };
        },
        lang, t,
        region: options.region,
        moonriseUtc: moonriseSearchUtc, bhadraUtc,
        getMoon, getSun,
      })
    : [];

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
  /** Before the labels exit, so both paths reject a stray bad `janmaRashi` alike. */
  const chandraBalam = options.janmaRashi != null
    ? computeChandraBalam(options.janmaRashi, chandraRashi.index, lang)
    : null;
  const tarabala = options.janmaNakshatra != null
    ? computeTarabala(
        options.janmaNakshatra,
        nakshatraOf(siderealMoonAtSunrise),
        lang,
      )
    : null;
  if (labelsOnly) {
    return { date, tithi: tithiAtSunrise, vara, chandramasa, samvat, festivals };
  }

  const brahmaMuhurta = brahmaMuhurtaForNight(
    sunriseUtc, nextSunriseUtc.getTime() - sunsetUtc.getTime(),
  );
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
  const moonsetSearchUtc = wantMoonTimes
    ? getMoonset(moonriseUtc ?? localMidnightUtc, location)
    : null;
  const moonsetUtc =
    moonsetSearchUtc !== null &&
    (moonriseUtc !== null || moonsetSearchUtc.getTime() < localMidnightUtc.getTime() + 86_400_000)
      ? moonsetSearchUtc
      : null;
  const panchakaInfo = buildPanchakaInfo(
    sunriseUtc, siderealMoonAtSunrise, getMoon,
    (utc) => varaIndexAtInstant(utc, location, offsetMinutes, t.varaNames),
    t,
  );
  const panchakaRahitaUtc = wantLunarWindows
    ? computePanchakaRahita(sunriseUtc, nextSunriseUtc, getMoon)
    : [];
  const doGhatiMuhurta = computeDoGhati(
    sunriseUtc, sunsetUtc, nextSunriseUtc,
    (idx) => t.doGhatiNames[idx]!,
    qualityNameFn,
  );

  const durMuhurtaUtc = computeDurMuhurta(sunriseUtc, sunsetUtc, nextSunriseUtc, vara.index);

  const varjyamUtc = wantLunarWindows
    ? computeVarjyamWindows(sunriseUtc, nextSunriseUtc, getMoon)
    : [];

  const searchTithis = (): DailyTithiInfo[] => findDailyElements(
    sunriseUtc, nextSunriseUtc, tithiAtSunrise,
    (d) => getTithiIndexAtTime(d, getMoon, getSun),
    (d) => {
      const moon = getMoon(d), sun = getSun(d);
      const idx = getTithiIndexFromLons(moon, sun);
      return computeTithiFromLongitudes(moon, sun, resolveTithiName(idx, lang), resolvePakshaName(idx, lang));
    },
    36, STANDARD_PRECISION, 3, TITHI_ANGLE(getMoon, getSun),
  ) as DailyTithiInfo[];
  const searchNakshatras = (): DailyNakshatraInfo[] => findDailyElements(
    sunriseUtc, nextSunriseUtc, nakshatraAtSunrise,
    (d) => getNakshatraIndexAtTime(d, getMoon),
    (d) => {
      const moon = getMoon(d);
      return computeNakshatraFromLongitude(moon, resolveNakshatraName(nakshatraOf(moon), lang));
    },
    36, STANDARD_PRECISION, 3, NAKSHATRA_ANGLE(getMoon),
  ) as DailyNakshatraInfo[];

  let tithis: DailyTithiInfo[];
  let nakshatras: DailyNakshatraInfo[];
  let yogas: DailyYogaInfo[];
  let karanas: DailyKaranaInfo[];
  let yogaTithis: DailyTithiInfo[];
  let yogaNakshatras: DailyNakshatraInfo[];

  if (doEndTimes) {
    tithis = searchTithis();
    nakshatras = searchNakshatras();
    yogas = findDailyElements(
      sunriseUtc, nextSunriseUtc, yogaAtSunrise,
      (d) => getYogaIndexAtTime(d, getMoon, getSun),
      (d) => {
        const moon = getMoon(d), sun = getSun(d);
        return computeYogaFromLongitudes(moon, sun, resolveYogaName(getYogaIndex(moon, sun), lang));
      },
      36, STANDARD_PRECISION, 3, YOGA_ANGLE(getMoon, getSun),
    ) as DailyYogaInfo[];
    karanas = findDailyElements(
      sunriseUtc, nextSunriseUtc, karanaAtSunrise,
      (d) => getKaranaIndexAtTime(d, getMoon, getSun),
      (d) => {
        const moon = getMoon(d), sun = getSun(d);
        return computeKaranaFromLongitudes(moon, sun, resolveKaranaName(getKaranaIndex(moon, sun), lang));
      },
      18, STANDARD_PRECISION, 5, KARANA_ANGLE(getMoon, getSun),
    ) as DailyKaranaInfo[];
    yogaTithis = tithis;
    yogaNakshatras = nakshatras;
  } else {
    const bare = { startTime: null, isActiveAtSunrise: true, startTimeLocal: null, endTimeLocal: null };
    tithis = [{ ...tithiAtSunrise, ...bare }];
    nakshatras = [{ ...nakshatraAtSunrise, ...bare }];
    yogas = [{ ...yogaAtSunrise, ...bare }];
    karanas = [{ ...karanaAtSunrise, ...bare }];
    yogaTithis = searchTithis();
    yogaNakshatras = searchNakshatras();
  }

  const specialYogas = computeSpecialYogasOverDay(
    vara.index, yogaTithis, yogaNakshatras, suryaNakshatra.index,
    (type) => (t.specialYogaNames as Record<string, string>)[type] ?? type,
  );

  const rahuKalam = computeRahuKalam(sunriseUtc, sunsetUtc, vara.index);
  const gulikaKalam = computeGulikaKalam(sunriseUtc, sunsetUtc, vara.index);
  const yamaganda = computeYamaganda(sunriseUtc, sunsetUtc, vara.index);
  const abhijitMuhurta = computeAbhijitMuhurta(sunriseUtc, sunsetUtc, vara.index);
  const vijayaMuhurtaUtc = computeVijayaMuhurta(sunriseUtc, sunsetUtc);
  const godhuliMuhurtaUtc = computeGodhuliMuhurta(sunsetUtc);
  const nishitaMuhurtaUtc = computeNishitaMuhurta(sunsetUtc, nextSunriseUtc);
  const amritKalaUtc = computeAmritKalaWindows(sunriseUtc, nextSunriseUtc, getMoon);
  const madhyahnaWindowUtc = computeMadhyahna(sunriseUtc, sunsetUtc);
  const pratahSandhyaUtc = computePratahSandhya(sunriseUtc, sunsetUtc, nextSunriseUtc);
  const sayahnaSandhyaUtc = computeSayahnaSandhya(sunsetUtc, nextSunriseUtc);

  /** Adjacent windows share their boundaries, so most instants render twice; `formatInZone`
   * is a pure function of the millisecond here, so the memo cannot change a string. */
  const rendered = new Map<number, string>();
  const local = (d: Date): string => {
    const ms = d.getTime();
    let text = rendered.get(ms);
    if (text === undefined) {
      text = formatInZone(d, offsetMinutes);
      rendered.set(ms, text);
    }
    return text;
  };
  const localOrNull = (d: Date | null) => (d ? local(d) : null);
  const withLocal = (tp: UtcWindow): TimePeriod => ({
    start: tp.start,
    end: tp.end,
    startLocal: local(tp.start),
    endLocal: local(tp.end),
  });
  /** The keys, order and values of `{ ...s, ...withLocal(s) }`, without the second object. */
  const localizeSlots = <T extends TimePeriod>(
    slots: readonly Unlocalized<T>[],
  ): T[] => slots.map(s => ({ ...s, startLocal: local(s.start), endLocal: local(s.end) }) as T);

  const dayDurationMs = sunsetUtc.getTime() - sunriseUtc.getTime();
  const nightDurationMs = nextSunriseUtc.getTime() - sunsetUtc.getTime();

  for (const t of tithis) t.startTimeLocal = localOrNull(t.startTime);
  for (const n of nakshatras) n.startTimeLocal = localOrNull(n.startTime);
  for (const y of yogas) y.startTimeLocal = localOrNull(y.startTime);
  for (const k of karanas) k.startTimeLocal = localOrNull(k.startTime);
  for (const e of [...tithis, ...nakshatras, ...yogas, ...karanas]) {
    e.endTimeLocal = localOrNull(e.endTime);
  }

  const dayMinutes = Math.round(dayDurationMs / 60_000);
  const nightMinutes = Math.round(nightDurationMs / 60_000);

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
      amritKala: amritKalaUtc.map(withLocal),
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
      durMuhurta: durMuhurtaUtc.map((w) => ({ ...withLocal(w), segment: w.segment })),
      varjyam: varjyamUtc.map(withLocal),
      bhadra: bhadraUtc
        ? {
            start: bhadraUtc.start,
            end: bhadraUtc.end,
            startLocal: local(bhadraUtc.start),
            endLocal: local(bhadraUtc.end),
            location: bhadraUtc.location,
            locationName: bhadraUtc.locationName,
            vasa: bhadraUtc.vasa.map((s) => ({
              ...s,
              startLocal: local(s.start),
              endLocal: local(s.end),
            })),
            isActive: bhadraUtc.isActive,
          }
        : null,
      gandaMula,
      panchaka,
      panchakaInfo,
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
