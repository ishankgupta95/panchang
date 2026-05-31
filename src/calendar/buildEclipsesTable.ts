// Build an eclipse table for an arbitrary location. This is the engine-side
// counterpart to the bundled-JSON lookup in `eclipsesTable.ts`, mirroring
// `buildFestivalsTable`.
//
// Use it to pre-compute a location-specific eclipse table once and cache it —
// the intended pattern for an offline app serving users outside India, where
// which eclipses are *visible* (and therefore carry a sutak window) differs
// by location. Compute the table for the user's actual location, persist the
// returned JSON, and read it back through `getEclipsesForYear` /
// `getEclipsesForDate` by passing it as their `source` argument.

import { getEclipsesInRange } from './yearly';
import { isEclipseVisibleAnyPhase } from '../astronomy/eclipse';
import type { GeoLocation } from '../types/location';
import type { EclipseInfo } from '../types/elements';
import type {
  EclipsesFile,
  EclipsesTableLanguage,
  EclipseTableEntryRaw,
  EclipseTableKind,
  EclipseTableSubtype,
  LocalizedString,
  RawEclipseTableDay,
} from './eclipsesTableTypes';

export interface BuildEclipsesTableOptions {
  /** Observer coordinates. */
  location: GeoLocation;
  /**
   * UTC offset in minutes east of UTC, e.g. `330` for IST, `-300` for US
   * Eastern (EST), `0` for UK/GMT. Used to group eclipses into local calendar
   * dates (by peak) and stamped into `_meta`.
   */
  timezoneOffsetMinutes: number;
  /** First Gregorian year to include (inclusive). */
  startYear: number;
  /** Last Gregorian year to include (inclusive). */
  endYear: number;
  /** Locales to emit. Defaults to `['en', 'hi']`. */
  languages?: readonly EclipsesTableLanguage[];
  /**
   * Include only eclipses observable from `location` (body above the horizon
   * at peak). Defaults to `true`. Set `false` to also list eclipses that occur
   * while the body is below the horizon (no sutak emitted for those).
   */
  visibleOnly?: boolean;
  /** Human-readable label for the location, stamped into `_meta`. */
  referenceLocation?: string;
  /** ISO timestamp stamped into `_meta.generatedAt`. Defaults to `''`. */
  generatedAt?: string;
  /** Free-text note stamped into `_meta.note`. */
  note?: string;
}

const DEFAULT_NOTE =
  'Pre-computed eclipse table. Includes every eclipse observable from the ' +
  'reference location during any phase (eclipsed body above the horizon ' +
  'between first and last contact) — so an eclipse already in progress at ' +
  'moon/sunrise or moon/sunset is listed. `visibleAtPeak` flags whether the ' +
  'peak itself is observable. Solar eclipses carry the subtype seen locally. ' +
  'The sutak window is present only for eclipses that warrant it: visible ' +
  'solar (all subtypes) and visible umbral lunar (partial/total). Penumbral ' +
  'lunar eclipses carry no sutak and are not religiously observed (drik / ' +
  'pandit consensus). Times are ISO UTC.';

// Localized name parts. Hindi adjective precedes the noun, as in English, so
// `${adj} ${noun}` reads correctly in both ("Total Lunar Eclipse" /
// "पूर्ण चंद्र ग्रहण").
const KIND_NOUN: Record<EclipsesTableLanguage, Record<EclipseTableKind, string>> = {
  en: { solar: 'Solar Eclipse', lunar: 'Lunar Eclipse' },
  hi: { solar: 'सूर्य ग्रहण', lunar: 'चंद्र ग्रहण' },
};
const SUBTYPE_ADJ: Record<EclipsesTableLanguage, Record<EclipseTableSubtype, string>> = {
  en: { total: 'Total', partial: 'Partial', annular: 'Annular', penumbral: 'Penumbral' },
  hi: { total: 'पूर्ण', partial: 'आंशिक', annular: 'वलयाकार', penumbral: 'उपच्छाया' },
};

function localizedName(
  kind: EclipseTableKind,
  subtype: EclipseTableSubtype,
  lang: EclipsesTableLanguage,
): string {
  return `${SUBTYPE_ADJ[lang][subtype]} ${KIND_NOUN[lang][kind]}`;
}

function localizedDescription(
  kind: EclipseTableKind,
  subtype: EclipseTableSubtype,
  magnitude: number,
  lang: EclipsesTableLanguage,
): string {
  const name = localizedName(kind, subtype, lang);
  // A penumbral lunar eclipse touches only the penumbra — visually faint,
  // umbral obscuration is 0, and it carries no sutak — so describe it as such
  // rather than printing a misleading "0% obscuration".
  if (subtype === 'penumbral') {
    return lang === 'hi'
      ? `${name} — केवल उपच्छाया छाया; सूतक नहीं।`
      : `${name} — penumbral shadow only; no sutak.`;
  }
  const pct = Math.round(magnitude * 100);
  return lang === 'hi'
    ? `${name} — ${pct}% ग्रास।`
    : `${name} — ${pct}% obscuration.`;
}

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeEntry(
  e: EclipseInfo,
  anyPhaseVisible: boolean,
  languages: readonly EclipsesTableLanguage[],
): EclipseTableEntryRaw {
  const kind = e.kind as EclipseTableKind;
  const subtype = e.subtype as EclipseTableSubtype;

  const name: LocalizedString = {};
  const description: LocalizedString = {};
  for (const lang of languages) {
    name[lang] = localizedName(kind, subtype, lang);
    description[lang] = localizedDescription(kind, subtype, e.magnitude, lang);
  }

  const entry: EclipseTableEntryRaw = {
    name,
    kind,
    subtype,
    start: e.start.toISOString(),
    peak: e.peak.toISOString(),
    end: e.end.toISOString(),
    magnitude: e.magnitude,
    visibleFromLocation: anyPhaseVisible,
    visibleAtPeak: e.visibleFromLocation,
    description,
  };
  // Sutak applies only to an observable eclipse that warrants it: all visible
  // solar eclipses, and visible umbral (partial/total) lunar eclipses.
  // Penumbral lunar eclipses carry no sutak (drik / pandit consensus).
  if (anyPhaseVisible && subtype !== 'penumbral') {
    entry.sutak = { start: e.sutakStart.toISOString(), end: e.sutakEnd.toISOString() };
  }
  return entry;
}

/**
 * Compute an eclipse table for the given location and year range.
 *
 * Enumerates eclipses once across the whole window and buckets each by the
 * local calendar date of its peak (in the reference timezone), so an eclipse
 * whose UTC peak lands just across a year boundary is still filed under the
 * year its local date belongs to. Every in-range year appears as a key, even
 * those with no eclipses (an empty array).
 *
 * @returns An {@link EclipsesFile} ready to serialize, cache, and feed back
 *          into the `getEclipsesForYear` / `getEclipsesForDate` accessors via
 *          their `source` argument.
 */
export function buildEclipsesTable(
  opts: BuildEclipsesTableOptions,
): EclipsesFile {
  const {
    location,
    timezoneOffsetMinutes,
    startYear,
    endYear,
    languages = ['en', 'hi'],
    visibleOnly = true,
    referenceLocation = '',
    generatedAt = '',
    note = DEFAULT_NOTE,
  } = opts;

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new RangeError('startYear and endYear must be integers');
  }
  if (startYear > endYear) {
    throw new RangeError(`startYear (${startYear}) must be ≤ endYear (${endYear})`);
  }
  if (languages.length === 0) {
    throw new RangeError('languages must contain at least one locale');
  }

  // Widen the search by a couple of days each side so an eclipse whose local
  // date is in range but whose UTC peak sits just outside still gets caught;
  // the per-year bucketing below discards any whose local-date year is
  // genuinely out of range.
  const dayMs = 24 * 3600_000;
  const windowStart = new Date(Date.UTC(startYear, 0, 1) - 2 * dayMs);
  const windowEnd = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59, 999) + 2 * dayMs);

  // Visibility is per-phase: an eclipse counts as visible if the body clears
  // the horizon during any phase, not just at peak.
  const eclipses = getEclipsesInRange(windowStart, windowEnd, location)
    .map(e => ({ e, anyPhase: isEclipseVisibleAnyPhase(e, location) }))
    .filter(({ anyPhase }) => !visibleOnly || anyPhase);

  // Pre-seed every in-range year so no-eclipse years still appear as `[]`
  // (lets `getEclipsesForYear` distinguish "in range, none" from "out of range").
  const byYear = new Map<string, Map<string, EclipseTableEntryRaw[]>>();
  for (let year = startYear; year <= endYear; year++) {
    byYear.set(String(year), new Map());
  }

  for (const { e, anyPhase } of eclipses) {
    const key = toDateKey(e.peak, timezoneOffsetMinutes);
    const dateBuckets = byYear.get(key.slice(0, 4));
    if (!dateBuckets) continue; // local-date year outside [startYear, endYear]
    let bucket = dateBuckets.get(key);
    if (!bucket) {
      bucket = [];
      dateBuckets.set(key, bucket);
    }
    bucket.push(makeEntry(e, anyPhase, languages));
  }

  const years: Record<string, RawEclipseTableDay[]> = {};
  for (const [yearKey, dateBuckets] of byYear) {
    years[yearKey] = [...dateBuckets.keys()]
      .sort()
      .map(date => ({ date, eclipses: dateBuckets.get(date)! }));
  }

  return {
    _meta: {
      referenceLocation,
      latitude: location.latitude,
      longitude: location.longitude,
      timezoneOffsetMinutes,
      visibleOnly,
      languages: [...languages],
      startYear,
      endYear,
      generatedAt,
      note,
    },
    years,
  };
}
