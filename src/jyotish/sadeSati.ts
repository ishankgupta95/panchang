import { getTropicalPlanetLongitude } from '../astronomy/planet';
import { computeAyanamsa } from '../astronomy/ayanamsa';
import { normalize360 } from '../utils/angle';
import { validateDate } from '../utils/validation';
import type { AyanamsaType } from '../types/options';
import type { SadeSatiInfo } from '../types/jyotish';

const DAY_MS = 86400_000;
/** Days Saturn must remain *outside* the arc to qualify as a true exit. */
const STABILITY_DAYS = 90;
/** Coarse scan step for boundary search (days). */
const COARSE_STEP = 7;
/**
 * Maximum lookahead for arc-end / next-arc search (days).
 *
 * Saturn's sidereal period is ~29.5 years, so the gap between consecutive
 * Saturn entries into any specific rashi can be up to ~29.5 years. The
 * lookahead must cover that worst-case so `nextArcStart` is found for natives
 * whose next Sade Sati is far in the future.
 */
const MAX_FORWARD_SCAN_DAYS = 30 * 365;
/** Maximum lookback for arc-start search (days). Active arcs are ≤ 7.5y. */
const MAX_BACKWARD_SCAN_DAYS = 12 * 365;

/**
 * Sidereal longitude of Saturn at a given UTC date.
 *
 * Single-body fast path — avoids `computePlanetaryPositions` overhead since
 * Sade Sati boundary search invokes this hundreds of times.
 *
 * This previously asked for the *geometric* position (`GeoVector(…, false)`)
 * while `computePlanetaryPositions` published the apparent one, so the Saturn
 * longitude a Sade Sati boundary was solved from differed from the Saturn
 * longitude the chart reported. The gap is Saturn's aberration, ~20″, worth
 * ~3.5 hours of transit time on a boundary that lasts seven and a half years —
 * invisible in the result, but the two are now the same number.
 */
function saturnSiderealLongitude(date: Date, ayanamsa: AyanamsaType): number {
  const tropical = getTropicalPlanetLongitude('saturn', date);
  return normalize360(tropical - computeAyanamsa(date, ayanamsa));
}

function saturnRashi(date: Date, ayanamsa: AyanamsaType): number {
  return Math.floor(saturnSiderealLongitude(date, ayanamsa) / 30);
}

/**
 * Compute Sade Sati status for a native with the given natal Moon rashi,
 * evaluated at `asOfDate` (default: now).
 *
 * Algorithm:
 *   1. Determine Saturn's current rashi.
 *   2. If Saturn is in {M-1, M, M+1} (mod 12), the native is in Sade Sati.
 *   3. Walk Saturn's transit backward in 7-day steps until 90 consecutive
 *      days fall outside the arc → arc-start day. Walk forward similarly →
 *      arc-end day. The 90-day stability window absorbs retrograde
 *      re-crossings of rashi boundaries (Saturn's retrograde amplitude is
 *      ~7°, well under one rashi).
 *   4. If not active, scan forward in 7-day steps for the first day Saturn
 *      enters M-1.
 *
 * Boundary precision: ±7 days (the coarse step). Use `computePlanetaryPositions`
 * directly for higher-precision Saturn transit dates.
 *
 * Cancellations: none surfaced. This matches drik panchang's published
 * Shani Sadesati calculator, which reports active phases and arc dates
 * only and notes "whether Sadesati proves auspicious or inauspicious
 * depends entirely on Shani's position in one's Janma Kundali" as
 * qualitative narrative rather than a programmatic cancellation rule.
 * Classical mitigations (strong natal Saturn, Saturn–Jupiter aspects,
 * etc.) are intentionally not modelled here so that this output stays
 * in lockstep with drik panchang's panel.
 *
 * @param natalMoonRashi  Native's Moon rashi at birth (0..11).
 * @param asOfDate        Evaluation date (defaults to now).
 * @param ayanamsa        Sidereal system (defaults to `'lahiri'`).
 *
 * @example
 * ```typescript
 * const sadeSati = computeSadeSati(natalMoonRashi, new Date());
 * if (sadeSati.active) console.log('Phase', sadeSati.phase, 'until', sadeSati.currentArcEnd);
 * ```
 */
export function computeSadeSati(
  natalMoonRashi: number,
  asOfDate: Date = new Date(),
  ayanamsa: AyanamsaType = 'lahiri',
): SadeSatiInfo {
  if (!Number.isInteger(natalMoonRashi) || natalMoonRashi < 0 || natalMoonRashi >= 12) {
    throw new RangeError(`natalMoonRashi must be integer in [0, 11], got ${natalMoonRashi}`);
  }
  validateDate(asOfDate);

  const M = natalMoonRashi;
  const arcRashis: readonly number[] = [(M + 11) % 12, M, (M + 1) % 12];
  const isInArc = (r: number): boolean =>
    r === arcRashis[0] || r === arcRashis[1] || r === arcRashis[2];

  const currentRashi = saturnRashi(asOfDate, ayanamsa);
  const active = isInArc(currentRashi);

  if (!active) {
    return {
      active: false,
      phase: null,
      currentArcStart: null,
      currentArcEnd: null,
      nextArcStart: findNextEntry(asOfDate, arcRashis[0]!, ayanamsa),
    };
  }

  const phase: 1 | 2 | 3 =
    currentRashi === arcRashis[0] ? 1 : currentRashi === arcRashis[1] ? 2 : 3;

  return {
    active: true,
    phase,
    currentArcStart: findArcBoundary(asOfDate, isInArc, 'backward', ayanamsa),
    currentArcEnd: findArcBoundary(asOfDate, isInArc, 'forward', ayanamsa),
    nextArcStart: null,
  };
}

/**
 * Walk Saturn's transit in `direction` until 90 consecutive days fall
 * outside the arc. Returns the boundary day (the day Saturn left or
 * entered the arc, whichever applies in `direction`).
 */
function findArcBoundary(
  startDate: Date,
  isInArc: (rashi: number) => boolean,
  direction: 'forward' | 'backward',
  ayanamsa: AyanamsaType,
): Date | null {
  const stepDays = direction === 'forward' ? COARSE_STEP : -COARSE_STEP;
  const stepMs = stepDays * DAY_MS;
  const maxIters = (direction === 'forward' ? MAX_FORWARD_SCAN_DAYS : MAX_BACKWARD_SCAN_DAYS)
    / COARSE_STEP;

  let currentDate = startDate;
  let lastInsideDate = startDate; // Saturn was inside arc here
  let outsideRunDays = 0;

  for (let i = 0; i < maxIters; i++) {
    currentDate = new Date(currentDate.getTime() + stepMs);
    const r = saturnRashi(currentDate, ayanamsa);
    if (isInArc(r)) {
      outsideRunDays = 0;
      lastInsideDate = currentDate;
    } else {
      outsideRunDays += COARSE_STEP;
      if (outsideRunDays >= STABILITY_DAYS) {
        // Boundary lies between lastInsideDate and (lastInsideDate + step).
        // Refine to 1-day precision.
        return refineBoundary(lastInsideDate, isInArc, direction, ayanamsa);
      }
    }
  }
  return null;
}

/**
 * Refine an arc boundary to 1-day precision. `lastInsideDate` is a day on
 * which Saturn is inside the arc; the day adjacent in `direction` is
 * outside. Step day-by-day until we find the precise transition.
 */
function refineBoundary(
  lastInsideDate: Date,
  isInArc: (rashi: number) => boolean,
  direction: 'forward' | 'backward',
  ayanamsa: AyanamsaType,
): Date {
  const stepMs = (direction === 'forward' ? 1 : -1) * DAY_MS;
  let date = lastInsideDate;
  for (let i = 0; i < COARSE_STEP * 2; i++) {
    const next = new Date(date.getTime() + stepMs);
    if (!isInArc(saturnRashi(next, ayanamsa))) {
      // `date` is the last inside day; `next` is the first outside day.
      return direction === 'forward' ? next : date;
    }
    date = next;
  }
  return date;
}

/** Forward-scan for the first day Saturn enters the given target rashi. */
function findNextEntry(
  startDate: Date,
  targetRashi: number,
  ayanamsa: AyanamsaType,
): Date | null {
  const stepMs = COARSE_STEP * DAY_MS;
  let date = startDate;
  let prevRashi = saturnRashi(date, ayanamsa);
  const maxIters = MAX_FORWARD_SCAN_DAYS / COARSE_STEP;

  for (let i = 0; i < maxIters; i++) {
    const next = new Date(date.getTime() + stepMs);
    const r = saturnRashi(next, ayanamsa);
    if (r === targetRashi && prevRashi !== targetRashi) {
      // Bisect between `date` (not target) and `next` (target).
      let lo = date.getTime();
      let hi = next.getTime();
      while (hi - lo > DAY_MS) {
        const mid = lo + (hi - lo) / 2;
        if (saturnRashi(new Date(mid), ayanamsa) === targetRashi) hi = mid;
        else lo = mid;
      }
      return new Date(hi);
    }
    date = next;
    prevRashi = r;
  }
  return null;
}
