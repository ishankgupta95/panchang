/**
 * Phase 19-5 — Seconds-precision audit for sunrise/sunset vs Drik fixtures.
 *
 * Drik publishes sunrise/sunset at HH:MM granularity. We compute at
 * sub-second precision. This test reports the actual seconds-level drift
 * and asserts a tight upper bound so we can make an honest precision
 * claim in the README without hiding sub-minute drift.
 *
 * Interpretation: Drik's "HH:MM" is treated as the nearest-minute center,
 * so the true time lies in [HH:MM:00, HH:MM:59]. We measure the signed
 * delta from the minute midpoint (HH:MM:30).
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import fixtures from '../fixtures/drikpanchang-verified.json';

function noonUtc(s: string) {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function secondsOfDay(d: Date) {
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}

function drikMidpointSeconds(hhmm: string) {
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

// Observed worst-case (2026-04 audit): |Δ| ≤ 29s across all 16 sunrise/sunset
// measurements. Tolerance set to ±45s to absorb future fixture additions
// while still representing an honest sub-minute claim — Drik itself only
// publishes HH:MM, so ≤30s error is effectively within-the-printed-minute.
const SECONDS_TOL = 45;

describe('Phase 19-5 seconds-precision audit', () => {
  for (const f of fixtures as Fixture[]) {
    const r = getDailyPanchang(noonUtc(f.date), f.location, { timezone: f.timezone });

    for (const kind of ['sunrise', 'sunset'] as const) {
      const hhmm = kind === 'sunrise' ? f.expected.sunriseHHMM : f.expected.sunsetHHMM;
      const actual = r[kind];
      const deltaSec = secondsOfDay(actual) - drikMidpointSeconds(hhmm);

      it(`${f.date} ${f.city} ${kind} within ±${SECONDS_TOL}s of Drik midpoint (${hhmm})`, () => {
        expect(Math.abs(deltaSec)).toBeLessThanOrEqual(SECONDS_TOL);
      });
    }
  }
});
