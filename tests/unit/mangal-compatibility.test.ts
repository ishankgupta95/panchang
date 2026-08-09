/**
 * Mangal Dosha assessed for a couple.
 *
 * `computeMangalDosha` answers "is this native Manglik", which is not the
 * question a match asks: when both partners are Manglik the two afflictions
 * are held to neutralise each other, so a Manglik pair is compatible where a
 * Manglik/non-Manglik pair is not. That rule is pairwise and cannot be
 * expressed from one chart, which is why it had fallen between the two
 * modules — `doshas.ts` deferred it to matching and matching never took it up.
 */

import { describe, it, expect } from 'vitest';
import { computeRashiChart, computeMangalDosha, computeMangalCompatibility } from '../../src/index';
import type { BirthChart } from '../../src/index';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };

/**
 * Scan a span of birth moments for one Manglik and one non-Manglik chart, so
 * the tests below run against real computed charts rather than hand-built
 * placements that might not correspond to any real sky.
 */
function findCharts(): { manglik: BirthChart[]; clean: BirthChart[] } {
  const manglik: BirthChart[] = [];
  const clean: BirthChart[] = [];
  for (let i = 0; i < 400 && (manglik.length < 2 || clean.length < 2); i++) {
    // Step by ~11 days to sweep Mars across the houses reasonably fast.
    const d = new Date(Date.UTC(1990, 0, 1 + i * 11, 6, 30));
    const chart = computeRashiChart(d, DELHI);
    const m = computeMangalDosha(chart);
    if (m.afflicted && manglik.length < 2) manglik.push(chart);
    if (!m.afflicted && clean.length < 2) clean.push(chart);
  }
  return { manglik, clean };
}

const { manglik, clean } = findCharts();

describe('computeMangalCompatibility', () => {
  it('found both Manglik and non-Manglik charts to test against', () => {
    expect(manglik.length).toBe(2);
    expect(clean.length).toBe(2);
  });

  it('cancels when both natives are Manglik', () => {
    const r = computeMangalCompatibility(manglik[0]!, manglik[1]!);
    expect(r.boy.afflicted).toBe(true);
    expect(r.girl.afflicted).toBe(true);
    expect(r.afflicted).toBe(false);
    expect(r.cancellations).toContain('both natives Manglik — mutual cancellation');
    expect(r.description).toContain('mutually cancelled');
  });

  it('holds the dosha when only one native is Manglik', () => {
    const boyManglik = computeMangalCompatibility(manglik[0]!, clean[0]!);
    expect(boyManglik.afflicted).toBe(true);
    expect(boyManglik.cancellations).toEqual([]);
    expect(boyManglik.description).toContain('only the boy');

    const girlManglik = computeMangalCompatibility(clean[0]!, manglik[0]!);
    expect(girlManglik.afflicted).toBe(true);
    expect(girlManglik.description).toContain('only the girl');
  });

  it('is unafflicted when neither native is Manglik', () => {
    const r = computeMangalCompatibility(clean[0]!, clean[1]!);
    expect(r.afflicted).toBe(false);
    expect(r.cancellations).toEqual([]);
    expect(r.description).toBe('neither native is Manglik');
  });

  it('is symmetric in its verdict', () => {
    const all = [...manglik, ...clean];
    for (const a of all) {
      for (const b of all) {
        expect(computeMangalCompatibility(a, b).afflicted)
          .toBe(computeMangalCompatibility(b, a).afflicted);
      }
    }
  });

  it('carries each native\'s own chart-level result through untouched', () => {
    const r = computeMangalCompatibility(manglik[0]!, clean[0]!);
    expect(r.boy).toEqual(computeMangalDosha(manglik[0]!));
    expect(r.girl).toEqual(computeMangalDosha(clean[0]!));
  });

  /**
   * Chart-level cancellations run first, so a native whose Mars is exalted or
   * in its own sign is already unafflicted and must not be able to "cancel"
   * a genuinely Manglik partner.
   */
  it('a chart-cancelled native does not mutually cancel a Manglik partner', () => {
    const cancelledByChart = clean.filter((c) => computeMangalDosha(c).cancellations.length > 0);
    for (const c of cancelledByChart) {
      const r = computeMangalCompatibility(manglik[0]!, c);
      expect(r.afflicted).toBe(true);
    }
  });
});
