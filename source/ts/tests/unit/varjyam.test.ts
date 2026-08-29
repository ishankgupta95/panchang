// VARJYAM_OFFSET_GHATIKAS is taken from the reference almanac; the rule itself
// is Muhurta-chintamani Ch. 4 / BPHS Ch. 71.

import { describe, it, expect } from 'vitest';
import { computeVarjyam, computeVarjyamWindows } from '../../src/core/varjyam';
import {
  VARJYAM_OFFSET_GHATIKAS,
  NAKSHATRA_SPAN,
} from '../../src/utils/constants';
import { AMRIT_KALA_OFFSET_GHATIKAS } from '../../src/core/muhurta';
import { LongitudeCache } from '../../src/astronomy/cache';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };

// The period defaults to 27 days, not the physical 27.32166, so a synthetic
// nakshatra spans exactly 24 h and one elastic ghatika 24 min.
function syntheticMoon(
  epochUtc: Date,
  startNakshatraIndex: number,
  periodDays: number = 27,
): (d: Date) => number {
  const startLon = startNakshatraIndex * NAKSHATRA_SPAN;
  const degPerMs = 360 / (periodDays * 86_400_000);
  return (d: Date) => {
    const dt = d.getTime() - epochUtc.getTime();
    return ((startLon + dt * degPerMs) % 360 + 360) % 360;
  };
}

describe('computeVarjyam: input validation', () => {
  const sunrise = new Date('2025-01-14T01:30:00Z');
  const nextSunrise = new Date('2025-01-15T01:30:00Z');
  const noopMoon = () => 0;

  it('throws RangeError for negative nakshatra index', () => {
    expect(() => computeVarjyam(-1, sunrise, nextSunrise, noopMoon)).toThrow(RangeError);
  });

  it('throws RangeError for nakshatra index ≥ 27', () => {
    expect(() => computeVarjyam(27, sunrise, nextSunrise, noopMoon)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer nakshatra index', () => {
    expect(() => computeVarjyam(3.5, sunrise, nextSunrise, noopMoon)).toThrow(RangeError);
  });
});

describe('computeVarjyam: synthetic Moon (deterministic offsets, 24-min ghatikas)', () => {
  it('Ashwini starting at sunrise → window 20:00 to 21:36 after sunrise', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date('2025-06-02T00:00:00Z');
    const moon = syntheticMoon(sunrise, 0);

    const window = computeVarjyam(0, sunrise, nextSunrise, moon);
    expect(window).not.toBeNull();
    if (!window) return;

    const expectedStartMs = sunrise.getTime() + VARJYAM_OFFSET_GHATIKAS[0]! * 24 * 60_000;
    const expectedEndMs = expectedStartMs + 96 * 60_000;
    expect(Math.abs(window.start.getTime() - expectedStartMs)).toBeLessThan(60_000);
    expect(Math.abs(window.end.getTime() - expectedEndMs)).toBeLessThan(60_000);
  });

  it('Anuradha started 2h before sunrise → window 2:00 to 3:36 after sunrise', () => {
    const nakshatraStart = new Date('2025-06-01T00:00:00Z');
    const sunrise = new Date(nakshatraStart.getTime() + 2 * 3600_000);
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(nakshatraStart, 16);

    const window = computeVarjyam(16, sunrise, nextSunrise, moon);
    expect(window).not.toBeNull();
    if (!window) return;

    const offsetH = VARJYAM_OFFSET_GHATIKAS[16]! * 24 / 60;
    const expectedStartFromSunrise = (offsetH - 2) * 3600_000;
    const expectedStartMs = sunrise.getTime() + expectedStartFromSunrise;
    expect(Math.abs(window.start.getTime() - expectedStartMs)).toBeLessThan(60_000);
    expect(Math.abs((window.end.getTime() - window.start.getTime()) - 96 * 60_000))
      .toBeLessThan(60_000);
  });

  // Mula is the dual-spell nakshatra: elapsed ghatikas 20 and 56.
  it('Mula starting at sunrise → dual spells 8:00-9:36 and 22:24-24:00 after sunrise', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(sunrise, 18);

    const first = computeVarjyam(18, sunrise, nextSunrise, moon);
    expect(first).not.toBeNull();
    const spell20StartMs = sunrise.getTime() + 20 * 24 * 60_000;
    expect(Math.abs(first!.start.getTime() - spell20StartMs)).toBeLessThan(60_000);

    const windows = computeVarjyamWindows(sunrise, nextSunrise, moon);
    expect(windows.length).toBe(2);
    const spell56StartMs = sunrise.getTime() + 56 * 24 * 60_000;
    expect(Math.abs(windows[0]!.start.getTime() - spell20StartMs)).toBeLessThan(60_000);
    expect(Math.abs(windows[1]!.start.getTime() - spell56StartMs)).toBeLessThan(60_000);
    expect(Math.abs(windows[1]!.end.getTime() - nextSunrise.getTime())).toBeLessThan(60_000);
  });

  it('window length is 96 min for every nakshatra under 24h-per-nakshatra synthetic Moon', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    let asserted = 0;
    for (let n = 0; n < 27; n++) {
      const offsetH = VARJYAM_OFFSET_GHATIKAS[n]! * 24 / 60;
      const nakshatraStart = new Date(sunrise.getTime() - (offsetH - 2) * 3600_000);
      const moon = syntheticMoon(nakshatraStart, n);
      const w = computeVarjyam(n, sunrise, nextSunrise, moon);
      expect(w).not.toBeNull();
      if (!w) continue;
      const widthMin = (w.end.getTime() - w.start.getTime()) / 60_000;
      expect(Math.abs(widthMin - 96)).toBeLessThan(1);
      asserted++;
    }
    expect(asserted).toBe(27);
  });

  it('returns null when window falls entirely before sunrise', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nakshatraStart = new Date(sunrise.getTime() - 6 * 3600_000);
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(nakshatraStart, 16);

    const window = computeVarjyam(16, sunrise, nextSunrise, moon);
    expect(window).toBeNull();
  });
});

describe('computeVarjyamWindows: synthetic Moon (multi-window walk)', () => {
  it('transition day yields BOTH windows, in start order', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(new Date(sunrise.getTime() - 12 * 3600_000), 0);

    const windows = computeVarjyamWindows(sunrise, nextSunrise, moon);
    expect(windows.length).toBe(2);

    const w1StartMs = sunrise.getTime() + 8 * 3600_000;
    const w2StartMs = sunrise.getTime() + 21.6 * 3600_000;
    expect(Math.abs(windows[0]!.start.getTime() - w1StartMs)).toBeLessThan(60_000);
    expect(Math.abs(windows[1]!.start.getTime() - w2StartMs)).toBeLessThan(60_000);
    for (const w of windows) {
      expect(Math.abs((w.end.getTime() - w.start.getTime()) - 96 * 60_000))
        .toBeLessThan(60_000);
    }

    const single = computeVarjyam(0, sunrise, nextSunrise, moon);
    expect(single).not.toBeNull();
    expect(Math.abs(single!.start.getTime() - w1StartMs)).toBeLessThan(60_000);
  });

  it('recovers the successor window the single-window contract dropped', () => {
    // Vishakha (offset 14 g) closed before the day; +8:00 is Anuradha's (10 g).
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(new Date(sunrise.getTime() - 20 * 3600_000), 15);

    expect(computeVarjyam(15, sunrise, nextSunrise, moon)).toBeNull();

    const windows = computeVarjyamWindows(sunrise, nextSunrise, moon);
    expect(windows.length).toBe(1);
    const expectedStartMs = sunrise.getTime() + 8 * 3600_000;
    expect(Math.abs(windows[0]!.start.getTime() - expectedStartMs)).toBeLessThan(60_000);
  });

  it('returns [] when no window of any spanning nakshatra starts within the day', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(new Date(sunrise.getTime() - 19.5 * 3600_000), 26);

    const windows = computeVarjyamWindows(sunrise, nextSunrise, moon);
    expect(windows).toEqual([]);
  });
});

describe('VARJYAM_OFFSET_GHATIKAS table sanity', () => {
  it('has exactly 27 entries', () => {
    expect(VARJYAM_OFFSET_GHATIKAS.length).toBe(27);
  });

  it('every offset is an integer in a plausible range [0, 60)', () => {
    for (const v of VARJYAM_OFFSET_GHATIKAS) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(60);
    }
  });

  it("matches the reference almanac's published values for spot-check entries", () => {
    // The almanac lists Tyajya Ghatis as "X to X+3"; the stored offset is the
    // elapsed count X - 1, and the trailing values are the published ranges.
    expect(VARJYAM_OFFSET_GHATIKAS[0]).toBe(50);   // Ashwini  51-54
    expect(VARJYAM_OFFSET_GHATIKAS[3]).toBe(40);   // Rohini   41-44
    expect(VARJYAM_OFFSET_GHATIKAS[8]).toBe(32);   // Ashlesha 33-36
    expect(VARJYAM_OFFSET_GHATIKAS[16]).toBe(10);  // Anuradha 11-14
    expect(VARJYAM_OFFSET_GHATIKAS[18]).toBe(56);  // Mula     57-60
    expect(VARJYAM_OFFSET_GHATIKAS[26]).toBe(30);  // Revati   31-34
  });
});

describe('VARJYAM_OFFSET_GHATIKAS vs AMRIT_KALA_OFFSET_GHATIKAS: cross-table pin', () => {
  it('both tables have 27 entries', () => {
    expect(VARJYAM_OFFSET_GHATIKAS.length).toBe(27);
    expect(AMRIT_KALA_OFFSET_GHATIKAS.length).toBe(27);
  });

  it('AMRIT_KALA_OFFSET_GHATIKAS matches the almanac-recovered table verbatim', () => {
    // Recovered from 54 almanac windows across 2 cities and all 27 nakshatras.
    // A Telugu panchangam implies Mula ≈ 45 and U.Bhadrapada ≈ 47.5; the almanac
    // (44 / 48) is the parity bar and wins.
    expect([...AMRIT_KALA_OFFSET_GHATIKAS]).toEqual([
      42, 48, 54, 52, 38, 35, 54, 44, 56, 54, 44, 42, 45, 44,
      38, 38, 34, 38, 44, 48, 44, 34, 34, 42, 40, 48, 54,
    ]);
  });

  it('the tables are genuinely different (no wholesale cross-copy)', () => {
    expect([...AMRIT_KALA_OFFSET_GHATIKAS]).not.toEqual([...VARJYAM_OFFSET_GHATIKAS]);
  });
});

describe('computeVarjyam: elastic ghatikas (synthetic varying nakshatra duration)', () => {
  it('25-day synthetic period → window width ≈ 88.89 min (Anuradha, offset 10)', () => {
    // A high-offset nakshatra would push the window past nextSunrise here.
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(sunrise, 16, 25);
    const w = computeVarjyam(16, sunrise, nextSunrise, moon);
    expect(w).not.toBeNull();
    if (!w) return;

    const widthMin = (w.end.getTime() - w.start.getTime()) / 60_000;
    const expectedNakshatraDurMin = (25 * 24 * 60) / 27;
    const expectedWidthMin = (4 * expectedNakshatraDurMin) / 60;
    expect(Math.abs(widthMin - expectedWidthMin)).toBeLessThan(1);

    expect(widthMin).toBeLessThan(96);
  });

  it('29-day synthetic period → window width ≈ 25.78 × 4 ≈ 103 min (longer than 96)', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(sunrise, 16, 29);

    const window = computeVarjyam(16, sunrise, nextSunrise, moon);
    expect(window).not.toBeNull();
    if (!window) return;

    const widthMin = (window.end.getTime() - window.start.getTime()) / 60_000;
    const expectedNakshatraDurMin = (29 * 24 * 60) / 27;
    const expectedWidthMin = (4 * expectedNakshatraDurMin) / 60;
    expect(Math.abs(widthMin - expectedWidthMin)).toBeLessThan(1);
    expect(widthMin).toBeGreaterThan(96);
  });
});

describe('computeVarjyam: real ephemeris (smoke tests)', () => {
  it('does not crash for a normal Delhi day and respects window length', () => {
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const sunset = computeSunset(sunrise, DELHI);
    const nextSunrise = computeSunrise(sunset, DELHI);

    const nakshatraIndex = Math.floor(getMoon(sunrise) / NAKSHATRA_SPAN);
    const window = computeVarjyam(nakshatraIndex, sunrise, nextSunrise, getMoon);
    if (window) {
      const widthMin = (window.end.getTime() - window.start.getTime()) / 60_000;
      expect(widthMin).toBeGreaterThan(80);
      expect(widthMin).toBeLessThan(115);
      expect(window.end.getTime()).toBeGreaterThan(sunrise.getTime());
      expect(window.start.getTime()).toBeLessThan(nextSunrise.getTime());
    }
  });

  it('produces a non-null window for a meaningful share of days in a 30-day sweep', () => {
    // A day's varjyam can fall wholly outside the day, so the floor is loose.
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    let nonNull = 0;
    for (let day = 0; day < 30; day++) {
      const t0 = new Date(Date.UTC(2025, 5, 1) + day * 86_400_000);
      const sunrise = computeSunrise(t0, DELHI);
      const sunset = computeSunset(sunrise, DELHI);
      const nextSunrise = computeSunrise(sunset, DELHI);
      const idx = Math.floor(getMoon(sunrise) / NAKSHATRA_SPAN);
      if (computeVarjyam(idx, sunrise, nextSunrise, getMoon)) nonNull++;
    }
    expect(nonNull).toBeGreaterThan(8);
  });
});
