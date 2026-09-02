/**
 * @tier 1  reference-almanac sunrise/sunset at HH:MM granularity
 *
 * The almanac prints HH:MM, read here as the minute centre HH:MM:30.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import { readTestData } from '../testdata';

const fixtures = readTestData('almanac', 'almanac-verified.json');

function noonUtc(s: string) {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function secondsOfDay(local: string) {
  const [h, m, s] = local.slice(11, 19).split(':').map(Number) as [number, number, number];
  return h * 3600 + m * 60 + s;
}

function almanacMidpointSeconds(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 3600 + m * 60 + 30;
}

type Fixture = {
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expected: { sunriseHHMM: string; sunsetHHMM: string };
};

const SECONDS_TOL = 45;

describe('Phase 19-5 seconds-precision audit', () => {
  for (const f of fixtures as Fixture[]) {
    const r = getDailyPanchang(noonUtc(f.date), f.location, { timezone: f.timezone })!;

    for (const kind of ['sunrise', 'sunset'] as const) {
      const hhmm = kind === 'sunrise' ? f.expected.sunriseHHMM : f.expected.sunsetHHMM;
      const actual = kind === 'sunrise' ? r.sun.riseLocal : r.sun.setLocal;
      const deltaSec = secondsOfDay(actual) - almanacMidpointSeconds(hhmm);

      it(`${f.date} ${f.city} ${kind} within ±${SECONDS_TOL}s of almanac midpoint (${hhmm})`, () => {
        expect(Math.abs(deltaSec)).toBeLessThanOrEqual(SECONDS_TOL);
      });
    }
  }
});
