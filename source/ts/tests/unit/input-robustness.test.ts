import { describe, it, expect } from 'vitest';
import { runInNewContext } from 'node:vm';
import {
  computeVimshottariDasha,
  computeAshtottariDasha,
  computeYoginiDasha,
} from '../../src/jyotish/dasha';
import { computeRashiChart } from '../../src/jyotish/charts';
import { computeYogas } from '../../src/jyotish/yogas';
import { computeArudhas } from '../../src/jyotish/arudha';
import { computeVarjyam, computeVarjyamWindows } from '../../src/core/varjyam';
import { computeAmritKalaWindows } from '../../src/core/muhurta';
import { formatInZone } from '../../src/utils/timezone';
import { computeKpSubLord, computeKpSignificators } from '../../src/jyotish/kpSubLord';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';
import { getMoonrise, getMoonset } from '../../src/astronomy/moonrise';
import { computeEkadashiDatesForYear, computeSankrantisForYear } from '../../src/calendar/yearly';
import { convertHinduToGregorian, getHinduNewYear } from '../../src/calendar/convert';
import { computeAyanamsa } from '../../src/astronomy/ayanamsa';
import { getSiderealSunLongitude } from '../../src/astronomy/sun';
import { getSiderealMoonLongitude } from '../../src/astronomy/moon';
import { computePlanetaryPositions } from '../../src/jyotish/planets';
import { computeVimshottariPratyantar } from '../../src/jyotish/dasha';
import { computeRahuKalam, computeGulikaKalam, computeYamaganda } from '../../src/core/inauspicious';
import {
  computeAbhijitMuhurta, computeBrahmaMuhurta, computeVijayaMuhurta, computeGodhuliMuhurta,
  computeNishitaMuhurta, computeMadhyahna, computePratahSandhya, computeSayahnaSandhya,
} from '../../src/core/muhurta';
import { computeGowriPanchangam } from '../../src/core/gowri';
import { computeDoGhati } from '../../src/core/doGhati';
import { computePanchakaRahita } from '../../src/core/panchakaRahita';
import { findPanchakaOnset } from '../../src/core/panchaka';
import { computeSamvat } from '../../src/core/samvat';
import { getUpcomingSolarEclipse, getUpcomingLunarEclipse, getEclipseDuringDay } from '../../src/astronomy/eclipse';
import { computeBhava } from '../../src/jyotish/bhava';
import { computePrashnaChart } from '../../src/jyotish/prashna';
import { computeDivisionalChart } from '../../src/jyotish/divisionals';
import { computeDignity } from '../../src/jyotish/dignity';
import { computeAspects } from '../../src/jyotish/aspects';
import type { Divisional } from '../../src/types/jyotish';
import type { HouseSystem } from '../../src/types/options';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';
import { referenceLocation, resolveLocation } from '../../src/core/defaultLocation';
import { resolveRegionAlias } from '../../src/core/regionAlias';
import type { Language } from '../../src/types/options';
import { buildMoonPhasesTable } from '../../src/calendar/buildMoonPhasesTable';
import { buildEclipsesTable } from '../../src/calendar/buildEclipsesTable';
import { buildFestivalsTable } from '../../src/calendar/buildFestivalsTable';
import { PanchangError } from '../../src/types/errors';
import type { BirthChart } from '../../src/types/jyotish';

/** Out-of-contract inputs: each either gets the documented normalisation or a coded PanchangError, never garbage. */

const BIRTH = new Date('2000-01-01T06:00:00Z');
const AS_OF = new Date('2020-06-01T00:00:00Z');
const DELHI = { latitude: 28.6139, longitude: 77.209 };
const CHART: BirthChart = computeRashiChart(new Date('1995-06-15T05:00:00Z'), DELHI);

function withLagna(index: number): BirthChart {
  const c = JSON.parse(JSON.stringify(CHART)) as BirthChart;
  c.lagna.rashi.index = index;
  return c;
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof PanchangError ? e.code : `not a PanchangError: ${String(e)}`;
  }
  return undefined;
}

describe('dasha Moon longitude outside [0, 360)', () => {
  const dashas = [
    ['vimshottari', computeVimshottariDasha],
    ['ashtottari', computeAshtottariDasha],
    ['yogini', computeYoginiDasha],
  ] as const;

  for (const [name, fn] of dashas) {
    it(`${name}: a finite longitude is wrapped, so 360, 720 and -0.5 equal 0, 0 and 359.5`, () => {
      expect(fn(BIRTH, 360, AS_OF)).toEqual(fn(BIRTH, 0, AS_OF));
      expect(fn(BIRTH, 720, AS_OF)).toEqual(fn(BIRTH, 0, AS_OF));
      expect(fn(BIRTH, -0.5, AS_OF)).toEqual(fn(BIRTH, 359.5, AS_OF));
    });

    it(`${name}: NaN and the infinities are INVALID_INPUT, checked before the date`, () => {
      for (const lon of [NaN, Infinity, -Infinity]) {
        expect(codeOf(() => fn(BIRTH, lon, AS_OF))).toBe('INVALID_INPUT');
        expect(codeOf(() => fn(new Date('1800-01-01T00:00:00Z'), lon, AS_OF))).toBe('INVALID_INPUT');
      }
    });
  }
});

describe('yogas and arudhas with a lagna rashi outside 0..11', () => {
  it('computeYogas rejects any lagna outside 0..11 with INVALID_INPUT', () => {
    for (const l of [12, 13, -1, -12, 1.5]) {
      expect(codeOf(() => computeYogas(withLagna(l)))).toBe('INVALID_INPUT');
    }
    expect(computeYogas(withLagna(CHART.lagna.rashi.index))).toEqual(computeYogas(CHART));
  });

  it('computeArudhas wraps 12 and above but rejects a negative or fractional lagna', () => {
    expect(computeArudhas(withLagna(12))).toEqual(computeArudhas(withLagna(0)));
    for (const l of [-1, -12, 1.5]) {
      expect(codeOf(() => computeArudhas(withLagna(l)))).toBe('INVALID_INPUT');
    }
  });
});

describe('varjyam and amrit kala with a getMoon outside [0, 360)', () => {
  const sr = new Date('2025-03-20T00:00:00Z');
  const nsr = new Date(sr.getTime() + 864e5);
  const linear = (base: number) => (d: Date) => base + ((d.getTime() - sr.getTime()) / 3600e3) * 0.55;
  const spans = (ws: { start: Date; end: Date }[]) => ws.map((w) => [w.start.getTime(), w.end.getTime()]);

  it('a nakshatra read outside 0..26 contributes no spell (the Go port pins the same values)', () => {
    expect(spans(computeVarjyamWindows(sr, nsr, linear(-10)))).toEqual([]);
    expect(spans(computeAmritKalaWindows(sr, nsr, linear(-10)))).toEqual([]);
    expect(spans(computeAmritKalaWindows(sr, nsr, linear(355)))).toEqual([[1742452800002, 1742458618182]]);
    expect(spans(computeAmritKalaWindows(sr, nsr, linear(-3)))).toEqual([[1742509527272, 1742515345454]]);
    expect(spans(computeVarjyamWindows(sr, nsr, linear(5)))).toEqual([[1742468800004, 1742474618184]]);
  });

  it('a NaN Moon gives no windows, and the single-window form none (no nakshatra is in force)', () => {
    expect(computeVarjyamWindows(sr, nsr, () => NaN)).toEqual([]);
    expect(computeVarjyam(0, sr, nsr, () => NaN)).toBeNull();
    expect(computeVarjyam(16, sr, nsr, () => NaN)).toBeNull();
  });
});

describe('formatInZone with offsets past 60 hours, fractional offsets and Invalid Date', () => {
  const at = new Date(1736818784172);

  it('renders the hour field in as many digits as it needs, matching the Go port', () => {
    expect(formatInZone(at, 330)).toBe('2025-01-14T07:09:44.172+05:30');
    expect(formatInZone(at, 3659)).toBe('2025-01-16T14:38:44.172+60:59');
    expect(formatInZone(at, 3660)).toBe('2025-01-16T14:39:44.172+61:00');
    expect(formatInZone(at, -5000)).toBe('2025-01-10T14:19:44.172-83:20');
    expect(formatInZone(at, 19800)).toBe('2025-01-27T19:39:44.172+330:00');
  });

  it('throws INVALID_TIMEZONE for a non-integer offset and INVALID_DATE for an Invalid Date', () => {
    expect(codeOf(() => formatInZone(at, 330.5))).toBe('INVALID_TIMEZONE');
    expect(codeOf(() => formatInZone(at, NaN))).toBe('INVALID_TIMEZONE');
    expect(codeOf(() => formatInZone(new Date(NaN), 330))).toBe('INVALID_DATE');
  });
});

describe('KP inputs outside the contract', () => {
  it('computeKpSubLord of a non-finite longitude keeps its documented NaN reading (the Go port mirrors it)', () => {
    for (const lon of [NaN, Infinity, -Infinity]) {
      const k = computeKpSubLord(lon);
      expect([k.longitude, k.rashi, k.nakshatra, k.signLord, k.starLord, k.subLord])
        .toEqual([NaN, NaN, NaN, undefined, undefined, 'Saturn']);
    }
  });

  it('computeKpSignificators wraps a planet longitude and skips the star lord of a non-finite one', () => {
    const sunAt = (lon: number) => {
      const c = withLagna(CHART.lagna.rashi.index);
      c.planets[0]!.longitude = lon;
      return computeKpSignificators(c).byPlanet.Sun;
    };
    expect(sunAt(360)).toEqual(sunAt(0));
    expect(sunAt(360)).toEqual([1, 9, 10]);
    expect(sunAt(-5)).toEqual([1, 2, 10, 11]);
    expect(sunAt(NaN)).toEqual([1, 10]);
  });
});

describe('rise and set beyond the solver range', () => {
  const PUNE = { latitude: 18.52, longitude: 73.85 };
  const far = new Date(Date.UTC(150000, 0, 1));

  it('an Invalid Date is INVALID_DATE instead of a scan that never ends', () => {
    const bad = new Date(NaN);
    expect(codeOf(() => computeSunrise(bad, PUNE))).toBe('INVALID_DATE');
    expect(codeOf(() => computeSunset(bad, PUNE))).toBe('INVALID_DATE');
    expect(codeOf(() => getMoonrise(bad, PUNE))).toBe('INVALID_DATE');
    expect(codeOf(() => getMoonset(bad, PUNE))).toBe('INVALID_DATE');
  });

  it('an instant 2^52 ms or more from 1970 is INVALID_DATE at every entry that reaches the solver', () => {
    expect(codeOf(() => computeSunrise(far, PUNE))).toBe('INVALID_DATE');
    expect(codeOf(() => computeSunrise(new Date(Date.UTC(-150000, 0, 1)), PUNE))).toBe('INVALID_DATE');
    expect(codeOf(() => getMoonrise(far, PUNE))).toBe('INVALID_DATE');
    expect(codeOf(() => computeSankrantisForYear(150000, PUNE, { timezone: 330 }))).toBe('INVALID_DATE');
    expect(codeOf(() => computeEkadashiDatesForYear(150000, PUNE, { timezone: 330 }))).toBe('INVALID_DATE');
    expect(codeOf(() => getHinduNewYear(150000, 'tamil-nadu', PUNE, { timezone: 330 }))).toBe('INVALID_DATE');
  });

  it('inside 2^52 ms the solver still answers, up to the last whole day before the edge', () => {
    expect(computeSunrise(new Date(Date.UTC(144000, 0, 1)), PUNE).toISOString()).toBe('+144000-01-01T00:11:02.048Z');
    const lastGoodDay = Math.floor(2 ** 52 / 864e5) - 1;
    expect(codeOf(() => computeSunrise(new Date((lastGoodDay - 2) * 864e5), PUNE, 1))).toBeUndefined();
    expect(codeOf(() => computeSunrise(new Date((lastGoodDay + 1) * 864e5 - 1), PUNE, 0))).toBe('INVALID_DATE');
  });
});

describe('an Invalid Date is INVALID_DATE, not NaN output', () => {
  const BAD = new Date(NaN);
  const d = new Date('2025-03-20T01:00:00Z');
  const moon = () => 100;
  const name = (i: number) => String(i);
  const quality = (q: string) => q;
  const PUNE = { latitude: 18.52, longitude: 73.85 };
  const calls: Record<string, () => unknown> = {
    getAyanamsa: () => computeAyanamsa(BAD, 'lahiri'),
    getSiderealSunLongitude: () => getSiderealSunLongitude(BAD, 'lahiri'),
    getSiderealMoonLongitude: () => getSiderealMoonLongitude(BAD, 'lahiri'),
    computePlanetaryPositions: () => computePlanetaryPositions(BAD, 'lahiri'),
    formatInZone: () => formatInZone(BAD, 330),
    computeRahuKalam: () => computeRahuKalam(d, BAD, 1),
    computeGulikaKalam: () => computeGulikaKalam(BAD, d, 1),
    computeYamaganda: () => computeYamaganda(BAD, d, 1),
    computeAbhijitMuhurta: () => computeAbhijitMuhurta(BAD, d),
    computeBrahmaMuhurta: () => computeBrahmaMuhurta(BAD, d),
    computeVijayaMuhurta: () => computeVijayaMuhurta(d, BAD),
    computeGodhuliMuhurta: () => computeGodhuliMuhurta(BAD),
    computeNishitaMuhurta: () => computeNishitaMuhurta(BAD, d),
    computeMadhyahna: () => computeMadhyahna(BAD, d),
    computePratahSandhya: () => computePratahSandhya(d, d, BAD),
    computeSayahnaSandhya: () => computeSayahnaSandhya(BAD, d),
    computeAmritKalaWindows: () => computeAmritKalaWindows(BAD, d, moon),
    computeVarjyam: () => computeVarjyam(3, BAD, d, moon),
    computeVarjyamWindows: () => computeVarjyamWindows(d, BAD, moon),
    computeGowriPanchangam: () => computeGowriPanchangam(BAD, d, d, 1, name, quality),
    computeDoGhati: () => computeDoGhati(d, BAD, d, name, quality),
    computePanchakaRahita: () => computePanchakaRahita(BAD, d, moon),
    findPanchakaOnset: () => findPanchakaOnset(BAD, moon),
    computeSamvat: () => computeSamvat(BAD),
    computeVimshottariPratyantar: () => computeVimshottariPratyantar({ lord: 'Sun', startDate: BAD, endDate: BAD }),
    getUpcomingSolarEclipse: () => getUpcomingSolarEclipse(BAD, PUNE, 400),
    getUpcomingLunarEclipse: () => getUpcomingLunarEclipse(BAD, PUNE, 400),
    getEclipseDuringDay: () => getEclipseDuringDay(BAD, d, PUNE),
  };
  for (const [fn, call] of Object.entries(calls)) {
    it(fn, () => expect(codeOf(call)).toBe('INVALID_DATE'));
  }

  it('a Date from another realm, which fails instanceof, is still accepted', () => {
    const foreign = runInNewContext('new Date("2025-03-20T01:00:00Z")') as Date;
    expect(foreign instanceof Date).toBe(false);
    expect(computeRahuKalam(foreign, new Date('2025-03-20T13:10:00Z'), 1).start.toISOString())
      .toBe('2025-03-20T02:31:15.000Z');
    expect(computeSunrise(foreign, PUNE).toISOString()).toBe('2025-03-20T01:08:45.554Z');
  });

  it('a valid date outside 1900..2100 is still accepted by these helpers', () => {
    const y2200 = new Date('2200-01-01T01:00:00Z');
    expect(computeRahuKalam(y2200, new Date('2200-01-01T13:00:00Z'), 1).start.toISOString())
      .toBe('2200-01-01T02:30:00.000Z');
    expect(computeAyanamsa(y2200)).toBeCloseTo(26.6589, 3);
  });

  it('an unknown pratyantar lord is INVALID_INPUT', () => {
    expect(codeOf(() => computeVimshottariPratyantar({ lord: 'Pluto' as never, startDate: d, endDate: d })))
      .toBe('INVALID_INPUT');
  });
});

describe('window helpers with a varaIndex outside 0..6', () => {
  const sr = new Date('2025-03-20T01:00:00Z');
  const ss = new Date('2025-03-20T13:10:00Z');
  const nsr = new Date('2025-03-21T01:00:00Z');
  for (const v of [7, -1, 1.5, NaN]) {
    it(`throws INVALID_INPUT for ${v}`, () => {
      expect(codeOf(() => computeRahuKalam(sr, ss, v))).toBe('INVALID_INPUT');
      expect(codeOf(() => computeGulikaKalam(sr, ss, v))).toBe('INVALID_INPUT');
      expect(codeOf(() => computeYamaganda(sr, ss, v))).toBe('INVALID_INPUT');
      expect(codeOf(() => computeGowriPanchangam(sr, ss, nsr, v, String, (q) => q))).toBe('INVALID_INPUT');
    });
  }
  it('0..6 still give the same windows', () => {
    expect(computeRahuKalam(sr, ss, 0).start.toISOString()).toBe('2025-03-20T11:38:45.000Z');
    expect(computeYamaganda(sr, ss, 6).start.toISOString()).toBe('2025-03-20T08:36:15.000Z');
  });
});

describe('unknown enum option values are INVALID_INPUT, as in Go', () => {
  const b = new Date('1990-05-15T06:30:00Z');

  it('houseSystem outside the union, the empty string included', () => {
    for (const hs of ['placidus', 'koch', '', 'WHOLE-SIGN'] as unknown as HouseSystem[]) {
      expect(codeOf(() => computeBhava(b, DELHI, { houseSystem: hs }))).toBe('INVALID_INPUT');
      expect(codeOf(() => computeRashiChart(b, DELHI, { houseSystem: hs }))).toBe('INVALID_INPUT');
      expect(codeOf(() => computePrashnaChart(b, DELHI, { houseSystem: hs }))).toBe('INVALID_INPUT');
    }
    expect(computeBhava(b, DELHI).system).toBe('whole-sign');
  });

  it('divisional outside D2, D3, D7, D9, D10, D12, D30', () => {
    for (const dv of ['D1', 'D16', 'D60', 'd9', '', 'constructor'] as unknown as Divisional[]) {
      expect(codeOf(() => computeDivisionalChart(b, DELHI, dv))).toBe('INVALID_INPUT');
    }
    expect(computeDivisionalChart(b, DELHI, 'D10').planets).toHaveLength(9);
  });

  it('computeDignity with an unknown graha, prototype names included', () => {
    expect(codeOf(() => computeDignity('pluto' as never, 1))).toBe('INVALID_INPUT');
    expect(codeOf(() => computeDignity('constructor' as never, 1))).toBe('INVALID_INPUT');
    expect(computeDignity('Sun', 0)).toBe('exalted');
  });

  it('nodeAspects and yoga types outside their unions; the empty nodeAspects stays the default', () => {
    expect(codeOf(() => computeAspects(CHART, { nodeAspects: 'foo' as never }))).toBe('INVALID_INPUT');
    expect(computeAspects(CHART, { nodeAspects: '' as never })).toEqual(computeAspects(CHART));
    expect(codeOf(() => computeYogas(CHART, { types: ['foo' as never] }))).toBe('INVALID_INPUT');
    expect(codeOf(() => computeYogas(CHART, { nodeAspects: 'foo' as never }))).toBe('INVALID_INPUT');
    expect(computeYogas(CHART, { types: ['mahapurusha'] })).toHaveLength(1);
  });
});

describe('prototype-named option strings and null janma values', () => {
  const d = new Date('2025-03-20T00:00:00Z');
  const PUNE = { latitude: 18.52, longitude: 73.85 };

  it('a language named after an Object.prototype member falls back to English like any unknown one', () => {
    const english = getDailyPanchang(d, PUNE, { timezone: 330, language: 'en' })!.angas.tithis[0]!.name;
    for (const lang of ['constructor', '__proto__', 'toString', 'hasOwnProperty'] as unknown as Language[]) {
      expect(getDailyPanchang(d, PUNE, { timezone: 330, language: lang })!.angas.tithis[0]!.name).toBe(english);
      expect(getInstantPanchang(d, PUNE, { language: lang })!.angas.tithi.name).toBe(english);
    }
  });

  it('referenceLocation and resolveLocation reject prototype names with INVALID_INPUT', () => {
    for (const m of ['toString', 'constructor', '__proto__']) {
      expect(codeOf(() => referenceLocation(m as never))).toBe('INVALID_INPUT');
      expect(codeOf(() => resolveLocation(undefined, m as never))).toBe('INVALID_INPUT');
    }
  });

  it('a region named after a prototype member passes through instead of resolving to a function', () => {
    expect(resolveRegionAlias('constructor' as never)).toBe('constructor');
  });

  it('janmaRashi and janmaNakshatra null are treated as omitted', () => {
    const daily = getDailyPanchang(d, PUNE, { timezone: 330, janmaRashi: null as never, janmaNakshatra: null as never })!;
    expect([daily.chandraBalam, daily.tarabala]).toEqual([null, null]);
    const instant = getInstantPanchang(d, PUNE, { janmaRashi: null as never, janmaNakshatra: null as never })!;
    expect([instant.chandraBalam, instant.tarabala]).toEqual([null, null]);
  });
});

describe('table builders validate the offset and the languages', () => {
  const VARANASI = { latitude: 25.3176, longitude: 82.9739 };
  const year = { startYear: 2025, endYear: 2025 };

  it('an offset that is not an integer in -720..840 is INVALID_TIMEZONE', () => {
    for (const off of [1e6, NaN, 330.5, -721]) {
      expect(codeOf(() => buildMoonPhasesTable({ timezoneOffsetMinutes: off, ...year }))).toBe('INVALID_TIMEZONE');
      expect(codeOf(() => buildEclipsesTable({ location: VARANASI, timezoneOffsetMinutes: off, ...year })))
        .toBe('INVALID_TIMEZONE');
    }
  });

  it('a language other than en and hi is a RangeError in all three builders; repeats stay fine', () => {
    for (const languages of [['fr'], ['en', 'fr'], ['EN'], [''], ['constructor']] as never[]) {
      expect(() => buildMoonPhasesTable({ timezoneOffsetMinutes: 330, ...year, languages })).toThrow(RangeError);
      expect(() => buildEclipsesTable({ location: VARANASI, timezoneOffsetMinutes: 330, ...year, languages }))
        .toThrow(RangeError);
      expect(() => buildFestivalsTable({ location: VARANASI, timezoneOffsetMinutes: 330, ...year, languages }))
        .toThrow(RangeError);
    }
    expect(buildMoonPhasesTable({ timezoneOffsetMinutes: 840, ...year, languages: ['en', 'hi', 'en'] })._dict)
      .toHaveLength(4);
  });
});

describe('convertHinduToGregorian with a vikramSamvat that is not a usable integer', () => {
  const PUNE = { latitude: 18.52, longitude: 73.85 };
  const coords = (vikramSamvat: number) => ({ vikramSamvat, masaIndex: 0, paksha: 'shukla' as const, pakshaTithi: 1 });

  it('NaN, fractional and out-of-Date-range values are INVALID_DATE, like the Go port, instead of []', () => {
    for (const vs of [NaN, 2082.5, 1e9, Infinity]) {
      expect(codeOf(() => convertHinduToGregorian(coords(vs), PUNE, { timezone: 'Asia/Kolkata' }))).toBe('INVALID_DATE');
    }
    expect(codeOf(() => convertHinduToGregorian(coords(1956), PUNE, { timezone: 'Asia/Kolkata' }))).toBe('INVALID_DATE');
  });

  it('an ordinary samvat still converts', () => {
    expect(convertHinduToGregorian(coords(2082), PUNE, { timezone: 'Asia/Kolkata' }).map((d) => d.toISOString()))
      .toEqual(['2025-03-30T00:00:00.000Z']);
  });
});
