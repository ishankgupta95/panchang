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
    // Fixed weekday × Moon-nakshatra pairs (BPHS / DrikPanchang): Sun-Hasta(12),
    // Mon-Mrigashira(4), Tue-Ashwini(0), Wed-Anuradha(16), Thu-Pushya(7),
    // Fri-Revati(26), Sat-Rohini(3). Independent of tithi.
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
      // Sunday's pair is Hasta(12); Rohini(3) is Saturday's pair, not Sunday's
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
      // Sunday + Bharani (1) — not in Sunday's set.
      // This used to use Sunday + Ashwini, which stopped being a negative when
      // the table was rebuilt from DrikPanchang's 2026 windows: drik publishes
      // five Sun + Ashwini occurrences, so that cell is now a positive.
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
    // Sunday + Hasta(12): Amrit Siddhi (Sun-Hasta pair) + Sarvartha Siddhi
    // (Sunday's SSY set includes Hasta).
    const yogas = callLegacy(0, 5, 12);
    expect(yogas.length).toBeGreaterThanOrEqual(2);
    const types = yogas.map(y => y.type);
    expect(types).toContain('amrit_siddhi');
    expect(types).toContain('sarvartha_siddhi');
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
    // Sunday + Hasta(12) → Amrit Siddhi is the first yoga pushed.
    const yogas = computeSpecialYogas(0, 0, 12, 12, customResolver);
    expect(yogas[0]!.name).toBe('translated_amrit_siddhi');
  });
});
