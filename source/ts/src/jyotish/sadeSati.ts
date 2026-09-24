import { getTropicalPlanetLongitude } from '../astronomy/planet';
import { computeAyanamsa } from '../astronomy/ayanamsa';
import { normalize360 } from '../utils/angle';
import { validateDate } from '../utils/validation';
import type { AyanamsaType } from '../types/options';
import type { SadeSatiInfo } from '../types/jyotish';

const DAY_MS = 86400_000;
/** Days outside the arc that count as a true exit. Saturn's retrograde excursions
 *  back across a rashi boundary last 7 to about 240 days, so only the shorter ones
 *  are bridged into one arc; a longer one ends the arc, and the return starts a new one. */
const STABILITY_DAYS = 90;
const COARSE_STEP = 7;
/** One full ~29.5 y Saturn period. */
const MAX_FORWARD_SCAN_DAYS = 30 * 365;
/** Active arcs are ≤ 7.5 y. */
const MAX_BACKWARD_SCAN_DAYS = 12 * 365;
/**
 * Bounds how fast Saturn's sidereal longitude moves, deg/day: the measured maximum over every
 * instant a scan can reach (1887 to 2132, all five ayanamsas, which share one precession rate) is
 * 0.1303. So a sample d degrees from the nearest rashi boundary where the arc test changes keeps
 * its answer for ceil(d / (0.2 * 7)) - 1 more coarse steps, which the scans take without
 * evaluating. It only decides how many samples go unevaluated, never what any of them yields.
 */
const SATURN_MAX_DEG_PER_DAY = 0.2;
const SATURN_MAX_DEG_PER_COARSE_STEP = SATURN_MAX_DEG_PER_DAY * COARSE_STEP;

function saturnSiderealLongitude(date: Date, ayanamsa: AyanamsaType): number {
  const tropical = getTropicalPlanetLongitude('saturn', date);
  return normalize360(tropical - computeAyanamsa(date, ayanamsa));
}

function saturnRashi(date: Date, ayanamsa: AyanamsaType): number {
  return Math.floor(saturnSiderealLongitude(date, ayanamsa) / 30);
}

/** The rashi boundaries, in degrees, at which `isInArc` changes. */
function arcEdges(isInArc: (rashi: number) => boolean): number[] {
  const edges: number[] = [];
  for (let r = 0; r < 12; r++) {
    if (isInArc(r) !== isInArc((r + 11) % 12)) edges.push(r * 30);
  }
  return edges;
}

/** How many coarse samples after one at sidereal `longitude` are certain to give the same
 * `isInArc` answer: Saturn cannot move far enough in that time to reach any of `edges`. */
function steadySteps(longitude: number, edges: readonly number[]): number {
  if (edges.length === 0) return 0;
  let d = 360;
  for (const e of edges) {
    let x = Math.abs(longitude - e);
    if (x > 180) x = 360 - x;
    d = Math.min(d, x);
  }
  const n = Math.ceil(d / SATURN_MAX_DEG_PER_COARSE_STEP) - 1;
  return n > 0 ? n : 0;
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
      nextArcStart: findNextEntry(asOfDate, isInArc, ayanamsa),
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
  const edges = arcEdges(isInArc);

  for (let i = 0; i < maxIters; i++) {
    currentDate = new Date(currentDate.getTime() + stepMs);
    const longitude = saturnSiderealLongitude(currentDate, ayanamsa);
    const inside = isInArc(Math.floor(longitude / 30));
    // This sample and the steady ones after it share one answer; the steady ones are stepped
    // through without being evaluated.
    for (let steady = steadySteps(longitude, edges); ; steady--) {
      if (inside) {
        outsideRunDays = 0;
        lastInsideDate = currentDate;
      } else {
        outsideRunDays += COARSE_STEP;
        if (outsideRunDays >= STABILITY_DAYS) {
          return refineBoundary(lastInsideDate, isInArc, direction, ayanamsa);
        }
      }
      if (steady === 0 || !(i + 1 < maxIters)) break;
      i++;
      currentDate = new Date(currentDate.getTime() + stepMs);
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
      return direction === 'forward' ? next : date;
    }
    date = next;
  }
  return date;
}

/** Next entry into any arc rashi, so a retrograde return into the 2nd from the Moon counts. */
function findNextEntry(
  startDate: Date,
  isInArc: (rashi: number) => boolean,
  ayanamsa: AyanamsaType,
): Date | null {
  const stepMs = COARSE_STEP * DAY_MS;
  let date = startDate;
  const startLongitude = saturnSiderealLongitude(date, ayanamsa);
  let prevRashi = Math.floor(startLongitude / 30);
  const maxIters = MAX_FORWARD_SCAN_DAYS / COARSE_STEP;
  const edges = arcEdges(isInArc);
  // A steady sample answers `isInArc` as `prevRashi` does, so it can be neither an entry nor
  // change what `prevRashi` answers: it is stepped over.
  let steady = steadySteps(startLongitude, edges);

  for (let i = 0; i < maxIters; i++) {
    const next = new Date(date.getTime() + stepMs);
    if (steady > 0) {
      steady--;
      date = next;
      continue;
    }
    const longitude = saturnSiderealLongitude(next, ayanamsa);
    const r = Math.floor(longitude / 30);
    steady = steadySteps(longitude, edges);
    if (isInArc(r) && !isInArc(prevRashi)) {
      let lo = date.getTime();
      let hi = next.getTime();
      while (hi - lo > DAY_MS) {
        const mid = lo + (hi - lo) / 2;
        if (isInArc(saturnRashi(new Date(mid), ayanamsa))) hi = mid;
        else lo = mid;
      }
      return new Date(hi);
    }
    date = next;
    prevRashi = r;
  }
  return null;
}
