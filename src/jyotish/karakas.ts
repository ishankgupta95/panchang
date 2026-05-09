import type {
  BirthChart, GrahaName, JaiminiKarakas, KarakaName, PlanetPlacement,
} from '../types/jyotish';

/**
 * 7 Karaka roles in canonical Atmakaraka → Darakaraka order. Position `i`
 * in the sorted-by-descending-degree planet list maps to `KARAKA_ORDER[i]`.
 */
const KARAKA_ORDER: readonly KarakaName[] = [
  'Atmakaraka',
  'Amatyakaraka',
  'Bhratrukaraka',
  'Matrukaraka',
  'Putrakaraka',
  'Gnatikaraka',
  'Darakaraka',
];

/**
 * The 7 visible grahas in their canonical Parashara order. This order
 * doubles as the **stable tie-break order**: when two grahas share an
 * identical `degreeInRashi`, the one earlier in this list wins the
 * higher (more-significant) Karaka role.
 */
const VISIBLE_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/**
 * Compute the 7 Chara (movable) Jaimini Karakas in the **Parashara
 * variant** for a natal chart.
 *
 * **Algorithm.** Take the 7 visible grahas (Sun, Moon, Mars, Mercury,
 * Jupiter, Venus, Saturn), sort them by **descending** `degreeInRashi`,
 * then assign:
 *
 *     index 0 → Atmakaraka     (highest degree)
 *     index 1 → Amatyakaraka
 *     index 2 → Bhratrukaraka
 *     index 3 → Matrukaraka
 *     index 4 → Putrakaraka
 *     index 5 → Gnatikaraka
 *     index 6 → Darakaraka     (lowest degree)
 *
 * **Tie-break.** When two grahas share an identical `degreeInRashi`
 * (rare — typically only with hand-constructed charts), the listed
 * canonical order — Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn —
 * is preserved. The implementation uses a stable sort so the earlier
 * graha in that list wins the more-significant Karaka role.
 *
 * Rahu and Ketu are **not** included — this function implements the
 * 7-Karaka Parashara variant, not the reversed-Rahu 8-Karaka Jaimini
 * variant.
 *
 * @param chart  Natal D1 chart from `computeRashiChart`.
 * @returns      A `JaiminiKarakas` record mapping every Karaka role to
 *               its assigned graha.
 *
 * @example
 * ```typescript
 * import { computeRashiChart, computeJaiminiKarakas } from 'panchang-ts';
 *
 * const chart = computeRashiChart(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * const k = computeJaiminiKarakas(chart);
 * k.Atmakaraka;   // e.g. 'Saturn'  — graha at the highest degree-in-rashi
 * k.Darakaraka;   // e.g. 'Mercury' — graha at the lowest degree-in-rashi
 * ```
 */
export function computeJaiminiKarakas(chart: BirthChart): JaiminiKarakas {
  const planetByName = {} as Record<GrahaName, PlanetPlacement>;
  for (const p of chart.planets) planetByName[p.planet] = p;

  // Build the input array in canonical order so a stable sort preserves
  // the documented tie-break: equal degrees → earlier-in-VISIBLE_GRAHAS wins.
  const ranked = VISIBLE_GRAHAS.map((g) => ({
    graha: g,
    degree: planetByName[g].degreeInRashi,
  }));

  ranked.sort((a, b) => b.degree - a.degree);

  const result = {} as JaiminiKarakas;
  for (let i = 0; i < KARAKA_ORDER.length; i++) {
    result[KARAKA_ORDER[i]!] = ranked[i]!.graha;
  }
  return result;
}
