/**
 * Unit tests for Vimshottari Dasha calculation.
 *
 * Verifies:
 *   - 120-year total cycle
 *   - Correct dasha lord sequence
 *   - Balance calculation from Moon's nakshatra position
 *   - Antardasha proportional subdivision
 *   - Edge cases (nakshatra boundaries, zero balance)
 */

import { describe, it, expect } from 'vitest';
import {
  computeVimshottariDasha,
  DASHA_YEARS,
  DASHA_ORDER,
  NAKSHATRA_LORD,
} from '../../src/jyotish/dasha';

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

// Birth: 1990-05-15T10:30:00Z — Moon at ~116° sidereal (Ashlesha nakshatra, idx=8)
const BIRTH_DATE = new Date('1990-05-15T10:30:00Z');
const MOON_LON_ASHLESHA = 116.0; // Mid-Ashlesha (index 8, 8*13.333=106.67, range 106.67-120)

// Moon at exact start of Ashwini (0°) — Ketu dasha, full balance
const MOON_LON_ASHWINI_START = 0.0;

// Moon at end of Ashwini (~13.33°) — Ketu dasha, nearly zero balance
const MOON_LON_ASHWINI_END = 13.33;

describe('Vimshottari Dasha constants', () => {
  it('DASHA_YEARS total is exactly 120', () => {
    const total = DASHA_ORDER.reduce((sum, lord) => sum + DASHA_YEARS[lord], 0);
    expect(total).toBe(120);
  });

  it('DASHA_ORDER has 9 lords', () => {
    expect(DASHA_ORDER).toHaveLength(9);
  });

  it('DASHA_ORDER starts with Ketu', () => {
    expect(DASHA_ORDER[0]).toBe('Ketu');
  });

  it('NAKSHATRA_LORD has 27 entries', () => {
    expect(NAKSHATRA_LORD).toHaveLength(27);
  });

  it('NAKSHATRA_LORD cycles through 9 lords 3 times', () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let i = 0; i < 9; i++) {
        expect(NAKSHATRA_LORD[cycle * 9 + i]).toBe(DASHA_ORDER[i]);
      }
    }
  });

  it('Ashwini (0) is ruled by Ketu', () => {
    expect(NAKSHATRA_LORD[0]).toBe('Ketu');
  });

  it('Bharani (1) is ruled by Venus', () => {
    expect(NAKSHATRA_LORD[1]).toBe('Venus');
  });

  it('Pushya (7) is ruled by Saturn', () => {
    expect(NAKSHATRA_LORD[7]).toBe('Saturn');
  });

  it('Ashlesha (8) is ruled by Mercury', () => {
    expect(NAKSHATRA_LORD[8]).toBe('Mercury');
  });
});

describe('computeVimshottariDasha', () => {
  describe('basic structure', () => {
    const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHLESHA);

    it('returns 9 mahadashas', () => {
      expect(result.mahaDashas).toHaveLength(9);
    });

    it('first mahadasha starts at birth date', () => {
      expect(result.mahaDashas[0]!.startDate.getTime()).toBe(BIRTH_DATE.getTime());
    });

    it('mahadashas are contiguous (no gaps)', () => {
      for (let i = 1; i < result.mahaDashas.length; i++) {
        const prevEnd = result.mahaDashas[i - 1]!.endDate.getTime();
        const currStart = result.mahaDashas[i]!.startDate.getTime();
        expect(Math.abs(prevEnd - currStart)).toBeLessThan(1); // < 1ms
      }
    });

    it('each full mahadasha has 9 antardashas; the first (partial) has 1..9', () => {
      // The first mahadasha is a partial balance: antardashas run full-length
      // from the pre-birth virtual start and only those after birth are shown.
      expect(result.mahaDashas[0]!.antarDashas.length).toBeGreaterThanOrEqual(1);
      expect(result.mahaDashas[0]!.antarDashas.length).toBeLessThanOrEqual(9);
      for (let i = 1; i < result.mahaDashas.length; i++) {
        expect(result.mahaDashas[i]!.antarDashas).toHaveLength(9);
      }
    });

    it('antardashas within each mahadasha are contiguous', () => {
      for (const md of result.mahaDashas) {
        for (let i = 1; i < md.antarDashas.length; i++) {
          const prevEnd = md.antarDashas[i - 1]!.endDate.getTime();
          const currStart = md.antarDashas[i]!.startDate.getTime();
          expect(Math.abs(prevEnd - currStart)).toBeLessThan(1);
        }
      }
    });

    it('first antardasha of each mahadasha starts with mahadasha start', () => {
      for (const md of result.mahaDashas) {
        expect(md.antarDashas[0]!.startDate.getTime()).toBe(md.startDate.getTime());
      }
    });

    it('last antardasha of each mahadasha ends near mahadasha end', () => {
      for (const md of result.mahaDashas) {
        const lastAD = md.antarDashas[md.antarDashas.length - 1]!;
        expect(Math.abs(lastAD.endDate.getTime() - md.endDate.getTime())).toBeLessThan(1000);
      }
    });
  });

  describe('lord sequence for Moon in Ashlesha (idx 8 → Mercury)', () => {
    const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHLESHA);

    it('first mahadasha lord is Mercury (Ashlesha ruler)', () => {
      expect(result.mahaDashas[0]!.lord).toBe('Mercury');
    });

    it('follows correct cycle: Me→Ke→Ve→Su→Mo→Ma→Ra→Ju→Sa', () => {
      const expectedSequence = ['Mercury', 'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn'];
      for (let i = 0; i < 9; i++) {
        expect(result.mahaDashas[i]!.lord).toBe(expectedSequence[i]);
      }
    });
  });

  describe('balance calculation', () => {
    it('Moon at start of Ashwini (0°) → full Ketu dasha (7 years)', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHWINI_START);
      expect(result.mahaDashas[0]!.lord).toBe('Ketu');
      const durationYears =
        (result.mahaDashas[0]!.endDate.getTime() - result.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
      expect(durationYears).toBeCloseTo(7, 1);
    });

    it('Moon at end of Ashwini (~13.33°) → nearly zero Ketu balance', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHWINI_END);
      expect(result.mahaDashas[0]!.lord).toBe('Ketu');
      const durationYears =
        (result.mahaDashas[0]!.endDate.getTime() - result.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
      // Nearly 0 balance
      expect(durationYears).toBeLessThan(0.1);
    });

    it('Moon at mid-Ashwini (6.67°) → ~3.5 years Ketu balance', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, 6.6667);
      expect(result.mahaDashas[0]!.lord).toBe('Ketu');
      const durationYears =
        (result.mahaDashas[0]!.endDate.getTime() - result.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
      expect(durationYears).toBeCloseTo(3.5, 0);
    });
  });

  describe('total duration approximates 120 years', () => {
    const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHWINI_START);

    it('total span from first start to last end is ~120 years', () => {
      const firstStart = result.mahaDashas[0]!.startDate.getTime();
      const lastEnd = result.mahaDashas[8]!.endDate.getTime();
      const totalYears = (lastEnd - firstStart) / MS_PER_YEAR;
      expect(totalYears).toBeCloseTo(120, 0);
    });
  });

  describe('antardasha proportional correctness', () => {
    // Full Venus mahadasha = 20 years. First AD = Venus/Venus = (20/120)*20 = 3.33 years
    it('Venus/Venus antardasha ≈ 3.33 years', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHWINI_START);
      // Find the Venus mahadasha (it's the 2nd one for Ashwini birth)
      const venusMD = result.mahaDashas.find(md => md.lord === 'Venus');
      expect(venusMD).toBeDefined();
      const venusAD = venusMD!.antarDashas.find(ad => ad.lord === 'Venus');
      expect(venusAD).toBeDefined();
      const adYears =
        (venusAD!.endDate.getTime() - venusAD!.startDate.getTime()) / MS_PER_YEAR;
      expect(adYears).toBeCloseTo(3.333, 1);
    });

    it('Ketu/Ketu antardasha ≈ 0.408 years (7*7/120)', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHWINI_START);
      const ketuMD = result.mahaDashas[0]!;
      expect(ketuMD.lord).toBe('Ketu');
      const ketuAD = ketuMD.antarDashas[0]!;
      expect(ketuAD.lord).toBe('Ketu');
      const adYears =
        (ketuAD.endDate.getTime() - ketuAD.startDate.getTime()) / MS_PER_YEAR;
      expect(adYears).toBeCloseTo(7 * 7 / 120, 1);
    });
  });

  describe('antardasha lord sequence', () => {
    it('antardashas start with the mahadasha lord', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHWINI_START);
      for (const md of result.mahaDashas) {
        expect(md.antarDashas[0]!.lord).toBe(md.lord);
      }
    });

    it('antardasha lords follow the dasha cycle from the mahadasha lord', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHWINI_START);
      for (const md of result.mahaDashas) {
        const startIdx = DASHA_ORDER.indexOf(md.lord);
        for (let i = 0; i < 9; i++) {
          const expectedLord = DASHA_ORDER[(startIdx + i) % 9];
          expect(md.antarDashas[i]!.lord).toBe(expectedLord);
        }
      }
    });
  });

  describe('currentMahaDashaLord', () => {
    it('returns a valid dasha lord for current time', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHLESHA);
      expect(DASHA_ORDER).toContain(result.currentMahaDashaLord);
    });

    it('currentIndex is in [0, 8]', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHLESHA);
      expect(result.currentIndex).toBeGreaterThanOrEqual(0);
      expect(result.currentIndex).toBeLessThanOrEqual(8);
    });
  });

  describe('edge case: all 27 nakshatras produce valid dasha', () => {
    const NAKSHATRA_SPAN = 13.333333333333334;

    for (let i = 0; i < 27; i++) {
      it(`nakshatra ${i} (mid-point) produces valid dasha`, () => {
        const moonLon = i * NAKSHATRA_SPAN + NAKSHATRA_SPAN / 2;
        const result = computeVimshottariDasha(BIRTH_DATE, moonLon);
        expect(result.mahaDashas).toHaveLength(9);
        expect(result.mahaDashas[0]!.lord).toBe(NAKSHATRA_LORD[i]);
      });
    }
  });
});
