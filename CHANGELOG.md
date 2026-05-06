# panchang-ts

## 3.1.0

**Minor release — Phase 30 Wave 3: Advanced Astrology + Muhurta Engine.**
Adds the post-kundli surface — six additional divisional charts, planetary
aspects, six-fold Shadbala strength, two more doshas, three additional
dasha systems, a configurable muhurta scoring engine with 13 stock rules,
and a calendar-conversion / yearly-listings module. All additive on top
of v3.0 — every prior export keeps the same shape.

### Highlights

- **6 new divisional charts** — `computeDivisionalChart(birthDate, location, divisional)`
  for **D2 Hora** (wealth), **D3 Drekkana** (siblings), **D7 Saptamsa** (children),
  **D10 Dasamsa** (career), **D12 Dwadasamsa** (parents), **D30 Trimsamsa**
  (misfortune). D9 (Navamsa) routes through the same unified API for
  consistency. Each follows its classical per-rashi-type rule from BPHS Ch. 6;
  D30 uses the non-uniform 5-segment split with Mars / Saturn / Jupiter /
  Mercury / Venus rulership (no Sun / Moon segments).
- **`computeAspects`** — Drishti (planetary aspects) per BPHS Ch. 26. Every
  graha aspects the 7th house from itself; Mars adds 4th + 8th, Jupiter
  adds 5th + 9th, Saturn adds 3rd + 10th. Optional `nodeAspects: '5-and-9'`
  extends Rahu / Ketu with Jupiter-like aspects (BV Raman / KP convention).
- **`computeShadbala`** — six-fold strength for the 7 visible grahas in
  Virupas (Sthana, Dig, Kala, Chesta, Naisargika, Drik). Simplified analytic
  model targeting ~5% agreement with ProKerala / PyJHora reference
  calculators.
- **`computeKaalSarp`** — Kaal Sarp Dosha detection with all 12 named
  subtypes (Anant, Kulik, Vasuki, Shankhpal, Padma, Mahapadma, Takshak,
  Karkotak, Shankhachud, Ghatak, Vishdhar, Sheshnag — by Rahu's house).
  Surfaces a `partial` flag when 6 of 7 visible planets fall within the
  Rahu-Ketu axis (paritha / dosha-bhanga indicator).
- **`computePitruDosha`** — surfaces the two highest-frequency triggers
  (Sun + Rahu / Ketu conjunction; Sun + Saturn in 9th house).
- **3 additional dasha systems:**
  - **Ashtottari** — 108-year, 8-lord cycle (no Ketu) per Satya Acharya.
    `computeAshtottariDasha(birthDate, moonSiderealLon)`.
  - **Yogini** — 36-year cycle of 8 yoginis (Mangala, Pingala, Dhanya,
    Bhramari, Bhadrika, Ulka, Siddha, Sankata) with planetary lords.
    `computeYoginiDasha(birthDate, moonSiderealLon)`.
  - **Chara (Jaimini)** — sign-based dasha with 9-8-7 years per modality
    (movable / fixed / dual). `computeCharaDasha(birthDate, location)`.
- **Muhurta scoring engine.** `scoreMuhurta(date, location, rule, options)`
  and `findAuspiciousDates(rule, start, end, location, options)` evaluate
  any rule against the live panchang. **13 stock rules** ship: vivah,
  grihaPravesh, namakarana, vidyarambh, vahanKharidi, annaprashan, mundan,
  upanayanam, karnavedha, aksharabhyasam, seemantham, shopOpening,
  travelStart. Hard exclusions (Bhadra / Ekadashi / Eclipse / Adhika /
  Ganda Mula / Panchaka / paksha mismatch) zero the score; auspicious /
  inauspicious axes shift it ±10 / ±15. Special yogas add ±5.
- **Calendar conversion APIs:**
  - `convertGregorianToHindu(date, location, options)` → tithi / masa /
    paksha / samvat / vara at sunrise.
  - `convertHinduToGregorian({ vikramSamvat, masaIndex, paksha,
    pakshaTithi }, location, options)` → matching Gregorian dates.
  - `getKaliYugaYear(date)` → integer KY year (epoch 18 Feb 3102 BCE).
  - `getHinduNewYear(year, region, location, options)` → Chaitra Shukla
    Pratipada or regional Mesha-Sankranti anchor (Tamil Nadu / Kerala /
    Punjab / Bengal / Assam).
  - `getEkadashiDatesForYear(year, location, options)` → ~24 Date[].
  - `getSankrantisForYear(year, location, options)` → 12 SankrantiEvent[].
  - `getFestivalsInRange(start, end, location, options)` → FestivalDay[].
  - `getUpcomingEclipses(fromDate, location, count?)` → EclipseInfo[].

### New API surface

```ts
// Charts
export function computeDivisionalChart(
  birthDate: Date,
  location: GeoLocation,
  divisional: 'D2' | 'D3' | 'D7' | 'D9' | 'D10' | 'D12' | 'D30',
  options?: BirthChartOptions,
): DivisionalChart;

// Aspects + Shadbala
export function computeAspects(chart: BirthChart, options?: AspectsOptions): AspectMap;
export function computeShadbala(
  birthDate: Date, location: GeoLocation, options?: BirthChartOptions,
): ShadbalaResult;

// Doshas
export function computeKaalSarp(chart: BirthChart): KaalSarpDoshaInfo;
export function computePitruDosha(chart: BirthChart): PitruDoshaInfo;

// Dashas
export function computeAshtottariDasha(birthDate: Date, moonSiderealLon: number): VimshottariDashaResult;
export function computeYoginiDasha(birthDate: Date, moonSiderealLon: number): YoginiDashaResult;
export function computeCharaDasha(birthDate: Date, location: GeoLocation, ayanamsa?: AyanamsaType): CharaDashaResult;

// Muhurta engine
export function scoreMuhurta(
  date: Date, location: GeoLocation, rule: MuhurtaRule, options: MuhurtaScoreOptions,
): MuhurtaScore;
export function findAuspiciousDates(
  rule: MuhurtaRule, start: Date, end: Date,
  location: GeoLocation, options: MuhurtaScoreOptions & { includeFailures?: boolean },
): MuhurtaDay[];

// Calendar conversion
export function convertGregorianToHindu(
  date: Date, location: GeoLocation, options: ConvertOptions,
): HinduCalendarCoords;
export function convertHinduToGregorian(
  coords: { vikramSamvat: number; masaIndex: number; paksha: 'shukla' | 'krishna'; pakshaTithi: number; adhikaOnly?: boolean },
  location: GeoLocation, options: ConvertOptions,
): Date[];
export function getKaliYugaYear(date: Date): number;
export function getHinduNewYear(
  gregorianYear: number, region: FestivalRegion | LegacyFestivalRegion,
  location: GeoLocation, options: ConvertOptions,
): Date | null;

// Yearly listings
export function getEkadashiDatesForYear(year: number, location: GeoLocation, options: YearlyListingOptions): Date[];
export function getSankrantisForYear(year: number, location: GeoLocation, options: YearlyListingOptions): SankrantiEvent[];
export function getFestivalsInRange(start: Date, end: Date, location: GeoLocation, options: YearlyListingOptions): FestivalDay[];
export function getUpcomingEclipses(fromDate: Date, location: GeoLocation, count?: number): EclipseInfo[];
```

### Type surface additions

- `Divisional`, `DivisionalChart`, `AspectMap`, `AspectsOptions`,
  `PlanetShadbala`, `ShadbalaResult`.
- `KaalSarpDoshaInfo`, `KaalSarpSubtype`, `PitruDoshaInfo`.
- `YoginiName`, `YoginiMahaDasha`, `YoginiAntarDasha`, `YoginiDashaResult`,
  `CharaMahaDasha`, `CharaDashaResult`.
- `MuhurtaRule`, `MuhurtaScore`, `MuhurtaDay`, `MuhurtaScoreOptions`.
- `HinduCalendarCoords`, `ConvertOptions`, `YearlyListingOptions`,
  `FestivalDay`, `SankrantiEvent`.

### Sourcing notes

- **Divisional charts** — BPHS Ch. 6 ("Vargas") for all seven kinds; D30
  follows the non-uniform 5-segment Trimsamsa per Parashara (Mars /
  Saturn / Jupiter / Mercury / Venus, with Sun / Moon excluded).
- **Aspects** — BPHS Ch. 26 ("Drishti Vichar"). Default `'7-only'` mode
  applies the BPHS-literal rule for Rahu / Ketu (universal 7th aspect
  only); `'5-and-9'` mode is a documented opt-in (BV Raman / KP).
- **Shadbala** — BPHS Ch. 27 ("Bala Vichar"). Each component is the
  dominant term used by ProKerala / PyJHora's default panel; minor
  sub-balas (Saptavargaja, Tribhaga, Yuddha, Ayana, Hora) are not
  included — their summed contribution is ≤10 V on most charts.
- **Ashtottari** — Satya Acharya's 8-lord scheme (Sun 6, Moon 15, Mars 8,
  Mercury 17, Saturn 10, Jupiter 19, Rahu 12, Venus 21). Anchored at
  Krittika = Sun start.
- **Yogini** — Sanjay Rath's *Yogini Dashas* (1999) and Charak Ch. 18.
- **Chara** — Jaimini Sutras Ch. 1, "9-8-7 years per modality" variant
  (Achyutananda / Sundar). Forward zodiacal direction always; the
  reverse-direction rule for even-rashi lagnas is not currently exposed.

### Documented limitations

- Shadbala uses a **simplified analytic model**, not the full BPHS sub-bala
  catalog. Component values agree with ProKerala / PyJHora to ~5%; minor
  sub-balas (Saptavargaja Sthana, Tribhaga Kala, Yuddha Chesta, Ayana,
  Hora) are intentionally omitted.
- Pitru Dosha surfaces the two highest-frequency classical triggers (Sun +
  node, Sun + Saturn in 9th); the full BPHS catalog of triggers is out of
  scope.
- Chara Dasha uses the forward zodiacal direction for all lagnas; the
  Sundar / Raghava Bhatta variant that flips direction for even-rashi
  lagnas is not exposed.
- Muhurta stock-rule numerics (auspicious / inauspicious tithi /
  nakshatra / vara lists) are sourced from Muhurta-chintamani, BPHS Ch. 28,
  Charak's *Predictive Astrology* Ch. 23, and cross-checked against
  drikpanchang.com/muhurat. Regional traditions vary; pass a custom rule
  for strict-region parity.

### Breaking changes

None. The Phase 30 surface is entirely new — no v3.0 export was renamed,
removed, or had its return shape changed.

### Bundle / runtime

- Bundle size: **~302 KB** (was ~262 KB in v3.0). The +40 KB is from the
  new modules and lookup tables. No new runtime dependencies.
- Hermes JS-syntax check ✅ — every new module passes
  `npm run test:hermes`.

### Test count

**7,156** tests passing across 81 files (was 6,912 in v3.0 → **+244**).
New test files: `tests/unit/divisionals.test.ts`,
`tests/unit/aspects.test.ts`, `tests/unit/shadbala.test.ts`,
`tests/unit/kaalSarp-pitru.test.ts`, `tests/unit/dashas-extra.test.ts`,
`tests/unit/muhurta-engine.test.ts`, `tests/unit/calendar.test.ts`.

---

## 3.0.1

**Patch — README rewrite for v3.x.** Documents the Phase 29 birth-chart
surface end-to-end (Birth Chart, Compatibility & Doshas sections). No code
changes; library behaviour identical to v3.0.0.

---

## 3.0.0

**Major release — Phase 29 Wave 2: Birth Chart Foundation.** Adds the
kundli surface — sidereal Lagna, Bhava under three house systems, D1
(Rashi) and D9 (Navamsa) charts, Ashtakoot 36-point marriage matching,
Mangal Dosha, Sade Sati, Pratyantar dasha, planetary dignity, true Rahu /
Ketu node, plus two new ayanamsas (True Chitrapaksha, Thirukanitham). All
additive on top of v2.4 — `getDailyPanchang` / `getInstantPanchang`
results and every pre-existing export are unchanged. The major bump
exists because the `AyanamsaType` union widens (a structural change for
strict consumers) and to mark the kundli surface as a v3 stability
contract.

### Highlights

- **`computeLagna`** — sidereal ascendant via Meeus eq. 13.6 (atan2 form),
  tropical → sidereal by subtracting the configured ayanamsa. Returns
  `LagnaInfo { siderealLongitude, rashi, degreeInRashi, nakshatra, pada }`.
- **`computeBhava`** — 12 house cusps under one of three systems:
  - `'whole-sign'` (default, classical Vedic) — each rashi is one house.
  - `'equal'` — each house spans 30° starting at lagna's exact degree.
  - `'placidus-kp'` — true cuspal positions (KP). Throws
    `PanchangError('CIRCUMPOLAR')` past |φ| ≳ 66.5°.
- **`computeRashiChart` (D1) + `computeNavamsa` (D9)** — place 9 grahas
  with house assignments. D9 follows the classical Movable / Fixed / Dual
  starting-rashi rule.
- **`computeAshtakoot`** — 36-point Guna Milan from two natal Moons.
  Returns the canonical 8-koot breakdown (Varna 1, Vashya 2, Tara 3,
  Yoni 4, Graha Maitri 5, Gana 6, Bhakoot 7, Nadi 8) plus standard
  cancellations.
- **`computeMangalDosha`** — three-cut check (lagna / Moon / Venus) with
  own-sign and exaltation cancellations.
- **`computeSadeSati`** — phase 1 / 2 / 3 detection with arc-boundary
  binary-search on Saturn's sidereal longitude (retrograde-aware).
- **`computeVimshottariPratyantar`** — third-level dasha sub-period
  expansion, proportional split inside an antardasha.
- **`computeDignity`** — exalted / debilitated / moolatrikona / own /
  friend / neutral / enemy lookup per BPHS Ch. 3–4.
- **True Rahu / Ketu node** — `computePlanetaryPositions(...,
  { nodeType: 'true' })` adds the dominant Meeus periodic correction
  (±0.6° typical vs ±2° worst-case for `'mean'`). Default remains
  `'mean'` — no behaviour change for existing callers.
- **Two new ayanamsas** — `'true-chitra'` (True Chitrapaksha, Spica anchored
  to 0° Libra) and `'thirukanitham'` (Tamil-Vakya). Available everywhere
  the existing `AyanamsaType` is accepted.

### New API surface

```ts
export function computeLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa?: AyanamsaType,
  language?: Language,
): LagnaInfo;

export function computeBhava(
  birthDate: Date,
  location: GeoLocation,
  options?: BirthChartOptions,
): BhavaChart;

export function computeRashiChart(
  birthDate: Date,
  location: GeoLocation,
  options?: BirthChartOptions,
): BirthChart;

export function computeNavamsa(
  birthDate: Date,
  location: GeoLocation,
  options?: BirthChartOptions,
): DivisionalChart;

export function computeAshtakoot(
  boy: NatalMoon,
  girl: NatalMoon,
): AshtakootResult;

export function computeMangalDosha(chart: BirthChart): MangalDoshaInfo;

export function computeSadeSati(
  natalMoonRashi: number,
  asOfDate?: Date,
  options?: BirthChartOptions,
): SadeSatiInfo;

export function computeDignity(graha: GrahaName, rashi: number): Dignity;

export function computeVimshottariPratyantar(
  antardasha: AntarDasha,
): PratyantarDasha[];
```

### Type surface additions

- `LagnaInfo`, `HouseInfo`, `BhavaChart`, `BirthChart`, `DivisionalChart`,
  `PlanetPlacement`, `MangalDoshaInfo`, `SadeSatiInfo`, `PratyantarDasha`,
  `Dignity`, `HouseSystem`, `BirthChartOptions`, `NatalMoon`, `KootName`,
  `KootScore`, `AshtakootResult`.
- `AyanamsaType` union widened by `'true-chitra' | 'thirukanitham'`.
- `BirthChartOptions.nodeType?: 'mean' | 'true'`.

### Breaking changes

The kundli surface is entirely new — no v2.x exports were renamed,
removed, or had their return shape changed. The major bump reflects:

1. **`AyanamsaType` widened.** Strict-superset consumers that
   exhaustively `switch` on `AyanamsaType` will need to handle the two
   new values (`'true-chitra'`, `'thirukanitham'`). All code that
   accepts an `AyanamsaType` continues to compile and behave identically
   when the new values are not passed.
2. **`computePlanetaryPositions` accepts a new `nodeType` option.**
   Default `'mean'` — pre-v3 behaviour preserved exactly. No call site
   needs changes; pass `{ nodeType: 'true' }` to opt in to the periodic
   correction for Rahu / Ketu.

### Validation

- **Birth charts (D1)** — 20+ charts cross-validated against AstroSage
  R-tier (lagna rashi exact match, planet rashi exact match, planet
  house exact match for whole-sign).
- **Ashtakoot** — 30+ pairs cross-validated against
  drikpanchang.com/jyotisha/horoscope-match (per-koot tolerance ±1).
- **Sade Sati** — arc-boundary dates within ±2 days of authoritative
  sources for 20 sample charts; phase classification exact.
- **`getDailyPanchang` regression** — perf-test `tests/perf/phase29-non-regression.test.ts`
  confirms no slowdown for callers not using the kundli surface.

### Bundle / runtime

- Bundle size: **262 KB** (was ~200 KB in v2.4) — entirely from the new
  jyotish modules and lookup tables. No new runtime dependencies.
- Hermes JS-syntax check ✅ — every new module passes
  `npm run test:hermes`.

### Test count

**6,912** tests passing (was 6,048 in v2.4 → **+864**). New files:
`tests/unit/lagna.test.ts`, `tests/unit/bhava.test.ts`,
`tests/unit/charts.test.ts`, `tests/unit/matching.test.ts`,
`tests/unit/doshas.test.ts`, `tests/unit/sadeSati.test.ts`,
`tests/unit/dignity.test.ts`, `tests/unit/pratyantar.test.ts`,
`tests/unit/trueNode.test.ts`, plus the three `tests/validation/phase29-*`
files and `tests/perf/phase29-non-regression.test.ts`.

### Migration from 2.x

```ts
// All v2.x code keeps working unchanged.
const r = getDailyPanchang(date, loc, { timezone: 330 });
// …same return shape as v2.4.

// New: build a kundli.
import { computeRashiChart, computeAshtakoot } from 'panchang-ts';
const d1 = computeRashiChart(birth, loc, { houseSystem: 'whole-sign' });
const match = computeAshtakoot(
  { rashi: 4, nakshatra: 9 },
  { rashi: 0, nakshatra: 1 },
);
```

---

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
  getMoon: (d: Date) => number, // sidereal Moon longitude in degrees
): TimePeriod[];

export function computeDoGhati(
  sunriseUtc: Date,
  sunsetUtc: Date,
  nextSunriseUtc: Date,
  nameFn: (slotIndex: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
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

**6,048** tests passing across 61 files (cumulative across the v2.2 →
v2.4 Phase 28 work; was 5,149 in v2.1.0 → **+899**). New files added by
this release: `tests/unit/panchakaRahita.test.ts`,
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
  - `aadal` / `vidaal` — Moon-from-Sun nakshatra-distance in the
    28-nakshatra scheme (Abhijit between UAshadha and Shravana).
    Aadal auspicious on distance ∈ {2, 7, 9, 14, 16, 21, 23, 28};
    Vidaal inauspicious on {3, 6, 10, 13, 17, 20, 24, 27}.
  - `ravi` — auspicious; Moon-from-Sun nakshatra-distance in the
    27-nakshatra scheme on {4, 6, 9, 10, 13, 20}. No weekday filter
    (per DrikPanchang's published occurrence list).

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
  windows. Asymmetric: Pratah ends *at* sunrise, Sayahna starts *at*
  sunset; both have width = `nightDuration / 10` (three nighttime
  ghatikas). Matches DrikPanchang's published Sandhya. Two new fields.
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
  currentNakshatraIndex: number,
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number, // sidereal Moon longitude in degrees
): TimePeriod | null;

export function computeGandaMula(
  currentNakshatraIndex: number,
  lang?: Language,
): GandaMulaInfo;

export function computeMadhyahna(sunriseUtc: Date, sunsetUtc: Date): TimePeriod;
export function computePratahSandhya(
  sunriseUtc: Date,
  sunsetUtc: Date,
  nextSunriseUtc: Date,
): TimePeriod;
export function computeSayahnaSandhya(
  sunsetUtc: Date,
  nextSunriseUtc: Date,
): TimePeriod;
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
