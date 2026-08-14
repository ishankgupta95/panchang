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
 * The five Rajju (rope) groups, classed by where on the body the rope-knot
 * is said to fall. Same-Rajju matches are classically considered a strong
 * veto — repetition of the same rajju is held to threaten the husband's
 * longevity.
 *
 * The ladder starts at the FEET: Ashwini is Pada, the bands climb
 * Pada → Kati → Nabhi → Kantha to the single-nakshatra peak Sira at
 * Mrigashira, then mirror back down to Pada at Ashlesha; the 9-nakshatra
 * half-cycle (Pada, Kati, Nabhi, Kantha, Sira, Kantha, Nabhi, Kati, Pada)
 * repeats three times. That yields the canonical groups every published
 * table agrees on — Pada: Ashwini, Ashlesha, Magha, Jyeshtha, Mula,
 * Revati; Sira: Mrigashira, Chitra, Dhanishtha ONLY (AstroVed Rajju
 * Porutham, ProKerala, Hindu-Blog Rajju Kootta, all fetched 2026-08-13).
 * An earlier revision ran the ladder upside-down (Ashwini at Sira), which
 * is not a relabeling: the peak-vs-valley doubling differs, so same-rajju
 * verdicts flipped for pairs like Mrigashira–Ardra and Rohini–Ardra.
 *
 * Some Telugu / Malayali traditions use slightly different groupings;
 * those regional variants are not modelled here (PLAN.md "Out of scope
 * for Wave 4").
 */
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

/**
 * Vedha (obstruction) pairs — nakshatras that obstruct each other across
 * the zodiac. Same-vedha matches are considered a strong veto in Tamil
 * tradition.
 *
 * The canonical published table (13 pairs; verified 2026-08-13 against
 * two independent porutham references — the "10 Porutham" compatibility
 * guide and PriestServices' star-matching table, agreeing with Jataka
 * Parijata's enumeration). **Chitra (13) is the one nakshatra with no
 * Vedha partner.** An earlier revision used a tidy mirror-symmetric
 * enumeration (pairs summing to 17 / 44, Dhanishtha unpaired) that
 * matched the real table on only its first four rows — the classical
 * list is not symmetric.
 *
 * The table is unordered — `vedhaOf(a)` returns whichever nakshatra is
 * on the other side of the pair, or null if `a` has no Vedha partner.
 */
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
  // Chitra (13) has no Vedha partner in the canonical table.
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
 * Auspicious Mahendra distances — 1-indexed nakshatra distance counted
 * from the GIRL's nakshatra to the boy's (the classical direction, and
 * the one `scoreMahendra` implements). Per AstroVed Mahendra Porutham:
 * favorable distances are 4, 7, 10, 13, 16, 19, 22, and 25. The set is
 * closed under d → 29 − d, so the verdict happens to be
 * direction-independent.
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
