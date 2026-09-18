package jyotish

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const kpLonBound = 1e-9

type kpGolden struct {
	SweepStep           float64   `json:"sweepStep"`
	SweepPoints         int       `json:"sweepPoints"`
	BoundaryEps         float64   `json:"boundaryEps"`
	SubCumulativeWidths []float64 `json:"subCumulativeWidths"`
	Digests             struct {
		Rashi     string `json:"rashi"`
		Nakshatra string `json:"nakshatra"`
		SignLord  string `json:"signLord"`
		StarLord  string `json:"starLord"`
		SubLord   string `json:"subLord"`
	} `json:"digests"`
	Explicit []struct {
		Lon       float64            `json:"lon"`
		Rashi     int                `json:"rashi"`
		Nakshatra int                `json:"nakshatra"`
		SignLord  types.VisibleGraha `json:"signLord"`
		StarLord  types.DashaLord    `json:"starLord"`
		SubLord   types.DashaLord    `json:"subLord"`
	} `json:"explicit"`
	Boundaries []struct {
		Lon  float64 `json:"lon"`
		Side string  `json:"side"`
		Sub  int     `json:"sub"`
		Star int     `json:"star"`
	} `json:"boundaries"`
	KpCharts []struct {
		Name          string           `json:"name"`
		Ms            int64            `json:"ms"`
		Loc           string           `json:"loc"`
		Ok            bool             `json:"ok"`
		Code          *string          `json:"code"`
		Cuspal        KpCuspalSubLords `json:"cuspal"`
		Significators KpSignificators  `json:"significators"`
	} `json:"kpCharts"`
	KpOptionArms struct {
		Bare               KpCuspalSubLords `json:"bare"`
		WholeSignRequested KpCuspalSubLords `json:"wholeSignRequested"`
		LahiriRequested    KpCuspalSubLords `json:"lahiriRequested"`
	} `json:"kpOptionArms"`
	TpBirths  []int64 `json:"tpBirths"`
	TpAges    []int   `json:"tpAges"`
	Locations []struct {
		Name      string  `json:"name"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"locations"`
	TpSweep []struct {
		Ms    int64              `json:"ms"`
		Age   int                `json:"age"`
		Loc   string             `json:"loc"`
		Chart TithiPraveshaChart `json:"chart"`
	} `json:"tpSweep"`
	TithiIndex []struct {
		Sun  float64 `json:"sun"`
		Moon float64 `json:"moon"`
		Idx  int     `json:"idx"`
	} `json:"tithiIndex"`
	BadTpAges []struct {
		Age   int     `json:"age"`
		Threw bool    `json:"threw"`
		Code  *string `json:"code"`
	} `json:"badTpAges"`
	Prashna struct {
		At  int64 `json:"at"`
		Loc struct {
			Name      string  `json:"name"`
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"loc"`
		Bare       types.BirthChart `json:"bare"`
		WholeSign  types.BirthChart `json:"wholeSign"`
		Lahiri     types.BirthChart `json:"lahiri"`
		Equivalent types.BirthChart `json:"equivalent"`
	} `json:"prashna"`
}

func loadKpGolden(t *testing.T) kpGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "kp-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g kpGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Boundaries) == 0 || len(g.TpSweep) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func kpLoc(g kpGolden, name string) types.GeoLocation {
	for _, l := range g.Locations {
		if l.Name == name {
			return types.GeoLocation{Latitude: l.Latitude, Longitude: l.Longitude}
		}
	}
	switch name {
	case "pune":
		return types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	case "newyork":
		return types.GeoLocation{Latitude: 40.7128, Longitude: -74.006}
	case "delhi":
		return types.GeoLocation{Latitude: 28.6139, Longitude: 77.209}
	case "sydney":
		return types.GeoLocation{Latitude: -33.8688, Longitude: 151.2093}
	case "reykjavik":
		return types.GeoLocation{Latitude: 64.1466, Longitude: -21.9426}
	}
	panic("unknown location " + name)
}

func kpDigest(n int, fn func(int) float64) string {
	h := sha256.New()
	const block = 65536
	buf := make([]byte, block*8)
	k := 0
	for i := 0; i < n; i++ {
		binary.LittleEndian.PutUint64(buf[k*8:], math.Float64bits(fn(i)))
		k++
		if k == block {
			h.Write(buf)
			k = 0
		}
	}
	if k > 0 {
		h.Write(buf[:k*8])
	}
	return hex.EncodeToString(h.Sum(nil))
}

func TestSubWidthsSumToTheNakshatra(t *testing.T) {
	g := loadKpGolden(t)

	if len(g.SubCumulativeWidths) != 9 {
		t.Fatalf("golden has %d cumulative widths", len(g.SubCumulativeWidths))
	}
	for i, want := range g.SubCumulativeWidths {
		if got := SubCumulativeWidthsForTest[i]; got != want {
			t.Errorf("cumulative width %d (%s): %.17g, TypeScript %.17g",
				i, DashaOrder[i], got, want)
		}
	}

	total := SubCumulativeWidthsForTest[8]
	if d := math.Abs(total - utils.NakshatraSpan); d > 1e-12 {
		t.Errorf("the nine sub-widths sum to %.17g, a nakshatra is %.17g (delta %g)",
			total, utils.NakshatraSpan, d)
	}
	if total == utils.NakshatraSpan {
		t.Logf("the sum is exactly NAKSHATRA_SPAN (%.17g); the fallback is unreachable", total)
	} else {
		t.Logf("the sum is %.17g against NAKSHATRA_SPAN %.17g: a %g deg sliver at the "+
			"end of each nakshatra reaches the fallback, which returns the same "+
			"final lord the loop would have",
			total, utils.NakshatraSpan, utils.NakshatraSpan-total)
	}
	const arcminPerNakshatra = 800.0
	docblockSays := map[types.DashaLord]float64{
		types.DashaKetu: 46 + 40.0/60, types.DashaVenus: 133 + 20.0/60,
		types.DashaSun: 40, types.DashaMoon: 66 + 40.0/60,
		types.DashaMars: 46 + 40.0/60, types.DashaRahu: 120,
		types.DashaJupiter: 106 + 40.0/60, types.DashaSaturn: 126 + 40.0/60,
		types.DashaMercury: 113 + 20.0/60,
	}
	docSum := 0.0
	for _, lord := range types.AllDashaLords {
		want := DashaYears[lord] / 120 * arcminPerNakshatra
		if got := subWidth(lord) * 60; math.Abs(got-want) > 1e-9 {
			t.Errorf("%s sub-width %.9f arcmin, `years/120 × 800` gives %.9f",
				lord, got, want)
		}
		if d := math.Abs(docblockSays[lord] - want); d > 1e-6 {
			t.Errorf("%s: the docblock says %.6f arcmin, the arithmetic gives %.6f "+
				"(delta %g). These nine figures were corrected on 2026-08-24",
				lord, docblockSays[lord], want, d)
		}
		docSum += docblockSays[lord]
	}
	if math.Abs(docSum-arcminPerNakshatra) > 1e-6 {
		t.Errorf("the docblock's nine figures sum to %.4f arcmin, not the 800 the "+
			"same sentence claims", docSum)
	}
	t.Logf("the nine documented widths sum to %.4f arcmin = one nakshatra", docSum)
}

func TestKpSubLordDigestsMatchTypeScript(t *testing.T) {
	g := loadKpGolden(t)
	lon := func(i int) float64 { return float64(i) * g.SweepStep }

	for _, c := range []struct {
		name string
		want string
		fn   func(int) float64
	}{
		{"rashi", g.Digests.Rashi, func(i int) float64 { return float64(ComputeKpSubLord(lon(i)).Rashi) }},
		{"nakshatra", g.Digests.Nakshatra, func(i int) float64 { return float64(ComputeKpSubLord(lon(i)).Nakshatra) }},
		{"signLord", g.Digests.SignLord, func(i int) float64 { return float64(ComputeKpSubLord(lon(i)).SignLord) }},
		{"starLord", g.Digests.StarLord, func(i int) float64 { return float64(ComputeKpSubLord(lon(i)).StarLord) }},
		{"subLord", g.Digests.SubLord, func(i int) float64 { return float64(ComputeKpSubLord(lon(i)).SubLord) }},
	} {
		if got := kpDigest(g.SweepPoints, c.fn); got != c.want {
			t.Errorf("%s digest %s, TypeScript %s", c.name, got[:16], c.want[:16])
		}
	}
	t.Logf("%d longitudes at %g deg spacing, five streams, bit-identical",
		g.SweepPoints, g.SweepStep)
}

func TestKpSubLordExplicitSample(t *testing.T) {
	g := loadKpGolden(t)
	for _, c := range g.Explicit {
		got := ComputeKpSubLord(c.Lon)
		if got.Rashi != c.Rashi || got.Nakshatra != c.Nakshatra ||
			got.SignLord != c.SignLord || got.StarLord != c.StarLord || got.SubLord != c.SubLord {
			t.Errorf("%.6f: rashi %d nak %d sign %s star %s sub %s, TypeScript "+
				"rashi %d nak %d sign %s star %s sub %s",
				c.Lon, got.Rashi, got.Nakshatra, got.SignLord, got.StarLord, got.SubLord,
				c.Rashi, c.Nakshatra, c.SignLord, c.StarLord, c.SubLord)
		}
		if got.Longitude != c.Lon {
			t.Errorf("%.6f: longitude round-trip %.17g", c.Lon, got.Longitude)
		}
	}
	t.Logf("%d explicit longitudes", len(g.Explicit))
}

func TestKpSubBoundariesMatchTypeScript(t *testing.T) {
	g := loadKpGolden(t)
	pairs := map[float64][2]int{} // boundary → [below, above] sub index
	differ, same := 0, 0

	for _, c := range g.Boundaries {
		got := ComputeKpSubLord(c.Lon)
		if int(got.SubLord) != c.Sub {
			t.Errorf("%.12f (%s): subLord %s (%d), TypeScript %d",
				c.Lon, c.Side, got.SubLord, int(got.SubLord), c.Sub)
		}
		if int(got.StarLord) != c.Star {
			t.Errorf("%.12f (%s): starLord %s (%d), TypeScript %d",
				c.Lon, c.Side, got.StarLord, int(got.StarLord), c.Star)
		}
		b := c.Lon + g.BoundaryEps
		if c.Side == "above" {
			b = c.Lon - g.BoundaryEps
		}
		e := pairs[b]
		if c.Side == "below" {
			e[0] = int(got.SubLord) + 1 // +1 so 0 means "unset"
		} else {
			e[1] = int(got.SubLord) + 1
		}
		pairs[b] = e
	}

	for b, e := range pairs {
		if e[0] == 0 || e[1] == 0 {
			continue // one side fell outside [0, 360)
		}
		if e[0] == e[1] {
			same++
			t.Errorf("the sub-lord is the same %g deg either side of the boundary at "+
				"%.12f; the probe is not straddling anything", g.BoundaryEps, b)
		} else {
			differ++
		}
	}
	if differ == 0 {
		t.Fatal("no boundary was actually straddled")
	}
	t.Logf("%d probes over %d boundaries; %d straddled a real change, %d did not",
		len(g.Boundaries), len(pairs), differ, same)
}

func TestKpSubLordBoundaryMargin(t *testing.T) {
	g := loadKpGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	closest := math.Inf(1)
	var at float64
	checked := 0

	for _, c := range g.KpCharts {
		if !c.Ok {
			continue
		}
		loc := kpLoc(g, c.Loc)
		cuspal, err := ComputeKpCuspalSubLords(ctx, c.Ms, loc, BirthChartOptions{})
		if err != nil {
			continue
		}
		chart, err := ComputeRashiChart(ctx, c.Ms, loc, BirthChartOptions{})
		if err != nil {
			continue
		}
		lons := make([]float64, 0, 21)
		for _, cu := range cuspal.Cusps {
			lons = append(lons, cu.Longitude)
		}
		for _, p := range chart.Planets {
			lons = append(lons, p.Longitude)
		}
		for _, lon := range lons {
			checked++
			nak := utils.NakshatraOf(lon)
			deg := lon - float64(float64(nak)*utils.NakshatraSpan)
			star := NakshatraLord[nak]
			cum := 0.0
			for i := 0; i < 9; i++ {
				cum += subWidth(DashaOrder[(int(star)+i)%9])
				if d := math.Abs(deg - cum); d < closest {
					closest, at = d, lon
				}
			}
		}
	}

	if checked == 0 {
		t.Fatal("no longitude was checked")
	}
	if closest < 1e-10 {
		t.Errorf("a real longitude came within %g deg of a sub-boundary (at %.12f); "+
			"at that distance the ~1.7e-13 deg ephemeris difference could flip the "+
			"comparison and the two languages would report different sub-lords",
			closest, at)
	}
	t.Logf("%d real longitudes: closest approach to a sub-boundary %g deg at %.9f "+
		"(ephemeris agreement ~1.7e-13 deg)", checked, closest, at)
}

func TestKpCuspalAndSignificatorsMatchTypeScript(t *testing.T) {
	g := loadKpGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	var worst float64
	ok, failed := 0, 0

	for _, c := range g.KpCharts {
		loc := kpLoc(g, c.Loc)
		cuspal, err := ComputeKpCuspalSubLords(ctx, c.Ms, loc, BirthChartOptions{})

		if !c.Ok {
			failed++
			if err == nil {
				t.Errorf("%s: Go succeeded where the TypeScript threw %v", c.Name, derefStr(c.Code))
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: %v", c.Name, err)
			continue
		}
		ok++

		if len(cuspal.Cusps) != len(c.Cuspal.Cusps) {
			t.Errorf("%s: %d cusps, TypeScript %d", c.Name, len(cuspal.Cusps), len(c.Cuspal.Cusps))
			continue
		}
		for i := range cuspal.Cusps {
			gc, wc := cuspal.Cusps[i], c.Cuspal.Cusps[i]
			if d := math.Abs(gc.Longitude - wc.Longitude); d > kpLonBound {
				t.Errorf("%s cusp %d: longitude %.17g, TypeScript %.17g (delta %g)",
					c.Name, i+1, gc.Longitude, wc.Longitude, d)
			} else if d > worst {
				worst = d
			}
			if gc.Rashi != wc.Rashi || gc.Nakshatra != wc.Nakshatra ||
				gc.SignLord != wc.SignLord || gc.StarLord != wc.StarLord || gc.SubLord != wc.SubLord {
				t.Errorf("%s cusp %d: %d/%d/%s/%s/%s, TypeScript %d/%d/%s/%s/%s",
					c.Name, i+1, gc.Rashi, gc.Nakshatra, gc.SignLord, gc.StarLord, gc.SubLord,
					wc.Rashi, wc.Nakshatra, wc.SignLord, wc.StarLord, wc.SubLord)
			}
		}

		chart, err := ComputeRashiChart(ctx, c.Ms, loc, BirthChartOptions{})
		if err != nil {
			t.Errorf("%s: %v", c.Name, err)
			continue
		}
		sig := ComputeKpSignificators(&chart)
		for _, planet := range types.AllGrahas {
			got, _ := sig.ByPlanet.Get(planet)
			want, _ := c.Significators.ByPlanet.Get(planet)
			if !intsEqual(got, want) {
				t.Errorf("%s: %s signifies %v, TypeScript %v", c.Name, planet, got, want)
			}
		}
		for h := 1; h <= 12; h++ {
			got, _ := sig.ByHouse.Get(h)
			want, _ := c.Significators.ByHouse.Get(h)
			if !grahasEqual(got, want) {
				t.Errorf("%s: house %d signified by %v, TypeScript %v", c.Name, h, got, want)
			}
		}
	}

	if ok == 0 {
		t.Fatal("no KP chart succeeded")
	}
	t.Logf("%d charts ok, %d polar failures; worst cusp longitude delta %g deg",
		ok, failed, worst)
}

func intsEqual(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func grahasEqual(a, b []types.Graha) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestKpSignificatorStructuralRules(t *testing.T) {
	g := loadKpGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	checked := 0

	for _, c := range g.KpCharts {
		if !c.Ok {
			continue
		}
		chart, err := ComputeRashiChart(ctx, c.Ms, kpLoc(g, c.Loc), BirthChartOptions{})
		if err != nil {
			continue
		}
		sig := ComputeKpSignificators(&chart)
		checked++

		for _, planet := range types.AllGrahas {
			hs, _ := sig.ByPlanet.Get(planet)
			if len(hs) == 0 {
				t.Errorf("%s: %s signifies nothing; rule 1 (its own house) always fires",
					c.Name, planet)
			}
			for i := 1; i < len(hs); i++ {
				if hs[i] <= hs[i-1] {
					t.Errorf("%s: %s's houses %v are not strictly ascending", c.Name, planet, hs)
					break
				}
			}
			for _, h := range hs {
				if h < 1 || h > 12 {
					t.Errorf("%s: %s signifies house %d", c.Name, planet, h)
				}
			}
		}

		for h := 1; h <= 12; h++ {
			inHouse, _ := sig.ByHouse.Get(h)
			for _, planet := range inHouse {
				hs, _ := sig.ByPlanet.Get(planet)
				if !intsContain(hs, h) {
					t.Errorf("%s: byHouse[%d] lists %s but byPlanet[%s] is %v",
						c.Name, h, planet, planet, hs)
				}
			}
			for _, planet := range types.AllGrahas {
				hs, _ := sig.ByPlanet.Get(planet)
				if intsContain(hs, h) && !grahasContain(inHouse, planet) {
					t.Errorf("%s: byPlanet[%s] lists house %d but byHouse[%d] is %v",
						c.Name, planet, h, h, inHouse)
				}
			}
			if inHouse == nil {
				t.Errorf("%s: byHouse[%d] is nil; the TypeScript initialises every "+
					"house to an empty array", c.Name, h)
			}
		}

		for _, v := range types.AllVisibleGrahas {
			hs, _ := sig.ByPlanet.Get(v.Graha())
			if len(hs) < 1 {
				t.Errorf("%s: %s owns no house by rule 3", c.Name, v)
			}
		}
	}
	if checked == 0 {
		t.Fatal("no chart was checked")
	}
	t.Logf("structural rules hold on %d charts", checked)
}

func grahasContain(xs []types.Graha, x types.Graha) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func TestKpCuspalOverridesHouseSystemButNotAyanamsa(t *testing.T) {
	g := loadKpGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	ms := g.KpCharts[0].Ms
	loc := kpLoc(g, g.KpCharts[0].Loc)

	bare, err := ComputeKpCuspalSubLords(ctx, ms, loc, BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	ws, err := ComputeKpCuspalSubLords(ctx, ms, loc,
		BirthChartOptions{HouseSystem: types.HouseSystemWholeSign})
	if err != nil {
		t.Fatal(err)
	}
	lah, err := ComputeKpCuspalSubLords(ctx, ms, loc, BirthChartOptions{Ayanamsa: types.Lahiri})
	if err != nil {
		t.Fatal(err)
	}

	compareCusps := func(where string, got, want KpCuspalSubLords) {
		t.Helper()
		if len(got.Cusps) != len(want.Cusps) {
			t.Fatalf("%s: %d cusps, TypeScript %d", where, len(got.Cusps), len(want.Cusps))
		}
		for i := range got.Cusps {
			if d := math.Abs(got.Cusps[i].Longitude - want.Cusps[i].Longitude); d > kpLonBound {
				t.Errorf("%s cusp %d: %.17g, TypeScript %.17g", where, i+1,
					got.Cusps[i].Longitude, want.Cusps[i].Longitude)
			}
			if got.Cusps[i].SubLord != want.Cusps[i].SubLord {
				t.Errorf("%s cusp %d: subLord %s, TypeScript %s", where, i+1,
					got.Cusps[i].SubLord, want.Cusps[i].SubLord)
			}
		}
	}
	compareCusps("bare", bare, g.KpOptionArms.Bare)
	compareCusps("wholeSignRequested", ws, g.KpOptionArms.WholeSignRequested)
	compareCusps("lahiriRequested", lah, g.KpOptionArms.LahiriRequested)

	for i := range bare.Cusps {
		if bare.Cusps[i].Longitude != ws.Cusps[i].Longitude {
			t.Errorf("cusp %d moved when whole-sign was requested (%.9f → %.9f); "+
				"the house system is meant to be forced to placidus-kp",
				i+1, bare.Cusps[i].Longitude, ws.Cusps[i].Longitude)
			break
		}
	}
	moved := 0
	for i := range bare.Cusps {
		if bare.Cusps[i].Longitude != lah.Cusps[i].Longitude {
			moved++
		}
	}
	if moved != len(bare.Cusps) {
		t.Errorf("only %d of %d cusps moved when lahiri was requested; the ayanamsa "+
			"is meant to be an overridable default", moved, len(bare.Cusps))
	}
	t.Logf("whole-sign request: 0 cusps moved (forced); lahiri request: %d of %d moved "+
		"(default)", moved, len(bare.Cusps))
}

func TestTithiPraveshaConstantsAreTwoStepped(t *testing.T) {
	var a, b float64 = 29.5306, 29.530589
	if want := 360 / a; moonSunDiffDegPerDay != want {
		t.Errorf("moonSunDiffDegPerDay = %.20g, the two-step form gives %.20g",
			moonSunDiffDegPerDay, want)
	}
	if want := b * 86400_000; synodicMonthMs != want {
		t.Errorf("synodicMonthMs = %.20g, the two-step form gives %.20g",
			synodicMonthMs, want)
	}
	t.Logf("moonSunDiffDegPerDay %.20g, synodicMonthMs %.20g", moonSunDiffDegPerDay, synodicMonthMs)
}

func TestSynodicConstantsDifferDeliberately(t *testing.T) {
	if tithiPraveshaSynodicDays == synodicMonthDays {
		t.Errorf("the two synodic constants are now equal (%v); `tithiPravesha.ts` "+
			"carries 29.5306 and 29.530589 separately", tithiPraveshaSynodicDays)
	}
	d := math.Abs(tithiPraveshaSynodicDays-synodicMonthDays) * 86400
	if d > 1 {
		t.Errorf("the two synodic constants differ by %g s, which is more than the "+
			"0.95 s the two published figures are apart", d)
	}
	t.Logf("29.5306 vs 29.530589 days: %g s apart", d)
}

func TestSiderealYearConstantsAgree(t *testing.T) {
	if siderealYearDays != tithiPraveshaSiderealYearDays {
		t.Errorf("varshaphala has %.17g and tithiPravesha %.17g; both TypeScript "+
			"files declare 365.25636", siderealYearDays, tithiPraveshaSiderealYearDays)
	}
}

func TestNatalTithiIndexMatchesTypeScript(t *testing.T) {
	g := loadKpGolden(t)
	seen := map[int]int{}
	for _, c := range g.TithiIndex {
		got := ComputeNatalTithiIndexForTest(c.Sun, c.Moon)
		if got != c.Idx {
			t.Errorf("sun=%.12f moon=%.12f: %d, TypeScript %d", c.Sun, c.Moon, got, c.Idx)
		}
		if got < 0 || got > 29 {
			t.Errorf("sun=%.12f moon=%.12f: index %d out of 0..29", c.Sun, c.Moon, got)
		}
		seen[got]++
	}
	if len(seen) != 30 {
		t.Errorf("only %d of the 30 tithi indices were reached", len(seen))
	}
	if got := ComputeNatalTithiIndexForTest(0, 359.999999999); got != 29 {
		t.Errorf("a difference of 359.999999999 deg gives tithi %d, expected 29", got)
	}
	if got := ComputeNatalTithiIndexForTest(0, 360); got != 0 {
		t.Errorf("a difference of exactly 360 deg gives tithi %d; normalize360 folds "+
			"it to 0", got)
	}
	t.Logf("%d (sun, moon) pairs, all 30 indices reached", len(g.TithiIndex))
}

func TestTithiPraveshaMatchesTypeScript(t *testing.T) {
	g := loadKpGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	var worstLon float64
	mismatched := 0

	for _, c := range g.TpSweep {
		loc := kpLoc(g, c.Loc)
		got, err := ComputeTithiPravesha(ctx, c.Ms, c.Age, loc, BirthChartOptions{})
		if err != nil {
			t.Fatalf("birth=%d age=%d: %v", c.Ms, c.Age, err)
		}
		w := c.Loc + "/age" + itoa(c.Age)

		if got.PraveshInstant.Ms() != c.Chart.PraveshInstant.Ms() {
			t.Errorf("%s: pravesha %d (%s), TypeScript %d (%s), delta %d ms", w,
				got.PraveshInstant.Ms(), got.PraveshInstant.ISOString(),
				c.Chart.PraveshInstant.Ms(), c.Chart.PraveshInstant.ISOString(),
				got.PraveshInstant.Ms()-c.Chart.PraveshInstant.Ms())
		}
		if got.NatalTithi != c.Chart.NatalTithi || got.PraveshTithi != c.Chart.PraveshTithi {
			t.Errorf("%s: tithi natal %d pravesha %d, TypeScript %d / %d",
				w, got.NatalTithi, got.PraveshTithi, c.Chart.NatalTithi, c.Chart.PraveshTithi)
		}
		if d := math.Abs(got.VarshaLagna.SiderealLongitude - c.Chart.VarshaLagna.SiderealLongitude); d > kpLonBound {
			t.Errorf("%s: lagna %.17g, TypeScript %.17g (delta %g)", w,
				got.VarshaLagna.SiderealLongitude, c.Chart.VarshaLagna.SiderealLongitude, d)
		} else if d > worstLon {
			worstLon = d
		}
		if len(got.Planets) != len(c.Chart.Planets) || len(got.Bhava.Houses) != len(c.Chart.Bhava.Houses) {
			t.Errorf("%s: %d planets / %d houses, TypeScript %d / %d", w,
				len(got.Planets), len(got.Bhava.Houses),
				len(c.Chart.Planets), len(c.Chart.Bhava.Houses))
		}

		if got.PraveshTithi != got.NatalTithi {
			mismatched++
			t.Errorf("%s: praveshTithi %d != natalTithi %d. The chart is documented "+
				"as preserving the natal tithi exactly", w, got.PraveshTithi, got.NatalTithi)
		}
	}
	t.Logf("%d pravesha charts, %d with a tithi mismatch; worst lagna delta %g deg",
		len(g.TpSweep), mismatched, worstLon)
}

func TestTithiPraveshaLandsInTheNatalSign(t *testing.T) {
	g := loadKpGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	inSign, outOfSign, shifted := 0, 0, 0

	for _, c := range g.TpSweep {
		natalSun, err := astronomy.GetSiderealSunLongitude(ctx, c.Ms, "lahiri")
		if err != nil {
			t.Fatal(err)
		}
		natalMoon, err := astronomy.GetSiderealMoonLongitude(ctx, c.Ms, "lahiri")
		if err != nil {
			t.Fatal(err)
		}
		targetDelta := utils.Normalize360(natalMoon - natalSun)
		natalRashi := int(math.Floor(natalSun / 30))

		sr, err := FindSolarReturn(ctx, c.Ms, c.Age, natalSun, "lahiri")
		if err != nil {
			t.Fatal(err)
		}
		t1, err := FindTithiPraveshaForTest(ctx, sr, targetDelta, "lahiri")
		if err != nil {
			t.Fatal(err)
		}
		sunT1, err := astronomy.GetSiderealSunLongitude(ctx, t1, "lahiri")
		if err != nil {
			t.Fatal(err)
		}
		if int(math.Floor(sunT1/30)) != natalRashi {
			shifted++
		}

		final := c.Chart.PraveshInstant.Ms()
		sunFinal, err := astronomy.GetSiderealSunLongitude(ctx, final, "lahiri")
		if err != nil {
			t.Fatal(err)
		}
		if int(math.Floor(sunFinal/30)) == natalRashi {
			inSign++
		} else {
			outOfSign++
			t.Errorf("birth=%d age=%d: the pravesha instant has the Sun in rashi %d, "+
				"natal is %d, and neither candidate landed in the natal sign",
				c.Ms, c.Age, int(math.Floor(sunFinal/30)), natalRashi)
		}
	}

	if shifted == 0 {
		t.Errorf("the synodic-month correction never ran across %d charts; the "+
			"branch is compared to nothing", len(g.TpSweep))
	}
	t.Logf("%d charts: %d needed the synodic shift, %d ended in the natal sign, "+
		"%d did not", len(g.TpSweep), shifted, inSign, outOfSign)
}

func TestTithiPraveshaRejectsBadYearAge(t *testing.T) {
	g := loadKpGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	loc := kpLoc(g, g.Locations[0].Name)
	for _, c := range g.BadTpAges {
		if !c.Threw {
			t.Errorf("yearAge %d did not throw in the TypeScript", c.Age)
			continue
		}
		_, err := ComputeTithiPravesha(ctx, g.TpBirths[0], c.Age, loc, BirthChartOptions{})
		if err == nil {
			t.Errorf("yearAge %d was accepted", c.Age)
			continue
		}
		var pe *types.PanchangError
		if !errors.As(err, &pe) || c.Code == nil || string(pe.Code) != *c.Code {
			t.Errorf("yearAge %d: error %v, TypeScript code %v", c.Age, err, c.Code)
		}
		want := "Tithi-Pravesha yearAge must be a positive integer (1 = first cycle); got " + itoa(c.Age)
		if err.Error() != want {
			t.Errorf("yearAge %d: message %q, expected %q", c.Age, err.Error(), want)
		}
	}
}

func TestPrashnaDefaultsMatchTypeScript(t *testing.T) {
	g := loadKpGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	loc := types.GeoLocation{Latitude: g.Prashna.Loc.Latitude, Longitude: g.Prashna.Loc.Longitude}
	at := g.Prashna.At

	lagnaOf := func(c types.BirthChart) float64 { return c.Lagna.SiderealLongitude }

	bare, err := ComputePrashnaChart(ctx, at, loc, BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	ws, err := ComputePrashnaChart(ctx, at, loc, BirthChartOptions{HouseSystem: types.HouseSystemWholeSign})
	if err != nil {
		t.Fatal(err)
	}
	lah, err := ComputePrashnaChart(ctx, at, loc, BirthChartOptions{Ayanamsa: types.Lahiri})
	if err != nil {
		t.Fatal(err)
	}

	for _, c := range []struct {
		name      string
		got, want types.BirthChart
	}{
		{"bare", bare, g.Prashna.Bare},
		{"wholeSign", ws, g.Prashna.WholeSign},
		{"lahiri", lah, g.Prashna.Lahiri},
	} {
		if d := math.Abs(lagnaOf(c.got) - lagnaOf(c.want)); d > kpLonBound {
			t.Errorf("%s: lagna %.17g, TypeScript %.17g (delta %g)",
				c.name, lagnaOf(c.got), lagnaOf(c.want), d)
		}
		if c.got.Bhava.System != c.want.Bhava.System {
			t.Errorf("%s: house system %q, TypeScript %q", c.name, c.got.Bhava.System, c.want.Bhava.System)
		}
		if len(c.got.Bhava.Houses) != len(c.want.Bhava.Houses) {
			t.Fatalf("%s: %d houses, TypeScript %d", c.name, len(c.got.Bhava.Houses), len(c.want.Bhava.Houses))
		}
		for i := range c.got.Bhava.Houses {
			if d := math.Abs(c.got.Bhava.Houses[i].CuspLongitude - c.want.Bhava.Houses[i].CuspLongitude); d > kpLonBound {
				t.Errorf("%s cusp %d: %.17g, TypeScript %.17g", c.name, i+1,
					c.got.Bhava.Houses[i].CuspLongitude, c.want.Bhava.Houses[i].CuspLongitude)
			}
		}
	}

	if bare.Bhava.System != types.HouseSystemPlacidusKP {
		t.Errorf("a bare prashna chart uses %q houses, expected placidus-kp", bare.Bhava.System)
	}
	if d := math.Abs(lagnaOf(bare) - lagnaOf(g.Prashna.Equivalent)); d > kpLonBound {
		t.Errorf("a bare prashna chart differs from an explicit placidus-kp + "+
			"krishnamurti chart by %g deg in the lagna", d)
	}
	if ws.Bhava.System != types.HouseSystemWholeSign {
		t.Errorf("requesting whole-sign gave %q; prashna defaults are overridable, "+
			"unlike computeKpCuspalSubLords which forces its house system", ws.Bhava.System)
	}
	if lagnaOf(lah) == lagnaOf(bare) {
		t.Error("requesting lahiri did not move the lagna; the ayanamsa default is " +
			"not overridable")
	}
	t.Logf("bare lagna %.6f (placidus-kp/krishnamurti), whole-sign %.6f, lahiri %.6f",
		lagnaOf(bare), lagnaOf(ws), lagnaOf(lah))
}
