/** VSOP87D, mean ecliptic and equinox of date; angles radians, radii AU. A series is a
 * stride-4 `A, B, C, power`, term `A · τ^power · cos(B + C·τ)`; τ is Julian millennia of
 * TT, unrescaled so `B` and `C` match the catalogue. */
import { cos } from './trig';
import {
  EAR_L, EAR_B, EAR_R, EAR_R_COARSE, EAR_L_PRECISE, EAR_B_PRECISE,
  MER_L, MER_B, MER_R,
  VEN_L, VEN_B, VEN_R,
  MAR_L, MAR_B, MAR_R,
  JUP_L, JUP_B, JUP_R,
  SAT_L, SAT_B, SAT_R,
} from './series/vsop87d';

export type VsopBody = 'earth' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

const SERIES: Record<VsopBody, readonly [Float64Array, Float64Array, Float64Array]> = {
  earth: [EAR_L, EAR_B, EAR_R],
  mercury: [MER_L, MER_B, MER_R],
  venus: [VEN_L, VEN_B, VEN_R],
  mars: [MAR_L, MAR_B, MAR_R],
  jupiter: [JUP_L, JUP_B, JUP_R],
  saturn: [SAT_L, SAT_B, SAT_R],
};

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

export const millennia = (ttDays: number): number => ttDays / 365250;

export function heliocentricLongitude(body: VsopBody, ttDays: number): number {
  return evaluateVsop(SERIES[body][0], millennia(ttDays));
}

export function heliocentricLatitude(body: VsopBody, ttDays: number): number {
  return evaluateVsop(SERIES[body][1], millennia(ttDays));
}

export function heliocentricRadius(body: VsopBody, ttDays: number): number {
  return evaluateVsop(SERIES[body][2], millennia(ttDays));
}

/** Four terms, for the Sun's light-time only. */
export function earthRadiusCoarse(ttDays: number): number {
  return evaluateVsop(EAR_R_COARSE, millennia(ttDays));
}

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

/** A chart interleaves five planets over three distinct Earth epochs. */
const EARTH_MEMO_SIZE = 4;
const earthMemoKey = /* @__PURE__ */ (() => new Float64Array(EARTH_MEMO_SIZE).fill(Number.NaN))();
const earthMemoValue = /* @__PURE__ */ new Float64Array(EARTH_MEMO_SIZE * 3);
let earthMemoNext = 0;

/** Reads {@link EAR_L_PRECISE}/{@link EAR_B_PRECISE}, not the coarser angles `sun.ts`
 * takes; the two must not be unified, since a planet's direction is `planet − Earth`
 * and an Earth angle error is amplified by `r_E / Δ`. */
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
