export type PanchangErrorCode =
  | 'INVALID_LATITUDE'
  | 'INVALID_LONGITUDE'
  | 'INVALID_ELEVATION'
  | 'INVALID_DATE'
  | 'INVALID_TIMEZONE'
  | 'INVALID_AYANAMSA'
  | 'TIMEZONE_RESOLUTION_FAILED'
  | 'NO_SUNRISE'
  | 'NO_SUNSET'
  | 'SEARCH_DIVERGED';

export class PanchangError extends Error {
  public readonly code: PanchangErrorCode;

  constructor(message: string, code: PanchangErrorCode) {
    super(message);
    this.name = 'PanchangError';
    this.code = code;
    Object.setPrototypeOf(this, PanchangError.prototype);
  }
}
