import {
  RASHI_LORD, NAISARGIKA_MAITRI,
  RASHI_VASHYA, VASHYA_SCORE, vashyaIndex,
  NAKSHATRA_YONI, YONI_SCORE, yoniIndex,
  NAKSHATRA_GANA,
} from './matchingTables';
import {
  NAKSHATRA_RAJJU, vedhaOf,
  MAHENDRA_AUSPICIOUS_DISTANCES, DINA_AUSPICIOUS_REMAINDERS,
  RASHI_DOSHIC_DISTANCES,
} from './pathuPoruthamTables';
import type { NatalMoon } from './matching';
import { assertNakshatraIndex } from '../utils/validation';

export type PoruthamName =
  | 'Dina'
  | 'Gana'
  | 'Mahendra'
  | 'SthreeDeergha'
  | 'Yoni'
  | 'Rashi'
  | 'Rashyathipathi'
  | 'Vasya'
  | 'Rajju'
  | 'Vedha';

export interface PoruthamScore {
  name: PoruthamName;
  passes: boolean;
  description: string;
  /** Present only when this koot is a strong veto (Yoni / Rajju / Vedha) and failed. */
  veto?: boolean;
}

export interface PathuPoruthamResult {
  totalPasses: number;
  /** True iff no veto-level koot failed and `totalPasses >= 5`. */
  recommended: boolean;
  poruthams: PoruthamScore[];
}

/**
 * Pathu Porutham, the Tamil 10-fold pass/fail marriage compatibility test; Dina,
 * Mahendra and Sthree Deergha count nakshatra distance girl to boy, per Tamil
 * convention.
 */
export function computePathuPorutham(boy: NatalMoon, girl: NatalMoon): PathuPoruthamResult {
  validateNatalMoon(boy, 'boy');
  validateNatalMoon(girl, 'girl');

  const poruthams: PoruthamScore[] = [
    scoreDina(boy, girl),
    scoreGana(boy, girl),
    scoreMahendra(boy, girl),
    scoreSthreeDeergha(boy, girl),
    scoreYoni(boy, girl),
    scoreRashi(boy, girl),
    scoreRashyathipathi(boy, girl),
    scoreVasya(boy, girl),
    scoreRajju(boy, girl),
    scoreVedha(boy, girl),
  ];

  const totalPasses = poruthams.reduce((c, k) => c + (k.passes ? 1 : 0), 0);
  const vetoFailed = poruthams.some((k) => k.veto === true);
  const recommended = !vetoFailed && totalPasses >= 5;

  return { totalPasses, recommended, poruthams };
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

function scoreDina(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  // Remainder 1 (Janma) is Mixed in the 9-Tara scheme but fails in this binary one.
  const distance = ((boy.nakshatra - girl.nakshatra + 27) % 27) + 1;
  const remainder = distance % 9;
  const passes = DINA_AUSPICIOUS_REMAINDERS.includes(remainder);
  return {
    name: 'Dina',
    passes,
    description: `Girl→Boy nakshatra distance ${distance} (mod 9 = ${remainder}), ${passes ? 'auspicious' : 'inauspicious'}`,
  };
}

function scoreGana(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const boyGana = NAKSHATRA_GANA[boy.nakshatra]!;
  const girlGana = NAKSHATRA_GANA[girl.nakshatra]!;
  // Only Manushya-Rakshasa fails; Deva-Rakshasa counts as a pass per AstroVed.
  const fails =
    (boyGana === 'manushya' && girlGana === 'rakshasa') ||
    (boyGana === 'rakshasa' && girlGana === 'manushya');
  return {
    name: 'Gana',
    passes: !fails,
    description: `Boy ${boyGana} ↔ Girl ${girlGana}${fails ? ', clash' : ''}`,
  };
}

function scoreMahendra(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  // The Mahendra set is closed under N → 29-N, so the verdict is direction-independent.
  const distance = ((boy.nakshatra - girl.nakshatra + 27) % 27) + 1;
  const passes = MAHENDRA_AUSPICIOUS_DISTANCES.includes(distance);
  return {
    name: 'Mahendra',
    passes,
    description: `Girl→Boy nakshatra distance ${distance}, ${passes ? 'in Mahendra set {4,7,10,13,16,19,22,25}' : 'not in Mahendra set'}`,
  };
}

function scoreSthreeDeergha(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  // Threshold locked at > 13 ("Uthamam"), the dominant Tamil consensus and the
  // one the reference almanac follows.
  const distance = ((boy.nakshatra - girl.nakshatra + 27) % 27) + 1;
  const passes = distance > 13;
  return {
    name: 'SthreeDeergha',
    passes,
    description: `Girl→Boy nakshatra distance ${distance}, ${passes ? 'longevity favorable (> 13)' : 'longevity weak (≤ 13)'}`,
  };
}

function scoreYoni(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const boyYoni = NAKSHATRA_YONI[boy.nakshatra]!;
  const girlYoni = NAKSHATRA_YONI[girl.nakshatra]!;
  const score = YONI_SCORE[yoniIndex(boyYoni)]![yoniIndex(girlYoni)]!;
  // 0 = enemy yoni → veto; 1 (unfriendly) fails but does not veto.
  const passes = score >= 2;
  const veto = score === 0;
  const out: PoruthamScore = {
    name: 'Yoni',
    passes,
    description: `${boyYoni} ↔ ${girlYoni} (Ashtakoot Yoni score ${score}/4)`,
  };
  if (veto) out.veto = true;
  return out;
}

function scoreRashi(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const dBoyToGirl = ((girl.rashi - boy.rashi + 12) % 12) + 1;
  const dGirlToBoy = ((boy.rashi - girl.rashi + 12) % 12) + 1;
  const isDoshic = RASHI_DOSHIC_DISTANCES.some(
    ([a, b]) => a === dBoyToGirl && b === dGirlToBoy,
  );
  return {
    name: 'Rashi',
    passes: !isDoshic,
    description: `Rashi distance (${dBoyToGirl}, ${dGirlToBoy})${isDoshic ? ', doshic' : ''}`,
  };
}

function scoreRashyathipathi(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const boyLord = RASHI_LORD[boy.rashi]!;
  const girlLord = RASHI_LORD[girl.rashi]!;
  if (boyLord === girlLord) {
    return {
      name: 'Rashyathipathi',
      passes: true,
      description: `Same rashi-lord (graha index ${boyLord}), full compatibility`,
    };
  }
  const boyView = NAISARGIKA_MAITRI[boyLord]![girlLord]!;
  const girlView = NAISARGIKA_MAITRI[girlLord]![boyLord]!;
  const passes = boyView !== -1 && girlView !== -1;
  return {
    name: 'Rashyathipathi',
    passes,
    description: `Boy lord views girl lord as ${maitriLabel(boyView)}; girl lord views boy lord as ${maitriLabel(girlView)}`,
  };
}

function maitriLabel(v: number): string {
  return v === 1 ? 'friend' : v === -1 ? 'enemy' : 'neutral';
}

function scoreVasya(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const boyVashya = RASHI_VASHYA[boy.rashi]!;
  const girlVashya = RASHI_VASHYA[girl.rashi]!;
  const score = VASHYA_SCORE[vashyaIndex(boyVashya)]![vashyaIndex(girlVashya)]!;
  const passes = score > 0;
  return {
    name: 'Vasya',
    passes,
    description: `${boyVashya} ↔ ${girlVashya} (Ashtakoot Vashya score ${score}/2)`,
  };
}

function scoreRajju(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const boyRajju = NAKSHATRA_RAJJU[boy.nakshatra]!;
  const girlRajju = NAKSHATRA_RAJJU[girl.nakshatra]!;
  const sameRajju = boyRajju === girlRajju;
  const out: PoruthamScore = {
    name: 'Rajju',
    passes: !sameRajju,
    description: sameRajju
      ? `Both in ${boyRajju} Rajju, strong veto (longevity threat)`
      : `Boy ${boyRajju} ↔ Girl ${girlRajju}, different rajju`,
  };
  if (sameRajju) out.veto = true;
  return out;
}

function scoreVedha(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const partner = vedhaOf(boy.nakshatra);
  const isVedha = partner !== null && partner === girl.nakshatra;
  const out: PoruthamScore = {
    name: 'Vedha',
    passes: !isVedha,
    description: isVedha
      ? `Boy nakshatra ${boy.nakshatra} ↔ Girl nakshatra ${girl.nakshatra} are vedha partners, strong veto`
      : 'No Vedha obstruction',
  };
  if (isVedha) out.veto = true;
  return out;
}
