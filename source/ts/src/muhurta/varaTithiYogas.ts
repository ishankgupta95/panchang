/**
 * Tables from Ernst Wilhelm's *Muhurta Yogas: Combinations of Vara, Tithi & Nakshatra*,
 * indexed by tithi number within the paksha (1..15). A few cells form an auspicious
 * *and* an inauspicious yoga at once; Wilhelm leaves that unresolved, so both are reported.
 */

import { assertVaraIndex, assertTithiIndex } from '../utils/validation';

export type VaraTithiYogaType =
  | 'siddha' | 'amrita'
  | 'dagdha' | 'visha' | 'hutasana' | 'krakacha' | 'samvartaka';

export interface VaraTithiYoga {
  type: VaraTithiYogaType;
  polarity: 'auspicious' | 'inauspicious';
}

type VaraTable = readonly [
  readonly number[], readonly number[], readonly number[], readonly number[],
  readonly number[], readonly number[], readonly number[],
];

// Siddha and Amrita name their rows by tithi *group*: Nanda (1/6/11), Bhadra (2/7/12),
// Jaya (3/8/13), Rikta (4/9/14), Purna (5/10/15). Hence whole groups per cell.
const AUSPICIOUS: Readonly<Record<'siddha' | 'amrita', VaraTable>> = {
  siddha: [[], [], [3, 8, 13], [2, 7, 12], [5, 10, 15], [1, 6, 11], [4, 9, 14]],
  amrita: [[1, 6, 11], [2, 7, 12], [1, 6, 11], [3, 8, 13], [4, 9, 14], [2, 7, 12], [5, 10, 15]],
};

const INAUSPICIOUS: Readonly<Record<
  'dagdha' | 'visha' | 'hutasana' | 'krakacha' | 'samvartaka', VaraTable
>> = {
  // Mercury's Dagdha cell is given as "the 2nd or 3rd", so both are carried.
  dagdha: [[12], [11], [5], [2, 3], [6], [8], [9]],
  visha: [[4], [6], [7], [2], [8], [9], [7]],
  hutasana: [[12], [6], [7], [8], [9], [10], [11]],
  krakacha: [[12], [11], [10], [9], [8], [7], [6]],
  samvartaka: [[7], [], [], [1], [], [], []],
};

/**
 * Every Vara x Tithi yoga formed by a weekday and a tithi, auspicious first.
 * @param varaIndex   0 = Sunday … 6 = Saturday.
 * @param tithiIndex  0..29 (0 = Shukla Pratipada … 29 = Amavasya).
 */
export function computeVaraTithiYogas(varaIndex: number, tithiIndex: number): VaraTithiYoga[] {
  assertVaraIndex(varaIndex);
  assertTithiIndex(tithiIndex);

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
