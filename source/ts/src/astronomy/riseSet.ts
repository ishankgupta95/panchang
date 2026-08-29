/** Position is fitted in **rectangular** coordinates, never RA: a fit across the 24 h seam is wrong for days at a time. */
import { sin, cos } from './trig';
import { getMoonPositionForTrack } from './moon';
import { getSunPosition } from './sun';
import { ttDaysSinceJ2000 } from './deltaT';
import { nutation, meanObliquityArcsec, ARCSEC_TO_RAD, AU_KM } from './frame';
import {
  REFRACTION_NEAR_HORIZON_DEG, SUN_RADIUS_AU, MOON_RADIUS_KM,
  EARTH_EQUATORIAL_RADIUS_KM, EARTH_FLATTENING_SQUARED,
} from './topocentric';
// Cyclic with `riseSetCache.ts`; safe only as a hoisted function declaration.
import { clearRiseSetEventCache } from './riseSetCache';
import type { GeoLocation } from '../types/location';

const DAY_MS = 86_400_000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MOON_RADIUS_AU = MOON_RADIUS_KM / AU_KM;

export type RiseSetBody = 'sun' | 'moon';

/** Do not widen: ELP carries argument families near a 5-day period, and 8 days is a cliff more nodes do not rescue. */
const TRACK_BLOCK_DAYS = 4;
const TRACK_NODES = 11;

/** Narrow events are caught by the slope bound, not by this step. */
const SCAN_STEP_DAYS = 12 / (60 * 24);

/** Bound on |d(altitude)/dt|: Earth's 360°/day plus ~13° for the fastest body. */
const MAX_ALTITUDE_SLOPE_DEG_PER_DAY = 380;

const ROOT_TOLERANCE_DAYS = 1e-8;

class PositionTrack {
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

/** Per-day, not per-block, so the two days meeting at a midnight agree exactly there. */
class DayFrame {
  /** Arcseconds, at the day's two endpoints. */
  private readonly eqeq0: number;
  private readonly eqeq1: number;
  /** ΔT in days. Per day, not shared scratch: that makes sidereal time build-order dependent. */
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

  /** Greenwich Apparent Sidereal Time, degrees. */
  gast(ms: number): number {
    const utDays = (ms - Date.UTC(2000, 0, 1, 12)) / DAY_MS;
    const theta = 360 * (((0.7790572732640 + 0.00273781191135448 * utDays) % 1 + (utDays % 1)) % 1);
    const frac = (ms - this.dayStartMs) / DAY_MS;
    const eqeq = this.eqeq0 + (this.eqeq1 - this.eqeq0) * frac;
    // The accumulated-precession polynomial takes TT, never UT.
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

/** The fourth store lives in `riseSetCache.ts` and must stay in this list. */
export function clearRiseSetTracks(): void {
  TRACK_STORE.clear();
  FRAME_STORE.clear();
  SCAN_CACHE.clear();
  clearRiseSetEventCache();
}

const BODY_VEC = new Float64Array(3);

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

/** The **upper limb** above the refracted horizon. Parallax is not a separate term: it falls out of subtracting the observer's position. */
function altitudeExcess(
  track: PositionTrack, frame: DayFrame, geometry: ObserverGeometry, ms: number,
): number {
  track.position(ms, BODY_VEC);
  const local = (frame.gast(ms) + geometry.longitude) * DEG_TO_RAD;
  // `trig.ts`, not `Math.cos`: innermost expression in the module.
  const cosLocal = cos(local);
  const sinLocal = sin(local);

  const x = (BODY_VEC[0] as number) - geometry.equatorialAu * cosLocal;
  const y = (BODY_VEC[1] as number) - geometry.equatorialAu * sinLocal;
  const z = (BODY_VEC[2] as number) - geometry.polarAu;
  // Not `Math.hypot`: V8 will not inline it, and nothing here can overflow.
  const distance = Math.sqrt(x * x + y * y + z * z);

  const dot = (x * geometry.cosPhi * cosLocal
    + y * geometry.cosPhi * sinLocal
    + z * geometry.sinPhi) / distance;
  const centre = Math.asin(dot < -1 ? -1 : dot > 1 ? 1 : dot) * RAD_TO_DEG;
  return centre + (track.radiusAu / distance) * RAD_TO_DEG + REFRACTION_NEAR_HORIZON_DEG;
}

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

interface DayEventPair {
  rise: number[];
  set: number[];
}

/** At high latitude the Moon can rise and set again inside minutes, so a cell is *proved* empty by the slope bound, never assumed. */
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

  // A root refined at the edge can land a hair outside the UTC day it belongs to.
  const inside = (list: number[]): number[] =>
    list.filter((e) => e >= dayStart && e < dayEnd).sort((a, b) => a - b);
  return { rise: inside(rise), set: inside(set) };
}

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
