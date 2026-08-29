import { describe, it, expect } from 'vitest';
import { computeDignity } from '../../src/jyotish/dignity';
import type { GrahaName } from '../../src/types/jyotish';

describe('computeDignity: exaltation rashis (BPHS Ch. 3)', () => {
  const exalt: Array<[GrahaName, number]> = [
    ['Sun', 0],     // Aries
    ['Moon', 1],    // Taurus
    ['Mars', 9],    // Capricorn
    ['Mercury', 5], // Virgo
    ['Jupiter', 3], // Cancer
    ['Venus', 11],  // Pisces
    ['Saturn', 6],  // Libra
  ];
  for (const [graha, rashi] of exalt) {
    it(`${graha} exalted in rashi ${rashi}`, () => {
      expect(computeDignity(graha, rashi)).toBe('exalted');
    });
  }
});

describe('computeDignity: debilitation rashis (opposite of exaltation)', () => {
  const debil: Array<[GrahaName, number]> = [
    ['Sun', 6], ['Moon', 7], ['Mars', 3], ['Mercury', 11],
    ['Jupiter', 9], ['Venus', 5], ['Saturn', 0],
  ];
  for (const [graha, rashi] of debil) {
    it(`${graha} debilitated in rashi ${rashi}`, () => {
      expect(computeDignity(graha, rashi)).toBe('debilitated');
    });
  }
});

describe('computeDignity: moolatrikona', () => {
  it('Sun in Leo (4) → moolatrikona', () => {
    expect(computeDignity('Sun', 4)).toBe('moolatrikona');
  });
  it('Mars in Aries (0) → moolatrikona (overrides own status for Aries)', () => {
    expect(computeDignity('Mars', 0)).toBe('moolatrikona');
  });
  it('Saturn in Aquarius (10) → moolatrikona', () => {
    expect(computeDignity('Saturn', 10)).toBe('moolatrikona');
  });
});

describe('computeDignity: own (swakshetra)', () => {
  it('Mars in Scorpio (7) → own (Aries is moolatrikona)', () => {
    expect(computeDignity('Mars', 7)).toBe('own');
  });
  it('Mercury in Gemini (2) → own (Virgo is moolatrikona)', () => {
    expect(computeDignity('Mercury', 2)).toBe('own');
  });
  it('Jupiter in Pisces (11) → own', () => {
    expect(computeDignity('Jupiter', 11)).toBe('own');
  });
  it('Venus in Taurus (1) → own (Libra is moolatrikona)', () => {
    expect(computeDignity('Venus', 1)).toBe('own');
  });
});

describe('computeDignity: friend / neutral / enemy via Naisargika Maitri', () => {
  it('Sun in Cancer (Moon\'s rashi, Sun-Moon are friends) → friend', () => {
    expect(computeDignity('Sun', 3)).toBe('friend');
  });
  it('Saturn in Cancer (Moon\'s rashi, Saturn-Moon enemies) → enemy', () => {
    expect(computeDignity('Saturn', 3)).toBe('enemy');
  });
  it('Mercury in Sagittarius (Jupiter\'s rashi, Mercury-Jupiter neutral) → neutral', () => {
    expect(computeDignity('Mercury', 8)).toBe('neutral');
  });
});

describe('computeDignity: Rahu / Ketu', () => {
  it('Rahu exalted in Taurus', () => {
    expect(computeDignity('Rahu', 1)).toBe('exalted');
  });
  it('Ketu exalted in Scorpio', () => {
    expect(computeDignity('Ketu', 7)).toBe('exalted');
  });
  it('Rahu debilitated in Scorpio', () => {
    expect(computeDignity('Rahu', 7)).toBe('debilitated');
  });
  it('Ketu debilitated in Taurus', () => {
    expect(computeDignity('Ketu', 1)).toBe('debilitated');
  });
});

describe('computeDignity: input validation', () => {
  it('throws on out-of-range rashi', () => {
    expect(() => computeDignity('Sun', 12)).toThrow(RangeError);
    expect(() => computeDignity('Sun', -1)).toThrow(RangeError);
    expect(() => computeDignity('Sun', 1.5)).toThrow(RangeError);
  });
});
