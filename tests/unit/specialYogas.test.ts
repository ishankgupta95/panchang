import { describe, it, expect } from 'vitest';
import { computeSpecialYogas } from '../../src/core/specialYogas';

const resolver = (type: string) => type;

describe('computeSpecialYogas', () => {
  describe('Amrit Siddhi Yoga', () => {
    it('detects Sunday + Shukla Pratipad (tithi 0, number 1)', () => {
      const yogas = computeSpecialYogas(0, 0, 10, resolver);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('detects Sunday + Shukla Chaturthi (tithi 3, number 4)', () => {
      const yogas = computeSpecialYogas(0, 3, 10, resolver);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('detects Wednesday + Purnima (tithi 14, number 15)', () => {
      const yogas = computeSpecialYogas(3, 14, 10, resolver);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('detects Wednesday + Amavasya (tithi 29, number 15)', () => {
      const yogas = computeSpecialYogas(3, 29, 10, resolver);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('applies to both pakshas — Monday + Krishna Dwitiya (tithi 16, number 2)', () => {
      const yogas = computeSpecialYogas(1, 16, 10, resolver);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('does not detect for non-matching combination', () => {
      // Sunday + Dwitiya (tithi 1, number 2) — not in Sunday's set
      const yogas = computeSpecialYogas(0, 1, 10, resolver);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(false);
    });
  });

  describe('Sarvartha Siddhi Yoga', () => {
    it('detects Sunday + Pushya (nakshatra 7)', () => {
      const yogas = computeSpecialYogas(0, 5, 7, resolver);
      expect(yogas.some(y => y.type === 'sarvartha_siddhi')).toBe(true);
    });

    it('detects Thursday + Revati (nakshatra 26)', () => {
      const yogas = computeSpecialYogas(4, 5, 26, resolver);
      expect(yogas.some(y => y.type === 'sarvartha_siddhi')).toBe(true);
    });

    it('does not detect for non-matching combination', () => {
      // Sunday + Ashwini (0) — not in Sunday's set
      const yogas = computeSpecialYogas(0, 5, 0, resolver);
      expect(yogas.some(y => y.type === 'sarvartha_siddhi')).toBe(false);
    });
  });

  describe('Ravi Pushya Yoga', () => {
    it('detects Sunday + Pushya', () => {
      const yogas = computeSpecialYogas(0, 5, 7, resolver);
      expect(yogas.some(y => y.type === 'ravi_pushya')).toBe(true);
    });

    it('does not detect on Monday + Pushya', () => {
      const yogas = computeSpecialYogas(1, 5, 7, resolver);
      expect(yogas.some(y => y.type === 'ravi_pushya')).toBe(false);
    });
  });

  describe('Guru Pushya Yoga', () => {
    it('detects Thursday + Pushya', () => {
      const yogas = computeSpecialYogas(4, 5, 7, resolver);
      expect(yogas.some(y => y.type === 'guru_pushya')).toBe(true);
    });

    it('does not detect on Friday + Pushya', () => {
      const yogas = computeSpecialYogas(5, 5, 7, resolver);
      expect(yogas.some(y => y.type === 'guru_pushya')).toBe(false);
    });
  });

  it('can return multiple yogas simultaneously', () => {
    // Sunday + Pushya(7): Ravi Pushya + Sarvartha Siddhi (Sunday has Pushya)
    // + Amrit Siddhi if tithi matches (use tithi 0 = Pratipad, number 1 for Sunday)
    const yogas = computeSpecialYogas(0, 0, 7, resolver);
    expect(yogas.length).toBeGreaterThanOrEqual(2);
    const types = yogas.map(y => y.type);
    expect(types).toContain('ravi_pushya');
    expect(types).toContain('sarvartha_siddhi');
    expect(types).toContain('amrit_siddhi');
  });

  it('returns empty array when no yoga matches', () => {
    // Monday + tithi 2 (Tritiya, number 3) + Ashwini(0)
    // Monday Amrit: 2,7,12 — number 3 not included
    // Monday Sarvartha: 3,4,7,12,16,21 — 0 not included
    const yogas = computeSpecialYogas(1, 2, 0, resolver);
    expect(yogas).toEqual([]);
  });

  it('uses name resolver for translated names', () => {
    const customResolver = (type: string) => `translated_${type}`;
    const yogas = computeSpecialYogas(0, 0, 7, customResolver);
    expect(yogas[0]!.name).toBe('translated_amrit_siddhi');
  });
});
