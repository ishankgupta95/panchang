/**
 * The frame layer: precession, nutation, obliquity, and the rotations that
 * carry a position from the frame its theory is published in to the frame this
 * library reports in.
 *
 * ## The frame this library reports in
 *
 * **Geocentric apparent, true ecliptic and equinox of date.** That is what
 * every published panchang quantity is defined against, what `astronomy-engine`
 * returned before Phase 36, and what the Tier 0 fixture is tagged with
 * (Horizons `ObsEcLon`, `QUANTITIES=31`) — so no frame conversion sits between
 * the fixture and the measurement, and a frame mistake cannot hide inside a
 * longitude comparison.
 *
 * ## Why the Sun and the Moon need different amounts of work
 *
 * This is the one asymmetry worth reading before the code, because it looks
 * like an inconsistency and is not:
 *
 * - **VSOP87D is already of-date.** Version D of VSOP87 is published in the
 *   mean dynamical ecliptic and equinox *of date*, so the solar and planetary
 *   paths apply **no precession at all**. Only nutation, light-time and the
 *   published FK5 offset separate them from apparent place.
 * - **ELP2000-82B is not.** Its longitude is referred to the moving ecliptic
 *   but measured from a **fixed, inertial J2000 origin**. Left uncorrected that
 *   shows up as a clean −5028.6″ per century drift — general precession in
 *   longitude, exactly — which is how the frame was identified rather than
 *   guessed. {@link elpToEclipticOfDate} applies `elp82b.f`'s own p/q rotation
 *   to reach the inertial mean ecliptic of J2000 and then the IAU 2006
 *   precession to reach the equinox of date.
 *
 * Doing the lunar correction as two published rotations rather than one fitted
 * angle is deliberate. A fitted scalar would have been shorter and would have
 * measured *better* against the fixture — which is the problem: it would have
 * been fitted to the thing that is supposed to be adjudicating it.
 */
import { sin, cos } from './trig';
import {
  NUTATION_PSI, NUTATION_PSI_ARGS, NUTATION_EPS, NUTATION_EPS_ARGS,
  NUTATION_MAX_MULTIPLIER,
} from './series/nutation-iau2000';

/** Arcseconds to radians. */
export const ARCSEC_TO_RAD = Math.PI / 648000;
/** One full turn, arcseconds — for reducing the fundamental-argument polynomials. */
const TURN_ARCSEC = 1_296_000;

/** Speed of light, km per day. Light-time retardation is applied in days of TT. */
export const KM_PER_LIGHT_DAY = 299_792.458 * 86_400;
/** Astronomical unit, km (IAU 2012 definition). */
export const AU_KM = 149_597_870.7;

/**
 * Obliquity of the ecliptic at J2000.0, arcseconds (IAU 2006).
 *
 * Paired with {@link meanObliquityArcsec} below, whose constant term is the
 * same number — they must agree, because the precession chain rotates out of
 * the J2000 ecliptic and back into the ecliptic of date, and a mismatch would
 * appear as a spurious tilt.
 */
const EPS0_ARCSEC = 84381.406;

/**
 * Mean obliquity of the ecliptic, arcseconds. IAU 2006 (Hilton et al. 2006),
 * `t` in Julian centuries of TT from J2000.0.
 */
export function meanObliquityArcsec(t: number): number {
  return EPS0_ARCSEC
    + (-46.836769 + (-0.0001831 + (0.00200340 + (-0.000000576 + -0.0000000434 * t) * t) * t) * t) * t;
}

/**
 * Fundamental arguments of the nutation theory, radians (IERS Conventions
 * 2003). The order is the multiplier-column order of IERS tables 5.3a/5.3b,
 * which is what `NUTATION_*_ARGS` indexes into: the five Delaunay arguments,
 * the eight planetary mean longitudes, then general precession in longitude.
 *
 * The Delaunay polynomials are reduced modulo a full turn *before* conversion
 * to radians. Their linear terms reach 1.7 × 10⁹ arcseconds per century, so at
 * |t| = 1 an unreduced value would spend nine of a double's sixteen digits on
 * whole turns and leave only ~10⁻⁷ radians of resolution in the part that
 * matters.
 *
 * The five Delaunay lines were a call to a local `reduce` closure, which read
 * better and allocated a closure on every invocation of a function the profile
 * puts at 9% of self time. Written out, the arithmetic is character-for-character
 * the same Horner nesting, so the result is bit-identical — and the differential
 * test at 10⁻⁹″ is what says so rather than this comment.
 */
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

const ARGS = new Float64Array(14);

export interface Nutation {
  /** Nutation in longitude, arcseconds. */
  dpsi: number;
  /** Nutation in obliquity, arcseconds. */
  deps: number;
}

/** Scratch object reused by {@link nutation}; see the memo below. */
const NUTATION_RESULT: Nutation = { dpsi: 0, deps: 0 };

/**
 * Distinct epochs the nutation memo remembers.
 *
 * It was one, on the reasoning that the Sun and the Moon are almost always read
 * at the same instant one after the other. True for a longitude read, and
 * completely wrong for a calendar day: `riseSet.ts` builds a 7-node track for
 * the Moon and *then* a 7-node track for the Sun, over the same UTC day and
 * therefore at the **same seven instants** — so a one-entry memo missed on all
 * fourteen, having been evicted by the previous body.
 *
 * Sixteen covers those seven, the day's two nutation endpoints, the ~2.5 direct
 * lunar longitude reads and the eclipse guard's four, with room left over.
 * A miss costs a linear scan of sixteen doubles; a hit saves ~1.8 µs.
 */
const NUTATION_MEMO_SIZE = 16;
const nutationMemoT = new Float64Array(NUTATION_MEMO_SIZE).fill(Number.NaN);
const nutationMemoPsi = new Float64Array(NUTATION_MEMO_SIZE);
const nutationMemoEps = new Float64Array(NUTATION_MEMO_SIZE);
let nutationMemoNext = 0;

/**
 * `sin(k·aᵢ)` and `cos(k·aᵢ)` for every fundamental argument `aᵢ` and every
 * multiple `k` from 0 to {@link NUTATION_MAX_MULTIPLIER}, laid out as
 * `[argument][|k|]`.
 *
 * Only non-negative `k` is stored: `sin(−k·a) = −sin(k·a)` and
 * `cos(−k·a) = cos(k·a)`, so the sign is applied at use and the table is half
 * the size. The bound itself is emitted by the generator
 * (`NUTATION_MAX_MULTIPLIER`) rather than written here, so raising
 * `nutationCut` cannot leave a term indexing past the end.
 */
const MULTIPLE_COUNT = NUTATION_MAX_MULTIPLIER + 1;
const MULTIPLE_SIN = new Float64Array(14 * MULTIPLE_COUNT);
const MULTIPLE_COS = new Float64Array(14 * MULTIPLE_COUNT);

/**
 * Fill {@link MULTIPLE_SIN} / {@link MULTIPLE_COS} from `ARGS`.
 *
 * 28 calls into `trig.ts` — one `sin` and one `cos` per argument — and then the
 * angle-addition recurrence for every multiple. That recurrence is why this is
 * worth doing at all: it replaces 156 `Math.sin`/`Math.cos` calls with 28 plus
 * about 500 multiply-adds.
 *
 * The recurrence accumulates rounding, but only over `k ≤ 5`, so the worst
 * multiple carries ~5 ulps — 10⁻¹⁵ relative, against a largest amplitude of 17″
 * and a differential threshold of 10⁻⁹″. Measured rather than argued:
 * `differential-ephemeris.test.ts` holds this against the direct summation.
 */
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

/**
 * Sum one nutation series, arcseconds.
 *
 * Every argument is an **integer** combination of the 14 fundamental arguments,
 * which is what makes the transcendentals avoidable: `sin(A + B)` and
 * `cos(A + B)` follow from `sin`/`cos` of `A` and of `B` by four multiplies and
 * two adds, so a term with (typically) two or three non-zero multipliers folds
 * together from the precomputed table without a single library call.
 *
 * This is §36.0 H's "fast third". The direct form it replaces — one `Math.sin`
 * *and* one `Math.cos` per term, 156 across the two series — is frozen verbatim
 * in `tests/reference/ephemeris-reference.ts` and the two are held together at
 * 10⁻⁹″ over 100,000 instants.
 *
 * It is worth doing because nutation is paid by *every* Sun read and *every*
 * Moon read: the profile after 36.5 put `sumNutation` + `nutation` at 10.1% of
 * the whole library's self time.
 */
function sumNutation(coefficients: Float64Array, multipliers: Int8Array, t: number): number {
  let total = 0;
  for (let i = 0, m = 0; i < coefficients.length; i += 3, m += 14) {
    // Running (sin, cos) of the partial sum of angles, starting from zero.
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

/**
 * Nutation in longitude and obliquity, arcseconds. Truncated IAU 2000A — 49 and
 * 29 terms, good to 0.005″ and 0.003″ against the full 2,414-term series.
 *
 * Memoized on `t` over {@link NUTATION_MEMO_SIZE} epochs, because a calendar day
 * reads nutation at the same handful of instants repeatedly and it costs ~1.8 µs
 * a time. Entries are keyed on **exact** equality of the argument — no
 * bucketing, no tolerance, no dependence on which caller arrived first — so the
 * memo is a pure function of its argument and cannot make a result depend on
 * call order, which is the property `cache.ts` documents at length and this
 * module must not undo. Eviction is round-robin and therefore also independent
 * of the values stored.
 */
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

/**
 * `elp82b.f`'s closing precession matrix — the polynomials for the ecliptic
 * pole's motion, verbatim from the published subroutine.
 */
const ELP_P0 = 0.10180391e-4, ELP_P1 = 0.47020439e-6, ELP_P2 = -0.5417367e-9,
  ELP_P3 = -0.2507948e-11, ELP_P4 = 0.463486e-14;
const ELP_Q0 = -0.113469002e-3, ELP_Q1 = 0.12372674e-6, ELP_Q2 = 0.1265417e-8,
  ELP_Q3 = -0.1371808e-11, ELP_Q4 = -0.320334e-14;

/**
 * ELP's frame → the **mean** ecliptic and equinox of date.
 *
 * Writes the rotated unit-ish vector into `out` (the caller supplies it so the
 * hot path allocates nothing). Distance is carried through unchanged — the
 * whole transformation is a rotation, so `|out|` equals the input distance and
 * a caller that only wants longitude may pass any positive radius.
 *
 * @param lon  ELP longitude, radians, from the inertial J2000 origin.
 * @param lat  ELP latitude, radians.
 * @param dist Geocentric distance, km.
 * @param t    Julian centuries of TT from J2000.0.
 */
export function elpToEclipticOfDate(
  lon: number, lat: number, dist: number, t: number, out: Float64Array,
): void {
  const cl = dist * Math.cos(lat);
  const x0 = cl * Math.cos(lon);
  const y0 = cl * Math.sin(lon);
  const z0 = dist * Math.sin(lat);

  // p/q: the moving ecliptic plane, back to J2000. This rotation contains no
  // component about the pole, which is precisely why the longitude it leaves
  // behind still has a fixed origin.
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

  // Ecliptic J2000 → equatorial J2000.
  let c = Math.cos(EPS0_ARCSEC * ARCSEC_TO_RAD), s = Math.sin(EPS0_ARCSEC * ARCSEC_TO_RAD);
  let ty = c * y - s * z;
  z = s * y + c * z;
  y = ty;

  // Equatorial J2000 → equatorial of date: R_z(z_A)·R_y(−θ_A)·R_z(ζ_A),
  // IAU 2006 precession angles (Capitaine, Wallace & Chapront 2003) in the
  // precession-only form — the ±2.650545″ frame-bias constants that appear in
  // the GCRS version do not belong here, because ELP's J2000 frame is the
  // dynamical mean equinox rather than the ICRS pole.
  const zeta = (2306.083227 + (0.2988499 + (0.01801828 + (-0.000005971 + -0.0000003173 * t) * t) * t) * t) * t;
  const zA = (2306.077181 + (1.0927348 + (0.01826837 + (-0.000028596 + -0.0000002904 * t) * t) * t) * t) * t;
  const theta = (2004.191903 + (-0.4294934 + (-0.04182264 + (-0.000007089 + -0.0000001274 * t) * t) * t) * t) * t;

  c = Math.cos(zeta * ARCSEC_TO_RAD); s = Math.sin(zeta * ARCSEC_TO_RAD);
  let tx = c * x - s * y;
  y = s * x + c * y;
  x = tx;

  c = Math.cos(theta * ARCSEC_TO_RAD); s = Math.sin(theta * ARCSEC_TO_RAD);
  tx = c * x - s * z;          // R_y(−θ)
  z = s * x + c * z;
  x = tx;

  c = Math.cos(zA * ARCSEC_TO_RAD); s = Math.sin(zA * ARCSEC_TO_RAD);
  tx = c * x - s * y;
  y = s * x + c * y;
  x = tx;

  // Equatorial of date → ecliptic of date.
  const eps = meanObliquityArcsec(t) * ARCSEC_TO_RAD;
  c = Math.cos(eps); s = Math.sin(eps);
  ty = c * y + s * z;
  z = -s * y + c * z;

  out[0] = x;
  out[1] = ty;
  out[2] = z;
}

/**
 * The published VSOP87 → FK5 longitude offset, arcseconds.
 *
 * Bretagnon & Francou (1988) give the reduction of the VSOP dynamical frame to
 * FK5 as a constant −0.09033″ in longitude plus a latitude term; Meeus,
 * *Astronomical Algorithms* 2nd ed. ch. 32 states the same pair. It is small —
 * 6% of the Sun's error ceiling — but it is a published constant rather than a
 * fitted one, and applying it measurably reduces both the Sun's max error
 * (0.206″ → 0.115″) and its bias (0.110″ → 0.020″).
 */
export const VSOP_TO_FK5_ARCSEC = -0.09033;
/** The latitude half of the same reduction; see {@link VSOP_TO_FK5_ARCSEC}. */
export const VSOP_TO_FK5_LAT_ARCSEC = 0.03916;
