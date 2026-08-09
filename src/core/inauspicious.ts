import type { UtcWindow } from '../types/elements';
import { RAHU_KALAM_SLOTS, YAMAGANDA_SLOTS, GULIKA_SLOTS } from '../utils/constants';

/**
 * Compute an inauspicious period by dividing daytime into 8 equal slots.
 *
 * @param sunrise   Sunrise UTC Date
 * @param sunset    Sunset UTC Date
 * @param varaIndex 0=Sunday, 6=Saturday
 * @param slotTable Which slot table to use (Rahu/Yamaganda/Gulika)
 */
export function computeInauspiciousPeriod(
  sunrise: Date,
  sunset: Date,
  varaIndex: number,
  slotTable: readonly number[],
): UtcWindow {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const slotDurationMs = dayDurationMs / 8;
  const slotIndex = slotTable[varaIndex]!;

  const start = new Date(sunrise.getTime() + slotIndex * slotDurationMs);
  const end = new Date(start.getTime() + slotDurationMs);

  return { start, end };
}

/**
 * Compute Rahu Kalam — the inauspicious period ruled by Rahu.
 * Daytime is divided into 8 equal slots; the slot index varies by weekday.
 *
 * @param sunrise   UTC sunrise Date.
 * @param sunset    UTC sunset Date.
 * @param varaIndex Weekday index: 0 = Sunday, 6 = Saturday.
 * @returns         `{ start, end }` UTC Dates for the Rahu Kalam period.
 *
 * @example
 * ```typescript
 * import { computeRahuKalam, getSunrise, getSunset } from 'panchang-ts';
 * const loc = { latitude: 28.6139, longitude: 77.209 };
 * const sr = getSunrise(new Date('2025-01-14T00:00:00Z'), loc);
 * const ss = getSunset(sr, loc);
 * const rk = computeRahuKalam(sr, ss, 2); // Tuesday
 * ```
 */
export function computeRahuKalam(sunrise: Date, sunset: Date, varaIndex: number): UtcWindow {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, RAHU_KALAM_SLOTS);
}

/**
 * Compute Gulika Kalam — the inauspicious period ruled by Saturn's son Gulika.
 *
 * @param sunrise   UTC sunrise Date.
 * @param sunset    UTC sunset Date.
 * @param varaIndex Weekday index: 0 = Sunday, 6 = Saturday.
 * @returns         `{ start, end }` UTC Dates for the Gulika Kalam period.
 *
 * @example
 * ```typescript
 * import { computeGulikaKalam } from 'panchang-ts';
 * const gk = computeGulikaKalam(sunrise, sunset, 2); // Tuesday
 * ```
 */
export function computeGulikaKalam(sunrise: Date, sunset: Date, varaIndex: number): UtcWindow {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, GULIKA_SLOTS);
}

/**
 * Compute Yamaganda — the inauspicious period associated with Yama (death).
 *
 * @param sunrise   UTC sunrise Date.
 * @param sunset    UTC sunset Date.
 * @param varaIndex Weekday index: 0 = Sunday, 6 = Saturday.
 * @returns         `{ start, end }` UTC Dates for the Yamaganda period.
 *
 * @example
 * ```typescript
 * import { computeYamaganda } from 'panchang-ts';
 * const yg = computeYamaganda(sunrise, sunset, 2); // Tuesday
 * ```
 */
export function computeYamaganda(sunrise: Date, sunset: Date, varaIndex: number): UtcWindow {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, YAMAGANDA_SLOTS);
}
