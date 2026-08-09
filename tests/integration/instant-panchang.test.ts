import { describe, it, expect } from 'vitest';
import { getInstantPanchang } from '../../src/core/panchang';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };

// A known UTC moment: 2025-01-14T06:00:00Z (mid-morning IST, well after sunrise)
const KNOWN_MOMENT = new Date('2025-01-14T06:00:00Z');

describe('getInstantPanchang — index range checks', () => {
  const result = getInstantPanchang(KNOWN_MOMENT, PUNE)!;

  it('returns a valid InstantPanchangResult', () => {
    expect(result).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.location).toEqual(PUNE);
  });

  it('tithi.index is in [0, 29]', () => {
    expect(result.angas.tithi.index).toBeGreaterThanOrEqual(0);
    expect(result.angas.tithi.index).toBeLessThanOrEqual(29);
  });

  it('nakshatra.index is in [0, 26]', () => {
    expect(result.angas.nakshatra.index).toBeGreaterThanOrEqual(0);
    expect(result.angas.nakshatra.index).toBeLessThanOrEqual(26);
  });

  it('yoga.index is in [0, 26]', () => {
    expect(result.angas.yoga.index).toBeGreaterThanOrEqual(0);
    expect(result.angas.yoga.index).toBeLessThanOrEqual(26);
  });

  it('karana.index is in [0, 59]', () => {
    expect(result.angas.karana.index).toBeGreaterThanOrEqual(0);
    expect(result.angas.karana.index).toBeLessThanOrEqual(59);
  });

  it('vara.index is in [0, 6]', () => {
    expect(result.angas.vara.index).toBeGreaterThanOrEqual(0);
    expect(result.angas.vara.index).toBeLessThanOrEqual(6);
  });

  it('ayanamsa is in [23, 25] for dates in 2020–2030', () => {
    expect(result.ayanamsa).toBeGreaterThanOrEqual(23);
    expect(result.ayanamsa).toBeLessThanOrEqual(25);
  });
});

describe('getInstantPanchang — ayanamsa range across 2020–2030', () => {
  const testDates = [
    new Date('2020-01-01T00:00:00Z'),
    new Date('2025-06-15T12:00:00Z'),
    new Date('2030-12-31T23:59:59Z'),
  ];

  for (const d of testDates) {
    it(`ayanamsa in [23, 25] for ${d.toISOString()}`, () => {
      const r = getInstantPanchang(d, PUNE)!;
      expect(r.ayanamsa).toBeGreaterThanOrEqual(23);
      expect(r.ayanamsa).toBeLessThanOrEqual(25);
    });
  }
});

describe('getInstantPanchang — element names are non-empty strings', () => {
  const result = getInstantPanchang(KNOWN_MOMENT, PUNE)!;

  it('tithi has a non-empty name', () => {
    expect(typeof result.angas.tithi.name).toBe('string');
    expect(result.angas.tithi.name.length).toBeGreaterThan(0);
  });

  it('nakshatra has a non-empty name', () => {
    expect(typeof result.angas.nakshatra.name).toBe('string');
    expect(result.angas.nakshatra.name.length).toBeGreaterThan(0);
  });

  it('yoga has a non-empty name', () => {
    expect(typeof result.angas.yoga.name).toBe('string');
    expect(result.angas.yoga.name.length).toBeGreaterThan(0);
  });

  it('karana has a non-empty name', () => {
    expect(typeof result.angas.karana.name).toBe('string');
    expect(result.angas.karana.name.length).toBeGreaterThan(0);
  });
});
