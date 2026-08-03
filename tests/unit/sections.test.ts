/**
 * `options.sections` narrows which ephemeris-backed blocks `getDailyPanchang`
 * computes. Two properties matter and are pinned here:
 *
 *   1. Omitting the option is byte-identical to requesting every section, so
 *      existing callers are unaffected.
 *   2. A requested section produces exactly the same values it would have
 *      produced in a full run — narrowing skips work, it never degrades it.
 *
 * The second property is the one worth guarding: a naive implementation that
 * shares intermediate state between blocks could return subtly different
 * festivals when moon times are switched off.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import type { PanchangSection } from '../../src/types/options';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const TZ = 330;
const ALL: readonly PanchangSection[] = ['festivals', 'eclipse', 'moonTimes', 'lunarWindows'];

// A spread of days: an eclipse day, a festival-dense day, a Sankranti, and an
// ordinary day — so the comparisons below exercise populated sections rather
// than trivially-empty ones.
const DAYS = ['2025-09-07', '2026-03-03', '2026-01-14', '2026-08-26', '2025-07-04'];

function panchangFor(day: string, sections?: readonly PanchangSection[]) {
  const r = getDailyPanchang(new Date(`${day}T06:30:00Z`), PUNE, {
    timezone: TZ,
    ...(sections === undefined ? {} : { sections }),
  });
  if (r === null) throw new Error(`no panchang for ${day}`);
  return r;
}

describe('options.sections', () => {
  it('defaults to every section', () => {
    for (const day of DAYS) {
      expect(JSON.stringify(panchangFor(day)), day)
        .toBe(JSON.stringify(panchangFor(day, ALL)));
    }
  });

  it('leaves omitted sections at their documented empty values', () => {
    for (const day of DAYS) {
      const r = panchangFor(day, []);
      expect(r.festivals, day).toEqual([]);
      expect(r.eclipse, day).toBeNull();
      expect(r.moonrise, day).toBeNull();
      expect(r.moonset, day).toBeNull();
      expect(r.bhadra, day).toBeNull();
      expect(r.varjyam, day).toBeNull();
      expect(r.panchakaRahita, day).toEqual([]);
    }
  });

  it('still computes everything outside the optional sections', () => {
    for (const day of DAYS) {
      const full = panchangFor(day);
      const bare = panchangFor(day, []);
      // Slot systems, inauspicious periods, masa and special yogas are
      // arithmetic on the sunrise triplet and are never skipped.
      expect(JSON.stringify(bare.choghadiya), day).toBe(JSON.stringify(full.choghadiya));
      expect(JSON.stringify(bare.hora), day).toBe(JSON.stringify(full.hora));
      expect(JSON.stringify(bare.rahuKalam), day).toBe(JSON.stringify(full.rahuKalam));
      expect(JSON.stringify(bare.chandramasa), day).toBe(JSON.stringify(full.chandramasa));
      expect(JSON.stringify(bare.specialYogas), day).toBe(JSON.stringify(full.specialYogas));
      expect(bare.vara.index, day).toBe(full.vara.index);
    }
  });

  /**
   * Element **identity** — which elements, in which order — is exactly
   * preserved when narrowing. Transition **times** are preserved to within one
   * `LongitudeCache` bucket.
   *
   * The bucket caveat is real and worth stating plainly. The cache memoizes
   * longitudes on 60-second bins, and the transition binary search reads
   * through it. A narrowed run populates fewer bins (no festival kala anchors),
   * so a search can converge to a slightly different point inside the same bin
   * — observed at up to ~47 s on 2026-08-26 at Pune.
   *
   * The alternative is to make the search read exact longitudes, which would
   * make narrowing perfectly deterministic but would shift every published
   * transition time relative to the released behaviour. Keeping the bins means
   * the default (un-narrowed) call is bit-identical to what shipped, and the
   * divergence is confined to the opt-in path. Callers who need a narrowed run
   * to agree with a full one to the second should not narrow.
   */
  it('keeps element identity identical and times within one cache bucket', () => {
    const BUCKET_MS = 60_000;
    const identity = (els: readonly { index: number; name: string }[]) =>
      els.map((e) => `${e.index}|${e.name}`);
    const drift = (
      a: readonly { startTime: Date | null; endTime: Date | null }[],
      b: readonly { startTime: Date | null; endTime: Date | null }[],
    ) => {
      let worst = 0;
      for (let i = 0; i < b.length; i++) {
        for (const k of ['startTime', 'endTime'] as const) {
          const x = a[i]![k], y = b[i]![k];
          if (x && y) worst = Math.max(worst, Math.abs(x.getTime() - y.getTime()));
        }
      }
      return worst;
    };

    for (const day of DAYS) {
      const full = panchangFor(day);
      const bare = panchangFor(day, []);
      for (const [name, a, b] of [
        ['tithis', bare.tithis, full.tithis],
        ['nakshatras', bare.nakshatras, full.nakshatras],
        ['yogas', bare.yogas, full.yogas],
        ['karanas', bare.karanas, full.karanas],
      ] as const) {
        expect(identity(a), `${name} identity ${day}`).toEqual(identity(b));
        expect(drift(a, b), `${name} timing drift on ${day}`).toBeLessThan(BUCKET_MS);
      }
    }
  });

  it('keeps sub-degree progress fields within one cache bucket when narrowed', () => {
    // The Moon moves ~0.0092°/min, so a 60 s bucket bounds the divergence at
    // ~0.01° of nakshatra travel (~0.07% of a nakshatra). Anything larger would
    // mean narrowing had changed the computation, not just the bucket contents.
    const MAX_DEG = 0.01;
    const MAX_PCT = 0.08;
    for (const day of DAYS) {
      const full = panchangFor(day);
      const bare = panchangFor(day, []);
      for (let i = 0; i < full.nakshatras.length; i++) {
        expect(
          Math.abs(bare.nakshatras[i]!.degreesInNakshatra - full.nakshatras[i]!.degreesInNakshatra),
          `nakshatra[${i}] degrees on ${day}`,
        ).toBeLessThanOrEqual(MAX_DEG);
      }
      for (const [name, a, b] of [
        ['tithi', bare.tithis, full.tithis],
        ['yoga', bare.yogas, full.yogas],
      ] as const) {
        for (let i = 0; i < b.length; i++) {
          expect(
            Math.abs(a[i]!.completionPercentage - b[i]!.completionPercentage),
            `${name}[${i}] completion on ${day}`,
          ).toBeLessThanOrEqual(MAX_PCT);
        }
      }
    }
  });

  it('produces identical values for each section requested in isolation', () => {
    for (const day of DAYS) {
      const full = panchangFor(day);

      const festivalsOnly = panchangFor(day, ['festivals', 'eclipse']);
      expect(festivalsOnly.festivals.map((f) => f.key), `festivals ${day}`)
        .toEqual(full.festivals.map((f) => f.key));

      const moonOnly = panchangFor(day, ['moonTimes']);
      expect(moonOnly.moonrise?.toISOString() ?? null, `moonrise ${day}`)
        .toBe(full.moonrise?.toISOString() ?? null);
      expect(moonOnly.moonset?.toISOString() ?? null, `moonset ${day}`)
        .toBe(full.moonset?.toISOString() ?? null);

      const windowsOnly = panchangFor(day, ['lunarWindows']);
      expect(JSON.stringify(windowsOnly.bhadra), `bhadra ${day}`)
        .toBe(JSON.stringify(full.bhadra));
      expect(JSON.stringify(windowsOnly.varjyam), `varjyam ${day}`)
        .toBe(JSON.stringify(full.varjyam));
      expect(JSON.stringify(windowsOnly.panchakaRahita), `panchakaRahita ${day}`)
        .toBe(JSON.stringify(full.panchakaRahita));
    }
  });

  it('keeps Bhadra-dependent festival descriptions correct without lunarWindows', () => {
    // Raksha Bandhan's "observe after Bhadra ends" note reads the Bhadra
    // window. Requesting 'festivals' alone must still compute it internally
    // even though the window itself is not reported.
    const day = '2026-08-28'; // Shravana Purnima 2026
    const withWindows = panchangFor(day, ['festivals', 'lunarWindows']);
    const withoutWindows = panchangFor(day, ['festivals']);
    expect(JSON.stringify(withoutWindows.festivals))
      .toBe(JSON.stringify(withWindows.festivals));
    expect(withoutWindows.bhadra).toBeNull();
  });

  it('is materially cheaper when sections are dropped', () => {
    // Guards the point of the option: if narrowing ever stopped skipping work,
    // this would regress toward 1.0. Generous bound to stay CI-stable.
    const day = new Date('2025-07-04T06:30:00Z');
    const time = (sections?: readonly PanchangSection[]) => {
      const opts = {
        timezone: TZ,
        computeEndTimes: false,
        ...(sections === undefined ? {} : { sections }),
      };
      for (let i = 0; i < 5; i++) getDailyPanchang(day, PUNE, opts);
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) getDailyPanchang(day, PUNE, opts);
      return performance.now() - t0;
    };
    const ratio = time([]) / time();
    expect(ratio, `sections:[] took ${(ratio * 100).toFixed(0)}% of a full run`)
      .toBeLessThan(0.75);
  });
});
