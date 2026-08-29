import { PanchangError } from '../types/errors';

export interface SearchPrecision {
  toleranceMs: number;
  maxIterations: number;
}

/** ±30 s: one probe past the printed-minute resolution almanacs publish at. */
export const STANDARD_PRECISION: SearchPrecision = {
  toleranceMs: 30_000,
  maxIterations: 15,
};

/** The monotone angle behind an index: Moon − Sun for tithi and karana, Moon for nakshatra, Moon + Sun for yoga. */
export interface ElementAngle {
  /** Degrees, not necessarily normalized. */
  angleAt: (date: Date) => number;
  spanDeg: number;
}

function wrapSignedDeg(x: number): number {
  const m = ((x % 360) + 360) % 360;
  return m > 180 ? m - 360 : m;
}

/** Secant solve for the instant the angle reaches `targetDeg`; `null` declines to the caller's bisection. */
function secantBoundary(
  loMs: number,
  hiMs: number,
  targetDeg: number,
  angle: ElementAngle,
  stillBefore: (ms: number) => boolean,
): number | null {
  const f = (t: number): number => wrapSignedDeg(angle.angleAt(new Date(t)) - targetDeg);
  let t0 = loMs;
  let t1 = hiMs;
  let f0 = f(t0);
  let f1 = f(t1);
  if (!(f0 < 0 && f1 >= 0)) return null;

  for (let k = 0; k < 8; k++) {
    if (f1 === f0) break;
    const next = Math.round(t1 - (f1 * (t1 - t0)) / (f1 - f0));
    if (!Number.isFinite(next) || next < loMs || next > hiMs) return null;
    const converged = Math.abs(next - t1) <= 1;
    t0 = t1; f0 = f1;
    t1 = next; f1 = f(t1);
    if (converged) break;
  }

  // Never return early: walk forward until the index has actually flipped.
  const STEP_MS = 25;
  let t = t1;
  for (let k = 0; k < 8; k++) {
    if (!stillBefore(t)) return t;
    t += STEP_MS;
  }
  return null;
}

export function solveElementBoundary(
  loMs: number,
  hiMs: number,
  angle: ElementAngle,
  stillBefore: (ms: number) => boolean,
): number | null {
  const indexAt = (ms: number): number =>
    Math.floor((((angle.angleAt(new Date(ms)) % 360) + 360) % 360) / angle.spanDeg);
  const target = ((((indexAt(loMs) + 1) * angle.spanDeg) % 360) + 360) % 360;
  return secantBoundary(loMs, hiMs, target, angle, stillBefore);
}

/** For a boundary that is not at an element index: Panchaka Rahita's 300° is 22.5 nakshatras. */
export function solveAngleCrossing(
  loMs: number,
  hiMs: number,
  targetDeg: number,
  angleAt: (date: Date) => number,
  stillBefore: (ms: number) => boolean,
): number | null {
  return secantBoundary(loMs, hiMs, targetDeg, { angleAt, spanDeg: 360 }, stillBefore);
}

/** Never returns early: `findDailyElements` advances its cursor past the result. */
export function findTransitionTime(
  startUtc: Date,
  maxEndUtc: Date,
  currentIndex: number,
  getIndexAtTime: (date: Date) => number,
  maxIterations: number = 15,
  toleranceMs: number = 30_000,
  angle?: ElementAngle,
): Date {
  let lo = startUtc.getTime();
  let hi = maxEndUtc.getTime();

  if (getIndexAtTime(new Date(hi)) === currentIndex) {
    const extensions = [6, 12, 18, 24];
    let found = false;
    for (const ext of extensions) {
      hi = maxEndUtc.getTime() + ext * 3600_000;
      if (getIndexAtTime(new Date(hi)) !== currentIndex) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new PanchangError(
        `Binary search could not find transition for element index ${currentIndex} ` +
          `within 48h+ of ${startUtc.toISOString()}`,
        'SEARCH_DIVERGED'
      );
    }
  }

  if (angle) {
    const target = ((((currentIndex + 1) * angle.spanDeg) % 360) + 360) % 360;
    const solved = secantBoundary(lo, hi, target, angle,
      (ms) => getIndexAtTime(new Date(ms)) === currentIndex);
    if (solved !== null) return new Date(solved);
  }

  let iterations = 0;
  while (hi - lo > toleranceMs && iterations < maxIterations) {
    const mid = lo + (hi - lo) / 2;
    if (getIndexAtTime(new Date(mid)) === currentIndex) {
      lo = mid;
    } else {
      hi = mid;
    }
    iterations++;
  }

  return new Date(hi);
}

/**
 * The bracket test is `!== currentIndex`, not "is the previous element": the
 * −36 h probe often lands two or more elements back.
 */
export function findStartTime(
  fromUtc: Date,
  currentIndex: number,
  getIndexAtTime: (date: Date) => number,
  maxSearchBackHours: number = 36,
  maxIterations: number = 15,
  toleranceMs: number = 30_000,
  angle?: ElementAngle,
): Date {
  const searchStart = new Date(fromUtc.getTime() - maxSearchBackHours * 3600_000);

  if (getIndexAtTime(new Date(searchStart.getTime())) === currentIndex) {
    return searchStart;
  }

  let lo = searchStart.getTime();
  let hi = fromUtc.getTime();

  if (angle) {
    const target = (((currentIndex * angle.spanDeg) % 360) + 360) % 360;
    const solved = secantBoundary(lo, hi, target, angle,
      (ms) => getIndexAtTime(new Date(ms)) !== currentIndex);
    if (solved !== null) return new Date(solved);
  }

  let iterations = 0;
  while (hi - lo > toleranceMs && iterations < maxIterations) {
    const mid = lo + (hi - lo) / 2;
    if (getIndexAtTime(new Date(mid)) !== currentIndex) {
      lo = mid;
    } else {
      hi = mid;
    }
    iterations++;
  }

  return new Date(hi);
}

/** The first element's `startTime` is searched backwards and may precede sunrise. */
export function findDailyElements<T extends { index: number; endTime: Date | null }>(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  elementAtSunrise: T,
  getIndexAtTime: (date: Date) => number,
  computeElementAtTime: (date: Date) => T,
  searchWindowHours: number,
  precision: SearchPrecision,
  maxPerDay: number,
  angle?: ElementAngle,
): Array<T & { startTime: Date | null; isActiveAtSunrise: boolean }> {
  const results: Array<T & { startTime: Date | null; isActiveAtSunrise: boolean }> = [];
  let cursor = new Date(sunriseUtc.getTime());

  // Safe to hoist: `getIndexAtTime` is pure through the call's longitude memo.
  const indexAtNextSunrise = getIndexAtTime(nextSunriseUtc);

  while (cursor.getTime() < nextSunriseUtc.getTime()) {
    const element = results.length === 0 ? elementAtSunrise : computeElementAtTime(cursor);

    const startTime: Date = results.length === 0
      ? findStartTime(
          sunriseUtc, element.index, getIndexAtTime,
          36, precision.maxIterations, precision.toleranceMs, angle,
        )
      : cursor;
    const isActiveAtSunrise = results.length === 0;

    if (indexAtNextSunrise === element.index) {
      results.push(Object.assign({}, element, {
        startTime,
        endTime: new Date(nextSunriseUtc.getTime()),
        isActiveAtSunrise,
      }) as T & { startTime: Date | null; isActiveAtSunrise: boolean });
      break;
    }

    const searchEnd = new Date(cursor.getTime() + searchWindowHours * 3600_000);
    const rawEnd = findTransitionTime(
      cursor, searchEnd, element.index, getIndexAtTime,
      precision.maxIterations, precision.toleranceMs, angle,
    );
    const endTime = rawEnd.getTime() > nextSunriseUtc.getTime()
      ? new Date(nextSunriseUtc.getTime())
      : rawEnd;

    results.push(Object.assign({}, element, {
      startTime,
      endTime,
      isActiveAtSunrise,
    }) as T & { startTime: Date | null; isActiveAtSunrise: boolean });

    if (rawEnd.getTime() >= nextSunriseUtc.getTime()) break;
    cursor = new Date(rawEnd.getTime() + 1);
    if (results.length >= maxPerDay) break;
  }

  return results;
}
