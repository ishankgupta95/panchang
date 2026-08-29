/**
 * @tier 2  math-invariant + our own pins; Vimshottari is deterministic given the Moon
 */

import { describe, it, expect } from 'vitest';
import { computeVimshottariDasha, DASHA_YEARS, DASHA_ORDER, NAKSHATRA_LORD } from '../../src/jyotish/dasha';

const NAKSHATRA_SPAN = 360 / 27;
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

describe('NAKSHATRA_LORD table: classical 27-entry cycle', () => {
  // Source: BPHS 46.5-7; Raman, Manual of Hindu Astrology, Ch. XIII, Table 1.
  const EXPECTED_LORDS = [
    'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
    'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
    'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
  ];

  it('has exactly 27 entries', () => {
    expect(NAKSHATRA_LORD).toHaveLength(27);
  });

  for (let i = 0; i < 27; i++) {
    it(`nakshatra[${i}] lord === ${EXPECTED_LORDS[i]}`, () => {
      expect(NAKSHATRA_LORD[i]).toBe(EXPECTED_LORDS[i]);
    });
  }
});

describe('DASHA_YEARS: classical Vimshottari durations', () => {
  // Source: BPHS 46.12; Raman, Manual of Hindu Astrology, Ch. XIII p. 186.
  it('Ketu = 7y',     () => expect(DASHA_YEARS.Ketu).toBe(7));
  it('Venus = 20y',   () => expect(DASHA_YEARS.Venus).toBe(20));
  it('Sun = 6y',      () => expect(DASHA_YEARS.Sun).toBe(6));
  it('Moon = 10y',    () => expect(DASHA_YEARS.Moon).toBe(10));
  it('Mars = 7y',     () => expect(DASHA_YEARS.Mars).toBe(7));
  it('Rahu = 18y',    () => expect(DASHA_YEARS.Rahu).toBe(18));
  it('Jupiter = 16y', () => expect(DASHA_YEARS.Jupiter).toBe(16));
  it('Saturn = 19y',  () => expect(DASHA_YEARS.Saturn).toBe(19));
  it('Mercury = 17y', () => expect(DASHA_YEARS.Mercury).toBe(17));

  it('sum to 120 years', () => {
    const sum = Object.values(DASHA_YEARS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(120);
  });
});

describe('DASHA_ORDER: Ketu → Venus → … → Mercury', () => {
  // BPHS 46.12 starts the closed cycle at Sun; rotated to Ketu, Ashwini's lord.
  const EXPECTED = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  it('has 9 lords in classical order', () => {
    expect(DASHA_ORDER).toEqual(EXPECTED);
  });
});

describe('birth at exact nakshatra start → full balance of that lord', () => {
  const birthDate = new Date('2000-01-01T00:00:00Z');

  it('Moon = 0.000° (Ashwini start) → Ketu balance = 7 years', () => {
    const r = computeVimshottariDasha(birthDate, 0);
    expect(r.mahaDashas[0]!.lord).toBe('Ketu');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(7, 2);
  });

  it('Moon = 13.3333° (Bharani start) → Venus balance = 20 years', () => {
    const r = computeVimshottariDasha(birthDate, NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.lord).toBe('Venus');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(20, 2);
  });

  it('Moon = 346.667° (Revati start) → Mercury balance = 17 years', () => {
    const r = computeVimshottariDasha(birthDate, 26 * NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.lord).toBe('Mercury');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(17, 2);
  });
});

describe('birth near nakshatra end → near-zero balance', () => {
  const birthDate = new Date('2000-01-01T00:00:00Z');

  it('Moon = 359.9999° → Mercury balance ≈ 0, next (Ketu) is second', () => {
    const r = computeVimshottariDasha(birthDate, 359.9999);
    expect(r.mahaDashas[0]!.lord).toBe('Mercury');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeLessThan(0.001);
    expect(r.mahaDashas[1]!.lord).toBe('Ketu');
  });
});

describe('birth at nakshatra midpoint → half balance', () => {
  const birthDate = new Date('2000-01-01T00:00:00Z');

  it('Moon = 6.6667° (mid-Ashwini) → Ketu balance = 3.5 years', () => {
    const r = computeVimshottariDasha(birthDate, NAKSHATRA_SPAN / 2);
    expect(r.mahaDashas[0]!.lord).toBe('Ketu');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(3.5, 2);
  });
});

describe('sequence invariants (held for all valid Moon longitudes)', () => {
  const cases = [0, 50, 100.78, 180, 250, 300, 359.99];

  for (const moonLon of cases) {
    describe(`Moon = ${moonLon}°`, () => {
      const r = computeVimshottariDasha(new Date('2000-01-01T00:00:00Z'), moonLon);

      it('returns 9 mahadashas', () => {
        expect(r.mahaDashas).toHaveLength(9);
      });

      it('mahadasha lords follow cyclic order starting from the birth-nakshatra lord', () => {
        const startLord = r.mahaDashas[0]!.lord;
        const startIdx = DASHA_ORDER.indexOf(startLord);
        for (let i = 0; i < 9; i++) {
          const expected = DASHA_ORDER[(startIdx + i) % 9];
          expect(r.mahaDashas[i]!.lord).toBe(expected);
        }
      });

      it('consecutive mahadashas meet exactly (no gap/overlap)', () => {
        for (let i = 1; i < 9; i++) {
          expect(r.mahaDashas[i]!.startDate.getTime())
            .toBe(r.mahaDashas[i - 1]!.endDate.getTime());
        }
      });

      it('total span in [120 − startLordYears, 120] years', () => {
        const startLordYears = DASHA_YEARS[r.mahaDashas[0]!.lord];
        const totalYears =
          (r.mahaDashas[8]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
        expect(totalYears).toBeGreaterThanOrEqual(120 - startLordYears - 1e-6);
        expect(totalYears).toBeLessThanOrEqual(120 + 1e-6);
      });

      it('full (non-first) mahadashas have 9 antardashas in cyclic order from the lord', () => {
        for (let m = 1; m < r.mahaDashas.length; m++) {
          const md = r.mahaDashas[m]!;
          expect(md.antarDashas).toHaveLength(9);
          const mdIdx = DASHA_ORDER.indexOf(md.lord);
          for (let j = 0; j < 9; j++) {
            expect(md.antarDashas[j]!.lord).toBe(DASHA_ORDER[(mdIdx + j) % 9]);
          }
        }
      });

      it('first (partial) mahadasha: 1..9 antardashas forming a contiguous tail of the cyclic order', () => {
        const md = r.mahaDashas[0]!;
        const mdIdx = DASHA_ORDER.indexOf(md.lord);
        expect(md.antarDashas.length).toBeGreaterThanOrEqual(1);
        expect(md.antarDashas.length).toBeLessThanOrEqual(9);
        const firstIdx = DASHA_ORDER.indexOf(md.antarDashas[0]!.lord);
        for (let j = 0; j < md.antarDashas.length; j++) {
          expect(md.antarDashas[j]!.lord).toBe(DASHA_ORDER[(firstIdx + j) % 9]);
        }
        const lastIdx = DASHA_ORDER.indexOf(md.antarDashas[md.antarDashas.length - 1]!.lord);
        expect(lastIdx).toBe((mdIdx + 8) % 9);
      });

      it('antardasha durations sum to parent mahadasha duration (± few ms)', () => {
        for (const md of r.mahaDashas) {
          const mdMs = md.endDate.getTime() - md.startDate.getTime();
          const adSum = md.antarDashas.reduce(
            (acc, ad) => acc + (ad.endDate.getTime() - ad.startDate.getTime()),
            0,
          );
          expect(Math.abs(adSum - mdMs)).toBeLessThan(10);
        }
      });

      it('antardasha proportions follow lordYears/120 × parentDuration (full mahadashas)', () => {
        // Loop starts at 1: the partial first mahadasha runs full-length
        // antardashas inside a shorter window.
        for (let m = 1; m < r.mahaDashas.length; m++) {
          const md = r.mahaDashas[m]!;
          const mdMs = md.endDate.getTime() - md.startDate.getTime();
          for (const ad of md.antarDashas) {
            const expectedMs = (DASHA_YEARS[ad.lord] / 120) * mdMs;
            const actualMs = ad.endDate.getTime() - ad.startDate.getTime();
            expect(Math.abs(actualMs - expectedMs)).toBeLessThan(Math.max(10, expectedMs * 0.0001));
          }
        }
      });
    });
  }
});

describe('end-to-end real chart: Moon per the reference almanac 2025-01-14 18:13:36 UTC / Delhi', () => {
  // Moon sidereal 100.78° comes from testdata/almanac/almanac-planets.json;
  // 8.388 y is the Saturn (Pushya) balance derived from it by hand.
  const birthDate = new Date('2025-01-14T18:13:36Z');
  const moonSid = 100.78;
  const r = computeVimshottariDasha(birthDate, moonSid);

  it('birth nakshatra lord is Saturn (Pushya)', () => {
    expect(r.mahaDashas[0]!.lord).toBe('Saturn');
  });

  it('Saturn balance is ≈ 8.388 years (classical derivation)', () => {
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(8.388, 2);
  });

  it('second mahadasha is Mercury (follows Saturn in cycle)', () => {
    expect(r.mahaDashas[1]!.lord).toBe('Mercury');
  });

  it('ninth (last) mahadasha is Jupiter (Saturn + 8 in cycle mod 9 = index 6)', () => {
    expect(r.mahaDashas[8]!.lord).toBe('Jupiter');
  });
});
