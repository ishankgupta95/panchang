package jyotish

import (
	"errors"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func mustBhava(t *testing.T, ctx *astronomy.EphemerisCtx, ms int64,
	loc types.GeoLocation, hs types.HouseSystem) types.BhavaChart {
	t.Helper()
	c, err := ComputeBhava(ctx, ms, loc, BirthChartOptions{HouseSystem: hs})
	if err != nil {
		t.Fatalf("ComputeBhava(%s, %s): %v", types.Date(ms).ISOString(), hs, err)
	}
	return c
}

func TestBhavaCuspsPartitionTheZodiac(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	for _, loc := range []types.GeoLocation{
		lagnaTestPune,
		{Latitude: -33.8688, Longitude: 151.2093},
		{Latitude: 51.5074, Longitude: -0.1278},
		{Latitude: 0, Longitude: 0},
	} {
		for _, hs := range types.AllHouseSystems {
			for i := 0; i < 24; i++ {
				c := mustBhava(t, ctx, base+int64(i)*3600_000, loc, hs)
				if len(c.Houses) != 12 {
					t.Fatalf("%s at lat %v: %d houses", hs, loc.Latitude, len(c.Houses))
				}
				total := 0.0
				for k := 0; k < 12; k++ {
					h := c.Houses[k]
					if h.House != k+1 {
						t.Errorf("%s: houses[%d].house = %d", hs, k, h.House)
					}
					if !(h.CuspLongitude >= 0 && h.CuspLongitude < 360) {
						t.Fatalf("%s: cusp %d = %v outside [0, 360)", hs, k+1, h.CuspLongitude)
					}
					if want := int(math.Floor(h.CuspLongitude / 30)); h.Rashi.Index != want {
						t.Errorf("%s: cusp %d rashi %d, floor(lon/30) = %d",
							hs, k+1, h.Rashi.Index, want)
					}
					if !(h.DegreeInRashi >= 0 && h.DegreeInRashi < 30) {
						t.Errorf("%s: cusp %d degreeInRashi %v outside [0, 30)",
							hs, k+1, h.DegreeInRashi)
					}
					gap := math.Mod(c.Houses[(k+1)%12].CuspLongitude-h.CuspLongitude+360, 360)
					if gap <= 0 {
						t.Fatalf("%s at lat %v: cusps %d and %d are not in zodiacal order "+
							"(gap %v); houseOfLongitude's fallback becomes reachable",
							hs, loc.Latitude, k+1, ((k+1)%12)+1, gap)
					}
					total += gap
				}
				if math.Abs(total-360) > 1e-9 {
					t.Errorf("%s at lat %v: the 12 gaps sum to %v, not 360", hs, loc.Latitude, total)
				}
			}
		}
	}
}

func TestHouseFallbackIsUnreachable(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	claimed := 0
	for _, hs := range types.AllHouseSystems {
		c := mustBhava(t, ctx, base+7*3600_000, lagnaTestPune, hs)
		cusps := make([]float64, 0, 12)
		for _, h := range c.Houses {
			cusps = append(cusps, h.CuspLongitude)
		}
		probes := make([]float64, 0, 3600+36)
		for i := 0; i < 3600; i++ {
			probes = append(probes, float64(i)/10)
		}
		for _, cu := range cusps {
			probes = append(probes, cu, math.Nextafter(cu, 360), math.Nextafter(cu, 0))
		}
		for _, lambda := range probes {
			if lambda < 0 || lambda >= 360 {
				continue
			}
			h := houseOfLongitude(lambda, cusps)
			if h < 1 || h > 12 {
				t.Fatalf("%s: houseOfLongitude(%v) = %d", hs, lambda, h)
			}
			want := -1
			for k := 0; k < 12; k++ {
				start, end := cusps[k], cusps[(k+1)%12]
				in := false
				if start <= end {
					in = lambda >= start && lambda < end
				} else {
					in = lambda >= start || lambda < end
				}
				if in {
					want = k + 1
					break
				}
			}
			if want == -1 {
				t.Fatalf("%s: no house contains %v. The fallback is REACHABLE and "+
					"`return 1` is a silent wrong answer, not dead code", hs, lambda)
			}
			if h != want {
				t.Errorf("%s: houseOfLongitude(%v) = %d, the containing arc is %d",
					hs, lambda, h, want)
			}
			claimed++
		}
	}
	if claimed == 0 {
		t.Fatal("no longitudes were probed")
	}
	t.Logf("%d longitudes across 3 house systems, every one claimed by exactly one house", claimed)
}

func TestWholeSignAndEqualCuspsAreTheDocumentedShapes(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	for i := 0; i < 24; i++ {
		ms := base + int64(i)*3600_000
		lagna := mustLagna(t, ctx, ms, lagnaTestPune)

		ws := mustBhava(t, ctx, ms, lagnaTestPune, types.HouseSystemWholeSign)
		for k, h := range ws.Houses {
			if math.Mod(h.CuspLongitude, 30) != 0 {
				t.Errorf("whole-sign cusp %d = %v is not an exact multiple of 30",
					k+1, h.CuspLongitude)
			}
			if h.DegreeInRashi != 0 {
				t.Errorf("whole-sign cusp %d has degreeInRashi %v, want exactly 0",
					k+1, h.DegreeInRashi)
			}
			if want := (lagna.Rashi.Index + k) % 12; h.Rashi.Index != want {
				t.Errorf("whole-sign cusp %d is in rashi %d, want %d (%d signs from the lagna)",
					k+1, h.Rashi.Index, want, k)
			}
		}

		eq := mustBhava(t, ctx, ms, lagnaTestPune, types.HouseSystemEqual)
		for k, h := range eq.Houses {
			if d := math.Abs(h.DegreeInRashi - lagna.DegreeInRashi); d > 1e-12 {
				t.Errorf("equal cusp %d has degreeInRashi %v, the lagna's is %v",
					k+1, h.DegreeInRashi, lagna.DegreeInRashi)
			}
			if want := (lagna.Rashi.Index + k) % 12; h.Rashi.Index != want {
				t.Errorf("equal cusp %d is in rashi %d, want %d", k+1, h.Rashi.Index, want)
			}
		}
		if eq.Houses[0].CuspLongitude != lagna.SiderealLongitude {
			t.Errorf("equal cusp 1 = %v, the lagna is %v; for this system alone they "+
				"must be bit-identical", eq.Houses[0].CuspLongitude, lagna.SiderealLongitude)
		}
	}
}

func TestAscendantLongitudeIsNotAlwaysCuspOne(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	delhi := types.GeoLocation{Latitude: 28.6139, Longitude: 77.209}
	worst := map[types.HouseSystem]float64{}
	for i := 0; i < 96; i++ {
		ms := base + int64(i)*900_000
		for _, hs := range types.AllHouseSystems {
			c := mustBhava(t, ctx, ms, delhi, hs)
			d := angleDelta(c.AscendantLongitude, c.Houses[0].CuspLongitude)
			if d > worst[hs] {
				worst[hs] = d
			}
		}
	}
	if worst[types.HouseSystemEqual] != 0 {
		t.Errorf("equal: |asc - cusp1| reached %g; for this system the docblock's "+
			"claim holds exactly and must", worst[types.HouseSystemEqual])
	}
	if worst[types.HouseSystemWholeSign] < 29 {
		t.Errorf("whole-sign: |asc - cusp1| only reached %g over a full day. The "+
			"TypeScript reaches 29.995°. If this has become small, cusp 1 has "+
			"stopped being the start of the sign", worst[types.HouseSystemWholeSign])
	}
	if p := worst[types.HouseSystemPlacidusKP]; p == 0 || p > 1e-12 {
		t.Errorf("placidus-kp: |asc - cusp1| = %g. It should be nonzero (two "+
			"different spellings of rad-to-deg) but no larger than one ULP of 360°; "+
			"a zero means the port unified the two expressions and a large value "+
			"means the solver disagrees with computeLagna", p)
	}
	t.Logf("|ascendantLongitude - houses[0].cuspLongitude|: whole-sign %g, equal %g, "+
		"placidus-kp %g", worst[types.HouseSystemWholeSign],
		worst[types.HouseSystemEqual], worst[types.HouseSystemPlacidusKP])
}

func TestMcLongitudeIsAlwaysTheTrueMidheaven(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	delhi := types.GeoLocation{Latitude: 28.6139, Longitude: 77.209}
	worstAnchor := 0.0
	for i := 0; i < 96; i++ {
		ms := base + int64(i)*900_000
		lagna := mustLagna(t, ctx, ms, delhi)
		mcs := make([]float64, 0, 3)
		for _, hs := range types.AllHouseSystems {
			mcs = append(mcs, mustBhava(t, ctx, ms, delhi, hs).MCLongitude)
		}
		for k := 1; k < len(mcs); k++ {
			if mcs[k] != mcs[0] {
				t.Fatalf("mcLongitude differs by house system (%v vs %v); it is the "+
					"true MC and must not", mcs[0], mcs[k])
			}
		}
		wholeAnchor := math.Mod(math.Floor(lagna.SiderealLongitude/30)*30+9*30, 360)
		equalAnchor := math.Mod(lagna.SiderealLongitude+270, 360)
		for _, a := range []float64{wholeAnchor, equalAnchor} {
			if d := angleDelta(mcs[0], a); d > worstAnchor {
				worstAnchor = d
			}
		}
	}
	if worstAnchor < 1 {
		t.Errorf("the true MC stayed within %g° of the documented anchors over a full "+
			"day. If that is real, the docblock is right and the finding that "+
			"contradicts it is wrong", worstAnchor)
	}
	t.Logf("mcLongitude is identical across all three systems; worst distance from "+
		"the docblock's 'informational anchor' = %g deg", worstAnchor)
}

func TestPlacidusRejectsBothWaysDistinctly(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	ms := types.DateUTC(2025, 0, 14).Ms() + 6*3600_000

	_, err := ComputeBhava(ctx, ms, types.GeoLocation{Latitude: 85, Longitude: 77.209},
		BirthChartOptions{HouseSystem: types.HouseSystemPlacidusKP})
	if err == nil {
		t.Fatal("Placidus at 85°N returned a chart")
	}
	if !errors.Is(err, types.ErrCircumpolarSentinel) {
		t.Errorf("85°N: %v, want ErrCircumpolar", err)
	}
	if errors.Is(err, types.ErrPlacidusDivergedSentinel) {
		t.Error("85°N reported PLACIDUS_DIVERGED; a latitude with no solution is not " +
			"a solver that failed to find one, and a caller branches differently on each")
	}
	if errors.Is(types.ErrPlacidusDivergedSentinel, types.ErrCircumpolarSentinel) {
		t.Error("the two sentinels compare equal; PanchangError.Is matches on the code, " +
			"so this would mean the two codes are the same")
	}
	for _, hs := range []types.HouseSystem{types.HouseSystemWholeSign, types.HouseSystemEqual} {
		if _, err := ComputeBhava(ctx, ms, types.GeoLocation{Latitude: 85, Longitude: 77.209},
			BirthChartOptions{HouseSystem: hs}); err != nil {
			t.Errorf("%s at 85°N: %v, and the error message tells the caller to use this", hs, err)
		}
	}
}

func TestPlacidusSettlesBelowThePolarCircle(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	for _, c := range []struct{ lat, hour float64 }{{66.3, 13}, {66.4, 7}, {66.5, 3}, {-66.55, 3}} {
		ms := types.DateUTC(2025, 0, 1).Ms() + int64(c.hour)*3600_000
		chart := mustBhava(t, ctx, ms, types.GeoLocation{Latitude: c.lat, Longitude: 20},
			types.HouseSystemPlacidusKP)
		for i := 0; i < 12; i++ {
			next := chart.Houses[(i+1)%12].CuspLongitude
			gap := math.Mod(next-chart.Houses[i].CuspLongitude+360, 360)
			if gap <= 0 || gap >= 180 {
				t.Errorf("%v°/%vh: cusps %d and %d are %v degrees apart", c.lat, c.hour, i+1, (i+1)%12+1, gap)
			}
		}
	}
}

func TestUnknownHouseSystemIsRejected(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	ms := types.DateUTC(2025, 0, 14).Ms()
	for _, bad := range []types.HouseSystem{"placidus", "koch", "WHOLE-SIGN"} {
		_, err := ComputeBhava(ctx, ms, lagnaTestPune, BirthChartOptions{HouseSystem: bad})
		var pe *types.PanchangError
		if !errors.As(err, &pe) {
			t.Errorf("house system %q: err = %v, want a PanchangError", bad, err)
			continue
		}
		if pe.Code != types.ErrInvalidInput {
			t.Errorf("house system %q: code %s, want %s", bad, pe.Code, types.ErrInvalidInput)
		}
	}
	c, err := ComputeBhava(ctx, ms, lagnaTestPune, BirthChartOptions{})
	if err != nil {
		t.Fatalf("the zero HouseSystem must default, not fail: %v", err)
	}
	if c.System != types.HouseSystemWholeSign {
		t.Errorf("the default house system is %q, want whole-sign", c.System)
	}
	for _, hs := range types.AllHouseSystems {
		if _, err := ComputeBhava(ctx, ms, lagnaTestPune, BirthChartOptions{HouseSystem: hs}); err != nil {
			t.Errorf("house system %q: %v", hs, err)
		}
	}
}

func TestRashiChartHousesAgreeWithTheCusps(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	seenHouse := map[int]bool{}
	for _, hs := range types.AllHouseSystems {
		for i := 0; i < 24; i++ {
			c, err := ComputeRashiChart(ctx, base+int64(i)*3600_000, lagnaTestPune,
				BirthChartOptions{HouseSystem: hs})
			if err != nil {
				t.Fatalf("%s: %v", hs, err)
			}
			if c.Bhava.System != hs {
				t.Errorf("chart says %q, bhava says %q", hs, c.Bhava.System)
			}
			cusps := make([]float64, 0, 12)
			for _, h := range c.Bhava.Houses {
				cusps = append(cusps, h.CuspLongitude)
			}
			if len(c.Planets) != types.GrahaCount {
				t.Fatalf("%d planets", len(c.Planets))
			}
			for _, p := range c.Planets {
				if want := houseOfLongitude(p.Longitude, cusps); p.House != want {
					t.Errorf("%s: %s is in house %d but its longitude %v falls in house %d "+
						"of the chart's own cusps", hs, p.Planet, p.House, p.Longitude, want)
				}
				if p.House < 1 || p.House > 12 {
					t.Errorf("%s: %s house %d", hs, p.Planet, p.House)
				}
				seenHouse[p.House] = true
				if p.Rashi.Index != int(math.Floor(p.Longitude/30)) {
					t.Errorf("%s: %s rashi %d does not match its longitude %v",
						hs, p.Planet, p.Rashi.Index, p.Longitude)
				}
			}
			if hs == types.HouseSystemWholeSign {
				for _, p := range c.Planets {
					want := (p.Rashi.Index-c.Lagna.Rashi.Index+12)%12 + 1
					if p.House != want {
						t.Errorf("whole-sign: %s in rashi %d with lagna in %d is house %d, "+
							"want %d", p.Planet, p.Rashi.Index, c.Lagna.Rashi.Index, p.House, want)
					}
				}
			}
		}
	}
	if len(seenHouse) < 10 {
		t.Errorf("the sweep only reached %d distinct houses; the cross-check above is "+
			"weak on a sample that never moves", len(seenHouse))
	}
}

func TestIndexPlanetsRejectsAnIncompleteList(t *testing.T) {
	full, err := ComputeRashiChart(astronomy.NewEphemerisCtx(),
		types.DateUTC(2025, 0, 14).Ms(), lagnaTestPune, BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	partial := make([]types.PlanetPlacement, 0, 8)
	for _, p := range full.Planets {
		if p.Planet != types.GrahaSaturn {
			partial = append(partial, p)
		}
	}
	indexed := IndexPlanets(partial)
	sat, ok := indexed.Get(types.GrahaSaturn)
	if !ok {
		t.Fatal("Get(Saturn) reported out of range")
	}
	if sat.House != 0 || sat.Longitude != 0 {
		t.Errorf("a dropped graha left %+v rather than the zero value; the failure "+
			"shape this test documents has changed", *sat)
	}
	if sat.House >= 1 && sat.House <= 12 {
		t.Error("the zero placement's house is a valid house number; a dropped graha " +
			"would be undetectable")
	}
	for _, graha := range types.AllGrahas {
		p, _ := full.ByPlanet.Get(graha)
		if p.House < 1 || p.House > 12 {
			t.Errorf("%s: house %d in a complete chart", graha, p.House)
		}
		if p.Planet != graha {
			t.Errorf("byPlanet.%s carries planet %s", graha, p.Planet)
		}
	}
}

func TestDivisionalHouseNumbersAreWholeSign(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	agreements, disagreements := 0, 0
	for _, d := range types.AllDivisionals {
		for i := 0; i < 12; i++ {
			ms := base + int64(i)*7200_000
			c, err := ComputeDivisionalChart(ctx, ms, lagnaTestPune, d, BirthChartOptions{})
			if err != nil {
				t.Fatalf("%s: %v", d, err)
			}
			if c.Divisional != d {
				t.Errorf("asked for %s, got %s", d, c.Divisional)
			}
			if len(c.Planets) != types.GrahaCount {
				t.Fatalf("%s: %d planets", d, len(c.Planets))
			}
			for _, p := range c.Planets {
				want := (p.Rashi.Index-c.LagnaRashi.Index+12)%12 + 1
				if p.House != want {
					t.Errorf("%s: %s in rashi %d with lagna in %d is house %d, want %d",
						d, p.Planet, p.Rashi.Index, c.LagnaRashi.Index, p.House, want)
				}
				if p.Rashi.Index != int(math.Floor(p.Longitude/30)) {
					t.Errorf("%s: %s rashi %d does not match longitude %v",
						d, p.Planet, p.Rashi.Index, p.Longitude)
				}
			}
			natal, err := ComputeRashiChart(ctx, ms, lagnaTestPune, BirthChartOptions{})
			if err != nil {
				t.Fatal(err)
			}
			for k := range c.Planets {
				if c.Planets[k].Rashi.Index == natal.Planets[k].Rashi.Index {
					agreements++
				} else {
					disagreements++
				}
			}
		}
	}
	if disagreements == 0 {
		t.Error("every varga placement matched the natal one; the transforms are " +
			"returning their input")
	}
	t.Logf("varga vs natal rashi: %d moved, %d unchanged (a varga legitimately "+
		"leaves some grahas in place)", disagreements, agreements)
}
