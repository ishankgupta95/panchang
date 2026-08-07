import { dayEvents, type RiseSetBody } from './riseSet';
import type { GeoLocation } from '../types/location';

const DAY_MS = 86_400_000;

/**
 * Canonical, cross-call cache of rise / set events, shared by the solar and
 * lunar wrappers.
 *
 * ## Why the search start had to stop being the cache key
 *
 * `SearchRiseSet` locates the first event after a given instant, and it locates
 * it to within its own refinement tolerance — so the *same* event comes back
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
 * 00:00 UTC. The key is `(body, direction, latitude, longitude, elevation,
 * dayIndex)` — every component a pure function of the request — so an event has
 * exactly one timestamp no matter which caller asks for it or in what order.
 * Resolving "first event at or after `t`" then walks canonical days forward from
 * `t`'s own day, which returns precisely what an uncached search from `t` would
 * have returned, minus the search-start jitter.
 *
 * This removes an existing inconsistency rather than introducing an
 * approximation, but it is not output-neutral: a published event moves by up to
 * the jitter quoted above, and the day-proportional windows derived from it move
 * further.
 */
type EventCache = Map<string, readonly number[]>;
const EVENT_CACHE: EventCache = new Map();
/** Bounded so a long-running process cannot grow it without limit. */
const MAX_CACHE_ENTRIES = 20_000;

/**
 * Which body's events are being enumerated.
 *
 * ## What used to live here, and why it does not any more
 *
 * This interface previously also carried `searchLimitDays`, `minSeparationMs`
 * and `secondProbeStart` — three parameters that existed entirely to work
 * around `SearchRiseSet`'s shape. It found *the next* event after an instant,
 * so a day's second event had to be hunted with a follow-up probe, and where
 * that probe started mattered enormously: measured at Pune, starting it one
 * second after the first event cost **0.16 ms, twice a complete search**,
 * because the body had just risen and the ascent finder had to bisect a whole
 * altitude hill looking for a hidden dip.
 *
 * Phase 36.3's solver enumerates a whole UTC day in one pass, so "a day's
 * second event" is not a special case and there is no probe to place. The
 * parameters are gone rather than defaulted, because a knob nobody turns is
 * still a knob somebody has to read.
 */
export interface RiseSetKind {
  body: RiseSetBody;
}

/** Every event of the given kind within UTC day `dayIndex`, ascending. */
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

/** First event of the given kind at or after `searchFromUtc`, within `limitDays`. */
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

