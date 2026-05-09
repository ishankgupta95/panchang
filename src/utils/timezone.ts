import { PanchangError } from '../types/errors';

export function resolveUtcOffset(timezone: number | string, referenceDate: Date): number {
  if (typeof timezone === 'number') {
    validateOffset(timezone);
    return timezone;
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(referenceDate);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (!tzPart) throw new Error('No timeZoneName part found');
    return parseGmtOffset(tzPart.value);
  } catch {
    throw new PanchangError(
      `Cannot resolve timezone "${timezone}". ` +
        `On React Native (Hermes), pass a numeric UTC offset in minutes instead ` +
        `(e.g. 330 for IST +05:30, -300 for EST -05:00).`,
      'TIMEZONE_RESOLUTION_FAILED'
    );
  }
}

/**
 * Return UTC instant of local midnight for the calendar day that `date`
 * falls on **in the configured timezone** (`offsetMinutes`).
 *
 * The calendar day is read from the timezone-shifted instant via UTC
 * accessors, so the result is independent of the JS runtime's host
 * timezone. The previous implementation used `getFullYear/Month/Date`,
 * which read the host system's TZ — causing off-by-one calendar days
 * for inputs whose UTC instant straddled midnight (e.g. NY system,
 * `new Date('2025-01-14T00:00:00Z')` resolved to Jan 13 since 00:00 UTC
 * = 19:00 EST the previous day).
 */
export function getLocalMidnightUtc(date: Date, offsetMinutes: number): Date {
  const localDisplay = new Date(date.getTime() + offsetMinutes * 60_000);
  const y = localDisplay.getUTCFullYear();
  const m = localDisplay.getUTCMonth();
  const d = localDisplay.getUTCDate();
  const midnightUtc = Date.UTC(y, m, d, 0, 0, 0, 0);
  return new Date(midnightUtc - offsetMinutes * 60_000);
}

export function utcToLocalDisplay(utcDate: Date, offsetMinutes: number): Date {
  return new Date(utcDate.getTime() + offsetMinutes * 60_000);
}

function parseGmtOffset(gmtString: string): number {
  if (gmtString === 'GMT') return 0;
  const match = gmtString.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2]!, 10);
  const mins = parseInt(match[3] ?? '0', 10);
  return sign * (hours * 60 + mins);
}

function validateOffset(offset: number): void {
  if (offset < -720 || offset > 840 || !Number.isInteger(offset)) {
    throw new PanchangError(
      `UTC offset must be an integer between -720 and 840, got ${offset}`,
      'INVALID_TIMEZONE'
    );
  }
}
