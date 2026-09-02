import { Body, SearchRiseSet, MakeTime, Observer } from 'astronomy-engine';
import { getMoonrise, getMoonset } from './src/astronomy/moonrise';

const LOCS = [
  ['Pune', 18.5204, 73.8567], ['NYC', 40.7128, -74.006], ['London', 51.5074, -0.1278],
  ['Sydney', -33.8688, 151.2093], ['Reykjavik', 64.1466, -21.9426], ['Tromso', 69.6492, 18.9553],
  ['Longyearbyen', 78.2232, 15.6267], ['Ushuaia', -54.8019, -68.3030], ['Quito', -0.1807, -78.4678],
  ['McMurdo', -77.8419, 166.6863], ['Anchorage', 61.2181, -149.9003], ['Chennai', 13.0827, 80.2707],
] as const;

const DAY = 86_400_000;
let compared = 0, missing = 0, wrongEvent = 0, maxJitter = 0, worst = '';
const BIG = 3600_000; // >1h apart => a DIFFERENT event, not jitter

for (const [name, lat, lon] of LOCS) {
  const loc = { latitude: lat, longitude: lon };
  const observer = new Observer(lat, lon, 0);
  for (const base of [Date.UTC(2024, 0, 1), Date.UTC(1950, 0, 1), Date.UTC(2090, 0, 1)]) {
    const n = base === Date.UTC(2024, 0, 1) ? 800 : 400;
    for (let i = 0; i < n; i++) {
      // Jitter depends on the start instant within the day, so probe several.
      for (const frac of [0, 0.137, 0.5, 0.813]) {
        const from = new Date(base + i * DAY + Math.round(frac * DAY));
        for (const dir of [+1, -1] as const) {
          const cached = dir === 1 ? getMoonrise(from, loc, 2) : getMoonset(from, loc, 2);
          const raw = SearchRiseSet(Body.Moon, observer, dir, MakeTime(from), 2);
          const rawMs = raw ? raw.date.getTime() : null;
          compared++;
          if ((cached === null) !== (rawMs === null)) {
            missing++;
            if (missing <= 5) console.log(`NULL MISMATCH ${name} ${from.toISOString()} dir=${dir} cached=${cached?.toISOString() ?? 'null'} raw=${raw?.date.toISOString() ?? 'null'}`);
            continue;
          }
          if (cached === null || rawMs === null) continue;
          const d = Math.abs(cached.getTime() - rawMs);
          if (d > BIG) {
            wrongEvent++;
            if (wrongEvent <= 5) console.log(`DIFFERENT EVENT ${name} ${from.toISOString()} dir=${dir} cached=${cached.toISOString()} raw=${new Date(rawMs).toISOString()} Δ=${(d/60000).toFixed(1)}min`);
          } else if (d > maxJitter) {
            maxJitter = d; worst = `${name} ${from.toISOString()} dir=${dir}`;
          }
        }
      }
    }
  }
}
console.log(`\ncompared=${compared}  nullMismatch=${missing}  differentEvent=${wrongEvent}`);
console.log(`max jitter (same event) = ${maxJitter} ms   worst: ${worst}`);
