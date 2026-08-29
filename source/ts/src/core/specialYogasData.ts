/** Amrit Siddhi Yoga: one qualifying Moon-nakshatra per vara (Kalamrita / Muhurta Parijata). */
export const AMRIT_SIDDHI_TABLE: ReadonlyMap<number, number> = new Map([
  [0, 12],  // Sunday    → Hasta
  [1, 4],   // Monday    → Mrigashira
  [2, 0],   // Tuesday   → Ashwini
  [3, 16],  // Wednesday → Anuradha
  [4, 7],   // Thursday  → Pushya
  [5, 26],  // Friday    → Revati
  [6, 3],   // Saturday  → Rohini
]);

/** Recovered from the reference almanac's published windows; where secondary almanacs give Ashlesha for Sunday, the reference almanac's Ashwini stands. */
export const SARVARTHA_SIDDHI_TABLE: ReadonlyMap<number, ReadonlySet<number>> = new Map([
  [0, new Set([0, 7, 11, 12, 18, 20, 25])], // Sunday:    Ashwini, Pushya, UPhalguni, Hasta, Mula, UAshadha, UBhadrapada
  [1, new Set([3, 4, 7, 16, 21])],          // Monday:    Rohini, Mrigashira, Pushya, Anuradha, Shravana
  [2, new Set([0, 2, 8, 25])],              // Tuesday:   Ashwini, Krittika, Ashlesha, UBhadrapada
  [3, new Set([2, 3, 4, 12, 16])],          // Wednesday: Krittika, Rohini, Mrigashira, Hasta, Anuradha
  [4, new Set([0, 6, 7, 16, 26])],          // Thursday:  Ashwini, Punarvasu, Pushya, Anuradha, Revati
  [5, new Set([0, 6, 16, 21, 26])],         // Friday:    Ashwini, Punarvasu, Anuradha, Shravana, Revati
  [6, new Set([3, 14, 21])],                // Saturday:  Rohini, Swati, Shravana
]);

/** Bhadra tithis (Dvitiya, Saptami, Dwadashi), numbered within the paksha. */
export const PUSHKAR_BHADRA_TITHIS: ReadonlySet<number> = new Set([2, 7, 12]);

export const PUSHKAR_VARAS: ReadonlySet<number> = new Set([0, 2, 6]);

/** The "dwi-paada" nakshatras, quarters split across two rashis (Muhurta-chintamani Ch. 6). */
export const DWIPUSHKAR_NAKSHATRAS: ReadonlySet<number> = new Set([4, 13, 22]);

/** The "tri-paada" nakshatras, quarters split across three rashis (Muhurta-chintamani Ch. 6). */
export const TRIPUSHKAR_NAKSHATRAS: ReadonlySet<number> = new Set([2, 6, 11, 15, 20, 24]);

/** Muhurta-chintamani 6.32, keyed on the within-paksha tithi number (1-15), not the global index; either paksha. Regional sixth rows not adopted. */
export const JWALAMUKHI_TABLE: ReadonlyMap<number, ReadonlySet<number>> = new Map([
  [1,  new Set([18])],   // Pratipada + Mula
  [5,  new Set([1])],    // Panchami  + Bharani
  [8,  new Set([2])],    // Ashtami   + Krittika
  [9,  new Set([3])],    // Navami    + Rohini
  [10, new Set([8])],    // Dashami   + Ashlesha
]);

/** 1-based Moon-from-Sun distance in the 28-scheme, Abhijit counted as the 22nd: NOT the weekday × nakshatra subset commentaries describe. */
export const AADAL_DISTANCES: ReadonlySet<number> = new Set([2, 7, 9, 14, 16, 21, 23, 28]);
export const VIDAAL_DISTANCES: ReadonlySet<number> = new Set([3, 6, 10, 13, 17, 20, 24, 27]);

/** 1-based distance in the 27-scheme (Abhijit NOT counted, unlike Aadal/Vidaal); no weekday filter, per the reference almanac, unlike Ravi Pushya. */
export const RAVI_DISTANCES: ReadonlySet<number> = new Set([4, 6, 9, 10, 13, 20]);

/** 27-scheme index → 1-based 28-scheme position, Abhijit inserted as 22. */
export function to28(nak27: number): number {
  return nak27 < 21 ? nak27 + 1 : nak27 + 2;
}
