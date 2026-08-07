/**
 * @tier 0  JPL Horizons DE441, and IMCCE's own VSOP87 substitution results
 *
 * ## The acceptance gate for Phase 36.2's own Sun and Moon
 *
 * PLAN.md §36.0 D: an own implementation is accepted only if its max |error|
 * against Tier 0 is **≤ the baseline across the whole span** — not on average,
 * not just near 2025. The baseline is `astronomy-engine`'s own measured error
 * over the same 250 epochs, recorded in `tier0-horizons.test.ts`:
 *
 * | | max″ | mean″ | bias″ |
 * |---|---|---|---|
 * | Sun, `astronomy-engine` | 1.613 | 0.519 | −0.148 |
 * | Moon, `astronomy-engine` | 3.747 | 0.884 | +0.296 |
 *
 * This file measures the replacement against the same fixture and asserts
 * against the same ceilings. Both bodies come in several times inside them; the
 * bounds below are the *own* implementation's own observed maxima with
 * headroom, which is a tightening of the baseline and therefore allowed — the
 * baseline ceilings may only ever move down.
 *
 * ## What the three groups of assertion do, and why they are different
 *
 * 1. **Parser, against IMCCE.** `vsop87.chk` is the catalogue's own
 *    substitution results. It validates that the coefficients were read out of
 *    the files correctly, which the Horizons comparison structurally cannot: a
 *    column-offset bug and a theory error look identical in a longitude
 *    residual. This is the check that makes the rest of the chain meaningful.
 * 2. **Reference theory, against DE441.** Is the untruncated published theory
 *    good enough? This is the number §36.0 D asks for.
 * 3. **Shipped path, against DE441.** Does the truncated, optimized copy still
 *    clear the gate? The gap between 2 and 3 is the truncation budget; it is
 *    measured directly, over 100k instants, in
 *    `differential-ephemeris.test.ts`.
 *
 * Run with `TIER0_REPORT=1` to print the full per-body curve.
 */
import { describe, it, expect } from 'vitest';
import { getTropicalSunLongitude } from '../../src/astronomy/sun';
import { getTropicalMoonLongitude } from '../../src/astronomy/moon';
import { ttDaysSinceJ2000 } from '../../src/astronomy/deltaT';
import {
  sunApparentReference, moonApparentReference, vsopReference,
} from '../reference/ephemeris-reference';
import { readVsop87Check, type VsopBody } from '../reference/catalog';
import fixture from '../fixtures/horizons-positions.json';

const REPORT = process.env.TIER0_REPORT === '1';

/** Signed smallest angle a − b, degrees, in (−180, 180]. */
function angularDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * The UT instant whose Terrestrial Time is `jdTt`, per **this library's** ΔT.
 *
 * Same construction as `tier0-horizons.test.ts`, but inverting our own
 * `ttDaysSinceJ2000` rather than `astronomy-engine`'s `MakeTime`. That is what
 * makes ΔT cancel exactly and leaves position theory alone in the residual —
 * and ΔT has its own Tier 0 file (`tier0-own-deltat.test.ts`), so it is not
 * going unmeasured, it is being measured separately on purpose.
 */
function utDateForTt(jdTt: number): Date {
  const ttDays = jdTt - 2451545.0;
  let ms = ttDays * 86_400_000 + Date.UTC(2000, 0, 1, 12);
  for (let i = 0; i < 3; i++) {
    ms += (ttDays - ttDaysSinceJ2000(new Date(ms))) * 86_400_000;
  }
  return new Date(ms);
}

interface Curve { max: number; mean: number; bias: number; worstYear: number }

function measure(body: 'Sun' | 'Moon', longitudeAt: (jdTt: number) => number): Curve {
  const truth = (fixture.positions as Record<string, { elon: number }[]>)[body]!;
  let sumAbs = 0, sumSigned = 0, max = 0, worst = 0;
  for (let i = 0; i < fixture.jdTt.length; i++) {
    const jd = fixture.jdTt[i]!;
    const err = angularDelta(longitudeAt(jd), truth[i]!.elon) * 3600;
    sumAbs += Math.abs(err);
    sumSigned += err;
    if (Math.abs(err) > max) { max = Math.abs(err); worst = jd; }
  }
  const n = fixture.jdTt.length;
  return {
    max, mean: sumAbs / n, bias: sumSigned / n,
    worstYear: Math.round(2000 + (worst - 2451545.0) / 365.25),
  };
}

/**
 * Ceilings for the own implementation. Measured over the same 250 epochs as the
 * baseline, with ~15% headroom for cross-platform floating point.
 *
 * | | max″ | mean″ | bias″ | worst | baseline max″ |
 * |---|---|---|---|---|---|
 * | Sun, reference | 0.1152 | 0.0632 | +0.0201 | 2027 | 1.613 |
 * | Sun, shipped | **0.4196** | 0.0954 | +0.0038 | 1924 | 1.613 |
 * | Moon, reference | 1.2866 | 0.3779 | +0.3779 | 2098 | 3.747 |
 * | Moon, shipped | **1.3448** | 0.3736 | +0.3726 | 2098 | 3.747 |
 *
 * **Both shipped rows moved on 2026-08-07**, deliberately: the truncation
 * budgets were raised from 0.1″/0.2″ to 0.4″/0.4″ because the profile put the
 * lunar series at 47.9% of the library's self time and the Sun's at 8.5%, and
 * the old budgets were buying ten times the margin the ceilings ask for. The
 * reference rows are untouched — nothing about the *theory* changed — which is
 * what makes the two columns worth keeping side by side.
 *
 * Predicted before the change, from quadrature of theory and truncation:
 * Sun 0.42″, Moon 1.35″ (`notes/v5-step5-predictions.md`). Observed 0.4196″
 * and 1.3448″. That the prediction landed on the second decimal is the reason
 * to trust the same arithmetic when it says the fixture movement is ~1 s.
 *
 * Margin against the ceilings is now 3.8× for the Sun and 2.8× for the Moon.
 * The Moon's shipped max sits *above* its reference max by 0.058″, which is the
 * truncation adding to a residual that is almost entirely bias.
 *
 * The Moon's residual is almost pure bias — mean and bias are the same number
 * to three decimals — which says what is left is a frame offset between
 * ELP2000-82B's inertial J2000 equinox and the ICRS, not scatter in the theory.
 * Chapront et al. (2002) publish a rotation for exactly that. It is **not**
 * applied here: at 0.38″ it is a third of the remaining error and a fifth of
 * the truncation budget, and fitting a constant whose only justification would
 * be that it improves the Tier 0 residual is the circularity this whole
 * protocol exists to prevent. Recorded as a known, measured, bounded offset.
 */
const OWN_MAX_ARCSEC = { Sun: 0.5, Moon: 1.6 } as const;

describe('Tier 0 — own Sun and Moon vs JPL Horizons (DE441)', () => {
  it('the VSOP87D parser reproduces IMCCE\'s own substitution results', () => {
    // 60 epochs spanning JD 2122820–2451545 (1099–2000), six bodies, three
    // variables. Agreement here is a statement about the reader, not the theory.
    const bodyFile: Record<string, VsopBody> = {
      MERCURY: 'mer', VENUS: 'ven', EARTH: 'ear', MARS: 'mar', JUPITER: 'jup', SATURN: 'sat',
    };
    let checked = 0;
    let worst = 0;
    for (const row of readVsop87Check()) {
      const body = bodyFile[row.body];
      if (!body) continue;
      const [L, B, R] = vsopReference(body, row.jd);
      const dl = Math.abs(((L - row.l) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      worst = Math.max(worst, dl, Math.abs(B - row.b), Math.abs(R - row.r));
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(60);
    // 1e-9 rad is 2 × 10⁻⁴ arcsec — the printed precision of the check file.
    expect(worst, `worst |Δ| vs vsop87.chk was ${worst.toExponential(3)}`).toBeLessThan(1e-9);
  });

  const curves: Record<string, Curve> = {};

  for (const [label, sun, moon] of [
    ['reference (untruncated)', (jd: number) => sunApparentReference(jd).lonDeg,
      (jd: number) => moonApparentReference(jd).lonDeg],
    ['shipped (truncated)', (jd: number) => getTropicalSunLongitude(utDateForTt(jd)),
      (jd: number) => getTropicalMoonLongitude(utDateForTt(jd))],
  ] as const) {
    it(`Sun, ${label}: max |error| ≤ ${OWN_MAX_ARCSEC.Sun}″ across 1900–2100`, () => {
      const c = measure('Sun', sun);
      curves[`Sun ${label}`] = c;
      expect(
        c.max,
        `Sun ${label}: max ${c.max.toFixed(4)}″ (worst ~${c.worstYear}), mean ${c.mean.toFixed(4)}″, bias ${c.bias.toFixed(4)}″`,
      ).toBeLessThanOrEqual(OWN_MAX_ARCSEC.Sun);
    });

    it(`Moon, ${label}: max |error| ≤ ${OWN_MAX_ARCSEC.Moon}″ across 1900–2100`, () => {
      const c = measure('Moon', moon);
      curves[`Moon ${label}`] = c;
      expect(
        c.max,
        `Moon ${label}: max ${c.max.toFixed(4)}″ (worst ~${c.worstYear}), mean ${c.mean.toFixed(4)}″, bias ${c.bias.toFixed(4)}″`,
      ).toBeLessThanOrEqual(OWN_MAX_ARCSEC.Moon);
      // 30 s, not vitest's default 5 s. This walks 250 Horizons epochs through
      // the untruncated 37,872-term ELP reference, which is ~4 s of arithmetic
      // on an idle machine and comfortably past 5 s on a loaded one — so the
      // default budget made a deterministic Tier 0 assertion fail
      // intermittently, which is the worst kind of test there is. Observed at
      // load average 11 during the five-run close-out.
    }, 30_000);
  }

  it('comes in strictly better than the astronomy-engine baseline', () => {
    // The gate §36.0 D actually states. Kept separate from the tight bounds
    // above so that a future tightening of those cannot quietly weaken this.
    expect(measure('Sun', (jd) => getTropicalSunLongitude(utDateForTt(jd))).max).toBeLessThan(1.613);
    expect(measure('Moon', (jd) => getTropicalMoonLongitude(utDateForTt(jd))).max).toBeLessThan(3.747);
  });

  it('prints the error curves when TIER0_REPORT=1', () => {
    if (!REPORT) return;
    console.log('\nseries                          max″     mean″     bias″   worst yr');
    for (const [name, c] of Object.entries(curves)) {
      console.log(
        name.padEnd(30),
        c.max.toFixed(4).padStart(8),
        c.mean.toFixed(4).padStart(9),
        c.bias.toFixed(4).padStart(9),
        String(c.worstYear).padStart(10),
      );
    }
    expect(Object.keys(curves).length).toBeGreaterThan(0);
  });
});
