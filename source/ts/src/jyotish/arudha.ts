import { RASHI_LORD } from './matchingTables';
import { resolveMasaName } from '../i18n/resolver';
import type { Language } from '../types/options';
import type { Arudha, BirthChart, GrahaName } from '../types/jyotish';

const VISIBLE_GRAHAS_BY_INDEX: readonly Exclude<GrahaName, 'Rahu' | 'Ketu'>[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/** The 12 Arudha padas, one per bhava (Jaimini *Upadesa Sutras* Ch. 1, Rath commentary). */
export function computeArudhas(chart: BirthChart, lang: Language = 'en'): Arudha[] {
  const lagnaRashi = chart.lagna.rashi.index;

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

    // Jaimini 1.1.30-31: the pada may occupy neither the bhava itself nor the
    // 7th from it. Keyed on the pada's own offset, not on D: keying on D
    // covers only the pada-on-bhava case and leaves D ∈ {4, 10} in the 7th.
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
