# panchang-ts

## 2.0.0

**Major release — correctness fixes + Drik-aligned API.** This release ships
the full set of audit findings from the v1.0.0 pre-publish review (v1.0.0
was never published to npm). Several breaking changes; see *Migration* below.

### Breaking changes

1. **`getDailyPanchang` return type is now `DailyPanchangResult | null`.**
   Polar locations on dates with no sunrise / no sunset return `null` instead
   of throwing `PanchangError(NO_SUNRISE)`. The low-level `computeSunrise` /
   `computeSunset` primitives still throw — only the high-level surface was
   changed so callers can branch on `result === null` without try/catch.
2. **`getUpcomingLunarEclipse(fromUtc, location, withinDays)`** — argument
   order now matches `getUpcomingSolarEclipse` and `getEclipseDuringDay`.
   `location` was the optional 3rd argument in v1.0.0 and is now the
   required 2nd argument.
3. **Transliteration aligned to DrikPanchang.com.** Public string outputs
   change in these 11 places:
   - Tithi: `Pratipad` → `Pratipada`
   - Yoga: `Vishkamba` → `Vishkambha`, `Ayushman` → `Ayushmana`
   - Nakshatra: `Dhanishta` → `Dhanishtha`
   - Chandra Masa: `Ashwin` → `Ashwina`
   - Vara (all 7): `Ravivara` → `Raviwara`, `Somavara` → `Somawara`,
     `Mangalavara` → `Mangalawara`, `Budhavara` → `Budhawara`,
     `Guruvara` → `Guruwara`, `Shukravara` → `Shukrawara`,
     `Shanivara` → `Shaniwara`. (Hindi i18n unchanged — Devanagari was
     already correct.)
   String comparisons in caller code that hard-code the old names will need
   to be updated.

### Bug fixes (correctness)

- **Vara (weekday) was wrong for east-of-IST sunrises.** `getDailyPanchang`
  computed weekday from `sunriseUtc.getUTCDay()`, returning the *previous*
  day's weekday whenever local sunrise occurred before the timezone offset
  (Delhi summer mornings, Singapore / Sydney / Tokyo year-round). All
  weekday-keyed downstream fields — Rahu Kalam, Yamaganda, Gulika Kalam,
  Choghadiya, Hora, durMuhurta — silently inherited this bug.
  Fix: shift sunriseUtc by the configured timezone before reading
  `getUTCDay()`. `getInstantPanchang` uses a longitude-derived LMT offset
  for the same shift since it has no explicit timezone parameter.
- **Moonset returned the previous lunation's setting.** On days where the
  moon rises late and sets the following morning (typical winter solstice),
  searching from `localMidnightUtc` returned the previous moon's set time
  instead of the moonset paired with this day's moonrise. Fix: search from
  `moonriseUtc ?? localMidnightUtc`.
- **Eclipse sutak windows aligned to classical Smarta convention.** Solar:
  9 h → 12 h (4 prahara); Lunar: 3 h → 9 h (3 prahara).

### New features

- **Parashurama Jayanti** added to the festival registry — fires on
  Vaishakha Shukla Tritiya alongside Akshaya Tritiya (madhyahna-vyapini).
- **Masik Karthigai** monthly observance added — fires whenever Krittika
  nakshatra prevails any time during the Hindu day (sunrise / midday /
  sunset / nishita sample), matching Drik's broader rule rather than a
  strict at-sunrise check.

### Test fixtures — provenance overhauled

- `drikpanchang-diaspora.json` was previously library-self-seeded
  (admitted in `_meta.generator: "library-snapshot"`). All 15 entries
  now scraped from DrikPanchang.com (NYC, London, Sydney, Dubai,
  Singapore × 3 dates each — geoname-ids documented in `_meta.source`).
- `drikpanchang-precise.json` non-sunrise fields (tithi, nakshatra,
  chandramasa) now Drik-verified for all 15 unique dates.
- Renamed `drikpanchang-india.json` → `structural-india.json` and
  `drikpanchang-world.json` → `structural-world.json` — these files only
  assert calendar-derived weekday + structural counts, not Drik values.
  The misleading "drikpanchang-" prefix is now reserved for true
  Drik-sourced fixtures.
- New [tests/fixtures/README.md](tests/fixtures/README.md) documents the
  provenance of every fixture and codifies a no-self-seeding rule.

### Test count

5,073 tests passing across 45 files.

### Migration from 1.0.0 (or 0.7.0)

```ts
// Before
const result = getDailyPanchang(date, location, opts);     // throws on polar
result.vara.name === 'Mangalavara'
const e = getUpcomingLunarEclipse(from, 30, location);

// After
const result = getDailyPanchang(date, location, opts);     // null on polar
if (result === null) { /* polar — handle */ }
result.vara.name === 'Mangalawara'                         // note 'w' not 'v'
const e = getUpcomingLunarEclipse(from, location, 30);     // (from, location, days)
```

---

## 1.0.0

**Stable API.** This release begins the semver compatibility promise: every
symbol re-exported from `panchang-ts` is now a stable contract, and any
breaking change will require a v2 major bump.

**Drop-in upgrade from v0.7.0** for almost all users. No renames, no removed
exports, no changed defaults, no changed return shapes. Phase 18 added new
APIs (`computeChandraBalam`, `computeVimshottariDashaFromBirth`); Phase 19
added docs, tests, and JSDoc only. **One numeric output change** to flag —
see *Behavior change vs v0.7.0* below.

### Behavior change vs v0.7.0

`computePlanetaryPositions(...).rahu` and `.ketu` switched from the **true
node** (Meeus + perturbation series, ~±0.05° accuracy) to the **mean node**
(Meeus Ch. 47 polynomial, typically ±0.5° / worst-case ±2° vs the true
node). This aligns with classical Vedic practice and Drik's published
values.

**Impact:**
- `rahu.siderealLongitude` / `ketu.siderealLongitude` shift by ≤2°
- `rahu.rashi` — almost never changes (rashis are 30° wide)
- `rahu.nakshatra` / `pada` — *can* change in edge cases (nakshatras are
  ~13.3° wide)
- `computeVimshottariDasha*` is **unaffected** — dasha is computed from the
  Moon's longitude, not Rahu's
- All other planets are unchanged

If you depend on Rahu/Ketu degree values matching v0.7.0 exactly, this
release will produce different numbers. If you depend on Rahu/Ketu matching
Drik or other Vedic almanacs, this release will produce *better* numbers.

### What's in v1

- **Pancha Anga** — Tithi, Nakshatra, Yoga, Karana, Vara with end-times
- **Lunar calendar** — Chandra Masa (Purnimanta default + Amanta) with Adhika
  detection, Vikram & Shaka Samvat
- **Muhurta** — Brahma, Abhijit, Choghadiya (16 slots), Gowri Panchangam
  (16 slots), Hora (24 slots), Dur Muhurta
- **Inauspicious periods** — Rahu Kalam, Gulika Kalam, Yamaganda, Panchaka
- **Special Yogas** — Amrit Siddhi, Sarvartha Siddhi, Ravi Pushya, Guru Pushya
- **Festivals** — 24 major pan-Indian festivals + recurring Ekadashi /
  Pradosha / Sankranti (Adhika months auto-skipped)
- **Jyotish** — all 9 graha positions (sidereal, Rahu/Ketu on mean node),
  Vimshottari Dasha (from birth moment or Moon longitude), Antardasha
  breakdown, Chandra Balam
- **Astronomy utilities** — Sunrise, Sunset, Moonrise, Moonset, Sidereal
  Sun/Moon longitude, Ayanamsa

### Validation

- 4,864 tests passing
- Drik-verified across 2025–2026 (Delhi, Chennai, Mumbai, Bangalore, Pune)
- Sunrise/Sunset ≤29 s observed vs Drik minute-midpoint (±45 s test tolerance)
- Tithi / Nakshatra / Yoga / Karana end-times max 2.01 min drift, ±3 min
  tolerance (20 assertions)
- Planetary positions (Sun–Saturn) ≤0.02° vs Drik sidereal
- 12 Drik-verified festival dates (2025–2026)
- Bundle parses cleanly with the official Hermes JS frontend
  (`npm run test:hermes` via `hermes-parser`)

### Documented tradeoff

Festival detection uses **tithi-at-sunrise**. Festivals that Drik resolves
via tithi-at-midnight (Krishna Janmashtami, Maha Shivaratri, Diwali/Lakshmi
Puja), madhyahna-vyapini (Ganesh Chaturthi edge years, Akshaya Tritiya
2026), or kshaya-tithi handling (Ugadi 2026-03-19) can drift ±1 day from
Drik's canonical date. See the README §Festival Detection for the full
caveat set.

### Notable changes since v0.5.x (pre-0.7 users only)

- Default masa system is now `purnimanta` (North Indian). Pass
  `masaSystem: 'amanta'` for the South Indian convention.
- Kundli/birth-chart module was removed in v0.6 — to be developed as a
  separate package.

### Naming convention (stable from v1)

- `get*` — simple retrievers returning a single value at an instant, and
  the two top-level panchang entry points.
- `compute*` — synthesize multi-field structured results from derived
  astronomical inputs.
