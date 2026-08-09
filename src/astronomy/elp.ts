/**
 * ELP2000-82B evaluation — the Moon's geocentric spherical coordinates in ELP's
 * own frame (mean dynamical ecliptic of date, longitude from the inertial J2000
 * origin). `frame.ts` carries them to the equinox of date.
 *
 * The series are generated: see `series/elp2000-82b.ts` and
 * `notes/ephemeris-generate.src.ts`, which truncate 37,872 published terms to
 * 657 / 414 / 623 under a 0.4″ / 0.2″ / 0.2 km budget. This file is the
 * evaluator — the "fast third" of §36.0 H, checked against the untruncated
 * transcription in `tests/reference/ephemeris-reference.ts`.
 *
 * ## The two-array split
 *
 * `elp82b.f` dispatches on which of 36 files a term came from, and each file
 * has its own argument convention. That structure is entirely a fact about the
 * *argument*, and every argument in every file is a linear combination of
 * angles that are themselves polynomial in t — so the generator collapses all
 * 36 conventions into one shape, `a · t^power · sin(φ(t))`, and sorts by
 * contribution.
 *
 * What survives the collapse is a split by the degree of φ: the main problem
 * (files 1–3) needs a quartic, every perturbation file needs only a linear.
 * Keeping them in separate arrays halves the emitted numbers and removes a
 * per-term degree test from the inner loop. The quartic group is 251 of the 657
 * longitude terms and carries almost all of the amplitude.
 *
 * ## `sin` is ours, not the platform's
 *
 * Both loops call `trig.ts` rather than `Math.sin`, and that single substitution
 * is worth more than every other optimization in this module combined: measured
 * on the longitude series, 5.35 µs against 2.46 µs. `Math.sin` has to
 * reduce arguments up to 10³⁰⁸ and these phases never leave ±10⁵. It also makes
 * the result identical on V8, JavaScriptCore and Hermes, which `Math.sin` does
 * not guarantee.
 *
 * ## Coarse variants
 *
 * `moonLongitude` needs latitude and distance, but barely: latitude enters only
 * through the ecliptic's own ~47″/century tilt in the frame rotation, and
 * distance only through the 1.28-second light-time. The generator therefore
 * also emits 36-term and 22-term subsets, good to 20″ and 90 km, which are
 * worth 0.005″ and 0.0002″ of longitude respectively. Using the full series
 * there would triple the cost of a longitude read for no measurable accuracy.
 */
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

/** Sum a quartic-phase group: stride 6, `a·sin(p0 + p1 t + p2 t² + p3 t³ + p4 t⁴)`. */
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

/** Sum a linear-phase group: stride 4, `a·t^power·sin(p0 + p1 t)`. */
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

/**
 * Longitude in ELP's frame, radians.
 *
 * The periodic sum is in arcseconds and is added to W1, the Moon's mean
 * longitude polynomial, exactly as `elp82b.f`'s closing statement does.
 */
export function moonElpLongitude(t: number): number {
  const periodic = sumQuartic(MOON_LONGITUDE_QUARTIC, t) + sumLinear(MOON_LONGITUDE_LINEAR, t);
  const w = MOON_MEAN_LONGITUDE;
  return periodic * ARCSEC_TO_RAD
    + (w[0] as number)
    + t * ((w[1] as number)
      + t * ((w[2] as number) + t * ((w[3] as number) + t * (w[4] as number))));
}

/** Latitude in ELP's frame, radians. */
export function moonElpLatitude(t: number): number {
  return (sumQuartic(MOON_LATITUDE_QUARTIC, t) + sumLinear(MOON_LATITUDE_LINEAR, t)) * ARCSEC_TO_RAD;
}

/** Latitude to 19″ — enough for the frame rotation only. See the header. */
export function moonElpLatitudeCoarse(t: number): number {
  return (sumQuartic(MOON_LATITUDE_COARSE_QUARTIC, t)
    + sumLinear(MOON_LATITUDE_COARSE_LINEAR, t)) * ARCSEC_TO_RAD;
}

/** Geocentric distance, km. */
export function moonElpDistance(t: number): number {
  return sumQuartic(MOON_DISTANCE_QUARTIC, t) + sumLinear(MOON_DISTANCE_LINEAR, t);
}

/** Distance to 5 km — the rise/set track's tier; 5 km is 0.04″ of parallax. */
export function moonElpDistanceTrack(t: number): number {
  return sumQuartic(MOON_DISTANCE_TRACK_QUARTIC, t) + sumLinear(MOON_DISTANCE_TRACK_LINEAR, t);
}

/** Distance to 89 km — enough for the light-time retardation only. */
export function moonElpDistanceCoarse(t: number): number {
  return sumQuartic(MOON_DISTANCE_COARSE_QUARTIC, t) + sumLinear(MOON_DISTANCE_COARSE_LINEAR, t);
}
