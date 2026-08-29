package astronomy

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

// The instants below are compared exactly even though `MoonSunElongation` is not bit-identical: probes land on whole milliseconds and the result is rounded.

type lunationGolden struct {
	Meta       map[string]any `json:"_meta"`
	Seed       uint32         `json:"seed"`
	Instants   []int64        `json:"instants"`
	Elongation []float64      `json:"elongation"`
	Searches   map[string][]*int64
	Quarters   []struct {
		Quarter     int   `json:"quarter"`
		Time        int64 `json:"time"`
		NextQuarter int   `json:"nextQuarter"`
		NextTime    int64 `json:"nextTime"`
	} `json:"quarters"`
	Bounds []struct {
		Prev int64 `json:"prev"`
		Next int64 `json:"next"`
	} `json:"bounds"`
	Cached []struct {
		Prev int64 `json:"prev"`
		Next int64 `json:"next"`
	} `json:"cached"`
	PhasesInRange []struct {
		Year   int `json:"year"`
		Events []struct {
			Phase string `json:"phase"`
			Time  int64  `json:"time"`
		} `json:"events"`
	} `json:"phasesInRange"`
	PhasesForYear []struct {
		Year     int             `json:"year"`
		Timezone json.RawMessage `json:"timezone"`
		Events   []struct {
			Phase string `json:"phase"`
			Time  int64  `json:"time"`
		} `json:"events"`
	} `json:"phasesForYear"`
	ZoneOffsets []struct {
		Zone   string  `json:"zone"`
		Ms     int64   `json:"ms"`
		Offset *int    `json:"offset"`
		Error  *string `json:"error"`
	} `json:"zoneOffsets"`
	NumericOffsets []struct {
		Value  json.RawMessage `json:"value"`
		Offset *int            `json:"offset"`
		Error  *string         `json:"error"`
	} `json:"numericOffsets"`
	Formatted []struct {
		Ms     int64  `json:"ms"`
		Offset int    `json:"offset"`
		S      string `json:"s"`
	} `json:"formatted"`
	Midnights []struct {
		Ms       int64 `json:"ms"`
		Offset   int   `json:"offset"`
		Midnight int64 `json:"midnight"`
		Display  int64 `json:"display"`
	} `json:"midnights"`
}

func loadLunationGolden(t *testing.T) lunationGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "astronomy", "lunation-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v (regenerate with `bash go/parity/goldens.sh`)", err)
	}
	var g lunationGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

// Predicted ≤1e-13 deg: one ULP of 360° on the Moon's longitude, the Sun's bit-identical.
func TestMoonSunElongationWithinBound(t *testing.T) {
	const bound = 1e-11
	g := loadLunationGolden(t)
	ctx := NewEphemerisCtx()
	worst, worstAt := 0.0, int64(0)
	for i, ms := range g.Instants {
		if d := math.Abs(angularDelta(MoonSunElongation(ctx, ms), g.Elongation[i])); d > worst {
			worst, worstAt = d, ms
		}
	}
	if worst > bound {
		t.Errorf("worst |Δ| %.4e deg at ms=%d, bound %.0e", worst, worstAt, bound)
	}
	t.Logf("elongation over %d instants: worst |Δ| %.4e deg at ms=%d, and every "+
		"instant derived from it below is exact", len(g.Instants), worst, worstAt)
}

func TestSearchMoonPhaseMatchesTypeScript(t *testing.T) {
	g := loadLunationGolden(t)
	ctx := NewEphemerisCtx()
	targets := map[string]struct {
		degrees   float64
		limitDays float64
	}{
		"t0": {0, 45}, "t90": {90, 45}, "t180": {180, 45}, "t270": {270, 45},
		"t137.5": {137.5, 45}, "t0_narrow": {0, 0.5},
	}
	if len(g.Searches) != len(targets) {
		t.Errorf("golden has %d search targets, the test knows %d", len(g.Searches), len(targets))
	}
	found, nulls, mismatches := 0, 0, 0
	for name, want := range g.Searches {
		spec, ok := targets[name]
		if !ok {
			t.Fatalf("golden has search target %q the test does not know", name)
		}
		for i, ms := range g.Instants {
			got, gotOK := SearchMoonPhase(ctx, spec.degrees, ms, spec.limitDays)
			if want[i] == nil {
				nulls++
				if gotOK {
					mismatches++
					if mismatches <= 5 {
						t.Errorf("%s at ms=%d: Go found %d, TS found null", name, ms, got)
					}
				}
				continue
			}
			found++
			if !gotOK {
				mismatches++
				if mismatches <= 5 {
					t.Errorf("%s at ms=%d: Go found nothing, TS found %d", name, ms, *want[i])
				}
				continue
			}
			if got != *want[i] {
				mismatches++
				if mismatches <= 5 {
					t.Errorf("%s at ms=%d: Go %d, TS %d (Δ %d ms)", name, ms, got, *want[i], got-*want[i])
				}
			}
		}
	}
	if mismatches > 0 {
		t.Errorf("%d of %d searches differ", mismatches, found+nulls)
	}
	if found == 0 || nulls == 0 {
		t.Fatalf("searches covered only one outcome: %d found, %d null", found, nulls)
	}
	t.Logf("%d phase searches (%d found, %d null) all bit-identical", found+nulls, found, nulls)
}

func TestMoonQuartersMatchTypeScript(t *testing.T) {
	g := loadLunationGolden(t)
	ctx := NewEphemerisCtx()
	seen := map[QuarterIndex]int{}
	for i, ms := range g.Instants {
		q, err := SearchMoonQuarter(ctx, ms)
		if err != nil {
			t.Fatalf("SearchMoonQuarter(%d): %v", ms, err)
		}
		want := g.Quarters[i]
		if int(q.Quarter) != want.Quarter || q.TimeMs != want.Time {
			t.Errorf("quarter at ms=%d: Go {%d, %d}, TS {%d, %d}",
				ms, q.Quarter, q.TimeMs, want.Quarter, want.Time)
		}
		seen[q.Quarter]++
		n, err := NextMoonQuarter(ctx, q)
		if err != nil {
			t.Fatalf("NextMoonQuarter: %v", err)
		}
		if int(n.Quarter) != want.NextQuarter || n.TimeMs != want.NextTime {
			t.Errorf("next quarter after ms=%d: Go {%d, %d}, TS {%d, %d}",
				ms, n.Quarter, n.TimeMs, want.NextQuarter, want.NextTime)
		}
		if n.Quarter != (q.Quarter+1)%4 {
			t.Errorf("quarter %d is followed by %d, not %d", q.Quarter, n.Quarter, (q.Quarter+1)%4)
		}
		if gap := n.TimeMs - q.TimeMs; gap < 6*dayMS || gap > 9*dayMS {
			t.Errorf("quarters %d ms apart at ms=%d; they are ~7.38 days", gap, ms)
		}
	}
	if len(seen) != 4 {
		t.Errorf("the sample reached %d of the 4 quarters", len(seen))
	}
	t.Logf("%d quarter searches bit-identical; all four quarters reached %v", len(g.Instants), seen)
}

func TestBoundingNewMoonsMatchTypeScript(t *testing.T) {
	g := loadLunationGolden(t)
	ctx := NewEphemerisCtx()
	for i, ms := range g.Instants {
		b, err := BoundingNewMoons(ctx, ms)
		if err != nil {
			t.Fatalf("BoundingNewMoons(%d): %v", ms, err)
		}
		want := g.Bounds[i]
		if b.PrevMs != want.Prev || b.NextMs != want.Next {
			t.Errorf("bounds at ms=%d: Go {%d, %d}, TS {%d, %d}", ms, b.PrevMs, b.NextMs, want.Prev, want.Next)
		}
		if !(b.PrevMs <= ms && ms < b.NextMs) {
			t.Errorf("bounds at ms=%d do not straddle it: [%d, %d)", ms, b.PrevMs, b.NextMs)
		}
		if span := b.NextMs - b.PrevMs; span < 29*dayMS-14*3600_000 || span > 30*dayMS+14*3600_000 {
			t.Errorf("bounds at ms=%d span %d ms, not one lunation", ms, span)
		}
	}
	t.Logf("%d bounding pairs bit-identical, all straddling their reference", len(g.Instants))
}

func TestNewMoonCacheIsOutputNeutral(t *testing.T) {
	g := loadLunationGolden(t)
	ctx := NewEphemerisCtx()
	cache := &NewMoonCache{}
	for i, ms := range g.Instants {
		b, err := cache.Bounding(ctx, ms)
		if err != nil {
			t.Fatalf("Bounding(%d): %v", ms, err)
		}
		want := g.Cached[i]
		if b.PrevMs != want.Prev || b.NextMs != want.Next {
			t.Errorf("cached bounds at ms=%d: Go {%d, %d}, TS {%d, %d}", ms, b.PrevMs, b.NextMs, want.Prev, want.Next)
		}
		if b.PrevMs != g.Bounds[i].Prev || b.NextMs != g.Bounds[i].Next {
			t.Errorf("cached bounds at ms=%d differ from the uncached ones", ms)
		}
	}
	if cache.Hits == 0 {
		t.Error("the cache never hit; it is not being exercised")
	}
	if len(cache.entries) > newMoonCacheMaxEntries {
		t.Errorf("cache holds %d entries, cap is %d", len(cache.entries), newMoonCacheMaxEntries)
	}

	rev := &NewMoonCache{}
	orderSensitive := 0
	wholeLunation := 0
	for i := len(g.Instants) - 1; i >= 0; i-- {
		ms := g.Instants[i]
		b, err := rev.Bounding(ctx, ms)
		if err != nil {
			t.Fatal(err)
		}
		want := g.Bounds[i]
		if b.PrevMs == want.Prev && b.NextMs == want.Next {
			continue
		}
		orderSensitive++
		if abs64(b.PrevMs-want.Prev) > PhaseAgreementMS || abs64(b.NextMs-want.Next) > PhaseAgreementMS {
			wholeLunation++
			t.Errorf("ms=%d disagrees by a whole lunation: reverse {%d, %d}, uncached {%d, %d}. "+
				"The PhaseAgreementMS guard in NewMoonCache.Bounding is not doing its job",
				ms, b.PrevMs, b.NextMs, want.Prev, want.Next)
			continue
		}
		nearest := min64(
			abs64(ms-want.Prev), abs64(ms-want.Next),
			abs64(ms-b.PrevMs), abs64(ms-b.NextMs))
		if nearest > PhaseAgreementMS {
			t.Errorf("ms=%d is order-sensitive but sits %d ms from the nearest syzygy "+
				"(bound %d): reverse {%d, %d}, uncached {%d, %d}",
				ms, nearest, PhaseAgreementMS, b.PrevMs, b.NextMs, want.Prev, want.Next)
			continue
		}
		if !(b.PrevMs <= ms && ms < b.NextMs) {
			t.Errorf("ms=%d: the reversed read does not straddle it: [%d, %d)", ms, b.PrevMs, b.NextMs)
		}
		if !(want.Prev <= ms && ms < want.Next) {
			t.Errorf("ms=%d: the uncached read does not straddle it: [%d, %d)", ms, want.Prev, want.Next)
		}
	}
	if orderSensitive == 0 {
		t.Error("no instant was order-sensitive; the syzygy neighbourhoods are missing " +
			"from the sample, so the PhaseAgreementMS guard is untested here")
	}
	if orderSensitive > 6 {
		t.Errorf("%d instants are order-sensitive; only the ~1 seeded syzygy "+
			"neighbour should be", orderSensitive)
	}
	if wholeLunation != 0 {
		t.Errorf("%d instants disagreed by a whole lunation; the guard removed all of these",
			wholeLunation)
	}
	t.Logf("%d cached lookups: %d hits, %d misses; %d instants order-sensitive "+
		"(%d by a whole lunation), every one within %d ms of a syzygy and correctly "+
		"bracketed either way",
		len(g.Instants), cache.Hits, cache.Misses, orderSensitive, wholeLunation, PhaseAgreementMS)
}

func min64(vs ...int64) int64 {
	m := vs[0]
	for _, v := range vs[1:] {
		if v < m {
			m = v
		}
	}
	return m
}

func abs64(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

func TestMoonPhasesMatchTypeScript(t *testing.T) {
	g := loadLunationGolden(t)
	ctx := NewEphemerisCtx()
	for _, c := range g.PhasesInRange {
		startMs := utcMS(c.Year, 0, 1)
		endMs := utcMS(c.Year, 11, 31) + 23*3600_000 + 59*60_000 + 59*1000 + 999
		got, err := ComputeMoonPhasesInRange(ctx, startMs, endMs)
		if err != nil {
			t.Fatalf("%d: %v", c.Year, err)
		}
		if len(got) != len(c.Events) {
			t.Errorf("%d: Go found %d phases, TS found %d", c.Year, len(got), len(c.Events))
			continue
		}
		if len(got) < 46 || len(got) > 51 {
			t.Errorf("%d: %d phases in a year, expected ~49", c.Year, len(got))
		}
		for i, e := range got {
			if string(e.Phase) != c.Events[i].Phase || e.TimeMs.Ms() != c.Events[i].Time {
				t.Errorf("%d phase %d: Go {%s, %d}, TS {%s, %d}",
					c.Year, i, e.Phase, e.TimeMs.Ms(), c.Events[i].Phase, c.Events[i].Time)
			}
			if i > 0 && !(e.TimeMs.Ms() > got[i-1].TimeMs.Ms()) {
				t.Errorf("%d: phases not ascending at %d", c.Year, i)
			}
			if i > 0 {
				prev := got[i-1].Phase
				var wantNext MoonPhaseName
				for q := 0; q < 4; q++ {
					if quarterToPhase[q] == prev {
						wantNext = quarterToPhase[(q+1)%4]
					}
				}
				if e.Phase != wantNext {
					t.Errorf("%d: %s followed by %s, expected %s", c.Year, prev, e.Phase, wantNext)
				}
			}
		}
	}

	for _, c := range g.PhasesForYear {
		var tz types.Timezone
		if err := json.Unmarshal(c.Timezone, &tz); err != nil {
			t.Fatalf("timezone %s: %v", c.Timezone, err)
		}
		got, err := ComputeMoonPhasesForYear(ctx, c.Year, MoonPhasesForYearOptions{Timezone: tz})
		if err != nil {
			t.Fatalf("%d %s: %v", c.Year, c.Timezone, err)
		}
		if len(got) != len(c.Events) {
			t.Errorf("%d %s: Go %d phases, TS %d", c.Year, c.Timezone, len(got), len(c.Events))
			continue
		}
		for i, e := range got {
			if string(e.Phase) != c.Events[i].Phase || e.TimeMs.Ms() != c.Events[i].Time {
				t.Errorf("%d %s phase %d: Go {%s, %d}, TS {%s, %d}",
					c.Year, c.Timezone, i, e.Phase, e.TimeMs.Ms(), c.Events[i].Phase, c.Events[i].Time)
			}
		}
	}
	t.Logf("%d year-ranges and %d timezone-years of phases bit-identical",
		len(g.PhasesInRange), len(g.PhasesForYear))
}

// Intl renders whole minutes: Asia/Kolkata in 1900 was +5:21:10, and TS truncates to 321.
func TestResolveUtcOffsetMatchesTypeScript(t *testing.T) {
	g := loadLunationGolden(t)
	subMinute := 0
	for _, c := range g.ZoneOffsets {
		got, err := utils.ResolveUtcOffset(types.TimezoneName(c.Zone), c.Ms)
		if c.Error != nil {
			if err == nil {
				t.Errorf("%s at %d: Go returned %d, TS threw %s", c.Zone, c.Ms, got, *c.Error)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s at %d: Go errored %v, TS returned %d", c.Zone, c.Ms, err, *c.Offset)
			continue
		}
		if got != *c.Offset {
			t.Errorf("%s at %d: Go %d, TS %d", c.Zone, c.Ms, got, *c.Offset)
		}
		if got%15 != 0 {
			subMinute++
		}
	}
	if subMinute == 0 {
		t.Error("no zone/instant in the golden has an unusual offset; the sub-minute " +
			"question this test exists for is not being asked")
	}

	for _, c := range g.NumericOffsets {
		var tz types.Timezone
		if err := json.Unmarshal(c.Value, &tz); err != nil {
			t.Fatalf("offset %s: %v", c.Value, err)
		}
		got, err := utils.ResolveUtcOffset(tz, 0)
		if c.Error != nil {
			if err == nil {
				t.Errorf("offset %s: Go returned %d, TS threw %s", c.Value, got, *c.Error)
				continue
			}
			var pe *types.PanchangError
			if !errors.As(err, &pe) || string(pe.Code) != *c.Error {
				t.Errorf("offset %s: Go %v, TS threw %s", c.Value, err, *c.Error)
			}
			continue
		}
		if err != nil {
			t.Errorf("offset %s: Go errored %v", c.Value, err)
			continue
		}
		if got != *c.Offset {
			t.Errorf("offset %s: Go %d, TS %d", c.Value, got, *c.Offset)
		}
	}
	t.Logf("%d zone/instant offsets and %d numeric offsets match, including %d "+
		"that are not a multiple of 15 minutes", len(g.ZoneOffsets), len(g.NumericOffsets), subMinute)
}

func TestFormatInZoneMatchesTypeScript(t *testing.T) {
	g := loadLunationGolden(t)
	sawPinned := false
	for _, c := range g.Formatted {
		got := utils.FormatInZone(c.Ms, c.Offset)
		if got != c.S {
			t.Errorf("FormatInZone(%d, %d):\n  Go %q\n  TS %q", c.Ms, c.Offset, got, c.S)
		}
		if c.S == "2025-01-14T07:09:44.172+05:30" {
			sawPinned = true
		}
	}
	if !sawPinned {
		t.Error("the golden no longer contains the pinned string " +
			"2025-01-14T07:09:44.172+05:30; the one assertion the TS suite makes by hand")
	}
	if got := utils.FormatInZone(1736818784172, 330); got != "2025-01-14T07:09:44.172+05:30" {
		t.Errorf("the pinned string is %q", got)
	}
	t.Logf("%d formatted strings exact, including the pinned one", len(g.Formatted))
}

func TestLocalMidnightMatchesTypeScript(t *testing.T) {
	g := loadLunationGolden(t)
	for _, c := range g.Midnights {
		if got := utils.GetLocalMidnightUtc(c.Ms, c.Offset); got != c.Midnight {
			t.Errorf("GetLocalMidnightUtc(%d, %d) = %d, TS %d", c.Ms, c.Offset, got, c.Midnight)
		}
		if got := utils.UtcToLocalDisplay(c.Ms, c.Offset); got != c.Display {
			t.Errorf("UtcToLocalDisplay(%d, %d) = %d, TS %d", c.Ms, c.Offset, got, c.Display)
		}
	}
	for _, c := range g.Midnights {
		local := c.Ms + int64(c.Offset)*60_000
		lm := c.Midnight + int64(c.Offset)*60_000
		if !(lm <= local && local-lm < dayMS) {
			t.Errorf("local midnight %d is not the start of the local day containing %d", lm, local)
		}
	}
	t.Logf("%d midnight/display conversions exact", len(g.Midnights))
}
