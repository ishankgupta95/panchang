import { getTranslations } from '../i18n/resolver';
import type { Language } from '../types/options';
import type { ChandraBalamInfo } from '../types/jyotish';

/**
 * Classical Chandra Balam strength by house-from-janma-rashi.
 *
 * Houses 1, 3, 6, 7, 10, 11 are Shubha (strong); 2, 4, 5, 8, 9, 12 are Ashubha (weak).
 * Index of this array is `house - 1`.
 */
const STRONG_HOUSES: ReadonlySet<number> = new Set([1, 3, 6, 7, 10, 11]);

/**
 * Compute Chandra Balam — the transit Moon's favorability relative to the
 * native's janma (birth) rashi.
 *
 * @param janmaRashiIndex         Rashi the Moon occupied at birth (0 = Mesha … 11 = Meena).
 * @param transitMoonRashiIndex   Rashi the Moon currently occupies (0 = Mesha … 11 = Meena).
 * @param lang                    Output language for the localized `name`. Defaults to 'en'.
 * @returns                       `ChandraBalamInfo` — `{ house, quality, englishName, name }`.
 *
 * @example
 * ```ts
 * // Native born with Moon in Karka (3); Moon today in Tula (6):
 * const cb = computeChandraBalam(3, 6);
 * // → { house: 4, quality: 'weak', englishName: 'Ashubha', name: 'Ashubha' }
 * ```
 */
export function computeChandraBalam(
  janmaRashiIndex: number,
  transitMoonRashiIndex: number,
  lang: Language = 'en',
): ChandraBalamInfo {
  if (!Number.isInteger(janmaRashiIndex) || janmaRashiIndex < 0 || janmaRashiIndex > 11) {
    throw new RangeError(`janmaRashiIndex must be integer in [0, 11], got ${janmaRashiIndex}`);
  }
  if (!Number.isInteger(transitMoonRashiIndex) || transitMoonRashiIndex < 0 || transitMoonRashiIndex > 11) {
    throw new RangeError(`transitMoonRashiIndex must be integer in [0, 11], got ${transitMoonRashiIndex}`);
  }

  const house = ((transitMoonRashiIndex - janmaRashiIndex + 12) % 12) + 1;
  const quality = STRONG_HOUSES.has(house) ? 'strong' : 'weak';
  const englishName = quality === 'strong' ? 'Shubha' : 'Ashubha';
  const t = getTranslations(lang);
  const name = quality === 'strong' ? t.chandraBalamNames.shubha : t.chandraBalamNames.ashubha;

  return { house, quality, englishName, name };
}
