/**
 * Fixture Generator — panchang-ts Phase 16
 *
 * Generates JSON fixture stubs from the library's computed output.
 * Use the output as a regression baseline or to pre-populate fixtures
 * before manually verifying against DrikPanchang.
 *
 * Usage:
 *   npx tsx scripts/generate-fixtures.ts
 *   npx tsx scripts/generate-fixtures.ts --start 2026-01-01 --end 2026-06-30 --city Delhi
 *
 * Output is written to stdout (redirect to a file):
 *   npx tsx scripts/generate-fixtures.ts > tests/fixtures/my-snapshot.json
 *
 * Fields in generated fixtures:
 *   varaEnglish        — exact, from JS Date weekday (trivially correct)
 *   tithiAtSunrise     — library output (verified against DrikPanchang for many dates)
 *   nakshatraAtSunrise — library output
 *   sunriseHHMM        — library output (±2 min vs DrikPanchang in practice)
 *   sunsetHHMM         — library output
 *   chandramasaName    — library output
 *
 * After generation, mark entries you have manually verified against DrikPanchang
 * by adding "_verified": true to the fixture object.
 */

import { getDailyPanchang } from '../src/core/panchang';

// ── City presets ──────────────────────────────────────────────────────────────

const CITIES: Record<string, { location: { latitude: number; longitude: number }; timezone: number }> = {
  Pune:      { location: { latitude: 18.5204, longitude: 73.8567 }, timezone: 330 },
  Delhi:     { location: { latitude: 28.6139, longitude: 77.209 },  timezone: 330 },
  Chennai:   { location: { latitude: 13.0827, longitude: 80.2707 }, timezone: 330 },
  Mumbai:    { location: { latitude: 19.076,  longitude: 72.8777 }, timezone: 330 },
  Bangalore: { location: { latitude: 12.9716, longitude: 77.5946 }, timezone: 330 },
  'New York':{ location: { latitude: 40.7128, longitude: -74.006 }, timezone: -240 },
  London:    { location: { latitude: 51.5074, longitude: -0.1278 }, timezone: 0   },
};

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name: string, def: string): string {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1]! : def;
}

const startStr = flag('start', '2025-09-01');
const endStr   = flag('end',   '2026-04-30');
const cityName = flag('city',  'Pune');

const city = CITIES[cityName];
if (!city) {
  console.error(`Unknown city "${cityName}". Available: ${Object.keys(CITIES).join(', ')}`);
  process.exit(1);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12));
}

// ── Main loop ─────────────────────────────────────────────────────────────────

const startMs = noonUtc(startStr).getTime();
const endMs   = noonUtc(endStr).getTime();
const results: unknown[] = [];

for (let t = startMs; t <= endMs; t += 86_400_000) {
  const d    = new Date(t);
  const date = d.toISOString().slice(0, 10);

  try {
    const r = getDailyPanchang(d, city.location, { timezone: city.timezone });
    results.push({
      date,
      city: cityName,
      location: city.location,
      timezone: city.timezone,
      expected: {
        varaEnglish:        r.vara.englishName,
        tithiAtSunrise:     r.tithis[0]!.name,
        nakshatraAtSunrise: r.nakshatras[0]!.name,
        sunriseHHMM:        fmt(r.sunrise),
        sunsetHHMM:         fmt(r.sunset),
        chandramasaName:    r.chandramasa.name,
        tithiCountAtLeast:  1,
        nakshatraCountAtLeast: 1,
      },
    });
  } catch (err) {
    // Polar / no-sunrise dates — skip with a note
    results.push({ date, city: cityName, _skip: true, _error: String(err) });
  }
}

console.log(JSON.stringify(results, null, 2));
console.error(`Generated ${results.length} entries for ${cityName} (${startStr} → ${endStr})`);
