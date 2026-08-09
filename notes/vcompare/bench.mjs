/**
 * One configuration, one process, one implementation — set by PT_MODULE.
 *
 * Both sides are the *published artifact*: v4.3.1 from npm, v5.0.0 from
 * dist/index.cjs. Benching source for one and a tarball for the other would
 * confound the comparison with build settings.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
/** PT_MODULE may be relative to the cwd the harness is invoked from. */
const target = process.env.PT_MODULE.startsWith('.') || !process.env.PT_MODULE.startsWith('/')
  ? resolve(process.cwd(), process.env.PT_MODULE)
  : process.env.PT_MODULE;
const M = require(target);

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const TZ = 330;
const DAY = 86_400_000;
const MEASURE_START = Date.UTC(2024, 0, 1);
const MEASURE_DAYS = 1200;
const WARMUP_START = Date.UTC(1980, 0, 1);
const WARMUP_DAYS = 250;

const days = (start, n) => Array.from({ length: n }, (_, i) => new Date(start + i * DAY));

const cold = (fn) => {
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
};
const warm = (fn, reps = 2000) => ({
  warm: () => { for (let i = 0; i < 500; i++) fn(); },
  run: () => {
    const t0 = performance.now();
    for (let i = 0; i < reps; i++) fn();
    return (performance.now() - t0) / reps;
  },
});
const unit = (fn, reps, warmReps = 3) => ({
  warm: () => { for (let i = 0; i < warmReps; i++) fn(-1 - i); },
  run: () => {
    const t0 = performance.now();
    for (let i = 0; i < reps; i++) fn(i);
    return (performance.now() - t0) / reps;
  },
});

const ALL = ['festivals', 'eclipse', 'moonTimes', 'lunarWindows'];
const WARM_DAY = new Date('2025-07-04');
const WARM_INSTANT = new Date('2025-07-04T06:00:00Z');
const BIRTH = new Date('1990-05-15T10:30:00Z');
const CHART = M.computeRashiChart(BIRTH, PUNE);

const CONFIGS = {
  'cold/default': () => cold((d) => { M.getDailyPanchang(d, PUNE, { timezone: TZ }); }),
  'cold/no-end': () => cold((d) => { M.getDailyPanchang(d, PUNE, { timezone: TZ, computeEndTimes: false }); }),
  // The two `sections` shapes the README quotes. Not like-for-like against
  // published 4.3.1 — it has no `sections` option, so it runs them in full —
  // but the v5 column is what the README needs and the 4.x column is `n/a`.
  'cold/no-festivals': () => cold((d) => { M.getDailyPanchang(d, PUNE, { timezone: TZ, sections: ['eclipse', 'moonTimes', 'lunarWindows'] }); }),
  'cold/festivals+eclipse': () => cold((d) => { M.getDailyPanchang(d, PUNE, { timezone: TZ, sections: ['festivals', 'eclipse'] }); }),
  'cold/sections-empty': () => cold((d) => { M.getDailyPanchang(d, PUNE, { timezone: TZ, sections: [] }); }),
  'cold/sections-empty+no-end': () => cold((d) => { M.getDailyPanchang(d, PUNE, { timezone: TZ, sections: [], computeEndTimes: false }); }),
  'cold/all+no-end': () => cold((d) => { M.getDailyPanchang(d, PUNE, { timezone: TZ, sections: ALL, computeEndTimes: false }); }),
  'cold/instant': () => cold((d) => { M.getInstantPanchang(new Date(d.getTime() + 6 * 3600_000), PUNE); }),

  'warm/default': () => warm(() => { M.getDailyPanchang(WARM_DAY, PUNE, { timezone: TZ }); }),
  'warm/no-end': () => warm(() => { M.getDailyPanchang(WARM_DAY, PUNE, { timezone: TZ, computeEndTimes: false }); }),
  'warm/sections-empty+no-end': () => warm(() => { M.getDailyPanchang(WARM_DAY, PUNE, { timezone: TZ, sections: [], computeEndTimes: false }); }),
  'warm/instant': () => warm(() => { M.getInstantPanchang(WARM_INSTANT, PUNE); }),

  'range/ekadashi': () => unit((i) => { M.getEkadashiDatesForYear(2030 + (((i % 20) + 20) % 20), PUNE, { timezone: TZ }); }, 20),
  'range/sankranti': () => unit((i) => { M.getSankrantisForYear(2030 + (((i % 20) + 20) % 20), PUNE, { timezone: TZ }); }, 20),
  'range/festivals': () => unit((i) => {
    const y = 2030 + (((i % 10) + 10) % 10);
    M.getFestivalsInRange(new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y, 11, 31)), PUNE, { timezone: TZ });
  }, 10, 1),

  'chart/rashi': () => unit((i) => { M.computeRashiChart(new Date(BIRTH.getTime() + i * 1000), PUNE); }, 300, 30),
  'chart/navamsa': () => unit((i) => { M.computeNavamsa(new Date(BIRTH.getTime() + i * 1000), PUNE); }, 300, 30),
  'chart/bhava': () => unit((i) => { M.computeBhava(new Date(BIRTH.getTime() + i * 1000), PUNE); }, 300, 30),
  'chart/shadbala': () => unit((i) => { M.computeShadbala(new Date(BIRTH.getTime() + i * 1000), PUNE); }, 300, 30),
  'chart/bhavabala': () => unit((i) => { M.computeBhavaBala(new Date(BIRTH.getTime() + i * 1000), PUNE); }, 300, 30),
  // Controls: pure arithmetic on a prebuilt chart, no ephemeris. Should not move.
  'ctrl/ashtakavarga': () => unit(() => { M.computeAshtakavarga(CHART); }, 2000, 200),
  'ctrl/yogas': () => unit(() => { M.computeYogas(CHART); }, 2000, 200),

  'prim/sunrise': () => cold((d) => { M.getSunrise(d, PUNE); }),
  'prim/sunset': () => cold((d) => { M.getSunset(d, PUNE); }),
  'prim/moonrise': () => cold((d) => { M.getMoonrise(d, PUNE); }),
  'prim/moonset': () => cold((d) => { M.getMoonset(d, PUNE); }),
};

const name = process.argv[2];
if (name === '--list') console.log(Object.keys(CONFIGS).join('\n'));
else {
  const r = CONFIGS[name]();
  r.warm();
  console.log(r.run().toFixed(5));
}
