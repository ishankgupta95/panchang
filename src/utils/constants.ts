// ── Span values (degrees) ─────────────────────────────
export const TITHI_SPAN = 12;
export const NAKSHATRA_SPAN = 360 / 27; // 13.3333...
export const NAKSHATRA_PADA_SPAN = NAKSHATRA_SPAN / 4; // 3.3333...
export const YOGA_SPAN = 360 / 27; // 13.3333...
export const KARANA_SPAN = 6;

// ── Inauspicious period slot assignments (0-indexed from sunrise) ──
// Index = day of week (0=Sunday, 6=Saturday)
export const RAHU_KALAM_SLOTS = [7, 1, 6, 4, 5, 3, 2] as const;
export const YAMAGANDA_SLOTS = [4, 3, 2, 1, 0, 6, 5] as const;
export const GULIKA_SLOTS = [6, 5, 4, 3, 2, 1, 0] as const;

// ── English day names ─────────────────────────────────
export const ENGLISH_DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

// ── Element cycle sizes ───────────────────────────────
export const TOTAL_TITHIS = 30;
export const TOTAL_NAKSHATRAS = 27;
export const TOTAL_YOGAS = 27;
export const TOTAL_KARANAS = 60;

// ── Max elements per day (safety caps) ────────────────
export const MAX_DAILY_TITHIS = 3;
export const MAX_DAILY_NAKSHATRAS = 3;
export const MAX_DAILY_YOGAS = 3;
export const MAX_DAILY_KARANAS = 5;

// ── Binary search window sizes (hours) ────────────────
export const TITHI_SEARCH_HOURS = 36;
export const NAKSHATRA_SEARCH_HOURS = 36;
export const YOGA_SEARCH_HOURS = 36;
export const KARANA_SEARCH_HOURS = 18;
