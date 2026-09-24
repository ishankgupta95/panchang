import type { UtcWindow } from '../types/elements';
import { PanchangError } from '../types/errors';
import { RAHU_KALAM_SLOTS, YAMAGANDA_SLOTS, GULIKA_SLOTS } from '../utils/constants';
import { validateDate } from '../utils/validation';

export function computeInauspiciousPeriod(
  sunrise: Date,
  sunset: Date,
  varaIndex: number,
  slotTable: readonly number[],
): UtcWindow {
  validateDate(sunrise, 'any');
  validateDate(sunset, 'any');
  if (!Number.isInteger(varaIndex) || varaIndex < 0 || varaIndex > 6) {
    throw new PanchangError(`varaIndex must be integer in [0, 6], got ${varaIndex}`, 'INVALID_INPUT');
  }
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const slotDurationMs = dayDurationMs / 8;
  const slotIndex = slotTable[varaIndex]!;

  const start = new Date(sunrise.getTime() + slotIndex * slotDurationMs);
  const end = new Date(start.getTime() + slotDurationMs);

  return { start, end };
}

/** Rahu Kalam: one of the 8 equal daytime slots, chosen by weekday (`varaIndex` 0 = Sunday … 6 = Saturday; any other value throws `INVALID_INPUT`, an Invalid Date `INVALID_DATE`). */
export function computeRahuKalam(sunrise: Date, sunset: Date, varaIndex: number): UtcWindow {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, RAHU_KALAM_SLOTS);
}

/** Gulika Kalam: the inauspicious period ruled by Saturn's son Gulika (`varaIndex` 0 = Sunday … 6 = Saturday; any other value throws `INVALID_INPUT`). */
export function computeGulikaKalam(sunrise: Date, sunset: Date, varaIndex: number): UtcWindow {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, GULIKA_SLOTS);
}

/** Yamaganda: the inauspicious period associated with Yama (`varaIndex` 0 = Sunday … 6 = Saturday; any other value throws `INVALID_INPUT`). */
export function computeYamaganda(sunrise: Date, sunset: Date, varaIndex: number): UtcWindow {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, YAMAGANDA_SLOTS);
}
