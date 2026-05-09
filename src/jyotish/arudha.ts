import { RASHI_LORD } from './matchingTables';
import { resolveMasaName } from '../i18n/resolver';
import type { Language } from '../types/options';
import type { Arudha, BirthChart, GrahaName } from '../types/jyotish';

const VISIBLE_GRAHAS_BY_INDEX: readonly Exclude<GrahaName, 'Rahu' | 'Ketu'>[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/**
 * Compute the 12 Arudha padas (one per bhava 1..12) for a natal chart,
 * per the Jaimini standard with the two canonical exceptions.
 *
 * **Algorithm** (Jaimini *Upadesa Sutras* Ch. 1, Sanjay Rath commentary).
 *
 * For each bhava `B` in 1..12:
 *
 *   1. `bhavaRashi = (lagnaRashi + B − 1) mod 12`.
 *   2. `lordRashi` = the rashi the bhava's rashi-lord *occupies* in the
 *      natal chart (NOT `RASHI_LORD[bhavaRashi]` — that's the lord
 *      planet; we need where it lives).
 *   3. `D = (lordRashi − bhavaRashi + 12) mod 12 + 1`. `D` is in 1..12,
 *      counting how many houses the lord is from its own bhava
 *      (inclusive count: lord-in-own-bhava → D=1).
 *   4. `arudhaRashi = (lordRashi + D − 1) mod 12` — counting another
 *      `D` houses from the lord.
 *   5. **Exceptions** (avoid Arudha collapsing onto bhava itself or 7th):
 *      - `D == 1` (lord in own bhava) → `arudhaRashi = (lordRashi + 9) mod 12`
 *        (10th from lord, *exclusive* — lord + 9 = 10th in 1-indexed counting).
 *      - `D == 7` (lord in 7th from bhava) → `arudhaRashi = (lordRashi + 3) mod 12`
 *        (4th from lord, exclusive).
 *
 * Bhava 1's Arudha is **Arudha Lagna (AL)** — the social / public-
 * facing image, distinct from Lagna (the inner-self).
 *
 * Rashi-lords resolve through {@link RASHI_LORD}, which only assigns
 * the 7 visible grahas — Rahu and Ketu never own a sign in the
 * classical Parashari scheme.
 *
 * @param chart  Natal D1 chart from `computeRashiChart`. Reads
 *               `chart.lagna.rashi.index` and the rashi-positions of
 *               the 7 visible grahas to locate each bhava's lord.
 * @param lang   Output language for `arudhaRashiName`. Defaults to
 *               the chart's language (which propagates through
 *               `computeRashiChart`); pass an override to differ.
 *
 * @example
 * ```typescript
 * import { computeRashiChart, computeArudhas } from 'panchang-ts';
 *
 * const chart = computeRashiChart(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * const arudhas = computeArudhas(chart);
 * arudhas.length;             // 12
 * arudhas[0].arudhaRashiName; // Arudha Lagna's rashi
 * arudhas[0].arudhaLord;      // its lord
 *
 * // 7th-bhava Arudha = Darapada (spouse pada)
 * const darapada = arudhas[6];
 * ```
 */
export function computeArudhas(chart: BirthChart, lang: Language = 'en'): Arudha[] {
  const lagnaRashi = chart.lagna.rashi.index;

  // Map each visible graha → its rashi index in the natal chart.
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

    // Inclusive distance from bhava to lord (1..12).
    const D = ((lordRashi - bhavaRashi + 12) % 12) + 1;

    let arudhaRashi: number;
    if (D === 1) {
      // Lord in own bhava → 10th from lord (lord-rashi + 9, mod 12).
      arudhaRashi = (lordRashi + 9) % 12;
    } else if (D === 7) {
      // Lord in 7th from bhava → 4th from lord (lord-rashi + 3, mod 12).
      arudhaRashi = (lordRashi + 3) % 12;
    } else {
      // Standard rule: count another D houses from lord.
      arudhaRashi = (lordRashi + D - 1) % 12;
    }

    // Arudha's *own* rashi-lord — useful for analyzing the pada's
    // significations directly. (The original bhava's lord — `bhavaLord`
    // — drives the Arudha calculation but is not surfaced here; callers
    // can recover it via `RASHI_LORD[bhavaRashi]` if needed.)
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
