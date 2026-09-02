import { describe, it, expect } from 'vitest';
import { computeKaalSarp, computePitruDosha } from '../../src/jyotish/doshas';
import { computeRashiChart, indexPlanets } from '../../src/jyotish/charts';
import type { BirthChart, GrahaName, PlanetPlacement } from '../../src/types/jyotish';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };

/** Houses are assigned whole-sign relative to lagna, which defaults to rashi 0. */
function makeChart(
  longitudes: Partial<Record<GrahaName, number>>,
  lagnaLon = 0,
): BirthChart {
  const order: GrahaName[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const lagnaRashi = Math.floor(lagnaLon / 30);
  const planet = (p: GrahaName, lon: number): PlanetPlacement => {
    const rashi = Math.floor(lon / 30);
    return {
      planet: p,
      longitude: lon,
      rashi: { index: rashi, name: String(rashi) },
      degreeInRashi: lon - rashi * 30,
      house: ((rashi - lagnaRashi + 12) % 12) + 1,
      isRetrograde: false,
    };
  };
  const planets = order.map((p) => planet(p, longitudes[p] ?? 0));
  return {
    divisional: 'D1',
    lagna: {
      siderealLongitude: lagnaLon,
      rashi: { index: lagnaRashi, name: String(lagnaRashi) },
      degreeInRashi: 0,
      nakshatra: { index: 0, name: 'x' },
      pada: 1,
    },
    bhava: {
      system: 'whole-sign',
      ascendantLongitude: lagnaLon,
      mcLongitude: ((lagnaRashi + 9) * 30) % 360,
      houses: Array.from({ length: 12 }, (_, i) => {
        const r = (lagnaRashi + i) % 12;
        return {
          house: i + 1,
          cuspLongitude: r * 30,
          rashi: { index: r, name: String(r) },
          degreeInRashi: 0,
        };
      }),
    },
    planets,
    byPlanet: indexPlanets(planets),
  };
}

describe('computeKaalSarp: full afflicted', () => {
  it('all 7 visible planets between Rahu (0°) and Ketu (180°) in the forward arc → afflicted', () => {
    const chart = makeChart({
      Rahu: 0,
      Sun: 30, Moon: 60, Mars: 90, Mercury: 120, Jupiter: 150, Venus: 100, Saturn: 170,
      Ketu: 180,
    });
    const ksd = computeKaalSarp(chart);
    expect(ksd.afflicted).toBe(true);
    expect(ksd.partial).toBe(false);
    expect(ksd.subtype).toBe('anant');
    expect(ksd.rahuHouse).toBe(1);
    expect(ksd.ketuHouse).toBe(7);
  });

  it('all 7 visible planets in the backward arc (180-360 from Rahu) → afflicted', () => {
    const chart = makeChart({
      Rahu: 0,
      Sun: 200, Moon: 220, Mars: 240, Mercury: 260, Jupiter: 280, Venus: 300, Saturn: 340,
      Ketu: 180,
    });
    const ksd = computeKaalSarp(chart);
    expect(ksd.afflicted).toBe(true);
    expect(ksd.partial).toBe(false);
  });
});

describe('computeKaalSarp: subtype by Rahu house', () => {
  const tests: Array<[number, string]> = [
    [0, 'anant'],
    [30, 'kulik'],
    [60, 'vasuki'],
    [90, 'shankhpal'],
    [120, 'padma'],
    [150, 'mahapadma'],
    [180, 'takshak'],
    [210, 'karkotak'],
    [240, 'shankhachud'],
    [270, 'ghatak'],
    [300, 'vishdhar'],
    [330, 'sheshnag'],
  ];
  for (const [rahuLon, subtype] of tests) {
    it(`Rahu at ${rahuLon}° → subtype ${subtype}`, () => {
      const chart = makeChart({
        Rahu: rahuLon,
        Sun:    (rahuLon + 20) % 360,
        Moon:   (rahuLon + 40) % 360,
        Mars:   (rahuLon + 60) % 360,
        Mercury:(rahuLon + 80) % 360,
        Jupiter:(rahuLon + 100) % 360,
        Venus:  (rahuLon + 120) % 360,
        Saturn: (rahuLon + 140) % 360,
        Ketu:   (rahuLon + 180) % 360,
      });
      const ksd = computeKaalSarp(chart);
      expect(ksd.afflicted).toBe(true);
      expect(ksd.subtype).toBe(subtype);
    });
  }
});

describe('computeKaalSarp: not afflicted', () => {
  it('one planet on the wrong side → not afflicted, partial flag set', () => {
    const chart = makeChart({
      Rahu: 0,
      Sun: 30, Moon: 60, Mars: 90, Mercury: 120, Jupiter: 150, Venus: 100,
      Saturn: 200,
      Ketu: 180,
    });
    const ksd = computeKaalSarp(chart);
    expect(ksd.afflicted).toBe(false);
    expect(ksd.partial).toBe(true);
    expect(ksd.subtype).toBeNull();
  });

  it('two planets on the wrong side → not afflicted, not partial', () => {
    const chart = makeChart({
      Rahu: 0,
      Sun: 30, Moon: 60, Mars: 90, Mercury: 120, Jupiter: 150,
      Venus: 200, Saturn: 250,
      Ketu: 180,
    });
    const ksd = computeKaalSarp(chart);
    expect(ksd.afflicted).toBe(false);
    expect(ksd.partial).toBe(false);
  });

  it('planet exactly on Rahu (d=0) → not afflicted (axis-conjunct)', () => {
    const chart = makeChart({
      Rahu: 0,
      Sun: 0,  // A planet conjunct Rahu is outside the strict (0, 180) arc.
      Moon: 60, Mars: 90, Mercury: 120, Jupiter: 150, Venus: 100, Saturn: 170,
      Ketu: 180,
    });
    const ksd = computeKaalSarp(chart);
    expect(ksd.afflicted).toBe(false);
  });

  it('planet exactly on Ketu (d=180) → not afflicted (axis-conjunct)', () => {
    const chart = makeChart({
      Rahu: 0,
      Sun: 30, Moon: 60, Mars: 90, Mercury: 120, Jupiter: 150, Venus: 100,
      Saturn: 180,
      Ketu: 180,
    });
    const ksd = computeKaalSarp(chart);
    expect(ksd.afflicted).toBe(false);
  });
});

describe('computeKaalSarp: real natal chart', () => {
  it('runs without error and reports rahuHouse/ketuHouse 6 apart', () => {
    const chart = computeRashiChart(new Date('1995-08-15T05:30:00Z'), DELHI);
    const ksd = computeKaalSarp(chart);
    expect(typeof ksd.afflicted).toBe('boolean');
    expect(typeof ksd.partial).toBe('boolean');
    expect(ksd.rahuHouse).toBeGreaterThanOrEqual(1);
    expect(ksd.rahuHouse).toBeLessThanOrEqual(12);
    expect(ksd.ketuHouse).toBeGreaterThanOrEqual(1);
    expect(ksd.ketuHouse).toBeLessThanOrEqual(12);
    expect(Math.abs(ksd.rahuHouse - ksd.ketuHouse)).toBe(6);
  });
});

describe('computePitruDosha: Sun + node conjunction', () => {
  it('Sun + Rahu in same house → afflicted', () => {
    const chart = makeChart({
      Sun: 30,
      Rahu: 35,
      Ketu: 215,
    });
    const p = computePitruDosha(chart);
    expect(p.afflicted).toBe(true);
    expect(p.reasons.some((r) => r.includes('Rahu'))).toBe(true);
  });

  it('Sun + Saturn in 9th house → afflicted', () => {
    const chart = makeChart({
      Sun: 245,
      Saturn: 250,
      Rahu: 60,
      Ketu: 240,   // Also in the 9th, so the node rule fires too.
    });
    const p = computePitruDosha(chart);
    expect(p.afflicted).toBe(true);
    expect(p.reasons.some((r) => r.includes('Saturn'))).toBe(true);
  });

  it('Sun and Saturn in different houses → Saturn rule does NOT trigger', () => {
    const chart = makeChart({
      Sun: 245,
      Saturn: 100,
      Rahu: 60,
      Ketu: 240,
    });
    const p = computePitruDosha(chart);
    expect(p.reasons.some((r) => r.includes('Saturn'))).toBe(false);
  });
});

describe('computePitruDosha: clean chart', () => {
  it('Sun, Rahu, Ketu, Saturn all in different houses → not afflicted', () => {
    const chart = makeChart({
      Sun: 30,
      Rahu: 90,
      Ketu: 270,
      Saturn: 180,
    });
    const p = computePitruDosha(chart);
    expect(p.afflicted).toBe(false);
    expect(p.reasons).toHaveLength(0);
  });
});

describe('computePitruDosha: real natal chart', () => {
  it('runs without error, returns boolean afflicted + reasons array', () => {
    const chart = computeRashiChart(new Date('1995-08-15T05:30:00Z'), DELHI);
    const p = computePitruDosha(chart);
    expect(typeof p.afflicted).toBe('boolean');
    expect(Array.isArray(p.reasons)).toBe(true);
    if (p.afflicted) expect(p.reasons.length).toBeGreaterThan(0);
    else expect(p.reasons).toHaveLength(0);
  });
});
