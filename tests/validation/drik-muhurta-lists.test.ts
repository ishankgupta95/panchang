/**
 * @tier 1  DrikPanchang.com shubh-dates calendars, 2025–2027 (Mumbai)
 *
 * Occasion-list validation for the stock muhurta rules that drik publishes
 * dated calendars for:
 *
 *   - Vivah          drikpanchang.com/shubh-dates/shubh-marriage-dates-with-muhurat.html
 *   - Griha Pravesh  drikpanchang.com/shubh-dates/griha-pravesh-dates-with-muhurat.html
 *   - Vahan Kharidi  drikpanchang.com/shubh-dates/vehicle-buying-auspicious-dates-with-muhurat.html
 *
 * All scraped 2026-08-09 via the pages' `?year=` parameter; the vendored
 * fixture holds every published muhurat day with drik's own nakshatra /
 * tithi labels. Unlike the Sarvartha Siddhi parity suite this is a **list**
 * validation, not a day-parity one: drik folds in factors this library does
 * not model (Shukra/Guru Tara Asta, solar-month and Chaturmas windows,
 * window-duration cuts), so day-for-day reconciliation is not expected. What
 * must hold is that the per-anga lists agree with drik's operative sets:
 *
 *   1. Every nakshatra drik uses ≥ `FREQ` times over the three years is in
 *      the rule's auspicious list, and vice versa — drik windows are
 *      nakshatra-led, so the auspicious sets must match exactly.
 *   2. No tithi number drik uses ≥ `FREQ` times sits in the rule's
 *      inauspicious list, and every rule-auspicious tithi is one drik
 *      actually uses. (Vivah is exempt: drik states it applies no tithi or
 *      weekday shuddhi for marriage.)
 *   3. Weekday lists likewise (griha pravesh / vahan only).
 *
 * `FREQ` = 4 splits the data cleanly: genuine cells appear ≥ 9 times in
 * three years, while stray labels appear ≤ 3 times. The strays are
 * window-boundary artifacts — drik occasionally prints, alongside a
 * window's real nakshatra, the adjacent nakshatra that begins exactly when
 * the window ends (verified against the Sarvartha Siddhi span data: e.g.
 * the lone "Jyeshtha" vehicle listing on 2026-02-11 is a window ending
 * 10:53 AM, the minute Anuradha ends).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { STOCK_MUHURTA_RULES } from '../../src/index';

interface MuhuratDay {
  date: string;
  weekday: string;
  nakshatras: string[];
  tithis: string[];
}

const FIXTURE: Record<string, MuhuratDay[]> = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/drik-muhurat-days-2025-2027.json'), 'utf8'),
);

/** Minimum occurrences across 2025–2027 for a label to count as operative. */
const FREQ = 4;

const NAK_INDEX: Record<string, number> = {
  Ashwini: 0, Bharani: 1, Krittika: 2, Rohini: 3, Mrigashirsha: 4, Mrigashira: 4,
  Ardra: 5, Punarvasu: 6, Pushya: 7, Ashlesha: 8, Magha: 9,
  'Purva Phalguni': 10, 'Uttara Phalguni': 11, Hasta: 12, Chitra: 13,
  Swati: 14, Vishakha: 15, Anuradha: 16, Jyeshtha: 17, Moola: 18, Mula: 18,
  'Purva Ashadha': 19, 'Uttara Ashadha': 20, Shravana: 21, Dhanishta: 22, Dhanishtha: 22,
  Shatabhisha: 23, 'Purva Bhadrapada': 24, 'Uttara Bhadrapada': 25, Revati: 26,
};
/** Tithi *number* within the paksha (1–15; 30 = Amavasya), as drik prints it. */
const TITHI_NUMBER: Record<string, number> = {
  Pratipada: 1, Dwitiya: 2, Tritiya: 3, Chaturthi: 4, Panchami: 5,
  Shashthi: 6, Saptami: 7, Ashtami: 8, Navami: 9, Dashami: 10,
  Ekadashi: 11, Dwadashi: 12, Trayodashi: 13, Chaturdashi: 14,
  Purnima: 15, Amavasya: 30,
};
const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

/** Engine tithi index (0–29) → number within paksha (1–15, 30 = Amavasya). */
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

describe.each(CASES)('$occasion — drik shubh-dates list parity, 2025–2027', ({ occasion, days, tithiAndVara }) => {
  const rows = FIXTURE[occasion]!;
  const rule = STOCK_MUHURTA_RULES[occasion]!;

  it(`fixture carries all ${days} published muhurat days`, () => {
    expect(rows.length).toBe(days);
  });

  it('operative nakshatra set matches the rule exactly', () => {
    const drik = frequent(rows.flatMap((r) => r.nakshatras.map((n) => NAK_INDEX[n]!)));
    expect([...drik].sort((a, b) => a - b))
      .toEqual([...(rule.auspiciousNakshatras ?? [])].sort((a, b) => a - b));
  });

  if (tithiAndVara) {
    it('no operative tithi number is in the inauspicious list', () => {
      const drik = frequent(rows.flatMap((r) => r.tithis.map((t) => TITHI_NUMBER[t]!)));
      const banned = new Set((rule.inauspiciousTithis ?? []).map(tithiNumberOf));
      expect([...drik].filter((n) => banned.has(n))).toEqual([]);
    });

    it('every auspicious tithi is one drik actually uses', () => {
      const drik = frequent(rows.flatMap((r) => r.tithis.map((t) => TITHI_NUMBER[t]!)));
      const dead = (rule.auspiciousTithis ?? []).map(tithiNumberOf).filter((n) => !drik.has(n));
      expect(dead).toEqual([]);
    });

    it('weekday lists agree with drik', () => {
      const drik = frequent(rows.map((r) => WEEKDAY_INDEX[r.weekday]!));
      expect([...drik].filter((v) => (rule.inauspiciousVaras ?? []).includes(v))).toEqual([]);
      expect((rule.auspiciousVaras ?? []).filter((v) => !drik.has(v))).toEqual([]);
    });
  }
});
