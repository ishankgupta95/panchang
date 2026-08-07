/**
 * Dumps a wide sweep of library output as JSON so two builds of the working
 * tree can be diffed numerically. Used to measure a predicted delta against the
 * observed one without ever asking a test to adjudicate.
 *
 * Usage: node dump.mjs > out.json
 */
import { getDailyPanchang, getInstantPanchang } from './src/index';
import { getFestivalsInRange, getEkadashiDatesForYear, getSankrantisForYear } from './src/calendar/yearly';
import { computeRashiChart, computeNavamsa } from './src/jyotish/charts';
import { computeBhava } from './src/jyotish/bhava';
import { computeShadbala, computeBhavaBala } from './src/jyotish/shadbala';
import { computeAshtakavarga } from './src/jyotish/ashtakavarga';
import { computeYogas } from './src/jyotish/yogas';
import type { PanchangSection } from './src/types/options';

const LOCATIONS = [
  { name: 'Pune', latitude: 18.5204, longitude: 73.8567, tz: 330 },
  { name: 'NYC', latitude: 40.7128, longitude: -74.006, tz: -300 },
  { name: 'London', latitude: 51.5074, longitude: -0.1278, tz: 0 },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, tz: 600 },
  { name: 'Reykjavik', latitude: 64.1466, longitude: -21.9426, tz: 0 },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, tz: 330 },
];

const SHAPES: { label: string; sections?: readonly PanchangSection[]; endTimes: boolean }[] = [
  { label: 'full', endTimes: true },
  { label: 'full-noend', endTimes: false },
  { label: 'bare', sections: [], endTimes: true },
  { label: 'bare-noend', sections: [], endTimes: false },
  { label: 'fest-eclipse-noend', sections: ['festivals', 'eclipse'], endTimes: false },
];

const DAY = 86_400_000;
// 3 spans: a 2025 stretch, a 1912 stretch, a 2088 stretch — so the sweep is not
// all near the present.
const SPANS = [
  { start: Date.UTC(2025, 0, 1), days: 200 },
  { start: Date.UTC(1912, 5, 1), days: 60 },
  { start: Date.UTC(2088, 8, 1), days: 60 },
];

const out: Record<string, unknown> = {};

for (const loc of LOCATIONS) {
  const geo = { latitude: loc.latitude, longitude: loc.longitude };
  for (const span of SPANS) {
    for (let i = 0; i < span.days; i++) {
      const d = new Date(span.start + i * DAY);
      for (const shape of SHAPES) {
        const r = getDailyPanchang(d, geo, {
          timezone: loc.tz,
          computeEndTimes: shape.endTimes,
          ...(shape.sections === undefined ? {} : { sections: shape.sections }),
        });
        out[`daily|${loc.name}|${d.toISOString().slice(0, 10)}|${shape.label}`] = r;
      }
      out[`instant|${loc.name}|${d.toISOString().slice(0, 10)}`] =
        getInstantPanchang(new Date(d.getTime() + 7 * 3600_000), geo);
    }
  }
  out[`festivals|${loc.name}|2025`] = getFestivalsInRange(
    new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2025, 11, 31)), geo, { timezone: loc.tz },
  );
  out[`ekadashi|${loc.name}|2025`] = getEkadashiDatesForYear(2025, geo, { timezone: loc.tz });
  out[`sankranti|${loc.name}|2025`] = getSankrantisForYear(2025, geo, { timezone: loc.tz });
}

/**
 * Birth charts — the half of the library the daily sweep above cannot see.
 *
 * Everything before this point reads the Sun and the Moon. **Nothing before this
 * point reads a planet**, so a change confined to the planetary path produced an
 * empty `diff.mjs` report and looked output-neutral when it was not. That hole
 * was found while separating the Earth series for the planet path in Phase 36,
 * where the whole question was how far Mercury and Venus moved.
 *
 * The nativities span 1912–2088 and both hemispheres so the sweep exercises the
 * series across its range rather than around 2000, and the surface is the whole
 * chart stack: positions and houses (which carry the longitudes directly),
 * Navamsa (which multiplies a longitude by nine and so amplifies any movement),
 * Shadbala and Bhava Bala (continuous scores), and Ashtakavarga and the yoga
 * catalogue — those last two being *discrete*, which is what makes them worth
 * dumping: a benefic-point count or a yoga name that moves is an invariant
 * break, and `diff.mjs` reports it at zero tolerance.
 */
const NATIVITIES = [
  { name: 'pune-1990', utc: '1990-05-15T10:30:00Z', latitude: 18.5204, longitude: 73.8567 },
  { name: 'nyc-1965', utc: '1965-11-02T23:47:00Z', latitude: 40.7128, longitude: -74.006 },
  { name: 'sydney-1912', utc: '1912-06-21T04:05:00Z', latitude: -33.8688, longitude: 151.2093 },
  { name: 'london-2025', utc: '2025-03-19T18:12:00Z', latitude: 51.5074, longitude: -0.1278 },
  { name: 'chennai-2088', utc: '2088-09-09T02:20:00Z', latitude: 13.0827, longitude: 80.2707 },
];

for (const n of NATIVITIES) {
  const when = new Date(n.utc);
  const geo = { latitude: n.latitude, longitude: n.longitude };
  const chart = computeRashiChart(when, geo);
  out[`chart|${n.name}|rashi`] = chart;
  out[`chart|${n.name}|navamsa`] = computeNavamsa(when, geo);
  out[`chart|${n.name}|bhava`] = computeBhava(when, geo);
  out[`chart|${n.name}|shadbala`] = computeShadbala(when, geo);
  out[`chart|${n.name}|bhavabala`] = computeBhavaBala(when, geo);
  out[`chart|${n.name}|ashtakavarga`] = computeAshtakavarga(chart);
  out[`chart|${n.name}|yogas`] = computeYogas(chart);
}

process.stdout.write(JSON.stringify(out));
