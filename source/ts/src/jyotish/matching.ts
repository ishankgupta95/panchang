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

export interface NatalMoon {
  /** Moon's rashi at birth (0 = Mesha … 11 = Meena). */
  rashi: number;
  /** Moon's nakshatra at birth (0 = Ashwini … 26 = Revati). */
  nakshatra: number;
  /** Lagna rashi, 0..11. Enables the same-lagna-lord and same-7th-lord Bhakoot cancellations when BOTH natives carry it. */
  lagnaRashi?: number;
  /** Moon's Navamsa (D9) rashi, 0..11. Enables the same-Navamsa-lord Bhakoot cancellation when BOTH natives carry it. */
  navamsaRashi?: number;
  /** Nakshatra pada, 1..4. Validated but not used in scoring. */
  nakshatraPada?: number;
}

export type KootName = 'Varna' | 'Vashya' | 'Tara' | 'Yoni' | 'Graha Maitri' | 'Gana' | 'Bhakoot' | 'Nadi';

/** Behaviour switches for {@link computeAshtakoot}; every flag defaults off. */
export interface AshtakootOptions {
  /** Restore a doshic Gana score (≤ 1) to 6 when the rashi-lords are the same graha or mutual friends; the reference almanac applies no Gana cancellation. */
  ganaCancellation?: boolean;
}

export interface KootScore {
  name: KootName;
  score: number;
  maxScore: number;
  description: string;
}

export interface AshtakootResult {
  /** Sum of the 8 koot scores, 0..36. */
  totalScore: number;
  /** Per-koot breakdown in canonical Brihat-Samhita order. */
  koots: KootScore[];
  /** Cancellations that were *applied* (raised a 0 to full marks). */
  cancellations: string[];
}

/**
 * Ashtakoot Guna Milan: the 36-point compatibility test between groom (vara) and
 * bride (vadhu), scored from each native's natal Moon rashi and nakshatra.
 */
export function computeAshtakoot(
  boy: NatalMoon,
  girl: NatalMoon,
  options: AshtakootOptions = {},
): AshtakootResult {
  validateNatalMoon(boy, 'boy');
  validateNatalMoon(girl, 'girl');

  const cancellations: string[] = [];

  const koots: KootScore[] = [
    scoreVarna(boy, girl),
    scoreVashya(boy, girl),
    scoreTara(boy, girl),
    scoreYoni(boy, girl),
    scoreGrahaMaitri(boy, girl),
    scoreGana(boy, girl, cancellations, options.ganaCancellation === true),
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
  if (m.lagnaRashi !== undefined &&
      (!Number.isInteger(m.lagnaRashi) || m.lagnaRashi < 0 || m.lagnaRashi >= 12)) {
    throw new RangeError(`${label}.lagnaRashi must be integer in [0, 11], got ${m.lagnaRashi}`);
  }
  if (m.navamsaRashi !== undefined &&
      (!Number.isInteger(m.navamsaRashi) || m.navamsaRashi < 0 || m.navamsaRashi >= 12)) {
    throw new RangeError(`${label}.navamsaRashi must be integer in [0, 11], got ${m.navamsaRashi}`);
  }
  if (m.nakshatraPada !== undefined &&
      (!Number.isInteger(m.nakshatraPada) || m.nakshatraPada < 1 || m.nakshatraPada > 4)) {
    throw new RangeError(`${label}.nakshatraPada must be integer in [1, 4], got ${m.nakshatraPada}`);
  }
}

function scoreVarna(boy: NatalMoon, girl: NatalMoon): KootScore {
  const boyRank = VARNA_RANK[RASHI_VARNA[boy.rashi]!];
  const girlRank = VARNA_RANK[RASHI_VARNA[girl.rashi]!];
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
    description = `Same rashi-lord (graha ${boyLord}), full marks`;
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

function scoreGana(
  boy: NatalMoon,
  girl: NatalMoon,
  cancellations: string[],
  applyCancellation: boolean,
): KootScore {
  const b = ganaIdx(NAKSHATRA_GANA[boy.nakshatra]!);
  const g = ganaIdx(NAKSHATRA_GANA[girl.nakshatra]!);
  let score = GANA_SCORE[b]![g]!;
  let description = `${NAKSHATRA_GANA[boy.nakshatra]} ↔ ${NAKSHATRA_GANA[girl.nakshatra]}`;

  // Doshic cells are only Manushya-Rakshasa (0) and Deva-Rakshasa (1).
  if (applyCancellation && score <= 1) {
    const boyLord = RASHI_LORD[boy.rashi]!;
    const girlLord = RASHI_LORD[girl.rashi]!;
    const sameLord = boyLord === girlLord;
    const mutualFriend =
      NAISARGIKA_MAITRI[boyLord]![girlLord] === 1 &&
      NAISARGIKA_MAITRI[girlLord]![boyLord] === 1;
    if (sameLord || mutualFriend) {
      score = 6;
      const reason = sameLord ? 'same rashi-lord' : 'mutual friendship of rashi-lords';
      description += `, cancelled by ${reason}`;
      cancellations.push(`Gana: ${reason}`);
    }
  }

  return { name: 'Gana', score, maxScore: 6, description };
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
      description += `, cancelled by ${reason}`;
      cancellations.push(`Bhakoot: ${reason}`);
    } else {
      if (boy.lagnaRashi !== undefined && girl.lagnaRashi !== undefined) {
        const boyLagnaLord = RASHI_LORD[boy.lagnaRashi]!;
        const girlLagnaLord = RASHI_LORD[girl.lagnaRashi]!;
        if (boyLagnaLord === girlLagnaLord) {
          score = 7;
          description += ', cancelled by same lagna-lord';
          cancellations.push('Bhakoot: same lagna-lord');
        } else {
          const boySeventhLord = RASHI_LORD[(boy.lagnaRashi + 6) % 12]!;
          const girlSeventhLord = RASHI_LORD[(girl.lagnaRashi + 6) % 12]!;
          if (boySeventhLord === girlSeventhLord) {
            score = 7;
            description += ', cancelled by same 7th-house lord';
            cancellations.push('Bhakoot: same 7th-house lord');
          }
        }
      }
      if (score === 0 && boy.navamsaRashi !== undefined && girl.navamsaRashi !== undefined) {
        const boyNavLord = RASHI_LORD[boy.navamsaRashi]!;
        const girlNavLord = RASHI_LORD[girl.navamsaRashi]!;
        if (boyNavLord === girlNavLord) {
          score = 7;
          description += ', cancelled by same Navamsa lord';
          cancellations.push('Bhakoot: same Navamsa lord');
        }
      }
    }
  }
  return { name: 'Bhakoot', score, maxScore: 7, description };
}

function scoreNadi(boy: NatalMoon, girl: NatalMoon, cancellations: string[]): KootScore {
  const sameNadi = NAKSHATRA_NADI[boy.nakshatra] === NAKSHATRA_NADI[girl.nakshatra];
  let score = sameNadi ? 0 : 8;
  let description = `${NAKSHATRA_NADI[boy.nakshatra]} ↔ ${NAKSHATRA_NADI[girl.nakshatra]}`;

  if (sameNadi) {
    const sameNakshatra = boy.nakshatra === girl.nakshatra;
    const sameRashi = boy.rashi === girl.rashi;
    if (sameNakshatra || sameRashi) {
      score = 8;
      const reason = sameNakshatra ? 'same nakshatra' : 'same rashi';
      description += `, cancelled by ${reason}`;
      cancellations.push(`Nadi: ${reason}`);
    }
  }
  return { name: 'Nadi', score, maxScore: 8, description };
}
