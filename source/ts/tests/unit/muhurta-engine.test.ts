import { describe, it, expect } from 'vitest';
import {
  scoreMuhurta, findAuspiciousDates, computeAuspiciousDatesInRange, vivahRule,
  shopOpeningRule, namakaranaRule, STOCK_MUHURTA_RULES,
} from '../../src/index';
import type { MuhurtaRule } from '../../src/muhurta/engine';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const TZ = 330; // IST

describe('scoreMuhurta: basic shape', () => {
  it('returns date, score, passes, reasons', () => {
    const r = scoreMuhurta(new Date('2026-04-15'), DELHI, vivahRule, { timezone: TZ });
    expect(r).toHaveProperty('date');
    expect(r).toHaveProperty('score');
    expect(r).toHaveProperty('passes');
    expect(r).toHaveProperty('reasons');
    expect(typeof r.score).toBe('number');
    expect(typeof r.passes).toBe('boolean');
    expect(Array.isArray(r.reasons)).toBe(true);
  });

  it('score is clamped to [0, 100]', () => {
    for (let day = 1; day <= 28; day++) {
      const r = scoreMuhurta(
        new Date(Date.UTC(2026, 3, day)),
        DELHI, vivahRule, { timezone: TZ },
      );
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('scoreMuhurta: hard exclusions', () => {
  it('excludeBhadra: returns score 0 on a Bhadra day', () => {
    const rule: MuhurtaRule = { occasion: 'test', excludeBhadra: true };
    let foundBhadra = false;
    for (let day = 1; day <= 14; day++) {
      const r = scoreMuhurta(
        new Date(Date.UTC(2026, 3, day)),
        DELHI, rule, { timezone: TZ },
      );
      if (r.reasons[0]?.includes('Bhadra')) {
        expect(r.score).toBe(0);
        expect(r.passes).toBe(false);
        foundBhadra = true;
        break;
      }
    }
    expect(foundBhadra).toBe(true);
  });

  describe('bhadra mode', () => {
    const bhadraDay = (() => {
      for (let day = 1; day <= 20; day++) {
        const d = new Date(Date.UTC(2026, 3, day));
        const r = scoreMuhurta(d, DELHI, { occasion: 't', excludeBhadra: true }, { timezone: TZ });
        if (r.factors[0]?.code === 'bhadra') return d;
      }
      throw new Error('no Bhadra day found in April 2026: fixture assumption broken');
    })();

    it("'exclude' zeroes the day", () => {
      const r = scoreMuhurta(bhadraDay, DELHI, { occasion: 't', bhadra: 'exclude' }, { timezone: TZ });
      expect(r.score).toBe(0);
      expect(r.passes).toBe(false);
    });

    it("'penalize' subtracts 15 but leaves the day scorable", () => {
      const r = scoreMuhurta(bhadraDay, DELHI, { occasion: 't', bhadra: 'penalize' }, { timezone: TZ });
      expect(r.score).toBe(40);
      expect(r.factors).toContainEqual({ code: 'bhadra', axis: 'karana', delta: -15 });
      expect(r.factors).toContainEqual(
        expect.objectContaining({ code: 'sarvartha_siddhi', delta: 5 }),
      );
    });

    it("'ignore' is the default: no bhadra factor at all", () => {
      for (const rule of [{ occasion: 't' }, { occasion: 't', bhadra: 'ignore' as const }]) {
        const r = scoreMuhurta(bhadraDay, DELHI, rule, { timezone: TZ });
        expect(r.factors.some((f) => f.code === 'bhadra')).toBe(false);
      }
    });

    it('deprecated excludeBhadra still hard-vetoes', () => {
      const r = scoreMuhurta(bhadraDay, DELHI, { occasion: 't', excludeBhadra: true }, { timezone: TZ });
      expect(r.score).toBe(0);
      expect(r.passes).toBe(false);
    });

    it('bhadra wins over excludeBhadra when both are set', () => {
      const r = scoreMuhurta(
        bhadraDay, DELHI,
        { occasion: 't', excludeBhadra: true, bhadra: 'penalize' },
        { timezone: TZ },
      );
      expect(r.score).toBe(40);
      expect(r.passes).toBe(false);
      expect(r.factors).toContainEqual({ code: 'bhadra', axis: 'karana', delta: -15 });
    });

    it('the seven Bhadra-locked tithis are scorable again under the stock rules', () => {
      const days = findAuspiciousDates(
        vivahRule,
        new Date(Date.UTC(2025, 11, 31, 18, 30)),
        new Date(Date.UTC(2026, 11, 31, 18, 29)),
        DELHI,
        { timezone: TZ, includeFailures: true },
      );
      const scored = new Set<number>();
      for (const d of days) {
        for (const f of d.factors) if (f.code === 'auspicious_tithi') scored.add(f.index!);
      }
      const unreachable = (vivahRule.auspiciousTithis ?? []).filter((t) => !scored.has(t));
      expect(unreachable).toEqual([]);
    });
  });

  it('excludeEkadashi: returns score 0 on Ekadashi', () => {
    const rule: MuhurtaRule = { occasion: 'test', excludeEkadashi: true };
    let foundEkadashi = false;
    for (let day = 1; day <= 28; day++) {
      const r = scoreMuhurta(
        new Date(Date.UTC(2026, 3, day)),
        DELHI, rule, { timezone: TZ },
      );
      if (r.reasons[0]?.includes('Ekadashi')) {
        expect(r.score).toBe(0);
        expect(r.passes).toBe(false);
        foundEkadashi = true;
        break;
      }
    }
    expect(foundEkadashi).toBe(true);
  });

  it('requirePaksha: krishna paksha rule fails on shukla day', () => {
    const rule: MuhurtaRule = { occasion: 'test', requirePaksha: 'krishna' };
    let mismatchFound = false;
    for (let day = 1; day <= 28; day++) {
      const r = scoreMuhurta(
        new Date(Date.UTC(2026, 1, day)),
        DELHI, rule, { timezone: TZ },
      );
      if (r.reasons[0]?.includes('paksha is shukla')) {
        expect(r.score).toBe(0);
        expect(r.passes).toBe(false);
        mismatchFound = true;
      }
    }
    expect(mismatchFound).toBe(true);
  });
});

describe('scoreMuhurta: soft scoring', () => {
  it('matching auspicious vara raises score above neutral baseline', () => {
    const rule: MuhurtaRule = {
      occasion: 'test',
      auspiciousVaras: [4], // Thursday only
      varaTithiYogas: false,
    };
    const thursday = scoreMuhurta(new Date('2026-04-16'), DELHI, rule, { timezone: TZ });
    expect(thursday.score).toBeGreaterThan(50);
    expect(thursday.reasons.some((r) => r.includes('auspicious vara'))).toBe(true);

    const wednesday = scoreMuhurta(new Date('2026-04-15'), DELHI, rule, { timezone: TZ });
    expect(wednesday.score).toBe(50);
  });

  it('matching inauspicious vara lowers score below neutral baseline', () => {
    const rule: MuhurtaRule = {
      occasion: 'test',
      inauspiciousVaras: [2], // Tuesday only
    };
    const tuesday = scoreMuhurta(new Date('2026-04-14'), DELHI, rule, { timezone: TZ });
    expect(tuesday.score).toBeLessThan(50);
    expect(tuesday.reasons.some((r) => r.includes('inauspicious vara'))).toBe(true);
  });
});

describe('scoreMuhurta: stock rule shape', () => {
  it('every stock rule has at least one auspicious axis', () => {
    for (const rule of Object.values(STOCK_MUHURTA_RULES)) {
      const hasAusp =
        (rule.auspiciousTithis?.length ?? 0) > 0
        || (rule.auspiciousNakshatras?.length ?? 0) > 0
        || (rule.auspiciousVaras?.length ?? 0) > 0
        || (rule.auspiciousYogas?.length ?? 0) > 0;
      expect(hasAusp).toBe(true);
    }
  });

  it('every stock rule has a stable occasion string', () => {
    for (const [key, rule] of Object.entries(STOCK_MUHURTA_RULES)) {
      expect(rule.occasion).toBe(key);
    }
  });

  it('all 13 occasions present', () => {
    expect(Object.keys(STOCK_MUHURTA_RULES).sort()).toEqual([
      'aksharabhyasam', 'annaprashan', 'grihaPravesh', 'karnavedha',
      'mundan', 'namakarana', 'seemantham', 'shopOpening', 'travelStart',
      'upanayanam', 'vahanKharidi', 'vidyarambh', 'vivah',
    ]);
  });
});

describe('findAuspiciousDates', () => {
  const aprilPassing = findAuspiciousDates(
    shopOpeningRule,
    new Date('2026-04-01'),
    new Date('2026-04-30'),
    DELHI,
    { timezone: TZ },
  );
  const aprilAll = findAuspiciousDates(
    shopOpeningRule,
    new Date('2026-04-01'),
    new Date('2026-04-30'),
    DELHI,
    { timezone: TZ, includeFailures: true },
  );
  const mayShort = findAuspiciousDates(
    namakaranaRule,
    new Date('2026-05-01'),
    new Date('2026-05-15'),
    DELHI,
    { timezone: TZ, includeFailures: true },
  );

  it('returns sorted-by-score-descending', () => {
    for (let i = 1; i < aprilPassing.length; i++) {
      expect(aprilPassing[i - 1]!.score).toBeGreaterThanOrEqual(aprilPassing[i]!.score);
    }
  });

  it('only includes days with passes=true (default)', () => {
    for (const d of aprilPassing) expect(d.passes).toBe(true);
  });

  it('includeFailures returns the full set', () => {
    const passes = aprilAll.filter((d) => d.passes);
    expect(aprilAll.length).toBeGreaterThan(passes.length);
    expect(aprilAll.length).toBeGreaterThanOrEqual(28);
    expect(aprilAll.length).toBeLessThanOrEqual(31);
  });

  it('each result includes the panchang for the day', () => {
    expect(mayShort[0]!.panchang).toBeDefined();
    expect(mayShort[0]!.panchang.angas.tithis).toBeDefined();
    expect(mayShort[0]!.panchang.angas.vara).toBeDefined();
  });

  it('throws on inverted range', () => {
    expect(() => findAuspiciousDates(
      vivahRule,
      new Date('2026-05-15'),
      new Date('2026-05-01'),
      DELHI,
      { timezone: TZ },
    )).toThrow(RangeError);
  });
});

describe('Vivah rule: scoring sanity', () => {
  const dates = findAuspiciousDates(
    vivahRule,
    new Date('2026-04-21'),
    new Date('2026-05-04'),
    DELHI,
    { timezone: TZ, includeFailures: true },
  );

  it('scoring 2026-04-21 through 2026-05-04 produces some passes and some fails', () => {
    const passes = dates.filter((d) => d.passes);
    const fails = dates.filter((d) => !d.passes);
    expect(passes.length).toBeGreaterThan(0);
    expect(fails.length).toBeGreaterThan(0);
  });
});

describe('scoreMuhurta ≡ computeAuspiciousDatesInRange: single-day agreement (MU-1)', () => {
  it('66 spread days: identical score, passes and factor multiset', () => {
    const start = Date.UTC(2026, 3, 15, 12);
    const strideMs = Math.round(6.4 * 86_400_000);
    let checked = 0;
    for (let i = 0; i < 66; i++) {
      const d = new Date(start + i * strideMs);
      const single = scoreMuhurta(d, DELHI, vivahRule, { timezone: TZ });
      const [ranged] = computeAuspiciousDatesInRange(
        vivahRule, d, d, DELHI, { timezone: TZ, includeFailures: true },
      );
      expect(ranged, `range API returned a row for ${d.toISOString()}`).toBeDefined();
      expect(single.score, `score ${d.toISOString()}`).toBe(ranged!.score);
      expect(single.passes, `passes ${d.toISOString()}`).toBe(ranged!.passes);
      const multiset = (fs: { code: unknown; delta: number }[]) =>
        fs.map((f) => `${String(f.code)}:${f.delta}`).sort();
      expect(multiset(single.factors), `factors ${d.toISOString()}`)
        .toEqual(multiset(ranged!.factors));
      checked++;
    }
    expect(checked).toBe(66);
  });

  it('the MU-1 repro days converge at 60 (vivah, Delhi)', () => {
    const may4 = scoreMuhurta(new Date(Date.UTC(2027, 4, 4, 12)), DELHI, vivahRule, { timezone: TZ });
    expect(may4.score).toBe(60);
    expect(may4.factors).toContainEqual(expect.objectContaining({ code: 'amrit_siddhi' }));
    expect(may4.factors).toContainEqual(expect.objectContaining({ code: 'sarvartha_siddhi' }));

    const sep29 = scoreMuhurta(new Date(Date.UTC(2027, 8, 29, 12)), DELHI, vivahRule, { timezone: TZ });
    expect(sep29.score).toBe(60);
    expect(sep29.factors).toContainEqual(expect.objectContaining({ code: 'sarvartha_siddhi' }));
  });
});
