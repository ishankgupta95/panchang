/**
 * Apparent geocentric positions of Mercury through Saturn — Phase 36.4's
 * replacement for `GeoVector`.
 *
 * The theory is the same VSOP87D that `sun.ts` already uses; only the geometry
 * differs, and it differs in one way that matters: the Sun's geocentric
 * direction is the Earth's heliocentric direction reflected, but a planet's is
 * a *difference of two orbits*, so the light-time correction has to be solved
 * rather than applied.
 *
 * ## The light-time iteration
 *
 * A planet is seen where it was when the light left it, and how long ago that
 * was depends on where it was — which is what is being solved for. The standard
 * fixed-point iteration converges immediately because the dependence is weak:
 * the distance changes by at most a few parts in ten thousand over the ~40
 * minutes of light-time to Saturn.
 *
 * The iteration is written out rather than looped, because the three passes are
 * **not** the same pass repeated — only the last one retards the Earth:
 *
 * ```
 * pass 0: planet(t),      Earth(t)      → distance → τ₀
 * pass 1: planet(t − τ₀), Earth(t)      → distance → τ₁     (τ has converged)
 * final:  planet(t − τ₁), Earth(t − τ₁) → position
 * ```
 *
 * τ is only ever used to place the planet, and it converges in one correction
 * because ∂τ/∂τ is a few parts in 10⁴ — so the Earth does not need to move
 * while τ is being found, and evaluating it there was 33% of the work for a
 * contribution below a microarcsecond. Four VSOP evaluations instead of six.
 *
 * What must **not** be dropped is the Earth read in the *final* line. That read
 * is the annual aberration (see below); removing it costs 20.5″ on every planet.
 *
 * ## Annual aberration, and why it looks like it is missing
 *
 * A planet needs a correction the Moon does not. The Moon shares the Earth's
 * orbital velocity, so annual aberration and the barycentric part of its
 * light-time displacement cancel and geocentric retardation is the whole story
 * (`moon.ts` says so at more length). A planet shares nothing, and the Earth's
 * 29.8 km/s carries the full 20.5″ constant. Omitting it is not subtle: it
 * showed up as a 20.9″ error with a 19.6″ *bias* on every one of the five
 * bodies, which is what a missing constant looks like.
 *
 * There is no explicit aberration term below, because there does not need to
 * be. To first order,
 *
 *     P(t−τ) − E(t) + τ·V_E  =  P(t−τ) − (E(t) − τ·V_E)  ≈  P(t−τ) − E(t−τ)
 *
 * — applying the observer's velocity is the same as evaluating the *observer*
 * at the retarded epoch too. So the Earth is read at `t − τ` alongside the
 * planet, and aberration falls out. It costs one VSOP evaluation and no
 * velocity, and it makes the solar path (where the Sun sits at the origin and
 * only the Earth is retarded) the same formula rather than a special case.
 *
 * ## Accuracy
 *
 * Measured against JPL Horizons / DE441 over 1900–2100 in
 * `tests/validation/tier0-own-planets.test.ts`, against the `astronomy-engine`
 * ceilings recorded in `tier0-horizons.test.ts`. The planetary budgets are
 * looser than the Sun's and Moon's by design — the tightest planetary ceiling
 * is Mercury's 6.50″, against 1.61″ for the Sun — and the series are truncated
 * to match, which is what keeps Saturn from dominating the bundle.
 */
import { ttDaysSinceJ2000 } from './deltaT';
import { heliocentricRect, earthRect, type VsopBody } from './vsop87';
import { nutation, AU_KM, KM_PER_LIGHT_DAY, VSOP_TO_FK5_ARCSEC } from './frame';
import { normalize360 } from '../utils/angle';

const RAD_TO_DEG = 180 / Math.PI;

/** The five planets this library reports, as its own names. */
export type PlanetBody = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

const VSOP_NAME: Record<PlanetBody, VsopBody> = {
  mercury: 'mercury', venus: 'venus', mars: 'mars', jupiter: 'jupiter', saturn: 'saturn',
};

export interface PlanetPosition {
  /** Apparent longitude, true ecliptic and equinox of date, degrees in [0, 360). */
  longitude: number;
  /** Apparent latitude, degrees. */
  latitude: number;
  /** Geocentric distance, AU. */
  distance: number;
}

const EARTH = new Float64Array(3);
const PLANET = new Float64Array(3);

/** Apparent geocentric position of a planet. */
export function getPlanetPosition(body: PlanetBody, date: Date): PlanetPosition {
  const ttDays = ttDaysSinceJ2000(date);

  const series = VSOP_NAME[body];
  earthRect(ttDays, EARTH);

  // Two passes to converge the light-time, with the Earth held at `t` — see the
  // module header for why moving it here would be spending a third of the work
  // on a sub-microarcsecond correction.
  let lightDays = 0;
  for (let pass = 0; pass < 2; pass++) {
    heliocentricRect(series, ttDays - lightDays, PLANET);
    const dx = (PLANET[0] as number) - (EARTH[0] as number);
    const dy = (PLANET[1] as number) - (EARTH[1] as number);
    const dz = (PLANET[2] as number) - (EARTH[2] as number);
    lightDays = (Math.sqrt(dx * dx + dy * dy + dz * dz) * AU_KM) / KM_PER_LIGHT_DAY;
  }

  // The reported position: both bodies at the retarded epoch, which is what
  // carries the annual aberration.
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

/**
 * Apparent geocentric ecliptic longitude of a planet, degrees.
 *
 * Exported from `src/index.ts` as part of the public surface — unlike the
 * `astronomy-engine`-typed function it replaces, which could not be, because
 * its `Body` parameter belonged to the dependency this release removes.
 */
export function getTropicalPlanetLongitude(body: PlanetBody, date: Date): number {
  return getPlanetPosition(body, date).longitude;
}
