import { describe, it, expect } from 'vitest';
import { computeSpecialYogas } from '../../src/core/specialYogas';

const resolver = (type: string) => type;

// Helper — calls computeSpecialYogas with a sun-nakshatra equal to the
// moon-nakshatra so the new Aadal/Vidaal/Ravi distance-based yogas are
// guaranteed not to fire (distance = 1, which is in none of those sets).
// The legacy yogas (Amrit Siddhi, Sarvartha Siddhi, Ravi/Guru Pushya) are
// independent of the Sun's nakshatra, so this lets the existing fixtures
// continue to test exactly what they intended to test.
const callLegacy = (vara: number, tithi: number, nak: number) =>
  computeSpecialYogas(vara, tithi, nak, nak, resolver);

describe('computeSpecialYogas', () => {
  describe('Amrit Siddhi Yoga', () => {
    it('detects Sunday + Shukla Pratipada (tithi 0, number 1)', () => {
      const yogas = callLegacy(0, 0, 10);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('detects Sunday + Shukla Chaturthi (tithi 3, number 4)', () => {
      const yogas = callLegacy(0, 3, 10);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('detects Wednesday + Purnima (tithi 14, number 15)', () => {
      const yogas = callLegacy(3, 14, 10);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('detects Wednesday + Amavasya (tithi 29, number 15)', () => {
      const yogas = callLegacy(3, 29, 10);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('applies to both pakshas — Monday + Krishna Dwitiya (tithi 16, number 2)', () => {
      const yogas = callLegacy(1, 16, 10);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(true);
    });

    it('does not detect for non-matching combination', () => {
      // Sunday + Dwitiya (tithi 1, number 2) — not in Sunday's set
      const yogas = callLegacy(0, 1, 10);
      expect(yogas.some(y => y.type === 'amrit_siddhi')).toBe(false);
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
      // Sunday + Ashwini (0) — not in Sunday's set
      const yogas = callLegacy(0, 5, 0);
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
    // Sunday + Pushya(7): Ravi Pushya + Sarvartha Siddhi (Sunday has Pushya)
    // + Amrit Siddhi if tithi matches (use tithi 0 = Pratipada, number 1 for Sunday)
    const yogas = callLegacy(0, 0, 7);
    expect(yogas.length).toBeGreaterThanOrEqual(2);
    const types = yogas.map(y => y.type);
    expect(types).toContain('ravi_pushya');
    expect(types).toContain('sarvartha_siddhi');
    expect(types).toContain('amrit_siddhi');
  });

  it('returns empty array when no yoga matches', () => {
    // Monday + tithi 2 (Tritiya, number 3) + Ashwini(0), sun=Ashwini(0)
    // Monday Amrit: 2,7,12 — number 3 not included
    // Monday Sarvartha: 3,4,7,12,16,21 — 0 not included
    // distance27 = distance28 = 1 — not in Aadal/Vidaal/Ravi
    const yogas = callLegacy(1, 2, 0);
    expect(yogas).toEqual([]);
  });

  it('uses name resolver for translated names', () => {
    const customResolver = (type: string) => `translated_${type}`;
    const yogas = computeSpecialYogas(0, 0, 7, 7, customResolver);
    expect(yogas[0]!.name).toBe('translated_amrit_siddhi');
  });
});
