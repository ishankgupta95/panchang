# Phase 34e item 5 — Shadbala Saptavargaja / Ojha-Yugma / Drekkana sub-components

Research date: 2026-05-11. Reference order (per user prompt): **ProKerala
/ PyJHora shadbala numerics > BPHS Ch.27**. Drik publishes nothing on
Shadbala (confirmed by the 34e-jaimini-research §1 inventory — same 18
calculators, no Shadbala).

Sub-phase scope (Phase 34e item 5 of 5 — the **final** Phase 34e
item, marked HIGHEST INTERACTION RISK by the user prompt). The
existing `computeShadbala` exposes Sthana Bala as **Uchcha only** and
Kala Bala as **Nathonatha + Paksha only**, with all other classical
sub-components intentionally omitted. The user prompt cites ~5%
agreement vs ProKerala/PyJHora today and asks for three specific
Sthana sub-components: **Saptavargaja**, **Ojha-Yugma**, **Drekkana**.

## TL;DR

**Decision**: ship all three Sthana sub-components as **always-on**
additions to `Sthana Bala` (no opt-in flag — they're standard BPHS
Sthana terms, not optional behaviour). This changes
`shadbala.total` for most grahas, which propagates into Bhava Bala's
`bhavadhipati` term and forces the Phase 31 / 34c Bhava Bala fixture
pins to be re-derived. Per the locked methodology:
> *Before re-pinning anything: predict the per-house Bhava Bala delta
> from first principles (which grahas gain/lose how many virupas,
> which houses they lord, what the bhavadhipati cell should change to).
> Confirm observed test failures match the prediction in
> magnitude/locus/sign. Only then re-pin.*

The prediction is implemented as a standalone derive script
(`notes/phase34e-shadbala-derive.mjs`) that:
1. Builds the natal chart for each fixture (already-Phase-29-validated).
2. Computes the per-graha delta to shadbala.total from the new
   sub-components, using ONLY the published BPHS rules (no library
   code under test).
3. Computes the per-house delta to bhavaBala.total = delta-to-
   bhavadhipati-for-cusp-lord.
4. Outputs the predicted new totals.

The library implementation in §6 is then verified AGAINST these
predictions, NOT regenerated from the implementation's own output.

**Scope additions**:
- **Saptavargaja Bala** (Sthana sub-component): per-graha dignity
  strength summed across **7 vargas** (D1 Rashi, D2 Hora, D3
  Drekkana, D7 Saptamsa, D9 Navamsa, D12 Dwadasamsa, D30 Trimsamsa).
- **Ojha-Yugma Bala** (Sthana sub-component): per-graha bonus for
  being in the correct parity sign of D1 (Rashi) and D9 (Navamsa).
- **Drekkana Bala** (Sthana sub-component): per-graha bonus for being
  in the correct decanate of its rashi.

**Scope explicitly NOT added** (out of this sub-phase):
- Kendradi Bala (Kendra/Panaphara/Apoklim by house — not in user's
  named list).
- Full Kala Bala sub-components (Tribhaga, Varsha, Masa, Dina, Hora,
  Ayana, Yuddha — out of user's named list).

## 1. Drik / external surface

Drik publishes no Shadbala calculator. ProKerala has
`prokerala.com/astrology/shadbala.php` (form-only POST per 34d
pattern); cannot query for the AstroSage R-tier fixture inputs.
PyJHora is a desktop application (no web URL). Per user prompt's
ranking — "ProKerala / PyJHora numerics > BPHS" — I cannot directly
compare per-chart numerics. The implementation follows BPHS Ch.27
rules as the source of truth, with documentation noting any rule
ambiguity where ProKerala/PyJHora may diverge.

## 2. BPHS Ch.27 sub-component rules

Verbatim per the standard R. Santhanam translation (and cross-
referenced with Maharshi Parashara's Brihat Parashara Hora Shastra
edition Mihir Chakravarty 1996):

### 2.1 Saptavargaja Bala — verse 16–17

> "Through the seven Vargas (Saptavarga) — Rasi, Hora, Drekkāṇa,
> Saptāṁśa, Navāṁśa, Dvādaśāṁśa, and Triṁśāṁśa — the planets get
> the following Sthana Bala in Virupas:"
>
> | Dignity in varga | Virupas |
> |---|---|
> | Moolatrikona | 45 |
> | Own (Swakshetra) | 30 |
> | Great friend (Adhi-mitra) | 22.5 |
> | Friend (Mitra) | 15 |
> | Neutral (Sama) | 7.5 |
> | Enemy (Shatru) | 3.75 |
> | Great enemy (Adhi-shatru) | 1.875 |

Per-graha total = sum over 7 vargas. Max = 7 × 45 = 315 V (unreachable
in practice). Realistic per-graha contribution: ~30 V to ~150 V.

**Library mapping** (`computeDignity` returns one of 7 categories,
which collapses great-friend/great-enemy distinctions into the base
friend/enemy categories — the natural-only friendship layer; the
library does not implement temporal Tatkalika friendship):

| `computeDignity` return | Saptavargaja value |
|---|---|
| `'exalted'` | 45 |
| `'moolatrikona'` | 45 |
| `'own'` | 30 |
| `'friend'` | 15 (great-friend distinction collapsed; conservative lower bound) |
| `'neutral'` | 7.5 |
| `'enemy'` | 3.75 (great-enemy distinction collapsed) |
| `'debilitated'` | 1.875 (approximating great-enemy) |

This mapping is *conservative on the friend/enemy side* — i.e., the
library will undershoot ProKerala's Saptavargaja when the planet sits
in a true great-friend sign (which would score 22.5 V in BPHS but 15
V here). The bias is bounded: max under-shoot is 7 vargas × (22.5 − 15)
= 52.5 V per graha across all 7 vargas, but a planet is rarely in a
great-friend sign in ALL 7 vargas. Typical bias: 5–20 V per graha.
Documented in `computeSaptavargajaBala` JSDoc.

### 2.2 Ojha-Yugma Bala — verse 18–19

> "Mars, Jupiter, the Sun get Oja-Yugma Bala if posited in odd signs
> in Rāśi and Navāṁśa respectively. Moon and Venus when placed
> similarly in even Rāśi and Navāṁśa get this. Mercury and Saturn
> share the same benefit as Moon and Venus when they are in even
> rāśis."

Translated to algorithm:

```
For Sun, Mars, Jupiter (masculine):
  +15 V if Rashi (D1) sign is odd (rashi index ∈ {0, 2, 4, 6, 8, 10})
  +15 V if Navamsa (D9) sign is odd

For Moon, Mercury, Venus, Saturn (feminine + eunuch grouped):
  +15 V if Rashi sign is even (rashi index ∈ {1, 3, 5, 7, 9, 11})
  +15 V if Navamsa sign is even
```

Max per graha: 30 V (both Rashi AND Navamsa match parity preference).
Minimum: 0 V.

Note on parity convention: rashi *index* 0 = Aries is the **1st**
zodiacal sign → "1st" is conventionally ODD. So odd-rashi indices
{0, 2, 4, 6, 8, 10} correspond to "odd-numbered" signs
(Aries-1st, Gemini-3rd, etc.). Library uses zero-based indexing.

### 2.3 Drekkana Bala — verse 20

> "Male, Eunuch, and Female grahas get 15 V each when placed in the
> 1st, 2nd, and 3rd Decanate of a Rāśi respectively."

```
For each graha:
  Drekkana index = floor(degreeInRashi / 10)   // 0, 1, or 2
  If graha ∈ {Sun, Mars, Jupiter}      AND drekkana == 0: +15 V
  If graha ∈ {Mercury, Saturn}          AND drekkana == 1: +15 V
  If graha ∈ {Moon, Venus}              AND drekkana == 2: +15 V
  Else: 0 V
```

Max per graha: 15 V. The 3 BPHS "gender" groupings (Male / Eunuch /
Female) differ from the Ojha-Yugma 2-group split — here Mercury and
Saturn form their own "Eunuch" group (taking the middle decanate),
while Moon and Venus alone are "Female".

## 3. Sthana Bala total post-implementation

Pre-34e-item-5: `sthana = Uchcha` (range 0–60 V).
Post-34e-item-5: `sthana = Uchcha + Saptavargaja + OjhaYugma + Drekkana`.

The library will continue to expose `sthana` as a scalar (a single
field on `PlanetShadbala`); it will NOT break out the sub-components
in the return shape. Callers reading `bala.Sun.sthana` will receive a
larger number than before; the existing field type is unchanged.

The other 4 BPHS Sthana sub-components — Kendradi (house-position),
Saptavargaja's temporal-friendship variant, and per-varga
adjustments — remain out of scope. Documented in JSDoc.

## 4. Cascading effect on Bhava Bala (per-fixture delta prediction)

`computeBhavaBala` reads `shadbala[lord].total` as the
`bhavadhipati` term for each of the 12 bhavas, where `lord` is the
rashi-lord of the bhava cusp. Since this sub-phase changes
`shadbala[g].total` for every graha `g`, each bhava's
`bhavadhipati` changes by `Δshadbala[lord_of_bhava].total`.

The other three Bhava Bala terms (Dik / Drik / Sthana) are
independent of the new sub-components and remain unchanged.

Therefore for each fixture chart `C` and bhava `b`:
```
ΔbhavaBala[C][b].total = Δshadbala[lord_of(cuspRashi(C, b))].total
                        = Δsaptavargaja[lord] + Δojhayugma[lord] + Δdrekkana[lord]
```

This is precisely the per-house, per-chart delta to be predicted in
`notes/phase34e-shadbala-derive.mjs` BEFORE running the test suite
to re-pin.

## 5. Delta prediction strategy (per fixture chart)

### 5.1 Per-graha delta — independent of bhava

For each of the 7 visible grahas (Sun..Saturn) in each fixture:
1. Compute the new Saptavargaja contribution: sum of 7 varga
   dignity values per §2.1.
2. Compute the new Ojha-Yugma contribution per §2.2.
3. Compute the new Drekkana contribution per §2.3.
4. Sum: `Δshadbala[g].total = saptavargaja + ojha + drekkana`.

This is the predicted INCREASE in each graha's shadbala.total. All
deltas are non-negative (Saptavargaja minimum is 1.875 V × 7 ≈ 13 V
even in worst case; Drekkana min 0; Ojha-Yugma min 0). So
shadbala.total only goes UP, never DOWN.

### 5.2 Per-house delta — fixture-specific

For each fixture, for each bhava 1..12:
- `cuspRashi` is taken from `chart.bhava.houses[i].rashi.index`
  (whole-sign houses → cuspRashi = `(lagnaRashi + i) % 12`).
- `lord = RASHI_LORD[cuspRashi]`.
- `ΔbhavaBala[i].total = Δshadbala[lord].total` from §5.1.

### 5.3 Magnitude estimation

For typical R-tier fixtures (well-distributed natal positions):
- Saptavargaja: 30–100 V per graha (depending on dignity hits).
- Ojha-Yugma: 0, 15, or 30 V per graha (parity-dependent).
- Drekkana: 0 or 15 V per graha.

Expected `Δshadbala[g].total` per graha: 30–145 V.
Expected `ΔbhavaBala[b].total` per house (which is exactly one
graha's delta): 30–145 V.

All deltas are POSITIVE (no graha can lose virupas from these
additions). This is the magnitude/sign expectation; the locus is
"every bhava whose cusp-lord is the graha". A graha that lords 2
bhavas (e.g., Mercury lords Gemini + Virgo; Venus lords Taurus +
Libra; Mars lords Aries + Scorpio; Jupiter lords Sag + Pisces; Saturn
lords Cap + Aquarius) causes 2 bhavas to shift by the same magnitude.

The Moon's Cancer and Sun's Leo lordships are singular (1 bhava each).

### 5.4 Anti-circular guarantee

The derive script in §6.1 reads ONLY `chart.planets[i].rashi.index`,
`chart.planets[i].degreeInRashi`, `chart.bhava.houses[i].rashi.index`
— all from the already-validated Phase 29 ephemeris. The new
sub-component formulas in §2 are applied INLINE in the script via
plain JavaScript math + `computeDignity` (existing, Phase 29 +
post-34c verified). The implementation in §6.2 must produce
identical per-graha deltas to within float epsilon. If they
diverge, the implementation is wrong — DO NOT re-pin.

## 6. Implementation plan

### 6.1 Derive script — `notes/phase34e-shadbala-derive.mjs`

Loads dist/index.cjs (current pre-item-5 build, 375.50 KB) and for
each fixture chart:
1. Calls `computeRashiChart` → 9 planet placements + lagna.
2. For each visible graha, calls `computeDivisionalChart` for D1, D2,
   D3, D7, D9, D12, D30 → 7 rashi assignments.
3. Applies §2.1 dignity mapping to each varga → sums to Saptavargaja.
4. Applies §2.2 to Rashi (D1) + Navamsa (D9) parities → Ojha-Yugma.
5. Applies §2.3 to drekkana index → Drekkana.
6. Sums `Δshadbala[g].total = sapt + ojha + drek`.
7. For each bhava 1..12: cuspRashi → lord → `ΔbhavaBala[b].total`.
8. Calls `computeBhavaBala` (current pre-item-5 build) to get baseline
   `bhavaBala.houses[b].total`.
9. Predicted new total = baseline + delta.
10. Emits predictions as a JSON pin block + per-graha + per-house
    delta tables for human review.

### 6.2 Library code — `src/jyotish/shadbala.ts`

Add 3 helper functions:
```typescript
function saptavargajaBala(graha, chart, divisionalCharts): number
function ojhaYugmaBala(graha, rashiIdx, navamsaRashiIdx): number
function drekkanaBala(graha, degreeInRashi): number
```

Update `sthanaBala` to take additional context and return the sum.
Update `shadbalaForChart` to compute the divisional charts (D2, D3,
D7, D12, D30 — D1 and D9 already accessible) and pass them through.

### 6.3 Test re-pinning workflow

Per locked methodology (`memory/feedback_fixture_repinning.md`):

1. Run `node notes/phase34e-shadbala-derive.mjs` → predicted new
   totals per fixture, per bhava.
2. Implement §6.2.
3. Run `npx vitest run tests/unit/bhavaBala.test.ts` → expect 5
   fixture-pin failures.
4. For each failure, compare the observed `result.houses[b].total`
   against the predicted total from step 1.
5. If observed == predicted (±1e-3) for ALL houses across ALL 5
   fixtures → re-pin to predicted values, citing the derive script
   as the audit trail in a code comment.
6. If observed ≠ predicted at any cell → DO NOT re-pin. Diagnose the
   divergence first; fix either the algorithm or the prediction.

### 6.4 Sthana test pins (if any)

`tests/unit/shadbala.test.ts` may have pinned per-graha `sthana`
values directly (not just via Bhava Bala cascade). Audit that file
before implementation; apply the same predict-verify-repin workflow.

## 7. Sources

| Source | URL / citation | Used for |
|---|---|---|
| Maharishi Parashara, *Brihat Parashara Hora Shastra* Ch.27 | R. Santhanam translation (print) | Primary classical authority — verse 16-17 (Saptavargaja), 18-19 (Ojha-Yugma), 20 (Drekkana) |
| The Internet Sacred Text Archive — BPHS English | https://archive.org/stream/BPHSEnglish/BPHS%20-%201%20RSanthanam_djvu.txt | Public-domain Santhanam translation cross-reference |
| Sanjay Rath — Shadbala references in *Brihat Nakshatra* and *Crux of Vedic Astrology* | (print) | Modern commentary on Sthana Bala sub-components |
| Drik Panchang Utilities | https://www.drikpanchang.com/utilities/astrology-utilities.html | No Shadbala calculator (drik-silent surface) |
| ProKerala Shadbala calculator | https://www.prokerala.com/astrology/shadbala.php | Form-only POST; cannot query for fixture inputs |

## 8. Risks + mitigations

- **Risk**: ProKerala uses different mapping for great-friend /
  great-enemy in Saptavargaja; library will diverge from ProKerala's
  numerics by ~5–20 V per graha.
  **Mitigation**: documented in JSDoc as a known approximation; user
  can layer their own temporal-friendship logic if exact ProKerala
  parity is required.

- **Risk**: Predicted deltas in §5 may diverge from observed test
  failures (indicating bug in implementation OR in prediction).
  **Mitigation**: per-graha delta is itemized (Saptavargaja vs Ojha vs
  Drekkana columns) so divergence can be localized. No re-pinning
  without prediction match.

- **Risk**: Existing `tests/unit/shadbala.test.ts` may have direct
  pins on `sthana` field; these will break.
  **Mitigation**: audit the file; apply same predict-verify-repin
  workflow.
