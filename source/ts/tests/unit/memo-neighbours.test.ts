/**
 * Each module-level memo is asked for one key and then for keys 1 ms to 1 day away (and a location
 * a hair away), and every second answer must equal the same call in a freshly loaded module, whose
 * memos are empty. A memo keyed coarser than its inputs, or one that reuses a nearby search, fails
 * here even when it is wrong the same way on every run. The Go port pins the same probes in
 * TestEphemerisMemosNeverAnswerANeighbouringKey.
 */
import { describe, it, expect, vi } from 'vitest';
import type * as Lunation from '../../src/astronomy/lunation';
import type * as Planet from '../../src/astronomy/planet';
import type * as Eclipse from '../../src/astronomy/eclipse';

const DELTAS = [1, 999, 59_000, 3_600_000, 86_400_000];
const BASES = [
  Date.UTC(1980, 7, 10, 12),
  Date.UTC(2025, 2, 29, 10, 58),
  Date.UTC(1912, 3, 17, 11),
  Date.UTC(2061, 6, 1),
];
const BODIES: Planet.PlanetBody[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];
const PUNE = { latitude: 18.5204, longitude: 73.8567, elevation: 560 };

async function fresh<T>(load: () => Promise<T>): Promise<T> {
  vi.resetModules();
  return load();
}
const lunation = (): Promise<typeof Lunation> => import('../../src/astronomy/lunation');
const planet = (): Promise<typeof Planet> => import('../../src/astronomy/planet');
const eclipse = (): Promise<typeof Eclipse> => import('../../src/astronomy/eclipse');
const ms = (d: Date | null): number | null => (d === null ? null : d.getTime());

describe('memos never answer a neighbouring key', () => {
  it('searchMoonPhase and getPlanetPosition', async () => {
    for (const base of BASES) {
      for (const d of DELTAS) {
        const warmL = await fresh(lunation);
        const warmP = await fresh(planet);
        for (const target of [0, 180]) {
          warmL.searchMoonPhase(target, new Date(base), 45);
          const got = ms(warmL.searchMoonPhase(target, new Date(base + d), 45));
          const want = ms((await fresh(lunation)).searchMoonPhase(target, new Date(base + d), 45));
          expect(got, `searchMoonPhase(${target}, ${base + d}) after ${base}`).toBe(want);
        }
        for (const body of BODIES) {
          warmP.getPlanetPosition(body, new Date(base));
          const got = warmP.getPlanetPosition(body, new Date(base + d));
          const want = (await fresh(planet)).getPlanetPosition(body, new Date(base + d));
          expect(got, `getPlanetPosition(${body}, ${base + d}) after ${base}`).toEqual(want);
        }
      }
    }
  });

  it('the upcoming-eclipse searches, by instant and by location', async () => {
    const nudged = [
      { ...PUNE, latitude: PUNE.latitude + 1e-9 },
      { ...PUNE, longitude: PUNE.longitude + 1e-9 },
      { ...PUNE, elevation: 561 },
      { latitude: PUNE.latitude, longitude: PUNE.longitude },
    ];
    for (const base of BASES) {
      for (const d of DELTAS) {
        const warm = await fresh(eclipse);
        warm.getUpcomingSolarEclipse(new Date(base), PUNE, 400);
        warm.getUpcomingLunarEclipse(new Date(base), PUNE, 400);
        const reference = await fresh(eclipse);
        expect(warm.getUpcomingSolarEclipse(new Date(base + d), PUNE, 400))
          .toEqual(reference.getUpcomingSolarEclipse(new Date(base + d), PUNE, 400));
        expect(warm.getUpcomingLunarEclipse(new Date(base + d), PUNE, 400))
          .toEqual(reference.getUpcomingLunarEclipse(new Date(base + d), PUNE, 400));
      }
      const warm = await fresh(eclipse);
      warm.getUpcomingSolarEclipse(new Date(base), PUNE, 400);
      for (const loc of nudged) {
        const want = (await fresh(eclipse)).getUpcomingSolarEclipse(new Date(base), loc, 400);
        expect(warm.getUpcomingSolarEclipse(new Date(base), loc, 400), JSON.stringify(loc)).toEqual(want);
      }
    }
  });

  it('a string coordinate never shares a memo entry with the number it spells', async () => {
    const warm = await fresh(eclipse);
    const loc = { latitude: '18.5204', longitude: '73.8567' } as unknown as typeof PUNE;
    const from = new Date(BASES[1]!);
    warm.getUpcomingSolarEclipse(from, loc, 400);
    const want = (await fresh(eclipse)).getUpcomingSolarEclipse(from, { latitude: 18.5204, longitude: 73.8567 }, 400);
    expect(warm.getUpcomingSolarEclipse(from, { latitude: 18.5204, longitude: 73.8567 }, 400)).toEqual(want);
  });
});
