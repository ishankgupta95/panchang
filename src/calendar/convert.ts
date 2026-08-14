import { getDailyPanchang } from '../core/panchang';
import { computeSamvat, chaitraNewMoon } from '../core/samvat';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { resolveUtcOffset } from '../utils/timezone';
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
  const tithiAtSunrise = panchang.angas.tithis[0]!;
  return {
    tithiName: tithiAtSunrise.name,
    tithi: tithiAtSunrise.index + 1,
    pakshaTithi: tithiAtSunrise.number,
    paksha: tithiAtSunrise.index < 15 ? 'shukla' : 'krishna',
    masaName: panchang.calendar.chandramasa.name,
    masaIndex: panchang.calendar.chandramasa.index,
    isAdhika: panchang.calendar.chandramasa.isAdhika,
    vikramSamvat: panchang.calendar.samvat.vikramSamvat,
    shakaSamvat: panchang.calendar.samvat.shakaSamvat,
    varaName: panchang.angas.vara.name,
    varaIndex: panchang.angas.vara.index,
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
  //
  // One coordinate wraps around the year: under purnimanta, Chaitra *Krishna*
  // is the closing fortnight of the VS year — it precedes the samvat increment,
  // so it carries masaIndex 0 with the OLD samvat while falling ~12 months
  // after that samvat's Chaitra Shukla anchor. Anchoring it like every other
  // masa put the sweep a year early and the conversion returned []. That
  // fortnight gets its own window around the FOLLOWING March instead.
  const ceYear = coords.vikramSamvat - 57;
  const dayMs = 24 * 3600_000;
  const masaSystem = options.masaSystem ?? 'purnimanta';
  const wrapsYearEnd =
    masaSystem === 'purnimanta' && coords.masaIndex === 0 && coords.paksha === 'krishna';
  const masaMidMs = wrapsYearEnd
    ? Date.UTC(ceYear + 1, 2, 10)
    : Date.UTC(ceYear, 2, 25) + coords.masaIndex * 30 * dayMs;
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
    const tithi = p.angas.tithis[0]!.index;
    const masa = p.calendar.chandramasa.index;
    if (tithi !== targetTithi) continue;
    if (masa !== coords.masaIndex) continue;
    if (p.calendar.samvat.vikramSamvat !== coords.vikramSamvat) continue;
    if (coords.adhikaOnly && !p.calendar.chandramasa.isAdhika) continue;
    out.push(p.date);
  }
  return out;
}

// ── Kali Yuga year + Hindu New Year + Karana index helpers ─────

const KALIYUGA_EPOCH_YEAR = -3101; // 3102 BCE (proleptic) / Kali Yuga begins 18 Feb 3102 BCE.

/**
 * Compute the Kali Yuga year for a given Gregorian date. Kali Yuga began
 * on 18 February 3102 BCE per traditional reckoning, but published
 * panchangs (DrikPanchang) increment the year at **Chaitra Shukla
 * Pratipada** — the same luni-solar new year as Vikram Samvat, keeping
 * `Kali − Vikram = 3044` on both sides of the boundary — not at the
 * epoch's Gregorian anniversary. An earlier revision used the Feb-18
 * anniversary, which mislabeled every date in [Feb 18, Chaitra
 * Pratipada) by one year (~1 month/year). Anchored on the same
 * `chaitraNewMoon` boundary as `computeSamvat` for consistency.
 *
 * Drik pins (2026-08-14 audit): 2026-01-01 → 5126, 2026-03-01 → 5126,
 * 2026-03-20 → 5127, 2026-08-19 → 5127.
 *
 * @example
 * ```typescript
 * getKaliYugaYear(new Date('2026-01-01')); // 5126 (before Chaitra Pratipada 2026)
 * ```
 */
export function getKaliYugaYear(date: Date): number {
  validateDate(date);
  const y = date.getUTCFullYear();
  const pastNewYear = date.getTime() >= chaitraNewMoon(y);
  return y - KALIYUGA_EPOCH_YEAR + (pastNewYear ? 0 : -1);
}

/**
 * Region-keyed Hindu New Year date for a given Gregorian year. Different
 * regional traditions celebrate the new year at different points:
 *
 *   - **Most regions** (Maharashtra Gudi Padwa, Andhra/Karnataka Ugadi,
 *     Sindhi Cheti Chand, Vikrami Samvat North) — Chaitra Shukla Pratipada,
 *     ≈ March/April.
 *   - **Tamil Nadu (Puthandu)** — the Mesha Sankranti observance day: a
 *     daylight transit keeps its own day, a night transit moves to the next
 *     sunrise's day. ≈ April 14.
 *   - **Punjab (Baisakhi)** — the civil day containing the transit, so an
 *     evening transit lands a day earlier than Puthandu (2028: April 13).
 *   - **Kerala (Vishu)** — the day of the first sunrise at or after the
 *     transit, so a daytime transit lands a day later (2026/2027: April 15).
 *   - **Bengal (Pohela Boishakh)** — the day after the transit's civil day;
 *     the transit day itself is Chaitra Sankranti, the outgoing year's last.
 *   - **Assam (Bohag Bihu)** — the Sankranti observance day (as Tamil Nadu).
 *     DrikPanchang publishes no Bohag Bihu date page, so this one is not
 *     pinned to a reference; Assamese practice may follow Bengal's rule.
 *
 * The four solar rules are validated against DrikPanchang 2025–2029 — see the
 * table on {@link MeshaDayRule}.
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
    // Mesha Sankranti — Sun's transit into Aries (rashi 0). Which calendar day
    // that lands on is region-specific; see `meshaDayRuleFor`.
    return findMeshaSankranti(gregorianYear, region, location, options);
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
  // End mid-May: in an Adhika-Chaitra year the celebrated (nija) pratipada
  // lands a whole month late — 2029's falls on April 14 — so April 30 leaves
  // little margin and mid-May none of the risk.
  const start = new Date(Date.UTC(gregorianYear, 1, 15));  // mid-Feb
  const end = new Date(Date.UTC(gregorianYear, 4, 15));    // mid-May
  const dayMs = 24 * 3600_000;
  let prev: { masa: number; adhika: boolean } | null = null;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const p = getDailyPanchang(d, location, amantaOptions);
    if (p === null) continue;
    const masa = p.calendar.chandramasa.index;
    const adhika = p.calendar.chandramasa.isAdhika;
    // The new year day is the first day of NIJA Chaitra. In an ordinary year
    // the previous day is Phalguna; in an Adhika-Chaitra year it is Adhika
    // Chaitra — same index 0, adhika flag set — which a plain `prevMasa !== 0`
    // guard mistook for "already in Chaitra", leaving the transition
    // undetectable and the whole function returning null (e.g. 2029).
    // DrikPanchang confirms the celebrated day is the nija pratipada there:
    // Ugadi / Gudi Padwa 2029 on April 14, not the adhika pratipada in March.
    if (masa === 0 && !adhika && prev !== null && (prev.masa !== 0 || prev.adhika)) {
      return p.date;
    }
    prev = { masa, adhika };
  }
  return null;
}

/**
 * Day rules the Mesha-anchored regional new years use. Each names the window
 * that must contain the transit moment for a day to be the new year.
 *
 * Validated against DrikPanchang 2025–2029, whose transit moments
 * (Apr 14 03:30, Apr 14 09:39, Apr 14 15:33, Apr 13 21:47, Apr 14 03:56 IST)
 * span pre-dawn, morning, afternoon and post-sunset:
 *
 * | rule           | region        | 2025 | 2026 | 2027 | 2028 | 2029 |
 * |----------------|---------------|------|------|------|------|------|
 * | `sankranti-day`| Tamil Nadu    |  14  |  14  |  14  |  14  |  14  |
 * | `civil-day`    | Punjab        |  14  |  14  |  14  |  13  |  14  |
 * | `next-sunrise` | Kerala        |  14  |  15  |  15  |  14  |  14  |
 * | `civil-day+1`  | West Bengal   |  15  |  15  |  15  |  14  |  15  |
 */
type MeshaDayRule = 'sankranti-day' | 'civil-day' | 'next-sunrise' | 'civil-day-plus-1';

function meshaDayRuleFor(region: FestivalRegion | LegacyFestivalRegion): MeshaDayRule {
  switch (region) {
    case 'punjab':
      return 'civil-day';
    case 'kerala':
      return 'next-sunrise';
    case 'bengal':
    case 'west-bengal':
      return 'civil-day-plus-1';
    // Tamil Nadu takes the generic Sankranti observance day. Assam rides it
    // too: DrikPanchang publishes no Bohag Bihu date page, so the Assamese
    // rule is not pinned to a reference — see SANKRANTI_REGIONAL in
    // core/festivals.ts.
    default:
      return 'sankranti-day';
  }
}

function findMeshaSankranti(
  gregorianYear: number,
  region: FestivalRegion | LegacyFestivalRegion,
  location: GeoLocation,
  options: ConvertOptions,
): Date | null {
  const offset = resolveUtcOffset(options.timezone, new Date(Date.UTC(gregorianYear, 3, 1)));
  const ayanamsa = options.ayanamsa ?? 'lahiri';
  const rashiAt = (ms: number) =>
    Math.floor(getSiderealSunLongitude(new Date(ms), ayanamsa) / 30) % 12;

  // Locate the Mesha transit to the second. Meena → Mesha always falls in the
  // first half of April; scanning from April 1 with a one-day step and then
  // bisecting reads ~15 solar longitudes instead of the 30 full instant
  // panchangs the day-resolution sweep used to build.
  const dayMs = 24 * 3600_000;
  const scanStart = Date.UTC(gregorianYear, 3, 1) - offset * 60_000 - dayMs;
  const scanEnd = Date.UTC(gregorianYear, 3, 20) - offset * 60_000;
  let transitMs: number | null = null;
  let prevMs = scanStart;
  let prevRashi = rashiAt(prevMs);
  for (let t = scanStart + dayMs; t <= scanEnd; t += dayMs) {
    const rashi = rashiAt(t);
    if (rashi !== prevRashi && rashi === 0) {
      let lo = prevMs, hi = t;
      while (hi - lo > 1000) {
        const mid = Math.floor((lo + hi) / 2);
        if (rashiAt(mid) === prevRashi) lo = mid; else hi = mid;
      }
      transitMs = hi;
      break;
    }
    prevMs = t;
    prevRashi = rashi;
  }
  if (transitMs === null) return null;

  /** Local civil date (as a UTC-midnight Date) of an instant, shifted by n days. */
  const civilDay = (ms: number, dayShift = 0): Date => {
    const local = new Date(ms + offset * 60_000);
    return new Date(Date.UTC(
      local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayShift,
    ));
  };

  const rule = meshaDayRuleFor(region);
  if (rule === 'civil-day') return civilDay(transitMs);
  if (rule === 'civil-day-plus-1') return civilDay(transitMs, 1);

  // The remaining two rules are sunrise-relative. Walk to the sunrise that
  // opens the Hindu day containing the transit, exactly as
  // `computeSankrantisForYear` does, so the two surfaces cannot drift apart.
  try {
    let dayStart = computeSunrise(new Date(transitMs - 30 * 3600_000), location);
    for (let i = 0; i < 3; i++) {
      const next = computeSunrise(computeSunset(dayStart, location), location);
      if (next.getTime() <= transitMs) dayStart = next; else break;
    }
    if (rule === 'next-sunrise') {
      // Kerala: the day of the first sunrise at or after the transit. The
      // transit is inside dayStart's Hindu day, so that is dayStart's own day
      // when the transit preceded its sunrise and the following one otherwise.
      const sunriseAfter = dayStart.getTime() >= transitMs
        ? dayStart
        : computeSunrise(computeSunset(dayStart, location), location);
      return civilDay(sunriseAfter.getTime());
    }
    // Tamil Nadu / default: drik's Sankranti observance day — a daylight
    // transit keeps its own day, a night transit moves to the next sunrise's.
    const dayEnd = computeSunset(dayStart, location);
    const anchor = transitMs <= dayEnd.getTime()
      ? dayStart
      : computeSunrise(dayEnd, location);
    return civilDay(anchor.getTime());
  } catch (e: unknown) {
    if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) {
      throw e;
    }
    // Polar day/night: no sunrise to anchor to — fall back to the transit's
    // own civil date rather than returning null.
    return civilDay(transitMs);
  }
}

// Re-export computeSamvat for callers who want raw era numbers without the
// full panchang computation.
export { computeSamvat };
