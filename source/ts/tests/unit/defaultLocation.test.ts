import { describe, it, expect } from 'vitest';
import {
  TRADITIONAL_REFERENCE,
  MODERN_REFERENCE,
  IST_OFFSET_MINUTES,
  IST_TIMEZONE,
  referenceLocation,
  resolveLocation,
} from '../../src/core/defaultLocation';
import { PanchangError } from '../../src/types/errors';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };

describe('reference points', () => {
  it('TRADITIONAL_REFERENCE is the classical madhya rekha', () => {
    expect(TRADITIONAL_REFERENCE.latitude).toBe(23.1765);
    expect(TRADITIONAL_REFERENCE.longitude).toBe(75.7885);
  });

  it('MODERN_REFERENCE is the 1955 Calendar Reform Committee point', () => {
    expect(MODERN_REFERENCE.latitude).toBe(23.1833);
    expect(MODERN_REFERENCE.longitude).toBe(82.5);
  });

  it('only the Central Station has IST as its own local mean time', () => {
    expect(MODERN_REFERENCE.longitude * 4).toBe(IST_OFFSET_MINUTES);
    expect(TRADITIONAL_REFERENCE.longitude * 4).toBeLessThan(IST_OFFSET_MINUTES);
    expect(IST_OFFSET_MINUTES - TRADITIONAL_REFERENCE.longitude * 4).toBeCloseTo(26.8, 1);
    expect(IST_TIMEZONE).toBe('Asia/Kolkata');
  });

  it('are frozen, so one caller cannot move them for every other', () => {
    expect(Object.isFrozen(TRADITIONAL_REFERENCE)).toBe(true);
    expect(Object.isFrozen(MODERN_REFERENCE)).toBe(true);
  });
});

describe('referenceLocation', () => {
  it('maps the two selectable modes to their points', () => {
    expect(referenceLocation('traditional')).toBe(TRADITIONAL_REFERENCE);
    expect(referenceLocation('modern')).toBe(MODERN_REFERENCE);
  });

  it('rejects practical and anything unknown', () => {
    for (const bad of ['practical', 'nonsense', undefined]) {
      expect(() => referenceLocation(bad as never)).toThrow(PanchangError);
    }
  });
});

describe('resolveLocation', () => {
  it('defaults to the traditional reference when no location is given', () => {
    for (const absent of [undefined, null] as const) {
      const r = resolveLocation(absent);
      expect(r.reference).toBe('traditional');
      expect(r.location).toBe(TRADITIONAL_REFERENCE);
    }
  });

  it('honours an explicit modern reference', () => {
    const r = resolveLocation(undefined, 'modern');
    expect(r.reference).toBe('modern');
    expect(r.location).toBe(MODERN_REFERENCE);
  });

  it('reports a supplied location as practical, whatever mode was asked for', () => {
    for (const mode of ['traditional', 'modern'] as const) {
      const r = resolveLocation(PUNE, mode);
      expect(r.reference).toBe('practical');
      expect(r.location).toBe(PUNE);
    }
  });

  it('treats 0,0 as a location, not as missing', () => {
    const r = resolveLocation({ latitude: 0, longitude: 0 });
    expect(r.reference).toBe('practical');
    expect(r.location.latitude).toBe(0);
  });

  it('rejects a half-filled location instead of completing it from a reference point', () => {
    expect(() => resolveLocation({ latitude: 18.52, longitude: Number.NaN }))
      .toThrow(PanchangError);
    try {
      resolveLocation({ latitude: Number.NaN, longitude: 73.85 });
    } catch (e) {
      expect((e as PanchangError).code).toBe('INVALID_LATITUDE');
    }
  });
});
