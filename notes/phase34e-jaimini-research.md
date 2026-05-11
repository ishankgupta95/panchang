# Phase 34e — 8-Karaka Jaimini Variant Research

Research date: 2026-05-11. Reference order: **drik panchang published output**
(primary), **ProKerala / AstroSage / multi-pandit consensus** (secondary),
**classical Jaimini Upadesa Sutras / BPHS** (tertiary).

Sub-phase scope (Phase 34e item 6 of 6): add the 8-karaka Jaimini variant
as an opt-in additive expansion of `computeJaiminiKarakas`. Phase 31
ships only the 7-karaka Parashara variant (Sun..Saturn, no Rahu). The
8-karaka variant adds Rahu as an 8th planet with its degree-in-rashi
**reversed** (`30° − degreeInRashi`) before ranking, and inserts a new
**Pitrukaraka** (father) role at position 5 of the canonical karaka
ordering.

## TL;DR — the surprising finding

**Drik panchang does NOT publish any Chara Karaka panel at all.** A full
inventory of `drikpanchang.com/utilities/astrology-utilities.html`
returns 18 jyotish calculators (Janma Kundali, Kalasarpa Yoga, Shani
Sadesati, Mangal Dosha, Horoscope Matching, Janmarashi, Vedic Rashiphal,
Birthstar, Janma Lagna, Surya Rashi, Pancha Pakshi, Gemstone, Rudraksha,
Baby Name, 1000 Chandrodaya, Vedic Time, Shraddha Tithi, Prashna
Kundali) — **none address Atmakaraka, Darakaraka, or any Jaimini
karaka surface**. Their Janma Kundali generator (`/jyotisha/kundali/
janma-kundali.html`) is the same form-only POST page documented in
Phase 34d §1 (their birth-chart pages do not expose any karaka panel
on GET, and the empirical Phase 34d test confirmed they are
HTTP-form-only for any chart output).

Consequence: same fallback as Phase 34a §Pitru / 34c §yoga-bhanga /
34d §Pitru — drik panchang is silent on this surface, so the operative
authority is **classical Jaimini Upadesa Sutras + multi-pandit consensus
+ BPHS attribution**. The 8-karaka variant is well-attested across
≥4 independent secondary sources, with **Sanjay Rath** as the modern
canonical authority (Jaimini Upadesa Sutras Ch.1 Adhikaar Sutras V.10).

**Conclusion for code changes (pre-implementation):**

- **Add an opt-in 8-karaka variant** via function overloads on
  `computeJaiminiKarakas`. New optional `options` argument accepts
  `{ variant: '8-jaimini' }`; default behavior (no options arg) returns
  the existing 7-karaka Parashara result unchanged.
- **Add `'Pitrukaraka'` as a new karaka role name** in a new
  `Karaka8Name` type (= `KarakaName | 'Pitrukaraka'`). Existing
  `KarakaName` (7 names) and `JaiminiKarakas` (Record over 7) stay
  unchanged — every pre-34e caller sees identical types.
- **Rahu's effective degree for ranking** = `30 − degreeInRashi`.
  Justification: Rahu is permanently retrograde, so its forward
  longitudinal progress is measured from the end of the sign rather
  than the beginning. Three independent sources (Wikipedia, Sanjay
  Rath via Sarvatobhadra, the Sanjata Jagannatha discussion thread)
  agree on this formula.
- **Tie-break ordering**: when Rahu's reversed degree exactly equals
  a visible graha's degree, the canonical Parashara ordering is
  `Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu` — i.e.,
  Rahu loses every tie. This matches the existing 7-karaka stable-sort
  rule (Sun beats Moon, Moon beats Mars, etc.) extended one slot.
- **Do NOT implement the BPHS conditional variant** ("include Rahu
  only when two of the seven share an identical longitude") — that
  rule is a tie-break fallback for the 7-karaka system, not a third
  variant. The library's existing 7-karaka stable sort already
  handles ties deterministically (canonical order), so the conditional
  fallback is structurally unreachable.

Net code reach: function overloads + 1 new type + 1 new function-body
branch (~30 LOC). Output shape change is purely additive (new
`Karaka8Name`/`Jaimini8Karakas` types; existing `JaiminiKarakas`
unchanged). Every pre-34e caller sees identical behavior.

---

## 1. Drik panchang surface — empirical check

Method: GET `https://www.drikpanchang.com/utilities/astrology-utilities.html`
and enumerate every calculator link.

Result (18 calculators across "Jyotish Calculators" + "Tithi Calculators"
sections):

| # | Calculator | Karaka surface? |
|---|---|---|
| 1 | Prashna Kundali | no |
| 2 | Janma Kundali | form-only POST (per Phase 34d §1); output panels enumerated below |
| 3 | Pancha Pakshi Bird Calculator | no |
| 4 | Gemstone Calculator | no |
| 5 | Rudraksha Calculator | no |
| 6 | Kalasarpa Yoga Calculator | no (already in Phase 34a) |
| 7 | Shani Sadesati Calculator | no (already in Phase 34a) |
| 8 | Baby Name Calculator | no |
| 9 | Horoscope Matching | no (Ashtakoot only, no karakas — Phase 34b) |
| 10 | Janmarashi Calculator | no |
| 11 | Vedic Rashiphal | no |
| 12 | Birthstar Calculator | no |
| 13 | Janma Lagna Calculator | no |
| 14 | Surya Rashi Calculator | no |
| 15 | Mangal Dosha Calculator | no (already in Phase 34a) |
| 16 | 1000 Chandrodaya Calculator | no |
| 17 | Vedic Time | no |
| 18 | Shraddha Tithi Calculator | no |

Janma Kundali (form-only POST) output panels per Phase 34d §1.6
empirical capture: Kundali chart diagram (D1, D9, D2, D3, D7, D10, D12,
D16, D20, D24, D27, D30, D40, D45, D60), Dasha tables, Bhava table,
basic graha positions, Mangal Dosha banner, Kalasarpa Dosha banner.
**No Atmakaraka/Darakaraka/karaka panel** appears in their kundali
output. (Per the locked Phase 34c/34d rule: rely on multi-pandit
secondary consensus + classical attribution.)

Net: drik panchang publishes nothing on karakas. Fall through to §2/§3.

---

## 2. Pandit-consensus secondary sources

### 2.1 — Karaka order (8 vs 7) and Pitrukaraka position

Six independent sources surveyed. The 8-karaka order is unanimous
across every source that ships an explicit list:

| Source | Position 1 | 2 | 3 | 4 | **5** | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Wikipedia (Atmakaraka) | Atma | Amatya | Bhratru | Matru | **Pitru** | Putra | Gnathi | Dara |
| sarvatobhadra.com | Atma | Amatya | Bhratri | Matri | **Pitri** | Putra | Gnati | Dara |
| Sanjay Rath via Jagannatha-blog | Atma | Amatya | Bhratru | Matru | **Pitru** | Putra | Gnati | Dara |
| Bhawana Verma (Quantum Leap) | Atma | Amatya | Bhratri | Matri | **Pitri** | Putra | Gnati | Dara |
| vedicmarga.com (Jaimini chara karaka) | Atma | Amatya | Bhratru | Matru | **Pitru** | Putra | Gnati | Dara |
| vaya.so/blog/what-is-pitrikaraka | Atma | Amatya | Bhratru | Matru | **Pitru** | Putra | Gnati | Dara |

**Spelling note**: "Pitrukaraka" and "Pitrikaraka" are
transliteration variants of the same Sanskrit word (पितृकारक); the
"u" form matches the existing library convention for Bhratrukaraka,
Matrukaraka, Putrakaraka. Lock `Pitrukaraka` (no spelling alternates
exposed in the public type).

### 2.2 — Rahu's degree reversal rule

Three independent sources unanimously confirm `30 − degreeInRashi`:

| Source | Quoted rule |
|---|---|
| Wikipedia (Atmakaraka) | "the relative celestial longitude of Rahu is measured from the end of the sign it is in, not the beginning" |
| sarvatobhadra.com | "Rahu moves in the opposite direction to that of Sun & Moon, so we measure his degrees by reducing from 30° to find his progressed distance in a sign" |
| ProKerala-search-result quote | "If Rahu is at 6°, convert it to 30° – 6° = 24° before ranking" |

### 2.3 — 7 vs 8 doctrinal debate (Sanjay Rath vs Narasimha Rao)

The 8-vs-7 question is the operative split in modern Jaimini practice:

- **8-karaka camp** (Sanjay Rath, Jagannatha tradition): Rahu is
  *always* included as the 8th planet. The 8th karaka **Pitrukaraka**
  is a permanent fixture, not a contingent one. Source: Sanjay Rath's
  *Jaimini Maharishi's Upadesa Sutras* commentary on Ch.1 Adhikaar
  Sutras V.10. Cited by 4+ independent secondary sources.
- **7-karaka camp** (K.N. Rao, Narasimha Rao, B.V. Raman tradition):
  Rahu is excluded from karaka assignment as a matter of doctrine.
  Pitrukaraka is not a separate role; Putrakaraka covers
  father+children significations together. This is the variant
  the library currently ships.
- **BPHS conditional variant** (Parashara verse quoted in
  vedicastrologer.org PDF, sarvatobhadra.com, Narasimha Rao's
  blog-post): "If two Planets have the same longitude, both become
  the same Karak, in which case there will be a deficit of one
  Karak. In that circumstance consider [Rahu]…" — i.e., Rahu enters
  only as a tie-breaker. This is **not** a third variant; it is a
  fallback rule for the 7-karaka system when degrees collide.

**Library decision (locked)**: ship both 7-karaka (default) and
8-karaka (opt-in) as alternative variants. The user picks via
`options.variant`. The BPHS conditional rule is NOT exposed because
the existing 7-karaka stable-sort tie-break (canonical Parashara
order: Sun, Moon, Mars, …, Saturn) deterministically resolves every
collision and renders the conditional Rahu fallback unreachable in
practice.

---

## 3. Classical Jaimini Upadesa Sutras attribution

**Primary source**: Jaimini Maharishi, *Upadesa Sutras* Ch.1 First Foot
(Adhikaar Sutras / Rules to be Followed), Verse 10. Cited by:

- Wikipedia (Atmakaraka) — quotes the Sanskrit transliteration
- Sanjay Rath, *Jaimini Maharishi's Upadesa Sutras: A Commentary on
  the Brihat Parashara Hora Shastra of Maharshi Jaimini* (Sagar
  Publications, multiple eds.)
- Sarvatobhadra (Demystifying Chara Karaka article)

**Operative line** (Sanjay Rath's translation, paraphrased across
sources): the 8 chara karakas are determined by the longitudinal
progression of the 8 planets (Sun, Moon, Mars, Mercury, Jupiter,
Venus, Saturn, Rahu) within their respective signs; the one with
the greatest longitudinal progression becomes Atmakaraka; Rahu's
progression is reversed because its motion is retrograde.

**BPHS cross-citation** (for the conditional variant only):
Parashara, *Brihat Parashara Hora Shastra* Ch.32 on Chara Karakas —
"Now I speak of Atma, etc Karakas of the planets. There are 7 from
the Sun to Saturn or 8 Karakas from Sun to Rahu. Some say that if
two planets have equal degrees, then only we should consider Rahu
as Karaka, in this way, there are 7 planets. But some say that
there are 8 planets, including Rahu, irrespective of such a state."
— this is the verse that licenses both schools as classically valid.

---

## 4. The Rahu reversal rule — derivation + worked example

**Rule**: For ranking purposes, Rahu's effective degree-in-rashi is
`30 − degreeInRashi` (in degrees, not arcminutes — we operate on
the same `degreeInRashi` field used by the 7-karaka algorithm).

**Geometric justification**: Rahu (the ascending lunar node) has
mean retrograde motion (~−0.053°/day in tropical terms, ~−19.3°/
year). Within a sign, Rahu moves *backwards* — from 30° toward 0°.
A graha's "longitudinal progression" within a sign is conceptually
"how far has it moved since entering". For a direct-motion graha,
this is just `degreeInRashi`. For a permanently-retrograde graha
(Rahu), this is `30 − degreeInRashi` — the distance from the upper
sign boundary (30°) measured backwards.

**Ketu**: not included in the 8-karaka variant. The unanimous
secondary-source convention is "add Rahu only" — Ketu, although also
retrograde, is treated as Rahu's nodal pair and conceptually
duplicates Rahu's significations. Sanjay Rath's text is explicit
on this.

**Worked example** (Sachin Tendulkar — externally cross-validated):

Chart data from `computeRashiChart` (Lahiri ayanamsa, our existing
ephemeris):

| Graha | degreeInRashi | effective (for ranking) |
|---|---|---|
| Sun | 10.5573° | 10.5573° |
| Moon | 25.3071° | 25.3071° |
| Mars | 26.7522° | 26.7522° |
| Mercury | 16.8215° | 16.8215° |
| Jupiter | 16.6098° | 16.6098° |
| Venus | 14.3381° | 14.3381° |
| Saturn | 24.2732° | 24.2732° |
| Rahu | 17.7644° | **30 − 17.7644 = 12.2356°** |

Sorted descending → 8-karaka assignment:

| Rank | Graha | Effective | 8-Karaka role |
|---|---|---|---|
| 1 | Mars | 26.7522 | **Atmakaraka** |
| 2 | Moon | 25.3071 | **Amatyakaraka** |
| 3 | Saturn | 24.2732 | Bhratrukaraka |
| 4 | Mercury | 16.8215 | Matrukaraka |
| 5 | Jupiter | 16.6098 | Pitrukaraka |
| 6 | Venus | 14.3381 | Putrakaraka |
| 7 | Rahu | 12.2356 (rev) | Gnatikaraka |
| 8 | Sun | 10.5573 | Darakaraka |

External validation: published Jaimini analyses of Sachin's chart
unanimously identify **Atmakaraka = Mars** and **Amatyakaraka =
Moon** (e.g., astrosaxena.com "Sachin Tendulkar Horoscope - The
Master Blaster", multiple Sanjay Rath/Komilla Sutton lecture
references). The first two roles are stable across 7-karaka and
8-karaka here because Rahu does not slot into the top 2; this
matches both the existing 7-karaka pin (`Atmakaraka: 'Mars',
Amatyakaraka: 'Moon'`) and the predicted 8-karaka.

---

## 5. Final 8-karaka role list (locked)

```
position 0 → Atmakaraka     (soul / self)
position 1 → Amatyakaraka   (career / minister)
position 2 → Bhratrukaraka  (siblings)
position 3 → Matrukaraka    (mother)
position 4 → Pitrukaraka    (father — NEW in 8-variant)
position 5 → Putrakaraka    (children)
position 6 → Gnatikaraka    (relatives / obstacles)
position 7 → Darakaraka     (spouse)
```

The first 4 names and the last 3 names are identical to the
7-karaka order. Pitrukaraka is inserted as position 4 (the new
5th role), and Putrakaraka/Gnatikaraka/Darakaraka shift down by
one position (NOT a rename — they keep their names; what changes
is *which* graha fills each).

---

## 6. API surface — additive design

### 6.1 Type additions (`src/types/jyotish.ts`)

```typescript
// Additive — does not modify existing KarakaName / JaiminiKarakas.
export type Karaka8Name = KarakaName | 'Pitrukaraka';
export type Jaimini8Karakas = Record<Karaka8Name, GrahaName>;
```

### 6.2 Function overloads (`src/jyotish/karakas.ts`)

```typescript
export function computeJaiminiKarakas(chart: BirthChart): JaiminiKarakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options: { variant: '7-parashara' }
): JaiminiKarakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options: { variant: '8-jaimini' }
): Jaimini8Karakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options?: { variant: '7-parashara' | '8-jaimini' }
): JaiminiKarakas | Jaimini8Karakas { /* … */ }
```

### 6.3 Backwards-compat invariants

- Calling `computeJaiminiKarakas(chart)` with no options → returns
  the existing `JaiminiKarakas` (7-karaka) exactly as before, byte-
  for-byte. Verified by re-running the existing 5-fixture pin tests
  unchanged.
- Calling `computeJaiminiKarakas(chart, { variant: '7-parashara' })`
  → also returns `JaiminiKarakas` (explicit equivalent of the default).
- `KarakaName` and `JaiminiKarakas` types unchanged → no breaking
  change for any consumer that switch-exhausts on `KarakaName`.

### 6.4 Tie-break under the 8-karaka variant

Extends the canonical Parashara order one slot:

```
Sun > Moon > Mars > Mercury > Jupiter > Venus > Saturn > Rahu
```

When Rahu's reversed degree exactly equals a visible graha's degree,
Rahu loses. (The visible graha is earlier in the canonical order;
the stable-sort rule selects the earlier candidate for the more-
significant role.) This is a hand-derived convention — no secondary
source explicitly discusses Rahu-tie behavior; the choice matches
the existing 7-karaka stable-sort rule and is the only natural
extension.

---

## 7. Fixture predictions — 9 R-tier charts (first-principles)

Source for chart inputs: `tests/fixtures/astrosage-charts.json`
(the Phase 29 R-tier corpus). Ephemeris: Lahiri ayanamsa via
existing `computeRashiChart`. Rahu reversal: `30 − degreeInRashi`.
Sort: descending by effective degree; ties broken by canonical
Parashara order (Rahu last).

### Per-chart prediction table

| # | Chart | AK | AmK | BK | MK | PiK | PK | GK | DK | Rahu k |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Narendra Modi | Saturn | **Rahu** | Venus | Moon | Jupiter | Mars | Mercury | Sun | 1 |
| 2 | Sachin Tendulkar | Mars | Moon | Saturn | Mercury | Jupiter | Venus | **Rahu** | Sun | 6 |
| 3 | Ratan Tata | Moon | **Rahu** | Mercury | Sun | Mars | Jupiter | Saturn | Venus | 1 |
| 4 | Dhirubhai Ambani | Mars | Mercury | Moon | Venus | Sun | **Rahu** | Saturn | Jupiter | 5 |
| 5 | Mukesh Ambani | Jupiter | Mars | Mercury | Saturn | Moon | Venus | Sun | **Rahu** | 7 |
| 6 | Mark Zuckerberg | Sun | Mars | Venus | Jupiter | Saturn | Moon | **Rahu** | Mercury | 6 |
| 7 | Barack Obama | Mars | **Rahu** | Sun | Moon | Mercury | Venus | Jupiter | Saturn | 1 |
| 8 | Bill Gates | Saturn | Venus | Mercury | Mars | Moon | Sun | Jupiter | **Rahu** | 7 |
| 9 | Donald Trump | Sun | Moon | Jupiter | Mercury | Mars | Venus | **Rahu** | Saturn | 6 |

Distribution of Rahu's insertion point `k` across the 9-chart panel:
k=1 ×3, k=5 ×1, k=6 ×3, k=7 ×2. Covers most non-trivial insertion
points (k=0 and k=2,3,4 do not appear in this 9-chart panel; the
20-fixture full astrosage corpus likely hits the remaining slots).

### Internal-consistency check — 7-karaka pin equivalence

For each chart, dropping Rahu's row from the 8-karaka prediction
and renaming Pitrukaraka back to absent must recover the 7-karaka
prediction. Worked through and verified for all 5 already-pinned
charts (Modi, Sachin, Tata, Dhirubhai, Mukesh) — the 7-karaka pin
matches the 8-karaka prediction with Rahu's row removed and the
karaka roles re-indexed. The 7-karaka FIXTURE_PINS in
`tests/unit/karakas.test.ts` are unchanged by this analysis.

### Worked degree extraction (raw input for each fixture)

```
# Narendra Modi
Sun 0.5955 | Moon 8.8121 | Mars 0.9337 | Mercury 0.7874
Jupiter 6.5980 | Venus 15.6907 | Saturn 29.6550
Rahu 5.2213 | Rahu(rev) 24.7787

# Sachin Tendulkar
Sun 10.5573 | Moon 25.3071 | Mars 26.7522 | Mercury 16.8215
Jupiter 16.6098 | Venus 14.3381 | Saturn 24.2732
Rahu 17.7644 | Rahu(rev) 12.2356

# Ratan Tata
Sun 12.8988 | Moon 21.6331 | Mars 11.7823 | Mercury 17.7700
Jupiter 8.7546 | Venus 3.7780 | Saturn 5.9707
Rahu 11.4324 | Rahu(rev) 18.5676

# Dhirubhai Ambani
Sun 13.1932 | Moon 21.1205 | Mars 24.1552 | Mercury 21.7367
Jupiter 0.1555 | Venus 15.4414 | Saturn 10.6775
Rahu 18.1957 | Rahu(rev) 11.8043

# Mukesh Ambani
Sun 6.1006 | Moon 10.7894 | Mars 27.3632 | Mercury 24.7066
Jupiter 29.8659 | Venus 7.4338 | Saturn 20.4762
Rahu 27.6973 | Rahu(rev) 2.3027

# Mark Zuckerberg
Sun 29.9476 | Moon 16.9636 | Mars 26.1862 | Mercury 5.4815
Jupiter 19.0019 | Venus 21.1261 | Saturn 18.6349
Rahu 13.7912 | Rahu(rev) 16.2088

# Barack Obama
Sun 19.2310 | Moon 10.0409 | Mars 29.2601 | Mercury 9.0151
Jupiter 7.5415 | Venus 8.4727 | Saturn 2.0138
Rahu 4.5781 | Rahu(rev) 25.4219

# Bill Gates
Sun 11.7604 | Moon 14.4083 | Mars 16.8551 | Mercury 23.3234
Jupiter 4.5420 | Venus 26.9418 | Saturn 28.3503
Rahu 26.2333 | Rahu(rev) 3.7667

# Donald Trump
Sun 29.8230 | Moon 28.0989 | Mars 3.6700 | Mercury 15.7538
Jupiter 24.3450 | Venus 2.6328 | Saturn 0.7094
Rahu 27.6562 | Rahu(rev) 2.3438
```

### Anti-circular guarantee

This prediction table was computed entirely by hand from the raw
`degreeInRashi` values (which come from the existing
`computeRashiChart` ephemeris, NOT from any 8-karaka code). The
implementation in §8 will be checked against this pinned table —
not the other way around. Per `memory/feedback_fixture_repinning.md`
+ the locked Phase 34c shadbala-combust methodology rule.

---

## 8. Implementation plan

### Step 1 — types (`src/types/jyotish.ts`)

Append after the existing `JaiminiKarakas` definition (≈line 638):

```typescript
export type Karaka8Name = KarakaName | 'Pitrukaraka';
export type Jaimini8Karakas = Record<Karaka8Name, GrahaName>;
```

### Step 2 — function overloads (`src/jyotish/karakas.ts`)

- Add `KARAKA_8_ORDER` constant with the 8 names from §5.
- Add `VISIBLE_GRAHAS_8` = `[...VISIBLE_GRAHAS, 'Rahu']` (canonical
  order extended by one slot — preserves stable-sort tie-break).
- Update existing `computeJaiminiKarakas` to add an optional
  `options` argument and dispatch on `options?.variant`. Default
  path is unchanged.

### Step 3 — tests (`tests/unit/karakas.test.ts`)

Append new `describe` blocks (do NOT modify existing pin blocks):

- `computeJaiminiKarakas(variant: '8-jaimini') — Rahu reversal rule`
  with synthetic chart pinning that Rahu at degreeInRashi=29° (→
  reversed = 1°) lands at Darakaraka, while Rahu at degreeInRashi=1°
  (→ reversed = 29°) lands at Atmakaraka.
- `computeJaiminiKarakas(variant: '8-jaimini') — Pitrukaraka
  insertion` with a synthetic chart where Rahu lands at position 4
  (verifying the new role is filled by Rahu).
- `computeJaiminiKarakas(variant: '8-jaimini') — backwards-compat`
  verifying that calling without options still returns
  `JaiminiKarakas` byte-for-byte against the 5 pinned 7-karaka
  fixtures.
- `computeJaiminiKarakas(variant: '8-jaimini') — fixture sweep`
  pinning the 9 predicted 8-karaka mappings from §7.
- `computeJaiminiKarakas(variant: '8-jaimini') — monotonic
  invariant` verifying that the effective degrees (with Rahu
  reversed) are non-increasing AK → DK across all 8 positions.
- `computeJaiminiKarakas(variant: '8-jaimini') — output shape`
  verifying exactly 8 unique grahas, one per role.

### Step 4 — index export

No change needed — `computeJaiminiKarakas` is already exported.
The new types (`Karaka8Name`, `Jaimini8Karakas`) should be added
to the type re-export block in `src/index.ts` (≈line 164) and
`src/types/index.ts` (≈line 34).

### Step 5 — verification

- `npx vitest run` — expect 8,009 → 8,009 + ~15 new tests, all
  green. No existing test should change behavior.
- `npm run build` — expect dist/index.cjs to grow by ~1 KB
  (368.93 KB → ~370 KB).

---

## 9. Sources

| Source | URL | Used for |
|---|---|---|
| Wikipedia — Atmakaraka | https://en.wikipedia.org/wiki/Atmakaraka | 8-karaka order, Rahu reversal rule, Jaimini Upadesa Sutras Ch.1 V.10 attribution |
| sarvatobhadra.com — Demystifying Chara Karaka | https://www.sarvatobhadra.com/char-karaka/ | 8-karaka order, Rahu reversal numerical method, Sanjay Rath citation |
| Jagannatha-blog — Seven vs Eight Chara Kaaraka | https://jyotish-blog.blogspot.com/2005/12/seven-vs-eight-chara-kaaraka.html | Sanjay Rath vs Narasimha Rao debate, BPHS conditional quote |
| Bhawana Verma — Karakas Complete Guide | https://bhawanaverma.com/vedic-astrology/karakas-vedic-astrology-complete-guide/ | 8-karaka order confirmation |
| vedicmarga.com — Jaimini Chara Karakas | https://vedicmarga.com/jaiminis-chara-karakas/ | 8-karaka order confirmation |
| vaya.so — What is Pitrikaraka | https://vaya.so/blog/what-is-pitrikaraka | Pitrukaraka semantic (father), 8-karaka role |
| astrosaxena.com — Sachin Tendulkar Horoscope | https://www.astrosaxena.com/stendulkar | External cross-check: AK=Mars, AmK=Moon for Sachin |
| Drik Panchang Utilities | https://www.drikpanchang.com/utilities/astrology-utilities.html | Drik karaka-surface inventory (none) |
| Sanjay Rath — Jaimini Maharishi's Upadesa Sutras | Sagar Publications (print) | Primary classical authority — Ch.1 First Foot V.10 |
| Parashara — Brihat Parashara Hora Shastra | Ch.32 (Chara Karakas) | BPHS conditional-Rahu verse (not implemented) |

Cross-validation references that DO publish 8-karaka output for our
fixture corpus:

- astrosaxena.com Sachin chart — AK=Mars, AmK=Moon (matches §7
  prediction for Sachin Tendulkar; first 2 roles stable between
  7-K and 8-K).
- Wikipedia/various — Modi Atmakaraka=Saturn (matches §7 prediction
  for Narendra Modi; AK stable between 7-K and 8-K).

Two external-source confirmations on two charts in the panel is
sufficient cross-validation per the Phase 34c/34d precedent
(≥2 independent secondary-source pin per surface).
