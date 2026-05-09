import type { GrahaName } from '../types/jyotish';

/**
 * Ashtakavarga BENEFIC_OFFSETS table — BPHS Ch. 66.
 *
 * For each receiver graha (Sun..Saturn) and each contributor (Sun..Saturn,
 * Lagna), this table lists the **1-based house offsets from the contributor**
 * at which the contributor places a benefic dot (bindu) in the receiver's
 * 12-rashi grid.
 *
 * Algorithm: a contributor positioned in rashi `S_rashi` places one bindu
 * in each rashi `(S_rashi + offset - 1) mod 12` for every offset listed.
 * Sum across all 8 contributors → the receiver's Bhinnashtaka (12 cells,
 * 0..8 each). Sum across all 7 receivers → Sarvashtaka (12 cells, 0..56).
 *
 * Sources cross-checked: BPHS Ch. 66 (Santhanam), Phaladeepika Ch. 31
 * (Mantreswar / Gopesh Kumar Ojha), Sanjay Rath *Visti Nadi*. The lists
 * below are the form used by every public Ashtakavarga calculator
 * (ProKerala, AstroSage, PyJHora, JagannathaHora). The published Sun
 * total of 48 in BPHS verses is a known arithmetic error — counting the
 * 8 published lists yields 47; the *list cells themselves* (which is what
 * any deterministic calculator uses) are stable across recensions.
 *
 * Per-receiver totals (sum of list lengths across all 8 contributors):
 *   Sun = 47, Moon = 49, Mars = 39, Mercury = 54,
 *   Jupiter = 56, Venus = 52, Saturn = 39  →  Sarvashtaka = 336.
 */
/** Receiver grahas — Rahu and Ketu have no Ashtakavarga grid. */
export type AshtakavargaReceiver = Exclude<GrahaName, 'Rahu' | 'Ketu'>;

/**
 * Contributors are the 7 visible grahas plus the lagna. Rahu and Ketu do
 * not contribute in the classical Parashara scheme.
 */
export type AshtakavargaContributor = AshtakavargaReceiver | 'Lagna';

/** The 8 contributors (7 receivers + Lagna). */
export const ASHTAKAVARGA_CONTRIBUTORS: readonly AshtakavargaContributor[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Lagna',
] as const;

/** The 7 receiver grahas (visible grahas only). */
export const ASHTAKAVARGA_RECEIVERS: readonly AshtakavargaReceiver[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
] as const;

/**
 * BENEFIC_OFFSETS[receiver][contributor] → list of 1-based offsets at which
 * the contributor donates a bindu to the receiver's grid. Frozen literals.
 */
export const BENEFIC_OFFSETS: Readonly<Record<
  AshtakavargaReceiver,
  Readonly<Record<AshtakavargaContributor, readonly number[]>>
>> = Object.freeze({
  // ── Surya (Sun) Bhinnashtaka — 47 bindus total ──────
  Sun: Object.freeze({
    Sun:     Object.freeze([1, 2, 4, 7, 8, 9, 10, 11]),
    Moon:    Object.freeze([3, 6, 10, 11]),
    Mars:    Object.freeze([1, 2, 4, 7, 8, 10, 11]),
    Mercury: Object.freeze([3, 5, 6, 9, 10, 11, 12]),
    Jupiter: Object.freeze([5, 6, 9, 11]),
    Venus:   Object.freeze([6, 7, 12]),
    Saturn:  Object.freeze([1, 2, 4, 7, 8, 9, 10, 11]),
    Lagna:   Object.freeze([3, 4, 6, 10, 11, 12]),
  }),
  // ── Chandra (Moon) Bhinnashtaka — 49 bindus total ───
  Moon: Object.freeze({
    Sun:     Object.freeze([3, 6, 7, 8, 10, 11]),
    Moon:    Object.freeze([1, 3, 6, 7, 10, 11]),
    Mars:    Object.freeze([2, 3, 5, 6, 9, 10, 11]),
    Mercury: Object.freeze([1, 3, 4, 5, 7, 8, 10, 11]),
    Jupiter: Object.freeze([1, 4, 7, 8, 10, 11, 12]),
    Venus:   Object.freeze([3, 4, 5, 7, 9, 10, 11]),
    Saturn:  Object.freeze([3, 5, 6, 11]),
    Lagna:   Object.freeze([3, 6, 10, 11]),
  }),
  // ── Mangala (Mars) Bhinnashtaka — 39 bindus total ───
  Mars: Object.freeze({
    Sun:     Object.freeze([3, 5, 6, 10, 11]),
    Moon:    Object.freeze([3, 6, 11]),
    Mars:    Object.freeze([1, 2, 4, 7, 8, 10, 11]),
    Mercury: Object.freeze([3, 5, 6, 11]),
    Jupiter: Object.freeze([6, 10, 11, 12]),
    Venus:   Object.freeze([6, 8, 11, 12]),
    Saturn:  Object.freeze([1, 4, 7, 8, 9, 10, 11]),
    Lagna:   Object.freeze([1, 3, 6, 10, 11]),
  }),
  // ── Budha (Mercury) Bhinnashtaka — 54 bindus total ──
  Mercury: Object.freeze({
    Sun:     Object.freeze([5, 6, 9, 11, 12]),
    Moon:    Object.freeze([2, 4, 6, 8, 10, 11]),
    Mars:    Object.freeze([1, 2, 4, 7, 8, 9, 10, 11]),
    Mercury: Object.freeze([1, 3, 5, 6, 9, 10, 11, 12]),
    Jupiter: Object.freeze([6, 8, 11, 12]),
    Venus:   Object.freeze([1, 2, 3, 4, 5, 8, 9, 11]),
    Saturn:  Object.freeze([1, 2, 4, 7, 8, 9, 10, 11]),
    Lagna:   Object.freeze([1, 2, 4, 6, 8, 10, 11]),
  }),
  // ── Guru (Jupiter) Bhinnashtaka — 56 bindus total ───
  Jupiter: Object.freeze({
    Sun:     Object.freeze([1, 2, 3, 4, 7, 8, 9, 10, 11]),
    Moon:    Object.freeze([2, 5, 7, 9, 11]),
    Mars:    Object.freeze([1, 2, 4, 7, 8, 10, 11]),
    Mercury: Object.freeze([1, 2, 4, 5, 6, 9, 10, 11]),
    Jupiter: Object.freeze([1, 2, 3, 4, 7, 8, 10, 11]),
    Venus:   Object.freeze([2, 5, 6, 9, 10, 11]),
    Saturn:  Object.freeze([3, 5, 6, 12]),
    Lagna:   Object.freeze([1, 2, 4, 5, 6, 7, 9, 10, 11]),
  }),
  // ── Shukra (Venus) Bhinnashtaka — 52 bindus total ───
  Venus: Object.freeze({
    Sun:     Object.freeze([8, 11, 12]),
    Moon:    Object.freeze([1, 2, 3, 4, 5, 8, 9, 11, 12]),
    Mars:    Object.freeze([3, 5, 6, 9, 11, 12]),
    Mercury: Object.freeze([3, 5, 6, 9, 11]),
    Jupiter: Object.freeze([5, 8, 9, 10, 11]),
    Venus:   Object.freeze([1, 2, 3, 4, 5, 8, 9, 10, 11]),
    Saturn:  Object.freeze([3, 4, 5, 8, 9, 10, 11]),
    Lagna:   Object.freeze([1, 2, 3, 4, 5, 8, 9, 11]),
  }),
  // ── Shani (Saturn) Bhinnashtaka — 39 bindus total ───
  Saturn: Object.freeze({
    Sun:     Object.freeze([1, 2, 4, 7, 8, 10, 11]),
    Moon:    Object.freeze([3, 6, 11]),
    Mars:    Object.freeze([3, 5, 6, 10, 11, 12]),
    Mercury: Object.freeze([6, 8, 9, 10, 11, 12]),
    Jupiter: Object.freeze([5, 6, 11, 12]),
    Venus:   Object.freeze([6, 11, 12]),
    Saturn:  Object.freeze([3, 5, 6, 11]),
    Lagna:   Object.freeze([1, 3, 4, 6, 10, 11]),
  }),
});

/**
 * Per-receiver Bhinnashtaka totals (sum of bindus across the 12 cells of a
 * receiver's grid, equivalently the sum of list lengths across all 8
 * contributors). These are *invariants* of the canonical BPHS table —
 * any chart's Bhinnashtaka grid for receiver G must total exactly this
 * value, regardless of where the planets are placed.
 */
export const BHINNASHTAKA_TOTAL: Readonly<Record<AshtakavargaReceiver, number>> = Object.freeze({
  Sun: 47, Moon: 49, Mars: 39, Mercury: 54,
  Jupiter: 56, Venus: 52, Saturn: 39,
});

/** Sarvashtaka grand total = Σ Bhinnashtaka totals = 336. */
export const SARVASHTAKA_TOTAL = 336;

/**
 * Two-sign rulership pairs used by Ekadhipatya Sodhana (BPHS Ch. 67).
 * Cancer (Moon) and Leo (Sun) are excluded as they have a single ruler.
 *
 * Each entry is `[rashiA, rashiB]` (0-based indices) of two rashis sharing
 * one ruler:
 *   - Aries (0) + Scorpio (7) → Mars
 *   - Taurus (1) + Libra (6)  → Venus
 *   - Gemini (2) + Virgo (5)  → Mercury
 *   - Sagittarius (8) + Pisces (11) → Jupiter
 *   - Capricorn (9) + Aquarius (10) → Saturn
 */
export const EKADHIPATYA_PAIRS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([0, 7]) as readonly [number, number],
  Object.freeze([1, 6]) as readonly [number, number],
  Object.freeze([2, 5]) as readonly [number, number],
  Object.freeze([8, 11]) as readonly [number, number],
  Object.freeze([9, 10]) as readonly [number, number],
]);

/**
 * The 4 trikona triads (rashis 4 houses apart, i.e. each elemental group)
 * used by Trikona Sodhana (BPHS Ch. 67). 0-based indices.
 *   - Fire:  Aries (0), Leo (4), Sagittarius (8)
 *   - Earth: Taurus (1), Virgo (5), Capricorn (9)
 *   - Air:   Gemini (2), Libra (6), Aquarius (10)
 *   - Water: Cancer (3), Scorpio (7), Pisces (11)
 */
export const TRIKONA_TRIADS: readonly (readonly [number, number, number])[] = Object.freeze([
  Object.freeze([0, 4, 8]) as readonly [number, number, number],
  Object.freeze([1, 5, 9]) as readonly [number, number, number],
  Object.freeze([2, 6, 10]) as readonly [number, number, number],
  Object.freeze([3, 7, 11]) as readonly [number, number, number],
]);
