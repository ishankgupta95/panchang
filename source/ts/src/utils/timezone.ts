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

/** UTC accessors only: `getFullYear/Month/Date` would read the host runtime's timezone. */
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


/**
 * Render an instant as an offset-carrying ISO 8601 string, `"2025-01-14T07:09:44.172+05:30"`.
 * @param offsetMinutes Minutes east of UTC to render in.
 */
export function formatInZone(date: Date, offsetMinutes: number): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const abs = offsetMinutes < 0 ? -offsetMinutes : offsetMinutes;
  const year = shifted.getUTCFullYear();
  return (
    (year < 1000 ? String(year).padStart(4, '0') : String(year))
    + '-' + TWO_DIGITS[shifted.getUTCMonth() + 1] + '-' + TWO_DIGITS[shifted.getUTCDate()]
    + 'T' + TWO_DIGITS[shifted.getUTCHours()] + ':' + TWO_DIGITS[shifted.getUTCMinutes()]
    + ':' + TWO_DIGITS[shifted.getUTCSeconds()]
    + '.' + THREE_DIGITS[shifted.getUTCMilliseconds()]
    + (offsetMinutes < 0 ? '-' : '+') + TWO_DIGITS[(abs / 60) | 0]
    + ':' + TWO_DIGITS[abs % 60]
  );
}

// Precomputed to keep `padStart` off the hot format path. The 61 is exact: a UTC
// offset's minute part and a leap second both reach 60.
const TWO_DIGITS: string[] = [];
const THREE_DIGITS: string[] = [];
for (let i = 0; i < 1000; i++) {
  if (i < 61) TWO_DIGITS.push(i < 10 ? `0${i}` : String(i));
  THREE_DIGITS.push(i < 10 ? `00${i}` : i < 100 ? `0${i}` : String(i));
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
