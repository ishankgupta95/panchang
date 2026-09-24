import type { GowriSlot, ChoghadiyaQuality, Unlocalized, UnlocalizedInfo } from '../types/elements';
import { PanchangError } from '../types/errors';
import { buildEqualSlots } from '../utils/slots';
import { validateDate } from '../utils/validation';

/** Per the Pambu-Panchangam labels; this Tamil table has no neutral slots, unlike North-Indian variants. */
const GOWRI_QUALITY: readonly ChoghadiyaQuality[] = [
  'auspicious',   // 0 Udyog  (Uthi: Good)
  'auspicious',   // 1 Amrit  (Amirdha: Best)
  'inauspicious', // 2 Roga   (Rogam: Evil)
  'auspicious',   // 3 Laabh  (Laabam: Gain)
  'auspicious',   // 4 Shubh  (Sugam: Good)
  'inauspicious', // 5 Kaal   (Visham: Bad)
  'auspicious',   // 6 Dhan   (Dhanam: Wealth)
  'inauspicious', // 7 Chal   (Soram: Bad)
];

/** Verbatim from the Pambu Panchangam table (rows Sun=0 … Sat=6), NOT a rotating cycle: the columns are not even permutations. */
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
  [3, 6, 4, 7, 0, 5, 1, 7], // Sat: Laabh Dhan Shubh Chal Udyog Kaal Amrit Chal (Chal twice, no Roga); verbatim from the source
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

/** The 16 Gowri Panchangam (Gowri Nalla Neram) slots for a day, 8 per half; `varaIndex` 0 = Sunday … 6 = Saturday (any other value throws `INVALID_INPUT`, an Invalid Date `INVALID_DATE`), `nameFn` names slot index 0-7. */
export function computeGowriPanchangam(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  varaIndex: number,
  nameFn: (index: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
): UnlocalizedInfo<GowriSlot> {
  validateDate(sunrise, 'any');
  validateDate(sunset, 'any');
  validateDate(nextSunrise, 'any');
  if (!Number.isInteger(varaIndex) || varaIndex < 0 || varaIndex > 6) {
    throw new PanchangError(`varaIndex must be integer in [0, 6], got ${varaIndex}`, 'INVALID_INPUT');
  }
  const dayMs   = sunset.getTime()      - sunrise.getTime();
  const nightMs = nextSunrise.getTime() - sunset.getTime();

  return {
    day:   buildSlots(sunrise, dayMs,   DAY_GRID[varaIndex]!,   nameFn, qualityNameFn),
    night: buildSlots(sunset,  nightMs, NIGHT_GRID[varaIndex]!, nameFn, qualityNameFn),
  };
}
