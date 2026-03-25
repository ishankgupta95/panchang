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
  misc: {
    purnima: string;
    amavasya: string;
    adhika: string;
  };
}
