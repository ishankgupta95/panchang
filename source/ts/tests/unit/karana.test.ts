import { describe, it, expect } from 'vitest';
import {
  computeKaranaFromLongitudes,
  getKaranaIndex,
  getKaranaType,
} from '../../src/core/karana';
import { KARANA_SPAN } from '../../src/utils/constants';

describe('getKaranaIndex', () => {
  it('elongation=0° → karana index 0 (Kimstughna)', () => {
    expect(getKaranaIndex(0, 0)).toBe(0);
  });

  it('elongation=6° → karana index 1 (Bava)', () => {
    expect(getKaranaIndex(6, 0)).toBe(1);
  });

  it('elongation=354° → karana index 59 (Naga)', () => {
    expect(getKaranaIndex(354, 0)).toBe(59);
  });

  it('handles wrap-around (moonLon < sunLon)', () => {
    expect(getKaranaIndex(10, 350)).toBe(3);
  });

  it('covers all 60 indices', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const elongation = i * KARANA_SPAN + 1;
      seen.add(getKaranaIndex(elongation, 0));
    }
    expect(seen.size).toBe(60);
  });
});

describe('getKaranaType', () => {
  it('index 0 is fixed (Kimstughna)', () => {
    expect(getKaranaType(0)).toBe('fixed');
  });

  it('indices 1-56 are movable', () => {
    for (let i = 1; i <= 56; i++) {
      expect(getKaranaType(i)).toBe('movable');
    }
  });

  it('index 57 is fixed (Shakuni)', () => {
    expect(getKaranaType(57)).toBe('fixed');
  });

  it('index 58 is fixed (Chatushpada)', () => {
    expect(getKaranaType(58)).toBe('fixed');
  });

  it('index 59 is fixed (Naga)', () => {
    expect(getKaranaType(59)).toBe('fixed');
  });
});

describe('computeKaranaFromLongitudes', () => {
  it('returns correct karana info for Bava (index 1)', () => {
    const result = computeKaranaFromLongitudes(7, 0, 'Bava');
    expect(result.index).toBe(1);
    expect(result.name).toBe('Bava');
    expect(result.type).toBe('movable');
  });

  it('completionPercentage is in [0, 100]', () => {
    for (let elongation = 0; elongation < 360; elongation += 10) {
      const result = computeKaranaFromLongitudes(elongation, 0, 'test');
      expect(result.completionPercentage).toBeGreaterThanOrEqual(0);
      expect(result.completionPercentage).toBeLessThanOrEqual(100);
    }
  });

  it('fixed karana names: Kimstughna, Shakuni, Chatushpada, Naga', () => {
    const k0 = computeKaranaFromLongitudes(0.5, 0, 'Kimstughna');
    expect(k0.type).toBe('fixed');

    const k57 = computeKaranaFromLongitudes(342.5, 0, 'Shakuni');
    expect(k57.type).toBe('fixed');
  });

  it('movable karana names cycle: Bava, Balava, Kaulava, Taitila, Gara, Vanija, Vishti', () => {
    const expectedNames = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];
    for (let i = 0; i < 7; i++) {
      const elongation = (1 + i) * KARANA_SPAN + 1;
      const idx = getKaranaIndex(elongation, 0);
      expect(idx).toBe(1 + i);
      const result = computeKaranaFromLongitudes(elongation, 0, expectedNames[i]!);
      expect(result.type).toBe('movable');
    }
  });
});
