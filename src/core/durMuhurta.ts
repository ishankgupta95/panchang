import type { DurMuhurtaPeriod, Unlocalized } from '../types/elements';

/** A Dur Muhurta window as the core module emits it (no local strings yet). */
export type DurMuhurtaWindow = Unlocalized<DurMuhurtaPeriod>;

/**
 * Dur Muhurta (inauspicious muhurta) ordinals per Vara.
 *
 * Classical Muhurta-Chintamani table, as printed by DrikPanchang — verified
 * against 58 consecutive drik day-pages across Jaipur and Kolkata with zero
 * exceptions (2026-08-14 audit). Ordinals are 0-based: a `day` ordinal counts
 * within the 15 equal muhurtas from sunrise to sunset, a `night` ordinal
 * within the 15 equal muhurtas from sunset to the next sunrise.
 *
 * Most weekdays carry one or two day windows; Tuesday alone adds a night
 * window (its 7th night muhurta), and Sunday and Wednesday carry a single
 * window only.
 */
const DUR_MUHURTA_ORDINALS: readonly (readonly {
  readonly ordinal: number;
  readonly segment: 'day' | 'night';
}[])[] = [
  [{ ordinal: 13, segment: 'day' }],                                        // Sunday
  [{ ordinal: 8, segment: 'day' }, { ordinal: 11, segment: 'day' }],        // Monday
  [{ ordinal: 3, segment: 'day' }, { ordinal: 6, segment: 'night' }],       // Tuesday
  [{ ordinal: 7, segment: 'day' }],                                         // Wednesday
  [{ ordinal: 5, segment: 'day' }, { ordinal: 11, segment: 'day' }],        // Thursday
  [{ ordinal: 3, segment: 'day' }, { ordinal: 8, segment: 'day' }],         // Friday
  [{ ordinal: 0, segment: 'day' }, { ordinal: 1, segment: 'day' }],         // Saturday
];

/**
 * Compute the Dur Muhurta (inauspicious) windows for a given day.
 *
 * Divides the daytime (sunrise→sunset) and the nighttime (sunset→nextSunrise)
 * into 15 equal muhurtas each and returns the windows the Vara marks as
 * inauspicious — one or two per weekday, where Tuesday's second window falls
 * at night.
 *
 * @param sunrise     UTC sunrise Date.
 * @param sunset      UTC sunset Date.
 * @param nextSunrise UTC next-day sunrise Date (anchors night ordinals).
 * @param varaIndex   0 = Sunday … 6 = Saturday.
 * @returns           1–2 windows in start order, each tagged `day` or `night`.
 */
export function computeDurMuhurta(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  varaIndex: number,
): DurMuhurtaWindow[] {
  const dayMuhurtaMs = (sunset.getTime() - sunrise.getTime()) / 15;
  const nightMuhurtaMs = (nextSunrise.getTime() - sunset.getTime()) / 15;

  return DUR_MUHURTA_ORDINALS[varaIndex]!.map(({ ordinal, segment }) => {
    const baseMs = segment === 'day' ? sunrise.getTime() : sunset.getTime();
    const muhurtaMs = segment === 'day' ? dayMuhurtaMs : nightMuhurtaMs;
    return {
      start: new Date(baseMs + ordinal * muhurtaMs),
      end: new Date(baseMs + (ordinal + 1) * muhurtaMs),
      segment,
    };
  });
}
