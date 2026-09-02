package jyotish

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

type upagrahaGolden struct {
	WalkStart int64 `json:"walkStart"`
	WalkDays  int   `json:"walkDays"`
	WalkHours []int `json:"walkHours"`
	Locations []struct {
		Name      string  `json:"name"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"locations"`
	DayGulikaSlot    []int   `json:"dayGulikaSlot"`
	NightGulikaSlot  []int   `json:"nightGulikaSlot"`
	DhumaOffsetDeg   float64 `json:"dhumaOffsetDeg"`
	UpaketuOffsetDeg float64 `json:"upaketuOffsetDeg"`
	Sweep            []struct {
		Ms               int64           `json:"ms"`
		Loc              string          `json:"loc"`
		Ok               bool            `json:"ok"`
		Code             *string         `json:"code"`
		Day              bool            `json:"day"`
		ApparentCentreUp bool            `json:"apparentCentreUp"`
		SegmentStart     types.JSDate    `json:"segmentStart"`
		SegmentMidpoint  types.JSDate    `json:"segmentMidpoint"`
		Upagrahas        types.Upagrahas `json:"upagrahas"`
	} `json:"sweep"`
	OptAt      int64 `json:"optAt"`
	ByLanguage []struct {
		Language types.Language  `json:"language"`
		Result   types.Upagrahas `json:"result"`
	} `json:"byLanguage"`
	ByAyanamsa []struct {
		Ayanamsa types.AyanamsaType `json:"ayanamsa"`
		Result   types.Upagrahas    `json:"result"`
	} `json:"byAyanamsa"`
	Defaults     types.Upagrahas `json:"defaults"`
	WithPlacidus types.Upagrahas `json:"withPlacidus"`
}

func loadUpagrahaGolden(t *testing.T) upagrahaGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "upagrahas-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g upagrahaGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Sweep) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func upagrahaLoc(g upagrahaGolden, name string) types.GeoLocation {
	for _, l := range g.Locations {
		if l.Name == name {
			return types.GeoLocation{Latitude: l.Latitude, Longitude: l.Longitude}
		}
	}
	panic("unknown location " + name)
}

const upagrahaLonBound = 1e-9

func compareUpagrahas(t *testing.T, where string, got, want types.Upagrahas) float64 {
	t.Helper()
	worst := 0.0
	pairs := []struct {
		name      string
		got, want types.UpagrahaPosition
	}{
		{"gulika", got.Gulika, want.Gulika},
		{"mandi", got.Mandi, want.Mandi},
		{"dhuma", got.Dhuma, want.Dhuma},
		{"vyatipata", got.Vyatipata, want.Vyatipata},
		{"parivesha", got.Parivesha, want.Parivesha},
		{"indrachapa", got.Indrachapa, want.Indrachapa},
		{"upaketu", got.Upaketu, want.Upaketu},
	}
	for _, p := range pairs {
		d := math.Abs(p.got.Longitude - p.want.Longitude)
		if d > worst {
			worst = d
		}
		if d > upagrahaLonBound {
			t.Errorf("%s/%s: longitude %.17g, TypeScript %.17g (delta %g deg)",
				where, p.name, p.got.Longitude, p.want.Longitude, d)
		}
		if p.got.Rashi != p.want.Rashi {
			t.Errorf("%s/%s: rashi %d, TypeScript %d", where, p.name, p.got.Rashi, p.want.Rashi)
		}
		if p.got.RashiName != p.want.RashiName {
			t.Errorf("%s/%s: rashiName %q, TypeScript %q",
				where, p.name, p.got.RashiName, p.want.RashiName)
		}
		if p.got.House != p.want.House {
			t.Errorf("%s/%s: house %d, TypeScript %d", where, p.name, p.got.House, p.want.House)
		}
	}
	return worst
}

func TestUpagrahaConstantsMatchTypeScript(t *testing.T) {
	g := loadUpagrahaGolden(t)

	if dhumaOffsetDeg != g.DhumaOffsetDeg {
		t.Errorf("dhumaOffsetDeg = %.17g, TypeScript %.17g", dhumaOffsetDeg, g.DhumaOffsetDeg)
	}
	if upaketuOffsetDeg != g.UpaketuOffsetDeg {
		t.Errorf("upaketuOffsetDeg = %.17g, TypeScript %.17g", upaketuOffsetDeg, g.UpaketuOffsetDeg)
	}
	if dhumaOffsetDeg == 133 || upaketuOffsetDeg == 16 {
		t.Fatalf("an offset lost its arcminute term to integer division: dhuma %v, "+
			"upaketu %v", dhumaOffsetDeg, upaketuOffsetDeg)
	}
	var twenty, forty, sixty float64 = 20, 40, 60
	if want := 133 + twenty/sixty; dhumaOffsetDeg != want {
		t.Errorf("dhumaOffsetDeg folds to %.17g but two roundings give %.17g; the "+
			"constant needs to be computed at float64 precision", dhumaOffsetDeg, want)
	}
	if want := 16 + forty/sixty; upaketuOffsetDeg != want {
		t.Errorf("upaketuOffsetDeg folds to %.17g but two roundings give %.17g",
			upaketuOffsetDeg, want)
	}
}

func TestGulikaSlotsAreTheSharedTable(t *testing.T) {
	g := loadUpagrahaGolden(t)
	for i := 0; i < 7; i++ {
		if dayGulikaSlot[i] != g.DayGulikaSlot[i] {
			t.Errorf("dayGulikaSlot[%d] = %d, TypeScript %d", i, dayGulikaSlot[i], g.DayGulikaSlot[i])
		}
		if dayGulikaSlot[i] != utils.GulikaSlots[i] {
			t.Errorf("dayGulikaSlot[%d] = %d but utils.GulikaSlots[%d] = %d; the day "+
				"table is meant to *be* the shared one", i, dayGulikaSlot[i], i, utils.GulikaSlots[i])
		}
		if nightGulikaSlot[i] != g.NightGulikaSlot[i] {
			t.Errorf("nightGulikaSlot[%d] = %d, TypeScript %d",
				i, nightGulikaSlot[i], g.NightGulikaSlot[i])
		}
	}
	for _, tbl := range []struct {
		name string
		v    [7]int
	}{{"day", dayGulikaSlot}, {"night", nightGulikaSlot}} {
		seen := map[int]bool{}
		for i, v := range tbl.v {
			if v < 0 || v > 7 {
				t.Errorf("%sGulikaSlot[%d] = %d, outside the eight segments", tbl.name, i, v)
			}
			if seen[v] {
				t.Errorf("%sGulikaSlot has %d twice; each weekday puts Saturn in a "+
					"different segment", tbl.name, v)
			}
			seen[v] = true
		}
	}
}

func TestUpagrahasMatchTypeScript(t *testing.T) {
	g := loadUpagrahaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	var worst float64
	okN, failN, dayN, horizonDisagree := 0, 0, 0, 0

	for _, c := range g.Sweep {
		loc := upagrahaLoc(g, c.Loc)
		got, err := ComputeUpagrahas(ctx, c.Ms, loc, BirthChartOptions{})

		if !c.Ok {
			failN++
			if err == nil {
				t.Errorf("%s@%d: Go succeeded where the TypeScript threw %v",
					c.Loc, c.Ms, derefStr(c.Code))
				continue
			}
			var pe *types.PanchangError
			if !errors.As(err, &pe) {
				t.Errorf("%s@%d: error %v is not a PanchangError", c.Loc, c.Ms, err)
				continue
			}
			if c.Code != nil && string(pe.Code) != *c.Code {
				t.Errorf("%s@%d: code %s, TypeScript %s", c.Loc, c.Ms, pe.Code, *c.Code)
			}
			continue
		}

		if err != nil {
			t.Errorf("%s@%d: %v", c.Loc, c.Ms, err)
			continue
		}
		okN++
		if c.Day {
			dayN++
		}
		if c.Day != c.ApparentCentreUp {
			horizonDisagree++
		}

		seg, err := LocateGulikaSegmentForTest(ctx, c.Ms, loc)
		if err != nil {
			t.Errorf("%s@%d: segment: %v", c.Loc, c.Ms, err)
			continue
		}
		if seg.Start != c.SegmentStart.Ms() {
			t.Errorf("%s@%d: segment start %d, TypeScript %d (delta %d ms)",
				c.Loc, c.Ms, seg.Start, c.SegmentStart.Ms(), seg.Start-c.SegmentStart.Ms())
		}
		if seg.Midpoint != c.SegmentMidpoint.Ms() {
			t.Errorf("%s@%d: segment midpoint %d, TypeScript %d (delta %d ms)",
				c.Loc, c.Ms, seg.Midpoint, c.SegmentMidpoint.Ms(),
				seg.Midpoint-c.SegmentMidpoint.Ms())
		}

		if d := goGulikaDayFlag(t, ctx, c.Ms, loc); d != c.Day {
			t.Errorf("%s@%d: day-birth %v, TypeScript %v, and the whole slot table "+
				"differs from here down", c.Loc, c.Ms, d, c.Day)
		}

		if w := compareUpagrahas(t, c.Loc+"@"+itoa(int(c.Ms%1000000)), got, c.Upagrahas); w > worst {
			worst = w
		}
	}

	if failN == 0 {
		t.Error("no case exercised the polar error arm; the D7 propagation is untested")
	}
	if dayN == 0 || dayN == okN {
		t.Errorf("only one of the day/night arms was reached: %d day of %d ok", dayN, okN)
	}
	if horizonDisagree == 0 {
		t.Errorf("the segment-boundary flag and the apparent-centre flag agree on "+
			"all %d cases; the sweep no longer reaches the 65-404 s window #15 is "+
			"about, so the fix is untested here", okN)
	}
	t.Logf("%d cases: %d ok (%d day-births, %d night), %d polar failures, "+
		"%d where the pre-#15 apparent-centre horizon would have disagreed; "+
		"worst longitude delta %g deg (bound %g)",
		len(g.Sweep), okN, dayN, okN-dayN, failN, horizonDisagree, worst, upagrahaLonBound)
}

func derefStr(p *string) string {
	if p == nil {
		return "<nil>"
	}
	return *p
}

func TestUpagrahaSlotCoverage(t *testing.T) {
	g := loadUpagrahaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	daySlots, nightSlots := map[int]int{}, map[int]int{}
	dayVara, nightVara := map[int]int{}, map[int]int{}

	for _, c := range g.Sweep {
		if !c.Ok {
			continue
		}
		loc := upagrahaLoc(g, c.Loc)
		baseSunrise, err := findSunriseBeforeBirth(ctx, c.Ms, loc)
		if err != nil {
			continue
		}
		vara := types.Date(int64(float64(baseSunrise) +
			float64((loc.Longitude/15)*3600_000))).UTCDay()
		if c.Day {
			dayVara[vara]++
			daySlots[dayGulikaSlot[vara]]++
		} else {
			nightVara[vara]++
			nightSlots[nightGulikaSlot[vara]]++
		}
	}

	if len(dayVara) != 7 || len(nightVara) != 7 {
		t.Errorf("weekday coverage: %d of 7 in the day arm, %d of 7 in the night arm",
			len(dayVara), len(nightVara))
	}
	if len(daySlots) != 7 || len(nightSlots) != 7 {
		t.Errorf("slot coverage: %d of 7 day slots, %d of 7 night slots",
			len(daySlots), len(nightSlots))
	}
	t.Logf("day slots %v, night slots %v", daySlots, nightSlots)
}

func TestUpagrahaOptionArms(t *testing.T) {
	g := loadUpagrahaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	loc := upagrahaLoc(g, g.Locations[0].Name)

	names := map[string]bool{}
	for _, c := range g.ByLanguage {
		got, err := ComputeUpagrahas(ctx, g.OptAt, loc, BirthChartOptions{Language: c.Language})
		if err != nil {
			t.Fatalf("language %s: %v", c.Language, err)
		}
		compareUpagrahas(t, "lang/"+string(c.Language), got, c.Result)
		names[got.Gulika.RashiName] = true
	}
	if len(names) != len(g.ByLanguage) {
		t.Errorf("the %d languages produced %d distinct rashi names; the parameter "+
			"is not reaching resolveMasaName", len(g.ByLanguage), len(names))
	}

	lons := map[float64]bool{}
	for _, c := range g.ByAyanamsa {
		got, err := ComputeUpagrahas(ctx, g.OptAt, loc, BirthChartOptions{Ayanamsa: c.Ayanamsa})
		if err != nil {
			t.Fatalf("ayanamsa %s: %v", c.Ayanamsa, err)
		}
		compareUpagrahas(t, "ayanamsa/"+string(c.Ayanamsa), got, c.Result)
		lons[got.Dhuma.Longitude] = true
	}
	if len(lons) < 2 {
		t.Error("every ayanamsa produced the same Dhuma; the parameter is not reaching " +
			"getSiderealSunLongitude")
	}

	def, err := ComputeUpagrahas(ctx, g.OptAt, loc, BirthChartOptions{})
	if err != nil {
		t.Fatalf("defaults: %v", err)
	}
	compareUpagrahas(t, "defaults", def, g.Defaults)

	plac, err := ComputeUpagrahas(ctx, g.OptAt, loc,
		BirthChartOptions{HouseSystem: types.HouseSystemPlacidusKP})
	if err != nil {
		t.Fatalf("placidus-kp: %v", err)
	}
	compareUpagrahas(t, "placidus-kp", plac, g.WithPlacidus)
	if plac.Gulika.House != def.Gulika.House {
		t.Errorf("houseSystem changed Gulika's house from %d to %d; it is documented "+
			"as ignored", def.Gulika.House, plac.Gulika.House)
	}
}

func TestGulikaSunriseHelperMatchesLagnas(t *testing.T) {
	g := loadUpagrahaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	checked := 0
	for _, c := range g.Sweep {
		if !c.Ok {
			continue
		}
		loc := upagrahaLoc(g, c.Loc)
		a, errA := findSunriseBeforeBirth(ctx, c.Ms, loc)
		b, errB := findSunriseBefore(ctx, c.Ms, loc)
		if (errA == nil) != (errB == nil) {
			t.Errorf("%s@%d: one helper errored and the other did not (%v / %v)",
				c.Loc, c.Ms, errA, errB)
			continue
		}
		if errA != nil {
			continue
		}
		if a != b {
			t.Errorf("%s@%d: upagrahas.findSunriseBeforeBirth gives %d, "+
				"lagna.findSunriseBefore gives %d (delta %d ms). They are meant to "+
				"be the same function; one of the two TypeScript copies has moved",
				c.Loc, c.Ms, a, b, a-b)
		}
		checked++
	}
	if checked == 0 {
		t.Fatal("no case was checked")
	}
	t.Logf("the two sunrise helpers agree on all %d cases", checked)
}

func goGulikaDayFlag(t *testing.T, ctx *astronomy.EphemerisCtx, ms int64, loc types.GeoLocation) bool {
	t.Helper()
	sunrise, err := findSunriseBeforeBirth(ctx, ms, loc)
	if err != nil {
		t.Fatalf("sunrise before %d: %v", ms, err)
	}
	sunset, err := astronomy.ComputeSunset(ctx, sunrise, loc, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		t.Fatalf("sunset after %d: %v", sunrise, err)
	}
	return ms < sunset
}

func TestGulikaNightBranchIsNowUnreachable(t *testing.T) {
	g := loadUpagrahaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	nightCases, beforeSunset := 0, 0

	for _, c := range g.Sweep {
		if !c.Ok || c.Day {
			continue
		}
		nightCases++
		loc := upagrahaLoc(g, c.Loc)
		priorSunrise, err := findSunriseBeforeBirth(ctx, c.Ms, loc)
		if err != nil {
			continue
		}
		priorSunset, err := astronomy.ComputeSunset(ctx, priorSunrise, loc, astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			continue
		}
		if c.Ms < priorSunset {
			beforeSunset++
			t.Errorf("%s@%s entered the night arm while before its own sunset (%s). "+
				"Since the #15 fix that is impossible: `day` is `birthMs < "+
				"baseSunset` and this priorSunset is that same baseSunset",
				c.Loc, types.Date(c.Ms).ISOString(), types.Date(priorSunset).ISOString())
		}
		arm1Next, err1 := astronomy.ComputeSunrise(ctx, priorSunset+60_000, loc, astronomy.DefaultRiseSetLimitDays)
		arm2Next, err2 := astronomy.ComputeSunrise(ctx, priorSunset+60_000, loc, astronomy.DefaultRiseSetLimitDays)
		if (err1 == nil) != (err2 == nil) || (err1 == nil && arm1Next != arm2Next) {
			t.Errorf("%s@%d: the two night arms no longer compute the same values",
				c.Loc, c.Ms)
		}
	}
	if nightCases == 0 {
		t.Fatal("no night case in the sweep")
	}
	t.Logf("%d night cases, %d entered the birth-before-sunset arm (0 expected "+
		"since the #15 fix; it was 2 before)", nightCases, beforeSunset)
}

func TestGulikaSegmentSunsetIsComputedOnce(t *testing.T) {
	g := loadUpagrahaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	checked := 0
	for _, c := range g.Sweep {
		if !c.Ok {
			continue
		}
		loc := upagrahaLoc(g, c.Loc)
		sunrise, err := findSunriseBeforeBirth(ctx, c.Ms, loc)
		if err != nil {
			continue
		}
		a, errA := astronomy.ComputeSunset(ctx, sunrise, loc, astronomy.DefaultRiseSetLimitDays)
		b, errB := astronomy.ComputeSunset(ctx, sunrise, loc, astronomy.DefaultRiseSetLimitDays)
		if (errA == nil) != (errB == nil) || (errA == nil && a != b) {
			t.Errorf("%s@%d: computeSunset is not deterministic (%d/%v vs %d/%v)",
				c.Loc, c.Ms, a, errA, b, errB)
		}
		checked++
	}
	if checked == 0 {
		t.Fatal("no case was checked")
	}
	t.Logf("computeSunset is deterministic on all %d cases, so the port's single "+
		"call stands in for the TypeScript's two", checked)
}

func TestSunDerivedUpagrahasAreAlgebraicallyChained(t *testing.T) {
	g := loadUpagrahaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	const tol = 1e-9
	checked := 0

	for _, c := range g.Sweep {
		if !c.Ok {
			continue
		}
		u, err := ComputeUpagrahas(ctx, c.Ms, upagrahaLoc(g, c.Loc), BirthChartOptions{})
		if err != nil {
			continue
		}
		sun, err := astronomy.GetSiderealSunLongitude(ctx, c.Ms, "lahiri")
		if err != nil {
			continue
		}
		checked++
		for _, chk := range []struct {
			name      string
			got, want float64
		}{
			{"dhuma = Sun + 133°20'", u.Dhuma.Longitude, utils.Normalize360(sun + dhumaOffsetDeg)},
			{"vyatipata = 360 − dhuma", u.Vyatipata.Longitude, utils.Normalize360(360 - u.Dhuma.Longitude)},
			{"parivesha = vyatipata + 180", u.Parivesha.Longitude, utils.Normalize360(u.Vyatipata.Longitude + 180)},
			{"indrachapa = 360 − parivesha", u.Indrachapa.Longitude, utils.Normalize360(360 - u.Parivesha.Longitude)},
			{"upaketu = indrachapa + 16°40'", u.Upaketu.Longitude, utils.Normalize360(u.Indrachapa.Longitude + upaketuOffsetDeg)},
			{"indrachapa = dhuma − 180", u.Indrachapa.Longitude, utils.Normalize360(u.Dhuma.Longitude - 180)},
			{"parivesha = 180 − dhuma", u.Parivesha.Longitude, utils.Normalize360(180 - u.Dhuma.Longitude)},
		} {
			if d := math.Abs(chk.got - chk.want); d > tol {
				t.Errorf("%s@%d: %s (%.17g vs %.17g, delta %g)",
					c.Loc, c.Ms, chk.name, chk.got, chk.want, d)
			}
		}
	}
	if checked == 0 {
		t.Fatal("no case was checked")
	}
	t.Logf("the five Sun-derived identities hold on all %d cases", checked)
}
