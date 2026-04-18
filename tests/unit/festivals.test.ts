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

    it('emits Smarta + Vaishnava + generic Ekadashi on a non-viddha Ekadashi-at-sunrise day', () => {
      const r = computeFestivals(ctx({ tithiIndex: 10, chandraMasaIndex: 2 }), resolver);
      expect(r.some(f => f.type === 'vaishnava_ekadashi')).toBe(true);
      expect(r.some(f => f.type === 'smarta_ekadashi')).toBe(true);
      expect(r.some(f => f.type === 'ekadashi')).toBe(true);
    });

    it('on viddha day: Vaishnava today, Smarta deferred to Dwadashi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 10, ekadashiDashamiViddha: true }),
        resolver,
      );
      const smarta = r.find(f => f.type === 'smarta_ekadashi');
      const vaishnava = r.find(f => f.type === 'vaishnava_ekadashi');
      expect(vaishnava).toBeDefined();
      expect(smarta).toBeDefined();
      expect(smarta!.description).toMatch(/deferred/);
    });

    it('emits Smarta Ekadashi on Dwadashi day when yesterday was viddha', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 11, smartaDwadashiToday: true }),
        resolver,
      );
      expect(r.some(f => f.type === 'smarta_ekadashi')).toBe(true);
      expect(r.some(f => f.type === 'vaishnava_ekadashi')).toBe(false);
    });
  });

  describe('Named Ekadashi lookup', () => {
    it('uses Nirjala name for Jyeshtha Shukla Ekadashi', () => {
      const r = computeFestivals(ctx({ tithiIndex: 10, chandraMasaIndex: 2 }), resolver);
      const vaishnava = r.find(f => f.type === 'vaishnava_ekadashi');
      expect(vaishnava?.description).toBe('ekadashi_nirjala');
    });

    it('uses Apara name for Jyeshtha Krishna Ekadashi', () => {
      const r = computeFestivals(ctx({ tithiIndex: 25, chandraMasaIndex: 2 }), resolver);
      const vaishnava = r.find(f => f.type === 'vaishnava_ekadashi');
      expect(vaishnava?.description).toBe('ekadashi_apara');
    });

    it('uses Padmini name for Adhika Shukla Ekadashi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 10, chandraMasaIndex: 7, isAdhika: true }),
        resolver,
      );
      const vaishnava = r.find(f => f.type === 'vaishnava_ekadashi');
      expect(vaishnava?.description).toBe('ekadashi_padmini');
    });

    it('uses Parama name for Adhika Krishna Ekadashi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 25, chandraMasaIndex: 7, isAdhika: true }),
        resolver,
      );
      const vaishnava = r.find(f => f.type === 'vaishnava_ekadashi');
      expect(vaishnava?.description).toBe('ekadashi_parama');
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

    it('attaches weekday variant name as description', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 12, varaIndex: 6, tithiByRule: { pradosha: 12 } }),
        resolver,
      );
      const p = r.find(f => f.type === 'pradosha');
      expect(p?.description).toBe('shani_pradosha');
    });

    it('Guru Pradosha on Thursday (vara 4)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 12, varaIndex: 4, tithiByRule: { pradosha: 12 } }),
        resolver,
      );
      const p = r.find(f => f.type === 'pradosha');
      expect(p?.description).toBe('guru_pradosha');
    });
  });

  describe('Bhadra exclusion (Raksha Bandhan)', () => {
    const bhadraEnd = new Date('2025-08-09T08:08:00.000Z');
    it('attaches "Observe after Bhadra ends at HH:MM" when Bhadra present', () => {
      const r = computeFestivals(
        ctx({
          tithiIndex: 14,
          chandraMasaIndex: 4,
          bhadra: { start: new Date('2025-08-09T01:00:00.000Z'), end: bhadraEnd },
          formatClock: (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
        }),
        resolver,
      );
      const rb = r.find(f => f.name === 'raksha_bandhan');
      expect(rb).toBeDefined();
      expect(rb!.description).toBe('Observe after Bhadra ends at 08:08');
    });

    it('omits exclusion when Bhadra absent', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 14, chandraMasaIndex: 4 }),
        resolver,
      );
      const rb = r.find(f => f.name === 'raksha_bandhan');
      expect(rb?.description).toBeUndefined();
    });
  });

  describe('Long-tithi dedupe', () => {
    it('suppresses today when yesterday already claimed Ganesh Chaturthi', () => {
      // Scenario: today madhyahna-end tithi = 3 (Chaturthi), but madhyahna-start = 4,
      // meaning Chaturthi STARTED today during madhyahna. Yesterday madhyahna = 3 too
      // (yesterday's kala held Chaturthi through) — so yesterday already emitted.
      const r = computeFestivals(
        ctx({
          tithiIndex: 3,
          chandraMasaIndex: 5,
          tithiByRule: { madhyahna: 3 },
          tithiByRuleStart: { madhyahna: 4 },   // today: started during kala
          priorDayTithiByRule: { madhyahna: 3 }, // yesterday: prevailed
        }),
        resolver,
      );
      expect(r.some(f => f.name === 'ganesh_chaturthi')).toBe(false);
    });

    it('emits today when yesterday did NOT hold the target tithi', () => {
      const r = computeFestivals(
        ctx({
          tithiIndex: 3,
          chandraMasaIndex: 5,
          tithiByRule: { madhyahna: 3 },
          tithiByRuleStart: { madhyahna: 3 },   // today: prevailed throughout
          priorDayTithiByRule: { madhyahna: 2 }, // yesterday: different tithi
        }),
        resolver,
      );
      expect(r.some(f => f.name === 'ganesh_chaturthi')).toBe(true);
    });
  });

  describe('Adhika-masa nuance', () => {
    it('Janmashtami (shift-to-nija) is suppressed in Adhika Shravana', () => {
      const r = computeFestivals(
        ctx({
          tithiIndex: 22, chandraMasaIndex: 4, isAdhika: true,
          tithiByRule: { nishita: 22 },
        }),
        resolver,
      );
      expect(r.some(f => f.name === 'krishna_janmashtami')).toBe(false);
    });

    it('Janmashtami fires in Nija Shravana following an Adhika', () => {
      const r = computeFestivals(
        ctx({
          tithiIndex: 22, chandraMasaIndex: 4, isAdhika: false,
          priorMasaWasAdhika: true,
          tithiByRule: { nishita: 22 },
        }),
        resolver,
      );
      expect(r.some(f => f.name === 'krishna_janmashtami')).toBe(true);
    });
  });

  describe('Purnimanta naming awareness', () => {
    it('Diwali gets a Purnimanta description when Purnimanta masa name is supplied', () => {
      const r = computeFestivals(
        ctx({
          tithiIndex: 29,
          chandraMasaIndex: 6,
          tithiByRule: { pradosha: 29 },
          amantaMasaName: 'Ashwin',
          purnimantaMasaName: 'Kartika',
        }),
        resolver,
      );
      const d = r.find(f => f.name === 'diwali');
      expect(d?.description).toBe('Purnimanta: Kartika Krishna Paksha');
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
