/**
 * Minimum interval between consecutive same-kind lunar events, measured rather
 * than assumed — this is what sets the second-event probe window.
 * Also counts how often a UTC day actually holds two same-kind events.
 */
import { Body, SearchRiseSet, MakeTime, Observer } from 'astronomy-engine';

const LOCS = [
  ['Pune', 18.5204, 73.8567], ['NYC', 40.7128, -74.006], ['London', 51.5074, -0.1278],
  ['Sydney', -33.8688, 151.2093], ['Reykjavik', 64.1466, -21.9426], ['Tromso', 69.6492, 18.9553],
  ['Longyearbyen', 78.2232, 15.6267], ['Ushuaia', -54.8019, -68.3030], ['Quito', -0.1807, -78.4678],
  ['McMurdo', -77.8419, 166.6863], ['Anchorage', 61.2181, -149.9003], ['Alert', 82.5018, -62.3481],
] as const;

const DAY = 86_400_000;
for (const dir of [+1, -1] as const) {
  let minInterval = Infinity, worst = '', doubleDays = 0, totalDays = 0, events = 0;
  for (const [name, lat, lon] of LOCS) {
    const observer = new Observer(lat, lon, 0);
    for (const base of [Date.UTC(2024, 0, 1), Date.UTC(1950, 0, 1), Date.UTC(2090, 0, 1)]) {
      let t = new Date(base);
      const endMs = base + 900 * DAY;
      let prev: number | null = null;
      const perDay = new Map<number, number>();
      for (let guard = 0; guard < 2000 && t.getTime() < endMs; guard++) {
        const e = SearchRiseSet(Body.Moon, observer, dir, MakeTime(t), 5);
        if (!e) break;
        const ms = e.date.getTime();
        events++;
        if (prev !== null) {
          const gap = ms - prev;
          if (gap < minInterval) { minInterval = gap; worst = `${name} ${new Date(prev).toISOString()}`; }
        }
        const d = Math.floor(ms / DAY);
        perDay.set(d, (perDay.get(d) ?? 0) + 1);
        prev = ms;
        t = new Date(ms + 1000);
      }
      for (const [, c] of perDay) { totalDays++; if (c > 1) doubleDays++; }
    }
  }
  console.log(`dir=${dir === 1 ? 'rise' : 'set'}  events=${events}  minInterval=${(minInterval / 3600_000).toFixed(3)} h  (${worst})`);
  console.log(`   UTC days holding 2 same-kind events: ${doubleDays} of ${totalDays}`);
}
