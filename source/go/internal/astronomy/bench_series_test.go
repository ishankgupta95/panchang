package astronomy

import (
	"testing"
	"time"
)

func BenchmarkGateTrigSin(b *testing.B) {
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += Sin(float64(i) * 1e-6)
	}
	_ = sink
}

func BenchmarkGateMoonElpLongitude(b *testing.B) {
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += MoonElpLongitude(float64(i%1000) * 1e-4)
	}
	_ = sink
}

func BenchmarkGateHeliocentricLongitudeEarth(b *testing.B) {
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += HeliocentricLongitude(Earth, float64(i%1000)*36.525)
	}
	_ = sink
}

func BenchmarkGateGetTropicalMoonLongitude(b *testing.B) {
	ctx := NewEphemerisCtx()
	epoch := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += GetTropicalMoonLongitude(ctx, epoch+int64(i)*60_000)
	}
	_ = sink
}

func BenchmarkGateGetTropicalSunLongitude(b *testing.B) {
	ctx := NewEphemerisCtx()
	epoch := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += GetTropicalSunLongitude(ctx, epoch+int64(i)*60_000)
	}
	_ = sink
}

func BenchmarkGateScanOneDayUncached(b *testing.B) {
	ctx := NewEphemerisCtx()
	loc := gateLocations[0]
	dayIndex := floorDivInt(gateEpoch(), dayMS)
	var sink int
	for i := 0; i < b.N; i++ {
		clearAllRiseSetCaches()
		sink += len(DayEvents(ctx, RiseSetSun, 1, loc, dayIndex+int64(i%365)))
		sink += len(DayEvents(ctx, RiseSetMoon, 1, loc, dayIndex+int64(i%365)))
	}
	_ = sink
}

func BenchmarkGateDayEventsWarmTrack(b *testing.B) {
	ctx := NewEphemerisCtx()
	loc := gateLocations[0]
	dayIndex := floorDivInt(gateEpoch(), dayMS)
	DayEvents(ctx, RiseSetSun, 1, loc, dayIndex)
	b.ResetTimer()
	var sink int
	for i := 0; i < b.N; i++ {
		sink += len(DayEvents(ctx, RiseSetSun, 1, loc, dayIndex))
	}
	_ = sink
}
