/**
 * Eclipse geometry — Phase 36.5's replacement for `SearchLunarEclipse`,
 * `NextLunarEclipse`, `SearchLocalSolarEclipse` and `NextLocalSolarEclipse`.
 *
 * This is the last `astronomy-engine` import in `src/`, and it goes last
 * because it is the hardest, not because it is exempt (PLAN.md §36.5).
 *
 * ## Two problems, not one
 *
 * **Lunar is shadow geometry.** The Earth casts a cone; the Moon is inside it
 * or it is not. Every observer who can see the Moon sees the same contact
 * times, so "local circumstances" collapses to *is the Moon above the horizon*.
 * Everything needed is the geocentric separation of the Moon from the
 * antisolar point and the two shadow radii at the Moon's distance.
 *
 * **Solar is a shadow cast on a rotating ellipsoid.** Contact times differ by
 * minutes between neighbouring towns. The classical route is Besselian
 * elements projected onto the fundamental plane; the route taken here is
 * direct — build the observer's own topocentric directions to the Sun and the
 * Moon and compare their separation against the sum of the topocentric
 * semidiameters. That is the same predicate, expressed where the observer
 * already is, and it reuses `topocentric.ts` rather than introducing a second
 * frame chain. It is also *deliberately* a different formulation from the one
 * NASA publishes its elements in, which is what makes
 * `tests/validation/tier0-own-eclipses.test.ts` an independent check rather
 * than a restatement.
 *
 * ## The shadow enlargement, and how the constant was chosen
 *
 * The Earth's shadow is larger than pure geometry predicts, because the
 * atmosphere refracts and absorbs the grazing sunlight that would otherwise
 * fill the umbra's edge. There is no first-principles value for the excess —
 * it is a **convention**, and the two conventions in circulation are not
 * interchangeable:
 *
 * - enlarge the two shadow **radii** by 2%, or
 * - enlarge the **Earth's radius** by Danjon's factor and let the cone geometry
 *   propagate it.
 *
 * They differ by ~1% in the penumbra and ~0.3% in the umbra, which is worth
 * 0.03 of penumbral magnitude and several minutes of penumbral duration — far
 * above the canon's published precision, so the choice is measurable rather
 * than a matter of taste. It was measured: inverting the 457 published
 * magnitudes in `tests/fixtures/nasa-eclipses.json` for the radius each implies
 * gives a **2% multiplier that is not constant** (1.0137 on the umbra against
 * 1.0080 on the penumbra — the two disagree by 20× their own scatter), and a
 * **Danjon multiplier that is** (1.00989 and 1.01016, agreeing to 0.03%).
 * Both land on 1 + 1/85 − 1/594 = 1.010081, which is Danjon's rule in the form
 * Espenak's canon states. That is the constant below, and it is the canon's
 * choice identified from the canon's own numbers rather than assumed.
 *
 * ## §36.0 H
 *
 * The obvious transcription of all of this lives in
 * `tests/reference/eclipse-reference.ts`, frozen, and
 * `tests/validation/differential-eclipse.test.ts` holds this module against it.
 * The searches here — the parabolic peak refinement and the seeded bracket —
 * are the "fast third" of *correct, frozen, fast*; the reference solves the
 * same equations by dense scan and bisection and shares no code with them.
 */
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

/**
 * Danjon's atmospheric enlargement of the **Earth's radius** for shadow
 * geometry: 1 + 1/85 − 1/594. See the module header — this is a published
 * convention, not a derived constant, and it is the one the NASA canon's own
 * magnitudes were shown to carry.
 */
const DANJON_ENLARGEMENT = 1 + 1 / 85 - 1 / 594;

/** Convergence tolerance for every contact solve, milliseconds. */
const CONTACT_TOLERANCE_MS = 1;

// ---------------------------------------------------------------------------
// Shared small geometry
// ---------------------------------------------------------------------------

/**
 * Angular separation of two directions given as (longitude, latitude) in
 * degrees, returned in degrees.
 *
 * Built from the cross and dot products rather than from `acos` of the dot
 * alone. Both eclipse predicates ask about separations under a degree, where
 * `acos` loses half its significant digits — `atan2(|a×b|, a·b)` keeps them,
 * and costs one extra square root.
 */
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

/**
 * Fraction of a disc of angular radius `discRadius` covered by a disc of
 * angular radius `coverRadius` whose centre is `separation` away — the
 * circular-overlap area formula, all arguments in the same angular unit.
 *
 * This is *obscuration* (area), not *magnitude* (diameter). Both are published
 * for eclipses and they are routinely confused — 4.x and 5.0.0-rc published
 * this quantity as `EclipseInfo.magnitude`, which is what the rename to
 * `EclipseInfo.obscuration` corrects. The diameter fraction lives on
 * {@link LunarEclipse.umbralMagnitude} and {@link SolarEclipse.magnitude}.
 */
export function discObscuration(
  separation: number, discRadius: number, coverRadius: number,
): number {
  if (discRadius <= 0) return 0;
  if (separation >= discRadius + coverRadius) return 0;
  if (separation <= Math.abs(discRadius - coverRadius)) {
    // Either fully covered, or the covering disc sits entirely inside — the
    // annular case, where the ratio of areas is the answer.
    return Math.min(1, (coverRadius * coverRadius) / (discRadius * discRadius));
  }
  const d = separation, r = discRadius, s = coverRadius;
  const a1 = r * r * Math.acos(Math.max(-1, Math.min(1, (d * d + r * r - s * s) / (2 * d * r))));
  const a2 = s * s * Math.acos(Math.max(-1, Math.min(1, (d * d + s * s - r * r) / (2 * d * s))));
  const a3 = 0.5 * Math.sqrt(Math.max(0,
    (-d + r + s) * (d + r - s) * (d - r + s) * (d + r + s)));
  return Math.min(1, (a1 + a2 - a3) / (Math.PI * r * r));
}

// ---------------------------------------------------------------------------
// Root finding, shared by both halves
// ---------------------------------------------------------------------------

/**
 * The instant of least separation, refined from `seedMs` by repeated parabolic
 * fits with a shrinking half-width.
 *
 * `separation²` is very nearly a parabola in time near its minimum — the two
 * bodies' relative motion is linear to well inside a day — so the vertex of a
 * three-point fit lands close on the first pass and the shrinking width mops up
 * the cubic residual. Squared, not raw: at a central solar eclipse the raw
 * separation has a near-kink at its minimum and its square does not.
 *
 * Four passes rather than three. The fourth is the one that matters at a total
 * eclipse, where the profile is flattest — measured against an exhaustive
 * millisecond scan of the 2017-08-21 maximum at Casper, three passes land 18 ms
 * out and four land inside 1 ms. Physically 18 ms is nothing; the reason to
 * spend three more position reads on it is that it makes
 * `differential-eclipse.test.ts` measure the *approximation* rather than the
 * approximation's own noise floor.
 *
 * A minimiser rather than a root finder because the peak is defined as an
 * extremum, and turning it into `d/dt = 0` would need a numerical derivative
 * whose step is a second free parameter to justify.
 */
function refineMinimum(
  f: (ms: number) => number, seedMs: number, halfWidthsMs: readonly number[],
): number {
  let t = seedMs;
  for (const h of halfWidthsMs) {
    const y1 = f(t - h), y2 = f(t), y3 = f(t + h);
    const denominator = y1 - 2 * y2 + y3;
    // A non-positive denominator means the three samples are not bracketing a
    // minimum (a straight line, or a maximum). Keep the best sample and let the
    // next, narrower pass try again rather than stepping somewhere arbitrary.
    if (denominator <= 0) {
      t = y1 < y2 ? (y1 < y3 ? t - h : t + h) : (y3 < y2 ? t + h : t);
      continue;
    }
    const shift = (h * (y1 - y3)) / (2 * denominator);
    // The vertex of a fit over [-h, h] cannot legitimately lie far outside it.
    t += Math.max(-h, Math.min(h, shift));
  }
  return t;
}

/**
 * The instant at which `f` crosses zero, searching outward from `peakMs` in
 * `direction`, given that `f(peakMs) < 0` and `f` rises away from the peak.
 *
 * `seedMs` is a first estimate of how far the crossing is — for a separation
 * growing at a near-constant rate `v` from a minimum `γ₀` toward a threshold
 * `γ₁`, that is `√(γ₁² − γ₀²) / v`, which is accurate to a few per cent. The
 * seed is used to *bracket*, not to answer: whatever it proposes, the interval
 * is widened until the sign actually changes, so a bad seed costs probes and
 * never costs correctness.
 *
 * Inside the bracket, the Illinois variant of false position. Plain false
 * position stalls when one endpoint stays fixed — which is exactly what happens
 * here, because the function is convex over the interval — and Illinois's
 * halving of the stale endpoint restores superlinear convergence while keeping
 * the bracket, so the answer can never leave the interval the sign change
 * proved it was in.
 */
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
    // One last try at the outer limit, so a seed that under-estimated badly
    // still finds a crossing that is genuinely inside the window.
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

// ---------------------------------------------------------------------------
// Lunar
// ---------------------------------------------------------------------------

/** The four angles a lunar eclipse is decided by, all degrees, at one instant. */
export interface LunarShadow {
  /** Moon's angular separation from the antisolar point. */
  separation: number;
  /** Angular radius of the umbra at the Moon's distance. */
  umbra: number;
  /** Angular radius of the penumbra at the Moon's distance. */
  penumbra: number;
  /** Moon's angular semidiameter. */
  moonSemidiameter: number;
}

const LUNAR_SHADOW: LunarShadow = {
  separation: 0, umbra: 0, penumbra: 0, moonSemidiameter: 0,
};

/**
 * Earth's shadow at the Moon, at a UTC instant (Meeus ch. 54).
 *
 * The umbral cone has half-angle `s☉ − π🜨` and the penumbral cone `s☉ + π🜨`,
 * so at the Moon's distance the two radii are `π☾ + π☉ ∓ s☉` — one line of
 * similar triangles, with the parallaxes doing the work of converting the
 * Earth's radius into an angle at the Moon. Danjon's enlargement multiplies the
 * Earth's radius, so it lands on both parallaxes and on neither solar term.
 *
 * Returns a shared object; callers must consume it before the next call.
 */
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
  /** Greatest eclipse — the instant of least separation from the shadow axis. */
  peak: Date;
  /** First and last penumbral contact (P1 / P4). Always present. */
  penumbralBegin: Date;
  penumbralEnd: Date;
  /** First and last umbral contact (U1 / U4); `null` for a penumbral eclipse. */
  partialBegin: Date | null;
  partialEnd: Date | null;
  /** Totality (U2 / U3); `null` unless the eclipse is total. */
  totalBegin: Date | null;
  totalEnd: Date | null;
  /** Penumbral magnitude at greatest eclipse — a *diameter* fraction. */
  penumbralMagnitude: number;
  /** Umbral magnitude at greatest eclipse — a *diameter* fraction. */
  umbralMagnitude: number;
  /** Fraction of the Moon's disc **area** inside the umbra at greatest eclipse. */
  umbralObscuration: number;
}

/** Separation minus the umbral-contact threshold — negative while in umbra. */
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

/** Squared separation from the shadow axis, the quantity greatest eclipse minimises. */
const lunarSeparationSquared = (ms: number): number => {
  const s = lunarShadowAt(new Date(ms)).separation;
  return s * s;
};

/**
 * Mean rate of change of the Moon's separation from the antisolar point,
 * degrees per millisecond. The Moon advances 0.5490°/hr and the antisolar point
 * 0.0410°/hr in the same direction, leaving 0.5080°/hr of relative motion.
 * Used only to seed a bracket, so its ±13% variation over an anomalistic month
 * costs probes rather than accuracy.
 */
const LUNAR_SEPARATION_RATE_DEG_PER_MS = 0.5080 / 3_600_000;

/** How far a contact can be from greatest eclipse. A penumbral phase runs <6 h. */
const LUNAR_CONTACT_LIMIT_MS = 5 * 3600_000;

/**
 * Time from greatest eclipse to the crossing of `threshold`, from the
 * right-triangle approximation `√(threshold² − least²) / rate`.
 */
function seedFromChord(leastSeparation: number, threshold: number): number {
  const chord = Math.sqrt(Math.max(0, threshold * threshold - leastSeparation * leastSeparation));
  return chord / LUNAR_SEPARATION_RATE_DEG_PER_MS;
}

/**
 * The lunar eclipse bracketing `oppositionUtc`, or `null` if that opposition
 * carries no eclipse.
 *
 * `oppositionUtc` should be a full moon (elongation 180°); greatest eclipse
 * sits within an hour or so of it, and the parabolic refinement covers that
 * comfortably.
 */
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
  // A penumbral magnitude above zero guarantees both of these exist; if the
  // solver still failed, the geometry and the search disagree and that is a bug
  // rather than a "no eclipse" answer.
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

// ---------------------------------------------------------------------------
// Solar — direct topocentric
// ---------------------------------------------------------------------------

const SUN_VECTOR = new Float64Array(3);
const MOON_VECTOR = new Float64Array(3);
const OBSERVER_VECTOR = new Float64Array(3);
const SUN_TOPOCENTRIC = new Float64Array(3);
const MOON_TOPOCENTRIC = new Float64Array(3);

/** The three angles a solar eclipse is decided by, plus the Sun's altitude. */
export interface SolarView {
  /** Topocentric Sun–Moon angular separation, degrees. */
  separation: number;
  /** Topocentric semidiameter of the Sun, degrees. */
  sunSemidiameter: number;
  /** Topocentric semidiameter of the Moon, degrees. */
  moonSemidiameter: number;
  /** Refracted altitude of the Sun's centre, degrees. */
  sunAltitude: number;
  /** Azimuth of the Sun, degrees east of north. */
  sunAzimuth: number;
}

const SOLAR_VIEW: SolarView = {
  separation: 0, sunSemidiameter: 0, moonSemidiameter: 0, sunAltitude: 0, sunAzimuth: 0,
};

/**
 * The observer's own view of the Sun and the Moon at a UTC instant.
 *
 * The whole solar eclipse reduces to this: two directions and two angular
 * radii, all as seen from where the observer actually stands. Parallax is the
 * entire difficulty — the Moon's is 57′, about twice its own diameter, so a
 * geocentric answer is not merely imprecise but categorically wrong about who
 * sees totality.
 *
 * Returns a shared object; callers must consume it before the next call.
 */
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

/**
 * Azimuth of a topocentric direction, degrees east of north.
 *
 * Only the eclipse path needs it — it is one of the columns NASA publishes per
 * site, so validating against it is free evidence that the observer's frame is
 * oriented correctly and not merely scaled correctly. An altitude comparison
 * alone cannot catch a longitude sign error; an azimuth comparison can.
 */
function azimuthDegrees(
  vec: Float64Array, latitudeDeg: number, longitudeDeg: number, gastDeg: number,
): number {
  const phi = latitudeDeg / RAD_TO_DEG;
  const local = (gastDeg + longitudeDeg) / RAD_TO_DEG;
  const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
  const x = vec[0] as number, y = vec[1] as number, z = vec[2] as number;
  // Rotate into the local horizon frame: east, north, up.
  const cosL = Math.cos(local), sinL = Math.sin(local);
  const east = -x * sinL + y * cosL;
  const north = -x * sinPhi * cosL - y * sinPhi * sinL + z * cosPhi;
  const azimuth = Math.atan2(east, north) * RAD_TO_DEG;
  return azimuth < 0 ? azimuth + 360 : azimuth;
}

export type SolarEclipseKind = 'partial' | 'annular' | 'total';

export interface LocalSolarEclipse {
  kind: SolarEclipseKind;
  /** Maximum eclipse **for this observer** — not the geocentric greatest eclipse. */
  peak: Date;
  /** First and last contact (C1 / C4). */
  partialBegin: Date;
  partialEnd: Date;
  /** Second and third contact (C2 / C3); `null` unless total or annular here. */
  centralBegin: Date | null;
  centralEnd: Date | null;
  /** Fraction of the Sun's disc **area** covered at maximum. */
  obscuration: number;
  /** Fraction of the Sun's **diameter** covered at maximum. */
  magnitude: number;
  /** Refracted altitude of the Sun at maximum, first and last contact, degrees. */
  peakAltitude: number;
  beginAltitude: number;
  endAltitude: number;
  /** Azimuth of the Sun at maximum, degrees east of north. */
  peakAzimuth: number;
}

/** A solar contact is never more than ~3 h from local maximum. */
const SOLAR_CONTACT_LIMIT_MS = 3 * 3600_000;

/**
 * Half-width of the window searched around conjunction for the observer's own
 * maximum, milliseconds.
 *
 * Parallax moves local maximum away from geocentric conjunction — by up to
 * about an hour for an observer near the limb of the visible hemisphere. Three
 * hours covers that with room to spare, and the coarse scan below keeps the
 * refinement from converging on the wrong side of a shallow profile.
 */
const SOLAR_SEARCH_HALF_WIDTH_MS = 3 * 3600_000;
const SOLAR_SCAN_STEPS = 12;

/**
 * The solar eclipse this observer sees at `conjunctionUtc`, or `null` if the
 * observer is outside the penumbra throughout.
 *
 * `null` is the case §36.5 singles out as "the one a solver gets wrong
 * silently", and it is not an error path: most observers see nothing during
 * most eclipses. It is asserted directly in
 * `tests/validation/tier0-own-eclipses.test.ts` against sites the NASA
 * catalogs omit for a given eclipse.
 */
export function findLocalSolarEclipse(
  conjunctionUtc: Date, location: GeoLocation,
): LocalSolarEclipse | null {
  const separationSquared = (ms: number): number => {
    const s = solarViewAt(new Date(ms), location).separation;
    return s * s;
  };

  // Coarse scan first. The topocentric separation is smooth but not always
  // parabolic across six hours — the observer's own rotation is superimposed on
  // the Moon's motion — so a bare parabolic fit from the conjunction could
  // settle on the wrong side. Twelve samples fix the basin; the refinement then
  // has a genuinely local problem to solve.
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

  // Relative angular rate at the peak, from a symmetric difference. Unlike the
  // lunar case there is no useful mean rate to quote — the observer's rotation
  // contributes as much as the Moon does, and with either sign — so it is
  // measured on the spot and used only to seed the bracket.
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
