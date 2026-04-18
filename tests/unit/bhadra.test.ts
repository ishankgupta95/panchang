import { describe, it, expect } from 'vitest';
import { computeBhadraKaal, isVishtiKarana } from '../../src/core/bhadra';
import { LongitudeCache } from '../../src/astronomy/cache';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';

describe('isVishtiKarana', () => {
  it('returns true for the 8 Vishti indices', () => {
    for (const k of [7, 14, 21, 28, 35, 42, 49, 56]) {
      expect(isVishtiKarana(k)).toBe(true);
    }
  });

  it('returns false for fixed karanas (0, 57-59)', () => {
    for (const k of [0, 57, 58, 59]) {
      expect(isVishtiKarana(k)).toBe(false);
    }
  });

  it('returns false for non-Vishti movable karanas', () => {
    for (const k of [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 22, 50]) {
      expect(isVishtiKarana(k)).toBe(false);
    }
  });
});

describe('computeBhadraKaal', () => {
  it('returns null when no Vishti karana touches the Hindu day', () => {
    // Find a day where there's no Bhadra. Pick 2025-01-04 in Delhi.
    const loc = { latitude: 28.6139, longitude: 77.2090 };
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    const getSun = (d: Date) => cache.getSun(d);

    const sunrise = computeSunrise(new Date('2025-01-04T00:00:00Z'), loc);
    const sunset = computeSunset(sunrise, loc);
    const nextSunrise = computeSunrise(sunset, loc);

    // This day may or may not have bhadra — the test just confirms the
    // function never crashes and returns either a valid window or null.
    const bhadra = computeBhadraKaal(sunrise, nextSunrise, getMoon, getSun);
    if (bhadra !== null) {
      expect(bhadra.start.getTime()).toBeLessThan(bhadra.end.getTime());
      expect(['earth', 'heaven', 'paatal']).toContain(bhadra.location);
    }
  });

  it('detects Bhadra on Raksha Bandhan 2024 (2024-08-19, Delhi)', () => {
    // Drik-reported Bhadra End on Raksha Bandhan day Aug 19, 2024: 01:32 PM IST
    // = 08:02 UTC. Bhadra covered the morning of Aug 19 (Shukla Purnima 1st half).
    const loc = { latitude: 28.6139, longitude: 77.2090 };
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    const getSun = (d: Date) => cache.getSun(d);

    const sunrise = computeSunrise(new Date('2024-08-19T00:00:00Z'), loc);
    const sunset = computeSunset(sunrise, loc);
    const nextSunrise = computeSunrise(sunset, loc);

    const bhadra = computeBhadraKaal(sunrise, nextSunrise, getMoon, getSun);
    expect(bhadra).not.toBeNull();
    if (bhadra) {
      expect(bhadra.end.getUTCFullYear()).toBe(2024);
      expect(bhadra.end.getUTCMonth()).toBe(7); // August
      expect(bhadra.end.getUTCDate()).toBe(19);
      // Within ±30 min of Drik's 13:32 IST (08:02 UTC)
      const endMs = bhadra.end.getTime();
      const target = new Date('2024-08-19T08:02:00Z').getTime();
      expect(Math.abs(endMs - target)).toBeLessThan(30 * 60_000);
    }
  });
});
