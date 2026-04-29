/**
 * Integration tests — Anandadi Yoga wired into getDailyPanchang and
 * getInstantPanchang as the non-optional `anandadiYoga: AnandadiYogaInfo`
 * field. Includes a 28-day Delhi sweep and DrikPanchang cross-checks.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';
import { ANANDADI_TABLE, NAKSHATRA_SPAN } from '../../src/utils/constants';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const NOON_2026_01_14 = new Date(Date.UTC(2026, 0, 14, 12, 0, 0, 0));

describe('Anandadi Yoga wiring — daily panchang', () => {
  it('field is always present with valid index/name/quality', () => {
    const r = getDailyPanchang(NOON_2026_01_14, DELHI, { timezone: 330 });
    expect(r).not.toBeNull();
    expect(r!.anandadiYoga).toBeDefined();
    expect(typeof r!.anandadiYoga.index).toBe('number');
    expect(r!.anandadiYoga.index).toBeGreaterThanOrEqual(0);
    expect(r!.anandadiYoga.index).toBeLessThanOrEqual(27);
    expect(typeof r!.anandadiYoga.name).toBe('string');
    expect(r!.anandadiYoga.name.length).toBeGreaterThan(0);
    expect(['auspicious', 'inauspicious', 'neutral']).toContain(r!.anandadiYoga.quality);
  });

  it('a 28-day Delhi sweep samples at least 6 distinct anandadi yogas', () => {
    const seen = new Set<number>();
    for (let day = 0; day < 28; day++) {
      const date = new Date(NOON_2026_01_14.getTime() + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      if (r) seen.add(r.anandadiYoga.index);
    }
    // The cycle has 28 yogas; a 28-day sweep across 7 weekdays × variable
    // nakshatra shifts samples broadly. 6 distinct yogas is a comfortable
    // floor — typical sweeps see 15+.
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it('localizes name in Devanagari when language is hi', () => {
    const r = getDailyPanchang(NOON_2026_01_14, DELHI, { timezone: 330, language: 'hi' });
    expect(r).not.toBeNull();
    // Devanagari range U+0900–U+097F.
    expect(r!.anandadiYoga.name).toMatch(/[ऀ-ॿ]/);
  });
});

describe('Anandadi Yoga wiring — instant panchang', () => {
  it('field is always present with valid index/name/quality', () => {
    const r = getInstantPanchang(NOON_2026_01_14, DELHI);
    expect(r).not.toBeNull();
    expect(r!.anandadiYoga).toBeDefined();
    expect(r!.anandadiYoga.index).toBeGreaterThanOrEqual(0);
    expect(r!.anandadiYoga.index).toBeLessThanOrEqual(27);
    expect(['auspicious', 'inauspicious', 'neutral']).toContain(r!.anandadiYoga.quality);
  });

  it('localizes name in Devanagari when language is hi', () => {
    const r = getInstantPanchang(NOON_2026_01_14, DELHI, { language: 'hi' });
    expect(r).not.toBeNull();
    expect(r!.anandadiYoga.name).toMatch(/[ऀ-ॿ]/);
  });
});

describe('Anandadi Yoga wiring — DrikPanchang cross-check (Delhi)', () => {
  // Each fixture below was verified against the Anandadi Yoga value published
  // on drikpanchang.com's daily panchang for Delhi at the given date. The
  // expected name/quality is what DrikPanchang lists for the yoga active at
  // sunrise. Source URLs:
  //   https://www.drikpanchang.com/panchang/day-panchang.html?geoname-id=1273294&date=DD/MM/YYYY
  const DELHI_FIXTURES: Array<{
    label: string;
    date: Date;
    yoga: string;
    quality: 'auspicious' | 'inauspicious';
  }> = [
    {
      label: '2026-01-01 Thursday × Rohini → Utpaata (inauspicious)',
      date: new Date(Date.UTC(2026, 0, 1, 6, 0, 0)),
      yoga: 'Utpaata',
      quality: 'inauspicious',
    },
    {
      label: '2026-03-20 Friday × Revati → Shrivatsa (auspicious)',
      date: new Date(Date.UTC(2026, 2, 20, 6, 0, 0)),
      yoga: 'Shrivatsa',
      quality: 'auspicious',
    },
    {
      label: '2026-04-14 Tuesday × Shatabhisha → Mrityu (inauspicious)',
      date: new Date(Date.UTC(2026, 3, 14, 6, 0, 0)),
      yoga: 'Mrityu',
      quality: 'inauspicious',
    },
    {
      label: '2026-04-15 Wednesday × Purva Bhadrapada → Padma (auspicious)',
      date: new Date(Date.UTC(2026, 3, 15, 6, 0, 0)),
      yoga: 'Padma',
      quality: 'auspicious',
    },
  ];

  for (const f of DELHI_FIXTURES) {
    it(f.label, () => {
      const r = getDailyPanchang(f.date, DELHI, { timezone: 330 });
      expect(r).not.toBeNull();
      expect(r!.anandadiYoga.name).toBe(f.yoga);
      expect(r!.anandadiYoga.quality).toBe(f.quality);
    });
  }
});

describe('Anandadi Yoga wiring — all 7 varas covered', () => {
  // The DrikPanchang fixture set above happens to only sample varas 2–5; that
  // leaves Sun/Mon/Sat untested. A 14-day Delhi sweep covers every weekday
  // twice. For each day we re-derive the expected yoga from ANANDADI_TABLE
  // using the (vara, sunrise-nakshatra) pair the panchang itself reports —
  // which catches any wiring drift between `getDailyPanchang` and
  // `computeAnandadiYoga` even though it doesn't pin values against an
  // external oracle.
  it('every vara 0..6 produces the table value for its sunrise-nakshatra', () => {
    const seenVaras = new Set<number>();
    for (let day = 0; day < 14; day++) {
      const date = new Date(NOON_2026_01_14.getTime() + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      if (!r) continue;
      const nakshatraIndex = Math.floor(r.siderealMoonAtSunrise / NAKSHATRA_SPAN);
      const expected = ANANDADI_TABLE[r.vara.index]![nakshatraIndex]!;
      expect(r.anandadiYoga.index).toBe(expected);
      seenVaras.add(r.vara.index);
    }
    expect(seenVaras).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
  });
});
