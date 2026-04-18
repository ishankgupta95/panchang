import { describe, it, expect } from 'vitest';
import { computeFestivals, type FestivalComputeContext } from '../../src/core/festivals';

const resolver = (key: string) => key;
const rashiResolver = (idx: number) => `Rashi ${idx}`;

/**
 * Build a default festival context; override only what the test cares about.
 * Other fields get inert defaults that won't match any rule.
 */
function ctx(overrides: Partial<FestivalComputeContext> = {}): FestivalComputeContext {
  return {
    tithiIndex: 0,
    nakshatraIndex: 10,
    chandraMasaIndex: 2,   // Jyeshtha — no fixed festivals in registry
    isAdhika: false,
    varaIndex: 3,
    solarMasaIndex: 2,
    ...overrides,
  };
}

describe('computeFestivals', () => {
  describe('major fixed festivals (sunrise default rule)', () => {
    it('detects Ugadi — Chaitra (0), Shukla Pratipad (0)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 0 }), resolver);
      expect(r.some(f => f.name === 'ugadi')).toBe(true);
    });

    it('detects Holi — Phalguna (11), Purnima (14)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 11 }), resolver);
      expect(r.some(f => f.name === 'holi')).toBe(true);
    });

    it('detects Dussehra — Ashwin (6), Shukla Dashami (9)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 9, chandraMasaIndex: 6 }), resolver);
      expect(r.some(f => f.name === 'dussehra')).toBe(true);
    });
  });

  describe('dateRule-qualified festivals', () => {
    it('Akshaya Tritiya fires when madhyahna tithi is Tritiya, even if sunrise tithi is not', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 1, chandraMasaIndex: 1, tithiByRule: { madhyahna: 2 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'akshaya_tritiya')).toBe(true);
    });

    it('Akshaya Tritiya does NOT fire when madhyahna tithi is Chaturthi (sunrise=Tritiya)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 2, chandraMasaIndex: 1, tithiByRule: { madhyahna: 3 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'akshaya_tritiya')).toBe(false);
    });

    it('Janmashtami uses nishita (midnight) tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 21, chandraMasaIndex: 4, tithiByRule: { nishita: 22 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'krishna_janmashtami')).toBe(true);
    });

    it('Diwali uses pradosha (sunset) tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 28, chandraMasaIndex: 6, tithiByRule: { pradosha: 29 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'diwali')).toBe(true);
    });

    it('Maha Shivaratri uses nishita tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 27, chandraMasaIndex: 10, tithiByRule: { nishita: 28 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'maha_shivaratri')).toBe(true);
    });

    it('Karva Chauth uses sunrise tithi (matches published panchang rule)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 18, chandraMasaIndex: 6 }),
        resolver,
      );
      expect(r.some(f => f.name === 'karva_chauth')).toBe(true);
    });

    it('Narak Chaturdashi uses sunrise tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 28, chandraMasaIndex: 6 }),
        resolver,
      );
      expect(r.some(f => f.name === 'narak_chaturdashi')).toBe(true);
    });

    it('Dhanteras uses pradosha tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 26, chandraMasaIndex: 6, tithiByRule: { pradosha: 27 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'dhanteras')).toBe(true);
    });

    it('Raksha Bandhan uses sunrise tithi (published-panchang rule)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 14, chandraMasaIndex: 4 }),
        resolver,
      );
      expect(r.some(f => f.name === 'raksha_bandhan')).toBe(true);
    });

    it('Ganesh Chaturthi uses madhyahna tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 2, chandraMasaIndex: 5, tithiByRule: { madhyahna: 3 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'ganesh_chaturthi')).toBe(true);
    });

    it('Rama Navami uses madhyahna tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 7, chandraMasaIndex: 0, tithiByRule: { madhyahna: 8 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'rama_navami')).toBe(true);
    });

    it('Vasant Panchami uses madhyahna tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 3, chandraMasaIndex: 10, tithiByRule: { madhyahna: 4 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'vasant_panchami')).toBe(true);
    });

    it('dateRule falls back to sunrise tithi when tithiByRule not provided', () => {
      // Diwali requires tithi 29 at pradosha; without tithiByRule we fall back to sunrise tithi
      const r = computeFestivals(ctx({ tithiIndex: 29, chandraMasaIndex: 6 }), resolver);
      expect(r.some(f => f.name === 'diwali')).toBe(true);
    });
  });

  describe('Adhika masa handling', () => {
    it('skips fixed-registry festivals during Adhika month', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 29, chandraMasaIndex: 6, isAdhika: true, tithiByRule: { pradosha: 29 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'diwali')).toBe(false);
    });

    it('still emits Ekadashi during Adhika month', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 10, chandraMasaIndex: 7, isAdhika: true }),
        resolver,
      );
      expect(r.some(f => f.type === 'ekadashi')).toBe(true);
    });

    it('still emits Pradosha Vrata during Adhika month', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 12, isAdhika: true, tithiByRule: { pradosha: 12 } }),
        resolver,
      );
      expect(r.some(f => f.type === 'pradosha')).toBe(true);
    });
  });

  describe('Ekadashi', () => {
    it('emits on Shukla Ekadashi (tithi 10)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 10 }), resolver);
      expect(r.some(f => f.type === 'ekadashi')).toBe(true);
    });

    it('emits on Krishna Ekadashi (tithi 25)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 25 }), resolver);
      expect(r.some(f => f.type === 'ekadashi')).toBe(true);
    });

    it('does not emit on non-Ekadashi tithis', () => {
      const r = computeFestivals(ctx({ tithiIndex: 11 }), resolver);
      expect(r.some(f => f.type === 'ekadashi')).toBe(false);
    });

    it('annotates Dashami-viddha Ekadashi with Smarta/Vaishnava note', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 10, ekadashiDashamiViddha: true }),
        resolver,
      );
      const ekadashi = r.find(f => f.type === 'ekadashi');
      expect(ekadashi?.description).toMatch(/Dashami-viddha/);
    });

    it('emits plain Ekadashi (no description) when not viddha', () => {
      const r = computeFestivals(ctx({ tithiIndex: 10 }), resolver);
      const ekadashi = r.find(f => f.type === 'ekadashi');
      expect(ekadashi).toBeDefined();
      expect(ekadashi!.description).toBeUndefined();
    });
  });

  describe('Pradosha Vrata', () => {
    it('emits on Krishna Trayodashi (tithi 27) at pradosha-kala', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 27, tithiByRule: { pradosha: 27 } }),
        resolver,
      );
      expect(r.some(f => f.type === 'pradosha')).toBe(true);
    });

    it('emits on Shukla Trayodashi (tithi 12) at pradosha-kala — previously missing', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 12, tithiByRule: { pradosha: 12 } }),
        resolver,
      );
      expect(r.some(f => f.type === 'pradosha')).toBe(true);
    });

    it('does not emit on non-Trayodashi tithis', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 11, tithiByRule: { pradosha: 11 } }),
        resolver,
      );
      expect(r.some(f => f.type === 'pradosha')).toBe(false);
    });

    it('uses pradosha-kala tithi, not sunrise — fires on day where Trayodashi prevails at sunset', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 11, tithiByRule: { pradosha: 12 } }),
        resolver,
      );
      expect(r.some(f => f.type === 'pradosha')).toBe(true);
    });
  });

  describe('Sankashti Chaturthi (monthly)', () => {
    it('emits on any Krishna Chaturthi (tithi 18) at moonrise', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 17, tithiByRule: { chandrodaya: 18 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'sankashti_chaturthi')).toBe(true);
    });

    it('does not emit on other tithis', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 18, tithiByRule: { chandrodaya: 19 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'sankashti_chaturthi')).toBe(false);
    });
  });

  describe('Sankranti', () => {
    it('emits when sankrantiRashi is set', () => {
      const r = computeFestivals(
        ctx({ sankrantiRashi: 9 }),
        resolver,
        rashiResolver,
      );
      const sankranti = r.find(f => f.type === 'sankranti');
      expect(sankranti).toBeDefined();
      expect(sankranti!.description).toBe('Rashi 9');
    });

    it('does not emit when sankrantiRashi is null/undefined', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: null }), resolver, rashiResolver);
      expect(r.some(f => f.type === 'sankranti')).toBe(false);
    });
  });

  describe('Nakshatra-based festivals', () => {
    it('Onam — Shravana nakshatra (21) in Simha solar masa (4)', () => {
      const r = computeFestivals(
        ctx({ nakshatraIndex: 21, solarMasaIndex: 4 }),
        resolver,
      );
      expect(r.some(f => f.name === 'onam')).toBe(true);
    });

    it('Onam does not fire with correct nakshatra but wrong solar masa', () => {
      const r = computeFestivals(
        ctx({ nakshatraIndex: 21, solarMasaIndex: 3 }),
        resolver,
      );
      expect(r.some(f => f.name === 'onam')).toBe(false);
    });
  });

  it('uses the name resolver for translated names', () => {
    const r = computeFestivals(
      ctx({ tithiIndex: 29, chandraMasaIndex: 6, tithiByRule: { pradosha: 29 } }),
      (k) => `translated_${k}`,
    );
    expect(r.some(f => f.name === 'translated_diwali')).toBe(true);
  });

  it('returns empty when nothing matches', () => {
    expect(computeFestivals(ctx({ tithiIndex: 1 }), resolver)).toEqual([]);
  });

  it('can emit multiple festivals on the same day', () => {
    // Ashwin Krishna Trayodashi (18→27) chandrodaya=Chaturthi + pradosha=Trayodashi
    // doesn't actually line up — pick a real dual: Dhanteras (tithi 27 Ashwin at pradosha)
    // coexists with Pradosha Vrata (tithi 27 at pradosha).
    const r = computeFestivals(
      ctx({ tithiIndex: 27, chandraMasaIndex: 6, tithiByRule: { pradosha: 27 } }),
      resolver,
    );
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r.some(f => f.name === 'dhanteras')).toBe(true);
    expect(r.some(f => f.type === 'pradosha')).toBe(true);
  });
});
