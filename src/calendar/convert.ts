import { getDailyPanchang, getInstantPanchang } from '../core/panchang';
import { computeSamvat } from '../core/samvat';
import { validateLocation, validateDate } from '../utils/validation';
import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';
import type { AyanamsaType, MasaSystem, FestivalRegion, LegacyFestivalRegion } from '../types/options';

/**
 * Hindu calendar coordinates for a UTC date — the lunar tithi and chandra
 * masa active at sunrise, plus the paksha label and Vikram/Shaka era years.
 *
 * `tithi` is in the 1..30 ordinal convention (1 = Shukla Pratipada,
 * 15 = Purnima, 16 = Krishna Pratipada, 30 = Amavasya). The internal
 * panchang result uses 0..29; this surface uses the human-facing 1..30.
 */
export interface HinduCalendarCoords {
  /** Localized tithi name (e.g. 'Shukla Tritiya'). */
  tithiName: string;
  /** Tithi ordinal 1..30 (1 = Shukla Pratipada … 30 = Amavasya). */
  tithi: number;
  /** Tithi 1..15 within the paksha. */
  pakshaTithi: number;
  /** 'shukla' (waxing) or 'krishna' (waning). */
  paksha: 'shukla' | 'krishna';
  /** Localized chandra masa name (e.g. 'Vaishakha'); includes 'Adhika' prefix when intercalary. */
  masaName: string;
  /** 0..11 chandra masa index in the configured `masaSystem` (default purnimanta). */
  masaIndex: number;
  /** True when the lunar month is intercalary (adhika maasa). */
  isAdhika: boolean;
  /** Vikram Samvat era year. */
  vikramSamvat: number;
  /** Shaka Samvat era year. */
  shakaSamvat: number;
  /** Localized vara (weekday) name. */
  varaName: string;
  /** Vara index 0..6 (0 = Sunday). */
  varaIndex: number;
}

export interface ConvertOptions {
  /** UTC offset in minutes (e.g. 330 for IST). Required. */
  timezone: number | string;
  /** Sidereal system. Defaults to `'lahiri'`. */
  ayanamsa?: AyanamsaType;
  /** Lunar month naming system. Defaults to `'purnimanta'`. */
  masaSystem?: MasaSystem;
  /** Output language. Defaults to `'en'`. */
  language?: 'en' | 'hi';
}

/**
 * Convert a Gregorian calendar date to its Hindu lunisolar coordinates.
 *
 * The day's Hindu coordinates are evaluated at *sunrise* — the canonical
 * Vedic anchor. Any time-of-day on the input `date` is ignored; only the
 * calendar day matters.
 *
 * @param date     Any UTC `Date` within the local calendar day to convert.
 * @param location Observer coordinates (sunrise depends on location).
 * @param options  `timezone` is required.
 *
 * @example
 * ```typescript
 * import { convertGregorianToHindu } from 'panchang-ts';
 * const h = convertGregorianToHindu(new Date('2026-04-15'), DELHI, { timezone: 330 });
 * h.masaName;      // e.g. 'Vaishakha'
 * h.tithi;         // 28 (Krishna Trayodashi, 13th from Krishna Pratipada)
 * h.vikramSamvat;  // 2083
 * ```
 */
export function convertGregorianToHindu(
  date: Date,
  location: GeoLocation,
  options: ConvertOptions,
): HinduCalendarCoords {
  validateDate(date);
  validateLocation(location);
  const panchang = getDailyPanchang(date, location, options);
  if (panchang === null) {
    throw new PanchangError(
      `Cannot convert ${date.toISOString()} to Hindu calendar — polar location with no sunrise`,
      'NO_SUNRISE',
    );
  }
  const tithiAtSunrise = panchang.tithis[0]!;
  return {
    tithiName: tithiAtSunrise.name,
    tithi: tithiAtSunrise.index + 1,
    pakshaTithi: tithiAtSunrise.number,
    paksha: tithiAtSunrise.index < 15 ? 'shukla' : 'krishna',
    masaName: panchang.chandramasa.name,
    masaIndex: panchang.chandramasa.index,
    isAdhika: panchang.chandramasa.isAdhika,
    vikramSamvat: panchang.samvat.vikramSamvat,
    shakaSamvat: panchang.samvat.shakaSamvat,
    varaName: panchang.vara.name,
    varaIndex: panchang.vara.index,
  };
}

/**
 * Convert Hindu lunisolar coordinates back to a Gregorian date.
 *
 * Searches the appropriate Vikram-Samvat-anchored window for sunrise dates
 * matching the requested (masa, paksha, tithi) triple. Returns one or two
 * dates — multiple when the requested tithi falls in both the standard
 * masa and the corresponding adhika masa, or when the tithi is "long"
 * (kshaya / vrddhi handling).
 *
 * @param coords    `{ vikramSamvat, masaIndex, paksha, pakshaTithi }`. The
 *                  `masaSystem` in `options` determines how `masaIndex` is
 *                  interpreted.
 * @param location  Observer coordinates.
 * @param options   `timezone` is required.
 *
 * @example
 * ```typescript
 * import { convertHinduToGregorian } from 'panchang-ts';
 * const dates = convertHinduToGregorian(
 *   { vikramSamvat: 2083, masaIndex: 0, paksha: 'shukla', pakshaTithi: 9 },
 *   DELHI,
 *   { timezone: 330 },
 * );
 * dates[0]; // Rama Navami 2026
 * ```
 */
export function convertHinduToGregorian(
  coords: {
    vikramSamvat: number;
    masaIndex: number;
    paksha: 'shukla' | 'krishna';
    pakshaTithi: number;
    /** When true, match only adhika maasa (default false). */
    adhikaOnly?: boolean;
  },
  location: GeoLocation,
  options: ConvertOptions,
): Date[] {
  validateLocation(location);
  if (!Number.isInteger(coords.masaIndex) || coords.masaIndex < 0 || coords.masaIndex > 11) {
    throw new RangeError(`masaIndex must be in [0, 11], got ${coords.masaIndex}`);
  }
  if (!Number.isInteger(coords.pakshaTithi) || coords.pakshaTithi < 1 || coords.pakshaTithi > 15) {
    throw new RangeError(`pakshaTithi must be in [1, 15], got ${coords.pakshaTithi}`);
  }
  if (coords.paksha !== 'shukla' && coords.paksha !== 'krishna') {
    throw new RangeError(`paksha must be 'shukla' or 'krishna'`);
  }

  // Vikram Samvat → CE: VS = CE + 57 after Chaitra new year. The masa year
  // anchors at Chaitra Shukla Pratipada in late March of (vikramSamvat - 57).
  // Each chandra masa is ~30 days; we sweep a ±50-day window around the
  // expected masa midpoint to absorb adhika-masa shifts and tithi placement.
  const ceYear = coords.vikramSamvat - 57;
  const dayMs = 24 * 3600_000;
  const anchorMs = Date.UTC(ceYear, 2, 25);    // ~late March
  const masaMidMs = anchorMs + coords.masaIndex * 30 * dayMs;
  const start = new Date(masaMidMs - 50 * dayMs);
  const end = new Date(masaMidMs + 60 * dayMs);
  const targetTithi = coords.paksha === 'shukla'
    ? coords.pakshaTithi - 1
    : coords.pakshaTithi - 1 + 15;

  const out: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const p = getDailyPanchang(d, location, options);
    if (p === null) continue;
    const tithi = p.tithis[0]!.index;
    const masa = p.chandramasa.index;
    if (tithi !== targetTithi) continue;
    if (masa !== coords.masaIndex) continue;
    if (p.samvat.vikramSamvat !== coords.vikramSamvat) continue;
    if (coords.adhikaOnly && !p.chandramasa.isAdhika) continue;
    out.push(p.date);
  }
  return out;
}

// ── Kali Yuga year + Hindu New Year + Karana index helpers ─────

const KALIYUGA_EPOCH_YEAR = -3101; // 3102 BCE (proleptic) / Kali Yuga begins 18 Feb 3102 BCE.

/**
 * Compute the Kali Yuga year for a given Gregorian date. Kali Yuga began
 * on 18 February 3102 BCE per traditional reckoning; this helper returns
 * the integer year-count from that epoch.
 *
 * @example
 * ```typescript
 * getKaliYugaYear(new Date('2026-01-01')); // 5127
 * ```
 */
export function getKaliYugaYear(date: Date): number {
  validateDate(date);
  // Approximate: KY year = CE year - (-3101) = CE + 3101 (proleptic Gregorian).
  // For dates before 18 Feb in any year, subtract 1.
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const beforeEpochAnniv = m < 1 || (m === 1 && d < 18);
  return y - KALIYUGA_EPOCH_YEAR - (beforeEpochAnniv ? 1 : 0);
}

/**
 * Region-keyed Hindu New Year date for a given Gregorian year. Different
 * regional traditions celebrate the new year at different points:
 *
 *   - **Most regions** (Maharashtra Gudi Padwa, Andhra/Karnataka Ugadi,
 *     Sindhi Cheti Chand, Vikrami Samvat North) — Chaitra Shukla Pratipada,
 *     ≈ March/April.
 *   - **Tamil Nadu (Puthandu)** — Mesha Sankranti, ≈ April 14.
 *   - **Punjab (Baisakhi)** — Mesha Sankranti, ≈ April 13/14 (same solar
 *     anchor as Puthandu).
 *   - **Kerala (Vishu)** — Mesha Sankranti, same anchor.
 *   - **Bengal (Pohela Boishakh)** — Mesha Sankranti, ≈ April 14 (Bengali
 *     calendar uses solar months only).
 *   - **Assam (Bohag Bihu)** — Mesha Sankranti.
 *
 * For **`'all'`** and the default we return Chaitra Shukla Pratipada
 * (the most-widely-celebrated point); other regions use their solar anchor.
 *
 * @param gregorianYear Gregorian year.
 * @param region        Regional convention (see {@link FestivalRegion}).
 * @param location      Observer coordinates (defaults to a representative
 *                      Indian location). The new year date can shift by
 *                      ±1 day across longitudes.
 * @param options       `timezone` is required.
 *
 * @example
 * ```typescript
 * getHinduNewYear(2026, 'all', DELHI, { timezone: 330 });
 * // → ≈ Date('2026-03-19T...') for Chaitra Shukla Pratipada
 * ```
 */
export function getHinduNewYear(
  gregorianYear: number,
  region: FestivalRegion | LegacyFestivalRegion,
  location: GeoLocation,
  options: ConvertOptions,
): Date | null {
  validateLocation(location);
  if (!Number.isInteger(gregorianYear)) {
    throw new RangeError(`gregorianYear must be integer, got ${gregorianYear}`);
  }

  const useSolarAnchor = (
    region === 'tamil' || region === 'tamil-nadu' ||
    region === 'kerala' ||
    region === 'punjab' ||
    region === 'bengal' || region === 'west-bengal' ||
    region === 'assam'
  );

  if (useSolarAnchor) {
    // Mesha Sankranti — Sun's transit into Aries (rashi 0). Sweep April.
    return findMeshaSankranti(gregorianYear, location, options);
  }

  // Default: Chaitra Shukla Pratipada — sweep mid-March through mid-April.
  return findChaitraShuklaPratipada(gregorianYear, location, options);
}

function findChaitraShuklaPratipada(
  gregorianYear: number,
  location: GeoLocation,
  options: ConvertOptions,
): Date | null {
  // Use the Amanta masa indexing to locate the Chaitra start regardless of
  // the caller's `masaSystem`. In Amanta, Chaitra begins on Shukla
  // Pratipada — the same day the New Year is celebrated. In kshaya-tithi
  // years (e.g. Ugadi 2026 in IST) the sunrise tithi may already be
  // Dwitiya; we still pick the first day where Amanta masa == Chaitra
  // since that is the masa-boundary day under the Amanta system.
  const amantaOptions = { ...options, masaSystem: 'amanta' as const };
  const start = new Date(Date.UTC(gregorianYear, 1, 15));  // mid-Feb
  const end = new Date(Date.UTC(gregorianYear, 3, 30));    // April 30
  const dayMs = 24 * 3600_000;
  let prevMasa: number | null = null;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const p = getDailyPanchang(d, location, amantaOptions);
    if (p === null) continue;
    const masa = p.chandramasa.index;
    if (prevMasa !== null && prevMasa !== 0 && masa === 0 && !p.chandramasa.isAdhika) {
      return p.date;
    }
    prevMasa = masa;
  }
  return null;
}

function findMeshaSankranti(
  gregorianYear: number,
  location: GeoLocation,
  options: ConvertOptions,
): Date | null {
  const start = new Date(Date.UTC(gregorianYear, 3, 1));   // April 1
  const end = new Date(Date.UTC(gregorianYear, 3, 30));    // April 30
  const dayMs = 24 * 3600_000;
  let prevRashi: number | null = null;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const p = getInstantPanchang(d, location, options);
    if (p === null) continue;
    const rashi = Math.floor(p.siderealSun / 30) % 12;
    if (prevRashi !== null && prevRashi !== 0 && rashi === 0) {
      // Bisect to the day Sun crossed into Aries.
      // Coarse precision (1 day) is sufficient for region-specific almanacs.
      return d;
    }
    prevRashi = rashi;
  }
  return null;
}

// Re-export computeSamvat for callers who want raw era numbers without the
// full panchang computation.
export { computeSamvat };
