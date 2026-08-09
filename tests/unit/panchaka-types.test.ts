/**
 * Panchaka typing — the five named Panchakas and the un-afflicted case.
 *
 * Panchaka used to be reported as a bare boolean, which flattened a graded
 * classification: the tradition names five Panchakas and selects between them
 * by the weekday the spell *began* on. A spell begun on a Wednesday or
 * Thursday gets no named affliction at all, so treating every Panchaka day as
 * equally disqualifying rejected days the sources do not object to.
 *
 * The onset dependence is what makes this untestable as a pure day function:
 * two days with the same tithi, nakshatra and vara can carry different types.
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

describe('computePanchaka — span boundary', () => {
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
    // Moon at 330° now, moving 13.2°/day → crossed 300° about 2.27 days ago.
    const getMoon = moonAt(13.2, 330 - 13.2 * 0, epoch);
    const onset = findPanchakaOnset(new Date(epoch), getMoon);
    expect(onset).not.toBeNull();
    const daysAgo = (epoch - onset!.getTime()) / 86_400_000;
    expect(daysAgo).toBeCloseTo(30 / 13.2, 2);
    // The crossing instant itself sits on the boundary.
    expect(getMoon(onset!)).toBeCloseTo(300, 3);
  });

  it('returns null when Panchaka is not active', () => {
    const epoch = Date.UTC(2026, 0, 10);
    const getMoon = moonAt(13.2, 100, epoch); // 100° — nowhere near the span
    expect(findPanchakaOnset(new Date(epoch), getMoon)).toBeNull();
  });
});

describe('daily panchang — panchakaInfo', () => {
  /** Every Panchaka day of 2026 at Delhi, so spells are covered end to end. */
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

  /**
   * The whole point of onset-based typing: a spell keeps its type across its
   * four or five days, so consecutive Panchaka days must agree even though
   * their own varas differ.
   */
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
    // The Moon re-enters the span roughly every 27.3 days.
    expect(spellsSeen).toBeGreaterThanOrEqual(12);
  });

  /**
   * Every named type should turn up across a year — the Moon enters Panchaka
   * roughly every 27.3 days, so all seven onset weekdays get used.
   *
   * This is the shape a vara-derivation bug takes. While the onset's weekday
   * was resolved by searching sunrise from `onset − 12 h`, an evening onset
   * found the *following* sunrise and rolled the weekday back a day — which
   * biased the whole distribution and made **Mrityu (Saturday onset)
   * unreachable**: 2026 at Delhi reported zero of them, against five once the
   * search was corrected to the sunrise that opens the containing Hindu day.
   * A count-based assertion would not have caught that; a coverage one does.
   */
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

/**
 * Sarvartha Siddhi vs DrikPanchang, August 2026 (Mumbai).
 *
 * The table was corrected against this listing and the evaluation was changed
 * to scan the day's segments rather than its sunrise snapshot — three of these
 * eight occurrences qualify on a nakshatra that opens after sunrise, and were
 * invisible before. Pinning the full month guards both halves: a table
 * regression drops an occurrence, an evaluation regression drops exactly the
 * three late-opening ones (Aug 2, 4, 20).
 */
describe('Sarvartha Siddhi — DrikPanchang parity, August 2026 Mumbai', () => {
  const MUMBAI = { latitude: 19.0760, longitude: 72.8777 };
  /** drikpanchang.com/yoga/sarvarthasiddhi-yoga-date-time.html, scraped 2026-08-08. */
  const DRIK_DAYS = [2, 4, 8, 16, 20, 21, 23, 30];

  const emitted = (() => {
    const days: number[] = [];
    for (let day = 1; day <= 31; day++) {
      const p = getDailyPanchang(new Date(Date.UTC(2026, 7, day, 6, 0)), MUMBAI, { timezone: 330 });
      if (p?.specialYogas.some((y) => y.type === 'sarvartha_siddhi')) days.push(day);
    }
    return days;
  })();

  it('detects exactly the days drik lists — no misses, no false positives', () => {
    expect(emitted).toEqual(DRIK_DAYS);
  });

  it('includes the three occurrences whose nakshatra opens after sunrise', () => {
    for (const day of [2, 4, 20]) expect(emitted).toContain(day);
  });
});
