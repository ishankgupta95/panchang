import { describe, it, expect } from 'vitest';
import { computeHora } from '../../src/core/hora';

const nameResolver = (idx: number) =>
  ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'][idx]!;

const SUNRISE = new Date('2025-01-14T01:45:00Z');
const SUNSET = new Date('2025-01-14T12:16:00Z');
const NEXT_SUNRISE = new Date('2025-01-15T01:45:00Z');

describe('computeHora', () => {
  describe('structural checks for all varas', () => {
    for (let vara = 0; vara < 7; vara++) {
      const result = computeHora(SUNRISE, SUNSET, NEXT_SUNRISE, vara, nameResolver);

      it(`vara ${vara}: returns 12 day + 12 night horas`, () => {
        expect(result.day).toHaveLength(12);
        expect(result.night).toHaveLength(12);
      });

      it(`vara ${vara}: day horas span sunrise to sunset`, () => {
        expect(result.day[0]!.start.getTime()).toBe(SUNRISE.getTime());
        expect(result.day[11]!.end.getTime()).toBe(SUNSET.getTime());
      });

      it(`vara ${vara}: night horas span sunset to next sunrise`, () => {
        expect(result.night[0]!.start.getTime()).toBe(SUNSET.getTime());
        expect(result.night[11]!.end.getTime()).toBe(NEXT_SUNRISE.getTime());
      });

      it(`vara ${vara}: day horas are contiguous`, () => {
        for (let i = 1; i < 12; i++) {
          expect(result.day[i]!.start.getTime()).toBe(result.day[i - 1]!.end.getTime());
        }
      });

      it(`vara ${vara}: night horas are contiguous`, () => {
        for (let i = 1; i < 12; i++) {
          expect(result.night[i]!.start.getTime()).toBe(result.night[i - 1]!.end.getTime());
        }
      });

      it(`vara ${vara}: each day hora has equal duration`, () => {
        const dayMs = SUNSET.getTime() - SUNRISE.getTime();
        const expected = dayMs / 12;
        for (const h of result.day) {
          const dur = h.end.getTime() - h.start.getTime();
          expect(Math.abs(dur - expected)).toBeLessThan(2);
        }
      });

      it(`vara ${vara}: all horas have valid planet names`, () => {
        const validPlanets = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'];
        for (const h of [...result.day, ...result.night]) {
          expect(validPlanets).toContain(h.planet);
        }
      });

      it(`vara ${vara}: all planetIndex values in [0, 6]`, () => {
        for (const h of [...result.day, ...result.night]) {
          expect(h.planetIndex).toBeGreaterThanOrEqual(0);
          expect(h.planetIndex).toBeLessThanOrEqual(6);
        }
      });
    }
  });

  describe('first hora of the day is ruled by the day lord', () => {
    const dayLords = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

    for (let vara = 0; vara < 7; vara++) {
      it(`vara ${vara} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][vara]}): first hora = ${dayLords[vara]}`, () => {
        const result = computeHora(SUNRISE, SUNSET, NEXT_SUNRISE, vara, nameResolver);
        expect(result.day[0]!.planet).toBe(dayLords[vara]);
      });
    }
  });
});
