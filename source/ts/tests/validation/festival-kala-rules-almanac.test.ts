/**
 * @tier 1  Reference-almanac festival pages (Delhi, geoname-id 1273294)
 *
 * Vijayadashami: the day Dashami covers the ENTIRE aparahna kala (3/5 to 4/5 of
 * daylight) wins; when neither day does, the day the tithi ends (para-viddha).
 *
 * Karva Chauth: Kartika (purnimanta) Krishna Chaturthi at MOONRISE, falling
 * back to sunrise prevalence when the tithi touches no moonrise (2025).
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.209 };

function emissionDays(key: string, year: number, month: number, days: number[]): number[] {
  const hits: number[] = [];
  for (const d of days) {
    const p = getDailyPanchang(new Date(Date.UTC(year, month - 1, d, 12)), DELHI, {
      timezone: 330, sections: ['festivals'],
    })!;
    if (p.festivals.some((f) => f.key === key)) hits.push(d);
  }
  return hits;
}

describe('Vijayadashami vs the reference almanac (Delhi): aparahna-full ladder, 2020-2030', () => {
  const CASES: { year: number; month: number; scan: number[]; almanac: number }[] = [
    { year: 2020, month: 10, scan: [24, 25, 26], almanac: 25 },
    { year: 2021, month: 10, scan: [14, 15, 16], almanac: 15 },
    { year: 2022, month: 10, scan: [4, 5, 6], almanac: 5 },
    { year: 2023, month: 10, scan: [23, 24, 25], almanac: 24 },
    { year: 2024, month: 10, scan: [12, 13], almanac: 12 },
    { year: 2025, month: 10, scan: [1, 2, 3], almanac: 2 },
    { year: 2026, month: 10, scan: [20, 21, 22], almanac: 20 },
    { year: 2027, month: 10, scan: [9, 10, 11], almanac: 9 },
    { year: 2028, month: 9, scan: [27, 28], almanac: 27 },
    { year: 2029, month: 10, scan: [16, 17], almanac: 16 },
    { year: 2030, month: 10, scan: [5, 6, 7], almanac: 6 },
  ];
  for (const c of CASES) {
    it(`${c.year}: single emission on ${c.year}-${c.month}-${c.almanac}`, () => {
      expect(emissionDays('dussehra', c.year, c.month, c.scan)).toEqual([c.almanac]);
    });
  }
});

describe('Krishna Janmashtami vs the reference almanac (Delhi): Smarta nishita ladder, 2024-2030', () => {
  // The udaya-Ashtami day wins when Ashtami OR Rohini touches its nishita
  // muhurta; otherwise the day Ashtami covers nishita, Saptami-viddha or not.
  const CASES: { year: number; month: number; scan: number[]; almanac: number }[] = [
    { year: 2024, month: 8, scan: [25, 26, 27], almanac: 26 },
    { year: 2025, month: 8, scan: [14, 15, 16, 17], almanac: 15 },
    { year: 2026, month: 9, scan: [3, 4, 5], almanac: 4 },
    { year: 2027, month: 8, scan: [23, 24, 25, 26], almanac: 25 },
    { year: 2028, month: 8, scan: [12, 13, 14, 15], almanac: 13 },
    { year: 2029, month: 9, scan: [1, 2], almanac: 1 },
    { year: 2030, month: 8, scan: [19, 20, 21, 22], almanac: 21 },
  ];
  for (const c of CASES) {
    it(`${c.year}: single emission on ${c.year}-${c.month}-${c.almanac}`, () => {
      expect(emissionDays('krishna_janmashtami', c.year, c.month, c.scan)).toEqual([c.almanac]);
    });
  }

  it('2029: no emission in late August (Ashtami-at-nishita day yields to Sep 1)', () => {
    expect(emissionDays('krishna_janmashtami', 2029, 8, [30, 31])).toEqual([]);
  });
});

describe('Karva Chauth vs the reference almanac (Delhi): chandrodaya rule, 2024-2027', () => {
  const CASES: { year: number; month: number; scan: number[]; almanac: number }[] = [
    { year: 2024, month: 10, scan: [19, 20, 21], almanac: 20 },
    { year: 2025, month: 10, scan: [9, 10, 11], almanac: 10 },
    { year: 2026, month: 10, scan: [28, 29, 30], almanac: 29 },
    { year: 2027, month: 10, scan: [17, 18, 19, 20], almanac: 18 },
  ];
  for (const c of CASES) {
    it(`${c.year}: single emission on ${c.year}-${c.month}-${c.almanac}`, () => {
      expect(emissionDays('karva_chauth', c.year, c.month, c.scan)).toEqual([c.almanac]);
    });
  }
});
