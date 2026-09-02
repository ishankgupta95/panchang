package core

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

type dfFestival struct {
	Key         string             `json:"key"`
	Type        types.FestivalType `json:"type"`
	Description *string            `json:"description"`
}

type dfCase struct {
	Label       string       `json:"label"`
	Sunrise     *int64       `json:"sunrise"`
	Sunset      *int64       `json:"sunset"`
	NextSunrise *int64       `json:"nextSunrise"`
	Anchors     []int64      `json:"anchors"`
	Festivals   []dfFestival `json:"festivals"`
	Outcome     string       `json:"outcome"`
}

type dfLocation struct {
	Name      string  `json:"name"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timezone  string  `json:"timezone"`
	From      [3]int  `json:"from"`
	Days      int     `json:"days"`
}

type dayFestivalsGolden struct {
	Meta struct {
		Claim string `json:"claim"`
	} `json:"_meta"`
	Locations     []dfLocation   `json:"locations"`
	Regions       []string       `json:"regions"`
	TotalDays     int            `json:"totalDays"`
	EmittingDays  int            `json:"emittingDays"`
	Digest        string         `json:"digest"`
	AnchorDigest  string         `json:"anchorDigest"`
	OutcomeCounts map[string]int `json:"outcomeCounts"`
	PolarHits     map[string]int `json:"polarHits"`
	KeyCounts     map[string]int `json:"keyCounts"`
	TypeCounts    map[string]int `json:"typeCounts"`
	Cases         []dfCase       `json:"cases"`
}

func loadDayFestivalsGolden(t *testing.T) dayFestivalsGolden {
	t.Helper()
	raw, err := repopath.ReadTestData("goldens", "core", "dayfestivals-golden.json")
	if err != nil {
		t.Fatalf("reading dayfestivals-golden.json: %v", err)
	}
	var g dayFestivalsGolden
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatalf("parsing dayfestivals-golden.json: %v", err)
	}
	if g.TotalDays == 0 || len(g.Cases) == 0 {
		t.Fatalf("golden is empty: %d days, %d cases", g.TotalDays, len(g.Cases))
	}
	return g
}

func dfRun(loc dfLocation, ms int64, region string) dfCase {
	geo := types.GeoLocation{Latitude: loc.Latitude, Longitude: loc.Longitude}
	label := fmt.Sprintf("%s|%s|%s", loc.Name, types.Date(ms).ISOString()[:10], region)
	ctx := &astronomy.EphemerisCtx{}

	r, ok, err := GetDailyPanchang(ctx, ms, geo, PanchangOptions{
		Timezone:      types.TimezoneName(loc.Timezone),
		Sections:      Sections(SectionFestivals),
		SectionsGiven: true,
		InstantPanchangOptions: InstantPanchangOptions{
			Region: types.FestivalRegion(region),
		},
	}, NatalResolvers{})
	switch {
	case err != nil:
		code := "THROW"
		var pe *types.PanchangError
		if errors.As(err, &pe) {
			code = string(pe.Code)
		}
		return dfCase{Label: label, Outcome: "error:" + code}
	case !ok:
		return dfCase{Label: label, Outcome: "null"}
	}

	offset, err := utils.ResolveUtcOffset(types.TimezoneName(loc.Timezone), ms)
	if err != nil {
		return dfCase{Label: label, Outcome: "error:OFFSET"}
	}
	sunrise, err := astronomy.ComputeSunrise(ctx, utils.GetLocalMidnightUtc(ms, offset), geo,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return dfCase{Label: label, Outcome: "error:TRIPLE"}
	}
	sunset, err := astronomy.ComputeSunset(ctx, sunrise, geo, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return dfCase{Label: label, Outcome: "error:TRIPLE"}
	}
	nextSunrise, err := astronomy.ComputeSunrise(ctx, sunset, geo, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return dfCase{Label: label, Outcome: "error:TRIPLE"}
	}
	a := computeKalaAnchors(sunrise, sunset, nextSunrise)

	out := dfCase{
		Label: label, Sunrise: &sunrise, Sunset: &sunset, NextSunrise: &nextSunrise,
		Anchors: []int64{
			a.Madhyahna, a.Aparahna, a.Pradosha, a.Nishita, a.Arunodaya,
			a.MadhyahnaStart, a.AparahnaStart, a.PradoshaStart, a.NishitaStart,
		},
		Festivals: make([]dfFestival, 0, len(r.Festivals)),
		Outcome:   "ok",
	}
	for _, f := range r.Festivals {
		d := f.Description
		var dp *string
		if d != "" {
			dp = &d
		}
		out.Festivals = append(out.Festivals, dfFestival{Key: f.Key, Type: f.Type, Description: dp})
	}
	return out
}

func TestDayFestivalsMatchTypeScript(t *testing.T) {
	g := loadDayFestivalsGolden(t)

	h := sha256.New()
	ah := sha256.New()
	keyCounts := map[string]int{}
	typeCounts := map[string]int{}
	outcomeCounts := map[string]int{}
	byLabel := map[string]dfCase{}
	totalDays, emittingDays := 0, 0

	for _, loc := range g.Locations {
		base := types.DateUTC(loc.From[0], loc.From[1], loc.From[2]).Ms() + 6*3600_000
		regions := []string{"all"}
		if loc.Days <= 40 {
			regions = g.Regions
		}
		for i := 0; i < loc.Days; i++ {
			ms := base + int64(i)*86_400_000
			for _, region := range regions {
				totalDays++
				out := dfRun(loc, ms, region)
				outcomeCounts[out.Outcome]++
				if len(out.Festivals) > 0 {
					emittingDays++
				}
				for _, f := range out.Festivals {
					keyCounts[f.Key]++
					typeCounts[string(f.Type)]++
				}

				fmt.Fprintf(h, "%s %s ", out.Label, out.Outcome)
				for _, f := range out.Festivals {
					desc := ""
					if f.Description != nil {
						desc = *f.Description
					}
					fmt.Fprintf(h, "%s|%s|%s;", f.Key, f.Type, desc)
				}
				if out.Anchors != nil {
					fmt.Fprintf(ah, "%s %d %d %d ", out.Label, *out.Sunrise, *out.Sunset, *out.NextSunrise)
					for _, v := range out.Anchors {
						fmt.Fprintf(ah, "%d,", v)
					}
				}
				byLabel[out.Label] = out
			}
		}
	}

	if totalDays != g.TotalDays {
		t.Errorf("swept %d days, golden swept %d: the two sides are not running the same sweep",
			totalDays, g.TotalDays)
	}
	if emittingDays != g.EmittingDays {
		t.Errorf("emitting days = %d, want %d", emittingDays, g.EmittingDays)
	}
	if got := hex.EncodeToString(h.Sum(nil)); got != g.Digest {
		t.Errorf("festival digest = %s, want %s", got, g.Digest)
	}
	if got := hex.EncodeToString(ah.Sum(nil)); got != g.AnchorDigest {
		t.Errorf("anchor digest = %s, want %s\n"+
			"The nine kala anchors are integer quotients truncated by `new Date` plus one\n"+
			"float multiply feeding an addition. Check the FMA barrier on NishitaStart and\n"+
			"the sign assumptions on the integer divisions before anything else.",
			got, g.AnchorDigest)
	}

	compareCountMaps(t, "outcome", outcomeCounts, g.OutcomeCounts)
	compareCountMaps(t, "type", typeCounts, g.TypeCounts)
	compareCountMaps(t, "key", keyCounts, g.KeyCounts)

	mismatches := 0
	for _, want := range g.Cases {
		got, ok := byLabel[want.Label]
		if !ok {
			t.Errorf("golden case %q was not produced by the Go sweep", want.Label)
			continue
		}
		if diff := dfDiff(got, want); diff != "" {
			if mismatches++; mismatches <= 20 {
				t.Errorf("%s: %s", want.Label, diff)
			}
		}
	}
	if mismatches > 20 {
		t.Errorf("... and %d more mismatched cases", mismatches-20)
	}
	t.Logf("%d days swept, %d emitting, %d distinct keys, %d explicit cases compared",
		totalDays, emittingDays, len(keyCounts), len(g.Cases))
}

func dfDiff(got, want dfCase) string {
	if got.Outcome != want.Outcome {
		return fmt.Sprintf("outcome %q, want %q", got.Outcome, want.Outcome)
	}
	if want.Outcome != "ok" {
		return ""
	}
	if *got.Sunrise != *want.Sunrise || *got.Sunset != *want.Sunset ||
		*got.NextSunrise != *want.NextSunrise {
		return fmt.Sprintf("triple (%d, %d, %d), want (%d, %d, %d)",
			*got.Sunrise, *got.Sunset, *got.NextSunrise,
			*want.Sunrise, *want.Sunset, *want.NextSunrise)
	}
	for i := range want.Anchors {
		if got.Anchors[i] != want.Anchors[i] {
			return fmt.Sprintf("anchor[%d] = %d, want %d (delta %d ms)",
				i, got.Anchors[i], want.Anchors[i], got.Anchors[i]-want.Anchors[i])
		}
	}
	if len(got.Festivals) != len(want.Festivals) {
		return fmt.Sprintf("%d festivals %v, want %d %v",
			len(got.Festivals), dfKeys(got.Festivals), len(want.Festivals), dfKeys(want.Festivals))
	}
	for i := range want.Festivals {
		gf, wf := got.Festivals[i], want.Festivals[i]
		if gf.Key != wf.Key || gf.Type != wf.Type {
			return fmt.Sprintf("festival[%d] = %s/%s, want %s/%s", i, gf.Key, gf.Type, wf.Key, wf.Type)
		}
		gd, wd := "", ""
		if gf.Description != nil {
			gd = *gf.Description
		}
		if wf.Description != nil {
			wd = *wf.Description
		}
		if gd != wd {
			return fmt.Sprintf("festival[%d] %s description %q, want %q", i, gf.Key, gd, wd)
		}
	}
	return ""
}

func dfKeys(fs []dfFestival) []string {
	out := make([]string, 0, len(fs))
	for _, f := range fs {
		out = append(out, f.Key)
	}
	return out
}

func compareCountMaps(t *testing.T, what string, got, want map[string]int) {
	t.Helper()
	keys := map[string]bool{}
	for k := range got {
		keys[k] = true
	}
	for k := range want {
		keys[k] = true
	}
	sorted := make([]string, 0, len(keys))
	for k := range keys {
		sorted = append(sorted, k)
	}
	sort.Strings(sorted)
	for _, k := range sorted {
		if got[k] != want[k] {
			t.Errorf("%s count %q = %d, want %d", what, k, got[k], want[k])
		}
	}
}

func TestDayFestivalsPolarCatchSitesAreReached(t *testing.T) {
	g := loadDayFestivalsGolden(t)
	if g.PolarHits["reached"] == 0 {
		t.Fatal("polarHits.reached is 0: the sweep resolved no Hindu-day triple at all")
	}
	for _, site := range []struct {
		name    string
		wantPos bool
	}{
		{"tomorrowSunset", true},
		{"dayAfterSunrise", true},
		{"dayBeforeYesterday", false},
	} {
		n := g.PolarHits[site.name]
		if site.wantPos && n == 0 {
			t.Errorf("catch site %q was reached 0 times in %d probed days. The polar spans "+
				"no longer cover it, so the branch is untested. Widen the span rather than "+
				"relaxing this.", site.name, g.PolarHits["reached"])
		}
		if !site.wantPos && n != 0 {
			t.Errorf("catch site %q was reached %d times, and it was measured unreachable "+
				"(0 over 150 station-years). Something about the search offsets changed; "+
				"investigate before re-pinning.", site.name, n)
		}
		t.Logf("catch site %-18s reached %d of %d probed days", site.name, n, g.PolarHits["reached"])
	}
}

func TestNishitaStartMatchesTheTwoRoundingForm(t *testing.T) {
	const base = 1_767_225_600_000
	nishitaStart := func(sunsetMs, nightMs int64) int64 {
		return computeKalaAnchors(sunsetMs-int64(9*3600_000), sunsetMs, sunsetMs+nightMs).NishitaStart
	}

	for i := 0; i < 200_000; i++ {
		sunsetMs := base + int64(i)*7919
		nightMs := int64(6*3600_000) + int64(i)*4241%int64(12*3600_000)
		want := int64(float64(sunsetMs) + float64(float64(nightMs)*0.3))
		if got := nishitaStart(sunsetMs, nightMs); got != want {
			t.Fatalf("nishitaStart(%d, %d) = %d, want the separately-rounded %d",
				sunsetMs, nightMs, got, want)
		}
	}

	divergedFloat, divergedMs := 0, 0
	for i := 0; i < 1_000_000; i++ {
		sunsetMs := base + int64(i)%86_400_000
		nightMs := int64(6*3600_000) + int64(i)*7919%int64(12*3600_000)
		fused := math.FMA(float64(nightMs), 0.3, float64(sunsetMs))
		shipped := float64(sunsetMs) + float64(float64(nightMs)*0.3)
		if fused != shipped {
			divergedFloat++
			if int64(fused) != int64(shipped) {
				divergedMs++
			}
		}
	}
	t.Logf("single-rounded vs separately-rounded over 1,000,000 pairs: "+
		"%d differ as doubles, %d differ after truncation "+
		"(0/0 is the standing measurement, because the product's rounding error is 2^-18 of "+
		"the sum's ULP, so it cannot cross a boundary except on an exact tie)",
		divergedFloat, divergedMs)
}

func TestKalaAnchorIntegerDivisionsMatchTheFloatForm(t *testing.T) {
	const base = 1_767_225_600_000
	for i := 0; i < 50_000; i++ {
		sunriseMs := base + int64(i)*7919
		dayLengthMs := 1 + int64(i)*3391%int64(47*3600_000)
		sunsetMs := sunriseMs + dayLengthMs
		nextSunriseMs := sunsetMs + 1 + int64(i)*2711%int64(47*3600_000)
		a := computeKalaAnchors(sunriseMs, sunsetMs, nextSunriseMs)

		checks := []struct {
			name string
			got  int64
			want float64
		}{
			{"madhyahna", a.Madhyahna, float64(sunriseMs) + float64(dayLengthMs)/2},
			{"aparahna", a.Aparahna, float64(sunriseMs) + float64(dayLengthMs*8)/10},
			{"nishita", a.Nishita, (float64(sunsetMs) + float64(nextSunriseMs)) / 2},
			{"madhyahnaStart", a.MadhyahnaStart, float64(sunriseMs) + float64(dayLengthMs)/4},
			{"aparahnaStart", a.AparahnaStart, float64(sunriseMs) + float64(dayLengthMs*3)/5},
		}
		for _, c := range checks {
			if want := int64(math.Trunc(c.want)); c.got != want {
				t.Fatalf("%s at i=%d: integer form %d, float-then-truncate form %d",
					c.name, i, c.got, want)
			}
		}
	}
}
