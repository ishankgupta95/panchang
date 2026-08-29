import { describe, it, expect } from 'vitest';
import { STOCK_MUHURTA_RULES } from '../../src/index';

/** Mirrors GANDA_MULA_SEVERITY in core/gandaMula.ts. */
const GANDA_MULA = new Set([0, 8, 9, 17, 18, 26]);
const RIKTA = new Set([3, 8, 13, 18, 23, 28]);
/** Must match the engine's `excludeEkadashi` check. */
const EKADASHI = [10, 25];

const RULES = Object.entries(STOCK_MUHURTA_RULES);

describe('stock muhurta rules: index ranges', () => {
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

describe('stock muhurta rules: classical tithi structure', () => {
  it.each(RULES)('%s: no Rikta tithi is listed auspicious', (_key, rule) => {
    const bad = (rule.auspiciousTithis ?? []).filter((t) => RIKTA.has(t));
    expect(bad).toEqual([]);
  });

  it.each(RULES)('%s: Amavasya is never auspicious', (_key, rule) => {
    expect(rule.auspiciousTithis ?? []).not.toContain(29);
  });

  // The Nanda/Bhadra/Jaya/Rikta/Purna cycle repeats in both pakshas; restricting
  // to a fortnight is what `requirePaksha` is for.
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

describe('stock muhurta rules: no unreachable auspicious entries', () => {
  // Hard exclusions run before soft scoring, so a vetoed entry is dead data.
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

describe('vivah rule: parity with the published classical list', () => {
  // The Muhurta-chintamani list, per the almanac's marriage-nakshatra page.
  it('carries exactly the eleven canonical vivah nakshatras', () => {
    expect([...(STOCK_MUHURTA_RULES.vivah!.auspiciousNakshatras ?? [])].sort((a, b) => a - b))
      .toEqual([3, 4, 9, 11, 12, 14, 16, 18, 20, 25, 26]);
  });

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
