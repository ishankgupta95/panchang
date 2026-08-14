import type { GowriSlot, ChoghadiyaQuality, Unlocalized, UnlocalizedInfo } from '../types/elements';
import { buildEqualSlots } from '../utils/slots';

/**
 * Quality for each of the 8 Gowri Panchangam slot names (index 0–7):
 * Udyog(0), Amrit(1), Roga(2), Laabh(3), Shubh(4), Kaal(5), Dhan(6), Chal(7)
 *
 * The split follows DrikPanchang's published Pambu-Panchangam labels — five
 * auspicious (Uthi/Udyog "Good", Amirdha "Best", Laabam "Gain", Sugam "Good",
 * Dhanam "Wealth") and three inauspicious (Rogam "Evil", Visham/Kaal "Bad",
 * Soram/Chal "Bad" — Soram is theft). There are **no neutral** Gowri slots;
 * an earlier table classed Udyog and Chal neutral, which matches some
 * North-Indian Gowri variants but not the Tamil table this module models.
 */
const GOWRI_QUALITY: readonly ChoghadiyaQuality[] = [
  'auspicious',   // 0 Udyog  (Uthi — Good)
  'auspicious',   // 1 Amrit  (Amirdha — Best)
  'inauspicious', // 2 Roga   (Rogam — Evil)
  'auspicious',   // 3 Laabh  (Laabam — Gain)
  'auspicious',   // 4 Shubh  (Sugam — Good)
  'inauspicious', // 5 Kaal   (Visham — Bad)
  'auspicious',   // 6 Dhan   (Dhanam — Wealth)
  'inauspicious', // 7 Chal   (Soram — Bad)
];

/**
 * The classical Gowri Panchangam is a **verbatim grid** — 7 weekday columns of
 * 8 slots for the day half and another 7×8 for the night half — not a cycle
 * that rotates per weekday. The distinction is observable: the columns are not
 * even permutations (Saturday night carries Chal/Soram twice and no Roga), so
 * no rotation model can express them. An earlier implementation rotated a
 * single 8-name cycle and matched DrikPanchang on almost nothing.
 *
 * Both grids below were transcribed from DrikPanchang's Gowri Panchangam pages
 * (Pambu Panchangam table; Chennai, 2026-08-13 … 19 with Tuesday re-confirmed
 * on 2026-08-25), mapping drik's Tamil names to this module's indices:
 * Uthi→Udyog(0), Amirdha→Amrit(1), Rogam→Roga(2), Laabam→Laabh(3),
 * Sugam→Shubh(4), Visham→Kaal(5), Dhanam→Dhan(6), Soram→Chal(7).
 *
 * Rows are Sun=0 … Sat=6.
 */
const DAY_GRID: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 6, 4, 7, 5], // Sun: Udyog Amrit Roga Laabh Dhan Shubh Chal Kaal
  [1, 5, 2, 3, 6, 4, 7, 0], // Mon: Amrit Kaal Roga Laabh Dhan Shubh Chal Udyog
  [2, 3, 6, 4, 7, 0, 5, 1], // Tue: Roga Laabh Dhan Shubh Chal Udyog Kaal Amrit
  [3, 6, 4, 7, 5, 0, 1, 2], // Wed: Laabh Dhan Shubh Chal Kaal Udyog Amrit Roga
  [6, 4, 7, 0, 1, 5, 2, 3], // Thu: Dhan Shubh Chal Udyog Amrit Kaal Roga Laabh
  [4, 7, 0, 5, 1, 2, 3, 6], // Fri: Shubh Chal Udyog Kaal Amrit Roga Laabh Dhan
  [7, 0, 5, 1, 2, 3, 6, 4], // Sat: Chal Udyog Kaal Amrit Roga Laabh Dhan Shubh
];

const NIGHT_GRID: readonly (readonly number[])[] = [
  [6, 4, 7, 5, 0, 1, 2, 3], // Sun: Dhan Shubh Chal Kaal Udyog Amrit Roga Laabh
  [4, 7, 0, 1, 5, 2, 3, 6], // Mon: Shubh Chal Udyog Amrit Kaal Roga Laabh Dhan
  [7, 0, 5, 1, 2, 3, 6, 4], // Tue: Chal Udyog Kaal Amrit Roga Laabh Dhan Shubh
  [0, 1, 2, 3, 6, 4, 7, 5], // Wed: Udyog Amrit Roga Laabh Dhan Shubh Chal Kaal
  [1, 5, 2, 3, 6, 4, 7, 0], // Thu: Amrit Kaal Roga Laabh Dhan Shubh Chal Udyog
  [2, 3, 6, 4, 7, 0, 5, 1], // Fri: Roga Laabh Dhan Shubh Chal Udyog Kaal Amrit
  [3, 6, 4, 7, 0, 5, 1, 7], // Sat: Laabh Dhan Shubh Chal Udyog Kaal Amrit Chal — Chal twice, no Roga; verbatim from the source
];

function buildSlots(
  reference: Date,
  durationMs: number,
  grid: readonly number[],
  nameFn: (index: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
): Unlocalized<GowriSlot>[] {
  return buildEqualSlots(reference, durationMs, 8, (i, start, end) => {
    const idx = grid[i]!;
    const quality = GOWRI_QUALITY[idx]!;
    return { start, end, index: idx, name: nameFn(idx), quality, qualityName: qualityNameFn(quality) };
  });
}

/**
 * Compute the 16 Gowri Panchangam (Gowri Nalla Neram) slots for a day
 * (8 daytime + 8 nighttime).
 *
 * Each half is divided into 8 equal periods, named from the weekday's column
 * of the classical Pambu-Panchangam grid (see {@link DAY_GRID}).
 *
 * @param sunrise    UTC sunrise Date.
 * @param sunset     UTC sunset Date.
 * @param nextSunrise  UTC next-day sunrise Date.
 * @param varaIndex  Weekday index: 0 = Sunday, 6 = Saturday.
 * @param nameFn     Callback returning translated Gowri slot name for index 0–7.
 * @param qualityNameFn  Callback returning translated quality name.
 * @returns          `GowriInfo` — `{ day: Unlocalized<GowriSlot>[8], night: Unlocalized<GowriSlot>[8] }`
 *                   with start/end times and quality for each slot.
 *
 * @example
 * ```typescript
 * import { computeGowriPanchangam } from 'panchang-ts';
 * const gowri = computeGowriPanchangam(
 *   sunrise, sunset, nextSunrise, 2, // Tuesday
 *   (i) => ['Udyog','Amrit','Roga','Laabh','Shubh','Kaal','Dhan','Chal'][i]!,
 *   (q) => q,
 * );
 * gowri.day[0].name;     // "Roga"
 * gowri.day[0].quality;  // "inauspicious"
 * ```
 */
export function computeGowriPanchangam(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  varaIndex: number,
  nameFn: (index: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
): UnlocalizedInfo<GowriSlot> {
  const dayMs   = sunset.getTime()      - sunrise.getTime();
  const nightMs = nextSunrise.getTime() - sunset.getTime();

  return {
    day:   buildSlots(sunrise, dayMs,   DAY_GRID[varaIndex]!,   nameFn, qualityNameFn),
    night: buildSlots(sunset,  nightMs, NIGHT_GRID[varaIndex]!, nameFn, qualityNameFn),
  };
}
