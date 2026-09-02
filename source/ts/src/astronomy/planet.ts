/** Light-time is iterated with the Earth held at `t`; the final evaluation must then
 * re-read the Earth at the retarded epoch, since that is what supplies annual
 * aberration, and no explicit aberration term appears below. */
import { ttDaysSinceJ2000 } from './deltaT';
import { heliocentricRect, earthRect, type VsopBody } from './vsop87';
import { nutation, AU_KM, KM_PER_LIGHT_DAY, VSOP_TO_FK5_ARCSEC } from './frame';
import { normalize360 } from '../utils/angle';

const RAD_TO_DEG = 180 / Math.PI;

export type PlanetBody = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

const VSOP_NAME: Record<PlanetBody, VsopBody> = {
  mercury: 'mercury', venus: 'venus', mars: 'mars', jupiter: 'jupiter', saturn: 'saturn',
};

/** Apparent geocentric position, true ecliptic and equinox of date; degrees and AU. */
export interface PlanetPosition {
  longitude: number;
  latitude: number;
  distance: number;
}

const EARTH = new Float64Array(3);
const PLANET = new Float64Array(3);

export function getPlanetPosition(body: PlanetBody, date: Date): PlanetPosition {
  const ttDays = ttDaysSinceJ2000(date);

  const series = VSOP_NAME[body];
  earthRect(ttDays, EARTH);

  let lightDays = 0;
  for (let pass = 0; pass < 2; pass++) {
    heliocentricRect(series, ttDays - lightDays, PLANET);
    const dx = (PLANET[0] as number) - (EARTH[0] as number);
    const dy = (PLANET[1] as number) - (EARTH[1] as number);
    const dz = (PLANET[2] as number) - (EARTH[2] as number);
    lightDays = (Math.sqrt(dx * dx + dy * dy + dz * dz) * AU_KM) / KM_PER_LIGHT_DAY;
  }

  const retarded = ttDays - lightDays;
  earthRect(retarded, EARTH);
  heliocentricRect(series, retarded, PLANET);
  const x = (PLANET[0] as number) - (EARTH[0] as number);
  const y = (PLANET[1] as number) - (EARTH[1] as number);
  const z = (PLANET[2] as number) - (EARTH[2] as number);
  const distance = Math.sqrt(x * x + y * y + z * z);

  const { dpsi } = nutation(ttDays / 36525);
  return {
    longitude: normalize360(
      Math.atan2(y, x) * RAD_TO_DEG + (dpsi + VSOP_TO_FK5_ARCSEC) / 3600,
    ),
    latitude: Math.asin(z / distance) * RAD_TO_DEG,
    distance,
  };
}

export function getTropicalPlanetLongitude(body: PlanetBody, date: Date): number {
  return getPlanetPosition(body, date).longitude;
}
