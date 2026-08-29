/**
 * Writes each golden under the mirrored Go package's `testdata/`:
 *
 *   bash source/go/parity/goldens.sh
 *
 * Rerunning must be a no-op: a changed golden is a review event, never a re-pin.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { sin, cos } from '../../ts/src/astronomy/trig';
import {
  moonElpLongitude, moonElpLatitude, moonElpLatitudeCoarse,
  moonElpDistance, moonElpDistanceTrack, moonElpDistanceCoarse,
} from '../../ts/src/astronomy/elp';
import {
  evaluateVsop, millennia, heliocentricLongitude, heliocentricLatitude,
  heliocentricRadius, earthRadiusCoarse, heliocentricRect, earthRect,
  type VsopBody,
} from '../../ts/src/astronomy/vsop87';
import {
  deltaTSeconds, deltaTSecondsForYear, ttDaysSinceJ2000, terrestrialTimeJd,
  julianCenturiesTt,
} from '../../ts/src/astronomy/deltaT';
import {
  meanObliquityArcsec, nutation, elpToEclipticOfDate,
} from '../../ts/src/astronomy/frame';
import { getTropicalSunLongitude, getSunPosition, getSiderealSunLongitude } from '../../ts/src/astronomy/sun';
import {
  getTropicalMoonLongitude, getMoonPosition, getMoonPositionForTrack,
  getSiderealMoonLongitude,
} from '../../ts/src/astronomy/moon';
import { getPlanetPosition, getTropicalPlanetLongitude, type PlanetBody } from '../../ts/src/astronomy/planet';
import { computeAyanamsa, dateToJulianDay } from '../../ts/src/astronomy/ayanamsa';
import {
  gastDegrees, observerVector, eclipticToEquatorial, altitudeDegrees,
  greenwichApparentSiderealDegrees, refractionDegrees,
} from '../../ts/src/astronomy/topocentric';
import { bodyAltitudeDegrees, isSunAboveHorizon } from '../../ts/src/astronomy/horizon';
import { LongitudeCache, type LongitudeCacheMode } from '../../ts/src/astronomy/cache';
import { dayEvents, clearRiseSetTracks, type RiseSetBody } from '../../ts/src/astronomy/riseSet';
import { resolveEvent, canonicalDayEvents, type RiseSetKind } from '../../ts/src/astronomy/riseSetCache';
import { computeSunrise, computeSunset } from '../../ts/src/astronomy/sunrise';
import { getMoonrise, getMoonset } from '../../ts/src/astronomy/moonrise';
import { moonSunElongation, searchMoonPhase, searchMoonQuarter, nextMoonQuarter } from '../../ts/src/astronomy/lunation';
import { boundingNewMoons, NewMoonCache } from '../../ts/src/astronomy/newMoon';
import { computeMoonPhasesInRange, computeMoonPhasesForYear } from '../../ts/src/astronomy/moonPhase';
import {
  resolveUtcOffset, getLocalMidnightUtc, utcToLocalDisplay, formatInZone,
} from '../../ts/src/utils/timezone';
import {
  findLunarEclipse, findLocalSolarEclipse, lunarShadowAt, solarViewAt, discObscuration,
} from '../../ts/src/astronomy/eclipseGeometry';
import {
  getUpcomingLunarEclipse, getUpcomingSolarEclipse, getEclipseDuringDay,
  isBodyAboveHorizon, isEclipseVisibleAnyPhase,
} from '../../ts/src/astronomy/eclipse';
import {
  findTransitionTime, findStartTime, solveElementBoundary, solveAngleCrossing,
  findDailyElements, STANDARD_PRECISION, type ElementAngle,
} from '../../ts/src/utils/search';
import { buildEqualSlots, VARA_CHALDEAN_START } from '../../ts/src/utils/slots';
import {
  TITHI_SPAN, NAKSHATRA_SPAN, NAKSHATRA_PADA_SPAN, YOGA_SPAN, KARANA_SPAN, RASHI_SPAN,
  nakshatraOf, rashiOf, ANANDADI_TABLE, ANANDADI_QUALITY, VARJYAM_OFFSET_GHATIKAS,
  RAHU_KALAM_SLOTS, YAMAGANDA_SLOTS, GULIKA_SLOTS,
} from '../../ts/src/utils/constants';
import { ttDaysSinceJ2000 as ttDays } from '../../ts/src/astronomy/deltaT';
import type { AyanamsaType } from '../../ts/src/types/options';
import { computeTithiFromLongitudes, getTithiIndexFromLons } from '../../ts/src/core/tithi';
import {
  computeFestivals,
  type FestivalComputeContext, type FestivalDateRule,
} from '../../ts/src/core/festivals';
import { computeNakshatraFromLongitude } from '../../ts/src/core/nakshatra';
import { computeYogaFromLongitudes, getYogaIndex } from '../../ts/src/core/yoga';
import { computeKaranaFromLongitudes, getKaranaIndex, getKaranaType } from '../../ts/src/core/karana';
import {
  resolvePakshaName, resolveTithiName, resolveNakshatraName, resolveYogaName,
  resolveKaranaName, resolveMasaName, resolveChandraMasaName,
} from '../../ts/src/i18n/resolver';
import type { Language } from '../../ts/src/types/options';
import { normalize360 } from '../../ts/src/utils/angle';
import { computeVara } from '../../ts/src/core/vara';
import { computeChoghadiya } from '../../ts/src/core/choghadiya';
import { computeHora } from '../../ts/src/core/hora';
import { computeGowriPanchangam } from '../../ts/src/core/gowri';
import { computeDoGhati } from '../../ts/src/core/doGhati';
import { getDailyPanchang, getInstantPanchang } from '../../ts/src/core/panchang';
import {
  computeEkadashiDatesForYear, computeSankrantisForYear, getUpcomingEclipses,
  computeFestivalsForYear, computeEclipsesForYear,
} from '../../ts/src/calendar/yearly';
import {
  convertGregorianToHindu, convertHinduToGregorian, getKaliYugaYear, getHinduNewYear,
} from '../../ts/src/calendar/convert';
import {
  scoreMuhurta, computeAuspiciousDatesInRange, computeAuspiciousDatesForYear,
  type MuhurtaRule, type MuhurtaScore,
} from '../../ts/src/muhurta/engine';
import { computeVaraTithiYogas } from '../../ts/src/muhurta/varaTithiYogas';
import { STOCK_MUHURTA_RULES } from '../../ts/src/muhurta/rules';
import { buildMuhurtaTable } from '../../ts/src/muhurta/buildMuhurtaTable';
import { buildFestivalsTable } from '../../ts/src/calendar/buildFestivalsTable';
import { buildEclipsesTable } from '../../ts/src/calendar/buildEclipsesTable';
import { buildMoonPhasesTable } from '../../ts/src/calendar/buildMoonPhasesTable';
import {
  readFestivalsForYear, readFestivalsForDate, readFestivalsYearRange,
} from '../../ts/src/calendar/festivalsTable';
import {
  readEclipsesForYear, readEclipsesForDate, readEclipsesYearRange,
} from '../../ts/src/calendar/eclipsesTable';
import {
  readMoonPhasesForYear, readMoonPhasesForDate, readMoonPhasesYearRange,
} from '../../ts/src/calendar/moonPhasesTable';
import type {
  AnyFestivalsFile, FestivalsFileV1, FestivalsTableLanguage,
} from '../../ts/src/calendar/festivalsTableTypes';
import type { AnyMoonPhasesFile, MoonPhasesFileV1 } from '../../ts/src/calendar/moonPhasesTableTypes';
import {
  readMuhurtaForYear, readMuhurtaForDate, readBestMuhurtaDays,
  readMuhurtaYearRange, readMuhurtaOccasion,
} from '../../ts/src/muhurta/muhurtaTable';
import type { FestivalRegion, LegacyFestivalRegion } from '../../ts/src/types/options';
import { computeChandraBalam } from '../../ts/src/jyotish/chandraBalam';
import { computeTarabala } from '../../ts/src/jyotish/tarabala';
import { computeDignity, type Dignity } from '../../ts/src/jyotish/dignity';
import { computeAspects } from '../../ts/src/jyotish/aspects';
import { GRAHA_ABBR, meanObliquity, computePlanetaryPositions } from '../../ts/src/jyotish/planets';
import {
  computeLagna, computeHoraLagna, computeGhatiLagna, computeBhavaLagna,
  computeSripatiLagna, findSunriseBefore, _findSunriseBeforeForTest,
} from '../../ts/src/jyotish/lagna';
import { computeNatalBasis, grahaList } from '../../ts/src/jyotish/natalBasis';
import { computeBhava } from '../../ts/src/jyotish/bhava';
import {
  computeRashiChart, computeNavamsa, indexPlanets, _navamsaLongitudeForTest,
} from '../../ts/src/jyotish/charts';
import {
  computeDivisionalChart,
  _horaLongitudeForTest, _drekkanaLongitudeForTest, _saptamsaLongitudeForTest,
  _dasamsaLongitudeForTest, _dwadasamsaLongitudeForTest, _trimsamsaLongitudeForTest,
} from '../../ts/src/jyotish/divisionals';
import type { Divisional, DivisionalChart } from '../../ts/src/types/jyotish';
import {
  computeAshtakavarga, _bhinnashtakaForTest,
  _applyTrikonaSodhanaForTest, _applyEkadhipatyaSodhanaForTest,
} from '../../ts/src/jyotish/ashtakavarga';
import {
  ASHTAKAVARGA_CONTRIBUTORS, ASHTAKAVARGA_RECEIVERS, BENEFIC_OFFSETS,
  BHINNASHTAKA_TOTAL, SARVASHTAKA_TOTAL, EKADHIPATYA_PAIRS, TRIKONA_TRIADS,
  type AshtakavargaContributor,
} from '../../ts/src/jyotish/ashtakavargaTables';
import { computeJaiminiKarakas } from '../../ts/src/jyotish/karakas';
import { computeArgala } from '../../ts/src/jyotish/argala';
import { computeArudhas } from '../../ts/src/jyotish/arudha';
import {
  computeMangalDosha, computeMangalCompatibility, computeKaalSarp, computePitruDosha,
} from '../../ts/src/jyotish/doshas';
import { computeAshtakoot, type NatalMoon as MatchNatalMoon } from '../../ts/src/jyotish/matching';
import { computePathuPorutham } from '../../ts/src/jyotish/pathuPorutham';
import {
  computeShadbala, computeBhavaBala,
  _BHAVA_DIK_VALUES_FOR_TEST, _ojhaYugmaBalaForTest,
} from '../../ts/src/jyotish/shadbala';
import {
  computeVimshottariDasha, computeVimshottariDashaFromBirth, computeVimshottariPratyantar,
  computeAshtottariDasha, computeYoginiDasha, computeCharaDasha, computeNarayanDasha,
  DASHA_YEARS, DASHA_ORDER, NAKSHATRA_LORD,
  ASHTOTTARI_ORDER, ASHTOTTARI_YEARS, ASHTOTTARI_NAKSHATRA_GROUPS,
  YOGINI_ORDER, YOGINI_YEARS, YOGINI_PLANET,
  CHARA_RASHI_YEARS, VISHAMA_PADA_RASHIS, SAMA_PADA_RASHIS,
} from '../../ts/src/jyotish/dasha';
import {
  computeUpagrahas, _locateGulikaSegmentForTest,
} from '../../ts/src/jyotish/upagrahas';
import {
  computeVarshaphala, findSolarReturn,
  _triraashiPatiForTest, _evaluateSahamForTest,
} from '../../ts/src/jyotish/varshaphala';
import { SAHAM_FORMULAS, ALL_SAHAM_NAMES, type SahamName } from '../../ts/src/jyotish/sahamsTables';
import {
  computeKpSubLord, computeKpCuspalSubLords, computeKpSignificators,
  _SUB_CUMULATIVE_WIDTHS_FOR_TEST,
} from '../../ts/src/jyotish/kpSubLord';
import {
  computeTithiPravesha, _computeNatalTithiIndexForTest,
} from '../../ts/src/jyotish/tithiPravesha';
import { computePrashnaChart } from '../../ts/src/jyotish/prashna';
import { computeSadeSati } from '../../ts/src/jyotish/sadeSati';
import { computeYogas } from '../../ts/src/jyotish/yogas';
import { YOGA_CATALOG } from '../../ts/src/jyotish/yogasCatalog';
import type { YogaType } from '../../ts/src/types/jyotish';
import {
  NAKSHATRA_RAJJU, VEDHA_PAIRS, vedhaOf,
  MAHENDRA_AUSPICIOUS_DISTANCES, DINA_AUSPICIOUS_REMAINDERS, RASHI_DOSHIC_DISTANCES,
} from '../../ts/src/jyotish/pathuPoruthamTables';
import type { HouseSystem } from '../../ts/src/types/options';
import {
  VARNA_RANK, RASHI_VARNA, RASHI_VASHYA, VASHYA_SCORE, vashyaIndex,
  NAKSHATRA_YONI, yoniIndex, YONI_SCORE, RASHI_LORD, NAISARGIKA_MAITRI,
  GRAHA_MAITRI_SCORE, maitriIdx, NAKSHATRA_GANA, ganaIdx, GANA_SCORE,
  NAKSHATRA_NADI, INAUSPICIOUS_TARA_REMAINDERS, BHAKOOT_DOSHIC_DISTANCES,
  type Varna, type Vashya, type YoniAnimal, type Gana, type Nadi,
} from '../../ts/src/jyotish/matchingTables';
import type { BirthChart, GrahaName, PlanetPlacement } from '../../ts/src/types/jyotish';
import type { ChoghadiyaQuality } from '../../ts/src/types/elements';
import {
  computeRahuKalam, computeGulikaKalam, computeYamaganda,
} from '../../ts/src/core/inauspicious';
import { computeDurMuhurta } from '../../ts/src/core/durMuhurta';
import { computeGandaMula } from '../../ts/src/core/gandaMula';
import { computeAnandadiYoga } from '../../ts/src/core/anandadiYoga';
import {
  computePanchaka, classifyPanchaka, isPanchakaDosha, findPanchakaOnset,
} from '../../ts/src/core/panchaka';
import { computePanchakaRahita } from '../../ts/src/core/panchakaRahita';
import { computeBhadraKaal, isVishtiKarana, bhadraVasaForRashi } from '../../ts/src/core/bhadra';
import { PanchangError } from '../../ts/src/types/errors';
import { computeVarjyam, computeVarjyamWindows } from '../../ts/src/core/varjyam';
import { getNakshatraIndexAtTime } from '../../ts/src/core/nakshatra';
import { computeSpecialYogas } from '../../ts/src/core/specialYogas';
import {
  computeAbhijitMuhurta, computeBrahmaMuhurta, computeVijayaMuhurta,
  computeGodhuliMuhurta, computeNishitaMuhurta, computeAmritKalaWindows,
  computeMadhyahna, computePratahSandhya, computeSayahnaSandhya,
  AMRIT_KALA_OFFSET_GHATIKAS,
} from '../../ts/src/core/muhurta';
import { computeChandraRashi, computeSuryaNakshatra } from '../../ts/src/core/rashi';
import { computeMasa } from '../../ts/src/core/masa';
import { computeChandraMasa } from '../../ts/src/core/chandramasa';
import { computeSamvat, chaitraNewMoon } from '../../ts/src/core/samvat';
import { getTranslations } from '../../ts/src/i18n/resolver';
import type { MasaSystem } from '../../ts/src/types/options';

const REPO = process.env['PARITY_REPO'] ?? process.cwd();

/** Numerical Recipes' `ranqd1`, the generator the TS trig sweep uses. */
function* uniform(seed: number, count: number, range: number): Generator<number> {
  let s = seed >>> 0;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield ((s / 4294967296) * 2 - 1) * range;
  }
}

const RANGES = [
  { name: 'pi', range: Math.PI, samples: 2_000_000 },
  { name: '1e2', range: 100, samples: 2_000_000 },
  { name: '5e3', range: 5000, samples: 2_000_000 },
  { name: '1e5', range: 100_000, samples: 2_000_000 },
  { name: '1e6', range: 1_000_000, samples: 2_000_000 },
] as const;

function sweepDigest(seed: number, samples: number, range: number): string {
  const h = createHash('sha256');
  const BLOCK = 65536;
  const buf = Buffer.allocUnsafe(BLOCK * 8);
  let n = 0;
  const push = (v: number): void => {
    buf.writeDoubleLE(v, n * 8);
    if (++n === BLOCK) { h.update(buf); n = 0; }
  };
  for (const x of uniform(seed, samples, range)) {
    push(sin(x));
    push(cos(x));
  }
  if (n > 0) h.update(buf.subarray(0, n * 8));
  return h.digest('hex');
}

function cases(): { x: number; sin: number; cos: number }[] {
  const out: { x: number; sin: number; cos: number }[] = [];
  const push = (x: number): void => { out.push({ x, sin: sin(x), cos: cos(x) }); };
  for (const { range, samples } of RANGES) {
    let i = 0;
    for (const x of uniform(0x5eed + range, samples, range)) {
      if (i % 50_000 === 0) push(x);
      i++;
    }
  }
  for (const x of [
    0, 1, -1, 1e5, -1e5, 99999.5, 12345.6789,
    Math.PI / 2, -Math.PI / 2, Math.PI, -Math.PI, 3 * Math.PI / 2, 2 * Math.PI,
    1.5707963267948966, 4.71238898038469, 6.283185307179586,
    5e-324, 2.2250738585072014e-308, -5e-324,
  ]) push(x);
  return out;
}

// Go's gc may contract `a + t*b` into a fused multiply-add (it does on arm64),
// which would make every series accumulation a different arithmetic from the TS.

const EPHEMERIS_SEED = 0x31415926;
const T_MAX_CENTURIES = 1.5;

/** Julian centuries TT from J2000, |t| <= 1.5 (1850 to 2150). */
function elpEpochs(count: number): Generator<number> {
  return uniform(EPHEMERIS_SEED, count, T_MAX_CENTURIES);
}
const EPHEMERIS_SAMPLES = 200_000;
/** `uniform` is an LCG, so the short digest's epochs are a prefix of the long one's. */
const EPHEMERIS_SAMPLES_SHORT = 5_000;
const VSOP_BODIES: readonly VsopBody[] = ['earth', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];

function ephemerisDigest(fn: (t: number) => number, count: number): string {
  const h = createHash('sha256');
  const BLOCK = 65536;
  const buf = Buffer.allocUnsafe(BLOCK * 8);
  let n = 0;
  for (const t of elpEpochs(count)) {
    buf.writeDoubleLE(fn(t), n * 8);
    if (++n === BLOCK) { h.update(buf); n = 0; }
  }
  if (n > 0) h.update(buf.subarray(0, n * 8));
  return h.digest('hex');
}

function ephemerisAccessors(): Record<string, (t: number) => number> {
  const out: Record<string, (t: number) => number> = {
    moonElpLongitude,
    moonElpLatitude,
    moonElpLatitudeCoarse,
    moonElpDistance,
    moonElpDistanceTrack,
    moonElpDistanceCoarse,
    millennia: (t) => millennia(t * 36525),
    earthRadiusCoarse: (t) => earthRadiusCoarse(t * 36525),
  };
  for (const body of VSOP_BODIES) {
    out[`heliocentricLongitude:${body}`] = (t) => heliocentricLongitude(body, t * 36525);
    out[`heliocentricLatitude:${body}`] = (t) => heliocentricLatitude(body, t * 36525);
    out[`heliocentricRadius:${body}`] = (t) => heliocentricRadius(body, t * 36525);
    for (const axis of [0, 1, 2] as const) {
      out[`heliocentricRect:${body}:${axis}`] = (t) => {
        const v = new Float64Array(3);
        heliocentricRect(body, t * 36525, v);
        return v[axis] as number;
      };
    }
  }
  for (const axis of [0, 1, 2] as const) {
    out[`earthRect:${axis}`] = (t) => {
      const v = new Float64Array(3);
      earthRect(t * 36525, v);
      return v[axis] as number;
    };
  }
  out['meanObliquityArcsec'] = meanObliquityArcsec;
  out['nutationDpsi'] = (t) => nutation(t).dpsi;
  out['nutationDeps'] = (t) => nutation(t).deps;
  for (const axis of [0, 1, 2] as const) {
    out[`elpToEclipticOfDate:${axis}`] = (t) => {
      const v = new Float64Array(3);
      elpToEclipticOfDate(
        moonElpLongitude(t), moonElpLatitudeCoarse(t), moonElpDistanceCoarse(t), t, v,
      );
      return v[axis] as number;
    };
  }

  const synthetic = new Float64Array([
    2.5, 0.25, 1.5, 0, -1.25, 1.1, -0.7, 1, 0.5, 2.2, 3.3, 2,
    -0.125, 0.9, -1.9, 3, 0.0625, 1.4, 0.6, 4, -0.03125, 2.1, -0.2, 5,
  ]);
  out['evaluateVsop:synthetic'] = (t) => evaluateVsop(synthetic, t / 10);
  return out;
}

/**
 * `heliocentricRect` and `earthRect` end in `Math.cos` / `Math.sin`, which
 * differ from V8's in the last ULPs, so they get a measured bound.
 */
function ephemerisCases(accessors: Record<string, (t: number) => number>): Record<string, number[]> {
  const ts = [
    -1.5, -1.25, -1, -0.5, -0.25, -1e-9, 0, 1e-9, 0.25, 0.37, 0.5, 1, 1.25, 1.5,
    0.2601, -0.7399, 1.0001,
  ];
  for (const t of elpEpochs(200)) ts.push(t);
  const out: Record<string, number[]> = { _t: ts };
  for (const [name, fn] of Object.entries(accessors)) out[name] = ts.map(fn);
  return out;
}

const DELTAT_SEED = 0xDE17A0 >>> 0;
const DELTAT_SAMPLES = 200_000;
const DELTAT_SAMPLES_SHORT = 5_000;
const DELTAT_YEAR_LO = -1000, DELTAT_YEAR_HI = 3000;
const DELTAT_MS_LO = Date.UTC(1700, 0, 1), DELTAT_MS_HI = Date.UTC(2300, 0, 1);

function* unit01(seed: number, count: number): Generator<number> {
  let s = seed >>> 0;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield s / 4294967296;
  }
}

function deltaTYears(count: number): number[] {
  const out: number[] = [];
  for (const u of unit01(DELTAT_SEED, count)) {
    out.push(DELTAT_YEAR_LO + u * (DELTAT_YEAR_HI - DELTAT_YEAR_LO));
  }
  return out;
}

function deltaTInstants(count: number): number[] {
  const out: number[] = [];
  for (const u of unit01(DELTAT_SEED ^ 0x5f5f5f5f, count)) {
    out.push(Math.floor(DELTAT_MS_LO + u * (DELTAT_MS_HI - DELTAT_MS_LO)));
  }
  return out;
}

function digestOver(values: number[], fn: (v: number) => number): string {
  const h = createHash('sha256');
  const BLOCK = 65536;
  const buf = Buffer.allocUnsafe(BLOCK * 8);
  let n = 0;
  for (const v of values) {
    buf.writeDoubleLE(fn(v), n * 8);
    if (++n === BLOCK) { h.update(buf); n = 0; }
  }
  if (n > 0) h.update(buf.subarray(0, n * 8));
  return h.digest('hex');
}

const DELTAT_BOUNDARY_YEARS = [-500, 500, 1600, 1700, 1800, 1860, 1900, 1920, 1941,
  1961, 1986, 2005, 2050, 2150];

function deltaTCaseYears(): number[] {
  const out: number[] = [];
  for (const y of DELTAT_BOUNDARY_YEARS) out.push(y - 1e-6, y, y + 1e-6);
  out.push(-1000, 0, 1000, 1900, 1950, 2000, 2025, 2100, 3000);
  return out;
}

function deltaTCaseInstants(): number[] {
  const out: number[] = [
    Date.UTC(1971, 11, 31), Date.UTC(1972, 0, 1), Date.UTC(1972, 0, 1) - 1,
    Date.UTC(2027, 0, 1) - 1000, Date.UTC(2027, 0, 1), Date.UTC(2027, 0, 1) + 1000,
    Date.UTC(2000, 0, 1, 12), 0, -1, 1,
  ];
  for (const [y, m, d] of [[1972, 6, 1], [1980, 0, 1], [1999, 0, 1], [2006, 0, 1],
    [2017, 0, 1], [2015, 6, 1], [2026, 5, 1]] as const) {
    out.push(Date.UTC(y, m, d) - 1, Date.UTC(y, m, d), Date.UTC(y, m, d) + 1);
  }
  return out;
}

function writeDeltaTGolden(): void {
  const years = deltaTYears(DELTAT_SAMPLES);
  const instants = deltaTInstants(DELTAT_SAMPLES);
  const caseYears = deltaTCaseYears();
  const caseInstants = deltaTCaseInstants();

  const asDate = (fn: (d: Date) => number) => (ms: number) => fn(new Date(ms));

  const measuredLo = Date.UTC(1972, 0, 1), measuredHi = Date.UTC(2027, 0, 1);
  const measuredInstants: number[] = [];
  for (const u of unit01(DELTAT_SEED ^ 0x1234abcd, DELTAT_SAMPLES)) {
    measuredInstants.push(Math.floor(measuredLo + u * (measuredHi - measuredLo)));
  }

  // A bound, not an equality: Go's `math.Pow` disagrees with V8's fdlibm-derived
  // one on `t**3` for about a quarter of arguments. `x**2` is exempt, both
  // lowering it to `x*x`.
  const BOUND_SAMPLES = 2_000;
  const boundYears = years.slice(0, BOUND_SAMPLES);
  const boundInstants = instants.slice(0, BOUND_SAMPLES);

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/astronomy/deltaT.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Go ΔT is bit-identical to the TypeScript wherever the arithmetic can be ' +
        'reproduced (the whole measured era, and every branch that uses only ' +
        'squares), and within a measured bound where `x ** n` for n >= 3 makes ' +
        'that impossible. A ΔT error is a published-instant error one-for-one, so ' +
        'this is the tightest margin in the astronomy layer.',
      yearSpan: [DELTAT_YEAR_LO, DELTAT_YEAR_HI],
      instantSpan: [new Date(DELTAT_MS_LO).toISOString(), new Date(DELTAT_MS_HI).toISOString()],
      measuredEra: [new Date(measuredLo).toISOString(), new Date(measuredHi).toISOString()],
    },
    seed: DELTAT_SEED,
    samples: DELTAT_SAMPLES,
    samplesShort: DELTAT_SAMPLES_SHORT,
    instantSeedXor: 0x5f5f5f5f,
    measuredSeedXor: 0x1234abcd,
    yearLo: DELTAT_YEAR_LO,
    yearHi: DELTAT_YEAR_HI,
    msLo: DELTAT_MS_LO,
    msHi: DELTAT_MS_HI,
    measuredMsLo: measuredLo,
    measuredMsHi: measuredHi,
    digests: {
      deltaTSeconds: digestOver(measuredInstants, asDate(deltaTSeconds)),
      ttDaysSinceJ2000: digestOver(measuredInstants, asDate(ttDaysSinceJ2000)),
      terrestrialTimeJd: digestOver(measuredInstants, asDate(terrestrialTimeJd)),
      julianCenturiesTt: digestOver(measuredInstants, asDate(julianCenturiesTt)),
    },
    digestsShort: {
      deltaTSeconds: digestOver(measuredInstants.slice(0, DELTAT_SAMPLES_SHORT), asDate(deltaTSeconds)),
      ttDaysSinceJ2000: digestOver(measuredInstants.slice(0, DELTAT_SAMPLES_SHORT), asDate(ttDaysSinceJ2000)),
      terrestrialTimeJd: digestOver(measuredInstants.slice(0, DELTAT_SAMPLES_SHORT), asDate(terrestrialTimeJd)),
      julianCenturiesTt: digestOver(measuredInstants.slice(0, DELTAT_SAMPLES_SHORT), asDate(julianCenturiesTt)),
    },
    boundYears,
    boundYearValues: boundYears.map(deltaTSecondsForYear),
    boundInstants,
    boundInstantValues: boundInstants.map(asDate(deltaTSeconds)),
    caseYears,
    caseYearValues: caseYears.map(deltaTSecondsForYear),
    caseInstants,
    caseInstantValues: caseInstants.map(asDate(deltaTSeconds)),
    caseTtDays: caseInstants.map(asDate(ttDaysSinceJ2000)),
    caseTtJd: caseInstants.map(asDate(terrestrialTimeJd)),
    caseCenturies: caseInstants.map(asDate(julianCenturiesTt)),
    observedMinusModelAtHandoff:
      deltaTSeconds(new Date(Date.UTC(2027, 0, 1) + 1000)) -
      deltaTSecondsForYear(2000 + ((Date.UTC(2027, 0, 1) + 1000 - Date.UTC(2000, 0, 1, 12)) / 86_400_000 - 14) / 365.24217),
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'astronomy', 'deltat-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote deltat-golden.json (${Object.keys(file.digests).length} equality digests, ${BOUND_SAMPLES} bound samples)\n`,
  );
}

// Anything ending in `Math.atan2` or `Math.asin` inherits the
// platform-transcendental difference; the Go test sorts them by measuring.

const POSITION_SEED = 0x5A7E111E >>> 0;
const POSITION_SAMPLES = 20_000;
const POSITION_SAMPLES_SHORT = 2_000;
const POSITION_MS_LO = Date.UTC(1900, 0, 1), POSITION_MS_HI = Date.UTC(2100, 0, 1);

function positionInstants(count: number): number[] {
  const out: number[] = [];
  for (const u of unit01(POSITION_SEED, count)) {
    out.push(Math.floor(POSITION_MS_LO + u * (POSITION_MS_HI - POSITION_MS_LO)));
  }
  return out;
}

const PLANET_BODIES: readonly PlanetBody[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];
const AYANAMSA_TYPES: readonly AyanamsaType[] =
  ['lahiri', 'raman', 'krishnamurti', 'true-chitra', 'thirukanitham'];

function positionAccessors(): Record<string, (ms: number) => number> {
  const out: Record<string, (ms: number) => number> = {
    getTropicalSunLongitude: (ms) => getTropicalSunLongitude(new Date(ms)),
    getTropicalMoonLongitude: (ms) => getTropicalMoonLongitude(new Date(ms)),
    dateToJulianDay: (ms) => dateToJulianDay(new Date(ms)),
    'getSiderealSunLongitude:lahiri': (ms) => getSiderealSunLongitude(new Date(ms), 'lahiri'),
    'getSiderealMoonLongitude:lahiri': (ms) => getSiderealMoonLongitude(new Date(ms), 'lahiri'),
  };
  for (const field of ['longitude', 'latitude', 'distance'] as const) {
    out[`getSunPosition:${field}`] = (ms) => getSunPosition(new Date(ms))[field];
    out[`getMoonPosition:${field}`] = (ms) => getMoonPosition(new Date(ms))[field];
    out[`getMoonPositionForTrack:${field}`] = (ms) => getMoonPositionForTrack(new Date(ms))[field];
    for (const body of PLANET_BODIES) {
      out[`getPlanetPosition:${body}:${field}`] = (ms) => getPlanetPosition(body, new Date(ms))[field];
    }
  }
  for (const type of AYANAMSA_TYPES) {
    out[`computeAyanamsa:${type}`] = (ms) => computeAyanamsa(new Date(ms), type);
  }

  const LOCS = {
    pune: { latitude: 18.5204, longitude: 73.8567, elevation: 560 },
    polar: { latitude: 78.2232, longitude: 15.6267, elevation: 0 },
  } as const;
  const utDaysOf = (ms: number) => (ms - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  out['gastDegrees'] = (ms) => gastDegrees(ttDays(new Date(ms)), utDaysOf(ms));
  out['greenwichApparentSiderealDegrees'] = (ms) => greenwichApparentSiderealDegrees(new Date(ms));
  for (const [locName, loc] of Object.entries(LOCS)) {
    for (const axis of [0, 1, 2] as const) {
      out[`observerVector:${locName}:${axis}`] = (ms) => {
        const v = new Float64Array(3);
        observerVector(loc.latitude, loc.longitude, loc.elevation,
          gastDegrees(ttDays(new Date(ms)), utDaysOf(ms)), v);
        return v[axis] as number;
      };
    }
    out[`sunAltitudeDegrees:${locName}`] = (ms) => bodyAltitudeDegrees(new Date(ms), loc, 'sun');
    out[`moonAltitudeDegrees:${locName}`] = (ms) => bodyAltitudeDegrees(new Date(ms), loc, 'moon');
    out[`isSunAboveHorizon:${locName}`] = (ms) => (isSunAboveHorizon(new Date(ms), loc) ? 1 : 0);
  }
  for (const axis of [0, 1, 2] as const) {
    out[`eclipticToEquatorial:${axis}`] = (ms) => {
      const d = new Date(ms);
      const p = getMoonPosition(d);
      const v = new Float64Array(3);
      eclipticToEquatorial(p.longitude, p.latitude, p.distance, ttDays(d) / 36525, v);
      return v[axis] as number;
    };
  }
  out['altitudeDegrees:synthetic'] = (ms) => altitudeDegrees(
    new Float64Array([0.3, -0.7, 0.5]), LOCS.pune.latitude, LOCS.pune.longitude,
    gastDegrees(ttDays(new Date(ms)), utDaysOf(ms)),
  );
  return out;
}

function refractionCases(): number[] {
  const out: number[] = [];
  for (let a = -95; a <= 95; a += 0.25) out.push(Number(a.toFixed(4)));
  out.push(-90, -90.0001, -89.9999, -5.11, -5.110001, -5.109999, -1, -1.0001, -0.9999,
    -0.833, 0, 0.0001, 34 / 60, 45, 89.9999, 90, 90.0001);
  return out;
}

function writePositionGolden(): void {
  const accessors = positionAccessors();
  const instants = positionInstants(POSITION_SAMPLES);
  const short = instants.slice(0, POSITION_SAMPLES_SHORT);
  const names = Object.keys(accessors).sort();
  const cases = [
    POSITION_MS_LO, POSITION_MS_HI, Date.UTC(2000, 0, 1, 12), 0,
    Date.UTC(2025, 0, 14), Date.UTC(1912, 5, 1), Date.UTC(2088, 5, 1),
    ...instants.slice(0, 200),
  ];
  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/astronomy/{sun,moon,planet,ayanamsa}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Where the path avoids the platform transcendentals the Go port is ' +
        'bit-identical; where it does not (Math.atan2, Math.asin, Math.cos in the ' +
        'rectangular conversions) it is bounded. The Go test decides which is ' +
        'which by measuring.',
      span: [new Date(POSITION_MS_LO).toISOString(), new Date(POSITION_MS_HI).toISOString()],
    },
    seed: POSITION_SEED,
    samples: POSITION_SAMPLES,
    samplesShort: POSITION_SAMPLES_SHORT,
    msLo: POSITION_MS_LO,
    msHi: POSITION_MS_HI,
    digests: Object.fromEntries(names.map((n) => [n, digestOver(instants, accessors[n]!)])),
    digestsShort: Object.fromEntries(names.map((n) => [n, digestOver(short, accessors[n]!)])),
    caseInstants: cases,
    cases: Object.fromEntries(names.map((n) => [n, cases.map(accessors[n]!)])),
    refractionAltitudes: refractionCases(),
    refractionValues: refractionCases().map(refractionDegrees),
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'astronomy', 'positions-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(`wrote positions-golden.json (${names.length} accessors)\n`);
}


// The block index must agree exactly: Go's integer division truncates toward
// zero where `Math.floor` does not, which puts every 1912 instant one block
// late, ~50 deg of lunar longitude.

const CACHE_SEED = 0xC0FFEE11 >>> 0;
const CACHE_SAMPLES = 20_000;
const CACHE_SAMPLES_SHORT = 2_000;
const CACHE_MS_LO = Date.UTC(1900, 0, 1), CACHE_MS_HI = Date.UTC(2100, 0, 1);

/** Restated from `cache.ts` because they are not exported. */
const MOON_BLOCK_MS = 4 * 86_400_000;
const SUN_BLOCK_MS = 8 * 86_400_000;

function cacheInstants(count: number): number[] {
  const out: number[] = [];
  for (const u of unit01(CACHE_SEED, count)) {
    out.push(Math.floor(CACHE_MS_LO + u * (CACHE_MS_HI - CACHE_MS_LO)));
  }
  return out;
}

function cacheAccessors(): Record<string, (ms: number) => number> {
  const out: Record<string, (ms: number) => number> = {};
  for (const mode of ['exact', 'interpolated'] as LongitudeCacheMode[]) {
    const cache = new LongitudeCache('lahiri', mode);
    out[`longitudeCache:${mode}:moon`] = (ms) => cache.getMoon(new Date(ms));
    out[`longitudeCache:${mode}:sun`] = (ms) => cache.getSun(new Date(ms));
    out[`longitudeCache:${mode}:tropicalMoon`] = (ms) => cache.getTropicalMoon(new Date(ms));
    out[`longitudeCache:${mode}:tropicalSun`] = (ms) => cache.getTropicalSun(new Date(ms));
  }
  return out;
}

function cacheCaseInstants(): number[] {
  const out: number[] = [];
  const boundaries = [
    Date.UTC(2025, 0, 14), Date.UTC(1912, 5, 1), Date.UTC(2088, 5, 1),
    Date.UTC(1969, 11, 31), Date.UTC(1970, 0, 1), Date.UTC(1930, 2, 15),
  ];
  for (const anchor of boundaries) {
    for (const span of [MOON_BLOCK_MS, SUN_BLOCK_MS]) {
      const edge = Math.floor(anchor / span) * span;
      out.push(edge - 1, edge, edge + 1, edge + span - 1, edge + span, edge + span + 1);
      out.push(edge + Math.floor(span / 2));
    }
  }
  const base = Math.floor(Date.UTC(2025, 0, 14) / MOON_BLOCK_MS) * MOON_BLOCK_MS;
  for (let i = 0; i < 24; i++) out.push(base + 37 * i);
  for (let i = -3; i <= 3; i++) out.push(base + MOON_BLOCK_MS / 2 + i);
  out.push(0, -1, 1, Date.UTC(2000, 0, 1, 12), CACHE_MS_LO, CACHE_MS_HI);
  for (const ms of cacheInstants(200)) out.push(ms);
  return out;
}

function writeCacheGolden(): void {
  const accessors = cacheAccessors();
  const names = Object.keys(accessors).sort();
  const instants = cacheInstants(CACHE_SAMPLES);
  const short = instants.slice(0, CACHE_SAMPLES_SHORT);
  const cases = cacheCaseInstants();
  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/astronomy/cache.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'The Sun half of LongitudeCache is bit-identical to the TypeScript in ' +
        'both modes; the Moon half is bounded, because Math.cos(2*pi/9), one of ' +
        'the ten Chebyshev abscissae, differs by one ULP between V8 and Go, and ' +
        'because getTropicalMoonLongitude was already bounded. The block index ' +
        'must agree exactly, everywhere, including before 1970.',
      span: [new Date(CACHE_MS_LO).toISOString(), new Date(CACHE_MS_HI).toISOString()],
      moonBlockMs: MOON_BLOCK_MS,
      sunBlockMs: SUN_BLOCK_MS,
    },
    seed: CACHE_SEED,
    samples: CACHE_SAMPLES,
    samplesShort: CACHE_SAMPLES_SHORT,
    msLo: CACHE_MS_LO,
    msHi: CACHE_MS_HI,
    digests: Object.fromEntries(names.map((n) => [n, digestOver(instants, accessors[n]!)])),
    digestsShort: Object.fromEntries(names.map((n) => [n, digestOver(short, accessors[n]!)])),
    caseInstants: cases,
    cases: Object.fromEntries(names.map((n) => [n, cases.map(accessors[n]!)])),
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'astronomy', 'cache-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote cache-golden.json (${names.length} accessors, ${cases.length} cases)\n`,
  );
}


// Rise/set instants are pinned as an EQUALITY even though `altitudeExcess` is
// not bit-identical: the scan, subdivision proof and bisection consume only
// `sign(f)`, and its ~1e-13 deg spread is 2.4e-11 s against a 0.864 ms stop.

const RISESET_LOCATIONS = [
  { name: 'Quito', latitude: -0.18, longitude: -78.47, elevation: 0 },
  { name: 'Pune', latitude: 18.52, longitude: 73.86, elevation: 560 },
  { name: 'London', latitude: 51.51, longitude: -0.13, elevation: 0 },
  { name: 'Reykjavik', latitude: 64.15, longitude: -21.94, elevation: 0 },
  { name: 'Alert', latitude: 82.5, longitude: -62.35, elevation: 0 },
  { name: 'McMurdo', latitude: -77.85, longitude: 166.67, elevation: 0 },
  { name: 'Longyearbyen', latitude: 78.2232, longitude: 15.6267, elevation: 0 },
] as const;

const RISESET_EPOCHS = [
  Date.UTC(1950, 2, 3), Date.UTC(2025, 6, 9), Date.UTC(2088, 10, 21),
  Date.UTC(1912, 5, 1), Date.UTC(1969, 11, 30),
];
const RISESET_DAYS = 4;

const SOLAR_KIND: RiseSetKind = { body: 'sun' };
const LUNAR_KIND: RiseSetKind = { body: 'moon' };

function risesetDayCases(): {
  body: string; direction: number; location: string;
  latitude: number; longitude: number; elevation: number;
  dayIndex: number; events: number[];
}[] {
  const out: ReturnType<typeof risesetDayCases> = [];
  for (const loc of RISESET_LOCATIONS) {
    for (const epoch of RISESET_EPOCHS) {
      for (let d = 0; d < RISESET_DAYS; d++) {
        const dayIndex = Math.floor((epoch + d * 86_400_000) / 86_400_000);
        for (const body of ['sun', 'moon'] as RiseSetBody[]) {
          for (const direction of [1, -1] as (1 | -1)[]) {
            out.push({
              body, direction, location: loc.name,
              latitude: loc.latitude, longitude: loc.longitude, elevation: loc.elevation,
              dayIndex,
              events: [...dayEvents(body, direction, loc, dayIndex)],
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Restated because neither file exports them. `${x}` is `Number::toString`,
 * which Go's strconv does NOT reproduce and `jsnum.FormatFloat` does. A key
 * that only usually matches splits a cache silently rather than failing.
 */
function risesetKeyCases(): { scanKey: string; eventKey: string; inputs: unknown }[] {
  const probes = [
    { body: 'sun', direction: 1, latitude: 18.5204, longitude: 73.8567, elevation: 560, dayIndex: 20000 },
    { body: 'moon', direction: -1, latitude: -0.18, longitude: -78.47, elevation: 0, dayIndex: -20000 },
    { body: 'sun', direction: -1, latitude: 82.5, longitude: -62.35, elevation: 0, dayIndex: 0 },
    { body: 'moon', direction: 1, latitude: 0.000028547284, longitude: 1e21, elevation: 1e-7, dayIndex: 1 },
    { body: 'sun', direction: 1, latitude: -0, longitude: 0, elevation: -0, dayIndex: -1 },
    { body: 'moon', direction: -1, latitude: 1 / 3, longitude: -2 / 3, elevation: 1e20, dayIndex: 123456789 },
  ] as const;
  return probes.map((p) => ({
    inputs: p,
    scanKey: `${p.body}|${p.latitude}|${p.longitude}|${p.elevation}|${p.dayIndex}`,
    eventKey: `${p.body}|${p.direction}|${p.latitude}|${p.longitude}|${p.elevation}|${p.dayIndex}`,
  }));
}

function risesetResolveCases(): {
  body: string; direction: number; location: string; fromMs: number;
  limitDays: number; result: number | null;
}[] {
  const out: ReturnType<typeof risesetResolveCases> = [];
  for (const loc of RISESET_LOCATIONS) {
    for (const epoch of [Date.UTC(2025, 6, 9), Date.UTC(1950, 2, 3), Date.UTC(1912, 5, 1)]) {
      for (const offset of [0, 6 * 3600_000, 13 * 3600_000, 23 * 3600_000 + 59 * 60_000]) {
        for (const limitDays of [1, 2]) {
          const from = new Date(epoch + offset);
          for (const [kind, direction] of
            [[SOLAR_KIND, 1], [SOLAR_KIND, -1], [LUNAR_KIND, 1], [LUNAR_KIND, -1]] as const) {
            const r = resolveEvent(kind, direction, from, loc, limitDays);
            out.push({
              body: kind.body, direction, location: loc.name, fromMs: from.getTime(),
              limitDays, result: r === null ? null : r.getTime(),
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * `computeSunrise` throws NO_SUNRISE at Longyearbyen where the Moon's returns
 * null: the two failure shapes are deliberately different.
 */
function risesetWrapperCases(): {
  fn: string; location: string; fromMs: number; limitDays: number;
  result: number | null; error: string | null;
}[] {
  const out: ReturnType<typeof risesetWrapperCases> = [];
  const fns = {
    computeSunrise: (d: Date, l: typeof RISESET_LOCATIONS[number], n: number) => computeSunrise(d, l, n),
    computeSunset: (d: Date, l: typeof RISESET_LOCATIONS[number], n: number) => computeSunset(d, l, n),
    getMoonrise: (d: Date, l: typeof RISESET_LOCATIONS[number], n: number) => getMoonrise(d, l, n),
    getMoonset: (d: Date, l: typeof RISESET_LOCATIONS[number], n: number) => getMoonset(d, l, n),
  };
  for (const loc of RISESET_LOCATIONS) {
    for (const epoch of [
      Date.UTC(2025, 5, 21), Date.UTC(2025, 11, 21), Date.UTC(1950, 2, 3),
      Date.UTC(2088, 10, 21), Date.UTC(1912, 5, 1),
    ]) {
      for (const [name, fn] of Object.entries(fns)) {
        for (const limitDays of [2]) {
          const from = new Date(epoch);
          let result: number | null = null;
          let error: string | null = null;
          try {
            const r = fn(from, loc, limitDays);
            result = r === null ? null : r.getTime();
          } catch (e) {
            error = (e as { code?: string }).code ?? 'UNKNOWN';
          }
          out.push({ fn: name, location: loc.name, fromMs: from.getTime(), limitDays, result, error });
        }
      }
    }
  }
  return out;
}

/**
 * The TypeScript has these aliasing one backing array where the Go port
 * deliberately does not.
 */
function risesetCanonicalCases(): { body: string; direction: number; location: string; dayIndex: number; events: number[] }[] {
  const out: ReturnType<typeof risesetCanonicalCases> = [];
  for (const loc of RISESET_LOCATIONS) {
    const dayIndex = Math.floor(Date.UTC(2025, 6, 9) / 86_400_000);
    for (const [kind, direction] of
      [[SOLAR_KIND, 1], [SOLAR_KIND, -1], [LUNAR_KIND, 1], [LUNAR_KIND, -1]] as const) {
      out.push({
        body: kind.body, direction, location: loc.name, dayIndex,
        events: [...canonicalDayEvents(kind, direction, loc, dayIndex)],
      });
    }
  }
  return out;
}

function writeRiseSetGolden(): void {
  clearRiseSetTracks();
  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/astronomy/{riseSet,riseSetCache,sunrise,moonrise}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Published rise/set instants are bit-identical between Go and TypeScript. ' +
        'The altitude function is not, it ends in asin/sqrt/cos/sin, but the ' +
        'scan, the subdivision proof and the bisection all consume only its ' +
        'SIGN, and no probe lands within 1e-13 deg of a root, so the branch ' +
        'sequence and therefore the answer are identical. Asserted as an ' +
        'equality deliberately: a failure here is a port defect, not rounding.',
      trackBlockDays: 4,
      trackNodes: 11,
      scanStepMinutes: 12,
    },
    locations: RISESET_LOCATIONS,
    epochs: RISESET_EPOCHS,
    daysPerEpoch: RISESET_DAYS,
    dayCases: risesetDayCases(),
    canonicalCases: risesetCanonicalCases(),
    keyCases: risesetKeyCases(),
    resolveCases: risesetResolveCases(),
    wrapperCases: risesetWrapperCases(),
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'astronomy', 'riseset-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote riseset-golden.json (${file.dayCases.length} day cases, ` +
    `${file.resolveCases.length} resolve cases, ${file.wrapperCases.length} wrapper cases)\n`,
  );
}


// `resolveUtcOffset` is the one place two different mechanisms have to agree.
// `Intl` renders whole minutes while Go's `time.LoadLocation` returns seconds,
// and sub-minute offsets exist (Asia/Kolkata was +05:53:20 until 1906).

const LUNATION_SEED = 0x11FA5E01 >>> 0;
const LUNATION_SAMPLES = 400;
const LUNATION_MS_LO = Date.UTC(1900, 0, 1), LUNATION_MS_HI = Date.UTC(2100, 0, 1);

function lunationInstants(count: number): number[] {
  const out: number[] = [];
  for (const u of unit01(LUNATION_SEED, count)) {
    out.push(Math.floor(LUNATION_MS_LO + u * (LUNATION_MS_HI - LUNATION_MS_LO)));
  }
  // Instants that are themselves syzygies, plus their neighbours: an exact `<=`
  // in newMoon.ts's `PHASE_AGREEMENT_MS` branch puts an instant sitting on a new
  // moon a month out.
  for (const anchor of [Date.UTC(2025, 0, 29, 12, 36), Date.UTC(1912, 5, 15), Date.UTC(2088, 10, 3)]) {
    const nm = searchMoonPhase(0, new Date(anchor - 40 * 86_400_000), 45);
    if (nm) for (const d of [-2, -1, 0, 1, 2]) out.push(nm.getTime() + d);
  }
  out.push(0, -1, 1, Date.UTC(2000, 0, 1, 12), LUNATION_MS_LO, LUNATION_MS_HI - 1);
  return out;
}

function writeLunationGolden(): void {
  const instants = lunationInstants(LUNATION_SAMPLES);

  const elongation = instants.map((ms) => moonSunElongation(new Date(ms)));

  const phaseTargets = [0, 90, 180, 270, 137.5];
  const searches: Record<string, (number | null)[]> = {};
  for (const target of phaseTargets) {
    searches[`t${target}`] = instants.map((ms) => {
      const r = searchMoonPhase(target, new Date(ms), 45);
      return r === null ? null : r.getTime();
    });
  }
  searches['t0_narrow'] = instants.map((ms) => {
    const r = searchMoonPhase(0, new Date(ms), 0.5);
    return r === null ? null : r.getTime();
  });

  const quarters = instants.map((ms) => {
    const q = searchMoonQuarter(new Date(ms));
    const n = nextMoonQuarter(q);
    return { quarter: q.quarter, time: q.time.getTime(), nextQuarter: n.quarter, nextTime: n.time.getTime() };
  });

  const bounds = instants.map((ms) => {
    const b = boundingNewMoons(new Date(ms));
    return { prev: b.prev.getTime(), next: b.next.getTime() };
  });

  const cache = new NewMoonCache();
  const cached = instants.map((ms) => {
    const b = cache.bounding(new Date(ms));
    return { prev: b.prev.getTime(), next: b.next.getTime() };
  });

  const phaseYears = [1912, 1950, 2025, 2088, 2100];
  const phasesInRange = phaseYears.map((y) => ({
    year: y,
    events: computeMoonPhasesInRange(
      new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
    ).map((e) => ({ phase: e.phase, time: e.time.getTime() })),
  }));
  const phasesForYear = [
    { year: 2025, timezone: 330 as number | string },
    { year: 2025, timezone: 'America/New_York' },
    { year: 1950, timezone: 'Europe/London' },
    { year: 2088, timezone: -300 },
  ].map((c) => ({
    ...c,
    events: computeMoonPhasesForYear(c.year, { timezone: c.timezone })
      .map((e) => ({ phase: e.phase, time: e.time.getTime() })),
  }));

  const ZONES = [
    'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Australia/Adelaide',
    'Pacific/Chatham', 'Asia/Kathmandu', 'America/St_Johns', 'UTC', 'Pacific/Kiritimati',
  ];
  const TZ_INSTANTS = [
    Date.UTC(1900, 0, 1), Date.UTC(1905, 0, 1), Date.UTC(1912, 5, 1),
    Date.UTC(1950, 2, 3), Date.UTC(2025, 0, 14), Date.UTC(2025, 6, 9),
    Date.UTC(2088, 10, 21), Date.UTC(2100, 0, 1),
  ];
  const offsets: { zone: string; ms: number; offset: number | null; error: string | null }[] = [];
  for (const zone of ZONES) {
    for (const ms of TZ_INSTANTS) {
      try {
        offsets.push({ zone, ms, offset: resolveUtcOffset(zone, new Date(ms)), error: null });
      } catch (e) {
        offsets.push({ zone, ms, offset: null, error: (e as { code?: string }).code ?? 'UNKNOWN' });
      }
    }
  }
  const numericOffsets = [0, 330, -300, 345, 840, -720, 841, -721, 5.5].map((v) => {
    try {
      return { value: v, offset: resolveUtcOffset(v, new Date(0)), error: null as string | null };
    } catch (e) {
      return { value: v, offset: null, error: (e as { code?: string }).code ?? 'UNKNOWN' };
    }
  });

  const FORMAT_OFFSETS = [0, 330, -300, 345, -570, 840, -720, 60, -60];
  const FORMAT_INSTANTS = [
    Date.parse('2025-01-14T01:39:44.172Z'), 0, -1, 1,
    Date.UTC(1912, 5, 1, 23, 59, 59, 999), Date.UTC(2088, 10, 21, 12, 0, 0, 1),
    Date.UTC(999, 0, 1), Date.UTC(1, 0, 1), Date.UTC(2100, 11, 31, 23, 59, 59, 999),
  ];
  const formatted: { ms: number; offset: number; s: string }[] = [];
  for (const ms of FORMAT_INSTANTS) {
    for (const offset of FORMAT_OFFSETS) formatted.push({ ms, offset, s: formatInZone(new Date(ms), offset) });
  }
  const midnights: { ms: number; offset: number; midnight: number; display: number }[] = [];
  for (const ms of FORMAT_INSTANTS) {
    for (const offset of FORMAT_OFFSETS) {
      midnights.push({
        ms, offset,
        midnight: getLocalMidnightUtc(new Date(ms), offset).getTime(),
        display: utcToLocalDisplay(new Date(ms), offset).getTime(),
      });
    }
  }

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/astronomy/{lunation,newMoon,moonPhase}.ts, src/utils/timezone.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Phase instants are bit-identical despite a secant search over a ' +
        'non-bit-identical elongation, because every probe is truncated to a ' +
        'whole millisecond and the result is rounded to one. resolveUtcOffset ' +
        'reaches the same answer through time.LoadLocation that the TypeScript ' +
        'reaches through Intl shortOffset, including for zones whose historical ' +
        'offset carries seconds. formatInZone is an exact string.',
      pinnedString: '2025-01-14T07:09:44.172+05:30 (phase38-result-shape.test.ts:211)',
    },
    seed: LUNATION_SEED,
    instants,
    elongation,
    searches,
    quarters,
    bounds,
    cached,
    phasesInRange,
    phasesForYear,
    zoneOffsets: offsets,
    numericOffsets,
    formatted,
    midnights,
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'astronomy', 'lunation-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote lunation-golden.json (${instants.length} instants, ${offsets.length} zone offsets, ` +
    `${formatted.length} formatted strings)\n`,
  );
}


// The eclipse solvers interpolate on the VALUE of a non-bit-identical
// separation, so agreement is within a millisecond or two rather than exact.

const ECLIPSE_LUNAR_SEEDS = [
  Date.UTC(1901, 4, 3), Date.UTC(1913, 2, 22), Date.UTC(1950, 8, 26),
  Date.UTC(1982, 11, 30), Date.UTC(2000, 6, 16), Date.UTC(2015, 3, 4),
  Date.UTC(2018, 6, 27), Date.UTC(2022, 10, 8), Date.UTC(2025, 2, 14),
  Date.UTC(2029, 5, 26), Date.UTC(2058, 4, 8), Date.UTC(2099, 8, 29),
];
const ECLIPSE_SOLAR_SEEDS = [
  Date.UTC(1901, 4, 18), Date.UTC(1919, 4, 29), Date.UTC(1955, 5, 20),
  Date.UTC(1991, 6, 11), Date.UTC(1999, 7, 11), Date.UTC(2017, 7, 21),
  Date.UTC(2024, 3, 8), Date.UTC(2027, 7, 2), Date.UTC(2045, 7, 12),
  Date.UTC(2081, 8, 3),
];
const ECLIPSE_SITES = [
  { name: 'Varanasi', latitude: 25.3176, longitude: 82.9739, elevation: 80 },
  { name: 'Casper', latitude: 42.8666, longitude: -106.3131, elevation: 1580 },
  { name: 'London', latitude: 51.5074, longitude: -0.1278, elevation: 0 },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, elevation: 0 },
];

function writeEclipseGolden(): void {
  const shadowInstants: number[] = [];
  for (const seed of ECLIPSE_LUNAR_SEEDS) {
    for (const h of [-6, -3, -1, 0, 1, 3, 6]) shadowInstants.push(seed + h * 3600_000);
  }
  const shadows = shadowInstants.map((ms) => {
    const s = lunarShadowAt(new Date(ms));
    return {
      ms,
      separation: s.separation, umbra: s.umbra,
      penumbra: s.penumbra, moonSemidiameter: s.moonSemidiameter,
    };
  });

  const views: unknown[] = [];
  for (const site of ECLIPSE_SITES) {
    for (const seed of ECLIPSE_SOLAR_SEEDS) {
      for (const h of [-3, 0, 3]) {
        const ms = seed + h * 3600_000;
        const v = solarViewAt(new Date(ms), site);
        views.push({
          site: site.name, ms,
          separation: v.separation, sunSemidiameter: v.sunSemidiameter,
          moonSemidiameter: v.moonSemidiameter, sunAltitude: v.sunAltitude,
          sunAzimuth: v.sunAzimuth,
        });
      }
    }
  }

  const obscurations: { separation: number; disc: number; cover: number; value: number }[] = [];
  for (const disc of [0, 0.25, 0.26, 0.5]) {
    for (const cover of [0.2, 0.25, 0.27, 0.5]) {
      for (const sep of [0, 0.01, 0.05, 0.1, 0.25, 0.4, 0.5, 0.51, 1]) {
        obscurations.push({ separation: sep, disc, cover, value: discObscuration(sep, disc, cover) });
      }
    }
  }

  const lunar = ECLIPSE_LUNAR_SEEDS.map((seed) => {
    const opposition = searchMoonPhase(180, new Date(seed - 3 * 86_400_000), 8);
    const e = opposition === null ? null : findLunarEclipse(opposition);
    return {
      seed,
      opposition: opposition === null ? null : opposition.getTime(),
      eclipse: e === null ? null : {
        kind: e.kind, peak: e.peak.getTime(),
        penumbralBegin: e.penumbralBegin.getTime(), penumbralEnd: e.penumbralEnd.getTime(),
        partialBegin: e.partialBegin === null ? null : e.partialBegin.getTime(),
        partialEnd: e.partialEnd === null ? null : e.partialEnd.getTime(),
        totalBegin: e.totalBegin === null ? null : e.totalBegin.getTime(),
        totalEnd: e.totalEnd === null ? null : e.totalEnd.getTime(),
        penumbralMagnitude: e.penumbralMagnitude, umbralMagnitude: e.umbralMagnitude,
        umbralObscuration: e.umbralObscuration,
      },
    };
  });

  const solar: unknown[] = [];
  for (const site of ECLIPSE_SITES) {
    for (const seed of ECLIPSE_SOLAR_SEEDS) {
      const conjunction = searchMoonPhase(0, new Date(seed - 2 * 86_400_000), 5);
      const e = conjunction === null ? null : findLocalSolarEclipse(conjunction, site);
      solar.push({
        site: site.name, seed,
        conjunction: conjunction === null ? null : conjunction.getTime(),
        eclipse: e === null ? null : {
          kind: e.kind, peak: e.peak.getTime(),
          partialBegin: e.partialBegin.getTime(), partialEnd: e.partialEnd.getTime(),
          centralBegin: e.centralBegin === null ? null : e.centralBegin.getTime(),
          centralEnd: e.centralEnd === null ? null : e.centralEnd.getTime(),
          obscuration: e.obscuration, magnitude: e.magnitude,
          peakAltitude: e.peakAltitude, beginAltitude: e.beginAltitude,
          endAltitude: e.endAltitude, peakAzimuth: e.peakAzimuth,
        },
      });
    }
  }

  const published: unknown[] = [];
  for (const lang of ['en', 'hi'] as const) {
    for (const site of ECLIPSE_SITES.slice(0, 2)) {
      for (const seed of ECLIPSE_LUNAR_SEEDS) {
        const info = getUpcomingLunarEclipse(new Date(seed - 3 * 86_400_000), site, 6, lang);
        published.push({ fn: 'lunar', lang, site: site.name, seed, info: serializeEclipseInfo(info) });
      }
      for (const seed of ECLIPSE_SOLAR_SEEDS) {
        const info = getUpcomingSolarEclipse(new Date(seed - 2 * 86_400_000), site, 5, lang);
        published.push({ fn: 'solar', lang, site: site.name, seed, info: serializeEclipseInfo(info) });
      }
    }
  }

  const duringDay: unknown[] = [];
  for (const site of ECLIPSE_SITES.slice(0, 2)) {
    for (const seed of [...ECLIPSE_LUNAR_SEEDS.slice(0, 4), ...ECLIPSE_SOLAR_SEEDS.slice(0, 4),
      Date.UTC(2025, 0, 14), Date.UTC(1912, 5, 1)]) {
      for (const d of [-1, 0, 1]) {
        const sunrise = seed + d * 86_400_000 + 3600_000;
        const info = getEclipseDuringDay(new Date(sunrise), new Date(sunrise + 86_400_000), site, 'en');
        duringDay.push({ site: site.name, sunrise, info: serializeEclipseInfo(info) });
      }
    }
  }

  const horizon: { site: string; ms: number; sun: boolean; moon: boolean }[] = [];
  for (const site of ECLIPSE_SITES) {
    for (const seed of ECLIPSE_SOLAR_SEEDS) {
      for (const h of [0, 6, 12, 18]) {
        const ms = seed + h * 3600_000;
        horizon.push({
          site: site.name, ms,
          sun: isBodyAboveHorizon(new Date(ms), site, 'sun'),
          moon: isBodyAboveHorizon(new Date(ms), site, 'moon'),
        });
      }
    }
  }

  const anyPhase: { site: string; seed: number; visible: boolean | null }[] = [];
  for (const site of ECLIPSE_SITES) {
    for (const seed of ECLIPSE_LUNAR_SEEDS) {
      const info = getUpcomingLunarEclipse(new Date(seed - 3 * 86_400_000), site, 6, 'en');
      anyPhase.push({
        site: site.name, seed,
        visible: info === null ? null : isEclipseVisibleAnyPhase(info, site),
      });
    }
  }

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/astronomy/{eclipseGeometry,eclipse}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Unlike rise/set and the phase search, the eclipse solvers read the ' +
        'VALUE of a non-bit-identical separation, a parabolic vertex and ' +
        'Illinois false position both interpolate. Probes are still truncated to ' +
        'whole milliseconds and contacts still rounded to them, so the prediction ' +
        'is agreement within a millisecond or two on instants and at the ' +
        'platform-trig floor on magnitudes. The Go test measures which.',
    },
    lunarSeeds: ECLIPSE_LUNAR_SEEDS,
    solarSeeds: ECLIPSE_SOLAR_SEEDS,
    sites: ECLIPSE_SITES,
    shadows,
    views,
    obscurations,
    lunar,
    solar,
    published,
    duringDay,
    horizon,
    anyPhase,
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'astronomy', 'eclipse-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote eclipse-golden.json (${shadows.length} shadows, ${views.length} views, ` +
    `${lunar.length} lunar, ${solar.length} solar, ${published.length} published)\n`,
  );
}

function serializeEclipseInfo(info: ReturnType<typeof getUpcomingLunarEclipse>): unknown {
  if (info === null) return null;
  return {
    kind: info.kind, subtype: info.subtype,
    start: info.start.getTime(), peak: info.peak.getTime(), end: info.end.getTime(),
    visibleFromLocation: info.visibleFromLocation,
    obscuration: info.obscuration, magnitude: info.magnitude,
    sutakStart: info.sutakStart === null ? null : info.sutakStart.getTime(),
    sutakEnd: info.sutakEnd === null ? null : info.sutakEnd.getTime(),
    description: info.description,
  };
}


// A synthetic polynomial angle rather than the real ephemeris, so anything
// that differs here is the solver.

const SOLVER_EPOCH = Date.UTC(2025, 0, 14);

function syntheticAngleAt(date: Date): number {
  const t = (date.getTime() - SOLVER_EPOCH) / 3600_000; // hours
  return 12.7 + 0.55 * t + 0.0004 * t * t - 0.0000009 * t * t * t;
}
const SYNTHETIC_ANGLE: ElementAngle = { angleAt: syntheticAngleAt, spanDeg: 12 };
const syntheticIndexAt = (date: Date): number =>
  Math.floor((((syntheticAngleAt(date) % 360) + 360) % 360) / 12);

function writeUtilsGolden(): void {
  const transitions: unknown[] = [];
  for (let h = 0; h < 48; h += 3) {
    const start = new Date(SOLVER_EPOCH + h * 3600_000);
    const idx = syntheticIndexAt(start);
    for (const windowHours of [18, 36]) {
      const maxEnd = new Date(start.getTime() + windowHours * 3600_000);
      for (const withAngle of [true, false]) {
        let value: number | string;
        try {
          value = findTransitionTime(
            start, maxEnd, idx, syntheticIndexAt,
            STANDARD_PRECISION.maxIterations, STANDARD_PRECISION.toleranceMs,
            withAngle ? SYNTHETIC_ANGLE : undefined,
          ).getTime();
        } catch (e) {
          value = (e as { code?: string }).code ?? 'ERROR';
        }
        transitions.push({ startMs: start.getTime(), idx, windowHours, withAngle, value });
      }
    }
  }

  const starts: unknown[] = [];
  for (let h = 0; h < 48; h += 3) {
    const from = new Date(SOLVER_EPOCH + h * 3600_000);
    const idx = syntheticIndexAt(from);
    for (const backHours of [6, 36]) {
      for (const withAngle of [true, false]) {
        starts.push({
          fromMs: from.getTime(), idx, backHours, withAngle,
          value: findStartTime(
            from, idx, syntheticIndexAt, backHours,
            STANDARD_PRECISION.maxIterations, STANDARD_PRECISION.toleranceMs,
            withAngle ? SYNTHETIC_ANGLE : undefined,
          ).getTime(),
        });
      }
    }
  }

  const boundaries: unknown[] = [];
  for (let h = 0; h < 40; h += 5) {
    const lo = new Date(SOLVER_EPOCH + h * 3600_000);
    const hi = new Date(lo.getTime() + 24 * 3600_000);
    const stillBefore = (ms: number): boolean => syntheticIndexAt(new Date(ms)) === syntheticIndexAt(lo);
    boundaries.push({
      loMs: lo.getTime(), hiMs: hi.getTime(),
      element: solveElementBoundary(lo.getTime(), hi.getTime(), SYNTHETIC_ANGLE, stillBefore),
    });
  }
  // Targets must sit inside the angle's actual range, or nothing is ever
  // bracketed and a run of nulls looks exactly like a run of passes.
  const crossings: unknown[] = [];
  for (const target of [20, 30, 40, 50, 200]) {
    for (let h = 0; h < 40; h += 7) {
      const lo = new Date(SOLVER_EPOCH + h * 3600_000);
      const hi = new Date(lo.getTime() + 40 * 3600_000);
      const before = (ms: number): boolean => {
        const a = ((syntheticAngleAt(new Date(ms)) % 360) + 360) % 360;
        return a < target;
      };
      crossings.push({
        target, loMs: lo.getTime(), hiMs: hi.getTime(),
        value: solveAngleCrossing(lo.getTime(), hi.getTime(), target, syntheticAngleAt, before),
      });
    }
  }

  const daily: unknown[] = [];
  for (let d = 0; d < 6; d++) {
    const sunrise = new Date(SOLVER_EPOCH + d * 86_400_000 + 6 * 3600_000);
    const nextSunrise = new Date(sunrise.getTime() + 86_400_000 + 37_000);
    const elementAt = (date: Date) => ({ index: syntheticIndexAt(date), endTime: null as Date | null });
    const out = findDailyElements(
      sunrise, nextSunrise, elementAt(sunrise), syntheticIndexAt, elementAt,
      36, STANDARD_PRECISION, 5, SYNTHETIC_ANGLE,
    );
    daily.push({
      sunriseMs: sunrise.getTime(), nextSunriseMs: nextSunrise.getTime(),
      elements: out.map((e) => ({
        index: e.index,
        startTime: e.startTime === null ? null : e.startTime.getTime(),
        endTime: e.endTime === null ? null : e.endTime.getTime(),
        isActiveAtSunrise: e.isActiveAtSunrise,
      })),
    });
  }

  const slots: unknown[] = [];
  for (const count of [8, 12, 15, 7, 3]) {
    for (const [refMs, durationMs] of [
      [Date.UTC(2025, 0, 14, 1, 39, 44, 172), 44_063_828],
      [Date.UTC(1912, 5, 1), 43_200_001],
      [-1, 1],
      [Date.UTC(2088, 10, 21), 86_399_999],
    ] as const) {
      slots.push({
        refMs, durationMs, count,
        bounds: buildEqualSlots(new Date(refMs), durationMs, count,
          (ordinal, start, end) => [ordinal, start.getTime(), end.getTime()]),
      });
    }
  }

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/utils/{search,slots,constants}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'The solvers are compared against a synthetic polynomial angle, so no ' +
        'platform transcendental is involved and the prediction is bit-identity. ' +
        'A difference here is the solver, secant, forward walk, bracket ' +
        'extension or bisection, and nothing else.',
      syntheticAngle: '12.7 + 0.55t + 0.0004t^2 - 0.0000009t^3, t = hours since 2025-01-14T00:00Z, span 12 deg',
    },
    solverEpoch: SOLVER_EPOCH,
    transitions,
    starts,
    boundaries,
    crossings,
    daily,
    slots,
    varaChaldeanStart: [...VARA_CHALDEAN_START],
    constants: {
      TITHI_SPAN, NAKSHATRA_SPAN, NAKSHATRA_PADA_SPAN, YOGA_SPAN, KARANA_SPAN, RASHI_SPAN,
    },
    nakshatraOf: [0, 13.3, 13.33333333333333, 13.333333333333334, 180, 359.9999, 359.99999999999994]
      .map((v) => [v, nakshatraOf(v)]),
    rashiOf: [0, 29.9999, 30, 180, 359.9999].map((v) => [v, rashiOf(v)]),
    anandadiTable: ANANDADI_TABLE.map((r) => [...r]),
    anandadiQuality: [...ANANDADI_QUALITY],
    varjyamOffsets: [...VARJYAM_OFFSET_GHATIKAS],
    rahuKalamSlots: [...RAHU_KALAM_SLOTS],
    yamagandaSlots: [...YAMAGANDA_SLOTS],
    gulikaSlots: [...GULIKA_SLOTS],
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'utils', 'utils-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote utils-golden.json (${transitions.length} transitions, ${starts.length} starts, ` +
    `${daily.length} daily, ${slots.length} slot sets)\n`,
  );
}

// Three traps: `angle - index * span` is an FMA site in Go, and in
// `nakshatra.ts` it feeds `pada`, a published integer; `Math.round(x * 100) / 100`
// is `jsnum.Round`, not `math.Round`, and they disagree on every negative tie;
// and `normalize360`'s guards must give 0 and not 360 for a tiny negative
// elongation, or the tithi index is 30 and the nakshatra index 27.

const ELEMENT_SEED = 0x5ADFACE;
const ELEMENT_SAMPLES = 200_000;
const ELEMENT_SAMPLES_SHORT = 5_000;

function* elementPairs(seed: number, count: number): Generator<[number, number]> {
  const it = uniform(seed, count * 2, 180);
  for (let i = 0; i < count; i++) {
    const moon = it.next().value as number;
    const sun = it.next().value as number;
    yield [moon + 180, sun + 180];
  }
}

function elementBoundaryPairs(): [number, number][] {
  const out: [number, number][] = [];
  const nudge = (x: number): number[] => [
    x,
    x === 0 ? -Number.MIN_VALUE : x - Math.abs(x) * Number.EPSILON,
    x + Math.max(Math.abs(x), 1) * Number.EPSILON,
  ];
  const sun = 100.5;
  for (let k = 0; k <= 30; k++) {
    for (const e of nudge(k * TITHI_SPAN)) out.push([sun + e, sun]);
  }
  for (let k = 0; k <= 60; k++) {
    for (const e of nudge(k * KARANA_SPAN)) out.push([sun + e, sun]);
  }
  for (let k = 0; k <= 27; k++) {
    for (const m of nudge(k * NAKSHATRA_SPAN)) out.push([m, sun]);
  }
  for (let k = 0; k <= 108; k++) {
    for (const m of nudge(k * NAKSHATRA_PADA_SPAN)) out.push([m, sun]);
  }
  for (let k = 0; k <= 27; k++) {
    for (const y of nudge(k * YOGA_SPAN)) out.push([y - sun, sun]);
  }
  out.push([sun - 1e-15, sun], [sun - 1e-18, sun], [sun - 360, sun], [sun, sun]);
  return out;
}

export const ELEMENT_LEAF_NAMES = [
  't.index', 't.number', 't.completionPercentage',
  'n.index', 'n.pada', 'n.degreesInNakshatra', 'n.completionPercentage',
  'y.index', 'y.completionPercentage',
  'k.index', 'k.completionPercentage', 'k.typeIsFixed',
  'getTithiIndexFromLons', 'getYogaIndex', 'getKaranaIndex',
] as const;

function elementLeaves(moon: number, sun: number): number[] {
  const t = computeTithiFromLongitudes(moon, sun, '', '');
  const nk = computeNakshatraFromLongitude(moon, '');
  const y = computeYogaFromLongitudes(moon, sun, '');
  const kr = computeKaranaFromLongitudes(moon, sun, '');
  return [
    t.index, t.number, t.completionPercentage,
    nk.index, nk.pada, nk.degreesInNakshatra, nk.completionPercentage,
    y.index, y.completionPercentage,
    kr.index, kr.completionPercentage, kr.type === 'fixed' ? 1 : 0,
    getTithiIndexFromLons(moon, sun),
    getYogaIndex(moon, sun),
    getKaranaIndex(moon, sun),
  ];
}

function elementDigest(pairs: Iterable<[number, number]>): string {
  const h = createHash('sha256');
  const BLOCK = 4096;
  const buf = Buffer.allocUnsafe(BLOCK * 8);
  let n = 0;
  const push = (v: number): void => {
    buf.writeDoubleLE(v, n * 8);
    if (++n === BLOCK) { h.update(buf); n = 0; }
  };
  for (const [moon, sun] of pairs) {
    for (const v of elementLeaves(moon, sun)) push(v);
  }
  if (n > 0) h.update(buf.subarray(0, n * 8));
  return h.digest('hex');
}

/**
 * `nakshatraOf(-5e-324)` underflows to `-0` and `Math.floor(-0)` is `-0`, so
 * the TypeScript's `index` is a number `-0` where Go's is an `int`. The split
 * DETECTS `-0` rather than naming the inputs, so it stays honest if either
 * implementation changes.
 */
function partitionBySignedZero(pairs: [number, number][]): {
  clean: [number, number][];
  signedZero: { moon: number; sun: number; leaves: number[]; negZeroLeaves: string[] }[];
} {
  const clean: [number, number][] = [];
  const signedZero: { moon: number; sun: number; leaves: number[]; negZeroLeaves: string[] }[] = [];
  for (const [moon, sun] of pairs) {
    const leaves = elementLeaves(moon, sun);
    const negZeroLeaves = leaves
      .map((v, i) => (Object.is(v, -0) ? ELEMENT_LEAF_NAMES[i]! : ''))
      .filter((n) => n !== '');
    if (negZeroLeaves.length === 0) clean.push([moon, sun]);
    else signedZero.push({ moon, sun, leaves, negZeroLeaves });
  }
  return { clean, signedZero };
}

function elementCases(pairs: [number, number][]): unknown[] {
  return pairs.map(([moon, sun]) => ({
    moon, sun,
    tithi: computeTithiFromLongitudes(moon, sun, '', ''),
    nakshatra: computeNakshatraFromLongitude(moon, ''),
    yoga: computeYogaFromLongitudes(moon, sun, ''),
    karana: computeKaranaFromLongitudes(moon, sun, ''),
  }));
}

function resolverTable(): Record<string, Record<string, string[]>> {
  const langs: Language[] = ['en', 'hi'];
  const out: Record<string, Record<string, string[]>> = {};
  for (const lang of langs) {
    out[lang] = {
      paksha: range(30).map((i) => resolvePakshaName(i, lang)),
      tithi: range(30).map((i) => resolveTithiName(i, lang)),
      nakshatra: range(27).map((i) => resolveNakshatraName(i, lang)),
      yoga: range(27).map((i) => resolveYogaName(i, lang)),
      karana: range(60).map((i) => resolveKaranaName(i, lang)),
      karanaType: range(60).map((i) => getKaranaType(i)),
      masa: range(12).map((i) => resolveMasaName(i, lang)),
      chandraMasa: range(12).map((i) => resolveChandraMasaName(i, lang)),
      chandraMasaAdhika: range(12).map((i) => resolveChandraMasaName(i, lang, true)),
    };
  }
  // `getTranslations` falls back to English for an unknown language, a
  // deliberate divergence from computeAyanamsa's rejection.
  out['unknown-language-falls-back'] = {
    tithi: range(30).map((i) => resolveTithiName(i, 'xx' as Language)),
  };
  return out;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function writeElementsGolden(): void {
  const { clean: boundary, signedZero } = partitionBySignedZero(elementBoundaryPairs());
  const sampleCases = [...elementPairs(ELEMENT_SEED, 40)];
  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/core/{tithi,nakshatra,yoga,karana}.ts, src/i18n/resolver.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'The four element modules and the seven name resolvers are bit-identical ' +
        'to the TypeScript. Unqualified, not bounded: the inputs are given ' +
        'longitudes and the arithmetic touches no transcendental, so the only ' +
        'thing this can catch is a transcription error.',
      sample:
        `ranqd1 seed ${ELEMENT_SEED >>> 0}, ${ELEMENT_SAMPLES} (moon, sun) pairs uniform on ` +
        `[0, 360), plus ${boundary.length} engineered span-boundary pairs and ` +
        `${signedZero.length} signed-zero pairs held out of the digest`,
      signedZero:
        'The held-out pairs are the ones where a TypeScript leaf is -0. Go has no ' +
        'signed zero in an int index and jsnum.Round does not preserve it, so those ' +
        'leaves are +0 in Go. They are pinned as a stated divergence rather than ' +
        'dropped; none is reachable from a normalize360-d longitude, and the ' +
        'asymmetry runs the safe way (Go +0 vs TS -0), which JSON.stringify erases ' +
        'while Go encoding/json would have written "-0".',
    },
    seed: ELEMENT_SEED >>> 0,
    samples: ELEMENT_SAMPLES,
    samplesShort: ELEMENT_SAMPLES_SHORT,
    digest: elementDigest(elementPairs(ELEMENT_SEED, ELEMENT_SAMPLES)),
    digestShort: elementDigest(elementPairs(ELEMENT_SEED, ELEMENT_SAMPLES_SHORT)),
    boundaryPairs: boundary,
    boundaryDigest: elementDigest(boundary),
    leafNames: ELEMENT_LEAF_NAMES,
    signedZeroPairs: signedZero,
    cases: elementCases(sampleCases),
    boundaryCases: elementCases(boundary.slice(0, 24)),
    resolvers: resolverTable(),
    spans: {
      TITHI_SPAN, NAKSHATRA_SPAN, NAKSHATRA_PADA_SPAN, YOGA_SPAN, KARANA_SPAN, RASHI_SPAN,
    },
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'core'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'core', 'elements-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote elements-golden.json (${ELEMENT_SAMPLES} pairs, ${boundary.length} boundary pairs, ` +
    `${signedZero.length} signed-zero pairs)\n`,
  );
}

// `types.JSDate`'s oracle is JavaScript itself. Four behaviours a port gets
// subtly wrong: the expanded `±YYYYYY` year form outside [0, 9999];
// `getUTCFullYear` / `getUTCDay` for NEGATIVE epoch milliseconds; `Date.UTC`,
// whose month is 0-based and which maps a year in [0, 99] to 1900+year; and
// `JSON.stringify(new Date(ms))`.

/** Built through `setUTCFullYear`: `Date.UTC` maps a year in [0, 99] to 1900+year. */
function yearMs(year: number, month: number, day: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month, day);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function jsDateInstants(): number[] {
  const fixed = [
    0, 1, -1, 999, -999, 1000, -1000,
    Date.UTC(1912, 5, 1), Date.UTC(2025, 0, 1), Date.UTC(2088, 5, 1),
    Date.UTC(1969, 11, 31, 23, 59, 59, 999),
    Date.UTC(1970, 0, 1), Date.UTC(1900, 0, 1), Date.UTC(2100, 11, 31, 23, 59, 59, 999),
    Date.UTC(2024, 1, 29, 12, 34, 56, 789),   // leap day
    Date.UTC(2016, 11, 31, 23, 59, 59, 999),  // the double before a leap second
    yearMs(1, 0, 1), yearMs(9, 5, 15), yearMs(50, 0, 1), yearMs(99, 11, 31),
    yearMs(100, 0, 1), yearMs(999, 11, 31), yearMs(0, 0, 1),
    8.64e15, -8.64e15,                        // the Date range limits: expanded years
    8.64e15 - 1, -8.64e15 + 1,
  ];
  const out = [...fixed];
  for (const v of uniform(0x0DA7E, 400, 4.2e12)) out.push(Math.trunc(v));
  return out;
}

function jsDateUtcCases(): [number, number, number][] {
  return [
    [2025, 0, 20], [2025, 2, 22], [1912, 5, 1], [2088, 5, 1],
    [2025, 12, 1],   // month rolls into the next year
    [2025, -1, 1],   // and backwards
    [2025, 0, 0],    // day 0 is the last day of the previous month
    [2025, 0, 32],   // and past the end rolls forward
    [50, 0, 1], [99, 11, 31], [0, 0, 1], [100, 0, 1], // the 1900+year mapping and its edges
    [-1, 0, 1], [-100, 6, 15],
  ];
}

function writeJsDateGolden(): void {
  const instants = jsDateInstants();
  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'JavaScript Date built-ins, this golden has no src/ counterpart',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'types.JSDate reproduces Date.prototype.toISOString, getUTCFullYear, ' +
        'getUTCDay, Date.UTC and JSON.stringify(date) exactly, including the ' +
        'expanded-year form, negative epoch milliseconds, component rollover and ' +
        "Date.UTC's 1900+year mapping for a year in [0, 99].",
      sample: `${instants.length} instants (fixed edges plus ranqd1 seed 0x0DA7E), ` +
        `${jsDateUtcCases().length} Date.UTC triples`,
    },
    instants: instants.map((ms) => ({
      ms,
      iso: new Date(ms).toISOString(),
      json: JSON.stringify(new Date(ms)),
      utcFullYear: new Date(ms).getUTCFullYear(),
      utcDay: new Date(ms).getUTCDay(),
    })),
    dateUtc: jsDateUtcCases().map(([y, m, d]) => ({
      year: y, month: m, day: d, ms: Date.UTC(y, m, d),
    })),
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'types'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'types', 'jsdate-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote jsdate-golden.json (${instants.length} instants, ${file.dateUtc.length} Date.UTC cases)\n`,
  );
}

// `computeChandraMasa` and `computeSamvat` reach the real ephemeris yet are
// still pinned as exact: both publish only indices, booleans and names gated
// on a threshold, with a margin of ~1e-8 s against the nearest boundary.

const CAL_LANGS: Language[] = ['en', 'hi'];
const CAL_SYSTEMS: MasaSystem[] = ['purnimanta', 'amanta'];
const siderealSunAt = (d: Date): number => getSiderealSunLongitude(d, 'lahiri');

function varaCases(): { dateMs: number; sunriseMs: number }[] {
  const out: { dateMs: number; sunriseMs: number }[] = [];
  const days = [
    Date.UTC(2025, 0, 1), Date.UTC(2025, 6, 15), Date.UTC(1912, 5, 1),
    Date.UTC(1969, 11, 31), Date.UTC(1970, 0, 1), Date.UTC(2088, 5, 1),
    Date.UTC(1900, 0, 1), Date.UTC(2100, 11, 31),
  ];
  for (const day of days) {
    const sunrise = day + 6 * 3600_000 + 17 * 60_000 + 42_000;
    // Before sunrise the weekday must roll back.
    for (const t of [day, day + 3 * 3600_000, sunrise - 1, sunrise, sunrise + 1, day + 20 * 3600_000]) {
      out.push({ dateMs: t, sunriseMs: sunrise });
    }
  }
  return out;
}

function chandraMasaInstants(): number[] {
  const out: number[] = [];
  // 2026 contains Adhika Jyeshtha, so both arms of `isAdhika` are reached.
  for (let d = 0; d < 366; d += 5) out.push(Date.UTC(2026, 0, 1) + d * 86_400_000);
  for (let d = 0; d < 60; d += 10) out.push(Date.UTC(1912, 5, 1) + d * 86_400_000);
  for (let d = 0; d < 60; d += 10) out.push(Date.UTC(2088, 5, 1) + d * 86_400_000);
  return out;
}

function samvatYears(): number[] {
  const out: number[] = [];
  for (let y = 1900; y <= 2100; y += 7) out.push(y);
  return out;
}

function writeCalendarGolden(): void {
  const vara = varaCases().map(({ dateMs, sunriseMs }) => ({
    dateMs, sunriseMs,
    byLang: Object.fromEntries(
      CAL_LANGS.map((lang) => [
        lang,
        computeVara(new Date(dateMs), new Date(sunriseMs), getTranslations(lang).varaNames),
      ]),
    ),
  }));

  // Without normalize360 the nudge below a boundary is -2.2e-16, on which the
  // TypeScript returns `{index: -1, name: undefined}` and pins a shape no caller
  // can reach.
  const longitudes: number[] = [];
  for (const span of [30, NAKSHATRA_SPAN]) {
    for (let k = 0; k * span < 360; k++) {
      const x = k * span;
      longitudes.push(x, x - Number.EPSILON * Math.max(x, 1), x + Number.EPSILON * Math.max(x, 1));
    }
  }
  for (const v of uniform(0xCA1E1, 600, 180)) longitudes.push(v + 180);
  for (let i = 0; i < longitudes.length; i++) longitudes[i] = normalize360(longitudes[i]!);

  const byLongitude = longitudes.map((lon) => ({
    lon,
    chandraRashi: computeChandraRashi(lon, (i) => resolveMasaName(i, 'en')),
    suryaNakshatra: computeSuryaNakshatra(lon, (i) => resolveNakshatraName(i, 'en')),
    masa: computeMasa(lon, (i) => resolveMasaName(i, 'en')),
    chandraRashiHi: computeChandraRashi(lon, (i) => resolveMasaName(i, 'hi')).name,
  }));

  const chandraMasa = chandraMasaInstants().flatMap((ms) =>
    CAL_SYSTEMS.flatMap((system) =>
      CAL_LANGS.map((lang) => ({
        ms, system, lang,
        result: computeChandraMasa(
          siderealSunAt(new Date(ms)),
          getSiderealMoonLongitude(new Date(ms), 'lahiri'),
          (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
          system,
          new Date(ms),
          siderealSunAt,
          boundingNewMoons,
        ),
      })),
    ),
  );

  const samvat = samvatYears().flatMap((year) => {
    const chaitra = chaitraNewMoon(year);
    return [chaitra - 1, chaitra, chaitra + 1, Date.UTC(year, 6, 1), Date.UTC(year, 0, 5)].map((ms) => ({
      year, chaitraMs: chaitra, ms, result: computeSamvat(new Date(ms)),
    }));
  });

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/core/{vara,rashi,masa,chandramasa,samvat}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'All five calendar-element modules are exact against the TypeScript, ' +
        'bit-identical numbers and identical strings, no bound. The two that ' +
        'reach the ephemeris publish indices, booleans and a quantised instant, ' +
        'each with a ~1e-8 s margin against the nearest boundary, so equality is ' +
        'the prediction rather than a lucky measurement.',
      sample:
        `${vara.length} vara cases, ${byLongitude.length} longitudes, ` +
        `${chandraMasa.length} chandramasa (instant x system x language), ` +
        `${samvat.length} samvat instants across ${samvatYears().length} years`,
    },
    vara,
    byLongitude,
    chandraMasa,
    samvat,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'core'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'core', 'calendar-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote calendar-golden.json (${vara.length} vara, ${byLongitude.length} longitudes, ` +
    `${chandraMasa.length} chandramasa, ${samvat.length} samvat)\n`,
  );
}

// The day/night triples are chosen so the division is awkward: a millisecond
// count not divisible by 8, 12 or 15 is where the "anchor the last slot's end
// to reference+duration" rule earns its place, and where a contracted
// `refMs + i*slotMs` would move a boundary by a whole millisecond.

function slotDayCases(): { name: string; sunrise: number; sunset: number; nextSunrise: number }[] {
  const d = (y: number, m: number, day: number, h: number, mi: number, s: number, ms: number): number =>
    Date.UTC(y, m, day, h, mi, s, ms);
  return [
    { name: 'pune-2025', sunrise: d(2025, 0, 14, 1, 32, 44, 172), sunset: d(2025, 0, 14, 12, 49, 3, 907), nextSunrise: d(2025, 0, 15, 1, 33, 1, 55) },
    { name: 'pune-1912', sunrise: d(1912, 5, 1, 0, 27, 11, 685), sunset: d(1912, 5, 1, 13, 37, 10, 168), nextSunrise: d(1912, 5, 2, 0, 27, 7, 412) },
    { name: 'pune-2088', sunrise: d(2088, 5, 1, 0, 27, 33, 1), sunset: d(2088, 5, 1, 13, 37, 44, 999), nextSunrise: d(2088, 5, 2, 0, 27, 29, 500) },
    { name: 'reykjavik-summer', sunrise: d(2025, 5, 21, 2, 55, 0, 1), sunset: d(2025, 5, 22, 0, 3, 0, 999), nextSunrise: d(2025, 5, 22, 2, 55, 30, 500) },
    { name: 'reykjavik-winter', sunrise: d(2025, 11, 21, 11, 22, 0, 333), sunset: d(2025, 11, 21, 15, 30, 0, 667), nextSunrise: d(2025, 11, 22, 11, 22, 30, 1) },
    { name: 'awkward-division', sunrise: 0, sunset: 40_031, nextSunrise: 86_401 },
    { name: 'negative-epoch', sunrise: d(1899, 11, 31, 6, 0, 0, 1), sunset: d(1899, 11, 31, 17, 59, 59, 998), nextSunrise: d(1900, 0, 1, 6, 0, 0, 997) },
  ];
}

function writeSlotsGolden(): void {
  const qualityFor = (lang: Language) => (q: ChoghadiyaQuality): string =>
    getTranslations(lang).qualityNames[q];

  const cases = slotDayCases().flatMap((c) =>
    [0, 1, 2, 3, 4, 5, 6].flatMap((vara) =>
      CAL_LANGS.map((lang) => {
        const t = getTranslations(lang);
        return {
          day: c.name, vara, lang,
          sunrise: c.sunrise, sunset: c.sunset, nextSunrise: c.nextSunrise,
          choghadiya: computeChoghadiya(
            new Date(c.sunrise), new Date(c.sunset), new Date(c.nextSunrise), vara,
            (i) => t.choghadiyaNames[i]!, qualityFor(lang),
          ),
          hora: computeHora(
            new Date(c.sunrise), new Date(c.sunset), new Date(c.nextSunrise), vara,
            (i) => t.grahaNames[i]!,
          ),
          gowri: computeGowriPanchangam(
            new Date(c.sunrise), new Date(c.sunset), new Date(c.nextSunrise), vara,
            (i) => t.gowriNames[i]!, qualityFor(lang),
          ),
          doGhati: computeDoGhati(
            new Date(c.sunrise), new Date(c.sunset), new Date(c.nextSunrise),
            (i) => t.doGhatiNames[i]!, qualityFor(lang),
          ),
        };
      }),
    ),
  );

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/core/{choghadiya,hora,gowri,doGhati}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'The four slot systems are bit-identical to the TypeScript: same instants ' +
        'to the millisecond, same indices, same names. buildEqualSlots was pinned ' +
        'bit-identical at G1.13, so what this adds is the four label tables and ' +
        'the weekday indexing into them.',
      sample: `${slotDayCases().length} day shapes x 7 weekdays x 2 languages = ${cases.length} cases`,
    },
    cases,
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'core', 'slots-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(`wrote slots-golden.json (${cases.length} cases)\n`);
}

/**
 * `FESTIVAL_REGISTRY` is module-private, so this pins the DISPATCH instead:
 * one grid per matcher arm, each varying only the two fields that arm reads.
 * Each context runs twice, nija and adhika, since `skip` and `shift-to-nija`
 * differ only on an adhika day.
 */
function writeFestivalDispatchGolden(): void {
  const name = (k: string): string => k;
  const rashiName = (i: number): string => `R${i}`;

  const base = (over: Partial<FestivalComputeContext>): FestivalComputeContext => ({
    tithiIndex: 0,
    nakshatraIndex: 0,
    chandraMasaIndex: 0,
    isAdhika: false,
    varaIndex: 0,
    solarMasaIndex: 0,
    ...over,
  });
  const run = (ctx: FestivalComputeContext): unknown[] =>
    computeFestivals(ctx, name, rashiName).map((f) => ({
      key: f.key, type: f.type, description: f.description ?? null,
    }));

  const cases: unknown[] = [];
  const add = (label: string, ctx: FestivalComputeContext): void => {
    cases.push({ label, festivals: run(ctx) });
  };

  for (const isAdhika of [false, true]) {
    const a = isAdhika ? 'A' : 'N';
    for (let masa = 0; masa < 12; masa++) {
      for (let tithi = 0; tithi < 30; tithi++) {
        add(`${a}|mt|${masa}|${tithi}`, base({
          chandraMasaIndex: masa, tithiIndex: tithi, isAdhika,
          // The other two discriminators are parked on values no registry rule uses
          // (nakshatra 26 Revati, vara 3), so this grid cannot satisfy another arm.
          nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11,
        }));
      }
    }
    for (let masa = 0; masa < 12; masa++) {
      for (let vara = 0; vara < 7; vara++) {
        add(`${a}|mv|${masa}|${vara}`, base({
          chandraMasaIndex: masa, varaIndex: vara, isAdhika,
          tithiIndex: 9, nakshatraIndex: 26, solarMasaIndex: 11,
        }));
      }
    }
    for (let masa = 0; masa < 12; masa++) {
      for (let nak = 0; nak < 27; nak++) {
        add(`${a}|mn|${masa}|${nak}`, base({
          chandraMasaIndex: masa, nakshatraIndex: nak, isAdhika,
          tithiIndex: 9, varaIndex: 3, solarMasaIndex: 11,
        }));
      }
    }
    for (let sm = 0; sm < 12; sm++) {
      for (let nak = 0; nak < 27; nak++) {
        add(`${a}|sn|${sm}|${nak}`, base({
          solarMasaIndex: sm, nakshatraIndex: nak, isAdhika,
          tithiIndex: 9, varaIndex: 3, chandraMasaIndex: 8,
        }));
      }
    }
  }

  // Varamahalakshmi's tithiRange gate: the grids above park tithi inside the
  // window, so without a sweep across its edges a dropped gate would pass.
  for (let tithi = 0; tithi < 30; tithi++) {
    cases.push({
      label: `range|${tithi}`,
      festivals: run(base({ chandraMasaIndex: 4, varaIndex: 5, tithiIndex: tithi, nakshatraIndex: 26, solarMasaIndex: 11 })),
    });
  }

  const KALA_RULES: FestivalDateRule[] = [
    'madhyahna', 'aparahna', 'aparahna-full', 'pradosha', 'nishita', 'chandrodaya',
  ];
  for (const rule of KALA_RULES) {
    for (const end of [2, 3, 12, 18, 27, 28, 9]) {
      for (const start of [undefined, end, (end + 29) % 30]) {
        for (const prior of [undefined, end, (end + 1) % 30]) {
          const ctx = base({
            chandraMasaIndex: 6, tithiIndex: end, nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11,
            tithiByRule: { [rule]: end },
            ...(start === undefined ? {} : { tithiByRuleStart: { [rule]: start } }),
            ...(prior === undefined ? {} : { priorDayTithiByRule: { [rule]: prior } }),
          });
          cases.push({
            label: `kala|${rule}|${end}|${start ?? 'x'}|${prior ?? 'x'}`,
            festivals: run(ctx),
          });
        }
      }
    }
  }

  // Vijayadashami's aparahna-full ladder needs yesterday's START too, which no
  // other rule reads.
  for (const s0 of [9, 10]) for (const e0 of [9, 10]) for (const s1 of [9, 10]) for (const e1 of [9, 10]) {
    cases.push({
      // The separators are load-bearing: `9` and `10` concatenate ambiguously, and
      // `91099` reads as both (9,10,9,9) and (9,1,0,9,9).
      label: `af|${s0}-${e0}-${s1}-${e1}`,
      festivals: run(base({
        chandraMasaIndex: 6, tithiIndex: 9, nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11,
        tithiByRuleStart: { aparahna: s0 }, tithiByRule: { aparahna: e0 },
        priorDayTithiByRuleStart: { aparahna: s1 }, priorDayTithiByRule: { aparahna: e1 },
      })),
    });
  }

  for (const onDay of [true, false]) {
    for (let bits = 0; bits < 16; bits++) {
      cases.push({
        label: `jn|${onDay ? 'u' : 'o'}|${bits}`,
        festivals: run(base({
          chandraMasaIndex: 5, tithiIndex: onDay ? 22 : 21,
          nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11,
          janmashtamiNishita: {
            ashtamiAtNishita: (bits & 1) !== 0,
            rohiniAtNishita: (bits & 2) !== 0,
            nextDayClaims: (bits & 4) !== 0,
            prevDayClaimed: (bits & 8) !== 0,
          },
        })),
      });
    }
  }

  const EK_FLAGS = [
    'ekadashiDashamiViddha', 'vaishnavaDwadashiToday', 'ekadashiKshayaToday',
    'ekadashiGaunaToday', 'ekadashiVriddhaDwadashiToday', 'ekadashiVriddhaDwadashiTomorrow',
    'ekadashiTrisprishaToday', 'ekadashiTrisprishaYesterday', 'ekadashiVriddhaFirstDay',
  ] as const;
  for (const tithi of [9, 10, 11, 24, 25, 26]) {
    for (const masa of [0, 5, 11]) {
      for (const isAdhika of [false, true]) {
        cases.push({
          label: `ek|${tithi}|${masa}|${isAdhika ? 'A' : 'N'}|none`,
          festivals: run(base({ tithiIndex: tithi, chandraMasaIndex: masa, isAdhika, nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11 })),
        });
        for (const flag of EK_FLAGS) {
          cases.push({
            label: `ek|${tithi}|${masa}|${isAdhika ? 'A' : 'N'}|${flag}`,
            festivals: run(base({
              tithiIndex: tithi, chandraMasaIndex: masa, isAdhika,
              nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11, [flag]: true,
            })),
          });
        }
      }
    }
  }

  const REGIONS = [
    'all', 'tamil-nadu', 'kerala', 'karnataka', 'andhra-pradesh', 'telangana',
    'west-bengal', 'odisha', 'assam', 'bihar', 'jharkhand', 'gujarat',
    'maharashtra', 'punjab', 'haryana', 'himachal-pradesh', 'uttarakhand', 'nepal',
  ] as const;
  for (const region of REGIONS) {
    for (let rashi = 0; rashi < 12; rashi++) {
      cases.push({
        label: `sk|${region}|${rashi}`,
        festivals: run(base({
          tithiIndex: 9, nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11,
          chandraMasaIndex: 8, region, sankrantiRashi: rashi,
        })),
      });
      cases.push({
        label: `skn|${region}|${rashi}`,
        festivals: run(base({
          tithiIndex: 9, nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11,
          chandraMasaIndex: 8, region, nextDaySankrantiRashi: rashi, prevDaySankrantiRashi: rashi,
        })),
      });
    }
    for (const flag of ['vaisakhiToday', 'vishuToday', 'pohelaBoishakhToday'] as const) {
      cases.push({
        label: `ny|${region}|${flag}`,
        festivals: run(base({
          tithiIndex: 9, nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11,
          chandraMasaIndex: 8, region, [flag]: true,
        })),
      });
    }
  }

  // Masik Karthigai's any-time-in-day set, the Purnimanta description and the
  // Bhadra notice are the three context fields nothing above touches.
  cases.push({
    label: 'extra|krittika-in-day',
    festivals: run(base({
      tithiIndex: 9, nakshatraIndex: 5, varaIndex: 3, solarMasaIndex: 11,
      chandraMasaIndex: 8, nakshatraIndicesInDay: new Set([2, 14]),
    })),
  });
  cases.push({
    label: 'extra|purnimanta-naming',
    festivals: run(base({
      tithiIndex: 14, chandraMasaIndex: 7, nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11,
      amantaMasaName: 'Kartika', purnimantaMasaName: 'Margashirsha',
    })),
  });
  cases.push({
    label: 'extra|bhadra-notice',
    festivals: run(base({
      tithiIndex: 14, chandraMasaIndex: 4, nakshatraIndex: 26, varaIndex: 3, solarMasaIndex: 11,
      tithiByRule: { aparahna: 14 },
      bhadra: { start: new Date(Date.UTC(2026, 7, 28, 3, 0)), end: new Date(Date.UTC(2026, 7, 28, 9, 30)) },
      formatClock: (d: Date) => d.toISOString().slice(11, 16),
    })),
  });

  const emitted = new Set<string>();
  for (const c of cases as { festivals: { key: string }[] }[]) {
    for (const f of c.festivals) emitted.add(f.key);
  }

  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'core', 'festivals-golden.json'),
    `${JSON.stringify({
      _meta: {
        generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
        source: 'src/core/festivals.ts',
        claim:
          'computeFestivals emits the same festivals for the same context. The four ' +
          'grids vary exactly the fields one matcher arm reads, so a rule filed under ' +
          'the wrong D8 Kind fires under the wrong grid or not at all. FESTIVAL_REGISTRY ' +
          'is module-private and cannot be pinned directly; this pins the dispatch over it.',
        cases: cases.length,
        distinctKeysEmitted: emitted.size,
      },
      cases,
    }, null, 1)}\n`,
  );
  console.log(`wrote festivals-golden.json (${cases.length} contexts, ${emitted.size} distinct keys)`);
}

/**
 * Key order read off REAL RESULTS: `JSON.stringify` follows the object literal,
 * which is not the interface's declaration order. The gate fails both ways.
 */
function writeKeyOrderGolden(): void {
  const t = getTranslations('en');
  const qualityFn = (q: ChoghadiyaQuality): string => t.qualityNames[q]!;
  const sunrise = Date.UTC(2025, 0, 14, 1, 32, 44, 172);
  const sunset = Date.UTC(2025, 0, 14, 12, 49, 3, 907);
  const nextSunrise = Date.UTC(2025, 0, 15, 1, 33, 1, 55);

  const unlocalized: Record<string, string[]> = {
    TithiInfo: Object.keys(computeTithiFromLongitudes(100, 40, 'n', 'p')),
    NakshatraInfo: Object.keys(computeNakshatraFromLongitude(100, 'n')),
    YogaInfo: Object.keys(computeYogaFromLongitudes(100, 40, 'n')),
    KaranaInfo: Object.keys(computeKaranaFromLongitudes(100, 40, 'n')),
    VaraInfo: Object.keys(computeVara(new Date(sunrise), new Date(sunrise), t.varaNames)),
    RashiInfo: Object.keys(computeChandraRashi(100, () => 'n')),
    NakshatraIndexInfo: Object.keys(computeSuryaNakshatra(100, () => 'n')),
    MasaInfo: Object.keys(computeMasa(100, () => 'n')),
    SamvatInfo: Object.keys(computeSamvat(new Date(sunrise))),
    UnlocalizedChoghadiyaInfo: Object.keys(
      computeChoghadiya(new Date(sunrise), new Date(sunset), new Date(nextSunrise), 2, (i) => t.choghadiyaNames[i]!, qualityFn),
    ),
    UnlocalizedChoghadiyaSlot: Object.keys(
      computeChoghadiya(new Date(sunrise), new Date(sunset), new Date(nextSunrise), 2, (i) => t.choghadiyaNames[i]!, qualityFn).day[0]!,
    ),
    UnlocalizedHoraSlot: Object.keys(
      computeHora(new Date(sunrise), new Date(sunset), new Date(nextSunrise), 2, (i) => t.grahaNames[i]!).day[0]!,
    ),
    UnlocalizedGowriSlot: Object.keys(
      computeGowriPanchangam(new Date(sunrise), new Date(sunset), new Date(nextSunrise), 2, (i) => t.gowriNames[i]!, qualityFn).day[0]!,
    ),
    UnlocalizedDoGhatiSlot: Object.keys(
      computeDoGhati(new Date(sunrise), new Date(sunset), new Date(nextSunrise), (i) => t.doGhatiNames[i]!, qualityFn).day[0]!,
    ),
    UtcWindow: Object.keys(computeRahuKalam(new Date(sunrise), new Date(sunset), 2)),
    UnlocalizedDurMuhurtaPeriod: Object.keys(
      computeDurMuhurta(new Date(sunrise), new Date(sunset), new Date(nextSunrise), 2)[0]!,
    ),
    AnandadiYogaInfo: Object.keys(computeAnandadiYoga(0, 0, 'en')),
    // Both arms: the inactive one carries only `active`.
    GandaMulaInfoInactive: Object.keys(computeGandaMula(1, 'en')),
    GandaMulaInfoActive: Object.keys(computeGandaMula(18, 'en')),
  };

  const ref = new Date(Date.UTC(2025, 0, 14));
  unlocalized['ChandraMasaInfo'] = Object.keys(
    computeChandraMasa(
      siderealSunAt(ref), getSiderealMoonLongitude(ref, 'lahiri'),
      (i) => t.chandraMasaNames[i]!, 'purnimanta', ref, siderealSunAt, boundingNewMoons,
    ),
  );

  const pune = { latitude: 18.5204, longitude: 73.8567 };
  const when = new Date(Date.UTC(2025, 0, 14, 6, 0, 0));
  const daily = getDailyPanchang(when, pune, { timezone: 330 });
  if (daily === null) throw new Error('key-order golden: daily panchang was null');
  const bareDaily = getDailyPanchang(when, pune, { timezone: 330, computeEndTimes: false });
  if (bareDaily === null) throw new Error('key-order golden: bare daily panchang was null');
  // `zone` is absent for a numeric offset, so a named zone is needed to reach it.
  const namedTzDaily = getDailyPanchang(when, { latitude: 40.7128, longitude: -74.006 },
    { timezone: 'America/New_York' });
  if (namedTzDaily === null) throw new Error('key-order golden: named-tz panchang was null');
  const instant = getInstantPanchang(when, pune);
  if (instant === null) throw new Error('key-order golden: instant panchang was null');

  const published: Record<string, string[]> = {
    ChoghadiyaInfo: Object.keys(daily.periods.choghadiya),
    ChoghadiyaSlot: Object.keys(daily.periods.choghadiya.day[0]!),
    HoraInfo: Object.keys(daily.periods.hora),
    HoraSlot: Object.keys(daily.periods.hora.day[0]!),
    GowriInfo: Object.keys(daily.periods.gowri),
    GowriSlot: Object.keys(daily.periods.gowri.day[0]!),
    DoGhatiInfo: Object.keys(daily.muhurtas.doGhati),
    DoGhatiSlot: Object.keys(daily.muhurtas.doGhati.day[0]!),
    TimePeriod: Object.keys(daily.muhurtas.brahma),
    DailyTithiInfo: Object.keys(daily.angas.tithis[0]!),
    DailyNakshatraInfo: Object.keys(daily.angas.nakshatras[0]!),
    DailyYogaInfo: Object.keys(daily.angas.yogas[0]!),
    DailyKaranaInfo: Object.keys(daily.angas.karanas[0]!),
    DailyPanchangResult: Object.keys(daily),
    DailySun: Object.keys(daily.sun),
    DailyMoon: Object.keys(daily.moon),
    DailyAngas: Object.keys(daily.angas),
    DailyCalendarLabels: Object.keys(daily.calendar),
    MuhurtaWindows: Object.keys(daily.muhurtas),
    InauspiciousWindows: Object.keys(daily.inauspicious),
    DayPeriods: Object.keys(daily.periods),
    ResolvedTimezoneOffset: Object.keys(daily.timezone),
    ResolvedTimezoneNamed: Object.keys(namedTzDaily.timezone),
    InstantPanchangResult: Object.keys(instant),
    SunPosition: Object.keys(instant.sun),
    MoonPosition: Object.keys(instant.moon),
    InstantAngas: Object.keys(instant.angas),
    CalendarLabels: Object.keys(instant.calendar),
    InstantInauspicious: Object.keys(instant.inauspicious),
    DurMuhurtaPeriod: Object.keys(daily.inauspicious.durMuhurta[0]!),
    PanchakaInfoInactive: Object.keys({ active: false }),
    PanchakaInfoActive: Object.keys(
      daily.inauspicious.panchakaInfo.active
        ? daily.inauspicious.panchakaInfo
        : { active: true, type: 'samanya', name: '', isDosha: false, onsetVara: 3 },
    ),
  };

  const chartWhen = new Date(Date.parse('1995-08-15T05:30:00.000Z'));
  const chartLoc = { latitude: 28.6139, longitude: 77.209 };
  const chartPositions = computePlanetaryPositions(chartWhen, 'lahiri');
  const chartLagna = computeLagna(chartWhen, chartLoc, 'lahiri', 'en');
  published['PlanetaryPositions'] = Object.keys(chartPositions);
  published['GrahaPosition'] = Object.keys(chartPositions.sun);
  published['LagnaInfo'] = Object.keys(chartLagna);
  published['LagnaNakshatra'] = Object.keys(chartLagna.nakshatra);
  published['SripatiLagnaInfo'] = Object.keys(
    computeSripatiLagna(chartWhen, chartLoc, 'lahiri', 'en', { includeCusps: true }),
  );

  const chartBhava = computeBhava(chartWhen, chartLoc, { houseSystem: 'placidus-kp' });
  const chartD1 = computeRashiChart(chartWhen, chartLoc);
  const chartD9 = computeNavamsa(chartWhen, chartLoc);
  published['BhavaChart'] = Object.keys(chartBhava);
  published['HouseInfo'] = Object.keys(chartBhava.houses[0]!);
  published['BirthChart'] = Object.keys(chartD1);
  published['PlanetPlacement'] = Object.keys(chartD1.planets[0]!);
  published['PlanetsByGraha'] = Object.keys(chartD1.byPlanet);
  published['DivisionalChart'] = Object.keys(chartD9);

  const rulesAv = computeAshtakavarga(chartD1, { reductions: true });
  const rulesArgala = computeArgala(chartD1, { includeTrikonargala: true })[0]!;
  const rulesMangal = computeMangalDosha(chartD1);
  published['AshtakavargaResult'] = Object.keys(rulesAv);
  published['BhinnashtakaByGraha'] = Object.keys(rulesAv.bhinnashtaka);
  published['AshtakavargaReduced'] = Object.keys(rulesAv.reduced!);
  published['JaiminiKarakas'] = Object.keys(computeJaiminiKarakas(chartD1));
  published['Jaimini8Karakas'] = Object.keys(computeJaiminiKarakas(chartD1, { variant: '8-jaimini' }));
  published['ArgalaPerBhava'] = Object.keys(rulesArgala);
  published['ArgalaTrikona'] = Object.keys(rulesArgala.trikona!);
  published['Arudha'] = Object.keys(computeArudhas(chartD1)[0]!);
  published['MangalDoshaInfo'] = Object.keys(rulesMangal);
  published['MangalReference'] = Object.keys(rulesMangal.fromLagna);
  published['MangalCompatibility'] = Object.keys(computeMangalCompatibility(chartD1, chartD1));
  published['KaalSarpDoshaInfo'] = Object.keys(computeKaalSarp(chartD1));
  published['PitruDoshaInfo'] = Object.keys(computePitruDosha(chartD1));

  // Both arms: `veto` is ABSENT on a passing koot rather than false.
  const koMoonA = { rashi: 0, nakshatra: 0 };
  const koMoonB = { rashi: 7, nakshatra: 17 };   // vedha partners: reaches a veto
  const koAsht = computeAshtakoot(koMoonA, koMoonB);
  const koPathu = computePathuPorutham(koMoonA, koMoonB);
  published['AshtakootResult'] = Object.keys(koAsht);
  published['KootScore'] = Object.keys(koAsht.koots[0]!);
  published['PathuPoruthamResult'] = Object.keys(koPathu);
  published['PoruthamScoreWithVeto'] = Object.keys(koPathu.poruthams.find((p) => p.veto === true)!);
  published['PoruthamScore'] = Object.keys(koPathu.poruthams.find((p) => p.veto === undefined)!);

  // `bhanga` is ABSENT on most yogas, which is two key sequences.
  const koShadbala = computeShadbala(chartWhen, chartLoc);
  const koYogas = computeYogas(chartD1, { navamsa: chartD9 });
  const koBhangaWhen = new Date(2823780783177);
  const koBhangaLoc = { latitude: -33.8688, longitude: 151.2093 };
  const koBhangaChart = computeRashiChart(koBhangaWhen, koBhangaLoc);
  const koBhangaYogas = computeYogas(koBhangaChart, {
    navamsa: computeNavamsa(koBhangaWhen, koBhangaLoc),
  });
  const koYogaWithBhanga = koBhangaYogas.find((y) => y.bhanga !== undefined);
  const koYogaWithout = koYogas.find((y) => y.bhanga === undefined);
  published['PlanetShadbala'] = Object.keys(koShadbala.Sun);
  published['ShadbalaResult'] = Object.keys(koShadbala);
  published['BhavaBalaResult'] = Object.keys(computeBhavaBala(chartWhen, chartLoc));
  published['BhavaBalaPerHouse'] = Object.keys(computeBhavaBala(chartWhen, chartLoc).houses[0]!);
  if (!koYogaWithout) throw new Error('key-order golden: no yoga without a bhanga block');
  published['Yoga'] = Object.keys(koYogaWithout);
  if (koYogaWithBhanga) {
    published['YogaWithBhanga'] = Object.keys(koYogaWithBhanga);
    published['YogaBhanga'] = Object.keys(koYogaWithBhanga.bhanga!);
  } else {
    throw new Error(
      'key-order golden: the bhanga sample chart no longer matches a ' +
      'bhanga-carrying yoga; pick another instant rather than leaving ' +
      'YogaWithBhanga unpinned',
    );
  }
  // The `argala` default arm has NO `trikona` key at all, a different shape from
  // one whose `trikona` is null.
  published['ArgalaPerBhavaWithoutTrikona'] = Object.keys(computeArgala(chartD1)[0]!);
  published['AshtakavargaResultWithoutReduced'] = Object.keys(computeAshtakavarga(chartD1));

  // `AntarDasha` and `PratyantarDasha` carry the same three keys but are
  // distinct types, so both are recorded.
  const koDashaWhen = new Date(Date.UTC(1990, 5, 15, 10, 30));
  const koDashaLoc = { latitude: 18.5204, longitude: 73.8567 };
  const koVim = computeVimshottariDashaFromBirth(koDashaWhen);
  published['VimshottariDashaResult'] = Object.keys(koVim);
  published['MahaDasha'] = Object.keys(koVim.mahaDashas[0]!);
  // The SECOND mahadasha: the first is the clipped balance, whose antardasha
  // list can be as short as one entry.
  published['AntarDasha'] = Object.keys(koVim.mahaDashas[1]!.antarDashas[0]!);
  published['PratyantarDasha'] = Object.keys(
    computeVimshottariPratyantar(koVim.mahaDashas[1]!.antarDashas[0]!)[0]!,
  );
  const koYogini = computeYoginiDasha(koDashaWhen, getSiderealMoonLongitude(koDashaWhen, 'lahiri'));
  published['YoginiDashaResult'] = Object.keys(koYogini);
  published['YoginiMahaDasha'] = Object.keys(koYogini.mahaDashas[0]!);
  published['YoginiAntarDasha'] = Object.keys(koYogini.mahaDashas[0]!.antarDashas[0]!);
  const koChara = computeCharaDasha(koDashaWhen, koDashaLoc);
  published['CharaDashaResult'] = Object.keys(koChara);
  published['CharaMahaDasha'] = Object.keys(koChara.mahaDashas[0]!);
  const koNarayan = computeNarayanDasha(koDashaWhen, koDashaLoc);
  published['NarayanDashaResult'] = Object.keys(koNarayan);
  published['NarayanMahaDasha'] = Object.keys(koNarayan.mahaDashas[0]!);

  // `computeSadeSati` returns from TWO object literals, one per arm.
  const koSadeActive = computeSadeSati(0, new Date(Date.UTC(1943, 6, 1)));
  const koSadeInactive = computeSadeSati(6, new Date(Date.UTC(1943, 6, 1)));
  if (!koSadeActive.active || koSadeInactive.active) {
    throw new Error(
      'key-order golden: the Sade Sati arms are no longer one active and one ' +
      'inactive; pick another instant rather than pinning the same arm twice',
    );
  }
  published['SadeSatiInfo'] = Object.keys(koSadeActive);
  published['SadeSatiInfoInactive'] = Object.keys(koSadeInactive);

  // `makeUpagrahaPos` builds every position, so one sample answers for all.
  const koUpa = computeUpagrahas(new Date(Date.UTC(1995, 7, 15, 5, 30)), CHART_LOCS[0]!);
  published['Upagrahas'] = Object.keys(koUpa);
  published['UpagrahaPosition'] = Object.keys(koUpa.gulika);

  // `sahams` key order is `ALL_SAHAM_NAMES`, not the type declaration's.
  const koVarsha = computeVarshaphala(new Date(Date.UTC(1995, 7, 15, 5, 30)), 30, CHART_LOCS[0]!);
  published['VarshaphalaChart'] = Object.keys(koVarsha);
  published['MunthaInfo'] = Object.keys(koVarsha.muntha);
  published['Sahams'] = Object.keys(koVarsha.sahams);
  published['SahamPosition'] = Object.keys(koVarsha.sahams.Punya);

  // `KpByHouse`'s keys are NUMBERS: JavaScript lists integer-like keys in
  // ascending numeric order while Go's `encoding/json` sorts map keys as strings.
  const koKpChart = computeRashiChart(new Date(CHART_EVENTS[0]!.ms), CHART_EVENTS[0]!.loc);
  const koKpCuspal = computeKpCuspalSubLords(new Date(CHART_EVENTS[0]!.ms), CHART_EVENTS[0]!.loc);
  const koKpSig = computeKpSignificators(koKpChart);
  published['KpCuspalSubLords'] = Object.keys(koKpCuspal);
  published['KpSubLordInfo'] = Object.keys(koKpCuspal.cusps[0]!);
  published['KpSignificators'] = Object.keys(koKpSig);
  published['KpByPlanet'] = Object.keys(koKpSig.byPlanet);
  published['KpByHouse'] = Object.keys(koKpSig.byHouse);
  published['TithiPraveshaChart'] = Object.keys(
    computeTithiPravesha(new Date(Date.UTC(1995, 7, 15, 5, 30)), 30, CHART_LOCS[0]!));

  // The `computeEndTimes: false` arm must emit the same key order as the
  // end-times path, checkable only on this side.
  for (const field of ['tithis', 'nakshatras', 'yogas', 'karanas'] as const) {
    const on = Object.keys(daily.angas[field][0]!).join(',');
    const off = Object.keys(bareDaily.angas[field][0]!).join(',');
    if (on !== off) {
      throw new Error(
        `key-order golden: angas.${field} serializes differently with computeEndTimes ` +
        `off (the two arms have diverged again)\n  on:  ${on}\n  off: ${off}`,
      );
    }
  }

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'the object literals themselves, via Object.keys on real results',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'D6: JSON key order is an invariant of the parity diff, and Go gets it ' +
        'from struct declaration order. These are the orders JSON.stringify ' +
        'actually produces, insertion order, i.e. the object literal, which for ' +
        'several of these is NOT the interface declaration order.',
    },
    unlocalized,
    published,
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'core', 'keyorder-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote keyorder-golden.json (${Object.keys(unlocalized).length} unlocalized, ` +
    `${Object.keys(published).length} published shapes)\n`,
  );
}

// The Dur Muhurta rows are ragged (Tuesday alone has a night window) and the
// Panchaka type table has two weekdays deliberately unnamed.

function writeWindowsGolden(): void {
  const inauspicious = slotDayCases().flatMap((c) =>
    [0, 1, 2, 3, 4, 5, 6].map((vara) => ({
      day: c.name, vara, sunrise: c.sunrise, sunset: c.sunset, nextSunrise: c.nextSunrise,
      rahu: computeRahuKalam(new Date(c.sunrise), new Date(c.sunset), vara),
      gulika: computeGulikaKalam(new Date(c.sunrise), new Date(c.sunset), vara),
      yamaganda: computeYamaganda(new Date(c.sunrise), new Date(c.sunset), vara),
      durMuhurta: computeDurMuhurta(
        new Date(c.sunrise), new Date(c.sunset), new Date(c.nextSunrise), vara,
      ),
    })),
  );

  const gandaMula = CAL_LANGS.flatMap((lang) =>
    range(27).map((n) => ({ nakshatra: n, lang, info: computeGandaMula(n, lang) })),
  );

  const anandadi = CAL_LANGS.flatMap((lang) =>
    [0, 1, 2, 3, 4, 5, 6].flatMap((vara) =>
      range(27).map((n) => ({ vara, nakshatra: n, lang, info: computeAnandadiYoga(vara, n, lang) })),
    ),
  );

  const panchakaTypes = [0, 1, 2, 3, 4, 5, 6].map((vara) => ({
    vara, type: classifyPanchaka(vara), isDosha: isPanchakaDosha(classifyPanchaka(vara)),
  }));

  const panchakaFlags = [
    0, 100, 299, 299.999999, 300, 300.000001, 330, 359.999999,
    ...[...uniform(0xB0BCAFE, 200, 180)].map((v) => v + 180),
  ].map((lon) => ({ lon, active: computePanchaka(lon) }));

  const moonAt = (d: Date): number => getSiderealMoonLongitude(d, 'lahiri');
  const rahita: unknown[] = [];
  const onsets: unknown[] = [];
  const BASE = Date.UTC(2025, 0, 14, 1, 32, 44, 172);
  for (let i = 0; i < 90; i++) {
    const sunrise = new Date(BASE + i * 86_400_000);
    const nextSunrise = new Date(BASE + (i + 1) * 86_400_000);
    const windows = computePanchakaRahita(sunrise, nextSunrise, moonAt);
    rahita.push({
      i, sunrise: sunrise.getTime(), nextSunrise: nextSunrise.getTime(),
      windows: windows.map((w) => ({ start: w.start.getTime(), end: w.end.getTime() })),
    });
    const onset = findPanchakaOnset(sunrise, moonAt);
    onsets.push({ i, sunrise: sunrise.getTime(), onset: onset === null ? null : onset.getTime() });
  }

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source:
        'src/core/{inauspicious,durMuhurta,gandaMula,anandadiYoga,panchaka,panchakaRahita}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'The table-and-arithmetic windows are bit-identical. The two ' +
        'ephemeris-backed instants (panchaka onset, panchaka-rahita crossings) ' +
        'are asserted against the parity gate\'s 1 ms published-instant band; the ' +
        'prediction is that they measure as equalities, because every probe is ' +
        'evaluated at a whole millisecond.',
      sample:
        `${inauspicious.length} inauspicious/durMuhurta cases, ${gandaMula.length} ganda mula, ` +
        `${anandadi.length} anandadi, ${rahita.length} panchaka-rahita days`,
    },
    inauspicious, gandaMula, anandadi, panchakaTypes, panchakaFlags, rahita, onsets,
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'core', 'windows-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote windows-golden.json (${inauspicious.length} inauspicious, ${gandaMula.length} gandaMula, ` +
    `${anandadi.length} anandadi, ${rahita.length} rahita days)\n`,
  );
}

// These solve for published instants over the real Moon, so they get the 1 ms
// band. Bhadra is the most demanding: four solves plus a 24-point scan.

function writeBigWindowsGolden(): void {
  const moonAt = (d: Date): number => getSiderealMoonLongitude(d, 'lahiri');
  const sunAt = (d: Date): number => getSiderealSunLongitude(d, 'lahiri');
  const BASE = Date.UTC(2026, 0, 14, 1, 32, 44, 172);
  const locName = (k: 'earth' | 'heaven' | 'paatal'): string =>
    getTranslations('en').bhadraLocationNames[k];

  // The span must be this long to reach a multi-segment vasa: the piecewise walk
  // needs the Moon to change rashi inside a window of 17 h or less, and a
  // four-month sample produces zero of them.
  const days: unknown[] = [];
  for (let i = 0; i < 400; i++) {
    const sunrise = new Date(BASE + i * 86_400_000);
    const nextSunrise = new Date(BASE + (i + 1) * 86_400_000);
    const bhadra = computeBhadraKaal(sunrise, nextSunrise, moonAt, sunAt, locName);
    days.push({
      i,
      sunrise: sunrise.getTime(),
      nextSunrise: nextSunrise.getTime(),
      bhadra: bhadra === null ? null : {
        start: bhadra.start.getTime(),
        end: bhadra.end.getTime(),
        location: bhadra.location,
        locationName: bhadra.locationName,
        isActive: bhadra.isActive,
        vasa: bhadra.vasa.map((v) => ({
          start: v.start.getTime(), end: v.end.getTime(),
          location: v.location, locationName: v.locationName,
        })),
      },
      varjyam: computeVarjyamWindows(sunrise, nextSunrise, moonAt)
        .map((w) => ({ start: w.start.getTime(), end: w.end.getTime() })),
      // `computeVarjyam` is the older single-window primitive: it reads only the
      // sunrise nakshatra, and it gates on overlap rather than on the start falling
      // inside the day.
      nakshatraIndex: getNakshatraIndexAtTime(sunrise, moonAt),
      varjyamSingle: ((w) => (w === null ? null : { start: w.start.getTime(), end: w.end.getTime() }))(
        computeVarjyam(getNakshatraIndexAtTime(sunrise, moonAt), sunrise, nextSunrise, moonAt),
      ),
      amritKala: computeAmritKalaWindows(sunrise, nextSunrise, moonAt)
        .map((w) => ({ start: w.start.getTime(), end: w.end.getTime() })),
    });
  }

  // Awkward day shapes, so the divisions by 15 and 30 do not divide evenly.
  const win = (w: { start: Date; end: Date } | null): unknown =>
    w === null ? null : { start: w.start.getTime(), end: w.end.getTime() };
  const muhurtas = slotDayCases().flatMap((c) =>
    [undefined, 0, 1, 2, 3, 4, 5, 6].map((vara) => ({
      day: c.name, vara: vara ?? null,
      sunrise: c.sunrise, sunset: c.sunset, nextSunrise: c.nextSunrise,
      abhijit: win(computeAbhijitMuhurta(new Date(c.sunrise), new Date(c.sunset), vara)),
      brahma: win(computeBrahmaMuhurta(new Date(c.sunrise), new Date(c.sunset))),
      vijaya: win(computeVijayaMuhurta(new Date(c.sunrise), new Date(c.sunset))),
      godhuli: win(computeGodhuliMuhurta(new Date(c.sunset))),
      nishita: win(computeNishitaMuhurta(new Date(c.sunset), new Date(c.nextSunrise))),
      madhyahna: win(computeMadhyahna(new Date(c.sunrise), new Date(c.sunset))),
      pratahSandhya: win(computePratahSandhya(
        new Date(c.sunrise), new Date(c.sunset), new Date(c.nextSunrise))),
      sayahnaSandhya: win(computeSayahnaSandhya(new Date(c.sunset), new Date(c.nextSunrise))),
    })),
  );

  // Storing every firing would be a 15 MB golden, so a digest plus per-type
  // counts and a few samples stands in.
  const yogaHash = createHash('sha256');
  const perType = new Map<string, number>();
  const samples: unknown[] = [];
  const sampleQuota = new Map<string, number>();
  let yogaCount = 0;
  let yogaFirings = 0;
  for (let vara = 0; vara < 7; vara++) {
    for (let tithi = 0; tithi < 30; tithi++) {
      for (let nak = 0; nak < 27; nak++) {
        for (let sunNak = 0; sunNak < 27; sunNak++) {
          const r = computeSpecialYogas(vara, tithi, nak, sunNak, (t) => `name:${t}`);
          yogaHash.update(`${vara},${tithi},${nak},${sunNak}|${r.length}|`);
          for (const y of r) yogaHash.update(`${y.type}=${y.name};`);
          if (r.length > 0) {
            yogaFirings++;
            yogaCount += r.length;
            for (const y of r) {
              perType.set(y.type, (perType.get(y.type) ?? 0) + 1);
              const used = sampleQuota.get(y.type) ?? 0;
              if (used < 3) {
                sampleQuota.set(y.type, used + 1);
                samples.push({ vara, tithi, nak, sunNak, types: r.map((x) => x.type) });
              }
            }
          }
        }
      }
    }
  }
  const yogaRows = samples;

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/core/{bhadra,varjyam,specialYogas,specialYogasData,muhurta}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'The nine fixed muhurtas and the ten special-yoga rules are bit-identical. ' +
        'Bhadra, Varjyam and Amrit Kala publish solved instants and are asserted ' +
        'against the parity gate\'s 1 ms band.',
      sample:
        `${days.length} Hindu days, ${muhurtas.length} muhurta cases, all 153090 ` +
        `special-yoga combinations digested (${yogaFirings} fire, ${yogaCount} yogas)`,
    },
    days, muhurtas,
    specialYogaDigest: yogaHash.digest('hex'),
    specialYogaCombinations: 7 * 30 * 27 * 27,
    specialYogaFiringDays: yogaFirings,
    specialYogaTotal: yogaCount,
    specialYogaPerType: Object.fromEntries([...perType].sort()),
    specialYogaSamples: yogaRows,
    amritKalaOffsets: AMRIT_KALA_OFFSET_GHATIKAS,
    varjyamOffsets: VARJYAM_OFFSET_GHATIKAS,
    vishti: range(60).map((i) => isVishtiKarana(i)),
    vasaByRashi: range(12).map((i) => bhadraVasaForRashi(i)),
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'core', 'bigwindows-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote bigwindows-golden.json (${days.length} days, ${muhurtas.length} muhurta cases, ` +
    `${yogaFirings} special-yoga firings digested, ${yogaRows.length} samples)\n`,
  );
}

function writeJyotishGolden(): void {
  const langs: Language[] = ['en', 'hi'];
  const chandraBalam = langs.flatMap((lang) =>
    range(12).flatMap((janma) =>
      range(12).map((transit) => ({
        janma, transit, lang, info: computeChandraBalam(janma, transit, lang),
      })),
    ),
  );
  const tarabala = langs.flatMap((lang) =>
    range(27).flatMap((janma) =>
      range(27).map((transit) => ({
        janma, transit, lang, info: computeTarabala(janma, transit, lang),
      })),
    ),
  );

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/{chandraBalam,tarabala}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Both are bit-identical to the TypeScript over their whole domain, ' +
        'pure index arithmetic and two name tables, enumerated exhaustively ' +
        'rather than sampled.',
      sample: `${chandraBalam.length} chandra balam and ${tarabala.length} tarabala cases`,
    },
    chandraBalam, tarabala,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'jyotish-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote jyotish-golden.json (${chandraBalam.length} chandra balam, ${tarabala.length} tarabala)\n`,
  );
}

function writeJyotishFoundationsGolden(): void {
  const GRAHAS: GrahaName[] = [
    'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
  ];

  const dignity: { graha: GrahaName; rashi: number; dignity: Dignity }[] = [];
  for (const graha of GRAHAS) {
    for (let rashi = 0; rashi < 12; rashi++) {
      dignity.push({ graha, rashi, dignity: computeDignity(graha, rashi) });
    }
  }

  /**
   * `computeAspects` reads only `planet.planet` and `planet.house`, so chart k
   * placing graha i in house ((k + i) mod 12) + 1 covers the whole input domain
   * in 12 charts instead of 12^9.
   */
  const aspects: {
    chart: number; nodeAspects: '7-only' | '5-and-9';
    houses: Record<string, number>; result: unknown;
  }[] = [];
  for (let k = 0; k < 12; k++) {
    const houses: Record<string, number> = {};
    const planets = GRAHAS.map((planet, i) => {
      const house = ((k + i) % 12) + 1;
      houses[planet] = house;
      return {
        planet, longitude: 0, rashi: { index: 0, name: '' },
        degreeInRashi: 0, house, isRetrograde: false,
      } as PlanetPlacement;
    });
    const chart = { planets } as unknown as BirthChart;
    for (const nodeAspects of ['7-only', '5-and-9'] as const) {
      aspects.push({
        chart: k, nodeAspects, houses,
        result: computeAspects(chart, { nodeAspects }),
      });
    }
  }
  // Pins the `?? '7-only'` fallback, not only the explicit spelling.
  const aspectsDefault = computeAspects(
    {
      planets: GRAHAS.map((planet, i) => ({
        planet, longitude: 0, rashi: { index: 0, name: '' },
        degreeInRashi: 0, house: i + 1, isRetrograde: false,
      })),
    } as unknown as BirthChart,
  );

  const varnas: Varna[] = ['brahmin', 'kshatriya', 'vaishya', 'shudra'];
  const vashyas: Vashya[] = ['quadruped', 'human', 'water', 'wild', 'insect'];
  const yonis: YoniAnimal[] = [
    'horse', 'elephant', 'sheep', 'snake', 'dog', 'cat', 'rat', 'cow',
    'buffalo', 'tiger', 'deer', 'monkey', 'mongoose', 'lion',
  ];
  const ganas: Gana[] = ['deva', 'manushya', 'rakshasa'];
  const nadis: Nadi[] = ['adi', 'madhya', 'antya'];

  const tables = {
    varnaOrder: varnas,
    varnaRank: varnas.map((v) => VARNA_RANK[v]),
    rashiVarna: RASHI_VARNA,
    vashyaOrder: vashyas,
    vashyaIndex: vashyas.map((v) => vashyaIndex(v)),
    rashiVashya: RASHI_VASHYA,
    vashyaScore: VASHYA_SCORE,
    yoniOrder: yonis,
    yoniIndex: yonis.map((y) => yoniIndex(y)),
    nakshatraYoni: NAKSHATRA_YONI,
    yoniScore: YONI_SCORE,
    rashiLord: RASHI_LORD,
    naisargikaMaitri: NAISARGIKA_MAITRI,
    grahaMaitriScore: GRAHA_MAITRI_SCORE,
    maitriIdx: [-1, 0, 1].map((v) => maitriIdx(v)),
    ganaOrder: ganas,
    ganaIdx: ganas.map((g) => ganaIdx(g)),
    nakshatraGana: NAKSHATRA_GANA,
    ganaScore: GANA_SCORE,
    nadiOrder: nadis,
    nakshatraNadi: NAKSHATRA_NADI,
    inauspiciousTaraRemainders: INAUSPICIOUS_TARA_REMAINDERS,
    bhakootDoshicDistances: BHAKOOT_DOSHIC_DISTANCES,
  };

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/{dignity,aspects,matchingTables}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Bit-identical to the TypeScript over the WHOLE domain of each: these ' +
        'three files contain no floating-point path at all, they are table ' +
        'lookups, integer modulo and comparisons, so there is nothing for a ' +
        'platform transcendental to perturb and no bound to state.',
      sample:
        `${dignity.length} dignity cases (9 grahas x 12 rashis, exhaustive), ` +
        `${aspects.length} aspect charts (every graha in every house, both node ` +
        `conventions), and every cell of ${Object.keys(tables).length} tables`,
    },
    dignity, aspects, aspectsDefault, tables,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'foundations-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote foundations-golden.json (${dignity.length} dignity, ${aspects.length} aspect charts)\n`,
  );
}

// `retrogradeDeltas` is carried explicitly so the Go side can state the margin
// by which the sign is safe rather than merely observe that it agrees.

const CHART_SEED = 0xC4A27500 >>> 0;
const CHART_MS_LO = Date.UTC(1900, 0, 1), CHART_MS_HI = Date.UTC(2100, 0, 1);
const NODE_SAMPLES = 20_000, NODE_SAMPLES_SHORT = 2_000;
const LAGNA_SAMPLES = 2_000, LAGNA_SAMPLES_SHORT = 300;
const SPECIAL_SAMPLES = 120;

interface ChartLoc { name: string; latitude: number; longitude: number }

const CHART_LOCS: readonly ChartLoc[] = [
  { name: 'pune', latitude: 18.5204, longitude: 73.8567 },
  { name: 'sydney', latitude: -33.8688, longitude: 151.2093 },
  { name: 'reykjavik', latitude: 64.1466, longitude: -21.9426 },
];

function chartInstants(salt: number, count: number): number[] {
  const out: number[] = [];
  for (const u of unit01(CHART_SEED ^ salt, count)) {
    out.push(Math.floor(CHART_MS_LO + u * (CHART_MS_HI - CHART_MS_LO)));
  }
  return out;
}

/**
 * Swept far wider than the library's 1900-2100 span so a dropped or
 * sign-flipped high-order term is visible: the cubic contributes 5e-7 deg at
 * |T| = 1 and 6e-11 deg at |T| = 0.05.
 */
function obliquityCenturies(): number[] {
  const out: number[] = [];
  for (let i = -200; i <= 200; i++) out.push(i / 100);
  for (const u of unit01(CHART_SEED ^ 0x0B11, 600)) out.push(-1 + 2 * u);
  return out;
}

const CHART_EVENTS: readonly { name: string; ms: number; loc: ChartLoc }[] = [
  { name: 'e1-1912-pune', ms: Date.parse('1912-06-14T03:22:10.000Z'), loc: CHART_LOCS[0]! },
  { name: 'e2-1976-newyork', ms: Date.parse('1976-11-02T21:47:00.000Z'), loc: { name: 'newyork', latitude: 40.7128, longitude: -74.006 } },
  { name: 'e3-1995-delhi', ms: Date.parse('1995-08-15T05:30:00.000Z'), loc: { name: 'delhi', latitude: 28.6139, longitude: 77.209 } },
  { name: 'e4-2039-sydney', ms: Date.parse('2039-03-21T11:11:11.000Z'), loc: CHART_LOCS[1]! },
  { name: 'e5-2088-reykjavik', ms: Date.parse('2088-06-19T18:05:33.000Z'), loc: CHART_LOCS[2]! },
];

/**
 * The two node formulas are module-private, so they are reached the only way a
 * caller can: through `computePlanetaryPositions`, whose Rahu is the tropical
 * node minus the ayanamsa.
 */
function nodeAccessors(): Record<string, (ms: number) => number> {
  return {
    'rahuSidereal:mean': (ms) =>
      computePlanetaryPositions(new Date(ms), 'lahiri', undefined, undefined, 'mean').rahu.siderealLongitude,
    'rahuSidereal:true': (ms) =>
      computePlanetaryPositions(new Date(ms), 'lahiri', undefined, undefined, 'true').rahu.siderealLongitude,
    'ketuSidereal:mean': (ms) =>
      computePlanetaryPositions(new Date(ms), 'lahiri', undefined, undefined, 'mean').ketu.siderealLongitude,
  };
}

function lagnaAccessors(loc: ChartLoc): Record<string, (ms: number) => number> {
  return {
    siderealLongitude: (ms) => computeLagna(new Date(ms), loc, 'lahiri', 'en').siderealLongitude,
    degreeInRashi: (ms) => computeLagna(new Date(ms), loc, 'lahiri', 'en').degreeInRashi,
    rashiIndex: (ms) => computeLagna(new Date(ms), loc, 'lahiri', 'en').rashi.index,
    nakshatraIndex: (ms) => computeLagna(new Date(ms), loc, 'lahiri', 'en').nakshatra.index,
    pada: (ms) => computeLagna(new Date(ms), loc, 'lahiri', 'en').pada,
  };
}

const RETRO_BODIES: readonly PlanetBody[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];

/**
 * The margin by which `isRetrograde`'s sign is safe can only be stated by
 * carrying the raw deltas across. Recomputed exactly as `planets.ts` does.
 */
function retrogradeDelta(body: PlanetBody, ms: number): number {
  const dt = 3600_000;
  const lon0 = getPlanetPosition(body, new Date(ms - dt)).longitude;
  const lon1 = getPlanetPosition(body, new Date(ms + dt)).longitude;
  let delta = lon1 - lon0;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function writeChartsFoundationGolden(): void {
  const obliquityT = obliquityCenturies();

  const nodeInstants = chartInstants(0x0D0E, NODE_SAMPLES);
  const nodeShort = nodeInstants.slice(0, NODE_SAMPLES_SHORT);
  const nodeFns = nodeAccessors();
  const nodeNames = Object.keys(nodeFns).sort();

  const lagnaInstants = chartInstants(0x1A61, LAGNA_SAMPLES);
  const lagnaShort = lagnaInstants.slice(0, LAGNA_SAMPLES_SHORT);
  const lagnaDigests: Record<string, Record<string, string>> = {};
  const lagnaDigestsShort: Record<string, Record<string, string>> = {};
  for (const loc of CHART_LOCS) {
    const fns = lagnaAccessors(loc);
    const names = Object.keys(fns).sort();
    lagnaDigests[loc.name] = Object.fromEntries(names.map((n) => [n, digestOver(lagnaInstants, fns[n]!)]));
    lagnaDigestsShort[loc.name] = Object.fromEntries(names.map((n) => [n, digestOver(lagnaShort, fns[n]!)]));
  }

  const caseInstants = [
    ...CHART_EVENTS.map((e) => e.ms),
    Date.UTC(2000, 0, 1, 12), CHART_MS_LO, CHART_MS_HI - 86_400_000,
    ...lagnaInstants.slice(0, 40),
  ];
  const lagnaCases: Record<string, unknown[]> = {};
  for (const loc of CHART_LOCS) {
    lagnaCases[loc.name] = caseInstants.map((ms) => ({
      en: computeLagna(new Date(ms), loc, 'lahiri', 'en'),
      hi: computeLagna(new Date(ms), loc, 'lahiri', 'hi'),
      raman: computeLagna(new Date(ms), loc, 'raman', 'en'),
    }));
  }

  // Reykjavik is excluded: at 64.1 deg N `findSunriseBefore` can hit a polar day
  // inside the span and throw, and a golden of thrown errors pins the wrong thing.
  const specialInstants = chartInstants(0x5EC1, SPECIAL_SAMPLES);
  const specialLocs = CHART_LOCS.filter((l) => Math.abs(l.latitude) < 60);
  const special: Record<string, unknown[]> = {};
  for (const loc of specialLocs) {
    special[loc.name] = specialInstants.map((ms) => {
      const d = new Date(ms);
      return {
        ms,
        sunriseBefore: _findSunriseBeforeForTest(d, loc).getTime(),
        hora: computeHoraLagna(d, loc, 'lahiri', 'en'),
        ghati: computeGhatiLagna(d, loc, 'lahiri', 'en'),
        bhava: computeBhavaLagna(d, loc, 'lahiri', 'en'),
        sripati: computeSripatiLagna(d, loc, 'lahiri', 'en'),
        sripatiCusps: computeSripatiLagna(d, loc, 'lahiri', 'en', { includeCusps: true }).cusps,
      };
    });
  }

  const positionInstantsList = [...CHART_EVENTS.map((e) => e.ms), ...nodeInstants.slice(0, 20)];
  const positions = positionInstantsList.map((ms) => ({
    ms,
    mean: computePlanetaryPositions(new Date(ms), 'lahiri', undefined, undefined, 'mean'),
    true: computePlanetaryPositions(new Date(ms), 'lahiri', undefined, undefined, 'true'),
  }));

  // Enough explicit node values to measure the true node's divergence. With far
  // fewer the two sines agree on every one and the bound test reports a worst
  // case of zero, which is not a measurement.
  const nodeCaseInstants = nodeInstants.slice(0, 400);
  const nodeCases = nodeCaseInstants.map((ms) => {
    const mean = computePlanetaryPositions(new Date(ms), 'lahiri', undefined, undefined, 'mean');
    const tru = computePlanetaryPositions(new Date(ms), 'lahiri', undefined, undefined, 'true');
    return {
      ms,
      rahuMean: mean.rahu.siderealLongitude,
      ketuMean: mean.ketu.siderealLongitude,
      rahuTrue: tru.rahu.siderealLongitude,
      ketuTrue: tru.ketu.siderealLongitude,
    };
  });

  const retrogradeDeltas = positionInstantsList.map((ms) => ({
    ms,
    deltas: Object.fromEntries(RETRO_BODIES.map((b) => [b, retrogradeDelta(b, ms)])),
  }));

  const basis = CHART_EVENTS.map((e) => {
    const b = computeNatalBasis(new Date(e.ms), e.loc, {});
    return {
      name: e.name, ms: e.ms,
      ayanamsaType: b.ayanamsaType, lang: b.lang, nodeType: b.nodeType,
      lagna: b.lagna,
      grahaOrder: grahaList(b).map((g) => g.key),
      positions: b.positions,
    };
  });
  const basisWithOptions = computeNatalBasis(
    new Date(CHART_EVENTS[2]!.ms), CHART_EVENTS[2]!.loc,
    { ayanamsa: 'raman', language: 'hi', nodeType: 'true' },
  );

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/{planets,lagna,natalBasis}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'meanObliquity and the mean-node polynomial are bit-identical (pure ' +
        'float64 arithmetic, anti-FMA barriered, no transcendental). The true ' +
        'node, every lagna and every graha longitude are bounded at the parity ' +
        "gate's 1e-9 deg, because they end in the platform's atan2/sin/cos/tan. " +
        'Every index, pada, name and retrograde flag is an invariant with zero ' +
        'tolerance. The Go test decides which is which by measuring.',
      span: [new Date(CHART_MS_LO).toISOString(), new Date(CHART_MS_HI).toISOString()],
      note:
        'Reykjavik is excluded from the special-lagna sweep: findSunriseBefore ' +
        'throws NO_SUNRISE inside a polar day, which is a D7 assertion rather ' +
        'than a value to compare.',
    },
    seed: CHART_SEED,
    nodeSamples: NODE_SAMPLES,
    nodeSamplesShort: NODE_SAMPLES_SHORT,
    lagnaSamples: LAGNA_SAMPLES,
    lagnaSamplesShort: LAGNA_SAMPLES_SHORT,
    specialSamples: SPECIAL_SAMPLES,
    msLo: CHART_MS_LO,
    msHi: CHART_MS_HI,
    locations: CHART_LOCS,
    events: CHART_EVENTS,
    grahaAbbr: GRAHA_ABBR,
    obliquityT,
    obliquityValues: obliquityT.map(meanObliquity),
    nodeDigests: Object.fromEntries(nodeNames.map((n) => [n, digestOver(nodeInstants, nodeFns[n]!)])),
    nodeDigestsShort: Object.fromEntries(nodeNames.map((n) => [n, digestOver(nodeShort, nodeFns[n]!)])),
    lagnaDigests,
    lagnaDigestsShort,
    caseInstants,
    nodeCaseInstants,
    nodeCases,
    lagnaCases,
    specialInstants,
    special,
    positions,
    retrogradeDeltas,
    basis,
    basisWithOptions,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'charts-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote charts-golden.json (${obliquityT.length} obliquity, ${nodeNames.length} node accessors, ` +
    `${CHART_LOCS.length} lagna locations, ${positions.length} position sets)\n`,
  );
}

// `NAV_SPAN = 30/9`, `SAPTAMSA_SPAN = 30/7` and `DWADASAMSA_SPAN = 30/12` are
// all integer division in Go, and all three become plausible-looking wrong
// charts rather than errors. Placidus can fail two ways: CIRCUMPOLAR, a
// property of the latitude, and PLACIDUS_DIVERGED, a property of the solver.

const VARGA_SEED = 0xD1D9A250 >>> 0;
const VARGA_MS_LO = Date.UTC(1900, 0, 1), VARGA_MS_HI = Date.UTC(2100, 0, 1);
const VARGA_CHART_SAMPLES = 200;
const ALL_DIVISIONALS: readonly Divisional[] = ['D2', 'D3', 'D7', 'D9', 'D10', 'D12', 'D30'];
const ALL_HOUSE_SYSTEMS: readonly HouseSystem[] = ['whole-sign', 'equal', 'placidus-kp'];

function vargaLongitudes(): { all: number[]; caseCount: number } {
  const nd = (x: number) => { const b = new Float64Array(1); const i = new BigInt64Array(b.buffer); b[0] = x; i[0] = i[0]! - 1n; return b[0]!; };
  const nu = (x: number) => { const b = new Float64Array(1); const i = new BigInt64Array(b.buffer); b[0] = x; i[0] = i[0]! + 1n; return b[0]!; };
  const marks: number[] = [];
  for (let k = 1; k < 12; k++) marks.push(k * (30 / 12));          // D12
  for (let k = 1; k < 10; k++) marks.push(k * 3);                  // D10
  for (let k = 1; k < 7; k++) marks.push(k * (30 / 7));            // D7
  for (let k = 1; k < 9; k++) marks.push(k * (30 / 9));            // D9
  for (let k = 1; k < 3; k++) marks.push(k * 10);                  // D3
  marks.push(15);                                                   // D2
  for (const m of [5, 10, 12, 18, 20, 25]) marks.push(m);          // D30, both parities
  const cases: number[] = [];
  for (let sign = 0; sign < 12; sign++) {
    const base = sign * 30;
    cases.push(base, nu(base));
    if (base > 0) cases.push(nd(base));
    for (const m of marks) {
      const v = base + m;
      cases.push(nd(v), v, nu(v));
    }
  }
  const grid: number[] = [];
  for (let x = 0; x < 360; x += 0.05) grid.push(Number(x.toFixed(6)));
  return { all: [...cases, ...grid], caseCount: cases.length };
}

function vargaTransforms(): Record<string, (lon: number) => number> {
  return {
    D2: _horaLongitudeForTest,
    D3: _drekkanaLongitudeForTest,
    D7: _saptamsaLongitudeForTest,
    D9: _navamsaLongitudeForTest,
    D10: _dasamsaLongitudeForTest,
    D12: _dwadasamsaLongitudeForTest,
    D30: _trimsamsaLongitudeForTest,
  };
}

/**
 * The latitude at which an intermediate cusp goes circumpolar is not a
 * constant: it is the CUSP's declination that matters and not the observer's,
 * so it moves with the sidereal time and the boundary is mapped, not assumed.
 */
function placidusLatitudeSweep(ms: number): { latitude: number; ok: boolean; code: string | null }[] {
  const out: { latitude: number; ok: boolean; code: string | null }[] = [];
  for (let lat = 0; lat < 90; lat++) {
    try {
      computeBhava(new Date(ms), { latitude: lat, longitude: 77.209 }, { houseSystem: 'placidus-kp' });
      out.push({ latitude: lat, ok: true, code: null });
    } catch (e) {
      const code = (e as { code?: string }).code ?? null;
      out.push({ latitude: lat, ok: false, code });
    }
  }
  return out;
}

function writeVargasGolden(): void {
  const { all: longitudes, caseCount } = vargaLongitudes();
  const transforms = vargaTransforms();
  const names = Object.keys(transforms).sort();

  const caseLongitudes = longitudes.slice(0, caseCount);
  const transformValues: Record<string, number[]> = {};
  const transformDigests: Record<string, string> = {};
  for (const n of names) {
    transformValues[n] = caseLongitudes.map(transforms[n]!);
    transformDigests[n] = digestOver(longitudes, transforms[n]!);
  }

  const chartInstantsList: number[] = [];
  for (const u of unit01(VARGA_SEED, VARGA_CHART_SAMPLES)) {
    chartInstantsList.push(Math.floor(VARGA_MS_LO + u * (VARGA_MS_HI - VARGA_MS_LO)));
  }
  const events = CHART_EVENTS.map((e) => ({ name: e.name, ms: e.ms, loc: e.loc }));

  const bhava = events.map((e) => ({
    name: e.name, ms: e.ms,
    systems: Object.fromEntries(ALL_HOUSE_SYSTEMS.map((hs) => {
      try {
        return [hs, { ok: true, chart: computeBhava(new Date(e.ms), e.loc, { houseSystem: hs }) }];
      } catch (err) {
        return [hs, { ok: false, code: (err as { code?: string }).code ?? null }];
      }
    })),
  }));

  const rashiCharts = events.map((e) => ({
    name: e.name, ms: e.ms,
    systems: Object.fromEntries(ALL_HOUSE_SYSTEMS.map((hs) => {
      try {
        return [hs, { ok: true, chart: computeRashiChart(new Date(e.ms), e.loc, { houseSystem: hs }) }];
      } catch (err) {
        return [hs, { ok: false, code: (err as { code?: string }).code ?? null }];
      }
    })),
  }));

  const vargaCharts = events.map((e) => ({
    name: e.name, ms: e.ms,
    charts: Object.fromEntries(ALL_DIVISIONALS.map((d) =>
      [d, computeDivisionalChart(new Date(e.ms), e.loc, d)])),
    navamsa: computeNavamsa(new Date(e.ms), e.loc),
  }));

  // Invariants, so this digest is over integers and must match exactly.
  const houseDigest = digestOver(chartInstantsList, (ms) => {
    const c = computeRashiChart(new Date(ms), { latitude: 18.5204, longitude: 73.8567 });
    let acc = 0;
    for (const p of c.planets) acc = acc * 13 + p.house;
    return acc;
  });
  const vargaRashiDigests = Object.fromEntries(ALL_DIVISIONALS.map((d) => [d,
    digestOver(chartInstantsList, (ms) => {
      const c = computeDivisionalChart(new Date(ms), { latitude: 18.5204, longitude: 73.8567 }, d);
      let acc = c.lagnaRashi.index;
      for (const p of c.planets) acc = acc * 13 + p.rashi.index;
      return acc;
    })]));

  const sample = computeRashiChart(new Date(events[2]!.ms), events[2]!.loc);
  const indexed = indexPlanets(sample.planets);

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/{bhava,charts,divisionals}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'The seven varga longitude transforms are BIT-IDENTICAL over a dense ' +
        'sweep: no ephemeris input, no transcendental, only floor/mod/compare ' +
        'and exactly-representable constants. The charts built from them are ' +
        'bounded, because their input is the natal longitude; their rashi ' +
        'indices and house numbers are invariants again.',
      why:
        'The sweep includes every varga segment boundary in every sign plus both ' +
        'ULP neighbours, because 30/9, 30/7 and 30/12 are integer division in Go ' +
        '(docs/porting.md 1.7) and all three failures are silent: a plausible chart ' +
        'with the wrong signs, not an error.',
    },
    seed: VARGA_SEED,
    msLo: VARGA_MS_LO,
    msHi: VARGA_MS_HI,
    chartSamples: VARGA_CHART_SAMPLES,
    divisionals: ALL_DIVISIONALS,
    houseSystems: ALL_HOUSE_SYSTEMS,
    spans: {
      NAV_SPAN: 30 / 9,
      DREKKANA_SPAN: 10,
      SAPTAMSA_SPAN: 30 / 7,
      DASAMSA_SPAN: 3,
      DWADASAMSA_SPAN: 30 / 12,
      TRIMSA_ODD_BOUNDARIES: [0, 5, 10, 18, 25, 30],
      TRIMSA_EVEN_BOUNDARIES: [0, 5, 12, 20, 25, 30],
      TRIMSA_ODD_RASHIS: [0, 10, 8, 2, 6],
      TRIMSA_EVEN_RASHIS: [1, 5, 11, 9, 7],
    },
    longitudes,
    caseCount,
    transformValues,
    transformDigests,
    events,
    bhava,
    rashiCharts,
    vargaCharts,
    chartInstants: chartInstantsList,
    houseDigest,
    vargaRashiDigests,
    indexedSample: indexed,
    placidusLatitudeSweep: placidusLatitudeSweep(Date.UTC(2025, 0, 14, 6)),
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'vargas-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote vargas-golden.json (${longitudes.length} longitudes (${caseCount} explicit) x ${names.length} transforms, ` +
    `${bhava.length} bhava events x ${ALL_HOUSE_SYSTEMS.length} systems, ` +
    `${vargaCharts.length} x ${ALL_DIVISIONALS.length} vargas)\n`,
  );
}

// The one float path is Kaal Sarp's arc test, and that is a comparison, so it
// is an invariant rather than a bound.

const RULES_SEED = 0xA5474A1A >>> 0;
const RULES_MS_LO = Date.UTC(1900, 0, 1), RULES_MS_HI = Date.UTC(2100, 0, 1);
const RULES_CHART_SAMPLES = 200;

/** Chosen to reach every branch of each rule, not to look like real charts. */
function sodhanaGrids(): number[][] {
  const grids: number[][] = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],           // all zero
    [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],           // all max
    [0, 3, 5, 0, 3, 5, 0, 3, 5, 0, 3, 5],           // AV-1's repro: a zero in every triad
    [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4],           // strictly varied
    [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],           // equal pairs -> Rule 4's "equal" arm
    [5, 3, 5, 3, 5, 3, 5, 3, 5, 3, 5, 3],           // alternating
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],           // zeros interleaved
    [8, 1, 8, 1, 8, 1, 8, 1, 8, 1, 8, 1],           // wide gaps
  ];
  let s = RULES_SEED;
  for (let g = 0; g < 40; g++) {
    const grid: number[] = [];
    for (let i = 0; i < 12; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      grid.push(s % 9);
    }
    grids.push(grid);
  }
  return grids;
}

/** Every shape the Ekadhipatya rule branches on. */
function sodhanaOccupancies(): number[][] {
  return [
    [],
    [0, 1, 2, 5, 6, 7, 8, 9, 10, 11],   // every paired rashi occupied
    [0, 1, 2, 8, 9],                     // the first of each pair
    [7, 6, 5, 11, 10],                   // the second of each pair
    [0, 6, 2, 11, 9],                    // mixed
    [3, 4],                              // only the two unpaired rashis
    [0, 7],                              // one pair fully occupied
    [1],                                 // a single occupant
  ];
}

function writeChartRulesGolden(): void {
  const events = CHART_EVENTS.map((e) => ({ name: e.name, ms: e.ms, loc: e.loc }));

  const perEvent = events.map((e) => {
    const chart = computeRashiChart(new Date(e.ms), e.loc);
    return {
      name: e.name, ms: e.ms,
      ashtakavarga: computeAshtakavarga(chart),
      ashtakavargaReduced: computeAshtakavarga(chart, { reductions: true }),
      karakas7: computeJaiminiKarakas(chart),
      karakas8: computeJaiminiKarakas(chart, { variant: '8-jaimini' }),
      argala: computeArgala(chart),
      argalaTrikona: computeArgala(chart, { includeTrikonargala: true }),
      arudhasEn: computeArudhas(chart, 'en'),
      arudhasHi: computeArudhas(chart, 'hi'),
      mangal: computeMangalDosha(chart),
      kaalSarp: computeKaalSarp(chart),
      pitru: computePitruDosha(chart),
    };
  });

  // Matches the parity dump's `chartPairs`, so the two agree on inputs.
  const pairs = events.map((a, i) => {
    const b = events[(i + 1) % events.length]!;
    return {
      label: `${a.name}|${b.name}`,
      compatibility: computeMangalCompatibility(
        computeRashiChart(new Date(a.ms), a.loc),
        computeRashiChart(new Date(b.ms), b.loc),
      ),
    };
  });

  const chartInstantsList: number[] = [];
  for (const u of unit01(RULES_SEED ^ 0x1111, RULES_CHART_SAMPLES)) {
    chartInstantsList.push(Math.floor(RULES_MS_LO + u * (RULES_MS_HI - RULES_MS_LO)));
  }
  const pune = { latitude: 18.5204, longitude: 73.8567 };
  const chartAt = (ms: number) => computeRashiChart(new Date(ms), pune);
  /**
   * The modulo at every step is LOAD-BEARING. A plain `acc = acc * 61 + v` over
   * twelve cells reaches 61^12 = 6.9e21, past 2^53, and a rounding
   * multiply-then-add is exactly the `a*b + c` shape Go fuses and JavaScript
   * does not.
   */
  const DIGEST_MOD = 1_000_003;
  const fold = (values: Iterable<number>, radix: number): number => {
    let acc = 0;
    for (const v of values) acc = (acc * radix + v) % DIGEST_MOD;
    return acc;
  };

  const digests = {
    sarvashtaka: digestOver(chartInstantsList, (ms) =>
      fold(computeAshtakavarga(chartAt(ms)).sarvashtaka, 61)),
    sarvashtakaReduced: digestOver(chartInstantsList, (ms) =>
      fold(computeAshtakavarga(chartAt(ms), { reductions: true }).reduced!.sarvashtaka, 61)),
    arudhaRashis: digestOver(chartInstantsList, (ms) =>
      fold(computeArudhas(chartAt(ms)).map((a) => a.arudhaRashi), 13)),
    argalaCounts: digestOver(chartInstantsList, (ms) =>
      fold(computeArgala(chartAt(ms)).map((e) => e.argala.length * 10 + e.virodhargala.length), 23)),
    doshaFlags: digestOver(chartInstantsList, (ms) => {
      const c = chartAt(ms);
      const m = computeMangalDosha(c);
      const k = computeKaalSarp(c);
      const p = computePitruDosha(c);
      return ((m.afflicted ? 1 : 0) * 2 + (k.afflicted ? 1 : 0)) * 2 + (p.afflicted ? 1 : 0)
        + 8 * (k.partial ? 1 : 0) + 16 * k.rahuHouse + 256 * p.reasons.length;
    }),
  };

  const bhinnashtakaSweep: { rashi: number; grids: Record<string, number[]> }[] = [];
  for (let rashi = 0; rashi < 12; rashi++) {
    const contributorRashi = {} as Record<AshtakavargaContributor, number>;
    for (const c of ASHTAKAVARGA_CONTRIBUTORS) contributorRashi[c] = rashi;
    const grids: Record<string, number[]> = {};
    for (const r of ASHTAKAVARGA_RECEIVERS) grids[r] = _bhinnashtakaForTest(r, contributorRashi);
    bhinnashtakaSweep.push({ rashi, grids });
  }

  const grids = sodhanaGrids();
  const occupancies = sodhanaOccupancies();
  const trikona = grids.map((g) => _applyTrikonaSodhanaForTest(g));
  const ekadhipatya: number[][][] = grids.map((g) =>
    occupancies.map((occ) => _applyEkadhipatyaSodhanaForTest(g, new Set(occ))));

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/{ashtakavarga,ashtakavargaTables,karakas,argala,arudha,doshas}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Bit-identical on every leaf. These six files read only rashi and house ' +
        'indices from the chart and do integer arithmetic on them; the one float ' +
        'path is Kaal Sarp arc membership, which is a comparison and therefore ' +
        'an invariant rather than a bound.',
      why:
        'The two Sodhana reductions get an engineered sweep as well as a ' +
        'chart-driven one: both carry recorded audit history (AV-1, AV-2 of the ' +
        '2026-08-14 audit) and both bugs lived in branches a real chart reaches ' +
        'rarely.',
    },
    seed: RULES_SEED,
    msLo: RULES_MS_LO,
    msHi: RULES_MS_HI,
    chartSamples: RULES_CHART_SAMPLES,
    tables: {
      contributors: ASHTAKAVARGA_CONTRIBUTORS,
      receivers: ASHTAKAVARGA_RECEIVERS,
      beneficOffsets: BENEFIC_OFFSETS,
      bhinnashtakaTotal: BHINNASHTAKA_TOTAL,
      sarvashtakaTotal: SARVASHTAKA_TOTAL,
      ekadhipatyaPairs: EKADHIPATYA_PAIRS,
      trikonaTriads: TRIKONA_TRIADS,
    },
    events,
    perEvent,
    pairs,
    chartInstants: chartInstantsList,
    digests,
    bhinnashtakaSweep,
    sodhanaGrids: grids,
    sodhanaOccupancies: occupancies,
    trikonaResults: trikona,
    ekadhipatyaResults: ekadhipatya,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'chartrules-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote chartrules-golden.json (${perEvent.length} events, ${pairs.length} pairs, ` +
    `${grids.length} sodhana grids x ${occupancies.length} occupancies)\n`,
  );
}

// `matching.ts` interpolates a NUMERIC graha index into one of the published
// descriptions ("Same rashi-lord (graha 2)"), so a Go port that rendered the
// name instead would be an improvement and a parity break; every description
// string is compared exactly.

const MATCH_SEED = 0x36C05EED >>> 0;

function allNatalMoons(): { rashi: number; nakshatra: number }[] {
  const out: { rashi: number; nakshatra: number }[] = [];
  for (let r = 0; r < 12; r++) for (let n = 0; n < 27; n++) out.push({ rashi: r, nakshatra: n });
  return out;
}

/** Hand-picked to reach each veto and each optional cancellation. */
function matchPairs(): { label: string; boy: MatchNatalMoon; girl: MatchNatalMoon }[] {
  const out: { label: string; boy: MatchNatalMoon; girl: MatchNatalMoon }[] = [];
  const named: [string, MatchNatalMoon, MatchNatalMoon][] = [
    ['same-everything', { rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0 }],
    ['same-rajju-pada', { rashi: 0, nakshatra: 0 }, { rashi: 4, nakshatra: 8 }],
    ['same-rajju-sira', { rashi: 1, nakshatra: 4 }, { rashi: 5, nakshatra: 13 }],
    ['vedha-pair', { rashi: 0, nakshatra: 0 }, { rashi: 7, nakshatra: 17 }],
    ['chitra-has-no-vedha', { rashi: 5, nakshatra: 13 }, { rashi: 6, nakshatra: 13 }],
    ['bhakoot-6-8', { rashi: 0, nakshatra: 3 }, { rashi: 5, nakshatra: 20 }],
    ['bhakoot-2-12', { rashi: 0, nakshatra: 3 }, { rashi: 1, nakshatra: 20 }],
    ['gana-manushya-rakshasa', { rashi: 2, nakshatra: 5 }, { rashi: 9, nakshatra: 8 }],
    ['same-lord-aries-scorpio', { rashi: 0, nakshatra: 2 }, { rashi: 7, nakshatra: 19 }],
  ];
  for (const [label, boy, girl] of named) out.push({ label, boy, girl });

  // The optional NatalMoon fields, which only fire when BOTH natives carry them.
  out.push({
    label: 'opt-same-lagna-lord',
    boy: { rashi: 0, nakshatra: 3, lagnaRashi: 0, navamsaRashi: 3, nakshatraPada: 1 },
    girl: { rashi: 5, nakshatra: 20, lagnaRashi: 7, navamsaRashi: 9, nakshatraPada: 4 },
  });
  // Cancer (3) and Leo (4) as lagnas is the ONLY shape that reaches this branch:
  // their lords are Moon and Sun, so the same-lagna-lord rule above does not
  // fire, while the 7th from each is co-ruled by Saturn.
  out.push({
    label: 'opt-same-seventh-lord',
    boy: { rashi: 0, nakshatra: 3, lagnaRashi: 3, navamsaRashi: 2 },
    girl: { rashi: 5, nakshatra: 20, lagnaRashi: 4, navamsaRashi: 8 },
  });
  out.push({
    label: 'opt-same-navamsa-lord',
    boy: { rashi: 0, nakshatra: 3, lagnaRashi: 2, navamsaRashi: 0 },
    girl: { rashi: 5, nakshatra: 20, lagnaRashi: 3, navamsaRashi: 7 },
  });
  out.push({
    label: 'opt-boy-only-so-nothing-fires',
    boy: { rashi: 0, nakshatra: 3, lagnaRashi: 0 },
    girl: { rashi: 5, nakshatra: 20 },
  });

  for (const p of readFixturePairsForMatching()) out.push(p);

  const moons = allNatalMoons();
  let s = MATCH_SEED;
  for (let i = 0; i < 120; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const b = moons[s % moons.length]!;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const gmoon = moons[s % moons.length]!;
    out.push({ label: `seeded-${i}`, boy: b, girl: gmoon });
  }
  return out;
}

function readFixturePairsForMatching(): { label: string; boy: MatchNatalMoon; girl: MatchNatalMoon }[] {
  const raw = readFileSync(join(REPO, 'testdata', 'charts', 'ashtakoot-pairs.json'), 'utf8');
  const parsed = JSON.parse(raw) as {
    pairs: { label: string; boy: MatchNatalMoon; girl: MatchNatalMoon }[];
  };
  return parsed.pairs.map((p) => ({
    label: `fixture-${p.label}`,
    boy: { rashi: p.boy.rashi, nakshatra: p.boy.nakshatra },
    girl: { rashi: p.girl.rashi, nakshatra: p.girl.nakshatra },
  }));
}

function writeMatchingGolden(): void {
  const pairs = matchPairs();
  const results = pairs.map((p) => ({
    label: p.label,
    boy: p.boy,
    girl: p.girl,
    ashtakoot: computeAshtakoot(p.boy, p.girl),
    ashtakootGana: computeAshtakoot(p.boy, p.girl, { ganaCancellation: true }),
    pathuPorutham: computePathuPorutham(p.boy, p.girl),
  }));

  // Folded modulo a small prime at every step so no intermediate leaves the
  // exact-integer range.
  const DIGEST_MOD = 1_000_003;
  const moons = allNatalMoons();
  const domainIndices: number[] = [];
  for (let i = 0; i < moons.length * moons.length; i++) domainIndices.push(i);
  const pairAt = (i: number) => ({ boy: moons[Math.floor(i / moons.length)]!, girl: moons[i % moons.length]! });
  const domainDigests = {
    ashtakootTotal: digestOver(domainIndices, (i) => {
      const { boy, girl } = pairAt(i);
      return computeAshtakoot(boy, girl).totalScore;
    }),
    ashtakootKoots: digestOver(domainIndices, (i) => {
      const { boy, girl } = pairAt(i);
      let acc = 0;
      for (const k of computeAshtakoot(boy, girl).koots) acc = (acc * 17 + k.score * 2) % DIGEST_MOD;
      return acc;
    }),
    ashtakootGanaTotal: digestOver(domainIndices, (i) => {
      const { boy, girl } = pairAt(i);
      return computeAshtakoot(boy, girl, { ganaCancellation: true }).totalScore;
    }),
    pathuPasses: digestOver(domainIndices, (i) => {
      const { boy, girl } = pairAt(i);
      const r = computePathuPorutham(boy, girl);
      let acc = r.totalPasses * 2 + (r.recommended ? 1 : 0);
      for (const p of r.poruthams) {
        acc = (acc * 5 + (p.passes ? 1 : 0) * 2 + (p.veto === true ? 1 : 0)) % DIGEST_MOD;
      }
      return acc;
    }),
  };

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/{matching,pathuPorutham,pathuPoruthamTables}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Bit-identical on every leaf, including the published description ' +
        'strings. The input domain is (12 x 27)^2 = 104,976 pairs and is ' +
        'digested in full; explicit values cover a seeded sample, every fixture ' +
        'pair, and hand-picked pairs that reach each veto and each optional ' +
        'cancellation.',
      why:
        'matching.ts interpolates a NUMERIC graha index into one description ' +
        '("Same rashi-lord (graha 2)"). A port that rendered the name instead ' +
        'would read better and break parity, and only an exact string ' +
        'comparison sees it.',
    },
    seed: MATCH_SEED,
    domainSize: moons.length * moons.length,
    tables: {
      nakshatraRajju: NAKSHATRA_RAJJU,
      vedhaPairs: VEDHA_PAIRS,
      vedhaOf: Array.from({ length: 27 }, (_, i) => vedhaOf(i)),
      mahendraAuspiciousDistances: MAHENDRA_AUSPICIOUS_DISTANCES,
      dinaAuspiciousRemainders: DINA_AUSPICIOUS_REMAINDERS,
      rashiDoshicDistances: RASHI_DOSHIC_DISTANCES,
    },
    results,
    domainDigests,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'matching-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote matching-golden.json (${results.length} explicit pairs, ` +
    `${moons.length * moons.length} digested)\n`,
  );
}

// `naisargika`, `drekkana`, `ojhaYugma` and `saptavargaja` are table lookups
// and floors over rashi indices, so they are exact where the rest is bounded.
// A disagreement in the exact half is a defect and not rounding, so the Go
// test asserts equality there rather than hiding it under `total`.

const SHADBALA_SEED = 0x5AD8A1A0 >>> 0;
const SHADBALA_MS_LO = Date.UTC(1900, 0, 1), SHADBALA_MS_HI = Date.UTC(2100, 0, 1);
const SHADBALA_SAMPLES = 60;

function writeShadbalaGolden(): void {
  const events = CHART_EVENTS.map((e) => ({ name: e.name, ms: e.ms, loc: e.loc }));

  // Reykjavik at 64.15N can hit a polar day inside the span, where
  // `computeShadbala` throws from `computeSunrise` (Nathonatha needs a sunrise),
  // so the events are wrapped and the sweep below is at Pune.
  const perEvent = events.map((e) => {
    try {
      return {
        name: e.name, ms: e.ms, ok: true,
        shadbala: computeShadbala(new Date(e.ms), e.loc),
        bhavaBala: computeBhavaBala(new Date(e.ms), e.loc),
      };
    } catch (err) {
      return { name: e.name, ms: e.ms, ok: false, code: (err as { code?: string }).code ?? null };
    }
  });

  const instants: number[] = [];
  for (const u of unit01(SHADBALA_SEED, SHADBALA_SAMPLES)) {
    instants.push(Math.floor(SHADBALA_MS_LO + u * (SHADBALA_MS_HI - SHADBALA_MS_LO)));
  }
  const pune = { latitude: 18.5204, longitude: 73.8567 };
  const sweep = instants.map((ms) => ({
    ms,
    shadbala: computeShadbala(new Date(ms), pune),
    bhavaBala: computeBhavaBala(new Date(ms), pune),
  }));

  // Every graha in every rashi, so every ojha/yugma combination is hit.
  const ojha: { rashi: number; values: Record<string, number> }[] = [];
  for (let rashi = 0; rashi < 12; rashi++) {
    const values: Record<string, number> = {};
    for (const g of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const) {
      const fakeChart = {
        byPlanet: Object.fromEntries(
          (['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const)
            .map((n) => [n, { rashi: { index: rashi } }]),
        ),
      } as unknown as BirthChart;
      const fakeDivisionals = {
        D9: {
          planets: (['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const)
            .map((n) => ({ planet: n, rashi: { index: rashi } })),
        },
      } as unknown as Record<Divisional, DivisionalChart>;
      values[g] = _ojhaYugmaBalaForTest(g, fakeChart, fakeDivisionals);
    }
    ojha.push({ rashi, values });
  }

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/shadbala.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Split, and the split is the point. naisargika, drekkana, ojhaYugma and ' +
        'saptavargaja are exact, table lookups and floors over rashi indices. ' +
        'uchcha, dig, kala, chesta and drik consume a longitude or an instant ' +
        'ratio and are bounded. A disagreement in the exact half is a defect, ' +
        'not rounding.',
      why:
        'shadbala.ts has nine sub-balas each ending in `x * 60` assigned to a ' +
        'local and added later, docs/porting.md 1.1 fourth bullet, the shape that ' +
        'cost G3.3 a red test. Two of the ratios are int64 millisecond divisions ' +
        '(1.7). Both classes are dense here and neither is visible in a total.',
      span: [new Date(SHADBALA_MS_LO).toISOString(), new Date(SHADBALA_MS_HI).toISOString()],
    },
    seed: SHADBALA_SEED,
    samples: SHADBALA_SAMPLES,
    msLo: SHADBALA_MS_LO,
    msHi: SHADBALA_MS_HI,
    bhavaDikValues: _BHAVA_DIK_VALUES_FOR_TEST,
    events,
    perEvent,
    instants,
    sweep,
    ojha,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'shadbala-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote shadbala-golden.json (${perEvent.length} events, ${sweep.length} sweep instants, ` +
    `${ojha.length} ojha rashis)\n`,
  );
}

// The risk in the yoga catalog is a rule that never runs and is therefore
// compared to nothing, so the Go side asserts that EVERY catalog entry fired
// at least once.

const YOGA_SEED = 0x40A5CA7E >>> 0;
const YOGA_MS_LO = Date.UTC(1900, 0, 1), YOGA_MS_HI = Date.UTC(2100, 0, 1);
const YOGA_SAMPLES = 400;
const ALL_YOGA_TYPES: readonly YogaType[] = [
  'mahapurusha', 'lunar', 'solar', 'raja', 'dhana', 'special', 'cancellation', 'negative',
];

function writeYogasGolden(): void {
  const locs = [
    { name: 'pune', latitude: 18.5204, longitude: 73.8567 },
    { name: 'delhi', latitude: 28.6139, longitude: 77.209 },
    { name: 'sydney', latitude: -33.8688, longitude: 151.2093 },
    { name: 'london', latitude: 51.5074, longitude: -0.1278 },
    { name: 'newyork', latitude: 40.7128, longitude: -74.006 },
    { name: 'quito', latitude: -0.1807, longitude: -78.4678 },
  ];

  const instants: number[] = [];
  for (const u of unit01(YOGA_SEED, YOGA_SAMPLES)) {
    instants.push(Math.floor(YOGA_MS_LO + u * (YOGA_MS_HI - YOGA_MS_LO)));
  }

  // Carried explicitly, so every published reason string is compared.
  const sweep = instants.map((ms, i) => {
    const loc = locs[i % locs.length]!;
    const chart = computeRashiChart(new Date(ms), loc);
    const navamsa = computeNavamsa(new Date(ms), loc);
    return {
      ms,
      loc: loc.name,
      yogas: computeYogas(chart),
      yogasWithNavamsa: computeYogas(chart, { navamsa }),
    };
  });

  const filterAt = instants[0]!;
  const filterLoc = locs[0]!;
  const filterChart = computeRashiChart(new Date(filterAt), filterLoc);
  const filterNavamsa = computeNavamsa(new Date(filterAt), filterLoc);
  const byType = Object.fromEntries(ALL_YOGA_TYPES.map((t) => [t,
    computeYogas(filterChart, { types: [t], navamsa: filterNavamsa })]));
  // An empty filter means "no filter at all" rather than "match nothing".
  const twoTypes = computeYogas(filterChart, { types: ['raja', 'dhana'], navamsa: filterNavamsa });
  const emptyFilter = computeYogas(filterChart, { types: [], navamsa: filterNavamsa });

  const nodeAspects59 = computeYogas(filterChart, { navamsa: filterNavamsa, nodeAspects: '5-and-9' });

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/{yogas,yogasCatalog}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the later uncommitted fixes',
      claim:
        'Bit-identical on every leaf, reason strings included. The catalog reads ' +
        'rashi indices, house numbers and dignities, all integers, plus one ' +
        'float comparison (Gajakesari combustion at 10 deg), which is a ' +
        'comparison and therefore an invariant.',
      why:
        'Most rules fire on a minority of charts, so the real risk is a rule ' +
        'that never runs and is compared to nothing. The Go side requires all ' +
        '25 catalog entries to fire at least once across the sweep.',
      span: [new Date(YOGA_MS_LO).toISOString(), new Date(YOGA_MS_HI).toISOString()],
    },
    seed: YOGA_SEED,
    samples: YOGA_SAMPLES,
    msLo: YOGA_MS_LO,
    msHi: YOGA_MS_HI,
    locations: locs,
    catalog: YOGA_CATALOG.map((r) => ({ name: r.name, type: r.type })),
    types: ALL_YOGA_TYPES,
    instants,
    sweep,
    filterAt,
    byType,
    twoTypes,
    emptyFilter,
    nodeAspects59,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'yogas-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  const fired = new Set<string>();
  for (const s2 of sweep) for (const y of s2.yogasWithNavamsa) fired.add(y.name);
  process.stderr.write(
    `wrote yogas-golden.json (${sweep.length} charts, ${YOGA_CATALOG.length} catalog rules, ` +
    `${fired.size} distinct yogas fired)\n`,
  );
}

// Every dasha result below is taken as of a fixed `asOfDate`, so Go must pass
// the same instant as its `asOfMs`. Period boundaries are
// `new Date(cursor + durationMs)` over a float `durationMs`, which differs
// between languages by at most an ULP (~5e-4 ms at 4e12 ms) before `new Date()`
// truncates, so truncation absorbs it UNLESS the float lands within an ULP of
// an exact integer.

const DASHA_SEED = 0xDA54A000 >>> 0;
const DASHA_MS_LO = Date.UTC(1900, 0, 1), DASHA_MS_HI = Date.UTC(2100, 0, 1);
const DASHA_SAMPLES = 40;

/** ms in a Julian year, restated from `dasha.ts`. */
const DASHA_YEAR_MS = 365.25 * 24 * 3600 * 1000;

/**
 * 110 y is past Yogini (36 y), Chara and Narayan (96 y) and Ashtottari (108 y)
 * but inside Vimshottari (120 y); 130 y is past every system and clamps to 0.
 */
const DASHA_PIN_OFFSETS: readonly number[] = [
  -1, 0,
  Math.round(3.5 * DASHA_YEAR_MS),
  Math.round(25 * DASHA_YEAR_MS),
  Math.round(60 * DASHA_YEAR_MS),
  Math.round(110 * DASHA_YEAR_MS),
  Math.round(130 * DASHA_YEAR_MS),
];

/** The library's "which period is current" rule, re-derived from the periods. */
function dashaIndexAt(
  periods: readonly { startDate: Date; endDate: Date }[],
  atMs: number,
): number {
  const at = new Date(atMs);
  const i = periods.findIndex((p) => at >= p.startDate && at < p.endDate);
  return Math.max(0, i);
}

const DASHA_AS_OF_MS = Date.UTC(2026, 7, 23, 0, 0, 0, 0);
const DASHA_AS_OF = new Date(DASHA_AS_OF_MS);

/** The assertion is what makes `pinOffsets` meaningful rather than circular. */
function pinCurrent(
  label: string,
  result: { currentIndex: number; mahaDashas: readonly { startDate: Date; endDate: Date }[] },
  birthMs: number,
): number[] {
  const rederived = dashaIndexAt(result.mahaDashas, DASHA_AS_OF_MS);
  if (rederived !== result.currentIndex) {
    throw new Error(
      `dashaIndexAt disagrees with ${label} at the pin: library said ` +
      `${result.currentIndex}, re-derivation said ${rederived}.`,
    );
  }
  return DASHA_PIN_OFFSETS.map((off) => dashaIndexAt(result.mahaDashas, birthMs + off));
}

/**
 * On and one ULP either side of a nakshatra boundary: both extremes of the
 * first mahadasha's clip are unreachable by a random sweep.
 */
function dashaBoundaryMoonLons(): number[] {
  const out: number[] = [];
  for (const k of [0, 1, 8, 9, 17, 18, 26]) {
    const b = k * NAKSHATRA_SPAN;
    if (b > 0) out.push(nextAfter(b, -1));
    out.push(b, nextAfter(b, 361));
  }
  out.push(0.5, 6.6666, 13.3, 180, 359.9, 359.99999999999994);
  return out.filter((x) => x >= 0 && x < 360).sort((a, b) => a - b);
}

function nextAfter(x: number, toward: number): number {
  if (x === toward) return x;
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  let bits = buf.getBigUint64(0);
  if ((toward > x) === (x >= 0)) bits += 1n; else bits -= 1n;
  buf.setBigUint64(0, bits);
  return buf.getFloat64(0);
}

/**
 * Branch 4(a) needs Mars and Ketu in Scorpio at once, roughly 0.7% of instants,
 * so it is scanned for rather than sampled.
 */
function narayanRule4Cases(): { label: string; ms: number }[] {
  const found = new Map<string, number[]>();
  const step = 15 * 86_400_000;
  for (let ms = DASHA_MS_LO; ms < DASHA_MS_HI; ms += step) {
    const p = computePlanetaryPositions(new Date(ms), 'lahiri');
    const r = (lon: number) => Math.floor(lon / 30) % 12;
    for (const [rashi, ra, rb] of [
      [7, r(p.mars.siderealLongitude), r(p.ketu.siderealLongitude)],
      [10, r(p.saturn.siderealLongitude), r(p.rahu.siderealLongitude)],
    ] as const) {
      let label: string;
      if (ra === rashi && rb === rashi) label = `${rashi}-a-both-in`;
      else if (ra === rb) label = `${rashi}-b-joint`;
      else if (ra === rashi) label = `${rashi}-c-lordA-in`;
      else if (rb === rashi) label = `${rashi}-c-lordB-in`;
      else label = `${rashi}-d-split`;
      const bucket = found.get(label) ?? [];
      if (bucket.length < 2) { bucket.push(ms); found.set(label, bucket); }
    }
  }
  const out: { label: string; ms: number }[] = [];
  for (const label of [...found.keys()].sort()) {
    for (const ms of found.get(label)!) out.push({ label, ms });
  }
  return out;
}

/**
 * Rule 4(d) with the planet counts TIED, the only path on which the aspect
 * factors decide the winner, and rare among sampled charts.
 */
function narayanRule4TiebreakCases(): { label: string; ms: number }[] {
  const found = new Map<string, number[]>();
  const step = 5 * 86_400_000;
  for (let ms = DASHA_MS_LO; ms < DASHA_MS_HI; ms += step) {
    const p = computePlanetaryPositions(new Date(ms), 'lahiri');
    const r = (lon: number) => Math.floor(lon / 30) % 12;
    const all = [p.sun, p.moon, p.mars, p.mercury, p.jupiter, p.venus, p.saturn, p.rahu, p.ketu]
      .map((g) => r(g.siderealLongitude));
    const count = (rashi: number) => all.filter((x) => x === rashi).length;
    for (const [rashi, ra, rb] of [
      [7, r(p.mars.siderealLongitude), r(p.ketu.siderealLongitude)],
      [10, r(p.saturn.siderealLongitude), r(p.rahu.siderealLongitude)],
    ] as const) {
      if (ra === rashi || rb === rashi || ra === rb) continue;
      if (count(ra) !== count(rb)) continue;
      const label = `${rashi}-d-tie`;
      const bucket = found.get(label) ?? [];
      if (bucket.length < 6) { bucket.push(ms); found.set(label, bucket); }
    }
  }
  const out: { label: string; ms: number }[] = [];
  for (const label of [...found.keys()].sort()) {
    for (const ms of found.get(label)!) out.push({ label, ms });
  }
  return out;
}

function writeDashaGolden(): void {
  const locs = [
    { name: 'pune', latitude: 18.5204, longitude: 73.8567 },
    { name: 'delhi', latitude: 28.6139, longitude: 77.209 },
    { name: 'sydney', latitude: -33.8688, longitude: 151.2093 },
    { name: 'london', latitude: 51.5074, longitude: -0.1278 },
    { name: 'newyork', latitude: 40.7128, longitude: -74.006 },
    { name: 'quito', latitude: -0.1807, longitude: -78.4678 },
  ];

  const instants: number[] = [];
  for (const u of unit01(DASHA_SEED, DASHA_SAMPLES)) {
    instants.push(Math.floor(DASHA_MS_LO + u * (DASHA_MS_HI - DASHA_MS_LO)));
  }
  for (const e of CHART_EVENTS) instants.push(e.ms);

  const sweep = instants.map((ms, i) => {
    const loc = i < DASHA_SAMPLES ? locs[i % locs.length]! : CHART_EVENTS[i - DASHA_SAMPLES]!.loc;
    const birth = new Date(ms);
    const moonLon = getSiderealMoonLongitude(birth, 'lahiri');

    const vim = computeVimshottariDasha(birth, moonLon, DASHA_AS_OF);
    const ash = computeAshtottariDasha(birth, moonLon, DASHA_AS_OF);
    const yog = computeYoginiDasha(birth, moonLon, DASHA_AS_OF);
    const cha = computeCharaDasha(birth, loc, undefined, DASHA_AS_OF);
    const narF = computeNarayanDasha(birth, loc, undefined, { asOfDate: DASHA_AS_OF });
    const narV = computeNarayanDasha(birth, loc, undefined,
      { duration: 'variable', asOfDate: DASHA_AS_OF });

    const vimP = pinCurrent('computeVimshottariDasha', vim, ms);
    const ashP = pinCurrent('computeAshtottariDasha', ash, ms);
    const yogP = pinCurrent('computeYoginiDasha', yog, ms);
    const chaP = pinCurrent('computeCharaDasha', cha, ms);
    const narFP = pinCurrent('computeNarayanDasha(fixed)', narF, ms);
    const narVP = pinCurrent('computeNarayanDasha(variable)', narV, ms);

    // The SECOND mahadasha's first antardasha: the first mahadasha's is clipped.
    const ad = vim.mahaDashas[1]!.antarDashas[0]!;
    return {
      ms,
      loc: loc.name,
      moonLon,
      vimshottari: vim,
      vimshottariAtPins: vimP,
      ashtottari: ash,
      ashtottariAtPins: ashP,
      yogini: yog,
      yoginiAtPins: yogP,
      chara: cha,
      charaAtPins: chaP,
      narayanFixed: narF,
      narayanFixedAtPins: narFP,
      narayanVariable: narV,
      narayanVariableAtPins: narVP,
      pratyantarOf: { lord: ad.lord, startDate: ad.startDate, endDate: ad.endDate },
      pratyantar: computeVimshottariPratyantar(ad),
    };
  });

  const boundaryBirthMs = Date.parse('1990-06-15T10:30:00.000Z');
  const boundaryLons = dashaBoundaryMoonLons();
  const boundary = boundaryLons.map((lon) => {
    const birth = new Date(boundaryBirthMs);
    const vim = computeVimshottariDasha(birth, lon, DASHA_AS_OF);
    const ash = computeAshtottariDasha(birth, lon, DASHA_AS_OF);
    const yog = computeYoginiDasha(birth, lon, DASHA_AS_OF);
    return {
      moonLon: lon,
      nakIdx: nakshatraOf(lon),
      vimshottari: vim,
      // Says whether the balance method was ported or the proportional one.
      firstMahaAntarCount: vim.mahaDashas[0]!.antarDashas.length,
      ashtottari: ash,
      yogini: yog,
    };
  });

  const pratBirth = new Date(boundaryBirthMs);
  // The Go side must feed `computeVimshottariDasha` THIS longitude, not its own,
  // or an ULP-level ephemeris difference shows up here as a dasha defect. The
  // ephemeris-fed path is pinned separately by `fromBirth`.
  const boundaryBirthMoonLon = getSiderealMoonLongitude(pratBirth, 'lahiri');
  const pratVim = computeVimshottariDasha(pratBirth, boundaryBirthMoonLon, DASHA_AS_OF);
  const pratyantarAll = [0, 1].flatMap((m) =>
    pratVim.mahaDashas[m]!.antarDashas.map((a, ai) => ({
      maha: m, antar: ai, lord: a.lord,
      periods: computeVimshottariPratyantar(a),
    })));

  const fromBirth = (['lahiri', 'raman', 'krishnamurti', 'true-chitra', 'thirukanitham'] as const)
    .map((a) => ({
      ayanamsa: a,
      result: computeVimshottariDashaFromBirth(new Date(boundaryBirthMs), a, DASHA_AS_OF),
    }));
  const fromBirthDefault = computeVimshottariDashaFromBirth(
    new Date(boundaryBirthMs), undefined, DASHA_AS_OF);

  const rule4dTie = narayanRule4TiebreakCases().map((c) => ({
    label: c.label,
    ms: c.ms,
    variable: computeNarayanDasha(new Date(c.ms), locs[0]!, undefined,
      { duration: 'variable', asOfDate: DASHA_AS_OF }),
  }));

  const rule4 = narayanRule4Cases().map((c) => ({
    label: c.label,
    ms: c.ms,
    variable: computeNarayanDasha(new Date(c.ms), locs[0]!, undefined,
      { duration: 'variable', asOfDate: DASHA_AS_OF }),
  }));

  // The three instants that decide `>= start` and `< end`.
  const bp = sweep[0]!.vimshottari['mahaDashas'] as unknown as { startDate: Date; endDate: Date }[];
  const halfOpenPins: { pinMs: number; index: number }[] = [];
  for (const k of [0, 1, 8]) {
    for (const pin of [bp[k]!.startDate.getTime(), bp[k]!.endDate.getTime() - 1, bp[k]!.endDate.getTime()]) {
      halfOpenPins.push({ pinMs: pin, index: dashaIndexAt(bp, pin) });
    }
  }

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/dasha.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the later uncommitted fixes',
      claim:
        'Exact equality on every published instant (int64 epoch ms) and every ' +
        'lord, rashi and Yogini name. No tolerance: the periods are Dates, and ' +
        "`new Date()`'s truncation quantises the float duration to a whole " +
        'millisecond, three orders coarser than an ULP of the instant.',
      why:
        'The five entry points used to read an argless `new Date()`, so ' +
        '`currentIndex` and its companions were masked and re-derived at fixed ' +
        'pins. `asOfDate` (2026-08-24) removed the need: every result here is ' +
        'taken as of `asOf` below and the four leaves are ordinary pinned ' +
        'values. The generator still asserts the library agrees with ' +
        '`dashaIndexAt` at that instant, and `pinOffsets` still walks the rule ' +
        'across the whole arc, which one instant cannot. Every antardasha of ' +
        'every mahadasha is carried leaf-for-leaf rather than digested, ' +
        'because a digest cannot distinguish a lord rotation or a clip-count ' +
        'change from a value change, and both are one transposed index away.',
      span: [new Date(DASHA_MS_LO).toISOString(), new Date(DASHA_MS_HI).toISOString()],
      asOf: new Date(DASHA_AS_OF_MS).toISOString(),
    },
    seed: DASHA_SEED,
    samples: DASHA_SAMPLES,
    msLo: DASHA_MS_LO,
    msHi: DASHA_MS_HI,
    // Every location the sweep names, so the Go side resolves a name to
    // coordinates from the golden rather than from a second hand-typed copy.
    locations: [
      ...locs,
      ...CHART_EVENTS.map((e) => e.loc).filter((l) => !locs.some((x) => x.name === l.name)),
    ],
    pinOffsets: DASHA_PIN_OFFSETS,
    msPerYear: DASHA_YEAR_MS,
    dashaYears: DASHA_YEARS,
    dashaOrder: DASHA_ORDER,
    nakshatraLord: NAKSHATRA_LORD,
    ashtottariOrder: ASHTOTTARI_ORDER,
    ashtottariYears: ASHTOTTARI_YEARS,
    ashtottariGroups: ASHTOTTARI_NAKSHATRA_GROUPS,
    yoginiOrder: YOGINI_ORDER,
    yoginiYears: YOGINI_YEARS,
    yoginiPlanet: YOGINI_PLANET,
    charaRashiYears: CHARA_RASHI_YEARS,
    vishamaPadaRashis: [...VISHAMA_PADA_RASHIS].sort((a, b) => a - b),
    samaPadaRashis: [...SAMA_PADA_RASHIS].sort((a, b) => a - b),
    instants,
    sweep,
    boundaryBirthMs,
    boundaryBirthMoonLon,
    boundary,
    pratyantarAll,
    fromBirth,
    fromBirthDefault,
    rule4,
    rule4dTie,
    halfOpenPins,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'dasha-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  const dirs = new Set(sweep.map((s) => s.narayanFixed['direction'] as string));
  process.stderr.write(
    `wrote dasha-golden.json (${sweep.length} charts, ${boundary.length} boundary lons, ` +
    `${rule4.length} Rule-4 cases across ${new Set(rule4.map((r) => r.label)).size} branches, ` +
    `narayan directions: ${[...dirs].sort().join('+')})\n`,
  );
}

// Two traps in `sadeSati.ts`. Its iteration bounds are non-integral: `10950 / 7`
// is 1564.2857 and `i < maxIters` runs 1565 iterations, where a Go port using
// int constants divides to 1564 and loses the last step. And `findNextEntry`
// assigns a FRACTIONAL midpoint back into `lo` or `hi`, where int64 endpoints
// would floor at every step and converge somewhere else.

const SADESATI_MS_LO = Date.UTC(1930, 0, 1), SADESATI_MS_HI = Date.UTC(2070, 0, 1);
const SADESATI_SAMPLES = 24;

function writeSadeSatiGolden(): void {
  // A regular grid, not a seeded one: against Saturn's 29.5-year cycle an even
  // spread reaches every phase for every natal rashi, where a draw could clump.
  const instants: number[] = [];
  for (let i = 0; i < SADESATI_SAMPLES; i++) {
    instants.push(Math.floor(
      SADESATI_MS_LO + ((SADESATI_MS_HI - SADESATI_MS_LO) * i) / SADESATI_SAMPLES));
  }

  const sweep: unknown[] = [];
  for (const ms of instants) {
    for (let rashi = 0; rashi < 12; rashi++) {
      sweep.push({ ms, rashi, result: computeSadeSati(rashi, new Date(ms)) });
    }
  }

  // The boundary is FOUND rather than hardcoded: `active` must flip exactly once.
  const walkRashi = 0;
  let anchor: number | null = null;
  for (const ms of instants) {
    const r = computeSadeSati(walkRashi, new Date(ms));
    if (r.active && r.currentArcEnd) { anchor = r.currentArcEnd.getTime(); break; }
  }
  if (anchor === null) {
    throw new Error('sade sati golden: no active arc found for the walk anchor');
  }
  const walk: unknown[] = [];
  for (let d = -30; d <= 30; d++) {
    const ms = anchor + d * 86400_000;
    walk.push({ ms, result: computeSadeSati(walkRashi, new Date(ms)) });
  }

  // A different ayanamsa moves the arcs: ~1.5 deg is ~18 days of Saturn.
  const ayanamsaAt = instants[Math.floor(SADESATI_SAMPLES / 2)]!;
  const byAyanamsa = (['lahiri', 'raman', 'krishnamurti', 'true-chitra', 'thirukanitham'] as const)
    .map((a) => ({ ayanamsa: a, result: computeSadeSati(3, new Date(ayanamsaAt), a) }));
  const defaultAyanamsa = computeSadeSati(3, new Date(ayanamsaAt));

  const saturnRashis = instants.map((ms) => {
    const tropical = getTropicalPlanetLongitude('saturn', new Date(ms));
    const sidereal = normalize360(tropical - computeAyanamsa(new Date(ms), 'lahiri'));
    return { ms, siderealLongitude: sidereal, rashi: Math.floor(sidereal / 30) };
  });

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/sadeSati.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the later uncommitted fixes',
      claim:
        'Exact equality on every leaf: active, phase, and three day-precision ' +
        'instants. Nothing here is a float on the wire.',
      why:
        'The file is three scan loops, not a formula. Two of its iteration ' +
        'bounds are non-integral divisions that a Go int port would truncate ' +
        '(docs/porting.md 1.7), and findNextEntry bisects with float endpoints that ' +
        'a D4-style int64 port would floor. Neither shows up except at a scan ' +
        'or arc boundary, so the golden carries a day-by-day walk across a real ' +
        'boundary as well as a phase sweep.',
      span: [new Date(SADESATI_MS_LO).toISOString(), new Date(SADESATI_MS_HI).toISOString()],
    },
    msLo: SADESATI_MS_LO,
    msHi: SADESATI_MS_HI,
    samples: SADESATI_SAMPLES,
    stabilityDays: 90,
    coarseStepDays: 7,
    maxForwardScanDays: 30 * 365,
    maxBackwardScanDays: 12 * 365,
    instants,
    saturnRashis,
    sweep,
    walkRashi,
    walkAnchorMs: anchor,
    walk,
    ayanamsaAt,
    byAyanamsa,
    defaultAyanamsa,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'sadesati-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  const phases = new Set(sweep.map((s) => (s as { result: { phase: number | null } }).result.phase));
  const actives = sweep.filter((s) => (s as { result: { active: boolean } }).result.active).length;
  process.stderr.write(
    `wrote sadesati-golden.json (${sweep.length} sweep cases, ${actives} active, ` +
    `phases ${[...phases].sort().join('/')}, ${walk.length} walk days)\n`,
  );
}

// Three integer-division traps in `upagrahas.ts`. `DHUMA_OFFSET_DEG` and
// `UPAKETU_OFFSET_DEG` fold to 133 and 16 in a Go int transcription, deleting
// the arcminute term outright while staying plausible. `segLen = dayMs / 8` is
// a float that truncates once, later, where an int64 segment length floors
// first. And `(location.longitude / 15) * 3600_000` divides AND feeds an
// addition.

const UPAGRAHA_SEED = 0x0BA9AA11 >>> 0;
const UPAGRAHA_MS_LO = Date.UTC(1900, 0, 1), UPAGRAHA_MS_HI = Date.UTC(2100, 0, 1);
const UPAGRAHA_SAMPLES = 60;
const UPAGRAHA_WALK_DAYS = 14;
const UPAGRAHA_WALK_HOURS = [0, 6, 12, 18];

function writeUpagrahaGolden(): void {
  const locs = [
    { name: 'pune', latitude: 18.5204, longitude: 73.8567 },
    { name: 'tokyo', latitude: 35.6762, longitude: 139.6503 },
    { name: 'newyork', latitude: 40.7128, longitude: -74.006 },
    { name: 'sydney', latitude: -33.8688, longitude: 151.2093 },
    { name: 'reykjavik', latitude: 64.1466, longitude: -21.9426 },
    // Longyearbyen is the only location here above the Arctic Circle, so the only
    // one that makes `computeSunrise` / `computeSunset` throw. Reykjavik is 2.4
    // deg short of it and never loses a sunrise.
    { name: 'longyearbyen', latitude: 78.2232, longitude: 15.6267 },
  ];

  // Tokyo and Pune sit east of ~82 E, where local sunrise can fall before 00:00
  // UTC and `getUTCDay()` on the raw sunrise names yesterday. Drop the LMT shift
  // and they take the wrong Gulika slot, ~15-25 deg of ascendant.
  const walkStart = Date.UTC(2024, 2, 1);
  const cases: { ms: number; loc: string }[] = [];
  for (const loc of locs) {
    for (let d = 0; d < UPAGRAHA_WALK_DAYS; d++) {
      for (const h of UPAGRAHA_WALK_HOURS) {
        cases.push({ ms: walkStart + d * 86400_000 + h * 3600_000, loc: loc.name });
      }
    }
  }
  // Midsummer and midwinter, where the Sun neither rises nor sets.
  for (const d0 of [Date.UTC(2024, 5, 15), Date.UTC(2024, 11, 15)]) {
    for (let d = 0; d < 6; d++) {
      cases.push({ ms: d0 + d * 86400_000 + 12 * 3600_000, loc: 'longyearbyen' });
    }
  }
  for (const u of unit01(UPAGRAHA_SEED, UPAGRAHA_SAMPLES)) {
    cases.push({
      ms: Math.floor(UPAGRAHA_MS_LO + u * (UPAGRAHA_MS_HI - UPAGRAHA_MS_LO)),
      loc: 'pune',
    });
  }

  // Both the failure AND its code are pinned: a Go port returning a zero-valued
  // result would otherwise look identical to a case that was simply skipped.
  const sweep = cases.map((c) => {
    const loc = locs.find((l) => l.name === c.loc)!;
    try {
      const seg = _locateGulikaSegmentForTest(new Date(c.ms), loc);
      // The EFFECTIVE day/night boundary, from `lagna.ts`'s `findSunriseBefore`,
      // character-identical to `upagrahas.ts`'s own copy.
      const baseSunrise = findSunriseBefore(new Date(c.ms), loc);
      const baseSunset = computeSunset(baseSunrise, loc);
      return {
        ms: c.ms, loc: c.loc, ok: true,
        day: c.ms < baseSunset.getTime(),
        // The other horizon convention, the Sun's apparent CENTRE, kept so the two can
        // be compared over the 65-404 s window where they disagree.
        apparentCentreUp: isSunAboveHorizon(new Date(c.ms), loc),
        segmentStart: seg.start,
        segmentMidpoint: seg.midpoint,
        upagrahas: computeUpagrahas(new Date(c.ms), loc),
      };
    } catch (err) {
      return { ms: c.ms, loc: c.loc, ok: false, code: (err as { code?: string }).code ?? null };
    }
  });

  const optAt = Date.UTC(1995, 7, 15, 5, 30);
  const optLoc = locs[0]!;
  const byLanguage = (['en', 'hi'] as const).map((language) => ({
    language, result: computeUpagrahas(new Date(optAt), optLoc, { language }),
  }));
  const byAyanamsa = (['lahiri', 'raman', 'krishnamurti', 'true-chitra', 'thirukanitham'] as const)
    .map((ayanamsa) => ({
      ayanamsa, result: computeUpagrahas(new Date(optAt), optLoc, { ayanamsa }),
    }));
  const defaults = computeUpagrahas(new Date(optAt), optLoc);
  // `houseSystem` is documented as ignored; pinned so that is checkable.
  const withPlacidus = computeUpagrahas(new Date(optAt), optLoc, { houseSystem: 'placidus-kp' });

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/upagrahas.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the later uncommitted fixes',
      claim:
        'Segment start and midpoint: exact int64 equality. Longitudes: bounded ' +
        'by the lagna bound, since Gulika and Mandi ARE ascendants. Rashi, ' +
        'rashiName and house: exact, being a floor and two table lookups.',
      why:
        'Two inputs select a different code path rather than a different ' +
        'number, day-vs-night and the weekday, and between them they choose ' +
        'one of fourteen Gulika slots. The walk covers all fourteen; the ' +
        'seeded sweep covers ephemeris state. Segment timing is pinned apart ' +
        'from the ascendant so a divergence localises.',
      span: [new Date(UPAGRAHA_MS_LO).toISOString(), new Date(UPAGRAHA_MS_HI).toISOString()],
    },
    seed: UPAGRAHA_SEED,
    samples: UPAGRAHA_SAMPLES,
    walkStart,
    walkDays: UPAGRAHA_WALK_DAYS,
    walkHours: UPAGRAHA_WALK_HOURS,
    locations: locs,
    dayGulikaSlot: GULIKA_SLOTS,
    nightGulikaSlot: [2, 1, 0, 6, 5, 4, 3],
    dhumaOffsetDeg: 133 + 20 / 60,
    upaketuOffsetDeg: 16 + 40 / 60,
    sweep,
    optAt,
    byLanguage,
    byAyanamsa,
    defaults,
    withPlacidus,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'upagrahas-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  const ok = sweep.filter((s) => s.ok).length;
  const days = sweep.filter((s) => s.ok && (s as { day: boolean }).day).length;
  const disagree = sweep.filter((s) => s.ok
    && (s as { day: boolean }).day !== (s as { apparentCentreUp: boolean }).apparentCentreUp).length;
  process.stderr.write(
    `wrote upagrahas-golden.json (${sweep.length} cases, ${ok} ok, ${days} day-births, ` +
    `${sweep.length - ok} polar failures, ${disagree} where the two horizon ` +
    `conventions disagree)\n`,
  );
}

// Three traps in `varshaphala.ts`. `SUN_DEG_PER_DAY = 360 / 365.25636` folds to
// `0.98560912122105137634` as an untyped Go constant and
// `0.98560912122105148736` in JavaScript, one ULP apart; the golden carries the
// JavaScript value so the Go side asserts it rather than deriving it.
// `findSolarReturn` keeps `t` as a float across every iteration. And
// `evaluateSaham` adds 30 deg when Z does not fall in the arc from Y to X,
// which omitted leaves half of all published Sahams one sign short.

const VARSHA_SEED = 0x7A11C000 >>> 0;
const VARSHA_MS_LO = Date.UTC(1930, 0, 1), VARSHA_MS_HI = Date.UTC(2010, 0, 1);
const VARSHA_SAMPLES = 24;
const VARSHA_AGES = [1, 7, 30, 61];

function writeVarshaphalaGolden(): void {
  const locs = [
    { name: 'pune', latitude: 18.5204, longitude: 73.8567 },
    { name: 'delhi', latitude: 28.6139, longitude: 77.209 },
    { name: 'newyork', latitude: 40.7128, longitude: -74.006 },
    { name: 'sydney', latitude: -33.8688, longitude: 151.2093 },
  ];

  const births: number[] = [];
  for (const u of unit01(VARSHA_SEED, VARSHA_SAMPLES)) {
    births.push(Math.floor(VARSHA_MS_LO + u * (VARSHA_MS_HI - VARSHA_MS_LO)));
  }

  const sweep = births.map((ms, i) => {
    const loc = locs[i % locs.length]!;
    const age = VARSHA_AGES[i % VARSHA_AGES.length]!;
    return {
      ms, loc: loc.name, age,
      chart: computeVarshaphala(new Date(ms), age, loc),
    };
  });

  const solarReturns: unknown[] = [];
  for (const ms of births) {
    const natalSun = getSiderealSunLongitude(new Date(ms), 'lahiri');
    for (const age of [1, 2, 5, 17, 40, 88]) {
      solarReturns.push({
        ms, age, natalSun,
        instant: findSolarReturn(new Date(ms), age, natalSun, 'lahiri').getTime(),
      });
    }
  }
  const solarReturnsByAyanamsa =
    (['lahiri', 'raman', 'krishnamurti', 'true-chitra', 'thirukanitham'] as const).map((a) => {
      const ms = births[0]!;
      const natalSun = getSiderealSunLongitude(new Date(ms), a);
      return {
        ayanamsa: a, ms, natalSun,
        instant: findSolarReturn(new Date(ms), 30, natalSun, a).getTime(),
      };
    });

  const triraashi: { rashi: number; day: string; night: string }[] = [];
  for (let r = 0; r < 12; r++) {
    triraashi.push({
      rashi: r,
      day: _triraashiPatiForTest(r, true),
      night: _triraashiPatiForTest(r, false),
    });
  }

  // Punya is supplied to the rows that reference it.
  const sahamAt = births[0]!;
  const sahamLoc = locs[0]!;
  const sahamChart = computeRashiChart(
    findSolarReturn(new Date(sahamAt), 30,
      getSiderealSunLongitude(new Date(sahamAt), 'lahiri'), 'lahiri'),
    sahamLoc);
  const perFormula = [true, false].map((isDay) => {
    const prior: Partial<Record<SahamName, number>> = {};
    const rows = SAHAM_FORMULAS.map((f) => {
      const v = _evaluateSahamForTest(f, isDay, sahamChart, prior);
      prior[f.name] = v;
      return { name: f.name, longitude: v };
    });
    return { isDay, rows };
  });

  const badAges = [0, -1, 2.5].map((age) => {
    try {
      computeVarshaphala(new Date(births[0]!), age as number, locs[0]!);
      return { age, threw: false, code: null as string | null };
    } catch (err) {
      return { age, threw: true, code: (err as { code?: string }).code ?? null };
    }
  });

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/{varshaphala,sahamsTables}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the later uncommitted fixes',
      claim:
        'Solar-return instants: exact int64 equality. Muntha, yearLord, ' +
        'isDayBirth, every rashi/house/name: exact. The 27 Saham longitudes ' +
        'and the varsha lagna: bounded, since both descend from a longitude.',
      why:
        'A live 1.2 constant-folding site (SUN_DEG_PER_DAY), a float ' +
        'accumulator with three different conversions in findSolarReturn, and ' +
        'a completion rule whose absence once left half the Sahams a sign ' +
        'short. Each is pinned separately from the aggregate chart.',
      span: [new Date(VARSHA_MS_LO).toISOString(), new Date(VARSHA_MS_HI).toISOString()],
    },
    seed: VARSHA_SEED,
    samples: VARSHA_SAMPLES,
    ages: VARSHA_AGES,
    locations: locs,
    siderealYearDays: 365.25636,
    // The JavaScript value of `360 / SIDEREAL_YEAR_DAYS`, NOT the
    // arbitrary-precision fold of the decimals.
    sunDegPerDay: 360 / 365.25636,
    sahamNames: ALL_SAHAM_NAMES,
    sahamFormulas: SAHAM_FORMULAS.map((f) => ({
      name: f.name, x: f.x, y: f.y, z: f.z, swap: f.swap,
    })),
    births,
    sweep,
    solarReturns,
    solarReturnsByAyanamsa,
    triraashi,
    sahamAt,
    perFormula,
    badAges,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'varshaphala-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  const days = sweep.filter((s) => s.chart.isDayBirth).length;
  const lords = new Set(sweep.map((s) => s.chart.yearLord));
  process.stderr.write(
    `wrote varshaphala-golden.json (${sweep.length} charts, ${days} day-returns, ` +
    `${lords.size} distinct year lords, ${solarReturns.length} solar returns)\n`,
  );
}


const VISIBLE_INDEX: Record<string, number> = {
  Sun: 0, Moon: 1, Mars: 2, Mercury: 3, Jupiter: 4, Venus: 5, Saturn: 6,
};

// The natal-sign correction shifts `tithiPravesha` by a synodic month when the
// first answer lands in the wrong sign, so the inner search is pinned apart
// from the wrapper. `kpSubLord.ts` publishes `byHouse` keyed by a NUMBER, which
// JavaScript emits in ascending numeric order and Go's `encoding/json` would
// emit as strings. `prashna.ts` is pinned against the same call with explicit
// options: the only way to tell a default from a force.

const KP_SWEEP_STEP = 0.001;
const KP_BOUNDARY_EPS = 1e-9;
const TP_SEED = 0x71704E5A >>> 0;
const TP_MS_LO = Date.UTC(1940, 0, 1), TP_MS_HI = Date.UTC(2000, 0, 1);
const TP_SAMPLES = 16;
const TP_AGES = [1, 12, 41];

function writeKpAndPraveshaGolden(): void {
  const locs = [
    { name: 'pune', latitude: 18.5204, longitude: 73.8567 },
    { name: 'delhi', latitude: 28.6139, longitude: 77.209 },
    { name: 'newyork', latitude: 40.7128, longitude: -74.006 },
    { name: 'sydney', latitude: -33.8688, longitude: 151.2093 },
  ];

  const n = Math.round(360 / KP_SWEEP_STEP);
  const rashi: number[] = [], nak: number[] = [], sign: number[] = [];
  const star: number[] = [], sub: number[] = [];
  const lons: number[] = [];
  for (let i = 0; i < n; i++) {
    const lon = i * KP_SWEEP_STEP;
    const info = computeKpSubLord(lon);
    lons.push(lon);
    rashi.push(info.rashi);
    nak.push(info.nakshatra);
    sign.push(VISIBLE_INDEX[info.signLord]!);
    star.push(DASHA_ORDER.indexOf(info.starLord));
    sub.push(DASHA_ORDER.indexOf(info.subLord));
  }
  const digests = {
    rashi: digestOver(rashi, (v) => v),
    nakshatra: digestOver(nak, (v) => v),
    signLord: digestOver(sign, (v) => v),
    starLord: digestOver(star, (v) => v),
    subLord: digestOver(sub, (v) => v),
  };

  // Every sub-boundary, probed a nanodegree either side. The offsets are PER
  // NAKSHATRA: nakshatra k's sub-divisions start from `NAKSHATRA_LORD[k]`, so
  // they coincide with `_SUB_CUMULATIVE_WIDTHS_FOR_TEST` only when `k % 9 === 0`,
  // and the shared table would yield probes that straddle nothing.
  const subCumFor = (k: number): number[] => {
    const startIdx = DASHA_ORDER.indexOf(NAKSHATRA_LORD[k]!);
    const out: number[] = [];
    let cum = 0;
    for (let i = 0; i < 9; i++) {
      cum += (DASHA_YEARS[DASHA_ORDER[(startIdx + i) % 9]!] / 120) * NAKSHATRA_SPAN;
      out.push(cum);
    }
    return out;
  };
  const boundaries: { lon: number; side: string; sub: number; star: number }[] = [];
  for (let k = 0; k < 27; k++) {
    const cums = subCumFor(k);
    for (let j = 0; j < 9; j++) {
      const b = k * NAKSHATRA_SPAN + cums[j]!;
      for (const [side, lon] of [['below', b - KP_BOUNDARY_EPS], ['above', b + KP_BOUNDARY_EPS]] as const) {
        if (lon < 0 || lon >= 360) continue;
        const info = computeKpSubLord(lon);
        boundaries.push({
          lon, side,
          sub: DASHA_ORDER.indexOf(info.subLord),
          star: DASHA_ORDER.indexOf(info.starLord),
        });
      }
    }
  }

  const kpCharts = CHART_EVENTS.map((e) => {
    try {
      const chart = computeRashiChart(new Date(e.ms), e.loc);
      return {
        name: e.name, ms: e.ms, loc: e.loc.name, ok: true,
        cuspal: computeKpCuspalSubLords(new Date(e.ms), e.loc),
        significators: computeKpSignificators(chart),
      };
    } catch (err) {
      return { name: e.name, ms: e.ms, loc: e.loc.name, ok: false,
        code: (err as { code?: string }).code ?? null };
    }
  });
  // `houseSystem` is forced and `ayanamsa` is a default, and that difference is
  // the whole content of the options handling.
  const kpOptionArms = {
    bare: computeKpCuspalSubLords(new Date(CHART_EVENTS[0]!.ms), CHART_EVENTS[0]!.loc),
    wholeSignRequested: computeKpCuspalSubLords(
      new Date(CHART_EVENTS[0]!.ms), CHART_EVENTS[0]!.loc, { houseSystem: 'whole-sign' }),
    lahiriRequested: computeKpCuspalSubLords(
      new Date(CHART_EVENTS[0]!.ms), CHART_EVENTS[0]!.loc, { ayanamsa: 'lahiri' }),
  };

  const tpBirths: number[] = [];
  for (const u of unit01(TP_SEED, TP_SAMPLES)) {
    tpBirths.push(Math.floor(TP_MS_LO + u * (TP_MS_HI - TP_MS_LO)));
  }
  const tpSweep = tpBirths.flatMap((ms, i) => {
    const loc = locs[i % locs.length]!;
    return TP_AGES.map((age) => ({
      ms, age, loc: loc.name,
      chart: computeTithiPravesha(new Date(ms), age, loc),
    }));
  });
  const tithiIndex: { sun: number; moon: number; idx: number }[] = [];
  for (let s = 0; s < 360; s += 37) {
    for (let d = 0; d < 360; d += 11) {
      tithiIndex.push({ sun: s, moon: (s + d) % 360, idx: _computeNatalTithiIndexForTest(s, (s + d) % 360) });
    }
  }
  for (let k = 0; k <= 30; k++) {
    for (const eps of [-1e-9, 0, 1e-9]) {
      const d = k * 12 + eps;
      if (d < 0 || d >= 360) continue;
      tithiIndex.push({ sun: 0, moon: d, idx: _computeNatalTithiIndexForTest(0, d) });
    }
  }

  const badTpAges = [0, -1].map((age) => {
    try {
      computeTithiPravesha(new Date(tpBirths[0]!), age, locs[0]!);
      return { age, threw: false, code: null as string | null };
    } catch (err) {
      return { age, threw: true, code: (err as { code?: string }).code ?? null };
    }
  });

  // A bare call must differ from an explicit one, or the wrapper does nothing.
  const prashnaAt = Date.UTC(2026, 4, 9, 14, 30);
  const prashnaLoc = { name: 'mumbai', latitude: 19.076, longitude: 72.8777 };
  const prashna = {
    at: prashnaAt,
    loc: prashnaLoc,
    bare: computePrashnaChart(new Date(prashnaAt), prashnaLoc),
    wholeSign: computePrashnaChart(new Date(prashnaAt), prashnaLoc, { houseSystem: 'whole-sign' }),
    lahiri: computePrashnaChart(new Date(prashnaAt), prashnaLoc, { ayanamsa: 'lahiri' }),
    equivalent: computeRashiChart(new Date(prashnaAt), prashnaLoc,
      { houseSystem: 'placidus-kp', ayanamsa: 'krishnamurti' }),
  };

  const file = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/jyotish/{tithiPravesha,kpSubLord,prashna}.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the later uncommitted fixes',
      claim:
        'KP sub-lords, sign lords and star lords: bit-identical over 360,000 ' +
        'longitudes and all 243 sub-boundaries. Tithi-pravesha instants: exact ' +
        'int64. The charts they carry: bounded by the lagna bound.',
      why:
        'byHouse is keyed by a NUMBER, which JavaScript emits in ascending ' +
        'numeric order and Go would emit as strings; the sub-lord is a float ' +
        'comparison against a running cumulative sum; and prashna.ts is 105 ' +
        'lines whose entire content is which defaults apply.',
    },
    sweepStep: KP_SWEEP_STEP,
    sweepPoints: n,
    boundaryEps: KP_BOUNDARY_EPS,
    subCumulativeWidths: _SUB_CUMULATIVE_WIDTHS_FOR_TEST,
    digests,
    explicit: lons.filter((_, i) => i % 4001 === 0).map((lon) => {
      const info = computeKpSubLord(lon);
      return {
        lon, rashi: info.rashi, nakshatra: info.nakshatra,
        signLord: info.signLord, starLord: info.starLord, subLord: info.subLord,
      };
    }),
    boundaries,
    kpCharts,
    kpOptionArms,
    tpBirths,
    tpAges: TP_AGES,
    locations: locs,
    tpSweep,
    tithiIndex,
    badTpAges,
    prashna,
  };
  mkdirSync(join(REPO, 'testdata', 'goldens', 'jyotish'), { recursive: true });
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'jyotish', 'kp-golden.json'),
    JSON.stringify(file, null, 2) + '\n',
    'utf8',
  );
  const subs = new Set(sub).size;
  const matched = tpSweep.filter((s) => s.chart.natalTithi === s.chart.praveshTithi).length;
  process.stderr.write(
    `wrote kp-golden.json (${n} sweep points, ${subs} distinct sub-lords, ` +
    `${boundaries.length} boundary probes, ${tpSweep.length} pravesha charts, ` +
    `${matched} with praveshTithi === natalTithi)\n`,
  );
}


// Every flag here is DERIVED from consecutive sunrise tithis and rise/set
// searches, so the spans below are real, each chosen for a branch it reaches:
// shortening one silently stops testing that branch, and the counts are what
// make that loud. The anchors are digested separately, one of the nine being
// `new Date(sunset + night*0.3)`, the one FMA site in the file.
interface DfLocation {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly from: readonly [number, number, number];
  readonly days: number;
}

const DF_LOCATIONS: readonly DfLocation[] = [
  { name: 'Jaipur', latitude: 26.9124, longitude: 75.7873, timezone: 'Asia/Kolkata', from: [2024, 0, 1], days: 1827 },
  { name: 'Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', from: [2024, 0, 1], days: 2557 },
  { name: 'Pune', latitude: 18.5204, longitude: 73.8567, timezone: 'Asia/Kolkata', from: [2025, 0, 1], days: 730 },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata', from: [2025, 3, 1], days: 30 },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata', from: [2026, 3, 1], days: 30 },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata', from: [2027, 3, 1], days: 30 },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata', from: [2028, 3, 1], days: 30 },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata', from: [2029, 3, 1], days: 30 },
  { name: 'Kochi', latitude: 9.9312, longitude: 76.2673, timezone: 'Asia/Kolkata', from: [2025, 3, 1], days: 30 },
  { name: 'Kochi', latitude: 9.9312, longitude: 76.2673, timezone: 'Asia/Kolkata', from: [2026, 3, 1], days: 30 },
  { name: 'Kochi', latitude: 9.9312, longitude: 76.2673, timezone: 'Asia/Kolkata', from: [2027, 3, 1], days: 30 },
  { name: 'Kochi', latitude: 9.9312, longitude: 76.2673, timezone: 'Asia/Kolkata', from: [2028, 3, 1], days: 30 },
  { name: 'Kochi', latitude: 9.9312, longitude: 76.2673, timezone: 'Asia/Kolkata', from: [2029, 3, 1], days: 30 },
  { name: 'Kolkata', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata', from: [2025, 3, 1], days: 30 },
  { name: 'Kolkata', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata', from: [2026, 3, 1], days: 30 },
  { name: 'Kolkata', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata', from: [2027, 3, 1], days: 30 },
  { name: 'Kolkata', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata', from: [2028, 3, 1], days: 30 },
  { name: 'Kolkata', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata', from: [2029, 3, 1], days: 30 },
  { name: 'Amritsar', latitude: 31.634, longitude: 74.8723, timezone: 'Asia/Kolkata', from: [2025, 3, 1], days: 30 },
  { name: 'Amritsar', latitude: 31.634, longitude: 74.8723, timezone: 'Asia/Kolkata', from: [2026, 3, 1], days: 30 },
  { name: 'Amritsar', latitude: 31.634, longitude: 74.8723, timezone: 'Asia/Kolkata', from: [2027, 3, 1], days: 30 },
  { name: 'Amritsar', latitude: 31.634, longitude: 74.8723, timezone: 'Asia/Kolkata', from: [2028, 3, 1], days: 30 },
  { name: 'Amritsar', latitude: 31.634, longitude: 74.8723, timezone: 'Asia/Kolkata', from: [2029, 3, 1], days: 30 },
  // Lohri and Pahili/Basi Raja are day-before / day-after markers.
  { name: 'Amritsar', latitude: 31.634, longitude: 74.8723, timezone: 'Asia/Kolkata', from: [2026, 0, 1], days: 31 },
  { name: 'Bhubaneswar', latitude: 20.2961, longitude: 85.8245, timezone: 'Asia/Kolkata', from: [2026, 5, 1], days: 30 },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney', from: [2026, 0, 1], days: 365 },
  { name: 'Reykjavik', latitude: 64.1466, longitude: -21.9426, timezone: 'Atlantic/Reykjavik', from: [2026, 0, 1], days: 365 },
  // Long spans, because the polar catch sites are reached only in the
  // two-or-three-day windows where polar night or midnight sun begins, and only
  // when the day's own triple still resolves. `polarHits` keeps that honest.
  { name: 'Longyearbyen', latitude: 78.2232, longitude: 15.6267, timezone: 'Arctic/Longyearbyen', from: [2024, 0, 1], days: 4383 },
  { name: 'Alert', latitude: 82.5018, longitude: -62.3481, timezone: 'America/Toronto', from: [2024, 0, 1], days: 2192 },
] as const;

const DF_REGIONS = ['all', 'punjab', 'kerala', 'west-bengal', 'tamil-nadu', 'odisha'] as const;

interface DfDayOut {
  readonly label: string;
  readonly sunrise: number | null;
  readonly sunset: number | null;
  readonly nextSunrise: number | null;
  readonly anchors: readonly number[] | null;
  readonly festivals: readonly { key: string; type: string; description: string | null }[] | null;
  readonly outcome: string;
}

/**
 * Transcribed rather than imported: they are inline in `dayFestivals.ts` with
 * no seam to reach them through. Pinning against a COPY is normally wrong; the
 * mitigation is that the same expressions feed the festival digest, so a
 * transcription error shows up as an anchor/digest disagreement.
 */
function dfAnchors(sunrise: number, sunset: number, nextSunrise: number): number[] {
  const dayLength = sunset - sunrise;
  return [
    new Date(sunrise + dayLength / 2).getTime(),
    new Date(sunrise + (dayLength * 8) / 10).getTime(),
    new Date(sunset + 60 * 60_000).getTime(),
    new Date((sunset + nextSunrise) / 2).getTime(),
    new Date(sunrise - 96 * 60_000).getTime(),
    new Date(sunrise + dayLength / 4).getTime(),
    new Date(sunrise + (dayLength * 3) / 5).getTime(),
    sunset,
    new Date(sunset + (nextSunrise - sunset) * 0.3).getTime(),
  ];
}

function writeDayFestivalsGolden(): void {
  const h = createHash('sha256');
  const ah = createHash('sha256');
  const keyCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const outcomeCounts: Record<string, number> = {};
  const cases: DfDayOut[] = [];
  const polarHits: Record<string, number> = {
    tomorrowSunset: 0, dayAfterSunrise: 0, dayBeforeYesterday: 0, reached: 0,
  };
  // These fire nearly daily, so excluding them keeps the explicit-case list a
  // bisection aid rather than a copy of the sweep.
  const ROUTINE = new Set(['masik_karthigai', 'pradosha', 'sankranti']);

  let totalDays = 0;
  let emittingDays = 0;

  for (const loc of DF_LOCATIONS) {
    const geo = { latitude: loc.latitude, longitude: loc.longitude };
    const base = Date.UTC(loc.from[0], loc.from[1], loc.from[2], 6, 0, 0, 0);
    // The narrow regions ride the April and January/June windows, where every
    // regionally-gated rule lives.
    const regions: readonly string[] = loc.days <= 40 ? DF_REGIONS : ['all'];
    for (let i = 0; i < loc.days; i++) {
      const ms = base + i * 86_400_000;
      const date = new Date(ms);
      for (const region of regions) {
        totalDays++;
        const label = `${loc.name}|${dfIsoDay(ms)}|${region}`;
        let out: DfDayOut;
        try {
          const r = getDailyPanchang(date, geo, {
            timezone: loc.timezone,
            sections: ['festivals'],
            region: region as never,
          });
          if (r === null) {
            out = {
              label, sunrise: null, sunset: null, nextSunrise: null,
              anchors: null, festivals: null, outcome: 'null',
            };
          } else {
            // The same triple `getDailyPanchang` derived internally, redone here so the
            // anchors can be pinned.
            const sunrise = computeSunrise(
              getLocalMidnightUtc(date, resolveUtcOffset(loc.timezone, date)), geo);
            const sunset = computeSunset(sunrise, geo);
            const nextSunrise = computeSunrise(sunset, geo);
            out = {
              label,
              sunrise: sunrise.getTime(),
              sunset: sunset.getTime(),
              nextSunrise: nextSunrise.getTime(),
              anchors: dfAnchors(sunrise.getTime(), sunset.getTime(), nextSunrise.getTime()),
              festivals: r.festivals.map((f) => ({
                key: f.key, type: f.type, description: f.description ?? null,
              })),
              outcome: 'ok',
            };
            dfProbePolar(geo, sunrise, nextSunrise, polarHits);
          }
        } catch (e: unknown) {
          const code = e instanceof PanchangError ? e.code : 'THROW';
          out = {
            label, sunrise: null, sunset: null, nextSunrise: null,
            anchors: null, festivals: null, outcome: `error:${code}`,
          };
        }

        outcomeCounts[out.outcome] = (outcomeCounts[out.outcome] ?? 0) + 1;
        if (out.festivals !== null && out.festivals.length > 0) emittingDays++;
        for (const f of out.festivals ?? []) {
          keyCounts[f.key] = (keyCounts[f.key] ?? 0) + 1;
          typeCounts[f.type] = (typeCounts[f.type] ?? 0) + 1;
        }

        h.update(`${out.label} ${out.outcome} `);
        for (const f of out.festivals ?? []) {
          h.update(`${f.key}|${f.type}|${f.description ?? ''};`);
        }
        if (out.anchors !== null) {
          ah.update(`${out.label} ${out.sunrise} ${out.sunset} ${out.nextSunrise} `);
          for (const a of out.anchors) ah.update(`${a},`);
        }

        const interesting = (out.festivals ?? []).some((f) => !ROUTINE.has(f.key));
        if (interesting || out.outcome !== 'ok' || totalDays % 97 === 0) cases.push(out);
      }
    }
  }

  const golden = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/core/dayFestivals.ts via src/core/panchang.ts (sections: [festivals])',
      claim:
        'Go ComputeDayFestivals derives the same FestivalComputeContext from the ' +
        'same place and date as the TypeScript, and therefore emits the same ' +
        'festival list. The anchor digest pins the nine kala instants separately, ' +
        'because a wrong anchor is usually absorbed by the output.',
      note:
        'Driven through getDailyPanchang rather than computeDayFestivals directly, ' +
        'so the sunrise triple, the Bhadra window and the unclamped moonrise are ' +
        'the ones panchang.ts hands it, the seam is part of the claim.',
    },
    locations: DF_LOCATIONS,
    regions: DF_REGIONS,
    totalDays,
    emittingDays,
    digest: h.digest('hex'),
    anchorDigest: ah.digest('hex'),
    outcomeCounts,
    polarHits,
    keyCounts,
    typeCounts,
    cases,
  };

  const out = join(REPO, 'testdata', 'goldens', 'core', 'dayfestivals-golden.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(golden, null, 2) + '\n', 'utf8');
  process.stderr.write(
    `wrote dayfestivals-golden.json (${totalDays} days, ${emittingDays} emitting, ` +
    `${Object.keys(keyCounts).length} distinct keys, ${cases.length} explicit cases, ` +
    `polar catch hits ${polarHits['tomorrowSunset']}/${polarHits['dayAfterSunrise']}/` +
    `${polarHits['dayBeforeYesterday']} of ${polarHits['reached']} probed)\n`,
  );
}

/**
 * `dayBeforeYesterday` is 0, and that is STRUCTURAL rather than a thin sweep:
 * the two searches ahead of it collapse forward, today's sunrise lying inside
 * every window they probe. The 0 is pinned so a change to `limitDays` or the
 * -26 h / -30 h offsets moves a count.
 */
function dfProbePolar(
  geo: { latitude: number; longitude: number },
  sunrise: Date, nextSunrise: Date,
  hits: Record<string, number>,
): void {
  hits['reached'] = (hits['reached'] ?? 0) + 1;
  let tomorrowSunset: Date | null = null;
  try {
    tomorrowSunset = computeSunset(nextSunrise, geo);
  } catch {
    hits['tomorrowSunset'] = (hits['tomorrowSunset'] ?? 0) + 1;
  }
  if (tomorrowSunset !== null) {
    try {
      computeSunrise(tomorrowSunset, geo);
    } catch {
      hits['dayAfterSunrise'] = (hits['dayAfterSunrise'] ?? 0) + 1;
    }
  }
  // The D-2 site sits behind an unguarded `computeSunrise`, so it cannot be
  // probed separately. What is probed is the pair the catch actually wraps.
  try {
    const yesterdaySunrise = computeSunrise(
      new Date(sunrise.getTime() - 24 * 3600_000 - 2 * 3600_000), geo);
    const dayBeforeSunrise = computeSunrise(
      new Date(yesterdaySunrise.getTime() - 30 * 3600_000), geo);
    computeSunset(dayBeforeSunrise, geo);
  } catch {
    hits['dayBeforeYesterday'] = (hits['dayBeforeYesterday'] ?? 0) + 1;
  }
}

function dfIsoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}


/**
 * The Mesha catch needs a station whose midnight sun has begun by April 14:
 * Longyearbyen's starts ~April 20 and Alert's ~April 7, so only Alert reaches
 * it. And every epoch millisecond in 1912 is NEGATIVE, the only way to tell
 * `Math.floor((lo+hi)/2)` from truncating integer division.
 */
const CAL_LOCATIONS: readonly {
  name: string; latitude: number; longitude: number; timezone: number | string;
  years: readonly number[];
}[] = [
  { name: 'Pune', latitude: 18.5204, longitude: 73.8567, timezone: 330, years: [1912, 2025, 2026, 2027, 2088] },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 330, years: [2026, 2028] },
  { name: 'NewYork', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York', years: [2025, 2026] },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney', years: [2026] },
  { name: 'Longyearbyen', latitude: 78.2232, longitude: 15.6267, timezone: 60, years: [2025, 2026] },
  { name: 'Alert', latitude: 82.5018, longitude: -62.3481, timezone: -300, years: [2026, 2027] },
];

const CAL_REGIONS: readonly (FestivalRegion | LegacyFestivalRegion)[] = [
  'all', 'tamil-nadu', 'kerala', 'karnataka', 'andhra-pradesh', 'telangana',
  'west-bengal', 'odisha', 'assam', 'bihar', 'jharkhand',
  'gujarat', 'maharashtra', 'goa', 'rajasthan',
  'punjab', 'haryana', 'himachal-pradesh', 'uttarakhand', 'uttar-pradesh',
  'madhya-pradesh', 'nepal',
  'tamil', 'bengal', 'north-india',
];

function calIsoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A local copy of dump.src.ts's `safe()`: a throw becomes a comparable tag. */
function calSafe<T>(fn: () => T): T | string {
  try {
    return fn();
  } catch (e: unknown) {
    if (e instanceof PanchangError) return `error:${e.code}`;
    if (e instanceof RangeError) return 'error:RangeError';
    return 'error:THROW';
  }
}

interface CalCase {
  label: string;
  ekadashi: number[] | string;
  sankrantis: { date: number; moment: number; rashi: number; rashiName: string }[] | string;
  eclipses: { kind: string; subtype: string; peak: number; start: number; end: number;
    obscuration: number; magnitude: number; visible: boolean;
    sutakStart: number | null; sutakEnd: number | null }[] | string;
  festivalCount: number | string;
  festivalFirst: string | null;
  festivalLast: string | null;
}

/**
 * `sankrantis[].moment` is in the digest because it is the OUTPUT OF THE
 * BISECTION: pinning it pins the midpoint sequence, the one place here where a
 * Go integer division would silently differ.
 */
function writeYearlyGolden(): void {
  const h = createHash('sha256');
  const ch = createHash('sha256');
  const eh = createHash('sha256');
  const nh = createHash('sha256');
  const uh = createHash('sha256');
  const cases: CalCase[] = [];
  const convertCases: unknown[] = [];
  const outcomeCounts: Record<string, number> = {};
  const guardHits: Record<string, number> = {
    ekadashiPolarContinue: 0, ekadashiDaysProbed: 0,
    yearlyBareCatch: 0, sankrantiTransits: 0,
    meshaCatch: 0, meshaSolarAnchorCalls: 0,
    chaitraNull: 0, hinduNewYearCalls: 0,
    convertPolarThrow: 0, convertCalls: 0,
  };

  for (const loc of CAL_LOCATIONS) {
    const geo = { latitude: loc.latitude, longitude: loc.longitude };
    const opts = { timezone: loc.timezone };
    for (const year of loc.years) {
      const label = `${loc.name}|${year}`;

      const ekadashi = calSafe(() => computeEkadashiDatesForYear(year, geo, opts));
      const sankrantis = calSafe(() => computeSankrantisForYear(year, geo, opts));
      const eclipses = calSafe(() => computeEclipsesForYear(year, geo, opts));

      const festivals = calSafe(() => computeFestivalsForYear(year, geo, opts));

      calCountGuards(year, geo, opts, guardHits);

      const c: CalCase = {
        label,
        ekadashi: typeof ekadashi === 'string' ? ekadashi : ekadashi.map((d) => d.getTime()),
        sankrantis: typeof sankrantis === 'string' ? sankrantis : sankrantis.map((s) => ({
          date: s.date.getTime(), moment: s.moment.getTime(),
          rashi: s.rashi, rashiName: s.rashiName,
        })),
        eclipses: typeof eclipses === 'string' ? eclipses : eclipses.map((e) => ({
          kind: e.kind, subtype: e.subtype,
          peak: e.peak.getTime(), start: e.start.getTime(), end: e.end.getTime(),
          obscuration: e.obscuration, magnitude: e.magnitude,
          visible: e.visibleFromLocation,
          sutakStart: e.sutakStart ? e.sutakStart.getTime() : null,
          sutakEnd: e.sutakEnd ? e.sutakEnd.getTime() : null,
        })),
        festivalCount: typeof festivals === 'string' ? festivals : festivals.length,
        festivalFirst: typeof festivals === 'string' || festivals.length === 0 ? null
          : `${festivals[0]!.date.getTime()}|${festivals[0]!.festival.key}`,
        festivalLast: typeof festivals === 'string' || festivals.length === 0 ? null
          : `${festivals[festivals.length - 1]!.date.getTime()}|${festivals[festivals.length - 1]!.festival.key}`,
      };
      cases.push(c);

      const outcome = [ekadashi, sankrantis, eclipses, festivals]
        .map((v) => (typeof v === 'string' ? v : 'ok')).join(',');
      outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;

      h.update(`${label} `);
      h.update(`E:${typeof c.ekadashi === 'string' ? c.ekadashi : c.ekadashi.join(',')} `);
      if (typeof c.sankrantis === 'string') h.update(`S:${c.sankrantis} `);
      else for (const s of c.sankrantis) h.update(`${s.date}/${s.moment}/${s.rashi}/${s.rashiName};`);
      if (typeof c.eclipses === 'string') h.update(`X:${c.eclipses} `);
      else {
        for (const e of c.eclipses) {
          // `obscuration` and `magnitude` are deliberately NOT in the digest: both end in
          // the platform's asin/sqrt. They ride in `cases` and are checked against the
          // numeric band instead.
          h.update(`${e.kind}/${e.subtype}/${e.start}/${e.peak}/${e.end}/` +
            `${e.visible ? 1 : 0}/${e.sutakStart ?? 'n'}/${e.sutakEnd ?? 'n'};`);
        }
      }
      h.update(`F:${c.festivalCount}/${c.festivalFirst ?? 'n'}/${c.festivalLast ?? 'n'}\n`);
    }
  }

  // A date that fails to come back is a masa-anchor or samvat bug.
  for (const loc of CAL_LOCATIONS) {
    const geo = { latitude: loc.latitude, longitude: loc.longitude };
    const opts = { timezone: loc.timezone };
    for (const year of loc.years) {
      // A stride coprime with the ~29.53-day lunation, so the sweep walks the tithi
      // cycle rather than landing on the same phase every time.
      for (let day = 1; day <= 365; day += 29) {
        const ms = Date.UTC(year, 0, 1) + (day - 1) * 86_400_000;
        const key = `${loc.name}|${calIsoDay(ms)}`;
        guardHits['convertCalls']!++;
        const g2h = calSafe(() => convertGregorianToHindu(new Date(ms), geo, opts));
        if (typeof g2h === 'string') {
          if (g2h === 'error:NO_SUNRISE') guardHits['convertPolarThrow']!++;
          convertCases.push({ key, hindu: g2h, roundTrip: null });
          ch.update(`${key} ${g2h}\n`);
          continue;
        }
        const rt = calSafe(() => convertHinduToGregorian({
          vikramSamvat: g2h.vikramSamvat, masaIndex: g2h.masaIndex,
          paksha: g2h.paksha, pakshaTithi: g2h.pakshaTithi,
        }, geo, opts));
        const rtMs = typeof rt === 'string' ? rt : rt.map((d) => d.getTime());
        convertCases.push({
          key,
          hindu: {
            tithiName: g2h.tithiName, tithi: g2h.tithi, pakshaTithi: g2h.pakshaTithi,
            paksha: g2h.paksha, masaName: g2h.masaName, masaIndex: g2h.masaIndex,
            isAdhika: g2h.isAdhika, vikramSamvat: g2h.vikramSamvat,
            shakaSamvat: g2h.shakaSamvat, varaName: g2h.varaName, varaIndex: g2h.varaIndex,
          },
          roundTrip: rtMs,
          roundTripContains: typeof rt === 'string' ? null : rt.some((d) => d.getTime() === ms),
        });
        ch.update(`${key} ${g2h.tithi}/${g2h.pakshaTithi}/${g2h.paksha}/${g2h.masaIndex}/` +
          `${g2h.isAdhika ? 1 : 0}/${g2h.vikramSamvat}/${g2h.shakaSamvat}/${g2h.varaIndex}/` +
          `${g2h.tithiName}/${g2h.masaName}/${g2h.varaName} ` +
          `${typeof rtMs === 'string' ? rtMs : rtMs.join(',')}\n`);
      }
    }
  }

  const eras: unknown[] = [];
  for (const year of [1912, 2025, 2026, 2027, 2028, 2029, 2088]) {
    for (const [mo, day] of [[0, 1], [1, 18], [2, 15], [2, 20], [2, 25], [3, 5], [11, 31]] as const) {
      const ms = Date.UTC(year, mo, day);
      const sv = calSafe(() => computeSamvat(new Date(ms)));
      const ky = calSafe(() => getKaliYugaYear(new Date(ms)));
      eras.push({ key: `${calIsoDay(ms)}`, samvat: sv, kaliYuga: ky });
      eh.update(`era ${calIsoDay(ms)} ${JSON.stringify(sv)} ${ky}\n`);
    }
  }

  // Wide enough that the four Mesha day-rules and the Chaitra sweep each see
  // transit moments from pre-dawn through post-sunset.
  const newYears: unknown[] = [];
  for (const loc of [CAL_LOCATIONS[0]!, CAL_LOCATIONS[1]!, CAL_LOCATIONS[5]!]) {
    const geo = { latitude: loc.latitude, longitude: loc.longitude };
    for (const year of [2025, 2026, 2027, 2028, 2029]) {
      for (const region of CAL_REGIONS) {
        guardHits['hinduNewYearCalls']!++;
        const v = calSafe(() => getHinduNewYear(year, region, geo, { timezone: loc.timezone }));
        const at = typeof v === 'string' ? v : (v === null ? null : v.getTime());
        if (at === null) guardHits['chaitraNull']!++;
        newYears.push({ key: `${loc.name}|${year}|${region}`, at });
        nh.update(`hny ${loc.name}|${year}|${region} ${at}\n`);
      }
    }
  }

  // A count-bounded loop rather than a range-bounded one, so pinned apart.
  const upcoming: unknown[] = [];
  for (const loc of [CAL_LOCATIONS[0]!, CAL_LOCATIONS[3]!, CAL_LOCATIONS[4]!]) {
    const geo = { latitude: loc.latitude, longitude: loc.longitude };
    for (const [from, count] of [['2025-01-01', 5], ['2026-06-15', 3], ['1912-06-01', 4]] as const) {
      const v = calSafe(() => getUpcomingEclipses(new Date(from), geo, count));
      const list = typeof v === 'string' ? v : v.map((e) =>
        `${e.kind}/${e.subtype}/${e.peak.getTime()}/${e.visibleFromLocation ? 1 : 0}`);
      upcoming.push({ key: `${loc.name}|${from}|${count}`, eclipses: list });
      uh.update(`up ${loc.name}|${from}|${count} ${typeof list === 'string' ? list : list.join(',')}\n`);
    }
  }

  const golden = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/calendar/yearly.ts + src/calendar/convert.ts',
      claim:
        'Go internal/calendar produces the same Ekadashi dates, Sankranti ' +
        'moments and observance days, eclipse lists, Hindu-calendar coordinates ' +
        'and regional New Year dates as the TypeScript, for the same places and ' +
        'years. The Sankranti `moment` pins the bisection midpoint sequence, ' +
        'which is where a truncating Go integer division would show and nowhere ' +
        'else (docs/porting.md §1.5).',
      note:
        '1912 carries negative epoch milliseconds throughout, which is the only ' +
        'span in which Math.floor((lo+hi)/2) and a truncating (lo+hi)/2 differ. ' +
        'Longyearbyen and Alert exist to reach the three polar guards; guardHits ' +
        'counts each, so a span that stops reaching one fails rather than passing ' +
        'quietly.',
    },
    locations: CAL_LOCATIONS,
    regions: CAL_REGIONS,
    digest: h.digest('hex'),
    convertDigest: ch.digest('hex'),
    eraDigest: eh.digest('hex'),
    newYearDigest: nh.digest('hex'),
    upcomingDigest: uh.digest('hex'),
    outcomeCounts,
    guardHits,
    cases,
    convertCases,
    eras,
    newYears,
    upcoming,
  };

  const out = join(REPO, 'testdata', 'goldens', 'calendar', 'yearly-golden.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(golden, null, 2) + '\n', 'utf8');
  process.stderr.write(
    `wrote yearly-golden.json (${cases.length} location-years, ` +
    `${convertCases.length} convert cases, ${newYears.length} new-year cases, ` +
    `guards ${guardHits['ekadashiPolarContinue']}/${guardHits['yearlyBareCatch']}/` +
    `${guardHits['meshaCatch']}/${guardHits['chaitraNull']}/${guardHits['convertPolarThrow']})\n`,
  );
}

/**
 * Re-runs the guarded call sequences outside the library so each guard's hit
 * count can be pinned: a golden that silently stops reaching one otherwise
 * passes for the wrong reason.
 */
function calCountGuards(
  year: number,
  geo: { latitude: number; longitude: number },
  opts: { timezone: number | string },
  hits: Record<string, number>,
): void {
  const dayMs = 86_400_000;
  const offset = resolveUtcOffset(opts.timezone, new Date(Date.UTC(year, 6, 1)));

  for (let t = Date.UTC(year, 0, 1); t <= Date.UTC(year, 11, 31) + dayMs; t += dayMs) {
    hits['ekadashiDaysProbed']!++;
    try {
      const sr = computeSunrise(getLocalMidnightUtc(new Date(t), offset), geo);
      computeSunrise(computeSunset(sr, geo), geo);
    } catch (e: unknown) {
      if (e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET')) {
        hits['ekadashiPolarContinue']!++;
      } else {
        throw e;
      }
    }
  }

  const sank = calSafe(() => computeSankrantisForYear(year, geo, opts));
  if (typeof sank !== 'string') {
    for (const s of sank) {
      hits['sankrantiTransits']!++;
      const hi = s.moment.getTime();
      try {
        let dayStart = computeSunrise(new Date(hi - 30 * 3600_000), geo);
        for (let i = 0; i < 3; i++) {
          const next = computeSunrise(computeSunset(dayStart, geo), geo);
          if (next.getTime() <= hi) dayStart = next; else break;
        }
        const dayEnd = computeSunset(dayStart, geo);
        if (hi > dayEnd.getTime()) computeSunrise(dayEnd, geo);
      } catch {
        hits['yearlyBareCatch']!++;
      }
    }
  }

  // Only the two sunrise-relative Mesha rules reach this; `civil-day` and
  // `civil-day-plus-1` return before the try block.
  hits['meshaSolarAnchorCalls']!++;
  const aprMs = Date.UTC(year, 3, 14, 6, 0, 0, 0);
  try {
    let dayStart = computeSunrise(new Date(aprMs - 30 * 3600_000), geo);
    for (let i = 0; i < 3; i++) {
      const next = computeSunrise(computeSunset(dayStart, geo), geo);
      if (next.getTime() <= aprMs) dayStart = next; else break;
    }
    computeSunset(dayStart, geo);
  } catch (e: unknown) {
    if (e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET')) {
      hits['meshaCatch']!++;
    } else {
      throw e;
    }
  }
}


/**
 * MUST stay the same literal as `dump.src.ts`'s `PINNED_GENERATED_AT`, or two
 * byte-comparisons of the same emitted table disagree.
 */
const MU_PINNED_GENERATED_AT = '2026-08-23T00:00:00.000Z';

const MU_STOCK_IDS: readonly string[] = [
  'vivah', 'grihaPravesh', 'namakarana', 'vidyarambh', 'vahanKharidi',
  'annaprashan', 'mundan', 'upanayanam', 'karnavedha', 'aksharabhyasam',
  'seemantham', 'shopOpening', 'travelStart',
];

/**
 * Seven scoring arms are unreachable from the stock rules, which set none of
 * the yoga, paksha, panchaka or bhadra options; `armHits` pins every arm's fire
 * count, so an arm that stops being reached moves a number.
 */
const MU_SYNTHETIC: readonly { id: string; rule: MuhurtaRule }[] = [
  // The yoga axis, which no stock rule touches, on ranges that fire daily.
  { id: 'syn-yoga', rule: {
    occasion: 'syn-yoga',
    auspiciousYogas: [0, 1, 2, 3, 4, 5, 6, 7],
    inauspiciousYogas: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  } },
  { id: 'syn-shukla', rule: { occasion: 'syn-shukla', requirePaksha: 'shukla' } },
  { id: 'syn-krishna', rule: { occasion: 'syn-krishna', requirePaksha: 'krishna' } },
  // The deprecated boolean with no `bhadra` key is the only way to reach the
  // `?? (rule.excludeBhadra ? ...)` fallback's true arm.
  { id: 'syn-bhadra-exclude', rule: { occasion: 'syn-bhadra-exclude', bhadra: 'exclude' } },
  { id: 'syn-bhadra-ignore', rule: { occasion: 'syn-bhadra-ignore', bhadra: 'ignore' } },
  { id: 'syn-bhadra-legacy', rule: { occasion: 'syn-bhadra-legacy', excludeBhadra: true } },
  // Both fields set at once: `bhadra` must win. The one place they interact.
  { id: 'syn-bhadra-both', rule: {
    occasion: 'syn-bhadra-both', bhadra: 'penalize', excludeBhadra: true,
  } },
  // `varaTithiYogas` defaults to true, so a Go zero value makes every rule
  // behave like `syn-novty`.
  { id: 'syn-novty', rule: {
    occasion: 'syn-novty', varaTithiYogas: false,
    auspiciousTithis: [0, 5, 10, 15, 20, 25],
  } },
  { id: 'syn-vty-explicit-true', rule: {
    occasion: 'syn-vty-explicit-true', varaTithiYogas: true,
    auspiciousTithis: [0, 5, 10, 15, 20, 25],
  } },
  { id: 'syn-panchaka', rule: { occasion: 'syn-panchaka', excludePanchaka: true } },
  { id: 'syn-gandamula', rule: { occasion: 'syn-gandamula', excludeGandaMula: true } },
  { id: 'syn-eclipse', rule: { occasion: 'syn-eclipse', excludeEclipse: true } },
  { id: 'syn-adhika', rule: { occasion: 'syn-adhika', excludeAdhikaMasa: true } },
  { id: 'syn-ekadashi', rule: { occasion: 'syn-ekadashi', excludeEkadashi: true } },
  // Both overshoot, the only way to reach the scorer's two clamping lines.
  { id: 'syn-clamp-high', rule: {
    occasion: 'syn-clamp-high',
    auspiciousTithis: Array.from({ length: 30 }, (_, i) => i),
    auspiciousNakshatras: Array.from({ length: 27 }, (_, i) => i),
    auspiciousVaras: [0, 1, 2, 3, 4, 5, 6],
    auspiciousYogas: Array.from({ length: 27 }, (_, i) => i),
  } },
  { id: 'syn-clamp-low', rule: {
    occasion: 'syn-clamp-low',
    inauspiciousTithis: Array.from({ length: 30 }, (_, i) => i),
    inauspiciousNakshatras: Array.from({ length: 27 }, (_, i) => i),
    inauspiciousVaras: [0, 1, 2, 3, 4, 5, 6],
    inauspiciousYogas: Array.from({ length: 27 }, (_, i) => i),
    bhadra: 'penalize',
  } },
  // No name, so `meta.occasionName` is absent rather than empty: the one
  // conditionally-present key in the muhurta table.
  { id: 'syn-unnamed', rule: { occasion: 'syn-unnamed' } },
];

const MU_SPANS: readonly {
  name: string; latitude: number; longitude: number; timezone: number;
  from: readonly [number, number, number]; days: number;
}[] = [
  { name: 'Pune', latitude: 18.5204, longitude: 73.8567, timezone: 330, from: [2025, 0, 1], days: 60 },
  { name: 'Delhi', latitude: 28.6139, longitude: 77.2090, timezone: 330, from: [2026, 6, 1], days: 60 },
  // Adhika Chaitra, the only way to reach `excludeAdhikaMasa`.
  { name: 'Delhi', latitude: 28.6139, longitude: 77.2090, timezone: 330, from: [2029, 2, 1], days: 75 },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 330, from: [2027, 7, 1], days: 30 },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, timezone: 600, from: [2026, 3, 1], days: 30 },
  // Polar night, for `no_sunrise`: the only arm that skips scoreFromPanchang.
  { name: 'Longyearbyen', latitude: 78.2232, longitude: 15.6267, timezone: 60, from: [2025, 11, 1], days: 20 },
];

interface MuScoreOut {
  label: string;
  score: number;
  passes: boolean;
  reasons: string[];
  factors: { code: string; axis: string; index: number | null; delta: number }[];
}

function writeMuhurtaGolden(): void {
  const rh = createHash('sha256');   // the rule table
  const vh = createHash('sha256');   // the vara x tithi grid
  const sh = createHash('sha256');   // scoreMuhurta over every rule x day
  const bh = createHash('sha256');   // the range enumerator and the table
  const armHits: Record<string, number> = {};
  for (const k of [
    'excl_bhadra', 'excl_ekadashi', 'excl_eclipse', 'excl_adhika_masa',
    'excl_ganda_mula', 'excl_panchaka', 'excl_paksha', 'excl_no_sunrise',
    'auspicious_tithi', 'inauspicious_tithi',
    'auspicious_nakshatra', 'inauspicious_nakshatra',
    'auspicious_vara', 'inauspicious_vara',
    'auspicious_yoga', 'inauspicious_yoga',
    'bhadra_penalize', 'vty_scored', 'vty_suppressed',
    'sy_bonus', 'sy_jwalamukhi', 'clamp_low', 'clamp_high',
    'days_scored', 'days_null',
  ]) armHits[k] = 0;
  for (const t of ['siddha', 'amrita', 'dagdha', 'visha', 'hutasana', 'krakacha', 'samvartaka']) {
    armHits[`vty_${t}`] = 0;
  }

  const ruleTable: unknown[] = [];
  for (const id of MU_STOCK_IDS) {
    const r = STOCK_MUHURTA_RULES[id];
    if (!r) throw new Error(`goldens: STOCK_MUHURTA_RULES is missing "${id}"`);
    ruleTable.push({ id, rule: r });
    // `undefined` is a tag, so an absent field and a falsy one cannot collide.
    rh.update(`${id}|${r.occasion}|${r.name ?? '<none>'}|`);
    for (const k of [
      'auspiciousTithis', 'inauspiciousTithis', 'auspiciousNakshatras',
      'inauspiciousNakshatras', 'auspiciousVaras', 'inauspiciousVaras',
      'auspiciousYogas', 'inauspiciousYogas',
    ] as const) {
      const v = r[k];
      rh.update(`${k}=${v === undefined ? '<none>' : v.join(',')};`);
    }
    for (const k of [
      'bhadra', 'excludeBhadra', 'excludeEkadashi', 'requirePaksha',
      'excludeAdhikaMasa', 'excludeEclipse', 'excludeGandaMula',
      'excludePanchaka', 'varaTithiYogas',
    ] as const) {
      const v = r[k];
      rh.update(`${k}=${v === undefined ? '<none>' : String(v)};`);
    }
    rh.update('\n');
  }

  const vtyGrid: unknown[] = [];
  for (let v = 0; v < 7; v++) {
    for (let t = 0; t < 30; t++) {
      const yogas = computeVaraTithiYogas(v, t);
      vtyGrid.push({ vara: v, tithi: t, yogas });
      vh.update(`${v}|${t}|${yogas.map(y => `${y.type}/${y.polarity}`).join(',')}\n`);
    }
  }

  const allRules: { id: string; rule: MuhurtaRule }[] = [
    ...MU_STOCK_IDS.map(id => ({ id, rule: STOCK_MUHURTA_RULES[id]! })),
    ...MU_SYNTHETIC,
  ];
  const scoreCases: MuScoreOut[] = [];
  for (const span of MU_SPANS) {
    const geo = { latitude: span.latitude, longitude: span.longitude };
    const base = Date.UTC(span.from[0], span.from[1], span.from[2], 6, 0, 0, 0);
    for (let i = 0; i < span.days; i++) {
      const ms = base + i * 86_400_000;
      for (const { id, rule } of allRules) {
        const r = scoreMuhurta(new Date(ms), geo, rule, { timezone: span.timezone });
        const label = `${span.name}|${calIsoDay(ms)}|${id}`;
        muCountArms(r, rule, armHits);
        sh.update(`${label} ${r.score} ${r.passes ? 1 : 0} `);
        for (const f of r.factors) {
          sh.update(`${f.code}/${f.axis}/${f.index ?? 'n'}/${f.delta};`);
        }
        sh.update(`| ${r.reasons.join(' ~ ')}\n`);
        if (r.score !== 50 || r.factors.length > 0 || scoreCases.length % 211 === 0) {
          scoreCases.push({
            label, score: r.score, passes: r.passes, reasons: r.reasons,
            factors: r.factors.map(f => ({
              code: f.code, axis: f.axis, index: f.index ?? null, delta: f.delta,
            })),
          });
        }
      }
    }
  }

  const pune = { latitude: 18.5204, longitude: 73.8567 };
  const rangeCases: unknown[] = [];
  const tables: unknown[] = [];
  for (const id of ['vivah', 'grihaPravesh', 'travelStart']) {
    const rule = STOCK_MUHURTA_RULES[id]!;
    for (const includeFailures of [false, true]) {
      const days = computeAuspiciousDatesInRange(
        rule, new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2025, 1, 28)), pune,
        { timezone: 330, includeFailures },
      );
      // `panchang` is pinned leaf for leaf elsewhere; what is new here is the
      // selection and the ORDER.
      const flat = days.map(d => `${d.date.getTime()}/${d.score}/${d.passes ? 1 : 0}`);
      rangeCases.push({ key: `${id}|${includeFailures}`, days: flat });
      bh.update(`range ${id}|${includeFailures} ${flat.join(' ')}\n`);
    }
  }
  for (const id of ['vivah', 'syn-unnamed']) {
    const rule = id === 'vivah'
        ? STOCK_MUHURTA_RULES['vivah']!
        : MU_SYNTHETIC[MU_SYNTHETIC.length - 1]!.rule;
    for (const includeFailures of [false, true]) {
      const file = buildMuhurtaTable({
        rule, location: pune, timezoneOffsetMinutes: 330,
        startYear: 2025, endYear: 2025, includeFailures,
        referenceLocation: 'Pune', generatedAt: MU_PINNED_GENERATED_AT,
      });
      const json = JSON.stringify(file, null, 2) + '\n';
      const best = readBestMuhurtaDays(file, 5);
      const forYear = readMuhurtaForYear(file, 2025);
      const forDate = readMuhurtaForDate(file, '2025-02-05');
      tables.push({
        key: `${id}|${includeFailures}`,
        sha256: createHash('sha256').update(json, 'utf8').digest('hex'),
        bytes: Buffer.byteLength(json, 'utf8'),
        dictLength: file._dict.length,
        dayCount: file.years['2025']!.length,
        metaKeys: Object.keys(file._meta),
        range: readMuhurtaYearRange(file),
        occasion: readMuhurtaOccasion(file),
        best: best.map(d => `${d.date}/${d.score}/${d.passes ? 1 : 0}`),
        forYearLength: forYear === null ? null : forYear.length,
        forYearFirst: forYear && forYear[0] ? `${forYear[0].date}/${forYear[0].score}` : null,
        forDate: forDate === null ? null : `${forDate.date}/${forDate.score}/${forDate.passes ? 1 : 0}`,
        outOfRange: readMuhurtaForYear(file, 2099) === null,
      });
      bh.update(`table ${id}|${includeFailures} ${createHash('sha256').update(json, 'utf8').digest('hex')} ` +
        `${Buffer.byteLength(json, 'utf8')} ${file._dict.length} ${Object.keys(file._meta).join(',')}\n`);
      for (const d of best) bh.update(`  best ${d.date}/${d.score}/${d.passes ? 1 : 0}\n`);
    }
  }
  const yearDays = computeAuspiciousDatesForYear(2025, STOCK_MUHURTA_RULES['seemantham']!, pune,
    { timezone: 330 });
  bh.update(`year seemantham 2025 ${yearDays.length} ` +
    `${yearDays.map(d => `${d.date.getTime()}/${d.score}`).join(' ')}\n`);

  const golden = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source:
        'src/muhurta/engine.ts, varaTithiYogas.ts, rules/index.ts, ' +
        'buildMuhurtaTable.ts, muhurtaTable.ts',
      claim:
        'Go internal/muhurta scores the same days the same way, holds the same ' +
        'thirteen stock rules field for field, and emits a byte-identical table.',
      note:
        'Seven scoring arms are unreachable from the thirteen stock rules, no ' +
        'stock rule sets a yoga list, requirePaksha, excludePanchaka, the ' +
        'deprecated excludeBhadra or varaTithiYogas, and all thirteen use ' +
        "bhadra: 'penalize'. MU_SYNTHETIC exists to reach them and armHits pins " +
        'every arm\'s fire count, so an arm that stops being reached moves a ' +
        'number instead of passing quietly.',
      tableClaim:
        'The `tables` sha256 is the G4.6 byte-identical gate in miniature: ' +
        'JSON.stringify(file, null, 2) + "\\n", the same serialization ' +
        'generate/generate-*.ts uses. metaKeys carries the emitted key ORDER, ' +
        'because occasionName is assigned after the object literal and so lands ' +
        'last rather than in its interface position (D6).',
    },
    stockIds: MU_STOCK_IDS,
    syntheticIds: MU_SYNTHETIC.map(s => s.id),
    spans: MU_SPANS,
    ruleDigest: rh.digest('hex'),
    vtyDigest: vh.digest('hex'),
    scoreDigest: sh.digest('hex'),
    buildDigest: bh.digest('hex'),
    armHits,
    ruleTable,
    vtyGrid,
    scoreCases,
    rangeCases,
    tables,
  };

  const out = join(REPO, 'testdata', 'goldens', 'muhurta', 'muhurta-golden.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(golden, null, 2) + '\n', 'utf8');
  const unreached = Object.entries(armHits).filter(([, v]) => v === 0).map(([k]) => k);
  process.stderr.write(
    `wrote muhurta-golden.json (${allRules.length} rules x ${MU_SPANS.reduce((a, s) => a + s.days, 0)} days, ` +
    `${scoreCases.length} explicit cases, ${armHits['days_scored']} scored, ` +
    `${unreached.length} arms UNREACHED${unreached.length ? ': ' + unreached.join(' ') : ''})\n`,
  );
}

/**
 * Every arm appends a factor with a distinct `code`; the clamps and the
 * `varaTithiYogas` suppression are derived from the score and the rule instead.
 */
function muCountArms(
  r: MuhurtaScore, rule: MuhurtaRule, hits: Record<string, number>,
): void {
  const bump = (k: string) => { hits[k] = (hits[k] ?? 0) + 1; };
  const codes = new Set(r.factors.map(f => f.code));

  if (codes.has('no_sunrise')) { bump('excl_no_sunrise'); bump('days_null'); return; }
  bump('days_scored');

  if (r.factors.length === 1 && r.factors[0]!.axis === 'exclusion') {
    bump(`excl_${r.factors[0]!.code}`);
    return;
  }
  for (const f of r.factors) {
    if (f.axis === 'varaTithiYoga') { bump('vty_scored'); bump(`vty_${f.code.slice('vara_tithi_'.length)}`); }
    else if (f.code === 'bhadra' && f.axis === 'karana') bump('bhadra_penalize');
    else if (f.axis === 'specialYoga') bump(f.code === 'jwalamukhi' ? 'sy_jwalamukhi' : 'sy_bonus');
    else bump(f.code);
  }
  if (rule.varaTithiYogas === false) bump('vty_suppressed');
  // The unclamped total: what the scorer added up before `Math.max`/`Math.min`.
  const raw = 50 + r.factors.reduce((a, f) => a + f.delta, 0);
  if (raw < 0) bump('clamp_low');
  if (raw > 100) bump('clamp_high');
}


/**
 * `buildFestivalsTable.ts` writes `name[languages[l]]` in the CALLER's order, so
 * `['hi', 'en']` emits `{"hi": ..., "en": ...}`, a byte order a Go struct with
 * fixed `En`/`Hi` fields would get wrong.
 */
const TBL_CASES: readonly {
  key: string; latitude: number; longitude: number; tz: number;
  startYear: number; endYear: number;
  languages?: readonly FestivalsTableLanguage[];
  visibleOnly?: boolean;
}[] = [
  { key: 'pune-2025', latitude: 18.5204, longitude: 73.8567, tz: 330, startYear: 2025, endYear: 2025 },
  { key: 'pune-1912', latitude: 18.5204, longitude: 73.8567, tz: 330, startYear: 1912, endYear: 1912 },
  { key: 'pune-2088', latitude: 18.5204, longitude: 73.8567, tz: 330, startYear: 2088, endYear: 2088 },
  { key: 'newyork-2026', latitude: 40.7128, longitude: -74.0060, tz: -300, startYear: 2026, endYear: 2026 },
  { key: 'chennai-2026-2027', latitude: 13.0827, longitude: 80.2707, tz: 330, startYear: 2026, endYear: 2027 },
  { key: 'pune-2025-hi-first', latitude: 18.5204, longitude: 73.8567, tz: 330, startYear: 2025, endYear: 2025, languages: ['hi', 'en'] },
  { key: 'pune-2025-en-only', latitude: 18.5204, longitude: 73.8567, tz: 330, startYear: 2025, endYear: 2025, languages: ['en'] },
  { key: 'pune-2025-hi-only', latitude: 18.5204, longitude: 73.8567, tz: 330, startYear: 2025, endYear: 2025, languages: ['hi'] },
  { key: 'longyearbyen-2025-all', latitude: 78.2232, longitude: 15.6267, tz: 60, startYear: 2025, endYear: 2025, visibleOnly: false },
  // Eclipse arms an ordinary sweep does not reach: penumbral with no sutak,
  // invisible, and an EMPTY year, built inside a range so the pre-seeding
  // guarantee is observable.
  { key: 'alert-2027', latitude: 82.5018, longitude: -62.3481, tz: -300, startYear: 2027, endYear: 2027 },
  { key: 'alert-2027-all', latitude: 82.5018, longitude: -62.3481, tz: -300, startYear: 2027, endYear: 2027, visibleOnly: false },
  { key: 'newyork-2031-2033', latitude: 40.7128, longitude: -74.0060, tz: -300, startYear: 2031, endYear: 2033 },
];

/**
 * `MuhurtaTableMeta.occasionName` and `EclipseTableEntryRaw.sutak` are each
 * assigned after their object literal, so they emit last rather than in their
 * interface position.
 */
function writeTablesGolden(): void {
  const h = createHash('sha256');
  const cases: unknown[] = [];
  const tblHits: Record<string, number> = {
    festivalDays: 0, festivalEntries: 0, festivalWithDescription: 0,
    eclipseDays: 0, eclipseEntries: 0, eclipseWithSutak: 0, eclipseWithoutSutak: 0,
    eclipsePenumbral: 0, eclipseInvisible: 0,
    phaseDays: 0, phaseEntries: 0,
    emptyEclipseYears: 0, pickFallback: 0, v1Read: 0,
  };

  for (const c of TBL_CASES) {
    const geo = { latitude: c.latitude, longitude: c.longitude };
    const languages = c.languages;

    const festivals = buildFestivalsTable({
      location: geo, timezoneOffsetMinutes: c.tz,
      startYear: c.startYear, endYear: c.endYear,
      ...(languages ? { languages } : {}),
      referenceLocation: c.key, generatedAt: MU_PINNED_GENERATED_AT,
    });
    const eclipses = buildEclipsesTable({
      location: geo, timezoneOffsetMinutes: c.tz,
      startYear: c.startYear, endYear: c.endYear,
      ...(languages ? { languages } : {}),
      ...(c.visibleOnly === undefined ? {} : { visibleOnly: c.visibleOnly }),
      referenceLocation: c.key, generatedAt: MU_PINNED_GENERATED_AT,
    });
    const phases = buildMoonPhasesTable({
      timezoneOffsetMinutes: c.tz,
      startYear: c.startYear, endYear: c.endYear,
      ...(languages ? { languages } : {}),
      referenceLocation: c.key, generatedAt: MU_PINNED_GENERATED_AT,
    });

    const files: [string, unknown][] = [
      ['festivals', festivals], ['eclipses', eclipses], ['moonPhases', phases],
    ];
    const shas: Record<string, string> = {};
    const bytes: Record<string, number> = {};
    const masked: Record<string, string> = {};
    for (const [name, file] of files) {
      const json = JSON.stringify(file, null, 2) + '\n';
      shas[name] = createHash('sha256').update(json, 'utf8').digest('hex');
      bytes[name] = Buffer.byteLength(json, 'utf8');
      // `obscuration` and `magnitude` are the only numbers in these formats that come
      // out of the ephemeris, and both end in the platform's asin/sqrt, so masking
      // them turns "byte-identical" into the claim that IS testable.
      masked[name] = createHash('sha256').update(maskEclipseFloats(json), 'utf8').digest('hex');
      h.update(`${c.key}|${name} ${shas[name]} ${bytes[name]} ${masked[name]}\n`);
    }

    // EVERY in-range year: the eclipse-free year is the middle year of a build, so
    // a first-year-only reader never sees it.
    const y = c.startYear;
    const readOut: Record<string, unknown> = {};
    for (const lang of ['en', 'hi'] as const) {
      for (let yy = c.startYear; yy <= c.endYear; yy++) {
        const ede = readEclipsesForYear(eclipses, yy, lang);
        if (ede !== null && ede.length === 0) tblHits['emptyEclipseYears']!++;
      }
      const fd = readFestivalsForYear(festivals, y, lang);
      const ed = readEclipsesForYear(eclipses, y, lang);
      const pd = readMoonPhasesForYear(phases, y, lang);
      if (fd) {
        tblHits['festivalDays']! += fd.length;
        for (const d of fd) for (const f of d.festivals) {
          tblHits['festivalEntries']!++;
          if (f.description !== undefined) tblHits['festivalWithDescription']!++;
          if (languages && !languages.includes(lang)) tblHits['pickFallback']!++;
        }
      }
      if (ed) {
        tblHits['eclipseDays']! += ed.length;
        for (const d of ed) for (const e of d.eclipses) {
          tblHits['eclipseEntries']!++;
          if (e.sutak) tblHits['eclipseWithSutak']!++; else tblHits['eclipseWithoutSutak']!++;
          if (e.subtype === 'penumbral') tblHits['eclipsePenumbral']!++;
          if (!e.visibleFromLocation) tblHits['eclipseInvisible']!++;
        }
      }
      if (pd) {
        tblHits['phaseDays']! += pd.length;
        for (const d of pd) tblHits['phaseEntries']! += d.phases.length;
      }
      readOut[`festivals-${lang}`] = fd === null ? null : fd.slice(0, 6);
      readOut[`eclipses-${lang}`] = ed === null ? null : ed;
      readOut[`moonPhases-${lang}`] = pd === null ? null : pd.slice(0, 4);
      h.update(`${c.key}|read|${lang} ${JSON.stringify(readOut[`festivals-${lang}`])} ` +
        `${JSON.stringify(readOut[`eclipses-${lang}`])} ` +
        `${JSON.stringify(readOut[`moonPhases-${lang}`])}\n`);
    }

    const probeMs = Date.UTC(y, 0, 15, 12, 0, 0, 0);
    const byDate = {
      festivals: readFestivalsForDate(festivals, new Date(probeMs), 'en'),
      eclipses: readEclipsesForDate(eclipses, new Date(probeMs), 'en'),
      moonPhases: readMoonPhasesForDate(phases, new Date(probeMs), 'en'),
      festivalsOutOfRange: readFestivalsForYear(festivals, 1800, 'en') === null,
      eclipsesOutOfRange: readEclipsesForYear(eclipses, 1800, 'en') === null,
      moonPhasesOutOfRange: readMoonPhasesForYear(phases, 1800, 'en') === null,
      ranges: {
        festivals: readFestivalsYearRange(festivals),
        eclipses: readEclipsesYearRange(eclipses),
        moonPhases: readMoonPhasesYearRange(phases),
      },
    };
    h.update(`${c.key}|byDate ${JSON.stringify(byDate)}\n`);

    cases.push({
      key: c.key,
      sha256: shas,
      sha256Masked: masked,
      bytes,
      metaKeys: {
        festivals: Object.keys(festivals._meta),
        eclipses: Object.keys(eclipses._meta),
        moonPhases: Object.keys(phases._meta),
      },
      entryKeys: {
        festivalDict: festivals._dict[0] ? Object.keys(festivals._dict[0]) : null,
        eclipseEntry: firstEclipseEntryKeys(eclipses),
        eclipseEntryWithSutak: firstEclipseEntryKeys(eclipses, true),
        phaseDict: phases._dict[0] ? Object.keys(phases._dict[0]) : null,
      },
      dictLengths: {
        festivals: festivals._dict.length,
        moonPhases: phases._dict.length,
      },
      dayCounts: {
        festivals: Object.fromEntries(Object.entries(festivals.years).map(([k, v]) => [k, v.length])),
        eclipses: Object.fromEntries(Object.entries(eclipses.years).map(([k, v]) => [k, v.length])),
        moonPhases: Object.fromEntries(Object.entries(phases.years).map(([k, v]) => [k, v.length])),
      },
      read: readOut,
      byDate,
    });
  }

  // No builder emits v1 any more, so the only way to reach `isPacked === false`
  // is a hand-built v1 file; without it the sniff's dead branch is the
  // compatibility promise.
  const v1Festivals: FestivalsFileV1 = {
    _meta: {
      referenceLocation: 'v1', latitude: 18.5204, longitude: 73.8567,
      timezoneOffsetMinutes: 330, ayanamsa: 'lahiri', masaSystem: 'purnimanta',
      region: 'all', languages: ['en', 'hi'], startYear: 2025, endYear: 2025,
      generatedAt: MU_PINNED_GENERATED_AT, note: 'v1 fixture',
    },
    years: {
      '2025': [
        { date: '2025-01-14', festivals: [
          { name: { en: 'Makar Sankranti', hi: 'मकर संक्रांति' }, type: 'sankranti',
            description: { en: 'Sun enters Capricorn.', hi: 'सूर्य मकर राशि में।' } },
          { name: { en: 'Pongal' }, type: 'major' },
        ] },
        { date: '2025-03-14', festivals: [
          { name: { hi: 'होली' }, type: 'major' },
        ] },
      ],
    },
  };
  const v1Phases: MoonPhasesFileV1 = {
    _meta: {
      referenceLocation: 'v1', timezoneOffsetMinutes: 330,
      languages: ['en', 'hi'], startYear: 2025, endYear: 2025,
      generatedAt: MU_PINNED_GENERATED_AT, note: 'v1 fixture',
    },
    years: {
      '2025': [
        { date: '2025-01-13', phases: [
          { name: { en: 'Full Moon', hi: 'पूर्णिमा' }, phase: 'full',
            time: '2025-01-13T22:26:00.000Z',
            description: { en: 'Full moon (Purnima).', hi: 'पूर्णिमा, पूर्ण चंद्रमा।' } },
        ] },
        { date: '2025-01-29', phases: [
          { name: { hi: 'अमावस्या' }, phase: 'new', time: '2025-01-29T12:36:00.000Z' },
        ] },
      ],
    },
  };
  const v1 = {
    festivalsEn: readFestivalsForYear(v1Festivals as AnyFestivalsFile, 2025, 'en'),
    festivalsHi: readFestivalsForYear(v1Festivals as AnyFestivalsFile, 2025, 'hi'),
    festivalsByDate: readFestivalsForDate(v1Festivals as AnyFestivalsFile, '2025-01-14', 'en'),
    festivalsOutOfRange: readFestivalsForYear(v1Festivals as AnyFestivalsFile, 2026, 'en') === null,
    phasesEn: readMoonPhasesForYear(v1Phases as AnyMoonPhasesFile, 2025, 'en'),
    phasesHi: readMoonPhasesForYear(v1Phases as AnyMoonPhasesFile, 2025, 'hi'),
    phasesByDate: readMoonPhasesForDate(v1Phases as AnyMoonPhasesFile, '2025-01-29', 'hi'),
    range: readFestivalsYearRange(v1Festivals as AnyFestivalsFile),
  };
  tblHits['v1Read']!++;
  h.update(`v1 ${JSON.stringify(v1)}\n`);

  const golden = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source:
        'src/calendar/buildFestivalsTable.ts, buildEclipsesTable.ts, ' +
        'buildMoonPhasesTable.ts and the three readers',
      claim:
        'Go internal/calendar emits byte-identical table files and reads them ' +
        'back the same way, in both locales and both formats.',
      note:
        'The sha256 is over JSON.stringify(file, null, 2) + "\\n", the G4.6 ' +
        'byte-identical gate, and the same serialization generate/generate-*.ts ' +
        'uses. `languages: ["hi","en"]` and the two single-locale builds are in ' +
        'the sweep because the emitted key order follows the caller\'s locale ' +
        'order, which a fixed-field Go struct would get wrong, and because ' +
        "pick()'s fallback arm is only reachable when a locale is absent.",
      v1Note:
        'No builder emits v1 any longer, so the D16 sniff\'s false arm is ' +
        'reachable only from a hand-built fixture. Without it the sniff would ' +
        'have one live branch and one dead one, and the dead one is the ' +
        'compatibility promise.',
    },
    cases: TBL_CASES,
    digest: h.digest('hex'),
    tblHits,
    tables: cases,
    v1,
  };

  const out = join(REPO, 'testdata', 'goldens', 'calendar', 'tables-golden.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(golden, null, 2) + '\n', 'utf8');
  const unreached = Object.entries(tblHits).filter(([, v]) => v === 0).map(([k]) => k);
  process.stderr.write(
    `wrote tables-golden.json (${TBL_CASES.length} builds x 3 formats, ` +
    `${tblHits['festivalEntries']} festival entries, ${tblHits['eclipseEntries']} eclipse entries, ` +
    `${unreached.length} arms UNREACHED${unreached.length ? ': ' + unreached.join(' ') : ''})\n`,
  );
}

/**
 * A fixed token rather than a rounded rendering: the claim here is only about
 * the bytes around it.
 */
function maskEclipseFloats(json: string): string {
  return json
    .replace(/("obscuration": )-?[0-9.eE+-]+/g, '$1<float>')
    .replace(/("magnitude": )-?[0-9.eE+-]+/g, '$1<float>');
}

function firstEclipseEntryKeys(
  file: ReturnType<typeof buildEclipsesTable>, withSutak = false,
): string[] | null {
  for (const days of Object.values(file.years)) {
    for (const d of days) {
      for (const e of d.eclipses) {
        if (withSutak === (e.sutak !== undefined)) return Object.keys(e);
      }
    }
  }
  return null;
}

function main(): void {
  writeDeltaTGolden();
  writePositionGolden();
  writeCacheGolden();
  writeRiseSetGolden();
  writeLunationGolden();
  writeEclipseGolden();
  mkdirSync(join(REPO, 'testdata', 'goldens', 'utils'), { recursive: true });
  writeUtilsGolden();
  writeElementsGolden();
  writeJsDateGolden();
  writeCalendarGolden();
  writeSlotsGolden();
  writeWindowsGolden();
  writeBigWindowsGolden();
  writeJyotishGolden();
  writeJyotishFoundationsGolden();
  writeFestivalDispatchGolden();
  writeDayFestivalsGolden();
  writeYearlyGolden();
  writeMuhurtaGolden();
  writeTablesGolden();
  writeKeyOrderGolden();
  writeChartsFoundationGolden();
  writeVargasGolden();
  writeChartRulesGolden();
  writeMatchingGolden();
  writeShadbalaGolden();
  writeYogasGolden();
  writeDashaGolden();
  writeSadeSatiGolden();
  writeUpagrahaGolden();
  writeVarshaphalaGolden();
  writeKpAndPraveshaGolden();
  const accessors = ephemerisAccessors();
  const ephemeris = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/astronomy/elp.ts, src/astronomy/vsop87.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Go ELP/VSOP evaluation is bit-identical to the TypeScript. Construction ' +
        'check, not an accuracy oracle, accuracy is Tier 0 and the truncation ' +
        'budgets are checked against the untruncated tables separately.',
      sample: `ranqd1 seed ${EPHEMERIS_SEED >>> 0}, ${EPHEMERIS_SAMPLES} epochs uniform on |t| <= ${T_MAX_CENTURIES} centuries`,
    },
    seed: EPHEMERIS_SEED >>> 0,
    samples: EPHEMERIS_SAMPLES,
    tMaxCenturies: T_MAX_CENTURIES,
    samplesShort: EPHEMERIS_SAMPLES_SHORT,
    digests: Object.fromEntries(
      Object.keys(accessors).sort().map((name) => [name, ephemerisDigest(accessors[name]!, EPHEMERIS_SAMPLES)]),
    ),
    digestsShort: Object.fromEntries(
      Object.keys(accessors).sort().map((name) => [name, ephemerisDigest(accessors[name]!, EPHEMERIS_SAMPLES_SHORT)]),
    ),
    cases: ephemerisCases(accessors),
  };
  writeFileSync(
    join(REPO, 'testdata', 'goldens', 'astronomy', 'ephemeris-golden.json'),
    JSON.stringify(ephemeris, null, 2) + '\n',
    'utf8',
  );
  process.stderr.write(
    `wrote ephemeris-golden.json (${Object.keys(ephemeris.digests).length} accessors)\n`,
  );

  const trig = {
    _meta: {
      generator: 'source/go/parity/goldens.src.ts (bash source/go/parity/goldens.sh)',
      source: 'src/astronomy/trig.ts',
      baseline: 'master @ c38c606 (intended tag v5.1.1) + the uncommitted fixes in src/core/nakshatra.ts, src/core/panchang.ts, src/jyotish/lagna.ts',
      claim:
        'Go Sin/Cos are bit-identical to the TypeScript sin/cos. This is a ' +
        'construction check, not an accuracy oracle, accuracy is Tier 0.',
      generatorSeed: '0x5eed + range, per tests/validation/differential-trig.test.ts',
    },
    ranges: RANGES.map(({ name, range, samples }) => ({
      name,
      range,
      samples,
      seed: (0x5eed + range) >>> 0,
      sha256: sweepDigest(0x5eed + range, samples, range),
    })),
    cases: cases(),
  };

  const out = join(REPO, 'testdata', 'goldens', 'astronomy', 'trig-golden.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(trig, null, 2) + '\n', 'utf8');
  process.stderr.write(`wrote ${out} (${trig.cases.length} cases, ${trig.ranges.length} sweeps)\n`);
}

main();
