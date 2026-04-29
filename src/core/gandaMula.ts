import { resolveNakshatraName } from '../i18n/resolver';
import { assertNakshatraIndex } from '../utils/validation';
import type { Language } from '../types/options';
import type { GandaMulaInfo } from '../types/elements';

/**
 * Ganda Mula — the 6 "root" (gaṇḍānta-mūla) nakshatras classed inauspicious
 * for new beginnings (births, journeys, housewarmings, vivaha) per classical
 * Smarta muhurta texts (Muhurta-chintamani Ch. 4 / BPHS Ch. 71).
 *
 * The set comprises:
 *   - Ashwini   (0)  — start of the zodiac
 *   - Ashlesha  (8)  — Karka/Simha gaṇḍānta junction
 *   - Magha     (9)  — Karka/Simha gaṇḍānta junction
 *   - Jyeshtha  (17) — Vrischika/Dhanus gaṇḍānta junction
 *   - Mula      (18) — Vrischika/Dhanus gaṇḍānta junction
 *   - Revati    (26) — end of the zodiac
 *
 * Severity follows the classical reading: the Vrischika–Dhanus pair
 * (Jyeshtha + Mula) is *severe* (the strongest inauspicious window — children
 * born here traditionally require Mula-shanti), while the other four are
 * *mild*.
 */
const GANDA_MULA_SEVERITY = new Map<number, 'mild' | 'severe'>([
  [0, 'mild'],     // Ashwini
  [8, 'mild'],     // Ashlesha
  [9, 'mild'],     // Magha
  [17, 'severe'],  // Jyeshtha
  [18, 'severe'],  // Mula
  [26, 'mild'],    // Revati
]);

/**
 * Detect whether the Moon currently sits in a Ganda Mula nakshatra and
 * return the severity classification.
 *
 * This is a pure index test with no time-of-day dependency, so it is safe
 * to use both at sunrise (daily mode) and at any instant (instant mode) —
 * unlike Varjyam, which requires the Hindu day boundaries.
 *
 * @param currentNakshatraIndex  Nakshatra index (0..26) the Moon currently occupies.
 * @param lang                   Output language for the localized `nakshatraName`. Defaults to 'en'.
 * @returns                      `GandaMulaInfo` — `{ active }` when not in a Ganda
 *                               Mula nakshatra; `{ active, nakshatraName, severity }`
 *                               when active.
 */
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
