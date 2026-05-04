import {
  RASHI_VARNA, VARNA_RANK,
  RASHI_VASHYA, VASHYA_SCORE, vashyaIndex,
  NAKSHATRA_YONI, YONI_SCORE, yoniIndex,
  RASHI_LORD, NAISARGIKA_MAITRI, GRAHA_MAITRI_SCORE, maitriIdx,
  NAKSHATRA_GANA, GANA_SCORE, ganaIdx,
  NAKSHATRA_NADI,
  INAUSPICIOUS_TARA_REMAINDERS,
  BHAKOOT_DOSHIC_DISTANCES,
} from './matchingTables';
import { assertNakshatraIndex } from '../utils/validation';

/** Input to ashtakoot — Moon's natal rashi and nakshatra for one native. */
export interface NatalMoon {
  /** Moon's rashi at birth (0 = Mesha … 11 = Meena). */
  rashi: number;
  /** Moon's nakshatra at birth (0 = Ashwini … 26 = Revati). */
  nakshatra: number;
}

export type KootName = 'Varna' | 'Vashya' | 'Tara' | 'Yoni' | 'Graha Maitri' | 'Gana' | 'Bhakoot' | 'Nadi';

export interface KootScore {
  name: KootName;
  /** Earned score for this koot. */
  score: number;
  /** Maximum possible score for this koot (1, 2, 3, 4, 5, 6, 7, or 8). */
  maxScore: number;
  /** Plain-English explanation of how the score was derived. */
  description: string;
}

export interface AshtakootResult {
  /** Total compatibility score, 0..36 (sum of the 8 koot scores). */
  totalScore: number;
  /** Per-koot breakdown in canonical Brihat-Samhita order. */
  koots: KootScore[];
  /**
   * Bhakoot / Nadi cancellations that were *applied* (changed a 0 to full
   * marks). Each entry is a short reason; an empty array means no
   * cancellations were triggered.
   */
  cancellations: string[];
}

/**
 * Ashtakoot Guna Milan — the 36-point Hindu astrological compatibility test
 * between groom (vara) and bride (vadhu). Eight koots are scored from each
 * native's natal Moon nakshatra and rashi.
 *
 * | Koot          | Max | Tests                                          |
 * |---------------|----:|------------------------------------------------|
 * | Varna         | 1   | Caste class compatibility (boy ≥ girl)        |
 * | Vashya        | 2   | Mutual influence (rashi-grouping)             |
 * | Tara          | 3   | Health (nakshatra distance, both directions)  |
 * | Yoni          | 4   | Sexual harmony (nakshatra-animal)             |
 * | Graha Maitri  | 5   | Mental compatibility (rashi-lord friendship)  |
 * | Gana          | 6   | Temperament (Deva / Manushya / Rakshasa)      |
 * | Bhakoot       | 7   | Emotional/financial bond (rashi distance)     |
 * | Nadi          | 8   | Health/genetics (nakshatra-nadi grouping)     |
 *
 * Standard cancellations applied to Bhakoot 0 / Nadi 0:
 *   - Same rashi but different nakshatras (Bhakoot)
 *   - Same nakshatra-lord (Nadi)
 *   - Mutual rashi-lords are friends (Bhakoot)
 *
 * @example
 * ```typescript
 * const result = computeAshtakoot(
 *   { rashi: 4, nakshatra: 9 },   // Boy: Leo / Magha
 *   { rashi: 0, nakshatra: 1 },   // Girl: Aries / Bharani
 * );
 * result.totalScore;  // 0..36
 * result.koots.find(k => k.name === 'Nadi')?.score;
 * ```
 */
export function computeAshtakoot(boy: NatalMoon, girl: NatalMoon): AshtakootResult {
  validateNatalMoon(boy, 'boy');
  validateNatalMoon(girl, 'girl');

  const cancellations: string[] = [];

  const koots: KootScore[] = [
    scoreVarna(boy, girl),
    scoreVashya(boy, girl),
    scoreTara(boy, girl),
    scoreYoni(boy, girl),
    scoreGrahaMaitri(boy, girl),
    scoreGana(boy, girl),
    scoreBhakoot(boy, girl, cancellations),
    scoreNadi(boy, girl, cancellations),
  ];

  const totalScore = koots.reduce((sum, k) => sum + k.score, 0);
  return { totalScore, koots, cancellations };
}

function validateNatalMoon(m: NatalMoon, label: string): void {
  if (!Number.isInteger(m.rashi) || m.rashi < 0 || m.rashi >= 12) {
    throw new RangeError(`${label}.rashi must be integer in [0, 11], got ${m.rashi}`);
  }
  assertNakshatraIndex(m.nakshatra, `${label}.nakshatra`);
}

// ── Per-koot scoring ──────────────────────────────────

function scoreVarna(boy: NatalMoon, girl: NatalMoon): KootScore {
  const boyRank = VARNA_RANK[RASHI_VARNA[boy.rashi]!];
  const girlRank = VARNA_RANK[RASHI_VARNA[girl.rashi]!];
  // Classical rule: full mark when groom's varna ≥ bride's; otherwise zero.
  const score = boyRank >= girlRank ? 1 : 0;
  return {
    name: 'Varna',
    score,
    maxScore: 1,
    description: `Boy's varna (${RASHI_VARNA[boy.rashi]}) vs girl's (${RASHI_VARNA[girl.rashi]})`,
  };
}

function scoreVashya(boy: NatalMoon, girl: NatalMoon): KootScore {
  const b = vashyaIndex(RASHI_VASHYA[boy.rashi]!);
  const g = vashyaIndex(RASHI_VASHYA[girl.rashi]!);
  const score = VASHYA_SCORE[b]![g]!;
  return {
    name: 'Vashya',
    score,
    maxScore: 2,
    description: `${RASHI_VASHYA[boy.rashi]} ↔ ${RASHI_VASHYA[girl.rashi]}`,
  };
}

function scoreTara(boy: NatalMoon, girl: NatalMoon): KootScore {
  // From boy → girl, count from boy's nakshatra to girl's, divided by 9.
  const dBoyToGirl = ((girl.nakshatra - boy.nakshatra + 27) % 27) + 1;
  const dGirlToBoy = ((boy.nakshatra - girl.nakshatra + 27) % 27) + 1;
  const remBoyToGirl = dBoyToGirl % 9;
  const remGirlToBoy = dGirlToBoy % 9;
  const auspiciousBoyToGirl = !INAUSPICIOUS_TARA_REMAINDERS.includes(remBoyToGirl);
  const auspiciousGirlToBoy = !INAUSPICIOUS_TARA_REMAINDERS.includes(remGirlToBoy);
  const score = (auspiciousBoyToGirl ? 1.5 : 0) + (auspiciousGirlToBoy ? 1.5 : 0);
  return {
    name: 'Tara',
    score,
    maxScore: 3,
    description: `Boy→Girl rem ${remBoyToGirl} (${auspiciousBoyToGirl ? 'auspicious' : 'inauspicious'}); Girl→Boy rem ${remGirlToBoy} (${auspiciousGirlToBoy ? 'auspicious' : 'inauspicious'})`,
  };
}

function scoreYoni(boy: NatalMoon, girl: NatalMoon): KootScore {
  const b = yoniIndex(NAKSHATRA_YONI[boy.nakshatra]!);
  const g = yoniIndex(NAKSHATRA_YONI[girl.nakshatra]!);
  const score = YONI_SCORE[b]![g]!;
  return {
    name: 'Yoni',
    score,
    maxScore: 4,
    description: `${NAKSHATRA_YONI[boy.nakshatra]} ↔ ${NAKSHATRA_YONI[girl.nakshatra]}`,
  };
}

function scoreGrahaMaitri(boy: NatalMoon, girl: NatalMoon): KootScore {
  const boyLord = RASHI_LORD[boy.rashi]!;
  const girlLord = RASHI_LORD[girl.rashi]!;
  let score: number;
  let description: string;
  if (boyLord === girlLord) {
    score = 5;
    description = `Same rashi-lord (graha ${boyLord}) — full marks`;
  } else {
    const boyView = NAISARGIKA_MAITRI[boyLord]![girlLord]!;
    const girlView = NAISARGIKA_MAITRI[girlLord]![boyLord]!;
    score = GRAHA_MAITRI_SCORE[maitriIdx(boyView)]![maitriIdx(girlView)]!;
    description = `Boy lord views girl lord as ${maitriLabel(boyView)}; girl lord views boy lord as ${maitriLabel(girlView)}`;
  }
  return { name: 'Graha Maitri', score, maxScore: 5, description };
}

function maitriLabel(v: number): string {
  return v === 1 ? 'friend' : v === -1 ? 'enemy' : 'neutral';
}

function scoreGana(boy: NatalMoon, girl: NatalMoon): KootScore {
  const b = ganaIdx(NAKSHATRA_GANA[boy.nakshatra]!);
  const g = ganaIdx(NAKSHATRA_GANA[girl.nakshatra]!);
  const score = GANA_SCORE[b]![g]!;
  return {
    name: 'Gana',
    score,
    maxScore: 6,
    description: `${NAKSHATRA_GANA[boy.nakshatra]} ↔ ${NAKSHATRA_GANA[girl.nakshatra]}`,
  };
}

function scoreBhakoot(boy: NatalMoon, girl: NatalMoon, cancellations: string[]): KootScore {
  const dBoyToGirl = ((girl.rashi - boy.rashi + 12) % 12) + 1;
  const dGirlToBoy = ((boy.rashi - girl.rashi + 12) % 12) + 1;

  const isDoshic = BHAKOOT_DOSHIC_DISTANCES.some(
    ([a, b]) => a === dBoyToGirl && b === dGirlToBoy,
  );

  let score = isDoshic ? 0 : 7;
  let description = isDoshic
    ? `Doshic distance (${dBoyToGirl}, ${dGirlToBoy})`
    : `Distance (${dBoyToGirl}, ${dGirlToBoy})`;

  // Cancellations on Bhakoot dosha:
  //   - Same rashi (distance 1, 1) — Bhakoot doesn't apply; full marks.
  //   - Mutual rashi-lord friendship (or same lord).
  if (isDoshic) {
    const boyLord = RASHI_LORD[boy.rashi]!;
    const girlLord = RASHI_LORD[girl.rashi]!;
    const sameLord = boyLord === girlLord;
    const mutualFriend =
      NAISARGIKA_MAITRI[boyLord]![girlLord] === 1 &&
      NAISARGIKA_MAITRI[girlLord]![boyLord] === 1;
    if (sameLord || mutualFriend) {
      score = 7;
      const reason = sameLord ? 'same rashi-lord' : 'mutual friendship of rashi-lords';
      description += ` — cancelled by ${reason}`;
      cancellations.push(`Bhakoot: ${reason}`);
    }
  }
  return { name: 'Bhakoot', score, maxScore: 7, description };
}

function scoreNadi(boy: NatalMoon, girl: NatalMoon, cancellations: string[]): KootScore {
  const sameNadi = NAKSHATRA_NADI[boy.nakshatra] === NAKSHATRA_NADI[girl.nakshatra];
  let score = sameNadi ? 0 : 8;
  let description = `${NAKSHATRA_NADI[boy.nakshatra]} ↔ ${NAKSHATRA_NADI[girl.nakshatra]}`;

  // Cancellations on Nadi dosha:
  //   - Boy & girl share the same nakshatra (different padas) — common
  //     classical exception.
  //   - Boy & girl rashi is the same.
  if (sameNadi) {
    const sameNakshatra = boy.nakshatra === girl.nakshatra;
    const sameRashi = boy.rashi === girl.rashi;
    if (sameNakshatra || sameRashi) {
      score = 8;
      const reason = sameNakshatra ? 'same nakshatra' : 'same rashi';
      description += ` — cancelled by ${reason}`;
      cancellations.push(`Nadi: ${reason}`);
    }
  }
  return { name: 'Nadi', score, maxScore: 8, description };
}
