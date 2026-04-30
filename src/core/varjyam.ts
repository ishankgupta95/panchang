import { getNakshatraIndexAtTime } from './nakshatra';
import { VARJYAM_OFFSET_GHATIKAS } from '../utils/constants';
import { assertNakshatraIndex } from '../utils/validation';
import type { TimePeriod } from '../types/elements';

/**
 * Lookback / lookforward window for the bisections that locate the
 * boundaries of the active nakshatra. A nakshatra spans ~21–27 hours (Moon's
 * variable speed), so 30 h either side of any point inside the nakshatra
 * reliably sits in a *different* nakshatra — making the bisection valid.
 */
const NAKSHATRA_LOOKBACK_HOURS = 30;
const NAKSHATRA_LOOKFORWARD_HOURS = 30;

/**
 * Varjyam (Vishaghati / Nakshatra Thyajyam) — a forbidden ~1.5h window per
 * day, keyed to the day's nakshatra. Width is **elastic** — proportional
 * to the active nakshatra's duration — to match DrikPanchang's published
 * Varjyam.
 *
 * Algorithm (matches DrikPanchang)
 * --------------------------------
 * Each nakshatra has a tabulated "tyajya" offset measured in **ghatikas of
 * the nakshatra's own duration** (1 ghatika = `nakshatraDuration / 60`).
 * The Varjyam window spans 4 such ghatikas. Because the Moon's apparent
 * speed varies (~11–15°/day), nakshatra durations vary 21–27 h and the
 * Varjyam width therefore varies ~84–108 minutes day-to-day.
 *
 * The offsets in {@link VARJYAM_OFFSET_GHATIKAS} are 0-indexed elapsed
 * ghatikas (e.g. Ashwini 50 because DrikPanchang prints "Tyajya 51 to 54"
 * and `start_label - 1 = 50`). The same numerical table is used for both
 * fixed and elastic interpretations — the difference is the ghatika length.
 *
 *     varjyamStart = nakshatraStart + offsetGhatikas × (nakshatraDuration / 60)
 *     varjyamEnd   = varjyamStart + 4 × (nakshatraDuration / 60)
 *
 * The window is clamped to overlap with the Hindu day (sunrise →
 * nextSunrise); `null` is returned when there is no overlap or when the
 * nakshatra's boundaries cannot be located within
 * {@link NAKSHATRA_LOOKBACK_HOURS} / {@link NAKSHATRA_LOOKFORWARD_HOURS}.
 *
 * Single-window contract
 * ----------------------
 * Only the nakshatra active at sunrise is consulted. Days on which a
 * nakshatra transition occurs may host two Varjyam windows (one per
 * nakshatra); printed panchangs show both. This API returns at most one.
 * A future revision may return an array.
 *
 * @param currentNakshatraIndex  Nakshatra index (0..26) active at `sunriseUtc`.
 * @param sunriseUtc             UTC of local sunrise — start of the Hindu day.
 * @param nextSunriseUtc         UTC of the following day's local sunrise.
 * @param getMoon                Sidereal Moon longitude (degrees) at a UTC instant.
 * @returns                      The Varjyam `TimePeriod`, or `null` when the
 *                               computed window has no overlap with the Hindu day,
 *                               or when the nakshatra's boundaries cannot be located.
 */
export function computeVarjyam(
  currentNakshatraIndex: number,
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): TimePeriod | null {
  assertNakshatraIndex(currentNakshatraIndex, 'currentNakshatraIndex');

  const getIndex = (d: Date) => getNakshatraIndexAtTime(d, getMoon);

  const nakshatraStartUtc = findNakshatraStart(sunriseUtc, currentNakshatraIndex, getIndex);
  if (nakshatraStartUtc === null) return null;

  const nakshatraEndUtc = findNakshatraEnd(sunriseUtc, currentNakshatraIndex, getIndex);
  if (nakshatraEndUtc === null) return null;

  const nakshatraDurationMs = nakshatraEndUtc.getTime() - nakshatraStartUtc.getTime();
  const ghatikaMs = nakshatraDurationMs / 60;
  const offsetGhatikas = VARJYAM_OFFSET_GHATIKAS[currentNakshatraIndex]!;
  const varjyamStart = new Date(nakshatraStartUtc.getTime() + offsetGhatikas * ghatikaMs);
  const varjyamEnd = new Date(varjyamStart.getTime() + 4 * ghatikaMs);

  if (
    varjyamEnd.getTime() <= sunriseUtc.getTime() ||
    varjyamStart.getTime() >= nextSunriseUtc.getTime()
  ) {
    return null;
  }

  return { start: varjyamStart, end: varjyamEnd };
}

/**
 * Locate the leftmost UTC moment the Moon was already inside `currentIndex`.
 *
 * Bisects "Moon-index === currentIndex" over
 * `[sunrise − NAKSHATRA_LOOKBACK_HOURS, sunrise]`. Tolerance: ~30 s.
 *
 * Returns `null` when the Moon is still in `currentIndex` at the lookback
 * boundary — astronomically impossible, so this branch indicates inconsistent
 * upstream longitude data and the caller surfaces it as the `null` branch
 * of the Varjyam contract.
 */
function findNakshatraStart(
  sunriseUtc: Date,
  currentIndex: number,
  getIndexAt: (d: Date) => number,
): Date | null {
  const TOL_MS = 30_000;
  const MAX_ITERS = 30;
  const lookbackMs = NAKSHATRA_LOOKBACK_HOURS * 3600_000;
  let lo = sunriseUtc.getTime() - lookbackMs;
  let hi = sunriseUtc.getTime();

  if (getIndexAt(new Date(lo)) === currentIndex) return null;

  for (let i = 0; i < MAX_ITERS && hi - lo > TOL_MS; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (getIndexAt(new Date(mid)) === currentIndex) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}

/**
 * Locate the leftmost UTC moment the Moon has *exited* `currentIndex`,
 * searching forward from `sunriseUtc`. This is the start instant of the
 * next nakshatra; equivalently, the end of the active nakshatra.
 *
 * Bisects on `getIndexAt(d) !== currentIndex` over
 * `[sunrise, sunrise + NAKSHATRA_LOOKFORWARD_HOURS]`. Tolerance: ~30 s.
 *
 * Returns `null` when the Moon is still in `currentIndex` at the lookforward
 * boundary — astronomically impossible, so this branch likewise indicates
 * inconsistent upstream longitude data.
 */
function findNakshatraEnd(
  sunriseUtc: Date,
  currentIndex: number,
  getIndexAt: (d: Date) => number,
): Date | null {
  const TOL_MS = 30_000;
  const MAX_ITERS = 30;
  const lookforwardMs = NAKSHATRA_LOOKFORWARD_HOURS * 3600_000;
  let lo = sunriseUtc.getTime();
  let hi = sunriseUtc.getTime() + lookforwardMs;

  if (getIndexAt(new Date(hi)) === currentIndex) return null;

  for (let i = 0; i < MAX_ITERS && hi - lo > TOL_MS; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (getIndexAt(new Date(mid)) === currentIndex) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}
