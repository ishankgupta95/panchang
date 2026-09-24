/** Truncates the published coefficient tables into the series that ships; run via `bash generate/notes/ephemeris-generate.sh`. */
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  readVsop87d, readElp2000, readNutation,
  type VsopBody,
} from '../../source/ts/tests/reference/catalog';

const OUT_DIR = 'src/astronomy/series';

/** Julian centuries from J2000; 1.5 covers 1850-2150, past the supported 1900-2100. */
const T_MAX = 1.5;

/** Matches `DIFFERENTIAL_FULL=1`, so the generator cannot advertise a budget the test then exceeds. */
const PROBE_COUNT = 100_000;

/** Arcseconds unless stated, against acceptance ceilings of 1.613″ for the Sun and 3.747″ for the Moon. */
const BUDGET = {
  moonLon: 0.4,
  moonLat: 0.2,
  moonDist: 0.2,
  /** Rotates longitude out of ELP's frame only: at ~47″/century tilt, 20″ is worth 0.005″. */
  moonLatCoarse: 20,
  /** Light-time only: at 0.549″/s, 100 km is 0.0002″. */
  moonDistCoarse: 100,
  /**
   * 5 km of 384,400 km is 0.003 s of moonrise. No latitude tier: its error
   * divides by an altitude rate that vanishes where the Moon grazes the horizon.
   */
  moonDistTrack: 5,
  /** Earth's heliocentric series is the Sun's; it also feeds every sankranti, at 24 s per arcsecond. */
  sunLon: 0.4,
  sunLat: 0.4,
  /** Earth again, for the planet path, where `r_E / Δ` amplifies the coarse 0.38″ to 1.41″ at Venus. */
  planetEarthLon: 0.1,
  planetEarthLat: 0.1,
  /** 8% of Mercury's 6.50″ ceiling. */
  planetLon: 0.5,
  planetLat: 0.5,
  /** Heliocentric radius as the geocentric angle it may cost, converted per body: δR displaces the direction by δR/Δ. */
  radiusAngleArcsec: 0.3,
  /** Sun light-time only: 1e-4 AU is 0.002″ of longitude. */
  sunRadiusCoarse: 1e-4,
  /** A per-term cut-off, unlike the rest; the error is then measured. */
  nutationCut: 500e-6,
} as const;

/** Total rounding the emitted decimals may add, apportioned over the term count. */
const QUANTIZATION_BUDGET = 0.005;

/** Rounded down; Earth's entry is its own heliocentric radius, which is what a solar-longitude error divides by. */
const MIN_GEOCENTRIC_DISTANCE_AU: Record<VsopBody, number> = {
  ear: 0.98, mer: 0.54, ven: 0.26, mar: 0.37, jup: 3.9, sat: 7.9,
};

function probes(seed: number): number[] {
  let s = seed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < PROBE_COUNT; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push((s / 4294967296) * 2 * T_MAX - T_MAX);
  }
  return out;
}

function shortest(value: number, tol: number): string {
  if (value === 0) return '0';
  for (let p = 1; p <= 17; p++) {
    const s = value.toPrecision(p);
    if (Math.abs(Number(s) - value) <= tol) return String(Number(s));
  }
  return String(value);
}

/** Do not make the scan a binary search: prefix error is monotone in k only in practice. */
function truncate<T>(
  terms: T[], termValue: (term: T, t: number) => number, budget: number, ts: number[],
): { count: number; error: number } {
  const n = terms.length;
  const maxTail = new Float64Array(n + 1);
  const tail = new Float64Array(n + 1);
  for (const t of ts) {
    tail[n] = 0;
    for (let i = n - 1; i >= 0; i--) tail[i] = (tail[i + 1] as number) + termValue(terms[i]!, t);
    for (let i = 0; i <= n; i++) {
      const v = Math.abs(tail[i] as number);
      if (v > (maxTail[i] as number)) maxTail[i] = v;
    }
  }
  for (let k = 1; k <= n; k++) {
    if ((maxTail[k] as number) <= budget) return { count: k, error: maxTail[k] as number };
  }
  return { count: n, error: maxTail[n] as number };
}

interface ElpCanonical { a: number; phase: number[]; power: 0 | 1 | 2; main: boolean }

const ELP_CONST = (() => {
  const rad = 648000 / Math.PI, deg = Math.PI / 180, c1 = 60, c2 = 3600;
  const ath = 384747.9806743165, a0 = 384747.9806448954;
  const am = 0.074801329518, alfa = 0.002571881335;
  const dtasm = (2 * alfa) / (3 * am);
  const w: number[][] = [[], [], [], []];
  const eart: number[] = [], peri: number[] = [];
  w[1]![1] = (218 + 18 / c1 + 59.95571 / c2) * deg;
  w[2]![1] = (83 + 21 / c1 + 11.67475 / c2) * deg;
  w[3]![1] = (125 + 2 / c1 + 40.39816 / c2) * deg;
  eart[1] = (100 + 27 / c1 + 59.22059 / c2) * deg;
  peri[1] = (102 + 56 / c1 + 14.42753 / c2) * deg;
  w[1]![2] = 1732559343.73604 / rad; w[2]![2] = 14643420.2632 / rad; w[3]![2] = -6967919.3622 / rad;
  eart[2] = 129597742.2758 / rad; peri[2] = 1161.2283 / rad;
  w[1]![3] = -5.8883 / rad; w[2]![3] = -38.2776 / rad; w[3]![3] = 6.3622 / rad;
  eart[3] = -0.0202 / rad; peri[3] = 0.5327 / rad;
  w[1]![4] = 0.6604e-2 / rad; w[2]![4] = -0.45047e-1 / rad; w[3]![4] = 0.7625e-2 / rad;
  eart[4] = 0.9e-5 / rad; peri[4] = -0.138e-3 / rad;
  w[1]![5] = -0.3169e-4 / rad; w[2]![5] = 0.21301e-3 / rad; w[3]![5] = -0.3586e-4 / rad;
  eart[5] = 0.15e-6 / rad; peri[5] = 0;
  const preces = 5029.0966 / rad;
  const p: number[][] = [[], [], [], [], [], [], [], [], []];
  p[1]![1] = (252 + 15 / c1 + 3.25986 / c2) * deg;
  p[2]![1] = (181 + 58 / c1 + 47.28305 / c2) * deg;
  p[3]![1] = eart[1]!;
  p[4]![1] = (355 + 25 / c1 + 59.78866 / c2) * deg;
  p[5]![1] = (34 + 21 / c1 + 5.34212 / c2) * deg;
  p[6]![1] = (50 + 4 / c1 + 38.89694 / c2) * deg;
  p[7]![1] = (314 + 3 / c1 + 18.01841 / c2) * deg;
  p[8]![1] = (304 + 20 / c1 + 55.19575 / c2) * deg;
  p[1]![2] = 538101628.68898 / rad; p[2]![2] = 210664136.43355 / rad; p[3]![2] = eart[2]!;
  p[4]![2] = 68905077.59284 / rad; p[5]![2] = 10925660.42861 / rad; p[6]![2] = 4399609.65932 / rad;
  p[7]![2] = 1542481.19393 / rad; p[8]![2] = 786550.32074 / rad;
  const delnu = 0.55604 / rad / w[1]![2]!, dele = 0.01789 / rad, delg = -0.08066 / rad;
  const delnp = -0.06424 / rad / w[1]![2]!, delep = -0.12879 / rad;
  const del: number[][] = [[], [], [], [], []];
  for (let i = 1; i <= 5; i++) {
    del[1]![i] = w[1]![i]! - eart[i]!;
    del[4]![i] = w[1]![i]! - w[3]![i]!;
    del[3]![i] = w[1]![i]! - w[2]![i]!;
    del[2]![i] = eart[i]! - peri[i]!;
  }
  del[1]![1] = del[1]![1]! + Math.PI;
  const zeta = [0, w[1]![1]!, w[1]![2]! + preces];
  return { rad, deg, ath, a0, am, dtasm, w, p, del, zeta, delnu, dele, delg, delnp, delep };
})();

function canonicalElp(): Record<1 | 2 | 3, ElpCanonical[]> {
  const tables = readElp2000();
  const { deg, del, zeta, p, dtasm, am, delnu, dele, delg, delnp, delep, a0, ath } = ELP_CONST;
  const out: Record<1 | 2 | 3, ElpCanonical[]> = { 1: [], 2: [], 3: [] };
  const distScale = a0 / ath;

  for (let file = 1; file <= 36; file++) {
    const iv = (((file - 1) % 3) + 1) as 1 | 2 | 3;
    const scale = iv === 3 ? distScale : 1;

    if (file <= 3) {
      for (const { ilu, coef } of tables.main[file]!) {
        const tgv = coef[2]! + dtasm * coef[6]!;
        let a = coef[1]!;
        if (file === 3) a = a - (2 * a * delnu) / 3;
        a = a + tgv * (delnp - am * delnu) + coef[3]! * delg + coef[4]! * dele + coef[5]! * delep;
        const phase = [0, 0, 0, 0, 0];
        for (let k = 1; k <= 5; k++) {
          for (let i = 1; i <= 4; i++) phase[k - 1] += ilu[i - 1]! * del[i]![k]!;
        }
        if (iv === 3) phase[0]! += Math.PI / 2;
        out[iv].push({ a: a * scale, phase, power: 0, main: true });
      }
    } else if (file <= 9 || file >= 22) {
      for (const { iz, ilu, pha, a } of tables.pert[file]!) {
        const phase = [pha * deg, 0, 0, 0, 0];
        for (let k = 1; k <= 2; k++) {
          phase[k - 1] += iz * zeta[k]!;
          for (let i = 1; i <= 4; i++) phase[k - 1] += ilu[i - 1]! * del[i]![k]!;
        }
        const power = (file >= 34 ? 2 : (file >= 7 && file <= 9) || (file >= 25 && file <= 27) ? 1 : 0) as 0 | 1 | 2;
        out[iv].push({ a: a * scale, phase, power, main: false });
      }
    } else {
      for (const { ipla, pha, a } of tables.planet[file]!) {
        const phase = [pha * deg, 0, 0, 0, 0];
        if (file < 16) {
          for (let k = 1; k <= 2; k++) {
            phase[k - 1] += ipla[8]! * del[1]![k]! + ipla[9]! * del[3]![k]! + ipla[10]! * del[4]![k]!;
            for (let i = 1; i <= 8; i++) phase[k - 1] += ipla[i - 1]! * p[i]![k]!;
          }
        } else {
          for (let k = 1; k <= 2; k++) {
            for (let i = 1; i <= 4; i++) phase[k - 1] += ipla[i + 6]! * del[i]![k]!;
            for (let i = 1; i <= 7; i++) phase[k - 1] += ipla[i - 1]! * p[i]![k]!;
          }
        }
        const power = ((file >= 13 && file <= 15) || (file >= 19 && file <= 21) ? 1 : 0) as 0 | 1 | 2;
        out[iv].push({ a: a * scale, phase, power, main: false });
      }
    }
  }
  return out;
}

const evalElpTerm = (q: ElpCanonical, t: number): number => {
  const ph = q.phase;
  const y = ph[0]! + t * (ph[1]! + t * (ph[2]! + t * (ph[3]! + t * ph[4]!)));
  return q.a * t ** q.power * Math.sin(y);
};

function floatArray(values: number[], tolerances: number[]): string {
  const parts = values.map((v, i) => shortest(v, tolerances[i]!));
  const lines: string[] = [];
  let line = ' ';
  for (const part of parts) {
    if (line.length + part.length + 2 > 96) { lines.push(line); line = ' '; }
    line += ` ${part},`;
  }
  if (line.trim()) lines.push(line);
  return lines.join('\n');
}

const BANNER = (extra: string): string => `/**
 * GENERATED FILE: do not edit. Regenerate with
 * \`bash generate/notes/ephemeris-generate.sh\`.
 *
${extra}
 */
`;

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const ts = probes(20260806);
  const report: string[] = [];

  const canonical = canonicalElp();
  const moonParts: string[] = [];
  const COORD = [
    { iv: 1 as const, name: 'LONGITUDE', budget: BUDGET.moonLon, unit: '″', extra: [] },
    { iv: 2 as const, name: 'LATITUDE', budget: BUDGET.moonLat, unit: '″',
      extra: [['COARSE', BUDGET.moonLatCoarse]] as const },
    { iv: 3 as const, name: 'DISTANCE', budget: BUDGET.moonDist, unit: ' km',
      extra: [['TRACK', BUDGET.moonDistTrack], ['COARSE', BUDGET.moonDistCoarse]] as const },
  ];
  /** Split by phase degree: the main problem needs a quartic phase, the perturbations only a linear one. */
  const emitElp = (prefix: string, kept: ElpCanonical[], doc: string): string[] => {
    const perTerm = QUANTIZATION_BUDGET / Math.max(kept.length, 1);
    const quarticValues: number[] = [], quarticTol: number[] = [];
    for (const q of kept.filter((x) => x.main)) {
      quarticValues.push(q.a, q.phase[0]!, q.phase[1]!, q.phase[2]!, q.phase[3]!, q.phase[4]!);
      const amp = Math.max(Math.abs(q.a), 1e-12);
      quarticTol.push(perTerm, perTerm / amp, perTerm / (amp * T_MAX), perTerm / (amp * T_MAX ** 2),
        perTerm / (amp * T_MAX ** 3), perTerm / (amp * T_MAX ** 4));
    }
    const linearValues: number[] = [], linearTol: number[] = [];
    for (const q of kept.filter((x) => !x.main)) {
      linearValues.push(q.a, q.phase[0]!, q.phase[1]!, q.power);
      const amp = Math.max(Math.abs(q.a), 1e-12);
      linearTol.push(perTerm, perTerm / amp, perTerm / (amp * T_MAX), 0);
    }
    return [
      `/** ${doc} */`,
      `export const ${prefix}_QUARTIC = /* @__PURE__ */ new Float64Array([\n${floatArray(quarticValues, quarticTol)}\n]);`,
      `export const ${prefix}_LINEAR = /* @__PURE__ */ new Float64Array([\n${floatArray(linearValues, linearTol)}\n]);`,
    ];
  };

  for (const { iv, name, budget, unit, extra } of COORD) {
    const sorted = canonical[iv]
      .slice()
      .sort((x, y) => Math.abs(y.a) * T_MAX ** y.power - Math.abs(x.a) * T_MAX ** x.power);
    const { count, error } = truncate(sorted, evalElpTerm, budget, ts);
    const kept = sorted.slice(0, count);
    moonParts.push(...emitElp(
      `MOON_${name}`, kept,
      `${count} terms; error ≤ ${error.toPrecision(3)}${unit} over |t| ≤ ${T_MAX}.`,
    ));
    for (const [suffix, budgetValue] of extra) {
      const c = truncate(kept, evalElpTerm, budgetValue, ts);
      moonParts.push(...emitElp(
        `MOON_${name}_${suffix}`, kept.slice(0, c.count),
        `${suffix.charAt(0) + suffix.slice(1).toLowerCase()}: error ≤ ${c.error.toPrecision(3)}${unit}.`
        + ` Not a prefix of the full table; the split by phase degree does not preserve amplitude order.`,
      ));
      report.push(`Moon ${name.toLowerCase()} ${suffix.toLowerCase().padEnd(6)} ${String(c.count).padStart(4)}        err ${c.error.toPrecision(3)}${unit}`);
    }
    report.push(`Moon ${name.toLowerCase().padEnd(9)} ${String(count).padStart(5)} / ${canonical[iv].length}  err ${error.toPrecision(3)}${unit}`);
  }

  writeFileSync(`${OUT_DIR}/elp2000-82b.ts`, BANNER(
    ` * ELP2000-82B (Chapront-Touzé & Chapront; VizieR VI/79), truncated. The Moon's\n`
    + ` * geocentric spherical coordinates in ELP's own frame: the mean dynamical\n`
    + ` * ecliptic of date, with longitude measured from the inertial J2000 origin.\n`
    + ` * The rotation to the equinox of date lives in \`../frame.ts\`, not here.\n`
    + ` *\n`
    + ` * Each term is \`a · t^power · sin(phase(t))\`, t in Julian centuries TT from\n`
    + ` * J2000. Longitude and latitude are arcseconds; distance is kilometres, with\n`
    + ` * \`elp82b.f\`'s a0/ath scaling already folded into the amplitudes.\n`
    + ` *\n`
    + ` * QUARTIC tables are stride 6: amplitude, then the five phase-polynomial\n`
    + ` * coefficients. LINEAR tables are stride 4: amplitude, phase, phase rate,\n`
    + ` * power of t.`,
  ) + `\n/** \`elp82b.f\`'s W1: the Moon's mean longitude polynomial, radians. */\nexport const MOON_MEAN_LONGITUDE = /* @__PURE__ */ new Float64Array([\n${
    floatArray(ELP_CONST.w[1]!.slice(1), [1e-13, 1e-13, 1e-13, 1e-16, 1e-18])}\n]);\n\n`
    + moonParts.join('\n\n') + '\n');

  const bodies: VsopBody[] = ['ear', 'mer', 'ven', 'mar', 'jup', 'sat'];
  const vsopParts: string[] = [];
  const vsop = readVsop87d();
  for (const body of bodies) {
    const series = vsop.get(body)!;
    const angular = body === 'ear'
      ? { lon: BUDGET.sunLon, lat: BUDGET.sunLat }
      : { lon: BUDGET.planetLon, lat: BUDGET.planetLat };
    const radius = (BUDGET.radiusAngleArcsec / 206264.806) * MIN_GEOCENTRIC_DISTANCE_AU[body];
    for (const [variable, label, budgetArcsec, isAngle] of [
      [1, 'L', angular.lon, true], [2, 'B', angular.lat, true], [3, 'R', radius, false],
    ] as const) {
      const flat: { A: number; B: number; C: number; power: number }[] = [];
      const powers = series[variable];
      for (let power = 0; power < powers.length; power++) {
        for (const term of powers[power] ?? []) flat.push({ ...term, power });
      }
      flat.sort((x, y) => Math.abs(y.A) * T_MAX ** y.power - Math.abs(x.A) * T_MAX ** x.power);
      const budget = isAngle ? budgetArcsec / 206264.806 : budgetArcsec;
      // VSOP's argument is Julian millennia; the probes are centuries.
      const evaluate = (q: (typeof flat)[number], t: number): number => {
        const tau = t / 10;
        return q.A * Math.cos(q.B + q.C * tau) * tau ** q.power;
      };
      const { count, error } = truncate(flat, evaluate, budget, ts);
      const kept = flat.slice(0, count);
      const perTerm = (QUANTIZATION_BUDGET / (isAngle ? 206264.806 : 1e6)) / count;
      const values: number[] = [], tol: number[] = [];
      for (const q of kept) {
        values.push(q.A, q.B, q.C, q.power);
        const amp = Math.max(Math.abs(q.A), 1e-14);
        tol.push(perTerm, perTerm / amp, perTerm / (amp * (T_MAX / 10)), 0);
      }
      const name = `${body.toUpperCase()}_${label}`;
      vsopParts.push(
        `/** ${count} of ${flat.length} terms; error ≤ ${(isAngle ? error * 206264.806 : error).toPrecision(3)}${isAngle ? '″' : ' AU'}. */`,
        `export const ${name} = /* @__PURE__ */ new Float64Array([\n${floatArray(values, tol)}\n]);`,
      );
      report.push(`VSOP ${body} ${label}      ${String(count).padStart(5)} / ${flat.length}  err ${(isAngle ? error * 206264.806 : error).toPrecision(3)}${isAngle ? '″' : ' AU'}`);

      // From `flat`, not `kept`: this prefix is longer than the coarse one, not a subset.
      if (body === 'ear' && (label === 'L' || label === 'B')) {
        const tight = (label === 'L' ? BUDGET.planetEarthLon : BUDGET.planetEarthLat) / 206264.806;
        const p = truncate(flat, evaluate, tight, ts);
        const per = QUANTIZATION_BUDGET / 206264.806 / p.count;
        const preciseValues: number[] = [], preciseTol: number[] = [];
        for (const q of flat.slice(0, p.count)) {
          preciseValues.push(q.A, q.B, q.C, q.power);
          const amp = Math.max(Math.abs(q.A), 1e-14);
          preciseTol.push(per, per / amp, per / (amp * (T_MAX / 10)), 0);
        }
        vsopParts.push(
          `/** ${p.count} of ${flat.length} terms; error ≤ ${(p.error * 206264.806).toPrecision(3)}″. */`,
          `export const ${name}_PRECISE = /* @__PURE__ */ new Float64Array([\n${floatArray(preciseValues, preciseTol)}\n]);`,
        );
        report.push(`VSOP ear ${label} precise ${String(p.count).padStart(5)} / ${flat.length}  err ${(p.error * 206264.806).toPrecision(3)}″`);
      }

      if (body === 'ear' && label === 'R') {
        const c = truncate(kept, evaluate, BUDGET.sunRadiusCoarse, ts);
        const coarse: number[] = [], coarseTol: number[] = [];
        for (const q of kept.slice(0, c.count)) {
          coarse.push(q.A, q.B, q.C, q.power);
          const amp = Math.max(Math.abs(q.A), 1e-14);
          const per = BUDGET.sunRadiusCoarse / 100 / c.count;
          coarseTol.push(per, per / amp, per / (amp * (T_MAX / 10)), 0);
        }
        vsopParts.push(
          `/** Coarse: error ≤ ${c.error.toPrecision(3)} AU. Light-time only. */`,
          `export const EAR_R_COARSE = /* @__PURE__ */ new Float64Array([\n${floatArray(coarse, coarseTol)}\n]);`,
        );
        report.push(`VSOP ear R coarse  ${String(c.count).padStart(5)}         err ${c.error.toPrecision(3)} AU`);
      }
    }
  }
  writeFileSync(`${OUT_DIR}/vsop87d.ts`, BANNER(
    ` * VSOP87D (Bretagnon & Francou 1988; VizieR VI/81), truncated. Heliocentric\n`
    + ` * spherical coordinates (longitude and latitude in radians, radius in AU)\n`
    + ` * referred to the mean dynamical ecliptic and equinox of date, which is why\n`
    + ` * the solar path applies no precession at all.\n`
    + ` *\n`
    + ` * Stride 4: A, B, C, power of τ, for a term \`A · τ^power · cos(B + C·τ)\`, with\n`
    + ` * τ in Julian millennia TT from J2000, VSOP87's own argument, not centuries.`,
  ) + '\n' + vsopParts.join('\n\n') + '\n');

  const { psi, eps } = readNutation();
  const nutParts: string[] = [];
  /** `frame.ts` sizes its sin/cos tables by this, so a hardcoded bound would index past their end. */
  let maxMultiplier = 0;
  for (const [label, terms] of [['PSI', psi], ['EPS', eps]] as const) {
    const kept = terms
      .filter((q) => Math.hypot(q.sinCoef, q.cosCoef) >= BUDGET.nutationCut * 1e6)
      .sort((a, b) => Math.hypot(b.sinCoef, b.cosCoef) - Math.hypot(a.sinCoef, a.cosCoef));
    const evaluate = (subset: typeof kept, t: number): number => {
      let sum = 0;
      for (const q of subset) {
        let arg = 0;
        for (let k = 0; k < 14; k++) if (q.mult[k]) arg += q.mult[k]! * FUND[k]!(t);
        const v = q.sinCoef * Math.sin(arg) + q.cosCoef * Math.cos(arg);
        sum += q.power === 0 ? v : v * t;
      }
      return sum / 1e6;
    };
    const fullValue = ts.map((t) => evaluate(terms as typeof kept, t));
    let error = 0;
    for (let i = 0; i < ts.length; i++) error = Math.max(error, Math.abs(evaluate(kept, ts[i]!) - fullValue[i]!));

    const coefficients: number[] = [];
    const multipliers: number[] = [];
    for (const q of kept) {
      coefficients.push(q.sinCoef / 1e6, q.cosCoef / 1e6, q.power);
      for (let k = 0; k < 14; k++) {
        multipliers.push(q.mult[k]!);
        maxMultiplier = Math.max(maxMultiplier, Math.abs(q.mult[k]!));
      }
    }
    nutParts.push(
      `/** ${kept.length} of ${terms.length} terms; error ≤ ${error.toPrecision(3)}″. Stride 3: sin, cos (arcsec), power of t. */`,
      `export const NUTATION_${label} = /* @__PURE__ */ new Float64Array([\n${floatArray(coefficients, coefficients.map(() => 1e-12))}\n]);`,
      `/** Stride 14: multipliers of l, l', F, D, Ω, and the nine planetary arguments. */`,
      `export const NUTATION_${label}_ARGS = /* @__PURE__ */ new Int8Array([\n${floatArray(multipliers, multipliers.map(() => 0))}\n]);`,
    );
    report.push(`Nutation ${label.padEnd(6)} ${String(kept.length).padStart(5)} / ${terms.length}  err ${error.toPrecision(3)}"`);
  }
  writeFileSync(`${OUT_DIR}/nutation-iau2000.ts`, BANNER(
    ` * These are the IAU 2000_R06 tables: 2000A with the IAU 2006 adjustments.\n`
    + ` * Their leading Δψ term is −17.20642418″, not the −17.2064161″ of the plain\n`
    + ` * IAU 2000A table, so checking this file against the wrong one of the two\n`
    + ` * makes a correct series look broken.`,
  ) + '\n' + nutParts.join('\n\n') + '\n\n'
    + '/**\n'
    + ' * Largest |multiplier| in either ARGS table; `frame.ts` sizes its precomputed\n'
    + " * sin/cos table by it, so a larger multiplier would read past that table's end.\n"
    + ' */\n'
    + `export const NUTATION_MAX_MULTIPLIER = ${maxMultiplier};\n`);
  report.push(`Nutation max |multiplier| ${maxMultiplier}`);

  console.error(report.join('\n'));
}

/** Duplicated from the library so the generator stands alone. */
const AS2R = Math.PI / 648000, TURN = 1_296_000;
const poly = (c0: number, c1: number, c2: number, c3: number, c4: number) =>
  (t: number): number => ((c0 + (c1 + (c2 + (c3 + c4 * t) * t) * t) * t) % TURN) * AS2R;
const FUND: ((t: number) => number)[] = [
  poly(485868.249036, 1717915923.2178, 31.8792, 0.051635, -0.00024470),
  poly(1287104.79305, 129596581.0481, -0.5532, 0.000136, -0.00001149),
  poly(335779.526232, 1739527262.8478, -12.7512, -0.001037, 0.00000417),
  poly(1072260.70369, 1602961601.2090, -6.3706, 0.006593, -0.00003169),
  poly(450160.398036, -6962890.5431, 7.4722, 0.007702, -0.00005939),
  (t) => 4.402608842 + 2608.7903141574 * t,
  (t) => 3.176146697 + 1021.3285546211 * t,
  (t) => 1.753470314 + 628.3075849991 * t,
  (t) => 6.203480913 + 334.0612426700 * t,
  (t) => 0.599546497 + 52.9690962641 * t,
  (t) => 0.874016757 + 21.3299104960 * t,
  (t) => 5.481293872 + 7.4781598567 * t,
  (t) => 5.311886287 + 3.8133035638 * t,
  (t) => (0.02438175 + 0.00000538691 * t) * t,
];

main();
