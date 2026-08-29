import { getTropicalPlanetLongitude } from '../astronomy/planet';
import { computeAyanamsa } from '../astronomy/ayanamsa';
import { normalize360 } from '../utils/angle';
import { validateDate } from '../utils/validation';
import type { AyanamsaType } from '../types/options';
import type { SadeSatiInfo } from '../types/jyotish';

const DAY_MS = 86400_000;
/** Days outside the arc that qualify as a true exit; long enough to absorb retrograde re-crossings (~7° amplitude). */
const STABILITY_DAYS = 90;
const COARSE_STEP = 7;
/** One full ~29.5 y Saturn period. */
const MAX_FORWARD_SCAN_DAYS = 30 * 365;
/** Active arcs are ≤ 7.5 y. */
const MAX_BACKWARD_SCAN_DAYS = 12 * 365;

// Must stay on the same apparent-position path as `computePlanetaryPositions`.
function saturnSiderealLongitude(date: Date, ayanamsa: AyanamsaType): number {
  const tropical = getTropicalPlanetLongitude('saturn', date);
  return normalize360(tropical - computeAyanamsa(date, ayanamsa));
}

function saturnRashi(date: Date, ayanamsa: AyanamsaType): number {
  return Math.floor(saturnSiderealLongitude(date, ayanamsa) / 30);
}

/**
 * Sade Sati status at `asOfDate`: active while Saturn transits {M−1, M, M+1} for
 * the natal Moon rashi M (`natalMoonRashi`, 0..11), to ±7-day precision.
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
  let lastInsideDate = startDate;
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
        return refineBoundary(lastInsideDate, isInArc, direction, ayanamsa);
      }
    }
  }
  return null;
}

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
