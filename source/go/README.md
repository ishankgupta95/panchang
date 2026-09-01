# panchang-ts, Go module

A Hindu calendar (panchang) and Jyotish engine with its own ephemeris: tithi,
nakshatra, yoga, karana, sunrise and moonrise, festivals, muhurta, birth charts,
dashas and compatibility. No external ephemeris files, no runtime dependencies,
nothing to download at startup.

This is the Go port. The TypeScript in [`../ts`](../ts) is canonical and this
module is held to its exact arithmetic, leaf for leaf. See
[Parity](#parity-with-the-typescript) below for what that means and where it stops.

## Install

```bash
go get github.com/ishankgupta95/panchang-ts/source/go/v5
```

Go 1.22 or newer. The module path ends in `/v5` because it is at major version 5;
its tags are `source/go/vX.Y.Z`, prefixed with the module's directory, which is
how Go finds a module that does not sit at the repository root.

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

	fmt.Println(day.Angas.Tithis[0].Name)
	fmt.Println(day.Angas.Nakshatras[0].Name)
	fmt.Println(day.Sun.Rise, day.Sun.Set)
	for _, f := range day.Festivals {
		fmt.Println(f.Key, f.Name)
	}
}
```

## The API

Everything hangs off one type. `panchang.New()` returns a `*Session` carrying 58
methods, covering the daily panchang, festivals, eclipses and moon phases, muhurta,
planetary positions and divisional charts, the dasha systems, strength and yogas,
compatibility, calendar conversion, and the yearly and range table builders. The
package also re-exports 96 type aliases, so a caller never has to import anything
under `internal/`.

Most of them return a value and an error. The ones that can legitimately find nothing
carry an `ok` as well, and the difference is deliberate:

```go
value, err := s.ComputeSamvat(when)          // 48 methods: a value, or an error
value, ok, err := s.GetDailyPanchang(...)    // 5 methods: also "there is no such event"
value, ok := s.GetUpcomingSolarEclipse(...)  // 3 eclipse lookups: cannot fail, may find nothing
```

A false `ok` with a nil error is not a failure. It is a polar day with no sunrise, or
a date with no moonrise, and the caller has to decide what that means. The five that
carry one are `GetDailyPanchang`, `GetInstantPanchang`, `GetMoonrise`, `GetMoonset`
and `GetHinduNewYear`; the three that return `(value, ok)` with no error at all are
`GetEclipseDuringDay`, `GetUpcomingSolarEclipse` and `GetUpcomingLunarEclipse`. That
leaves `IsEclipseVisibleAnyPhase`, a plain predicate, and `Reset`, which returns
nothing.

Errors carry a stable `Code`. Branch on the code, never on the message text: the codes
are part of the contract and the wording is not.

```go
var pe *panchang.Error
if errors.As(err, &pe) && pe.Code == panchang.ErrInvalidDate {
	// ...
}
```

All fourteen are exported as constants, and `panchang.AllErrorCodes()` returns them if you want
an exhaustiveness check in your own tests. The TypeScript carries the same fourteen as a
string-literal union, which the compiler checks for it; Go has no such type, so it gets constants
instead.

### Sessions and concurrency

A `Session` memoises the ephemeris as it works, which is most of why the library is
fast. That memo is **not** guarded by a lock, so a `Session` is not safe for
concurrent use. Give each goroutine its own:

```go
s := panchang.New()   // per request, or per worker, not one global
defer s.Reset()       // optional: drops the memo without discarding the Session
```

`Reset` is there for a long-lived worker that walks far apart in time and would
otherwise hold memos it will never consult again.

## Parity with the TypeScript

This is not an independent implementation that happens to agree. It reproduces the
TypeScript's arithmetic, and a harness compares the two leaf for leaf over a
document of roughly 255 MB on every change, so a divergence fails the build rather
than reaching a caller.

The two agree bit for bit on every published instant, boundary, festival and
muhurta, and to within 3.4e-13 degrees on sidereal longitudes. The residue is not
sloppiness: it is the handful of places where two languages genuinely cannot produce
the same double, each one written down and bounded rather than waved through.
[`docs/parity.md`](../../docs/parity.md) has the bands and how they move;
[`docs/porting.md`](../../docs/porting.md) has the porting rules that keep them
where they are.

557 test functions across 14 packages, run under `-race` in CI.

## Building on this repository

```bash
cd source/go
go test ./...          # the suite
go test ./... -race    # what CI runs
gofmt -l . && go vet ./...
```

The parity harness and the golden files live outside this module, at the repository
root, because both languages share them. `bash ci/parity.sh` from the root runs the
comparison; [`docs/ci.md`](../../docs/ci.md) describes the gates and which of them
can only be trusted on the machine the goldens were pinned on.

## Licence

MIT. See [LICENSE](LICENSE).
