import { getTranslations } from '../i18n/resolver';
import type { Language } from '../types/options';
import type { ChandraBalamInfo } from '../types/jyotish';

/** Shubha houses from janma rashi; the rest are Ashubha. */
const STRONG_HOUSES: ReadonlySet<number> = new Set([1, 3, 6, 7, 10, 11]);

/** The transit Moon's favorability from the native's janma rashi; both rashi indices are 0 = Mesha … 11 = Meena. */
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
