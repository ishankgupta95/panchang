/**
 * Vara x Tithi yogas — the combination layer classical muhurta actually judges.
 *
 * Tithi and vara are not independent verdicts. The same tithi flips sign with
 * the weekday it lands on: Rikta tithis, avoided for every mangala karya, are
 * *auspicious* on a Saturday (Siddha yoga), while an otherwise unremarkable
 * Dwadashi is spoiled on a Sunday (Dagdha and Hutasana). Scoring the two axes
 * separately cannot express any of that, which is what this table restores.
 *
 * ## Sources
 *
 * Reproduced from Ernst Wilhelm's *Muhurta Yogas: Combinations of Vara, Tithi
 * & Nakshatra*, whose tables agree cell-for-cell with the tables published at
 * blog.cosmicinsights.net. Both index tithis by their **number within the
 * paksha** (1..15, where 15 is Purnima in Shukla and Amavasya in Krishna), so
 * every row here applies to both fortnights.
 *
 * ## These tables contradict each other, deliberately
 *
 * Five cells form an auspicious *and* an inauspicious yoga at once — Wednesday
 * with the 2nd or 3rd tithi, Saturday with the 9th, Thursday with the 9th,
 * Friday with the 7th. Wilhelm marks exactly these with an asterisk rather
 * than resolving them, and no source in the tradition ranks one table over
 * another. So {@link computeVaraTithiYogas} reports every yoga that matches
 * and leaves the arbitration to the caller; the muhurta engine lets the
 * bonuses and penalties net out rather than picking a winner the sources do
 * not support.
 */

import { assertVaraIndex, assertTithiIndex } from '../utils/validation';

/** The seven classical Vara x Tithi yogas. */
export type VaraTithiYogaType =
  | 'siddha' | 'amrita'
  | 'dagdha' | 'visha' | 'hutasana' | 'krakacha' | 'samvartaka';

/** One matched Vara x Tithi yoga. */
export interface VaraTithiYoga {
  /** Stable identifier, e.g. `'siddha'`. */
  type: VaraTithiYogaType;
  /** Which direction it pushes the day. */
  polarity: 'auspicious' | 'inauspicious';
}

/**
 * Tithi numbers (1..15 within the paksha) keyed by vara, 0 = Sunday.
 * An empty row means the yoga does not form on that weekday.
 */
type VaraTable = readonly [
  readonly number[], readonly number[], readonly number[], readonly number[],
  readonly number[], readonly number[], readonly number[],
];

/**
 * Siddha and Amrita name their rows by tithi *group* — Nanda (1/6/11),
 * Bhadra (2/7/12), Jaya (3/8/13), Rikta (4/9/14), Purna (5/10/15) — which is
 * why each cell below is a whole group rather than a single number.
 */
const AUSPICIOUS: Readonly<Record<'siddha' | 'amrita', VaraTable>> = {
  //        Sun          Mon         Tue          Wed         Thu          Fri         Sat
  siddha: [[], [], [3, 8, 13], [2, 7, 12], [5, 10, 15], [1, 6, 11], [4, 9, 14]],
  amrita: [[1, 6, 11], [2, 7, 12], [1, 6, 11], [3, 8, 13], [4, 9, 14], [2, 7, 12], [5, 10, 15]],
};

/**
 * The malefic tables name single tithis. Wilhelm calls Krakacha "perhaps the
 * worst of the Vara/Tithi Yogas" and Samvartaka "also one of the worst"; the
 * engine does not currently grade them apart.
 */
const INAUSPICIOUS: Readonly<Record<
  'dagdha' | 'visha' | 'hutasana' | 'krakacha' | 'samvartaka', VaraTable
>> = {
  //           Sun    Mon    Tue     Wed     Thu   Fri    Sat
  // Mercury's Dagdha cell is given as "the 2nd or 3rd" — both are carried.
  dagdha: [[12], [11], [5], [2, 3], [6], [8], [9]],
  visha: [[4], [6], [7], [2], [8], [9], [7]],
  hutasana: [[12], [6], [7], [8], [9], [10], [11]],
  krakacha: [[12], [11], [10], [9], [8], [7], [6]],
  samvartaka: [[7], [], [], [1], [], [], []],
};

/**
 * Every Vara x Tithi yoga formed by a weekday and a tithi.
 *
 * Returns auspicious matches first, then inauspicious, each group in table
 * order. A day may match several — including one of each polarity, which the
 * sources treat as a genuine ambiguity rather than an error.
 *
 * @param varaIndex   Weekday, 0 = Sunday … 6 = Saturday.
 * @param tithiIndex  Tithi 0..29 (0 = Shukla Pratipada … 29 = Amavasya).
 * @returns           Matched yogas; empty when the pair forms none.
 *
 * @example
 * ```typescript
 * // Navami (a Rikta tithi) on a Saturday: auspicious by Siddha, burnt by Dagdha.
 * computeVaraTithiYogas(6, 8);
 * // → [{ type: 'siddha', polarity: 'auspicious' },
 * //    { type: 'dagdha', polarity: 'inauspicious' }]
 * ```
 */
export function computeVaraTithiYogas(varaIndex: number, tithiIndex: number): VaraTithiYoga[] {
  assertVaraIndex(varaIndex);
  assertTithiIndex(tithiIndex);

  // Number within the paksha: 1..15, identical in both fortnights.
  const tithiNumber = (tithiIndex % 15) + 1;
  const out: VaraTithiYoga[] = [];

  for (const [type, table] of Object.entries(AUSPICIOUS)) {
    if (table[varaIndex]!.includes(tithiNumber)) {
      out.push({ type: type as VaraTithiYogaType, polarity: 'auspicious' });
    }
  }
  for (const [type, table] of Object.entries(INAUSPICIOUS)) {
    if (table[varaIndex]!.includes(tithiNumber)) {
      out.push({ type: type as VaraTithiYogaType, polarity: 'inauspicious' });
    }
  }
  return out;
}
