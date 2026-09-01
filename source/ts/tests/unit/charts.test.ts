import { describe, it, expect } from 'vitest';
import { computeRashiChart, computeNavamsa, _navamsaLongitudeForTest as navLon } from '../../src/jyotish/charts';
import { computeLagna } from '../../src/jyotish/lagna';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SAMPLE = new Date('1995-08-15T05:30:00Z');

describe('computeRashiChart (D1)', () => {
  it('returns 9 grahas in canonical order with houses 1..12', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    expect(chart.divisional).toBe('D1');
    expect(chart.planets).toHaveLength(9);
    const expected = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    expect(chart.planets.map((p) => p.planet)).toEqual(expected);
    chart.planets.forEach((p) => {
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
      expect(p.rashi.index).toBeGreaterThanOrEqual(0);
      expect(p.rashi.index).toBeLessThan(12);
      expect(p.degreeInRashi).toBeGreaterThanOrEqual(0);
      expect(p.degreeInRashi).toBeLessThan(30);
    });
  });

  it('lagna matches standalone computeLagna call', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const standalone = computeLagna(SAMPLE, DELHI);
    expect(chart.lagna.siderealLongitude).toBe(standalone.siderealLongitude);
    expect(chart.lagna.rashi.index).toBe(standalone.rashi.index);
  });

  it('Rahu and Ketu are exactly 180° apart', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const rahu = chart.planets.find((p) => p.planet === 'Rahu')!;
    const ketu = chart.planets.find((p) => p.planet === 'Ketu')!;
    let diff = Math.abs(rahu.longitude - ketu.longitude);
    if (diff > 180) diff = 360 - diff;
    expect(diff).toBeCloseTo(180, 6);
    const houseDiff = ((ketu.house - rahu.house + 12) % 12);
    expect(houseDiff).toBe(6);
  });

  it('Sun and Moon never retrograde (D1)', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    expect(chart.planets[0]!.isRetrograde).toBe(false);
    expect(chart.planets[1]!.isRetrograde).toBe(false);
  });

  it('whole-sign: all 9 planets land in the rashi-derived house', () => {
    const chart = computeRashiChart(SAMPLE, DELHI, { houseSystem: 'whole-sign' });
    const lagnaRashi = chart.lagna.rashi.index;
    chart.planets.forEach((p) => {
      const expectedHouse = ((p.rashi.index - lagnaRashi + 12) % 12) + 1;
      expect(p.house).toBe(expectedHouse);
    });
  });

  it('equal: planets land in the (longitude - lagna) / 30 house', () => {
    const chart = computeRashiChart(SAMPLE, DELHI, { houseSystem: 'equal' });
    chart.planets.forEach((p) => {
      const offset = ((p.longitude - chart.lagna.siderealLongitude + 360) % 360);
      const expectedHouse = Math.floor(offset / 30) + 1;
      expect(p.house).toBe(expectedHouse);
    });
  });

  it('placidus-kp: each planet is between its cusp and the next cusp', () => {
    const chart = computeRashiChart(SAMPLE, DELHI, { houseSystem: 'placidus-kp' });
    const cusps = chart.bhava.houses.map((h) => h.cuspLongitude);
    chart.planets.forEach((p) => {
      const start = cusps[p.house - 1]!;
      const end = cusps[p.house % 12]!;
      const inRange =
        start <= end ? p.longitude >= start && p.longitude < end
                     : p.longitude >= start || p.longitude < end;
      expect(inRange).toBe(true);
    });
  });
});

describe('computeNavamsa (D9): classical rule per rashi type', () => {
  it('Aries 0° → Aries 0°', () => {
    expect(Math.floor(navLon(0) / 30)).toBe(0);
  });
  it('Aries 13°20\' (start of nav 4) → Leo (4)', () => {
    expect(Math.floor(navLon(0 + (30 / 9) * 4) / 30)).toBe(4);
  });
  it('Cancer 0° → Cancer (3)', () => {
    expect(Math.floor(navLon(90) / 30)).toBe(3);
  });
  it('Libra 0° → Libra (6)', () => {
    expect(Math.floor(navLon(180) / 30)).toBe(6);
  });
  it('Capricorn 0° → Capricorn (9)', () => {
    expect(Math.floor(navLon(270) / 30)).toBe(9);
  });

  it('Taurus 0° → Capricorn (9)', () => {
    expect(Math.floor(navLon(30) / 30)).toBe(9);
  });
  it('Leo 0° → Aries (0)', () => {
    expect(Math.floor(navLon(120) / 30)).toBe(0);
  });
  it('Scorpio 0° → Cancer (3)', () => {
    expect(Math.floor(navLon(210) / 30)).toBe(3);
  });
  it('Aquarius 0° → Libra (6)', () => {
    expect(Math.floor(navLon(300) / 30)).toBe(6);
  });

  it('Gemini 0° → Libra (6)', () => {
    expect(Math.floor(navLon(60) / 30)).toBe(6);
  });
  it('Virgo 0° → Capricorn (9)', () => {
    expect(Math.floor(navLon(150) / 30)).toBe(9);
  });
  it('Sagittarius 0° → Aries (0)', () => {
    expect(Math.floor(navLon(240) / 30)).toBe(0);
  });
  it('Pisces 0° → Cancer (3)', () => {
    expect(Math.floor(navLon(330) / 30)).toBe(3);
  });

  it('Aries last navamsa (26°40\'+) → Sagittarius (8)', () => {
    expect(Math.floor(navLon(26.7) / 30)).toBe(8);
  });

  it('Boundary at Aries 3°20\' is inclusive of the next nav (Taurus)', () => {
    const eps = 1e-6;
    expect(Math.floor(navLon(30 / 9) / 30)).toBe(1);
    expect(Math.floor(navLon(30 / 9 - eps) / 30)).toBe(0);
  });
});

describe('computeNavamsa (D9): output structure', () => {
  it('returns 9 planets with houses 1..12 anchored to navamsa lagna', () => {
    const d9 = computeNavamsa(SAMPLE, DELHI);
    expect(d9.divisional).toBe('D9');
    expect(d9.planets).toHaveLength(9);
    d9.planets.forEach((p) => {
      const expectedHouse = ((p.rashi.index - d9.lagnaRashi.index + 12) % 12) + 1;
      expect(p.house).toBe(expectedHouse);
    });
  });

  it('Rahu/Ketu remain 6 houses apart in D9 (axial)', () => {
    const d9 = computeNavamsa(SAMPLE, DELHI);
    const rahu = d9.planets.find((p) => p.planet === 'Rahu')!;
    const ketu = d9.planets.find((p) => p.planet === 'Ketu')!;
    const diff = Math.abs(rahu.house - ketu.house);
    expect(diff === 6).toBe(true);
  });

  it('navamsa rashi index is in [0, 12)', () => {
    const d9 = computeNavamsa(SAMPLE, DELHI);
    expect(d9.lagnaRashi.index).toBeGreaterThanOrEqual(0);
    expect(d9.lagnaRashi.index).toBeLessThan(12);
    d9.planets.forEach((p) => {
      expect(p.rashi.index).toBeGreaterThanOrEqual(0);
      expect(p.rashi.index).toBeLessThan(12);
    });
  });

  it('D9 longitude (within nav rashi) is in [0, 30)', () => {
    const d9 = computeNavamsa(SAMPLE, DELHI);
    d9.planets.forEach((p) => {
      expect(p.degreeInRashi).toBeGreaterThanOrEqual(0);
      expect(p.degreeInRashi).toBeLessThan(30);
    });
  });

  it('Hindi locale: rashi names render in Devanagari', () => {
    const en = computeNavamsa(SAMPLE, DELHI, { language: 'en' });
    const hi = computeNavamsa(SAMPLE, DELHI, { language: 'hi' });
    expect(hi.lagnaRashi.index).toBe(en.lagnaRashi.index);
    expect(hi.lagnaRashi.name).not.toBe(en.lagnaRashi.name);
  });
});

describe('computeRashiChart × computeNavamsa: joint properties', () => {
  it('same retrograde flags for grahas across D1 and D9', () => {
    const d1 = computeRashiChart(SAMPLE, DELHI);
    const d9 = computeNavamsa(SAMPLE, DELHI);
    for (let i = 0; i < 9; i++) {
      expect(d1.planets[i]!.planet).toBe(d9.planets[i]!.planet);
      expect(d1.planets[i]!.isRetrograde).toBe(d9.planets[i]!.isRetrograde);
    }
  });

  it('navamsa lagna rashi == navamsa transform of natal sidereal lagna', () => {
    const d1 = computeRashiChart(SAMPLE, DELHI);
    const d9 = computeNavamsa(SAMPLE, DELHI);
    const expectedLagnaRashi = Math.floor(navLon(d1.lagna.siderealLongitude) / 30);
    expect(d9.lagnaRashi.index).toBe(expectedLagnaRashi);
  });
});
