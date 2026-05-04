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

/**
 * Pratyantar dasha — the third (sub-sub) level in the Vimshottari hierarchy.
 * Each antardasha is divided into 9 pratyantars proportionally; the first
 * pratyantar's lord is the antardasha lord, then the cycle continues.
 */
export interface PratyantarDasha {
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

// ── Lagna (Ascendant) ────────────────────────────────

/**
 * Lagna — the sidereal ecliptic longitude rising on the eastern horizon at a
 * given instant + location. The foundation of any Vedic birth chart: house
 * cusps, divisional charts, and most strength/aspect calculations are anchored
 * to lagna.
 *
 * Algorithm: Meeus *Astronomical Algorithms* eq. 13.6 (atan2 form), tropical
 * → sidereal by subtracting the configured ayanamsa.
 */
export interface LagnaInfo {
  /** Sidereal ecliptic longitude in degrees, range [0, 360). */
  siderealLongitude: number;
  /** Zodiac sign the ascendant occupies (0 = Mesha … 11 = Meena). */
  rashi: RashiInfo;
  /** Degrees within the rashi, range [0, 30). */
  degreeInRashi: number;
  /** Nakshatra index (0 = Ashwini … 26 = Revati) and localized name. */
  nakshatra: { index: number; name: string };
  /** Pada (1..4) within the nakshatra. */
  pada: number;
}

// ── Bhava (Houses) ───────────────────────────────────

/**
 * One of the twelve houses (bhavas) in a Vedic birth chart. The cusp longitude
 * defines where the house *begins* in zodiacal order; the house spans up to
 * the next cusp longitude.
 *
 * For `'whole-sign'` houses the cusp falls at exactly 0° of the corresponding
 * rashi. For `'equal'` it falls at the lagna's exact degree within each rashi.
 * For `'placidus-kp'` it is the iteratively-solved cusp longitude.
 */
export interface HouseInfo {
  /** House number 1..12, where house 1 is the ascendant. */
  house: number;
  /** Sidereal ecliptic longitude of the cusp in degrees, [0, 360). */
  cuspLongitude: number;
  /** Zodiac sign at the cusp (0 = Mesha … 11 = Meena). */
  rashi: RashiInfo;
  /** Degrees within the cusp's rashi, [0, 30). */
  degreeInRashi: number;
}

/**
 * The 12 house cusps for a birth chart, plus the ascendant/MC longitudes for
 * convenient access. `system` records which house system was used.
 */
export interface BhavaChart {
  /** Configured house system. */
  system: 'whole-sign' | 'equal' | 'placidus-kp';
  /** 12 houses in order (index 0 = house 1 = ascendant). */
  houses: HouseInfo[];
  /** Sidereal ascendant longitude, [0, 360). Same as `houses[0].cuspLongitude`. */
  ascendantLongitude: number;
  /**
   * Sidereal Midheaven (10th cusp) longitude, [0, 360). For `'whole-sign'` and
   * `'equal'` systems the MC is not a literal cusp; the value is provided as
   * an informational anchor (the rashi 10 houses from lagna for whole-sign;
   * lagna + 270° for equal).
   */
  mcLongitude: number;
}

// ── Birth chart (D1) and divisional charts ───────────

/**
 * One graha's placement in a chart (D1 or divisional).
 *
 * For D1 (rashi chart) the longitude/degree fields carry the natal sidereal
 * position. For divisional charts (D9, etc.) they carry the *transformed*
 * position in the divisional frame.
 */
export interface PlanetPlacement {
  planet: GrahaName;
  /** Sidereal longitude in this chart's frame, [0, 360). */
  longitude: number;
  /** Zodiac sign (0 = Mesha … 11 = Meena). */
  rashi: RashiInfo;
  /** Degrees within the rashi, [0, 30). */
  degreeInRashi: number;
  /** House (1..12) from the chart's lagna. House system follows the chart context. */
  house: number;
  /** Retrograde at the natal moment. Sun, Moon, Rahu, Ketu have a fixed value. */
  isRetrograde: boolean;
}

/**
 * Full natal D1 (Rashi) chart — sidereal lagna, bhava cusps under the
 * configured house system, and 9 graha placements with house assignments.
 */
export interface BirthChart {
  divisional: 'D1';
  lagna: LagnaInfo;
  bhava: BhavaChart;
  planets: PlanetPlacement[];
}

/**
 * Divisional chart (D9 / Navamsa, future D2/D3/…). Always whole-sign anchored
 * to the divisional lagna — divisional charts in classical Vedic practice are
 * sign-based, not cuspal.
 */
export interface DivisionalChart {
  divisional: 'D9';
  /** Divisional lagna rashi (chart-relative house 1). */
  lagnaRashi: RashiInfo;
  /** 9 grahas placed in divisional rashis with whole-sign house numbers. */
  planets: PlanetPlacement[];
}

// ── Mangal Dosha (Manglik) ────────────────────────────

/**
 * Mangal Dosha (Manglik) is the classical malefic affliction caused by Mars
 * in houses 1, 2, 4, 7, 8, or 12 from any of three reference points: lagna,
 * Moon, or Venus. The "three cuts" are scored independently; if any flags
 * affliction the native is considered manglik unless a cancellation applies.
 *
 * Common cancellations: Mars in its own sign (Aries / Scorpio) or exalted
 * (Capricorn). Other cancellations (mutual mangalik, Mars/Jupiter aspect,
 * etc.) are not applied here — see README for the documented scope.
 */
export interface MangalDoshaInfo {
  /** Final affliction status after applying cancellations. */
  afflicted: boolean;
  fromLagna: { afflicted: boolean; house: number };
  fromMoon:  { afflicted: boolean; house: number };
  fromVenus: { afflicted: boolean; house: number };
  /** Cancellations that were applied. Empty when none triggered. */
  cancellations: string[];
}

// ── Sade Sati ─────────────────────────────────────────

/**
 * Sade Sati — the 7.5-year period during which transit Saturn passes
 * through the 12th, 1st, and 2nd rashis from the native's natal Moon.
 *
 * Phases:
 *   1 — Saturn in 12th rashi from natal Moon (rising arc)
 *   2 — Saturn in natal Moon's rashi (peak)
 *   3 — Saturn in 2nd rashi from natal Moon (descending arc)
 *
 * Arc boundaries are determined from Saturn's apparent (true) sidereal
 * longitude with a stability window to handle retrograde re-crossings of
 * rashi boundaries.
 */
export interface SadeSatiInfo {
  /** True when Saturn is currently in the Sade Sati arc relative to natal Moon. */
  active: boolean;
  /** Phase 1, 2, or 3 if `active`; null otherwise. */
  phase: 1 | 2 | 3 | null;
  /** Start date of the current 7.5-year arc (null when not active). */
  currentArcStart: Date | null;
  /** End date of the current 7.5-year arc (null when not active). */
  currentArcEnd: Date | null;
  /** Start date of the next arc — only set when not currently active. */
  nextArcStart: Date | null;
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
