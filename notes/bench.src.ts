/**
 * v5 performance harness — ONE configuration per process.
 *
 * Module-level caches (sunrise EVENT_CACHE, and after 36.1a the Chebyshev
 * block store) survive for the life of the process, so "cold" can only be
 * measured honestly by giving each configuration its own process and walking
 * each day exactly once. `driver.mjs` spawns this repeatedly and takes a median
 * across processes.
 *
 * Usage: node bench.mjs <configName>
 */
import { getDailyPanchang, getInstantPanchang } from './src/index';
import { getEkadashiDatesForYear, getSankrantisForYear, getFestivalsInRange } from './src/calendar/yearly';
import { computeShadbala, computeBhavaBala } from './src/jyotish/shadbala';
import { computeSunrise, computeSunset } from './src/astronomy/sunrise';
import { getMoonrise, getMoonset } from './src/astronomy/moonrise';
import type { PanchangSection } from './src/types/options';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const TZ = 330;
const DAY = 86_400_000;

/** Days the measurement walks: 1200 consecutive days from 2024-01-01. */
const MEASURE_START = Date.UTC(2024, 0, 1);
const MEASURE_DAYS = 1200;
/** Disjoint warm-up stretch, only there to get the JIT to steady state. */
const WARMUP_START = Date.UTC(1980, 0, 1);
const WARMUP_DAYS = 250;

const days = (start: number, n: number): Date[] =>
  Array.from({ length: n }, (_, i) => new Date(start + i * DAY));

interface Runner { warm: () => void; run: () => number }

/** A cold configuration: warm the JIT on disjoint days, then walk each day once. */
function cold(fn: (d: Date) => void): Runner {
  const warmDays = days(WARMUP_START, WARMUP_DAYS);
  const measureDays = days(MEASURE_START, MEASURE_DAYS);
  return {
    warm: () => { for (const d of warmDays) fn(d); },
    run: () => {
      const t0 = performance.now();
      for (const d of measureDays) fn(d);
      return (performance.now() - t0) / MEASURE_DAYS;
    },
  };
}

/** A warm configuration: the same input repeated, after a warm-up pass. */
function warm(fn: () => void, reps = 2000): Runner {
  return {
    warm: () => { for (let i = 0; i < 500; i++) fn(); },
    run: () => {
      const t0 = performance.now();
      for (let i = 0; i < reps; i++) fn();
      return (performance.now() - t0) / reps;
    },
  };
}

/** A whole-unit configuration (one year, one chart): `reps` repeats. */
function unit(fn: (i: number) => void, reps: number, warmReps = 3): Runner {
  return {
    warm: () => { for (let i = 0; i < warmReps; i++) fn(-1 - i); },
    run: () => {
      const t0 = performance.now();
      for (let i = 0; i < reps; i++) fn(i);
      return (performance.now() - t0) / reps;
    },
  };
}

const ALL: readonly PanchangSection[] = ['festivals', 'eclipse', 'moonTimes', 'lunarWindows'];
const WARM_DAY = new Date('2025-07-04');
const WARM_INSTANT = new Date('2025-07-04T06:00:00Z');
const BIRTH = new Date('1990-05-15T10:30:00Z');

const CONFIGS: Record<string, () => Runner> = {
  // ── cold: distinct days, each computed once ────────────────────────────────
  'cold/default': () => cold((d) => { getDailyPanchang(d, PUNE, { timezone: TZ }); }),
  'cold/no-festivals': () => cold((d) => { getDailyPanchang(d, PUNE, { timezone: TZ, sections: ['eclipse', 'moonTimes', 'lunarWindows'] }); }),
  'cold/festivals+eclipse': () => cold((d) => { getDailyPanchang(d, PUNE, { timezone: TZ, sections: ['festivals', 'eclipse'] }); }),
  'cold/sections-empty': () => cold((d) => { getDailyPanchang(d, PUNE, { timezone: TZ, sections: [] }); }),
  'cold/sections-empty+no-end': () => cold((d) => { getDailyPanchang(d, PUNE, { timezone: TZ, sections: [], computeEndTimes: false }); }),
  'cold/all+no-end': () => cold((d) => { getDailyPanchang(d, PUNE, { timezone: TZ, sections: ALL, computeEndTimes: false }); }),
  'cold/instant': () => cold((d) => { getInstantPanchang(new Date(d.getTime() + 6 * 3600_000), PUNE); }),

  // ── warm: same day repeated ────────────────────────────────────────────────
  'warm/default': () => warm(() => { getDailyPanchang(WARM_DAY, PUNE, { timezone: TZ }); }),
  'warm/no-end': () => warm(() => { getDailyPanchang(WARM_DAY, PUNE, { timezone: TZ, computeEndTimes: false }); }),
  'warm/sections-empty+no-end': () => warm(() => { getDailyPanchang(WARM_DAY, PUNE, { timezone: TZ, sections: [], computeEndTimes: false }); }),
  'warm/instant': () => warm(() => { getInstantPanchang(WARM_INSTANT, PUNE); }),

  // ── range helpers, ms per year ─────────────────────────────────────────────
  'range/ekadashi': () => unit((i) => { getEkadashiDatesForYear(2030 + (((i % 20) + 20) % 20), PUNE, { timezone: TZ }); }, 20),
  'range/sankranti': () => unit((i) => { getSankrantisForYear(2030 + (((i % 20) + 20) % 20), PUNE, { timezone: TZ }); }, 20),
  'range/festivals': () => unit((i) => {
    const y = 2030 + (((i % 10) + 10) % 10);
    getFestivalsInRange(new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y, 11, 31)), PUNE, { timezone: TZ });
  }, 10, 1),

  // ── birth chart ────────────────────────────────────────────────────────────
  'chart/shadbala': () => unit((i) => { computeShadbala(new Date(BIRTH.getTime() + i * 1000), PUNE); }, 300, 30),
  'chart/bhavabala': () => unit((i) => { computeBhavaBala(new Date(BIRTH.getTime() + i * 1000), PUNE); }, 300, 30),

  // ── primitives, cold ───────────────────────────────────────────────────────
  'prim/sunrise': () => cold((d) => { computeSunrise(d, PUNE); }),
  'prim/sunset': () => cold((d) => { computeSunset(d, PUNE); }),
  'prim/moonrise': () => cold((d) => { getMoonrise(d, PUNE); }),
  'prim/moonset': () => cold((d) => { getMoonset(d, PUNE); }),
};

const name = process.argv[2];
if (name === '--list') {
  console.log(Object.keys(CONFIGS).join('\n'));
} else {
  const make = CONFIGS[name!];
  if (!make) { console.error(`unknown config ${String(name)}`); process.exit(2); }
  const r = make();
  r.warm();
  console.log(r.run().toFixed(5));
}
