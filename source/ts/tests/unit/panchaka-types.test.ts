/**
 * The five Panchakas are selected by the weekday the spell *began* on, Wednesday
 * and Thursday onsets carrying no named affliction, so two days with the same
 * tithi, nakshatra and vara can carry different types.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyPanchaka, isPanchakaDosha, computePanchaka, findPanchakaOnset,
  getDailyPanchang,
} from '../../src/index';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const TZ = 330;

describe('classifyPanchaka', () => {
  it.each([
    [0, 'roga'], [1, 'raja'], [2, 'agni'],
    [3, 'samanya'], [4, 'samanya'],
    [5, 'chora'], [6, 'mrityu'],
  ] as const)('vara %i → %s', (vara, type) => {
    expect(classifyPanchaka(vara)).toBe(type);
  });

  it('only Wednesday and Thursday onsets are free of dosha', () => {
    const free = [0, 1, 2, 3, 4, 5, 6].filter((v) => !isPanchakaDosha(classifyPanchaka(v)));
    expect(free).toEqual([3, 4]);
  });

  it('the five named types are all distinct', () => {
    const named = [0, 1, 2, 5, 6].map(classifyPanchaka);
    expect(new Set(named).size).toBe(5);
  });

  it.each([-1, 7, 1.5, NaN])('rejects vara index %s', (v) => {
    expect(() => classifyPanchaka(v as number)).toThrow();
  });
});

describe('computePanchaka: span boundary', () => {
  it('begins exactly at Dhanishtha 3rd pada (300°)', () => {
    expect(computePanchaka(299.999)).toBe(false);
    expect(computePanchaka(300)).toBe(true);
    expect(computePanchaka(359.999)).toBe(true);
    expect(computePanchaka(0)).toBe(false);
  });
});

describe('findPanchakaOnset', () => {
  const moonAt = (rateDegPerDay: number, startDeg: number, epochMs: number) =>
    (d: Date) => {
      const deg = startDeg + ((d.getTime() - epochMs) / 86_400_000) * rateDegPerDay;
      return ((deg % 360) + 360) % 360;
    };

  it('finds the 300° crossing', () => {
    const epoch = Date.UTC(2026, 0, 10);
    const getMoon = moonAt(13.2, 330 - 13.2 * 0, epoch);
    const onset = findPanchakaOnset(new Date(epoch), getMoon);
    expect(onset).not.toBeNull();
    const daysAgo = (epoch - onset!.getTime()) / 86_400_000;
    expect(daysAgo).toBeCloseTo(30 / 13.2, 2);
    expect(getMoon(onset!)).toBeCloseTo(300, 3);
  });

  it('returns null when Panchaka is not active', () => {
    const epoch = Date.UTC(2026, 0, 10);
    const getMoon = moonAt(13.2, 100, epoch);
    expect(findPanchakaOnset(new Date(epoch), getMoon)).toBeNull();
  });
});

describe('daily panchang: panchakaInfo', () => {
  const days = Array.from({ length: 365 }, (_, i) =>
    getDailyPanchang(new Date(Date.UTC(2026, 0, 1 + i)), DELHI, {
      timezone: TZ, computeEndTimes: false,
    }))
    .filter((p) => p !== null);

  it('agrees with the legacy boolean on every day of the year', () => {
    for (const p of days) {
      expect(p.inauspicious.panchakaInfo.active).toBe(p.inauspicious.panchaka);
    }
  });

  it('assigns a type and a localized name whenever active', () => {
    const active = days.filter((p) => p.inauspicious.panchakaInfo.active);
    expect(active.length).toBeGreaterThan(0);
    for (const p of active) {
      const pk = p.inauspicious.panchakaInfo;
      if (!pk.active) throw new Error('unreachable');
      expect(pk.name.length).toBeGreaterThan(0);
      expect(pk.isDosha).toBe(isPanchakaDosha(pk.type));
      expect(classifyPanchaka(pk.onsetVara)).toBe(pk.type);
    }
  });

  /** Consecutive Panchaka days must agree even though their own varas differ. */
  it('holds one type for the length of a spell', () => {
    let previous: { type: string; date: number } | null = null;
    let spellsSeen = 0;
    for (const p of days) {
      const pk = p.inauspicious.panchakaInfo;
      if (!pk.active) { previous = null; continue; }
      const today = p.date.getTime();
      if (previous && today - previous.date <= 2 * 86_400_000) {
        expect(pk.type).toBe(previous.type);
      } else {
        spellsSeen++;
      }
      previous = { type: pk.type, date: today };
    }
    expect(spellsSeen).toBeGreaterThanOrEqual(12);
  });

  it('produces every Panchaka type across a year, Mrityu included', () => {
    const seen = new Set(
      days.filter((p) => p.inauspicious.panchakaInfo.active)
        .map((p) => (p.inauspicious.panchakaInfo as { type: string }).type),
    );
    for (const type of ['roga', 'raja', 'agni', 'chora', 'mrityu', 'samanya']) {
      expect(seen, `missing ${type}`).toContain(type);
    }
  });

  it('finds both doshic and Samanya spells across a year', () => {
    const types = new Set(
      days.filter((p) => p.inauspicious.panchakaInfo.active)
        .map((p) => (p.inauspicious.panchakaInfo as { type: string }).type),
    );
    expect(types.size).toBeGreaterThan(1);
    expect([...types].some((t) => t === 'samanya')).toBe(true);
  });
});

describe('Sarvartha Siddhi: reference-almanac parity, August 2026 Mumbai', () => {
  const MUMBAI = { latitude: 19.0760, longitude: 72.8777 };
  /** The reference almanac's Sarvartha Siddhi Yoga date-time listing. */
  const ALMANAC_DAYS = [2, 4, 8, 16, 20, 21, 23, 30];

  const emitted = (() => {
    const days: number[] = [];
    for (let day = 1; day <= 31; day++) {
      const p = getDailyPanchang(new Date(Date.UTC(2026, 7, day, 6, 0)), MUMBAI, { timezone: 330 });
      if (p?.specialYogas.some((y) => y.type === 'sarvartha_siddhi')) days.push(day);
    }
    return days;
  })();

  it('detects exactly the days the almanac lists: no misses, no false positives', () => {
    expect(emitted).toEqual(ALMANAC_DAYS);
  });

  it('includes the three occurrences whose nakshatra opens after sunrise', () => {
    for (const day of [2, 4, 20]) expect(emitted).toContain(day);
  });
});
