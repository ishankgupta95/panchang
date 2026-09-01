
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
  for (const day of ['2026-08-03', '2026-08-10', '2026-08-15', '2026-08-18']) {
    for (const kind of ['tithi', 'nakshatra', 'yoga', 'karana'] as Kind[]) {
      it(`${day} ${kind}: element holds at start, not just before it`, () => {
        const r = getDailyPanchang(noonUtc(day), UJJAIN, TZ)!;
        const first = r.angas[DAILY_KEY[kind]][0]!;
        const start = first.startTime!.getTime();

        expect(start).toBeGreaterThan(r.sun.rise.getTime() - 30 * 3600_000);

        expect(indexAtInstant(kind, new Date(start + 30_000))).toBe(first.index);
        expect(indexAtInstant(kind, new Date(start - 120_000))).not.toBe(first.index);
      });
    }
  }

  it('the start published today is the end published yesterday (same boundary)', () => {
    const aug14 = getDailyPanchang(noonUtc('2026-08-14'), UJJAIN, TZ)!;
    const aug15 = getDailyPanchang(noonUtc('2026-08-15'), UJJAIN, TZ)!;

    const pPhalguni = aug14.angas.nakshatras[0]!;
    const uPhalguni = aug15.angas.nakshatras[0]!;
    expect((pPhalguni.index + 1) % 27).toBe(uPhalguni.index);
    expect(Math.abs(uPhalguni.startTime!.getTime() - pPhalguni.endTime!.getTime()))
      .toBeLessThan(1000);

    const dwitiya = aug14.angas.tithis[0]!;
    const tritiya = aug15.angas.tithis[0]!;
    expect((dwitiya.index + 1) % 30).toBe(tritiya.index);
    expect(Math.abs(tritiya.startTime!.getTime() - dwitiya.endTime!.getTime()))
      .toBeLessThan(1000);
  });

  it('an element spanning the whole Hindu day keeps the documented end clamp', () => {
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
