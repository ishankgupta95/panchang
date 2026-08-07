# v5 Step 5 handoff — complete the ephemeris port, drop `astronomy-engine`

Paste the block below into a new Claude Code session in
`/Users/ishank/code/personal/panchang-ts`.

---

**Goal: finish Phase 36 and remove `astronomy-engine` from `dependencies`
entirely. That is the launch gate for v5 — nothing ships until the dependency is
gone.**

Read these first, in order, before writing any code:

1. `docs/v5-validation-report.md` → **§ Step 4** (the validation protocol and
   what it measured) and **§ Step 5** (where the port stands and why it stopped).
2. `PLAN.md` → **§36.0** (the protocol — non-negotiable), **§36.2–36.5** (the
   remaining work), **§ Phase 36 exit criteria**.
3. `tests/TIERS.md` (which assertions may move and on whose authority).
4. `notes/v5-harness.md` (every measurement harness and how to re-run it).

## Where things stand

- **8,309 tests / 111 files green.** `npm run typecheck` (both configs), `npm run
  lint`, `npm run test:hermes` and `npx tsup` all clean. Bundle 421.0 KB CJS.
- **Nothing is committed.** The whole v5 working tree is uncommitted; the user
  commits and tags manually. `package.json` is `5.0.0-alpha.0`; last git tag is
  `v4.3.0`.
- **Steps 0–4 are done**: Phase 36.1 (structural perf), Phase 37 (table/compute
  API), Phase 38 (result shape — grouped result, real `Date` instants,
  optional-vs-null), Phase 36.0 (the validation protocol).
- **Zero invariant-test changes and zero numeric fixtures re-pinned** across the
  entire release so far. Keep it that way.

## What is left, precisely

`astronomy-engine` is imported in **14 files**. Each maps to one sub-phase:

| Sub-phase | Files | Imports to replace |
|---|---|---|
| **36.2** own Sun + Moon series | `src/astronomy/moon.ts`, `src/astronomy/sun.ts` | `GeoMoon`, `SunPosition`, `Ecliptic`, `MakeTime` |
| **36.3** own rise/set + phase search + frame layer | `src/astronomy/riseSetCache.ts`, `sunrise.ts`, `moonrise.ts`, `moonPhase.ts`, `newMoon.ts`, `src/jyotish/bhava.ts`, `lagna.ts`, `upagrahas.ts`, `varshaphala.ts` | `SearchRiseSet`, `Observer`, `SearchMoonPhase`, `SearchMoonQuarter`, `MoonPhase`, `NextMoonQuarter`, `SiderealTime`, `Equator`, `Horizon` |
| **36.4** own planets | `src/jyotish/planets.ts`, `sadeSati.ts` | `GeoVector` |
| **36.5** eclipses | `src/astronomy/eclipse.ts` | `SearchLunarEclipse`, `NextLunarEclipse`, `SearchLocalSolarEclipse`, `NextLocalSolarEclipse`, `EclipseKind` |

Note 36.3 is the **largest** surface, not 36.2 — the frame/horizon layer reaches
well outside `src/astronomy/`.

Already done and ready to build on: **`src/astronomy/deltaT.ts`** — Espenak–Meeus
ΔT, validated against Tier 0, frozen, **not wired in**. Use
`ttDaysSinceJ2000(date)` as the argument to every series you write; it is the
primitive deliberately chosen over a Julian Date (a JD near the present leaves
only ~10 µs of double resolution).

Do **not** wire ΔT in via `astronomy-engine`'s `SetDeltaTFunction`. It exists,
but it is a global mutation of a third-party module's state and would change
behaviour for anything else in the host process. ΔT becomes live when the series
that consume it are ours.

## The sourcing decision — already made, do not re-litigate

**Fetch the full published tables and truncate them offline.** VSOP87D and
ELP2000-82B are both public domain (IMCCE / VizieR). Commit:

1. a **fetch script** in `notes/` that pulls the full coefficient tables — model
   it on `notes/horizons-fetch.mjs`, which sits beside the fixture it produces
   and makes the data auditable rather than trusted;
2. a **generator** that truncates to a stated ≤1″ error budget, with the budget
   and the resulting term count recorded;
3. the **generated series** as committed data.

Rejected, with reasons, so they don't come back: porting `astronomy-engine`'s
own MIT-licensed embedding (makes "own implementation" mean "vendored fork", and
the Tier 0 baseline would be met by construction rather than validated), and
Meeus's abridged 60-term ELP (~10″ ≈ 18 s of tithi time against a current Drik
drift of 17.4 s — §36.2 rules it out explicitly).

## The protocol — non-negotiable, this is what the whole of Step 4 exists for

Per §36.0 H, for **each** sub-phase, in this order:

1. **Reference implementation** — slow, obvious, transcribed straight from the
   literature with no algebraic cleverness, readable line by line against the
   source.
2. **Validate it against Tier 0** — `tests/fixtures/horizons-positions.json`,
   1,750 positions over 1900–2100. Accept only if max |error| is **≤ the
   baseline across the whole span**, not on average and not just near 2025.
3. **Freeze it** in the repo as a test-only module.
4. **Optimized implementation** — whatever it takes to be fast.
5. **Differential-test optimized vs frozen reference** over ≥100k pseudo-random
   instants, asserting a stated max delta.

`src/astronomy/deltaT.ts` + `tests/validation/tier0-own-deltat.test.ts` are the
worked example of steps 1–5 (with the one adaptation stated in the file: a
degree-7 polynomial has no optimization worth the risk, so the differential
partner is an independent transcription instead).

**The acceptance bounds** live in `BASELINE_MAX_ARCSEC` in
`tests/validation/tier0-horizons.test.ts`. They may only ever be *tightened*.
Loosening one is a finding to write up, never a re-pin.

| Sun | Moon | Mercury | Venus | Mars | Jupiter | Saturn | ΔT (1900–2010) | solver |
|---|---|---|---|---|---|---|---|---|
| 1.61″ | 3.75″ | 6.50″ | 19.59″ | 11.10″ | 9.66″ | 11.15″ | 0.83 s | 24 ms |

**On fixtures:** if a pinned number moves, predict the movement *first* from the
sensitivity coefficients in `tests/TIERS.md`, then run the suite. Matches
prediction → legitimate re-pin, with predicted and observed values recorded.
Larger than predicted, or moving something the error budget says should not move
→ that is a bug. Do not re-pin. Find it. **Any index, name, boolean, count or
festival date that moves is a bug, full stop** — the ten fixture-free checks in
`tests/validation/tier0-crosschecks.test.ts` exist precisely so there is nothing
to re-pin.

## Three measured findings you must carry into the port

1. **The Moon's accuracy bar is 3.75″ max, not the 0.83″ §36.0 D sketched** —
   that figure was the *mean* (measured 0.88″). A truncated series has more room
   than the plan assumed. Judge on the max.
2. **Add light-time retardation to the lunar position.** `GeoMoon` omits it. The
   term is +0.706″ (predicted 0.70″, confirmed). Applying it drops max error
   3.75″ → **3.07″** and exposes a −0.41″ theory bias the missing term had been
   masking — the current +0.30″ bias is two errors cancelling, not correctness.
3. **ΔT models TT − UT1 but the API is fed UTC.** Preserved deliberately;
   exposure reaches ~134 s by 2100 if leap seconds end per CGPM 2022. Pinned in
   `tests/validation/tier0-deltat.test.ts`. Reproduce it deliberately, don't
   "fix" it.

## Work order — plan order, settled by the reviewer

**36.2 → 36.3 → 36.4 → 36.5.** 36.3's interpolant gets built once, over the
series that ships, rather than twice.

- **Expect 36.2 to deliver no measurable speedup.** The profile is unambiguous:
  ~62 of the ~65 daily Moon evaluations happen *inside* the solvers, not in our
  longitude reads. An equally accurate own series is the same arithmetic. 36.2's
  case is independence and bundle size. Do not tune it chasing a speedup that is
  not there, and do not read its flat benchmark as a regression.
- **36.3 carries the entire win** — ceiling ~−40% on a cold default call. It
  subsumes the deferred 36.1 item (b). The seam is `src/astronomy/riseSetCache.ts`
  (both bodies already resolve through it); `notes/lunarcheck.src.ts` is the
  differential test, 153,600 comparisons from Quito to Alert at 82.5 °N.
- **36.5: lunar eclipses before solar.** They are different problems — lunar is
  shadow geometry needing only Sun + Moon (Meeus ch. 54); solar local
  circumstances need Besselian elements on a rotating ellipsoid. Tier 0 for both
  is the NASA/Espenak Five Millennium Canon; fetch contact times and local
  circumstances as a new fixture the same way. If solar local circumstances
  cannot be validated to the §36.0 standard, that is a legitimate finding —
  report it with measurements rather than shipping something unvalidated. Do not
  pre-commit to a fallback.

## Measure after each sub-phase

- Re-profile with `notes/prof/` (see `notes/v5-harness.md`) and record the deltas.
- Benchmark: `bash notes/build.sh && node notes/driver.mjs <label> 7 notes/bench-after-38-7.json`
  — that JSON is the current baseline.
- Prove output-neutrality with `notes/dump.sh` + `notes/diff.mjs` (needs
  `node --max-old-space-size=8000`).
- Record every result in `docs/v5-validation-report.md` § Step 5 as you go.

## Constraints

- **Never `git commit`, tag or push.** The user commits manually. Leave changes
  in the working tree.
- **Do not edit `README.md`.** A separate docs web app is planned; README changes
  are deferred to it.
- **Keep `npm run typecheck` green.** It checks `src` *and* `tests` — that was
  broken until Phase 38.7 and is now load-bearing.
- New files under `tests/validation/` must declare `@tier 0|1|2` in the opening
  block comment; `tier-policy.test.ts` enforces it and also pins the Tier 0
  membership list, so add new Tier 0 files to that list deliberately.

## Definition of done

- `astronomy-engine` removed from `package.json` `dependencies`; zero imports of
  it in `src/`.
- Every own-ephemeris module measured against Tier 0 over 1900–2100, max error ≤
  baseline across the whole span.
- A frozen reference for each module, with the shipped path differential-tested
  against it over ≥100k instants.
- Zero invariant-test changes; every numeric re-pin carries a delta predicted
  before it was observed.
- Drik parity (Tier 1) no worse than the current ≤60 s worst-case end-time drift.
- Cold default call and `getInstantPanchang` roughly halved from the 4.x
  baseline (36.1 got default to 0.78 ms from 0.93; 36.3 is where the rest is).
- `docs/v5-validation-report.md`, `PLAN.md` (Phase 36 status + exit criteria) and
  `CHANGELOG.md` updated; `package.json` bumped `5.0.0-alpha.0` → `5.0.0` and the
  CHANGELOG's `## 5.0.0 — unreleased` heading dated.
- Then stop and hand back for the user to commit and tag.
