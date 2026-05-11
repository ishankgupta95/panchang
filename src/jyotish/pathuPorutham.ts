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

/** Names of the 10 Tamil porutham koots, in canonical order. */
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

/** One koot's pass/fail outcome and explanation. */
export interface PoruthamScore {
  /** Canonical English/transliterated koot name. */
  name: PoruthamName;
  /** True iff the koot's classical rule passes for this couple. */
  passes: boolean;
  /** Plain-English explanation of how the result was derived. */
  description: string;
  /**
   * Set to `true` when this koot is a *strong veto* (Yoni / Rajju / Vedha)
   * **and** has failed. Strong vetoes flip {@link PathuPoruthamResult.recommended}
   * to false regardless of `totalPasses`.
   */
  veto?: boolean;
}

/**
 * Pathu Porutham (10-fold) result for a Tamil-tradition compatibility test.
 */
export interface PathuPoruthamResult {
  /** Number of koots that passed (0..10). */
  totalPasses: number;
  /**
   * Final recommendation. `true` iff **no veto-level koot failed** AND
   * `totalPasses >= 5`. The 5-of-10 threshold is the classical AstroVed /
   * Drik convention for "favorable" matches.
   */
  recommended: boolean;
  /** Per-koot detail in canonical Pathu Porutham order. */
  poruthams: PoruthamScore[];
}

/**
 * Compute the 10-fold Tamil Pathu Porutham marriage compatibility test
 * between the boy (vara) and girl (vadhu).
 *
 * Pathu Porutham is the South-Indian (Tamil Nadu / Kerala / parts of
 * Karnataka) counterpart to the North-Indian Ashtakoot 36-point system.
 * Both consume the same `NatalMoon` shape (Moon's natal rashi +
 * nakshatra) but score very different criteria. The two systems are
 * complementary, not interchangeable — Tamil families typically use
 * Pathu Porutham; North-Indian families typically use Ashtakoot.
 *
 * | Koot           | Tests                                                    | Veto |
 * |----------------|----------------------------------------------------------|:----:|
 * | Dina           | Girl→boy nakshatra distance mod 9 ∈ {0,2,4,6,8} (good Tara) | no |
 * | Gana           | Deva / Manushya / Rakshasa compatibility                 | no   |
 * | Mahendra       | Girl→boy nakshatra distance ∈ {4,7,10,13,16,19,22,25}    | no   |
 * | Sthree Deergha | Girl→boy nakshatra distance > 13 (longevity rule)        | no   |
 * | Yoni           | Reuses Ashtakoot YONI table; full marks for same animal  | yes  |
 * | Rashi          | Distance not in classical doshic set ({2,12}, {6,8})     | no   |
 * | Rashyathipathi | Rashi-lord friendship (Naisargika Maitri)                 | no   |
 * | Vasya          | Vashya group score from Ashtakoot table                  | no   |
 * | Rajju          | Same Rajju group fails                                    | yes  |
 * | Vedha          | Same Vedha pair fails                                     | yes  |
 *
 * **Counting direction.** The Tamil convention counts nakshatra
 * distance **from the girl's (bride's) star to the boy's (groom's)**
 * for Dina, Mahendra, and Sthree Deergha. The Mahendra set
 * `{4,7,10,13,16,19,22,25}` happens to be symmetric under N → 29-N so
 * the Mahendra outcome is direction-independent; Dina and Sthree
 * Deergha are not.
 *
 * **Scoring scale.** Each koot is binary-scored (pass / fail) per the
 * AstroVed / Drik Tamil convention. The aggregate score is the count of
 * passing koots in 0..10. Strong vetoes (Yoni / Rajju / Vedha) flip
 * `recommended` to `false` independently of the count.
 *
 * **Why not the same 0..N max-marks scheme as Ashtakoot?** Tamil
 * tradition explicitly uses the 10-favorable count rather than the
 * 36-point weighted total. This function follows the published Tamil
 * convention; callers wanting the Ashtakoot 36-point weighted score
 * should use {@link computeAshtakoot} alongside.
 *
 * @param boy   Groom's natal Moon — `{ rashi: 0..11, nakshatra: 0..26 }`.
 * @param girl  Bride's natal Moon — same shape.
 * @returns     {@link PathuPoruthamResult} with aggregate count, binary
 *              `recommended` flag, and per-koot detail.
 *
 * @example
 * ```typescript
 * import { computePathuPorutham } from 'panchang-ts';
 *
 * const result = computePathuPorutham(
 *   { rashi: 4, nakshatra: 9 },   // Boy: Magha / Leo
 *   { rashi: 0, nakshatra: 1 },   // Girl: Bharani / Aries
 * );
 * result.totalPasses;             // 0..10
 * result.recommended;             // boolean (no veto + ≥5 passes)
 * result.poruthams[4]!.name;      // 'Yoni' (a veto-level koot)
 * ```
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

// ── Per-koot scoring ───────────────────────────────────

function scoreDina(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  // Classical Tamil rule: count nakshatra distance from GIRL → BOY
  // (1-indexed), then take mod 9. Auspicious remainders correspond to
  // the good 9-Tara classes: {Sampat=2, Kshema=4, Sadhana=6, Mitra=8,
  // Param Mitra=0}. Inauspicious remainders {3, 5, 7} are Vipat,
  // Pratyari, and Naidhana respectively. Remainder 1 (Janma — same
  // nakshatra) is Mixed in the classical Tara scheme but counted as a
  // fail in the binary Pathu Porutham scheme.
  const distance = ((boy.nakshatra - girl.nakshatra + 27) % 27) + 1;
  const remainder = distance % 9;
  const passes = DINA_AUSPICIOUS_REMAINDERS.includes(remainder);
  return {
    name: 'Dina',
    passes,
    description: `Girl→Boy nakshatra distance ${distance} (mod 9 = ${remainder}) — ${passes ? 'auspicious' : 'inauspicious'}`,
  };
}

function scoreGana(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const boyGana = NAKSHATRA_GANA[boy.nakshatra]!;
  const girlGana = NAKSHATRA_GANA[girl.nakshatra]!;
  // Deva-Deva, Man-Man, Rak-Rak: pass. Deva-Man and Man-Deva: pass.
  // Deva-Rak / Rak-Deva: pass with caution (counted as pass per AstroVed).
  // Man-Rak / Rak-Man: fails — temperamental clash.
  const fails =
    (boyGana === 'manushya' && girlGana === 'rakshasa') ||
    (boyGana === 'rakshasa' && girlGana === 'manushya');
  return {
    name: 'Gana',
    passes: !fails,
    description: `Boy ${boyGana} ↔ Girl ${girlGana}${fails ? ' — clash' : ''}`,
  };
}

function scoreMahendra(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  // Classical Tamil rule: count from GIRL → BOY. The Mahendra set
  // {4,7,10,13,16,19,22,25} is symmetric under N → 29-N so the result
  // is direction-independent, but we count girl→boy for documentation
  // consistency with Dina and Sthree Deergha.
  const distance = ((boy.nakshatra - girl.nakshatra + 27) % 27) + 1;
  const passes = MAHENDRA_AUSPICIOUS_DISTANCES.includes(distance);
  return {
    name: 'Mahendra',
    passes,
    description: `Girl→Boy nakshatra distance ${distance} — ${passes ? 'in Mahendra set {4,7,10,13,16,19,22,25}' : 'not in Mahendra set'}`,
  };
}

function scoreSthreeDeergha(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  // Classical Tamil rule: count from GIRL → BOY (nakshatra distance, 1-indexed).
  // Threshold is locked at > 13 ("Uthamam" / best). This matches the
  // dominant Tamil-Drik consensus: AstroVed Tamil article, mpanchang
  // Thirumana Porutham, epanchang Stree Deergha, dheivegam Tamil match,
  // and the "Marriage Matching Tips" Tamil reference all use the same
  // > 13 boundary. Phase 34b explicitly rejects two competing variants
  // surfaced in the corpus:
  //   - The minority > 15 boy→girl threshold from one AstroVed English
  //     article (the rest of the AstroVed family uses > 13).
  //   - The graduated band reading (>= 7 acceptable, > 13 ideal) — the
  //     "Mathiyamam" / medium band — which doesn't fit Pathu Porutham's
  //     binary pass/fail scheme.
  // Since drik panchang does not surface a Mathiyamam variant flag, we
  // keep this as a single locked threshold per the Phase 34 principle
  // ("don't expose variants drik doesn't expose").
  const distance = ((boy.nakshatra - girl.nakshatra + 27) % 27) + 1;
  const passes = distance > 13;
  return {
    name: 'SthreeDeergha',
    passes,
    description: `Girl→Boy nakshatra distance ${distance} — ${passes ? 'longevity favorable (> 13)' : 'longevity weak (≤ 13)'}`,
  };
}

function scoreYoni(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const boyYoni = NAKSHATRA_YONI[boy.nakshatra]!;
  const girlYoni = NAKSHATRA_YONI[girl.nakshatra]!;
  const score = YONI_SCORE[yoniIndex(boyYoni)]![yoniIndex(girlYoni)]!;
  // Score 0 = enemy yoni — strong veto. Score >= 2 = pass; score 1
  // (unfriendly) is borderline and counted as a fail in the binary
  // scheme but not vetoed.
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
    description: `Rashi distance (${dBoyToGirl}, ${dGirlToBoy})${isDoshic ? ' — doshic' : ''}`,
  };
}

function scoreRashyathipathi(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  const boyLord = RASHI_LORD[boy.rashi]!;
  const girlLord = RASHI_LORD[girl.rashi]!;
  if (boyLord === girlLord) {
    return {
      name: 'Rashyathipathi',
      passes: true,
      description: `Same rashi-lord (graha index ${boyLord}) — full compatibility`,
    };
  }
  const boyView = NAISARGIKA_MAITRI[boyLord]![girlLord]!;
  const girlView = NAISARGIKA_MAITRI[girlLord]![boyLord]!;
  // Pass if neither lord views the other as enemy. Both friend, mutual
  // neutral, or one neutral one friend all qualify.
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
  // Pass if score >= 0.5 (any non-zero compatibility under Ashtakoot
  // table). Score 0 = no mutual influence — fail.
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
      ? `Both in ${boyRajju} Rajju — strong veto (longevity threat)`
      : `Boy ${boyRajju} ↔ Girl ${girlRajju} — different rajju`,
  };
  if (sameRajju) out.veto = true;
  return out;
}

function scoreVedha(boy: NatalMoon, girl: NatalMoon): PoruthamScore {
  // Vedha veto triggers when the boy's nakshatra and the girl's are
  // each other's vedha-pair partners.
  const partner = vedhaOf(boy.nakshatra);
  const isVedha = partner !== null && partner === girl.nakshatra;
  const out: PoruthamScore = {
    name: 'Vedha',
    passes: !isVedha,
    description: isVedha
      ? `Boy nakshatra ${boy.nakshatra} ↔ Girl nakshatra ${girl.nakshatra} are vedha partners — strong veto`
      : 'No Vedha obstruction',
  };
  if (isVedha) out.veto = true;
  return out;
}
