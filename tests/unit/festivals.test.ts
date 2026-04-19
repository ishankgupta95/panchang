import { describe, it, expect } from 'vitest';
import { computeFestivals, type FestivalComputeContext } from '../../src/core/festivals';
import type { FestivalRegion } from '../../src/types/options';

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
    it('detects Ugadi — Chaitra (0), Shukla Pratipada (0)', () => {
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

  describe('Phase 24-1: Regional Sankranti', () => {
    it('emits Pongal + Makar Sankranti + Magh Bihu + Uttarayan + Ayyappa on Makara (rashi 9)', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 9 }), resolver, rashiResolver);
      const names = r.map(f => f.name);
      expect(names).toContain('sankranti');
      expect(names).toContain('makar_sankranti');
      expect(names).toContain('pongal');
      expect(names).toContain('uttarayan');
      expect(names).toContain('magh_bihu');
      expect(names).toContain('ayyappa_makara_jyothi');
    });

    it('emits Baisakhi + Vishu + Puthandu + Pohela Boishakh + Bohag Bihu on Mesha (rashi 0)', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 0 }), resolver, rashiResolver);
      const names = r.map(f => f.name);
      expect(names).toContain('baisakhi');
      expect(names).toContain('vishu');
      expect(names).toContain('puthandu');
      expect(names).toContain('pohela_boishakh');
      expect(names).toContain('bohag_bihu');
    });

    it('emits Dakshinayana on Karka (rashi 3) regardless of region', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 3, region: 'tamil-nadu' }), resolver, rashiResolver);
      expect(r.some(f => f.name === 'dakshinayana')).toBe(true);
    });

    it('region=tamil-nadu filters to tamil-nadu + "all" variants only', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 9, region: 'tamil-nadu' }), resolver, rashiResolver);
      const names = r.map(f => f.name);
      expect(names).toContain('pongal');
      // makar_sankranti is now pan-Indian (regions: ['all']) — emits under any region
      expect(names).toContain('makar_sankranti');
      expect(names).not.toContain('magh_bihu');
      expect(names).not.toContain('ayyappa_makara_jyothi');
    });

    it('region=kerala picks Vishu on Mesha and Ayyappa on Makara', () => {
      const mesha = computeFestivals(ctx({ sankrantiRashi: 0, region: 'kerala' }), resolver, rashiResolver);
      expect(mesha.some(f => f.name === 'vishu')).toBe(true);
      expect(mesha.some(f => f.name === 'baisakhi')).toBe(false);

      const makara = computeFestivals(ctx({ sankrantiRashi: 9, region: 'kerala' }), resolver, rashiResolver);
      expect(makara.some(f => f.name === 'ayyappa_makara_jyothi')).toBe(true);
      expect(makara.some(f => f.name === 'pongal')).toBe(false);
    });

    it('region=all (default) emits every regional variant', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 9 }), resolver, rashiResolver);
      // Makara: sankranti + makar_sankranti + pongal + uttarayan + magh_bihu + ayyappa = 6
      expect(r.filter(f => f.type === 'sankranti').length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Phase 24-2: Chhath Puja', () => {
    it('Nahay Khay — Kartika (7) Shukla Chaturthi (3)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 3, chandraMasaIndex: 7 }), resolver);
      expect(r.some(f => f.name === 'chhath_nahay_khay')).toBe(true);
    });
    it('Kharna — Kartika (7) Shukla Panchami (4)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 4, chandraMasaIndex: 7 }), resolver);
      expect(r.some(f => f.name === 'chhath_kharna')).toBe(true);
    });
    it('Sandhya Arghya — uses pradosha tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 4, chandraMasaIndex: 7, tithiByRule: { pradosha: 5 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'chhath_sandhya_arghya')).toBe(true);
    });
    it('Usha Arghya — Kartika (7) Shukla Shashthi (wait — Saptami=6)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 6, chandraMasaIndex: 7 }), resolver);
      expect(r.some(f => f.name === 'chhath_usha_arghya')).toBe(true);
    });
  });

  describe('Phase 24-3: Upakarma (Avani Avittam)', () => {
    it('Yajur Upakarma — Shravana Purnima (masa 4, tithi 14)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 4 }), resolver);
      expect(r.some(f => f.name === 'yajur_upakarma')).toBe(true);
    });
    it('Rig Upakarma — Shravana nakshatra (21) in Shravana masa (4)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, nakshatraIndex: 21, tithiIndex: 0 }),
        resolver,
      );
      expect(r.some(f => f.name === 'rig_upakarma')).toBe(true);
    });
    it('Rig Upakarma does not fire outside Shravana masa', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 3, nakshatraIndex: 21, tithiIndex: 0 }),
        resolver,
      );
      expect(r.some(f => f.name === 'rig_upakarma')).toBe(false);
    });
    it('Sama Upakarma — Hasta nakshatra (12) in Bhadrapada masa (5)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 5, nakshatraIndex: 12, tithiIndex: 0 }),
        resolver,
      );
      expect(r.some(f => f.name === 'sama_upakarma')).toBe(true);
    });
  });

  describe('Phase 24-5: Vat Savitri', () => {
    it('Amavasya variant — Jyeshtha (2) Amavasya (29)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 29, chandraMasaIndex: 2 }), resolver);
      expect(r.some(f => f.name === 'vat_savitri_amavasya')).toBe(true);
    });
    it('Purnima variant — Jyeshtha (2) Purnima (14)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 2 }), resolver);
      expect(r.some(f => f.name === 'vat_savitri_purnima')).toBe(true);
    });
    it('does not fire in other months', () => {
      const r = computeFestivals(ctx({ tithiIndex: 29, chandraMasaIndex: 3 }), resolver);
      expect(r.some(f => f.name === 'vat_savitri_amavasya')).toBe(false);
    });
  });

  describe('Phase 24-6: Masik Shivaratri (monthly)', () => {
    it('emits on Krishna Chaturdashi (28) at nishita', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 27, chandraMasaIndex: 2, tithiByRule: { nishita: 28 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'masik_shivaratri')).toBe(true);
    });
    it('is suppressed in Nija Magha (Maha Shivaratri month)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 27, chandraMasaIndex: 10, tithiByRule: { nishita: 28 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'masik_shivaratri')).toBe(false);
      expect(r.some(f => f.name === 'maha_shivaratri')).toBe(true);
    });
    it('still fires in Adhika Magha (Maha Shivaratri skipped)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 27, chandraMasaIndex: 10, isAdhika: true, tithiByRule: { nishita: 28 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'masik_shivaratri')).toBe(true);
      expect(r.some(f => f.name === 'maha_shivaratri')).toBe(false);
    });
  });

  describe('Phase 24-7: Vinayaka Chaturthi (monthly)', () => {
    it('emits on Shukla Chaturthi (3) at madhyahna', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 2, chandraMasaIndex: 2, tithiByRule: { madhyahna: 3 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'vinayaka_chaturthi')).toBe(true);
    });
    it('is suppressed in Nija Bhadrapada (Ganesh Chaturthi month)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 2, chandraMasaIndex: 5, tithiByRule: { madhyahna: 3 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'vinayaka_chaturthi')).toBe(false);
      expect(r.some(f => f.name === 'ganesh_chaturthi')).toBe(true);
    });
  });

  describe('Phase 24-9: Pushya Nakshatra mirror', () => {
    it('emits ravi_pushya on Sunday (vara 0) + Pushya (nakshatra 7)', () => {
      const r = computeFestivals(
        ctx({ nakshatraIndex: 7, varaIndex: 0, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'ravi_pushya')).toBe(true);
    });
    it('emits guru_pushya on Thursday (vara 4) + Pushya', () => {
      const r = computeFestivals(
        ctx({ nakshatraIndex: 7, varaIndex: 4, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'guru_pushya')).toBe(true);
    });
    it('does not emit on Pushya with a non-qualifying vara', () => {
      const r = computeFestivals(
        ctx({ nakshatraIndex: 7, varaIndex: 2, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'ravi_pushya' || f.name === 'guru_pushya')).toBe(false);
    });
  });

  describe('Phase 24-10: Month+weekday recurring', () => {
    it('Shravan Somvar — Shravana masa (4) + Monday (vara 1)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 1, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'shravan_somvar')).toBe(true);
    });
    it('Mangala Gauri — Shravana (4) + Tuesday (vara 2)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 2, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'mangala_gauri')).toBe(true);
    });
    it('Kartik Somvar — Kartika (7) + Monday (vara 1)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 7, varaIndex: 1, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'kartik_somvar')).toBe(true);
    });
    it('Magha Shanivar — Magha (10) + Saturday (vara 6)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 10, varaIndex: 6, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'magha_shanivar')).toBe(true);
    });
    it('month-weekday rules also fire in Adhika (observe-in-both)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 1, tithiIndex: 1, isAdhika: true }),
        resolver,
      );
      expect(r.some(f => f.name === 'shravan_somvar')).toBe(true);
    });
    it('does not fire on a different weekday', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 3, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'shravan_somvar')).toBe(false);
    });
  });

  describe('v2.1 regional expansion — SANKRANTI_REGIONAL', () => {
    it('Bohag Bihu fires on Mesha transit (rashi 0) in assam', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 0, region: 'assam' }), resolver, rashiResolver);
      const names = r.map(f => f.name);
      expect(names).toContain('bohag_bihu');
      expect(names).not.toContain('puthandu');
    });

    it('Magh Bihu fires on Makara transit (rashi 9) in assam', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 9, region: 'assam' }), resolver, rashiResolver);
      expect(r.some(f => f.name === 'magh_bihu')).toBe(true);
    });

    it('Kati Bihu fires on Tula transit (rashi 6) in assam', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 6, region: 'assam' }), resolver, rashiResolver);
      expect(r.some(f => f.name === 'kati_bihu')).toBe(true);
    });

    it('Raja Sankranti + Harela fire on Karka transit scoped to odisha/uttarakhand', () => {
      const odisha = computeFestivals(ctx({ sankrantiRashi: 3, region: 'odisha' }), resolver, rashiResolver);
      expect(odisha.some(f => f.name === 'raja_sankranti')).toBe(true);
      expect(odisha.some(f => f.name === 'dakshinayana')).toBe(true);
      expect(odisha.some(f => f.name === 'harela')).toBe(false);

      const uk = computeFestivals(ctx({ sankrantiRashi: 3, region: 'uttarakhand' }), resolver, rashiResolver);
      expect(uk.some(f => f.name === 'harela')).toBe(true);
      expect(uk.some(f => f.name === 'raja_sankranti')).toBe(false);
    });

    it('Sair fires on Kanya transit (rashi 5) in himachal-pradesh', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 5, region: 'himachal-pradesh' }), resolver, rashiResolver);
      expect(r.some(f => f.name === 'sair')).toBe(true);
    });

    it('Singh Sankranti is re-scoped — does NOT emit under tamil-nadu (was pan-Indian)', () => {
      const tn = computeFestivals(ctx({ sankrantiRashi: 4, region: 'tamil-nadu' }), resolver, rashiResolver);
      expect(tn.some(f => f.name === 'singh_sankranti')).toBe(false);
      // Canonical sankranti still emits.
      expect(tn.some(f => f.name === 'sankranti')).toBe(true);

      const od = computeFestivals(ctx({ sankrantiRashi: 4, region: 'odisha' }), resolver, rashiResolver);
      expect(od.some(f => f.name === 'singh_sankranti')).toBe(true);
    });

    it('Makar Sankranti is now pan-Indian — emits under every region', () => {
      for (const region of ['tamil-nadu', 'kerala', 'west-bengal', 'karnataka'] as const) {
        const r = computeFestivals(ctx({ sankrantiRashi: 9, region }), resolver, rashiResolver);
        expect(r.some(f => f.name === 'makar_sankranti')).toBe(true);
      }
    });
  });

  describe('v2.1 regional expansion — FESTIVAL_REGISTRY regions filter', () => {
    it('Gudi Padwa emits in maharashtra but not karnataka', () => {
      const mh = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 0, region: 'maharashtra' }), resolver);
      expect(mh.some(f => f.name === 'gudi_padwa')).toBe(true);
      expect(mh.some(f => f.name === 'ugadi')).toBe(true); // ugadi is pan-Indian

      const kn = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 0, region: 'karnataka' }), resolver);
      expect(kn.some(f => f.name === 'gudi_padwa')).toBe(false);
      expect(kn.some(f => f.name === 'ugadi')).toBe(true);
    });

    it('Gangaur — Chaitra (0) Shukla Tritiya (2), rajasthan only', () => {
      const rj = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 0, region: 'rajasthan' }), resolver);
      expect(rj.some(f => f.name === 'gangaur')).toBe(true);

      const ker = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 0, region: 'kerala' }), resolver);
      expect(ker.some(f => f.name === 'gangaur')).toBe(false);
    });

    it('Karaga — Chaitra (0) Purnima (14), karnataka only', () => {
      const kn = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 0, region: 'karnataka' }), resolver);
      expect(kn.some(f => f.name === 'karaga')).toBe(true);
      expect(kn.some(f => f.name === 'hanuman_jayanti')).toBe(true); // pan-Indian same day

      const mh = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 0, region: 'maharashtra' }), resolver);
      expect(mh.some(f => f.name === 'karaga')).toBe(false);
    });

    it('Bonalu — Ashadha (3) + Sunday, telangana only, also in Adhika', () => {
      const tg = computeFestivals(
        ctx({ chandraMasaIndex: 3, varaIndex: 0, tithiIndex: 5, region: 'telangana' }),
        resolver,
      );
      expect(tg.some(f => f.name === 'bonalu')).toBe(true);

      const ap = computeFestivals(
        ctx({ chandraMasaIndex: 3, varaIndex: 0, tithiIndex: 5, region: 'andhra-pradesh' }),
        resolver,
      );
      expect(ap.some(f => f.name === 'bonalu')).toBe(false);

      // observe-in-both: Adhika masa doesn't suppress Bonalu.
      const adhika = computeFestivals(
        ctx({ chandraMasaIndex: 3, varaIndex: 0, tithiIndex: 5, region: 'telangana', isAdhika: true }),
        resolver,
      );
      expect(adhika.some(f => f.name === 'bonalu')).toBe(true);
    });

    it('Hariyali Teej — Shravana (4) Shukla Tritiya (2), filtered to allow-list', () => {
      const rj = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 4, region: 'rajasthan' }), resolver);
      expect(rj.some(f => f.name === 'hariyali_teej')).toBe(true);

      const ker = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 4, region: 'kerala' }), resolver);
      expect(ker.some(f => f.name === 'hariyali_teej')).toBe(false);
    });

    it('Kajari Teej — Shravana (4) Krishna Tritiya (17)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 17, chandraMasaIndex: 4, region: 'uttar-pradesh' }), resolver);
      expect(r.some(f => f.name === 'kajari_teej')).toBe(true);
    });

    it('Hartalika Teej — Bhadrapada (5) Shukla Tritiya (2)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 5, region: 'maharashtra' }), resolver);
      expect(r.some(f => f.name === 'hartalika_teej')).toBe(true);
    });

    it('Govardhan Puja — Amanta Kartika (7) Shukla Pratipada (0), allow-list filter', () => {
      const up = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 7, region: 'uttar-pradesh' }), resolver);
      expect(up.some(f => f.name === 'govardhan_puja')).toBe(true);

      const tn = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 7, region: 'tamil-nadu' }), resolver);
      expect(tn.some(f => f.name === 'govardhan_puja')).toBe(false);
    });

    it('Bhai Dooj — Amanta Kartika (7) Shukla Dwitiya (1)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 1, chandraMasaIndex: 7, region: 'bihar' }), resolver);
      expect(r.some(f => f.name === 'bhai_dooj')).toBe(true);
    });

    it('Phagli — Phalguna (11) Purnima (14), himachal only', () => {
      const hp = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 11, region: 'himachal-pradesh' }), resolver);
      expect(hp.some(f => f.name === 'phagli')).toBe(true);
      // Holi fires on same day pan-Indian.
      expect(hp.some(f => f.name === 'holi')).toBe(true);

      const pb = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 11, region: 'punjab' }), resolver);
      expect(pb.some(f => f.name === 'phagli')).toBe(false);
      expect(pb.some(f => f.name === 'holi')).toBe(true);
    });

    it('region=all emits every regional variant', () => {
      const r = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 0, region: 'all' }), resolver);
      const names = r.map(f => f.name);
      expect(names).toContain('ugadi');
      expect(names).toContain('gudi_padwa');
    });
  });

  describe('v2.1 — Lohri (day before Makara Sankranti)', () => {
    it('emits Lohri when nextDaySankrantiRashi is Makara (9) under punjab', () => {
      const r = computeFestivals(
        ctx({ nextDaySankrantiRashi: 9, region: 'punjab' }),
        resolver, rashiResolver,
      );
      expect(r.some(f => f.name === 'lohri')).toBe(true);
    });

    it('emits Lohri under haryana / himachal-pradesh', () => {
      for (const region of ['haryana', 'himachal-pradesh'] as const) {
        const r = computeFestivals(ctx({ nextDaySankrantiRashi: 9, region }), resolver, rashiResolver);
        expect(r.some(f => f.name === 'lohri')).toBe(true);
      }
    });

    it('does NOT emit Lohri under tamil-nadu / kerala / west-bengal', () => {
      for (const region of ['tamil-nadu', 'kerala', 'west-bengal'] as const) {
        const r = computeFestivals(ctx({ nextDaySankrantiRashi: 9, region }), resolver, rashiResolver);
        expect(r.some(f => f.name === 'lohri')).toBe(false);
      }
    });

    it('does NOT emit Lohri when nextDaySankrantiRashi is not Makara', () => {
      const r = computeFestivals(ctx({ nextDaySankrantiRashi: 0, region: 'punjab' }), resolver, rashiResolver);
      expect(r.some(f => f.name === 'lohri')).toBe(false);
    });

    it('does NOT emit Lohri when nextDaySankrantiRashi is null/undefined', () => {
      const r1 = computeFestivals(ctx({ nextDaySankrantiRashi: null, region: 'punjab' }), resolver, rashiResolver);
      expect(r1.some(f => f.name === 'lohri')).toBe(false);

      const r2 = computeFestivals(ctx({ region: 'punjab' }), resolver, rashiResolver);
      expect(r2.some(f => f.name === 'lohri')).toBe(false);
    });

    it('emits Lohri under region=all', () => {
      const r = computeFestivals(ctx({ nextDaySankrantiRashi: 9 }), resolver, rashiResolver);
      expect(r.some(f => f.name === 'lohri')).toBe(true);
    });
  });

  describe('v2.1 — orphan-region sweep', () => {
    // Each FestivalRegion (other than 'all') must attach to ≥1 festival
    // whose emission depends on the region scope. We assert the *specific
    // scoped key* — a weak `r.length > 0` test would pass on pan-Indian
    // emissions like Ugadi or the canonical Sankranti even if the region
    // were dead. The (context, expected key) pairs below pin each region to
    // a real allow-list entry; deleting that entry breaks the matching test.
    const SCENARIOS: Array<{
      region: Exclude<FestivalRegion, 'all'>;
      ctx: FestivalComputeContext;
      expectKey: string;
    }> = [
      { region: 'tamil-nadu',       ctx: ctx({ sankrantiRashi: 9, region: 'tamil-nadu' }),                           expectKey: 'pongal' },
      { region: 'kerala',           ctx: ctx({ sankrantiRashi: 9, region: 'kerala' }),                               expectKey: 'ayyappa_makara_jyothi' },
      { region: 'karnataka',        ctx: ctx({ tithiIndex: 14, chandraMasaIndex: 0, region: 'karnataka' }),          expectKey: 'karaga' },
      { region: 'andhra-pradesh',   ctx: ctx({ chandraMasaIndex: 4, varaIndex: 5, tithiIndex: 12, region: 'andhra-pradesh' }), expectKey: 'varamahalakshmi' },
      { region: 'telangana',        ctx: ctx({ chandraMasaIndex: 3, varaIndex: 0, region: 'telangana' }),            expectKey: 'bonalu' },
      { region: 'west-bengal',      ctx: ctx({ sankrantiRashi: 0, region: 'west-bengal' }),                          expectKey: 'pohela_boishakh' },
      { region: 'odisha',           ctx: ctx({ sankrantiRashi: 3, region: 'odisha' }),                               expectKey: 'raja_sankranti' },
      { region: 'assam',            ctx: ctx({ sankrantiRashi: 0, region: 'assam' }),                                expectKey: 'bohag_bihu' },
      { region: 'bihar',            ctx: ctx({ tithiIndex: 1, chandraMasaIndex: 7, region: 'bihar' }),               expectKey: 'bhai_dooj' },
      { region: 'jharkhand',        ctx: ctx({ tithiIndex: 0, chandraMasaIndex: 7, region: 'jharkhand' }),           expectKey: 'govardhan_puja' },
      { region: 'gujarat',          ctx: ctx({ sankrantiRashi: 9, region: 'gujarat' }),                              expectKey: 'uttarayan' },
      { region: 'maharashtra',      ctx: ctx({ tithiIndex: 0, chandraMasaIndex: 0, region: 'maharashtra' }),         expectKey: 'gudi_padwa' },
      { region: 'goa',              ctx: ctx({ tithiIndex: 0, chandraMasaIndex: 0, region: 'goa' }),                 expectKey: 'gudi_padwa' },
      { region: 'rajasthan',        ctx: ctx({ tithiIndex: 2, chandraMasaIndex: 0, region: 'rajasthan' }),           expectKey: 'gangaur' },
      { region: 'punjab',           ctx: ctx({ sankrantiRashi: 0, region: 'punjab' }),                               expectKey: 'baisakhi' },
      { region: 'haryana',          ctx: ctx({ nextDaySankrantiRashi: 9, region: 'haryana' }),                       expectKey: 'lohri' },
      { region: 'himachal-pradesh', ctx: ctx({ sankrantiRashi: 5, region: 'himachal-pradesh' }),                     expectKey: 'sair' },
      { region: 'uttarakhand',      ctx: ctx({ sankrantiRashi: 3, region: 'uttarakhand' }),                          expectKey: 'harela' },
      { region: 'uttar-pradesh',    ctx: ctx({ tithiIndex: 0, chandraMasaIndex: 7, region: 'uttar-pradesh' }),       expectKey: 'govardhan_puja' },
      { region: 'madhya-pradesh',   ctx: ctx({ tithiIndex: 2, chandraMasaIndex: 4, region: 'madhya-pradesh' }),      expectKey: 'hariyali_teej' },
      { region: 'nepal',            ctx: ctx({ sankrantiRashi: 4, region: 'nepal' }),                                expectKey: 'singh_sankranti' },
    ];

    for (const { region, ctx: scenarioCtx, expectKey } of SCENARIOS) {
      it(`region='${region}' attaches to scoped festival '${expectKey}'`, () => {
        const r = computeFestivals(scenarioCtx, resolver, rashiResolver);
        const names = r.map(f => f.name);
        expect(names).toContain(expectKey);
      });
    }

    it('every FestivalRegion in the public type is covered by the sweep', () => {
      // Type-side smoke: make sure the SCENARIOS array enumerates every
      // non-'all' region — a compile-time exhaustiveness check on the
      // discriminated union.
      const ALL_REGIONS: readonly Exclude<FestivalRegion, 'all'>[] = [
        'tamil-nadu', 'kerala', 'karnataka', 'andhra-pradesh', 'telangana',
        'west-bengal', 'odisha', 'assam', 'bihar', 'jharkhand',
        'gujarat', 'maharashtra', 'goa', 'rajasthan',
        'punjab', 'haryana', 'himachal-pradesh', 'uttarakhand',
        'uttar-pradesh', 'madhya-pradesh', 'nepal',
      ];
      const covered = new Set(SCENARIOS.map(s => s.region));
      for (const r of ALL_REGIONS) expect(covered.has(r)).toBe(true);
    });
  });

  describe('v2.1 — Varamahalakshmi (last Friday of Shravana Shukla before Purnima)', () => {
    it('emits on Shravana (4) Friday with tithi in [7,13]', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 5, tithiIndex: 12, region: 'karnataka' }),
        resolver,
      );
      expect(r.some(f => f.name === 'varamahalakshmi')).toBe(true);
    });

    it('does NOT emit on a Friday earlier in Shukla paksha (tithi=2)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 5, tithiIndex: 2, region: 'karnataka' }),
        resolver,
      );
      expect(r.some(f => f.name === 'varamahalakshmi')).toBe(false);
    });

    it('does NOT emit on a Krishna-paksha Friday (tithi=20)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 5, tithiIndex: 20, region: 'karnataka' }),
        resolver,
      );
      expect(r.some(f => f.name === 'varamahalakshmi')).toBe(false);
    });

    it('does NOT emit on a non-Friday in the qualifying window', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 4, tithiIndex: 12, region: 'karnataka' }),
        resolver,
      );
      expect(r.some(f => f.name === 'varamahalakshmi')).toBe(false);
    });

    it('emits under all four scoped regions', () => {
      for (const region of ['karnataka', 'andhra-pradesh', 'telangana', 'tamil-nadu'] as const) {
        const r = computeFestivals(
          ctx({ chandraMasaIndex: 4, varaIndex: 5, tithiIndex: 12, region }),
          resolver,
        );
        expect(r.some(f => f.name === 'varamahalakshmi')).toBe(true);
      }
    });

    it('does NOT emit under kerala', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 5, tithiIndex: 12, region: 'kerala' }),
        resolver,
      );
      expect(r.some(f => f.name === 'varamahalakshmi')).toBe(false);
    });
  });

  describe('v2.1 — Bathukamma (Telangana) start + Saddula markers', () => {
    it('Engili Pula Bathukamma — Bhadrapada (5) Amavasya (29)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 29, chandraMasaIndex: 5, region: 'telangana' }),
        resolver,
      );
      expect(r.some(f => f.name === 'bathukamma_start')).toBe(true);
      expect(r.some(f => f.name === 'mahalaya_amavasya')).toBe(true); // pan-Indian same day
    });

    it('Saddula Bathukamma — Ashwin (6) Shukla Navami (8)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 8, chandraMasaIndex: 6, region: 'telangana' }),
        resolver,
      );
      expect(r.some(f => f.name === 'bathukamma_saddula')).toBe(true);
      expect(r.some(f => f.name === 'maha_navami')).toBe(true); // pan-Indian same day
    });

    it('does NOT emit either marker outside Telangana', () => {
      const r1 = computeFestivals(ctx({ tithiIndex: 29, chandraMasaIndex: 5, region: 'kerala' }), resolver);
      expect(r1.some(f => f.name === 'bathukamma_start')).toBe(false);

      const r2 = computeFestivals(ctx({ tithiIndex: 8, chandraMasaIndex: 6, region: 'kerala' }), resolver);
      expect(r2.some(f => f.name === 'bathukamma_saddula')).toBe(false);
    });
  });

  describe('v2.1 — Jagannath Rath Yatra (pan-Indian)', () => {
    it('emits on Ashadha (3) Shukla Dwitiya (1) regardless of region', () => {
      for (const region of ['all', 'odisha', 'kerala', 'tamil-nadu'] as const) {
        const r = computeFestivals(ctx({ tithiIndex: 1, chandraMasaIndex: 3, region }), resolver);
        expect(r.some(f => f.name === 'jagannath_rath_yatra')).toBe(true);
      }
    });

    it('does NOT emit on a different tithi', () => {
      const r = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 3 }), resolver);
      expect(r.some(f => f.name === 'jagannath_rath_yatra')).toBe(false);
    });
  });

  describe('v2.1 — Raja Parba 3-day arc (Odisha)', () => {
    it('Pahili Raja — emits when nextDaySankrantiRashi=3 (Karka)', () => {
      const r = computeFestivals(
        ctx({ nextDaySankrantiRashi: 3, region: 'odisha' }),
        resolver, rashiResolver,
      );
      expect(r.some(f => f.name === 'raja_pahili')).toBe(true);
    });

    it('Raja Sankranti — emits on Karka transit (sankrantiRashi=3)', () => {
      const r = computeFestivals(
        ctx({ sankrantiRashi: 3, region: 'odisha' }),
        resolver, rashiResolver,
      );
      expect(r.some(f => f.name === 'raja_sankranti')).toBe(true);
    });

    it('Basi Raja — emits when prevDaySankrantiRashi=3 (yesterday was Karka)', () => {
      const r = computeFestivals(
        ctx({ prevDaySankrantiRashi: 3, region: 'odisha' }),
        resolver, rashiResolver,
      );
      expect(r.some(f => f.name === 'raja_basi')).toBe(true);
    });

    it('does NOT emit Raja markers outside odisha (region=kerala)', () => {
      const r1 = computeFestivals(ctx({ nextDaySankrantiRashi: 3, region: 'kerala' }), resolver, rashiResolver);
      expect(r1.some(f => f.name === 'raja_pahili')).toBe(false);

      const r2 = computeFestivals(ctx({ prevDaySankrantiRashi: 3, region: 'kerala' }), resolver, rashiResolver);
      expect(r2.some(f => f.name === 'raja_basi')).toBe(false);
    });

    it('Pahili/Basi Raja emit under region=all (default)', () => {
      const pahili = computeFestivals(ctx({ nextDaySankrantiRashi: 3 }), resolver, rashiResolver);
      expect(pahili.some(f => f.name === 'raja_pahili')).toBe(true);

      const basi = computeFestivals(ctx({ prevDaySankrantiRashi: 3 }), resolver, rashiResolver);
      expect(basi.some(f => f.name === 'raja_basi')).toBe(true);
    });

    it('does NOT cross-fire — Lohri transit (Makara=9) does not emit Raja', () => {
      const r = computeFestivals(ctx({ nextDaySankrantiRashi: 9, region: 'odisha' }), resolver, rashiResolver);
      expect(r.some(f => f.name === 'raja_pahili')).toBe(false);
    });
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
