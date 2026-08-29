import { describe, it, expect } from 'vitest';
import { computeDurMuhurta } from '../../src/core/durMuhurta';

const sunrise = new Date('2024-01-01T06:00:00Z');
const sunset = new Date('2024-01-01T18:00:00Z');
const nextSunrise = new Date('2024-01-02T06:00:00Z');
// Each half of the day carries 15 muhurtas.
const MUHURTA_MS = (12 * 3600_000) / 15;

// Classical Muhurta-Chintamani ordinals (0-based), verified against the
// reference almanac over 58 days.
const EXPECTED: readonly (readonly { ordinal: number; segment: 'day' | 'night' }[])[] = [
  [{ ordinal: 13, segment: 'day' }],
  [{ ordinal: 8, segment: 'day' }, { ordinal: 11, segment: 'day' }],
  [{ ordinal: 3, segment: 'day' }, { ordinal: 6, segment: 'night' }],
  [{ ordinal: 7, segment: 'day' }],
  [{ ordinal: 5, segment: 'day' }, { ordinal: 11, segment: 'day' }],
  [{ ordinal: 3, segment: 'day' }, { ordinal: 8, segment: 'day' }],
  [{ ordinal: 0, segment: 'day' }, { ordinal: 1, segment: 'day' }],
];

describe('computeDurMuhurta', () => {
  it('returns the classical window count per weekday (1 for Sun/Wed, 2 otherwise)', () => {
    for (let vara = 0; vara < 7; vara++) {
      const result = computeDurMuhurta(sunrise, sunset, nextSunrise, vara);
      expect(result).toHaveLength(EXPECTED[vara]!.length);
      for (const w of result) {
        expect(w).toHaveProperty('start');
        expect(w).toHaveProperty('end');
        expect(['day', 'night']).toContain(w.segment);
      }
    }
  });

  it('every window sits at its classical ordinal in its segment', () => {
    for (let vara = 0; vara < 7; vara++) {
      const result = computeDurMuhurta(sunrise, sunset, nextSunrise, vara);
      result.forEach((w, i) => {
        const { ordinal, segment } = EXPECTED[vara]![i]!;
        const base = segment === 'day' ? sunrise.getTime() : sunset.getTime();
        expect(w.segment).toBe(segment);
        expect(w.start.getTime()).toBe(base + ordinal * MUHURTA_MS);
        expect(w.end.getTime()).toBe(base + (ordinal + 1) * MUHURTA_MS);
      });
    }
  });

  it('each dur muhurta lasts exactly one muhurta (~48 min for 12h halves)', () => {
    for (let vara = 0; vara < 7; vara++) {
      for (const w of computeDurMuhurta(sunrise, sunset, nextSunrise, vara)) {
        expect(w.end.getTime() - w.start.getTime()).toBe(MUHURTA_MS);
      }
    }
  });

  it('day windows lie within sunrise→sunset, night windows within sunset→nextSunrise', () => {
    for (let vara = 0; vara < 7; vara++) {
      for (const w of computeDurMuhurta(sunrise, sunset, nextSunrise, vara)) {
        const lo = w.segment === 'day' ? sunrise : sunset;
        const hi = w.segment === 'day' ? sunset : nextSunrise;
        expect(w.start.getTime()).toBeGreaterThanOrEqual(lo.getTime());
        expect(w.end.getTime()).toBeLessThanOrEqual(hi.getTime());
      }
    }
  });

  it('windows are returned in start order', () => {
    for (let vara = 0; vara < 7; vara++) {
      const result = computeDurMuhurta(sunrise, sunset, nextSunrise, vara);
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.start.getTime()).toBeGreaterThan(result[i - 1]!.start.getTime());
      }
    }
  });

  it('only Tuesday carries a night window', () => {
    for (let vara = 0; vara < 7; vara++) {
      const nightCount = computeDurMuhurta(sunrise, sunset, nextSunrise, vara)
        .filter((w) => w.segment === 'night').length;
      expect(nightCount).toBe(vara === 2 ? 1 : 0);
    }
  });

  it('Sunday: single window at day ordinal 13 (16:24 for the 06:00-18:00 day)', () => {
    const [dm] = computeDurMuhurta(sunrise, sunset, nextSunrise, 0);
    expect(dm!.start.getUTCHours()).toBe(16);
    expect(dm!.start.getUTCMinutes()).toBe(24);
    expect(dm!.end.getUTCHours()).toBe(17);
    expect(dm!.end.getUTCMinutes()).toBe(12);
  });

  it('night ordinal scales with night length, not day length (9h day / 15h night)', () => {
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset = new Date('2024-12-21T16:00:00Z');
    const longNextSunrise = new Date('2024-12-22T07:00:00Z');
    const nightMuhurtaMs = (15 * 3600_000) / 15;
    const tue = computeDurMuhurta(shortSunrise, shortSunset, longNextSunrise, 2);
    const night = tue.find((w) => w.segment === 'night')!;
    expect(night.start.getTime()).toBe(shortSunset.getTime() + 6 * nightMuhurtaMs);
    expect(night.end.getTime() - night.start.getTime()).toBe(nightMuhurtaMs);
  });
});
