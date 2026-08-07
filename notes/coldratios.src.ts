import { getDailyPanchang, getInstantPanchang } from './src/index';
import { getEclipseDuringDay } from './src/astronomy/eclipse';
import { computeSunrise, computeSunset } from './src/astronomy/sunrise';
import type { PanchangSection } from './src/types/options';
const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const ALL: readonly PanchangSection[] = ['festivals', 'eclipse', 'moonTimes', 'lunarWindows'];
const DAY = 86_400_000;
let cursor = 0;
const nextDays = (n: number) => Array.from({ length: n }, () => new Date(Date.UTC(2024, 0, 1) + (cursor++) * DAY));

function measureOver(fn: (d: Date) => void, warm = 30, runs = 150): number {
  for (const d of nextDays(warm)) fn(d);
  const days = nextDays(runs);
  const s = performance.now();
  for (const d of days) fn(d);
  return (performance.now() - s) / runs;
}
function ratioOf(n: (d: Date) => void, d: (d: Date) => void, attempts = 5): number {
  let best = Infinity;
  for (let i = 0; i < attempts; i++) { const dd = measureOver(d); const nn = measureOver(n); best = Math.min(best, nn / dd); }
  return best;
}
const full = (d: Date) => { getDailyPanchang(d, PUNE, { timezone: 330, sections: ALL, computeEndTimes: true }); };
const bare = (d: Date) => { getDailyPanchang(d, PUNE, { timezone: 330, sections: [], computeEndTimes: false }); };
const noFest = (d: Date) => { getDailyPanchang(d, PUNE, { timezone: 330, sections: ['eclipse', 'moonTimes', 'lunarWindows'], computeEndTimes: true }); };
const instant = (d: Date) => { getInstantPanchang(new Date(d.getTime() + 6 * 3600_000), PUNE); };
const eclipseOnly = (d: Date) => {
  const sr = computeSunrise(d, PUNE); const ns = computeSunrise(computeSunset(sr, PUNE), PUNE);
  getEclipseDuringDay(sr, ns, PUNE);
};
console.log(`bare/full     : ${ratioOf(bare, full).toFixed(3)}`);
console.log(`noFest/full   : ${ratioOf(noFest, full).toFixed(3)}`);
console.log(`instant/full  : ${ratioOf(instant, full).toFixed(3)}`);
console.log(`eclipseOnly/full: ${ratioOf(eclipseOnly, full).toFixed(3)}`);
