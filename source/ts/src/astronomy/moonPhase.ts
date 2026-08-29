import { searchMoonQuarter, nextMoonQuarter } from './lunation';
import { validateDate } from '../utils/validation';
import { resolveUtcOffset } from '../utils/timezone';

/** The four principal lunar phases: precise instants, not the ~24h tithi windows. */
export type MoonPhaseName = 'new' | 'first_quarter' | 'full' | 'last_quarter';

export interface MoonPhaseEvent {
  phase: MoonPhaseName;
  /** UTC instant; only the calendar date it lands on is local. */
  time: Date;
}

const QUARTER_TO_PHASE: readonly MoonPhaseName[] = [
  'new', 'first_quarter', 'full', 'last_quarter',
];

/** Every lunar-phase event whose instant falls within `[start, end]` inclusive, ascending. */
export function computeMoonPhasesInRange(start: Date, end: Date): MoonPhaseEvent[] {
  validateDate(start);
  validateDate(end);
  if (start.getTime() > end.getTime()) {
    throw new RangeError(
      `start (${start.toISOString()}) must be ≤ end (${end.toISOString()})`,
    );
  }

  const endMs = end.getTime();
  const out: MoonPhaseEvent[] = [];

  // `searchMoonQuarter` is strictly-after: unless we back up a month, a quarter landing exactly on `start` is skipped.
  let mq = searchMoonQuarter(new Date(start.getTime() - 31 * 24 * 3600_000));
  const maxSteps = Math.ceil((endMs - start.getTime()) / (24 * 3600_000) / 6) + 60;
  for (let step = 0; step < maxSteps; step++) {
    const t = mq.time;
    const ms = t.getTime();
    if (ms > endMs) break;
    if (ms >= start.getTime()) {
      out.push({ phase: QUARTER_TO_PHASE[mq.quarter]!, time: t });
    }
    mq = nextMoonQuarter(mq);
  }
  return out;
}

/** Every principal phase whose instant falls in local calendar year `year`. */
export function computeMoonPhasesForYear(
  year: number,
  options: { timezone: number | string },
): MoonPhaseEvent[] {
  const offset = resolveUtcOffset(options.timezone, new Date(Date.UTC(year, 6, 1)));
  const startUtc = new Date(Date.UTC(year, 0, 1) - offset * 60_000);
  const endUtc = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - offset * 60_000);
  return computeMoonPhasesInRange(startUtc, endUtc);
}

/** @deprecated Renamed to {@link computeMoonPhasesInRange} in v5. */
export const getMoonPhasesInRange = computeMoonPhasesInRange;
