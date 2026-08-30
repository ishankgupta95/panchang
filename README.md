# panchang-ts

A Hindu calendar (panchang) and Jyotish engine with its own ephemeris: tithi,
nakshatra, yoga, karana, sunrise and moonrise, festivals, muhurta, birth charts,
dashas and compatibility. No external ephemeris files, no runtime dependencies.

Two implementations, one set of answers.

| language | what is there | docs |
|---|---|---|
| **TypeScript** | the reference implementation, published to npm as [`panchang-ts`](https://www.npmjs.com/package/panchang-ts) | [`source/ts/README.md`](source/ts/README.md) |
| **Go** | a port of the same algorithms, module `github.com/ishankgupta95/panchang-ts/source/go/v5` | [`docs/porting.md`](docs/porting.md) |

The TypeScript is canonical. The Go port is not a reimplementation: it is held to
the TypeScript's *exact arithmetic*, and a parity harness compares the two
leaf-for-leaf over a ~255 MB document on every change. What "exact" means, and
the handful of places where two languages genuinely cannot produce the same
double, is written down in [`docs/porting.md`](docs/porting.md) and
enforced by [`ci/`](docs/ci.md).

## Layout

```
source/ts/        the npm package: package.json, src/, tests/
source/go/        the Go module: panchang/ is the public API, internal/ the port
generate/         cross-language generators, and the research notes behind them
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
s := panchang.New()
day, ok, err := s.DailyPanchang(when, panchang.GeoLocation{Latitude: 18.52, Longitude: 73.86},
    panchang.Options{Timezone: panchang.OffsetMinutes(330)})
```

A `panchang.Session` holds one request's ephemeris memos and is not safe for
concurrent use; give each goroutine its own.

## Licence

MIT. See [LICENSE](LICENSE).
