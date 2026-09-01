/** Tropical longitudes, not sidereal: the ayanamsa cancels in the difference. */
import { getTropicalMoonLongitude } from './moon';
import { getTropicalSunLongitude } from './sun';

const DAY_MS = 86_400_000;

export const SYNODIC_MONTH_DAYS = 29.530588853;
const ELONGATION_RATE_DEG_PER_DAY = 360 / SYNODIC_MONTH_DAYS;

const PHASE_TOLERANCE_MS = 1;

/** The same syzygy reached from two seeds can round a millisecond or two apart, so an
 * exact "is this instant at an event" test puts a new moon in the previous lunation. */
export const PHASE_AGREEMENT_MS = 2 * PHASE_TOLERANCE_MS;

export function moonSunElongation(date: Date): number {
  const d = getTropicalMoonLongitude(date) - getTropicalSunLongitude(date);
  return ((d % 360) + 360) % 360;
}

function signedDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** The step cap keeps a bad derivative estimate from throwing the secant iterate into the next lunation. */
export function searchMoonPhase(
  targetDegrees: number, startUtc: Date, limitDays: number,
): Date | null {
  const startMs = startUtc.getTime();
  const limitMs = startMs + limitDays * DAY_MS;

  let deficit = signedDelta(targetDegrees, moonSunElongation(startUtc));
  if (deficit < 0) deficit += 360;
  let t = startMs + (deficit / ELONGATION_RATE_DEG_PER_DAY) * DAY_MS;

  let previousT = t - 0.25 * DAY_MS;
  let previousF = signedDelta(moonSunElongation(new Date(previousT)), targetDegrees);

  for (let i = 0; i < 40; i++) {
    const f = signedDelta(moonSunElongation(new Date(t)), targetDegrees);
    if (Math.abs(f) < 1e-9) break;
    const slope = (f - previousF) / (t - previousT);
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

/** 0 = new, 1 = first quarter, 2 = full, 3 = last quarter. */
export type QuarterIndex = 0 | 1 | 2 | 3;

export interface MoonQuarter {
  quarter: QuarterIndex;
  time: Date;
}

export function searchMoonQuarter(startUtc: Date): MoonQuarter {
  const elongation = moonSunElongation(startUtc);
  const quarter = (((Math.floor(elongation / 90) + 1) % 4) + 4) % 4 as QuarterIndex;
  const time = searchMoonPhase(quarter * 90, startUtc, 12);
  if (time === null) {
    throw new Error(`no lunar quarter found within 12 days of ${startUtc.toISOString()}`);
  }
  return { quarter, time };
}

/** Quarters are never closer than ~6.5 days, so the six-day seed skips none. */
export function nextMoonQuarter(previous: MoonQuarter): MoonQuarter {
  return searchMoonQuarter(new Date(previous.time.getTime() + 6 * DAY_MS));
}
