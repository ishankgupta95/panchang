import { searchMoonQuarter, nextMoonQuarter } from './lunation';
import { validateDate, validateLocalYearWindow } from '../utils/validation';
import { localYearWindow, clampToSupported } from '../utils/timezone';

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

/** Every principal phase whose instant falls in local calendar year `year`, each boundary at its own offset. */
export function computeMoonPhasesForYear(
  year: number,
  options: { timezone: number | string },
): MoonPhaseEvent[] {
  const [start, end] = localYearWindow(year, options.timezone);
  validateLocalYearWindow(year, start, end);
  return computeMoonPhasesInRange(new Date(clampToSupported(start)), new Date(clampToSupported(end)));
}

/** @deprecated Renamed to {@link computeMoonPhasesInRange} in v5. */
export const getMoonPhasesInRange = computeMoonPhasesInRange;
