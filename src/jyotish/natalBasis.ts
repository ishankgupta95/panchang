import { computeLagna } from './lagna';
import { computePlanetaryPositions } from './planets';
import { resolveMasaName, resolveNakshatraName } from '../i18n/resolver';
import { validateDate, validateLocation } from '../utils/validation';
import type { AyanamsaType, BirthChartOptions, Language } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { LagnaInfo, PlanetaryPositions } from '../types/jyotish';

/**
 * The two ephemeris-derived quantities every natal chart is built from: the
 * ascendant and the nine graha positions, both at the birth instant.
 *
 * Everything downstream — D1, every varga, Shadbala, Bhava Bala — is a pure
 * transform of these plus the chosen house system. They are also the only
 * genuinely expensive part: `computePlanetaryPositions` alone costs five
 * `GeoVector` calls plus ten more for the retrograde checks.
 *
 * Before this existed, each public entry point re-derived them from
 * `(birthDate, location)`. `computeShadbala` was the worst case — it built the
 * D1 chart and then six divisional charts, each of which internally recomputed
 * the same positions at the same instant, for seven identical evaluations per
 * call. Threading one basis through removes that redundancy without changing
 * any public signature: the `(birthDate, location, options)` entry points still
 * exist and simply build a basis first.
 */
export interface NatalBasis {
  readonly birthDate: Date;
  readonly location: GeoLocation;
  readonly ayanamsaType: AyanamsaType;
  readonly lang: Language;
  readonly nodeType: 'mean' | 'true';
  readonly lagna: LagnaInfo;
  readonly positions: PlanetaryPositions;
}

/**
 * Resolve the natal basis for a birth instant. Validates its inputs, so callers
 * that build a basis first need not validate again.
 */
export function computeNatalBasis(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): NatalBasis {
  validateDate(birthDate);
  validateLocation(location);

  const ayanamsaType: AyanamsaType = options.ayanamsa ?? 'lahiri';
  const lang: Language = options.language ?? 'en';
  const nodeType = options.nodeType ?? 'mean';

  return {
    birthDate,
    location,
    ayanamsaType,
    lang,
    nodeType,
    lagna: computeLagna(birthDate, location, ayanamsaType, lang),
    positions: computePlanetaryPositions(
      birthDate,
      ayanamsaType,
      (idx) => resolveNakshatraName(idx, lang),
      (idx) => resolveMasaName(idx, lang),
      nodeType,
    ),
  };
}

/** The nine grahas in canonical order, paired with their basis positions. */
export function grahaList(basis: NatalBasis) {
  const p = basis.positions;
  return [
    { key: 'Sun' as const, pos: p.sun },
    { key: 'Moon' as const, pos: p.moon },
    { key: 'Mars' as const, pos: p.mars },
    { key: 'Mercury' as const, pos: p.mercury },
    { key: 'Jupiter' as const, pos: p.jupiter },
    { key: 'Venus' as const, pos: p.venus },
    { key: 'Saturn' as const, pos: p.saturn },
    { key: 'Rahu' as const, pos: p.rahu },
    { key: 'Ketu' as const, pos: p.ketu },
  ];
}
