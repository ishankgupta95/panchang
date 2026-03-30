import { describe, it, expect } from 'vitest';
import { computeDurMuhurta } from '../../src/core/durMuhurta';

// Known 12-hour day: sunrise 06:00 UTC, sunset 18:00 UTC
// 15 muhurtas, each = 12h/15 = 48 minutes = 2,880,000 ms
const sunrise = new Date('2024-01-01T06:00:00Z');
const sunset = new Date('2024-01-01T18:00:00Z');
const MUHURTA_MS = (12 * 3600_000) / 15; // 48 minutes

describe('computeDurMuhurta', () => {
  it('returns exactly two TimePeriod entries', () => {
    const result = computeDurMuhurta(sunrise, sunset, 0);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('start');
    expect(result[0]).toHaveProperty('end');
    expect(result[1]).toHaveProperty('start');
    expect(result[1]).toHaveProperty('end');
  });

  it('each dur muhurta lasts exactly one muhurta (~48 min for 12h day)', () => {
    for (let vara = 0; vara < 7; vara++) {
      const [dm1, dm2] = computeDurMuhurta(sunrise, sunset, vara);
      expect(dm1.end.getTime() - dm1.start.getTime()).toBe(MUHURTA_MS);
      expect(dm2.end.getTime() - dm2.start.getTime()).toBe(MUHURTA_MS);
    }
  });

  it('all dur muhurtas are within sunrise-sunset window', () => {
    for (let vara = 0; vara < 7; vara++) {
      const [dm1, dm2] = computeDurMuhurta(sunrise, sunset, vara);
      expect(dm1.start.getTime()).toBeGreaterThanOrEqual(sunrise.getTime());
      expect(dm1.end.getTime()).toBeLessThanOrEqual(sunset.getTime());
      expect(dm2.start.getTime()).toBeGreaterThanOrEqual(sunrise.getTime());
      expect(dm2.end.getTime()).toBeLessThanOrEqual(sunset.getTime());
    }
  });

  it('first dur muhurta starts before the second', () => {
    for (let vara = 0; vara < 7; vara++) {
      const [dm1, dm2] = computeDurMuhurta(sunrise, sunset, vara);
      expect(dm1.start.getTime()).toBeLessThan(dm2.start.getTime());
    }
  });

  it('Sunday: indices 7 and 13', () => {
    const [dm1, dm2] = computeDurMuhurta(sunrise, sunset, 0);
    // start = 06:00 + 7*48min = 06:00 + 336min = 11:36
    expect(dm1.start.getUTCHours()).toBe(11);
    expect(dm1.start.getUTCMinutes()).toBe(36);
    // start = 06:00 + 13*48min = 06:00 + 624min = 16:24
    expect(dm2.start.getUTCHours()).toBe(16);
    expect(dm2.start.getUTCMinutes()).toBe(24);
  });

  it('works for a short winter day (9 hours)', () => {
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset = new Date('2024-12-21T16:00:00Z');
    const shortMuhurtaMs = (9 * 3600_000) / 15; // 36 minutes

    const [dm1, dm2] = computeDurMuhurta(shortSunrise, shortSunset, 0);
    expect(dm1.end.getTime() - dm1.start.getTime()).toBe(shortMuhurtaMs);
    expect(dm2.end.getTime() - dm2.start.getTime()).toBe(shortMuhurtaMs);
  });

  it('each vara produces different positions', () => {
    const positions = new Set<string>();
    for (let vara = 0; vara < 7; vara++) {
      const [dm1, dm2] = computeDurMuhurta(sunrise, sunset, vara);
      positions.add(`${dm1.start.getTime()}-${dm2.start.getTime()}`);
    }
    expect(positions.size).toBe(7);
  });
});
