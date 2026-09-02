/**
 *   bash go/parity/bench.sh
 *
 * `BenchmarkGate*` in `go/internal/astronomy/bench_gate_test.go` must measure
 * the same "day request": sunrise + sunset + moonrise + moonset + the four
 * element boundary searches (tithi, nakshatra, yoga, karana).
 */
import { performance } from 'node:perf_hooks';
import { LongitudeCache } from '../../ts/src/astronomy/cache';
import { moonElpLongitude } from '../../ts/src/astronomy/elp';
import { heliocentricLongitude } from '../../ts/src/astronomy/vsop87';
import { getTropicalMoonLongitude } from '../../ts/src/astronomy/moon';
import { getTropicalSunLongitude } from '../../ts/src/astronomy/sun';
import { sin as trigSin } from '../../ts/src/astronomy/trig';
import { computeSunrise, computeSunset } from '../../ts/src/astronomy/sunrise';
import { getMoonrise, getMoonset } from '../../ts/src/astronomy/moonrise';
import { clearRiseSetTracks, dayEvents } from '../../ts/src/astronomy/riseSet';
import { findTransitionTime, STANDARD_PRECISION, type ElementAngle } from '../../ts/src/utils/search';
import { normalize360 } from '../../ts/src/utils/angle';
import type { GeoLocation } from '../../ts/src/types/location';

const DAY_MS = 86_400_000;

const LOCATIONS: GeoLocation[] = [
  { latitude: 18.5204, longitude: 73.8567, elevation: 560 },  // Pune
  { latitude: 28.6139, longitude: 77.2090 },                  // Delhi
  { latitude: 13.0827, longitude: 80.2707 },                  // Chennai
  { latitude: 19.0760, longitude: 72.8777 },                  // Mumbai
  { latitude: 22.5726, longitude: 88.3639 },                  // Kolkata
  { latitude: 40.7128, longitude: -74.0060 },                 // New York
  { latitude: 51.5074, longitude: -0.1278 },                  // London
  { latitude: 1.3521, longitude: 103.8198 },                  // Singapore
  { latitude: -33.8688, longitude: 151.2093 },                // Sydney
  { latitude: 64.1466, longitude: -21.9426 },                 // Reykjavik
];

const EPOCH = Date.UTC(2025, 0, 1);

/** The four element angles, which must stay as `panchang.ts` defines them. */
function angles(cache: LongitudeCache): { angle: ElementAngle; span: number }[] {
  const moon = (d: Date) => cache.getMoon(d);
  const sun = (d: Date) => cache.getSun(d);
  return [
    { angle: { angleAt: (d) => moon(d) - sun(d), spanDeg: 12 }, span: 12 },        // tithi
    { angle: { angleAt: (d) => moon(d), spanDeg: 360 / 27 }, span: 360 / 27 },     // nakshatra
    { angle: { angleAt: (d) => moon(d) + sun(d), spanDeg: 360 / 27 }, span: 360 / 27 }, // yoga
    { angle: { angleAt: (d) => moon(d) - sun(d), spanDeg: 6 }, span: 6 },          // karana
  ];
}

function dayRequest(cache: LongitudeCache, location: GeoLocation, dayStartMs: number): number {
  let sink = 0;
  try {
    const sunrise = computeSunrise(new Date(dayStartMs), location);
    sink += sunrise.getTime();
    sink += computeSunset(sunrise, location).getTime();
  } catch { /* polar latitudes have no rise or set */ }
  const mr = getMoonrise(new Date(dayStartMs), location);
  if (mr) sink += mr.getTime();
  const ms = getMoonset(new Date(dayStartMs), location);
  if (ms) sink += ms.getTime();

  for (const { angle, span } of angles(cache)) {
    const idx = Math.floor(normalize360(angle.angleAt(new Date(dayStartMs))) / span);
    try {
      sink += findTransitionTime(
        new Date(dayStartMs), new Date(dayStartMs + 36 * 3600_000), idx,
        (d) => Math.floor(normalize360(angle.angleAt(d)) / span),
        STANDARD_PRECISION.maxIterations, STANDARD_PRECISION.toleranceMs, angle,
      ).getTime();
    } catch { /* SEARCH_DIVERGED is not reachable for these four */ }
  }
  return sink;
}

function timeIt(label: string, iterations: number, body: (i: number) => void): void {
  // Untimed warm-up pass; the Go side gets the same courtesy from `testing`.
  body(0);
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) body(i);
  const elapsedMs = performance.now() - t0;
  console.log(`${label.padEnd(34)} ${(elapsedMs * 1e6 / iterations).toFixed(0).padStart(10)} ns/op   (${iterations} iterations, ${elapsedMs.toFixed(0)} ms)`);
}

function main(): void {
  const loc = LOCATIONS[0]!;

  {
    let sink = 0;
    timeIt('trig.sin', 2_000_000, (i) => { sink += trigSin(i * 1e-6); });
    timeIt('moonElpLongitude', 200_000, (i) => { sink += moonElpLongitude((i % 1000) * 1e-4); });
    timeIt('heliocentricLongitude(earth)', 200_000, (i) => { sink += heliocentricLongitude('earth', (i % 1000) * 36.525); });
    timeIt('getTropicalMoonLongitude', 100_000, (i) => { sink += getTropicalMoonLongitude(new Date(EPOCH + i * 60_000)); });
    timeIt('getTropicalSunLongitude', 100_000, (i) => { sink += getTropicalSunLongitude(new Date(EPOCH + i * 60_000)); });
    {
      const dayIndex = Math.floor(EPOCH / DAY_MS);
      dayEvents('sun', 1, loc, dayIndex);
      dayEvents('moon', 1, loc, dayIndex);
      timeIt('dayEvents(sun) warm track', 20_000, () => { sink += dayEvents('sun', 1, loc, dayIndex).length; });
      // A fresh day each time, so the scan runs instead of hitting SCAN_CACHE.
      timeIt('scan one day (uncached)', 2_000, (i) => {
        clearRiseSetTracks();
        sink += dayEvents('sun', 1, loc, dayIndex + (i % 365)).length;
        sink += dayEvents('moon', 1, loc, dayIndex + (i % 365)).length;
      });
    }
    if (sink === 0) throw new Error('sink');
  }

  timeIt('single day, cold stores', 200, (i) => {
    clearRiseSetTracks();
    const cache = new LongitudeCache('lahiri', 'interpolated');
    dayRequest(cache, loc, EPOCH + (i % 365) * DAY_MS);
  });

  {
    clearRiseSetTracks();
    const cache = new LongitudeCache('lahiri', 'interpolated');
    dayRequest(cache, loc, EPOCH);
    timeIt('single day, warm stores', 3000, (i) => {
      dayRequest(cache, loc, EPOCH + (i % 365) * DAY_MS);
    });
  }

  {
    clearRiseSetTracks();
    const t0 = performance.now();
    let sink = 0;
    for (const location of LOCATIONS) {
      const cache = new LongitudeCache('lahiri', 'interpolated');
      for (let d = 0; d < 365; d++) sink += dayRequest(cache, location, EPOCH + d * DAY_MS);
    }
    const elapsedMs = performance.now() - t0;
    const requests = LOCATIONS.length * 365;
    console.log(`${'batch 10 locations x 1 year'.padEnd(34)} ${(elapsedMs * 1e6 / requests).toFixed(0).padStart(10)} ns/op   (${requests} requests, ${(elapsedMs / 1000).toFixed(2)} s wall)`);
    if (sink === 0) throw new Error('sink');
  }
}

main();
