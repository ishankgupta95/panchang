import { computeMoonPhasesInRange } from '../astronomy/moonPhase';
import { paddedYearWindow, resolveUtcOffset } from '../utils/timezone';
import type {
  MoonPhaseDictEntry,
  MoonPhasesFile,
  MoonPhasesTableLanguage,
  MoonPhaseTableName,
  LocalizedString,
  PackedMoonPhaseEvent,
  PackedMoonPhaseTableDay,
} from './moonPhasesTableTypes';

export interface BuildMoonPhasesTableOptions {
  /** Minutes east of UTC (`330` for IST), an integer in -720..840, else `INVALID_TIMEZONE`. */
  timezoneOffsetMinutes: number;
  startYear: number;
  endYear: number;
  /** Defaults to `['en', 'hi']`; any other code throws `RangeError`. */
  languages?: readonly MoonPhasesTableLanguage[];
  referenceLocation?: string;
  generatedAt?: string;
  note?: string;
}

const DEFAULT_NOTE =
  'Pre-computed Moon-phase table (new / first quarter / full / last quarter). ' +
  'Phases are astronomical instants, the same worldwide; the date column is ' +
  'the instant mapped to the table timezone. New moon = Amavasya, full moon = ' +
  'Purnima. These are precise instants, distinct from the same-named tithis ' +
  '(which are ~24h windows). Times are ISO UTC.';

const PHASE_NAME: Record<MoonPhasesTableLanguage, Record<MoonPhaseTableName, string>> = {
  en: {
    new: 'New Moon',
    first_quarter: 'First Quarter',
    full: 'Full Moon',
    last_quarter: 'Last Quarter',
  },
  hi: {
    new: 'अमावस्या',
    first_quarter: 'शुक्ल पक्ष अर्धचंद्र',
    full: 'पूर्णिमा',
    last_quarter: 'कृष्ण पक्ष अर्धचंद्र',
  },
};
const PHASE_DESC: Record<MoonPhasesTableLanguage, Record<MoonPhaseTableName, string>> = {
  en: {
    new: 'New moon (Amavasya).',
    first_quarter: 'First quarter: waxing half moon.',
    full: 'Full moon (Purnima).',
    last_quarter: 'Last quarter: waning half moon.',
  },
  hi: {
    new: 'अमावस्या: नया चंद्रमा।',
    first_quarter: 'शुक्ल पक्ष अर्धचंद्र।',
    full: 'पूर्णिमा: पूर्ण चंद्रमा।',
    last_quarter: 'कृष्ण पक्ष अर्धचंद्र।',
  },
};

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeDictEntry(
  phase: MoonPhaseTableName,
  languages: readonly MoonPhasesTableLanguage[],
): MoonPhaseDictEntry {
  const name: LocalizedString = {};
  const description: LocalizedString = {};
  for (const lang of languages) {
    name[lang] = PHASE_NAME[lang][phase];
    description[lang] = PHASE_DESC[lang][phase];
  }
  return { phase, name, description };
}

const PHASE_ORDER: readonly MoonPhaseTableName[] =
  ['new', 'first_quarter', 'full', 'last_quarter'];

/** Moon-phases table for a timezone over an inclusive year range, bucketed by the local date each instant falls on. */
export function buildMoonPhasesTable(
  opts: BuildMoonPhasesTableOptions,
): MoonPhasesFile {
  const {
    timezoneOffsetMinutes,
    startYear,
    endYear,
    languages = ['en', 'hi'],
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
  for (const lang of languages) {
    if (lang !== 'en' && lang !== 'hi') {
      throw new RangeError(`languages must be drawn from en, hi; got ${JSON.stringify(lang)}`);
    }
  }
  resolveUtcOffset(timezoneOffsetMinutes, new Date(Date.UTC(startYear, 0, 1)));

  const [windowStart, windowEnd] = paddedYearWindow(startYear, endYear);

  const events = computeMoonPhasesInRange(windowStart, windowEnd);
  const dict = PHASE_ORDER.map(phase => makeDictEntry(phase, languages));
  const dictIndex = new Map(PHASE_ORDER.map((phase, i) => [phase, i]));

  const byYear = new Map<string, Map<string, PackedMoonPhaseEvent[]>>();
  for (let year = startYear; year <= endYear; year++) {
    byYear.set(String(year), new Map());
  }

  for (const ev of events) {
    const key = toDateKey(ev.time, timezoneOffsetMinutes);
    const dateBuckets = byYear.get(key.slice(0, 4));
    if (!dateBuckets) continue;
    let bucket = dateBuckets.get(key);
    if (!bucket) {
      bucket = [];
      dateBuckets.set(key, bucket);
    }
    bucket.push({ i: dictIndex.get(ev.phase)!, t: ev.time.getTime() });
  }

  const years: Record<string, PackedMoonPhaseTableDay[]> = {};
  for (const [yearKey, dateBuckets] of byYear) {
    years[yearKey] = [...dateBuckets.keys()]
      .sort()
      .map(date => ({ date, phases: dateBuckets.get(date)! }));
  }

  return {
    _meta: {
      format: 2,
      referenceLocation,
      timezoneOffsetMinutes,
      languages: [...languages],
      startYear,
      endYear,
      generatedAt,
      note,
    },
    _dict: dict,
    years,
  };
}
