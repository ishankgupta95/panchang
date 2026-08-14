/**
 * Unit tests for Varjyam (Vishaghati / Nakshatra Thyajyam) — a forbidden
 * ~84–108 min window per day (elastic to the active nakshatra's duration),
 * keyed to the day's nakshatra.
 *
 * Classical reference: Muhurta-chintamani Ch. 4 / BPHS Ch. 71. Offset table
 * sourced from DrikPanchang (the project's Phase 28 parity oracle); see
 * VARJYAM_OFFSET_GHATIKAS in src/utils/constants.ts.
 */

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

/**
 * Synthetic Moon longitude getter. The Moon advances at a steady
 * `360° / periodDays` and sits at the start of `startNakshatraIndex` at
 * `epochUtc`. Period defaults to **27 days** (not the physical 27.32166)
 * so each synthetic nakshatra spans exactly 24 h, making 1 elastic ghatika
 * = 24 min and the 4-ghatika Varjyam window = 96 min — handy for tests
 * that reason about offsets in round numbers. The integration sweep at the
 * bottom of the file uses real ephemeris where the elastic ghatika varies.
 */
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

describe('computeVarjyam — input validation', () => {
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

describe('computeVarjyam — synthetic Moon (deterministic offsets, 24-min ghatikas)', () => {
  // Default synthetic period (27 days) → 24h nakshatras → 24-min ghatikas →
  // 4-ghatika window = 96 min. These tests pin offset arithmetic and the
  // bisection in nice round minutes.

  // Ashwini (0): offset 50 ghatikas = 20 h. Window: [sunrise+20:00, sunrise+21:36].
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

  // Anuradha (16): offset 10 ghatikas = 4 h, width 96 min.
  // If nakshatra started 2 h before sunrise, window starts +2:00 after sunrise.
  it('Anuradha started 2h before sunrise → window 2:00 to 3:36 after sunrise', () => {
    const nakshatraStart = new Date('2025-06-01T00:00:00Z');
    const sunrise = new Date(nakshatraStart.getTime() + 2 * 3600_000);
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(nakshatraStart, 16);

    const window = computeVarjyam(16, sunrise, nextSunrise, moon);
    expect(window).not.toBeNull();
    if (!window) return;

    const offsetH = VARJYAM_OFFSET_GHATIKAS[16]! * 24 / 60; // 4h
    const expectedStartFromSunrise = (offsetH - 2) * 3600_000; // 2h after sunrise
    const expectedStartMs = sunrise.getTime() + expectedStartFromSunrise;
    expect(Math.abs(window.start.getTime() - expectedStartMs)).toBeLessThan(60_000);
    expect(Math.abs((window.end.getTime() - window.start.getTime()) - 96 * 60_000))
      .toBeLessThan(60_000);
  });

  // Mula (18) is the dual-spell nakshatra: elapsed ghatikas 20 AND 56
  // (VARJYAM_SECOND_OFFSET_GHATIKAS). With the nakshatra starting at sunrise
  // both spells lie in the day: [+8:00, +9:36] and [+22:24, +24:00]. The
  // single-window primitive reports the EARLIEST; the windows API reports both.
  it('Mula starting at sunrise → dual spells 8:00–9:36 and 22:24–24:00 after sunrise', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(sunrise, 18);

    const first = computeVarjyam(18, sunrise, nextSunrise, moon);
    expect(first).not.toBeNull();
    const spell20StartMs = sunrise.getTime() + 20 * 24 * 60_000; // 8:00 after sunrise
    expect(Math.abs(first!.start.getTime() - spell20StartMs)).toBeLessThan(60_000);

    const windows = computeVarjyamWindows(sunrise, nextSunrise, moon);
    expect(windows.length).toBe(2);
    const spell56StartMs = sunrise.getTime() + 56 * 24 * 60_000; // 22:24 after sunrise
    expect(Math.abs(windows[0]!.start.getTime() - spell20StartMs)).toBeLessThan(60_000);
    expect(Math.abs(windows[1]!.start.getTime() - spell56StartMs)).toBeLessThan(60_000);
    expect(Math.abs(windows[1]!.end.getTime() - nextSunrise.getTime())).toBeLessThan(60_000);
  });

  it('window length is 96 min for every nakshatra under 24h-per-nakshatra synthetic Moon', () => {
    // Stagger each nakshatra's start so its Varjyam window lands inside the
    // Hindu day regardless of offset. With offset∈[10,56] ghatikas and a
    // 24h nakshatra, starting the nakshatra (offset+2)h before sunrise puts
    // the window center at +2h after sunrise — well inside any Hindu day.
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
    // Anuradha (offset 10 g = 4h): if it started 6h before sunrise, the window
    // [+4h..+5h36m relative to nakshatra start] = [-2h..-24m relative to sunrise]
    // is wholly before the Hindu day.
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nakshatraStart = new Date(sunrise.getTime() - 6 * 3600_000);
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(nakshatraStart, 16);

    const window = computeVarjyam(16, sunrise, nextSunrise, moon);
    expect(window).toBeNull();
  });
});

describe('computeVarjyamWindows — synthetic Moon (multi-window walk)', () => {
  // 27-day synthetic period → every nakshatra spans exactly 24 h, 1 elastic
  // ghatika = 24 min. All offsets below are in those round units.

  it('transition day yields BOTH windows, in start order', () => {
    // Ashwini (offset 50 g = 20 h) starting 12 h before sunrise:
    //   window 1 = [+8:00, +9:36] after sunrise.
    // Bharani (offset 24 g = 9.6 h) starts +12 h:
    //   window 2 = [+21:36, +23:12] after sunrise.
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

    // The single-window primitive reports only the sunrise nakshatra's window.
    const single = computeVarjyam(0, sunrise, nextSunrise, moon);
    expect(single).not.toBeNull();
    expect(Math.abs(single!.start.getTime() - w1StartMs)).toBeLessThan(60_000);
  });

  it('recovers the successor window the single-window contract dropped', () => {
    // Vishakha (offset 14 g = 5.6 h) started 20 h before sunrise: its window
    // ended ~14 h before sunrise → computeVarjyam returns null. Anuradha
    // (offset 10 g = 4 h) begins +4 h, so its window [+8:00, +9:36] falls
    // inside the day — the multi-window walk must find it.
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
    // Revati (offset 30 g = 12 h) started 19.5 h before sunrise: its window
    // ended ~5.9 h before sunrise. Ashwini (offset 50 g = 20 h) begins
    // +4.5 h: its window starts +24.5 h — past next sunrise. The walk then
    // stops (next nakshatra begins ≥ day end), so the day has no Varjyam.
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

  it('matches DrikPanchang published values for spot-check entries', () => {
    // Spot checks against drikpanchang.com/tutorials/panchang-utilities/nakshatra-thyajyam.html
    // — Tyajya Ghatis "X to X+3" → offset elapsed = (X − 1).
    expect(VARJYAM_OFFSET_GHATIKAS[0]).toBe(50);   // Ashwini  51–54
    expect(VARJYAM_OFFSET_GHATIKAS[3]).toBe(40);   // Rohini   41–44
    expect(VARJYAM_OFFSET_GHATIKAS[8]).toBe(32);   // Ashlesha 33–36
    expect(VARJYAM_OFFSET_GHATIKAS[16]).toBe(10);  // Anuradha 11–14
    expect(VARJYAM_OFFSET_GHATIKAS[18]).toBe(56);  // Mula     57–60
    expect(VARJYAM_OFFSET_GHATIKAS[26]).toBe(30);  // Revati   31–34
  });
});

describe('VARJYAM_OFFSET_GHATIKAS vs AMRIT_KALA_OFFSET_GHATIKAS — cross-table pin', () => {
  // Since the 2026-08-14 audit both tables share the SAME architecture —
  // offset from the nakshatra's start, in nakshatra-elastic ghatikas — but
  // carry independent drik-derived values (tyajya vs amrita windows). The
  // wholesale pin below keeps an accidental copy from one table to the
  // other from shipping silently.

  it('both tables have 27 entries', () => {
    expect(VARJYAM_OFFSET_GHATIKAS.length).toBe(27);
    expect(AMRIT_KALA_OFFSET_GHATIKAS.length).toBe(27);
  });

  it('AMRIT_KALA_OFFSET_GHATIKAS matches the drik-recovered table verbatim', () => {
    // 54 drik windows, 2 cities, all 27 nakshatras, spread ≤0.1 ghati
    // (2026-08-14 audit). ProKerala's Telugu panchangam independently
    // confirms the architecture and most values, but implies Mula ≈ 45 and
    // U.Bhadrapada ≈ 47.5 — drik (44 / 48) is the project's parity bar.
    expect([...AMRIT_KALA_OFFSET_GHATIKAS]).toEqual([
      42, 48, 54, 52, 38, 35, 54, 44, 56, 54, 44, 42, 45, 44,
      38, 38, 34, 38, 44, 48, 44, 34, 34, 42, 40, 48, 54,
    ]);
  });

  it('the tables are genuinely different (no wholesale cross-copy)', () => {
    expect([...AMRIT_KALA_OFFSET_GHATIKAS]).not.toEqual([...VARJYAM_OFFSET_GHATIKAS]);
  });
});

describe('computeVarjyam — elastic ghatikas (synthetic varying nakshatra duration)', () => {
  // A synthetic 25-day Moon period gives each nakshatra a uniform 25*24/27 ≈
  // 22.22h duration, so 1 elastic ghatika ≈ 22.22 min and a 4-ghatika
  // Varjyam window ≈ 88.89 min. Verifies the elastic algorithm responds to
  // nakshatra-duration changes (the fixed-ghatika algorithm would still emit
  // 96 min — this test fails under the old implementation).
  it('25-day synthetic period → window width ≈ 88.89 min (Anuradha — offset 10)', () => {
    // Nakshatra duration = 25 × 24 / 27 ≈ 22.22 h → 1 ghatika ≈ 22.22 min →
    // 4-ghatika window ≈ 88.89 min. Anuradha (offset 10 ghatikas ≈ 3.7 h) is
    // chosen because high-offset nakshatras (e.g. Ashwini @ 50 g ≈ 18.5 h)
    // would push the window past nextSunrise under this shorter period.
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

    // Sanity: 25-day period nakshatras are shorter than 24h, so width < 96 min.
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

describe('computeVarjyam — real ephemeris (smoke tests)', () => {
  it('does not crash for a normal Delhi day and respects window length', () => {
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const sunset = computeSunset(sunrise, DELHI);
    const nextSunrise = computeSunrise(sunset, DELHI);

    const nakshatraIndex = Math.floor(getMoon(sunrise) / NAKSHATRA_SPAN);
    const window = computeVarjyam(nakshatraIndex, sunrise, nextSunrise, getMoon);
    if (window) {
      // Real-ephemeris window width is elastic — between ~84 and ~108 min
      // depending on the nakshatra's actual duration that day.
      const widthMin = (window.end.getTime() - window.start.getTime()) / 60_000;
      expect(widthMin).toBeGreaterThan(80);
      expect(widthMin).toBeLessThan(115);
      // Window must overlap the Hindu day (returning non-null is the contract).
      expect(window.end.getTime()).toBeGreaterThan(sunrise.getTime());
      expect(window.start.getTime()).toBeLessThan(nextSunrise.getTime());
    }
  });

  it('produces a non-null window for a meaningful share of days in a 30-day sweep', () => {
    // Using only the sunrise-active nakshatra (per the API contract), some
    // days have their varjyam fall entirely before sunrise (already past) or
    // entirely after nextSunrise (belongs to the next nakshatra mid-day).
    // Empirically ~40–60% of days return a non-null window; we just assert
    // a non-trivial floor to catch logic regressions.
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
