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
 * The 12 house cusps (bhavas): `'whole-sign'` (default), `'equal'`, `'placidus-kp'`.
 * @throws `PanchangError` ('CIRCUMPOLAR') when a `placidus-kp` intermediate cusp is circumpolar.
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

/** @internal */
export function bhavaFromBasis(basis: NatalBasis, system: HouseSystem): BhavaChart {
  const { birthDate, location, ayanamsaType, lang, lagna } = basis;
  const ascSidereal = lagna.siderealLongitude;

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

function computeMcTropical(lstDeg: number, εRad: number): number {
  const θ = degToRad(lstDeg);
  const mc = Math.atan2(Math.sin(θ), Math.cos(θ) * Math.cos(εRad));
  return normalize360(radToDeg(mc));
}

function placidusCusps(
  mcTropical: number,
  ayanamsa: number,
  lstDeg: number,
  latitudeDeg: number,
  εRad: number,
): number[] {
  const θRad = degToRad(lstDeg);
  const φRad = degToRad(latitudeDeg);

  const ascTropical = computeAscTropical(θRad, φRad, εRad);

  const cusp11Trop = solvePlacidus(11, θRad, φRad, εRad, normalize360(mcTropical + 30));
  const cusp12Trop = solvePlacidus(12, θRad, φRad, εRad, normalize360(mcTropical + 60));
  const cusp2Trop  = solvePlacidus(2,  θRad, φRad, εRad, normalize360(ascTropical + 30));
  const cusp3Trop  = solvePlacidus(3,  θRad, φRad, εRad, normalize360(ascTropical + 60));

  const trop = [
    ascTropical,
    cusp2Trop,
    cusp3Trop,
    normalize360(mcTropical + 180),
    normalize360(cusp11Trop + 180),
    normalize360(cusp12Trop + 180),
    normalize360(ascTropical + 180),
    normalize360(cusp2Trop + 180),
    normalize360(cusp3Trop + 180),
    mcTropical,
    cusp11Trop,
    cusp12Trop,
  ];

  return trop.map((t) => normalize360(t - ayanamsa));
}

function computeAscTropical(θRad: number, φRad: number, εRad: number): number {
  const num = Math.cos(θRad);
  const den = -Math.sin(εRad) * Math.tan(φRad) - Math.cos(εRad) * Math.sin(θRad);
  return normalize360(radToDeg(Math.atan2(num, den)));
}

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
