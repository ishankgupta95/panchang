package astronomy

import (
	"math"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

func tithiIndexAt(cache *LongitudeCache, ms int64) int {
	return int(math.Floor(utils.Normalize360(cache.GetMoon(ms)-cache.GetSun(ms)) / utils.TithiSpan))
}

func TestSolverMatchesExactBisection(t *testing.T) {
	const tolMs = 30_000
	loc := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567, Elevation: 560}
	_ = loc

	ctx := NewEphemerisCtx()
	solverCache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
	if err != nil {
		t.Fatal(err)
	}
	angle := utils.ElementAngle{
		AngleAt: func(ms int64) float64 { return solverCache.GetMoon(ms) - solverCache.GetSun(ms) },
		SpanDeg: utils.TithiSpan,
	}
	indexAt := func(ms int64) int { return tithiIndexAt(solverCache, ms) }

	var worst int64
	checked := 0
	start := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC).UnixMilli()

	for d := 0; d < 30; d++ {
		dayStart := start + int64(d)*dayMS
		cursor := dayStart
		for k := 0; k < 4 && cursor < dayStart+dayMS; k++ {
			idx := indexAt(cursor)
			end, err := utils.FindTransitionTime(cursor, cursor+36*3600_000, idx, indexAt,
				utils.StandardPrecision.MaxIterations, utils.StandardPrecision.ToleranceMs, &angle)
			if err != nil {
				t.Fatalf("day %d: %v", d, err)
			}

			// A fresh cache, so the bisection is not reading the solver's memo.
			bisectCtx := NewEphemerisCtx()
			bisectCache, err := NewLongitudeCache(bisectCtx, types.Lahiri, ModeInterpolated)
			if err != nil {
				t.Fatal(err)
			}
			bIdx := func(ms int64) int { return tithiIndexAt(bisectCache, ms) }

			lo := float64(end - 3600_000)
			hi := float64(end + 3600_000)
			loIdx := bIdx(int64(lo))
			if bIdx(int64(hi)) == loIdx {
				cursor = end + 1
				continue
			}
			for hi-lo > 1 {
				mid := (lo + hi) / 2
				if bIdx(int64(mid)) == loIdx {
					lo = mid
				} else {
					hi = mid
				}
			}
			if d := abs64(int64(hi) - end); d > worst {
				worst = d
			}
			checked++
			cursor = end + 1
		}
	}

	if checked <= 25 {
		t.Fatalf("only %d tithi transitions were checkable: the test went vacuous", checked)
	}
	if worst >= tolMs {
		t.Errorf("worst solver-vs-bisection disagreement %d ms, bound %d", worst, tolMs)
	}
	t.Logf("%d tithi transitions re-derived by exact bisection: worst disagreement %d ms "+
		"(bound %d ms, the solver's budget)", checked, worst, tolMs)
}

// An early root lets the cursor re-emit the tithi it just closed.
func TestSolverIsNeverEarly(t *testing.T) {
	ctx := NewEphemerisCtx()
	cache, err := NewLongitudeCache(ctx, types.Lahiri, ModeInterpolated)
	if err != nil {
		t.Fatal(err)
	}
	angle := utils.ElementAngle{
		AngleAt: func(ms int64) float64 { return cache.GetMoon(ms) - cache.GetSun(ms) },
		SpanDeg: utils.TithiSpan,
	}
	indexAt := func(ms int64) int { return tithiIndexAt(cache, ms) }

	early, late, checked := 0, 0, 0
	var worstLate int64
	start := time.Date(2025, 0+1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	for d := 0; d < 120; d++ {
		from := start + int64(d)*dayMS
		idx := indexAt(from)
		end, err := utils.FindTransitionTime(from, from+36*3600_000, idx, indexAt,
			utils.StandardPrecision.MaxIterations, utils.StandardPrecision.ToleranceMs, &angle)
		if err != nil {
			t.Fatalf("day %d: %v", d, err)
		}
		checked++
		if indexAt(end) == idx {
			early++
			t.Errorf("day %d: the transition at %d still reports index %d, so the solver "+
				"returned an instant before the flip", d, end, idx)
		}
		if indexAt(end-1) != idx {
			late++
			back := int64(1)
			for ; back < 400 && indexAt(end-back) != idx; back++ {
			}
			if back > worstLate {
				worstLate = back
			}
		}
	}
	if checked < 100 {
		t.Fatalf("only %d transitions checked", checked)
	}
	if early != 0 {
		t.Errorf("%d of %d transitions were early", early, checked)
	}
	if worstLate > 8*25 {
		t.Errorf("a transition was %d ms late; the forward walk caps at 200 ms", worstLate)
	}
	t.Logf("%d tithi transitions: 0 early, %d landed past the flip by at most %d ms "+
		"(the 25 ms forward walk, capped at 8 steps)", checked, late, worstLate)
}
