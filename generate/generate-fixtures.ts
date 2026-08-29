/**
 * Fixture stubs from our own output; mark an entry you have checked by hand
 * against the reference almanac with "_verified": true.
 *
 *   npx tsx generate/generate-fixtures.ts
 *   npx tsx generate/generate-fixtures.ts --start 2026-01-01 --end 2026-06-30 --city Delhi
 *   npx tsx generate/generate-fixtures.ts > testdata/my-snapshot.json
 */

import { getDailyPanchang } from '../source/ts/src/core/panchang';

const CITIES: Record<string, { location: { latitude: number; longitude: number }; timezone: number }> = {
  Pune:      { location: { latitude: 18.5204, longitude: 73.8567 }, timezone: 330 },
  Delhi:     { location: { latitude: 28.6139, longitude: 77.209 },  timezone: 330 },
  Chennai:   { location: { latitude: 13.0827, longitude: 80.2707 }, timezone: 330 },
  Mumbai:    { location: { latitude: 19.076,  longitude: 72.8777 }, timezone: 330 },
  Bangalore: { location: { latitude: 12.9716, longitude: 77.5946 }, timezone: 330 },
  'New York':{ location: { latitude: 40.7128, longitude: -74.006 }, timezone: -240 },
  London:    { location: { latitude: 51.5074, longitude: -0.1278 }, timezone: 0   },
};

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

function fmt(d: Date): string {
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12));
}

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
        varaEnglish:        r.angas.vara.englishName,
        tithiAtSunrise:     r.angas.tithis[0]!.name,
        nakshatraAtSunrise: r.angas.nakshatras[0]!.name,
        sunriseHHMM:        fmt(r.sun.rise),
        sunsetHHMM:         fmt(r.sun.set),
        chandramasaName:    r.calendar.chandramasa.name,
        tithiCountAtLeast:  1,
        nakshatraCountAtLeast: 1,
      },
    });
  } catch (err) {
    // Polar dates, where the sun does not rise.
    results.push({ date, city: cityName, _skip: true, _error: String(err) });
  }
}

console.log(JSON.stringify(results, null, 2));
console.error(`Generated ${results.length} entries for ${cityName} (${startStr} → ${endStr})`);
