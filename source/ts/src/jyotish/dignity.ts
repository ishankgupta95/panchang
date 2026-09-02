import { NAISARGIKA_MAITRI, RASHI_LORD } from './matchingTables';
import type { GrahaName } from '../types/jyotish';

/** Planetary dignity, strongest to weakest. */
export type Dignity =
  | 'exalted'
  | 'moolatrikona'
  | 'own'
  | 'friend'
  | 'neutral'
  | 'enemy'
  | 'debilitated';

const GRAHA_INDEX: Record<GrahaName, number> = {
  Sun: 0, Moon: 1, Mars: 2, Mercury: 3, Jupiter: 4, Venus: 5, Saturn: 6,
  Rahu: -1, Ketu: -1, // no row in the 7-planet table
};

/** BPHS ch. 3. */
const EXALTATION: Record<GrahaName, number | null> = {
  Sun: 0,
  Moon: 1,
  Mars: 9,
  Mercury: 5,
  Jupiter: 3,
  Venus: 11,
  Saturn: 6,
  Rahu: 1,     // some traditions: Gemini
  Ketu: 7,     // some traditions: Sagittarius
};

const DEBILITATION: Record<GrahaName, number | null> = {
  Sun: 6,
  Moon: 7,
  Mars: 3,
  Mercury: 11,
  Jupiter: 9,
  Venus: 5,
  Saturn: 0,
  Rahu: 7,
  Ketu: 1,
};

/** BPHS ch. 3. */
const MOOLATRIKONA: Record<GrahaName, number | null> = {
  Sun: 4,
  Moon: 1,
  Mars: 0,
  Mercury: 5,
  Jupiter: 8,
  Venus: 6,
  Saturn: 10,
  Rahu: null,
  Ketu: null,
};

const OWN_RASHIS: Record<GrahaName, ReadonlyArray<number>> = {
  Sun: [4],
  Moon: [3],
  Mars: [0, 7],
  Mercury: [2, 5],
  Jupiter: [8, 11],
  Venus: [1, 6],
  Saturn: [9, 10],
  Rahu: [],         // Rahu/Ketu have no own sign in classical Vedic
  Ketu: [],
};

/**
 * Dignity of a graha in a rashi; friend / neutral / enemy come from the rashi lord's Naisargika Maitri (BPHS ch. 4).
 * @param rashi 0 = Mesha … 11 = Meena.
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
  if (grahaIdx < 0) return 'neutral';

  const lordIdx = RASHI_LORD[rashi]!;
  if (grahaIdx === lordIdx) return 'own';
  const friendship = NAISARGIKA_MAITRI[grahaIdx]![lordIdx]!;
  if (friendship === 1) return 'friend';
  if (friendship === -1) return 'enemy';
  return 'neutral';
}
