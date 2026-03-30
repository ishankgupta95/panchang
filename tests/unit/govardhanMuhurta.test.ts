import { describe, it, expect } from 'vitest';
import { computeGovardhanMuhurta } from '../../src/core/muhurta';

// Known 12-hour day: sunrise 06:00 UTC, sunset 18:00 UTC
// Each of 15 muhurtas = 12h/15 = 48 minutes
// Govardhan = 8th muhurta (index 7, 0-based):
//   start = 06:00 + 7 * 48min = 06:00 + 336min = 11:36
//   end   = 11:36 + 48min = 12:24
const sunrise = new Date('2024-01-01T06:00:00Z');
const sunset  = new Date('2024-01-01T18:00:00Z');
const DAY_MS  = 12 * 3600_000;
const MUHURTA_MS = DAY_MS / 15; // 48 minutes

describe('computeGovardhanMuhurta', () => {
  it('starts at 11:36 for a 12-hour day', () => {
    const m = computeGovardhanMuhurta(sunrise, sunset);
    expect(m.start.getUTCHours()).toBe(11);
    expect(m.start.getUTCMinutes()).toBe(36);
  });

  it('ends at 12:24 for a 12-hour day', () => {
    const m = computeGovardhanMuhurta(sunrise, sunset);
    expect(m.end.getUTCHours()).toBe(12);
    expect(m.end.getUTCMinutes()).toBe(24);
  });

  it('duration is exactly 1/15 of daytime', () => {
    const m = computeGovardhanMuhurta(sunrise, sunset);
    const duration = m.end.getTime() - m.start.getTime();
    expect(duration).toBe(MUHURTA_MS);
  });

  it('start is after sunrise', () => {
    const m = computeGovardhanMuhurta(sunrise, sunset);
    expect(m.start.getTime()).toBeGreaterThan(sunrise.getTime());
  });

  it('end is before sunset', () => {
    const m = computeGovardhanMuhurta(sunrise, sunset);
    expect(m.end.getTime()).toBeLessThan(sunset.getTime());
  });

  it('start equals sunrise + 7 * (dayDuration / 15)', () => {
    const m = computeGovardhanMuhurta(sunrise, sunset);
    const expected = sunrise.getTime() + 7 * MUHURTA_MS;
    expect(m.start.getTime()).toBe(expected);
  });

  it('works for a 9-hour day (winter)', () => {
    // sunrise 07:00, sunset 16:00 → muhurta = 9h/15 = 36 min
    // start = 07:00 + 7*36min = 07:00 + 252min = 11:12
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset  = new Date('2024-12-21T16:00:00Z');
    const m = computeGovardhanMuhurta(shortSunrise, shortSunset);
    expect(m.start.getUTCHours()).toBe(11);
    expect(m.start.getUTCMinutes()).toBe(12);
    expect(m.end.getUTCHours()).toBe(11);
    expect(m.end.getUTCMinutes()).toBe(48);
  });
});
