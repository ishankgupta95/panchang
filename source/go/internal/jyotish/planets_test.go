package jyotish

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func TestDegreeInRashiIsExactlyInRange(t *testing.T) {
	ulp := func(x float64) float64 { return math.Nextafter(x, math.Inf(1)) - x }

	worst := math.Inf(1)
	for k := 1; k < 12; k++ {
		gap := 2 * ulp(30*float64(k)) / (30 * ulp(float64(k)))
		if gap < worst {
			worst = gap
		}
		if gap <= 1 {
			t.Errorf("k=%d: the largest float below %d° is only %.4f half-ULPs under "+
				"the integer quotient, so floor(lon/30) can round UP and degreeInRashi "+
				"can go negative, so the clamp `buildGrahaPosition` omits would be needed",
				k, 30*k, gap)
		}
	}
	if worst < 1.05 || worst > 1.08 {
		t.Errorf("tightest half-ULP margin is %.4f; the derivation says 32/30 = 1.0667", worst)
	}

	check := func(lon float64) {
		idx := int(math.Floor(lon / 30))
		deg := lon - float64(float64(idx)*30)
		if idx < 0 || idx > 11 {
			t.Fatalf("lon %v gives rashi index %d", lon, idx)
		}
		if deg < 0 || deg >= 30 {
			t.Fatalf("lon %v gives degreeInRashi %v, outside [0, 30)", lon, deg)
		}
		if math.Signbit(deg) {
			t.Fatalf("lon %v gives degreeInRashi -0; JSON.stringify erases the sign and "+
				"encoding/json does not (docs/porting.md §1.8)", lon)
		}
	}
	for k := 0; k < 12; k++ {
		b := float64(k) * 30
		if b > 0 {
			check(math.Nextafter(b, 0))
		}
		check(b)
		check(math.Nextafter(b, 360))
	}
	s := uint32(0x5EED0030)
	for i := 0; i < 500_000; i++ {
		s = s*1664525 + 1013904223
		check(float64(s) / 4294967296 * 360)
	}

	const nakBoundary = 226.66666666666666
	if nakBoundary >= float64(17)*utils.NakshatraSpan {
		t.Errorf("%v is no longer below 17*NakshatraSpan (%v); the anomaly that "+
			"motivated the clamp has moved and TestPadaIsClampedAtBothEdges in "+
			"internal/core is the test that should catch it",
			nakBoundary, float64(17)*utils.NakshatraSpan)
	}
	t.Logf("30° grid: tightest margin %.4f half-ULPs, 500,036 longitudes all in [0, 30); "+
		"NakshatraSpan by contrast admits %v < 17*span", worst, nakBoundary)
}

func mustPositionsAt(t *testing.T, ctx *astronomy.EphemerisCtx, ms int64, node NodeType) types.PlanetaryPositions {
	t.Helper()
	p, err := ComputePlanetaryPositions(ctx, ms, types.Lahiri, nil, nil, node)
	if err != nil {
		t.Fatalf("ComputePlanetaryPositions(%s): %v", types.Date(ms).ISOString(), err)
	}
	return p
}

func TestPlanetaryPositionsAreSelfConsistent(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 1).Ms()
	seenRashi, seenNak := map[int]bool{}, map[int]bool{}
	for i := 0; i < 60; i++ {
		p := mustPositionsAt(t, ctx, base+int64(i)*7*86_400_000, NodeMean)
		for _, graha := range types.AllGrahas {
			pos, ok := p.Get(graha)
			if !ok {
				t.Fatalf("Get(%s) failed", graha)
			}
			where := graha.String() + " @ +" + types.Date(base+int64(i)*7*86_400_000).ISOString()
			if pos.Planet != graha {
				t.Errorf("%s: position carries planet %s", where, pos.Planet)
			}
			lon := pos.SiderealLongitude
			if !(lon >= 0 && lon < 360) {
				t.Fatalf("%s: siderealLongitude %v outside [0, 360)", where, lon)
			}
			if want := int(math.Floor(lon / 30)); pos.Rashi.Index != want {
				t.Errorf("%s: rashi.index %d, floor(lon/30) = %d", where, pos.Rashi.Index, want)
			}
			if want := lon - float64(pos.Rashi.Index)*30; pos.DegreeInRashi != want {
				t.Errorf("%s: degreeInRashi %v, lon - index*30 = %v", where, pos.DegreeInRashi, want)
			}
			if want := utils.NakshatraOf(lon); pos.Nakshatra.Index != want {
				t.Errorf("%s: nakshatra.index %d, NakshatraOf(lon) = %d. The nakshatra "+
					"was computed from a different longitude than the one published",
					where, pos.Nakshatra.Index, want)
			}
			if pos.Nakshatra.Pada < 1 || pos.Nakshatra.Pada > 4 {
				t.Errorf("%s: pada %d outside 1..4", where, pos.Nakshatra.Pada)
			}
			if pos.Nakshatra.EndTime != nil {
				t.Errorf("%s: endTime is %v; a graha position carries no transition",
					where, pos.Nakshatra.EndTime)
			}
			if pos.Nakshatra.CompletionPercentage < 0 || pos.Nakshatra.CompletionPercentage > 100 {
				t.Errorf("%s: completionPercentage %v", where, pos.Nakshatra.CompletionPercentage)
			}
			seenRashi[pos.Rashi.Index] = true
			seenNak[pos.Nakshatra.Index] = true
		}
	}
	if len(seenRashi) != 12 || len(seenNak) != 27 {
		t.Errorf("the sweep reached %d rashis and %d nakshatras, want 12 and 27",
			len(seenRashi), len(seenNak))
	}
}

func TestKetuIsExactlyOppositeRahu(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 1).Ms()
	worst := 0.0
	for _, node := range AllNodeTypes {
		for i := 0; i < 120; i++ {
			p := mustPositionsAt(t, ctx, base+int64(i)*3*86_400_000, node)
			sep := math.Mod(p.Ketu.SiderealLongitude-p.Rahu.SiderealLongitude+720, 360)
			if d := math.Abs(sep - 180); d > 1e-12 {
				t.Errorf("%s node: Ketu is %v from Rahu, want 180", node, sep)
			} else if d > worst {
				worst = d
			}
		}
	}
	t.Logf("Ketu-Rahu separation: worst |Δ| from 180 = %g deg over both node conventions", worst)
}

func TestRetrogradeFlagsAreFixedWhereTheyShouldBe(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 1).Ms()
	for i := 0; i < 40; i++ {
		p := mustPositionsAt(t, ctx, base+int64(i)*9*86_400_000, NodeMean)
		for _, c := range []struct {
			graha types.Graha
			want  bool
		}{
			{types.GrahaSun, false}, {types.GrahaMoon, false},
			{types.GrahaRahu, true}, {types.GrahaKetu, true},
		} {
			pos, _ := p.Get(c.graha)
			if pos.IsRetrograde != c.want {
				t.Fatalf("%s isRetrograde = %v, want %v (it is hard-coded)",
					c.graha, pos.IsRetrograde, c.want)
			}
		}
	}
}

func TestRetrogradeEpisodesContainAConjunctionOrOpposition(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	const (
		stepDays = 3
		days     = 5 * 365
		window   = 25.0
	)
	base := types.DateUTC(2020, 0, 1).Ms()

	bodies := []struct {
		name     string
		body     astronomy.PlanetBody
		inferior bool
	}{
		{"mercury", astronomy.PlanetMercury, true},
		{"venus", astronomy.PlanetVenus, true},
		{"mars", astronomy.PlanetMars, false},
		{"jupiter", astronomy.PlanetJupiter, false},
		{"saturn", astronomy.PlanetSaturn, false},
	}

	totalEpisodes := 0
	for _, b := range bodies {
		type sample struct {
			ms    int64
			retro bool
			elong float64
		}
		samples := make([]sample, 0, days/stepDays+1)
		for d := 0; d <= days; d += stepDays {
			ms := base + int64(d)*86_400_000
			sunLon := astronomy.GetTropicalSunLongitude(ctx, ms)
			lon := astronomy.GetTropicalPlanetLongitude(ctx, b.body, ms)
			samples = append(samples, sample{
				ms:    ms,
				retro: isRetrograde(ctx, b.body, ms),
				elong: utils.Normalize360(lon - sunLon),
			})
		}

		episodes := 0
		for i := 0; i < len(samples); i++ {
			if !samples[i].retro {
				continue
			}
			j := i
			for j+1 < len(samples) && samples[j+1].retro {
				j++
			}
			if i > 0 && j < len(samples)-1 {
				episodes++
				mid := samples[(i+j)/2].elong
				var off float64
				if b.inferior {
					off = math.Min(mid, 360-mid)
				} else {
					off = math.Abs(mid - 180)
				}
				if off > window {
					target := "inferior conjunction (0°)"
					if !b.inferior {
						target = "opposition (180°)"
					}
					t.Errorf("%s: a retrograde episode centred on %s has elongation %.2f°, "+
						"%.1f° from %s. An inverted isRetrograde would look exactly like "+
						"this, at ~180° off", b.name, types.Date(samples[(i+j)/2].ms).ISOString()[:10],
						mid, off, target)
				}
			}
			i = j
		}
		if episodes == 0 {
			t.Errorf("%s: no complete retrograde episode in %d years. The sample is "+
				"too short or too coarse for this body, and the assertion above "+
				"proved nothing about it", b.name, days/365)
		}
		totalEpisodes += episodes
		t.Logf("%s: %d complete retrograde episodes in %d years", b.name, episodes, days/365)
	}
	if totalEpisodes < 20 {
		t.Errorf("only %d episodes across all five bodies; expected 20+ in 5 years "+
			"(Mercury alone turns retrograde about three times a year)", totalEpisodes)
	}
}

func TestNilNameResolversAreTheIdentity(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	p, err := ComputePlanetaryPositions(ctx, types.DateUTC(2025, 0, 14).Ms(),
		types.Lahiri, nil, nil, NodeMean)
	if err != nil {
		t.Fatal(err)
	}
	for _, graha := range types.AllGrahas {
		pos, _ := p.Get(graha)
		if want := identityName(pos.Rashi.Index); pos.Rashi.Name != want {
			t.Errorf("%s: rashi.name %q, identity of index %d is %q",
				graha, pos.Rashi.Name, pos.Rashi.Index, want)
		}
		if want := identityName(pos.Nakshatra.Index); pos.Nakshatra.Name != want {
			t.Errorf("%s: nakshatra.name %q, identity of index %d is %q",
				graha, pos.Nakshatra.Name, pos.Nakshatra.Index, want)
		}
	}
	for _, c := range []struct {
		in   int
		want string
	}{{0, "0"}, {9, "9"}, {10, "10"}, {26, "26"}} {
		if got := identityName(c.in); got != c.want {
			t.Errorf("identityName(%d) = %q, want %q", c.in, got, c.want)
		}
	}
	p2, err := ComputePlanetaryPositions(ctx, types.DateUTC(2025, 0, 14).Ms(), types.Lahiri,
		func(int) string { return "NAK" }, func(int) string { return "RASHI" }, NodeMean)
	if err != nil {
		t.Fatal(err)
	}
	if p2.Sun.Rashi.Name != "RASHI" || p2.Sun.Nakshatra.Name != "NAK" {
		t.Errorf("supplied resolvers were ignored: rashi %q nakshatra %q",
			p2.Sun.Rashi.Name, p2.Sun.Nakshatra.Name)
	}
}

func TestNodeTypeResolutionMirrorsTheTernary(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	ms := types.DateUTC(2025, 0, 14).Ms()
	mean := mustPositionsAt(t, ctx, ms, NodeMean).Rahu.SiderealLongitude
	tru := mustPositionsAt(t, ctx, ms, NodeTrue).Rahu.SiderealLongitude
	if mean == tru {
		t.Fatal("the mean and true nodes are identical at this instant; pick another " +
			"or the rest of this test cannot distinguish the branches")
	}
	for _, c := range []struct {
		in   NodeType
		want float64
		why  string
	}{
		{"", mean, "the zero value must resolve to the documented default"},
		{NodeMean, mean, "the explicit default"},
		{NodeTrue, tru, "the only value that selects the true node"},
		{"TRUE", mean, "the TypeScript compares against the lowercase literal"},
		{"nonsense", mean, "anything that is not 'true' falls to the mean branch"},
	} {
		got := mustPositionsAt(t, ctx, ms, c.in).Rahu.SiderealLongitude
		if got != c.want {
			t.Errorf("nodeType %q: got %v, want %v (%s)", c.in, got, c.want, c.why)
		}
	}
	if resolveNodeType("") != NodeMean {
		t.Error("resolveNodeType(\"\") must be NodeMean")
	}
	if resolveNodeType(NodeTrue) != NodeTrue {
		t.Error("resolveNodeType must pass NodeTrue through")
	}
}

func TestPlanetaryPositionsRejectsUnknownAyanamsa(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	ms := types.DateUTC(2025, 0, 14).Ms()
	for _, bad := range []types.AyanamsaType{"", "sidereal", "LAHIRI"} {
		_, err := ComputePlanetaryPositions(ctx, ms, bad, nil, nil, NodeMean)
		var pe *types.PanchangError
		if !errors.As(err, &pe) {
			t.Errorf("ayanamsa %q: err = %v, want a PanchangError", bad, err)
			continue
		}
		if pe.Code != types.ErrInvalidAyanamsa {
			t.Errorf("ayanamsa %q: code %s, want %s", bad, pe.Code, types.ErrInvalidAyanamsa)
		}
	}
	for _, ok := range types.AllAyanamsaTypes {
		if _, err := ComputePlanetaryPositions(ctx, ms, ok, nil, nil, NodeMean); err != nil {
			t.Errorf("ayanamsa %q: %v", ok, err)
		}
	}
}

func TestGrahaListCoversEveryGraha(t *testing.T) {
	basis, err := ComputeNatalBasis(astronomy.NewEphemerisCtx(),
		types.DateUTC(2025, 0, 14).Ms(), lagnaTestPune, BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	list := GrahaList(&basis)
	if len(list) != types.GrahaCount {
		t.Fatalf("GrahaList returned %d entries, want %d", len(list), types.GrahaCount)
	}
	seen := map[types.Graha]bool{}
	for i, e := range list {
		if e.Key != types.AllGrahas[i] {
			t.Errorf("GrahaList[%d] = %s, want %s", i, e.Key, types.AllGrahas[i])
		}
		if seen[e.Key] {
			t.Errorf("%s appears twice", e.Key)
		}
		seen[e.Key] = true
		if e.Pos == nil {
			t.Fatalf("%s has a nil position", e.Key)
		}
		if e.Pos.Planet != e.Key {
			t.Errorf("GrahaList[%d].Key is %s but the position says %s", i, e.Key, e.Pos.Planet)
		}
		want, _ := basis.Positions.Get(e.Key)
		if e.Pos != want {
			t.Errorf("%s: GrahaList returned a copy rather than a pointer into the basis", e.Key)
		}
	}
	if len(seen) != types.GrahaCount {
		t.Errorf("GrahaList covered %d distinct grahas, want %d", len(seen), types.GrahaCount)
	}
}

func narrowCases(n int) []struct {
	ms  int64
	loc types.GeoLocation
	opt BirthChartOptions
} {
	rng := rand.New(rand.NewSource(20260924))
	lo := types.DateUTC(1900, 0, 1).Ms()
	hi := types.DateUTC(2101, 0, 1).Ms()
	systems := []types.HouseSystem{"", types.HouseSystemWholeSign, types.HouseSystemEqual, types.HouseSystemPlacidusKP, "bogus"}
	ayanamsas := []types.AyanamsaType{"", types.Lahiri, types.Raman, types.Krishnamurti, types.Thirukanitham, types.TrueChitra, "bogus"}
	langs := []types.Language{"", types.LanguageEn, types.LanguageHi}
	nodes := []NodeType{"", NodeMean, NodeTrue}
	out := make([]struct {
		ms  int64
		loc types.GeoLocation
		opt BirthChartOptions
	}, 0, n)
	for i := 0; i < n; i++ {
		lat := rng.Float64()*178 - 89
		if i%9 == 0 {
			lat = (rng.Float64()*24 + 62) * float64(1-2*(i%2)) // around the polar circles
		}
		out = append(out, struct {
			ms  int64
			loc types.GeoLocation
			opt BirthChartOptions
		}{
			ms:  lo + rng.Int63n(hi-lo),
			loc: types.GeoLocation{Latitude: lat, Longitude: rng.Float64()*360 - 180, Elevation: rng.Float64() * 3000},
			opt: BirthChartOptions{
				HouseSystem: systems[rng.Intn(len(systems))],
				Ayanamsa:    ayanamsas[rng.Intn(len(ayanamsas))],
				Language:    langs[rng.Intn(len(langs))],
				NodeType:    nodes[rng.Intn(len(nodes))],
			},
		})
	}
	return out
}

func outcome(v any, err error) string {
	if err != nil {
		return "error: " + err.Error()
	}
	b, e := json.Marshal(v)
	if e != nil {
		return "marshal: " + e.Error()
	}
	return string(b)
}

// ComputeBhava builds its basis without the planetary positions; it must
// answer, result and error alike, as the full natal basis does.
func TestBhavaFromTheLagnaBasisMatchesTheFullBasis(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	errs := 0
	for _, c := range narrowCases(1500) {
		got := outcome(ComputeBhava(ctx, c.ms, c.loc, c.opt))
		basis, err := ComputeNatalBasis(astronomy.NewEphemerisCtx(), c.ms, c.loc, c.opt)
		var want string
		if err != nil {
			want = outcome(nil, err)
		} else {
			want = outcome(BhavaFromBasis(&basis, resolveHouseSystem(c.opt.HouseSystem)))
		}
		if got != want {
			t.Fatalf("%s %+v %+v:\n lagna basis %s\n full basis  %s", types.Date(c.ms).ISOString(), c.loc, c.opt, got, want)
		}
		if err != nil || got[:6] == "error:" {
			errs++
		}
	}
	if errs == 0 {
		t.Fatal("no case reached an error path")
	}
}

// buildVariableDurationFn reads the rashis from siderealGrahaLongitudes; they
// must be the rashis, and the longitudes the longitudes, of the birth chart.
func TestSiderealGrahaLongitudesAreTheChartsLongitudes(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	for _, c := range narrowCases(1500) {
		chart, chartErr := ComputeRashiChart(astronomy.NewEphemerisCtx(), c.ms, c.loc,
			BirthChartOptions{Ayanamsa: resolveAyanamsa(c.opt.Ayanamsa), HouseSystem: types.HouseSystemWholeSign, NodeType: c.opt.NodeType})
		lon, err := siderealGrahaLongitudes(ctx, c.ms, resolveAyanamsa(c.opt.Ayanamsa), c.opt.NodeType)
		if (err == nil) != (chartErr == nil) {
			t.Fatalf("%s: helper error %v, chart error %v", types.Date(c.ms).ISOString(), err, chartErr)
		}
		if err != nil {
			continue
		}
		for _, p := range chart.Planets {
			if math.Float64bits(lon[p.Planet]) != math.Float64bits(p.Longitude) ||
				int(math.Floor(lon[p.Planet]/30)) != p.Rashi.Index {
				t.Fatalf("%s %s: helper %v (rashi %d), chart %v (rashi %d)", types.Date(c.ms).ISOString(),
					p.Planet, lon[p.Planet], int(math.Floor(lon[p.Planet]/30)), p.Longitude, p.Rashi.Index)
			}
		}
	}
}

// narayanVariableFromChart is the Narayan variable dasha as it read the grahas'
// rashis before, from a whole-sign rashi chart.
func narayanRashisFromChart(ctx *astronomy.EphemerisCtx, ms int64, loc types.GeoLocation, ay types.AyanamsaType) (string, error) {
	chart, err := ComputeRashiChart(ctx, ms, loc, BirthChartOptions{Ayanamsa: ay, HouseSystem: types.HouseSystemWholeSign})
	if err != nil {
		return "", err
	}
	var r [types.GrahaCount]int
	for _, p := range chart.Planets {
		r[p.Planet] = p.Rashi.Index
	}
	return fmt.Sprint(r), nil
}

func TestNarayanVariableRashisMatchTheChart(t *testing.T) {
	for _, c := range narrowCases(400) {
		ay := resolveAyanamsa(c.opt.Ayanamsa)
		want, wantErr := narayanRashisFromChart(astronomy.NewEphemerisCtx(), c.ms, c.loc, ay)
		lon, err := siderealGrahaLongitudes(astronomy.NewEphemerisCtx(), c.ms, ay, NodeMean)
		if (err == nil) != (wantErr == nil) {
			t.Fatalf("%s: helper error %v, chart error %v", types.Date(c.ms).ISOString(), err, wantErr)
		}
		if err != nil {
			continue
		}
		var r [types.GrahaCount]int
		for g, l := range lon {
			r[g] = int(math.Floor(l / 30))
		}
		if got := fmt.Sprint(r); got != want {
			t.Fatalf("%s: rashis %s, chart %s", types.Date(c.ms).ISOString(), got, want)
		}
	}
}
