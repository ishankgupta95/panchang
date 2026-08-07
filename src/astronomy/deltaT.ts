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
 * ## Status: reference implementation, frozen, not yet wired in
 *
 * §36.0 H's ordering is *correct first, frozen second, fast third*. This is the
 * reference: the published piecewise polynomials transcribed directly, with no
 * algebraic rearrangement, so it can be read against the source. It is also
 * what ships — a degree-7 polynomial evaluation has no optimization worth the
 * risk, so reference and optimized are the same code and the differential test
 * §36.0 H prescribes is instead run against `astronomy-engine`'s independent
 * implementation of the same model.
 *
 * Nothing calls it yet. `MakeTime` still performs the UT→TT conversion
 * throughout `src/`, and swapping that over is the rest of 36.2's work; doing
 * it here would move published values for no reason while the surrounding
 * series are still external.
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
 * This is preserved deliberately, not by accident. Switching to TT − UTC would
 * be wrong for the historical span (where UTC does not exist) and would make
 * the library disagree with every published panchang, which uses UT1-based
 * time. The exposure is pinned in `tier0-deltat.test.ts` so it stays a known
 * quantity.
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
  // Days since J2000.0, in UT. The `− 14` reproduces Espenak's convention that
  // y = 2000 corresponds to 2000-Jan-15, the midpoint of January.
  const utDays = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  return deltaTSecondsForYear(2000 + (utDays - 14) / DAYS_PER_TROPICAL_YEAR);
}

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
