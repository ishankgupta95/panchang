import { getTranslations } from '../i18n/resolver';
import type { Language } from '../types/options';
import type { TarabalaInfo } from '../types/jyotish';

/**
 * Classical English tara names indexed 0..8 from Janma. The cycle of nine
 * repeats three times across the 27 nakshatras.
 */
const TARA_ENGLISH_NAMES = [
  'Janma',     // 0
  'Sampat',    // 1
  'Vipat',     // 2 — inauspicious
  'Kshema',    // 3
  'Pratyari',  // 4 — inauspicious
  'Sadhaka',   // 5
  'Vadha',     // 6 — inauspicious
  'Mitra',     // 7
  'Ati-Mitra', // 8
] as const;

/** Tara indices classified inauspicious in the classical Smarta listing. */
const INAUSPICIOUS_TARAS: ReadonlySet<number> = new Set([2, 4, 6]);

/** Translation-table keys aligned with TARA_ENGLISH_NAMES order. */
const TARA_KEYS = [
  'janma', 'sampat', 'vipat', 'kshema', 'pratyari',
  'sadhaka', 'vadha', 'mitra', 'ati_mitra',
] as const;

/**
 * Compute Tarabala — the transit Moon's position in the 9-tara cycle relative
 * to the native's janma (birth) nakshatra.
 *
 * The 27 nakshatras starting from janma are partitioned into nine taras that
 * repeat three times. Three taras — Vipat (3rd), Pratyari (5th), Vadha (7th) —
 * are classed as inauspicious; the other six are auspicious.
 *
 * @param janmaNakshatraIndex      Nakshatra the Moon occupied at birth (0 = Ashwini … 26 = Revati).
 * @param transitNakshatraIndex    Nakshatra the Moon currently occupies (0 = Ashwini … 26 = Revati).
 * @param lang                     Output language for the localized `name`. Defaults to 'en'.
 * @returns                        `TarabalaInfo` — `{ taraIndex, englishName, name, quality }`.
 *
 * @example
 * ```ts
 * // Native born with Moon in Rohini (3); Moon today in Mrigashira (4):
 * const tb = computeTarabala(3, 4);
 * // → { taraIndex: 1, englishName: 'Sampat', name: 'Sampat', quality: 'auspicious' }
 * ```
 */
export function computeTarabala(
  janmaNakshatraIndex: number,
  transitNakshatraIndex: number,
  lang: Language = 'en',
): TarabalaInfo {
  if (!Number.isInteger(janmaNakshatraIndex) || janmaNakshatraIndex < 0 || janmaNakshatraIndex > 26) {
    throw new RangeError(`janmaNakshatraIndex must be integer in [0, 26], got ${janmaNakshatraIndex}`);
  }
  if (!Number.isInteger(transitNakshatraIndex) || transitNakshatraIndex < 0 || transitNakshatraIndex > 26) {
    throw new RangeError(`transitNakshatraIndex must be integer in [0, 26], got ${transitNakshatraIndex}`);
  }

  const taraIndex = ((transitNakshatraIndex - janmaNakshatraIndex + 27) % 27) % 9;
  const englishName = TARA_ENGLISH_NAMES[taraIndex]!;
  const quality: TarabalaInfo['quality'] = INAUSPICIOUS_TARAS.has(taraIndex) ? 'inauspicious' : 'auspicious';
  const t = getTranslations(lang);
  const name = t.tarabalaNames[TARA_KEYS[taraIndex]!];

  return { taraIndex, englishName, name, quality };
}
