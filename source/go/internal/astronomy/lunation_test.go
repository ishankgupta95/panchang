package astronomy

import (
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

func TestPhasesPerYearIsAboutFortyNine(t *testing.T) {
	ctx := NewEphemerisCtx()
	for year := 1900; year <= 2100; year += 7 {
		startMs := utcMS(year, 0, 1)
		endMs := utcMS(year, 11, 31) + 23*3600_000 + 59*60_000 + 59*1000 + 999
		events, err := ComputeMoonPhasesInRange(ctx, startMs, endMs)
		if err != nil {
			t.Fatalf("%d: %v", year, err)
		}
		if len(events) < 48 || len(events) > 51 {
			t.Errorf("%d: %d phases, expected 48-51", year, len(events))
		}
		for i, e := range events {
			if e.TimeMs.Ms() < startMs || e.TimeMs.Ms() > endMs {
				t.Errorf("%d: phase at %d is outside the window", year, e.TimeMs.Ms())
			}
			if i > 0 && e.TimeMs.Ms() <= events[i-1].TimeMs.Ms() {
				t.Errorf("%d: phases not ascending at %d", year, i)
			}
		}
		counts := map[MoonPhaseName]int{}
		for _, e := range events {
			counts[e.Phase]++
		}
		if len(counts) != 4 {
			t.Errorf("%d: only %d distinct phases in a year", year, len(counts))
		}
		for phase, n := range counts {
			if n < 11 || n > 14 {
				t.Errorf("%d: %d occurrences of %s, expected 12-13", year, n, phase)
			}
		}
	}
}

func TestSearchMoonPhaseLandsOnItsTarget(t *testing.T) {
	ctx := NewEphemerisCtx()
	worst, worstAt := 0.0, int64(0)
	checked := 0
	for _, target := range []float64{0, 90, 180, 270} {
		for _, startMs := range []int64{
			utcMS(1900, 0, 1), utcMS(1950, 5, 15), utcMS(2025, 0, 14),
			utcMS(2088, 10, 3), utcMS(2099, 11, 1), 0,
		} {
			for k := 0; k < 12; k++ {
				from := startMs + int64(k)*30*dayMS
				got, ok := SearchMoonPhase(ctx, target, from, 45)
				if !ok {
					t.Errorf("target %v from %d: no event within 45 days", target, from)
					continue
				}
				checked++
				if got < from {
					t.Errorf("target %v from %d: returned %d, which is before the start", target, from, got)
				}
				if d := math.Abs(signedDelta(MoonSunElongation(ctx, got), target)); d > worst {
					worst, worstAt = d, got
				}
				if d := signedDelta(MoonSunElongation(ctx, got-1), target); math.Abs(d) < 1e-9 && got-1 >= from {
					t.Errorf("target %v: %d is not the first such instant", target, got)
				}
			}
		}
	}
	if worst > 1e-6 {
		t.Errorf("worst elongation residual %.4e deg at ms=%d, bound 1e-6", worst, worstAt)
	}
	t.Logf("%d searches: worst elongation residual %.4e deg at ms=%d", checked, worst, worstAt)
}

func TestConsecutiveNewMoonsSpanOneCycle(t *testing.T) {
	ctx := NewEphemerisCtx()
	for _, refMs := range []int64{
		utcMS(1900, 0, 15), utcMS(1912, 5, 1), utcMS(1950, 2, 3),
		utcMS(2025, 0, 14), utcMS(2088, 10, 21), utcMS(2099, 6, 4), 0,
	} {
		b, err := BoundingNewMoons(ctx, refMs)
		if err != nil {
			t.Fatalf("%d: %v", refMs, err)
		}
		for _, ms := range []int64{b.PrevMs, b.NextMs} {
			e := MoonSunElongation(ctx, ms)
			if e > 180 {
				e -= 360
			}
			if math.Abs(e) > 1e-5 {
				t.Errorf("elongation at new moon %d is %v deg, not 0", ms, e)
			}
		}
		span := float64(b.NextMs-b.PrevMs) / dayMS
		if span < 29.18 || span > 29.93 {
			t.Errorf("lunation from %d to %d spans %.4f days", b.PrevMs, b.NextMs, span)
		}
	}
}

func TestNewMoonCacheEvicts(t *testing.T) {
	ctx := NewEphemerisCtx()
	cache := &NewMoonCache{}
	base := utcMS(2025, 0, 1)
	for k := 0; k < 12; k++ {
		ms := base + int64(k)*30*dayMS
		cached, err := cache.Bounding(ctx, ms)
		if err != nil {
			t.Fatal(err)
		}
		direct, err := BoundingNewMoons(ctx, ms)
		if err != nil {
			t.Fatal(err)
		}
		if cached != direct {
			t.Errorf("month %d: cached {%d,%d}, direct {%d,%d}",
				k, cached.PrevMs, cached.NextMs, direct.PrevMs, direct.NextMs)
		}
		if len(cache.entries) > newMoonCacheMaxEntries {
			t.Fatalf("cache grew to %d entries, cap %d", len(cache.entries), newMoonCacheMaxEntries)
		}
	}
	again, err := cache.Bounding(ctx, base)
	if err != nil {
		t.Fatal(err)
	}
	direct, err := BoundingNewMoons(ctx, base)
	if err != nil {
		t.Fatal(err)
	}
	if again != direct {
		t.Errorf("after eviction: {%d,%d} vs {%d,%d}", again.PrevMs, again.NextMs, direct.PrevMs, direct.NextMs)
	}
}

func TestMoonPhaseInputValidation(t *testing.T) {
	ctx := NewEphemerisCtx()
	if _, err := ComputeMoonPhasesInRange(ctx, utcMS(1899, 11, 31), utcMS(1900, 0, 5)); err == nil {
		t.Error("a start before 1900 was accepted")
	} else if !isPanchangCode(err, types.ErrInvalidDate) {
		t.Errorf("start before 1900 gave %v, want INVALID_DATE", err)
	}
	if _, err := ComputeMoonPhasesInRange(ctx, utcMS(2100, 0, 1), utcMS(2101, 0, 2)); err == nil {
		t.Error("an end after 2100 was accepted")
	}
	err := ComputeMoonPhasesInRangeErr(ctx, utcMS(2025, 5, 1), utcMS(2025, 0, 1))
	if err == nil {
		t.Fatal("a reversed range was accepted")
	}
	if !isPanchangCode(err, types.ErrInvalidInput) {
		t.Errorf("reversed range gave %v, want INVALID_INPUT", err)
	}
	events, err := ComputeMoonPhasesInRange(ctx, utcMS(2025, 0, 1), utcMS(2025, 0, 1))
	if err != nil {
		t.Fatal(err)
	}
	if events == nil {
		t.Error("an empty result is nil; JSON would write `null` where the TypeScript writes `[]`")
	}
	if _, err := ComputeMoonPhasesForYear(ctx, 2025, MoonPhasesForYearOptions{}); err == nil {
		t.Error("a missing timezone was accepted")
	} else if !isPanchangCode(err, types.ErrInvalidTimezone) {
		t.Errorf("missing timezone gave %v, want INVALID_TIMEZONE", err)
	}
	if _, err := ComputeMoonPhasesForYear(ctx, 2025,
		MoonPhasesForYearOptions{Timezone: types.TimezoneName("Not/AZone")}); err == nil {
		t.Error("an unknown zone was accepted")
	} else if !isPanchangCode(err, types.ErrTimezoneResolutionFailed) {
		t.Errorf("unknown zone gave %v, want TIMEZONE_RESOLUTION_FAILED", err)
	}
}

func ComputeMoonPhasesInRangeErr(ctx *EphemerisCtx, startMs, endMs int64) error {
	_, err := ComputeMoonPhasesInRange(ctx, startMs, endMs)
	return err
}

func BenchmarkMoonSunElongation(b *testing.B) {
	ctx := NewEphemerisCtx()
	base := utcMS(2025, 0, 14)
	var sink float64
	for i := 0; i < b.N; i++ {
		sink += MoonSunElongation(ctx, base+int64(i))
	}
	_ = sink
}

func BenchmarkSearchMoonPhaseNew(b *testing.B) {
	ctx := NewEphemerisCtx()
	base := utcMS(2025, 0, 14)
	for i := 0; i < b.N; i++ {
		SearchMoonPhase(ctx, 0, base+int64(i%365)*dayMS, 45)
	}
}

func BenchmarkBoundingNewMoonsSeeded(b *testing.B) {
	ctx := NewEphemerisCtx()
	base := utcMS(2025, 0, 14)
	for i := 0; i < b.N; i++ {
		if _, err := BoundingNewMoons(ctx, base+int64(i%365)*dayMS); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkNewMoonCacheWarm(b *testing.B) {
	ctx := NewEphemerisCtx()
	cache := &NewMoonCache{}
	base := utcMS(2025, 0, 14)
	if _, err := cache.Bounding(ctx, base); err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := cache.Bounding(ctx, base+int64(i%3600_000)); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkMoonPhasesForYear(b *testing.B) {
	ctx := NewEphemerisCtx()
	opts := MoonPhasesForYearOptions{Timezone: types.TimezoneOffset(330)}
	for i := 0; i < b.N; i++ {
		if _, err := ComputeMoonPhasesForYear(ctx, 2025, opts); err != nil {
			b.Fatal(err)
		}
	}
}
