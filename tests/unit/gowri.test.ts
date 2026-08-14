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

  describe('full weekday grid matches the drik-published Pambu table', () => {
    // Transcribed from DrikPanchang's Gowri Panchangam (Chennai) and verified
    // to reproduce identically across two separate weeks (2026-08-13…19 and
    // 2026-08-22…28) — the grid is keyed only on weekday. Drik-name mapping:
    // Uthi→Udyog, Amirdha→Amrit, Rogam→Roga, Laabam→Laabh, Sugam→Shubh,
    // Visham→Kaal, Dhanam→Dhan, Soram→Chal.
    const DAY_GRID = [
      ['Udyog', 'Amrit', 'Roga', 'Laabh', 'Dhan', 'Shubh', 'Chal', 'Kaal'],   // Sun
      ['Amrit', 'Kaal', 'Roga', 'Laabh', 'Dhan', 'Shubh', 'Chal', 'Udyog'],   // Mon
      ['Roga', 'Laabh', 'Dhan', 'Shubh', 'Chal', 'Udyog', 'Kaal', 'Amrit'],   // Tue
      ['Laabh', 'Dhan', 'Shubh', 'Chal', 'Kaal', 'Udyog', 'Amrit', 'Roga'],   // Wed
      ['Dhan', 'Shubh', 'Chal', 'Udyog', 'Amrit', 'Kaal', 'Roga', 'Laabh'],   // Thu
      ['Shubh', 'Chal', 'Udyog', 'Kaal', 'Amrit', 'Roga', 'Laabh', 'Dhan'],   // Fri
      ['Chal', 'Udyog', 'Kaal', 'Amrit', 'Roga', 'Laabh', 'Dhan', 'Shubh'],   // Sat
    ];
    const NIGHT_GRID = [
      ['Dhan', 'Shubh', 'Chal', 'Kaal', 'Udyog', 'Amrit', 'Roga', 'Laabh'],   // Sun
      ['Shubh', 'Chal', 'Udyog', 'Amrit', 'Kaal', 'Roga', 'Laabh', 'Dhan'],   // Mon
      ['Chal', 'Udyog', 'Kaal', 'Amrit', 'Roga', 'Laabh', 'Dhan', 'Shubh'],   // Tue
      ['Udyog', 'Amrit', 'Roga', 'Laabh', 'Dhan', 'Shubh', 'Chal', 'Kaal'],   // Wed
      ['Amrit', 'Kaal', 'Roga', 'Laabh', 'Dhan', 'Shubh', 'Chal', 'Udyog'],   // Thu
      ['Roga', 'Laabh', 'Dhan', 'Shubh', 'Chal', 'Udyog', 'Kaal', 'Amrit'],   // Fri
      // Saturday night carries Chal twice and no Roga — the columns are NOT
      // permutations, which is why a rotation model cannot express this table.
      ['Laabh', 'Dhan', 'Shubh', 'Chal', 'Udyog', 'Kaal', 'Amrit', 'Chal'],   // Sat
    ];
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let vara = 0; vara < 7; vara++) {
      it(`${WEEKDAYS[vara]}: day + night slot names match the drik grid`, () => {
        const g = computeGowriPanchangam(sunrise, sunset, nextSunrise, vara, nameFn, qualityNameFn);
        expect(g.day.map((s) => s.name)).toEqual(DAY_GRID[vara]);
        expect(g.night.map((s) => s.name)).toEqual(NIGHT_GRID[vara]);
      });
    }
  });

  describe('quality mapping', () => {
    // Drik/Pambu split: 5 auspicious (Uthi/Udyog, Amirdha, Laabam, Sugam,
    // Dhanam), 3 inauspicious (Rogam, Visham/Kaal, Soram/Chal), no neutrals.
    const QUALITY_MAP: Record<number, string> = {
      0: 'auspicious',   // Udyog  (Uthi — Good)
      1: 'auspicious',   // Amrit  (Amirdha — Best)
      2: 'inauspicious', // Roga   (Rogam — Evil)
      3: 'auspicious',   // Laabh  (Laabam — Gain)
      4: 'auspicious',   // Shubh  (Sugam — Good)
      5: 'inauspicious', // Kaal   (Visham — Bad)
      6: 'auspicious',   // Dhan   (Dhanam — Wealth)
      7: 'inauspicious', // Chal   (Soram — Bad)
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
});
