import { validateLocation } from '../utils/validation';
import { resolveEvent, type RiseSetKind } from './riseSetCache';
import type { GeoLocation } from '../types/location';

const LUNAR: RiseSetKind = { body: 'moon' };

/** Next moonrise on or after the given UTC instant, or `null`, since some days have none. */
export function getMoonrise(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2,
): Date | null {
  validateLocation(location);
  return resolveEvent(LUNAR, +1, searchFromUtc, location, limitDays);
}

/** Next moonset on or after the given UTC instant, or `null` if none within `limitDays`. */
export function getMoonset(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2,
): Date | null {
  validateLocation(location);
  return resolveEvent(LUNAR, -1, searchFromUtc, location, limitDays);
}
