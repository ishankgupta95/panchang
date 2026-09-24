package astronomy

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type riseSetGolden struct {
	Meta      map[string]any `json:"_meta"`
	Locations []struct {
		Name      string  `json:"name"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		Elevation float64 `json:"elevation"`
	} `json:"locations"`
	Epochs       []int64 `json:"epochs"`
	DaysPerEpoch int     `json:"daysPerEpoch"`
	DayCases     []struct {
		Body      string    `json:"body"`
		Direction int       `json:"direction"`
		Location  string    `json:"location"`
		Latitude  float64   `json:"latitude"`
		Longitude float64   `json:"longitude"`
		Elevation float64   `json:"elevation"`
		DayIndex  int64     `json:"dayIndex"`
		Events    []float64 `json:"events"`
	} `json:"dayCases"`
	CanonicalCases []struct {
		Body      string    `json:"body"`
		Direction int       `json:"direction"`
		Location  string    `json:"location"`
		DayIndex  int64     `json:"dayIndex"`
		Events    []float64 `json:"events"`
	} `json:"canonicalCases"`
	KeyCases []struct {
		Inputs struct {
			Body      string  `json:"body"`
			Direction int     `json:"direction"`
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
			Elevation float64 `json:"elevation"`
			DayIndex  int64   `json:"dayIndex"`
		} `json:"inputs"`
		ScanKey  string `json:"scanKey"`
		EventKey string `json:"eventKey"`
	} `json:"keyCases"`
	ResolveCases []struct {
		Body      string `json:"body"`
		Direction int    `json:"direction"`
		Location  string `json:"location"`
		FromMs    int64  `json:"fromMs"`
		LimitDays int    `json:"limitDays"`
		Result    *int64 `json:"result"`
	} `json:"resolveCases"`
	WrapperCases []struct {
		Fn        string  `json:"fn"`
		Location  string  `json:"location"`
		FromMs    int64   `json:"fromMs"`
		LimitDays int     `json:"limitDays"`
		Result    *int64  `json:"result"`
		Error     *string `json:"error"`
	} `json:"wrapperCases"`
}

func loadRiseSetGolden(t *testing.T) riseSetGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "astronomy", "riseset-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v (regenerate with `bash go/parity/goldens.sh`)", err)
	}
	var g riseSetGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

func (g riseSetGolden) locationByName(t *testing.T, name string) types.GeoLocation {
	t.Helper()
	for _, l := range g.Locations {
		if l.Name == name {
			return types.GeoLocation{Latitude: l.Latitude, Longitude: l.Longitude, Elevation: l.Elevation}
		}
	}
	t.Fatalf("golden names location %q, which is not in its own location list", name)
	return types.GeoLocation{}
}

func riseSetBodyOf(t *testing.T, s string) RiseSetBody {
	t.Helper()
	switch s {
	case "sun":
		return RiseSetSun
	case "moon":
		return RiseSetMoon
	}
	t.Fatalf("golden names body %q", s)
	return ""
}

func TestDayEventsMatchTypeScriptExactly(t *testing.T) {
	g := loadRiseSetGolden(t)
	if len(g.DayCases) == 0 {
		t.Fatal("golden carries no day cases")
	}
	ClearRiseSetTracks()
	ctx := NewEphemerisCtx()

	nonEmpty, totalEvents, mismatches := 0, 0, 0
	for _, c := range g.DayCases {
		loc := types.GeoLocation{Latitude: c.Latitude, Longitude: c.Longitude, Elevation: c.Elevation}
		got := DayEvents(ctx, riseSetBodyOf(t, c.Body), c.Direction, loc, c.DayIndex)
		if len(got) > 0 {
			nonEmpty++
		}
		totalEvents += len(got)
		if len(got) != len(c.Events) {
			mismatches++
			if mismatches <= 5 {
				t.Errorf("%s %s dir=%d day=%d: Go found %d events, TS found %d",
					c.Location, c.Body, c.Direction, c.DayIndex, len(got), len(c.Events))
			}
			continue
		}
		for i := range got {
			if math.Float64bits(got[i]) != math.Float64bits(c.Events[i]) {
				mismatches++
				if mismatches <= 5 {
					t.Errorf("%s %s dir=%d day=%d event %d: Go %.6f, TS %.6f (|Δ| %.6f ms)",
						c.Location, c.Body, c.Direction, c.DayIndex, i,
						got[i], c.Events[i], math.Abs(got[i]-c.Events[i]))
				}
			}
		}
	}
	if mismatches > 0 {
		t.Errorf("%d of %d day cases differ from the TypeScript", mismatches, len(g.DayCases))
	}
	if nonEmpty < len(g.DayCases)/3 {
		t.Errorf("only %d of %d day cases produced any event; the sweep is not "+
			"exercising the solver", nonEmpty, len(g.DayCases))
	}
	t.Logf("%d day cases, %d with events, %d events total, all bit-identical",
		len(g.DayCases), nonEmpty, totalEvents)
}

func TestCanonicalDayEventsMatchTypeScript(t *testing.T) {
	g := loadRiseSetGolden(t)
	ClearRiseSetTracks()
	ctx := NewEphemerisCtx()
	for _, c := range g.CanonicalCases {
		loc := g.locationByName(t, c.Location)
		kind := RiseSetKind{Body: riseSetBodyOf(t, c.Body)}
		got := CanonicalDayEvents(ctx, kind, c.Direction, loc, c.DayIndex)
		if len(got) != len(c.Events) {
			t.Errorf("%s %s dir=%d: Go %d events, TS %d", c.Location, c.Body, c.Direction, len(got), len(c.Events))
			continue
		}
		for i := range got {
			if math.Float64bits(got[i]) != math.Float64bits(c.Events[i]) {
				t.Errorf("%s %s dir=%d event %d: Go %.6f, TS %.6f",
					c.Location, c.Body, c.Direction, i, got[i], c.Events[i])
			}
		}
	}
	t.Logf("%d canonical-day cases bit-identical", len(g.CanonicalCases))
}

func TestRiseSetCacheKeysMatchTypeScript(t *testing.T) {
	g := loadRiseSetGolden(t)
	if len(g.KeyCases) == 0 {
		t.Fatal("golden carries no key cases")
	}
	for _, c := range g.KeyCases {
		loc := types.GeoLocation{
			Latitude: c.Inputs.Latitude, Longitude: c.Inputs.Longitude, Elevation: c.Inputs.Elevation,
		}
		body := riseSetBodyOf(t, c.Inputs.Body)
		// Go keys the caches with riseSetKey structs; these are the strings
		// whose equality those structs reproduce (TestRiseSetKeyEqualityIsTheStringKeys).
		if got := riseSetScanKeyString(body, loc, c.Inputs.DayIndex); got != c.ScanKey {
			t.Errorf("scan key:\n  Go %q\n  TS %q", got, c.ScanKey)
		}
		if got := riseSetEventKeyString(body, c.Inputs.Direction, loc, c.Inputs.DayIndex); got != c.EventKey {
			t.Errorf("event key:\n  Go %q\n  TS %q", got, c.EventKey)
		}
	}
	t.Logf("%d key cases match character for character", len(g.KeyCases))
}

func TestResolveEventMatchesTypeScript(t *testing.T) {
	g := loadRiseSetGolden(t)
	ClearRiseSetTracks()
	ctx := NewEphemerisCtx()
	nulls, found := 0, 0
	for _, c := range g.ResolveCases {
		loc := g.locationByName(t, c.Location)
		kind := RiseSetKind{Body: riseSetBodyOf(t, c.Body)}
		got, ok, err := ResolveEvent(ctx, kind, c.Direction, c.FromMs, loc, c.LimitDays)
		if err != nil {
			t.Fatal(err)
		}
		if c.Result == nil {
			nulls++
			if ok {
				t.Errorf("%s %s dir=%d from=%d limit=%d: Go found %d, TS found null",
					c.Location, c.Body, c.Direction, c.FromMs, c.LimitDays, got)
			}
			continue
		}
		found++
		if !ok {
			t.Errorf("%s %s dir=%d from=%d limit=%d: Go found nothing, TS found %d",
				c.Location, c.Body, c.Direction, c.FromMs, c.LimitDays, *c.Result)
			continue
		}
		if got != *c.Result {
			t.Errorf("%s %s dir=%d from=%d limit=%d: Go %d, TS %d (Δ %d ms)",
				c.Location, c.Body, c.Direction, c.FromMs, c.LimitDays, got, *c.Result, got-*c.Result)
		}
	}
	if nulls == 0 || found == 0 {
		t.Fatalf("resolve cases covered only one outcome: %d null, %d found", nulls, found)
	}
	t.Logf("%d resolve cases: %d found, %d null, all matching", len(g.ResolveCases), found, nulls)
}

func TestRiseSetWrappersMatchTypeScript(t *testing.T) {
	g := loadRiseSetGolden(t)
	ClearRiseSetTracks()
	ctx := NewEphemerisCtx()
	errs, nulls, found := 0, 0, 0
	for _, c := range g.WrapperCases {
		loc := g.locationByName(t, c.Location)
		var gotMs int64
		var gotOK bool
		var gotErr error
		switch c.Fn {
		case "computeSunrise":
			gotMs, gotErr = ComputeSunrise(ctx, c.FromMs, loc, c.LimitDays)
			gotOK = gotErr == nil
		case "computeSunset":
			gotMs, gotErr = ComputeSunset(ctx, c.FromMs, loc, c.LimitDays)
			gotOK = gotErr == nil
		case "getMoonrise":
			gotMs, gotOK, gotErr = GetMoonrise(ctx, c.FromMs, loc, c.LimitDays)
		case "getMoonset":
			gotMs, gotOK, gotErr = GetMoonset(ctx, c.FromMs, loc, c.LimitDays)
		default:
			t.Fatalf("golden names function %q", c.Fn)
		}

		if c.Error != nil {
			errs++
			if gotErr == nil {
				t.Errorf("%s %s from=%d: Go returned %d, TS threw %s", c.Fn, c.Location, c.FromMs, gotMs, *c.Error)
				continue
			}
			var pe *types.PanchangError
			if !errors.As(gotErr, &pe) || string(pe.Code) != *c.Error {
				t.Errorf("%s %s from=%d: Go error %v, TS threw %s", c.Fn, c.Location, c.FromMs, gotErr, *c.Error)
			}
			continue
		}
		if gotErr != nil {
			t.Errorf("%s %s from=%d: Go errored %v, TS returned a value", c.Fn, c.Location, c.FromMs, gotErr)
			continue
		}
		if c.Result == nil {
			nulls++
			if gotOK {
				t.Errorf("%s %s from=%d: Go found %d, TS returned null", c.Fn, c.Location, c.FromMs, gotMs)
			}
			continue
		}
		found++
		if !gotOK {
			t.Errorf("%s %s from=%d: Go found nothing, TS returned %d", c.Fn, c.Location, c.FromMs, *c.Result)
			continue
		}
		if gotMs != *c.Result {
			t.Errorf("%s %s from=%d: Go %d, TS %d (Δ %d ms)", c.Fn, c.Location, c.FromMs, gotMs, *c.Result, gotMs-*c.Result)
		}
	}
	if errs == 0 || nulls == 0 || found == 0 {
		t.Fatalf("wrapper cases did not cover all three outcomes: %d errors, %d nulls, %d found", errs, nulls, found)
	}
	t.Logf("%d wrapper cases: %d found, %d null, %d sentinel errors, all matching",
		len(g.WrapperCases), found, nulls, errs)
}

func TestTrackAbscissae(t *testing.T) {
	v8 := []float64{
		1, 0.9510565162951535, 0.8090169943749475, 0.5877852522924731,
		0.30901699437494745, 6.123233995736766e-17, -0.30901699437494734,
		-0.587785252292473, -0.8090169943749473, -0.9510565162951535, -1,
	}
	tr := newPositionTrack(NewEphemerisCtx(), RiseSetSun, 0)
	if len(v8) != trackNodes {
		t.Fatalf("%d pinned values for %d nodes", len(v8), trackNodes)
	}
	diffs := 0
	for k := 0; k < trackNodes; k++ {
		if math.Float64bits(tr.nodeX[k]) != math.Float64bits(v8[k]) {
			diffs++
			t.Logf("k=%d: Go %v, V8 %v (|Δ| %.3e)", k, tr.nodeX[k], v8[k], math.Abs(tr.nodeX[k]-v8[k]))
		}
	}
	t.Logf("%d of %d eleven-node abscissae differ from V8, and every published "+
		"instant is still bit-identical", diffs, trackNodes)
	if tr.nodeX[0] != 1 || tr.nodeX[trackNodes-1] != -1 {
		t.Errorf("endpoints are %v and %v, want exactly 1 and -1", tr.nodeX[0], tr.nodeX[trackNodes-1])
	}
	if mid := tr.nodeX[trackNodes/2]; mid == 0 || math.Abs(mid) > 1e-16 {
		t.Errorf("middle abscissa is %v, want cos(π/2) ≈ 6.1e-17 and non-zero", mid)
	}
	for k := 1; k < trackNodes; k++ {
		if !(tr.nodeX[k] < tr.nodeX[k-1]) {
			t.Errorf("abscissae not strictly decreasing at k=%d", k)
		}
	}
	for k := 0; k < trackNodes; k++ {
		want := 1.0
		if k == 0 || k == trackNodes-1 {
			want = 0.5
		}
		if k%2 != 0 {
			want = -want
		}
		if tr.weight[k] != want {
			t.Errorf("weight[%d] = %v, want %v", k, tr.weight[k], want)
		}
	}
}
