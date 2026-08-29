import { ttDaysSinceJ2000 } from './deltaT';
import { getSunPosition } from './sun';
import { getMoonPosition } from './moon';
import { AU_KM } from './frame';
import {
  gastDegrees, observerVector, altitudeDegrees, refractionDegrees, eclipticToEquatorial,
} from './topocentric';
import type { GeoLocation } from '../types/location';

export type HorizonBody = 'sun' | 'moon';

const BODY = new Float64Array(3);
const OBSERVER = new Float64Array(3);
const TOPOCENTRIC = new Float64Array(3);

/** Refracted and topocentric: parallax is 9″ for the Sun but 57′ for the Moon, where it decides moonrise. */
export function bodyAltitudeDegrees(
  date: Date, location: GeoLocation, body: HorizonBody,
): number {
  const ttDays = ttDaysSinceJ2000(date);
  const utDays = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const t = ttDays / 36525;

  if (body === 'sun') {
    const position = getSunPosition(date);
    eclipticToEquatorial(position.longitude, position.latitude, position.distance, t, BODY);
  } else {
    const position = getMoonPosition(date);
    eclipticToEquatorial(
      position.longitude, position.latitude, position.distance / AU_KM, t, BODY,
    );
  }

  const gast = gastDegrees(ttDays, utDays);
  observerVector(location.latitude, location.longitude, location.elevation ?? 0, gast, OBSERVER);
  TOPOCENTRIC[0] = (BODY[0] as number) - (OBSERVER[0] as number);
  TOPOCENTRIC[1] = (BODY[1] as number) - (OBSERVER[1] as number);
  TOPOCENTRIC[2] = (BODY[2] as number) - (OBSERVER[2] as number);

  const geometric = altitudeDegrees(TOPOCENTRIC, location.latitude, location.longitude, gast);
  return geometric + refractionDegrees(geometric);
}

export function sunAltitudeDegrees(date: Date, location: GeoLocation): number {
  return bodyAltitudeDegrees(date, location, 'sun');
}

export function isSunAboveHorizon(date: Date, location: GeoLocation): boolean {
  return sunAltitudeDegrees(date, location) > 0;
}
