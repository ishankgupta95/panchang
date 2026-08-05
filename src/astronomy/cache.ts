import { getSiderealMoonLongitude } from './moon';
import { getSiderealSunLongitude } from './sun';
import type { AyanamsaType } from '../types/options';

/**
 * Per-call memo for sidereal Sun / Moon longitudes.
 *
 * ## Why this memoizes on the exact instant
 *
 * This cache used to key on a 60-second bucket while storing the longitude
 * computed at *the first exact instant that happened to land in that bucket*.
 * That made a cached value depend on the order in which callers asked for it,
 * with two consequences that were both worse than the work it saved:
 *
 *  - **Outputs moved when unrelated code changed.** Any refactor that added or
 *    removed an ephemeris read — skipping an eclipse search, seeding a new-moon
 *    window differently — reseeded buckets from different instants and shifted
 *    published transition times by up to ~63 s.
 *  - **The transition search was bisecting a staircase.** `findTransitionTime`
 *    reads through this memo, so with 60-second bins the index function it
 *    searches is piecewise constant. Tightening the search tolerance located
 *    the *bin edge* more precisely, not the transition: `precision: 'high'`
 *    landed 98% of its results within 1 s of a bin edge while its actual error
 *    stayed ~20 s.
 *
 * Keying on the exact instant makes the memo a pure function of its argument,
 * which restores both properties: identical inputs give identical outputs
 * regardless of call order, and the searched function is continuous, so the
 * search tolerance is the only thing bounding the result.
 *
 * Measured effect of the change: mean error against an exact uncached bisection
 * fell from 20.5 s to 8.3 s (and, with the tight search tolerance that the
 * since-removed `precision: 'high'` option selected, from 19.5 s to 0.9 s),
 * showing the memo — not the tolerance — had been the binding constraint;
 * mean drift against DrikPanchang improved from 32.29 s to
 * 31.10 s (11 of 52 measurements better, 7 worse, 34 unchanged) and worst-case
 * drift from 146.5 s to 130.6 s; narrowing `options.sections` became exactly
 * output-neutral. The cost is ~14% on a default `getDailyPanchang`, because
 * bisection probes no longer collide in the final iterations.
 *
 * Bucketing was never buying much: a binary search over a 36 h window only
 * produces probes within 60 s of each other in its last couple of iterations.
 * The memo's real value is repeated reads of the *same* anchors — sunrise,
 * sunset and the kala boundaries are each read by the tithi, nakshatra, yoga
 * and karana blocks independently — and those are exact-instant repeats.
 */
export class LongitudeCache {
  private moonCache = new Map<number, number>();
  private sunCache = new Map<number, number>();
  private readonly ayanamsaType: AyanamsaType;

  public hits = 0;
  public misses = 0;

  constructor(ayanamsaType: AyanamsaType) {
    this.ayanamsaType = ayanamsaType;
  }

  getMoon(date: Date): number {
    const key = date.getTime();
    const cached = this.moonCache.get(key);
    if (cached !== undefined) {
      this.hits++;
      return cached;
    }
    this.misses++;
    const lon = getSiderealMoonLongitude(date, this.ayanamsaType);
    this.moonCache.set(key, lon);
    return lon;
  }

  getSun(date: Date): number {
    const key = date.getTime();
    const cached = this.sunCache.get(key);
    if (cached !== undefined) {
      this.hits++;
      return cached;
    }
    this.misses++;
    const lon = getSiderealSunLongitude(date, this.ayanamsaType);
    this.sunCache.set(key, lon);
    return lon;
  }

  get size(): number {
    return this.moonCache.size + this.sunCache.size;
  }
}
