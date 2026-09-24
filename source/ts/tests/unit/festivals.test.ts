import { describe, it, expect } from 'vitest';
import {
  computeFestivals, type DayGeometry, type FestivalComputeContext, type KalaDay,
} from '../../src/core/festivals';
import type { FestivalRegion } from '../../src/types/options';

const resolver = (key: string) => key;
const rashiResolver = (idx: number) => `Rashi ${idx}`;

const DESCRIPTION_TEMPLATES_EN: Record<string, string> = {
  desc_purnimanta_krishna_paksha: 'Purnimanta: {masa} Krishna Paksha',
  desc_bhadra_observe_after: 'Observe after Bhadra ends at {time}',
  desc_ekadashi_viddha_vaishnava_next:
    'Dashami-viddha: Smarta fast observed today; Vaishnava fast next day (Dwadashi).',
  desc_ekadashi_viddha_vaishnava_today:
    'Dashami-viddha Ekadashi: Vaishnava fast observed today (Dwadashi).',
  desc_ekadashi_vriddha_dwadashi_next:
    'Vriddha Dwadashi: Smarta fast observed today; Vaishnava fast next day (Dwadashi).',
  desc_ekadashi_vriddha_dwadashi_vaishnava:
    'Vriddha Dwadashi: Vaishnava fast observed today; the Smarta fast was yesterday.',
};
const enDescResolver = (key: string): string =>
  DESCRIPTION_TEMPLATES_EN[key] ?? key;

/** Defaults are inert: they match no rule. */
function ctx(overrides: Partial<FestivalComputeContext> = {}): FestivalComputeContext {
  return {
    tithiIndex: 0,
    nakshatraIndex: 10,
    chandraMasaIndex: 2,   // Jyeshtha: no fixed festivals in registry
    isAdhika: false,
    varaIndex: 3,
    solarMasaIndex: 2,
    ...overrides,
  };
}

describe('computeFestivals', () => {
  describe('major fixed festivals (sunrise default rule)', () => {
    it('detects Ugadi: Chaitra (0), Shukla Pratipada (0)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 0 }), resolver);
      expect(r.some(f => f.name === 'ugadi')).toBe(true);
    });

    it('detects Holi: Phalguna (11), Purnima (14)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 11 }), resolver);
      expect(r.some(f => f.name === 'holi')).toBe(true);
    });

    it('detects Dussehra: Ashwin (6), Shukla Dashami (9)', () => {
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
        enDescResolver,
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

    it('on viddha day: Smarta today, Vaishnava deferred to Dwadashi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 10, ekadashiDashamiViddha: true }),
        enDescResolver,
      );
      expect(r.some(f => f.type === 'smarta_ekadashi')).toBe(true);
      expect(r.some(f => f.type === 'vaishnava_ekadashi')).toBe(false);
      expect(r.find(f => f.type === 'ekadashi')!.description).toMatch(/Vaishnava fast next day/);
    });

    it('emits Vaishnava Ekadashi on Dwadashi day when yesterday was viddha', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 11, vaishnavaDwadashiToday: true }),
        resolver,
      );
      expect(r.some(f => f.type === 'vaishnava_ekadashi')).toBe(true);
      expect(r.some(f => f.type === 'smarta_ekadashi')).toBe(false);
    });

    it('emits nothing on the first day of a plain vriddha Ekadashi', () => {
      const r = computeFestivals(ctx({ tithiIndex: 10, ekadashiVriddhaFirstDay: true }), resolver);
      expect(r.filter(f => f.type.endsWith('ekadashi'))).toEqual([]);
    });

    it('emits Smarta + generic, not Vaishnava, on vriddha day 1 when Dwadashi touches no sunrise', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 25, ekadashiVriddhaFirstDay: true, ekadashiVriddhaTrisprisha: true }),
        resolver,
      );
      expect(r.filter(f => f.type.endsWith('ekadashi')).map(f => f.type))
        .toEqual(['smarta_ekadashi', 'ekadashi']);
      expect(r.find(f => f.type === 'smarta_ekadashi')?.description).toBe('ekadashi_apara');
    });

    it('emits Vaishnava Ekadashi on the first day of a vriddha Dwadashi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 11, ekadashiVriddhaDwadashiToday: true }),
        resolver,
      );
      expect(r.some(f => f.type === 'vaishnava_ekadashi')).toBe(true);
      expect(r.some(f => f.type === 'smarta_ekadashi')).toBe(false);
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

    it('emits on Shukla Trayodashi (tithi 12) at pradosha-kala', () => {
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

    it('uses pradosha-kala tithi, not sunrise: fires on day where Trayodashi prevails at sunset', () => {
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
        enDescResolver,
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
      const r = computeFestivals(
        ctx({
          tithiIndex: 3,
          chandraMasaIndex: 5,
          tithiByRule: { madhyahna: 3 },
          tithiByRuleStart: { madhyahna: 4 },
          priorDayTithiByRule: { madhyahna: 3 },
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
          tithiByRuleStart: { madhyahna: 3 },
          priorDayTithiByRule: { madhyahna: 2 },
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

    it('Janmashtami fires in Nija Shravana', () => {
      const r = computeFestivals(
        ctx({
          tithiIndex: 22, chandraMasaIndex: 4, isAdhika: false,
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
        enDescResolver,
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
        ctx({ tithiIndex: 19, tithiByRule: { chandrodaya: 19 } }),
        resolver,
      );
      expect(r.some(f => f.name === 'sankashti_chaturthi')).toBe(false);
    });

    it('falls back to sunrise when Chaturthi touches no moonrise, as Karva Chauth does', () => {
      const r = computeFestivals(
        ctx({
          tithiIndex: 18, chandraMasaIndex: 6,
          tithiByRule: { chandrodaya: 19 }, priorDayTithiByRule: { chandrodaya: 17 },
        }),
        resolver,
      );
      expect(r.some(f => f.name === 'sankashti_chaturthi')).toBe(true);
      expect(r.some(f => f.name === 'karva_chauth')).toBe(true);
    });

    it('the fallback yields when yesterday\'s moonrise already had Chaturthi', () => {
      const r = computeFestivals(
        ctx({
          tithiIndex: 18, tithiByRule: { chandrodaya: 19 }, priorDayTithiByRule: { chandrodaya: 18 },
        }),
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
    it('Onam: Shravana nakshatra (21) in Simha solar masa (4)', () => {
      const r = computeFestivals(
        ctx({ nakshatraIndex: 21, solarMasaIndex: 4 }),
        resolver,
      );
      expect(r.some(f => f.name === 'onam')).toBe(true);
    });

    it('Onam is keyed on the solar month, so an adhika lunar month does not suppress it', () => {
      const r = computeFestivals(
        ctx({ nakshatraIndex: 21, solarMasaIndex: 4, isAdhika: true }),
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

    const onam = (o: Partial<FestivalComputeContext>): boolean =>
      computeFestivals(ctx({ solarMasaIndex: 4, nextDayNakshatraIndex: 22, ...o }), resolver)
        .some(f => f.key === 'onam');

    it('Onam: the second of two Chingam sunrises in Thiruvonam yields to the first', () => {
      expect(onam({ nakshatraIndex: 21, priorDayNakshatraIndex: 21, priorDaySolarMasaIndex: 4 })).toBe(false);
      expect(onam({ nakshatraIndex: 21, priorDayNakshatraIndex: 20, priorDaySolarMasaIndex: 4 })).toBe(true);
    });

    it('Onam: a Thiruvonam whose first sunrise fell in Karkidakam takes its first Chingam sunrise', () => {
      expect(onam({ nakshatraIndex: 21, priorDayNakshatraIndex: 21, priorDaySolarMasaIndex: 3 })).toBe(true);
    });

    it('Onam: a Thiruvonam touching no sunrise belongs to the day holding it', () => {
      expect(onam({ nakshatraIndex: 20, nextDayNakshatraIndex: 22 })).toBe(true);
      expect(onam({ nakshatraIndex: 20, nextDayNakshatraIndex: 21 })).toBe(false);
    });

    it('Onam: the earlier of two Chingam Thiruvonams yields to the later', () => {
      const asked: number[] = [];
      const later = (n: number): boolean => { asked.push(n); return true; };
      expect(onam({ nakshatraIndex: 21, nakshatraLaterInSolarMonth: later })).toBe(false);
      expect(asked).toEqual([21]);
      expect(onam({ nakshatraIndex: 21, nakshatraLaterInSolarMonth: () => false })).toBe(true);
    });
  });

  describe('Masik Karthigai and Karthigai Deepam', () => {
    const keys = (o: Partial<FestivalComputeContext>): string[] =>
      computeFestivals(ctx(o), resolver).map(f => f.key)
        .filter(k => k === 'masik_karthigai' || k === 'karthigai_deepam');

    it('the day flag decides, not Krittika at sunrise', () => {
      expect(keys({ nakshatraIndex: 2, masikKarthigaiToday: false })).toEqual([]);
      expect(keys({ nakshatraIndex: 1, masikKarthigaiToday: true })).toEqual(['masik_karthigai']);
    });

    it('without the flag (the instant view), Krittika at sunrise', () => {
      expect(keys({ nakshatraIndex: 2 })).toEqual(['masik_karthigai']);
    });

    it('Karthigai Deepam replaces that day\'s Masik Karthigai where it is observed', () => {
      const deepam = { masikKarthigaiToday: true, karthigaiDeepamToday: () => true };
      expect(keys(deepam)).toEqual(['karthigai_deepam']);
      expect(keys({ ...deepam, region: 'tamil-nadu' })).toEqual(['karthigai_deepam']);
      expect(keys({ ...deepam, region: 'maharashtra' })).toEqual(['masik_karthigai']);
      expect(keys({ masikKarthigaiToday: true, karthigaiDeepamToday: () => false })).toEqual(['masik_karthigai']);
    });

    it('Karthigai Deepam is only asked on a Masik Karthigai day', () => {
      let asked = false;
      keys({ masikKarthigaiToday: false, karthigaiDeepamToday: () => { asked = true; return true; } });
      expect(asked).toBe(false);
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

    it('emits Puthandu + Bohag Bihu on the Mesha transit day (rashi 0)', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 0 }), resolver, rashiResolver);
      const names = r.map(f => f.name);
      expect(names).toContain('puthandu');
      expect(names).toContain('bohag_bihu');
      expect(names).not.toContain('baisakhi');
      expect(names).not.toContain('vishu');
      expect(names).not.toContain('pohela_boishakh');
    });

    it('emits Baisakhi / Vishu / Pohela Boishakh from their own day flags', () => {
      const names = (c: Partial<FestivalComputeContext>) =>
        computeFestivals(ctx(c), resolver, rashiResolver).map(f => f.name);
      expect(names({ vaisakhiToday: true })).toContain('baisakhi');
      expect(names({ vishuToday: true })).toContain('vishu');
      expect(names({ pohelaBoishakhToday: true })).toContain('pohela_boishakh');
    });

    it('emits Dakshinayana on Karka (rashi 3) regardless of region', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 3, region: 'tamil-nadu' }), resolver, rashiResolver);
      expect(r.some(f => f.name === 'dakshinayana')).toBe(true);
    });

    it('region=tamil-nadu filters to tamil-nadu + "all" variants only', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 9, region: 'tamil-nadu' }), resolver, rashiResolver);
      const names = r.map(f => f.name);
      expect(names).toContain('pongal');
      expect(names).toContain('makar_sankranti');
      expect(names).not.toContain('magh_bihu');
      expect(names).not.toContain('ayyappa_makara_jyothi');
    });

    it('region=kerala picks Vishu on Mesha and Ayyappa on Makara', () => {
      const mesha = computeFestivals(ctx({ vishuToday: true, region: 'kerala' }), resolver, rashiResolver);
      expect(mesha.some(f => f.name === 'vishu')).toBe(true);
      expect(mesha.some(f => f.name === 'baisakhi')).toBe(false);

      const makara = computeFestivals(ctx({ sankrantiRashi: 9, region: 'kerala' }), resolver, rashiResolver);
      expect(makara.some(f => f.name === 'ayyappa_makara_jyothi')).toBe(true);
      expect(makara.some(f => f.name === 'pongal')).toBe(false);
    });

    it('region=all (default) emits every regional variant', () => {
      const r = computeFestivals(ctx({ sankrantiRashi: 9 }), resolver, rashiResolver);
      expect(r.filter(f => f.type === 'sankranti').length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Phase 24-2: Chhath Puja', () => {
    it('Nahay Khay: Kartika (7) Shukla Chaturthi (3)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 3, chandraMasaIndex: 7 }), resolver);
      expect(r.some(f => f.name === 'chhath_nahay_khay')).toBe(true);
    });
    it('Kharna: Kartika (7) Shukla Panchami (4)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 4, chandraMasaIndex: 7 }), resolver);
      expect(r.some(f => f.name === 'chhath_kharna')).toBe(true);
    });
    it('Sandhya Arghya: the Shashthi (5) udaya day, not a Shashthi pradosha', () => {
      const udaya = computeFestivals(ctx({ tithiIndex: 5, chandraMasaIndex: 7 }), resolver);
      expect(udaya.some(f => f.name === 'chhath_sandhya_arghya')).toBe(true);
      const pradosha = computeFestivals(
        ctx({ tithiIndex: 4, chandraMasaIndex: 7, tithiByRule: { pradosha: 5 } }),
        resolver,
      );
      expect(pradosha.some(f => f.name === 'chhath_sandhya_arghya')).toBe(false);
    });
    it('Usha Arghya: Kartika (7) Shukla Shashthi (wait, Saptami=6)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 6, chandraMasaIndex: 7 }), resolver);
      expect(r.some(f => f.name === 'chhath_usha_arghya')).toBe(true);
    });
  });

  describe('Phase 24-3: Upakarma (Avani Avittam)', () => {
    it('Yajur Upakarma: Shravana Purnima (masa 4, tithi 14)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 4 }), resolver);
      expect(r.some(f => f.name === 'yajur_upakarma')).toBe(true);
    });
    it('Rig Upakarma: Shravana nakshatra (21) in Shravana masa (4)', () => {
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
    it('Rig Upakarma does not fire on the second sunrise of a vriddha Shravana', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, nakshatraIndex: 21, tithiIndex: 0, priorDayNakshatraIndex: 21 }),
        resolver,
      );
      expect(r.some(f => f.name === 'rig_upakarma')).toBe(false);
    });
    it('Rig Upakarma does not fire in Krishna paksha', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, nakshatraIndex: 21, tithiIndex: 15 }),
        resolver,
      );
      expect(r.some(f => f.name === 'rig_upakarma')).toBe(false);
    });
    it('Rig Upakarma falls back to Hasta only when Shravana is absent from the paksha', () => {
      const shravanaStillToCome = computeFestivals(
        ctx({
          chandraMasaIndex: 4, nakshatraIndex: 12, tithiIndex: 4,
          remainingPakshaSunriseNakshatras: () => new Set([12, 21]),
        }),
        resolver,
      );
      expect(shravanaStillToCome.some(f => f.name === 'rig_upakarma')).toBe(false);

      const shravanaAbsent = computeFestivals(
        ctx({
          chandraMasaIndex: 4, nakshatraIndex: 12, tithiIndex: 4,
          remainingPakshaSunriseNakshatras: () => new Set([12]),
        }),
        resolver,
      );
      expect(shravanaAbsent.some(f => f.name === 'rig_upakarma')).toBe(true);
    });
    it('Sama Upakarma: Hasta (12) pervading aparahna in Bhadrapada Shukla', () => {
      const r = computeFestivals(
        ctx({
          chandraMasaIndex: 5, nakshatraIndex: 26, tithiIndex: 1,
          nakshatraByRule: { aparahna: 12 },
        }),
        resolver,
      );
      expect(r.some(f => f.name === 'sama_upakarma')).toBe(true);
    });
    it('Sama Upakarma ignores a Hasta that only holds the sunrise', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 5, nakshatraIndex: 12, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'sama_upakarma')).toBe(false);
    });
    it('Sama Upakarma yields to the next day when Hasta reaches aparahna twice', () => {
      const r = computeFestivals(
        ctx({
          chandraMasaIndex: 5, nakshatraIndex: 26, tithiIndex: 1,
          nakshatraByRule: { aparahna: 12 },
          nextDayNakshatraByRule: () => ({ start: {}, end: { aparahna: 12 } }),
        }),
        resolver,
      );
      expect(r.some(f => f.name === 'sama_upakarma')).toBe(false);
    });
    it('Sama Upakarma does not fire in Krishna paksha', () => {
      const r = computeFestivals(
        ctx({
          chandraMasaIndex: 5, nakshatraIndex: 26, tithiIndex: 16,
          nakshatraByRule: { aparahna: 12 },
        }),
        resolver,
      );
      expect(r.some(f => f.name === 'sama_upakarma')).toBe(false);
    });
  });

  describe('Phase 24-5: Vat Savitri', () => {
    it('Amavasya variant: amanta Vaishakha (1) Amavasya (29)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 29, chandraMasaIndex: 1 }), resolver);
      expect(r.some(f => f.name === 'vat_savitri_amavasya')).toBe(true);
    });
    it('Purnima variant: amanta Jyeshtha (2) Purnima (14)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 2 }), resolver);
      expect(r.some(f => f.name === 'vat_savitri_purnima')).toBe(true);
    });
    it('does not fire in other months', () => {
      const r = computeFestivals(ctx({ tithiIndex: 29, chandraMasaIndex: 3 }), resolver);
      expect(r.some(f => f.name === 'vat_savitri_amavasya')).toBe(false);
    });
    it('does not fire on the amavasya that ends amanta Jyeshtha (2)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 29, chandraMasaIndex: 2 }), resolver);
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
    it('Shravan Somvar: Shravana masa (4) + Monday (vara 1)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 1, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'shravan_somvar')).toBe(true);
    });
    it('Mangala Gauri: Shravana (4) + Tuesday (vara 2)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 4, varaIndex: 2, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'mangala_gauri')).toBe(true);
    });
    it('Kartik Somvar: Kartika (7) + Monday (vara 1)', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 7, varaIndex: 1, tithiIndex: 1 }),
        resolver,
      );
      expect(r.some(f => f.name === 'kartik_somvar')).toBe(true);
    });
    it('Magha Shanivar: Magha (10) + Saturday (vara 6)', () => {
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
    it('the month comes from varaMasaIndex (the caller\'s masaSystem) when given', () => {
      const monday = (chandraMasaIndex: number, varaMasaIndex: number) =>
        computeFestivals(ctx({ chandraMasaIndex, varaMasaIndex, varaIndex: 1, tithiIndex: 20 }), resolver)
          .some(f => f.key === 'shravan_somvar');
      expect(monday(3, 4)).toBe(true);    // Amanta Ashadha Krishna = Purnimanta Shravana
      expect(monday(4, 5)).toBe(false);   // Amanta Shravana Krishna = Purnimanta Bhadrapada
    });
    it('Bonalu and Varamahalakshmi keep the Amanta month', () => {
      const r = computeFestivals(
        ctx({ chandraMasaIndex: 3, varaMasaIndex: 4, varaIndex: 0, tithiIndex: 20 }),
        resolver,
      );
      expect(r.some(f => f.key === 'bonalu')).toBe(true);
      const vm = computeFestivals(
        ctx({ chandraMasaIndex: 3, varaMasaIndex: 4, varaIndex: 5, tithiIndex: 10 }),
        resolver,
      );
      expect(vm.some(f => f.key === 'varamahalakshmi')).toBe(false);
    });
  });

  describe('v2.1 regional expansion: SANKRANTI_REGIONAL', () => {
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

    it('Singh Sankranti is region-scoped: does NOT emit under tamil-nadu', () => {
      const tn = computeFestivals(ctx({ sankrantiRashi: 4, region: 'tamil-nadu' }), resolver, rashiResolver);
      expect(tn.some(f => f.name === 'singh_sankranti')).toBe(false);
      expect(tn.some(f => f.name === 'sankranti')).toBe(true);

      const od = computeFestivals(ctx({ sankrantiRashi: 4, region: 'odisha' }), resolver, rashiResolver);
      expect(od.some(f => f.name === 'singh_sankranti')).toBe(true);
    });

    it('Makar Sankranti is pan-Indian: emits under every region', () => {
      for (const region of ['tamil-nadu', 'kerala', 'west-bengal', 'karnataka'] as const) {
        const r = computeFestivals(ctx({ sankrantiRashi: 9, region }), resolver, rashiResolver);
        expect(r.some(f => f.name === 'makar_sankranti')).toBe(true);
      }
    });
  });

  describe('v2.1 regional expansion: FESTIVAL_REGISTRY regions filter', () => {
    it('Gudi Padwa emits in maharashtra but not karnataka', () => {
      const mh = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 0, region: 'maharashtra' }), resolver);
      expect(mh.some(f => f.name === 'gudi_padwa')).toBe(true);
      expect(mh.some(f => f.name === 'ugadi')).toBe(true);

      const kn = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 0, region: 'karnataka' }), resolver);
      expect(kn.some(f => f.name === 'gudi_padwa')).toBe(false);
      expect(kn.some(f => f.name === 'ugadi')).toBe(true);
    });

    it('Gangaur: Chaitra (0) Shukla Tritiya (2), rajasthan only', () => {
      const rj = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 0, region: 'rajasthan' }), resolver);
      expect(rj.some(f => f.name === 'gangaur')).toBe(true);

      const ker = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 0, region: 'kerala' }), resolver);
      expect(ker.some(f => f.name === 'gangaur')).toBe(false);
    });

    it('Karaga: Chaitra (0) Purnima (14), karnataka only', () => {
      const kn = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 0, region: 'karnataka' }), resolver);
      expect(kn.some(f => f.name === 'karaga')).toBe(true);
      expect(kn.some(f => f.name === 'hanuman_jayanti')).toBe(true);

      const mh = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 0, region: 'maharashtra' }), resolver);
      expect(mh.some(f => f.name === 'karaga')).toBe(false);
    });

    it('Bonalu: Ashadha (3) + Sunday, telangana only, also in Adhika', () => {
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

      const adhika = computeFestivals(
        ctx({ chandraMasaIndex: 3, varaIndex: 0, tithiIndex: 5, region: 'telangana', isAdhika: true }),
        resolver,
      );
      expect(adhika.some(f => f.name === 'bonalu')).toBe(true);
    });

    it('Hariyali Teej: Shravana (4) Shukla Tritiya (2), filtered to allow-list', () => {
      const rj = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 4, region: 'rajasthan' }), resolver);
      expect(rj.some(f => f.name === 'hariyali_teej')).toBe(true);

      const ker = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 4, region: 'kerala' }), resolver);
      expect(ker.some(f => f.name === 'hariyali_teej')).toBe(false);
    });

    it('Kajari Teej: Shravana (4) Krishna Tritiya (17)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 17, chandraMasaIndex: 4, region: 'uttar-pradesh' }), resolver);
      expect(r.some(f => f.name === 'kajari_teej')).toBe(true);
    });

    it('Hartalika Teej: Bhadrapada (5) Shukla Tritiya (2)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 2, chandraMasaIndex: 5, region: 'maharashtra' }), resolver);
      expect(r.some(f => f.name === 'hartalika_teej')).toBe(true);
    });

    it('Govardhan Puja: Amanta Kartika (7) Shukla Pratipada (0), allow-list filter', () => {
      const up = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 7, region: 'uttar-pradesh' }), resolver);
      expect(up.some(f => f.name === 'govardhan_puja')).toBe(true);

      const tn = computeFestivals(ctx({ tithiIndex: 0, chandraMasaIndex: 7, region: 'tamil-nadu' }), resolver);
      expect(tn.some(f => f.name === 'govardhan_puja')).toBe(false);
    });

    it('Bhai Dooj: Amanta Kartika (7) Shukla Dwitiya (1)', () => {
      const r = computeFestivals(ctx({ tithiIndex: 1, chandraMasaIndex: 7, region: 'bihar' }), resolver);
      expect(r.some(f => f.name === 'bhai_dooj')).toBe(true);
    });

    it('Phagli: Phalguna (11) Purnima (14), himachal only', () => {
      const hp = computeFestivals(ctx({ tithiIndex: 14, chandraMasaIndex: 11, region: 'himachal-pradesh' }), resolver);
      expect(hp.some(f => f.name === 'phagli')).toBe(true);
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

  describe('v2.1: Lohri (day before Makara Sankranti)', () => {
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

  describe('v2.1: orphan-region sweep', () => {
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
      { region: 'west-bengal',      ctx: ctx({ pohelaBoishakhToday: true, region: 'west-bengal' }),                  expectKey: 'pohela_boishakh' },
      { region: 'odisha',           ctx: ctx({ sankrantiRashi: 3, region: 'odisha' }),                               expectKey: 'raja_sankranti' },
      { region: 'assam',            ctx: ctx({ sankrantiRashi: 0, region: 'assam' }),                                expectKey: 'bohag_bihu' },
      { region: 'bihar',            ctx: ctx({ tithiIndex: 1, chandraMasaIndex: 7, region: 'bihar' }),               expectKey: 'bhai_dooj' },
      { region: 'jharkhand',        ctx: ctx({ tithiIndex: 0, chandraMasaIndex: 7, region: 'jharkhand' }),           expectKey: 'govardhan_puja' },
      { region: 'gujarat',          ctx: ctx({ sankrantiRashi: 9, region: 'gujarat' }),                              expectKey: 'uttarayan' },
      { region: 'maharashtra',      ctx: ctx({ tithiIndex: 0, chandraMasaIndex: 0, region: 'maharashtra' }),         expectKey: 'gudi_padwa' },
      { region: 'goa',              ctx: ctx({ tithiIndex: 0, chandraMasaIndex: 0, region: 'goa' }),                 expectKey: 'gudi_padwa' },
      { region: 'rajasthan',        ctx: ctx({ tithiIndex: 2, chandraMasaIndex: 0, region: 'rajasthan' }),           expectKey: 'gangaur' },
      { region: 'punjab',           ctx: ctx({ vaisakhiToday: true, region: 'punjab' }),                             expectKey: 'baisakhi' },
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

  describe('v2.1: Varamahalakshmi (last Friday of Shravana Shukla before Purnima)', () => {
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

  describe('v2.1: Bathukamma (Telangana) start + Saddula markers', () => {
    it('Engili Pula Bathukamma: Bhadrapada (5) Amavasya (29)', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 29, chandraMasaIndex: 5, region: 'telangana' }),
        resolver,
      );
      expect(r.some(f => f.name === 'bathukamma_start')).toBe(true);
      expect(r.some(f => f.name === 'mahalaya_amavasya')).toBe(true);
    });

    it('Saddula Bathukamma: Ashwin (6) Shukla Ashtami (7), the Durgashtami day', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 7, chandraMasaIndex: 6, region: 'telangana' }),
        resolver,
      );
      expect(r.some(f => f.name === 'bathukamma_saddula')).toBe(true);
      expect(r.some(f => f.name === 'durga_ashtami')).toBe(true);
      const navami = computeFestivals(
        ctx({ tithiIndex: 8, chandraMasaIndex: 6, region: 'telangana' }),
        resolver,
      );
      expect(navami.some(f => f.name === 'bathukamma_saddula')).toBe(false);
    });

    it('does NOT emit either marker outside Telangana', () => {
      const r1 = computeFestivals(ctx({ tithiIndex: 29, chandraMasaIndex: 5, region: 'kerala' }), resolver);
      expect(r1.some(f => f.name === 'bathukamma_start')).toBe(false);

      const r2 = computeFestivals(ctx({ tithiIndex: 8, chandraMasaIndex: 6, region: 'kerala' }), resolver);
      expect(r2.some(f => f.name === 'bathukamma_saddula')).toBe(false);
    });
  });

  describe('v2.1: Jagannath Rath Yatra (pan-Indian)', () => {
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

  describe('v2.1: Raja Parba 3-day arc (Odisha)', () => {
    it('Pahili Raja: emits when nextDaySankrantiRashi=3 (Karka)', () => {
      const r = computeFestivals(
        ctx({ nextDaySankrantiRashi: 3, region: 'odisha' }),
        resolver, rashiResolver,
      );
      expect(r.some(f => f.name === 'raja_pahili')).toBe(true);
    });

    it('Raja Sankranti: emits on Karka transit (sankrantiRashi=3)', () => {
      const r = computeFestivals(
        ctx({ sankrantiRashi: 3, region: 'odisha' }),
        resolver, rashiResolver,
      );
      expect(r.some(f => f.name === 'raja_sankranti')).toBe(true);
    });

    it('Basi Raja: emits when prevDaySankrantiRashi=3 (yesterday was Karka)', () => {
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

    it('does NOT cross-fire: Lohri transit (Makara=9) does not emit Raja', () => {
      const r = computeFestivals(ctx({ nextDaySankrantiRashi: 9, region: 'odisha' }), resolver, rashiResolver);
      expect(r.some(f => f.name === 'raja_pahili')).toBe(false);
    });
  });

  describe('kshaya anchors (tithi wholly inside one Hindu day)', () => {
    it('Hariyali Teej fires on the day that contains a kshaya Shravana Shukla Tritiya', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 20, chandraMasaIndex: 4, kshayaTithiIndices: new Set([2]) }),
        resolver,
      );
      expect(r.some(f => f.name === 'hariyali_teej')).toBe(true);
    });

    it('does not fire when the anchor is not the kshaya tithi', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 20, chandraMasaIndex: 4, kshayaTithiIndices: new Set([5]) }),
        resolver,
      );
      expect(r.some(f => f.name === 'hariyali_teej')).toBe(false);
    });

    it('does not fire on a vriddha day, where the set is empty', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 20, chandraMasaIndex: 4, kshayaTithiIndices: new Set() }),
        resolver,
      );
      expect(r.some(f => f.name === 'hariyali_teej')).toBe(false);
    });

    it('does not fire when more than one tithi is skipped, which only a polar day produces', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 20, chandraMasaIndex: 4, kshayaTithiIndices: new Set([2, 3]) }),
        resolver,
      );
      expect(r.some(f => f.name === 'hariyali_teej')).toBe(false);
    });

    it("kshayaRule 'exclude' opts Phagli out; Holi is chosen by the Holika Dahan ladder, not excluded", () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 20, chandraMasaIndex: 11, kshayaTithiIndices: new Set([14]) }),
        resolver,
      );
      expect(r.some(f => f.name === 'holi')).toBe(true);
      expect(r.some(f => f.name === 'phagli')).toBe(false);
    });

    it('Ugadi reads tomorrow\'s masa for a kshaya Shukla Pratipada', () => {
      const withNext = computeFestivals(
        ctx({
          tithiIndex: 20, chandraMasaIndex: 11, kshayaTithiIndices: new Set([0]),
          nextDayMasaIndex: 0, nextDayIsAdhika: false,
        }),
        resolver,
      );
      expect(withNext.some(f => f.name === 'ugadi')).toBe(true);
    });

    it('degrades to the sunrise masa when tomorrow\'s is absent, as at the location-free call site', () => {
      const r = computeFestivals(
        ctx({ tithiIndex: 20, chandraMasaIndex: 11, kshayaTithiIndices: new Set([0]) }),
        resolver,
      );
      expect(r.some(f => f.name === 'ugadi')).toBe(false);
    });

    it('does not fire when the month the anchor opens into is adhika', () => {
      const r = computeFestivals(
        ctx({
          tithiIndex: 20, chandraMasaIndex: 11, kshayaTithiIndices: new Set([0]),
          nextDayMasaIndex: 0, nextDayIsAdhika: true,
        }),
        resolver,
      );
      expect(r.some(f => f.name === 'ugadi')).toBe(false);
      expect(r.some(f => f.name === 'gudi_padwa')).toBe(false);
    });

    it('fires on the last day of an Adhika month when the anchor opens the Nija month', () => {
      const navaratri = computeFestivals(
        ctx({
          tithiIndex: 29, chandraMasaIndex: 6, isAdhika: true, kshayaTithiIndices: new Set([0]),
          nextDayMasaIndex: 6, nextDayIsAdhika: false,
        }),
        resolver,
      );
      expect(navaratri.map(f => f.name)).toEqual(['navaratri']);

      const ugadi = computeFestivals(
        ctx({
          tithiIndex: 29, chandraMasaIndex: 0, isAdhika: true, kshayaTithiIndices: new Set([0]),
          nextDayMasaIndex: 0, nextDayIsAdhika: false, region: 'maharashtra',
        }),
        resolver,
      );
      expect(ugadi.map(f => f.name)).toEqual(['ugadi', 'gudi_padwa']);
    });

    it('an Adhika day still skips the anchor when tomorrow is absent or still adhika', () => {
      for (const next of [{}, { nextDayMasaIndex: 6, nextDayIsAdhika: true }]) {
        const r = computeFestivals(
          ctx({
            tithiIndex: 29, chandraMasaIndex: 6, isAdhika: true, kshayaTithiIndices: new Set([0]),
            ...next,
          }),
          resolver,
        );
        expect(r.some(f => f.name === 'navaratri')).toBe(false);
      }
    });
  });

  it('returns empty when nothing matches', () => {
    expect(computeFestivals(ctx({ tithiIndex: 1 }), resolver)).toEqual([]);
  });

  it('can emit multiple festivals on the same day', () => {
    const r = computeFestivals(
      ctx({ tithiIndex: 27, chandraMasaIndex: 6, tithiByRule: { pradosha: 27 } }),
      resolver,
    );
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r.some(f => f.name === 'dhanteras')).toBe(true);
    expect(r.some(f => f.type === 'pradosha')).toBe(true);
  });
});

/**
 * Days of exactly 12 h daylight from 06:00: madhyahna 10:48-13:12, pradosha 18:00-20:24, nishita
 * 23:36-00:24. One anchor tithi occupies [start, end); the expected days follow from the rule text.
 */
describe('day selection with a day geometry', () => {
  const H = 3_600_000;
  const DAY0 = Date.UTC(2030, 0, 10);
  const at = (day: number, hours: number): number => DAY0 + day * 24 * H + hours * H;
  const run = (day: number, tithi: number, span: [number, number], masa: number, bhadraEnd?: number) => {
    const kalaDay = (k: number): KalaDay => ({
      sunrise: at(day + k, 6), sunset: at(day + k, 18), nextSunrise: at(day + k + 1, 6),
    });
    const tithiAt = (ms: number): number =>
      ms < span[0] ? (tithi + 29) % 30 : ms < span[1] ? tithi : (tithi + 1) % 30;
    const reaches: Record<number, number> = {
      [tithi * 12]: span[0], [((tithi + 1) % 30) * 12]: span[1], [tithi * 12 + 6]: bhadraEnd ?? span[0],
    };
    const g: DayGeometry = {
      today: kalaDay(0), day: kalaDay, tithiAt, nakshatraAt: () => 10,
      elongationReaches: (deg) => reaches[deg] ?? Number.NaN,
      localDay: (ms) => Math.floor(ms / (24 * H)),
    };
    return computeFestivals(
      ctx({ tithiIndex: tithiAt(at(day, 6)), chandraMasaIndex: masa, dayGeometry: g }), resolver,
    ).map((f) => f.key);
  };

  it('Shivaratri: nishita fully held on both nights goes to the later night', () => {
    const span: [number, number] = [at(0, 23.5), at(2, 0.5)];
    expect(run(0, 28, span, 2)).not.toContain('masik_shivaratri');
    expect(run(1, 28, span, 2)).toContain('masik_shivaratri');
  });

  it('Vinayaka Chaturthi: madhyahna fully held on both days goes to the earlier day', () => {
    const span: [number, number] = [at(0, 10.7), at(1, 13.3)];
    expect(run(0, 3, span, 2)).toContain('vinayaka_chaturthi');
    expect(run(1, 3, span, 2)).not.toContain('vinayaka_chaturthi');
  });

  it('Pradosh vrat: a Trayodashi touching neither pradosha has no vrat (no fallback)', () => {
    const span: [number, number] = [at(0, 20.7), at(1, 17.8)];
    expect(run(0, 12, span, 2)).not.toContain('pradosha');
    expect(run(1, 12, span, 2)).not.toContain('pradosha');
  });

  it('Raksha Bandhan: under 3 muhurtas of Purnima after the udaya sunrise moves it to the day Purnima begins', () => {
    const span: [number, number] = [at(0, 10), at(1, 7)];
    expect(run(0, 14, span, 4)).toContain('raksha_bandhan');
    expect(run(1, 14, span, 4)).not.toContain('raksha_bandhan');
  });

  it('Holika Dahan on the evening Bhadra ends before midnight, Holi the next day', () => {
    const span: [number, number] = [at(0, 9), at(1, 8)];
    const bhadraEnd = at(0, 20.5);
    expect(run(0, 14, span, 11, bhadraEnd)).toEqual(expect.arrayContaining(['holika_dahan']));
    expect(run(0, 14, span, 11, bhadraEnd)).not.toContain('holi');
    expect(run(1, 14, span, 11, bhadraEnd)).toContain('holi');
    expect(run(1, 14, span, 11, bhadraEnd)).not.toContain('holika_dahan');
  });
});
