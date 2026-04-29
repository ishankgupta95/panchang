import { getNakshatraIndexAtTime } from './nakshatra';
import {
  GHATIKA_MINUTES,
  VARJYAM_OFFSET_GHATIKAS,
  VARJYAM_DURATION_MINUTES,
} from '../utils/constants';
import { assertNakshatraIndex } from '../utils/validation';
import type { TimePeriod } from '../types/elements';

/**
 * Lookback window for `findNakshatraStart` bisection. A nakshatra spans
 * roughly 21–27 hours (Moon's variable speed), so 30 h before any point inside
 * the current nakshatra reliably sits in a *different* nakshatra — making the
 * bisection valid. If the Moon is still in `currentIndex` at -30 h, the
 * upstream longitude source is inconsistent (a single nakshatra cannot span
 * >27 h); the bisection cannot anchor a valid window and we degrade to the
 * `null` branch of the public contract.
 */
const NAKSHATRA_LOOKBACK_HOURS = 30;

/**
 * Varjyam (also called Vishaghati / Nakshatra Thyajyam) — a forbidden
 * ~96-minute window per day, keyed to the day's nakshatra.
 *
 * Classical rule (Muhurta-chintamani Ch. 4 / BPHS Ch. 71): each of the 27
 * nakshatras has a tabulated "tyajya" offset measured in ghatikas from the
 * nakshatra's START. The window itself spans a fixed 4 ghatikas (96 minutes).
 * No auspicious activity is initiated during Varjyam; the rest of the
 * nakshatra (about 22 ghatikas of the typical ~24-hour span) is permitted.
 *
 * The offset table lives in [VARJYAM_OFFSET_GHATIKAS](../utils/constants.ts).
 *
 * Implementation notes
 * --------------------
 * Because the offset is measured from the nakshatra's start (which usually
 * lies *before* sunrise), this function first locates that start by binary-
 * searching backward from sunrise for the leftmost time the Moon is in
 * `currentNakshatraIndex`. The Varjyam window is then offset + duration
 * from that anchor. The window may legitimately span local midnight; we
 * return its true boundaries when any portion overlaps the Hindu day
 * (sunrise → nextSunrise), and `null` when none does.
 *
 * Single-window contract
 * ----------------------
 * Only the nakshatra active at sunrise is consulted. Days on which a
 * nakshatra transition occurs may technically host two Varjyam windows
 * (one per nakshatra); printed panchangs show both. This API mirrors the
 * single-window shape used by [computeBhadraKaal](./bhadra.ts) — the
 * nakshatra-at-sunrise case covers the overwhelming majority of consumer
 * use cases. A future revision may return an array.
 *
 * @param currentNakshatraIndex  Nakshatra index (0..26) active at `sunriseUtc`.
 * @param sunriseUtc             UTC of local sunrise — start of the Hindu day.
 * @param nextSunriseUtc         UTC of the following day's local sunrise.
 * @param getMoon                Sidereal Moon longitude (degrees) at a UTC instant.
 * @returns                      The Varjyam `TimePeriod`, or `null` when the
 *                               computed window has no overlap with the Hindu day,
 *                               or when the nakshatra-start anchor cannot be
 *                               located within {@link NAKSHATRA_LOOKBACK_HOURS}
 *                               (indicates an upstream longitude inconsistency).
 */
export function computeVarjyam(
  currentNakshatraIndex: number,
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): TimePeriod | null {
  assertNakshatraIndex(currentNakshatraIndex, 'currentNakshatraIndex');

  const nakshatraStartUtc = findNakshatraStart(
    sunriseUtc,
    currentNakshatraIndex,
    (d) => getNakshatraIndexAtTime(d, getMoon),
  );
  if (nakshatraStartUtc === null) return null;

  const offsetGhatikas = VARJYAM_OFFSET_GHATIKAS[currentNakshatraIndex]!;
  const offsetMs = offsetGhatikas * GHATIKA_MINUTES * 60_000;
  const varjyamStart = new Date(nakshatraStartUtc.getTime() + offsetMs);
  const varjyamEnd = new Date(varjyamStart.getTime() + VARJYAM_DURATION_MINUTES * 60_000);

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
 * Bisects "Moon-index === currentIndex" over [sunrise − NAKSHATRA_LOOKBACK_HOURS,
 * sunrise]. Tolerance: ~30 s. Operates on integer milliseconds; only the
 * returned anchor is materialised as a Date.
 *
 * Returns `null` when the Moon is still in `currentIndex` at the lookback
 * boundary — astronomically impossible (a single nakshatra cannot span >27 h),
 * so this branch indicates inconsistent upstream longitude data. The caller
 * surfaces it as the `null` branch of the Varjyam contract rather than
 * throwing, since `null` already means "no Varjyam window to report".
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
