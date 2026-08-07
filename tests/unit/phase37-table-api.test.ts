/**
 * Phase 37 — unified table/compute API.
 *
 * TIER: invariant, except where a test is explicitly marked as a size or
 * timing measurement. Names, keys, ordering and equality between the two ways
 * of asking the same question are domain facts, not arithmetic — none of the
 * assertions here may be re-pinned.
 *
 * Four properties are guarded:
 *
 *   1. `read*` (table) and `compute*` (engine) are two names for two genuinely
 *      different things, and the deprecated `get*` aliases still resolve to the
 *      same functions.
 *   2. `compute*ForYear` agrees with the range enumerator it wraps.
 *   3. An emitted table round-trips: what the builder packs, the reader
 *      resolves — identically to what the engine emitted, and now carrying the
 *      stable `key`.
 *   4. A v1 table still reads, because consumers cache these files.
 */

import { describe, it, expect } from 'vitest';
import {
  buildFestivalsTable,
  buildMoonPhasesTable,
  buildMuhurtaTable,
  computeFestivalsForYear,
  computeFestivalsInRange,
  computeEclipsesForYear,
  computeEclipsesInRange,
  computeMoonPhasesForYear,
  computeMoonPhasesInRange,
  computeAuspiciousDatesForYear,
  computeAuspiciousDatesInRange,
  computeEkadashiDatesForYear,
  computeSankrantisForYear,
  getFestivalsInRange,
  getEclipsesInRange,
  getMoonPhasesInRange,
  findAuspiciousDates,
  getEkadashiDatesForYear,
  getSankrantisForYear,
  vivahRule,
} from '../../src/index';
import {
  readFestivalsForYear,
  readFestivalsForDate,
  readFestivalsYearRange,
  getFestivalsForYear,
} from '../../src/calendar/festivalsTable';
import {
  readMoonPhasesForYear,
  getMoonPhasesForYear,
} from '../../src/calendar/moonPhasesTable';
import {
  readMuhurtaForYear,
  readMuhurtaForDate,
  readMuhurtaYearRange,
  readMuhurtaOccasion,
  readBestMuhurtaDays,
} from '../../src/muhurta/muhurtaTable';
import type { FestivalsFileV1 } from '../../src/calendar/festivalsTableTypes';

const VARANASI = { latitude: 25.3176, longitude: 82.9739 };
const TZ = 330;

describe('37.1 — deprecated names still resolve to the renamed functions', () => {
  it('engine range enumerators', () => {
    expect(getFestivalsInRange).toBe(computeFestivalsInRange);
    expect(getEclipsesInRange).toBe(computeEclipsesInRange);
    expect(getMoonPhasesInRange).toBe(computeMoonPhasesInRange);
    expect(findAuspiciousDates).toBe(computeAuspiciousDatesInRange);
    expect(getEkadashiDatesForYear).toBe(computeEkadashiDatesForYear);
    expect(getSankrantisForYear).toBe(computeSankrantisForYear);
  });

  it('table readers', () => {
    expect(getFestivalsForYear).toBe(readFestivalsForYear);
    expect(getMoonPhasesForYear).toBe(readMoonPhasesForYear);
  });
});

describe('37.2 — compute*ForYear agrees with the range enumerator it wraps', () => {
  it('festivals', () => {
    const viaYear = computeFestivalsForYear(2026, VARANASI, { timezone: TZ });
    const viaRange = computeFestivalsInRange(
      new Date(Date.UTC(2026, 0, 1) - TZ * 60_000),
      new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999) - TZ * 60_000),
      VARANASI,
      { timezone: TZ },
    );
    expect(viaYear.map(f => f.festival.key)).toEqual(viaRange.map(f => f.festival.key));
    expect(viaYear.length).toBeGreaterThan(50);
  });

  it('eclipses', () => {
    const viaYear = computeEclipsesForYear(2027, VARANASI, { timezone: TZ });
    const viaRange = computeEclipsesInRange(
      new Date(Date.UTC(2027, 0, 1) - TZ * 60_000),
      new Date(Date.UTC(2027, 11, 31, 23, 59, 59, 999) - TZ * 60_000),
      VARANASI,
    );
    expect(viaYear.map(e => e.peak.toISOString()))
      .toEqual(viaRange.map(e => e.peak.toISOString()));
  });

  it('moon phases — and a year holds ~49 principal phases', () => {
    const viaYear = computeMoonPhasesForYear(2027, { timezone: TZ });
    const viaRange = computeMoonPhasesInRange(
      new Date(Date.UTC(2027, 0, 1) - TZ * 60_000),
      new Date(Date.UTC(2027, 11, 31, 23, 59, 59, 999) - TZ * 60_000),
    );
    expect(viaYear.map(p => p.time.toISOString()))
      .toEqual(viaRange.map(p => p.time.toISOString()));
    // A synodic month is 29.53 days, four principal phases each: 49.4/year.
    expect(viaYear.length).toBeGreaterThanOrEqual(48);
    expect(viaYear.length).toBeLessThanOrEqual(50);
  });

  it('auspicious dates', () => {
    const viaYear = computeAuspiciousDatesForYear(2027, vivahRule, VARANASI, { timezone: TZ });
    const viaRange = computeAuspiciousDatesInRange(
      vivahRule,
      new Date(Date.UTC(2027, 0, 1) - TZ * 60_000),
      new Date(Date.UTC(2027, 11, 31, 23, 59, 59, 999) - TZ * 60_000),
      VARANASI,
      { timezone: TZ },
    );
    expect(viaYear.map(d => d.date.toISOString())).toEqual(viaRange.map(d => d.date.toISOString()));
    expect(viaYear.length).toBeGreaterThan(0);
  });

  it('rejects a non-integer year rather than silently coercing', () => {
    expect(() => computeFestivalsForYear(2026.5, VARANASI, { timezone: TZ })).toThrow(RangeError);
    expect(() => computeEclipsesForYear(2026.5, VARANASI, { timezone: TZ })).toThrow(RangeError);
    expect(() => computeAuspiciousDatesForYear(2026.5, vivahRule, VARANASI, { timezone: TZ }))
      .toThrow(RangeError);
  });
});

describe('37.4 — emitted tables carry `key` and round-trip through the reader', () => {
  const table = buildFestivalsTable({
    location: VARANASI,
    timezoneOffsetMinutes: TZ,
    startYear: 2026,
    endYear: 2027,
    referenceLocation: 'Varanasi',
  });

  it('every entry carries the engine\'s stable key', () => {
    for (const year of [2026, 2027]) {
      const days = readFestivalsForYear(table, year);
      expect(days).not.toBeNull();
      for (const day of days!) {
        for (const f of day.festivals) {
          expect(f.key, `${day.date} ${f.name}`).toBeTruthy();
        }
      }
    }
  });

  it('resolved names match what the engine emitted, in both locales', () => {
    for (const lang of ['en', 'hi'] as const) {
      const fromEngine = computeFestivalsForYear(2026, VARANASI, { timezone: TZ, language: lang })
        .filter(f => f.festival.type !== 'eclipse');
      const fromTable = (readFestivalsForYear(table, 2026, lang) ?? [])
        .flatMap(d => d.festivals);
      expect(fromTable.map(f => `${f.key}|${f.name}`))
        .toEqual(fromEngine.map(f => `${f.festival.key}|${f.festival.name}`));
    }
  });

  it('reads a single date, and the year range comes off _meta', () => {
    const days = readFestivalsForYear(table, 2026) ?? [];
    const populated = days.find(d => d.festivals.length > 0)!;
    expect(readFestivalsForDate(table, populated.date)).toEqual(populated.festivals);
    expect(readFestivalsYearRange(table)).toEqual({ start: 2026, end: 2027 });
  });

  it('a year outside the range reads as null, not as an empty year', () => {
    expect(readFestivalsForYear(table, 2099)).toBeNull();
    expect(readFestivalsForDate(table, '2099-01-01')).toEqual([]);
  });

  it('moon-phase tables resolve the same instants the engine produced', () => {
    const phases = buildMoonPhasesTable({
      timezoneOffsetMinutes: TZ, startYear: 2026, endYear: 2026,
    });
    const fromTable = (readMoonPhasesForYear(phases, 2026) ?? []).flatMap(d => d.phases);
    const fromEngine = computeMoonPhasesForYear(2026, { timezone: TZ });
    expect(fromTable.map(p => p.time)).toEqual(fromEngine.map(p => p.time.toISOString()));
    expect(fromTable.map(p => p.phase)).toEqual(fromEngine.map(p => p.phase));
    // Four unique phase descriptors, however many events there are.
    expect(phases._dict).toHaveLength(4);
  });

  /**
   * MEASUREMENT, not an invariant: the ≤30% target from PLAN.md §37.4. The v1
   * file is reconstructed by inlining the dictionary — the exact inverse of the
   * packing — so the comparison is like for like.
   */
  it('packs to under 30% of the v1 size', () => {
    const ten = buildFestivalsTable({
      location: VARANASI, timezoneOffsetMinutes: TZ, startYear: 2024, endYear: 2033,
    });
    const v1 = {
      _meta: ten._meta,
      years: Object.fromEntries(Object.entries(ten.years).map(([y, days]) => [y,
        days.map(d => ({
          date: d.date,
          festivals: d.festivals.map(i => {
            const e = ten._dict[i]!;
            return e.description
              ? { name: e.name, type: e.type, description: e.description }
              : { name: e.name, type: e.type };
          }),
        })),
      ])),
    };
    const ratio = JSON.stringify(ten).length / JSON.stringify(v1).length;
    expect(ratio, `packed to ${(ratio * 100).toFixed(1)}% of v1`).toBeLessThan(0.30);
    // 30 s, not vitest's default 5 s: this builds two ten-year festival tables
    // from scratch, which is seconds of real computation and exceeded the
    // default under suite-parallel load — a deterministic size ratio failing on
    // a busy machine.
  }, 30_000);
});

describe('37.4 — v1 tables still read, because consumers cache these files', () => {
  const v1: FestivalsFileV1 = {
    _meta: {
      referenceLocation: 'Varanasi', latitude: 25.3176, longitude: 82.9739,
      timezoneOffsetMinutes: TZ, ayanamsa: 'lahiri', masaSystem: 'purnimanta',
      region: 'all', languages: ['en', 'hi'], startYear: 2026, endYear: 2026,
      generatedAt: '', note: '',
    },
    years: {
      '2026': [{
        date: '2026-03-03',
        festivals: [{
          name: { en: 'Holi', hi: 'होली' },
          type: 'major',
          description: { en: 'Festival of colours', hi: 'रंगों का त्योहार' },
        }],
      }],
    },
  };

  it('flattens a v1 entry, in either locale', () => {
    expect(readFestivalsForYear(v1, 2026, 'en')![0]!.festivals[0]!.name).toBe('Holi');
    expect(readFestivalsForYear(v1, 2026, 'hi')![0]!.festivals[0]!.name).toBe('होली');
    expect(readFestivalsForDate(v1, '2026-03-03')[0]!.description).toBe('Festival of colours');
  });

  it('reports an empty key rather than inventing one', () => {
    // v1 predates the stable key; '' is the honest answer.
    expect(readFestivalsForYear(v1, 2026)![0]!.festivals[0]!.key).toBe('');
  });

  it('falls back to an available locale when the requested one is absent', () => {
    const enOnly: FestivalsFileV1 = {
      ...v1,
      years: { '2026': [{ date: '2026-03-03', festivals: [{ name: { en: 'Holi' }, type: 'major' }] }] },
    };
    expect(readFestivalsForYear(enOnly, 2026, 'hi')![0]!.festivals[0]!.name).toBe('Holi');
  });
});

describe('37.3 — buildMuhurtaTable completes the family', () => {
  const table = buildMuhurtaTable({
    rule: vivahRule,
    location: VARANASI,
    timezoneOffsetMinutes: TZ,
    startYear: 2026,
    endYear: 2027,
    referenceLocation: 'Varanasi',
  });

  it('stores only passing days by default', () => {
    const days = readMuhurtaForYear(table, 2026);
    expect(days).not.toBeNull();
    expect(days!.length).toBeGreaterThan(0);
    expect(days!.every(d => d.passes)).toBe(true);
    expect(table._meta.includeFailures).toBe(false);
  });

  it('agrees with the engine on which days pass and with what score', () => {
    const engine = computeAuspiciousDatesForYear(2026, vivahRule, VARANASI, { timezone: TZ })
      .map(d => {
        const shifted = new Date(d.date.getTime() + TZ * 60_000);
        const key = shifted.toISOString().slice(0, 10);
        return `${key}=${d.score}`;
      })
      .sort();
    const table2026 = readMuhurtaForYear(table, 2026)!.map(d => `${d.date}=${d.score}`).sort();
    expect(table2026).toEqual(engine);
  });

  it('stores days in date order, and reads one back by date', () => {
    const days = readMuhurtaForYear(table, 2026)!;
    expect([...days].sort((a, b) => a.date.localeCompare(b.date))).toEqual(days);
    const one = days[0]!;
    expect(readMuhurtaForDate(table, one.date)).toEqual(one);
  });

  it('returns null for a date that was not stored', () => {
    // A failing day in a passes-only table, and a year outside the range.
    expect(readMuhurtaForDate(table, '2026-01-01')?.passes ?? null).not.toBe(false);
    expect(readMuhurtaForYear(table, 2099)).toBeNull();
    expect(readMuhurtaForDate(table, '2099-01-01')).toBeNull();
  });

  it('surfaces the best days across the whole table, highest score first', () => {
    const best = readBestMuhurtaDays(table, 5);
    expect(best).toHaveLength(5);
    for (let i = 1; i < best.length; i++) {
      expect(best[i]!.score).toBeLessThanOrEqual(best[i - 1]!.score);
    }
    // Deterministic: ties break by date, so repeated calls agree.
    expect(readBestMuhurtaDays(table, 5)).toEqual(best);
  });

  it('carries the occasion and range in _meta', () => {
    expect(readMuhurtaOccasion(table)).toBe(vivahRule.occasion);
    expect(readMuhurtaYearRange(table)).toEqual({ start: 2026, end: 2027 });
    expect(table._meta.occasionName).toBe(vivahRule.name);
  });

  it('interns repeated factors instead of storing them per day', () => {
    let references = 0;
    for (const days of Object.values(table.years)) for (const d of days) references += d.f.length;
    // Two years of scored days share a small factor vocabulary.
    expect(references).toBeGreaterThan(table._dict.length * 3);
  });

  it('includeFailures stores the failing days too', () => {
    const withFailures = buildMuhurtaTable({
      rule: vivahRule, location: VARANASI, timezoneOffsetMinutes: TZ,
      startYear: 2026, endYear: 2026, includeFailures: true,
    });
    const days = readMuhurtaForYear(withFailures, 2026)!;
    expect(days.length).toBeGreaterThan(readMuhurtaForYear(table, 2026)!.length);
    expect(days.some(d => !d.passes)).toBe(true);
    // Every day of the year is present.
    expect(days.length).toBe(365);
  });

  it('rejects a reversed year range', () => {
    expect(() => buildMuhurtaTable({
      rule: vivahRule, location: VARANASI, timezoneOffsetMinutes: TZ,
      startYear: 2027, endYear: 2026,
    })).toThrow(RangeError);
  });

  /**
   * `rule` is the one required input of the four that was not validated here,
   * so omitting it produced `Cannot read properties of undefined (reading
   * 'excludeBhadra')` from four frames inside the scorer. TypeScript stops a TS
   * caller; a JavaScript one — or anyone building the options object
   * dynamically — got the stack trace. Found by installing the packed tarball
   * and using it as a consumer, which is the only place this shows up.
   */
  it('rejects a missing or malformed rule with a message that names the problem', () => {
    const base = {
      location: VARANASI, timezoneOffsetMinutes: TZ, startYear: 2026, endYear: 2026,
    };
    for (const bad of [undefined, null, 'vivah', 42, {}, { name: 'no occasion' }]) {
      expect(
        () => buildMuhurtaTable({ ...base, rule: bad } as unknown as Parameters<typeof buildMuhurtaTable>[0]),
        `rule: ${JSON.stringify(bad) ?? 'undefined'}`,
      ).toThrow(/`rule` is required/);
    }
  });
});
