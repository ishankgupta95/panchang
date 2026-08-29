package core

import (
	"math"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

const invariantSeed = 0xE1E3

// The exact span multiples and their neighbours, which uniform sampling never reaches.
func normalizedLongitudes() []float64 {
	var out []float64
	for _, span := range []float64{
		utils.TithiSpan, utils.KaranaSpan, utils.NakshatraSpan,
		utils.NakshatraPadaSpan, utils.RashiSpan,
	} {
		for k := 0.0; k*span < 360; k++ {
			x := k * span
			out = append(out, x, math.Nextafter(x, 0), math.Nextafter(x, 360))
		}
	}
	uniform(invariantSeed, 6000, 180, func(v float64) { out = append(out, v+180) })
	for i := range out {
		out[i] = utils.Normalize360(out[i])
	}
	return out
}

// Catches integer division: `360 / 27` is 13, and floor(359.9 / 13) is 27, off the table.
func TestElementIndexDomains(t *testing.T) {
	lons := normalizedLongitudes()
	pairs, padaAnomalies := 0, 0
	for _, stride := range []int{0, 1, 13, 601, 2999} {
		for i, moon := range lons {
			sun := lons[(i+stride)%len(lons)]
			pairs++

			tt := ComputeTithiFromLongitudes(moon, sun, "", "")
			if tt.Index < 0 || tt.Index >= utils.TotalTithis {
				t.Fatalf("tithi index %d out of [0,%d) for moon=%v sun=%v", tt.Index, utils.TotalTithis, moon, sun)
			}
			if tt.Number < 1 || tt.Number > 15 {
				t.Fatalf("tithi number %d out of [1,15] for index %d", tt.Number, tt.Index)
			}
			wantNumber := tt.Index - 14
			if tt.Index < 15 {
				wantNumber = tt.Index + 1
			}
			if tt.Number != wantNumber {
				t.Fatalf("tithi index %d gave number %d, want %d", tt.Index, tt.Number, wantNumber)
			}

			nk := ComputeNakshatraFromLongitude(moon, "")
			if nk.Index < 0 || nk.Index >= utils.TotalNakshatras {
				t.Fatalf("nakshatra index %d out of [0,%d) for moon=%v", nk.Index, utils.TotalNakshatras, moon)
			}
			if nk.Pada < 1 || nk.Pada > 4 {
				t.Fatalf("pada %d out of [1,4] for moon=%v (index %d, index*span %v)",
					nk.Pada, moon, nk.Index, float64(nk.Index)*utils.NakshatraSpan)
			}
			if moon < float64(nk.Index)*utils.NakshatraSpan {
				padaAnomalies++
				if nk.Pada != 1 {
					t.Fatalf("moon=%v is below index*span %v, so the clamp must put it at pada 1, got %d",
						moon, float64(nk.Index)*utils.NakshatraSpan, nk.Pada)
				}
				if nk.DegreesInNakshatra != 0 || math.Signbit(nk.DegreesInNakshatra) {
					t.Fatalf("moon=%v: degreesInNakshatra is %v (signbit %v), want +0 after the clamp",
						moon, nk.DegreesInNakshatra, math.Signbit(nk.DegreesInNakshatra))
				}
			}

			y := ComputeYogaFromLongitudes(moon, sun, "")
			if y.Index < 0 || y.Index >= utils.TotalYogas {
				t.Fatalf("yoga index %d out of [0,%d) for moon=%v sun=%v", y.Index, utils.TotalYogas, moon, sun)
			}

			kr := ComputeKaranaFromLongitudes(moon, sun, "")
			if kr.Index < 0 || kr.Index >= utils.TotalKaranas {
				t.Fatalf("karana index %d out of [0,%d) for moon=%v sun=%v", kr.Index, utils.TotalKaranas, moon, sun)
			}
			wantType := types.KaranaMovable
			if kr.Index == 0 || kr.Index >= 57 {
				wantType = types.KaranaFixed
			}
			if kr.Type != wantType {
				t.Fatalf("karana %d typed %q, want %q", kr.Index, kr.Type, wantType)
			}

			for _, c := range []struct {
				name string
				v    float64
			}{
				{"tithi.completionPercentage", tt.CompletionPercentage},
				{"nakshatra.completionPercentage", nk.CompletionPercentage},
				{"yoga.completionPercentage", y.CompletionPercentage},
				{"karana.completionPercentage", kr.CompletionPercentage},
			} {
				if c.v < 0 || c.v > 100 {
					t.Fatalf("%s = %v out of [0,100] for moon=%v sun=%v", c.name, c.v, moon, sun)
				}
			}
			if nk.DegreesInNakshatra < 0 || nk.DegreesInNakshatra >= utils.NakshatraSpan {
				t.Fatalf("degreesInNakshatra %v out of [0,%v) for moon=%v",
					nk.DegreesInNakshatra, utils.NakshatraSpan, moon)
			}
		}
	}
	if pairs < 10_000 {
		t.Fatalf("only %d pairs checked: the sweep is vacuous", pairs)
	}
	t.Logf("%d of %d pairs sit below index*span and are clamped to pada 1 (%.4f%%)",
		padaAnomalies, pairs, 100*float64(padaAnomalies)/float64(pairs))
	if padaAnomalies == 0 {
		t.Error("no pair reached the sub-ULP clamp: the boundary neighbours are missing from the sweep")
	}
}

// One ULP below 17 × NakshatraSpan the quotient rounds up to 17 while index*span is larger, so degreesInNakshatra goes negative.
func TestPadaIsClampedAtBothEdges(t *testing.T) {
	const moon = 226.66666666666666
	got := ComputeNakshatraFromLongitude(moon, "Jyeshtha")
	want := types.NakshatraInfo{
		Index:                17,
		Name:                 "Jyeshtha",
		Pada:                 1,
		DegreesInNakshatra:   0,
		CompletionPercentage: 0,
		EndTime:              nil,
	}
	if got != want {
		t.Errorf("got %+v, want %+v", got, want)
	}
	if math.Signbit(got.DegreesInNakshatra) {
		t.Error("degreesInNakshatra is −0; the clamp is supposed to collapse it to +0, " +
			"which is the half of the fix that JSON.stringify would have hidden")
	}
	if moon >= float64(got.Index)*utils.NakshatraSpan {
		t.Errorf("the trigger condition no longer holds: moon %v >= index*span %v",
			moon, float64(got.Index)*utils.NakshatraSpan)
	}
	for k := 0; k < utils.TotalNakshatras; k++ {
		x := float64(k) * utils.NakshatraSpan
		if p := ComputeNakshatraFromLongitude(x, "").Pada; p != 1 {
			t.Errorf("exact boundary k=%d (%v) gave pada %d, want 1", k, x, p)
		}
	}

	below := 0
	for k := 0; k < utils.TotalNakshatras; k++ {
		x := float64(k) * utils.NakshatraSpan
		for _, y := range []float64{math.Nextafter(x, 0), math.Nextafter(x, 720)} {
			if y < 0 || y >= 360 {
				continue
			}
			r := ComputeNakshatraFromLongitude(y, "")
			if r.Pada < 1 || r.Pada > 4 {
				t.Errorf("neighbour %v of boundary k=%d gave pada %d, want [1,4]", y, k, r.Pada)
			}
			if y < float64(r.Index)*utils.NakshatraSpan {
				below++
				if r.Pada != 1 {
					t.Errorf("neighbour %v is below index*span; want pada 1, got %d", y, r.Pada)
				}
			}
		}
	}
	if below == 0 {
		t.Error("no boundary neighbour landed below index*span: the ULP sweep is vacuous, " +
			"so nothing here exercised the clamp")
	}
	t.Logf("%d of the 54 boundary neighbours sit below index*span and are clamped", below)
}

func TestKaranaIsExactlyHalfATithi(t *testing.T) {
	if utils.KaranaSpan*2 != utils.TithiSpan {
		t.Fatalf("KaranaSpan*2 = %v, TithiSpan = %v", utils.KaranaSpan*2, utils.TithiSpan)
	}
	lons := normalizedLongitudes()
	firstHalf, secondHalf := 0, 0
	for i, moon := range lons {
		sun := lons[(i+7)%len(lons)]
		ti := GetTithiIndexFromLons(moon, sun)
		ki := GetKaranaIndex(moon, sun)
		switch ki {
		case 2 * ti:
			firstHalf++
		case 2*ti + 1:
			secondHalf++
		default:
			t.Fatalf("karana %d is neither half of tithi %d (moon=%v sun=%v)", ki, ti, moon, sun)
		}
	}
	if firstHalf == 0 || secondHalf == 0 {
		t.Fatalf("vacuous: firstHalf=%d secondHalf=%d; one arm never exercised", firstHalf, secondHalf)
	}
}

func TestYogaSharesTheNakshatraDivision(t *testing.T) {
	if utils.YogaSpan != utils.NakshatraSpan {
		t.Fatalf("YogaSpan %v != NakshatraSpan %v", utils.YogaSpan, utils.NakshatraSpan)
	}
	lons := normalizedLongitudes()
	for i, moon := range lons {
		sun := lons[(i+101)%len(lons)]
		got := GetYogaIndex(moon, sun)
		want := utils.NakshatraOf(utils.Normalize360(sun + moon))
		if got != want {
			t.Fatalf("yoga index %d != nakshatraOf(sum) %d for moon=%v sun=%v", got, want, moon, sun)
		}
	}
}

func TestIndexAccessorsAgreeWithTheStructs(t *testing.T) {
	lons := normalizedLongitudes()
	for i, moon := range lons {
		sun := lons[(i+53)%len(lons)]
		if got, want := GetTithiIndexFromLons(moon, sun), ComputeTithiFromLongitudes(moon, sun, "", "").Index; got != want {
			t.Fatalf("tithi: accessor %d != struct %d (moon=%v sun=%v)", got, want, moon, sun)
		}
		if got, want := GetYogaIndex(moon, sun), ComputeYogaFromLongitudes(moon, sun, "").Index; got != want {
			t.Fatalf("yoga: accessor %d != struct %d (moon=%v sun=%v)", got, want, moon, sun)
		}
		if got, want := GetKaranaIndex(moon, sun), ComputeKaranaFromLongitudes(moon, sun, "").Index; got != want {
			t.Fatalf("karana: accessor %d != struct %d (moon=%v sun=%v)", got, want, moon, sun)
		}
		if got, want := utils.NakshatraOf(moon), ComputeNakshatraFromLongitude(moon, "").Index; got != want {
			t.Fatalf("nakshatra: accessor %d != struct %d (moon=%v)", got, want, moon)
		}
	}
}

// Calls are COUNTED: one reaching for the ephemeris directly returns the same numbers here.
func TestAtTimeAccessorsThreadTheInjectedLongitudes(t *testing.T) {
	lons := normalizedLongitudes()
	moonCalls, sunCalls := 0, 0
	getMoon := func(ms int64) float64 { moonCalls++; return lons[int(ms)%len(lons)] }
	getSun := func(ms int64) float64 { sunCalls++; return lons[int(ms*7+3)%len(lons)] }

	for ms := int64(0); ms < int64(len(lons)); ms++ {
		moon, sun := lons[int(ms)%len(lons)], lons[int(ms*7+3)%len(lons)]
		if got, want := GetTithiIndexAtTime(ms, getMoon, getSun), GetTithiIndexFromLons(moon, sun); got != want {
			t.Fatalf("tithi at ms=%d: %d != %d", ms, got, want)
		}
		if got, want := GetNakshatraIndexAtTime(ms, getMoon), utils.NakshatraOf(moon); got != want {
			t.Fatalf("nakshatra at ms=%d: %d != %d", ms, got, want)
		}
		if got, want := GetYogaIndexAtTime(ms, getMoon, getSun), GetYogaIndex(moon, sun); got != want {
			t.Fatalf("yoga at ms=%d: %d != %d", ms, got, want)
		}
		if got, want := GetKaranaIndexAtTime(ms, getMoon, getSun), GetKaranaIndex(moon, sun); got != want {
			t.Fatalf("karana at ms=%d: %d != %d", ms, got, want)
		}
	}
	n := len(lons)
	if moonCalls != 4*n || sunCalls != 3*n {
		t.Errorf("accessor calls: moon %d (want %d), sun %d (want %d): a mismatch means "+
			"one of the four stopped threading its injected accessor",
			moonCalls, 4*n, sunCalls, 3*n)
	}
}

func TestElementsAdvanceMonotonicallyOverAYear(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	cache, err := astronomy.NewLongitudeCache(ctx, types.Lahiri, astronomy.ModeInterpolated)
	if err != nil {
		t.Fatal(err)
	}
	getMoon := LongitudeAt(cache.GetMoon)
	getSun := LongitudeAt(cache.GetSun)

	const hourMs = 3_600_000
	start := types.DateUTC(2025, 0, 1).Ms()
	const hours = 365 * 24

	type track struct {
		name        string
		cycle       int
		at          func(ms int64) int
		prev        int
		transitions int
		seen        map[int]bool
	}
	tracks := []*track{
		{name: "tithi", cycle: utils.TotalTithis, at: func(ms int64) int { return GetTithiIndexAtTime(ms, getMoon, getSun) }},
		{name: "nakshatra", cycle: utils.TotalNakshatras, at: func(ms int64) int { return GetNakshatraIndexAtTime(ms, getMoon) }},
		{name: "yoga", cycle: utils.TotalYogas, at: func(ms int64) int { return GetYogaIndexAtTime(ms, getMoon, getSun) }},
		{name: "karana", cycle: utils.TotalKaranas, at: func(ms int64) int { return GetKaranaIndexAtTime(ms, getMoon, getSun) }},
	}
	for _, tr := range tracks {
		tr.prev = tr.at(start)
		tr.seen = map[int]bool{tr.prev: true}
	}

	for h := 1; h < hours; h++ {
		ms := start + int64(h)*hourMs
		for _, tr := range tracks {
			cur := tr.at(ms)
			if cur < 0 || cur >= tr.cycle {
				t.Fatalf("%s index %d out of [0,%d) at hour %d", tr.name, cur, tr.cycle, h)
			}
			step := (cur - tr.prev + tr.cycle) % tr.cycle
			if step > 1 {
				t.Fatalf("%s jumped %d → %d at hour %d (step %d): the angle advances at most "+
					"0.68°/hour and the span is %v°, so nothing can skip",
					tr.name, tr.prev, cur, h, step, 360.0/float64(tr.cycle))
			}
			if step == 1 {
				tr.transitions++
			}
			tr.seen[cur] = true
			tr.prev = cur
		}
	}

	// The bands reject "nothing moved"; they do not pin a rate.
	for _, c := range []struct {
		name     string
		lo, hi   int
		observed *track
	}{
		{"tithi", 340, 400, tracks[0]},
		{"nakshatra", 330, 395, tracks[1]},
		{"yoga", 355, 420, tracks[2]},
		{"karana", 690, 800, tracks[3]},
	} {
		if c.observed.transitions < c.lo || c.observed.transitions > c.hi {
			t.Errorf("%s made %d transitions in a year, expected %d-%d",
				c.name, c.observed.transitions, c.lo, c.hi)
		}
		if len(c.observed.seen) != c.observed.cycle {
			t.Errorf("%s visited %d of %d indices in a year: a full cycle should be covered",
				c.name, len(c.observed.seen), c.observed.cycle)
		}
		t.Logf("%-10s %d transitions in %d hourly steps (band %d-%d), %d of %d indices visited",
			c.name, c.observed.transitions, hours, c.lo, c.hi, len(c.observed.seen), c.observed.cycle)
	}
}
