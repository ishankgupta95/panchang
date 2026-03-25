import { Body, SearchRiseSet, MakeTime, Observer } from 'astronomy-engine';
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
 */
export function getMoonrise(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2,
): Date | null {
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
 */
export function getMoonset(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2,
): Date | null {
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0,
  );
  const astroTime = MakeTime(searchFromUtc);
  const result = SearchRiseSet(Body.Moon, observer, -1, astroTime, limitDays);
  return result ? result.date : null;
}
