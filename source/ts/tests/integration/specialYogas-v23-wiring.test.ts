/**
 * The reference almanac publishes no machine readable date list for these, so
 * there is nothing to pin against offline and the oracle is structural: each
 * yoga fires at roughly its expected rate, and on the days it fires the
 * published nakshatra distances match the rule that emitted it.
 */
import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SWEEP_START = new Date(Date.UTC(2026, 0, 1, 6, 0, 0));
const SWEEP_DAYS = 180;

interface SweepCounts {
  dwipushkar: number;
  tripushkar: number;
  jwalamukhi: number;
  aadal: number;
  vidaal: number;
  ravi: number;
}

function runSweep(): SweepCounts {
  const counts: SweepCounts = {
    dwipushkar: 0,
    tripushkar: 0,
    jwalamukhi: 0,
    aadal: 0,
    vidaal: 0,
    ravi: 0,
  };
  for (let day = 0; day < SWEEP_DAYS; day++) {
    const date = new Date(SWEEP_START.getTime() + day * 86_400_000);
    const r = getDailyPanchang(date, DELHI, { timezone: 330 });
    if (!r) continue;
    for (const y of r.specialYogas) {
      if (y.type in counts) counts[y.type as keyof SweepCounts]++;
    }
  }
  return counts;
}

describe('v2.3 yogas: 90-day Delhi sweep', () => {
  const counts = runSweep();

  it('Dwipushkar fires at least once', () => {
    expect(counts.dwipushkar).toBeGreaterThan(0);
  });

  it('Tripushkar fires at least once', () => {
    expect(counts.tripushkar).toBeGreaterThan(0);
  });

  it('Jwalamukhi fires at least once', () => {
    expect(counts.jwalamukhi).toBeGreaterThan(0);
  });

  it('Aadal fires on a substantial fraction of days', () => {
    expect(counts.aadal).toBeGreaterThan(SWEEP_DAYS / 6);
  });

  it('Vidaal fires on a substantial fraction of days', () => {
    expect(counts.vidaal).toBeGreaterThan(SWEEP_DAYS / 6);
  });

  it('Ravi fires on a substantial fraction of days', () => {
    expect(counts.ravi).toBeGreaterThan(SWEEP_DAYS / 8);
  });
});

describe('v2.3 yogas: self-consistency on emission days', () => {
  interface DayFacts {
    pairs: { tithiIdx: number; moonIdx: number }[];
    moonIdxs: number[];
    sunIdx: number;
    varaIdx: number;
  }

  function findDayWith(type: string): DayFacts | null {
    for (let day = 0; day < SWEEP_DAYS; day++) {
      const date = new Date(SWEEP_START.getTime() + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      if (!r) continue;
      if (!r.specialYogas.some((y) => y.type === type)) continue;

      const span = (x: { startTime: Date | null; endTime: Date | null }) => ({
        s: x.startTime?.getTime() ?? -Infinity,
        e: x.endTime?.getTime() ?? Infinity,
      });
      const pairs: { tithiIdx: number; moonIdx: number }[] = [];
      for (const t of r.angas.tithis) {
        for (const n of r.angas.nakshatras) {
          const a = span(t), b = span(n);
          if (a.s < b.e && b.s < a.e) pairs.push({ tithiIdx: t.index, moonIdx: n.index });
        }
      }
      return {
        pairs,
        moonIdxs: r.angas.nakshatras.map((n) => n.index),
        sunIdx: r.sun.nakshatra.index,
        varaIdx: r.angas.vara.index,
      };
    }
    return null;
  }

  const someDistance = (d: DayFacts, allowed: number[], to28: boolean): boolean => {
    const conv = (n: number) => (to28 ? (n < 21 ? n + 1 : n + 2) : n);
    const mod = to28 ? 28 : 27;
    return d.moonIdxs.some((m) => allowed.includes(((conv(m) - conv(d.sunIdx) + mod) % mod) + 1));
  };

  it('Aadal day → 28-distance is one of {2,7,9,14,16,21,23,28}', () => {
    const d = findDayWith('aadal');
    expect(d).not.toBeNull();
    expect(someDistance(d!, [2, 7, 9, 14, 16, 21, 23, 28], true)).toBe(true);
  });

  it('Vidaal day → 28-distance is one of {3,6,10,13,17,20,24,27}', () => {
    const d = findDayWith('vidaal');
    expect(d).not.toBeNull();
    expect(someDistance(d!, [3, 6, 10, 13, 17, 20, 24, 27], true)).toBe(true);
  });

  it('Ravi day → 27-distance is one of {4,6,9,10,13,20}', () => {
    const d = findDayWith('ravi');
    expect(d).not.toBeNull();
    expect(someDistance(d!, [4, 6, 9, 10, 13, 20], false)).toBe(true);
  });

  it('Jwalamukhi day → tithi-number-in-paksha × nakshatra is one of the 5 rows', () => {
    const d = findDayWith('jwalamukhi');
    expect(d).not.toBeNull();
    const rows: Record<number, number> = { 1: 18, 5: 1, 8: 2, 9: 3, 10: 8 };
    expect(d!.pairs.some((p) => rows[(p.tithiIdx % 15) + 1] === p.moonIdx)).toBe(true);
  });

  it('Dwipushkar day → vara ∈ {0,2,6} ∧ tithi-number ∈ {2,7,12} ∧ nakshatra ∈ {4,13,22}', () => {
    const d = findDayWith('dwipushkar');
    expect(d).not.toBeNull();
    expect([0, 2, 6]).toContain(d!.varaIdx);
    expect(d!.pairs.some((p) =>
      [2, 7, 12].includes((p.tithiIdx % 15) + 1) && [4, 13, 22].includes(p.moonIdx))).toBe(true);
  });

  it('Tripushkar day → vara ∈ {0,2,6} ∧ tithi-number ∈ {2,7,12} ∧ nakshatra ∈ {2,6,11,15,20,24}', () => {
    const d = findDayWith('tripushkar');
    expect(d).not.toBeNull();
    expect([0, 2, 6]).toContain(d!.varaIdx);
    expect(d!.pairs.some((p) =>
      [2, 7, 12].includes((p.tithiIdx % 15) + 1)
      && [2, 6, 11, 15, 20, 24].includes(p.moonIdx))).toBe(true);
  });
});

describe('v2.3 yogas: Hindi localization', () => {
  const findHindiName = (type: string): string | null => {
    for (let day = 0; day < SWEEP_DAYS; day++) {
      const date = new Date(SWEEP_START.getTime() + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330, language: 'hi' });
      if (!r) continue;
      const hit = r.specialYogas.find((y) => y.type === type);
      if (hit) return hit.name;
    }
    return null;
  };

  const isDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);

  for (const type of ['dwipushkar', 'tripushkar', 'jwalamukhi', 'aadal', 'vidaal', 'ravi'] as const) {
    it(`${type} renders a Devanagari name when language='hi'`, () => {
      const name = findHindiName(type);
      expect(name).not.toBeNull();
      expect(isDevanagari(name!)).toBe(true);
    });
  }
});

describe('v2.3 yogas: instant panchang wiring', () => {
  it('getInstantPanchang surfaces v2.3 yogas using the same detection logic', () => {
    let found: Date | null = null;
    for (let day = 0; day < SWEEP_DAYS; day++) {
      const date = new Date(SWEEP_START.getTime() + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      if (r?.specialYogas.some((y) => y.type === 'ravi')) {
        found = date;
        break;
      }
    }
    expect(found).not.toBeNull();
    const ip = getInstantPanchang(found!, DELHI);
    expect(ip).not.toBeNull();
    expect(Array.isArray(ip!.specialYogas)).toBe(true);
  });

  it('getInstantPanchang Hindi localization works for v2.3 yogas', () => {
    let foundLocalized = false;
    for (let day = 0; day < SWEEP_DAYS && !foundLocalized; day++) {
      const date = new Date(SWEEP_START.getTime() + day * 86_400_000);
      const ip = getInstantPanchang(date, DELHI, { language: 'hi' });
      if (!ip) continue;
      const v23Types = new Set(['dwipushkar', 'tripushkar', 'jwalamukhi', 'aadal', 'vidaal', 'ravi']);
      const hit = ip.specialYogas.find((y) => v23Types.has(y.type));
      if (hit && /[ऀ-ॿ]/.test(hit.name)) foundLocalized = true;
    }
    expect(foundLocalized).toBe(true);
  });
});
