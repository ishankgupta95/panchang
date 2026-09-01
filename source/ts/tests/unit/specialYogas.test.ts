import { describe, it, expect } from 'vitest';
import { computeSpecialYogas } from '../../src/core/specialYogas';

const resolver = (type: string) => type;

const callLegacy = (vara: number, tithi: number, nak: number) =>
  computeSpecialYogas(vara, tithi, nak, nak, resolver);

describe('computeSpecialYogas', () => {
  describe('Amrit Siddhi Yoga', () => {
    it('detects Sunday + Hasta (nakshatra 12)', () => {
      expect(callLegacy(0, 5, 12).some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('detects Monday + Mrigashira (nakshatra 4)', () => {
      expect(callLegacy(1, 5, 4).some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('detects Thursday + Pushya (nakshatra 7)', () => {
      expect(callLegacy(4, 5, 7).some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('detects Saturday + Rohini (nakshatra 3)', () => {
      expect(callLegacy(6, 5, 3).some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('is independent of tithi (Monday + Mrigashira fires in any tithi)', () => {
      expect(callLegacy(1, 16, 4).some(y => y.type === 'amrit_siddhi')).toBe(true);
      expect(callLegacy(1, 2, 4).some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('does not detect for a non-matching weekday-nakshatra pair', () => {
      expect(callLegacy(0, 5, 3).some(y => y.type === 'amrit_siddhi')).toBe(false);
    });
  });

  describe('Sarvartha Siddhi Yoga', () => {
    it('detects Sunday + Pushya (nakshatra 7)', () => {
      const yogas = callLegacy(0, 5, 7);
      expect(yogas.some(y => y.type === 'sarvartha_siddhi')).toBe(true);
    });

    it('detects Thursday + Revati (nakshatra 26)', () => {
      const yogas = callLegacy(4, 5, 26);
      expect(yogas.some(y => y.type === 'sarvartha_siddhi')).toBe(true);
    });

    it('does not detect for non-matching combination', () => {
      const yogas = callLegacy(0, 5, 1);
      expect(yogas.some(y => y.type === 'sarvartha_siddhi')).toBe(false);
    });
  });

  describe('Ravi Pushya Yoga', () => {
    it('detects Sunday + Pushya', () => {
      const yogas = callLegacy(0, 5, 7);
      expect(yogas.some(y => y.type === 'ravi_pushya')).toBe(true);
    });

    it('does not detect on Monday + Pushya', () => {
      const yogas = callLegacy(1, 5, 7);
      expect(yogas.some(y => y.type === 'ravi_pushya')).toBe(false);
    });
  });

  describe('Guru Pushya Yoga', () => {
    it('detects Thursday + Pushya', () => {
      const yogas = callLegacy(4, 5, 7);
      expect(yogas.some(y => y.type === 'guru_pushya')).toBe(true);
    });

    it('does not detect on Friday + Pushya', () => {
      const yogas = callLegacy(5, 5, 7);
      expect(yogas.some(y => y.type === 'guru_pushya')).toBe(false);
    });
  });

  it('can return multiple yogas simultaneously', () => {
    const yogas = callLegacy(0, 5, 12);
    expect(yogas.length).toBeGreaterThanOrEqual(2);
    const types = yogas.map(y => y.type);
    expect(types).toContain('amrit_siddhi');
    expect(types).toContain('sarvartha_siddhi');
  });

  it('returns empty array when no yoga matches', () => {
    const yogas = callLegacy(1, 2, 0);
    expect(yogas).toEqual([]);
  });

  it('uses name resolver for translated names', () => {
    const customResolver = (type: string) => `translated_${type}`;
    const yogas = computeSpecialYogas(0, 0, 12, 12, customResolver);
    expect(yogas[0]!.name).toBe('translated_amrit_siddhi');
  });
});
