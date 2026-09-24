import { dayEvents, type RiseSetBody } from './riseSet';
import { PanchangError } from '../types/errors';
import { validateDate } from '../utils/validation';
import type { GeoLocation } from '../types/location';

const DAY_MS = 86_400_000;

/** Past 2^52 ms from 1970 a float64 cannot split a millisecond, so the root refinement could never reach its tolerance. */
const MAX_SOLVABLE_MS = 2 ** 52;

/** Keyed per UTC day, always searched from that day's 00:00 UTC. The caller's search
 * start is deliberately *not* in the key: a solver refines to its own tolerance, so
 * keying on it would give one event several timestamps depending on who asked. */
type EventCache = Map<string, readonly number[]>;
const EVENT_CACHE: EventCache = new Map();
const MAX_CACHE_ENTRIES = 20_000;

export interface RiseSetKind {
  body: RiseSetBody;
}

export function canonicalDayEvents(
  kind: RiseSetKind,
  direction: 1 | -1,
  location: GeoLocation,
  dayIndex: number,
): readonly number[] {
  const elevation = location.elevation ?? 0;
  const key =
    `${kind.body}|${direction}|${location.latitude}|${location.longitude}|${elevation}|${dayIndex}`;
  const cached = EVENT_CACHE.get(key);
  if (cached !== undefined) return cached;

  const events = dayEvents(kind.body, direction, location, dayIndex);

  if (EVENT_CACHE.size >= MAX_CACHE_ENTRIES) EVENT_CACHE.clear();
  EVENT_CACHE.set(key, events);
  return events;
}

/** `clearRiseSetTracks` must keep calling this. */
export function clearRiseSetEventCache(): void {
  EVENT_CACHE.clear();
}

/** Throws `INVALID_DATE` for an Invalid Date, or before scanning a day that reaches 2^52 ms from 1970. */
export function resolveEvent(
  kind: RiseSetKind,
  direction: 1 | -1,
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number,
): Date | null {
  validateDate(searchFromUtc, 'any');
  const fromMs = searchFromUtc.getTime();
  const limitMs = fromMs + limitDays * DAY_MS;
  const startDay = Math.floor(fromMs / DAY_MS);

  for (let i = 0; i <= limitDays + 1; i++) {
    const day = startDay + i;
    if (day * DAY_MS < -MAX_SOLVABLE_MS || (day + 1) * DAY_MS > MAX_SOLVABLE_MS) {
      throw new PanchangError(
        `Date must be within 2^52 ms of 1970 for the rise and set solver, got ${searchFromUtc.toISOString()}`,
        'INVALID_DATE',
      );
    }
    for (const event of canonicalDayEvents(kind, direction, location, day)) {
      if (event >= fromMs) return event <= limitMs ? new Date(event) : null;
    }
  }
  return null;
}

