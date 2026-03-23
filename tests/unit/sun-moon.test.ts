import { describe, it, expect } from 'vitest';
import { getSiderealSunLongitude, getTropicalSunLongitude } from '../../src/astronomy/sun';
import { getSiderealMoonLongitude, getTropicalMoonLongitude } from '../../src/astronomy/moon';
import { computeAyanamsa } from '../../src/astronomy/ayanamsa';

// Reference date: 2025-01-14T06:00:00Z
// This is Makar Sankranti — Sun enters Makara (Capricorn) sidereal.
// Tropical Sun ≈ 294.3°, Lahiri ayanamsa ≈ 24.2°, sidereal Sun ≈ 270.1°
// Moon geocentric tropical ≈ 118.2°, sidereal ≈ 94.0° (Karka/Cancer)
const DATE = new Date('2025-01-14T06:00:00Z');

describe('getSiderealSunLongitude', () => {
  it('Sun sidereal longitude ≈ 270° on 2025-01-14 (Makar Sankranti — start of Makara)', () => {
    const lon = getSiderealSunLongitude(DATE, 'lahiri');
    // Makara (Capricorn) = 270°–300°; Sun just entered Makara on this date
    expect(lon).toBeGreaterThan(265);
    expect(lon).toBeLessThan(280);
  });

  it('result is in [0, 360)', () => {
    const lon = getSiderealSunLongitude(DATE, 'lahiri');
    expect(lon).toBeGreaterThanOrEqual(0);
    expect(lon).toBeLessThan(360);
  });

  it('sidereal = normalize360(tropical − ayanamsa)', () => {
    const tropical = getTropicalSunLongitude(DATE);
    const ayanamsa = computeAyanamsa(DATE, 'lahiri');
    const expected = ((tropical - ayanamsa) % 360 + 360) % 360;
    const actual = getSiderealSunLongitude(DATE, 'lahiri');
    expect(actual).toBeCloseTo(expected, 4);
  });

  it('KP ayanamsa gives a different result than Lahiri', () => {
    const lahiri = getSiderealSunLongitude(DATE, 'lahiri');
    const kp = getSiderealSunLongitude(DATE, 'krishnamurti');
    // Lahiri ≈ 24.2°, KP ≈ 23.9° — difference ~0.3°
    expect(Math.abs(lahiri - kp)).toBeGreaterThan(0.05);
  });

  it('Sun moves ~1°/day — 24 hours apart differ by ~1°', () => {
    const d1 = new Date('2025-01-14T06:00:00Z');
    const d2 = new Date('2025-01-15T06:00:00Z');
    const lon1 = getSiderealSunLongitude(d1, 'lahiri');
    const lon2 = getSiderealSunLongitude(d2, 'lahiri');
    const diff = ((lon2 - lon1) + 360) % 360;
    expect(diff).toBeGreaterThan(0.9);
    expect(diff).toBeLessThan(1.1);
  });
});

describe('getSiderealMoonLongitude', () => {
  it('Moon sidereal longitude is in [0, 360)', () => {
    const lon = getSiderealMoonLongitude(DATE, 'lahiri');
    expect(lon).toBeGreaterThanOrEqual(0);
    expect(lon).toBeLessThan(360);
  });

  it('Moon sidereal ≈ 94° on 2025-01-14T06:00Z (Karka/Cancer)', () => {
    // Tropical Moon ≈ 118.2°, ayanamsa ≈ 24.2°, sidereal ≈ 94.0°
    const lon = getSiderealMoonLongitude(DATE, 'lahiri');
    expect(lon).toBeGreaterThan(88);
    expect(lon).toBeLessThan(100);
  });

  it('Moon moves ~13°/day — 24 hours apart differ by ~13°', () => {
    const d1 = new Date('2025-01-14T00:00:00Z');
    const d2 = new Date('2025-01-15T00:00:00Z');
    const lon1 = getSiderealMoonLongitude(d1, 'lahiri');
    const lon2 = getSiderealMoonLongitude(d2, 'lahiri');
    const diff = ((lon2 - lon1) + 360) % 360;
    expect(diff).toBeGreaterThan(12);
    expect(diff).toBeLessThan(15);
  });

  it('Moon moves ~0.5°/hour — two timestamps 1 hour apart differ by ~0.5°', () => {
    const d1 = new Date('2025-01-14T06:00:00Z');
    const d2 = new Date('2025-01-14T07:00:00Z');
    const lon1 = getSiderealMoonLongitude(d1, 'lahiri');
    const lon2 = getSiderealMoonLongitude(d2, 'lahiri');
    const diff = ((lon2 - lon1) + 360) % 360;
    expect(diff).toBeGreaterThan(0.3);
    expect(diff).toBeLessThan(0.8);
  });

  it('sidereal = normalize360(tropical − ayanamsa)', () => {
    const tropical = getTropicalMoonLongitude(DATE);
    const ayanamsa = computeAyanamsa(DATE, 'lahiri');
    const expected = ((tropical - ayanamsa) % 360 + 360) % 360;
    const actual = getSiderealMoonLongitude(DATE, 'lahiri');
    expect(actual).toBeCloseTo(expected, 4);
  });
});
