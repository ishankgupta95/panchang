package jyotish

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

type sadeSatiGolden struct {
	MsLo                int64   `json:"msLo"`
	MsHi                int64   `json:"msHi"`
	Samples             int     `json:"samples"`
	StabilityDays       int     `json:"stabilityDays"`
	CoarseStepDays      int     `json:"coarseStepDays"`
	MaxForwardScanDays  int     `json:"maxForwardScanDays"`
	MaxBackwardScanDays int     `json:"maxBackwardScanDays"`
	Instants            []int64 `json:"instants"`
	SaturnRashis        []struct {
		Ms                int64   `json:"ms"`
		SiderealLongitude float64 `json:"siderealLongitude"`
		Rashi             int     `json:"rashi"`
	} `json:"saturnRashis"`
	Sweep []struct {
		Ms     int64              `json:"ms"`
		Rashi  int                `json:"rashi"`
		Result types.SadeSatiInfo `json:"result"`
	} `json:"sweep"`
	WalkRashi    int   `json:"walkRashi"`
	WalkAnchorMs int64 `json:"walkAnchorMs"`
	Walk         []struct {
		Ms     int64              `json:"ms"`
		Result types.SadeSatiInfo `json:"result"`
	} `json:"walk"`
	AyanamsaAt int64 `json:"ayanamsaAt"`
	ByAyanamsa []struct {
		Ayanamsa types.AyanamsaType `json:"ayanamsa"`
		Result   types.SadeSatiInfo `json:"result"`
	} `json:"byAyanamsa"`
	DefaultAyanamsa types.SadeSatiInfo `json:"defaultAyanamsa"`
}

func loadSadeSatiGolden(t *testing.T) sadeSatiGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "sadesati-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g sadeSatiGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Sweep) == 0 || len(g.Walk) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func compareSadeSati(t *testing.T, where string, got, want types.SadeSatiInfo) {
	t.Helper()
	if got.Active != want.Active {
		t.Errorf("%s: active %v, TypeScript %v", where, got.Active, want.Active)
	}
	cmpIntPtr(t, where+".phase", got.Phase, want.Phase)
	cmpDatePtr(t, where+".currentArcStart", got.CurrentArcStart, want.CurrentArcStart)
	cmpDatePtr(t, where+".currentArcEnd", got.CurrentArcEnd, want.CurrentArcEnd)
	cmpDatePtr(t, where+".nextArcStart", got.NextArcStart, want.NextArcStart)
}

func cmpIntPtr(t *testing.T, where string, got, want *int) {
	t.Helper()
	if (got == nil) != (want == nil) {
		t.Errorf("%s: Go %s, TypeScript %s", where, nilOrInt(got), nilOrInt(want))
		return
	}
	if got != nil && *got != *want {
		t.Errorf("%s: %d, TypeScript %d", where, *got, *want)
	}
}

func cmpDatePtr(t *testing.T, where string, got, want *types.JSDate) {
	t.Helper()
	if (got == nil) != (want == nil) {
		t.Errorf("%s: Go %s, TypeScript %s", where, nilOrDate(got), nilOrDate(want))
		return
	}
	if got != nil && got.Ms() != want.Ms() {
		t.Errorf("%s: %s (%d), TypeScript %s (%d), delta %d ms",
			where, got.ISOString(), got.Ms(), want.ISOString(), want.Ms(),
			got.Ms()-want.Ms())
	}
}

func nilOrInt(p *int) string {
	if p == nil {
		return "null"
	}
	return itoa(*p)
}

func nilOrDate(p *types.JSDate) string {
	if p == nil {
		return "null"
	}
	return p.ISOString()
}

func TestSadeSatiConstantsMatchTypeScript(t *testing.T) {
	g := loadSadeSatiGolden(t)
	for _, c := range []struct {
		name      string
		got, want int
	}{
		{"STABILITY_DAYS", sadeSatiStabilityDays, g.StabilityDays},
		{"COARSE_STEP", sadeSatiCoarseStep, g.CoarseStepDays},
		{"MAX_FORWARD_SCAN_DAYS", sadeSatiMaxForwardScanDays, g.MaxForwardScanDays},
		{"MAX_BACKWARD_SCAN_DAYS", sadeSatiMaxBackwardScanDays, g.MaxBackwardScanDays},
	} {
		if c.got != c.want {
			t.Errorf("%s = %d, TypeScript %d", c.name, c.got, c.want)
		}
	}
}

func TestSadeSatiIterationBoundsAreNotIntegral(t *testing.T) {
	for _, c := range []struct {
		name string
		days int
	}{
		{"MAX_FORWARD_SCAN_DAYS", sadeSatiMaxForwardScanDays},
		{"MAX_BACKWARD_SCAN_DAYS", sadeSatiMaxBackwardScanDays},
	} {
		exact := float64(c.days) / float64(sadeSatiCoarseStep)
		intDiv := c.days / sadeSatiCoarseStep
		if exact == math.Trunc(exact) {
			t.Errorf("%s / COARSE_STEP = %v divides evenly; the float-vs-int "+
				"distinction in findArcBoundary is now vacuous and its comment is "+
				"misleading", c.name, exact)
			continue
		}
		jsIters := int(math.Ceil(exact))
		if jsIters != intDiv+1 {
			t.Errorf("%s: JavaScript runs %d iterations, Go int division gives %d",
				c.name, jsIters, intDiv)
		}
		t.Logf("%s: %d/%d = %v: JavaScript %d iterations, a naive Go int port %d",
			c.name, c.days, sadeSatiCoarseStep, exact, jsIters, intDiv)
	}
}

func TestSadeSatiMatchesTypeScript(t *testing.T) {
	g := loadSadeSatiGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	phases := map[int]int{}
	activeN, inactiveN, nextNil := 0, 0, 0

	for _, c := range g.Sweep {
		got, err := ComputeSadeSati(ctx, c.Rashi, c.Ms, "lahiri")
		if err != nil {
			t.Fatalf("rashi=%d ms=%d: %v", c.Rashi, c.Ms, err)
		}
		compareSadeSati(t, "sweep/r"+itoa(c.Rashi)+"@"+itoa(int(c.Ms%1000000)), got, c.Result)
		if got.Active {
			activeN++
			if got.Phase != nil {
				phases[*got.Phase]++
			}
		} else {
			inactiveN++
			if got.NextArcStart == nil {
				nextNil++
			}
		}
	}

	if len(phases) != 3 {
		t.Errorf("only %d distinct phases across %d cases: %v", len(phases), len(g.Sweep), phases)
	}
	if activeN == 0 || inactiveN == 0 {
		t.Errorf("only one arm reached: %d active, %d inactive", activeN, inactiveN)
	}
	if nextNil != 0 {
		t.Errorf("%d of %d inactive cases published a null nextArcStart; the "+
			"30-year lookahead is meant to cover Saturn's whole 29.5-year cycle",
			nextNil, inactiveN)
	}
	if r := float64(activeN) / float64(len(g.Sweep)); r < 0.2 || r > 0.3 {
		t.Errorf("%.1f%% of cases active; three rashis in twelve is 25%%, so the "+
			"sweep is not spread across Saturn's cycle", r*100)
	}
	t.Logf("%d cases: %d active (phases %v), %d inactive", len(g.Sweep), activeN, phases, inactiveN)
}

func TestSadeSatiArcBoundaryWalk(t *testing.T) {
	g := loadSadeSatiGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	flips := 0
	var prev *bool

	for i, c := range g.Walk {
		got, err := ComputeSadeSati(ctx, g.WalkRashi, c.Ms, "lahiri")
		if err != nil {
			t.Fatalf("walk[%d] ms=%d: %v", i, c.Ms, err)
		}
		compareSadeSati(t, "walk["+itoa(i)+"]", got, c.Result)
		if prev != nil && *prev != got.Active {
			flips++
		}
		a := got.Active
		prev = &a
	}
	if flips != 1 {
		t.Errorf("`active` flipped %d times across the %d-day walk around the "+
			"published arc end; expected exactly 1", flips, len(g.Walk))
	}
	t.Logf("%d-day walk around %s: %d transition",
		len(g.Walk), types.Date(g.WalkAnchorMs).ISOString(), flips)
}

func TestSadeSatiByAyanamsa(t *testing.T) {
	g := loadSadeSatiGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	seen := map[string]int{}

	for _, c := range g.ByAyanamsa {
		got, err := ComputeSadeSati(ctx, 3, g.AyanamsaAt, c.Ayanamsa)
		if err != nil {
			t.Fatalf("ayanamsa %s: %v", c.Ayanamsa, err)
		}
		compareSadeSati(t, "ayanamsa/"+string(c.Ayanamsa), got, c.Result)
		seen[sadeSatiFingerprint(got)]++
	}
	if len(seen) < 2 {
		t.Errorf("all %d ayanamsas produced the same result; the parameter is not "+
			"reaching the sidereal longitude", len(g.ByAyanamsa))
	}

	got, err := ComputeSadeSati(ctx, 3, g.AyanamsaAt, "")
	if err != nil {
		t.Fatalf("default ayanamsa: %v", err)
	}
	compareSadeSati(t, "ayanamsa/default", got, g.DefaultAyanamsa)
	lahiri, err := ComputeSadeSati(ctx, 3, g.AyanamsaAt, "lahiri")
	if err != nil {
		t.Fatalf("%v", err)
	}
	if sadeSatiFingerprint(got) != sadeSatiFingerprint(lahiri) {
		t.Errorf("the default ayanamsa does not resolve to lahiri: %s vs %s",
			sadeSatiFingerprint(got), sadeSatiFingerprint(lahiri))
	}
	t.Logf("%d ayanamsas produced %d distinct results", len(g.ByAyanamsa), len(seen))
}

func sadeSatiFingerprint(r types.SadeSatiInfo) string {
	s := "a=" + itoa(b2i(r.Active)) + " p=" + nilOrInt(r.Phase)
	return s + " s=" + nilOrDate(r.CurrentArcStart) +
		" e=" + nilOrDate(r.CurrentArcEnd) + " n=" + nilOrDate(r.NextArcStart)
}

func TestSadeSatiSaturnRashiMatchesTypeScript(t *testing.T) {
	g := loadSadeSatiGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	var worst float64
	for _, c := range g.SaturnRashis {
		lon, err := saturnSiderealLongitude(ctx, c.Ms, "lahiri")
		if err != nil {
			t.Fatalf("ms=%d: %v", c.Ms, err)
		}
		if d := math.Abs(lon - c.SiderealLongitude); d > worst {
			worst = d
		}
		r, err := saturnRashi(ctx, c.Ms, "lahiri")
		if err != nil {
			t.Fatalf("ms=%d: %v", c.Ms, err)
		}
		if r != c.Rashi {
			t.Errorf("ms=%d: Saturn rashi %d, TypeScript %d (longitudes %.17g vs %.17g)",
				c.Ms, r, c.Rashi, lon, c.SiderealLongitude)
		}
	}
	if worst > 1e-9 {
		t.Errorf("Saturn sidereal longitude differs by up to %g deg, bound 1e-9", worst)
	}
	t.Logf("Saturn sidereal longitude: worst |delta| = %g deg over %d instants",
		worst, len(g.SaturnRashis))
}

func TestSadeSatiRashiBoundaryMargin(t *testing.T) {
	g := loadSadeSatiGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	worst := math.Inf(1)
	var worstMs int64
	for ms := g.MsLo; ms < g.MsHi; ms += int64(sadeSatiCoarseStep) * sadeSatiDayMs {
		lon, err := saturnSiderealLongitude(ctx, ms, "lahiri")
		if err != nil {
			t.Fatalf("ms=%d: %v", ms, err)
		}
		frac := lon/30 - math.Floor(lon/30)
		d := math.Min(frac, 1-frac) * 30
		if d < worst {
			worst, worstMs = d, ms
		}
	}
	if worst < 1e-6 {
		t.Errorf("a sampled Saturn longitude came within %g deg of a rashi "+
			"boundary at %s. The ephemeris agrees to ~1e-9 deg, so that is still "+
			"three orders of margin, but the claim of exactness now rests on it",
			worst, types.Date(worstMs).ISOString())
	}
	t.Logf("closest approach to a rashi boundary across %d-year span: %g deg at %s "+
		"(ephemeris agreement is ~1e-9 deg)",
		(g.MsHi-g.MsLo)/(365*sadeSatiDayMs), worst, types.Date(worstMs).ISOString())
}

func TestSadeSatiRejectsRashiOutOfRange(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	for _, bad := range []int{-1, 12, 99} {
		_, err := ComputeSadeSati(ctx, bad, 0, "lahiri")
		if err == nil {
			t.Errorf("natalMoonRashi %d was accepted", bad)
			continue
		}
		want := "natalMoonRashi must be integer in [0, 11], got " + itoa(bad)
		if err.Error() != want {
			t.Errorf("message %q, expected %q", err.Error(), want)
		}
	}
	for _, ok := range []int{0, 11} {
		if _, err := ComputeSadeSati(ctx, ok, 0, "lahiri"); err != nil {
			t.Errorf("natalMoonRashi %d was rejected: %v", ok, err)
		}
	}
}

func findNextEntryIntEndpoints(
	ctx *astronomy.EphemerisCtx,
	startMs int64,
	targetRashi int,
	ayanamsa types.AyanamsaType,
) (*types.JSDate, error) {
	stepMs := int64(sadeSatiCoarseStep) * sadeSatiDayMs
	ms := startMs
	prevRashi, err := saturnRashi(ctx, ms, ayanamsa)
	if err != nil {
		return nil, err
	}
	maxIters := float64(sadeSatiMaxForwardScanDays) / float64(sadeSatiCoarseStep)
	for i := 0; float64(i) < maxIters; i++ {
		next := ms + stepMs
		r, err := saturnRashi(ctx, next, ayanamsa)
		if err != nil {
			return nil, err
		}
		if r == targetRashi && prevRashi != targetRashi {
			lo, hi := ms, next
			for hi-lo > sadeSatiDayMs {
				mid := lo + (hi-lo)/2
				rm, err := saturnRashi(ctx, mid, ayanamsa)
				if err != nil {
					return nil, err
				}
				if rm == targetRashi {
					hi = mid
				} else {
					lo = mid
				}
			}
			return jsDatePtr(hi), nil
		}
		ms = next
		prevRashi = r
	}
	return nil, nil
}

func TestSadeSatiBisectionNeedsFloatEndpoints(t *testing.T) {
	g := loadSadeSatiGolden(t)
	ctx := astronomy.NewEphemerisCtx()

	width := int64(sadeSatiCoarseStep) * sadeSatiDayMs
	twos := 0
	for w := width; w%2 == 0; w /= 2 {
		twos++
	}
	halvings := 0
	for w := width; w > sadeSatiDayMs; w /= 2 {
		halvings++
	}
	if halvings > twos {
		t.Errorf("the bisection performs %d halvings but the starting interval "+
			"%d ms has only %d factors of two; `mid` can be fractional and the "+
			"float endpoints become load-bearing", halvings, width, twos)
	}
	t.Logf("interval %d ms = 2^%d x %d; the loop halves %d times, so every `mid` "+
		"is an exact integer", width, twos, width>>twos, halvings)

	const bisectionCases = 40
	differ, checked, skipped := 0, 0, 0
	var worst int64

	for _, c := range g.Sweep {
		if c.Result.Active {
			continue // nextArcStart is null on the active arm
		}
		if checked >= bisectionCases {
			skipped++
			continue
		}
		target := (c.Rashi + 11) % 12
		f, err := findNextEntry(ctx, c.Ms, target, "lahiri")
		if err != nil {
			t.Fatalf("rashi=%d ms=%d: %v", c.Rashi, c.Ms, err)
		}
		i64, err := findNextEntryIntEndpoints(ctx, c.Ms, target, "lahiri")
		if err != nil {
			t.Fatalf("rashi=%d ms=%d: %v", c.Rashi, c.Ms, err)
		}
		checked++
		if (f == nil) != (i64 == nil) {
			t.Errorf("rashi=%d ms=%d: one version found a boundary and the other did not",
				c.Rashi, c.Ms)
			continue
		}
		if f == nil {
			continue
		}
		if d := abs64(f.Ms() - i64.Ms()); d != 0 {
			differ++
			if d > worst {
				worst = d
			}
		}
	}

	if differ != 0 {
		t.Errorf("float and int64 bisection endpoints differ on %d of %d inactive "+
			"cases, worst %d ms, which contradicts the valuation argument above; "+
			"recheck it before changing either version", differ, checked, worst)
		return
	}
	t.Logf("float and int64 bisection endpoints agree on all %d inactive cases "+
		"checked, as the valuation predicts (%d further inactive cases skipped by "+
		"the %d-case cap)", checked, skipped, bisectionCases)
}
