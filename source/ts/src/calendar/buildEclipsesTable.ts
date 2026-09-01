
import { computeEclipsesInRange } from './yearly';
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
  location: GeoLocation;
  /** Minutes east of UTC (`330` for IST); buckets eclipses by local peak date. */
  timezoneOffsetMinutes: number;
  startYear: number;
  endYear: number;
  languages?: readonly EclipsesTableLanguage[];
  /** `false` also lists below-horizon eclipses, which carry no sutak. */
  visibleOnly?: boolean;
  referenceLocation?: string;
  generatedAt?: string;
  note?: string;
}

const DEFAULT_NOTE =
  'Pre-computed eclipse table. Includes every eclipse observable from the ' +
  'reference location during any phase (eclipsed body above the horizon ' +
  'between first and last contact), so an eclipse already in progress at ' +
  'moon/sunrise or moon/sunset is listed. `visibleAtPeak` flags whether the ' +
  'peak itself is observable. Solar eclipses carry the subtype seen locally. ' +
  'The sutak window is present only for eclipses that warrant it: visible ' +
  'solar (all subtypes) and visible umbral lunar (partial/total). Penumbral ' +
  'lunar eclipses carry no sutak and are not religiously observed ' +
  '(reference almanac / pandit consensus). Times are ISO UTC.';

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
  obscuration: number,
  lang: EclipsesTableLanguage,
): string {
  const name = localizedName(kind, subtype, lang);
  if (subtype === 'penumbral') {
    return lang === 'hi'
      ? `${name}: केवल उपच्छाया छाया; सूतक नहीं।`
      : `${name}: penumbral shadow only; no sutak.`;
  }
  const pct = Math.round(obscuration * 100);
  return lang === 'hi'
    ? `${name}: ${pct}% ग्रास।`
    : `${name}: ${pct}% obscuration.`;
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
    description[lang] = localizedDescription(kind, subtype, e.obscuration, lang);
  }

  const entry: EclipseTableEntryRaw = {
    name,
    kind,
    subtype,
    start: e.start.toISOString(),
    peak: e.peak.toISOString(),
    end: e.end.toISOString(),
    obscuration: e.obscuration,
    magnitude: e.magnitude,
    visibleFromLocation: anyPhaseVisible,
    visibleAtPeak: e.visibleFromLocation,
    description,
  };
  if (anyPhaseVisible && subtype !== 'penumbral' && e.sutakStart && e.sutakEnd) {
    entry.sutak = { start: e.sutakStart.toISOString(), end: e.sutakEnd.toISOString() };
  }
  return entry;
}

/** Eclipse table for a location over an inclusive year range, bucketed by local peak date. */
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

  const dayMs = 24 * 3600_000;
  const windowStart = new Date(Date.UTC(startYear, 0, 1) - 2 * dayMs);
  const windowEnd = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59, 999) + 2 * dayMs);

  const eclipses = computeEclipsesInRange(windowStart, windowEnd, location)
    .map(e => ({ e, anyPhase: isEclipseVisibleAnyPhase(e, location) }))
    .filter(({ anyPhase }) => !visibleOnly || anyPhase);

  const byYear = new Map<string, Map<string, EclipseTableEntryRaw[]>>();
  for (let year = startYear; year <= endYear; year++) {
    byYear.set(String(year), new Map());
  }

  for (const { e, anyPhase } of eclipses) {
    const key = toDateKey(e.peak, timezoneOffsetMinutes);
    const dateBuckets = byYear.get(key.slice(0, 4));
    if (!dateBuckets) continue;
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
