import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';
import { TOTAL_NAKSHATRAS, TOTAL_TITHIS } from './constants';

export function validateLocation(location: GeoLocation): void {
  if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
    throw new PanchangError(
      `Latitude must be a finite number between -90 and 90, got ${location.latitude}`,
      'INVALID_LATITUDE'
    );
  }
  if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) {
    throw new PanchangError(
      `Longitude must be a finite number between -180 and 180, got ${location.longitude}`,
      'INVALID_LONGITUDE'
    );
  }
  if (location.elevation !== undefined && (!Number.isFinite(location.elevation) || location.elevation < -500)) {
    throw new PanchangError(
      `Elevation must be >= -500 meters, got ${location.elevation}`,
      'INVALID_ELEVATION'
    );
  }
}

/**
 * Throws `INVALID_DATE` for a value that is not a valid `Date`, and for a UTC year outside 1900 to 2100 unless `years`
 * is `'any'`. The helpers that only do date arithmetic pass `'any'`, so no year they accepted before is refused, and
 * it checks for `getTime` rather than `instanceof`, so a `Date` from another realm still works there too.
 */
export function validateDate(date: Date, years: 'supported' | 'any' = 'supported'): void {
  const isDate = years === 'any'
    ? typeof (date as { getTime?: unknown } | null | undefined)?.getTime === 'function'
    : date instanceof Date;
  if (!isDate || isNaN(date.getTime())) {
    throw new PanchangError(`Invalid Date: ${String(date)}`, 'INVALID_DATE');
  }
  if (years === 'any') return;
  const year = date.getUTCFullYear();
  if (year < 1900 || year > 2100) {
    throw new PanchangError(
      `Date must be between 1900 and 2100 for astronomical accuracy, got year ${year}`,
      'INVALID_DATE'
    );
  }
}

/**
 * A calendar year from 1900 to 2100 is supported whole, even where its local boundaries fall up to
 * 14 hours outside that span in UTC; any other window fails on whichever boundary lies outside it.
 */
export function validateLocalYearWindow(year: number, startMs: number, endMs: number): void {
  const slack = 14 * 3600_000;
  const near = (ms: number): boolean =>
    ms >= Date.UTC(1900, 0, 1) - slack && ms < Date.UTC(2101, 0, 1) + slack;
  if (year >= 1900 && year <= 2100 && near(startMs) && near(endMs)) return;
  validateDate(new Date(startMs));
  validateDate(new Date(endMs));
}

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
