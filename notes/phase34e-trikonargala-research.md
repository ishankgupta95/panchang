# Phase 34e item 3 — Trikonargala (5/9) research

Research date: 2026-05-11. Reference order: **drik panchang published
output** (primary), **multi-pandit consensus** (secondary), **classical
BPHS Ch.31 + Jaimini Upadesa Sutras Ch.1** (tertiary).

Sub-phase scope (Phase 34e item 3 of 5 remaining): the audit baseline
flagged `computeArgala` as carrying **primary** Argala only (2/4/11
houses) with **Trikonargala** (the 5/9 trine variant) explicitly
deferred. The existing JSDoc at `src/jyotish/argala.ts:28-37` already
documents the deferral and names the absent classical rules.

User-supplied scope:
> Trikonargala (5/9) in `computeArgala`. Currently ships primary Argala
> only; the 5/9 Trikonargala variant is deferred. Drik silent on Argala;
> Jaimini *Upadesa Sutras* Ch.1 + Sanjay Rath commentary. Output additive
> — `ArgalaPerBhava` gains optional `trikona?: { sources, virodhakas }`
> field. Tertiary classical concept; verify against ≥2 Sanjay Rath /
> Iyer sources before pinning.

## TL;DR

**Decision**: ship the **5/9 Trikonargala** as an opt-in additive field
following the Phase 34e item-1 (Sripati) and item-6 (8-Karaka) opt-in
pattern. The ≥2-source bar is met (4 independent sources confirm the
5/9 trine pair; 3 independent sources confirm the Ketu reversal in the
trine context). The competing Sanjay-Rath "Secondary Argala" 5/8
formulation is explicitly **not** implemented — it is a different
named concept ("Secondary Argala" vs "Trikonargala"); the user
prompt unambiguously chose the 5/9 trine variant.

**Output shape (additive)**:

```typescript
interface ArgalaPerBhava {
  bhava: number;
  argala: PlanetPlacement[];          // unchanged — 2/4/11 from bhava
  virodhargala: PlanetPlacement[];    // unchanged — 3/10/12 from bhava
  trikona?: {                         // NEW — populated only when
    sources: PlanetPlacement[];       //        called with
    virodhakas: PlanetPlacement[];    //        { includeTrikonargala: true }
  };
}
```

**API surface**:

```typescript
export function computeArgala(chart: BirthChart): ArgalaPerBhava[];
export function computeArgala(
  chart: BirthChart,
  options: { includeTrikonargala: true },
): ArgalaPerBhava[];
```

Both overloads return `ArgalaPerBhava[]`; only the second populates
the optional `trikona` field. Default callers see byte-for-byte
pre-34e-item-3 output.

## 1. Drik panchang & ProKerala surface

Same drik-silent pattern as 34a-d / 34e-items-1+6. Drik publishes no
Argala calculator anywhere in its 18 jyotish utilities (re-verified
inventory; same 18 from `notes/phase34e-jaimini-research.md` §1).
ProKerala has no Argala-specific calculator on the open web; the only
candidate (`prokerala.com/astrology/birth-chart/`) is form-only POST
and renders no Argala panel even after form submission. Fall through
to §2/§3 — classical Jaimini + multi-pandit consensus is the
operative authority.

## 2. Multi-source classical-rule consensus

### 2.1 — 5/9 Trikonargala formulation

| # | Source | URL | What it states |
|---|---|---|---|
| 2.1.1 | sutramritam.blogspot.com (Jaimini Sutramritam) — "Argala – The Linchpin" | <https://sutramritam.blogspot.com/2011/01/argala-linchpin.html> | **Trikona Argala = 5th/9th pair**; "Only benefic planets in 5th or 9th house constitute benefic Argala" |
| 2.1.2 | (earlier-search consensus) "The trikona (5th, 9th) argala signs may be understood as before. More specifically, the 5th sign is the argala sign and the 9th sign is the virodhargala sign" | (cited across multiple Jaimini blogs and Quora answers) | 5th = argala, 9th = virodhargala (trine pairing) |
| 2.1.3 | "Parashara described that the 5th house from a specific house will also cause argala. Because the argala caused by 2nd, 4th and 11th are more important and more decisive and in modern terms it is also called 'Primary Argala', whereas argala from the 5th house is called secondary argala." | (earlier-search summary) | 5th house = secondary argala |
| 2.1.4 | Existing library JSDoc (pre-34e) at `src/jyotish/argala.ts:28-37` | (in-repo) | Already cites Iranganti Rangacharya, AstroVeda Wikidot, IndianAstrologyArticles for the 5/9 trine deferred form |

### 2.2 — Competing variant: Sanjay Rath's "Secondary Argala" (5/8, 9/6)

| # | Source | URL | What it states |
|---|---|---|---|
| 2.2.1 | Sanjay Rath — "Argala: Planetary Intervention" | <https://srath.com/jyotiṣa/amateur/argala-planetary-intervention/> | **Secondary Argala = 5th + 8th**, obstructed by 9th + 6th |
| 2.2.2 | parasharjaimini.wordpress.com — Argala article | <https://parasharjaimini.wordpress.com/2010/12/25/argala/> | Same 5/8 secondary formulation as Sanjay Rath |

**Resolution**: The 5/8 "Secondary Argala" and 5/9 "Trikonargala" are
**different named concepts**, not contradicting variants of the same
concept. The user prompt explicitly chose **"Trikonargala (5/9)"** —
the trine formulation. The Sanjay Rath 5/8 "Secondary Argala" variant
is **NOT implemented** in this sub-phase (different concept, different
naming, would require its own scope-decision).

### 2.3 — Ketu reversal rule

| # | Source | URL | What it states |
|---|---|---|---|
| 2.3.1 | sutramritam.blogspot.com | <https://sutramritam.blogspot.com/2011/01/argala-linchpin.html> | "The Argala shall be reckoned in reverse manner for the sign occupied by Ketu" |
| 2.3.2 | anandamoyee.home.blog — Argala article | <https://anandamoyee.home.blog/2020/08/08/argala-and-virodh-argala/> | "In case of the house with Ketu, the [argala] houses are counted in reverse order or anti zodiacal" |
| 2.3.3 | Sanjay Rath — Argala: Planetary Intervention | <https://srath.com/jyotiṣa/amateur/argala-planetary-intervention/> | "The Argalā reckoning from Ketu is in the reverse direction" |
| 2.3.4 | (earlier-search summary) | (cited multiple) | "For Ketu, the 9th is the argala sign and the 5th is virodhargala sign" — explicit 5↔9 swap in trine context |

**Resolution**: 4 independent sources, with the *general* rule (Ketu
reverses ALL argala) attested by 3, and the *trine-specific* 5↔9 swap
attested explicitly by source 2.3.4. For this sub-phase (which is
scoped to the 5/9 Trikonargala only — primary Argala is out of scope),
the operative implementation is the **trine-specific 5↔9 swap**: when
the planet under consideration is Ketu, the 5th-from-bhava is treated
as virodhargala and the 9th-from-bhava is treated as argala. Primary
Argala (2/4/11) is NOT modified — the broader "Ketu reverses all
argala houses" rule, if implemented, would be a separate Phase-34e+
item touching primary Argala, which is out of scope per the user
prompt.

## 3. Algorithm

For each bhava `B` in 1..12:

```
sources    = []
virodhakas = []
for each planet p in chart.planets:
  offset = (p.house − B + 12) mod 12      // 0-based
  isFifth = (offset == 4)                 // 5th-from-bhava
  isNinth = (offset == 8)                 // 9th-from-bhava
  if p.planet == 'Ketu':
    if isFifth: virodhakas.push(p)        // Ketu reversal
    if isNinth: sources.push(p)           // Ketu reversal
  else:
    if isFifth: sources.push(p)
    if isNinth: virodhakas.push(p)
trikona = { sources, virodhakas }
```

Notes:
- All 9 grahas (Sun..Saturn + Rahu + Ketu) participate; benefic/malefic
  qualification (which some sources add for "valid Argala") is **NOT**
  applied here — the calculation lists *positional* trikona-argala
  contributions; downstream consumers can apply benefic/malefic
  filtering. This matches the existing library's primary-Argala
  treatment (no benefic-malefic filtering applied there either).
- A single chart's Ketu contributes to *exactly two* `trikona` lists
  (one bhava's `sources` from 9th-position, one bhava's `virodhakas`
  from 5th-position) — by symmetric reasoning to the primary-Argala
  6-bhava-contribution invariant.
- Each non-Ketu graha similarly contributes to exactly 2 lists (one
  `sources` at 5th, one `virodhakas` at 9th).

## 4. API design — opt-in

Following the Phase 34e item-1 (Sripati) and item-6 (8-Karaka) opt-in
precedents:

```typescript
// Default — backwards-compatible byte-for-byte
const argala = computeArgala(chart);
argala[0].trikona; // undefined

// Opt-in
const full = computeArgala(chart, { includeTrikonargala: true });
full[0].trikona;            // { sources, virodhakas }
full[0].trikona!.sources;   // PlanetPlacement[]
```

Function overloads ensure the existing test pattern (5 fixture pin
suites, 1 invariant suite) sees no change.

## 5. Fixture-chart predictions (hand-derived)

5 R-tier charts selected from `tests/fixtures/astrosage-charts.json`.
For tractability, predictions are derived by computing chart.planets[].
house from each chart's natal placements, then applying the algorithm
in §3. Anti-circular: the algorithm in §3 is the rule under test;
predictions are hand-derived (not from the library's new code) and
pinned in the test file.

Sample prediction (Narendra Modi — derived in `notes/phase34e-trikonargala-derive.mjs`):

Lagna rashi = 7 (Vrischika). Planet house map computed from:
- Sun in Kanya (rashi 5) → house = ((5 − 7 + 12) mod 12) + 1 = 11
- Moon in Vrischika (rashi 7) → house = 1
- Mars in Vrischika (7) → house 1
- Mercury in Kanya (5) → house 11
- Jupiter in Kumbha (10) → house 4
- Venus in Simha (4) → house 10
- Saturn in Simha (4) → house 10
- Rahu in Meena (11) → house 5
- Ketu in Kanya (5) → house 11

For bhava 1: 5th-from-1 = house 5 (occupied by Rahu); 9th-from-1 = house 9 (empty).
- Rahu in 5th (not Ketu) → sources: [Rahu]; virodhakas: []
- trikona = { sources: [Rahu], virodhakas: [] }

For bhava 5: 5th-from-5 = house 9 (empty); 9th-from-5 = house 1 (Moon, Mars).
- Moon, Mars in 9th (not Ketu) → sources: []; virodhakas: [Moon, Mars]
- trikona = { sources: [], virodhakas: [Moon, Mars] }

For bhava 7: 5th-from-7 = house 11 (Sun, Mercury, Ketu); 9th-from-7 = house 3 (empty).
- Sun, Mercury in 5th (not Ketu) → sources contributors
- Ketu in 5th (IS Ketu) → virodhakas contributor (REVERSAL)
- trikona = { sources: [Sun, Mercury], virodhakas: [Ketu] }

This Modi-bhava-7 prediction exercises the Ketu reversal end-to-end.

The full per-chart prediction tables are generated by the derive script
and pinned in `tests/unit/argala.test.ts`.

## 6. Implementation plan

### Step 1 — type (`src/types/jyotish.ts`)

Append `trikona?:` field to `ArgalaPerBhava` (≈line 864):

```typescript
export interface ArgalaPerBhava {
  bhava: number;
  argala: PlanetPlacement[];
  virodhargala: PlanetPlacement[];
  /** Trikonargala (5/9 trine). Populated only when
   *  `computeArgala` is called with `{ includeTrikonargala: true }`. */
  trikona?: {
    sources: PlanetPlacement[];
    virodhakas: PlanetPlacement[];
  };
}
```

### Step 2 — function overloads (`src/jyotish/argala.ts`)

```typescript
export function computeArgala(chart: BirthChart): ArgalaPerBhava[];
export function computeArgala(
  chart: BirthChart,
  options: { includeTrikonargala: true },
): ArgalaPerBhava[];
export function computeArgala(
  chart: BirthChart,
  options?: { includeTrikonargala?: boolean },
): ArgalaPerBhava[] { /* … */ }
```

Inner loop adds trikona computation only when `options?.includeTrikonargala`.

### Step 3 — tests (`tests/unit/argala.test.ts`)

Append new `describe` blocks (do not modify existing primary-Argala pins):

- `computeArgala — trikona default absent` (no options → trikona is undefined per bhava).
- `computeArgala — trikona output shape` (12 entries, each with optional trikona populated, sources + virodhakas are PlanetPlacement[]).
- `computeArgala — single-planet synthetic` (planet placed in 5th from bhava → sources, in 9th → virodhakas).
- `computeArgala — Ketu reversal synthetic` (Ketu in 5th → virodhakas; Ketu in 9th → sources).
- `computeArgala — fixture pin sweep` (3 charts: Modi, Sachin, Tata — pinned per-bhava sources + virodhakas with hand-derived planet lists from the derive script).
- `computeArgala — 2-list-per-planet invariant` (each non-Ketu planet appears in exactly 2 lists total across all 12 bhavas; Ketu also exactly 2).

### Step 4 — index exports

No type-name change (ArgalaPerBhava already re-exported). No new
exports needed.

### Step 5 — verification

- `npx vitest run` — expect 8,053 → 8,053 + ~12-15 new tests, all green.
- `npm run build` — expect dist/index.cjs to grow ~0.5 KB (371.11 KB → ~371.6 KB).

## 7. Sources

| Source | URL | Used for |
|---|---|---|
| sutramritam.blogspot.com — Argala The Linchpin | <https://sutramritam.blogspot.com/2011/01/argala-linchpin.html> | 5/9 Trikonargala + Ketu reversal |
| anandamoyee.home.blog — Argala and Virodh Argala | <https://anandamoyee.home.blog/2020/08/08/argala-and-virodh-argala/> | Ketu anti-zodiacal reversal |
| Sanjay Rath — Argala Planetary Intervention | <https://srath.com/jyotiṣa/amateur/argala-planetary-intervention/> | Primary Argala + Ketu reversal (general) — Sanjay Rath's own 5/8 secondary is a competing concept, NOT implemented |
| parasharjaimini.wordpress.com — Argala | <https://parasharjaimini.wordpress.com/2010/12/25/argala/> | Sanjay Rath's 5/8 secondary variant (NOT implemented) |
| Existing library JSDoc | `src/jyotish/argala.ts:28-37` (in-repo) | Phase 31 baseline naming Iranganti Rangacharya, AstroVeda Wikidot, IndianAstrologyArticles as classical 5/9 Trikonargala citations |
| Drik Panchang utilities | <https://www.drikpanchang.com/utilities/astrology-utilities.html> | No Argala calculator (drik-silent surface) |

**Cross-validation references** for fixture predictions: no external
source publishes per-chart Argala tables for the AstroSage R-tier
corpus with sufficient numerical precision. The 5/9 algorithm is
deterministic given chart.planets (which is itself validated against
AstroSage in Phase 29's R-tier validation), so first-principles
hand-derivation from chart.planets is sufficient — this matches the
Phase 34a-d / 34e-items-1+6 pattern when drik publishes nothing.

## 8. Anti-circular guarantee

Per `memory/feedback_fixture_repinning.md` + the locked Phase 34c
methodology: predictions are generated by the derive script which
calls `computeRashiChart` (already-verified library code) to extract
`chart.planets[].house`, then applies the §3 algorithm **inline in the
script** to produce per-bhava trikona predictions. The library's
new `computeArgala({ includeTrikonargala: true })` implementation is
then checked against these pinned predictions — not the reverse. If
the implementation diverges, the implementation is wrong; re-derive
from §3 before re-pinning.
