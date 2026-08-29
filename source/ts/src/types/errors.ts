/** Error codes thrown by panchang-ts. The `message` text is not part of the semver contract. */
export type PanchangErrorCode =
  | 'INVALID_LATITUDE'
  | 'INVALID_LONGITUDE'
  | 'INVALID_ELEVATION'
  | 'INVALID_DATE'
  | 'INVALID_TIMEZONE'
  | 'INVALID_AYANAMSA'
  | 'INVALID_INPUT'
  | 'TIMEZONE_RESOLUTION_FAILED'
  | 'NO_SUNRISE'
  | 'NO_SUNSET'
  | 'SEARCH_DIVERGED'
  | 'CIRCUMPOLAR'
  | 'PLACIDUS_DIVERGED'
  | 'SAHAM_DEPENDENCY_ERROR';

/** Thrown when input validation fails or a numerical search cannot converge. */
export class PanchangError extends Error {
  public readonly code: PanchangErrorCode;

  constructor(message: string, code: PanchangErrorCode) {
    super(message);
    this.name = 'PanchangError';
    this.code = code;
    Object.setPrototypeOf(this, PanchangError.prototype);
  }
}
