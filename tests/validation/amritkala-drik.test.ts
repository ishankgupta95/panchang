/**
 * @tier 1  DrikPanchang day-panchang "Amrit Kalam" rows (Jaipur Feb 2027 +
 *          Kolkata Nov 2026, geoname-ids 1269515 / 1275004)
 *
 * Amrit Kala parity with DrikPanchang, pinned from the 2026-08-14 audit's
 * 58-day scrape. The scrape established that drik's Amrit Kalam is the
 * VARJYAM ARCHITECTURE with a different offset table:
 *
 *   - anchored at the nakshatra's OWN START (not sunrise);
 *   - offset = per-nakshatra elapsed ghatikas in the nakshatra-elastic
 *     frame (nakshatra span / 60), from AMRIT_KALA_OFFSET_GHATIKAS;
 *   - width exactly 4.0 such ghatikas (~84–108 min);
 *   - attributed to the Hindu day the window STARTS in (post-midnight
 *     windows print on the prior day's page — Feb 2 below);
 *   - 0..2 windows per day (Feb 3 below is drik's empty day).
 *
 * 54 windows over the sweep covered all 27 nakshatras with offset spread
 * ≤0.1 ghati. The pre-5.2 sunrise-anchored model disagreed with these rows
 * by up to ~16 h.
 *
 * Tolerance ±2 min (drik truncates displayed minutes; its SwissEph frame
 * carries nutation against our mean frame — same bound as Varjyam).
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const JAIPUR = { latitude: 26.9124, longitude: 75.7873 };
const KOLKATA = { latitude: 22.5726, longitude: 88.3639 };
const TOL_MIN = 2;

/** Drik-printed windows, IST wall-clock (`YYYY-MM-DDTHH:MM`). */
const FIXTURES: {
  city: string; loc: { latitude: number; longitude: number };
  date: string; windows: { start: string; end: string }[];
}[] = [
  // ── Jaipur, Feb 2027 ──
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-01', windows: [
    { start: '2027-02-01T23:29', end: '2027-02-02T01:17' },
  ] },
  // Post-midnight window attributed to the Hindu day it starts in: drik's
  // Feb 2 page prints "05:12 AM, Feb 03 to 07:01 AM, Feb 03".
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-02', windows: [
    { start: '2027-02-03T05:12', end: '2027-02-03T07:01' },
  ] },
  // Drik prints NO Amrit Kalam row on Feb 3.
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-03', windows: [] },
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-04', windows: [
    { start: '2027-02-04T10:07', end: '2027-02-04T11:55' },
  ] },
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-05', windows: [
    { start: '2027-02-05T11:20', end: '2027-02-05T13:08' },
  ] },
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-06', windows: [
    { start: '2027-02-06T09:42', end: '2027-02-06T11:30' },
  ] },
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-07', windows: [
    { start: '2027-02-07T12:20', end: '2027-02-07T14:05' },
  ] },
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-08', windows: [
    { start: '2027-02-08T18:06', end: '2027-02-08T19:50' },
  ] },
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-09', windows: [
    { start: '2027-02-09T19:05', end: '2027-02-09T20:48' },
  ] },
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-10', windows: [
    { start: '2027-02-10T23:52', end: '2027-02-11T01:33' },
  ] },
  { city: 'Jaipur', loc: JAIPUR, date: '2027-02-11', windows: [
    { start: '2027-02-12T03:13', end: '2027-02-12T04:52' },
  ] },
  // ── Kolkata, Nov 2026 ──
  { city: 'Kolkata', loc: KOLKATA, date: '2026-11-01', windows: [
    { start: '2026-11-01T22:25', end: '2026-11-01T23:56' },
  ] },
  { city: 'Kolkata', loc: KOLKATA, date: '2026-11-02', windows: [
    { start: '2026-11-03T02:13', end: '2026-11-03T03:46' },
  ] },
  { city: 'Kolkata', loc: KOLKATA, date: '2026-11-04', windows: [
    { start: '2026-11-04T21:05', end: '2026-11-04T22:41' },
  ] },
  { city: 'Kolkata', loc: KOLKATA, date: '2026-11-06', windows: [
    { start: '2026-11-06T22:31', end: '2026-11-07T00:10' },
  ] },
  { city: 'Kolkata', loc: KOLKATA, date: '2026-11-08', windows: [
    { start: '2026-11-08T22:02', end: '2026-11-08T23:44' },
  ] },
];

/** Minutes between a published local ISO string and a drik `YYYY-MM-DDTHH:MM`. */
function diffMin(publishedLocal: string, drik: string): number {
  return Math.abs(
    (Date.parse(publishedLocal.slice(0, 16) + ':00Z') - Date.parse(drik + ':00Z')) / 60_000,
  );
}

describe('Amrit Kala vs DrikPanchang (Jaipur Feb 2027 + Kolkata Nov 2026)', () => {
  for (const f of FIXTURES) {
    it(`${f.city} ${f.date}: ${f.windows.length} window(s)`, () => {
      const [y, m, d] = f.date.split('-').map(Number) as [number, number, number];
      const r = getDailyPanchang(new Date(Date.UTC(y, m - 1, d, 12)), f.loc, { timezone: 330 });
      expect(r).not.toBeNull();
      const ours = r!.muhurtas.amritKala;
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
