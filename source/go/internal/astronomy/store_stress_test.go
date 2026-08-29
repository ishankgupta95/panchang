package astronomy

import (
	"fmt"
	"math"
	"os"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/store"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

var stressLocations = []types.GeoLocation{
	{Latitude: 18.5204, Longitude: 73.8567, Elevation: 560}, // Pune
	{Latitude: 28.6139, Longitude: 77.2090},                 // Delhi
	{Latitude: 13.0827, Longitude: 80.2707},                 // Chennai
	{Latitude: 40.7128, Longitude: -74.0060},                // New York
	{Latitude: 51.5074, Longitude: -0.1278},                 // London
	{Latitude: 64.1466, Longitude: -21.9426},                // Reykjavik
	{Latitude: 78.2232, Longitude: 15.6267},                 // Longyearbyen
	{Latitude: -77.8500, Longitude: 166.6700},               // McMurdo
}

func oneDay(ctx *EphemerisCtx, cache *LongitudeCache, loc types.GeoLocation, dayIndex int64) [8]float64 {
	dayStart := dayIndex * dayMS
	var out [8]float64
	out[0] = cache.GetMoon(dayStart + 6*3600_000)
	out[1] = cache.GetSun(dayStart + 6*3600_000)
	sunrise, err := ComputeSunrise(ctx, dayStart, loc, DefaultRiseSetLimitDays)
	if err == nil {
		out[2] = float64(sunrise)
		if sunset, err := ComputeSunset(ctx, sunrise, loc, DefaultRiseSetLimitDays); err == nil {
			out[3] = float64(sunset)
		}
	}
	if mr, ok, _ := GetMoonrise(ctx, dayStart, loc, DefaultRiseSetLimitDays); ok {
		out[4] = float64(mr)
	}
	if ms, ok, _ := GetMoonset(ctx, dayStart, loc, DefaultRiseSetLimitDays); ok {
		out[5] = float64(ms)
	}
	out[6] = cache.GetTropicalMoon(dayStart + 18*3600_000)
	out[7] = cache.GetTropicalSun(dayStart + 18*3600_000)
	return out
}

func stressDays() int {
	if os.Getenv("GEN_FULL") != "" {
		return 200
	}
	return 40
}

// -race does not notice an order-dependent cache; only a bitwise rerun does.
func TestGlobalStoresAreDeterministicUnderLoad(t *testing.T) {
	const goroutines = 16
	days := stressDays()
	epoch := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()

	type probe struct {
		loc      int
		dayIndex int64
	}
	var probes []probe
	for li := range stressLocations {
		for d := 0; d < days; d++ {
			probes = append(probes, probe{li, floorDivInt(epoch+int64(d)*dayMS, dayMS)})
		}
	}

	clearAllStores()
	refCtx := NewEphemerisCtx()
	refCache, err := NewLongitudeCache(refCtx, types.Lahiri, ModeInterpolated)
	if err != nil {
		t.Fatal(err)
	}
	want := make([][8]float64, len(probes))
	for i, p := range probes {
		want[i] = oneDay(refCtx, refCache, stressLocations[p.loc], p.dayIndex)
	}

	clearAllStores()
	var wg sync.WaitGroup
	mismatches := make([]int, goroutines)
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			ctx := NewEphemerisCtx()
			cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
			if err != nil {
				mismatches[g] = -1
				return
			}
			stride := 1 + 2*g
			for k := 0; k < len(probes); k++ {
				i := (g*101 + k*stride) % len(probes)
				got := oneDay(ctx, cache, stressLocations[probes[i].loc], probes[i].dayIndex)
				for j := 0; j < 8; j++ {
					if math.Float64bits(got[j]) != math.Float64bits(want[i][j]) {
						mismatches[g]++
					}
				}
			}
		}(g)
	}
	wg.Wait()

	total := 0
	for g, n := range mismatches {
		if n < 0 {
			t.Fatalf("goroutine %d could not build a cache", g)
		}
		total += n
	}
	if total != 0 {
		t.Errorf("%d of %d values differed from the serial reference across %d goroutines",
			total, goroutines*len(probes)*8, goroutines)
	}

	for _, c := range storeInventory() {
		if c.len == 0 {
			t.Errorf("%s holds nothing after the stress; it is not being exercised", c.name)
		}
		if c.len > c.cap {
			t.Errorf("%s holds %d entries, cap %d", c.name, c.len, c.cap)
		}
	}
	t.Logf("%d goroutines × %d probes (%d locations × %d days), %d values each, all bitwise identical "+
		"to the serial reference", goroutines, len(probes), len(stressLocations), days, 8)
	for _, c := range storeInventory() {
		t.Logf("  %-16s %6d / %6d", c.name, c.len, c.cap)
	}
}

// Clear-on-overflow rebuilds identically, so only the cap and the surviving answers matter.
func TestStoresRespectTheirCapsUnderLoad(t *testing.T) {
	const goroutines = 8
	clearAllStores()

	// 4,000 days × 4 locations overruns the 20,000-entry caps.
	epoch := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	var wg sync.WaitGroup
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			ctx := NewEphemerisCtx()
			cache, _ := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
			for d := g; d < 4000; d += goroutines {
				loc := stressLocations[d%4]
				oneDay(ctx, cache, loc, floorDivInt(epoch+int64(d)*dayMS, dayMS))
			}
		}(g)
	}
	wg.Wait()

	// Captured before the cold rerun below, which clears everything.
	afterSweep := storeInventory()
	evicted := 0
	for _, c := range afterSweep {
		if c.len > c.cap {
			t.Errorf("%s holds %d entries after the sweep, cap %d", c.name, c.len, c.cap)
		}
	}
	for _, c := range afterSweep {
		if c.len < c.cap/2 {
			evicted++
		}
	}
	if evicted == 0 {
		t.Error("no store came back below half its cap; the sweep did not trigger eviction")
	}

	dayIndex := floorDivInt(epoch, dayMS)
	ctx := NewEphemerisCtx()
	cache, _ := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
	warm := oneDay(ctx, cache, stressLocations[0], dayIndex)
	clearAllStores()
	coldCtx := NewEphemerisCtx()
	coldCache, _ := NewLongitudeCache(coldCtx, types.Lahiri, ModeInterpolated)
	cold := oneDay(coldCtx, coldCache, stressLocations[0], dayIndex)
	for j := 0; j < 8; j++ {
		if math.Float64bits(warm[j]) != math.Float64bits(cold[j]) {
			t.Errorf("value %d after eviction: %v, cold %v", j, warm[j], cold[j])
		}
	}
	t.Logf("4,000 day-requests across 4 locations and 8 goroutines; every store inside "+
		"its cap, %d of 6 below half after eviction", evicted)
	for _, c := range afterSweep {
		t.Logf("  %-16s %6d / %6d", c.name, c.len, c.cap)
	}
}

type storeStat struct {
	name string
	len  int
	cap  int
}

func storeInventory() []storeStat {
	return []storeStat{
		{"moonBlockStore", moonBlockStore.Len(), moonBlockStore.Cap()},
		{"sunBlockStore", sunBlockStore.Len(), sunBlockStore.Cap()},
		{"trackStore", trackStore.Len(), trackStore.Cap()},
		{"frameStore", frameStore.Len(), frameStore.Cap()},
		{"scanCache", scanCache.Len(), scanCache.Cap()},
		{"eventCache", eventCache.Len(), eventCache.Cap()},
	}
}

func clearAllStores() {
	ClearBlockStores()
	ClearRiseSetTracks()
	eventCache.Clear()
}

func TestStoreStripeCountIsUniform(t *testing.T) {
	const stripes = store.DefaultStripes
	epoch := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()

	int64Counts := make([]int, stripes)
	stringCounts := make([]int, stripes)
	for d := 0; d < 4096; d++ {
		dayIndex := floorDivInt(epoch+int64(d)*dayMS, dayMS)
		int64Counts[store.HashInt64(dayIndex)&(stripes-1)]++
		for _, loc := range stressLocations {
			key := riseSetScanKey(RiseSetSun, loc, dayIndex)
			stringCounts[store.HashString(key)&(stripes-1)]++
		}
	}
	check := func(name string, counts []int, total int) {
		mean := float64(total) / stripes
		for i, n := range counts {
			// A zero stripe is the failure worth catching.
			if float64(n) < mean/2 || float64(n) > mean*2 {
				t.Errorf("%s: stripe %d took %d of %d keys, uniform is %.0f", name, i, n, total, mean)
			}
		}
	}
	check("HashInt64 over day indices", int64Counts, 4096)
	check("HashString over scan keys", stringCounts, 4096*len(stressLocations))
	t.Logf("%d stripes: day indices %v", stripes, int64Counts)
}

// The stripe count is a package constant, so the sweep builds its own stores.
func BenchmarkStripeSweepBlockStore(b *testing.B) {
	epoch := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	for _, stripes := range []int{1, 2, 4, 8, 16, 32, 64} {
		b.Run(fmt.Sprintf("stripes=%d", stripes), func(b *testing.B) {
			s := store.New[int64, *chebyshevLongitude](maxBlocks, stripes, store.HashInt64)
			ctx := NewEphemerisCtx()
			cache, _ := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
			for d := 0; d < 512; d++ {
				idx := blockIndexFor(epoch+int64(d)*dayMS, moonBlockMS)
				s.GetOrBuild(idx, func() *chebyshevLongitude {
					return newChebyshevLongitude(cache.tropicalMoonAt,
						float64(idx*moonBlockMS), float64((idx+1)*moonBlockMS), moonNodes)
				})
			}
			b.ResetTimer()
			b.RunParallel(func(pb *testing.PB) {
				d := int64(0)
				for pb.Next() {
					idx := blockIndexFor(epoch+(d%512)*dayMS, moonBlockMS)
					if block, ok := s.Get(idx); ok {
						_ = block.at(float64(idx * moonBlockMS))
					}
					d++
				}
			})
		})
	}
}

func BenchmarkParallelDayRequests(b *testing.B) {
	epoch := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	clearAllStores()
	b.SetParallelism(runtime.GOMAXPROCS(0))
	b.RunParallel(func(pb *testing.PB) {
		ctx := NewEphemerisCtx()
		cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
		if err != nil {
			b.Fatal(err)
		}
		d := int64(0)
		for pb.Next() {
			loc := stressLocations[d%int64(len(stressLocations))]
			oneDay(ctx, cache, loc, floorDivInt(epoch+(d%365)*dayMS, dayMS))
			d++
		}
	})
}

func BenchmarkSerialDayRequests(b *testing.B) {
	epoch := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	clearAllStores()
	ctx := NewEphemerisCtx()
	cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		loc := stressLocations[i%len(stressLocations)]
		oneDay(ctx, cache, loc, floorDivInt(epoch+int64(i%365)*dayMS, dayMS))
	}
}
