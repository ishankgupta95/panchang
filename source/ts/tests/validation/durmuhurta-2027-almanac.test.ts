/**
 * @tier 1  reference-almanac day-panchang, Jaipur, one full week Feb 1-7 2027
 *
 * Muhurta-Chintamani ordinals, 0-based over 15 equal day-muhurtas (sunrise to
 * sunset) and, for Tuesday's second window, 15 equal night-muhurtas:
 *   Sun [13] · Mon [8, 11] · Tue day[3] + night[6] · Wed [7] · Thu [5, 11] ·
 *   Fri [3, 8] · Sat [0, 1]
 *
 * Tolerance ±2 min: the almanac truncates displayed minutes and its sunrise can
 * differ from ours by up to ~0.5 min.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const JAIPUR = { latitude: 26.9124, longitude: 75.7873 };
const TOL_MIN = 2;

/** Almanac-printed windows, IST wall-clock (`YYYY-MM-DDTHH:MM`). */
const FIXTURES: {
  date: string;
  windows: { start: string; end: string; segment: 'day' | 'night' }[];
}[] = [
  { date: '2027-02-01', windows: [
    { start: '2027-02-01T13:02', end: '2027-02-01T13:46', segment: 'day' },
    { start: '2027-02-01T15:14', end: '2027-02-01T15:57', segment: 'day' },
  ] },
  { date: '2027-02-02', windows: [
    { start: '2027-02-02T09:24', end: '2027-02-02T10:07', segment: 'day' },
    { start: '2027-02-02T23:22', end: '2027-02-03T00:14', segment: 'night' },
  ] },
  { date: '2027-02-03', windows: [
    { start: '2027-02-03T12:19', end: '2027-02-03T13:03', segment: 'day' },
  ] },
  { date: '2027-02-04', windows: [
    { start: '2027-02-04T10:51', end: '2027-02-04T11:35', segment: 'day' },
    { start: '2027-02-04T15:15', end: '2027-02-04T15:59', segment: 'day' },
  ] },
  { date: '2027-02-05', windows: [
    { start: '2027-02-05T09:23', end: '2027-02-05T10:07', segment: 'day' },
    { start: '2027-02-05T13:03', end: '2027-02-05T13:47', segment: 'day' },
  ] },
  { date: '2027-02-06', windows: [
    { start: '2027-02-06T07:10', end: '2027-02-06T07:54', segment: 'day' },
    { start: '2027-02-06T07:54', end: '2027-02-06T08:38', segment: 'day' },
  ] },
  { date: '2027-02-07', windows: [
    { start: '2027-02-07T16:44', end: '2027-02-07T17:29', segment: 'day' },
  ] },
];

function diffMin(publishedLocal: string, almanac: string): number {
  return Math.abs(
    (Date.parse(publishedLocal.slice(0, 16) + ':00Z') - Date.parse(almanac + ':00Z')) / 60_000,
  );
}

describe('Dur Muhurta vs the reference almanac (Jaipur, Feb 1-7 2027)', () => {
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
