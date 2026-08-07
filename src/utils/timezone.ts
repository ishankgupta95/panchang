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


/**
 * Render an instant as an **offset-carrying ISO 8601 string** —
 * `"2025-01-14T07:09:44.172+05:30"`.
 *
 * This is the one representation of "an instant, as seen in a zone" that
 * survives `JSON.stringify`, parses correctly in every environment, is
 * unambiguous without out-of-band context, and converts to
 * `Temporal.ZonedDateTime` in one call. Every `*Local` field in a result is
 * produced by this function.
 *
 * ## Why it is hand-rolled rather than `Intl.DateTimeFormat`
 *
 * A full daily panchang publishes ~230 instants, most of them inside the slot
 * systems (Choghadiya, Hora, Gowri, Do-Ghati). `Intl.DateTimeFormat` costs
 * ~1–2 µs per format even with a cached formatter, which would put 0.2–0.4 ms
 * on a call that currently takes 0.79 ms — a 25–50% regression to render
 * strings most callers read a handful of. Shifting the epoch and reading UTC
 * accessors is ~0.2 µs and needs no locale data, which also matters on Hermes,
 * where `Intl` is often absent or ICU-less.
 *
 * @param date          The true instant.
 * @param offsetMinutes Minutes east of UTC to render it in.
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

/**
 * `'00'` … `'60'` and `'000'` … `'999'`, precomputed.
 *
 * A full daily panchang calls {@link formatInZone} about 230 times, and each
 * call was making six `padStart` calls inside a template literal with eight
 * interpolations — the 2026-08-07 profile put the function at 4.8% of the whole
 * library's self time, more than the entire VSOP87 evaluation. Table lookup
 * removes the padding work and the intermediate substrings it allocated.
 *
 * The ranges are exactly what the accessors can return: 61 for a two-digit
 * slot, because a UTC offset's minute part and a leap second both reach 60, and
 * 1000 for milliseconds. Indexing past either would yield `undefined` and
 * silently produce the string `"undefined"` rather than throwing, so the sizes
 * are not incidental.
 */
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
