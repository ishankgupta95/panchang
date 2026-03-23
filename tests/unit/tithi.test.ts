import { describe, it, expect } from 'vitest';
import { computeTithiFromLongitudes, getTithiIndexFromLons } from '../../src/core/tithi';

describe('computeTithiFromLongitudes', () => {
  it('Shukla Pratipad at angle ~6°', () => {
    const t = computeTithiFromLongitudes(66, 60, 'Shukla Pratipad');
    expect(t.index).toBe(0);
    expect(t.paksha).toBe('Shukla');
    expect(t.number).toBe(1);
    expect(t.completionPercentage).toBeCloseTo(50, 0);
    expect(t.endTime).toBeNull();
  });

  it('Purnima at exactly 180° → index 15 (Krishna Pratipad boundary)', () => {
    // 180 / 12 = 15 → floor = 15 = Krishna Pratipad
    // Purnima is index 14 (angles 168°–180°). At exactly 180°, it flips.
    const t = computeTithiFromLongitudes(180, 0, 'Purnima');
    expect(t.index).toBe(15);
    expect(t.paksha).toBe('Krishna');
  });

  it('Purnima at angle just under 180°', () => {
    const t = computeTithiFromLongitudes(179.9, 0, 'Purnima');
    expect(t.index).toBe(14);
    expect(t.paksha).toBe('Shukla');
    expect(t.number).toBe(15); // Purnima is 15th in Shukla
  });

  it('Amavasya at angle ~354°', () => {
    const t = computeTithiFromLongitudes(354, 0, 'Amavasya');
    expect(t.index).toBe(29); // 354/12 = 29.5, floor = 29
    expect(t.paksha).toBe('Krishna');
    expect(t.number).toBe(15); // Amavasya is 15th in Krishna
  });

  it('wraps when Moon < Sun (Moon at 10°, Sun at 350°)', () => {
    // normalize360(10 - 350) = normalize360(-340) = 20
    // 20 / 12 = 1.66, floor = 1
    const t = computeTithiFromLongitudes(10, 350, 'Dwitiya');
    expect(t.index).toBe(1);
    expect(t.paksha).toBe('Shukla');
    expect(t.number).toBe(2);
  });

  it('Krishna Pratipad at angle 180°', () => {
    const t = computeTithiFromLongitudes(180, 0, 'Krishna Pratipad');
    expect(t.index).toBe(15);
    expect(t.paksha).toBe('Krishna');
    expect(t.number).toBe(1);
  });

  it('completionPercentage is between 0 and 100', () => {
    for (let i = 0; i < 30; i++) {
      const angle = i * 12 + 6; // midpoint of each tithi
      const t = computeTithiFromLongitudes(angle, 0, 'test');
      expect(t.completionPercentage).toBeGreaterThanOrEqual(0);
      expect(t.completionPercentage).toBeLessThanOrEqual(100);
    }
  });
});

describe('getTithiIndexFromLons', () => {
  it('matches computeTithiFromLongitudes index', () => {
    const cases = [
      [66, 60], [180, 0], [354, 0], [10, 350],
    ] as const;
    for (const [moon, sun] of cases) {
      const fromFull = computeTithiFromLongitudes(moon, sun, '').index;
      const fromIndex = getTithiIndexFromLons(moon, sun);
      expect(fromIndex).toBe(fromFull);
    }
  });
});
