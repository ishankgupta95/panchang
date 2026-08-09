/**
 * @tier 0  NASA/Espenak — Five Millennium Canon (geocentric) and Solar Eclipse
 *          Visibility from Major Cities (local circumstances)
 *
 * The acceptance gate for Phase 36.5, and the answer to §36.5's own warning
 * that "solar local circumstances are the thinnest Tier 0 coverage".
 *
 * ## Two fixtures, because one eclipse is two problems
 *
 * | fixture | rows | what it settles |
 * |---|---|---|
 * | `nasa-eclipses.json` | 457 lunar + 452 solar | the whole lunar path; the geocentric half of the solar path |
 * | `nasa-eclipse-local.json` | 788 across 10 cities | the solar path **at a place** — contact times, altitude, azimuth, obscuration |
 *
 * The second exists because the first cannot settle the first question §36.5
 * asks: *when does the partial phase begin at Varanasi?* A lunar eclipse looks
 * the same to everyone who can see the Moon, so the canon's geocentric contact
 * times are the local ones. A solar eclipse is a shadow on a rotating
 * ellipsoid, and contact times differ by minutes between neighbouring towns.
 * A differential test against `astronomy-engine` would not have filled that gap
 * — that is the implementation being removed, and it carries no independent
 * authority.
 *
 * ## Three deliberate choices about *how* the comparison is made
 *
 * **Lunar and geocentric-solar instants are compared in TT.** The canon prints
 * TD (= TT) and carries its own ΔT per row, so comparing in TT removes ΔT from
 * the comparison exactly and leaves position theory alone. ΔT is measured on
 * its own in `tier0-own-deltat.test.ts`, which is §36.0 G's whole point.
 *
 * **Local circumstances cannot do that, and the residual says so.** A local
 * contact time is a function of UT (where the observer is) *and* TT (where the
 * sky is); the two time scales are both genuinely present and ΔT does not
 * cancel. Split at 2003 — when Espenak computed these catalogs — the historical
 * half comes out at −0.7 s of bias and the future half at +17 s, growing
 * smoothly with epoch. That is a ΔT-model difference, not an ephemeris error,
 * and it is asserted as two separate bounds rather than one averaged one.
 *
 * **Horizon-clipped rows are excluded from the comparisons they would corrupt.**
 * A catalog time carrying `r` or `s` is sunrise or sunset with the eclipse in
 * progress — not a contact. The altitude, magnitude and obscuration printed
 * beside a flagged *maximum* belong to that clipped instant too. Comparing them
 * against a geometric maximum produced a 12° altitude "error" that was entirely
 * an artefact of reading the fixture wrong.
 *
 * ## The 1.02 that was not 1.02
 *
 * The first implementation enlarged the two lunar shadow radii by 2%, which is
 * one of the two conventions in circulation. It ran a +0.028 bias on penumbral
 * magnitude and mis-typed two eclipses. Inverting all 457 published magnitudes
 * for the enlargement they imply showed a 2%-on-radii multiplier that is *not
 * constant* (1.0137 umbra against 1.0080 penumbra) and a Danjon-on-Earth-radius
 * multiplier that is (1.00989 and 1.01016), both landing on 1 + 1/85 − 1/594.
 * That is the constant `eclipseGeometry.ts` now carries, and it is Tier 0
 * adjudicating a convention rather than a tolerance being widened.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLunarEclipse, findLocalSolarEclipse, solarViewAt } from '../../src/astronomy/eclipseGeometry';
import { getUpcomingLunarEclipse, getUpcomingSolarEclipse } from '../../src/astronomy/eclipse';
import { searchMoonPhase } from '../../src/astronomy/lunation';
import { ttDaysSinceJ2000 } from '../../src/astronomy/deltaT';
import { shadowAxisGamma, scanMinimum } from '../reference/eclipse-reference';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');

interface LunarRow {
  date: string; jdGreatestTt: number; kind: string; type: string;
  penumbralMagnitude: number; umbralMagnitude: number;
  penumbralDurationMin: number; partialDurationMin: number; totalDurationMin: number;
}
interface SolarRow {
  date: string; jdGreatestTt: number; kind: string; type: string;
  gamma: number; magnitude: number;
  greatestLatitude: number; greatestLongitude: number; greatestSunAltitude: number;
}
interface LocalRow {
  date: string; globalType: string; localType: string;
  begins: string; beginsFlag: string;
  maximum: string; maximumFlag: string;
  ends: string; endsFlag: string;
  sunAltitudeDeg: number; sunAzimuthDeg: number;
  magnitude: number; obscuration: number;
}
interface LocalSite {
  name: string; latitude: number; longitude: number; utcOffsetHours: number;
  eclipses: LocalRow[];
}

const canon = JSON.parse(readFileSync(join(FIXTURES, 'nasa-eclipses.json'), 'utf8')) as {
  lunar: LunarRow[]; solar: SolarRow[];
};
const localCanon = JSON.parse(
  readFileSync(join(FIXTURES, 'nasa-eclipse-local.json'), 'utf8'),
) as { sites: LocalSite[] };

const DAY_MS = 86_400_000;
const JD_J2000 = 2451545.0;

/**
 * A UTC `Date` whose **TT** equals the given Julian Date.
 *
 * Iterated rather than solved, because ΔT is a function of the UT instant being
 * searched for. Three passes are exact to the millisecond — dΔT/dt is under
 * 10⁻⁷, so the fixed point converges immediately.
 */
function ttJulianDateToUtc(jdTt: number): Date {
  const ttDays = jdTt - JD_J2000;
  let ms = Date.UTC(2000, 0, 1, 12) + ttDays * DAY_MS;
  for (let i = 0; i < 3; i++) {
    ms += (ttDays - ttDaysSinceJ2000(new Date(ms))) * DAY_MS;
  }
  return new Date(ms);
}

const utcToTtJulianDate = (date: Date): number => ttDaysSinceJ2000(date) + JD_J2000;

/** Max |value|, and the row it came from, so a failure names the eclipse. */
class Worst {
  value = 0;
  where = '';
  sum = 0;
  count = 0;
  add(delta: number, where: string): void {
    this.sum += delta;
    this.count++;
    if (Math.abs(delta) > Math.abs(this.value)) { this.value = delta; this.where = where; }
  }
  get bias(): number { return this.count === 0 ? 0 : this.sum / this.count; }
  get label(): string {
    return `max ${this.value.toFixed(4)} at ${this.where} (n=${this.count}, bias ${this.bias.toFixed(4)})`;
  }
}

describe('§36.5 Tier 0 — lunar eclipses vs the NASA/Espenak canon', () => {
  it('all 457 eclipses of 1901–2100: type, instant, magnitudes, durations', () => {
    const peak = new Worst();
    const penumbralMagnitude = new Worst();
    const umbralMagnitude = new Worst();
    const penumbralDuration = new Worst();
    const partialDuration = new Worst();
    const totalDuration = new Worst();
    const typeMismatches: string[] = [];
    const notFound: string[] = [];

    for (const row of canon.lunar) {
      const approximate = ttJulianDateToUtc(row.jdGreatestTt);
      const opposition = searchMoonPhase(180, new Date(approximate.getTime() - 3 * DAY_MS), 8);
      const eclipse = opposition === null ? null : findLunarEclipse(opposition);
      if (eclipse === null) { notFound.push(`${row.date} ${row.type}`); continue; }

      peak.add((utcToTtJulianDate(eclipse.peak) - row.jdGreatestTt) * 86400, row.date);
      penumbralMagnitude.add(eclipse.penumbralMagnitude - row.penumbralMagnitude, row.date);
      umbralMagnitude.add(eclipse.umbralMagnitude - row.umbralMagnitude, row.date);
      penumbralDuration.add(
        (eclipse.penumbralEnd.getTime() - eclipse.penumbralBegin.getTime()) / 60_000
          - row.penumbralDurationMin, row.date,
      );
      if (row.partialDurationMin > 0 && eclipse.partialBegin && eclipse.partialEnd) {
        partialDuration.add(
          (eclipse.partialEnd.getTime() - eclipse.partialBegin.getTime()) / 60_000
            - row.partialDurationMin, row.date,
        );
      }
      if (row.totalDurationMin > 0 && eclipse.totalBegin && eclipse.totalEnd) {
        totalDuration.add(
          (eclipse.totalEnd.getTime() - eclipse.totalBegin.getTime()) / 60_000
            - row.totalDurationMin, row.date,
        );
      }

      const expected = row.kind === 'T' ? 'total' : row.kind === 'P' ? 'partial' : 'penumbral';
      if (eclipse.kind !== expected) {
        typeMismatches.push(`${row.date} canon ${row.type} (${expected}) vs ours ${eclipse.kind}`);
      }
    }

    expect(canon.lunar.length).toBe(457);
    expect(notFound, 'every canon eclipse must be found').toEqual([]);
    // **Invariant half.** The eclipse *type* is a name, and TIERS.md puts names
    // in the half that may never move. The 2 mismatches the 2%-on-radii
    // convention produced were the signal that identified it.
    expect(typeMismatches, 'eclipse type is an invariant, not a tolerance').toEqual([]);

    // Numeric-tolerance half. Bounds are the measured maxima of 2026-08-07 plus
    // ~15% headroom, not round numbers.
    expect(Math.abs(peak.value), `greatest eclipse (s TT): ${peak.label}`).toBeLessThan(4.5);
    expect(
      Math.abs(penumbralMagnitude.value), `penumbral magnitude: ${penumbralMagnitude.label}`,
    ).toBeLessThan(0.0004);
    // Re-pinned when `PROBE_COUNT` went 600 → 100,000: 0.000535 → 0.000615.
    // Predicted from the sensitivity rather than accepted on sight — umbral
    // magnitude is a separation divided by 2× the Moon's semidiameter, so 1″ of
    // lunar position is 1/(2 × 932) = 0.00054 of magnitude, and the lunar
    // latitude series moved by up to its own 0.2″ budget, worth 0.0001. The
    // observed 0.00008 shift is that. The Moon's *longitude* error improved over
    // the same change (1.345″ → 1.261″ vs DE441), which is why this moving the
    // other way is worth a sentence: the two are different coordinates.
    expect(
      Math.abs(umbralMagnitude.value), `umbral magnitude: ${umbralMagnitude.label}`,
    ).toBeLessThan(0.0007);
    // The canon prints durations to 0.1 min. A penumbral contact is the
    // shallowest crossing in the problem — the Moon's limb grazes the penumbra's
    // edge, so d(separation)/dt is small there and a milliarcsecond of radius is
    // worth tens of seconds. That is why this bound is the loosest of the three.
    expect(
      Math.abs(penumbralDuration.value), `penumbral duration (min): ${penumbralDuration.label}`,
    ).toBeLessThan(1.2);
    expect(
      Math.abs(partialDuration.value), `partial duration (min): ${partialDuration.label}`,
    ).toBeLessThan(0.5);
    expect(
      Math.abs(totalDuration.value), `total duration (min): ${totalDuration.label}`,
    ).toBeLessThan(1.1);
  }, 300_000);
});

/**
 * Everything above validates the **geometry**. Nothing validated what the
 * panchang layer publishes out of it — and that is exactly how
 * `EclipseInfo.magnitude` carried an *obscuration* (disc area) through two
 * Tier 0 files, 909 canon rows and 8,000-odd tests without one failure: the
 * quantity it should have been was computed, measured against NASA and then not
 * published, while the field bearing its name was fed from somewhere else.
 *
 * A test that reads `findLunarEclipse` cannot catch that. These read the public
 * entry points — the same functions `getDailyPanchang` calls — and compare the
 * fields a consumer actually receives against the canon's own columns.
 */
describe('§36.5 Tier 0 — the published fields, not the geometry', () => {
  /** Magnitude is geocentric; the observer only decides `visibleFromLocation`. */
  const OBSERVER = { latitude: 28.6139, longitude: 77.2090 };

  /**
   * Rows this close to a classification boundary are excluded from the
   * *sign* check only. At |m| or |m−1| under 0.002 the canon's own printed
   * value and ours can sit either side of the line for a reason that is the
   * fixture's four-decimal resolution, not a disagreement — and the numeric
   * comparison beside it, at 3× tighter than this band, still covers them.
   */
  const BOUNDARY_BAND = 0.002;

  it('EclipseInfo.magnitude is the canon’s umbral magnitude, over all 457 lunar eclipses', () => {
    const magnitude = new Worst();
    const notFound: string[] = [];
    const misclassified: string[] = [];
    const outOfRange: string[] = [];
    const penumbralWithObscuration: string[] = [];
    const identical: string[] = [];
    let boundaryRows = 0;
    let negatives = 0;
    let aboveOne = 0;
    let obscurationLower = 0;
    let obscurationHigher = 0;

    for (const row of canon.lunar) {
      const approximate = ttJulianDateToUtc(row.jdGreatestTt);
      const info = getUpcomingLunarEclipse(
        new Date(approximate.getTime() - 3 * DAY_MS), OBSERVER, 6,
      );
      if (info === null || Math.abs(info.peak.getTime() - approximate.getTime()) > DAY_MS) {
        notFound.push(`${row.date} ${row.type}`);
        continue;
      }

      magnitude.add(info.magnitude - row.umbralMagnitude, row.date);

      if (info.magnitude < 0) negatives++;
      if (info.magnitude > 1) aboveOne++;
      if (info.obscuration < 0 || info.obscuration > 1) {
        outOfRange.push(`${row.date} obscuration ${info.obscuration}`);
      }

      // The classification the sign of a magnitude encodes. A clamp into
      // [0, 1] — the obvious "fix" for a negative-looking field — would break
      // every penumbral row here and nothing else in the suite.
      const canonKind = row.kind === 'T' ? 'total' : row.kind === 'P' ? 'partial' : 'penumbral';
      const nearBoundary =
        Math.abs(row.umbralMagnitude) < BOUNDARY_BAND
        || Math.abs(row.umbralMagnitude - 1) < BOUNDARY_BAND;
      if (nearBoundary) {
        boundaryRows++;
      } else {
        const implied = info.magnitude >= 1 ? 'total' : info.magnitude > 0 ? 'partial' : 'penumbral';
        if (implied !== canonKind) {
          misclassified.push(`${row.date} canon ${canonKind} vs magnitude ${info.magnitude}`);
        }
      }

      if (canonKind === 'penumbral' && info.obscuration !== 0) {
        penumbralWithObscuration.push(`${row.date} ${info.obscuration}`);
      }
      // Area against diameter: the two must differ, and must cross. A build
      // that wired both fields to one source passes every bound above and
      // fails here.
      if (canonKind === 'partial' && row.umbralMagnitude > 0.05 && row.umbralMagnitude < 0.95) {
        if (info.obscuration === info.magnitude) identical.push(row.date);
        if (info.obscuration < info.magnitude) obscurationLower++;
        if (info.obscuration > info.magnitude) obscurationHigher++;
      }
    }

    expect(notFound, 'every canon eclipse must be reachable through the public path').toEqual([]);
    expect(misclassified, 'the sign of the published magnitude encodes the type').toEqual([]);
    expect(outOfRange, 'obscuration is an area fraction and lives in [0, 1]').toEqual([]);
    expect(
      penumbralWithObscuration, 'a penumbral eclipse touches no umbra, so umbral obscuration is 0',
    ).toEqual([]);
    expect(identical, 'obscuration and magnitude are different quantities').toEqual([]);
    // Fewer than a handful of rows may sit in the exclusion band; if this ever
    // grows the band is hiding something rather than describing the fixture.
    expect(boundaryRows).toBeLessThan(10);

    /**
     * The bound is the geometry's own (0.0007, measured 0.000615 over the same
     * 457 rows), because the published field is a copy of the number that test
     * measures. It is stated as the *same* bound deliberately: if these two
     * ever diverge, the panchang layer has started transforming a value it
     * should only be forwarding.
     */
    expect(
      Math.abs(magnitude.value), `published magnitude vs canon umbral: ${magnitude.label}`,
    ).toBeLessThan(0.0007);

    // The canon's 457 rows are 166 total / 122 partial / 169 penumbral, and its
    // umbral magnitude runs −1.068 to 1.8628. The published field must show the
    // same shape rather than a tidy [0, 1] one.
    expect(negatives, 'penumbral eclipses publish a negative magnitude').toBe(169);
    expect(aboveOne, 'total eclipses publish a magnitude above 1').toBe(166);
    expect(obscurationLower, 'shallow partials cover less area than diameter').toBeGreaterThan(0);
    expect(obscurationHigher, 'deep partials cover more area than diameter').toBeGreaterThan(0);
  }, 600_000);

  it('the published solar fields carry magnitude and obscuration the right way round', () => {
    /**
     * The local catalogs print **both** columns for the same instant, which is
     * what makes them able to adjudicate a swap: a build with the two fields
     * exchanged still lands inside every bound in this file except these two.
     *
     * One site rather than ten. The geometry behind these numbers is already
     * measured over all 788 rows above; what is unvalidated is a field
     * assignment, and a field assignment is not site-dependent — so this pays
     * for one site's worth of public-path searching and no more.
     */
    const site = localCanon.sites[0]!;
    const magnitude = new Worst();
    const obscuration = new Worst();
    const notFound: string[] = [];
    let compared = 0;

    for (const row of site.eclipses) {
      // Rows whose maximum is horizon-clipped describe sunrise or sunset, not
      // the geometric maximum the published fields report — excluded here for
      // the same reason the geometry test excludes them.
      if (row.maximumFlag) continue;
      const maximumMs = localToUtcMs(site, row.date, row.maximum);
      const info = getUpcomingSolarEclipse(
        new Date(maximumMs - 2 * DAY_MS),
        { latitude: site.latitude, longitude: site.longitude },
        4,
      );
      if (info === null || Math.abs(info.peak.getTime() - maximumMs) > 6 * 3600_000) {
        notFound.push(`${site.name} ${row.date}`);
        continue;
      }
      compared++;
      magnitude.add(info.magnitude - row.magnitude, `${site.name} ${row.date}`);
      obscuration.add(info.obscuration - row.obscuration, `${site.name} ${row.date}`);
    }

    expect(notFound, 'every catalogued local eclipse must be reachable publicly').toEqual([]);
    expect(compared).toBeGreaterThan(20);
    // Same bound as the geometry comparison: printed to three decimals, and the
    // published fields forward the geometry unchanged.
    expect(Math.abs(magnitude.value), `published magnitude: ${magnitude.label}`).toBeLessThan(0.004);
    expect(
      Math.abs(obscuration.value), `published obscuration: ${obscuration.label}`,
    ).toBeLessThan(0.004);
  }, 600_000);
});

describe('§36.5 Tier 0 — solar eclipses, geocentric', () => {
  it('all 452 eclipses of 1901–2100: gamma and the instant of greatest eclipse', () => {
    const gamma = new Worst();
    const peak = new Worst();

    for (const row of canon.solar) {
      const approximate = ttJulianDateToUtc(row.jdGreatestTt).getTime();
      // Greatest eclipse is where the shadow axis passes closest to the Earth's
      // centre. Searched ±30 min around the canon's instant — 700× the residual
      // this test then measures, so the window cannot be flattering the answer,
      // and a real disagreement would pin the minimum to an edge and fail loudly.
      const peakMs = scanMinimum(
        (ms) => Math.abs(shadowAxisGamma(ms)),
        approximate - 1800_000, approximate + 1800_000, 60_000,
      );
      gamma.add(Math.abs(shadowAxisGamma(peakMs)) - Math.abs(row.gamma), row.date);
      peak.add((utcToTtJulianDate(new Date(peakMs)) - row.jdGreatestTt) * 86400, row.date);
    }

    expect(canon.solar.length).toBe(452);
    // Gamma is the sharpest single check in this file. The canon publishes it to
    // four decimals and it is sensitive to both directions *and* both distances,
    // which a longitude comparison is not. Measured max **0.00015** (2023-10-14),
    // i.e. 1.5 units in the last digit NASA prints — and that is with the 0.4″
    // truncation budget; at 0.2″ it was 0.0001. Nothing else in this file is
    // anywhere near its own bound, which is the point of keeping this one.
    expect(Math.abs(gamma.value), `gamma (Earth radii): ${gamma.label}`).toBeLessThan(0.0002);
    expect(Math.abs(peak.value), `greatest eclipse (s TT): ${peak.label}`).toBeLessThan(3.0);
  }, 300_000);

  it('type and magnitude at the canon’s own greatest-eclipse point', () => {
    /**
     * The canon prints the greatest-eclipse point to the **whole degree** — up
     * to 55 km of latitude. For an eclipse whose central path is wider than
     * that, an observer placed there is inside it and the local type is the
     * global type. For a near-hybrid eclipse the path is a few kilometres wide
     * and the rounding puts the observer outside it, so the type flips to
     * partial for a reason that is a property of the fixture's resolution and
     * not of this library.
     *
     * The scope is therefore stated as a measured threshold rather than
     * asserted over rows the fixture cannot adjudicate: at |magnitude − 1| ≥
     * 0.025 there are 380 rows and **zero** mismatches; at ≥ 0.02 there are
     * four, and at 0 there are 33. Every excluded row still contributes to the
     * gamma and instant checks above, which need no observer at all.
     *
     * Four further rows are excluded from the *magnitude* comparison for a
     * different and sharper reason. A *central* eclipse whose published Sun
     * altitude at greatest eclipse is near zero is one whose axis is tangent to
     * the Earth's limb: 1950 Mar 18 (γ = −0.9988), 2003 May 31 (+0.9960),
     * 2043 Oct 03 (−1.0102) and 2044 Feb 28 (−0.9954) — all four at |γ| ≈ 1.
     * There the observer is at grazing incidence, so 55 km of coordinate
     * rounding moves the slant range to the Moon by nearly the full 55 km and
     * the apparent-diameter ratio with it: the worst of the four carries 0.032
     * of magnitude error against a ceiling of 0.0015 for every other row in
     * scope. Their *type* is still asserted. A partial eclipse also
     * publishes altitude zero — that is its definition, the greatest-eclipse
     * point being where the Sun sits on the horizon — but a partial's magnitude
     * is the covered fraction of the solar diameter, which is not
     * range-sensitive, and those rows agree to 0.0007. So the exclusion is
     * on central-and-grazing, not on altitude alone.
     */
    const NEAR_CENTRAL_BAND = 0.025;
    const GRAZING_ALTITUDE_DEG = 5;
    const magnitude = new Worst();
    const altitude = new Worst();
    const typeMismatches: string[] = [];
    let inScope = 0;
    let excludedNearCentral = 0;
    let excludedGrazing = 0;

    for (const row of canon.solar) {
      const approximate = ttJulianDateToUtc(row.jdGreatestTt);
      const location = { latitude: row.greatestLatitude, longitude: row.greatestLongitude };
      const conjunction = searchMoonPhase(0, new Date(approximate.getTime() - 2 * DAY_MS), 5);
      expect(conjunction, `no conjunction near ${row.date}`).not.toBeNull();
      const eclipse = findLocalSolarEclipse(conjunction as Date, location);
      // The greatest-eclipse point sees the deepest eclipse there is; if we find
      // nothing there, the geometry is wrong somewhere much earlier.
      expect(eclipse, `${row.date}: no eclipse at the canon's greatest-eclipse point`).not.toBeNull();
      if (eclipse === null) continue;

      const view = solarViewAt(eclipse.peak, location);
      altitude.add(eclipse.peakAltitude - row.greatestSunAltitude, row.date);

      // The canon reports the ratio of apparent diameters for a central eclipse
      // and the covered fraction of the Sun's diameter for a partial one. Those
      // are different quantities that share a column, and comparing our
      // covered-fraction against their diameter-ratio would show a spurious
      // ~0.02 error on every total eclipse.
      const ours = row.kind === 'P'
        ? eclipse.magnitude
        : view.moonSemidiameter / view.sunSemidiameter;

      if (Math.abs(row.magnitude - 1) < NEAR_CENTRAL_BAND) { excludedNearCentral++; continue; }

      const expected = row.kind === 'T' ? ['total']
        : row.kind === 'A' ? ['annular']
          : row.kind === 'H' ? ['total', 'annular'] : ['partial'];
      if (!expected.includes(eclipse.kind)) {
        typeMismatches.push(`${row.date} canon ${row.type} vs ours ${eclipse.kind}`);
      }

      if (row.kind !== 'P' && row.greatestSunAltitude < GRAZING_ALTITUDE_DEG) {
        excludedGrazing++;
        continue;
      }
      inScope++;
      magnitude.add(ours - row.magnitude, row.date);
    }

    expect(inScope).toBe(376);
    expect(excludedNearCentral).toBe(72);
    expect(excludedGrazing).toBe(4);
    expect(typeMismatches, 'solar eclipse type is an invariant').toEqual([]);
    // Measured max 0.00145 — the whole-degree coordinate rounding, and the same
    // ceiling for every row in scope rather than a scatter.
    expect(Math.abs(magnitude.value), `magnitude: ${magnitude.label}`).toBeLessThan(0.002);
    // Altitude is printed to the whole degree and the *site* is printed to the
    // whole degree, so ~1° is the fixture's own resolution, not ours.
    expect(Math.abs(altitude.value), `sun altitude (deg): ${altitude.label}`).toBeLessThan(1.2);
  }, 300_000);
});

/** Local standard time on the row's date → the UT millisecond it denotes. */
function localToUtcMs(site: LocalSite, date: string, hhmm: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = hhmm.split(':').map(Number) as [number, number];
  return Date.UTC(year, month - 1, day, hour, minute) - site.utcOffsetHours * 3600_000;
}

/** The local solar eclipse this library reports for a catalog row, if any. */
function localEclipseFor(site: LocalSite, row: LocalRow) {
  const location = { latitude: site.latitude, longitude: site.longitude };
  const localNoon = localToUtcMs(site, row.date, '12:00');
  const conjunction = searchMoonPhase(0, new Date(localNoon - 2 * DAY_MS), 5);
  return conjunction === null ? null : findLocalSolarEclipse(conjunction, location);
}

describe('§36.5 Tier 0 — solar LOCAL circumstances vs NASA’s city catalogs', () => {
  it('finds every eclipse the catalogs list, at all 10 sites', () => {
    const missing: string[] = [];
    let rows = 0;
    for (const site of localCanon.sites) {
      for (const row of site.eclipses) {
        rows++;
        if (localEclipseFor(site, row) === null) missing.push(`${site.name} ${row.date}`);
      }
    }
    expect(rows).toBe(788);
    expect(localCanon.sites.length).toBe(10);
    expect(missing, 'a catalogued local eclipse this library cannot find').toEqual([]);
  }, 300_000);

  it('contact times, altitude, azimuth, magnitude and obscuration', () => {
    const begin = new Worst();
    const maximum = new Worst();
    const end = new Worst();
    const altitude = new Worst();
    const azimuth = new Worst();
    const magnitude = new Worst();
    const obscuration = new Worst();
    const historical = new Worst();
    const future = new Worst();
    let clipped = 0;

    for (const site of localCanon.sites) {
      for (const row of site.eclipses) {
        const eclipse = localEclipseFor(site, row);
        if (eclipse === null) continue;
        const where = `${site.name} ${row.date}`;

        if (row.beginsFlag) clipped++;
        else begin.add((eclipse.partialBegin.getTime() - localToUtcMs(site, row.date, row.begins)) / 1000, where);
        if (row.endsFlag) clipped++;
        else end.add((eclipse.partialEnd.getTime() - localToUtcMs(site, row.date, row.ends)) / 1000, where);

        // Everything below is published *at maximum*. A flagged maximum is
        // sunrise or sunset, and the altitude/magnitude/obscuration beside it
        // describe that instant rather than the geometric maximum.
        if (row.maximumFlag) { clipped++; continue; }
        const delta = (eclipse.peak.getTime() - localToUtcMs(site, row.date, row.maximum)) / 1000;
        maximum.add(delta, where);
        (Number(row.date.slice(0, 4)) < 2003 ? historical : future).add(delta, where);
        altitude.add(eclipse.peakAltitude - row.sunAltitudeDeg, where);
        azimuth.add(eclipse.peakAzimuth - row.sunAzimuthDeg, where);
        magnitude.add(eclipse.magnitude - row.magnitude, where);
        obscuration.add(eclipse.obscuration - row.obscuration, where);
      }
    }

    expect(clipped).toBeGreaterThan(300);

    // Contact times are printed to the minute, so ±30 s is baked in and the
    // median |error| of 15 s is exactly what rounding to the minute produces.
    // Measured maxima 2026-08-07: C1 62.3 s, max 61.6 s, C4 56.5 s.
    //
    // Raised 70 → 80 when ΔT stopped extrapolating Espenak–Meeus across the
    // measured era. These catalogs are Espenak's, computed with Espenak–Meeus
    // ΔT, so correcting ours necessarily walks away from them — by the ~6.5 s
    // the two models now differ by. The worst cases moved to 2055–2056 (C1
    // 73.7 s, max 71.4 s), which is the far future, where NASA's ΔT is itself
    // an extrapolation and nobody's value is measured.
    //
    // What did *not* move is the historical half, and that is the one that
    // means anything: its bias and its 50 s max below are unchanged. If a real
    // geometry error ever appears it will show up there, not here.
    expect(Math.abs(begin.value), `first contact (s): ${begin.label}`).toBeLessThan(80);
    expect(Math.abs(maximum.value), `maximum (s): ${maximum.label}`).toBeLessThan(80);
    expect(Math.abs(end.value), `last contact (s): ${end.label}`).toBeLessThan(80);

    /**
     * The ΔT split. These catalogs were computed in 2003; after that Espenak's
     * ΔT is a prediction and ours is a different one, and a local circumstance
     * cannot be expressed in a single time scale that makes the difference
     * cancel. Binned by 20 years the residual is flat and near zero through
     * 1900–1999 (−4.3 to +2.1 s, inside the sampling noise of minute-level
     * printing) and then climbs: +4.6 s in the 2000s, +14.6 in the 2020s,
     * +25.8 in the 2040s. Smooth in epoch, zero where ΔT is observed — that is
     * a ΔT-model difference, not an ephemeris error, and it is the same
     * exposure `deltaT.ts` documents.
     *
     * The historical bound is therefore the real accuracy statement, and it is
     * the one that would catch a regression.
     */
    expect(
      Math.abs(historical.bias), `1901–2002 bias (s): ${historical.label}`,
    ).toBeLessThan(2);
    expect(Math.abs(historical.value), `1901–2002 max (s): ${historical.label}`).toBeLessThan(50);
    expect(future.bias, `2003–2100 bias (s): ${future.label}`).toBeGreaterThan(5);
    expect(future.bias, `2003–2100 bias (s): ${future.label}`).toBeLessThan(30);

    // Altitude and azimuth are printed to the whole degree; the Sun moves up to
    // 0.25° in the minute the maximum is quantised to. Measured 0.594 / 0.651.
    expect(Math.abs(altitude.value), `sun altitude (deg): ${altitude.label}`).toBeLessThan(0.8);
    expect(Math.abs(azimuth.value), `sun azimuth (deg): ${azimuth.label}`).toBeLessThan(0.8);
    // Printed to three decimals. Measured 0.0022 / 0.0029.
    expect(Math.abs(magnitude.value), `magnitude: ${magnitude.label}`).toBeLessThan(0.004);
    expect(Math.abs(obscuration.value), `obscuration: ${obscuration.label}`).toBeLessThan(0.004);
  }, 600_000);

  it('a site where the eclipse is partial, and a site where it is not visible at all', () => {
    /**
     * §36.5 names both cases explicitly, and calls the second "the case a
     * solver gets wrong silently" — nothing else in this file would catch a
     * solver that answered *some* eclipse for every observer.
     *
     * The negative case is only sound because these catalogs are complete over
     * 0001–3000 CE: an eclipse absent from a city's list is absent because the
     * city sees nothing, not because the row was dropped. `eclipse-local-fetch.mjs`
     * asserts its own parsed row count against an independently counted one for
     * exactly this reason.
     */
    const byName = new Map(localCanon.sites.map((s) => [s.name, s]));
    const sydney = byName.get('Sydney, Australia');
    const london = byName.get('London, England');
    expect(sydney).toBeDefined();
    expect(london).toBeDefined();

    // 2028 Jul 22 is total over Australia and Sydney is close to the path.
    const partialRow = (sydney as LocalSite).eclipses.find((r) => r.date === '2028-07-22');
    expect(partialRow, 'Sydney should be listed for the 2028 Jul 22 eclipse').toBeDefined();
    const partial = localEclipseFor(sydney as LocalSite, partialRow as LocalRow);
    expect(partial).not.toBeNull();
    expect((partial as { kind: string }).kind).toBe((partialRow as LocalRow).localType === 't' ? 'total' : 'partial');

    // Every 20th-century eclipse the canon lists that London is *not* listed
    // for: this library must see nothing there either.
    const listed = new Set((london as LocalSite).eclipses.map((r) => r.date));
    const invisible = canon.solar
      .filter((r) => r.date >= '1901' && r.date < '2000' && !listed.has(r.date));
    expect(invisible.length).toBeGreaterThan(40);

    const wronglyVisible: string[] = [];
    for (const row of invisible.slice(0, 60)) {
      const approximate = ttJulianDateToUtc(row.jdGreatestTt);
      const conjunction = searchMoonPhase(0, new Date(approximate.getTime() - 2 * DAY_MS), 5);
      if (conjunction === null) continue;
      const location = { latitude: (london as LocalSite).latitude, longitude: (london as LocalSite).longitude };
      const eclipse = findLocalSolarEclipse(conjunction, location);
      // Either London is outside the penumbra entirely, or the whole event
      // happens below its horizon — which is what the catalogs exclude on.
      if (eclipse !== null && (eclipse.beginAltitude > 0 || eclipse.endAltitude > 0)) {
        wronglyVisible.push(`${row.date} ${row.type}`);
      }
    }
    expect(
      wronglyVisible,
      'reported an eclipse at London that NASA says is not visible from London',
    ).toEqual([]);
  }, 300_000);
});
