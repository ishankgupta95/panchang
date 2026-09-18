# Porting rules for the Go tree

> **Layout, since 2026-08-24.** Each language lives under `source/<lang>/`, the
> way astronomy-engine does it: `source/ts/` is the npm package (its own
> `package.json`, `src/` and `tests/`), `source/go/` is this module, and
> `generate/` holds the cross-language generators and research notes. The Go
> module path carries the npm major (`github.com/ishankgupta95/panchang/source/go/v5`),
> and `panchang/` and `types/` are the only packages outside `internal/`.

Distilled from what the first stage of the port actually hit. Where the port's
decision ledger says *what* to decide, this says *how the two languages differ
arithmetically*, which no decision could have known in advance because most of it
was found by measurement.

Read this before porting a new file. Every rule below cost a red test to learn.

Companion document **`docs/ci.md`** is the sync discipline: the
tree-correspondence check, the goldens gate and the parity gate.

---

## 1. The arithmetic must be the TypeScript's, not merely close to it

TS is canonical (D1). "Accurate" for this port means **agrees with the validated
reference implementation**, not "is the best available approximation". Those come
apart in eight places, and Go's instinct is wrong in all eight. §1.6 is the
other half: where it does *not* come apart, and how to know in advance.

### 1.1 Fused multiply-add: barrier every product that feeds an addition

The Go spec lets an implementation contract `a + b*c` into one fused operation,
and gc does it on arm64. JavaScript never does: ECMAScript requires every
operator to round its own result. Same expression, different double.

```go
sum += s[i] * Sin(phase)            // may fuse: DIVERGES from TS
sum += float64(s[i] * Sin(phase))   // rounds first: matches TS
```

The `float64(...)` generates no code; it forbids an optimisation. The spec:
*"An explicit floating-point type conversion rounds to the precision of the
target type, preventing fusion that would discard that rounding."*

Measured on `trig.go`: **18,725 of 200,000** arguments give a different double
with fusion on. On the lunar series it moved longitude by 3.75e-07 arcsec,
only 9.6× inside the 1e-9 deg parity band.

Cost, measured: **+19.5%** on `Sin`, **+9.3%** on `MoonElpLongitude`, **+3.4%**
on `EvaluateVsop`. Paid deliberately; see §5.

Watch for these shapes, which all fuse:

- Horner polynomials: `c0 + t*(c1 + t*(c2 + …))`
- accumulations: `sum += value * scale`
- sums of squares: `x*x + y*y + z*z` (this one bit `planet.go`)
- a product assigned to a local and added later: contraction crosses statements
- `a + b/c` does **not** fuse; division is never contracted

That fourth bullet is the one that gets read past, and it cost G3.3 a red test.
Six of the seven varga transforms end

```go
degInTargetRashi := (degInSeg / span) * 30           // a product, in a local
return Normalize360(float64(targetRashi*30) + degInTargetRashi)
```

The *first* product was barriered and the second was not; gc fused it across the
statement boundary and D3, D7 and D30 diverged on ~4% of boundary longitudes at
up to 5.684e-14 deg. **Barrier the expression whose result is added, not only the
one written inside the addition.** The seventh transform, `navamsaLongitude`, was
immune and says why: its outermost operation is a *division*, which is never
contracted, so when auditing, ask what the LAST operation before the add is, not
whether a multiplication appears anywhere.

Keep an unbarriered twin in the test file and assert it *does* diverge
(`TestFMABarriersAreLoadBearing`). If it ever stops, either a barrier was lost
from the shipped code or the toolchain stopped contracting. Either way, be told.

### 1.2 Constant expressions: any expression over two literals needs a typed operand

Go folds **untyped** constant expressions at arbitrary precision and rounds once.
JavaScript rounds each literal to a double and then operates.

```go
const a = 23.863801       // untyped
const b = -0.079605       // untyped
a + b + runtimeTerm       // Go adds a+b EXACTLY: diverges

const a float64 = 23.863801   // typed: each step rounds, like JS
```

This is why `computeAyanamsa:krishnamurti` was the **one of five** systems whose
digest failed; the other four happened to round the same way, which is exactly
what makes the class dangerous. It also hit
`KM_PER_LIGHT_DAY = 299_792.458 * 86_400` (Go folds from the exact decimals,
25902068371.2; JS multiplies the nearest double, 25902068371.199997).

- Use `jsnum.PI`, never `math.Pi`, in any derived constant. `math.Pi` carries far
  more than 53 bits.
- When pinning such a constant in a test, pin the **literal double**. Writing the
  assertion as `x == 299_792.458*86_400` re-folds it exactly and asserts the bug
  back in. `TestFrameConstants` asserts both the right value *and* that it is not
  equal to the folded form.

It bites *division* too, and later than you expect. `SUN_RADIUS_AU = 695700.0 /
AU_KM` sat wrong for a whole task because the constant is declared in
`topocentric.go` and first **used** in `riseset.go`, so no golden covered it:
untyped `AuKm` folds from the exact decimal 149597870.7 and gives
`0x3f730c5e4cc04fdd` where V8 gives `…fde`. Fixed by typing the *source*
constant, which fixes every expression over it at once.

`RefractionNearHorizonDeg = 34.0 / 60` is exempt, and the reason is a rule rather
than luck: both operands are exactly representable and IEEE division is correctly
rounded, so folding exactly and dividing two doubles give the same double **by
definition**. The hazard needs an inexact operand. Audit for that, not for the
operator.

### 1.3 Standard-library functions that are not the same function

| TypeScript | do **not** use | use | why |
|---|---|---|---|
| `Math.round` | `math.Round` | `jsnum.Round` | JS ties to +∞, Go ties away from zero. Disagree on every negative tie. In `trig.ts`'s Cody-Waite reduction a q one out **flips the sign**. |
| `Math.hypot` | `math.Hypot` | `jsnum.Hypot2` / `Hypot3` | Different overflow-safe algorithms; V8 uses Kahan-compensated squares. Disagree on **4.4%** of random pairs, and it sits in the rise/set inner loop. |
| `String(x)` | `strconv.FormatFloat(x,'g',-1,64)` | `jsnum.FormatFloat` | Same value, different spelling (`0.000028547284` vs `2.8547284e-05`; `1e20` vs `1e+20`). Required for the G4.6 byte-identical table gate. |
| `x % y` | `%` (integer-only) or `math.Remainder` | `jsnum.Mod` | `math.Remainder` rounds the quotient to nearest and can return the opposite sign. |
| `Math.floor(a/b)` | `a / b` | integer floor-division | Go truncates toward zero; they differ for every negative non-multiple. See §1.5. |
| `new Date(t)` | `int64(math.Round(t))` | `int64(t)` | TimeClip truncates toward zero, and `t` is usually fractional. See §1.5. |
| `x ** n`, n ≥ 3 | n/a | see below | V8's fdlibm `pow`, Go's `math.Pow`, and explicit products are **three different answers**. `x**2` is safe: V8 lowers it to `x*x` and fdlibm special-cases y=2. |

`x ** n` is the one divergence deliberately left open. It appears at 21 sites in
all of `source/ts/src/` (20 in `deltaT.ts`, one in `vsop87.ts:62`) and the measured
effect on ΔT is **2.1e-14 s** over the library's 1900-2100 span, which maps 1:1
to a published instant against a 1 ms band. Bounded at 1e-10 s, not chased.
Porting fdlibm's `pow` would close it and is not worth 150 lines of bit-twiddling
for that.

### 1.4 What genuinely cannot match

Anything ending in the platform's `sin`/`cos`/`tan`/`atan2`/`asin`. V8's are
fdlibm-derived, Go's are Cephes-style polynomials, and neither is correctly
rounded. D5 says this is inside the bands and is not chased.

Where the TypeScript reaches for the platform, **the port must reach for the
platform too**: do not substitute this package's `Sin`/`Cos` to gain
bit-identity, because that changes the algorithm. `frame.ts:315-345`,
`vsop87.ts:115-118` and `topocentric.go` all do this deliberately.

Measured worst divergence on any published-shaped quantity: **5.684e-14 deg**,
which is exactly one ULP of 360°, 17,600× inside the 1e-9 deg band.

**The floor is set by the largest intermediate, not by the size of the term that
caused it.** This cost a 5.7× prediction miss at G3.2. The true lunar node adds
one `math.Sin` scaled by 1.4979°, so the perturbation is ~3.3e-16 deg and the
prediction was ≤1e-14. Measured: 5.684e-14. The reason is that `meanOmega` is
`125° − 1934.14·T`, which passes through magnitudes of order 2,000 before
`normalize360` folds it back: one ULP *there* is 2.3e-13 deg, and the fold is an
exact subtraction of a multiple of 360, which **preserves the absolute error**.
So when predicting a bound, find the largest magnitude the value reaches anywhere
on its path and take an ULP of that; a normalization at the end hides the
excursion but does not undo it. In practice almost every angular leaf in this
library bottoms out at one ULP of 360°, and predicting anything smaller needs an
argument that the value never left [0, 360).

`math.Sqrt` *is* correctly rounded by IEEE-754, but a correctly-rounded square
root of an inexact argument is still inexact. All five
`getPlanetPosition:*:distance` accessors are inexact for that reason: the vector
whose length is taken comes out of the rectangular conversion.

### 1.5 Integers and instants: two conversions JavaScript does differently

Both of these are silent, and both change a *whole* published quantity rather
than an ULP. They cost a red test each in `cache.go`.

**`Math.floor(a / b)` is not `a / b`.** Go's integer division truncates toward
zero, so a direct transcription puts every pre-1970 instant one bucket *later*.
`cache.ts`'s block index is `Math.floor(ms / spanMs)`; transcribed naively, the
parity dump's whole 1912 epoch reads ~50° of lunar longitude wrong, which looks
like a broken ephemeris, not like a rounding bug. Write floor-division:

```go
q := a / b
if a%b != 0 && (a < 0) != (b < 0) { q-- }
```

Do the division in **integers**, not by copying the float expression. It is
exactly `Math.floor(a/b)` and not merely usually: the closest a non-multiple can
come to an integer from below is `1/b`, which for a 4-day span in ms is 2.89e-9
against a half-ULP of 1.86e-9 at the largest quotient the Date range allows.
Prove the margin for your own divisor before relying on it, and sweep both
spellings against each other in the test.

**`new Date(t)` truncates toward zero, and `t` is often not an integer.**
TimeClip runs `ToIntegerOrInfinity`, which truncates, not floors, and the two
differ before 1970. Go's `float64 → int64` conversion truncates identically, so
`int64(t)` is the faithful port. Put the conversion at the same place the
TypeScript puts `new Date(t)` (usually the caller's closure) rather than
rounding inside the function that receives the float. `cache.ts`'s Chebyshev
nodes are at `midMs + halfMs·cos(πk/(n−1))`, fractional at every interior node,
and every one of them is truncated on the way to the ephemeris.

### 1.6 What is *robust* to the divergence, and how to tell

The corollary of §1.4, and it is worth as much as the rules above: some code
consumes a float's **value** and some consumes only its **sign**. The second kind
is immune to the platform divergence entirely, and predicting that in advance
turns a bound into an equality.

`riseSet.ts` is the case that proved it. `altitudeExcess` ends in `Math.asin`
over a dot product built from `sqrt`/`cos`/`sin`, so it differs from Go's by
~1e-13 deg and cannot be pinned. But the bracket test is `fLo < 0 && fHi >= 0`,
the subdivision proof asks whether a slope-bounded envelope can cross zero, and
`refine` is bisection: all signs. A sign flips only if a probe lands within
1e-13 deg of the boundary being tested, which at the Sun's 15″/s horizon rate is
2.4e-11 s against a bisection that stops at 0.864 ms. So the branch sequence is
identical, `(lo + hi) / 2` over identical endpoints is the same double, and
**every published rise and set is bit-identical**, verified over 560 cases,
while 5 of the 11 Chebyshev abscissae feeding it differ from V8.

So, before settling for a bound, ask what actually escapes the function:

- a **sign** or a **comparison** → predict an equality, and state the margin
  (how close can an argument get to the boundary before the algorithm stops?);
- a **value** → bound it;
- an **index**, a **count** or a **boolean** → equality, and it is an invariant
  rather than a tolerance (`docs/validation-tiers.md`), so it may never be
  relaxed.

Assert the equality. A failure there is a port defect and says so, where a band
wide enough to absorb it would have said nothing.

### 1.7 `a / b` between integer literals is integer division

The most severe hazard in the port, because it deletes a whole term rather than
an ULP, and it fails silently.

```go
const danjon = 1 + 1/85 - 1/594     // = 1 EXACTLY. Integer division.
const danjon = 1 + 1.0/85 - 1.0/594 // = 1.010081204198851168, bit-identical to V8
```

`eclipseGeometry.ts:82` writes Danjon's atmospheric enlargement of the Earth's
shadow as `1 + 1/85 - 1/594`. JavaScript has one number type; Go's untyped
constants are integers unless one operand says otherwise, so the literal
transcription silently drops the entire 1% enlargement: every shadow radius
wrong, no error anywhere, and the eclipse *still happens*, just at the wrong
size. The module's own docblock puts that at 0.03 of penumbral magnitude and
several minutes of duration.

It happened twice in two tasks. The second was `NAKSHATRA_SPAN = 360 / 27`,
which becomes exactly **13** instead of 13.3333: every nakshatra boundary 0.33°
out, about 40 minutes of Moon, and again no error anywhere.

Scan every ported expression for `<int> / <int>`. It is not only constants:
`(a + b) / 2` on two `int64` instants truncates where JavaScript does not, and
`i / n` inside a loop is 0 for every `i < n`. When the TypeScript means a real
quotient (and it always does, because it has no other kind), write one operand
as a float.

**A loop bound is a division too.** `for (let i = 0; i < MAX_DAYS / STEP; i++)`
runs `ceil(MAX_DAYS / STEP)` iterations in JavaScript and `floor` of it in a Go
int port, one iteration fewer whenever the division is not exact.
`sadeSati.ts` has two: `10950 / 7` = 1564.2857… (1565 against 1564) and
`4380 / 7` = 625.714… (626 against 625). One iteration there is a whole week of
Saturn transit, and the shortfall only shows on an input whose answer lies in the
final step, which no random sweep will reliably generate. Keep the bound
`float64` and compare `float64(i) < maxIters`.

The inverse trap is worth naming too, because it is easy to over-correct into:
**a bisection on instants must stay in floats.** `lo + (hi - lo) / 2` is
fractional whenever the bracket is odd, and the TypeScript keeps it fractional
until `new Date(mid)` truncates. Converting the bracket to `int64` because
"instants are int64" (D4) moves the result by up to a millisecond.

Note this is the *opposite* failure mode from §1.2: there, untyped constants are
too precise (folded at arbitrary precision); here they are not floats at all.
Both are fixed by typing an operand.

#### Before claiming one of these bites, check the arithmetic of the values

Mirror the TypeScript either way: that is D1 and it costs nothing. But do not
*write down a magnitude* for the hazard without checking whether the quantity
involved is exactly representable, because a stated magnitude is a claim and two
of them were wrong in G3.8/G3.9:

- **`buildAntarDashas`'s float cursor.** Predicted "up to 8 ms of accumulated
  carry over nine iterations if a port truncates". Measured **0 ms**, on all 81
  (mahadasha, antardasha) pairs: every antardasha length is
  `years_antar × years_maha × MS_PER_YEAR / 120` and `MS_PER_YEAR / 120` is
  exactly 262,980,000, so the length is an integer and there is no carry to
  accumulate.
- **`findNextEntry`'s float bisection.** Predicted "floors at every step and
  converges elsewhere": the §1.7 inverse trap above, applied. Measured
  **identical on every case**, because the bracket starts at one coarse step,
  `7 × 86,400,000 = 2^10 × 590,625`, and the loop needs only three halvings
  before the width drops below its one-day tolerance. Ten exact halvings
  available, three used.

Both misses have the same shape: reasoning from the *form* of the expression
(`+=` in a loop, `/2` on an odd bracket) without asking about the *values*: an
exact quotient in the first case, a 2-adic valuation in the second. When a hazard
looks like it applies, compute the property it depends on and assert **that** in
the test, so the note fails loudly if a table or a constant later changes and
makes the hazard real.

### 1.8 Signed zero: a `number` has one, a Go `int` does not

JavaScript's `number` is a double, so **every integer-valued quantity in the
TypeScript can be `-0`**. Go's `int` cannot, and the conversion is silent.

```js
nakshatraOf(-5e-324)          // Math.floor(-3.75e-325) === -0, a number
```
```go
int(math.Floor(lon / span))   // Go's division and Floor DO give -0; int(...) drops it
```

Two independent places lose it, and they are not the same rule:

- **`int(x)`**, wherever an index is taken. Go's runtime division and
  `math.Floor` both produce `-0` correctly; the sign dies at the conversion, and
  `float64(index)` is then `+0`.
- **`jsnum.Round`**, which returns `+0` where `Math.round` returns `-0` for any
  small negative argument. Its docblock says so, on the justification that
  "nothing downstream can observe it", true when `trig.go` was its only caller,
  **false** from G2 on, because `Round` now produces published completion
  percentages. It *does* pass a zero through unchanged, sign included, so
  `Round(-0)` is `-0`.

The reason this matters at all is one line of asymmetry at the wire:

| | negative zero |
|---|---|
| `JSON.stringify({v: -0})` | `{"v":0}` |
| Go `json.Marshal` | `{"v":-0}` |

So a Go-side `-0` is a **byte-level parity break** that the numeric bands cannot
see, because `|-0 - 0|` is 0. A TypeScript-side `-0` costs nothing, because
`JSON.stringify` erases it. The dangerous direction is Go producing `-0` where
the TypeScript produces `+0`; measured at G2.1, every divergence ran the other
way.

What to do:

1. `normalize360` collapses `-0` to `+0` and returns [0, 360): that guard is in
   the TypeScript **for this reason**, and it is why nothing reachable in the
   element layer can produce a signed zero. Do not drop it, and do not assume it:
   `TestNoNegativeZeroFromNormalizedLongitudes` sweeps it.
2. Where a golden compares **bit patterns**, a `-0` mismatch is invisible to
   `==` and visible to the digest. Both are useful: at G2.1 a value-equality
   probe reported 0 divergences over 775 pairs while the digest reported a
   mismatch, and the digest was right. When a digest fails and a value check
   passes, suspect the sign of zero first.
3. Do not "fix" a Go `+0` into a `-0` to match. D1 makes the TypeScript
   canonical for *values*; the sign of zero is below the resolution of every
   published format, and contorting an `int` index to carry one would be a
   change to the port's type discipline for something JSON deletes.

### 1.9 A nil slice is `null`; JavaScript's empty array is `[]`

The same class as §1.8 and the same failure mode: a Go default that changes the
**wire format** where no numeric band can see it.

```go
var w []types.UtcWindow           // json.Marshal -> null
w := []types.UtcWindow{}          // json.Marshal -> []
```

JavaScript has one empty array and writes `[]`. So every function whose
TypeScript returns `[]` must return an **empty non-nil slice**, at the producer,
not at the publishing boundary: a `make([]T, 0)` convention applied at the
boundary is the kind of thing that gets forgotten for exactly one of thirty
producers.

Where it bites in `source/ts/src/core/` alone: `computePanchakaRahita` returns `[]` on
every day the Moon spends wholly inside Panchaka (**9 of 90** days in the G2.4
golden), `computeVarjyam` on days with no window, `festivals` when the section is
not requested, and `specialYogas` on most days. `diff.mjs` treats `null` vs `[]`
as a **type** mismatch, so this fails loudly once it is compared, but only at
the full dump, which is the wrong place to find it.

Two shapes that are *not* affected, so the rule needs no exceptions:

- a slice built with `make([]T, 0, n)` and appended to is non-nil even when
  nothing is appended;
- a struct field of slice type that is always assigned from such a builder.

Assert it where the empty case is reachable: marshal the empty result and
compare the bytes to `[]`, rather than only checking `len(result) == 0`.

---

## 2. How to verify a newly ported file

Three layers, and they answer different questions.

1. **Tier 0 (astronomy only, D2).** Read the committed fixture under
   `testdata/` via `repopath.ReadTestData(...)`. Never validate astronomy
   against TS. This says *the numbers are right*.
2. **A golden digest against the TypeScript.** Add accessors to
   `source/go/parity/goldens.src.ts`, regenerate with `bash source/go/parity/goldens.sh`, and
   assert SHA-256 equality over the IEEE bits across a seeded sweep. This says
   *they are the same numbers*. Classify each accessor as exact or bounded **from
   the code** (does its path touch a platform transcendental?), then let the test
   confirm: twice now the derivation was wrong and the test caught it.
3. **Structural invariants.** Things a bound cannot express: enum totality, memo
   hit == miss bitwise, a rotation preserving length, GAST advancing 0.9856° per
   solar day, every leap second stepping at ±1 ms.

Bounds are **predicted before they are measured**, in the test's docblock, per
`docs/validation-tiers.md`. A bound chosen after seeing the number is not a bound.

**When a bound misses, find the mechanism before touching the number.** The
first thing to establish is whether the two languages disagree at all: run the
TypeScript on the failing instants directly (esbuild-bundle a five-line probe
against `source/ts/src/`) before assuming a port bug. `cache.go`'s fit bound missed by
350×, and the TypeScript gave the same value at the same millisecond: the cause
was a leap second inside the interpolation block, a property of the UTC time
scale that both languages reproduce. The fix was two bounds, one per mechanism,
plus a test that pins the mechanism (`TestInterpolationAcrossALeapSecond`)
rather than only bounding its effect. Widening one bound until it passes would
have hidden a real and previously undocumented library behaviour.

A corollary worth remembering: **a docblock's measured figure carries its sample
size.** `cache.ts` states its interpolation error as "max error over five
epochs"; over 50,000 it is 1.4× larger on smooth blocks and 500× larger on the
0.15% that straddle a leap second. Read the sample size, not just the number.

### Benchmarks

Two ways the same benchmark lied, both worth knowing before writing one:

- **`b.StopTimer()` inside a tight loop does not survive a large untimed:timed
  ratio.** A cold rise/set day reported 1388 ns against a real ~55 µs. Put the
  setup *inside* the timed region and check that its share is small enough to
  state (the store clear is ~200 ns against 55 µs: 0.4%, and say so).
- **Check the reset actually resets.** `clearRiseSetTracks` used to clear three
  of the four rise/set stores, exactly as it claimed; the fourth lived in another
  file, so the "cold" benchmark was being served warm. If a cold number looks too
  good, the first hypothesis is that nothing was cold. (The gap was closed on
  2026-08-24 and it now clears all four in both languages, but the habit is
  the rule, not the specific store: assert the reset emptied what you think it
  emptied, as `TestClearRiseSetTracksClearsTheEventCache` does.)

Do not run Go benchmarks while the TypeScript suite is running: `source/ts/tests/perf/perf.test.ts`
makes ratio assertions and is load-sensitive.

### Sample sizes

**A digest accumulator that overflows 2^53 turns the test harness into an FMA
site.** G3.4 folded twelve Ashtakavarga cells with `acc = acc*61 + v`, which
reaches 61^12 = 6.9e21: past 2^53 the accumulator rounds, and a rounding
multiply-then-add is exactly the shape §1.1 says Go fuses and JavaScript does
not. Two of five digests failed, on the two 12-cell folds; the 9- and 10-element
folds passed, which is precisely where the 2^53 line falls. The failure reads as
a port defect and is not one. **Reduce modulo a small prime at every step** so
every intermediate stays exact (then fusion is a no-op, because there is no
rounding for it to skip) and mirror the modulus on both sides.

Digest goldens carry a full sweep and a short prefix of the *same* LCG stream.
The Go test uses the short one by default and the full one under `GEN_FULL=1`,
because `go test ./... -race` runs at every task boundary and the race detector
makes big arithmetic sweeps expensive. Do not carry the sample *values* in
`testdata/`. Regenerate them from the seed on both sides; a differently
generated sample cannot hash to a matching digest, so the digest checks the
generator too. (The first ΔT golden was 8.6 MB before this.)

---

## 3. Structural conventions

- **Docblocks cite TypeScript files as `src/…`**: the package-root shorthand
  (`src/core/tithi.ts`), not the repo path `source/ts/src/…`. The shorthand
  predates the 2026-08-24 restructure and is kept deliberately: it names the
  file inside the npm package, which is what a mirror comment means. Avoid
  `file.ts:NNN` line citations in new comments; they rot every time the
  canonical file grows (four families drifted 3-38 lines on 2026-08-24 alone).

- **One Go file per TS file**, same basename, same function names and order,
  struct fields in the TypeScript's key order (D6: `encoding/json` emits
  declaration order, which is what makes the dump's key-order invariant free).

  **Which TypeScript order: the object literal's, not the interface's.**
  `JSON.stringify` emits keys in *insertion* order, so what the dump contains is
  the order of the literal the function returns, and for the four anga types
  that is not the interface's order at all. `TithiInfo extends ElementBase`
  declares `index, name, completionPercentage, endTime` and adds `paksha, number`
  after; `computeTithiFromLongitudes` returns
  `{index, name, paksha, number, completionPercentage, endTime}`, which is what
  `dump-ts.json` holds. Same story for the daily wrappers, whose `Object.assign`
  appends `startTime, isActiveAtSunrise` and then, at the publishing boundary,
  `startTimeLocal, endTimeLocal`, again not `DailyElementBase`'s declaration
  order. Read the order off the dump, or off the literal; never off the
  interface.

- **A `Date` field becomes `types.JSDate`, a nullable one `*types.JSDate`.**
  Instants stay `int64` everywhere inside the computation (D4); the conversion
  happens at the struct literal that publishes them, because `JSON.stringify`
  renders a `Date` as an ISO 8601 string and a bare `int64` would emit a number.

  **This rule was broken once, and the way it survived is the interesting part.**
  `astronomy.MoonPhaseEvent.TimeMs` was an `int64` with `json:"time"` from G1.11
  until G4.6, emitting `-1830076239031` where the TypeScript writes
  `"1912-01-04T13:29:20.969Z"`. Every gate passed, because `MoonPhaseEvent`
  reaches the parity dump only through the `yearly` section and no stage before
  `full` emitted it; `lunation-golden.json`, which pins those very instants,
  compares them as **numbers**, so it could never see that the published *type*
  was wrong. A golden checks the value; only a whole-document diff checks the
  shape. When you add a published struct, grep its `Date` fields against this
  rule rather than trusting that a golden covers it.
- **Port the docblocks.** They carry measurements and rejected alternatives. A
  comment that says *why* 0.4″ and not 0.1″ is worth more than the constant.
- **Instants are `int64` epoch milliseconds** (D4), not `time.Time`. `time.Time`
  appears only at the public API / JSON boundary.
- **Files with no `source/ts/src/` counterpart: the G5 tree-correspondence allowlist.**
  This table is **parsed, not prose**: `internal/treecheck` reads it out of this
  file and enforces it in `go test ./...` (`TestTreeCorrespondence`), so it is
  the single source of truth in both directions. A Go file that matches no row
  fails the check; a row that matches no file on disk fails it too.

  It was missing six of its entries until 2026-08-24, which is exactly the drift
  the checker exists to catch, so every entry is written out with its reason
  rather than as a prefix list. Add the row, with its reason, in the same change
  that adds the file.

  | file | why it has no TypeScript counterpart |
  |---|---|
  | `internal/jsnum/jsnum.go` | JS number semantics (`Round`, `Hypot`, `Mod`, `FormatFloat`) that Go's stdlib spells differently (§1.3) |
  | `internal/repopath/repopath.go` | locates the repository's shared `testdata/` tree from any package; TS uses relative imports |
  | `internal/astronomy/consts.go` | private constants several `source/ts/src/astronomy/*.ts` each declare (`DAY_MS`, `RAD_TO_DEG`, `DEG_TO_RAD`); one Go package cannot |
  | `internal/astronomy/ctx.go` | `EphemerisCtx`: D19 class B, per-request memos. TS keeps them at module scope because it is single-threaded |
  | `internal/astronomy/series/registry.go` | generated-series index; the three series files themselves *do* mirror `source/ts/src/astronomy/series/` |
  | `internal/store/store.go` | D19 class D: the striped global store. JS needs no locking |
  | `internal/gen/*.go` | the series generator (one glob, not a hand count: the row read "(6 files)" while seven were on disk); its TS counterpart is `generate/notes/ephemeris-generate.src.ts`, which the port does not mirror |
  | `types/jsdate.go` | `types.JSDate`: a `Date` at the JSON boundary over a D4 `int64` |
  | `types/timezone.go` | `types.Timezone`: the `number \| string` union as a Go type (D16); TS declares it inline at each site |
  | `internal/utils/jsstring.go` | `${x}` float rendering, used only inside error messages |
  | `internal/core/core.go` | `LongitudeAt` and `NatalResolvers`; TS writes the first inline four times and resolves the second by import |
  | `internal/jyotish/itoa.go` | integer rendering for chart keys |
  | `internal/jyotish/coredeps.go` | wires this package's two leaf functions into `core.NatalResolvers`: the back-edge break |
  | `internal/calendar/tablekeys.go` | `toDateKey`, which **eight** import-free TS modules each declare (six calendar, two muhurta; all eight checked character-identical 2026-08-25); the six calendar copies share this one, `muhurta` keeps its own (added at G4.5, when the count was six) |
  | `internal/tablejson/tablejson.go` | `JSON.stringify(file, null, 2) + '\n'`, which lives in `generate/` on the TS side; see below (added at G4.5) |
  | `types/astronomy.go` | the eclipse and moon-phase types: the results, `MoonPhasesForYearOptions` and the `SyzygyLongitudes` input. TypeScript declares them beside the functions that build or take them; Go collects every type the public API names into one importable package, so that a caller can spell them and their fields and methods render on pkg.go.dev |
  | `types/calendar.go` | the calendar option, result and static-table types, gathered for the same reason |
  | `types/core.go` | the panchang option types and the reference-frame constants, gathered for the same reason |
  | `types/muhurta.go` | the muhurta rule, score and table types, gathered for the same reason |
  | `internal/astronomy/sharedtypes.go` | aliases back to `types` for the declarations this package used to own, so its own code keeps spelling them unqualified. The other side of the `types/astronomy.go` move |
  | `internal/calendar/sharedtypes.go` | the same, for `types/calendar.go`, plus the unexported option-resolution helpers: they are package-level functions here rather than methods because a method on a type declared in `types` could not stay unexported and still be callable from this package |
  | `internal/core/sharedtypes.go` | the same, for `types/core.go` |
  | `internal/jyotish/sharedtypes.go` | the same, for the jyotish half of `types/jyotish.go`, plus the unexported `AspectsOptions` resolver |
  | `internal/muhurta/sharedtypes.go` | the same, for `types/muhurta.go`, plus the unexported `MuhurtaRule` and `MuhurtaScoreOptions` resolvers |
  | `panchang/panchang.go` | **the public API**, and with `types/` one of the two packages outside `internal/`. Its TypeScript counterpart is the `source/ts/src/index.ts` barrel, which is allowlisted on the other side for being one: a barrel is a language's way of naming a surface, and the two languages spell it differently enough that neither maps onto the other |
  | `internal/treecheck/treecheck.go` | the tree-correspondence check itself (G5.2); it reads the two tables in this section |
  | `internal/symcheck/symcheck.go` | the symbol-level correspondence gate (2026-08-25 audit); reads `docs/symbols.md`. The file-level check above cannot see a missing function in a present file, which is how `computeVarjyam` survived from G2 to G5.3 |
  | `source/go/internal/cmd/dump/main.go` | the Go half of the parity harness; its counterpart is `source/go/parity/dump.src.ts` |
  | `source/go/internal/cmd/gen/main.go` | the series-generator binary |
  | `source/go/internal/cmd/treecheck/main.go` | the CLI over `internal/treecheck`, so CI and a human get the same report without running the suite |

  `source/go/parity/**` is the harness itself and held a row here until G5.2. It holds
  no `.go` file, so the row matched nothing, and "matches nothing" is now a
  failure rather than a comment: that is the check that keeps a justification
  from outliving the file it justified. If the harness ever grows a Go file it
  gets a row then.

  **Going the other way**, and parsed by the same checker:

  | file | why it has no Go counterpart |
  |---|---|
  | `source/ts/src/index.ts` | a re-export barrel. Go names a surface with a package instead, so the counterpart in spirit is `panchang/`, which is allowlisted on the other side rather than mapped: the two are not one file each |
  | `source/ts/src/types/index.ts` | the same, for the types tree |

  `source/ts/src/global.d.ts` is a `.d.ts` (an ambient declaration with no runtime
  content) and is excluded from the comparison entirely rather than allowlisted.

  **The mapping rule the checker implements:** `source/ts/src/a/b/cName.ts` ↔
  `source/go/internal/a/b/cname.go` (path preserved under the two roots,
  basename lowercased, extension swapped), with one exception: `source/ts/src/types/*.ts`
  maps to the public `source/go/types/*.go`, not under `internal/`. Verified: **116 of 118** TypeScript files map to an existing Go file
  under that rule with no exceptions. The lowercasing is not injective, so
  `foo.ts` and `Foo.ts` in one directory would both claim `foo.go` and one would
  look ported when it was not; the checker reports that as a collision.

  **`internal/tablejson` is on the list for a reason worth stating**, because it
  looks like a candidate for folding into one of the table packages. The
  serialization it holds (`JSON.stringify(file, null, 2) + '\n'`) is not part
  of any `build*Table` function: the TypeScript builders return an object and the
  *caller* stringifies it, in `generate/generate-*.ts` and `dump.src.ts:1053`. The
  port does not mirror `generate/`, so there is no file for it to live in, and
  three Go call sites need byte-identical output. Duplicating it three times is
  how a byte-identical gate quietly stops being one.
  (`internal/types/dailyelement_json.go` was on this list until the divergence
  it existed for was fixed TS-side; it only ever reproduced a key-order
  difference that `panchang.ts:852` no longer has, and it is deleted.)

- **TypeScript's unit of circularity is the file; Go's is the package.** The
  `source/ts/src/` tree has 23 cross-directory import edges and 22 of them run down one
  layering: `types ← utils ← i18n ← astronomy ← core ← {jyotish, calendar,
  muhurta}`. The twenty-third, `core/panchang.ts → jyotish/{chandraBalam,
  tarabala}.ts`, points back *up*, and against `jyotish/planets.ts →
  core/nakshatra.ts` it is a Go import cycle that will not build.

  **Break the back-edge, by injection, not by moving a function.** The parameter
  is added to the Go signature (`core.NatalResolvers`, wired once by
  `jyotish.CoreNatalResolvers()`); relocating `ComputeNakshatraFromLongitude`
  out of `core/nakshatra.go` would have needed no signature change and would have
  put a function somewhere other than its mirrored file, which is the property
  D1/D6 exist to protect. `EphemerisCtx` is the other injected dependency the
  TypeScript resolves by import, so this is an idiom already in the tree.

  **Nil injected dependency: default or error?** Ask whether nil can arise
  legitimately. A nil `NatalResolvers.ChandraBalam` is only ever *reached* when
  the caller also set `janmaRashi`, so it can only be a wiring mistake and is a
  returned error. Make it a plain error rather than a `PanchangError`: D7
  reserves those for the library's own contract, and `errors.As` then separates
  "you called it wrong" from "the sky did not cooperate".

  **Retire a deferral seam when its deferral ends.** `FestivalsForDay` and
  `InstantFestivals` were function values on `GetDailyPanchang` /
  `GetInstantPanchang` for one reason: `festivals.go` and `dayFestivals.go` were
  Stage G4 and `panchang.go` had to land without them. Both are ported now, both
  are in package `core`, and there is no cycle to break, so the parameters were
  removed and `panchang.go` calls `ComputeDayFestivals` directly, as
  `panchang.ts:769` calls `computeDayFestivals`. An indirection whose stated
  reason has expired is the same smell a TypeScript-side cleanup removed from
  `source/ts/src/`, and it had already grown a real defect: the dump was relying
  on `nil` to blank the instant festival array, so removing the seam silently
  un-blanked it and the g2 document grew 6,406 bytes while
  `_meta.g2.instantFestivalsBlanked` went on saying `true`.

  **The in-package test on the lower side cannot import the upper one**, because
  that is the cycle. Use recording stubs there (which assert *what the resolver
  was called with*, and are stronger than the value check they replace) and put
  the end-to-end wiring test in the upper package, where both are in scope.

- **A `*Local` string is rendered exactly once, at the publishing boundary**
  (D14). `panchang.go`'s `withLocal` is the only place in the tree that turns a
  `UtcWindow` into a `TimePeriod`; every core module emits instants and has no
  timezone. A second renderer is how the two get out of step.

- **A TypeScript union with optional keys becomes two Go types, not one type
  with `omitempty`.** `EclipseInfo` is the case: the astronomy producer omits the
  five `*Local` keys entirely and the panchang producer sets all five, so
  `types.DailyEclipseInfo` and `types.EclipseInfo` (the astronomy producer's, the
  one the public `EclipseInfo` name has always meant) are two nominal types with
  the two key sets. `omitempty` cannot express "absent here, null there", and D11's
  trap says why guessing from a value is worse: `isDosha: false` and
  `onsetVara: 0` are meaningful.

  The exceptions are the two genuinely-discriminated unions (`GandaMulaInfo`,
  `PanchakaInfo`), where the inactive arm carries **no** other key and a
  hand-written `MarshalJSON` says so in four lines.
- `consts.go` holds the private constants several `source/ts/src/astronomy/*.ts` files each
  declare (`DAY_MS`, `RAD_TO_DEG`, `DEG_TO_RAD`). TypeScript scopes them per
  module; one Go package cannot. Every value was checked identical at every site
  before merging, and each lists its sites.

## 4. D19 in practice

- **Class A** (scratch buffers): gone. Multi-value returns and stack arrays; a
  `[3]float64` is three registers, so an out-parameter buys nothing. This also
  retires the "consume before the next call" contract `topocentric.ts:78-79` had
  to document obeying.
- **Class B** (memos): on `EphemerisCtx`, one per request, never shared.
  **The zero value is a trap the plan does not flag.** The TypeScript fills memo
  key arrays with `NaN` so an empty slot cannot match; Go's zero value is `0.0`,
  which is `ttDays = 0`, **J2000 itself**, the epoch every polynomial is
  anchored on. Use a live-prefix counter and scan only the filled slots.
- **Class D** (global stores): `internal/store`, a striped, bounded,
  clear-on-overflow map, generic over the key with a caller-supplied hash. Keep
  the exact TS key structures; each key design fixed a recorded historical bug.
  Three rules the first two consumers established:
  - **`build` runs outside the stripe lock**, with a double-checked insert. A
    block costs ~38 µs of ELP and holding a global stripe lock for that
    serialises every unrelated key on the same stripe. Two goroutines may both
    build; that is sound for exactly the reason the store is shared at all (the
    value is a pure function of the key) and the second insert keeps the first
    instance, so at most one is ever visible. Measured 65 builds for 64 keys
    across 32 colliding goroutines.
  - **The cap splits across stripes** (1024/16 = 64). A clear then drops 1/16 of
    the resident set rather than all of it: less disruptive than the TypeScript,
    behaviour-neutral either way, because a cleared entry is rebuilt to the same
    value.
  - **Keep the TypeScript's key, including that it is a string.** A struct key
    is faster and allocation-free, and wrong in one way that matters: Go compares
    float64 map keys with `==`, so a NaN coordinate produces an entry that can
    never be found again and the store grows to its cap on every call, where JS
    stringifies it to `"NaN"` and collides harmlessly. Format the components with
    `jsnum.FormatFloat`/`FormatInt`, never `strconv`: a key that only *usually*
    matches **splits a cache rather than failing**, so every answer stays correct
    and every one is computed twice, which no test will notice. A string key is
    also the only kind that can be pinned against the TypeScript.
  - **Do not let two stores share a backing array.** `riseSet.ts`'s scan and
    event caches hold the same `readonly number[]`, which is safe there and is
    not in Go. Store a copy, return a copy from the exported accessor, and keep
    an uncopied `…Shared` variant for the in-package caller that only iterates.
    That keeps the hot path allocation-free while a caller's `sort.Float64s`
    cannot corrupt shared state.
  - **Pad a shard to a cache line.** Two mutexes in one line contend even when
    their maps never collide, which looks like "striping did not help". Write the
    padding as `cacheLine − unsafe.Sizeof(sync.Mutex{}) − unsafe.Sizeof(uintptr(0))`
    so a stdlib size change is a compile error, not silent false sharing.
    Measured: one global mutex is 4.4× slower than 16 stripes at 14 procs.

## 5. When to pay for bit-identity, and when not to

Both decisions above were made the same way: **measure the divergence, compare it
to the parity band, decide.**

| divergence | measured | band | margin | decision |
|---|---|---|---|---|
| FMA in the series loops | 1.04e-10 deg | 1e-9 deg | **9.6×** | pay (+9.3%) |
| `x ** n` in ΔT | 2.1e-14 s | 1 ms | 4.7e10× | bound it |
| platform transcendentals | 5.68e-14 deg | 1e-9 deg | 17,600× | bound it (D5) |
| `1/85` as integer division | **1.0% of a shadow radius** | n/a | n/a | a bug; fix it (§1.7) |

Nine times inside a band, with eight layers still to stack on it, is not a
margin. Ten orders inside one is. The rule is not "always chase bit-identity" and
not "never chase it": it is that the answer is a measurement, and it is recorded
with its number.

The point of the ones that *are* exact is **attribution**: when the G2-G4 dump
diff shows something off, the answer should be "that is a real bug", not "that
might be accumulated rounding".
