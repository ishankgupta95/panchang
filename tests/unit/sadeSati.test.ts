/**
 * Unit tests for `computeSadeSati`.
 *
 * The classical Sade Sati arc is when transit Saturn occupies the 12th, 1st,
 * or 2nd rashi from the native's natal Moon — a ~7.5-year period that recurs
 * every Saturn return (~29.5 years).
 *
 * Verification approach:
 *   - Internal consistency: phase matches Saturn's current rashi.
 *   - Active/inactive status agrees with `computePlanetaryPositions` for
 *     Saturn (independent path).
 *   - Arc-end > arc-start when active.
 *   - Input validation throws on out-of-range rashi.
 */

import { describe, it, expect } from 'vitest';
import { computeSadeSati } from '../../src/jyotish/sadeSati';
import { computePlanetaryPositions } from '../../src/jyotish/planets';

describe('computeSadeSati — basic shape', () => {
  it('returns active=true with phase 1, 2, or 3 when Saturn is in arc', () => {
    // 2026-05-04: pick a natal Moon rashi that puts Saturn currently in the arc.
    // Saturn's rashi at 2026-05-04 (Pisces, around 4°).
    const asOf = new Date('2026-05-04T00:00:00Z');
    const planets = computePlanetaryPositions(asOf, 'lahiri');
    const satRashi = planets.saturn.rashi.index;
    // For a native with Moon in (satRashi+1)%12, Saturn currently in 12th from Moon → phase 1.
    const result = computeSadeSati((satRashi + 1) % 12, asOf);
    expect(result.active).toBe(true);
    expect(result.phase).toBe(1);
    expect(result.currentArcStart).not.toBeNull();
    expect(result.currentArcEnd).not.toBeNull();
    expect(result.nextArcStart).toBeNull();
  });

  it('phase 2 when Saturn occupies natal Moon rashi', () => {
    const asOf = new Date('2026-05-04T00:00:00Z');
    const planets = computePlanetaryPositions(asOf, 'lahiri');
    const satRashi = planets.saturn.rashi.index;
    const result = computeSadeSati(satRashi, asOf);
    expect(result.active).toBe(true);
    expect(result.phase).toBe(2);
  });

  it('phase 3 when Saturn occupies 2nd from natal Moon (i.e., natal Moon = Saturn-1)', () => {
    const asOf = new Date('2026-05-04T00:00:00Z');
    const planets = computePlanetaryPositions(asOf, 'lahiri');
    const satRashi = planets.saturn.rashi.index;
    const result = computeSadeSati((satRashi + 11) % 12, asOf);
    expect(result.active).toBe(true);
    expect(result.phase).toBe(3);
  });

  it('returns active=false when Saturn is far from arc', () => {
    const asOf = new Date('2026-05-04T00:00:00Z');
    const planets = computePlanetaryPositions(asOf, 'lahiri');
    const satRashi = planets.saturn.rashi.index;
    // Native with Moon 5 rashis away from Saturn's current rashi → not in arc.
    const result = computeSadeSati((satRashi + 5) % 12, asOf);
    expect(result.active).toBe(false);
    expect(result.phase).toBeNull();
    expect(result.currentArcStart).toBeNull();
    expect(result.currentArcEnd).toBeNull();
    expect(result.nextArcStart).not.toBeNull();
  });
});

describe('computeSadeSati — arc boundaries', () => {
  it('arc end > arc start when active', () => {
    const asOf = new Date('2026-05-04T00:00:00Z');
    const planets = computePlanetaryPositions(asOf, 'lahiri');
    const satRashi = planets.saturn.rashi.index;
    const result = computeSadeSati(satRashi, asOf);
    expect(result.currentArcStart!.getTime()).toBeLessThan(asOf.getTime());
    expect(result.currentArcEnd!.getTime()).toBeGreaterThan(asOf.getTime());
  });

  it('arc total duration is between 6 and 9 years (Saturn retrograde tolerance)', () => {
    const asOf = new Date('2026-05-04T00:00:00Z');
    const planets = computePlanetaryPositions(asOf, 'lahiri');
    const satRashi = planets.saturn.rashi.index;
    const result = computeSadeSati(satRashi, asOf);
    const arcDays = (result.currentArcEnd!.getTime() - result.currentArcStart!.getTime()) / 86400_000;
    const years = arcDays / 365.25;
    expect(years).toBeGreaterThan(6.0);
    expect(years).toBeLessThan(9.0);
  });

  it('next arc start is after asOfDate when not active', () => {
    const asOf = new Date('2026-05-04T00:00:00Z');
    const planets = computePlanetaryPositions(asOf, 'lahiri');
    const satRashi = planets.saturn.rashi.index;
    const result = computeSadeSati((satRashi + 5) % 12, asOf);
    expect(result.nextArcStart!.getTime()).toBeGreaterThan(asOf.getTime());
  });
});

describe('computeSadeSati — input validation', () => {
  it('throws on out-of-range natalMoonRashi', () => {
    expect(() => computeSadeSati(-1, new Date('2026-05-04T00:00:00Z'))).toThrow(RangeError);
    expect(() => computeSadeSati(12, new Date('2026-05-04T00:00:00Z'))).toThrow(RangeError);
    expect(() => computeSadeSati(1.5, new Date('2026-05-04T00:00:00Z'))).toThrow(RangeError);
  });

  it('throws on invalid date', () => {
    expect(() => computeSadeSati(0, new Date('not-a-date'))).toThrow();
  });
});
