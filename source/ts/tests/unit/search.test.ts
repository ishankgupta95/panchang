import { describe, it, expect } from 'vitest';
import { findTransitionTime, findStartTime, findDailyElements, STANDARD_PRECISION } from '../../src/utils/search';

describe('findTransitionTime', () => {
  it('finds the moment a step function changes', () => {
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

describe('findStartTime', () => {
  const fromUtc = new Date('2026-08-15T00:30:00Z');
  const boundaryAt = fromUtc.getTime() - 2 * 3600_000;
  const RATE = 0.5 / 3600_000;
  const angleAt = (d: Date) => 72 + (d.getTime() - boundaryAt) * RATE;
  const getIndex = (d: Date) => Math.floor((((angleAt(d) % 360) + 360) % 360) / 12);

  it('finds a boundary whose window-edge probe is two elements back (secant path)', () => {
    expect(getIndex(new Date(fromUtc.getTime() - 36 * 3600_000))).toBe(4);
    const start = findStartTime(fromUtc, 6, getIndex, 36, 15, 30_000, { angleAt, spanDeg: 12 });
    expect(Math.abs(start.getTime() - boundaryAt)).toBeLessThan(1000);
  });

  it('finds the same boundary on the bisection fallback', () => {
    const start = findStartTime(fromUtc, 6, getIndex);
    expect(Math.abs(start.getTime() - boundaryAt)).toBeLessThan(31_000);
  });

  it('saturates to the window edge only when the element is older than the window', () => {
    const start = findStartTime(fromUtc, 6, () => 6);
    expect(start.getTime()).toBe(fromUtc.getTime() - 36 * 3600_000);
  });
});

describe('findDailyElements', () => {
  it('collects a single element when no transition before nextSunrise', () => {
    const sunrise = new Date('2025-01-14T01:00:00Z');
    const nextSunrise = new Date('2025-01-15T01:00:00Z');

    const elementAtSunrise = { index: 5, name: 'TestElement', completionPercentage: 50, endTime: null as Date | null };
    const getIndexAtTime = (_d: Date) => 5;
    const computeElement = (_d: Date) => ({ ...elementAtSunrise });

    const results = findDailyElements(
      sunrise, nextSunrise, elementAtSunrise,
      getIndexAtTime, computeElement,
      36, STANDARD_PRECISION, 2,
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.index).toBe(5);
    expect(results[0]!.isActiveAtSunrise).toBe(true);
    expect(results[0]!.startTime).toBeInstanceOf(Date);
    expect(results[0]!.endTime!.getTime()).toBe(nextSunrise.getTime());
  });

  it('collects two elements when transition occurs mid-day', () => {
    const sunrise = new Date('2025-01-14T01:00:00Z');
    const nextSunrise = new Date('2025-01-15T01:00:00Z');
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
      36, STANDARD_PRECISION, 2,
    );

    expect(results).toHaveLength(2);
    expect(results[0]!.index).toBe(5);
    expect(results[0]!.isActiveAtSunrise).toBe(true);
    expect(results[1]!.index).toBe(6);
    expect(results[1]!.isActiveAtSunrise).toBe(false);
    expect(Math.abs(results[0]!.endTime!.getTime() - transitionAt)).toBeLessThan(60_000);
    expect(results[1]!.endTime!.getTime()).toBe(nextSunrise.getTime());
  });

  it('respects maxPerDay safety cap', () => {
    const sunrise = new Date('2025-01-14T01:00:00Z');
    const nextSunrise = new Date('2025-01-15T01:00:00Z');
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
      6, STANDARD_PRECISION, 3,
    );

    expect(results.length).toBeLessThanOrEqual(3);
  });
});
