import { computeRashiChart } from './charts';
import { findSolarReturn } from './varshaphala';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { normalize360 } from '../utils/angle';
import { validateDate, validateLocation } from '../utils/validation';
import { PanchangError } from '../types/errors';
import type { AyanamsaType, BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type {
  BhavaChart, LagnaInfo, PlanetPlacement,
} from '../types/jyotish';

// ── Types ──────────────────────────────────────────────

/**
 * Tithi-Pravesha (annual soli-lunar return) chart.
 *
 * Cast at the **PVR Narasimha Rao redefinition** moment in year-N: the
 * UTC instant when (a) the sidereal Sun is in its natal sidereal sign,
 * AND (b) the Sun-Moon angular separation equals the natal Sun-Moon
 * separation (mod 360°). This is the South-Indian counterpart to the
 * Varshaphala solar-return chart, with the additional Moon constraint
 * that anchors the lunar phase.
 *
 * The natal tithi is preserved exactly — `praveshTithi === natalTithi`
 * by construction — so the chart is timed to the same lunar-phase
 * moment as the natal birth, in the corresponding sidereal solar arc.
 *
 * Sources: Sanjay Rath, *Tithi Pravesha* (srath.com); PVR Narasimha Rao,
 * *Re-Defining Tithi Pravesha Chart* (Saptarishis Astrology).
 */
export interface TithiPraveshaChart {
  /** UTC instant of the tithi-pravesha moment. */
  praveshInstant: Date;
  /** Natal tithi index 0..29 (Shukla 1..15 → 0..14, Krishna 1..15 → 15..29). */
  natalTithi: number;
  /**
   * Tithi at the pravesha instant. By construction equals `natalTithi` —
   * the value is surfaced for caller-side assertions / debugging.
   */
  praveshTithi: number;
  /** Sidereal ascendant at the pravesha instant. */
  varshaLagna: LagnaInfo;
  /** 9-graha placements at the pravesha instant. */
  planets: PlanetPlacement[];
  /** House cusps under the configured house system. */
  bhava: BhavaChart;
}

// ── Constants ──────────────────────────────────────────

const SIDEREAL_YEAR_DAYS = 365.25636;
/** Synodic-rate-of-Sun-Moon difference, degrees per day. ≈ 12.190°/day. */
const MOON_SUN_DIFF_DEG_PER_DAY = 360 / 29.5306; // ≈ 12.1907

// ── Public API ─────────────────────────────────────────

/**
 * Compute the Tithi-Pravesha chart for a given annual cycle of the native.
 *
 * **Algorithm.**
 *
 * 1. Compute the natal Sun-Moon angular separation
 *    `Δ_natal = (Moon_natal − Sun_natal) mod 360°`.
 * 2. Locate the **solar-return instant** for year `yearAge` — the time
 *    when sidereal Sun matches its natal value (re-uses
 *    {@link computeVarshaphala}'s Newton search). The Sun is in its
 *    natal sidereal sign for ~30 days centered on this instant.
 * 3. Within ±15 days of the solar return, **bisect** on the Sun-Moon
 *    difference: locate the instant where
 *    `(Moon(t) − Sun(t)) mod 360° = Δ_natal`. The Moon-Sun difference
 *    advances at ~12.19°/day, so within any 30-day window it crosses
 *    every target value at least once. Convergence ≤ 25 iterations to
 *    < 1 second.
 *
 * The returned chart is cast at that instant and includes a full bhava
 * + planets package via {@link computeRashiChart}.
 *
 * @param natalBirth UTC instant of birth.
 * @param yearAge    1-indexed annual cycle (1 = first tithi-pravesha,
 *                   typically the same year as the first birthday).
 * @param location   Geographic location for the pravesha chart cusps.
 * @param options    Birth-chart options (ayanamsa, language, house system).
 *
 * @example
 * ```typescript
 * import { computeTithiPravesha } from 'panchang-ts';
 *
 * const tp = computeTithiPravesha(
 *   new Date('1995-08-15T05:30:00Z'),
 *   30,
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * tp.praveshInstant;       // exact tithi-pravesha moment
 * tp.natalTithi === tp.praveshTithi;  // always true by construction
 * tp.varshaLagna.rashi.name;
 * ```
 */
export function computeTithiPravesha(
  natalBirth: Date,
  yearAge: number,
  location: GeoLocation,
  options: BirthChartOptions = {},
): TithiPraveshaChart {
  validateDate(natalBirth);
  validateLocation(location);
  if (!Number.isInteger(yearAge) || yearAge < 1) {
    throw new PanchangError(
      `Tithi-Pravesha yearAge must be a positive integer (1 = first cycle); got ${yearAge}`,
      'INVALID_INPUT',
    );
  }

  const ayanamsaType: AyanamsaType = options.ayanamsa ?? 'lahiri';

  // 1. Natal Sun-Moon offset and natal Sun rashi.
  const natalSun = getSiderealSunLongitude(natalBirth, ayanamsaType);
  const natalMoon = getSiderealMoonLongitude(natalBirth, ayanamsaType);
  const targetDelta = normalize360(natalMoon - natalSun);
  const natalTithi = computeNatalTithiIndex(natalSun, natalMoon);
  const natalSunRashi = Math.floor(natalSun / 30);

  // 2. Solar-return centre — Sun in natal sign for ~30d window centered here.
  const solarReturn = findSolarReturn(natalBirth, yearAge, natalSun, ayanamsaType);

  // 3. Newton to the closest tithi match. If that lands on the wrong side
  //    of a sign boundary, shift by ±synodic period to land in natal sign.
  const praveshInstant = findTithiPraveshaInNatalSign(
    solarReturn, targetDelta, natalSunRashi, ayanamsaType,
  );

  // 4. Cast the full chart at that instant.
  const chart = computeRashiChart(praveshInstant, location, options);

  // 5. Compute the tithi at pravesha — should equal natalTithi.
  const praveshSun = getSiderealSunLongitude(praveshInstant, ayanamsaType);
  const praveshMoon = getSiderealMoonLongitude(praveshInstant, ayanamsaType);
  const praveshTithi = computeNatalTithiIndex(praveshSun, praveshMoon);

  return {
    praveshInstant,
    natalTithi,
    praveshTithi,
    varshaLagna: chart.lagna,
    planets: chart.planets,
    bhava: chart.bhava,
  };
}

// ── Tithi index helper ─────────────────────────────────

/**
 * Compute the integer tithi index 0..29 from sidereal Sun and Moon
 * longitudes. `floor((Moon − Sun) / 12°)` per the canonical 30-step
 * lunar-phase partition. Re-implemented locally to keep this module
 * cycle-free with respect to `core/tithi`.
 */
function computeNatalTithiIndex(sunLon: number, moonLon: number): number {
  const diff = normalize360(moonLon - sunLon);
  return Math.min(29, Math.floor(diff / 12));
}

// ── Bisect for Sun-Moon difference match ──────────────

/** Synodic month — Moon-Sun cycle period in milliseconds. */
const SYNODIC_MONTH_MS = 29.530589 * 86400_000;

/**
 * Top-level tithi-pravesha locator that enforces both PVR conditions:
 * (1) Moon-Sun separation matches natal, AND (2) Sun is in natal
 * sidereal sign at the pravesha instant.
 *
 * Strategy:
 *
 *   1. Run Newton from the solar-return instant (`findTithiPravesha`)
 *      to find the closest tithi-match `t1`.
 *   2. If Sun's rashi at `t1` equals the natal Sun's rashi → done.
 *   3. Otherwise, shift by **one synodic month** in the direction that
 *      brings `t` toward the solar-return centre, then re-run Newton
 *      from there. The Sun-in-natal-sign window is ~30.4 days wide and
 *      adjacent tithi-matches are 29.53 days apart, so exactly one of
 *      `t1` and `t1 ± SYNODIC` falls in the natal-sign window for
 *      every fixture.
 *
 * If neither candidate lands in the natal sign (degenerate case at very
 * high latitudes or pathological inputs), the function returns the
 * closer-to-SR result and lets the caller's downstream assertions
 * surface the inconsistency.
 *
 * @internal
 */
function findTithiPraveshaInNatalSign(
  solarReturn: Date,
  targetDelta: number,
  natalSunRashi: number,
  ayanamsaType: AyanamsaType,
): Date {
  const t1 = findTithiPravesha(solarReturn, targetDelta, ayanamsaType);
  const sunAtT1 = getSiderealSunLongitude(t1, ayanamsaType);
  if (Math.floor(sunAtT1 / 30) === natalSunRashi) return t1;

  // Wrong sign: try the adjacent tithi-match. Direction = toward SR.
  const dir = t1.getTime() < solarReturn.getTime() ? +1 : -1;
  const t2Approx = new Date(t1.getTime() + dir * SYNODIC_MONTH_MS);
  const t2 = findTithiPravesha(t2Approx, targetDelta, ayanamsaType);
  const sunAtT2 = getSiderealSunLongitude(t2, ayanamsaType);
  if (Math.floor(sunAtT2 / 30) === natalSunRashi) return t2;

  // Neither candidate in natal sign — return the one closer to SR for
  // determinism. (No realistic fixture should hit this path.)
  const dT1 = Math.abs(t1.getTime() - solarReturn.getTime());
  const dT2 = Math.abs(t2.getTime() - solarReturn.getTime());
  return dT1 <= dT2 ? t1 : t2;
}

/** @internal */

/**
 * Locate the UTC instant near `centerInstant` (the solar-return time)
 * where `(siderealMoon − siderealSun) mod 360° == targetDelta` to
 * better than 0.0001° (≈ 0.5 seconds of Moon-Sun motion).
 *
 * Algorithm: Newton-style iteration on the **wrapped** phase deviation
 * `Δφ(t) = ((target − (moon(t) − sun(t)) + 540) % 360) − 180`, which is
 * always in [-180°, 180°) and locally linear with slope
 * `MOON_SUN_DIFF_DEG_PER_DAY` ≈ 12.19°/day.
 *
 * Each iteration corrects `t` by `+Δφ / 12.19` days (positive Δφ → step
 * forward to *catch up* to the target). The starting point is
 * `centerInstant` (the solar-return moment); the closest pravesha is
 * within one synodic month (~29.5 days). Convergence is 2–4 iterations.
 *
 * Newton refinement is robust here because the wrapped function has
 * exactly one zero in the synodic period centered on `centerInstant`
 * and the linear approximation is excellent at this timescale (Moon's
 * motion is 13.18°/day, Sun's 0.99°/day; the 12.19°/day difference is
 * stable to ≪ 1 % over a day).
 *
 * @internal
 */
function findTithiPravesha(
  centerInstant: Date,
  targetDelta: number,
  ayanamsaType: AyanamsaType,
): Date {
  let t = centerInstant.getTime();
  const TOL_DEG = 0.0001;

  for (let iter = 0; iter < 25; iter++) {
    const t0 = new Date(t);
    const moon = getSiderealMoonLongitude(t0, ayanamsaType);
    const sun = getSiderealSunLongitude(t0, ayanamsaType);
    const d = normalize360(moon - sun);
    let phaseDelta = targetDelta - d;
    phaseDelta = ((phaseDelta + 540) % 360) - 180; // [-180, 180)

    if (Math.abs(phaseDelta) < TOL_DEG) break;
    t += (phaseDelta / MOON_SUN_DIFF_DEG_PER_DAY) * 86400_000;
  }

  return new Date(Math.round(t));
}

// ── Test-only exports ──────────────────────────────────

/** @internal */
/** @internal */
export const _computeNatalTithiIndexForTest = computeNatalTithiIndex;

// Touch SIDEREAL_YEAR_DAYS to keep it for documentation purposes; it is
// reserved for future bracketing logic that needs an explicit window-size
// guard around the solar-return centre.
void SIDEREAL_YEAR_DAYS;
