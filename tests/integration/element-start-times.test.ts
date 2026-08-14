/**
 * Regression tests for the first daily element's `startTime`.
 *
 * `findStartTime` used to treat its −36 h probe as "previous element or bust":
 * whenever the sunrise element had begun recently enough that the probe landed
 * two or more elements back, it returned the raw window edge — sunrise minus
 * exactly 36 h — as the "start". Measured over August 2026 at Ujjain that
 * corrupted 19/31 nakshatra, 18/31 tithi and every karana first-element start.
 * End times were never affected, which is why the drik-parity fixtures — all
 * pinned on end times — sailed past it. Found 2026-08-13 while cross-checking
 * against the Astrological eMagazine's panchanga widget.
 *
 * Every assertion here is fixture-free: starts are checked as *boundary
 * properties* (the element holds just after `startTime` and does not hold just
 * before it) and as cross-day agreement (the boundary published as yesterday's
 * end is the same instant published as today's start), so nothing needs
 * re-pinning if upstream ephemeris series move.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';

const UJJAIN = { latitude: 23.1765, longitude: 75.7885 };
const TZ = { timezone: 330 };

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

type Kind = 'tithi' | 'nakshatra' | 'yoga' | 'karana';
const DAILY_KEY = {
  tithi: 'tithis', nakshatra: 'nakshatras', yoga: 'yogas', karana: 'karanas',
} as const;

function indexAtInstant(kind: Kind, utc: Date): number {
  return getInstantPanchang(utc, UJJAIN)!.angas[kind].index;
}

describe('first daily element startTime is the true boundary instant', () => {
  // 2026-08-15 and 2026-08-03 are known-bad days from the August 2026 audit
  // (sunrise nakshatra began a few hours before sunrise); on 2026-08-18 the
  // nakshatra (Swati) spans the entire Hindu day; 2026-08-10 was clean. The
  // karana column exercises the fix on every day: its −36 h probe always
  // lands three or four elements back.
  for (const day of ['2026-08-03', '2026-08-10', '2026-08-15', '2026-08-18']) {
    for (const kind of ['tithi', 'nakshatra', 'yoga', 'karana'] as Kind[]) {
      it(`${day} ${kind}: element holds at start, not just before it`, () => {
        const r = getDailyPanchang(noonUtc(day), UJJAIN, TZ)!;
        const first = r.angas[DAILY_KEY[kind]][0]!;
        const start = first.startTime!.getTime();

        // Not the bug signature: no tithi/nakshatra/yoga/karana lasts 30 h,
        // so a true start never falls 36 h before sunrise.
        expect(start).toBeGreaterThan(r.sun.rise.getTime() - 30 * 3600_000);

        // Boundary property. The search is never-early (≤ 25 ms late), so the
        // element must hold shortly after `startTime` and its predecessor must
        // still hold shortly before.
        expect(indexAtInstant(kind, new Date(start + 30_000))).toBe(first.index);
        expect(indexAtInstant(kind, new Date(start - 120_000))).not.toBe(first.index);
      });
    }
  }

  it('the start published today is the end published yesterday (same boundary)', () => {
    // Uttara Phalguni is at Ujjain's sunrise on 2026-08-15; it began a few
    // hours before sunrise, so the −36 h probe lands two nakshatras back —
    // exactly the case the old guard misread as "older than window".
    const aug14 = getDailyPanchang(noonUtc('2026-08-14'), UJJAIN, TZ)!;
    const aug15 = getDailyPanchang(noonUtc('2026-08-15'), UJJAIN, TZ)!;

    // Nakshatra: yesterday's sunrise nakshatra ended in-day (unclamped), and
    // that end is the very boundary today's sunrise nakshatra started at.
    const pPhalguni = aug14.angas.nakshatras[0]!;
    const uPhalguni = aug15.angas.nakshatras[0]!;
    expect((pPhalguni.index + 1) % 27).toBe(uPhalguni.index);
    expect(Math.abs(uPhalguni.startTime!.getTime() - pPhalguni.endTime!.getTime()))
      .toBeLessThan(1000);

    // Tithi: same shape — Dwitiya's in-day end on the 14th is Tritiya's start
    // published on the 15th.
    const dwitiya = aug14.angas.tithis[0]!;
    const tritiya = aug15.angas.tithis[0]!;
    expect((dwitiya.index + 1) % 30).toBe(tritiya.index);
    expect(Math.abs(tritiya.startTime!.getTime() - dwitiya.endTime!.getTime()))
      .toBeLessThan(1000);
  });

  it('an element spanning the whole Hindu day keeps the documented end clamp', () => {
    // 2026-08-18: Swati runs from before sunrise to after next sunrise, so
    // the array has one entry whose end tiles the day (see DailyElementBase) —
    // while its start remains the true pre-sunrise boundary instant.
    const r = getDailyPanchang(noonUtc('2026-08-18'), UJJAIN, TZ)!;
    expect(r.angas.nakshatras).toHaveLength(1);
    const only = r.angas.nakshatras[0]!;
    expect(only.endTime!.getTime()).toBe(r.sun.nextRise.getTime());
    expect(only.startTime!.getTime()).toBeLessThan(r.sun.rise.getTime());
    expect(indexAtInstant('nakshatra', new Date(only.startTime!.getTime() - 120_000)))
      .not.toBe(only.index);
  });

  it('August 2026, Ujjain: no first-element start sits on the −36 h window edge', () => {
    for (let d = 1; d <= 31; d++) {
      const r = getDailyPanchang(new Date(Date.UTC(2026, 7, d, 12)), UJJAIN, TZ)!;
      const floorMs = r.sun.rise.getTime() - 30 * 3600_000;
      for (const key of ['tithis', 'nakshatras', 'yogas', 'karanas'] as const) {
        const first = r.angas[key][0]!;
        expect(first.startTime!.getTime(), `${key} day ${d}`).toBeGreaterThan(floorMs);
      }
    }
  });
});
