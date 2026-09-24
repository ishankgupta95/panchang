/** VSOP87D is published of-date, so the solar path applies no precession; ELP's
 * longitude is referred to the moving ecliptic from a fixed J2000 origin. */
import { sin, cos } from './trig';
import {
  NUTATION_PSI, NUTATION_PSI_ARGS, NUTATION_EPS, NUTATION_EPS_ARGS,
  NUTATION_MAX_MULTIPLIER,
} from './series/nutation-iau2000';

export const ARCSEC_TO_RAD = Math.PI / 648000;
const TURN_ARCSEC = 1_296_000;

/** Km per day; retardation is applied in days of TT. */
export const KM_PER_LIGHT_DAY = 299_792.458 * 86_400;
/** Km, IAU 2012 definition. */
export const AU_KM = 149_597_870.7;

/** Arcseconds. Must equal {@link meanObliquityArcsec}'s constant term, or the chain out of the J2000 ecliptic and back leaves a spurious tilt. */
const EPS0_ARCSEC = 84381.406;

/** Arcseconds. IAU 2006 (Hilton et al. 2006); `t` in Julian centuries of TT. */
export function meanObliquityArcsec(t: number): number {
  return EPS0_ARCSEC
    + (-46.836769 + (-0.0001831 + (0.00200340 + (-0.000000576 + -0.0000000434 * t) * t) * t) * t) * t;
}

/** Radians, IERS Conventions 2003, in the table 5.3a/5.3b column order `NUTATION_*_ARGS`
 * indexes into. Reduced modulo a turn *before* conversion: whole turns eat a double's digits. */
function fundamentalArguments(t: number, out: Float64Array): void {
  out[0] = ((485868.249036
    + (1717915923.2178 + (31.8792 + (0.051635 + -0.00024470 * t) * t) * t) * t)
    % TURN_ARCSEC) * ARCSEC_TO_RAD;
  out[1] = ((1287104.79305
    + (129596581.0481 + (-0.5532 + (0.000136 + -0.00001149 * t) * t) * t) * t)
    % TURN_ARCSEC) * ARCSEC_TO_RAD;
  out[2] = ((335779.526232
    + (1739527262.8478 + (-12.7512 + (-0.001037 + 0.00000417 * t) * t) * t) * t)
    % TURN_ARCSEC) * ARCSEC_TO_RAD;
  out[3] = ((1072260.70369
    + (1602961601.2090 + (-6.3706 + (0.006593 + -0.00003169 * t) * t) * t) * t)
    % TURN_ARCSEC) * ARCSEC_TO_RAD;
  out[4] = ((450160.398036
    + (-6962890.5431 + (7.4722 + (0.007702 + -0.00005939 * t) * t) * t) * t)
    % TURN_ARCSEC) * ARCSEC_TO_RAD;
  out[5] = 4.402608842 + 2608.7903141574 * t;
  out[6] = 3.176146697 + 1021.3285546211 * t;
  out[7] = 1.753470314 + 628.3075849991 * t;
  out[8] = 6.203480913 + 334.0612426700 * t;
  out[9] = 0.599546497 + 52.9690962641 * t;
  out[10] = 0.874016757 + 21.3299104960 * t;
  out[11] = 5.481293872 + 7.4781598567 * t;
  out[12] = 5.311886287 + 3.8133035638 * t;
  out[13] = (0.02438175 + 0.00000538691 * t) * t;
}

const ARGS = /* @__PURE__ */ new Float64Array(14);

export interface Nutation {
  /** In longitude, arcseconds. */
  dpsi: number;
  /** In obliquity, arcseconds. */
  deps: number;
}

const NUTATION_RESULT: Nutation = { dpsi: 0, deps: 0 };

/** More than one entry is required: `riseSet.ts` reads a Moon and a Sun track at the *same* instants. */
const NUTATION_MEMO_SIZE = 16;
const nutationMemoT = /* @__PURE__ */ (() => new Float64Array(NUTATION_MEMO_SIZE).fill(Number.NaN))();
const nutationMemoPsi = /* @__PURE__ */ new Float64Array(NUTATION_MEMO_SIZE);
const nutationMemoEps = /* @__PURE__ */ new Float64Array(NUTATION_MEMO_SIZE);
let nutationMemoNext = 0;

/** `sin(k·aᵢ)`/`cos(k·aᵢ)` as `[argument][|k|]`; only non-negative `k` is stored. */
const MULTIPLE_COUNT = NUTATION_MAX_MULTIPLIER + 1;
const MULTIPLE_SIN = /* @__PURE__ */ new Float64Array(14 * MULTIPLE_COUNT);
const MULTIPLE_COS = /* @__PURE__ */ new Float64Array(14 * MULTIPLE_COUNT);

function fillMultipleTables(): void {
  for (let a = 0; a < 14; a++) {
    const base = a * MULTIPLE_COUNT;
    const sin1 = sin(ARGS[a] as number);
    const cos1 = cos(ARGS[a] as number);
    MULTIPLE_SIN[base] = 0;
    MULTIPLE_COS[base] = 1;
    let sinK = sin1, cosK = cos1;
    for (let k = 1; k < MULTIPLE_COUNT; k++) {
      MULTIPLE_SIN[base + k] = sinK;
      MULTIPLE_COS[base + k] = cosK;
      const nextSin = sinK * cos1 + cosK * sin1;
      cosK = cosK * cos1 - sinK * sin1;
      sinK = nextSin;
    }
  }
}

/** Arcseconds; every argument is an integer combination of the 14 fundamentals. */
function sumNutation(coefficients: Float64Array, multipliers: Int8Array, t: number): number {
  let total = 0;
  for (let i = 0, m = 0; i < coefficients.length; i += 3, m += 14) {
    let argSin = 0;
    let argCos = 1;
    for (let k = 0; k < 14; k++) {
      const mult = multipliers[m + k] as number;
      if (mult === 0) continue;
      const index = k * MULTIPLE_COUNT + (mult < 0 ? -mult : mult);
      const termCos = MULTIPLE_COS[index] as number;
      const termSin = mult < 0 ? -(MULTIPLE_SIN[index] as number) : (MULTIPLE_SIN[index] as number);
      const nextSin = argSin * termCos + argCos * termSin;
      argCos = argCos * termCos - argSin * termSin;
      argSin = nextSin;
    }
    const value = (coefficients[i] as number) * argSin + (coefficients[i + 1] as number) * argCos;
    total += coefficients[i + 2] === 0 ? value : value * t;
  }
  return total;
}

/** Arcseconds, truncated IAU 2000A. Memoized on *exact* equality of `t` (never
 * bucketed), so a result can never depend on call order. */
export function nutation(t: number): Nutation {
  for (let i = 0; i < NUTATION_MEMO_SIZE; i++) {
    if (nutationMemoT[i] === t) {
      NUTATION_RESULT.dpsi = nutationMemoPsi[i] as number;
      NUTATION_RESULT.deps = nutationMemoEps[i] as number;
      return NUTATION_RESULT;
    }
  }
  fundamentalArguments(t, ARGS);
  fillMultipleTables();
  const dpsi = sumNutation(NUTATION_PSI, NUTATION_PSI_ARGS, t);
  const deps = sumNutation(NUTATION_EPS, NUTATION_EPS_ARGS, t);
  nutationMemoT[nutationMemoNext] = t;
  nutationMemoPsi[nutationMemoNext] = dpsi;
  nutationMemoEps[nutationMemoNext] = deps;
  nutationMemoNext = (nutationMemoNext + 1) % NUTATION_MEMO_SIZE;
  NUTATION_RESULT.dpsi = dpsi;
  NUTATION_RESULT.deps = deps;
  return NUTATION_RESULT;
}

/** `elp82b.f`'s closing precession matrix, verbatim from the subroutine. */
const ELP_P0 = 0.10180391e-4, ELP_P1 = 0.47020439e-6, ELP_P2 = -0.5417367e-9,
  ELP_P3 = -0.2507948e-11, ELP_P4 = 0.463486e-14;
const ELP_Q0 = -0.113469002e-3, ELP_Q1 = 0.12372674e-6, ELP_Q2 = 0.1265417e-8,
  ELP_Q3 = -0.1371808e-11, ELP_Q4 = -0.320334e-14;

/** A pure rotation: `|out|` equals `dist`, so a longitude-only caller may pass any
 * radius. `lon` is radians from the inertial J2000 origin; `t`, Julian centuries of TT. */
export function elpToEclipticOfDate(
  lon: number, lat: number, dist: number, t: number, out: Float64Array,
): void {
  const cl = dist * Math.cos(lat);
  const x0 = cl * Math.cos(lon);
  const y0 = cl * Math.sin(lon);
  const z0 = dist * Math.sin(lat);

  let pw = (ELP_P0 + (ELP_P1 + (ELP_P2 + (ELP_P3 + ELP_P4 * t) * t) * t) * t) * t;
  let qw = (ELP_Q0 + (ELP_Q1 + (ELP_Q2 + (ELP_Q3 + ELP_Q4 * t) * t) * t) * t) * t;
  const ra = 2 * Math.sqrt(1 - pw * pw - qw * qw);
  const pwqw = 2 * pw * qw;
  const pw2 = 1 - 2 * pw * pw;
  const qw2 = 1 - 2 * qw * qw;
  pw *= ra;
  qw *= ra;
  let x = pw2 * x0 + pwqw * y0 + pw * z0;
  let y = pwqw * x0 + qw2 * y0 - qw * z0;
  let z = -pw * x0 + qw * y0 + (pw2 + qw2 - 1) * z0;

  let c = Math.cos(EPS0_ARCSEC * ARCSEC_TO_RAD), s = Math.sin(EPS0_ARCSEC * ARCSEC_TO_RAD);
  let ty = c * y - s * z;
  z = s * y + c * z;
  y = ty;

  const zeta = (2306.083227 + (0.2988499 + (0.01801828 + (-0.000005971 + -0.0000003173 * t) * t) * t) * t) * t;
  const zA = (2306.077181 + (1.0927348 + (0.01826837 + (-0.000028596 + -0.0000002904 * t) * t) * t) * t) * t;
  const theta = (2004.191903 + (-0.4294934 + (-0.04182264 + (-0.000007089 + -0.0000001274 * t) * t) * t) * t) * t;

  c = Math.cos(zeta * ARCSEC_TO_RAD); s = Math.sin(zeta * ARCSEC_TO_RAD);
  let tx = c * x - s * y;
  y = s * x + c * y;
  x = tx;

  c = Math.cos(theta * ARCSEC_TO_RAD); s = Math.sin(theta * ARCSEC_TO_RAD);
  tx = c * x - s * z;
  z = s * x + c * z;
  x = tx;

  c = Math.cos(zA * ARCSEC_TO_RAD); s = Math.sin(zA * ARCSEC_TO_RAD);
  tx = c * x - s * y;
  y = s * x + c * y;
  x = tx;

  const eps = meanObliquityArcsec(t) * ARCSEC_TO_RAD;
  c = Math.cos(eps); s = Math.sin(eps);
  ty = c * y + s * z;
  z = -s * y + c * z;

  out[0] = x;
  out[1] = ty;
  out[2] = z;
}

/** Arcseconds. VSOP dynamical frame → FK5, Bretagnon & Francou (1988). */
export const VSOP_TO_FK5_ARCSEC = -0.09033;
export const VSOP_TO_FK5_LAT_ARCSEC = 0.03916;
