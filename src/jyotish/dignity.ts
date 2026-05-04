import { NAISARGIKA_MAITRI, RASHI_LORD } from './matchingTables';
import type { GrahaName } from '../types/jyotish';

/**
 * Planetary dignity classifications. Order from strongest to weakest:
 * exalted → moolatrikona → own → friend → neutral → enemy → debilitated.
 */
export type Dignity =
  | 'exalted'
  | 'moolatrikona'
  | 'own'
  | 'friend'
  | 'neutral'
  | 'enemy'
  | 'debilitated';

/** Graha index in the 7-planet scheme (Sun=0..Saturn=6). */
const GRAHA_INDEX: Record<GrahaName, number> = {
  Sun: 0, Moon: 1, Mars: 2, Mercury: 3, Jupiter: 4, Venus: 5, Saturn: 6,
  Rahu: -1, Ketu: -1, // not in 7-planet friendship table — handled separately
};

/** Each graha's exaltation rashi (BPHS ch. 3). */
const EXALTATION: Record<GrahaName, number | null> = {
  Sun: 0,      // Aries
  Moon: 1,     // Taurus
  Mars: 9,     // Capricorn
  Mercury: 5,  // Virgo
  Jupiter: 3,  // Cancer
  Venus: 11,   // Pisces
  Saturn: 6,   // Libra
  Rahu: 1,     // Taurus (some traditions: Gemini)
  Ketu: 7,     // Scorpio (some traditions: Sagittarius)
};

/** Each graha's debilitation rashi — opposite of exaltation. */
const DEBILITATION: Record<GrahaName, number | null> = {
  Sun: 6,      // Libra
  Moon: 7,     // Scorpio
  Mars: 3,     // Cancer
  Mercury: 11, // Pisces
  Jupiter: 9,  // Capricorn
  Venus: 5,    // Virgo
  Saturn: 0,   // Aries
  Rahu: 7,     // Scorpio
  Ketu: 1,     // Taurus
};

/** Each graha's moolatrikona rashi (BPHS ch. 3). */
const MOOLATRIKONA: Record<GrahaName, number | null> = {
  Sun: 4,      // Leo
  Moon: 1,     // Taurus
  Mars: 0,     // Aries
  Mercury: 5,  // Virgo
  Jupiter: 8,  // Sagittarius
  Venus: 6,    // Libra
  Saturn: 10,  // Aquarius
  Rahu: null,
  Ketu: null,
};

/** Each graha's own (swakshetra) rashis. */
const OWN_RASHIS: Record<GrahaName, ReadonlyArray<number>> = {
  Sun: [4],         // Leo
  Moon: [3],        // Cancer
  Mars: [0, 7],     // Aries, Scorpio
  Mercury: [2, 5],  // Gemini, Virgo
  Jupiter: [8, 11], // Sagittarius, Pisces
  Venus: [1, 6],    // Taurus, Libra
  Saturn: [9, 10],  // Capricorn, Aquarius
  Rahu: [],         // Rahu/Ketu have no own sign in classical Vedic
  Ketu: [],
};

/**
 * Compute the dignity of a graha in a given rashi.
 *
 * Resolution order:
 *   1. exalted (graha sits in its exaltation rashi)
 *   2. debilitated (graha sits in its debilitation rashi)
 *   3. moolatrikona (graha sits in its moolatrikona rashi)
 *   4. own (graha sits in its own rashi)
 *   5. friend / neutral / enemy — based on the rashi-lord's natural
 *      friendship to the graha (BPHS ch. 4 Naisargika Maitri)
 *
 * Rahu and Ketu use the same ruler-based logic for friend/neutral/enemy
 * (treating them as "Saturn-like" and "Mars-like" respectively in some
 * traditions); the simpler form here returns 'neutral' as a default for
 * Rahu/Ketu in non-exalt/debilitate signs since the classical literature
 * does not assign them a formal Naisargika placement in the 7-planet
 * friendship table.
 *
 * @param graha  The graha whose dignity to evaluate.
 * @param rashi  Rashi index (0 = Mesha … 11 = Meena).
 * @returns      One of the seven dignity categories.
 *
 * @example
 * ```typescript
 * computeDignity('Mars', 0);  // 'own' (Aries)
 * computeDignity('Mars', 9);  // 'exalted' (Capricorn)
 * computeDignity('Sun', 6);   // 'debilitated' (Libra)
 * ```
 */
export function computeDignity(graha: GrahaName, rashi: number): Dignity {
  if (!Number.isInteger(rashi) || rashi < 0 || rashi >= 12) {
    throw new RangeError(`rashi must be integer in [0, 11], got ${rashi}`);
  }

  if (EXALTATION[graha] === rashi) return 'exalted';
  if (DEBILITATION[graha] === rashi) return 'debilitated';
  if (MOOLATRIKONA[graha] === rashi) return 'moolatrikona';
  if (OWN_RASHIS[graha].includes(rashi)) return 'own';

  const grahaIdx = GRAHA_INDEX[graha];
  if (grahaIdx < 0) return 'neutral'; // Rahu/Ketu without classical Naisargika row

  const lordIdx = RASHI_LORD[rashi]!;
  if (grahaIdx === lordIdx) return 'own'; // safety net
  const friendship = NAISARGIKA_MAITRI[grahaIdx]![lordIdx]!;
  if (friendship === 1) return 'friend';
  if (friendship === -1) return 'enemy';
  return 'neutral';
}
