# source/go/parity: the cross-language parity harness

TS is canonical (D1). Everything outside `source/ts/src/astronomy/` is validated
against the TypeScript package as an oracle, through the dump in this
directory; `source/ts/src/astronomy/` validates against Tier 0 fixtures directly and
never against TS (D2).

Three files do the work:

| file | what it is |
|---|---|
| `dump.src.ts` | the oracle: serializes the full public surface at pinned inputs |
| `dump.sh` | esbuild-bundles and runs it |
| `diff.mjs` | the comparator, a copy of `generate/notes/diff.mjs` and the maintained one from here on |

`generate/notes/` is left untouched. The harness lives here, tracked, because the
untracked `generate/notes/dump.src.ts` was lost once already.

## Running

```bash
bash source/go/parity/dump.sh ts          # TS side  -> out/dump-ts.json + out/tables-ts/
(cd source/go && go run ./internal/cmd/dump) > …   # Go side  (from G2 onward)
node --max-old-space-size=8000 source/go/parity/diff.mjs out/dump-ts.json out/dump-go.json
cmp out/tables-ts/festivals-2025.json out/tables-go/festivals-2025.json
```

`out/` is gitignored. Each full run writes ~330 MB, so two dumps plus their
tables is about 0.7 GB.

Type-check the harness (no npm script touches it; the root tsconfig includes
only `src`):

```bash
npx --prefix source/ts tsc -p source/go/parity/tsconfig.json
```

## What comes out

Two artifacts, gated two different ways.

**The diff-compare document** (stdout → `out/dump-<label>.json`) holds thirteen
top-level sections, in this order: `_meta`, `daily`, `instant`, `yearly`,
`polar`, `charts`, `chartPairs`, `matching`, `muhurta`, `convert`, `constants`,
`helpers`, `tables`. Composite keys use `|` as the separator, which `diff.mjs`
already strips when naming leaves.

**The byte-compare tables** (`out/tables-<label>/`) are the four published
formats (festivals, eclipses, moon phases, muhurta) for Pune, one file per
epoch year, serialized exactly as `generate/generate-*.ts` serialize the shipped
JSON (`JSON.stringify(file, null, 2) + '\n'`). These are gated with `cmp`, not
with `diff.mjs`; their sha256s are carried in the document's `tables` section so
one diff run still notices a regression, and `cmp` says where it is.

## The bands

| class | band |
|---|---|
| names, indices, counts, booleans, array lengths, key order, zone offsets | zero tolerance: `diff.mjs`'s invariant list must be empty |
| published instants | ≤ 1 ms |
| published longitudes / degrees | ≤ 1e-9 deg |
| the four table formats | byte-identical |
| `formatInZone` output | exact string |

A band moves only after a written prediction of the delta and its cause
(`docs/validation-tiers.md` discipline), never by observing an excess and accepting it.

The `full` document byte pins have moved thirteen times. The first four were the festival registry and
none of them the arithmetic: no numeric pin moved, the 105 byte TS-to-Go gap survived all four, and
none touched the `g2` or `g3` pins, which exclude the festival block. The last nine are the 2026-09-24
audit fixes and festival-rule corrections; the first five of those are the first to move numeric pins,
and three of them also move the `g2` and `g3` pins (see below the table). In order:

| delta | TS | cause |
|---|---|---|
| +3295 | 255539350 to 255542645 | the containing-day fallback for a kshaya anchor |
| -4116 | 255542645 to 255538529 | `vat_savitri_amavasya` from `masa: 2` to `masa: 1` |
| -1847 | 255538529 to 255536682 | the two Upakarma rules re-anchored |
| +9    | 255536682 to 255536691 | `vat_savitri_amavasya` from a sunrise anchor to aparahna |
| +74601 | 255536691 to 255611292 | `computeEndTimes: false` no longer narrows `specialYogas` (+81806), no next-day moonset (-3724), one duplicate New York eclipse day removed and polar transition days null (-3481 together); Brahma Muhurta as the 14th night muhurta moves every daily value but no byte |
| +1815 | 255611292 to 255613107 | Sankashti on chandrodaya fallback days, Ugadi and Navaratri after an adhika month, vriddha-trisprisha Smarta Ekadashi, Onam in adhika years |
| -1255 | 255613107 to 255611852 | Ashtottari and Yogini birth antardashas clipped, Narayan own-sign 12 years, sub-periods tile exactly, new `vimshottariPratyantarIn` leaf |
| -9    | 255611852 to 255611843 | Nathonatha Bala continuous across sunrise and sunset |
| +814  | 255611843 to 255612657 | day walks step civil days in DST zones; the Ekadashi year edge |
| +4083 | 255612657 to 255616740 | festival day selection: vriddhi first day, kala coverage, Pradosh window, Holika Dahan added |
| -25984 | 255616740 to 255590756 | Masik Karthigai once per transit, Onam once a year, Karthigai Deepam added, vara rules follow masaSystem |
| -470  | 255590756 to 255590286 | Pathu Porutham Yoni description (Tamil enemy-pair test) |
| -4    | 255590286 to 255590282 | JSON separators on days whose festival list both festival changes touched |

The audit moves changed two numeric pins. `numericLeaves` went from 99 to 102: three Shadbala
leaves at `e5-2088-reykjavik` whose existing ULP-level Paksha difference now rounds differently
against the new Nathonatha values, each at most 5.7e-14. `changedNumericValues` went from 3141 to
3138: +5 from those leaves and -8 from the removed duplicate eclipse's obscuration and magnitude
leaves, which carried the known 1e-15 noise. The same two causes move the TS-to-Go byte gap from
105 to 129 (+20, +4). Every band held, and the worst numeric leaf and path are unchanged.

The `g2` and `g3` pins moved with the same release, and only for causes already in the table: those
stages leave out the festival block, `yearly` and the day walks. Measured against dumps of the 5.3.0
tree, which reproduce the old pins to the byte, every byte is attributed:

| cause | `g2` TS / Go | `g3` TS / Go |
|---|---|---|
| `specialYogas` under `computeEndTimes: false` (shape `s2-narrow` only, 1299 of 1920 days) | +81806 / +81806 | +81806 / +81806 |
| no next-day moonset (76 days) | -3724 / -3724 | -3724 / -3724 |
| duplicate eclipse day removed (4 days) | -3257 / -3253 | -3257 / -3253 |
| dasha clipping and the new `vimshottariPratyantarIn` leaf | | -1255 / -1255 |
| Pathu Porutham Yoni description | | -470 / -470 |
| Nathonatha Bala | | -9 / +11 |
| total | +74825 / +74829 | +73091 / +73115 |

So `g2` moves from 250723409 / 250723499 to 250798234 / 250798328 and `g3` from 251329961 / 251330072
to 251403052 / 251403187. The TS-to-Go gap widens by 4 at `g2` and by 24 at `g3`, the eclipse and
Nathonatha causes above. `changedNumericValues` tightens by 8 at `g2` (2264 to 2256, the removed eclipse
leaves) and by 3 at `g3` (3046 to 3043, the same -8 and +5 as `full`), and `numericLeaves` at `g3` goes
from 97 to 100, the same three Reykjavik Shadbala leaves. Brahma Muhurta moves every daily result and
no byte, because its instants keep their width.

A festival that is current at no sunrise used to be emitted on no day of the year; the Hindu day
that wholly contains it now claims it, in both languages on the same day.

`vat_savitri_amavasya` was filed under the wrong month. The vrat is purnimanta Jyeshtha Amavasya,
and an amavasya ENDS its amanta month, so the amanta index is Vaishakha. The document shrank
rather than grew because a vriddha Amavasya in 2021 used to emit on two consecutive days. Moving
it again to an aparahna anchor, with the later day taking a span that reaches aparahna twice,
settled the one year the month alone did not: 2025, where the amavasya begins after midday on the
26th and reaches sunrise only on the 27th, and the reference publishes the 26th. Seven reference
years now agree, where the month correction alone managed six.

The Upakarma rules had matched on the nakshatra at sunrise with nothing else: no paksha, so Sama
Upakarma fired again on the Bhadrapada Krishna Amavasya that carries Hasta a second time, and no
kala, so it took the day the nakshatra reached sunrise rather than aparahna. Sama lost more than
Rig gained, which is why that document shrank. Both now emit exactly one date in all 88 city-years
of the 8 city sweep, where Sama managed 45. Checked against the reference for 13 years each,
including the longitude split it publishes for Sama in 2026: the 13th at Kolkata, the 12th
everywhere else.

## Determinism

Nothing in a dump may read the wall clock, or the two sides can never agree.

- `source/ts/src/` has no `Date.now()`.
- `computeSadeSati`'s `asOfDate` defaults to `new Date()`; the dump always
  passes it.
- `dasha.ts`'s five `current*` leaves (`currentIndex`, `currentMahaDashaLord`,
  `currentYogini`, `currentRashi`) used to be computed against `new Date()` with
  **no injection point**, so both harnesses masked them to `"<wallclock>"` and
  re-derived the index at the pin as `_currentIndexAtPin`. They were the one set
  of published leaves the parity gate could not cover.

  **Closed 2026-08-24**: `asOfDate` is now an optional trailing parameter on the
  five functions (an `options.asOfDate` on `computeNarayanDasha`, which already
  had an options object), defaulting to `new Date()` so nothing existing changes.
  Both harnesses pass the pin, the mask is gone, and the 30 dasha results in the
  document contribute 30 `currentIndex` leaves across 7 distinct values plus 12
  distinct lord/yogini names, all compared and all equal.

  `dasha-golden.json` carried the **same** mask independently, and it is gone
  too: 774 `"<wallclock>"` strings became real values taken at `_meta.asOf`, and
  `TestDashaCurrentLeavesMatchTheTypeScript` makes 540 comparisons across 12
  distinct indices.
- `generatedAt` is passed explicitly to all four table builders.
- Every iteration order is fixed by an array literal, never by enumerating a
  computed object's keys.

`resolveUtcOffset` reads named zones through `Intl`; Go reads them through
`time.LoadLocation`. Both are tzdata lookups, so the two runtimes' tzdata
versions have to agree for `America/New_York` and `Europe/London`, most
sharply in the 1912 epoch, where the historical transitions are. A mismatch
shows up as a `<offset>` invariant in the diff, which is the right place for it
to show up.

## Scoring a Go build against the reference almanac and the NASA canon

`generate/notes/vcompare/almanac.mjs` and `generate/notes/vcompare/eclipses.mjs` score whatever
`PT_MODULE` points at. Three files here let that be a Go build, without
touching `generate/notes/`:

| file | role |
|---|---|
| `vcompare-keys.cjs` | the call-key format both sides must produce |
| `vcompare-record.cjs` | a `PT_MODULE` that delegates to a real module and records every scored call |
| `vcompare-adapter.cjs` | a `PT_MODULE` backed by a recorded/Go-produced JSON responses file |

```bash
# Record the TS answers (merges, so both harnesses can share one file).
PT_REAL_MODULE=./dist/index.cjs VCOMPARE_OUT=source/go/parity/out/vcompare-ts.json \
  PT_MODULE=source/go/parity/vcompare-record.cjs node generate/notes/vcompare/almanac.mjs
PT_REAL_MODULE=./dist/index.cjs VCOMPARE_OUT=source/go/parity/out/vcompare-ts.json \
  PT_MODULE=source/go/parity/vcompare-record.cjs node generate/notes/vcompare/eclipses.mjs

# Replay them. Must print exactly what the real module printed.
VCOMPARE_RESPONSES=source/go/parity/out/vcompare-ts.json \
  PT_MODULE=source/go/parity/vcompare-adapter.cjs node generate/notes/vcompare/almanac.mjs

# Same, against a Go-produced file.
VCOMPARE_RESPONSES=source/go/parity/out/vcompare-go.json \
  PT_MODULE=source/go/parity/vcompare-adapter.cjs node generate/notes/vcompare/eclipses.mjs
```

A missing key throws instead of returning `undefined`: both harnesses have an
`if (!r) continue` path, so a partially populated file would otherwise score a
flattering number over whatever it happened to contain.

Benchmark harnesses (`bench.mjs`, `driver.mjs`) cannot use the adapter: they
measure wall time and a lookup table has none.

## Coverage notes

- The six pinned locations are the specified grid, verbatim. Reykjavik was
  specified as exercising `NO_SUNRISE` / `NO_SUNSET`; it does not: at 64.1466°N
  the Sun's altitude at local midnight on the June solstice is
  δ − (90° − φ) = 23.44° − 25.85° = −2.41°, below the −0.833° rise/set
  altitude, so it rises and sets every day of the year. The D7 polar path lives
  in the separate `polar` section (Longyearbyen, 78.2232°N) so the pinned grid
  stays exactly as specified.
- `matching` dumps all 31 pairs in `testdata/charts/ashtakoot-pairs.json` (three
  were specified; the file has 31, so trust the file) plus 2 synthetic
  pairs carrying the optional `NatalMoon` fields no fixture pair has.
- Where a call throws, the leaf becomes `{"_error":{"kind","code"}}`. The
  `PanchangErrorCode` is part of the contract (D7) and is compared; the English
  message is not.

## The G2 mode

`PARITY_G2=1` emits the reduced document Stage G2 can answer, on both sides:

```bash
PARITY_G2=1 bash source/go/parity/dump.sh ts-g2
cd source/go && go run ./internal/cmd/dump > parity/out/dump-go-g2.json
node --max-old-space-size=12000 source/go/parity/diff.mjs \
  source/go/parity/out/dump-ts-g2.json source/go/parity/out/dump-go-g2.json
```

That is `_meta`, `daily`, `instant` and `polar`, with the festival block excluded
on both sides because `festivals.ts` / `dayFestivals.ts` are deferred to Stage
G4. The exclusion is recorded in `_meta.g2` and mirrored verbatim by the Go
binary, so a diff of the two `_meta` blocks is itself a check that the two
harnesses agree about what they are comparing.

Measured at G2.5: **0 invariants, 0 changed time leaves, worst numeric 1.705e-13
deg** over 9,600 daily results, 144 instants and 48 polar days. Wall time
TypeScript ~5 s, Go ~2.5 s.

Drop `PARITY_G2` for the full document once G3 and G4 land.
