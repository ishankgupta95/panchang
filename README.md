# panchang

A Hindu calendar (panchang) and Jyotish engine with its own ephemeris: tithi,
nakshatra, yoga, karana, sunrise and moonrise, festivals, muhurta, birth charts,
dashas and compatibility. No external ephemeris files, no runtime dependencies,
nothing to download at startup.

Two implementations, one set of answers.

| language | install | docs |
|---|---|---|
| **TypeScript** | `npm install panchang-ts` | [`source/ts/README.md`](source/ts/README.md) |
| **Go** | `go get github.com/ishankgupta95/panchang/source/go/v5` | [`source/go/README.md`](source/go/README.md) |

**Full documentation: [dharmagya.app/docs/panchang-ts](https://dharmagya.app/docs/panchang-ts)**,
covering every option, result field, table format, accuracy bound and performance note.
Each language's README has its own install and quick start.

## How the two relate

The TypeScript is canonical. The Go is not a separate implementation that happens to
agree: it reproduces the TypeScript's arithmetic, and a harness compares the two leaf
for leaf over a document of roughly 255 MB on every change, so a divergence fails the
build rather than reaching a caller. They agree bit for bit on every published instant,
boundary, festival and muhurta, and to within 3.4e-13 degrees on sidereal longitudes.

Dates and rules are validated against a published almanac and pandit consensus, never
against the library's own output. Where a classical rule admits more than one reading,
the narrower one wins.

## Layout

```
source/ts/        the npm package
source/go/        the Go module: panchang/ and types/ are the public API, internal/ the port
testdata/         golden files, shared by both languages
generate/         cross-language generators and their research notes
ci/               the gates
docs/             parity, porting, CI, releases, symbol correspondence
```

## Working on it

```bash
bash ci/prerelease.sh
```

Every gate, sequential, and it must stay sequential. Two of them compare bytes that
this machine's floating point pinned, so they only mean anything on the architecture
the goldens were generated on. [`docs/ci.md`](docs/ci.md) says which and why CI cannot
run them.

A change to `source/ts/src/` needs a matching Go file and matching exported symbols,
enforced rather than asked for: [`docs/symbols.md`](docs/symbols.md).
[`docs/parity.md`](docs/parity.md) covers the bands and how they move,
[`docs/porting.md`](docs/porting.md) the rules that keep them there, and
[`docs/release.md`](docs/release.md) the npm and Go module lockstep.

## Licence

MIT. See [LICENSE](LICENSE).
