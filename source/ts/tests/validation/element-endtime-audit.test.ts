/**
 * @tier 1  Reference almanac: a drift audit, so the bound is the almanac's quantization plus our error
 *
 * The almanac truncates to the minute rather than rounding, so every comparison
 * here is against the midpoint of the printed minute and carries ±30 s of the
 * almanac's own quantization.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import { readTestData } from '../testdata';

const fixtures = readTestData('almanac', 'almanac-verified.json');

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

/** Midpoint of the printed minute; a `+1` suffix is the almanac's "next day". */
function almanacSecondsFromMidnight(hhmm: string): number {
  const nextDay = hhmm.endsWith('+1');
  const core = nextDay ? hhmm.slice(0, -2) : hhmm;
  const [h, m] = core.split(':').map(Number) as [number, number];
  return (nextDay ? 86_400 : 0) + h * 3600 + m * 60 + 30;
}

/** A UTC-midnight subtraction would not give the local wall clock this needs. */
function actualSecondsFromMidnight(local: string, dateStr: string): number {
  const dayDelta = Math.round(
    (Date.parse(`${local.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dateStr}T00:00:00Z`))
    / 86_400_000,
  );
  const [h, m, sec] = local.slice(11, 19).split(':').map(Number) as [number, number, number];
  return dayDelta * 86_400 + h * 3600 + m * 60 + sec;
}

/**
 * Measured maxima are tithi 42 s, karana 49 s, nakshatra 22 s, yoga 58 s; each
 * bound adds one almanac quantum of headroom, since a sixth fixture drawing
 * badly could legitimately land ±30 s worse.
 */
const TOLERANCE_SEC: Record<string, number> = {
  tithi: 76,
  karana: 81,
  nakshatra: 54,
  yoga: 90,
};

const withEndTimes = (fixtures as Fixture[]).filter((f) => f.expected.tithiEndHHMM);

describe('Element end-time drift vs the reference almanac', () => {
  it('has fixtures with published end times to audit', () => {
    expect(withEndTimes.length).toBeGreaterThan(0);
  });

  for (const f of withEndTimes) {
    const r = getDailyPanchang(noonUtc(f.date), f.location, { timezone: f.timezone });
    if (r === null) throw new Error(`no panchang for ${f.date}`);

    const cases: [string, string | null, string | undefined][] = [
      ['tithi', r.angas.tithis[0]!.endTimeLocal, f.expected.tithiEndHHMM],
      ['nakshatra', r.angas.nakshatras[0]!.endTimeLocal, f.expected.nakshatraEndHHMM],
      ['yoga', r.angas.yogas[0]!.endTimeLocal, f.expected.yogaEndHHMM],
      ['karana', r.angas.karanas[0]!.endTimeLocal, f.expected.karanaEndHHMM],
    ];

    for (const [element, actual, expected] of cases) {
      if (expected === undefined || actual === null) continue;
      const tolerance = TOLERANCE_SEC[element]!;
      it(`${f.date} ${f.city} ${element} end within ±${tolerance}s of the almanac (${expected})`, () => {
        const delta = actualSecondsFromMidnight(actual, f.date) - almanacSecondsFromMidnight(expected);
        expect(Math.abs(delta), `drift ${delta.toFixed(0)}s`).toBeLessThanOrEqual(tolerance);
      });
    }
  }

  it('drift no longer grows with ayanamsa exposure', () => {
    const drifts = { elongation: [] as number[], ayanamsa: [] as number[] };

    for (const f of withEndTimes) {
      const r = getDailyPanchang(noonUtc(f.date), f.location, { timezone: f.timezone });
      if (r === null) continue;
      const push = (bucket: number[], actual: string | null, expected?: string) => {
        if (actual && expected) {
          bucket.push(Math.abs(
            actualSecondsFromMidnight(actual, f.date) - almanacSecondsFromMidnight(expected),
          ));
        }
      };
      push(drifts.elongation, r.angas.tithis[0]!.endTimeLocal, f.expected.tithiEndHHMM);
      push(drifts.elongation, r.angas.karanas[0]!.endTimeLocal, f.expected.karanaEndHHMM);
      push(drifts.ayanamsa, r.angas.nakshatras[0]!.endTimeLocal, f.expected.nakshatraEndHHMM);
      push(drifts.ayanamsa, r.angas.yogas[0]!.endTimeLocal, f.expected.yogaEndHHMM);
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
      `ayanamsa-exposed mean ${meanAyanamsa.toFixed(1)}s vs ayanamsa-free ` +
        `${meanElongation.toFixed(1)}s: a ratio above 1 means the ayanamsa ` +
        `constant has drifted from the almanac's again`,
    ).toBeLessThan(1.0);
  });
});
