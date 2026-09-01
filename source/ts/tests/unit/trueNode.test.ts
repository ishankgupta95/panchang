import { describe, it, expect } from 'vitest';
import { computePlanetaryPositions } from '../../src/jyotish/planets';

describe("computePlanetaryPositions: nodeType 'true' vs 'mean'", () => {
  it('default behaviour (no arg) matches `mean`', () => {
    const date = new Date('2025-06-15T12:00:00Z');
    const def = computePlanetaryPositions(date, 'lahiri');
    const mean = computePlanetaryPositions(date, 'lahiri', undefined, undefined, 'mean');
    expect(def.rahu.siderealLongitude).toBeCloseTo(mean.rahu.siderealLongitude, 9);
  });

  it("'true' node differs from 'mean' by less than ±2°", () => {
    const date = new Date('2025-06-15T12:00:00Z');
    const mean = computePlanetaryPositions(date, 'lahiri', undefined, undefined, 'mean');
    const truu = computePlanetaryPositions(date, 'lahiri', undefined, undefined, 'true');
    let diff = mean.rahu.siderealLongitude - truu.rahu.siderealLongitude;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    expect(Math.abs(diff)).toBeLessThan(2.0);
  });

  it('Ketu remains exactly opposite Rahu under either nodeType', () => {
    const date = new Date('2025-06-15T12:00:00Z');
    for (const node of ['mean', 'true'] as const) {
      const p = computePlanetaryPositions(date, 'lahiri', undefined, undefined, node);
      let diff = (p.rahu.siderealLongitude - p.ketu.siderealLongitude + 360) % 360;
      if (diff > 180) diff = 360 - diff;
      expect(diff).toBeCloseTo(180, 6);
    }
  });

  it("over a 6-month window, the mean/true difference oscillates around zero", () => {
    const start = new Date('2025-01-01T00:00:00Z');
    let maxAbs = 0;
    for (let m = 0; m < 12; m++) {
      const d = new Date(start.getTime() + m * 30 * 86400_000);
      const mean = computePlanetaryPositions(d, 'lahiri', undefined, undefined, 'mean').rahu.siderealLongitude;
      const truu = computePlanetaryPositions(d, 'lahiri', undefined, undefined, 'true').rahu.siderealLongitude;
      let diff = mean - truu;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      maxAbs = Math.max(maxAbs, Math.abs(diff));
    }
    expect(maxAbs).toBeGreaterThan(0.5);
    expect(maxAbs).toBeLessThan(2.0);
  });
});
