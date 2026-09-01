import { describe, it, expect } from 'vitest';
import { computePrashnaChart } from '../../src/jyotish/prashna';
import { computeRashiChart } from '../../src/jyotish/charts';

const MUMBAI = { latitude: 19.0760, longitude: 72.8777 };
const QUESTION_MOMENT = new Date('2026-05-09T14:30:00Z');

describe('computePrashnaChart: parity with computeRashiChart', () => {
  it('returns same shape (divisional, lagna, bhava, planets)', () => {
    const prashna = computePrashnaChart(QUESTION_MOMENT, MUMBAI);
    expect(prashna.divisional).toBe('D1');
    expect(prashna.lagna).toBeDefined();
    expect(prashna.bhava).toBeDefined();
    expect(prashna.planets).toHaveLength(9);
  });

  it('with explicit houseSystem + ayanamsa matches computeRashiChart exactly', () => {
    const prashna = computePrashnaChart(QUESTION_MOMENT, MUMBAI, {
      houseSystem: 'whole-sign',
      ayanamsa: 'lahiri',
    });
    const natal = computeRashiChart(QUESTION_MOMENT, MUMBAI, {
      houseSystem: 'whole-sign',
      ayanamsa: 'lahiri',
    });
    expect(prashna.lagna.siderealLongitude).toBeCloseTo(natal.lagna.siderealLongitude, 8);
    expect(prashna.lagna.rashi.index).toBe(natal.lagna.rashi.index);
    expect(prashna.bhava.system).toBe(natal.bhava.system);
    expect(prashna.planets.length).toBe(natal.planets.length);
    for (let i = 0; i < natal.planets.length; i++) {
      expect(prashna.planets[i]!.planet).toBe(natal.planets[i]!.planet);
      expect(prashna.planets[i]!.longitude).toBeCloseTo(natal.planets[i]!.longitude, 8);
      expect(prashna.planets[i]!.house).toBe(natal.planets[i]!.house);
    }
  });
});

describe('computePrashnaChart: default house system + ayanamsa', () => {
  it('defaults to placidus-kp houses + krishnamurti ayanamsa (KP horary anchors)', () => {
    const prashna = computePrashnaChart(QUESTION_MOMENT, MUMBAI);
    expect(prashna.bhava.system).toBe('placidus-kp');
    const lahiri = computeRashiChart(QUESTION_MOMENT, MUMBAI, {
      houseSystem: 'placidus-kp',
      ayanamsa: 'lahiri',
    });
    const delta = Math.abs(prashna.lagna.siderealLongitude - lahiri.lagna.siderealLongitude);
    expect(delta).toBeGreaterThan(0.05);
    expect(delta).toBeLessThan(0.15);
  });

  it('matches computeRashiChart with placidus-kp + krishnamurti explicitly set', () => {
    const prashna = computePrashnaChart(QUESTION_MOMENT, MUMBAI);
    const natal = computeRashiChart(QUESTION_MOMENT, MUMBAI, {
      houseSystem: 'placidus-kp',
      ayanamsa: 'krishnamurti',
    });
    expect(prashna.lagna.siderealLongitude).toBeCloseTo(natal.lagna.siderealLongitude, 8);
    expect(prashna.bhava.system).toBe(natal.bhava.system);
    for (let i = 0; i < 12; i++) {
      expect(prashna.bhava.houses[i]!.cuspLongitude)
        .toBeCloseTo(natal.bhava.houses[i]!.cuspLongitude, 6);
    }
  });
});

describe('computePrashnaChart: option overrides', () => {
  it('honors caller-supplied whole-sign house system', () => {
    const prashna = computePrashnaChart(QUESTION_MOMENT, MUMBAI, {
      houseSystem: 'whole-sign',
    });
    expect(prashna.bhava.system).toBe('whole-sign');
  });

  it('honors caller-supplied equal house system', () => {
    const prashna = computePrashnaChart(QUESTION_MOMENT, MUMBAI, {
      houseSystem: 'equal',
    });
    expect(prashna.bhava.system).toBe('equal');
  });

  it('honors caller-supplied ayanamsa', () => {
    const lahiri = computePrashnaChart(QUESTION_MOMENT, MUMBAI, {
      ayanamsa: 'lahiri',
    });
    const trueChitra = computePrashnaChart(QUESTION_MOMENT, MUMBAI, {
      ayanamsa: 'true-chitra',
    });
    expect(lahiri.lagna.siderealLongitude)
      .not.toBeCloseTo(trueChitra.lagna.siderealLongitude, 4);
  });
});

describe('computePrashnaChart: validation', () => {
  it('throws on invalid latitude', () => {
    expect(() => computePrashnaChart(QUESTION_MOMENT, {
      latitude: 91,
      longitude: 72.87,
    })).toThrow();
  });

  it('throws on invalid date', () => {
    expect(() => computePrashnaChart(new Date('not-a-date'), MUMBAI)).toThrow();
  });
});
