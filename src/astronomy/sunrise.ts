import { Body, SearchRiseSet, MakeTime, Observer } from 'astronomy-engine';
import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';

/**
 * Compute sunrise nearest to (and after) the given UTC search start.
 *
 * @param searchFromUtc  Start searching from this UTC instant.
 *                       For daily mode, this is local midnight converted to UTC.
 * @param location       Observer coordinates.
 * @param limitDays      How far ahead to search. Default 2 (handles polar edge cases).
 * @returns              Sunrise as a UTC Date.
 * @throws PanchangError (NO_SUNRISE) for polar regions with no sunrise.
 */
export function computeSunrise(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2
): Date {
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0
  );
  const astroTime = MakeTime(searchFromUtc);
  const result = SearchRiseSet(Body.Sun, observer, +1, astroTime, limitDays);

  if (!result) {
    throw new PanchangError(
      `No sunrise found within ${limitDays} days for ` +
        `(${location.latitude}°, ${location.longitude}°) near ${searchFromUtc.toISOString()}. ` +
        `This location may be experiencing midnight sun or polar night.`,
      'NO_SUNRISE'
    );
  }

  return result.date;
}

/**
 * Compute sunset nearest to (and after) the given UTC search start.
 */
export function computeSunset(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2
): Date {
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0
  );
  const astroTime = MakeTime(searchFromUtc);
  const result = SearchRiseSet(Body.Sun, observer, -1, astroTime, limitDays);

  if (!result) {
    throw new PanchangError(
      `No sunset found within ${limitDays} days for ` +
        `(${location.latitude}°, ${location.longitude}°) near ${searchFromUtc.toISOString()}.`,
      'NO_SUNSET'
    );
  }

  return result.date;
}
