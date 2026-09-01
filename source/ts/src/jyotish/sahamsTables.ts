/**
 * Tajik Sahams. Day/night swaps pin Neelakantha's *Tajika Neelakanthi* (1587);
 * rows absent from the shorter published tables follow Sanjay Rath, *Crux of
 * Vedic Astrology* (Tajik appendix).
 */

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
  readonly name: SahamName;
  /** Operands of `(x − y + z) mod 360°`. */
  readonly x: SahamOperand;
  readonly y: SahamOperand;
  readonly z: SahamOperand;
  /** Swap x and y for night birth. */
  readonly swap: boolean;
}

/** Order matters: rows referencing `Punya` must follow Punya's row. */
export const SAHAM_FORMULAS: readonly SahamFormula[] = [
  { name: 'Punya',       x: 'Moon',        y: 'Sun',     z: 'Asc',         swap: true  },
  { name: 'Vidya',       x: 'Sun',         y: 'Moon',    z: 'Asc',         swap: true  },
  { name: 'Yasas',       x: 'Jupiter',     y: 'Punya',   z: 'Asc',         swap: true  },
  { name: 'Mitra',       x: 'Jupiter',     y: 'Punya',   z: 'Venus',       swap: true  },
  { name: 'Karma',       x: 'Mars',        y: 'Mercury', z: 'Asc',         swap: true  },
  { name: 'Vivaha',      x: 'Venus',       y: 'Saturn',  z: 'Asc',         swap: false },
  { name: 'Putra',       x: 'Jupiter',     y: 'Moon',    z: 'Asc',         swap: false },
  { name: 'Roga',        x: 'Saturn',      y: 'Moon',    z: 'Asc',         swap: true  },
  { name: 'Marana',      x: 'Saturn',      y: 'Moon',    z: 'Asc',         swap: false },
  { name: 'Rajya',       x: 'Saturn',      y: 'Sun',     z: 'Asc',         swap: true  },
  { name: 'Raja',        x: 'Sun',         y: 'Mars',    z: 'Asc',         swap: false },
  { name: 'Bandhu',      x: 'Mercury',     y: 'Moon',    z: 'Asc',         swap: true  },
  { name: 'Dharma',      x: 'Sun',         y: 'Jupiter', z: 'Asc',         swap: false },
  { name: 'Gnati',       x: 'Mars',        y: 'Moon',    z: 'Asc',         swap: true  },
  { name: 'Apamrityu',   x: 'Mars',        y: 'Saturn',  z: 'Asc',         swap: false },
  { name: 'Bhratri',     x: 'Jupiter',     y: 'Saturn',  z: 'Asc',         swap: false },
  { name: 'Matri',       x: 'Moon',        y: 'Venus',   z: 'Asc',         swap: true  },
  { name: 'Pitri',       x: 'Saturn',      y: 'Sun',     z: 'Asc',         swap: true  },
  { name: 'Sama',        x: 'Sun',         y: 'Saturn',  z: 'Asc',         swap: false },
  { name: 'Bandhana',    x: 'Saturn',      y: 'Mars',    z: 'Mercury',     swap: false },
  { name: 'Karyasiddhi', x: 'Saturn',      y: 'Sun',     z: 'AscLord',     swap: false },
  { name: 'Vyapara',     x: 'Mars',        y: 'Saturn',  z: 'AscLord',     swap: false },
  { name: 'Sastra',      x: 'Jupiter',     y: 'Saturn',  z: 'Mercury',     swap: false },
  { name: 'Asha',        x: 'Mercury',     y: 'Saturn',  z: 'Asc',         swap: false },
  { name: 'Labha',       x: 'House11Cusp', y: 'AscLord', z: 'Asc',         swap: false },
  { name: 'Susha',       x: 'Saturn',      y: 'Punya',   z: 'Asc',         swap: true  },
  { name: 'Tapas',       x: 'Sun',         y: 'Saturn',  z: 'Mercury',     swap: false },
];

export const ALL_SAHAM_NAMES: readonly SahamName[] = SAHAM_FORMULAS.map((f) => f.name);
