/**
 * Does narrowing `sections` still skip work? Measured two ways, because the
 * module-level caches added in 36.1 make the two answers different.
 */
import { getDailyPanchang } from './src/index';
import type { PanchangSection } from './src/types/options';
const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const DAY = 86_400_000;

function warmRatio(): number {
  const day = new Date('2025-07-04T06:30:00Z');
  const time = (sections?: readonly PanchangSection[]) => {
    const opts = { timezone: 330, computeEndTimes: false, ...(sections === undefined ? {} : { sections }) };
    for (let i = 0; i < 200; i++) getDailyPanchang(day, PUNE, opts);
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) getDailyPanchang(day, PUNE, opts);
    return performance.now() - t0;
  };
  let r = Infinity;
  for (let i = 0; i < 7; i++) r = Math.min(r, time([]) / time());
  return r;
}

function coldRatio(): number {
  // Distinct days, each computed once — a calendar scan, which is the shape the
  // `sections` option exists for.
  let cursor = 0;
  const days = (n: number) => Array.from({ length: n }, () => new Date(Date.UTC(2024, 0, 1) + (cursor++) * DAY));
  const time = (sections?: readonly PanchangSection[]) => {
    const opts = { timezone: 330, computeEndTimes: false, ...(sections === undefined ? {} : { sections }) };
    for (const d of days(100)) getDailyPanchang(d, PUNE, opts);
    const ds = days(600);
    const t0 = performance.now();
    for (const d of ds) getDailyPanchang(d, PUNE, opts);
    return performance.now() - t0;
  };
  let r = Infinity;
  for (let i = 0; i < 5; i++) r = Math.min(r, time([]) / time());
  return r;
}

console.log(`warm (same day repeated): ${warmRatio().toFixed(3)}`);
console.log(`cold (distinct days):     ${coldRatio().toFixed(3)}`);
