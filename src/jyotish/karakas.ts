import type {
  BirthChart, GrahaName, Jaimini8Karakas, JaiminiKarakas, Karaka8Name,
  KarakaName, PlanetPlacement,
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
 * 8 Karaka roles in canonical order, used by the Jaimini variant. The
 * 7-Parashara list with **Pitrukaraka** (father) inserted at position 4
 * — the new 5th role between Matrukaraka and Putrakaraka. Position `i`
 * in the sorted-by-descending-effective-degree 8-graha list (Sun..Saturn
 * + Rahu) maps to `KARAKA_8_ORDER[i]`.
 */
const KARAKA_8_ORDER: readonly Karaka8Name[] = [
  'Atmakaraka',
  'Amatyakaraka',
  'Bhratrukaraka',
  'Matrukaraka',
  'Pitrukaraka',
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
 * The 8 grahas used by the Jaimini variant — the 7 visible grahas plus
 * Rahu. Extends the Parashara stable-sort tie-break order one slot:
 * when Rahu's reversed degree exactly equals a visible graha's degree,
 * Rahu loses the tie (the visible graha takes the more-significant role).
 */
const VISIBLE_GRAHAS_8: readonly GrahaName[] = [
  ...VISIBLE_GRAHAS, 'Rahu',
];

/**
 * Options for {@link computeJaiminiKarakas}.
 *
 * - `'7-parashara'` (default): the 7-Karaka Parashara variant. Excludes
 *   Rahu and Ketu. Returns {@link JaiminiKarakas}.
 * - `'8-jaimini'`: the 8-Karaka Jaimini variant per Sanjay Rath's
 *   Upadesa Sutras commentary. Adds Rahu as the 8th planet with its
 *   `degreeInRashi` reversed (`30 − degreeInRashi`) to account for
 *   Rahu's permanent retrograde motion. Inserts **Pitrukaraka** as
 *   the new 5th role. Returns {@link Jaimini8Karakas}.
 */
export interface ComputeJaiminiKarakasOptions {
  variant?: '7-parashara' | '8-jaimini';
}

/**
 * Compute the Chara (movable) Jaimini Karakas for a natal chart.
 *
 * Two variants are supported via the optional `options.variant` flag:
 *
 * **7-Karaka Parashara variant** (default — `options.variant`
 * omitted or `'7-parashara'`). Take the 7 visible grahas
 * (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn), sort them by
 * **descending** `degreeInRashi`, then assign:
 *
 *     index 0 → Atmakaraka     (highest degree)
 *     index 1 → Amatyakaraka
 *     index 2 → Bhratrukaraka
 *     index 3 → Matrukaraka
 *     index 4 → Putrakaraka
 *     index 5 → Gnatikaraka
 *     index 6 → Darakaraka     (lowest degree)
 *
 * **8-Karaka Jaimini variant** (`options.variant === '8-jaimini'`).
 * Take the 7 visible grahas **plus Rahu**, where Rahu's effective
 * degree is `30 − degreeInRashi` (reversed because Rahu is permanently
 * retrograde — its "longitudinal progression" within a sign is measured
 * from the upper boundary, not from 0°). Sort the 8 grahas by descending
 * effective degree, then assign:
 *
 *     index 0 → Atmakaraka     (highest effective degree)
 *     index 1 → Amatyakaraka
 *     index 2 → Bhratrukaraka
 *     index 3 → Matrukaraka
 *     index 4 → Pitrukaraka    (NEW — father)
 *     index 5 → Putrakaraka
 *     index 6 → Gnatikaraka
 *     index 7 → Darakaraka     (lowest effective degree)
 *
 * **Tie-break.** Both variants use a stable sort over the canonical
 * Parashara graha order: Sun > Moon > Mars > Mercury > Jupiter > Venus
 * > Saturn (> Rahu, in the 8-variant). When two grahas share an
 * identical effective degree (rare — typically only with hand-
 * constructed charts), the earlier graha in that list wins the
 * higher (more-significant) Karaka role; Rahu loses every tie under
 * the 8-variant.
 *
 * **Ketu**: not included in either variant. The unanimous secondary-
 * source convention is "add Rahu only" — Ketu, although also retrograde,
 * is treated as Rahu's nodal pair and conceptually duplicates Rahu's
 * significations.
 *
 * **Sources.** Parashara, *Brihat Parashara Hora Shastra* Ch.32 (Chara
 * Karakas, the 7-variant); Jaimini Maharishi, *Upadesa Sutras* Ch.1
 * First Foot (Adhikaar Sutras) V.10 + Sanjay Rath's commentary,
 * *Jaimini Maharishi's Upadesa Sutras* (Sagar Publications, for the
 * 8-variant). See `notes/phase34e-jaimini-research.md` for the full
 * source-attribution + fixture cross-validation derivation.
 *
 * @param chart    Natal D1 chart from `computeRashiChart`.
 * @param options  Optional. `{ variant: '8-jaimini' }` selects the
 *                 8-Karaka Jaimini variant; omitted or
 *                 `{ variant: '7-parashara' }` returns the 7-Karaka
 *                 Parashara default.
 * @returns        A {@link JaiminiKarakas} (7-variant default) or
 *                 {@link Jaimini8Karakas} (8-variant) record mapping
 *                 every Karaka role to its assigned graha.
 *
 * @example
 * ```typescript
 * import { computeRashiChart, computeJaiminiKarakas } from 'panchang-ts';
 *
 * const chart = computeRashiChart(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 *
 * // 7-Karaka Parashara (default).
 * const k7 = computeJaiminiKarakas(chart);
 * k7.Atmakaraka;  // e.g. 'Saturn'
 *
 * // 8-Karaka Jaimini (opt-in).
 * const k8 = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
 * k8.Atmakaraka;     // e.g. 'Saturn'
 * k8.Pitrukaraka;    // e.g. 'Jupiter' — only present on the 8-variant
 * ```
 */
export function computeJaiminiKarakas(chart: BirthChart): JaiminiKarakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options: { variant: '7-parashara' },
): JaiminiKarakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options: { variant: '8-jaimini' },
): Jaimini8Karakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options?: ComputeJaiminiKarakasOptions,
): JaiminiKarakas | Jaimini8Karakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options?: ComputeJaiminiKarakasOptions,
): JaiminiKarakas | Jaimini8Karakas {
  const planetByName = {} as Record<GrahaName, PlanetPlacement>;
  for (const p of chart.planets) planetByName[p.planet] = p;

  if (options?.variant === '8-jaimini') {
    // Effective degree: Rahu reversed (30 − degreeInRashi), others as-is.
    // Build the input array in canonical 8-graha order so a stable sort
    // preserves the documented tie-break (Rahu loses every tie).
    const ranked = VISIBLE_GRAHAS_8.map((g) => ({
      graha: g,
      degree: g === 'Rahu'
        ? 30 - planetByName[g].degreeInRashi
        : planetByName[g].degreeInRashi,
    }));
    ranked.sort((a, b) => b.degree - a.degree);

    const result = {} as Jaimini8Karakas;
    for (let i = 0; i < KARAKA_8_ORDER.length; i++) {
      result[KARAKA_8_ORDER[i]!] = ranked[i]!.graha;
    }
    return result;
  }

  // Default: 7-Karaka Parashara variant. Build the input array in
  // canonical order so a stable sort preserves the documented tie-break:
  // equal degrees → earlier-in-VISIBLE_GRAHAS wins.
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
