import { validateLocation } from '../utils/validation';
import { resolveEvent, type RiseSetKind } from './riseSetCache';
import type { GeoLocation } from '../types/location';

const LUNAR: RiseSetKind = { body: 'moon' };

/**
 * Next moonrise on or after the given UTC instant, or `null`, since some days have none. `limitDays` defaults to 2
 * (the Go port has no default). An Invalid Date, or a search that would reach 2^52 ms from 1970, throws `INVALID_DATE`.
 */
export function getMoonrise(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2,
): Date | null {
  validateLocation(location);
  return resolveEvent(LUNAR, +1, searchFromUtc, location, limitDays);
}

/**
 * Next moonset on or after the given UTC instant, or `null` if none within `limitDays`, which defaults to 2 (the Go
 * port has no default). An Invalid Date, or a search that would reach 2^52 ms from 1970, throws `INVALID_DATE`.
 */
export function getMoonset(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2,
): Date | null {
  validateLocation(location);
  return resolveEvent(LUNAR, -1, searchFromUtc, location, limitDays);
}
