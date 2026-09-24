import { getSunPosition } from './sun';
import { getMoonPosition } from './moon';
import { ttDaysSinceJ2000 } from './deltaT';
import { AU_KM } from './frame';
import {
  EARTH_EQUATORIAL_RADIUS_KM, MOON_RADIUS_KM, SUN_RADIUS_AU,
  gastDegrees, observerVector, altitudeDegrees, refractionDegrees,
  eclipticToEquatorial,
} from './topocentric';
import type { GeoLocation } from '../types/location';

const RAD_TO_DEG = 180 / Math.PI;
const DAY_MS = 86_400_000;
const SUN_RADIUS_KM = SUN_RADIUS_AU * AU_KM;

/** Danjon's enlargement of the Earth's *radius*, as Espenak's canon states it. */
const DANJON_ENLARGEMENT = 1 + 1 / 85 - 1 / 594;

const CONTACT_TOLERANCE_MS = 1;

/** `atan2(|a×b|, a·b)`: at sub-degree separations `acos` of the dot loses half its digits. */
function separationDegrees(
  lon1Deg: number, lat1Deg: number, lon2Deg: number, lat2Deg: number,
): number {
  const l1 = lon1Deg / RAD_TO_DEG, b1 = lat1Deg / RAD_TO_DEG;
  const l2 = lon2Deg / RAD_TO_DEG, b2 = lat2Deg / RAD_TO_DEG;
  const c1 = Math.cos(b1), c2 = Math.cos(b2);
  const x1 = c1 * Math.cos(l1), y1 = c1 * Math.sin(l1), z1 = Math.sin(b1);
  const x2 = c2 * Math.cos(l2), y2 = c2 * Math.sin(l2), z2 = Math.sin(b2);
  const cx = y1 * z2 - z1 * y2, cy = z1 * x2 - x1 * z2, cz = x1 * y2 - y1 * x2;
  return Math.atan2(Math.hypot(cx, cy, cz), x1 * x2 + y1 * y2 + z1 * z2) * RAD_TO_DEG;
}

/** Circular-overlap area: *obscuration*, not magnitude. */
export function discObscuration(
  separation: number, discRadius: number, coverRadius: number,
): number {
  if (discRadius <= 0) return 0;
  if (separation >= discRadius + coverRadius) return 0;
  if (separation <= Math.abs(discRadius - coverRadius)) {
    return Math.min(1, (coverRadius * coverRadius) / (discRadius * discRadius));
  }
  const d = separation, r = discRadius, s = coverRadius;
  const a1 = r * r * Math.acos(Math.max(-1, Math.min(1, (d * d + r * r - s * s) / (2 * d * r))));
  const a2 = s * s * Math.acos(Math.max(-1, Math.min(1, (d * d + s * s - r * r) / (2 * d * s))));
  const a3 = 0.5 * Math.sqrt(Math.max(0,
    (-d + r + s) * (d + r - s) * (d - r + s) * (d + r + s)));
  return Math.min(1, (a1 + a2 - a3) / (Math.PI * r * r));
}

/** `f` must be `separation²`: raw separation has a near-kink at a central solar minimum. */
function refineMinimum(
  f: (ms: number) => number, seedMs: number, halfWidthsMs: readonly number[],
): number {
  let t = seedMs;
  for (const h of halfWidthsMs) {
    const y1 = f(t - h), y2 = f(t), y3 = f(t + h);
    const denominator = y1 - 2 * y2 + y3;
    if (denominator <= 0) {
      t = y1 < y2 ? (y1 < y3 ? t - h : t + h) : (y3 < y2 ? t + h : t);
      continue;
    }
    const shift = (h * (y1 - y3)) / (2 * denominator);
    t += Math.max(-h, Math.min(h, shift));
  }
  return t;
}

/** Illinois false position: `f` is convex here, where plain false position stalls
 * on a fixed endpoint. */
function solveCrossing(
  f: (ms: number) => number,
  peakMs: number,
  direction: 1 | -1,
  seedMs: number,
  limitMs: number,
): number | null {
  const fPeak = f(peakMs);
  if (!(fPeak < 0)) return null;

  let lo = peakMs, flo = fPeak;
  let hi = 0, fhi = 0;
  let span = Math.max(seedMs, 60_000);
  let bracketed = false;
  for (let i = 0; i < 12 && span <= limitMs; i++) {
    hi = peakMs + direction * span;
    fhi = f(hi);
    if (fhi >= 0) { bracketed = true; break; }
    lo = hi; flo = fhi;
    span *= 1.6;
  }
  if (!bracketed) {
    hi = peakMs + direction * limitMs;
    fhi = f(hi);
    if (fhi < 0) return null;
  }

  let side = 0;
  for (let i = 0; i < 60; i++) {
    const t = (lo * fhi - hi * flo) / (fhi - flo);
    const ft = f(t);
    if (Math.abs(hi - lo) <= CONTACT_TOLERANCE_MS || ft === 0) return t;
    if (ft < 0) {
      lo = t; flo = ft;
      if (side === -1) fhi /= 2;
      side = -1;
    } else {
      hi = t; fhi = ft;
      if (side === 1) flo /= 2;
      side = 1;
    }
  }
  return (lo + hi) / 2;
}

/** Degrees, at one instant. */
export interface LunarShadow {
  /** Moon to the antisolar point. */
  separation: number;
  umbra: number;
  penumbra: number;
  moonSemidiameter: number;
}

const LUNAR_SHADOW: LunarShadow = {
  separation: 0, umbra: 0, penumbra: 0, moonSemidiameter: 0,
};

/** Meeus ch. 54: Danjon's enlargement lands on both parallaxes, neither solar term. Shared object. */
export function lunarShadowAt(date: Date): LunarShadow {
  const sun = getSunPosition(date);
  const moon = getMoonPosition(date);
  const sunKm = sun.distance * AU_KM;

  const parallaxMoon = Math.asin(EARTH_EQUATORIAL_RADIUS_KM / moon.distance) * RAD_TO_DEG;
  const parallaxSun = Math.asin(EARTH_EQUATORIAL_RADIUS_KM / sunKm) * RAD_TO_DEG;
  const semidiameterSun = Math.asin(SUN_RADIUS_KM / sunKm) * RAD_TO_DEG;

  LUNAR_SHADOW.separation = separationDegrees(
    moon.longitude, moon.latitude, sun.longitude + 180, -sun.latitude,
  );
  const shadowAxis = DANJON_ENLARGEMENT * (parallaxMoon + parallaxSun);
  LUNAR_SHADOW.umbra = shadowAxis - semidiameterSun;
  LUNAR_SHADOW.penumbra = shadowAxis + semidiameterSun;
  LUNAR_SHADOW.moonSemidiameter = Math.asin(MOON_RADIUS_KM / moon.distance) * RAD_TO_DEG;
  return LUNAR_SHADOW;
}

export type LunarEclipseKind = 'penumbral' | 'partial' | 'total';

export interface LunarEclipse {
  kind: LunarEclipseKind;
  peak: Date;
  penumbralBegin: Date;
  penumbralEnd: Date;
  partialBegin: Date | null;
  partialEnd: Date | null;
  totalBegin: Date | null;
  totalEnd: Date | null;
  /** *Diameter* fractions at greatest eclipse. */
  penumbralMagnitude: number;
  umbralMagnitude: number;
  /** Disc *area* inside the umbra, not a magnitude. */
  umbralObscuration: number;
}

const umbralGap = (ms: number): number => {
  const s = lunarShadowAt(new Date(ms));
  return s.separation - (s.umbra + s.moonSemidiameter);
};
const totalityGap = (ms: number): number => {
  const s = lunarShadowAt(new Date(ms));
  return s.separation - (s.umbra - s.moonSemidiameter);
};
const penumbralGap = (ms: number): number => {
  const s = lunarShadowAt(new Date(ms));
  return s.separation - (s.penumbra + s.moonSemidiameter);
};

const lunarSeparationSquared = (ms: number): number => {
  const s = lunarShadowAt(new Date(ms)).separation;
  return s * s;
};

/** Moon 0.5490°/hr less the antisolar point's 0.0410°/hr; seeds a bracket only. */
const LUNAR_SEPARATION_RATE_DEG_PER_MS = 0.5080 / 3_600_000;

/** A penumbral phase runs under 6 h. */
const LUNAR_CONTACT_LIMIT_MS = 5 * 3600_000;

function seedFromChord(leastSeparation: number, threshold: number): number {
  const chord = Math.sqrt(Math.max(0, threshold * threshold - leastSeparation * leastSeparation));
  return chord / LUNAR_SEPARATION_RATE_DEG_PER_MS;
}

/** `oppositionUtc` must be a full moon; `null` if that opposition carries no eclipse. */
export function findLunarEclipse(oppositionUtc: Date): LunarEclipse | null {
  const peakMs = refineMinimum(
    lunarSeparationSquared, oppositionUtc.getTime(), [3600_000, 600_000, 60_000, 5_000],
  );
  const peak = lunarShadowAt(new Date(peakMs));
  const least = peak.separation;
  const umbra = peak.umbra;
  const penumbra = peak.penumbra;
  const moonSemidiameter = peak.moonSemidiameter;

  const penumbralMagnitude = (penumbra + moonSemidiameter - least) / (2 * moonSemidiameter);
  if (penumbralMagnitude <= 0) return null;
  const umbralMagnitude = (umbra + moonSemidiameter - least) / (2 * moonSemidiameter);

  const kind: LunarEclipseKind = umbralMagnitude >= 1
    ? 'total'
    : umbralMagnitude > 0 ? 'partial' : 'penumbral';

  const contact = (
    gap: (ms: number) => number, threshold: number, direction: 1 | -1,
  ): Date | null => {
    const t = solveCrossing(
      gap, peakMs, direction, seedFromChord(least, threshold), LUNAR_CONTACT_LIMIT_MS,
    );
    return t === null ? null : new Date(Math.round(t));
  };

  const penumbralBegin = contact(penumbralGap, penumbra + moonSemidiameter, -1);
  const penumbralEnd = contact(penumbralGap, penumbra + moonSemidiameter, 1);
  if (penumbralBegin === null || penumbralEnd === null) return null;

  const hasUmbra = umbralMagnitude > 0;
  const hasTotality = umbralMagnitude >= 1;

  return {
    kind,
    peak: new Date(Math.round(peakMs)),
    penumbralBegin,
    penumbralEnd,
    partialBegin: hasUmbra ? contact(umbralGap, umbra + moonSemidiameter, -1) : null,
    partialEnd: hasUmbra ? contact(umbralGap, umbra + moonSemidiameter, 1) : null,
    totalBegin: hasTotality ? contact(totalityGap, umbra - moonSemidiameter, -1) : null,
    totalEnd: hasTotality ? contact(totalityGap, umbra - moonSemidiameter, 1) : null,
    penumbralMagnitude,
    umbralMagnitude,
    umbralObscuration: discObscuration(least, moonSemidiameter, umbra),
  };
}

const SUN_VECTOR = /* @__PURE__ */ new Float64Array(3);
const MOON_VECTOR = /* @__PURE__ */ new Float64Array(3);
const OBSERVER_VECTOR = /* @__PURE__ */ new Float64Array(3);
const SUN_TOPOCENTRIC = /* @__PURE__ */ new Float64Array(3);
const MOON_TOPOCENTRIC = /* @__PURE__ */ new Float64Array(3);

/** All angles degrees, topocentric. */
export interface SolarView {
  separation: number;
  sunSemidiameter: number;
  moonSemidiameter: number;
  /** Refracted, of the Sun's centre. */
  sunAltitude: number;
  /** East of north. */
  sunAzimuth: number;
}

const SOLAR_VIEW: SolarView = {
  separation: 0, sunSemidiameter: 0, moonSemidiameter: 0, sunAltitude: 0, sunAzimuth: 0,
};

/** The Moon's 57′ parallax decides who sees totality. Shared object; consume before the next call. */
export function solarViewAt(date: Date, location: GeoLocation): SolarView {
  const ttDays = ttDaysSinceJ2000(date);
  const utDays = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / DAY_MS;
  const t = ttDays / 36525;

  const sun = getSunPosition(date);
  const moon = getMoonPosition(date);
  eclipticToEquatorial(sun.longitude, sun.latitude, sun.distance, t, SUN_VECTOR);
  eclipticToEquatorial(moon.longitude, moon.latitude, moon.distance / AU_KM, t, MOON_VECTOR);

  const gast = gastDegrees(ttDays, utDays);
  observerVector(
    location.latitude, location.longitude, location.elevation ?? 0, gast, OBSERVER_VECTOR,
  );
  for (let i = 0; i < 3; i++) {
    SUN_TOPOCENTRIC[i] = (SUN_VECTOR[i] as number) - (OBSERVER_VECTOR[i] as number);
    MOON_TOPOCENTRIC[i] = (MOON_VECTOR[i] as number) - (OBSERVER_VECTOR[i] as number);
  }

  const sunDistance = Math.hypot(
    SUN_TOPOCENTRIC[0] as number, SUN_TOPOCENTRIC[1] as number, SUN_TOPOCENTRIC[2] as number,
  );
  const moonDistance = Math.hypot(
    MOON_TOPOCENTRIC[0] as number, MOON_TOPOCENTRIC[1] as number, MOON_TOPOCENTRIC[2] as number,
  );

  const dot = (SUN_TOPOCENTRIC[0] as number) * (MOON_TOPOCENTRIC[0] as number)
    + (SUN_TOPOCENTRIC[1] as number) * (MOON_TOPOCENTRIC[1] as number)
    + (SUN_TOPOCENTRIC[2] as number) * (MOON_TOPOCENTRIC[2] as number);
  const cx = (SUN_TOPOCENTRIC[1] as number) * (MOON_TOPOCENTRIC[2] as number)
    - (SUN_TOPOCENTRIC[2] as number) * (MOON_TOPOCENTRIC[1] as number);
  const cy = (SUN_TOPOCENTRIC[2] as number) * (MOON_TOPOCENTRIC[0] as number)
    - (SUN_TOPOCENTRIC[0] as number) * (MOON_TOPOCENTRIC[2] as number);
  const cz = (SUN_TOPOCENTRIC[0] as number) * (MOON_TOPOCENTRIC[1] as number)
    - (SUN_TOPOCENTRIC[1] as number) * (MOON_TOPOCENTRIC[0] as number);

  const geometricAltitude = altitudeDegrees(
    SUN_TOPOCENTRIC, location.latitude, location.longitude, gast,
  );

  SOLAR_VIEW.separation = Math.atan2(Math.hypot(cx, cy, cz), dot) * RAD_TO_DEG;
  SOLAR_VIEW.sunSemidiameter = Math.asin(SUN_RADIUS_AU / sunDistance) * RAD_TO_DEG;
  SOLAR_VIEW.moonSemidiameter =
    Math.asin(MOON_RADIUS_KM / (moonDistance * AU_KM)) * RAD_TO_DEG;
  SOLAR_VIEW.sunAltitude = geometricAltitude + refractionDegrees(geometricAltitude);
  SOLAR_VIEW.sunAzimuth = azimuthDegrees(
    SUN_TOPOCENTRIC, location.latitude, location.longitude, gast,
  );
  return SOLAR_VIEW;
}

function azimuthDegrees(
  vec: Float64Array, latitudeDeg: number, longitudeDeg: number, gastDeg: number,
): number {
  const phi = latitudeDeg / RAD_TO_DEG;
  const local = (gastDeg + longitudeDeg) / RAD_TO_DEG;
  const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
  const x = vec[0] as number, y = vec[1] as number, z = vec[2] as number;
  const cosL = Math.cos(local), sinL = Math.sin(local);
  const east = -x * sinL + y * cosL;
  const north = -x * sinPhi * cosL - y * sinPhi * sinL + z * cosPhi;
  const azimuth = Math.atan2(east, north) * RAD_TO_DEG;
  return azimuth < 0 ? azimuth + 360 : azimuth;
}

export type SolarEclipseKind = 'partial' | 'annular' | 'total';

export interface LocalSolarEclipse {
  kind: SolarEclipseKind;
  peak: Date;
  partialBegin: Date;
  partialEnd: Date;
  /** `null` unless total or annular here. */
  centralBegin: Date | null;
  centralEnd: Date | null;
  /** Disc *area* covered at maximum; `magnitude` is the *diameter* fraction. */
  obscuration: number;
  magnitude: number;
  /** Refracted, degrees. */
  peakAltitude: number;
  beginAltitude: number;
  endAltitude: number;
  /** East of north. */
  peakAzimuth: number;
}

/** A solar contact is never more than ~3 h from local maximum. */
const SOLAR_CONTACT_LIMIT_MS = 3 * 3600_000;

/** Parallax moves the observer's own maximum up to about an hour off conjunction. */
const SOLAR_SEARCH_HALF_WIDTH_MS = 3 * 3600_000;
const SOLAR_SCAN_STEPS = 12;

/** `null` if the observer is outside the penumbra throughout: the common case. */
export function findLocalSolarEclipse(
  conjunctionUtc: Date, location: GeoLocation,
): LocalSolarEclipse | null {
  const separationSquared = (ms: number): number => {
    const s = solarViewAt(new Date(ms), location).separation;
    return s * s;
  };

  const centre = conjunctionUtc.getTime();
  let bestMs = centre;
  let bestValue = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= SOLAR_SCAN_STEPS; i++) {
    const ms = centre - SOLAR_SEARCH_HALF_WIDTH_MS
      + (2 * SOLAR_SEARCH_HALF_WIDTH_MS * i) / SOLAR_SCAN_STEPS;
    const value = separationSquared(ms);
    if (value < bestValue) { bestValue = value; bestMs = ms; }
  }
  const step = (2 * SOLAR_SEARCH_HALF_WIDTH_MS) / SOLAR_SCAN_STEPS;
  const peakMs = refineMinimum(separationSquared, bestMs, [step, step / 6, 60_000, 5_000]);

  const peakView = solarViewAt(new Date(peakMs), location);
  const least = peakView.separation;
  const sunSemidiameter = peakView.sunSemidiameter;
  const moonSemidiameter = peakView.moonSemidiameter;
  const peakAltitude = peakView.sunAltitude;
  const peakAzimuth = peakView.sunAzimuth;

  if (least >= sunSemidiameter + moonSemidiameter) return null;

  const magnitude = (sunSemidiameter + moonSemidiameter - least) / (2 * sunSemidiameter);
  const kind: SolarEclipseKind = least < Math.abs(moonSemidiameter - sunSemidiameter)
    ? (moonSemidiameter >= sunSemidiameter ? 'total' : 'annular')
    : 'partial';

  const probe = 600_000;
  const rate = Math.max(
    1e-12,
    Math.abs(solarViewAt(new Date(peakMs + probe), location).separation - least) / probe,
  );
  const seed = (threshold: number): number =>
    Math.sqrt(Math.max(0, threshold * threshold - least * least)) / rate;

  const outerGap = (ms: number): number => {
    const v = solarViewAt(new Date(ms), location);
    return v.separation - (v.sunSemidiameter + v.moonSemidiameter);
  };
  const innerGap = (ms: number): number => {
    const v = solarViewAt(new Date(ms), location);
    return v.separation - Math.abs(v.moonSemidiameter - v.sunSemidiameter);
  };

  const outerThreshold = sunSemidiameter + moonSemidiameter;
  const innerThreshold = Math.abs(moonSemidiameter - sunSemidiameter);

  const beginMs = solveCrossing(outerGap, peakMs, -1, seed(outerThreshold), SOLAR_CONTACT_LIMIT_MS);
  const endMs = solveCrossing(outerGap, peakMs, 1, seed(outerThreshold), SOLAR_CONTACT_LIMIT_MS);
  if (beginMs === null || endMs === null) return null;

  const central = kind === 'partial'
    ? { begin: null, end: null }
    : {
      begin: solveCrossing(innerGap, peakMs, -1, seed(innerThreshold), SOLAR_CONTACT_LIMIT_MS),
      end: solveCrossing(innerGap, peakMs, 1, seed(innerThreshold), SOLAR_CONTACT_LIMIT_MS),
    };

  const partialBegin = new Date(Math.round(beginMs));
  const partialEnd = new Date(Math.round(endMs));

  return {
    kind,
    peak: new Date(Math.round(peakMs)),
    partialBegin,
    partialEnd,
    centralBegin: central.begin === null ? null : new Date(Math.round(central.begin)),
    centralEnd: central.end === null ? null : new Date(Math.round(central.end)),
    obscuration: discObscuration(least, sunSemidiameter, moonSemidiameter),
    magnitude,
    peakAltitude,
    beginAltitude: solarViewAt(partialBegin, location).sunAltitude,
    endAltitude: solarViewAt(partialEnd, location).sunAltitude,
    peakAzimuth,
  };
}
