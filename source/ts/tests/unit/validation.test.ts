import { describe, it, expect } from 'vitest';
import { validateLocation, validateDate } from '../../src/utils/validation';
import { PanchangError } from '../../src/types/errors';

describe('validateLocation', () => {
  it('accepts valid coordinates', () => {
    expect(() => validateLocation({ latitude: 18.52, longitude: 73.86 })).not.toThrow();
  });

  it('accepts edge values', () => {
    expect(() => validateLocation({ latitude: 90, longitude: 180 })).not.toThrow();
    expect(() => validateLocation({ latitude: -90, longitude: -180 })).not.toThrow();
  });

  it('rejects latitude > 90', () => {
    expect(() => validateLocation({ latitude: 91, longitude: 0 })).toThrow(PanchangError);
  });

  it('rejects longitude > 180', () => {
    expect(() => validateLocation({ latitude: 0, longitude: 181 })).toThrow(PanchangError);
  });
});

describe('validateDate', () => {
  it('accepts valid dates', () => {
    expect(() => validateDate(new Date('2025-01-14'))).not.toThrow();
  });

  it('rejects invalid Date', () => {
    expect(() => validateDate(new Date('invalid'))).toThrow(PanchangError);
  });

  it('rejects year before 1900', () => {
    expect(() => validateDate(new Date('1899-01-01'))).toThrow(PanchangError);
  });
});
