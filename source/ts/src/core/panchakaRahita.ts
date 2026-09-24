import { solveAngleCrossing } from '../utils/search';
import type { UtcWindow } from '../types/elements';
import { validateDate } from '../utils/validation';

/** Half-open `[start, end)` windows of the Hindu day with the Moon OUTSIDE Panchaka, i.e. sidereal longitude in [0°, 300°). */
export function computePanchakaRahita(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): UtcWindow[] {
  validateDate(sunriseUtc, 'any');
  validateDate(nextSunriseUtc, 'any');
  const inPanchakaAt = (d: Date) => getMoon(d) >= 300;

  const startInP = inPanchakaAt(sunriseUtc);
  const endInP = inPanchakaAt(nextSunriseUtc);

  if (startInP === endInP) {
    return startInP ? [] : [{ start: sunriseUtc, end: nextSunriseUtc }];
  }

  const targetDeg = startInP ? 0 : 300;
  const crossing = bisectBoundary(sunriseUtc, nextSunriseUtc, inPanchakaAt, targetDeg, getMoon);
  return startInP
    ? [{ start: crossing, end: nextSunriseUtc }]
    : [{ start: sunriseUtc, end: crossing }];
}

/** Bisection only narrows the bracket; {@link solveAngleCrossing} finishes, so the
 *  answer is not quantized to `BRACKET_MS`. */
function bisectBoundary(
  loUtc: Date,
  hiUtc: Date,
  predicate: (d: Date) => boolean,
  targetDeg: number,
  getMoon: (d: Date) => number,
): Date {
  const BRACKET_MS = 120_000;
  const MAX_ITERS = 30;
  const startState = predicate(loUtc);
  let lo = loUtc.getTime();
  let hi = hiUtc.getTime();

  for (let i = 0; i < MAX_ITERS && hi - lo > BRACKET_MS; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (predicate(new Date(mid)) === startState) lo = mid;
    else hi = mid;
  }
  const solved = solveAngleCrossing(
    lo, hi, targetDeg, getMoon, (ms) => predicate(new Date(ms)) === startState,
  );
  return new Date(solved ?? hi);
}
