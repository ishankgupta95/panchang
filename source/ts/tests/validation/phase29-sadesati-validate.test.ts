/**
 * @tier 1  published Saturn transit dates (ProKerala / the reference almanac)
 *
 * Ingress dates are Barbara Pijan's Shani Gochara table (sidereal, Lahiri),
 * cross-checked against jagannathhora.com, hindupad.com and
 * digitalkarmakanda.com:
 * https://barbarapijan.com/bpa/Gochara_Shani/Shani_gochara_transits_table.htm
 *
 * On a retrograde dip Saturn enters a rashi, backs out, then re-enters
 * permanently. Most almanacs date Sade Sati from the FIRST touch, a minority
 * convention only from the PERMANENT ingress, so a boundary within ±2 days of
 * EITHER passes.
 */

import { describe, it, expect } from 'vitest';
import { computeSadeSati } from '../../src/jyotish/sadeSati';
import { computePlanetaryPositions } from '../../src/jyotish/planets';

type Ingress = { date: string; firstAlt?: string };
const SATURN_ENTERS: Record<string, Ingress[]> = {
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

type SadeSatiFixture = {
  label: string;
  natalMoonRashiName: string;
  asOf: string;
  expectedActive: boolean;
  expectedPhase: 1 | 2 | 3 | null;
  expectedArcStartRashi: string | null;
  expectedArcEndRashi: string | null;
};

const FIXTURES: SadeSatiFixture[] = [
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

  { label: 'Meena moon as-of 2024-01-01 (phase 1, Saturn in Kumbha)',
    natalMoonRashiName: 'Meena', asOf: '2024-01-01',
    expectedActive: true, expectedPhase: 1,
    expectedArcStartRashi: 'Kumbha', expectedArcEndRashi: 'Vrishabha' },
  { label: 'Meena moon as-of 2026-05-04 (phase 2, Saturn in Meena)',
    natalMoonRashiName: 'Meena', asOf: '2026-05-04',
    expectedActive: true, expectedPhase: 2,
    expectedArcStartRashi: 'Kumbha', expectedArcEndRashi: 'Vrishabha' },

  { label: 'Mesha moon as-of 2026-05-04 (phase 1, Saturn in Meena)',
    natalMoonRashiName: 'Mesha', asOf: '2026-05-04',
    expectedActive: true, expectedPhase: 1,
    expectedArcStartRashi: 'Meena', expectedArcEndRashi: 'Mithuna' },

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

describe('Phase 29 Sade Sati: Saturn position cross-check', () => {
  const ingressTests: Array<{ date: string; rashi: number; tol: number }> = [
    { date: '2014-11-03', rashi: 7, tol: 0.5 },
    { date: '2017-10-27', rashi: 8, tol: 0.5 },
    { date: '2020-01-24', rashi: 9, tol: 0.5 },
    { date: '2023-01-18', rashi: 10, tol: 0.5 },
    { date: '2025-03-30', rashi: 11, tol: 0.5 },
  ];
  for (const t of ingressTests) {
    it(`Saturn at ${t.date} is in rashi ${t.rashi} (within ${t.tol}° of boundary)`, () => {
      const planets = computePlanetaryPositions(new Date(t.date + 'T12:00:00Z'), 'lahiri');
      expect(planets.saturn.rashi.index).toBe(t.rashi);
      expect(planets.saturn.degreeInRashi).toBeLessThan(t.tol);
    });
  }
});

describe('Phase 29 Sade Sati: aggregate', () => {
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
