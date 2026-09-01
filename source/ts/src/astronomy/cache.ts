import { getSiderealMoonLongitude, getTropicalMoonLongitude } from './moon';
import { getSiderealSunLongitude, getTropicalSunLongitude } from './sun';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

/** Both modes must stay pure functions of the instant: a key coarser than
 * `floor(t / BLOCK)`, or a mode chosen adaptively mid-call, makes output depend on
 * call order and leaves `findTransitionTime` bisecting a staircase. Blocks are keyed
 * on UTC, so a fit spanning a leap second can be off by that second. */
export type LongitudeCacheMode = 'exact' | 'interpolated';

const DAY_MS = 86_400_000;

const MOON_BLOCK_MS = 4 * DAY_MS;
const MOON_NODES = 10;
const SUN_BLOCK_MS = 8 * DAY_MS;
const SUN_NODES = 8;

/** `cos(πk / (n-1))`, frozen to V8's values rather than computed: a platform cosine here
 * disagrees by an ULP at k=2 of the Moon's grid, and this grid feeds every interpolated
 * longitude, so the Go port could not match it off the host that pinned the goldens. */
const CHEBYSHEV_ABSCISSAE: Record<number, readonly number[]> = {
  [MOON_NODES]: [
    1, 0.9396926207859084, 0.766044443118978, 0.5000000000000001, 0.17364817766693041,
    -0.1736481776669303, -0.4999999999999998, -0.7660444431189779, -0.9396926207859083, -1,
  ],
  [SUN_NODES]: [
    1, 0.9009688679024191, 0.6234898018587336, 0.22252093395631445, -0.22252093395631434,
    -0.6234898018587335, -0.900968867902419, -1,
  ],
};

function chebyshevAbscissa(k: number, nodes: number): number {
  return CHEBYSHEV_ABSCISSAE[nodes]?.[k] ?? Math.cos((Math.PI * k) / (nodes - 1));
}

/** Nodes hold *tropical* longitude, unwrapped against their predecessor so the fit
 * stays continuous across the 360° seam; the ayanamsa is applied per read afterwards. */
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
      const x = chebyshevAbscissa(k, nodes);
      this.nodeX[k] = x;

      let y = tropicalAt(this.midMs + this.halfMs * x);
      if (k > 0) {
        while (y - previous > 180) y -= 360;
        while (y - previous < -180) y += 360;
      }
      this.nodeY[k] = y;
      previous = y;

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
      if (dx === 0) return y;
      const q = (weight[k] as number) / dx;
      numerator += q * y;
      denominator += q;
    }
    return numerator / denominator;
  }
}

/** Module scope, not per instance: a block is a pure function of its index and holds
 * *tropical* longitudes, so sharing it across instances and ayanamsa systems changes
 * which call builds a block, never its contents. */
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

  private moonCache = new Map<number, number>();
  private sunCache = new Map<number, number>();
  /** Memoized separately rather than derived by re-adding the ayanamsa to a sidereal
   * hit: normalizing twice around the 360° seam is not the identity in floating point. */
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

  /** For consumers whose quantity is a Moon−Sun difference, where the ayanamsa cancels. */
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
