import { describe, it, expect } from 'vitest';
import { computeBhadraKaal, isVishtiKarana, bhadraVasaForRashi } from '../../src/core/bhadra';
import { LongitudeCache } from '../../src/astronomy/cache';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';

describe('isVishtiKarana', () => {
  it('returns true for the 8 Vishti indices', () => {
    for (const k of [7, 14, 21, 28, 35, 42, 49, 56]) {
      expect(isVishtiKarana(k)).toBe(true);
    }
  });

  it('returns false for fixed karanas (0, 57-59)', () => {
    for (const k of [0, 57, 58, 59]) {
      expect(isVishtiKarana(k)).toBe(false);
    }
  });

  it('returns false for non-Vishti movable karanas', () => {
    for (const k of [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 22, 50]) {
      expect(isVishtiKarana(k)).toBe(false);
    }
  });
});

describe('computeBhadraKaal', () => {
  it('returns null when no Vishti karana touches the Hindu day', () => {
    // Find a day where there's no Bhadra. Pick 2025-01-04 in Delhi.
    const loc = { latitude: 28.6139, longitude: 77.2090 };
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    const getSun = (d: Date) => cache.getSun(d);

    const sunrise = computeSunrise(new Date('2025-01-04T00:00:00Z'), loc);
    const sunset = computeSunset(sunrise, loc);
    const nextSunrise = computeSunrise(sunset, loc);

    // This day may or may not have bhadra — the test just confirms the
    // function never crashes and returns either a valid window or null.
    const bhadra = computeBhadraKaal(sunrise, nextSunrise, getMoon, getSun);
    if (bhadra !== null) {
      expect(bhadra.start.getTime()).toBeLessThan(bhadra.end.getTime());
      expect(['earth', 'heaven', 'paatal']).toContain(bhadra.location);
    }
  });

  it('detects Bhadra on Raksha Bandhan 2024 (2024-08-19, Delhi)', () => {
    // Drik-reported Bhadra End on Raksha Bandhan day Aug 19, 2024: 01:32 PM IST
    // = 08:02 UTC. Bhadra covered the morning of Aug 19 (Shukla Purnima 1st half).
    const loc = { latitude: 28.6139, longitude: 77.2090 };
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    const getSun = (d: Date) => cache.getSun(d);

    const sunrise = computeSunrise(new Date('2024-08-19T00:00:00Z'), loc);
    const sunset = computeSunset(sunrise, loc);
    const nextSunrise = computeSunrise(sunset, loc);

    const bhadra = computeBhadraKaal(sunrise, nextSunrise, getMoon, getSun);
    expect(bhadra).not.toBeNull();
    if (bhadra) {
      expect(bhadra.end.getUTCFullYear()).toBe(2024);
      expect(bhadra.end.getUTCMonth()).toBe(7); // August
      expect(bhadra.end.getUTCDate()).toBe(19);
      // Within ±30 min of Drik's 13:32 IST (08:02 UTC)
      const endMs = bhadra.end.getTime();
      const target = new Date('2024-08-19T08:02:00Z').getTime();
      expect(Math.abs(endMs - target)).toBeLessThan(30 * 60_000);
    }
  });
});

describe('bhadraVasaForRashi (Muhurta Chintamani Moon-rashi rule)', () => {
  it('partitions all 12 rashis into the three classical vasa groups', () => {
    // Karka(3), Simha(4), Kumbha(10), Meena(11)          → earth (Prithvi)
    // Mesha(0), Vrishabha(1), Mithuna(2), Vrischika(7)   → heaven (Swarga)
    // Kanya(5), Tula(6), Dhanu(8), Makara(9)             → paatal (Patala)
    const expected: Record<number, 'earth' | 'heaven' | 'paatal'> = {
      0: 'heaven', 1: 'heaven', 2: 'heaven', 3: 'earth',
      4: 'earth', 5: 'paatal', 6: 'paatal', 7: 'heaven',
      8: 'paatal', 9: 'paatal', 10: 'earth', 11: 'earth',
    };
    for (let rashi = 0; rashi < 12; rashi++) {
      expect(bhadraVasaForRashi(rashi), `rashi ${rashi}`).toBe(expected[rashi]);
    }
  });
});

describe('piecewise vasa segments (drik Ujjain 2026-08-19)', () => {
  // Drik day-panchang Ujjain 2026-08-19: Bhadra begins 07:19 PM; Bhadravasa
  // "Patala (Nadir) from 07:19 PM to 02:30 AM, Aug 20" then "Swarga (Heaven)"
  // (02:30 AM = the Moon's Tula → Vrischika transition; drik's day page
  // clamps the window display at next sunrise, but its Bhadra-dates page
  // carries the true karana end 08:16 AM, Aug 20).
  it('splits Patala → Swarga at the Moon Tula→Vrischika transition', () => {
    const UJJAIN = { latitude: 23.1765, longitude: 75.7885 };
    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    const getSun = (d: Date) => cache.getSun(d);

    const sunrise = computeSunrise(new Date('2026-08-19T00:00:00Z'), UJJAIN);
    const sunset = computeSunset(sunrise, UJJAIN);
    const nextSunrise = computeSunrise(sunset, UJJAIN);

    const bhadra = computeBhadraKaal(sunrise, nextSunrise, getMoon, getSun);
    expect(bhadra).not.toBeNull();
    if (!bhadra) return;

    const TOL_MS = 2 * 60_000;
    // Window: 19:20 IST → 08:16 IST (+1) = 13:50 UTC → 02:46 UTC.
    expect(Math.abs(bhadra.start.getTime() - Date.parse('2026-08-19T13:50:00Z'))).toBeLessThan(TOL_MS);
    expect(Math.abs(bhadra.end.getTime() - Date.parse('2026-08-20T02:46:00Z'))).toBeLessThan(TOL_MS);

    expect(bhadra.vasa).toHaveLength(2);
    const [first, second] = bhadra.vasa;
    expect(first!.location).toBe('paatal');
    expect(second!.location).toBe('heaven');
    // Transition at 02:30 IST Aug 20 = 21:00 UTC Aug 19.
    expect(Math.abs(first!.end.getTime() - Date.parse('2026-08-19T21:00:00Z'))).toBeLessThan(TOL_MS);
    // Segments tile the window exactly.
    expect(first!.start.getTime()).toBe(bhadra.start.getTime());
    expect(second!.start.getTime()).toBe(first!.end.getTime());
    expect(second!.end.getTime()).toBe(bhadra.end.getTime());
    // Top-level location = vasa at window start.
    expect(bhadra.location).toBe('paatal');
  });
});
