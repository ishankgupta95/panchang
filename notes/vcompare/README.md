# Comparing a released version against the working tree

Everything here answers "is this actually better than what users have?", by
running the **published artifact** of an old version beside the **built dist**
of the current one. Benching source against a tarball would confound the answer
with build settings, so neither side is built from `src/`.

```bash
mkdir -p notes/vcompare/v4 && cd notes/vcompare/v4
npm init -y >/dev/null && npm install panchang-ts@4.3.1
cd ../../..

# The pre-Phase-36 tree — optional third column, see below.
T=$(mktemp -d) && git archive HEAD | tar -x -C "$T" \
  && ln -s "$PWD/node_modules" "$T/node_modules" \
  && (cd "$T" && npx tsup >/dev/null) \
  && mkdir -p notes/vcompare/head && cp "$T/dist/index.cjs" notes/vcompare/head/

npm run build
node notes/vcompare/driver.mjs 11          # runtime, all implementations interleaved
PT_MODULE=notes/vcompare/v4/node_modules/panchang-ts node notes/vcompare/eclipses.mjs
PT_MODULE=./dist/index.cjs                 node notes/vcompare/eclipses.mjs
```

`driver.mjs` rotates which implementation runs first each repetition so a
scheduling stall lands on all of them, and reports each median plus the ratio
against the first column. Read the **ratio**; the absolute columns carry the
machine.

## Three traps, each of which produced confidently wrong numbers first time

1. **"4.3.1" is two different pieces of software, and they differ by 13× on a
   default call.** `package.json` said `4.3.1` for seven commits *after* 4.3.1
   was published to npm — including the Lahiri correction, the secant solver,
   the per-call Chebyshev longitude cache and the canonical sunrise cache.
   Benchmarking that tree and labelling the column "4.3.1" is how the release
   notes came to quote a baseline nobody could reproduce: published 4.3.1 runs a
   default day in ~6 ms, the HEAD tree in ~1 ms. The driver therefore keeps
   **three** columns — `4.3.1-npm`, `HEAD-tree`, `5.0.0` — so the two can never
   be confused again. The tell that something was wrong, before any of this was
   understood, was that the ratios were inconsistent across configurations and
   one of them was *inverted*: a machine-speed difference cannot do that.
2. **4.x's published `Date`s are offset-shifted; its rise/set *primitives* are
   not.** `getDailyPanchang(...).sunrise` in 4.x is the true instant plus the
   UTC offset (the bug v5 fixed), but `getSunrise(date, loc)` takes no timezone
   and so returns a true instant in both versions. Applying the shift to the
   primitives reported 4.3.1 as *twelve hours* off.
3. **`sections` does not exist in 4.3.1** — zero occurrences in its shipped
   bundle, so passing `sections: []` is silently ignored and the "narrowed"
   configurations measure a full run. Those rows are not like-for-like and are
   excluded rather than quietly compared.

Two more worth knowing: `computeBhava` computes the full planetary set in v5 and
does not in 4.x, so that row measures different work; and `ctrl/*` are pure
arithmetic on a prebuilt chart, included as a control — if they do not come out
at ~1.0x, the harness is measuring the machine rather than the library.

## Identifying which tree an artifact is

Three greps settle it without running anything:

| marker in `dist/index.cjs` | published 4.3.1 | HEAD tree |
|---|---|---|
| `precision === "high"` | present | removed by `bd58313` |
| `BUCKET_MS = 6e4` (60 s longitude bins) | present | replaced by Chebyshev blocks |
| `sections` | absent | absent (added in v5) |
