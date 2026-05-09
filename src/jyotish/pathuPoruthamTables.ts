/**
 * Lookup tables for Pathu Porutham — the Tamil/Kerala 10-fold marriage
 * compatibility test. Used by `computePathuPorutham`. Sources: *Jathaka
 * Tatva* (Tamil), AstroVed.com 10-Porutham reference, ProKerala's free
 * Pathu Porutham implementation as ground truth, drikpanchang.com Tamil
 * porutham panel.
 *
 * Indexing follows the rest of panchang-ts:
 *   - Nakshatra: 0 = Ashwini … 26 = Revati.
 *   - Rashi: 0 = Mesha (Aries) … 11 = Meena (Pisces).
 *
 * Tables that are already shipped for Ashtakoot (NAKSHATRA_YONI,
 * NAKSHATRA_GANA, RASHI_LORD, NAISARGIKA_MAITRI, RASHI_VASHYA,
 * VASHYA_SCORE, YONI_SCORE) are reused via re-export from
 * `matchingTables.ts` rather than duplicated here.
 */

/**
 * The five Rajju (rope) groups, classed by where on the bride's body the
 * rope-knot is said to fall. Same-Rajju matches are classically considered
 * a strong veto — repetition of the same rajju is held to threaten the
 * husband's longevity.
 *
 * Convention used: the standard Tamil Pathu-Porutham 5-band classification
 * (Pada / Kati / Nabhi / Kantha / Sira), arranged so that Ashwini begins
 * the cycle at the head (Sira) and the body bands repeat thrice through
 * the 27 nakshatras with mirrored ascending/descending directions. See
 * AstroVed and ProKerala references.
 *
 * Some Telugu / Malayali traditions use slightly different groupings;
 * those regional variants are not modelled here (PLAN.md "Out of scope
 * for Wave 4").
 */
export type Rajju = 'Pada' | 'Kati' | 'Nabhi' | 'Kantha' | 'Sira';

export const NAKSHATRA_RAJJU: readonly Rajju[] = [
  'Sira',   // 0  Ashwini
  'Kantha', // 1  Bharani
  'Nabhi',  // 2  Krittika
  'Kati',   // 3  Rohini
  'Pada',   // 4  Mrigashira
  'Pada',   // 5  Ardra
  'Kati',   // 6  Punarvasu
  'Nabhi',  // 7  Pushya
  'Kantha', // 8  Ashlesha
  'Sira',   // 9  Magha
  'Kantha', // 10 P. Phalguni
  'Nabhi',  // 11 U. Phalguni
  'Kati',   // 12 Hasta
  'Pada',   // 13 Chitra
  'Pada',   // 14 Swati
  'Kati',   // 15 Vishakha
  'Nabhi',  // 16 Anuradha
  'Kantha', // 17 Jyeshtha
  'Sira',   // 18 Mula
  'Kantha', // 19 P. Ashadha
  'Nabhi',  // 20 U. Ashadha
  'Kati',   // 21 Shravana
  'Pada',   // 22 Dhanishtha
  'Pada',   // 23 Shatabhisha
  'Kati',   // 24 P. Bhadrapada
  'Nabhi',  // 25 U. Bhadrapada
  'Kantha', // 26 Revati
];

/**
 * Vedha (obstruction) pairs — nakshatras that obstruct each other across
 * the zodiac. Same-vedha matches are considered a strong veto in Tamil
 * tradition.
 *
 * Source: *Jathaka Tatva* / AstroVed Vedha Porutham table — 13 mutually
 * exclusive nakshatra pairs covering 26 of the 27 nakshatras (Hasta is
 * sometimes paired with Revati; classical sources differ — we follow the
 * AstroVed enumeration which leaves one nakshatra unpaired in practice).
 *
 * The table is unordered — `vedhaOf(a)` returns whichever nakshatra is
 * on the other side of the pair, or null if `a` has no Vedha partner.
 */
export const VEDHA_PAIRS: readonly (readonly [number, number])[] = [
  [0, 17],  // Ashwini ↔ Jyeshtha
  [1, 16],  // Bharani ↔ Anuradha
  [2, 15],  // Krittika ↔ Vishakha
  [3, 14],  // Rohini ↔ Swati
  [4, 13],  // Mrigashira ↔ Chitra
  [5, 12],  // Ardra ↔ Hasta
  [6, 11],  // Punarvasu ↔ U. Phalguni
  [7, 10],  // Pushya ↔ P. Phalguni
  [8, 9],   // Ashlesha ↔ Magha
  [18, 26], // Mula ↔ Revati
  [19, 25], // P. Ashadha ↔ U. Bhadrapada
  [20, 24], // U. Ashadha ↔ P. Bhadrapada
  [21, 23], // Shravana ↔ Shatabhisha
  // Dhanishtha (22) intentionally unpaired in the AstroVed enumeration.
];

/**
 * Get the vedha-paired nakshatra for `nakIdx`, or `null` if `nakIdx`
 * has no Vedha partner.
 */
export function vedhaOf(nakIdx: number): number | null {
  for (const [a, b] of VEDHA_PAIRS) {
    if (a === nakIdx) return b;
    if (b === nakIdx) return a;
  }
  return null;
}

/**
 * Auspicious Mahendra distances — 1-indexed nakshatra distance from the
 * boy's nakshatra to the girl's, mod 27. Per AstroVed Mahendra Porutham:
 * favorable distances are 4, 7, 10, 13, 16, 19, 22, and 25.
 */
export const MAHENDRA_AUSPICIOUS_DISTANCES: readonly number[] = [
  4, 7, 10, 13, 16, 19, 22, 25,
];

/**
 * Auspicious Dina remainders — the 1-indexed nakshatra distance counted
 * **from the girl's nakshatra to the boy's**, taken mod 9. Per the
 * classical Tamil rule (FindYourFate, AstrologyAtoZ, AstrologyLover) the
 * auspicious mod-9 remainders are `{0, 2, 4, 6, 8}`, corresponding to
 * the auspicious 9-Tara classes used elsewhere in this library
 * (`computeTarabala`):
 *
 *   - remainder 2 → Sampat (good)
 *   - remainder 4 → Kshema (good)
 *   - remainder 6 → Sadhana (good)
 *   - remainder 8 → Mitra (good)
 *   - remainder 0 → Param Mitra (good — the 9th tara wraps to remainder 0)
 *
 * The inauspicious remainders {3 = Vipat, 5 = Pratyari, 7 = Naidhana}
 * fail Dina; remainder 1 (Janma — same nakshatra) is Mixed in the
 * 9-Tara scheme but counted as a fail in the binary Pathu Porutham
 * scoring (a few sources accept Janma matches for specific shared
 * nakshatras under the *Ega Porutham* rule, which is not modelled here).
 */
export const DINA_AUSPICIOUS_REMAINDERS: readonly number[] = [0, 2, 4, 6, 8];

/**
 * Doshic Rashi-distance pairs that fail the Rashi Porutham. These are
 * the 6/8 (Shashtashtaka — death-mutual) and 2/12 distances classically
 * flagged as adverse for Rashi compatibility. Pairs are ordered
 * (d_boy_to_girl, d_girl_to_boy), 1-indexed.
 *
 * Note: this is a subset of the Bhakoot doshic distances used by
 * Ashtakoot — Pathu Porutham's Rashi koot uses the same canonical
 * 6/8 + 2/12 set.
 */
export const RASHI_DOSHIC_DISTANCES: readonly (readonly [number, number])[] = [
  [2, 12], [12, 2],
  [6, 8],  [8, 6],
];
