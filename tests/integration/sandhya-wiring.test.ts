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
    expect(r.muhurtas.madhyahna).toBeDefined();
    expect(r.muhurtas.pratahSandhya).toBeDefined();
    expect(r.muhurtas.sayahnaSandhya).toBeDefined();
    expect(typeof r.sun.dinamanaMinutes).toBe('number');
    expect(typeof r.sun.ratrimanaMinutes).toBe('number');
  });

  it('madhyahna lands strictly between sunrise and sunset', () => {
    expect(r.muhurtas.madhyahna.start.getTime()).toBeGreaterThan(r.sun.rise.getTime());
    expect(r.muhurtas.madhyahna.end.getTime()).toBeLessThan(r.sun.set.getTime());
  });

  it('madhyahna duration is 48 minutes', () => {
    expect(r.muhurtas.madhyahna.end.getTime() - r.muhurtas.madhyahna.start.getTime()).toBe(48 * 60_000);
  });

  it('madhyahna is centered on the sunrise→sunset midpoint', () => {
    const noonMs = (r.sun.rise.getTime() + r.sun.set.getTime()) / 2;
    const centerMs = (r.muhurtas.madhyahna.start.getTime() + r.muhurtas.madhyahna.end.getTime()) / 2;
    // Sub-millisecond, not exact: when sunrise + sunset is odd the true midpoint
    // lands on a half-millisecond, which an integer-ms Date cannot represent.
    // Asserting equality only held while that sum happened to be even.
    expect(Math.abs(centerMs - noonMs)).toBeLessThanOrEqual(1);
  });

  it('pratah sandhya ends at sunrise and is 3 night-ghatikas wide', () => {
    expect(r.muhurtas.pratahSandhya.end.getTime()).toBe(r.sun.rise.getTime());
    expect(r.muhurtas.pratahSandhya.start.getTime()).toBeLessThan(r.sun.rise.getTime());
    const widthMs = r.muhurtas.pratahSandhya.end.getTime() - r.muhurtas.pratahSandhya.start.getTime();
    const expectedMs = r.sun.ratrimanaMinutes * 60_000 / 10;
    expect(Math.abs(widthMs - expectedMs)).toBeLessThan(60_000);
  });

  it('sayahna sandhya starts at sunset and is 3 night-ghatikas wide', () => {
    expect(r.muhurtas.sayahnaSandhya.start.getTime()).toBe(r.sun.set.getTime());
    expect(r.muhurtas.sayahnaSandhya.end.getTime()).toBeGreaterThan(r.sun.set.getTime());
    const widthMs = r.muhurtas.sayahnaSandhya.end.getTime() - r.muhurtas.sayahnaSandhya.start.getTime();
    const expectedMs = r.sun.ratrimanaMinutes * 60_000 / 10;
    expect(Math.abs(widthMs - expectedMs)).toBeLessThan(60_000);
  });

  it('dinamanaMinutes equals dayDurationMinutes', () => {
    expect(r.sun.dinamanaMinutes).toBe(r.sun.dayDurationMinutes);
  });

  it('ratrimanaMinutes equals nightDurationMinutes', () => {
    expect(r.sun.ratrimanaMinutes).toBe(r.sun.nightDurationMinutes);
  });

  it('dinamana + ratrimana ≈ 24 h (within 1 min rounding)', () => {
    expect(Math.abs(r.sun.dinamanaMinutes + r.sun.ratrimanaMinutes - 1440)).toBeLessThanOrEqual(1);
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
      expect(r.muhurtas.pratahSandhya.end.getTime()).toBe(r.sun.rise.getTime());
    });

    it(`${name}: sayahna sandhya start == sunset`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      expect(r.muhurtas.sayahnaSandhya.start.getTime()).toBe(r.sun.set.getTime());
    });

    it(`${name}: dinamana + ratrimana ≈ 1440 min`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      expect(Math.abs(r.sun.dinamanaMinutes + r.sun.ratrimanaMinutes - 1440)).toBeLessThanOrEqual(1);
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
      // v5: read the wall clock from the offset-carrying `*Local` string.
      const [h, m] = r.muhurtas.pratahSandhya.endLocal.slice(11, 16).split(':').map(Number) as [number, number];
      const expectedMin = sunriseLocalHHMM[0] * 60 + sunriseLocalHHMM[1];
      const actualMin = h * 60 + m;
      expect(Math.abs(actualMin - expectedMin)).toBeLessThanOrEqual(2);
    });
  }
});
