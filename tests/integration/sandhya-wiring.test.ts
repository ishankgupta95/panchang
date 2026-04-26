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
    expect(centerMs).toBe(noonMs);
  });

  it('pratah sandhya straddles sunrise', () => {
    expect(r.pratahSandhya.start.getTime()).toBeLessThan(r.sunrise.getTime());
    expect(r.pratahSandhya.end.getTime()).toBeGreaterThan(r.sunrise.getTime());
    expect(r.pratahSandhya.end.getTime() - r.pratahSandhya.start.getTime()).toBe(48 * 60_000);
  });

  it('sayahna sandhya straddles sunset', () => {
    expect(r.sayahnaSandhya.start.getTime()).toBeLessThan(r.sunset.getTime());
    expect(r.sayahnaSandhya.end.getTime()).toBeGreaterThan(r.sunset.getTime());
    expect(r.sayahnaSandhya.end.getTime() - r.sayahnaSandhya.start.getTime()).toBe(48 * 60_000);
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
    it(`${name}: pratah sandhya midpoint == sunrise (within 1s)`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      expect(r).not.toBeNull();
      const midpointMs = (r.pratahSandhya.start.getTime() + r.pratahSandhya.end.getTime()) / 2;
      expect(Math.abs(midpointMs - r.sunrise.getTime())).toBeLessThan(1000);
    });

    it(`${name}: sayahna sandhya midpoint == sunset (within 1s)`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      const midpointMs = (r.sayahnaSandhya.start.getTime() + r.sayahnaSandhya.end.getTime()) / 2;
      expect(Math.abs(midpointMs - r.sunset.getTime())).toBeLessThan(1000);
    });

    it(`${name}: dinamana + ratrimana ≈ 1440 min`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      expect(Math.abs(r.dinamanaMinutes + r.ratrimanaMinutes - 1440)).toBeLessThanOrEqual(1);
    });
  }
});

describe('Pratah Sandhya cross-check (DrikPanchang-style, ±2 min tolerance)', () => {
  // Pratah Sandhya midpoint == sunrise, so cross-checking it is equivalent
  // to cross-checking sunrise itself. Reference values are DrikPanchang's
  // local sunrise for 2025-01-14 (Makar Sankranti). Tolerance ±2 min absorbs
  // minor differences in horizon refraction model.
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
    it(`${city}: Pratah Sandhya midpoint within ±2 min of expected sunrise`, () => {
      const r = getDailyPanchang(NOON_2025_01_14, loc, { timezone: tz })!;
      expect(r).not.toBeNull();
      const midpointMs = (r.pratahSandhya.start.getTime() + r.pratahSandhya.end.getTime()) / 2;
      const midpoint = new Date(midpointMs);
      // local clock from offset-shifted Date (read via getUTC*)
      const localHour = midpoint.getUTCHours();
      const localMinute = midpoint.getUTCMinutes();
      const expectedMin = sunriseLocalHHMM[0] * 60 + sunriseLocalHHMM[1];
      const actualMin = localHour * 60 + localMinute;
      expect(Math.abs(actualMin - expectedMin)).toBeLessThanOrEqual(2);
    });
  }
});
