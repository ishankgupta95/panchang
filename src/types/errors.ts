/**
 * Discriminated error codes thrown by panchang-ts.
 *
 * Use this union to branch on `err.code` in a `catch` block rather than
 * pattern-matching error messages (which are not part of the semver contract).
 */
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

/**
 * Typed error thrown by panchang-ts when input validation fails or a numerical
 * search cannot converge (polar sunrise/sunset, etc.).
 *
 * The `code` field is stable across releases; the `message` is not.
 *
 * @example
 * ```typescript
 * import { getDailyPanchang, PanchangError } from 'panchang-ts';
 * try {
 *   getDailyPanchang(new Date(), { latitude: 90, longitude: 0 }, { timezone: 0 });
 * } catch (err) {
 *   if (err instanceof PanchangError && err.code === 'NO_SUNRISE') {
 *     // polar region — fall back to a neighbouring day
 *   }
 * }
 * ```
 */
export class PanchangError extends Error {
  public readonly code: PanchangErrorCode;

  constructor(message: string, code: PanchangErrorCode) {
    super(message);
    this.name = 'PanchangError';
    this.code = code;
    Object.setPrototypeOf(this, PanchangError.prototype);
  }
}
