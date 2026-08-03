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
  /**
   * Do Ghati Muhurta names — 30 entries indexed 0–14 (daytime) and 15–29
   * (nighttime). Order matches DrikPanchang's published Do Ghati table.
   */
  doGhatiNames: readonly string[];
  /** Planet names in Chaldean order: Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars */
  grahaNames: readonly string[];
  /** Special yoga names keyed by type */
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
  /** Anandadi Yoga names — 28 entries indexed 0 = Ananda … 27 = Vardhamana. */
  anandadiYogaNames: readonly string[];
  /** Chandra Balam quality labels (Moon's transit strength from janma rashi) */
  chandraBalamNames: { shubha: string; ashubha: string };
  /** Tarabala — 9 taras keyed by classical English name (Janma..Ati-Mitra) */
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
  /** Quality names for Choghadiya / Gowri slots */
  qualityNames: { auspicious: string; inauspicious: string; neutral: string };
  /**
   * Bhadra (Vishti) residence labels. `BhadraInfo.location` stays a stable
   * machine-readable key (`'earth' | 'heaven' | 'paatal'`); these are the
   * display names surfaced as `BhadraInfo.locationName`.
   */
  bhadraLocationNames: { earth: string; heaven: string; paatal: string };
  /**
   * Eclipse (Grahan) description parts.
   *
   * `EclipseInfo.description` used to be assembled with an English template
   * literal inside `astronomy/eclipse.ts`, so it leaked untranslated into
   * `language: 'hi'` results — including into `festivals[].description`, where
   * it sat next to a correctly-translated `name`. The pieces live here now and
   * the sentence is composed through `template`.
   */
  eclipse: {
    /** `{subtype}`, `{kind}`, `{percent}`, `{visibility}` are substituted. */
    template: string;
    kind: { solar: string; lunar: string };
    subtype: { partial: string; total: string; annular: string; penumbral: string };
    visibility: { visible: string; notVisible: string };
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
