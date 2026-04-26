/**
 * Unit tests for the six v2.3 yogas added in Phase 28-6:
 *   Dwipushkar, Tripushkar, Jwalamukhi, Aadal, Vidaal, Ravi.
 *
 * Each yoga gets one positive fixture plus negatives that vary every input
 * dimension (vara / tithi / moon-nakshatra / sun-nakshatra) to confirm the
 * detector keys off only the dimensions it should.
 *
 * Conventions:
 *   varaIndex          0 = Sun … 6 = Sat
 *   tithiIndex         0 = Shukla Pratipada … 14 = Purnima … 29 = Amavasya
 *   nakshatraIndex     0 = Ashwini … 26 = Revati  (Moon)
 *   suryaNakshatraIndex 0 = Ashwini … 26 = Revati (Sun)
 */

import { describe, it, expect } from 'vitest';
import { computeSpecialYogas } from '../../src/core/specialYogas';
import { TOTAL_NAKSHATRAS } from '../../src/utils/constants';

const r = (type: string) => type;

// Helper: yoga types active for the given inputs.
const activeYogas = (
  vara: number, tithi: number, moonNak: number, sunNak: number,
) => computeSpecialYogas(vara, tithi, moonNak, sunNak, r).map((y) => y.type);

describe('Dwipushkar Yoga', () => {
  // Sunday + Dwitiya (Bhadra-tithi 2) + Mrigashira(4) — three Bhadra varas
  // {0,2,6} × Bhadra tithis {2,7,12} × dwi-pada nakshatras {4,13,22}.
  it('detects Sunday + Dwitiya + Mrigashira', () => {
    expect(activeYogas(0, 1, 4, 4)).toContain('dwipushkar');
  });

  it('detects Saturday + Krishna Saptami (tithi 21, number 7) + Chitra (13)', () => {
    // Krishna Saptami → tithiIndex = 15 + 6 = 21, paksha-number = 7
    expect(activeYogas(6, 21, 13, 13)).toContain('dwipushkar');
  });

  it('detects Tuesday + Dwadashi + Dhanishtha (22)', () => {
    // tithiIndex 11 = Shukla Dwadashi, number 12
    expect(activeYogas(2, 11, 22, 22)).toContain('dwipushkar');
  });

  it('does not fire on a non-Bhadra vara (Monday)', () => {
    expect(activeYogas(1, 1, 4, 4)).not.toContain('dwipushkar');
  });

  it('does not fire on a non-Bhadra tithi (Pratipada)', () => {
    expect(activeYogas(0, 0, 4, 4)).not.toContain('dwipushkar');
  });

  it('does not fire on a Tripushkar nakshatra (Krittika)', () => {
    // All other inputs would qualify, but nakshatra 2 is Tripushkar's, not Dwipushkar's.
    expect(activeYogas(0, 1, 2, 2)).not.toContain('dwipushkar');
  });
});

describe('Tripushkar Yoga', () => {
  it('detects Tuesday + Saptami + Vishakha (15)', () => {
    expect(activeYogas(2, 6, 15, 15)).toContain('tripushkar');
  });

  it('detects Sunday + Dwitiya + Krittika (2)', () => {
    expect(activeYogas(0, 1, 2, 2)).toContain('tripushkar');
  });

  it('detects Saturday + Dwadashi + Uttara Phalguni (11)', () => {
    expect(activeYogas(6, 11, 11, 11)).toContain('tripushkar');
  });

  it('does not fire on a Dwipushkar nakshatra (Mrigashira)', () => {
    // Same vara/tithi as Dwipushkar fixture but with a Tripushkar-only nakshatra.
    expect(activeYogas(0, 1, 4, 4)).not.toContain('tripushkar');
  });

  it('does not fire on a non-Bhadra vara (Wednesday)', () => {
    expect(activeYogas(3, 1, 15, 15)).not.toContain('tripushkar');
  });

  it('does not fire on a non-Bhadra tithi (Tritiya)', () => {
    // tithiIndex 2 → number 3, not in {2,7,12}
    expect(activeYogas(0, 2, 15, 15)).not.toContain('tripushkar');
  });
});

describe('Jwalamukhi Yoga', () => {
  // Table is {1:Mula, 5:Bharani, 8:Krittika, 9:Rohini, 10:Ashlesha} —
  // tithi-number-in-paksha → nakshatra index.
  it('detects Pratipada + Mula', () => {
    expect(activeYogas(0, 0, 18, 18)).toContain('jwalamukhi');
  });

  it('detects Krishna Panchami + Bharani', () => {
    // tithiIndex 19 = Krishna Panchami, number 5 → nakshatra 1 (Bharani)
    expect(activeYogas(3, 19, 1, 1)).toContain('jwalamukhi');
  });

  it('detects Ashtami + Krittika across either paksha', () => {
    // Shukla Ashtami: tithiIndex 7, number 8 → Krittika (2)
    expect(activeYogas(0, 7, 2, 2)).toContain('jwalamukhi');
    // Krishna Ashtami: tithiIndex 22, number 8
    expect(activeYogas(0, 22, 2, 2)).toContain('jwalamukhi');
  });

  it('does not fire on tithi+nakshatra pairs absent from the 5-row table', () => {
    // Pratipada + Bharani — tithi number matches a row but nakshatra does not.
    expect(activeYogas(0, 0, 1, 1)).not.toContain('jwalamukhi');
    // Dashami + Mula — nakshatra matches Pratipada's row but tithi does not.
    expect(activeYogas(0, 9, 18, 18)).not.toContain('jwalamukhi');
  });

  it('does not fire on Trayodashi+Ardra (a regional variant not adopted)', () => {
    // Some almanacs add this 6th row; we follow the canonical 5-row Muhurta-chintamani table.
    expect(activeYogas(0, 12, 5, 5)).not.toContain('jwalamukhi');
  });
});

describe('Aadal Yoga', () => {
  // Distance-from-Sun in 28-scheme (with Abhijit). distance set: {2,7,9,14,16,21,23,28}.
  it('detects Sun-at-Ashwini + Moon-at-Bharani (distance 2)', () => {
    expect(activeYogas(3, 5, 1, 0)).toContain('aadal');
  });

  it('detects Abhijit-shifted distance: Sun-at-Ashwini + Moon-at-Shravana (28-pos 23)', () => {
    // Without Abhijit insertion this would be distance 22 (not in set).
    // With Abhijit between UAshadha (20) and Shravana (21), Shravana's 28-pos is 23.
    expect(activeYogas(3, 5, 21, 0)).toContain('aadal');
  });

  it('does not fire when distance lands on a Vidaal slot (3)', () => {
    expect(activeYogas(3, 5, 2, 0)).not.toContain('aadal');
  });

  it('does not fire at distance 1 (Sun and Moon share a nakshatra)', () => {
    expect(activeYogas(3, 5, 7, 7)).not.toContain('aadal');
  });

  it('vara-independent — fires on Saturday too', () => {
    expect(activeYogas(6, 5, 1, 0)).toContain('aadal');
  });
});

describe('Vidaal Yoga', () => {
  // Distance set: {3, 6, 10, 13, 17, 20, 24, 27} in 28-scheme.
  it('detects Sun-at-Ashwini + Moon-at-Krittika (distance 3)', () => {
    expect(activeYogas(3, 5, 2, 0)).toContain('vidaal');
  });

  it('detects Abhijit-shifted distance: Sun-at-Ashwini + Moon-at-Dhanishtha (28-pos 24)', () => {
    // Without Abhijit this would be distance 23 (not in set).
    expect(activeYogas(3, 5, 22, 0)).toContain('vidaal');
  });

  it('does not fire when distance lands on an Aadal slot (2)', () => {
    expect(activeYogas(3, 5, 1, 0)).not.toContain('vidaal');
  });

  it('does not fire at distance 1 (same nakshatra)', () => {
    expect(activeYogas(3, 5, 7, 7)).not.toContain('vidaal');
  });

  it('vara-independent — fires on Wednesday', () => {
    expect(activeYogas(3, 5, 2, 0)).toContain('vidaal');
  });
});

describe('Ravi Yoga', () => {
  // Distance set: {4, 6, 9, 10, 13, 20} in 27-scheme (Abhijit NOT counted).
  it('detects distance 4 (Sun-at-Ashwini + Moon-at-Rohini)', () => {
    expect(activeYogas(0, 5, 3, 0)).toContain('ravi');
  });

  it('detects distance 13 (Sun-at-Ashwini + Moon-at-Hasta)', () => {
    expect(activeYogas(0, 5, 12, 0)).toContain('ravi');
  });

  it('vara-independent — fires on a Tuesday too (distance set, not weekday)', () => {
    // Per DrikPanchang convention there is no Sunday filter on Ravi Yoga.
    expect(activeYogas(2, 5, 3, 0)).toContain('ravi');
  });

  it('does not fire at non-Ravi distances', () => {
    // distance27 = 2 (Bharani from Ashwini) — not in {4,6,9,10,13,20}.
    expect(activeYogas(0, 5, 1, 0)).not.toContain('ravi');
    // distance27 = 5 (Mrigashira from Ashwini)
    expect(activeYogas(0, 5, 4, 0)).not.toContain('ravi');
  });

  it('does not fire at distance 1 (same nakshatra)', () => {
    expect(activeYogas(0, 5, 7, 7)).not.toContain('ravi');
  });

  it('does not fire on Ravi Pushya (which is a separate yoga)', () => {
    // Sunday + Pushya, but Sun also at Pushya → distance 1, no Ravi Yoga.
    // Ravi Pushya should still be active.
    const types = activeYogas(0, 5, 7, 7);
    expect(types).toContain('ravi_pushya');
    expect(types).not.toContain('ravi');
  });
});

describe('input validation — ranges', () => {
  it('throws RangeError for negative varaIndex', () => {
    expect(() => computeSpecialYogas(-1, 0, 0, 0, r)).toThrow(RangeError);
  });

  it('throws RangeError for varaIndex >= 7', () => {
    expect(() => computeSpecialYogas(7, 0, 0, 0, r)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer varaIndex', () => {
    expect(() => computeSpecialYogas(1.5, 0, 0, 0, r)).toThrow(RangeError);
  });

  it('throws RangeError for negative tithiIndex', () => {
    expect(() => computeSpecialYogas(0, -1, 0, 0, r)).toThrow(RangeError);
  });

  it('throws RangeError for tithiIndex >= 30', () => {
    expect(() => computeSpecialYogas(0, 30, 0, 0, r)).toThrow(RangeError);
  });

  it('throws RangeError for nakshatraIndex >= 27', () => {
    expect(() => computeSpecialYogas(0, 0, TOTAL_NAKSHATRAS, 0, r)).toThrow(RangeError);
  });

  it('throws RangeError for negative suryaNakshatraIndex', () => {
    expect(() => computeSpecialYogas(0, 0, 0, -1, r)).toThrow(RangeError);
  });

  it('throws RangeError for suryaNakshatraIndex >= 27', () => {
    expect(() => computeSpecialYogas(0, 0, 0, TOTAL_NAKSHATRAS, r)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer suryaNakshatraIndex', () => {
    expect(() => computeSpecialYogas(0, 0, 0, 3.5, r)).toThrow(RangeError);
  });
});

describe('multi-yoga emission', () => {
  it('Dwipushkar + Tripushkar are mutually exclusive (different nakshatra sets)', () => {
    const types = activeYogas(0, 1, 4, 4); // Mrigashira (Dwipushkar)
    expect(types).toContain('dwipushkar');
    expect(types).not.toContain('tripushkar');
  });

  it('uses the name resolver for translated names', () => {
    const yogas = computeSpecialYogas(0, 0, 18, 18, (t) => `T:${t}`);
    expect(yogas.find((y) => y.type === 'jwalamukhi')?.name).toBe('T:jwalamukhi');
  });
});
