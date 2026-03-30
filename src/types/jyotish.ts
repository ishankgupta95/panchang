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
