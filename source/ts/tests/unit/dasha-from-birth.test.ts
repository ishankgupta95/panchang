import { describe, it, expect } from 'vitest';
import {
  computeVimshottariDasha,
  computeVimshottariDashaFromBirth,
} from '../../src/jyotish/dasha';
import { getSiderealMoonLongitude } from '../../src/astronomy/moon';

describe('computeVimshottariDashaFromBirth', () => {
  const birth = new Date('1990-06-15T04:30:00Z');

  it('returns the same result as the primitive called with manually-computed moonSid', () => {
    const moonSid = getSiderealMoonLongitude(birth, 'lahiri');
    const direct = computeVimshottariDasha(birth, moonSid);
    const wrapper = computeVimshottariDashaFromBirth(birth);

    expect(wrapper.currentMahaDashaLord).toBe(direct.currentMahaDashaLord);
    expect(wrapper.currentIndex).toBe(direct.currentIndex);
    expect(wrapper.mahaDashas).toHaveLength(direct.mahaDashas.length);
    for (let i = 0; i < wrapper.mahaDashas.length; i++) {
      expect(wrapper.mahaDashas[i]!.lord).toBe(direct.mahaDashas[i]!.lord);
      expect(wrapper.mahaDashas[i]!.startDate.getTime())
        .toBe(direct.mahaDashas[i]!.startDate.getTime());
      expect(wrapper.mahaDashas[i]!.endDate.getTime())
        .toBe(direct.mahaDashas[i]!.endDate.getTime());
    }
  });

  it('defaults to Lahiri ayanamsa', () => {
    const moonSidLahiri = getSiderealMoonLongitude(birth, 'lahiri');
    const expected = computeVimshottariDasha(birth, moonSidLahiri);
    const actual = computeVimshottariDashaFromBirth(birth);
    expect(actual.currentMahaDashaLord).toBe(expected.currentMahaDashaLord);
  });

  it('accepts other ayanamsa systems', () => {
    const moonSidRaman = getSiderealMoonLongitude(birth, 'raman');
    const expected = computeVimshottariDasha(birth, moonSidRaman);
    const actual = computeVimshottariDashaFromBirth(birth, 'raman');
    expect(actual.currentMahaDashaLord).toBe(expected.currentMahaDashaLord);
    expect(actual.mahaDashas[0]!.lord).toBe(expected.mahaDashas[0]!.lord);
  });

  it('returns exactly 9 mahadashas spanning between 100 and 120 years', () => {
    // The first mahadasha is only the balance of the birth-moment dasha, so the
    // total is 120y minus the elapsed part: 100y at worst (Venus almost spent).
    const r = computeVimshottariDashaFromBirth(birth);
    expect(r.mahaDashas).toHaveLength(9);
    const totalMs = r.mahaDashas[8]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime();
    const years = totalMs / (365.25 * 24 * 3600 * 1000);
    expect(years).toBeGreaterThanOrEqual(100);
    expect(years).toBeLessThanOrEqual(120);
  });

  it('antardasha durations sum to parent mahadasha duration (invariant)', () => {
    const r = computeVimshottariDashaFromBirth(birth);
    for (const md of r.mahaDashas) {
      const mdMs = md.endDate.getTime() - md.startDate.getTime();
      const adSum = md.antarDashas.reduce(
        (acc, ad) => acc + (ad.endDate.getTime() - ad.startDate.getTime()),
        0,
      );
      // Floating-point accumulation across 9 year-scale intervals ⇒ up to a few ms.
      expect(Math.abs(adSum - mdMs)).toBeLessThan(10);
    }
  });
});
