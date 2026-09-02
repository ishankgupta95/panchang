import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';
import { ANANDADI_TABLE, NAKSHATRA_SPAN } from '../../src/utils/constants';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const NOON_2026_01_14 = new Date(Date.UTC(2026, 0, 14, 12, 0, 0, 0));

describe('Anandadi Yoga wiring: daily panchang', () => {
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
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it('localizes name in Devanagari when language is hi', () => {
    const r = getDailyPanchang(NOON_2026_01_14, DELHI, { timezone: 330, language: 'hi' });
    expect(r).not.toBeNull();
    expect(r!.anandadiYoga.name).toMatch(/[ऀ-ॿ]/);
  });
});

describe('Anandadi Yoga wiring: instant panchang', () => {
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

describe('Anandadi Yoga wiring: reference-almanac cross-check (Delhi)', () => {
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

describe('Anandadi Yoga wiring: all 7 varas covered', () => {
  it('every vara 0..6 produces the table value for its sunrise-nakshatra', () => {
    const seenVaras = new Set<number>();
    for (let day = 0; day < 14; day++) {
      const date = new Date(NOON_2026_01_14.getTime() + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      if (!r) continue;
      const nakshatraIndex = Math.floor(r.moon.siderealLongitude / NAKSHATRA_SPAN);
      const expected = ANANDADI_TABLE[r.angas.vara.index]![nakshatraIndex]!;
      expect(r.anandadiYoga.index).toBe(expected);
      seenVaras.add(r.angas.vara.index);
    }
    expect(seenVaras).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
  });
});
