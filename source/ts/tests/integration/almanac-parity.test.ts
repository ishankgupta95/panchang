/**
 * Every `expected` in testdata/almanac/almanac-parity/charts.json is derived by
 * hand from the almanac's stated rules against the AstroSage natal positions in
 * testdata/charts/astrosage-charts.json, never from a library run. On a
 * divergence, fix the library, predict the fixture deltas from first
 * principles, confirm, and only then re-pin.
 *
 * `partial` on KaalSarpDoshaInfo is deliberately unasserted: the reference
 * almanac does not list partial Kaal Sarpa.
 */

import { describe, it, expect } from 'vitest';
import { computeRashiChart } from '../../src/jyotish/charts';
import {
  computeMangalDosha, computeKaalSarp,
} from '../../src/jyotish/doshas';
import { computeSadeSati } from '../../src/jyotish/sadeSati';
import { computeAshtakoot } from '../../src/jyotish/matching';
import { getDailyPanchang } from '../../src/core/panchang';
import { readTestData } from '../testdata';

const charts = readTestData('almanac', 'almanac-parity', 'charts.json');
const pairs = readTestData('almanac', 'almanac-parity', 'pairs.json');

function localToUtc(dateLocal: string, tzh: number): Date {
  const [d, t] = dateLocal.split('T') as [string, string];
  const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
  const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
}

/** Saturn ingress dates from Barbara Pijan's Shani Gochara table. */
const SATURN_ENTERS: Record<string, Array<{ date: string; firstAlt?: string }>> = {
  Tula:       [{ date: '2012-08-03', firstAlt: '2011-11-14' }],
  Vrischika:  [{ date: '2014-11-02' }],
  Dhanu:      [{ date: '2017-10-26', firstAlt: '2017-01-26' }],
  Makara:     [{ date: '2020-01-23' }],
  Kumbha:     [{ date: '2023-01-17', firstAlt: '2022-04-28' }],
  Meena:      [{ date: '2025-03-29' }],
  Mesha:      [{ date: '2028-02-23', firstAlt: '2027-06-02' }],
  // The table stops here: no published reference pins Saturn's later ingresses
  // to ±2 days, and computing them would self-seed the fixture.
};

function withinIngress(boundary: Date, rashiName: string, tolDays = 2): boolean {
  const candidates = SATURN_ENTERS[rashiName] ?? [];
  for (const c of candidates) {
    const dates = [new Date(c.date + 'T00:00:00Z')];
    if (c.firstAlt) dates.push(new Date(c.firstAlt + 'T00:00:00Z'));
    for (const d of dates) {
      const days = Math.abs(boundary.getTime() - d.getTime()) / 86400_000;
      if (days <= tolDays) return true;
    }
  }
  return false;
}

type ExpectedMangal = {
  _source: string;
  afflicted: boolean;
  severity: 'none' | 'anshik' | 'purna';
  fromLagna: { afflicted: boolean; house: number };
  fromMoon:  { afflicted: boolean; house: number };
  fromVenus: { afflicted: boolean; house: number };
  cancellationsContain: string[];
};

type ExpectedKaalSarp = {
  _source: string;
  afflicted: boolean;
  subtype: string | null;
  rahuHouse: number;
  ketuHouse: number;
};

type ExpectedSadeSati = {
  _source: string;
  active: boolean;
  phase: 1 | 2 | 3 | null;
  expectedArcStartRashi?: string;
  expectedArcEndRashi?: string;
};

type ChartFixture = {
  name: string;
  _source: string;
  dateLocal: string;
  tzh: number;
  lat: number;
  lon: number;
  natalMoonRashi: number;
  natalMoonRashiName: string;
  natalMoonNakshatra: number;
  natalMoonNakshatraName: string;
  natalLagnaRashi: number;
  natalLagnaRashiName: string;
  mangal: ExpectedMangal;
  kaalSarp: ExpectedKaalSarp;
  sadeSati_2026_05_04: ExpectedSadeSati;
};

type PairFixture = {
  label: string;
  _source: string;
  boy: { rashi: number; nakshatra: number };
  girl: { rashi: number; nakshatra: number };
  expectedTotal: number;
  expectedKoots: Record<string, number>;
  expectedNadiCancellation: boolean;
};

const CHARTS: ChartFixture[] = (charts as { charts: ChartFixture[] }).charts;
const PAIRS: PairFixture[] = (pairs as { pairs: PairFixture[] }).pairs;

const SADE_SATI_ASOF = new Date('2026-05-04T12:00:00Z');

describe('Reference-almanac parity sweep (12 reference charts)', () => {
  it(`fixture coverage: ${CHARTS.length} charts loaded`, () => {
    expect(CHARTS.length).toBe(12);
  });

  for (const fixture of CHARTS) {
    describe(fixture.name, () => {
      const birthDate = localToUtc(fixture.dateLocal, fixture.tzh);
      const location = { latitude: fixture.lat, longitude: fixture.lon };
      const chart = computeRashiChart(birthDate, location);

      describe('Mangal Dosha', () => {
        const m = computeMangalDosha(chart);
        const exp = fixture.mangal;

        it('afflicted matches structural derivation', () => {
          expect(m.afflicted).toBe(exp.afflicted);
        });

        it('severity matches structural derivation', () => {
          expect(m.severity).toBe(exp.severity);
        });

        it('fromLagna breakdown matches', () => {
          expect(m.fromLagna).toEqual(exp.fromLagna);
        });

        it('fromMoon breakdown matches', () => {
          expect(m.fromMoon).toEqual(exp.fromMoon);
        });

        it('fromVenus breakdown matches', () => {
          expect(m.fromVenus).toEqual(exp.fromVenus);
        });

        if (exp.cancellationsContain.length > 0) {
          it(`cancellations superset contains [${exp.cancellationsContain.join(', ')}]`, () => {
            for (const expectedPrefix of exp.cancellationsContain) {
              const found = m.cancellations.some((s) => s.includes(expectedPrefix));
              expect(found, `expected cancellation containing "${expectedPrefix}", got [${m.cancellations.join('; ')}]`).toBe(true);
            }
          });
        } else {
          it('no cancellations fire (when afflicted-flagged-then-cancelled, expected empty)', () => {
            expect(m.cancellations).toEqual([]);
          });
        }
      });

      describe('Kaal Sarp Dosha', () => {
        const k = computeKaalSarp(chart);
        const exp = fixture.kaalSarp;

        it('afflicted matches structural derivation', () => {
          expect(k.afflicted).toBe(exp.afflicted);
        });

        it('subtype matches', () => {
          expect(k.subtype).toBe(exp.subtype);
        });

        it('rahuHouse matches', () => {
          expect(k.rahuHouse).toBe(exp.rahuHouse);
        });

        it('ketuHouse matches', () => {
          expect(k.ketuHouse).toBe(exp.ketuHouse);
        });
      });

      describe('Sade Sati @ 2026-05-04', () => {
        const s = computeSadeSati(fixture.natalMoonRashi, SADE_SATI_ASOF);
        const exp = fixture.sadeSati_2026_05_04;

        it(`active = ${exp.active}`, () => {
          expect(s.active).toBe(exp.active);
        });

        it(`phase = ${exp.phase}`, () => {
          expect(s.phase).toBe(exp.phase);
        });

        if (exp.active && exp.expectedArcStartRashi) {
          it(`arc start within ±2 days of Saturn entering ${exp.expectedArcStartRashi}`, () => {
            expect(s.currentArcStart).not.toBeNull();
            expect(withinIngress(s.currentArcStart!, exp.expectedArcStartRashi!))
              .toBe(true);
          });
        }

        if (exp.active && exp.expectedArcEndRashi
            && SATURN_ENTERS[exp.expectedArcEndRashi]) {
          it(`arc end within ±2 days of Saturn entering ${exp.expectedArcEndRashi}`, () => {
            expect(s.currentArcEnd).not.toBeNull();
            expect(withinIngress(s.currentArcEnd!, exp.expectedArcEndRashi!))
              .toBe(true);
          });
        }

        if (!exp.active) {
          it('non-active: arc dates null, nextArcStart populated', () => {
            expect(s.currentArcStart).toBeNull();
            expect(s.currentArcEnd).toBeNull();
            expect(s.nextArcStart).not.toBeNull();
          });
        }
      });

      describe('birth-date panchang slice (smoke)', () => {
        const tzMin = Math.round(fixture.tzh * 60);
        const r = getDailyPanchang(birthDate, location, { timezone: tzMin });

        it('returns a non-null result', () => {
          expect(r).not.toBeNull();
        });

        it('sunrise / sunset / nextSunrise are Date objects with sunset > sunrise', () => {
          expect(r!.sun.rise).toBeInstanceOf(Date);
          expect(r!.sun.set).toBeInstanceOf(Date);
          expect(r!.sun.nextRise).toBeInstanceOf(Date);
          expect(r!.sun.set.getTime()).toBeGreaterThan(r!.sun.rise.getTime());
          expect(r!.sun.nextRise.getTime()).toBeGreaterThan(r!.sun.set.getTime());
        });

        it('tithis / nakshatras / yogas / karanas / vara are present and non-empty', () => {
          expect(r!.angas.tithis.length).toBeGreaterThan(0);
          expect(r!.angas.nakshatras.length).toBeGreaterThan(0);
          expect(r!.angas.yogas.length).toBeGreaterThan(0);
          expect(r!.angas.karanas.length).toBeGreaterThan(0);
          expect(r!.angas.vara.englishName.length).toBeGreaterThan(0);
        });
      });
    });
  }
});

describe('Ashtakoot Guna Milan parity (perfect-36 regression net)', () => {
  it(`fixture coverage: ${PAIRS.length} pairs loaded`, () => {
    expect(PAIRS.length).toBe(3);
  });

  for (const pair of PAIRS) {
    describe(pair.label, () => {
      const r = computeAshtakoot(pair.boy, pair.girl);

      it(`totalScore equals expected ${pair.expectedTotal}`, () => {
        expect(r.totalScore).toBe(pair.expectedTotal);
      });

      for (const kootName of Object.keys(pair.expectedKoots)) {
        it(`koot "${kootName}" scores ${pair.expectedKoots[kootName]}`, () => {
          const k = r.koots.find((x) => x.name === kootName);
          expect(k).toBeDefined();
          expect(k!.score).toBe(pair.expectedKoots[kootName]);
        });
      }

      if (pair.expectedNadiCancellation) {
        it('Nadi cancellation fires (same-nakshatra rule)', () => {
          expect(r.cancellations.some((c) => c.startsWith('Nadi'))).toBe(true);
        });
      }

      // A perfect-36 pair carries no Gana dosha, so there is nothing to cancel.
      it('ganaCancellation flag leaves this almanac-parity pair byte-identical', () => {
        const flagged = computeAshtakoot(pair.boy, pair.girl, { ganaCancellation: true });
        expect(JSON.stringify(flagged)).toBe(JSON.stringify(r));
      });
    });
  }
});

describe('Reference-almanac parity: aggregate', () => {
  it('Mangal verdicts spread across afflicted / non-afflicted', () => {
    const afflictedCount = CHARTS.filter((c) => c.mangal.afflicted).length;
    const cleanCount = CHARTS.filter((c) => !c.mangal.afflicted).length;
    expect(afflictedCount).toBeGreaterThanOrEqual(2);
    expect(cleanCount).toBeGreaterThanOrEqual(2);
  });

  it('Kaal Sarp coverage includes at least one afflicted case', () => {
    expect(CHARTS.some((c) => c.kaalSarp.afflicted)).toBe(true);
  });

  it('Sade Sati coverage includes both active and inactive natives', () => {
    expect(CHARTS.some((c) => c.sadeSati_2026_05_04.active)).toBe(true);
    expect(CHARTS.some((c) => !c.sadeSati_2026_05_04.active)).toBe(true);
  });

  it('Mangal severities span all three labels', () => {
    const severities = new Set(CHARTS.map((c) => c.mangal.severity));
    expect(severities.has('none')).toBe(true);
    expect(severities.has('anshik')).toBe(true);
    expect(severities.has('purna')).toBe(true);
  });

  /**
   * The per-chart arc assertions live inside `if` guards, so a fixture that
   * stops satisfying one produces no test rather than a failing one. `ends` is
   * pinned at 0 as the honest current state, so a reference date that makes one
   * live has to come here and say so.
   */
  it('arc-boundary coverage: 2 starts checked, 0 ends checked (1 unreferenced, 1 absent)', () => {
    let startsChecked = 0, endsChecked = 0, endsUnreferenced = 0, endsAbsent = 0;
    for (const c of CHARTS) {
      const exp = c.sadeSati_2026_05_04;
      if (!exp.active) continue;
      if (exp.expectedArcStartRashi && SATURN_ENTERS[exp.expectedArcStartRashi]) startsChecked++;
      if (!exp.expectedArcEndRashi) endsAbsent++;
      else if (SATURN_ENTERS[exp.expectedArcEndRashi]) endsChecked++;
      else endsUnreferenced++;
    }
    expect({ startsChecked, endsChecked, endsUnreferenced, endsAbsent })
      .toEqual({ startsChecked: 2, endsChecked: 0, endsUnreferenced: 1, endsAbsent: 1 });
  });

  it('every chart fixture has a documented _source citation per field', () => {
    for (const c of CHARTS) {
      expect(c._source.length).toBeGreaterThan(0);
      expect(c.mangal._source.length).toBeGreaterThan(0);
      expect(c.kaalSarp._source.length).toBeGreaterThan(0);
      expect(c.sadeSati_2026_05_04._source.length).toBeGreaterThan(0);
    }
  });
});
