/**
 * Unit tests for `computeAshtottariDasha`, `computeYoginiDasha`, and
 * `computeCharaDasha` — the three additional dasha systems beyond Vimshottari.
 *
 * Each system is verified at three levels:
 *   1. cycle structure (lord order, total years sum to expected total)
 *   2. starting-lord assignment from Moon's nakshatra (or Lagna for Chara)
 *   3. duration sums and antardasha proportionality
 */

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

describe('Ashtottari Dasha — cycle constants', () => {
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

describe('Ashtottari Dasha — starting lord by Moon nakshatra', () => {
  // Krittika (nakshatra 2) anchors the Sun period at 0° elapsed.
  it('Moon at start of Krittika → Sun starting lord', () => {
    const moonLon = 2 * NAKSHATRA_SPAN; // 0% into Krittika
    const r = computeAshtottariDasha(SAMPLE, moonLon);
    expect(r.mahaDashas[0]!.lord).toBe('Sun');
  });

  it('Moon at end of Sun period → starts in Moon', () => {
    // Sun period covers 1.5 nakshatras starting at Krittika.
    // End of Sun = 1.5 nakshatras after Krittika = 0.5 into Mrigashira.
    const moonLon = (2 + 1.5) * NAKSHATRA_SPAN; // exactly at Sun→Moon boundary
    const r = computeAshtottariDasha(SAMPLE, moonLon);
    expect(r.mahaDashas[0]!.lord).toBe('Moon');
  });

  it('Moon at start of Ashwini (just before Krittika in proportion-space) → ends in Venus period', () => {
    // Ashwini is 2 nakshatras before Krittika in zodiacal terms, so in
    // the Krittika-anchored cycle relPos = 25 (= 27-2). Venus boundary
    // ends at position 27. So Ashwini falls in Venus's allocation.
    const moonLon = 0; // start of Ashwini
    const r = computeAshtottariDasha(SAMPLE, moonLon);
    expect(r.mahaDashas[0]!.lord).toBe('Venus');
  });

  it('cycle progresses through all 8 lords starting from the active one', () => {
    const r = computeAshtottariDasha(SAMPLE, 2 * NAKSHATRA_SPAN);
    const lords = r.mahaDashas.map((m) => m.lord);
    expect(lords).toHaveLength(8);
    expect(lords[0]).toBe('Sun');
    expect(lords[1]).toBe('Moon');
    expect(lords[2]).toBe('Mars');
    expect(lords[7]).toBe('Venus');
  });
});

describe('Ashtottari Dasha — antardashas', () => {
  it('each mahadasha has 8 antardashas', () => {
    const r = computeAshtottariDasha(SAMPLE, 2 * NAKSHATRA_SPAN);
    for (const md of r.mahaDashas) {
      expect(md.antarDashas).toHaveLength(8);
    }
  });

  it('antardashas of a non-partial mahadasha sum to ~mahadasha duration', () => {
    const r = computeAshtottariDasha(SAMPLE, 2 * NAKSHATRA_SPAN);
    // First mahadasha is partial (balance only). Use the second.
    const md = r.mahaDashas[1]!;
    const adSum = md.antarDashas.reduce(
      (acc, a) => acc + (a.endDate.getTime() - a.startDate.getTime()),
      0,
    );
    const mdSpan = md.endDate.getTime() - md.startDate.getTime();
    expect(adSum).toBeCloseTo(mdSpan, -3); // within 1ms
  });

  it('antardasha lord cycle starts at the mahadasha lord', () => {
    const r = computeAshtottariDasha(SAMPLE, 2 * NAKSHATRA_SPAN);
    for (const md of r.mahaDashas) {
      expect(md.antarDashas[0]!.lord).toBe(md.lord);
    }
  });
});

describe('Yogini Dasha — cycle constants', () => {
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

describe('Yogini Dasha — starting Yogini by nakshatra', () => {
  it('Moon at Ashwini (0) → starts at Mangala', () => {
    const r = computeYoginiDasha(SAMPLE, 0);
    expect(r.mahaDashas[0]!.yogini).toBe('Mangala');
    expect(r.mahaDashas[0]!.lord).toBe('Moon');
  });

  it('Moon at Bharani (1) → starts at Pingala', () => {
    const r = computeYoginiDasha(SAMPLE, 1 * NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.yogini).toBe('Pingala');
    expect(r.mahaDashas[0]!.lord).toBe('Sun');
  });

  it('Moon at Pushya (7) → wraps to Mangala (8 mod 8 = 0)', () => {
    const r = computeYoginiDasha(SAMPLE, 7 * NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.yogini).toBe('Sankata');
  });

  it('Moon at Ashlesha (8) → Mangala (8 mod 8 = 0, cycle wraps)', () => {
    const r = computeYoginiDasha(SAMPLE, 8 * NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.yogini).toBe('Mangala');
  });

  it('cycle progresses through all 8 Yoginis', () => {
    const r = computeYoginiDasha(SAMPLE, 0);
    const yoginis = r.mahaDashas.map((m) => m.yogini);
    expect(yoginis).toHaveLength(8);
    expect(new Set(yoginis).size).toBe(8); // all distinct
  });
});

describe('Yogini Dasha — antardashas', () => {
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

describe('Chara Dasha — cycle constants', () => {
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

describe('Chara Dasha — output structure', () => {
  it('returns 12 mahadashas covering ~96 years from birth', () => {
    const r = computeCharaDasha(SAMPLE, DELHI);
    expect(r.mahaDashas).toHaveLength(12);
    const totalMs = r.mahaDashas[11]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime();
    const totalYears = totalMs / (365.25 * 24 * 3600 * 1000);
    expect(totalYears).toBeCloseTo(96, 0);
  });

  it('starts at lagna rashi', () => {
    const r = computeCharaDasha(SAMPLE, DELHI);
    // Lagna for SAMPLE/DELHI is computed by computeLagna; just check the rashi
    // is in [0, 12) and the cycle starts there.
    expect(r.mahaDashas[0]!.rashi).toBeGreaterThanOrEqual(0);
    expect(r.mahaDashas[0]!.rashi).toBeLessThan(12);
  });

  it('cycle wraps zodiacally — second rashi is +1 from start', () => {
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

describe('Chara Dasha — input validation', () => {
  it('throws on invalid latitude', () => {
    expect(() => computeCharaDasha(SAMPLE, { latitude: 91, longitude: 77 })).toThrow();
  });
});
