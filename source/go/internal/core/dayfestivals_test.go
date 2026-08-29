package core

import (
	"errors"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

// Widening this to a bare err != nil would turn a real failure into "no sun".
func TestIsPolarRiseSetErrorClassifiesOnlyTheTwoSentinels(t *testing.T) {
	for _, code := range types.AllErrorCodes {
		want := code == types.ErrNoSunrise || code == types.ErrNoSunset
		err := types.NewPanchangError("x", code)
		if got := isPolarRiseSetError(err); got != want {
			t.Errorf("isPolarRiseSetError(%s) = %v, want %v", code, got, want)
		}
	}
	if isPolarRiseSetError(errors.New("some other failure")) {
		t.Error("isPolarRiseSetError accepted a non-PanchangError; a plain error must propagate")
	}
	if isPolarRiseSetError(nil) {
		t.Error("isPolarRiseSetError(nil) must be false")
	}
}

func TestComputeDayFestivalsPropagatesNonSentinelErrors(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	ms := types.DateUTC(2026, 7, 20).Ms() + 6*3600_000
	sunrise, err := astronomy.ComputeSunrise(ctx, ms, testPune, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		t.Fatalf("setting up: %v", err)
	}
	sunset, err := astronomy.ComputeSunset(ctx, sunrise, testPune, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		t.Fatalf("setting up: %v", err)
	}
	nextSunrise, err := astronomy.ComputeSunrise(ctx, sunset, testPune, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		t.Fatalf("setting up: %v", err)
	}

	cache, err := astronomy.NewLongitudeCache(ctx, types.Lahiri, panchangCacheMode)
	if err != nil {
		t.Fatalf("setting up: %v", err)
	}
	in := DayFestivalInputs{
		SunriseMs: sunrise, SunsetMs: sunset, NextSunriseMs: nextSunrise,
		Location:              types.GeoLocation{Latitude: 91, Longitude: 73.8567},
		OffsetMinutes:         330,
		TithiIndexAtSunrise:   GetTithiIndexFromLons(cache.GetMoon(sunrise), cache.GetSun(sunrise)),
		SiderealMoonAtSunrise: cache.GetMoon(sunrise),
		SiderealSunAtSunrise:  cache.GetSun(sunrise),
		Lang:                  types.LanguageEn,
		T:                     i18n.GetTranslations(types.LanguageEn),
		GetMoon:               cache.GetMoon,
		GetSun:                cache.GetSun,
	}

	got, err := ComputeDayFestivals(ctx, in)
	if err == nil {
		t.Fatalf("latitude 91 returned %d festivals and no error; the invalid-location "+
			"failure was swallowed by a polar catch", len(got))
	}
	var pe *types.PanchangError
	if !errors.As(err, &pe) || pe.Code != types.ErrInvalidLatitude {
		t.Errorf("err = %v, want INVALID_LATITUDE", err)
	}
	if got != nil {
		t.Errorf("a failing call returned %v; it must return a nil slice with the error", got)
	}
}

func TestResolveFestivalNameFallbackChain(t *testing.T) {
	tr := i18n.PanchangTranslations{
		FestivalNames: map[string]string{"diwali": "Diwali", "blank": ""},
		Misc:          i18n.MiscNames{Ekadashi: "Ekadashi", Pradosha: "Pradosha Vrata"},
	}
	for _, c := range []struct{ key, want string }{
		{"diwali", "Diwali"},           // rung 1
		{"blank", ""},                  // rung 1, present but empty, and must NOT fall through
		{"ekadashi", "Ekadashi"},       // rung 2
		{"pradosha", "Pradosha Vrata"}, // rung 2
		{"purnima", ""},                // rung 2, present in misc but empty here
		{"no_such_key", "no_such_key"}, // rung 3
	} {
		if got := resolveFestivalName(tr, c.key); got != c.want {
			t.Errorf("resolveFestivalName(%q) = %q, want %q", c.key, got, c.want)
		}
	}
}

func TestFestivalNameChainReachesEveryRungInTheRealTables(t *testing.T) {
	for _, lang := range []types.Language{types.LanguageEn, types.LanguageHi} {
		tr := i18n.GetTranslations(lang)
		viaMisc := 0
		for _, key := range i18n.MiscKeys {
			if _, inFestivals := tr.FestivalNames[key]; !inFestivals {
				if _, ok := tr.MiscByKey(key); ok {
					viaMisc++
				}
			}
		}
		if viaMisc == 0 {
			t.Errorf("%s: every misc key is shadowed by festivalNames, so the second rung "+
				"of the fallback chain is unreachable and untested", lang)
		}
		t.Logf("%s: %d of %d misc keys reach the second rung", lang, viaMisc, len(i18n.MiscKeys))
	}
}

func TestKalaAnchorsPrevailingOrder(t *testing.T) {
	const base = 1_767_225_600_000
	for i := 0; i < 20_000; i++ {
		sunrise := base + int64(i)*7919
		day := 1 + int64(i)*3391%int64(47*3600_000)
		night := 1 + int64(i)*2711%int64(47*3600_000)
		sunset := sunrise + day
		nextSunrise := sunset + night
		a := computeKalaAnchors(sunrise, sunset, nextSunrise)

		type pair struct {
			name     string
			lo, hi   int64
			strictly bool
		}
		for _, c := range []pair{
			{"arunodaya < sunrise", a.Arunodaya, sunrise, true},
			{"sunrise <= madhyahnaStart", sunrise, a.MadhyahnaStart, false},
			{"madhyahnaStart <= madhyahna", a.MadhyahnaStart, a.Madhyahna, false},
			{"madhyahna <= aparahnaStart", a.Madhyahna, a.AparahnaStart, false},
			{"aparahnaStart <= aparahna", a.AparahnaStart, a.Aparahna, false},
			{"aparahna <= sunset", a.Aparahna, sunset, false},
			{"pradoshaStart == sunset", a.PradoshaStart, sunset, false},
			{"sunset < pradosha", sunset, a.Pradosha, true},
			{"sunset <= nishitaStart", sunset, a.NishitaStart, false},
			{"nishitaStart <= nishita", a.NishitaStart, a.Nishita, false},
			{"nishita <= nextSunrise", a.Nishita, nextSunrise, false},
		} {
			if c.strictly && c.lo >= c.hi {
				t.Fatalf("i=%d day=%d night=%d: %s violated (%d, %d)", i, day, night, c.name, c.lo, c.hi)
			}
			if !c.strictly && c.lo > c.hi {
				t.Fatalf("i=%d day=%d night=%d: %s violated (%d, %d)", i, day, night, c.name, c.lo, c.hi)
			}
		}
		if a.PradoshaStart != sunset {
			t.Fatalf("pradoshaStart must be sunset itself, got %d vs %d", a.PradoshaStart, sunset)
		}
	}
}

func TestNishitaWindowIsCenteredOnSolarMidnight(t *testing.T) {
	const base = 1_767_225_600_000
	for i := 0; i < 20_000; i++ {
		sunset := base + int64(i)*7919
		night := int64(4*3600_000) + int64(i)*2711%int64(20*3600_000)
		w := nishitaWindow(sunset, sunset+night)

		width := w[1] - w[0]
		if want := night / 15; width < want-2 || width > want+2 {
			t.Fatalf("i=%d night=%d: window width %d, want ~night/15 = %d", i, night, width, want)
		}
		center := (w[0] + w[1]) / 2
		if solarMidnight := (sunset + sunset + night) / 2; center < solarMidnight-1 || center > solarMidnight+1 {
			t.Fatalf("i=%d: window centre %d, want solar midnight %d", i, center, solarMidnight)
		}
		if w[0] <= sunset || w[1] >= sunset+night {
			t.Fatalf("i=%d: window [%d, %d] escapes the night [%d, %d]",
				i, w[0], w[1], sunset, sunset+night)
		}
	}
}

func TestWindowHasIsAnEdgeTest(t *testing.T) {
	w := [2]int64{100, 200}
	seen := []int64{}
	got := windowHas(w, func(ms int64) bool { seen = append(seen, ms); return false })
	if got {
		t.Error("windowHas returned true for an always-false predicate")
	}
	if len(seen) != 2 || seen[0] != 100 || seen[1] != 200 {
		t.Errorf("windowHas sampled %v, want exactly the two edges [100 200]", seen)
	}
	calls := 0
	if !windowHas(w, func(int64) bool { calls++; return true }) || calls != 1 {
		t.Errorf("windowHas made %d calls for a true first edge, want 1", calls)
	}
}

func TestTwoDigitsMatchesPadStart(t *testing.T) {
	for n := 0; n <= 59; n++ {
		want := string(rune('0'+n/10)) + string(rune('0'+n%10))
		if got := twoDigits(n); got != want {
			t.Errorf("twoDigits(%d) = %q, want %q", n, got, want)
		}
	}
}

func TestIsMeshaDistinguishesZeroFromAbsent(t *testing.T) {
	zero, three := 0, 3
	if isMesha(nil) {
		t.Error("isMesha(nil) must be false: no transit is not a transit into Mesha")
	}
	if !isMesha(&zero) {
		t.Error("isMesha(&0) must be true: 0 is Mesha")
	}
	if isMesha(&three) {
		t.Error("isMesha(&3) must be false")
	}
}

func TestKalaAnchorsMatchTimeClipOnPre1970Days(t *testing.T) {
	const sunrise, dayLen = int64(-1830076239031), int64(39605123)
	a := computeKalaAnchors(sunrise, sunrise+dayLen, sunrise+86_400_000)
	for _, c := range []struct {
		name string
		got  int64
		want int64
	}{
		{"Madhyahna", a.Madhyahna, -1830056436469},
		{"Aparahna", a.Aparahna, -1830044554932},
		{"MadhyahnaStart", a.MadhyahnaStart, -1830066337750},
		{"AparahnaStart", a.AparahnaStart, -1830052475957},
	} {
		if c.got != c.want {
			t.Errorf("%s = %d, want %d (TimeClip semantics; the integer spelling gives %d)",
				c.name, c.got, c.want, c.want-1)
		}
	}
}
