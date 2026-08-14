/**
 * @tier 1  DrikPanchang day-panchang, 61 scraped days (Aug 1 – Sep 30 2026, Ujjain)
 *
 * Multi-window Varjyam parity with DrikPanchang, pinned from a two-month
 * scrape of drikpanchang.com/panchang/day-panchang.html (geoname-id 1253914,
 * Ujjain; fetched 2026-08-13). The sweep covers two full nakshatra cycles,
 * so every one of the 27 tyajya table rows is exercised at least twice.
 *
 * What the scrape established (and this file pins):
 *
 * 1. ATTRIBUTION — a window belongs to the Hindu day its START falls in.
 *    A window that begins before sunrise and runs past it appears ONLY on
 *    the previous day's page (Aug 24, Aug 25 straddle days), and a day none
 *    of whose spanning nakshatras' windows start within it prints no
 *    Varjyam row at all (Aug 2, Aug 27, Sep 6, Sep 18).
 *
 * 2. DUAL-SPELL MULA — drik prints TWO tyajya spells for Mula, at elapsed
 *    ghatikas 20 and 56 (all other 26 nakshatras: single spell, matching
 *    VARJYAM_OFFSET_GHATIKAS). On 2026-09-19 both spells land inside one
 *    Hindu day and drik prints the pair; ProKerala's Telugu panchangam
 *    independently prints the same two windows for that date (07:43 AM –
 *    09:31 AM, 11:54 PM – 01:42 AM; 1-min display offset vs drik).
 *    B.V. Raman's "Muhurta" tyajya list gives Moola = 20; drik's tutorial
 *    table carries the 57–60 spell. See VARJYAM_SECOND_OFFSET_GHATIKAS.
 *
 * 3. TWO-WINDOW TRANSITION DAYS — Aug 8, Aug 23, Sep 4, Sep 7, Sep 19 all
 *    print two rows; the full 61-day sweep matched our windows 62/62 in
 *    count and position.
 *
 * Tolerance is ±2 min — the repo's standing drik-varjyam tolerance
 * (phase28-cross-verify.test.ts). Drik truncates displayed minutes and its
 * SwissEph frame carries nutation (ours is mean-frame by design), which
 * together bound the observed residual at 1.7 min over the 62 windows;
 * reconstructing drik's own arithmetic from their printed nakshatra
 * boundaries reproduces their Varjyam rows exactly, so the residual is
 * boundary-inherited, not a rule difference.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const UJJAIN = { latitude: 23.1765, longitude: 75.7885 };
const TOL_MIN = 2;

/** Drik-printed windows, IST wall-clock (`YYYY-MM-DDTHH:MM`). */
const FIXTURES: { date: string; windows: { start: string; end: string }[] }[] = [
  // ── two-window transition days ──
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
  // ── dual-spell Mula: both spells (ghatikas 20 and 56) in ONE Hindu day ──
  { date: '2026-09-19', windows: [
    { start: '2026-09-19T07:44', end: '2026-09-19T09:32' },
    { start: '2026-09-19T23:55', end: '2026-09-20T01:43' },
  ] },
  // ── dual-spell Mula: 20-ghatika spell alone (56-spell starts next day) ──
  { date: '2026-08-22', windows: [
    { start: '2026-08-22T23:47', end: '2026-08-23T01:35' },
  ] },
  // ── straddle days: window begins pre-sunrise → previous day's row only ──
  { date: '2026-08-24', windows: [
    { start: '2026-08-25T05:16', end: '2026-08-25T07:01' },
  ] },
  { date: '2026-08-25', windows: [
    { start: '2026-08-26T03:10', end: '2026-08-26T04:54' },
  ] },
  // ── days drik prints NO Varjyam row ──
  { date: '2026-08-02', windows: [] },
  { date: '2026-08-27', windows: [] },
  { date: '2026-09-06', windows: [] },
  { date: '2026-09-18', windows: [] },
];

/** Minutes between a published local ISO string and a drik `YYYY-MM-DDTHH:MM`. */
function diffMin(publishedLocal: string, drik: string): number {
  return Math.abs(
    (Date.parse(publishedLocal.slice(0, 16) + ':00Z') - Date.parse(drik + ':00Z')) / 60_000,
  );
}

describe('Varjyam multi-window vs DrikPanchang (Ujjain, Aug–Sep 2026)', () => {
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
