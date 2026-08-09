import { greenwichApparentSiderealDegrees } from '../astronomy/topocentric';
import { computeAyanamsa, dateToJulianDay } from '../astronomy/ayanamsa';
import { meanObliquity } from './planets';
import { computeNatalBasis, type NatalBasis } from './natalBasis';
import { resolveMasaName } from '../i18n/resolver';
import { normalize360, degToRad, radToDeg } from '../utils/angle';
import { validateLocation, validateDate } from '../utils/validation';
import { PanchangError } from '../types/errors';
import type { HouseSystem, BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { BhavaChart, HouseInfo } from '../types/jyotish';

const TWO_PI = 2 * Math.PI;

/**
 * Compute the 12 house cusps (bhavas) of a Vedic birth chart.
 *
 * Three house systems are supported via `options.houseSystem` (default
 * `'whole-sign'`):
 *
 * - `'whole-sign'` — each rashi is exactly one house starting from the
 *   lagna's rashi. Cusps fall at 0° of each rashi. The classical default in
 *   most Vedic traditions.
 * - `'equal'` — each house spans exactly 30°, with house 1 starting at the
 *   lagna's exact degree.
 * - `'placidus-kp'` — Placidus cusps (used in KP astrology). The diurnal
 *   semi-arc between Ascendant and MC is divided into thirds; same below
 *   horizon. Undefined for circumpolar latitudes.
 *
 * @param birthDate Instant of birth in UTC.
 * @param location  Geographic location of birth.
 * @param options   Birth-chart options (ayanamsa, language, houseSystem).
 * @returns         `BhavaChart` — 12 houses, ascendant + MC longitudes,
 *                  active system.
 *
 * @throws `PanchangError` ('CIRCUMPOLAR') for `placidus-kp` at latitudes
 *         where the semi-diurnal arc of an intermediate cusp's ecliptic
 *         point doesn't exist. Use `'whole-sign'` or `'equal'` instead.
 *
 * @example
 * ```typescript
 * import { computeBhava } from 'panchang-ts';
 *
 * const chart = computeBhava(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 *   { houseSystem: 'whole-sign' },
 * );
 * chart.houses[0].rashi.name;  // ascendant rashi
 * chart.houses[9].rashi.name;  // 10th house (career)
 * ```
 */
export function computeBhava(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): BhavaChart {
  validateDate(birthDate);
  validateLocation(location);
  return bhavaFromBasis(
    computeNatalBasis(birthDate, location, options),
    options.houseSystem ?? 'whole-sign',
  );
}

/**
 * Bhava cusps derived from an already-resolved {@link NatalBasis}.
 *
 * @internal Reuses the basis lagna. `computeRashiChart` previously called
 * `computeLagna` itself *and* `computeBhava`, which computed it a second time.
 */
export function bhavaFromBasis(basis: NatalBasis, system: HouseSystem): BhavaChart {
  const { birthDate, location, ayanamsaType, lang, lagna } = basis;
  const ascSidereal = lagna.siderealLongitude;

  // Common: tropical MC (used for 'placidus-kp', informational for the others).
  const lstDeg = normalize360(greenwichApparentSiderealDegrees(birthDate) + location.longitude);
  const T = (dateToJulianDay(birthDate) - 2451545.0) / 36525.0;
  const εRad = degToRad(meanObliquity(T));
  const mcTropical = computeMcTropical(lstDeg, εRad);
  const ayanamsa = computeAyanamsa(birthDate, ayanamsaType);
  const mcSidereal = normalize360(mcTropical - ayanamsa);

  const cuspLongitudes = buildCusps(
    system,
    ascSidereal,
    mcTropical,
    ayanamsa,
    lstDeg,
    location.latitude,
    εRad,
  );

  const houses: HouseInfo[] = cuspLongitudes.map((lon, i) => {
    const rashiIndex = Math.floor(lon / 30);
    return {
      house: i + 1,
      cuspLongitude: lon,
      rashi: { index: rashiIndex, name: resolveMasaName(rashiIndex, lang) },
      degreeInRashi: lon - rashiIndex * 30,
    };
  });

  return {
    system,
    houses,
    ascendantLongitude: ascSidereal,
    mcLongitude: mcSidereal,
  };
}

function buildCusps(
  system: HouseSystem,
  ascSidereal: number,
  mcTropical: number,
  ayanamsa: number,
  lstDeg: number,
  latitudeDeg: number,
  εRad: number,
): number[] {
  switch (system) {
    case 'whole-sign': {
      const ascRashiStart = Math.floor(ascSidereal / 30) * 30;
      const out: number[] = [];
      for (let i = 0; i < 12; i++) out.push(normalize360(ascRashiStart + i * 30));
      return out;
    }
    case 'equal': {
      const out: number[] = [];
      for (let i = 0; i < 12; i++) out.push(normalize360(ascSidereal + i * 30));
      return out;
    }
    case 'placidus-kp': {
      return placidusCusps(mcTropical, ayanamsa, lstDeg, latitudeDeg, εRad);
    }
  }
}

// ── Placidus implementation ────────────────────────────

/**
 * Tropical ecliptic longitude of the Midheaven: the ecliptic point currently
 * on the upper meridian. For β=0 the equation α(λ) = θ inverts to:
 *
 *   λ_MC = atan2(sin θ, cos θ · cos ε)
 *
 * where θ is the local apparent sidereal time. Quadrant-correct via atan2.
 */
function computeMcTropical(lstDeg: number, εRad: number): number {
  const θ = degToRad(lstDeg);
  const mc = Math.atan2(Math.sin(θ), Math.cos(θ) * Math.cos(εRad));
  return normalize360(radToDeg(mc));
}

/**
 * Placidus cusps for houses 11, 12, 2, 3 (intermediate). The other six cusps
 * are derived: 1 = Asc, 4 = MC + 180°, 7 = Asc + 180°, 10 = MC, plus the
 * axial pairs 5/8/9/6 = (cusps 11/12/2/3) + 180°.
 *
 * Fixed-point iteration: for each cusp we solve α(λ) = θ + n·SDA(δ(λ)) +
 * m·SNA(δ(λ)). The Newton-style step λ_next = λ + (target − α) converges
 * within a few iterations at non-circumpolar latitudes.
 */
function placidusCusps(
  mcTropical: number,
  ayanamsa: number,
  lstDeg: number,
  latitudeDeg: number,
  εRad: number,
): number[] {
  const θRad = degToRad(lstDeg);
  const φRad = degToRad(latitudeDeg);

  // Tropical ascendant — recompute from LST/φ/ε to keep this routine
  // self-contained (avoids circular dependency on `computeLagna`).
  const ascTropical = computeAscTropical(θRad, φRad, εRad);

  const cusp11Trop = solvePlacidus(11, θRad, φRad, εRad, normalize360(mcTropical + 30));
  const cusp12Trop = solvePlacidus(12, θRad, φRad, εRad, normalize360(mcTropical + 60));
  const cusp2Trop  = solvePlacidus(2,  θRad, φRad, εRad, normalize360(ascTropical + 30));
  const cusp3Trop  = solvePlacidus(3,  θRad, φRad, εRad, normalize360(ascTropical + 60));

  const trop = [
    ascTropical,                                 // 1
    cusp2Trop,                                   // 2
    cusp3Trop,                                   // 3
    normalize360(mcTropical + 180),              // 4 (IC)
    normalize360(cusp11Trop + 180),              // 5
    normalize360(cusp12Trop + 180),              // 6
    normalize360(ascTropical + 180),             // 7 (Desc)
    normalize360(cusp2Trop + 180),               // 8
    normalize360(cusp3Trop + 180),               // 9
    mcTropical,                                  // 10
    cusp11Trop,                                  // 11
    cusp12Trop,                                  // 12
  ];

  return trop.map((t) => normalize360(t - ayanamsa));
}

function computeAscTropical(θRad: number, φRad: number, εRad: number): number {
  const num = Math.cos(θRad);
  const den = -Math.sin(εRad) * Math.tan(φRad) - Math.cos(εRad) * Math.sin(θRad);
  return normalize360(radToDeg(Math.atan2(num, den)));
}

/**
 * Solve the Placidus equation for one of cusps 11, 12, 2, 3. Returns the
 * tropical ecliptic longitude of the cusp.
 *
 * The target equations (LST=θ, latitude=φ, obliquity=ε):
 *   cusp 11: α(λ) = θ + SDA(δ(λ))/3
 *   cusp 12: α(λ) = θ + 2·SDA(δ(λ))/3
 *   cusp 2:  α(λ) = θ + SDA(δ(λ)) + SNA(δ(λ))/3
 *   cusp 3:  α(λ) = θ + SDA(δ(λ)) + 2·SNA(δ(λ))/3
 *
 * where SDA = arccos(−tan φ · tan δ) and SNA = π − SDA.
 */
function solvePlacidus(
  cusp: 2 | 3 | 11 | 12,
  θRad: number,
  φRad: number,
  εRad: number,
  initialGuessDeg: number,
): number {
  let λRad = degToRad(initialGuessDeg);
  const tanφ = Math.tan(φRad);
  const sinε = Math.sin(εRad);
  const cosε = Math.cos(εRad);
  const tolRad = degToRad(1e-7);

  for (let i = 0; i < 60; i++) {
    const sinλ = Math.sin(λRad);
    const cosλ = Math.cos(λRad);
    const α = Math.atan2(sinλ * cosε, cosλ);
    const δ = Math.asin(sinλ * sinε);

    const cosArg = -tanφ * Math.tan(δ);
    if (cosArg <= -1 || cosArg >= 1) {
      throw new PanchangError(
        `Placidus cusp ${cusp} undefined at latitude ${radToDeg(φRad).toFixed(2)}° (circumpolar). Use 'whole-sign' or 'equal'.`,
        'CIRCUMPOLAR',
      );
    }
    const SDA = Math.acos(cosArg);
    const SNA = Math.PI - SDA;

    let targetα: number;
    switch (cusp) {
      case 11: targetα = θRad + SDA / 3; break;
      case 12: targetα = θRad + 2 * SDA / 3; break;
      case 2:  targetα = θRad + SDA + SNA / 3; break;
      case 3:  targetα = θRad + SDA + 2 * SNA / 3; break;
    }

    let dα = targetα - α;
    // Wrap into (-π, π]
    dα = ((dα + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;

    λRad += dα;
    if (Math.abs(dα) < tolRad) {
      return normalize360(radToDeg(λRad));
    }
  }
  throw new PanchangError(
    `Placidus cusp ${cusp} did not converge`,
    'PLACIDUS_DIVERGED',
  );
}
