/**
 * @tier 1  DrikPanchang published Ekadashi list (rule-level reference)
 *
 * Smarta Ekadashi fast days for 2026, validated against DrikPanchang's
 * published list (drikpanchang.com/vrats/ekadashidates.html?year=2026,
 * fetched 2026-08-13; drik's default location Ujjain).
 *
 * The list is the ground truth for three tithi geometries:
 * - regular sunrise-prevalence days (21 of them in 2026),
 * - KSHAYA days — Yogini Jul 10 and Devutthana Nov 20, whose Ekadashi tithi
 *   touches no sunrise at all (Jul 10 08:16 → Jul 11 05:22 and
 *   Nov 20 07:15 → Nov 21 06:31 IST); drik fasts on the tithi's begin day
 *   with the Vaishnava "Gauna" fast the day after, and
 * - the VRIDDHA day — Unmilini Mahadwadashi May 27, where Ekadashi prevails
 *   at two consecutive sunrises (May 26 05:10 → May 27 06:21 IST) and the
 *   fast falls on the SECOND day only.
 *
 * Extended 2026-08-14 with drik's 2027 list (Jaipur, geoname-id 1269515),
 * which adds the fourth geometry:
 * - TRISPRISHA (kshaya DWADASHI) — Pausha Putrada: Ekadashi Jan 18 10:26 →
 *   Jan 19 07:49, Dwadashi ends Jan 20 04:41 BEFORE sunrise, so no valid
 *   parana morning exists within Dwadashi and the fast (all traditions)
 *   advances to Jan 18, the day the tithi begins, with parana Jan 19.
 */

import { describe, it, expect } from 'vitest';
import { computeEkadashiDatesForYear } from '../../src/calendar/yearly';
import { getDailyPanchang } from '../../src/core/panchang';

const UJJAIN = { latitude: 23.1765, longitude: 75.7885 };
const TZ = { timezone: 330 };

/** Drik's 2026 Smarta list — 24 fast days. */
const DRIK_SMARTA_2026 = [
  '2026-01-14', '2026-01-29',
  '2026-02-13', '2026-02-27',
  '2026-03-15', '2026-03-29',
  '2026-04-13', '2026-04-27',
  '2026-05-13', '2026-05-27',
  '2026-06-11', '2026-06-25',
  '2026-07-10', '2026-07-25',
  '2026-08-09', '2026-08-23',
  '2026-09-07', '2026-09-22',
  '2026-10-06', '2026-10-22',
  '2026-11-05', '2026-11-20',
  '2026-12-04', '2026-12-20',
];

const JAIPUR = { latitude: 26.9124, longitude: 75.7873 };

/**
 * Drik's 2027 Smarta list — 25 fast days (Jaipur). Jan 18 is the Trisprisha
 * (kshaya-Dwadashi) advance; the Vaishnava Gauna splits are Jul 30 and
 * Oct 26 (checked below), not separate Smarta dates.
 */
const DRIK_SMARTA_2027 = [
  '2027-01-03', '2027-01-18',
  '2027-02-02', '2027-02-17',
  '2027-03-04', '2027-03-18',
  '2027-04-02', '2027-04-17',
  '2027-05-02', '2027-05-16',
  '2027-06-01', '2027-06-14', '2027-06-30',
  '2027-07-14', '2027-07-29',
  '2027-08-12', '2027-08-28',
  '2027-09-11', '2027-09-26',
  '2027-10-11', '2027-10-25',
  '2027-11-10', '2027-11-24',
  '2027-12-09', '2027-12-23',
];

describe('Ekadashi 2026 — drik parity', () => {
  it('computeEkadashiDatesForYear returns exactly the drik smarta list', () => {
    const dates = computeEkadashiDatesForYear(2026, UJJAIN, TZ)
      .map((d) => d.toISOString().slice(0, 10));
    expect(dates).toEqual(DRIK_SMARTA_2026);
  });

  const festivalTypes = (y: number, m: number, d: number): string[] => {
    const p = getDailyPanchang(new Date(Date.UTC(y, m, d, 12)), UJJAIN, {
      timezone: 330, sections: ['festivals'],
    })!;
    return p.festivals.map((f) => f.type);
  };

  it('kshaya (Yogini): smarta on Jul 10, Gauna vaishnava on Jul 11', () => {
    const jul10 = festivalTypes(2026, 6, 10);
    expect(jul10).toContain('smarta_ekadashi');
    expect(jul10).toContain('ekadashi');
    expect(jul10).not.toContain('vaishnava_ekadashi');

    const jul11 = festivalTypes(2026, 6, 11);
    expect(jul11).toContain('vaishnava_ekadashi');
    expect(jul11).not.toContain('smarta_ekadashi');
  });

  it('kshaya (Devutthana): smarta on Nov 20, Gauna vaishnava on Nov 21', () => {
    const nov20 = festivalTypes(2026, 10, 20);
    expect(nov20).toContain('smarta_ekadashi');
    expect(nov20).not.toContain('vaishnava_ekadashi');

    const nov21 = festivalTypes(2026, 10, 21);
    expect(nov21).toContain('vaishnava_ekadashi');
    expect(nov21).not.toContain('smarta_ekadashi');
  });

  it('vriddha (Unmilini Mahadwadashi): nothing on May 26, everything on May 27', () => {
    const may26 = festivalTypes(2026, 4, 26);
    expect(may26.filter((t) => t.includes('ekadashi'))).toEqual([]);

    const may27 = festivalTypes(2026, 4, 27);
    expect(may27).toContain('smarta_ekadashi');
    expect(may27).toContain('vaishnava_ekadashi');
    expect(may27).toContain('ekadashi');
  });
});

describe('Ekadashi 2027 — drik parity (Jaipur)', () => {
  it('computeEkadashiDatesForYear returns exactly the drik smarta list', () => {
    const dates = computeEkadashiDatesForYear(2027, JAIPUR, TZ)
      .map((d) => d.toISOString().slice(0, 10));
    expect(dates).toEqual(DRIK_SMARTA_2027);
  });

  const festivalTypes = (y: number, m: number, d: number): string[] => {
    const p = getDailyPanchang(new Date(Date.UTC(y, m, d, 12)), JAIPUR, {
      timezone: 330, sections: ['festivals'],
    })!;
    return p.festivals.map((f) => f.type);
  };

  it('Trisprisha (Pausha Putrada): smarta on Jan 18, Gauna vaishnava on Jan 19', () => {
    // Drik: "Pausha Putrada Ekadashi" Jan 18; Jan 19 = "Trisparsha
    // Mahadwadashi, Gauna / Vaishnava Pausha Putrada Ekadashi". Same split
    // drik prints for Devutthana 2025 (Nov 1 / Nov 2, Mumbai).
    const jan18 = festivalTypes(2027, 0, 18);
    expect(jan18).toContain('smarta_ekadashi');
    expect(jan18).toContain('ekadashi');
    expect(jan18).not.toContain('vaishnava_ekadashi');

    const jan19 = festivalTypes(2027, 0, 19);
    expect(jan19).toContain('vaishnava_ekadashi');
    expect(jan19).not.toContain('smarta_ekadashi');
  });

  it('kshaya (Kamika): smarta on Jul 29, Gauna vaishnava on Jul 30', () => {
    const jul29 = festivalTypes(2027, 6, 29);
    expect(jul29).toContain('smarta_ekadashi');
    expect(jul29).not.toContain('vaishnava_ekadashi');

    const jul30 = festivalTypes(2027, 6, 30);
    expect(jul30).toContain('vaishnava_ekadashi');
    expect(jul30).not.toContain('smarta_ekadashi');
  });

  it('Dashami-viddha (Rama): smarta on Oct 25, vaishnava on Oct 26', () => {
    // Drik: "Rama Ekadashi" Oct 25, "Vaishnava Rama Ekadashi" Oct 26.
    // Ekadashi runs Oct 25 05:40 → Oct 26 03:22 IST, so it begins 51 min
    // before sunrise — after arunodaya, leaving Dashami in possession of it.
    const oct25 = festivalTypes(2027, 9, 25);
    expect(oct25).toContain('smarta_ekadashi');
    expect(oct25).toContain('ekadashi');
    expect(oct25).not.toContain('vaishnava_ekadashi');

    const oct26 = festivalTypes(2027, 9, 26);
    expect(oct26).toContain('vaishnava_ekadashi');
    expect(oct26).not.toContain('smarta_ekadashi');
  });
});

/**
 * The Smarta/Vaishnava split orientation, pinned across every two-day pair
 * DrikPanchang publishes in 2024–2028 (Jaipur, geoname-id 1269515).
 *
 * Drik's own rule prose (on each Ekadashi's date-time page) states it
 * directly: "It is advised that Smartha with family should observe fasting on
 * first day only. The alternate Ekadashi fasting, which is the second one, is
 * suggested for Sanyasis, widows and for those who want Moksha. When alternate
 * Ekadashi fasting is suggested for Smartha it coincides with Vaishnava
 * Ekadashi fasting day." So in EVERY split, whatever its tithi geometry, the
 * earlier day is Smarta and the later day Vaishnava.
 *
 * A sweep of all 109 Ekadashi tithi windows in 2024–2028 turns up exactly
 * three geometries that make drik print two days, and the library now agrees
 * with all three (151 emission-days compared, 0 mismatches):
 *
 *  - DASHAMI-VIDDHA — the tithi begins between arunodaya and sunrise, so it
 *    holds no arunodaya at all. Margins 15/28/79/51/47 min before sunrise,
 *    against a 132-min minimum across the 94 non-split days: cleanly separated
 *    by the 96-min (4-ghati) arunodaya the library already uses.
 *  - VRIDDHA DWADASHI (Pakshavardhini) — the following Dwadashi prevails at
 *    two consecutive sunrises. 4 occurrences, no counterexamples.
 *  - KSHAYA and TRISPRISHA — covered by the 2026/2027 suites above.
 */
describe('Smarta/Vaishnava split orientation — drik 2024–2028 (Jaipur)', () => {
  const festivalTypes = (iso: string): string[] => {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    const p = getDailyPanchang(new Date(Date.UTC(y, m - 1, d, 12)), JAIPUR, {
      timezone: 330, sections: ['festivals'],
    })!;
    return p.festivals.map((f) => f.type);
  };

  /** [smarta day, vaishnava day, drik's name for the pair] */
  const VIDDHA_PAIRS: [string, string, string][] = [
    ['2024-03-06', '2024-03-07', 'Vijaya'],
    ['2024-06-02', '2024-06-03', 'Apara'],
    ['2025-03-25', '2025-03-26', 'Papamochani'],
    ['2027-10-25', '2027-10-26', 'Rama'],
    ['2028-08-16', '2028-08-17', 'Aja'],
  ];

  const VRIDDHA_DWADASHI_PAIRS: [string, string, string][] = [
    ['2025-06-06', '2025-06-07', 'Nirjala'],
    ['2026-08-23', '2026-08-24', 'Shravana Putrada'],
    ['2028-02-20', '2028-02-21', 'Vijaya'],
    ['2028-10-28', '2028-10-29', 'Devutthana'],
  ];

  for (const [group, pairs] of [
    ['Dashami-viddha', VIDDHA_PAIRS],
    ['vriddha Dwadashi', VRIDDHA_DWADASHI_PAIRS],
  ] as const) {
    for (const [smartaDay, vaishnavaDay, name] of pairs) {
      it(`${group} ${name}: smarta ${smartaDay}, vaishnava ${vaishnavaDay}`, () => {
        const first = festivalTypes(smartaDay);
        expect(first).toContain('smarta_ekadashi');
        expect(first).toContain('ekadashi');
        expect(first).not.toContain('vaishnava_ekadashi');

        const second = festivalTypes(vaishnavaDay);
        expect(second).toContain('vaishnava_ekadashi');
        expect(second).not.toContain('smarta_ekadashi');
      });
    }
  }

  it('an ordinary Ekadashi still carries both fasts on the same day', () => {
    // Drik prints one unqualified row: 2027-06-30 "Yogini Ekadashi".
    const types = festivalTypes('2027-06-30');
    expect(types).toContain('smarta_ekadashi');
    expect(types).toContain('vaishnava_ekadashi');
    expect(types).toContain('ekadashi');
    expect(festivalTypes('2027-07-01').filter((t) => t.includes('ekadashi'))).toEqual([]);
  });
});
