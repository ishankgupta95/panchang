/**
 * @tier 1  Reference-almanac day-panchang, 61 scraped days (Aug 1 to Sep 30 2026, Ujjain)
 *
 * Windows pinned in IST wall-clock from the almanac's day-panchang page,
 * geoname-id 1253914. A window belongs to the Hindu day its START falls in, so
 * one beginning before sunrise appears only on the previous day's page. Mula
 * alone carries two tyajya spells, at elapsed ghatikas 20 (B.V. Raman's
 * "Muhurta") and 56 (the almanac's tutorial table). TOL_MIN 2 covers a 1.7 min
 * residual: the almanac truncates displayed minutes and its SwissEph frame
 * carries nutation, ours mean-frame.
 */
import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const UJJAIN = { latitude: 23.1765, longitude: 75.7885 };
const TOL_MIN = 2;

const FIXTURES: { date: string; windows: { start: string; end: string }[] }[] = [
  { date: '2026-08-08', windows: [
    { start: '2026-08-08T09:28', end: '2026-08-08T10:57' },
    { start: '2026-08-08T21:57', end: '2026-08-08T23:24' },
  ] },
  { date: '2026-08-23', windows: [
    { start: '2026-08-23T15:57', end: '2026-08-23T17:44' },
    { start: '2026-08-24T04:26', end: '2026-08-24T06:13' },
  ] },
  { date: '2026-09-04', windows: [
    { start: '2026-09-04T15:32', end: '2026-09-04T17:02' },
    { start: '2026-09-05T04:18', end: '2026-09-05T05:48' },
  ] },
  { date: '2026-09-07', windows: [
    { start: '2026-09-07T07:03', end: '2026-09-07T08:32' },
    { start: '2026-09-08T01:42', end: '2026-09-08T03:12' },
  ] },
  { date: '2026-09-19', windows: [
    { start: '2026-09-19T07:44', end: '2026-09-19T09:32' },
    { start: '2026-09-19T23:55', end: '2026-09-20T01:43' },
  ] },
  { date: '2026-08-22', windows: [
    { start: '2026-08-22T23:47', end: '2026-08-23T01:35' },
  ] },
  { date: '2026-08-24', windows: [
    { start: '2026-08-25T05:16', end: '2026-08-25T07:01' },
  ] },
  { date: '2026-08-25', windows: [
    { start: '2026-08-26T03:10', end: '2026-08-26T04:54' },
  ] },
  { date: '2026-08-02', windows: [] },
  { date: '2026-08-27', windows: [] },
  { date: '2026-09-06', windows: [] },
  { date: '2026-09-18', windows: [] },
];

function diffMin(publishedLocal: string, almanac: string): number {
  return Math.abs(
    (Date.parse(publishedLocal.slice(0, 16) + ':00Z') - Date.parse(almanac + ':00Z')) / 60_000,
  );
}

describe('Varjyam multi-window vs the reference almanac (Ujjain, Aug-Sep 2026)', () => {
  for (const f of FIXTURES) {
    it(`${f.date}: ${f.windows.length} window(s)`, () => {
      const [y, m, d] = f.date.split('-').map(Number) as [number, number, number];
      const r = getDailyPanchang(new Date(Date.UTC(y, m - 1, d, 12)), UJJAIN, { timezone: 330 });
      expect(r).not.toBeNull();
      const ours = r!.inauspicious.varjyam;
      expect(ours.length, `window count on ${f.date}`).toBe(f.windows.length);
      for (let i = 0; i < ours.length; i++) {
        expect(diffMin(ours[i]!.startLocal, f.windows[i]!.start), `w${i} start ${f.date}`)
          .toBeLessThanOrEqual(TOL_MIN);
        expect(diffMin(ours[i]!.endLocal, f.windows[i]!.end), `w${i} end ${f.date}`)
          .toBeLessThanOrEqual(TOL_MIN);
      }
    });
  }
});
