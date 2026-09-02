import { buildEqualSlots, VARA_CHALDEAN_START } from '../utils/slots';
import type { ChoghadiyaSlot, ChoghadiyaQuality, Unlocalized, UnlocalizedInfo } from '../types/elements';

const CHOGHADIYA_QUALITY: readonly ChoghadiyaQuality[] = [
  'inauspicious', // 0 Udveg  (Sun)
  'neutral',      // 1 Char   (Venus)
  'auspicious',   // 2 Labh   (Mercury)
  'auspicious',   // 3 Amrit  (Moon), most auspicious
  'inauspicious', // 4 Kaal   (Saturn)
  'auspicious',   // 5 Shubh  (Jupiter)
  'inauspicious', // 6 Rog    (Mars)
];

const DAY_START_INDEX = VARA_CHALDEAN_START;

/** Night runs its own succession, not the day cycle restarted at another name. */
const NIGHT_SEQUENCE = [0, 5, 3, 1, 6, 4, 2] as const;

/** Position in {@link NIGHT_SEQUENCE} of each weekday's first night slot. */
const NIGHT_START_POS = [1, 3, 5, 0, 2, 4, 6] as const;

function buildSlots(
  reference: Date,
  durationMs: number,
  indexFor: (i: number) => number,
  nameFn: (index: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
  count: number,
): Unlocalized<ChoghadiyaSlot>[] {
  return buildEqualSlots(reference, durationMs, count, (i, start, end) => {
    const idx = indexFor(i);
    const quality = CHOGHADIYA_QUALITY[idx]!;
    return { start, end, index: idx, name: nameFn(idx), quality, qualityName: qualityNameFn(quality) };
  });
}

export function computeChoghadiya(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  varaIndex: number,
  nameFn: (index: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
): UnlocalizedInfo<ChoghadiyaSlot> {
  const dayMs   = sunset.getTime()      - sunrise.getTime();
  const nightMs = nextSunrise.getTime() - sunset.getTime();

  const dayStart = DAY_START_INDEX[varaIndex]!;
  const nightPos = NIGHT_START_POS[varaIndex]!;

  return {
    day:   buildSlots(sunrise, dayMs,   (i) => (dayStart + i) % 7,                    nameFn, qualityNameFn, 8),
    night: buildSlots(sunset,  nightMs, (i) => NIGHT_SEQUENCE[(nightPos + i) % 7]!,   nameFn, qualityNameFn, 8),
  };
}
