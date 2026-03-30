import type { GeoLocation } from './location';
import type {
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo,
  TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo, TimePeriod,
  ChandraMasaInfo, SamvatInfo, RashiInfo, ChoghadiyaInfo, HoraInfo,
  SpecialYogaInfo, FestivalInfo, GowriInfo,
} from './elements';

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
  specialYogas: SpecialYogaInfo[];
  durMuhurta: [TimePeriod, TimePeriod];
  festivals: FestivalInfo[];
  gowriPanchangam: GowriInfo;

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
}
