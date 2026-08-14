/**
 * @tier 1  DrikPanchang 2027 Sankranti dates page (Jaipur, geoname-id 1269515)
 *
 * The full 12-row 2027 Sankranti table — observed day AND transit moment —
 * pinned from drik (2026-08-14 audit). Three of the twelve transits fall
 * between sunset and the next sunrise, and those are the rows that
 * discriminate drik's attribution rule (SK-1): a daylight transit carries
 * its own civil day, a night transit files under the NEXT sunrise's day.
 *
 *   Makara     Jan 14 21:14 IST (night) → observed Jan 15
 *   Tula       Oct 18 02:12 IST (night) → observed Oct 18
 *   Vrishchika Nov 17 02:02 IST (night) → observed Nov 17
 *
 * The 2025 case previously used to verify sankranti attribution (Makara
 * 2025, Jan 14 09:03 IST) was a daytime transit, which both the old and the
 * new rule date identically — it never discriminated them.
 *
 * Moment tolerance ±2 min (drik prints minutes; our Sun differs ≤0.5 min).
 * The observed DAY is a TIERS.md invariant: if a day here moves, the
 * attribution rule broke — do not re-pin.
 */

import { describe, it, expect } from 'vitest';
import { computeSankrantisForYear } from '../../src/calendar/yearly';

const JAIPUR = { latitude: 26.9124, longitude: 75.7873 };
const TOL_MIN = 2;

/** rashi index, drik observed day, drik transit moment (IST wall clock). */
const DRIK_2027: { rashi: number; name: string; day: string; moment: string }[] = [
  { rashi: 9,  name: 'Makara',     day: '2027-01-15', moment: '2027-01-14T21:14' },
  { rashi: 10, name: 'Kumbha',     day: '2027-02-13', moment: '2027-02-13T10:13' },
  { rashi: 11, name: 'Meena',      day: '2027-03-15', moment: '2027-03-15T07:04' },
  { rashi: 0,  name: 'Mesha',      day: '2027-04-14', moment: '2027-04-14T15:33' },
  { rashi: 1,  name: 'Vrishabha',  day: '2027-05-15', moment: '2027-05-15T12:24' },
  { rashi: 2,  name: 'Mithuna',    day: '2027-06-15', moment: '2027-06-15T19:00' },
  { rashi: 3,  name: 'Karka',      day: '2027-07-17', moment: '2027-07-17T05:52' },
  { rashi: 4,  name: 'Simha',      day: '2027-08-17', moment: '2027-08-17T14:16' },
  { rashi: 5,  name: 'Kanya',      day: '2027-09-17', moment: '2027-09-17T14:14' },
  { rashi: 6,  name: 'Tula',       day: '2027-10-18', moment: '2027-10-18T02:12' },
  { rashi: 7,  name: 'Vrishchika', day: '2027-11-17', moment: '2027-11-17T02:02' },
  { rashi: 8,  name: 'Dhanu',      day: '2027-12-16', moment: '2027-12-16T16:42' },
];

describe('Sankranti 2027 vs DrikPanchang (Jaipur) — day + transit moment', () => {
  const list = computeSankrantisForYear(2027, JAIPUR, { timezone: 330 });

  it('publishes exactly 12 sankrantis', () => {
    expect(list).toHaveLength(12);
  });

  for (const row of DRIK_2027) {
    it(`${row.name}: observed ${row.day}, transit ${row.moment} IST`, () => {
      const ours = list.find((s) => s.rashi === row.rashi);
      expect(ours, `${row.name} present`).toBeDefined();
      expect(ours!.date.toISOString().slice(0, 10)).toBe(row.day);
      // moment is UTC; drik prints IST wall clock.
      const momentIst = new Date(ours!.moment.getTime() + 330 * 60_000)
        .toISOString().slice(0, 16);
      const diffMin = Math.abs(
        (Date.parse(momentIst + ':00Z') - Date.parse(row.moment + ':00Z')) / 60_000,
      );
      expect(diffMin, `${row.name} transit moment`).toBeLessThanOrEqual(TOL_MIN);
    });
  }
});
