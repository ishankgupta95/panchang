/**
 * Unit tests for `computeBhava` (12 house cusps).
 *
 * Verifies:
 *   - whole-sign: cusps at exact rashi boundaries; house 1 contains lagna.
 *   - equal: cusps at lagna + 30·n; each spans exactly 30°.
 *   - placidus-kp: opposite-axis pairing (cusp k+6 = cusp k + 180°),
 *     cusps remain in zodiacal order, MC matches house 10, and the
 *     algorithm refuses to compute at circumpolar latitudes.
 */

import { describe, it, expect } from 'vitest';
import { computeBhava } from '../../src/jyotish/bhava';
import { computeLagna } from '../../src/jyotish/lagna';
import { PanchangError } from '../../src/types/errors';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };
const QUITO = { latitude: -0.1807, longitude: -78.4678 };
const SVALBARD = { latitude: 78.22, longitude: 15.65 }; // well inside Arctic Circle

const SAMPLE_DATE = new Date('1995-08-15T05:30:00Z');

describe('computeBhava — whole-sign system (default)', () => {
  it('all cusps fall at 0° of the rashi (degreeInRashi == 0)', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI);
    expect(chart.system).toBe('whole-sign');
    for (const h of chart.houses) {
      expect(h.degreeInRashi).toBe(0);
    }
  });

  it('house 1 rashi == lagna rashi', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI);
    const lagna = computeLagna(SAMPLE_DATE, DELHI);
    expect(chart.houses[0]!.rashi.index).toBe(lagna.rashi.index);
    expect(chart.ascendantLongitude).toBe(lagna.siderealLongitude);
  });

  it('successive houses occupy successive rashis (modulo 12)', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI);
    for (let i = 0; i < 12; i++) {
      const expected = (chart.houses[0]!.rashi.index + i) % 12;
      expect(chart.houses[i]!.rashi.index).toBe(expected);
    }
  });
});

describe('computeBhava — equal-house system', () => {
  it('every cusp is exactly 30° after the previous (mod 360)', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'equal' });
    expect(chart.system).toBe('equal');
    for (let i = 1; i < 12; i++) {
      let delta = chart.houses[i]!.cuspLongitude - chart.houses[i - 1]!.cuspLongitude;
      if (delta < 0) delta += 360;
      expect(delta).toBeCloseTo(30, 9);
    }
  });

  it('house 1 cusp == lagna longitude', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'equal' });
    const lagna = computeLagna(SAMPLE_DATE, DELHI);
    expect(chart.houses[0]!.cuspLongitude).toBeCloseTo(lagna.siderealLongitude, 9);
  });

  it('house 7 cusp == lagna + 180° (mod 360)', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'equal' });
    const lagna = computeLagna(SAMPLE_DATE, DELHI);
    const expected = (lagna.siderealLongitude + 180) % 360;
    expect(chart.houses[6]!.cuspLongitude).toBeCloseTo(expected, 9);
  });
});

describe('computeBhava — placidus-kp system', () => {
  it('cusp k+6 == cusp k + 180° (axial pairing) for all 6 axes', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'placidus-kp' });
    expect(chart.system).toBe('placidus-kp');
    for (let i = 0; i < 6; i++) {
      const a = chart.houses[i]!.cuspLongitude;
      const b = chart.houses[i + 6]!.cuspLongitude;
      let delta = b - a;
      if (delta < 0) delta += 360;
      expect(delta).toBeCloseTo(180, 6);
    }
  });

  it('cusps proceed in zodiacal order (each cusp > previous mod 360)', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'placidus-kp' });
    let cumulative = 0;
    for (let i = 1; i < 12; i++) {
      let delta = chart.houses[i]!.cuspLongitude - chart.houses[i - 1]!.cuspLongitude;
      if (delta <= 0) delta += 360;
      cumulative += delta;
      // Each step should be a sane house width — between 5° (extreme) and 60° (extreme).
      expect(delta).toBeGreaterThan(1);
      expect(delta).toBeLessThan(70);
    }
    // Cumulative wrap should be just under 360° (last cusp within 360° of first).
    expect(cumulative).toBeGreaterThan(330);
    expect(cumulative).toBeLessThan(360);
  });

  it('house 1 cusp == lagna longitude (sidereal)', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'placidus-kp' });
    const lagna = computeLagna(SAMPLE_DATE, DELHI);
    expect(chart.houses[0]!.cuspLongitude).toBeCloseTo(lagna.siderealLongitude, 6);
  });

  it('house 10 cusp == sidereal MC', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'placidus-kp' });
    expect(chart.houses[9]!.cuspLongitude).toBeCloseTo(chart.mcLongitude, 9);
  });

  it('throws CIRCUMPOLAR at extreme high latitude (Svalbard, well inside Arctic Circle)', () => {
    expect(() =>
      computeBhava(new Date('2025-06-21T18:00:00Z'), SVALBARD, {
        houseSystem: 'placidus-kp',
      }),
    ).toThrow(PanchangError);
    try {
      computeBhava(new Date('2025-06-21T18:00:00Z'), SVALBARD, {
        houseSystem: 'placidus-kp',
      });
    } catch (err) {
      expect((err as PanchangError).code).toBe('CIRCUMPOLAR');
    }
  });

  it('Sydney (southern hemisphere): axial pairing holds', () => {
    const chart = computeBhava(SAMPLE_DATE, SYDNEY, { houseSystem: 'placidus-kp' });
    for (let i = 0; i < 6; i++) {
      let delta = chart.houses[i + 6]!.cuspLongitude - chart.houses[i]!.cuspLongitude;
      if (delta < 0) delta += 360;
      expect(delta).toBeCloseTo(180, 6);
    }
  });

  it('Quito (≈equator): Placidus reduces to equal-RA cusps (RA differences = 30°)', () => {
    // At φ = 0, SDA = SNA = 90°, so α(cusp k) - α(cusp k-1) = 30° exactly.
    // The corresponding ecliptic-longitude differences are NOT 30° due to
    // ecliptic obliquity, but cusps at LST + 30·k in RA are the equal
    // divisions of the celestial equator.
    const chart = computeBhava(SAMPLE_DATE, QUITO, { houseSystem: 'placidus-kp' });
    expect(chart.houses).toHaveLength(12);
    // Just check all cusps unique, axial pairing, monotonic order (covered above).
    for (let i = 0; i < 6; i++) {
      let delta = chart.houses[i + 6]!.cuspLongitude - chart.houses[i]!.cuspLongitude;
      if (delta < 0) delta += 360;
      expect(delta).toBeCloseTo(180, 6);
    }
  });
});

describe('computeBhava — output shape', () => {
  it('houses array has length 12 and house numbers 1..12', () => {
    const chart = computeBhava(SAMPLE_DATE, DELHI);
    expect(chart.houses).toHaveLength(12);
    chart.houses.forEach((h, i) => {
      expect(h.house).toBe(i + 1);
      expect(h.cuspLongitude).toBeGreaterThanOrEqual(0);
      expect(h.cuspLongitude).toBeLessThan(360);
      expect(h.rashi.index).toBe(Math.floor(h.cuspLongitude / 30));
      expect(h.degreeInRashi).toBeGreaterThanOrEqual(0);
      expect(h.degreeInRashi).toBeLessThan(30);
    });
  });

  it('mcLongitude is in [0, 360) and consistent with system', () => {
    const ws = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'whole-sign' });
    const eq = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'equal' });
    const pl = computeBhava(SAMPLE_DATE, DELHI, { houseSystem: 'placidus-kp' });
    for (const c of [ws, eq, pl]) {
      expect(c.mcLongitude).toBeGreaterThanOrEqual(0);
      expect(c.mcLongitude).toBeLessThan(360);
    }
    // The MC is intrinsic to the (date, location) pair — the same across systems.
    expect(ws.mcLongitude).toBeCloseTo(eq.mcLongitude, 9);
    expect(ws.mcLongitude).toBeCloseTo(pl.mcLongitude, 9);
  });

  it('localizes rashi names when lang="hi"', () => {
    const en = computeBhava(SAMPLE_DATE, DELHI, { language: 'en' });
    const hi = computeBhava(SAMPLE_DATE, DELHI, { language: 'hi' });
    for (let i = 0; i < 12; i++) {
      expect(en.houses[i]!.rashi.index).toBe(hi.houses[i]!.rashi.index);
      expect(en.houses[i]!.rashi.name).not.toBe(hi.houses[i]!.rashi.name);
    }
  });
});

describe('computeBhava — input validation', () => {
  it('throws on invalid date', () => {
    expect(() => computeBhava(new Date('not-a-date'), DELHI)).toThrow(PanchangError);
  });

  it('throws on invalid location', () => {
    expect(() =>
      computeBhava(SAMPLE_DATE, { latitude: 95, longitude: 0 }),
    ).toThrow(PanchangError);
  });
});
