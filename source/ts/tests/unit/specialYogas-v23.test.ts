
import { describe, it, expect } from 'vitest';
import { computeSpecialYogas } from '../../src/core/specialYogas';
import { TOTAL_NAKSHATRAS } from '../../src/utils/constants';

const r = (type: string) => type;

const activeYogas = (
  vara: number, tithi: number, moonNak: number, sunNak: number,
) => computeSpecialYogas(vara, tithi, moonNak, sunNak, r).map((y) => y.type);

describe('Dwipushkar Yoga', () => {
  it('detects Sunday + Dwitiya + Mrigashira', () => {
    expect(activeYogas(0, 1, 4, 4)).toContain('dwipushkar');
  });

  it('detects Saturday + Krishna Saptami (tithi 21, number 7) + Chitra (13)', () => {
    expect(activeYogas(6, 21, 13, 13)).toContain('dwipushkar');
  });

  it('detects Tuesday + Dwadashi + Dhanishtha (22)', () => {
    expect(activeYogas(2, 11, 22, 22)).toContain('dwipushkar');
  });

  it('does not fire on a non-Bhadra vara (Monday)', () => {
    expect(activeYogas(1, 1, 4, 4)).not.toContain('dwipushkar');
  });

  it('does not fire on a non-Bhadra tithi (Pratipada)', () => {
    expect(activeYogas(0, 0, 4, 4)).not.toContain('dwipushkar');
  });

  it('does not fire on a Tripushkar nakshatra (Krittika)', () => {
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
    expect(activeYogas(0, 1, 4, 4)).not.toContain('tripushkar');
  });

  it('does not fire on a non-Bhadra vara (Wednesday)', () => {
    expect(activeYogas(3, 1, 15, 15)).not.toContain('tripushkar');
  });

  it('does not fire on a non-Bhadra tithi (Tritiya)', () => {
    expect(activeYogas(0, 2, 15, 15)).not.toContain('tripushkar');
  });
});

describe('Jwalamukhi Yoga', () => {
  it('detects Pratipada + Mula', () => {
    expect(activeYogas(0, 0, 18, 18)).toContain('jwalamukhi');
  });

  it('detects Krishna Panchami + Bharani', () => {
    expect(activeYogas(3, 19, 1, 1)).toContain('jwalamukhi');
  });

  it('detects Ashtami + Krittika across either paksha', () => {
    expect(activeYogas(0, 7, 2, 2)).toContain('jwalamukhi');
    expect(activeYogas(0, 22, 2, 2)).toContain('jwalamukhi');
  });

  it('does not fire on tithi+nakshatra pairs absent from the 5-row table', () => {
    expect(activeYogas(0, 0, 1, 1)).not.toContain('jwalamukhi');
    expect(activeYogas(0, 9, 18, 18)).not.toContain('jwalamukhi');
  });

  it('does not fire on Trayodashi+Ardra (a regional variant not adopted)', () => {
    expect(activeYogas(0, 12, 5, 5)).not.toContain('jwalamukhi');
  });
});

describe('Aadal Yoga', () => {
  it('detects Sun-at-Ashwini + Moon-at-Bharani (distance 2)', () => {
    expect(activeYogas(3, 5, 1, 0)).toContain('aadal');
  });

  it('detects Abhijit-shifted distance: Sun-at-Ashwini + Moon-at-Shravana (28-pos 23)', () => {
    expect(activeYogas(3, 5, 21, 0)).toContain('aadal');
  });

  it('does not fire when distance lands on a Vidaal slot (3)', () => {
    expect(activeYogas(3, 5, 2, 0)).not.toContain('aadal');
  });

  it('does not fire at distance 1 (Sun and Moon share a nakshatra)', () => {
    expect(activeYogas(3, 5, 7, 7)).not.toContain('aadal');
  });

  it('vara-independent: fires on Saturday too', () => {
    expect(activeYogas(6, 5, 1, 0)).toContain('aadal');
  });
});

describe('Vidaal Yoga', () => {
  it('detects Sun-at-Ashwini + Moon-at-Krittika (distance 3)', () => {
    expect(activeYogas(3, 5, 2, 0)).toContain('vidaal');
  });

  it('detects Abhijit-shifted distance: Sun-at-Ashwini + Moon-at-Dhanishtha (28-pos 24)', () => {
    expect(activeYogas(3, 5, 22, 0)).toContain('vidaal');
  });

  it('does not fire when distance lands on an Aadal slot (2)', () => {
    expect(activeYogas(3, 5, 1, 0)).not.toContain('vidaal');
  });

  it('does not fire at distance 1 (same nakshatra)', () => {
    expect(activeYogas(3, 5, 7, 7)).not.toContain('vidaal');
  });

  it('vara-independent: fires on Wednesday', () => {
    expect(activeYogas(3, 5, 2, 0)).toContain('vidaal');
  });
});

describe('Ravi Yoga', () => {
  it('detects distance 4 (Sun-at-Ashwini + Moon-at-Rohini)', () => {
    expect(activeYogas(0, 5, 3, 0)).toContain('ravi');
  });

  it('detects distance 13 (Sun-at-Ashwini + Moon-at-Hasta)', () => {
    expect(activeYogas(0, 5, 12, 0)).toContain('ravi');
  });

  it('vara-independent: fires on a Tuesday too (distance set, not weekday)', () => {
    expect(activeYogas(2, 5, 3, 0)).toContain('ravi');
  });

  it('does not fire at non-Ravi distances', () => {
    expect(activeYogas(0, 5, 1, 0)).not.toContain('ravi');
    expect(activeYogas(0, 5, 4, 0)).not.toContain('ravi');
  });

  it('does not fire at distance 1 (same nakshatra)', () => {
    expect(activeYogas(0, 5, 7, 7)).not.toContain('ravi');
  });

  it('does not fire on Ravi Pushya (which is a separate yoga)', () => {
    const types = activeYogas(0, 5, 7, 7);
    expect(types).toContain('ravi_pushya');
    expect(types).not.toContain('ravi');
  });
});

describe('input validation: ranges', () => {
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
    const types = activeYogas(0, 1, 4, 4);
    expect(types).toContain('dwipushkar');
    expect(types).not.toContain('tripushkar');
  });

  it('uses the name resolver for translated names', () => {
    const yogas = computeSpecialYogas(0, 0, 18, 18, (t) => `T:${t}`);
    expect(yogas.find((y) => y.type === 'jwalamukhi')?.name).toBe('T:jwalamukhi');
  });
});
