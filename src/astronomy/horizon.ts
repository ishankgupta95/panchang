/**
 * Is a body up, and how high?
 *
 * Two callers with the same question and no shared code between them. The
 * jyotish layer needs a day-birth flag (`upagrahas.ts`, `varshaphala.ts`), and
 * the eclipse layer needs to know whether the eclipsed body is above the
 * horizon at a given phase. Both previously answered it with `Equator` +
 * `Horizon` from `astronomy-engine`; they now share this.
 *
 * Refraction is applied, matching what those call sites asked for. It only
 * matters within about half a degree of the horizon, but that is exactly where
 * a day/night flag is decided, and a birth minutes either side of sunrise is
 * not a rare case in this domain — it is the case people ask about. The same
 * argument applies twice over to an eclipse at moonrise.
 */
import { ttDaysSinceJ2000 } from './deltaT';
import { getSunPosition } from './sun';
import { getMoonPosition } from './moon';
import { AU_KM } from './frame';
import {
  gastDegrees, observerVector, altitudeDegrees, refractionDegrees, eclipticToEquatorial,
} from './topocentric';
import type { GeoLocation } from '../types/location';

/** The two bodies whose horizon crossings this library reports. */
export type HorizonBody = 'sun' | 'moon';

const BODY = new Float64Array(3);
const OBSERVER = new Float64Array(3);
const TOPOCENTRIC = new Float64Array(3);

/**
 * Apparent altitude of a body's centre above the observer's horizon, degrees,
 * corrected for refraction and for the observer's own displacement from the
 * geocentre.
 *
 * The parallax term is the reason the observer's vector is subtracted rather
 * than ignored. For the Sun it is worth 9″; for the Moon it is worth 57′, which
 * is more than a degree of apparent displacement and decides moonrise outright.
 */
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

/** Apparent altitude of the Sun's centre, degrees. */
export function sunAltitudeDegrees(date: Date, location: GeoLocation): number {
  return bodyAltitudeDegrees(date, location, 'sun');
}

/** True when the Sun is above the horizon — the day-birth flag. */
export function isSunAboveHorizon(date: Date, location: GeoLocation): boolean {
  return sunAltitudeDegrees(date, location) > 0;
}
