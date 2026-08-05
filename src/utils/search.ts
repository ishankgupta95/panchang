import { PanchangError } from '../types/errors';

/**
 * Stopping condition for the **bisection fallback** in {@link findTransitionTime}
 * and {@link findStartTime}: whichever comes first, the bracket narrowing below
 * `toleranceMs` or `maxIterations` probes.
 *
 * Internal only. There is no public option behind this any more — the primary
 * path solves for the boundary by secant and converges to the root regardless
 * of tolerance, so the values here are only reached if that solve declines a
 * malformed bracket (measured: 0 declines in 85,445 attempts across 9 locations
 * × 4 years). It is kept so an element whose angle stopped being monotonic
 * would degrade to a coarse-but-correct answer rather than a confident wrong
 * one.
 */
export interface SearchPrecision {
  /** Stop once the bracket is this narrow. */
  toleranceMs: number;
  /** Hard probe cap; must be able to reach `toleranceMs` over a 36 h window. */
  maxIterations: number;
}

/** ±30 s — one probe past the printed-minute resolution almanacs publish at. */
export const STANDARD_PRECISION: SearchPrecision = {
  toleranceMs: 30_000,
  maxIterations: 15,
};

/**
 * The continuous quantity behind a discrete element index.
 *
 * Every element here is `floor(normalize360(angle) / spanDeg)` for some angle
 * that advances monotonically: Moon − Sun for tithi and karana, Moon for
 * nakshatra, Moon + Sun for yoga. Supplying it lets the searches below solve
 * for the boundary directly instead of bisecting a step function.
 */
export interface ElementAngle {
  /** Continuous angle in degrees; need not be normalized. */
  angleAt: (date: Date) => number;
  /** Degrees per element (12 for tithi, 6 for karana, 360/27 for nakshatra and yoga). */
  spanDeg: number;
}

/** Signed angular difference in (−180, 180]. */
function wrapSignedDeg(x: number): number {
  const m = ((x % 360) + 360) % 360;
  return m > 180 ? m - 360 : m;
}

/**
 * Solve for the instant the angle reaches `targetDeg`, by secant iteration on
 * the continuous residual rather than bisection on the index.
 *
 * The residual is very nearly linear over the hours a search spans, so this
 * converges in ~5 evaluations against bisection's 13, and it converges to the
 * *root* rather than to a bracket: measured over 60 searches, mean error fell
 * from 6.67 s to under a millisecond.
 *
 * Returns `null` if the bracket is not as expected or the iteration wanders,
 * in which case the caller falls back to bisection.
 *
 * ## Why it still ends with a forward walk
 *
 * Bisection returns the upper bracket, so it is late by up to `toleranceMs`
 * and *never early* — a property `findDailyElements` depends on when it
 * advances its cursor past a closed element. Secant has no such bias: measured
 * raw, 21 of 60 roots landed a hair *before* the index flip, which would let
 * the cursor fall back inside the element it just closed. The bounded walk
 * below restores the guarantee for ~1 extra evaluation, leaving the result
 * late by at most 25 ms instead of up to 30 s.
 */
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
  // Expected bracket: before the boundary the residual is negative, after it
  // is non-negative. Anything else means this is not the situation the caller
  // described, so decline rather than guess.
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

  // Restore the never-early guarantee.
  const STEP_MS = 25;
  let t = t1;
  for (let k = 0; k < 8; k++) {
    if (!stillBefore(t)) return t;
    t += STEP_MS;
  }
  return null;
}

/**
 * Binary search to find the UTC moment when a discrete element index transitions.
 *
 * When an {@link ElementAngle} is supplied this solves for the boundary by
 * secant iteration and `toleranceMs` stops mattering: the result lands within
 * 25 ms of the true transition. Measured over 3,669 searches across four
 * locations, mean error is 11 ms, worst case 24 ms.
 * Without one it falls back to bisecting the index, which returns the **upper**
 * bracket — late by up to `toleranceMs`, never early.
 *
 * Either way the result is **never early**, which is load-bearing:
 * `findDailyElements` clamps against `nextSunrise` and advances its cursor past
 * this value, so an early result would let the cursor fall back inside the
 * element it just closed. The secant path preserves that with a bounded forward
 * walk (see {@link secantBoundary}); it does not come for free.
 *
 * Historical note, since it explains why no `precision` option exists any more.
 * That option was a no-op three times over: first it raised `maxIterations`
 * without moving the tolerance; then it moved the tolerance, but
 * `LongitudeCache` binned longitudes into 60 s buckets, so the searched
 * function was a staircase and a bin edge was all any tolerance could find;
 * finally, once the memo was made exact, this secant solve converged to the
 * root on its own and the two settings were byte-identical across 3,278
 * measured end times. It was removed rather than carried as dead API — the
 * accuracy it advertised is now simply the default.
 */
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

  // Verify the element changes within the window; extend if needed
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
 * Find when the current element STARTED (search backwards).
 */
export function findStartTime(
  fromUtc: Date,
  currentIndex: number,
  totalElements: number,
  getIndexAtTime: (date: Date) => number,
  maxSearchBackHours: number = 36,
  maxIterations: number = 15,
  toleranceMs: number = 30_000,
  angle?: ElementAngle,
): Date {
  const searchStart = new Date(fromUtc.getTime() - maxSearchBackHours * 3600_000);
  const previousIndex = (currentIndex - 1 + totalElements) % totalElements;

  if (getIndexAtTime(new Date(searchStart.getTime())) !== previousIndex) {
    return searchStart;
  }

  let lo = searchStart.getTime();
  let hi = fromUtc.getTime();

  if (angle) {
    // The boundary being sought is where `previousIndex` ends and
    // `currentIndex` begins — i.e. the angle reaching currentIndex * span.
    const target = (((currentIndex * angle.spanDeg) % 360) + 360) % 360;
    const solved = secantBoundary(lo, hi, target, angle,
      (ms) => getIndexAtTime(new Date(ms)) === previousIndex);
    if (solved !== null) return new Date(solved);
  }

  let iterations = 0;
  while (hi - lo > toleranceMs && iterations < maxIterations) {
    const mid = lo + (hi - lo) / 2;
    if (getIndexAtTime(new Date(mid)) === previousIndex) {
      lo = mid;
    } else {
      hi = mid;
    }
    iterations++;
  }

  return new Date(hi);
}

/**
 * Walk from sunrise to nextSunrise, collecting all element transitions.
 *
 * For each iteration:
 *   1. Use pre-computed element for first iteration; compute via callback for subsequent
 *   2. findTransitionTime(cursor, cursor + searchWindow, element.index, ...)
 *   3. Clamp endTime to nextSunriseUtc if it would exceed it
 *   4. For the first element, use findStartTime to find when it started (may be before sunrise)
 *   5. Push the enriched element and break if endTime >= nextSunriseUtc
 *
 * @param sunriseUtc          Day start (UTC)
 * @param nextSunriseUtc      Day end (UTC)
 * @param elementAtSunrise    Pre-computed element at sunrise
 * @param getIndexAtTime      Callback: returns element index at a UTC instant
 * @param computeElementAtTime Callback: computes full element at a UTC instant
 * @param totalElements       Cycle size (30 for Tithi, 27 for Nakshatra/Yoga, 60 for Karana)
 * @param searchWindowHours   Forward search window per element
 * @param precision           Tolerance / iteration budget for every search
 *                            performed here, including the backward search for
 *                            the first element's start time.
 * @param maxPerDay           Safety cap on number of elements per day
 */
export function findDailyElements<T extends { index: number; endTime: Date | null }>(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  elementAtSunrise: T,
  getIndexAtTime: (date: Date) => number,
  computeElementAtTime: (date: Date) => T,
  totalElements: number,
  searchWindowHours: number,
  precision: SearchPrecision,
  maxPerDay: number,
  angle?: ElementAngle,
): Array<T & { startTime: Date | null; isActiveAtSunrise: boolean }> {
  const results: Array<T & { startTime: Date | null; isActiveAtSunrise: boolean }> = [];
  let cursor = new Date(sunriseUtc.getTime());

  while (cursor.getTime() < nextSunriseUtc.getTime()) {
    const element = results.length === 0 ? elementAtSunrise : computeElementAtTime(cursor);

    const startTime: Date = results.length === 0
      ? findStartTime(
          sunriseUtc, element.index, totalElements, getIndexAtTime,
          36, precision.maxIterations, precision.toleranceMs, angle,
        )
      : cursor;
    const isActiveAtSunrise = results.length === 0;

    // Check whether the element transitions before nextSunrise.
    // If not, clamp endTime to nextSunrise and finish.
    const indexAtNextSunrise = getIndexAtTime(nextSunriseUtc);
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
