/**
 * @tier 1  Reference almanac day-panchang, 50 transcribed fixtures
 *
 * The special-yoga check is one-way on purpose: the almanac's yoga panels mix
 * `SpecialYogaInfo` items with unrelated muhurta entries (Brahma Muhurta,
 * Vishti, Panchaka, Abhijit, ...), so an exact-set comparison is meaningless.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import { formatInZone } from '../../src/utils/timezone';
import { readTestData } from '../testdata';

const fixtures = readTestData('almanac', 'almanac-phase28.json');

const STRICT_TOL_MIN = 1;
const SUNRISE_TOL_MIN = 3;

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function parseHHMM(s: string): number {
  const [hm, off] = s.split('+') as [string, string | undefined];
  const [h, m] = hm.split(':').map(Number) as [number, number];
  return h * 60 + m + (off ? Number(off) * 1440 : 0);
}

/**
 * Published `Date`s are true instants, so subtracting a UTC midnight does not
 * give a local wall clock; the `*Local` string's day component is what tells us
 * whether the event rolled past midnight.
 */
function localMinutes(local: string, dateStr: string): number {
  const dayDelta = Math.round(
    (Date.parse(`${local.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dateStr}T00:00:00Z`))
    / 86_400_000,
  );
  const [h, m] = local.slice(11, 16).split(':').map(Number) as [number, number];
  return dayDelta * 1440 + h * 60 + m;
}

function diffMin(libLocal: string, fixHHMM: string, dateStr: string): number {
  return Math.abs(localMinutes(libLocal, dateStr) - parseHHMM(fixHHMM));
}

/**
 * Aadal / Vidaal are intentionally not mapped: the library follows the classical
 * Moon-from-Sun nakshatra-distance rule (AstroShastra / HoraSarvam / Ernst
 * Wilhelm) and the almanac the popular Tamil-Vakya weekday-keyed one, so the
 * classical compilations are the oracle here, not the almanac.
 */
function almanacYogaToLibType(s: string): string | null {
  const k = s.toLowerCase();
  if (k.includes('sarvartha siddhi'))  return 'sarvartha_siddhi';
  if (k.includes('amrit siddhi'))      return 'amrit_siddhi';
  if (k.includes('ravi pushya'))       return 'ravi_pushya';
  if (k.includes('guru pushya'))       return 'guru_pushya';
  if (k.includes('dwipushkar'))        return 'dwipushkar';
  if (k.includes('tripushkar'))        return 'tripushkar';
  if (k.includes('jwalamukhi'))        return 'jwalamukhi';
  if (k === 'ravi yoga' || k.endsWith(' ravi yoga')) return 'ravi';
  return null;
}

const SOFT_YOGA_SKIP = new Set<string>([
  'Hyderabad|2026-11-05',
  'Jaipur|2026-04-15',
]);

type Phase28Fixture = {
  _source: string;
  _note?: string;
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expected: {
    sunriseHHMM: string;
    sunsetHHMM: string;
    varjyamStartHHMM: string | null;
    varjyamEndHHMM: string | null;
    madhyahnaHHMM: string | null;
    pratahSandhyaStartHHMM: string | null;
    pratahSandhyaEndHHMM: string | null;
    sayahnaSandhyaStartHHMM: string | null;
    sayahnaSandhyaEndHHMM: string | null;
    anandadiYogaName: string | null;
    gandaMulaActive: boolean;
    auspiciousYogas: string[];
    inauspiciousYogas: string[];
  };
};

const TYPED: Phase28Fixture[] = fixtures as unknown as Phase28Fixture[];

describe('Phase 28 cross-validation against the reference almanac (50 fixtures)', () => {
  for (const f of TYPED) {
    describe(`${f.city} ${f.date}`, () => {
      const result = getDailyPanchang(noonUtc(f.date), f.location, {
        timezone: f.timezone,
        language: 'en',
        computeEndTimes: true,
      });

      it('result is non-null', () => {
        expect(result).not.toBeNull();
      });
      if (result === null) return;

      it(`sunrise within ±${SUNRISE_TOL_MIN} min`, () => {
        expect(diffMin(result.sun.riseLocal, f.expected.sunriseHHMM, f.date))
          .toBeLessThanOrEqual(SUNRISE_TOL_MIN);
      });
      it(`sunset within ±${SUNRISE_TOL_MIN} min`, () => {
        expect(diffMin(result.sun.setLocal, f.expected.sunsetHHMM, f.date))
          .toBeLessThanOrEqual(SUNRISE_TOL_MIN);
      });

      if (f.expected.madhyahnaHHMM) {
        it(`Madhyahna midpoint within ±${STRICT_TOL_MIN} min`, () => {
          const mid = new Date(
            (result.muhurtas.madhyahna.start.getTime() + result.muhurtas.madhyahna.end.getTime()) / 2,
          );
          expect(diffMin(
            formatInZone(mid, result.timezone.offsetMinutes),
            f.expected.madhyahnaHHMM!,
            f.date,
          ))
            .toBeLessThanOrEqual(STRICT_TOL_MIN);
        });
      }

      if (f.expected.anandadiYogaName) {
        it(`Anandadi Yoga "${f.expected.anandadiYogaName}"`, () => {
          expect(result.anandadiYoga.name).toBe(f.expected.anandadiYogaName);
        });
      }

      it(`Ganda Mula active === ${f.expected.gandaMulaActive}`, () => {
        expect(result.inauspicious.gandaMula.active).toBe(f.expected.gandaMulaActive);
      });

      const SANDHYA_TOL_MIN = 2;

      if (f.expected.pratahSandhyaStartHHMM && f.expected.pratahSandhyaEndHHMM) {
        it(`Pratah Sandhya start within ±${SANDHYA_TOL_MIN} min of the almanac`, () => {
          expect(diffMin(result.muhurtas.pratahSandhya.startLocal, f.expected.pratahSandhyaStartHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
        it(`Pratah Sandhya end within ±${SANDHYA_TOL_MIN} min of the almanac`, () => {
          expect(diffMin(result.muhurtas.pratahSandhya.endLocal, f.expected.pratahSandhyaEndHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
      }

      if (f.expected.sayahnaSandhyaStartHHMM && f.expected.sayahnaSandhyaEndHHMM) {
        it(`Sayahna Sandhya start within ±${SANDHYA_TOL_MIN} min of the almanac`, () => {
          expect(diffMin(result.muhurtas.sayahnaSandhya.startLocal, f.expected.sayahnaSandhyaStartHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
        it(`Sayahna Sandhya end within ±${SANDHYA_TOL_MIN} min of the almanac`, () => {
          expect(diffMin(result.muhurtas.sayahnaSandhya.endLocal, f.expected.sayahnaSandhyaEndHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
      }

      if (f.expected.varjyamStartHHMM && f.expected.varjyamEndHHMM) {
        it(`Varjyam: some window matches the almanac's row`, () => {
          const windows = result.inauspicious.varjyam;
          expect(windows.length, 'The almanac printed a Varjyam row; library emitted none')
            .toBeGreaterThan(0);
          const best = Math.min(...windows.map((w) => Math.max(
            diffMin(w.startLocal, f.expected.varjyamStartHHMM!, f.date),
            diffMin(w.endLocal, f.expected.varjyamEndHHMM!, f.date),
          )));
          expect(best).toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
      }

      const skipKey = `${f.city}|${f.date}`;
      if (!SOFT_YOGA_SKIP.has(skipKey)) {
        const almanacYogas = [...f.expected.auspiciousYogas, ...f.expected.inauspiciousYogas]
          .map(almanacYogaToLibType)
          .filter((y): y is string => y !== null);
        const almanacYogaSet = new Set(almanacYogas);
        if (almanacYogaSet.size > 0) {
          for (const y of almanacYogaSet) {
            it(`special yoga "${y}" detected by library`, () => {
              const libTypes = result.specialYogas.map((s) => s.type);
              expect(libTypes).toContain(y);
            });
          }
        }
      }
    });
  }
});

describe('Phase 28 cross-validation: aggregate', () => {
  it('coverage: 10 cities × 5 dates', () => {
    const cities = new Set(TYPED.map((f) => f.city));
    const dates = new Set(TYPED.map((f) => f.date));
    expect(cities.size).toBe(10);
    expect(dates.size).toBe(5);
    expect(TYPED.length).toBe(50);
  });

  it('all 50 fixtures resolve to non-null library results', () => {
    let nonNull = 0;
    for (const f of TYPED) {
      const r = getDailyPanchang(noonUtc(f.date), f.location, {
        timezone: f.timezone,
        language: 'en',
      });
      if (r !== null) nonNull++;
    }
    expect(nonNull).toBe(TYPED.length);
  });

  it('Pratah + Sayahna Sandhya agree with the almanac within ±2 min on every fixture', () => {
    let pratahMaxDiff = 0;
    let sayahnaMaxDiff = 0;
    for (const f of TYPED) {
      const r = getDailyPanchang(noonUtc(f.date), f.location, {
        timezone: f.timezone,
        language: 'en',
      });
      if (r === null) continue;
      if (f.expected.pratahSandhyaStartHHMM) {
        pratahMaxDiff = Math.max(
          pratahMaxDiff,
          diffMin(r.muhurtas.pratahSandhya.startLocal, f.expected.pratahSandhyaStartHHMM, f.date),
        );
      }
      if (f.expected.sayahnaSandhyaStartHHMM) {
        sayahnaMaxDiff = Math.max(
          sayahnaMaxDiff,
          diffMin(r.muhurtas.sayahnaSandhya.startLocal, f.expected.sayahnaSandhyaStartHHMM, f.date),
        );
      }
    }
    expect(pratahMaxDiff).toBeLessThanOrEqual(2);
    expect(sayahnaMaxDiff).toBeLessThanOrEqual(2);
  });

  it('Varjyam agrees with the almanac within ±2 min on every fixture that has one', () => {
    let maxDiff = 0;
    let emitted = 0;
    let withExpected = 0;
    for (const f of TYPED) {
      if (!f.expected.varjyamStartHHMM || !f.expected.varjyamEndHHMM) continue;
      withExpected++;
      const r = getDailyPanchang(noonUtc(f.date), f.location, {
        timezone: f.timezone,
        language: 'en',
      });
      if (r === null || r.inauspicious.varjyam.length === 0) continue;
      emitted++;
      const best = Math.min(...r.inauspicious.varjyam.map((w) => Math.max(
        diffMin(w.startLocal, f.expected.varjyamStartHHMM!, f.date),
        diffMin(w.endLocal, f.expected.varjyamEndHHMM!, f.date),
      )));
      maxDiff = Math.max(maxDiff, best);
    }
    expect(emitted).toBe(withExpected);
    expect(maxDiff).toBeLessThanOrEqual(2);
  });
});
