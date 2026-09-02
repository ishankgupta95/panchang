# panchang-ts, Go module

A Hindu calendar (panchang) and Jyotish engine with its own ephemeris: tithi,
nakshatra, yoga, karana, sunrise and moonrise, festivals, muhurta, birth charts,
dashas and compatibility. No external ephemeris files, no runtime dependencies,
nothing to download at startup.

This is the Go port of [`panchang-ts`](../ts). The TypeScript is canonical and this
module reproduces its arithmetic, checked leaf for leaf on every change.

**API reference: [pkg.go.dev](https://pkg.go.dev/github.com/ishankgupta95/panchang-ts/source/go/v5/panchang)**
**Concepts, options and accuracy: [dharmagya.app/docs/panchang-ts](https://dharmagya.app/docs/panchang-ts)**

## Install

```bash
go get github.com/ishankgupta95/panchang-ts/source/go/v5
```

Go 1.22 or newer. The module path ends in `/v5` for major version 5, and its tags are
`source/go/vX.Y.Z`: the prefix is the module's directory, which is how Go finds a
module that does not sit at the repository root.

## Quick start

```go
package main

import (
	"fmt"
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/panchang"
)

func main() {
	s := panchang.New()

	when := time.Date(2025, 7, 4, 0, 0, 0, 0, time.UTC)
	pune := panchang.GeoLocation{Latitude: 18.52, Longitude: 73.86}

	day, ok, err := s.GetDailyPanchang(when, pune, panchang.Options{
		Timezone: panchang.OffsetMinutes(330),
	})
	if err != nil {
		panic(err)
	}
	if !ok {
		return // no sunrise that day at that latitude
	}

	fmt.Println(day.Angas.Tithis[0].Name, day.Sun.Rise)
	for _, f := range day.Festivals {
		fmt.Println(f.Key, f.Name)
	}
}
```

## Three things worth knowing

**A `Session` is not safe for concurrent use.** It memoises the ephemeris as it works,
which is most of why the library is fast, and that memo has no lock. Give each
goroutine its own. `Reset()` drops the memo without discarding the Session, for a
long-lived worker that walks far apart in time.

**A false `ok` is not an error.** Five methods return `(value, ok, error)` and three
eclipse lookups return `(value, ok)`. A false `ok` with a nil error means a polar day
with no sunrise, or a date with no moonrise, and the caller decides what that means.

**Branch on `Code`, never on message text.** Errors carry a stable `panchang.Error`
with a `Code`; all fourteen codes are exported as constants, with `AllErrorCodes()`
for exhaustiveness checks.

```go
var pe *panchang.Error
if errors.As(err, &pe) && pe.Code == panchang.ErrInvalidDate {
	// ...
}
```

## Parity with the TypeScript

A harness compares the two leaf for leaf over a document of roughly 255 MB on every
change, so a divergence fails the build rather than reaching a caller. They agree bit
for bit on every published instant, boundary, festival and muhurta, and to within
3.4e-13 degrees on sidereal longitudes. That residue is the handful of places where
two languages cannot produce the same double, each one bounded rather than waved
through: [`docs/parity.md`](../../docs/parity.md).

```bash
cd source/go && go test ./... -race     # 557 tests across 14 packages, what CI runs
```

## Licence

MIT. See [LICENSE](LICENSE).
