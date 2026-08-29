/**
 * Reference-almanac parity for either implementation. The almanac prints whole
 * minutes, so `secs` compares against the printed minute's midpoint (+30 s).
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const target = process.env.PT_MODULE.startsWith('.') || !process.env.PT_MODULE.startsWith('/')
  ? resolve(process.cwd(), process.env.PT_MODULE)
  : process.env.PT_MODULE;
const M = require(target);
const fx = require(new URL('../../../testdata/almanac/almanac-verified.json', import.meta.url).pathname);
const all = fx.fixtures ?? fx;

const secs = (hhmm) => {
  const next = hhmm.endsWith('+1');
  const core = next ? hhmm.slice(0, -2) : hhmm;
  const [h, m] = core.split(':').map(Number);
  return (next ? 86400 : 0) + h * 3600 + m * 60 + 30;
};
const localSecs = (iso, date) => {
  const dayDelta = Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
  const t = iso.slice(11, 19).split(':').map(Number);
  return dayDelta * 86400 + t[0] * 3600 + t[1] * 60 + t[2];
};
// v4 published the instant already shifted by the UTC offset, so its
// `toISOString()` is local wall clock and must NOT be shifted again: doing so
// reads as a 5h30m parity error at IST, not a units mistake.
const localIso = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  return v.toISOString();
};

const worst = {};
const n = {};
for (const f of all) {
  const r = M.getDailyPanchang(new Date(`${f.date}T12:00:00Z`), f.location, { timezone: f.timezone });
  if (!r) continue;
  const g = r.angas ?? r;                              // v5 groups, v4 is flat
  const pick = (arr, key) => {
    const e = arr && arr[0];
    if (!e) return null;
    return e[key] !== undefined ? e[key] : null;
  };
  const cases = [
    ['tithi', g.tithis, f.expected.tithiEndHHMM],
    ['nakshatra', g.nakshatras, f.expected.nakshatraEndHHMM],
    ['yoga', g.yogas, f.expected.yogaEndHHMM],
    ['karana', g.karanas, f.expected.karanaEndHHMM],
  ];
  for (const [el, arr, exp] of cases) {
    if (!exp) continue;
    const raw = pick(arr, 'endTimeLocal') ?? pick(arr, 'endTime');
    const iso = localIso(raw);
    if (!iso) continue;
    const d = Math.abs(localSecs(iso, f.date) - secs(exp));
    worst[el] = Math.max(worst[el] ?? 0, d);
    n[el] = (n[el] ?? 0) + 1;
  }
}
for (const k of ['tithi', 'nakshatra', 'yoga', 'karana']) {
  console.log(k.padEnd(10), Math.round(worst[k] ?? -1), 's   (n=' + (n[k] ?? 0) + ')');
}
