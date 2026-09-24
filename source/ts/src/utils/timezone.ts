import { PanchangError } from '../types/errors';
import { validateDate } from './validation';

/** An omitted (`undefined`) timezone reads as the host's zone through `Intl`; see `PanchangOptions.timezone`. */
export function resolveUtcOffset(timezone: number | string, referenceDate: Date): number {
  if (typeof timezone === 'number') {
    validateOffset(timezone);
    return timezone;
  }

  try {
    const parts = offsetFormatter(timezone).formatToParts(referenceDate);
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

/** A formatter is stateless and costs about 15 `formatToParts` calls to build, so one is kept
 * per zone name. Only a string that built one is kept (a rejected zone throws on every call,
 * and an omitted zone reads the host's zone afresh each time), and at most 64 are. */
const OFFSET_FORMATTERS = /* @__PURE__ */ new Map<string, Intl.DateTimeFormat>();
const MAX_OFFSET_FORMATTERS = 64;

function offsetFormatter(timezone: string): Intl.DateTimeFormat {
  const kept = OFFSET_FORMATTERS.get(timezone);
  if (kept !== undefined) return kept;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });
  if (typeof timezone === 'string' && OFFSET_FORMATTERS.size < MAX_OFFSET_FORMATTERS) {
    OFFSET_FORMATTERS.set(timezone, formatter);
  }
  return formatter;
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

const DAY_MS = 86_400_000;

/** The first and last instants `validateDate` accepts. */
export const SUPPORTED_START_MS = /* @__PURE__ */ Date.UTC(1900, 0, 1);
export const SUPPORTED_END_MS = /* @__PURE__ */ Date.UTC(2101, 0, 1) - 1;

export function clampToSupported(ms: number): number {
  return Math.min(Math.max(ms, SUPPORTED_START_MS), SUPPORTED_END_MS);
}

/** `Date.UTC(year, month, day)` without its reading of years 0 to 99 as 1900 to 1999. */
export function utcDateMs(year: number, month: number, day: number): number {
  const d = new Date(0);
  return d.setUTCFullYear(year, month, day);
}

/**
 * The instant `timezone` shows wall-clock time `wallMs` (local time written as epoch ms), with
 * the offset in force then. A time a DST change skips moves forward across the gap; a repeated
 * one takes its first occurrence. `hint`, an offset likely in force, is tried first.
 */
export function wallClockToUtc(
  wallMs: number,
  timezone: number | string,
  hint?: number,
): [number, number] {
  if (typeof timezone === 'number') {
    const offset = resolveUtcOffset(timezone, new Date(wallMs));
    return [wallMs - offset * 60_000, offset];
  }
  const offsetAt = (ms: number): number => resolveUtcOffset(timezone, new Date(ms));
  if (hint !== undefined && offsetAt(wallMs - hint * 60_000) === hint) {
    return [wallMs - hint * 60_000, hint];
  }
  const before = offsetAt(wallMs - DAY_MS);
  const after = offsetAt(wallMs + DAY_MS);
  const early = wallMs - before * 60_000;
  const earlyOffset = offsetAt(early);
  if (before === after) return [early, earlyOffset];
  const late = wallMs - after * 60_000;
  const earlyValid = earlyOffset === before;
  const lateValid = offsetAt(late) === after;
  if (earlyValid && lateValid) return early < late ? [early, before] : [late, after];
  if (lateValid && !earlyValid) return [late, after];
  return [early, earlyOffset];
}

/**
 * UTC midnight two days before `startYear` to the end of the second day after `endYear`, which
 * holds every local date of those years at any offset; cut to the supported span when both years
 * lie within it, as nothing lands in the part cut away.
 */
export function paddedYearWindow(startYear: number, endYear: number): [Date, Date] {
  const start = utcDateMs(startYear, 0, 1) - 2 * DAY_MS;
  const end = utcDateMs(endYear + 1, 0, 1) - 1 + 2 * DAY_MS;
  if (startYear < 1900 || endYear > 2100) return [new Date(start), new Date(end)];
  return [new Date(Math.max(start, SUPPORTED_START_MS)), new Date(Math.min(end, SUPPORTED_END_MS))];
}

/** Local midnight opening calendar year `year` in `timezone`, and the instant before the next one. */
export function localYearWindow(year: number, timezone: number | string): [number, number] {
  const [start] = wallClockToUtc(utcDateMs(year, 0, 1), timezone);
  const [next] = wallClockToUtc(utcDateMs(year + 1, 0, 1), timezone);
  return [start, next - 1];
}

/**
 * One instant per civil day of `timezone`: `startMs`, then the same local time of day on each
 * following date at that date's own offset. A time of day a DST change skips moves forward (to
 * the date's midnight if it would leave the date) and a date the zone skips is passed over, so
 * each call returns a later instant. A fixed offset steps exactly 24 hours.
 */
export function civilDayStepper(startMs: number, timezone: number | string): () => number {
  if (typeof timezone === 'number') {
    let t = startMs - DAY_MS;
    return () => (t += DAY_MS);
  }
  let offset = resolveUtcOffset(timezone, new Date(startMs));
  const startWall = startMs + offset * 60_000;
  let day = Math.floor(startWall / DAY_MS);
  const timeOfDay = startWall - day * DAY_MS;
  let prev: number | null = null;
  const onDay = ([t, o]: [number, number]): boolean => Math.floor((t + o * 60_000) / DAY_MS) === day;
  return () => {
    if (prev === null) return (prev = startMs);
    for (;;) {
      day++;
      let at = wallClockToUtc(day * DAY_MS + timeOfDay, timezone, offset);
      if (!onDay(at)) {
        at = wallClockToUtc(day * DAY_MS, timezone, offset);
        if (!onDay(at)) continue;
      }
      if (at[0] <= prev) continue;
      offset = at[1];
      return (prev = at[0]);
    }
  };
}

/**
 * An instant on the civil date whose UTC midnight is `dayMs`, in `timezone`: `dayMs` itself where
 * it already falls on that date (every offset at or east of UTC), else the date's local midnight;
 * null for a date the zone skips.
 */
export function instantInCivilDay(dayMs: number, timezone: number | string): number | null {
  const offset = resolveUtcOffset(timezone, new Date(dayMs));
  if (offset >= 0) return dayMs;
  const [t, o] = wallClockToUtc(dayMs, timezone, offset);
  return Math.floor((t + o * 60_000) / DAY_MS) * DAY_MS === dayMs ? t : null;
}

/**
 * The value a day-valued listing returns for the civil date whose UTC midnight is `dayMs`: the UTC
 * midnight that falls within that local day, so reading it in `timezone` gives the date back.
 * That is `dayMs` itself at every offset at or east of UTC, and the next UTC midnight west of it.
 */
export function civilDayValue(dayMs: number, timezone: number | string): number {
  return resolveUtcOffset(timezone, new Date(dayMs)) < 0 ? dayMs + DAY_MS : dayMs;
}

/**
 * Render an instant as an offset-carrying ISO 8601 string, `"2025-01-14T07:09:44.172+05:30"`.
 * @param offsetMinutes Minutes east of UTC to render in, an integer; an offset of 100 hours or more gets as many hour
 *   digits as it needs. A non-integer throws `PanchangError` `INVALID_TIMEZONE`, and an Invalid Date `INVALID_DATE`.
 */
export function formatInZone(date: Date, offsetMinutes: number): string {
  validateDate(date, 'any');
  if (!Number.isInteger(offsetMinutes)) {
    throw new PanchangError(`UTC offset must be an integer, got ${offsetMinutes}`, 'INVALID_TIMEZONE');
  }
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const abs = offsetMinutes < 0 ? -offsetMinutes : offsetMinutes;
  const hours = Math.floor(abs / 60);
  const year = shifted.getUTCFullYear();
  return (
    (year < 1000 ? String(year).padStart(4, '0') : String(year))
    + '-' + TWO_DIGITS[shifted.getUTCMonth() + 1] + '-' + TWO_DIGITS[shifted.getUTCDate()]
    + 'T' + TWO_DIGITS[shifted.getUTCHours()] + ':' + TWO_DIGITS[shifted.getUTCMinutes()]
    + ':' + TWO_DIGITS[shifted.getUTCSeconds()]
    + '.' + THREE_DIGITS[shifted.getUTCMilliseconds()]
    + (offsetMinutes < 0 ? '-' : '+') + (hours < TWO_DIGITS.length ? TWO_DIGITS[hours] : String(hours))
    + ':' + TWO_DIGITS[abs % 60]
  );
}

const TWO_DIGITS: readonly string[] = /* @__PURE__ */ (() => {
  const out: string[] = [];
  for (let i = 0; i < 61; i++) out.push(i < 10 ? `0${i}` : String(i));
  return out;
})();
const THREE_DIGITS: readonly string[] = /* @__PURE__ */ (() => {
  const out: string[] = [];
  for (let i = 0; i < 1000; i++) out.push(i < 10 ? `00${i}` : i < 100 ? `0${i}` : String(i));
  return out;
})();

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
