/**
 * Unit tests for Yoga computation.
 *
 * 27 yogas, each spanning 13°20' (13.333°) of the combined
 * Sun+Moon sidereal longitude.
 */

import { describe, it, expect } from 'vitest';
import { computeYogaFromLongitudes, getYogaIndex } from '../../src/core/yoga';
import { NAKSHATRA_SPAN } from '../../src/utils/constants';

const YOGA_NAMES = [
  'Vishkamba', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana',
  'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda',
  'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra',
  'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva',
  'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma',
  'Indra', 'Vaidhriti',
];

describe('getYogaIndex', () => {
  it('sum=0° → yoga index 0 (Vishkamba)', () => {
    expect(getYogaIndex(0, 0)).toBe(0);
  });

  it('sum=13.34° → yoga index 1 (Priti)', () => {
    expect(getYogaIndex(10, 3.34)).toBe(1);
  });

  it('wraps around: moonLon=300, sunLon=100 → sum=400→40° → index 3', () => {
    const idx = getYogaIndex(300, 100);
    expect(idx).toBe(Math.floor(40 / NAKSHATRA_SPAN));
  });

  it('all 27 index values can be produced', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 27; i++) {
      const targetMid = i * NAKSHATRA_SPAN + NAKSHATRA_SPAN / 2;
      // Split target between sun and moon
      const idx = getYogaIndex(targetMid / 2, targetMid / 2);
      seen.add(idx);
    }
    expect(seen.size).toBe(27);
  });
});

describe('computeYogaFromLongitudes', () => {
  it('returns correct yoga info', () => {
    const result = computeYogaFromLongitudes(100, 50, 'Vriddhi');
    expect(result.name).toBe('Vriddhi');
    expect(result.index).toBe(Math.floor(150 / NAKSHATRA_SPAN));
  });

  it('completionPercentage is in [0, 100]', () => {
    for (let moon = 0; moon < 360; moon += 30) {
      for (let sun = 0; sun < 360; sun += 30) {
        const idx = getYogaIndex(moon, sun);
        const result = computeYogaFromLongitudes(moon, sun, YOGA_NAMES[idx]!);
        expect(result.completionPercentage).toBeGreaterThanOrEqual(0);
        expect(result.completionPercentage).toBeLessThanOrEqual(100);
      }
    }
  });
});
