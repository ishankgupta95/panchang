import { resolveAnandadiYogaName } from '../i18n/resolver';
import {
  ANANDADI_TABLE,
  ANANDADI_QUALITY,
} from '../utils/constants';
import { assertNakshatraIndex, assertVaraIndex } from '../utils/validation';
import type { Language } from '../types/options';
import type { AnandadiYogaInfo } from '../types/elements';

/**
 * Anandadi Yoga: the 28-name weekday × nakshatra cycle of Muhurta-chintamani Ch. 4,
 * reduced to 27 nakshatras in `ANANDADI_TABLE` by eliding Abhijit.
 */
export function computeAnandadiYoga(
  varaIndex: number,
  nakshatraIndex: number,
  lang: Language = 'en',
): AnandadiYogaInfo {
  assertVaraIndex(varaIndex);
  assertNakshatraIndex(nakshatraIndex);

  const index = ANANDADI_TABLE[varaIndex]![nakshatraIndex]!;
  return {
    index,
    name: resolveAnandadiYogaName(index, lang),
    quality: ANANDADI_QUALITY[index]!,
  };
}
