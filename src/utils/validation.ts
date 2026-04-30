import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';
import { TOTAL_NAKSHATRAS, TOTAL_TITHIS } from './constants';

export function validateLocation(location: GeoLocation): void {
  if (typeof location.latitude !== 'number' || location.latitude < -90 || location.latitude > 90) {
    throw new PanchangError(
      `Latitude must be a number between -90 and 90, got ${location.latitude}`,
      'INVALID_LATITUDE'
    );
  }
  if (typeof location.longitude !== 'number' || location.longitude < -180 || location.longitude > 180) {
    throw new PanchangError(
      `Longitude must be a number between -180 and 180, got ${location.longitude}`,
      'INVALID_LONGITUDE'
    );
  }
  if (location.elevation !== undefined && (typeof location.elevation !== 'number' || location.elevation < -500)) {
    throw new PanchangError(
      `Elevation must be >= -500 meters, got ${location.elevation}`,
      'INVALID_ELEVATION'
    );
  }
}

export function validateDate(date: Date): void {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new PanchangError(`Invalid Date: ${String(date)}`, 'INVALID_DATE');
  }
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    throw new PanchangError(
      `Date must be between 1900 and 2100 for astronomical accuracy, got year ${year}`,
      'INVALID_DATE'
    );
  }
}

// ── Programmer-error guards for internal cyclic indices ──────────────────
// These throw `RangeError` (programmer errors at module boundaries), distinct
// from the user-facing `PanchangError` thrown by validateDate / validateLocation.

function assertCyclicIndex(value: number, modulus: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= modulus) {
    throw new RangeError(`${name} must be integer in [0, ${modulus - 1}], got ${value}`);
  }
}

export function assertNakshatraIndex(value: number, name = 'nakshatra index'): void {
  assertCyclicIndex(value, TOTAL_NAKSHATRAS, name);
}

export function assertVaraIndex(value: number, name = 'vara index'): void {
  assertCyclicIndex(value, 7, name);
}

export function assertTithiIndex(value: number, name = 'tithi index'): void {
  assertCyclicIndex(value, TOTAL_TITHIS, name);
}
