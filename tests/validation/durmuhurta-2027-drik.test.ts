/**
 * @tier 1  DrikPanchang day-panchang, Jaipur, one full week Feb 1–7 2027
 *
 * Dur Muhurta parity with DrikPanchang, pinned from the 2026-08-14 audit's
 * 58-day scrape (Jaipur Feb 2027 + Kolkata Nov 2026, geoname-ids 1269515 /
 * 1275004). The scrape established that drik follows the classical
 * Muhurta-Chintamani ordinal table with 0-based ordinals over 15 equal
 * day-muhurtas (sunrise→sunset) and, for Tuesday's second window, 15 equal
 * night-muhurtas (sunset→nextSunrise):
 *
 *   Sun [13] · Mon [8, 11] · Tue day[3] + night[6] · Wed [7] · Thu [5, 11] ·
 *   Fri [3, 8] · Sat [0, 1]
 *
 * — zero exceptions over all 58 days. The week below covers all 7 weekdays,
 * including the single-window days (Sun, Wed), the adjacent Saturday pair,
 * and Tuesday's past-midnight night window.
 *
 * Tolerance ±2 min: drik truncates displayed minutes and its sunrise can
 * differ from ours by up to ~0.5 min.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const JAIPUR = { latitude: 26.9124, longitude: 75.7873 };
const TOL_MIN = 2;

/** Drik-printed windows, IST wall-clock (`YYYY-MM-DDTHH:MM`). */
const FIXTURES: {
  date: string;
  windows: { start: string; end: string; segment: 'day' | 'night' }[];
}[] = [
  { date: '2027-02-01', windows: [ // Monday [8, 11]
    { start: '2027-02-01T13:02', end: '2027-02-01T13:46', segment: 'day' },
    { start: '2027-02-01T15:14', end: '2027-02-01T15:57', segment: 'day' },
  ] },
  { date: '2027-02-02', windows: [ // Tuesday day[3] + night[6] (past midnight)
    { start: '2027-02-02T09:24', end: '2027-02-02T10:07', segment: 'day' },
    { start: '2027-02-02T23:22', end: '2027-02-03T00:14', segment: 'night' },
  ] },
  { date: '2027-02-03', windows: [ // Wednesday [7] — single window
    { start: '2027-02-03T12:19', end: '2027-02-03T13:03', segment: 'day' },
  ] },
  { date: '2027-02-04', windows: [ // Thursday [5, 11]
    { start: '2027-02-04T10:51', end: '2027-02-04T11:35', segment: 'day' },
    { start: '2027-02-04T15:15', end: '2027-02-04T15:59', segment: 'day' },
  ] },
  { date: '2027-02-05', windows: [ // Friday [3, 8]
    { start: '2027-02-05T09:23', end: '2027-02-05T10:07', segment: 'day' },
    { start: '2027-02-05T13:03', end: '2027-02-05T13:47', segment: 'day' },
  ] },
  { date: '2027-02-06', windows: [ // Saturday [0, 1] — adjacent pair from sunrise
    { start: '2027-02-06T07:10', end: '2027-02-06T07:54', segment: 'day' },
    { start: '2027-02-06T07:54', end: '2027-02-06T08:38', segment: 'day' },
  ] },
  { date: '2027-02-07', windows: [ // Sunday [13] — single window
    { start: '2027-02-07T16:44', end: '2027-02-07T17:29', segment: 'day' },
  ] },
];

/** Minutes between a published local ISO string and a drik `YYYY-MM-DDTHH:MM`. */
function diffMin(publishedLocal: string, drik: string): number {
  return Math.abs(
    (Date.parse(publishedLocal.slice(0, 16) + ':00Z') - Date.parse(drik + ':00Z')) / 60_000,
  );
}

describe('Dur Muhurta vs DrikPanchang (Jaipur, Feb 1–7 2027)', () => {
  for (const f of FIXTURES) {
    it(`${f.date}: ${f.windows.length} window(s)`, () => {
      const [y, m, d] = f.date.split('-').map(Number) as [number, number, number];
      const r = getDailyPanchang(new Date(Date.UTC(y, m - 1, d, 12)), JAIPUR, { timezone: 330 });
      expect(r).not.toBeNull();
      const ours = r!.inauspicious.durMuhurta;
      expect(ours.length, `window count on ${f.date}`).toBe(f.windows.length);
      for (let i = 0; i < ours.length; i++) {
        expect(ours[i]!.segment, `w${i} segment ${f.date}`).toBe(f.windows[i]!.segment);
        expect(diffMin(ours[i]!.startLocal, f.windows[i]!.start), `w${i} start ${f.date}`)
          .toBeLessThanOrEqual(TOL_MIN);
        expect(diffMin(ours[i]!.endLocal, f.windows[i]!.end), `w${i} end ${f.date}`)
          .toBeLessThanOrEqual(TOL_MIN);
      }
    });
  }
});
