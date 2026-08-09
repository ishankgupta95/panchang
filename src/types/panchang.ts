import type { GeoLocation } from './location';
import type {
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo,
  TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo, TimePeriod,
  ChandraMasaInfo, SamvatInfo, RashiInfo, NakshatraIndexInfo, ChoghadiyaInfo, HoraInfo,
  SpecialYogaInfo, FestivalInfo, GowriInfo, BhadraInfo, EclipseInfo,
  GandaMulaInfo, PanchakaInfo, AnandadiYogaInfo, DoGhatiInfo,
} from './elements';
import type { ChandraBalamInfo, TarabalaInfo } from './jyotish';

export interface MasaInfo {
  index: number;
  name: string;
}

/**
 * The timezone a result was computed in, echoed back.
 *
 * `PanchangOptions.timezone` accepts `number | string`, but through 4.x the
 * result carried only a number — so passing `'America/New_York'` produced a
 * result that could not tell you which zone produced it. That matters
 * precisely because every published wall-clock reading depends on it.
 *
 * ## The DST limit, stated rather than implied
 *
 * `resolveUtcOffset` resolves the offset **once per call**, from a reference
 * date, so a Hindu day that contains a DST transition is computed at a single
 * offset throughout. For the overwhelming majority of days this is exactly
 * right; on the one or two transition days a year, times after the transition
 * are shifted by the size of the jump (usually an hour). 4.x documented this as
 * a blanket "DST resolves automatically", which was not the whole truth.
 */
export interface ResolvedTimezone {
  /** Minutes east of UTC — e.g. `330` for IST, `-300` for US Eastern. */
  offsetMinutes: number;
  /**
   * The IANA zone name, when one was passed. Absent when the caller supplied a
   * raw numeric offset, because then there is no zone to report.
   */
  zone?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Result sections (v5)
 *
 * Through 4.x both result objects were flat: ~50 top-level fields on
 * `DailyPanchangResult`, mixing rise/set instants, the five angas, calendar
 * labels, auspicious windows, inauspicious windows and emissions with no
 * structure to say which was which. Autocomplete on `result.` was a wall of
 * names and there was no way to hand "just the muhurtas" to a component.
 *
 * v5 groups them. The rule is one field per concept and no field in two
 * places, so a reader can predict the path from the concept:
 *
 * | group          | holds                                                    |
 * |----------------|----------------------------------------------------------|
 * | `sun`          | sunrise/sunset/next sunrise, day+night lengths, the Sun's sidereal longitude and nakshatra |
 * | `moon`         | moonrise/moonset, the Moon's sidereal longitude and rashi |
 * | `angas`        | the five limbs — tithi, nakshatra, yoga, karana, vara     |
 * | `calendar`     | month and era labels — masa, chandramasa, samvat          |
 * | `muhurtas`     | auspicious windows                                        |
 * | `inauspicious` | inauspicious windows and markers                          |
 * | `periods`      | weekday-keyed day-division tables — choghadiya, hora, gowri |
 *
 * Everything else stays top level because it is either call identity (`date`,
 * `location`, `timezone`), a single scalar describing the whole computation
 * (`ayanamsa`), or an emission that belongs to no group (`festivals`,
 * `eclipse`, `specialYogas`, `anandadiYoga`, `chandraBalam`, `tarabala`).
 *
 * `masa` (solar month) sits in `calendar` beside `chandramasa` rather than
 * under `sun`, because the two are read together and are meaningless apart —
 * they are the two answers to "which month is it". `sun.nakshatra` is in `sun`
 * because it is a position readout with no calendar counterpart.
 *
 * ## Optional-vs-null: one rule, applied everywhere
 *
 * Through 4.x three conventions coexisted — `| null`, `?`-optional, and empty
 * array — and consumers could not predict which they would get. v5 has one
 * rule:
 *
 * - **Every field is always present.** No `?` anywhere in a result type.
 * - A value that does not apply is **`null`** if it is a scalar or an object.
 * - A collection that does not apply is **`[]`**.
 *
 * So `chandraBalam` and `tarabala` — which through 4.x were absent unless
 * `janmaRashi` / `janmaNakshatra` were passed — are now always present and
 * `null` when the matching option was not supplied. Narrowing with
 * `options.sections` likewise nulls or empties fields rather than removing
 * them: the result *shape* never depends on the options.
 * ──────────────────────────────────────────────────────────────────────────── */

/** The Sun's position-derived readouts, shared by both result modes. */
export interface SunPosition {
  /** Sidereal ecliptic longitude of the Sun, degrees in `[0, 360)`. */
  siderealLongitude: number;
  /**
   * The Sun's current Nakshatra, 0..26 (changes every ~13–14 days).
   *
   * Typed `NakshatraIndexInfo`, not `RashiInfo`: through 4.x this was published
   * as `suryaNakshatra` declared as a rashi, whose index range is 0..11, so
   * indexing a 12-element rashi array by it silently produced garbage for two
   * thirds of the year.
   */
  nakshatra: NakshatraIndexInfo;
}

/** The Moon's position-derived readouts, shared by both result modes. */
export interface MoonPosition {
  /** Sidereal ecliptic longitude of the Moon, degrees in `[0, 360)`. */
  siderealLongitude: number;
  /** Chandra Rashi — the sign the Moon occupies, 0..11. */
  rashi: RashiInfo;
}

/**
 * Solar events and readouts for a Hindu day.
 *
 * The three instants define the day itself: the window runs `rise` →
 * `nextRise`, with `set` inside it. All three are **true instants** —
 * `.getTime()` is the correct epoch millisecond.
 *
 * **Changed in v5.** Through 4.x every published `Date` was the true instant
 * *shifted* by the UTC offset, so `toISOString()`, `JSON.stringify`, `Intl`
 * with a `timeZone`, date-fns, Temporal and any comparison against a real
 * timestamp were all silently off by the offset. Read the `*Local` strings for
 * display: they are offset-carrying ISO 8601 and survive JSON intact.
 */
export interface DailySun extends SunPosition {
  /** True instant of sunrise — the start of the Hindu day. */
  rise: Date;
  /** True instant of sunset. */
  set: Date;
  /** True instant of the following sunrise — the end of the Hindu day. */
  nextRise: Date;
  /** `rise` in `timezone`, offset-carrying ISO 8601 — `"2025-01-14T07:09:44.172+05:30"`. */
  riseLocal: string;
  /** `set` in `timezone`, offset-carrying ISO 8601. */
  setLocal: string;
  /** `nextRise` in `timezone`, offset-carrying ISO 8601. */
  nextRiseLocal: string;
  /**
   * Sunrise → sunset, in minutes. Also published as `dinamanaMinutes`, the
   * classical name for the same quantity; they are aliases, never independently
   * computed, and both are kept because consumers use both vocabularies.
   */
  dayDurationMinutes: number;
  /**
   * Sunset → next sunrise, in minutes. Alias of `ratrimanaMinutes` — see
   * `dayDurationMinutes`.
   */
  nightDurationMinutes: number;
  /**
   * Dinamana — the classical name for `dayDurationMinutes`. **Exactly the same
   * number**, not an independent computation.
   */
  dinamanaMinutes: number;
  /** Ratrimana — the classical name for `nightDurationMinutes`. Same number. */
  ratrimanaMinutes: number;
}

/**
 * Lunar events and readouts for a Hindu day.
 *
 * `rise` / `set` are `null` when the section was not requested
 * (`options.sections` without `'moonTimes'`) and on days the Moon genuinely
 * does not rise or set within the window — the Moon rises ~50 minutes later
 * each day, so roughly one calendar day a month has no moonrise.
 */
export interface DailyMoon extends MoonPosition {
  /** True instant of moonrise, or `null`. */
  rise: Date | null;
  /** True instant of moonset, or `null`. */
  set: Date | null;
  /** `rise` as offset-carrying ISO 8601; `null` whenever `rise` is. */
  riseLocal: string | null;
  /** `set` as offset-carrying ISO 8601; `null` whenever `set` is. */
  setLocal: string | null;
}

/**
 * The five limbs (pancha anga) across a Hindu day.
 *
 * Each of the first four is an **array**, because a transition inside the
 * sunrise→sunrise window means more than one was active: if the tithi changes
 * at 14:30 there are two entries. Index `0` is always the one active at
 * sunrise, which is the one almanacs print. `vara` is the weekday at local
 * sunrise and is single by construction.
 */
export interface DailyAngas {
  tithis: DailyTithiInfo[];
  nakshatras: DailyNakshatraInfo[];
  yogas: DailyYogaInfo[];
  karanas: DailyKaranaInfo[];
  vara: VaraInfo;
}

/** The five limbs at a single instant — one value each, no transitions. */
export interface InstantAngas {
  tithi: TithiInfo;
  nakshatra: NakshatraInfo;
  yoga: YogaInfo;
  karana: KaranaInfo;
  vara: VaraInfo;
}

/** Month and era labels. */
export interface CalendarLabels {
  /**
   * The **lunar** month. See `masa` on {@link DailyCalendarLabels} for the
   * solar one.
   *
   * Spelled `chandramasa` rather than `chandraMasa`: it is the odd one out
   * beside `chandraRashi` and `suryaNakshatra`, and it is left that way
   * deliberately — renaming it would break every consumer for a casing
   * preference, which is not a trade this library makes. Noted so the
   * inconsistency reads as a decision rather than an oversight.
   */
  chandramasa: ChandraMasaInfo;
  /** Vikram and Shaka era years. */
  samvat: SamvatInfo;
}

export interface DailyCalendarLabels extends CalendarLabels {
  /**
   * The **solar** month: the rashi the Sun occupies at sunrise, 0..11.
   * Distinct from `chandramasa`, which is the *lunar* month — the two disagree
   * for most of any given month and are not interchangeable.
   */
  masa: MasaInfo;
}

/** Auspicious windows of a Hindu day. */
export interface MuhurtaWindows {
  /**
   * Abhijit Muhurta — the 8th of 15 day-muhurtas, centered on solar noon.
   * `null` on Wednesday (Buddha-vara), per classical Smarta convention
   * followed by DrikPanchang and most published almanacs.
   */
  abhijit: TimePeriod | null;
  /** Brahma Muhurta — the last pre-dawn muhurta before sunrise. */
  brahma: TimePeriod;
  /** Vijaya Muhurta — the 11th day-muhurta. */
  vijaya: TimePeriod;
  /** Godhuli Muhurta — the cow-dust hour straddling sunset. */
  godhuli: TimePeriod;
  /** Nishita Muhurta — the 15th night-muhurta, around solar midnight. */
  nishita: TimePeriod;
  /** Amrit Kala — nakshatra-specific auspicious window; `null` when the day's nakshatra has none. */
  amritKala: TimePeriod | null;
  /** Madhyahna — solar noon as a ±24-min ritual window (one classical muhurta wide). */
  madhyahna: TimePeriod;
  /**
   * Pratah Sandhya — dawn-twilight ritual window. Asymmetric: ends *at* sunrise,
   * width = `nightDuration / 10` (three nighttime ghatikas). Matches DrikPanchang.
   */
  pratahSandhya: TimePeriod;
  /**
   * Sayahna Sandhya — dusk-twilight ritual window. Asymmetric: starts *at* sunset,
   * width = `nightDuration / 10` (three nighttime ghatikas). Matches DrikPanchang.
   */
  sayahnaSandhya: TimePeriod;
  /**
   * Do Ghati Muhurta — 15 daytime + 15 nighttime ~48-minute slots covering
   * sunrise→sunset and sunset→nextSunrise respectively. Each slot carries
   * a fixed classical name and auspicious / inauspicious quality.
   */
  doGhati: DoGhatiInfo;
}

/**
 * Inauspicious windows and markers of a Hindu day.
 *
 * `panchakaRahita` is the odd member: it lists the slices *free* of Panchaka,
 * i.e. the complement of the `panchaka` flag. It lives here because it is
 * meaningless apart from `panchaka`, and splitting the pair across two groups
 * would cost more than the mild category mismatch.
 */
export interface InauspiciousWindows {
  rahuKalam: TimePeriod;
  gulikaKalam: TimePeriod;
  yamaganda: TimePeriod;
  /** The two Dur Muhurta slots of the day. */
  durMuhurta: [TimePeriod, TimePeriod];
  /** Varjyam (Vishaghati / Nakshatra Thyajyam) window for the day, or `null` when none overlaps. */
  varjyam: TimePeriod | null;
  /** Bhadra Kala (Vishti karana) window overlapping this Hindu day, or `null`. */
  bhadra: BhadraInfo | null;
  /** Ganda Mula — Moon-in-root-nakshatra detection at sunrise. `active: false` for the 21 non-root nakshatras. */
  gandaMula: GandaMulaInfo;
  /** Whether the Moon is in Panchaka (the last five nakshatras) at sunrise. */
  panchaka: boolean;
  /**
   * Which Panchaka is running, and whether it carries a dosha at all.
   *
   * {@link DailyInauspicious.panchaka} answers only "is the Moon in the span",
   * which flattens a graded classification: the tradition names five Panchakas
   * and picks between them by the weekday the spell *began* on, so this cannot
   * be derived from the day's own vara. A Wednesday- or Thursday-onset spell
   * gets no named affliction at all (`isDosha: false`) and is the case most
   * often mishandled by treating Panchaka as a plain flag.
   */
  panchakaInfo: PanchakaInfo;
  /**
   * Slices of the Hindu day during which the Moon is OUTSIDE Panchaka
   * (i.e. outside the last five nakshatras: Dhanishtha 3rd–4th pada through
   * Revati). Because the Moon moves monotonically, this is at most ONE slice:
   * empty `[]` when Panchaka pervades the day, the full `[sunrise, nextSunrise]`
   * when it doesn't, and a single half-day slice on transition days.
   *
   * **Not the same as DrikPanchang's "Panchak Rahit Muhurat" panel.** Drik
   * publishes a multi-window auspicious-sub-slot derivation (Roga / Raja /
   * Mrityu / Agni / Chora / Panchak slot exclusion). This field exposes only
   * the broader Moon-out-of-Panchaka envelope; consumers wanting Drik-shaped
   * sub-windows should compose this with the inauspicious-period overlay.
   */
  panchakaRahita: TimePeriod[];
}

/** Inauspicious markers available at a single instant. */
export interface InstantInauspicious {
  /** Whether the Moon is in Panchaka at the queried instant. */
  panchaka: boolean;
  /**
   * Which Panchaka is running at the queried instant, and whether it carries
   * a dosha. See {@link DailyInauspicious.panchakaInfo}.
   */
  panchakaInfo: PanchakaInfo;
  /** Ganda Mula — Moon-in-root-nakshatra detection at the queried instant. */
  gandaMula: GandaMulaInfo;
}

/**
 * Weekday-keyed day-division tables — the three classical schemes that cut
 * sunrise→sunset and sunset→nextSunrise into named, quality-tagged slots.
 */
export interface DayPeriods {
  /** Choghadiya — 8 day + 8 night slots, rotating by weekday. */
  choghadiya: ChoghadiyaInfo;
  /** Hora — 12 day + 12 night planetary hours. */
  hora: HoraInfo;
  /** Gowri Panchangam (Nalla Neram) — the Tamil day-division scheme. */
  gowri: GowriInfo;
}

/**
 * The full Panchang for one sunrise-to-sunrise Hindu day.
 *
 * See the section table above for how the groups are drawn. Nothing here is
 * optional: fields that do not apply are `null` (scalars and objects) or `[]`
 * (collections), never absent.
 */
export interface DailyPanchangResult {
  /** The calendar date this result was requested for, as passed in. */
  date: Date;
  location: GeoLocation;
  /**
   * The resolved timezone. Through 4.x this was a bare `number`; it is now an
   * object so an IANA zone name survives into the result. See
   * {@link ResolvedTimezone} — including its note on DST-transition days.
   */
  timezone: ResolvedTimezone;
  /** Ayanamsa at sunrise, in degrees — the precession offset behind every sidereal value here. */
  ayanamsa: number;

  sun: DailySun;
  moon: DailyMoon;
  angas: DailyAngas;
  calendar: DailyCalendarLabels;
  muhurtas: MuhurtaWindows;
  inauspicious: InauspiciousWindows;
  periods: DayPeriods;

  /** Special yogas (Amrit Siddhi, Sarvartha Siddhi, Ravi Pushya, …) active on this day. */
  specialYogas: SpecialYogaInfo[];
  /** Anandadi Yoga — Vara × Nakshatra 28-name cycle yoga at sunrise. */
  anandadiYoga: AnandadiYogaInfo;
  /** Festivals emitted for this Hindu day. `[]` when none, or when the section was not requested. */
  festivals: FestivalInfo[];
  /** Eclipse (Grahan) overlapping this Hindu day, or `null` when none occurs. */
  eclipse: EclipseInfo | null;
  /** Chandra Balam — `null` unless `options.janmaRashi` was provided. */
  chandraBalam: ChandraBalamInfo | null;
  /** Tarabala — `null` unless `options.janmaNakshatra` was provided. */
  tarabala: TarabalaInfo | null;
}

/**
 * The Panchang at a single UTC instant.
 *
 * Grouped the same way as {@link DailyPanchangResult} so the two modes read
 * alike; the groups present here are the ones an instant can answer. There is
 * no `sun.rise` / `moon.rise` and no `muhurtas` / `periods`, because those are
 * properties of a Hindu *day*, not of a moment.
 */
export interface InstantPanchangResult {
  /** The instant this result was computed for, as passed in. */
  timestamp: Date;
  location: GeoLocation;
  /** Ayanamsa at `timestamp`, in degrees. */
  ayanamsa: number;

  sun: SunPosition;
  moon: MoonPosition;
  angas: InstantAngas;
  calendar: CalendarLabels;
  inauspicious: InstantInauspicious;

  specialYogas: SpecialYogaInfo[];
  /** Anandadi Yoga — Vara × Nakshatra 28-name cycle yoga at the queried instant. */
  anandadiYoga: AnandadiYogaInfo;
  festivals: FestivalInfo[];
  /** Chandra Balam — `null` unless `options.janmaRashi` was provided. */
  chandraBalam: ChandraBalamInfo | null;
  /** Tarabala — `null` unless `options.janmaNakshatra` was provided. */
  tarabala: TarabalaInfo | null;
}
