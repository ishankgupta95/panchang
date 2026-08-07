/**
 * Phase 36.2–36.4 — truncate the published coefficient tables into the series
 * that ships, under an explicit error budget.
 *
 *   bash notes/ephemeris-generate.sh
 *
 * Reads `tests/fixtures/ephemeris-source/` (see `notes/ephemeris-fetch.mjs`) and
 * writes `src/astronomy/series/*.ts`. Nothing else writes those files; they
 * carry a "generated" banner and a regeneration command.
 *
 * ## What "truncate to a budget" means here, precisely
 *
 * Not "keep terms above an amplitude threshold" — that bounds the largest term
 * dropped, not the error. Instead, for each coordinate the terms are sorted by
 * the largest contribution they can make anywhere in the supported span
 * (|A|·|t|^p with |t| ≤ {@link T_MAX}), and the retained count is the smallest
 * prefix whose worst **measured** disagreement with the full series, over
 * {@link PROBE_COUNT} pseudo-random epochs, stays inside the budget. See
 * {@link truncate} for how that is computed. The budget and the resulting term
 * count are both written into the generated file.
 *
 * The differential test then re-measures the same quantity against the frozen
 * reference over ≥100k instants, which is what turns the budget from this
 * script's claim into a checked property.
 *
 * ## Why the emitted numbers have ragged precision
 *
 * A phase coefficient is multiplied by t and then fed to `sin`, so what a
 * reader cares about is the *amplitude* error the rounding causes: |a|·δφ·|t|^k.
 * Emitting every coefficient at 17 digits would be 40% more bytes for terms
 * whose amplitude is a thousandth of an arcsecond. Each number is therefore
 * printed at the fewest digits that keep its own contribution below
 * {@link QUANTIZATION_BUDGET} / (number of terms) — so the *summed* rounding
 * error stays under that budget even if every term happened to round the same
 * way, which is the pessimistic case.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  readVsop87d, readElp2000, readNutation,
  type VsopBody,
} from '../tests/reference/catalog';

const OUT_DIR = 'src/astronomy/series';

/**
 * Widest |t| (Julian centuries from J2000) the truncation must hold over.
 * The library's supported span is 1900–2100 (|t| ≤ 1); 1.5 covers 1850–2150 so
 * accuracy degrades gracefully rather than cliff-edges at the boundary.
 */
const T_MAX = 1.5;

/**
 * Epochs the truncation error is measured over.
 *
 * **Raised 2026-08-07 from 600 to 100,000**, and the reason it is not simply
 * "as many as convergence needs" is a finding worth stating: *it does not
 * converge*. The residual left by dropping a series' tail is a sum of sinusoids
 * whose supremum over the span is attained on a set of measure zero, so a
 * random sample approaches it as an extreme-value problem — slowly, and
 * without ever arriving. Swept:
 *
 * | probes | Moon longitude terms | Earth L terms |
 * |---|---|---|
 * | 600 | 512 | 108 |
 * | 5,000 | 554 | 118 |
 * | 20,000 | 554 | 118 |
 * | 60,000 | 661 | 118 |
 *
 * The measured error is pinned at the budget by construction, so it is the
 * *term count* that reveals the sampling, and at 60,000 it was still climbing.
 * Chasing it further is not the answer; anchoring it is. 100,000 is exactly the
 * sample size `DIFFERENTIAL_FULL=1` uses in
 * `tests/validation/differential-ephemeris.test.ts`, so the generator can no
 * longer advertise a budget that the test verifying it then exceeds — which is
 * the failure this change exists to remove. The number in a generated header
 * should be read as "worst of 100,000 samples", not as a supremum.
 *
 * At 600 probes this cost ~3 s; at 100,000 it costs ~90 s, which is affordable
 * only because {@link truncate} was rewritten to sweep tails rather than
 * binary-search prefixes.
 */
const PROBE_COUNT = 100_000;

/**
 * Truncation budgets, arcseconds unless stated. PLAN.md §36.2 mandates ≤1″.
 *
 * **Raised 2026-08-07, with receipts.** The original values sat *ten* times
 * inside the acceptance ceilings rather than the three the protocol calls for,
 * on the assumption that the extra terms were nearly free. The post-36.5
 * profile said otherwise: `sumQuartic` and `sumLinear` — the lunar series and
 * nothing else — are **47.9% of the library's self time**. Precision nobody can
 * observe was being paid for out of the performance budget.
 *
 * What the ceilings actually are, and where these budgets now sit:
 *
 * | | ceiling (`astronomy-engine` vs DE441) | truncation budget | measured total |
 * |---|---|---|---|
 * | Sun | 1.613″ | 0.4″ | see `tier0-own-sun-moon.test.ts` |
 * | Moon | 3.747″ | 0.4″ | same |
 *
 * The Moon's budget is the one to be careful with, because lunar longitude
 * error converts to reported time at 1.82 s per arcsecond and Drik parity has
 * to stay inside its ≤60 s worst case. 0.4″ is 0.73 s of tithi boundary — an
 * order below the 17 s drift that already exists, and two orders below the
 * bound. Predicted, then measured: `notes/v5-step5-predictions.md`.
 */
const BUDGET = {
  /** Lunar longitude, arcseconds. */
  moonLon: 0.4,
  /** Lunar latitude, arcseconds. */
  moonLat: 0.2,
  /** Lunar distance, km. */
  moonDist: 0.2,
  /**
   * Coarse lunar latitude, arcseconds — used only to rotate the longitude out
   * of ELP's frame. Latitude enters that rotation multiplied by the ecliptic's
   * own ~47″/century tilt, so 20″ of latitude error is worth under 0.005″ of
   * longitude.
   */
  moonLatCoarse: 20,
  /**
   * Coarse lunar distance, km — used only for light-time. The Moon moves
   * 0.549″/s and light covers 299,792 km/s, so 100 km of distance error is
   * 0.0002″ of longitude.
   */
  moonDistCoarse: 100,
  /**
   * Lunar **distance** for the rise/set track, km — between the full series and
   * the coarse one.
   *
   * Distance enters rise/set only through parallax and semidiameter, and it
   * enters as a *ratio*: 5 km against 384,400 km moves the 57′ horizontal
   * parallax by 0.04″, or 0.003 s of moonrise, and unlike declination it does
   * not divide by anything small. Dropping 394 terms costs that much everywhere,
   * including at Alert. The full series stays available for `getMoonPosition`,
   * which the eclipse geometry needs.
   *
   * **There is deliberately no `moonLatTrack`.** A 1″ latitude tier was
   * generated and measured, and it is the asymmetry `moon.ts` documents:
   * latitude is declination, declination error converts to time by dividing by
   * the body's altitude rate, and where the Moon *grazes* the horizon that rate
   * approaches zero. It measured **402 ms** of moonrise error at Alert, 82.5 °N,
   * to save 2.4 µs. The track therefore reads the full latitude series, and the
   * tier was emitting ~6 KB nothing imported.
   */
  moonDistTrack: 5,
  /**
   * Earth's heliocentric longitude and latitude, arcseconds — this *is* the
   * Sun's series.
   *
   * Was 0.1″, on the argument that Earth's series is short enough for tightness
   * to be free. It is not quite: 0.1″ costs 219 of the 1,080 Earth-L terms and
   * `evaluateVsop` is 8.5% of self time. 0.4″ is a quarter of the Sun's 1.61″
   * ceiling — the same fraction of the budget the Moon now spends of its own —
   * and the solar path is the one that also feeds every sankranti, where the
   * coefficient is a much less forgiving 24 s per arcsecond.
   */
  sunLon: 0.4,
  sunLat: 0.4,
  /**
   * Earth's heliocentric longitude and latitude **for the planet path**,
   * arcseconds. Emitted as a second, tighter copy of the same series.
   *
   * A geocentric planetary direction is `planet − Earth`, so it inherits the
   * Earth's heliocentric error amplified by `r_E / Δ` — and Δ is small exactly
   * where it hurts. At the 0.38″ the coarse series actually carries, that is
   * 0.69″ at Mercury, 1.41″ at Venus and 1.03″ at Mars: bigger than those
   * bodies' *own* truncation budgets, from a series whose budget was set for a
   * different consumer entirely. Raising `sunLon` to 0.4″ degraded Mercury and
   * Venus by ~50% with their own budget untouched, which is how the coupling
   * was found.
   *
   * So the two consumers get two series. `sun.ts` keeps the coarse one, where
   * the Earth *is* the answer and 0.4″ is a quarter of the Sun's ceiling;
   * `vsop87.ts`'s `earthRect` — the planet path's only Earth read — gets this
   * one, where the Earth is a subtrahend and its error is multiplied. 0.1″
   * leaves every planet's inherited term below 0.4″.
   *
   * The cost is bundle, not time: `earthRect` is memoized on the exact epoch, so
   * a birth chart evaluates the Earth three times for fifteen planet reads.
   */
  planetEarthLon: 0.1,
  planetEarthLat: 0.1,
  /**
   * Heliocentric longitude and latitude of a planet, arcseconds. Five times
   * looser than Earth's, because the tightest planetary ceiling is Mercury's
   * 6.50″ — 0.5″ is 8% of it, the same fraction of the budget the Sun and Moon
   * spend, and it is what keeps Saturn's series from dominating the bundle.
   */
  planetLon: 0.5,
  planetLat: 0.5,
  /**
   * Heliocentric radius: stated as the **geocentric angle** it is allowed to
   * cost, then converted per body.
   *
   * A radius error δR displaces the geocentric direction by δR/Δ, so a fixed
   * budget in AU is far too tight for Saturn (Δ ≈ 8 AU) and slightly too loose
   * for Venus (Δ ≈ 0.27 AU at inferior conjunction). Budgeting the angle
   * instead makes one number cover every body — and it is what collapses
   * Saturn's radius series from 1,494 terms to a fraction of that, which was
   * the single largest contributor to the generated bundle.
   */
  radiusAngleArcsec: 0.3,
  /**
   * Earth's heliocentric radius, coarse, AU — used only for the Sun's
   * light-time. The Sun moves 0.041″/s and light crosses an AU in 499 s, so
   * 1e-4 AU of radius error is 0.05 s of retardation and 0.002″ of longitude:
   * a fiftieth of the solar truncation budget, for a handful of terms instead
   * of 63. Same reasoning as the Moon's coarse distance.
   */
  sunRadiusCoarse: 1e-4,
  /** Nutation, arcseconds — a per-term cut-off, then the error is measured. */
  nutationCut: 500e-6,
} as const;

/** Total rounding error the emitted decimal representations may add. */
const QUANTIZATION_BUDGET = 0.005;

/**
 * Smallest geocentric distance each body reaches, AU — the worst case for
 * turning a heliocentric radius error into an angular one. Earth's entry is its
 * own heliocentric radius, since that is what a solar-longitude error divides
 * by. Rounded down, so the derived budgets are conservative.
 */
const MIN_GEOCENTRIC_DISTANCE_AU: Record<VsopBody, number> = {
  ear: 0.98, mer: 0.54, ven: 0.26, mar: 0.37, jup: 3.9, sat: 7.9,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function probes(seed: number): number[] {
  let s = seed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < PROBE_COUNT; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push((s / 4294967296) * 2 * T_MAX - T_MAX);
  }
  return out;
}

/** Shortest decimal string that parses back to within `tol` of `value`. */
function shortest(value: number, tol: number): string {
  if (value === 0) return '0';
  for (let p = 1; p <= 17; p++) {
    const s = value.toPrecision(p);
    if (Math.abs(Number(s) - value) <= tol) return String(Number(s));
  }
  return String(value);
}

/**
 * Smallest prefix of `terms` whose truncation error stays within `budget`
 * across every probe, together with that error.
 *
 * ## Why this is a tail sweep and not a binary search
 *
 * The truncation error of a prefix of length k is *exactly* the sum of the
 * dropped terms — the tail — because every term is independent. So one backward
 * accumulation per probe yields the error of **every** k at once, and the
 * answer is the first k whose worst tail fits.
 *
 * That replaces a binary search which cost ~log₂(n) full evaluations per probe
 * and rested on an assumption the old comment stated but could not enforce:
 * that the prefix error is monotone in k. It is only monotone *in practice* —
 * terms are sorted by amplitude, but two adjacent dropped terms can cancel at a
 * given epoch, and a binary search that lands on such a k accepts a prefix that
 * a slightly longer one would have rejected. The sweep has no such gap, and it
 * is also ~7.5× faster, which is what makes {@link PROBE_COUNT} affordable at
 * the size below.
 *
 * `termValue` is per-term rather than per-subset for the same reason: it is what
 * lets the tail be accumulated once instead of re-summed per candidate.
 */
function truncate<T>(
  terms: T[], termValue: (term: T, t: number) => number, budget: number, ts: number[],
): { count: number; error: number } {
  const n = terms.length;
  // maxTail[k] = worst |sum of terms k..n-1| over the probes = error of keeping k.
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

// ---------------------------------------------------------------------------
// ELP2000-82B → canonical terms
// ---------------------------------------------------------------------------

/** `a · t^power · sin(phase[0] + phase[1]·t + … + phase[4]·t⁴)`. */
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

/**
 * Flatten the 36 files into three lists of uniform terms.
 *
 * The FORTRAN's structure — which file a term came from, which of its three
 * argument conventions applies — is entirely a fact about the argument, and the
 * argument is always a linear combination of angles that are themselves linear
 * or quartic in t. So every term in every file collapses to the same shape:
 * an amplitude, a phase polynomial, and a power of t. That collapse is the only
 * transformation this generator performs on the lunar theory, and the
 * differential test against the untruncated reference is what checks it.
 */
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

/** One ELP term's contribution at `t`. See {@link truncate} for why it is per-term. */
const evalElpTerm = (q: ElpCanonical, t: number): number => {
  const ph = q.phase;
  const y = ph[0]! + t * (ph[1]! + t * (ph[2]! + t * (ph[3]! + t * ph[4]!)));
  return q.a * t ** q.power * Math.sin(y);
};

// ---------------------------------------------------------------------------
// Emission
// ---------------------------------------------------------------------------

/** Render a Float64Array literal, wrapped, at per-number precision. */
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

const BANNER = (source: string, extra: string): string => `/**
 * GENERATED FILE — do not edit.
 *
 * Regenerate with \`bash notes/ephemeris-generate.sh\`, which truncates
 * ${source} from \`tests/fixtures/ephemeris-source/\` under the error budgets in
 * \`notes/ephemeris-generate.src.ts\`. The untruncated tables are evaluated by
 * the frozen reference in \`tests/reference/ephemeris-reference.ts\`, and
 * \`tests/validation/differential-ephemeris.test.ts\` measures the difference —
 * so the budgets quoted below are checked, not asserted.
 *
${extra}
 */
`;

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const ts = probes(20260806);
  const report: string[] = [];

  // ---- Moon -------------------------------------------------------------
  const canonical = canonicalElp();
  const moonParts: string[] = [];
  const moonMeta: string[] = [];
  const COORD = [
    { iv: 1 as const, name: 'LONGITUDE', budget: BUDGET.moonLon, unit: '″', extra: [] },
    { iv: 2 as const, name: 'LATITUDE', budget: BUDGET.moonLat, unit: '″',
      extra: [['COARSE', BUDGET.moonLatCoarse]] as const },
    { iv: 3 as const, name: 'DISTANCE', budget: BUDGET.moonDist, unit: ' km',
      extra: [['TRACK', BUDGET.moonDistTrack], ['COARSE', BUDGET.moonDistCoarse]] as const },
  ];
  /**
   * Emit one term set as two arrays, split by phase degree: the main problem
   * needs a quartic phase, every perturbation file needs only a linear one.
   * Keeping them apart halves the emitted numbers and lets the inner loops run
   * without a per-term degree test.
   */
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
      `export const ${prefix}_QUARTIC = new Float64Array([\n${floatArray(quarticValues, quarticTol)}\n]);`,
      `/** Stride 4: amplitude, phase, phase rate, power of t. */`,
      `export const ${prefix}_LINEAR = new Float64Array([\n${floatArray(linearValues, linearTol)}\n]);`,
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
      `${name}: ${count} terms, truncation error ≤ ${error.toPrecision(3)}${unit} over |t| ≤ ${T_MAX}.`
      + ` Stride 6: amplitude, then the five phase-polynomial coefficients.`,
    ));
    for (const [suffix, budgetValue] of extra) {
      const c = truncate(kept, evalElpTerm, budgetValue, ts);
      moonParts.push(...emitElp(
        `MOON_${name}_${suffix}`, kept.slice(0, c.count),
        `${name}, ${suffix.toLowerCase()}: ${c.count} terms, error ≤ ${c.error.toPrecision(3)}${unit}.`
        + ` Emitted separately rather than as a prefix because the split by phase degree`
        + ` does not preserve the amplitude ordering a prefix would need.`,
      ));
      report.push(`Moon ${name.toLowerCase()} ${suffix.toLowerCase().padEnd(6)} ${String(c.count).padStart(4)}        err ${c.error.toPrecision(3)}${unit}`);
    }
    moonMeta.push(` * | ${name.toLowerCase()} | ${budget}${unit} | ${count} of ${canonical[iv].length} | ${error.toPrecision(3)}${unit} |`);
    report.push(`Moon ${name.toLowerCase().padEnd(9)} ${String(count).padStart(5)} / ${canonical[iv].length}  err ${error.toPrecision(3)}${unit}`);
  }

  writeFileSync(`${OUT_DIR}/elp2000-82b.ts`, BANNER(
    'ELP2000-82B (Chapront-Touzé & Chapront; VizieR VI/79)',
    ` * The Moon's geocentric spherical coordinates in ELP's own frame: the mean\n`
    + ` * dynamical ecliptic **of date**, with longitude measured from the **inertial\n`
    + ` * J2000 origin**. The rotation to the equinox of date lives in \`../frame.ts\`;\n`
    + ` * it is not folded in here because it is a different published model and\n`
    + ` * mixing the two would make neither checkable.\n`
    + ` *\n`
    + ` * Each term is \`a · t^power · sin(phase(t))\`, t in Julian centuries TT from\n`
    + ` * J2000. Longitude and latitude are arcseconds; distance is kilometres, with\n`
    + ` * \`elp82b.f\`'s a0/ath scaling already folded into the amplitudes.\n`
    + ` *\n`
    + ` * | coordinate | budget | terms kept | measured |\n`
    + ` * |---|---|---|---|\n`
    + moonMeta.join('\n'),
  ) + `\n/** \`elp82b.f\`'s W1: the Moon's mean longitude polynomial, radians. */\nexport const MOON_MEAN_LONGITUDE = new Float64Array([\n${
    floatArray(ELP_CONST.w[1]!.slice(1), [1e-13, 1e-13, 1e-13, 1e-16, 1e-18])}\n]);\n\n`
    + moonParts.join('\n\n') + '\n');

  // ---- Sun and planets ---------------------------------------------------
  const bodies: VsopBody[] = ['ear', 'mer', 'ven', 'mar', 'jup', 'sat'];
  const vsopParts: string[] = [];
  const vsopMeta: string[] = [];
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
        `/** ${name}: ${count} of ${flat.length} terms; error ≤ ${(isAngle ? error * 206264.806 : error).toPrecision(3)}${isAngle ? '″' : ' AU'}. Stride 4: A, B, C, power of τ. */`,
        `export const ${name} = new Float64Array([\n${floatArray(values, tol)}\n]);`,
      );
      vsopMeta.push(` * | ${body} ${label} | ${count} of ${flat.length} | ${(isAngle ? error * 206264.806 : error).toPrecision(3)}${isAngle ? '″' : ' AU'} |`);
      report.push(`VSOP ${body} ${label}      ${String(count).padStart(5)} / ${flat.length}  err ${(isAngle ? error * 206264.806 : error).toPrecision(3)}${isAngle ? '″' : ' AU'}`);

      // A second, tighter copy of the Earth's angular series, for the planet
      // path. See BUDGET.planetEarthLon: the same numbers serve two consumers
      // whose error scales differ by the geocentric distance they divide by, and
      // one series cannot be right for both. Truncated from `flat`, not from
      // `kept` — this prefix is *longer* than the coarse one, not a subset.
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
          `/** ${name}_PRECISE: ${p.count} of ${flat.length} terms; error ≤ ${(p.error * 206264.806).toPrecision(3)}″.`
          + ` The planet path's Earth — see the budget note in the generator. */`,
          `export const ${name}_PRECISE = new Float64Array([\n${floatArray(preciseValues, preciseTol)}\n]);`,
        );
        vsopMeta.push(` * | ${body} ${label} precise | ${p.count} of ${flat.length} | ${(p.error * 206264.806).toPrecision(3)}″ |`);
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
          `/** EAR_R, coarse: ${c.count} terms, error ≤ ${c.error.toPrecision(3)} AU. Light-time only — see the budget note in the generator. */`,
          `export const EAR_R_COARSE = new Float64Array([\n${floatArray(coarse, coarseTol)}\n]);`,
        );
        report.push(`VSOP ear R coarse  ${String(c.count).padStart(5)}         err ${c.error.toPrecision(3)} AU`);
      }
    }
  }
  writeFileSync(`${OUT_DIR}/vsop87d.ts`, BANNER(
    'VSOP87D (Bretagnon & Francou 1988; VizieR VI/81)',
    ` * Heliocentric spherical coordinates — longitude and latitude in radians,\n`
    + ` * radius in AU — referred to the **mean dynamical ecliptic and equinox of\n`
    + ` * date**. That frame choice is why the solar path applies no precession at\n`
    + ` * all: version D already delivers of-date coordinates, so only nutation and\n`
    + ` * light-time separate it from apparent place.\n`
    + ` *\n`
    + ` * Each term is \`A · τ^power · cos(B + C·τ)\`, τ in Julian **millennia** TT\n`
    + ` * from J2000 — the argument VSOP87 is published in, kept rather than\n`
    + ` * rescaled so the coefficients match the catalogue line for line.\n`
    + ` *\n`
    + ` * | body / variable | terms kept | measured error |\n`
    + ` * |---|---|---|\n`
    + vsopMeta.join('\n'),
  ) + '\n' + vsopParts.join('\n\n') + '\n');

  // ---- Nutation ----------------------------------------------------------
  const { psi, eps } = readNutation();
  const nutParts: string[] = [];
  const nutMeta: string[] = [];
  /**
   * Largest |multiplier| anywhere in the kept terms. `frame.ts` builds
   * `sin(k·aᵢ)` / `cos(k·aᵢ)` tables up to this and folds terms together by
   * angle addition instead of calling `Math.sin` per term — so the bound has to
   * come from the generator rather than be a constant someone remembered, or a
   * budget change could silently index past the end of the table.
   */
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
      `/** ${label}: ${kept.length} of ${terms.length} terms; error ≤ ${error.toPrecision(3)}″. Stride 3: sin, cos (arcsec), power of t. */`,
      `export const NUTATION_${label} = new Float64Array([\n${floatArray(coefficients, coefficients.map(() => 1e-12))}\n]);`,
      `/** Stride 14: multipliers of l, l', F, D, Ω, and the nine planetary arguments. */`,
      `export const NUTATION_${label}_ARGS = new Int8Array([\n${floatArray(multipliers, multipliers.map(() => 0))}\n]);`,
    );
    nutMeta.push(` * | Δ${label === 'PSI' ? 'ψ' : 'ε'} | ${kept.length} of ${terms.length} | ${error.toPrecision(3)}″ |`);
    report.push(`Nutation ${label.padEnd(6)} ${String(kept.length).padStart(5)} / ${terms.length}  err ${error.toPrecision(3)}"`);
  }
  writeFileSync(`${OUT_DIR}/nutation-iau2000.ts`, BANNER(
    'the IAU 2000A nutation series (IERS Conventions 2010, tables 5.3a/5.3b)',
    ` * Terms are kept above a ${BUDGET.nutationCut * 1e6} µas amplitude cut-off rather than by the\n`
    + ` * binary search the position series use, because nutation's spectrum has no\n`
    + ` * long tail worth searching: the whole series is ~2,400 terms and 78 of them\n`
    + ` * carry it to 5 milliarcseconds.\n`
    + ` *\n`
    + ` * | series | terms kept | measured error |\n`
    + ` * |---|---|---|\n`
    + nutMeta.join('\n'),
  ) + '\n' + nutParts.join('\n\n') + '\n\n'
    + '/**\n'
    + ' * Largest |multiplier| appearing in either ARGS table above.\n'
    + ' *\n'
    + ' * `frame.ts` precomputes `sin(k·aᵢ)` and `cos(k·aᵢ)` for `k` up to this and\n'
    + ' * folds each term together by angle addition, so a term whose multiplier\n'
    + ' * exceeded it would read past the end of that table. Emitted here rather than\n'
    + ' * written there, so changing `nutationCut` cannot silently break it.\n'
    + ' */\n'
    + `export const NUTATION_MAX_MULTIPLIER = ${maxMultiplier};\n`);
  report.push(`Nutation max |multiplier| ${maxMultiplier}`);

  console.error(report.join('\n'));
}

/** Fundamental arguments, duplicated here so the generator stands alone. */
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
