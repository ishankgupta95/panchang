/** @tier 1  Reference-almanac yoga listings, full-year 2026 (Mumbai) */

import { readTestDataText } from '../testdata';
import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/index';

const MUMBAI = { latitude: 19.0760, longitude: 72.8777 };
const DELHI = { latitude: 28.6139, longitude: 77.2090 }; // almanac geoname-id 1261481
const TZ = 330;

/** `[month, day]` exactly as the almanac prints them. */
const ALMANAC_AMRIT_SIDDHI: readonly (readonly [number, number])[] = [
  [1, 14], [2, 11], [2, 20], [3, 20], [4, 17], [4, 21], [4, 23], [5, 18],
  [5, 21], [6, 14], [6, 15], [6, 18], [7, 11], [7, 19], [8, 4], [8, 8],
  [8, 16], [9, 1], [9, 13], [9, 16], [9, 29], [10, 14], [11, 11], [12, 18],
];

/**
 * The duplicated 2026-05-03 is deliberate: the almanac lists that date twice
 * (00:49-06:10 and 06:10-07:10) with sunrise between, so the windows fall on
 * the Hindu days of May 2 and May 3. Collapsing them would make the second,
 * correct emission look like a false positive.
 */
const ALMANAC_TRIPUSHKAR: readonly (readonly [number, number])[] = [
  [1, 4], [2, 24], [2, 28], [4, 14], [4, 19], [4, 28], [5, 3], [5, 3], [6, 16],
  [6, 21], [7, 11], [8, 29], [9, 12], [10, 27], [10, 31], [12, 29],
];

function emittedDays(type: string, year = 2026, location = MUMBAI): Set<number> {
  const out = new Set<number>();
  for (let month = 0; month < 12; month++) {
    for (let day = 1; day <= 31; day++) {
      const date = new Date(Date.UTC(year, month, day, 6, 0));
      if (date.getUTCMonth() !== month) continue;
      const p = getDailyPanchang(date, location, { timezone: TZ });
      if (p?.specialYogas.some((y) => y.type === type)) out.add((month + 1) * 100 + day);
    }
  }
  return out;
}

const label = (k: number) => `${Math.floor(k / 100)}/${k % 100}`;

/**
 * The almanac dates a window by the civil date its start falls in, this library
 * by the Hindu day (sunrise to next sunrise), so one interval is listed on D
 * there and D-1 here and either satisfies D. The earliest candidate must be
 * taken first: preferring D would let a window on D whose Hindu day is D-1
 * steal D and orphan the window listed on D+1, as 2025 Mumbai does twice.
 */
function compare(almanac: readonly (readonly [number, number])[], emitted: Set<number>) {
  const remaining = new Set(emitted);
  const unmatched: string[] = [];
  const sorted = [...almanac].sort((a, b) => (a[0] * 100 + a[1]) - (b[0] * 100 + b[1]));
  for (const [m, d] of sorted) {
    const same = m * 100 + d;
    const prevDate = new Date(Date.UTC(2026, m - 1, d - 1));
    const prev = (prevDate.getUTCMonth() + 1) * 100 + prevDate.getUTCDate();
    if (remaining.has(prev)) remaining.delete(prev);
    else if (remaining.has(same)) remaining.delete(same);
    else unmatched.push(`${m}/${d}`);
  }
  return { unmatched, falsePositives: [...remaining].map(label) };
}

describe('Amrit Siddhi Yoga: reference-almanac parity, 2026 Mumbai', () => {
  const emitted = emittedDays('amrit_siddhi');

  it('detects every occurrence the almanac publishes', () => {
    expect(compare(ALMANAC_AMRIT_SIDDHI, emitted).unmatched).toEqual([]);
  });

  it('emits no day the almanac does not publish', () => {
    expect(compare(ALMANAC_AMRIT_SIDDHI, emitted).falsePositives).toEqual([]);
  });

  it('finds the same number of occurrences across the year', () => {
    expect(emitted.size).toBe(ALMANAC_AMRIT_SIDDHI.length);
  });
});

describe('Tripushkar Yoga: reference-almanac parity, 2026 Mumbai', () => {
  const emitted = emittedDays('tripushkar');

  it('detects every occurrence the almanac publishes', () => {
    expect(compare(ALMANAC_TRIPUSHKAR, emitted).unmatched).toEqual([]);
  });

  it('emits no day the almanac does not publish', () => {
    expect(compare(ALMANAC_TRIPUSHKAR, emitted).falsePositives).toEqual([]);
  });

  it('only ever falls on Sunday, Tuesday or Saturday', () => {
    for (const key of emitted) {
      const p = getDailyPanchang(
        new Date(Date.UTC(2026, Math.floor(key / 100) - 1, key % 100, 6, 0)),
        MUMBAI, { timezone: TZ },
      )!;
      expect([0, 2, 6]).toContain(p.angas.vara.index);
    }
  });
});

/**
 * Mumbai 2026 is not independent: the table in `specialYogasData.ts` was
 * derived from its 116 windows. `sharedDay` is [dropped, keeper] for two
 * almanac dates sharing one Hindu day; day-granularity emission cannot produce
 * two entries for one Hindu day, so the dropped date leaves the one-to-one
 * reconciliation once its keeper is present.
 */
const SSY_DATASETS = [
  {
    file: 'almanac-sarvartha-siddhi-2025-mumbai.txt', city: 'Mumbai', year: 2025,
    location: MUMBAI, windows: 122, sharedDay: [['3/3', '3/2']] as const,
  },
  {
    file: 'almanac-sarvartha-siddhi-2026-mumbai.txt', city: 'Mumbai', year: 2026,
    location: MUMBAI, windows: 116, sharedDay: [] as const,
  },
  {
    file: 'almanac-sarvartha-siddhi-2027-mumbai.txt', city: 'Mumbai', year: 2027,
    location: MUMBAI, windows: 115, sharedDay: [] as const,
  },
  {
    file: 'almanac-sarvartha-siddhi-2026-delhi.txt', city: 'New Delhi', year: 2026,
    location: DELHI, windows: 118, sharedDay: [] as const,
  },
] as const;

describe.each(SSY_DATASETS)(
  'Sarvartha Siddhi Yoga: reference-almanac parity, full-year $year $city',
  ({ file, year, location, windows, sharedDay }) => {
    const all = readTestDataText('almanac', file).trim().split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => { const [m, d] = l.split('|')[0]!.split('/').map(Number); return [m!, d!] as [number, number]; });

    const almanac = [...all];
    for (const [dropped, keeper] of sharedDay) {
      for (const label_ of [dropped, keeper]) {
        expect(all.map(([m, d]) => `${m}/${d}`)).toContain(label_);
      }
      const [dm, dd] = dropped.split('/').map(Number);
      almanac.splice(almanac.findIndex(([m, d]) => m === dm && d === dd), 1);
    }

    const emitted = emittedDays('sarvartha_siddhi', year, location);

    it(`has all ${windows} published windows in the fixture`, () => {
      expect(all.length).toBe(windows);
    });

    it('detects every window the almanac publishes', () => {
      expect(compare(almanac, emitted).unmatched).toEqual([]);
    });

    it('emits no day the almanac does not publish', () => {
      expect(compare(almanac, emitted).falsePositives).toEqual([]);
    });

    it('reconciles one-for-one across the year', () => {
      expect(emitted.size).toBe(almanac.length);
    });
  },
);
