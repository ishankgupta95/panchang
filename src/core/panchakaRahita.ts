import { solveAngleCrossing } from '../utils/search';
import type { UtcWindow } from '../types/elements';

/**
 * Windows of the Hindu day during which the Moon is OUTSIDE Panchaka.
 *
 * Panchaka is active when the Moon occupies the last five nakshatras (the
 * sidereal range [300°, 360°)): Dhanishtha 3rd–4th pada (≥300°), Shatabhisha,
 * Purva Bhadrapada, Uttara Bhadrapada, and Revati. The complement of that
 * range — sidereal Moon ∈ [0°, 300°) — is the broader "Panchaka Rahita"
 * envelope used to answer "when is the Moon out of Panchaka today?"
 *
 * The Moon traverses the 60°-wide Panchaka span at ~13°/day, so Panchaka
 * persists for roughly 4–5 consecutive Hindu days at a time. On the
 * overwhelming majority of days, this function returns either a single
 * `[sunrise, nextSunrise]` slice (Moon out of Panchaka all day) or `[]`
 * (Moon in Panchaka all day). On the two transition days per ~four-week
 * cycle there is exactly one boundary crossing within the Hindu day,
 * yielding a single half-day slice.
 *
 * Scope note. DrikPanchang's "Panchak Rahit Muhurat" panel publishes a
 * multi-window slot derivation (Roga / Raja / Mrityu / Agni / Chora /
 * Panchak exclusion). This function deliberately exposes only the broader
 * Moon-out-of-Panchaka envelope; the slot-exclusion overlay is left to
 * consumers (see PLAN.md Step 28-7 sourcing note).
 *
 * Because the Moon moves monotonically forward in longitude over a 24-hour
 * Hindu day and the Panchaka boundaries are at the fixed points 300° and
 * 360°/0°, at most ONE boundary can be crossed within sunrise → nextSunrise.
 * The implementation samples the predicate at the endpoints, and bisects
 * for the crossing time only when the endpoints disagree.
 *
 * Boundary convention. Each returned slice is half-open `[start, end)` with
 * `start` being the first instant the Moon is OUTSIDE Panchaka and `end` the
 * first instant the Moon (re-)enters Panchaka. In the transition cases the
 * crossing time produced by bisection equals exactly one of the two
 * endpoints — the convention is therefore consistent regardless of whether
 * the transition is panchaka→free (slice begins at the crossing) or
 * free→panchaka (slice ends at the crossing).
 *
 * @param sunriseUtc       UTC sunrise — start of the Hindu day.
 * @param nextSunriseUtc   UTC of the following day's local sunrise — end of the Hindu day.
 * @param getMoon          Sidereal Moon longitude (degrees, [0, 360)) at a UTC instant.
 * @returns                Array of `UtcWindow` slices when Panchaka is INACTIVE
 *                         during the Hindu day. Empty when Panchaka pervades the
 *                         entire day; single-element when no transition or when
 *                         a transition partitions the day.
 */
export function computePanchakaRahita(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): UtcWindow[] {
  const inPanchakaAt = (d: Date) => getMoon(d) >= 300;

  const startInP = inPanchakaAt(sunriseUtc);
  const endInP = inPanchakaAt(nextSunriseUtc);

  if (startInP === endInP) {
    return startInP ? [] : [{ start: sunriseUtc, end: nextSunriseUtc }];
  }

  // Endpoints disagree → exactly one boundary crossing in the window. The Moon
  // moves forward, so entering Panchaka is the 300° crossing and leaving it is
  // the 360°/0° one.
  const targetDeg = startInP ? 0 : 300;
  const crossing = bisectBoundary(sunriseUtc, nextSunriseUtc, inPanchakaAt, targetDeg, getMoon);
  return startInP
    ? [{ start: crossing, end: nextSunriseUtc }] // exits Panchaka mid-day
    : [{ start: sunriseUtc, end: crossing }];    // enters Panchaka mid-day
}

/**
 * Locate the UTC moment where `predicate` flips between `loUtc` and `hiUtc`.
 * Caller guarantees `predicate(lo) !== predicate(hi)`.
 *
 * Bisection narrows the bracket; {@link solveAngleCrossing} finishes it. The
 * bisection used to be the whole answer at a 30-second tolerance, returning the
 * upper bracket — so every published Panchaka Rahita window sat on a 30 s grid
 * and moved in whole steps whenever anything upstream moved at all. Measured
 * during Phase 36.2: 21.1 s of movement from a 6.4 s nakshatra shift.
 */
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
