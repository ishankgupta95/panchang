import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';
import { validateLocation } from '../utils/validation';

/** Which of the three reference frames a result was computed in. */
export type PanchangReference = 'traditional' | 'modern' | 'practical';

/** The reference points a caller can ask for when it has no location of its own. */
export type ReferenceMode = 'traditional' | 'modern';

/** Ujjain, the classical madhya rekha of the Surya Siddhanta. */
export const TRADITIONAL_REFERENCE: Readonly<GeoLocation> = Object.freeze({
  latitude: 23.1765,
  longitude: 75.7885,
  elevation: 0,
});

/** The Central Station, the 1955 Calendar Reform Committee reference for the Rashtriya Panchang. */
export const MODERN_REFERENCE: Readonly<GeoLocation> = Object.freeze({
  latitude: 23.1833,
  longitude: 82.5,
  elevation: 0,
});

/** IANA zone for both reference points. */
export const IST_TIMEZONE = 'Asia/Kolkata';

/** The civil offset for either reference point. Exact for the Central Station, civil for Ujjain. */
export const IST_OFFSET_MINUTES = 330;

const REFERENCE_LOCATIONS: Readonly<Record<ReferenceMode, Readonly<GeoLocation>>> = Object.freeze({
  traditional: TRADITIONAL_REFERENCE,
  modern: MODERN_REFERENCE,
});

/** The reference point for a mode: `traditional` is Ujjain, `modern` is the Central Station. */
export function referenceLocation(mode: ReferenceMode): Readonly<GeoLocation> {
  const location = REFERENCE_LOCATIONS[mode];
  if (location === undefined) {
    throw new PanchangError(
      `Reference mode must be 'traditional' or 'modern', got ${String(mode)}`,
      'INVALID_INPUT',
    );
  }
  return location;
}

/** A location, and which of the three frames it came from. */
export interface ResolvedLocation {
  location: GeoLocation;
  reference: PanchangReference;
}

/**
 * Resolves a possibly-absent location and reports which frame the answer is in. A supplied
 * location comes back unchanged as `practical`; an absent one falls back to `mode`. A half-filled
 * location throws, and `{ latitude: 0, longitude: 0 }` is the real place it is.
 */
export function resolveLocation(
  location?: GeoLocation | null,
  mode: ReferenceMode = 'traditional',
): ResolvedLocation {
  if (location === null || location === undefined) {
    return { location: referenceLocation(mode), reference: mode };
  }
  if (typeof location !== 'object') {
    throw new PanchangError(
      `Location must be a GeoLocation object or absent, got ${typeof location}`,
      'INVALID_INPUT',
    );
  }
  validateLocation(location);
  return { location, reference: 'practical' };
}
