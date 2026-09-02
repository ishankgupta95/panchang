import type { DoGhatiSlot, ChoghadiyaQuality, Unlocalized, UnlocalizedInfo } from '../types/elements';
import { buildEqualSlots } from '../utils/slots';

/** Each muhurta has a fixed presiding deity, so the sequence does NOT rotate by weekday. */
const DO_GHATI_QUALITY: readonly ChoghadiyaQuality[] = [
  'inauspicious', //  0 Rudra
  'inauspicious', //  1 Uraga
  'auspicious',   //  2 Mitra
  'inauspicious', //  3 Pitara
  'auspicious',   //  4 Vasu
  'auspicious',   //  5 Ambu
  'auspicious',   //  6 Vishwedeva
  'auspicious',   //  7 Vidhi
  'auspicious',   //  8 Brahma
  'auspicious',   //  9 Indra
  'inauspicious', // 10 Indragni
  'inauspicious', // 11 Daitya
  'auspicious',   // 12 Varuna
  'auspicious',   // 13 Aryama
  'inauspicious', // 14 Bhaga
  'inauspicious', // 15 Ishwara
  'inauspicious', // 16 Ajaikapada
  'auspicious',   // 17 Ahirbudhnya
  'auspicious',   // 18 Pusha
  'auspicious',   // 19 Ashwini
  'inauspicious', // 20 Yama
  'inauspicious', // 21 Agni
  'auspicious',   // 22 Brahma
  'auspicious',   // 23 Chandra
  'auspicious',   // 24 Aditi
  'auspicious',   // 25 Brihaspati
  'auspicious',   // 26 Vishnu
  'auspicious',   // 27 Surya
  'auspicious',   // 28 Tvashta
  'auspicious',   // 29 Samirana
];

function buildSlots(
  reference: Date,
  durationMs: number,
  indexBase: 0 | 15,
  nameFn: (index: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
): Unlocalized<DoGhatiSlot>[] {
  return buildEqualSlots(reference, durationMs, 15, (i, start, end) => {
    const idx = indexBase + i;
    const quality = DO_GHATI_QUALITY[idx]!;
    return { start, end, index: idx, name: nameFn(idx), quality, qualityName: qualityNameFn(quality) };
  });
}

/**
 * The 30 Do Ghati Muhurta slots for a Hindu day, day and night each split into 15 equal slots.
 *
 * @param nameFn Translated muhurta name for index 0-29.
 */
export function computeDoGhati(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  nameFn: (index: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
): UnlocalizedInfo<DoGhatiSlot> {
  const dayMs = sunset.getTime() - sunrise.getTime();
  const nightMs = nextSunrise.getTime() - sunset.getTime();

  return {
    day: buildSlots(sunrise, dayMs, 0, nameFn, qualityNameFn),
    night: buildSlots(sunset, nightMs, 15, nameFn, qualityNameFn),
  };
}
