import { getSiderealMoonLongitude, getTropicalMoonLongitude } from './moon';
import { getSiderealSunLongitude, getTropicalSunLongitude } from './sun';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

/**
 * Per-call memo for sidereal Sun / Moon longitudes, in one of two modes.
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
 * output-neutral.
 *
 * ## Why there is a second, interpolating mode
 *
 * Exact memoization only helps when callers repeat an instant, and the element
 * end-time searches almost never do: a default `getDailyPanchang` issued 81
 * `GeoMoon` and 52 `SunPosition` evaluations, of which all but four existed to
 * serve `findTransitionTime`. The secant solve is already frugal in *probes*
 * (~5 against bisection's 13) — what it is not frugal in is ephemeris cost per
 * probe, because each one re-runs the full ELP/VSOP87 series.
 *
 * `'interpolated'` mode replaces per-instant evaluation with a Chebyshev
 * interpolant over a fixed UTC block: sample the tropical longitude at
 * {@link MOON_NODES}/{@link SUN_NODES} nodes once, then answer every probe in
 * that block from the polynomial. The block containing an instant is
 * `floor(t / BLOCK)`, a pure function of the instant, so the order-independence
 * established above is preserved — unlike the 60-second bins, an interpolant is
 * not seeded by whichever caller happened to arrive first.
 *
 * Node counts were chosen so interpolation error sits at astronomy-engine's own
 * resolution floor. Max error over five epochs, expressed as the time error it
 * implies at each body's mean rate:
 *
 *   Moon, 4-day block, 10 nodes → 1.3 ms      Sun, 8-day block, 8 nodes → 0.9 ms
 *
 * Both are at the floor: adding nodes does not reduce them, because what is
 * left is astronomy-engine's own rounding rather than the fit. For scale, the
 * secant solve's own accuracy is mean 11 ms / worst 24 ms, and mean drift
 * against DrikPanchang is 17.4 s.
 *
 * Measured end-to-end over 2,190 day-panchangs (six locations × all of 2025):
 * zero differences in any name, index, boolean or festival; date fields moved
 * by mean 16.4 ms and at most 26 ms — the latter being the 25 ms forward-walk
 * step in `secantBoundary` landing one step differently, not fit error.
 *
 * ## Why the mode is chosen by the caller rather than adaptively
 *
 * Building a block costs 10 Moon + 8 Sun evaluations up front, which is a net
 * *loss* on callers that read only a handful of longitudes: with
 * `computeEndTimes: false` and no optional sections, a day needs 1 `GeoMoon`
 * and 3 `SunPosition` in total. Switching mode part-way through a call on a
 * usage heuristic would reintroduce exactly the order-dependence documented
 * above, so instead the caller states which regime it is in, once, at
 * construction. `'exact'` is the default and is byte-identical to the behaviour
 * this class has always had.
 */
export type LongitudeCacheMode = 'exact' | 'interpolated';

const DAY_MS = 86_400_000;

/** Block span and node count for the Moon in `'interpolated'` mode. */
const MOON_BLOCK_MS = 4 * DAY_MS;
const MOON_NODES = 10;
/** Block span and node count for the Sun in `'interpolated'` mode. */
const SUN_BLOCK_MS = 8 * DAY_MS;
const SUN_NODES = 8;

/**
 * Chebyshev interpolant of a longitude over `[t0, t1]`, evaluated by the
 * barycentric formula.
 *
 * Nodes are sampled in tropical longitude and unwrapped against their
 * predecessor, so the fitted series stays continuous across the 360° seam; the
 * ayanamsa is applied afterwards, per read, since it is a cheap polynomial.
 */
class ChebyshevLongitude {
  private readonly nodeX: Float64Array;
  private readonly nodeY: Float64Array;
  private readonly weight: Float64Array;
  private readonly midMs: number;
  private readonly halfMs: number;

  constructor(tropicalAt: (ms: number) => number, t0Ms: number, t1Ms: number, nodes: number) {
    this.midMs = (t0Ms + t1Ms) / 2;
    this.halfMs = (t1Ms - t0Ms) / 2;
    this.nodeX = new Float64Array(nodes);
    this.nodeY = new Float64Array(nodes);
    this.weight = new Float64Array(nodes);

    let previous = 0;
    for (let k = 0; k < nodes; k++) {
      const x = Math.cos((Math.PI * k) / (nodes - 1));
      this.nodeX[k] = x;

      let y = tropicalAt(this.midMs + this.halfMs * x);
      if (k > 0) {
        while (y - previous > 180) y -= 360;
        while (y - previous < -180) y += 360;
      }
      this.nodeY[k] = y;
      previous = y;

      // Barycentric weights for Chebyshev points of the second kind.
      this.weight[k] = (k === 0 || k === nodes - 1 ? 0.5 : 1) * (k % 2 ? -1 : 1);
    }
  }

  at(ms: number): number {
    const x = (ms - this.midMs) / this.halfMs;
    const nodeX = this.nodeX;
    const nodeY = this.nodeY;
    const weight = this.weight;

    let numerator = 0;
    let denominator = 0;
    for (let k = 0; k < nodeX.length; k++) {
      const y = nodeY[k] as number;
      const dx = x - (nodeX[k] as number);
      // Landing exactly on a node divides by zero; the node value is the answer.
      if (dx === 0) return y;
      const q = (weight[k] as number) / dx;
      numerator += q * y;
      denominator += q;
    }
    return numerator / denominator;
  }
}

/**
 * Interpolation blocks live at module scope, not on the cache instance.
 *
 * `LongitudeCache` is constructed once per `getDailyPanchang`, so an instance-
 * level block map dies with the call: a calendar scan rebuilt the 4-day Moon and
 * 8-day Sun blocks *every day*, paying 10 Moon + 8 Sun evaluations to serve one
 * day and then discarding them. Measured over a 365-day scan that was 21.5
 * `GeoMoon` and 29.1 `SunPosition` per day, against 6.5 and 5.1 when the blocks
 * are shared.
 *
 * Sharing is sound for the same reason the per-instant memo is: a block is
 * `ChebyshevLongitude` fitted over `[blockIndex·SPAN, (blockIndex+1)·SPAN]`, so
 * it is a pure function of its block index and nothing else. In particular the
 * nodes hold **tropical** longitudes — the ayanamsa is applied per read — so a
 * block is also independent of the ayanamsa system and is shared across them.
 * Sharing changes only *which call builds* a block, never its contents, so the
 * order-independence documented above is preserved exactly.
 *
 * Bounded with the same clear-on-overflow policy `EVENT_CACHE` uses in
 * `sunrise.ts`: a long-running process must not grow these without limit. At
 * the cap the resident set is ~11 years of Moon blocks and ~22 years of Sun
 * blocks (~0.9 MB), which covers any calendar view; the multi-century
 * `build*Table` scans stream forward, so the handful of clears they trigger cost
 * one block rebuild each.
 */
const MAX_BLOCKS = 1024;
const MOON_BLOCK_STORE = new Map<number, ChebyshevLongitude>();
const SUN_BLOCK_STORE = new Map<number, ChebyshevLongitude>();

function blockFor(
  store: Map<number, ChebyshevLongitude>,
  index: number,
  spanMs: number,
  nodes: number,
  tropicalAt: (ms: number) => number,
): { interpolant: ChebyshevLongitude; built: boolean } {
  const existing = store.get(index);
  if (existing !== undefined) return { interpolant: existing, built: false };

  const interpolant = new ChebyshevLongitude(
    tropicalAt, index * spanMs, (index + 1) * spanMs, nodes,
  );
  if (store.size >= MAX_BLOCKS) store.clear();
  store.set(index, interpolant);
  return { interpolant, built: true };
}


export class LongitudeCache {
  private readonly ayanamsaType: AyanamsaType;
  private readonly mode: LongitudeCacheMode;

  /** `'exact'` mode: longitude per exact instant. */
  private moonCache = new Map<number, number>();
  private sunCache = new Map<number, number>();
  /**
   * `'exact'` mode, tropical reads. Kept separate from the sidereal maps rather
   * than derived by re-adding the ayanamsa: `sidereal` is
   * `normalize360(tropical − ayanamsa)`, and normalizing twice around the 360°
   * seam is not the identity in floating point. A distinct memo keeps the
   * tropical accessors bit-exact against {@link getTropicalMoonLongitude}.
   */
  private moonTropicalCache = new Map<number, number>();
  private sunTropicalCache = new Map<number, number>();

  public hits = 0;
  public misses = 0;

  constructor(ayanamsaType: AyanamsaType, mode: LongitudeCacheMode = 'exact') {
    this.ayanamsaType = ayanamsaType;
    this.mode = mode;
  }

  getMoon(date: Date): number {
    if (this.mode === 'exact') {
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

    const ms = date.getTime();
    const { interpolant, built } = blockFor(
      MOON_BLOCK_STORE, Math.floor(ms / MOON_BLOCK_MS), MOON_BLOCK_MS, MOON_NODES,
      (t) => getTropicalMoonLongitude(new Date(t)),
    );
    if (built) this.misses++; else this.hits++;
    return normalize360(interpolant.at(ms) - computeAyanamsa(date, this.ayanamsaType));
  }

  getSun(date: Date): number {
    if (this.mode === 'exact') {
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

    const ms = date.getTime();
    const { interpolant, built } = blockFor(
      SUN_BLOCK_STORE, Math.floor(ms / SUN_BLOCK_MS), SUN_BLOCK_MS, SUN_NODES,
      (t) => getTropicalSunLongitude(new Date(t)),
    );
    if (built) this.misses++; else this.hits++;
    return normalize360(interpolant.at(ms) - computeAyanamsa(date, this.ayanamsaType));
  }

  /**
   * Tropical longitude of the Moon, through the same cache the sidereal reads
   * use.
   *
   * Exists for consumers whose quantity is a Moon−Sun *difference*, where the
   * ayanamsa cancels — the eclipse syzygy guard being the one in-tree caller.
   * Going through the cache is what matters: the guard costs four evaluations
   * to skip a search costing hundreds, but before this those four were full
   * ELP/VSOP87 runs, so `sections: ['eclipse']` paid the same per-day ephemeris
   * bill as a full panchang.
   */
  getTropicalMoon(date: Date): number {
    if (this.mode === 'exact') {
      const key = date.getTime();
      const cached = this.moonTropicalCache.get(key);
      if (cached !== undefined) {
        this.hits++;
        return cached;
      }
      this.misses++;
      const lon = getTropicalMoonLongitude(date);
      this.moonTropicalCache.set(key, lon);
      return lon;
    }

    const ms = date.getTime();
    const { interpolant, built } = blockFor(
      MOON_BLOCK_STORE, Math.floor(ms / MOON_BLOCK_MS), MOON_BLOCK_MS, MOON_NODES,
      (t) => getTropicalMoonLongitude(new Date(t)),
    );
    if (built) this.misses++; else this.hits++;
    return normalize360(interpolant.at(ms));
  }

  /** Tropical longitude of the Sun. See {@link getTropicalMoon}. */
  getTropicalSun(date: Date): number {
    if (this.mode === 'exact') {
      const key = date.getTime();
      const cached = this.sunTropicalCache.get(key);
      if (cached !== undefined) {
        this.hits++;
        return cached;
      }
      this.misses++;
      const lon = getTropicalSunLongitude(date);
      this.sunTropicalCache.set(key, lon);
      return lon;
    }

    const ms = date.getTime();
    const { interpolant, built } = blockFor(
      SUN_BLOCK_STORE, Math.floor(ms / SUN_BLOCK_MS), SUN_BLOCK_MS, SUN_NODES,
      (t) => getTropicalSunLongitude(new Date(t)),
    );
    if (built) this.misses++; else this.hits++;
    return normalize360(interpolant.at(ms));
  }

  get size(): number {
    return (
      this.moonCache.size + this.sunCache.size +
      this.moonTropicalCache.size + this.sunTropicalCache.size +
      MOON_BLOCK_STORE.size + SUN_BLOCK_STORE.size
    );
  }
}
