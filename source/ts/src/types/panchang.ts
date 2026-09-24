import type { GeoLocation } from './location';
import type {
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo,
  TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo, TimePeriod,
  ChandraMasaInfo, SamvatInfo, RashiInfo, NakshatraIndexInfo, ChoghadiyaInfo, HoraInfo,
  SpecialYogaInfo, FestivalInfo, GowriInfo, BhadraInfo, EclipseInfo,
  GandaMulaInfo, PanchakaInfo, AnandadiYogaInfo, DoGhatiInfo, DurMuhurtaPeriod,
} from './elements';
import type { ChandraBalamInfo, TarabalaInfo } from './jyotish';

export interface MasaInfo {
  index: number;
  name: string;
}

/** Resolved once per call from a reference date, so times after a same-day DST jump are shifted. */
export interface ResolvedTimezone {
  /** Minutes east of UTC (e.g. `330` for IST). */
  offsetMinutes: number;
  /** IANA zone name; absent when the caller supplied a raw numeric offset. */
  zone?: string;
}

export interface SunPosition {
  siderealLongitude: number;
  nakshatra: NakshatraIndexInfo;
}

export interface MoonPosition {
  siderealLongitude: number;
  rashi: RashiInfo;
}

/** The Hindu day runs `rise` → `nextRise`, with `set` inside it; the `*Local` strings are offset-carrying ISO 8601. */
export interface DailySun extends SunPosition {
  rise: Date;
  set: Date;
  nextRise: Date;
  riseLocal: string;
  setLocal: string;
  nextRiseLocal: string;
  dayDurationMinutes: number;
  nightDurationMinutes: number;
  /** Classical name for, and the same number as, `dayDurationMinutes`. */
  dinamanaMinutes: number;
  /** Classical name for, and the same number as, `nightDurationMinutes`. */
  ratrimanaMinutes: number;
}

/**
 * `rise` is the first moonrise of the local calendar day; `set` is the first moonset after it,
 * or the day's own first moonset when there is no rise. Each is `null` on the ~one day a month
 * the Moon does not rise (or, with no rise, does not set) that day. `set` also needs the
 * `'moonTimes'` section; `rise` is filled when `'moonTimes'` or `'festivals'` is requested.
 */
export interface DailyMoon extends MoonPosition {
  rise: Date | null;
  set: Date | null;
  riseLocal: string | null;
  setLocal: string | null;
}

/** Index `0` is the anga active at sunrise, the one almanacs print; later entries are transitions before the next sunrise. */
export interface DailyAngas {
  tithis: DailyTithiInfo[];
  nakshatras: DailyNakshatraInfo[];
  yogas: DailyYogaInfo[];
  karanas: DailyKaranaInfo[];
  vara: VaraInfo;
}

export interface InstantAngas {
  tithi: TithiInfo;
  nakshatra: NakshatraInfo;
  yoga: YogaInfo;
  karana: KaranaInfo;
  vara: VaraInfo;
}

export interface CalendarLabels {
  /** Lunar month. Lowercase deliberately: renaming would break every consumer. */
  chandramasa: ChandraMasaInfo;
  samvat: SamvatInfo;
}

export interface DailyCalendarLabels extends CalendarLabels {
  /** Solar month: the rashi the Sun occupies at sunrise. */
  masa: MasaInfo;
}

export interface MuhurtaWindows {
  /** The 8th of 15 day-muhurtas, on solar noon. `null` on Wednesday, held inauspicious. */
  abhijit: TimePeriod | null;
  /** The 14th of 15 night-muhurtas: two to one night-muhurta before sunrise, the night being sunset to next sunrise; its midpoint is `pratahSandhya.start`. */
  brahma: TimePeriod;
  vijaya: TimePeriod;
  godhuli: TimePeriod;
  nishita: TimePeriod;
  /** Nakshatra-anchored, like Varjyam; attributed to the day the window STARTS in. */
  amritKala: TimePeriod[];
  /** Solar noon as a ±24-min window (one classical muhurta wide). */
  madhyahna: TimePeriod;
  /** Dawn twilight. Asymmetric: ends *at* sunrise, width = `nightDuration / 10`. */
  pratahSandhya: TimePeriod;
  /** Dusk twilight. Asymmetric: starts *at* sunset, width = `nightDuration / 10`. */
  sayahnaSandhya: TimePeriod;
  /** 15 daytime + 15 nighttime ~48-minute slots, each classically named and graded. */
  doGhati: DoGhatiInfo;
}

export interface InauspiciousWindows {
  rahuKalam: TimePeriod;
  gulikaKalam: TimePeriod;
  yamaganda: TimePeriod;
  /** One or two per weekday (Muhurta-Chintamani), tagged with its day/night segment. */
  durMuhurta: DurMuhurtaPeriod[];
  /** A nakshatra-transition day can carry two. */
  varjyam: TimePeriod[];
  bhadra: BhadraInfo | null;
  gandaMula: GandaMulaInfo;
  panchaka: boolean;
  panchakaInfo: PanchakaInfo;
  /** Slices with the Moon OUTSIDE Panchaka: at most ONE, since the Moon moves monotonically. */
  panchakaRahita: TimePeriod[];
}

export interface InstantInauspicious {
  panchaka: boolean;
  panchakaInfo: PanchakaInfo;
  gandaMula: GandaMulaInfo;
}

export interface DayPeriods {
  choghadiya: ChoghadiyaInfo;
  hora: HoraInfo;
  /** Gowri Panchangam (Nalla Neram): the Tamil day-division scheme. */
  gowri: GowriInfo;
}

/** The full Panchang for one sunrise-to-sunrise Hindu day. */
export interface DailyPanchangResult {
  date: Date;
  location: GeoLocation;
  timezone: ResolvedTimezone;
  /** Ayanamsa at sunrise, in degrees. */
  ayanamsa: number;

  sun: DailySun;
  moon: DailyMoon;
  angas: DailyAngas;
  calendar: DailyCalendarLabels;
  muhurtas: MuhurtaWindows;
  inauspicious: InauspiciousWindows;
  periods: DayPeriods;

  specialYogas: SpecialYogaInfo[];
  anandadiYoga: AnandadiYogaInfo;
  festivals: FestivalInfo[];
  /** A lunar eclipse peaking in the day, or a solar eclipse first seen in it (see `getEclipseDuringDay`); `null` when none or the `'eclipse'` section was skipped. */
  eclipse: EclipseInfo | null;
  /** `null` unless `options.janmaRashi` was provided. */
  chandraBalam: ChandraBalamInfo | null;
  /** `null` unless `options.janmaNakshatra` was provided. */
  tarabala: TarabalaInfo | null;
}

/** {@link DailyPanchangResult} minus what belongs to a day rather than a moment: no rise/set, `muhurtas` or `periods`. */
export interface InstantPanchangResult {
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
  anandadiYoga: AnandadiYogaInfo;
  festivals: FestivalInfo[];
  /** `null` unless `options.janmaRashi` was provided. */
  chandraBalam: ChandraBalamInfo | null;
  /** `null` unless `options.janmaNakshatra` was provided. */
  tarabala: TarabalaInfo | null;
}
