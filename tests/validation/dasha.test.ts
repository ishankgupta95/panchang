/**
 * Phase 18-4 — Vimshottari Dasha validation.
 *
 * Rationale for math-invariant validation over external scraping:
 * Phase 18-3 established that our Moon sidereal longitude matches Drik Panchang
 * at Δ<0.03° across 6 dates. The Vimshottari Dasha calculation is purely
 * deterministic given Moon's nakshatra + degree-within-nakshatra — no ephemeris,
 * no astronomical model. Once Moon longitude is verified, the dasha output is
 * fully determined by a closed-form formula (nakshatra-lord lookup +
 * proportional balance). Validating the formula against classical boundary
 * cases and published constants is stronger than validating against any single
 * third-party web calculator (all of which are AJAX-only and not URL-fetchable).
 *
 * Classical references used for the hardcoded expected values below:
 *   - Maharshi Parashara, *Brihat Parashara Hora Shastra* (BPHS), Ch. 46–47
 *     "Vimshottari Dasha Adhyaya" — canonical source for the 120-year cycle,
 *     nakshatra-lord mapping, and antardasha proportion rule.
 *   - B. V. Raman, *A Manual of Hindu Astrology* (UBS Publishers, 4th ed.),
 *     Ch. XIII "Dasas and Bhuktis" — the English-language reference most
 *     practitioners use; tabulates DASHA_YEARS and DASHA_ORDER explicitly.
 *   - K. N. Rao, *Learn Hindu Astrology Easily* (Vani Publications) —
 *     worked examples of balance-at-birth computation from Moon's degree
 *     within nakshatra.
 * All three agree bit-for-bit on the constants we assert below; any single
 * miscoded value (e.g. Saturn 18 vs 19, or a swapped nakshatra-lord entry)
 * fails multiple of these tests simultaneously.
 *
 * This suite validates:
 *   1. Nakshatra-to-lord lookup table (classical 27-entry mapping, BPHS 46.5–7)
 *   2. Boundary cases (exact nakshatra start/end/midpoint)
 *   3. Dasha sequence cycle order (classical Ketu→Venus→…→Mercury, BPHS 46.12)
 *   4. Balance-at-birth formula (elapsed-fraction × lord-years, BPHS 46.13–14)
 *   5. Total-span invariant (9 mahadashas span [120 − startLordYears, 120] years)
 *   6. Antardasha proportions (classical: lordYears/120 × parent-duration, BPHS 47)
 *   7. End-to-end real-chart check using a Drik-verified Moon from 18-3
 */

import { describe, it, expect } from 'vitest';
import { computeVimshottariDasha, DASHA_YEARS, DASHA_ORDER, NAKSHATRA_LORD } from '../../src/jyotish/dasha';

const NAKSHATRA_SPAN = 360 / 27; // 13.333…°
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

// ── 1. Classical nakshatra-lord lookup ────────────────────────────────────────

describe('NAKSHATRA_LORD table — classical 27-entry cycle', () => {
  // Source: Parashara BPHS 46.5–7; B. V. Raman, Manual of Hindu Astrology, Ch. XIII, Table 1.
  // The cycle Ketu→Venus→Sun→Moon→Mars→Rahu→Jupiter→Saturn→Mercury repeats 3× across 27 nakshatras,
  // starting from Ashwini (index 0) ruled by Ketu.
  const EXPECTED_LORDS = [
    'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',  // Ashwini-Ashlesha
    'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',  // Magha-Jyeshtha
    'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',  // Mula-Revati
  ];

  it('has exactly 27 entries', () => {
    expect(NAKSHATRA_LORD).toHaveLength(27);
  });

  for (let i = 0; i < 27; i++) {
    it(`nakshatra[${i}] lord === ${EXPECTED_LORDS[i]}`, () => {
      expect(NAKSHATRA_LORD[i]).toBe(EXPECTED_LORDS[i]);
    });
  }
});

// ── 2. Dasha-years constants ──────────────────────────────────────────────────

describe('DASHA_YEARS — classical Vimshottari durations', () => {
  // Source: Parashara BPHS 46.12; B. V. Raman, Manual of Hindu Astrology, Ch. XIII p. 186.
  // Ketu 7 + Venus 20 + Sun 6 + Moon 10 + Mars 7 + Rahu 18 + Jupiter 16 + Saturn 19 + Mercury 17 = 120.
  it('Ketu = 7y',     () => expect(DASHA_YEARS.Ketu).toBe(7));
  it('Venus = 20y',   () => expect(DASHA_YEARS.Venus).toBe(20));
  it('Sun = 6y',      () => expect(DASHA_YEARS.Sun).toBe(6));
  it('Moon = 10y',    () => expect(DASHA_YEARS.Moon).toBe(10));
  it('Mars = 7y',     () => expect(DASHA_YEARS.Mars).toBe(7));
  it('Rahu = 18y',    () => expect(DASHA_YEARS.Rahu).toBe(18));
  it('Jupiter = 16y', () => expect(DASHA_YEARS.Jupiter).toBe(16));
  it('Saturn = 19y',  () => expect(DASHA_YEARS.Saturn).toBe(19));
  it('Mercury = 17y', () => expect(DASHA_YEARS.Mercury).toBe(17));

  it('sum to 120 years', () => {
    const sum = Object.values(DASHA_YEARS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(120);
  });
});

// ── 3. Cycle order ────────────────────────────────────────────────────────────

describe('DASHA_ORDER — Ketu → Venus → … → Mercury', () => {
  // Source: Parashara BPHS 46.12 gives the sequence as Sun→Moon→Mars→Rahu→Jupiter→Saturn→Mercury→Ketu→Venus;
  // since the cycle is closed, starting from Ketu (the usual nakshatra-lord convention for Ashwini) produces
  // Ketu→Venus→Sun→Moon→Mars→Rahu→Jupiter→Saturn→Mercury. Both Raman and K. N. Rao list it in this form.
  const EXPECTED = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  it('has 9 lords in classical order', () => {
    expect(DASHA_ORDER).toEqual(EXPECTED);
  });
});

// ── 4. Boundary cases — exact nakshatra start / end / midpoint ────────────────

describe('birth at exact nakshatra start → full balance of that lord', () => {
  const birthDate = new Date('2000-01-01T00:00:00Z');

  // Ashwini starts at 0°; ruled by Ketu (7 years)
  it('Moon = 0.000° (Ashwini start) → Ketu balance = 7 years', () => {
    const r = computeVimshottariDasha(birthDate, 0);
    expect(r.mahaDashas[0]!.lord).toBe('Ketu');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(7, 2);
  });

  // Bharani starts at 13.333°; ruled by Venus (20 years)
  it('Moon = 13.3333° (Bharani start) → Venus balance = 20 years', () => {
    const r = computeVimshottariDasha(birthDate, NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.lord).toBe('Venus');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(20, 2);
  });

  // Revati starts at 346.667°; ruled by Mercury (17 years)
  it('Moon = 346.667° (Revati start) → Mercury balance = 17 years', () => {
    const r = computeVimshottariDasha(birthDate, 26 * NAKSHATRA_SPAN);
    expect(r.mahaDashas[0]!.lord).toBe('Mercury');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(17, 2);
  });
});

describe('birth near nakshatra end → near-zero balance', () => {
  const birthDate = new Date('2000-01-01T00:00:00Z');

  // Revati end: 360° − ε. Lord Mercury (17 years); elapsed ≈ 1 ⇒ balance ≈ 0
  it('Moon = 359.9999° → Mercury balance ≈ 0, next (Ketu) is second', () => {
    const r = computeVimshottariDasha(birthDate, 359.9999);
    expect(r.mahaDashas[0]!.lord).toBe('Mercury');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeLessThan(0.001);
    expect(r.mahaDashas[1]!.lord).toBe('Ketu');
  });
});

describe('birth at nakshatra midpoint → half balance', () => {
  const birthDate = new Date('2000-01-01T00:00:00Z');

  it('Moon = 6.6667° (mid-Ashwini) → Ketu balance = 3.5 years', () => {
    const r = computeVimshottariDasha(birthDate, NAKSHATRA_SPAN / 2);
    expect(r.mahaDashas[0]!.lord).toBe('Ketu');
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(3.5, 2);
  });
});

// ── 5. Sequence invariants ────────────────────────────────────────────────────

describe('sequence invariants (held for all valid Moon longitudes)', () => {
  const cases = [0, 50, 100.78, 180, 250, 300, 359.99];

  for (const moonLon of cases) {
    describe(`Moon = ${moonLon}°`, () => {
      const r = computeVimshottariDasha(new Date('2000-01-01T00:00:00Z'), moonLon);

      it('returns 9 mahadashas', () => {
        expect(r.mahaDashas).toHaveLength(9);
      });

      it('mahadasha lords follow cyclic order starting from the birth-nakshatra lord', () => {
        const startLord = r.mahaDashas[0]!.lord;
        const startIdx = DASHA_ORDER.indexOf(startLord);
        for (let i = 0; i < 9; i++) {
          const expected = DASHA_ORDER[(startIdx + i) % 9];
          expect(r.mahaDashas[i]!.lord).toBe(expected);
        }
      });

      it('consecutive mahadashas meet exactly (no gap/overlap)', () => {
        for (let i = 1; i < 9; i++) {
          expect(r.mahaDashas[i]!.startDate.getTime())
            .toBe(r.mahaDashas[i - 1]!.endDate.getTime());
        }
      });

      it('total span in [120 − startLordYears, 120] years', () => {
        const startLordYears = DASHA_YEARS[r.mahaDashas[0]!.lord];
        const totalYears =
          (r.mahaDashas[8]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
        expect(totalYears).toBeGreaterThanOrEqual(120 - startLordYears - 1e-6);
        expect(totalYears).toBeLessThanOrEqual(120 + 1e-6);
      });

      it('each mahadasha has 9 antardashas in cyclic order starting from the mahadasha lord', () => {
        for (const md of r.mahaDashas) {
          expect(md.antarDashas).toHaveLength(9);
          const mdIdx = DASHA_ORDER.indexOf(md.lord);
          for (let j = 0; j < 9; j++) {
            expect(md.antarDashas[j]!.lord).toBe(DASHA_ORDER[(mdIdx + j) % 9]);
          }
        }
      });

      it('antardasha durations sum to parent mahadasha duration (± few ms)', () => {
        for (const md of r.mahaDashas) {
          const mdMs = md.endDate.getTime() - md.startDate.getTime();
          const adSum = md.antarDashas.reduce(
            (acc, ad) => acc + (ad.endDate.getTime() - ad.startDate.getTime()),
            0,
          );
          expect(Math.abs(adSum - mdMs)).toBeLessThan(10);
        }
      });

      it('antardasha proportions follow lordYears/120 × parentDuration', () => {
        for (const md of r.mahaDashas) {
          const mdMs = md.endDate.getTime() - md.startDate.getTime();
          for (const ad of md.antarDashas) {
            const expectedMs = (DASHA_YEARS[ad.lord] / 120) * mdMs;
            const actualMs = ad.endDate.getTime() - ad.startDate.getTime();
            // 0.01% tolerance for floating point
            expect(Math.abs(actualMs - expectedMs)).toBeLessThan(Math.max(10, expectedMs * 0.0001));
          }
        }
      });
    });
  }
});

// ── 6. End-to-end real-chart check ────────────────────────────────────────────

describe('end-to-end real chart: Moon per Drik 2025-01-14 18:13:36 UTC / Delhi', () => {
  /**
   * From tests/fixtures/drikpanchang-planets.json:
   *   2025-01-14 @ 18:13:36 UTC — Moon sidereal longitude = 100.78° (Pushya, pada 1–2)
   *
   * Pushya is nakshatra index 7, ruled by Saturn (19 years).
   * Degree within nakshatra: 100.78 − 7·13.333… = 7.447°
   * Elapsed fraction: 7.447 / 13.333 = 0.55853
   * Balance: (1 − 0.55853) × 19 = 8.388 years
   *
   * First mahadasha: Saturn, duration 8.388 years from birth.
   */
  const birthDate = new Date('2025-01-14T18:13:36Z');
  const moonSid = 100.78;
  const r = computeVimshottariDasha(birthDate, moonSid);

  it('birth nakshatra lord is Saturn (Pushya)', () => {
    expect(r.mahaDashas[0]!.lord).toBe('Saturn');
  });

  it('Saturn balance is ≈ 8.388 years (classical derivation)', () => {
    const balYears = (r.mahaDashas[0]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime()) / MS_PER_YEAR;
    expect(balYears).toBeCloseTo(8.388, 2);
  });

  it('second mahadasha is Mercury (follows Saturn in cycle)', () => {
    expect(r.mahaDashas[1]!.lord).toBe('Mercury');
  });

  it('ninth (last) mahadasha is Jupiter (Saturn + 8 in cycle mod 9 = index 6)', () => {
    // Saturn idx in DASHA_ORDER = 7; (7+8)%9 = 6 → Jupiter
    expect(r.mahaDashas[8]!.lord).toBe('Jupiter');
  });
});
