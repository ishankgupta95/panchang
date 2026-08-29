import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import {
  VARJYAM_OFFSET_GHATIKAS,
  VARJYAM_SECOND_OFFSET_GHATIKAS,
  NAKSHATRA_SPAN,
} from '../../src/utils/constants';
import { LongitudeCache } from '../../src/astronomy/cache';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const NOON_2025_01_14 = new Date(Date.UTC(2025, 0, 14, 12, 0, 0, 0));

/**
 * Both bisections anchor on `refMs`'s index, not the index at the far end of
 * the bracket: a 30 h lookback can span two transitions.
 */
function nakshatraSpanAround(
  refMs: number, getMoon: (d: Date) => number,
): { start: number; end: number } {
  const idx = (ms: number) => Math.floor(getMoon(new Date(ms)) / NAKSHATRA_SPAN);
  const cur = idx(refMs);
  const WINDOW_MS = 30 * 3600_000;

  let lo = refMs - WINDOW_MS, hi = refMs;
  while (hi - lo > 1000) {
    const mid = (lo + hi) / 2;
    if (idx(mid) === cur) hi = mid; else lo = mid;
  }
  const start = hi;

  lo = refMs; hi = refMs + WINDOW_MS;
  while (hi - lo > 1000) {
    const mid = (lo + hi) / 2;
    if (idx(mid) === cur) lo = mid; else hi = mid;
  }
  return { start, end: hi };
}

describe('Varjyam wiring: daily panchang', () => {
  it('field is a TimePeriod[] on a normal Delhi day', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 });
    expect(r).not.toBeNull();
    expect(Array.isArray(r!.inauspicious.varjyam)).toBe(true);
    for (const w of r!.inauspicious.varjyam) {
      expect(w.start).toBeInstanceOf(Date);
      expect(w.end).toBeInstanceOf(Date);
      expect(w.end.getTime()).toBeGreaterThan(w.start.getTime());
    }
  });

  // The owning nakshatra is the one active at the window's midpoint, which on a
  // transition day is not the sunrise nakshatra.
  it('every window spans exactly 4 ghatikas of its own nakshatra (elastic width)', () => {
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    let checked = 0;

    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 })!;
      for (const v of r.inauspicious.varjyam) {
        const midMs = (v.start.getTime() + v.end.getTime()) / 2;
        const nak = nakshatraSpanAround(midMs, getMoon);
        const ghatikaMs = (nak.end - nak.start) / 60;

        const widthMs = v.end.getTime() - v.start.getTime();
        expect(Math.abs(widthMs - 4 * ghatikaMs)).toBeLessThan(5000);
        // 4 ghatikas of a 21-27 h nakshatra is 84-108 min.
        expect(widthMs / 60_000).toBeGreaterThan(84);
        expect(widthMs / 60_000).toBeLessThan(110);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('windows are sorted and each STARTS within the Hindu day (attribution rule)', () => {
    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 })!;
      const ws = r.inauspicious.varjyam;
      for (let i = 1; i < ws.length; i++) {
        expect(ws[i]!.start.getTime()).toBeGreaterThanOrEqual(ws[i - 1]!.start.getTime());
      }
      // Ends are unclamped and may run past next sunrise.
      const sunriseMs = r.sun.rise.getTime();
      const nextSunriseMs = r.sun.nextRise.getTime();
      for (const w of ws) {
        expect(w.start.getTime()).toBeGreaterThanOrEqual(sunriseMs);
        expect(w.start.getTime()).toBeLessThan(nextSunriseMs);
      }
    }
  });

  it('every window starts at a tabulated offset of its owning nakshatra', () => {
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    let checked = 0;

    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 })!;
      for (const w of r.inauspicious.varjyam) {
        const midMs = (w.start.getTime() + w.end.getTime()) / 2;
        const nakIdx = Math.floor(getMoon(new Date(midMs)) / NAKSHATRA_SPAN);
        const nak = nakshatraSpanAround(midMs, getMoon);
        const ghatikaMs = (nak.end - nak.start) / 60;

        const offsets = [VARJYAM_OFFSET_GHATIKAS[nakIdx]!];
        const second = VARJYAM_SECOND_OFFSET_GHATIKAS[nakIdx];
        if (second !== undefined) offsets.push(second);

        // 30 s of nakshatra-start error plus ~1 s per elapsed ghatika, and the
        // offsets run to 56.
        const bestErr = Math.min(...offsets.map(
          (off) => Math.abs(w.start.getTime() - (nak.start + off * ghatikaMs)),
        ));
        expect(bestErr, `window on day +${day}`).toBeLessThan(90_000);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('emits at least one window on most days, and two on some (multi-window sweep)', () => {
    let daysWithOne = 0;
    let daysWithTwo = 0;
    for (let day = 0; day < 60; day++) {
      const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      const n = r?.inauspicious.varjyam.length ?? 0;
      if (n >= 1) daysWithOne++;
      if (n >= 2) daysWithTwo++;
    }
    // The reference almanac prints a window almost daily.
    expect(daysWithOne).toBeGreaterThan(45);
    expect(daysWithTwo).toBeGreaterThan(2);
  });
});
