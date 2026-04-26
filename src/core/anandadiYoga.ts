import { resolveAnandadiYogaName } from '../i18n/resolver';
import {
  ANANDADI_TABLE,
  ANANDADI_QUALITY,
  TOTAL_ANANDADI_YOGAS,
  TOTAL_NAKSHATRAS,
} from '../utils/constants';
import type { Language } from '../types/options';
import type { AnandadiYogaInfo } from '../types/elements';

/**
 * Anandadi Yoga — the 28-name cycle formed by the weekday × nakshatra
 * combination per Muhurta-chintamani Ch. 4. The cycle anchors at Ananda
 * on Sunday/Ashwini and advances +4 nakshatras per weekday in the
 * 28-nakshatra (with Abhijit) classical system. Reduced to the project's
 * 27-nakshatra convention by eliding Abhijit, the lookup is the static
 * `ANANDADI_TABLE` defined in [src/utils/constants.ts](../utils/constants.ts).
 *
 * The result is a pure function of `(varaIndex, nakshatraIndex)` with no
 * time-of-day dependency, so it is safe to use at sunrise (daily mode)
 * and at any instant (instant mode) — parallel to {@link computeGandaMula}.
 *
 * @param varaIndex        Weekday index (0 = Sunday … 6 = Saturday).
 * @param nakshatraIndex   Nakshatra index (0 = Ashwini … 26 = Revati).
 * @param lang             Output language for the localized `name`. Defaults to 'en'.
 * @returns                `AnandadiYogaInfo` — `{ index, name, quality }`.
 *
 * @example
 * ```ts
 * // Sunday (vara 0) at Ashwini (nakshatra 0) → Ananda (auspicious).
 * computeAnandadiYoga(0, 0);
 * // → { index: 0, name: 'Ananda', quality: 'auspicious' }
 * ```
 */
export function computeAnandadiYoga(
  varaIndex: number,
  nakshatraIndex: number,
  lang: Language = 'en',
): AnandadiYogaInfo {
  if (!Number.isInteger(varaIndex) || varaIndex < 0 || varaIndex >= 7) {
    throw new RangeError(`varaIndex must be integer in [0, 6], got ${varaIndex}`);
  }
  if (
    !Number.isInteger(nakshatraIndex) ||
    nakshatraIndex < 0 ||
    nakshatraIndex >= TOTAL_NAKSHATRAS
  ) {
    throw new RangeError(
      `nakshatraIndex must be integer in [0, ${TOTAL_NAKSHATRAS - 1}], got ${nakshatraIndex}`,
    );
  }

  const index = ANANDADI_TABLE[varaIndex]![nakshatraIndex]!;
  if (index < 0 || index >= TOTAL_ANANDADI_YOGAS) {
    throw new Error(`ANANDADI_TABLE returned out-of-range index ${index}`);
  }

  return {
    index,
    name: resolveAnandadiYogaName(index, lang),
    quality: ANANDADI_QUALITY[index]!,
  };
}
