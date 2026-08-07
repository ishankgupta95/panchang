import { getDailyPanchang } from './src/index';
const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const DAY = 86_400_000;
// Same shape notes/v5-audit.md profiled: a 4,000-day calendar scan, all sections.
for (let i = 0; i < 200; i++) getDailyPanchang(new Date(Date.UTC(1980, 0, 1) + i * DAY), PUNE, { timezone: 330 });
const t0 = performance.now();
for (let i = 0; i < 4000; i++) getDailyPanchang(new Date(Date.UTC(2010, 0, 1) + i * DAY), PUNE, { timezone: 330 });
console.error(`4000-day scan: ${((performance.now() - t0) / 4000).toFixed(4)} ms/day`);
