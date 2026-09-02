/**
 * @tier 1  Reference-almanac shubh-dates calendars, 2025-2027 (Mumbai)
 *
 * A list validation, not day parity: the almanac folds in factors this library
 * does not model. Its windows are nakshatra-led, so the nakshatra sets must
 * match exactly while tithi and weekday only have to not contradict; Vivah is
 * exempt from both, the almanac applying no shuddhi for marriage.
 *
 * `FREQ` = 4: genuine cells appear at least 9 times in three years, strays at
 * most 3.
 */

import { describe, it, expect } from 'vitest';
import { STOCK_MUHURTA_RULES } from '../../src/index';
import { readTestData } from '../testdata';

interface MuhuratDay {
  date: string;
  weekday: string;
  nakshatras: string[];
  tithis: string[];
}

const FIXTURE = readTestData<Record<string, MuhuratDay[]>>('almanac', 'almanac-muhurat-days-2025-2027.json');

const FREQ = 4;

const NAK_INDEX: Record<string, number> = {
  Ashwini: 0, Bharani: 1, Krittika: 2, Rohini: 3, Mrigashirsha: 4, Mrigashira: 4,
  Ardra: 5, Punarvasu: 6, Pushya: 7, Ashlesha: 8, Magha: 9,
  'Purva Phalguni': 10, 'Uttara Phalguni': 11, Hasta: 12, Chitra: 13,
  Swati: 14, Vishakha: 15, Anuradha: 16, Jyeshtha: 17, Moola: 18, Mula: 18,
  'Purva Ashadha': 19, 'Uttara Ashadha': 20, Shravana: 21, Dhanishta: 22, Dhanishtha: 22,
  Shatabhisha: 23, 'Purva Bhadrapada': 24, 'Uttara Bhadrapada': 25, Revati: 26,
};
/** As the almanac prints it, not the engine's tithi index. */
const TITHI_NUMBER: Record<string, number> = {
  Pratipada: 1, Dwitiya: 2, Tritiya: 3, Chaturthi: 4, Panchami: 5,
  Shashthi: 6, Saptami: 7, Ashtami: 8, Navami: 9, Dashami: 10,
  Ekadashi: 11, Dwadashi: 12, Trayodashi: 13, Chaturdashi: 14,
  Purnima: 15, Amavasya: 30,
};
const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

const tithiNumberOf = (i: number) => (i === 29 ? 30 : (i % 15) + 1);

function frequent<T>(items: readonly T[], min = FREQ): Set<T> {
  const counts = new Map<T, number>();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  return new Set([...counts.entries()].filter(([, n]) => n >= min).map(([k]) => k));
}

const CASES = [
  { occasion: 'vivah', days: 233, tithiAndVara: false },
  { occasion: 'grihaPravesh', days: 121, tithiAndVara: true },
  { occasion: 'vahanKharidi', days: 311, tithiAndVara: true },
] as const;

describe.each(CASES)('$occasion: reference-almanac shubh-dates list parity, 2025-2027', ({ occasion, days, tithiAndVara }) => {
  const rows = FIXTURE[occasion]!;
  const rule = STOCK_MUHURTA_RULES[occasion]!;

  it(`fixture carries all ${days} published muhurat days`, () => {
    expect(rows.length).toBe(days);
  });

  it('operative nakshatra set matches the rule exactly', () => {
    const almanac = frequent(rows.flatMap((r) => r.nakshatras.map((n) => NAK_INDEX[n]!)));
    expect([...almanac].sort((a, b) => a - b))
      .toEqual([...(rule.auspiciousNakshatras ?? [])].sort((a, b) => a - b));
  });

  if (tithiAndVara) {
    it('no operative tithi number is in the inauspicious list', () => {
      const almanac = frequent(rows.flatMap((r) => r.tithis.map((t) => TITHI_NUMBER[t]!)));
      const banned = new Set((rule.inauspiciousTithis ?? []).map(tithiNumberOf));
      expect([...almanac].filter((n) => banned.has(n))).toEqual([]);
    });

    it('every auspicious tithi is one the almanac actually uses', () => {
      const almanac = frequent(rows.flatMap((r) => r.tithis.map((t) => TITHI_NUMBER[t]!)));
      const dead = (rule.auspiciousTithis ?? []).map(tithiNumberOf).filter((n) => !almanac.has(n));
      expect(dead).toEqual([]);
    });

    it('weekday lists agree with the almanac', () => {
      const almanac = frequent(rows.map((r) => WEEKDAY_INDEX[r.weekday]!));
      expect([...almanac].filter((v) => (rule.inauspiciousVaras ?? []).includes(v))).toEqual([]);
      expect((rule.auspiciousVaras ?? []).filter((v) => !almanac.has(v))).toEqual([]);
    });
  }
});
