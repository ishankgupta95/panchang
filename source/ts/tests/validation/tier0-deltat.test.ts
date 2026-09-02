/**
 * @tier 0  JPL Horizons DE441, ΔT isolated
 *
 * Horizons freezes at the last known leap second while the library extrapolates
 * Espenak-Meeus TT minus UT1, so agreement is asserted only through 2010.
 */
import { describe, it, expect } from 'vitest';
import { MakeTime } from 'astronomy-engine';
import { readTestData } from '../testdata';

const fixture = readTestData('reference', 'horizons-deltat.json');

function libraryDeltaT(jdUt: number): number {
  const ut = jdUt - 2451545.0;
  return (MakeTime(ut).tt - ut) * 86400;
}

/** TT − TAI, plus TAI − UTC as of the last leap second (2017-01-01). */
const TT_MINUS_UTC_FROZEN = 32.184 + 37;

describe('Tier 0: ΔT (TT − UT), isolated', () => {
  it('the fixture is the one these bounds were measured against', () => {
    expect(fixture.deltaTSeconds).toHaveLength(21);
    expect(fixture.year[0]).toBe(1900);
    expect(fixture.year[20]).toBe(2100);
  });

  it('agrees with Horizons to ≤1.0 s over 1900-2010', () => {
    let worst = 0, worstYear = 0;
    for (let i = 0; i < fixture.year.length; i++) {
      if (fixture.year[i]! > 2010) continue;
      const diff = Math.abs(libraryDeltaT(fixture.jd[i]!) - fixture.deltaTSeconds[i]!);
      if (diff > worst) { worst = diff; worstYear = fixture.year[i]!; }
    }
    expect(worst, `worst ΔT disagreement ${worst.toFixed(3)} s at ${worstYear}`)
      .toBeLessThanOrEqual(1.0);
  });

  it("Horizons' post-2020 values are the frozen-leap-second branch, not a ΔT model", () => {
    for (let i = 0; i < fixture.year.length; i++) {
      if (fixture.year[i]! < 2020) continue;
      expect(fixture.deltaTSeconds[i]!, `Horizons ΔT at ${fixture.year[i]}`)
        .toBeCloseTo(TT_MINUS_UTC_FROZEN, 2);
    }
  });

  it('pins the post-2035 UTC-vs-UT1 exposure', () => {
    const at = (year: number) =>
      libraryDeltaT(fixture.jd[fixture.year.indexOf(year)]!) - TT_MINUS_UTC_FROZEN;
    expect(at(2050)).toBeCloseTo(23.8, 0);
    expect(at(2100)).toBeCloseTo(133.5, 0);
  });

  it('is monotonic increasing across the modern span', () => {
    for (let i = 0; i < fixture.jd.length - 1; i++) {
      if (fixture.year[i]! < 1960) continue; // pre-1960 ΔT genuinely has flat spells
      expect(libraryDeltaT(fixture.jd[i + 1]!)).toBeGreaterThan(libraryDeltaT(fixture.jd[i]!));
    }
  });
});
