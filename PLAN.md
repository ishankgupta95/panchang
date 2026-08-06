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
- `src/jyotish/` — planetary positions, lagna, bhava, charts, divisional
  charts (D2/D3/D7/D9/D10/D12/D30), aspects, shadbala, doshas (Mangal,
  Kaal Sarp, Pitru), dashas (Vimshottari, Ashtottari, Yogini, Chara),
  Ashtakoot matching, Sade Sati, dignity, Tarabala, Chandra Balam.
- `src/muhurta/` — muhurta scoring engine + 13 stock occasion rules.
- `src/calendar/` — Greg↔Hindu conversion, Kali Yuga year, Hindu New Year,
  yearly listings (Ekadashi, Sankrantis, festivals, eclipses).
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
| 21 | Festival rule system — `FestivalDateRule`, canonical-time anchors, transit-based Sankranti, nakshatra+solarMasa rules, Ekadashi Dashami-viddha detection | — | ✅ |
| 22 | Sanskrit locale removed — `Language` narrowed to `'en' \| 'hi'` (breaking) | v2.0.0 | ✅ |
| 23 | Classical correctness — Bhadra Kala, Smarta/Vaishnava Ekadashi split, 24 named Ekadashis + 14 named Pradoshas, long-tithi dedupe, Adhika nuance, Purnimanta naming | v2.0.0 | ✅ |
| 24 | Festival coverage expansion — Chhath, Vat Savitri, Upakarma, Onam, Masik Shivaratri, Vinayaka Chaturthi, Pushya, weekday-recurring; new rule kinds; `region` option | v2.0.0 | ✅ |
| 25 | Astronomy — eclipse detection (solar + lunar with sutak), muhurta library completion (Vijaya, Godhuli, Nishita, Amrit Kala) | v2.0.0 | ✅ |
| 26 | Diaspora & API polish — non-IST cross-verification (NYC/London/Sydney/Dubai/Singapore + DST), `getInstantPanchang` limitations documented | v2.0.0 | ✅ |
| 27 | Regional festival expansion — state-slug `FestivalRegion` (21 states + nepal), allow-list `regions[]`, transit-adjacent emissions, 10 new regional festivals, Bathukamma markers, orphan-region sweep | v2.1.0 | ✅ |
| 28 | DrikPanchang dainika parity — Tarabala, Varjyam, Ganda Mula, Madhyahna, Pratah/Sayahna Sandhya, Dinamana/Ratrimana, Anandadi Yoga, 6 special yogas, Panchaka Rahita, Do Ghati Muhurta | v2.2 → v2.4 | ✅ |
| 29 | Birth Chart Foundation — Lagna, Bhava (3 house systems), D1/D9, Ashtakoot 36-pt matching, Mangal Dosha, Sade Sati, Pratyantar dashas, planetary dignity, true Rahu node, True Chitra + Thirukanitham ayanamsas | v3.0.0 | ✅ |
| 30 | Advanced Astrology + Muhurta Engine — D2/D3/D7/D10/D12/D30, Drishti, Shadbala, Kaal Sarp + Pitru, Ashtottari/Yogini/Chara dashas, muhurta scoring engine + 13 stock rules, calendar conversion APIs | v3.1.0 | ✅ |
| 31 | Ashtakavarga + Yoga detection + Jaimini Karakas + Bhava Bala (Wave 4a — pan-Indian Parashara core) | v3.2.0 | ✅ |
| 32 | Varshaphala + Tithi Pravesha + Arudha + Special Lagnas + Upagrahas + Argala (Wave 4b — North-Indian + remaining classical layers) | v3.3.0 | ✅ |
| 33 | Pathu Porutham + Narayan Dasha + KP sub-lord layer + Prashna foundation (Wave 4c — South-Indian regional features) | v3.4.0 | ✅ |
| 34 | Drik Panchang / pandit parity sweep — doshas, marriage-matching cancellations, yoga bhanga, fixture harness, specialist completeness (sub-phases 34a–34e) | v4.x (4.0.0 baseline) | ✅ code-complete |
| 35 | Static data tables (engine-free subpaths) — festivals, eclipses, moon-phases; runtime builders (Wave 6 — offline distribution). **Bundled JSONs removed in v5 — consumers build and cache their own; see the Phase 35 v5 note.** | v4.2.0 → v4.3.0 | 🚧 eclipses + moon-phases code-complete, uncommitted |

State as of v3.4.0: **7,707 tests** passing across 95 files. Bundle ~361 KB CJS.
Festival registry: 80+ entries. Diaspora cross-verified across 5 non-IST cities.
Hermes CI green.

State as of Phase 35 (static tables, 2026-05-30): **8,164 tests** passing across
100 files; typecheck clean. Three engine-free data subpaths: `panchang-ts/festivals`
(shipped v4.2.0), `panchang-ts/eclipses` + `panchang-ts/moon-phases` (pending the
next minor). Each ships bundled JSON + a runtime `build*Table` for other locations.

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
| Lagna degree-in-rashi (21 R-tier charts) | ±1.0° | ≤0.093° |
| Planet rashi placement (D1, 21 charts × 9 planets) | exact | exact 189/189 |
| Planet degree-in-rashi (21 R-tier charts) | ±0.5° | ≤0.5° |
| Sade Sati arc boundary (20 charts) | ±2 days | ≤2 days |

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

## Shipped phases (compact summaries)

The detailed plan-time notes for shipped phases have been compacted; the
source of truth is the code (`src/`), the tests (`tests/`), and
[CHANGELOG.md](CHANGELOG.md). One-paragraph summaries kept here for context.

### Phase 28 — DrikPanchang Dainika Parity (Wave 1, v2.2 → v2.4) ✅

Closed the visible gap with [drikpanchang.com](https://www.drikpanchang.com/panchang/day-panchang.html)'s
day panchang. Shipped Tarabala (`computeTarabala`), Varjyam (elastic-ghatika
window, [src/core/varjyam.ts](src/core/varjyam.ts)), Ganda Mula detection,
Madhyahna + Pratah/Sayahna Sandhya + Dinamana/Ratrimana labels, Anandadi
Yoga (28-name vara×nakshatra cycle), six new special yogas (Dwipushkar,
Tripushkar, Jwalamukhi, Aadal, Vidaal, Ravi), Panchaka Rahita slices, and
Do Ghati Muhurta (15+15 named slots). Strict parity asserted on 50
DrikPanchang fixtures: sunrise/sunset ±3 min, Madhyahna ±1 min, Sandhya
windows ±2 min, Varjyam ±2 min, Anandadi name + Ganda Mula `active` exact.
6,048 tests passed at exit.

### Phase 29 — Birth Chart Foundation (Wave 2, v3.0.0) ✅

Added the kundli foundation: Lagna ([src/jyotish/lagna.ts](src/jyotish/lagna.ts)
via Meeus eq. 13.6), Bhava with three house systems (whole-sign default,
equal, Placidus-KP) [src/jyotish/bhava.ts](src/jyotish/bhava.ts), D1
([src/jyotish/charts.ts](src/jyotish/charts.ts)), D9 (classical sign-based
movable/fixed/dual rule), Ashtakoot 36-point matching with all 8 koots +
Bhakoot/Nadi cancellations [src/jyotish/matching.ts](src/jyotish/matching.ts),
Mangal Dosha (3-cut from lagna/Moon/Venus), Sade Sati with 7-day boundary
search [src/jyotish/sadeSati.ts](src/jyotish/sadeSati.ts), Pratyantar dashas
extending Vimshottari, planetary dignity tables [src/jyotish/dignity.ts](src/jyotish/dignity.ts),
true-node Rahu/Ketu (Meeus Ch. 47 single periodic correction), True
Chitrapaksha + Thirukanitham ayanamsas. External cross-validation against
21 AstroSage R-tier celebrity charts (D1) + 30+ DrikPanchang Ashtakoot
pairs + 20 ProKerala/DrikPanchang Sade Sati charts. 6,912 tests passed.

### Phase 30 — Advanced Astrology + Muhurta Engine (Wave 3, v3.1.0) ✅

Built on Phase 29: divisional charts D2/D3/D7/D10/D12/D30 in
[src/jyotish/divisionals.ts](src/jyotish/divisionals.ts), Drishti aspects
[src/jyotish/aspects.ts](src/jyotish/aspects.ts), Shadbala (simplified
Sthana/Dig/Kala/Chesta/Naisargika/Drik per ProKerala/PyJHora's published
panel) [src/jyotish/shadbala.ts](src/jyotish/shadbala.ts), Kaal Sarp + Pitru
doshas (extended [src/jyotish/doshas.ts](src/jyotish/doshas.ts)), three new
dashas (Ashtottari, Yogini, Chara — extended [src/jyotish/dasha.ts](src/jyotish/dasha.ts)),
muhurta scoring engine + 13 stock occasion rules
([src/muhurta/engine.ts](src/muhurta/engine.ts) + [src/muhurta/rules/index.ts](src/muhurta/rules/index.ts)),
calendar conversion APIs (Greg↔Hindu, Kali Yuga year, region-aware Hindu
New Year, yearly Ekadashi/Sankranti/festival/eclipse listings) in
[src/calendar/convert.ts](src/calendar/convert.ts) and
[src/calendar/yearly.ts](src/calendar/yearly.ts). 7,156 tests passed.

---

## Phase 31 — Ashtakavarga + Yogas + Karakas + Bhava Bala (Wave 4a) — ✅ shipped (v3.2.0)

**Goal.** Cover the three highest-impact gaps in the v3 surface — Ashtakavarga
is the single biggest classical feature missing; named-yoga detection is what
every kundli app surfaces; Karakas are trivial but unblock Jaimini analysis
built on Chara Dasha (already shipped). Bhava Bala is the natural companion
to Phase 30's Shadbala.

**Release.** Single **v3.2.0** minor (additive — no v3.1 breakage).

**Critical decisions (locked).**
- Yoga catalog scope = a **fixed catalog of ~25 named yogas**, declarative
  rules, not a generative engine. Adding new yogas is a data-only change.
- Ashtakavarga reductions (Trikona Sodhana + Ekadhipatya Sodhana) implemented
  per BPHS Ch. 67 verbatim and exposed under `{ reductions: true }`.
- Karakas use the 7-Karaka Parashara variant (no reversed Rahu); 8-Karaka
  Jaimini variant deferred.
- Bhava Bala reuses Phase 30 Shadbala internals — no recomputation.

**New API surface (re-exported from `src/index.ts`).**
`computeAshtakavarga`, `computeYogas`, `computeJaiminiKarakas`,
`computeBhavaBala`.

**New types.**
`AshtakavargaResult`, `BhinnashtakaGrid`, `Yoga`, `YogaName`, `YogaType`,
`KarakaName`, `JaiminiKarakas`, `BhavaBalaResult`, `BhavaBalaPerHouse`.

### Step 31-1 — Ashtakavarga (Sarvashtaka + Bhinnashtaka)

**What.** Per-graha 12-rashi bindu grids (Bhinnashtaka) and the summed
Sarvashtaka grid. Optional Trikona + Ekadhipatya reductions.

**Algorithm.**

For each receiver graha G ∈ {Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn},
and each contributor S ∈ {Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn,
Lagna} (8 contributors), look up `BENEFIC_OFFSETS[G][S]: number[]` — the set
of relative house-positions from S where S contributes a bindu to G's grid.
Place a bindu in each rashi `(S_rashi + offset - 1) % 12` for offset ∈
the lookup. Sum across all 8 contributors → Bhinnashtaka(G), a 12-cell
0..8-bindu grid. Sum across the 7 receivers → Sarvashtaka, a 12-cell
0..56-bindu grid.

The 7 × 8 = 56 BENEFIC_OFFSETS lists are encoded as a single static table
sourced verbatim from BPHS Ch. 66 (Phaladeepika Ch. 31 cross-checks).

**Reductions** (opt-in via `{ reductions: true }`):
- *Trikona Sodhana* — for each rashi-trikona triad (1/5/9, 2/6/10, 3/7/11,
  4/8/12), zero out the bindus in the cells that have non-minimum values
  per BPHS Ch. 67 rule.
- *Ekadhipatya Sodhana* — for each pair of rashis sharing a single graha
  ruler (e.g., Aries+Scorpio share Mars), apply the BPHS Ch. 67 reduction
  rule across the pair.

**Files.**
- New: `src/jyotish/ashtakavarga.ts` — `computeAshtakavarga(chart, options?)`.
- New: `src/jyotish/ashtakavargaTables.ts` — `BENEFIC_OFFSETS[7][8] →
  readonly number[]`. Frozen-array, hand-typed from BPHS.

**API.**
```typescript
interface AshtakavargaResult {
  sarvashtaka: number[];                                // length 12, 0..56
  bhinnashtaka: Record<GrahaName, number[]>;            // 7 grahas, each 12-cell
  reduced?: { sarvashtaka: number[]; bhinnashtaka: Record<GrahaName, number[]> };
}

function computeAshtakavarga(
  chart: BirthChart,
  options?: { reductions?: boolean },
): AshtakavargaResult;
```

**Tests.** `tests/unit/ashtakavarga.test.ts` —
- Per-graha BENEFIC_OFFSETS table pin (every cell).
- Sum invariants: Sarvashtaka total = sum over all 7 receivers' Bhinnashtaka
  totals.
- 10-chart cross-validation against ProKerala's free Ashtakavarga panel:
  cell-by-cell exact match (it's an integer count, no rounding).
- Reduction unit cases against worked BPHS Ch. 67 examples.

**Sources.** BPHS Chs. 66 + 67; Phaladeepika Ch. 31; Sanjay Rath *Visti Nadi*;
ProKerala / AstroSage published panels.

**Effort.** ~3–4d.

### Step 31-2 — Yoga detection (named-catalog)

**What.** Detect ~25 named classical yogas from a `BirthChart`. Each is a
declarative rule consuming `{chart, dignity, aspects, karakas}`.

**Catalog.**

| Yoga | Type | Rule |
|------|------|------|
| Ruchaka | mahapurusha | Mars in own/exalted (Aries, Scorpio, Capricorn) AND in kendra |
| Bhadra | mahapurusha | Mercury in own/exalted (Gemini, Virgo) AND in kendra |
| Hamsa | mahapurusha | Jupiter in own/exalted (Sag, Pisces, Cancer) AND in kendra |
| Malavya | mahapurusha | Venus in own/exalted (Taurus, Libra, Pisces) AND in kendra |
| Sasha | mahapurusha | Saturn in own/exalted (Cap, Aqua, Libra) AND in kendra |
| Gajakesari | lunar | Jupiter in 1st/4th/7th/10th from Moon |
| Sunapha | lunar | planet (not Sun, Rahu, Ketu) in 2nd from Moon |
| Anapha | lunar | planet (not Sun, Rahu, Ketu) in 12th from Moon |
| Durudhura | lunar | planets (not Sun) in BOTH 2nd and 12th from Moon |
| Kemadruma | lunar (-) | NO planet in 2nd, 12th from Moon, AND Moon not conjunct any planet |
| Budha-Aditya | solar | Sun + Mercury conjunct in same rashi |
| Veshi | solar | planet (not Moon) in 2nd from Sun |
| Vasi | solar | planet (not Moon) in 12th from Sun |
| Ubhayachari | solar | planets (not Moon) in BOTH 2nd and 12th from Sun |
| Raja Yoga (generic) | raja | kendra-lord conjunct/aspecting trikona-lord |
| Dharma-Karmadhipati | raja | 9th lord + 10th lord conjunct or in mutual aspect |
| Vipareeta Raja Yoga | raja | 6th/8th/12th lords mutually conjunct in 6/8/12 |
| Lakshmi Yoga | raja | 9th lord exalted/own + Venus exalted/own |
| Dhana Yoga (2-11) | dhana | 2nd lord + 11th lord conjunct |
| Dhana Yoga (5-9) | dhana | 5th lord + 9th lord conjunct |
| Vasumati Yoga | dhana | benefics in 3, 6, 11, 12 from lagna |
| Vargottama | special | a graha occupies same rashi in D1 and D9 |
| Yogakaraka | special | per lagna: Mars (Cancer/Leo), Saturn (Taurus/Libra), Venus (Cap/Aqua) |
| Neecha Bhanga | cancellation | dispositor of debilitated planet in kendra; OR exalted graha in same kendra; OR debilitation-rashi-lord in kendra (multiple BPHS rules — flag any-of) |
| Daridra Yoga | negative | 11th lord in 12th, OR Wealth-house lord in dusthana (6/8/12) |

**Files.**
- New: `src/jyotish/yogas.ts` — `computeYogas(chart, options?)`.
- New: `src/jyotish/yogasCatalog.ts` — array of `YogaRule` declarations.
  Each rule is `(chart, dignity, aspects, karakas) → YogaMatch | null`.

**API.**
```typescript
type YogaType = 'mahapurusha' | 'lunar' | 'solar' | 'raja' | 'dhana'
              | 'special' | 'cancellation' | 'negative';

interface Yoga {
  name: string;          // e.g. 'Gajakesari', 'Ruchaka'
  type: YogaType;
  reasons: string[];     // e.g. ['Jupiter in 4th from Moon (kendra)']
}

function computeYogas(chart: BirthChart, options?: {
  /** Restrict to subset of types. */
  types?: readonly YogaType[];
}): Yoga[];
```

**Tests.** `tests/unit/yogas.test.ts` — per-yoga unit cases (positive +
negative + boundary) + real-chart sanity sweep using Phase 29 fixtures.
*Pinned expected sets per fixture* — adding a yoga to the catalog must
extend an explicit fixture pin so coverage remains traceable.

**Sources.** BPHS Chs. 36–43; Phaladeepika Ch. 6; B.V. Raman *Three
Hundred Important Combinations*; Sanjay Rath *Crux of Vedic Astrology*
Ch. 9.

**Effort.** ~3–4d.

### Step 31-3 — Jaimini Karakas

**What.** 7 Karakas ranked by descending degree-in-rashi of the 7 visible
grahas: Atmakaraka (highest), Amatyakaraka, Bhratrukaraka, Matrukaraka,
Putrakaraka, Gnatikaraka, Darakaraka.

**Algorithm.**
```
karakas = [Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn]
  .sort((a, b) => chart.planets[b].degreeInRashi - chart.planets[a].degreeInRashi)
```
Position 0 → Atmakaraka, 1 → Amatyakaraka, …, 6 → Darakaraka.

Edge case: if two grahas have identical degrees-in-rashi (rare, hand-coded
sort stable break by graha order). Document as a known tie-break convention.

**Files.**
- New: `src/jyotish/karakas.ts` — `computeJaiminiKarakas(chart)`.

**API.**
```typescript
type KarakaName = 'Atmakaraka' | 'Amatyakaraka' | 'Bhratrukaraka'
                | 'Matrukaraka' | 'Putrakaraka' | 'Gnatikaraka' | 'Darakaraka';

function computeJaiminiKarakas(chart: BirthChart): Record<KarakaName, GrahaName>;
```

**Tests.** Unit cases pinning sort behavior (synthetic charts with known
degrees) + 5-chart cross-check against PyJHora's Karaka panel.

**Effort.** ~0.5d.

### Step 31-4 — Bhava Bala

**What.** BPHS Ch. 27 four-source house-strength: Bhavadhipati Bala (lord's
Shadbala), Bhava Dik Bala (directional), Bhava Drik Bala (aspect-summed),
Bhavasthana Bala (occupying-planet strength).

**Algorithm.**
- *Bhavadhipati Bala* — for each bhava, the Shadbala total of the rashi-lord
  (already computed in Phase 30).
- *Bhava Dik Bala* — fixed BPHS table per bhava direction.
- *Bhava Drik Bala* — sum of weighted aspects from all 7 grahas onto the
  bhava cusp; reuse Phase 30 aspect weights, benefic positive / malefic
  negative, clamp ≥ 0.
- *Bhavasthana Bala* — sum of Naisargika Bala of grahas occupying the
  bhava (positive for benefics, negative for malefics).

Total Bhava Bala for a bhava = sum of these four terms.

**Files.**
- Extend `src/jyotish/shadbala.ts` — add `computeBhavaBala(birthDate,
  location, options?)`.

**API.**
```typescript
interface BhavaBalaPerHouse {
  bhavadhipati: number;
  dik: number;
  drik: number;
  sthana: number;
  total: number;
}

interface BhavaBalaResult {
  houses: BhavaBalaPerHouse[];   // length 12
}

function computeBhavaBala(birthDate: Date, location: GeoLocation,
                          options?: BirthChartOptions): BhavaBalaResult;
```

**Tests.** Structural invariants (12 entries, totals positive) + 5-chart
spot-check vs PyJHora's Bhava Bala panel.

**Sources.** BPHS Ch. 27 (the second half); Sanjay Rath *Crux of Vedic
Astrology* Ch. 6.

**Effort.** ~1.5d.

### Phase 31 Exit Criteria

- ✅ All 4 modules with full unit + cross-validation tests; ~120 new tests.
- ✅ ProKerala Ashtakavarga: 10-chart cell-exact match.
- ✅ Bundle target: ≤ 340 KB CJS (was 302).
- ✅ Hermes JS-syntax check; typecheck clean.
- ✅ API additive — no v3.1 breakage.
- ✅ README sections added with examples for each new export.

---

## Phase 32 — Varshaphala + Tithi Pravesha + Arudha + Special Lagnas + Upagrahas + Argala (Wave 4b) — ✅ shipped (v3.3.0)

**Goal.** Round out the niche-but-classical surface. Varshaphala is the
single biggest piece; Tithi Pravesha is its South-Indian counterpart and
shares the solar-search machinery. The rest are small modules that belong
together as the "remaining classical chart layers."

**Release.** Single **v3.3.0** minor.

**Critical decisions (locked).**
- Sahams scope = the **27-Saham core set**; the extended 50-Saham list is
  deferred. List documented in `src/jyotish/sahamsTables.ts`.
- Tajik Sahams day/night swap rules follow **Neelakantha** (Tajika
  Neelakanthi); other Tajik sources (Hari Hara) diverge — documented.
- Tithi Pravesha implementation follows **PVR Narasimha Rao's redefinition**
  (Sun in natal sign + Sun-Moon angle = natal Sun-Moon angle) rather than
  the older calendar-anniversary heuristic.
- Arudha computation uses the **Jaimini standard** (Sanjay Rath
  *Jaimini Maharishi's Upadesa Sutras* Ch. 1) — including the two
  exceptions (lord in own bhava → 10th from lord; lord in 7th from
  bhava → 4th from lord).
- Upagraha Gulika is the **rising longitude at the start of Saturn's
  segment** (1/8 of day or night per weekday-lord rotation). Mandi is
  Gulika's variant at the segment midpoint.

**New API surface.**
`computeVarshaphala`, `computeTithiPravesha`, `computeArudhas`,
`computeHoraLagna`, `computeGhatiLagna`, `computeBhavaLagna`,
`computeUpagrahas`, `computeArgala`.

### Step 32-1 — Varshaphala (Tajik annual chart)

**What.** Solar-return chart for a given age + the classical Tajik
analytical layer (Muntha, year-lord, 27 Sahams).

**Algorithm.**

*Solar return instant.* For year-N (1-indexed from age 0 = birth year),
binary-search around the calendar anniversary (`birthDate + N×365.25 days`)
for the UTC instant when `siderealSun(t) = natalSiderealSun ± 0.0001°`.
Convergence ≤25 iterations.

*Muntha.* `munthaRashi = (natalLagnaRashi + N) % 12`. Muntha lord = rashi
lord of `munthaRashi`. Muntha house = `((munthaRashi - varshaLagnaRashi
+ 12) % 12) + 1`.

*Year lord (Varsha Pati).* Pick the strongest of:
- Muntha lord.
- Lagna lord (varsha-chart).
- Lord of the Sun's rashi at varsha instant.
- Triraashi Pati (3-rashi-trine ruler).
- Muntha-rashi Pati.

"Strongest" = highest Tajik bala (simplified to total Shadbala from Phase
30 since Tajik bala is itself a Shadbala variant).

*Sahams.* 27 sensitive points, each `Saham = (lon_X − lon_Y + lon_Z) mod
360°`. Day-birth and night-birth swap X and Y for some Sahams (per the
Neelakantha rules in the table). The 27 core Sahams: Punya, Vidya, Yasas,
Mitra, Karma, Vivaha, Putra, Roga, Marana, Rajya, Raja, Bandhu, Dharma,
Gnati, Apamrityu, Bhratri, Matri, Pitri, Sama, Bandhana, Karyasiddhi,
Vyapara, Sastra, Asha, Labha, Susha, Tapas.

**Files.**
- New: `src/jyotish/varshaphala.ts` — `computeVarshaphala`.
- New: `src/jyotish/sahamsTables.ts` — formula table for 27 Sahams.

**API.**
```typescript
interface VarshaphalaChart {
  solarReturnInstant: Date;
  varshaLagna: LagnaInfo;
  muntha: { rashi: number; lord: GrahaName; house: number };
  yearLord: GrahaName;
  sahams: Record<SahamName, { longitude: number; rashi: number; house: number }>;
  planets: PlanetPlacement[];
}

function computeVarshaphala(
  natalBirth: Date,
  yearAge: number,                     // 1-indexed; age=1 → first solar return
  location: GeoLocation,                // defaults to natal location
  options?: BirthChartOptions,
): VarshaphalaChart;
```

**Tests.** `tests/unit/varshaphala.test.ts`:
- Solar-return instant ±1 minute vs ProKerala's free Varshaphala panel
  for 5 fixture charts.
- Muntha rashi exact + Muntha lord exact.
- Year-lord exact match for the same 5 charts.
- 27 Saham longitudes ±0.5° vs PyJHora.

**Sources.** Neelakantha *Tajika Neelakanthi*; B.V. Raman *Annual
Horoscope*; Hari Hara *Tajika Tantra*; PVR Narasimha Rao notes on
Tajik (Saptarishis Astrology); ProKerala free Varshaphala panel.

**Effort.** ~3–4d.

### Step 32-2 — Tithi Pravesha (annual soli-lunar return)

**What.** South-Indian counterpart to Varshaphala. Cast at the moment in
year-N when Sun is in natal sidereal sign AND Moon's angular distance from
Sun equals natal Moon-Sun distance.

**Algorithm.** Two-pass binary search around `birthDate + N×365.25 days`:
1. Locate window where Sun is in natal sidereal sign (~30-day window).
2. Within that window, binary-search the instant where
   `(siderealMoon(t) - siderealSun(t)) mod 360° = (natalMoon - natalSun) mod 360°`
   to ±0.0001°. This is the natal tithi-degree relationship (each tithi
   spans 12°; the exact intra-tithi position is preserved).

**Files.**
- New: `src/jyotish/tithiPravesha.ts` — `computeTithiPravesha`.

**API.**
```typescript
interface TithiPraveshaChart {
  praveshInstant: Date;          // exact tithi-pravesha moment
  natalTithi: number;            // 0..29 (preserved from natal)
  praveshTithi: number;          // 0..29 — should equal natalTithi
  varshaLagna: LagnaInfo;        // lagna at pravesha instant
  planets: PlanetPlacement[];
  bhava: BhavaChart;
}

function computeTithiPravesha(
  natalBirth: Date,
  yearAge: number,
  location: GeoLocation,
  options?: BirthChartOptions,
): TithiPraveshaChart;
```

**Tests.** Pravesha instant ±1 minute vs Sanjay Rath's published TP samples
+ Cosmic Insights' TP calculator (3 fixture charts). Round-trip: tithi at
pravesha instant equals natal tithi (assertion).

**Sources.** Sanjay Rath, *Tithi Pravesha* (srath.com); PVR Narasimha Rao,
*Re-Defining Tithi Pravesha Chart* (Saptarishis Astrology).

**Effort.** ~1d (reuses Varshaphala solar-search machinery).

### Step 32-3 — Arudha Lagna + 12 Arudha Padas

**What.** For each bhava, the Arudha pada — count from the bhava's lord
the same number of houses as the lord is from the bhava itself. Bhava 1's
Arudha = Arudha Lagna (AL).

**Algorithm.**
```
for each bhava B (1..12):
  lordRashi = RASHI_LORD[bhavaRashi[B]]
  D = ((lordRashi - bhavaRashi[B] + 12) % 12) + 1   // 1..12
  arudhaRashi = (lordRashi + D - 1) % 12
  // Exceptions:
  if D == 1 or D == 7:
    arudhaRashi = (lordRashi + 9) % 12  // 10th from lord
```

**Files.**
- New: `src/jyotish/arudha.ts` — `computeArudhas`.

**API.**
```typescript
interface Arudha {
  bhava: number;             // 1..12
  arudhaRashi: number;       // 0..11
  arudhaRashiName: string;
  arudhaLord: GrahaName;
}

function computeArudhas(chart: BirthChart): Arudha[];   // length 12
```

**Tests.** Per-bhava unit cases for both exceptions (lord in own bhava;
lord in 7th from bhava). PyJHora cross-check on 5 charts.

**Sources.** Jaimini *Upadesa Sutras* Ch. 1; Sanjay Rath *Jaimini Maharishi's
Upadesa Sutras* (commentary).

**Effort.** ~1d.

### Step 32-4 — Special Lagnas (Hora, Ghati, Bhava, Sripati)

**What.** Time-derived sensitive lagnas used in classical timing analysis.

**Algorithms.**
- **Hora Lagna** advances 1 rashi per 2 hours from sunrise. From the
  ascendant at sunrise, `horaLagna = ascAtSunrise + (hoursSinceSunrise ×
  15°) mod 360°`.
- **Ghati Lagna** advances 1 rashi per 1 ghatika (24 min) from sunrise.
  `ghatiLagna = ascAtSunrise + (ghatikaSinceSunrise × 30°) mod 360°`.
- **Bhava Lagna** advances 1 rashi per 5 ghatikas (2 hours) from sunrise.
  Same formula as Hora Lagna conceptually but with offset `(5/24)`-scaled
  from sunrise.
- **Sripati Lagna** = Sripati cusp (already partially in `bhava.ts` —
  expose as separate accessor).

**Files.**
- Extend `src/jyotish/lagna.ts` — add `computeHoraLagna`,
  `computeGhatiLagna`, `computeBhavaLagna`, `computeSripatiLagna`.

**API.**
```typescript
function computeHoraLagna(birthDate: Date, location: GeoLocation,
                          ayanamsa?: AyanamsaType): LagnaInfo;
// (same shape for Ghati / Bhava / Sripati)
```

**Tests.** Boundary cases (at sunrise: Hora/Ghati/Bhava lagnas all equal
the natal ascendant; 1h after sunrise: Hora Lagna = Asc + 15°, etc.).
Jagannath Hora cross-check on 3 charts.

**Sources.** BPHS Ch. 4; *Phaladeepika* Ch. 1.

**Effort.** ~1d.

### Step 32-5 — Upagrahas as positions

**What.** Mandi/Gulika as longitudes (vs the existing Gulika *kalam* time
window) and Sun-derived upagrahas (Dhuma, Vyatipata, Parivesha, Indrachapa,
Upaketu) as fixed offsets from sidereal Sun.

**Algorithms.**

*Gulika.* Day birth: divide sunrise → sunset into 8 equal segments. The
weekday lord rotates through Sun → Moon → Mars → Mercury → Jupiter →
Venus → Saturn order; Saturn's segment (1/8 of day) marks Gulika's onset.
Compute the lagna (ascendant) at the onset moment — that's Gulika's
longitude. Night birth: divide sunset → next-sunrise into 8; weekday
rotation continues from where the day left off.

*Mandi.* Identical to Gulika but use the *midpoint* of Saturn's segment.

*Sun-derived.*
- `Dhuma = (sunLon + 133°20') mod 360°`
- `Vyatipata = 360° - Dhuma`
- `Parivesha = (Vyatipata + 180°) mod 360°`
- `Indrachapa = 360° - Parivesha`
- `Upaketu = (Indrachapa + 16°40') mod 360°`

**Files.**
- New: `src/jyotish/upagrahas.ts` — `computeUpagrahas`.

**API.**
```typescript
interface UpagrahaPosition {
  longitude: number;           // sidereal, [0, 360)
  rashi: number;               // 0..11
  house: number;               // 1..12 (relative to natal lagna)
}

interface Upagrahas {
  gulika: UpagrahaPosition;
  mandi: UpagrahaPosition;
  dhuma: UpagrahaPosition;
  vyatipata: UpagrahaPosition;
  parivesha: UpagrahaPosition;
  indrachapa: UpagrahaPosition;
  upaketu: UpagrahaPosition;
}

function computeUpagrahas(birthDate: Date, location: GeoLocation,
                          options?: BirthChartOptions): Upagrahas;
```

**Tests.** Sun-offset upagrahas pinned against synthetic Sun longitudes
(deterministic). Gulika 5-chart cross-check vs PyJHora.

**Sources.** BPHS Ch. 5; Sanjay Rath *Brihat Nakshatra* (upagraha section).

**Effort.** ~1.5d.

### Step 32-6 — Argala (Jaimini intervention)

**What.** Per-bhava arc-influence rules: planets in 2/4/11 from a bhava
form *Argala* (intervention/help); planets in 12/10/3 form *Virodhargala*
(counter).

**Algorithm.** Pure house-arithmetic on `chart.planets`.
```
for each bhava B:
  argala[B] = planets where (planet.house - B + 12) % 12 in {1, 3, 10}  // 2nd, 4th, 11th
  virodhargala[B] = planets where (planet.house - B + 12) % 12 in {2, 9, 11}  // 3rd, 10th, 12th
```

**Files.**
- New: `src/jyotish/argala.ts` — `computeArgala`.

**API.**
```typescript
interface ArgalaPerBhava {
  bhava: number;
  argala: PlanetPlacement[];
  virodhargala: PlanetPlacement[];
}

function computeArgala(chart: BirthChart): ArgalaPerBhava[];   // length 12
```

**Tests.** Per-bhava unit cases; structural invariants (a planet contributes
to exactly 6 bhavas — 3 argala + 3 virodhargala).

**Sources.** Jaimini *Upadesa Sutras* Ch. 1; BPHS Ch. 51.

**Effort.** ~1d.

### Phase 32 Exit Criteria — actuals

- ✅ All 6 modules shipped with full unit + structural-invariant tests;
  **196 new tests** (Varshaphala 64, Tithi Pravesha 38, Arudha 23,
  Special Lagnas 16, Upagrahas 32, Argala 23) → 7,551 total.
- ✅ Solar-return instants converge to ±0.0002° on the 5 R-tier fixtures
  (well below the ±1 minute target); Tithi-pravesha preserves natal
  tithi exactly with the natal-sign correction.
- ✅ Bundle: 349 KB CJS (under 380 KB target; was 327 KB at v3.2.0).
- ✅ Hermes JS-syntax check passes; `tsc --noEmit` clean.
- ✅ API additive — no v3.2 breakage. New error codes
  `'INVALID_INPUT'` and `'SAHAM_DEPENDENCY_ERROR'` added to
  `PanchangErrorCode` (additive union expansion).
- ✅ README sections added for every new export.

---

## Phase 33 — Pathu Porutham + Narayan Dasha + KP sub-lord layer + Prashna foundation (Wave 4c) — ✅ shipped (v3.4.0)

**Goal.** Add the South-Indian regional features that the v3 surface
currently skips. Pathu Porutham is the Tamil/Kerala marriage matching
counterpart to Ashtakoot. Narayan Dasha is the Jaimini sign-dasha
extension that respects parity-based direction. KP sub-lord layer is the
analytical depth around the Placidus-KP house system already shipped.
Prashna foundation lets consumers cast horary charts for the moment of
question.

**Release.** Single **v3.4.0** minor.

**Critical decisions (locked).**
- Pathu Porutham scoring scale follows the **AstroVed / Drik** convention
  (each koot 0..N max, total 0..10 binary "favorable count"). Per-koot
  detail also returned for fine-grained UIs.
- Narayan Dasha direction rule = lagna's **vishama-pada / sama-pada**
  classification (Sanjay Rath's standard, *Narayana Dasa* book), not the
  9th-from-lagna variant. Vishama-pada = Aries, Taurus, Gemini, Libra,
  Scorpio, Sagittarius → forward; Sama-pada = Cancer, Leo, Virgo,
  Capricorn, Aquarius, Pisces → backward.
- KP sub-lord computed for any longitude — used by natal planet analysis,
  cuspal sub-lord (12 cusps from `computeBhava` with `houseSystem:
  'placidus-kp'`), and Prashna chart cusps.
- Prashna foundation is **chart-only** (cast a chart for the moment of
  question with caller-supplied location). Significator analysis +
  Ruling Planets + KP horary numbers (1..249) deferred to Phase 34.

**New API surface.**
`computePathuPorutham`, `computeNarayanDasha`, `computeKpSubLord`,
`computeKpSignificators`, `computePrashnaChart`.

### Step 33-1 — Pathu Porutham (10-fold Tamil marriage matching)

**What.** Tamil/Kerala marriage compatibility scored across 10 koots.
Used instead of Ashtakoot in Tamil Nadu, Kerala, parts of Karnataka.

**Catalog of 10 koots.**

| Koot | Tests | Veto? |
|------|-------|-------|
| Dina | nakshatra distance from boy → girl, mod 9, certain remainders OK | no |
| Gana | Deva/Manushya/Rakshasa per nakshatra (reuses Phase 29 NAKSHATRA_GANA table) | no |
| Mahendra | nakshatra distance from boy → girl ∈ {4, 7, 10, 13, 16, 19, 22, 25} | no |
| Sthree Deergha | distance from boy's nakshatra to girl's > 9 | no |
| Yoni | reuses Phase 29 NAKSHATRA_YONI + YONI_SCORE | **strong veto** |
| Rashi | distance from boy's rashi to girl's not in {6, 8} (some traditions {2, 12} too) | no |
| Rashyathipathi | rashi-lord friendship — reuses Phase 29 NAISARGIKA_MAITRI | no |
| Vasya | reuses Phase 29 RASHI_VASHYA + VASHYA_SCORE | no |
| Rajju | nakshatra Rajju group (5: Pada, Kati, Nabhi, Kantha, Sira) — same group fails | **strong veto** |
| Vedha | nakshatra-vedha pairs (e.g., Ashwini ↔ Jyeshtha) — same vedha fails | strong veto |

**Files.**
- New: `src/jyotish/pathuPorutham.ts` — `computePathuPorutham`.
- New: `src/jyotish/pathuPoruthamTables.ts` — Rajju groups (27-element
  array of Rajju names) + Vedha pairs (13 pairs).

**API.**
```typescript
type PoruthamName = 'Dina' | 'Gana' | 'Mahendra' | 'SthreeDeergha' | 'Yoni'
                  | 'Rashi' | 'Rashyathipathi' | 'Vasya' | 'Rajju' | 'Vedha';

interface PoruthamScore {
  name: PoruthamName;
  passes: boolean;          // koot-level pass/fail
  description: string;      // explanation
  veto?: boolean;           // true for Yoni/Rajju/Vedha when failing
}

interface PathuPoruthamResult {
  totalPasses: number;       // 0..10
  /** True iff no veto-level koot failed AND ≥5 pass total. */
  recommended: boolean;
  poruthams: PoruthamScore[];
}

function computePathuPorutham(boy: NatalMoon, girl: NatalMoon): PathuPoruthamResult;
```

**Tests.** `tests/unit/pathuPorutham.test.ts`:
- Per-koot unit cases (positive + veto-trigger).
- 20-pair cross-validation against ProKerala's free Pathu Porutham
  calculator + Drik's Tamil porutham panel.

**Sources.** *Jathaka Tatva* (Tamil); AstroVed.com 10-Porutham reference;
ProKerala's Pathu Porutham implementation as ground truth.

**Effort.** ~2d.

### Step 33-2 — Narayan Dasha (Jaimini sign-dasha with padi direction)

**What.** Jaimini sign-based dasha with parity-based direction.

**Algorithm.**
- *Starting rashi* — Lagna's rashi.
- *Direction*:
  - Vishama-pada (odd-padi) lagna {Aries=0, Taurus=1, Gemini=2, Libra=6,
    Scorpio=7, Sagittarius=8} → **forward** (zodiacal).
  - Sama-pada (even-padi) lagna {Cancer=3, Leo=4, Virgo=5, Capricorn=9,
    Aquarius=10, Pisces=11} → **backward** (anti-zodiacal).
- *Years per rashi* — Movable 9, Fixed 8, Dual 7 (same as Chara from
  Phase 30).

**Files.**
- Extend `src/jyotish/dasha.ts` — add `computeNarayanDasha`. Reuse
  `CHARA_RASHI_YEARS` and `CHARA_RASHI_LORD`.

**API.**
```typescript
interface NarayanMahaDasha {
  rashi: number;              // 0..11
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  years: number;              // 7, 8, or 9
}

interface NarayanDashaResult {
  direction: 'forward' | 'backward';
  startingRashi: number;
  currentIndex: number;
  currentRashi: number;
  mahaDashas: NarayanMahaDasha[];   // length 12
}

function computeNarayanDasha(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa?: AyanamsaType,
): NarayanDashaResult;
```

**Tests.** `tests/unit/narayanDasha.test.ts`:
- Direction pin per lagna (12 lagnas → 12 expected directions).
- Forward + backward sequence pinning on 4 fixture charts.
- 5-chart Mahadasha boundary cross-check vs PyJHora.

**Sources.** Sanjay Rath, *Narayana Dasa* (Sagar Publications); *Jaimini
Upadesa Sutras* Ch. 2.

**Effort.** ~1d.

### Step 33-3 — KP sub-lord layer

**What.** The analytical layer around KP's 9-fold nakshatra subdivision
(243 sub-divisions across the zodiac). Computes sub-lord for any longitude
+ cuspal sub-lord for the 12 Placidus-KP cusps + KP significators.

**Algorithm.**

*Sub-lord at longitude λ.*
```
nakIdx = floor(λ / 13°20')                 // 0..26
degInNak = λ - nakIdx × 13°20'             // 0..13°20'
nakLord = NAKSHATRA_LORD[nakIdx]           // Vimshottari ruler (already in dasha.ts)

// Sub-divisions inside the nakshatra are proportional to Vimshottari
// lord-years, starting from nakLord and following the 9-lord cycle.
let cum = 0
for i in 0..8:
  subLord = DASHA_ORDER[(nakLord_idx + i) % 9]
  subWidth = (DASHA_YEARS[subLord] / 120) × 13°20'
  if degInNak < cum + subWidth: return subLord
  cum += subWidth
```

*Cuspal sub-lord.* Apply `computeKpSubLord(cusp.longitude)` to each of
the 12 Placidus-KP cusps from `computeBhava(..., { houseSystem:
'placidus-kp' })`.

*Significators (KP rule).* For each planet P:
- Houses signified = union of:
  1. Houses occupied by P.
  2. Houses occupied by P's star-lord.
  3. Houses owned by P (rashi-lord assignments).
  4. Houses owned by P's star-lord.

**Files.**
- New: `src/jyotish/kpSubLord.ts` — `computeKpSubLord`,
  `computeKpCuspalSubLords`, `computeKpSignificators`.

**API.**
```typescript
interface KpSubLordInfo {
  longitude: number;
  signLord: GrahaName;            // rashi lord
  starLord: DashaLord;            // nakshatra lord
  subLord: DashaLord;             // 9-fold sub-lord
}

function computeKpSubLord(siderealLongitude: number): KpSubLordInfo;

interface KpCuspalSubLords {
  cusps: KpSubLordInfo[];         // length 12
}

function computeKpCuspalSubLords(birthDate: Date, location: GeoLocation,
                                  options?: BirthChartOptions): KpCuspalSubLords;

interface KpSignificators {
  /** For each planet, the houses (1..12) it signifies. */
  byPlanet: Record<GrahaName, number[]>;
  /** For each house (1..12), the planets that signify it. */
  byHouse: Record<number, GrahaName[]>;
}

function computeKpSignificators(chart: BirthChart): KpSignificators;
```

**Tests.** `tests/unit/kpSubLord.test.ts`:
- Sub-lord boundary cases (transitions between sub-divisions).
- 5-chart cross-validation against onlinejyotish.com KP free panel:
  cuspal sub-lords exact match.
- Significator coverage — for each chart, every planet signifies at
  least 4 houses (KP rule sanity).

**Sources.** K.S. Krishnamurti, *Krishnamurti Paddhati* (5 volumes); KP
Astrology online references.

**Effort.** ~3d.

### Step 33-4 — Prashna foundation (horary chart)

**What.** Cast a horary chart for the moment of a question. Returns a
`BirthChart`-shaped result (re-using Phase 29 machinery).

**Algorithm.** Trivially: `computeRashiChart(now, location, options)` —
but expose under a Prashna-specific name so callers' intent is clear and
future Prashna-specific analytical layers (Ruling Planets, KP horary
1..249) can be added cleanly later.

**Files.**
- New: `src/jyotish/prashna.ts` — `computePrashnaChart`.

**API.**
```typescript
function computePrashnaChart(
  questionMoment: Date,
  location: GeoLocation,
  options?: BirthChartOptions,
): BirthChart;
```

**Tests.** Trivial (delegates to `computeRashiChart`); parity test ensures
output shape is identical to a natal chart.

**Sources.** B. Suryanarain Rao, *Prasna Marga*; K.S. Krishnamurti
*Horary Astrology*.

**Effort.** ~1d (mostly API surface + docs; no new computational logic).

### Phase 33 Exit Criteria — actuals

- ✅ All 4 modules shipped with full unit + structural-invariant tests;
  **156 new tests** (Pathu Porutham 62, Narayan Dasha 39, KP sub-lord 46,
  Prashna 9) → **7,707 total**.
- ✅ Bundle: 361 KB CJS (under 410 KB target; was 349 KB at v3.3.0).
- ✅ Hermes JS-syntax check passes; `tsc --noEmit` clean.
- ✅ API additive — no v3.3 breakage. Three new error codes added: none —
  Phase 33 reuses `'INVALID_INPUT'` from Phase 32 for shape validation
  in `computePathuPorutham`.
- ✅ README sections added for every new export.
- ⏳ Pathu Porutham 20-pair cross-validation, Narayan Dasha 5-chart
  Mahadasha boundary check, and KP cuspal 5-chart match are deferred
  manual cross-checks (PLAN's stated exit criteria) — the rule
  mechanics are pinned with structural-invariant + unit tests, but
  external panel diffs are not part of the automated suite.

---

## Phase 34 — Drik Panchang / Pandit Parity Sweep (Wave 5) — 🚧 in progress

**Status (2026-05-11).** Phase 34a + 34b + 34c + 34d all code-complete.
**Phase 34e (Wave 5 final sub-phase) code-complete** — 5 of 6 items
shipped (item 2 Arudha bhanga DEFERRED on ≥2-source bar; items
1 Sripati cusps, 3 Trikonargala 5/9, 4 Narayan variable-duration, 5
Shadbala Saptavargaja/Ojha-Yugma/Drekkana, 6 8-Karaka Jaimini all
landed). All sit on top of package.json `4.0.0` (the next release
version — user assigns the specific tag at release time).

Phase 34e item 1 — research at `notes/phase34e-sripati-research.md`,
derivation script at `notes/phase34e-sripati-derive.mjs`. Same drik-
silent pattern as 34a-d / 34e-item-6: drik panchang publishes no
Sripati cusp table (re-confirmed enumeration of the 18 jyotish
calculators), and ProKerala's birth-chart endpoint is form-only POST
per the 34d empirical pattern with no GET-style cusp query. The
Sripati Paddhati trisection formula is **unanimous across 8
independent secondary sources** (Wikipedia, Jothishi,
planetarypositions.com, prosperitynjoy, nikhilworld, astrologershukla,
Lalitha Anamika substack, astrologyofbharat) — no competing
intermediate-cusp algorithm proposed under the Sripati name. Operative
authority is **BPHS Ch.5 + Sripati Paddhati (~12th c.)** with
multi-source modern cross-confirmation. Resolution:
`computeSripatiLagna` gained function overloads accepting an opt-in
`{ includeCusps: true }` fifth argument. The cusps path returns a
new `SripatiLagnaInfo = LagnaInfo & { cusps: number[] }` extension
with all 12 bhava-madhya longitudes; `cusps[0]` equals the lagna
(unchanged from cusp-1-only behaviour), `cusps[3]` is sidereal IC,
`cusps[6]` is descendant, `cusps[9]` is sidereal MC, and the 8
intermediate cusps are obtained by trisecting each ASC→IC→DSC→MC→ASC
ecliptic-arc quadrant. Output shape is **purely additive**: existing
`LagnaInfo` type unchanged, no-options call byte-for-byte identical
to pre-34e-item-1, and the four-iterator-pattern test (`for (const fn
of [computeHoraLagna, …, computeSripatiLagna])`) continues to type-
check. Fixture sweep: 5 R-tier charts spanning lat 8.77°N (Sri Sri
Ravi Shankar) to 47.60°N (Bill Gates), each chart's 12 cusps pinned
to within 1e-4° against hand-derived predictions from the derive
script. Anti-circular: derive script uses already-verified ASC + MC
from `computeBhava`, applies the trisection inline (NOT via new
library code), and the implementation is then checked against those
pinned predictions per `memory/feedback_fixture_repinning.md`.

Suite at **8,053 tests** (+25 new across no-options-backwards-compat,
output-shape, antipodal-invariant × 5 charts, quadrant-sum-invariant ×
5 charts, trisection-prediction × 5 charts, computeBhava-cross-check,
fixture-pin-sweep × 5 charts, and equator structural regression).
CJS bundle **371.11 KB** (+1.54 KB from item-6's 369.57 KB).

Phase 34a — research at `notes/phase34a-research.md`. Mangal Dosha
re-revised after research showed drik panchang **does** use the Venus
chart (the initial Phase 34 fix wrongly removed it); the final algorithm
is Lagna + Moon + Venus with the Mars–Venus conjunction itself as a
cancellation, which makes the from-Venus trigger self-cancel for any
Mars–Venus conjunction. Pitru Dosha expanded from 3 rules to 9
(multi-pandit consensus; drik panchang has no Pitru calculator). Sade
Sati and Kaal Sarp are doc-only updates — their current behavior already
matches drik panchang's panel.

Phase 34b — research at `notes/phase34b-research.md`. Key surprise:
drik panchang's published pages and ProKerala's published pages **do not
enumerate Bhakoot or Nadi cancellation rules** beyond mentioning the
koots themselves. The user-hypothesised additions (same-lagna-lord,
same-7th-lord, parivartana) are not surfaced by any primary source.
Resolution: keep the existing two Bhakoot cancellations (same rashi-lord,
mutual rashi-lord friendship) as the default, and add three **opt-in**
cancellations gated on new optional fields on `NatalMoon` —
`lagnaRashi?` (enables same-lagna-lord and same-7th-house-lord) and
`navamsaRashi?` (enables same-Navamsa-lord, the best-cited tertiary
addition). Default callers (rashi + nakshatra only) get pre-34b behavior
exactly; callers who can supply chart-derived data get the additional
parity. Nadi cancellation set unchanged — research shows current rules
already match the permissive mainstream reading. Pathu Porutham Sthree
Deergha threshold locked at `> 13` (girl→boy, Tamil-Drik consensus); the
minority `> 15` and graduated-band variants are explicitly rejected by
new boundary tests.

Phase 34c — research at `notes/phase34c-research.md`. Same pattern as
34b: drik panchang does **not** surface birth-chart yoga panels at all
(its `/yoga/` page covers only the 8 panchang yogas like Sarvarthasiddhi,
not Gajakesari / Mahapurusha / Raja Yoga / Neecha Bhanga). Pandit
consensus + BPHS becomes the operative authority. Resolution: **6 yogas
gain a `bhanga: { applies, reasons }` annotation** — the 5 Pancha
Mahapurusha yogas (Sun-or-Moon conjunction with the yoga-causing
planet, BPHS-attributed multi-source) and Gajakesari (Jupiter combust
within 10° of Sun OR Jupiter debilitated in Capricorn, multi-source +
classical). Raja Yoga bhanga is **deferred entirely** — the often-cited
"lord debilitated cancels Raja Yoga" rule directly contradicts BPHS Ch.
39's *Great Parashara Exception* (Vipareeta Raja Yoga foundation
verses), and no rule survives the conflict check. Neecha Bhanga
extension: Rules A & B now check kendra from Moon as well as Lagna
(Phaladeepika 7.26 explicit "from Lagna OR Moon"), and a new Rule D
fires when the dispositor aspects the debilitated planet (Phaladeepika
7.28). Output shape is **purely additive** — `Yoga.bhanga?` is
optional, and the 19 yogas without bhanga rules keep their pre-34c
output exactly. Fixture-chart verification: Ratan Tata's Gajakesari now
correctly annotates as cancelled (`Jupiter debilitated in Makara`), and
4 of 10 Mahapurusha cases on the existing fixture set surface
`bhanga.applies: true` for the canonical Moon-conjunct cases (Modi
Ruchaka, Salman Khan Ruchaka, Zuckerberg Sasha, plus the Tata Gajakesari).

**Bug fix in scope (also 34c).** While implementing Gajakesari
combustion, an inverted `distToSun = 180 - sep` line in
`shadbala.ts`'s Chesta Bala combust check was surfaced — the
formula was firing combust near opposition rather than near
conjunction. Fixed; 4 regression tests added pinning the corrected
behavior at known Jupiter / Mercury conjunction dates. Cascade: the
five Bhava Bala fixture pins were re-pinned (each delta is −15V on
houses whose pre-fix Chesta was inflated by a not-yet-detected combust
planet).

Phase 34d — research at `notes/phase34d-research.md`. Same pattern as
34b/34c surfaced again: drik panchang's birth-chart calculators
(`/jyotisha/{kundali,mangal-dosha,kalasarpa-yoga,sadesati}.html`) are
**all form-only POST pages** (empirically verified 2026-05-11) — no
GET-style query interface and no public REST API. Per-chart drik
verdict scraping requires manual form entry. Two surfaces are also
flat-out absent from drik's URL space: **Pitru Dosha** (no calculator)
and **birth-chart yoga panels** (Gajakesari / Mahapurusha / Neecha
Bhanga / Raja Yoga — none surfaced; drik's `/yoga/yoga.html` covers
only the 8 *daily* panchang yogas). Both are deferred from Phase 34d's
drik-cross-validated scope and remain covered by their own unit/
integration suites (Phase 34a's 9-rule Pitru, Phase 34c's yoga
catalog with `bhanga` annotations). Resolution: a **12-chart
consolidated fixture file** at `tests/fixtures/drik-parity/charts.json`
with **structurally-derived** expected values (via
`notes/phase34d-derive-fixtures.mjs` — drik's stated rule sets applied
to the AstroSage R-tier natal positions from Phase 29). Each fixture
entry pins `MangalDoshaInfo` (afflicted / severity / per-chart
breakdown / cancellations-superset), `KaalSarpDoshaInfo` (afflicted /
subtype / rahu+ketu houses), `SadeSatiInfo` at `2026-05-04` (active /
phase / arc-boundary ±2 days), plus a birth-date panchang smoke
slice. A small 3-pair Ashtakoot regression net pins the perfect-36
cases (Modi×Modi / Obama×Priyanka / Clinton×Kejriwal — all same-rashi
same-nakshatra). Anti-circular: every expected value cites either
`structural-derivation`, `phase29-aligned`, or `drik-form-trace` in
its `_source` field; none cite library output.

Phase 34e item 6 — research at `notes/phase34e-jaimini-research.md`.
Same drik-silent pattern as 34a §Pitru / 34c §yoga / 34d §Pitru-and-yoga:
drik panchang publishes **no Chara Karaka panel** anywhere in its 18
jyotish calculators, and its Janma Kundali form-output skips karakas
entirely. Operative authority is therefore Jaimini Upadesa Sutras Ch.1
First Foot V.10 + Sanjay Rath commentary, with multi-pandit
cross-confirmation (Wikipedia, Sarvatobhadra, vedicmarga, Bhawana
Verma, vaya.so all agree on the 8-karaka order). Resolution:
`computeJaiminiKarakas` gains an opt-in `{ variant: '8-jaimini' }`
options arg via function overloads. The 8-variant ranks Sun..Saturn
**plus Rahu**, where Rahu's effective degree is `30 − degreeInRashi`
(reversed — Rahu is permanently retrograde) and inserts a new
**Pitrukaraka** (father) role at position 5 of the karaka ordering.
Tie-break extends the canonical Parashara order one slot
(Sun > Moon > … > Saturn > Rahu — Rahu loses every tie). Output shape
is **purely additive**: new `Karaka8Name = KarakaName | 'Pitrukaraka'`
and `Jaimini8Karakas = Record<Karaka8Name, GrahaName>` types; existing
`KarakaName` and `JaiminiKarakas` unchanged; pre-34e callers continue
returning identical `JaiminiKarakas` byte-for-byte. Fixture cross-
validation: 9 R-tier charts (Modi / Sachin / Tata / Dhirubhai / Mukesh
/ Zuckerberg / Obama / Gates / Trump) pinned with hand-derived 8-K
predictions (Rahu's insertion point spans k∈{1,5,6,7}); Sachin's
predicted AK=Mars, AmK=Moon matches independently-published Jaimini
analysis (astrosaxena.com).

Suite at **8,028 tests** (+19 new across Rahu-reversal, Pitrukaraka-
insertion, tie-break, output-shape, backwards-compat default,
monotonic invariant, and 9-fixture pin sweep). CJS bundle **369.57 KB**
(+0.64 KB from 34d's 368.93 KB).

**Trigger.** A user-supplied real chart (30 Jul 1998, Agra, 23:56 IST) was
flagged Manglik by the library but **not** by drik panchang or three
independent pandits — because Mangal Dosha was using a stricter
"from Venus" reference (any Mars–Venus conjunction trips it) and was
missing the Jupiter-conjunction / Jupiter-aspect cancellations pandits
routinely apply. The fix (already landed: Lagna+Moon only, plus Jupiter /
Moon conjunction + Jupiter 5/7/9 sign-aspect cancellations) exposed a
broader divergence pattern across the library: many computations are
either using a non-mainstream rule selection or missing standard
cancellations that drik panchang and pandit consensus apply.

**Goal.** Bring every public computation to **drik panchang and
mainstream-pandit parity** as the reference behavior. Mathematical
correctness alone is not the bar — calling convention and rule selection
must match what users will compare against. Where drik panchang and
classical BPHS diverge, **drik panchang wins** (this is locked).

**Release scope.** Wave 5 is a behavioral-parity wave, mostly fixes and
additions to rule sets. Output **shape** changes only where a divergent
reference needs to be removed (e.g., the recent `fromVenus` removal from
`MangalDoshaInfo`). Each sub-phase ships a minor release (package.json
currently sits at `4.0.0`; user assigns the specific tag at release).

**Critical principles (locked across Phase 34).**
- Reference order of authority: **(1) drik panchang published output**,
  then **(2) pandit consensus** (ProKerala / AstroSage / AstroVed
  agreement), then **(3) classical BPHS / Parashara**. Where (1) and (3)
  conflict, (1) wins.
- "More rules" is **not** automatically better. If drik panchang doesn't
  apply a rule, the library shouldn't either — unless it's gated behind
  an explicit opt-in option.
- **Research before fix.** Every sub-phase begins with a documented
  ground-truth lookup against drik panchang (and 1–2 corroborating
  pandit calculators) for 5–10 known charts. Diffs drive the fix list.
  Implementation only starts after the divergence list is pinned.
- Validation is **fixture-driven**: golden outputs from drik panchang
  for a fixed reference-chart suite become regression tests. No more
  "our unit tests pass but pandits disagree" failure mode.
- API surface stays additive where possible; breaking removals (like the
  Manglik `fromVenus` field) are clearly called out per sub-phase.

### Audit baseline — gaps the library has today

This is the divergence inventory feeding the sub-phase split. Compiled
from a full source audit of `src/jyotish/*` and `src/core/*` on
2026-05-11.

**Doshas.**
- ✅ **Mangal Dosha** — fixed pre-Phase-34: Lagna+Moon only; Jupiter /
  Moon conjunction + Jupiter 5/7/9 aspect cancellations added.
- ❌ **Sade Sati** — no cancellations applied. Classical exceptions
  (Saturn–Moon conjunction, Saturn aspected by Jupiter, natal Saturn
  strong in own/exalt, etc.) not modelled. Drik panchang's published
  Sade Sati panel only labels the phase; **need to confirm whether it
  also surfaces cancellations or simply lists active periods**.
- ❌ **Pitru Dosha** — only 3 trigger rules (Sun+Rahu, Sun+Ketu,
  Sun+Saturn in 9th). Drik panchang's free Pitru Dosha panel surfaces
  additional rules (debilitated Sun in 9th, 9th lord in dusthana,
  malefic 9th lord). Audit and align.
- ⚠️ **Kaal Sarp Dosha** — algorithmic 180°-arc check is correct; verify
  drik panchang's partial / paritha handling matches our `partial`
  flag, and verify subtype naming.

**Marriage matching.**
- ✅ **Ashtakoot Bhakoot** — same-rashi-lord and mutual rashi-lord
  friendship retained as default. Phase 34b research showed drik
  panchang and ProKerala do not enumerate the user-hypothesised
  additions (same-lagna-lord, same-7th-lord, parivartana) on any
  reachable page. Resolution: three new **opt-in** cancellations
  (same-lagna-lord, same-7th-house-lord, same-Navamsa-lord) gated on
  new optional `NatalMoon.lagnaRashi` and `NatalMoon.navamsaRashi`
  fields. Parivartana deferred — requires per-graha positional data
  the `NatalMoon` signature does not carry and is unsupported by any
  tertiary source.
- ✅ **Ashtakoot Nadi** — research showed current same-nakshatra +
  same-rashi cancellations already match the permissive mainstream
  reading. Jupiter / planetary-conjunction Nadi-bhanga rules require
  graha positional data not in `NatalMoon` and are only weakly cited
  (single-source). No change in 34b; revisit if a future API expansion
  surfaces birth-chart data to the matching functions.
- ✅ **Pathu Porutham** — Sthree Deergha threshold locked at `> 13`
  (girl→boy, Tamil-Drik consensus). The minority `> 15` boy→girl
  variant (one AstroVed-English article) and the graduated-band
  `>= 7 acceptable, > 13 ideal` variant are explicitly rejected by new
  boundary tests (distances 9, 15, 16).

**Yogas.**
- ✅ **Yoga bhanga** (Phase 34c) — `Yoga` gained an optional
  `bhanga: { applies: boolean; reasons: string[] }` annotation. Six
  catalog rules now compute classical cancellations: the five Pancha
  Mahapurusha yogas (Ruchaka / Bhadra / Hamsa / Malavya / Sasha) on
  Sun-or-Moon conjunction with the yoga-causing planet (BPHS-attributed
  multi-source) and Gajakesari on Jupiter combust within 10° of Sun OR
  Jupiter debilitated in Capricorn (multi-pandit consensus + classical).
  Phase 34c research found that drik panchang does **not** surface
  birth-chart yoga panels at all — its `/yoga/` URL covers only the 8
  *panchang* daily yogas (Sarvarthasiddhi etc.). Raja Yoga bhanga is
  **explicitly deferred** because the often-cited "lord debilitated
  cancels Raja Yoga" rule contradicts BPHS Ch. 39's Great Parashara
  Exception (Vipareeta Raja Yoga foundation, verses 39.51+). Other
  yogas (Sunapha / Anapha / Durudhura / Kemadruma / Budha-Aditya /
  Veshi / Vasi / Ubhayachari / Lakshmi / Dhana / Vasumati / Vargottama /
  Yogakaraka / Daridra / Dharma-Karmadhipati / Vipareeta Raja) are
  documented as defer-set in `notes/phase34c-research.md` §6.
- ✅ **Neecha Bhanga** (Phase 34c) — Rules A and B extended to check
  kendra from Moon as well as from Lagna (Phaladeepika 7.26 "Lagna OR
  Moon"). New Rule D fires when the dispositor aspects the debilitated
  planet (Phaladeepika 7.28). Retrograde-based and Navamsa-based
  classical rules deferred (single-source / require D9-on-dispositor
  data not in current ctx).

**Other specialist gaps (lower user-facing priority).**
- ⚠️ **Arudha** — two cardinal exceptions (D=1, D=7) applied; the
  initially-audited "lord-in-6/8/12 strength reduction" was researched
  in Phase 34e item 2 (`notes/phase34e-arudha-research.md`) and
  **deferred 2026-05-11** — Sanjay Rath's own canonical Arudha article
  excludes the rule and ≥2-source classical attestation could not be
  obtained. Intentionally not modelled (matches drik-silent surface).
- ✅ **Argala** (Phase 34e item 3) — primary Argala unchanged;
  Trikonargala (5/9 trine) added as opt-in via
  `{ includeTrikonargala: true }` on `computeArgala`, including the
  Ketu-reversal rule. Output additive — pre-34e callers see no shape
  change.
- ✅ **Sripati Lagna** (Phase 34e item 1) — `computeSripatiLagna`
  gained an opt-in `{ includeCusps: true }` argument that returns
  the new `SripatiLagnaInfo` extension with all 12 bhava-madhya
  cusps (classical Sripati Paddhati trisection of the four
  ASC→IC→DSC→MC ecliptic quadrants).
- ✅ **Narayan Dasha** (Phase 34e item 4) — fixed 9/8/7 durations
  unchanged as default; Sanjay Rath variable-duration variant added
  as opt-in via `{ duration: 'variable' }` (Rules 2 + 3 + 4(a-d) with
  planet-count + Rasi-Drishti aspect strength tiebreak; remaining
  rare Source-1 strength rules and second-cycle dashas documented as
  deferred).
- ✅ **Shadbala Sthana** (Phase 34e item 5) — Uchcha + Saptavargaja
  (sum of dignity virupas across D1+D2+D3+D7+D9+D12+D30 vargas) +
  Ojha-Yugma (parity bonus in Rashi + Navamsa) + Drekkana
  (decanate-gender bonus). Kala Bala sub-components (Tribhaga,
  Varsha, Masa, Dina, Hora, Ayana, Yuddha) and Sthana Kendradi
  remain out of scope per the user-named Phase 34e item-5 surface.

### Sub-phase split

The audit groups cleanly into five sub-phases, ordered by user-facing
impact. Each ships as its own minor release. Sub-phase **34a** is the
direct extension of the Manglik fix and starts immediately.

| Sub-phase | Focus | Effort | Release |
|-----------|-------|--------|---------|
| 34a | Doshas (Sade Sati cancellations, Pitru rule set, Kaal Sarp parity) | 2–3d | ✅ on top of `4.0.0` |
| 34b | Marriage matching (Ashtakoot Bhakoot/Nadi cancellations, Pathu Porutham threshold lock) | 2–3d | ✅ next minor after 34a |
| 34c | Yoga bhanga (per-yoga cancellation rules + Neecha Bhanga extensions) | 3–4d | ✅ next minor after 34b |
| 34d | Drik panchang fixture-driven cross-validation harness (12 reference charts; golden outputs for Mangal Dosha, Kaal Sarp, Sade Sati, Ashtakoot perfect-36 set; Pitru + birth-chart yogas explicitly deferred — drik does not publish them) | 2–3d | ✅ next minor after 34c |
| 34e | Specialist completeness (Arudha cancellations, Trikonargala, Sripati cusps, Narayan full variant, Shadbala remaining components, 8-Karaka Jaimini) | 4–6d | next minor after 34d |

Note: package.json sits at `4.0.0` (last released git tag is `v2.0.1`).
User assigns the specific tag at release time — do not assume a v3.x
sequence; that was prior-session fiction that did not match the actual
`package.json` state.

**Total Wave 5 effort estimate.** 13–19 days end-to-end. Each sub-phase
is independently shippable.

### Step 34a-1 — Sade Sati: research drik panchang cancellation surfacing

**What.** Cast 5 charts with natal Moon spread across rashis, query
drik panchang's Sade Sati panel for each at a date inside an active
phase, and record whether the panel surfaces any cancellation /
mitigation labels. If yes, enumerate the trigger conditions. If no,
the library's "active/inactive" model is already aligned.

**Output.** A `notes/phase34a-sadesati-drik-research.md` listing the
5 chart inputs, drik panchang's panel verdict, and the cancellation
delta (if any). No code change in this step.

**Effort.** ~3h.

### Step 34a-2 — Sade Sati: implement cancellations (if research surfaces any)

**What.** If 34a-1 surfaces cancellation conditions, add them to
`computeSadeSati` with the same `cancellations: string[]` pattern used
in `computeMangalDosha`. If 34a-1 confirms drik panchang only labels
phases, this step is a no-op and the audit gap is marked as
"intentionally not modelled (drik panchang doesn't surface it either)"
in the doc comment.

**Tests.** Add 1 case per cancellation rule + 1 negative; extend
existing `tests/unit/sadeSati.test.ts`.

**Effort.** ~4h (skipped if 34a-1 returns empty).

### Step 34a-3 — Pitru Dosha: align rule set with drik panchang panel

**What.** Query drik panchang's Pitru Dosha panel for 8 charts spanning
the trigger conditions in our audit (Sun+Rahu, Sun+Ketu, Sun+Saturn in
9th) and 3–4 additional classical rules (debilitated Sun in 9th, 9th
lord in dusthana, malefic 9th lord). Record which rules drik panchang
flags and which it ignores. Add the flagged-by-drik rules; **do not
add** classical rules drik panchang skips.

**Files.** `src/jyotish/doshas.ts`, `tests/unit/doshas.test.ts`.

**Effort.** ~6h research + ~4h implementation.

### Step 34a-4 — Kaal Sarp: verify partial / subtype parity

**What.** Cast 6 charts: 3 with all 7 grahas inside Rahu–Ketu arc, 3
with exactly 1 outside (paritha). For each, compare our output
(`afflicted`, `partial`, `subtype`) against drik panchang's Kaal Sarp
panel. Fix any divergence (likely in `partial` flag interpretation or
subtype naming for boundary cases).

**Effort.** ~4h research + ~2h fix if needed.

**Exit criteria for Phase 34a.**
- ✅ Sade Sati / Pitru / Kaal Sarp outputs match drik panchang for the
  research chart set.
- ✅ Each fix has a unit test + one golden-output integration test
  against a recorded drik panchang chart.
- ✅ Doc comments updated to cite "drik panchang published rule set" as
  the reference (matching the pattern already in
  `computeMangalDosha`).

### Step 34b-1 — Ashtakoot Bhakoot cancellations: align with ProKerala / drik panchang

**What.** Compute Bhakoot score for 12 boy/girl pairs spanning every
classical cancellation trigger (same lagna-lord, same 7th-lord,
rashi-lord parivartana, mutual friendship, same lord, same rashi).
Compare against ProKerala's free Ashtakoot panel + drik panchang's
Guna Milan panel. Add the cancellations that **both** external panels
surface; defer any that only one applies (variant territory).

**Files.** `src/jyotish/matching.ts`, `tests/unit/matching.test.ts`.

**Effort.** ~6h research + ~4h implementation.

### Step 34b-2 — Ashtakoot Nadi cancellations: Jupiter / planetary bhanga

**What.** Add Nadi bhanga rules surfaced by ProKerala: Jupiter aspect
on either Moon, same nakshatra-lord, etc. Same research-then-implement
pattern as 34b-1.

**Effort.** ~4h research + ~3h implementation.

### Step 34b-3 — Pathu Porutham Sthree Deerkha threshold lock

**What.** Query drik panchang's Tamil porutham panel for 5 pairs near
the threshold boundary (distance 9–14). Lock the threshold to match
drik (likely > 13, current default). Add option only if drik exposes
the variant.

**Effort.** ~2h research + ~1h fix.

**Exit criteria for Phase 34b.** ≥18/20 of a fixture pair set matches
the `recommended` verdict from ProKerala + drik Tamil panels.

### Step 34c-1 — Yoga bhanga: catalog audit and per-yoga rule sourcing

**What.** For each of the ~25 yogas in `yogasCatalog.ts`, query drik
panchang's yoga panel (where available) and ProKerala's published yoga
list for 3–5 charts that trigger the yoga. Record what cancellation /
strength conditions external sources surface. Output: a per-yoga
cancellation table.

**Effort.** ~2d research (catalog-scale).

### Step 34c-2 — Yoga bhanga: implementation

**What.** Extend `Yoga` type with `bhanga?: { applies: boolean; reasons:
string[] }` (additive). For each yoga with cancellations from 34c-1,
add the rule to `yogasCatalog.ts`. Pancha Mahapurusha bhanga
(dispositor in 6/8/12) and Gajakesari bhanga (Jupiter combust /
debilitated) are the first targets.

**Files.** `src/jyotish/yogas.ts`, `src/jyotish/yogasCatalog.ts`,
`src/types/jyotish.ts`, `tests/unit/yogas.test.ts`.

**Effort.** ~2d implementation.

### Step 34c-3 — Neecha Bhanga extension

**What.** Audit `computeYogas`' Neecha Bhanga implementation against
the classical 6-rule set (BPHS Ch. 39) AND drik panchang's published
Neecha Bhanga calculator. Add the rules drik panchang surfaces;
explicitly skip BPHS-only ones unless flagged by user.

**Effort.** ~1d.

**Exit criteria for Phase 34c.** Every yoga that has a cancellation
condition in mainstream calculators surfaces `bhanga.applies` with
matching reasons for the fixture chart set.

### Step 34d — Drik panchang fixture-driven cross-validation harness ✅

**Status.** Code-complete 2026-05-11. Tests in
`tests/integration/drik-parity.test.ts` walk
`tests/fixtures/drik-parity/charts.json` (12 charts) and
`tests/fixtures/drik-parity/pairs.json` (3 pairs). +229 tests added.

**Scope landed.**

Per `notes/phase34d-research.md`, drik panchang's birth-chart
calculators (`kundali`, `mangal-dosha`, `kalasarpa-yoga`, `sadesati`,
`horoscope-match`) are **all form-only POST pages** with no GET-style
query interface, empirically verified 2026-05-11. Two computations
are also absent from drik's URL space entirely:

- **Pitru Dosha** — no drik calculator; multi-pandit consensus is the
  operative authority. Phase 34a's 9-rule expansion is the regression
  net; explicitly NOT cross-validated in 34d.
- **Birth-chart yoga panels** (Gajakesari / Mahapurusha / Neecha
  Bhanga / Raja Yoga) — drik's `/yoga/yoga.html` covers only the 8
  *daily* panchang yogas (Sarvarthasiddhi etc.), not birth-chart
  yogas. Phase 34c §1 confirmed this. Yoga catalog regression net
  stays at `tests/unit/yogas.test.ts` + the Phase 29 birthchart
  validation suite.

The Phase 34d harness cross-validates the four surfaces drik does
publish, plus a panchang smoke slice:

- **MangalDoshaInfo** — `afflicted`, `severity`, per-chart breakdown
  (`fromLagna` / `fromMoon` / `fromVenus`), cancellation
  set-superset.
- **KaalSarpDoshaInfo** — `afflicted`, `subtype`, `rahuHouse`,
  `ketuHouse`. `partial` is informational-only per drik's own
  statement and is not asserted.
- **SadeSatiInfo** evaluated at `2026-05-04` — `active`, `phase`,
  `currentArcStart` / `currentArcEnd` within ±2 days of the canonical
  Saturn-ingress reference table reused from Phase 29 sadesati
  validation (Barbara Pijan Shani Gochara, drik-aligned).
- **Ashtakoot perfect-36 pairs** — 3 same-rashi+same-nakshatra pairs
  (Modi × Modi, Obama × Priyanka, Clinton × Kejriwal) pin the koot-
  summation logic with hand-derived expected values from BPHS Ch.7
  + Drik per-koot rules.
- **Birth-date panchang slice** — for each chart, on the birth
  instant + birth location, `getDailyPanchang` returns a non-null
  result with all major fields populated (smoke check; the heavy
  drik-vs-library panchang parity sweep stays at Phase 28's
  50-fixture suite).

**Anti-circular fixture derivation.** Per the locked Phase 34c
methodology rule (memory/feedback_fixture_repinning.md), every
expected value in the fixture files is sourced from one of three
audit-trail paths:

1. `structural-derivation` — drik's stated rule set manually applied
   to AstroSage R-tier natal positions via
   `notes/phase34d-derive-fixtures.mjs`. The script implements the
   same rule set the library does, *independently* from the library
   code path. Auditable by re-running the script.
2. `phase29-aligned` — re-uses the canonical Saturn-transit reference
   table from `tests/validation/phase29-sadesati-validate.test.ts`.
   No new scrape needed.
3. `drik-form-trace` — reserved field for manual form-entry
   recordings. The schema is forward-compatible with adding these on
   a per-chart basis; no entries currently carry this source.

Library output is **never** a fixture seed. Future cross-check diffs
must follow the fix-then-predict-then-confirm rule before any
re-pin.

**Tolerance schedule.**

| Field | Tolerance |
|---|---|
| MangalDoshaInfo bool/int/severity | exact |
| MangalDoshaInfo.cancellations | set-superset (library may surface extras) |
| KaalSarpDoshaInfo bool/int/subtype | exact |
| KaalSarpDoshaInfo.partial | not asserted |
| SadeSatiInfo.active / phase | exact |
| SadeSatiInfo arc boundaries | ±2 days vs Phase 29 ingress table |
| Ashtakoot total + per-koot (perfect-36 pairs) | exact (all 36) |
| Panchang slice | smoke only (non-null + non-empty arrays) |

**Deferred from 34d (with rationale).**

- Hillary Clinton's arc-end (Saturn into Vrishabha ~2030) is omitted
  from the rashi-bounded assertion — no published reference table I
  audit-trust pins this to ±2 days. Phase 29's table stops at Mesha
  2028. Fixture asserts active + phase + arc start only.
- Pair-level Ashtakoot cross-validation for complex (non-perfect-36)
  pairs stays at `tests/fixtures/ashtakoot-pairs.json` (the Phase 29
  31-pair structural sweep). Drik's form-only output prevents
  auditable per-pair total scraping; perfect-36 pairs are the only
  cases with hand-derivable totals.

**Files added.**

- `notes/phase34d-research.md` — research notes (scoping + fixture-
  chart list + tolerance schedule + source list).
- `notes/phase34d-derive-fixtures.mjs` — one-off derivation script
  (audit trail for the structural-derivation expected values).
- `tests/fixtures/drik-parity/charts.json` — 12-chart consolidated
  fixture.
- `tests/fixtures/drik-parity/pairs.json` — 3-pair Ashtakoot
  perfect-36 regression net.
- `tests/integration/drik-parity.test.ts` — 229-test harness.

**Net suite delta.** 7,780 → **8,009 tests** (+229). CJS bundle
`dist/index.cjs` unchanged at **368.93 KB** (no library source
modified).

**Effort.** 2–3d planned; landed in 1d (most cost was research +
fixture-schema design; harness mechanical).

### Step 34e — Specialist completeness (lowest priority)

**What.** Land the items the audit flagged as specialist gaps:
- ❌ Arudha lord-in-6/8/12 cancellation. *(deferred 2026-05-11 —
  ≥2-source bar unmet; Sanjay Rath's own canonical Arudha Pada article
  excludes the rule. See `notes/phase34e-arudha-research.md`.)*
- ✅ **Trikonargala (5/9)** in `computeArgala` (additive opt-in via
  `{ includeTrikonargala: true }` second arg → populates the new
  optional `trikona: { sources, virodhakas }` field on each
  `ArgalaPerBhava`). *(code-complete 2026-05-11.)*
- ✅ **Sripati cusp 2–12 midpoints** in `computeSripatiLagna` (additive
  opt-in via `{ includeCusps: true }` fifth arg → returns the new
  `SripatiLagnaInfo` extension with all 12 bhava-madhya longitudes).
  *(code-complete 2026-05-11.)*
- ✅ **Narayan Dasha variable-duration variant** in
  `computeNarayanDasha` (additive opt-in via `{ duration: 'variable' }`
  fourth arg → returns Mahadashas with per-rashi computed durations
  per Sanjay Rath Rules 2 + 3 + 4(a-d), with Strength Source 1 Rule 2
  + Source 2 Rule 1 for dual-lord tiebreak). *(code-complete 2026-05-11.)*
- ✅ **Shadbala Saptavargaja / Ojha-Yugma / Drekkana subcomponents**
  added to Sthana Bala (always-on; the simplification was a known
  pre-34e gap, not a feature). Predicted-then-verified-then-repinned
  the 5 Phase 31 / 34c Bhava Bala fixture pins per the locked
  anti-circular workflow in `memory/feedback_fixture_repinning.md`.
  *(code-complete 2026-05-11.)*
- ✅ **8-Karaka Jaimini variant** (additive option on
  `computeJaiminiKarakas`). *(code-complete 2026-05-11.)*

Each is independently shippable; bundle into one minor if all done
together, or split if any one slips.

**8-Karaka Jaimini variant — what landed.** Research at
`notes/phase34e-jaimini-research.md`. Drik panchang publishes no
karaka surface (confirmed by enumeration of all 18 jyotish
calculators), so the operative authority is Jaimini *Upadesa Sutras*
Ch.1 First Foot V.10 with Sanjay Rath's commentary as modern
canonical, cross-confirmed by 4 independent secondary sources on the
8-karaka order and 3 on the Rahu-reversal rule. Code additions:
- New types `Karaka8Name = KarakaName | 'Pitrukaraka'` and
  `Jaimini8Karakas = Record<Karaka8Name, GrahaName>` in
  `src/types/jyotish.ts` (re-exported from `src/types/index.ts` +
  `src/index.ts`). Existing `KarakaName` and `JaiminiKarakas`
  unchanged.
- `computeJaiminiKarakas(chart, options?)` gained function overloads:
  no-options or `{ variant: '7-parashara' }` → `JaiminiKarakas`
  (existing behavior byte-for-byte); `{ variant: '8-jaimini' }` →
  `Jaimini8Karakas` adding Rahu as 8th planet with effective degree
  `30 − degreeInRashi` (retrograde reversal) and a new **Pitrukaraka**
  (father) role at position 5 of the karaka order.
- Tie-break extends the canonical Parashara order one slot:
  Sun > Moon > Mars > Mercury > Jupiter > Venus > Saturn > Rahu —
  Rahu loses every effective-degree tie.
- 19 new tests across Rahu-reversal (Rahu at degreeInRashi=29° → DK,
  Rahu at 1° → AK), Pitrukaraka-insertion at exact position 4,
  effective-degree tie-break (Sun vs Rahu at 15°/15°, all-8-tied
  canonical-order pin), output shape (8 unique grahas, Pitrukaraka
  present), monotonic-degree invariant across all 20 R-tier fixtures,
  backwards-compat (no-options = explicit `'7-parashara'` for all 5
  pinned charts), and a 9-fixture sweep with hand-derived 8-K
  predictions (Modi / Sachin / Tata / Dhirubhai / Mukesh / Zuckerberg
  / Obama / Gates / Trump).

**8-Karaka — what was deferred.** None — the Sanjay Rath / Jaimini
variant is the only widely-cited 8-karaka tradition. The BPHS
"conditional Rahu" variant (Parashara Ch.32 — include Rahu only as a
tie-breaker for the 7-karaka system) is **not** implemented because
the library's existing 7-karaka stable-sort tie-break (canonical
Parashara order) deterministically resolves every degree collision,
rendering the conditional Rahu fallback structurally unreachable.
Ketu remains excluded from both variants per unanimous secondary-
source convention.

**Sripati cusps — what landed.** Research at
`notes/phase34e-sripati-research.md`. Drik publishes no Sripati cusp
table on any of its 18 jyotish calculators (re-confirmed inventory);
ProKerala's birth-chart endpoint is form-only POST per the 34d
empirical pattern with no GET-style cusp query; AstroLinked native
pages render empty placeholders without auth. Operative authority is
therefore **BPHS Ch.5 + Sripati Paddhati (~12th c.) + 8-source
modern multi-pandit consensus** (Wikipedia, Jothishi,
planetarypositions.com, prosperitynjoy, nikhilworld,
astrologershukla, Lalitha Anamika substack, astrologyofbharat) —
the formula is uncontested across every surveyed source. Code
additions:
- New type `SripatiLagnaInfo extends LagnaInfo` adding `cusps:
  number[]` (length 12) in `src/types/jyotish.ts` (re-exported from
  `src/types/index.ts` + `src/index.ts`). Existing `LagnaInfo`
  unchanged.
- `computeSripatiLagna(birthDate, location, ayanamsa?, lang?,
  options?)` gained function overloads: no-options or
  `{ includeCusps: false }` → `LagnaInfo` (existing behavior byte-
  for-byte); `{ includeCusps: true }` → `SripatiLagnaInfo` with all
  12 bhava-madhya longitudes (cusps[0]=lagna, cusps[3]=IC,
  cusps[6]=descendant, cusps[9]=MC, opposite cusps differ by
  exactly 180° by construction). Sidereal MC derived inline via
  Meeus' `λ_MC = atan2(sin θ, cos θ · cos ε)` formula (avoids the
  `bhava.ts → lagna.ts` back-edge that would cause a circular
  import).
- Quadrant trisection: arc_q1 = (IC−ASC) mod 360 and arc_q2 =
  (DSC−IC) mod 360 (with arc_q3 = arc_q1 and arc_q4 = arc_q2 by
  Sripati's antipodal symmetry); intermediate cusps placed at the
  1/3 and 2/3 marks of each arc. Works at every latitude with no
  circumpolar exception (unlike Placidus).
- 25 new tests across no-options-backwards-compat (cusps field
  absent), explicit `{ includeCusps: false }` byte-for-byte
  equivalence, output shape (12 finite cusps in [0,360),
  cusps[0]=siderealLongitude), antipodal-180° invariant per chart,
  quadrant-sum=360° invariant per chart, trisection-prediction
  per chart, computeBhava-cross-check (cusps[0]=ascendantLongitude,
  cusps[9]=mcLongitude), 5-chart fixture pin sweep with hand-
  derived predictions (Narendra Modi 23.78°N / Sachin Tendulkar
  18.97°N / Mark Zuckerberg 40.70°N / Bill Gates 47.60°N / Sri
  Sri Ravi Shankar 8.77°N — spanning low to high latitude with
  asymmetric quadrant arcs from 63° to 117°), and a φ=0 equator
  structural regression (12 finite cusps + antipodal symmetry).

**Arudha bhanga — DEFERRED 2026-05-11.** Research at
`notes/phase34e-arudha-research.md`. Same drik-silent pattern as
34a-d / 34e-items-1+6, but with a different outcome: this time the
≥2-source pandit-confirmation bar (locked precondition for items
where drik is silent) is **not met**. Specifically:
- **Sanjay Rath's own canonical Arudha article** (`srath.com/jyotiṣa/
  amateur/arudha-pada-images-of-world/`) lists ONLY the 4 calculation
  rules + the two D=1/D=7 exceptions (both already shipped pre-34e).
  No lord-in-dusthana strength-reduction rule appears.
- **Only well-cited related rule** is Upapada-Lagna-specific
  (Freedom Vidya, single-source, no classical attribution); cannot
  generalize to all 12 Arudha padas without inventing the rule.
- **Saptarishis BPHS Ch.13** commentaries (Madura Krishnamurthi
  Sastri + Jagdish Raj Ratra) are HTTP 403 on the open web; cannot
  verify classical text directly.
- **Audit-line "Arudha" assumed** a canonical rule exists; research
  surfaced that the assumed rule has no ≥2-source attestation, and
  the most authoritative modern source (Sanjay Rath's own published
  Arudha calculation article) excludes it. The Phase 34c Raja-Yoga
  bhanga deferral is the canonical precedent for this outcome
  (defer entirely when classical sources cannot be reconciled).

User decision recorded 2026-05-11 (4-option ask): "Defer item 2
entirely (Phase 34c Raja-Yoga precedent)". No code change shipped;
audit-baseline ⚠️ line stays ⚠️ with refreshed reasoning. Suite +
bundle unchanged from item-1 (8,053 tests / 371.11 KB CJS).

**Re-open path** (if revisited later): single-source UL-only variant
(implement bhanga only for bhava-12's Arudha = UL when its lord falls
in 6/8/12 from UL — one Freedom-Vidya source attestation), OR two-
source generic variant (requires Sanjay Rath's print *Jaimini
Maharishi's Upadesa Sutras* + an accessible Saptarishis BPHS Ch.13
commentary).

**Trikonargala (5/9) — what landed.** Research at
`notes/phase34e-trikonargala-research.md`, derivation script at
`notes/phase34e-trikonargala-derive.mjs`. Drik silent (no Argala
calculator on any of its 18 utilities). Pandit / classical consensus
is operative authority. ≥2-source bar met with margin:
- **5/9 trine formulation** attested by 4 independent sources
  (sutramritam.blogspot.com explicitly using "Trikona Argala" with
  5/9 pair; anandamoyee.home.blog; existing library JSDoc citing
  Iranganti Rangacharya / AstroVeda Wikidot / IndianAstrologyArticles;
  Parashara via summary citation that 5th house causes secondary
  argala).
- **Ketu reversal** attested by 3 independent sources
  (sutramritam.blogspot.com — "reversed for Ketu"; anandamoyee.home.blog
  — "anti-zodiacal for Ketu"; Sanjay Rath via srath.com — "Argalā
  reckoning from Ketu is in the reverse direction").
- **Competing variant explicitly NOT implemented**: Sanjay Rath's
  "Secondary Argala" 5/8 formulation (obstructed by 9/6) is a
  **different named concept**, not a contradicting variant of the
  same concept. The user prompt unambiguously chose the 5/9
  Trikonargala (trine) framing; the 5/8 "Secondary Argala" variant
  is documented in the research notes but not shipped.

Code additions:
- New optional field `trikona?: { sources: PlanetPlacement[];
  virodhakas: PlanetPlacement[] }` added to `ArgalaPerBhava` in
  `src/types/jyotish.ts`. Existing `argala` and `virodhargala`
  primary-Argala fields unchanged.
- `computeArgala(chart, options?)` gained function overloads:
  no-options → existing `ArgalaPerBhava[]` byte-for-byte (trikona
  field absent); `{ includeTrikonargala: true }` → same return type
  but with `trikona` populated on each entry.
- Ketu reversal handled inline: when iterating planets within the
  trikona branch, Ketu in 5th-from-bhava lands in `virodhakas`
  (NOT sources) and Ketu in 9th-from-bhava lands in `sources`
  (NOT virodhakas). All other 8 grahas (including Rahu) follow the
  standard 5th→source / 9th→virodhaka rule.
- 20 new tests across no-options default (trikona absent), opt-in
  trikona shape (12 entries, sources + virodhakas arrays),
  single-planet synthetic in 5th / 9th, Ketu-reversal synthetic ×
  2 (Ketu in 5th → virodhaka; Ketu in 9th → source), Rahu
  sanity-check (Rahu in 5th remains a source — only Ketu reverses),
  per-graha 2-list invariant × 5 R-tier fixture charts, and a
  fixture pin sweep with 13 hand-derived per-bhava entries across
  Modi / Sachin / Tata (including 2 Ketu-reversal cases: Modi
  bhava 3 sources=[Ketu] and Modi bhava 7 virodhakas=[Ketu]).

**Trikonargala — what was deferred.** The benefic-malefic
qualification ("only benefic planets in 5th or 9th constitute
benefic Argala") and the "Virodhargala obstructs only when
equal-or-stronger" qualifier are not applied — the calculation
ships positional Trikonargala lists; downstream consumers can
filter by benefic/malefic if their tradition requires. Sanjay
Rath's 5/8 "Secondary Argala" formulation (a different concept
under a different name) is documented as a future-scope variant
but not implemented. The "all argala reversed for Ketu" rule
(which would also reverse the primary 2/4/11 Argala for Ketu)
is out of this sub-phase's scope; only the trine-specific 5↔9
swap is applied.

**Sripati cusps — what was deferred.** Withdrawn-claim correction:
the prior-draft assertion that "Sripati degenerates to Equal House
at the equator" is **incorrect** — ASC and MC are 90° apart in
*right ascension* at φ=0 but not in *ecliptic longitude* (due to
ecliptic obliquity ε ≈ 23.4°). The corrected analysis shows
asymmetric quadrant arcs at every latitude including φ=0; the
implementation handles this without special-casing. No external
ProKerala / drik numerical cross-validation was possible (no
gettable Sripati cusp endpoint on the open web); validation relies
on first-principles hand-derivation against the unanimous
classical formula, which matches the Phase 34a-d / 34e-item-6
fallback pattern when drik panchang publishes nothing on a
surface. *Bhava sandhi* (bhava-boundary) longitudes — the
midpoints between adjacent Sripati cusps, used by some
KP/Placidus-trained astrologers as their notion of "cusp" — are
not exposed as a separate field, because under the Sripati
naming convention (unanimous across surveyed sources) "cusp"
already refers to the bhava-madhya. Callers needing sandhis can
trivially derive them from the cusps array.

**Narayan variable-duration — what landed.** Research at
`notes/phase34e-narayan-research.md`. Drik silent (no Narayan
calculator). Primary source: **Sanjay Rath, *Narayana Dasa* (Sagar
Publications)** — full canonical PDF retrieved and analyzed. Drik's
absence + Sanjay Rath's role as the rule's author makes this an
unambiguous single-authoritative-source case (the user's prompt
explicitly licensed siding with Sanjay Rath over PyJHora on
conflicts; Sanjay Rath's own published PDF is the operative
reference). Implementation reach:
- `computeNarayanDasha(birthDate, location, ayanamsa?, options?)`
  gained function overloads. Default (no options) returns
  `NarayanDashaResult` with fixed 9/8/7 Chara durations byte-for-byte
  pre-34e. `{ duration: 'variable' }` switches to the full Sanjay
  Rath rule set.
- **Rule 2** (base count = signs-from-rashi-to-lord, zodiacal for
  vimsapada / anti-zodiacal for samapada, inclusive count minus 1).
- **Rule 3** (lord exalted +1; debilitated −1; cap at 12, floor at 0).
  **Manteswara convention** for Rahu/Ketu exaltation (Rahu exalts in
  Gemini, Ketu in Sagittarius) — explicitly used by Sanjay Rath for
  Phalita Dasa, NOT Parashara's Taurus/Scorpio variant.
- **Rule 4 (Scorpio + Aquarius dual lord)**:
  - 4(a) both lords in dasha sign → 12 years (terminal, no adjust).
  - 4(b) both lords jointly elsewhere → apply Rule 2 to joint sign.
  - 4(c) one lord in dasha sign, other elsewhere → apply Rule 2 to
    the OTHER lord's sign.
  - 4(d) both elsewhere in different signs → use stronger lord's
    sign for the count, with strength compared by Source 1 Rule 2
    (planet count) then Source 2 Rule 1 (Mercury / Jupiter / own-
    sign-lord Rasi-Drishti aspect factors). Deterministic final
    tiebreak: natural Manteswara lord (Mars for Scorpio, Saturn for
    Aquarius).
- **Rasi Drishti** helper added (per Sanjay Rath's note "only Rasi
  Drishti should be used"): movable signs aspect 3 fixed (excluding
  adjacency); fixed aspect 3 movable; dual aspect 3 other dual.
- 22 new tests across backwards-compat default × 3 charts (no
  options → fixed 9/8/7 byte-for-byte); fixture sweep with first-
  principles cross-check per-non-dual-rashi × 3 charts; total-years
  bounds (12 ≤ Σ ≤ 144) × 3 charts; per-mahadasha continuity ×
  3 charts; Rule 2 zodiacal/anti-zodiac unit cases (Modi-derived);
  Rule 3 exaltation/debilitation/cap unit cases; Rule 4(c) Modi
  Scorpio dasha (Mars in Scorpio → use Ketu in Kanya); Rule 4(d)
  Modi Aquarius dasha (Saturn-in-Simha wins by planet count over
  Rahu-in-Meena); Sanjay-Rath worked Einstein table algorithmic
  validation × 4 rows (Aries / Cancer / Libra / Sagittarius), with
  one row (Cancer) explicitly noting the §3.1-documented divergence
  between Sanjay Rath's published-table value (12) and the algorithm-
  correct value (7) — the test pins the algorithm output per the
  locked "side with the algorithm's mathematical correctness when
  publication arithmetic has typos" stance.

**Narayan variable-duration — what was deferred.** The remaining
Strength Source 1 Rules 3, 4, 6, 7, 8 (planet status / modality /
lord degrees / even-odd / higher-dasa-period tiebreaks) are
explicitly NOT implemented — Source 1 Rule 2 + Source 2 Rule 1
resolve the strength comparison in the overwhelming majority of
natal charts; the further rules are vanishingly rare in practice
(documented in §2.5 of the research notes). Also deferred:
**strength-based starting rashi** (the canonical rule starts from
the stronger of Lagna or 7th house; current implementation always
starts from Lagna regardless of `options.duration`) and **second
cycle of dashas** (Rule 5 with years_2nd = 12 − years_1st for the
13th..24th dashas — library returns exactly 12 mahadashas).

**Shadbala sub-components — what landed.** Research at
`notes/phase34e-shadbala-research.md`; delta-prediction derive script
at `notes/phase34e-shadbala-derive.mjs`. Drik silent (no Shadbala
calculator); ProKerala's `/astrology/shadbala.php` is form-only POST
and cannot be queried for the AstroSage R-tier inputs. Operative
authority is **BPHS Ch.27 verses 16–20** (R. Santhanam translation),
with the user-prompt-stated reference order "ProKerala/PyJHora
numerics > BPHS" applied as a documentation note (one explicit
approximation: the library's `computeDignity` does not surface the
temporal great-friend / great-enemy distinction, so the
Saptavargaja mapping collapses friend/great-friend → 15 V and
enemy/great-enemy → 3.75 V; ~5–20 V per-graha under-shoot vs
ProKerala's full temporal-friendship Saptavargaja documented in
research §2.1). Code additions:
- `sthanaBala` (refactored): now `Uchcha + Saptavargaja + Ojha-Yugma
  + Drekkana` instead of Uchcha-only. Pre-34e callers see a larger
  number on the existing `sthana` field; field type unchanged.
- `saptavargajaBala`: sums `SAPT_VIRUPAS[computeDignity(graha,
  varga.rashi)]` across D1 + D2 + D3 + D7 + D9 + D12 + D30. Max
  theoretical 7 × 45 = 315 V (unreachable; realistic 30–150 V per
  graha).
- `ojhaYugmaBala`: +15 V each for D1-parity + D9-parity match.
  Masculine (Sun/Mars/Jupiter) match odd; feminine + eunuch
  (Moon/Mercury/Venus/Saturn) match even. Max 30 V per graha.
- `drekkanaBala`: +15 V if the planet is in its gender-group
  decanate (Sun/Mars/Jupiter → 1st 0–10°; Mercury/Saturn → 2nd
  10–20°; Moon/Venus → 3rd 20–30°). Max 15 V per graha.
- `shadbalaForChart` now computes the 6 additional divisional charts
  (D2, D3, D7, D9, D12, D30) once and reuses them across the 7
  visible grahas — amortizes the per-graha divisional lookups.
- Fixture pin re-derivation: the 5 Phase 31 / 34c Bhava Bala
  fixture pins were re-pinned to predicted post-item-5 totals.
  **Anti-circular workflow followed exactly**:
  1. Derived per-graha shadbala deltas via inline BPHS formulas
     in `notes/phase34e-shadbala-derive.mjs` (NOT via any new
     library code).
  2. Computed per-house bhavaBala delta = Δshadbala[cusp-lord].total.
  3. Ran tests, observed 5 fixture failures.
  4. Verified observed per-house deltas EXACTLY MATCH predicted
     per-house deltas to 4 decimal places across all 5 charts × 12
     houses (60 cells). Worked example: Mukesh Ambani bhava 7
     (Mars-ruled): predicted Δ=123.75 V (Saptavargaja 123.75 + Ojha
     0 + Drekkana 0), observed Δ=123.75 V. ✓
  5. Re-pinned to predicted totals with explicit comment citing
     the derive script as audit trail.
- 3 new shadbala unit tests verifying sub-components are wired in
  (at-least-one-graha exceeds pre-34e 60 V Uchcha ceiling;
  Saptavargaja minimum 7 × 1.875 = 13.125 V floor per graha;
  monotonic non-decrease vs hypothetical Uchcha-only baseline).
- 1 updated shadbala unit test: `Sthana ∈ [0, 60]` → `Sthana ∈ [0,
  420]` (new theoretical max = 60 Uchcha + 315 Saptavargaja + 30
  Ojha + 15 Drekkana).
- Net suite delta: +3 new shadbala tests, 5 bhavaBala fixture pins
  re-pinned (same count, new values). Suite total 8,100 → **8,103
  tests**. CJS bundle **377.73 KB** (+2.23 KB from item-4's
  375.50 KB).

**Shadbala sub-components — what was deferred.** Sanjay Rath's
temporal Tatkalika friendship layer (which would split friend →
great-friend 22.5 V and enemy → great-enemy 1.875 V in Saptavargaja
— the ~5–20 V per-graha gap documented in research §2.1). Kendradi
Bala (the Kendra/Panaphara/Apoklim by-house Sthana sub-component)
remains out of this sub-phase's scope. Full Kala Bala
sub-components (Tribhaga, Varsha, Masa, Dina, Hora, Ayana, Yuddha)
remain unimplemented — the user-named Phase 34e item-5 surface was
"Sthana sub-components", not Kala.

---

**Phase 34e complete.** Of 6 items planned: 5 shipped (1 Sripati, 3
Trikonargala, 4 Narayan variable, 5 Shadbala Sthana sub-components,
6 8-Karaka Jaimini), 1 deferred (item 2 Arudha bhanga — ≥2-source
bar unmet). Suite: **8,103 tests** (up from 8,009 at Phase 34d
landing; +94 tests across the 5 shipped items). CJS bundle:
**377.73 KB** (+8.80 KB from Phase 34d's 368.93 KB). All landed on
top of `package.json` 4.0.0; user assigns release tag.

**Effort.** 4–6d planned for the full step; total ~3d combined
(8-Karaka ~½d, Sripati ~½d, Arudha defer ~½h, Trikonargala ~½d,
Narayan variable ~1d, Shadbala sub-components ~1d).

---

## Phase 35 — Static Data Tables (Wave 6, offline distribution) — 🚧 in progress

**Status (2026-05-30).** Festivals table shipped (v4.2.0). Eclipses +
moon-phases tables code-complete and verified, **uncommitted** (user commits
manually — [[feedback_no_commit]]). Proposed next release **v4.3.0** (additive
minor).

> **Superseded 2026-08-06 (v5).** The three bundled JSONs (`src/data/`) are
> **removed**. Shipping pre-computed tables baked a location and a year window
> into the package: correct only near the reference site, stale the moment the
> window rolled, and 726 KB of object literal parsed at startup for anyone who
> imported one. The subpath entries survive as **engine-free readers** — the
> `source` table is now a required first argument, and consumers build their own
> with `build*Table`, cache the JSON, and read it back. The `*:gen` scripts
> remain as worked examples, now writing to a path the caller chooses. See
> Phase 37 for the rest of the table/compute API work.

**Why.** Mobile / offline / RN consumers want festival dates, eclipse timings,
and lunar phases without pulling the calculation engine (astronomy-engine) into
their bundle. The answer is a family of **engine-free subpath exports**, each
shipping a pre-computed JSON for India (IST) plus a runtime `build*Table` (main
entry, uses the engine) to generate and cache a table for any other location.

**Critical principle (locked).** drik panchang + pandit consensus is the
reference ([[feedback_drikpanchang_parity]]); narrower classical rules over
expansive ones.

### Shipped / ready modules

| Subpath | Accessors | Builder | Generator | Bundled JSON |
|---------|-----------|---------|-----------|--------------|
| `panchang-ts/festivals` | `getFestivalsForYear` / `…ForDate` | `buildFestivalsTable` | `festivals:gen` | `src/data/festivals.json` (v4.2.0) |
| `panchang-ts/eclipses` | `getEclipsesForYear` / `…ForDate` | `buildEclipsesTable` | `eclipses:gen` | `src/data/eclipses.json` |
| `panchang-ts/moon-phases` | `getMoonPhasesForYear` / `…ForDate` | `buildMoonPhasesTable` | `moon-phases:gen` | `src/data/moonPhases.json` |

All three: rolling **2-past / 5-future** window, en + hi, `_meta` + `years`
shape, `source` arg on accessors so a runtime-built table is a drop-in for the
bundled one. Each is bundled into its own tsup entry, so importing one never
drags in the engine or the other tables' data.

### Eclipses (`getEclipsesInRange`, `isEclipseVisibleAnyPhase`)

- **Any-phase visibility** (not peak-only): an eclipse is listed if the eclipsed
  body clears the horizon during *any* phase between first and last contact —
  catches moonrise/sunset-edge eclipses (e.g. 2026-03-03 total lunar, Moon rises
  already eclipsed). `visibleFromLocation` = any-phase (inclusion criterion);
  `visibleAtPeak` = body above horizon at greatest eclipse.
- **Solar eclipses report the local subtype** (`SearchLocalSolarEclipse`) — a
  globally-total eclipse shows as `partial` from Varanasi.
- **Penumbral lunar eclipses carry no `sutak`** (drik / pandit consensus — not
  religiously observed); enforced at the table layer, core `eclipse.ts`
  unchanged. 12 India-visible eclipses in the 2024–2031 window.

### Moon phases (`getMoonPhasesInRange`)

- The 4 quarter instants (new=Amavasya / first quarter / full=Purnima / last
  quarter) via `SearchMoonQuarter`. **Location-independent instants** — the
  builder takes only `timezoneOffsetMinutes` (no coordinates); "for India" means
  each instant mapped to its IST date. Distinct from the same-named *tithis*
  (~24h windows). ~49 events/year.

### Bootstrap gotcha (all three tables) — resolved

`*:gen` used to run `npm run build` first (inlining the *previous* JSON) and
then write the new JSON, so `dist/` lagged one generation. With no JSON bundled
(see the v5 note above) the cycle is gone: the generators read the built engine
and write to an external path.

### Phase 35 deferred / future-scope

- **Eclipse phase timeline** per entry (contact-by-contact local times +
  visibility) — engine already exposes the data (solar via `EclipseEvent`
  altitudes; lunar via semi-durations). User opted for the simpler `visibleAtPeak`
  flag over the full array; revisit if a consumer needs the timeline.
- **Tithi/Nakshatra/Yoga static tables** — the same engine-free pattern could
  extend to daily-panchang elements if an offline consumer asks.

---

## Wave Roadmap Summary

| Phase | Wave | Focus | Effort | Releases |
|-------|------|-------|--------|----------|
| 28 | Wave 1 | DrikPanchang Dainika Parity | 5–7d | v2.2, v2.3, v2.4 ✅ |
| 29 | Wave 2 | Birth Chart Foundation | 8–12d | v3.0 ✅ |
| 30 | Wave 3 | Advanced Astrology + Muhurta Engine | 8–10d | v3.1 ✅ |
| 31 | Wave 4a | Ashtakavarga + Yogas + Karakas + Bhava Bala | 8–10d | v3.2 ✅ |
| 32 | Wave 4b | Varshaphala + Tithi Pravesha + Arudha + Special Lagnas + Upagrahas + Argala | 8–9d | v3.3 ✅ |
| 33 | Wave 4c | Pathu Porutham + Narayan Dasha + KP sub-lord + Prashna foundation | 7–8d | v3.4 ✅ |
| 34 | Wave 5 | Drik Panchang / Pandit Parity Sweep (doshas, matching, yogas, fixtures, specialist completeness) | 13–19d | one minor per sub-phase on top of `package.json` 4.0.0 ✅ code-complete |
| 35 | Wave 6 | Static Data Tables — festivals / eclipses / moon-phases (engine-free subpaths + runtime builders) | 2–3d | v4.2.0 (festivals) → v4.3.0 (eclipses + moon-phases) 🚧 |
| 36 | Wave 7 | Own Astronomy Core + Ephemeris Cost Reduction (36.0 validation protocol gates all of it) | 36.0: 2–3d · 36.1: 1–2d · 36.2–36.4: 3–6w | v5 📋 |
| 37 | Wave 7 | Unified Table/Compute API for Static Data (+ muhurta table, ~4× smaller JSON) | 3–5d | v5 📋 |
| 38 | Wave 7 | Result-Shape & Public API Corrections (real Date instants, `_debug`, null-vs-optional) | 4–6d | v5 📋 |

**Decisions locked across the roadmap:**
- en + hi only (no new locales).
- Muhurta engine lives in the library (Phase 30).
- House system configurable; whole-sign default.
- v3.x stays — Wave 4 is fully additive. v4.0 is reserved for any future
  breaking change in the public type surface.

**Where to start next:** Waves 4 + 5 are complete, and Wave 6 (static data
tables) is landing the eclipses + moon-phases release (v4.3.0). For the next
*feature*, the highest-confidence in-repo pick is the **external-panel
cross-validation harness** (hardens shipped Shadbala / Pathu Porutham / Narayan
/ KP layers against ProKerala / PyJHora to the drik-parity standard). The
plan's nominal #1 — muhurta-engine consumer integration — lives in the
dharmagya / dharmagya-website repos, not here.

**Wave 5 / v4 candidates** (formerly "Out of scope for Wave 4"):
- **Consumer-app integration of the muhurta engine** — replace local
  `muhurat.ts` in dharmagya / dharmagya-website. Tracked in those
  repos. *Highest-priority follow-up* — the engine is ready; the gap
  is downstream wiring.
- **External-panel cross-validation harness** —
  - Shadbala fixture cross-validation against ProKerala / PyJHora at
    the 10-chart level (Phase 30 was algorithmic-only validation).
  - Pathu Porutham 20-pair `recommended`-flag match against ProKerala
    / Drik Tamil panel.
  - Narayan Dasha 5-chart Mahadasha boundary cross-check vs PyJHora.
  - KP cuspal sub-lord 5-chart match vs onlinejyotish.com.
  These were stated Phase 30/33 exit goals deferred to manual review;
  formalizing them as a fixture-driven sweep would close the loop.
- **KP horary 1..249 sub-numbers and Ruling Planets analytical layer**
  — natural extension of `computePrashnaChart` (KP horary is the
  obvious follow-up to chart-only Prashna).
- **Significator-driven event timing** — the Vedic Prashna analytical
  layer that walks dasha lords against significator sets.
- **Chara Dasha reverse-direction variant for even-rashi lagnas** —
  Narayan covers the parity case via a dedicated function; offering
  the same option on Chara would unify the two systems.
- **Ashtamangala Prashna** — Kerala-specific 8-fold horary analysis
  (Sanskrit / Malayalam sources diverge from KP horary here).
- **Tamil Pathu Porutham regional variants** — Telugu / Malayali
  traditions diverge slightly on Rajju groupings; the current
  implementation pins the AstroVed enumeration.
- **Extended 50-Saham list for Varshaphala** — Phase 32 ships the 27
  core Sahams.
- **8-Karaka Jaimini variant** with reversed Rahu — Phase 31 ships
  only the 7-Karaka Parashara variant.

A v4.0 major bump is reserved for any future breaking change in the
public type surface; nothing on this list inherently requires v4 —
each item is additive and would land as a v3.x minor.

---

## Phase 36 — Own Astronomy Core + Ephemeris Cost Reduction (Wave 7, v5) — 📋 planned

**Why.** Two goals that share the same work: (a) stop depending on
`astronomy-engine`, so a library meant to stay correct for decades does not
inherit someone else's release cadence; (b) cut the ephemeris cost, which the
2026-08-06 audit ([notes/v5-audit.md](notes/v5-audit.md)) measured at **84.8% of
self time**.

**The measurement that shapes this phase.** That 84.8% is *real math, not
overhead* — reimplementing the same theory buys nothing on its own:

| Measurement | Value | Consequence |
|---|---|---|
| Moon longitude (`Ecliptic(GeoMoon)`) | 7.9 µs | the periodic series is the floor |
| `EclipticGeoMoon` (skips precession+nutation) | 7.87 µs, bit-identical | frame conversion is ~free; no win there |
| `SearchRiseSet(Moon)` | **10.7 `CalcMoon` evaluations**, 0.099 ms | **the real cost** |
| `SearchRiseSet(Sun)` | 0 `CalcMoon`, 0.041 ms | solar path already cheap |
| Moon longitude reads/day *after* §36.1 | ~6.5 → ~0.05 ms | ephemeris becomes ~5% of a call |

So: **rise/set root-finding, not the longitude series, is what to attack first**,
and it needs no new astronomical theory at all. Accuracy also forbids a cheaper
series — Meeus's abridged ELP (60 terms) runs ~10″ ≈ **18 s of tithi time**,
against current Drik drift of 17–20 s that is already dominated by Drik
publishing to the minute. Halving runtime by doubling error is not a trade this
library makes.

`astronomy-engine`'s lunar theory is Montenbruck & Pfleger (`astronomy.js:2791`);
Sun and planets are VSOP87.

### 36.0 Validation protocol — build this FIRST, before any new math

**The problem this solves.** Our 8,233 tests are pinned to current output, so
they cannot adjudicate a new ephemeris. When one fails after a logic change
there are three indistinguishable explanations: the new logic is wrong; the new
logic is right and the fixture encoded the old error; or both sit within
tolerance of truth and the diff is noise. Deciding that from inside the repo is
impossible, and "the tests went green after I updated them" is not evidence of
anything. **No fixture may be touched until this protocol says which case it
is.**

#### A. Three tiers of authority — know which tier every assertion sits in

| Tier | Source | Authority | Can it adjudicate a change? |
|---|---|---|---|
| **0** | JPL Horizons (DE440/441), Swiss Ephemeris, NASA eclipse canon | Independent ground truth | **Yes — the only tier that can** |
| **1** | DrikPanchang published panchang | Rule-level reference, ±30 s quantized (publishes to the minute) | Only for *rule* questions, not ephemeris accuracy |
| **2** | Our own pinned fixtures | Regression detector, zero independent authority | **No** |

Most of the suite is Tier 2. That is fine — Tier 2 is what catches accidents —
but Tier 2 can only ever say "something changed", never "the change was wrong".

#### B. Commit external ground truth as a fixture, before touching any code

Pull ~2,000 geocentric apparent positions (Sun, Moon, Mercury–Saturn, lunar
nodes) from **JPL Horizons** spanning 1900–2100, weighted toward 1950–2050, and
commit as `tests/fixtures/horizons-*.json`. This is legitimately non-circular:
it does not originate from our code, and it does not change when our code does.

Add NASA/Espenak eclipse-canon contact times for the eclipse work, and a set of
Drik-published ayanamsa values (Tier 1, already partly present).

#### C. Characterize the CURRENT code against Tier 0 first — the step everyone skips

Before writing one line of new ephemeris, measure **astronomy-engine's own
error** against the Horizons fixture across the whole span. That produces a
baseline error curve, and with it a numeric definition of "at least as good as
today". Without this baseline, "more precise" is an opinion.

#### D. Then measure the new implementation against the same fixture

Now "better or worse" is arithmetic, not judgement:

```
Moon longitude, max |error| vs Horizons, 1900–2100
  astronomy-engine (baseline)   0.83″
  new implementation            0.41″   → better, accept
  new implementation            3.2″    → worse, reject
```

**Accept only if the new error is ≤ baseline across the whole span**, not just
on average and not just near 2025. Report max, mean, and the worst epoch.

#### E. Predict every fixture delta before observing it

This is the discipline that makes re-pinning legitimate. The sensitivity
coefficients are known and already used in this repo:

- Moon moves 0.549°/hr ≈ 1977″/hr → **δ arcsec of Moon longitude ⇒ δ × 1.82 s**
  of tithi/karana boundary movement.
- Nakshatra carries the ayanamsa **once**, yoga **twice**; tithi and karana
  carry it **zero** times (Moon − Sun cancels it).
- Sun moves 0.041°/hr → a δ arcsec Sun error moves a sankranti by δ × 24 s.

So: from the Tier 0 delta measured in D, **write down the expected fixture
movement first**. Then run the suite.

- Movement matches the prediction → legitimate re-pin. Record the predicted and
  observed numbers in the commit message.
- Movement is larger, or moves a fixture the error budget says should not move
  at all (e.g. a tithi end-time shifting when only the ayanamsa changed) →
  **that is a bug**, not an improvement. Do not re-pin. Find it.

This is exactly how the +38″ ayanamsa correction was validated: the
tithi/karana-vs-nakshatra/yoga *sign split* identified the wrong constant, and
the prediction "tithi and karana are untouched" was confirmed before anything
was re-pinned. Institutionalize that.

#### F. Split the suite so "don't change tests" is structural, not a promise

Two kinds of assertion, and they get different rules:

- **Invariant tests — may NEVER change.** These encode facts about the domain,
  not about our arithmetic: tithi/nakshatra/yoga/karana *index* at sunrise,
  festival calendar dates, `start ≤ peak ≤ end`, sunrise < sunset, the 30 tithis
  of a lunation summing to the synodic month, 12 sankrantis spanning one
  sidereal year, every name/boolean/index output. **If one of these breaks, the
  new code is wrong — full stop.** No tolerance, no re-pin, no discussion.
- **Numeric tolerance tests — may move, with receipts.** Pinned instants, each
  carrying a provenance comment stating which tier justifies the number and to
  what accuracy. Re-pin only via rule E.

Mark the tiers in the test files so the rule is visible at the point of
temptation.

#### G. Cross-checks that need no fixture at all

Independent signals that catch whole classes of error without any pinned value:

- **Solver vs ephemeris separation.** Compare each reported transition against
  an exact bisection of the *same* index function. That bounds the *solver's*
  contribution independently of the ephemeris (already measured at ≤24 ms) — so
  when a time moves you know which half moved.
- **Mean-motion round-trip.** The longitude derivative must match the known mean
  motion of each body to within the theory's stated accuracy.
- **Closure identities.** Tithis per lunation, sankrantis per year, moon phases
  per year: all have known counts and spans that a wrong theory breaks loudly.
- **Delta-T isolation.** A Delta-T error shifts everything *uniformly* — test it
  on its own so it cannot hide inside a longitude comparison.

#### H. Freeze a reference implementation — this dissolves the optimization problem

Write the new ephemeris **twice**:

1. **Reference**: slow, obvious, transcribed straight from the literature with
   no algebraic cleverness. Validate *this* against Tier 0 (steps C–D). Once it
   passes, **freeze it** and keep it in the repo as a test-only module.
2. **Optimized**: whatever it takes to be fast.

The optimized version is then verified by **differential testing against the
frozen reference** over ~100k pseudo-random instants, asserting max delta below
a stated threshold — not against fixtures, not against Tier 0, and not against
intuition. Every future optimization is checked the same way, forever, at
essentially zero cost.

This is already the pattern that validated the Chebyshev interpolation (fitted
values checked against exact evaluation, max error quoted as a *time* error).
Making it explicit means the correctness question is asked **once**, and every
subsequent performance change is a cheap, mechanical proof.

**Ordering is not negotiable: correct first, frozen second, fast third.**
Optimizing before the reference is frozen leaves nothing to check the
optimization against, which is how a fast wrong answer ships.

### 36.1 Structural wins — no new theory (do these first)

Each is self-contained, non-breaking, and provable against the existing suite.

1. **Share Chebyshev blocks across calls.** `LongitudeCache` is constructed per
   `getDailyPanchang`, so a calendar scan rebuilds 4-day Moon and 8-day Sun
   blocks *every day*. Hoist the block maps to module scope with an entry cap +
   clear-on-overflow, matching `EVENT_CACHE` in `sunrise.ts`.
   *Prototyped 2026-08-06: `GeoMoon` 21.5→6.5/day, `SunPosition` 29.1→5.1/day,
   `sections: []` −34%, `getInstantPanchang` −29%, default warm call −23%, and
   **all 8,235 tests passed unchanged**.*
   Safe because a block is a pure function of its block index over **tropical**
   longitudes — ayanamsa is applied per read, so blocks are ayanamsa-independent
   too. Same order-independence argument `cache.ts` already documents.
2. **Interpolated lunar rise/set.** Build a Chebyshev interpolant of the Moon's
   RA/Dec over the day and solve rise/set against the polynomial. Turns 10.7
   full theory evaluations into 10.7 polynomial evaluations. Expected ~10× on
   the single most expensive primitive; a default day runs two of them
   (moonrise + moonset ≈ 0.14 ms).
3. **Canonical lunar event cache.** Give `moonrise.ts` the per-UTC-day event
   cache `sunrise.ts` already has, keyed on
   `(direction, lat, lon, elevation, dayIndex)`. Buys the same single-valuedness
   property sunrise gained, plus reuse across consecutive days and between the
   `'moonTimes'` section and the festival block's Karva Chauth / Sankashti
   anchors.
4. **Fix the cache-mode heuristic.** `doEndTimes ? 'interpolated' : 'exact'` is
   right for a narrowed call and wrong for a full one: with all sections on,
   `computeEndTimes: false` is *slower* (0.53 → 0.62 ms warm). Choose the mode
   from expected read volume, e.g. `doEndTimes || wantFestivals`.
5. **Route the eclipse syzygy guard through the call's cache.** `eclipse.ts`
   calls `getTropicalMoonLongitude` / `getTropicalSunLongitude` directly, so
   `sections: ['eclipse']` costs the same 21.5 `GeoMoon`/day as a full call.
   Keep the guard (4 evaluations to skip a search costing hundreds — it is
   well-designed); just let the interpolant answer them.
6. **Search-layer cleanups.** Hoist the loop-invariant
   `getIndexAtTime(nextSunriseUtc)` out of `findDailyElements`
   (`search.ts:284`); check whether `findTransitionTime`'s up-front bracket
   probe can be reused by the secant solve.

**Gate.** Re-profile after 36.1. If the ephemeris has dropped to a few percent
of runtime, the *performance* case for 36.2+ is gone and the decision becomes
purely about independence and bundle size — decide it on those terms, honestly.

### 36.2 Own Sun + Moon ecliptic longitude

The tractable, high-confidence piece. Replaces `GeoMoon`, `SunPosition`,
`Ecliptic`.

- Moon: full-precision analytical theory to ≤1″ (M&P-class or truncated
  ELP2000-82B retaining enough terms for the budget). **Not** an abridged
  60-term series.
- Sun: VSOP87D truncated to ≤1″.
- Compute **sidereal directly** where possible, folding the ayanamsa in rather
  than the current tropical → subtract round-trip.
- Own Delta-T (Espenak–Meeus, as `astronomy-engine` uses). Getting this wrong
  shifts everything uniformly and looks plausible — pin it with its own tests.

**Validation is the real cost of this phase, not the series** — and it is
governed entirely by §36.0. In short: write the *reference* implementation
first, measure it against the committed JPL Horizons fixture, compare to the
baseline error curve taken from the current code, predict every fixture delta
from the measured longitude delta before running the suite, and only then
re-pin. Re-pinning fixtures to new ephemeris output without that chain is the
circular trap [[feedback_fixture_repinning]] forbids.

Sequence for this sub-phase, strictly: reference implementation → Tier 0
validation → **freeze** → optimized implementation → differential test against
the frozen reference (§36.0 H). Do not begin optimizing before the freeze.

### 36.3 Own rise/set + moon-phase search

Near-free once 36.1 and 36.2 exist.

- Rise/set: root-find altitude(t) against the interpolant, with topocentric
  parallax and the same refraction model (Meeus). Replaces `SearchRiseSet`,
  `Horizon`, `Equator`, `SiderealTime`, `Observer`.
- Moon phases: root-find elongation, which the library already computes.
  Replaces `MoonPhase`, `SearchMoonPhase`, `SearchMoonQuarter`,
  `NextMoonQuarter`.

### 36.4 Own planetary positions (jyotish)

VSOP87 for Mercury–Saturn plus the lunar nodes. Bulky but mechanical and low
risk; replaces `GeoVector`. Retrograde detection falls out of the longitude
derivative.

### 36.5 Eclipses — last, because hardest; not optional-forever

**The goal is zero dependencies, and that includes eclipses.**
`astronomy-engine` is a **migration waypoint, not an end state**: it stays only
while modules are being ported, and it is dropped when this one lands. Eclipses
go last purely because they are the hardest, not because they are exempt.

> **Corrected 2026-08-06.** An earlier draft recommended keeping
> `astronomy-engine` as a permanent *optional* dependency for this path. That
> was incoherent — an optional dependency still sits in `package.json`, still
> ships to every eclipse user, still inherits an external release cadence, and
> adds conditional-loading complexity on top. It buys almost none of the
> independence while paying most of the cost. Two premises behind it were also
> wrong: (a) "no cheap external ground truth" — NASA's Five Millennium Canon
> (Espenak/Meeus) publishes Besselian elements *and* local circumstances for
> every eclipse −1999…+3000, which is usable ground truth and arguably usable
> input; (b) the 57 KB tree-shaken size was cited as a reason to keep it, when a
> large chunk is a reason to *replace* it. Difficulty is the only real argument,
> and difficulty is a sequencing question, not an exemption.

**Eclipses are not one problem — they split, and the halves differ a lot:**

- **Lunar (Chandra Grahan) — tractable.** Pure shadow geometry: Earth's umbra /
  penumbra radius at the Moon's distance versus the Moon's angular separation
  from the antisolar point. Meeus ch. 54. It needs only Sun and Moon positions,
  which 36.2 already provides. Contact times fall out of solving
  `separation = sum of radii`. "Local circumstances" collapses to *is the Moon
  above the horizon*, which 36.3 already computes. Do this one first.
- **Solar (Surya Grahan) — the genuinely hard part.** Local contact times,
  subtype and obscuration need Besselian elements projected onto the fundamental
  plane with the observer on a rotating ellipsoid. Meeus ch. 54 plus the
  Explanatory Supplement.

**Validation (Tier 0):** NASA/Espenak canon contact times and published local
circumstances for a sample of eclipses across the supported span, for several
observer locations including at least one where the eclipse is partial and one
where it is not visible at all.

**The escape hatch, and when to use it.** If solar local circumstances cannot be
validated to the standard in §36.0, that is a legitimate finding — report it
with the measurements rather than shipping something unvalidated. The fallback
is then decided **with evidence**: either a documented lower-precision solar
implementation with its accuracy stated honestly, or retaining a dependency for
that path alone. Do not pre-commit to the fallback now; the premise that it is
needed has not been tested.

### Bundle-size context (measured, tree-shaken + minified)

| Import | Minified | Gzipped |
|---|---|---|
| `getDailyPanchang` only (whole library) | 141 KB | 49 KB |
| — of which `astronomy-engine` Sun+Moon | 36 KB | 16 KB |
| — of which + rise/set + horizon | 55 KB | 24 KB |
| `astronomy-engine` eclipse cluster alone | 57 KB | 25 KB |

Tree-shaking already spares us ~350 KB of `astronomy-engine`, so own code buys
maybe 20–40 KB minified for the core — real for Hermes, not transformative.
**Independence, not size, is the honest headline argument.** Note the eclipse
cluster is the single largest chunk: replacing it is the biggest size win
available, which is a reason to do it, not to avoid it.

### Phase 36 exit criteria

**Validation (gates everything else):**

- Tier 0 fixture (`tests/fixtures/horizons-*.json`) committed **before** any new
  ephemeris code exists.
- Baseline error curve of the *current* code vs Tier 0 recorded here, so
  "better" has a number behind it.
- Every own-ephemeris module measured against Tier 0 over 1900–2100, max error
  **≤ baseline across the whole span** — not just on average, not just near 2025.
- The suite split into invariant vs numeric-tolerance assertions (§36.0 F), with
  tiers marked in the files.
- **Zero invariant-test changes.** Any index, name, boolean or festival date
  that moves is a bug, and the phase does not exit until it is explained and
  fixed — never re-pinned.
- Every numeric re-pin carries a delta **predicted before it was observed**,
  with predicted and observed values in the commit message.
- A frozen reference implementation lives in the repo, and the shipped optimized
  path is differential-tested against it over ≥100k instants.

**Performance:**

- 36.1 landed, output-neutral (`tests/unit/sections.test.ts` green), with
  before/after numbers recorded here.
- Default distinct-day call meaningfully under the current 1.10 ms; narrowed
  calls and `getInstantPanchang` roughly halved.
- Drik parity (Tier 1) no worse than the current ≤60 s worst-case end-time
  drift.

**Scope:**

- `astronomy-engine` removed from `dependencies` entirely, or — if solar local
  circumstances failed Tier 0 validation — a written finding with the
  measurements that says exactly why, and the fallback chosen on that evidence.
- Lunar eclipses ported before solar (they are a different, much easier
  problem — see 36.5).

### Known limits of this protocol — state them rather than pretend

- **Solar local circumstances are the thinnest Tier 0 coverage.** The
  NASA/Espenak canon publishes contact times, Besselian elements and local
  circumstances, so ground truth does exist — but assembling enough observer-
  location cases to validate *obscuration* and *local subtype* broadly is more
  work than for any other module. Budget for it; do not assume it away in
  either direction.
- **Drik is Tier 1, not Tier 0.** It publishes to the minute and applies its own
  rule interpretations. It can never certify sub-minute ephemeris accuracy; it
  can only certify that we pick the same *day* and the same *rule*.
- **Tier 0 covers positions, not rules.** Horizons cannot tell us whether
  Janmashtami falls on the right day. Rule correctness stays a Tier 1 question,
  which is why the invariant/tolerance split in §36.0 F matters: rules live in
  the invariant half.

---

## Phase 37 — Unified Table/Compute API for Static Data (Wave 7, v5) — 📋 planned

**Why.** The dynamic builders mostly exist already (Phase 35) but the family is
inconsistent, one member is missing, and the emitted tables are ~4× larger than
they need to be.

**What exists today.** Three bundled JSONs — `src/data/festivals.json`,
`eclipses.json`, `moonPhases.json` — each with a runtime builder
(`buildFestivalsTable` / `buildEclipsesTable` / `buildMoonPhasesTable`, taking
`startYear`/`endYear` + location) and a range enumerator (`getFestivalsInRange`,
`getEclipsesInRange`, `getMoonPhasesInRange`). **There is no muhurta JSON** —
`STOCK_MUHURTA_RULES` is rule *definitions* in code, and `findAuspiciousDates`
computes on the fly.

### 37.1 Name the two modes apart

`getFestivalsForYear(year, lang, source)` reads a **table**;
`getFestivalsInRange(start, end, location, options)` runs the **engine**. Two
near-identical names with different inputs and different semantics is the single
most confusing thing in the calendar API. Settle on one convention across all
four families, e.g. `computeFestivalsForYear(...)` (engine) vs
`readFestivalsForYear(...)` (table), and keep the old names as deprecated
aliases through v5.

### 37.2 Add the missing single-year compute entry points

`buildFestivalsTable` requires a table wrapper and a year *range*. Add the
obvious thing a consumer reaches for first — year in, results out:

```ts
computeFestivalsForYear(2027, location, { timezone: 330 })   // → FestivalDay[]
computeEclipsesForYear(2027, location, { timezone: 330 })
computeMoonPhasesForYear(2027, { timezone: 330 })
computeAuspiciousDatesForYear(2027, vivahRule, location, { timezone: 330 })
```

Each is a thin wrapper over the existing range enumerator. `build*Table` stays
as the "generate a cacheable JSON" path.

### 37.3 Bring muhurta into the family

The gap. Add `buildMuhurtaTable` + a `panchang-ts/muhurta` engine-free subpath
so consumers can precompute auspicious dates per occasion and ship the JSON,
exactly as they can for festivals today. This is what makes the family coherent
rather than three-out-of-four.

### 37.4 Shrink the emitted tables (~4×)

The bundled JSONs are gone as of v5, so this is now about what `build*Table`
**emits** — the file consumers cache and parse in their own app, where the
parse-time cost lands on them.

Both large tables repeat every localized string at every occurrence:

| Table | Entries | Unique strings | JSON now | Dictionary-encoded |
|---|---|---|---|---|
| festivals | 2,112 | **83** names, 59 descriptions | 260 KB | **68 KB** (26%) |
| moon phases | 396 | **4** names, 4 descriptions | 87 KB | **23 KB** (27%) |

Emit `key` + a string dictionary; resolve names at read time. Note gzip already
hides this on the wire (35 KB) — **this is a parse-time and memory win**, which
is precisely the constraint that bites on Hermes, where the bundled
`festivalsTable.js` is 726 KB of object literal (plus 3,167 `\uXXXX` escapes
inflating the Devanagari) parsed at startup.

This also closes a v5 gap from the audit: `FestivalInfo` gained a stable `key`,
but `FestivalTableEntry` did not — so the static table is currently both larger
*and* less useful than engine output. One change fixes both.

### Phase 37 exit criteria

- One naming convention across festivals / eclipses / moon-phases / muhurta,
  old names deprecated not removed.
- `compute*ForYear` for all four families.
- `panchang-ts/muhurta` subpath + `buildMuhurtaTable` shipped.
- Emitted tables carry `key`; festivals and moon-phases output at ≤30% of
  current size with identical resolved output.
- The `*:gen` example scripts still produce a readable table end to end.

---

## Phase 38 — Result-Shape & Public API Corrections (Wave 7, v5) — 📋 planned

**Why.** The 2026-08-06 audit ([notes/v5-audit.md](notes/v5-audit.md)) §2 found
the result object is where this library diverges most from what a TypeScript
consumer expects. Every item here is a **breaking change**, which is exactly why
they belong in v5 and nowhere else — carrying them forward means another year of
the same bugs. Phases 36 and 37 are performance and data-shape; this is the
public contract.

### 38.1 Published `Date`s must be real instants — the flagship change

Every `Date` in a result is currently `trueInstant + offsetMinutes`, so its
`getTime()` is **not** when the event happened:

```
result.sunrise.toISOString()   2025-01-14T07:09:44.172Z
true sunrise                   2025-01-14T01:39:44.172Z   ← 330 min apart
```

The README tells consumers to read it with `getUTC*`, which works right up until
they do anything else. What silently breaks: `JSON.stringify` (emits a wrong
instant labelled `Z`), `Intl.DateTimeFormat` with a `timeZone` (renders
**12:39 pm** instead of 07:09 am), any comparison or diff against a real
timestamp, date-fns / luxon / `Temporal.Instant`, and storage in a
`timestamptz` column.

Temporal reached **Stage 4 in March 2026** (ECMAScript 2026; shipping in Chrome
144+ and Firefox 139+), and `Temporal.ZonedDateTime` is precisely the "instant
*in* a zone" type this library has been hand-rolling incorrectly.

**Target shape:**

```ts
sunrise: Date          // real instant — .getTime() is correct epoch ms
sunriseLocal: string   // "2025-01-14T07:09:44+05:30" — offset-carrying ISO
```

plus an exported `formatInZone(date, tz)`. An offset-carrying ISO string is the
one representation that survives JSON, is unambiguous, parses correctly
everywhere, and converts to `Temporal.ZonedDateTime` in one call.

Migration for consumers is mechanical (`getUTCHours()` → read `*Local`, or
format the instant). Applies to every `Date` in `DailyPanchangResult`,
`InstantPanchangResult`, every `TimePeriod`, and the chart/dasha results.

### 38.2 Delete `_debug`

`DailyPanchangResult._debug?: { totalMs, sunriseMs, elementsMs, endTimesMs }` is
in the published type and written **nowhere** in `src/`. Dead API surface
promising timing data we never emit. Remove it. If timing is ever wanted it
belongs behind an explicit option — non-deterministic values do not belong in a
result object consumers may snapshot or cache.

### 38.3 Fix `suryaNakshatra`'s type

`computeSuryaNakshatra` (`rashi.ts:31`) returns `RashiInfo`, whose `index` is
documented *"0 = Mesha … 11 = Meena"*. The value is `nakshatraOf(siderealSun)` —
**0..26**. Anyone indexing a 12-element rashi array by it gets silent garbage
for two thirds of the year. Give it its own type.

### 38.4 Settle optional-vs-null

Three conventions for "not applicable" coexist and consumers cannot predict
which they get:

- `bhadra`, `varjyam`, `eclipse` → `| null`
- `chandraBalam?`, `tarabala?` → present only when the matching option was passed
- `panchakaRahita`, `festivals` → empty array

For fields whose absence depends on *input options*, the modern TS answer is a
conditional return type keyed on the options object, so passing `janmaRashi`
narrows `chandraBalam` to non-optional. Failing that, make everything `| null`
and always present. Predictable beats clever.

### 38.5 Retire redundant aliases and naming drift

- `dayDurationMinutes` / `dinamanaMinutes` and `nightDurationMinutes` /
  `ratrimanaMinutes` are the same numbers twice. Keep one pair, or state
  plainly in the type that they are aliases.
- Casing drifts: `chandramasa` vs `chandraRashi` vs `suryaNakshatra`.
  `chandramasa` is the odd one out.
- `masa` (`{index, name}`, solar) sits beside `chandramasa` (lunar) with nothing
  saying so. Document or rename.

### 38.6 Echo the resolved timezone

Options take `number | string`; the result carries `timezone: number`. Pass
`'America/New_York'` and the result cannot tell you which zone produced it —
which matters precisely because of 38.1. Return
`{ offsetMinutes: number; zone?: string }`.

Related: `resolveUtcOffset` resolves the offset **once** per call from a
reference date, so a day containing a DST transition is computed at a single
offset. Correct for almost every day — document the limit explicitly instead of
the current blanket "DST resolves automatically".

### 38.7 Decide: group the result object

`DailyPanchangResult` has ~50 flat top-level fields mixing five categories.
Grouping (`result.muhurtas.abhijit`, `result.inauspicious.rahuKalam`) is more
discoverable, but it is a large break for ergonomic gain only.

**Do it only if 38.1 also lands, and in the same release** — it is far cheaper
as one migration than two. Otherwise defer to v6.

### Phase 38 exit criteria

- No `Date` in any public result is offset-shifted; `JSON.stringify` round-trips
  to the correct instant; `Intl` with a `timeZone` renders the right wall clock.
- A test asserts each published instant against the primitive that produced it
  (the audit's repro, kept as a regression net).
- `_debug` gone; `suryaNakshatra` correctly typed; one optional-vs-null rule
  applied across the result.
- README migration section covers every rename with a before/after.
- An explicit, recorded decision on 38.7 rather than a drift.
