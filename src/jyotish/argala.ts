import type {
  ArgalaPerBhava, BirthChart, PlanetPlacement,
} from '../types/jyotish';

/** Houses-from-bhava that count as Argala (intervention / help). 2nd, 4th, 11th. */
const ARGALA_OFFSETS: readonly number[] = [1, 3, 10]; // 0-based: 2 → 1, 4 → 3, 11 → 10
/** Houses-from-bhava that count as Virodhargala (counter-intervention). 3rd, 10th, 12th. */
const VIRODHARGALA_OFFSETS: readonly number[] = [2, 9, 11];

/**
 * Compute the per-bhava Argala (intervention / help) and Virodhargala
 * (counter-intervention) lists for a natal chart, **primary form only**.
 *
 * **Rule** (per Jaimini *Upadesa Sutras* Ch. 1, BPHS Ch. 51 — Primary
 * Argala only):
 *
 *   - Planets in the **2nd / 4th / 11th** from a bhava form *Argala* —
 *     a positive sign-based influence on that bhava.
 *   - Planets in the **3rd / 10th / 12th** from a bhava form
 *     *Virodhargala* — counter-intervention that negates Argala.
 *
 * The rule is pure house arithmetic on `chart.planets[i].house`, with
 * houses 1..12 indexed modulo 12. All 9 grahas (Sun..Saturn + Rahu +
 * Ketu) participate; benefic / malefic distinction is not applied here
 * — the caller can filter the returned lists if their tradition
 * requires it.
 *
 * **NOT modelled — Trikonargala (Secondary Argala, 5th + 9th).**
 * Classical Jaimini practice (per Iranganti Rangacharya, AstroVeda
 * Wikidot, and IndianAstrologyArticles) also recognises the 5th from a
 * bhava as **Trikonargala** (Secondary Argala) and the 9th as its
 * Virodha counterpart. The classical text further notes that the
 * benefic-malefic balance and "Virodhargala obstructs only when equal
 * or stronger than Argala" qualifications also apply. None of these
 * secondary rules are applied here. Callers who need full Jaimini
 * Argala analysis should layer their own logic on top of `chart.planets`.
 *
 * **Structural invariant.** Under this primary-only form each planet
 * contributes to **exactly 6** bhavas (3 Argala + 3 Virodhargala) —
 * the assertion the test suite pins. The 3rd, 10th, and 12th from a
 * bhava are mutually exclusive with the 2nd, 4th, and 11th, so a
 * planet's position determines a 6-cell partition over the bhava wheel.
 *
 * @param chart  Natal D1 chart from `computeRashiChart`.
 * @returns      An array of 12 entries, one per bhava in 1..12 order.
 *               Each entry has the bhava number, the list of Argala
 *               planets, and the list of Virodhargala planets.
 *
 * @example
 * ```typescript
 * import { computeRashiChart, computeArgala } from 'panchang-ts';
 *
 * const chart = computeRashiChart(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * const argala = computeArgala(chart);
 * argala[0]!.bhava;             // 1
 * argala[0]!.argala;            // PlanetPlacement[] in 2nd/4th/11th from lagna
 * argala[0]!.virodhargala;      // PlanetPlacement[] in 3rd/10th/12th from lagna
 * argala[6]!.argala.length;     // count of Argala planets on the 7th bhava
 * ```
 */
export function computeArgala(chart: BirthChart): ArgalaPerBhava[] {
  const planets = chart.planets;

  const out: ArgalaPerBhava[] = [];
  for (let bhava = 1; bhava <= 12; bhava++) {
    const argala: PlanetPlacement[] = [];
    const virodhargala: PlanetPlacement[] = [];

    for (const p of planets) {
      // 0-based offset (planet's house relative to bhava): 0 = same house,
      // 1 = next, …, 11 = previous. The Argala rule uses 0-based offsets
      // 1 (2nd from bhava), 3 (4th), 10 (11th); Virodhargala uses 2, 9, 11.
      const offset = ((p.house - bhava) + 12) % 12;
      if (ARGALA_OFFSETS.includes(offset)) {
        argala.push(p);
      } else if (VIRODHARGALA_OFFSETS.includes(offset)) {
        virodhargala.push(p);
      }
    }

    out.push({ bhava, argala, virodhargala });
  }
  return out;
}
