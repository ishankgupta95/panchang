package utils

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"math/rand"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type utilsGolden struct {
	Meta        map[string]any `json:"_meta"`
	SolverEpoch int64          `json:"solverEpoch"`
	Transitions []struct {
		StartMs     int64           `json:"startMs"`
		Idx         int             `json:"idx"`
		WindowHours float64         `json:"windowHours"`
		WithAngle   bool            `json:"withAngle"`
		Value       json.RawMessage `json:"value"`
	} `json:"transitions"`
	Starts []struct {
		FromMs    int64   `json:"fromMs"`
		Idx       int     `json:"idx"`
		BackHours float64 `json:"backHours"`
		WithAngle bool    `json:"withAngle"`
		Value     int64   `json:"value"`
	} `json:"starts"`
	Boundaries []struct {
		LoMs    int64  `json:"loMs"`
		HiMs    int64  `json:"hiMs"`
		Element *int64 `json:"element"`
	} `json:"boundaries"`
	Crossings []struct {
		Target float64 `json:"target"`
		LoMs   int64   `json:"loMs"`
		HiMs   int64   `json:"hiMs"`
		Value  *int64  `json:"value"`
	} `json:"crossings"`
	Daily []struct {
		SunriseMs     int64 `json:"sunriseMs"`
		NextSunriseMs int64 `json:"nextSunriseMs"`
		Elements      []struct {
			Index             int    `json:"index"`
			StartTime         *int64 `json:"startTime"`
			EndTime           *int64 `json:"endTime"`
			IsActiveAtSunrise bool   `json:"isActiveAtSunrise"`
		} `json:"elements"`
	} `json:"daily"`
	Slots []struct {
		RefMs      int64     `json:"refMs"`
		DurationMs float64   `json:"durationMs"`
		Count      int       `json:"count"`
		Bounds     [][]int64 `json:"bounds"`
	} `json:"slots"`
	VaraChaldeanStart []int `json:"varaChaldeanStart"`
	Constants         struct {
		TithiSpan         float64 `json:"TITHI_SPAN"`
		NakshatraSpan     float64 `json:"NAKSHATRA_SPAN"`
		NakshatraPadaSpan float64 `json:"NAKSHATRA_PADA_SPAN"`
		YogaSpan          float64 `json:"YOGA_SPAN"`
		KaranaSpan        float64 `json:"KARANA_SPAN"`
		RashiSpan         float64 `json:"RASHI_SPAN"`
	} `json:"constants"`
	NakshatraOf     [][]float64 `json:"nakshatraOf"`
	RashiOf         [][]float64 `json:"rashiOf"`
	AnandadiTable   [][]int     `json:"anandadiTable"`
	AnandadiQuality []string    `json:"anandadiQuality"`
	VarjyamOffsets  []int       `json:"varjyamOffsets"`
	RahuKalamSlots  []int       `json:"rahuKalamSlots"`
	YamagandaSlots  []int       `json:"yamagandaSlots"`
	GulikaSlots     []int       `json:"gulikaSlots"`
}

func loadUtilsGolden(t *testing.T) utilsGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "utils", "utils-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v (regenerate with `bash go/parity/goldens.sh`)", err)
	}
	var g utilsGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

func syntheticAngleAt(epoch, ms int64) float64 {
	t := float64(ms-epoch) / 3600_000
	return 12.7 + float64(0.55*t) + float64(0.0004*t*t) - float64(0.0000009*t*t*t)
}

func syntheticIndexAt(epoch, ms int64) int {
	return int(math.Floor(jsnum.Mod(jsnum.Mod(syntheticAngleAt(epoch, ms), 360)+360, 360) / 12))
}

func syntheticAngle(epoch int64) ElementAngle {
	return ElementAngle{
		AngleAt: func(ms int64) float64 { return syntheticAngleAt(epoch, ms) },
		SpanDeg: 12,
	}
}

func TestFindTransitionTimeMatchesTypeScript(t *testing.T) {
	g := loadUtilsGolden(t)
	angle := syntheticAngle(g.SolverEpoch)
	indexAt := func(ms int64) int { return syntheticIndexAt(g.SolverEpoch, ms) }
	withAngle, withoutAngle, errs := 0, 0, 0
	for _, c := range g.Transitions {
		var a *ElementAngle
		if c.WithAngle {
			a = &angle
			withAngle++
		} else {
			withoutAngle++
		}
		maxEnd := c.StartMs + int64(c.WindowHours*3600_000)
		got, err := FindTransitionTime(c.StartMs, maxEnd, c.Idx, indexAt,
			StandardPrecision.MaxIterations, StandardPrecision.ToleranceMs, a)

		var wantCode string
		if json.Unmarshal(c.Value, &wantCode) == nil {
			errs++
			if err == nil {
				t.Errorf("start=%d idx=%d: Go returned %d, TS threw %s", c.StartMs, c.Idx, got, wantCode)
			} else if codeOf(err) != types.ErrorCode(wantCode) {
				t.Errorf("start=%d: Go %v, TS threw %s", c.StartMs, err, wantCode)
			}
			continue
		}
		var want int64
		if err := json.Unmarshal(c.Value, &want); err != nil {
			t.Fatalf("golden value %s is neither a number nor a code", c.Value)
		}
		if err != nil {
			t.Errorf("start=%d idx=%d angle=%v: Go errored %v, TS returned %d",
				c.StartMs, c.Idx, c.WithAngle, err, want)
			continue
		}
		if got != want {
			t.Errorf("start=%d idx=%d window=%v angle=%v: Go %d, TS %d (Δ %d ms)",
				c.StartMs, c.Idx, c.WindowHours, c.WithAngle, got, want, got-want)
		}
	}
	if withAngle == 0 || withoutAngle == 0 {
		t.Fatalf("only one path covered: %d with angle, %d without", withAngle, withoutAngle)
	}
	t.Logf("%d transitions bit-identical (%d secant, %d bisection, %d SEARCH_DIVERGED)",
		len(g.Transitions), withAngle, withoutAngle, errs)
}

func TestFindStartTimeMatchesTypeScript(t *testing.T) {
	g := loadUtilsGolden(t)
	angle := syntheticAngle(g.SolverEpoch)
	indexAt := func(ms int64) int { return syntheticIndexAt(g.SolverEpoch, ms) }
	for _, c := range g.Starts {
		var a *ElementAngle
		if c.WithAngle {
			a = &angle
		}
		got := FindStartTime(c.FromMs, c.Idx, indexAt, c.BackHours,
			StandardPrecision.MaxIterations, StandardPrecision.ToleranceMs, a)
		if got != c.Value {
			t.Errorf("from=%d idx=%d back=%v angle=%v: Go %d, TS %d (Δ %d ms)",
				c.FromMs, c.Idx, c.BackHours, c.WithAngle, got, c.Value, got-c.Value)
		}
	}
	t.Logf("%d start searches bit-identical", len(g.Starts))
}

func TestSolveBoundaryAndCrossingMatchTypeScript(t *testing.T) {
	g := loadUtilsGolden(t)
	angle := syntheticAngle(g.SolverEpoch)
	indexAt := func(ms int64) int { return syntheticIndexAt(g.SolverEpoch, ms) }

	for _, c := range g.Boundaries {
		stillBefore := func(ms int64) bool { return indexAt(ms) == indexAt(c.LoMs) }
		got, ok := SolveElementBoundary(float64(c.LoMs), float64(c.HiMs), angle, stillBefore)
		if (c.Element == nil) == ok {
			t.Errorf("boundary lo=%d: Go found=%v, TS found=%v", c.LoMs, ok, c.Element != nil)
			continue
		}
		if ok && got != *c.Element {
			t.Errorf("boundary lo=%d: Go %d, TS %d", c.LoMs, got, *c.Element)
		}
	}

	found, nulls := 0, 0
	for _, c := range g.Crossings {
		before := func(ms int64) bool {
			a := jsnum.Mod(jsnum.Mod(syntheticAngleAt(g.SolverEpoch, ms), 360)+360, 360)
			return a < c.Target
		}
		got, ok := SolveAngleCrossing(float64(c.LoMs), float64(c.HiMs), c.Target,
			func(ms int64) float64 { return syntheticAngleAt(g.SolverEpoch, ms) }, before)
		if c.Value == nil {
			nulls++
			if ok {
				t.Errorf("crossing target=%v lo=%d: Go found %d, TS found null", c.Target, c.LoMs, got)
			}
			continue
		}
		found++
		if !ok {
			t.Errorf("crossing target=%v lo=%d: Go found nothing, TS found %d", c.Target, c.LoMs, *c.Value)
			continue
		}
		if got != *c.Value {
			t.Errorf("crossing target=%v lo=%d: Go %d, TS %d", c.Target, c.LoMs, got, *c.Value)
		}
	}
	if found == 0 || nulls == 0 {
		t.Fatalf("crossings covered only one outcome: %d found, %d null", found, nulls)
	}
	t.Logf("%d element boundaries and %d crossings (%d found, %d declined) bit-identical",
		len(g.Boundaries), len(g.Crossings), found, nulls)
}

func TestFindDailyElementsMatchesTypeScript(t *testing.T) {
	g := loadUtilsGolden(t)
	angle := syntheticAngle(g.SolverEpoch)
	indexAt := func(ms int64) int { return syntheticIndexAt(g.SolverEpoch, ms) }

	type elem struct{ index int }
	type wrapped struct {
		index             int
		startMs, endMs    int64
		isActiveAtSunrise bool
	}

	for _, c := range g.Daily {
		got, err := FindDailyElements(
			c.SunriseMs, c.NextSunriseMs,
			elem{indexAt(c.SunriseMs)},
			func(e elem) int { return e.index },
			indexAt,
			func(ms int64) elem { return elem{indexAt(ms)} },
			36, StandardPrecision, 5, &angle,
			func(e elem, startMs, endMs int64, active bool) wrapped {
				return wrapped{e.index, startMs, endMs, active}
			},
		)
		if err != nil {
			t.Fatalf("sunrise=%d: %v", c.SunriseMs, err)
		}
		if len(got) != len(c.Elements) {
			t.Errorf("sunrise=%d: Go found %d elements, TS found %d", c.SunriseMs, len(got), len(c.Elements))
			continue
		}
		for i, e := range got {
			w := c.Elements[i]
			if e.index != w.Index {
				t.Errorf("sunrise=%d elem %d: index %d vs %d", c.SunriseMs, i, e.index, w.Index)
			}
			if w.StartTime == nil || e.startMs != *w.StartTime {
				t.Errorf("sunrise=%d elem %d: start %d vs %v", c.SunriseMs, i, e.startMs, w.StartTime)
			}
			if w.EndTime == nil || e.endMs != *w.EndTime {
				t.Errorf("sunrise=%d elem %d: end %d vs %v", c.SunriseMs, i, e.endMs, w.EndTime)
			}
			if e.isActiveAtSunrise != w.IsActiveAtSunrise {
				t.Errorf("sunrise=%d elem %d: active %v vs %v", c.SunriseMs, i, e.isActiveAtSunrise, w.IsActiveAtSunrise)
			}
			if (i == 0) != e.isActiveAtSunrise {
				t.Errorf("sunrise=%d: isActiveAtSunrise is set on element %d", c.SunriseMs, i)
			}
			if i > 0 && e.startMs != got[i-1].endMs+1 {
				t.Errorf("sunrise=%d: element %d starts at %d, previous ended at %d",
					c.SunriseMs, i, e.startMs, got[i-1].endMs)
			}
			if e.endMs > c.NextSunriseMs {
				t.Errorf("sunrise=%d: element %d ends past nextSunrise", c.SunriseMs, i)
			}
		}
		if len(got) > 0 && got[len(got)-1].endMs != c.NextSunriseMs {
			t.Errorf("sunrise=%d: the day's last element ends at %d, not nextSunrise %d",
				c.SunriseMs, got[len(got)-1].endMs, c.NextSunriseMs)
		}
	}
	t.Logf("%d days of element walks bit-identical", len(g.Daily))
}

func TestBuildEqualSlotsMatchesTypeScript(t *testing.T) {
	g := loadUtilsGolden(t)
	for _, c := range g.Slots {
		got := BuildEqualSlots(c.RefMs, c.DurationMs, c.Count,
			func(ordinal int, startMs, endMs int64) [3]int64 {
				return [3]int64{int64(ordinal), startMs, endMs}
			})
		if len(got) != len(c.Bounds) {
			t.Errorf("ref=%d count=%d: %d slots vs %d", c.RefMs, c.Count, len(got), len(c.Bounds))
			continue
		}
		for i, s := range got {
			w := c.Bounds[i]
			if s[0] != w[0] || s[1] != w[1] || s[2] != w[2] {
				t.Errorf("ref=%d count=%d slot %d: Go %v, TS %v", c.RefMs, c.Count, i, s, w)
			}
			if i > 0 && s[1] != got[i-1][2] {
				t.Errorf("ref=%d count=%d: slot %d starts at %d, previous ended at %d",
					c.RefMs, c.Count, i, s[1], got[i-1][2])
			}
		}
		if len(got) > 0 {
			if want := int64(float64(c.RefMs) + c.DurationMs); got[len(got)-1][2] != want {
				t.Errorf("ref=%d count=%d: last slot ends at %d, want %d",
					c.RefMs, c.Count, got[len(got)-1][2], want)
			}
			if got[0][1] != c.RefMs {
				t.Errorf("ref=%d: first slot starts at %d", c.RefMs, got[0][1])
			}
		}
	}
	t.Logf("%d slot sets bit-identical, all abutting exactly", len(g.Slots))
}

func TestConstantsMatchTypeScript(t *testing.T) {
	g := loadUtilsGolden(t)
	for _, c := range []struct {
		name      string
		got, want float64
	}{
		{"TITHI_SPAN", TithiSpan, g.Constants.TithiSpan},
		{"NAKSHATRA_SPAN", NakshatraSpan, g.Constants.NakshatraSpan},
		{"NAKSHATRA_PADA_SPAN", NakshatraPadaSpan, g.Constants.NakshatraPadaSpan},
		{"YOGA_SPAN", YogaSpan, g.Constants.YogaSpan},
		{"KARANA_SPAN", KaranaSpan, g.Constants.KaranaSpan},
		{"RASHI_SPAN", RashiSpan, g.Constants.RashiSpan},
	} {
		if math.Float64bits(c.got) != math.Float64bits(c.want) {
			t.Errorf("%s = %v (%#x), TS %v (%#x)", c.name, c.got, math.Float64bits(c.got),
				c.want, math.Float64bits(c.want))
		}
	}
	if NakshatraSpan == 13 {
		t.Error("NakshatraSpan is exactly 13; `360 / 27` has become integer division")
	}
	if math.Abs(NakshatraSpan-13.333333333333334) > 1e-15 {
		t.Errorf("NakshatraSpan = %v", NakshatraSpan)
	}
	if NakshatraSpan*27 != 360 {
		t.Errorf("27 nakshatras span %v degrees, not 360", NakshatraSpan*27)
	}

	for _, c := range g.NakshatraOf {
		if got := NakshatraOf(c[0]); got != int(c[1]) {
			t.Errorf("NakshatraOf(%v) = %d, TS %v", c[0], got, c[1])
		}
	}
	for _, c := range g.RashiOf {
		if got := RashiOf(c[0]); got != int(c[1]) {
			t.Errorf("RashiOf(%v) = %d, TS %v", c[0], got, c[1])
		}
	}

	for v := 0; v < 7; v++ {
		if VaraChaldeanStart[v] != g.VaraChaldeanStart[v] {
			t.Errorf("VaraChaldeanStart[%d] = %d, TS %d", v, VaraChaldeanStart[v], g.VaraChaldeanStart[v])
		}
		if RahuKalamSlots[v] != g.RahuKalamSlots[v] ||
			YamagandaSlots[v] != g.YamagandaSlots[v] || GulikaSlots[v] != g.GulikaSlots[v] {
			t.Errorf("inauspicious slot tables differ at vara %d", v)
		}
		for n := 0; n < 27; n++ {
			if AnandadiTable[v][n] != g.AnandadiTable[v][n] {
				t.Errorf("AnandadiTable[%d][%d] = %d, TS %d", v, n, AnandadiTable[v][n], g.AnandadiTable[v][n])
			}
		}
	}
	for i, q := range g.AnandadiQuality {
		if string(AnandadiQuality[i]) != q {
			t.Errorf("AnandadiQuality[%d] = %s, TS %s", i, AnandadiQuality[i], q)
		}
	}
	for i, v := range g.VarjyamOffsets {
		if VarjyamOffsetGhatikas[i] != v {
			t.Errorf("VarjyamOffsetGhatikas[%d] = %d, TS %d", i, VarjyamOffsetGhatikas[i], v)
		}
	}

	for name, table := range map[string][7]int{
		"VaraChaldeanStart": VaraChaldeanStart, "RahuKalamSlots": RahuKalamSlots,
		"YamagandaSlots": YamagandaSlots, "GulikaSlots": GulikaSlots,
	} {
		seen := map[int]bool{}
		for _, v := range table {
			if seen[v] {
				t.Errorf("%s repeats %d; it should be a permutation", name, v)
			}
			seen[v] = true
		}
	}
	for v := 0; v < 7; v++ {
		seen := map[int]bool{}
		for n := 0; n < 27; n++ {
			y := AnandadiTable[v][n]
			if y < 0 || y >= TotalAnandadiYogas {
				t.Errorf("AnandadiTable[%d][%d] = %d, outside [0, 27]", v, n, y)
			}
			if seen[y] {
				t.Errorf("AnandadiTable[%d] repeats yoga %d", v, y)
			}
			seen[y] = true
		}
		if len(seen) != 27 {
			t.Errorf("AnandadiTable[%d] covers %d distinct yogas, want 27", v, len(seen))
		}
	}
	auspicious := 0
	for _, q := range AnandadiQuality {
		if q == types.QualityAuspicious {
			auspicious++
		}
	}
	if auspicious != 16 {
		t.Errorf("%d auspicious Anandadi yogas, the docblock says 16", auspicious)
	}
	if len(VarjyamSecondOffsetGhatikas) != 1 || VarjyamSecondOffsetGhatikas[18] != 20 {
		t.Errorf("VarjyamSecondOffsetGhatikas = %v, want {18: 20} (Mula only)", VarjyamSecondOffsetGhatikas)
	}
	t.Logf("all spans, tables and index helpers bit-identical; NakshatraSpan = %v", NakshatraSpan)
}

func TestSecantKeepsAStepOntoAFractionalLowerBracket(t *testing.T) {
	// lo = 1000.5 is evaluated at 1000 and the crossing is at 1000.3, so the second secant step
	// rounds to 1000; it used to be rejected as below lo, leaving the caller one bracket late.
	const crossing = 1000.3
	angleAt := func(ms int64) float64 { return 10 + (float64(ms)-crossing)*1e-6 }
	solved, ok := SolveAngleCrossing(1000.5, 64_000.5, 10, angleAt,
		func(ms int64) bool { return float64(ms) < crossing })
	if !ok || float64(solved) <= crossing || float64(solved)-crossing >= 30 {
		t.Errorf("solved %d ok=%v, want just past %v", solved, ok, crossing)
	}
}

// formatInZoneBuilder is FormatInZone as written before it moved to a stack
// buffer, kept to pin that every instant and offset is spelled the same way.
func formatInZoneBuilder(ms int64, offsetMinutes int) string {
	shifted := time.UnixMilli(ms + int64(offsetMinutes)*60_000).UTC()
	abs := uint64(offsetMinutes)
	if offsetMinutes < 0 {
		abs = -abs
	}
	year := shifted.Year()

	var b strings.Builder
	b.Grow(29)
	if year < 1000 {
		s := strconv.Itoa(year)
		for i := len(s); i < 4; i++ {
			b.WriteByte('0')
		}
		b.WriteString(s)
	} else {
		b.WriteString(strconv.Itoa(year))
	}
	b.WriteByte('-')
	b.WriteString(twoDigits[int(shifted.Month())])
	b.WriteByte('-')
	b.WriteString(twoDigits[shifted.Day()])
	b.WriteByte('T')
	b.WriteString(twoDigits[shifted.Hour()])
	b.WriteByte(':')
	b.WriteString(twoDigits[shifted.Minute()])
	b.WriteByte(':')
	b.WriteString(twoDigits[shifted.Second()])
	b.WriteByte('.')
	b.WriteString(threeDigits[shifted.Nanosecond()/1_000_000])
	if offsetMinutes < 0 {
		b.WriteByte('-')
	} else {
		b.WriteByte('+')
	}
	if hours := abs / 60; hours < uint64(len(twoDigits)) {
		b.WriteString(twoDigits[hours])
	} else {
		b.WriteString(strconv.FormatUint(hours, 10))
	}
	b.WriteByte(':')
	b.WriteString(twoDigits[abs%60])
	return b.String()
}

func TestFormatInZoneMatchesTheBuilderSpelling(t *testing.T) {
	rng := rand.New(rand.NewSource(20260924))
	offsets := []int{0, 330, 345, -300, -210, 840, -720, 1, -1, 59, -59, 60, 525, 3660, -3660,
		1 << 40, -(1 << 40), int(^uint(0) >> 1), -int(^uint(0)>>1) - 1}
	edges := []int64{
		0, -1, 1, 999, -999,
		time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli(),
		time.Date(2100, 12, 31, 23, 59, 59, 999_000_000, time.UTC).UnixMilli(),
		time.Date(999, 12, 31, 23, 59, 59, 0, time.UTC).UnixMilli(),
		time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli(),
		time.Date(-5, 6, 1, 0, 0, 0, 0, time.UTC).UnixMilli(),
		time.Date(12345, 6, 1, 0, 0, 0, 0, time.UTC).UnixMilli(),
		8_640_000_000_000_000, -8_640_000_000_000_000,
	}
	check := func(ms int64, off int) {
		t.Helper()
		if got, want := FormatInZone(ms, off), formatInZoneBuilder(ms, off); got != want {
			t.Fatalf("FormatInZone(%d, %d) = %q, want %q", ms, off, got, want)
		}
	}
	for _, ms := range edges {
		for _, off := range offsets {
			check(ms, off)
		}
	}
	lo := time.Date(1890, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	hi := time.Date(2110, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	for i := 0; i < 200_000; i++ {
		ms := rng.Int63n(2*8_640_000_000_000_000) - 8_640_000_000_000_000
		if i%2 == 0 {
			ms = lo + rng.Int63n(hi-lo)
		}
		check(ms, rng.Intn(1561)-720)
	}
}

func TestFormatInZoneAllocatesOnlyItsResult(t *testing.T) {
	ms := time.Date(2025, 1, 14, 7, 9, 44, 172_000_000, time.UTC).UnixMilli()
	var sink string
	if allocs := testing.AllocsPerRun(1000, func() { sink = FormatInZone(ms, 330) }); allocs != 1 {
		t.Errorf("FormatInZone allocates %v times per call, want 1", allocs)
	}
	if sink != "2025-01-14T12:39:44.172+05:30" {
		t.Errorf("FormatInZone = %q", sink)
	}
}

// A kept zone must answer as a fresh load would, in either order of calls,
// and a failed or "Local" lookup must never be kept.
func TestZoneStoreIsOutputNeutralAndBounded(t *testing.T) {
	winter := time.Date(2025, 1, 15, 12, 0, 0, 0, time.UTC).UnixMilli()
	summer := time.Date(2025, 7, 15, 12, 0, 0, 0, time.UTC).UnixMilli()
	for _, name := range []string{"America/New_York", "Europe/London", "Asia/Kolkata", "Australia/Lord_Howe", "UTC", ""} {
		loc, err := time.LoadLocation(name)
		if err != nil {
			t.Fatal(err)
		}
		for round := 0; round < 2; round++ {
			for _, ms := range []int64{summer, winter, summer} {
				got, err := ResolveUtcOffset(types.TimezoneName(name), ms)
				if err != nil {
					t.Fatal(err)
				}
				_, want := time.UnixMilli(ms).In(loc).Zone()
				if got != want/60 {
					t.Fatalf("%q round %d at %d: offset %d, a fresh load gives %d", name, round, ms, got, want/60)
				}
			}
		}
	}

	for i := 0; i < 2; i++ {
		_, err := ResolveUtcOffset(types.TimezoneName("Not/AZone"), winter)
		var pe *types.PanchangError
		if !errors.As(err, &pe) || pe.Code != types.ErrTimezoneResolutionFailed {
			t.Fatalf("call %d: err = %v, want ErrTimezoneResolutionFailed", i, err)
		}
	}
	if _, ok := zoneStore.Get("Not/AZone"); ok {
		t.Error("a failed zone lookup was kept")
	}
	if _, err := ResolveUtcOffset(types.TimezoneName("Local"), winter); err != nil {
		t.Fatal(err)
	}
	if _, ok := zoneStore.Get("Local"); ok {
		t.Error(`"Local" was kept, so a later change to time.Local would be missed`)
	}

	// Read from a zoneinfo directory, each of these is another spelling of
	// one file that loads; from the embedded zip they fail and are not kept.
	loaded := 0
	for i := 0; i < 3000; i++ {
		name := "America/" + strings.Repeat("./", i%97) + strings.Repeat("/", i/97) + "New_York"
		if _, err := ResolveUtcOffset(types.TimezoneName(name), winter); err == nil {
			loaded++
		}
	}
	if n, limit := zoneStore.Len(), zoneStore.Cap(); n > limit {
		t.Errorf("zone store holds %d entries after %d distinct loads, capacity %d", n, loaded, limit)
	}
}
