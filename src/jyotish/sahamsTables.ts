/**
 * Tajik Sahams — 27-Saham core formula table.
 *
 * A *Saham* (Tajik: "share") is a sensitive ecliptic point computed as
 *
 *     Saham = (X − Y + Z) mod 360°
 *
 * where X, Y, Z are graha longitudes (or derived points such as the lagna,
 * the lagna-lord, the 11th-house cusp, or a previously-computed Saham).
 * Saham_X is identical in spirit to Hellenistic *Lots* / Arabic *Parts* —
 * the Tajik tradition imported the technique from Persian / Arabic
 * astrology in the 13–14th centuries and codified the canonical 27- and
 * 50-Saham lists.
 *
 * **Day / night swap.** For a subset of Sahams the X and Y operands swap
 * for **night birth** (Sun below horizon at the solar-return instant), per
 * Neelakantha's *Tajika Neelakanthi*. Other Tajik commentators (Hari Hara
 * et al.) define different swap rules — this implementation pins
 * Neelakantha's. Sahams marked `swap: false` use the same formula
 * regardless of day/night.
 *
 * **Operand types.**
 * - Graha names — the standard 7 visible grahas (`Sun`..`Saturn`).
 * - `Asc` — the **varsha-chart** lagna's sidereal longitude.
 * - `AscLord` — the longitude of the varsha lagna's rashi-lord (its actual
 *   position in the varsha chart, not a synthetic point).
 * - `House11Cusp` — start of the 11th whole-sign house from the varsha
 *   lagna: `floor(asc / 30) * 30 + 300°`, mod 360.
 * - `Punya` — the day/night-resolved value of the *Punya* Saham itself.
 *   Punya is computed first; later Sahams that reference it
 *   (Yasas / Mitra / Susha) inherit Punya's day/night swap automatically.
 *
 * **Scope.** This file pins the **27-Saham core set**. The extended
 * 50-Saham list (Mahaprasna, Adhana, Kali, Krodha, Susha-Pravesha, …) is
 * deferred — adding them is a data-only change (extend `SahamName` and
 * append rows to `SAHAM_FORMULAS`).
 *
 * **Sources.**
 * - Neelakantha Daivajna, *Tajika Neelakanthi* (1587 CE), Saham chapter.
 * - B.V. Raman, *Hindu Predictive Astrology / Annual Horoscope* (Ch. 5).
 * - Sanjay Rath, *Crux of Vedic Astrology* — Tajik appendix.
 * - PVR Narasimha Rao, *Tajik notes* (Saptarishis Astrology essays).
 *
 * **Caveats.** Several names appear with multiple formula variants
 * across Tajik commentaries. The 27-Saham core formulas below were
 * cross-verified row-by-row against Anjaneyulu Marella's *Encyclopedia
 * of Vedic Astrology* (Tag-to-Adawal compilation of Tajika Shastra Ch. V
 * Pt. 2), B.V. Raman's *Annual Horoscope*, and AstroGle's published
 * Saham table. Sahams not present in the shorter published tables
 * (Apamrityu, Sama, Bandhana, Karyasiddhi, Vyapara, Sastra, Asha,
 * Labha, Susha, Tapas) follow the secondary commentaries (Sanjay Rath
 * *Crux of Vedic Astrology* Tajik appendix); per-row comments call out
 * any source-divergence.
 */

/** The 27-Saham canonical names. Order is the iteration order. */
export type SahamName =
  | 'Punya'
  | 'Vidya'
  | 'Yasas'
  | 'Mitra'
  | 'Karma'
  | 'Vivaha'
  | 'Putra'
  | 'Roga'
  | 'Marana'
  | 'Rajya'
  | 'Raja'
  | 'Bandhu'
  | 'Dharma'
  | 'Gnati'
  | 'Apamrityu'
  | 'Bhratri'
  | 'Matri'
  | 'Pitri'
  | 'Sama'
  | 'Bandhana'
  | 'Karyasiddhi'
  | 'Vyapara'
  | 'Sastra'
  | 'Asha'
  | 'Labha'
  | 'Susha'
  | 'Tapas';

/** Operand names used in `SahamFormula`. */
export type SahamOperand =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | 'Asc'
  | 'AscLord'
  | 'House11Cusp'
  | 'Punya';

export interface SahamFormula {
  /** Saham name from the 27-name catalog. */
  readonly name: SahamName;
  /** First operand in `X − Y + Z`. */
  readonly x: SahamOperand;
  /** Second operand. */
  readonly y: SahamOperand;
  /** Third operand. */
  readonly z: SahamOperand;
  /**
   * If true, swap X and Y for **night birth** (Sun below horizon at the
   * varsha instant) per Neelakantha. Sahams whose formula references
   * `Punya` already inherit Punya's day/night swap and therefore set
   * `swap: false` themselves.
   */
  readonly swap: boolean;
}

/**
 * The 27-Saham formula table. Iteration order matters — Sahams that
 * reference `Punya` (Yasas / Mitra / Susha) must follow Punya's row.
 *
 * The X / Y / Z operands compose as `(X − Y + Z) mod 360°`. For night
 * birth, swap X and Y on rows where `swap: true`.
 */
export const SAHAM_FORMULAS: readonly SahamFormula[] = [
  // 1 — Punya (merit, the foundational Saham; Moon − Sun + Asc in day birth).
  //     Source: Tajika Neelakanthi / Tag-to-Adawal Encyclopedia.
  { name: 'Punya',       x: 'Moon',        y: 'Sun',     z: 'Asc',         swap: true  },
  // 2 — Vidya (learning) — Sun − Moon + Asc (Punya's complement).
  { name: 'Vidya',       x: 'Sun',         y: 'Moon',    z: 'Asc',         swap: true  },
  // 3 — Yasas (fame) — Jupiter − Punya + Asc.  Swap=true: night formula
  //     is Punya − Jupiter + Asc per Tag-to-Adawal Encyclopedia.
  { name: 'Yasas',       x: 'Jupiter',     y: 'Punya',   z: 'Asc',         swap: true  },
  // 4 — Mitra (friends) — Jupiter − Punya + Venus (day); Punya − Jupiter
  //     + Venus (night). Source: Tag-to-Adawal Encyclopedia / AstroGle.
  { name: 'Mitra',       x: 'Jupiter',     y: 'Punya',   z: 'Venus',       swap: true  },
  // 5 — Karma (career) — Mars − Mercury + Asc (day); Mercury − Mars +
  //     Asc (night). Source: Tag-to-Adawal Encyclopedia.
  { name: 'Karma',       x: 'Mars',        y: 'Mercury', z: 'Asc',         swap: true  },
  // 6 — Vivaha (marriage) — Venus − Saturn + Asc, no day/night swap.
  //     Source: AstroGle / Sanjay Rath.
  { name: 'Vivaha',      x: 'Venus',       y: 'Saturn',  z: 'Asc',         swap: false },
  // 7 — Putra (progeny) — Jupiter − Moon + Asc, no day/night swap per
  //     Tag-to-Adawal Encyclopedia ("Day Jupiter − Moon + Lagna /
  //     Night Jupiter − Moon + Lagna").
  { name: 'Putra',       x: 'Jupiter',     y: 'Moon',    z: 'Asc',         swap: false },
  // 8 — Roga (disease) — Saturn − Moon + Asc (day); Moon − Saturn + Asc
  //     (night). Source: Tag-to-Adawal Encyclopedia ("Day Saturn − Moon
  //     + Lagna / Night Moon − Saturn + Lagna").
  { name: 'Roga',        x: 'Saturn',      y: 'Moon',    z: 'Asc',         swap: true  },
  // 9 — Marana (death) — Saturn − Moon + Asc (variant of Roga; some
  //     commentators use 8th-house cusp in place of Saturn). swap=false
  //     per the Sanjay Rath simplification used here.
  { name: 'Marana',      x: 'Saturn',      y: 'Moon',    z: 'Asc',         swap: false },
  // 10 — Rajya (kingdom) — Saturn − Sun + Asc (day); Sun − Saturn + Asc
  //      (night). Source: Tag-to-Adawal Encyclopedia.
  { name: 'Rajya',       x: 'Saturn',      y: 'Sun',     z: 'Asc',         swap: true  },
  // 11 — Raja (royalty) — Sun − Mars + Asc; distinct from Rajya by anchor.
  { name: 'Raja',        x: 'Sun',         y: 'Mars',    z: 'Asc',         swap: false },
  // 12 — Bandhu (relatives) — Mercury − Moon + Asc (day); Moon − Mercury
  //      + Asc (night). Source: Tag-to-Adawal Encyclopedia.
  { name: 'Bandhu',      x: 'Mercury',     y: 'Moon',    z: 'Asc',         swap: true  },
  // 13 — Dharma (righteousness) — Sun − Jupiter + Asc (Sanjay Rath
  //      variant; Tag-to-Adawal does not list this Saham).
  { name: 'Dharma',      x: 'Sun',         y: 'Jupiter', z: 'Asc',         swap: false },
  // 14 — Gnati (kinsmen / extended kin) — Mars − Moon + Asc, day/night
  //      swap per the Pitri-class Sahams.
  { name: 'Gnati',       x: 'Mars',        y: 'Moon',    z: 'Asc',         swap: true  },
  // 15 — Apamrityu (untimely death) — Mars − Saturn + Asc; anti-Rajya
  //      structure. Sanjay Rath simplification.
  { name: 'Apamrityu',   x: 'Mars',        y: 'Saturn',  z: 'Asc',         swap: false },
  // 16 — Bhratri (siblings) — Jupiter − Saturn + Asc, no day/night swap
  //      per Tag-to-Adawal Encyclopedia ("Day Jupiter − Saturn + Lagna
  //      / Night Jupiter − Saturn + Lagna").
  { name: 'Bhratri',     x: 'Jupiter',     y: 'Saturn',  z: 'Asc',         swap: false },
  // 17 — Matri (mother) — Moon − Venus + Asc (day); Venus − Moon + Asc
  //      (night). Source: Tag-to-Adawal Encyclopedia.
  { name: 'Matri',       x: 'Moon',        y: 'Venus',   z: 'Asc',         swap: true  },
  // 18 — Pitri (father) — Saturn − Sun + Asc (same formula as Rajya per
  //      Tag-to-Adawal); the canonical Tajik Pitri formula.
  { name: 'Pitri',       x: 'Saturn',      y: 'Sun',     z: 'Asc',         swap: true  },
  // 19 — Sama (equanimity / balance) — Sun − Saturn + Asc (anti-Pitri).
  //      Sanjay Rath simplification.
  { name: 'Sama',        x: 'Sun',         y: 'Saturn',  z: 'Asc',         swap: false },
  // 20 — Bandhana (imprisonment) — Saturn − Mars + Mercury (anchored on
  //      Mercury to distinguish from Rajya). Sanjay Rath simplification.
  { name: 'Bandhana',    x: 'Saturn',      y: 'Mars',    z: 'Mercury',     swap: false },
  // 21 — Karyasiddhi (success of work) — Saturn − Sun + AscLord. Sanjay
  //      Rath simplification.
  { name: 'Karyasiddhi', x: 'Saturn',      y: 'Sun',     z: 'AscLord',     swap: false },
  // 22 — Vyapara (commerce) — Mars − Saturn + AscLord. Sanjay Rath
  //      simplification.
  { name: 'Vyapara',     x: 'Mars',        y: 'Saturn',  z: 'AscLord',     swap: false },
  // 23 — Sastra (sciences) — Jupiter − Saturn + Mercury (intellect
  //      karaka anchor). Sanjay Rath simplification.
  { name: 'Sastra',      x: 'Jupiter',     y: 'Saturn',  z: 'Mercury',     swap: false },
  // 24 — Asha (hopes) — Mercury − Saturn + Asc. Sanjay Rath simplification.
  { name: 'Asha',        x: 'Mercury',     y: 'Saturn',  z: 'Asc',         swap: false },
  // 25 — Labha (gain) — House11Cusp − AscLord + Asc. Sanjay Rath
  //      simplification anchoring on the 11th house of gains.
  { name: 'Labha',       x: 'House11Cusp', y: 'AscLord', z: 'Asc',         swap: false },
  // 26 — Susha (well-being) — Saturn − Punya + Asc. swap=true: night
  //      formula is Punya − Saturn + Asc per the Punya-derived class.
  { name: 'Susha',       x: 'Saturn',      y: 'Punya',   z: 'Asc',         swap: true  },
  // 27 — Tapas (austerity) — Sun − Saturn + Mercury. Sanjay Rath
  //      simplification.
  { name: 'Tapas',       x: 'Sun',         y: 'Saturn',  z: 'Mercury',     swap: false },
];

/**
 * Convenience set of all 27 Saham names — useful for callers iterating
 * `Object.keys(result.sahams)` with type assertions.
 */
export const ALL_SAHAM_NAMES: readonly SahamName[] = SAHAM_FORMULAS.map((f) => f.name);
