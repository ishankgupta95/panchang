import type { TimePeriod } from '../types/elements';

/**
 * Dur Muhurta (inauspicious muhurta) positions per Vara.
 *
 * Each entry is a pair of 0-based muhurta indices within the 15 daytime
 * muhurtas (sunrise to sunset divided into 15 equal parts, each ~48 min).
 *
 * Source: traditional Muhurta Chintamani / Drik Panchang tables.
 */
const DUR_MUHURTA_INDICES: readonly (readonly [number, number])[] = [
  [7, 13],  // Sunday
  [3, 10],  // Monday
  [5, 14],  // Tuesday
  [2, 11],  // Wednesday
  [6, 12],  // Thursday
  [4, 9],   // Friday
  [1, 8],   // Saturday
];

/**
 * Compute the two Dur Muhurta (inauspicious) windows for a given day.
 *
 * Divides the daytime (sunrise→sunset) into 15 equal muhurtas (~48 min each)
 * and returns the two inauspicious windows based on the Vara.
 *
 * @param sunrise   UTC sunrise Date.
 * @param sunset    UTC sunset Date.
 * @param varaIndex 0 = Sunday … 6 = Saturday.
 * @returns         Exactly two TimePeriod entries.
 */
export function computeDurMuhurta(
  sunrise: Date,
  sunset: Date,
  varaIndex: number,
): [TimePeriod, TimePeriod] {
  const dayMs = sunset.getTime() - sunrise.getTime();
  const muhurtaMs = dayMs / 15;
  const sunriseMs = sunrise.getTime();

  const [idx1, idx2] = DUR_MUHURTA_INDICES[varaIndex]!;

  return [
    {
      start: new Date(sunriseMs + idx1 * muhurtaMs),
      end: new Date(sunriseMs + (idx1 + 1) * muhurtaMs),
    },
    {
      start: new Date(sunriseMs + idx2 * muhurtaMs),
      end: new Date(sunriseMs + (idx2 + 1) * muhurtaMs),
    },
  ];
}
