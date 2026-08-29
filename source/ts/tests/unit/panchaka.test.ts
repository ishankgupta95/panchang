// Panchaka runs over the last 5 nakshatras (Dhanishtha 3rd pada through
// Revati), i.e. sidereal Moon longitude >= 300°.

import { describe, it, expect } from 'vitest';
import { computePanchaka } from '../../src/core/panchaka';

describe('computePanchaka', () => {
  it('moonLon=299° → false (just before panchaka zone)', () => {
    expect(computePanchaka(299)).toBe(false);
  });

  it('moonLon=300° → true (start of panchaka zone)', () => {
    expect(computePanchaka(300)).toBe(true);
  });

  it('moonLon=330° → true (mid-panchaka)', () => {
    expect(computePanchaka(330)).toBe(true);
  });

  it('moonLon=359.9° → true (end of panchaka zone)', () => {
    expect(computePanchaka(359.9)).toBe(true);
  });

  it('moonLon=0° → false (Ashwini start)', () => {
    expect(computePanchaka(0)).toBe(false);
  });

  it('moonLon=180° → false (mid-zodiac)', () => {
    expect(computePanchaka(180)).toBe(false);
  });

  it('moonLon=100° → false', () => {
    expect(computePanchaka(100)).toBe(false);
  });
});
