export interface PanchangTranslations {
  tithiNames: readonly string[];
  nakshatraNames: readonly string[];
  yogaNames: readonly string[];
  karanaNames: {
    movable: readonly string[];
    fixed: readonly string[];
  };
  varaNames: readonly { name: string; short: string }[];
  pakshaNames: { shukla: string; krishna: string };
  masaNames: readonly string[];
  /** Lunar (Chandramana) month names, index 0 = Chaitra … 11 = Phalguna */
  chandraMasaNames: readonly string[];
  /** Choghadiya names, index 0–6: Udveg, Char, Labh, Amrit, Kaal, Shubh, Rog */
  choghadiyaNames: readonly string[];
  /** Gowri Panchangam names, index 0–7: Udyog, Amrit, Roga, Laabh, Shubh, Kaal, Dhan, Chal */
  gowriNames: readonly string[];
  /** Planet names in Chaldean order: Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars */
  grahaNames: readonly string[];
  /** Special yoga names keyed by type */
  specialYogaNames: {
    amrit_siddhi: string;
    sarvartha_siddhi: string;
    ravi_pushya: string;
    guru_pushya: string;
  };
  /** Festival names keyed by festival ID */
  festivalNames: Record<string, string>;
  misc: {
    purnima: string;
    amavasya: string;
    adhika: string;
    ekadashi: string;
    pradosha: string;
    sankranti: string;
  };
}
