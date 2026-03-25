import type { ChoghadiyaInfo, ChoghadiyaSlot, ChoghadiyaQuality } from '../types/elements';

/**
 * Quality for each of the 7 Choghadiya names (index 0–6):
 * Udveg(0), Char(1), Labh(2), Amrit(3), Kaal(4), Shubh(5), Rog(6)
 */
const CHOGHADIYA_QUALITY: readonly ChoghadiyaQuality[] = [
  'inauspicious', // 0 Udveg  (Sun)
  'neutral',      // 1 Char   (Venus)
  'auspicious',   // 2 Labh   (Mercury)
  'auspicious',   // 3 Amrit  (Moon) — most auspicious
  'inauspicious', // 4 Kaal   (Saturn)
  'auspicious',   // 5 Shubh  (Jupiter)
  'inauspicious', // 6 Rog    (Mars)
];

/**
 * First daytime Choghadiya index by weekday (Sun=0 … Sat=6).
 * The sequence then advances +1 (mod 7) for each subsequent slot.
 */
const DAY_START_INDEX = [0, 3, 6, 2, 5, 1, 4] as const;

/**
 * First nighttime Choghadiya index by weekday (Sun=0 … Sat=6).
 */
const NIGHT_START_INDEX = [5, 1, 4, 6, 0, 3, 2] as const;

function buildSlots(
  reference: Date,
  durationMs: number,
  startIndex: number,
  nameFn: (index: number) => string,
  count: number,
): ChoghadiyaSlot[] {
  const slotMs = durationMs / count;
  const slots: ChoghadiyaSlot[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (startIndex + i) % 7;
    slots.push({
      start: new Date(reference.getTime() + i * slotMs),
      end: new Date(reference.getTime() + (i + 1) * slotMs),
      index: idx,
      name: nameFn(idx),
      quality: CHOGHADIYA_QUALITY[idx]!,
    });
  }
  return slots;
}

/**
 * Compute the 16 Choghadiya slots for a day (8 daytime + 8 nighttime).
 *
 * Each half is divided into 8 equal periods named from a 7-name cycle
 * (Udveg → Char → Labh → Amrit → Kaal → Shubh → Rog, then repeating).
 * The starting name depends on the weekday (vara).
 *
 * @param sunrise    UTC sunrise Date.
 * @param sunset     UTC sunset Date.
 * @param nextSunrise  UTC next-day sunrise Date.
 * @param varaIndex  Weekday index: 0 = Sunday, 6 = Saturday.
 * @param nameFn     Callback returning translated Choghadiya name for index 0–6.
 */
export function computeChoghadiya(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  varaIndex: number,
  nameFn: (index: number) => string,
): ChoghadiyaInfo {
  const dayMs   = sunset.getTime()      - sunrise.getTime();
  const nightMs = nextSunrise.getTime() - sunset.getTime();

  return {
    day:   buildSlots(sunrise, dayMs,   DAY_START_INDEX[varaIndex]!,   nameFn, 8),
    night: buildSlots(sunset,  nightMs, NIGHT_START_INDEX[varaIndex]!, nameFn, 8),
  };
}
