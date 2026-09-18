package core

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type calendarGolden struct {
	Vara []struct {
		DateMs    int64                     `json:"dateMs"`
		SunriseMs int64                     `json:"sunriseMs"`
		ByLang    map[string]types.VaraInfo `json:"byLang"`
	} `json:"vara"`
	ByLongitude []struct {
		Lon            float64                  `json:"lon"`
		ChandraRashi   types.RashiInfo          `json:"chandraRashi"`
		SuryaNakshatra types.NakshatraIndexInfo `json:"suryaNakshatra"`
		Masa           types.MasaInfo           `json:"masa"`
		ChandraRashiHi string                   `json:"chandraRashiHi"`
	} `json:"byLongitude"`
	ChandraMasa []struct {
		Ms     int64                 `json:"ms"`
		System types.MasaSystem      `json:"system"`
		Lang   types.Language        `json:"lang"`
		Result types.ChandraMasaInfo `json:"result"`
	} `json:"chandraMasa"`
	Samvat []struct {
		Year      int              `json:"year"`
		ChaitraMs int64            `json:"chaitraMs"`
		Ms        int64            `json:"ms"`
		Result    types.SamvatInfo `json:"result"`
	} `json:"samvat"`
}

func loadCalendarGolden(t *testing.T) calendarGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "core", "calendar-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g calendarGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Vara) == 0 || len(g.ByLongitude) == 0 || len(g.ChandraMasa) == 0 || len(g.Samvat) == 0 {
		t.Fatal("golden is missing an arm")
	}
	return g
}

func TestVaraMatchesTypeScript(t *testing.T) {
	g := loadCalendarGolden(t)
	rolledBack, weekdays := 0, map[int]bool{}
	for i, c := range g.Vara {
		for lang, want := range c.ByLang {
			names := i18n.GetTranslations(types.Language(lang)).VaraNames
			got := ComputeVara(c.DateMs, c.SunriseMs, names)
			if got != want {
				t.Errorf("vara[%d] %s (date=%d sunrise=%d): got %+v want %+v",
					i, lang, c.DateMs, c.SunriseMs, got, want)
			}
		}
		if c.DateMs < c.SunriseMs {
			rolledBack++
		}
		weekdays[c.ByLang["en"].Index] = true
	}

	if rolledBack == 0 || rolledBack == len(g.Vara) {
		t.Errorf("%d of %d cases roll the weekday back: one branch is never exercised",
			rolledBack, len(g.Vara))
	}
	if len(weekdays) != 7 {
		t.Errorf("only %d of 7 weekdays reached", len(weekdays))
	}
}

func TestVaraRollbackIsStrictlyBeforeSunrise(t *testing.T) {
	names := i18n.GetTranslations(types.LanguageEn).VaraNames
	sunrise := types.DateUTC(2025, 0, 1).Ms() + 6*3600_000
	before := ComputeVara(sunrise-1, sunrise, names)
	at := ComputeVara(sunrise, sunrise, names)
	after := ComputeVara(sunrise+1, sunrise, names)
	if at != after {
		t.Errorf("sunrise and sunrise+1ms disagree: %+v vs %+v; the comparison is not strict", at, after)
	}
	if before.Index == at.Index {
		t.Errorf("sunrise-1ms and sunrise agree (%d): the rollback never fires", at.Index)
	}
	if want := (at.Index + 6) % 7; before.Index != want {
		t.Errorf("rollback gave weekday %d, want %d (one day back from %d)", before.Index, want, at.Index)
	}
}

func TestLongitudeElementsMatchTypeScript(t *testing.T) {
	g := loadCalendarGolden(t)
	rashi, nak, masa := map[int]bool{}, map[int]bool{}, map[int]bool{}
	for i, c := range g.ByLongitude {
		if got := ComputeChandraRashi(c.Lon, func(idx int) string {
			return i18n.ResolveMasaName(idx, types.LanguageEn)
		}); got != c.ChandraRashi {
			t.Errorf("byLongitude[%d] lon=%v chandraRashi: got %+v want %+v", i, c.Lon, got, c.ChandraRashi)
		}
		if got := ComputeSuryaNakshatra(c.Lon, func(idx int) string {
			return i18n.ResolveNakshatraName(idx, types.LanguageEn)
		}); got != c.SuryaNakshatra {
			t.Errorf("byLongitude[%d] lon=%v suryaNakshatra: got %+v want %+v", i, c.Lon, got, c.SuryaNakshatra)
		}
		if got := ComputeMasa(c.Lon, func(idx int) string {
			return i18n.ResolveMasaName(idx, types.LanguageEn)
		}); got != c.Masa {
			t.Errorf("byLongitude[%d] lon=%v masa: got %+v want %+v", i, c.Lon, got, c.Masa)
		}
		if got := ComputeChandraRashi(c.Lon, func(idx int) string {
			return i18n.ResolveMasaName(idx, types.LanguageHi)
		}).Name; got != c.ChandraRashiHi {
			t.Errorf("byLongitude[%d] lon=%v chandraRashi(hi): got %q want %q", i, c.Lon, got, c.ChandraRashiHi)
		}
		rashi[c.ChandraRashi.Index] = true
		nak[c.SuryaNakshatra.Index] = true
		masa[c.Masa.Index] = true
	}
	if len(rashi) < 12 || len(masa) < 12 || len(nak) < 27 {
		t.Errorf("coverage: %d rashis, %d masas, %d nakshatras; want 12/12/27",
			len(rashi), len(masa), len(nak))
	}
}

func TestChandraRashiAndMasaShareTheDivision(t *testing.T) {
	for _, lon := range normalizedLongitudes() {
		a := ComputeChandraRashi(lon, func(int) string { return "" }).Index
		b := ComputeMasa(lon, func(int) string { return "" }).Index
		c := utils.RashiOf(lon)
		if a != b || a != c {
			t.Fatalf("lon=%v: chandraRashi %d, masa %d, RashiOf %d", lon, a, b, c)
		}
		if a < 0 || a >= 12 {
			t.Fatalf("lon=%v gave rashi index %d, out of [0,12)", lon, a)
		}
	}
}

func calendarEphemeris(t *testing.T) (*astronomy.EphemerisCtx, LongitudeAt, LongitudeAt, BoundsAt) {
	t.Helper()
	ctx := &astronomy.EphemerisCtx{}
	sun := LongitudeAt(func(ms int64) float64 {
		v, err := astronomy.GetSiderealSunLongitude(ctx, ms, types.Lahiri)
		if err != nil {
			t.Fatalf("sidereal Sun at %d: %v", ms, err)
		}
		return v
	})
	moon := LongitudeAt(func(ms int64) float64 {
		v, err := astronomy.GetSiderealMoonLongitude(ctx, ms, types.Lahiri)
		if err != nil {
			t.Fatalf("sidereal Moon at %d: %v", ms, err)
		}
		return v
	})
	bounds := BoundsAt(func(ms int64) (astronomy.NewMoonBounds, error) {
		return astronomy.BoundingNewMoons(ctx, ms)
	})
	return ctx, sun, moon, bounds
}

func TestChandraMasaMatchesTypeScript(t *testing.T) {
	g := loadCalendarGolden(t)
	_, getSun, getMoon, getBounds := calendarEphemeris(t)

	adhika, nija, ahead := 0, 0, 0
	amantaSeen := map[int]bool{}
	for i, c := range g.ChandraMasa {
		got, err := ComputeChandraMasa(
			getSun(c.Ms), getMoon(c.Ms),
			func(idx int, isAdhika bool) string {
				return i18n.ResolveChandraMasaName(idx, c.Lang, isAdhika)
			},
			c.System, c.Ms, getSun, getBounds,
		)
		if err != nil {
			t.Fatalf("chandraMasa[%d] ms=%d: %v", i, c.Ms, err)
		}
		if got != c.Result {
			t.Errorf("chandraMasa[%d] ms=%d system=%s lang=%s:\n got %+v\nwant %+v",
				i, c.Ms, c.System, c.Lang, got, c.Result)
		}
		if got.IsAdhika {
			adhika++
		} else {
			nija++
		}
		if got.PurnimantaIndex != got.AmantaIndex {
			ahead++
		}
		amantaSeen[got.AmantaIndex] = true
	}

	if adhika == 0 {
		t.Error("no Adhika month in the sample: the intercalary branch is untested. " +
			"The golden spans 2026, which contains Adhika Jyeshtha.")
	}
	if nija == 0 {
		t.Error("every case was Adhika: the ordinary branch is untested")
	}
	if ahead == 0 {
		t.Error("Purnimanta never ran ahead of Amanta: the Krishna Paksha branch is untested")
	}
	if len(amantaSeen) != 12 {
		t.Errorf("only %d of 12 amanta months reached", len(amantaSeen))
	}
	t.Logf("%d adhika / %d nija, %d cases with purnimanta ahead of amanta, %d months",
		adhika, nija, ahead, len(amantaSeen))
}

func TestAdhikaSuppressesThePurnimantaAdvance(t *testing.T) {
	g := loadCalendarGolden(t)
	krishnaAdhika := 0
	_, getSun, getMoon, _ := calendarEphemeris(t)
	for _, c := range g.ChandraMasa {
		if !c.Result.IsAdhika {
			continue
		}
		if c.Result.PurnimantaIndex != c.Result.AmantaIndex {
			t.Errorf("ms=%d is Adhika but Purnimanta (%d) ran ahead of Amanta (%d)",
				c.Ms, c.Result.PurnimantaIndex, c.Result.AmantaIndex)
		}
		elongation := math.Mod(math.Mod(getMoon(c.Ms)-getSun(c.Ms), 360)+360, 360)
		if elongation >= 180 {
			krishnaAdhika++
		}
	}
	if krishnaAdhika == 0 {
		t.Error("no Adhika case fell in Krishna Paksha: the suppression rule was never " +
			"actually exercised, only vacuously satisfied")
	}
	t.Logf("%d Adhika cases in Krishna Paksha, where the suppression rule bites", krishnaAdhika)
}

func TestSamvatMatchesTypeScript(t *testing.T) {
	g := loadCalendarGolden(t)
	ctx := &astronomy.EphemerisCtx{}
	ClearChaitraCache()

	before, after := 0, 0
	years := map[int]bool{}
	for i, c := range g.Samvat {
		chaitra, err := ChaitraNewMoon(ctx, c.Year)
		if err != nil {
			t.Fatalf("chaitraNewMoon(%d): %v", c.Year, err)
		}
		if chaitra != c.ChaitraMs {
			t.Errorf("chaitraNewMoon(%d): got %d (%s) want %d (%s)", c.Year,
				chaitra, types.Date(chaitra).ISOString(), c.ChaitraMs, types.Date(c.ChaitraMs).ISOString())
		}
		got, err := ComputeSamvat(ctx, c.Ms)
		if err != nil {
			t.Fatalf("computeSamvat(%d): %v", c.Ms, err)
		}
		if got != c.Result {
			t.Errorf("samvat[%d] year=%d ms=%d:\n got %+v\nwant %+v", i, c.Year, c.Ms, got, c.Result)
		}
		if c.Ms >= c.ChaitraMs {
			after++
		} else {
			before++
		}
		years[c.Year] = true
	}
	if before == 0 || after == 0 {
		t.Errorf("era-boundary coverage: %d before, %d after; one arm is untested", before, after)
	}
	if len(years) < 20 {
		t.Errorf("only %d distinct years: the 60-year Samvatsara cycle is barely covered", len(years))
	}
}

func TestSamvatInvariants(t *testing.T) {
	g := loadCalendarGolden(t)
	for _, c := range g.Samvat {
		if d := c.Result.VikramSamvat - c.Result.ShakaSamvat; d != 135 {
			t.Fatalf("year %d: VS %d − Shaka %d = %d, want 135",
				c.Year, c.Result.VikramSamvat, c.Result.ShakaSamvat, d)
		}
		iv, is := -1, -1
		for i, n := range samvatsaraNames {
			if n == c.Result.VikramSamvatsara {
				iv = i
			}
			if n == c.Result.ShakaSamvatsara {
				is = i
			}
		}
		if iv < 0 || is < 0 {
			t.Fatalf("year %d: samvatsara name not in the 60-entry table (%q / %q)",
				c.Year, c.Result.VikramSamvatsara, c.Result.ShakaSamvatsara)
		}
		if got := ((iv-is)%60 + 60) % 60; got != 13 {
			t.Fatalf("year %d: Vikram samvatsara %q is %d positions after Shaka %q, want 13",
				c.Year, c.Result.VikramSamvatsara, got, c.Result.ShakaSamvatsara)
		}
	}
}

func TestSamvatsaraIndexHandlesNegativeYears(t *testing.T) {
	for n := -600; n <= 600; n++ {
		i := samvatsaraIndex(n)
		if i < 0 || i >= 60 {
			t.Fatalf("samvatsaraIndex(%d) = %d, out of [0,60)", n, i)
		}
		want := ((n % 60) + 60) % 60
		if i != want {
			t.Fatalf("samvatsaraIndex(%d) = %d, want %d", n, i, want)
		}
	}
	if samvatsaraIndex(-1) != 59 {
		t.Errorf("samvatsaraIndex(-1) = %d, want 59", samvatsaraIndex(-1))
	}
}

func TestChaitraCacheIsOutputNeutral(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	years := []int{1900, 1950, 2000, 2025, 2026, 2088, 2100}

	ClearChaitraCache()
	cold := make([]int64, len(years))
	for i, y := range years {
		v, err := ChaitraNewMoon(ctx, y)
		if err != nil {
			t.Fatal(err)
		}
		cold[i] = v
	}
	for i, y := range years {
		v, err := ChaitraNewMoon(ctx, y)
		if err != nil {
			t.Fatal(err)
		}
		if v != cold[i] {
			t.Errorf("year %d: warm %d != cold %d", y, v, cold[i])
		}
	}

	for y := 1000; y < 2600; y++ {
		if _, err := ChaitraNewMoon(ctx, y); err != nil {
			t.Fatal(err)
		}
	}
	if n := chaitraStore.Len(); n > chaitraStore.Cap() {
		t.Errorf("store holds %d entries, cap is %d", n, chaitraStore.Cap())
	}
	for i, y := range years {
		v, err := ChaitraNewMoon(ctx, y)
		if err != nil {
			t.Fatal(err)
		}
		if v != cold[i] {
			t.Errorf("year %d after eviction: %d != cold %d", y, v, cold[i])
		}
	}
	t.Logf("chaitra store: %d entries resident after 1,600 years requested (cap %d, %d stripes)",
		chaitraStore.Len(), chaitraStore.Cap(), chaitraStore.Stripes())
	ClearChaitraCache()
	if n := chaitraStore.Len(); n != 0 {
		t.Errorf("ClearChaitraCache left %d entries", n)
	}
}

func TestChaitraCacheIsRaceFreeAndOrderIndependent(t *testing.T) {
	years := make([]int, 0, 64)
	for y := 1980; y < 2044; y++ {
		years = append(years, y)
	}

	ClearChaitraCache()
	serial := make([]int64, len(years))
	ctx := &astronomy.EphemerisCtx{}
	for i, y := range years {
		v, err := ChaitraNewMoon(ctx, y)
		if err != nil {
			t.Fatal(err)
		}
		serial[i] = v
	}

	ClearChaitraCache()
	const goroutines = 8
	got := make([][]int64, goroutines)
	errs := make([]error, goroutines)
	done := make(chan int, goroutines)
	for g := 0; g < goroutines; g++ {
		go func(g int) {
			defer func() { done <- g }()
			gctx := &astronomy.EphemerisCtx{}
			out := make([]int64, len(years))
			stride := 1 + 2*g // odd, hence coprime with len(years) == 64
			for k := range years {
				i := (g*7 + k*stride) % len(years)
				v, err := ChaitraNewMoon(gctx, years[i])
				if err != nil {
					errs[g] = err
					return
				}
				out[i] = v
			}
			got[g] = out
		}(g)
	}
	for i := 0; i < goroutines; i++ {
		<-done
	}
	for g := 0; g < goroutines; g++ {
		if errs[g] != nil {
			t.Fatalf("goroutine %d: %v", g, errs[g])
		}
		for i, y := range years {
			if got[g][i] != serial[i] {
				t.Errorf("goroutine %d, year %d: concurrent %d != serial %d",
					g, y, got[g][i], serial[i])
			}
		}
	}
	if n := chaitraStore.Len(); n != len(years) {
		t.Errorf("store holds %d entries after %d distinct years; at most one instance "+
			"per key should be visible", n, len(years))
	}
}
