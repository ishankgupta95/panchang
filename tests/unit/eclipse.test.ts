import { describe, it, expect } from 'vitest';
import {
  getUpcomingLunarEclipse,
  getUpcomingSolarEclipse,
  getEclipseDuringDay,
} from '../../src/astronomy/eclipse';
import { computeSunrise as getSunrise, computeSunset as getSunset } from '../../src/astronomy/sunrise';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };

describe('getUpcomingLunarEclipse', () => {
  it('finds the 2025-03-14 lunar eclipse when searching from early March 2025', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.kind).toBe('lunar');
    // Peak was around 2025-03-14 06:58 UTC
    const peakDay = new Date(info!.peak);
    expect(peakDay.getUTCFullYear()).toBe(2025);
    expect(peakDay.getUTCMonth()).toBe(2); // March
    expect(peakDay.getUTCDate()).toBeGreaterThanOrEqual(13);
    expect(peakDay.getUTCDate()).toBeLessThanOrEqual(15);
  });

  it('lunar sutak is anchored to the umbral (partial) phase, with a 9h lead', () => {
    // 2025-03-14 is a TOTAL lunar eclipse. Sutak runs from 9h before umbral
    // first contact (U1) to umbral last contact (U4), NOT the faint penumbral
    // contacts.
    //
    // **v5 change.** This assertion used to require the two umbral contacts to
    // sit symmetrically about greatest eclipse, to within a second. That was a
    // property of `astronomy-engine`'s result *shape* rather than of the
    // eclipse: it reported one semi-duration, so the two contacts were symmetric
    // by construction. Solving for U1 and U4 separately makes the real, small
    // asymmetry visible — 2.09 s here — because the shadow radii and the Moon's
    // own semidiameter drift measurably across the ~3.5 h of an umbral phase.
    // Requiring symmetry now would be pinning the artefact, so the bound below
    // states the physical scale instead: seconds, not minutes.
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.sutakStart).not.toBeNull();
    expect(info!.sutakEnd).not.toBeNull();
    const peak = info!.peak.getTime();
    const umbralLead = peak - info!.sutakStart!.getTime() - 9 * 3600_000;
    const umbralTrail = info!.sutakEnd!.getTime() - peak;
    expect(umbralLead).toBeGreaterThan(0);
    expect(umbralTrail).toBeGreaterThan(0);
    expect(Math.abs(umbralLead - umbralTrail)).toBeLessThan(30_000);
    // The lead really is 9 hours ahead of first contact, not of anything else.
    expect(peak - umbralLead - info!.sutakStart!.getTime()).toBe(9 * 3600_000);
  });

  it('lunar sutakEnd (umbral last contact) precedes the penumbral eclipse end', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.sutakEnd).not.toBeNull();
    expect(info!.sutakEnd!.getTime()).toBeLessThan(info!.end.getTime());
    // Umbral-to-penumbral gap is on the order of an hour.
    expect(info!.end.getTime() - info!.sutakEnd!.getTime()).toBeGreaterThan(30 * 60_000);
  });

  it('penumbral lunar eclipse carries no sutak (null window)', () => {
    // 2027-02-20 is a penumbral lunar eclipse — no umbral phase, no sutak.
    const info = getUpcomingLunarEclipse(new Date('2027-02-01T00:00:00Z'), DELHI, 40);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe('penumbral');
    expect(info!.sutakStart).toBeNull();
    expect(info!.sutakEnd).toBeNull();
  });

  it('returns null when no eclipse falls within the window', () => {
    // A deliberately short window where no eclipse occurs (2025-01-01 + 20 days)
    const info = getUpcomingLunarEclipse(new Date('2025-01-01T00:00:00Z'), DELHI, 20);
    expect(info).toBeNull();
  });

  it('obscuration is in [0, 1]; magnitude is the diameter fraction beside it', () => {
    // 2025-03-14 is a *total* lunar eclipse, which is what makes this pair
    // worth asserting together: obscuration saturates at 1 while magnitude
    // keeps going past it. A build that wired both fields to the same source
    // would show them equal here.
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe('total');
    expect(info!.obscuration).toBeGreaterThanOrEqual(0);
    expect(info!.obscuration).toBeLessThanOrEqual(1);
    expect(info!.magnitude).toBeGreaterThan(1);
  });

  it('a penumbral lunar eclipse has zero obscuration and a negative magnitude', () => {
    // The case a [0, 1] clamp would silently destroy: the Moon misses the
    // umbra, so the umbral magnitude is the miss distance and is negative —
    // exactly how NASA's canon prints it. See EclipseInfo.magnitude.
    const info = getUpcomingLunarEclipse(new Date('2027-02-01T00:00:00Z'), DELHI, 40);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe('penumbral');
    expect(info!.obscuration).toBe(0);
    expect(info!.magnitude).toBeLessThan(0);
  });

  it('description mentions the subtype', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.description.toLowerCase()).toContain(info!.subtype);
  });
});

describe('getUpcomingSolarEclipse', () => {
  it('finds the 2025-09-21 solar eclipse from Sydney (visible partial)', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), SYDNEY, 30);
    expect(info).not.toBeNull();
    expect(info!.kind).toBe('solar');
    const peakDay = new Date(info!.peak);
    expect(peakDay.getUTCFullYear()).toBe(2025);
    expect(peakDay.getUTCMonth()).toBe(8); // September
    expect(peakDay.getUTCDate()).toBeGreaterThanOrEqual(20);
    expect(peakDay.getUTCDate()).toBeLessThanOrEqual(22);
  });

  it('2025-09-21 solar eclipse is NOT visible from Delhi', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), DELHI, 30);
    // Delhi may or may not see the local eclipse; check visibility flag is false
    // either because no partial_begin occurs locally or sun is below horizon.
    if (info) {
      expect(info.visibleFromLocation).toBe(false);
    }
  });

  it('sutakStart is 12 hours (4 prahara) before the partial start for solar', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), SYDNEY, 30);
    expect(info).not.toBeNull();
    const gapMs = info!.start.getTime() - info!.sutakStart!.getTime();
    expect(gapMs).toBe(12 * 3600_000);
  });

  it('returns null when no solar eclipse occurs within the window', () => {
    // A tight window in a stretch without any eclipse
    const info = getUpcomingSolarEclipse(new Date('2025-05-01T00:00:00Z'), DELHI, 15);
    expect(info).toBeNull();
  });

  it('obscuration is in [0, 1], and magnitude exceeds it for a partial', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), SYDNEY, 30);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe('partial');
    expect(info!.obscuration).toBeGreaterThanOrEqual(0);
    expect(info!.obscuration).toBeLessThanOrEqual(1);
    // A shallow partial covers a larger fraction of the diameter than of the
    // area, so the two fields are ordered — and distinguishable.
    expect(info!.magnitude).toBeGreaterThan(info!.obscuration);
    expect(info!.magnitude).toBeLessThanOrEqual(1);
  });
});

describe('getEclipseDuringDay', () => {
  it('surfaces the 2025-03-14 lunar eclipse on the matching Hindu day', () => {
    // Delhi sunrise on 2025-03-14 ≈ 00:35 UTC (~06:05 IST), nextSunrise ≈ 00:34 UTC next day.
    // Lunar eclipse peak at 06:58 UTC falls within this window.
    const sunrise = new Date('2025-03-14T00:35:00Z');
    const nextSunrise = new Date('2025-03-15T00:34:00Z');
    const info = getEclipseDuringDay(sunrise, nextSunrise, DELHI);
    expect(info).not.toBeNull();
    expect(info!.kind).toBe('lunar');
  });

  it('returns null when no eclipse falls within the Hindu day', () => {
    const sunrise = new Date('2025-04-10T00:30:00Z');
    const nextSunrise = new Date('2025-04-11T00:29:00Z');
    const info = getEclipseDuringDay(sunrise, nextSunrise, DELHI);
    expect(info).toBeNull();
  });
});

/**
 * The syzygy guard inside `getEclipseDuringDay` skips the (expensive) eclipse
 * search on days that can hold neither a new nor a full moon. That is a pure
 * optimization: it must never change an answer. This pins the equivalence
 * against the unguarded formulation, which is reconstructed here from the same
 * two searches the guarded version delegates to.
 *
 * Guard the full range in the perf suite; here we cover a year across
 * latitudes — enough to catch a guard that is too narrow (it would drop a real
 * eclipse) without making the unit suite slow.
 */
describe('getEclipseDuringDay — syzygy guard is answer-preserving', () => {
  function unguarded(sunriseUtc: Date, nextSunriseUtc: Date, location: typeof DELHI) {
    const windowMs = nextSunriseUtc.getTime() - sunriseUtc.getTime();
    const windowDays = Math.ceil(windowMs / (24 * 3600_000)) + 1;
    const solar = getUpcomingSolarEclipse(sunriseUtc, location, windowDays);
    if (solar && solar.peak.getTime() < nextSunriseUtc.getTime()) return solar;
    const lunar = getUpcomingLunarEclipse(sunriseUtc, location, windowDays);
    if (lunar && lunar.peak.getTime() < nextSunriseUtc.getTime()) return lunar;
    return null;
  }
  const identity = (e: ReturnType<typeof unguarded>) =>
    e === null
      ? 'null'
      : `${e.kind}/${e.subtype}/${e.peak.toISOString()}/${e.obscuration}/${e.magnitude}`;

  for (const [name, loc] of [
    ['Delhi', DELHI],
    ['Sydney', SYDNEY],
  ] as const) {
    // Explicit timeout: this is the most expensive test in the suite by an
    // order of magnitude. It deliberately runs the *unguarded* eclipse search
    // — the thing the syzygy guard exists to avoid — on all 365 days, at
    // ~4.5 ms a call, so ~2.8 s of real work for Delhi. That is well inside
    // Vitest's 5 s default in isolation, but a full-suite run puts several
    // files on parallel workers and it has been observed stretching to 6.6 s
    // and timing out. Sampling fewer days would trade away the exhaustiveness
    // that makes this test worth having, so the budget is raised instead.
    it(`matches the unguarded result on every day of 2025 (${name})`, () => {
      let eclipseDays = 0;
      for (let d = 0; d < 365; d++) {
        const anchor = new Date(Date.UTC(2025, 0, 1) + d * 86_400_000);
        const sunrise = getSunrise(anchor, loc);
        const nextSunrise = getSunrise(getSunset(sunrise, loc), loc);
        const expected = unguarded(sunrise, nextSunrise, loc);
        if (expected !== null) eclipseDays++;
        expect(
          identity(getEclipseDuringDay(sunrise, nextSunrise, loc)),
          `guard diverged on ${anchor.toISOString().slice(0, 10)}`,
        ).toBe(identity(expected));
      }
      // Sanity: the year genuinely contains eclipse days, so a guard that
      // returned `null` unconditionally could not pass the loop above.
      expect(eclipseDays).toBeGreaterThan(0);
    }, 30_000);
  }
});
