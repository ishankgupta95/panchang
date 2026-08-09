# Test tiers — which assertions may move, and on whose authority

PLAN.md §36.0 A + F. This exists because the v5 ephemeris port (Phase 36.2–36.5)
replaces the arithmetic under 8,000-odd pinned assertions, and when one of them
fails there are three indistinguishable explanations:

1. the new code is wrong;
2. the new code is right and the fixture encoded the old error;
3. both sit within tolerance of truth and the diff is noise.

Deciding that from inside the repo is impossible. "The tests went green after I
updated them" is not evidence of anything. So every assertion declares which
tier of authority it sits in, and each tier has a different rule.

## The three tiers

| Tier | Source | Authority | Can it adjudicate a change? |
|---|---|---|---|
| **0** | JPL Horizons (DE441), NASA/Espenak eclipse canon, US Naval Observatory rise/set, IAU constants | Independent ground truth | **Yes — the only tier that can** |
| **1** | DrikPanchang, ProKerala, AstroSage, PyJHora | Rule-level reference. Published to the minute, with their own rule interpretations | Only for *rule* questions, never for ephemeris accuracy |
| **2** | Our own pinned output | Regression detector, zero independent authority | **No.** It can say "something changed", never "the change was wrong" |

Most of the suite is Tier 2. That is fine — Tier 2 is what catches accidents.
What is not fine is treating a Tier 2 disagreement as license to re-pin.

## Declaring a tier

Every file under `tests/validation/` must declare its tier in its opening block
comment:

```
 * @tier 0  JPL Horizons DE441
```

`tests/unit/**` and `tests/integration/**` are **Tier 2 by default** — they pin
this library's own output — and need no marker. A file in those directories that
does carry external reference data should declare its tier anyway.

`tier-policy.test.ts` enforces the marker. It is a test, not a convention, so
the split is structural rather than a promise.

## Two kinds of assertion, two rules

Independently of tier, every assertion is one of:

### Invariant — may **never** change

Facts about the domain, not about our arithmetic:

- tithi / nakshatra / yoga / karana **index** at sunrise
- festival calendar **dates**
- every name, boolean, index and count in a result
- `start ≤ end`; `sunrise < sunset < nextSunrise`
- 30 tithis to a lunation, 27 nakshatras to a sidereal month, 12 sankrantis to a
  year, ~49 moon phases to a year

**If one of these breaks, the new code is wrong — full stop.** No tolerance, no
re-pin, no discussion. `tier0-crosschecks.test.ts` holds the ones that can be
stated without any fixture at all, which is the strongest form: there is nothing
there to re-pin even if someone wanted to.

### Numeric tolerance — may move, with receipts

Pinned instants and longitudes. Re-pinning one is legitimate **only** when the
movement was predicted before it was observed:

1. Measure the Tier 0 delta (`tier0-horizons.test.ts`).
2. Write down the expected fixture movement **first**, from the sensitivity
   coefficients below.
3. Run the suite.
4. Movement matches the prediction → legitimate re-pin, with predicted and
   observed numbers in the commit message.
   Movement is larger, or moves a fixture the error budget says should not move
   at all → **that is a bug**. Do not re-pin. Find it.

## Sensitivity coefficients

The arithmetic that turns a longitude delta into an expected fixture movement:

| quantity | coefficient |
|---|---|
| Moon longitude | 0.549°/hr = 1977″/hr → **δ arcsec ⇒ δ × 1.82 s** of tithi/karana boundary movement |
| Sun longitude | 0.041°/hr → δ arcsec ⇒ δ × 24 s of sankranti movement |
| ayanamsa | carried **once** by nakshatra, **twice** by yoga, **zero times** by tithi and karana (Moon − Sun cancels it) |
| ΔT | δ seconds ⇒ δ seconds on any longitude-crossing time; ~δ × 0.003 s on sunrise, ~δ × 0.037 s on moonrise |

### Where Drik is *not* the right reference

Drik is Tier 1 by construction, but for **moonrise and moonset** it is not a
reference at all, and the reason is worth stating so nobody chases it as a bug:

- its Moon uses a different horizon convention — moonrise ~4 min late and
  moonset ~4 min early against USNO, symmetrically, which is the signature of
  requiring the disc's *centre* rather than its upper limb;
- it attributes moonrise to the **Hindu day** (sunrise to sunrise), so it can
  publish an event that falls on the following calendar date.

Its *Sun* agrees with USNO and with this library to the printed minute. Both
differences are identical in 4.3.1 and 5.0.0 — conventions, not regressions.

This is exactly how the +38″ Lahiri correction was validated: the
tithi/karana-vs-nakshatra/yoga *sign split* identified the wrong constant, and
the prediction "tithi and karana are untouched" was confirmed before anything
was re-pinned.

## Current baselines

| what | where | value |
|---|---|---|
| **baseline** — `astronomy-engine` vs DE441, 1900–2100 | `tier0-horizons.test.ts` | Sun 1.61″, Moon 3.75″, Mercury 6.50″, Venus 19.59″, Mars 11.10″, Jupiter 9.66″, Saturn 11.15″ (max) |
| **shipped** — this library vs DE441, 1900–2100 | `tier0-own-sun-moon.test.ts`, `tier0-own-planets.test.ts` | Sun 0.32″, Moon 1.26″, Mercury 0.30″, Venus 0.86″, Mars 1.29″, Jupiter 0.84″, Saturn 0.86″ (max) |
| ΔT vs Horizons, 1900–2010 | `tier0-deltat.test.ts` | ≤0.83 s |
| solver vs exact bisection | `tier0-crosschecks.test.ts` | ≤24 ms |
| interpolated rise/set vs direct | `differential-riseset.test.ts` | Sun 1.9 / Moon 4.2 ms below 65°, 23.9 ms including 82.5 °N |
| own `sin`/`cos` vs the platform's | `differential-trig.test.ts` | 6.0 × 10⁻¹² / 5.3 × 10⁻¹³ |
| lunar eclipses vs NASA/Espenak | `tier0-own-eclipses.test.ts` | type 0 mismatches in 457; greatest eclipse ≤3.84 s; magnitude ≤0.00062 |
| solar eclipses vs NASA/Espenak | `tier0-own-eclipses.test.ts` | γ ≤0.00015 Earth radii in 452; local contacts ≤43 s (1901–2002), bias −0.75 s |
| rise/set vs USNO | `tier0-usno-riseset.test.ts` | Sun ≤29.7 s, Moon ≤38.6 s, bias ≤3 s, 0 event-presence mismatches (USNO's own resolution is ±30 s) |
| Drik parity (Tier 1) | `element-endtime-audit.test.ts` | ≤58 s worst-case end-time drift |
