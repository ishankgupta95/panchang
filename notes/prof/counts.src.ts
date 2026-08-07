import { getDailyPanchang } from './src/index';
import { COUNTS, resetCounts } from 'astronomy-engine-shim';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const DAY = 86_400_000;
const N = 365;
// warm up on disjoint days so module caches are in a steady state, then count
// a clean 365-day scan — the same shape notes/v5-audit.md profiled.
for (let i = 0; i < 120; i++) getDailyPanchang(new Date(Date.UTC(1980, 0, 1) + i * DAY), PUNE, { timezone: 330 });
resetCounts();
for (let i = 0; i < N; i++) getDailyPanchang(new Date(Date.UTC(2024, 0, 1) + i * DAY), PUNE, { timezone: 330 });
const rows = Object.entries(COUNTS).sort((a, b) => b[1] - a[1]);
console.log(`ephemeris calls per day, default getDailyPanchang, ${N}-day scan\n`);
for (const [k, v] of rows) console.log(`  ${k.padEnd(24)} ${(v / N).toFixed(2)}`);
