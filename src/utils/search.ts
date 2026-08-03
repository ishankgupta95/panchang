import { PanchangError } from '../types/errors';

/**
 * How precisely element transition times are resolved.
 *
 * The binary search stops on whichever comes first: the bracket narrowing below
 * `toleranceMs`, or `maxIterations` probes. For these to be consistent,
 * `maxIterations` must be large enough to *reach* the tolerance across the
 * widest search window (36 h): ⌈log2(36 h / tolerance)⌉ probes.
 *
 * This pairing used to be wrong. `precision: 'high'` raised `maxIterations`
 * from 15 to 25 but left the tolerance at 30 s — and 36 h narrows to 30 s in 13
 * probes, so the tolerance always bound first and the option changed nothing.
 * It was verified byte-identical to `'standard'` across 60 consecutive days.
 * Precision now moves the tolerance, which is the knob that actually binds.
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
 * ±1 s. 36 h → 1 s needs ⌈log2(129_600_000 / 1000)⌉ = 17 probes, so 20 leaves
 * headroom for the window extensions in `findTransitionTime`.
 */
export const HIGH_PRECISION: SearchPrecision = {
  toleranceMs: 1_000,
  maxIterations: 20,
};

/**
 * Binary search to find the UTC moment when a discrete element index transitions.
 *
 * Returns the **upper** bracket — the earliest probe known to be past the
 * transition — so the result is biased late by up to `toleranceMs` and is never
 * early. At the default ±30 s that bias is the dominant error in a published
 * end time; `precision: 'high'` cuts it to ±1 s.
 *
 * The convention is deliberate and load-bearing: `findDailyElements` clamps
 * against `nextSunrise` and advances its cursor past this value, and a
 * never-early result guarantees the cursor cannot land back inside the element
 * it just closed. Returning the midpoint would halve the error but needs that
 * walk re-checked, and would shift every published end time by ~15 s.
 *
 * One consequence to be aware of: an element occupying less than `toleranceMs`
 * at the very end of a Hindu day sits entirely inside the bracket, so whether
 * it survives depends on which side of `nextSunrise` the returned bound lands
 * on. `tests/integration/edge-cases.test.ts` pins a real case — a ~6 s yoga at
 * NYC on 2026-02-27 — as a canary for changes to this search or to the
 * longitude memo it reads through.
 */
export function findTransitionTime(
  startUtc: Date,
  maxEndUtc: Date,
  currentIndex: number,
  getIndexAtTime: (date: Date) => number,
  maxIterations: number = 15,
  toleranceMs: number = 30_000,
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
): Date {
  const searchStart = new Date(fromUtc.getTime() - maxSearchBackHours * 3600_000);
  const previousIndex = (currentIndex - 1 + totalElements) % totalElements;

  if (getIndexAtTime(new Date(searchStart.getTime())) !== previousIndex) {
    return searchStart;
  }

  let lo = searchStart.getTime();
  let hi = fromUtc.getTime();

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
): Array<T & { startTime: Date | null; isActiveAtSunrise: boolean }> {
  const results: Array<T & { startTime: Date | null; isActiveAtSunrise: boolean }> = [];
  let cursor = new Date(sunriseUtc.getTime());

  while (cursor.getTime() < nextSunriseUtc.getTime()) {
    const element = results.length === 0 ? elementAtSunrise : computeElementAtTime(cursor);

    const startTime: Date = results.length === 0
      ? findStartTime(
          sunriseUtc, element.index, totalElements, getIndexAtTime,
          36, precision.maxIterations, precision.toleranceMs,
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
      precision.maxIterations, precision.toleranceMs,
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
