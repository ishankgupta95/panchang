// TT comes from the fixture's own deltaTSeconds, not either library's ΔT model.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const target = process.env.PT_MODULE.startsWith('.') || !process.env.PT_MODULE.startsWith('/')
  ? resolve(process.cwd(), process.env.PT_MODULE)
  : process.env.PT_MODULE;
const M = require(target);
const canon = require(new URL('../../../testdata/reference/nasa-eclipses.json', import.meta.url).pathname);

const VARANASI = { latitude: 25.3176, longitude: 82.9739 };
const DAY = 86_400_000;
const JD_UNIX = 2440587.5;
const toJdTt = (d, deltaTSeconds) => JD_UNIX + (d.getTime() + deltaTSeconds * 1000) / DAY;
const TYPE = { T: 'total', P: 'partial', N: 'penumbral' };

let n = 0, notFound = 0, typeMiss = 0;
let worstPeak = 0, worstAt = '', sumAbs = 0, sumSigned = 0;
let worstMag = 0;
for (const row of canon.lunar) {
  const greatestUtcMs = (row.jdGreatestTt - JD_UNIX) * DAY - row.deltaTSeconds * 1000;
  const e = M.getUpcomingLunarEclipse(new Date(greatestUtcMs - 3 * DAY), VARANASI, 8);
  if (!e) { notFound++; continue; }
  n++;
  const d = (toJdTt(new Date(e.peak), row.deltaTSeconds) - row.jdGreatestTt) * 86400;
  sumAbs += Math.abs(d); sumSigned += d;
  if (Math.abs(d) > Math.abs(worstPeak)) { worstPeak = d; worstAt = row.date; }
  if (e.subtype !== TYPE[row.kind]) typeMiss++;
  // `magnitude` is the umbral magnitude, clamped at 1 for total eclipses.
  if (row.kind === 'P' && typeof e.magnitude === 'number') {
    worstMag = Math.max(worstMag, Math.abs(e.magnitude - row.umbralMagnitude));
  }
}
console.log(`matched ${n}/${canon.lunar.length}  notFound ${notFound}`);
console.log(`type mismatches      ${typeMiss}`);
console.log(`greatest eclipse     max |Δ| ${Math.abs(worstPeak).toFixed(2)} s (${worstAt}), mean |Δ| ${(sumAbs / n).toFixed(2)} s, bias ${(sumSigned / n).toFixed(2)} s`);
console.log(`umbral magnitude     max |Δ| ${worstMag.toFixed(4)} (partial eclipses only)`);
