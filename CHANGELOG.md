# panchang-ts

## 2.4.0

**Minor release — Phase 28 Wave 1 complete: Panchaka Rahita + Do Ghati
Muhurta.** Closes the dainika-parity work scoped in Phase 28; backwards
compatible (additive to `DailyPanchangResult` only).

### Highlights

- **Panchaka Rahita Muhurta** — `DailyPanchangResult.panchakaRahita`
  exposes the slices of the Hindu day FREE of Panchaka (i.e. Moon
  outside the last five nakshatras: Dhanishtha → Revati). Empty when
  Panchaka pervades the whole day; one-or-more `TimePeriod[]` entries
  otherwise. Useful for "when can I start construction today?" queries.
- **Do Ghati Muhurta** — `DailyPanchangResult.doGhatiMuhurta` enumerates
  the 15 daytime + 15 nighttime ~48-min slots covering sunrise→sunset and
  sunset→nextSunrise. Each slot carries its classical deity name (Rudra,
  Uraga, Mitra … Tvashta, Samirana) and `auspicious | inauspicious |
  neutral` quality. Parallel slot system to Choghadiya, but at 2-ghati
  resolution.

### Sourcing finding (Do Ghati)

DrikPanchang's Do Ghati table presents the **same 30-name sequence on every
weekday** — there is **no vara-based rotation** of the kind Choghadiya /
Gowri Panchangam use. Verified against drikpanchang.com/muhurat/daily/
do-ghati-muhurat.html for Wed 2026-04-15 and Mon 2026-04-20 producing
identical name sequences. This matches the classical Brahmana / Smriti
enumeration where each muhurta is associated with a fixed presiding deity
independent of the day of the week. `computeDoGhati` therefore takes no
`varaIndex` parameter; sourcing is cited inline in
[src/core/doGhati.ts:3-21](src/core/doGhati.ts#L3-L21).

### New API surface

```ts
// Pure module — usable independently of getDailyPanchang
export function computePanchakaRahita(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (utc: Date) => { siderealLongitude: number },
): TimePeriod[];

export function computeDoGhati(
  sunriseUtc: Date,
  sunsetUtc: Date,
  nextSunriseUtc: Date,
  nameFn: (slotIndex: number) => string,
): DoGhatiInfo;
```

### Type surface additions

- `DoGhatiSlot extends TimePeriod` — `index: number; name: string;
  quality: ChoghadiyaQuality; qualityName: string`.
- `DoGhatiInfo { day: DoGhatiSlot[]; night: DoGhatiSlot[] }` — 15 + 15
  slots (always exactly 30 total).
- `DailyPanchangResult.panchakaRahita: TimePeriod[]` (always present;
  `[]` when Panchaka pervades the day).
- `DailyPanchangResult.doGhatiMuhurta: DoGhatiInfo` (always present).

### i18n

- `doGhatiNames: readonly string[30]` added to `Translations` and to
  `en.ts` / `hi.ts`. Day-slot names indices 0–14, night-slot names
  indices 15–29 (matches DrikPanchang's published order).

### Breaking changes

None.

### Test count

**5,441** tests passing across 60 files (was ~5,393 in v2.3.0 →
**+~48**). New files: `tests/unit/panchakaRahita.test.ts`,
`tests/unit/doGhati.test.ts`,
`tests/integration/panchakaRahita-doGhati-wiring.test.ts`.

---

## 2.3.0

**Minor release — Phase 28 Wave 1 (cont): Anandadi Yoga + six classical
Vara/Tithi/Nakshatra yogas (Dwipushkar, Tripushkar, Jwalamukhi, Aadal,
Vidaal, Ravi).** Backwards compatible.

### Highlights

- **Anandadi Yoga** — `DailyPanchangResult.anandadiYoga` exposes the
  28-name Vara × Nakshatra cycle yoga (Ananda, Kaladanda, Dhumra …
  Vardhamana). Per-yoga `quality` (`auspicious | inauspicious |
  neutral`) follows the classical Smarta classification.
- **Six new entries in `SpecialYogaInfo[]`** — the existing four
  (`amrit_siddhi`, `sarvartha_siddhi`, `ravi_pushya`, `guru_pushya`)
  are joined by:
  - `dwipushkar` — Bhadra-tithi (Dvitiya/Saptami/Dwadashi) + Sun/Tue/Sat
    + nakshatra ∈ {Mrigashira, Chitra, Dhanishtha}. Results doubled.
  - `tripushkar` — same vara/tithi gate + nakshatra ∈ {Krittika,
    Punarvasu, Uttara Phalguni, Vishakha, Uttara Ashadha, Purva
    Bhadrapada}. Results tripled.
  - `jwalamukhi` — inauspicious; tithi+nakshatra lookup table per
    classical Muhurta-chintamani.
  - `aadal` / `vidaal` — Tamil-tradition vara × nakshatra subsets;
    Aadal auspicious, Vidaal inauspicious.
  - `ravi` — Sunday + nakshatras 4–12 from current Sun's nakshatra.

### New API surface

```ts
export function computeAnandadiYoga(
  varaIndex: number,
  nakshatraIndex: number,
  lang?: Language,
): AnandadiYogaInfo;

// Special yogas remain accessed via getDailyPanchang().specialYogas
// — the SpecialYogaInfo.type union is extended (see below).
```

### Type surface additions

- `AnandadiYogaInfo { index: number; name: string; quality:
  ChoghadiyaQuality; qualityName: string }` — index in 0–27.
- `SpecialYogaInfo.type` widened from 4 names to 10 (additive — the
  four prior values still in the union).
- `DailyPanchangResult.anandadiYoga: AnandadiYogaInfo`.
- `InstantPanchangResult.anandadiYoga: AnandadiYogaInfo`.

### i18n

- `anandadiYogaNames: readonly string[28]` and 6 new keys in
  `specialYogaNames` (`dwipushkar`, `tripushkar`, `jwalamukhi`,
  `aadal`, `vidaal`, `ravi`) added to `en.ts` / `hi.ts`.

### Breaking changes

None. Consumers who exhaustively `switch` on `SpecialYogaInfo['type']`
will need to handle the six new cases (TS2367 from `assertNever`-style
defaults), but this is a strict superset — old switches still compile
and behave correctly when no new yoga is detected.

### Test count

**~5,393** tests passing (was ~5,269 in v2.2.0 → **+~124**). New files:
`tests/unit/anandadiYoga.test.ts`, `tests/unit/specialYogas-v23.test.ts`,
`tests/integration/anandadiYoga-wiring.test.ts`,
`tests/integration/specialYogas-v23-wiring.test.ts`.

---

## 2.2.0

**Minor release — Phase 28 Wave 1: Tarabala, Varjyam, Ganda Mula,
Madhyahna + Pratah/Sayahna Sandhya, Dinamana/Ratrimana labels.**
Backwards compatible. Closes the bulk of the visible gap with
[drikpanchang.com](https://www.drikpanchang.com/panchang/day-panchang.html)'s
dainika panchang panel.

### Highlights

- **Tarabala** — 9-tara cycle (Janma, Sampat, Vipat, Kshema, Pratyari,
  Sadhaka, Vadha, Mitra, Ati-Mitra) keyed off the consumer's
  `janmaNakshatra`. Cousin to Chandra Balam — only populated when the
  birth nakshatra is supplied. New `options.janmaNakshatra?: number`
  parallel to existing `options.janmaRashi`.
- **Varjyam** — forbidden ~96-min window per day, nakshatra-keyed. Uses
  the BPHS 27-entry offset table (`VARJYAM_OFFSET_GHATIKAS` in
  [src/utils/constants.ts](src/utils/constants.ts)) anchored to nakshatra
  start. May span midnight; clamps cleanly to the next-sunrise window.
  `null` only when the start lies entirely outside the Hindu day.
- **Ganda Mula** — Moon-in-root-nakshatra detection at sunrise. The 6
  root nakshatras are Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati;
  Mula and Jyeshtha tagged `severity: 'severe'`, the rest `'mild'`.
  `gandaMula.active === false` for the 21 non-root nakshatras.
- **Madhyahna** — solar noon as a ±24-min ritual window (one classical
  muhurta wide). New field `DailyPanchangResult.madhyahna: TimePeriod`.
- **Pratah Sandhya** / **Sayahna Sandhya** — dawn / dusk twilight
  windows (sunrise ±24min, sunset ±24min). Two new fields.
- **Dinamana** / **Ratrimana labels** — classical aliases of
  `dayDurationMinutes` / `nightDurationMinutes` exposed as
  `dinamanaMinutes` / `ratrimanaMinutes` for parity with DrikPanchang
  panel labelling.

### New API surface

```ts
export function computeTarabala(
  janmaNakshatraIndex: number,
  transitNakshatraIndex: number,
  lang?: Language,
): TarabalaInfo;

export function computeVarjyam(
  currentNakshatra: NakshatraInfo,
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (utc: Date) => { siderealLongitude: number },
): TimePeriod | null;

export function computeGandaMula(
  currentNakshatraIndex: number,
  lang?: Language,
): GandaMulaInfo;

export function computeMadhyahna(sunriseUtc: Date, sunsetUtc: Date): TimePeriod;
export function computePratahSandhya(sunriseUtc: Date): TimePeriod;
export function computeSayahnaSandhya(sunsetUtc: Date): TimePeriod;
```

### Type surface additions

- `TarabalaInfo { taraIndex: number; taraName: string; quality:
  'auspicious' | 'inauspicious'; englishName: string }`.
- `GandaMulaInfo { active: boolean; nakshatraName?: string; severity?:
  'mild' | 'severe' }`.
- `PanchangOptions.janmaNakshatra?: number` (0–26, parallel to
  `janmaRashi`).
- `DailyPanchangResult` gains: `tarabala?` (only when `janmaNakshatra`
  set), `varjyam: TimePeriod | null`, `gandaMula: GandaMulaInfo`,
  `madhyahna: TimePeriod`, `pratahSandhya: TimePeriod`, `sayahnaSandhya:
  TimePeriod`, `dinamanaMinutes: number`, `ratrimanaMinutes: number`.
- `InstantPanchangResult` gains: `tarabala?`, `gandaMula:
  GandaMulaInfo`.

### Sourcing

- `VARJYAM_OFFSET_GHATIKAS` — 27-entry per-nakshatra offset table sourced
  from BPHS / Muhurta-chintamani; cited inline in
  [src/utils/constants.ts](src/utils/constants.ts).

### i18n

- `tarabalaNames: readonly string[9]`, `gandaMulaNakshatraNames` (subset
  of nakshatraNames re-exposed), and severity / quality strings added to
  `en.ts` / `hi.ts`.

### Breaking changes

None.

### Test count

**~5,269** tests passing (was 5,149 in v2.1.0 → **+~120**). New files:
`tests/unit/tarabala.test.ts`, `tests/unit/varjyam.test.ts`,
`tests/unit/gandaMula.test.ts`, plus four `*-wiring.test.ts` integration
files for orchestrator pickup.

---

## 2.1.0

**Minor release — regional festival expansion + state-slug `FestivalRegion`
scheme.** Backwards compatible: pre-v2.1 region strings continue to work with
a one-shot deprecation warning; removal scheduled for v3.

### Highlights

- `FestivalRegion` expanded **9 → 22** values, consistent state-slug naming
  (`'tamil'` → `'tamil-nadu'`, `'bengal'` → `'west-bengal'`, `'north-india'`
  dropped in favour of explicit states).
- **+14 new registered festivals** covering Maharashtra, Karnataka, Andhra
  Pradesh, Telangana, Odisha, Rajasthan, UP, Bihar, Haryana, Himachal,
  Uttarakhand, Assam, Goa, Madhya Pradesh, Nepal, and Jharkhand.
- New `FestivalRule.regions?` allow-list, new `SankrantiRegionalRule.regions`
  (was single-valued `region`), new `tithiRange` gate for weekday-in-paksha
  rules (Varamahalakshmi), new transit-adjacent festival emission via
  `nextDaySankrantiRashi` / `prevDaySankrantiRashi` context (Lohri + Raja
  Parba 3-day arc).
- Orphan-region sweep test — every `FestivalRegion` value must attach to a
  specific scoped festival. Guards against reintroducing dead regions like
  the pre-v2.1 `'maharashtra'` (defined in the type, unused in practice).

### Breaking changes

None. See *Migration* below for deprecation warnings and the one key rename.

### Back-compat / deprecations

Legacy region identifiers resolved via [src/core/regionAlias.ts](src/core/regionAlias.ts)
with a one-shot `console.warn` per distinct legacy value per process:

| Legacy value  | Canonical value | Removal |
|---------------|-----------------|---------|
| `'tamil'`     | `'tamil-nadu'`  | v3      |
| `'bengal'`    | `'west-bengal'` | v3      |
| `'north-india'` | `'all'`       | v3      |

(`'north-india'` collapses to `'all'` because its sole previous attachment —
Makar Sankranti — is genuinely pan-Indian. Northern-specific festivals like
Lohri / Govardhan Puja / Bhai Dooj are now attached to explicit state slugs.)

### New regions

**South:** `'tamil-nadu'`, `'kerala'`, `'karnataka'`, `'andhra-pradesh'`,
`'telangana'`.
**East:** `'west-bengal'`, `'odisha'`, `'assam'`, `'bihar'`, `'jharkhand'`.
**West:** `'gujarat'`, `'maharashtra'`, `'goa'`, `'rajasthan'`.
**North / Central:** `'punjab'`, `'haryana'`, `'himachal-pradesh'`,
`'uttarakhand'`, `'uttar-pradesh'`, `'madhya-pradesh'`.
**Neighbour:** `'nepal'`.

### New festivals

- **Sankranti-anchored:** `bohag_bihu` (Assam, Mesha), `kati_bihu` (Assam,
  Tula), `raja_sankranti` (Odisha, Karka), `harela` (Uttarakhand, Karka),
  `sair` (Himachal, Kanya).
- **Transit-adjacent:** `lohri` (Punjab/Haryana/Himachal, day before Makara),
  `raja_pahili` (Odisha, day before Karka), `raja_basi` (Odisha, day after
  Karka).
- **Regional tithi-based:** `gudi_padwa` (Maharashtra/Goa), `gangaur`
  (Rajasthan), `karaga` (Karnataka), `bonalu` (Telangana, Sundays in
  Ashadha), `hariyali_teej`, `kajari_teej`, `hartalika_teej`,
  `govardhan_puja`, `bhai_dooj`, `phagli` (Himachal), `bathukamma_start`
  (Telangana, Bhadrapada Amavasya), `bathukamma_saddula` (Telangana, Ashwin
  Shukla Navami).
- **Weekday-in-paksha:** `varamahalakshmi` (Karnataka/AP/Telangana/TN — last
  Friday of Shravana Shukla paksha before Purnima).
- **Pan-Indian addition:** `jagannath_rath_yatra` (Ashadha Shukla Dwitiya).

### Re-scoped / renamed (non-breaking outputs)

- **`makar_sankranti`**: `region: 'north-india'` → `regions: ['all']`.
  It's pan-Indian and was mistagged.
- **`singh_sankranti`**: `region: 'all'` → `regions: ['odisha', 'bihar',
  'jharkhand', 'nepal']`. Primarily observed there; not a pan-Indian
  festival.
- **Festival key rename** `bihu` → `magh_bihu` for consistency with the new
  `bohag_bihu` / `kati_bihu` siblings. **Translated display name unchanged**
  (`'Magh Bihu'` / `'माघ बिहू'`). Callers indexing the internal key `'bihu'`
  directly (rare — most code reads `festival.name` which is the translated
  string) must update to `'magh_bihu'`.

### Type surface additions

- `LegacyFestivalRegion` exported (union of the 3 deprecated strings).
- `FestivalRule.regions?: readonly FestivalRegion[]` (internal rule type,
  used when writing new rules).
- `FestivalRule.tithiRange?: [number, number]` — gate `(masa + vara)` rules
  to a tithi window.
- `FestivalComputeContext.nextDaySankrantiRashi?: number | null`.
- `FestivalComputeContext.prevDaySankrantiRashi?: number | null`.
- `PanchangOptions.region` and `InstantPanchangOptions.region` widened to
  `FestivalRegion | LegacyFestivalRegion`.

### Docs

- `README.md` — updated FestivalRegion enum listing, LegacyFestivalRegion
  mapping, new "Regional Festival Filtering" code example (default vs scoped
  vs Lohri), and a region-to-festival-keys reference table.

### Test count

**5,149** tests passing across 46 files (was 5,073 in v2.0.1 → **+76**).
New unit file [tests/unit/regionAlias.test.ts](tests/unit/regionAlias.test.ts)
covers alias resolution + one-shot warning semantics. Orphan-region sweep
replaces a weak `r.length > 0` check with 21 explicit `(region →
expectedScopedKey)` assertions + a compile-time exhaustiveness check.

### Migration from 2.0.x

```ts
// Before
getDailyPanchang(date, loc, { timezone: 330, region: 'tamil' });
getDailyPanchang(date, loc, { timezone: 330, region: 'bengal' });
getDailyPanchang(date, loc, { timezone: 330, region: 'north-india' });

// After (recommended — removes the deprecation warning)
getDailyPanchang(date, loc, { timezone: 330, region: 'tamil-nadu' });
getDailyPanchang(date, loc, { timezone: 330, region: 'west-bengal' });
getDailyPanchang(date, loc, { timezone: 330, region: 'all' });

// Festival key rename (rare — only if you index festivalNames directly):
// t.festivalNames['bihu']      // old
// t.festivalNames['magh_bihu'] // new
// (If you read festival.name, nothing changes — still 'Magh Bihu' / 'माघ बिहू'.)
```

---

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
