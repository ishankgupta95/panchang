/**
 * Unit tests for Varjyam (Vishaghati / Nakshatra Thyajyam) — the forbidden
 * ~96-minute window per day, keyed to the day's nakshatra.
 *
 * Classical reference: Muhurta-chintamani Ch. 4 / BPHS Ch. 71. Offset table
 * sourced from DrikPanchang (the project's Phase 28 parity oracle); see
 * VARJYAM_OFFSET_GHATIKAS in src/utils/constants.ts.
 */

import { describe, it, expect } from 'vitest';
import { computeVarjyam } from '../../src/core/varjyam';
import {
  VARJYAM_OFFSET_GHATIKAS,
  VARJYAM_DURATION_MINUTES,
  NAKSHATRA_SPAN,
} from '../../src/utils/constants';
import { LongitudeCache } from '../../src/astronomy/cache';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };

/**
 * Synthetic Moon longitude getter: the Moon advances at a steady
 * 360°/(27.3 d) and is at the start of `startNakshatraIndex` at `epochUtc`.
 * Used to create deterministic nakshatra-start times that tests can reason
 * about without depending on real astronomy.
 */
function syntheticMoon(
  epochUtc: Date,
  startNakshatraIndex: number,
  /** Sidereal lunar period in days; classical value 27.32166. */
  periodDays: number = 27.32166,
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

describe('computeVarjyam — synthetic Moon (deterministic offsets)', () => {
  // Place Ashwini's start exactly at sunrise. Offset = 50 ghatikas = 20 h.
  // Window: [sunrise + 20:00, sunrise + 21:36].
  it('Ashwini starting at sunrise → window 20:00 to 21:36 after sunrise', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date('2025-06-02T00:00:00Z');
    const moon = syntheticMoon(sunrise, 0);

    const window = computeVarjyam(0, sunrise, nextSunrise, moon);
    expect(window).not.toBeNull();
    if (!window) return;

    const expectedStartMs = sunrise.getTime() + VARJYAM_OFFSET_GHATIKAS[0]! * 24 * 60_000;
    const expectedEndMs = expectedStartMs + VARJYAM_DURATION_MINUTES * 60_000;
    // findStartTime resolves to within ~30 s tolerance.
    expect(Math.abs(window.start.getTime() - expectedStartMs)).toBeLessThan(60_000);
    expect(Math.abs(window.end.getTime() - expectedEndMs)).toBeLessThan(60_000);
  });

  // Anuradha (16): offset 10 ghatikas = 4 h, duration 96 min.
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
    expect(window.end.getTime() - window.start.getTime())
      .toBe(VARJYAM_DURATION_MINUTES * 60_000);
  });

  // Mula (18): offset 56 ghatikas = 22.4 h. With nakshatra started right at
  // sunrise, the window lands deep inside the Hindu day (22:24 to 24:00).
  it('Mula starting at sunrise → window 22:24 to 24:00 after sunrise', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    const moon = syntheticMoon(sunrise, 18);

    const window = computeVarjyam(18, sunrise, nextSunrise, moon);
    expect(window).not.toBeNull();
    if (!window) return;

    const expectedStartMs = sunrise.getTime() + 56 * 24 * 60_000; // 22:24 after sunrise
    expect(Math.abs(window.start.getTime() - expectedStartMs)).toBeLessThan(60_000);
    // End coincides with nextSunrise (22:24 + 1:36 = 24:00).
    expect(Math.abs(window.end.getTime() - nextSunrise.getTime())).toBeLessThan(60_000);
  });

  it('window length is always exactly 96 minutes', () => {
    const sunrise = new Date('2025-06-01T00:00:00Z');
    const nextSunrise = new Date(sunrise.getTime() + 24 * 3600_000);
    for (let n = 0; n < 27; n++) {
      const moon = syntheticMoon(sunrise, n);
      const w = computeVarjyam(n, sunrise, nextSunrise, moon);
      if (w) {
        expect(w.end.getTime() - w.start.getTime())
          .toBe(VARJYAM_DURATION_MINUTES * 60_000);
      }
    }
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
      expect(window.end.getTime() - window.start.getTime())
        .toBe(VARJYAM_DURATION_MINUTES * 60_000);
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
