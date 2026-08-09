/**
 * Eclipses as this library reports them — the panchang-facing layer over
 * {@link findLunarEclipse} and {@link findLocalSolarEclipse}.
 *
 * The geometry lives in `eclipseGeometry.ts`; what is here is the search that
 * decides *which* eclipse to report, the sutak (impurity window) rules, and the
 * i18n. Those are rule questions, adjudicated by Drik and pandit consensus
 * (Tier 1), and keeping them out of the geometry module is what lets the
 * geometry be checked against NASA (Tier 0) without a rule choice in the way.
 *
 * ## How an eclipse is found
 *
 * A solar eclipse can only happen at conjunction and a lunar eclipse only at
 * opposition — definitional, not an approximation. So the search walks syzygies
 * from `lunation.ts` and asks the geometry about each one, instead of scanning
 * time. Most syzygies carry no eclipse, and the ones that cannot are rejected
 * by a single ecliptic-latitude read before any of the expensive work runs.
 */
import { findLunarEclipse, findLocalSolarEclipse } from './eclipseGeometry';
import { searchMoonPhase } from './lunation';
import { getMoonPosition, getTropicalMoonLongitude } from './moon';
import { getTropicalSunLongitude } from './sun';
import { bodyAltitudeDegrees, type HorizonBody } from './horizon';
import { normalize360 } from '../utils/angle';
import { getTranslations } from '../i18n/resolver';
import type { GeoLocation } from '../types/location';
import type { Language } from '../types/options';

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
  /**
   * Fraction of the eclipsed body's disc **area** covered at greatest eclipse,
   * range [0, 1]. For a lunar eclipse this is the *umbral* obscuration, so a
   * penumbral eclipse reads 0.
   *
   * This is the number to show as a percentage, and it is what `description`
   * renders. Through 4.x and the 5.0.0 release candidates it was published
   * under the name `magnitude`, which is a different quantity — see below.
   */
  obscuration: number;
  /**
   * Eclipse **magnitude** at greatest eclipse: the fraction of the eclipsed
   * body's *diameter* covered. This is the quantity every published catalogue
   * means by "magnitude", including NASA/Espenak's Five Millennium Canon, and
   * it is the field to compare against one.
   *
   * **It is not a [0, 1] fraction, and that is not a defect.** A total eclipse
   * exceeds 1 (the canon reaches 1.86 for lunar, 1.08 for solar), and a
   * *penumbral* lunar eclipse is **negative** — the Moon misses the umbra
   * entirely, and the canon prints the miss distance as a negative umbral
   * magnitude. Branch on `subtype` rather than clamping: `'penumbral'` is
   * exactly the case where this is below zero.
   *
   * @see obscuration — the area fraction, which is what a percentage wants.
   */
  magnitude: number;
  /** Pre-eclipse impurity window start (sutak), or null when no sutak applies (penumbral lunar eclipse). Solar: 12h (4 prahara) before partial first contact; lunar: 9h (3 prahara) before the UMBRAL (partial) first contact. */
  sutakStart: Date | null;
  /** End of sutak (moksha / purification point) — partial last contact (umbral last contact for lunar); null for penumbral lunar eclipses. */
  sutakEnd: Date | null;
  description: string;
}

// Classical Smarta convention: 4 prahara (12h) for solar, 3 prahara (9h) for
// lunar. A prahara = 1/8 of a day = 3 hours.
const SOLAR_SUTAK_HOURS = 12;
const LUNAR_SUTAK_HOURS = 9;

const DAY_MS = 86_400_000;

/**
 * Ecliptic latitude beyond which the syzygy cannot carry an eclipse, degrees.
 *
 * The largest geocentric lunar latitude that still produces a solar eclipse
 * somewhere on Earth is about 1.58°; for a lunar eclipse the penumbra plus the
 * Moon's own semidiameter reaches about 1.50°. One bound covers both with
 * margin, and it is the same 1.8° `astronomy-engine` pruned on — kept
 * deliberately, so a syzygy this library skips is one the implementation it
 * replaces skipped too.
 */
const ECLIPSE_LATITUDE_LIMIT_DEG = 1.8;

/**
 * How far past a syzygy the next search starts, days. Syzygies of the same kind
 * are ~29.5 days apart and never closer than ~29.2, so ten days cannot skip one
 * and cannot resolve back onto the one just examined.
 */
const SYZYGY_ADVANCE_DAYS = 10;

/**
 * Check whether a body is above the horizon at the given UTC instant, for the
 * given observer.
 *
 * Topocentric, with atmospheric refraction — the same convention the rise/set
 * solver uses, so "above the horizon" here and "after sunrise" there cannot
 * disagree about a body sitting on the horizon.
 *
 * **v5 signature change.** `body` was an `astronomy-engine` `Body` enum member;
 * it is now this library's own `'sun' | 'moon'`. The dependency that supplied
 * the old type is gone, and a public signature could not keep referring to it.
 */
export function isBodyAboveHorizon(
  date: Date, location: GeoLocation, body: HorizonBody,
): boolean {
  return bodyAltitudeDegrees(date, location, body) > 0;
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
  const body: HorizonBody = eclipse.kind === 'solar' ? 'sun' : 'moon';
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
 * Walk syzygies of one kind forward from `fromUtc`, handing each to `attempt`
 * until one yields an eclipse.
 *
 * `attempt` returns `null` for a syzygy that carries no eclipse — which is most
 * of them, and is the ordinary case rather than a failure. The walk stops once
 * the syzygies themselves run past the caller's window; whether the eclipse
 * *found* is inside the window is the caller's question, because the two
 * families bound it on different contacts.
 */
function searchFromSyzygies<T>(
  fromUtc: Date,
  targetElongationDeg: number,
  syzygyLimitMs: number,
  attempt: (syzygy: Date) => T | null,
): T | null {
  let cursor = fromUtc;
  // One iteration per lunation in the window, plus slack for the first partial
  // lunation and for a window that ends just before a syzygy.
  const maxIterations = Math.ceil((syzygyLimitMs - fromUtc.getTime()) / (29.5 * DAY_MS)) + 2;
  for (let i = 0; i < maxIterations; i++) {
    const syzygy = searchMoonPhase(targetElongationDeg, cursor, 45);
    if (syzygy === null || syzygy.getTime() > syzygyLimitMs) return null;
    // One position read rejects the ~85% of syzygies that sit too far from a
    // node, before any contact solving happens.
    if (Math.abs(getMoonPosition(syzygy).latitude) < ECLIPSE_LATITUDE_LIMIT_DEG) {
      const hit = attempt(syzygy);
      if (hit !== null) return hit;
    }
    cursor = new Date(syzygy.getTime() + SYZYGY_ADVANCE_DAYS * DAY_MS);
  }
  return null;
}

/**
 * Next lunar eclipse (penumbral / partial / total) whose penumbral phase begins
 * within `withinDays` days after `fromUtc`, as an `EclipseInfo`, or `null`.
 *
 * Lunar eclipse visibility requires the Moon to be above the horizon at peak;
 * the `visibleFromLocation` field is set based on that check.
 *
 * Argument order matches `getUpcomingSolarEclipse` and `getEclipseDuringDay`.
 *
 * @param fromUtc     UTC instant to search forward from.
 * @param location    Observer location (required for `visibleFromLocation`).
 * @param withinDays  Max number of days ahead to look.
 * @param lang        Language for `description`. Defaults to `'en'`.
 */
export function getUpcomingLunarEclipse(
  fromUtc: Date,
  location: GeoLocation,
  withinDays: number,
  lang: Language = 'en',
): EclipseInfo | null {
  const windowEndMs = fromUtc.getTime() + withinDays * DAY_MS;
  const eclipse = searchFromSyzygies(
    fromUtc, 180, windowEndMs + DAY_MS, (opposition) => findLunarEclipse(opposition),
  );
  if (eclipse === null) return null;
  // An eclipse whose penumbra has not touched the window by its end belongs to
  // the next call, not this one.
  if (eclipse.penumbralBegin.getTime() > windowEndMs) return null;

  const subtype: EclipseSubtype = eclipse.kind;
  // Sutak is anchored to the UMBRAL (partial) phase, not the faint penumbral
  // phase: DrikPanchang / pandit convention. Penumbral eclipses have no umbral
  // phase and carry no sutak.
  const umbralBegin = eclipse.partialBegin;
  const umbralEnd = eclipse.partialEnd;
  const hasUmbra = umbralBegin !== null && umbralEnd !== null;
  const visibleFromLocation = location
    ? isBodyAboveHorizon(eclipse.peak, location, 'moon')
    : false;

  return {
    kind: 'lunar',
    subtype,
    start: eclipse.penumbralBegin,
    peak: eclipse.peak,
    end: eclipse.penumbralEnd,
    visibleFromLocation,
    obscuration: eclipse.umbralObscuration,
    // The catalogue quantity — a diameter fraction, negative for a penumbral
    // eclipse and above 1 for a total one. See the field's doc comment.
    magnitude: eclipse.umbralMagnitude,
    sutakStart: hasUmbra
      ? new Date(umbralBegin.getTime() - LUNAR_SUTAK_HOURS * 3600_000)
      : null,
    sutakEnd: hasUmbra ? umbralEnd : null,
    description: describeEclipse(
      'lunar', subtype, eclipse.umbralObscuration, visibleFromLocation, lang,
    ),
  };
}

/**
 * Next solar eclipse (partial / annular / total) whose local partial phase
 * begins within `withinDays` days after `fromUtc`, as observed from `location`,
 * or `null`.
 *
 * Only eclipses this observer actually experiences are returned: the observer
 * must be inside the penumbra, and the Sun must be above the horizon at first
 * or last contact. An eclipse that runs entirely below this observer's horizon
 * is skipped, exactly as the implementation this replaces skipped it — otherwise
 * every eclipse anywhere on Earth would surface as a local event with a
 * `visibleFromLocation: false` flag nobody asked for.
 *
 * @param fromUtc     UTC instant to search forward from.
 * @param location    Observer location.
 * @param withinDays  Max number of days ahead to look.
 * @param lang        Language for `description`. Defaults to `'en'`.
 */
export function getUpcomingSolarEclipse(
  fromUtc: Date,
  location: GeoLocation,
  withinDays: number,
  lang: Language = 'en',
): EclipseInfo | null {
  const windowEndMs = fromUtc.getTime() + withinDays * DAY_MS;
  const eclipse = searchFromSyzygies(fromUtc, 0, windowEndMs + DAY_MS, (conjunction) => {
    const local = findLocalSolarEclipse(conjunction, location);
    if (local === null) return null;
    // Ignore an eclipse that happens entirely at night for this observer.
    return local.beginAltitude > 0 || local.endAltitude > 0 ? local : null;
  });
  if (eclipse === null) return null;
  if (eclipse.partialBegin.getTime() > windowEndMs) return null;

  const subtype: EclipseSubtype = eclipse.kind;
  const visibleFromLocation = eclipse.peakAltitude > 0;

  return {
    kind: 'solar',
    subtype,
    start: eclipse.partialBegin,
    peak: eclipse.peak,
    end: eclipse.partialEnd,
    visibleFromLocation,
    obscuration: eclipse.obscuration,
    magnitude: eclipse.magnitude,
    sutakStart: new Date(eclipse.partialBegin.getTime() - SOLAR_SUTAK_HOURS * 3600_000),
    sutakEnd: eclipse.partialEnd,
    description: describeEclipse(
      'solar', subtype, eclipse.obscuration, visibleFromLocation, lang,
    ),
  };
}

/**
 * The two longitude reads the syzygy guard needs. `getDailyPanchang` passes its
 * own {@link LongitudeCache} accessors so the guard's four evaluations are
 * answered by the interpolant the rest of the call already built; direct callers
 * get the uncached theory.
 */
export interface SyzygyLongitudes {
  tropicalMoon: (date: Date) => number;
  tropicalSun: (date: Date) => number;
}

const DIRECT_LONGITUDES: SyzygyLongitudes = {
  tropicalMoon: getTropicalMoonLongitude,
  tropicalSun: getTropicalSunLongitude,
};

/**
 * Moon–Sun elongation in [0, 360) at a UTC instant. Ayanamsa cancels in the
 * difference, so tropical longitudes are used directly and no ayanamsa system
 * needs to be threaded in.
 */
function elongationAt(date: Date, lon: SyzygyLongitudes): number {
  return normalize360(lon.tropicalMoon(date) - lon.tropicalSun(date));
}

/**
 * Syzygy guard for {@link getEclipseDuringDay}.
 *
 * A solar eclipse can only occur at conjunction (elongation 0°) and a lunar
 * eclipse only at opposition (180°) — this is definitional, not an
 * approximation. Elongation advances monotonically at ~12.19°/day, so a
 * syzygy falls inside `[fromUtc, toUtc]` exactly when the elongation, measured
 * relative to `targetDeg`, wraps past zero across the interval.
 *
 * Callers pad the interval (see `SYZYGY_GUARD_MARGIN_MS`) because an eclipse's
 * *peak* is local maximum obscuration, which parallax can offset from exact
 * geocentric syzygy by up to ~an hour, and because `getEclipseDuringDay` also
 * admits an eclipse whose peak sits slightly before sunrise.
 *
 * Costs 4 ephemeris evaluations; skips a search costing several hundred.
 */
function syzygyBetween(
  fromUtc: Date, toUtc: Date, targetDeg: number, lon: SyzygyLongitudes,
): boolean {
  const relFrom = normalize360(elongationAt(fromUtc, lon) - targetDeg);
  const relTo = normalize360(elongationAt(toUtc, lon) - targetDeg);
  // Exactly at (or a hair past) the target at the start of the window.
  if (relFrom === 0) return true;
  // Elongation increases; a wrap past 360→0 means the target was crossed.
  return relTo < relFrom;
}

/**
 * Padding applied on each side of the Hindu day before the syzygy test, in ms.
 * 12 h ≈ 6.1° of elongation — far wider than the ~1 h peak-vs-syzygy offset it
 * needs to absorb, so the guard never hides a real eclipse.
 */
const SYZYGY_GUARD_MARGIN_MS = 12 * 3600_000;

/**
 * If an eclipse overlaps the Hindu day `[sunriseUtc, nextSunriseUtc)`, return it;
 * otherwise `null`. Used by `getDailyPanchang` to surface eclipses as a top-level
 * field. Both solar (local) and lunar are checked; solar is preferred when both
 * hit the same Hindu day (impossible in practice — they never pair within hours).
 *
 * Each branch is guarded by a cheap syzygy test, so on the ~98% of days that
 * hold neither a new nor a full moon this returns `null` after 4 ephemeris
 * evaluations instead of running a full eclipse search.
 */
export function getEclipseDuringDay(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  location: GeoLocation,
  lang: Language = 'en',
  longitudes: SyzygyLongitudes = DIRECT_LONGITUDES,
): EclipseInfo | null {
  const windowMs = nextSunriseUtc.getTime() - sunriseUtc.getTime();
  const windowDays = Math.ceil(windowMs / (24 * 3600_000)) + 1;

  const guardFrom = new Date(sunriseUtc.getTime() - SYZYGY_GUARD_MARGIN_MS);
  const guardTo = new Date(nextSunriseUtc.getTime() + SYZYGY_GUARD_MARGIN_MS);

  if (syzygyBetween(guardFrom, guardTo, 0, longitudes)) {
    const solar = getUpcomingSolarEclipse(sunriseUtc, location, windowDays, lang);
    if (solar && solar.peak.getTime() < nextSunriseUtc.getTime()) return solar;
  }

  if (syzygyBetween(guardFrom, guardTo, 180, longitudes)) {
    const lunar = getUpcomingLunarEclipse(sunriseUtc, location, windowDays, lang);
    if (lunar && lunar.peak.getTime() < nextSunriseUtc.getTime()) return lunar;
  }

  return null;
}

/**
 * Render an eclipse description in `lang`.
 *
 * Previously built with an English template literal here, which meant a
 * `language: 'hi'` daily panchang carried a Hindi festival `name` alongside an
 * English `description`. Every input is already structured on `EclipseInfo`, so
 * the sentence is pure presentation and belongs in the i18n layer.
 */
function describeEclipse(
  kind: 'solar' | 'lunar',
  subtype: EclipseSubtype,
  /** Area fraction, not magnitude — the template renders "{percent}% obscuration". */
  obscuration: number,
  visible: boolean,
  lang: Language,
): string {
  const e = getTranslations(lang).eclipse;
  return e.template
    .replace('{subtype}', e.subtype[subtype])
    .replace('{kind}', e.kind[kind])
    .replace('{percent}', String(Math.round(obscuration * 100)))
    .replace('{visibility}', visible ? e.visibility.visible : e.visibility.notVisible);
}
