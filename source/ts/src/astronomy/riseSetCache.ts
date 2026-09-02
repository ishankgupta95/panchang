import { dayEvents, type RiseSetBody } from './riseSet';
import type { GeoLocation } from '../types/location';

const DAY_MS = 86_400_000;

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

export function resolveEvent(
  kind: RiseSetKind,
  direction: 1 | -1,
  searchFromUtc: Date,
  location: GeoLocation,
  limitDays: number,
): Date | null {
  const fromMs = searchFromUtc.getTime();
  const limitMs = fromMs + limitDays * DAY_MS;
  const startDay = Math.floor(fromMs / DAY_MS);

  for (let i = 0; i <= limitDays + 1; i++) {
    for (const event of canonicalDayEvents(kind, direction, location, startDay + i)) {
      if (event >= fromMs) return event <= limitMs ? new Date(event) : null;
    }
  }
  return null;
}

