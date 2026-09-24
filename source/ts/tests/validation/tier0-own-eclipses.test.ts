/**
 * @tier 0  NASA/Espenak: Five Millennium Canon (geocentric) and Solar Eclipse
 *          Visibility from Major Cities (local circumstances)
 *
 * Geocentric instants are compared in TT, which removes the canon's own per-row
 * ΔT exactly; a local contact time cannot, so its residual is split at 2003,
 * when Espenak computed these catalogs. A catalog time flagged `r` or `s` is
 * sunrise or sunset with the eclipse in progress, not a contact; so are the
 * values printed beside a flagged maximum.
 */
import { describe, it, expect } from 'vitest';
import { findLunarEclipse, findLocalSolarEclipse, solarViewAt } from '../../src/astronomy/eclipseGeometry';
import { getUpcomingLunarEclipse, getUpcomingSolarEclipse } from '../../src/astronomy/eclipse';
import { searchMoonPhase } from '../../src/astronomy/lunation';
import { ttDaysSinceJ2000 } from '../../src/astronomy/deltaT';
import { shadowAxisGamma, scanMinimum } from '../reference/eclipse-reference';
import { readTestData, readTestDataText } from '../testdata';

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

const canon = readTestData('reference', 'nasa-eclipses.json') as {
  lunar: LunarRow[]; solar: SolarRow[];
};
const localCanon = JSON.parse(
  readTestDataText('reference', 'nasa-eclipse-local.json'),
) as { sites: LocalSite[] };

const DAY_MS = 86_400_000;
const JD_J2000 = 2451545.0;

function ttJulianDateToUtc(jdTt: number): Date {
  const ttDays = jdTt - JD_J2000;
  let ms = Date.UTC(2000, 0, 1, 12) + ttDays * DAY_MS;
  for (let i = 0; i < 3; i++) {
    ms += (ttDays - ttDaysSinceJ2000(new Date(ms))) * DAY_MS;
  }
  return new Date(ms);
}

const utcToTtJulianDate = (date: Date): number => ttDaysSinceJ2000(date) + JD_J2000;

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

describe('Tier 0: lunar eclipses vs the NASA/Espenak canon', () => {
  it('all 457 eclipses of 1901-2100: type, instant, magnitudes, durations', () => {
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
    expect(typeMismatches, 'eclipse type is an invariant, not a tolerance').toEqual([]);

    expect(Math.abs(peak.value), `greatest eclipse (s TT): ${peak.label}`).toBeLessThan(4.5);
    expect(
      Math.abs(penumbralMagnitude.value), `penumbral magnitude: ${penumbralMagnitude.label}`,
    ).toBeLessThan(0.0004);
    expect(
      Math.abs(umbralMagnitude.value), `umbral magnitude: ${umbralMagnitude.label}`,
    ).toBeLessThan(0.0007);
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

describe('Tier 0: the published fields, not the geometry', () => {
  const OBSERVER = { latitude: 28.6139, longitude: 77.2090 };

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
    expect(boundaryRows).toBeLessThan(10);

    expect(
      Math.abs(magnitude.value), `published magnitude vs canon umbral: ${magnitude.label}`,
    ).toBeLessThan(0.0007);

    expect(negatives, 'penumbral eclipses publish a negative magnitude').toBe(169);
    expect(aboveOne, 'total eclipses publish a magnitude above 1').toBe(166);
    expect(obscurationLower, 'shallow partials cover less area than diameter').toBeGreaterThan(0);
    expect(obscurationHigher, 'deep partials cover more area than diameter').toBeGreaterThan(0);
  }, 600_000);

  it('the published solar fields carry magnitude and obscuration the right way round', () => {
    const site = localCanon.sites[0]!;
    const magnitude = new Worst();
    const obscuration = new Worst();
    const notFound: string[] = [];
    let compared = 0;

    for (const row of site.eclipses) {
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
    expect(Math.abs(magnitude.value), `published magnitude: ${magnitude.label}`).toBeLessThan(0.004);
    expect(
      Math.abs(obscuration.value), `published obscuration: ${obscuration.label}`,
    ).toBeLessThan(0.004);
  }, 600_000);
});

describe('Tier 0: solar eclipses, geocentric', () => {
  it('all 452 eclipses of 1901-2100: gamma and the instant of greatest eclipse', () => {
    const gamma = new Worst();
    const peak = new Worst();

    for (const row of canon.solar) {
      const approximate = ttJulianDateToUtc(row.jdGreatestTt).getTime();
      const peakMs = scanMinimum(
        (ms) => Math.abs(shadowAxisGamma(ms)),
        approximate - 1800_000, approximate + 1800_000, 60_000,
      );
      gamma.add(Math.abs(shadowAxisGamma(peakMs)) - Math.abs(row.gamma), row.date);
      peak.add((utcToTtJulianDate(new Date(peakMs)) - row.jdGreatestTt) * 86400, row.date);
    }

    expect(canon.solar.length).toBe(452);
    expect(Math.abs(gamma.value), `gamma (Earth radii): ${gamma.label}`).toBeLessThan(0.0002);
    expect(Math.abs(peak.value), `greatest eclipse (s TT): ${peak.label}`).toBeLessThan(3.0);
  }, 300_000);

  it('type and magnitude at the canon’s own greatest-eclipse point', () => {
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
      expect(eclipse, `${row.date}: no eclipse at the canon's greatest-eclipse point`).not.toBeNull();
      if (eclipse === null) continue;

      const view = solarViewAt(eclipse.peak, location);
      altitude.add(eclipse.peakAltitude - row.greatestSunAltitude, row.date);

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
    expect(Math.abs(magnitude.value), `magnitude: ${magnitude.label}`).toBeLessThan(0.002);
    expect(Math.abs(altitude.value), `sun altitude (deg): ${altitude.label}`).toBeLessThan(1.2);
  }, 300_000);
});

function localToUtcMs(site: LocalSite, date: string, hhmm: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = hhmm.split(':').map(Number) as [number, number];
  return Date.UTC(year, month - 1, day, hour, minute) - site.utcOffsetHours * 3600_000;
}

function localEclipseFor(site: LocalSite, row: LocalRow) {
  const location = { latitude: site.latitude, longitude: site.longitude };
  const localNoon = localToUtcMs(site, row.date, '12:00');
  const conjunction = searchMoonPhase(0, new Date(localNoon - 2 * DAY_MS), 5);
  return conjunction === null ? null : findLocalSolarEclipse(conjunction, location);
}

describe('Tier 0: solar LOCAL circumstances vs NASA’s city catalogs', () => {
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

    expect(Math.abs(begin.value), `first contact (s): ${begin.label}`).toBeLessThan(80);
    expect(Math.abs(maximum.value), `maximum (s): ${maximum.label}`).toBeLessThan(80);
    expect(Math.abs(end.value), `last contact (s): ${end.label}`).toBeLessThan(80);

    expect(
      Math.abs(historical.bias), `1901-2002 bias (s): ${historical.label}`,
    ).toBeLessThan(2);
    expect(Math.abs(historical.value), `1901-2002 max (s): ${historical.label}`).toBeLessThan(50);
    expect(future.bias, `2003-2100 bias (s): ${future.label}`).toBeGreaterThan(5);
    expect(future.bias, `2003-2100 bias (s): ${future.label}`).toBeLessThan(30);

    expect(Math.abs(altitude.value), `sun altitude (deg): ${altitude.label}`).toBeLessThan(0.8);
    expect(Math.abs(azimuth.value), `sun azimuth (deg): ${azimuth.label}`).toBeLessThan(0.8);
    expect(Math.abs(magnitude.value), `magnitude: ${magnitude.label}`).toBeLessThan(0.004);
    expect(Math.abs(obscuration.value), `obscuration: ${obscuration.label}`).toBeLessThan(0.004);
  }, 600_000);

  it('the published solar subtype and description are the eclipse as seen, even at sunrise or sunset', () => {
    const LOCAL_TYPE: Record<string, string> = { p: 'partial', a: 'annular', t: 'total' };
    const typeMismatch: string[] = [];
    const calledInvisible: string[] = [];
    const seenPercent = new Worst();
    let clippedRows = 0;
    for (const site of localCanon.sites) {
      const location = { latitude: site.latitude, longitude: site.longitude };
      for (const row of site.eclipses) {
        const noonMs = localToUtcMs(site, row.date, '12:00');
        const info = getUpcomingSolarEclipse(new Date(noonMs - 2 * DAY_MS), location, 4);
        if (info === null) continue;
        const where = `${site.name} ${row.date}`;
        if (info.subtype !== LOCAL_TYPE[row.localType.toLowerCase()]) typeMismatch.push(`${where} ${info.subtype}`);
        if (/not visible/.test(info.description)) calledInvisible.push(where);
        if (!row.maximumFlag) continue;
        // Beside a flagged maximum NASA prints the sunrise or sunset values, which the description now uses.
        clippedRows++;
        const percent = Number(/(\d+)%/.exec(info.description)![1]);
        seenPercent.add(percent - row.obscuration * 100, where);
      }
    }
    expect(clippedRows).toBe(126);
    expect(typeMismatch, 'local type differs from the catalog').toEqual([]);
    expect(calledInvisible, 'a solar eclipse the search returns is always seen at some phase').toEqual([]);
    expect(Math.abs(seenPercent.value), `described percent vs catalog: ${seenPercent.label}`).toBeLessThan(6);
  }, 600_000);

  it('a site where the eclipse is partial, and a site where it is not visible at all', () => {
    const byName = new Map(localCanon.sites.map((s) => [s.name, s]));
    const sydney = byName.get('Sydney, Australia');
    const london = byName.get('London, England');
    expect(sydney).toBeDefined();
    expect(london).toBeDefined();

    const partialRow = (sydney as LocalSite).eclipses.find((r) => r.date === '2028-07-22');
    expect(partialRow, 'Sydney should be listed for the 2028 Jul 22 eclipse').toBeDefined();
    const partial = localEclipseFor(sydney as LocalSite, partialRow as LocalRow);
    expect(partial).not.toBeNull();
    expect((partial as { kind: string }).kind).toBe((partialRow as LocalRow).localType === 't' ? 'total' : 'partial');

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
