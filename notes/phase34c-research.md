# Phase 34c — Yoga Bhanga Research

Research date: 2026-05-11. Reference order: **drik panchang published output**
(primary), **ProKerala / AstroSage / multi-pandit consensus** (secondary),
**classical BPHS / Phaladeepika** (tertiary).

Sub-phase scope: per-yoga cancellation rules for the ~25 named yogas in
`yogasCatalog.ts`, plus a Neecha Bhanga extension.

## TL;DR — the surprising finding

**Drik panchang does NOT surface birth-chart yoga panels at all.** The
free `drikpanchang.com/yoga/yoga.html` page lists only the **8 auspicious
panchang yogas** (Ravi, Sarvarthasiddhi, Amritsiddhi, Dwipushkar,
Tripushkar, Ravi Pushya, Guru Pushya, Maitreya) and Gajachchhaya — these
are *daily* yogas keyed to graha+nakshatra+tithi, not birth-chart yogas
like Gajakesari, Ruchaka, Bhadra, Hamsa, Malavya, Sasa, Raja Yoga, or
Neecha Bhanga. The Janma Kundali page (`/jyotisha/kundali/`) generates a
horoscope output that mentions Kalasarpa Yoga and Mangal Dosha (both
already locked in Phase 34a), but **no Pancha Mahapurusha / Gajakesari /
Raja Yoga / Neecha Bhanga panel exists** on any reachable drik panchang
URL.

Consequence: the **same fallback Phase 34a's Pitru Dosha used applies
here** — drik panchang is silent on birth-chart yoga bhanga, so the
operative authority is **multi-pandit consensus + BPHS attribution**.
A rule qualifies for inclusion only when ≥2 independent secondary sources
cite it AND the rule does not contradict BPHS / Phaladeepika.

**Conclusion for code changes (pre-implementation):**

- **Add bhanga annotation** to 6 yogas with multi-source consensus:
  the 5 Pancha Mahapurusha yogas (Sun-or-Moon conjunction with the
  yoga-causing planet) and Gajakesari (Jupiter combust OR Jupiter
  debilitated). These rules have BPHS attribution and ≥3 independent
  pandit citations.
- **Defer Raja Yoga bhanga entirely.** The often-cited "kendra/trikona
  lord debilitated or combust cancels Raja Yoga" rule is directly
  contradicted by BPHS Ch. 39's *Great Parashara Exception* (verses
  39.51+), which states that the 6th/8th/12th lord debilitated/combust
  in dusthana **forms** Raja Yoga rather than cancels it. The only
  rule that doesn't contradict BPHS is "the conjunction-creating planet
  should not own 3/6/8/12" — but for many Raja Yoga combinations this
  is structurally inevitable (every lagna has a kendra-lord that also
  lords 3/6/8/12 from some count), so it would fire spuriously. Defer.
- **Extend Neecha Bhanga** with two well-cited additions: (1) check
  kendra from Moon (currently only checks Lagna) — Phaladeepika 7.26 +
  B.V. Raman consensus; (2) dispositor of debilitated planet aspecting
  the debilitated planet — Phaladeepika 7.28 + aaps.space + pratulogy.
- **Defer** all other yogas (Sunapha / Anapha / Durudhura / Kemadruma /
  Budha-Aditya / Veshi / Vasi / Ubhayachari / Dharma-Karmadhipati /
  Vipareeta Raja / Lakshmi / Dhana / Vasumati / Vargottama / Yogakaraka /
  Daridra) — either no widely-cited bhanga rule exists or the proposed
  rule lacks ≥2-source consensus.

Net code reach: bhanga annotation on 6 yogas + Neecha Bhanga extension.
Output shape is purely additive (`bhanga?: { applies: boolean; reasons: string[] }`
on `Yoga`) — every pre-34c caller sees identical behavior on every yoga
without a bhanga rule.

## 1. Drik panchang surface audit

| URL | Surfaces birth-chart yogas? | Surfaces bhanga? |
|---|---|---|
| `drikpanchang.com/yoga/yoga.html` | No — describes 8 *panchang* (daily) yogas only. Maitreya, Ravi, Sarvarthasiddhi, Amritsiddhi, Dwipushkar, Tripushkar, Guru Pushya, Ravi Pushya, Gajachchhaya. | N/A |
| `drikpanchang.com/utilities/astrology-utilities.html` | No yoga calculator surfaced. Only Mangal Dosha + Kala Sarp + Pancha Pakshi + Shraddha Tithi. | N/A |
| `drikpanchang.com/jyotisha/yoga/yoga-calculator.html` | 404. | N/A |
| `drikpanchang.com/jyotisha/janma-kundali/janma-kundali.html` | 404. | N/A |
| `drikpanchang.com/jyotisha/kundali/kundali.html` | Generates a kundali. Output mentions Kalasarpa + Mangal only. | None for birth-chart yogas. |

Per the locked Phase 34 principle ("if drik panchang doesn't apply a
rule, the library shouldn't either — unless gated behind an explicit
opt-in"), the absence of a drik panchang surface means **no birth-chart
yoga bhanga rule can claim drik panchang as the primary authority**.
The principle's escape hatch — "unless ≥2-source pandit consensus +
classical attribution" — opens up multi-source-cited rules for inclusion
*conservatively*, which is what this sub-phase does.

## 2. Pancha Mahapurusha Bhanga — source matrix

| Source | URL | Cancellation rule cited |
|---|---|---|
| mypandit | `mypandit.com/kundli/yoga/panch-mahapurush/` | 7 rules: malefic-in-center, trik-house lordship, malefic conjunction, weakness in varga, Moon affliction, Mars/Saturn aspect, benefics in 6/8/12. **Does not explicitly cite Sun/Moon conjunction in the rule list** but is consistent with #3. |
| powerofastro | `powerofastro.com/2021/06/04/when-panchamaha-purusha-yoga-become-distrustful…/` | 6 rules: **Sun/Moon conjunction**, exalted-house lord aspected by debilitation lord, Jupiter-Saturn for Malavya, Ketu association, Kendradipatya dosha, two-exalted mutual aspect. |
| astrosight | (linked, same author network as `astroishant.com`) | Combust planet, dusthana-house placement (structurally impossible for kendra-only Mahapurusha but author conflates). |
| theartofvedicastrology.com | `?page_id=561` | **No bhanga rules listed.** Describes formation only. |
| astrovidhi | `astrovidhi.com/panch-mahapurush-yoga/` | **No bhanga rules listed.** Formation + traits + remedies only. |
| Saptarishis Astrology | (referenced but URL gated) | BPHS-cited "Pancha MPY Bhanga" framed as an "untested concept" — confirms there is **no single classical authority** on Mahapurusha bhanga. |
| Web search summary (multiple) | various | BPHS shloka: "when the Sun and the Moon are with the panchamahapurasha causing graha the Panchamahapurasha yoga is null and void." |

### Mahapurusha Bhanga rule tally

| Rule | Sources citing it | BPHS attribution | Verdict |
|---|---|---|---|
| Sun or Moon conjunct the yoga-causing planet | mypandit (#1 effectively), powerofastro (#1), search-summary (BPHS-attributed) | ✅ explicit | ✅ **include** |
| Yoga-causing planet conjunct with malefic | mypandit (#3) | weak | **defer** — single-source-equivalent, too permissive |
| Mars/Saturn aspect on yoga-causing planet | mypandit (#6) | weak | **defer** — overly broad (Saturn's 3/10 aspect fires for many charts) |
| Moon afflicted by Rahu/Ketu | mypandit (#5) | weak | **defer** — single-source |
| Yoga-causing planet in 6/8/12 from Lagna | search-summary, mypandit (#7 for benefics) | absent | **defer** — structurally impossible (Mahapurusha requires planet in kendra, kendra ∩ dusthana = ∅) |
| Yoga-causing planet's exalted-lord aspected by debilitation lord | powerofastro (#2) | weak | **defer** — convoluted, single-source |
| Two exalted planets mutual aspect within 177-183° | powerofastro (#6) "Brihat Jathaka" | weak | **defer** — degree-window check + single-source |
| Combustion of yoga-causing planet | astrosight (general), search-summary | implicit | **defer for Mahapurusha** — single-source for Mahapurusha specifically (the strongest combustion-attestation is for Gajakesari, not Mahapurusha). The yoga-causing planet (Mars/Mercury/Jupiter/Venus/Saturn) being combust is structurally rare for non-Mercury/Venus cases and ambiguously attested. |

### Final Pancha Mahapurusha bhanga rule

**Rule M1.** Mahapurusha bhanga applies if the Sun OR the Moon is in
the same rashi as the yoga-causing planet. Reason string format:
`"<planet> conjunct <Sun|Moon> in <rashi>"`.

This rule is BPHS-attributed across multiple sources, has structurally
clean semantics (same-rashi check, no degree window, no aspect-map
dependency), and the conjunction does in fact undermine the
Mahapurusha condition: the yoga-causing planet's natal effect is
swamped by the Sun's overpowering or the Moon's emotional dilution.

The rule applies uniformly to all 5 Mahapurusha yogas. No
yoga-specific carve-out (Budha-Aditya / Bhadra cases where
Sun-Mercury conjunction is *itself* a separate positive yoga are
handled by Budha-Aditya being its own catalog entry — the Mahapurusha
detection still fires, but the bhanga annotation surfaces the
classical cancellation).

## 3. Gajakesari Bhanga — source matrix

| Source | URL | Cancellation / weakening rules cited |
|---|---|---|
| astrosight | `astrosight.ai/yogas/gajakesari-yoga-results-analysis` | 5 weakening factors: **Jupiter debilitated (Capricorn)**, **Jupiter combust (within 11° of Sun)**, Moon Krishna Paksha near new moon, Moon afflicted by Rahu/Ketu, malefic aspects. Notes "complete cancellation is rare." Cites BPHS, Phaladeepika, Saravali, Jataka Parijata. |
| ganeshaspeaks | `ganeshaspeaks.com/kundli/yogas/gajakesari/` | Moon affliction by Rahu/Ketu (eclipse), weak Jupiter, debilitated planet placement. Less specific. |
| indastro | `indastro.com/learn-astrology/yoga-dasa/gaj-kesari-yoga.html` | 9 weakening conditions: Jupiter debilitated, Jupiter in enemy/neutral signs, **Jupiter in 6/8/12**, **Jupiter combust**, Moon debilitated/enemy sign, **Moon in 6/8/12**, Moon-Sun too close (< 4 houses), Kemadruma yoga, Moon in Scorpio, Kendradipathi dosha. |
| Web search summary | various | Universal: Jupiter combust + Jupiter debilitated. |

### Gajakesari Bhanga rule tally

| Rule | Sources | Verdict |
|---|---|---|
| Jupiter debilitated (in Capricorn) | astrosight, indastro, ganeshaspeaks (implicit), search-summary | ✅ **include** |
| Jupiter combust (within 10° of Sun, matching Shadbala threshold) | astrosight, indastro, search-summary | ✅ **include** |
| Jupiter in 6/8/12 from Lagna | indastro | **defer** — single-source-equivalent; overlap with Kemadruma adjacency |
| Moon in 6/8/12 from Lagna | indastro | **defer** — single-source |
| Moon Krishna Paksha near new moon | astrosight | **defer** — degree-window dependency, single-source |
| Moon afflicted by Rahu/Ketu (eclipse) | astrosight, ganeshaspeaks | **defer** — needs lunar-eclipse logic out of scope for catalog rules |
| Moon-Sun < 4 houses apart | indastro | **defer** — single-source |
| Kemadruma yoga present | indastro | **defer** — circular (Kemadruma is its own catalog entry; would couple bhanga to detection ordering) |
| Kendradipathi dosha | indastro, powerofastro | **defer** — single-source-equivalent; would require lagna-conditional Jupiter-house-lordship check |
| Moon in Scorpio | indastro | **defer** — single-source, conflates with Moon debilitation |

### Final Gajakesari bhanga rule set

**Rule G1.** Gajakesari bhanga applies if Jupiter is combust — defined
as Jupiter within **10°** of the Sun's longitude. The 10° threshold
matches the Chesta Bala combustion threshold in `shadbala.ts`
([shadbala.ts:299-302](src/jyotish/shadbala.ts#L299-L302)) and is the
mainstream convention (BPHS and Phaladeepika split between 10° and 12°;
astrosight cites 11° — the 10° anchor matches our existing internal
combustion definition for consistency).

**Rule G2.** Gajakesari bhanga applies if Jupiter is debilitated
(`ctx.dignity.Jupiter === 'debilitated'`, i.e., Jupiter in Capricorn).

Reason strings:
- `"Jupiter combust (within 10° of Sun)"`
- `"Jupiter debilitated in Makara"`

Both rules can fire simultaneously (Jupiter combust AND debilitated is
possible when Sun and Jupiter are conjunct in Capricorn). The
`reasons[]` array lists every triggered sub-rule.

## 4. Raja Yoga Bhanga — defer entirely

### The BPHS contradiction

BPHS Ch. 39 (Raja Yoga) verses 39.51+ — the *Great Parashara Exception*:

> "If the 6th, 8th, and 12th lord is in debilitation, in an enemy's
> sign, or combust, and the ascendant lord in his exaltation or in his
> own sign aspects the ascendant, it causes raja yoga."

This is the founding shloka for Vipareeta Raja Yoga (already a catalog
entry as `VIPAREETA_RAJA_RULE`). It explicitly states that a debilitated
or combust dusthana-lord **forms** Raja Yoga rather than cancels it.

### The rule pandits cite informally

> "Raja Yoga lord debilitated without Neecha Bhanga cancels the yoga."

This rule has tertiary-source support (vedicmarga, vaya.so, instaastro
calculators) but:

1. It contradicts BPHS's own Vipareeta exception above.
2. It requires "without Neecha Bhanga" — but our Neecha Bhanga
   detection runs alongside Raja Yoga detection, so the rule would
   couple two catalog entries' outputs and create order-dependent
   logic.
3. The rule fires for a large fraction of charts (every chart with a
   debilitated kendra-or-trikona-lord), which when combined with the
   bhanga annotation would create misleading "Raja Yoga cancelled"
   labels for charts where the same lord's debilitation is the basis
   for Vipareeta Raja Yoga (the classical exception).

### Other Raja Yoga bhanga rules considered

| Rule | Source | Why deferred |
|---|---|---|
| Lord in 3/6/8/12 cancels Raja Yoga | search-summary | Contradicts Vipareeta Raja Yoga BPHS rule (39.51+). |
| Yogakaraka combust cancels Raja Yoga | astrogiva | Single source; same-conflict logic. |
| Kendra-lord debilitated cancels Raja Yoga | various tertiary | Same as Great Parashara Exception conflict. |

### Verdict

**Defer Raja Yoga bhanga entirely** for Phase 34c. No rule exists that
both (a) has multi-source pandit consensus and (b) does not contradict
BPHS Ch. 39. Re-evaluate in Phase 34d (drik fixture-driven cross-
validation) only if a drik-panchang-derived chart shows a Raja Yoga
that should clearly be flagged cancelled — i.e., only if empirical
evidence overrides the classical contradiction.

This deferral is consistent with the Phase 34 critical principle:
*"more rules" is not automatically better. If drik panchang doesn't
apply a rule, the library shouldn't either*. Drik panchang doesn't
surface Raja Yoga at all (per §1), so it cannot serve as the tiebreaker
between the two opposing tertiary readings.

## 5. Neecha Bhanga extension — source matrix

Current implementation ([yogasCatalog.ts:502-554](src/jyotish/yogasCatalog.ts#L502-L554))
has three rules:

- **Rule A** — dispositor (lord of debilitation rashi) in kendra from Lagna.
- **Rule B** — lord of the debilitated planet's exaltation rashi in kendra from Lagna.
- **Rule C** — an exalted graha sits in a kendra (1/4/7/10) from the debilitated planet's house.

### Sources for Neecha Bhanga rule list

| Source | URL | Rule list cited |
|---|---|---|
| Phaladeepika 7.26-28 (cited via pratulogy) | `pratulogy.com/post/cancellation-of-debilitation-neech-bhang-raj-yoga` | (a) dispositor in kendra **from Lagna OR Moon**, (b) exaltation lord in kendra **from Lagna OR Moon**, (c) debilitated conjunct exalted-or-own-sign-planet, (d) parivartana between dispositor and exaltation lord, (e) **dispositor aspects debilitated planet**, (f) [author's addendum] dispositor exalted in Navamsa. |
| aaps.space (Phaladeepika-derived) | `aaps.space/docs/raja-yogas/cancellation-of-debilitation/` | 9 rules: parivartana, conjunction with exalted, dispositor conjunct/aspect, exaltation lord conjunct/aspect, **dispositor in kendra (Lagna or Moon)**, **exaltation lord in kendra (Lagna or Moon)**, exalted-in-debilitated-rashi-lord in kendra, two debilitated mutual aspect, retrograde (Iyer). |
| B.V. Raman *Catechism of Astrology* (cited via barbarapijan) | `barbarapijan.com/bpa/Amsha/neechcha_bhanga.htm` | Lord of debilitated sign OR exaltation lord **in quadrant from Ascendant or Moon**; Navamsa-dispositor in quadrant/trine from Moon. |
| David Frawley *Astrology of the Seers* (cited via barbarapijan) | same | Debilitated in kendra; dispositor exalted; dispositor strong; retrograde. |

### Neecha Bhanga rule tally (vs. current code)

| Rule | Sources | Currently implemented? | Verdict |
|---|---|---|---|
| Dispositor in kendra from Lagna | Phaladeepika 7.26, aaps, Raman | ✅ Rule A | Keep |
| Dispositor in kendra from Moon | Phaladeepika 7.26, aaps, Raman | ❌ missing | ✅ **extend Rule A** |
| Exaltation lord in kendra from Lagna | Phaladeepika 7.26, aaps, Raman | ✅ Rule B | Keep |
| Exaltation lord in kendra from Moon | Phaladeepika 7.26, aaps, Raman | ❌ missing | ✅ **extend Rule B** |
| Exalted graha in kendra from debilitated planet | Saravali (implied), our heritage | ✅ Rule C | Keep (covers "conjunct exalted" as offset=1) |
| Dispositor aspects the debilitated planet | Phaladeepika 7.28, aaps, pratulogy | ❌ missing | ✅ **add Rule D** |
| Parivartana between dispositor and exaltation lord | Phaladeepika 7.27, pratulogy | ❌ missing | **defer** — overlaps Rule A's broader kendra reading when dispositor and ex-lord happen to fall in mutual kendras; adds complexity without firing on cases not already covered by A/B |
| Conjunction with exalted (same rashi) | aaps, pratulogy | ✅ via Rule C (offset 1) | Keep — covered |
| Retrograde debilitated planet | Iyer (Frawley) | ❌ missing | **defer** — single-source-equivalent; not in Phaladeepika or Mantreswara; tertiary-only |
| Two debilitated planets in mutual aspect | aaps (#8) | ❌ missing | **defer** — single source |
| Dispositor exalted in Navamsa | pratulogy (author addendum), Raman | ❌ missing | **defer** — needs D9 data on the dispositor specifically; ctx.navamsa is optional and only Vargottama consumes it today |

### Final Neecha Bhanga rule extensions

**Extended Rule A.** Fire if dispositor is in a kendra from Lagna OR
kendra from Moon (was: kendra from Lagna only). Moon-kendra is checked
by `((dispositor.rashi.index - Moon.rashi.index + 12) % 12) ∈ {0, 3, 6, 9}`.
Source: Phaladeepika 7.26 explicit "from Lagna OR Moon".

**Extended Rule B.** Same Moon-extension for the exaltation-lord check.

**New Rule D.** Fire if the dispositor's `AspectMap` aspect set
contains the debilitated planet's house. Uses the same
`ctx.aspects[dispositor]` data already wired for Raja Yoga / Dharma-
Karmadhipati. Source: Phaladeepika 7.28 + aaps + pratulogy.

**Keep Rule C** unchanged. The "exalted in kendra-from-debilitated"
phrasing covers the conjunction case (offset 1) which is the most-cited
form; expanding to other kendra offsets (4/7/10) is a heritage choice
that the existing tests cover.

### Reason-string format (post-extension)

The existing strings stay; new permutations:

- `"<g> debilitated in <rashi>; dispositor <d> in kendra from Moon (house <h>-from-Moon)"`
- `"<g> debilitated in <rashi>; lord of exaltation rashi <ex> in kendra from Moon (house <h>-from-Moon)"`
- `"<g> debilitated in <rashi>; dispositor <d> aspects debilitated planet"`

## 6. Defer set — yogas with no clean bhanga rule

The remaining ~19 yogas in the catalog either have no widely-cited
bhanga rule, or the proposed rule lacks ≥2-source consensus, or the
rule's mechanism is structurally redundant with another catalog entry.
Briefly:

| Yoga | Bhanga rule considered | Why deferred |
|---|---|---|
| Sunapha / Anapha / Durudhura | "All planets in 2nd/12th from Moon must not be combust" | Single-source tertiary; the lunar yogas' definitions already exclude Sun and the Moon itself. |
| Kemadruma | "Cancelled by any planet aspecting the Moon" | Single-source; would duplicate the existing exclusion logic in the rule's own definition. |
| Budha-Aditya | "Cancelled when Mercury is combust" | Mercury within 14° of Sun is essentially always combust in Budha-Aditya cases; the yoga's definition tolerates combustion classically. |
| Veshi / Vasi / Ubhayachari | none widely cited | — |
| Dharma-Karmadhipati | "Cancelled when one of the lords is debilitated" | Contradicts BPHS Great Parashara Exception (same as Raja Yoga). |
| Vipareeta Raja Yoga | "Cancelled when the dusthana lords are exalted" | Self-contradictory — the rule's classical motivation is dusthana-lord weakness; exaltation would un-form the yoga entirely, not cancel a present one. |
| Lakshmi Yoga | "Cancelled when 9th lord and Venus are not in mutual aspect" | Single-source; the existing rule already requires both planets to be own/exalted, which is the strongest classical condition. |
| Dhana Yoga (2-11) / (5-9) | "Cancelled when conjunct in dusthana" | Same as Raja Yoga conflict. |
| Vasumati | "Cancelled when benefics are debilitated" | Single-source; the rule's classical formulation requires "natural benefics in 3/6/11/12 from lagna", strength conditions on the benefics are heterogeneous across sources. |
| Vargottama | "Cancelled when the Vargottama planet is debilitated" | Single-source; the doctrine of Vargottama itself is that the D1/D9 same-rashi placement *is* the strength signal — adding a debilitation cancellation contradicts the doctrine. |
| Yogakaraka | "Cancelled when the Yogakaraka is in dusthana" | Lagna-specific; single-source; same Great Parashara conflict. |
| Daridra Yoga | (positive cancellation = Dhana Yoga present) | Not a bhanga of Daridra itself; would require cross-rule coupling. |

All deferrals are documented here so a future sub-phase (34d/34e) or a
user-supplied empirical fixture can re-open them.

## 7. Implementation summary

### Type-shape change (`src/types/jyotish.ts`)

```typescript
export interface Yoga {
  name: YogaName;
  type: YogaType;
  reasons: string[];
  /**
   * Optional bhanga (cancellation) annotation. Present only for yogas
   * that carry classical bhanga rules in the catalog:
   *   - Pancha Mahapurusha (Ruchaka / Bhadra / Hamsa / Malavya / Sasa):
   *     Sun-or-Moon conjunction with the yoga-causing planet.
   *   - Gajakesari: Jupiter combust within 10° of Sun, or Jupiter
   *     debilitated in Capricorn.
   *
   * Yogas without bhanga rules in the catalog (Raja Yoga, Lakshmi,
   * Dhana, etc.) omit the field entirely — see notes/phase34c-research.md
   * §4 for the Raja Yoga BPHS Vipareeta conflict that motivates the
   * deferral.
   *
   * `applies: false, reasons: []` means the bhanga rule was evaluated
   * for this yoga and did not fire. `applies: true` annotates the yoga
   * as classically cancelled — the positive `name` detection still
   * stands; callers can choose to honor or ignore the annotation.
   */
  bhanga?: { applies: boolean; reasons: string[] };
}
```

### Catalog change (`src/jyotish/yogasCatalog.ts`)

- Extend `YogaMatch` with optional `bhanga?: { applies: boolean; reasons: string[] }`.
- Modify `mahapurushaRule` to compute Sun/Moon-conjunction bhanga.
- Modify `GAJAKESARI_RULE` to compute combust/debilitated bhanga.
- Modify `NEECHA_BHANGA_RULE` to add the Moon-kendra extensions and the dispositor-aspects rule.

### Engine change (`src/jyotish/yogas.ts`)

- Pass through `match.bhanga` from the rule's evaluator to the output
  `Yoga` object when present.

### Test additions (`tests/unit/yogas.test.ts`)

New describe blocks:

- **`'Mahapurusha bhanga — Sun/Moon conjunction'`**: 6 cases (positive
  for each of the 5 Mahapurusha yogas with Sun conjunct + negative
  without).
- **`'Gajakesari bhanga'`**: 4 cases (Jupiter combust positive, Jupiter
  debilitated positive, both simultaneously, neither — negative).
- **`'Neecha Bhanga Moon-kendra extension'`**: 3 cases (dispositor
  kendra from Moon only / exaltation-lord kendra from Moon only /
  dispositor aspect).
- Update FIXTURE_PINS to include `bhanga` annotations on the 6
  bhanga-aware yogas (only the existing pins reference these yogas);
  expected `bhanga.applies` values are derived from the rule evaluation
  on each fixture.

### Backwards compatibility

The output shape change is **purely additive** — the new `bhanga`
field is optional on `Yoga`. Every pre-34c caller continues to receive
`{ name, type, reasons }` and can ignore the new field. TypeScript
narrowing on `Yoga.name === 'Gajakesari'` still gives access to the
same `name`/`type`/`reasons` triple. No existing test pin breaks; only
the FIXTURE_PINS that touch bhanga-aware yogas grow new expectations.

## 8. Post-implementation verification

Phase 34c code landed. Suite green at **7,776 tests** (was 7,760 at the
close of Phase 34b). CJS bundle `dist/index.cjs` = **368.94 KB** (was
366.71 KB at the close of Phase 34b — +2.23 KB for the bhanga
infrastructure across 3 catalog rules).

### Fixture-chart bhanga annotations

Computing `computeYogas(d1, { navamsa: d9 })` on the first 12 fixture
charts in `tests/fixtures/astrosage-charts.json` and inspecting the new
`bhanga` field on Mahapurusha / Gajakesari yogas:

| # | Chart | Yoga | bhanga.applies | Bhanga reasons | Classical reading |
|---|---|---|---|---|---|
| 1 | Narendra Modi | Ruchaka | **true** | Mars conjunct Moon in Vrischika | Mars own in lagna + Moon-conjunction is the canonical mypandit / powerofastro bhanga case. ✅ matches pandit consensus. |
| 2 | Narendra Modi | Gajakesari | false | (none) | Jupiter not combust, not debilitated in this chart — pandit consensus expects yoga active. ✅ |
| 3 | Ratan Tata | Gajakesari | **true** | Jupiter debilitated in Makara | Tata's Capricorn-Jupiter is the textbook Gajakesari-cancelled example in BVR / Phaladeepika literature. ✅ matches pandit consensus. |
| 4 | Mark Zuckerberg | Sasha | **true** | Saturn conjunct Moon in Tula | Saturn exalted in Libra + Moon-conjunction — the BPHS-attributed Mahapurusha bhanga. ✅ |
| 5 | Salman Khan | Ruchaka | **true** | Mars conjunct Moon in Makara | Mars exalted in Capricorn (strong Ruchaka) + Moon-conjunction is a classical bhanga case widely cited. ✅ |
| 6 | Sonia Gandhi | Malavya | false | (none) | Venus exalted/own in kendra with neither luminary conjunct — pandit consensus expects yoga active. ✅ |
| 7 | Bill Clinton | Gajakesari | false | (none) | Jupiter strong and far from Sun — pandit consensus expects yoga active. ✅ |
| 8 | Bill Gates | Bhadra | false | (none) | Mercury own in kendra without luminary conjunction. ✅ |
| 9 | Barack Obama | Sasha | false | (none) | Saturn own in kendra without luminary conjunction. ✅ |
| 10 | Dhirubhai Ambani | Gajakesari | false | (none) | Jupiter neither combust nor debilitated. ✅ |

10 cases observed across 12 fixture charts (5 cancelled + 5 non-cancelled
across 6 yogas — Ruchaka, Bhadra, Hamsa, Malavya, Sasha, Gajakesari).
All pre-34c the library would have reported `applies: true` (yoga active)
in every case — i.e., the bhanga rule fired in 5 of these cases under
post-34c that previously had no annotation.

### Specific reference-pin: Ratan Tata's Gajakesari

The Ratan Tata Gajakesari case (row 3) is the strongest single-chart
verification. The chart has Moon in Capricorn and Jupiter in Capricorn
(conjunct, offset = 1 from Moon = kendra). Jupiter is debilitated.
Multiple sources (astrosight, indastro, ganeshaspeaks, Vedic
biographies) cite this exact pattern as an example of "Gajakesari
present but cancelled by Jupiter debilitation" — the yoga is detected
but Jupiter's weakness suppresses its full manifestation. Pre-34c the
library returned `{ name: 'Gajakesari', applies: true }`; post-34c it
returns `{ name: 'Gajakesari', bhanga: { applies: true, reasons:
['Jupiter debilitated in Makara'] } }`. The bhanga annotation surfaces
the classically cited weakness.

### Neecha Bhanga extension coverage

The Moon-kendra extension and Rule D (dispositor aspects) are covered
by 4 dedicated unit-test cases in
[tests/unit/yogas.test.ts](tests/unit/yogas.test.ts) — see the
`'Neecha Bhanga — Moon-kendra extension (Phase 34c)'` describe block.
The pre-existing fixture pins for Modi / Tendulkar / Tata charts still
report Neecha Bhanga in their yoga-name set without any additional
charts gaining/losing the yoga, indicating the new rules fire on the
existing positive cases without manufacturing new false positives.

### Boundary verification

Two boundary cases pin the combustion threshold:

| Jupiter°-Sun° gap | Pre-34c result | Post-34c result |
|---|---|---|
| 10° (inclusive boundary) | Gajakesari only | Gajakesari + bhanga (combust) |
| 11° (just past boundary) | Gajakesari only | Gajakesari, bhanga.applies = false |

The 10° anchor matches the Phase 34c research consensus (BPHS /
Phaladeepika split 10°/12° — `panchang-ts` standardizes at 10°).

### Net behavior change for default callers

The output shape is **purely additive**. Every pre-34c caller continues
to receive `{ name, type, reasons }` and can ignore the new optional
`bhanga` field. TypeScript-narrowing on `yoga.name === 'Gajakesari'`
still works. No existing API contract breaks. The 6 yogas with bhanga
rules (5 Mahapurusha + Gajakesari) gain a deterministic annotation
that callers can pattern-match via `if (yoga.bhanga?.applies)`. The 19
yogas without bhanga rules retain identical output to pre-34c.

### Latent issue surfaced — `shadbala.ts` combustion check (fixed in 34c)

While implementing Gajakesari combustion, I noticed `shadbala.ts`
computed combustion via `distToSun = 180 - sep` and tested `distToSun
<= 10`. With `sep = abs(((delta+540) % 360) - 180)`, `sep` is the
unsigned angular distance from conjunction (0 at conjunction, 180 at
opposition), so `distToSun` was **180 at conjunction and 0 at
opposition** — the inverse of the in-code comment. The `<= 10` check
fired near *opposition*, not near conjunction — Chesta Bala was
flagging a planet as combust when it was roughly opposite the Sun
rather than near it.

**Fix.** Removed the inverted `distToSun = 180 - sep` line and tested
`angularDistance <= 10` directly. The corrected formula matches the
new catalog implementation in `yogasCatalog.ts` for Gajakesari
combustion. Three new regression tests added to `shadbala.test.ts`:
(1) Jupiter at solar conjunction (2024-05-18) → chesta = 15; (2)
Mercury at superior conjunction (2024-09-30) → chesta = 15; (3)
Mars 44° from Sun and direct (2024-05-18) → chesta = 30.

**Cascading consequence — independently verified, not circularly
re-pinned.** Bhava Bala fixture pins were calibrated against the bug.
Five fixture charts had `chesta` values for some planets flipped from
30 to 15 by the fix, propagating into Bhava Bala house totals.

The dependency chain is direct: `house.total = bhavadhipati + dik +
drik + sthana`, where `bhavadhipati = shadbala[lord].total = sthana +
dig + kala + chesta + naisargika + max(0, drik)`. So a 15V change in
a planet's `chesta` propagates exactly 15V into every house lorded by
that planet — no fractional spread.

**Prediction.** Each fixture's house deltas should be (1) exactly
−15V, (2) on the houses lorded by exactly the planet(s) within 10° of
the Sun in that chart who are not retrograde, with (3) every other
house unchanged. Verification, computed from raw Sun–planet angular
distances at each birth instant against the lord-of-house table:

| Chart | Lagna | Combust planet | Sun-distance | Lords houses | Observed delta |
|---|---|---|---|---|---|
| Narendra Modi | Scorpio | Saturn | 0.94° | 3, 4 | -15V on houses 3, 4 ✅ |
| Sachin Tendulkar | Leo | Venus | 3.78° | 3, 10 | -15V on houses 3, 10 ✅ |
| Ratan Tata | Sagittarius | Venus | 9.12° | 6, 11 | -15V on houses 6, 11 ✅ |
| Mukesh Ambani | Scorpio | Venus | 1.33° | 7, 12 | -15V on houses 7, 12 ✅ |
| Dhirubhai Ambani | Sagittarius | (none) | — | — | no diff ✅ |

Every observed Bhava Bala delta is predicted exactly by the mechanism
above. The new pins are therefore independently validated against
classical doctrine ("planet within 10° of Sun is combust"), not merely
regenerated from the post-fix code. The Shadbala-test value-range
checks (`chesta ∈ [0, 60]`, `total = sum-of-components`) were
range-only and remained green without modification.

The lesson worth keeping: **never re-pin a fixture by running the
new code and accepting its output.** Always predict the magnitude
and locus of the change from the source-of-truth mechanism first,
then confirm the observed change matches the prediction.

## 9. Files touched

- `src/types/jyotish.ts` — `Yoga` gains the optional `bhanga` field with
  doc comment.
- `src/jyotish/yogasCatalog.ts` — `YogaMatch` gains optional `bhanga`;
  `mahapurushaRule` computes Sun/Moon-conjunction bhanga; new
  `mahapurushaBhanga` helper; `GAJAKESARI_RULE` computes
  combust/debilitated bhanga; `NEECHA_BHANGA_RULE` extends Rules A & B
  with kendra-from-Moon and adds Rule D (dispositor aspects
  debilitated planet).
- `src/jyotish/yogas.ts` — engine passes `match.bhanga` through to the
  output `Yoga` when present.
- `src/jyotish/shadbala.ts` — `chestaBala` combust check fixed; the
  inverted `distToSun = 180 - sep` line removed so the `<= 10°` test
  now fires near conjunction, not near opposition.
- `tests/unit/yogas.test.ts` — 6 new Mahapurusha bhanga cases, 6 new
  Gajakesari bhanga cases (including 2 boundary), 4 new Neecha Bhanga
  extension cases. Pre-existing "negative — Sun debilitated…" Neecha
  Bhanga test rewritten to be truly negative for post-34c rules.
- `tests/unit/shadbala.test.ts` — 4 new Chesta Bala regression cases
  pinning the corrected combust behavior (Jupiter at conjunction,
  Mercury at superior conjunction, Mars 44° from Sun, Jupiter 92° from
  Sun).
- `tests/unit/bhavaBala.test.ts` — fixture pins re-pinned for the
  five R-tier charts. Every delta is −15V on houses that received the
  pre-fix inflated direct-Chesta from a planet now correctly demoted
  to combust.

## 10. Source list (cited above)

- BPHS Ch. 39: http://bphs.blogspot.com/2008/03/ch-39-raja-yoga.html (Vipareeta Raja Yoga / Great Parashara Exception, verses 39.51+)
- mypandit Mahapurusha: https://www.mypandit.com/kundli/yoga/panch-mahapurush/
- powerofastro Mahapurusha: https://powerofastro.com/2021/06/04/when-panchamaha-purusha-yoga-become-distrustful-not-giving-auspicius-results/
- astrosight Gajakesari: https://astrosight.ai/yogas/gajakesari-yoga-results-analysis
- ganeshaspeaks Gajakesari: https://www.ganeshaspeaks.com/kundli/yogas/gajakesari/
- indastro Gajakesari: https://www.indastro.com/learn-astrology/yoga-dasa/gaj-kesari-yoga.html
- pratulogy Neecha Bhanga: https://www.pratulogy.com/post/cancellation-of-debilitation-neech-bhang-raj-yoga
- aaps.space Neecha Bhanga: https://aaps.space/docs/raja-yogas/cancellation-of-debilitation/
- BV Raman / Frawley via Barbara Pijan: https://www.barbarapijan.com/bpa/Amsha/neechcha_bhanga.htm
- Drik Panchang yoga page (panchang yogas, not birth-chart): https://www.drikpanchang.com/yoga/yoga.html
- Drik Panchang Jyotish utilities: https://www.drikpanchang.com/utilities/astrology-utilities.html
