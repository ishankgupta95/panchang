package astronomy

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type eclipseGolden struct {
	Meta       map[string]any `json:"_meta"`
	LunarSeeds []int64        `json:"lunarSeeds"`
	SolarSeeds []int64        `json:"solarSeeds"`
	Sites      []struct {
		Name      string  `json:"name"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		Elevation float64 `json:"elevation"`
	} `json:"sites"`
	Shadows []struct {
		Ms               int64   `json:"ms"`
		Separation       float64 `json:"separation"`
		Umbra            float64 `json:"umbra"`
		Penumbra         float64 `json:"penumbra"`
		MoonSemidiameter float64 `json:"moonSemidiameter"`
	} `json:"shadows"`
	Views []struct {
		Site             string  `json:"site"`
		Ms               int64   `json:"ms"`
		Separation       float64 `json:"separation"`
		SunSemidiameter  float64 `json:"sunSemidiameter"`
		MoonSemidiameter float64 `json:"moonSemidiameter"`
		SunAltitude      float64 `json:"sunAltitude"`
		SunAzimuth       float64 `json:"sunAzimuth"`
	} `json:"views"`
	Obscurations []struct {
		Separation float64 `json:"separation"`
		Disc       float64 `json:"disc"`
		Cover      float64 `json:"cover"`
		Value      float64 `json:"value"`
	} `json:"obscurations"`
	Lunar []struct {
		Seed       int64  `json:"seed"`
		Opposition *int64 `json:"opposition"`
		Eclipse    *struct {
			Kind               string  `json:"kind"`
			Peak               int64   `json:"peak"`
			PenumbralBegin     int64   `json:"penumbralBegin"`
			PenumbralEnd       int64   `json:"penumbralEnd"`
			PartialBegin       *int64  `json:"partialBegin"`
			PartialEnd         *int64  `json:"partialEnd"`
			TotalBegin         *int64  `json:"totalBegin"`
			TotalEnd           *int64  `json:"totalEnd"`
			PenumbralMagnitude float64 `json:"penumbralMagnitude"`
			UmbralMagnitude    float64 `json:"umbralMagnitude"`
			UmbralObscuration  float64 `json:"umbralObscuration"`
		} `json:"eclipse"`
	} `json:"lunar"`
	Solar []struct {
		Site        string `json:"site"`
		Seed        int64  `json:"seed"`
		Conjunction *int64 `json:"conjunction"`
		Eclipse     *struct {
			Kind          string  `json:"kind"`
			Peak          int64   `json:"peak"`
			PartialBegin  int64   `json:"partialBegin"`
			PartialEnd    int64   `json:"partialEnd"`
			CentralBegin  *int64  `json:"centralBegin"`
			CentralEnd    *int64  `json:"centralEnd"`
			Obscuration   float64 `json:"obscuration"`
			Magnitude     float64 `json:"magnitude"`
			PeakAltitude  float64 `json:"peakAltitude"`
			BeginAltitude float64 `json:"beginAltitude"`
			EndAltitude   float64 `json:"endAltitude"`
			PeakAzimuth   float64 `json:"peakAzimuth"`
		} `json:"eclipse"`
	} `json:"solar"`
	Published []struct {
		Fn   string           `json:"fn"`
		Lang string           `json:"lang"`
		Site string           `json:"site"`
		Seed int64            `json:"seed"`
		Info *eclipseInfoJSON `json:"info"`
	} `json:"published"`
	DuringDay []struct {
		Site    string           `json:"site"`
		Sunrise int64            `json:"sunrise"`
		Info    *eclipseInfoJSON `json:"info"`
	} `json:"duringDay"`
	Horizon []struct {
		Site string `json:"site"`
		Ms   int64  `json:"ms"`
		Sun  bool   `json:"sun"`
		Moon bool   `json:"moon"`
	} `json:"horizon"`
	AnyPhase []struct {
		Site    string `json:"site"`
		Seed    int64  `json:"seed"`
		Visible *bool  `json:"visible"`
	} `json:"anyPhase"`
}

type eclipseInfoJSON struct {
	Kind                string  `json:"kind"`
	Subtype             string  `json:"subtype"`
	Start               int64   `json:"start"`
	Peak                int64   `json:"peak"`
	End                 int64   `json:"end"`
	VisibleFromLocation bool    `json:"visibleFromLocation"`
	Obscuration         float64 `json:"obscuration"`
	Magnitude           float64 `json:"magnitude"`
	SutakStart          *int64  `json:"sutakStart"`
	SutakEnd            *int64  `json:"sutakEnd"`
	Description         string  `json:"description"`
}

func loadEclipseGolden(t *testing.T) eclipseGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "astronomy", "eclipse-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v (regenerate with `bash go/parity/goldens.sh`)", err)
	}
	var g eclipseGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

func (g eclipseGolden) siteByName(t *testing.T, name string) types.GeoLocation {
	t.Helper()
	for _, s := range g.Sites {
		if s.Name == name {
			return types.GeoLocation{Latitude: s.Latitude, Longitude: s.Longitude, Elevation: s.Elevation}
		}
	}
	t.Fatalf("golden names site %q, which is not in its own site list", name)
	return types.GeoLocation{}
}

func TestEclipseGeometryWithinBound(t *testing.T) {
	const angleBound = 1e-11
	const obscurationBound = 1e-14
	g := loadEclipseGolden(t)
	ctx := NewEphemerisCtx()

	worstAngle, worstAngleAt := 0.0, ""
	for _, c := range g.Shadows {
		s := LunarShadowAt(ctx, c.Ms)
		for _, p := range []struct {
			name      string
			got, want float64
		}{
			{"separation", s.Separation, c.Separation},
			{"umbra", s.Umbra, c.Umbra},
			{"penumbra", s.Penumbra, c.Penumbra},
			{"moonSemidiameter", s.MoonSemidiameter, c.MoonSemidiameter},
		} {
			if d := math.Abs(p.got - p.want); d > worstAngle {
				worstAngle, worstAngleAt = d, "lunarShadow."+p.name
			}
		}
	}
	for _, c := range g.Views {
		v := SolarViewAt(ctx, c.Ms, g.siteByName(t, c.Site))
		for _, p := range []struct {
			name      string
			got, want float64
		}{
			{"separation", v.Separation, c.Separation},
			{"sunSemidiameter", v.SunSemidiameter, c.SunSemidiameter},
			{"moonSemidiameter", v.MoonSemidiameter, c.MoonSemidiameter},
			{"sunAltitude", v.SunAltitude, c.SunAltitude},
			{"sunAzimuth", v.SunAzimuth, c.SunAzimuth},
		} {
			if d := math.Abs(p.got - p.want); d > worstAngle {
				worstAngle, worstAngleAt = d, "solarView."+p.name
			}
		}
	}
	if worstAngle > angleBound {
		t.Errorf("worst geometry |Δ| %.4e deg (%s), bound %.0e", worstAngle, worstAngleAt, angleBound)
	}

	worstObsc := 0.0
	nonTrivial := 0
	for _, c := range g.Obscurations {
		got := DiscObscuration(c.Separation, c.Disc, c.Cover)
		if got > 0 && got < 1 {
			nonTrivial++
		}
		if d := math.Abs(got - c.Value); d > worstObsc {
			worstObsc = d
		}
	}
	if worstObsc > obscurationBound {
		t.Errorf("worst discObscuration |Δ| %.4e, bound %.0e", worstObsc, obscurationBound)
	}
	if nonTrivial < 20 {
		t.Errorf("only %d of %d obscuration cases exercise the overlap formula",
			nonTrivial, len(g.Obscurations))
	}
	t.Logf("%d shadows + %d views: worst %.4e deg (%s); %d obscurations, worst %.4e (%d non-trivial)",
		len(g.Shadows), len(g.Views), worstAngle, worstAngleAt, len(g.Obscurations), worstObsc, nonTrivial)
}

func TestEclipseSearchesMatchTypeScript(t *testing.T) {
	const instantBoundMs = 2
	const magnitudeBound = 1e-11

	g := loadEclipseGolden(t)
	ctx := NewEphemerisCtx()

	worstMs, worstMsAt := int64(0), ""
	worstMag, worstMagAt := 0.0, ""
	exactInstants, totalInstants := 0, 0
	cmpMs := func(got, want int64, what string) {
		totalInstants++
		if got == want {
			exactInstants++
			return
		}
		if d := abs64(got - want); d > worstMs {
			worstMs, worstMsAt = d, what
		}
	}
	cmpF := func(got, want float64, what string) {
		if d := math.Abs(got - want); d > worstMag {
			worstMag, worstMagAt = d, what
		}
	}
	cmpPtr := func(got *int64, want *int64, what string) {
		if (got == nil) != (want == nil) {
			t.Errorf("%s: Go %v, TS %v: one is absent and the other is not", what, got, want)
			return
		}
		if got != nil {
			cmpMs(*got, *want, what)
		}
	}

	found, absent := 0, 0
	for _, c := range g.Lunar {
		opposition, ok := SearchMoonPhase(ctx, 180, c.Seed-3*dayMS, 8)
		if (c.Opposition == nil) != !ok {
			t.Errorf("lunar seed %d: opposition presence differs", c.Seed)
			continue
		}
		if !ok {
			continue
		}
		cmpMs(opposition, *c.Opposition, "lunar opposition")
		e, gotOK := FindLunarEclipse(ctx, opposition)
		if (c.Eclipse == nil) == gotOK {
			t.Errorf("lunar seed %d: Go found=%v, TS found=%v", c.Seed, gotOK, c.Eclipse != nil)
			continue
		}
		if !gotOK {
			absent++
			continue
		}
		found++
		w := c.Eclipse
		if string(e.Kind) != w.Kind {
			t.Errorf("lunar seed %d: kind %s vs %s", c.Seed, e.Kind, w.Kind)
		}
		cmpMs(e.PeakMs, w.Peak, "lunar peak")
		cmpMs(e.PenumbralBeginMs, w.PenumbralBegin, "lunar P1")
		cmpMs(e.PenumbralEndMs, w.PenumbralEnd, "lunar P4")
		cmpPtr(e.PartialBeginMs, w.PartialBegin, "lunar U1")
		cmpPtr(e.PartialEndMs, w.PartialEnd, "lunar U4")
		cmpPtr(e.TotalBeginMs, w.TotalBegin, "lunar U2")
		cmpPtr(e.TotalEndMs, w.TotalEnd, "lunar U3")
		cmpF(e.PenumbralMagnitude, w.PenumbralMagnitude, "lunar penumbralMagnitude")
		cmpF(e.UmbralMagnitude, w.UmbralMagnitude, "lunar umbralMagnitude")
		cmpF(e.UmbralObscuration, w.UmbralObscuration, "lunar umbralObscuration")
	}

	for _, c := range g.Solar {
		site := g.siteByName(t, c.Site)
		conjunction, ok := SearchMoonPhase(ctx, 0, c.Seed-2*dayMS, 5)
		if !ok {
			if c.Conjunction != nil {
				t.Errorf("solar %s %d: Go found no conjunction", c.Site, c.Seed)
			}
			continue
		}
		cmpMs(conjunction, *c.Conjunction, "solar conjunction")
		e, gotOK := FindLocalSolarEclipse(ctx, conjunction, site)
		if (c.Eclipse == nil) == gotOK {
			t.Errorf("solar %s %d: Go found=%v, TS found=%v", c.Site, c.Seed, gotOK, c.Eclipse != nil)
			continue
		}
		if !gotOK {
			absent++
			continue
		}
		found++
		w := c.Eclipse
		if string(e.Kind) != w.Kind {
			t.Errorf("solar %s %d: kind %s vs %s", c.Site, c.Seed, e.Kind, w.Kind)
		}
		cmpMs(e.PeakMs, w.Peak, "solar peak")
		cmpMs(e.PartialBeginMs, w.PartialBegin, "solar C1")
		cmpMs(e.PartialEndMs, w.PartialEnd, "solar C4")
		cmpPtr(e.CentralBeginMs, w.CentralBegin, "solar C2")
		cmpPtr(e.CentralEndMs, w.CentralEnd, "solar C3")
		cmpF(e.Obscuration, w.Obscuration, "solar obscuration")
		cmpF(e.Magnitude, w.Magnitude, "solar magnitude")
		cmpF(e.PeakAltitude, w.PeakAltitude, "solar peakAltitude")
		cmpF(e.BeginAltitude, w.BeginAltitude, "solar beginAltitude")
		cmpF(e.EndAltitude, w.EndAltitude, "solar endAltitude")
		cmpF(e.PeakAzimuth, w.PeakAzimuth, "solar peakAzimuth")
	}

	if found == 0 || absent == 0 {
		t.Fatalf("the sample covered only one outcome: %d eclipses found, %d absent", found, absent)
	}
	if worstMs > instantBoundMs {
		t.Errorf("worst instant |Δ| %d ms (%s), bound %d", worstMs, worstMsAt, instantBoundMs)
	}
	if worstMag > magnitudeBound {
		t.Errorf("worst magnitude |Δ| %.4e (%s), bound %.0e", worstMag, worstMagAt, magnitudeBound)
	}
	t.Logf("%d eclipses found, %d correctly absent; %d of %d instants bit-identical, "+
		"worst %d ms (%s); worst magnitude %.4e (%s)",
		found, absent, exactInstants, totalInstants, worstMs, worstMsAt, worstMag, worstMagAt)
}

func TestPublishedEclipseFieldsMatchTypeScript(t *testing.T) {
	g := loadEclipseGolden(t)
	ctx := NewEphemerisCtx()

	langs := map[string]types.Language{"en": types.LanguageEn, "hi": types.LanguageHi}
	nonNil, nils, hiChecked := 0, 0, 0
	worstMs, worstMag := int64(0), 0.0

	check := func(got EclipseInfo, gotOK bool, want *eclipseInfoJSON, label string) {
		if (want == nil) == gotOK {
			t.Errorf("%s: Go found=%v, TS found=%v", label, gotOK, want != nil)
			return
		}
		if !gotOK {
			nils++
			return
		}
		nonNil++
		if string(got.Kind) != want.Kind || string(got.Subtype) != want.Subtype {
			t.Errorf("%s: {%s,%s} vs {%s,%s}", label, got.Kind, got.Subtype, want.Kind, want.Subtype)
		}
		for _, p := range []struct {
			got, want int64
		}{{got.StartMs.Ms(), want.Start}, {got.PeakMs.Ms(), want.Peak}, {got.EndMs.Ms(), want.End}} {
			if d := abs64(p.got - p.want); d > worstMs {
				worstMs = d
			}
		}
		if got.VisibleFromLocation != want.VisibleFromLocation {
			t.Errorf("%s: visibleFromLocation %v vs %v", label, got.VisibleFromLocation, want.VisibleFromLocation)
		}
		if d := math.Abs(got.Obscuration - want.Obscuration); d > worstMag {
			worstMag = d
		}
		if d := math.Abs(got.Magnitude - want.Magnitude); d > worstMag {
			worstMag = d
		}
		for _, p := range []struct {
			got  *types.JSDate
			want *int64
			name string
		}{{got.SutakStartMs, want.SutakStart, "sutakStart"}, {got.SutakEndMs, want.SutakEnd, "sutakEnd"}} {
			if (p.got == nil) != (p.want == nil) {
				t.Errorf("%s %s: Go %v, TS %v", label, p.name, p.got, p.want)
				continue
			}
			if p.got != nil {
				if d := abs64(p.got.Ms() - *p.want); d > worstMs {
					worstMs = d
				}
			}
		}
		if got.Description != want.Description {
			t.Errorf("%s description:\n  Go %q\n  TS %q", label, got.Description, want.Description)
		}
	}

	for _, c := range g.Published {
		site := g.siteByName(t, c.Site)
		lang := langs[c.Lang]
		if c.Lang == "hi" && c.Info != nil {
			hiChecked++
		}
		if c.Fn == "lunar" {
			info, ok := GetUpcomingLunarEclipse(ctx, c.Seed-3*dayMS, site, 6, lang)
			check(info, ok, c.Info, "lunar "+c.Site+" "+c.Lang)
		} else {
			info, ok := GetUpcomingSolarEclipse(ctx, c.Seed-2*dayMS, site, 5, lang)
			check(info, ok, c.Info, "solar "+c.Site+" "+c.Lang)
		}
	}

	for _, c := range g.DuringDay {
		site := g.siteByName(t, c.Site)
		info, ok := GetEclipseDuringDay(ctx, c.Sunrise, c.Sunrise+dayMS, site,
			types.LanguageEn, DirectLongitudes(ctx))
		check(info, ok, c.Info, "duringDay "+c.Site)
	}

	if nonNil == 0 || nils == 0 {
		t.Fatalf("only one outcome covered: %d found, %d absent", nonNil, nils)
	}
	if hiChecked == 0 {
		t.Error("no Hindi description was compared; the Devanagari is unpinned")
	}
	if worstMs > 2 {
		t.Errorf("worst published instant |Δ| %d ms, bound 2", worstMs)
	}
	if worstMag > 1e-11 {
		t.Errorf("worst published magnitude |Δ| %.4e, bound 1e-11", worstMag)
	}
	t.Logf("%d eclipses published, %d correctly absent, %d Hindi descriptions exact; "+
		"worst instant %d ms, worst magnitude %.4e", nonNil, nils, hiChecked, worstMs, worstMag)
}

func TestEclipseHorizonHelpersMatchTypeScript(t *testing.T) {
	g := loadEclipseGolden(t)
	ctx := NewEphemerisCtx()
	trueCount, falseCount := 0, 0
	for _, c := range g.Horizon {
		site := g.siteByName(t, c.Site)
		if got := IsBodyAboveHorizon(ctx, c.Ms, site, HorizonSun); got != c.Sun {
			t.Errorf("isBodyAboveHorizon(sun, %s, %d) = %v, TS %v", c.Site, c.Ms, got, c.Sun)
		}
		if got := IsBodyAboveHorizon(ctx, c.Ms, site, HorizonMoon); got != c.Moon {
			t.Errorf("isBodyAboveHorizon(moon, %s, %d) = %v, TS %v", c.Site, c.Ms, got, c.Moon)
		}
		if c.Sun {
			trueCount++
		} else {
			falseCount++
		}
	}
	if trueCount == 0 || falseCount == 0 {
		t.Fatalf("the horizon sample is one-sided: %d above, %d below", trueCount, falseCount)
	}

	visibleCount := 0
	for _, c := range g.AnyPhase {
		site := g.siteByName(t, c.Site)
		info, ok := GetUpcomingLunarEclipse(ctx, c.Seed-3*dayMS, site, 6, types.LanguageEn)
		if (c.Visible == nil) == ok {
			t.Errorf("anyPhase %s %d: Go found=%v, TS found=%v", c.Site, c.Seed, ok, c.Visible != nil)
			continue
		}
		if !ok {
			continue
		}
		if got := IsEclipseVisibleAnyPhase(ctx, info, site); got != *c.Visible {
			t.Errorf("isEclipseVisibleAnyPhase(%s, %d) = %v, TS %v", c.Site, c.Seed, got, *c.Visible)
		}
		if *c.Visible {
			visibleCount++
		}
		if info.VisibleFromLocation && !*c.Visible {
			t.Errorf("%s %d: visible at peak but not during any phase", c.Site, c.Seed)
		}
	}
	t.Logf("%d horizon probes (%d above, %d below) and %d any-phase checks (%d visible), all exact",
		len(g.Horizon), trueCount, falseCount, len(g.AnyPhase), visibleCount)
}
