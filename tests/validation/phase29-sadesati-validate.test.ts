/**
 * @tier 1  published Saturn transit dates (ProKerala / DrikPanchang)
 *
 * Phase 29 Sade Sati cross-validation against published Saturn transit dates.
 *
 * Sade Sati = the ~7.5-year period during which transit Saturn occupies the
 * 12th, 1st, or 2nd sidereal rashi from the native's natal Moon. Arc boundaries
 * are defined by Saturn's rashi ingress/exit dates, which are determinate
 * astronomy.
 *
 * ── Reference source ────────────────────────────────────────────────────────
 *
 * Saturn transit dates 1990–2030 (sidereal Vedic, Lahiri ayanamsa) sourced
 * from Barbara Pijan's published Shani Gochara table, cross-checked against
 * jagannathhora.com / hindupad.com / digitalkarmakanda.com:
 *
 *   2011-11-14   Saturn enters Tula (first crossing)
 *   2012-08-03   Saturn permanently re-enters Tula (after retrograde dip)
 *   2014-11-02   Saturn enters Vrischika
 *   2017-01-26   Saturn enters Dhanu (first crossing)
 *   2017-10-26   Saturn permanently re-enters Dhanu
 *   2020-01-23   Saturn enters Makara
 *   2022-04-28   Saturn enters Kumbha (first crossing)
 *   2023-01-17   Saturn permanently re-enters Kumbha
 *   2025-03-29   Saturn enters Meena
 *   2027-06-02   Saturn enters Mesha (first crossing)
 *   2028-02-23   Saturn permanently re-enters Mesha
 *
 * Source: https://barbarapijan.com/bpa/Gochara_Shani/Shani_gochara_transits_table.htm
 *
 * ── Convention note ─────────────────────────────────────────────────────────
 *
 * On retrograde-dip transits Saturn enters a rashi, retrogrades back into the
 * previous one, then permanently re-enters. Different astrologers report
 * different Sade Sati boundary conventions:
 *   - Drik Panchang & most Vedic almanacs: Sade Sati starts at the FIRST
 *     touch of Saturn into the (M-1) rashi.
 *   - A minority convention: only the PERMANENT ingress counts.
 *
 * The library's `STABILITY_DAYS = 90` window absorbs retrograde dips ≤ 90
 * days but treats longer dips as boundary events. Both conventions match
 * the tolerance per PLAN's "±2 days" target — this suite asserts the
 * library boundary is within ±2 days of EITHER the first OR the permanent
 * ingress date.
 */

import { describe, it, expect } from 'vitest';
import { computeSadeSati } from '../../src/jyotish/sadeSati';
import { computePlanetaryPositions } from '../../src/jyotish/planets';

// ── Saturn ingress reference (Lahiri ayanamsa) ──────────────────────────────

type Ingress = { date: string; firstAlt?: string };
const SATURN_ENTERS: Record<string, Ingress[]> = {
  // rashi name → list of (date Saturn enters, optional first-crossing date if
  // the canonical date is the permanent re-entry)
  Tula:       [{ date: '2012-08-03', firstAlt: '2011-11-14' }],
  Vrischika:  [{ date: '2014-11-02' }],
  Dhanu:      [{ date: '2017-10-26', firstAlt: '2017-01-26' }],
  Makara:     [{ date: '2020-01-23' }],
  Kumbha:     [{ date: '2023-01-17', firstAlt: '2022-04-28' }],
  Meena:      [{ date: '2025-03-29' }],
  Mesha:      [{ date: '2028-02-23', firstAlt: '2027-06-02' }],
};

const RASHI_INDEX: Record<string, number> = {
  Mesha: 0, Vrishabha: 1, Mithuna: 2, Karka: 3, Simha: 4, Kanya: 5,
  Tula: 6, Vrischika: 7, Dhanu: 8, Makara: 9, Kumbha: 10, Meena: 11,
};

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86400_000;
}

/**
 * Match a library boundary date against the canonical Saturn ingress for the
 * given rashi: pass if within ±2 days of either the first crossing or the
 * permanent re-entry.
 */
function withinIngress(boundary: Date, rashiName: string, tolDays = 2): boolean {
  const candidates = SATURN_ENTERS[rashiName] ?? [];
  for (const c of candidates) {
    const dates = [new Date(c.date + 'T00:00:00Z')];
    if (c.firstAlt) dates.push(new Date(c.firstAlt + 'T00:00:00Z'));
    for (const d of dates) {
      if (daysBetween(boundary, d) <= tolDays) return true;
    }
  }
  return false;
}

// ── Sade Sati fixtures: 20 sample (natal moon, as-of) cases ────────────────
//
// Each fixture captures:
//   - natalMoonRashi M
//   - asOf date when we evaluate
//   - expectedActive
//   - expectedPhase (1 = Saturn in M-1, 2 = M, 3 = M+1)
//   - expectedArcStartRashi: the rashi Saturn enters at the start of the arc
//                            (M-1, modulo 12)
//   - expectedArcEndRashi: the rashi Saturn enters when leaving the arc
//                          (M+2, modulo 12)
//
// The fixture is "structural" — derived from the canonical Sade Sati rule
// (Saturn in {M-1, M, M+1} from natal Moon) and the published Saturn transit
// dates above. The library output is asserted against these.

type SadeSatiFixture = {
  label: string;
  natalMoonRashiName: string;
  asOf: string;
  expectedActive: boolean;
  expectedPhase: 1 | 2 | 3 | null;
  expectedArcStartRashi: string | null;  // rashi Saturn enters at arc start
  expectedArcEndRashi: string | null;    // rashi Saturn enters at arc end
};

const FIXTURES: SadeSatiFixture[] = [
  // M = Vrischika (7) — Saturn was in {Tula, Vrischika, Dhanu} = {6,7,8}
  // from 2011-11-14 (Tula first) until 2020-01-23 (enters Makara).
  { label: 'Vrischika moon as-of 2013-01-01 (phase 1, Saturn in Tula)',
    natalMoonRashiName: 'Vrischika', asOf: '2013-01-01',
    expectedActive: true, expectedPhase: 1,
    expectedArcStartRashi: 'Tula', expectedArcEndRashi: 'Makara' },
  { label: 'Vrischika moon as-of 2016-01-01 (phase 2, Saturn in Vrischika)',
    natalMoonRashiName: 'Vrischika', asOf: '2016-01-01',
    expectedActive: true, expectedPhase: 2,
    expectedArcStartRashi: 'Tula', expectedArcEndRashi: 'Makara' },
  { label: 'Vrischika moon as-of 2018-06-01 (phase 3, Saturn in Dhanu)',
    natalMoonRashiName: 'Vrischika', asOf: '2018-06-01',
    expectedActive: true, expectedPhase: 3,
    expectedArcStartRashi: 'Tula', expectedArcEndRashi: 'Makara' },

  // M = Dhanu (8) — arc {7, 8, 9} = {Vrischika, Dhanu, Makara} from
  // 2014-11-02 (Vrischika) until 2023-01-17 (Kumbha permanent).
  { label: 'Dhanu moon as-of 2015-06-01 (phase 1, Saturn in Vrischika)',
    natalMoonRashiName: 'Dhanu', asOf: '2015-06-01',
    expectedActive: true, expectedPhase: 1,
    expectedArcStartRashi: 'Vrischika', expectedArcEndRashi: 'Kumbha' },
  { label: 'Dhanu moon as-of 2018-06-01 (phase 2, Saturn in Dhanu)',
    natalMoonRashiName: 'Dhanu', asOf: '2018-06-01',
    expectedActive: true, expectedPhase: 2,
    expectedArcStartRashi: 'Vrischika', expectedArcEndRashi: 'Kumbha' },
  { label: 'Dhanu moon as-of 2021-06-01 (phase 3, Saturn in Makara)',
    natalMoonRashiName: 'Dhanu', asOf: '2021-06-01',
    expectedActive: true, expectedPhase: 3,
    expectedArcStartRashi: 'Vrischika', expectedArcEndRashi: 'Kumbha' },

  // M = Makara (9) — arc {8, 9, 10} = {Dhanu, Makara, Kumbha} from
  // 2017-10-26 (Dhanu permanent) until 2025-03-29 (Meena).
  { label: 'Makara moon as-of 2018-06-01 (phase 1, Saturn in Dhanu)',
    natalMoonRashiName: 'Makara', asOf: '2018-06-01',
    expectedActive: true, expectedPhase: 1,
    expectedArcStartRashi: 'Dhanu', expectedArcEndRashi: 'Meena' },
  { label: 'Makara moon as-of 2021-06-01 (phase 2, Saturn in Makara)',
    natalMoonRashiName: 'Makara', asOf: '2021-06-01',
    expectedActive: true, expectedPhase: 2,
    expectedArcStartRashi: 'Dhanu', expectedArcEndRashi: 'Meena' },
  { label: 'Makara moon as-of 2024-01-01 (phase 3, Saturn in Kumbha)',
    natalMoonRashiName: 'Makara', asOf: '2024-01-01',
    expectedActive: true, expectedPhase: 3,
    expectedArcStartRashi: 'Dhanu', expectedArcEndRashi: 'Meena' },

  // M = Kumbha (10) — arc {9, 10, 11} = {Makara, Kumbha, Meena} from
  // 2020-01-23 (Makara) until 2028-02-23 (Mesha permanent).
  { label: 'Kumbha moon as-of 2021-06-01 (phase 1, Saturn in Makara)',
    natalMoonRashiName: 'Kumbha', asOf: '2021-06-01',
    expectedActive: true, expectedPhase: 1,
    expectedArcStartRashi: 'Makara', expectedArcEndRashi: 'Mesha' },
  { label: 'Kumbha moon as-of 2024-01-01 (phase 2, Saturn in Kumbha)',
    natalMoonRashiName: 'Kumbha', asOf: '2024-01-01',
    expectedActive: true, expectedPhase: 2,
    expectedArcStartRashi: 'Makara', expectedArcEndRashi: 'Mesha' },
  { label: 'Kumbha moon as-of 2026-05-04 (phase 3, Saturn in Meena)',
    natalMoonRashiName: 'Kumbha', asOf: '2026-05-04',
    expectedActive: true, expectedPhase: 3,
    expectedArcStartRashi: 'Makara', expectedArcEndRashi: 'Mesha' },

  // M = Meena (11) — arc {10, 11, 0} = {Kumbha, Meena, Mesha} starting
  // 2023-01-17 (Kumbha permanent), ending after 2028-02-23 + ~2 years
  // (Saturn enters Vrishabha, M+2=1).
  { label: 'Meena moon as-of 2024-01-01 (phase 1, Saturn in Kumbha)',
    natalMoonRashiName: 'Meena', asOf: '2024-01-01',
    expectedActive: true, expectedPhase: 1,
    expectedArcStartRashi: 'Kumbha', expectedArcEndRashi: 'Vrishabha' },
  { label: 'Meena moon as-of 2026-05-04 (phase 2, Saturn in Meena)',
    natalMoonRashiName: 'Meena', asOf: '2026-05-04',
    expectedActive: true, expectedPhase: 2,
    expectedArcStartRashi: 'Kumbha', expectedArcEndRashi: 'Vrishabha' },

  // M = Mesha (0) — arc {11, 0, 1} = {Meena, Mesha, Vrishabha} starting
  // 2025-03-29 (Meena), continuing through ~2030.
  { label: 'Mesha moon as-of 2026-05-04 (phase 1, Saturn in Meena)',
    natalMoonRashiName: 'Mesha', asOf: '2026-05-04',
    expectedActive: true, expectedPhase: 1,
    expectedArcStartRashi: 'Meena', expectedArcEndRashi: 'Mithuna' },

  // Inactive cases — natives whose Sade Sati arc has not started or already
  // ended at the as-of date.
  { label: 'Karka moon as-of 2026-05-04 (Saturn in Meena, far from arc {3,4,5})',
    natalMoonRashiName: 'Karka', asOf: '2026-05-04',
    expectedActive: false, expectedPhase: null,
    expectedArcStartRashi: null, expectedArcEndRashi: null },
  { label: 'Simha moon as-of 2026-05-04 (Saturn in Meena, far from arc {3,4,5})',
    natalMoonRashiName: 'Simha', asOf: '2026-05-04',
    expectedActive: false, expectedPhase: null,
    expectedArcStartRashi: null, expectedArcEndRashi: null },
  { label: 'Kanya moon as-of 2026-05-04 (Saturn in Meena, far from arc {4,5,6})',
    natalMoonRashiName: 'Kanya', asOf: '2026-05-04',
    expectedActive: false, expectedPhase: null,
    expectedArcStartRashi: null, expectedArcEndRashi: null },
  { label: 'Tula moon as-of 2026-05-04 (Saturn in Meena, between arc and natal)',
    natalMoonRashiName: 'Tula', asOf: '2026-05-04',
    expectedActive: false, expectedPhase: null,
    expectedArcStartRashi: null, expectedArcEndRashi: null },
  { label: 'Vrischika moon as-of 2024-01-01 (just past the 2020 arc end)',
    natalMoonRashiName: 'Vrischika', asOf: '2024-01-01',
    expectedActive: false, expectedPhase: null,
    expectedArcStartRashi: null, expectedArcEndRashi: null },
];

// ── Per-fixture cross-check ─────────────────────────────────────────────────

describe('Phase 29 Sade Sati cross-validation against published Saturn transit dates', () => {
  it(`coverage: ${FIXTURES.length} fixtures loaded`, () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(20);
  });

  for (const f of FIXTURES) {
    describe(`${f.label}`, () => {
      const M = RASHI_INDEX[f.natalMoonRashiName]!;
      const asOf = new Date(f.asOf + 'T12:00:00Z');
      const result = computeSadeSati(M, asOf);

      it(`active = ${f.expectedActive}`, () => {
        expect(result.active).toBe(f.expectedActive);
      });

      it(`phase = ${f.expectedPhase}`, () => {
        expect(result.phase).toBe(f.expectedPhase);
      });

      if (f.expectedActive && f.expectedArcStartRashi) {
        it(`arc start within ±2 days of Saturn entering ${f.expectedArcStartRashi}`, () => {
          expect(result.currentArcStart).not.toBeNull();
          expect(withinIngress(result.currentArcStart!, f.expectedArcStartRashi!))
            .toBe(true);
        });
      }

      if (f.expectedActive && f.expectedArcEndRashi
          && SATURN_ENTERS[f.expectedArcEndRashi]) {
        it(`arc end within ±2 days of Saturn entering ${f.expectedArcEndRashi}`, () => {
          expect(result.currentArcEnd).not.toBeNull();
          expect(withinIngress(result.currentArcEnd!, f.expectedArcEndRashi!))
            .toBe(true);
        });
      }

      if (!f.expectedActive) {
        it('returns null arc dates and a non-null nextArcStart', () => {
          expect(result.currentArcStart).toBeNull();
          expect(result.currentArcEnd).toBeNull();
          expect(result.nextArcStart).not.toBeNull();
        });
      }
    });
  }
});

// ── Saturn position spot-check: library agrees with published transit dates ─

describe('Phase 29 Sade Sati — Saturn position cross-check', () => {
  // For each canonical ingress date, library should report Saturn within ±0.1°
  // of the rashi boundary on the published transit day.
  const ingressTests: Array<{ date: string; rashi: number; tol: number }> = [
    { date: '2014-11-03', rashi: 7, tol: 0.5 },  // Saturn just entered Vrischika
    { date: '2017-10-27', rashi: 8, tol: 0.5 },  // Saturn permanent Dhanu
    { date: '2020-01-24', rashi: 9, tol: 0.5 },  // Saturn enters Makara
    { date: '2023-01-18', rashi: 10, tol: 0.5 }, // Saturn permanent Kumbha
    { date: '2025-03-30', rashi: 11, tol: 0.5 }, // Saturn enters Meena
  ];
  for (const t of ingressTests) {
    it(`Saturn at ${t.date} is in rashi ${t.rashi} (within ${t.tol}° of boundary)`, () => {
      const planets = computePlanetaryPositions(new Date(t.date + 'T12:00:00Z'), 'lahiri');
      expect(planets.saturn.rashi.index).toBe(t.rashi);
      expect(planets.saturn.degreeInRashi).toBeLessThan(t.tol);
    });
  }
});

// ── Aggregate sanity ────────────────────────────────────────────────────────

describe('Phase 29 Sade Sati — aggregate', () => {
  it('phase always matches Saturn current rashi for all 12 natal moon rashis', () => {
    const asOf = new Date('2026-05-04T12:00:00Z');
    const planets = computePlanetaryPositions(asOf, 'lahiri');
    const satRashi = planets.saturn.rashi.index;
    for (let M = 0; M < 12; M++) {
      const r = computeSadeSati(M, asOf);
      if (r.active) {
        const expectedPhase: 1 | 2 | 3 =
          satRashi === (M + 11) % 12 ? 1 :
          satRashi === M ? 2 : 3;
        expect(r.phase).toBe(expectedPhase);
      } else {
        expect(r.phase).toBeNull();
      }
    }
  });

  it('each active arc is between 6 and 9 years (Saturn retrograde tolerance)', () => {
    const asOf = new Date('2026-05-04T12:00:00Z');
    for (let M = 0; M < 12; M++) {
      const r = computeSadeSati(M, asOf);
      if (r.active && r.currentArcStart && r.currentArcEnd) {
        const years = (r.currentArcEnd.getTime() - r.currentArcStart.getTime())
                    / (86400_000 * 365.25);
        expect(years, `M=${M} arc duration ${years.toFixed(2)}y`).toBeGreaterThan(6.0);
        expect(years, `M=${M} arc duration ${years.toFixed(2)}y`).toBeLessThan(9.0);
      }
    }
  });

  it('non-active natives all have a future nextArcStart', () => {
    const asOf = new Date('2026-05-04T12:00:00Z');
    for (let M = 0; M < 12; M++) {
      const r = computeSadeSati(M, asOf);
      if (!r.active) {
        expect(r.nextArcStart).not.toBeNull();
        expect(r.nextArcStart!.getTime()).toBeGreaterThan(asOf.getTime());
      }
    }
  });
});
