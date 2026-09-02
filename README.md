# panchang-ts

A Hindu calendar (panchang) and Jyotish engine with its own ephemeris: tithi,
nakshatra, yoga, karana, sunrise and moonrise, festivals, muhurta, birth charts,
dashas and compatibility. No external ephemeris files, no runtime dependencies,
nothing to download at startup.

Two implementations, one set of answers.

| language | what it is | start here |
|---|---|---|
| **TypeScript** | the reference implementation, published to npm as [`panchang-ts`](https://www.npmjs.com/package/panchang-ts) | [`source/ts/README.md`](source/ts/README.md) |
| **Go** | a port of the same algorithms, module `github.com/ishankgupta95/panchang-ts/source/go/v5` | [`source/go/README.md`](source/go/README.md) |

Each language has its own README with install, quick start and the whole API. This
page is the map: what the project is, how the two halves relate, and where the rest
of the documentation lives.

## What "one set of answers" means

The TypeScript is canonical. The Go is not a reimplementation that happens to agree:
it is held to the TypeScript's *exact arithmetic*, and a parity harness compares the
two leaf for leaf over a document of roughly 255 MB on every change, so a divergence
fails the build rather than reaching a caller.

The two agree bit for bit on every published instant, boundary, festival and muhurta,
and to within 3.4e-13 degrees on sidereal longitudes. That residue is the handful of
places where two languages genuinely cannot produce the same double. Each one is
written down and bounded rather than waved through, in
[`docs/parity.md`](docs/parity.md), and the rules that keep them there are in
[`docs/porting.md`](docs/porting.md).

Dates and rules are validated against a published almanac and pandit consensus, not
against the library's own output. Where a classical rule admits more than one
reading, the narrower one wins. [`docs/validation-tiers.md`](docs/validation-tiers.md)
sets out what counts as evidence for a change and what does not.

## Layout

```
source/ts/        the npm package: package.json, src/, tests/
source/go/        the Go module: panchang/ is the public API, internal/ the port
testdata/         golden files, shared by both languages
generate/         cross-language generators, and the research notes behind them
ci/               the gates, runnable individually or as one prerelease sweep
docs/             parity, porting, CI, releases, symbol correspondence
```

## Getting started

**TypeScript**

```bash
npm install panchang-ts
```

```ts
import { getDailyPanchang } from 'panchang-ts';

const day = getDailyPanchang(new Date('2025-07-04'), { latitude: 18.52, longitude: 73.86 }, {
  timezone: 330,
});
```

**Go**

```bash
go get github.com/ishankgupta95/panchang-ts/source/go/v5
```

```go
import "github.com/ishankgupta95/panchang-ts/source/go/v5/panchang"

s := panchang.New()
day, ok, err := s.GetDailyPanchang(when,
    panchang.GeoLocation{Latitude: 18.52, Longitude: 73.86},
    panchang.Options{Timezone: panchang.OffsetMinutes(330)})
// day.Angas.Tithis[0].Name, day.Angas.Nakshatras[0].Name, day.Sun.Rise, ...
```

A `panchang.Session` holds one request's ephemeris memos and is not safe for
concurrent use; give each goroutine its own.

## Working on it

```bash
bash ci/prerelease.sh     # every gate, sequential, the full sweep
```

Individually: `ci/hygiene.sh`, `ci/tree.sh`, `ci/goldens.sh`, `ci/parity.sh`. Two of
them compare bytes that this machine's floating point pinned, so they only mean
anything on the architecture the goldens were generated on;
[`docs/ci.md`](docs/ci.md) says which, and why CI cannot run them.

A change to `source/ts/src/` needs a matching Go file and matching exported symbols.
That correspondence is enforced, not a convention: see
[`docs/symbols.md`](docs/symbols.md). Releases go out in lockstep across npm and the
Go module tags, described in [`docs/release.md`](docs/release.md).

## Licence

MIT. See [LICENSE](LICENSE).
