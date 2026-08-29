// Panchaka (Muhurta-chintamani) is Dhanishtha 3rd pada through Revati, sidereal
// Moon in [300°, 360°); Panchaka Rahita is its complement within the Hindu day.

import { describe, it, expect } from 'vitest';
import { computePanchakaRahita } from '../../src/core/panchakaRahita';
import { NAKSHATRA_SPAN } from '../../src/utils/constants';

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

describe('computePanchakaRahita: endpoints both inside Panchaka', () => {
  it('returns [] when Moon is in Panchaka all day (deep inside, no transit)', () => {
    const moon = syntheticMoon(SUNRISE, 320);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toEqual([]);
  });

  it('returns [] for the boundary case Moon = exactly 300° at sunrise', () => {
    const moon = syntheticMoon(SUNRISE, 300);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toEqual([]);
  });
});

describe('computePanchakaRahita: endpoints both outside Panchaka', () => {
  it('returns full [sunrise, nextSunrise] window when Moon is in Ashwini all day', () => {
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

describe('computePanchakaRahita: single transition during the day', () => {
  it('Moon enters Panchaka mid-day (crosses 300° upward) → returns [sunrise, T]', () => {
    const moon = syntheticMoon(SUNRISE, 296);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toHaveLength(1);
    expect(result[0]!.start.getTime()).toBe(SUNRISE.getTime());
    expect(result[0]!.end.getTime()).toBeGreaterThan(SUNRISE.getTime());
    expect(result[0]!.end.getTime()).toBeLessThan(NEXT_SUNRISE.getTime());

    const moonAtEnd = moon(result[0]!.end);
    expect(Math.abs(moonAtEnd - 300)).toBeLessThan(0.05);
  });

  it('Moon exits Panchaka mid-day (wraps 360°→0°) → returns [T, nextSunrise]', () => {
    const moon = syntheticMoon(SUNRISE, 358);
    const result = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
    expect(result).toHaveLength(1);
    expect(result[0]!.end.getTime()).toBe(NEXT_SUNRISE.getTime());
    expect(result[0]!.start.getTime()).toBeGreaterThan(SUNRISE.getTime());
    expect(result[0]!.start.getTime()).toBeLessThan(NEXT_SUNRISE.getTime());

    const moonAtStart = moon(result[0]!.start);
    const distToWrap = Math.min(moonAtStart, 360 - moonAtStart);
    expect(distToWrap).toBeLessThan(0.05);
  });
});

describe('computePanchakaRahita: TimePeriod contract', () => {
  it('every returned slice has end > start', () => {
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
    for (let lon = 0; lon < 360; lon += 5) {
      const moon = syntheticMoon(SUNRISE, lon);
      const slices = computePanchakaRahita(SUNRISE, NEXT_SUNRISE, moon);
      expect(slices.length).toBeLessThanOrEqual(1);
    }
  });
});
