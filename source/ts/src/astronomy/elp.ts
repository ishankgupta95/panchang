/** ELP2000-82B in ELP's own frame (mean dynamical ecliptic of date, longitude from the
 * inertial J2000 origin), which `frame.ts` carries to the equinox of date; angles
 * radians, distances km. Both loops call `trig.ts`, not `Math.sin`, so results are
 * engine-independent. */
import { sin } from './trig';
import {
  MOON_MEAN_LONGITUDE,
  MOON_LONGITUDE_QUARTIC, MOON_LONGITUDE_LINEAR,
  MOON_LATITUDE_QUARTIC, MOON_LATITUDE_LINEAR,
  MOON_LATITUDE_COARSE_QUARTIC, MOON_LATITUDE_COARSE_LINEAR,
  MOON_DISTANCE_QUARTIC, MOON_DISTANCE_LINEAR,
  MOON_DISTANCE_TRACK_QUARTIC, MOON_DISTANCE_TRACK_LINEAR,
  MOON_DISTANCE_COARSE_QUARTIC, MOON_DISTANCE_COARSE_LINEAR,
} from './series/elp2000-82b';

const ARCSEC_TO_RAD = Math.PI / 648000;

function sumQuartic(series: Float64Array, t: number): number {
  let sum = 0;
  for (let i = 0; i < series.length; i += 6) {
    const phase = (series[i + 1] as number)
      + t * ((series[i + 2] as number)
        + t * ((series[i + 3] as number)
          + t * ((series[i + 4] as number) + t * (series[i + 5] as number))));
    sum += (series[i] as number) * sin(phase);
  }
  return sum;
}

function sumLinear(series: Float64Array, t: number): number {
  const t2 = t * t;
  let sum = 0;
  for (let i = 0; i < series.length; i += 4) {
    const value = (series[i] as number)
      * sin((series[i + 1] as number) + t * (series[i + 2] as number));
    switch (series[i + 3]) {
      case 0: sum += value; break;
      case 1: sum += value * t; break;
      default: sum += value * t2;
    }
  }
  return sum;
}

/** The arcsecond periodic sum is added to W1, as `elp82b.f` does. */
export function moonElpLongitude(t: number): number {
  const periodic = sumQuartic(MOON_LONGITUDE_QUARTIC, t) + sumLinear(MOON_LONGITUDE_LINEAR, t);
  const w = MOON_MEAN_LONGITUDE;
  return periodic * ARCSEC_TO_RAD
    + (w[0] as number)
    + t * ((w[1] as number)
      + t * ((w[2] as number) + t * ((w[3] as number) + t * (w[4] as number))));
}

export function moonElpLatitude(t: number): number {
  return (sumQuartic(MOON_LATITUDE_QUARTIC, t) + sumLinear(MOON_LATITUDE_LINEAR, t)) * ARCSEC_TO_RAD;
}

/** Enough for the frame rotation only. */
export function moonElpLatitudeCoarse(t: number): number {
  return (sumQuartic(MOON_LATITUDE_COARSE_QUARTIC, t)
    + sumLinear(MOON_LATITUDE_COARSE_LINEAR, t)) * ARCSEC_TO_RAD;
}

export function moonElpDistance(t: number): number {
  return sumQuartic(MOON_DISTANCE_QUARTIC, t) + sumLinear(MOON_DISTANCE_LINEAR, t);
}

export function moonElpDistanceTrack(t: number): number {
  return sumQuartic(MOON_DISTANCE_TRACK_QUARTIC, t) + sumLinear(MOON_DISTANCE_TRACK_LINEAR, t);
}

/** Enough for the light-time retardation only. */
export function moonElpDistanceCoarse(t: number): number {
  return sumQuartic(MOON_DISTANCE_COARSE_QUARTIC, t) + sumLinear(MOON_DISTANCE_COARSE_LINEAR, t);
}
