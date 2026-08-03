import { Body, Equator, Horizon, MakeTime, Observer } from 'astronomy-engine';
import { computeRashiChart } from './charts';
import { computeShadbala } from './shadbala';
import { computeLagna } from './lagna';
import { RASHI_LORD } from './matchingTables';
import {
  ALL_SAHAM_NAMES, SAHAM_FORMULAS,
  type SahamFormula, type SahamName, type SahamOperand,
} from './sahamsTables';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { resolveMasaName } from '../i18n/resolver';
import { normalize360 } from '../utils/angle';
import { validateDate, validateLocation } from '../utils/validation';
import { PanchangError } from '../types/errors';
import type { AyanamsaType, BirthChartOptions, Language } from '../types/options';
import type { GeoLocation } from '../types/location';
import type {
  BhavaChart, BirthChart, GrahaName, LagnaInfo, PlanetPlacement,
} from '../types/jyotish';

// ── Types ──────────────────────────────────────────────

/**
 * One Saham's resolved position in the varsha (annual) chart.
 *
 * A Saham is computed as `(X − Y + Z) mod 360°` (with X/Y swap on night
 * birth for the Sahams flagged in {@link SAHAM_FORMULAS}). The `longitude`
 * is the sidereal ecliptic point; `rashi` and `house` derive from that.
 */
export interface SahamPosition {
  /** Sidereal longitude of the Saham, [0, 360). */
  longitude: number;
  /** Zodiac sign the Saham occupies, 0..11 (Mesha … Meena). */
  rashi: number;
  /** Localized rashi name (`en` or `hi`) — same locale as the varsha chart. */
  rashiName: string;
  /** House (1..12) the Saham occupies, whole-sign from the varsha lagna. */
  house: number;
}

/**
 * Muntha — the year-by-year sensitive point that advances one rashi per
 * birthday. Anchored at the **natal** lagna's rashi at age 0; advances
 * by `yearAge` rashis (mod 12).
 */
export interface MunthaInfo {
  /** Rashi index (0..11) the Muntha occupies in the varsha chart. */
  rashi: number;
  /** Lord of the Muntha rashi (one of the 7 visible grahas). */
  lord: Exclude<GrahaName, 'Rahu' | 'Ketu'>;
  /** House (1..12) the Muntha occupies, whole-sign from the varsha lagna. */
  house: number;
}

/**
 * Full Varshaphala (Tajik annual) chart for a given solar-return year.
 *
 * The chart is cast at the **solar-return instant** — the UTC moment in
 * year-N when the sidereal Sun returns to its natal longitude (within
 * 0.0001° / ~9 arcseconds). Subsequent Tajik analytics layer on this:
 *
 *   - `varshaLagna` — sidereal ascendant at the solar-return instant.
 *   - `muntha` — the natal-lagna-anchored sensitive point advanced by
 *     `yearAge` rashis.
 *   - `yearLord` — the strongest of four Tajik year-lord candidates,
 *     selected by total Shadbala from the varsha chart.
 *   - `sahams` — the 27 core-set Sahams (Punya, Vidya, …, Tapas).
 *   - `planets` — full 9-graha placement at the varsha instant
 *     (re-uses `computeRashiChart`).
 *   - `bhava` — house cusps under the configured house system.
 */
export interface VarshaphalaChart {
  /** UTC moment of the sidereal solar return for `yearAge`. */
  solarReturnInstant: Date;
  /** Sidereal ascendant at the solar-return instant. */
  varshaLagna: LagnaInfo;
  /** Muntha — annual sensitive point. */
  muntha: MunthaInfo;
  /** Year lord (Varsha Pati) by max Shadbala among the four classical candidates. */
  yearLord: Exclude<GrahaName, 'Rahu' | 'Ketu'>;
  /** All 27 core Sahams keyed by name. */
  sahams: Record<SahamName, SahamPosition>;
  /** True if the solar-return instant occurred during day (Sun above horizon). */
  isDayBirth: boolean;
  /** 9-graha placements in the varsha chart. */
  planets: PlanetPlacement[];
  /** House cusps for the varsha chart under the configured house system. */
  bhava: BhavaChart;
}

// ── Constants ──────────────────────────────────────────

/**
 * Sidereal year (Sun returning to the same sidereal longitude) in days.
 * Used as the per-year stride for the solar-return initial guess.
 *
 * 365.25636 days = 365 d 6 h 9 m 9.7 s. Within 1 day of the natal
 * anniversary even after 100 years, so the Newton refinement below
 * converges in ~3–5 iterations.
 */
const SIDEREAL_YEAR_DAYS = 365.25636;

/** Sun's mean sidereal motion, degrees per day. Used to convert delta to time step. */
const SUN_DEG_PER_DAY = 360 / SIDEREAL_YEAR_DAYS; // ≈ 0.98561

type VisibleGraha = Exclude<GrahaName, 'Rahu' | 'Ketu'>;

const VISIBLE_GRAHAS_BY_INDEX: readonly VisibleGraha[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

// ── Public API ─────────────────────────────────────────

/**
 * Compute the Varshaphala (Tajik annual horoscope) for a given solar-return
 * year of a native.
 *
 * **Solar return.** A Newton-style refinement around `birthDate +
 * yearAge × 365.25636 days` finds the UTC instant when sidereal Sun =
 * natal sidereal Sun (mod 360°) to within 0.0001° (~9 arcsec). Typical
 * convergence: 3–5 iterations.
 *
 * **Muntha.** `munthaRashi = (natalLagnaRashi + yearAge) mod 12`. Muntha
 * lord = rashi-lord of `munthaRashi`. Muntha house is the whole-sign
 * house (1..12) of `munthaRashi` from the varsha lagna.
 *
 * **Year lord (Varsha Pati).** Selected as the planet with the highest
 * total Shadbala from these 4 candidates (per BPHS Tajik tradition):
 *   1. Varsha lagna lord.
 *   2. Muntha lord.
 *   3. Lord of the Sun's rashi at the varsha instant.
 *   4. Triraashi Pati (3-rashi-trine ruler), per the day/night table.
 *
 * **Sahams.** 27-Saham core set computed in the varsha chart per
 * Neelakantha's *Tajika Neelakanthi*. Day/night flips apply to the 9
 * Sahams flagged in {@link SAHAM_FORMULAS} (Punya, Vidya, Karma, Putra,
 * Roga, Gnati, Bhratri, Matri, Pitri). The extended 50-Saham list is
 * deferred (data-only extension).
 *
 * **Sources.** Neelakantha *Tajika Neelakanthi*; B.V. Raman *Annual
 * Horoscope*; Sanjay Rath *Crux of Vedic Astrology* Tajik appendix;
 * PVR Narasimha Rao Tajik essays.
 *
 * @param natalBirth UTC instant of birth.
 * @param yearAge    1-indexed solar-return year (1 = first solar return,
 *                   typically the day on or near the first birthday). Must
 *                   be a positive integer.
 * @param location   Geographic location for the varsha chart cusps —
 *                   pass the natal location (classical convention) or
 *                   the location at the varsha-time residence.
 * @param options    Birth-chart options (ayanamsa, language, house system).
 *
 * @example
 * ```typescript
 * import { computeVarshaphala } from 'panchang-ts';
 *
 * const varsha = computeVarshaphala(
 *   new Date('1995-08-15T05:30:00Z'),
 *   30,                                              // 30th solar return
 *   { latitude: 28.6139, longitude: 77.2090 },       // New Delhi
 * );
 * varsha.solarReturnInstant;       // ~ 2025-08-15T05:30:Z (within minutes)
 * varsha.varshaLagna.rashi.name;   // ascendant rashi at the return
 * varsha.muntha.lord;              // Muntha lord — graha
 * varsha.yearLord;                 // Varsha Pati (strongest of 4)
 * varsha.sahams.Punya.longitude;   // Punya Saham, [0, 360)
 * varsha.sahams.Punya.house;       // Punya's house from varsha lagna
 * ```
 */
export function computeVarshaphala(
  natalBirth: Date,
  yearAge: number,
  location: GeoLocation,
  options: BirthChartOptions = {},
): VarshaphalaChart {
  validateDate(natalBirth);
  validateLocation(location);
  if (!Number.isInteger(yearAge) || yearAge < 1) {
    throw new PanchangError(
      `Varshaphala yearAge must be a positive integer (1 = first solar return); got ${yearAge}`,
      'INVALID_INPUT',
    );
  }

  const ayanamsaType: AyanamsaType = options.ayanamsa ?? 'lahiri';
  const lang: Language = options.language ?? 'en';

  const natalSun = getSiderealSunLongitude(natalBirth, ayanamsaType);
  const solarReturnInstant = findSolarReturn(natalBirth, yearAge, natalSun, ayanamsaType);

  const varshaChart = computeRashiChart(solarReturnInstant, location, options);
  const isDay = isDayBirth(solarReturnInstant, location);

  const natalLagna = computeLagna(natalBirth, location, ayanamsaType, lang);
  const muntha = buildMuntha(natalLagna.rashi.index, yearAge, varshaChart.lagna.rashi.index, lang);
  const yearLord = pickYearLord(varshaChart, muntha.lord, isDay, solarReturnInstant, location, options);

  const sahams = computeSahams(varshaChart, isDay, lang);

  return {
    solarReturnInstant,
    varshaLagna: varshaChart.lagna,
    muntha,
    yearLord,
    sahams,
    isDayBirth: isDay,
    planets: varshaChart.planets,
    bhava: varshaChart.bhava,
  };
}

// ── Solar return search ────────────────────────────────

/**
 * Locate the UTC instant in year `yearAge` when the sidereal Sun returns
 * to its natal sidereal longitude.
 *
 * Algorithm: Newton-style refinement starting from the calendar
 * approximation `natalBirth + yearAge × SIDEREAL_YEAR_DAYS`. Each step
 * corrects `t` by `−Δλ / SUN_DEG_PER_DAY` days, where Δλ is the wrapped
 * (sidereal-Sun − natal) longitude difference in [-180°, 180°). Converges
 * to 0.0001° (~9 arcsec, ~9 minutes of solar motion / 60 ≈ 9 ms of
 * timing) within 3–5 iterations on cooperative inputs.
 *
 * The 25-iteration cap and 0.0001° tolerance match the plan; in practice
 * the loop exits in a handful of iterations because the Sun's apparent
 * sidereal motion is locally linear over 1-day windows.
 *
 * @internal — exported via `_findSolarReturnForTest` for unit tests.
 */
function findSolarReturn(
  natalBirth: Date,
  yearAge: number,
  natalSun: number,
  ayanamsaType: AyanamsaType,
): Date {
  let t = natalBirth.getTime() + yearAge * SIDEREAL_YEAR_DAYS * 86400_000;

  const TOL_DEG = 0.0001;
  for (let iter = 0; iter < 25; iter++) {
    const lon = getSiderealSunLongitude(new Date(t), ayanamsaType);
    let delta = lon - natalSun;
    delta = ((delta + 540) % 360) - 180; // wrap to [-180, 180)
    if (Math.abs(delta) < TOL_DEG) break;
    t -= (delta / SUN_DEG_PER_DAY) * 86400_000;
  }

  return new Date(Math.round(t));
}

/** @internal */
export const _findSolarReturnForTest = findSolarReturn;

// ── Day / night detection ──────────────────────────────

/**
 * Day-birth flag: true iff the Sun is geometrically above the horizon at
 * the given UTC instant for the given location. Refraction and the Sun's
 * apparent radius are not applied — the classical "day birth" rule uses
 * the geometric center of the Sun.
 *
 * @internal — exported via `_isDayBirthForTest` for unit tests.
 */
function isDayBirth(date: Date, location: GeoLocation): boolean {
  const observer = new Observer(location.latitude, location.longitude, location.elevation ?? 0);
  const time = MakeTime(date);
  const equ = Equator(Body.Sun, time, observer, true, true);
  const hor = Horizon(time, observer, equ.ra, equ.dec, 'normal');
  return hor.altitude > 0;
}

/** @internal */
export const _isDayBirthForTest = isDayBirth;

// ── Muntha ─────────────────────────────────────────────

function buildMuntha(
  natalLagnaRashi: number,
  yearAge: number,
  varshaLagnaRashi: number,
  lang: Language,
): MunthaInfo {
  const munthaRashi = (natalLagnaRashi + yearAge) % 12;
  const lordIdx = RASHI_LORD[munthaRashi]!;
  const lord = VISIBLE_GRAHAS_BY_INDEX[lordIdx]!;
  const house = ((munthaRashi - varshaLagnaRashi + 12) % 12) + 1;
  // lang reserved for future Muntha-rashi name field; kept for API consistency.
  void lang;
  return { rashi: munthaRashi, lord, house };
}

// ── Year lord (Varsha Pati) ────────────────────────────

/**
 * Triraashi Pati — 3-rashi-trine (elemental triplicity) ruler per
 * the standard Tajik table. Element index = `rashi % 4`:
 *
 *   0 → Fire  (Aries / Leo / Sag)
 *   1 → Earth (Taurus / Virgo / Cap)
 *   2 → Air   (Gemini / Libra / Aqua)
 *   3 → Water (Cancer / Scorpio / Pisces)
 *
 * Day rulers: Sun (fire), Venus (earth), Saturn (air), Venus (water).
 * Night rulers: Jupiter (fire), Moon (earth), Mercury (air), Mars (water).
 *
 * Source: B.V. Raman, *Annual Horoscope* Ch. 2.
 */
function triraashiPati(rashi: number, isDay: boolean): VisibleGraha {
  const elem = rashi % 4;
  if (isDay) {
    return (['Sun', 'Venus', 'Saturn', 'Venus'] as const)[elem]!;
  }
  return (['Jupiter', 'Moon', 'Mercury', 'Mars'] as const)[elem]!;
}

/**
 * Year lord (Varsha Pati) — strongest of:
 *   1. Varsha lagna lord
 *   2. Muntha lord
 *   3. Lord of the Sun's rashi at the varsha instant
 *   4. Triraashi Pati of the varsha lagna (day/night rule)
 *
 * "Strongest" = highest total Shadbala from the varsha chart. Tajik bala
 * is itself a Shadbala variant; using Shadbala is the published
 * simplification used by most public Tajik calculators.
 *
 * If two candidates tie on Shadbala, the order above wins (varsha-lagna
 * lord first, then Muntha lord, then Sun's rashi lord, then Triraashi).
 */
function pickYearLord(
  varshaChart: BirthChart,
  munthaLord: VisibleGraha,
  isDay: boolean,
  varshaInstant: Date,
  location: GeoLocation,
  options: BirthChartOptions,
): VisibleGraha {
  const lagnaRashi = varshaChart.lagna.rashi.index;
  const lagnaLord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[lagnaRashi]!]!;

  const sunPlacement = varshaChart.byPlanet.Sun;
  const sunRashiLord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[sunPlacement.rashi.index]!]!;

  const triraashi = triraashiPati(lagnaRashi, isDay);

  // De-dupe in priority order so ties resolve to the earlier candidate.
  const candidates: VisibleGraha[] = [];
  for (const c of [lagnaLord, munthaLord, sunRashiLord, triraashi]) {
    if (!candidates.includes(c)) candidates.push(c);
  }

  const shadbala = computeShadbala(varshaInstant, location, options);

  let best: VisibleGraha = candidates[0]!;
  let bestTotal = shadbala[best].total;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const total = shadbala[c].total;
    if (total > bestTotal) {
      best = c;
      bestTotal = total;
    }
  }
  return best;
}

// ── Sahams ─────────────────────────────────────────────

/**
 * Resolve a {@link SahamOperand} to its sidereal longitude in the varsha
 * chart. `Punya` is special — it must be computed first (the iteration
 * order in {@link SAHAM_FORMULAS} guarantees this) and is then carried in
 * `priorSahams`.
 */
function resolveOperand(
  op: SahamOperand,
  varshaChart: BirthChart,
  priorSahams: Partial<Record<SahamName, number>>,
): number {
  switch (op) {
    case 'Sun':
    case 'Moon':
    case 'Mars':
    case 'Mercury':
    case 'Jupiter':
    case 'Venus':
    case 'Saturn':
      return varshaChart.byPlanet[op].longitude;
    case 'Asc':
      return varshaChart.lagna.siderealLongitude;
    case 'AscLord': {
      const lord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[varshaChart.lagna.rashi.index]!]!;
      return varshaChart.byPlanet[lord].longitude;
    }
    case 'House11Cusp': {
      const lagnaRashi = varshaChart.lagna.rashi.index;
      return ((lagnaRashi + 10) % 12) * 30;
    }
    case 'Punya': {
      const v = priorSahams.Punya;
      if (v === undefined) {
        throw new PanchangError(
          'Saham operand Punya referenced before Punya was computed',
          'SAHAM_DEPENDENCY_ERROR',
        );
      }
      return v;
    }
  }
}

/**
 * Compute one Saham's longitude given its formula. Honors the day/night
 * X/Y swap when `formula.swap` is true and `isDay` is false.
 */
function evaluateSaham(
  formula: SahamFormula,
  isDay: boolean,
  varshaChart: BirthChart,
  priorSahams: Partial<Record<SahamName, number>>,
): number {
  const xOp = formula.swap && !isDay ? formula.y : formula.x;
  const yOp = formula.swap && !isDay ? formula.x : formula.y;
  const x = resolveOperand(xOp, varshaChart, priorSahams);
  const y = resolveOperand(yOp, varshaChart, priorSahams);
  const z = resolveOperand(formula.z, varshaChart, priorSahams);
  return normalize360(x - y + z);
}

/**
 * Compute all 27 Sahams for a varsha chart. Returns a map keyed by Saham
 * name with sidereal longitude, rashi index, localized rashi name, and
 * whole-sign house from the varsha lagna.
 */
function computeSahams(
  varshaChart: BirthChart,
  isDay: boolean,
  lang: Language,
): Record<SahamName, SahamPosition> {
  const longitudes: Partial<Record<SahamName, number>> = {};

  // First pass: longitudes only. Iteration order matters — Punya before
  // Yasas/Mitra/Susha, etc. The formulas table is already in correct order.
  for (const formula of SAHAM_FORMULAS) {
    longitudes[formula.name] = evaluateSaham(formula, isDay, varshaChart, longitudes);
  }

  const lagnaRashi = varshaChart.lagna.rashi.index;
  const out = {} as Record<SahamName, SahamPosition>;
  for (const name of ALL_SAHAM_NAMES) {
    const lon = longitudes[name]!;
    const rashi = Math.floor(lon / 30);
    out[name] = {
      longitude: lon,
      rashi,
      rashiName: resolveMasaName(rashi, lang),
      house: ((rashi - lagnaRashi + 12) % 12) + 1,
    };
  }
  return out;
}

// ── Test-only exports ──────────────────────────────────

/** @internal */
export const _triraashiPatiForTest = triraashiPati;
/** @internal */
export const _evaluateSahamForTest = evaluateSaham;
/** @internal */
export const _resolveOperandForTest = resolveOperand;
