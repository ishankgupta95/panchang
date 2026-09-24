# panchang, Go module

A Hindu calendar (panchang) and Jyotish engine with its own ephemeris: tithi,
nakshatra, yoga, karana, sunrise and moonrise, festivals, muhurta, birth charts,
dashas and compatibility. No external ephemeris files, no runtime dependencies,
nothing to download at startup.

This is the Go port of [`panchang-ts`](../ts). The TypeScript is canonical and this
module reproduces its arithmetic, checked leaf for leaf on every change.

**API reference: [pkg.go.dev](https://pkg.go.dev/github.com/ishankgupta95/panchang/source/go/v5/panchang) (the engine) and [types](https://pkg.go.dev/github.com/ishankgupta95/panchang/source/go/v5/types) (every data type)**
**Concepts, options and accuracy: [dharmagya.app/docs/panchang-ts](https://dharmagya.app/docs/panchang-ts)**

## Install

```bash
go get github.com/ishankgupta95/panchang/source/go/v5
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

	"github.com/ishankgupta95/panchang/source/go/v5/panchang"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func main() {
	s := panchang.New()

	when := time.Date(2025, 7, 4, 0, 0, 0, 0, time.UTC)
	pune := types.GeoLocation{Latitude: 18.52, Longitude: 73.86}

	day, ok, err := s.GetDailyPanchang(when, pune, types.PanchangOptions{
		Timezone: panchang.OffsetMinutes(330),
	})
	if err != nil {
		panic(err)
	}
	if !ok {
		return // no sunrise that day at that latitude
	}

	fmt.Println(day.Angas.Tithis[0].Name, day.Sun.RiseLocal)
	for _, f := range day.Festivals {
		fmt.Println(f.Key, f.Name)
	}
}
```

This prints `Shukla Navami 2025-07-04T06:02:39.922+05:30`. Instants in a result
are `types.JSDate` values, epoch milliseconds in UTC: `fmt` prints one as a bare
integer, `.Time()` turns it into a `time.Time` and `.ISOString()` into an ISO 8601
string, and most carry a `Local` twin (`RiseLocal` here) already rendered in the
requested timezone. The date argument is an instant, and the panchang is for the
civil day it falls on in `Timezone`: midnight UTC on 4 July is still 3 July in New
York, so build the date in the zone you mean, for example
`time.Date(2025, 7, 4, 12, 0, 0, 0, loc)`.

`panchang` holds the engine: `New`, the `Session` methods and the standalone
calculations. `types` holds every data type they take and return, so that a
caller can name them and their fields and methods are documented in one place.
The same-named aliases in `panchang` (`panchang.GeoLocation` for
`types.GeoLocation`, and so on) are the spellings earlier v5 releases used;
they stay, so existing code keeps compiling, and either spelling works.

The methods that walk a range of dates (the `Build*Table` builders, the
`Compute*ForYear` and `Compute*InRange` listings and `GetUpcomingEclipses`) each have a twin ending in `Context` that
takes a `context.Context` and stops early once it is cancelled or its deadline
passes. The plain form runs to completion.

A table a `Build*Table` method returns, or one either language saved as JSON, reads
back through the `Read*` functions (`panchang.ReadFestivalsForYear`,
`ReadMuhurtaForDate`, `ReadBestMuhurtaDays` and the rest), which need no `Session`:
they are the Go form of the `panchang-ts/festivals`, `/eclipses`, `/moon-phases` and
`/muhurta` readers.

## Three things worth knowing

**A `Session` is not safe for concurrent use.** It keeps a small memo of the ephemeris,
and that memo has no lock. Give each goroutine its own: one shared across goroutines
can compute wrong results, which can then enter the process-wide caches (bounded,
locked and keyed by every input, so separate Sessions share them safely) and reach
other Sessions too. `Reset()` drops the Session's memo without discarding it, for a
long-lived worker that walks far apart in time.

**A false `ok` is not an error.** Five methods return `(value, ok, error)` and three
eclipse lookups return `(value, ok)`. A false `ok` with a nil error means a polar day
with no sunrise, or a date with no moonrise, and the caller decides what that means.
The table readers return `(value, ok)` too, where a false `ok` means the table holds
nothing for that year or date.

**Branch on `Code`, never on message text.** Errors carry a stable
`*types.PanchangError` with a `Code`; all fourteen codes are exported as
constants, with `panchang.AllErrorCodes()` for exhaustiveness checks. The codes
are `types.ErrorCode` values rather than errors, so `errors.Is` cannot take one:
use `panchang.IsCode`, `errors.Is` against one of the four `types.Err*Sentinel`
variables (a `PanchangError` matches on code), or `errors.As` when you want the
code itself.

```go
if panchang.IsCode(err, types.ErrInvalidDate) {
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
cd source/go && go test ./... -race     # 560 tests across 14 packages, what CI runs
```

## Licence

MIT. See [LICENSE](LICENSE).
