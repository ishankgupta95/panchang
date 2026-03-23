import { describe, it, expect } from 'vitest';
import { computeAbhijitMuhurta } from '../../src/core/muhurta';

// Known 12-hour day: sunrise 06:00 UTC, sunset 18:00 UTC
// Each of 15 muhurtas = 12h/15 = 48 minutes
// Abhijit = 8th muhurta (index 7, 0-based):
//   start = 06:00 + 7 * 48min = 06:00 + 336min = 11:36
//   end   = 11:36 + 48min = 12:24
const sunrise = new Date('2024-01-01T06:00:00Z');
const sunset = new Date('2024-01-01T18:00:00Z');
const DAY_MS = 12 * 3600_000;
const MUHURTA_MS = DAY_MS / 15; // 48 minutes

describe('computeAbhijitMuhurta', () => {
  it('starts at 11:36 for a 12-hour day', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    expect(abhijit.start.getUTCHours()).toBe(11);
    expect(abhijit.start.getUTCMinutes()).toBe(36);
  });

  it('ends at 12:24 for a 12-hour day', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    expect(abhijit.end.getUTCHours()).toBe(12);
    expect(abhijit.end.getUTCMinutes()).toBe(24);
  });

  it('duration is exactly 1/15 of daytime', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    const duration = abhijit.end.getTime() - abhijit.start.getTime();
    expect(duration).toBe(MUHURTA_MS);
  });

  it('is centered around local noon (within 1 minute)', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    const noonMs = (sunrise.getTime() + sunset.getTime()) / 2;
    const centerMs = (abhijit.start.getTime() + abhijit.end.getTime()) / 2;
    expect(Math.abs(centerMs - noonMs)).toBeLessThan(60_000);
  });

  it('start is after sunrise', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    expect(abhijit.start.getTime()).toBeGreaterThan(sunrise.getTime());
  });

  it('end is before sunset', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    expect(abhijit.end.getTime()).toBeLessThan(sunset.getTime());
  });

  it('works for an asymmetric day (shorter winter day)', () => {
    // 9-hour day: sunrise 07:00, sunset 16:00
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset = new Date('2024-12-21T16:00:00Z');
    const abhijit = computeAbhijitMuhurta(shortSunrise, shortSunset);

    // muhurta = 9h/15 = 36 min; start = 07:00 + 7*36min = 07:00 + 252min = 11:12
    expect(abhijit.start.getUTCHours()).toBe(11);
    expect(abhijit.start.getUTCMinutes()).toBe(12);
    // end = 11:12 + 36min = 11:48
    expect(abhijit.end.getUTCHours()).toBe(11);
    expect(abhijit.end.getUTCMinutes()).toBe(48);
  });
});
