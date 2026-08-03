/**
 * Guards against untranslated strings leaking into a localized result.
 *
 * Several user-visible strings used to be built with English template literals
 * outside the i18n layer, so a `language: 'hi'` panchang came back with a Hindi
 * festival `name` sitting next to an English `description`:
 *
 *   { name: "चंद्र ग्रहण",
 *     description: "Total lunar eclipse — 100% obscuration, visible from location." }
 *
 * The check is deliberately mechanical — any Latin-script run in a Hindi
 * result — because it catches new leaks without anyone remembering to add a
 * case for them.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };

/** Runs of 4+ Latin letters — long enough to skip "100%", "D9" and the like. */
const LATIN_RUN = /[A-Za-z]{4,}/;

// Days chosen to populate the strings that previously leaked: a total lunar
// eclipse, a solar eclipse, Raksha Bandhan (Bhadra description), a Sankranti,
// and an ordinary day.
const DAYS = ['2025-09-07', '2026-02-17', '2026-08-28', '2026-01-14', '2025-07-04'];

function hindiPanchang(day: string) {
  const r = getDailyPanchang(new Date(`${day}T06:30:00Z`), PUNE, {
    timezone: 330,
    language: 'hi',
  });
  if (r === null) throw new Error(`no panchang for ${day}`);
  return r;
}

describe('Hindi output carries no untranslated English', () => {
  for (const day of DAYS) {
    it(`${day} festival names and descriptions are localized`, () => {
      for (const f of hindiPanchang(day).festivals) {
        expect(f.name, `festival name "${f.name}"`).not.toMatch(LATIN_RUN);
        if (f.description !== undefined) {
          expect(f.description, `description of "${f.name}"`).not.toMatch(LATIN_RUN);
        }
      }
    });

    it(`${day} eclipse and bhadra display strings are localized`, () => {
      const r = hindiPanchang(day);
      if (r.eclipse !== null) {
        expect(r.eclipse.description, 'eclipse.description').not.toMatch(LATIN_RUN);
      }
      if (r.bhadra !== null) {
        // `location` stays a machine key by design; `locationName` is display.
        expect(['earth', 'heaven', 'paatal']).toContain(r.bhadra.location);
        expect(r.bhadra.locationName, 'bhadra.locationName').not.toMatch(LATIN_RUN);
      }
    });
  }

  it('covers days that actually populate the risky fields', () => {
    // Without this the suite above could pass by finding nothing to check.
    const eclipses = DAYS.map(hindiPanchang).filter((r) => r.eclipse !== null);
    const withFestivals = DAYS.map(hindiPanchang).filter((r) => r.festivals.length > 0);
    expect(eclipses.length, 'no eclipse day in the sample').toBeGreaterThan(0);
    expect(withFestivals.length, 'no festival day in the sample').toBeGreaterThan(0);
  });
});

describe('FestivalInfo.key', () => {
  it('is present, stable across languages, and independent of the localized name', () => {
    for (const day of DAYS) {
      const opts = { timezone: 330 } as const;
      const en = getDailyPanchang(new Date(`${day}T06:30:00Z`), PUNE, { ...opts, language: 'en' });
      const hi = getDailyPanchang(new Date(`${day}T06:30:00Z`), PUNE, { ...opts, language: 'hi' });
      if (en === null || hi === null) continue;

      expect(hi.festivals.map((f) => f.key), day).toEqual(en.festivals.map((f) => f.key));
      for (const f of en.festivals) {
        expect(f.key, `key for "${f.name}"`).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });
});
