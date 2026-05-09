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
| 32 | Varshaphala + Tithi Pravesha + Arudha + Special Lagnas + Upagrahas + Argala (Wave 4b — North-Indian + remaining classical layers) | v3.3.0 | 🟡 planned |
| 33 | Pathu Porutham + Narayan Dasha + KP sub-lord layer + Prashna foundation (Wave 4c — South-Indian regional features) | v3.4.0 | 🟡 planned |

State as of v3.2.0: **7,355 tests** passing across 85 files. Bundle ~327 KB.
Festival registry: 80+ entries. Diaspora cross-verified across 5 non-IST cities.
Hermes CI green.

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

## Phase 32 — Varshaphala + Tithi Pravesha + Arudha + Special Lagnas + Upagrahas + Argala (Wave 4b) — 🟡 planned

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

### Phase 32 Exit Criteria

- ✅ All 6 modules with full unit + cross-validation tests; ~140 new tests.
- ✅ Solar-return + Tithi-pravesha instants ±1 min vs ProKerala / Cosmic Insights.
- ✅ Bundle target: ≤ 380 KB CJS.
- ✅ Hermes JS-syntax check; typecheck clean.
- ✅ API additive — no v3.2 breakage.
- ✅ README sections added with examples for each new export.

---

## Phase 33 — Pathu Porutham + Narayan Dasha + KP sub-lord layer + Prashna foundation (Wave 4c) — 🟡 planned

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

### Phase 33 Exit Criteria

- ✅ Pathu Porutham 20-pair cross-validation against ProKerala / Drik
  Tamil panel — recommended-flag exact match.
- ✅ Narayan Dasha 5-chart Mahadasha boundary cross-check vs PyJHora.
- ✅ KP cuspal sub-lord 5-chart match vs onlinejyotish.com panel.
- ✅ ~80 new tests; all pass under Hermes.
- ✅ Bundle target: ≤ 410 KB CJS.
- ✅ API additive — no v3.3 breakage.
- ✅ README sections added with examples.

---

## Wave Roadmap Summary

| Phase | Wave | Focus | Effort | Releases |
|-------|------|-------|--------|----------|
| 28 | Wave 1 | DrikPanchang Dainika Parity | 5–7d | v2.2, v2.3, v2.4 ✅ |
| 29 | Wave 2 | Birth Chart Foundation | 8–12d | v3.0 ✅ |
| 30 | Wave 3 | Advanced Astrology + Muhurta Engine | 8–10d | v3.1 ✅ |
| 31 | Wave 4a | Ashtakavarga + Yogas + Karakas + Bhava Bala | 8–10d | v3.2 ✅ |
| 32 | Wave 4b | Varshaphala + Tithi Pravesha + Arudha + Special Lagnas + Upagrahas + Argala | 8–9d | v3.3 🟡 |
| 33 | Wave 4c | Pathu Porutham + Narayan Dasha + KP sub-lord + Prashna foundation | 7–8d | v3.4 🟡 |

**Decisions locked across the roadmap:**
- en + hi only (no new locales).
- Muhurta engine lives in the library (Phase 30).
- House system configurable; whole-sign default.
- v3.x stays — Wave 4 is fully additive. v4.0 is reserved for any future
  breaking change in the public type surface.

**Where to start next:** Phase 32 Step 32-1 — Varshaphala
(`src/jyotish/varshaphala.ts` + Saham tables). Largest single piece of
Wave 4b; the solar-return search machinery is reused by Tithi Pravesha
in Step 32-2.

**Out of scope for Wave 4** (candidates for Wave 5 / v4 if revisited):
- Consumer-app integration of the muhurta engine (replace local
  `muhurat.ts` in dharmagya / dharmagya-website) — tracked in those
  repos.
- Shadbala fixture cross-validation against ProKerala / PyJHora at the
  10-chart level (Phase 30 was algorithmic-only validation).
- Chara Dasha reverse-direction variant for even-rashi lagnas
  (Narayan Dasha in Phase 33 covers the parity case via a dedicated
  function; Chara stays forward-only).
- KP horary 1..249 sub-numbers and Ruling Planets analytical layer.
- Ashtamangala Prashna (Kerala-specific 8-fold horary analysis).
- Tamil Pathu Porutham regional variants (Telugu / Malayali traditions
  diverge slightly on Rajju groupings).
- Extended 50-Saham list for Varshaphala.
