/**
 * Unit tests for Panchaka Rahita Muhurta — windows of the Hindu day FREE
 * of Panchaka (sidereal Moon outside [300°, 360°)).
 *
 * Spec: PLAN.md Step 28-7. Source: classical Smriti / Muhurta-chintamani —
 * Panchaka comprises Dhanishtha 3rd–4th pada through Revati. Cross-validated
 * against DrikPanchang's daily Panchang display in the wiring test.
 */

import { describe, it, expect } from 'vitest';
import { computePanchakaRahita } from '../../src/core/panchakaRahita';
import { NAKSHATRA_SPAN } from '../../src/utils/constants';

/**
 * Synthetic Moon: starts at `startLongitude` at `epochUtc` and advances at a
 * steady 360°/(periodDays). Lets tests construct deterministic Panchaka
 * entry/exit times without depending on real ephemeris.
 */
function syntheticMoon(
  epochUtc: Date,
  startLongitude: number,
  periodDays: number = 27.32166,
): (d: Date) => number {
  const degPerMs = 360 / (periodDays * 86_400_000);
  return (d: Date) => {
    const dt = d.getTime() - epochUtc.getTime();
    return ((startLongitude + dt * degPerMs) % 360 + 360) % 360;
  };
}

const SUNRISE = new Date('2026-04-26T01:00:00Z');
const NEXT_SUNRISE = new Date('2026-04-27T01:00:00Z');
const HINDU_DAY_MS = NEXT_SUNRISE.getTime() - SUNRISE.getTime();

describe('computePanchakaRahita — endpoints both inside Panchaka', () => {
  it('returns [] when Moon is in Panchaka all day (deep inside, no transit)', () => {
    // Moon starts at 320° (well inside Panchaka) and moves ~13°/day → ends ~333°.
    const moon = syntheticMoon(SUNRISE, 320);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toEqual([]);
  });

  it('returns [] for the boundary case Moon = exactly 300° at sunrise', () => {
    // 300° is the inclusive lower bound — `>= 300` triggers Panchaka.
    const moon = syntheticMoon(SUNRISE, 300);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toEqual([]);
  });
});

describe('computePanchakaRahita — endpoints both outside Panchaka', () => {
  it('returns full [sunrise, nextSunrise] window when Moon is in Ashwini all day', () => {
    // Ashwini = nakshatra 0, longitude [0°, ~13.33°). Stays clear of Panchaka.
    const moon = syntheticMoon(SUNRISE, 5);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toHaveLength(1);
    expect(result[0]!.start.getTime()).toBe(SUNRISE.getTime());
    expect(result[0]!.end.getTime()).toBe(NEXT_SUNRISE.getTime());
  });

  it('returns full window when Moon is at 200° (mid-zodiac, far from Panchaka)', () => {
    const moon = syntheticMoon(SUNRISE, 200);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toHaveLength(1);
    expect(result[0]!.end.getTime() - result[0]!.start.getTime()).toBe(HINDU_DAY_MS);
  });
});

describe('computePanchakaRahita — single transition during the day', () => {
  it('Moon enters Panchaka mid-day (crosses 300° upward) → returns [sunrise, T]', () => {
    // Place Moon at 296° at sunrise so it crosses 300° about 4° / (360/27.32) ≈ 7.5 h later.
    const moon = syntheticMoon(SUNRISE, 296);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toHaveLength(1);
    expect(result[0]!.start.getTime()).toBe(SUNRISE.getTime());
    // Crossing time should be strictly inside the day.
    expect(result[0]!.end.getTime()).toBeGreaterThan(SUNRISE.getTime());
    expect(result[0]!.end.getTime()).toBeLessThan(NEXT_SUNRISE.getTime());

    // Sanity: at the reported end time, Moon is at ~300° (within 0.05°).
    const moonAtEnd = moon(result[0]!.end);
    expect(Math.abs(moonAtEnd - 300)).toBeLessThan(0.05);
  });

  it('Moon exits Panchaka mid-day (wraps 360°→0°) → returns [T, nextSunrise]', () => {
    // Place Moon at 358° at sunrise → exits Panchaka by wrapping to 0° about 2°/13°/day ≈ 3.7 h later.
    const moon = syntheticMoon(SUNRISE, 358);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toHaveLength(1);
    expect(result[0]!.end.getTime()).toBe(NEXT_SUNRISE.getTime());
    expect(result[0]!.start.getTime()).toBeGreaterThan(SUNRISE.getTime());
    expect(result[0]!.start.getTime()).toBeLessThan(NEXT_SUNRISE.getTime());

    // Sanity: at the reported start time, Moon has just wrapped (≤ 0.05° from 0/360).
    const moonAtStart = moon(result[0]!.start);
    const distToWrap = Math.min(moonAtStart, 360 - moonAtStart);
    expect(distToWrap).toBeLessThan(0.05);
  });
});

describe('computePanchakaRahita — TimePeriod contract', () => {
  it('every returned slice has end > start', () => {
    // Sweep across all 27 nakshatras as starting longitudes.
    for (let n = 0; n < 27; n++) {
      const moon = syntheticMoon(SUNRISE, n * NAKSHATRA_SPAN + 1);
      const slices = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
      for (const s of slices) {
        expect(s.end.getTime()).toBeGreaterThan(s.start.getTime());
      }
    }
  });

  it('every returned slice is contained in [sunrise, nextSunrise]', () => {
    for (let n = 0; n < 27; n++) {
      const moon = syntheticMoon(SUNRISE, n * NAKSHATRA_SPAN + 5);
      const slices = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
      for (const s of slices) {
        expect(s.start.getTime()).toBeGreaterThanOrEqual(SUNRISE.getTime());
        expect(s.end.getTime()).toBeLessThanOrEqual(NEXT_SUNRISE.getTime());
      }
    }
  });

  it('returns at most one slice per Hindu day', () => {
    // Moon moves ≤ ~14°/day; the Panchaka span is 60°. Mathematically there
    // can be at most one boundary crossing in 24h, so the result is always
    // size 0 or 1.
    for (let lon = 0; lon < 360; lon += 5) {
      const moon = syntheticMoon(SUNRISE, lon);
      const slices = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
      expect(slices.length).toBeLessThanOrEqual(1);
    }
  });
});
