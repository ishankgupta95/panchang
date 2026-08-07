/**
 * Unit tests for the muhurta scoring engine and the 13 stock rules.
 *
 * The engine wraps `getDailyPanchang`, so these tests do hit the live
 * panchang pipeline — but the rules are simple-to-reason-about lookups so
 * the assertions are deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreMuhurta, findAuspiciousDates, vivahRule,
  shopOpeningRule, namakaranaRule, STOCK_MUHURTA_RULES,
} from '../../src/index';
import type { MuhurtaRule } from '../../src/muhurta/engine';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const TZ = 330; // IST

describe('scoreMuhurta — basic shape', () => {
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

describe('scoreMuhurta — hard exclusions', () => {
  it('excludeBhadra: returns score 0 on a Bhadra day', () => {
    // Find a known Bhadra day. Bhadra is Vishti karana (karana index 7,
    // 14, 21, 28, 35, 42, 49, 56) — appears every ~3.6 days. We'll simply
    // sweep until we find one in the test, assert it's excluded.
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
    // Sanity: Bhadra should occur ~4 times in a 14-day span.
    expect(foundBhadra).toBe(true);
  });

  it('excludeEkadashi: returns score 0 on Ekadashi', () => {
    // Ekadashi every ~14 days. Sweep until found.
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
    // Pick a known shukla-paksha day (Phalguna shukla pratipada around 2026-02-17).
    // Sweep — at least one of the 28 days will have a tithi mismatch.
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

describe('scoreMuhurta — soft scoring', () => {
  it('matching auspicious vara raises score above neutral baseline', () => {
    const rule: MuhurtaRule = {
      occasion: 'test',
      auspiciousVaras: [4], // Thursday only
    };
    // 2026-04-16 is a Thursday.
    const thursday = scoreMuhurta(new Date('2026-04-16'), DELHI, rule, { timezone: TZ });
    expect(thursday.score).toBeGreaterThan(50);
    expect(thursday.reasons.some((r) => r.includes('auspicious vara'))).toBe(true);

    // 2026-04-15 is a Wednesday — not in auspicious list, no penalty either.
    const wednesday = scoreMuhurta(new Date('2026-04-15'), DELHI, rule, { timezone: TZ });
    expect(wednesday.score).toBe(50);
  });

  it('matching inauspicious vara lowers score below neutral baseline', () => {
    const rule: MuhurtaRule = {
      occasion: 'test',
      inauspiciousVaras: [2], // Tuesday only
    };
    // 2026-04-14 is a Tuesday.
    const tuesday = scoreMuhurta(new Date('2026-04-14'), DELHI, rule, { timezone: TZ });
    expect(tuesday.score).toBeLessThan(50);
    expect(tuesday.reasons.some((r) => r.includes('inauspicious vara'))).toBe(true);
  });
});

describe('scoreMuhurta — stock rule shape', () => {
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
  // Two shared April-2026 sweeps with shopOpening, plus a smaller May sweep
  // with namakarana, used across all the assertions below to avoid running
  // the same panchang sweep multiple times.
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

describe('Vivah rule — scoring sanity', () => {
  // Use a short Apr–May 2026 window (2 weeks) instead of a full month to keep
  // the parallel CPU footprint small. This window is deliberately *outside*
  // Adhik Jyeshtha (17 May – 15 Jun 2026): Vivah excludes the entire Adhika
  // month, so a window inside it yields zero passes and can't exercise both
  // branches.
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
    // Vivah is restrictive (excludes ekadashi, bhadra, adhika) — expect both
    // across a 14-day window which always contains at least one Bhadra and
    // one Ganda-Mula day.
    expect(passes.length).toBeGreaterThan(0);
    expect(fails.length).toBeGreaterThan(0);
  });
});
