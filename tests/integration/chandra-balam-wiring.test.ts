/**
 * Integration tests — Chandra Balam wired into getDailyPanchang / getInstantPanchang
 * via the opt-in `janmaRashi` option.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const NOON_2025_01_14 = new Date(Date.UTC(2025, 0, 14, 12, 0, 0, 0));

describe('Chandra Balam wiring — daily panchang', () => {
  it('publishes chandraBalam as null when janmaRashi is not provided', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 })!;
    expect(r.chandraBalam).toBeNull();
  });

  it('includes chandraBalam when janmaRashi is provided', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330, janmaRashi: 0 })!;
    expect(r.chandraBalam).toBeDefined();
    expect(r.chandraBalam!.house).toBeGreaterThanOrEqual(1);
    expect(r.chandraBalam!.house).toBeLessThanOrEqual(12);
    expect(['strong', 'weak']).toContain(r.chandraBalam!.quality);
  });

  it('chandraBalam house matches (chandraRashi - janmaRashi) offset', () => {
    const janma = 3; // Karka
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330, janmaRashi: janma })!;
    const expectedHouse = ((r.moon.rashi.index - janma + 12) % 12) + 1;
    expect(r.chandraBalam!.house).toBe(expectedHouse);
  });

  it('localizes name when language is set to hi', () => {
    const r = getDailyPanchang(
      NOON_2025_01_14, DELHI,
      { timezone: 330, janmaRashi: 0, language: 'hi' },
    )!;
    expect(['शुभ', 'अशुभ']).toContain(r.chandraBalam!.name);
  });

  it('propagates RangeError for invalid janmaRashi', () => {
    expect(() =>
      getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330, janmaRashi: 12 }),
    ).toThrow(RangeError);
  });
});

describe('Chandra Balam wiring — instant panchang', () => {
  it('publishes chandraBalam as null when janmaRashi is not provided', () => {
    const r = getInstantPanchang(NOON_2025_01_14, DELHI)!;
    expect(r.chandraBalam).toBeNull();
  });

  it('includes chandraBalam when janmaRashi is provided', () => {
    const r = getInstantPanchang(NOON_2025_01_14, DELHI, { janmaRashi: 5 })!;
    expect(r.chandraBalam).toBeDefined();
    expect(r.chandraBalam!.englishName).toMatch(/^(Shubha|Ashubha)$/);
  });

  it('house matches offset from chandraRashi', () => {
    const janma = 9; // Makara
    const r = getInstantPanchang(NOON_2025_01_14, DELHI, { janmaRashi: janma })!;
    const expectedHouse = ((r.moon.rashi.index - janma + 12) % 12) + 1;
    expect(r.chandraBalam!.house).toBe(expectedHouse);
  });
});
