import { describe, it, expect } from 'vitest';
import { computeChoghadiya } from '../../src/core/choghadiya';

const nameResolver = (idx: number) =>
  ['Udveg', 'Char', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog'][idx]!;
const qualityNameResolver = (q: string) => q;

const SUNRISE = new Date('2025-01-14T01:45:00Z');
const SUNSET = new Date('2025-01-14T12:16:00Z');
const NEXT_SUNRISE = new Date('2025-01-15T01:45:00Z');

describe('computeChoghadiya', () => {
  describe('structural checks', () => {
    for (let vara = 0; vara < 7; vara++) {
      const result = computeChoghadiya(SUNRISE, SUNSET, NEXT_SUNRISE, vara, nameResolver, qualityNameResolver);

      it(`vara ${vara}: returns 8 day + 8 night slots`, () => {
        expect(result.day).toHaveLength(8);
        expect(result.night).toHaveLength(8);
      });

      it(`vara ${vara}: day slots span sunrise to sunset`, () => {
        expect(result.day[0]!.start.getTime()).toBe(SUNRISE.getTime());
        expect(result.day[7]!.end.getTime()).toBe(SUNSET.getTime());
      });

      it(`vara ${vara}: night slots span sunset to next sunrise`, () => {
        expect(result.night[0]!.start.getTime()).toBe(SUNSET.getTime());
        expect(result.night[7]!.end.getTime()).toBe(NEXT_SUNRISE.getTime());
      });

      it(`vara ${vara}: day slots are contiguous`, () => {
        for (let i = 1; i < 8; i++) {
          expect(result.day[i]!.start.getTime()).toBe(result.day[i - 1]!.end.getTime());
        }
      });

      it(`vara ${vara}: night slots are contiguous`, () => {
        for (let i = 1; i < 8; i++) {
          expect(result.night[i]!.start.getTime()).toBe(result.night[i - 1]!.end.getTime());
        }
      });

      it(`vara ${vara}: each day slot has equal duration`, () => {
        const dayDuration = SUNSET.getTime() - SUNRISE.getTime();
        const expectedSlotMs = dayDuration / 8;
        for (const slot of result.day) {
          const slotMs = slot.end.getTime() - slot.start.getTime();
          expect(Math.abs(slotMs - expectedSlotMs)).toBeLessThan(2); // allow 1ms rounding
        }
      });

      it(`vara ${vara}: all slots have valid names`, () => {
        const validNames = ['Udveg', 'Char', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog'];
        for (const slot of [...result.day, ...result.night]) {
          expect(validNames).toContain(slot.name);
        }
      });

      it(`vara ${vara}: all slots have valid quality`, () => {
        const validQualities = ['auspicious', 'inauspicious', 'neutral'];
        for (const slot of [...result.day, ...result.night]) {
          expect(validQualities).toContain(slot.quality);
        }
      });
    }
  });

  describe('sequences match the reference almanac (14 nights, Bengaluru Feb-2027 + Ujjain Aug-2026)', () => {
    // Day follows the U→C→L→A→K→S→R succession from the weekday lord. Night has
    // its own U→S→A→C→R→K→L succession whose start advances +2 (mod 7) per
    // weekday, not the day one. Rows below are the almanac's, verbatim.
    const DAY_EXPECTED = [
      ['Udveg', 'Char', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg'],   // Sun
      ['Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg', 'Char', 'Labh', 'Amrit'],   // Mon
      ['Rog', 'Udveg', 'Char', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog'],     // Tue
      ['Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg', 'Char', 'Labh'],    // Wed
      ['Shubh', 'Rog', 'Udveg', 'Char', 'Labh', 'Amrit', 'Kaal', 'Shubh'],   // Thu
      ['Char', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg', 'Char'],    // Fri
      ['Kaal', 'Shubh', 'Rog', 'Udveg', 'Char', 'Labh', 'Amrit', 'Kaal'],    // Sat
    ];
    const NIGHT_EXPECTED = [
      ['Shubh', 'Amrit', 'Char', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh'],   // Sun
      ['Char', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Char'],    // Mon
      ['Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Char', 'Rog', 'Kaal'],    // Tue
      ['Udveg', 'Shubh', 'Amrit', 'Char', 'Rog', 'Kaal', 'Labh', 'Udveg'],   // Wed
      ['Amrit', 'Char', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit'],   // Thu
      ['Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Char', 'Rog'],     // Fri
      ['Labh', 'Udveg', 'Shubh', 'Amrit', 'Char', 'Rog', 'Kaal', 'Labh'],    // Sat
    ];
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let vara = 0; vara < 7; vara++) {
      it(`${WEEKDAYS[vara]}: day and night sequences match the almanac`, () => {
        const r = computeChoghadiya(SUNRISE, SUNSET, NEXT_SUNRISE, vara, nameResolver, qualityNameResolver);
        expect(r.day.map((s) => s.name)).toEqual(DAY_EXPECTED[vara]);
        expect(r.night.map((s) => s.name)).toEqual(NIGHT_EXPECTED[vara]);
      });
    }
  });

  describe('quality assignment', () => {
    const result = computeChoghadiya(SUNRISE, SUNSET, NEXT_SUNRISE, 0, nameResolver, qualityNameResolver);
    const allSlots = [...result.day, ...result.night];

    it('Amrit and Labh are auspicious', () => {
      for (const s of allSlots) {
        if (s.name === 'Amrit' || s.name === 'Labh') {
          expect(s.quality).toBe('auspicious');
        }
      }
    });

    it('Shubh is auspicious', () => {
      for (const s of allSlots) {
        if (s.name === 'Shubh') {
          expect(s.quality).toBe('auspicious');
        }
      }
    });

    it('Rog, Kaal, Udveg are inauspicious', () => {
      for (const s of allSlots) {
        if (s.name === 'Rog' || s.name === 'Kaal' || s.name === 'Udveg') {
          expect(s.quality).toBe('inauspicious');
        }
      }
    });

    it('Char is neutral', () => {
      for (const s of allSlots) {
        if (s.name === 'Char') {
          expect(s.quality).toBe('neutral');
        }
      }
    });
  });
});
