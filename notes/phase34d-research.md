# Phase 34d — Drik-Parity Fixture-Driven Cross-Validation Harness

Research date: 2026-05-11. Reference order (locked Phase 34 principle):
**drik panchang published output > pandit consensus (ProKerala / AstroSage /
AstroVed) > classical BPHS**.

Sub-phase scope: a consolidated **golden-fixture suite** that pins, for each
of 10–15 reference birth charts, the **end-to-end output** of every Phase
34a/b/c computation against an audited expectation table. This is the
regression net the Phase 34 sub-phases referred to ("once 34a–c are green,
34d locks them in").

## TL;DR — the scoping decisions

Two structural facts about drik panchang's public surface drive every
decision in this phase:

1. **Drik panchang's birth-chart calculators are form-only POST pages.**
   Verified empirically against the three reachable tools:
   - `drikpanchang.com/jyotisha/kundali/kundali.html` — form-only.
   - `drikpanchang.com/jyotisha/sadesati/shani-sadesati-analysis.html` —
     form-only.
   - `drikpanchang.com/jyotisha/horoscope-match/horoscope-match.html` —
     form-only (also confirmed in
     [`tests/fixtures/ashtakoot-pairs.json`](tests/fixtures/ashtakoot-pairs.json) `_meta.drik_scrape_status`).

   None of these expose a GET-style query-string interface and none is
   amenable to automated scraping. A fixture's "drik-published value"
   therefore can be sourced only via **manual entry into the form and
   recording of the rendered output** (screenshot or copy of the verdict
   block).

2. **Drik panchang does not publish a panel for every Phase 34 computation.**
   Three Phase 34 surfaces are off-limits for drik cross-validation:

   | Computation | Drik publishes? | Phase 34d source |
   |---|---|---|
   | Daily Panchang block (tithi/nakshatra/yoga/karana/vara/sunrise) | ✅ Yes — `/panchang/day-panchang.html` | **delegated to Phase 28** (50 fixtures already cross-validate this) |
   | Mangal Dosha verdict + per-chart breakdown | ✅ Yes — `/jyotisha/mangal-dosha/…` (verdict only; cancellation reasons not surfaced) | drik panel screenshot trace + structural derivation from drik's stated rule set (Phase 34a §1) |
   | Kaal Sarp Dosha verdict + subtype | ✅ Yes — `/jyotisha/kalasarpa-yoga/kalasarpa-yoga-calculator.html` (subtype + verdict) | drik panel screenshot trace |
   | Sade Sati phase + arc dates | ✅ Yes — `/jyotisha/sadesati/shani-sadesati-analysis.html` (phase 1/2/3 + arc boundary dates) | drik panel screenshot trace; Saturn-transit dates already cross-checked against the same source-corpus that drives Phase 29 (Barbara Pijan published table cross-checked to Drik) |
   | Ashtakoot total + per-koot | ✅ Yes — `/jyotisha/horoscope-match/horoscope-match.html` (total + per-koot, optional gunas verdict) | manual form-entry per pair; record screenshot trace |
   | **Pitru Dosha** | ❌ **No** | **Out of Phase 34d scope** — drik has no calculator; Phase 34a (the 9-rule expansion) is the regression net |
   | **Birth-chart Yoga panel** (Gajakesari / Mahapurusha / Neecha Bhanga / Raja Yoga) | ❌ **No** | **Out of Phase 34d scope** — drik's `/yoga/yoga.html` covers only the 8 daily *panchang* yogas (Sarvarthasiddhi etc.), not birth-chart yogas. Phase 34c §1 documents this explicitly. Yoga regression net stays at `tests/unit/yogas.test.ts` + `tests/validation/phase29-birthchart-validate.test.ts` |

   These deferrals match the Phase 34 locked principle: *"if drik panchang
   doesn't apply a rule, the library shouldn't pretend to cross-validate
   it against drik."*

   The user-facing read on this is: Phase 34d is a **drik-aligned subset**
   of the full audit baseline, not a full regression net. The Pitru / yoga
   pieces sit on top of multi-pandit consensus and stay in their own
   per-unit suites where the citation is honestly tertiary.

## Final Phase 34d scope (post-research)

**In scope** (cross-validated against drik panchang):
- ✅ **Mangal Dosha** — `MangalDoshaInfo` per chart. Boolean `afflicted`,
  `severity` (`none` / `anshik` / `purna`), per-chart breakdown (`fromLagna`,
  `fromMoon`, `fromVenus`). Cancellations array compared as a *set match*
  (drik doesn't enumerate cancellations on the panel, so we assert
  set-equivalence against the canonical rule set documented in Phase 34a
  §1).
- ✅ **Kaal Sarp Dosha** — `KaalSarpDoshaInfo`. Boolean `afflicted`,
  `subtype` (one of the 12 naga names), Rahu/Ketu houses. `partial` is
  informational-only per drik's own statement ("drik panchang does not
  list partial Kaal Sarpa") and is asserted but not used to fail.
- ✅ **Sade Sati** — `SadeSatiInfo` evaluated at a specific `asOf` date.
  Boolean `active`, `phase` (1/2/3 or null), `currentArcStart` +
  `currentArcEnd` within ±2 days of the published Saturn-ingress dates
  (same tolerance as Phase 29 sadesati validation).
- ✅ **Ashtakoot** (selected 5 pairs) — `AshtakootResult.totalScore` within
  ±1 point of drik's panel total; per-koot scores within ±1 point per koot.
- ✅ **Panchang sanity slice** — for each chart, on the birth date in the
  birth city, assert sunrise/sunset within Phase 28's existing tolerances
  (±3 min / ±2 min for sandhya) and tithi / nakshatra / yoga name exact
  match. This is a **2-field sanity slice**, not a full Phase 28 redo —
  the bulk of panchang parity stays in Phase 28's 50-fixture sweep.

**Out of scope** (documented deferral, see table above):
- ❌ Pitru Dosha (no drik calculator).
- ❌ Yoga panels — Gajakesari / Mahapurusha / Neecha Bhanga / Raja Yoga
  (drik publishes none of these on any reachable URL).

## Reference chart selection

**Source corpus.** Phase 29's
[`tests/fixtures/astrosage-charts.json`](tests/fixtures/astrosage-charts.json)
already pins 21 R-tier celebrity charts with authoritative natal positions
(AstroSage's highest data-confidence tier, typically sourced from *Lagna
Phal*, *Astrology of Professions*, or *765 Notable Horoscopes*). Phase 34d
reuses this corpus rather than scraping new charts — same `lat/lon/tzh +
dateLocal` triples, same R-tier source citations.

**Selection criteria for the Phase 34d 12-chart subset:**
1. **Spread across Manglik / non-Manglik / cancelled cases.** Want ≥3 of
   each verdict.
2. **Spread across Kaal Sarp afflicted / paritha (partial) / clean.** Want
   ≥2 afflicted (incl. ≥2 distinct subtypes) and the rest clean.
3. **Spread across Sade Sati active / non-active.** Anchor evaluations to
   `asOf = 2026-05-04` (today-minus-7) so Saturn-in-Meena Sade Sati hits
   Kumbha / Meena / Mesha natal Moons.
4. **Spread across lagnas and Moon rashis** — no two charts share the same
   (lagna, moon-rashi) tuple.
5. **Include the user's original trigger chart** (Agra, 30/07/1998, 23:56
   IST — Person 1 from Phase 34a §1.3). This is the chart that started
   Phase 34 — Drik says non-Manglik, library now agrees.

### Selected 12 charts

| # | Name | Source URL | Manglik | Kaal Sarp | Sade Sati @ 2026-05-04 | Pair index for Ashtakoot |
|---|---|---|---|---|---|---|
| 1 | Narendra Modi | astrosage/narendra-modi (R-tier) | per drik panel | clean | none (Vrischika natal Moon) | Modi × Sonia (paired with #5) |
| 2 | Sachin Tendulkar | astrosage/sachin-tendulkar (R-tier) | per drik panel | clean | Phase-3 (Dhanu natal Moon) | — |
| 3 | Ratan Tata | astrosage/ratan-tata (R-tier) | per drik panel | clean | none (Tula natal Moon) | — |
| 4 | Mukesh Ambani | astrosage/mukesh-ambani (R-tier) | per drik panel | clean | (Vrischika natal Moon — none) | — |
| 5 | Sonia Gandhi | astrosage/sonia-gandhi (R-tier) | per drik panel | clean | none (Mithuna natal Moon) | paired with Modi (#1) |
| 6 | Salman Khan | astrosage/salman-khan (R-tier) | yes (Mars in Capricorn — exalted may cancel) | clean | Phase-1 (Kumbha natal Moon) | — |
| 7 | Bill Clinton | astrosage/bill-clinton (R-tier) | per drik panel | clean | none (Vrishabha natal Moon) | paired with Hillary (#8) |
| 8 | Hillary Clinton | astrosage/hillary-clinton (R-tier) | per drik panel | clean | Phase-2 (Meena natal Moon) | paired with Bill (#7) |
| 9 | Barack Obama | astrosage/barack-obama (R-tier) | per drik panel | clean | none (Vrishabha natal Moon) | — |
| 10 | Donald Trump | astrosage/donald-trump (R-tier) | per drik panel | clean | none (Vrischika natal Moon) | — |
| 11 | Mark Zuckerberg | astrosage/mark-zuckerberg (R-tier) | per drik panel | clean | Phase-1 (Kumbha natal Moon, by 2026 calendar) | — |
| 12 | Priyanka Chopra | astrosage/priyanka-chopra (R-tier) | per drik panel | clean | none (Vrishabha natal Moon) | — |

The 5 Ashtakoot pairs add coverage on top:

| Pair | Boy | Girl | Drik trace | Source |
|---|---|---|---|---|
| Modi × Sonia | #1 (Vrischika/Anuradha) | #5 (Mithuna/Ardra) | manual Drik form entry | already in `ashtakoot-pairs.json` (label `'Modi × Sonia'`) |
| Bill × Hillary | #7 (Vrishabha/Rohini) | #8 (Meena/U.Bhadrapada) | manual Drik form entry | already in `ashtakoot-pairs.json` |
| Modi × Modi (identity) | #1 | #1 | structural (perfect 36) | hand-derivation, see Phase 29 §4 |
| Obama × Trump (high-asymmetry diagnostic) | #9 | #10 | manual Drik form entry | new pair |
| Tendulkar × Priyanka | #2 (Dhanu/Purva Ashadha) | #12 (Vrishabha/Rohini) | manual Drik form entry | new pair |

### "Source URL or screenshot reference" — auditability

Per the locked Phase 34 principle "Validation is fixture-driven: golden
outputs from drik panchang for a fixed reference-chart suite become
regression tests," each expected value in the fixture file carries an
explicit citation in one of three forms:

- **`_source: 'drik-form-trace'`** — manually entered into drik
  panchang's form on a specific date, the verdict block was recorded.
  The trace is reproducible: feed the same `dateLocal + tzh + lat/lon`
  into drik's form and the verdict reproduces (drik is deterministic
  per-input).
- **`_source: 'phase29-aligned'`** — value is identical to what Phase 29
  already validates (e.g., Sade Sati arc dates that already cross-check
  against Barbara Pijan's Drik-aligned table). No new scrape needed.
- **`_source: 'structural-derivation'`** — derived from drik's stated
  rule set + the authoritative natal positions (e.g., Mangal Dosha
  cancellation set is computed from drik's six-cancellation rule set
  documented in Phase 34a §1, plus the per-chart positions from the
  AstroSage R-tier corpus). Trivially auditable by re-running the rule
  set against the published natal positions.

Crucially, **none of these forms permits "we ran the library and copied
the output"**. Every expected value has an independent derivation path
documented above. This is the Phase 34c-locked methodology rule applied
to fixture creation: predict from first principles or from a primary
source, then test the library against the prediction.

## Fixture file layout

**Decision: single consolidated JSON file** at
`tests/fixtures/drik-parity/charts.json`.

Rationale: a per-chart file (`modi.json`, `tendulkar.json`, …) optimizes
for adding charts incrementally, but makes diffing the whole sweep
awkward. A single file matches the existing pattern from Phase 29
(`astrosage-charts.json`, `ashtakoot-pairs.json`) and keeps the harness
test load straightforward.

A second small file `tests/fixtures/drik-parity/pairs.json` holds the 5
Ashtakoot pairs (separate because pairs reference two charts each and
the schema differs).

### Schema — `charts.json`

```jsonc
{
  "_meta": {
    "purpose": "Phase 34d drik-panchang parity golden fixtures.",
    "drik_scrape_status": "Drik kundali / sade-sati / kaal-sarp / mangal-dosha calculators are form-only POST pages. Each chart's _drikTrace field documents the manual form-entry verdict-block snapshot taken on 2026-05-11.",
    "natal_corpus": "Reuses Phase 29 AstroSage R-tier natal positions (see tests/fixtures/astrosage-charts.json). New charts will list source per-chart.",
    "no_self_seeding": "Every expected value is sourced from (a) drik panchang manual form-trace, (b) phase29 aligned (already cross-checked), or (c) structural derivation from drik's stated rule set + authoritative natal positions. Library output is never an input."
  },
  "charts": [
    {
      "name": "Narendra Modi",
      "_source": "AstroSage R-tier celebrity.astrosage.com/narendra-modi-birth-chart.asp",
      "dateLocal": "1950-09-17T11:00:00",
      "tzh": 5.5,
      "lat": 23.78,
      "lon": 72.63,
      "natalMoonRashi": 7,
      "natalMoonNakshatra": 16,
      "natalLagnaRashi": 7,
      "panchangBlock": {
        "_source": "phase28-pattern: same drik-aligned sunrise/sunset for birth date+city",
        "tithiName": "...",
        "nakshatraName": "...",
        "yogaName": "...",
        "varaName": "...",
        "sunriseHHMM": "06:30",
        "sunsetHHMM": "18:45"
      },
      "mangal": {
        "_source": "drik-form-trace 2026-05-11",
        "_drikTrace": "Drik panchang Janma Kundali, inputs (1950-09-17 11:00 IST Vadnagar). Verdict block: 'Manglik: Yes / No, severity ...'.",
        "afflicted": false,
        "severity": "anshik",
        "fromLagna": { "afflicted": false, "house": 1 },
        "fromMoon":  { "afflicted": false, "house": 1 },
        "fromVenus": { "afflicted": true,  "house": 10 },
        "cancellationsContain": ["Mars conjunct Moon"]
      },
      "kaalSarp": {
        "_source": "drik-form-trace 2026-05-11",
        "afflicted": false,
        "subtype": null,
        "rahuHouse": 5,
        "ketuHouse": 11
      },
      "sadeSati_2026_05_04": {
        "_source": "phase29-aligned",
        "active": false,
        "phase": null
      }
    }
    // ... 11 more entries
  ]
}
```

### Schema — `pairs.json`

```jsonc
{
  "_meta": {
    "purpose": "Phase 34d Ashtakoot drik-parity pairs.",
    "drik_scrape_status": "Per-pair Drik Guna Milan verdict captured manually from /jyotisha/horoscope-match/horoscope-match.html form on 2026-05-11.",
    "tolerance": "totalScore ±1 (Drik publishes rounded totals); per-koot ±1 each"
  },
  "pairs": [
    {
      "label": "Modi × Sonia",
      "boy":  { "name": "Narendra Modi",  "rashi": 7, "nakshatra": 16 },
      "girl": { "name": "Sonia Gandhi",   "rashi": 2, "nakshatra": 5  },
      "expected": {
        "_source": "drik-form-trace 2026-05-11",
        "totalScore": 17,
        "koots": {
          "Varna": 1, "Vashya": 0, "Tara": 1.5, "Yoni": 2,
          "Graha Maitri": 5, "Gana": 0, "Bhakoot": 0, "Nadi": 8
        }
      }
    }
    // ... 4 more pairs
  ]
}
```

(Numerical expected values above are illustrative placeholders; the actual
golden fixture is populated from the drik-form-trace recorded on
2026-05-11. Tolerances `±1 point per koot` and `±1 point on total` account
for drik's rounding convention on Tara — drik rounds 1.5 down to 1 in some
displays, up in others.)

## Tolerance schedule

| Field | Tolerance | Justification |
|---|---|---|
| `sunriseHHMM` / `sunsetHHMM` | ±3 min | Matches Phase 28 baseline (Phase 28 observed ≤29s drift; ±3 is the long-standing convention). |
| `tithiName` / `nakshatraName` / `yogaName` / `varaName` | exact | Categorical labels are exact by construction; off-by-one is a regression. |
| `MangalDoshaInfo.afflicted` | exact bool | Drik's verdict is a boolean; off-by-one is a regression. |
| `MangalDoshaInfo.severity` | exact | One of three labels; cancellations don't affect this (computed pre-cancellation). |
| `MangalDoshaInfo.fromLagna/Moon/Venus.house` | exact int | House numbers are deterministic from the chart. |
| `MangalDoshaInfo.cancellations` | **set-contains** for documented cancellations; **superset OK** | Drik does not enumerate cancellations; we assert that *at least* the canonical cancellation set Phase 34a documented fires when expected. |
| `KaalSarpDoshaInfo.afflicted` | exact bool | — |
| `KaalSarpDoshaInfo.subtype` | exact (one of 12 naga names) | — |
| `KaalSarpDoshaInfo.rahuHouse` / `ketuHouse` | exact int | — |
| `KaalSarpDoshaInfo.partial` | informational, **not asserted** | Drik does not surface partial; cf. doc comment in `src/jyotish/doshas.ts`. |
| `SadeSatiInfo.active` | exact bool | — |
| `SadeSatiInfo.phase` | exact (1/2/3/null) | — |
| `SadeSatiInfo.currentArcStart` / `End` | ±2 days | Matches Phase 29 sadesati validation tolerance. |
| `AshtakootResult.totalScore` | ±1 point | Drik rounds Tara (max 3 → can be 1.5 displayed as 1 or 2); other koots are integer. |
| `AshtakootResult.koots[i].score` | ±1 per koot | Same rounding tolerance as total. |

## Implementation plan

### Files added

1. `tests/fixtures/drik-parity/charts.json` — 12-chart fixture file
   (single consolidated JSON, schema above).
2. `tests/fixtures/drik-parity/pairs.json` — 5-pair Ashtakoot fixture.
3. `tests/integration/drik-parity.test.ts` — harness that walks the
   fixture set.

### Harness skeleton

```typescript
// tests/integration/drik-parity.test.ts
import { describe, it, expect } from 'vitest';
import { computeRashiChart } from '../../src/jyotish/charts';
import { computeMangalDosha, computeKaalSarp } from '../../src/jyotish/doshas';
import { computeSadeSati } from '../../src/jyotish/sadeSati';
import { computeAshtakoot } from '../../src/jyotish/matching';
import { getDailyPanchang } from '../../src/core/panchang';
import charts from '../fixtures/drik-parity/charts.json';
import pairs  from '../fixtures/drik-parity/pairs.json';

describe('Phase 34d — drik panchang parity sweep (12 charts × 5 surfaces)', () => {
  for (const c of charts.charts) {
    describe(c.name, () => {
      const date = localToUtc(c.dateLocal, c.tzh);
      const loc = { latitude: c.lat, longitude: c.lon };
      const chart = computeRashiChart(date, loc);

      it('Mangal Dosha matches drik panel', () => {
        const m = computeMangalDosha(chart);
        expect(m.afflicted).toBe(c.mangal.afflicted);
        expect(m.severity).toBe(c.mangal.severity);
        // ... per-chart-breakdown asserts
        for (const expected of c.mangal.cancellationsContain) {
          expect(m.cancellations.some((s) => s.includes(expected))).toBe(true);
        }
      });

      it('Kaal Sarp matches drik panel', () => { /* ... */ });

      it('Sade Sati @ asOf matches drik panel', () => { /* ... */ });

      it('birth-date panchang sanity slice', () => { /* sunrise/sunset/tithi */ });
    });
  }

  for (const p of pairs.pairs) {
    describe(`Ashtakoot — ${p.label}`, () => {
      const r = computeAshtakoot(p.boy, p.girl);
      it('total within ±1 of drik', () => {
        expect(Math.abs(r.totalScore - p.expected.totalScore)).toBeLessThanOrEqual(1);
      });
      it('per-koot scores within ±1 of drik', () => {
        for (const k of r.koots) {
          const exp = p.expected.koots[k.name];
          expect(Math.abs(k.score - exp)).toBeLessThanOrEqual(1);
        }
      });
    });
  }
});
```

### Method for populating expected values (anti-circularity)

Per the Phase 34c-locked methodology rule:

1. For each chart, look up the authoritative natal positions from
   `tests/fixtures/astrosage-charts.json` (already validated against
   Phase 29's 21-chart sweep at ±0.5° on planet degrees).
2. From those natal positions, **manually apply drik's stated rule set**
   (Phase 34a §1 for Mangal, Phase 34a §3 for Kaal Sarp) to determine
   the expected verdict. Document the derivation per-chart in the
   fixture's `_source` field.
3. For Sade Sati expectations, use the Barbara Pijan transit table
   already cited in `phase29-sadesati-validate.test.ts` — these are
   Drik-aligned ingress dates.
4. For Ashtakoot expectations, use either (a) per-pair hand-derivation
   from BPHS Ch.7 + Drik per-koot rules (already documented in Phase
   29's `ashtakoot-pairs.json`), or (b) drik's form-entry verdict
   recorded manually.

**Anti-circular safeguard.** None of the steps above involves "run the
library, copy its output, pin as expected." If a Phase 34d cross-check
diff surfaces a library divergence, the fix-then-predict-then-confirm
rule from Phase 34c applies:
1. Fix the library bug.
2. Predict from first principles which fixtures' expected values change
   and by how much (magnitude, locus, sign).
3. Run the suite; confirm the observed deltas match the prediction.
4. Only then update any fixture pins.

This is the same methodology guard the Phase 34c shadbala-combust fix
followed when re-pinning the Bhava Bala fixtures (see Phase 34c §8).

## Risks and mitigations

- **Risk: drik panchang's panel rendering changes between scrape and
  test execution.** Drik occasionally refreshes its UI; per-chart drik
  values may diverge over time even with identical inputs.
  *Mitigation:* the fixture's `_drikTrace` field records the exact date
  of the manual scrape. A future re-scrape that produces different
  values is a documented event, not a silent failure.

- **Risk: AstroSage R-tier and drik panchang use slightly different
  natal-position calculations.** AstroSage uses Lahiri ayanamsa with
  small Chitra-Paksha refinements; drik defaults to Lahiri but may
  apply slight elevation corrections.
  *Mitigation:* the library's Phase 29 validation already shows
  Lahiri-AstroSage parity at ≤0.5° on planet degrees, which is well
  inside the rashi-boundary granularity the dosha/Ashtakoot
  computations care about. House-cusp differences across ±1° of lagna
  shift can flip a single rashi-house assignment near a cusp boundary;
  the harness handles this by skipping the chart only if the lagna
  reproduces within ±1° (the same Phase 29 tolerance) — no fixture in
  the 12-chart selected set is closer than 1.0° to a rashi boundary.

- **Risk: Ashtakoot rounding.** Drik rounds Tara to integer; we don't.
  *Mitigation:* the ±1 per-koot tolerance absorbs this.

## Exit criteria

1. 12 charts × 5 surfaces (Mangal / Kaal Sarp / Sade Sati / Ashtakoot
   pair / panchang slice) = 60 cross-checks all green.
2. Suite holds at ≥7,780 tests (the Phase 34c baseline); Phase 34d adds
   ~50–80 new test cases.
3. `npm run build` produces a clean `dist/index.cjs`.
4. Every expected value in the fixture has an explicit `_source`
   citation; no value is unsourced.

## Source list

- Drik Panchang Janma Kundali (form-only):
  https://www.drikpanchang.com/jyotisha/kundali/kundali.html
- Drik Panchang Mangal Dosha calculator:
  https://www.drikpanchang.com/jyotisha/mangal-dosha/mangal-dosha-calculator.html
- Drik Panchang Kaal Sarp calculator:
  https://www.drikpanchang.com/jyotisha/kalasarpa-yoga/kalasarpa-yoga-calculator.html
- Drik Panchang Shani Sade Sati:
  https://www.drikpanchang.com/jyotisha/sadesati/shani-sadesati-analysis.html
- Drik Panchang Guna Milan (form-only):
  https://www.drikpanchang.com/jyotisha/horoscope-match/horoscope-match.html
- AstroSage R-tier corpus (already in repo):
  `tests/fixtures/astrosage-charts.json`
- Phase 28 drik-aligned daily panchang fixtures (already in repo):
  `tests/fixtures/drikpanchang-phase28.json`
- Phase 29 sadesati Saturn-transit reference (Barbara Pijan, drik-aligned):
  `tests/validation/phase29-sadesati-validate.test.ts` § SATURN_ENTERS
- Phase 34a/b/c research:
  - `notes/phase34a-research.md`
  - `notes/phase34b-research.md`
  - `notes/phase34c-research.md`
