/**
 * The measurement behind `riseSet.ts`'s TRACK_BLOCK_DAYS and TRACK_NODES.
 *
 * Fits the body's equatorial-of-date rectangular position over a block of N UTC
 * days with M Chebyshev nodes, then compares the interpolant against direct
 * evaluation at 96 interior probes per block, over five epochs spanning
 * 1900-2100. Reports the worst angular separation in arcseconds — which is the
 * quantity rise/set actually cares about, since altitude error divided by the
 * body's ~15"/s altitude rate is the time error.
 *
 * Two things this is built to show, neither of which is visible from a single
 * configuration:
 *
 *  - the error **floor**, which is not the fit at all but the millisecond
 *    quantization of `new Date()` (the Moon moves 5.5e-4 arcsec per ms). Any row
 *    sitting on that floor is free width;
 *  - the **cliff** past four days, where ELP's ~5-day argument families stop
 *    being resolvable however many nodes are spent.
 *
 * The angular metric is atan2(|u x v|, u.v), not acos of the normalised dot
 * product: near-parallel vectors lose half their significant digits in the
 * acos form, which bottoms out around 6e-3 arcsec — above the error being
 * measured, and enough to make every configuration look identical.
 *
 *   npx esbuild notes/track-fit.src.ts --bundle --platform=node --format=esm \
 *     --outfile=/tmp/track-fit.mjs --log-level=error && node /tmp/track-fit.mjs
 */
import { getMoonPositionForTrack } from '../src/astronomy/moon';
import { getSunPosition } from '../src/astronomy/sun';
import { ttDaysSinceJ2000 } from '../src/astronomy/deltaT';
import { nutation, meanObliquityArcsec, ARCSEC_TO_RAD, AU_KM } from '../src/astronomy/frame';

const DAY_MS = 86_400_000;
const DEG = Math.PI / 180;

function equatorialAt(body: 'sun' | 'moon', ms: number): [number, number, number] {
  const date = new Date(ms);
  const t = ttDaysSinceJ2000(date) / 36525;
  const eps = (meanObliquityArcsec(t) + nutation(t).deps) * ARCSEC_TO_RAD;
  let lonDeg: number, latDeg: number, distAu: number;
  if (body === 'sun') { const p = getSunPosition(date); lonDeg = p.longitude; latDeg = p.latitude; distAu = p.distance; }
  else { const p = getMoonPositionForTrack(date); lonDeg = p.longitude; latDeg = p.latitude; distAu = p.distance / AU_KM; }
  const lon = lonDeg * DEG, lat = latDeg * DEG;
  const cl = distAu * Math.cos(lat);
  const ex = cl * Math.cos(lon), ey = cl * Math.sin(lon), ez = distAu * Math.sin(lat);
  return [ex, Math.cos(eps) * ey - Math.sin(eps) * ez, Math.sin(eps) * ey + Math.cos(eps) * ez];
}

function fitBlock(body: 'sun' | 'moon', startMs: number, spanMs: number, nodes: number) {
  const mid = startMs + spanMs / 2, half = spanMs / 2;
  const nx = new Float64Array(nodes), w = new Float64Array(nodes);
  const px = new Float64Array(nodes), py = new Float64Array(nodes), pz = new Float64Array(nodes);
  for (let k = 0; k < nodes; k++) {
    const x = Math.cos((Math.PI * k) / (nodes - 1));
    nx[k] = x; w[k] = (k === 0 || k === nodes - 1 ? 0.5 : 1) * (k % 2 ? -1 : 1);
    const p = equatorialAt(body, mid + half * x);
    px[k] = p[0]; py[k] = p[1]; pz[k] = p[2];
  }
  return (ms: number): [number, number, number] => {
    const x = (ms - mid) / half;
    let a = 0, b = 0, c = 0, den = 0;
    for (let k = 0; k < nodes; k++) {
      const dx = x - (nx[k] as number);
      if (dx === 0) return [px[k] as number, py[k] as number, pz[k] as number];
      const q = (w[k] as number) / dx;
      a += q * (px[k] as number); b += q * (py[k] as number); c += q * (pz[k] as number); den += q;
    }
    return [a / den, b / den, c / den];
  };
}

/** Angular separation of two vectors, arcsec. */
function sepArcsec(u: [number, number, number], v: [number, number, number]): number {
  // atan2 of |u x v| against u.v — the acos form loses half its digits near 1
  // and bottoms out at ~6e-3 arcsec, which is above the fit error being measured.
  const cx = u[1] * v[2] - u[2] * v[1];
  const cy = u[2] * v[0] - u[0] * v[2];
  const cz = u[0] * v[1] - u[1] * v[0];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return Math.atan2(Math.hypot(cx, cy, cz), dot) * 206264.806;
}

const EPOCHS = [Date.UTC(1900, 0, 1), Date.UTC(1950, 5, 3), Date.UTC(2025, 6, 9), Date.UTC(2088, 10, 21), Date.UTC(2100, 0, 1)];
const PROBES = 97;

console.log('body  blockDays nodes  nodes/day   max arcsec   max Δdist(km)  implied rise err (ms) @15"/s');
for (const body of ['moon', 'sun'] as const) {
  for (const [blockDays, nodes] of [[1, 5], [1, 7], [2, 7], [2, 9], [4, 9], [4, 11], [4, 13], [8, 15], [8, 17], [8, 21]] as const) {
    let worst = 0, worstDist = 0;
    for (const epoch of EPOCHS) {
      for (let b = 0; b < 3; b++) {
        const start = Math.floor(epoch / DAY_MS) * DAY_MS + b * blockDays * DAY_MS;
        const span = blockDays * DAY_MS;
        const f = fitBlock(body, start, span, nodes);
        for (let i = 1; i < PROBES; i++) {
          const ms = start + (span * i) / PROBES;
          const got = f(ms), truth = equatorialAt(body, ms);
          worst = Math.max(worst, sepArcsec(got, truth));
          worstDist = Math.max(worstDist, Math.abs(Math.hypot(...got) - Math.hypot(...truth)) * AU_KM);
        }
      }
    }
    console.log(
      `${body.padEnd(5)} ${String(blockDays).padStart(6)} ${String(nodes).padStart(6)} ${(nodes / blockDays).toFixed(2).padStart(9)}` +
      `   ${worst.toExponential(2).padStart(10)}   ${worstDist.toExponential(2).padStart(11)}   ${(worst / 15 * 1000).toExponential(2)}`,
    );
  }
}
