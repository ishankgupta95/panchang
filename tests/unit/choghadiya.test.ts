/**
 * Unit tests for Choghadiya computation.
 *
 * Choghadiya divides day and night into 8 equal slots each, cycling
 * through 7 names (Udveg, Char, Labh, Amrit, Kaal, Shubh, Rog).
 * Starting name depends on the vara (weekday).
 */

import { describe, it, expect } from 'vitest';
import { computeChoghadiya } from '../../src/core/choghadiya';

const nameResolver = (idx: number) =>
  ['Udveg', 'Char', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog'][idx]!;
const qualityNameResolver = (q: string) => q;

// Fixed sunrise/sunset for testability
const SUNRISE = new Date('2025-01-14T01:45:00Z'); // 07:15 IST
const SUNSET = new Date('2025-01-14T12:16:00Z');  // 17:46 IST
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
