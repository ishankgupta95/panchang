/**
 * VSOP87D evaluation — heliocentric spherical coordinates for the Earth and
 * Mercury–Saturn, referred to the mean dynamical ecliptic and equinox of date.
 *
 * The series themselves are generated: see `series/vsop87d.ts` and
 * `notes/ephemeris-generate.src.ts`. This file is only the evaluator, and it is
 * the "fast third" of §36.0 H's *correct first, frozen second, fast third* —
 * the untruncated version it is checked against lives in
 * `tests/reference/ephemeris-reference.ts`.
 *
 * ## The flat-array layout, and why
 *
 * Each series is one `Float64Array` with stride 4: `A, B, C, power`. A term is
 * `A · τ^power · cos(B + C·τ)`. VSOP87 publishes its sub-series grouped by
 * power of τ, and the obvious transcription is a nested array per power; that
 * costs a bounds-checked pointer chase per group and defeats the engine's
 * ability to keep the loop in registers. Flattening moves `power` into the term
 * and makes the whole evaluation one linear scan over contiguous doubles.
 *
 * τ is Julian **millennia** of TT from J2000.0 — VSOP87's own argument, kept
 * rather than rescaled to centuries so that `B` and `C` match the published
 * catalogue line for line and a reader can spot-check one against VizieR.
 *
 * The cosine is `trig.ts`'s rather than `Math.cos`, for the reasons that module
 * states: `Math.cos` pays for a reduction range these arguments never approach,
 * and it is not identical across JavaScript engines.
 */
import { cos } from './trig';
import {
  EAR_L, EAR_B, EAR_R, EAR_R_COARSE, EAR_L_PRECISE, EAR_B_PRECISE,
  MER_L, MER_B, MER_R,
  VEN_L, VEN_B, VEN_R,
  MAR_L, MAR_B, MAR_R,
  JUP_L, JUP_B, JUP_R,
  SAT_L, SAT_B, SAT_R,
} from './series/vsop87d';

/** The bodies whose VSOP87D series this library carries. */
export type VsopBody = 'earth' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

const SERIES: Record<VsopBody, readonly [Float64Array, Float64Array, Float64Array]> = {
  earth: [EAR_L, EAR_B, EAR_R],
  mercury: [MER_L, MER_B, MER_R],
  venus: [VEN_L, VEN_B, VEN_R],
  mars: [MAR_L, MAR_B, MAR_R],
  jupiter: [JUP_L, JUP_B, JUP_R],
  saturn: [SAT_L, SAT_B, SAT_R],
};

/** Sum one flattened VSOP87 series at τ. */
export function evaluateVsop(series: Float64Array, tau: number): number {
  const tau2 = tau * tau;
  const tau3 = tau2 * tau;
  let sum = 0;
  for (let i = 0; i < series.length; i += 4) {
    const value = (series[i] as number) * cos((series[i + 1] as number) + (series[i + 2] as number) * tau);
    switch (series[i + 3]) {
      case 0: sum += value; break;
      case 1: sum += value * tau; break;
      case 2: sum += value * tau2; break;
      case 3: sum += value * tau3; break;
      default: sum += value * tau ** (series[i + 3] as number);
    }
  }
  return sum;
}

/** Julian millennia of TT from J2000.0, from days. */
export const millennia = (ttDays: number): number => ttDays / 365250;

/**
 * Heliocentric longitude, radians. `ttDays` is days of Terrestrial Time from
 * J2000.0 — see `deltaT.ts` for why that is the primitive rather than a Julian
 * Date.
 */
export function heliocentricLongitude(body: VsopBody, ttDays: number): number {
  return evaluateVsop(SERIES[body][0], millennia(ttDays));
}

/** Heliocentric latitude, radians. */
export function heliocentricLatitude(body: VsopBody, ttDays: number): number {
  return evaluateVsop(SERIES[body][1], millennia(ttDays));
}

/** Heliocentric radius, AU. */
export function heliocentricRadius(body: VsopBody, ttDays: number): number {
  return evaluateVsop(SERIES[body][2], millennia(ttDays));
}

/**
 * Earth's heliocentric radius to 8 × 10⁻⁵ AU, from four terms instead of
 * sixty-nine.
 *
 * Enough, and only enough, for the Sun's light-time: 1e-4 AU of radius is
 * 0.05 s of retardation and 0.002″ of longitude, a fiftieth of the solar
 * truncation budget. Same reasoning as `elp.ts`'s coarse lunar distance, and it
 * matters for the same reason — the sankranti scan reads one solar longitude
 * per day for a year and nothing else.
 */
export function earthRadiusCoarse(ttDays: number): number {
  return evaluateVsop(EAR_R_COARSE, millennia(ttDays));
}

/**
 * Heliocentric rectangular coordinates, AU, in the mean ecliptic and equinox of
 * date. Written into `out` so the geocentric planet path — which evaluates the
 * Earth and the planet while the light-time iterates — allocates nothing.
 */
export function heliocentricRect(body: VsopBody, ttDays: number, out: Float64Array): void {
  const tau = millennia(ttDays);
  const series = SERIES[body];
  const lon = evaluateVsop(series[0], tau);
  const lat = evaluateVsop(series[1], tau);
  const r = evaluateVsop(series[2], tau);
  const cosLat = r * Math.cos(lat);
  out[0] = cosLat * Math.cos(lon);
  out[1] = cosLat * Math.sin(lon);
  out[2] = r * Math.sin(lat);
}

/**
 * Number of distinct epochs {@link earthRect} remembers.
 *
 * A birth chart asks for five planets, each at three epochs: `t`, and `t ± 1 h`
 * for the retrograde probes. So there are exactly **three** distinct Earth
 * epochs behind fifteen `getPlanetPosition` calls, and they interleave — planet
 * by planet, not epoch by epoch — which is why this is a small map rather than
 * the single-entry memo `nutation()` uses. A one-entry memo would miss on every
 * call.
 */
const EARTH_MEMO_SIZE = 4;
const earthMemoKey = new Float64Array(EARTH_MEMO_SIZE).fill(Number.NaN);
const earthMemoValue = new Float64Array(EARTH_MEMO_SIZE * 3);
let earthMemoNext = 0;

/**
 * Earth's heliocentric rectangular position **for the planet path**, memoized on
 * the **exact** `ttDays`.
 *
 * ## Why this reads a different Earth series than `sun.ts` does
 *
 * The Sun's geocentric direction *is* the Earth's heliocentric direction
 * reflected, so an error δ in the latter is an error δ in the former. A planet's
 * is `planet − Earth`, and subtracting a vector of length ~1 AU from one of
 * length Δ turns the same δ into `δ · r_E / Δ` — 1.4″ at Venus for 0.38″ at the
 * Earth, which is larger than Venus's *own* truncation budget.
 *
 * That coupling is invisible to a per-body error budget, and it is how it was
 * found: raising the Earth's budget from 0.1″ to 0.4″ for the Sun's sake
 * degraded Mercury from 0.327″ to 0.499″ and Venus from 0.824″ to 1.217″ with
 * their own budgets untouched. So the generator emits the Earth's angular series
 * twice — coarse for `sun.ts`, where the Earth is the answer, and
 * {@link EAR_L_PRECISE}/{@link EAR_B_PRECISE} at ≤0.1″ here, where it is a
 * subtrahend. `EAR_R` is shared: a radius error does not divide by Δ.
 *
 * ## Why the memo
 *
 * Keyed on bitwise equality of the argument and nothing else — no bucketing, no
 * tolerance, no dependence on which caller arrived first. That is what makes it
 * a pure function of its argument rather than a cache, and it is the property
 * `cache.ts` documents at length: a result that depended on call *order* would
 * be a different kind of object entirely, and unreproducible.
 *
 * Worth having because Earth is read once per planet per light-time pass and
 * the epochs repeat exactly. Measured on `chart/shadbala`: 15 Earth evaluations
 * become 3 — which is also what keeps the tighter series above affordable, since
 * the extra 155 terms are paid three times per chart rather than fifteen.
 */
export function earthRect(ttDays: number, out: Float64Array): void {
  for (let i = 0; i < EARTH_MEMO_SIZE; i++) {
    if (earthMemoKey[i] === ttDays) {
      const base = i * 3;
      out[0] = earthMemoValue[base] as number;
      out[1] = earthMemoValue[base + 1] as number;
      out[2] = earthMemoValue[base + 2] as number;
      return;
    }
  }
  const tau = millennia(ttDays);
  const lon = evaluateVsop(EAR_L_PRECISE, tau);
  const lat = evaluateVsop(EAR_B_PRECISE, tau);
  const r = evaluateVsop(EAR_R, tau);
  const cosLat = r * Math.cos(lat);
  out[0] = cosLat * Math.cos(lon);
  out[1] = cosLat * Math.sin(lon);
  out[2] = r * Math.sin(lat);
  const base = earthMemoNext * 3;
  earthMemoKey[earthMemoNext] = ttDays;
  earthMemoValue[base] = out[0] as number;
  earthMemoValue[base + 1] = out[1] as number;
  earthMemoValue[base + 2] = out[2] as number;
  earthMemoNext = (earthMemoNext + 1) % EARTH_MEMO_SIZE;
}
