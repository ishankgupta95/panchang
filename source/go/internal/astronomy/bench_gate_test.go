package astronomy

import (
	"math"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var gateLocations = []types.GeoLocation{
	{Latitude: 18.5204, Longitude: 73.8567, Elevation: 560}, // Pune
	{Latitude: 28.6139, Longitude: 77.2090},                 // Delhi
	{Latitude: 13.0827, Longitude: 80.2707},                 // Chennai
	{Latitude: 19.0760, Longitude: 72.8777},                 // Mumbai
	{Latitude: 22.5726, Longitude: 88.3639},                 // Kolkata
	{Latitude: 40.7128, Longitude: -74.0060},                // New York
	{Latitude: 51.5074, Longitude: -0.1278},                 // London
	{Latitude: 1.3521, Longitude: 103.8198},                 // Singapore
	{Latitude: -33.8688, Longitude: 151.2093},               // Sydney
	{Latitude: 64.1466, Longitude: -21.9426},                // Reykjavik
}

func gateEpoch() int64 {
	return time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
}

type gateAngle struct {
	angle utils.ElementAngle
	span  float64
}

func gateAngles(cache *LongitudeCache) [4]gateAngle {
	moon := cache.GetMoon
	sun := cache.GetSun
	return [4]gateAngle{
		{utils.ElementAngle{AngleAt: func(ms int64) float64 { return moon(ms) - sun(ms) }, SpanDeg: 12}, 12},
		{utils.ElementAngle{AngleAt: moon, SpanDeg: utils.NakshatraSpan}, utils.NakshatraSpan},
		{utils.ElementAngle{AngleAt: func(ms int64) float64 { return moon(ms) + sun(ms) }, SpanDeg: utils.YogaSpan}, utils.YogaSpan},
		{utils.ElementAngle{AngleAt: func(ms int64) float64 { return moon(ms) - sun(ms) }, SpanDeg: 6}, 6},
	}
}

func gateDayRequest(ctx *EphemerisCtx, cache *LongitudeCache, location types.GeoLocation, dayStartMs int64) int64 {
	var sink int64
	if sunrise, err := ComputeSunrise(ctx, dayStartMs, location, DefaultRiseSetLimitDays); err == nil {
		sink += sunrise
		if sunset, err := ComputeSunset(ctx, sunrise, location, DefaultRiseSetLimitDays); err == nil {
			sink += sunset
		}
	}
	if mr, ok, _ := GetMoonrise(ctx, dayStartMs, location, DefaultRiseSetLimitDays); ok {
		sink += mr
	}
	if ms, ok, _ := GetMoonset(ctx, dayStartMs, location, DefaultRiseSetLimitDays); ok {
		sink += ms
	}

	for _, ga := range gateAngles(cache) {
		a := ga
		indexAt := func(ms int64) int {
			return int(math.Floor(utils.Normalize360(a.angle.AngleAt(ms)) / a.span))
		}
		idx := indexAt(dayStartMs)
		if end, err := utils.FindTransitionTime(dayStartMs, dayStartMs+36*3600_000, idx, indexAt,
			utils.StandardPrecision.MaxIterations, utils.StandardPrecision.ToleranceMs, &a.angle); err == nil {
			sink += end
		}
	}
	return sink
}

func BenchmarkGateSingleDayCold(b *testing.B) {
	loc := gateLocations[0]
	epoch := gateEpoch()
	var sink int64
	for i := 0; i < b.N; i++ {
		clearAllStores()
		ctx := NewEphemerisCtx()
		cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
		if err != nil {
			b.Fatal(err)
		}
		sink += gateDayRequest(ctx, cache, loc, epoch+int64(i%365)*dayMS)
	}
	if sink == 0 {
		b.Fatal("sink")
	}
}

func BenchmarkGateSingleDayWarm(b *testing.B) {
	loc := gateLocations[0]
	epoch := gateEpoch()
	clearAllStores()
	ctx := NewEphemerisCtx()
	cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
	if err != nil {
		b.Fatal(err)
	}
	gateDayRequest(ctx, cache, loc, epoch)
	b.ResetTimer()
	var sink int64
	for i := 0; i < b.N; i++ {
		sink += gateDayRequest(ctx, cache, loc, epoch+int64(i%365)*dayMS)
	}
	if sink == 0 {
		b.Fatal("sink")
	}
}

func BenchmarkGateBatchSerial(b *testing.B) {
	epoch := gateEpoch()
	const days = 365
	var sink int64
	for i := 0; i < b.N; i++ {
		clearAllStores()
		for _, location := range gateLocations {
			ctx := NewEphemerisCtx()
			cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
			if err != nil {
				b.Fatal(err)
			}
			for d := 0; d < days; d++ {
				sink += gateDayRequest(ctx, cache, location, epoch+int64(d)*dayMS)
			}
		}
	}
	if sink == 0 {
		b.Fatal("sink")
	}
	b.ReportMetric(float64(b.Elapsed().Nanoseconds())/float64(b.N*len(gateLocations)*days), "ns/request")
}

func BenchmarkGateBatchParallel(b *testing.B) {
	epoch := gateEpoch()
	const days = 365
	var sink int64
	for i := 0; i < b.N; i++ {
		clearAllStores()
		var wg sync.WaitGroup
		sums := make([]int64, len(gateLocations))
		sem := make(chan struct{}, runtime.GOMAXPROCS(0))
		for li := range gateLocations {
			wg.Add(1)
			go func(li int) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()
				ctx := NewEphemerisCtx()
				cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
				if err != nil {
					return
				}
				for d := 0; d < days; d++ {
					sums[li] += gateDayRequest(ctx, cache, gateLocations[li], epoch+int64(d)*dayMS)
				}
			}(li)
		}
		wg.Wait()
		for _, s := range sums {
			sink += s
		}
	}
	if sink == 0 {
		b.Fatal("sink")
	}
	b.ReportMetric(float64(b.Elapsed().Nanoseconds())/float64(b.N*len(gateLocations)*days), "ns/request")
}

func TestGateBatchIsDeterministic(t *testing.T) {
	epoch := gateEpoch()
	const days = 30

	clearAllStores()
	serial := make([]int64, len(gateLocations)*days)
	for li, location := range gateLocations {
		ctx := NewEphemerisCtx()
		cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
		if err != nil {
			t.Fatal(err)
		}
		for d := 0; d < days; d++ {
			serial[li*days+d] = gateDayRequest(ctx, cache, location, epoch+int64(d)*dayMS)
		}
	}

	clearAllStores()
	parallel := make([]int64, len(gateLocations)*days)
	var wg sync.WaitGroup
	for li := range gateLocations {
		wg.Add(1)
		go func(li int) {
			defer wg.Done()
			ctx := NewEphemerisCtx()
			cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
			if err != nil {
				return
			}
			for d := 0; d < days; d++ {
				parallel[li*days+d] = gateDayRequest(ctx, cache, gateLocations[li], epoch+int64(d)*dayMS)
			}
		}(li)
	}
	wg.Wait()

	for i := range serial {
		if serial[i] != parallel[i] {
			t.Errorf("request %d: serial %d, parallel %d", i, serial[i], parallel[i])
		}
		if serial[i] == 0 {
			t.Errorf("request %d produced nothing", i)
		}
	}
	t.Logf("%d day-requests across %d locations: parallel identical to serial",
		len(serial), len(gateLocations))
}
