package astronomy

import (
	"math"
	"os"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

// Alert is the hard case: the Moon grazes the horizon with altitude and derivative near zero.
var riseSetLocations = []struct {
	name string
	loc  types.GeoLocation
}{
	{"Quito", types.GeoLocation{Latitude: -0.18, Longitude: -78.47}},
	{"Pune", types.GeoLocation{Latitude: 18.52, Longitude: 73.86}},
	{"London", types.GeoLocation{Latitude: 51.51, Longitude: -0.13}},
	{"Reykjavik", types.GeoLocation{Latitude: 64.15, Longitude: -21.94}},
	{"Alert", types.GeoLocation{Latitude: 82.5, Longitude: -62.35}},
	{"McMurdo", types.GeoLocation{Latitude: -77.85, Longitude: 166.67}},
}

var riseSetEpochs = []int64{
	time.Date(1950, 3, 3, 0, 0, 0, 0, time.UTC).UnixMilli(),
	time.Date(2025, 7, 9, 0, 0, 0, 0, time.UTC).UnixMilli(),
	time.Date(2088, 11, 21, 0, 0, 0, 0, time.UTC).UnixMilli(),
}

func riseSetDaysPerEpoch() int {
	if os.Getenv("GEN_FULL") != "" {
		return 12
	}
	return 3
}

func clearAllRiseSetCaches() {
	ClearRiseSetTracks()
}

func TestClearRiseSetTracksClearsTheEventCache(t *testing.T) {
	ctx := NewEphemerisCtx()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}

	ClearRiseSetTracks()
	if n := eventCache.Len(); n != 0 {
		t.Fatalf("event cache holds %d entries immediately after a clear", n)
	}

	for d := 0; d < 5; d++ {
		if _, err := ComputeSunrise(ctx, utcMS(2025, 3, 17)+int64(d)*dayMS, pune,
			DefaultRiseSetLimitDays); err != nil {
			t.Fatalf("ComputeSunrise day %d: %v", d, err)
		}
	}
	filled := eventCache.Len()
	if filled == 0 {
		t.Fatal("five sunrises left the event cache empty; this test is asserting nothing " +
			"because ComputeSunrise no longer resolves through it")
	}

	ClearRiseSetTracks()
	if n := eventCache.Len(); n != 0 {
		t.Errorf("ClearRiseSetTracks left %d of %d event-cache entries; it cleared only "+
			"the track, frame and scan stores (the pre-2026-08-24 behaviour)", n, filled)
	}
	if n := trackStore.Len(); n != 0 {
		t.Errorf("track store holds %d entries after a clear", n)
	}
	if n := frameStore.Len(); n != 0 {
		t.Errorf("frame store holds %d entries after a clear", n)
	}
	if n := scanCache.Len(); n != 0 {
		t.Errorf("scan cache holds %d entries after a clear", n)
	}
	t.Logf("five sunrises filled %d event-cache entries; all four stores clear", filled)
}

func TestInterpolatedRiseSetTracksTheDirectSolver(t *testing.T) {
	days := riseSetDaysPerEpoch()

	for _, body := range []RiseSetBody{RiseSetSun, RiseSetMoon} {
		t.Run(string(body), func(t *testing.T) {
			ClearRiseSetTracks()

			type unit struct {
				locIdx int
				epoch  int64
			}
			var units []unit
			for i := range riseSetLocations {
				for _, e := range riseSetEpochs {
					units = append(units, unit{i, e})
				}
			}

			type result struct {
				cases           int
				countMismatches int
				worstMs         float64
				worstAt         string
				worstTemperate  float64
			}
			results := make([]result, len(units))

			// Parallel so `-race` sees the real shared-store access pattern.
			var wg sync.WaitGroup
			sem := make(chan struct{}, runtime.GOMAXPROCS(0))
			for ui := range units {
				wg.Add(1)
				go func(ui int) {
					defer wg.Done()
					sem <- struct{}{}
					defer func() { <-sem }()
					u := units[ui]
					site := riseSetLocations[u.locIdx]
					ctx := NewEphemerisCtx()
					r := &results[ui]
					for d := 0; d < days; d++ {
						dayIndex := floorDivInt(u.epoch+int64(d)*dayMS, dayMS)
						for _, direction := range []int{1, -1} {
							mine := DayEvents(ctx, body, direction, site.loc, dayIndex)
							truth := dayEventsReference(ctx, body, direction, site.loc, dayIndex)
							r.cases++
							if len(mine) != len(truth) {
								r.countMismatches++
								continue
							}
							for i := range mine {
								delta := math.Abs(mine[i] - truth[i])
								if delta > r.worstMs {
									r.worstMs = delta
									r.worstAt = site.name + " " +
										time.UnixMilli(int64(truth[i])).UTC().Format(time.RFC3339) +
										" dir=" + itoa(int64(direction))
								}
								if math.Abs(site.loc.Latitude) < 65 && delta > r.worstTemperate {
									r.worstTemperate = delta
								}
							}
						}
					}
				}(ui)
			}
			wg.Wait()

			var total, mismatches int
			var worstMs, worstTemperate float64
			worstAt := ""
			for _, r := range results {
				total += r.cases
				mismatches += r.countMismatches
				if r.worstMs > worstMs {
					worstMs, worstAt = r.worstMs, r.worstAt
				}
				if r.worstTemperate > worstTemperate {
					worstTemperate = r.worstTemperate
				}
			}

			want := len(riseSetLocations) * len(riseSetEpochs) * days * 2
			if total < want {
				t.Errorf("%d cases, expected at least %d", total, want)
			}
			if mismatches != 0 {
				t.Errorf("%d cases where the interpolated scan found a different number of "+
					"events than the exhaustive one", mismatches)
			}
			if worstTemperate >= 10 {
				t.Errorf("worst |Δt| below 65° was %.3f ms, bound 10 ms", worstTemperate)
			}
			// Polar sites divide by an altitude rate near zero.
			if worstMs >= 60 {
				t.Errorf("worst |Δt| %.3f ms at %s, bound 60 ms", worstMs, worstAt)
			}
			t.Logf("%d cases (%d days/epoch): worst %.3f ms at %s; below 65° worst %.3f ms",
				total, days, worstMs, worstAt, worstTemperate)
		})
	}
}

func TestRiseSetCachesCannotChangeAnAnswer(t *testing.T) {
	ctx := NewEphemerisCtx()
	loc := riseSetLocations[1].loc
	dayIndex := floorDivInt(time.Date(2025, 4, 17, 0, 0, 0, 0, time.UTC).UnixMilli(), dayMS)

	clearAllRiseSetCaches()
	cold := DayEvents(ctx, RiseSetMoon, 1, loc, dayIndex)
	warm := DayEvents(ctx, RiseSetMoon, 1, loc, dayIndex)

	ClearRiseSetTracks()
	DayEvents(ctx, RiseSetMoon, -1, loc, dayIndex+1)
	DayEvents(ctx, RiseSetSun, 1, loc, dayIndex-1)
	reordered := DayEvents(ctx, RiseSetMoon, 1, loc, dayIndex)

	clearAllRiseSetCaches()
	viaCanonical := CanonicalDayEvents(ctx, RiseSetKind{Body: RiseSetMoon}, 1, loc, dayIndex)

	if len(cold) == 0 {
		t.Fatal("the probe day has no moonrise; pick another")
	}
	for _, other := range [][]float64{warm, reordered, viaCanonical} {
		if len(other) != len(cold) {
			t.Fatalf("event count changed with cache state: %d vs %d", len(other), len(cold))
		}
		for i := range cold {
			if math.Float64bits(other[i]) != math.Float64bits(cold[i]) {
				t.Errorf("event %d moved with cache state: %.6f vs %.6f", i, other[i], cold[i])
			}
		}
	}
}

func TestDayEventsReturnsACopy(t *testing.T) {
	ctx := NewEphemerisCtx()
	loc := riseSetLocations[1].loc
	dayIndex := floorDivInt(time.Date(2025, 4, 17, 0, 0, 0, 0, time.UTC).UnixMilli(), dayMS)
	ClearRiseSetTracks()

	first := DayEvents(ctx, RiseSetSun, 1, loc, dayIndex)
	if len(first) == 0 {
		t.Fatal("no sunrise on the probe day; pick another")
	}
	original := first[0]
	first[0] = 12345
	second := DayEvents(ctx, RiseSetSun, 1, loc, dayIndex)
	if second[0] != original {
		t.Errorf("writing to a returned slice changed the cache: got %v, want %v", second[0], original)
	}

	kind := RiseSetKind{Body: RiseSetSun}
	a := CanonicalDayEvents(ctx, kind, 1, loc, dayIndex)
	a[0] = 999
	b := CanonicalDayEvents(ctx, kind, 1, loc, dayIndex)
	if b[0] != original {
		t.Errorf("writing to a canonical slice changed the cache: got %v, want %v", b[0], original)
	}
	if DayEvents(ctx, RiseSetSun, 1, loc, dayIndex)[0] != original {
		t.Error("the event cache and the scan cache still share a backing array")
	}
}

func TestDayEventsInvariants(t *testing.T) {
	ctx := NewEphemerisCtx()
	ClearRiseSetTracks()
	checked, withEvents := 0, 0
	for _, site := range riseSetLocations {
		for _, epoch := range riseSetEpochs {
			for d := 0; d < 30; d++ {
				dayIndex := floorDivInt(epoch+int64(d)*dayMS, dayMS)
				dayStart := float64(dayIndex * dayMS)
				dayEnd := dayStart + dayMS
				for _, body := range []RiseSetBody{RiseSetSun, RiseSetMoon} {
					for _, direction := range []int{1, -1} {
						events := DayEvents(ctx, body, direction, site.loc, dayIndex)
						checked++
						if len(events) > 0 {
							withEvents++
						}
						for i, e := range events {
							if !(e >= dayStart && e < dayEnd) {
								t.Errorf("%s %s dir=%d day=%d: event %v is outside [%v, %v)",
									site.name, body, direction, dayIndex, e, dayStart, dayEnd)
							}
							if i > 0 && !(e > events[i-1]) {
								t.Errorf("%s %s dir=%d day=%d: events not strictly ascending at %d",
									site.name, body, direction, dayIndex, i)
							}
						}
						// At most two same-kind events a day, and only near the poles.
						if len(events) > 2 {
							t.Errorf("%s %s dir=%d day=%d: %d events in one UTC day",
								site.name, body, direction, dayIndex, len(events))
						}
					}
				}
			}
		}
	}
	if withEvents < checked/3 {
		t.Errorf("only %d of %d day/direction pairs produced an event", withEvents, checked)
	}
	t.Logf("%d day/direction pairs checked, %d with events", checked, withEvents)
}

// Temperate only; at Alert the ordering is false for weeks.
func TestSunriseSunsetOrdering(t *testing.T) {
	ctx := NewEphemerisCtx()
	ClearRiseSetTracks()
	checked := 0
	for _, site := range riseSetLocations[:3] {
		for _, epoch := range riseSetEpochs {
			for d := 0; d < 40; d++ {
				start := epoch + int64(d)*dayMS
				sunrise, err := ComputeSunrise(ctx, start, site.loc, DefaultRiseSetLimitDays)
				if err != nil {
					t.Fatalf("%s: unexpected error at a temperate latitude: %v", site.name, err)
				}
				sunset, err := ComputeSunset(ctx, sunrise, site.loc, DefaultRiseSetLimitDays)
				if err != nil {
					t.Fatalf("%s: unexpected error: %v", site.name, err)
				}
				next, err := ComputeSunrise(ctx, sunset, site.loc, DefaultRiseSetLimitDays)
				if err != nil {
					t.Fatalf("%s: unexpected error: %v", site.name, err)
				}
				if !(sunrise < sunset && sunset < next) {
					t.Errorf("%s day %d: sunrise %d, sunset %d, next sunrise %d", site.name, d, sunrise, sunset, next)
				}
				if gap := next - sunrise; gap < 20*3600_000 || gap > 28*3600_000 {
					t.Errorf("%s day %d: %v between consecutive sunrises", site.name, d, time.Duration(gap)*time.Millisecond)
				}
				checked++
			}
		}
	}
	t.Logf("%d sunrise/sunset/next-sunrise triples ordered correctly", checked)
}

func TestPolarSentinels(t *testing.T) {
	ctx := NewEphemerisCtx()
	ClearRiseSetTracks()
	longyearbyen := types.GeoLocation{Latitude: 78.2232, Longitude: 15.6267}

	winter := time.Date(2025, 12, 21, 0, 0, 0, 0, time.UTC).UnixMilli()
	if _, err := ComputeSunrise(ctx, winter, longyearbyen, DefaultRiseSetLimitDays); err == nil {
		t.Error("Longyearbyen at midwinter returned a sunrise")
	} else if !isPanchangCode(err, types.ErrNoSunrise) {
		t.Errorf("midwinter sunrise error is %v, want NO_SUNRISE", err)
	}
	summer := time.Date(2025, 6, 21, 0, 0, 0, 0, time.UTC).UnixMilli()
	if _, err := ComputeSunset(ctx, summer, longyearbyen, DefaultRiseSetLimitDays); err == nil {
		t.Error("Longyearbyen at midsummer returned a sunset")
	} else if !isPanchangCode(err, types.ErrNoSunset) {
		t.Errorf("midsummer sunset error is %v, want NO_SUNSET", err)
	}
	if _, _, err := GetMoonrise(ctx, winter, longyearbyen, DefaultRiseSetLimitDays); err != nil {
		t.Errorf("GetMoonrise errored at a polar latitude: %v", err)
	}

	bad := types.GeoLocation{Latitude: 91, Longitude: 0}
	_, err := ComputeSunrise(ctx, winter, bad, DefaultRiseSetLimitDays)
	if err == nil {
		t.Fatal("latitude 91 was accepted")
	}
	if isPanchangCode(err, types.ErrNoSunrise) {
		t.Error("an invalid latitude reported NO_SUNRISE; the catch sites would skip the day instead of failing")
	}
	if !isPanchangCode(err, types.ErrInvalidLatitude) {
		t.Errorf("latitude 91 gave %v, want INVALID_LATITUDE", err)
	}
	if _, _, err := GetMoonset(ctx, winter, types.GeoLocation{Latitude: 0, Longitude: 181}, DefaultRiseSetLimitDays); err == nil {
		t.Error("longitude 181 was accepted")
	} else if !isPanchangCode(err, types.ErrInvalidLongitude) {
		t.Errorf("longitude 181 gave %v, want INVALID_LONGITUDE", err)
	}
}

func isPanchangCode(err error, code types.ErrorCode) bool {
	pe, ok := err.(*types.PanchangError)
	return ok && pe.Code == code
}

// The track store is shared: a Moon request on day N can be served a block built for the Sun on N+3.
func TestConcurrentRiseSetIsDeterministic(t *testing.T) {
	const goroutines = 8
	days := 20
	epoch := riseSetEpochs[1]

	type probe struct {
		site      int
		body      RiseSetBody
		direction int
		dayIndex  int64
	}
	var probes []probe
	for si := range riseSetLocations {
		for d := 0; d < days; d++ {
			dayIndex := floorDivInt(epoch+int64(d)*dayMS, dayMS)
			for _, body := range []RiseSetBody{RiseSetSun, RiseSetMoon} {
				for _, direction := range []int{1, -1} {
					probes = append(probes, probe{si, body, direction, dayIndex})
				}
			}
		}
	}

	ClearRiseSetTracks()
	ref := NewEphemerisCtx()
	want := make([][]float64, len(probes))
	for i, p := range probes {
		want[i] = DayEvents(ref, p.body, p.direction, riseSetLocations[p.site].loc, p.dayIndex)
	}

	ClearRiseSetTracks()
	var wg sync.WaitGroup
	errs := make(chan string, goroutines*len(probes))
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			ctx := NewEphemerisCtx()
			stride := 1 + 2*g
			for k := 0; k < len(probes); k++ {
				i := (g*53 + k*stride) % len(probes)
				p := probes[i]
				got := DayEvents(ctx, p.body, p.direction, riseSetLocations[p.site].loc, p.dayIndex)
				if len(got) != len(want[i]) {
					errs <- "event count differs at probe " + itoa(int64(i))
					continue
				}
				for j := range got {
					if math.Float64bits(got[j]) != math.Float64bits(want[i][j]) {
						errs <- "event differs from the serial reference at probe " + itoa(int64(i))
					}
				}
			}
		}(g)
	}
	wg.Wait()
	close(errs)
	n := 0
	for msg := range errs {
		if n < 5 {
			t.Error(msg)
		}
		n++
	}
	if n > 0 {
		t.Errorf("%d concurrent reads differed from the serial reference", n)
	}
	t.Logf("%d goroutines × %d probes, all bit-identical to the serial reference", goroutines, len(probes))
}

func BenchmarkDayEventsWarm(b *testing.B) {
	ClearRiseSetTracks()
	ctx := NewEphemerisCtx()
	loc := riseSetLocations[1].loc
	dayIndex := floorDivInt(riseSetEpochs[1], dayMS)
	DayEvents(ctx, RiseSetSun, 1, loc, dayIndex)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		DayEvents(ctx, RiseSetSun, 1, loc, dayIndex)
	}
}

func BenchmarkScanDaySun(b *testing.B) {
	ctx := NewEphemerisCtx()
	loc := riseSetLocations[1].loc
	dayIndex := floorDivInt(riseSetEpochs[1], dayMS)
	trackFor(ctx, RiseSetSun, dayIndex)
	frameFor(ctx, dayIndex)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		scanDay(ctx, RiseSetSun, loc, dayIndex)
	}
}

func BenchmarkScanDayMoon(b *testing.B) {
	ctx := NewEphemerisCtx()
	loc := riseSetLocations[1].loc
	dayIndex := floorDivInt(riseSetEpochs[1], dayMS)
	trackFor(ctx, RiseSetMoon, dayIndex)
	frameFor(ctx, dayIndex)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		scanDay(ctx, RiseSetMoon, loc, dayIndex)
	}
}

func BenchmarkPositionTrackBuildMoon(b *testing.B) {
	ctx := NewEphemerisCtx()
	blockIndex := floorDivInt(floorDivInt(riseSetEpochs[1], dayMS), trackBlockDays)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		newPositionTrack(ctx, RiseSetMoon, blockIndex)
	}
}

func BenchmarkAltitudeExcess(b *testing.B) {
	ctx := NewEphemerisCtx()
	loc := riseSetLocations[1].loc
	dayIndex := floorDivInt(riseSetEpochs[1], dayMS)
	track := trackFor(ctx, RiseSetMoon, dayIndex)
	frame := frameFor(ctx, dayIndex)
	geometry := newObserverGeometry(loc)
	base := float64(dayIndex * dayMS)
	b.ResetTimer()
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += altitudeExcess(track, frame, geometry, base+float64(i%86_400_000))
	}
	_ = sink
}

// The reset stays inside the timed region: StopTimer/StartTimer around it under-reports a cold day.

func BenchmarkSunriseSunsetColdDay(b *testing.B) {
	loc := riseSetLocations[1].loc
	for i := 0; i < b.N; i++ {
		clearAllRiseSetCaches()
		ctx := NewEphemerisCtx()
		start := riseSetEpochs[1] + int64(i%365)*dayMS
		sunrise, err := ComputeSunrise(ctx, start, loc, DefaultRiseSetLimitDays)
		if err != nil {
			b.Fatal(err)
		}
		if _, err := ComputeSunset(ctx, sunrise, loc, DefaultRiseSetLimitDays); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSunriseSunsetYear(b *testing.B) {
	const days = 365
	loc := riseSetLocations[1].loc
	for i := 0; i < b.N; i++ {
		clearAllRiseSetCaches()
		ctx := NewEphemerisCtx()
		for d := 0; d < days; d++ {
			start := riseSetEpochs[1] + int64(d)*dayMS
			sunrise, err := ComputeSunrise(ctx, start, loc, DefaultRiseSetLimitDays)
			if err != nil {
				b.Fatal(err)
			}
			if _, err := ComputeSunset(ctx, sunrise, loc, DefaultRiseSetLimitDays); err != nil {
				b.Fatal(err)
			}
			if _, _, err := GetMoonrise(ctx, start, loc, DefaultRiseSetLimitDays); err != nil {
				b.Fatal(err)
			}
			if _, _, err := GetMoonset(ctx, start, loc, DefaultRiseSetLimitDays); err != nil {
				b.Fatal(err)
			}
		}
	}
	b.ReportMetric(float64(b.Elapsed().Nanoseconds())/float64(b.N*days), "ns/day")
}
