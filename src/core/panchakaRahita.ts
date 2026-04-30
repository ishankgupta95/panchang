import type { TimePeriod } from '../types/elements';

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
 * @returns                Array of `TimePeriod` slices when Panchaka is INACTIVE
 *                         during the Hindu day. Empty when Panchaka pervades the
 *                         entire day; single-element when no transition or when
 *                         a transition partitions the day.
 */
export function computePanchakaRahita(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): TimePeriod[] {
  const inPanchakaAt = (d: Date) => getMoon(d) >= 300;

  const startInP = inPanchakaAt(sunriseUtc);
  const endInP = inPanchakaAt(nextSunriseUtc);

  if (startInP === endInP) {
    return startInP ? [] : [{ start: sunriseUtc, end: nextSunriseUtc }];
  }

  // Endpoints disagree → exactly one boundary crossing in the window.
  const crossing = bisectBoundary(sunriseUtc, nextSunriseUtc, inPanchakaAt);
  return startInP
    ? [{ start: crossing, end: nextSunriseUtc }] // exits Panchaka mid-day
    : [{ start: sunriseUtc, end: crossing }];    // enters Panchaka mid-day
}

/**
 * Locate the UTC moment where `predicate` flips between `loUtc` and `hiUtc`.
 * Caller guarantees `predicate(lo) !== predicate(hi)`.
 *
 * Tolerance ~30 s — finer than the ~1 min granularity DrikPanchang publishes.
 */
function bisectBoundary(
  loUtc: Date,
  hiUtc: Date,
  predicate: (d: Date) => boolean,
): Date {
  const TOL_MS = 30_000;
  const MAX_ITERS = 30;
  const startState = predicate(loUtc);
  let lo = loUtc.getTime();
  let hi = hiUtc.getTime();

  for (let i = 0; i < MAX_ITERS && hi - lo > TOL_MS; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (predicate(new Date(mid)) === startState) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}
