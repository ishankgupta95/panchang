import { describe, it, expect } from 'vitest';
import {
  computeInauspiciousPeriod,
  computeRahuKalam,
  computeGulikaKalam,
  computeYamaganda,
} from '../../src/core/inauspicious';

// Known 12-hour day: sunrise 06:00 UTC, sunset 18:00 UTC
// Each of 8 slots = 12h/8 = 90 minutes
const sunrise = new Date('2024-01-01T06:00:00Z');
const sunset = new Date('2024-01-01T18:00:00Z');
const SLOT_MS = 90 * 60_000; // 90 minutes in ms

describe('computeInauspiciousPeriod', () => {
  it('slot 0 starts at sunrise', () => {
    const period = computeInauspiciousPeriod(sunrise, sunset, 0, [0, 0, 0, 0, 0, 0, 0]);
    expect(period.start.getTime()).toBe(sunrise.getTime());
    expect(period.end.getTime()).toBe(sunrise.getTime() + SLOT_MS);
  });

  it('slot 7 ends at sunset', () => {
    const period = computeInauspiciousPeriod(sunrise, sunset, 0, [7, 0, 0, 0, 0, 0, 0]);
    expect(period.end.getTime()).toBe(sunset.getTime());
    expect(period.start.getTime()).toBe(sunset.getTime() - SLOT_MS);
  });

  it('each slot is exactly 1/8 of daytime', () => {
    const dayMs = sunset.getTime() - sunrise.getTime();
    for (let slot = 0; slot < 8; slot++) {
      const table = [slot, 0, 0, 0, 0, 0, 0] as const;
      const period = computeInauspiciousPeriod(sunrise, sunset, 0, table);
      const duration = period.end.getTime() - period.start.getTime();
      expect(duration).toBe(dayMs / 8);
    }
  });
});

describe('computeRahuKalam', () => {
  // RAHU_KALAM_SLOTS = [7, 1, 6, 4, 5, 3, 2]
  it('Sunday (index 0): slot 7 → 16:30–18:00', () => {
    const rahu = computeRahuKalam(sunrise, sunset, 0);
    expect(rahu.start.getUTCHours()).toBe(16);
    expect(rahu.start.getUTCMinutes()).toBe(30);
    expect(rahu.end.getTime()).toBe(sunset.getTime());
  });

  it('Monday (index 1): slot 1 → 07:30–09:00', () => {
    const rahu = computeRahuKalam(sunrise, sunset, 1);
    expect(rahu.start.getUTCHours()).toBe(7);
    expect(rahu.start.getUTCMinutes()).toBe(30);
    expect(rahu.end.getUTCHours()).toBe(9);
    expect(rahu.end.getUTCMinutes()).toBe(0);
  });

  it('Tuesday (index 2): slot 6 → 15:00–16:30', () => {
    const rahu = computeRahuKalam(sunrise, sunset, 2);
    expect(rahu.start.getUTCHours()).toBe(15);
    expect(rahu.start.getUTCMinutes()).toBe(0);
    expect(rahu.end.getUTCHours()).toBe(16);
    expect(rahu.end.getUTCMinutes()).toBe(30);
  });

  it('duration is always 1/8 of daytime', () => {
    const dayMs = sunset.getTime() - sunrise.getTime();
    for (let day = 0; day < 7; day++) {
      const rahu = computeRahuKalam(sunrise, sunset, day);
      expect(rahu.end.getTime() - rahu.start.getTime()).toBe(dayMs / 8);
    }
  });
});

describe('computeGulikaKalam', () => {
  // GULIKA_SLOTS = [6, 5, 4, 3, 2, 1, 0]
  it('Saturday (index 6): slot 0 → starts at sunrise 06:00', () => {
    const gulika = computeGulikaKalam(sunrise, sunset, 6);
    expect(gulika.start.getTime()).toBe(sunrise.getTime());
    expect(gulika.end.getUTCHours()).toBe(7);
    expect(gulika.end.getUTCMinutes()).toBe(30);
  });

  it('Sunday (index 0): slot 6 → 15:00–16:30', () => {
    const gulika = computeGulikaKalam(sunrise, sunset, 0);
    expect(gulika.start.getUTCHours()).toBe(15);
    expect(gulika.start.getUTCMinutes()).toBe(0);
    expect(gulika.end.getUTCHours()).toBe(16);
    expect(gulika.end.getUTCMinutes()).toBe(30);
  });
});

describe('computeYamaganda', () => {
  // YAMAGANDA_SLOTS = [4, 3, 2, 1, 0, 6, 5]
  it('Sunday (index 0): slot 4 → 12:00–13:30', () => {
    const yama = computeYamaganda(sunrise, sunset, 0);
    expect(yama.start.getUTCHours()).toBe(12);
    expect(yama.start.getUTCMinutes()).toBe(0);
    expect(yama.end.getUTCHours()).toBe(13);
    expect(yama.end.getUTCMinutes()).toBe(30);
  });

  it('Thursday (index 4): slot 0 → starts at sunrise', () => {
    const yama = computeYamaganda(sunrise, sunset, 4);
    expect(yama.start.getTime()).toBe(sunrise.getTime());
  });

  it('duration is always 1/8 of daytime', () => {
    const dayMs = sunset.getTime() - sunrise.getTime();
    for (let day = 0; day < 7; day++) {
      const yama = computeYamaganda(sunrise, sunset, day);
      expect(yama.end.getTime() - yama.start.getTime()).toBe(dayMs / 8);
    }
  });
});
