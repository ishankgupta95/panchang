/**
 * The TS oracle dump: the diff-compare document on stdout for `diff.mjs`, and
 * the byte-compare tables in `out/tables-<label>/`.
 *
 * Nothing here may read the wall clock: every instant is a literal, and
 * iteration order comes from the arrays below, never from key enumeration. The
 * document is emitted incrementally because a whole-document `JSON.stringify`
 * would sit near V8's max string length, and each write loops because a pipe
 * can take a partial write.
 *
 *   bash go/parity/dump.sh <label>
 */

import { mkdirSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import {
  getDailyPanchang, getInstantPanchang,
  computePlanetaryPositions, GRAHA_ABBR,
  computeVimshottariDashaFromBirth, computeVimshottariPratyantar,
  computeAshtottariDasha, computeYoginiDasha, computeCharaDasha, computeNarayanDasha,
  ASHTOTTARI_ORDER, ASHTOTTARI_YEARS,
  YOGINI_ORDER, YOGINI_YEARS, YOGINI_PLANET,
  CHARA_RASHI_YEARS, VISHAMA_PADA_RASHIS, SAMA_PADA_RASHIS,
  computeChandraBalam, computeTarabala, computeDignity,
  computeLagna, computeHoraLagna, computeGhatiLagna, computeBhavaLagna, computeSripatiLagna,
  computeBhava, computeRashiChart, computeNavamsa, computeDivisionalChart,
  computeShadbala, computeBhavaBala, computeAshtakavarga, computeYogas,
  computeJaiminiKarakas, computeUpagrahas, computeArudhas, computeArgala, computeAspects,
  computeMangalDosha, computeMangalCompatibility, computeKaalSarp, computePitruDosha,
  computeSadeSati, computeVarshaphala, computeTithiPravesha, ALL_SAHAM_NAMES,
  computeKpSubLord, computeKpCuspalSubLords, computeKpSignificators, computePrashnaChart,
  computeAshtakoot, computePathuPorutham,
  getSunrise, getSunset, getMoonrise, getMoonset,
  getSiderealSunLongitude, getSiderealMoonLongitude, getAyanamsa,
  computeMoonPhasesForYear,
  formatInZone,
  scoreMuhurta, computeAuspiciousDatesInRange, computeVaraTithiYogas,
  computePanchaka, classifyPanchaka, isPanchakaDosha,
  buildMuhurtaTable, vivahRule, STOCK_MUHURTA_RULES,
  convertGregorianToHindu, convertHinduToGregorian,
  getKaliYugaYear, getHinduNewYear, computeSamvat,
  computeEkadashiDatesForYear, computeSankrantisForYear,
  computeFestivalsForYear, computeEclipsesForYear,
  buildFestivalsTable, buildEclipsesTable, buildMoonPhasesTable,
  PanchangError,
} from '../../ts/src/index';

import type {
  AyanamsaType, Divisional, FestivalRegion,
  GeoLocation, GrahaName, HouseSystem, InstantPanchangOptions, LegacyFestivalRegion,
  MuhurtaRule, NatalMoon, PanchangOptions, PanchangSection, PanchakaType, YogaType,
} from '../../ts/src/index';

const REPO = process.env['PARITY_REPO'] ?? process.cwd();
const OUT = process.env['PARITY_OUT'] ?? join(REPO, 'source', 'go', 'parity', 'out');
const LABEL = process.env['PARITY_LABEL'] ?? 'unlabeled';

/**
 * The g2 document must stay byte-identical, its recorded diff being the standing
 * baseline, so `_meta.g2` keeps its key under g3 as well; read the key name as
 * "the reduced-document descriptor".
 */
type ParityStage = 'g2' | 'g3' | 'full';

function resolveStage(): ParityStage {
  const raw = process.env['PARITY_STAGE'] ?? '';
  const legacy = process.env['PARITY_G2'] === '1';
  if (raw === '') return legacy ? 'g2' : 'full';
  if (legacy && raw !== 'g2') {
    throw new Error(`PARITY_G2=1 and PARITY_STAGE=${raw} disagree; set one`);
  }
  if (raw !== 'g2' && raw !== 'g3' && raw !== 'full') {
    throw new Error(`PARITY_STAGE must be g2 | g3 | full, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

const STAGE: ParityStage = resolveStage();

const REDUCED = STAGE !== 'full';
const CHARTS_IN = STAGE === 'g3' || STAGE === 'full';

const G2_SECTIONS: readonly PanchangSection[] = ['eclipse', 'moonTimes', 'lunarWindows'];

const FLUSH_AT = 4 << 20;
let pending: string[] = [];
let pendingLen = 0;

function flush(): void {
  if (pendingLen === 0) return;
  const b = Buffer.from(pending.join(''), 'utf8');
  pending = [];
  pendingLen = 0;
  let off = 0;
  while (off < b.length) off += writeSync(1, b, off, b.length - off);
}

function raw(s: string): void {
  pending.push(s);
  pendingLen += s.length;
  if (pendingLen >= FLUSH_AT) flush();
}

// A NaN serialized as JSON's `null` would read as a legitimately-absent leaf on
// both sides of the diff.
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return `<non-finite:${String(value)}>`;
  }
  return value;
}

function enc(v: unknown): string {
  const s = JSON.stringify(v, replacer);
  if (s === undefined) throw new Error('dump: attempted to emit a non-JSON value');
  return s;
}

/** Keys are emitted in call order, which is the parity contract. */
class Obj {
  private first = true;
  constructor() { raw('{'); }
  private key(k: string): void {
    if (!this.first) raw(',');
    this.first = false;
    raw(JSON.stringify(k) + ':');
  }
  put(k: string, v: unknown): void { this.key(k); raw(enc(v)); }
  obj(k: string): Obj { this.key(k); return new Obj(); }
  arr(k: string): Arr { this.key(k); return new Arr(); }
  end(): void { raw('}'); }
}

class Arr {
  private first = true;
  constructor() { raw('['); }
  push(v: unknown): void {
    if (!this.first) raw(',');
    this.first = false;
    raw(enc(v));
  }
  end(): void { raw(']'); }
}

interface ErrorLeaf { _error: { kind: string; code: string } }

// The code is compared at zero tolerance; the message is prose and is
// deliberately not compared.
function safe<T>(fn: () => T): T | ErrorLeaf {
  try {
    return fn();
  } catch (e) {
    if (e instanceof PanchangError) return { _error: { kind: 'PanchangError', code: e.code } };
    if (e instanceof RangeError) return { _error: { kind: 'RangeError', code: '' } };
    return { _error: { kind: e instanceof Error ? e.name : 'unknown', code: '' } };
  }
}

const DAY_MS = 86_400_000;

const PIN_MS = Date.UTC(2026, 7, 23, 0, 0, 0, 0);
const PIN_DATE = new Date(PIN_MS);

const PINNED_GENERATED_AT = '2026-08-23T00:00:00.000Z';

// Passing DumpLocation straight in works in JavaScript, but the result echoes
// `location` back and `name` and `timezone` would ride into the dump, where the
// three-field `types.GeoLocation` has nowhere to put them.
function geoOf(l: DumpLocation): GeoLocation {
  return l.elevation === undefined
    ? { latitude: l.latitude, longitude: l.longitude }
    : { latitude: l.latitude, longitude: l.longitude, elevation: l.elevation };
}

interface DumpLocation extends GeoLocation {
  name: string;
  timezone: number | string;
}

const LOCATIONS: readonly DumpLocation[] = [
  { name: 'Pune', latitude: 18.5204, longitude: 73.8567, timezone: 330 },
  { name: 'Delhi', latitude: 28.6139, longitude: 77.2090, timezone: 330 },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 330 },
  { name: 'NewYork', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' },
  { name: 'London', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  { name: 'Reykjavik', latitude: 64.1466, longitude: -21.9426, timezone: 0 },
];

interface Epoch { name: string; startMs: number; days: number; year: number }

/** No span crosses a year boundary, so each epoch's `year` anchor is unambiguous. */
const EPOCHS: readonly Epoch[] = [
  { name: '1912', startMs: Date.UTC(1912, 5, 1), days: 60, year: 1912 },
  { name: '2025', startMs: Date.UTC(2025, 0, 1), days: 200, year: 2025 },
  { name: '2088', startMs: Date.UTC(2088, 5, 1), days: 60, year: 2088 },
];

interface Shape { name: string; build: (tz: number | string) => PanchangOptions }

const SHAPES: readonly Shape[] = [
  { name: 's1-default', build: (tz) => ({ timezone: tz }) },
  { name: 's2-narrow', build: (tz) => ({ timezone: tz, sections: [], computeEndTimes: false }) },
  { name: 's3-hi', build: (tz) => ({ timezone: tz, language: 'hi' }) },
  {
    name: 's4-amanta-tn-raman',
    build: (tz) => ({ timezone: tz, masaSystem: 'amanta', region: 'tamil-nadu', ayanamsa: 'raman' }),
  },
  // Deliberately index 0 on both: 0 is Mesha / Ashwini, so a Go port that
  // treats the zero value as "absent" silently drops chandraBalam + tarabala.
  { name: 's5-janma0', build: (tz) => ({ timezone: tz, janmaRashi: 0, janmaNakshatra: 0 }) },
];

const INSTANT_SHAPES: readonly { name: string; opts: InstantPanchangOptions }[] = [
  { name: 'i1-default', opts: {} },
  {
    name: 'i2-full',
    opts: {
      ayanamsa: 'raman', language: 'hi', masaSystem: 'amanta',
      janmaRashi: 0, janmaNakshatra: 0, region: 'tamil-nadu',
    },
  },
];

interface ChartEvent { name: string; iso: string; loc: GeoLocation }

/** e5 is at 64.15°N, still inside the |φ| ≲ 66.5° domain Placidus-KP is defined on. */
const CHART_EVENTS: readonly ChartEvent[] = [
  { name: 'e1-1912-pune', iso: '1912-06-14T03:22:10.000Z', loc: { latitude: 18.5204, longitude: 73.8567 } },
  { name: 'e2-1976-newyork', iso: '1976-11-02T21:47:00.000Z', loc: { latitude: 40.7128, longitude: -74.0060 } },
  { name: 'e3-1995-delhi', iso: '1995-08-15T05:30:00.000Z', loc: { latitude: 28.6139, longitude: 77.2090 } },
  { name: 'e4-2039-sydney', iso: '2039-03-21T11:11:11.000Z', loc: { latitude: -33.8688, longitude: 151.2093 } },
  { name: 'e5-2088-reykjavik', iso: '2088-06-19T18:05:33.000Z', loc: { latitude: 64.1466, longitude: -21.9426 } },
];

const HOUSE_SYSTEMS: readonly HouseSystem[] = ['whole-sign', 'equal', 'placidus-kp'];
const DIVISIONALS: readonly Divisional[] = ['D2', 'D3', 'D7', 'D10', 'D12', 'D30'];
const AYANAMSAS: readonly AyanamsaType[] = ['lahiri', 'raman', 'krishnamurti', 'true-chitra', 'thirukanitham'];
const GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

const CANONICAL_REGIONS: readonly FestivalRegion[] = [
  'all',
  'tamil-nadu', 'kerala', 'karnataka', 'andhra-pradesh', 'telangana',
  'west-bengal', 'odisha', 'assam', 'bihar', 'jharkhand',
  'gujarat', 'maharashtra', 'goa', 'rajasthan',
  'punjab', 'haryana', 'himachal-pradesh', 'uttarakhand', 'uttar-pradesh', 'madhya-pradesh',
  'nepal',
];
const LEGACY_REGIONS: readonly LegacyFestivalRegion[] = ['tamil', 'bengal', 'north-india'];

const STOCK_RULE_IDS: readonly string[] = [
  'vivah', 'grihaPravesh', 'namakarana', 'vidyarambh', 'vahanKharidi', 'annaprashan',
  'mundan', 'upanayanam', 'karnavedha', 'aksharabhyasam', 'seemantham', 'shopOpening',
  'travelStart',
];

// Reykjavik never exercises NO_SUNRISE / NO_SUNSET: at 64.1466°N the Sun at
// local midnight on the June solstice is at −2.41°, below the −0.833° rise/set
// altitude. Longyearbyen has continuous day ~20 Apr to ~22 Aug and continuous
// night ~26 Oct to ~15 Feb, which is where the window starts come from.
const POLAR: DumpLocation = {
  name: 'Longyearbyen', latitude: 78.2232, longitude: 15.6267, timezone: 60,
};
const POLAR_WINDOWS: readonly { name: string; startMs: number; days: number }[] = [
  { name: 'midnight-sun', startMs: Date.UTC(2025, 5, 15), days: 12 },
  { name: 'polar-night', startMs: Date.UTC(2025, 11, 15), days: 12 },
  { name: 'shoulder-spring', startMs: Date.UTC(2025, 3, 15), days: 12 },
  { name: 'shoulder-autumn', startMs: Date.UTC(2025, 9, 20), days: 12 },
];

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function sha256OfFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function writeMeta(doc: Obj): void {
  const m = doc.obj('_meta');
  m.put('document', 'panchang-ts parity dump (diff-compare half)');
  // LABEL is deliberately absent: it names the file, not the computation.
  m.put('pinnedNow', new Date(PIN_MS).toISOString());
  m.put('generatedAtStamp', PINNED_GENERATED_AT);
  m.put('locations', LOCATIONS.map((l) => ({
    name: l.name, latitude: l.latitude, longitude: l.longitude, timezone: l.timezone,
  })));
  m.put('epochs', EPOCHS.map((e) => ({
    name: e.name, start: new Date(e.startMs).toISOString(), days: e.days, year: e.year,
  })));
  m.put('daySplit', { '1912': 60, '2025': 200, '2088': 60, total: 320, perLocation: true });
  m.put('shapes', SHAPES.map((s) => s.name));
  m.put('instantShapes', INSTANT_SHAPES.map((s) => s.name));
  // Each arm is a literal, not a template over STAGE: the g2 contents are pinned.
  m.put('g2',
    STAGE === 'g2' ? {
      mode: 'PARITY_G2=1: the reduced document Stage G2 can answer',
      dailySections: G2_SECTIONS,
      instantFestivalsBlanked: true,
      omittedSections: [
        'yearly', 'charts', 'chartPairs', 'matching', 'muhurta', 'convert',
        'constants', 'helpers', 'tables',
      ],
      note:
        'festivals.ts / dayFestivals.ts are deferred to Stage G4, so the daily ' +
        'shapes are narrowed away from the festivals block and the instant ' +
        'results have their festivals array blanked. Everything else in both ' +
        'sections, including the eclipse block, is compared in full.',
    }
    : STAGE === 'g3' ? {
      mode: 'PARITY_STAGE=g3: G2 plus the jyotish chart sections',
      dailySections: G2_SECTIONS,
      instantFestivalsBlanked: true,
      omittedSections: [
        'yearly', 'muhurta', 'convert', 'constants', 'helpers', 'tables',
      ],
      note:
        'Adds charts, chartPairs and matching to the G2 document. The festival ' +
        'exclusion is unchanged: festivals.ts / dayFestivals.ts are Stage G4 ' +
        'in g3 too. `constants` and `helpers` are omitted deliberately rather ' +
        'than by oversight: they are pure tables and enum totality, already ' +
        'covered leaf-for-leaf by go/internal/**/testdata goldens, so emitting ' +
        'them here would add 2 MB of document and no new information.',
    }
    : null);
  if (CHARTS_IN) {
    m.put('chartEvents', CHART_EVENTS.map((c) => ({ name: c.name, iso: c.iso, loc: c.loc })));
  }
  m.put('polar', { location: POLAR, windows: POLAR_WINDOWS.map((w) => w.name) });
  m.put('pinnedLeaves', {
    reason: "dasha.ts's five current* leaves read the wall clock; asOfDate injects it",
    leaves: 'currentIndex, currentMahaDashaLord, currentYogini, currentRashi',
    asOf: PINNED_GENERATED_AT,
  });
  m.end();
}

function writeDaily(doc: Obj): void {
  const daily = doc.obj('daily');
  for (const loc of LOCATIONS) {
    for (const ep of EPOCHS) {
      for (let i = 0; i < ep.days; i++) {
        const ms = ep.startMs + i * DAY_MS;
        const date = new Date(ms);
        for (const shape of SHAPES) {
          daily.put(
            `${loc.name}|${ep.name}|${isoDay(ms)}|${shape.name}`,
            safe(() => {
              const opts = shape.build(loc.timezone);
              if (REDUCED && opts.sections === undefined) {
                return getDailyPanchang(date, geoOf(loc), { ...opts, sections: G2_SECTIONS });
              }
              return getDailyPanchang(date, geoOf(loc), opts);
            }),
          );
        }
      }
    }
  }
  daily.end();
}

// The offsets stay inside the shortest (60-day) span and carry sub-second
// components, where a float-to-int truncation mismatch shows up first.
function instantsFor(ep: Epoch): readonly Date[] {
  return [
    new Date(ep.startMs + 17 * 60_000),
    new Date(ep.startMs + 6 * 3_600_000 + 41 * 60_000 + 23_456),
    new Date(ep.startMs + 37 * DAY_MS + 12 * 3_600_000),
    new Date(ep.startMs + 53 * DAY_MS + DAY_MS - 1),
  ];
}

function writeInstant(doc: Obj): void {
  const inst = doc.obj('instant');
  for (const loc of LOCATIONS) {
    for (const ep of EPOCHS) {
      for (const d of instantsFor(ep)) {
        for (const shape of INSTANT_SHAPES) {
          inst.put(
            `${loc.name}|${ep.name}|${d.toISOString()}|${shape.name}`,
            safe(() => {
              const r = getInstantPanchang(d, geoOf(loc), shape.opts);
              // getInstantPanchang has no `sections` option, so the festivals
              // are blanked after the fact and `_meta.g2` records that.
              if (REDUCED && r !== null) return { ...r, festivals: [] };
              return r;
            }),
          );
        }
      }
    }
  }
  inst.end();
}

function writeYearly(doc: Obj): void {
  const yearly = doc.obj('yearly');
  for (const loc of LOCATIONS) {
    for (const ep of EPOCHS) {
      const y = ep.year;
      const opts = { timezone: loc.timezone };
      const o = yearly.obj(`${loc.name}|${y}`);
      o.put('festivals', safe(() => computeFestivalsForYear(y, geoOf(loc), opts)));
      o.put('ekadashi', safe(() => computeEkadashiDatesForYear(y, geoOf(loc), opts)));
      o.put('sankrantis', safe(() => computeSankrantisForYear(y, geoOf(loc), opts)));
      o.put('eclipses', safe(() => computeEclipsesForYear(y, geoOf(loc), opts)));
      o.put('moonPhases', safe(() => computeMoonPhasesForYear(y, opts)));
      o.end();
    }
  }
  yearly.end();
}

function writeCharts(doc: Obj): void {
  const charts = doc.obj('charts');
  for (const ev of CHART_EVENTS) {
    const d = new Date(ev.iso);
    const loc = ev.loc;
    const c = charts.obj(ev.name);

    c.put('positionsMean', safe(() => computePlanetaryPositions(d, 'lahiri', undefined, undefined, 'mean')));
    c.put('positionsTrue', safe(() => computePlanetaryPositions(d, 'lahiri', undefined, undefined, 'true')));

    c.put('lagna', safe(() => computeLagna(d, loc, 'lahiri', 'en')));
    c.put('lagnaHi', safe(() => computeLagna(d, loc, 'lahiri', 'hi')));
    c.put('horaLagna', safe(() => computeHoraLagna(d, loc, 'lahiri', 'en')));
    c.put('ghatiLagna', safe(() => computeGhatiLagna(d, loc, 'lahiri', 'en')));
    c.put('bhavaLagna', safe(() => computeBhavaLagna(d, loc, 'lahiri', 'en')));
    c.put('sripatiLagna', safe(() => computeSripatiLagna(d, loc, 'lahiri', 'en')));
    c.put('sripatiCusps', safe(() => computeSripatiLagna(d, loc, 'lahiri', 'en', { includeCusps: true })));

    const bh = c.obj('bhava');
    for (const hs of HOUSE_SYSTEMS) bh.put(hs, safe(() => computeBhava(d, loc, { houseSystem: hs })));
    bh.end();

    const chart = computeRashiChart(d, loc);
    const navamsa = computeNavamsa(d, loc);
    c.put('rashiChart', chart);
    c.put('navamsa', navamsa);
    const dv = c.obj('divisionals');
    for (const div of DIVISIONALS) dv.put(div, safe(() => computeDivisionalChart(d, loc, div)));
    dv.end();

    c.put('shadbala', safe(() => computeShadbala(d, loc)));
    c.put('bhavaBala', safe(() => computeBhavaBala(d, loc)));

    // `reductions` is Sodhana.
    c.put('ashtakavarga', safe(() => computeAshtakavarga(chart)));
    c.put('ashtakavargaReduced', safe(() => computeAshtakavarga(chart, { reductions: true })));

    // Without D9, Vargottama is silently skipped.
    c.put('yogas', safe(() => computeYogas(chart)));
    c.put('yogasWithNavamsa', safe(() => computeYogas(chart, { navamsa })));
    c.put('yogasRaja', safe(() => computeYogas(chart, { types: ['raja'] as readonly YogaType[] })));

    const vim = computeVimshottariDashaFromBirth(d, 'lahiri', PIN_DATE);
    c.put('vimshottari', vim);
    const antar0 = vim.mahaDashas[0]?.antarDashas[0];
    c.put('vimshottariPratyantar', antar0 ? computeVimshottariPratyantar(antar0) : null);

    const moonSid = getSiderealMoonLongitude(d, 'lahiri');
    const asht = computeAshtottariDasha(d, moonSid, PIN_DATE);
    c.put('ashtottari', asht);
    const yog = computeYoginiDasha(d, moonSid, PIN_DATE);
    c.put('yogini', yog);
    const chara = computeCharaDasha(d, loc, 'lahiri', PIN_DATE);
    c.put('chara', chara);
    const narFixed = computeNarayanDasha(d, loc, 'lahiri', { asOfDate: PIN_DATE });
    c.put('narayanFixed', narFixed);
    const narVar = computeNarayanDasha(d, loc, 'lahiri', { duration: 'variable', asOfDate: PIN_DATE });
    c.put('narayanVariable', narVar);

    c.put('karakas7', safe(() => computeJaiminiKarakas(chart, { variant: '7-parashara' })));
    c.put('karakas8', safe(() => computeJaiminiKarakas(chart, { variant: '8-jaimini' })));

    c.put('upagrahas', safe(() => computeUpagrahas(d, loc)));
    c.put('arudhas', safe(() => computeArudhas(chart, 'en')));
    c.put('argala', safe(() => computeArgala(chart)));
    c.put('argalaTrikona', safe(() => computeArgala(chart, { includeTrikonargala: true })));
    c.put('aspects7', safe(() => computeAspects(chart)));
    c.put('aspects59', safe(() => computeAspects(chart, { nodeAspects: '5-and-9' })));

    c.put('mangal', safe(() => computeMangalDosha(chart)));
    c.put('kaalSarp', safe(() => computeKaalSarp(chart)));
    c.put('pitru', safe(() => computePitruDosha(chart)));
    c.put('sadeSati', safe(() => computeSadeSati(chart.byPlanet.Moon.rashi.index, PIN_DATE, 'lahiri')));

    // For the 2088 event, age 30 lands in 2118, past `validateDate`'s 1900..2100
    // window, so it dumps as an INVALID_DATE leaf the Go port has to reproduce.
    c.put('varshaphalaAge30', safe(() => computeVarshaphala(d, 30, loc)));
    c.put('varshaphalaAge5', safe(() => computeVarshaphala(d, 5, loc)));
    c.put('tithiPraveshaAge30', safe(() => computeTithiPravesha(d, 30, loc)));
    c.put('tithiPraveshaAge5', safe(() => computeTithiPravesha(d, 5, loc)));

    c.put('kpCuspalSubLords', safe(() => computeKpCuspalSubLords(d, loc)));
    c.put('kpSignificators', safe(() => computeKpSignificators(chart)));
    c.put('prashnaChart', safe(() => computePrashnaChart(d, loc)));

    c.put('siderealSun', getSiderealSunLongitude(d, 'lahiri'));
    c.put('siderealMoon', moonSid);
    const ay = c.obj('ayanamsa');
    for (const a of AYANAMSAS) ay.put(a, getAyanamsa(d, a));
    ay.end();
    c.put('sunrise', safe(() => getSunrise(d, loc)));
    c.put('sunset', safe(() => getSunset(d, loc)));
    c.put('moonrise', safe(() => getMoonrise(d, loc)));
    c.put('moonset', safe(() => getMoonset(d, loc)));

    c.end();
  }

  charts.end();
}

function writeChartPairs(doc: Obj): void {
  const pairs = doc.obj('chartPairs');
  for (let i = 0; i < CHART_EVENTS.length; i++) {
    const a = CHART_EVENTS[i]!;
    const b = CHART_EVENTS[(i + 1) % CHART_EVENTS.length]!;
    const ca = computeRashiChart(new Date(a.iso), a.loc);
    const cb = computeRashiChart(new Date(b.iso), b.loc);
    pairs.put(`${a.name}|${b.name}`, safe(() => computeMangalCompatibility(ca, cb)));
  }
  pairs.end();
}

interface FixturePair { label: string; boy: NatalMoon; girl: NatalMoon }

// The synthetic pairs reach the optional NatalMoon fields (`lagnaRashi`,
// `navamsaRashi`, `nakshatraPada`) that no fixture pair carries.
function readFixturePairs(): FixturePair[] {
  const raw0 = readFileSync(join(REPO, 'testdata', 'charts', 'ashtakoot-pairs.json'), 'utf8');
  const parsed = JSON.parse(raw0) as { pairs: { label: string; boy: NatalMoon; girl: NatalMoon }[] };
  return parsed.pairs.map((p) => ({
    label: p.label,
    boy: { rashi: p.boy.rashi, nakshatra: p.boy.nakshatra },
    girl: { rashi: p.girl.rashi, nakshatra: p.girl.nakshatra },
  }));
}

const SYNTHETIC_PAIRS: readonly FixturePair[] = [
  {
    label: 'synthetic-1-full-natal-moon',
    boy: { rashi: 0, nakshatra: 0, lagnaRashi: 0, navamsaRashi: 0, nakshatraPada: 1 },
    girl: { rashi: 6, nakshatra: 13, lagnaRashi: 6, navamsaRashi: 6, nakshatraPada: 4 },
  },
  {
    label: 'synthetic-2-shared-lords',
    boy: { rashi: 2, nakshatra: 6, lagnaRashi: 5, navamsaRashi: 8, nakshatraPada: 2 },
    girl: { rashi: 5, nakshatra: 12, lagnaRashi: 2, navamsaRashi: 11, nakshatraPada: 3 },
  },
];

function writeMatching(doc: Obj): void {
  const m = doc.obj('matching');
  const all = [...readFixturePairs(), ...SYNTHETIC_PAIRS];
  for (const p of all) {
    const o = m.obj(p.label);
    o.put('ashtakoot', safe(() => computeAshtakoot(p.boy, p.girl)));
    o.put('ashtakootGana', safe(() => computeAshtakoot(p.boy, p.girl, { ganaCancellation: true })));
    o.put('pathuPorutham', safe(() => computePathuPorutham(p.boy, p.girl)));
    o.end();
  }
  m.end();
}

const MUHURTA_START_MS = Date.UTC(2025, 0, 1);
const MUHURTA_DAYS = 60;

function writeMuhurta(doc: Obj): void {
  const pune = geoOf(LOCATIONS[0]!);
  const mu = doc.obj('muhurta');

  const scores = mu.obj('scores');
  for (const id of STOCK_RULE_IDS) {
    const rule = STOCK_MUHURTA_RULES[id] as MuhurtaRule | undefined;
    if (!rule) throw new Error(`dump: STOCK_MUHURTA_RULES is missing "${id}"`);
    for (let i = 0; i < MUHURTA_DAYS; i++) {
      const ms = MUHURTA_START_MS + i * DAY_MS;
      scores.put(
        `${id}|${isoDay(ms)}`,
        safe(() => scoreMuhurta(new Date(ms), pune, rule, { timezone: 330 })),
      );
    }
  }
  scores.end();

  const start = new Date(MUHURTA_START_MS);
  const end = new Date(MUHURTA_START_MS + (MUHURTA_DAYS - 1) * DAY_MS);
  mu.put('vivahPasses', safe(() => computeAuspiciousDatesInRange(vivahRule, start, end, pune, { timezone: 330 })));
  mu.put('vivahAll', safe(() => computeAuspiciousDatesInRange(
    vivahRule, start, end, pune, { timezone: 330, includeFailures: true },
  )));
  mu.end();
}

function writeConvert(doc: Obj): void {
  const cv = doc.obj('convert');

  // The writers are strictly sequential: opening `roundTrip` before
  // `gregorianToHindu` is closed would interleave them into malformed JSON.
  const roundTrips: [string, unknown][] = [];
  const g2h = cv.obj('gregorianToHindu');
  for (const loc of LOCATIONS) {
    for (const ep of EPOCHS) {
      for (let i = 0; i < ep.days; i += 15) {
        const ms = ep.startMs + i * DAY_MS;
        const key = `${loc.name}|${isoDay(ms)}`;
        const opts = { timezone: loc.timezone };
        const h = safe(() => convertGregorianToHindu(new Date(ms), geoOf(loc), opts));
        g2h.put(key, h);
        if ('_error' in (h as object)) {
          roundTrips.push([key, null]);
        } else {
          const c = h as { vikramSamvat: number; masaIndex: number; paksha: 'shukla' | 'krishna'; pakshaTithi: number };
          roundTrips.push([key, safe(() => convertHinduToGregorian({
            vikramSamvat: c.vikramSamvat,
            masaIndex: c.masaIndex,
            paksha: c.paksha,
            pakshaTithi: c.pakshaTithi,
          }, geoOf(loc), opts))]);
        }
      }
    }
  }
  g2h.end();
  const rt = cv.obj('roundTrip');
  for (const [k, v] of roundTrips) rt.put(k, v);
  rt.end();

  const hny = cv.obj('hinduNewYear');
  const regions: readonly (FestivalRegion | LegacyFestivalRegion)[] = [...CANONICAL_REGIONS, ...LEGACY_REGIONS];
  for (const loc of [LOCATIONS[0]!, LOCATIONS[2]!]) {
    for (const ep of EPOCHS) {
      for (const r of regions) {
        hny.put(
          `${loc.name}|${ep.year}|${r}`,
          safe(() => getHinduNewYear(ep.year, r, geoOf(loc), { timezone: loc.timezone })),
        );
      }
    }
  }
  hny.end();

  // The dates straddle the Chaitra boundary, where both increment.
  const sv = cv.obj('samvat');
  for (const ep of EPOCHS) {
    for (const [mo, day] of [[0, 1], [2, 15], [2, 25], [3, 5], [11, 31]] as const) {
      const d = new Date(Date.UTC(ep.year, mo, day));
      sv.put(`${ep.year}|${isoDay(d.getTime())}`, {
        samvat: safe(() => computeSamvat(d)),
        kaliYuga: safe(() => getKaliYugaYear(d)),
      });
    }
  }
  sv.end();

  cv.end();
}

function writePolar(doc: Obj): void {
  const p = doc.obj('polar');
  for (const w of POLAR_WINDOWS) {
    for (let i = 0; i < w.days; i++) {
      const ms = w.startMs + i * DAY_MS;
      const d = new Date(ms);
      const key = `${w.name}|${isoDay(ms)}`;
      const o = p.obj(key);
      o.put('daily', safe(() => getDailyPanchang(d, geoOf(POLAR), REDUCED
        ? { timezone: POLAR.timezone, sections: G2_SECTIONS }
        : { timezone: POLAR.timezone })));
      o.put('instant', safe(() => {
        const r = getInstantPanchang(d, geoOf(POLAR));
        if (REDUCED && r !== null) return { ...r, festivals: [] };
        return r;
      }));
      o.put('sunrise', safe(() => getSunrise(d, geoOf(POLAR))));
      o.put('sunset', safe(() => getSunset(d, geoOf(POLAR))));
      o.put('moonrise', safe(() => getMoonrise(d, geoOf(POLAR))));
      o.put('moonset', safe(() => getMoonset(d, geoOf(POLAR))));
      if (STAGE === 'full') {
        o.put('convert', safe(() => convertGregorianToHindu(d, geoOf(POLAR), { timezone: POLAR.timezone })));
      }
      o.end();
    }
  }
  p.end();
}

function writeConstants(doc: Obj): void {
  const k = doc.obj('constants');
  k.put('GRAHA_ABBR', GRAHA_ABBR);
  k.put('ASHTOTTARI_ORDER', ASHTOTTARI_ORDER);
  k.put('ASHTOTTARI_YEARS', ASHTOTTARI_YEARS);
  k.put('YOGINI_ORDER', YOGINI_ORDER);
  k.put('YOGINI_YEARS', YOGINI_YEARS);
  k.put('YOGINI_PLANET', YOGINI_PLANET);
  k.put('CHARA_RASHI_YEARS', CHARA_RASHI_YEARS);
  k.put('VISHAMA_PADA_RASHIS', VISHAMA_PADA_RASHIS);
  k.put('SAMA_PADA_RASHIS', SAMA_PADA_RASHIS);
  k.put('ALL_SAHAM_NAMES', ALL_SAHAM_NAMES);
  const sr = k.obj('STOCK_MUHURTA_RULES');
  for (const id of STOCK_RULE_IDS) sr.put(id, STOCK_MUHURTA_RULES[id]);
  sr.end();
  k.end();
}

const FORMAT_CASES: readonly { iso: string; offset: number }[] = [
  { iso: '2025-01-14T01:39:44.172Z', offset: 330 },
  { iso: '2025-01-14T01:39:44.172Z', offset: 0 },
  { iso: '2025-01-14T01:39:44.172Z', offset: -300 },
  { iso: '2025-01-14T01:39:44.172Z', offset: -270 },
  { iso: '2025-06-30T23:59:59.999Z', offset: 840 },
  { iso: '2025-06-30T23:59:59.999Z', offset: -720 },
  { iso: '1912-06-01T00:00:00.000Z', offset: 330 },
  { iso: '0999-03-04T12:34:56.789Z', offset: 60 },    // year < 1000 zero-padding
  { iso: '0099-12-31T23:00:00.000Z', offset: -60 },
  { iso: '2088-06-01T00:00:00.000Z', offset: 345 },   // Nepal's +05:45
];

function writeHelpers(doc: Obj): void {
  const h = doc.obj('helpers');

  const fmt = h.obj('formatInZone');
  for (const c of FORMAT_CASES) {
    fmt.put(`${c.iso}|${c.offset}`, safe(() => formatInZone(new Date(c.iso), c.offset)));
  }
  fmt.end();

  const vty = h.obj('varaTithiYogas');
  for (let v = 0; v < 7; v++) {
    for (let t = 0; t < 30; t++) vty.put(`${v}|${t}`, safe(() => computeVaraTithiYogas(v, t)));
  }
  vty.end();

  // 0.37° is coprime with every sub-lord boundary, so the sweep hits all 249.
  const kp = h.arr('kpSubLord');
  for (let x = 0; x < 360; x += 0.37) kp.push(safe(() => computeKpSubLord(x)));
  kp.end();

  const pk = h.obj('panchaka');
  for (let x = 0; x < 360; x += 1.13) {
    pk.put(x.toFixed(2), safe(() => computePanchaka(x)));
  }
  for (let v = 0; v < 7; v++) {
    const type = classifyPanchaka(v) as PanchakaType;
    pk.put(`classify|${v}`, { type, isDosha: isPanchakaDosha(type) });
  }
  pk.end();

  const dg = h.obj('dignity');
  for (const g of GRAHAS) {
    for (let r = 0; r < 12; r++) dg.put(`${g}|${r}`, safe(() => computeDignity(g, r)));
  }
  dg.end();

  const cb = h.obj('chandraBalam');
  for (let j = 0; j < 12; j++) {
    for (let t = 0; t < 12; t++) {
      cb.put(`${j}|${t}|en`, safe(() => computeChandraBalam(j, t, 'en')));
      cb.put(`${j}|${t}|hi`, safe(() => computeChandraBalam(j, t, 'hi')));
    }
  }
  cb.end();

  const tb = h.obj('tarabala');
  for (let j = 0; j < 27; j++) {
    for (let t = 0; t < 27; t++) {
      tb.put(`${j}|${t}|en`, safe(() => computeTarabala(j, t, 'en')));
      tb.put(`${j}|${t}|hi`, safe(() => computeTarabala(j, t, 'hi')));
    }
  }
  tb.end();

  h.end();
}

// A fixed token rather than a rounded rendering: two languages agreeing on a
// rounding would itself be a claim, and the claim here is about the other bytes.
function maskEclipseFloats(json: string): string {
  return json
    .replace(/("obscuration": )-?[0-9.eE+-]+/g, '$1<float>')
    .replace(/("magnitude": )-?[0-9.eE+-]+/g, '$1<float>');
}

// The tables are gated with `cmp`; their sha256s also go into the diff
// document, so a `diff.mjs` run notices a regression and `cmp` says where.
function writeTables(doc: Obj): void {
  const pune = geoOf(LOCATIONS[0]!);
  const dir = join(OUT, `tables-${LABEL}`);
  mkdirSync(dir, { recursive: true });

  const hashes = doc.obj('tables');
  for (const ep of EPOCHS) {
    const y = ep.year;
    const files: [string, unknown][] = [
      [`festivals-${y}.json`, buildFestivalsTable({
        location: pune, timezoneOffsetMinutes: 330, startYear: y, endYear: y,
        referenceLocation: 'Pune', generatedAt: PINNED_GENERATED_AT,
      })],
      [`eclipses-${y}.json`, buildEclipsesTable({
        location: pune, timezoneOffsetMinutes: 330, startYear: y, endYear: y,
        referenceLocation: 'Pune', generatedAt: PINNED_GENERATED_AT,
      })],
      [`moonPhases-${y}.json`, buildMoonPhasesTable({
        timezoneOffsetMinutes: 330, startYear: y, endYear: y,
        referenceLocation: 'Pune', generatedAt: PINNED_GENERATED_AT,
      })],
      [`muhurta-${y}.json`, buildMuhurtaTable({
        rule: vivahRule, location: pune, timezoneOffsetMinutes: 330, startYear: y, endYear: y,
        referenceLocation: 'Pune', generatedAt: PINNED_GENERATED_AT,
      })],
    ];
    for (const [name, file] of files) {
      const path = join(dir, name);
      // Byte-for-byte the serialization generate/generate-*.ts use.
      const json = JSON.stringify(file, null, 2) + '\n';
      writeFileSync(path, json, 'utf8');
      // `obscuration` and `magnitude` end in the platform's asin/sqrt and can
      // never be bit-identical between V8 and Go, so the hash covers every byte
      // but those digits; the digits are compared numerically on the Go side.
      if (name.startsWith('eclipses-')) {
        hashes.put(`${name}|floats-masked`,
          createHash('sha256').update(maskEclipseFloats(json), 'utf8').digest('hex'));
      } else {
        hashes.put(name, sha256OfFile(path));
      }
    }
  }
  hashes.end();
}

function main(): void {
  const doc = new Obj();
  writeMeta(doc);
  writeDaily(doc);
  writeInstant(doc);
  // Section order is part of the contract, so sections are gated here in place.
  if (STAGE === 'full') writeYearly(doc);
  writePolar(doc);
  if (CHARTS_IN) {
    writeCharts(doc);
    writeChartPairs(doc);
    writeMatching(doc);
  }
  if (STAGE === 'full') {
    writeMuhurta(doc);
    writeConvert(doc);
    writeConstants(doc);
    writeHelpers(doc);
    writeTables(doc);
  }
  doc.end();
  raw('\n');
  flush();
}

main();
