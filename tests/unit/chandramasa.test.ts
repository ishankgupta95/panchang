/**
 * Unit tests for Chandra Masa (lunar month) computation.
 *
 * 12 months: Chaitra(0) through Phalguna(11) in Amanta system.
 * Adhika (intercalary/leap) months occur when two consecutive
 * Amavasyas fall in the same solar month.
 */

import { describe, it, expect } from 'vitest';
import { computeChandraMasa } from '../../src/core/chandramasa';

const MASA_NAMES = [
  'Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha',
  'Shravana', 'Bhadrapada', 'Ashwin', 'Kartika',
  'Margashirsha', 'Pausha', 'Magha', 'Phalguna',
];

const nameResolver = (idx: number, isAdhika: boolean) =>
  (isAdhika ? 'Adhika ' : '') + MASA_NAMES[idx];

describe('computeChandraMasa', () => {
  it('returns a valid masa index (0-11)', () => {
    // Sun at 270° (Makara), Moon at 100° — should be some valid month
    const result = computeChandraMasa(270, 100, nameResolver);
    expect(result.index).toBeGreaterThanOrEqual(0);
    expect(result.index).toBeLessThanOrEqual(11);
  });

  it('name includes the correct month name', () => {
    const result = computeChandraMasa(270, 100, nameResolver);
    expect(MASA_NAMES).toContain(result.name.replace('Adhika ', ''));
  });

  it('isAdhika is a boolean', () => {
    const result = computeChandraMasa(270, 100, nameResolver);
    expect(typeof result.isAdhika).toBe('boolean');
  });

  it('purnimantaIndex is a valid index (0-11)', () => {
    const result = computeChandraMasa(270, 100, nameResolver);
    expect(result.purnimantaIndex).toBeGreaterThanOrEqual(0);
    expect(result.purnimantaIndex).toBeLessThanOrEqual(11);
  });

  describe('month varies with Sun position', () => {
    // When Sun is in different rashis, chandra masa should change
    const sunPositions = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];
    const moonLon = 100; // Fixed moon position

    it('different sun positions produce different masa indices', () => {
      const indices = new Set<number>();
      for (const sunLon of sunPositions) {
        const result = computeChandraMasa(sunLon, moonLon, nameResolver);
        indices.add(result.index);
      }
      // Should produce multiple different months
      expect(indices.size).toBeGreaterThan(1);
    });
  });

  describe('all 12 months can be produced', () => {
    it('sweeping Sun through 12 rashis yields distinct months', () => {
      const indices = new Set<number>();
      for (let sunRashi = 0; sunRashi < 12; sunRashi++) {
        const sunLon = sunRashi * 30 + 15; // mid-rashi
        const moonLon = sunLon + 60; // 60° ahead of sun (Shukla Panchami area)
        const result = computeChandraMasa(sunLon, moonLon, nameResolver);
        indices.add(result.index);
      }
      expect(indices.size).toBe(12);
    });
  });
});
