import { Body, SearchRiseSet, MakeTime, Observer } from 'astronomy-engine';
import { PanchangError } from '../types/errors';
import { validateLocation } from '../utils/validation';
import type { GeoLocation } from '../types/location';

const DAY_MS = 86_400_000;

/**
 * Canonical, cross-call cache of solar rise / set events.
 *
 * ## Why the search start had to stop being the cache key
 *
 * `SearchRiseSet` locates the first event after a given instant, and it locates
 * it to within its own refinement tolerance — so the *same* sunrise comes back
 * with a slightly different timestamp depending on where the search began.
 * Measured over 40 consecutive days at Pune, one sunrise varied by up to 109 ms
 * across search starts spanning the preceding 12 hours.
 *
 * That mattered because callers do not share a search start.
 * `getDailyPanchang` anchors on local midnight, while `computeDayFestivals`
 * re-derives the neighbouring days' sunrise and sunset from offsets against the
 * current day's sunrise — so a single day-panchang issued nine `SearchRiseSet`
 * calls for what are only five distinct events, and the day-before sunrise it
 * computed was not bit-identical to the value the previous day's own call had
 * already produced. Memoizing on the search start would therefore have cached
 * almost nothing; memoizing on the *event* had to come first.
 *
 * ## What is cached
 *
 * The events of one UTC day, for one observer, always searched from that day's
 * 00:00 UTC. The key is `(direction, latitude, longitude, elevation, dayIndex)`
 * — every component a pure function of the request — so an event has exactly
 * one timestamp no matter which caller asks for it or in what order. Resolving
 * "first event at or after `t`" then walks canonical days forward from `t`'s
 * own day, which returns precisely what an uncached search from `t` would have
 * returned, minus the search-start jitter.
 *
 * This removes an existing inconsistency rather than introducing an
 * approximation, but it is not output-neutral: published sunrise moves by up to
 * the jitter quoted above, and the day-proportional windows derived from it
 * (varjyam, bhadra) move further.
 */
type EventCache = Map<string, readonly number[]>;
const EVENT_CACHE: EventCache = new Map();
/** Bounded so a long-running process cannot grow it without limit. */
const MAX_CACHE_ENTRIES = 20_000;

/**
 * Two solar events of the same kind fall ~24 h apart, so a UTC day can contain
 * two of them only when the first lands within minutes of 00:00. Probing for a
 * second event is worth it only in that narrow case.
 */
const SECOND_EVENT_WINDOW_MS = 45 * 60_000;

/** Every event of the given kind within UTC day `dayIndex`, ascending. */
function canonicalDayEvents(
  direction: 1 | -1,
  location: GeoLocation,
  dayIndex: number,
): readonly number[] {
  const elevation = location.elevation ?? 0;
  const key = `${direction}|${location.latitude}|${location.longitude}|${elevation}|${dayIndex}`;
  const cached = EVENT_CACHE.get(key);
  if (cached !== undefined) return cached;

  const dayStart = dayIndex * DAY_MS;
  const dayEnd = dayStart + DAY_MS;
  const observer = new Observer(location.latitude, location.longitude, elevation);

  const events: number[] = [];
  const first = SearchRiseSet(Body.Sun, observer, direction, MakeTime(new Date(dayStart)), 2);
  if (first) {
    const firstMs = first.date.getTime();
    if (firstMs < dayEnd) {
      events.push(firstMs);
      if (firstMs - dayStart < SECOND_EVENT_WINDOW_MS) {
        const second = SearchRiseSet(
          Body.Sun, observer, direction, MakeTime(new Date(firstMs + 1000)), 2,
        );
        if (second && second.date.getTime() < dayEnd) events.push(second.date.getTime());
      }
    }
  }

  if (EVENT_CACHE.size >= MAX_CACHE_ENTRIES) EVENT_CACHE.clear();
  EVENT_CACHE.set(key, events);
  return events;
}

/** First event of the given kind at or after `searchFromUtc`, within `limitDays`. */
function resolveEvent(
  direction: 1 | -1,
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number,
): Date | null {
  const fromMs = searchFromUtc.getTime();
  const limitMs = fromMs + limitDays * DAY_MS;
  const startDay = Math.floor(fromMs / DAY_MS);

  for (let i = 0; i <= limitDays + 1; i++) {
    for (const event of canonicalDayEvents(direction, location, startDay + i)) {
      if (event >= fromMs) return event <= limitMs ? new Date(event) : null;
    }
  }
  return null;
}

/**
 * Compute sunrise nearest to (and after) the given UTC search start.
 *
 * @param searchFromUtc  Start searching from this UTC instant.
 *                       For daily mode, this is local midnight converted to UTC.
 * @param location       Observer coordinates.
 * @param limitDays      How far ahead to search. Default 2 (handles polar edge cases).
 * @returns              Sunrise as a UTC Date.
 * @throws PanchangError (NO_SUNRISE) for polar regions with no sunrise.
 *
 * @example
 * ```typescript
 * import { getSunrise } from 'panchang-ts';
 * const sunrise = getSunrise(
 *   new Date('2025-01-14T00:00:00Z'),
 *   { latitude: 28.6139, longitude: 77.209 },   // Delhi
 * );
 * // sunrise.toISOString() ≈ "2025-01-14T01:45:00.000Z" (07:15 IST)
 * ```
 */
export function computeSunrise(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2
): Date {
  validateLocation(location);
  const result = resolveEvent(+1, searchFromUtc, location, limitDays);

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

/**
 * Compute sunset nearest to (and after) the given UTC search start.
 *
 * @param searchFromUtc  Start searching from this UTC instant (typically sunrise).
 * @param location       Observer coordinates.
 * @param limitDays      How far ahead to search. Default 2.
 * @returns              Sunset as a UTC Date.
 * @throws PanchangError (NO_SUNSET) for polar regions with no sunset.
 *
 * @example
 * ```typescript
 * import { getSunrise, getSunset } from 'panchang-ts';
 * const loc = { latitude: 28.6139, longitude: 77.209 };
 * const sunrise = getSunrise(new Date('2025-01-14T00:00:00Z'), loc);
 * const sunset  = getSunset(sunrise, loc);
 * ```
 */
export function computeSunset(
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number = 2
): Date {
  validateLocation(location);
  const result = resolveEvent(-1, searchFromUtc, location, limitDays);

  if (!result) {
    throw new PanchangError(
      `No sunset found within ${limitDays} days for ` +
        `(${location.latitude}°, ${location.longitude}°) near ${searchFromUtc.toISOString()}.`,
      'NO_SUNSET'
    );
  }

  return result;
}
