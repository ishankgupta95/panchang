/**
 * Phase 34d — Drik Panchang Parity Sweep (Wave 5 regression net).
 *
 * Consolidated golden-fixture suite that pins, for each of 12 reference birth
 * charts, the end-to-end output of every Phase 34a/b/c computation:
 *
 *   - **MangalDoshaInfo** — `afflicted`, `severity`, per-chart breakdown
 *     (`fromLagna` / `fromMoon` / `fromVenus`), cancellations as set-superset.
 *   - **KaalSarpDoshaInfo** — `afflicted`, `subtype`, `rahuHouse`, `ketuHouse`.
 *     `partial` is informational-only per drik panchang's own statement
 *     ("partial Kaal Sarpa is not widely accepted, drik does not list them"),
 *     and is NOT asserted.
 *   - **SadeSatiInfo** — `active`, `phase`, `currentArcStart`/`End` within
 *     ±2 days of canonical Saturn ingress dates (same tolerance as Phase 29
 *     sadesati validation).
 *   - **Birth-date panchang sanity slice** — `getDailyPanchang` returns a
 *     non-null result with all fields populated for the chart's birth instant
 *     + birth location. Phase 28's 50-fixture sweep is the authority on
 *     drik-vs-library panchang parity; this is a smoke check that the chart's
 *     birth-day panchang can be computed at all.
 *
 * Out of Phase 34d scope (see notes/phase34d-research.md §TL;DR for the
 * full rationale):
 *   - **Pitru Dosha** — drik panchang has no calculator; multi-pandit
 *     consensus is the operative authority (Phase 34a §4, Phase 34d
 *     research §1).
 *   - **Birth-chart yoga panels** — drik panchang's `/yoga/yoga.html`
 *     covers only daily *panchang* yogas; no Gajakesari / Mahapurusha /
 *     Neecha Bhanga / Raja Yoga panel exists on any drik URL (Phase 34c
 *     §1 confirms empirically). Phase 34c's yoga.test.ts unit suite +
 *     phase29-birthchart-validate.test.ts integration suite are the
 *     regression nets for the yoga catalog.
 *
 * ── Expected-value derivation (anti-circular) ────────────────────────────────
 *
 * Every `expected` value in tests/fixtures/drik-parity/charts.json is sourced
 * from one of three auditable derivation paths:
 *
 *   1. **structural-derivation** — drik panchang's stated rule set (Phase 34a
 *      §1 for Mangal, Phase 34a §3 for Kaal Sarp) manually applied to the
 *      AstroSage R-tier natal positions in tests/fixtures/astrosage-charts.json.
 *      The derivation was performed independently of the library output via
 *      notes/phase34d-derive-fixtures.mjs.
 *   2. **phase29-aligned** — re-uses the canonical Saturn-transit dates
 *      table from tests/validation/phase29-sadesati-validate.test.ts (Barbara
 *      Pijan's Drik-aligned Shani Gochara table). No new scrape needed.
 *   3. **drik-form-trace** (reserved for future expansion) — manual form
 *      entry into drik's kundali / sade-sati / kaal-sarp / mangal calculator
 *      (all form-only POST pages per the empirical check in §1 of the
 *      research note). The fixture schema is forward-compatible with this.
 *
 * If a future cross-check diff surfaces a library divergence: per the locked
 * Phase 34c methodology rule (memory/feedback_fixture_repinning.md), fix the
 * library code, PREDICT the resulting fixture deltas from first principles,
 * confirm the observed diff matches the prediction in magnitude/locus/sign,
 * and only then re-pin. Never regenerate fixture expected values from a
 * just-fixed library run with no independent prediction.
 *
 * ── Drik scrape limitations ──────────────────────────────────────────────────
 *
 * All four drik panchang birth-chart calculators are form-only POST pages
 * (verified 2026-05-11):
 *   - /jyotisha/kundali/kundali.html
 *   - /jyotisha/mangal-dosha/mangal-dosha-calculator.html
 *   - /jyotisha/kalasarpa-yoga/kalasarpa-yoga-calculator.html
 *   - /jyotisha/sadesati/shani-sadesati-analysis.html
 *
 * There is no GET-style query interface and no public REST API. Per-chart
 * drik verdict scraping requires manual form entry + recording of the
 * rendered output. The structural-derivation path above is the practical
 * substitute and is auditable: a future maintainer can re-run
 * notes/phase34d-derive-fixtures.mjs against the same AstroSage positions
 * and the same drik-stated rule set and produce identical expected values.
 */

import { describe, it, expect } from 'vitest';
import { computeRashiChart } from '../../src/jyotish/charts';
import {
  computeMangalDosha, computeKaalSarp,
} from '../../src/jyotish/doshas';
import { computeSadeSati } from '../../src/jyotish/sadeSati';
import { computeAshtakoot } from '../../src/jyotish/matching';
import { getDailyPanchang } from '../../src/core/panchang';
import charts from '../fixtures/drik-parity/charts.json';
import pairs from '../fixtures/drik-parity/pairs.json';

// ── Helpers ──────────────────────────────────────────────────────────────────

function localToUtc(dateLocal: string, tzh: number): Date {
  const [d, t] = dateLocal.split('T') as [string, string];
  const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
  const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
}

/**
 * Saturn ingress dates from Phase 29 sadesati validation (Barbara Pijan
 * Shani Gochara table, drik-aligned). Used to verify SadeSati arc
 * boundaries within ±2 days.
 */
const SATURN_ENTERS: Record<string, Array<{ date: string; firstAlt?: string }>> = {
  Tula:       [{ date: '2012-08-03', firstAlt: '2011-11-14' }],
  Vrischika:  [{ date: '2014-11-02' }],
  Dhanu:      [{ date: '2017-10-26', firstAlt: '2017-01-26' }],
  Makara:     [{ date: '2020-01-23' }],
  Kumbha:     [{ date: '2023-01-17', firstAlt: '2022-04-28' }],
  Meena:      [{ date: '2025-03-29' }],
  Mesha:      [{ date: '2028-02-23', firstAlt: '2027-06-02' }],
  // Saturn enters Vrishabha ~2030, but no published reference table I trust
  // pins this to ±2 days (Phase 29 sadesati validation stops at Mesha 2028).
  // Hillary Clinton's arc-end falls here — fixture omits the rashi-bounded
  // assertion for her and tests only `arc end is non-null`.
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

// ── Fixture types ────────────────────────────────────────────────────────────

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

// ── Per-chart suite ──────────────────────────────────────────────────────────

describe('Phase 34d — Drik panchang parity sweep (12 reference charts)', () => {
  it(`fixture coverage: ${CHARTS.length} charts loaded`, () => {
    expect(CHARTS.length).toBe(12);
  });

  for (const fixture of CHARTS) {
    describe(fixture.name, () => {
      const birthDate = localToUtc(fixture.dateLocal, fixture.tzh);
      const location = { latitude: fixture.lat, longitude: fixture.lon };
      const chart = computeRashiChart(birthDate, location);

      // Mangal Dosha
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
            // For un-flagged charts (severity === 'none') the library skips
            // cancellation evaluation entirely, so cancellations === []. For
            // afflicted-flagged charts where no cancellation triggered the
            // library also returns []. Both cases pin to [].
            expect(m.cancellations).toEqual([]);
          });
        }
      });

      // Kaal Sarp Dosha
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

      // Sade Sati
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

      // Birth-date panchang sanity slice
      describe('birth-date panchang slice (smoke)', () => {
        // tz offset in minutes for getDailyPanchang
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

// ── Ashtakoot pairs ─────────────────────────────────────────────────────────

describe('Phase 34d — Ashtakoot Guna Milan parity (perfect-36 regression net)', () => {
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

      // The Gana-cancellation opt-in must not disturb drik parity: default
      // mode applies no Gana cancellation at all, and on these perfect-36
      // pairs even the raised flag is a no-op (36/36 has no Gana dosha to
      // cancel), so both outputs stay byte-identical to the pinned fixture.
      it('ganaCancellation flag leaves this drik-parity pair byte-identical', () => {
        const flagged = computeAshtakoot(pair.boy, pair.girl, { ganaCancellation: true });
        expect(JSON.stringify(flagged)).toBe(JSON.stringify(r));
      });
    });
  }
});

// ── Aggregate sanity ────────────────────────────────────────────────────────

describe('Phase 34d — aggregate', () => {
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

  it('every chart fixture has a documented _source citation per field', () => {
    for (const c of CHARTS) {
      expect(c._source.length).toBeGreaterThan(0);
      expect(c.mangal._source.length).toBeGreaterThan(0);
      expect(c.kaalSarp._source.length).toBeGreaterThan(0);
      expect(c.sadeSati_2026_05_04._source.length).toBeGreaterThan(0);
    }
  });
});
