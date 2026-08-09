import type { DoGhatiSlot, ChoghadiyaQuality, Unlocalized, UnlocalizedInfo } from '../types/elements';
import { buildEqualSlots } from '../utils/slots';

/**
 * Quality classification for each of the 30 Do Ghati Muhurta slots.
 *
 * Indexed 0–29 in DrikPanchang's published order:
 *   Day  (0–14):  Rudra, Uraga, Mitra, Pitara, Vasu, Ambu, Vishwedeva,
 *                 Vidhi, Brahma, Indra, Indragni, Daitya, Varuna, Aryama, Bhaga
 *   Night (15–29): Ishwara, Ajaikapada, Ahirbudhnya, Pusha, Ashwini, Yama,
 *                 Agni, Brahma, Chandra, Aditi, Brihaspati, Vishnu, Surya,
 *                 Tvashta, Samirana
 *
 * Source: DrikPanchang's Do Ghati Muhurat daily table
 * (drikpanchang.com/muhurat/daily/do-ghati-muhurat.html). The table presents
 * the same 30-name sequence on every weekday — there is NO vara-based rotation
 * of the kind Choghadiya / Gowri Panchangam use. This is consistent with the
 * classical Brahmana / Smriti enumeration where each muhurta is associated
 * with a fixed presiding deity, independent of the day of the week.
 */
const DO_GHATI_QUALITY: readonly ChoghadiyaQuality[] = [
  // ── Daytime (slots 1–15, indices 0–14) ──
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
  // ── Nighttime (slots 16–30, indices 15–29) ──
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
 * Compute the 30 Do Ghati Muhurta slots for a Hindu day (15 daytime +
 * 15 nighttime).
 *
 * Each slot is "do ghati" = 2 ghatikas ≈ 48 minutes, but in practice
 * sunrise→sunset and sunset→nextSunrise are divided into 15 *equal* slots
 * each, so the actual slot length is `dayLength / 15` (resp. `nightLength
 * / 15`). The names and auspicious / inauspicious classifications are
 * fixed by slot position — they do NOT rotate by weekday (see comment on
 * `DO_GHATI_QUALITY`).
 *
 * @param sunrise        UTC sunrise Date.
 * @param sunset         UTC sunset Date.
 * @param nextSunrise    UTC next-day sunrise Date.
 * @param nameFn         Callback returning translated muhurta name for index 0–29.
 * @param qualityNameFn  Callback returning translated quality name.
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
