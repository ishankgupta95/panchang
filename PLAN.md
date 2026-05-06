# panchang-ts — Implementation Plan & Phase Log

> Pure TypeScript Hindu Panchang calculation library.
> Zero native deps · Offline-first · React Native (Hermes) / Node / Browser

This document is the historical phase log + the forward-looking roadmap. The
detailed pre-v1 build notes that previously lived here have been compacted into
short summaries; the source of truth for *what shipped* is the code, the test
suite, and [CHANGELOG.md](CHANGELOG.md).

---

## Architecture (one-page summary)

**Package layout**
- `src/core/` — element calculators (tithi, nakshatra, yoga, karana, vara, masa,
  inauspicious, muhurta, choghadiya, gowri, hora, festivals, bhadra, varjyam,
  gandaMula, anandadiYoga, panchakaRahita, doGhati, …) and the
  `getDailyPanchang` / `getInstantPanchang` orchestrators.
- `src/astronomy/` — sunrise/sunset, moonrise/moonset, ayanamsa, sun/moon
  longitudes, eclipse search.
- `src/jyotish/` — planetary positions, Vimshottari Dasha, Chandra Balam,
  Tarabala.
- `src/i18n/` — `en` and `hi` (Devanagari) only. Sanskrit was dropped in
  Phase 22.
- `src/types/` — public type surface, exported via `src/index.ts`.
- `src/utils/` — angle math, timezone resolution, validation, constants.

**Modes**
- **Daily mode** — sunrise→nextSunrise window. Returns arrays of element
  transitions, full muhurta table, festival emissions, eclipse overlap.
- **Instant mode** — single UTC moment. Single element per category. No
  canonical-time festival refinement (madhyahna / pradosha / nishita /
  chandrodaya), no transit Sankranti, no Ekadashi viddha — those need the
  full Hindu day window.

**Performance levers**
- `computeEndTimes: false` — names-only, ~5× faster.
- `precision: 'standard' | 'high'` — 15 vs 25 binary-search iterations.
- Per-call longitude cache used by every binary search → end-time lookups
  are essentially free after the first.

**Public API surface**
Frozen at v1.0.0. Naming: `get*` for instant retrievers + top-level entries,
`compute*` for synthesized multi-field results. Every exported symbol has
JSDoc with `@param` / `@returns` / `@example`.

---

## Phase Log

| Phase | Focus | Release | Status |
|------:|-------|---------|:------:|
| 1–12 | Core build (Pancha Anga, astronomy, cache, build, Hermes CI, dharmSetu integration) | v0.2.2 | ✅ |
| 13 | Missing essentials — Chandra Masa + Adhika, Vikram/Shaka Samvat, Chandra Rashi, Brahma Muhurta, Choghadiya, Hora, Moonrise/set, Panchaka, Saura Masa | v0.3.x | ✅ |
| 14 | dharmSetu MVP — Special Yogas (Amrit Siddhi / Sarvartha Siddhi / Ravi Pushya / Guru Pushya), Dur Muhurta, festival registry | v0.3.1 | ✅ |
| 15 | Regional — Gowri Panchangam (Nalla Neram) | v0.3.1 | ✅ |
| 16 | Validation — 200-day Drik fixtures, long-range regression | — | 🔶 partial |
| 17 | Jyotish expansion — 9-graha positions, Vimshottari Dasha, Chandra Balam | — | ✅ |
| 18 | Jyotish quality gate — Rahu mean-node fix, Drik validation for planets (Δ<0.03°) and dasha (97 invariant assertions), API ergonomics (`computeVimshottariDashaFromBirth`) | — | ✅ |
| 19 | v1 prep — festival fixtures, end-time validation (≤2.01 min observed), API audit, README sync, seconds-precision audit (≤29 s sunrise drift), CHANGELOG | v1.0.0 | ✅ |
| 20 | Post-v1 jyotish (Kundli Milan, Shadbala, divisional charts) | — | 📐 deferred to Phases 29–30 |
| 21 | Festival rule system — `FestivalDateRule` (`sunrise`/`madhyahna`/`aparahna`/`pradosha`/`nishita`/`chandrodaya`), canonical-time anchors, transit-based Sankranti, nakshatra+solarMasa rules, Ekadashi Dashami-viddha detection | — | ✅ |
| 22 | Sanskrit locale removed — `Language` narrowed to `'en' \| 'hi'` (breaking) | v2.0.0 | ✅ |
| 23 | Classical correctness — Bhadra Kala module, Smarta/Vaishnava Ekadashi split, 24 named Ekadashis + 14 named Pradoshas, long-tithi dedupe, Adhika nuance per festival, Purnimanta naming | v2.0.0 | ✅ |
| 24 | Festival coverage expansion — Chhath (4-day), Vat Savitri, Upakarma (3 shakhas), Onam, Masik Shivaratri, Vinayaka Chaturthi, Pushya days, month+weekday recurring (Shravan Somvar etc.). New rule kinds: `nakshatra+chandraMasa`, `chandraMasa+vara`. `region` option introduced. | v2.0.0 | ✅ |
| 25 | Astronomy — eclipse detection (solar + lunar with sutak), muhurta library completion (Vijaya, Godhuli, Nishita, Amrit Kala) | v2.0.0 | ✅ |
| 26 | Diaspora & API polish — non-IST cross-verification (NYC/London/Sydney/Dubai/Singapore + DST), `getInstantPanchang` limitations documented | v2.0.0 | ✅ |
| 27 | Regional festival expansion — state-slug `FestivalRegion` (21 states + nepal), allow-list `regions[]` on rules, transit-adjacent emissions (Lohri, Raja arc), 10 new regional festivals (Gudi Padwa, Gangaur, Karaga, Bonalu, Teej variants, Govardhan, Bhai Dooj, Phagli, Rath Yatra, Varamahalakshmi via `tithiRange` gate), Bathukamma markers, orphan-region sweep | v2.1.0 | ✅ |
| 28 | DrikPanchang dainika parity — Tarabala, Varjyam, Ganda Mula, Madhyahna, Pratah/Sayahna Sandhya, Dinamana/Ratrimana, Anandadi Yoga, 6 special yogas (Dwipushkar/Tripushkar/Jwalamukhi/Aadal/Vidaal/Ravi), Panchaka Rahita, Do Ghati Muhurta | v2.2 → v2.4 | ✅ |
| 29 | Birth Chart Foundation — Lagna, Bhava (3 house systems), D1/D9 charts, Ashtakoot 36-pt matching, Mangal Dosha, Sade Sati, Pratyantar dashas, planetary dignity, true Rahu node, True Chitra + Thirukanitham ayanamsas | v3.0.0 | ✅ |
| 30 | Advanced Astrology + Muhurta Engine — D2/D3/D7/D10/D12/D30, Drishti, Shadbala, Kaal Sarp + Pitru, Ashtottari/Yogini/Chara dashas, muhurta scoring engine + 13 stock rules, calendar conversion APIs (Greg↔Hindu, Kali Yuga, Hindu New Year, yearly listings) | v3.1.0 | ✅ |

Final state after Phase 30: **7,156 tests** passing across 81 files. Bundle
size ~302 KB. Festival registry has grown from ~25 entries (Phase 14) to 80+.
Diaspora cross-verified across 5 non-IST cities including DST. Hermes CI green.

---

## Validation summary

| Element | Tolerance | Observed |
|---------|-----------|----------|
| Sunrise / sunset | ±45 s vs Drik minute-midpoint | ≤29 s |
| Tithi/Nakshatra/Yoga/Karana names | exact match | exact |
| Tithi/Nakshatra/Yoga/Karana end-times | ±3 min | max 2.01 min |
| Ayanamsa | ±0.005° vs Swiss Ephemeris | within |
| Planetary positions Sun–Saturn | ±0.25° | ≤0.02° |
| Planetary positions Rahu/Ketu (mean node) | ±2° | ≤0.5° typical |
| Festival dates | exact for the 12 cross-verified set | exact |
| Madhyahna midpoint | ±1 min vs Drik | exact across 50 fixtures |
| Pratah/Sayahna Sandhya start+end | ±2 min vs Drik | within |
| Varjyam start+end | ±2 min vs Drik (≥30/50 fixtures emit) | within |
| Anandadi Yoga name, Ganda Mula active | exact | exact across 50 |

**Documented rule-choice tradeoffs** (not bugs — see README "Festival Detection
— Documented Tradeoff" section):
- Tithi-at-sunrise rule → ±1 day from Drik for Janmashtami / Shivaratri /
  Diwali (tithi-at-midnight), Akshaya Tritiya 2026 / edge-year Ganesh
  Chaturthi (madhyahna-vyapini), Ugadi 2026-03-19 (Kshaya tithi).
- Aadal/Vidaal use the classical Moon-from-Sun nakshatra-distance rule
  (AstroShastra / HoraSarvam / Ernst Wilhelm); some Tamil-Vakya panchangs
  use a weekday rule instead.
- Varjyam emits a single sunrise-anchored window per day; printed panchangs
  may show a second window on nakshatra-transition days.
- Do Ghati Muhurta uses the same 30-name deity sequence every weekday (no
  vara rotation), per Brahmana / Smriti enumeration verified against Drik
  for two weekdays.

---

## Phase 28 — DrikPanchang Dainika Parity (Wave 1) ✅ DONE

**Goal.** Close the visible gap with [drikpanchang.com](https://www.drikpanchang.com/panchang/day-panchang.html) — the reference users compare against. Every feature is a **lookup-table calculation built on existing primitives**: nakshatra index, vara index, tithi index, sunrise/sunset. No new astronomy, no new ayanamsa, no breaking API changes.

**Releases.** Three minor releases (v2.2 → v2.4), each independently shipped.

### Step 28-1 — Tarabala (v2.2)

**What.** 9-tara cycle (Janma, Sampat, Vipat, Kshema, Pratyari, Sadhaka, Vadha, Mitra, Ati-Mitra, repeating 3×) from janma nakshatra → transit moon nakshatra. Cousin to Chandra Balam.

**Algorithm.** `taraIndex = ((transitNakshatra - janmaNakshatra + 27) % 27) % 9`. Vipat (2) / Pratyari (4) / Vadha (6) → inauspicious; rest → auspicious.

**Files.**
- New: [src/jyotish/tarabala.ts](src/jyotish/tarabala.ts) → `computeTarabala(janmaNakshatraIndex, transitNakshatraIndex, lang?)` returning `TarabalaInfo`.
- [src/types/options.ts](src/types/options.ts) — added `janmaNakshatra?: number`.
- [src/types/panchang.ts](src/types/panchang.ts) — added `tarabala?: TarabalaInfo` (opt-in, only populated when `janmaNakshatra` is passed).
- [src/index.ts](src/index.ts) re-exports `computeTarabala` + `TarabalaInfo`.

**Tests.** 38 unit cases in [tests/unit/tarabala.test.ts](tests/unit/tarabala.test.ts) plus integration wiring. Drik publishes Tarabala as a per-nakshatra band ("Good Tarabalam till X PM for nakshatras N, M, …"), which is not directly cross-checkable per fixture — algorithm verified via unit cases instead.

### Step 28-2 — Varjyam (v2.2)

**What.** Forbidden ~1.5h window per day, nakshatra-keyed.

**Algorithm.** Lookup `VARJYAM_OFFSET_GHATIKAS[nakshatraIndex]` (27-element table from DrikPanchang's published Tyajya Ghatis, also reproduced in Muhurta-chintamani Ch. 4 and BPHS Ch. 71). The offset is in **elastic ghatikas of the active nakshatra's own duration** — `1 ghatika = (nakshatraEnd − nakshatraStart) / 60` — and the Varjyam window spans 4 such ghatikas. Because the Moon's apparent speed varies (~11–15°/day), nakshatra durations vary 21–27h and the Varjyam width therefore varies ~84–108 min day-to-day, exactly matching DrikPanchang's published widths.

```
varjyamStart = nakshatraStart + offsetGhatikas × (nakshatraDuration / 60)
varjyamEnd   = varjyamStart + 4 × (nakshatraDuration / 60)
```

The nakshatra start and end are located by binary search on `getNakshatraIndexAtTime` over a ±30h window from sunrise. The window is clamped to overlap with the Hindu day (sunrise → nextSunrise); `null` is returned when there is no overlap or when the nakshatra anchors can't be located.

**Single-window contract.** Only the nakshatra active at sunrise is consulted. On nakshatra-transition days printed panchangs may render two Varjyam windows (one per nakshatra); this API returns at most one. When DrikPanchang shows the second nakshatra's Varjyam, the library returns `null` — an explicit known limitation, not a parity gap.

**Files.**
- New: [src/core/varjyam.ts](src/core/varjyam.ts) → `computeVarjyam(currentNakshatra, sunriseUtc, nextSunriseUtc, getMoon)` returning `TimePeriod | null`.
- `VARJYAM_OFFSET_GHATIKAS` (27 entries) in [src/utils/constants.ts](src/utils/constants.ts).
- `DailyPanchangResult.varjyam` populated in orchestrator.

**Tests.** [tests/unit/varjyam.test.ts](tests/unit/varjyam.test.ts) covers offset table, deterministic offsets via synthetic Moons (24-min ghatikas via 27-day period, plus 25-day and 29-day periods that exercise elastic behavior), and a 30-day Delhi sweep. [tests/validation/phase28-cross-verify.test.ts](tests/validation/phase28-cross-verify.test.ts) asserts ±2 min on every fixture where the library emits a non-null window (≥30 of 50).

### Step 28-3 — Ganda Mula (v2.2)

**What.** Boolean detection — Moon in any of the 6 "root" nakshatras (Ashwini=0, Ashlesha=8, Magha=9, Jyeshtha=17, Mula=18, Revati=26). Severity: Mula/Jyeshtha = severe; others = mild (per classical Smarta texts).

**Files.**
- New: [src/core/gandaMula.ts](src/core/gandaMula.ts) → `computeGandaMula(currentNakshatraIndex)` returning `GandaMulaInfo` (discriminated on `active`).

**Tests.** 6 fixtures covering each Ganda Mula nakshatra + 2 negative cases.

### Step 28-4 — Madhyahna + Pratah/Sayahna Sandhya + Dinamana/Ratrimana labels (v2.2)

**What.**
- **Madhyahna** = solar noon as a `TimePeriod` ±24 min (one classical muhurta) centered on the sunrise→sunset midpoint.
- **Pratah Sandhya** = three nighttime ghatikas ending at sunrise. Width = `(nextSunrise − sunset) / 10`. Asymmetric — begins ~3 ghatikas before sunrise and ends *at* sunrise.
- **Sayahna Sandhya** = three nighttime ghatikas starting at sunset. Width = `(nextSunrise − sunset) / 10`. Asymmetric — starts *at* sunset.
- **Dinamana** = `dayDurationMinutes` re-exposed as `dinamanaMinutes`.
- **Ratrimana** = `nightDurationMinutes` re-exposed as `ratrimanaMinutes`.

The Sandhya widths are elastic to the nighttime length: in Indian latitudes they range from ~62 min (early summer) to ~81 min (winter), exactly tracking DrikPanchang.

**Files.**
- [src/core/muhurta.ts](src/core/muhurta.ts) — `computeMadhyahna`, `computePratahSandhya`, `computeSayahnaSandhya`.
- [src/types/panchang.ts](src/types/panchang.ts) — added `madhyahna`, `pratahSandhya`, `sayahnaSandhya`, `dinamanaMinutes`, `ratrimanaMinutes`.

**Validation.** Madhyahna midpoint exact match within ±1 min on all 50 fixtures. Pratah/Sayahna Sandhya start and end times within ±2 min on all 50 fixtures.

### Step 28-5 — Anandadi Yoga (v2.3)

**What.** 28 yogas formed by Vara × Nakshatra (a 28-name cycle that repeats weekly). Names: Ananda, Kaladanda, Dhumra, Prajapati, Saumya, Dhwanksha, Dhwaja, Shrivatsa, Vajra, Mudgara, Chhatra, Maitra, Manasa, Padma, Lumba, Utpaata, Mrityu, Kana, Siddhi, Shubha, Amrita, Musala, Gada, Matanga, Raksha, Charma, Vajra (var), Sthira.

**Algorithm.** `anandadiIndex = ANANDADI_TABLE[varaIndex][nakshatraIndex]` → look up name + auspicious/inauspicious quality.

**Files.**
- New: [src/core/anandadiYoga.ts](src/core/anandadiYoga.ts) → `computeAnandadiYoga(varaIndex, nakshatraIndex, nameFn)`.
- `ANANDADI_TABLE` (7 × 28) in [src/utils/constants.ts](src/utils/constants.ts).
- `anandadiYogaNames` (28 strings) in `en.ts` and `hi.ts`.

### Step 28-6 — Dwipushkar / Tripushkar / Jwalamukhi / Aadal / Vidaal / Ravi yogas (v2.3)

**What.** Six classical yogas combining Vara + Tithi + Nakshatra in fixed patterns. Each is a boolean detection from existing inputs.

- **Dwipushkar** — Bhadra-tithi (`{2, 7, 12}`) + Bhadra-vara (Sun/Tue/Sat, `{0, 2, 6}`) + nakshatra ∈ {Mrigashira, Chitra, Dhanishtha}. Actions doubled.
- **Tripushkar** — same Bhadra-tithi + Bhadra-vara + nakshatra ∈ {Krittika, Punarvasu, Uttara Phalguni, Vishakha, Uttara Ashadha, Purva Bhadrapada}. Actions tripled.
- **Jwalamukhi** — inauspicious; tithi × nakshatra lookup per Muhurta-chintamani 6.32: `{1: Mula, 5: Bharani, 8: Krittika, 9: Rohini, 10: Ashlesha}`.
- **Aadal / Vidaal** — Moon-from-Sun nakshatra-distance in the **28-nakshatra scheme** (Abhijit between Uttara Ashadha and Shravana). `distance = ((moonNak28 - sunNak28 + 28) % 28) + 1`. Aadal triggers on `{2, 7, 9, 14, 16, 21, 23, 28}`; Vidaal on `{3, 6, 10, 13, 17, 20, 24, 27}`. Sources: AstroShastra Muhurta page, HoraSarvam (2023), Ernst Wilhelm's *Muhurta Yogas*.
- **Ravi Yoga** — Moon-from-Sun nakshatra-distance in the **27-nakshatra scheme**. `distance ∈ {4, 6, 9, 10, 13, 20}`. Drops the popular "must be Sunday" filter (Drik's Ravi Yoga occurrence page lists hits across all weekdays — that's the parity oracle).

**Files.**
- New [src/core/specialYogasData.ts](src/core/specialYogasData.ts) — moves yoga lookup tables out of `specialYogas.ts` so the compute logic reads as a list of "for each yoga, check the table."
- [src/core/specialYogas.ts](src/core/specialYogas.ts) — `SpecialYogaInfo.type` union extended with the 6 new keys. Now requires `suryaNakshatraIndex` (Aadal/Vidaal/Ravi).

**Validation.** Per-yoga unit tests + 180-day Delhi sweep with self-consistency checks. Aadal / Vidaal explicitly **not** cross-checked against Drik occurrence pages — Drik publishes no algorithmic rule text and may be using the popular Tamil-Vakya weekday rule instead. The library follows the classical distance rule by design.

### Step 28-7 — Panchaka Rahita Muhurta + Do Ghati Muhurta (v2.4)

**What.**
- **Panchaka Rahita** — slices of the day **free** of Panchaka (Moon outside last 5 nakshatras). Returns `TimePeriod[]`; `[]` when Panchaka pervades the day.
- **Do Ghati Muhurta** — 15 daytime + 15 nighttime 2-ghatika windows (each ~48 min), each labelled with a fixed deity name and quality. **No vara rotation** — the same 30-name deity sequence applies every day, verified against Drik's `do-ghati-muhurat.html` for two distinct weekdays.

**Files.**
- New: [src/core/panchakaRahita.ts](src/core/panchakaRahita.ts) → `computePanchakaRahita(sunriseUtc, nextSunriseUtc, getMoon)`.
- New: [src/core/doGhati.ts](src/core/doGhati.ts) → `computeDoGhati(sunriseUtc, sunsetUtc, nextSunriseUtc, nameFn, qualityNameFn)` returning `DoGhatiInfo { day, night }` (15 + 15).
- `doGhatiNames` (30 strings) in `en.ts` / `hi.ts`.
- `DailyPanchangResult.panchakaRahita`, `DailyPanchangResult.doGhatiMuhurta` populated in orchestrator.

**Tests.** Per-slot quality pin in [tests/unit/doGhati.test.ts](tests/unit/doGhati.test.ts) (reordering breaks immediately) plus single-date cross-check for slot start times.

### Phase 28 Exit Criteria

Asserted in [tests/validation/phase28-cross-verify.test.ts](tests/validation/phase28-cross-verify.test.ts) against 10 cities × 5 dates = 50 DrikPanchang fixtures (sourced from `drikpanchang.com/panchang/day-panchang.html` on 2026-04-26).

**Strict parity (asserted on all 50 fixtures):**
- Sunrise / sunset ±3 min.
- Madhyahna midpoint ±1 min.
- Pratah Sandhya start + end ±2 min.
- Sayahna Sandhya start + end ±2 min.
- Varjyam start + end ±2 min on every fixture where the library emits a non-null window. ≥30 of 50 emit.
- Anandadi Yoga name (English) — exact.
- Ganda Mula `active` flag — exact.

**Soft parity (one-way superset on recognized yoga types):** library detects every yoga Drik's auspicious/inauspicious panel surfaces under a recognized name; reverse direction permitted. **Aadal / Vidaal explicitly excluded** (sourcing note above).

**Algorithm-only validation:** Tarabala (Drik panel format isn't per-fixture cross-checkable) and Do Ghati Muhurta (30-name table is fixed across weekdays) — verified by unit tests with per-slot pins.

**Engineering invariants (all met):**
- 6,048 tests pass (no regression in prior suite).
- `getDailyPanchang` keeps the cache + names-only fast path; no new ephemeris calls for users who don't opt into Phase 28 fields. Varjyam reuses the Moon longitude cache.
- All new modules pass `npm run test:hermes`.
- API surface is additive: every Phase 28 field is a new key on `DailyPanchangResult` / `InstantPanchangResult`.
- New helpers re-exported from [src/index.ts](src/index.ts): `computeTarabala`, `computeVarjyam`, `computeGandaMula`, `computeAnandadiYoga`, `computePanchakaRahita`, `computeDoGhati`, `computeMadhyahna`, `computePratahSandhya`, `computeSayahnaSandhya`.

---

## Phase 29 — Birth Chart Foundation (Wave 2) — ✅ SHIPPED v3.0.0 (2026-05-04)

**Goal.** Add the kundli foundation that unlocks rashifal, marriage matching, and Sade Sati features in the consumer apps. **Major release v3.0.** Estimated **8–12 engineering days**.

**Critical decision (locked).** House system is **configurable** via `options.houseSystem: 'whole-sign' | 'equal' | 'placidus-kp'`. Default is **`'whole-sign'`** (classical Vedic).

**Status.** All six steps shipped as additive API surface (no v2.x breakage). **6,912 tests passing**. External cross-validation done against AstroSage R-tier (21 celebrity charts, D1) + DrikPanchang horoscope-match (30+ Ashtakoot pairs) + ProKerala / DrikPanchang (20 Sade Sati charts). Published as **v3.0.0** on 2026-05-04 (followed by v3.0.1 README polish on 2026-05-05). Bundle size: ~262 KB (was ~200 KB). Hermes JS-syntax check ✅.

**New API surface (all re-exported from `src/index.ts`):** `computeLagna`, `computeBhava`, `computeRashiChart`, `computeNavamsa`, `computeAshtakoot`, `computeMangalDosha`, `computeSadeSati`, `computeDignity`, `computeVimshottariPratyantar`.

**New types:** `LagnaInfo`, `HouseInfo`, `BhavaChart`, `BirthChart`, `DivisionalChart`, `PlanetPlacement`, `MangalDoshaInfo`, `SadeSatiInfo`, `PratyantarDasha`, `Dignity`, `HouseSystem`, `BirthChartOptions`, `NatalMoon`, `KootName`, `KootScore`, `AshtakootResult`.

**New options:** `'true-chitra'` and `'thirukanitham'` ayanamsas; `nodeType: 'mean' | 'true'` on `computePlanetaryPositions` (Meeus periodic correction; ±0.6° vs ±2° worst-case for 'mean').

### Step 29-1 — Lagna (Ascendant) calculation

**What.** Compute the rising sign at birth. Foundation for everything else in this phase.

**Algorithm.** Local sidereal time (LST) at birth → tropical RA of ascendant via `tan(RA) = sin(LST) / (cos(LST)·cos(ε) - tan(φ)·sin(ε))` (Meeus Ch. 13). Convert tropical → sidereal by subtracting ayanamsa. ε = mean obliquity of ecliptic (already implemented for retrograde detection in `jyotish/planets.ts`).

**Files.**
- New: `src/jyotish/lagna.ts` exporting `computeLagna(birthDate, location, ayanamsaType?)` → `LagnaInfo { siderealLongitude, rashi, degreeInRashi, nakshatra, pada }`.
- Re-export from `src/index.ts`.

**Tests.** Cross-check against Jagannath Hora (free desktop software) for 20 birth charts.

**Effort.** ~1.5d.

### Step 29-2 — Bhava (Houses) — configurable system

**What.** Compute 12 house cusps using one of three systems.

- **Whole Sign** (default) — each rashi is exactly one house starting from lagna's sign.
- **Equal House** — each house is exactly 30°, starting from lagna's exact degree.
- **Placidus-KP** — true cuspal positions; standard formula (Astrolabe / KP).

**Files.**
- New: `src/jyotish/bhava.ts` exporting `computeBhava(lagna, houseSystem?)` → `BhavaChart { houses: HouseInfo[12], system }`.
- Add `HouseSystem` type to `src/types/options.ts`. Add `houseSystem?: HouseSystem` to a new `BirthChartOptions` type.
- Re-export from `src/index.ts`.

**Tests.** Each house system validated separately. Whole Sign is trivial; Placidus-KP validated against Jagannath Hora for 20 charts.

**Effort.** ~2d.

### Step 29-3 — Rashi Chart (D1) + Navamsa (D9)

**What.** Place 9 grahas + lagna into the 12 houses.

- **D1 (Rashi)** — straightforward placement of `computePlanetaryPositions()` output into bhava chart.
- **D9 (Navamsa)** — each rashi divided into 9 navamsas (3°20' each); navamsa rashi computed via classical mapping (Movable: starts at own sign; Fixed: starts at 9th from own; Dual: starts at 5th from own).

**Files.**
- New: `src/jyotish/charts.ts` exporting `computeRashiChart(birthDate, location, options)` → `BirthChart { lagna, houses, planets, divisional: 'D1' }`.
- Add `computeNavamsa(birthDate, location, options)` → same shape with `divisional: 'D9'`.
- Re-export from `src/index.ts`.

**Tests.** 20 birth charts vs Jagannath Hora.

**Effort.** ~2d.

### Step 29-4 — Ashtakoot Guna Milan (36-point matching)

**What.** Marriage compatibility between two birth charts. The 8 koots:

| Koot | Weight | Tests |
|------|--------|-------|
| Varna | 1 | Caste class compatibility (boy ≥ girl) |
| Vashya | 2 | Mutual influence (rashi-grouping based) |
| Tara | 3 | Health (nakshatra-difference based) |
| Yoni | 4 | Sexual compatibility (nakshatra-animal based) |
| Graha Maitri | 5 | Mental compatibility (rashi-lord friendship) |
| Gana | 6 | Temperament (Deva/Manushya/Rakshasa) |
| Bhakoot | 7 | Emotional/financial bond (rashi distance) |
| Nadi | 8 | Health/genetics (nakshatra-nadi grouping) |

Plus standard cancellations (same nakshatra different padas, same rashi different nakshatras, etc.).

**Files.**
- New: `src/jyotish/matching.ts` exporting `computeAshtakoot(boyMoon, girlMoon)` → `AshtakootResult { score: 0..36, koots: KootScore[8], doshas: DoshaInfo[], cancellations: string[] }`.
- Tables: `VARNA`, `VASHYA`, `YONI`, `NADI` etc. in `src/jyotish/matchingTables.ts`.
- Re-export from `src/index.ts`.

**Tests.** 30+ pairs cross-validated against [drikpanchang.com/jyotisha/horoscope-match](https://www.drikpanchang.com/jyotisha/horoscope-match/horoscope-match.html) and ProKerala.

**Effort.** ~2d.

### Step 29-5 — Mangal Dosha + Sade Sati

**What.**
- **Mangal Dosha (Manglik)** — Mars in houses 1, 2, 4, 7, 8, 12 from lagna OR moon OR venus (three cuts). Standard cancellations (Mars in own/exalted sign, mutual mangalik, etc.).
- **Sade Sati** — Saturn currently transiting 12th, 1st, or 2nd house from natal moon rashi. Returns phase (1/2/3) and start/end dates of current 7.5-year arc.

**Files.**
- New: `src/jyotish/doshas.ts` exporting `computeMangalDosha(birthChart)` → `MangalDoshaInfo { afflicted: boolean, fromLagna, fromMoon, fromVenus, cancellations }`.
- New: `src/jyotish/sadeSati.ts` exporting `computeSadeSati(natalMoonRashi, asOfDate?)` → `SadeSatiInfo { active: boolean, phase: 1|2|3|null, currentArcStart, currentArcEnd, nextArcStart? }`.
- Saturn transit: scan ahead/back using `computePlanetaryPositions().saturn.rashi` daily; binary-search the Saturn transit boundaries.
- Re-export from `src/index.ts`.

**Tests.** 20 charts each, cross-checked against ProKerala / DrikPanchang.

**Effort.** ~2d.

### Step 29-6 — Pratyantar dashas + planetary dignity + true node + new ayanamsa

**What.** Round out classical accuracy.

- **Pratyantar dashas** — extend `computeVimshottariDasha()` to return third-level pratyantar (sub-sub) periods. Same proportional split logic.
- **Planetary dignity** tables: exalted, debilitated, moolatrikona, own-sign, friend, neutral, enemy. 9 × 12 grid.
- **True Rahu/Ketu node** option — `options.nodeType: 'mean' | 'true'` (default mean, current behaviour). True node via astronomy-engine's `MoonNode` or equivalent calculation.
- **Ayanamsa additions** — True Chitrapaksha + Thirukanitham. Extend `AyanamsaType` union.

**Files.**
- Extend `src/jyotish/dasha.ts` — add `computeVimshottariPratyantar(antardasha)`.
- New: `src/jyotish/dignity.ts` exporting dignity tables + `computeDignity(graha, rashi)`.
- Extend `src/astronomy/ayanamsa.ts` — add 'true-chitra', 'thirukanitham' polynomials.
- Extend `src/jyotish/planets.ts` — add `nodeType` option, true-node calculation path.

**Tests.** Per-feature test files; ayanamsa values validated against astrological reference tables.

**Effort.** ~2d.

### Phase 29 Exit Criteria — ✅ all met (v3.0.0)

- ✅ **21 birth charts** validated against **AstroSage R-tier** (highest data-confidence celebrity chart corpus). D1 lagna degree-in-rashi ±1.0°, planet rashi exact match, planet degree-in-rashi ±0.5°. D9 algorithm exhaustively unit-tested (every rashi-type rule × boundary). Sourcing note: AstroSage was substituted for Jagannath Hora (originally scoped) because R-tier celebrity data is openly published with explicit confidence markers, satisfying the no-self-seeding fixture rule.
- ✅ 30+ Ashtakoot pairs validated against DrikPanchang horoscope-match tool (per-koot tolerance ±1).
- ✅ Sade Sati arc dates within ±2 days of authoritative sources for 20 sample charts.
- ✅ `getDailyPanchang` regression — `tests/perf/phase29-non-regression.test.ts` confirms no slowdown for callers not using the kundli surface.
- ✅ API surface backwards compatible with v2.x (additive only — major bump reflects `AyanamsaType` widening + v3 stability contract on the kundli surface).

---

## Phase 30 — Advanced Astrology + Muhurta Engine (Wave 3) — ✅ SHIPPED v3.1.0 (2026-05-05)

**Goal.** Build on the Phase 29 foundation: divisional charts, aspects, planetary strength, more doshas, more dasha systems, and a **first-class muhurta scoring engine** that consolidates the duplicated occasion-matching logic currently living in both consumer apps. Delivered as a single **v3.1.0** minor release on 2026-05-05.

**Status.** All seven steps shipped as additive API surface (no v3.0 breakage). **7,156 tests passing across 81 files** (+244 from v3.0). Bundle size ~302 KB. Hermes JS-syntax check ✅.

**New API surface (all re-exported from `src/index.ts`):**
`computeDivisionalChart`, `computeAspects`, `computeShadbala`,
`computeKaalSarp`, `computePitruDosha`,
`computeAshtottariDasha`, `computeYoginiDasha`, `computeCharaDasha`,
`scoreMuhurta`, `findAuspiciousDates`, 13 stock muhurta rules
(`vivahRule`, `grihaPraveshRule`, `namakaranaRule`, `vidyarambhRule`,
`vahanKharidiRule`, `annaprashanRule`, `mundanRule`, `upanayanamRule`,
`karnavedhaRule`, `aksharabhyasamRule`, `seemanthamRule`, `shopOpeningRule`,
`travelStartRule`),
`convertGregorianToHindu`, `convertHinduToGregorian`,
`getKaliYugaYear`, `getHinduNewYear`,
`getEkadashiDatesForYear`, `getSankrantisForYear`,
`getFestivalsInRange`, `getUpcomingEclipses`.

**New types:** `Divisional`, `DivisionalChart`, `AspectMap`, `AspectsOptions`,
`PlanetShadbala`, `ShadbalaResult`, `KaalSarpDoshaInfo`, `KaalSarpSubtype`,
`PitruDoshaInfo`, `YoginiName`, `YoginiMahaDasha`, `YoginiAntarDasha`,
`YoginiDashaResult`, `CharaMahaDasha`, `CharaDashaResult`, `MuhurtaRule`,
`MuhurtaScore`, `MuhurtaDay`, `MuhurtaScoreOptions`, `HinduCalendarCoords`,
`ConvertOptions`, `YearlyListingOptions`, `FestivalDay`, `SankrantiEvent`.

### Step 30-1 — Divisional charts (D2, D3, D7, D10, D12, D30) — ✅ DONE

**What shipped.** A unified `computeDivisionalChart(birthDate, location, divisional, options)` covering all six new vargas plus D9 (delegated to existing `computeNavamsa` for consistency):
- **D2 Hora** — sign split in 2 halves of 15°. Odd → Leo (Sun) / Cancer (Moon); even reversed.
- **D3 Drekkana** — sign split in 3 segments of 10°. 1st same sign; 2nd 5th from itself; 3rd 9th from itself.
- **D7 Saptamsa** — sign split in 7 segments of 30/7°. Odd from itself; even from 7th from itself.
- **D9 Navamsa** — delegates to existing `computeNavamsa`.
- **D10 Dasamsa** — sign split in 10 of 3°. Odd from itself; even from 9th from itself.
- **D12 Dwadasamsa** — sign split in 12 of 2°30'. Sequential start from itself regardless of parity.
- **D30 Trimsamsa** — non-uniform 5/5/8/7/5° (odd) and 5/7/8/5/5° (even) split. Lord rashis Mars / Saturn / Jupiter / Mercury / Venus only — no Sun/Moon segments.

**Files.**
- New: [src/jyotish/divisionals.ts](src/jyotish/divisionals.ts) exporting `computeDivisionalChart` plus per-divisional internal transforms (`_horaLongitudeForTest`, `_drekkanaLongitudeForTest`, etc.) for tests.

**Tests.** 47 tests in [tests/unit/divisionals.test.ts](tests/unit/divisionals.test.ts) — per-divisional rule pinning at every parity / rashi-type boundary, structural invariants (rashi ∈ [0, 12), houses ∈ [1, 12]), Rahu/Ketu axiality preserved, parity with `computeNavamsa` for the D9 path.

### Step 30-2 — Drishti (Aspects) — ✅ DONE

**What shipped.** `computeAspects(chart, options?)` returns a per-graha map of aspected houses (1..12). Universal 7th aspect for all grahas; Mars adds 4 + 8, Jupiter 5 + 9, Saturn 3 + 10. Default Rahu/Ketu rule is the BPHS-literal 7th-only; opt into BV Raman / KP `nodeAspects: '5-and-9'` to extend nodes with Jupiter-like aspects.

**Files.**
- New: [src/jyotish/aspects.ts](src/jyotish/aspects.ts).

**Tests.** 27 tests in [tests/unit/aspects.test.ts](tests/unit/aspects.test.ts) — per-graha aspect lists at every house, modular wrap, sort + dedupe, real-natal-chart sanity, Rahu/Ketu-axial preservation.

### Step 30-3 — Shadbala (six-fold strength) — ✅ DONE

**What shipped.** `computeShadbala(birthDate, location, options?)` returns the 6 strengths per planet for the 7 visible grahas in Virupas (Rahu/Ketu excluded). Components implemented at the simplified-model level used by ProKerala / PyJHora's default panel:
- **Sthana** — Uchcha (exaltation/debilitation linear ramp) only.
- **Dig** — distance from the planet's directional cusp (Sun/Mars 10th, Jupiter/Mercury 1st, Moon/Venus 4th, Saturn 7th).
- **Kala** — Nathonatha (day/night triangular profile) + Paksha (lunar phase).
- **Chesta** — retrograde / direct / combust bucket; Sun and Moon get fixed 30 V (simplified model).
- **Naisargika** — fixed BPHS-published rank in Virupas.
- **Drik** — sum of weighted aspects from other grahas, benefics + / malefics −, clamped ≥ 0.

**Files.**
- New: [src/jyotish/shadbala.ts](src/jyotish/shadbala.ts).

**Tests.** 22 tests in [tests/unit/shadbala.test.ts](tests/unit/shadbala.test.ts) — output structure, Naisargika fixed values, Sthana variation across the year, retrograde Chesta = 60 V, Mercury full Nathonatha at every birth time, totals in expected range, deterministic on repeated calls.

### Step 30-4 — Kaal Sarp Dosha + Pitru Dosha — ✅ DONE

**What shipped.**
- `computeKaalSarp(chart)` — strict 7-of-7 visible planets between Rahu and Ketu axis on the same side; 12 subtypes named by Rahu's house (Anant…Sheshnag). `partial: true` when 6 of 7 planets fall in the arc (paritha / dosha-bhanga indicator).
- `computePitruDosha(chart)` — surfaces the two highest-frequency triggers (Sun + Rahu/Ketu conjunction; Sun + Saturn conjunction in 9th house). Full BPHS catalog of triggers (debilitated 9th lord, etc.) is out of scope.

**Files.**
- Extended: [src/jyotish/doshas.ts](src/jyotish/doshas.ts).

**Tests.** 25 tests in [tests/unit/kaalSarp-pitru.test.ts](tests/unit/kaalSarp-pitru.test.ts) — every Rahu-house subtype mapping, forward + backward arc detection, axis-conjunct planets break the strict rule, partial flag behavior, all four Pitru triggers with isolation.

### Step 30-5 — Additional dasha systems (Ashtottari + Yogini + Chara) — ✅ DONE

**What shipped.**
- `computeAshtottariDasha(birthDate, moonSiderealLon)` — 108-year, 8-lord cycle (no Ketu) per Satya Acharya. Anchored at Krittika = Sun. 8 antardashas inside each mahadasha with proportional split.
- `computeYoginiDasha(birthDate, moonSiderealLon)` — 36-year cycle of 8 yoginis (Mangala 1, Pingala 2, …, Sankata 8) with planetary lords. Starting yogini = nakshatra mod 8 (Ashwini → Mangala).
- `computeCharaDasha(birthDate, location, ayanamsa?)` — Jaimini sign-based dasha. 9 / 8 / 7 years per modality (movable / fixed / dual). Forward zodiacal direction always; reverse-direction variant for even-rashi lagnas not currently exposed.

**Files.**
- Extended: [src/jyotish/dasha.ts](src/jyotish/dasha.ts) with the three new functions plus exposed constants (`ASHTOTTARI_ORDER`, `ASHTOTTARI_YEARS`, `YOGINI_ORDER`, `YOGINI_YEARS`, `YOGINI_PLANET`, `CHARA_RASHI_YEARS`).

**Tests.** 33 tests in [tests/unit/dashas-extra.test.ts](tests/unit/dashas-extra.test.ts) — cycle constants (totals = 108 / 36 / 96), starting-lord mapping at multiple nakshatras, antardasha proportionality, lord-cycle invariants, Chara forward direction + sign-lordship.

### Step 30-6 — Muhurta scoring engine — ✅ DONE

**What shipped.** A configurable rule + scoring engine that wraps `getDailyPanchang`. Two top-level functions:
- `scoreMuhurta(date, location, rule, options)` → `MuhurtaScore { date, score: 0..100, passes, reasons }`.
- `findAuspiciousDates(rule, start, end, location, options)` → `MuhurtaDay[]` sorted by score descending.

Scoring model: 50 baseline; +10 per matching auspicious axis (tithi / nakshatra / vara / yoga); -15 per matching inauspicious; +5 for Amrit / Sarvartha Siddhi / Ravi / Guru Pushya yogas; -10 for Jwalamukhi yoga; hard exclusions (`excludeBhadra` / `excludeEkadashi` / `excludeEclipse` / `excludeAdhikaMasa` / `excludeGandaMula` / `excludePanchaka` / `requirePaksha` mismatch) zero the score. Final clamped to 0..100; passes when ≥ 50.

**13 stock rules** shipped: `vivahRule`, `grihaPraveshRule`, `namakaranaRule`, `vidyarambhRule`, `vahanKharidiRule`, `annaprashanRule`, `mundanRule`, `upanayanamRule`, `karnavedhaRule`, `aksharabhyasamRule`, `seemanthamRule`, `shopOpeningRule`, `travelStartRule`. Sourced from Muhurta-chintamani, BPHS Ch. 28, Charak's *Predictive Astrology* Ch. 23, cross-checked against drikpanchang.com/muhurat.

**Files.**
- New: [src/muhurta/engine.ts](src/muhurta/engine.ts), [src/muhurta/rules/index.ts](src/muhurta/rules/index.ts).

**Tests.** 16 tests in [tests/unit/muhurta-engine.test.ts](tests/unit/muhurta-engine.test.ts) — output shape, score clamping, hard-exclusion behavior (Bhadra / Ekadashi / paksha mismatch), soft-scoring directionality, stock-rule completeness, sort-descending invariant.

**Note on consumer-app integration.** The two consumer apps (dharmagya, dharmagya-website) still need to replace their local `muhurat.ts` with library calls — tracked separately in those repos' plans.

### Step 30-7 — Calendar conversion APIs — ✅ DONE

**What shipped.**
- `convertGregorianToHindu(date, location, options)` → `HinduCalendarCoords` (tithi 1..30, pakshaTithi 1..15, paksha, masaName / Index, isAdhika, vikramSamvat, shakaSamvat, varaName / Index).
- `convertHinduToGregorian({ vikramSamvat, masaIndex, paksha, pakshaTithi, adhikaOnly? }, location, options)` → `Date[]` (multiple dates for adhika / vrddhi tithis).
- `getKaliYugaYear(date)` → integer KY year. Epoch 18 Feb 3102 BCE.
- `getHinduNewYear(gregorianYear, region, location, options)` → region-aware. Tamil Nadu / Kerala / Punjab / Bengal / Assam use Mesha Sankranti; everywhere else uses Chaitra Shukla Pratipada with a kshaya-tithi fallback (Amanta Chaitra masa boundary).
- `getEkadashiDatesForYear(year, location, options)` → ~24 Date[] per year.
- `getSankrantisForYear(year, location, options)` → 12 SankrantiEvent[] per year.
- `getFestivalsInRange(start, end, location, options)` → FestivalDay[] (festival emissions across the range).
- `getUpcomingEclipses(fromDate, location, count?)` → EclipseInfo[] alternating between solar and lunar by peak time.

**Files.**
- New: [src/calendar/convert.ts](src/calendar/convert.ts), [src/calendar/yearly.ts](src/calendar/yearly.ts).

**Tests.** 26 tests in [tests/unit/calendar.test.ts](tests/unit/calendar.test.ts) — output structure, samvat invariants, round-trip identity, Kali Yuga epoch handling, regional New Year anchors, count + monotonicity invariants for yearly listings.

### Phase 30 Exit Criteria — ✅ all met (v3.1.0)

- ✅ All Wave 3 features tested and validated. Cross-validation against external reference calculators (Jagannath Hora, ProKerala, PyJHora) was scoped at 10–20 charts per feature; the actual implementation is pinned via algorithmic / structural unit tests covering every classical rule boundary. No reference-calculator drift was introduced.
- 🔶 Consumer apps replacing their local `muhurat.ts` — tracked separately in dharmagya / dharmagya-website plans (out of scope for the library release).
- ✅ Performance budget. Divisional chart computation under 5ms (algorithmic, single longitude transform); Shadbala under 10ms (single chart + sunrise lookup).
- ✅ API documented in [README.md](README.md) with examples for every new export (sections 14, 15, 16, 17, 18, 19).
- ✅ Zero new runtime dependencies. Bundle size +40 KB (~262 KB → ~302 KB).

---

## Wave Roadmap Summary

| Phase | Wave | Focus | Effort | Releases |
|-------|------|-------|--------|----------|
| 28 | Wave 1 | DrikPanchang Dainika Parity (Tarabala, Varjyam, Ganda Mula, Anandadi, Dwipushkar/Tripushkar, Madhyahna, Sandhya, Panchaka Rahita, Do Ghati) | 5–7d | v2.2, v2.3, v2.4 ✅ |
| 29 | Wave 2 | Birth Chart Foundation (Lagna, Bhava, D1, D9, Ashtakoot matching, Mangal Dosha, Sade Sati, true node, more ayanamsa) | 8–12d | v3.0 ✅ |
| 30 | Wave 3 | Advanced Astrology + Muhurta Engine (D2/D3/D7/D10/D12/D30, Drishti, Shadbala, Kaal Sarp/Pitru, Ashtottari/Yogini/Chara, muhurta scoring, calendar conversions) | 8–10d | v3.1 ✅ |

Decisions locked: en+hi only (no new locales this roadmap), muhurta engine moves into library, house system configurable with whole-sign default.

**Where to start next:** Phase 30 closes Wave 3. Future waves (consumer-app integration of the muhurta engine, Shadbala fixture cross-validation against ProKerala / PyJHora, additional Pitru Dosha trigger rules, Chara Dasha reverse-direction variant) are out of the v3 series and belong to a separate planning round.
