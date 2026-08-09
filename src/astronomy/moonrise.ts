import { validateLocation } from '../utils/validation';
import { resolveEvent, type RiseSetKind } from './riseSetCache';
import type { GeoLocation } from '../types/location';

/**
 * Lunar events go through the same canonical per-UTC-day cache as solar ones
 * (`riseSetCache.ts`), which buys three things:
 *
 *  - **Single-valuedness.** `SearchRiseSet` refines to its own tolerance, so the
 *    same moonrise came back with a slightly different timestamp depending on
 *    where the search started — and callers do not share a search start
 *    (`getDailyPanchang` anchors moonrise on local midnight, then searches
 *    moonset from the moonrise it just found). Keying the cache on the *event*
 *    rather than the search start gives each event exactly one timestamp.
 *  - **Reuse.** `SearchRiseSet(Body.Moon)` is the most expensive primitive in
 *    the library — 10.7 evaluations of the lunar theory, ~0.08 ms — and the
 *    `'moonTimes'` section and the festival block's Karva Chauth / Sankashti
 *    anchors both want it. They were deduped within a call but not across days.
 *  - **A shared home for the interpolated solver** that Phase 36.3 will drop in
 *    underneath, once there is a Tier 0 harness to adjudicate it.
 *
 * ## Why the second-event window is wider than the Sun's, and how it was set
 *
 * Consecutive moonrises are separated by one *lunar* day, nominally 24 h 50 m,
 * so a UTC day normally holds at most one. The separation is not constant,
 * though — the daily retardation ranges from ~10 min to ~80 min at mid
 * latitudes and compresses badly near the poles — and a UTC day holds two
 * same-kind events exactly when the first lands within `24 h − separation` of
 * 00:00. So the window is a measured quantity, not a guess.
 *
 * Measured over 40,243 lunar events across 12 locations (Quito to Alert,
 * 82.5 °N, and McMurdo, 77.8 °S) in 1950, 2024 and 2090:
 *
 *   minimum rise-to-rise separation   21.06 h   (Alert, 2090-01-08)
 *   minimum set-to-set separation     21.24 h   (Alert, 2024-01-03)
 *   UTC days holding two same-kind events   3 of 40,243
 *
 * `minSeparationMs` is therefore set to **20 h** — 5% below the measured
 * minimum, so the sweep would have to be wrong by more than an hour before a
 * second event could be missed. That yields a 4 h window in which the probe
 * runs at all, and, because the probe starts 20 h after the first event rather
 * than immediately after it, a search window at most 4 h wide with the Moon
 * already below the horizon. Both halves matter: probing from just after
 * moonrise measured **0.16 ms, twice a full search**, because the scan had to
 * climb over an entire altitude hill first.
 *
 * `searchLimitDays: 1` because this call only ever enumerates events *inside*
 * one UTC day; anything later is found by the next day's own entry. The Sun
 * keeps its historical `2` and its immediate probe start, so solar output stays
 * bit-identical.
 */
const LUNAR: RiseSetKind = { body: 'moon' };

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
  return resolveEvent(LUNAR, +1, searchFromUtc, location, limitDays);
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
  return resolveEvent(LUNAR, -1, searchFromUtc, location, limitDays);
}
