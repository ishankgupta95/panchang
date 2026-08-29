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
  chandraMasaNames: readonly string[];
  choghadiyaNames: readonly string[];
  gowriNames: readonly string[];
  /** 30 entries: 0-14 daytime, 15-29 nighttime. */
  doGhatiNames: readonly string[];
  /** Chaldean order: Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars */
  grahaNames: readonly string[];
  specialYogaNames: {
    amrit_siddhi: string;
    sarvartha_siddhi: string;
    ravi_pushya: string;
    guru_pushya: string;
    dwipushkar: string;
    tripushkar: string;
    jwalamukhi: string;
    aadal: string;
    vidaal: string;
    ravi: string;
  };
  /** 28 entries, 0 = Ananda … 27 = Vardhamana. */
  anandadiYogaNames: readonly string[];
  chandraBalamNames: { shubha: string; ashubha: string };
  tarabalaNames: {
    janma: string;
    sampat: string;
    vipat: string;
    kshema: string;
    pratyari: string;
    sadhaka: string;
    vadha: string;
    mitra: string;
    ati_mitra: string;
  };
  qualityNames: { auspicious: string; inauspicious: string; neutral: string };
  bhadraLocationNames: { earth: string; heaven: string; paatal: string };
  panchakaTypeNames: {
    roga: string; raja: string; agni: string;
    chora: string; mrityu: string; samanya: string;
  };
  eclipse: {
    /** `{subtype}`, `{kind}`, `{percent}`, `{visibility}` are substituted. */
    template: string;
    kind: { solar: string; lunar: string };
    subtype: { partial: string; total: string; annular: string; penumbral: string };
    visibility: { visible: string; notVisible: string };
  };
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
