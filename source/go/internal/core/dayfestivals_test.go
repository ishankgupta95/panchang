package core

import (
	"errors"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

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

func TestDayFestivalsClaimTheDaysNoRuleUsedToClaim(t *testing.T) {
	sydney := types.GeoLocation{Latitude: -33.8688, Longitude: 151.2093}
	delhi := types.GeoLocation{Latitude: 28.6139, Longitude: 77.209}
	chennai := types.GeoLocation{Latitude: 13.0827, Longitude: 80.2707}
	kochi := types.GeoLocation{Latitude: 9.9312, Longitude: 76.2673}
	for _, c := range []struct {
		name       string
		y, m, d    int
		loc        types.GeoLocation
		opts       PanchangOptions
		wantAdhika bool
		want, not  []string
	}{
		{"kshaya Nija Pratipada on the last Adhika day", 2020, 10, 17, sydney,
			PanchangOptions{Timezone: types.TimezoneName("Australia/Sydney")}, true,
			[]string{"navaratri"}, nil},
		{"Chaturthi at no moonrise", 2025, 10, 10, delhi, dailyOpts(), false,
			[]string{"karva_chauth", "sankashti_chaturthi"}, nil},
		{"vriddha Ekadashi before a kshaya Dwadashi, day 1", 2030, 3, 15, chennai, dailyOpts(), false,
			[]string{"smarta_ekadashi", "ekadashi"}, []string{"vaishnava_ekadashi"}},
		{"vriddha Ekadashi before a kshaya Dwadashi, day 2", 2030, 3, 16, chennai, dailyOpts(), false,
			[]string{"vaishnava_ekadashi"}, []string{"smarta_ekadashi", "ekadashi"}},
		{"Thiruvonam in Adhika Bhadrapada", 2012, 8, 29, kochi,
			PanchangOptions{InstantPanchangOptions: InstantPanchangOptions{Region: types.RegionKerala}, Timezone: testIST},
			true,
			[]string{"onam"}, nil},
	} {
		r := mustDaily(t, types.DateUTC(c.y, c.m-1, c.d).Ms()+12*3_600_000, c.loc, c.opts)
		if r.Calendar.Chandramasa.IsAdhika != c.wantAdhika {
			t.Errorf("%s: isAdhika %v, want %v", c.name, r.Calendar.Chandramasa.IsAdhika, c.wantAdhika)
		}
		got := map[string]bool{}
		for _, f := range r.Festivals {
			got[string(f.Key)] = true
		}
		for _, k := range c.want {
			if !got[k] {
				t.Errorf("%s: %s missing from %v", c.name, k, r.Festivals)
			}
		}
		for _, k := range c.not {
			if got[k] {
				t.Errorf("%s: %s must not be emitted", c.name, k)
			}
		}
	}
}

// Days of exactly 12 h daylight from 06:00: madhyahna 10:48-13:12, pradosha 18:00-20:24, nishita
// 23:36-00:24. One anchor tithi occupies [start, end); the expected days follow from the rule text,
// as in the TypeScript unit test of the same name.
func selectionRun(day, tithi int, span [2]int64, masa int, bhadraEnd int64) map[string]bool {
	const hour = int64(3_600_000)
	day0 := int64(1894233600000) // 2030-01-10T00:00Z
	at := func(d int, hours float64) int64 { return day0 + int64(d)*24*hour + int64(hours*float64(hour)) }
	kalaDay := func(k int) KalaDay {
		return KalaDay{Sunrise: at(day+k, 6), Sunset: at(day+k, 18), NextSunrise: at(day+k+1, 6)}
	}
	tithiAt := func(ms int64) int {
		switch {
		case ms < span[0]:
			return (tithi + 29) % 30
		case ms < span[1]:
			return tithi
		}
		return (tithi + 1) % 30
	}
	if bhadraEnd == 0 {
		bhadraEnd = span[0]
	}
	reaches := map[float64]int64{
		float64(tithi * 12): span[0], float64(((tithi + 1) % 30) * 12): span[1], float64(tithi*12 + 6): bhadraEnd,
	}
	g := &DayGeometry{
		Today:       kalaDay(0),
		Day:         func(k int) (KalaDay, bool) { return kalaDay(k), true },
		TithiAt:     tithiAt,
		NakshatraAt: func(int64) int { return 10 },
		ElongationReaches: func(deg float64, _ int64) int64 {
			if v, ok := reaches[deg]; ok {
				return v
			}
			return math.MinInt64
		},
		LocalDay: func(ms int64) int64 { return ms / (24 * hour) },
	}
	got := map[string]bool{}
	for _, f := range ComputeFestivals(&FestivalComputeContext{
		TithiIndex: tithiAt(at(day, 6)), NakshatraIndex: 10, ChandraMasaIndex: masa, VaraIndex: 3,
		SolarMasaIndex: 2, DayGeometry: g,
	}, func(k string) string { return k }, nil) {
		got[f.Key] = true
	}
	return got
}

func TestDaySelectionWithADayGeometry(t *testing.T) {
	const hour = int64(3_600_000)
	day0 := int64(1894233600000)
	at := func(d int, hours float64) int64 { return day0 + int64(d)*24*hour + int64(hours*float64(hour)) }

	shivaratri := [2]int64{at(0, 23.5), at(2, 0.5)}
	if selectionRun(0, 28, shivaratri, 2, 0)["masik_shivaratri"] || !selectionRun(1, 28, shivaratri, 2, 0)["masik_shivaratri"] {
		t.Error("Shivaratri: nishita fully held on both nights must go to the later night")
	}
	vinayaka := [2]int64{at(0, 10.7), at(1, 13.3)}
	if !selectionRun(0, 3, vinayaka, 2, 0)["vinayaka_chaturthi"] || selectionRun(1, 3, vinayaka, 2, 0)["vinayaka_chaturthi"] {
		t.Error("Vinayaka: madhyahna fully held on both days must go to the earlier day")
	}
	pradosh := [2]int64{at(0, 20.7), at(1, 17.8)}
	if selectionRun(0, 12, pradosh, 2, 0)["pradosha"] || selectionRun(1, 12, pradosh, 2, 0)["pradosha"] {
		t.Error("Pradosh vrat: a Trayodashi touching neither pradosha has no vrat")
	}
	raksha := [2]int64{at(0, 10), at(1, 7)}
	if !selectionRun(0, 14, raksha, 4, 0)["raksha_bandhan"] || selectionRun(1, 14, raksha, 4, 0)["raksha_bandhan"] {
		t.Error("Raksha Bandhan: under 3 muhurtas after the udaya sunrise moves it to the day Purnima begins")
	}
	holi := [2]int64{at(0, 9), at(1, 8)}
	d0 := selectionRun(0, 14, holi, 11, at(0, 20.5))
	d1 := selectionRun(1, 14, holi, 11, at(0, 20.5))
	if !d0["holika_dahan"] || d0["holi"] || !d1["holi"] || d1["holika_dahan"] {
		t.Errorf("Holika Dahan the evening Bhadra ends before midnight, Holi the next day: day0 %v day1 %v", d0, d1)
	}
}
