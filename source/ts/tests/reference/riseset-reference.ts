/**
 * The frozen reference rise/set solver: `src/astronomy/riseSet.ts` with every
 * optimization removed, so the only difference left is interpolation error and
 * `differential-riseset.test.ts` measures it. Sharing the ephemeris is
 * deliberate: series accuracy is answered in `tier0-own-sun-moon.test.ts`.
 */
import { getMoonPosition } from '../../src/astronomy/moon';
import { getSunPosition } from '../../src/astronomy/sun';
import { ttDaysSinceJ2000 } from '../../src/astronomy/deltaT';
import { nutation, meanObliquityArcsec, ARCSEC_TO_RAD, AU_KM } from '../../src/astronomy/frame';
import {
  gastDegrees, observerVector, altitudeDegrees, REFRACTION_NEAR_HORIZON_DEG,
  SUN_RADIUS_AU, MOON_RADIUS_KM,
} from '../../src/astronomy/topocentric';

const DAY_MS = 86_400_000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MOON_RADIUS_AU = MOON_RADIUS_KM / AU_KM;

export interface ReferenceObserver {
  latitude: number;
  longitude: number;
  elevation?: number;
}

/** Altitude of the upper limb above the refracted horizon; zero at rise and set. */
export function altitudeExcessReference(
  body: 'sun' | 'moon', ms: number, observer: ReferenceObserver,
): number {
  const date = new Date(ms);
  const ttDays = ttDaysSinceJ2000(date);
  const utDays = (ms - Date.UTC(2000, 0, 1, 12)) / DAY_MS;
  const t = ttDays / 36525;

  let lonDeg: number, latDeg: number, distAu: number, radiusAu: number;
  if (body === 'sun') {
    const p = getSunPosition(date);
    lonDeg = p.longitude; latDeg = p.latitude; distAu = p.distance;
    radiusAu = SUN_RADIUS_AU;
  } else {
    const p = getMoonPosition(date);
    lonDeg = p.longitude; latDeg = p.latitude; distAu = p.distance / AU_KM;
    radiusAu = MOON_RADIUS_AU;
  }

  const eps = (meanObliquityArcsec(t) + nutation(t).deps) * ARCSEC_TO_RAD;
  const lon = lonDeg * DEG_TO_RAD;
  const lat = latDeg * DEG_TO_RAD;
  const cosLat = distAu * Math.cos(lat);
  const ex = cosLat * Math.cos(lon);
  const ey = cosLat * Math.sin(lon);
  const ez = distAu * Math.sin(lat);
  const bodyVec = new Float64Array([
    ex, Math.cos(eps) * ey - Math.sin(eps) * ez, Math.sin(eps) * ey + Math.cos(eps) * ez,
  ]);

  const gast = gastDegrees(ttDays, utDays);
  const obs = new Float64Array(3);
  observerVector(observer.latitude, observer.longitude, observer.elevation ?? 0, gast, obs);
  const topo = new Float64Array([
    (bodyVec[0] as number) - (obs[0] as number),
    (bodyVec[1] as number) - (obs[1] as number),
    (bodyVec[2] as number) - (obs[2] as number),
  ]);
  const distance = Math.hypot(topo[0] as number, topo[1] as number, topo[2] as number);
  return altitudeDegrees(topo, observer.latitude, observer.longitude, gast)
    + Math.asin(radiusAu / distance) * RAD_TO_DEG
    + REFRACTION_NEAR_HORIZON_DEG;
}

/** Every rise (`+1`) or set (`-1`) inside UTC day `dayIndex`, bisected to a ms. */
export function dayEventsReference(
  body: 'sun' | 'moon', direction: 1 | -1, observer: ReferenceObserver, dayIndex: number,
): number[] {
  const dayStart = dayIndex * DAY_MS;
  const dayEnd = dayStart + DAY_MS;
  const step = 30_000;
  const f = (ms: number): number => direction * altitudeExcessReference(body, ms, observer);

  const events: number[] = [];
  let prevMs = dayStart;
  let prevF = f(prevMs);
  for (let ms = dayStart + step; ms <= dayEnd; ms += step) {
    const value = f(ms);
    if (prevF < 0 && value >= 0) {
      let lo = prevMs, hi = ms, fLo = prevF;
      while (hi - lo > 1) {
        const mid = (lo + hi) / 2;
        const fMid = f(mid);
        if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else hi = mid;
      }
      const root = (lo + hi) / 2;
      if (root >= dayStart && root < dayEnd) events.push(root);
    }
    prevMs = ms;
    prevF = value;
  }
  return events;
}
