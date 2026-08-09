# panchang-ts v5 — remaining work

Handoff from the 2026-08-08 session. Working tree has ~40 changed paths,
**nothing committed**. Current state: 8,566 tests pass; `npm run typecheck`
(two tsc passes), `npm run lint`, `npm run build` and `npm run test:hermes` all
green.

Read this whole file before starting. Several items below are *deliberate
decisions with evidence*, not oversights — reversing one without new evidence
would be a regression.

---

## Ground rules that produced the good results here

1. **DrikPanchang is the parity oracle.** Where drik and a secondary source
   disagree, drik wins, and the disagreement gets written down.
2. **Never re-pin a fixture to whatever the code now emits.** Predict the delta
   from first principles, confirm the measurement matches the prediction, *then*
   re-pin, and record both numbers in the test. Every re-pin this session did
   that (e.g. Sankranti transit: predicted +5.741 s, measured +5.741 s).
3. **Derive the reference table from published occurrences; do not score our
   table against them.** A published day can be caused by a cell we lack while
   one of ours also happens to fire — that attribution is unsound. This was the
   difference between a wrong answer and an exact one for Sarvartha Siddhi.
4. **Don't invent a rule to make a test pass.** Several things below are
   unfixed precisely because no source prescribes the missing piece.
5. Run **all five** gates, not just vitest.

---

## Verified-good — do not "fix" these

- **Nutation / VSOP87D / ELP2000-82B.** All 78 nutation coefficients and 1,092
  argument multipliers reproduce their IERS source rows exactly; the kept set is
  exactly top-N by amplitude. `bash notes/ephemeris-generate.sh` regenerates
  `vsop87d.ts` and `elp2000-82b.ts` **byte-identically** (~12 min).
  - The tables are **IAU 2000_R06**, leading Δψ = −17.20642418″. Plain IAU 2000A
    is −17.2064161″. Comparing against the wrong one makes a correct file look
    broken.
  - `nutation-iau2000.ts` is generator-emitted **including its header**. Put doc
    changes in `notes/ephemeris-generate.src.ts`, never in the output.
- **Amrit Siddhi, Tripushkar, Sarvartha Siddhi** — all three reconcile
  one-for-one against drik's published 2026 listings. Pinned in
  `tests/validation/drik-special-yogas.test.ts`.
- **Jwalamukhi** — 5 rows verified against the Sanskrit verse quoted in source.
- **Festivals / vrat** — tithi-viddha and Ekadashi Smarta/Vaishnava split
  (arunodaya-based) are implemented and correct. Do not simplify.
- **ΔT** — see item 1 below before touching.

---

## Open items

### 1. ΔT far-future continuation is an assumption (LOW priority, HIGH risk to change)

`src/astronomy/deltaT.ts` now uses three eras: Espenak–Meeus before 1972, the
leap-second chain `32.184 + (TAI − UTC)` through `OBSERVED_THROUGH_MS`
(2027-01-01), then E–M **offset by the bias accrued at the handoff**.

The offset continuation is load-bearing. **Do not replace it with a flat hold**
— that was tried and measured: it runs ~134 s adrift by 2100 and blew solar
eclipse first contact vs NASA's city catalogs to 338 s against a 70 s bound.
NASA's Five Millennium Canon is itself computed with E–M, so far-future
"agreement" means using their model, not being correct.

**Maintenance action** when a leap second is announced (or confirmed absent):
bump `OBSERVED_THROUGH_MS` and extend the `TAI_MINUS_UTC` table. Nothing else.

**Optional improvement**: adopt a newer *published* ΔT expression wholesale
(e.g. Morrison–Stephenson–Hohenkerk 2021) rather than the offset heuristic. Only
do this if you adopt the whole expression — do not hand-tune the polynomials,
which are a faithful transcription.

### 2. Sarvartha Siddhi — RESOLVED 2026-08-09 (Sunday + Ashwini confirmed)

Second-session validation pulled drik's 2025 and 2027 Mumbai listings plus the
2026 New Delhi listing (`?geoname-id=1261481`; plain `curl` works — WebFetch is
what can't drive the date param). 471 windows across four city-years:

- **Sun + Ashwini fires 17 times; Sun + Ashlesha never.** The secondary tables
  are simply wrong for drik parity. Docblock updated.
- Every dataset independently exercises **exactly the same 35 cells**; a
  segment-level split of every window at nakshatra boundaries and sunrises
  leaves no segment > 2 min outside the table. All cells are now multi-year,
  two-city confirmed.
- Discovery: a few pre-dawn windows (3 of ~100) are dated by **Hindu day**, not
  the start's civil date — their printed times fall on the next civil date,
  provable because the start anchors to a nakshatra boundary only there. This
  corrects the *mechanism* of the withdrawn Sat + Punarvasu cell (the
  2026-10-04 window is Sun + Pushya on Oct 5 civil), though the withdrawal
  itself was right.
- `tests/validation/drik-special-yogas.test.ts` now reconciles all four
  city-years (fixtures vendored beside it); `compare()` uses earliest-available
  matching, and one 2025 pair (3/2 + 3/3) shares a single Hindu day —
  annotated as `sharedDay`.

### 3. Muhurta occasion lists — VALIDATED 2026-08-09; griha pravesh + vahan fixed

Three years (2025–2027, `?year=` param, plain curl) of drik's dated calendars
for marriage (233 muhurat days), griha pravesh (121) and vehicle purchase
(311), each day carrying either the muhurat's nakshatra/tithi labels or drik's
rejection reason. Derived drik's operative per-anga sets from occurrences
(ground rule 3) and compared:

- **vivahRule — clean, untouched.** The eleven nakshatras are exactly drik's
  operative set (21–27 occurrences each). Drik states it applies **no tithi or
  weekday shuddhi** for marriage (its prose still affirms the classical
  preferences we encode as soft factors), plus factors we don't model
  (Shukra/Guru Tara Asta ~67 d/yr, six allowed solar months, Chaturmas). So
  day-level parity is structurally impossible — our rule is the narrower
  classical screen, as intended.
- **grihaPraveshRule — fixed.** Nakshatras are the classical eight (added
  Mrigashira, Chitra; dropped Magha/Hasta/Swati/Shravana, 0–1 occurrences in
  three years). Saturday moved to auspicious (23 published Saturdays; drik's
  weekday rejections are only Sun 68 / Tue 66). `excludeEkadashi` hard veto
  dropped — Ekadashi is drik's #3 griha pravesh tithi (22) — and tithis
  realigned to drik's operative {2,3,5,7,10,11,13}.
- **vahanKharidiRule — fixed.** Drik's own footer prose states the rule
  (Chara + Mridu/Laghu classes) and 311 days confirm: dropped the three
  Sthira nakshatras (0 occurrences), added Mrigashira/Chitra/Swati/Dhanishtha/
  Shatabhisha (30–37 each); kept Rohini (29, despite prose omitting it), kept
  Ashwini out (nominally Laghu, 0 occurrences). Unbanned Ashtami (44) and
  Purnima (23); Sunday to auspicious (62).
- **mundanRule — cannot be validated this way**: the mundana URL is a per-day
  form page (birth-details driven), not a year list. Still prose-checked only.
- Boundary-label artifact to know about: drik sometimes prints, next to a
  window's real nakshatra, the adjacent one that begins the minute the window
  ends (e.g. the lone "Jyeshtha" vehicle listing, 2026-02-11 — window ends
  10:53 AM, exactly Anuradha's end per our SSY span data). All sub-4-count
  strays are of this shape.
- Permanent guard: `tests/validation/drik-muhurta-lists.test.ts` +
  `tests/fixtures/drik-muhurat-days-2025-2027.json` pin the operative sets
  (frequency threshold 4 splits genuine ≥9 from artifact ≤3).

What remains open here: the ten other stock rules have dated drik pages for
none of them (checked: only these three publish year lists), so they stay
prose-verified.

### 4. Vara × Tithi yoga conflicts net out (documented, probably fine)

`src/muhurta/varaTithiYogas.ts` implements Siddha, Amrita, Dagdha, Visha,
Hutasana, Krakacha, Samvartaka. Five cells form an auspicious *and* an
inauspicious yoga simultaneously — Wilhelm asterisks exactly those and no source
ranks the tables. Both are surfaced as separate factors and allowed to net out.
17 days in 2026 hit this. If a source with a precedence rule turns up, revisit.

### 5. Gana koot has no cancellation — deliberate (do not "fix")

Bhakoot and Nadi cancellations are score-affecting in mainstream practice and
drik surfaces them; the Gana mitigations described in sources are interpretive
("loses significance"), never a restoration of the six points, and one common
form (total > 25/36) is circular since Gana feeds the total. Rationale is in the
`scoreGana` docblock. Note the earlier claim that this would break drik-pinned
fixtures was **wrong** — `tests/fixtures/ashtakoot-pairs.json` pins no totals at
all.

### 6. Modelling gaps, all documented, none blocking

- **Nakshatra pada boundaries** are not modelled. This is why `vivahRule` cannot
  express the classical rejection of Magha/Mula 1st pada and Revati 4th pada,
  and why `excludeGandaMula` is off for vivah (the whole-nakshatra veto would be
  far wider than the source).
- **Chandra bala / Tara bala** need a natal Moon; muhurta scoring has no natal
  input.
- **Muhurta lagna and its navamsa** are not considered.
- **Tarabala** collapses the three 9-tara cycles into one index. `taraIndex` is
  correct; the cycle is simply not exposed.

### 7. ~17 subsystems never deep-audited (largest genuinely open item)

From the 2026-06-14 audit, which hit a session limit. Not audited since:
shadbala, yogas-catalog, choghadiya/hora/gowri, divisionals/charts, matching,
karakas/upagrahas/arudha/argala/kp, varshaphala/prashna/sahams, festivals,
eclipses/moon-phases tables, convert/yearly, api-surface/i18n, edge-robustness.

Two bug classes found this session both hid in *untested* territory rather than
wrong-tested territory, so coverage gaps are where to look:
- a whole-day flag standing in for a graded classical concept (Panchaka), and
- a time-of-day the tests never exercised (evening instants).

### 8. Release housekeeping (needs your decision, not code)

- **`.changeset/` is empty.** Version is managed by hand in `package.json` +
  `CHANGELOG.md`. Adding a changeset would bump off 5.0.0 on `changeset publish`.
- **CHANGELOG heading says `## 5.0.0 — 2026-08-08`.** Set the real date at
  publish.
- `tests/unit/panchaka-types.test.ts` still holds an August-only Sarvartha
  Siddhi check that is now a strict subset of the full-year one in
  `tests/validation/drik-special-yogas.test.ts`. Harmless duplication.

---

### 9. Raw-getter per-call cost — structural, one real avenue if it ever matters

Measured 2026-08-09 (M-series, Node 24): `getSiderealMoonLongitude` ~13.9 µs vs
6.7 µs on published 4.3.1; Sun 2.8 vs 1.4 µs. Decomposition of the Moon call:
**10.8 µs of 14.3 is the 657-term ELP longitude series**, which is sine-bound
(trig.ts `sin` measures 11.4 ns/call standalone; 657 × 11.4 ns ≈ 7.5 µs floor).
Nutation cold is 1.4 µs; everything else is noise. The elp.ts docblock's
"2.46 µs" figure predates the 100k-epoch re-anchoring that grew the series
9–34% — treat it as historical. The cost is the accuracy (1.26″ vs
astronomy-engine's 3.75″ against DE441); there is no waste to recover.

The one genuine 2–3× avenue, if a future phase wants it: **argument-folding for
ELP, the way `frame.ts` already evaluates nutation.** Every ELP term's phase is
an integer combination of ~14 fundamental arguments; the generator currently
collapses that structure into per-term phase polynomials, forcing one `sin` per
term. Emitting multiplier tables instead lets the evaluator take sin/cos of the
fundamental arguments once per epoch (~30 trig calls) and fold each term with a
few multiply-adds — the same trick that took nutation from 156 trig calls to
28. This is a rewrite of the generator *and* evaluator of the most-validated
component in the library: full §36.0 protocol (freeze, differential at 1e-9″,
tier0 re-run, predicted fixture deltas), 1–2 sessions. Not a pre-release item.
README's Performance section documents the current trade honestly.

Full vcompare sweep (2026-08-09, refreshed `notes/vcompare/cmp-results.json`)
adds the chart dimension: `chart/rashi` and `chart/navamsa` are **3.3× slower**
than published 4.3.1 (0.095 → 0.313 ms — fifteen full-accuracy planet
evaluations per chart, three per planet for the retrograde probes, nothing
amortized), while `chart/shadbala` / `chart/bhavabala` are **2.1× faster**
(positions computed once and reused). Everything panchang- and range-shaped is
14–131× faster; rise/set primitives and pure-arithmetic controls are ~1.0×.
A second avenue specific to charts, cheaper than the ELP folding: the
`isRetrograde` probes only need a longitude *difference* sign at ±1 h, so a
coarse planet tier would do — but a tier flip near a station could change a
published boolean, so it needs the same predict-then-verify discipline, against
station epochs specifically. Also not a pre-release item.

## Two traps that cost real time here

- **`pgrep -f ephemeris-generate` matches its own command line**, so a
  `until ! pgrep …; do sleep; done` wait loop never exits. Two of them ran for
  2.5 hours. Poll the generator's log for `wrote ` instead.
- **IERS table 5.3b lists B″ (sin) before B (cos)** — the same column order as
  5.3a despite the opposite naming. Flipping it produces 29 false "mismatches"
  in a table that is actually correct.
