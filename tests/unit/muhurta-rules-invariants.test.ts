/**
 * Structural invariants for the 13 stock muhurta rules.
 *
 * These are pure data assertions — no panchang pipeline. They exist because
 * the rule lists were originally hand-transcribed from classical sources
 * into 0-based indices, and every historical defect in them was one of the
 * classes below: a Rikta tithi landing in an auspicious list via an
 * off-by-one, an auspicious entry made unreachable by a hard exclusion on
 * the same rule, or a tithi marked good in one paksha and bad in the other.
 *
 * Anything asserted here is a property no correct rule can violate, so a
 * failure means the data is wrong — not that the tradition is ambiguous.
 */

import { describe, it, expect } from 'vitest';
import { STOCK_MUHURTA_RULES } from '../../src/index';

/** Ganda Mula nakshatras — mirrors GANDA_MULA_SEVERITY in core/gandaMula.ts. */
const GANDA_MULA = new Set([0, 8, 9, 17, 18, 26]);
/** Rikta tithis — 4th, 9th, 14th of each paksha. */
const RIKTA = new Set([3, 8, 13, 18, 23, 28]);
/** Ekadashi indices, matching the engine's `excludeEkadashi` check. */
const EKADASHI = [10, 25];

const RULES = Object.entries(STOCK_MUHURTA_RULES);

describe('stock muhurta rules — index ranges', () => {
  it.each(RULES)('%s: every index is in range', (_key, rule) => {
    for (const t of [...(rule.auspiciousTithis ?? []), ...(rule.inauspiciousTithis ?? [])]) {
      expect(Number.isInteger(t) && t >= 0 && t <= 29).toBe(true);
    }
    for (const n of [...(rule.auspiciousNakshatras ?? []), ...(rule.inauspiciousNakshatras ?? [])]) {
      expect(Number.isInteger(n) && n >= 0 && n <= 26).toBe(true);
    }
    for (const v of [...(rule.auspiciousVaras ?? []), ...(rule.inauspiciousVaras ?? [])]) {
      expect(Number.isInteger(v) && v >= 0 && v <= 6).toBe(true);
    }
  });

  it.each(RULES)('%s: no index is both auspicious and inauspicious', (_key, rule) => {
    const overlap = (a?: readonly number[], b?: readonly number[]) =>
      (a ?? []).filter((x) => (b ?? []).includes(x));
    expect(overlap(rule.auspiciousTithis, rule.inauspiciousTithis)).toEqual([]);
    expect(overlap(rule.auspiciousNakshatras, rule.inauspiciousNakshatras)).toEqual([]);
    expect(overlap(rule.auspiciousVaras, rule.inauspiciousVaras)).toEqual([]);
  });

  it.each(RULES)('%s: no duplicate entries', (_key, rule) => {
    for (const list of [rule.auspiciousTithis, rule.inauspiciousTithis,
      rule.auspiciousNakshatras, rule.inauspiciousNakshatras]) {
      if (list) expect(new Set(list).size).toBe(list.length);
    }
  });
});

describe('stock muhurta rules — classical tithi structure', () => {
  it.each(RULES)('%s: no Rikta tithi is listed auspicious', (_key, rule) => {
    const bad = (rule.auspiciousTithis ?? []).filter((t) => RIKTA.has(t));
    expect(bad).toEqual([]);
  });

  it.each(RULES)('%s: Amavasya is never auspicious', (_key, rule) => {
    expect(rule.auspiciousTithis ?? []).not.toContain(29);
  });

  /**
   * Tithi quality is a property of the number within the paksha, and the
   * Nanda/Bhadra/Jaya/Rikta/Purna cycle repeats identically in both — so a
   * rule may not call the same tithi number good in one and bad in the
   * other. Restricting to a fortnight is what `requirePaksha` is for.
   */
  it.each(RULES)('%s: no tithi number contradicts itself across pakshas', (_key, rule) => {
    const ausp = rule.auspiciousTithis ?? [];
    const inausp = rule.inauspiciousTithis ?? [];
    const conflicts: string[] = [];
    for (let n = 0; n < 14; n++) {
      const shukla = n;
      const krishna = n + 15;
      const contradicts = (ausp.includes(shukla) && inausp.includes(krishna))
        || (inausp.includes(shukla) && ausp.includes(krishna));
      if (contradicts) conflicts.push(`tithi number ${n + 1}`);
    }
    expect(conflicts).toEqual([]);
  });
});

describe('stock muhurta rules — no unreachable auspicious entries', () => {
  /**
   * Hard exclusions run before soft scoring and return immediately, so an
   * auspicious entry that a same-rule exclusion always vetoes is dead data
   * that silently narrows the rule.
   */
  it.each(RULES)('%s: excludeEkadashi does not veto its own auspicious tithis', (_key, rule) => {
    if (!rule.excludeEkadashi) return;
    const dead = (rule.auspiciousTithis ?? []).filter((t) => EKADASHI.includes(t));
    expect(dead).toEqual([]);
  });

  it.each(RULES)('%s: excludeGandaMula does not veto its own auspicious nakshatras', (_key, rule) => {
    if (!rule.excludeGandaMula) return;
    const dead = (rule.auspiciousNakshatras ?? []).filter((n) => GANDA_MULA.has(n));
    expect(dead).toEqual([]);
  });

  it.each(RULES)('%s: requirePaksha does not veto its own auspicious tithis', (_key, rule) => {
    if (!rule.requirePaksha) return;
    const wrongSide = (rule.auspiciousTithis ?? []).filter(
      (t) => (t < 15 ? 'shukla' : 'krishna') !== rule.requirePaksha,
    );
    expect(wrongSide).toEqual([]);
  });
});

describe('vivah rule — parity with the published classical list', () => {
  /**
   * The eleven vivah nakshatras, per drikpanchang's marriage-nakshatra page
   * and the Muhurta-chintamani list the module header cites.
   */
  it('carries exactly the eleven canonical vivah nakshatras', () => {
    expect([...(STOCK_MUHURTA_RULES.vivah!.auspiciousNakshatras ?? [])].sort((a, b) => a - b))
      .toEqual([3, 4, 9, 11, 12, 14, 16, 18, 20, 25, 26]);
  });

  /** Dwitiya, Tritiya, Panchami, Saptami, Ekadashi, Trayodashi — both pakshas. */
  it('carries the six preferred vivah tithi numbers in both pakshas', () => {
    const ausp = STOCK_MUHURTA_RULES.vivah!.auspiciousTithis ?? [];
    for (const n of [2, 3, 5, 7, 11, 13]) {
      expect(ausp).toContain(n - 1);
      expect(ausp).toContain(n + 14);
    }
  });

  it('rejects all three Rikta tithi numbers in both pakshas', () => {
    const inausp = STOCK_MUHURTA_RULES.vivah!.inauspiciousTithis ?? [];
    for (const n of [4, 9, 14]) {
      expect(inausp).toContain(n - 1);
      expect(inausp).toContain(n + 14);
    }
  });
});
