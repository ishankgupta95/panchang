/**
 * Unit tests for `computeMangalDosha` (Manglik affliction detection).
 *
 * Algorithmic checks (independent of natal chart):
 *   - All 6 manglik houses (1, 2, 4, 7, 8, 12) trigger from each cut.
 *   - Non-manglik houses (3, 5, 6, 9, 10, 11) do not trigger.
 *   - Cancellations: Mars in own sign / exalted.
 */

import { describe, it, expect } from 'vitest';
import { computeMangalDosha } from '../../src/jyotish/doshas';
import type { BirthChart, PlanetPlacement } from '../../src/types/jyotish';

/**
 * Build a synthetic D1 chart with explicit rashis for Lagna, Moon, Venus,
 * Mars; other planets defaulted to rashi 0. Houses are computed whole-sign
 * relative to lagna.
 */
function makeChart(
  lagnaRashi: number,
  moonRashi: number,
  venusRashi: number,
  marsRashi: number,
): BirthChart {
  const stub = (planet: PlanetPlacement['planet'], rashi: number): PlanetPlacement => ({
    planet,
    longitude: rashi * 30 + 5,
    rashi: { index: rashi, name: String(rashi) },
    degreeInRashi: 5,
    house: ((rashi - lagnaRashi + 12) % 12) + 1,
    isRetrograde: false,
  });
  return {
    divisional: 'D1',
    lagna: {
      siderealLongitude: lagnaRashi * 30,
      rashi: { index: lagnaRashi, name: String(lagnaRashi) },
      degreeInRashi: 0,
      nakshatra: { index: 0, name: 'x' },
      pada: 1,
    },
    bhava: {
      system: 'whole-sign',
      ascendantLongitude: lagnaRashi * 30,
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
    planets: [
      stub('Sun', 0),
      stub('Moon', moonRashi),
      stub('Mars', marsRashi),
      stub('Mercury', 0),
      stub('Jupiter', 0),
      stub('Venus', venusRashi),
      stub('Saturn', 0),
      stub('Rahu', 0),
      stub('Ketu', 0),
    ],
  };
}

describe('computeMangalDosha — house-from-lagna affliction', () => {
  for (const houseFromLagna of [1, 2, 4, 7, 8, 12]) {
    it(`Mars in house ${houseFromLagna} from lagna flags affliction`, () => {
      const lagnaRashi = 5;
      const marsRashi = (lagnaRashi + houseFromLagna - 1) % 12;
      // Place Moon, Venus far from Mars to isolate the from-lagna cut.
      const chart = makeChart(lagnaRashi, (marsRashi + 6) % 12, (marsRashi + 6) % 12, marsRashi);
      const info = computeMangalDosha(chart);
      expect(info.fromLagna.afflicted).toBe(true);
      expect(info.fromLagna.house).toBe(houseFromLagna);
    });
  }

  for (const houseFromLagna of [3, 5, 6, 9, 10, 11]) {
    it(`Mars in non-manglik house ${houseFromLagna} from lagna does NOT flag`, () => {
      const lagnaRashi = 5;
      const marsRashi = (lagnaRashi + houseFromLagna - 1) % 12;
      const chart = makeChart(lagnaRashi, (marsRashi + 6) % 12, (marsRashi + 6) % 12, marsRashi);
      const info = computeMangalDosha(chart);
      // Note: from-Moon / from-Venus may still afflict given the +6 offset.
      // We only check the from-lagna flag here.
      expect(info.fromLagna.afflicted).toBe(false);
      expect(info.fromLagna.house).toBe(houseFromLagna);
    });
  }
});

describe('computeMangalDosha — house-from-Moon and house-from-Venus', () => {
  it('Mars in 7th from Moon flags from-Moon afflicted', () => {
    // moon rashi 4, mars rashi (4+6)%12 = 10 → 7th from Moon = Aquarius
    const chart = makeChart(0, 4, 0, 10);
    const info = computeMangalDosha(chart);
    expect(info.fromMoon.afflicted).toBe(true);
    expect(info.fromMoon.house).toBe(7);
  });

  it('Mars in 8th from Venus flags from-Venus afflicted', () => {
    const chart = makeChart(0, 0, 3, 10); // venus 3, mars 10 → (10-3+12)%12+1 = 8
    const info = computeMangalDosha(chart);
    expect(info.fromVenus.afflicted).toBe(true);
    expect(info.fromVenus.house).toBe(8);
  });
});

describe('computeMangalDosha — cancellations', () => {
  it('Mars in Aries (own sign) cancels affliction', () => {
    // Mars in 7th from Moon. Mars rashi = Aries (0). Moon rashi 6.
    const chart = makeChart(0, 6, 0, 0);
    const info = computeMangalDosha(chart);
    expect(info.fromMoon.afflicted).toBe(true); // raw flag
    expect(info.afflicted).toBe(false);          // cancelled
    expect(info.cancellations.some((c) => c.includes('Aries'))).toBe(true);
  });

  it('Mars in Scorpio (own sign) cancels affliction', () => {
    const chart = makeChart(0, 1, 0, 7); // moon=Taurus, mars=Scorpio → 7th
    const info = computeMangalDosha(chart);
    expect(info.fromMoon.afflicted).toBe(true);
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.some((c) => c.includes('Scorpio'))).toBe(true);
  });

  it('Mars exalted in Capricorn cancels affliction', () => {
    const chart = makeChart(0, 3, 0, 9); // moon=Cancer, mars=Capricorn → 7th from Moon
    const info = computeMangalDosha(chart);
    expect(info.fromMoon.afflicted).toBe(true);
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.some((c) => c.includes('Capricorn'))).toBe(true);
  });

  it('No cancellation when Mars is in another sign', () => {
    const chart = makeChart(0, 6, 0, 0); // mars Aries → cancelled (own sign)
    expect(computeMangalDosha(chart).afflicted).toBe(false);

    const chart2 = makeChart(0, 4, 0, 10); // mars Aquarius, 7th from Moon — not cancelled
    expect(computeMangalDosha(chart2).afflicted).toBe(true);
    expect(computeMangalDosha(chart2).cancellations).toHaveLength(0);
  });
});

describe('computeMangalDosha — overall affliction logic', () => {
  it('any of three cuts flags affliction (no cancel)', () => {
    // from-lagna = 7, from-Moon = 6 (not manglik), from-Venus = 6
    const chart = makeChart(0, 4, 4, 6); // lagna 0, moon/venus 4, mars 6 → from-lagna 7
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(true);
    expect(info.afflicted).toBe(true);
  });

  it('not afflicted when none of the three cuts trigger', () => {
    // mars in 11th from lagna, 9th from moon, 11th from venus (all non-manglik)
    const chart = makeChart(0, 2, 0, 10);
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(false);
    expect(info.fromMoon.afflicted).toBe(false);
    expect(info.fromVenus.afflicted).toBe(false);
    expect(info.afflicted).toBe(false);
  });
});
