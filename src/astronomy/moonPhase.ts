import { SearchMoonQuarter, NextMoonQuarter } from 'astronomy-engine';
import { validateDate } from '../utils/validation';

/**
 * The four principal lunar phases (quarters), in astronomical order:
 * - `new`           — Sun–Moon elongation 0° (Amavasya)
 * - `first_quarter` — elongation 90° (waxing half moon)
 * - `full`          — elongation 180° (Purnima)
 * - `last_quarter`  — elongation 270° (waning half moon)
 *
 * These are precise *instants*, not the ~24h tithi windows of the same name.
 */
export type MoonPhaseName = 'new' | 'first_quarter' | 'full' | 'last_quarter';

/** A single lunar-phase event at a precise instant (UTC). */
export interface MoonPhaseEvent {
  phase: MoonPhaseName;
  /** UTC instant of the phase. The instant is global; only the calendar date
   *  it falls on is timezone-dependent. */
  time: Date;
}

// astronomy-engine's MoonQuarter.quarter is 0=new, 1=first, 2=full, 3=last.
const QUARTER_TO_PHASE: readonly MoonPhaseName[] = [
  'new', 'first_quarter', 'full', 'last_quarter',
];

/**
 * Every lunar-phase event (new / first quarter / full / last quarter) whose
 * instant falls within `[start, end]`, sorted ascending. There are ~4 per
 * synodic month (~49 per year).
 *
 * Lunar phases are astronomical instants independent of location — the same
 * worldwide. "For India" (or any locale) is purely a matter of which calendar
 * date the instant lands on; see `buildMoonPhasesTable`.
 *
 * @param start Inclusive start date.
 * @param end   Inclusive end date.
 *
 * @example
 * ```typescript
 * const phases = getMoonPhasesInRange(
 *   new Date('2026-01-01'),
 *   new Date('2026-12-31'),
 * );
 * phases.forEach(p => console.log(p.phase, p.time.toISOString()));
 * ```
 */
export function getMoonPhasesInRange(start: Date, end: Date): MoonPhaseEvent[] {
  validateDate(start);
  validateDate(end);
  if (start.getTime() > end.getTime()) {
    throw new RangeError(
      `start (${start.toISOString()}) must be ≤ end (${end.toISOString()})`,
    );
  }

  const endMs = end.getTime();
  const out: MoonPhaseEvent[] = [];

  // SearchMoonQuarter finds the first quarter strictly after `start`; back up
  // one synodic month (~30 days) so a quarter landing exactly on/just after
  // `start` is not skipped, then drop anything before the window.
  let mq = SearchMoonQuarter(new Date(start.getTime() - 31 * 24 * 3600_000));
  // ~13 months back-up + the window; cap generously to bound the loop.
  const maxSteps = Math.ceil((endMs - start.getTime()) / (24 * 3600_000) / 6) + 60;
  for (let step = 0; step < maxSteps; step++) {
    const t = mq.time.date;
    const ms = t.getTime();
    if (ms > endMs) break;
    if (ms >= start.getTime()) {
      out.push({ phase: QUARTER_TO_PHASE[mq.quarter]!, time: t });
    }
    mq = NextMoonQuarter(mq);
  }
  return out;
}
