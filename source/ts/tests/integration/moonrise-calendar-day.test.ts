
import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const UJJAIN = { latitude: 23.1765, longitude: 75.7885 };
const OPTS = { timezone: 330 as const, sections: ['moonTimes' as const] };

const day = (y: number, m: number, d: number) =>
  getDailyPanchang(new Date(Date.UTC(y, m, d, 12)), UJJAIN, OPTS)!;

describe('moon.rise calendar-day contract', () => {
  it('2026-08-06 Ujjain has no moonrise: rise is null, set is that day\'s own', () => {
    const p = day(2026, 7, 6);
    expect(p.moon.rise).toBeNull();
    expect(p.moon.riseLocal).toBeNull();
    expect(p.moon.set).not.toBeNull();
    expect(p.moon.setLocal!.slice(0, 10)).toBe('2026-08-06');
  });

  it('the neighbours are unaffected and distinct', () => {
    const aug5 = day(2026, 7, 5);
    const aug7 = day(2026, 7, 7);
    expect(aug5.moon.rise).not.toBeNull();
    expect(aug5.moon.riseLocal!.slice(0, 10)).toBe('2026-08-05');
    expect(aug7.moon.rise).not.toBeNull();
    expect(aug7.moon.riseLocal!.slice(0, 10)).toBe('2026-08-07');
  });

  it('2026: every published rise is on its own calendar day, no duplicates, ~13 null days', () => {
    let nulls = 0;
    let prevRise: number | null = null;
    for (let t = Date.UTC(2026, 0, 1, 12); t < Date.UTC(2027, 0, 1, 12); t += 86400_000) {
      const p = getDailyPanchang(new Date(t), UJJAIN, OPTS)!;
      const qday = p.sun.riseLocal.slice(0, 10);
      if (p.moon.rise === null) {
        nulls++;
      } else {
        expect(p.moon.riseLocal!.slice(0, 10), qday).toBe(qday);
        if (prevRise !== null) expect(p.moon.rise.getTime(), qday).not.toBe(prevRise);
      }
      prevRise = p.moon.rise?.getTime() ?? null;
    }
    expect(nulls).toBeGreaterThanOrEqual(12);
    expect(nulls).toBeLessThanOrEqual(14);
  });

  it('with no moonrise, a moonset on a later civil day is not published (USNO: none that day)', () => {
    const REYKJAVIK = { latitude: 64.1466, longitude: -21.9426 };
    const at = (y: number, m: number, d: number) =>
      getDailyPanchang(new Date(Date.UTC(y, m, d, 12)), REYKJAVIK, { timezone: 0, sections: ['moonTimes'] })!;
    // testdata/reference/usno-riseset.json: Reykjavik 2025-12-21, Moon continuously below the horizon.
    const dec21 = at(2025, 11, 21);
    expect(dec21.moon.rise).toBeNull();
    expect(dec21.moon.set).toBeNull();
    expect(dec21.moon.setLocal).toBeNull();
    // The 12-22 set follows that day's own rise and stays published there, once.
    const dec22 = at(2025, 11, 22);
    expect(dec22.moon.riseLocal!.slice(0, 10)).toBe('2025-12-22');
    expect(dec22.moon.setLocal!.slice(0, 16)).toBe('2025-12-22T17:26');
    const jan13 = at(2025, 0, 13);
    expect(jan13.moon.rise).toBeNull();
    expect(jan13.moon.set).toBeNull();
  });
});
