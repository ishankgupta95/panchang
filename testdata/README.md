# `testdata/`, the data both implementations are held to

One canonical directory, above both language trees, read by the TypeScript
tests and by the Go tests. A value pinned here constrains **both**
implementations, which is the point: the two are supposed to give the same
answers, and they cannot be shown to unless they are asked the same questions.

```
testdata/
  ephemeris/    published coefficient tables the series generator reads
  reference/    Tier-0 external authorities, JPL Horizons, USNO, NASA
  almanac/      expectations transcribed from a published Hindu almanac
  charts/       natal corpus and the pair fixtures derived from it
  structural/   shape and invariant sweeps that assert against no authority
  goldens/      the TypeScript's own answers, pinned for the Go port
```

## How each language reads it

One loader each. Do not build a path by hand.

| language | loader |
|---|---|
| TypeScript | `source/ts/tests/testdata.ts`, as `readTestData('reference', 'horizons-positions.json')` |
| Go | `internal/repopath`, as `repopath.ReadTestData("reference", "horizons-positions.json")` |

Both resolve from their own compile-time location, not from the working
directory, so a test runs the same from anywhere in the repository.

**A Go module consumer does not get this directory.** `go get` fetches the
module under `source/go/`; `testdata/` sits above it and is not in the module
zip. That is deliberate (it keeps 23 MB of goldens out of every download) and
it means the Go tests here are *repository* tests, not module tests. Clone the
repository to run them.

## The tiers, and what may be re-pinned

`docs/validation-tiers.md` is the full policy. In short:

- **Tier 0, `reference/` and `ephemeris/`.** External authorities that do not
  originate from this project and do not move when it does. These adjudicate an
  ephemeris change; nothing else can.
- **Tier 1, `almanac/`.** A published almanac's output, transcribed by hand.
  Independent of this project, but a secondary source rather than a primary one.
- **Tier 2, `charts/`.** A published natal corpus, plus expectations
  hand-derived from classical rules applied to it. No library output is ever a
  source; see "no self-seeding" below.
- **Tier 3, `structural/`.** Asserts only what calendar arithmetic and shape
  invariants require. Deliberately authority-free.
- **`goldens/`** are not a tier. They are the TypeScript's own answers, pinned
  so that a Go divergence is visible. They say nothing about whether the
  TypeScript is right; the tiers above do that.

**A golden or a fixture that changes is a review event, never a re-pin.**
Predict the delta and its cause in writing first, then measure, then record the
misses. Re-pinning an expectation so that a test goes green destroys the only
thing the expectation was for.

**No self-seeding.** An expected value must never come from this library's
output. A fixture generated from library output is a tautology, not a test. If
no independent reference exists for a case, leave the case out.

## What is in each directory

### `ephemeris/`

The published coefficient tables, gzipped as fetched. `PROVENANCE.md` records
the retrieval. Read by the series generator in both languages, and by the frozen
reference implementation the truncation is measured against. Both consumers
read the same bytes, so a parse difference between them is impossible by
construction.

| file | source |
|---|---|
| `vsop87d.txt.gz` | VSOP87D: Bretagnon & Francou 1988, VizieR VI/81 |
| `vsop87.chk.txt.gz` | VSOP87's own published check values |
| `elp2000-82b.txt.gz` | ELP2000-82B: Chapront-Touzé & Chapront, VizieR VI/79 |
| `iers-nutation.txt.gz` | IAU 2000_R06 nutation: IERS Conventions 2010, tables 5.3a/5.3b |

Regenerate: `node generate/notes/ephemeris-fetch.mjs`.

### `reference/`, Tier 0

| file | source | retrieved |
|---|---|---|
| `horizons-positions.json` | JPL Horizons, DE441. Geocentric apparent, true ecliptic and equinox of date. 250 epochs from a seeded draw. | 2026-08-06 |
| `horizons-deltat.json` | ΔT = TT − UT, derived from Horizons by matching lunar longitude between a UT-tagged and a TT-tagged request. | 2026-08-06 |
| `usno-riseset.json` | US Naval Observatory `aa.usno.navy.mil/api/rstt/oneday`. Local clock times at a fixed UTC offset, published to the minute. | 2026-08-07 |
| `nasa-eclipses.json` | NASA/Espenak, *Five Millennium Canon of Solar Eclipses* (NASA/TP-2006-214141) and its lunar companion. Greatest-eclipse instants in TT; each row carries the canon's own ΔT. Solar rows are geocentric. | 2026-08-07 |
| `nasa-eclipse-local.json` | NASA/Espenak, *Solar Eclipse Visibility from Major Cities*. Local standard time, never daylight. | 2026-08-07 |

Regenerate: `node generate/notes/horizons-fetch.mjs`,
`node generate/notes/eclipse-fetch.mjs`,
`node generate/notes/eclipse-local-fetch.mjs`. `horizons-deltat.json` has no
committed generator and can only be re-derived by the method above; treat it as
frozen.

### `almanac/`, Tier 1

Expectations transcribed by hand, in small quantity, from the day-panchang and
calendar pages of a widely used published Hindu almanac. They exist for
**interoperability**: this library aims to agree with what a reader of that
almanac would see, and these files are how that agreement is measured. Each file
carries per-entry `_source` markers or a file-level `_meta` recording the
location and the date of transcription.

Values here are secondary (one almanac's published output, not a primary
astronomical authority), so a disagreement with `reference/` is always
resolved in `reference/`'s favour. Per-test tolerances are documented at each
call site: sunrise/sunset ±2 min, element end-times ±3 min, planetary longitude
±0.02° (±2° for the nodes).

| file | what it pins |
|---|---|
| `almanac-verified.json` | tithi/nakshatra/yoga/karana names and end-times, sunrise/sunset, chandra rashi and masa, rahu kalam, yamaganda, abhijit, festivals |
| `almanac-precise.json` | vara, tithi and nakshatra at sunrise, sunrise/sunset, chandra masa |
| `almanac-planets.json` | sidereal longitude, rashi, nakshatra and retrograde flag for the nine grahas |
| `almanac-festivals.json` | festival name → date across two years |
| `almanac-diaspora.json` | vara, tithi and nakshatra at sunrise, sunrise/sunset for five non-Indian cities spanning DST and the solstices |
| `almanac-phase28.json` | a fifty-entry cross-check of the daily panchang |
| `almanac-muhurat-days-2025-2027.json` | the published muhurat day lists per occasion |
| `almanac-sarvartha-siddhi-*.txt` | the published Sarvartha Siddhi yoga day lists, four city-years |
| `almanac-parity/charts.json` | per-chart Mangal, Kaal Sarp and Sade Sati expectations for twelve natives |
| `almanac-parity/pairs.json` | three structurally determinate (perfect-36) compatibility pairs |

`almanac-parity/` expectations are **derived, not scraped**: the almanac
publishes these panels only behind a form, so the rules it states were applied
to the natal positions in `charts/` by a separate script, with no library output
consulted.

### `charts/`, Tier 2

| file | what it is |
|---|---|
| `astrosage-charts.json` | natal corpus: twenty-five public figures, Reference-tier charts from celebrity.astrosage.com, Lahiri ayanamsa, decimal degrees within rashi |
| `ashtakoot-pairs.json` | compatibility pairs over that corpus; per-koot scores hand-derived from BPHS Ch. 7 and Brihat Samhita Ch. 102, not scraped |
| `ayanamsa-reference.json` | empty, a placeholder for a future Swiss Ephemeris cross-check |

### `structural/`, Tier 3

Assert `varaEnglish` (pure calendar arithmetic, independent of any panchang
authority) and non-empty element arrays. They catch crashes and shape
regressions; they say nothing about astronomical correctness, and must never be
given values from any almanac.

| file | span |
|---|---|
| `structural-india.json` | Indian cities |
| `structural-world.json` | ten cities across the time zones |
| `pune-200days.json` | 242 consecutive days at one location |

### `goldens/`

Thirty-four files, one directory per Go package, holding the TypeScript's own
answers to a fixed set of questions. Regenerate with

```bash
bash source/go/ci/goldens.sh
```

Rerunning must be a no-op; the script asserts that by checksum. A golden that
moves means the TypeScript's behaviour moved, which is a review event: see the
re-pin rule above.
