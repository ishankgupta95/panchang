import { describe, it, expect } from 'vitest';
import { normalize360 } from '../../src/utils/angle';

describe('normalize360', () => {
  it('no-op for values in [0, 360)', () => {
    expect(normalize360(0)).toBe(0);
    expect(normalize360(45)).toBe(45);
    expect(normalize360(359.99)).toBeCloseTo(359.99);
  });

  it('wraps negative values', () => {
    expect(normalize360(-10)).toBe(350);
    expect(normalize360(-360)).toBe(0);
    expect(normalize360(-730)).toBeCloseTo(350, 5);
  });

  it('wraps values >= 360', () => {
    expect(normalize360(360)).toBe(0);
    expect(normalize360(370)).toBe(10);
    expect(normalize360(720)).toBe(0);
  });
});
