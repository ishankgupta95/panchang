/** Pathu Porutham lookup tables. Sources: *Jathaka Tatva* (Tamil), AstroVed, the reference almanac's Tamil porutham panel. */

/** The ladder starts at the FEET (Ashwini is Pada) and peaks at Sira; inverting it
 *  is not a relabeling: the peak-vs-valley doubling differs, so verdicts flip. */
export type Rajju = 'Pada' | 'Kati' | 'Nabhi' | 'Kantha' | 'Sira';

export const NAKSHATRA_RAJJU: readonly Rajju[] = [
  'Pada',   // 0  Ashwini
  'Kati',   // 1  Bharani
  'Nabhi',  // 2  Krittika
  'Kantha', // 3  Rohini
  'Sira',   // 4  Mrigashira
  'Kantha', // 5  Ardra
  'Nabhi',  // 6  Punarvasu
  'Kati',   // 7  Pushya
  'Pada',   // 8  Ashlesha
  'Pada',   // 9  Magha
  'Kati',   // 10 P. Phalguni
  'Nabhi',  // 11 U. Phalguni
  'Kantha', // 12 Hasta
  'Sira',   // 13 Chitra
  'Kantha', // 14 Swati
  'Nabhi',  // 15 Vishakha
  'Kati',   // 16 Anuradha
  'Pada',   // 17 Jyeshtha
  'Pada',   // 18 Mula
  'Kati',   // 19 P. Ashadha
  'Nabhi',  // 20 U. Ashadha
  'Kantha', // 21 Shravana
  'Sira',   // 22 Dhanishtha
  'Kantha', // 23 Shatabhisha
  'Nabhi',  // 24 P. Bhadrapada
  'Kati',   // 25 U. Bhadrapada
  'Pada',   // 26 Revati
];

/** Per Jataka Parijata, which is not mirror-symmetric: do not "fix" it to sum to 17. */
export const VEDHA_PAIRS: readonly (readonly [number, number])[] = [
  [0, 17],  // Ashwini ↔ Jyeshtha
  [1, 16],  // Bharani ↔ Anuradha
  [2, 15],  // Krittika ↔ Vishakha
  [3, 14],  // Rohini ↔ Swati
  [4, 22],  // Mrigashira ↔ Dhanishtha
  [5, 21],  // Ardra ↔ Shravana
  [6, 20],  // Punarvasu ↔ U. Ashadha
  [7, 19],  // Pushya ↔ P. Ashadha
  [8, 18],  // Ashlesha ↔ Mula
  [9, 26],  // Magha ↔ Revati
  [10, 25], // P. Phalguni ↔ U. Bhadrapada
  [11, 24], // U. Phalguni ↔ P. Bhadrapada
  [12, 23], // Hasta ↔ Shatabhisha
];

export function vedhaOf(nakIdx: number): number | null {
  for (const [a, b] of VEDHA_PAIRS) {
    if (a === nakIdx) return b;
    if (b === nakIdx) return a;
  }
  return null;
}

/** Auspicious Mahendra distances (girl → boy, 1-indexed) per AstroVed. */
export const MAHENDRA_AUSPICIOUS_DISTANCES: readonly number[] = [
  4, 7, 10, 13, 16, 19, 22, 25,
];

/** Auspicious Dina remainders (distance mod 9): 2 Sampat, 4 Kshema, 6 Sadhana, 8 Mitra, 0 Param Mitra. */
export const DINA_AUSPICIOUS_REMAINDERS: readonly number[] = [0, 2, 4, 6, 8];

/** Rashi Porutham doshic distances, ordered (d_boy_to_girl, d_girl_to_boy), 1-indexed: 6/8 Shashtashtaka and 2/12. */
export const RASHI_DOSHIC_DISTANCES: readonly (readonly [number, number])[] = [
  [2, 12], [12, 2],
  [6, 8],  [8, 6],
];
