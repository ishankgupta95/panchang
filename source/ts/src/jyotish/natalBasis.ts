import { computeLagna } from './lagna';
import { computePlanetaryPositions } from './planets';
import { resolveMasaName, resolveNakshatraName } from '../i18n/resolver';
import { validateDate, validateLocation } from '../utils/validation';
import type { AyanamsaType, BirthChartOptions, Language } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { LagnaInfo, PlanetaryPositions } from '../types/jyotish';

export interface NatalBasis {
  readonly birthDate: Date;
  readonly location: GeoLocation;
  readonly ayanamsaType: AyanamsaType;
  readonly lang: Language;
  readonly nodeType: 'mean' | 'true';
  readonly lagna: LagnaInfo;
  readonly positions: PlanetaryPositions;
}

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
