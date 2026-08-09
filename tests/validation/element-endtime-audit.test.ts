/**
 * @tier 1  DrikPanchang.com — a drift audit, so the bound is Drik's quantization plus our error
 *
 * Drift audit for **element end times** (tithi / nakshatra / yoga / karana)
 * against DrikPanchang.
 *
 * `seconds-audit.test.ts` already audits sunrise/sunset, but those come
 * straight out of astronomy-engine at sub-second accuracy — they were never
 * the risky values. The end times are: each one is the output of a numeric
 * search, and until now nothing asserted them, even though
 * `drikpanchang-verified.json` has carried the Drik values all along.
 *
 * ## What this found — and what fixing it achieved
 *
 * The original audit found drift that split cleanly by *ayanamsa exposure*:
 * tithi and karana (Moon − Sun, ayanamsa cancels) ran late by ~35 s, while
 * nakshatra (ayanamsa once) ran 52 s early and yoga (ayanamsa twice) ran 106 s
 * early. That is the exact signature of a wrong ayanamsa constant, and it was:
 * the library's Lahiri sat 38″ behind DrikPanchang's. See `LAHIRI_J2000_DEG`
 * in `src/astronomy/ayanamsa.ts` for how the correct value was measured.
 *
 * Correcting it removed the sign split and most of the magnitude. A later
 * change — solving transitions by secant rather than bisecting to a tolerance —
 * removed the search's residual late bias (~6.7 s) on top of that:
 *
 *                                    original      + ayanamsa     + secant
 *   tithi      (ayanamsa cancels)   +6 … +57 s     +6 … +57 s    +2 … +46 s
 *   karana     (ayanamsa cancels)  +14 … +59 s    +14 … +59 s    +7 … +51 s
 *   nakshatra  (ayanamsa once)     −38 … −63 s     +4 … +26 s    −6 … +24 s
 *   yoga       (ayanamsa twice)    −69 … −131 s   +12 … +74 s    +6 … +60 s
 *
 * The ayanamsa correction left tithi and karana untouched, exactly as
 * predicted — it cannot affect a difference of two longitudes that both carry
 * it. The secant change moved all four, because the late bias it removed was
 * common to every search.
 *
 * There is no `precision` column: the secant solve converges to the root, which
 * is why the option that used to select a tighter tolerance no longer exists.
 *
 * ## What remains, and why it is not chased further
 *
 * All four now drift *late* by a similar amount. Three independent checks say
 * the remaining ~20 s is **not** something this library can fix:
 *
 *  1. **The search is not responsible.** Comparing each reported end time
 *     against an exact bisection of the same index function puts the search's
 *     own contribution at **≤24 ms** (mean 11 ms over 3,669 searches). The
 *     reported value *is* the true transition to within a rounding step.
 *  2. **The ephemeris is not responsible.** Drik publishes sidereal planetary
 *     positions to the arcsecond. Solving for the instant at which this
 *     library reproduces Drik's Surya and Chandra for 2025-01-14 gives two
 *     answers **7 seconds apart** — i.e. Sun and Moon agree with Drik's Swiss
 *     Ephemeris to well under an arcsecond at a common instant. A 1″ error
 *     would move a tithi boundary by ~2 s, so the ephemeris cannot produce
 *     tens of seconds of drift.
 *  3. **The residual is not self-consistent.** Solving for the library's
 *     errors in Moon, Sun and ayanamsa, the (m − s) implied by nakshatra+yoga
 *     disagrees with what tithi+karana measure directly by ~16″, and the
 *     per-fixture drift scatters from −6 s to +60 s with no pattern. No single
 *     constant fits, so there is no further offset waiting to be found.
 *
 * What is left is dominated by the reference itself: Drik publishes to the
 * minute, so every measurement here carries ±30 s of quantization, and five
 * fixtures cannot average that down. Tightening this needs reference end times
 * at seconds resolution, not a change to the library.
 *
 * ## Reading the reference values
 *
 * Drik prints `HH:MM`, and this audit compares against the *midpoint* of that
 * minute (+30 s), i.e. it assumes Drik truncates. That assumption is now
 * checked rather than assumed: comparing against the exact minute instead
 * (i.e. assuming Drik rounds) more than doubles the overall mean drift, from
 * 21.4 s to 50.8 s. Truncation is the convention.
 *
 * The bounds below are regression detectors, not independent accuracy checks;
 * see {@link TOLERANCE_SEC} for how their headroom is chosen.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import fixtures from '../fixtures/drikpanchang-verified.json';

type Fixture = {
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expected: {
    tithiEndHHMM?: string;
    nakshatraEndHHMM?: string;
    yogaEndHHMM?: string;
    karanaEndHHMM?: string;
  };
};

function noonUtc(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/**
 * Drik prints `HH:MM`, optionally suffixed `+1` for "next day". Treat the
 * printed minute as [HH:MM:00, HH:MM:59] and compare against its midpoint, so
 * a perfectly-accurate value scores 0 rather than ±30 s of rounding.
 */
function drikSecondsFromMidnight(hhmm: string): number {
  const nextDay = hhmm.endsWith('+1');
  const core = nextDay ? hhmm.slice(0, -2) : hhmm;
  const [h, m] = core.split(':').map(Number) as [number, number];
  return (nextDay ? 86_400 : 0) + h * 3600 + m * 60 + 30;
}

/**
 * Seconds from local midnight of `dateStr`, read from an offset-carrying ISO
 * string. v5: published `Date`s are true instants, so a UTC-midnight
 * subtraction no longer yields a local wall clock.
 */
function actualSecondsFromMidnight(local: string, dateStr: string): number {
  const dayDelta = Math.round(
    (Date.parse(`${local.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dateStr}T00:00:00Z`))
    / 86_400_000,
  );
  const [h, m, sec] = local.slice(11, 19).split(':').map(Number) as [number, number, number];
  return dayDelta * 86_400 + h * 3600 + m * 60 + sec;
}

/**
 * Per-element bounds. Intentionally *not* uniform.
 *
 * Measured maxima: tithi 42 s, karana 49 s, nakshatra 22 s, yoga 58 s. The
 * headroom above those is roughly one Drik quantum (±30 s), because that — not
 * the search, which now contributes ≤24 ms — is what dominates the spread. A
 * sixth fixture drawing badly could legitimately land ~30 s worse than any of
 * the five here, and the bounds have to survive that without being so loose
 * they stop detecting a real shift.
 *
 * For scale: these were 60 / 110 / 100 / 170 s before the ayanamsa correction,
 * and 46 / 51 / 24 / 60 s before Phase 36 replaced the ephemeris. The whole
 * port therefore moved Drik parity by 2–4 s, in the direction of Drik — which
 * on five fixtures is not evidence of improvement, only evidence that the
 * exit criterion ("no worse than the current ≤60 s") is met.
 */
const TOLERANCE_SEC: Record<string, number> = {
  tithi: 76,
  karana: 81,
  nakshatra: 54,
  yoga: 90,
};

const withEndTimes = (fixtures as Fixture[]).filter((f) => f.expected.tithiEndHHMM);

describe('Element end-time drift vs DrikPanchang', () => {
  it('has fixtures with published end times to audit', () => {
    // Guard against the audit silently becoming a no-op if the fixture shape
    // changes — these fields sat unused in the repo before this test existed.
    expect(withEndTimes.length).toBeGreaterThan(0);
  });

  for (const f of withEndTimes) {
    const r = getDailyPanchang(noonUtc(f.date), f.location, { timezone: f.timezone });
    if (r === null) throw new Error(`no panchang for ${f.date}`);

    const cases: [string, string | null, string | undefined][] = [
      ['tithi', r.angas.tithis[0]!.endTimeLocal, f.expected.tithiEndHHMM],
      ['nakshatra', r.angas.nakshatras[0]!.endTimeLocal, f.expected.nakshatraEndHHMM],
      ['yoga', r.angas.yogas[0]!.endTimeLocal, f.expected.yogaEndHHMM],
      ['karana', r.angas.karanas[0]!.endTimeLocal, f.expected.karanaEndHHMM],
    ];

    for (const [element, actual, expected] of cases) {
      if (expected === undefined || actual === null) continue;
      const tolerance = TOLERANCE_SEC[element]!;
      it(`${f.date} ${f.city} ${element} end within ±${tolerance}s of Drik (${expected})`, () => {
        const delta = actualSecondsFromMidnight(actual, f.date) - drikSecondsFromMidnight(expected);
        expect(Math.abs(delta), `drift ${delta.toFixed(0)}s`).toBeLessThanOrEqual(tolerance);
      });
    }
  }

  it('drift no longer grows with ayanamsa exposure', () => {
    // The invariant that guards the ayanamsa constant.
    //
    // Before the correction this ratio was ~2.3: drift scaled with how many
    // times the ayanamsa entered an element's formula (tithi/karana zero,
    // nakshatra once, yoga twice), which is precisely what a mistuned constant
    // produces. With the constant right, exposure no longer amplifies drift and
    // the ratio sits near 0.6.
    //
    // It is a sensitive detector because the leverage is large: an error of δ
    // arcsec adds ~1.8·δ seconds to nakshatra drift and ~3.4·δ to yoga. A 10″
    // regression — 0.003° — would push this back above 1.0 and fail here.
    //
    // Compared on means rather than maxima. A single fixture's worst case is
    // dominated by where its transition happens to fall inside the ±30 s search
    // bracket; the mean averages that out and isolates the systematic offset,
    // which is what the ayanamsa hypothesis predicts.
    const drifts = { elongation: [] as number[], ayanamsa: [] as number[] };

    for (const f of withEndTimes) {
      const r = getDailyPanchang(noonUtc(f.date), f.location, { timezone: f.timezone });
      if (r === null) continue;
      const push = (bucket: number[], actual: string | null, expected?: string) => {
        if (actual && expected) {
          bucket.push(Math.abs(
            actualSecondsFromMidnight(actual, f.date) - drikSecondsFromMidnight(expected),
          ));
        }
      };
      // Ayanamsa cancels in Moon − Sun.
      push(drifts.elongation, r.angas.tithis[0]!.endTimeLocal, f.expected.tithiEndHHMM);
      push(drifts.elongation, r.angas.karanas[0]!.endTimeLocal, f.expected.karanaEndHHMM);
      // Ayanamsa applies once (nakshatra) and twice (yoga).
      push(drifts.ayanamsa, r.angas.nakshatras[0]!.endTimeLocal, f.expected.nakshatraEndHHMM);
      push(drifts.ayanamsa, r.angas.yogas[0]!.endTimeLocal, f.expected.yogaEndHHMM);
    }

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanElongation = mean(drifts.elongation);
    const meanAyanamsa = mean(drifts.ayanamsa);

    expect(drifts.elongation.length).toBeGreaterThan(0);
    expect(
      meanElongation,
      `elongation-based mean drift ${meanElongation.toFixed(1)}s should stay ` +
        `within the search tolerance band`,
    ).toBeLessThan(60);
    expect(
      meanAyanamsa / meanElongation,
      `ayanamsa-exposed mean ${meanAyanamsa.toFixed(1)}s vs ayanamsa-free ` +
        `${meanElongation.toFixed(1)}s — a ratio above 1 means the ayanamsa ` +
        `constant has drifted from DrikPanchang's again`,
    ).toBeLessThan(1.0);
  });
});
