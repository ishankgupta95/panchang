import { describe, it, expect } from 'vitest';
import { findTransitionTime, findDailyElements, STANDARD_PRECISION } from '../../src/utils/search';

describe('findTransitionTime', () => {
  it('finds the moment a step function changes', () => {
    // Mock: index 5 before hour 10, index 6 from hour 10 onward
    const getIndex = (d: Date) => (d.getUTCHours() >= 10 ? 6 : 5);
    const start = new Date('2025-01-14T00:00:00Z');
    const end = new Date('2025-01-14T23:59:00Z');

    const result = findTransitionTime(start, end, 5, getIndex, 15, 60_000);
    expect(result.getUTCHours()).toBe(10);
    expect(result.getUTCMinutes()).toBeLessThanOrEqual(1);
  });

  it('works with tight tolerance', () => {
    const changeAt = new Date('2025-01-14T15:30:00Z').getTime();
    const getIndex = (d: Date) => (d.getTime() >= changeAt ? 3 : 2);
    const start = new Date('2025-01-14T00:00:00Z');
    const end = new Date('2025-01-15T00:00:00Z');

    const result = findTransitionTime(start, end, 2, getIndex, 25, 1000);
    expect(Math.abs(result.getTime() - changeAt)).toBeLessThan(2000);
  });
});

describe('findDailyElements', () => {
  it('collects a single element when no transition before nextSunrise', () => {
    const sunrise = new Date('2025-01-14T01:00:00Z');
    const nextSunrise = new Date('2025-01-15T01:00:00Z');

    // index always returns 5 (no transition in the day window)
    // but findTransitionTime will extend the search and the clamped endTime = nextSunrise
    const elementAtSunrise = { index: 5, name: 'TestElement', completionPercentage: 50, endTime: null as Date | null };
    const getIndexAtTime = (_d: Date) => 5;
    const computeElement = (_d: Date) => ({ ...elementAtSunrise });

    const results = findDailyElements(
      sunrise, nextSunrise, elementAtSunrise,
      getIndexAtTime, computeElement,
      30, 36, STANDARD_PRECISION, 2,
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.index).toBe(5);
    expect(results[0]!.isActiveAtSunrise).toBe(true);
    expect(results[0]!.startTime).toBeInstanceOf(Date);
    // endTime should be clamped to nextSunrise
    expect(results[0]!.endTime!.getTime()).toBe(nextSunrise.getTime());
  });

  it('collects two elements when transition occurs mid-day', () => {
    const sunrise = new Date('2025-01-14T01:00:00Z');
    const nextSunrise = new Date('2025-01-15T01:00:00Z');
    // transition from index 5 to 6 at noon
    const transitionAt = new Date('2025-01-14T12:00:00Z').getTime();
    const getIndexAtTime = (d: Date) => d.getTime() >= transitionAt ? 6 : 5;

    const elementAtSunrise = { index: 5, name: 'First', completionPercentage: 30, endTime: null as Date | null };
    const computeElement = (d: Date) => ({
      index: getIndexAtTime(d),
      name: 'Second',
      completionPercentage: 0,
      endTime: null as Date | null,
    });

    const results = findDailyElements(
      sunrise, nextSunrise, elementAtSunrise,
      getIndexAtTime, computeElement,
      30, 36, STANDARD_PRECISION, 2,
    );

    expect(results).toHaveLength(2);
    expect(results[0]!.index).toBe(5);
    expect(results[0]!.isActiveAtSunrise).toBe(true);
    expect(results[1]!.index).toBe(6);
    expect(results[1]!.isActiveAtSunrise).toBe(false);
    // First element ends near noon
    expect(Math.abs(results[0]!.endTime!.getTime() - transitionAt)).toBeLessThan(60_000);
    // Second element ends at nextSunrise
    expect(results[1]!.endTime!.getTime()).toBe(nextSunrise.getTime());
  });

  it('respects maxPerDay safety cap', () => {
    const sunrise = new Date('2025-01-14T01:00:00Z');
    const nextSunrise = new Date('2025-01-15T01:00:00Z');
    // cycle through 5,6,7,8... every 4 hours
    const getIndexAtTime = (d: Date) => {
      const hoursFromSunrise = (d.getTime() - sunrise.getTime()) / 3600_000;
      return 5 + Math.floor(hoursFromSunrise / 4);
    };
    const startIndex = getIndexAtTime(sunrise);
    const elementAtSunrise = { index: startIndex, name: 'E', completionPercentage: 0, endTime: null as Date | null };
    const computeElement = (d: Date) => ({
      index: getIndexAtTime(d),
      name: 'E',
      completionPercentage: 0,
      endTime: null as Date | null,
    });

    const results = findDailyElements(
      sunrise, nextSunrise, elementAtSunrise,
      getIndexAtTime, computeElement,
      30, 6, STANDARD_PRECISION, 3, // maxPerDay = 3
    );

    expect(results.length).toBeLessThanOrEqual(3);
  });
});
