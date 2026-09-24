import { RASHI_LORD } from './matchingTables';
import { resolveMasaName } from '../i18n/resolver';
import { PanchangError } from '../types/errors';
import type { Language } from '../types/options';
import type { Arudha, BirthChart, GrahaName } from '../types/jyotish';

const VISIBLE_GRAHAS_BY_INDEX: readonly Exclude<GrahaName, 'Rahu' | 'Ketu'>[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/**
 * The 12 Arudha padas, one per bhava (Jaimini *Upadesa Sutras* Ch. 1, Rath commentary). A lagna rashi index of 12 or
 * more wraps modulo 12; a negative or fractional one throws `PanchangError` `INVALID_INPUT`.
 */
export function computeArudhas(chart: BirthChart, lang: Language = 'en'): Arudha[] {
  const lagnaRashi = chart.lagna.rashi.index;
  if (!Number.isInteger(lagnaRashi) || lagnaRashi < 0) {
    throw new PanchangError(`lagna rashi must be a non-negative integer, got ${lagnaRashi}`, 'INVALID_INPUT');
  }

  const planetRashi: Partial<Record<GrahaName, number>> = {};
  for (const p of chart.planets) {
    if (p.planet === 'Rahu' || p.planet === 'Ketu') continue;
    planetRashi[p.planet] = p.rashi.index;
  }

  const out: Arudha[] = [];
  for (let bhava = 1; bhava <= 12; bhava++) {
    const bhavaRashi = (lagnaRashi + bhava - 1) % 12;
    const bhavaLord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[bhavaRashi]!]!;
    const lordRashi = planetRashi[bhavaLord]!;

    const D = ((lordRashi - bhavaRashi + 12) % 12) + 1;

    let arudhaRashi = (lordRashi + D - 1) % 12;

    const offsetFromBhava = (arudhaRashi - bhavaRashi + 12) % 12;
    if (offsetFromBhava === 0) {
      arudhaRashi = (arudhaRashi + 9) % 12;
    } else if (offsetFromBhava === 6) {
      arudhaRashi = (arudhaRashi + 3) % 12;
    }

    const arudhaLord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[arudhaRashi]!]!;

    out.push({
      bhava,
      arudhaRashi,
      arudhaRashiName: resolveMasaName(arudhaRashi, lang),
      arudhaLord,
    });
  }
  return out;
}
