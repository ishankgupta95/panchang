import { Body, SearchRiseSet, MakeTime, Observer } from 'astronomy-engine';
import { validateLocation } from '../utils/validation';
import type { GeoLocation } from '../types/location';

/**
 * Search for the next moonrise on or after the given UTC instant.
 *
 * Unlike sunrise, the Moon can have no rise on a given calendar day —
 * this function returns `null` in that case rather than throwing.
 *
 * @param searchFromUtc  Start searching from this UTC instant.
 * @param location       Observer coordinates.
 * @param limitDays      How far ahead to search. Default 2.
 * @returns              Moonrise as a UTC Date, or `null` if none found.
 *
 * @example
 * ```typescript
 * import { getMoonrise } from 'panchang-ts';
 * const mr = getMoonrise(
 *   new Date('2025-01-14T00:00:00Z'),
 *   { latitude: 28.6139, longitude: 77.209 },   // Delhi
 * );
 * // mr may be null on days where the Moon does not rise
 * ```
 */
export function getMoonrise(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2,
): Date | null {
  validateLocation(location);
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0,
  );
  const astroTime = MakeTime(searchFromUtc);
  const result = SearchRiseSet(Body.Moon, observer, +1, astroTime, limitDays);
  return result ? result.date : null;
}

/**
 * Search for the next moonset on or after the given UTC instant.
 *
 * Returns `null` if no moonset is found within the search window.
 *
 * @param searchFromUtc  Start searching from this UTC instant.
 * @param location       Observer coordinates.
 * @param limitDays      How far ahead to search. Default 2.
 * @returns              Moonset as a UTC Date, or `null` if none found.
 *
 * @example
 * ```typescript
 * import { getMoonrise, getMoonset } from 'panchang-ts';
 * const loc = { latitude: 28.6139, longitude: 77.209 };
 * const mr = getMoonrise(new Date('2025-01-14T00:00:00Z'), loc);
 * const ms = mr ? getMoonset(mr, loc) : null;
 * ```
 */
export function getMoonset(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2,
): Date | null {
  validateLocation(location);
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0,
  );
  const astroTime = MakeTime(searchFromUtc);
  const result = SearchRiseSet(Body.Moon, observer, -1, astroTime, limitDays);
  return result ? result.date : null;
}
