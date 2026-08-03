/**
 * Unit tests for `computeMangalDosha` and `computePitruDosha`.
 *
 * Algorithm under test (Mangal):
 *   - Lagna + Moon + Venus reference (drik panchang's stated algorithm).
 *   - Cancellations: Mars in own/exalted sign; Mars conjunct Jupiter / Moon
 *     / Venus; Mars aspected by Jupiter (5th / 7th / 9th sign-aspect).
 *
 * Algorithm under test (Pitru):
 *   - 4 trigger rules (pandit-consensus subset): Sun+Rahu conjunction,
 *     Sun+Saturn conjunction, Rahu in 9th house, 9th-lord conjunct Rahu.
 */

import { describe, it, expect } from 'vitest';
import { computeMangalDosha, computePitruDosha } from '../../src/jyotish/doshas';
import type { BirthChart, PlanetPlacement, GrahaName } from '../../src/types/jyotish';
import { indexPlanets } from '../../src/jyotish/charts';

interface ChartOpts {
  lagnaRashi: number;
  sunRashi?: number;
  moonRashi: number;
  marsRashi: number;
  mercuryRashi?: number;
  jupiterRashi?: number;
  venusRashi?: number;
  saturnRashi?: number;
  rahuRashi?: number;
  ketuRashi?: number;
}

/**
 * Build a synthetic D1 chart with whole-sign houses. Any planet rashi not
 * supplied defaults to rashi 0 (Aries). Houses are whole-sign relative to
 * lagna; the bhava table is populated so `chart.bhava.houses[8].rashi`
 * resolves correctly for the Pitru 9th-lord rule.
 */
function makeChart(opts: ChartOpts): BirthChart {
  const { lagnaRashi, moonRashi, marsRashi } = opts;
  const planetRashi = (p: GrahaName): number => {
    switch (p) {
      case 'Sun': return opts.sunRashi ?? 0;
      case 'Moon': return moonRashi;
      case 'Mars': return marsRashi;
      case 'Mercury': return opts.mercuryRashi ?? 0;
      case 'Jupiter': return opts.jupiterRashi ?? 0;
      case 'Venus': return opts.venusRashi ?? 0;
      case 'Saturn': return opts.saturnRashi ?? 0;
      case 'Rahu': return opts.rahuRashi ?? 0;
      case 'Ketu': return opts.ketuRashi ?? ((opts.rahuRashi ?? 0) + 6) % 12;
    }
  };
  const stub = (planet: GrahaName): PlanetPlacement => {
    const rashi = planetRashi(planet);
    return {
      planet,
      longitude: rashi * 30 + 5,
      rashi: { index: rashi, name: String(rashi) },
      degreeInRashi: 5,
      house: ((rashi - lagnaRashi + 12) % 12) + 1,
      isRetrograde: false,
    };
  };
  const planets: PlanetPlacement[] = [
    stub('Sun'), stub('Moon'), stub('Mars'), stub('Mercury'),
    stub('Jupiter'), stub('Venus'), stub('Saturn'),
    stub('Rahu'), stub('Ketu'),
  ];
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
    planets,
    byPlanet: indexPlanets(planets),
  };
}

/**
 * Pick a "safe" rashi for an auxiliary planet: not conjunct Mars or Moon,
 * not within Jupiter's 5/7/9 sign-aspect on Mars, and not equal to a list
 * of avoided rashis. Used to isolate the Lagna / Moon / Venus reference
 * checks from accidental cancellations.
 */
function safeJupiterRashi(marsRashi: number, avoid: number[]): number {
  const aspectedBy = (j: number) => {
    const h = ((marsRashi - j + 12) % 12) + 1;
    return h === 5 || h === 7 || h === 9;
  };
  for (let j = 0; j < 12; j++) {
    if (avoid.includes(j)) continue;
    if (aspectedBy(j)) continue;
    return j;
  }
  throw new Error('no safe Jupiter rashi');
}

/** Pick a Venus rashi that doesn't trigger the Venus-chart manglik check. */
function safeVenusRashi(marsRashi: number, avoid: number[]): number {
  const manglikHouses = new Set([1, 2, 4, 7, 8, 12]);
  for (let v = 0; v < 12; v++) {
    if (avoid.includes(v)) continue;
    const h = ((marsRashi - v + 12) % 12) + 1;
    if (manglikHouses.has(h)) continue;
    return v;
  }
  throw new Error('no safe Venus rashi');
}

describe('computeMangalDosha — house-from-Lagna affliction', () => {
  for (const houseFromLagna of [1, 2, 4, 7, 8, 12]) {
    it(`Mars in house ${houseFromLagna} from lagna flags affliction`, () => {
      const lagnaRashi = 5;
      const marsRashi = (lagnaRashi + houseFromLagna - 1) % 12;
      const moonRashi = (marsRashi + 4) % 12; // Mars 5th from Moon — not manglik
      const venusRashi = safeVenusRashi(marsRashi, [marsRashi, moonRashi]);
      const chart = makeChart({
        lagnaRashi, moonRashi, marsRashi, venusRashi,
        jupiterRashi: safeJupiterRashi(marsRashi, [marsRashi, moonRashi, venusRashi]),
      });
      const info = computeMangalDosha(chart);
      expect(info.fromLagna.afflicted).toBe(true);
      expect(info.fromLagna.house).toBe(houseFromLagna);
    });
  }

  for (const houseFromLagna of [3, 5, 6, 9, 10, 11]) {
    it(`Mars in non-manglik house ${houseFromLagna} from lagna does NOT flag from-Lagna`, () => {
      const lagnaRashi = 5;
      const marsRashi = (lagnaRashi + houseFromLagna - 1) % 12;
      const moonRashi = (marsRashi + 4) % 12;
      const venusRashi = safeVenusRashi(marsRashi, [marsRashi, moonRashi]);
      const chart = makeChart({
        lagnaRashi, moonRashi, marsRashi, venusRashi,
        jupiterRashi: safeJupiterRashi(marsRashi, [marsRashi, moonRashi, venusRashi]),
      });
      const info = computeMangalDosha(chart);
      expect(info.fromLagna.afflicted).toBe(false);
      expect(info.fromLagna.house).toBe(houseFromLagna);
    });
  }
});

describe('computeMangalDosha — house-from-Moon and house-from-Venus', () => {
  it('Mars in 7th from Moon flags from-Moon afflicted', () => {
    const venusRashi = safeVenusRashi(10, [10, 4]);
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 4, marsRashi: 10, venusRashi,
      jupiterRashi: safeJupiterRashi(10, [10, 4, venusRashi]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromMoon.afflicted).toBe(true);
    expect(info.fromMoon.house).toBe(7);
  });

  it('Mars in 8th from Venus flags from-Venus afflicted', () => {
    // Venus 3, Mars 10 → Mars 8th from Venus.
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 1, marsRashi: 10, venusRashi: 3,
      jupiterRashi: safeJupiterRashi(10, [10, 1, 3]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromVenus.afflicted).toBe(true);
    expect(info.fromVenus.house).toBe(8);
  });
});

describe('computeMangalDosha — cancellations', () => {
  it('Mars in Aries (own sign) cancels affliction', () => {
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 6, marsRashi: 0,
      venusRashi: safeVenusRashi(0, [0, 6]),
      jupiterRashi: safeJupiterRashi(0, [0, 6]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromMoon.afflicted).toBe(true);
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.some((c) => c.includes('Aries'))).toBe(true);
  });

  it('Mars in Scorpio (own sign) cancels affliction', () => {
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 1, marsRashi: 7,
      venusRashi: safeVenusRashi(7, [7, 1]),
      jupiterRashi: safeJupiterRashi(7, [7, 1]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromMoon.afflicted).toBe(true);
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.some((c) => c.includes('Scorpio'))).toBe(true);
  });

  it('Mars exalted in Capricorn cancels affliction', () => {
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 3, marsRashi: 9,
      venusRashi: safeVenusRashi(9, [9, 3]),
      jupiterRashi: safeJupiterRashi(9, [9, 3]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromMoon.afflicted).toBe(true);
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.some((c) => c.includes('Capricorn'))).toBe(true);
  });

  it('Mars conjunct Jupiter cancels affliction', () => {
    // Mars in Gemini at Lagna; Jupiter also in Gemini. Venus parked safely.
    const chart = makeChart({
      lagnaRashi: 2, moonRashi: 8, marsRashi: 2, jupiterRashi: 2,
      venusRashi: safeVenusRashi(2, [2, 8]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(true);
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.some((c) => c.includes('Jupiter'))).toBe(true);
  });

  it('Mars conjunct Moon cancels affliction', () => {
    const chart = makeChart({
      lagnaRashi: 2, moonRashi: 2, marsRashi: 2,
      venusRashi: safeVenusRashi(2, [2]),
      jupiterRashi: safeJupiterRashi(2, [2]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(true);
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.some((c) => c.includes('Moon'))).toBe(true);
  });

  it('Mars conjunct Venus cancels affliction (and self-cancels Venus check)', () => {
    // Mars in Mithuna with Venus also in Mithuna → Lagna in Mesha makes
    // Mars 3rd from Lagna (clean), Mars 1st from Venus (flagged).
    // The Mars–Venus conjunction cancels the affliction.
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 6, marsRashi: 2, venusRashi: 2,
      jupiterRashi: safeJupiterRashi(2, [2, 6]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromVenus.afflicted).toBe(true);
    expect(info.fromVenus.house).toBe(1);
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.some((c) => c.includes('Venus'))).toBe(true);
  });

  it('Mars aspected by Jupiter (7th aspect) cancels affliction', () => {
    // Mars in Gemini at Lagna; Jupiter in Sagittarius (7th from Gemini).
    const chart = makeChart({
      lagnaRashi: 2, moonRashi: 6, marsRashi: 2, jupiterRashi: 8,
      venusRashi: safeVenusRashi(2, [2, 6, 8]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(true);
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.some((c) => c.includes('aspected by Jupiter'))).toBe(true);
  });

  it('No cancellation when none of the rules apply', () => {
    // Mars in Aquarius → 7th from Moon in Leo. Venus / Jupiter safe.
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 4, marsRashi: 10,
      venusRashi: safeVenusRashi(10, [10, 4]),
      jupiterRashi: safeJupiterRashi(10, [10, 4]),
    });
    const info = computeMangalDosha(chart);
    expect(info.afflicted).toBe(true);
    expect(info.cancellations).toHaveLength(0);
  });
});

describe('computeMangalDosha — overall affliction logic', () => {
  it('any of the three cuts triggers affliction', () => {
    // from-Lagna 7, from-Moon 5, from-Venus 5 → only Lagna flags.
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 2, marsRashi: 6, venusRashi: 2,
      jupiterRashi: safeJupiterRashi(6, [6, 2]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(true);
    expect(info.fromMoon.afflicted).toBe(false);
    expect(info.fromVenus.afflicted).toBe(false);
    expect(info.afflicted).toBe(true);
  });

  it('not afflicted when no cut triggers', () => {
    // Mars in Aquarius (10): 11th from Lagna Mesha, 9th from Moon in Gemini,
    // 11th from Venus in Mesha. All non-manglik.
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 2, marsRashi: 10, venusRashi: 0,
      jupiterRashi: safeJupiterRashi(10, [10, 2, 0]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(false);
    expect(info.fromMoon.afflicted).toBe(false);
    expect(info.fromVenus.afflicted).toBe(false);
    expect(info.afflicted).toBe(false);
  });
});

describe('computeMangalDosha — severity (anshik / purna)', () => {
  it("'none' when zero charts flag Mars", () => {
    // Mars 11th from Lagna, 9th from Moon, 11th from Venus.
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 2, marsRashi: 10, venusRashi: 0,
      jupiterRashi: safeJupiterRashi(10, [10, 2, 0]),
    });
    const info = computeMangalDosha(chart);
    expect(info.severity).toBe('none');
  });

  it("'anshik' when exactly one chart flags Mars", () => {
    // Mars in Cancer (3) → 4th from Lagna Mesha (flagged), 3rd from Moon
    // Taurus (clean), 11th from Venus Virgo (clean).
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 1, marsRashi: 3, venusRashi: 5,
      jupiterRashi: safeJupiterRashi(3, [3, 1, 5]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(true);
    expect(info.fromMoon.afflicted).toBe(false);
    expect(info.fromVenus.afflicted).toBe(false);
    expect(info.severity).toBe('anshik');
  });

  it("'anshik' when two charts flag Mars (Person-2 case: Lagna + Venus)", () => {
    // Mars in Scorpio (7) at Lagna Scorpio: 1st from Lagna (flagged),
    // 6th from Moon Mithuna (clean), 2nd from Venus Tula (flagged).
    const chart = makeChart({
      lagnaRashi: 7, moonRashi: 2, marsRashi: 7, venusRashi: 6,
      jupiterRashi: safeJupiterRashi(7, [7, 2, 6]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(true);
    expect(info.fromMoon.afflicted).toBe(false);
    expect(info.fromVenus.afflicted).toBe(true);
    expect(info.severity).toBe('anshik');
  });

  it("'purna' when all three charts flag Mars", () => {
    // Mars in Mesha (0) at Lagna Mesha: 1st from Lagna (flagged), 1st from
    // Moon Mesha (flagged), 1st from Venus Mesha (flagged).
    const chart = makeChart({
      lagnaRashi: 0, moonRashi: 0, marsRashi: 0, venusRashi: 0,
      jupiterRashi: safeJupiterRashi(0, [0]),
    });
    const info = computeMangalDosha(chart);
    expect(info.fromLagna.afflicted).toBe(true);
    expect(info.fromMoon.afflicted).toBe(true);
    expect(info.fromVenus.afflicted).toBe(true);
    expect(info.severity).toBe('purna');
  });

  it('severity reflects raw flags even when cancellations nullify afflicted', () => {
    // Person 2-like: Mars in own sign Scorpio at Lagna; Lagna + Venus flag,
    // Moon clean → severity 'anshik'. Own-sign cancellation makes
    // afflicted: false.
    const chart = makeChart({
      lagnaRashi: 7, moonRashi: 2, marsRashi: 7, venusRashi: 6,
      jupiterRashi: 7, // also in Scorpio — Jupiter conjunct cancellation too
    });
    const info = computeMangalDosha(chart);
    expect(info.severity).toBe('anshik');
    expect(info.afflicted).toBe(false);
    expect(info.cancellations.length).toBeGreaterThan(0);
  });
});

// ── Pitru Dosha tests ────────────────────────────────────────────────

describe('computePitruDosha — conjunction triggers', () => {
  it('Sun + Rahu conjunction (any house) flags affliction', () => {
    // Sun and Rahu both in Aries (1st house from Lagna Aries).
    const chart = makeChart({
      lagnaRashi: 0, sunRashi: 0, moonRashi: 6, marsRashi: 6,
      rahuRashi: 0, ketuRashi: 6,
    });
    const info = computePitruDosha(chart);
    expect(info.afflicted).toBe(true);
    expect(info.reasons.some((r) => r.includes('Sun + Rahu'))).toBe(true);
  });

  it('Sun + Saturn conjunction (any house) flags affliction', () => {
    // Both Sun and Saturn in house 5 (Leo, with lagna Aries).
    const chart = makeChart({
      lagnaRashi: 0, sunRashi: 4, moonRashi: 1, marsRashi: 1,
      saturnRashi: 4, rahuRashi: 10, ketuRashi: 4,
    });
    const info = computePitruDosha(chart);
    expect(info.afflicted).toBe(true);
    expect(info.reasons.some((r) => r.includes('Sun + Saturn'))).toBe(true);
  });
});

describe('computePitruDosha — house-placement triggers', () => {
  it('Rahu in 9th house flags affliction', () => {
    // Lagna Aries → 9th = Sagittarius. Rahu there.
    const chart = makeChart({
      lagnaRashi: 0, sunRashi: 1, moonRashi: 2, marsRashi: 3,
      saturnRashi: 5, rahuRashi: 8, ketuRashi: 2,
      jupiterRashi: 6,
    });
    const info = computePitruDosha(chart);
    expect(info.afflicted).toBe(true);
    expect(info.reasons.some((r) => r.includes('Rahu in the 9th house'))).toBe(true);
  });
});

describe('computePitruDosha — 9th-lord triggers', () => {
  it('9th-lord conjunct Rahu flags affliction', () => {
    // Lagna Aries → 9th rashi Sagittarius → 9th lord Jupiter.
    // Jupiter and Rahu both in Gemini (3rd house).
    const chart = makeChart({
      lagnaRashi: 0, sunRashi: 1, moonRashi: 4, marsRashi: 5,
      saturnRashi: 6, jupiterRashi: 2, rahuRashi: 2, ketuRashi: 8,
    });
    const info = computePitruDosha(chart);
    expect(info.afflicted).toBe(true);
    expect(info.reasons.some((r) =>
      r.includes('9th-lord Jupiter conjunct Rahu'),
    )).toBe(true);
  });
});

describe('computePitruDosha — clean chart', () => {
  it('No Pitru Dosha when no trigger conditions are met', () => {
    // Lagna Aries; everything benefic and away from pitru triggers.
    // 9th lord Jupiter in Aries (1st house, kendra) — not dusthana, not
    // conjunct Rahu or Saturn. Sun in 1st (not 9th). No Sun-malefic conj.
    const chart = makeChart({
      lagnaRashi: 0, sunRashi: 0, moonRashi: 1, marsRashi: 2,
      saturnRashi: 5, jupiterRashi: 0, rahuRashi: 4, ketuRashi: 10,
    });
    const info = computePitruDosha(chart);
    expect(info.afflicted).toBe(false);
    expect(info.reasons).toHaveLength(0);
  });
});
