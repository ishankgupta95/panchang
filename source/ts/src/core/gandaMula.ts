import { resolveNakshatraName } from '../i18n/resolver';
import { assertNakshatraIndex } from '../utils/validation';
import type { Language } from '../types/options';
import type { GandaMulaInfo } from '../types/elements';

/**
 * The 6 "root" (gaṇḍānta-mūla) nakshatras classed inauspicious for new beginnings
 * (Muhurta-chintamani Ch. 4 / BPHS Ch. 71).
 */
const GANDA_MULA_SEVERITY = new Map<number, 'mild' | 'severe'>([
  [0, 'mild'],     // Ashwini
  [8, 'mild'],     // Ashlesha
  [9, 'mild'],     // Magha
  [17, 'severe'],  // Jyeshtha
  [18, 'severe'],  // Mula
  [26, 'mild'],    // Revati
]);

/** Whether the Moon sits in a Ganda Mula nakshatra, with its severity. */
export function computeGandaMula(
  currentNakshatraIndex: number,
  lang: Language = 'en',
): GandaMulaInfo {
  assertNakshatraIndex(currentNakshatraIndex, 'currentNakshatraIndex');

  const severity = GANDA_MULA_SEVERITY.get(currentNakshatraIndex);
  if (severity === undefined) {
    return { active: false };
  }

  return {
    active: true,
    nakshatraName: resolveNakshatraName(currentNakshatraIndex, lang),
    severity,
  };
}
