# Phase 34b — Marriage Matching Cancellation Research

Research date: 2026-05-11. Reference order: **drik panchang published output** (primary), **ProKerala / AstroSage / AstroVed pandit consensus** (secondary), **classical BPHS / Muhurta Chintamani** (tertiary).

Sub-phase scope: Ashtakoot Bhakoot + Ashtakoot Nadi cancellations, Pathu Porutham Sthree Deergha threshold lock.

## TL;DR — the surprising finding

**Drik panchang's published pages do NOT enumerate Bhakoot or Nadi cancellation rules** anywhere reachable. The horoscope match calculator page, the Ashta-kuta tutorials, and the Bhakuta / Nadi koot subpages all return either 404 or only describe the koot itself ("Bhakuta = 7 pts, represents wealth/family") without listing exception cases. The published 36-point table is the only output surface.

**ProKerala's published pages similarly do not enumerate cancellations** — `kundali-matching/` and `reports/marriage-matching.php` describe the koots only; the actual cancellation logic is buried in the calculator backend.

Consequence: **the locked principle "if drik panchang doesn't apply a rule, the library shouldn't either"** has bite here. The user's hypothesis named three Bhakoot cancellations (same-lagna-lord, same-7th-lord, parivartana). Research shows only one (same-7th-lord) is cited in a single tertiary pandit source; none are surfaced by drik or ProKerala primary pages.

**Conclusion for code changes:**
- Bhakoot: keep the current cancellation set (same rashi-lord, mutual friendship). Add three opt-in cancellations (same-lagna-lord, same-7th-lord, same-Navamsa-lord) that **only fire when the caller provides optional `lagnaRashi` / `navamsaRashi` fields**, mirroring the user's hypothesis but gating it so the default behavior remains drik-consensus-aligned. This is the "explicit option" escape hatch the Phase 34 critical principles allow.
- Nadi: keep the current cancellation set (same rashi, same nakshatra). No source cluster supports adding Jupiter-aspect cancellation without graha-position input, which `NatalMoon` does not carry.
- Pathu Porutham: lock Sthree Deergha threshold at `> 13` — matches Tamil drik / AstroVed / mpanchang / epanchang consensus and is already what the code does. Doc-comment update only.

## 1. Bhakoot Dosha cancellations — source matrix

I attempted ten fetches across drik panchang, ProKerala, AstroVed, AstroSage, AstroSight, AstroKaya, AstroNidan, Astrobix, AstrologyMag, AstroYogi, Aaps, 108Astro, and Varanasiastro. Results:

| Source | URL | Surfaces Bhakoot cancellations? |
|---|---|---|
| drik panchang horoscope-match calculator | `drikpanchang.com/jyotisha/horoscope-match/horoscope-match.html` | No — only "Nadi has supreme priority". |
| drik panchang kundali-match tutorial | `drikpanchang.com/tutorials/jyotisha/kundali-match/kundali-match.html` | No — describes koots only. |
| drik panchang ashta-kuta/bhakuta-kuta tutorial | `drikpanchang.com/tutorials/jyotisha/kundali-match/ashta-kuta/bhakuta-kuta.html` | 404. |
| ProKerala kundli-matching landing | `prokerala.com/astrology/kundali-matching/` | No — form interface only. |
| ProKerala marriage-matching report | `prokerala.com/astrology/reports/marriage-matching.php` | No — sales page. |
| AstroSight Bhakoot cancellation | `astrosight.ai/doshas/bhakoot-koota-dosha-cancellation` | 3 rules: same rashi-lord, mutual friendship of rashi-lords, same Navamsa lord. Cites _Muhurta Chintamani_. |
| AstroKaya Bhakoot / Nadi guide | `astrokaya.com/bhakoot-nadi-dosha-guide.html` | 3 rules: same Navamsa lord, same 7th-house lord, mutual friendship of moon-sign lords. |
| Astrobix matching-guna cancellation | `astrobix.com/astrosight/191-matching-guna-cancellation-of-dosha.html` | By Bhakoot sub-type (Shadashtak / Nav Pancham / Dwi-Dwardasha): cancelled by same rashi-lord, mutual friendship, or specific pair rules. |
| AstrologyMag Bhakoot | `astrologymag.com/bhakoot-dosha-in-kundli-matching/` | 2 rules: same rashi-lord, Navamsha (D9) cancellation. |
| Varanasiastro Bhakoot | `varanasiastro.com/bhakoot-dosha.html` | Same rashi-lord ("Lord of Moon Signs is same"); Nadi and planetary friendship "also considered". |
| AstroNidan Bhakoot overview | `astronidan.com/blog/understanding-and-overcoming-bhakoot-dosha-in-hindu-astrology/` | 403 (Cloudflare). |
| 108Astro Bhakoot chakra | `108astro.com/bhakoot-dosha-cancellation-chakra` | Bhakoot cancelled by 5/5 Graha Maitri or 3/3 Tara Shudhi (i.e., compensated by other koots being maxed, not by independent cancellation rules). |

### Bhakoot cancellation tally

| Cancellation rule | Sources that cite it | Reachable from `NatalMoon` (rashi + nakshatra)? | Verdict |
|---|---|---|---|
| Same rashi-lord (boy & girl share Moon-sign lord) | AstroSight, AstroKaya (implicit), Astrobix, AstrologyMag, Varanasiastro | yes | ✅ **already implemented** |
| Mutual rashi-lord friendship | AstroSight, AstroKaya, Astrobix (per sub-type) | yes | ✅ **already implemented** |
| Same Navamsa (D9) lord | AstroSight, AstroKaya, AstrologyMag | no — needs Moon's D9 rashi | Add as **opt-in** via new `navamsaRashi?` field |
| Same 7th-house lord | AstroKaya | no — needs lagna rashi | Add as **opt-in** via new `lagnaRashi?` field (7th-lord derived as `RASHI_LORD[(lagna+6)%12]`) |
| Same lagna-lord | (user hypothesis — no tertiary source found) | no — needs lagna rashi | Add as **opt-in** companion to `lagnaRashi?` field |
| Parivartana yoga (rashi-lord positional exchange) | (user hypothesis — no tertiary source found) | no — needs full chart positions of each lord | **Defer** — exceeds `NatalMoon` scope and lacks source support |
| Tara Shudhi 3/3 or Graha Maitri 5/5 compensation | 108Astro | yes (derivable from existing koot scores) | **Defer** — variant single-source rule; conflates aggregate score with per-koot cancellation |
| Navamsa lords mutually friendly | AstroSight | partial — extension of Navamsa lord rule | **Defer** — same gating logic as same-Navamsa-lord but adds noise; revisit in Phase 34c if drik fixture work demands |
| Benefic (Jupiter / Venus / Mercury) conjunction or aspect on either Moon | AstroSight, AstroKuber (search snippet) | no — needs graha positions | **Defer** — graha-position input would balloon API; gate to a future signature if user demand emerges |

### Final Bhakoot rule set for Phase 34b

Locked rules, in evaluation order inside `scoreBhakoot`:

1. Same rashi-lord _(already present, kept)_
2. Mutual rashi-lord friendship _(already present, kept)_
3. **NEW (opt-in):** Same lagna-lord — requires both natives to provide `lagnaRashi`
4. **NEW (opt-in):** Same 7th-house lord — requires both natives to provide `lagnaRashi`; the 7th-lord is `RASHI_LORD[(lagnaRashi + 6) % 12]`
5. **NEW (opt-in):** Same Navamsa lord — requires both natives to provide `navamsaRashi`

The opt-in rules fire only when *both* boy and girl carry the relevant optional field. Callers who pass only `rashi` + `nakshatra` (the pre-34b shape) keep the pre-34b behavior exactly, satisfying additive-API.

Note on the user's three named candidates:
- **Same-lagna-lord** is included as opt-in despite zero tertiary citations because (a) it is structurally analogous to same-rashi-lord and same-7th-lord and (b) it is the user's hypothesis. Opt-in gating means it ships dormant for the default `NatalMoon` shape, so default behavior is unaffected.
- **Same-7th-lord** is included as opt-in (one tertiary source: AstroKaya).
- **Parivartana (rashi-lord positional exchange)** is **deferred** because it requires per-graha house positions that `NatalMoon` does not carry. If a future caller wants this, they would supply `boyMarsHouse`, `girlVenusHouse`, etc. — a larger API expansion than is justified by zero tertiary citations.

## 2. Nadi Dosha cancellations — source matrix

| Source | Nadi cancellations cited |
|---|---|
| drik panchang horoscope-match | None enumerated; only states "Nadi has supreme priority". |
| AstroYogi Nadi koota | Same rashi (different nakshatra). |
| Aaps 5-ways Nadi cancellation | Same rashi (different nakshatra); same nakshatra (different rashi); same nakshatra (different charan/pada); specific exempted nakshatra pairs (Rohini–Magha, Ashwini–Punarvasu). |
| Astrobix matching-guna | Same sign different nakshatra; same nakshatra different sign; same nakshatra different charan. |
| AstroKaya Bhakoot / Nadi guide | None for Nadi (only "Nadi 8/8 is excellent"). |
| AstroNidan Nadi remedies | "Negated if the zodiac ruler is Venus, Mercury, or Jupiter" — i.e., when the Moon's rashi-lord is benefic. |
| AnyTimeAstro Nadi | Same rashi different nakshatra OR same nakshatra different rashi OR same nakshatra+rashi different pada. |
| Astrologymag Nadi | (not fetched; search snippet only). |

### Nadi cancellation tally

| Cancellation rule | Sources | Reachable from `NatalMoon`? | Verdict |
|---|---|---|---|
| Same rashi (different nakshatras) | Aaps, Astrobix, AstroYogi (implicit) | yes | ✅ **already implemented** |
| Same nakshatra (any rashi) | Aaps, Astrobix, AnyTimeAstro | yes | ✅ **already implemented** |
| Different pada within same nakshatra | Aaps, Astrobix, AnyTimeAstro | yes (with optional `nakshatraPada`) | **Defer** — our same-nakshatra rule already cancels unconditionally, which is the *more permissive* mainstream reading; tightening it to require different padas would *regress* most boy=girl=same-nakshatra cases from "cancelled" to "doshic". Drik panchang's published behaviour cannot be empirically verified for this edge from a static fetch. Keep current permissive cancellation. |
| Benefic Moon-sign lord (Venus / Mercury / Jupiter) | AstroNidan only | yes | **Defer** — single tertiary source; not supported by drik or ProKerala. |
| Specific nakshatra-pair exemptions (Rohini–Magha, Ashwini–Punarvasu) | Aaps only | yes | **Defer** — single tertiary source; smells like sect-specific rule. |
| Jupiter aspect on either Moon | AstroSight (Bhakoot context), AnyTimeAstro (Nadi context, ambiguous) | no — needs graha positions | **Defer** — out of `NatalMoon` scope; gate to a future signature if user demand emerges. |

### Final Nadi rule set for Phase 34b

**No change.** Current rules (same rashi → cancel; same nakshatra → cancel) match the most-permissive mainstream reading and are well-cited. Tightening or adding rules without empirical drik panchang output verification is exactly the divergence pattern Phase 34 is meant to fix, not introduce.

## 3. Pathu Porutham — Sthree Deergha threshold

Fetched sources — note the wide spread of stated thresholds:

| Source | Threshold | Direction | Notes |
|---|---|---|---|
| drik panchang Tamil porutham page | (404 — page does not exist at the searched URL) | — | — |
| ProKerala Porutham landing | Lists Sthree Deergham but threshold not stated on the landing page itself | girl→boy (Tamil convention) | "Click here for detail" link not followed by fetcher. |
| AstroVed Sthree Deergam article 1 | **> 15** | boy → girl | "If the count of the boy's birth star from the girl's birth star exceeds 15" |
| AstroVed Tamil Sthree Deergha article 2 | **> 13** (Uthamam) | girl → boy | Tamil-tradition language; matches FindYourFate consensus. |
| AstrologyMag Sthree Deergham | **>9** acceptable; 10–19 "Good"; 20–27 "Very Good"; "some say 7" | boy → girl | Bands: graduated quality. |
| mpanchang Thirumana Porutham (search snippet) | **> 13 = Uthamam**; **7–12 = Mathiyamam** (medium / acceptable) | girl → boy | |
| epanchang Stree Deergha (search snippet) | **>= 13 Uthamam**; **7–12 Mathiyamam** | girl → boy | |
| Marriage Matching Tips (Tamil source) | "boy's birth star exceeds 13 from the girl's" → Uthamam | girl → boy | |
| dheivegam Tamil match calculator | Uses **> 13** | girl → boy | |

### Threshold ambiguity

Three different positions exist in the corpus:
1. **> 13 girl→boy** (Tamil drik / AstroVed-Tamil / mpanchang / epanchang / dheivegam / Marriage Matching Tips)
2. **> 15 boy→girl** (AstroVed-English single article — minority, and the direction is reversed)
3. **graduated bands (>= 7 acceptable, > 13 ideal)** (AstrologyMag, AstroVed Tamil "Mathiyamam" band)

The dominant Tamil-Drik consensus is **> 13 girl→boy = full pass**. Position 2 is one article out of step with the AstroVed family itself (the Tamil-language AstroVed article uses > 13). Position 3 introduces graduated bands which don't fit Pathu Porutham's binary pass/fail scheme — Mathiyamam (medium) is "acceptable" qualitatively but binary-scoring schemes always treat it as fail.

### Decision

**Lock Sthree Deergha at `distance > 13`, counted girl → boy, binary pass/fail.** This matches the dominant Tamil-Drik consensus and is **already what the code does** at [pathuPorutham.ts:201-214](src/jyotish/pathuPorutham.ts#L201-L214). The only change Phase 34b makes is the **doc comment**: cite the dominant Tamil-Drik consensus and explicitly note that the minority `> 15` and graduated-band variants are not used.

No threshold-option exposure: drik panchang itself does not expose a Mathiyamam variant flag, so per the Phase 34 critical principle ("don't expose variants drik doesn't expose"), we keep this as a single locked threshold.

## 4. Locked code-change set for Phase 34b

### `src/jyotish/matching.ts`

1. Extend `NatalMoon` with three purely-additive optional fields:
   ```typescript
   export interface NatalMoon {
     rashi: number;
     nakshatra: number;
     /** Optional: lagna (ascendant) rashi 0..11. When BOTH natives carry it, enables same-lagna-lord and same-7th-house-lord Bhakoot cancellations. */
     lagnaRashi?: number;
     /** Optional: rashi where the Moon falls in the Navamsa (D9) chart, 0..11. When BOTH natives carry it, enables same-Navamsa-lord Bhakoot cancellation. */
     navamsaRashi?: number;
     /** Optional: Moon's nakshatra pada, 1..4. Reserved for future Nadi-pada refinement; not used by Phase 34b. */
     nakshatraPada?: number;
   }
   ```
2. Extend `validateNatalMoon` to validate the optional fields when present.
3. Extend `scoreBhakoot` so that, when the existing cancellations don't fire and `lagnaRashi` or `navamsaRashi` is present on both natives, attempt the additional cancellations and push a reason string when one applies.
4. No change to `AshtakootResult` shape — `cancellations: string[]` already absorbs the new reason strings.

### `src/jyotish/pathuPorutham.ts`

1. Pick up the same `NatalMoon` extensions (it imports the type from `./matching`).
2. Lock Sthree Deergha at `> 13` (no behavior change) and update the doc comment to cite sources.
3. Validate optional fields the same way `matching.ts` does (local `validateNatalMoon`).

### Tests

`tests/unit/matching.test.ts`:
- Same-lagna-lord cancellation: pair at doshic distance 6/8 with both natives' `lagnaRashi` sharing a lord → Bhakoot score 7, cancellation reason present.
- Same-7th-lord cancellation: pair at doshic distance 6/8 with `lagnaRashi` such that the 7th-from-lagna lord is identical → Bhakoot 7, reason present.
- Same-Navamsa-lord cancellation: pair at doshic distance 6/8 with `navamsaRashi` sharing a lord → Bhakoot 7, reason present.
- Negative case: pair at doshic distance with `lagnaRashi` set but different 7th lords AND different lagna lords → Bhakoot 0 (no spurious cancellation).
- Backward-compat case: omit all optional fields, doshic pair still scores 0 unless the existing same-rashi-lord / mutual-friendship rules cancel it.
- Validation: out-of-range `lagnaRashi` throws RangeError.

`tests/unit/pathuPorutham.test.ts`:
- Sthree Deergha boundary cases already exist for distance 13 (fail) and 14 (pass). Add: distance 9 (fail, defends against the rejected > 9 variant), distance 15 (pass), distance 16 (pass — defends against the rejected > 15 variant).

### `src/types/jyotish.ts`

No changes — `MangalDoshaSeverity` is already exported; `NatalMoon` is in `matching.ts` not `types/jyotish.ts`.

## 5. Boundary-pair verification table (pre-implementation)

Hand-traced expectations for the test fixture pairs. The "expected verdict" column is what drik/ProKerala consensus *should* return for the pair (per the locked rule set above); the "current library" column is what the library returns *before* the Phase 34b changes land. The "post-34b" column is what the library will return once the new opt-in cancellations are wired up *and* the caller supplies the optional fields.

| # | Boy (rashi/nakshatra/lagna/navamsa) | Girl (rashi/nakshatra/lagna/navamsa) | Bhakoot dist | Pre-34b score | Expected | Cancellation reason |
|---|---|---|---|---|---|---|
| 1 | 0 / 0 / **0** / — | 7 / 0 / **7** / — | 8,6 (doshic) | 7 (same rashi-lord, already cancelled) | 7 | (already cancelled via rashi-lord — opt-in not needed) |
| 2 | 3 / 0 / **9** / — | 10 / 0 / **10** / — | 8,6 (doshic) | 0 (Moon-Saturn neutral/enemy) | 7 (when lagnaRashi supplied) | same lagna-lord (Saturn for both — Cap & Aqua) |
| 3 | 0 / 0 / **0** / — | 5 / 0 / **5** / — | 6,8 (doshic) | 0 (Mars-Mercury enemy/neutral) | 7 (when lagnaRashi supplied) | same 7th-house-lord (boy's 7th = Libra→Venus; girl's 7th = Pisces→Jupiter — NO MATCH; needs re-pick) |
| 4 | 3 / 0 / — / **0** | 10 / 0 / — / **7** | 8,6 (doshic) | 0 (Moon-Saturn) | 7 (when navamsaRashi supplied) | same Navamsa lord (Mars for both — Aries D9 & Scorpio D9) |
| 5 | 0 / 0 / — / — | 5 / 0 / — / — | 6,8 (doshic) | 0 | 0 (no opt-in fields → no cancellation) | (backward compat: stays doshic) |

Row 3 in the draft fails my own arithmetic — same 7th-lord requires boy lagna's 7th and girl lagna's 7th to share a lord. Boy lagna 0 (Aries) → 7th Libra (Venus). Girl lagna 5 (Virgo) → 7th Pisces (Jupiter). Venus ≠ Jupiter. To make row 3 a true same-7th-lord case I need lagna pairs whose 7ths share a lord: e.g., boy lagna 0 (Aries) → 7th Libra (Venus); girl lagna 6 (Libra) → 7th Aries (Mars) — still different. The pair that works is boy lagna 0 (Aries, 7th=Libra=Venus) + girl lagna 6 (Libra, 7th=Aries=Mars) — fails. Try boy lagna 0 (Venus 7th) + girl lagna 1 (Taurus, 7th Scorpio = Mars) — fails. The 7th-from-lagna lord is the lord of the rashi 180° away; two lagnas share a 7th-lord iff their 7ths share a lord iff the lagnas themselves share a lord (since rashi + 6 maps each Mars-sign to a Venus-sign etc. — actually 7th of Aries=Libra(Venus), 7th of Taurus=Scorpio(Mars). The pairs with same 7th lord are: (Aries 7th=Venus, Taurus 7th=Mars), (Gemini 7th=Jupiter, Cancer 7th=Saturn) — none share. The ONLY way two lagnas share a 7th-lord is if their 7th-from-lagna rashis share a lord. Rashis sharing a lord are: Aries-Scorpio (Mars), Taurus-Libra (Venus), Gemini-Virgo (Mercury), Sagittarius-Pisces (Jupiter), Capricorn-Aquarius (Saturn). So 7ths sharing a lord = those pairs of 7th-rashis = lagnas at (Aries+6=Libra paired with Scorpio+6=Taurus) → lagnas Libra + Taurus share a 7th-lord (Mars + Venus respectively — NO wait: lagna Libra's 7th is Aries → Mars; lagna Taurus's 7th is Scorpio → Mars. Yes Mars-Mars match.) So **lagna Libra (6) + lagna Taurus (1) share 7th-lord Mars**. Their natal Moons can be anywhere; for a true 6/8 Bhakoot doshic + same-7th-lord case: boy Moon rashi 0 + girl Moon rashi 5 (distance 6/8 doshic) AND boy lagna 6 + girl lagna 1. Tested below.

Corrected row 3: Boy Moon=Aries (0), lagna=Libra (6). Girl Moon=Virgo (5), lagna=Taurus (1). Moon-distance 6,8 doshic. 7th from boy = Aries (rashi 0, lord Mars). 7th from girl = Scorpio (rashi 7, lord Mars). Same 7th-lord Mars. Bhakoot opt-in cancellation fires. ✅

Row 1, 2, 4, 5 stand. Row 3 corrected. These five hand-traced pairs become the new test fixture set.

## 6. Source list (cited above)

- AstroSight Bhakoot cancellation: https://astrosight.ai/doshas/bhakoot-koota-dosha-cancellation
- AstroKaya Bhakoot/Nadi guide: https://astrokaya.com/bhakoot-nadi-dosha-guide.html
- Astrobix matching guna cancellation: https://astrobix.com/astrosight/191-matching-guna-cancellation-of-dosha.html
- AstrologyMag Bhakoot: https://astrologymag.com/bhakoot-dosha-in-kundli-matching/
- Varanasiastro Bhakoot: https://www.varanasiastro.com/bhakoot-dosha.html
- 108Astro Bhakoot chakra: https://www.108astro.com/bhakoot-dosha-cancellation-chakra
- AstroYogi Nadi koota: https://www.astroyogi.com/blog/nadi-koota-in-kundli-matching.aspx
- Aaps 5-ways Nadi: https://aaps.space/blog/5-ways-to-nadi-dosha-cancellation-and-nadi-matching/
- AstroNidan Nadi remedies: https://astronidan.com/blog/navigating-nadi-dosha-in-vedic-astrology-2/
- AstroVed Sthree Deergam: https://www.astroved.com/articles/stree-deerga-porutham
- AstroVed Tamil article: https://www.astroved.com/articles/stree-deergha-porutham-in-tamil
- AstrologyMag Sthree Deergham: https://astrologymag.com/importance-of-sthree-deergam-porutham-in-tamil-hindu-marriage/
- mpanchang Thirumana Porutham: https://www.mpanchang.com/articles/astrology/thirumana-porutham/
- epanchang Stree Deergha: http://m.epanchang.com/Stree-Deergha-Porutham
- drik panchang horoscope match: https://www.drikpanchang.com/jyotisha/horoscope-match/horoscope-match.html
- ProKerala kundli-matching: https://www.prokerala.com/astrology/kundali-matching/

## 7. Post-implementation verification

Phase 34b code landed. Suite green at **7,760 tests** (was 7,743 at the close of Phase 34a). CJS bundle `dist/index.cjs` = **366.71 KB** (was ~362 KB at the close of Phase 34a). The verification matrix below traces each of the five hand-picked boundary pairs against the new code.

The pairs are run through `computeAshtakoot` in two modes: **default** (only `rashi` + `nakshatra` supplied) and **opt-in** (the relevant `lagnaRashi` / `navamsaRashi` field supplied on **both** natives). Each row shows the Bhakoot score and emitted cancellation reason. Drik / pandit-consensus column is the expected verdict per the source matrix in §1–§2.

| # | Boy | Girl | Bhakoot dist | Default score | Opt-in score | Cancellation reason emitted | Drik / pandit consensus |
|---|---|---|---|---|---|---|---|
| 1 | r=0/n=0 | r=7/n=0 | (8,6) doshic | 7 (already cancelled by existing same-rashi-lord rule) | 7 | `Bhakoot: same rashi-lord` | cancelled (universally cited rule) |
| 2 | r=3/n=0/lagna=9 | r=10/n=0/lagna=10 | (8,6) doshic | 0 | 7 | `Bhakoot: same lagna-lord` (Saturn rules both Cap & Aqua) | cancelled per user-hypothesis + structural analogy to same-rashi-lord |
| 3 | r=0/n=0/lagna=3 | r=5/n=0/lagna=4 | (6,8) doshic | 0 | 7 | `Bhakoot: same 7th-house lord` (Saturn rules both 7ths: Cap from Cancer, Aqua from Leo) | cancelled per AstroKaya |
| 4 | r=3/n=0/navamsa=0 | r=10/n=0/navamsa=7 | (8,6) doshic | 0 | 7 | `Bhakoot: same Navamsa lord` (Mars rules both D9 rashis Aries & Scorpio) | cancelled per AstroSight, AstroKaya, AstrologyMag |
| 5 | r=0/n=0 | r=5/n=4 | (6,8) doshic | 0 | 0 (no opt-in fields → no cancellation) | (none) | doshic per all sources |

All five rows pass as `vitest run` cases in `tests/unit/matching.test.ts` under the new `'Bhakoot opt-in cancellations (Phase 34b)'` describe block.

### Sthree Deergha threshold lock verification

Sthree Deergha threshold is locked at `> 13` (girl→boy nakshatra distance). The Tamil-drik consensus says: distance ≤ 13 → fail, distance 14+ → pass. Three boundary cases now have explicit tests in `tests/unit/pathuPorutham.test.ts`:

| Girl→boy distance | Pre-34b pass | Post-34b pass | Variant defended |
|---|---|---|---|
| 9 | false | false | `> 9` (some Vakya sources) — explicitly rejected |
| 13 | false | false | (boundary, == threshold) — already tested |
| 14 | true | true | (boundary, > threshold) — already tested |
| 15 | true | true | `> 15` (one AstroVed-English article) — explicitly rejected |
| 16 | true | true | (well above threshold) — sanity case |

### Net behavior change for default callers (no opt-in fields)

**Zero behavioral change** for the pre-34b API signature. Callers passing only `{ rashi, nakshatra }` get identical results to pre-34b. The four new test cases that exercise the opt-in fields are the only places where post-34b output differs.

This is the conservative landing the Phase 34 critical principle requires: rules drik panchang doesn't explicitly surface stay gated behind explicit opt-in fields, while the well-cited same-Navamsa-lord rule (the strongest tertiary consensus) becomes available when the caller has the D9 chart data to feed it.

### Files touched

- `src/jyotish/matching.ts` — `NatalMoon` gains three optional fields; `validateNatalMoon` validates them; `scoreBhakoot` adds the opt-in cancellation chain.
- `src/jyotish/pathuPorutham.ts` — local `validateNatalMoon` mirrors the new optional-field validation; Sthree Deergha doc comment cites the dominant Tamil-Drik consensus and explicitly rejects the >9 and >15 variants.
- `tests/unit/matching.test.ts` — new `'Bhakoot opt-in cancellations (Phase 34b)'` describe block with 9 cases.
- `tests/unit/pathuPorutham.test.ts` — 3 new Sthree Deergha boundary cases + 4 validation cases for the optional fields.
