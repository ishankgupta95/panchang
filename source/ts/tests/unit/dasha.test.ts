import { describe, it, expect } from 'vitest';
import {
  computeVimshottariDasha,
  computeNarayanDasha,
  DASHA_YEARS,
  DASHA_ORDER,
  NAKSHATRA_LORD,
} from '../../src/jyotish/dasha';
import { PanchangError } from '../../src/types/errors';

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

const BIRTH_DATE = new Date('1990-05-15T10:30:00Z');
const MOON_LON_ASHLESHA = 116.0;

const MOON_LON_ASHWINI_START = 0.0;

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
        expect(Math.abs(prevEnd - currStart)).toBeLessThan(1);
      }
    });

    it('each full mahadasha has 9 antardashas; the first (partial) has 1..9', () => {
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

    it('last antardasha of each mahadasha ends exactly at the mahadasha end', () => {
      for (const md of result.mahaDashas) {
        const lastAD = md.antarDashas[md.antarDashas.length - 1]!;
        expect(lastAD.endDate.getTime()).toBe(md.endDate.getTime());
      }
    });

    it('also when the first mahadasha straddles 1970 (its last antardasha used to overrun by 1 ms)', () => {
      const birth = new Date('1976-09-09T10:50:13.539Z');
      const r = computeVimshottariDasha(birth, 144.13912296295166, birth);
      for (const md of r.mahaDashas) {
        expect(md.antarDashas[md.antarDashas.length - 1]!.endDate.getTime()).toBe(md.endDate.getTime());
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
    it('Venus/Venus antardasha ≈ 3.33 years', () => {
      const result = computeVimshottariDasha(BIRTH_DATE, MOON_LON_ASHWINI_START);
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

describe('asOfDate', () => {
  const BIRTH = new Date('1990-01-01T00:00:00Z');
  const MOON = 100;

  it('selects the mahadasha running at the instant given', () => {
    const atBirth = computeVimshottariDasha(BIRTH, MOON, BIRTH);
    expect(atBirth.currentIndex).toBe(0);

    const later = new Date('2020-01-01T00:00:00Z');
    const at30 = computeVimshottariDasha(BIRTH, MOON, later);
    const expected = at30.mahaDashas.findIndex(
      (md) => later >= md.startDate && later < md.endDate);
    expect(at30.currentIndex).toBe(expected);
    expect(at30.currentIndex).toBeGreaterThan(0);
    expect(at30.currentMahaDashaLord).toBe(at30.mahaDashas[at30.currentIndex]!.lord);
  });

  it('defaults to now, so omitting it is not a behaviour change', () => {
    const omitted = computeVimshottariDasha(BIRTH, MOON);
    const explicitNow = computeVimshottariDasha(BIRTH, MOON, new Date());
    expect(omitted.currentIndex).toBe(explicitNow.currentIndex);
    expect(omitted.currentMahaDashaLord).toBe(explicitNow.currentMahaDashaLord);
  });

  it('rejects an invalid Date rather than silently clamping to index 0', () => {
    expect(() => computeVimshottariDasha(BIRTH, MOON, new Date('nonsense')))
      .toThrow(PanchangError);
    try {
      computeVimshottariDasha(BIRTH, MOON, new Date('nonsense'));
    } catch (e) {
      expect((e as PanchangError).code).toBe('INVALID_DATE');
    }
  });

  it('is not range-validated, unlike birthDate', () => {
    expect(() => computeVimshottariDasha(BIRTH, MOON, new Date('2500-01-01T00:00:00Z')))
      .not.toThrow();
  });

  it('reaches computeNarayanDasha through its options object', () => {
    const loc = { latitude: 18.5204, longitude: 73.8567 };
    const early = computeNarayanDasha(BIRTH, loc, 'lahiri', { asOfDate: BIRTH });
    expect(early.currentIndex).toBe(0);

    const third = early.mahaDashas[2]!;
    const mid = new Date((third.startDate.getTime() + third.endDate.getTime()) / 2);
    const later = computeNarayanDasha(BIRTH, loc, 'lahiri', { asOfDate: mid });
    expect(later.currentIndex).toBe(2);
    expect(later.currentRashi).toBe(third.rashi);
  });
});
