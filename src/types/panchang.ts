import type { GeoLocation } from './location';
import type {
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo,
  TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo, TimePeriod,
  ChandraMasaInfo, SamvatInfo, RashiInfo, ChoghadiyaInfo, HoraInfo,
  SpecialYogaInfo, FestivalInfo, GowriInfo, BhadraInfo, EclipseInfo,
  GandaMulaInfo, AnandadiYogaInfo, DoGhatiInfo,
} from './elements';
import type { ChandraBalamInfo, TarabalaInfo } from './jyotish';

export interface MasaInfo {
  index: number;
  name: string;
}

export interface DailyPanchangResult {
  date: Date;
  location: GeoLocation;
  timezone: number;

  sunrise: Date;
  sunset: Date;
  nextSunrise: Date;
  dayDurationMinutes: number;
  nightDurationMinutes: number;

  tithis: DailyTithiInfo[];
  nakshatras: DailyNakshatraInfo[];
  yogas: DailyYogaInfo[];
  karanas: DailyKaranaInfo[];
  vara: VaraInfo;

  rahuKalam: TimePeriod;
  gulikaKalam: TimePeriod;
  yamaganda: TimePeriod;
  abhijitMuhurta: TimePeriod;

  ayanamsa: number;
  siderealSunAtSunrise: number;
  siderealMoonAtSunrise: number;
  masa: MasaInfo;
  chandramasa: ChandraMasaInfo;
  samvat: SamvatInfo;
  chandraRashi: RashiInfo;
  /** Sun's current Nakshatra (changes every ~13–14 days) */
  suryaNakshatra: RashiInfo;
  brahmaMuhurta: TimePeriod;
  choghadiya: ChoghadiyaInfo;
  hora: HoraInfo;
  moonrise: Date | null;
  moonset: Date | null;
  panchaka: boolean;
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
  /**
   * Do Ghati Muhurta — 15 daytime + 15 nighttime ~48-minute slots covering
   * sunrise→sunset and sunset→nextSunrise respectively. Each slot carries
   * a fixed classical name and auspicious / inauspicious quality.
   */
  doGhatiMuhurta: DoGhatiInfo;
  specialYogas: SpecialYogaInfo[];
  durMuhurta: [TimePeriod, TimePeriod];
  festivals: FestivalInfo[];
  gowriPanchangam: GowriInfo;
  /** Chandra Balam — only present when `options.janmaRashi` is provided. */
  chandraBalam?: ChandraBalamInfo;
  /** Tarabala — only present when `options.janmaNakshatra` is provided. */
  tarabala?: TarabalaInfo;
  /** Bhadra Kala (Vishti karana) window overlapping this Hindu day, or null. */
  bhadra: BhadraInfo | null;
  /** Varjyam (Vishaghati / Nakshatra Thyajyam) window for the day, or null when none overlaps. */
  varjyam: TimePeriod | null;
  /** Ganda Mula — Moon-in-root-nakshatra detection at sunrise. `active: false` for the 21 non-root nakshatras. */
  gandaMula: GandaMulaInfo;
  /** Anandadi Yoga — Vara × Nakshatra 28-name cycle yoga at sunrise. */
  anandadiYoga: AnandadiYogaInfo;
  /** Next few muhurtas: Vijaya (11th day-muhurta), Godhuli, Nishita (15th night-muhurta). */
  vijayaMuhurta: TimePeriod;
  godhuliMuhurta: TimePeriod;
  nishitaMuhurta: TimePeriod;
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
  /** Dinamana — classical alias of `dayDurationMinutes` (sunrise → sunset). */
  dinamanaMinutes: number;
  /** Ratrimana — classical alias of `nightDurationMinutes` (sunset → next sunrise). */
  ratrimanaMinutes: number;
  /** Eclipse (Grahan) overlapping this Hindu day, or `null` when none occurs. */
  eclipse: EclipseInfo | null;

  _debug?: {
    totalMs: number;
    sunriseMs: number;
    elementsMs: number;
    endTimesMs: number;
  };
}

export interface InstantPanchangResult {
  timestamp: Date;
  location: GeoLocation;

  tithi: TithiInfo;
  nakshatra: NakshatraInfo;
  yoga: YogaInfo;
  karana: KaranaInfo;
  vara: VaraInfo;

  ayanamsa: number;
  siderealSun: number;
  siderealMoon: number;
  chandramasa: ChandraMasaInfo;
  samvat: SamvatInfo;
  chandraRashi: RashiInfo;
  /** Sun's current Nakshatra (changes every ~13–14 days) */
  suryaNakshatra: RashiInfo;
  panchaka: boolean;
  specialYogas: SpecialYogaInfo[];
  festivals: FestivalInfo[];
  /** Ganda Mula — Moon-in-root-nakshatra detection at the queried instant. */
  gandaMula: GandaMulaInfo;
  /** Anandadi Yoga — Vara × Nakshatra 28-name cycle yoga at the queried instant. */
  anandadiYoga: AnandadiYogaInfo;
  /** Chandra Balam — only present when `options.janmaRashi` is provided. */
  chandraBalam?: ChandraBalamInfo;
  /** Tarabala — only present when `options.janmaNakshatra` is provided. */
  tarabala?: TarabalaInfo;
}
