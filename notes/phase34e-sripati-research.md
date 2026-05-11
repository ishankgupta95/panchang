# Phase 34e item 1 — Sripati cusp 2–12 midpoints research

Research date: 2026-05-11. Reference order: **drik panchang published
output** (primary), **ProKerala / pandit-consensus** (secondary),
**classical BPHS Ch.5 + Sripati Paddhati** (tertiary).

Sub-phase scope (Phase 34e item 1 of 5 remaining): extend
`computeSripatiLagna` so that, when an opt-in option is passed, it
returns the 12 bhava-madhya cusps of the *Sripati Paddhati* house
system in addition to cusp 1 (the natal lagna). Today
`computeSripatiLagna` returns natal lagna only; the cusps 2–12
trisection formula from BPHS Ch.5 / Sripati Paddhati is undocumented in
code and absent from the output. The current JSDoc explicitly flags
this as a documented limitation.

## TL;DR — the surprising finding

**Same fallback pattern as Phase 34a-d.** Drik panchang publishes
nothing on Sripati cusps (verified: full enumeration of all 18
calculators on `drikpanchang.com/utilities/astrology-utilities.html`
turns up zero Bhava/Sripati/Chalit surface — the same inventory
captured in the Phase 34e item-6 research, with no additions). Their
Janma Kundali generator is the same form-only POST page documented in
Phase 34d §1 and re-confirmed here; even if a user fills the form, the
rendered output panels (D1/D9/D2/.../D60 diagrams + Dasha + Bhava
*table* + Mangal/Kalasarpa banners) **do not include a Sripati
bhava-madhya cusp column** — only a sign-based bhava chart diagram.

ProKerala has **no GET-style Sripati endpoint**: the only
chart-rendering page (`/astrology/birth-chart/`) is form-only POST per
the Phase 34d pattern, and `/astrology/bhava-chart.php` returns
HTTP 404 (no public URL on that path). The most-prominent
chalit/sripati-chart references on the open web are blogs and
software-help pages (instaastro.com, planetarypositions.com,
jothishi.com, astrogyan.com, astrologyofbharat.org,
psychologicallyastrology.com, exoticindiaart.com book listing,
nikhilworld.com, indiadivine forum, jyotishbootcamp substack); none
expose a queryable table for our fixture charts.

**Fall-through to classical formula.** The Sripati formula itself is
unanimous across every source surveyed (5+ independent secondary
sources — see §2). Unlike the Bhakoot-cancellation question from
Phase 34b (where multi-pandit consensus disagreed and we had to gate
behind opt-in), the Sripati Paddhati trisection formula is one of the
**least-contested** Vedic computations: every source (Wikipedia,
Jothishi, planetarypositions, prosperitynjoy, nikhilworld, astrogyan,
astrologyofbharat, jyotishbootcamp, astrologershukla, BPHS Ch.5 itself)
gives identical trisection arithmetic. Operative authority is therefore
**BPHS Ch.5 + Sripati Paddhati (12th-c.)** with multi-source modern
cross-confirmation; opt-in gating is **not** required for correctness
but **is** required for backwards-compat (existing callers expect the
cusp-1 LagnaInfo shape with no `cusps` field).

**Conclusion for code changes (pre-implementation):**

- **Add an opt-in `includeCusps` option** to `computeSripatiLagna` via
  function overloads. New optional `options` argument accepts
  `{ includeCusps: true }`; default behaviour (no options arg, or
  `{ includeCusps: false }`) returns the existing `LagnaInfo` byte-for-
  byte. This mirrors the Phase 34e item-6 (8-Karaka) and Phase 34b
  (NatalMoon.lagnaRashi / navamsaRashi) opt-in patterns exactly.
- **Add `SripatiLagnaInfo`** = `LagnaInfo & { cusps: number[] }` as
  a new type, where `cusps[0..11]` are the 12 bhava-madhya sidereal
  longitudes in `[0, 360)` for bhavas 1..12 respectively (i.e.,
  `cusps[0]` equals `siderealLongitude` by construction). Existing
  `LagnaInfo` is unchanged → no breaking change for any existing
  caller, especially the four `for (const fn of [computeHoraLagna,
  computeGhatiLagna, computeBhavaLagna, computeSripatiLagna])` style
  loops in test files which would be ill-typed by a return shape change.
- **MC source**: re-use `computeBhava(..., { houseSystem: 'whole-sign' })`'s
  `mcLongitude` — the library already computes sidereal MC via Meeus'
  `λ_MC = atan2(sin θ, cos θ · cos ε)` formula and exposes it on
  every BhavaChart regardless of system. No new astronomy code needed.
- **Formula**: classical Sripati trisection (see §3). All 12 cusps
  derive arithmetically from ASC + MC; pure number-crunching, no
  iteration, no circumpolar edge cases (unlike Placidus). Works at
  every latitude.

Net code reach: 1 function overload + 1 new type + ~25 LOC pure-math
helper (~30 LOC total). Output shape is **purely additive**: existing
callers continue to receive `LagnaInfo`; new callers passing
`{ includeCusps: true }` receive `SripatiLagnaInfo`. Every pre-34e-item-1
test path sees identical behavior.

---

## 1. Drik panchang & ProKerala surface — empirical check

Method: re-verify the Phase 34e-jaimini-research §1 inventory of
`drikpanchang.com/utilities/astrology-utilities.html` (no calculators
have been added; same 18 listed); and check whether ProKerala has a
gettable Sripati / Bhava-chart endpoint.

| Source | Sripati / Bhava-cusp surface? |
|---|---|
| Drik Panchang (18 utilities) | **No** — same as 34e-jaimini §1. Their Janma Kundali form-output omits a bhava-madhya cusp table. |
| Drik Panchang Janma Kundali (form-only POST) | Renders a sign-based bhava-chart *diagram* (whole-sign grouping) but no cusp longitudes |
| ProKerala `/astrology/birth-chart/` | Form-only POST (per 34d empirical pattern); no GET parameters; output unverified |
| ProKerala `/astrology/bhava-chart.php` | HTTP 404 (no public URL) |
| AstroLinked native pages (`/native/{id}/charts/bhava/`) | Page exists but renders empty placeholders without authenticated session — not gettable |

Net: same surface absence as 34a §Pitru / 34c §yoga-bhanga / 34d
§Pitru-and-yoga / 34e-item-6 §Karakas. Fall through to §2 + §3.

---

## 2. Multi-source classical-formula consensus

Eight independent sources surveyed. The Sripati Paddhati trisection
formula is **unanimous** — no source contradicts the four-quadrant
trisection rule, and no source proposes a competing intermediate-cusp
algorithm under the "Sripati" / "Sripathi" / "Bhava Chalit
(Sripathi-mode)" name.

| # | Source | URL / citation | What it states |
|---|---|---|---|
| 2.1 | Wikipedia — *Bhāva* | https://en.wikipedia.org/wiki/Bh%C4%81va | Sripati is a Porphyry-style house system; quadrants trisected from ASC/IC/DSC/MC |
| 2.2 | planetarypositions.com | https://planetarypositions.com/kundali-software/2006/02/10/bhava-chart-chalit-chart/ | "trisect the distance between 1st house mid & 10th house mid" |
| 2.3 | Jothishi — *Bhava Chalit Chart* | https://jothishi.com/the-bhava-chalit-chart/ | Same trisection rule; bhava madhya = exact midpoint of each bhava |
| 2.4 | prosperitynjoy blog — *Bhava Calculation* | http://www.prosperitynjoy.com/2015/05/bhava-calculation-or-calculation-of.html | Trisection rule, with example arithmetic |
| 2.5 | nikhilworld.com — *CUSP or KP CHART (Placidus)* | https://nikhilworld.com/cusp-or-kp-chartplacidus-system/ | Contrasts Sripati trisection vs Placidus iteration |
| 2.6 | astrologershukla.blogspot.com — *Bhavas (Houses)* | http://astrologershukla.blogspot.com/2014/11/bhavas-houses.html | Same formula; cites Sripati Paddhati explicitly |
| 2.7 | jyotishbootcamp.substack.com — *Bhava Chalit Intro* | https://jyotishbootcamp.substack.com/p/w10-1-bhava-chalit-intro | Lalitha Anamika walkthrough; same formula |
| 2.8 | astrologyofbharat.org | https://www.astrologyofbharat.org/2017/08/chalit-versus-birth-chart-the-difference.html | Same formula; Chalit = Sripati in practice |

**Spelling note**: "Sripati", "Sripathi", "Shripati", "Shripathi",
"Śrīpati" — all variants of the same 12th-c. astronomer's name. Lock
the existing library spelling `Sripati` (no aliases exposed).

**Convention note**: every source treats the Sripati "cusp" as the
**bhava madhya** (mid-point of the bhava), with `cusp_1 = lagna`. The
*beginning* of a bhava (where it transitions from the previous bhava)
is called the *bhava sandhi* (sandhi means junction) and falls
halfway between adjacent bhava madhyas — but it is **not** what
sources call the "cusp" under Sripati convention. KP/Placidus-trained
astrologers may call the boundary the "cusp", but that is a
non-Sripati naming convention. The library uses the **bhava-madhya
convention** (cusp = madhya = midpoint), matching every Sripati-named
source surveyed and matching the existing `cusp_1 = lagna` invariant
the library already pins for the `'placidus-kp'` system in
`computeBhava`.

---

## 3. BPHS Ch.5 / Sripati Paddhati formula — derivation

**Setup.** Four angular cusps are the natal angles:

```
cusp_1  = ASC                  (eastern horizon, "Lagna")
cusp_10 = MC                   (upper meridian, "Madhya Lagna")
cusp_7  = (ASC + 180) mod 360  (western horizon, "Astha Lagna")
cusp_4  = (MC  + 180) mod 360  (lower meridian, "Patala Lagna")
```

All in sidereal ecliptic longitude. ASC computed via Meeus eq. 13.6
(library's `computeLagna` already does this); MC via
`λ_MC = atan2(sin θ, cos θ · cos ε)` (library's `computeMcTropical`
already does this) — both reduced to sidereal by subtracting the
configured ayanamsa.

**Four quadrant arcs** (each measured eastward in zodiacal order):

```
arc_q1 = (cusp_4  - cusp_1) mod 360    (ASC → IC arc)
arc_q2 = (cusp_7  - cusp_4) mod 360    (IC  → DSC arc)
arc_q3 = (cusp_10 - cusp_7) mod 360    (DSC → MC arc)
arc_q4 = (cusp_1+360 - cusp_10) mod 360 (MC  → ASC arc)
```

By construction `arc_q1 + arc_q2 + arc_q3 + arc_q4 = 360°`. **Also by
construction `arc_q3 = arc_q1` and `arc_q4 = arc_q2`** (because
cusp_4 = cusp_10 + 180, cusp_7 = cusp_1 + 180, and the +180 cancels
under mod 360 arithmetic). Therefore the 12 cusps split into 6
antipodal pairs differing by exactly 180°.

**Eight non-angular cusps** by quadrant trisection:

```
cusp_2  = (cusp_1  + arc_q1/3)     mod 360
cusp_3  = (cusp_1  + 2·arc_q1/3)   mod 360
cusp_5  = (cusp_4  + arc_q2/3)     mod 360
cusp_6  = (cusp_4  + 2·arc_q2/3)   mod 360
cusp_8  = (cusp_7  + arc_q3/3)     mod 360
cusp_9  = (cusp_7  + 2·arc_q3/3)   mod 360
cusp_11 = (cusp_10 + arc_q4/3)     mod 360
cusp_12 = (cusp_10 + 2·arc_q4/3)   mod 360
```

**Invariants the implementation must preserve** (each a structural test):

| Invariant | Formula |
|---|---|
| Cusp-1 equals lagna | `cusps[0] == LagnaInfo.siderealLongitude` (exact) |
| Cusp-7 = Cusp-1 + 180 | `(cusps[6] - cusps[0]) mod 360 ≈ 180` |
| Cusp-4 = Cusp-10 + 180 | `(cusps[3] - cusps[9]) mod 360 ≈ 180` |
| Cusp-2 = Cusp-8 + 180 (mod 360) | true for ALL antipodal pairs |
| Sum of quadrants = 360 | `arc_q1 + arc_q2 + arc_q3 + arc_q4 = 360` (within float ε) |
| Each cusp in `[0, 360)` | normalised before return |
| 12 cusps total | array length 12 |
| `cusps[0]` is the first quadrant boundary | `(cusps[3] - cusps[0]) mod 360` equals `(cusps[10's IC-arc])` |

**Edge cases handled by the formula** (no special-casing required):

- **Equator (φ = 0)**: ASC and MC are 90° apart in *right ascension*
  at every instant, but their *ecliptic longitude* separation varies
  with local sidereal time because the ecliptic is tilted ε ≈ 23.4°
  from the equator. So the four Sripati quadrant arcs at φ=0 are
  *not* exactly 90° each in ecliptic longitude — an earlier-draft
  claim that "Sripati degenerates to Equal House at the equator" was
  withdrawn after the test at φ=0, LST≈178° produced arc_q1=89.87°
  (off by 0.13° from 90°). The structural invariants (antipodal
  symmetry, quadrant-sum=360°) hold at every latitude including φ=0;
  the implementation handles φ=0 without any special-case branch.
  Coverage at low latitude is via the Sri Sri Ravi Shankar fixture
  (lat 8.77°N — arc_q1=97.7°, arc_q2=82.3°, demonstrating asymmetric
  arcs near the equator consistent with the corrected analysis).
- **High latitude (|φ| approaching arctan(1/tan(ε)) ≈ 66.6°)**: Sripati
  has **no circumpolar singularity** (unlike Placidus), because ASC
  and MC themselves are always defined; the trisection is pure
  arithmetic. Bill Gates (lat 47.6°N) and Sonia Gandhi (lat 45.07°N)
  in the fixture corpus exercise this regime and return finite cusps.
- **MC = ASC** (impossible in practice but a degenerate input): all
  cusps collapse to the same longitude. Not gated; mathematically
  consistent.

---

## 4. Fixture-chart predictions — first-principles

5 R-tier charts selected from `tests/fixtures/astrosage-charts.json`
spanning latitude `8.77° N` to `47.60° N`:

| # | Chart | Latitude | Latitude regime |
|---|---|---|---|
| 1 | Narendra Modi          | 23.78° N | mid-low (India) |
| 2 | Sachin Tendulkar       | 18.97° N | low      (India coast) |
| 3 | Mark Zuckerberg        | 40.70° N | mid      (USA NE) |
| 4 | Bill Gates             | 47.60° N | high     (USA NW) |
| 5 | Sri Sri Ravi Shankar   |  8.77° N | near-eq  (India south) |

Derivation: `node notes/phase34e-sripati-derive.mjs`. Inputs to the
script are the chart UTC instants + lat/lng; ASC and MC come from the
library's already-verified `computeBhava` (NOT from any new code); the
Sripati trisection is implemented INLINE in the script (NOT in the
library yet) — anti-circular guarantee per
`memory/feedback_fixture_repinning.md`.

### Per-chart cusp table (hand-derived, locked)

Quadrant-arc breakdown (note the asymmetry growing with latitude):

| Chart | arc_q1 (ASC→IC) | arc_q2 (IC→DSC) |
|---|---|---|
| Narendra Modi (23.78°N) | 94.1475° | 85.8525° |
| Sachin Tendulkar (18.97°N) | 90.2863° | 89.7137° |
| Mark Zuckerberg (40.70°N) | 112.3255° | 67.6745° |
| Bill Gates (47.60°N) | 63.1450° | 116.8550° |
| Sri Sri Ravi Shankar (8.77°N) | 97.7349° | 82.2651° |

The asymmetry is real: at low latitudes the four quadrant arcs are
close to 90° each (Sachin = 90.29° / 89.71°); at high latitudes the
asymmetry grows substantially (Bill Gates at 47.6°N has q1=63° and
q2=117° — nearly a 2:1 ratio).

### Cusp longitudes (sidereal, lahiri ayanamsa)

```
## Narendra Modi  (UTC 1950-09-17T05:30:00Z, lat 23.78, lon 72.63)
ASC = 211.24965083°    MC = 125.39716871°
cusps = [
   1: 211.249651°  Vrischika   1.2497°
   2: 242.632157°  Dhanu       2.6322°
   3: 274.014663°  Makara      4.0147°
   4: 305.397169°  Kumbha      5.3972°
   5: 334.014663°  Meena       4.0147°
   6:   2.632157°  Mesha       2.6322°
   7:  31.249651°  Vrishabha   1.2497°
   8:  62.632157°  Mithuna     2.6322°
   9:  94.014663°  Karka       4.0147°
  10: 125.397169°  Simha       5.3972°
  11: 154.014663°  Kanya       4.0147°
  12: 182.632157°  Tula        2.6322°
]

## Sachin Tendulkar  (UTC 1973-04-24T08:55:00Z, lat 18.966, lon 72.833)
ASC = 127.20461931°    MC = 37.49092862°
cusps = [
   1: 127.204619°  Simha       7.2046°
   2: 157.300056°  Kanya       7.3001°
   3: 187.395492°  Tula        7.3955°
   4: 217.490929°  Vrischika   7.4909°
   5: 247.395492°  Dhanu       7.3955°
   6: 277.300056°  Makara      7.3001°
   7: 307.204619°  Kumbha      7.2046°
   8: 337.300056°  Meena       7.3001°
   9:   7.395492°  Mesha       7.3955°
  10:  37.490929°  Vrishabha   7.4909°
  11:  67.395492°  Mithuna     7.3955°
  12:  97.300056°  Karka       7.3001°
]

## Mark Zuckerberg  (UTC 1984-05-14T05:00:00Z, lat 40.70, lon -74.00)
ASC = 279.50025735°    MC = 211.82573220°
cusps = [
   1: 279.500257°  Makara      9.5003°
   2: 316.942082°  Kumbha     16.9421°
   3: 354.383907°  Meena      24.3839°
   4:  31.825732°  Vrishabha   1.8257°
   5:  54.383907°  Vrishabha  24.3839°
   6:  76.942082°  Mithuna    16.9421°
   7:  99.500257°  Karka       9.5003°
   8: 136.942082°  Simha      16.9421°
   9: 174.383907°  Kanya      24.3839°
  10: 211.825732°  Vrischika   1.8257°
  11: 234.383907°  Vrischika  24.3839°
  12: 256.942082°  Dhanu      16.9421°
]

## Bill Gates  (UTC 1955-10-29T04:58:00Z, lat 47.60, lon -122.333)
ASC = 81.57261474°    MC = 324.71757108°
cusps = [
   1:  81.572615°  Mithuna    21.5726°
   2: 102.620934°  Karka      12.6209°
   3: 123.669252°  Simha       3.6693°
   4: 144.717571°  Simha      24.7176°
   5: 183.669252°  Tula        3.6693°
   6: 222.620934°  Vrischika  12.6209°
   7: 261.572615°  Dhanu      21.5726°
   8: 282.620934°  Makara     12.6209°
   9: 303.669252°  Kumbha      3.6693°
  10: 324.717571°  Kumbha     24.7176°
  11:   3.669252°  Mesha       3.6693°
  12:  42.620934°  Vrishabha  12.6209°
]

## Sri Sri Ravi Shankar  (UTC 1956-05-12T18:30:00Z, lat 8.767, lon 77.383)
ASC = 286.86620930°    MC = 204.60123279°
cusps = [
   1: 286.866209°  Makara     16.8662°
   2: 319.444550°  Kumbha     19.4446°
   3: 352.022892°  Meena      22.0229°
   4:  24.601233°  Vrishabha  24.6012°
   5:  52.022892°  Vrishabha  22.0229°
   6:  79.444550°  Mithuna    19.4446°
   7: 106.866209°  Karka      16.8662°
   8: 139.444550°  Simha      19.4446°
   9: 172.022892°  Kanya      22.0229°
  10: 204.601233°  Tula       24.6012°
  11: 232.022892°  Vrischika  22.0229°
  12: 259.444550°  Dhanu      19.4446°
]
```

### Anti-circular spot checks (must hold for every chart)

| Check | Expected | Modi | Sachin | Zuck | Gates | SSRS |
|---|---|---|---|---|---|---|
| `(cusps[6] - cusps[0]) mod 360` | 180.000000° | 180.000° | 180.000° | 180.000° | 180.000° | 180.000° |
| `(cusps[9] - cusps[3]) mod 360` | 180.000000° | 180.000° | 180.000° | 180.000° | 180.000° | 180.000° |
| `(cusps[7] - cusps[1]) mod 360` | 180.000000° | 180.000° | 180.000° | 180.000° | 180.000° | 180.000° |
| `cusps[2] - cusps[0]` (≡ 2·arc_q1/3) | (per chart) | 62.7650° | 60.1909° | 74.8836° | 42.0966° | 65.1567° |

All hold to within float precision (1e-8°). ✅

---

## 5. API surface — additive design

### 5.1 Type additions (`src/types/jyotish.ts`)

Append immediately after the existing `LagnaInfo` interface (≈line 128):

```typescript
/**
 * `SripatiLagnaInfo` extends {@link LagnaInfo} with the 12 Sripati Paddhati
 * bhava-madhya cusps. Returned by {@link computeSripatiLagna} when
 * `options.includeCusps` is `true`.
 *
 * Each `cusps[i]` is the sidereal ecliptic longitude (degrees, [0, 360))
 * of the *bhava madhya* (mid-point) of bhava `i+1`. By construction
 * `cusps[0]` equals `siderealLongitude`, and `cusps[6]` equals
 * `(siderealLongitude + 180) mod 360`. Opposite cusps differ by exactly
 * 180° — see BPHS Ch.5.
 */
export interface SripatiLagnaInfo extends LagnaInfo {
  /** 12 bhava-madhya longitudes (cusps[0] = bhava 1 madhya = lagna). */
  cusps: number[];
}
```

### 5.2 Function overloads (`src/jyotish/lagna.ts`)

Function signature on `computeSripatiLagna`:

```typescript
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType?: AyanamsaType,
  lang?: Language,
): LagnaInfo;
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType,
  lang: Language,
  options: { includeCusps: true },
): SripatiLagnaInfo;
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
  options?: { includeCusps?: boolean },
): LagnaInfo | SripatiLagnaInfo {
  /* …existing cusp-1-only path… */
  if (!options?.includeCusps) return lagna;
  /* …compute MC via Meeus, then trisect quadrants… */
  return { ...lagna, cusps };
}
```

### 5.3 Backwards-compat invariants

- Calling `computeSripatiLagna(d, loc)` with no options → returns
  the existing `LagnaInfo` exactly as before, byte-for-byte. The
  existing test "Sripati Lagna — equals natal lagna" (cusp-1 equals
  `computeLagna`'s longitude) continues to pass unchanged.
- Calling `computeSripatiLagna(d, loc, ayanamsa, lang, { includeCusps: false })`
  → also returns `LagnaInfo` (explicit equivalent of the default).
- Existing `LagnaInfo` type unchanged → no breaking change for any
  consumer that switch-exhausts on `LagnaInfo` keys or destructures
  it for the 5 documented fields.
- The 4-iterator-pattern test at line 184 of `specialLagnas.test.ts`
  (`for (const fn of [computeHoraLagna, computeGhatiLagna,
  computeBhavaLagna, computeSripatiLagna])`) continues to type-check
  and pass because the no-options overload still returns `LagnaInfo`.

### 5.4 Tie/edge cases

- **High latitude (Bill Gates 47.6°N)**: arc_q1=63.1° / arc_q2=116.9°.
  Asymmetric but well-defined. Returns finite cusps. No circumpolar
  exception.
- **Equator (φ=0)**: structurally tested (12 finite cusps, antipodal
  symmetry preserved). The arcs are **not** exactly 90° each at φ=0
  because ASC and MC are 90° apart in *right ascension* but not in
  *ecliptic longitude* — see §3 edge-cases note. Sripati does not
  degenerate to Equal House at φ=0; the corrected near-equator
  coverage is via Sri Sri Ravi Shankar (lat 8.77°N) in the fixture
  sweep (arc_q1=97.7°, arc_q2=82.3°).
- **MC wrap-around quadrant** (when MC < ASC numerically, the
  `(ASC+360 - MC) mod 360` form of arc_q4 handles it): exercised by
  Modi (ASC=211°, MC=125° — q4 starts at MC and wraps through 360°
  back to ASC).

---

## 6. Implementation plan

### Step 1 — types (`src/types/jyotish.ts`)

Append `SripatiLagnaInfo` interface immediately after `LagnaInfo`
(≈line 128).

### Step 2 — implementation (`src/jyotish/lagna.ts`)

- Add a small `sripatiCusps(ascSidereal, mcSidereal) → number[]` helper
  with the §3 trisection arithmetic (mod-360 normalised).
- Update `computeSripatiLagna` with function overloads. The cusps path:
  1. Compute LST + ε (already done locally for the natal-lagna path
     via SiderealTime + meanObliquity).
  2. Compute MC tropical via `atan2(sin θ, cos θ · cos ε)` (replicate
     the formula inline — avoids introducing a dependency on
     `computeBhava`, which would create a circular dependency since
     `bhava.ts` already imports from `lagna.ts`).
  3. Subtract ayanamsa to get sidereal MC.
  4. Call `sripatiCusps(ASC, MC)` to get 12 longitudes.
  5. Return `{ ...lagna, cusps }`.

### Step 3 — tests (`tests/unit/specialLagnas.test.ts`)

Append new `describe` blocks to the existing file (do NOT modify the
existing cusp-1 == natal-lagna pin):

- `computeSripatiLagna — cusps option output shape` (length 12, all
  finite, all in [0, 360), `cusps[0] === siderealLongitude`).
- `computeSripatiLagna — backwards-compat default` verifying that
  calling without options or with `{ includeCusps: false }` does NOT
  add a `cusps` field (`LagnaInfo` byte-for-byte).
- `computeSripatiLagna — antipodal invariants` (every 6-apart cusp
  pair differs by exactly 180° within float ε).
- `computeSripatiLagna — quadrant-sum invariant` (arc_q1 + arc_q2
  + arc_q3 + arc_q4 = 360° within float ε).
- `computeSripatiLagna — fixture pin sweep` pinning the 5 charts of
  §4 with each cusp to 1e-4° tolerance.
- `computeSripatiLagna — equator degenerate case`: build a date+lat=0
  location, verify all 4 quadrant arcs are 90° to within 1e-4° (i.e.,
  the Sripati system collapses to Equal House at the equator).

### Step 4 — index exports

- Add `SripatiLagnaInfo` to the type re-export in `src/types/index.ts`
  (after `LagnaInfo`) and in the type re-export block of
  `src/index.ts` (≈line 157).
- `computeSripatiLagna` is already exported — no change.

### Step 5 — verification

- `npx vitest run` — expect 8,028 → 8,028 + ~10 new tests, all green.
  Existing "Sripati Lagna — equals natal lagna" test must continue
  to pass unchanged.
- `npm run build` — expect dist/index.cjs to grow ~0.4–0.8 KB
  (369.57 KB → ~370.0–370.4 KB).

---

## 7. Sources

| Source | URL | Used for |
|---|---|---|
| Wikipedia — Bhāva | https://en.wikipedia.org/wiki/Bh%C4%81va | Sripati = Porphyry-style; quadrant trisection statement |
| planetarypositions.com — Bhava/Chalit chart | https://planetarypositions.com/kundali-software/2006/02/10/bhava-chart-chalit-chart/ | Trisection rule + walkthrough |
| Jothishi — The Bhava Chalit Chart | https://jothishi.com/the-bhava-chalit-chart/ | bhava madhya = mid-point of bhava; sandhi vs madhya |
| prosperitynjoy blog — Bhava calculation | http://www.prosperitynjoy.com/2015/05/bhava-calculation-or-calculation-of.html | Example arithmetic walkthrough |
| nikhilworld — CUSP or KP Chart (Placidus) | https://nikhilworld.com/cusp-or-kp-chartplacidus-system/ | Sripati vs Placidus contrast |
| Lalitha Anamika — Bhava Chalit Intro | https://jyotishbootcamp.substack.com/p/w10-1-bhava-chalit-intro | Modern walkthrough; same formula |
| astrologyofbharat.org | https://www.astrologyofbharat.org/2017/08/chalit-versus-birth-chart-the-difference.html | Chalit ≡ Sripati under standard nomenclature |
| astrologershukla.blogspot.com — Bhavas (Houses) | http://astrologershukla.blogspot.com/2014/11/bhavas-houses.html | Cites Sripati Paddhati explicitly |
| Sripati — *Sripati Paddhati* (~12th c.) | (print, Sanskrit) | Primary classical text |
| BPHS — Brihat Parashara Hora Shastra Ch.5 | (print) | Touches special lagnas + Sripati cusps |
| Drik Panchang Utilities | https://www.drikpanchang.com/utilities/astrology-utilities.html | Sripati-surface inventory (none) |
| ProKerala birth chart | https://www.prokerala.com/astrology/birth-chart/ | Form-only POST surface (no gettable cusps) |

External-source cross-validation for **fixture chart cusp longitudes**:
no source publishes a Sripati cusp table for our specific fixture
charts with sufficient numerical precision to anchor a 1e-4° pin
test. Library predictions rely entirely on first-principles derivation
from the unanimous formula (§2) applied to the library's already-tested
ASC and MC. This matches the Phase 34a-d pattern when drik panchang
publishes nothing: classical formula + multi-source modern consensus is
the operative authority, and the formula's mathematical uniqueness
makes derivation auditable without an external numeric anchor.

---

## 8. Anti-circular guarantee (locked)

Per `memory/feedback_fixture_repinning.md` + the Phase 34c shadbala-
combust methodology precedent: the predictions in §4 were generated by
`notes/phase34e-sripati-derive.mjs`, which:

1. Imports `computeBhava` from the **already-built** library (Phase 34e
   item-6 build, dist 369.57 KB) — uses already-verified ASC + MC
   outputs. These are NOT the new code under test.
2. Implements the Sripati trisection **inline in the script**, NOT in
   the library (the library currently only ships cusp-1).
3. Emits the cusp predictions for transcription into the test file.

The new `computeSripatiLagna({ includeCusps: true })` implementation
will be checked against these pinned predictions, NOT the other way
around. If implementation output diverges from the §4 table, the
implementation is wrong — re-derive from §3 before re-pinning.

The 5 fixture charts span latitudes 8.77°N (near-equator) to 47.60°N
(high-mid), exercising the full asymmetry range of quadrant arcs (q1
ranges from 63.1° at Gates to 112.3° at Zuckerberg). This is wider
range than the existing Sripati `cusp_1 = lagna` test (Delhi at
28.6°N) and gives the implementation broader coverage than the
existing fixture pins.
