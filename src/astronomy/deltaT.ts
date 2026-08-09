/**
 * ΔT = TT − UT, the first module of the own-ephemeris port (Phase 36.2).
 *
 * ## Why this one goes first
 *
 * Every other module depends on it and none of them can reveal a mistake in it.
 * A ΔT that is wrong by δ seconds moves **every** body's computed position by
 * δ × its mean motion — which reads as ordinary theory error spread evenly
 * across the ephemeris, exactly the shape a series-coefficient typo would take.
 * And because the library reports *times*, a ΔT error of δ moves a published
 * tithi or nakshatra end-time by the whole δ, not by some attenuated fraction.
 * PLAN.md §36.2: "Getting this wrong shifts everything uniformly and looks
 * plausible — pin it with its own tests."
 *
 * So it is validated on its own, against its own Tier 0 fixture, before
 * anything is built on top of it. See `tests/validation/tier0-deltat.test.ts`.
 *
 * ## Status: reference implementation, frozen, and wired in
 *
 * §36.0 H's ordering is *correct first, frozen second, fast third*. This is the
 * reference: the published piecewise polynomials transcribed directly, with no
 * algebraic rearrangement, so it can be read against the source. It is also
 * what ships — a degree-7 polynomial evaluation has no optimization worth the
 * risk, so reference and optimized are the same code.
 *
 * `ttDaysSinceJ2000` is the UT→TT conversion for the whole library: sun, moon,
 * planet, riseSet, horizon, topocentric and eclipseGeometry all route through
 * it. (Through 4.x this read "nothing calls it yet, `MakeTime` still does the
 * conversion" — that was true only while astronomy-engine was still a
 * dependency, which v5 removed.)
 *
 * ## This is the one input here that ages
 *
 * Every other series in `src/astronomy/` is an analytical theory with fixed
 * coefficients — VSOP87D, ELP2000-82B, the IAU 2000A nutation tables. They are
 * not observations and do not go stale; they change only if the IAU adopts a
 * new model, which has happened roughly twice in fifty years.
 *
 * ΔT is different: Earth's rotation is not predictable, so the post-2005
 * branches below are an *extrapolation* published in 2006, and Earth has not
 * followed it. Earth spun faster than Espenak–Meeus assumed, so the model now
 * over-predicts. Against the leap-second chain (TT − UT1 = 32.184 + (TAI − UTC)
 * − (UT1 − UTC), with |UT1 − UTC| ≤ 0.9 s by construction):
 *
 * | year | this model | observed | error |
 * |---|---|---|---|
 * | 2006 | 65.05 s | 65.18 s | −0.13 s |
 * | 2015 | 69.01 s | 67.18 s | +1.83 s |
 * | 2020 | 71.60 s | 69.18 s | +2.42 s |
 * | 2026 | 75.07 s | 69.18 s | +5.89 s |
 *
 * Drifting roughly +0.6 s/year. Because the library reports *times*, that lands
 * directly on published tithi and nakshatra end-times — though at ~6 s it is
 * still an order of magnitude below the minute those are displayed to, and
 * rise/set times are far less affected (the error scales against the 15°/hr sky
 * rotation, so even 133 s of ΔT is ~0.4 s of sunrise).
 *
 * ### So the measured era uses measurement
 *
 * `deltaTSeconds` prefers the leap-second chain wherever ΔT has actually been
 * measured, and resumes Espenak–Meeus *offset* beyond it. Three eras:
 *
 * | span | source | accuracy |
 * |---|---|---|
 * | before 1972 | Espenak–Meeus | fitted to eclipse/occultation records |
 * | 1972 → handoff | `32.184 + (TAI − UTC)` | exact; ≤0.9 s from TT − UT1 |
 * | after handoff | Espenak–Meeus + offset | model shape, measured bias removed |
 *
 * The middle row reproduces `tests/fixtures/horizons-deltat.json` to 0.005 s at
 * every decade from 1980 — Horizons' post-1972 ΔT *is* that chain.
 *
 * Continuing the model *shifted* rather than holding the last observation flat
 * is what keeps the far future usable. Holding flat abandons the secular
 * slowing and runs ~134 s adrift by 2100, which wrecked agreement with NASA's
 * Five Millennium Canon (solar first contact blew out to 338 s against a 70 s
 * bound). Carrying the offset keeps the divergence at the ~6.5 s the two models
 * genuinely differ by. That offset is an assumption — that a measured
 * discrepancy persists rather than decays — and it is the conservative one.
 *
 * What this cost, all of it re-derived and confirmed before re-pinning: every
 * published instant in the measured era moves by the ΔT delta (~5.7 s in 2025),
 * and the Reykjavik Tula Sankranti of 2025 — a case that turns on the sign of
 * `transit − sunrise` — saw its margin narrow from 7.1 s to 1.4 s. It still
 * falls on Oct 16, but now by less than the solar error bar. See
 * `tier2-sankranti-day-margin.test.ts`.
 *
 * ## Source
 *
 * Espenak & Meeus, *Five Millennium Canon of Solar Eclipses: −1999 to +3000*
 * (NASA/TP-2006-214141), Section 4 — the same polynomial set NASA publishes at
 * `eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html` and the same one
 * `astronomy-engine` uses, which is what makes a differential test between them
 * meaningful rather than circular.
 *
 * ## The limitation this model carries, stated rather than inherited
 *
 * Espenak–Meeus models **TT − UT1**. This library's public API takes a JS
 * `Date`, which is **UTC**. Those agree only while leap seconds keep UTC within
 * 0.9 s of UT1 — and CGPM Resolution 4 (2022) resolved to stop inserting leap
 * seconds by 2035. After that, UTC ceases to track UT1 and the difference
 * accumulates: measured against Horizons' frozen-leap-second baseline it
 * reaches ~24 s by 2050 and ~134 s by 2100.
 *
 * This is why the leap-second chain above is used only from 1972 on: before
 * that UTC does not exist and there is nothing to chain, so the model stands.
 * Within the chain's span the distinction costs at most 0.9 s — far less than
 * the ~6 s of model bias it removes — so tracking UTC there is the better trade
 * even for a UT1-based reading. Past 2035 the two genuinely part company, and
 * the offset continuation keeps following UT1's shape rather than UTC's. The
 * exposure is pinned in `tier0-deltat.test.ts` so it stays a known quantity.
 */

/** Days per mean tropical year, for the day-count → decimal-year conversion. */
const DAYS_PER_TROPICAL_YEAR = 365.24217;

/** Julian date of the J2000.0 epoch, 2000-01-01 12:00 TT. */
const J2000_JD = 2451545.0;

/**
 * Espenak–Meeus ΔT, in seconds, for a decimal year.
 *
 * Transcribed piecewise from the published table with the segment boundaries
 * intact. Each branch keeps the source's own centering constant (`u = (y −
 * 1820)/100`, `t = y − 1975`, …) rather than being re-expressed around a common
 * origin, because the point of a reference implementation is that it can be
 * checked line by line against the paper.
 *
 * @param y  Decimal year, e.g. 2025.5 for mid-2025.
 */
export function deltaTSecondsForYear(y: number): number {
  let u: number, t: number;

  if (y < -500) {
    u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 500) {
    u = y / 100;
    return 10583.6 - 1014.41 * u + 33.78311 * u ** 2 - 5.952053 * u ** 3
      - 0.1798452 * u ** 4 + 0.022174192 * u ** 5 + 0.0090316521 * u ** 6;
  }
  if (y < 1600) {
    u = (y - 1000) / 100;
    return 1574.2 - 556.01 * u + 71.23472 * u ** 2 + 0.319781 * u ** 3
      - 0.8503463 * u ** 4 - 0.005050998 * u ** 5 + 0.0083572073 * u ** 6;
  }
  if (y < 1700) {
    t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129;
  }
  if (y < 1800) {
    t = y - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3
      - t ** 4 / 1174000;
  }
  if (y < 1860) {
    t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3
      - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6
      + 0.000000000875 * t ** 7;
  }
  if (y < 1900) {
    t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3
      - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) {
    t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3
      - 0.000197 * t ** 4;
  }
  if (y < 1941) {
    t = y - 1920;
    return 21.20 + 0.84493 * t - 0.076100 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3
      + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y < 2050) {
    t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  if (y < 2150) {
    u = (y - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - y);
  }
  u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

/**
 * ΔT in seconds at a UT instant.
 *
 * The decimal year uses the mean-tropical-year day count rather than a calendar
 * decomposition. Espenak defines `y = year + (month − 0.5)/12`; the two differ
 * by at most a few hundredths of a year, which at the modern era's ~0.3–1 s per
 * year of ΔT slope is under 0.04 s — far below the model's own ~1 s agreement
 * with observation, and below the 0.9 s UT1/UTC band that bounds any comparison
 * against a UTC-tagged source anyway.
 */
export function deltaTSeconds(date: Date): number {
  const ms = date.getTime();
  // Days since J2000.0, in UT. The `− 14` reproduces Espenak's convention that
  // y = 2000 corresponds to 2000-Jan-15, the midpoint of January.
  const utDays = (ms - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const year = 2000 + (utDays - 14) / DAYS_PER_TROPICAL_YEAR;

  // Before the UTC scale exists there is nothing to measure — Espenak–Meeus,
  // fitted to eclipse and occultation records, is the model.
  if (ms < LEAP_SECOND_EPOCH_MS) return deltaTSecondsForYear(year);
  // Measured era: exact, from the leap-second chain.
  if (ms <= OBSERVED_THROUGH_MS) return TT_MINUS_TAI + taiMinusUtc(ms);
  // Beyond it, resume Espenak–Meeus carrying the offset it had accumulated by
  // the handoff, so the curve's shape is kept and its bias is not.
  return deltaTSecondsForYear(year) + OBSERVED_MINUS_MODEL_AT_HANDOFF;
}

/**
 * TAI − UTC, the leap-second step function, as `[UTC epoch ms, seconds]`.
 *
 * The complete IERS list from the start of the modern UTC scale on 1972-01-01
 * (10 s) through the most recent leap second, 2017-01-01 (37 s). Verified
 * against `tests/fixtures/horizons-deltat.json` at every decade from 1980 —
 * Horizons' post-1972 ΔT *is* `32.184 + (TAI − UTC)`, so that fixture checks
 * this table rather than merely coexisting with it.
 */
const TAI_MINUS_UTC: readonly (readonly [number, number])[] = [
  [Date.UTC(1972, 0, 1), 10], [Date.UTC(1972, 6, 1), 11], [Date.UTC(1973, 0, 1), 12],
  [Date.UTC(1974, 0, 1), 13], [Date.UTC(1975, 0, 1), 14], [Date.UTC(1976, 0, 1), 15],
  [Date.UTC(1977, 0, 1), 16], [Date.UTC(1978, 0, 1), 17], [Date.UTC(1979, 0, 1), 18],
  [Date.UTC(1980, 0, 1), 19], [Date.UTC(1981, 6, 1), 20], [Date.UTC(1982, 6, 1), 21],
  [Date.UTC(1983, 6, 1), 22], [Date.UTC(1985, 6, 1), 23], [Date.UTC(1988, 0, 1), 24],
  [Date.UTC(1990, 0, 1), 25], [Date.UTC(1991, 0, 1), 26], [Date.UTC(1992, 6, 1), 27],
  [Date.UTC(1993, 6, 1), 28], [Date.UTC(1994, 6, 1), 29], [Date.UTC(1996, 0, 1), 30],
  [Date.UTC(1997, 6, 1), 31], [Date.UTC(1999, 0, 1), 32], [Date.UTC(2006, 0, 1), 33],
  [Date.UTC(2009, 0, 1), 34], [Date.UTC(2012, 6, 1), 35], [Date.UTC(2015, 6, 1), 36],
  [Date.UTC(2017, 0, 1), 37],
];

/** TT − TAI, fixed by definition. */
const TT_MINUS_TAI = 32.184;

/** Start of the modern UTC scale; before this there are no leap seconds to chain. */
const LEAP_SECOND_EPOCH_MS = TAI_MINUS_UTC[0]![0];

/**
 * How far the measured era is taken to run.
 *
 * Leap seconds are announced only six months ahead, so beyond this the chain is
 * an assumption rather than a measurement, and the model takes over. Bumping
 * this forward is the maintenance action when a leap second is announced (or
 * confirmed absent) — the table above and this date are the only things that
 * need touching.
 */
const OBSERVED_THROUGH_MS = Date.UTC(2027, 0, 1);

/** TAI − UTC at a UTC instant, holding the last announced value forward. */
function taiMinusUtc(ms: number): number {
  let offset = TAI_MINUS_UTC[0]![1];
  for (const [epoch, seconds] of TAI_MINUS_UTC) {
    if (ms < epoch) break;
    offset = seconds;
  }
  return offset;
}

/**
 * Observed minus modelled ΔT at {@link OBSERVED_THROUGH_MS} — the bias
 * Espenak–Meeus has accumulated by the handoff, carried forward as a constant.
 *
 * Espenak–Meeus was published in 2006 and its post-2005 branches are an
 * extrapolation; Earth then spun faster than it assumed, so by the handoff the
 * model reads ~5.9 s high. Two ways to continue past measurement are wrong in
 * opposite directions: holding the observed value flat abandons the secular
 * slowing entirely (~134 s adrift by 2100, which wrecks agreement with NASA's
 * Five Millennium Canon), while using the model raw keeps a bias we have
 * measured and know to be there. Continuing the model *shifted* keeps its shape
 * and drops its offset, so the far future stays within ~6 s of the canon
 * instead of ~134.
 *
 * This is an assumption — that the accumulated offset persists rather than
 * decays — and it is the conservative one: it asserts no new physics, only that
 * a measured discrepancy does not spontaneously vanish. Adopting a newer
 * published ΔT expression whole would supersede it.
 */
const OBSERVED_MINUS_MODEL_AT_HANDOFF: number = (() => {
  const utDays = (OBSERVED_THROUGH_MS - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const year = 2000 + (utDays - 14) / DAYS_PER_TROPICAL_YEAR;
  return TT_MINUS_TAI + taiMinusUtc(OBSERVED_THROUGH_MS) - deltaTSecondsForYear(year);
})();


/**
 * Days of Terrestrial Time since J2000.0 — the primitive every ephemeris series
 * in 36.2–36.5 will be built on.
 *
 * ## Why this, and not a Julian Date, is the primitive
 *
 * A JD near the present is ~2.46 × 10⁶, so a double spends 7 of its ~16
 * significant digits on the integer part and leaves ~10⁻¹⁰ day of resolution —
 * about 10 µs. Round-tripping TT through an absolute JD therefore loses ~6 µs,
 * measurably. It does not matter for accuracy (the Moon moves 0.549″/s, so 6 µs
 * is 3 × 10⁻⁶ arcsec) but it does mean an identity test written the obvious way
 * fails, and a reader is then left deciding whether the failure is precision or
 * a bug.
 *
 * Keeping the small quantity small removes the question: days-since-J2000 is
 * ~10⁴, so full double precision reaches picoseconds. {@link terrestrialTimeJd}
 * is still provided for interoperability, and carries the loss.
 */
export function ttDaysSinceJ2000(date: Date): number {
  const utDays = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  return utDays + deltaTSeconds(date) / 86400;
}

/**
 * Terrestrial Time as an absolute Julian Date.
 *
 * Carries ~10 µs of representation loss — see {@link ttDaysSinceJ2000}. Prefer
 * that function inside the ephemeris; use this one only at a boundary that
 * demands a JD.
 */
export function terrestrialTimeJd(date: Date): number {
  return J2000_JD + ttDaysSinceJ2000(date);
}

/** Julian centuries of TT since J2000.0 — the argument of every VSOP/ELP series. */
export function julianCenturiesTt(date: Date): number {
  return ttDaysSinceJ2000(date) / 36525;
}
