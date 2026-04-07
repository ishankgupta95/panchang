/**
 * Unit tests for Chandra Masa (lunar month) computation.
 *
 * 12 months: Chaitra(0) through Phalguna(11).
 * Default system is Purnimanta (North Indian); Amanta (South Indian) available.
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
  (isAdhika ? 'Adhika ' : '') + MASA_NAMES[idx]!;

describe('computeChandraMasa', () => {
  it('defaults to purnimanta system', () => {
    const result = computeChandraMasa(270, 100, nameResolver);
    expect(result.system).toBe('purnimanta');
  });

  it('returns a valid masa index (0-11)', () => {
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

  it('provides both amanta and purnimanta fields', () => {
    const result = computeChandraMasa(270, 100, nameResolver);
    expect(result.amantaIndex).toBeGreaterThanOrEqual(0);
    expect(result.amantaIndex).toBeLessThanOrEqual(11);
    expect(result.purnimantaIndex).toBeGreaterThanOrEqual(0);
    expect(result.purnimantaIndex).toBeLessThanOrEqual(11);
    expect(MASA_NAMES).toContain(result.amantaName.replace('Adhika ', ''));
    expect(MASA_NAMES).toContain(result.purnimantaName);
  });

  describe('purnimanta vs amanta system', () => {
    it('in Shukla Paksha, both systems agree', () => {
      // Moon 60° ahead of Sun → elongation 60° → Shukla Paksha
      const sunLon = 15;
      const moonLon = sunLon + 60;
      const purnimanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'purnimanta');
      const amanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'amanta');
      expect(purnimanta.index).toBe(amanta.index);
      expect(purnimanta.name).toBe(amanta.name);
    });

    it('in Krishna Paksha, purnimanta is one month ahead of amanta', () => {
      // Moon 200° ahead of Sun → elongation 200° → Krishna Paksha
      const sunLon = 15;
      const moonLon = (sunLon + 200) % 360;
      const purnimanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'purnimanta');
      const amanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'amanta');
      expect(purnimanta.index).toBe((amanta.index + 1) % 12);
      expect(purnimanta.amantaIndex).toBe(amanta.index);
      expect(amanta.purnimantaIndex).toBe(purnimanta.index);
    });

    it('amanta system sets index/name to amanta values', () => {
      const result = computeChandraMasa(270, 100, nameResolver, 'amanta');
      expect(result.system).toBe('amanta');
      expect(result.index).toBe(result.amantaIndex);
      expect(result.name).toBe(result.amantaName);
    });

    it('purnimanta system sets index/name to purnimanta values', () => {
      const result = computeChandraMasa(270, 100, nameResolver, 'purnimanta');
      expect(result.system).toBe('purnimanta');
      expect(result.index).toBe(result.purnimantaIndex);
      expect(result.name).toBe(result.purnimantaName);
    });
  });

  describe('month varies with Sun position', () => {
    const sunPositions = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];
    const moonLon = 100;

    it('different sun positions produce different masa indices', () => {
      const indices = new Set<number>();
      for (const sunLon of sunPositions) {
        const result = computeChandraMasa(sunLon, moonLon, nameResolver);
        indices.add(result.amantaIndex);
      }
      expect(indices.size).toBeGreaterThan(1);
    });
  });

  describe('all 12 months can be produced', () => {
    it('sweeping Sun through 12 rashis yields distinct months', () => {
      const indices = new Set<number>();
      for (let sunRashi = 0; sunRashi < 12; sunRashi++) {
        const sunLon = sunRashi * 30 + 15;
        const moonLon = sunLon + 60; // Shukla Paksha
        const result = computeChandraMasa(sunLon, moonLon, nameResolver);
        indices.add(result.index);
      }
      expect(indices.size).toBe(12);
    });
  });
});
