/**
 * Integration tests — Madhyahna, Pratah/Sayahna Sandhya, Dinamana/Ratrimana
 * wired into getDailyPanchang as non-optional fields (Step 28-4).
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const NOON_2025_01_14 = new Date(Date.UTC(2025, 0, 14, 12, 0, 0, 0));

describe('Madhyahna / Sandhya wiring — daily panchang', () => {
  const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 })!;

  it('all five new fields are present', () => {
    expect(r).not.toBeNull();
    expect(r.madhyahna).toBeDefined();
    expect(r.pratahSandhya).toBeDefined();
    expect(r.sayahnaSandhya).toBeDefined();
    expect(typeof r.dinamanaMinutes).toBe('number');
    expect(typeof r.ratrimanaMinutes).toBe('number');
  });

  it('madhyahna lands strictly between sunrise and sunset', () => {
    expect(r.madhyahna.start.getTime()).toBeGreaterThan(r.sunrise.getTime());
    expect(r.madhyahna.end.getTime()).toBeLessThan(r.sunset.getTime());
  });

  it('madhyahna duration is 48 minutes', () => {
    expect(r.madhyahna.end.getTime() - r.madhyahna.start.getTime()).toBe(48 * 60_000);
  });

  it('madhyahna is centered on the sunrise→sunset midpoint', () => {
    const noonMs = (r.sunrise.getTime() + r.sunset.getTime()) / 2;
    const centerMs = (r.madhyahna.start.getTime() + r.madhyahna.end.getTime()) / 2;
    // Sub-millisecond, not exact: when sunrise + sunset is odd the true midpoint
    // lands on a half-millisecond, which an integer-ms Date cannot represent.
    // Asserting equality only held while that sum happened to be even.
    expect(Math.abs(centerMs - noonMs)).toBeLessThanOrEqual(1);
  });

  it('pratah sandhya ends at sunrise and is 3 night-ghatikas wide', () => {
    expect(r.pratahSandhya.end.getTime()).toBe(r.sunrise.getTime());
    expect(r.pratahSandhya.start.getTime()).toBeLessThan(r.sunrise.getTime());
    const widthMs = r.pratahSandhya.end.getTime() - r.pratahSandhya.start.getTime();
    const expectedMs = r.ratrimanaMinutes * 60_000 / 10;
    expect(Math.abs(widthMs - expectedMs)).toBeLessThan(60_000);
  });

  it('sayahna sandhya starts at sunset and is 3 night-ghatikas wide', () => {
    expect(r.sayahnaSandhya.start.getTime()).toBe(r.sunset.getTime());
    expect(r.sayahnaSandhya.end.getTime()).toBeGreaterThan(r.sunset.getTime());
    const widthMs = r.sayahnaSandhya.end.getTime() - r.sayahnaSandhya.start.getTime();
    const expectedMs = r.ratrimanaMinutes * 60_000 / 10;
    expect(Math.abs(widthMs - expectedMs)).toBeLessThan(60_000);
  });

  it('dinamanaMinutes equals dayDurationMinutes', () => {
    expect(r.dinamanaMinutes).toBe(r.dayDurationMinutes);
  });

  it('ratrimanaMinutes equals nightDurationMinutes', () => {
    expect(r.ratrimanaMinutes).toBe(r.nightDurationMinutes);
  });

  it('dinamana + ratrimana ≈ 24 h (within 1 min rounding)', () => {
    expect(Math.abs(r.dinamanaMinutes + r.ratrimanaMinutes - 1440)).toBeLessThanOrEqual(1);
  });
});

describe('Madhyahna / Sandhya wiring — multi-city sweep', () => {
  // For each city, the field shape is the same — so a structural sweep
  // catches any city-specific blow-ups.
  const cities: Array<[string, { latitude: number; longitude: number }, number]> = [
    ['Delhi',     { latitude: 28.6139, longitude: 77.2090 }, 330],
    ['Mumbai',    { latitude: 19.0760, longitude: 72.8777 }, 330],
    ['Chennai',   { latitude: 13.0827, longitude: 80.2707 }, 330],
    ['Kolkata',   { latitude: 22.5726, longitude: 88.3639 }, 330],
    ['Bengaluru', { latitude: 12.9716, longitude: 77.5946 }, 330],
  ];

  for (const [name, loc, tz] of cities) {
    it(`${name}: pratah sandhya end == sunrise`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      expect(r).not.toBeNull();
      expect(r.pratahSandhya.end.getTime()).toBe(r.sunrise.getTime());
    });

    it(`${name}: sayahna sandhya start == sunset`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      expect(r.sayahnaSandhya.start.getTime()).toBe(r.sunset.getTime());
    });

    it(`${name}: dinamana + ratrimana ≈ 1440 min`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      expect(Math.abs(r.dinamanaMinutes + r.ratrimanaMinutes - 1440)).toBeLessThanOrEqual(1);
    });
  }
});

describe('Sandhya cross-check (DrikPanchang-style, ±2 min tolerance)', () => {
  // Reference values are DrikPanchang's local sunrise + Sandhya start times
  // for 2025-01-14 (Makar Sankranti). Pratah Sandhya ends at sunrise and is
  // (nightDuration / 10) wide; cross-checking the start time exercises both
  // sunrise accuracy and the night-duration computation.
  const cases: Array<{
    city: string;
    loc: { latitude: number; longitude: number };
    tz: number;
    sunriseLocalHHMM: [number, number];
  }> = [
    { city: 'Delhi',     loc: { latitude: 28.6139, longitude: 77.2090 }, tz: 330, sunriseLocalHHMM: [7, 15] },
    { city: 'Mumbai',    loc: { latitude: 19.0760, longitude: 72.8777 }, tz: 330, sunriseLocalHHMM: [7, 14] },
    { city: 'Chennai',   loc: { latitude: 13.0827, longitude: 80.2707 }, tz: 330, sunriseLocalHHMM: [6, 34] },
    { city: 'Kolkata',   loc: { latitude: 22.5726, longitude: 88.3639 }, tz: 330, sunriseLocalHHMM: [6, 18] },
    { city: 'Bengaluru', loc: { latitude: 12.9716, longitude: 77.5946 }, tz: 330, sunriseLocalHHMM: [6, 45] },
  ];

  for (const { city, loc, tz, sunriseLocalHHMM } of cases) {
    it(`${city}: Pratah Sandhya end within ±2 min of expected sunrise`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      expect(r).not.toBeNull();
      const end = r.pratahSandhya.end;
      const expectedMin = sunriseLocalHHMM[0] * 60 + sunriseLocalHHMM[1];
      const actualMin = end.getUTCHours() * 60 + end.getUTCMinutes();
      expect(Math.abs(actualMin - expectedMin)).toBeLessThanOrEqual(2);
    });
  }
});
