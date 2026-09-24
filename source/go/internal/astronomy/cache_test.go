package astronomy

import (
	"encoding/json"
	"errors"
	"math"
	"math/rand"
	"os"
	"sync"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const (
	ms20250114T120010 = int64(1736856010000)
	ms20250114T120045 = int64(1736856045000)
	ms20250114T120000 = int64(1736856000000)
	ms20250114T120500 = int64(1736856300000)
	ms20250114T060030 = int64(1736834430000)
)

func newExactCache(t *testing.T) *LongitudeCache {
	t.Helper()
	c, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, ModeExact)
	if err != nil {
		t.Fatalf("NewLongitudeCache: %v", err)
	}
	return c
}

func newInterpolatedCache(t *testing.T) *LongitudeCache {
	t.Helper()
	c, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, ModeInterpolated)
	if err != nil {
		t.Fatalf("NewLongitudeCache: %v", err)
	}
	return c
}

func TestCacheMemoizesOnTheExactInstantNotATimeBucket(t *testing.T) {
	c := newExactCache(t)
	v1 := c.GetMoon(ms20250114T120010)
	v2 := c.GetMoon(ms20250114T120045)
	if v1 == v2 {
		t.Errorf("35 s apart gave the same longitude %v; the memo is bucketing", v1)
	}
	if c.Hits != 0 || c.Misses != 2 {
		t.Errorf("hits=%d misses=%d, want 0 and 2", c.Hits, c.Misses)
	}
}

func TestCacheReturnsTheCachedValueForARepeatedInstant(t *testing.T) {
	c := newExactCache(t)
	v1 := c.GetMoon(ms20250114T120010)
	v2 := c.GetMoon(ms20250114T120010)
	if math.Float64bits(v1) != math.Float64bits(v2) {
		t.Errorf("repeated instant gave %v then %v", v1, v2)
	}
	if c.Hits != 1 || c.Misses != 1 {
		t.Errorf("hits=%d misses=%d, want 1 and 1", c.Hits, c.Misses)
	}
}

func TestCacheIsOrderIndependent(t *testing.T) {
	base := int64(1736856000000)
	offsets := []int64{0, 7_000, 23_500, 41_000, 59_999, 60_001}

	for _, mode := range []LongitudeCacheMode{ModeExact, ModeInterpolated} {
		ClearBlockStores()
		fwd, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, mode)
		if err != nil {
			t.Fatal(err)
		}
		forward := make([]float64, len(offsets))
		for i, off := range offsets {
			forward[i] = fwd.GetMoon(base + off)
		}

		ClearBlockStores()
		rev, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, mode)
		if err != nil {
			t.Fatal(err)
		}
		reverse := make([]float64, len(offsets))
		for i := len(offsets) - 1; i >= 0; i-- {
			reverse[i] = rev.GetMoon(base + offsets[i])
		}

		for i := range offsets {
			if math.Float64bits(forward[i]) != math.Float64bits(reverse[i]) {
				t.Errorf("%s: offset %d gave %v read forward and %v read backward",
					mode, offsets[i], forward[i], reverse[i])
			}
		}
	}
}

func TestCacheReturnsDifferentValuesForDifferentInstants(t *testing.T) {
	c := newExactCache(t)
	c.GetMoon(ms20250114T120000)
	c.GetMoon(ms20250114T120500)
	if c.Misses != 2 {
		t.Errorf("misses=%d, want 2", c.Misses)
	}
}

func TestCacheSunAndMoonAreSeparate(t *testing.T) {
	ClearBlockStores()
	c := newExactCache(t)
	c.GetSun(ms20250114T120000)
	c.GetMoon(ms20250114T120000)
	if c.Misses != 2 {
		t.Errorf("misses=%d, want 2", c.Misses)
	}
	if c.Size() != 2 {
		t.Errorf("size=%d, want 2", c.Size())
	}
}

func TestCacheHitRateIncreasesWhenTheSameInstantIsReread(t *testing.T) {
	c := newExactCache(t)
	c.GetSun(ms20250114T060030)
	c.GetSun(ms20250114T060030)
	c.GetSun(ms20250114T060030)
	if c.Hits != 2 || c.Misses != 1 {
		t.Errorf("hits=%d misses=%d, want 2 and 1", c.Hits, c.Misses)
	}
}

func TestCacheTropicalReadsAreBitIdenticalToTheAccessor(t *testing.T) {
	ctx := NewEphemerisCtx()
	c, err := NewLongitudeCache(ctx, types.Lahiri, ModeExact)
	if err != nil {
		t.Fatal(err)
	}
	for _, ms := range []int64{ms20250114T120000, 0, j2000NoonMS, -2_000_000_000_000} {
		if got, want := c.GetTropicalMoon(ms), GetTropicalMoonLongitude(NewEphemerisCtx(), ms); math.Float64bits(got) != math.Float64bits(want) {
			t.Errorf("GetTropicalMoon(%d) = %v, accessor = %v", ms, got, want)
		}
		if got, want := c.GetTropicalSun(ms), GetTropicalSunLongitude(NewEphemerisCtx(), ms); math.Float64bits(got) != math.Float64bits(want) {
			t.Errorf("GetTropicalSun(%d) = %v, accessor = %v", ms, got, want)
		}
	}
	c2 := newExactCache(t)
	c2.GetMoon(ms20250114T120000)
	c2.GetSun(ms20250114T120000)
	c2.GetTropicalMoon(ms20250114T120000)
	c2.GetTropicalSun(ms20250114T120000)
	if c2.Misses != 4 || c2.Hits != 0 {
		t.Errorf("four accessors at one instant: hits=%d misses=%d, want 0 and 4", c2.Hits, c2.Misses)
	}
}

func TestBlockIndexMatchesJSFloorDivision(t *testing.T) {
	const maxDateMS = 8_640_000_000_000_000 // the ECMAScript Date range

	check := func(ms, span int64) {
		t.Helper()
		want := math.Floor(float64(ms) / float64(span))
		if got := blockIndexFor(ms, span); float64(got) != want {
			t.Errorf("blockIndexFor(%d, %d) = %d, Math.floor gives %v", ms, span, got, want)
		}
	}

	spans := []int64{moonBlockMS, sunBlockMS}
	for _, span := range spans {
		for _, k := range []int64{0, 1, -1, 2, -2, 100, -100,
			maxDateMS / span, -(maxDateMS / span), maxDateMS/span - 1} {
			for _, off := range []int64{-2, -1, 0, 1, 2} {
				ms := k*span + off
				if ms > maxDateMS || ms < -maxDateMS {
					continue
				}
				check(ms, span)
			}
		}
		unit01(0x8106CE11, 200_000, func(u float64) {
			check(int64(math.Floor((u*2-1)*maxDateMS)), span)
		})
	}

	if got := blockIndexFor(-1, moonBlockMS); got != -1 {
		t.Errorf("blockIndexFor(-1, moonBlockMS) = %d, want -1 (Math.floor, not truncation)", got)
	}
	if got := blockIndexFor(-moonBlockMS, moonBlockMS); got != -1 {
		t.Errorf("blockIndexFor(-moonBlockMS, moonBlockMS) = %d, want -1", got)
	}
	if got := blockIndexFor(-moonBlockMS-1, moonBlockMS); got != -2 {
		t.Errorf("blockIndexFor(-moonBlockMS-1, moonBlockMS) = %d, want -2", got)
	}
	if got := blockIndexFor(0, sunBlockMS); got != 0 {
		t.Errorf("blockIndexFor(0, sunBlockMS) = %d, want 0", got)
	}
}

const differentialSeed = 0xC0FFEE11 // shared with the golden's instant stream

func differentialSamples() int {
	if os.Getenv("GEN_FULL") != "" {
		return 200_000
	}
	return 5_000
}

func blockHasDeltaTStep(ms, span int64) bool {
	i := blockIndexFor(ms, span)
	a := DeltaTSeconds(i * span)
	b := DeltaTSeconds((i + 1) * span)
	mid := DeltaTSeconds(i*span + span/2)
	return math.Abs(mid-(a+b)/2) > 0.1
}

func TestInterpolatedTracksExact(t *testing.T) {
	const moonSmoothBoundDeg = 1e-6
	const sunSmoothBoundDeg = 2e-7
	const moonLeapBoundDeg = 3.05e-4 // two seconds of lunar mean motion
	const sunLeapBoundDeg = 2.281e-5 // two seconds of solar mean motion
	const moonDegPerSecond = 1.5250e-4
	const sunDegPerSecond = 1.1408e-5

	ClearBlockStores()
	exact := newExactCache(t)
	interp := newInterpolatedCache(t)

	n := differentialSamples()
	msLo, msHi := int64(-2_208_988_800_000), int64(4_102_444_800_000)

	type worst struct {
		deg float64
		ms  int64
		n   int
	}
	var moonSmooth, moonLeap, sunSmooth, sunLeap worst
	note := func(w *worst, d float64, ms int64) {
		w.n++
		if d > w.deg {
			w.deg, w.ms = d, ms
		}
	}
	blocks := map[int64]struct{}{}
	unit01(differentialSeed, n, func(u float64) {
		ms := int64(math.Floor(float64(msLo) + u*float64(msHi-msLo)))
		blocks[blockIndexFor(ms, moonBlockMS)] = struct{}{}

		dm := math.Abs(angularDelta(interp.GetMoon(ms), exact.GetMoon(ms)))
		if blockHasDeltaTStep(ms, moonBlockMS) {
			note(&moonLeap, dm, ms)
		} else {
			note(&moonSmooth, dm, ms)
		}
		ds := math.Abs(angularDelta(interp.GetSun(ms), exact.GetSun(ms)))
		if blockHasDeltaTStep(ms, sunBlockMS) {
			note(&sunLeap, ds, ms)
		} else {
			note(&sunSmooth, ds, ms)
		}
	})

	if len(blocks) < n/2 {
		t.Errorf("the sample touched only %d distinct Moon blocks over %d instants; "+
			"the sweep is not exercising the block machinery", len(blocks), n)
	}
	if moonSmooth.deg == 0 || sunSmooth.deg == 0 {
		t.Fatal("interpolated and exact agreed exactly everywhere; the two modes are " +
			"not both being exercised")
	}
	if moonSmooth.n == 0 || sunSmooth.n == 0 {
		t.Fatal("every sampled block was classified as containing a leap second")
	}

	for _, c := range []struct {
		label string
		w     worst
		bound float64
		rate  float64
	}{
		{"Moon, smooth blocks", moonSmooth, moonSmoothBoundDeg, moonDegPerSecond},
		{"Moon, leap-second blocks", moonLeap, moonLeapBoundDeg, moonDegPerSecond},
		{"Sun, smooth blocks", sunSmooth, sunSmoothBoundDeg, sunDegPerSecond},
		{"Sun, leap-second blocks", sunLeap, sunLeapBoundDeg, sunDegPerSecond},
	} {
		if c.w.n == 0 {
			t.Logf("%-26s no samples in this partition", c.label)
			continue
		}
		if c.w.deg > c.bound {
			t.Errorf("%s: worst |Δ| %.4e deg (%.1f ms of motion) at ms=%d, bound %.4e",
				c.label, c.w.deg, c.w.deg/c.rate*1000, c.w.ms, c.bound)
		}
		t.Logf("%-26s n=%-6d worst %.4e deg (%7.1f ms) at %d",
			c.label, c.w.n, c.w.deg, c.w.deg/c.rate*1000, c.w.ms)
	}
	t.Logf("%d instants over %d distinct Moon blocks", n, len(blocks))
}

func TestInterpolationAcrossALeapSecond(t *testing.T) {
	const leapMS = int64(1435708800000) // After the inserted 23:59:60.
	const moonDegPerSecond = 1.5250e-4

	before := DeltaTSeconds(leapMS - 1000)
	after := DeltaTSeconds(leapMS + 1000)
	if d := after - before; math.Abs(d-1) > 1e-9 {
		t.Fatalf("ΔT across 2015-07-01 steps by %v s, want 1 s: the premise of this test", d)
	}

	ClearBlockStores()
	exact := newExactCache(t)
	interp := newInterpolatedCache(t)

	worstIn := 0.0
	for off := int64(-36); off <= 36; off++ {
		ms := leapMS + off*3600*1000
		if !blockHasDeltaTStep(ms, moonBlockMS) {
			continue
		}
		if d := math.Abs(angularDelta(interp.GetMoon(ms), exact.GetMoon(ms))); d > worstIn {
			worstIn = d
		}
	}
	if worstIn < 0.5*moonDegPerSecond || worstIn > 2*moonDegPerSecond {
		t.Errorf("inside the leap-second block the fit misses by %.4e deg (%.1f ms of motion); "+
			"expected between 0.5 and 2 seconds' worth", worstIn, worstIn/moonDegPerSecond*1000)
	}

	worstAway := 0.0
	for off := int64(-36); off <= 36; off++ {
		ms := leapMS + 7*86_400_000 + off*3600*1000
		if blockHasDeltaTStep(ms, moonBlockMS) {
			t.Fatalf("the control window at %d also contains a ΔT step", ms)
		}
		if d := math.Abs(angularDelta(interp.GetMoon(ms), exact.GetMoon(ms))); d > worstAway {
			worstAway = d
		}
	}
	if worstAway > 2*moonDegPerSecond/1000 {
		t.Errorf("one week from the leap second the fit misses by %.4e deg (%.3f ms of motion); "+
			"expected under 2 ms", worstAway, worstAway/moonDegPerSecond*1000)
	}
	t.Logf("2015-07-01 leap second: %.1f ms of lunar motion inside the block, %.3f ms one week away",
		worstIn/moonDegPerSecond*1000, worstAway/moonDegPerSecond*1000)
}

func TestInterpolationGapMatchesTypeScript(t *testing.T) {
	g := loadCacheGolden(t)
	ClearBlockStores()
	exact := newExactCache(t)
	interp := newInterpolatedCache(t)

	type pair struct{ interpolated, exact string }
	pairs := map[string]pair{
		"moon":         {"longitudeCache:interpolated:moon", "longitudeCache:exact:moon"},
		"sun":          {"longitudeCache:interpolated:sun", "longitudeCache:exact:sun"},
		"tropicalMoon": {"longitudeCache:interpolated:tropicalMoon", "longitudeCache:exact:tropicalMoon"},
		"tropicalSun":  {"longitudeCache:interpolated:tropicalSun", "longitudeCache:exact:tropicalSun"},
	}
	goSide := map[string][2]func(int64) float64{
		"moon":         {interp.GetMoon, exact.GetMoon},
		"sun":          {interp.GetSun, exact.GetSun},
		"tropicalMoon": {interp.GetTropicalMoon, exact.GetTropicalMoon},
		"tropicalSun":  {interp.GetTropicalSun, exact.GetTropicalSun},
	}

	const bound = 1e-11
	worst, worstAt, worstMs := 0.0, "", int64(0)
	maxGap := 0.0
	for body, names := range pairs {
		tsInterp, ok := g.Cases[names.interpolated]
		if !ok {
			t.Fatalf("golden has no %s", names.interpolated)
		}
		tsExact := g.Cases[names.exact]
		fns := goSide[body]
		for i, ms := range g.CaseInstants {
			tsGap := angularDelta(tsInterp[i], tsExact[i])
			goGap := angularDelta(fns[0](ms), fns[1](ms))
			maxGap = math.Max(maxGap, math.Abs(tsGap))
			if d := math.Abs(goGap - tsGap); d > worst {
				worst, worstAt, worstMs = d, body, ms
			}
		}
	}
	if maxGap == 0 {
		t.Fatal("the TypeScript's own interpolated-vs-exact gap is zero everywhere; " +
			"the golden is not carrying two different modes")
	}
	if worst > bound {
		t.Errorf("Go's interpolation gap differs from the TypeScript's by %.4e deg (%s at ms=%d), bound %.0e",
			worst, worstAt, worstMs, bound)
	}
	t.Logf("interpolation gap agrees with TypeScript to %.4e deg over %d instants "+
		"(the gap itself reaches %.4e deg)", worst, len(g.CaseInstants), maxGap)
}

func TestBlockBoundaryContinuity(t *testing.T) {
	ClearBlockStores()
	c := newInterpolatedCache(t)

	anchors := []int64{
		1736856000000,
		-1815024000000,
		3736800000000,
		-1,
		0,
		-1262304000000,
	}
	const bound = 1e-6

	worst, worstAt := 0.0, int64(0)
	for _, anchor := range anchors {
		for _, span := range []int64{moonBlockMS, sunBlockMS} {
			edge := blockIndexFor(anchor, span) * span
			for _, ms := range []int64{edge - 2, edge - 1, edge, edge + 1, edge + 2} {
				prev := ms - 1
				for _, read := range []func(int64) float64{c.GetMoon, c.GetSun} {
					d := math.Abs(angularDelta(read(ms), read(prev)))
					if d > worst {
						worst, worstAt = d, ms
					}
				}
			}
		}
	}
	if worst > bound {
		t.Errorf("worst 1 ms jump across a block edge is %.4e deg at ms=%d, bound %.0e",
			worst, worstAt, bound)
	}
	t.Logf("worst 1 ms jump across a block edge: %.4e deg at ms=%d", worst, worstAt)

	for _, anchor := range anchors {
		if anchor >= 0 {
			continue
		}
		edge := blockIndexFor(anchor, moonBlockMS) * moonBlockMS
		if edge > anchor {
			t.Errorf("block edge %d is after its own instant %d, so the index truncated "+
				"toward zero instead of flooring", edge, anchor)
		}
		if anchor-edge >= moonBlockMS {
			t.Errorf("instant %d is %d ms past its block edge %d, more than one span",
				anchor, anchor-edge, edge)
		}
	}
}

func TestEveryAyanamsaTypeResolves(t *testing.T) {
	for _, typ := range types.AllAyanamsaTypes {
		c, err := NewLongitudeCache(NewEphemerisCtx(), typ, ModeExact)
		if err != nil {
			t.Fatalf("NewLongitudeCache(%s): %v", typ, err)
		}
		want, err := ComputeAyanamsa(ms20250114T120000, typ)
		if err != nil {
			t.Fatalf("ComputeAyanamsa(%s): %v", typ, err)
		}
		if want == 0 {
			t.Fatalf("%s: ayanamsa is 0, which is the value a dropped error would give", typ)
		}
		if got := c.ayanamsaDegrees(ms20250114T120000); got != want {
			t.Errorf("%s: cache ayanamsa %v, ComputeAyanamsa %v", typ, got, want)
		}
		if got, tropical := c.GetMoon(ms20250114T120000), c.GetTropicalMoon(ms20250114T120000); math.Abs(angularDelta(tropical-got, want)) > 1e-12 {
			t.Errorf("%s: tropical %v − sidereal %v is not the ayanamsa %v", typ, tropical, got, want)
		}
	}
}

func TestNewLongitudeCacheRejectsBadArguments(t *testing.T) {
	if _, err := NewLongitudeCache(nil, types.Lahiri, ModeExact); err == nil {
		t.Error("a nil EphemerisCtx was accepted")
	}
	_, err := NewLongitudeCache(NewEphemerisCtx(), types.AyanamsaType("bogus"), ModeExact)
	if err == nil {
		t.Fatal("an unknown ayanamsa type was accepted")
	}
	if !errors.Is(err, &types.PanchangError{Code: types.ErrInvalidAyanamsa}) {
		t.Errorf("unknown ayanamsa gave %v, want INVALID_AYANAMSA", err)
	}
	if _, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, ""); err == nil {
		t.Error("the empty mode was accepted; there is no default (D18)")
	}
	_, err = NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, LongitudeCacheMode("approximate"))
	if err == nil {
		t.Fatal("an unknown cache mode was accepted")
	}
	if !errors.Is(err, &types.PanchangError{Code: types.ErrInvalidInput}) {
		t.Errorf("unknown mode gave %v, want INVALID_INPUT", err)
	}
}

func TestConcurrentReadsAreDeterministic(t *testing.T) {
	const goroutines = 8
	const instants = 240

	ms := make([]int64, instants)
	base := int64(1736856000000)
	for i := range ms {
		ms[i] = base + int64(i)*7*3600*1000
	}

	ClearBlockStores()
	ref := newInterpolatedCache(t)
	want := make([][4]float64, instants)
	for i, m := range ms {
		want[i] = [4]float64{ref.GetMoon(m), ref.GetSun(m), ref.GetTropicalMoon(m), ref.GetTropicalSun(m)}
	}

	ClearBlockStores()
	var wg sync.WaitGroup
	errs := make(chan string, goroutines*instants)
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			c, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, ModeInterpolated)
			if err != nil {
				errs <- err.Error()
				return
			}
			stride := 1 + 2*g
			for k := 0; k < instants; k++ {
				i := (g*37 + k*stride) % instants
				got := [4]float64{c.GetMoon(ms[i]), c.GetSun(ms[i]), c.GetTropicalMoon(ms[i]), c.GetTropicalSun(ms[i])}
				for j := 0; j < 4; j++ {
					if math.Float64bits(got[j]) != math.Float64bits(want[i][j]) {
						errs <- "goroutine value differs from the serial reference at ms=" +
							itoa(ms[i]) + " field " + itoa(int64(j))
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
}

func itoa(v int64) string {
	if v == 0 {
		return "0"
	}
	neg := v < 0
	if neg {
		v = -v
	}
	var b [24]byte
	i := len(b)
	for v > 0 {
		i--
		b[i] = byte('0' + v%10)
		v /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

func BenchmarkLongitudeCacheInterpolatedWarm(b *testing.B) {
	ClearBlockStores()
	c, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, ModeInterpolated)
	if err != nil {
		b.Fatal(err)
	}
	base := int64(1736856000000)
	c.GetMoon(base)
	b.ResetTimer()
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += c.GetMoon(base + int64(i%100_000))
	}
	_ = sink
}

func BenchmarkLongitudeCacheExactMiss(b *testing.B) {
	c, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, ModeExact)
	if err != nil {
		b.Fatal(err)
	}
	base := int64(1736856000000)
	b.ResetTimer()
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += c.GetMoon(base + int64(i))
	}
	_ = sink
}

func BenchmarkChebyshevBlockBuildMoon(b *testing.B) {
	c, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, ModeInterpolated)
	if err != nil {
		b.Fatal(err)
	}
	index := blockIndexFor(1736856000000, moonBlockMS)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		newChebyshevLongitude(c.tropicalMoonAt,
			float64(index*moonBlockMS), float64((index+1)*moonBlockMS), moonNodes)
	}
}

func BenchmarkChebyshevAt(b *testing.B) {
	c, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, ModeInterpolated)
	if err != nil {
		b.Fatal(err)
	}
	index := blockIndexFor(1736856000000, moonBlockMS)
	block := newChebyshevLongitude(c.tropicalMoonAt,
		float64(index*moonBlockMS), float64((index+1)*moonBlockMS), moonNodes)
	base := float64(index * moonBlockMS)
	b.ResetTimer()
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += block.at(base + float64(i%100_000))
	}
	_ = sink
}

// riseSetEventKeyString and riseSetScanKeyString are the TypeScript's rise and
// set cache keys, which the riseSetKey structs stand in for.
func riseSetEventKeyString(body RiseSetBody, direction int, loc types.GeoLocation, dayIndex int64) string {
	return string(body) + "|" + jsnum.FormatInt(int64(direction)) + "|" +
		jsnum.FormatFloat(loc.Latitude) + "|" +
		jsnum.FormatFloat(loc.Longitude) + "|" +
		jsnum.FormatFloat(loc.Elevation) + "|" +
		jsnum.FormatInt(dayIndex)
}

func riseSetScanKeyString(body RiseSetBody, loc types.GeoLocation, dayIndex int64) string {
	return string(body) + "|" +
		jsnum.FormatFloat(loc.Latitude) + "|" +
		jsnum.FormatFloat(loc.Longitude) + "|" +
		jsnum.FormatFloat(loc.Elevation) + "|" +
		jsnum.FormatInt(dayIndex)
}

// Two rise/set cache keys must be equal exactly when the TypeScript's strings
// are, or the struct keys would share (or split) an entry the strings do not.
func TestRiseSetKeyEqualityIsTheStringKeys(t *testing.T) {
	rng := rand.New(rand.NewSource(20260924))
	special := []float64{0, math.Copysign(0, -1), 1, -1, 18.5204, 73.8567, 560, -33.8688, 1e-7, 1e21, 1.5e-7,
		123456789012345680000, math.NaN(), math.Float64frombits(0x7ff8000000000abc), math.Inf(1), math.Inf(-1),
		math.SmallestNonzeroFloat64, math.MaxFloat64, math.Nextafter(18.5204, 19)}
	days := []int64{0, -1, 1, 20_089, -25_567, 1 << 53, (1 << 53) + 1, -(1 << 53) - 1, (1 << 53) - 1, 1<<60 + 1, 1 << 60, math.MaxInt64, math.MinInt64}
	pick := func() float64 {
		if rng.Intn(3) == 0 {
			return special[rng.Intn(len(special))]
		}
		return float64(rng.Intn(5)) / 4
	}
	pickDay := func() int64 {
		if rng.Intn(2) == 0 {
			return days[rng.Intn(len(days))]
		}
		return int64(rng.Intn(3))
	}
	bodies := []RiseSetBody{RiseSetSun, RiseSetMoon}
	equal, distinct := 0, 0
	for i := 0; i < 400_000; i++ {
		b1, b2 := bodies[rng.Intn(2)], bodies[rng.Intn(2)]
		d1, d2 := 1-2*rng.Intn(2), 1-2*rng.Intn(2)
		l1 := types.GeoLocation{Latitude: pick(), Longitude: pick(), Elevation: pick()}
		l2 := types.GeoLocation{Latitude: pick(), Longitude: pick(), Elevation: pick()}
		if rng.Intn(2) == 0 {
			l2, b2, d2 = l1, b1, d1
			if rng.Intn(2) == 0 {
				l2.Latitude = math.Copysign(0, -1) * l1.Latitude
			}
		}
		y1, y2 := pickDay(), pickDay()
		sameStruct := newRiseSetKey(b1, d1, l1, y1) == newRiseSetKey(b2, d2, l2, y2)
		sameString := riseSetEventKeyString(b1, d1, l1, y1) == riseSetEventKeyString(b2, d2, l2, y2)
		if sameStruct != sameString {
			t.Fatalf("event keys (%s %d %+v %d) and (%s %d %+v %d): struct equal %v, string equal %v",
				b1, d1, l1, y1, b2, d2, l2, y2, sameStruct, sameString)
		}
		sameStruct = riseSetScanKey(b1, l1, y1) == riseSetScanKey(b2, l2, y2)
		sameString = riseSetScanKeyString(b1, l1, y1) == riseSetScanKeyString(b2, l2, y2)
		if sameStruct != sameString {
			t.Fatalf("scan keys (%s %+v %d) and (%s %+v %d): struct equal %v, string equal %v",
				b1, l1, y1, b2, l2, y2, sameStruct, sameString)
		}
		if sameString {
			equal++
		} else {
			distinct++
		}
	}
	if equal < 1000 || distinct < 1000 {
		t.Fatalf("%d equal and %d distinct pairs: the sweep does not exercise both answers", equal, distinct)
	}
}

func marshalBits(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// A memo hit must be the value the unmemoised function computes for the same
// key on a fresh context, whatever was asked before, and must share no
// pointer with the store. The sweep repeats keys while they are resident,
// runs past the stores' sizes, and alternates two contexts.
func TestEphemerisMemoHitsEqualFreshMisses(t *testing.T) {
	ClearEphemerisMemos()
	shared, other := NewEphemerisCtx(), NewEphemerisCtx()
	rng := rand.New(rand.NewSource(7))
	lo := types.DateUTC(1900, 0, 1).Ms()
	hi := types.DateUTC(2100, 11, 1).Ms()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567, Elevation: 560}
	ctxFor := func(i int) *EphemerisCtx {
		if i%2 == 0 {
			return shared
		}
		return other
	}

	starts := make([]int64, 0, 64)
	for i := 0; i < 64; i++ {
		starts = append(starts, lo+rng.Int63n(hi-lo))
	}
	for pass := 0; pass < 3; pass++ {
		for i, start := range starts {
			for _, target := range []float64{0, 90, 180, 270, math.Copysign(0, -1)} {
				gotMs, gotOK := SearchMoonPhase(ctxFor(i+pass), target, start, 12)
				wantMs, wantOK := searchMoonPhase(NewEphemerisCtx(), target, start, 12)
				if gotMs != wantMs || gotOK != wantOK {
					t.Fatalf("SearchMoonPhase(%v, %d): memo (%d, %v), fresh (%d, %v)", target, start, gotMs, gotOK, wantMs, wantOK)
				}
			}
			for _, body := range AllPlanetBodies {
				if got, want := GetPlanetPosition(ctxFor(i+pass), body, start), planetPosition(NewEphemerisCtx(), body, start); got != want {
					t.Fatalf("GetPlanetPosition(%d, %d): memo %+v, fresh %+v", body, start, got, want)
				}
			}
			if got, want := syzygyLatitude(ctxFor(i+pass), start), GetMoonPosition(NewEphemerisCtx(), start).Latitude; math.Float64bits(got) != math.Float64bits(want) {
				t.Fatalf("syzygyLatitude(%d): memo %v, fresh %v", start, got, want)
			}
		}
	}

	// Real eclipses, found from syzygies, then a lookup away from any.
	eclipses := 0
	for i := 0; i < 40; i++ {
		start := lo + rng.Int63n(hi-lo)
		opp, _ := SearchMoonPhase(shared, 180, start, 45)
		conj, _ := SearchMoonPhase(shared, 0, start, 45)
		for pass := 0; pass < 2; pass++ {
			gotL, okL := FindLunarEclipse(ctxFor(i+pass), opp)
			wantL, wantOKL := findLunarEclipse(NewEphemerisCtx(), opp)
			if okL != wantOKL || marshalBits(t, gotL) != marshalBits(t, wantL) {
				t.Fatalf("FindLunarEclipse(%d): memo %+v, fresh %+v", opp, gotL, wantL)
			}
			gotS, okS := FindLocalSolarEclipse(ctxFor(i+pass), conj, pune)
			wantS, wantOKS := findLocalSolarEclipse(NewEphemerisCtx(), conj, pune)
			if okS != wantOKS || marshalBits(t, gotS) != marshalBits(t, wantS) {
				t.Fatalf("FindLocalSolarEclipse(%d): memo %+v, fresh %+v", conj, gotS, wantS)
			}
			if okL {
				eclipses++
				if gotL.PartialBeginMs != nil {
					*gotL.PartialBeginMs = -1 // must not reach the store
				}
			}
			if okS {
				eclipses++
				if gotS.CentralBeginMs != nil {
					*gotS.CentralBeginMs = -1
				}
			}
		}
	}
	if eclipses == 0 {
		t.Fatal("the sweep found no eclipse, so the eclipse memos were not compared on one")
	}
}

// The memos are process-wide, so goroutines with their own contexts share
// them; the race detector covers the locking, and every answer must still be
// the fresh value.
func TestEphemerisMemosAreSafeForConcurrentUse(t *testing.T) {
	ClearEphemerisMemos()
	lo := types.DateUTC(2020, 0, 1).Ms()
	var wg sync.WaitGroup
	errs := make(chan string, 8)
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			ctx := NewEphemerisCtx()
			for i := 0; i < 60; i++ {
				start := lo + int64((i*7+g)%40)*dayMS
				got, ok := SearchMoonPhase(ctx, 0, start, 45)
				want, wantOK := searchMoonPhase(NewEphemerisCtx(), 0, start, 45)
				if got != want || ok != wantOK {
					errs <- "SearchMoonPhase differs under concurrency"
					return
				}
				if GetPlanetPosition(ctx, PlanetSaturn, start) != planetPosition(NewEphemerisCtx(), PlanetSaturn, start) {
					errs <- "GetPlanetPosition differs under concurrency"
					return
				}
			}
		}(g)
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		t.Fatal(e)
	}
}

// TestEphemerisMemosNeverAnswerANeighbouringKey asks each memo for one key and
// then for keys 1 ms to 1 day away (and, for the local solar eclipse, a
// location a hair away), and compares every second answer with the
// unmemoised function on a fresh context. A memo keyed coarser than its
// inputs, or one that reuses a nearby search, fails here even when it is
// wrong the same way on every run.
func TestEphemerisMemosNeverAnswerANeighbouringKey(t *testing.T) {
	deltas := []int64{1, 999, 59_000, 3_600_000, 86_400_000}
	bases := []int64{
		types.DateUTC(1980, 7, 10).Ms() + 12*3_600_000,
		types.DateUTC(2025, 2, 29).Ms() + 10*3_600_000 + 58*60_000,
		types.DateUTC(1912, 3, 17).Ms() + 11*3_600_000,
		types.DateUTC(2061, 6, 1).Ms(),
	}
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567, Elevation: 560}
	nudged := []types.GeoLocation{
		{Latitude: 18.5204 + 1e-9, Longitude: 73.8567, Elevation: 560},
		{Latitude: 18.5204, Longitude: 73.8567 + 1e-9, Elevation: 560},
		{Latitude: 18.5204, Longitude: 73.8567, Elevation: 561},
	}
	for _, base := range bases {
		for _, d := range deltas {
			ClearEphemerisMemos()
			ctx := NewEphemerisCtx()
			for _, target := range []float64{0, 180} {
				SearchMoonPhase(ctx, target, base, 45)
				got, gotOK := SearchMoonPhase(ctx, target, base+d, 45)
				want, wantOK := searchMoonPhase(NewEphemerisCtx(), target, base+d, 45)
				if got != want || gotOK != wantOK {
					t.Fatalf("SearchMoonPhase(%v, %d) after %d: memo (%d, %v), fresh (%d, %v)", target, base+d, base, got, gotOK, want, wantOK)
				}
			}
			for _, body := range AllPlanetBodies {
				GetPlanetPosition(ctx, body, base)
				if got, want := GetPlanetPosition(ctx, body, base+d), planetPosition(NewEphemerisCtx(), body, base+d); got != want {
					t.Fatalf("GetPlanetPosition(%d, %d) after %d: memo %+v, fresh %+v", body, base+d, base, got, want)
				}
			}
			syzygyLatitude(ctx, base)
			if got, want := syzygyLatitude(ctx, base+d), GetMoonPosition(NewEphemerisCtx(), base+d).Latitude; math.Float64bits(got) != math.Float64bits(want) {
				t.Fatalf("syzygyLatitude(%d) after %d: memo %v, fresh %v", base+d, base, got, want)
			}
			opp, _ := SearchMoonPhase(ctx, 180, base, 45)
			conj, _ := SearchMoonPhase(ctx, 0, base, 45)
			FindLunarEclipse(ctx, opp)
			gotL, okL := FindLunarEclipse(ctx, opp+d)
			wantL, wantOKL := findLunarEclipse(NewEphemerisCtx(), opp+d)
			if okL != wantOKL || marshalBits(t, gotL) != marshalBits(t, wantL) {
				t.Fatalf("FindLunarEclipse(%d) after %d: memo %+v, fresh %+v", opp+d, opp, gotL, wantL)
			}
			FindLocalSolarEclipse(ctx, conj, pune)
			gotS, okS := FindLocalSolarEclipse(ctx, conj+d, pune)
			wantS, wantOKS := findLocalSolarEclipse(NewEphemerisCtx(), conj+d, pune)
			if okS != wantOKS || marshalBits(t, gotS) != marshalBits(t, wantS) {
				t.Fatalf("FindLocalSolarEclipse(%d) after %d: memo %+v, fresh %+v", conj+d, conj, gotS, wantS)
			}
		}
	}
	ClearEphemerisMemos()
	ctx := NewEphemerisCtx()
	for _, base := range bases {
		conj, _ := SearchMoonPhase(ctx, 0, base, 45)
		FindLocalSolarEclipse(ctx, conj, pune)
		for _, loc := range nudged {
			gotS, okS := FindLocalSolarEclipse(ctx, conj, loc)
			wantS, wantOKS := findLocalSolarEclipse(NewEphemerisCtx(), conj, loc)
			if okS != wantOKS || marshalBits(t, gotS) != marshalBits(t, wantS) {
				t.Fatalf("FindLocalSolarEclipse(%d, %+v) after Pune: memo %+v, fresh %+v", conj, loc, gotS, wantS)
			}
		}
	}
	ClearEphemerisMemos()
}
