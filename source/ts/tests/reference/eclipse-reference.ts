/**
 * A frozen, deliberately slow reference for `src/astronomy/eclipseGeometry.ts`.
 * The shadow formulas are transcribed independently rather than imported, so a
 * mistake in one is not shared by the other; the ephemeris is shared on purpose,
 * so that what is left in the residual is search error alone.
 */
import { getSunPosition } from '../../src/astronomy/sun';
import { getMoonPosition } from '../../src/astronomy/moon';
import { ttDaysSinceJ2000 } from '../../src/astronomy/deltaT';
import { nutation, meanObliquityArcsec, ARCSEC_TO_RAD, AU_KM } from '../../src/astronomy/frame';
import {
  EARTH_EQUATORIAL_RADIUS_KM, MOON_RADIUS_KM, SUN_RADIUS_AU,
  gastDegrees, observerVector, altitudeDegrees, refractionDegrees,
} from '../../src/astronomy/topocentric';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const SUN_RADIUS_KM = SUN_RADIUS_AU * AU_KM;

/** Danjon's enlargement of the Earth's shadow radius. */
const DANJON = 1 + 1 / 85 - 1 / 594;

export interface ReferenceObserver {
  latitude: number;
  longitude: number;
  elevation?: number;
}

function toEquatorial(
  lonDeg: number, latDeg: number, distance: number, t: number,
): [number, number, number] {
  const eps = (meanObliquityArcsec(t) + nutation(t).deps) * ARCSEC_TO_RAD;
  const lon = lonDeg * DEG_TO_RAD;
  const lat = latDeg * DEG_TO_RAD;
  const x = distance * Math.cos(lat) * Math.cos(lon);
  const y = distance * Math.cos(lat) * Math.sin(lon);
  const z = distance * Math.sin(lat);
  return [x, Math.cos(eps) * y - Math.sin(eps) * z, Math.sin(eps) * y + Math.cos(eps) * z];
}

function angleBetween(
  a: [number, number, number], b: [number, number, number],
): number {
  const cx = a[1] * b[2] - a[2] * b[1];
  const cy = a[2] * b[0] - a[0] * b[2];
  const cz = a[0] * b[1] - a[1] * b[0];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.atan2(Math.hypot(cx, cy, cz), dot) * RAD_TO_DEG;
}

export function scanRoots(
  f: (ms: number) => number, fromMs: number, toMs: number, stepMs: number,
): number[] {
  const roots: number[] = [];
  let previousMs = fromMs;
  let previousF = f(previousMs);
  for (let ms = fromMs + stepMs; ms <= toMs; ms += stepMs) {
    const value = f(ms);
    if ((previousF < 0) !== (value < 0)) {
      let lo = previousMs, hi = ms, fLo = previousF;
      while (hi - lo > 1) {
        const mid = (lo + hi) / 2;
        const fMid = f(mid);
        if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else hi = mid;
      }
      roots.push((lo + hi) / 2);
    }
    previousMs = ms;
    previousF = value;
  }
  return roots;
}

/**
 * Do not replace this with golden section. Near a flat minimum, adjacent samples
 * differ by ~10⁻¹⁴, at or below the cancellation noise of an `atan2` of a cross
 * product, and once a comparison is decided by noise golden section can bracket
 * away the true minimum irrecoverably.
 */
export function scanMinimum(
  f: (ms: number) => number, fromMs: number, toMs: number, stepMs: number,
): number {
  const sweep = (lo: number, hi: number, step: number, seed: number): number => {
    let bestMs = seed;
    let bestValue = f(seed);
    for (let ms = lo; ms <= hi; ms += step) {
      const value = f(ms);
      if (value < bestValue) { bestValue = value; bestMs = ms; }
    }
    return bestMs;
  };
  const coarse = sweep(fromMs, toMs, stepMs, fromMs);
  const second = sweep(coarse - stepMs, coarse + stepMs, 1000, coarse);
  return sweep(second - 1000, second + 1000, 1, second);
}

export interface ReferenceLunarShadow {
  separation: number;
  umbra: number;
  penumbra: number;
  moonSemidiameter: number;
}

export function lunarShadowReference(ms: number): ReferenceLunarShadow {
  const date = new Date(ms);
  const sun = getSunPosition(date);
  const moon = getMoonPosition(date);
  const sunKm = sun.distance * AU_KM;

  const parallaxMoon = Math.asin(EARTH_EQUATORIAL_RADIUS_KM / moon.distance) * RAD_TO_DEG;
  const parallaxSun = Math.asin(EARTH_EQUATORIAL_RADIUS_KM / sunKm) * RAD_TO_DEG;
  const semidiameterSun = Math.asin(SUN_RADIUS_KM / sunKm) * RAD_TO_DEG;
  const axis = DANJON * (parallaxMoon + parallaxSun);

  const moonVector = toEquatorial(moon.longitude, moon.latitude, 1, ttDaysSinceJ2000(date) / 36525);
  const antisolar = toEquatorial(
    sun.longitude + 180, -sun.latitude, 1, ttDaysSinceJ2000(date) / 36525,
  );

  return {
    separation: angleBetween(moonVector, antisolar),
    umbra: axis - semidiameterSun,
    penumbra: axis + semidiameterSun,
    moonSemidiameter: Math.asin(MOON_RADIUS_KM / moon.distance) * RAD_TO_DEG,
  };
}

export interface ReferenceLunarEclipse {
  kind: 'penumbral' | 'partial' | 'total';
  peakMs: number;
  penumbralBeginMs: number;
  penumbralEndMs: number;
  partialBeginMs: number | null;
  partialEndMs: number | null;
  totalBeginMs: number | null;
  totalEndMs: number | null;
  penumbralMagnitude: number;
  umbralMagnitude: number;
}

export function lunarEclipseReference(
  centreMs: number, halfWidthMs = 6 * 3600_000,
): ReferenceLunarEclipse | null {
  const from = centreMs - halfWidthMs;
  const to = centreMs + halfWidthMs;
  const peakMs = scanMinimum((ms) => lunarShadowReference(ms).separation, from, to, 60_000);
  const peak = lunarShadowReference(peakMs);
  const sm = peak.moonSemidiameter;

  const penumbralMagnitude = (peak.penumbra + sm - peak.separation) / (2 * sm);
  if (penumbralMagnitude <= 0) return null;
  const umbralMagnitude = (peak.umbra + sm - peak.separation) / (2 * sm);

  const scanWindow = 6 * 3600_000;
  const roots = (kind: 'penumbra' | 'umbra' | 'totality'): number[] => scanRoots(
    (ms) => {
      const s = lunarShadowReference(ms);
      if (kind === 'penumbra') return s.separation - (s.penumbra + s.moonSemidiameter);
      if (kind === 'umbra') return s.separation - (s.umbra + s.moonSemidiameter);
      return s.separation - (s.umbra - s.moonSemidiameter);
    },
    peakMs - scanWindow, peakMs + scanWindow, 60_000,
  );

  const pair = (list: number[]): [number | null, number | null] => {
    const before = list.filter((ms) => ms < peakMs);
    const after = list.filter((ms) => ms > peakMs);
    return [before.length > 0 ? (before[before.length - 1] as number) : null,
      after.length > 0 ? (after[0] as number) : null];
  };

  const [penumbralBeginMs, penumbralEndMs] = pair(roots('penumbra'));
  if (penumbralBeginMs === null || penumbralEndMs === null) return null;
  const [partialBeginMs, partialEndMs] = umbralMagnitude > 0
    ? pair(roots('umbra')) : [null, null];
  const [totalBeginMs, totalEndMs] = umbralMagnitude >= 1
    ? pair(roots('totality')) : [null, null];

  return {
    kind: umbralMagnitude >= 1 ? 'total' : umbralMagnitude > 0 ? 'partial' : 'penumbral',
    peakMs,
    penumbralBeginMs,
    penumbralEndMs,
    partialBeginMs,
    partialEndMs,
    totalBeginMs,
    totalEndMs,
    penumbralMagnitude,
    umbralMagnitude,
  };
}

export interface ReferenceSolarView {
  separation: number;
  sunSemidiameter: number;
  moonSemidiameter: number;
  sunAltitude: number;
}

export function solarViewReference(ms: number, observer: ReferenceObserver): ReferenceSolarView {
  const date = new Date(ms);
  const ttDays = ttDaysSinceJ2000(date);
  const utDays = (ms - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const t = ttDays / 36525;

  const sun = getSunPosition(date);
  const moon = getMoonPosition(date);
  const sunVector = toEquatorial(sun.longitude, sun.latitude, sun.distance, t);
  const moonVector = toEquatorial(moon.longitude, moon.latitude, moon.distance / AU_KM, t);

  const gast = gastDegrees(ttDays, utDays);
  const observerAu = new Float64Array(3);
  observerVector(
    observer.latitude, observer.longitude, observer.elevation ?? 0, gast, observerAu,
  );
  const sunTopo: [number, number, number] = [
    sunVector[0] - (observerAu[0] as number),
    sunVector[1] - (observerAu[1] as number),
    sunVector[2] - (observerAu[2] as number),
  ];
  const moonTopo: [number, number, number] = [
    moonVector[0] - (observerAu[0] as number),
    moonVector[1] - (observerAu[1] as number),
    moonVector[2] - (observerAu[2] as number),
  ];

  const sunDistance = Math.hypot(sunTopo[0], sunTopo[1], sunTopo[2]);
  const moonDistance = Math.hypot(moonTopo[0], moonTopo[1], moonTopo[2]);
  const geometric = altitudeDegrees(
    Float64Array.from(sunTopo), observer.latitude, observer.longitude, gast,
  );

  return {
    separation: angleBetween(sunTopo, moonTopo),
    sunSemidiameter: Math.asin(SUN_RADIUS_AU / sunDistance) * RAD_TO_DEG,
    moonSemidiameter: Math.asin(MOON_RADIUS_KM / (moonDistance * AU_KM)) * RAD_TO_DEG,
    sunAltitude: geometric + refractionDegrees(geometric),
  };
}

export interface ReferenceSolarEclipse {
  kind: 'partial' | 'annular' | 'total';
  peakMs: number;
  partialBeginMs: number;
  partialEndMs: number;
  magnitude: number;
}

export function localSolarEclipseReference(
  centreMs: number, observer: ReferenceObserver, halfWidthMs = 4 * 3600_000,
): ReferenceSolarEclipse | null {
  const from = centreMs - halfWidthMs;
  const to = centreMs + halfWidthMs;
  const peakMs = scanMinimum(
    (ms) => solarViewReference(ms, observer).separation, from, to, 60_000,
  );
  const peak = solarViewReference(peakMs, observer);
  if (peak.separation >= peak.sunSemidiameter + peak.moonSemidiameter) return null;

  const roots = scanRoots(
    (ms) => {
      const v = solarViewReference(ms, observer);
      return v.separation - (v.sunSemidiameter + v.moonSemidiameter);
    },
    peakMs - halfWidthMs, peakMs + halfWidthMs, 60_000,
  );
  const before = roots.filter((ms) => ms < peakMs);
  const after = roots.filter((ms) => ms > peakMs);
  if (before.length === 0 || after.length === 0) return null;

  return {
    kind: peak.separation < Math.abs(peak.moonSemidiameter - peak.sunSemidiameter)
      ? (peak.moonSemidiameter >= peak.sunSemidiameter ? 'total' : 'annular')
      : 'partial',
    peakMs,
    partialBeginMs: before[before.length - 1] as number,
    partialEndMs: after[0] as number,
    magnitude:
      (peak.sunSemidiameter + peak.moonSemidiameter - peak.separation) / (2 * peak.sunSemidiameter),
  };
}

/**
 * The Besselian gamma: the least distance of the Moon's shadow axis from the
 * Earth's centre, in Earth equatorial radii, positive when the axis passes north
 * of the centre. NASA publishes it to four decimals for every solar eclipse.
 */
export function shadowAxisGamma(ms: number): number {
  const date = new Date(ms);
  const t = ttDaysSinceJ2000(date) / 36525;
  const sun = getSunPosition(date);
  const moon = getMoonPosition(date);
  const s = toEquatorial(sun.longitude, sun.latitude, sun.distance, t);
  const m = toEquatorial(moon.longitude, moon.latitude, moon.distance / AU_KM, t);

  const dx = m[0] - s[0], dy = m[1] - s[1], dz = m[2] - s[2];
  const length = Math.hypot(dx, dy, dz);
  const ux = dx / length, uy = dy / length, uz = dz / length;

  const along = m[0] * ux + m[1] * uy + m[2] * uz;
  const px = m[0] - along * ux, py = m[1] - along * uy, pz = m[2] - along * uz;

  const nz = 1 - uz * uz;
  const nx = -uz * ux, ny = -uz * uy;
  const nLength = Math.hypot(nx, ny, nz);

  const distanceAu = Math.hypot(px, py, pz);
  const signed = (px * nx + py * ny + pz * nz) / nLength;
  return (Math.sign(signed) * distanceAu * AU_KM) / EARTH_EQUATORIAL_RADIUS_KM;
}

export function greatestSolarEclipseReference(
  centreMs: number, halfWidthMs = 6 * 3600_000,
): number {
  return scanMinimum(
    (ms) => Math.abs(shadowAxisGamma(ms)), centreMs - halfWidthMs, centreMs + halfWidthMs, 60_000,
  );
}
