# Phase 34a — Drik Panchang / Pandit Reference Research

Research date: 2026-05-11. Reference order: drik panchang (primary), ProKerala / AstroSage / multi-pandit consensus (secondary), classical BPHS (tertiary).

## 1. Mangal Dosha (Manglik)

### Drik panchang's published algorithm

Source: `drikpanchang.com/jyotisha/mangal-dosha/mangal-dosha-calculator.html`

> "Mangal Dosha should be checked not only in Lagna chart but also in Moon chart and Venus chart. A person is Non-Manglik only if none of the three charts is afflicted by Mars."

> "Mars positioned in first, second, fourth, seventh, eighth or twelfth house in a Kundali creates Mangal Dosha."

> "Drik Panchang considers the most widely accepted rules which cancel Mangal Dosha."

The page does **not** enumerate the cancellation rules explicitly. They are inferred from corroborating sources (multiple pandit blogs that explicitly cite "drik panchang's rule set").

### Cancellations applied by drik panchang + multi-pandit consensus

1. Mars in own sign (Aries / Scorpio).
2. Mars exalted (Capricorn).
3. Mars conjunct Jupiter (same house).
4. Mars conjunct Moon (same house).
5. Mars conjunct Venus (same house) — "Venus conjunct Mars softens its harshness" (multiple sources). **This is the key one that makes Mars–Venus conjunction self-cancel even though it trips the Venus-chart check.**
6. Mars aspected by Jupiter (5th / 7th / 9th sign-aspect).
7. Mars conjunct Rahu — cited by some pandits, not universal. **Deferred.**
8. Mutual mangalik (both partners) — not a chart-only rule, **not applied** here.

### Implication for our code

The pre-Phase-34 fix removed Venus chart entirely. Research shows drik panchang **does** use Venus chart. Correct fix: **restore Venus reference AND add Mars-Venus conjunction as a cancellation**. The Mars-Venus conjunction case (which always trips house 1 from Venus) then cancels itself — net result matches drik panchang.

### Verification chart — Person 1 (Agra, 30/07/1998, 23:56 IST)

| Reference | Mars house | Flagged? |
|---|---|---|
| from Lagna (Mesha) | 3 | no |
| from Moon (Tula) | 9 | no |
| from Venus (Mithuna) | 1 | **yes — but Mars-Venus conjunction cancels** |

Final: **not Manglik** — matches drik panchang and the pandits the user consulted.

### Verification chart — Person 2 (Shahjahanpur, 15/10/1995, 09:43 IST)

| Reference | Mars house | Flagged? |
|---|---|---|
| from Lagna (Vrischika) | 1 | yes — cancelled by Mars own sign + Mars conjunct Jupiter |
| from Moon (Mithuna) | 6 | no |
| from Venus (Tula) | 2 | yes — cancelled by Mars own sign + Mars conjunct Jupiter |

Final: **not Manglik** — matches the pandits' verdict (cited Jupiter-in-Lagna nullification).

## 2. Sade Sati

### Drik panchang's published algorithm

Source: `drikpanchang.com/jyotisha/sadesati/shani-sadesati-analysis.html`

> "Shani not only influences the Rashi in which it is positioned but also affects the preceding and following Rashi. In this way, Shani delivers auspicious and inauspicious results over a period of seven and a half years."

> "Whether Sadesati proves auspicious or inauspicious depends entirely on Shani's position in one's Janma Kundali."

The calculator labels active phases (12th / 1st / 2nd from natal Moon) and reports start/end dates. **It does NOT surface any cancellation, mitigation, or "broken dosha" condition.** The "whether auspicious or inauspicious" line is qualitative narrative, not algorithmic.

### Implication for our code

Our current `computeSadeSati` reports `active`, `phase`, and date boundaries with no cancellation logic. **This is aligned with drik panchang.** No code change needed; add a doc comment locking this as the intended reference behavior.

## 3. Kaal Sarp Dosha

### Drik panchang's published algorithm

Sources:
- `drikpanchang.com/jyotisha/kalasarpa-yoga/info/kalasarpa-yoga.html`
- `drikpanchang.com/jyotisha/kalasarpa-yoga/kalasarpa-yoga-calculator.html`

> "All seven planets are located at one side of the Rahu-Ketu axis."

> "Kalasarpa Dosha is divided into twelve categories such as Ananta, Kulika, Vasuki, Shankhapala …" (full list 1–12 by Rahu's house position).

> "As partial Kaal Sarpa Dosha is not widely accepted, Drik Panchang does not list them."

The calculator does NOT distinguish reverse / Kalamrut directionality. It reports one of 12 subtypes when all 7 grahas are on one side; otherwise nothing.

### Implication for our code

Our `computeKaalSarp` correctly reports the 12 subtypes via `KAAL_SARP_BY_RAHU_HOUSE`. It also returns `partial: boolean` which is **true** when exactly 1 planet sits outside the arc. Drik panchang does not surface partial. The `partial` flag never makes `afflicted: true`, so the final affliction verdict is already aligned — `partial` is informational extra.

**Action:** Add a doc comment noting that `partial` is informational-only and not part of drik panchang's output; the canonical `afflicted` flag matches drik panchang's behavior. No code change.

## 4. Pitru Dosha

### Drik panchang's algorithm

Drik panchang **does not have a Pitru Dosha calculator**. Reference must come from multi-pandit consensus.

### Multi-pandit consensus (ProKerala / AstroNidan / AstroSage / Vinay Bajrangi)

Most-cited Pitru Dosha trigger combinations:

| # | Rule | Sources |
|---|------|---------|
| A | Sun + Rahu conjunction (same house, any house) | universal |
| B | Sun + Ketu conjunction (same house, any house) | very common |
| C | Sun + Saturn conjunction in 9th | classical |
| D | Sun + Saturn conjunction (any house, with malefic context) | common |
| E | Sun in 9th house (afflicted by malefic) — 9th = pitru bhava | very common |
| F | Rahu in 9th house | very common |
| G | Ketu in 4th house | cited (matri/pitri axis) |
| H | 9th lord conjunct Rahu or Saturn | classical BPHS Ch. 37 |
| I | 9th lord in dusthana (6 / 8 / 12) | classical BPHS Ch. 37 |
| J | Debilitated Sun in 9th | classical |

### Implication for our code

Current `computePitruDosha` covers only A, B, and C. The audit / user feedback both surface this as too narrow. **Expand to rules A–I.** Rule J ("debilitated Sun in 9th") is double-counted by E once "afflicted by malefic" is dropped, so we use E without the malefic constraint and skip J.

We need rashi-lord lookup (9th house's rashi → lord planet) — that's already in `matchingTables.RASHI_LORD`. We need the 9th house's rashi from the chart's bhava data.

## 5. Anshik (Angshik) vs Purna Manglik

### Reference

Source: AstroSage's Mangal Dosha report — the only mainstream calculator that publishes a clean rule:

> "If Mars is placed in 1st, 2nd, 4th, 7th, 8th or 12th houses from Natal Chart, Moon Chart and Venus Chart, then it will be considered as **High Manglik Dosha**."

> "If Mars is placed in 1st, 2nd, 4th, 7th, 8th or 12th houses from any one of these three charts like Natal Chart, Moon Chart and Venus Chart, then it will be considered as **Low Manglik Dosha or 'Partial Manglik Dosha'**."

Multiple pandit blogs corroborate the count-based interpretation: 3-of-3 = Purna, 1-or-2-of-3 = Anshik, 0-of-3 = none. The severity is independent of cancellations — a chart can be `severity: 'anshik'` but `afflicted: false` when cancellations apply.

### Implication for our code

Added `MangalDoshaSeverity = 'none' | 'anshik' | 'purna'` and a `severity` field on `MangalDoshaInfo`. Computed from raw per-chart flags (pre-cancellation count). API addition is purely additive.

### Verification

| Chart | Lagna | Moon | Venus | Severity | Afflicted | Notes |
|---|---|---|---|---|---|---|
| Person 1 — Agra | clean | clean | flagged (Mars in 1st from Venus) | `anshik` | `false` | Mars–Venus conjunction cancellation |
| Person 2 — Shahjahanpur | flagged (house 1) | clean | flagged (house 2) | `anshik` | `false` | Mars own sign + Mars conjunct Jupiter |

Person 2's `severity: 'anshik'` matches the user's claim ("this one is manglik per pandits but nullified") — pandits use the Anshik label for partial-chart flags exactly as our severity field surfaces.

## Summary of code changes for Phase 34a

| Module | Change | Severity |
|---|---|---|
| `computeMangalDosha` | Restore Venus chart reference; add Mars-Venus conjunction cancellation; add `severity: 'none' \| 'anshik' \| 'purna'` field. | Behavioral — final verdicts on both verification charts unchanged. API additions: `fromVenus` and `severity` on `MangalDoshaInfo`; new exported type `MangalDoshaSeverity`. |
| `computeSadeSati` | Doc comment only — current behavior aligned with drik panchang. | None. |
| `computeKaalSarp` | Doc comment only — `partial` flag clarified as informational. | None. |
| `computePitruDosha` | Expand from 3 rules to 9 (A–I above). | Behavioral — more charts will flag Pitru Dosha. |

All changes ship as one minor on top of the current `package.json` `4.0.0` (user assigns the specific release tag). The Manglik fix earlier in this session was a flawed first pass (over-corrected by removing Venus entirely); this is the correct version.
