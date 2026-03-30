import { describe, it, expect } from 'vitest';
import { computeFestivals } from '../../src/core/festivals';

const resolver = (key: string) => key;

describe('computeFestivals', () => {
  describe('major fixed festivals', () => {
    it('detects Diwali — Kartika (7), Amavasya (29)', () => {
      const result = computeFestivals(29, 10, 7, false, 3, 200, resolver);
      expect(result.some(f => f.name === 'diwali' && f.type === 'major')).toBe(true);
    });

    it('detects Maha Shivaratri — Magha (10), Krishna Chaturdashi (28)', () => {
      const result = computeFestivals(28, 10, 10, false, 3, 200, resolver);
      expect(result.some(f => f.name === 'maha_shivaratri')).toBe(true);
    });

    it('detects Rama Navami — Chaitra (0), Shukla Navami (8)', () => {
      const result = computeFestivals(8, 10, 0, false, 3, 200, resolver);
      expect(result.some(f => f.name === 'rama_navami')).toBe(true);
    });

    it('detects Holi — Phalguna (11), Purnima (14)', () => {
      const result = computeFestivals(14, 10, 11, false, 3, 200, resolver);
      expect(result.some(f => f.name === 'holi')).toBe(true);
    });

    it('detects Ganesh Chaturthi — Bhadrapada (5), Shukla Chaturthi (3)', () => {
      const result = computeFestivals(3, 10, 5, false, 3, 200, resolver);
      expect(result.some(f => f.name === 'ganesh_chaturthi')).toBe(true);
    });

    it('detects Dussehra — Ashwin (6), Shukla Dashami (9)', () => {
      const result = computeFestivals(9, 10, 6, false, 3, 200, resolver);
      expect(result.some(f => f.name === 'dussehra')).toBe(true);
    });

    it('detects Krishna Janmashtami — Shravana (4), Krishna Ashtami (22)', () => {
      const result = computeFestivals(22, 10, 4, false, 3, 200, resolver);
      expect(result.some(f => f.name === 'krishna_janmashtami')).toBe(true);
    });

    it('detects Ugadi — Chaitra (0), Shukla Pratipad (0)', () => {
      const result = computeFestivals(0, 10, 0, false, 3, 200, resolver);
      expect(result.some(f => f.name === 'ugadi')).toBe(true);
    });
  });

  describe('Adhika masa handling', () => {
    it('skips fixed festivals during Adhika month', () => {
      // Diwali conditions but Adhika month
      const result = computeFestivals(29, 10, 7, true, 3, 200, resolver);
      expect(result.some(f => f.name === 'diwali')).toBe(false);
    });

    it('still detects Ekadashi during Adhika month', () => {
      const result = computeFestivals(10, 10, 7, true, 3, 200, resolver);
      expect(result.some(f => f.type === 'ekadashi')).toBe(true);
    });
  });

  describe('Ekadashi', () => {
    it('detects Shukla Ekadashi (tithi 10)', () => {
      const result = computeFestivals(10, 10, 3, false, 3, 200, resolver);
      expect(result.some(f => f.type === 'ekadashi')).toBe(true);
    });

    it('detects Krishna Ekadashi (tithi 25)', () => {
      const result = computeFestivals(25, 10, 3, false, 3, 200, resolver);
      expect(result.some(f => f.type === 'ekadashi')).toBe(true);
    });

    it('does not detect Ekadashi on other tithis', () => {
      const result = computeFestivals(11, 10, 3, false, 3, 200, resolver);
      expect(result.some(f => f.type === 'ekadashi')).toBe(false);
    });
  });

  describe('Pradosha', () => {
    it('detects Pradosha on Krishna Trayodashi (tithi 27)', () => {
      const result = computeFestivals(27, 10, 3, false, 3, 200, resolver);
      expect(result.some(f => f.type === 'pradosha')).toBe(true);
    });

    it('does not detect Pradosha on Shukla Trayodashi (tithi 12)', () => {
      const result = computeFestivals(12, 10, 3, false, 3, 200, resolver);
      expect(result.some(f => f.type === 'pradosha')).toBe(false);
    });
  });

  describe('Sankranti', () => {
    it('detects Sankranti when Sun is just past a rashi boundary', () => {
      // siderealSun = 270.5 → 270.5 % 30 = 0.5 < 1.0 → Sankranti
      const result = computeFestivals(5, 10, 3, false, 3, 270.5, resolver);
      expect(result.some(f => f.type === 'sankranti')).toBe(true);
    });

    it('does not detect Sankranti when Sun is mid-rashi', () => {
      // siderealSun = 285.0 → 285 % 30 = 15 → not near boundary
      const result = computeFestivals(5, 10, 3, false, 3, 285.0, resolver);
      expect(result.some(f => f.type === 'sankranti')).toBe(false);
    });

    it('detects Makar Sankranti at ~270°', () => {
      const result = computeFestivals(5, 10, 3, false, 3, 270.3, resolver);
      const sankranti = result.find(f => f.type === 'sankranti');
      expect(sankranti).toBeDefined();
      expect(sankranti!.description).toBe('Rashi 9'); // Makara = index 9
    });
  });

  it('uses name resolver for translated names', () => {
    const customResolver = (key: string) => `translated_${key}`;
    const result = computeFestivals(29, 10, 7, false, 3, 200, customResolver);
    const diwali = result.find(f => f.name === 'translated_diwali');
    expect(diwali).toBeDefined();
  });

  it('returns empty array when nothing matches', () => {
    // Tithi 1 (Dwitiya), masa 2 (Jyeshtha), siderealSun mid-rashi
    const result = computeFestivals(1, 10, 2, false, 3, 200, resolver);
    expect(result).toEqual([]);
  });

  it('can return multiple festivals on the same day', () => {
    // Kartika(7) Krishna Trayodashi(27) = Dhanteras + Pradosha
    const result = computeFestivals(27, 10, 7, false, 3, 200, resolver);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some(f => f.name === 'dhanteras')).toBe(true);
    expect(result.some(f => f.type === 'pradosha')).toBe(true);
  });
});
