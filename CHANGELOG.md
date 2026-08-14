# panchang-ts

<!--
  Note: 4.0.0 and 4.1.0 entries are not yet backfilled here (the CHANGELOG
  jumped from 3.4.0). See git history for their scope; 4.2.0 below is
  reconstructed from the festivals-table release.
-->

## Unreleased

All fourteen findings of the 2026-08-14 correctness audit, fixed against the
audit's own DrikPanchang evidence (58 day-pages Jaipur-Feb-2027 /
Kolkata-Nov-2026, 14 choghadiya pages, plus targeted year-page sweeps).
Carries two deliberate breaking type changes (`inauspicious.durMuhurta`,
`muhurtas.amritKala`), following the varjyam `TimePeriod[]` precedent from
5.1.

### Breaking

- **`inauspicious.durMuhurta` is now `DurMuhurtaPeriod[]`** (was
  `[TimePeriod, TimePeriod]`) — 1–2 windows, each tagged `segment: 'day' |
  'night'`. The old table was wrong on **all seven weekdays**; drik (58
  days, 2 cities, zero exceptions) follows the classical Muhurta-Chintamani
  ordinals — Sun [13] · Mon [8, 11] · Tue day[3] + **night[6]** · Wed [7] ·
  Thu [5, 11] · Fri [3, 8] · Sat [0, 1] (0-based; day = sunrise→sunset /15,
  night = sunset→nextSunrise /15). Sunday and Wednesday carry a single
  window, and Tuesday's second window falls at night — neither fits the old
  two-day-window tuple. `computeDurMuhurta` gained a `nextSunrise` parameter
  and returns the tagged windows. Tier-1 pin: one full drik week (Jaipur,
  Feb 1–7 2027, ±2 min).
- **`muhurtas.amritKala` is now `TimePeriod[]`** (was `TimePeriod | null`).
  The old model (sunrise-anchored, ahoratra-elastic ghatikas, one window,
  dropped when crossing next sunrise) disagreed with drik by up to ~16 h.
  Drik's Amrit Kalam is the **varjyam architecture**: anchored at the
  nakshatra's own start, offset per nakshatra in nakshatra-elastic ghatikas
  (span/60), width exactly 4 such ghatikas, attributed to the Hindu day the
  window **starts** in, 0–2 windows/day. The 27-offset table was recovered
  from 54 drik windows covering all 27 nakshatras (spread ≤0.1 ghati).
  Corpus note: ProKerala's Telugu panchangam independently confirms the
  architecture and most offsets (7 of 9 sampled windows ≤2 min) but implies
  Mula ≈ 45 and U.Bhadrapada ≈ 47.5 where drik uses 44 / 48, and attributes
  post-midnight windows to the calendar day; drik is the project's parity
  bar, so its table and attribution ship. `computeAmritKala` is replaced by
  `computeAmritKalaWindows(sunriseUtc, nextSunriseUtc, getMoon)`. Tier-1
  pin: 16 days across both sweep cities, incl. drik's empty day (Jaipur
  2027-02-03) and a post-midnight attribution day.

### Fixed — daily panchang surfaces

- **Night choghadiya (CH-1):** the 2026-08-13 capture transposed Kaal/Labh
  in the night succession and misread Tuesday's start. Correct cycle
  Udveg → Shubh → Amrit → Char → Rog → **Kaal → Labh**; starts Sun Shubh,
  Mon Char, **Tue Kaal**, Wed Udveg, Thu Amrit, Fri Rog, Sat Labh (+2 mod 7).
  Verified on 14 consecutive drik nights across Bengaluru-Feb-2027 and
  Ujjain-Aug-2026, then re-fetched live. Names only; times unchanged.
- **Bhadra vasa (BH-1):** vasa now follows the classical Moon-rashi rule
  (Karka/Simha/Kumbha/Meena → Prithvi; Mesha/Vrishabha/Mithuna/Vrischika →
  Swarga; Kanya/Tula/Dhanu/Makara → Patala) instead of the tithi-half table,
  and `BhadraInfo` gained a piecewise `vasa` segment list for mid-window
  Moon transitions (drik Ujjain 2026-08-19: "Patala upto 02:30 AM, then
  Swarga" — reproduced to the minute). Top-level `location` = vasa at
  window start; window detection and times untouched.

### Fixed — calendar and festival dates

- **Sankranti day rule (SK-1):** a transit during daylight keeps its civil
  day; a transit between sunset and the next sunrise is observed on the
  NEXT sunrise's day (was: the Hindu day containing the transit). Drik's
  full 2027 table discriminates it — Makara Jan 14 21:14 IST → observed
  Jan 15; Tula Oct 18 02:12 → Oct 18; Vrishchika Nov 17 02:02 → Nov 17 —
  and is pinned (day + moment ≤2 min) as a tier-1 test. Night-transit rows
  in 2025/2026 move accordingly (7 of 24); all daytime rows are unchanged.
  `SankrantiEvent` now exposes the transit instant as `moment`. Applied to
  `computeSankrantisForYear` and every festival emission keyed on the
  transit (`sankranti`, `makar_sankranti`, `pongal`, regionals, Lohri /
  Raja Parba neighbors).
- **Kshaya-Dwadashi Ekadashi advance (EK-1):** when the Dwadashi after an
  Ekadashi contains no sunrise there is no valid parana morning, and the
  Smarta fast advances to the day the tithi begins (Trisprisha), with the
  Vaishnava (Gauna) fast on the udaya day. Drik 2027: Pausha Putrada
  Jan 18 + "Trisparsha Mahadwadashi / Gauna" Jan 19; drik 2025 (Devutthana
  Nov 1 / Nov 2) shows the same split. The 2026 list is untouched (tier-1
  re-run green); drik's full 25-date 2027 list is now pinned.
- **Vijayadashami (FE-2):** now keyed on aparahna, not sunrise: the day
  Dashami covers the ENTIRE aparahna kala (3/5→4/5 of daylight) wins; when
  neither day does, the day the tithi ends wins (para-viddha). Recovered
  from 11 drik years (2020–2030) and pinned — includes 2026 Oct 20 and
  2027 Oct 9, both of which the sunrise rule mis-dated by one day.
- **Karva Chauth (FE-3):** now keyed on the Chaturthi prevailing at
  MOONRISE (unclamped Hindu-day moonrise), with a sunrise-prevalence
  fallback when the tithi touches no moonrise on either day (drik 2025:
  Chaturthi missed both moonrises, drik still printed Oct 10). Drik
  2024–2027 pinned; 2027 moves Oct 19 → Oct 18. Sankashti Chaturthi gained
  the same vriddha two-moonrise dedupe.
- **Krishna Janmashtami (FE-1):** the Smarta ladder recovered from 7 drik
  years (2024–2030): the udaya-Ashtami day wins whenever Ashtami OR Rohini
  touches its nishita muhurta; otherwise the day Ashtami covers nishita
  wins, Saptami-viddha or not (2025). Rohini alone never pulls the festival
  onto a Navami day (2028). 2027 moves Aug 24 → Aug 25 (drik's main date);
  2026 stays Sep 4.
- **Kali Yuga year (CV-1):** now increments at Chaitra Shukla Pratipada
  (same `chaitraNewMoon` anchor as `computeSamvat`, keeping Kali − Vikram =
  3044 year-round) instead of the Feb-18 epoch anniversary, which
  mislabeled every date in [Feb 18, Chaitra Pratipada). Drik pins:
  2026-03-01 → 5126, 2026-03-20 → 5127.

### Fixed — muhurta engine and jyotish

- **`scoreMuhurta` ≠ range API (MU-1):** `scoreMuhurta` passed
  `computeEndTimes: false`, so vara×nakshatra special yogas beginning after
  sunrise (amrit_siddhi / sarvartha_siddhi +5, jwalamukhi −10) were scored
  by `computeAuspiciousDatesInRange` and `buildMuhurtaTable` but not by
  `scoreMuhurta`. End times stay on now; a 66-day sweep pins the two entry
  points to identical scores, passes and factor multisets (repro: vivah,
  Delhi, 2027-05-04 — 50 → 60, converged).
- **Upagraha weekday (UP-1/UP-2):** Gulika/Mandi derived the weekday from
  `getUTCDay()` of the sunrise instant, selecting the previous day's slot
  wherever local sunrise falls before 00:00 UTC (lon ≳97.5 °E year-round;
  the ~82–97 °E band in summer). The weekday now comes from the
  longitude-shifted LMT date of that sunrise (Bangkok Friday-noon repro:
  gulika 162.129° → 138.857°); a dead identical-branch ternary was
  collapsed. India-winter charts unchanged (fixture sweep green).
- **Ashtakavarga Sodhana (AV-1/AV-2/AV-3, opt-in `reductions` path):**
  Trikona now subtracts the triad minimum with **no** reduction when a cell
  is 0 (PVR Rule 1 ≡ Maitreya 8's subtract-min; the old code zeroed the
  whole triad). Ekadhipatya now implements the PVR/PyJHora four-case form —
  zero cell → skip; both occupied → skip; one occupied → vacant clamps to
  the occupied value (0 if ≤); both vacant → both take the min, or 0 when
  equal (the old code blanket-zeroed). PVR Chart 7 reproduces the published
  pindas (Mercury reduced row sums 12, not 7). Unreduced BAV/SAV untouched;
  a stale "sum = 336" doc example now reads 337.
- `src/jyotish/aspects.ts` docstring no longer calls Jupiter a malefic.

### Fixed — Smarta / Vaishnava Ekadashi split (VE-1, VE-2)

Closes the divergence the audit tracked but did not fix. DrikPanchang states
the orientation in prose on every Ekadashi date-time page: *"Smartha with
family should observe fasting on first day only. The alternate Ekadashi
fasting, which is the second one, is suggested for Sanyasis, widows and for
those who want Moksha. When alternate Ekadashi fasting is suggested for
Smartha it coincides with Vaishnava Ekadashi fasting day."* So in every split
drik publishes, whatever its tithi geometry, **the earlier day is Smarta and
the later day Vaishnava**.

A sweep of all 109 Ekadashi tithi windows in 2024–2028 (Jaipur) against
drik's year lists found exactly three geometries that make drik print two
days. The library now agrees with all three — 151 emission-days compared,
zero mismatches.

- **Dashami-viddha split was emitted backwards (VE-1):** the library put the
  Vaishnava fast on the viddha day and deferred the *Smarta* fast to
  Dwadashi. It is the Vaishnava observance that rejects an arunodaya-viddha
  Ekadashi; the Smarta fast keeps the udaya-vyapini day. Now: viddha day →
  `smarta_ekadashi` + `ekadashi` (no `vaishnava_ekadashi`); next day →
  `vaishnava_ekadashi`. Pinned on all five pairs drik publishes in 2024–2028
  — Vijaya Mar 6/7 2024, Apara Jun 2/3 2024, Papamochani Mar 25/26 2025,
  Rama Oct 25/26 2027, Aja Aug 16/17 2028. The 96-min (4-ghati) arunodaya
  already in use separates them cleanly: those five tithis begin 15–79 min
  before sunrise against a 132-min minimum across the 94 non-split days.
  The kshaya/Gauna and Trisprisha branches already had this orientation, so
  all three split mechanisms now agree.
- **Vriddha-Dwadashi (Pakshavardhini) split was missing entirely (VE-2):**
  when the Dwadashi following an ordinary Ekadashi prevails at two
  consecutive sunrises, drik moves the alternate (Vaishnava) fast onto that
  Dwadashi and prints a standalone "Vaishnava &lt;name&gt;" row. The library
  emitted nothing on the second day and both fasts on the first. Now
  detected from sunrise tithis alone on the Dwadashi day (no extra rise/set
  search) and with one lookahead on the Ekadashi day. 4 occurrences in
  2024–2028, no counterexamples: Nirjala Jun 6/7 2025, Shravana Putrada
  Aug 23/24 2026, Vijaya Feb 20/21 2028, Devutthana Oct 28/29 2028.
- **i18n:** the three viddha description templates are replaced, since the
  party that defers changed. `desc_ekadashi_deferred_to_dwadashi`,
  `desc_ekadashi_viddha_smarta_next` and `desc_ekadashi_viddha_smarta_today`
  give way to `desc_ekadashi_viddha_vaishnava_next`,
  `desc_ekadashi_viddha_vaishnava_today`,
  `desc_ekadashi_vriddha_dwadashi_next` and
  `desc_ekadashi_vriddha_dwadashi_vaishnava` (en + hi). Only relevant to
  callers supplying a custom locale pack.
- `computeEkadashiDatesForYear` is untouched — its sunrise-prevalence list
  already returns drik's Smarta dates. The 2026 (24-date) and 2027 (25-date)
  tier-1 lists, the kshaya pairs, the vriddha day and the Trisprisha pairs
  are all unchanged.
- **`FestivalInfo.deferralDate` is removed.** It was declared on the type and
  documented as "the Smarta Ekadashi's Dwadashi fast date", but nothing in
  the library ever assigned it — every read got `undefined`. Its premise is
  also backwards now that the deferring party is the Vaishnava fast, and the
  two-day split is already expressed by the emissions themselves.

### Fixed — regional solar new years (SN-1)

The SK-1 sankranti day rule was never carried into the Mesha-anchored
regional new years: `baisakhi`, `vishu`, `pohela_boishakh`, `puthandu` and
`bohag_bihu` all shared one day, and `getHinduNewYear`'s solar path used its
own coarse "first day already in Mesha at 00:00 UTC" sampling. Three of the
four traditions drik publishes key off the transit **moment** differently and
land on different dates in the same year.

Validated against drik's per-region date pages for 2025–2029, whose five
Mesha transits (Apr 14 03:30 · Apr 14 09:39 · Apr 14 15:33 · **Apr 13
21:47** · Apr 14 03:56 IST) cover pre-dawn, morning, afternoon and
post-sunset — without all five the rules are indistinguishable:

| region | rule | 2025 | 2026 | 2027 | 2028 | 2029 |
|---|---|---|---|---|---|---|
| Tamil Nadu (Puthandu) | Sankranti observance day (SK-1) | 14 | 14 | 14 | 14 | 14 |
| Punjab (Vaisakhi) | civil day containing the transit | 14 | 14 | 14 | **13** | 14 |
| Kerala (Vishu) | day of the first sunrise at/after the transit | 14 | **15** | **15** | 14 | 14 |
| West Bengal (Pohela Boishakh) | day after the transit's civil day | **15** | **15** | **15** | 14 | **15** |

- `getHinduNewYear(year, region, …)` now threads the region through and
  computes the transit to the second instead of sampling at 00:00 UTC. Its
  Chaitra Shukla Pratipada path is untouched.
- The three moved keys emit from their own day flags rather than
  `SANKRANTI_REGIONAL[0]`; `puthandu` stays on the transit day. Both
  surfaces (`getHinduNewYear` and the day-panchang emission) now agree, and
  each key fires on exactly one day — pinned as a new tier-1 test,
  `tests/validation/regional-solar-newyear-drik.test.ts` (20 region-years).
- The generic `sankranti`, `makar_sankranti` and `pongal` emissions are
  unchanged, as are the 2027 12-row sankranti pin and the Reykjavik tier-2
  margin test.

### Known divergence (tracked, not fixed here)

- **Bohag Bihu (Assam) is not pinned.** DrikPanchang publishes no Bohag /
  Rongali Bihu date page, so the Assamese rule could not be established to
  the project's ≥2-source bar and the key still rides the Sankranti
  observance day (as Tamil Nadu). Assamese practice generally follows the
  Bengali reckoning — new year on the day *after* the transit's civil day,
  with the transit day itself as Goru Bihu — which would group it with
  `pohela_boishakh` and change its date in 4 of the 5 years above. Left on
  the transit day pending a citable reference rather than guessed at.

## 5.1.0 — 2026-08-14

> **Note:** this minor release deliberately carries one breaking type change
> (`inauspicious.varjyam`), documented below with its migration. It ships as
> 5.1.0 rather than 6.0.0 because v5 is days old; if you consume `varjyam`,
> pin 5.0.x until you have applied the one-line migration.

### Breaking

- **`inauspicious.varjyam` is now `TimePeriod[]`** (was `TimePeriod | null`).
  The old single-window contract evaluated only the nakshatra active at
  sunrise and dropped drik's second Varjyam row on transition days. The field
  now lists every window whose **start** falls in the Hindu day, in start
  order (drik's attribution: a window beginning before sunrise belongs to the
  previous day, even if it runs past sunrise). `[]` when none — the shape now
  follows the v5 collection rule. New export `computeVarjyamWindows(sunriseUtc,
  nextSunriseUtc, getMoon)`; the single-window `computeVarjyam` primitive is
  unchanged in signature and now returns the earliest overlapping window.

### Added

- **Opt-in Gana-dosha cancellation** in `computeAshtakoot` via a new third
  parameter `options: { ganaCancellation?: boolean }` (default `false` —
  default output is byte-identical, preserving drik 36-guna parity). When
  raised, a doshic Gana score (≤ 1) is restored to 6 if the two Moons' sign
  lords are the same graha or mutual naisargika friends; the reason is
  recorded in `cancellations`. Conditions sourced from ≥2 independent pandit
  corpora (Truthstar/MysticGazer, AstroSight, JagannathHora); weaker or
  interpretive conditions are documented on `AshtakootOptions` and not
  encoded.

### Fixed

- **Yogini Dasha starting Yogini was off by three positions for every
  birth.** The classical Devi-Bhagavata rule is (1-based janma nakshatra
  + 3) mod 8 → remainder 1 = Mangala … 0 = Sankata (so Ashwini starts
  Bhramari, Pushya starts Dhanya); the code used `nakIdx % 8` (Ashwini →
  Mangala). Confirmed against published worked examples (Anuradha →
  Bhramari) and PyJHora's per-Yogini star lists, which encode exactly the
  classical formula.
- **Ashtottari Dasha used an invented proportional nakshatra split.** The
  starting lord came from dividing the zodiac in proportion to each lord's
  years from a Krittika anchor (Sun's segment = 1.5 nakshatras), matching
  no consulted source. Replaced with the classical Ardradi group table
  (malefics rule 4 nakshatras each, benefics 3; Sun = Ardra…Ashlesha,
  Venus = Krittika…Mrigashira; exported as `ASHTOTTARI_NAKSHATRA_GROUPS`),
  with the balance taken as the elapsed fraction of the lord's group.
  Verified against PyJHora (27-star form) and Maitreya 8 (28-star form with
  Abhijit) — identical longitude spans, so both sources agree on every
  lord-at-birth and balance this produces. Mula (alone of the 27 nakshatras) carries
  two Varjyam spells, at elapsed ghatikas 20 and 56 of its duration. Only the
  56-spell was tabulated, so days where drik prints Mula's 20-spell window
  (e.g. 2026-08-22, and 2026-09-19 where BOTH land in one day) published
  nothing. Validated against a 61-day drik scrape (Aug–Sep 2026, Ujjain: 62/62
  windows match ≤2 min incl. display truncation), ProKerala's Telugu
  panchangam, and B.V. Raman's *Muhurta* (Moola tyajya = 20).

**Major release.** Held until the ephemeris port landed (Phase 36.2–36.5) so the
whole break arrives once: performance, the table/compute API, the corrected
`Date` contract, the grouped result *and* zero dependencies.

**`panchang-ts` now has no runtime dependencies at all.** The Sun, the Moon,
Mercury–Saturn, ΔT, rise/set, the moon-phase search and both kinds of eclipse
are this library's own code, validated against JPL Horizons / DE441 and the
NASA/Espenak eclipse canon rather than against the implementation they replace.

Every breaking change has a before/after in the README's
[Upgrading from 4.x](README.md#upgrading-from-4x) section.

### Breaking — the result object

- **Every published `Date` is now a real instant.** Through 4.x each one was the
  true instant *shifted* by the UTC offset, so `.getTime()` was not when the
  event happened. `JSON.stringify` emitted a wrong instant labelled `Z`, `Intl`
  with a `timeZone` rendered 12:39 pm for an 07:09 am sunrise, and every
  comparison, diff, database write, date-fns or Temporal call was off by the
  offset. Each instant gains a `*Local` companion — offset-carrying ISO 8601,
  e.g. `"2025-01-14T07:09:44.172+05:30"` — which is what to read for display.
  New export `formatInZone(date, offsetMinutes)` renders any instant the same
  way. Migration: `x.getUTCHours()` → read `xLocal`.
- **The result object is grouped.** ~50 flat top-level fields become seven
  groups — `sun`, `moon`, `angas`, `calendar`, `muhurtas`, `inauspicious`,
  `periods` — plus `date`, `location`, `timezone`, `ayanamsa`, `specialYogas`,
  `anandadiYoga`, `festivals`, `eclipse`, `chandraBalam`, `tarabala` at the top
  level. `getInstantPanchang` uses the same names for the subset an instant can
  answer. Full rename table in the README.
- **One rule for "not applicable".** Every field is always present; a scalar or
  object that does not apply is `null`, a collection is `[]`. Only
  `chandraBalam` and `tarabala` change behaviour — they were `?`-optional and
  are now always present, `null` without `janmaRashi` / `janmaNakshatra`.
  `sections` narrowing likewise nulls and empties rather than removing, so the
  result *shape* never depends on the options.
- **`timezone` is an object**: `{ offsetMinutes, zone? }`, so passing
  `'America/New_York'` produces a result that can say which zone made it. The
  DST limit is now stated rather than implied — the offset resolves once per
  call, so a Hindu day containing a transition is computed at a single offset.
- **`eclipse.magnitude` was publishing obscuration; it is renamed, and a real
  magnitude joins it.** Through 4.x the field carried the fraction of the disc's
  **area** covered. Every published catalogue — NASA/Espenak included — means
  the fraction of its **diameter** by "magnitude", so anyone cross-checking a
  panchang against a catalogue was comparing two different quantities that
  happen to share a name and a range. The values were never wrong, only
  mislabelled: `eclipse.magnitude` → **`eclipse.obscuration`**, unchanged to the
  last bit, and it stays the number to render as a percentage (it is what
  `description` prints). The new **`eclipse.magnitude`** is the catalogue
  quantity, taken from geometry the library already computed and already
  validated: it agrees with the canon's umbral magnitude to **0.0006** across
  all 457 lunar eclipses of 1901–2100. Note that it is **not a [0, 1]
  fraction** — a total eclipse exceeds 1, and a penumbral lunar eclipse is
  *negative*, exactly as the canon prints it, because the Moon misses the umbra
  entirely. Branch on `subtype === 'penumbral'` rather than clamping. The same
  two fields replace the single one on tables built by `buildEclipsesTable`, so
  a cached table built by 4.x must be rebuilt: read against 5.0.0 it yields
  `obscuration: undefined` and a `magnitude` that is still an area fraction.
- **`suryaNakshatra` is typed as a nakshatra**, not a rashi, and is published as
  `sun.nakshatra`. Its index has always been 0..26; the type said `RashiInfo`
  (0..11), so indexing a 12-element rashi array by it produced silent garbage
  for two thirds of the year. Runtime value unchanged.
- **`_debug` removed.** It was in the published type and written nowhere.

### Breaking — values that move

- **Lahiri ayanamsa corrected by +38″.** The constant sat 38 arcseconds behind
  DrikPanchang's; the replacement was solved from Drik's own published values
  across 1950–2050. Nakshatra end-times move ~69 s later, yoga ~129 s (it
  carries the ayanamsa twice), planetary longitudes +0.0106°; tithi and karana
  are unchanged because Moon − Sun cancels the ayanamsa. Drik drift 32.3 s →
  17.4 s.
- **Sunrise is single-valued per location-day.** It used to vary by up to 109 ms
  depending on which caller asked and from which instant they searched. Now
  canonically cached, shifting published sunrise by ≤108 ms.
- **Moonrise / moonset are single-valued per location-day**, the same treatment,
  shifting them by ≤182 ms. Nothing else in the result moves — verified over
  11,520 daily results across six locations and three centuries.
- **`getSankrantisForYear` day rule fixed.**
- **Adhika Masa detection fixed** — `isAdhika` now uses the true bounding new
  moons.
- **Bundled JSON tables removed.** Consumers build and cache their own with the
  `build*Table` functions; the engine-free subpaths remain.
- **The ephemeris is this library's own, and published values move by about a
  second.** Truncated VSOP87D and ELP2000-82B replace `astronomy-engine`'s
  series, and the truncation budgets are set at a quarter of the accuracy
  ceiling rather than a tenth of it. Measured against JPL Horizons / DE441 over
  1900–2100: Sun 1.613″ → **0.323″**, Moon 3.747″ → **1.261″**, and every
  planet between 3× and 23× inside its own ceiling. Measured movement in
  published output, over 241 MB of results spanning 1912 / 2025 / 2088: tithi
  and karana end times ≤776 ms, yoga ≤569 ms, nakshatra ≤368 ms, sunrise-
  proportional windows ≤94 ms, **zero** changes to any index, name, boolean,
  count or festival date. Drik parity is unchanged or marginally better on all
  four elements (worst 60 s → 58 s).
- **Eclipses are computed here too, and their contact times move.** Lunar
  contacts were previously one semi-duration either side of greatest eclipse;
  they are now solved individually against a Danjon-enlarged shadow. Solar
  local circumstances come from a direct topocentric solve. Against NASA:
  lunar type correct on all 457 eclipses of 1901–2100, greatest eclipse within
  3.84 s, umbral magnitude within 0.0006; solar γ within 0.00015 Earth radii on all
  452, and local contact times at ten cities within 43 s over 1901–2002 with a
  −0.75 s bias — the residual there being NASA's own minute-level printing.
- **`isBodyAboveHorizon(date, location, body)` takes `'sun' | 'moon'`.** Its
  `body` parameter was an `astronomy-engine` enum member; that package is no
  longer a dependency, so a public signature could not keep referring to it.

### Breaking — API surface

- **`read*` reads a table, `compute*` runs the engine**, across festivals /
  eclipses / moon-phases / muhurta plus the Ekadashi and Sankranti year
  helpers. Every 4.x name is kept as a deprecated alias bound to the same
  function object.
- **`compute*ForYear`** added for all four families.
- **`precision` option removed** — redundant once element transitions are solved
  by secant rather than binary search.
- **`engines` is now `node >=22`**, up from `>=18`. Nothing in the library
  requires it — v5 was verified to produce bit-identical output on Node 18, 22
  and 24 — but 18 and 20 are both past end-of-life, and the field is a statement
  about what is supported and tested rather than what happens to run. CI tests
  22 and 24.
- **`astronomy-engine` is gone from `dependencies`.** It remains a
  devDependency, used by three Tier 0 tests to measure the baseline this
  release is held against.

### Fixed — muhurta rules, Panchaka, Manglik

Classical rules that had been flattened into absolute per-element verdicts, or
that fell between two modules. Every item below changes output.

- **26 defects across all 13 stock muhurta rules.** The lists were transcribed
  by hand from 1-based classical numbers into 0-based indices, and the seams
  showed: Shukla Chaturdashi — a **Rikta** tithi — was marked *auspicious* in 11
  rules; `vivahRule` listed Ashtami where Navami belonged; Ashlesha sat in the
  Mundan nakshatra list; Dashami was marked inauspicious for Griha Pravesh; and
  12 of 13 rules covered only Shukla paksha in `auspiciousTithis`. Rules now
  build their lists from `bothPakshas(...)`, `RIKTA` and a named nakshatra map
  rather than raw indices, and `tests/unit/muhurta-rules-invariants.test.ts`
  guards the five defect classes.
- **Auspicious entries that no hard exclusion could ever let through.**
  `vivahRule` named Magha, Mula and Revati — three of the eleven canonical vivah
  nakshatras — while `excludeGandaMula` vetoed all three, and listed Ekadashi
  while `excludeEkadashi` vetoed it. Both flags are dropped from `vivahRule`:
  drikpanchang lists Ekadashi among the six *preferred* vivah tithis, and the
  Ganda Mula rejection there is at *pada* granularity, which this model does not
  resolve. Ashlesha and Jyeshtha remain rejected via `inauspiciousNakshatras`.
- **Vara × Tithi yogas are now scored.** Siddha, Amrita, Dagdha, Visha,
  Hutasana, Krakacha and Samvartaka — the combination layer classical muhurta
  actually judges — via the new `computeVaraTithiYogas(vara, tithi)`, applied to
  every rule unless `varaTithiYogas: false`. A Rikta tithi on a Saturday is now
  partly redeemed by Siddha yoga instead of flatly penalised. Where an
  auspicious and an inauspicious yoga both fire, both are surfaced and allowed
  to net out; the sources mark those cells ambiguous and rank no table above
  another.
- **Bhadra is no longer a whole-day veto.** New
  `bhadra?: 'ignore' | 'penalize' | 'exclude'` on `MuhurtaRule`; the stock rules
  use `'penalize'`. Vishti karana sits at fixed positions in the tithi cycle, so
  the old whole-day exclusion deterministically removed seven tithis — including
  Shukla Ekadashi, a *preferred* vivah tithi. `excludeBhadra: true` still works
  as an alias for `bhadra: 'exclude'`; when both are set, `bhadra` wins.
- **Panchaka reports which of the five it is.** New `panchakaInfo` on daily and
  instant results, alongside the unchanged `panchaka` boolean. The type is fixed
  by the weekday the spell *began* on, so it cannot be derived from the day's
  own vara; a Wednesday- or Thursday-onset spell (`'samanya'`) carries no named
  affliction, and `excludePanchaka` no longer vetoes it. Exports
  `classifyPanchaka`, `isPanchakaDosha`, `findPanchakaOnset`.
- **`computeMangalCompatibility(boyChart, girlChart)`.** The mutual-Manglik
  cancellation — both partners Manglik neutralises the dosha — was documented in
  `doshas.ts` as "a matching rule" and deferred, and `matching.ts` never took it
  up, so it existed nowhere. Chart-level cancellations still run first, so an
  exalted-Mars native cannot mutually cancel a genuinely Manglik partner.
- **`MuhurtaFactor.axis` gains `'karana'` and `'varaTithiYoga'`.** Widening only;
  an exhaustive `switch` over the union needs the two new arms.
- **Sarvartha Siddhi rebuilt from DrikPanchang's full 2026 listing.** Drik's
  page serves one month at a time but takes `?date=DD/MM/YYYY`, so all twelve
  months were pulled — 116 windows. Each window is a nakshatra's span clipped to
  its Hindu day, so the table was *derived* from them rather than checked
  against them. Ten cells changed: **added** Sun + Ashwini, Tue + Ashlesha,
  Wed + Krittika; **removed** Sun + Shravana, Mon + Hasta, Tue + Uttara
  Phalguni, Thu + Swati, Fri + Bharani, Fri + Chitra, Sat + Revati — each of the
  seven occurred three to five times in 2026, often across most of the Hindu
  day, with no drik window on any of those dates. The result reconciles
  one-for-one over the year (116 windows, 116 days, nothing missed or spare) and
  independently reproduces the published weekday lists at astrodevam.com /
  shubhpanchang.com for six of seven varas.
- **Griha Pravesh and Vahan Kharidi lists rebuilt against drik's published
  calendars.** Three years of drik's dated shubh-dates pages (2025–2027 Mumbai;
  121 and 311 published muhurat days) falsify several hand-transcribed entries.
  Griha Pravesh: Magha / Hasta / Swati / Shravana appear 0–1 times in three
  years and give way to Mrigashira and Chitra (15–17 each); Saturday — 23
  published days, zero drik weekday rejections — moves from inauspicious to
  auspicious; the `excludeEkadashi` hard veto is dropped (Ekadashi is drik's
  third-most-used griha pravesh tithi) and Dashami / Ekadashi become
  auspicious. Vahan Kharidi sheds the three Sthira nakshatras (0 occurrences in
  three years) for the Chara / Mridu set drik's own prose names — Mrigashira,
  Chitra, Swati, Dhanishtha, Shatabhisha, 30–37 occurrences each — and stops
  banning Ashtami (44 occurrences) and Purnima (23); Sunday joins the
  auspicious weekdays. Vivah survives the same screen untouched: its eleven
  nakshatras are exactly drik's operative set, and drik applies no tithi or
  weekday shuddhi to marriage at all. Pinned in
  `tests/validation/drik-muhurta-lists.test.ts`.
- **ΔT uses measurement where measurement exists.** Espenak–Meeus' post-2005
  branches are a 2006 extrapolation that Earth's rotation did not follow — by
  2026 it read ~5.9 s high and drifting +0.6 s/yr, and that lands directly on
  every published tithi and nakshatra time. `deltaTSeconds` now takes ΔT from
  the leap-second chain (`32.184 + (TAI − UTC)`) from 1972 to the handoff, and
  resumes Espenak–Meeus *offset by the bias it had accrued* beyond it. Holding
  the last observation flat instead would have run ~134 s adrift by 2100 and
  wrecked agreement with NASA's eclipse canon; carrying the offset keeps that to
  ~6.5 s. **Every published instant in the modern era moves by the ΔT delta**
  (~5.7 s for 2025 dates).
- **`getInstantPanchang` reported the wrong vara after ~19:00.** It searched for
  sunrise from `date − 12 h`, which for an evening instant is already past that
  morning's sunrise, so it took *tomorrow's* and rolled the weekday back a day.
  Every evening query returned the previous vara — and with it the wrong Rahu
  Kalam, Choghadiya, Anandadi yoga and special yogas. It now walks to the
  sunrise that actually opens the Hindu day containing the instant.
- **Special yogas are evaluated across the Hindu day, not at sunrise.**
  Amrit Siddhi, Sarvartha Siddhi, Ravi / Guru Pushya, Jwalamukhi, Dwipushkar,
  Tripushkar, Aadal / Vidaal and Ravi yoga qualify on whichever nakshatra is
  running, and a qualifying nakshatra routinely opens *after* sunrise — the old
  sunrise snapshot found only 5 of drik's 8 August Sarvartha Siddhi windows.
  Each (tithi, nakshatra) pair is now evaluated where the two segments actually
  overlap in time, so no combination is scored that never occurs. More yogas
  fire than before, which is the point. `getDailyPanchang` with
  `computeEndTimes: false` keeps the single-snapshot behaviour, since segment
  times are what make overlap checking possible.
- **Amrit Siddhi and Tripushkar validated against DrikPanchang's full 2026
  listings** (Mumbai) — 24 and 16 occurrences, all reproduced exactly, no false
  positives, pinned in `tests/validation/drik-special-yogas.test.ts`. Drik dates
  a window by the calendar day its start falls in; this library attributes it to
  the Hindu day, so a window closing at sunrise is listed by drik on D and
  reported here on D−1. Same interval, different convention.
- **Sarvartha Siddhi confirmed out-of-sample across four city-years.** The
  2026-derived table was re-derived independently from drik's 2025 and 2027
  Mumbai listings and its 2026 New Delhi listing — 471 published windows in
  all. Every dataset exercises exactly the same 35 cells, and splitting each
  window at nakshatra boundaries and sunrises leaves no segment longer than
  2 minutes outside the table. The one disputed cell is settled: Sun + Ashwini
  fires 17 times across the four datasets, Sun + Ashlesha (the astrodevam /
  shubhpanchang variant) never occurs. A handful of drik's pre-dawn windows
  turn out to be dated by Hindu day rather than by the start's civil date —
  each start anchors to a nakshatra boundary that exists only on the following
  date — which also corrects the mechanism behind the withdrawn
  Sat + Punarvasu cell (that window is Pushya's pre-dawn span on Hindu Sunday
  2026-10-04: Sun + Pushya, already carried). All four city-years reconcile in
  `tests/validation/drik-special-yogas.test.ts`.
- **Gana koot deliberately keeps no cancellation set** — now documented rather
  than left looking like an oversight. Bhakoot and Nadi cancellations are
  score-affecting in mainstream practice; the mitigations described for Gana are
  interpretive ("loses significance"), one of them is circular for scoring, and
  no consulted source restores the six points arithmetically.

### Added

- **`buildMuhurtaTable` + the engine-free `panchang-ts/muhurta` subpath**
  (1.70 KB ESM), completing the table family.
- **Emitted tables are dictionary-encoded and carry `key`** — festivals
  315.0 → 89.9 KB (28.5% of the former size).
- **`EclipseInfo` and `EclipseSubtype` are exported.** 4.x published
  `getUpcomingSolarEclipse` / `getUpcomingLunarEclipse` / `getEclipseDuringDay`
  but not the type they return, so their result could be used and never
  annotated. It is the same type as `DailyPanchangResult.eclipse`.
- **`formatInZone`**, and the twelve result-section interfaces (`DailySun`,
  `DailyMoon`, `DailyAngas`, `MuhurtaWindows`, `InauspiciousWindows`,
  `DayPeriods`, …) are exported.
- **Results are now identical across JavaScript engines.** The periodic series
  call this library's own `sin`/`cos` rather than `Math.sin`/`Math.cos`, which
  ECMA-262 does not require to be correctly rounded and which V8,
  JavaScriptCore and Hermes round differently. A tithi boundary found by
  root-finding over a few hundred sines therefore used to land microseconds
  apart on iOS and on Android; it no longer does.

### Performance

Measured against the **published npm artifact** of 4.3.1, not against a source
tree: `notes/vcompare/driver.mjs`, median of 11 processes per configuration per
implementation, one configuration per process, rotating which implementation
runs first so a scheduling stall lands on all of them. The `ctrl/*` control rows
— pure arithmetic, no ephemeris — come out at 1.00×, which is the check that
says the harness measured the library rather than the machine.

| | 4.3.1 (npm) | 5.0.0 | |
|---|---|---|---|
| cold default | 6.0562 | **0.4105** | **−93.2%** (14.8×) |
| cold `computeEndTimes: false` | 5.6322 | **0.3913** | −93.1% (14.4×) |
| cold `getInstantPanchang` | 0.4344 | **0.2081** | −52.1% |
| warm default | 6.1982 | **0.1677** | −97.3% (37.0×) |
| warm `getInstantPanchang` | 0.3941 | **0.1044** | −73.5% |
| `getFestivalsInRange`, ms/yr | 2177.1 | **130.5** | −94.0% (16.7×) |
| `getEkadashiDatesForYear`, ms/yr | 2362.0 | **18.0** | −99.2% (131×) |
| `getSankrantisForYear`, ms/yr | 153.7 | **3.29** | −97.9% (46.7×) |
| `computeShadbala` / `computeBhavaBala` | 0.719 / 0.731 | **0.333 / 0.340** | −54% |
| `computeSunrise`, cold | 0.0382 | **0.0389** | +1.8% |
| `getSunset`, cold | 0.0353 | **0.0384** | +8.8% |
| `getMoonrise`, cold | 0.0784 | **0.0827** | +5.5% |
| `getMoonset`, cold | 0.0775 | **0.0826** | +6.6% |
| **`computeRashiChart` / `computeNavamsa`** | 0.0975 / 0.0944 | **0.318 / 0.314** | **+226% / +233%** |

**Charts are 3.3× slower, and that is a trade, not a regression.** It is
entirely the planetary ephemeris, and it buys accuracy against DE441 that the
old one could not reach: Mercury 6.504″ → **0.296″**, Venus 19.586″ → **0.862″**.
A chart-heavy consumer pays about a fifth of a millisecond per chart and stops
carrying a 6.5-arcsecond Mercury. `computeShadbala` and `computeBhavaBala` still
come out ahead because they build the natal positions once and derive all seven
charts from them.

**A single cold rise/set primitive is between unchanged and ~9% slower**, and
that is the honest statement — earlier drafts of these notes claimed −25% and
−39% for the two rise calls, and did not mention the two set calls at all. All
four are in the table above. The canonical per-location-day rise/set cache does
not make one cold call cheaper; what it buys is that the second call for the
same day is free, and that an event has one timestamp no matter who asks. The
gain shows up in `getDailyPanchang` and in the range helpers, which is where
those calls actually happen.

*Measured a second way, for anyone comparing against the development history
rather than against npm: the tree this work started from — version-labelled
`4.3.1` but already carrying seven unpublished commits — runs the default call
in 0.9749 ms, so against it the change is −57.9% rather than −93.2%. Both
numbers are in [docs/v5-validation-report.md](docs/v5-validation-report.md)
§ "Step 5, third pass", along with why the second one is not a 4.3.1 figure.*

Two phases of work. **Structural** (36.1): Chebyshev interpolation of Sun/Moon
longitudes over shared blocks, a canonical per-location-day rise/set cache for
both bodies, the eclipse syzygy guard routed through the call's cache.
**Then the own ephemeris**, which arrived 21% *slower* and left with the
following, in order of what each was worth:

- own `sin`/`cos` (`src/astronomy/trig.ts`) — **−54% of the lunar series
  evaluation**, the single largest win in the release. `Math.sin` was measured
  at 77% of that loop, most of it argument reduction for a range these series
  never approach;
- truncation budgets set at a quarter of the accuracy ceiling rather than a
  tenth — **−19%** of a cold call;
- nutation by angle addition — 156 transcendental calls become 28, cutting
  `sumNutation` from 6.1% of self time to 1.1%;
- the planetary light-time iteration from three passes to two, with Earth's
  heliocentric vector memoized on the exact epoch — **−12% on `computeShadbala`
  and `computeBhavaBala`**;
- a table-driven `formatInZone`, and a 16-entry nutation memo sized for the
  track nodes a calendar day actually reads;
- **the rise/set position track fitted over four days instead of one** — the
  last structural step, and the one that closed the gap. `riseSet.ts` had built
  a 7-node Chebyshev fit of each body's equatorial position *per UTC day*; it
  now builds an 11-node fit per four days, which is 2.75 full lunar series
  evaluations a day against 7.0. Measured at **−16.4%** of a cold call, −45% on
  `getMoonrise` and −26% on `computeSunrise`, and the accuracy is not traded for
  it: the fit's error is 6 × 10⁻⁴″ either way, because at both widths it sits on
  the millisecond quantization of `new Date()` rather than on the polynomial.
  Eight-day blocks are a cliff (50× worse) — ELP carries argument families near
  a five-day period — and `notes/track-fit.src.ts` is the sweep that says so.

**The "roughly halved" target is met on both baselines**, which it had
previously been claimed to clear by 3.9% on one machine and to miss on another.
Against the tree the criterion was written for: 0.9749 → **0.4105 ms**, −57.9%.
Against what users have: −93.2%.

### Validation

- **Tier 0 ground truth committed**: 1,750 geocentric apparent positions from
  JPL Horizons / DE441 spanning 1900–2100, plus ΔT at 21 decades. Neither
  originates from this library, which is what lets them adjudicate an ephemeris
  change.
- **Baseline error curve of the current implementation recorded** — max |error|
  vs DE441: Sun 1.61″, Moon 3.75″, Mercury 6.50″, Venus 19.59″, Mars 11.10″,
  Jupiter 9.66″, Saturn 11.15″. This is the ceiling the own-ephemeris work must
  come in at or below.

- **What shipped, against those ceilings** — max |error| vs DE441 over the same
  250 epochs: Sun **0.32″**, Moon **1.26″**, Mercury **0.30″**, Venus **0.86″**,
  Mars **1.29″**, Jupiter **0.84″**, Saturn **0.86″**. Every body is 3× to 23×
  inside its ceiling; the Moon is the tightest at 2.97×.
- **The generator's error figures are now measured over 100,000 epochs, not
  600.** Each series' term count comes from a binary search on the *measured*
  disagreement with the untruncated theory, so the budget it advertised was a
  600-sample maximum — and the 100,000-instant differential test measured 13–25%
  more than that. Raising the sample does not converge (the residual's supremum
  over a two-century span is an extreme-value problem, and at 100,000 draws
  consecutive probes are still 13 days apart), so it is anchored instead at
  exactly the sample size the differential test uses. The generator can no
  longer advertise a budget the test verifying it then exceeds. Series grew
  9–34%; accuracy improved on every body.
- **The planet path has its own Earth series.** A geocentric planetary direction
  is `planet − Earth`, so it inherits Earth's heliocentric error amplified by
  `r_E / Δ` — and Earth's series *is* the Sun's, whose budget was set for the
  Sun. The generator now emits it twice: coarse for the solar path, ≤0.1″ for
  `earthRect`, which the planets read. Mercury 0.50 → 0.30″ and Venus 1.22 →
  0.86″, at +11% on `computeShadbala` and +11 KB of bundle.
- **`buildMuhurtaTable` threw a `TypeError` from inside the scorer when `rule`
  was omitted.** It validated `location`, `startYear` and `endYear` but not the
  fourth required option, so a JavaScript caller got
  `Cannot read properties of undefined (reading 'excludeBhadra')` four frames
  deep instead of a message naming the problem. Found by installing the packed
  tarball and using it as a consumer.
- **`repository`, `homepage` and `bugs` were missing from `package.json`** —
  absent since before 4.3.1, so npm showed no source link and no issue tracker.
- **Dead module removed**: `src/utils/perf.ts` (`withTiming`) was imported by
  nothing and carried the package's only non-example `console.log`.
- **`boundingNewMoons` could put an instant sitting exactly on a new moon into
  the previous lunation**, and therefore report the previous Chandra Masa for
  it. `searchMoonPhase` rounds its converged root to a whole millisecond and the
  same syzygy reached from a different seed can round the other way, so an exact
  `prev <= ref` comparison rejected the fast path and the fallback scan then
  walked back a month. Found by a test failing after the series were
  regenerated, not by the regeneration causing it.
- **Ten fixture-free cross-checks** (mean motion, closure identities, solver-vs-
  bisection separation, ordering invariants) that contain no number produced by
  this library and so cannot be re-pinned.
- **The published eclipse fields are now checked, not just the geometry behind
  them.** `EclipseInfo.magnitude` carried an obscuration through two Tier 0
  files, 909 canon rows and 8,000-odd tests without a single failure, because
  every assertion read `findLunarEclipse` directly and none read what the
  panchang layer chose to publish out of it. The new assertions drive the public
  entry points and compare the fields a consumer receives against the canon's
  own columns — including the sign of the magnitude, which is what a well-meant
  clamp into [0, 1] would destroy.
- **The one place a sub-ten-second ephemeris movement can change a published
  calendar date is now pinned.** `computeSankrantisForYear` publishes a date,
  and the date is decided by whether the transit falls before or after that
  morning's sunrise — so when the two are seconds apart, a movement inside the
  release's own error bar flips the day, discontinuously, and the before/after
  harness cannot see it coming because the only observable leaf is the date.
  The Tula Sankranti of 2025 at Reykjavik sits **7.1 s before** sunrise, against
  a solar accuracy worth **7.8 s** of transit instant. It is not a bug and it is
  not fixed; it is now loud —
  `tests/validation/tier2-sankranti-day-margin.test.ts` pins the instant, the
  margin and the two festival entries that ride on it, and says in the file that
  a failure means the day may have moved and the list must be re-checked by hand
  rather than re-pinned.
- **Test tiers are enforced by a test**, not a convention — see
  [tests/TIERS.md](tests/TIERS.md).
- `tsconfig.test.json` inherited an `exclude` that dropped `tests`, so
  `npm run typecheck` had been checking only `src` while reporting success.
  Fixed; the 483 pre-existing errors it had been hiding are cleared, including a
  Varjyam test that had been dead since its imported constant was deleted.
- **NASA/Espenak eclipse ground truth committed**: the Five Millennium Canon
  (457 lunar + 452 solar rows, 1901–2100) and the city catalogs (788 solar local
  circumstances at 10 sites). The second is what closes the gap PLAN.md §36.5
  called "the thinnest Tier 0 coverage" — a geocentric canon cannot say when the
  partial phase begins at Varanasi, and a differential test against the package
  being removed would have carried no authority.
- **Four frozen reference implementations and five differential tests.** Every
  optimization is checked against a slow, obvious twin rather than against
  intuition: the untruncated VSOP87D/ELP2000-82B/IAU-2000A series, a rise/set
  solver that interpolates nothing, an eclipse solver that finds its roots by
  exhaustive scan, and the direct per-term nutation summation.
- **A finding that only Tier 0 could produce.** The lunar shadow enlargement is
  Danjon's rule on the Earth's radius, not 2% on the shadow radii — identified
  by inverting the canon's own 457 published magnitudes, which show the 2%
  reading is not even self-consistent. Before the correction, two eclipses were
  mis-typed.
- **A finding about the reference, not the code.** The frozen eclipse solver
  originally minimised by golden section, and golden section was *less accurate
  than the fast path it was checking* — near a flat minimum it compares samples
  that differ by ~10⁻¹⁴, below the noise floor of an `atan2` of a cross product.
  Replaced by nested enumeration.

**8,368 tests** across 121 files, green over five consecutive runs. Bundle
584.0 KB CJS against 4.3.1's 395.5 KB (gzip 146.1 against 96.0 KB) — but the
**installed footprint falls 4.87 MB → 1.74 MB**, because the coefficient tables
this package now carries are a fraction of the dependency they replace.
**Zero invariant-test changes** across the release, over three separate 241 MB
before/after comparisons; three numeric fixture families re-pinned, each with
the delta predicted before it was observed.

## 4.3.0

**Minor release — eclipses + moon-phases static tables (Wave 6), plus an
eclipse visibility refinement.** Two new engine-free subpath exports join
`panchang-ts/festivals`. All additive — every prior export keeps its shape.

### Highlights

- **`panchang-ts/eclipses`** — bundled, engine-free eclipse table for India
  (Varanasi / IST), a rolling 2-years-past / 5-years-future window. Accessors
  `getEclipsesForYear` / `getEclipsesForDate`, plus `ECLIPSES_META` /
  `ECLIPSES_YEAR_RANGE`. Each entry carries `kind` / `subtype` / `start` /
  `peak` / `end` (ISO UTC) / `magnitude` / `visibleFromLocation` /
  `visibleAtPeak` / `sutak`, in en + hi. Solar eclipses report the subtype seen
  locally (a globally-total eclipse may read `partial`); penumbral lunar
  eclipses carry no `sutak` and are not religiously observed (drik / pandit
  consensus).
- **Eclipse any-phase visibility** — the table lists an eclipse if the eclipsed
  body is above the horizon during *any* phase (not just at peak), so one
  already in progress at moon/sunrise or moon/sunset is included (e.g. the
  2026-03-03 total lunar, which rises already eclipsed). `visibleFromLocation`
  now means any-phase-visible; the new `visibleAtPeak` flags whether greatest
  eclipse itself is observable. New helper
  `isEclipseVisibleAnyPhase(eclipse, location)`.
- **`panchang-ts/moon-phases`** — bundled, engine-free lunar-phase table (new /
  first quarter / full / last quarter) for India (IST). Accessors
  `getMoonPhasesForYear` / `getMoonPhasesForDate`, plus `MOON_PHASES_META` /
  `MOON_PHASES_YEAR_RANGE`. ~49 events/year as precise instants, en + hi (new =
  Amavasya, full = Purnima) — distinct from the same-named *tithis*, which are
  ~24h windows. Phases are location-independent instants, so the bundled table
  only maps each onto its IST calendar date.
- **Runtime builders** (main entry, use the engine) for non-IST locations:
  `buildEclipsesTable`, `buildMoonPhasesTable`, plus range enumerators
  `getEclipsesInRange` and `getMoonPhasesInRange`. Build once, cache the JSON,
  pass it as the `source` argument to the accessors — interchangeable with the
  bundled table.

### Fixes

- **Adhika (leap) masa detection** — `getDailyPanchang`'s `chandraMasa.isAdhika`
  and masa naming are now derived from the **true bounding new-moon instants**
  and the sidereal Sun's rashi at each (new internal `newMoon` helper;
  `computeChandraMasa` gained `refDate` + `getSiderealSun` parameters),
  replacing the prior approximation. Corrects masa output around adhik-masa
  boundaries — e.g. Adhik Jyeshtha (17 May – 15 Jun 2026). Internal change only;
  the public type surface is unchanged.

## 4.2.0

**Minor release — festivals static table.** New engine-free
`panchang-ts/festivals` subpath: a bundled, pre-computed festival table for
India (Varanasi / IST, rolling 2-past / 5-future window), plus
`buildFestivalsTable` to compute and cache a table for any location at runtime.
Accessors `getFestivalsForYear` / `getFestivalsForDate`, en + hi; eclipses are
excluded (location-dependent — now served by `panchang-ts/eclipses`).

## 3.4.0

**Minor release — Phase 33 Wave 4c: Pathu Porutham + Narayan Dasha
+ KP sub-lord layer + Prashna foundation.** South-Indian regional
features that the v3.3 surface skipped. Closes Wave 4 of the roadmap.
All additive on top of v3.3 — every prior export keeps the same shape.

### Highlights

- **`computePathuPorutham`** — Tamil/Kerala 10-fold marriage
  compatibility, the South-Indian counterpart to Ashtakoot. Each koot
  is binary-scored (pass / fail) per the AstroVed / Drik Tamil
  convention; aggregate is a 0..10 count. Three vetoes (Yoni, Rajju,
  Vedha) flip `recommended` to false regardless of count. Reuses Phase
  29 NAKSHATRA_YONI / NAKSHATRA_GANA / RASHI_VASHYA / NAISARGIKA_MAITRI
  tables; introduces `NAKSHATRA_RAJJU` (5-band Pada/Kati/Nabhi/Kantha/
  Sira classification) and 13 `VEDHA_PAIRS`. Same `NatalMoon` input as
  Ashtakoot — call both side-by-side.
- **`computeNarayanDasha`** — Jaimini sign-based dasha with
  parity-based direction per Sanjay Rath, *Narayana Dasa* (Sagar
  Publications). Vishama-pada lagnas {Aries, Taurus, Gemini, Libra,
  Scorpio, Sagittarius} → forward; sama-pada lagnas {Cancer, Leo,
  Virgo, Capricorn, Aquarius, Pisces} → backward. Years per rashi
  follow the same Movable 9 / Fixed 8 / Dual 7 scheme as Chara
  (CHARA_RASHI_YEARS reused). 12 Mahadashas covering ~96 years.
  Antardasha breakdown deferred — the Mahadasha is the dominant
  Jaimini timing layer.
- **`computeKpSubLord` / `computeKpCuspalSubLords` /
  `computeKpSignificators`** — K.S. Krishnamurti's KP-Paddhati 9-fold
  nakshatra subdivision. Sub-lord at any longitude follows the
  Vimshottari cycle starting from the star-lord, each lord's sub-width
  proportional to its dasha-years (`(years / 120) × 13°20'`). Cuspal
  sub-lords compute from the 12 Placidus-KP cusps (forces
  `houseSystem: 'placidus-kp'` regardless of caller-supplied option —
  KP analysis is anchored on cuspal positions). Significators apply
  the 4-fold KP rule (occupant + star-lord-occupant + owner +
  star-lord-owner) and surface results both keyed by planet and by
  house.
- **`computePrashnaChart`** — chart-cast helper for horary
  (question-time) analysis. Thin intent-named wrapper over
  `computeRashiChart` with `houseSystem: 'placidus-kp'` defaulted (KP
  horary anchor). Returns the same `BirthChart` shape, enabling KP
  cuspal sub-lord and significator analysis on top. Ruling Planets,
  KP horary 1..249 numbers, and significator-driven event timing are
  deferred to a later phase — the foundation lands additively.

### New API surface

```ts
// Pathu Porutham
export function computePathuPorutham(boy: NatalMoon, girl: NatalMoon): PathuPoruthamResult;
export type { PoruthamName, PoruthamScore, PathuPoruthamResult };

// Narayan Dasha (Jaimini, parity direction)
export function computeNarayanDasha(
  birthDate: Date, location: GeoLocation, ayanamsa?: AyanamsaType,
): NarayanDashaResult;
export const VISHAMA_PADA_RASHIS: ReadonlySet<number>;
export const SAMA_PADA_RASHIS: ReadonlySet<number>;
export type { NarayanMahaDasha, NarayanDashaResult };

// KP sub-lord layer
export function computeKpSubLord(siderealLongitude: number): KpSubLordInfo;
export function computeKpCuspalSubLords(
  birthDate: Date, location: GeoLocation, options?: BirthChartOptions,
): KpCuspalSubLords;
export function computeKpSignificators(chart: BirthChart): KpSignificators;
export type { KpSubLordInfo, KpCuspalSubLords, KpSignificators };

// Prashna foundation
export function computePrashnaChart(
  questionMoment: Date, location: GeoLocation, options?: BirthChartOptions,
): BirthChart;
```

### Stats

- **+156 tests** → **7,707 total** across 95 files.
  - Pathu Porutham: 62 tests (per-koot rules + aggregate threshold + 20-pair
    smoke sweep).
  - Narayan Dasha: 39 tests (parity classification + forward/backward
    sequence pinning + R-tier fixture sweep).
  - KP sub-lord: 46 tests (sub-width invariants, sub-cycle pinning across
    nakshatras, cuspal sub-lord + significator round-trip + fixture sweep).
  - Prashna: 9 tests (parity with `computeRashiChart` + house-system /
    ayanamsa overrides + validation).
- **Bundle.** 361 KB CJS / 358 KB ESM (under the 410 KB target; was 349 KB
  CJS at v3.3.0).
- **Hermes JS-syntax check** passes; `tsc --noEmit` clean.

### Migration

Fully additive — no v3.3 breakage. No new error codes (Pathu Porutham
shape validation reuses RangeError from Ashtakoot). No locale
additions — Porutham names, KP planet names, and Narayan dasha lord
names are English/transliterated proper nouns and intentionally not
locale-resolved (consistent with Phase 29's NAKSHATRA_YONI / Phase 31's
yoga catalog / Phase 32's Saham names).

## 3.3.0

**Minor release — Phase 32 Wave 4b: Varshaphala + Tithi Pravesha + Arudha
+ Special Lagnas + Upagrahas + Argala.** Rounds out the niche-but-classical
chart layers that the v3.2 surface skipped. All additive on top of v3.2 —
every prior export keeps the same shape.

### Highlights

- **`computeVarshaphala`** — Tajik annual (solar-return) chart. Newton-
  refined solar-return instant (sidereal Sun back to natal lon to within
  0.0001°), Muntha (`(natalLagnaRashi + N) mod 12`), year lord by max
  Shadbala among 4 candidates (varsha lagna lord, Muntha lord, Sun's
  rashi lord, Triraashi Pati per day/night element table), and the
  **27-Saham core set** (Punya, Vidya, Yasas, Mitra, Karma, Vivaha,
  Putra, Roga, Marana, Rajya, Raja, Bandhu, Dharma, Gnati, Apamrityu,
  Bhratri, Matri, Pitri, Sama, Bandhana, Karyasiddhi, Vyapara, Sastra,
  Asha, Labha, Susha, Tapas) with Neelakantha day/night X-Y swap on the
  9 flagged Sahams. The 50-Saham extended list is deferred — the table
  in `src/jyotish/sahamsTables.ts` is data-driven so adding more is a
  one-row change.
- **`computeTithiPravesha`** — South-Indian annual soli-lunar return
  per **PVR Narasimha Rao's redefinition**: cast at the moment in year-N
  when the sidereal Sun is in its natal sidereal sign AND the Sun-Moon
  separation equals the natal separation. The natal tithi is preserved
  exactly (`praveshTithi === natalTithi`). Newton-iterates on the
  Moon-Sun phase deviation (~12.19°/day rate); if the closest tithi-
  match falls on the wrong side of a sign boundary, shifts by one
  synodic month (~29.5d) toward the solar-return centre.
- **`computeArudhas`** — 12 Arudha padas per Jaimini *Upadesa Sutras*
  Ch. 1 (Sanjay Rath commentary). Includes the two canonical exceptions
  (lord in own bhava → 10th from lord; lord in 7th from bhava → 4th
  from lord). `arudhaLord` is the rashi-lord of the *Arudha rashi*
  itself — useful for analysing the pada's significations directly.
- **`computeHoraLagna` / `computeGhatiLagna` / `computeBhavaLagna` /
  `computeSripatiLagna`** — time-derived special lagnas advanced from
  the most recent sunrise. Hora and Bhava both at 15°/hour (per the
  `Phaladeepika` Ch. 1 rate the library follows); Ghati at 75°/hour;
  Sripati = natal lagna in the cusp form.
- **`computeUpagrahas`** — 7 sub-graha **positions** (vs the existing
  Gulika *Kalam* time form). Gulika and Mandi are the rising longitudes
  at the start and midpoint of Saturn's 1/8-day-or-night segment per
  weekday-lord rotation (day) or 5-day-shifted rotation (night, per
  Phaladeepika Ch. 5). Sun-derived: Dhuma = Sun + 133°20'; Vyatipata
  = 360 − Dhuma; Parivesha = Vyatipata + 180; Indrachapa = 360 −
  Parivesha; Upaketu = Indrachapa + 16°40'.
- **`computeArgala`** — per-bhava Jaimini intervention rules. Planets
  in 2/4/11 from a bhava form Argala; planets in 3/10/12 form
  Virodhargala. Pure house arithmetic on `chart.planets[i].house`.
  Structural invariant: every planet contributes to exactly 6 bhavas
  (3 Argala + 3 Virodhargala).

### New API surface

```ts
// Varshaphala (Tajik annual chart)
export function computeVarshaphala(
  natalBirth: Date, yearAge: number,
  location: GeoLocation, options?: BirthChartOptions,
): VarshaphalaChart;
export const ALL_SAHAM_NAMES: readonly SahamName[];

// Tithi Pravesha (annual soli-lunar return)
export function computeTithiPravesha(
  natalBirth: Date, yearAge: number,
  location: GeoLocation, options?: BirthChartOptions,
): TithiPraveshaChart;

// Arudha
export function computeArudhas(chart: BirthChart, lang?: Language): Arudha[];

// Special lagnas
export function computeHoraLagna(birthDate: Date, location: GeoLocation,
                                 ayanamsa?: AyanamsaType, lang?: Language): LagnaInfo;
export function computeGhatiLagna(...): LagnaInfo;
export function computeBhavaLagna(...): LagnaInfo;
export function computeSripatiLagna(...): LagnaInfo;

// Upagrahas (7 sub-graha positions)
export function computeUpagrahas(
  birthDate: Date, location: GeoLocation, options?: BirthChartOptions,
): Upagrahas;

// Argala (Jaimini intervention)
export function computeArgala(chart: BirthChart): ArgalaPerBhava[];
```

### Type surface additions

- `VarshaphalaChart`, `MunthaInfo`, `SahamPosition`, `SahamName`,
  `SahamOperand`, `SahamFormula`.
- `TithiPraveshaChart`.
- `Arudha`, `SpecialLagnaKind`.
- `UpagrahaPosition`, `Upagrahas`.
- `ArgalaPerBhava`.

`PanchangErrorCode` extended with `'INVALID_INPUT'` and
`'SAHAM_DEPENDENCY_ERROR'` for Varshaphala / Tithi-Pravesha argument
validation and the Saham operand-resolution chain.

### Sourcing notes

- **Varshaphala** — Neelakantha *Tajika Neelakanthi* (1587 CE), the
  canonical Tajik primer; B.V. Raman *Annual Horoscope*; Sanjay Rath
  *Crux of Vedic Astrology* Tajik appendix; PVR Narasimha Rao Tajik
  notes (Saptarishis Astrology). Saham formulas are pinned per
  Neelakantha; multiple Tajik commentators (Hari Hara) define
  different swap subsets — documented per row in
  `src/jyotish/sahamsTables.ts`. The 27-Saham core set is shipped;
  the extended 50-Saham list is deferred.
- **Tithi Pravesha** — Sanjay Rath, *Tithi Pravesha* (srath.com);
  PVR Narasimha Rao, *Re-Defining Tithi Pravesha Chart* (Saptarishis
  Astrology Vol. 8). The PVR redefinition is preferred over the
  older calendar-anniversary heuristic.
- **Arudha** — Jaimini *Upadesa Sutras* Ch. 1; Sanjay Rath *Jaimini
  Maharishi's Upadesa Sutras* (commentary); BPHS Ch. 29.
- **Special lagnas** — BPHS Ch. 4; *Phaladeepika* Ch. 1; Sripati
  *Sripati Paddhati*. Hora and Bhava Lagna are numerically identical
  under this library's 15°/hour rate convention; some BPHS recensions
  use a faster 30°/hour Hora.
- **Upagrahas** — BPHS Ch. 5; Phaladeepika Ch. 5 (night-rotation
  rule); Sanjay Rath *Brihat Nakshatra* (upagraha section).
- **Argala** — Jaimini *Upadesa Sutras* Ch. 1; BPHS Ch. 51 (simplified
  2/4/11 vs 3/10/12 form). The 5th and 9th from a bhava ("primary
  Argala / Virodhargala" in some extended schemes) are not included.

## 3.2.0

**Minor release — Phase 31 Wave 4a: Ashtakavarga + Yogas + Karakas + Bhava Bala.**
Adds the pan-Indian Parashara classical core that was missing from the v3.1
surface: per-graha Ashtakavarga grids with optional Sodhana reductions, a
fixed-catalog named-yoga detector (~25 yogas across 8 types), the 7-Karaka
Parashara variant of Jaimini Karakas, and BPHS Ch. 27 four-source Bhava
Bala. All additive on top of v3.1 — every prior export keeps the same
shape.

### Highlights

- **`computeAshtakavarga`** — BPHS Ch. 66 per-graha 12-rashi bindu grids
  (Bhinnashtaka) and the summed Sarvashtaka grid. The 7 × 8 BENEFIC_OFFSETS
  table is the canonical form used by ProKerala / AstroSage / PyJHora /
  JagannathaHora — pinned cell-by-cell and verified against per-receiver
  invariants (Sun=47, Moon=49, Mars=39, Mercury=54, Jupiter=56, Venus=52,
  Saturn=39 → Sarvashtaka=336). Optional `{ reductions: true }` returns
  Trikona + Ekadhipatya Sodhana grids per BPHS Ch. 67.
- **`computeYogas`** — ~25 named classical yogas detected from a natal
  chart against a fixed declarative catalog. The 8 types covered:
  - **Mahapurusha** (5): Ruchaka, Bhadra, Hamsa, Malavya, Sasha
  - **Lunar** (5): Gajakesari, Sunapha, Anapha, Durudhura, Kemadruma
  - **Solar** (4): Budha-Aditya, Veshi, Vasi, Ubhayachari
  - **Raja** (4): Raja Yoga (generic kendra/trikona), Dharma-Karmadhipati,
    Vipareeta Raja Yoga, Lakshmi Yoga
  - **Dhana** (3): Dhana Yoga (2-11), Dhana Yoga (5-9), Vasumati Yoga
  - **Special** (2): Vargottama (D9 required), Yogakaraka
  - **Cancellation** (1): Neecha Bhanga (3 sub-rules)
  - **Negative** (1): Daridra Yoga
  Adding a new yoga is a data-only change in `src/jyotish/yogasCatalog.ts`
  — the engine is a thin loop over the catalog. Each match returns one or
  more human-readable `reasons[]` strings.
- **`computeJaiminiKarakas`** — 7-Karaka Parashara variant. The 7 visible
  grahas ranked by descending degree-in-rashi → Atmakaraka, Amatyakaraka,
  Bhratrukaraka, Matrukaraka, Putrakaraka, Gnatikaraka, Darakaraka. Stable
  tie-break order (Sun → Moon → Mars → Mercury → Jupiter → Venus → Saturn)
  on the rare exact-degree tie.
- **`computeBhavaBala`** — BPHS Ch. 27 four-source house strength for the
  12 bhavas in Virupas. Components: **bhavadhipati** (Shadbala total of
  the rashi-lord), **dik** (fixed 12-cell directional table), **drik** (net
  aspect strength on the cusp, clamped ≥ 0), **sthana** (sum of Naisargika
  for occupants — benefics +, malefics −). Built on top of `computeShadbala`
  (chart + sub-bala internals are computed once and reused).

### New API surface

```ts
// Ashtakavarga
export function computeAshtakavarga(
  chart: BirthChart,
  options?: { reductions?: boolean },
): AshtakavargaResult;

// Yogas
export function computeYogas(chart: BirthChart, options?: ComputeYogasOptions): Yoga[];

// Karakas
export function computeJaiminiKarakas(chart: BirthChart): JaiminiKarakas;

// Bhava Bala (lives next to Shadbala in the same module)
export function computeBhavaBala(
  birthDate: Date, location: GeoLocation, options?: BirthChartOptions,
): BhavaBalaResult;
```

### Type surface additions

- `AshtakavargaResult`, `BhinnashtakaGrid`.
- `Yoga`, `YogaName` (25 entries), `YogaType` (8 categories),
  `ComputeYogasOptions`.
- `KarakaName` (7 entries), `JaiminiKarakas`.
- `BhavaBalaPerHouse`, `BhavaBalaResult`.

### Sourcing notes

- **Ashtakavarga** — BPHS Chs. 66 (BENEFIC_OFFSETS) + 67 (Sodhana). Cross-
  checked against Phaladeepika Ch. 31 and Sanjay Rath *Visti Nadi*. The
  Ekadhipatya Sodhana implementation follows the most-cited Santhanam
  recension; multiple recensions exist in the literature and are
  documented in the source.
- **Yogas** — BPHS Chs. 36–43 (Mahapurusha, lunar, solar, raja),
  Ch. 41 (Vipareeta, Daridra), Ch. 14 (Vargottama doctrine), Ch. 36
  (Neecha Bhanga sub-rules); Phaladeepika Ch. 6; B.V. Raman *Three
  Hundred Important Combinations*; Sanjay Rath *Crux of Vedic Astrology*
  Ch. 9. Yoga names are English/transliterated proper nouns and are
  intentionally **not** locale-resolved — `'Gajakesari'` reads the same
  in `'en'` and `'hi'`.
- **Karakas** — Jaimini *Upadesa Sutras* Ch. 1; Sanjay Rath *Jaimini
  Maharishi's Upadesa Sutras*. The 7-Karaka Parashara variant is shipped;
  the reversed-Rahu 8-Karaka Jaimini variant is **not** computed.
- **Bhava Bala** — BPHS Ch. 27 second half ("Bhava-bala-vichar"). The
  four-source decomposition is canonical; the per-bhava `dik` table uses
  cardinal-anchor / linear-interpolation values matching the simplified
  scheme in Sanjay Rath *Crux of Vedic Astrology* Ch. 6. Classical
  recensions vary on the exact intermediate-bhava values.

### Documented limitations

- Sthana Bala in `computeShadbala` (and therefore `bhavadhipati` in
  `computeBhavaBala`) is the **Uchcha Bala only** — the dominant term.
  Saptavargaja / Ojha-Yugma / Kendra / Drekkana sub-balas are intentionally
  omitted, matching the simplified scheme noted in v3.1.
- The Ekadhipatya Sodhana reduction follows the Santhanam BPHS Ch. 67
  formulation; alternate recensions (e.g. Sharma) produce slightly
  different reduced totals and are not selectable.
- `computeYogas` evaluates the catalog as a **flat list** — the classical
  notion of a yoga being broken or modified by an aspecting malefic is
  not modeled (each rule fires independently).
- Vargottama in `computeYogas` requires the D9 to be passed via
  `options.navamsa`; without it the rule is silently skipped.

### Breaking changes

None. Phase 31 is fully additive — every v3.1 export keeps the same shape.

### Bundle / runtime

- Bundle size: **~327 KB CJS** (was ~302 KB in v3.1; +25 KB). No new
  runtime dependencies.
- Hermes JS-syntax check ✅ — every new module passes
  `npm run test:hermes`.

### Test count

**7,355** tests passing across 85 files (was 7,156 in v3.1 → **+199**).
New test files: `tests/unit/ashtakavarga.test.ts`,
`tests/unit/yogas.test.ts`, `tests/unit/karakas.test.ts`,
`tests/unit/bhavaBala.test.ts`.

---

## 3.1.0

**Minor release — Phase 30 Wave 3: Advanced Astrology + Muhurta Engine.**
Adds the post-kundli surface — six additional divisional charts, planetary
aspects, six-fold Shadbala strength, two more doshas, three additional
dasha systems, a configurable muhurta scoring engine with 13 stock rules,
and a calendar-conversion / yearly-listings module. All additive on top
of v3.0 — every prior export keeps the same shape.

### Highlights

- **6 new divisional charts** — `computeDivisionalChart(birthDate, location, divisional)`
  for **D2 Hora** (wealth), **D3 Drekkana** (siblings), **D7 Saptamsa** (children),
  **D10 Dasamsa** (career), **D12 Dwadasamsa** (parents), **D30 Trimsamsa**
  (misfortune). D9 (Navamsa) routes through the same unified API for
  consistency. Each follows its classical per-rashi-type rule from BPHS Ch. 6;
  D30 uses the non-uniform 5-segment split with Mars / Saturn / Jupiter /
  Mercury / Venus rulership (no Sun / Moon segments).
- **`computeAspects`** — Drishti (planetary aspects) per BPHS Ch. 26. Every
  graha aspects the 7th house from itself; Mars adds 4th + 8th, Jupiter
  adds 5th + 9th, Saturn adds 3rd + 10th. Optional `nodeAspects: '5-and-9'`
  extends Rahu / Ketu with Jupiter-like aspects (BV Raman / KP convention).
- **`computeShadbala`** — six-fold strength for the 7 visible grahas in
  Virupas (Sthana, Dig, Kala, Chesta, Naisargika, Drik). Simplified analytic
  model targeting ~5% agreement with ProKerala / PyJHora reference
  calculators.
- **`computeKaalSarp`** — Kaal Sarp Dosha detection with all 12 named
  subtypes (Anant, Kulik, Vasuki, Shankhpal, Padma, Mahapadma, Takshak,
  Karkotak, Shankhachud, Ghatak, Vishdhar, Sheshnag — by Rahu's house).
  Surfaces a `partial` flag when 6 of 7 visible planets fall within the
  Rahu-Ketu axis (paritha / dosha-bhanga indicator).
- **`computePitruDosha`** — surfaces the two highest-frequency triggers
  (Sun + Rahu / Ketu conjunction; Sun + Saturn in 9th house).
- **3 additional dasha systems:**
  - **Ashtottari** — 108-year, 8-lord cycle (no Ketu) per Satya Acharya.
    `computeAshtottariDasha(birthDate, moonSiderealLon)`.
  - **Yogini** — 36-year cycle of 8 yoginis (Mangala, Pingala, Dhanya,
    Bhramari, Bhadrika, Ulka, Siddha, Sankata) with planetary lords.
    `computeYoginiDasha(birthDate, moonSiderealLon)`.
  - **Chara (Jaimini)** — sign-based dasha with 9-8-7 years per modality
    (movable / fixed / dual). `computeCharaDasha(birthDate, location)`.
- **Muhurta scoring engine.** `scoreMuhurta(date, location, rule, options)`
  and `findAuspiciousDates(rule, start, end, location, options)` evaluate
  any rule against the live panchang. **13 stock rules** ship: vivah,
  grihaPravesh, namakarana, vidyarambh, vahanKharidi, annaprashan, mundan,
  upanayanam, karnavedha, aksharabhyasam, seemantham, shopOpening,
  travelStart. Hard exclusions (Bhadra / Ekadashi / Eclipse / Adhika /
  Ganda Mula / Panchaka / paksha mismatch) zero the score; auspicious /
  inauspicious axes shift it ±10 / ±15. Special yogas add ±5.
- **Calendar conversion APIs:**
  - `convertGregorianToHindu(date, location, options)` → tithi / masa /
    paksha / samvat / vara at sunrise.
  - `convertHinduToGregorian({ vikramSamvat, masaIndex, paksha,
    pakshaTithi }, location, options)` → matching Gregorian dates.
  - `getKaliYugaYear(date)` → integer KY year (epoch 18 Feb 3102 BCE).
  - `getHinduNewYear(year, region, location, options)` → Chaitra Shukla
    Pratipada or regional Mesha-Sankranti anchor (Tamil Nadu / Kerala /
    Punjab / Bengal / Assam).
  - `getEkadashiDatesForYear(year, location, options)` → ~24 Date[].
  - `getSankrantisForYear(year, location, options)` → 12 SankrantiEvent[].
  - `getFestivalsInRange(start, end, location, options)` → FestivalDay[].
  - `getUpcomingEclipses(fromDate, location, count?)` → EclipseInfo[].

### New API surface

```ts
// Charts
export function computeDivisionalChart(
  birthDate: Date,
  location: GeoLocation,
  divisional: 'D2' | 'D3' | 'D7' | 'D9' | 'D10' | 'D12' | 'D30',
  options?: BirthChartOptions,
): DivisionalChart;

// Aspects + Shadbala
export function computeAspects(chart: BirthChart, options?: AspectsOptions): AspectMap;
export function computeShadbala(
  birthDate: Date, location: GeoLocation, options?: BirthChartOptions,
): ShadbalaResult;

// Doshas
export function computeKaalSarp(chart: BirthChart): KaalSarpDoshaInfo;
export function computePitruDosha(chart: BirthChart): PitruDoshaInfo;

// Dashas
export function computeAshtottariDasha(birthDate: Date, moonSiderealLon: number): VimshottariDashaResult;
export function computeYoginiDasha(birthDate: Date, moonSiderealLon: number): YoginiDashaResult;
export function computeCharaDasha(birthDate: Date, location: GeoLocation, ayanamsa?: AyanamsaType): CharaDashaResult;

// Muhurta engine
export function scoreMuhurta(
  date: Date, location: GeoLocation, rule: MuhurtaRule, options: MuhurtaScoreOptions,
): MuhurtaScore;
export function findAuspiciousDates(
  rule: MuhurtaRule, start: Date, end: Date,
  location: GeoLocation, options: MuhurtaScoreOptions & { includeFailures?: boolean },
): MuhurtaDay[];

// Calendar conversion
export function convertGregorianToHindu(
  date: Date, location: GeoLocation, options: ConvertOptions,
): HinduCalendarCoords;
export function convertHinduToGregorian(
  coords: { vikramSamvat: number; masaIndex: number; paksha: 'shukla' | 'krishna'; pakshaTithi: number; adhikaOnly?: boolean },
  location: GeoLocation, options: ConvertOptions,
): Date[];
export function getKaliYugaYear(date: Date): number;
export function getHinduNewYear(
  gregorianYear: number, region: FestivalRegion | LegacyFestivalRegion,
  location: GeoLocation, options: ConvertOptions,
): Date | null;

// Yearly listings
export function getEkadashiDatesForYear(year: number, location: GeoLocation, options: YearlyListingOptions): Date[];
export function getSankrantisForYear(year: number, location: GeoLocation, options: YearlyListingOptions): SankrantiEvent[];
export function getFestivalsInRange(start: Date, end: Date, location: GeoLocation, options: YearlyListingOptions): FestivalDay[];
export function getUpcomingEclipses(fromDate: Date, location: GeoLocation, count?: number): EclipseInfo[];
```

### Type surface additions

- `Divisional`, `DivisionalChart`, `AspectMap`, `AspectsOptions`,
  `PlanetShadbala`, `ShadbalaResult`.
- `KaalSarpDoshaInfo`, `KaalSarpSubtype`, `PitruDoshaInfo`.
- `YoginiName`, `YoginiMahaDasha`, `YoginiAntarDasha`, `YoginiDashaResult`,
  `CharaMahaDasha`, `CharaDashaResult`.
- `MuhurtaRule`, `MuhurtaScore`, `MuhurtaDay`, `MuhurtaScoreOptions`.
- `HinduCalendarCoords`, `ConvertOptions`, `YearlyListingOptions`,
  `FestivalDay`, `SankrantiEvent`.

### Sourcing notes

- **Divisional charts** — BPHS Ch. 6 ("Vargas") for all seven kinds; D30
  follows the non-uniform 5-segment Trimsamsa per Parashara (Mars /
  Saturn / Jupiter / Mercury / Venus, with Sun / Moon excluded).
- **Aspects** — BPHS Ch. 26 ("Drishti Vichar"). Default `'7-only'` mode
  applies the BPHS-literal rule for Rahu / Ketu (universal 7th aspect
  only); `'5-and-9'` mode is a documented opt-in (BV Raman / KP).
- **Shadbala** — BPHS Ch. 27 ("Bala Vichar"). Each component is the
  dominant term used by ProKerala / PyJHora's default panel; minor
  sub-balas (Saptavargaja, Tribhaga, Yuddha, Ayana, Hora) are not
  included — their summed contribution is ≤10 V on most charts.
- **Ashtottari** — Satya Acharya's 8-lord scheme (Sun 6, Moon 15, Mars 8,
  Mercury 17, Saturn 10, Jupiter 19, Rahu 12, Venus 21). Anchored at
  Krittika = Sun start.
- **Yogini** — Sanjay Rath's *Yogini Dashas* (1999) and Charak Ch. 18.
- **Chara** — Jaimini Sutras Ch. 1, "9-8-7 years per modality" variant
  (Achyutananda / Sundar). Forward zodiacal direction always; the
  reverse-direction rule for even-rashi lagnas is not currently exposed.

### Documented limitations

- Shadbala uses a **simplified analytic model**, not the full BPHS sub-bala
  catalog. Component values agree with ProKerala / PyJHora to ~5%; minor
  sub-balas (Saptavargaja Sthana, Tribhaga Kala, Yuddha Chesta, Ayana,
  Hora) are intentionally omitted.
- Pitru Dosha surfaces the two highest-frequency classical triggers (Sun +
  node, Sun + Saturn in 9th); the full BPHS catalog of triggers is out of
  scope.
- Chara Dasha uses the forward zodiacal direction for all lagnas; the
  Sundar / Raghava Bhatta variant that flips direction for even-rashi
  lagnas is not exposed.
- Muhurta stock-rule numerics (auspicious / inauspicious tithi /
  nakshatra / vara lists) are sourced from Muhurta-chintamani, BPHS Ch. 28,
  Charak's *Predictive Astrology* Ch. 23, and cross-checked against
  drikpanchang.com/muhurat. Regional traditions vary; pass a custom rule
  for strict-region parity.

### Breaking changes

None. The Phase 30 surface is entirely new — no v3.0 export was renamed,
removed, or had its return shape changed.

### Bundle / runtime

- Bundle size: **~302 KB** (was ~262 KB in v3.0). The +40 KB is from the
  new modules and lookup tables. No new runtime dependencies.
- Hermes JS-syntax check ✅ — every new module passes
  `npm run test:hermes`.

### Test count

**7,156** tests passing across 81 files (was 6,912 in v3.0 → **+244**).
New test files: `tests/unit/divisionals.test.ts`,
`tests/unit/aspects.test.ts`, `tests/unit/shadbala.test.ts`,
`tests/unit/kaalSarp-pitru.test.ts`, `tests/unit/dashas-extra.test.ts`,
`tests/unit/muhurta-engine.test.ts`, `tests/unit/calendar.test.ts`.

---

## 3.0.1

**Patch — README rewrite for v3.x.** Documents the Phase 29 birth-chart
surface end-to-end (Birth Chart, Compatibility & Doshas sections). No code
changes; library behaviour identical to v3.0.0.

---

## 3.0.0

**Major release — Phase 29 Wave 2: Birth Chart Foundation.** Adds the
kundli surface — sidereal Lagna, Bhava under three house systems, D1
(Rashi) and D9 (Navamsa) charts, Ashtakoot 36-point marriage matching,
Mangal Dosha, Sade Sati, Pratyantar dasha, planetary dignity, true Rahu /
Ketu node, plus two new ayanamsas (True Chitrapaksha, Thirukanitham). All
additive on top of v2.4 — `getDailyPanchang` / `getInstantPanchang`
results and every pre-existing export are unchanged. The major bump
exists because the `AyanamsaType` union widens (a structural change for
strict consumers) and to mark the kundli surface as a v3 stability
contract.

### Highlights

- **`computeLagna`** — sidereal ascendant via Meeus eq. 13.6 (atan2 form),
  tropical → sidereal by subtracting the configured ayanamsa. Returns
  `LagnaInfo { siderealLongitude, rashi, degreeInRashi, nakshatra, pada }`.
- **`computeBhava`** — 12 house cusps under one of three systems:
  - `'whole-sign'` (default, classical Vedic) — each rashi is one house.
  - `'equal'` — each house spans 30° starting at lagna's exact degree.
  - `'placidus-kp'` — true cuspal positions (KP). Throws
    `PanchangError('CIRCUMPOLAR')` past |φ| ≳ 66.5°.
- **`computeRashiChart` (D1) + `computeNavamsa` (D9)** — place 9 grahas
  with house assignments. D9 follows the classical Movable / Fixed / Dual
  starting-rashi rule.
- **`computeAshtakoot`** — 36-point Guna Milan from two natal Moons.
  Returns the canonical 8-koot breakdown (Varna 1, Vashya 2, Tara 3,
  Yoni 4, Graha Maitri 5, Gana 6, Bhakoot 7, Nadi 8) plus standard
  cancellations.
- **`computeMangalDosha`** — three-cut check (lagna / Moon / Venus) with
  own-sign and exaltation cancellations.
- **`computeSadeSati`** — phase 1 / 2 / 3 detection with arc-boundary
  binary-search on Saturn's sidereal longitude (retrograde-aware).
- **`computeVimshottariPratyantar`** — third-level dasha sub-period
  expansion, proportional split inside an antardasha.
- **`computeDignity`** — exalted / debilitated / moolatrikona / own /
  friend / neutral / enemy lookup per BPHS Ch. 3–4.
- **True Rahu / Ketu node** — `computePlanetaryPositions(...,
  { nodeType: 'true' })` adds the dominant Meeus periodic correction
  (±0.6° typical vs ±2° worst-case for `'mean'`). Default remains
  `'mean'` — no behaviour change for existing callers.
- **Two new ayanamsas** — `'true-chitra'` (True Chitrapaksha, Spica anchored
  to 0° Libra) and `'thirukanitham'` (Tamil-Vakya). Available everywhere
  the existing `AyanamsaType` is accepted.

### New API surface

```ts
export function computeLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa?: AyanamsaType,
  language?: Language,
): LagnaInfo;

export function computeBhava(
  birthDate: Date,
  location: GeoLocation,
  options?: BirthChartOptions,
): BhavaChart;

export function computeRashiChart(
  birthDate: Date,
  location: GeoLocation,
  options?: BirthChartOptions,
): BirthChart;

export function computeNavamsa(
  birthDate: Date,
  location: GeoLocation,
  options?: BirthChartOptions,
): DivisionalChart;

export function computeAshtakoot(
  boy: NatalMoon,
  girl: NatalMoon,
): AshtakootResult;

export function computeMangalDosha(chart: BirthChart): MangalDoshaInfo;

export function computeSadeSati(
  natalMoonRashi: number,
  asOfDate?: Date,
  options?: BirthChartOptions,
): SadeSatiInfo;

export function computeDignity(graha: GrahaName, rashi: number): Dignity;

export function computeVimshottariPratyantar(
  antardasha: AntarDasha,
): PratyantarDasha[];
```

### Type surface additions

- `LagnaInfo`, `HouseInfo`, `BhavaChart`, `BirthChart`, `DivisionalChart`,
  `PlanetPlacement`, `MangalDoshaInfo`, `SadeSatiInfo`, `PratyantarDasha`,
  `Dignity`, `HouseSystem`, `BirthChartOptions`, `NatalMoon`, `KootName`,
  `KootScore`, `AshtakootResult`.
- `AyanamsaType` union widened by `'true-chitra' | 'thirukanitham'`.
- `BirthChartOptions.nodeType?: 'mean' | 'true'`.

### Breaking changes

The kundli surface is entirely new — no v2.x exports were renamed,
removed, or had their return shape changed. The major bump reflects:

1. **`AyanamsaType` widened.** Strict-superset consumers that
   exhaustively `switch` on `AyanamsaType` will need to handle the two
   new values (`'true-chitra'`, `'thirukanitham'`). All code that
   accepts an `AyanamsaType` continues to compile and behave identically
   when the new values are not passed.
2. **`computePlanetaryPositions` accepts a new `nodeType` option.**
   Default `'mean'` — pre-v3 behaviour preserved exactly. No call site
   needs changes; pass `{ nodeType: 'true' }` to opt in to the periodic
   correction for Rahu / Ketu.

### Validation

- **Birth charts (D1)** — 20+ charts cross-validated against AstroSage
  R-tier (lagna rashi exact match, planet rashi exact match, planet
  house exact match for whole-sign).
- **Ashtakoot** — 30+ pairs cross-validated against
  drikpanchang.com/jyotisha/horoscope-match (per-koot tolerance ±1).
- **Sade Sati** — arc-boundary dates within ±2 days of authoritative
  sources for 20 sample charts; phase classification exact.
- **`getDailyPanchang` regression** — perf-test `tests/perf/phase29-non-regression.test.ts`
  confirms no slowdown for callers not using the kundli surface.

### Bundle / runtime

- Bundle size: **262 KB** (was ~200 KB in v2.4) — entirely from the new
  jyotish modules and lookup tables. No new runtime dependencies.
- Hermes JS-syntax check ✅ — every new module passes
  `npm run test:hermes`.

### Test count

**6,912** tests passing (was 6,048 in v2.4 → **+864**). New files:
`tests/unit/lagna.test.ts`, `tests/unit/bhava.test.ts`,
`tests/unit/charts.test.ts`, `tests/unit/matching.test.ts`,
`tests/unit/doshas.test.ts`, `tests/unit/sadeSati.test.ts`,
`tests/unit/dignity.test.ts`, `tests/unit/pratyantar.test.ts`,
`tests/unit/trueNode.test.ts`, plus the three `tests/validation/phase29-*`
files and `tests/perf/phase29-non-regression.test.ts`.

### Migration from 2.x

```ts
// All v2.x code keeps working unchanged.
const r = getDailyPanchang(date, loc, { timezone: 330 });
// …same return shape as v2.4.

// New: build a kundli.
import { computeRashiChart, computeAshtakoot } from 'panchang-ts';
const d1 = computeRashiChart(birth, loc, { houseSystem: 'whole-sign' });
const match = computeAshtakoot(
  { rashi: 4, nakshatra: 9 },
  { rashi: 0, nakshatra: 1 },
);
```

---

## 2.4.0

**Minor release — Phase 28 Wave 1 complete: Panchaka Rahita + Do Ghati
Muhurta.** Closes the dainika-parity work scoped in Phase 28; backwards
compatible (additive to `DailyPanchangResult` only).

### Highlights

- **Panchaka Rahita Muhurta** — `DailyPanchangResult.panchakaRahita`
  exposes the slices of the Hindu day FREE of Panchaka (i.e. Moon
  outside the last five nakshatras: Dhanishtha → Revati). Empty when
  Panchaka pervades the whole day; one-or-more `TimePeriod[]` entries
  otherwise. Useful for "when can I start construction today?" queries.
- **Do Ghati Muhurta** — `DailyPanchangResult.doGhatiMuhurta` enumerates
  the 15 daytime + 15 nighttime ~48-min slots covering sunrise→sunset and
  sunset→nextSunrise. Each slot carries its classical deity name (Rudra,
  Uraga, Mitra … Tvashta, Samirana) and `auspicious | inauspicious |
  neutral` quality. Parallel slot system to Choghadiya, but at 2-ghati
  resolution.

### Sourcing finding (Do Ghati)

DrikPanchang's Do Ghati table presents the **same 30-name sequence on every
weekday** — there is **no vara-based rotation** of the kind Choghadiya /
Gowri Panchangam use. Verified against drikpanchang.com/muhurat/daily/
do-ghati-muhurat.html for Wed 2026-04-15 and Mon 2026-04-20 producing
identical name sequences. This matches the classical Brahmana / Smriti
enumeration where each muhurta is associated with a fixed presiding deity
independent of the day of the week. `computeDoGhati` therefore takes no
`varaIndex` parameter; sourcing is cited inline in
[src/core/doGhati.ts:3-21](src/core/doGhati.ts#L3-L21).

### New API surface

```ts
// Pure module — usable independently of getDailyPanchang
export function computePanchakaRahita(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number, // sidereal Moon longitude in degrees
): TimePeriod[];

export function computeDoGhati(
  sunriseUtc: Date,
  sunsetUtc: Date,
  nextSunriseUtc: Date,
  nameFn: (slotIndex: number) => string,
  qualityNameFn: (quality: ChoghadiyaQuality) => string,
): DoGhatiInfo;
```

### Type surface additions

- `DoGhatiSlot extends TimePeriod` — `index: number; name: string;
  quality: ChoghadiyaQuality; qualityName: string`.
- `DoGhatiInfo { day: DoGhatiSlot[]; night: DoGhatiSlot[] }` — 15 + 15
  slots (always exactly 30 total).
- `DailyPanchangResult.panchakaRahita: TimePeriod[]` (always present;
  `[]` when Panchaka pervades the day).
- `DailyPanchangResult.doGhatiMuhurta: DoGhatiInfo` (always present).

### i18n

- `doGhatiNames: readonly string[30]` added to `Translations` and to
  `en.ts` / `hi.ts`. Day-slot names indices 0–14, night-slot names
  indices 15–29 (matches DrikPanchang's published order).

### Breaking changes

None.

### Test count

**6,048** tests passing across 61 files (cumulative across the v2.2 →
v2.4 Phase 28 work; was 5,149 in v2.1.0 → **+899**). New files added by
this release: `tests/unit/panchakaRahita.test.ts`,
`tests/unit/doGhati.test.ts`,
`tests/integration/panchakaRahita-doGhati-wiring.test.ts`.

---

## 2.3.0

**Minor release — Phase 28 Wave 1 (cont): Anandadi Yoga + six classical
Vara/Tithi/Nakshatra yogas (Dwipushkar, Tripushkar, Jwalamukhi, Aadal,
Vidaal, Ravi).** Backwards compatible.

### Highlights

- **Anandadi Yoga** — `DailyPanchangResult.anandadiYoga` exposes the
  28-name Vara × Nakshatra cycle yoga (Ananda, Kaladanda, Dhumra …
  Vardhamana). Per-yoga `quality` (`auspicious | inauspicious |
  neutral`) follows the classical Smarta classification.
- **Six new entries in `SpecialYogaInfo[]`** — the existing four
  (`amrit_siddhi`, `sarvartha_siddhi`, `ravi_pushya`, `guru_pushya`)
  are joined by:
  - `dwipushkar` — Bhadra-tithi (Dvitiya/Saptami/Dwadashi) + Sun/Tue/Sat
    + nakshatra ∈ {Mrigashira, Chitra, Dhanishtha}. Results doubled.
  - `tripushkar` — same vara/tithi gate + nakshatra ∈ {Krittika,
    Punarvasu, Uttara Phalguni, Vishakha, Uttara Ashadha, Purva
    Bhadrapada}. Results tripled.
  - `jwalamukhi` — inauspicious; tithi+nakshatra lookup table per
    classical Muhurta-chintamani.
  - `aadal` / `vidaal` — Moon-from-Sun nakshatra-distance in the
    28-nakshatra scheme (Abhijit between UAshadha and Shravana).
    Aadal auspicious on distance ∈ {2, 7, 9, 14, 16, 21, 23, 28};
    Vidaal inauspicious on {3, 6, 10, 13, 17, 20, 24, 27}.
  - `ravi` — auspicious; Moon-from-Sun nakshatra-distance in the
    27-nakshatra scheme on {4, 6, 9, 10, 13, 20}. No weekday filter
    (per DrikPanchang's published occurrence list).

### New API surface

```ts
export function computeAnandadiYoga(
  varaIndex: number,
  nakshatraIndex: number,
  lang?: Language,
): AnandadiYogaInfo;

// Special yogas remain accessed via getDailyPanchang().specialYogas
// — the SpecialYogaInfo.type union is extended (see below).
```

### Type surface additions

- `AnandadiYogaInfo { index: number; name: string; quality:
  ChoghadiyaQuality; qualityName: string }` — index in 0–27.
- `SpecialYogaInfo.type` widened from 4 names to 10 (additive — the
  four prior values still in the union).
- `DailyPanchangResult.anandadiYoga: AnandadiYogaInfo`.
- `InstantPanchangResult.anandadiYoga: AnandadiYogaInfo`.

### i18n

- `anandadiYogaNames: readonly string[28]` and 6 new keys in
  `specialYogaNames` (`dwipushkar`, `tripushkar`, `jwalamukhi`,
  `aadal`, `vidaal`, `ravi`) added to `en.ts` / `hi.ts`.

### Breaking changes

None. Consumers who exhaustively `switch` on `SpecialYogaInfo['type']`
will need to handle the six new cases (TS2367 from `assertNever`-style
defaults), but this is a strict superset — old switches still compile
and behave correctly when no new yoga is detected.

### Test count

**~5,393** tests passing (was ~5,269 in v2.2.0 → **+~124**). New files:
`tests/unit/anandadiYoga.test.ts`, `tests/unit/specialYogas-v23.test.ts`,
`tests/integration/anandadiYoga-wiring.test.ts`,
`tests/integration/specialYogas-v23-wiring.test.ts`.

---

## 2.2.0

**Minor release — Phase 28 Wave 1: Tarabala, Varjyam, Ganda Mula,
Madhyahna + Pratah/Sayahna Sandhya, Dinamana/Ratrimana labels.**
Backwards compatible. Closes the bulk of the visible gap with
[drikpanchang.com](https://www.drikpanchang.com/panchang/day-panchang.html)'s
dainika panchang panel.

### Highlights

- **Tarabala** — 9-tara cycle (Janma, Sampat, Vipat, Kshema, Pratyari,
  Sadhaka, Vadha, Mitra, Ati-Mitra) keyed off the consumer's
  `janmaNakshatra`. Cousin to Chandra Balam — only populated when the
  birth nakshatra is supplied. New `options.janmaNakshatra?: number`
  parallel to existing `options.janmaRashi`.
- **Varjyam** — forbidden ~96-min window per day, nakshatra-keyed. Uses
  the BPHS 27-entry offset table (`VARJYAM_OFFSET_GHATIKAS` in
  [src/utils/constants.ts](src/utils/constants.ts)) anchored to nakshatra
  start. May span midnight; clamps cleanly to the next-sunrise window.
  `null` only when the start lies entirely outside the Hindu day.
- **Ganda Mula** — Moon-in-root-nakshatra detection at sunrise. The 6
  root nakshatras are Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati;
  Mula and Jyeshtha tagged `severity: 'severe'`, the rest `'mild'`.
  `gandaMula.active === false` for the 21 non-root nakshatras.
- **Madhyahna** — solar noon as a ±24-min ritual window (one classical
  muhurta wide). New field `DailyPanchangResult.madhyahna: TimePeriod`.
- **Pratah Sandhya** / **Sayahna Sandhya** — dawn / dusk twilight
  windows. Asymmetric: Pratah ends *at* sunrise, Sayahna starts *at*
  sunset; both have width = `nightDuration / 10` (three nighttime
  ghatikas). Matches DrikPanchang's published Sandhya. Two new fields.
- **Dinamana** / **Ratrimana labels** — classical aliases of
  `dayDurationMinutes` / `nightDurationMinutes` exposed as
  `dinamanaMinutes` / `ratrimanaMinutes` for parity with DrikPanchang
  panel labelling.

### New API surface

```ts
export function computeTarabala(
  janmaNakshatraIndex: number,
  transitNakshatraIndex: number,
  lang?: Language,
): TarabalaInfo;

export function computeVarjyam(
  currentNakshatraIndex: number,
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number, // sidereal Moon longitude in degrees
): TimePeriod | null;

export function computeGandaMula(
  currentNakshatraIndex: number,
  lang?: Language,
): GandaMulaInfo;

export function computeMadhyahna(sunriseUtc: Date, sunsetUtc: Date): TimePeriod;
export function computePratahSandhya(
  sunriseUtc: Date,
  sunsetUtc: Date,
  nextSunriseUtc: Date,
): TimePeriod;
export function computeSayahnaSandhya(
  sunsetUtc: Date,
  nextSunriseUtc: Date,
): TimePeriod;
```

### Type surface additions

- `TarabalaInfo { taraIndex: number; taraName: string; quality:
  'auspicious' | 'inauspicious'; englishName: string }`.
- `GandaMulaInfo { active: boolean; nakshatraName?: string; severity?:
  'mild' | 'severe' }`.
- `PanchangOptions.janmaNakshatra?: number` (0–26, parallel to
  `janmaRashi`).
- `DailyPanchangResult` gains: `tarabala?` (only when `janmaNakshatra`
  set), `varjyam: TimePeriod | null`, `gandaMula: GandaMulaInfo`,
  `madhyahna: TimePeriod`, `pratahSandhya: TimePeriod`, `sayahnaSandhya:
  TimePeriod`, `dinamanaMinutes: number`, `ratrimanaMinutes: number`.
- `InstantPanchangResult` gains: `tarabala?`, `gandaMula:
  GandaMulaInfo`.

### Sourcing

- `VARJYAM_OFFSET_GHATIKAS` — 27-entry per-nakshatra offset table sourced
  from BPHS / Muhurta-chintamani; cited inline in
  [src/utils/constants.ts](src/utils/constants.ts).

### i18n

- `tarabalaNames: readonly string[9]`, `gandaMulaNakshatraNames` (subset
  of nakshatraNames re-exposed), and severity / quality strings added to
  `en.ts` / `hi.ts`.

### Breaking changes

None.

### Test count

**~5,269** tests passing (was 5,149 in v2.1.0 → **+~120**). New files:
`tests/unit/tarabala.test.ts`, `tests/unit/varjyam.test.ts`,
`tests/unit/gandaMula.test.ts`, plus four `*-wiring.test.ts` integration
files for orchestrator pickup.

---

## 2.1.0

**Minor release — regional festival expansion + state-slug `FestivalRegion`
scheme.** Backwards compatible: pre-v2.1 region strings continue to work with
a one-shot deprecation warning; removal scheduled for v3.

### Highlights

- `FestivalRegion` expanded **9 → 22** values, consistent state-slug naming
  (`'tamil'` → `'tamil-nadu'`, `'bengal'` → `'west-bengal'`, `'north-india'`
  dropped in favour of explicit states).
- **+14 new registered festivals** covering Maharashtra, Karnataka, Andhra
  Pradesh, Telangana, Odisha, Rajasthan, UP, Bihar, Haryana, Himachal,
  Uttarakhand, Assam, Goa, Madhya Pradesh, Nepal, and Jharkhand.
- New `FestivalRule.regions?` allow-list, new `SankrantiRegionalRule.regions`
  (was single-valued `region`), new `tithiRange` gate for weekday-in-paksha
  rules (Varamahalakshmi), new transit-adjacent festival emission via
  `nextDaySankrantiRashi` / `prevDaySankrantiRashi` context (Lohri + Raja
  Parba 3-day arc).
- Orphan-region sweep test — every `FestivalRegion` value must attach to a
  specific scoped festival. Guards against reintroducing dead regions like
  the pre-v2.1 `'maharashtra'` (defined in the type, unused in practice).

### Breaking changes

None. See *Migration* below for deprecation warnings and the one key rename.

### Back-compat / deprecations

Legacy region identifiers resolved via [src/core/regionAlias.ts](src/core/regionAlias.ts)
with a one-shot `console.warn` per distinct legacy value per process:

| Legacy value  | Canonical value | Removal |
|---------------|-----------------|---------|
| `'tamil'`     | `'tamil-nadu'`  | v3      |
| `'bengal'`    | `'west-bengal'` | v3      |
| `'north-india'` | `'all'`       | v3      |

(`'north-india'` collapses to `'all'` because its sole previous attachment —
Makar Sankranti — is genuinely pan-Indian. Northern-specific festivals like
Lohri / Govardhan Puja / Bhai Dooj are now attached to explicit state slugs.)

### New regions

**South:** `'tamil-nadu'`, `'kerala'`, `'karnataka'`, `'andhra-pradesh'`,
`'telangana'`.
**East:** `'west-bengal'`, `'odisha'`, `'assam'`, `'bihar'`, `'jharkhand'`.
**West:** `'gujarat'`, `'maharashtra'`, `'goa'`, `'rajasthan'`.
**North / Central:** `'punjab'`, `'haryana'`, `'himachal-pradesh'`,
`'uttarakhand'`, `'uttar-pradesh'`, `'madhya-pradesh'`.
**Neighbour:** `'nepal'`.

### New festivals

- **Sankranti-anchored:** `bohag_bihu` (Assam, Mesha), `kati_bihu` (Assam,
  Tula), `raja_sankranti` (Odisha, Karka), `harela` (Uttarakhand, Karka),
  `sair` (Himachal, Kanya).
- **Transit-adjacent:** `lohri` (Punjab/Haryana/Himachal, day before Makara),
  `raja_pahili` (Odisha, day before Karka), `raja_basi` (Odisha, day after
  Karka).
- **Regional tithi-based:** `gudi_padwa` (Maharashtra/Goa), `gangaur`
  (Rajasthan), `karaga` (Karnataka), `bonalu` (Telangana, Sundays in
  Ashadha), `hariyali_teej`, `kajari_teej`, `hartalika_teej`,
  `govardhan_puja`, `bhai_dooj`, `phagli` (Himachal), `bathukamma_start`
  (Telangana, Bhadrapada Amavasya), `bathukamma_saddula` (Telangana, Ashwin
  Shukla Navami).
- **Weekday-in-paksha:** `varamahalakshmi` (Karnataka/AP/Telangana/TN — last
  Friday of Shravana Shukla paksha before Purnima).
- **Pan-Indian addition:** `jagannath_rath_yatra` (Ashadha Shukla Dwitiya).

### Re-scoped / renamed (non-breaking outputs)

- **`makar_sankranti`**: `region: 'north-india'` → `regions: ['all']`.
  It's pan-Indian and was mistagged.
- **`singh_sankranti`**: `region: 'all'` → `regions: ['odisha', 'bihar',
  'jharkhand', 'nepal']`. Primarily observed there; not a pan-Indian
  festival.
- **Festival key rename** `bihu` → `magh_bihu` for consistency with the new
  `bohag_bihu` / `kati_bihu` siblings. **Translated display name unchanged**
  (`'Magh Bihu'` / `'माघ बिहू'`). Callers indexing the internal key `'bihu'`
  directly (rare — most code reads `festival.name` which is the translated
  string) must update to `'magh_bihu'`.

### Type surface additions

- `LegacyFestivalRegion` exported (union of the 3 deprecated strings).
- `FestivalRule.regions?: readonly FestivalRegion[]` (internal rule type,
  used when writing new rules).
- `FestivalRule.tithiRange?: [number, number]` — gate `(masa + vara)` rules
  to a tithi window.
- `FestivalComputeContext.nextDaySankrantiRashi?: number | null`.
- `FestivalComputeContext.prevDaySankrantiRashi?: number | null`.
- `PanchangOptions.region` and `InstantPanchangOptions.region` widened to
  `FestivalRegion | LegacyFestivalRegion`.

### Docs

- `README.md` — updated FestivalRegion enum listing, LegacyFestivalRegion
  mapping, new "Regional Festival Filtering" code example (default vs scoped
  vs Lohri), and a region-to-festival-keys reference table.

### Test count

**5,149** tests passing across 46 files (was 5,073 in v2.0.1 → **+76**).
New unit file [tests/unit/regionAlias.test.ts](tests/unit/regionAlias.test.ts)
covers alias resolution + one-shot warning semantics. Orphan-region sweep
replaces a weak `r.length > 0` check with 21 explicit `(region →
expectedScopedKey)` assertions + a compile-time exhaustiveness check.

### Migration from 2.0.x

```ts
// Before
getDailyPanchang(date, loc, { timezone: 330, region: 'tamil' });
getDailyPanchang(date, loc, { timezone: 330, region: 'bengal' });
getDailyPanchang(date, loc, { timezone: 330, region: 'north-india' });

// After (recommended — removes the deprecation warning)
getDailyPanchang(date, loc, { timezone: 330, region: 'tamil-nadu' });
getDailyPanchang(date, loc, { timezone: 330, region: 'west-bengal' });
getDailyPanchang(date, loc, { timezone: 330, region: 'all' });

// Festival key rename (rare — only if you index festivalNames directly):
// t.festivalNames['bihu']      // old
// t.festivalNames['magh_bihu'] // new
// (If you read festival.name, nothing changes — still 'Magh Bihu' / 'माघ बिहू'.)
```

---

## 2.0.0

**Major release — correctness fixes + Drik-aligned API.** This release ships
the full set of audit findings from the v1.0.0 pre-publish review (v1.0.0
was never published to npm). Several breaking changes; see *Migration* below.

### Breaking changes

1. **`getDailyPanchang` return type is now `DailyPanchangResult | null`.**
   Polar locations on dates with no sunrise / no sunset return `null` instead
   of throwing `PanchangError(NO_SUNRISE)`. The low-level `computeSunrise` /
   `computeSunset` primitives still throw — only the high-level surface was
   changed so callers can branch on `result === null` without try/catch.
2. **`getUpcomingLunarEclipse(fromUtc, location, withinDays)`** — argument
   order now matches `getUpcomingSolarEclipse` and `getEclipseDuringDay`.
   `location` was the optional 3rd argument in v1.0.0 and is now the
   required 2nd argument.
3. **Transliteration aligned to DrikPanchang.com.** Public string outputs
   change in these 11 places:
   - Tithi: `Pratipad` → `Pratipada`
   - Yoga: `Vishkamba` → `Vishkambha`, `Ayushman` → `Ayushmana`
   - Nakshatra: `Dhanishta` → `Dhanishtha`
   - Chandra Masa: `Ashwin` → `Ashwina`
   - Vara (all 7): `Ravivara` → `Raviwara`, `Somavara` → `Somawara`,
     `Mangalavara` → `Mangalawara`, `Budhavara` → `Budhawara`,
     `Guruvara` → `Guruwara`, `Shukravara` → `Shukrawara`,
     `Shanivara` → `Shaniwara`. (Hindi i18n unchanged — Devanagari was
     already correct.)
   String comparisons in caller code that hard-code the old names will need
   to be updated.

### Bug fixes (correctness)

- **Vara (weekday) was wrong for east-of-IST sunrises.** `getDailyPanchang`
  computed weekday from `sunriseUtc.getUTCDay()`, returning the *previous*
  day's weekday whenever local sunrise occurred before the timezone offset
  (Delhi summer mornings, Singapore / Sydney / Tokyo year-round). All
  weekday-keyed downstream fields — Rahu Kalam, Yamaganda, Gulika Kalam,
  Choghadiya, Hora, durMuhurta — silently inherited this bug.
  Fix: shift sunriseUtc by the configured timezone before reading
  `getUTCDay()`. `getInstantPanchang` uses a longitude-derived LMT offset
  for the same shift since it has no explicit timezone parameter.
- **Moonset returned the previous lunation's setting.** On days where the
  moon rises late and sets the following morning (typical winter solstice),
  searching from `localMidnightUtc` returned the previous moon's set time
  instead of the moonset paired with this day's moonrise. Fix: search from
  `moonriseUtc ?? localMidnightUtc`.
- **Eclipse sutak windows aligned to classical Smarta convention.** Solar:
  9 h → 12 h (4 prahara); Lunar: 3 h → 9 h (3 prahara).

### New features

- **Parashurama Jayanti** added to the festival registry — fires on
  Vaishakha Shukla Tritiya alongside Akshaya Tritiya (madhyahna-vyapini).
- **Masik Karthigai** monthly observance added — fires whenever Krittika
  nakshatra prevails any time during the Hindu day (sunrise / midday /
  sunset / nishita sample), matching Drik's broader rule rather than a
  strict at-sunrise check.

### Test fixtures — provenance overhauled

- `drikpanchang-diaspora.json` was previously library-self-seeded
  (admitted in `_meta.generator: "library-snapshot"`). All 15 entries
  now scraped from DrikPanchang.com (NYC, London, Sydney, Dubai,
  Singapore × 3 dates each — geoname-ids documented in `_meta.source`).
- `drikpanchang-precise.json` non-sunrise fields (tithi, nakshatra,
  chandramasa) now Drik-verified for all 15 unique dates.
- Renamed `drikpanchang-india.json` → `structural-india.json` and
  `drikpanchang-world.json` → `structural-world.json` — these files only
  assert calendar-derived weekday + structural counts, not Drik values.
  The misleading "drikpanchang-" prefix is now reserved for true
  Drik-sourced fixtures.
- New [tests/fixtures/README.md](tests/fixtures/README.md) documents the
  provenance of every fixture and codifies a no-self-seeding rule.

### Test count

5,073 tests passing across 45 files.

### Migration from 1.0.0 (or 0.7.0)

```ts
// Before
const result = getDailyPanchang(date, location, opts);     // throws on polar
result.vara.name === 'Mangalavara'
const e = getUpcomingLunarEclipse(from, 30, location);

// After
const result = getDailyPanchang(date, location, opts);     // null on polar
if (result === null) { /* polar — handle */ }
result.vara.name === 'Mangalawara'                         // note 'w' not 'v'
const e = getUpcomingLunarEclipse(from, location, 30);     // (from, location, days)
```

---

## 1.0.0

**Stable API.** This release begins the semver compatibility promise: every
symbol re-exported from `panchang-ts` is now a stable contract, and any
breaking change will require a v2 major bump.

**Drop-in upgrade from v0.7.0** for almost all users. No renames, no removed
exports, no changed defaults, no changed return shapes. Phase 18 added new
APIs (`computeChandraBalam`, `computeVimshottariDashaFromBirth`); Phase 19
added docs, tests, and JSDoc only. **One numeric output change** to flag —
see *Behavior change vs v0.7.0* below.

### Behavior change vs v0.7.0

`computePlanetaryPositions(...).rahu` and `.ketu` switched from the **true
node** (Meeus + perturbation series, ~±0.05° accuracy) to the **mean node**
(Meeus Ch. 47 polynomial, typically ±0.5° / worst-case ±2° vs the true
node). This aligns with classical Vedic practice and Drik's published
values.

**Impact:**
- `rahu.siderealLongitude` / `ketu.siderealLongitude` shift by ≤2°
- `rahu.rashi` — almost never changes (rashis are 30° wide)
- `rahu.nakshatra` / `pada` — *can* change in edge cases (nakshatras are
  ~13.3° wide)
- `computeVimshottariDasha*` is **unaffected** — dasha is computed from the
  Moon's longitude, not Rahu's
- All other planets are unchanged

If you depend on Rahu/Ketu degree values matching v0.7.0 exactly, this
release will produce different numbers. If you depend on Rahu/Ketu matching
Drik or other Vedic almanacs, this release will produce *better* numbers.

### What's in v1

- **Pancha Anga** — Tithi, Nakshatra, Yoga, Karana, Vara with end-times
- **Lunar calendar** — Chandra Masa (Purnimanta default + Amanta) with Adhika
  detection, Vikram & Shaka Samvat
- **Muhurta** — Brahma, Abhijit, Choghadiya (16 slots), Gowri Panchangam
  (16 slots), Hora (24 slots), Dur Muhurta
- **Inauspicious periods** — Rahu Kalam, Gulika Kalam, Yamaganda, Panchaka
- **Special Yogas** — Amrit Siddhi, Sarvartha Siddhi, Ravi Pushya, Guru Pushya
- **Festivals** — 24 major pan-Indian festivals + recurring Ekadashi /
  Pradosha / Sankranti (Adhika months auto-skipped)
- **Jyotish** — all 9 graha positions (sidereal, Rahu/Ketu on mean node),
  Vimshottari Dasha (from birth moment or Moon longitude), Antardasha
  breakdown, Chandra Balam
- **Astronomy utilities** — Sunrise, Sunset, Moonrise, Moonset, Sidereal
  Sun/Moon longitude, Ayanamsa

### Validation

- 4,864 tests passing
- Drik-verified across 2025–2026 (Delhi, Chennai, Mumbai, Bangalore, Pune)
- Sunrise/Sunset ≤29 s observed vs Drik minute-midpoint (±45 s test tolerance)
- Tithi / Nakshatra / Yoga / Karana end-times max 2.01 min drift, ±3 min
  tolerance (20 assertions)
- Planetary positions (Sun–Saturn) ≤0.02° vs Drik sidereal
- 12 Drik-verified festival dates (2025–2026)
- Bundle parses cleanly with the official Hermes JS frontend
  (`npm run test:hermes` via `hermes-parser`)

### Documented tradeoff

Festival detection uses **tithi-at-sunrise**. Festivals that Drik resolves
via tithi-at-midnight (Krishna Janmashtami, Maha Shivaratri, Diwali/Lakshmi
Puja), madhyahna-vyapini (Ganesh Chaturthi edge years, Akshaya Tritiya
2026), or kshaya-tithi handling (Ugadi 2026-03-19) can drift ±1 day from
Drik's canonical date. See the README §Festival Detection for the full
caveat set.

### Notable changes since v0.5.x (pre-0.7 users only)

- Default masa system is now `purnimanta` (North Indian). Pass
  `masaSystem: 'amanta'` for the South Indian convention.
- Kundli/birth-chart module was removed in v0.6 — to be developed as a
  separate package.

### Naming convention (stable from v1)

- `get*` — simple retrievers returning a single value at an instant, and
  the two top-level panchang entry points.
- `compute*` — synthesize multi-field structured results from derived
  astronomical inputs.
