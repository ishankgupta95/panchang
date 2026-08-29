import { PanchangError } from '../types/errors';
import { validateLocation } from '../utils/validation';
import { resolveEvent, type RiseSetKind } from './riseSetCache';
import type { GeoLocation } from '../types/location';

const SOLAR: RiseSetKind = { body: 'sun' };

/** First sunrise at or after the given UTC search start; throws under midnight sun or polar night. */
export function computeSunrise(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2
): Date {
  validateLocation(location);
  const result = resolveEvent(SOLAR, +1, searchFromUtc, location, limitDays);

  if (!result) {
    throw new PanchangError(
      `No sunrise found within ${limitDays} days for ` +
        `(${location.latitude}°, ${location.longitude}°) near ${searchFromUtc.toISOString()}. ` +
        `This location may be experiencing midnight sun or polar night.`,
      'NO_SUNRISE'
    );
  }

  return result;
}

/** First sunset at or after the given UTC search start; throws under midnight sun or polar night. */
export function computeSunset(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2
): Date {
  validateLocation(location);
  const result = resolveEvent(SOLAR, -1, searchFromUtc, location, limitDays);

  if (!result) {
    throw new PanchangError(
      `No sunset found within ${limitDays} days for ` +
        `(${location.latitude}°, ${location.longitude}°) near ${searchFromUtc.toISOString()}.`,
      'NO_SUNSET'
    );
  }

  return result;
}
