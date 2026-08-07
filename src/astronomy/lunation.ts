/**
 * Moon–Sun elongation and the phase search built on it — Phase 36.3's
 * replacement for `MoonPhase`, `SearchMoonPhase`, `SearchMoonQuarter` and
 * `NextMoonQuarter`.
 *
 * ## The quantity
 *
 * Elongation is the Moon's apparent ecliptic longitude minus the Sun's, in
 * [0, 360). Everything lunar in this library is a threshold on it: a tithi is
 * 12° of it, a new moon is 0°, a quarter is a multiple of 90°. It is also the
 * one quantity where the **ayanamsa cancels exactly** — both longitudes carry
 * it once and it subtracts out — which is why this module reads the tropical
 * longitudes rather than the sidereal ones. Any other choice would make the
 * phase instants depend on a Tier 1 rule choice, which they must not.
 *
 * ## The search
 *
 * Elongation increases at a very steady 12.19°/day: the rate varies by about
 * ±13% over an anomalistic month and never reverses. That makes the mean rate a
 * good enough first derivative to seed a secant iteration, and it makes the
 * root unique inside a synodic month, so there is no bracketing problem to
 * solve — the only thing to get right is landing on the *intended* lunation,
 * which the seed does directly.
 *
 * Convergence is to a millisecond. That is far tighter than anything published
 * (the coarsest consumer prints to the minute) and far tighter than the
 * ephemeris underneath it, which is worth a few seconds. It costs two or three
 * extra iterations and removes the question of whether a reported instant is
 * limited by the search or by the physics — it is always the physics.
 */
import { getTropicalMoonLongitude } from './moon';
import { getTropicalSunLongitude } from './sun';

const DAY_MS = 86_400_000;

/** Mean synodic month, days — new moon to new moon. */
export const SYNODIC_MONTH_DAYS = 29.530588853;
/** Mean rate of increase of elongation, degrees per day. */
const ELONGATION_RATE_DEG_PER_DAY = 360 / SYNODIC_MONTH_DAYS;

/** Convergence tolerance for the phase search, milliseconds. */
const PHASE_TOLERANCE_MS = 1;

/**
 * How far apart two results of this search may be and still be the same event.
 *
 * The iteration stops when a step falls under {@link PHASE_TOLERANCE_MS} and the
 * root is then rounded to a whole millisecond, so the same syzygy reached from
 * two different seeds can be reported one or two milliseconds apart. That is not
 * a disagreement about physics — the elongation at either instant is ~10⁻⁸
 * degrees, and the ephemeris underneath places a new moon to a few seconds — it
 * is the last bit of a rounding.
 *
 * Callers that have to decide whether an instant is *at* an event or just before
 * it need a number for that, rather than an exact comparison that a
 * one-millisecond rounding can flip. See `newMoon.ts`, where an exact `<=` put
 * an instant sitting exactly on a new moon into the previous lunation.
 */
export const PHASE_AGREEMENT_MS = 2 * PHASE_TOLERANCE_MS;

/**
 * Moon–Sun elongation at a UTC instant, degrees in [0, 360).
 *
 * 0° is new moon, 90° first quarter, 180° full, 270° last quarter.
 */
export function moonSunElongation(date: Date): number {
  const d = getTropicalMoonLongitude(date) - getTropicalSunLongitude(date);
  return ((d % 360) + 360) % 360;
}

/** Signed difference a − b, degrees, in (−180, +180]. */
function signedDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * The first instant at or after `startUtc` when elongation equals
 * `targetDegrees`, or `null` if that does not happen within `limitDays`.
 *
 * The seed is the mean-rate estimate of how far away the target is; the secant
 * iteration then converges quadratically-ish because the function is close to
 * linear. A step cap keeps a bad derivative estimate from throwing the iterate
 * into the next lunation, which is the only failure mode this search has.
 */
export function searchMoonPhase(
  targetDegrees: number, startUtc: Date, limitDays: number,
): Date | null {
  const startMs = startUtc.getTime();
  const limitMs = startMs + limitDays * DAY_MS;

  // How far ahead the target is, from the mean rate. `signedDelta` lands in
  // (−180, 180], so a target already just behind us resolves to nearly a full
  // cycle ahead rather than to a negative time — which is what "the first
  // instant at or after" means.
  let deficit = signedDelta(targetDegrees, moonSunElongation(startUtc));
  if (deficit < 0) deficit += 360;
  let t = startMs + (deficit / ELONGATION_RATE_DEG_PER_DAY) * DAY_MS;

  let previousT = t - 0.25 * DAY_MS;
  let previousF = signedDelta(moonSunElongation(new Date(previousT)), targetDegrees);

  for (let i = 0; i < 40; i++) {
    const f = signedDelta(moonSunElongation(new Date(t)), targetDegrees);
    if (Math.abs(f) < 1e-9) break;
    const slope = (f - previousF) / (t - previousT);
    // A degenerate slope means the two probes landed on the same value; fall
    // back to the mean rate rather than dividing by ~0.
    const step = slope === 0 || !Number.isFinite(slope)
      ? -f / (ELONGATION_RATE_DEG_PER_DAY / DAY_MS)
      : -f / slope;
    const capped = Math.max(-2 * DAY_MS, Math.min(2 * DAY_MS, step));
    previousT = t;
    previousF = f;
    t += capped;
    if (Math.abs(capped) < PHASE_TOLERANCE_MS) break;
  }

  if (t < startMs - PHASE_TOLERANCE_MS || t > limitMs) return null;
  return new Date(Math.max(startMs, Math.round(t)));
}

/** Quarter index: 0 = new, 1 = first, 2 = full, 3 = last. */
export type QuarterIndex = 0 | 1 | 2 | 3;

export interface MoonQuarter {
  quarter: QuarterIndex;
  time: Date;
}

/**
 * The next quarter phase strictly after `startUtc`.
 *
 * Which quarter comes next follows from which 90° sector the Moon is in now, so
 * no search is needed to identify it — only to time it.
 */
export function searchMoonQuarter(startUtc: Date): MoonQuarter {
  const elongation = moonSunElongation(startUtc);
  const quarter = (((Math.floor(elongation / 90) + 1) % 4) + 4) % 4 as QuarterIndex;
  const time = searchMoonPhase(quarter * 90, startUtc, 12);
  if (time === null) {
    throw new Error(`no lunar quarter found within 12 days of ${startUtc.toISOString()}`);
  }
  return { quarter, time };
}

/**
 * The quarter after a given one.
 *
 * Starts the search six days on rather than from the previous quarter itself.
 * Quarters are ~7.38 days apart and never closer than ~6.5, so this cannot skip
 * one, and it keeps the seed from resolving back onto the quarter just found —
 * the one way an "advance to the next" helper can silently loop forever.
 */
export function nextMoonQuarter(previous: MoonQuarter): MoonQuarter {
  return searchMoonQuarter(new Date(previous.time.getTime() + 6 * DAY_MS));
}
