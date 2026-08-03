/**
 * Drift audit for **element end times** (tithi / nakshatra / yoga / karana)
 * against DrikPanchang.
 *
 * `seconds-audit.test.ts` already audits sunrise/sunset, but those come
 * straight out of astronomy-engine at sub-second accuracy — they were never
 * the risky values. The end times are: each one is the output of a binary
 * search whose tolerance bounds it, and until now nothing asserted them, even
 * though `drikpanchang-verified.json` has carried the Drik values all along.
 *
 * ## What this found
 *
 * The drift is *systematic per element type*, not random, and it barely moves
 * when `precision: 'high'` tightens the search from ±30 s to ±1 s (worst case
 * 131 s → 133 s). So the residual is a model difference from Drik, not a
 * search artifact:
 *
 *   tithi      +6 … +57 s   (Moon − Sun; ayanamsa cancels)   mean |Δ| 37 s
 *   karana     +14 … +59 s  (Moon − Sun; ayanamsa cancels)   mean |Δ| 42 s
 *   nakshatra  −38 … −63 s  (Moon; ayanamsa applied once)    mean |Δ| 55 s
 *   yoga       −69 … −131 s (Moon + Sun; ayanamsa twice)     mean |Δ| 106 s
 *
 * The split tracks ayanamsa exposure exactly. The ayanamsa-free elements agree
 * to within the search tolerance; the ayanamsa-dependent ones run early, and
 * yoga — which carries the offset twice — runs roughly twice as early as
 * nakshatra. That is the signature of this library's Lahiri ayanamsa sitting
 * ~0.0076° (≈27 arcsec) ahead of Drik's: 0.0076° / 13.18°·day⁻¹ ≈ 50 s for
 * nakshatra, and 2 × 0.0076° / 14.17°·day⁻¹ ≈ 93 s for yoga, against ~50 s and
 * ~110 s observed.
 *
 * That is left **unchanged** here deliberately. Retuning the ayanamsa constant
 * would move every sidereal output in the library and re-pin a large number of
 * fixtures; it is a decision to take on its own evidence, not a side effect of
 * adding an audit. This test's job is to make the drift visible and stop it
 * growing. The bounds below sit just above the observed worst case per element,
 * so a regression that widens the gap — or flips a sign — fails loudly.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import fixtures from '../fixtures/drikpanchang-verified.json';

type Fixture = {
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expected: {
    tithiEndHHMM?: string;
    nakshatraEndHHMM?: string;
    yogaEndHHMM?: string;
    karanaEndHHMM?: string;
  };
};

function noonUtc(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/**
 * Drik prints `HH:MM`, optionally suffixed `+1` for "next day". Treat the
 * printed minute as [HH:MM:00, HH:MM:59] and compare against its midpoint, so
 * a perfectly-accurate value scores 0 rather than ±30 s of rounding.
 */
function drikSecondsFromMidnight(hhmm: string): number {
  const nextDay = hhmm.endsWith('+1');
  const core = nextDay ? hhmm.slice(0, -2) : hhmm;
  const [h, m] = core.split(':').map(Number) as [number, number];
  return (nextDay ? 86_400 : 0) + h * 3600 + m * 60 + 30;
}

/** Seconds from local midnight of `dateStr` for an offset-adjusted Date. */
function actualSecondsFromMidnight(d: Date, dateStr: string): number {
  const [y, m, day] = dateStr.split('-').map(Number) as [number, number, number];
  return (d.getTime() - Date.UTC(y, m - 1, day, 0, 0, 0, 0)) / 1000;
}

/**
 * Per-element bounds, set just above the measured worst case with ~20% of
 * headroom. Intentionally *not* uniform — a single loose bound would hide the
 * fact that the ayanamsa-free elements track Drik much more closely.
 *
 * Measured maxima at the time of writing: tithi 44.6 s, karana 90.5 s,
 * nakshatra 82.4 s, yoga 146.5 s.
 */
const TOLERANCE_SEC: Record<string, number> = {
  tithi: 60,
  karana: 110,
  nakshatra: 100,
  yoga: 170,
};

const withEndTimes = (fixtures as Fixture[]).filter((f) => f.expected.tithiEndHHMM);

describe('Element end-time drift vs DrikPanchang', () => {
  it('has fixtures with published end times to audit', () => {
    // Guard against the audit silently becoming a no-op if the fixture shape
    // changes — these fields sat unused in the repo before this test existed.
    expect(withEndTimes.length).toBeGreaterThan(0);
  });

  for (const f of withEndTimes) {
    const r = getDailyPanchang(noonUtc(f.date), f.location, { timezone: f.timezone });
    if (r === null) throw new Error(`no panchang for ${f.date}`);

    const cases: [string, Date | null, string | undefined][] = [
      ['tithi', r.tithis[0]!.endTime, f.expected.tithiEndHHMM],
      ['nakshatra', r.nakshatras[0]!.endTime, f.expected.nakshatraEndHHMM],
      ['yoga', r.yogas[0]!.endTime, f.expected.yogaEndHHMM],
      ['karana', r.karanas[0]!.endTime, f.expected.karanaEndHHMM],
    ];

    for (const [element, actual, expected] of cases) {
      if (expected === undefined || actual === null) continue;
      const tolerance = TOLERANCE_SEC[element]!;
      it(`${f.date} ${f.city} ${element} end within ±${tolerance}s of Drik (${expected})`, () => {
        const delta = actualSecondsFromMidnight(actual, f.date) - drikSecondsFromMidnight(expected);
        expect(Math.abs(delta), `drift ${delta.toFixed(0)}s`).toBeLessThanOrEqual(tolerance);
      });
    }
  }

  it('ayanamsa-free elements track Drik roughly twice as closely', () => {
    // The load-bearing assertion: it pins the *shape* of the disagreement, so
    // that if someone retunes the ayanamsa the relationship changes and this
    // test reports it rather than the per-element bounds silently absorbing it.
    //
    // Compared on means rather than maxima. A single fixture's worst case is
    // dominated by where its transition happens to fall inside the ±30 s search
    // bracket; the mean averages that out and isolates the systematic offset,
    // which is what the ayanamsa hypothesis predicts.
    const drifts = { elongation: [] as number[], ayanamsa: [] as number[] };

    for (const f of withEndTimes) {
      const r = getDailyPanchang(noonUtc(f.date), f.location, { timezone: f.timezone });
      if (r === null) continue;
      const push = (bucket: number[], actual: Date | null, expected?: string) => {
        if (actual && expected) {
          bucket.push(Math.abs(
            actualSecondsFromMidnight(actual, f.date) - drikSecondsFromMidnight(expected),
          ));
        }
      };
      // Ayanamsa cancels in Moon − Sun.
      push(drifts.elongation, r.tithis[0]!.endTime, f.expected.tithiEndHHMM);
      push(drifts.elongation, r.karanas[0]!.endTime, f.expected.karanaEndHHMM);
      // Ayanamsa applies once (nakshatra) and twice (yoga).
      push(drifts.ayanamsa, r.nakshatras[0]!.endTime, f.expected.nakshatraEndHHMM);
      push(drifts.ayanamsa, r.yogas[0]!.endTime, f.expected.yogaEndHHMM);
    }

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanElongation = mean(drifts.elongation);
    const meanAyanamsa = mean(drifts.ayanamsa);

    expect(drifts.elongation.length).toBeGreaterThan(0);
    expect(
      meanElongation,
      `elongation-based mean drift ${meanElongation.toFixed(1)}s should stay ` +
        `within the search tolerance band`,
    ).toBeLessThan(60);
    expect(
      meanAyanamsa / meanElongation,
      `ayanamsa-based mean ${meanAyanamsa.toFixed(1)}s vs elongation-based ` +
        `${meanElongation.toFixed(1)}s — if this ratio has collapsed toward 1, ` +
        `the ayanamsa was retuned and this audit's header needs updating`,
    ).toBeGreaterThan(1.5);
  });
});
