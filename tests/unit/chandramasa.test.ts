/**
 * Unit tests for Chandra Masa (lunar month) computation.
 *
 * 12 months: Chaitra(0) through Phalguna(11).
 * Default system is Purnimanta (North Indian); Amanta (South Indian) available.
 * Adhika (intercalary/leap) months occur when two consecutive
 * Amavasyas fall in the same solar month.
 *
 * The masa identity (index + Adhika status) is derived from the *actual* new
 * moons bounding the reference instant and the sidereal Sun rashi at each.
 * These logic tests supply a constant `getSiderealSun` stub so the
 * elongation/paksha/index behaviour is isolated from the live ephemeris; a
 * constant stub places both bounding Amavasyas in the same solar month, so the
 * `amantaIndex` equals `floor(stubLon / 30) + 1`. (Real-date / real-ephemeris
 * Adhika regression — e.g. Adhik Jyeshtha 2026 — lives in the panchang tests.)
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

// Any valid in-range instant; boundingNewMoons runs on it, but the stubs below
// map the returned new-moon instants to controlled sidereal-Sun longitudes.
const REF = new Date('2026-01-15T12:00:00Z');

// Constant stub: both bounding Amavasyas share one solar month → Adhika.
const sunStub = (lon: number) => () => lon;

// Sequential stub: the prev/next Amavasyas (queried in that order by
// computeChandraMasa) land one rashi apart → a normal (non-Adhika) month.
const sunStubNormal = (lon: number) => {
  let call = 0;
  return () => lon + (call++ === 0 ? 0 : 30);
};

describe('computeChandraMasa', () => {
  it('defaults to purnimanta system', () => {
    const result = computeChandraMasa(270, 100, nameResolver, undefined, REF, sunStub(270));
    expect(result.system).toBe('purnimanta');
  });

  it('returns a valid masa index (0-11)', () => {
    const result = computeChandraMasa(270, 100, nameResolver, undefined, REF, sunStub(270));
    expect(result.index).toBeGreaterThanOrEqual(0);
    expect(result.index).toBeLessThanOrEqual(11);
  });

  it('name includes the correct month name', () => {
    const result = computeChandraMasa(270, 100, nameResolver, undefined, REF, sunStub(270));
    expect(MASA_NAMES).toContain(result.name.replace('Adhika ', ''));
  });

  it('isAdhika is a boolean', () => {
    const result = computeChandraMasa(270, 100, nameResolver, undefined, REF, sunStub(270));
    expect(typeof result.isAdhika).toBe('boolean');
  });

  it('provides both amanta and purnimanta fields', () => {
    const result = computeChandraMasa(270, 100, nameResolver, undefined, REF, sunStub(270));
    expect(result.amantaIndex).toBeGreaterThanOrEqual(0);
    expect(result.amantaIndex).toBeLessThanOrEqual(11);
    expect(result.purnimantaIndex).toBeGreaterThanOrEqual(0);
    expect(result.purnimantaIndex).toBeLessThanOrEqual(11);
    expect(MASA_NAMES).toContain(result.amantaName.replace('Adhika ', ''));
    expect(MASA_NAMES).toContain(result.purnimantaName.replace('Adhika ', ''));
  });

  describe('purnimanta vs amanta system', () => {
    it('in Shukla Paksha, both systems agree', () => {
      // Moon 60° ahead of Sun → elongation 60° → Shukla Paksha
      const sunLon = 15;
      const moonLon = sunLon + 60;
      const purnimanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'purnimanta', REF, sunStubNormal(sunLon));
      const amanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'amanta', REF, sunStubNormal(sunLon));
      expect(purnimanta.index).toBe(amanta.index);
      expect(purnimanta.name).toBe(amanta.name);
    });

    it('in a normal Krishna Paksha, purnimanta is one month ahead of amanta', () => {
      // Moon 200° ahead of Sun → elongation 200° → Krishna Paksha.
      // sunStubNormal → bounding Amavasyas a rashi apart → a normal (non-Adhika)
      // month, where the Purnimanta name advances across the Purnima.
      const sunLon = 15;
      const moonLon = (sunLon + 200) % 360;
      const purnimanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'purnimanta', REF, sunStubNormal(sunLon));
      const amanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'amanta', REF, sunStubNormal(sunLon));
      expect(purnimanta.index).toBe((amanta.index + 1) % 12);
      expect(purnimanta.amantaIndex).toBe(amanta.index);
      expect(amanta.purnimantaIndex).toBe(purnimanta.index);
    });

    it('in an Adhika Krishna Paksha, purnimanta does NOT advance and carries the Adhika prefix', () => {
      // Adhika months have no Sankranti, so the Purnimanta name neither advances
      // across the Adhika Purnima nor drops the Adhika flag. (Drik Panchang:
      // Adhika Jyeshtha 2026 stays "Adhika Jyeshtha" in both systems / pakshas
      // rather than rolling forward to Ashadha in its Krishna Paksha.)
      const sunLon = 15;
      const moonLon = (sunLon + 200) % 360; // Krishna Paksha
      const purnimanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'purnimanta', REF, sunStub(sunLon));
      const amanta = computeChandraMasa(sunLon, moonLon, nameResolver, 'amanta', REF, sunStub(sunLon));
      expect(purnimanta.isAdhika).toBe(true);
      expect(purnimanta.purnimantaIndex).toBe(purnimanta.amantaIndex);
      expect(purnimanta.purnimantaName).toBe(purnimanta.amantaName);
      expect(purnimanta.purnimantaName.startsWith('Adhika ')).toBe(true);
    });

    it('amanta system sets index/name to amanta values', () => {
      const result = computeChandraMasa(270, 100, nameResolver, 'amanta', REF, sunStub(270));
      expect(result.system).toBe('amanta');
      expect(result.index).toBe(result.amantaIndex);
      expect(result.name).toBe(result.amantaName);
    });

    it('purnimanta system sets index/name to purnimanta values', () => {
      const result = computeChandraMasa(270, 100, nameResolver, 'purnimanta', REF, sunStub(270));
      expect(result.system).toBe('purnimanta');
      expect(result.index).toBe(result.purnimantaIndex);
      expect(result.name).toBe(result.purnimantaName);
    });
  });

  describe('month varies with the new-moon Sun position', () => {
    const sunPositions = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];
    const moonLon = 100;

    it('different new-moon sun positions produce different masa indices', () => {
      const indices = new Set<number>();
      for (const sunLon of sunPositions) {
        const result = computeChandraMasa(sunLon, moonLon, nameResolver, undefined, REF, sunStub(sunLon));
        indices.add(result.amantaIndex);
      }
      expect(indices.size).toBeGreaterThan(1);
    });
  });

  describe('all 12 months can be produced', () => {
    it('sweeping the new-moon Sun through 12 rashis yields distinct months', () => {
      const indices = new Set<number>();
      for (let sunRashi = 0; sunRashi < 12; sunRashi++) {
        const sunLon = sunRashi * 30 + 15;
        const moonLon = sunLon + 60; // Shukla Paksha
        const result = computeChandraMasa(sunLon, moonLon, nameResolver, undefined, REF, sunStub(sunLon));
        indices.add(result.index);
      }
      expect(indices.size).toBe(12);
    });
  });
});
