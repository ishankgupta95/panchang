/**
 * @tier 1  DrikPanchang.com yoga listings, full-year 2026 (Mumbai)
 *
 * Vara × Nakshatra yoga tables validated against drik's own published
 * occurrence pages — the tables themselves, end to end over a year, rather
 * than a spot check.
 *
 *   - Amrit Siddhi     drikpanchang.com/yoga/amritsiddhi-yoga-date-time.html
 *   - Tripushkar       drikpanchang.com/yoga/tripushkar-yoga-date-time.html
 *   - Sarvartha Siddhi drikpanchang.com/yoga/sarvarthasiddhi-yoga-date-time.html
 *
 * All scraped 2026-08-08. The first two publish a whole year per page; the
 * Sarvartha Siddhi page serves one month, but takes `?date=DD/MM/YYYY`, so its
 * twelve months are vendored in `tests/fixtures/`.
 *
 * ## Hindu day vs calendar date
 *
 * Drik usually labels a window by the **calendar date its start falls in**;
 * this library attributes a yoga to the **Hindu day** (sunrise → next
 * sunrise). The two differ for a window that ends at sunrise: drik lists it on
 * day D, we report it on D−1, and both describe the identical interval. Three
 * of the forty 2026 occurrences are of that shape — Amrit Siddhi 2026-04-21
 * 02:08–06:17 and 2026-06-14 01:16–06:01, Tripushkar 2026-05-03 00:49–06:10 —
 * so the comparison below accepts D or D−1 rather than pretending the
 * conventions agree.
 *
 * A handful of windows lying entirely between midnight and sunrise are instead
 * dated by their **Hindu day**: the printed clock times belong to the *next*
 * civil date. Three of the ~100 pre-dawn Sarvartha Siddhi windows across the
 * four vendored datasets are of that shape (2025-06-14, 2026-10-04,
 * 2027-03-28 — each verified by anchoring the printed start to a nakshatra
 * boundary, which exists only on the day after the printed date). Under either
 * labeling the printed date is D or D+1 of the Hindu day we emit, so the same
 * D / D−1 slack absorbs both conventions.
 *
 * These also exercise the across-the-day evaluation: a sunrise snapshot cannot
 * see a window that opens in the evening or closes at dawn.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/index';

const MUMBAI = { latitude: 19.0760, longitude: 72.8777 };
const DELHI = { latitude: 28.6139, longitude: 77.2090 }; // drik geoname-id 1261481
const TZ = 330;

/** `[month (1-12), day]` exactly as drik prints them. */
const DRIK_AMRIT_SIDDHI: readonly (readonly [number, number])[] = [
  [1, 14], [2, 11], [2, 20], [3, 20], [4, 17], [4, 21], [4, 23], [5, 18],
  [5, 21], [6, 14], [6, 15], [6, 18], [7, 11], [7, 19], [8, 4], [8, 8],
  [8, 16], [9, 1], [9, 13], [9, 16], [9, 29], [10, 14], [11, 11], [12, 18],
];

/**
 * Drik lists 2026-05-03 **twice** — 00:49–06:10 and 06:10–07:10 — and both are
 * kept, because sunrise falls between them: the first belongs to the Hindu day
 * of May 2 and the second to May 3. Collapsing them to one date would make the
 * library's (correct) second emission look like a false positive.
 */
const DRIK_TRIPUSHKAR: readonly (readonly [number, number])[] = [
  [1, 4], [2, 24], [2, 28], [4, 14], [4, 19], [4, 28], [5, 3], [5, 3], [6, 16],
  [6, 21], [7, 11], [8, 29], [9, 12], [10, 27], [10, 31], [12, 29],
];

/** Days of `year` at `location` on which the library emits `type`, as `month*100 + day`. */
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
 * Compare drik's calendar-dated list against our Hindu-day list, allowing a
 * drik date D to be satisfied by D or D−1 (see the header).
 *
 * Each window's candidates are the two consecutive days {D−1, D}, so taking
 * the earliest available candidate in ascending date order yields a maximum
 * matching (the usual exchange argument). Preferring D first is not safe: when
 * drik lists windows on D and D+1 whose Hindu days are D−1 and D, the first
 * window would steal D and orphan the second — 2025 Mumbai hits exactly that
 * twice (Mar 24/25, Dec 22/23).
 */
function compare(drik: readonly (readonly [number, number])[], emitted: Set<number>) {
  const remaining = new Set(emitted);
  const unmatched: string[] = [];
  const sorted = [...drik].sort((a, b) => (a[0] * 100 + a[1]) - (b[0] * 100 + b[1]));
  for (const [m, d] of sorted) {
    const same = m * 100 + d;
    // Real previous calendar date (2026 is not a leap year, and no fixture
    // lists Mar 1, so a fixed non-leap February is safe here).
    const prevDate = new Date(Date.UTC(2026, m - 1, d - 1));
    const prev = (prevDate.getUTCMonth() + 1) * 100 + prevDate.getUTCDate();
    if (remaining.has(prev)) remaining.delete(prev);
    else if (remaining.has(same)) remaining.delete(same);
    else unmatched.push(`${m}/${d}`);
  }
  return { unmatched, falsePositives: [...remaining].map(label) };
}

describe('Amrit Siddhi Yoga — DrikPanchang parity, 2026 Mumbai', () => {
  const emitted = emittedDays('amrit_siddhi');

  it('detects every occurrence drik publishes', () => {
    expect(compare(DRIK_AMRIT_SIDDHI, emitted).unmatched).toEqual([]);
  });

  it('emits no day drik does not publish', () => {
    expect(compare(DRIK_AMRIT_SIDDHI, emitted).falsePositives).toEqual([]);
  });

  it('finds the same number of occurrences across the year', () => {
    expect(emitted.size).toBe(DRIK_AMRIT_SIDDHI.length);
  });
});

describe('Tripushkar Yoga — DrikPanchang parity, 2026 Mumbai', () => {
  const emitted = emittedDays('tripushkar');

  it('detects every occurrence drik publishes', () => {
    expect(compare(DRIK_TRIPUSHKAR, emitted).unmatched).toEqual([]);
  });

  it('emits no day drik does not publish', () => {
    expect(compare(DRIK_TRIPUSHKAR, emitted).falsePositives).toEqual([]);
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
 * Sarvartha Siddhi — four full city-years, not a spot check.
 *
 * Drik's Sarvartha Siddhi page serves one month at a time but accepts
 * `?date=DD/MM/YYYY` (and `?geoname-id=` for the city), so every month of each
 * dataset was pulled and vendored beside this file. The table in
 * `specialYogasData.ts` was *derived* from the 116 Mumbai-2026 windows rather
 * than checked against them, which is why that year reconciles exactly in both
 * directions — a miss means the table lost a cell, a spare day means it gained
 * one.
 *
 * Mumbai 2025 / Mumbai 2027 / New Delhi 2026 were then scraped independently
 * (2026-08-09) as out-of-sample checks. Each of the four datasets exercises
 * exactly the same 35 (vara, nakshatra) cells, and a segment-level analysis of
 * all 471 windows (split at nakshatra boundaries and sunrises) finds no
 * segment longer than 2 minutes outside the table — the ≤2-minute strays are
 * drik's minute-rounding at boundaries. In particular the disputed Sunday cell
 * is settled: Sunday + Ashwini fires 17 times across the four datasets while
 * Sunday + Ashlesha (the secondary-source variant) never occurs.
 */
/**
 * `sharedDay` lists drik dates whose window lies on the same Hindu day as
 * another listed window, as [dropped, keeper]. Day-granularity emission cannot
 * produce two entries for one Hindu day, so the dropped date is excluded from
 * the one-to-one reconciliation after asserting its keeper is present. The
 * lone case in all four datasets: Sunday 2025-03-02 has a morning
 * Sun + Uttara Bhadrapada window (listed 3/2, 06:57–08:59) *and* a pre-dawn
 * Sun + Ashwini tail (listed 3/3, 06:39–06:56, ending at the Mar 3 sunrise
 * that closes the same Hindu day).
 */
const SSY_DATASETS = [
  {
    file: 'drik-sarvartha-siddhi-2025-mumbai.txt', city: 'Mumbai', year: 2025,
    location: MUMBAI, windows: 122, sharedDay: [['3/3', '3/2']] as const,
  },
  {
    file: 'drik-sarvartha-siddhi-2026-mumbai.txt', city: 'Mumbai', year: 2026,
    location: MUMBAI, windows: 116, sharedDay: [] as const,
  },
  {
    file: 'drik-sarvartha-siddhi-2027-mumbai.txt', city: 'Mumbai', year: 2027,
    location: MUMBAI, windows: 115, sharedDay: [] as const,
  },
  {
    file: 'drik-sarvartha-siddhi-2026-delhi.txt', city: 'New Delhi', year: 2026,
    location: DELHI, windows: 118, sharedDay: [] as const,
  },
] as const;

describe.each(SSY_DATASETS)(
  'Sarvartha Siddhi Yoga — DrikPanchang parity, full-year $year $city',
  ({ file, year, location, windows, sharedDay }) => {
    const all = readFileSync(join(__dirname, '../fixtures', file), 'utf8').trim().split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => { const [m, d] = l.split('|')[0]!.split('/').map(Number); return [m!, d!] as [number, number]; });

    // Drop each shared-day window once, after checking both dates are listed.
    const drik = [...all];
    for (const [dropped, keeper] of sharedDay) {
      for (const label_ of [dropped, keeper]) {
        expect(all.map(([m, d]) => `${m}/${d}`)).toContain(label_);
      }
      const [dm, dd] = dropped.split('/').map(Number);
      drik.splice(drik.findIndex(([m, d]) => m === dm && d === dd), 1);
    }

    const emitted = emittedDays('sarvartha_siddhi', year, location);

    it(`has all ${windows} published windows in the fixture`, () => {
      expect(all.length).toBe(windows);
    });

    it('detects every window drik publishes', () => {
      expect(compare(drik, emitted).unmatched).toEqual([]);
    });

    it('emits no day drik does not publish', () => {
      expect(compare(drik, emitted).falsePositives).toEqual([]);
    });

    it('reconciles one-for-one across the year', () => {
      expect(emitted.size).toBe(drik.length);
    });
  },
);
