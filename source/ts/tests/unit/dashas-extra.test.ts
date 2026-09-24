import { describe, it, expect } from 'vitest';
import {
  computeAshtottariDasha, computeYoginiDasha, computeCharaDasha,
  ASHTOTTARI_ORDER, ASHTOTTARI_YEARS,
  YOGINI_ORDER, YOGINI_YEARS, YOGINI_PLANET,
  CHARA_RASHI_YEARS,
} from '../../src/jyotish/dasha';
import { NAKSHATRA_SPAN } from '../../src/utils/constants';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SAMPLE = new Date('1995-08-15T05:30:00Z');

describe('Ashtottari Dasha: cycle constants', () => {
  it('total years sum to 108', () => {
    let total = 0;
    for (const lord of ASHTOTTARI_ORDER) {
      total += ASHTOTTARI_YEARS[lord]!;
    }
    expect(total).toBe(108);
  });

  it('cycle order has 8 lords (Sun, Moon, Mars, Mercury, Saturn, Jupiter, Rahu, Venus)', () => {
    expect(ASHTOTTARI_ORDER).toHaveLength(8);
    expect(ASHTOTTARI_ORDER).toEqual([
      'Sun', 'Moon', 'Mars', 'Mercury', 'Saturn', 'Jupiter', 'Rahu', 'Venus',
    ]);
  });

  it('lord years match Satya Acharya: Sun=6, Moon=15, Mars=8, Merc=17, Sat=10, Jup=19, Rahu=12, Ven=21', () => {
    expect(ASHTOTTARI_YEARS.Sun).toBe(6);
    expect(ASHTOTTARI_YEARS.Moon).toBe(15);
    expect(ASHTOTTARI_YEARS.Mars).toBe(8);
    expect(ASHTOTTARI_YEARS.Mercury).toBe(17);
    expect(ASHTOTTARI_YEARS.Saturn).toBe(10);
    expect(ASHTOTTARI_YEARS.Jupiter).toBe(19);
    expect(ASHTOTTARI_YEARS.Rahu).toBe(12);
    expect(ASHTOTTARI_YEARS.Venus).toBe(21);
  });
});

describe('Ashtottari Dasha: starting lord by Moon nakshatra (classical group table)', () => {
  it('Moon at start of Ardra → Sun starting lord with full 6-year balance', () => {
    const moonLon = 5 * NAKSHATRA_SPAN;
    const r = computeAshtottariDasha(SAMPLE, moonLon);
    expect(r.mahaDashas[0]!.lord).toBe('Sun');
    const balanceYears =
      (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime())
      / (365.25 * 24 * 3600 * 1000);
    expect(balanceYears).toBeCloseTo(6, 5);
  });

  it('Moon at start of Magha (end of Sun group) → starts in Moon', () => {
    const moonLon = 9 * NAKSHATRA_SPAN;
    const r = computeAshtottariDasha(SAMPLE, moonLon);
    expect(r.mahaDashas[0]!.lord).toBe('Moon');
  });

  it('Moon at start of Krittika → Venus starting lord (Venus rules Krittika-Mrigashira)', () => {
    const moonLon = 2 * NAKSHATRA_SPAN;
    const r = computeAshtottariDasha(SAMPLE, moonLon);
    expect(r.mahaDashas[0]!.lord).toBe('Venus');
    const balanceYears =
      (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime())
      / (365.25 * 24 * 3600 * 1000);
    expect(balanceYears).toBeCloseTo(21, 5);
  });

  it('Moon at start of Ashwini → Rahu starting lord, half the group elapsed', () => {
    const moonLon = 0;
    const r = computeAshtottariDasha(SAMPLE, moonLon);
    expect(r.mahaDashas[0]!.lord).toBe('Rahu');
    const balanceYears =
      (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime())
      / (365.25 * 24 * 3600 * 1000);
    expect(balanceYears).toBeCloseTo(6, 5);
  });

  it('every nakshatra maps to exactly one lord group', () => {
    for (let nak = 0; nak < 27; nak++) {
      const r = computeAshtottariDasha(SAMPLE, (nak + 0.5) * NAKSHATRA_SPAN);
      expect(r.mahaDashas[0]!.lord).toBeDefined();
    }
  });

  it('cycle progresses through all 8 lords starting from the active one', () => {
    const r = computeAshtottariDasha(SAMPLE, 5 * NAKSHATRA_SPAN);
    const lords = r.mahaDashas.map((m) => m.lord);
    expect(lords).toHaveLength(8);
    expect(lords[0]).toBe('Sun');
    expect(lords[1]).toBe('Moon');
    expect(lords[2]).toBe('Mars');
    expect(lords[7]).toBe('Venus');
  });
});

describe('Ashtottari Dasha: antardashas', () => {
  it('each mahadasha has 8 antardashas', () => {
    const r = computeAshtottariDasha(SAMPLE, 2 * NAKSHATRA_SPAN);
    for (const md of r.mahaDashas) {
      expect(md.antarDashas).toHaveLength(8);
    }
  });

  it('antardashas of a non-partial mahadasha sum to ~mahadasha duration', () => {
    const r = computeAshtottariDasha(SAMPLE, 2 * NAKSHATRA_SPAN);
    const md = r.mahaDashas[1]!;
    const adSum = md.antarDashas.reduce(
      (acc, a) => acc + (a.endDate.getTime() - a.startDate.getTime()),
      0,
    );
    const mdSpan = md.endDate.getTime() - md.startDate.getTime();
    expect(adSum).toBeCloseTo(mdSpan, -3);
  });

  it('antardasha lord cycle starts at the mahadasha lord', () => {
    const r = computeAshtottariDasha(SAMPLE, 2 * NAKSHATRA_SPAN);
    for (const md of r.mahaDashas) {
      expect(md.antarDashas[0]!.lord).toBe(md.lord);
    }
  });
});

/** Restates the rule: the full mahadasha's sub-periods from its pre-birth start, those over by birth dropped. */
function fullSpanFirstMaha(
  names: readonly string[], years: (name: string) => number, total: number,
  mahaName: string, mahaYears: number, birthMs: number, endMs: number,
): { name: string; startMs: number }[] {
  const fullMs = mahaYears * 365.25 * 86_400_000;
  let cursor = endMs - fullMs;
  const at = names.indexOf(mahaName);
  const out: { name: string; startMs: number }[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[(at + i) % names.length]!;
    const start = cursor;
    cursor += (years(name) / total) * fullMs;
    if (cursor > birthMs) out.push({ name, startMs: Math.max(start, birthMs) });
  }
  return out;
}

function expectAntarsTile(md: { startDate: Date; endDate: Date; antarDashas: { startDate: Date; endDate: Date }[] }): void {
  const ads = md.antarDashas;
  expect(ads[0]!.startDate.getTime()).toBe(md.startDate.getTime());
  expect(ads[ads.length - 1]!.endDate.getTime()).toBe(md.endDate.getTime());
  for (let i = 1; i < ads.length; i++) {
    expect(ads[i]!.startDate.getTime()).toBe(ads[i - 1]!.endDate.getTime());
  }
}

describe('Ashtottari and Yogini: the birth mahadasha keeps the full mahadasha\'s antardashas, clipped at birth', () => {
  const moonLon = 355.19020663914483;

  it('Ashtottari 1995-08-15T05:30Z: Rahu mahadasha opens in the Moon antardasha', () => {
    const md = computeAshtottariDasha(SAMPLE, moonLon, SAMPLE).mahaDashas[0]!;
    expect(md.lord).toBe('Rahu');
    expect(md.antarDashas.map((a) => a.lord)).toEqual(['Moon', 'Mars', 'Mercury', 'Saturn', 'Jupiter']);
    expect(md.antarDashas.map((a) => a.startDate.toISOString().slice(0, 10))).toEqual([
      '1995-08-15', '1996-09-13', '1997-08-04', '1999-06-25', '2000-08-03',
    ]);
    expectAntarsTile(md);
  });

  it('Yogini 1995-08-15T05:30Z: Ulka mahadasha opens in the Pingala antardasha', () => {
    const md = computeYoginiDasha(SAMPLE, moonLon, SAMPLE).mahaDashas[0]!;
    expect(md.yogini).toBe('Ulka');
    expect(md.antarDashas.map((a) => a.yogini)).toEqual(['Pingala', 'Dhanya', 'Bhramari', 'Bhadrika']);
    expect(md.antarDashas.map((a) => a.startDate.toISOString().slice(0, 10))).toEqual([
      '1995-08-15', '1995-10-14', '1996-04-13', '1996-12-13',
    ]);
    expectAntarsTile(md);
  });

  it('matches the full-span construction restated from the rule at many Moon longitudes', () => {
    for (let k = 0; k < 60; k++) {
      const lon = (k * 6.1 + 0.37) % 360;
      const ash = computeAshtottariDasha(SAMPLE, lon, SAMPLE).mahaDashas[0]!;
      const wantA = fullSpanFirstMaha(ASHTOTTARI_ORDER, (n) => ASHTOTTARI_YEARS[n]!, 108,
        ash.lord, ash.years, SAMPLE.getTime(), ash.endDate.getTime());
      expect(ash.antarDashas.map((a) => a.lord)).toEqual(wantA.map((w) => w.name));
      ash.antarDashas.forEach((a, i) => {
        expect(Math.abs(a.startDate.getTime() - wantA[i]!.startMs)).toBeLessThanOrEqual(1);
      });

      const yog = computeYoginiDasha(SAMPLE, lon, SAMPLE).mahaDashas[0]!;
      const wantY = fullSpanFirstMaha(YOGINI_ORDER, (n) => YOGINI_YEARS[n as keyof typeof YOGINI_YEARS], 36,
        yog.yogini, yog.years, SAMPLE.getTime(), yog.endDate.getTime());
      expect(yog.antarDashas.map((a) => a.yogini)).toEqual(wantY.map((w) => w.name));
      yog.antarDashas.forEach((a, i) => {
        expect(Math.abs(a.startDate.getTime() - wantY[i]!.startMs)).toBeLessThanOrEqual(1);
      });
    }
  });

  it('every mahadasha\'s antardashas tile it exactly, before and after 1970', () => {
    for (const iso of ['1955-03-10T04:00:00Z', '1969-12-31T23:59:59Z', '1995-08-15T05:30:00Z', '2071-01-01T00:00:00Z']) {
      const birth = new Date(iso);
      for (const lon of [3.3, 57.123, 144.13912296295166, 301.123, 355.19020663914483]) {
        for (const md of computeAshtottariDasha(birth, lon, birth).mahaDashas) expectAntarsTile(md);
        for (const md of computeYoginiDasha(birth, lon, birth).mahaDashas) expectAntarsTile(md);
      }
    }
  });
});

describe('Yogini Dasha: cycle constants', () => {
  it('total years sum to 36', () => {
    let total = 0;
    for (const y of YOGINI_ORDER) {
      total += YOGINI_YEARS[y];
    }
    expect(total).toBe(36);
  });

  it('cycle has 8 Yoginis: Mangala, Pingala, Dhanya, Bhramari, Bhadrika, Ulka, Siddha, Sankata', () => {
    expect(YOGINI_ORDER).toEqual([
      'Mangala', 'Pingala', 'Dhanya', 'Bhramari',
      'Bhadrika', 'Ulka', 'Siddha', 'Sankata',
    ]);
  });

  it('years are 1, 2, 3, 4, 5, 6, 7, 8 in order', () => {
    expect(YOGINI_YEARS.Mangala).toBe(1);
    expect(YOGINI_YEARS.Pingala).toBe(2);
    expect(YOGINI_YEARS.Dhanya).toBe(3);
    expect(YOGINI_YEARS.Bhramari).toBe(4);
    expect(YOGINI_YEARS.Bhadrika).toBe(5);
    expect(YOGINI_YEARS.Ulka).toBe(6);
    expect(YOGINI_YEARS.Siddha).toBe(7);
    expect(YOGINI_YEARS.Sankata).toBe(8);
  });

  it('planetary lords: Mangala=Moon, Pingala=Sun, Dhanya=Jupiter, Bhramari=Mars, Bhadrika=Mercury, Ulka=Saturn, Siddha=Venus, Sankata=Rahu', () => {
    expect(YOGINI_PLANET.Mangala).toBe('Moon');
    expect(YOGINI_PLANET.Pingala).toBe('Sun');
    expect(YOGINI_PLANET.Dhanya).toBe('Jupiter');
    expect(YOGINI_PLANET.Bhramari).toBe('Mars');
    expect(YOGINI_PLANET.Bhadrika).toBe('Mercury');
    expect(YOGINI_PLANET.Ulka).toBe('Saturn');
    expect(YOGINI_PLANET.Siddha).toBe('Venus');
    expect(YOGINI_PLANET.Sankata).toBe('Rahu');
  });
});

describe('Yogini Dasha: starting Yogini by nakshatra (Devi-Bhagavata formula)', () => {
  it('Moon at Ashwini (0) → starts at Bhramari (Mars)', () => {
    const r = computeYoginiDasha(SAMPLE, 0);
    expect(r.mahaDashas[0]!.yogini).toBe('Bhramari');
    expect(r.mahaDashas[0]!.lord).toBe('Mars');
  });

  it('Moon at Bharani (1) → starts at Bhadrika (Mercury)', () => {
    const r = computeYoginiDasha(SAMPLE, 1 * NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.yogini).toBe('Bhadrika');
    expect(r.mahaDashas[0]!.lord).toBe('Mercury');
  });

  it('Moon at Pushya (7) → Dhanya (published worked example)', () => {
    const r = computeYoginiDasha(SAMPLE, 7 * NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.yogini).toBe('Dhanya');
    expect(r.mahaDashas[0]!.lord).toBe('Jupiter');
  });

  it('Moon at Anuradha (16) → Bhramari (published worked example)', () => {
    const r = computeYoginiDasha(SAMPLE, 16 * NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.yogini).toBe('Bhramari');
  });

  it('Moon in Ardra (5), Chitra (13) or Shravana (21) → Mangala (PyJHora star list)', () => {
    for (const nak of [5, 13, 21]) {
      const r = computeYoginiDasha(SAMPLE, nak * NAKSHATRA_SPAN);
      expect(r.mahaDashas[0]!.yogini, `nakshatra ${nak}`).toBe('Mangala');
    }
  });

  it('cycle progresses through all 8 Yoginis', () => {
    const r = computeYoginiDasha(SAMPLE, 0);
    const yoginis = r.mahaDashas.map((m) => m.yogini);
    expect(yoginis).toHaveLength(8);
    expect(new Set(yoginis).size).toBe(8);
  });
});

describe('Yogini Dasha: antardashas', () => {
  it('each mahadasha has 8 antardashas', () => {
    const r = computeYoginiDasha(SAMPLE, 0);
    for (const md of r.mahaDashas) {
      expect(md.antarDashas).toHaveLength(8);
    }
  });

  it('antardashas of a non-partial mahadasha sum to ~mahadasha duration', () => {
    const r = computeYoginiDasha(SAMPLE, 0);
    const md = r.mahaDashas[1]!;
    const adSum = md.antarDashas.reduce(
      (acc, a) => acc + (a.endDate.getTime() - a.startDate.getTime()),
      0,
    );
    const mdSpan = md.endDate.getTime() - md.startDate.getTime();
    expect(adSum).toBeCloseTo(mdSpan, -3);
  });

  it('first antardasha of each mahadasha shares the Yogini', () => {
    const r = computeYoginiDasha(SAMPLE, 0);
    for (const md of r.mahaDashas) {
      expect(md.antarDashas[0]!.yogini).toBe(md.yogini);
    }
  });
});

describe('Chara Dasha: cycle constants', () => {
  it('movable signs (Aries=0, Cancer=3, Libra=6, Capricorn=9) get 9 years', () => {
    expect(CHARA_RASHI_YEARS[0]).toBe(9);
    expect(CHARA_RASHI_YEARS[3]).toBe(9);
    expect(CHARA_RASHI_YEARS[6]).toBe(9);
    expect(CHARA_RASHI_YEARS[9]).toBe(9);
  });

  it('fixed signs (Taurus=1, Leo=4, Scorpio=7, Aquarius=10) get 8 years', () => {
    expect(CHARA_RASHI_YEARS[1]).toBe(8);
    expect(CHARA_RASHI_YEARS[4]).toBe(8);
    expect(CHARA_RASHI_YEARS[7]).toBe(8);
    expect(CHARA_RASHI_YEARS[10]).toBe(8);
  });

  it('dual signs (Gemini=2, Virgo=5, Sagittarius=8, Pisces=11) get 7 years', () => {
    expect(CHARA_RASHI_YEARS[2]).toBe(7);
    expect(CHARA_RASHI_YEARS[5]).toBe(7);
    expect(CHARA_RASHI_YEARS[8]).toBe(7);
    expect(CHARA_RASHI_YEARS[11]).toBe(7);
  });

  it('total years sum to 96', () => {
    const total = CHARA_RASHI_YEARS.reduce((a, b) => a + b, 0);
    expect(total).toBe(96);
  });
});

describe('Chara Dasha: output structure', () => {
  it('returns 12 mahadashas covering ~96 years from birth', () => {
    const r = computeCharaDasha(SAMPLE, DELHI);
    expect(r.mahaDashas).toHaveLength(12);
    const totalMs = r.mahaDashas[11]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime();
    const totalYears = totalMs / (365.25 * 24 * 3600 * 1000);
    expect(totalYears).toBeCloseTo(96, 0);
  });

  it('starts at lagna rashi', () => {
    const r = computeCharaDasha(SAMPLE, DELHI);
    expect(r.mahaDashas[0]!.rashi).toBeGreaterThanOrEqual(0);
    expect(r.mahaDashas[0]!.rashi).toBeLessThan(12);
  });

  it('cycle wraps zodiacally: second rashi is +1 from start', () => {
    const r = computeCharaDasha(SAMPLE, DELHI);
    const r0 = r.mahaDashas[0]!.rashi;
    expect(r.mahaDashas[1]!.rashi).toBe((r0 + 1) % 12);
    expect(r.mahaDashas[11]!.rashi).toBe((r0 + 11) % 12);
  });

  it('lord assignments match classical sign-lordship', () => {
    const r = computeCharaDasha(SAMPLE, DELHI);
    const expectedLords = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
      'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
    for (const md of r.mahaDashas) {
      expect(md.lord).toBe(expectedLords[md.rashi]);
    }
  });

  it('mahadasha years match the rashi-modality scheme', () => {
    const r = computeCharaDasha(SAMPLE, DELHI);
    for (const md of r.mahaDashas) {
      expect(md.years).toBe(CHARA_RASHI_YEARS[md.rashi]);
    }
  });

  it('mahadasha durations are contiguous (no gaps)', () => {
    const r = computeCharaDasha(SAMPLE, DELHI);
    for (let i = 1; i < r.mahaDashas.length; i++) {
      expect(r.mahaDashas[i]!.startDate.getTime())
        .toBe(r.mahaDashas[i - 1]!.endDate.getTime());
    }
  });
});

describe('Chara Dasha: input validation', () => {
  it('throws on invalid latitude', () => {
    expect(() => computeCharaDasha(SAMPLE, { latitude: 91, longitude: 77 })).toThrow();
  });
});
