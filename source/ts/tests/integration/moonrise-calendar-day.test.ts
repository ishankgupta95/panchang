// `getMoonrise` searches up to two days ahead, so on a day with no moonrise the
// publishing layer must clamp to `null` or one instant is published twice.

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
});
