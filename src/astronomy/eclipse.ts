import {
  SearchLunarEclipse,
  NextLunarEclipse,
  SearchLocalSolarEclipse,
  NextLocalSolarEclipse,
  Observer,
  Body,
  Equator,
  Horizon,
  EclipseKind,
} from 'astronomy-engine';
import type { GeoLocation } from '../types/location';

export type EclipseSubtype = 'partial' | 'total' | 'annular' | 'penumbral';

export interface EclipseInfo {
  kind: 'solar' | 'lunar';
  subtype: EclipseSubtype;
  /** UTC time the eclipse's visible/observable phase begins (partial_begin for solar, penumbral start for lunar). */
  start: Date;
  /** UTC time of greatest eclipse. */
  peak: Date;
  /** UTC time the eclipse's visible/observable phase ends. */
  end: Date;
  /** True when the eclipse is observable from `location` (Sun/Moon above horizon at peak). */
  visibleFromLocation: boolean;
  /** Fraction of the disc obscured at peak, range [0, 1]. */
  magnitude: number;
  /** Pre-eclipse impurity window start (sutak). 12h (4 prahara) before `start` for solar, 9h (3 prahara) for lunar — classical Smarta convention. */
  sutakStart: Date;
  /** End of sutak — coincides with eclipse end (moksha / purification point). */
  sutakEnd: Date;
  description: string;
}

// Classical Smarta convention: 4 prahara (12h) for solar, 3 prahara (9h) for
// lunar. A prahara = 1/8 of a day = 3 hours.
const SOLAR_SUTAK_HOURS = 12;
const LUNAR_SUTAK_HOURS = 9;

function eclipseKindToSubtype(kind: EclipseKind): EclipseSubtype {
  switch (kind) {
    case EclipseKind.Penumbral: return 'penumbral';
    case EclipseKind.Partial:   return 'partial';
    case EclipseKind.Annular:   return 'annular';
    case EclipseKind.Total:     return 'total';
  }
}

function makeObserver(location: GeoLocation): Observer {
  return new Observer(location.latitude, location.longitude, location.elevation ?? 0);
}

/**
 * Check whether a body is above the horizon at the given UTC instant,
 * for the given observer.
 *
 * Uses topocentric equatorial coordinates converted to horizontal coordinates
 * with atmospheric refraction correction.
 */
export function isBodyAboveHorizon(date: Date, location: GeoLocation, body: Body): boolean {
  const observer = makeObserver(location);
  const eq = Equator(body, date, observer, true, true);
  const hor = Horizon(date, observer, eq.ra, eq.dec, 'normal');
  return hor.altitude > 0;
}

/**
 * Whether an eclipse is observable from `location` during *any* phase — the
 * eclipsed body (Sun for solar, Moon for lunar) above the horizon at any point
 * between first and last contact. Broader than `EclipseInfo.visibleFromLocation`,
 * which checks only the peak: this catches an eclipse already in progress at
 * moonrise/sunrise or still in progress at moonset/sunset (e.g. a total lunar
 * eclipse whose Moon rises already eclipsed).
 *
 * The contact window `[start, end]` is sampled at a fixed cadence; at the
 * latitudes where eclipses are observed the body's altitude is unimodal over
 * the few-hour window, so a dozen samples reliably detect any visible portion.
 */
export function isEclipseVisibleAnyPhase(
  eclipse: EclipseInfo,
  location: GeoLocation,
): boolean {
  const body = eclipse.kind === 'solar' ? Body.Sun : Body.Moon;
  const startMs = eclipse.start.getTime();
  const endMs = eclipse.end.getTime();
  const SAMPLES = 12;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = new Date(startMs + ((endMs - startMs) * i) / SAMPLES);
    if (isBodyAboveHorizon(t, location, body)) return true;
  }
  return false;
}

/**
 * Next lunar eclipse (penumbral / partial / total) whose peak occurs within
 * `withinDays` days after `fromUtc`, as an `EclipseInfo`, or `null` if none.
 *
 * Lunar eclipse visibility requires the Moon to be above the horizon at peak;
 * the `visibleFromLocation` field is set based on that check.
 *
 * Argument order matches `getUpcomingSolarEclipse` and `getEclipseDuringDay`.
 *
 * @param fromUtc     UTC instant to search forward from.
 * @param location    Observer location (required for `visibleFromLocation`).
 * @param withinDays  Max number of days ahead to look.
 */
export function getUpcomingLunarEclipse(
  fromUtc: Date,
  location: GeoLocation,
  withinDays: number,
): EclipseInfo | null {
  let info = SearchLunarEclipse(fromUtc);
  // Sanity-bounded loop to catch the first eclipse whose PENUMBRAL start is
  // within the search window (an eclipse whose peak is after the window but
  // whose penumbra touches it should still be considered).
  for (let i = 0; i < 6; i++) {
    const peakMs = info.peak.date.getTime();
    const windowEndMs = fromUtc.getTime() + withinDays * 24 * 3600_000;
    if (peakMs > windowEndMs + info.sd_penum * 60_000) return null;

    const peakDate = info.peak.date;
    const startDate = new Date(peakDate.getTime() - info.sd_penum * 60_000);
    const endDate = new Date(peakDate.getTime() + info.sd_penum * 60_000);

    if (endDate.getTime() >= fromUtc.getTime()) {
      const subtype = eclipseKindToSubtype(info.kind);
      const sutakStart = new Date(startDate.getTime() - LUNAR_SUTAK_HOURS * 3600_000);
      const sutakEnd = endDate;
      const visibleFromLocation = location
        ? isBodyAboveHorizon(peakDate, location, Body.Moon)
        : false;

      return {
        kind: 'lunar',
        subtype,
        start: startDate,
        peak: peakDate,
        end: endDate,
        visibleFromLocation,
        magnitude: info.obscuration,
        sutakStart,
        sutakEnd,
        description: describeLunarEclipse(subtype, info.obscuration, visibleFromLocation),
      };
    }
    info = NextLunarEclipse(info.peak);
  }
  return null;
}

/**
 * Next solar eclipse (partial / annular / total) whose peak occurs within
 * `withinDays` days after `fromUtc`, as observed from `location`, or `null`.
 *
 * Uses `SearchLocalSolarEclipse` so partial-begin/peak/partial-end map to
 * the observer's local experience of the eclipse. `visibleFromLocation`
 * is true when the Sun is above the horizon at peak.
 *
 * @param fromUtc     UTC instant to search forward from.
 * @param location    Observer location.
 * @param withinDays  Max number of days ahead to look.
 */
export function getUpcomingSolarEclipse(
  fromUtc: Date,
  location: GeoLocation,
  withinDays: number,
): EclipseInfo | null {
  const observer = makeObserver(location);
  let info = SearchLocalSolarEclipse(fromUtc, observer);
  for (let i = 0; i < 6; i++) {
    const peakMs = info.peak.time.date.getTime();
    const windowEndMs = fromUtc.getTime() + withinDays * 24 * 3600_000;
    if (peakMs > windowEndMs + 6 * 3600_000) return null;

    const startDate = info.partial_begin.time.date;
    const peakDate = info.peak.time.date;
    const endDate = info.partial_end.time.date;

    if (endDate.getTime() >= fromUtc.getTime()) {
      const subtype = eclipseKindToSubtype(info.kind);
      const sutakStart = new Date(startDate.getTime() - SOLAR_SUTAK_HOURS * 3600_000);
      const sutakEnd = endDate;
      const visibleFromLocation = info.peak.altitude > 0;

      return {
        kind: 'solar',
        subtype,
        start: startDate,
        peak: peakDate,
        end: endDate,
        visibleFromLocation,
        magnitude: info.obscuration,
        sutakStart,
        sutakEnd,
        description: describeSolarEclipse(subtype, info.obscuration, visibleFromLocation),
      };
    }
    info = NextLocalSolarEclipse(info.peak.time, observer);
  }
  return null;
}

/**
 * If an eclipse overlaps the Hindu day `[sunriseUtc, nextSunriseUtc)`, return it;
 * otherwise `null`. Used by `getDailyPanchang` to surface eclipses as a top-level
 * field. Both solar (local) and lunar are checked; solar is preferred when both
 * hit the same Hindu day (impossible in practice — they never pair within hours).
 */
export function getEclipseDuringDay(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  location: GeoLocation,
): EclipseInfo | null {
  const windowMs = nextSunriseUtc.getTime() - sunriseUtc.getTime();
  const windowDays = Math.ceil(windowMs / (24 * 3600_000)) + 1;

  const solar = getUpcomingSolarEclipse(sunriseUtc, location, windowDays);
  if (solar && solar.peak.getTime() < nextSunriseUtc.getTime()) return solar;

  const lunar = getUpcomingLunarEclipse(sunriseUtc, location, windowDays);
  if (lunar && lunar.peak.getTime() < nextSunriseUtc.getTime()) return lunar;

  return null;
}

function describeSolarEclipse(subtype: EclipseSubtype, mag: number, visible: boolean): string {
  const pct = Math.round(mag * 100);
  const vis = visible ? 'visible from location' : 'not visible from location';
  return `${capitalize(subtype)} solar eclipse — ${pct}% obscuration, ${vis}.`;
}

function describeLunarEclipse(subtype: EclipseSubtype, mag: number, visible: boolean): string {
  const pct = Math.round(mag * 100);
  const vis = visible ? 'visible from location' : 'not visible from location';
  return `${capitalize(subtype)} lunar eclipse — ${pct}% obscuration, ${vis}.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
