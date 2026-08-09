/**
 * Rise and set, solved against an interpolant instead of against the series.
 *
 * This is the module PLAN.md §36.1 deferred as item (b) and the 2026-08-06
 * re-profile identified as carrying the entire remaining win. The measurement
 * that shapes it:
 *
 * > At ~0.98 ms/day the Moon theory was ~56% of self time, implying ~65 lunar
 * > evaluations per day. Only 2.55 of those were our own longitude reads. The
 * > other ~62 were **inside the searches** — `SearchRiseSet` alone ran 4.64
 * > times a day at 10.7 evaluations each.
 *
 * So the cost was never the series being called by us; it was the solver
 * calling the series. The fix is to call the series a fixed, small number of
 * times per day, fit a polynomial, and let the solver probe the polynomial.
 *
 * ## What is interpolated, and what is not
 *
 * Per (body, {@link TRACK_BLOCK_DAYS}-day block): {@link TRACK_NODES} samples of
 * the body's **equatorial of date rectangular** position. Rectangular, not right
 * ascension, because RA wraps at 24 h and an interpolant across the seam is
 * wrong in a way that only shows up for a few days a month.
 *
 * Not interpolated: the observer's own rotation. Sidereal time is analytic and
 * costs a few flops, so it is evaluated exactly at every probe — which matters,
 * because it is the fastest-moving quantity in the problem by three orders of
 * magnitude and interpolating it would be the one approximation that actually
 * hurt.
 *
 * Nutation sits between those two. It is far too slow to evaluate per probe
 * (49 + 29 terms, ~2 µs) and far too smooth to need it: Δψ moves under 0.09″
 * across a whole day. It is therefore evaluated at each **day's** two endpoints
 * and interpolated linearly in between — see {@link DayFrame}, which is why the
 * frame is per-day even though the position fit is not. Linearly, and
 * endpoint-anchored, specifically so that **adjacent days agree exactly at the
 * boundary they share** — a discontinuity there would let an event near midnight
 * be found twice, or not at all, which is precisely the class of bug a per-day
 * cache exists to avoid.
 *
 * ## Accuracy
 *
 * `notes/lunarcheck.src.ts` is the differential test: 153,600 comparisons over
 * 12 locations from Quito to Alert at 82.5 °N, 1,600 days, both directions.
 */
import { sin, cos } from './trig';
import { getMoonPositionForTrack } from './moon';
import { getSunPosition } from './sun';
import { ttDaysSinceJ2000 } from './deltaT';
import { nutation, meanObliquityArcsec, ARCSEC_TO_RAD, AU_KM } from './frame';
import {
  REFRACTION_NEAR_HORIZON_DEG, SUN_RADIUS_AU, MOON_RADIUS_KM,
  EARTH_EQUATORIAL_RADIUS_KM, EARTH_FLATTENING_SQUARED,
} from './topocentric';
import type { GeoLocation } from '../types/location';

const DAY_MS = 86_400_000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MOON_RADIUS_AU = MOON_RADIUS_KM / AU_KM;

export type RiseSetBody = 'sun' | 'moon';

/**
 * Span of one position track, in UTC days, and the number of Chebyshev samples
 * fitted across it.
 *
 * Eleven nodes over four days — 2.75 evaluations per body per day, against the
 * 7.0 a per-day fit costs. This is the dominant cost of the whole module (each
 * lunar node is a full `moonElpLongitude` + `moonElpLatitude` +
 * `moonElpDistanceTrack`, ~970 terms), so both numbers were measured rather
 * than chosen. `notes/track-fit.src.ts` sweeps them; max angular error of the
 * fit against direct evaluation, over five epochs spanning 1900–2100:
 *
 * | span × nodes | evaluations/day | Moon | Sun |
 * |---|---|---|---|
 * | 1 d × 5 | 5.00 | 1.1 × 10⁻²″ | 4.9 × 10⁻⁵″ |
 * | 1 d × 7 | 7.00 | 6.4 × 10⁻⁴″ | 4.4 × 10⁻⁵″ |
 * | **4 d × 11** | **2.75** | **6.1 × 10⁻⁴″** | **4.2 × 10⁻⁵″** |
 * | 8 d × 17 | 2.13 | 3.7 × 10⁻²″ | 3.1 × 10⁻³″ |
 *
 * Two things in that table decided it. The 4 d × 11 row is **not better** than
 * 1 d × 7 by luck — both sit on the same floor, which is the millisecond
 * quantization of `new Date()` (the Moon moves 5.5 × 10⁻⁴″ per ms), so the fit
 * itself contributes nothing measurable at either span and the extra width is
 * free. And the 8-day row is a genuine cliff, 50× worse at *more* nodes: ELP
 * carries argument families near a 5-day period, and a block wider than about
 * half of that stops being resolvable however many nodes are spent on it.
 *
 * At 6 × 10⁻⁴″ the implied rise-time error is 0.04 ms against a 15″/s altitude
 * rate — twenty times below the ~1 ms both this solver and its reference bisect
 * to, which is why `differential-riseset.test.ts` reports the interpolation as
 * contributing nothing detectable.
 */
const TRACK_BLOCK_DAYS = 4;
const TRACK_NODES = 11;

/**
 * Grid step for the initial bracket scan, days. Twelve minutes.
 *
 * Missing a narrow event is prevented by {@link MAX_ALTITUDE_SLOPE_DEG_PER_DAY}
 * rather than by the step, so this is chosen for cost alone: 120 probes a day,
 * shared by both directions.
 */
const SCAN_STEP_DAYS = 12 / (60 * 24);

/**
 * Bound on |d(altitude)/dt|, degrees per day.
 *
 * The Earth turns 360° a day and the fastest body adds ~13°, so 380 is a true
 * upper bound for any observer. It is used to prove a grid cell *cannot*
 * contain a hidden rise-and-set pair, which is the only way a fixed grid can be
 * made safe at high latitude where the Moon grazes the horizon for minutes.
 */
const MAX_ALTITUDE_SLOPE_DEG_PER_DAY = 380;

/** Refinement tolerance, days. ~1 ms. */
const ROOT_TOLERANCE_DAYS = 1e-8;

/**
 * One block's worth of a body's equatorial-of-date position.
 *
 * Split from {@link DayFrame} because the two have different natural spans. The
 * position is what costs a series evaluation, and it is smooth enough to fit
 * across four days; the equation of the equinoxes costs a nutation evaluation
 * and has to stay endpoint-anchored **per day** so that adjacent days agree
 * exactly where they meet. Fitting both over the same window would either pay
 * for the position four times too often or let the sidereal time drift between
 * neighbouring days.
 */
class PositionTrack {
  /** Chebyshev abscissae in [-1, 1]. */
  private readonly nodeX = new Float64Array(TRACK_NODES);
  private readonly weight = new Float64Array(TRACK_NODES);
  /** Equatorial-of-date x, y, z (AU) at each node. */
  private readonly px = new Float64Array(TRACK_NODES);
  private readonly py = new Float64Array(TRACK_NODES);
  private readonly pz = new Float64Array(TRACK_NODES);
  private readonly midMs: number;
  private readonly halfMs: number;
  readonly radiusAu: number;

  constructor(body: RiseSetBody, blockIndex: number) {
    const startMs = blockIndex * TRACK_BLOCK_DAYS * DAY_MS;
    const endMs = startMs + TRACK_BLOCK_DAYS * DAY_MS;
    this.midMs = (startMs + endMs) / 2;
    this.halfMs = (endMs - startMs) / 2;
    this.radiusAu = body === 'sun' ? SUN_RADIUS_AU : MOON_RADIUS_AU;

    for (let k = 0; k < TRACK_NODES; k++) {
      const x = Math.cos((Math.PI * k) / (TRACK_NODES - 1));
      this.nodeX[k] = x;
      this.weight[k] = (k === 0 || k === TRACK_NODES - 1 ? 0.5 : 1) * (k % 2 ? -1 : 1);

      const ms = this.midMs + this.halfMs * x;
      const date = new Date(ms);
      const t = ttDaysSinceJ2000(date) / 36525;
      const eps = (meanObliquityArcsec(t) + nutation(t).deps) * ARCSEC_TO_RAD;

      let lonDeg: number, latDeg: number, distAu: number;
      if (body === 'sun') {
        const p = getSunPosition(date);
        lonDeg = p.longitude; latDeg = p.latitude; distAu = p.distance;
      } else {
        const p = getMoonPositionForTrack(date);
        lonDeg = p.longitude; latDeg = p.latitude; distAu = p.distance / AU_KM;
      }
      const lon = lonDeg * DEG_TO_RAD;
      const lat = latDeg * DEG_TO_RAD;
      const cosLat = distAu * Math.cos(lat);
      const ex = cosLat * Math.cos(lon);
      const ey = cosLat * Math.sin(lon);
      const ez = distAu * Math.sin(lat);
      this.px[k] = ex;
      this.py[k] = Math.cos(eps) * ey - Math.sin(eps) * ez;
      this.pz[k] = Math.sin(eps) * ey + Math.cos(eps) * ez;
    }
  }

  /** Barycentric Chebyshev evaluation of all three components at once. */
  position(ms: number, out: Float64Array): void {
    const x = (ms - this.midMs) / this.halfMs;
    let nx = 0, ny = 0, nz = 0, den = 0;
    for (let k = 0; k < TRACK_NODES; k++) {
      const dx = x - (this.nodeX[k] as number);
      if (dx === 0) {
        out[0] = this.px[k] as number;
        out[1] = this.py[k] as number;
        out[2] = this.pz[k] as number;
        return;
      }
      const q = (this.weight[k] as number) / dx;
      nx += q * (this.px[k] as number);
      ny += q * (this.py[k] as number);
      nz += q * (this.pz[k] as number);
      den += q;
    }
    out[0] = nx / den;
    out[1] = ny / den;
    out[2] = nz / den;
  }
}

/**
 * The frame quantities needed to place an observer under the body, for one UTC
 * day: the equation of the equinoxes at the day's two endpoints, and ΔT.
 *
 * Body-independent, so the Sun's and the Moon's scans of the same day share one
 * of these — and, unlike {@link PositionTrack}, it stays per-day so that the two
 * days meeting at a midnight compute identical sidereal time there.
 */
class DayFrame {
  /** Equation of the equinoxes, arcseconds, at the day's two endpoints. */
  private readonly eqeq0: number;
  private readonly eqeq1: number;
  /**
   * ΔT in days, read once for this day. It appears only in the
   * accumulated-precession polynomial, where a whole second of error is worth
   * 1.5 × 10⁻⁶ arcseconds — but it is stored **per day** rather than in a
   * module-level scratch, because a shared scratch would make one day's
   * sidereal time depend on which day happened to be built last.
   */
  private readonly deltaTDays: number;
  private readonly dayStartMs: number;

  constructor(dayIndex: number) {
    this.dayStartMs = dayIndex * DAY_MS;
    const dayEndMs = this.dayStartMs + DAY_MS;
    const midMs = (this.dayStartMs + dayEndMs) / 2;
    this.eqeq0 = equationOfEquinoxes(this.dayStartMs);
    this.eqeq1 = equationOfEquinoxes(dayEndMs);
    this.deltaTDays = ttDaysSinceJ2000(new Date(midMs))
      - (midMs - Date.UTC(2000, 0, 1, 12)) / DAY_MS;
  }

  /**
   * Greenwich Apparent Sidereal Time, degrees, with the equation of the
   * equinoxes interpolated linearly across this day.
   */
  gast(ms: number): number {
    const utDays = (ms - Date.UTC(2000, 0, 1, 12)) / DAY_MS;
    const theta = 360 * (((0.7790572732640 + 0.00273781191135448 * utDays) % 1 + (utDays % 1)) % 1);
    const frac = (ms - this.dayStartMs) / DAY_MS;
    const eqeq = this.eqeq0 + (this.eqeq1 - this.eqeq0) * frac;
    // The accumulated-precession polynomial is a function of TT, never of UT —
    // the conflation `topocentric.ts` warns about. ΔT moves by well under a
    // millisecond across one day, so this day's value is used throughout it.
    const t = (utDays + this.deltaTDays) / 36525;
    const precession = 0.014506
      + (4612.156534 + (1.3915817 + (-0.00000044 + (-0.000029956 + -0.0000000368 * t) * t) * t) * t) * t;
    const gast = (theta + (eqeq + precession) / 3600) % 360;
    return gast < 0 ? gast + 360 : gast;
  }
}

function equationOfEquinoxes(ms: number): number {
  const t = ttDaysSinceJ2000(new Date(ms)) / 36525;
  const { dpsi, deps } = nutation(t);
  return dpsi * Math.cos((meanObliquityArcsec(t) + deps) * ARCSEC_TO_RAD);
}

/**
 * Track store, keyed by `body|blockIndex`, and frame store, keyed by day index.
 *
 * Module-level for the same reason `cache.ts`'s Chebyshev blocks are: each is a
 * pure function of its key, so sharing across calls changes only *which call
 * builds it*, never its contents. Bounded with the same clear-on-overflow
 * policy — 1,024 tracks is about eleven years of both bodies, and 8,192 frames
 * about twenty-two.
 */
const TRACK_STORE = new Map<string, PositionTrack>();
const MAX_TRACKS = 1024;
const FRAME_STORE = new Map<number, DayFrame>();
const MAX_FRAMES = 8192;

function trackFor(body: RiseSetBody, dayIndex: number): PositionTrack {
  const blockIndex = Math.floor(dayIndex / TRACK_BLOCK_DAYS);
  const key = `${body}|${blockIndex}`;
  const existing = TRACK_STORE.get(key);
  if (existing !== undefined) return existing;
  const track = new PositionTrack(body, blockIndex);
  if (TRACK_STORE.size >= MAX_TRACKS) TRACK_STORE.clear();
  TRACK_STORE.set(key, track);
  return track;
}

function frameFor(dayIndex: number): DayFrame {
  const existing = FRAME_STORE.get(dayIndex);
  if (existing !== undefined) return existing;
  const frame = new DayFrame(dayIndex);
  if (FRAME_STORE.size >= MAX_FRAMES) FRAME_STORE.clear();
  FRAME_STORE.set(dayIndex, frame);
  return frame;
}

/** Drop every cached track, frame and scan. Cannot change an answer, only the work. */
export function clearRiseSetTracks(): void {
  TRACK_STORE.clear();
  FRAME_STORE.clear();
  SCAN_CACHE.clear();
}

const BODY_VEC = new Float64Array(3);

/**
 * An observer's ellipsoid constants and latitude trigonometry, hoisted out of
 * the probe loop.
 *
 * All of it depends on latitude and elevation alone, so recomputing it per
 * probe was pure waste — and it was four transcendental calls of waste, on a
 * loop that runs ~120 times per body per day. The probe below is down to two
 * (`sin`/`cos` of the local sidereal angle) plus the `asin` that turns a dot
 * product into an altitude.
 */
class ObserverGeometry {
  readonly sinPhi: number;
  readonly cosPhi: number;
  /** Distance from the Earth's axis, and from its equatorial plane, in AU. */
  readonly equatorialAu: number;
  readonly polarAu: number;
  readonly longitude: number;

  constructor(location: GeoLocation) {
    const phi = location.latitude * DEG_TO_RAD;
    this.sinPhi = Math.sin(phi);
    this.cosPhi = Math.cos(phi);
    const flattened = EARTH_FLATTENING_SQUARED * this.sinPhi * this.sinPhi;
    const c = 1 / Math.sqrt(this.cosPhi * this.cosPhi + flattened);
    const s = EARTH_FLATTENING_SQUARED * c;
    const heightKm = (location.elevation ?? 0) / 1000;
    this.equatorialAu = (EARTH_EQUATORIAL_RADIUS_KM * c + heightKm) / AU_KM * this.cosPhi;
    this.polarAu = (EARTH_EQUATORIAL_RADIUS_KM * s + heightKm) / AU_KM * this.sinPhi;
    this.longitude = location.longitude;
  }
}

/**
 * Altitude of the body's **upper limb** above the observer's horizon, minus the
 * refracted horizon itself. Zero at rise and at set, positive when up.
 *
 * This reproduces the convention rise/set has always been defined by here: the
 * geometric altitude of the disc's centre, plus its apparent semidiameter,
 * compared against −34′ of assumed refraction. Parallax is not a separate
 * term — it falls out of subtracting the observer's own geocentric position,
 * which for the Moon is worth nearly a degree.
 *
 * The semidiameter uses `r/d` rather than `asin(r/d)`. The argument never
 * exceeds 0.005, where the two differ by 2 × 10⁻⁸ radians — four thousandths of
 * an arcsecond, or 0.0003 s of rise time.
 */
function altitudeExcess(
  track: PositionTrack, frame: DayFrame, geometry: ObserverGeometry, ms: number,
): number {
  track.position(ms, BODY_VEC);
  const local = (frame.gast(ms) + geometry.longitude) * DEG_TO_RAD;
  // `trig.ts` rather than `Math.cos`: this is the innermost expression in the
  // module, two calls on every one of ~240 probes per body per day.
  const cosLocal = cos(local);
  const sinLocal = sin(local);

  // Topocentric vector: the body, less the observer's own displacement from the
  // geocentre. For the Moon this is the 57′ parallax; for the Sun it is 8.8″.
  const x = (BODY_VEC[0] as number) - geometry.equatorialAu * cosLocal;
  const y = (BODY_VEC[1] as number) - geometry.equatorialAu * sinLocal;
  const z = (BODY_VEC[2] as number) - geometry.polarAu;
  // `Math.hypot` is a libm call with overflow guards V8 does not inline; on a
  // loop this hot the plain form measured materially faster and cannot overflow
  // here, where every component is under two astronomical units.
  const distance = Math.sqrt(x * x + y * y + z * z);

  // Dot with the zenith direction, built from the same two trig calls.
  const dot = (x * geometry.cosPhi * cosLocal
    + y * geometry.cosPhi * sinLocal
    + z * geometry.sinPhi) / distance;
  const centre = Math.asin(dot < -1 ? -1 : dot > 1 ? 1 : dot) * RAD_TO_DEG;
  return centre + (track.radiusAu / distance) * RAD_TO_DEG + REFRACTION_NEAR_HORIZON_DEG;
}

/** Refine a bracketed sign change of `f` by bisection, to ~1 ms. */
function refine(
  f: (ms: number) => number, loMs: number, hiMs: number, fLoIn: number, wantRise: boolean,
): number {
  const tolMs = ROOT_TOLERANCE_DAYS * DAY_MS;
  let lo = loMs, hi = hiMs, fLo = fLoIn;
  const below = (v: number): boolean => (wantRise ? v < 0 : v >= 0);
  while (hi - lo > tolMs) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (below(fLo) === below(fMid)) { lo = mid; fLo = fMid; } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Both directions' events for one body and UTC day. */
interface DayEventPair {
  rise: number[];
  set: number[];
}

/**
 * Rises and sets in one pass.
 *
 * Scanning once for both directions rather than twice is not a micro-saving:
 * the grid *is* the cost of this module after the track is built, and the two
 * directions read exactly the same altitude samples. Doing them separately
 * doubled the probe count to find, in the same cells, the crossings of the
 * opposite sign.
 *
 * The scan walks a fixed grid, but a grid alone cannot be trusted: at high
 * latitude the Moon can rise and set again inside a few minutes, and a coarse
 * step would step straight over the pair. Every cell whose endpoints share a
 * sign is therefore *proved* empty rather than assumed empty — with a bound on
 * |d(altitude)/dt| the function can reach at most `(a1 + a2 + slope × width)/2`
 * inside the cell, and only cells where that could cross zero are subdivided.
 * Cells near the horizon are the only ones that pay, and there are a few a day.
 */
function scanDay(body: RiseSetBody, location: GeoLocation, dayIndex: number): DayEventPair {
  const track = trackFor(body, dayIndex);
  const frame = frameFor(dayIndex);
  const geometry = new ObserverGeometry(location);
  const dayStart = dayIndex * DAY_MS;
  const dayEnd = dayStart + DAY_MS;
  const f = (ms: number): number => altitudeExcess(track, frame, geometry, ms);

  const rise: number[] = [];
  const set: number[] = [];

  const scan = (loMs: number, hiMs: number, fLo: number, fHi: number, depth: number): void => {
    if (fLo < 0 && fHi >= 0) { rise.push(refine(f, loMs, hiMs, fLo, true)); return; }
    if (fLo >= 0 && fHi < 0) { set.push(refine(f, loMs, hiMs, fLo, false)); return; }
    if (depth >= 12) return;

    const span = MAX_ALTITUDE_SLOPE_DEG_PER_DAY * ((hiMs - loMs) / DAY_MS);
    const highest = (fLo + fHi + span) / 2;
    const lowest = (fLo + fHi - span) / 2;
    if (fLo < 0 ? highest < 0 : lowest >= 0) return;

    const midMs = (loMs + hiMs) / 2;
    const fMid = f(midMs);
    scan(loMs, midMs, fLo, fMid, depth + 1);
    scan(midMs, hiMs, fMid, fHi, depth + 1);
  };

  const stepMs = SCAN_STEP_DAYS * DAY_MS;
  let prevMs = dayStart;
  let prevF = f(prevMs);
  for (let ms = dayStart + stepMs; ; ms += stepMs) {
    const capped = Math.min(ms, dayEnd);
    const value = f(capped);
    scan(prevMs, capped, prevF, value, 0);
    prevMs = capped;
    prevF = value;
    if (capped >= dayEnd) break;
  }

  // A root refined at the very edge can land a hair outside; the contract is
  // "inside this UTC day".
  const inside = (list: number[]): number[] =>
    list.filter((e) => e >= dayStart && e < dayEnd).sort((a, b) => a - b);
  return { rise: inside(rise), set: inside(set) };
}

/**
 * Cache of scanned days, keyed by body, observer and day index.
 *
 * Separate from {@link TRACK_STORE} because a track depends only on the body and
 * the block, and a {@link DayFrame} only on the day, while these depend on the
 * observer too — a calendar view of one place reuses one track across four days
 * and reuses this entry for both directions.
 */
const SCAN_CACHE = new Map<string, DayEventPair>();
const MAX_SCANS = 20_000;

/** Every rise (`+1`) or set (`-1`) of `body` inside UTC day `dayIndex`, ascending. */
export function dayEvents(
  body: RiseSetBody, direction: 1 | -1, location: GeoLocation, dayIndex: number,
): readonly number[] {
  const key = `${body}|${location.latitude}|${location.longitude}|${location.elevation ?? 0}|${dayIndex}`;
  let pair = SCAN_CACHE.get(key);
  if (pair === undefined) {
    pair = scanDay(body, location, dayIndex);
    if (SCAN_CACHE.size >= MAX_SCANS) SCAN_CACHE.clear();
    SCAN_CACHE.set(key, pair);
  }
  return direction === 1 ? pair.rise : pair.set;
}
