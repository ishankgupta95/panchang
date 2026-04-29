import type { NakshatraInfo, RashiInfo } from './elements';

// ── Graha (planetary) positions ──────────────────────

export type GrahaName =
  | 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn'
  | 'Rahu' | 'Ketu';

export interface GrahaPosition {
  /** Planet name in English */
  planet: GrahaName;
  /** Sidereal ecliptic longitude in degrees [0, 360) */
  siderealLongitude: number;
  /** Zodiac sign the planet occupies */
  rashi: RashiInfo;
  /** Degrees within the sign [0, 30) */
  degreeInRashi: number;
  /** Nakshatra the planet occupies */
  nakshatra: NakshatraInfo;
  /**
   * True when the planet appears to move retrograde (west relative to stars).
   * Always false for Sun and Moon (they never retrograde).
   * Rahu/Ketu are always retrograde by definition.
   */
  isRetrograde: boolean;
}

export interface PlanetaryPositions {
  sun: GrahaPosition;
  moon: GrahaPosition;
  mars: GrahaPosition;
  mercury: GrahaPosition;
  jupiter: GrahaPosition;
  venus: GrahaPosition;
  saturn: GrahaPosition;
  rahu: GrahaPosition;
  ketu: GrahaPosition;
}

// ── Vimshottari Dasha ─────────────────────────────────

export type DashaLord =
  | 'Ketu' | 'Venus' | 'Sun' | 'Moon' | 'Mars'
  | 'Rahu' | 'Jupiter' | 'Saturn' | 'Mercury';

export interface AntarDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
}

export interface MahaDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  /** Duration in years */
  years: number;
  antarDashas: AntarDasha[];
}

export interface VimshottariDashaResult {
  /** The current active Mahadasha lord */
  currentMahaDashaLord: DashaLord;
  /** Index into mahaDashas of the current mahadasha */
  currentIndex: number;
  /**
   * Full 120-year sequence starting from birth.
   * The first entry is the dasha active at birth (possibly mid-cycle).
   */
  mahaDashas: MahaDasha[];
}

// ── Chandra Balam ─────────────────────────────────────

/**
 * Transit Moon strength relative to a native's janma (birth) rashi.
 *
 * Classical Chandra Balam rule (cf. Parashara, BPHS Ch. 3): Moon is **Shubha**
 * (strong / favorable) when transiting houses 1, 3, 6, 7, 10, 11 from the janma
 * rashi, and **Ashubha** (weak / unfavorable) in houses 2, 4, 5, 8, 9, 12. This
 * is the bare house-based rule; some traditions soften it via a parihara
 * (Tara Balam) adjustment not applied here.
 */
export interface ChandraBalamInfo {
  /** 1 = janma rashi itself; 2 = next rashi; … 12 = rashi prior to janma */
  house: number;
  /** Classical quality — 'strong' maps to Shubha, 'weak' to Ashubha */
  quality: 'strong' | 'weak';
  /** Sanskrit transliteration ('Shubha' | 'Ashubha') */
  englishName: string;
  /** Locale-specific name */
  name: string;
}

// ── Tarabala ──────────────────────────────────────────

/**
 * Transit Moon's position in the 9-tara cycle relative to a native's janma
 * (birth) nakshatra.
 *
 * Classical rule (cf. Muhurta-chintamani Ch. 4, BPHS Ch. 71): from the janma
 * nakshatra, the 27 nakshatras divide into nine taras that repeat three times.
 * The cycle, starting with janma itself, is (`taraIndex` is 0-based):
 *
 *   0. Janma     (auspicious, mild caution)
 *   1. Sampat    (auspicious — wealth)
 *   2. Vipat     (inauspicious — calamity)
 *   3. Kshema    (auspicious — well-being)
 *   4. Pratyari  (inauspicious — obstacles)
 *   5. Sadhaka   (auspicious — accomplishment)
 *   6. Vadha     (inauspicious — destruction)
 *   7. Mitra     (auspicious — friend)
 *   8. Ati-Mitra (auspicious — best friend)
 *
 * Three of nine — Vipat (2), Pratyari (4), Vadha (6) — are classed as
 * inauspicious; the other six are auspicious. This module reports that binary
 * quality alongside the tara index and name.
 */
export interface TarabalaInfo {
  /** 0..8 — position in the 9-tara cycle starting from janma nakshatra */
  taraIndex: number;
  /** Sanskrit transliteration: Janma | Sampat | Vipat | Kshema | Pratyari | Sadhaka | Vadha | Mitra | Ati-Mitra */
  englishName: string;
  /** Locale-specific name */
  name: string;
  /** 'inauspicious' for Vipat (2) / Pratyari (4) / Vadha (6); 'auspicious' otherwise */
  quality: 'auspicious' | 'inauspicious';
}
