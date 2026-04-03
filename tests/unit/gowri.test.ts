import { describe, it, expect } from 'vitest';
import { computeGowriPanchangam } from '../../src/core/gowri';

// Known 12-hour day: sunrise 06:00 UTC, sunset 18:00 UTC
// Next sunrise 06:00 UTC next day (12-hour night)
const sunrise = new Date('2024-01-01T06:00:00Z');
const sunset  = new Date('2024-01-01T18:00:00Z');
const nextSunrise = new Date('2024-01-02T06:00:00Z');
const DAY_MS   = 12 * 3600_000;
const NIGHT_MS = 12 * 3600_000;
const SLOT_MS  = DAY_MS / 8; // 90 minutes per slot

// Gowri name map (index 0–7)
const NAMES = ['Udyog', 'Amrit', 'Roga', 'Laabh', 'Shubh', 'Kaal', 'Dhan', 'Chal'];
const nameFn = (i: number) => NAMES[i]!;
const qualityNameFn = (q: string) => q;

describe('computeGowriPanchangam', () => {
  describe('slot count and structure', () => {
    it('returns 8 day slots', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      expect(g.day).toHaveLength(8);
    });

    it('returns 8 night slots', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      expect(g.night).toHaveLength(8);
    });

    it('each slot has start, end, index, name, quality', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      for (const slot of [...g.day, ...g.night]) {
        expect(slot).toHaveProperty('start');
        expect(slot).toHaveProperty('end');
        expect(typeof slot.index).toBe('number');
        expect(typeof slot.name).toBe('string');
        expect(['auspicious', 'inauspicious', 'neutral']).toContain(slot.quality);
      }
    });
  });

  describe('day slots timing (Sunday, varaIndex=0)', () => {
    it('day slot 0 starts at sunrise', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      expect(g.day[0]!.start.getTime()).toBe(sunrise.getTime());
    });

    it('day slot 7 ends at sunset', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      expect(g.day[7]!.end.getTime()).toBe(sunset.getTime());
    });

    it('each day slot is exactly 1/8 of daytime', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      for (const slot of g.day) {
        const dur = slot.end.getTime() - slot.start.getTime();
        expect(dur).toBe(SLOT_MS);
      }
    });

    it('day slots are contiguous', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      for (let i = 1; i < 8; i++) {
        expect(g.day[i]!.start.getTime()).toBe(g.day[i - 1]!.end.getTime());
      }
    });
  });

  describe('night slots timing (Sunday, varaIndex=0)', () => {
    it('night slot 0 starts at sunset', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      expect(g.night[0]!.start.getTime()).toBe(sunset.getTime());
    });

    it('night slot 7 ends at next sunrise', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      expect(g.night[7]!.end.getTime()).toBe(nextSunrise.getTime());
    });

    it('each night slot is exactly 1/8 of nighttime', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      for (const slot of g.night) {
        const dur = slot.end.getTime() - slot.start.getTime();
        expect(dur).toBe(NIGHT_MS / 8);
      }
    });
  });

  describe('starting index by vara', () => {
    // Day start indices: [6, 5, 4, 3, 2, 1, 0] for Sun..Sat
    const dayStartIndices = [6, 5, 4, 3, 2, 1, 0];
    // Night start indices: [2, 1, 0, 7, 6, 5, 4] for Sun..Sat
    const nightStartIndices = [2, 1, 0, 7, 6, 5, 4];

    for (let vara = 0; vara < 7; vara++) {
      it(`Sunday (vara=${vara}): first day slot index = ${dayStartIndices[vara]}`, () => {
        const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, vara, nameFn, qualityNameFn);
        expect(g.day[0]!.index).toBe(dayStartIndices[vara]);
      });

      it(`Sunday (vara=${vara}): first night slot index = ${nightStartIndices[vara]}`, () => {
        const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, vara, nameFn, qualityNameFn);
        expect(g.night[0]!.index).toBe(nightStartIndices[vara]);
      });
    }
  });

  describe('slot index advances +1 mod 8', () => {
    it('day slots follow mod-8 cycle from starting index', () => {
      // Sunday: day start index = 6
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      for (let i = 0; i < 8; i++) {
        expect(g.day[i]!.index).toBe((6 + i) % 8);
      }
    });

    it('night slots follow mod-8 cycle from starting index', () => {
      // Sunday: night start index = 2
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      for (let i = 0; i < 8; i++) {
        expect(g.night[i]!.index).toBe((2 + i) % 8);
      }
    });
  });

  describe('quality mapping', () => {
    const QUALITY_MAP: Record<number, string> = {
      0: 'neutral',      // Udyog
      1: 'auspicious',   // Amrit
      2: 'inauspicious', // Roga
      3: 'auspicious',   // Laabh
      4: 'auspicious',   // Shubh
      5: 'inauspicious', // Kaal
      6: 'auspicious',   // Dhan
      7: 'neutral',      // Chal
    };

    it('day slots have correct quality for their index', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 1, nameFn, qualityNameFn);
      for (const slot of g.day) {
        expect(slot.quality).toBe(QUALITY_MAP[slot.index]);
      }
    });

    it('night slots have correct quality for their index', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 3, nameFn, qualityNameFn);
      for (const slot of g.night) {
        expect(slot.quality).toBe(QUALITY_MAP[slot.index]);
      }
    });
  });

  describe('name resolution via nameFn', () => {
    it('slot name matches nameFn(index)', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 0, nameFn, qualityNameFn);
      for (const slot of [...g.day, ...g.night]) {
        expect(slot.name).toBe(nameFn(slot.index));
      }
    });
  });

  describe('Saturday (varaIndex=6)', () => {
    // Day start index = 0 (Udyog), Night start index = 4 (Shubh)
    it('Saturday day starts at index 0 (Udyog)', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 6, nameFn, qualityNameFn);
      expect(g.day[0]!.index).toBe(0);
      expect(g.day[0]!.name).toBe('Udyog');
    });

    it('Saturday night starts at index 4 (Shubh)', () => {
      const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, 6, nameFn, qualityNameFn);
      expect(g.night[0]!.index).toBe(4);
      expect(g.night[0]!.name).toBe('Shubh');
    });
  });
});
