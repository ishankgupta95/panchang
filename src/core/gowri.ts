import type { GowriInfo, GowriSlot, ChoghadiyaQuality } from '../types/elements';

/**
 * Quality for each of the 8 Gowri Panchangam slot names (index 0–7):
 * Udyog(0), Amrit(1), Roga(2), Laabh(3), Shubh(4), Kaal(5), Dhan(6), Chal(7)
 */
const GOWRI_QUALITY: readonly ChoghadiyaQuality[] = [
  'neutral',      // 0 Udyog
  'auspicious',   // 1 Amrit
  'inauspicious', // 2 Roga
  'auspicious',   // 3 Laabh
  'auspicious',   // 4 Shubh
  'inauspicious', // 5 Kaal
  'auspicious',   // 6 Dhan
  'neutral',      // 7 Chal
];

/**
 * First daytime Gowri slot index by weekday (Sun=0 … Sat=6).
 * The sequence then advances +1 (mod 8) for each subsequent slot.
 */
const DAY_START_INDEX = [6, 5, 4, 3, 2, 1, 0] as const;

/**
 * First nighttime Gowri slot index by weekday (Sun=0 … Sat=6).
 */
const NIGHT_START_INDEX = [2, 1, 0, 7, 6, 5, 4] as const;

function buildSlots(
  reference: Date,
  durationMs: number,
  startIndex: number,
  nameFn: (index: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
): GowriSlot[] {
  const slotMs = durationMs / 8;
  const slots: GowriSlot[] = [];
  for (let i = 0; i < 8; i++) {
    const idx = (startIndex + i) % 8;
    const quality = GOWRI_QUALITY[idx]!;
    slots.push({
      start: new Date(reference.getTime() + i * slotMs),
      end: new Date(reference.getTime() + (i + 1) * slotMs),
      index: idx,
      name: nameFn(idx),
      quality,
      qualityName: qualityNameFn(quality),
    });
  }
  return slots;
}

/**
 * Compute the 16 Gowri Panchangam (Gowri Nalla Neram) slots for a day
 * (8 daytime + 8 nighttime).
 *
 * Each half is divided into 8 equal periods named from an 8-name cycle
 * (Udyog → Amrit → Roga → Laabh → Shubh → Kaal → Dhan → Chal).
 * The starting name depends on the weekday (vara).
 *
 * @param sunrise    UTC sunrise Date.
 * @param sunset     UTC sunset Date.
 * @param nextSunrise  UTC next-day sunrise Date.
 * @param varaIndex  Weekday index: 0 = Sunday, 6 = Saturday.
 * @param nameFn     Callback returning translated Gowri slot name for index 0–7.
 * @param qualityNameFn  Callback returning translated quality name.
 * @returns          `GowriInfo` — `{ day: GowriSlot[8], night: GowriSlot[8] }`
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
 * gowri.day[0].name;     // e.g. "Roga"
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
): GowriInfo {
  const dayMs   = sunset.getTime()      - sunrise.getTime();
  const nightMs = nextSunrise.getTime() - sunset.getTime();

  return {
    day:   buildSlots(sunrise, dayMs,   DAY_START_INDEX[varaIndex]!,   nameFn, qualityNameFn),
    night: buildSlots(sunset,  nightMs, NIGHT_START_INDEX[varaIndex]!, nameFn, qualityNameFn),
  };
}
