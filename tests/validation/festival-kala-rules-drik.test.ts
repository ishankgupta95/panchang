/**
 * @tier 1  DrikPanchang festival pages (Delhi, geoname-id 1273294)
 *
 * Kala-rule festival dates vs drik (2026-08-14 audit, FE-2 / FE-3):
 *
 * VIJAYADASHAMI — the `aparahna-full` ladder: the day Dashami covers the
 * ENTIRE aparahna kala (3/5 → 4/5 of daylight) wins; when neither day does,
 * the day the tithi ends wins (para-viddha). Recovered from drik's
 * vijayadashami-date-time pages for 11 consecutive years (2020–2030), all
 * pinned below. The discriminating years:
 *   - 2020: Navami at sunrise but Dashami covers Oct 25's aparahna → Oct 25
 *     (a sunrise rule says Oct 26);
 *   - 2022: Dashami PARTIALLY covers Oct 4's aparahna, misses Oct 5's
 *     entirely — drik still prints Oct 5 (the end day; para-viddha);
 *   - 2023: partial on the end day only → that day (Oct 24);
 *   - 2026: full on Oct 20, partial on Oct 21 → Oct 20 (sunrise rule: Oct 21);
 *   - 2027: full on Oct 9 only → Oct 9 (sunrise rule: Oct 10).
 *
 * KARVA CHAUTH — Kartika (purnimanta) Krishna Chaturthi at MOONRISE, with a
 * sunrise-prevalence fallback when the tithi touches no moonrise on either
 * day:
 *   - 2027: Chaturthi Oct 18 17:52 → Oct 19 16:42; moonrise Oct 18 19:30 in
 *     the tithi, Oct 19 20:24 past it → Oct 18 (sunrise rule: Oct 19);
 *   - 2025: Chaturthi Oct 9 22:54 → Oct 10 19:39 misses both moonrises
 *     (19:23 / 20:13) → sunrise fallback, Oct 10 (drik's printed day).
 *
 * Dates are TIERS.md invariants — a movement here is a rule regression, not
 * a re-pinnable tolerance.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.209 };

/** Emission days for `key` scanned over `days` of a month (1-based). */
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

describe('Vijayadashami vs drik (Delhi) — aparahna-full ladder, 2020–2030', () => {
  const CASES: { year: number; month: number; scan: number[]; drik: number }[] = [
    { year: 2020, month: 10, scan: [24, 25, 26], drik: 25 },
    { year: 2021, month: 10, scan: [14, 15, 16], drik: 15 },
    { year: 2022, month: 10, scan: [4, 5, 6], drik: 5 },
    { year: 2023, month: 10, scan: [23, 24, 25], drik: 24 },
    { year: 2024, month: 10, scan: [12, 13], drik: 12 },
    { year: 2025, month: 10, scan: [1, 2, 3], drik: 2 },
    { year: 2026, month: 10, scan: [20, 21, 22], drik: 20 },
    { year: 2027, month: 10, scan: [9, 10, 11], drik: 9 },
    { year: 2028, month: 9, scan: [27, 28], drik: 27 },
    { year: 2029, month: 10, scan: [16, 17], drik: 16 },
    { year: 2030, month: 10, scan: [5, 6, 7], drik: 6 },
  ];
  for (const c of CASES) {
    it(`${c.year}: single emission on ${c.year}-${c.month}-${c.drik}`, () => {
      expect(emissionDays('dussehra', c.year, c.month, c.scan)).toEqual([c.drik]);
    });
  }
});

describe('Krishna Janmashtami vs drik (Delhi) — Smarta nishita ladder, 2024–2030', () => {
  // Ladder (recovered from drik's krishna-janmashtami-date-time pages):
  // the udaya-Ashtami day wins when Ashtami OR Rohini touches its nishita
  // muhurta; otherwise the day Ashtami covers nishita — Saptami-viddha or
  // not. Discriminating years:
  //   2025 — Ashtami from 11:49 PM Aug 15 (deep viddha), Aug 16's nishita
  //          has neither Ashtami nor Rohini → Aug 15;
  //   2027 — Ashtami at Aug 24's nishita only, but Rohini at Aug 25's
  //          (udaya day) → Aug 25 (a pure nishita rule says Aug 24);
  //   2028 — Rohini at Aug 14's nishita but Aug 14 is Navami → Aug 13;
  //   2029/2030 — Rohini decides for the udaya day again.
  const CASES: { year: number; month: number; scan: number[]; drik: number }[] = [
    { year: 2024, month: 8, scan: [25, 26, 27], drik: 26 },
    { year: 2025, month: 8, scan: [14, 15, 16, 17], drik: 15 },
    { year: 2026, month: 9, scan: [3, 4, 5], drik: 4 },
    { year: 2027, month: 8, scan: [23, 24, 25, 26], drik: 25 },
    { year: 2028, month: 8, scan: [12, 13, 14, 15], drik: 13 },
    { year: 2029, month: 9, scan: [1, 2], drik: 1 },
    { year: 2030, month: 8, scan: [19, 20, 21, 22], drik: 21 },
  ];
  for (const c of CASES) {
    it(`${c.year}: single emission on ${c.year}-${c.month}-${c.drik}`, () => {
      expect(emissionDays('krishna_janmashtami', c.year, c.month, c.scan)).toEqual([c.drik]);
    });
  }

  it('2029: no emission in late August (Ashtami-at-nishita day yields to Sep 1)', () => {
    expect(emissionDays('krishna_janmashtami', 2029, 8, [30, 31])).toEqual([]);
  });
});

describe('Karva Chauth vs drik (Delhi) — chandrodaya rule, 2024–2027', () => {
  const CASES: { year: number; month: number; scan: number[]; drik: number }[] = [
    { year: 2024, month: 10, scan: [19, 20, 21], drik: 20 },
    { year: 2025, month: 10, scan: [9, 10, 11], drik: 10 },   // no-moonrise fallback
    { year: 2026, month: 10, scan: [28, 29, 30], drik: 29 },
    { year: 2027, month: 10, scan: [17, 18, 19, 20], drik: 18 }, // moonrise discriminator
  ];
  for (const c of CASES) {
    it(`${c.year}: single emission on ${c.year}-${c.month}-${c.drik}`, () => {
      expect(emissionDays('karva_chauth', c.year, c.month, c.scan)).toEqual([c.drik]);
    });
  }
});
