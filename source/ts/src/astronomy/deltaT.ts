/**
 * ΔT = TT − UT, from Espenak & Meeus, *Five Millennium Canon of Solar Eclipses*
 * (NASA/TP-2006-214141), Section 4, whose post-2005 branches Earth has since
 * outrun; measured leap seconds take over wherever they exist.
 */

const DAYS_PER_TROPICAL_YEAR = 365.24217;

const J2000_JD = 2451545.0;

/** ΔT in seconds for a decimal year (2025.5 = mid-2025); each branch keeps the source's own centering constant. */
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

/** The decimal year uses mean-tropical-year days, not Espenak's `(month − 0.5)/12`; they differ far below the model's own error. */
export function deltaTSeconds(date: Date): number {
  const ms = date.getTime();
  // The `− 14` reproduces Espenak's convention that y = 2000 is 2000-Jan-15.
  const utDays = (ms - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const year = 2000 + (utDays - 14) / DAYS_PER_TROPICAL_YEAR;

  if (ms < LEAP_SECOND_EPOCH_MS) return deltaTSecondsForYear(year);
  if (ms <= OBSERVED_THROUGH_MS) return TT_MINUS_TAI + taiMinusUtc(ms);
  return deltaTSecondsForYear(year) + OBSERVED_MINUS_MODEL_AT_HANDOFF;
}

/** TAI − UTC as `[UTC epoch ms, seconds]`: the complete IERS leap-second list from 1972-01-01. */
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

/** Start of the modern UTC scale. */
const LEAP_SECOND_EPOCH_MS = TAI_MINUS_UTC[0]![0];

/** How far the measured era runs; bump this and the table above when a leap second is announced or confirmed absent. */
const OBSERVED_THROUGH_MS = Date.UTC(2027, 0, 1);

function taiMinusUtc(ms: number): number {
  let offset = TAI_MINUS_UTC[0]![1];
  for (const [epoch, seconds] of TAI_MINUS_UTC) {
    if (ms < epoch) break;
    offset = seconds;
  }
  return offset;
}

/** Carried forward so the continuation keeps the model's shape without its measured bias; holding the last observation flat abandons the secular slowing. */
const OBSERVED_MINUS_MODEL_AT_HANDOFF: number = (() => {
  const utDays = (OBSERVED_THROUGH_MS - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const year = 2000 + (utDays - 14) / DAYS_PER_TROPICAL_YEAR;
  return TT_MINUS_TAI + taiMinusUtc(OBSERVED_THROUGH_MS) - deltaTSecondsForYear(year);
})();


/** Preferred over an absolute Julian Date, which near the present spends 7 of a double's ~16 significant digits on its integer part, leaving ~10 µs. */
export function ttDaysSinceJ2000(date: Date): number {
  const utDays = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  return utDays + deltaTSeconds(date) / 86400;
}

/** Carries ~10 µs of representation loss; use only at a boundary demanding a JD. */
export function terrestrialTimeJd(date: Date): number {
  return J2000_JD + ttDaysSinceJ2000(date);
}

export function julianCenturiesTt(date: Date): number {
  return ttDaysSinceJ2000(date) / 36525;
}
